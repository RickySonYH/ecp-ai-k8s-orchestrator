# [advice from AI] ECP-AI 리소스 계산 엔진 - 실제 가중치 데이터 정확 반영
"""
ECP-AI 리소스 계산 엔진
- 실제 서비스별 처리량 기반 GPU/CPU 리소스 정확한 계산
- 동적 GPU 스케일링 및 캐시 최적화 반영
- GPU 타입별 처리 용량 차이 정확 적용
- 워크로드 강도 기반 동적 RAM 할당
- 고급 설정 추천값 자동 계산
"""

import math
from typing import Dict, Any, Tuple, Optional, List, Union
from pydantic import BaseModel, Field
import structlog

# 새로운 모델 import
from app.models.tenant_specs import (
    EnvironmentVariable, VolumeMount, HealthCheckConfig, 
    NetworkConfig, PresetType, GPUType
)

logger = structlog.get_logger(__name__)


class ResourceRequirements(BaseModel):
    """리소스 요구사항 모델"""
    gpu: Dict[str, Union[float, str]] = Field(default_factory=dict, description="GPU 요구사항")
    cpu: Dict[str, float] = Field(default_factory=dict, description="CPU 요구사항")
    memory: Dict[str, str] = Field(default_factory=dict, description="메모리 요구사항")
    storage: Dict[str, str] = Field(default_factory=dict, description="스토리지 요구사항")
    
    class Config:
        json_schema_extra = {
            "example": {
                "gpu": {"tts": 1, "nlp": 2, "aicm": 1, "total": 4},
                "cpu": {"stt": 8, "ta": 2, "qa": 1, "infrastructure": 12, "total": 23},
                "memory": {"gpu_ram_gb": 64, "system_ram_gb": 128},
                "storage": {"total_tb": 2.5}
            }
        }


