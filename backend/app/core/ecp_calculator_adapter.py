# [advice from AI] ECP 하드웨어 계산 엔진 어댑터
"""
기존 ECP 하드웨어 계산 엔진과의 연동을 위한 어댑터
- ECPHardwareCalculator 래핑
- AWS/NCP 인스턴스 매핑
- MSP 비용 계산
"""

import sys
from pathlib import Path
from typing import Dict, Any, Tuple, Optional, List
import structlog

# 기존 모듈 경로 추가
sys.path.append(str(Path(__file__).parent.parent / "models"))
sys.path.append(str(Path(__file__).parent.parent / "config"))

logger = structlog.get_logger(__name__)

class ECPCalculatorAdapter:
    """ECP 하드웨어 계산 엔진 어댑터"""
    
    def __init__(self):
        """어댑터 초기화"""
        try:
            from calculator import ECPHardwareCalculator
            from aws_mapper import AWSInstanceMapper  
            from ncp_mapper import NCPInstanceMapper
            from msp_calculator import MSPCalculator
            
            # 설정 파일 경로 지정
            config_path = str(Path(__file__).parent.parent / "config")
            
            self.hardware_calculator = ECPHardwareCalculator(config_path)
            self.aws_mapper = AWSInstanceMapper(config_path)
            self.ncp_mapper = NCPInstanceMapper(config_path)
            self.msp_calculator = MSPCalculator(config_path)
            
            logger.info("ECP Calculator Adapter 초기화 완료")
            
        except Exception as e:
            logger.error("ECP Calculator 초기화 실패", error=str(e))
            self.hardware_calculator = None
            self.aws_mapper = None
            self.ncp_mapper = None
            self.msp_calculator = None
    
    def generate_detailed_hardware_spec(self, 
                                      service_requirements: Dict[str, int],
                                      gpu_type: str = "t4") -> Dict[str, Any]:
        """상세 하드웨어 사양 생성"""
        try:
            if not self.hardware_calculator:
                return self._generate_fallback_spec(service_requirements, gpu_type)
                
            logger.info("상세 하드웨어 사양 생성 시작", 
                       service_requirements=service_requirements, gpu_type=gpu_type)
                
            # 기존 계산 엔진 호출
            resources, hardware_spec = self.hardware_calculator.calculate_hardware_requirements(
                service_requirements, gpu_type
            )
            
            # 서버 구성 테이블 생성
            server_config_table = self.hardware_calculator.generate_server_config_table(hardware_spec)
            
            result = {
                "success": True,
                "gpu_type": gpu_type,
                "service_requirements": service_requirements,
                "resource_calculation": {
                    "gpu": resources.gpu,
                    "cpu": resources.cpu,
                    "network": resources.network,
                    "storage": resources.storage,
                    "infrastructure": resources.infrastructure,
                    "channels": {
                        "stt_channels": resources.stt_channels,
                        "tts_channels": resources.tts_channels,
                        "ta_channels": resources.ta_channels,
                        "qa_channels": resources.qa_channels
                    },
                    "breakdown": {
                        "stt_breakdown": resources.stt_breakdown,
                        "nlp_breakdown": resources.nlp_breakdown,
                        "aicm_breakdown": resources.aicm_breakdown,
                        "infra_breakdown": resources.infra_breakdown
                    }
                },
                "hardware_specification": {
                    "gpu_servers": hardware_spec.gpu_servers,
                    "cpu_servers": hardware_spec.cpu_servers,
                    "storage_servers": hardware_spec.storage_servers,
                    "infrastructure_servers": hardware_spec.infrastructure_servers,
                    "network_requirements": hardware_spec.network_requirements,
                    "infrastructure_notes": hardware_spec.infrastructure_notes
                },
                "server_config_table": server_config_table,
                "summary": {
                    "total_gpu_count": resources.gpu.get('total', 0),
                    "total_cpu_cores": resources.cpu.get('total', 0),
                    "total_servers": len(hardware_spec.gpu_servers) + len(hardware_spec.cpu_servers) + len(hardware_spec.infrastructure_servers),
                    "estimated_power_kw": self._estimate_power_consumption(resources, hardware_spec),
                    "network_bandwidth": hardware_spec.network_requirements
                }
            }
            
            logger.info("상세 하드웨어 사양 생성 완료", 
                       total_gpus=result["summary"]["total_gpu_count"],
                       total_servers=result["summary"]["total_servers"])
            
            return result
            
        except Exception as e:
            logger.error("상세 하드웨어 사양 생성 실패", error=str(e))
            return self._generate_fallback_spec(service_requirements, gpu_type)
    
    def compare_gpu_options(self, service_requirements: Dict[str, int]) -> Dict[str, Any]:
        """GPU 옵션별 비교 분석"""
        try:
            if not self.hardware_calculator:
                return self._generate_fallback_comparison(service_requirements)
                
            logger.info("GPU 옵션 비교 분석 시작", service_requirements=service_requirements)
                
            comparison = self.hardware_calculator.compare_gpu_options(service_requirements)
            
            result = {
                "success": True,
                "service_requirements": service_requirements,
                "gpu_comparisons": comparison,
                "recommendation": comparison.get("recommendation", "t4"),
                "analysis": {
                    "t4": {
                        "pros": ["가격 효율적", "소규모 환경 적합", "낮은 전력 소모"],
                        "cons": ["제한된 메모리 (16GB)", "낮은 처리 성능"],
                        "best_for": "100채널 이하, 개발/테스트 환경"
                    },
                    "v100": {
                        "pros": ["균형잡힌 성능", "중간 규모 적합", "32GB 메모리"],
                        "cons": ["높은 전력 소모", "비용 증가"],
                        "best_for": "100-500채널, 중간 규모 운영"
                    },
                    "l40s": {
                        "pros": ["최고 성능", "대규모 환경", "48GB 메모리"],
                        "cons": ["높은 비용", "복잡한 관리", "높은 전력"],
                        "best_for": "500채널 이상, 대규모 운영"
                    }
                },
                "cost_analysis": self._generate_cost_analysis(comparison)
            }
            
            logger.info("GPU 옵션 비교 완료", recommendation=result["recommendation"])
            return result
            
        except Exception as e:
            logger.error("GPU 옵션 비교 실패", error=str(e))
            return self._generate_fallback_comparison(service_requirements)
    
    def get_cloud_instance_mapping(self, 
                                 service_requirements: Dict[str, int],
                                 gpu_type: str = "t4",
                                 cloud_provider: str = "aws") -> Dict[str, Any]:
        """클라우드 인스턴스 매핑"""
        try:
            logger.info("클라우드 인스턴스 매핑 시작", 
                       cloud_provider=cloud_provider, gpu_type=gpu_type)
            
            # 먼저 하드웨어 사양 계산
            resources, hardware_spec = self.hardware_calculator.calculate_hardware_requirements(
                service_requirements, gpu_type
            )
            
            if cloud_provider == "aws" and self.aws_mapper:
                mapping = self.aws_mapper.map_to_aws_instances(hardware_spec)
            elif cloud_provider == "ncp" and self.ncp_mapper:
                mapping = self.ncp_mapper.map_to_ncp_instances(hardware_spec)
            else:
                return self._generate_fallback_mapping(service_requirements, gpu_type, cloud_provider)
            
            # MSP 비용 계산
            if self.msp_calculator:
                cost_analysis = self.msp_calculator.calculate_msp_costs(mapping, cloud_provider)
            else:
                cost_analysis = {"monthly_cost": 0, "yearly_cost": 0}
                
            result = {
                "success": True,
                "cloud_provider": cloud_provider,
                "gpu_type": gpu_type,
                "service_requirements": service_requirements,
                "instance_mapping": mapping,
                "cost_analysis": cost_analysis,
                "recommendations": {
                    "cost_optimization": self._generate_cost_optimization_tips(mapping, cloud_provider),
                    "scaling_strategy": self._generate_scaling_strategy(resources),
                    "monitoring_setup": self._generate_monitoring_recommendations(hardware_spec)
                }
            }
            
            logger.info("클라우드 인스턴스 매핑 완료", 
                       provider=cloud_provider, 
                       estimated_monthly_cost=cost_analysis.get("monthly_cost", 0))
            
            return result
            
        except Exception as e:
            logger.error("클라우드 인스턴스 매핑 실패", error=str(e))
            return self._generate_fallback_mapping(service_requirements, gpu_type, cloud_provider)
    
    def _estimate_power_consumption(self, resources, hardware_spec) -> float:
        """전력 소모 추정"""
        total_power = 0.0
        
        # GPU 서버 전력
        for server in hardware_spec.gpu_servers:
            gpu_power = server.get('gpu_per_server', 1) * 250  # GPU당 250W
            cpu_power = server.get('cpu_cores', 32) * 3  # CPU 코어당 3W
            total_power += (gpu_power + cpu_power) * server.get('count', 1)
        
        # CPU 서버 전력
        for server in hardware_spec.cpu_servers:
            cpu_power = server.get('cpu_cores', 8) * 3
            total_power += cpu_power * server.get('count', 1)
        
        # 인프라 서버 전력
        for server in hardware_spec.infrastructure_servers:
            cpu_power = server.get('cpu_cores', 4) * 3
            total_power += cpu_power * server.get('count', 1)
        
        return round(total_power / 1000, 2)  # kW 단위
    
    def _generate_cost_analysis(self, comparison: Dict[str, Any]) -> Dict[str, Any]:
        """비용 분석 생성"""
        base_costs = {"t4": 0.526, "v100": 3.06, "l40s": 2.414}  # 시간당 USD
        
        cost_analysis = {}
        for gpu_type, data in comparison.items():
            if gpu_type == "recommendation":
                continue
                
            gpu_count = data.get("gpu_count", 1)
            hourly_cost = base_costs.get(gpu_type, 1.0) * gpu_count
            
            cost_analysis[gpu_type] = {
                "hourly_usd": round(hourly_cost, 2),
                "daily_usd": round(hourly_cost * 24, 2),
                "monthly_usd": round(hourly_cost * 24 * 30, 2),
                "yearly_usd": round(hourly_cost * 24 * 365, 2)
            }
        
        return cost_analysis
    
    def _generate_cost_optimization_tips(self, mapping: Dict[str, Any], provider: str) -> List[str]:
        """비용 최적화 팁 생성"""
        tips = [
            "Reserved Instance 사용으로 최대 75% 비용 절감",
            "Spot Instance 활용으로 개발/테스트 환경 비용 절감",
            "자동 스케일링 설정으로 유휴 리소스 최소화"
        ]
        
        if provider == "aws":
            tips.extend([
                "AWS Savings Plans 고려",
                "CloudWatch로 리소스 사용률 모니터링"
            ])
        elif provider == "ncp":
            tips.extend([
                "NCP 약정 할인 프로그램 활용",
                "Cloud Insight로 비용 모니터링"
            ])
        
        return tips
    
    def _generate_scaling_strategy(self, resources) -> Dict[str, Any]:
        """스케일링 전략 생성"""
        return {
            "horizontal_scaling": {
                "gpu_services": "TTS, NLP, AICM 서비스는 수평 확장 가능",
                "cpu_services": "STT, TA, QA 서비스는 인스턴스 추가로 확장",
                "trigger_metrics": ["CPU 사용률 > 70%", "GPU 사용률 > 80%", "응답 시간 > 500ms"]
            },
            "vertical_scaling": {
                "database": "PostgreSQL, VectorDB는 수직 확장 우선",
                "infrastructure": "Nginx, Gateway는 로드밸런서 추가",
                "trigger_metrics": ["메모리 사용률 > 85%", "디스크 I/O 대기시간 증가"]
            },
            "auto_scaling_rules": {
                "scale_out": "평균 사용률 > 70% for 5분",
                "scale_in": "평균 사용률 < 30% for 10분",
                "cooldown": "스케일링 후 5분 대기"
            }
        }
    
    def _generate_monitoring_recommendations(self, hardware_spec) -> List[str]:
        """모니터링 권장사항 생성"""
        return [
            "Prometheus + Grafana 모니터링 스택 구축",
            "GPU 메모리, 온도, 사용률 실시간 모니터링",
            "서비스별 응답 시간, 처리량 메트릭 수집",
            "로그 중앙 집중화 (ELK Stack 또는 Fluentd)",
            "알림 설정: CPU > 80%, GPU > 85%, 디스크 > 90%",
            "백업 및 재해 복구 계획 수립",
            "보안 모니터링 (네트워크 트래픽, 접근 로그)"
        ]
    
    def _generate_fallback_spec(self, service_requirements: Dict[str, int], gpu_type: str) -> Dict[str, Any]:
        """폴백 하드웨어 사양"""
        total_channels = sum(v for v in service_requirements.values() if isinstance(v, (int, float)))
        
        return {
            "success": True,
            "fallback": True,
            "gpu_type": gpu_type,
            "service_requirements": service_requirements,
            "resource_calculation": {
                "gpu": {"total": max(1, total_channels // 50)},
                "cpu": {"total": max(4, total_channels // 10)},
                "network": {"total_mbps": max(100, total_channels * 5)},
                "storage": {"total_tb": max(1, total_channels * 0.01)}
            },
            "server_config_table": [
                {
                    "role": f"GPU 서버 ({gpu_type.upper()})",
                    "cpu_cores": 32,
                    "ram_gb": 64,
                    "quantity": 1,
                    "gpu_type": gpu_type.upper(),
                    "gpu_quantity": max(1, total_channels // 50)
                }
            ],
            "summary": {
                "total_gpu_count": max(1, total_channels // 50),
                "total_cpu_cores": max(4, total_channels // 10),
                "total_servers": 3,
                "estimated_power_kw": 2.5
            }
        }
    
    def _generate_fallback_comparison(self, service_requirements: Dict[str, int]) -> Dict[str, Any]:
        """폴백 GPU 비교"""
        return {
            "success": True,
            "fallback": True,
            "service_requirements": service_requirements,
            "recommendation": "t4",
            "gpu_comparisons": {
                "t4": {"gpu_count": 2, "server_count": 1, "efficiency_score": 8.5},
                "v100": {"gpu_count": 1, "server_count": 1, "efficiency_score": 7.2},
                "l40s": {"gpu_count": 1, "server_count": 1, "efficiency_score": 9.1}
            }
        }
    
    def _generate_fallback_mapping(self, service_requirements: Dict[str, int], 
                                 gpu_type: str, cloud_provider: str) -> Dict[str, Any]:
        """폴백 클라우드 매핑"""
        return {
            "success": True,
            "fallback": True,
            "cloud_provider": cloud_provider,
            "gpu_type": gpu_type,
            "instance_mapping": {
                "gpu_instances": [f"g4dn.xlarge ({gpu_type})"],
                "cpu_instances": ["c5.2xlarge"],
                "estimated_monthly_cost": 1200
            }
        }
