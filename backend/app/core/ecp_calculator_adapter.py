# [advice from AI] ECP 하드웨어 계산 엔진 어댑터 - Server Resource Generator 클라이언트로 전환
"""
Server Resource Generator 클라이언트 래퍼
- 기존 ECP Calculator Adapter 인터페이스 유지
- 새로운 독립 서비스와 HTTP 통신
- 기존 코드와의 호환성 보장
"""

from typing import Dict, Any, Tuple, Optional, List
import structlog
from .hardware_calculator_client import HardwareCalculatorClient

logger = structlog.get_logger(__name__)

class ECPCalculatorAdapter:
    """ECP 하드웨어 계산 엔진 어댑터 - Server Resource Generator 클라이언트 래퍼"""
    
    def __init__(self, base_url: str = None):
        """
        어댑터 초기화
        
        Args:
            base_url: Server Resource Generator 서비스 URL
        """
        try:
            # 환경변수에서 URL 가져오기, 없으면 기본값 사용
            import os
            if base_url is None:
                base_url = os.getenv("HARDWARE_CALCULATOR_URL", "http://localhost:2992")
            
            # 새로운 하드웨어 계산 클라이언트 초기화
            self.hardware_client = HardwareCalculatorClient(base_url)
            
            logger.info("ECP Calculator Adapter 초기화 완료 - Server Resource Generator 클라이언트 모드", 
                       base_url=base_url)
            
        except Exception as e:
            logger.error("ECP Calculator Adapter 초기화 실패", error=str(e))
            self.hardware_client = None
    
    def generate_detailed_hardware_spec(self, 
                                      service_requirements: Dict[str, int],
                                      gpu_type: str = "t4") -> Dict[str, Any]:
        """상세 하드웨어 사양 생성 - Server Resource Generator 클라이언트 위임"""
        try:
            if not self.hardware_client:
                return self._generate_fallback_spec(service_requirements, gpu_type)
                
            logger.info("상세 하드웨어 사양 생성 시작 - 새로운 서비스 호출", 
                       service_requirements=service_requirements, gpu_type=gpu_type)
                
            # 새로운 하드웨어 계산 클라이언트 호출
            result = self.hardware_client.generate_detailed_hardware_spec(service_requirements, gpu_type)
            
            logger.info("상세 하드웨어 사양 생성 완료", 
                       success=result.get("success"),
                       total_gpus=result.get("summary", {}).get("total_gpu_count", 0))
            
            return result
            
        except Exception as e:
            logger.error("상세 하드웨어 사양 생성 실패", error=str(e))
            return self._generate_fallback_spec(service_requirements, gpu_type)
    
    def compare_gpu_options(self, service_requirements: Dict[str, int]) -> Dict[str, Any]:
        """GPU 옵션별 비교 분석 - Server Resource Generator 클라이언트 위임"""
        try:
            if not self.hardware_client:
                return self._generate_fallback_comparison(service_requirements)
                
            logger.info("GPU 옵션 비교 분석 시작 - 새로운 서비스 호출", service_requirements=service_requirements)
                
            result = self.hardware_client.compare_gpu_options(service_requirements)
            
            logger.info("GPU 옵션 비교 완료", 
                       success=result.get("success"),
                       recommendation=result.get("recommendation"))
            return result
            
        except Exception as e:
            logger.error("GPU 옵션 비교 실패", error=str(e))
            return self._generate_fallback_comparison(service_requirements)
    
    def get_cloud_instance_mapping(self, 
                                 service_requirements: Dict[str, int],
                                 gpu_type: str = "t4",
                                 cloud_provider: str = "aws") -> Dict[str, Any]:
        """클라우드 인스턴스 매핑 - Server Resource Generator 클라이언트 위임"""
        try:
            if not self.hardware_client:
                return self._generate_fallback_mapping(service_requirements, gpu_type, cloud_provider)
                
            logger.info("클라우드 인스턴스 매핑 시작 - 새로운 서비스 호출", 
                       cloud_provider=cloud_provider, gpu_type=gpu_type)
            
            result = self.hardware_client.get_cloud_instance_mapping(
                service_requirements, gpu_type, cloud_provider
            )
            
            logger.info("클라우드 인스턴스 매핑 완료", 
                       provider=cloud_provider,
                       success=result.get("success"))
            
            return result
            
        except Exception as e:
            logger.error("클라우드 인스턴스 매핑 실패", error=str(e))
            return self._generate_fallback_mapping(service_requirements, gpu_type, cloud_provider)
    
    def optimize_for_cloud_provider(self, 
                                   service_requirements: Dict[str, int],
                                   gpu_type: str = "t4",
                                   cloud_provider: str = "aws") -> Dict[str, Any]:
        """
        클라우드 제공업체별 최적화 추천 - 기본 구현
        """
        try:
            logger.info("클라우드 최적화 분석 시작", 
                       cloud_provider=cloud_provider, gpu_type=gpu_type)
            
            # 기본 하드웨어 스펙 생성
            base_spec = self.generate_detailed_hardware_spec(service_requirements, gpu_type)
            if not base_spec.get("success", False):
                return base_spec
            
            # 간단한 최적화 권장사항 제공
            optimization_result = {
                "success": True,
                "cloud_provider": cloud_provider,
                "base_specification": base_spec,
                "optimizations": self._get_basic_optimizations(cloud_provider),
                "cost_analysis": {
                    "potential_savings": "월 20-40% 비용 절약 가능",
                    "optimization_areas": ["인스턴스 타입", "스토리지", "네트워킹"]
                },
                "recommendations": self._get_basic_recommendations(cloud_provider)
            }
            
            logger.info("클라우드 최적화 분석 완료", 
                       cloud_provider=cloud_provider,
                       optimizations_count=len(optimization_result["optimizations"]))
            
            return optimization_result
            
        except Exception as e:
            logger.error("클라우드 최적화 실패", error=str(e))
            return {
                "success": False,
                "error": str(e),
                "cloud_provider": cloud_provider
            }
    
    # ==========================================
    # 폴백 및 유틸리티 메서드들
    # ==========================================
    
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
            "hardware_specification": {
                "gpu_servers": [{
                    "name": f"GPU 서버 ({gpu_type.upper()})",
                    "cpu_cores": 32,
                    "ram_gb": 64,
                    "gpu_type": gpu_type.upper(),
                    "gpu_quantity": max(1, total_channels // 50),
                    "quantity": 1,
                    "purpose": f"통합 GPU 처리 ({total_channels}채널)"
                }],
                "cpu_servers": [{
                    "name": "CPU 서버 (16코어)",
                    "cpu_cores": 16,
                    "ram_gb": 32,
                    "quantity": max(1, total_channels // 20),
                    "purpose": f"CPU 처리 ({total_channels}채널)"
                }],
                "infrastructure_servers": []
            },
            "summary": {
                "total_gpu_count": max(1, total_channels // 50),
                "total_cpu_cores": max(4, total_channels // 10),
                "total_servers": 2,
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
            },
            "analysis": {
                "t4": {"pros": ["가격 효율적"], "cons": ["제한된 성능"], "best_for": "소규모 환경"},
                "v100": {"pros": ["균형잡힌 성능"], "cons": ["높은 비용"], "best_for": "중간 규모"},
                "l40s": {"pros": ["최고 성능"], "cons": ["높은 비용"], "best_for": "대규모 환경"}
            }
        }
    
    def _generate_fallback_mapping(self, service_requirements: Dict[str, int], 
                                 gpu_type: str, cloud_provider: str) -> Dict[str, Any]:
        """폴백 클라우드 매핑"""
        total_channels = sum(v for v in service_requirements.values() if isinstance(v, (int, float)))
        
        return {
            "success": True,
            "fallback": True,
            "cloud_provider": cloud_provider,
            "gpu_type": gpu_type,
            "instance_mapping": [
                {
                    "instance_type": "g4dn.xlarge" if cloud_provider == "aws" else "g2-standard-16",
                    "quantity": max(1, total_channels // 50),
                    "monthly_cost_krw": 1500000 if cloud_provider == "aws" else 2000000
                }
            ],
            "cost_analysis": {
                "monthly_cost": 1500000 if cloud_provider == "aws" else 2000000,
                "yearly_cost": (1500000 if cloud_provider == "aws" else 2000000) * 12
            },
            "recommendations": {
                "cost_optimization": ["Reserved Instance 사용"],
                "scaling_strategy": {"horizontal_scaling": "수평 확장 가능"},
                "monitoring_setup": ["기본 모니터링 설정"]
            }
        }
    
    def _get_basic_optimizations(self, cloud_provider: str) -> List[Dict[str, str]]:
        """기본 최적화 권장사항"""
        if cloud_provider == "aws":
            return [
                {
                    "type": "instance_optimization",
                    "description": "Reserved Instance 사용 권장",
                    "cost_impact": "월 30-50% 절약 가능"
                },
                {
                    "type": "spot_instances", 
                    "description": "개발/테스트용 Spot Instance 활용",
                    "cost_impact": "월 50-70% 절약 가능"
                }
            ]
        elif cloud_provider == "ncp":
            return [
                {
                    "type": "commitment_discount",
                    "description": "NCP 약정 할인 프로그램 활용",
                    "cost_impact": "월 20-30% 절약 가능"
                }
            ]
        else:
            return [
                {
                    "type": "resource_optimization",
                    "description": "리소스 사용률 최적화",
                    "cost_impact": "월 15-25% 절약 가능"
                }
            ]
    
    def _get_basic_recommendations(self, cloud_provider: str) -> List[str]:
        """기본 권장사항"""
        base_recommendations = [
            "모니터링 시스템 구축 권장",
            "자동 스케일링 설정 고려",
            "백업 및 재해 복구 계획 수립"
        ]
        
        if cloud_provider == "aws":
            base_recommendations.extend([
                "CloudWatch 모니터링 활용",
                "AWS Savings Plans 검토"
            ])
        elif cloud_provider == "ncp":
            base_recommendations.extend([
                "Cloud Insight 모니터링 활용",
                "NCP 기술 지원 서비스 활용"
            ])
        
        return base_recommendations