class ResourceCalculator:
    """
    ECP-AI 리소스 계산 엔진
    실제 가중치 데이터를 정확히 반영한 리소스 계산
    """
    
    def __init__(self, service_matrix: Dict[str, Any]):
        self.service_matrix = service_matrix
        self.gpu_profiles = service_matrix["gpu_profiles"]
        self.scaling_logic = service_matrix["scaling_logic"]
        self.service_load_factors = service_matrix["service_load_factors"]
        self.cpu_specs = service_matrix["cpu_server_specs"]
        
        logger.info(
            "ResourceCalculator 초기화 완료",
            gpu_types=list(self.gpu_profiles.keys()),
            scaling_tiers=list(self.scaling_logic["gpu_multipliers"].keys())
        )
    
    def calculate_total_channels(self, service_requirements: Dict[str, int]) -> int:
        """총 채널 수 계산"""
        total_channels = 0
        total_channels += service_requirements.get("callbot", 0)
        total_channels += service_requirements.get("advisor", 0)
        total_channels += service_requirements.get("stt", 0)
        total_channels += service_requirements.get("tts", 0)
        
        logger.debug(
            "총 채널 수 계산",
            callbot=service_requirements.get("callbot", 0),
            advisor=service_requirements.get("advisor", 0),
            stt=service_requirements.get("stt", 0),
            tts=service_requirements.get("tts", 0),
            total_channels=total_channels
        )
        
        return total_channels
    
    def get_gpu_multipliers(self, total_channels: int) -> Tuple[float, float]:
        """
        채널 수 기반 GPU 배수 계산
        동적 GPU 스케일링 로직
        """
        multipliers = self.scaling_logic["gpu_multipliers"]
        
        if total_channels <= 100:
            config = multipliers["channels_100_or_less"]
            tier = "≤100채널"
        elif total_channels <= 500:
            config = multipliers["channels_101_to_500"]
            tier = "101-500채널"
        else:
            config = multipliers["channels_over_500"]
            tier = ">500채널"
        
        nlp_multiplier = config["nlp_multiplier"]
        aicm_multiplier = config["aicm_multiplier"]
        
        logger.info(
            "GPU 배수 계산",
            total_channels=total_channels,
            tier=tier,
            nlp_multiplier=nlp_multiplier,
            aicm_multiplier=aicm_multiplier
        )
        
        return nlp_multiplier, aicm_multiplier
    
    def select_optimal_gpu_type(self, total_channels: int, gpu_count: int) -> str:
        """
        최적 GPU 타입 선택
        채널 수 및 GPU 개수 기반 자동 선택
        """
        # 소규모는 T4 강제 (비용 효율)
        if total_channels <= 100:
            gpu_type = "t4"
            reason = "소규모 환경 - T4 강제"
        # GPU 개수 기반 선택
        elif gpu_count <= 2:
            gpu_type = "t4"
            reason = "GPU 2개 이하 - T4 선택"
        elif gpu_count <= 8:
            gpu_type = "v100"
            reason = "GPU 3-8개 - V100 선택"
        else:
            gpu_type = "l40s"
            reason = "GPU 9개 이상 - L40S 선택"
        
        logger.info(
            "최적 GPU 타입 선택",
            total_channels=total_channels,
            gpu_count=gpu_count,
            selected_type=gpu_type,
            reason=reason
        )
        
        return gpu_type
    
    def calculate_gpu_requirements(self, 
                                 service_requirements: Dict[str, int],
                                 gpu_type: str = "auto") -> Dict[str, Any]:
        """
        GPU 요구사항 계산 - 실제 가중치 정확 반영
        
        서비스별 정확한 처리량:
        - 콜봇: 일일 3200 NLP쿼리, 480 AICM쿼리
        - 챗봇: 일일 288 NLP쿼리, 24 AICM쿼리  
        - 어드바이저: 일일 2400 NLP쿼리, 1360 AICM쿼리
        """
        total_channels = self.calculate_total_channels(service_requirements)
        nlp_multiplier, aicm_multiplier = self.get_gpu_multipliers(total_channels)
        
        gpu_needs = {
            "tts": 0.0,
            "nlp": 0.0, 
            "aicm": 0.0,
            "total": 0.0
        }
        
        # 1. TTS GPU 계산 (캐시 최적화 적용)
        tts_channels = service_requirements.get("callbot", 0) + service_requirements.get("tts", 0)
        
        # 2. NLP GPU 계산 (일일 쿼리 기반 - 실제 가중치)
        total_nlp_queries_daily = 0
        if "callbot" in service_requirements:
            # 콜봇: 160콜 × 20쿼리 = 3200 NLP쿼리/일
            total_nlp_queries_daily += service_requirements["callbot"] * 3200
        if "chatbot" in service_requirements:
            # 챗봇: 2.4세션 × 12쿼리 = 288 NLP쿼리/일
            total_nlp_queries_daily += service_requirements["chatbot"] * 288
        if "advisor" in service_requirements:
            # 어드바이저: 160상담 × 15쿼리 = 2400 NLP쿼리/일
            total_nlp_queries_daily += service_requirements["advisor"] * 2400
        
        # 9시간 근무 기준 초당 쿼리 계산 후 배수 적용
        working_hours = 9
        nlp_qps_needed = (total_nlp_queries_daily / (working_hours * 3600)) * nlp_multiplier
        
        # 3. AICM GPU 계산 (일일 검색 기반 - 실제 가중치)
        total_aicm_queries_daily = 0
        if "callbot" in service_requirements:
            # 콜봇: 160콜 × 3쿼리 = 480 AICM쿼리/일
            total_aicm_queries_daily += service_requirements["callbot"] * 480
        if "chatbot" in service_requirements:
            # 챗봇: 2.4세션 × 1쿼리 = 24 AICM쿼리/일
            total_aicm_queries_daily += service_requirements["chatbot"] * 24
        if "advisor" in service_requirements:
            # 어드바이저: 160상담 × 8.5쿼리 = 1360 AICM쿼리/일
            total_aicm_queries_daily += service_requirements["advisor"] * 1360
        
        aicm_qps_needed = (total_aicm_queries_daily / (working_hours * 3600)) * aicm_multiplier
        
        # 임시 GPU 타입으로 계산 (T4 기준)
        temp_gpu_profile = self.gpu_profiles["t4"]["processing_capacity"]
        
        if tts_channels > 0:
            # TTS: 캐시 최적화로 50채널/GPU (T4 기준)
            gpu_needs["tts"] = math.ceil(tts_channels / temp_gpu_profile["tts_channels_cache"])
        
        if nlp_qps_needed > 0:
            # NLP: 150쿼리/초/GPU (T4 기준)
            gpu_needs["nlp"] = math.ceil(nlp_qps_needed / temp_gpu_profile["nlp_queries_per_second"])
        
        if aicm_qps_needed > 0:
            # AICM: 100검색/초/GPU (T4 기준)
            gpu_needs["aicm"] = math.ceil(aicm_qps_needed / temp_gpu_profile["aicm_searches_per_second"])
        
        gpu_needs["total"] = gpu_needs["tts"] + gpu_needs["nlp"] + gpu_needs["aicm"]
        
        # 최적 GPU 타입 선택
        if gpu_type == "auto":
            optimal_gpu_type = self.select_optimal_gpu_type(total_channels, int(gpu_needs["total"]))
        else:
            optimal_gpu_type = gpu_type
        
        # 선택된 GPU 타입으로 재계산 (성능 차이 반영)
        gpu_profile = self.gpu_profiles[optimal_gpu_type]["processing_capacity"]
        
        if tts_channels > 0:
            gpu_needs["tts"] = math.ceil(tts_channels / gpu_profile["tts_channels_cache"])
        
        if nlp_qps_needed > 0:
            gpu_needs["nlp"] = math.ceil(nlp_qps_needed / gpu_profile["nlp_queries_per_second"])
        
        if aicm_qps_needed > 0:
            gpu_needs["aicm"] = math.ceil(aicm_qps_needed / gpu_profile["aicm_searches_per_second"])
        
        gpu_needs["total"] = gpu_needs["tts"] + gpu_needs["nlp"] + gpu_needs["aicm"]
        gpu_needs["recommended_type"] = optimal_gpu_type
        
        # 상세 로깅
        logger.info(
            "GPU 요구사항 계산 완료",
            service_requirements=service_requirements,
            total_channels=total_channels,
            nlp_queries_daily=total_nlp_queries_daily,
            aicm_queries_daily=total_aicm_queries_daily,
            nlp_qps_needed=round(nlp_qps_needed, 2),
            aicm_qps_needed=round(aicm_qps_needed, 2),
            gpu_needs=gpu_needs,
            optimal_gpu_type=optimal_gpu_type
        )
        
        return gpu_needs
    
    def calculate_cpu_requirements(self, service_requirements: Dict[str, int]) -> Dict[str, float]:
        """
        CPU 요구사항 계산 - 실제 가중치 정확 반영
        
        CPU 처리 용량:
        - STT: 6.5채널/코어 (콜봇 1:1, 어드바이저 1:2)
        - TA: 배치 처리 30% 효율, 유휴 시간 활용
        - QA: 외부 LLM 95%, 내부 처리 5%
        """
        cpu_needs = {
            "stt": 0.0,
            "ta": 0.0,
            "qa": 0.0,
            "infrastructure": 0.0,
            "total": 0.0
        }
        
        # 1. STT CPU 계산 (실제 채널/코어 비율: 6.5채널/코어)
        stt_channels = 0
        stt_channels += service_requirements.get("callbot", 0)  # 콜봇: 1:1
        stt_channels += service_requirements.get("advisor", 0) * 2  # 어드바이저: 1:2 (상담사+고객)
        stt_channels += service_requirements.get("stt", 0)  # 독립 STT
        
        if stt_channels > 0:
            cpu_needs["stt"] = stt_channels / self.cpu_specs["stt"]["channels_per_core"]
        
        # 2. TA CPU 계산 (배치 처리, 30% 효율)
        total_processing = 0
        for service, count in service_requirements.items():
            if service in ["callbot", "chatbot", "advisor"]:
                if service == "callbot":
                    total_processing += count * 160  # 일일 콜 수
                elif service == "chatbot":
                    total_processing += count * 2.4  # 일일 세션 수
                elif service == "advisor":
                    total_processing += count * 160  # 일일 상담 수
        
        total_processing += service_requirements.get("ta", 0)  # 독립 TA
        
        if total_processing > 0:
            # 배치 처리 효율 30% 반영
            batch_factor = self.cpu_specs["ta"]["batch_processing_factor"]
            cpu_needs["ta"] = (total_processing / 86400) * batch_factor  # 일일 처리량 → 초당 처리량
        
        # 3. QA CPU 계산 (외부 LLM 95%, 내부 5%)
        total_evaluations = 0
        if "callbot" in service_requirements:
            total_evaluations += service_requirements["callbot"] * 160 * 0.7  # 70% 평가
        if "chatbot" in service_requirements:
            total_evaluations += service_requirements["chatbot"] * 2.4 * 0.5   # 50% 평가
        if "advisor" in service_requirements:
            total_evaluations += service_requirements["advisor"] * 160 * 0.9   # 90% 평가
        
        total_evaluations += service_requirements.get("qa", 0)  # 독립 QA
        
        if total_evaluations > 0:
            # 내부 처리는 5%만
            internal_ratio = self.cpu_specs["qa"]["internal_processing_ratio"]
            cpu_needs["qa"] = (total_evaluations / 86400) * internal_ratio * 0.02  # CPU per evaluation
        
        # 4. 인프라 CPU 계산 (가중치 기반)
        infrastructure_load = {"nginx": 0, "gateway": 0, "db": 0, "auth": 0, "vector_db": 0}
        
        # 서비스별 인프라 영향도 가중치 (실제 수치 반영)
        service_infrastructure_impact = {
            "callbot": {"nginx": 0.1, "gateway": 0.15, "db": 0.2, "auth": 0.05},
            "chatbot": {"nginx": 0.08, "gateway": 0.12, "db": 0.15, "auth": 0.04},
            "advisor": {"nginx": 0.12, "gateway": 0.18, "db": 0.25, "vector_db": 0.2, "auth": 0.08}
        }
        
        for service_name, count in service_requirements.items():
            if service_name in service_infrastructure_impact:
                for infra, weight in service_infrastructure_impact[service_name].items():
                    if infra in infrastructure_load:
                        infrastructure_load[infra] += count * weight
        
        # 인프라별 기본 CPU 할당
        infra_base_cpu = {
            "nginx": 2, "gateway": 4, "db": 8, "auth": 3, "vector_db": 6
        }
        
        total_infra_cpu = 0
        for infra, load in infrastructure_load.items():
            base_cpu = infra_base_cpu.get(infra, 2)
            scaled_cpu = base_cpu + (load * 0.1)  # 부하당 0.1 CPU 추가
            total_infra_cpu += scaled_cpu
        
        cpu_needs["infrastructure"] = total_infra_cpu
        cpu_needs["total"] = sum(cpu_needs.values())
        
        logger.info(
            "CPU 요구사항 계산 완료",
            service_requirements=service_requirements,
            stt_channels=stt_channels,
            total_processing=total_processing,
            total_evaluations=total_evaluations,
            infrastructure_load=infrastructure_load,
            cpu_needs=cpu_needs
        )
        
        return cpu_needs
    
    def calculate_dynamic_gpu_ram(self, 
                                gpu_type: str,
                                workload_requirements: Dict[str, int]) -> float:
        """
        동적 GPU RAM 할당 계산
        워크로드 강도 기반 1.25배~2.5배 할당, 최대 80GB 제한
        """
        if gpu_type not in self.gpu_profiles:
            logger.warning(f"지원하지 않는 GPU 타입: {gpu_type}, T4로 기본 설정")
            gpu_type = "t4"
        
        ram_config = self.gpu_profiles[gpu_type]["ram_allocation"]
        base_ram = ram_config["base_ram"]
        min_multiplier, max_multiplier = ram_config["workload_multiplier_range"]
        max_ram_limit = ram_config["max_ram_limit"]
        
        # 워크로드 강도 계산
        total_channels = self.calculate_total_channels(workload_requirements)
        
        # TTS 강도 (채널 기반)
        tts_intensity = min(1.0, total_channels / 100.0)
        
        # NLP 강도 (총 일일 쿼리 기준)
        total_nlp = 0
        total_nlp += workload_requirements.get("callbot", 0) * 3200  # 실제 가중치
        total_nlp += workload_requirements.get("chatbot", 0) * 288   # 실제 가중치  
        total_nlp += workload_requirements.get("advisor", 0) * 2400  # 실제 가중치
        nlp_intensity = min(1.0, total_nlp / 500000.0)
        
        # AICM 강도 (총 일일 검색 기준)
        total_aicm = 0
        total_aicm += workload_requirements.get("callbot", 0) * 480   # 실제 가중치
        total_aicm += workload_requirements.get("chatbot", 0) * 24    # 실제 가중치
        total_aicm += workload_requirements.get("advisor", 0) * 1360  # 실제 가중치
        aicm_intensity = min(1.0, total_aicm / 300000.0)
        
        # 전체 워크로드 강도 (평균)
        workload_intensity = (tts_intensity + nlp_intensity + aicm_intensity) / 3.0
        
        # 가중치 영향도 50%
        effective_intensity = workload_intensity * 0.5
        
        # RAM 배수 계산
        multiplier = min_multiplier + (max_multiplier - min_multiplier) * effective_intensity
        final_ram = min(base_ram * multiplier, max_ram_limit)
        
        logger.info(
            "동적 GPU RAM 할당 계산",
            gpu_type=gpu_type,
            base_ram=base_ram,
            workload_intensity=round(workload_intensity, 3),
            effective_intensity=round(effective_intensity, 3),
            multiplier=round(multiplier, 2),
            final_ram=round(final_ram, 1),
            total_channels=total_channels,
            total_nlp=total_nlp,
            total_aicm=total_aicm
        )
        
        return final_ram
    
    def calculate_storage_requirements(self, service_requirements: Dict[str, int]) -> Dict[str, float]:
        """
        스토리지 요구사항 계산
        서비스 서버 500GB 고정, 데이터 서버 동적 할당
        """
        storage_needs = {
            "service_servers_gb": 0,
            "database_tb": 0,
            "nas_tb": 0,
            "total_tb": 0
        }
        
        # 서비스 서버들: 500GB 고정
        service_count = len([s for s, c in service_requirements.items() if c > 0])
        storage_needs["service_servers_gb"] = service_count * 500
        
        # 데이터 서버: 사용자 기반 동적 할당 (사용자당 5MB)
        total_users = sum(service_requirements.values())
        storage_needs["database_tb"] = max(1.0, total_users * 0.005)  # 최소 1TB
        storage_needs["nas_tb"] = max(1.0, total_users * 0.005)       # 최소 1TB
        
        storage_needs["total_tb"] = (storage_needs["service_servers_gb"] / 1024) + \
                                  storage_needs["database_tb"] + storage_needs["nas_tb"]
        
        logger.info(
            "스토리지 요구사항 계산 완료",
            service_count=service_count,
            total_users=total_users,
            storage_needs=storage_needs
        )
        
        return storage_needs
    
    def calculate_memory_requirements(self, 
                                    cpu_requirements: Dict[str, float],
                                    gpu_ram: float,
                                    server_type: str = "general") -> Dict[str, float]:
        """
        메모리 요구사항 계산
        데이터 서버 4GB/코어, 일반 서버 2GB/코어
        """
        memory_needs = {
            "system_ram_gb": 0,
            "gpu_ram_gb": gpu_ram,
            "total_ram_gb": 0
        }
        
        # 서버 타입별 RAM 비율
        ram_per_core = 4 if server_type == "data" else 2
        
        # 시스템 RAM 계산
        total_cpu_cores = cpu_requirements.get("total", 0)
        memory_needs["system_ram_gb"] = max(16, total_cpu_cores * ram_per_core)  # 최소 16GB
        
        memory_needs["total_ram_gb"] = memory_needs["system_ram_gb"] + memory_needs["gpu_ram_gb"]
        
        logger.debug(
            "메모리 요구사항 계산",
            server_type=server_type,
            ram_per_core=ram_per_core,
            total_cpu_cores=total_cpu_cores,
            memory_needs=memory_needs
        )
        
        return memory_needs
    
    def calculate_comprehensive_requirements(self, 
                                           service_requirements: Dict[str, int],
                                           gpu_type: str = "auto") -> ResourceRequirements:
        """
        종합 리소스 요구사항 계산
        모든 리소스 타입을 통합하여 계산
        """
        logger.info("종합 리소스 요구사항 계산 시작", service_requirements=service_requirements)
        
        # GPU 요구사항 계산
        gpu_requirements = self.calculate_gpu_requirements(service_requirements, gpu_type)
        
        # CPU 요구사항 계산
        cpu_requirements = self.calculate_cpu_requirements(service_requirements)
        
        # 동적 GPU RAM 할당
        optimal_gpu_type = gpu_requirements.get("recommended_type", "t4")
        gpu_ram = self.calculate_dynamic_gpu_ram(optimal_gpu_type, service_requirements)
        
        # 메모리 요구사항 계산
        memory_requirements = self.calculate_memory_requirements(cpu_requirements, gpu_ram)
        
        # 스토리지 요구사항 계산
        storage_requirements = self.calculate_storage_requirements(service_requirements)
        
        # 종합 결과
        comprehensive_requirements = ResourceRequirements(
            gpu=gpu_requirements,
            cpu=cpu_requirements,
            memory={
                "gpu_ram_gb": str(int(gpu_ram)),
                "system_ram_gb": str(int(memory_requirements["system_ram_gb"])),
                "total_ram_gb": str(int(memory_requirements["total_ram_gb"]))
            },
            storage={
                "service_servers_gb": str(int(storage_requirements["service_servers_gb"])),
                "database_tb": str(round(storage_requirements["database_tb"], 1)),
                "nas_tb": str(round(storage_requirements["nas_tb"], 1)),
                "total_tb": str(round(storage_requirements["total_tb"], 1))
            }
        )
        
        logger.info(
            "종합 리소스 요구사항 계산 완료",
            gpu_type=optimal_gpu_type,
            gpu_total=gpu_requirements["total"],
            cpu_total=cpu_requirements["total"],
            gpu_ram_gb=int(gpu_ram),
            system_ram_gb=int(memory_requirements["system_ram_gb"]),
            storage_total_tb=round(storage_requirements["total_tb"], 1)
        )
        
        return comprehensive_requirements

    # ==========================================
    # 고급 설정 추천값 계산 메서드들
    # ==========================================
    
    def get_recommended_environment_variables(self, 
                                            preset: PresetType,
                                            service_requirements: Dict[str, int]) -> List[EnvironmentVariable]:
        """
        프리셋별 추천 환경변수 설정
        """
        base_vars = [
            EnvironmentVariable(
                name="LOG_LEVEL",
                value="INFO",
                description="로그 레벨 (DEBUG, INFO, WARN, ERROR)"
            ),
            EnvironmentVariable(
                name="ENVIRONMENT",
                value="production" if preset in [PresetType.MEDIUM, PresetType.LARGE] else "development",
                description="운영 환경 (development, staging, production)"
            ),
            EnvironmentVariable(
                name="TIMEZONE",
                value="Asia/Seoul",
                description="서버 시간대"
            )
        ]
        
        # 서비스별 환경변수
        if service_requirements.get("callbot", 0) > 0:
            base_vars.extend([
                EnvironmentVariable(
                    name="CALLBOT_API_KEY",
                    value="",
                    description="콜봇 API 키 (실제 값으로 설정 필요)"
                ),
                EnvironmentVariable(
                    name="CALLBOT_WEBHOOK_URL",
                    value="",
                    description="콜봇 웹훅 URL"
                )
            ])
        
        if service_requirements.get("chatbot", 0) > 0:
            base_vars.extend([
                EnvironmentVariable(
                    name="CHATBOT_SESSION_TIMEOUT",
                    value="3600",
                    description="챗봇 세션 타임아웃 (초)"
                )
            ])
        
        if service_requirements.get("advisor", 0) > 0:
            base_vars.extend([
                EnvironmentVariable(
                    name="ADVISOR_DB_CONNECTION",
                    value="",
                    description="어드바이저 데이터베이스 연결 문자열"
                )
            ])
        
        # 프리셋별 추가 환경변수
        if preset == PresetType.LARGE:
            base_vars.extend([
                EnvironmentVariable(
                    name="MONITORING_ENABLED",
                    value="true",
                    description="모니터링 활성화"
                ),
                EnvironmentVariable(
                    name="AUTO_SCALING_ENABLED",
                    value="true",
                    description="자동 스케일링 활성화"
                )
            ])
        
        logger.info(
            "추천 환경변수 생성",
            preset=preset,
            count=len(base_vars)
        )
        
        return base_vars
    
    def get_recommended_volume_mounts(self, 
                                    preset: PresetType,
                                    service_requirements: Dict[str, int]) -> List[VolumeMount]:
        """
        프리셋별 추천 볼륨 마운트 설정
        """
        volume_mounts = [
            VolumeMount(
                name="config-volume",
                type="configmap",
                mount_path="/app/config",
                read_only=True,
                description="애플리케이션 설정 파일"
            ),
            VolumeMount(
                name="logs-volume",
                type="emptydir",
                mount_path="/app/logs",
                read_only=False,
                description="애플리케이션 로그 저장소"
            )
        ]
        
        # 데이터베이스 서비스가 있는 경우
        if any(service_requirements.get(key, 0) > 0 for key in ["callbot", "chatbot", "advisor"]):
            volume_mounts.append(
                VolumeMount(
                    name="data-volume",
                    type="persistentvolume",
                    mount_path="/app/data",
                    read_only=False,
                    storage_class="fast-ssd" if preset in [PresetType.MEDIUM, PresetType.LARGE] else "standard",
                    size="100Gi" if preset == PresetType.LARGE else "50Gi",
                    description="데이터 저장소"
                )
            )
        
        # 대용량 프리셋의 경우 추가 볼륨
        if preset == PresetType.LARGE:
            volume_mounts.extend([
                VolumeMount(
                    name="cache-volume",
                    type="emptydir",
                    mount_path="/app/cache",
                    read_only=False,
                    description="캐시 데이터 저장소"
                ),
                VolumeMount(
                    name="backup-volume",
                    type="persistentvolume",
                    mount_path="/app/backup",
                    read_only=False,
                    storage_class="backup-storage",
                    size="500Gi",
                    description="백업 데이터 저장소"
                )
            ])
        
        logger.info(
            "추천 볼륨 마운트 생성",
            preset=preset,
            count=len(volume_mounts)
        )
        
        return volume_mounts
    
    def get_recommended_health_checks(self, 
                                    preset: PresetType,
                                    service_requirements: Dict[str, int]) -> Dict[str, HealthCheckConfig]:
        """
        프리셋별 추천 헬스체크 설정
        """
        health_checks = {}
        
        # 기본 HTTP 헬스체크
        base_health_check = HealthCheckConfig(
            type="http",
            path="/health",
            port=8080,
            initial_delay_seconds=30,
            period_seconds=10,
            timeout_seconds=5,
            failure_threshold=3,
            success_threshold=1
        )
        
        # 서비스별 헬스체크
        if service_requirements.get("callbot", 0) > 0:
            health_checks["callbot"] = base_health_check.copy()
            health_checks["callbot"].path = "/callbot/health"
        
        if service_requirements.get("chatbot", 0) > 0:
            health_checks["chatbot"] = base_health_check.copy()
            health_checks["chatbot"].path = "/chatbot/health"
        
        if service_requirements.get("advisor", 0) > 0:
            health_checks["advisor"] = base_health_check.copy()
            health_checks["advisor"].path = "/advisor/health"
        
        # 프리셋별 헬스체크 조정
        if preset == PresetType.MICRO:
            # 마이크로 프리셋은 간단한 헬스체크
            for service in health_checks.values():
                service.period_seconds = 30
                service.failure_threshold = 2
        
        elif preset == PresetType.LARGE:
            # 대용량 프리셋은 세밀한 헬스체크
            for service in health_checks.values():
                service.period_seconds = 5
                service.failure_threshold = 5
                service.timeout_seconds = 3
        
        logger.info(
            "추천 헬스체크 설정 생성",
            preset=preset,
            services=list(health_checks.keys())
        )
        
        return health_checks
    
    def get_recommended_network_config(self, 
                                     preset: PresetType,
                                     service_requirements: Dict[str, int]) -> NetworkConfig:
        """
        프리셋별 추천 네트워크 설정
        """
        # 기본 네트워크 설정
        network_config = NetworkConfig(
            service_type="ClusterIP",
            network_policy_enabled=True
        )
        
        # 프리셋별 네트워크 설정 조정
        if preset == PresetType.MEDIUM:
            network_config.ingress_enabled = True
            network_config.ingress_host = f"ecp-ai-{preset}.example.com"
            network_config.ingress_tls = True
        
        elif preset == PresetType.LARGE:
            network_config.service_type = "LoadBalancer"
            network_config.ingress_enabled = True
            network_config.ingress_host = f"ecp-ai-{preset}.example.com"
            network_config.ingress_tls = True
            network_config.external_port = 443
        
        # 특정 서비스가 있는 경우 추가 설정
        if service_requirements.get("callbot", 0) > 100:
            # 대용량 콜봇의 경우 외부 포트 노출
            network_config.external_port = 8080
        
        logger.info(
            "추천 네트워크 설정 생성",
            preset=preset,
            service_type=network_config.service_type,
            ingress_enabled=network_config.ingress_enabled
        )
        
        return network_config
    
    def get_comprehensive_recommendations(self, 
                                        preset: PresetType,
                                        service_requirements: Dict[str, int]) -> Dict[str, Any]:
        """
        종합 추천 설정값 생성
        모든 고급 설정의 추천값을 통합하여 제공
        """
        logger.info("종합 추천 설정값 생성 시작", preset=preset)
        
        recommendations = {
            "environment_variables": self.get_recommended_environment_variables(preset, service_requirements),
            "volume_mounts": self.get_recommended_volume_mounts(preset, service_requirements),
            "health_checks": self.get_recommended_health_checks(preset, service_requirements),
            "network_config": self.get_recommended_network_config(preset, service_requirements)
        }
        
        logger.info(
            "종합 추천 설정값 생성 완료",
            preset=preset,
            env_vars_count=len(recommendations["environment_variables"]),
            volumes_count=len(recommendations["volume_mounts"]),
            health_checks_count=len(recommendations["health_checks"])
        )
        
        return recommendations
