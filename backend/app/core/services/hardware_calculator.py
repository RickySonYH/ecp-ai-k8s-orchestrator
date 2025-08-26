"""
완전 독립적인 하드웨어 계산기
모든 설정 데이터와 계산 로직을 내장
"""

import math
import logging
from typing import Dict, Any, List, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class ResourceCalculation:
    """리소스 계산 결과"""
    gpu: Dict[str, float]
    cpu: Dict[str, float] 
    network: Dict[str, float]
    storage: Dict[str, float]
    infrastructure: Dict[str, float]
    stt_channels: float = 0
    tts_channels: float = 0
    ta_channels: float = 0
    qa_channels: float = 0
    stt_breakdown: Dict[str, int] = None
    nlp_breakdown: Dict[str, int] = None
    aicm_breakdown: Dict[str, int] = None

class HardwareCalculator:
    """완전 독립적인 하드웨어 계산기"""
    
    def __init__(self):
        # 모든 설정 데이터를 내장
        self.service_specs = self._get_service_specs()
        self.gpu_capacity = self._get_gpu_capacity()
        self.correlation_matrix = self._get_correlation_matrix()
        self.aws_instances = self._get_aws_instances()
        self.ncp_instances = self._get_ncp_instances()
        self.server_specs = self._get_server_specs()
    
    def _get_service_specs(self) -> Dict[str, Any]:
        """서비스 사양 데이터"""
        return {
            "services": {
                "main_services": {
                    "callbot": {
                        "processing_requirements": {
                            "stt_channels_per_callbot": 1,
                            "tts_channels_per_callbot": 1,
                            "nlp_queries_per_call": 20,
                            "aicm_queries_per_call": 3
                        }
                    },
                    "chatbot": {
                        "processing_requirements": {
                            "nlp_queries_per_session": 12,
                            "typing_speed_factor": 0.4
                        }
                    },
                    "advisor": {
                        "processing_requirements": {
                            "stt_channels_per_advisor": 2,
                            "nlp_queries_per_consultation": 15,
                            "aicm_queries_per_consultation": 8.5
                        }
                    }
                }
            }
        }
    
    def _get_gpu_capacity(self) -> Dict[str, Any]:
        """GPU 용량 데이터"""
        return {
            "T4": {
                "tts_capacity": 50,
                "nlp_processing_rate": 150,
                "aicm_search_rate": 100,
                "ram_gb": 16
            },
            "V100": {
                "tts_capacity": 150,
                "nlp_processing_rate": 450,
                "aicm_search_rate": 300,
                "ram_gb": 32
            },
            "L40S": {
                "tts_capacity": 200,
                "nlp_processing_rate": 600,
                "aicm_search_rate": 400,
                "ram_gb": 48
            }
        }
    
    def _get_correlation_matrix(self) -> Dict[str, Any]:
        """상관관계 매트릭스 데이터"""
        return {
            "cpu_requirements": {
                "stt": {
                    "channels_per_core": 6.5,
                    "callbot_stt_ratio": 1.0,
                    "advisor_stt_ratio": 2.0
                },
                "ta": {
                    "batch_processing": True,
                    "lines_per_second": 50,  # NLP 연동으로 처리 속도 감소
                    "cpu_efficiency_factor": 0.7,  # 배치 처리 효율성 향상
                    "idle_utilization": True
                },
                "qa": {
                    "external_llm_ratio": 0.95,
                    "internal_cpu_per_evaluation": 0.02,
                    "minimal_gpu_load": True
                }
            }
        }
    
    def _get_server_specs(self) -> Dict[str, Any]:
        """서버 사양 데이터"""
        return {
            "gpu_servers": {
                "nlp": {"cpu_cores": 8, "ram_gb": 32, "gpu_type": "T4", "gpu_ram_gb": 16},
                "aicm": {"cpu_cores": 16, "ram_gb": 64, "gpu_type": "T4", "gpu_ram_gb": 16},
                "tts_callbot": {"cpu_cores": 16, "ram_gb": 64, "gpu_type": "T4", "gpu_ram_gb": 16},
                "tts_chatbot": {"cpu_cores": 8, "ram_gb": 32, "gpu_type": "T4", "gpu_ram_gb": 16}
            },
            "cpu_servers": {
                "stt": {"cpu_cores": 8, "ram_gb": 32},
                "ta": {"cpu_cores": 1, "ram_gb": 4},
                "qa": {"cpu_cores": 8, "ram_gb": 32}
            }
        }
    
    def _get_aws_instances(self) -> Dict[str, Any]:
        """AWS 인스턴스 데이터"""
        return {
            "g4dn.4xlarge": {
                "cpu_cores": 16, "ram_gb": 64, "gpu_type": "T4", "gpu_count": 1,
                "monthly_cost_krw": 1775520
            },
            "g4dn.8xlarge": {
                "cpu_cores": 32, "ram_gb": 128, "gpu_type": "T4", "gpu_count": 1,
                "monthly_cost_krw": 4693680
            },
            "m5a.16xlarge": {
                "cpu_cores": 64, "ram_gb": 256, "gpu_type": None, "gpu_count": 0,
                "monthly_cost_krw": 4308480
            },
            "c5.2xlarge": {
                "cpu_cores": 8, "ram_gb": 16, "gpu_type": None, "gpu_count": 0,
                "monthly_cost_krw": 253440
            }
        }
    
    def _get_ncp_instances(self) -> Dict[str, Any]:
        """NCP 인스턴스 데이터"""
        return {
            "g2-standard-16": {
                "cpu_cores": 16, "ram_gb": 64, "gpu_type": "V100", "gpu_count": 1,
                "monthly_cost_krw": 2700000
            },
            "g2-standard-32": {
                "cpu_cores": 32, "ram_gb": 128, "gpu_type": "V100", "gpu_count": 1,
                "monthly_cost_krw": 7440000
            },
            "c2-standard-64": {
                "cpu_cores": 64, "ram_gb": 256, "gpu_type": None, "gpu_count": 0,
                "monthly_cost_krw": 2688000
            },
            "c2-standard-8": {
                "cpu_cores": 8, "ram_gb": 32, "gpu_type": None, "gpu_count": 0,
                "monthly_cost_krw": 168000
            }
        }
    
    def calculate_service_loads(self, requirements: Dict[str, int]) -> Dict[str, Any]:
        """서비스 부하 계산"""
        service_loads = {
            'stt_channels': 0,
            'tts_channels': 0,
            'nlp_daily_queries': 0,
            'aicm_daily_queries': 0,
            'ta_daily_processing': 0,
            'qa_daily_evaluations': 0,
            'stt_breakdown': {'callbot': 0, 'advisor': 0, 'standalone': 0},
            'nlp_breakdown': {'callbot': 0, 'chatbot': 0, 'advisor': 0, 'ta': 0},
            'aicm_breakdown': {'callbot': 0, 'chatbot': 0, 'advisor': 0}
        }
        
        # 콜봇 처리
        if requirements.get('callbot', 0) > 0:
            callbot_stt = requirements['callbot'] * 1  # 1채널당 STT 1채널
            callbot_nlp = requirements['callbot'] * 3200  # 160콜 × 20쿼리
            callbot_aicm = requirements['callbot'] * 480   # 160콜 × 3쿼리
            
            service_loads['stt_channels'] += callbot_stt
            service_loads['stt_breakdown']['callbot'] = callbot_stt
            service_loads['tts_channels'] += requirements['callbot']
            service_loads['nlp_daily_queries'] += callbot_nlp
            service_loads['nlp_breakdown']['callbot'] = callbot_nlp
            service_loads['aicm_daily_queries'] += callbot_aicm
            service_loads['aicm_breakdown']['callbot'] = callbot_aicm
        
        # 챗봇 처리 (24시간 운영, 8세션/일)
        if requirements.get('chatbot', 0) > 0:
            chatbot_nlp = requirements['chatbot'] * 96  # 8세션 × 12쿼리
            chatbot_aicm = requirements['chatbot'] * 9.6  # 8세션 × 1.2쿼리
            
            service_loads['nlp_daily_queries'] += chatbot_nlp
            service_loads['nlp_breakdown']['chatbot'] = chatbot_nlp
            service_loads['aicm_daily_queries'] += chatbot_aicm
            service_loads['aicm_breakdown']['chatbot'] = chatbot_aicm
        
        # 어드바이저 처리
        if requirements.get('advisor', 0) > 0:
            advisor_stt = requirements['advisor'] * 2  # 1명당 STT 2채널
            advisor_nlp = requirements['advisor'] * 2400  # 160상담 × 15쿼리
            advisor_aicm = requirements['advisor'] * 1360  # 160상담 × 8.5쿼리
            
            service_loads['stt_channels'] += advisor_stt
            service_loads['stt_breakdown']['advisor'] = advisor_stt
            service_loads['nlp_daily_queries'] += advisor_nlp
            service_loads['nlp_breakdown']['advisor'] = advisor_nlp
            service_loads['aicm_daily_queries'] += advisor_aicm
            service_loads['aicm_breakdown']['advisor'] = advisor_aicm
        
        # 독립 STT/TTS
        if requirements.get('standalone_stt', 0) > 0:
            service_loads['stt_channels'] += requirements['standalone_stt']
            service_loads['stt_breakdown']['standalone'] = requirements['standalone_stt']
        
        if requirements.get('standalone_tts', 0) > 0:
            service_loads['tts_channels'] += requirements['standalone_tts']
        
        # TA 처리 (전체 대화 기록 분석)
        if requirements.get('ta', 0) > 0:
            total_conversations = (
                requirements.get('callbot', 0) * 160 +
                requirements.get('advisor', 0) * 160 +
                requirements.get('chatbot', 0) * 8
            )
            ta_nlp = requirements['ta'] * (total_conversations * 2)
            service_loads['ta_daily_processing'] += requirements['ta']
            service_loads['nlp_daily_queries'] += ta_nlp
            service_loads['nlp_breakdown']['ta'] = ta_nlp
        
        # QA 처리 
        if requirements.get('qa', 0) > 0:
            service_loads['qa_daily_evaluations'] += requirements['qa']  # [advice from AI] QA 채널 수를 직접 사용
        
        return service_loads
    
    def calculate_gpu_requirements(self, service_loads: Dict[str, Any], gpu_type: str = "auto") -> Dict[str, Any]:
        """GPU 요구사항 계산"""
        gpu_requirements = {'tts': 0, 'nlp': 0, 'aicm': 0}
        
        # [advice from AI] GPU 타입 정규화 - 소문자를 대문자로 변환
        if gpu_type == "auto":
            gpu_type = "T4"  # 기본값
        else:
            gpu_type = gpu_type.upper()  # 소문자를 대문자로 변환
        
        # TTS GPU 계산
        if service_loads['tts_channels'] > 0:
            tts_capacity = self.gpu_capacity[gpu_type]['tts_capacity']
            gpu_requirements['tts'] = math.ceil(service_loads['tts_channels'] / tts_capacity)
        
        # NLP GPU 계산
        if service_loads['nlp_daily_queries'] > 0:
            nlp_rate = self.gpu_capacity[gpu_type]['nlp_processing_rate']
            # 일일 쿼리를 초당 처리량으로 변환 (9시간 운영 기준)
            queries_per_second = service_loads['nlp_daily_queries'] / (9 * 3600)
            gpu_requirements['nlp'] = math.ceil(queries_per_second / nlp_rate)
        
        # AICM GPU 계산
        if service_loads['aicm_daily_queries'] > 0:
            aicm_rate = self.gpu_capacity[gpu_type]['aicm_search_rate']
            # 실시간 처리 기준
            queries_per_second = service_loads['aicm_daily_queries'] / (9 * 3600)
            gpu_requirements['aicm'] = math.ceil(queries_per_second / aicm_rate)
        
        return gpu_requirements
    
    def calculate_cpu_requirements(self, service_loads: Dict[str, Any]) -> Dict[str, float]:
        """CPU 요구사항 계산"""
        cpu_requirements = {'stt': 0, 'ta': 0, 'qa': 0}
        
        # STT CPU 계산
        if service_loads['stt_channels'] > 0:
            channels_per_core = self.correlation_matrix['cpu_requirements']['stt']['channels_per_core']
            cpu_requirements['stt'] = service_loads['stt_channels'] / channels_per_core
        
        # [advice from AI] TA CPU 계산 (배치 처리) - 사용자 정의 단계별 사양
        if service_loads['ta_daily_processing'] > 0:
            ta_channels = service_loads['ta_daily_processing']
            
            # 사용자 정의 단계별 사양
            if ta_channels <= 50:
                ta_cpu_cores = 8
                ta_ram_gb = 32
                ta_quantity = 1
            elif ta_channels <= 300:
                ta_cpu_cores = 16
                ta_ram_gb = 64
                ta_quantity = 1
            elif ta_channels <= 1000:
                ta_cpu_cores = 32
                ta_ram_gb = 128
                ta_quantity = 1
            else:
                # 1000채널 초과시 서버 대수 증가
                base_capacity = 1000  # 64코어 서버 1대당 처리 가능 채널
                ta_quantity = math.ceil(ta_channels / base_capacity)
                ta_cpu_cores = 64
                ta_ram_gb = 256
            
            # TA 사양 정보를 저장 (서버 생성 시 사용)
            cpu_requirements['ta'] = {
                'cpu_cores': ta_cpu_cores,
                'ram_gb': ta_ram_gb,
                'quantity': ta_quantity,
                'channels': ta_channels
            }
        
        # [advice from AI] QA CPU 계산 (배치 처리) - 사용자 정의 단계별 사양 (TA와 동일)
        if service_loads['qa_daily_evaluations'] > 0:
            qa_channels = service_loads['qa_daily_evaluations']
            
            # 사용자 정의 단계별 사양 (TA와 동일)
            if qa_channels <= 50:
                qa_cpu_cores = 8
                qa_ram_gb = 32
                qa_quantity = 1
            elif qa_channels <= 300:
                qa_cpu_cores = 16
                qa_ram_gb = 64
                qa_quantity = 1
            elif qa_channels <= 1000:
                qa_cpu_cores = 32
                qa_ram_gb = 128
                qa_quantity = 1
            else:
                # 1000채널 초과시 서버 대수 증가
                base_capacity = 1000  # 64코어 서버 1대당 처리 가능 채널
                qa_quantity = math.ceil(qa_channels / base_capacity)
                qa_cpu_cores = 64
                qa_ram_gb = 256
            
            # QA 사양 정보를 저장 (서버 생성 시 사용)
            cpu_requirements['qa'] = {
                'cpu_cores': qa_cpu_cores,
                'ram_gb': qa_ram_gb,
                'quantity': qa_quantity,
                'channels': qa_channels
            }
        
        return cpu_requirements
    
    def generate_hardware_specification(self, requirements: Dict[str, int]) -> Dict[str, Any]:
        """하드웨어 사양 생성"""
        # 서비스 부하 계산
        service_loads = self.calculate_service_loads(requirements)
        
        # GPU 요구사항 계산
        gpu_reqs = self.calculate_gpu_requirements(service_loads, requirements.get('gpu_type', 'auto'))
        
        # CPU 요구사항 계산
        cpu_reqs = self.calculate_cpu_requirements(service_loads)
        
        # 서버 구성 생성
        servers = []
        
        # GPU 서버들
        if gpu_reqs['tts'] > 0:
            servers.append({
                'name': f'TTS 서버 (T4)',
                'cpu_cores': 16,
                'ram_gb': 64,
                'gpu_type': 'T4',
                'gpu_ram_gb': 16,
                'gpu_quantity': 1,
                'storage_gb': 500,
                'quantity': gpu_reqs['tts'],
                'purpose': f'TTS 음성 합성 ({service_loads["tts_channels"]}채널)'
            })
        
        if gpu_reqs['nlp'] > 0:
            servers.append({
                'name': f'NLP 서버 (T4)',
                'cpu_cores': 32,
                'ram_gb': 60,
                'gpu_type': 'T4',
                'gpu_ram_gb': 16,
                'gpu_quantity': 1,
                'storage_gb': 500,
                'quantity': gpu_reqs['nlp'],
                'purpose': f'NLP 자연어 처리 (콜봇 {service_loads["nlp_breakdown"]["callbot"]:,.0f}쿼리/일 + 챗봇 {service_loads["nlp_breakdown"]["chatbot"]:,.0f}쿼리/일 + 어드바이저 {service_loads["nlp_breakdown"]["advisor"]:,.0f}쿼리/일 + TA {service_loads["nlp_breakdown"]["ta"]:,.0f}쿼리/일)'
            })
        
        if gpu_reqs['aicm'] > 0:
            servers.append({
                'name': f'AICM 서버 (T4)',
                'cpu_cores': 32,
                'ram_gb': 25,
                'gpu_type': 'T4',
                'gpu_ram_gb': 16,
                'gpu_quantity': 1,
                'storage_gb': 500,
                'quantity': gpu_reqs['aicm'],
                'purpose': f'AICM 벡터 검색 RAG (콜봇 {service_loads["aicm_breakdown"]["callbot"]:,.0f}쿼리/일 + 챗봇 {service_loads["aicm_breakdown"]["chatbot"]:,.0f}쿼리/일 + 어드바이저 {service_loads["aicm_breakdown"]["advisor"]:,.0f}쿼리/일)'
            })
        
        # CPU 서버들
        if cpu_reqs['stt'] > 0:
            stt_cores = math.ceil(cpu_reqs['stt'])
            stt_servers = math.ceil(stt_cores / 64)  # 64코어 서버 기준
            actual_cores = min(64, stt_cores)
            
            # STT 용도 설명 생성
            stt_deps = []
            if service_loads['stt_breakdown']['callbot'] > 0:
                stt_deps.append(f'콜봇 {service_loads["stt_breakdown"]["callbot"]}채널')
            if service_loads['stt_breakdown']['advisor'] > 0:
                advisor_count = service_loads['stt_breakdown']['advisor'] // 2
                stt_deps.append(f'어드바이저 {service_loads["stt_breakdown"]["advisor"]}채널({advisor_count}명×2)')
            if service_loads['stt_breakdown']['standalone'] > 0:
                stt_deps.append(f'독립 STT {service_loads["stt_breakdown"]["standalone"]}채널')
            
            stt_purpose = f'음성 인식 전용 (1코어당 6.5채널, 총 {actual_cores}코어) - {" + ".join(stt_deps)}'
            
            servers.append({
                'name': f'STT 서버 ({actual_cores}코어)',
                'cpu_cores': actual_cores,
                'ram_gb': actual_cores * 2,  # 코어당 2GB
                'gpu_type': None,
                'gpu_ram_gb': 0,
                'gpu_quantity': 0,
                'storage_gb': 500,
                'quantity': stt_servers,
                'purpose': stt_purpose
            })
        
        if cpu_reqs.get('ta'):
            # [advice from AI] TA 서버 - 사용자 정의 단계별 사양
            ta_spec = cpu_reqs['ta']
            ta_cpu_cores = ta_spec['cpu_cores']
            ta_ram_gb = ta_spec['ram_gb']
            ta_quantity = ta_spec['quantity']
            ta_channels = ta_spec['channels']
            ta_storage_gb = max(1000, ta_cpu_cores * 32)  # 코어당 32GB, 최소 1TB
            
            servers.append({
                'name': f'TA CPU 서버 ({ta_cpu_cores}코어)',
                'cpu_cores': ta_cpu_cores,
                'ram_gb': ta_ram_gb,
                'gpu_type': None,
                'gpu_ram_gb': 0,
                'gpu_quantity': 0,
                'storage_gb': ta_storage_gb,
                'quantity': ta_quantity,
                'purpose': f'TA {ta_channels}채널 분석 처리 (배치 처리, NLP 연동)'
            })
        
        if cpu_reqs.get('qa'):
            # [advice from AI] QA 서버 - 사용자 정의 단계별 사양 (TA와 동일)
            qa_spec = cpu_reqs['qa']
            qa_cpu_cores = qa_spec['cpu_cores']
            qa_ram_gb = qa_spec['ram_gb']
            qa_quantity = qa_spec['quantity']
            qa_channels = qa_spec['channels']
            qa_storage_gb = max(1000, qa_cpu_cores * 32)  # 코어당 32GB, 최소 1TB
            
            servers.append({
                'name': f'QA 서버 ({qa_cpu_cores}코어)',
                'cpu_cores': qa_cpu_cores,
                'ram_gb': qa_ram_gb,
                'gpu_type': None,
                'gpu_ram_gb': 0,
                'gpu_quantity': 0,
                'storage_gb': qa_storage_gb,
                'quantity': qa_quantity,
                'purpose': f'QA {qa_channels}채널 품질 평가 (외부 LLM 기반, 배치 처리)'
            })
        
        # [advice from AI] 인프라 서버들 추가 - 스크린샷 기준으로 필수 인프라 구성
        # 기본 인프라 서버들 (항상 필요)
        infrastructure_servers = [
            {
                'name': 'Nginx 서버 (16코어)',
                'cpu_cores': 16,
                'ram_gb': 32,
                'gpu_type': None,
                'gpu_ram_gb': 0,
                'gpu_quantity': 0,
                'storage_gb': 500,
                'quantity': 1,
                'purpose': '로드 밸런서 (전체 1100채널: 콜봇, 챗봇, 어드바이저, TA, QA)'
            },
            {
                'name': 'API Gateway 서버 (16코어)',
                'cpu_cores': 16,
                'ram_gb': 32,
                'gpu_type': None,
                'gpu_ram_gb': 0,
                'gpu_quantity': 0,
                'storage_gb': 500,
                'quantity': 2,
                'purpose': 'API 라우팅 (전체 1100채널: 콜봇, 챗봇, 어드바이저, TA, QA) (총 32코어, 이중화)'
            },
            {
                'name': 'PostgreSQL 서버 (32코어)',
                'cpu_cores': 32,
                'ram_gb': 128,
                'gpu_type': None,
                'gpu_ram_gb': 0,
                'gpu_quantity': 0,
                'storage_gb': 5500,
                'quantity': 1,
                'purpose': '데이터 저장 (전체 1100채널: 콜봇, 챗봇, 어드바이저, TA, QA) (총 8코어)'
            },
            {
                'name': 'VectorDB 서버 (8코어)',
                'cpu_cores': 8,
                'ram_gb': 32,
                'gpu_type': None,
                'gpu_ram_gb': 0,
                'gpu_quantity': 0,
                'storage_gb': 500,
                'quantity': 1,
                'purpose': '벡터 검색 (어드바이저 정보) (전체 1100채널: 콜봇, 챗봇, 어드바이저, TA, QA) (총 8코어)'
            },
            {
                'name': 'Auth Service 서버 (8코어)',
                'cpu_cores': 8,
                'ram_gb': 16,
                'gpu_type': None,
                'gpu_ram_gb': 0,
                'gpu_quantity': 0,
                'storage_gb': 500,
                'quantity': 1,
                'purpose': '인증 관리 (전체 1100채널: 콜봇, 챗봇, 어드바이저, TA, QA) (총 8코어)'
            },
            {
                'name': 'NAS 서버 (8코어)',
                'cpu_cores': 8,
                'ram_gb': 16,
                'gpu_type': None,
                'gpu_ram_gb': 0,
                'gpu_quantity': 0,
                'storage_gb': 5500,
                'quantity': 1,
                'purpose': '네트워크 스토리지 (총 5000일, 5.5TB) (총 8코어)'
            }
        ]
        
        # 인프라 서버들을 메인 서버 목록에 추가
        servers.extend(infrastructure_servers)
        
        return {
            'servers': servers,
            'service_loads': service_loads,
            'gpu_requirements': gpu_reqs,
            'cpu_requirements': cpu_reqs
        }
    
    def map_to_cloud_instances(self, servers: List[Dict[str, Any]]) -> Tuple[List[Dict], List[Dict]]:
        """클라우드 인스턴스 매핑"""
        aws_instances = []
        ncp_instances = []
        
        for server in servers:
            # AWS 매핑
            if server['gpu_type']:
                # GPU 서버
                if server['gpu_type'] == 'T4':
                    aws_instance = 'g4dn.8xlarge'
                else:
                    aws_instance = 'g4dn.8xlarge'
            else:
                # CPU 서버
                if server['cpu_cores'] <= 8:
                    aws_instance = 'c5.2xlarge'
                else:
                    aws_instance = 'm5a.16xlarge'
            
            aws_spec = self.aws_instances[aws_instance]
            aws_instances.append({
                'server_type': server['name'],
                'instance_type': aws_instance,
                'cpu_cores': aws_spec['cpu_cores'],
                'ram_gb': aws_spec['ram_gb'],
                'gpu_info': f"{aws_spec['gpu_count']}x {aws_spec['gpu_type']}" if aws_spec['gpu_type'] else None,
                'monthly_cost_krw': aws_spec['monthly_cost_krw'],
                'quantity': server['quantity'],
                'total_cost_krw': aws_spec['monthly_cost_krw'] * server['quantity']
            })
            
            # NCP 매핑
            if server['gpu_type']:
                ncp_instance = 'g2-standard-32'
            else:
                if server['cpu_cores'] <= 8:
                    ncp_instance = 'c2-standard-8'
                else:
                    ncp_instance = 'c2-standard-64'
            
            ncp_spec = self.ncp_instances[ncp_instance]
            ncp_instances.append({
                'server_type': server['name'],
                'instance_type': ncp_instance,
                'cpu_cores': ncp_spec['cpu_cores'],
                'ram_gb': ncp_spec['ram_gb'],
                'gpu_info': f"{ncp_spec['gpu_count']}x {ncp_spec['gpu_type']}" if ncp_spec['gpu_type'] else None,
                'monthly_cost_krw': ncp_spec['monthly_cost_krw'],
                'quantity': server['quantity'],
                'total_cost_krw': ncp_spec['monthly_cost_krw'] * server['quantity']
            })
        
        return aws_instances, ncp_instances
    
    def calculate_complete_hardware_spec(self, requirements: Dict[str, int]) -> Dict[str, Any]:
        """완전한 하드웨어 사양 계산"""
        try:
            # 하드웨어 사양 생성
            hardware_result = self.generate_hardware_specification(requirements)
            
            # 클라우드 인스턴스 매핑
            aws_instances, ncp_instances = self.map_to_cloud_instances(hardware_result['servers'])
            
            # 비용 분석
            aws_total_cost = sum(instance['total_cost_krw'] for instance in aws_instances)
            ncp_total_cost = sum(instance['total_cost_krw'] for instance in ncp_instances)
            
            # 서버 타입별 분류
            gpu_servers = [s for s in hardware_result['servers'] if s['gpu_type']]
            cpu_servers = [s for s in hardware_result['servers'] if not s['gpu_type'] and ('STT' in s['name'] or 'TA' in s['name'] or 'QA' in s['name'])]
            infrastructure_servers = [s for s in hardware_result['servers'] if not s['gpu_type'] and not any(x in s['name'] for x in ['STT', 'TA', 'QA'])]
            
            return {
                'success': True,
                'message': '하드웨어 계산 완료',
                'input_data': requirements,
                'hardware_specification': {
                    'gpu_servers': gpu_servers,
                    'cpu_servers': cpu_servers,
                    'infrastructure_servers': infrastructure_servers
                },
                'aws_instances': aws_instances,
                'ncp_instances': ncp_instances,
                'cost_analysis': {
                    'aws_total_monthly_cost': aws_total_cost,
                    'ncp_total_monthly_cost': ncp_total_cost,
                    'cost_difference': aws_total_cost - ncp_total_cost,
                    'service_loads': hardware_result['service_loads']
                }
            }
            
        except Exception as e:
            logger.error(f"하드웨어 계산 오류: {e}")
            return {
                'success': False,
                'error': str(e),
                'input_data': requirements
            }
