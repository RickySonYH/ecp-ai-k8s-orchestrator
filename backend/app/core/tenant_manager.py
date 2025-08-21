# [advice from AI] ECP-AI 테넌시 관리자 - 실제 가중치 기반 프리셋 감지 및 리소스 자동 계산
"""
ECP-AI 테넌시 관리 시스템
- 실제 가중치 기반 프리셋 자동 감지 (micro/small/medium/large)
- GPU 타입 자동 선택 로직 (T4/V100/L40S)
- 서비스별 실제 처리량 반영 (콜봇/챗봇/어드바이저)
- 인프라 영향도 가중치 계산
- Kubernetes 네이티브 통합
- 고급 설정 추천값 자동 생성
"""

import json
import asyncio
from typing import Dict, Any, Optional, List
from pathlib import Path
from pydantic import BaseModel, Field
import structlog

# 새로운 모델 import
from app.models.tenant_specs import (
    TenantSpecs, PresetType, GPUType, EnvironmentVariable,
    VolumeMount, HealthCheckConfig, NetworkConfig
)

# ResourceCalculator와 K8sOrchestrator는 향후 구현
# from .resource_calculator import ResourceCalculator
# from .k8s_orchestrator import K8sOrchestrator

logger = structlog.get_logger(__name__)


class TenantManager:
    """
    ECP-AI 테넌시 자동 관리 시스템
    실제 가중치 기반 프리셋 감지 및 GPU 타입 자동 선택
    """
    
    def __init__(self, config_path: str = "/app/config/ecp_service_matrix.json"):
        self.config_path = Path(config_path)
        self.service_matrix = self._load_service_matrix()
        # self.resource_calculator = ResourceCalculator(self.service_matrix)
        # self.k8s_orchestrator = K8sOrchestrator()
        
        logger.info(
            "TenantManager 초기화 완료",
            config_path=str(self.config_path),
            presets=list(self.service_matrix["tenant_presets"].keys())
        )
    
    def _load_service_matrix(self) -> Dict[str, Any]:
        """ECP 서비스 매트릭스 로드"""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data["ecp_service_matrix"]
        except FileNotFoundError:
            logger.error("서비스 매트릭스 파일을 찾을 수 없음", path=str(self.config_path))
            raise
        except json.JSONDecodeError as e:
            logger.error("서비스 매트릭스 JSON 파싱 오류", error=str(e))
            raise
    
    def detect_tenant_preset(self, service_requirements: Dict[str, int]) -> str:
        """
        서비스 요구사항을 기반으로 테넌시 프리셋 자동 감지
        실제 가중치 기반 계산
        
        프리셋 기준:
        - Micro: 총 채널 < 10, 사용자 < 50
        - Small: 총 채널 < 100, 사용자 < 500  
        - Medium: 총 채널 < 500, 사용자 < 2000
        - Large: 총 채널 ≥ 500, 사용자 ≥ 2000
        """
        # 총 채널 수 계산 (실제 가중치 반영)
        total_channels = self._calculate_total_channels(service_requirements)
        
        # 사용자 수 기반 계산 (챗봇)
        total_users = service_requirements.get("chatbot", 0)
        
        logger.debug(
            "프리셋 감지 계산",
            total_channels=total_channels,
            total_users=total_users,
            service_requirements=service_requirements
        )
        
        # 실제 기준 적용
        if total_channels < 10 and total_users < 50:
            preset = "micro"
        elif total_channels < 100 and total_users < 500:
            preset = "small"
        elif total_channels < 500 and total_users < 2000:
            preset = "medium"
        else:
            preset = "large"
        
        logger.info(
            "프리셋 자동 감지 완료",
            preset=preset,
            total_channels=total_channels,
            total_users=total_users
        )
        
        return preset
    
    def _calculate_total_channels(self, service_requirements: Dict[str, int]) -> int:
        """총 채널 수 계산"""
        total_channels = 0
        total_channels += service_requirements.get("callbot", 0)
        total_channels += service_requirements.get("advisor", 0)
        total_channels += service_requirements.get("stt", 0)
        total_channels += service_requirements.get("tts", 0)
        return total_channels
    
    def _select_optimal_gpu_type(self, total_channels: int, gpu_count: int) -> str:
        """
        최적 GPU 타입 자동 선택
        
        선택 로직:
        - 소규모(≤100채널): T4 강제 (비용 효율)
        - GPU 2개 이하: T4 선택
        - GPU 3-8개: V100 선택  
        - GPU 9개 이상: L40S 선택
        """
        # 소규모는 T4 강제
        if total_channels <= 100:
            gpu_type = "t4"
            reason = "소규모 환경 (비용 효율)"
        # GPU 개수 기반 선택
        elif gpu_count <= 2:
            gpu_type = "t4"
            reason = "GPU 2개 이하"
        elif gpu_count <= 8:
            gpu_type = "v100"
            reason = "GPU 3-8개 (균형)"
        else:
            gpu_type = "l40s"
            reason = "GPU 9개 이상 (고성능)"
        
        logger.info(
            "GPU 타입 자동 선택",
            gpu_type=gpu_type,
            total_channels=total_channels,
            gpu_count=gpu_count,
            reason=reason
        )
        
        return gpu_type
    
    def _calculate_gpu_requirements(self, service_requirements: Dict[str, int]) -> Dict[str, Any]:
        """
        GPU 요구사항 계산 (실제 가중치 반영)
        서비스별 실제 처리량 기준
        """
        total_channels = self._calculate_total_channels(service_requirements)
        
        # GPU 배수 계산 (채널 수 기반)
        if total_channels <= 100:
            nlp_multiplier = 1.0
            aicm_multiplier = 1.0
        elif total_channels <= 500:
            nlp_multiplier = 1.5
            aicm_multiplier = 1.5
        else:
            nlp_multiplier = 2.5
            aicm_multiplier = 2.5
        
        gpu_needs = {
            "tts": 0,
            "nlp": 0,
            "aicm": 0,
            "total": 0
        }
        
        # 1. TTS GPU 계산 (캐시 최적화 적용)
        tts_channels = service_requirements.get("callbot", 0) + service_requirements.get("tts", 0)
        if tts_channels > 0:
            # T4 기준: 캐시 최적화로 50채널/GPU
            gpu_needs["tts"] = max(1, (tts_channels + 49) // 50)
        
        # 2. NLP GPU 계산 (일일 쿼리 기반)
        total_nlp_queries_daily = 0
        if "callbot" in service_requirements:
            total_nlp_queries_daily += service_requirements["callbot"] * 3200  # 실제 가중치
        if "chatbot" in service_requirements:
            total_nlp_queries_daily += service_requirements["chatbot"] * 288   # 실제 가중치
        if "advisor" in service_requirements:
            total_nlp_queries_daily += service_requirements["advisor"] * 2400  # 실제 가중치
        
        if total_nlp_queries_daily > 0:
            # 9시간 근무 기준 초당 쿼리 계산 후 배수 적용
            working_hours = 9
            nlp_qps_needed = (total_nlp_queries_daily / (working_hours * 3600)) * nlp_multiplier
            # T4 기준: 150 QPS/GPU
            gpu_needs["nlp"] = max(1, int((nlp_qps_needed + 149) // 150))
        
        # 3. AICM GPU 계산 (일일 검색 기반)
        total_aicm_queries_daily = 0
        if "callbot" in service_requirements:
            total_aicm_queries_daily += service_requirements["callbot"] * 480    # 실제 가중치
        if "chatbot" in service_requirements:
            total_aicm_queries_daily += service_requirements["chatbot"] * 24     # 실제 가중치
        if "advisor" in service_requirements:
            total_aicm_queries_daily += service_requirements["advisor"] * 1360   # 실제 가중치
        
        if total_aicm_queries_daily > 0:
            aicm_qps_needed = (total_aicm_queries_daily / (9 * 3600)) * aicm_multiplier
            # T4 기준: 100 searches/sec/GPU
            gpu_needs["aicm"] = max(1, int((aicm_qps_needed + 99) // 100))
        
        gpu_needs["total"] = gpu_needs["tts"] + gpu_needs["nlp"] + gpu_needs["aicm"]
        
        # 최적 GPU 타입 선택
        optimal_gpu_type = self._select_optimal_gpu_type(total_channels, gpu_needs["total"])
        
        # 선택된 GPU 타입으로 재계산 (성능 차이 반영)
        gpu_profiles = self.service_matrix["gpu_profiles"]
        if optimal_gpu_type in gpu_profiles:
            performance_ratio = gpu_profiles[optimal_gpu_type]["performance_score"]
            # 성능이 좋을수록 필요 GPU 수 감소
            if performance_ratio > 1.0:
                gpu_needs["tts"] = max(1, int(gpu_needs["tts"] / performance_ratio))
                gpu_needs["nlp"] = max(1, int(gpu_needs["nlp"] / performance_ratio))
                gpu_needs["aicm"] = max(1, int(gpu_needs["aicm"] / performance_ratio))
                gpu_needs["total"] = gpu_needs["tts"] + gpu_needs["nlp"] + gpu_needs["aicm"]
        
        gpu_needs["recommended_type"] = optimal_gpu_type
        
        logger.info(
            "GPU 요구사항 계산 완료",
            gpu_needs=gpu_needs,
            total_channels=total_channels,
            nlp_queries_daily=total_nlp_queries_daily,
            aicm_queries_daily=total_aicm_queries_daily
        )
        
        return gpu_needs
    
    def _calculate_cpu_requirements(self, service_requirements: Dict[str, int]) -> Dict[str, int]:
        """CPU 요구사항 계산 (실제 가중치 반영)"""
        cpu_needs = {
            "stt": 0,
            "ta": 0,
            "qa": 0,
            "infrastructure": 0,
            "total": 0
        }
        
        # 1. STT CPU 계산 (실제 채널/코어 비율)
        stt_channels = 0
        stt_channels += service_requirements.get("callbot", 0)  # 1:1
        stt_channels += service_requirements.get("advisor", 0) * 2  # 1:2 (상담사+고객)
        stt_channels += service_requirements.get("stt", 0)  # 독립 STT
        
        if stt_channels > 0:
            # 실제 가중치: 6.5 채널/코어
            cpu_needs["stt"] = max(4, int((stt_channels + 5.5) // 6.5))
        
        # 2. TA CPU 계산 (배치 처리)
        total_processing = 0
        for service, count in service_requirements.items():
            if service == "callbot":
                total_processing += count * 160  # 일일 콜 수
            elif service == "chatbot":
                total_processing += count * 2.4  # 일일 세션 수
            elif service == "advisor":
                total_processing += count * 160  # 일일 상담 수
        
        total_processing += service_requirements.get("ta", 0)  # 독립 TA
        
        if total_processing > 0:
            # 배치 처리 효율 반영 (30% 효율)
            cpu_needs["ta"] = max(2, int(total_processing * 0.3 / 86400 * 2))  # 일일 → 초당 처리량
        
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
            # 내부 처리는 5%만, CPU per evaluation
            cpu_needs["qa"] = max(1, int(total_evaluations * 0.05 * 0.02))
        
        # 4. 인프라 CPU 계산 (가중치 기반)
        infrastructure_load = {"nginx": 0, "gateway": 0, "db": 0, "auth": 0, "vector_db": 0}
        
        # 서비스별 인프라 영향도 가중치 적용
        service_impact = {
            "callbot": {"nginx": 0.1, "gateway": 0.15, "db": 0.2, "auth": 0.05},
            "chatbot": {"nginx": 0.08, "gateway": 0.12, "db": 0.15, "auth": 0.04},
            "advisor": {"nginx": 0.12, "gateway": 0.18, "db": 0.25, "vector_db": 0.2, "auth": 0.08}
        }
        
        for service_name, count in service_requirements.items():
            if service_name in service_impact:
                for infra, weight in service_impact[service_name].items():
                    if infra in infrastructure_load:
                        infrastructure_load[infra] += count * weight
        
        # 인프라별 기본 CPU 할당 + 부하 기반 추가 할당
        infra_base_cpu = {
            "nginx": 2, "gateway": 4, "db": 8, "auth": 3, "vector_db": 6
        }
        
        total_infra_cpu = 0
        for infra, load in infrastructure_load.items():
            base_cpu = infra_base_cpu.get(infra, 2)
            scaled_cpu = base_cpu + int(load * 0.1)  # 부하당 0.1 CPU 추가
            total_infra_cpu += scaled_cpu
        
        cpu_needs["infrastructure"] = max(12, total_infra_cpu)  # 최소 12코어
        cpu_needs["total"] = sum(cpu_needs.values())
        
        logger.info(
            "CPU 요구사항 계산 완료",
            cpu_needs=cpu_needs,
            stt_channels=stt_channels,
            total_processing=total_processing,
            infrastructure_load=infrastructure_load
        )
        
        return cpu_needs
    
    def _calculate_dynamic_gpu_ram(self, 
                                 gpu_type: str,
                                 workload_requirements: Dict[str, int]) -> float:
        """
        동적 GPU RAM 할당 계산
        워크로드 강도 기반 RAM 할당
        """
        if gpu_type not in self.service_matrix["gpu_profiles"]:
            gpu_type = "t4"  # 기본값
        
        ram_config = self.service_matrix["gpu_profiles"][gpu_type]["ram_allocation"]
        base_ram = ram_config["base_ram"]
        min_multiplier, max_multiplier = ram_config["workload_multiplier_range"]
        max_ram_limit = ram_config["max_ram_limit"]
        
        # 워크로드 강도 계산
        total_channels = self._calculate_total_channels(workload_requirements)
        
        # TTS 강도
        tts_intensity = min(1.0, total_channels / 100.0)
        
        # NLP 강도 (총 일일 쿼리 기준)
        total_nlp = 0
        total_nlp += workload_requirements.get("callbot", 0) * 3200
        total_nlp += workload_requirements.get("chatbot", 0) * 288  
        total_nlp += workload_requirements.get("advisor", 0) * 2400
        nlp_intensity = min(1.0, total_nlp / 500000.0)
        
        # AICM 강도
        total_aicm = 0
        total_aicm += workload_requirements.get("callbot", 0) * 480
        total_aicm += workload_requirements.get("chatbot", 0) * 24
        total_aicm += workload_requirements.get("advisor", 0) * 1360
        aicm_intensity = min(1.0, total_aicm / 300000.0)
        
        # 전체 워크로드 강도 (평균)
        workload_intensity = (tts_intensity + nlp_intensity + aicm_intensity) / 3.0
        
        # 가중치 영향도 50%
        effective_intensity = workload_intensity * 0.5
        
        # RAM 배수 계산
        multiplier = min_multiplier + (max_multiplier - min_multiplier) * effective_intensity
        final_ram = min(base_ram * multiplier, max_ram_limit)
        
        logger.debug(
            "동적 GPU RAM 할당 계산",
            gpu_type=gpu_type,
            workload_intensity=workload_intensity,
            final_ram=final_ram
        )
        
        return final_ram
    
    def _calculate_dynamic_ram(self, service_requirements: Dict[str, int], preset: str) -> int:
        """
        동적 RAM 할당 계산
        워크로드 강도 기반 1.25배~2.5배 할당
        """
        total_users = sum(service_requirements.values())
        
        # 기본 RAM (사용자당 2GB)
        base_ram = max(4, total_users * 2)
        
        # 워크로드 강도에 따른 배수 계산
        if total_users <= 100:
            multiplier = 1.25  # 소규모: 1.25배
        elif total_users <= 500:
            multiplier = 1.5   # 중간 규모: 1.5배
        elif total_users <= 2000:
            multiplier = 2.0   # 대규모: 2.0배
        else:
            multiplier = 2.5   # 초대규모: 2.5배
        
        # 프리셋별 추가 보정
        preset_multipliers = {
            "micro": 1.0,      # 마이크로: 기본값
            "small": 1.1,      # 스몰: 10% 증가
            "medium": 1.2,     # 미디엄: 20% 증가
            "large": 1.3       # 라지: 30% 증가
        }
        
        preset_multiplier = preset_multipliers.get(preset, 1.0)
        
        # 최종 RAM 계산
        final_ram = int(base_ram * multiplier * preset_multiplier)
        
        # 최소/최대 제한
        final_ram = max(4, min(80, final_ram))  # 4GB ~ 80GB
        
        logger.info(
            "동적 RAM 할당 계산",
            total_users=total_users,
            base_ram=base_ram,
            workload_multiplier=multiplier,
            preset_multiplier=preset_multiplier,
            final_ram=final_ram
        )
        
        return final_ram
    
    def generate_tenant_specs(self, 
                             tenant_id: str,
                             service_requirements: Dict[str, int],
                             gpu_type: str = "auto") -> TenantSpecs:
        """
        테넌시 사양 자동 생성
        실제 가중치 반영 및 GPU 타입 자동 선택
        """
        logger.info(
            "테넌시 사양 생성 시작",
            tenant_id=tenant_id,
            service_requirements=service_requirements,
            gpu_type=gpu_type
        )
        
        # 프리셋 자동 감지
        preset = self.detect_tenant_preset(service_requirements)
        preset_config = self.service_matrix["tenant_presets"][preset]
        
        # GPU 요구사항 계산 (자동 타입 선택 포함)
        gpu_requirements = self._calculate_gpu_requirements(service_requirements)
        
        # CPU 요구사항 계산
        cpu_requirements = self._calculate_cpu_requirements(service_requirements)
        
        # 최적 GPU 타입 결정
        if gpu_type == "auto":
            optimal_gpu_type = gpu_requirements.get("recommended_type", "t4")
        else:
            optimal_gpu_type = gpu_type
        
        # 동적 GPU RAM 할당
        gpu_ram = self._calculate_dynamic_gpu_ram(optimal_gpu_type, service_requirements)
        
        # 서비스별 상세 설정 생성
        services_config = {}
        for service_name, count in service_requirements.items():
            if count > 0 and service_name in self.service_matrix["services"]:
                service_spec = self.service_matrix["services"][service_name]
                
                service_config = {
                    "enabled": True,
                    "count": count,
                    "resource_requirements": service_spec["resource_requirements"],
                    "container_specs": service_spec["container_specs"],
                    "scaling": preset_config["scaling"]
                }
                
                # GPU 서비스별 특별 설정
                if service_name in ["tts", "nlp", "aicm"]:
                    service_config["gpu_allocation"] = {
                        "type": optimal_gpu_type,
                        "count": gpu_requirements.get(service_name, 1),
                        "ram_gb": gpu_ram
                    }
                
                services_config[service_name] = service_config
        
        # 스토리지 요구사항 계산
        total_users = sum(service_requirements.values())
        storage_tb = max(1.0, total_users * 0.01)  # 사용자당 10GB
        
        # 총 채널 수와 사용자 수 계산
        total_channels = self._calculate_total_channels(service_requirements)
        total_users = sum(service_requirements.values())
        
        # 메모리 요구사항 계산 (동적 RAM 할당)
        memory_gb = self._calculate_dynamic_ram(service_requirements, preset)
        
        # 스토리지 요구사항 계산 (GB 단위)
        storage_gb = max(100, int(total_users * 10))  # 사용자당 10GB, 최소 100GB
        
        # GPUType과 PresetType enum으로 변환
        from app.models.tenant_specs import GPUType, PresetType
        gpu_type_enum = GPUType(optimal_gpu_type)
        preset_enum = PresetType(preset)
        
        tenant_specs = TenantSpecs(
            tenant_id=tenant_id,
            preset=preset_enum,
            gpu_type=gpu_type_enum,
            total_channels=total_channels,
            total_users=total_users,
            gpu_count=gpu_requirements["total"],
            cpu_cores=cpu_requirements["total"],
            memory_gb=memory_gb,
            storage_gb=storage_gb
        )
        
        logger.info(
            "테넌시 사양 생성 완료",
            tenant_id=tenant_id,
            preset=preset,
            gpu_type=optimal_gpu_type,
            gpu_count=gpu_requirements["total"],
            cpu_cores=cpu_requirements["total"]
        )
        
        return tenant_specs
    
    async def create_tenant(self, tenant_specs: TenantSpecs) -> bool:
        """
        테넌시 생성 (쿠버네티스 리소스 생성)
        실제 구현에서는 K8sOrchestrator 사용
        """
        try:
            logger.info("테넌시 생성 시작", tenant_id=tenant_specs.tenant_id)
            
            # 1. 네임스페이스 생성
            await self._create_namespace(tenant_specs)
            
            # 2. ConfigMap 생성
            await self._create_configmaps(tenant_specs)
            
            # 3. 서비스별 배포
            for service_name, service_config in tenant_specs.services.items():
                if service_config["enabled"]:
                    await self._deploy_service(tenant_specs.tenant_id, service_name, service_config)
            
            # 4. 모니터링 설정
            await self._setup_monitoring(tenant_specs)
            
            logger.info("테넌시 생성 완료", tenant_id=tenant_specs.tenant_id)
            return True
            
        except Exception as e:
            logger.error("테넌시 생성 실패", tenant_id=tenant_specs.tenant_id, error=str(e))
            return False
    
    async def _create_namespace(self, tenant_specs: TenantSpecs) -> None:
        """네임스페이스 생성 (실제 구현 시 K8sOrchestrator 사용)"""
        namespace_name = f"{tenant_specs.tenant_id}-ecp-ai"
        logger.debug("네임스페이스 생성", namespace=namespace_name)
        # await self.k8s_orchestrator.create_namespace(tenant_specs.tenant_id, tenant_specs.preset)
        await asyncio.sleep(0.1)  # 임시 지연
    
    async def _create_configmaps(self, tenant_specs: TenantSpecs) -> None:
        """ConfigMap 생성"""
        logger.debug("ConfigMap 생성", tenant_id=tenant_specs.tenant_id)
        await asyncio.sleep(0.1)  # 임시 지연
    
    async def _deploy_service(self, tenant_id: str, service_name: str, service_config: Dict[str, Any]) -> None:
        """서비스 배포"""
        logger.debug("서비스 배포", tenant_id=tenant_id, service_name=service_name)
        # await self.k8s_orchestrator.deploy_service(tenant_id, service_name, service_config)
        await asyncio.sleep(0.1)  # 임시 지연
    
    async def _setup_monitoring(self, tenant_specs: TenantSpecs) -> None:
        """모니터링 설정"""
        logger.debug("모니터링 설정", tenant_id=tenant_specs.tenant_id)
        await asyncio.sleep(0.1)  # 임시 지연

    # ==========================================
    # 고급 설정 추천값 생성 메서드
    # ==========================================
    
    def get_advanced_configuration_recommendations(self, 
                                                preset: str,
                                                service_requirements: Dict[str, int]) -> Dict[str, Any]:
        """
        프리셋별 고급 설정 추천값 생성
        환경변수, 볼륨, 헬스체크, 네트워크 설정의 추천값 제공
        """
        try:
            # 프리셋 타입 변환
            preset_type = PresetType(preset.lower())
            
            # 기본 추천값 생성
            recommendations = {
                "environment_variables": self._get_recommended_env_vars(preset_type, service_requirements),
                "volume_mounts": self._get_recommended_volumes(preset_type, service_requirements),
                "health_checks": self._get_recommended_health_checks(preset_type, service_requirements),
                "network_config": self._get_recommended_network(preset_type, service_requirements),
                "metadata": {
                    "preset": preset,
                    "description": f"{preset.upper()} 프리셋 권장 설정",
                    "generated_at": asyncio.get_event_loop().time()
                }
            }
            
            logger.info(
                "고급 설정 추천값 생성 완료",
                preset=preset,
                env_vars_count=len(recommendations["environment_variables"]),
                volumes_count=len(recommendations["volume_mounts"]),
                health_checks_count=len(recommendations["health_checks"])
            )
            
            return recommendations
            
        except Exception as e:
            logger.error("고급 설정 추천값 생성 실패", preset=preset, error=str(e))
            return self._get_fallback_recommendations(preset, service_requirements)
    
    def _get_recommended_env_vars(self, 
                                 preset: PresetType,
                                 service_requirements: Dict[str, int]) -> List[EnvironmentVariable]:
        """환경변수 추천값 생성"""
        env_vars = [
            EnvironmentVariable(
                name="LOG_LEVEL",
                value="INFO" if preset in [PresetType.MICRO, PresetType.SMALL] else "DEBUG",
                description="로그 레벨 설정"
            ),
            EnvironmentVariable(
                name="ENVIRONMENT",
                value="production" if preset in [PresetType.MEDIUM, PresetType.LARGE] else "development",
                description="운영 환경 설정"
            ),
            EnvironmentVariable(
                name="TIMEZONE",
                value="Asia/Seoul",
                description="서버 시간대"
            )
        ]
        
        # 서비스별 환경변수 추가
        if service_requirements.get("callbot", 0) > 0:
            env_vars.append(EnvironmentVariable(
                name="CALLBOT_API_KEY",
                value="",
                description="콜봇 API 키 (실제 값으로 설정 필요)"
            ))
        
        if service_requirements.get("chatbot", 0) > 0:
            env_vars.append(EnvironmentVariable(
                name="CHATBOT_SESSION_TIMEOUT",
                value="3600",
                description="챗봇 세션 타임아웃 (초)"
            ))
        
        if service_requirements.get("advisor", 0) > 0:
            env_vars.append(EnvironmentVariable(
                name="ADVISOR_DB_CONNECTION",
                value="",
                description="어드바이저 데이터베이스 연결 문자열"
            ))
        
        return env_vars
    
    def _get_recommended_volumes(self, 
                                preset: PresetType,
                                service_requirements: Dict[str, int]) -> List[VolumeMount]:
        """볼륨 마운트 추천값 생성"""
        volumes = [
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
        
        # 데이터 서비스가 있는 경우 영구 볼륨 추가
        if any(service_requirements.get(key, 0) > 0 for key in ["callbot", "chatbot", "advisor"]):
            volumes.append(VolumeMount(
                name="data-volume",
                type="persistentvolume",
                mount_path="/app/data",
                read_only=False,
                storage_class="fast-ssd" if preset in [PresetType.MEDIUM, PresetType.LARGE] else "standard",
                size="100Gi" if preset == PresetType.LARGE else "50Gi",
                description="데이터 저장소"
            ))
        
        return volumes
    
    def _get_recommended_health_checks(self, 
                                      preset: PresetType,
                                      service_requirements: Dict[str, int]) -> Dict[str, HealthCheckConfig]:
        """헬스체크 추천값 생성"""
        health_checks = {}
        
        # 기본 헬스체크 설정
        base_config = HealthCheckConfig(
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
        for service_name in ["callbot", "chatbot", "advisor"]:
            if service_requirements.get(service_name, 0) > 0:
                health_checks[service_name] = HealthCheckConfig(
                    type="http",
                    path=f"/{service_name}/health",
                    port=8080,
                    initial_delay_seconds=30,
                    period_seconds=10,
                    timeout_seconds=5,
                    failure_threshold=3,
                    success_threshold=1
                )
        
        # 프리셋별 조정
        if preset == PresetType.MICRO:
            for config in health_checks.values():
                config.period_seconds = 30
                config.failure_threshold = 2
        
        elif preset == PresetType.LARGE:
            for config in health_checks.values():
                config.period_seconds = 5
                config.failure_threshold = 5
                config.timeout_seconds = 3
        
        return health_checks
    
    def _get_recommended_network(self, 
                                preset: PresetType,
                                service_requirements: Dict[str, int]) -> NetworkConfig:
        """네트워크 설정 추천값 생성"""
        network_config = NetworkConfig(
            service_type="ClusterIP",
            network_policy_enabled=True
        )
        
        # 프리셋별 네트워크 설정
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
        
        return network_config
    
    def _get_fallback_recommendations(self, 
                                    preset: str,
                                    service_requirements: Dict[str, int]) -> Dict[str, Any]:
        """오류 시 기본 추천값 제공"""
        logger.warning("기본 추천값 사용", preset=preset)
        
        return {
            "environment_variables": [
                EnvironmentVariable(
                    name="LOG_LEVEL",
                    value="INFO",
                    description="기본 로그 레벨"
                )
            ],
            "volume_mounts": [
                VolumeMount(
                    name="config-volume",
                    type="configmap",
                    mount_path="/app/config",
                    read_only=True,
                    description="기본 설정 볼륨"
                )
            ],
            "health_checks": {},
            "network_config": NetworkConfig(),
            "metadata": {
                "preset": preset,
                "description": "기본 설정 (오류 발생)",
                "generated_at": asyncio.get_event_loop().time()
            }
        }
