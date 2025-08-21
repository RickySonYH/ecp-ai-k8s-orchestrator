import json
import math
import logging
from typing import Dict, Any, List, Tuple
from dataclasses import dataclass, asdict
from pathlib import Path

# 로깅 설정
logger = logging.getLogger(__name__)

@dataclass
class ResourceCalculation:
    """리소스 계산 결과"""
    gpu: Dict[str, float]
    cpu: Dict[str, float] 
    network: Dict[str, float]
    storage: Dict[str, float]
    infrastructure: Dict[str, float]
    # 추가 속성들
    stt_channels: float = 0
    tts_channels: float = 0
    ta_channels: float = 0
    qa_channels: float = 0
    stt_breakdown: Dict[str, int] = None
    nlp_breakdown: Dict[str, int] = None
    aicm_breakdown: Dict[str, int] = None
    infra_breakdown: Dict = None

@dataclass
class HardwareSpecification:
    """하드웨어 사양"""
    gpu_servers: List[Dict]
    cpu_servers: List[Dict]
    storage_servers: List[Dict]
    infrastructure_servers: List[Dict]
    network_requirements: str
    infrastructure_notes: str

class ECPHardwareCalculator:
    """ECP-AI 통합 하드웨어 계산기"""
    
    def __init__(self, config_path: str = "config"):
        self.config_path = Path(config_path)
        self.service_specs = self._load_json("service_specs.json")
        self.gpu_capacity = self._load_json("gpu_capacity.json") 
        self.correlation_matrix = self._load_json("correlation_matrix.json")
        self.infrastructure = self._load_json("infrastructure.json")
        
    def _load_json(self, filename: str) -> Dict[str, Any]:
        """JSON 설정 파일 로드"""
        try:
            with open(self.config_path / filename, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            raise FileNotFoundError(f"{filename} 파일을 찾을 수 없습니다.")
    
    def calculate_hardware_requirements(self, 
                                      requirements: Dict[str, int],
                                      gpu_type: str = "t4") -> Tuple[ResourceCalculation, HardwareSpecification]:
        """
        통합 하드웨어 요구사항 계산
        
        Args:
            requirements: {"callbot": 30, "chatbot": 30, "advisor": 20, ...}
            gpu_type: "t4", "v100", "l40s"
            
        Returns:
            ResourceCalculation, HardwareSpecification
        """
        
        # 전체 요구사항 직접 사용
        total_req = requirements
        
        # 서비스별 부하 분석
        service_loads = self._analyze_service_loads(total_req)
        
        # 리소스 계산
        infrastructure_reqs = self._calculate_infrastructure_requirements(total_req)
        cpu_reqs = self._calculate_cpu_requirements(service_loads)
        
        # 인프라 CPU 총합 계산
        total_infra_cpu = sum(infrastructure_reqs.values())
        
        # CPU 총합에 실제 인프라 CPU 반영
        cpu_reqs['infrastructure'] = total_infra_cpu
        cpu_reqs['total'] = cpu_reqs['stt'] + cpu_reqs['ta'] + cpu_reqs['qa'] + total_infra_cpu
        
        # 총 채널 수 계산 (동적 스케일링을 위해)
        total_channels = sum(v for k, v in requirements.items() if isinstance(v, (int, float)) and k != 'gpu_type')
        
        resources = ResourceCalculation(
            gpu=self._calculate_gpu_requirements(service_loads, gpu_type, total_channels, requirements),
            cpu=cpu_reqs,
            network=self._calculate_network_requirements(service_loads),
            storage=self._calculate_storage_requirements(service_loads),
            infrastructure=infrastructure_reqs,
            # 채널 정보 추가
            stt_channels=service_loads['stt_channels'],
            tts_channels=service_loads['tts_channels'],
            ta_channels=service_loads['ta_daily_processing'],
            qa_channels=service_loads['qa_daily_evaluations'],
            stt_breakdown=service_loads['stt_breakdown'],
            nlp_breakdown=service_loads['nlp_breakdown'],
            aicm_breakdown=service_loads['aicm_breakdown'],
            infra_breakdown=service_loads['infra_breakdown']
        )
        
        # 하드웨어 사양 생성
        hardware_spec = self._generate_hardware_specification(resources, total_req, total_channels)
        
        # 실제 메모리 요구사항 계산
        actual_memory_gb = self._calculate_actual_memory_requirements(hardware_spec)
        
        return resources, hardware_spec
    

    
    def _analyze_service_loads(self, requirements: Dict[str, int]) -> Dict[str, float]:
        """서비스별 일일 처리량 분석"""
        service_loads = {
            'stt_channels': 0,
            'tts_channels': 0,
            'nlp_daily_queries': 0,
            'aicm_daily_queries': 0,
            'ta_daily_processing': 0,
            'qa_daily_evaluations': 0,
            # 서비스별 종속성 추적
            'stt_breakdown': {
                'callbot': 0,
                'chatbot': 0,
                'advisor': 0,
                'standalone': 0
            },
            'nlp_breakdown': {
                'callbot': 0,
                'chatbot': 0,
                'advisor': 0,
                'ta': 0
            },
            'aicm_breakdown': {
                'callbot': 0,
                'chatbot': 0,
                'advisor': 0
            },
            'infra_breakdown': {
                'total_channels': 0,
                'services': [],
                'primary_services': []
            }
        }
        
        # 메인 서비스 처리 (가이드 기준 정확한 수치 적용)
        if requirements.get('callbot', 0) > 0:
            callbot_stt = requirements['callbot'] * 1  # 콜봇 1채널당 STT 1채널 (환경설정 기준)
            callbot_nlp = requirements['callbot'] * 3200  # 160콜 × 20쿼리 = 3,200쿼리/일
            callbot_aicm = requirements['callbot'] * 480   # 160콜 × 3쿼리 = 480쿼리/일
            
            service_loads['stt_channels'] += callbot_stt
            service_loads['stt_breakdown']['callbot'] = callbot_stt
            service_loads['tts_channels'] += requirements['callbot']  # 콜봇 1개당 TTS 1채널 (콜봇만 TTS 사용)
            service_loads['nlp_daily_queries'] += callbot_nlp
            service_loads['nlp_breakdown']['callbot'] = callbot_nlp
            service_loads['aicm_daily_queries'] += callbot_aicm
            service_loads['aicm_breakdown']['callbot'] = callbot_aicm
        
        if requirements.get('chatbot', 0) > 0:
            # 챗봇은 텍스트 기반 서비스로 STT 불필요 (24시간 운영 고려)
            chatbot_nlp = requirements['chatbot'] * 96  # 8세션 × 12쿼리 = 96쿼리/일
            chatbot_aicm = requirements['chatbot'] * 9.6  # 8세션 × 1.2쿼리 = 9.6쿼리/일
            
            # 챗봇은 STT와 TTS 사용하지 않음 (텍스트 기반)
            service_loads['nlp_daily_queries'] += chatbot_nlp
            service_loads['nlp_breakdown']['chatbot'] = chatbot_nlp
            service_loads['aicm_daily_queries'] += chatbot_aicm
            service_loads['aicm_breakdown']['chatbot'] = chatbot_aicm
        
        if requirements.get('advisor', 0) > 0:
            advisor_stt = requirements['advisor'] * 2  # 어드바이저 1명당 STT 2채널
            advisor_nlp = requirements['advisor'] * 2400  # 160상담 × 15쿼리 = 2,400쿼리/일
            advisor_aicm = requirements['advisor'] * 1360  # 160상담 × 8.5쿼리 = 1,360쿼리/일
            
            service_loads['stt_channels'] += advisor_stt
            service_loads['stt_breakdown']['advisor'] = advisor_stt
            # 어드바이저는 TTS 사용하지 않음
            service_loads['nlp_daily_queries'] += advisor_nlp
            service_loads['nlp_breakdown']['advisor'] = advisor_nlp
            service_loads['aicm_daily_queries'] += advisor_aicm
            service_loads['aicm_breakdown']['advisor'] = advisor_aicm
        
        # 독립 서비스 처리 (사용자가 직접 입력한 경우만)
        if requirements.get('stt', 0) > 0:
            standalone_stt = requirements['stt']  # 독립 STT 채널
            service_loads['stt_channels'] += standalone_stt
            service_loads['stt_breakdown']['standalone'] = standalone_stt
        
        if requirements.get('tts', 0) > 0:
            service_loads['tts_channels'] += requirements['tts']  # 독립 TTS 채널
        
        if requirements.get('ta', 0) > 0:
            # TA는 배치 처리로 유휴시간 활용하지만 기존 대화 재분석을 위한 NLP 처리 필요
            # 기존 서비스들의 NLP 처리량의 30%를 추가 부하로 계산
            service_loads['ta_daily_processing'] += requirements['ta']  # TA 채널 수
            
            # 기존 서비스들의 총 NLP 쿼리 수 계산
            existing_nlp_queries = (
                service_loads['nlp_breakdown'].get('callbot', 0) +
                service_loads['nlp_breakdown'].get('chatbot', 0) +
                service_loads['nlp_breakdown'].get('advisor', 0)
            )
            
            # TA NLP 부하: 기존 NLP 처리량의 30% (배치 처리 특성 반영)
            ta_nlp_load_factor = 0.3  # 30% 영향도
            ta_nlp = existing_nlp_queries * ta_nlp_load_factor  # TA 채널 수 중복 곱셈 제거
            
            service_loads['nlp_daily_queries'] += ta_nlp
            service_loads['nlp_breakdown']['ta'] = ta_nlp
        
        if requirements.get('qa', 0) > 0:
            service_loads['qa_daily_evaluations'] += requirements['qa'] * 200  # QA 1개당 일일 200건 평가
        
        # 인프라 breakdown 정보 수집
        total_channels = sum([
            requirements.get('callbot', 0),
            requirements.get('chatbot', 0), 
            requirements.get('advisor', 0),
            requirements.get('ta', 0),
            requirements.get('qa', 0),
            requirements.get('stt', 0),
            requirements.get('tts', 0)
        ])
        
        # gpu_type 같은 문자열 값 제외하고 숫자 값만 비교
        active_services = [service for service, count in requirements.items() 
                          if isinstance(count, (int, float)) and count > 0]
        primary_services = [service for service, count in requirements.items() 
                           if isinstance(count, (int, float)) and count > 0 and service in ['callbot', 'advisor']]
        
        service_loads['infra_breakdown'] = {
            'total_channels': total_channels,
            'services': active_services,
            'primary_services': primary_services if primary_services else active_services[:2]  # 상위 2개 서비스
        }
        
        return service_loads
    
    def _calculate_gpu_requirements(self, loads: Dict[str, float], gpu_type: str, total_channels: int = 0, requirements: Dict[str, int] = None) -> Dict[str, float]:
        """GPU 요구사항 계산 (서비스별 채널 기반 동적 스케일링)"""
        
        capacity = self.gpu_capacity['gpu_capacity'][gpu_type]['processing_capacity']
        
        # 전체 채널 수 기반 NLP 스케일링 배수
        if total_channels <= 100:
            nlp_multiplier = 1.0
        elif total_channels <= 500:
            nlp_multiplier = 1.5
        else:
            nlp_multiplier = 2.5
        
        # AICM 전용 채널 수 계산 (TA, QA 제외 - AICM 사용하지 않음)
        aicm_channels = 0
        if requirements:
            aicm_channels = (requirements.get('callbot', 0) + 
                           requirements.get('chatbot', 0) + 
                           requirements.get('advisor', 0) + 
                           requirements.get('stt', 0) +  # 독립 STT는 AICM 미사용이지만 소량
                           requirements.get('tts', 0))   # 독립 TTS도 AICM 미사용이지만 소량
        
        # AICM 전용 스케일링 배수
        if aicm_channels <= 100:
            aicm_multiplier = 1.0
        elif aicm_channels <= 500:
            aicm_multiplier = 1.5
        else:
            aicm_multiplier = 2.5
        
        # TTS GPU 계산 (캐시 최적화 적용, 스케일링 제외)
        tts_gpu_needed = math.ceil(loads['tts_channels'] / capacity['tts']['with_cache_optimization'])
        
        # NLP GPU 계산 (9시간 근무 기준, 전체 채널 기반 스케일링)
        working_hours = 9  # 9시간 근무 기준 (점심시간 제외 8시간 + 여유 1시간)
        nlp_qps_needed = loads['nlp_daily_queries'] / (working_hours * 3600)
        nlp_gpu_base = math.ceil(nlp_qps_needed / capacity['nlp']['queries_per_second'])
        nlp_gpu_needed = max(1, math.ceil(nlp_gpu_base * nlp_multiplier))
        
        # AICM GPU 계산 (9시간 근무 기준, AICM 전용 채널 기반 스케일링)
        aicm_qps_needed = loads['aicm_daily_queries'] / (working_hours * 3600)
        aicm_gpu_base = math.ceil(aicm_qps_needed / capacity['aicm']['vector_searches_per_second'])
        aicm_gpu_needed = max(1, math.ceil(aicm_gpu_base * aicm_multiplier))
        
        return {
            'tts': float(tts_gpu_needed),
            'nlp': float(nlp_gpu_needed),
            'aicm': float(aicm_gpu_needed),
            'total': float(tts_gpu_needed + nlp_gpu_needed + aicm_gpu_needed)
        }
    
    def _calculate_cpu_requirements(self, loads: Dict[str, float]) -> Dict[str, float]:
        """CPU 요구사항 계산"""
        
        capacity = self.gpu_capacity['cpu_capacity']
        
        # STT CPU 계산
        stt_cpu_needed = loads['stt_channels'] / capacity['stt']['channels_per_core']
        
        # TA CPU 계산 (배치 처리 + 유휴시간 활용)
        # TA: 배치 처리로 유휴시간 활용, 실제 필요량의 20% 적용
        if loads['ta_daily_processing'] > 0:
            ta_sentences_per_minute = loads['ta_daily_processing'] * (50 / 3)  # 채널당 분당 16.67문장
            ta_cores_needed = ta_sentences_per_minute / 150  # 1코어당 150문장/분
            
            # 배치 처리 인수 적용 (correlation_matrix.json에서 정의)
            batch_processing_factor = 0.3  # 배치 처리 효율성
            idle_utilization_factor = 0.67  # 유휴시간 활용으로 추가 절감
            
            # 최종 CPU 요구량: 실제 필요량의 약 20% (0.3 * 0.67 = 0.201)
            ta_cpu_needed = ta_cores_needed * batch_processing_factor * idle_utilization_factor
            ta_cpu_needed = max(0.5, ta_cpu_needed)  # 최소 0.5코어 보장 (배치 처리 특성 반영)
        else:
            ta_cpu_needed = 0.0  # TA 입력이 없으면 0코어
        
        # QA CPU 계산 (릴레이 서버 개념)
        # QA: 1채널당 3분당 1개 질의, 20% 동시 발생률 적용
        qa_channels = loads['qa_daily_evaluations'] / 200  # 일일 200건 평가 = 1채널
        concurrent_channels = qa_channels * 0.2  # 20% 동시 발생
        qa_cpu_needed = concurrent_channels / 10.0  # 1코어당 10개 동시 질의 처리
        
        # 인프라 CPU는 별도 계산 함수에서 처리
        infra_cpu = 0  # 기본값, 실제는 _calculate_infrastructure_requirements에서 계산
        
        return {
            'stt': stt_cpu_needed,
            'ta': ta_cpu_needed,
            'qa': qa_cpu_needed,
            'infrastructure': infra_cpu,  # 임시값
            'total': stt_cpu_needed + ta_cpu_needed + qa_cpu_needed  # 인프라 제외
        }
    
    def _calculate_network_requirements(self, loads: Dict[str, float]) -> Dict[str, float]:
        """네트워크 요구사항 계산"""
        
        correlation = self.correlation_matrix['correlation_weights']
        
        base_traffic = 0
        api_traffic = 0
        
        # 메인 서비스 기본 트래픽 (실제 사용량 기반)
        base_traffic_weights = correlation['network_requirements']['base_traffic']
        
        # 콜봇 트래픽
        if 'callbot' in loads:
            base_traffic += loads['callbot'] * base_traffic_weights['callbot_mbps_per_channel']
        
        # 챗봇 트래픽
        if 'chatbot' in loads:
            base_traffic += loads['chatbot'] * base_traffic_weights['chatbot_mbps_per_user']
        
        # 어드바이저 트래픽
        if 'advisor' in loads:
            base_traffic += loads['advisor'] * base_traffic_weights['advisor_mbps_per_advisor']
        
        # API 트래픽 (쿼리 기반)
        api_weights = correlation['network_requirements']['api_traffic']
        nlp_traffic = (loads['nlp_daily_queries'] / (9 * 3600)) * api_weights['nlp_query_kb'] / 1024  # KB to MB
        aicm_traffic = (loads['aicm_daily_queries'] / (9 * 3600)) * api_weights['aicm_query_kb'] / 1024  # KB to MB
        api_traffic = nlp_traffic + aicm_traffic
        
        return {
            'base': base_traffic,
            'api': api_traffic,
            'total': base_traffic + api_traffic,
            'peak_factor': 1.5  # 피크 시간 1.5배
        }
    
    def _calculate_storage_requirements(self, loads: Dict[str, float]) -> Dict[str, float]:
        """스토리지 요구사항 계산"""
        
        storage_weights = self.correlation_matrix['correlation_weights']['storage_requirements']['daily_mb_per_unit']
        
        daily_mb = 0
        for service, mb_per_unit in storage_weights.items():
            if service in loads:
                daily_mb += loads[service] * mb_per_unit
        
        # 녹취 파일 별도 계산
        recording_mb = loads['stt_channels'] * 3.2  # STT 채널당 일일 녹취량
        
        return {
            'daily_mb': daily_mb + recording_mb,
            'monthly_gb': (daily_mb + recording_mb) * 30 / 1024,
            'yearly_tb': (daily_mb + recording_mb) * 365 / (1024 * 1024),
            'with_backup_tb': (daily_mb + recording_mb) * 365 * 2 / (1024 * 1024)  # 이중 백업
        }
    
    def _calculate_infrastructure_requirements(self, total_req: Dict[str, int]) -> Dict[str, float]:
        """공통 인프라 요구사항 계산"""
        
        infra_specs = self.infrastructure['infrastructure']['base_requirements']
        # gpu_type 같은 문자열 값 제외하고 숫자 값만 합계 계산
        total_load = sum(v for v in total_req.values() if isinstance(v, (int, float)))
        
        infrastructure = {}
        
        # STT나 TTS만 독립적으로 사용하는 경우 체크
        stt_only = total_req.get('stt', 0) > 0 and all(v == 0 for k, v in total_req.items() if k not in ['stt', 'tts'])
        tts_only = total_req.get('tts', 0) > 0 and all(v == 0 for k, v in total_req.items() if k not in ['stt', 'tts'])
        
        # STT/TTS만 독립 사용하는 경우 인프라 없이 처리
        if stt_only or tts_only:
            # 최소한의 모니터링만
            infrastructure['monitoring'] = 1
            return infrastructure
        
        # 서비스별 최적화된 가중치 (10~5000채널 전체 시나리오 대응)
        service_weights = {
            'callbot': {'nginx': 0.014, 'gateway': 0.011, 'database': 0.018, 'auth_service': 0.004},
            'chatbot': {'nginx': 0.011, 'gateway': 0.008, 'database': 0.014, 'auth_service': 0.003},
            'advisor': {'nginx': 0.013, 'gateway': 0.010, 'database': 0.021, 'vector_db': 0.011, 'auth_service': 0.004},
            'ta': {'nginx': 0.006, 'gateway': 0.004, 'database': 0.011, 'auth_service': 0.001},
            'qa': {'nginx': 0.004, 'gateway': 0.003, 'database': 0.008, 'auth_service': 0.001},
            'stt': {'nginx': 0.006, 'gateway': 0.005, 'database': 0.008, 'auth_service': 0.001},
            'tts': {'nginx': 0.006, 'gateway': 0.005, 'database': 0.008, 'auth_service': 0.001}
        }
        
        # 각 인프라 서비스별 가중 부하 계산
        weighted_loads = {}
        for service, count in total_req.items():
            if count > 0 and service in service_weights:
                for infra_service, weight in service_weights[service].items():
                    weighted_loads[infra_service] = weighted_loads.get(infra_service, 0) + (count * weight)
        
        # 인프라 서버 사양 계산
        if weighted_loads:
            for service, config in infra_specs.items():
                base_cpu = config.get('cpu_cores', 0)
                load = weighted_loads.get(service, 0)
                infrastructure[service] = base_cpu + load
        else:
            # 서비스가 없으면 기본 인프라만
            for service, config in infra_specs.items():
                infrastructure[service] = config.get('base_cpu', 0)
        
        return infrastructure
    
    def _calculate_dynamic_gpu_ram(self, base_ram: int, workload_intensity: float, max_ram: int = 80) -> int:
        """GPU 서버의 RAM을 워크로드 강도에 따라 동적으로 계산합니다.
        
        Args:
            base_ram: GPU 기본 RAM (16GB, 32GB, 48GB 등)
            workload_intensity: 워크로드 강도 (0.1 ~ 1.0)
            max_ram: 최대 RAM 제한 (기본값: 80GB)
            
        Returns:
            계산된 RAM (GB)
        """
        # 기본 RAM의 1.25배 ~ 최대 RAM 사이에서 워크로드 강도에 따라 조정 (가중치 절반으로 축소)
        min_multiplier = 1.25  # 최소 1.25배 (기존 1.5배에서 축소)
        max_multiplier = max_ram / base_ram  # 최대 배수는 max_ram 기준
        
        # 워크로드 강도에 따른 배수 계산 (가중치 범위 축소)
        effective_intensity = workload_intensity * 0.5  # 가중치 영향도를 절반으로 축소
        multiplier = min_multiplier + (max_multiplier - min_multiplier) * effective_intensity
        
        # 계산된 RAM
        calculated_ram = int(base_ram * multiplier)
        
        # 최대값 제한 적용
        final_ram = min(calculated_ram, max_ram)
        
        # 디버그 로깅
        logging.info(f"🔧 동적 GPU RAM 계산: base_ram={base_ram}GB, workload_intensity={workload_intensity:.2f}, multiplier={multiplier:.2f}, calculated_ram={calculated_ram}GB, final_ram={final_ram}GB")
        
        return final_ram

    def _calculate_actual_memory_requirements(self, hardware_spec: 'HardwareSpecification') -> float:
        """실제 메모리 요구사항 계산"""
        total_memory = 0.0
        
        # GPU 서버 메모리
        for server in hardware_spec.gpu_servers:
            total_memory += server['ram_gb'] * server['count']
        
        # CPU 서버 메모리
        for server in hardware_spec.cpu_servers:
            total_memory += server['ram_gb'] * server['count']
        
        # 인프라 서버 메모리
        for server in hardware_spec.infrastructure_servers:
            total_memory += server['ram_gb'] * server['count']
        
        return total_memory

    def _generate_hardware_specification(self, resources: ResourceCalculation, requirements: Dict[str, int], total_channels: int = 0) -> HardwareSpecification:
        """하드웨어 사양 생성"""
        servers = []
        
        # GPU 서버 생성 (TTS, NLP, AICM)
        if resources.gpu['tts'] > 0:
            gpu_per_server = 1
            tts_servers_needed = max(1, math.ceil(resources.gpu['tts'] / gpu_per_server))
            
            # GPU 타입별 사양 적용
            gpu_type = self._select_gpu_type(resources.gpu['tts'], total_channels)
            gpu_specs = self.gpu_capacity['gpu_capacity'][gpu_type.lower()]['specs']
            
            cpu_cores = gpu_specs['cpu_cores']
            
            # TTS 워크로드 강도 계산 (채널 수 기반)
            tts_workload_intensity = min(1.0, resources.tts_channels / 100.0)  # 100채널 기준으로 정규화
            
            # 동적 RAM 계산 (GPU 기본 RAM 기준)
            base_gpu_ram = gpu_specs['ram_gb']
            ram_gb = self._calculate_dynamic_gpu_ram(base_gpu_ram, tts_workload_intensity)
            
            servers.append({
                'type': f'TTS 서버 ({gpu_type})',
                'count': tts_servers_needed,
                'cpu_cores': cpu_cores,
                'ram_gb': ram_gb,
                'storage_nvme_tb': 0.5,  # 500GB 고정
                'gpu_per_server': gpu_per_server,
                'purpose': f'TTS 음성 합성 (콜봇 전용, {resources.tts_channels}채널)',
                'gpu_allocation': {
                    'tts': f"{resources.gpu['tts']:.1f}",
                    'nlp': '0.0',
                    'aicm': '0.0'
                }
            })
        
        if resources.gpu['nlp'] > 0:
            gpu_per_server = 1
            nlp_servers_needed = max(1, math.ceil(resources.gpu['nlp'] / gpu_per_server))
            
            # GPU 타입별 기본 사양
            gpu_type = self._select_gpu_type(resources.gpu['nlp'], total_channels)
            gpu_specs = self.gpu_capacity['gpu_capacity'][gpu_type.lower()]['specs']
            
            # 서버 스펙 설정
            fixed_cpu = 32  # 고정 32코어
            gpu_count = resources.gpu['nlp']
            
            # NLP 워크로드 강도 계산 (총 쿼리 수 기반)
            total_nlp_queries = sum(resources.nlp_breakdown.values()) if resources.nlp_breakdown else 0
            nlp_workload_intensity = min(1.0, total_nlp_queries / 500000.0)  # 50만 쿼리 기준으로 정규화
            
            logging.info(f"📊 NLP 워크로드 분석: total_queries={total_nlp_queries}, intensity={nlp_workload_intensity:.2f}")
            
            # 동적 RAM 계산 (GPU 기본 RAM 기준)
            base_gpu_ram = gpu_specs['ram_gb']
            dynamic_ram = self._calculate_dynamic_gpu_ram(base_gpu_ram, nlp_workload_intensity)
            
            # 스토리지만 GPU 수에 따라 조정
            # scaled_storage = max(4.0, gpu_count * 1.0)  # GPU당 1TB씩 증가, 최소 4TB
            
            # NLP 종속성 정보 생성
            nlp_dependency = self._format_nlp_dependency(resources.nlp_breakdown)
            
            servers.append({
                'type': f'NLP 서버 ({gpu_type})',
                'count': nlp_servers_needed,
                'cpu_cores': fixed_cpu,
                'ram_gb': dynamic_ram,
                'storage_nvme_tb': 0.5,  # 500GB 고정
                'gpu_per_server': gpu_per_server,
                'purpose': f'NLP 자연어 처리 ({nlp_dependency})',
                'gpu_allocation': {
                    'tts': '0.0',
                    'nlp': f"{resources.gpu['nlp']:.1f}",
                    'aicm': '0.0'
                }
            })
        
        if resources.gpu['aicm'] > 0:
            gpu_per_server = 1
            aicm_servers_needed = max(1, math.ceil(resources.gpu['aicm'] / gpu_per_server))
            
            # AICM 전용 채널 수 계산 (GPU 타입 선택용)
            aicm_channels = (requirements.get('callbot', 0) + 
                           requirements.get('chatbot', 0) + 
                           requirements.get('advisor', 0))
            
            # GPU 타입별 기본 사양 (AICM 전용 채널 기반)
            gpu_type = self._select_gpu_type(resources.gpu['aicm'], aicm_channels)
            gpu_specs = self.gpu_capacity['gpu_capacity'][gpu_type.lower()]['specs']
            
            # 서버 스펙 설정
            fixed_cpu = 32  # 고정 32코어
            gpu_count = resources.gpu['aicm']
            
            # AICM 워크로드 강도 계산 (총 쿼리 수 기반)
            total_aicm_queries = sum(resources.aicm_breakdown.values()) if resources.aicm_breakdown else 0
            aicm_workload_intensity = min(1.0, total_aicm_queries / 300000.0)  # 30만 쿼리 기준으로 정규화
            
            logging.info(f"📊 AICM 워크로드 분석: total_queries={total_aicm_queries}, intensity={aicm_workload_intensity:.2f}")
            
            # 동적 RAM 계산 (GPU 기본 RAM 기준)
            base_gpu_ram = gpu_specs['ram_gb']
            dynamic_ram = self._calculate_dynamic_gpu_ram(base_gpu_ram, aicm_workload_intensity)
            
            # 스토리지만 GPU 수에 따라 조정
            # scaled_storage = max(4.0, gpu_count * 1.0)  # GPU당 1TB씩 증가, 최소 4TB
            
            # AICM 종속성 정보 생성
            aicm_dependency = self._format_aicm_dependency(resources.aicm_breakdown)
            
            servers.append({
                'type': f'AICM 서버 ({gpu_type})',
                'count': aicm_servers_needed,
                'cpu_cores': fixed_cpu,
                'ram_gb': dynamic_ram,
                'storage_nvme_tb': 0.5,  # 500GB 고정
                'gpu_per_server': gpu_per_server,
                'purpose': f'AICM 벡터 검색 RAG ({aicm_dependency})',
                'gpu_allocation': {
                    'tts': '0.0',
                    'nlp': '0.0',
                    'aicm': f"{resources.gpu['aicm']:.1f}"
                }
            })
        
        # CPU 서버 생성 (STT, TA, QA)
        if resources.cpu['stt'] > 0:
            stt_instances = self._find_optimal_instance_combination(resources.cpu['stt'], 0)  # 스토리지는 별도 계산
            total_cores = sum(instance['cpu_cores'] * instance['count'] for instance in stt_instances)
            
            # STT 종속성 정보 생성
            stt_dependency = self._format_stt_dependency(resources.stt_breakdown)
            
            for instance in stt_instances:
                # 각 서버가 처리하는 채널 비율에 따른 스토리지 계산
                server_cores = instance['cpu_cores'] * instance['count']
                server_channels = resources.stt_channels * (server_cores / total_cores)
                server_storage = max(0.5, round(server_channels * 0.01, 1))  # 채널당 10GB, 최소 0.5TB, 소수점 1자리
                
                servers.append({
                    'type': f'STT 서버 ({instance["cpu_cores"]}코어)',
                    'count': instance['count'],
                    'cpu_cores': instance['cpu_cores'],
                    'ram_gb': instance['ram_gb'],
                    'storage_ssd_tb': 0.5,  # 500GB 고정
                    'purpose': f'음성 인식 전용 (1코어당 6.5채널, 총 {server_cores}코어) - {stt_dependency}',
                    'cpu_allocation': {
                        'stt': f"{resources.cpu['stt']:.1f}",
                        'ta': '0.0',
                        'qa': '0.0',
                        'infrastructure': '0.0'
                    }
                })
        
        # TA CPU 서버 생성 (TA 입력이 있을 때만) - 통합 방식
        if resources.cpu['ta'] > 0:
            ta_instances = self._find_optimal_instance_combination(resources.cpu['ta'], resources.ta_channels)
            
            # TA 서버 통합 처리 (STT와 동일한 방식)
            if ta_instances:
                # 총 코어 수와 스토리지 계산
                total_ta_cores = sum(instance['cpu_cores'] * instance['count'] for instance in ta_instances)
                total_ta_storage = sum(instance['storage_ssd_tb'] * instance['count'] for instance in ta_instances)
                total_ta_count = sum(instance['count'] for instance in ta_instances)
                
                # 대표 인스턴스 선택 (가장 큰 인스턴스)
                main_instance = max(ta_instances, key=lambda x: x['cpu_cores'])
                
                servers.append({
                    'type': f'TA CPU 서버 ({main_instance["cpu_cores"]}코어)',
                    'count': total_ta_count,
                    'cpu_cores': main_instance['cpu_cores'],
                    'ram_gb': main_instance['ram_gb'],
                    'storage_ssd_tb': 0.5,  # 500GB 고정
                    'purpose': f'TA {int(resources.ta_channels)}채널 분석 처리 (배치 처리, NLP 연동)',
                    'cpu_allocation': {
                        'stt': '0.0',
                        'ta': f"{resources.cpu['ta']:.1f}",
                        'qa': '0.0',
                        'infrastructure': '0.0'
                    }
                })
        
        if resources.cpu['qa'] > 0:
            # QA 채널 수를 requirements에서 직접 계산
            qa_channels = requirements.get('qa', 0)
            qa_instances = self._find_optimal_instance_combination(resources.cpu['qa'], qa_channels)
            for instance in qa_instances:
                # QA 서버 스토리지: 채널당 10GB
                qa_storage = max(1.0, qa_channels * 0.01)  # 채널당 10GB, 최소 1TB
                servers.append({
                    'type': f'QA 서버 ({instance["cpu_cores"]}코어)',
                    'count': instance['count'],
                    'cpu_cores': instance['cpu_cores'],
                    'ram_gb': instance['ram_gb'],
                    'storage_ssd_tb': 0.5,  # 500GB 고정
                    'purpose': f'QA {qa_channels}채널 품질 평가 (외부 LLM 기반, 배치 처리)',
                    'cpu_allocation': {
                        'stt': '0.0',
                        'ta': '0.0',
                        'qa': f"{resources.cpu['qa']:.1f}",
                        'infrastructure': '0.0'
                    }
                })
        
        # 인프라 서버 생성
        total_users = sum([
            requirements.get('callbot', 0),
            requirements.get('chatbot', 0), 
            requirements.get('advisor', 0),
            requirements.get('ta', 0),
            requirements.get('qa', 0)
        ])
        
        # Nginx 서버 (500GB 고정, STT/TA처럼 통합 방식)
        nginx_cpu_total = max(2, int(resources.infrastructure.get('nginx', 2)))  # 최소 2코어
        nginx_instances = self._find_optimal_instance_combination(nginx_cpu_total)
        
        if nginx_instances:
            total_nginx_cores = sum(instance['cpu_cores'] * instance['count'] for instance in nginx_instances)
            total_nginx_count = sum(instance['count'] for instance in nginx_instances)
            
            main_instance = max(nginx_instances, key=lambda x: x['cpu_cores'])
            
            servers.append({
                'type': f'Nginx 서버 ({main_instance["cpu_cores"]}코어)',
                'count': total_nginx_count,
                'cpu_cores': main_instance['cpu_cores'],
                'ram_gb': main_instance['cpu_cores'] * 2,  # 코어당 2GB RAM
                'storage_ssd_tb': 0.5,  # 500GB 고정
                'purpose': f'{self._format_infra_dependency(resources.infra_breakdown, "nginx")}',
                'cpu_allocation': {
                    'stt': '0.0',
                    'ta': '0.0',
                    'qa': '0.0',
                    'infrastructure': f'{nginx_cpu_total}.0'
                }
            })
        
        # API Gateway 서버 (500GB 고정, STT/TA처럼 통합 방식, 기본 2대 구성)
        gateway_cpu_total = max(2, int(resources.infrastructure.get('gateway', 2)))  # 최소 2코어
        gateway_instances = self._find_optimal_instance_combination(gateway_cpu_total)
        
        if gateway_instances:
            total_gateway_cores = sum(instance['cpu_cores'] * instance['count'] for instance in gateway_instances)
            total_gateway_count = sum(instance['count'] for instance in gateway_instances) * 2  # 기본 2대씩 구성
            
            main_instance = max(gateway_instances, key=lambda x: x['cpu_cores'])
            
            servers.append({
                'type': f'API Gateway 서버 ({main_instance["cpu_cores"]}코어)',
                'count': total_gateway_count,
                'cpu_cores': main_instance['cpu_cores'],
                'ram_gb': main_instance['cpu_cores'] * 2,  # 코어당 2GB RAM
                'storage_ssd_tb': 0.5,  # 500GB 고정
                'purpose': f'{self._format_infra_dependency(resources.infra_breakdown, "gateway")} (총 {total_gateway_cores * 2}코어, 이중화)',
                'cpu_allocation': {
                    'stt': '0.0',
                    'ta': '0.0',
                    'qa': '0.0',
                    'infrastructure': f'{gateway_cpu_total * 2}.0'  # 2대이므로 2배
                }
            })
        
        # PostgreSQL 서버 (사용자당 5GB씩 증가, STT/TA처럼 통합 방식)
        postgres_storage = max(1.0, total_users * 0.005)  # 사용자당 5GB, 최소 1TB
        postgres_cpu_total = max(4, int(resources.infrastructure.get('database', 4)))  # 최소 4코어
        postgres_instances = self._find_optimal_instance_combination(postgres_cpu_total)
        
        if postgres_instances:
            total_postgres_cores = sum(instance['cpu_cores'] * instance['count'] for instance in postgres_instances)
            total_postgres_count = sum(instance['count'] for instance in postgres_instances)
            
            main_instance = max(postgres_instances, key=lambda x: x['cpu_cores'])
            
            servers.append({
                'type': f'PostgreSQL 서버 ({main_instance["cpu_cores"]}코어)',
                'count': total_postgres_count,
                'cpu_cores': main_instance['cpu_cores'],
                'ram_gb': main_instance['cpu_cores'] * 4,  # 코어당 4GB RAM
                'storage_ssd_tb': round(postgres_storage, 1),
                'purpose': f'{self._format_infra_dependency(resources.infra_breakdown, "database")}',
                'cpu_allocation': {
                    'stt': '0.0',
                    'ta': '0.0',
                    'qa': '0.0',
                    'infrastructure': f'{postgres_cpu_total}.0'
                }
            })
        
        # VectorDB 서버 (4TB 고정, STT/TA처럼 통합 방식) - 어드바이저 사용 시만
        if resources.infrastructure.get('vector_db', 0) > 0:
            vectordb_cpu_total = max(8, int(resources.infrastructure.get('vector_db', 8)))  # 최소 8코어
            vectordb_instances = self._find_optimal_instance_combination(vectordb_cpu_total)
            
            if vectordb_instances:
                total_vectordb_cores = sum(instance['cpu_cores'] * instance['count'] for instance in vectordb_instances)
                total_vectordb_storage = sum(instance.get('storage_ssd_tb', 0.5) * instance['count'] for instance in vectordb_instances)
                total_vectordb_count = sum(instance['count'] for instance in vectordb_instances)
                
                main_instance = max(vectordb_instances, key=lambda x: x['cpu_cores'])
                
                servers.append({
                    'type': f'VectorDB 서버 ({main_instance["cpu_cores"]}코어)',
                    'count': total_vectordb_count,
                    'cpu_cores': main_instance['cpu_cores'],
                    'ram_gb': main_instance['cpu_cores'] * 4,  # 코어당 4GB RAM
                    'storage_ssd_tb': 0.5,  # 500GB 고정
                    'purpose': f'{self._format_infra_dependency(resources.infra_breakdown, "vector_db")} (총 {total_vectordb_cores}코어)',
                    'cpu_allocation': {
                        'stt': '0.0',
                        'ta': '0.0',
                        'qa': '0.0',
                        'infrastructure': f'{vectordb_cpu_total}.0'
                    }
                })
        
        # Auth Service 서버 (500GB 고정, STT/TA처럼 통합 방식)
        auth_cpu_total = max(4, int(resources.infrastructure.get('auth_service', 4)))  # 최소 4코어
        auth_instances = self._find_optimal_instance_combination(auth_cpu_total)
        
        if auth_instances:
            total_auth_cores = sum(instance['cpu_cores'] * instance['count'] for instance in auth_instances)
            total_auth_count = sum(instance['count'] for instance in auth_instances)
            
            main_instance = max(auth_instances, key=lambda x: x['cpu_cores'])
            
            servers.append({
                'type': f'Auth Service 서버 ({main_instance["cpu_cores"]}코어)',
                'count': total_auth_count,
                'cpu_cores': main_instance['cpu_cores'],
                'ram_gb': main_instance['cpu_cores'] * 2,  # 코어당 2GB RAM
                'storage_ssd_tb': 0.5,  # 500GB 고정
                'purpose': f'{self._format_infra_dependency(resources.infra_breakdown, "auth_service")} (총 {total_auth_cores}코어)',
                'cpu_allocation': {
                    'stt': '0.0',
                    'ta': '0.0',
                    'qa': '0.0',
                    'infrastructure': f'{auth_cpu_total}.0'
                }
            })
        
        # NAS 서버 (유저 기반 동적 스토리지, 최소 1TB)
        total_users = sum(requirements.values()) if requirements else 200  # 기본 200 유저
        nas_storage = max(1.0, total_users * 0.005)  # 유저당 5GB, 최소 1TB
        nas_cpu_total = max(8, int(nas_storage / 2))  # 스토리지 기반 CPU 할당, 최소 8코어
        nas_instances = self._find_optimal_instance_combination(nas_cpu_total)
        
        if nas_instances:
            total_nas_cores = sum(instance['cpu_cores'] * instance['count'] for instance in nas_instances)
            total_nas_count = sum(instance['count'] for instance in nas_instances)
            
            main_instance = max(nas_instances, key=lambda x: x['cpu_cores'])
            
            servers.append({
                'type': f'NAS 서버 ({main_instance["cpu_cores"]}코어)',
                'count': total_nas_count,
                'cpu_cores': main_instance['cpu_cores'],
                'ram_gb': main_instance['cpu_cores'] * 2,  # 코어당 2GB RAM
                'storage_ssd_tb': nas_storage,
                'purpose': f'네트워크 스토리지 (총 유저 {total_users}명, {nas_storage:.1f}TB) (총 {total_nas_cores}코어)',
                'cpu_allocation': {
                    'stt': '0.0',
                    'ta': '0.0',
                    'qa': '0.0',
                    'infrastructure': f'{nas_cpu_total}.0'
                }
            })
        
        # 네트워크 요구사항
        total_channels = resources.stt_channels + resources.tts_channels + resources.ta_channels + resources.qa_channels
        if total_channels <= 100:
            network_req = "1 Gbps"
        elif total_channels <= 500:
            network_req = "5 Gbps"
        else:
            network_req = "10 Gbps"
        
        # 중복 서버 제거는 이미 위에서 통합 로직으로 처리됨
        
        return HardwareSpecification(
            gpu_servers=[s for s in servers if 'gpu_allocation' in s],
            cpu_servers=[s for s in servers if 'cpu_allocation' in s and 'gpu_allocation' not in s and s.get('cpu_allocation', {}).get('infrastructure', '0.0') == '0.0'],
            storage_servers=[s for s in servers if 'storage_raid10_tb' in s],
            infrastructure_servers=[s for s in servers if 'cpu_allocation' in s and s.get('cpu_allocation', {}).get('infrastructure', '0.0') != '0.0'],
            network_requirements=network_req,
            infrastructure_notes="이중화 구성 권장, 모니터링 시스템 필수"
        )
    
    def compare_gpu_options(self, requirements: Dict[str, int]) -> Dict[str, Any]:
        """GPU 옵션별 비교 분석"""
        
        comparisons = {}
        for gpu_type in ['t4', 'v100', 'l40s']:
            resources, hardware = self.calculate_hardware_requirements(requirements, gpu_type)
            comparisons[gpu_type] = {
                'gpu_count': math.ceil(resources.gpu['total']),
                'server_count': sum(s['count'] for s in hardware.gpu_servers),
                'efficiency_score': self._calculate_efficiency_score(resources, gpu_type),
                'complexity_score': self._calculate_complexity_score(hardware)
            }
        
        # 권장사항 결정
        t4_gpus = comparisons['t4']['gpu_count']
        recommendation = 't4'
        if t4_gpus > 15:
            recommendation = 'l40s'
        elif t4_gpus > 5:
            recommendation = 'v100'
            
        comparisons['recommendation'] = recommendation
        return comparisons
    
    def _calculate_efficiency_score(self, resources: ResourceCalculation, gpu_type: str) -> float:
        """효율성 점수 계산"""
        gpu_specs = self.gpu_capacity['gpu_capacity'][gpu_type]['specs']
        power_efficiency = 100 / gpu_specs['power_watts']  # 전력 효율
        memory_efficiency = gpu_specs['memory_gb'] / 16  # 메모리 효율 (T4 기준)
        return (power_efficiency + memory_efficiency) / 2
    
    def _calculate_complexity_score(self, hardware: HardwareSpecification) -> int:
        """관리 복잡도 점수 계산"""
        total_servers = sum(s['count'] for s in hardware.gpu_servers + hardware.cpu_servers + hardware.storage_servers + hardware.infrastructure_servers)
        return total_servers

    def generate_server_config_table(self, hardware_spec):
        """서버 구성 상세 테이블을 생성합니다."""
        try:
            logger.info(f"DEBUG: generate_server_config_table 시작")
            logger.info(f"DEBUG: hardware_spec 타입: {type(hardware_spec)}")
            logger.info(f"DEBUG: hardware_spec 구조 - GPU: {len(hardware_spec.gpu_servers)}, CPU: {len(hardware_spec.cpu_servers)}, Storage: {len(hardware_spec.storage_servers)}, Infra: {len(hardware_spec.infrastructure_servers)}")
            
            # 실제 하드웨어 사양에서 데이터 추출
            table_rows = []
            
            # GPU 서버 구성 (TTS, NLP, AICM)
            for server in hardware_spec.gpu_servers:
                logger.info(f"DEBUG: GPU 서버 처리: {server}")
                if server.get('count', 0) > 0:
                    # GPU 타입 자동 감지
                    gpu_type = 'T4'
                    if 'V100' in str(server.get('type', '')):
                        gpu_type = 'V100'
                    elif 'L40S' in str(server.get('type', '')):
                        gpu_type = 'L40S'
                    
                    # GPU RAM 자동 감지
                    gpu_ram = 16  # 기본값
                    if gpu_type == 'V100':
                        gpu_ram = 32
                    elif gpu_type == 'L40S':
                        gpu_ram = 48
                    
                    table_rows.append({
                        'role': f"{server.get('type', 'GPU 서버')}",
                        'cpu_cores': server.get('cpu_cores', 0),
                        'ram_gb': server.get('ram_gb', 0),
                        'quantity': server.get('count', 0),
                        'ebs_gb': '-',
                        'instance_storage_gb': round(server.get('storage_nvme_tb', 0) * 1000) if server.get('storage_nvme_tb') else '-',
                        'nas': '-',
                        'gpu_type': gpu_type,
                        'gpu_ram_gb': gpu_ram,
                        'gpu_quantity': server.get('gpu_per_server', 1)
                    })
            
            # CPU 서버 구성
            for server in hardware_spec.cpu_servers:
                logger.info(f"DEBUG: CPU 서버 처리: {server}")
                if server.get('count', 0) > 0:
                    table_rows.append({
                        'role': f"{server.get('type', 'CPU 서버')}",
                        'cpu_cores': server.get('cpu_cores', 0),
                        'ram_gb': server.get('ram_gb', 0),
                        'quantity': server.get('count', 0),
                        'ebs_gb': '-',
                        'instance_storage_gb': round(server.get('storage_ssd_tb', 0) * 1000) if server.get('storage_ssd_tb') else '-',
                        'nas': '-',
                        'gpu_type': '-',
                        'gpu_ram_gb': '-',
                        'gpu_quantity': '-'
                    })
            
            # 스토리지 서버 구성
            for server in hardware_spec.storage_servers:
                logger.info(f"DEBUG: 스토리지 서버 처리: {server}")
                if server.get('count', 0) > 0:
                    table_rows.append({
                        'role': f"{server.get('type', '스토리지 서버')}",
                        'cpu_cores': server.get('cpu_cores', 0),
                        'ram_gb': server.get('ram_gb', 0),
                        'quantity': server.get('count', 0),
                        'ebs_gb': '-',
                        'instance_storage_gb': f"{server.get('storage_raid10_tb', 0)} TB",
                        'nas': '-',
                        'gpu_type': '-',
                        'gpu_ram_gb': '-',
                        'gpu_quantity': '-'
                    })
            
            # 인프라 서버 구성 (각각 개별적으로 표시)
            for server in hardware_spec.infrastructure_servers:
                logger.info(f"DEBUG: 인프라 서버 처리: {server}")
                if server.get('count', 0) > 0:
                    # 스토리지 값이 0이면 '-'로 표시
                    storage_value = server.get('storage_ssd_tb', 0)
                    storage_display = f"{storage_value} TB (SSD)" if storage_value > 0 else "-"
                    
                    table_rows.append({
                        'role': f"{server.get('type', '인프라 서버')}",
                        'cpu_cores': server.get('cpu_cores', 0),
                        'ram_gb': server.get('ram_gb', 0),
                        'quantity': server.get('count', 0),
                        'ebs_gb': '-',
                        'instance_storage_gb': round(storage_value * 1000) if storage_value > 0 else '-',
                        'nas': '-',
                        'gpu_type': '-',
                        'gpu_ram_gb': '-',
                        'gpu_quantity': '-'
                    })
            
            # 데이터가 없으면 빈 배열 반환
            if not table_rows:
                logger.info("DEBUG: 실제 데이터가 없음")
                return []
            
            logger.info(f"DEBUG: 최종 테이블 행 수: {len(table_rows)}")
            logger.info(f"DEBUG: 테이블 데이터: {table_rows}")
            return table_rows
            
        except Exception as e:
            logger.error(f"서버 구성 테이블 생성 중 오류: {e}")
            import traceback
            logger.error(f"에러 상세: {traceback.format_exc()}")
            # 에러 발생 시 빈 배열 반환
            return []

    def _select_gpu_type(self, gpu_count: float, total_channels: int = 0) -> str:
        """GPU 수량과 채널 수에 따른 적절한 GPU 타입 선택"""
        # 소규모는 채널 수 우선 고려
        if total_channels <= 100:
            return 'T4'  # 소규모: 무조건 T4
        elif gpu_count <= 2:
            return 'T4'  # 소량: T4
        elif gpu_count <= 8:
            return 'V100'  # 중량: V100
        else:
            return 'L40S'  # 대량: L40S
    
    def _format_stt_dependency(self, stt_breakdown: Dict[str, int]) -> str:
        """STT 채널 종속성 정보를 포맷팅"""
        deps = []
        if stt_breakdown.get('callbot', 0) > 0:
            deps.append(f'콜봇 {stt_breakdown["callbot"]}채널')
        # 챗봇은 텍스트 기반이므로 STT 사용하지 않음
        if stt_breakdown.get('advisor', 0) > 0:
            # 어드바이저는 1명당 2채널이므로 명확히 표시
            advisor_count = stt_breakdown["advisor"] // 2  # 실제 어드바이저 수
            deps.append(f'어드바이저 {stt_breakdown["advisor"]}채널({advisor_count}명×2)')
        if stt_breakdown.get('standalone', 0) > 0:
            deps.append(f'독립 STT {stt_breakdown["standalone"]}채널')
        
        if deps:
            return ' + '.join(deps)
        else:
            return '총 STT 채널 처리'
    
    def _format_nlp_dependency(self, nlp_breakdown: Dict[str, int]) -> str:
        """NLP 서비스 종속성 정보를 포맷팅"""
        deps = []
        if nlp_breakdown.get('callbot', 0) > 0:
            deps.append(f'콜봇 {int(nlp_breakdown["callbot"])}쿼리/일')
        if nlp_breakdown.get('chatbot', 0) > 0:
            deps.append(f'챗봇 {int(nlp_breakdown["chatbot"])}쿼리/일')
        if nlp_breakdown.get('advisor', 0) > 0:
            deps.append(f'어드바이저 {int(nlp_breakdown["advisor"])}쿼리/일')
        if nlp_breakdown.get('ta', 0) > 0:
            deps.append(f'TA {int(nlp_breakdown["ta"])}쿼리/일')
        
        if deps:
            return ' + '.join(deps)
        else:
            return 'NLP 자연어 처리'
    
    def _format_aicm_dependency(self, aicm_breakdown: Dict[str, int]) -> str:
        """AICM 서비스 종속성 정보를 포맷팅"""
        deps = []
        if aicm_breakdown.get('callbot', 0) > 0:
            deps.append(f'콜봇 {int(aicm_breakdown["callbot"])}쿼리/일')
        if aicm_breakdown.get('chatbot', 0) > 0:
            deps.append(f'챗봇 {int(aicm_breakdown["chatbot"])}쿼리/일')
        if aicm_breakdown.get('advisor', 0) > 0:
            deps.append(f'어드바이저 {int(aicm_breakdown["advisor"])}쿼리/일')
        
        if deps:
            return ' + '.join(deps)
        else:
            return 'AICM 벡터 검색'
    
    def _format_infra_dependency(self, infra_breakdown: Dict, service_name: str) -> str:
        """인프라 서비스 종속성 정보를 포맷팅"""
        total_channels = infra_breakdown.get('total_channels', 0)
        services = infra_breakdown.get('services', [])
        
        service_names = {
            'callbot': '콜봇', 'chatbot': '챗봇', 'advisor': '어드바이저',
            'ta': 'TA', 'qa': 'QA', 'stt': 'STT', 'tts': 'TTS'
        }
        
        service_list = [service_names.get(s, s) for s in services if s in service_names]
        
        if service_name == 'nginx':
            purpose = '로드 밸런싱'
        elif service_name == 'database':
            purpose = '데이터 저장'
        elif service_name == 'vector_db':
            purpose = '벡터 검색 (어드바이저 전용)'
        elif service_name == 'gateway':
            purpose = 'API 라우팅'
        elif service_name == 'auth_service':
            purpose = '인증 관리'
        else:
            purpose = '인프라 지원'
        
        if service_list:
            return f'{purpose} (전체 {total_channels}채널: {", ".join(service_list)})'
        else:
            return f'{purpose} (전체 {total_channels}채널)'
    
    def _find_optimal_instance_combination(self, required_cores: float, total_channels: int = 0) -> List[Dict[str, int]]:
        """필요한 코어 수에 맞는 최적의 인스턴스 조합 찾기 (서버 대수 최소화 우선)"""
        
        logging.info(f"🔍 서버 통합 로직 시작 - 필요 코어: {required_cores:.1f}")
        
        # 사용 가능한 AWS 인스턴스 타입들 (64코어까지만, 코어 수 기준, 내림차순)
        instance_types = [64, 48, 36, 32, 24, 16, 8]
        
        # STT 서버의 경우 채널당 10GB로 계산
        total_storage = max(1.0, total_channels * 0.01)  # 채널당 10GB, 최소 1TB
        
        # 서버 대수 최소화를 위해 가장 큰 인스턴스부터 사용
        # 필요한 서버 수를 계산하여 최소 대수로 구성
        for max_cores in instance_types:
            server_count = math.ceil(required_cores / max_cores)
            total_provided_cores = server_count * max_cores
            limit = required_cores * 1.5
            
            logging.info(f"  🔸 {max_cores}코어 × {server_count}대 = {total_provided_cores}코어 (제한: {limit:.1f})")
            
            # 필요 코어의 150% 이내로 제한 (서버 대수 최소화 우선, 큰 서버 사용 권장)
            if total_provided_cores <= limit:
                logging.info(f"  ✅ 선택됨: {max_cores}코어 × {server_count}대")
                return [{
                    'cpu_cores': max_cores,
                    'count': server_count,
                    'ram_gb': max_cores * 2,  # 1코어당 2GB RAM
                    'storage_ssd_tb': total_storage
                }]
            else:
                logging.info(f"  ❌ 제외됨: {total_provided_cores} > {limit:.1f}")
        
        # 위 조건에 맞지 않으면 기존 혼합 방식 사용 (개선된 버전)
        remaining_cores = required_cores
        selected_instances = []
        
        for cores in instance_types:
            if remaining_cores <= 0:
                break
                
            if remaining_cores >= cores:
                count = int(remaining_cores // cores)
                if count > 0:
                    selected_instances.append({
                        'cpu_cores': cores,
                        'count': count,
                        'ram_gb': cores * 2,
                        'storage_ssd_tb': total_storage
                    })
                    remaining_cores -= (count * cores)
        
        # 남은 코어가 5코어 이상일 때만 추가 서버 생성 (소수점 오차 방지)
        if remaining_cores >= 5:
            suitable_for_remaining = [x for x in instance_types if x >= remaining_cores]
            if suitable_for_remaining:
                best_fit_remaining = min(suitable_for_remaining)
                selected_instances.append({
                    'cpu_cores': best_fit_remaining,
                    'count': 1,
                    'ram_gb': best_fit_remaining * 2,
                    'storage_ssd_tb': total_storage
                })
        
        return selected_instances if selected_instances else [{
            'cpu_cores': 8,  # 최소 인스턴스
            'count': 1,
            'ram_gb': 16,
            'storage_ssd_tb': total_storage
        }]
