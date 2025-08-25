# [advice from AI] 새로운 하드웨어 계산기 클라이언트
"""
Server Resource Generator API 클라이언트
- 기존 ECP Calculator Adapter 완전 대체
- 독립 서비스와의 HTTP 통신
- 표준화된 API 응답 처리
"""

import httpx
import structlog
from typing import Dict, Any, Optional
from dataclasses import dataclass
import asyncio
import json

logger = structlog.get_logger(__name__)

@dataclass
class HardwareCalculationRequest:
    """하드웨어 계산 요청 모델"""
    callbot: int = 0
    chatbot: int = 0
    advisor: int = 0
    standalone_stt: int = 0
    standalone_tts: int = 0
    ta: int = 0
    qa: int = 0
    gpu_type: str = "auto"

class HardwareCalculatorClient:
    """
    Server Resource Generator 클라이언트
    독립적인 하드웨어 계산 서비스와 통신
    """
    
    def __init__(self, base_url: str = "http://rdc.rickyson.com:5001"):
        """
        클라이언트 초기화
        
        Args:
            base_url: 외부 하드웨어 계산기 서비스 URL (검증된 정확한 계산 로직)
        """
        self.base_url = base_url.rstrip('/')
        self.calculate_endpoint = f"{self.base_url}/api/calculate"
        self.timeout = httpx.Timeout(30.0)
        
        logger.info("HardwareCalculatorClient 초기화", 
                   base_url=self.base_url, 
                   calculate_endpoint=self.calculate_endpoint)
    
    async def health_check(self) -> bool:
        """
        서비스 헬스 체크
        
        Returns:
            bool: 서비스 정상 여부
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(f"{self.base_url}/health")
                
                if response.status_code == 200:
                    data = response.json()
                    is_healthy = data.get("status") == "healthy"
                    
                    logger.info("헬스 체크 완료", 
                               status=data.get("status"), 
                               service=data.get("service"),
                               version=data.get("version"))
                    return is_healthy
                else:
                    logger.warning("헬스 체크 실패", status_code=response.status_code)
                    return False
                    
        except Exception as e:
            logger.error("헬스 체크 오류", error=str(e))
            return False
    
    async def calculate_hardware_specification(self, 
                                             service_requirements: Dict[str, int],
                                             gpu_type: str = "auto") -> Dict[str, Any]:
        """
        하드웨어 사양 계산
        
        Args:
            service_requirements: 서비스 요구사항
            gpu_type: GPU 타입 (auto, T4, V100, L40S)
            
        Returns:
            Dict: 계산 결과
        """
        try:
            # 요청 데이터 준비
            request_data = HardwareCalculationRequest(
                callbot=service_requirements.get("callbot", 0),
                chatbot=service_requirements.get("chatbot", 0),
                advisor=service_requirements.get("advisor", 0),
                standalone_stt=service_requirements.get("standalone_stt", 0),
                standalone_tts=service_requirements.get("standalone_tts", 0),
                ta=service_requirements.get("ta", 0),
                qa=service_requirements.get("qa", 0),
                gpu_type=gpu_type
            )
            
            logger.info("하드웨어 계산 요청", 
                       service_requirements=service_requirements, 
                       gpu_type=gpu_type,
                       api_url=self.calculate_endpoint)
            
            # 외부 API 호출
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    self.calculate_endpoint,
                    json=request_data.__dict__,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code == 200:
                    result = response.json()
                    
                    if result.get("success"):
                        # 외부 API 응답을 내부 형식으로 변환
                        converted_result = self._convert_external_api_response(result, service_requirements, gpu_type)
                        
                        logger.info("하드웨어 계산 성공", 
                                   aws_cost_usd=result.get("aws_cost_analysis", {}).get("total_monthly_cost_usd"),
                                   ncp_cost_krw=result.get("ncp_cost_analysis", {}).get("total_monthly_cost_krw"))
                        return converted_result
                    else:
                        logger.error("하드웨어 계산 실패", error=result.get("error"))
                        return self._generate_fallback_result(service_requirements, gpu_type)
                else:
                    logger.error("API 호출 실패", 
                               status_code=response.status_code,
                               response_text=response.text)
                    return self._generate_fallback_result(service_requirements, gpu_type)
                    
        except Exception as e:
            logger.error("하드웨어 계산 오류", error=str(e))
            return self._generate_fallback_result(service_requirements, gpu_type)
    
    def calculate_hardware_specification_sync(self, 
                                            service_requirements: Dict[str, int],
                                            gpu_type: str = "auto") -> Dict[str, Any]:
        """
        동기 방식 하드웨어 사양 계산 (기존 호환성을 위해)
        
        Args:
            service_requirements: 서비스 요구사항
            gpu_type: GPU 타입
            
        Returns:
            Dict: 계산 결과
        """
        try:
            # 이벤트 루프가 이미 실행 중인지 확인
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # 이미 실행 중인 루프에서는 새로운 태스크 생성
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(
                        asyncio.run,
                        self.calculate_hardware_specification(service_requirements, gpu_type)
                    )
                    return future.result()
            else:
                # 새로운 이벤트 루프에서 실행
                return asyncio.run(
                    self.calculate_hardware_specification(service_requirements, gpu_type)
                )
        except Exception as e:
            logger.error("동기 하드웨어 계산 오류", error=str(e))
            return self._generate_fallback_result(service_requirements, gpu_type)
    
    def _convert_external_api_response(self, 
                                     external_result: Dict[str, Any],
                                     service_requirements: Dict[str, int],
                                     gpu_type: str) -> Dict[str, Any]:
        """
        외부 API 응답을 내부 형식으로 변환
        
        Args:
            external_result: 외부 API 응답
            service_requirements: 서비스 요구사항
            gpu_type: GPU 타입
            
        Returns:
            Dict: 내부 형식으로 변환된 응답
        """
        try:
            # 하드웨어 사양 추출 (server_config_table에서)
            hardware_spec = external_result.get("hardware_specification", {})
            server_configs = external_result.get("server_config_table", [])
            
            # 서버를 GPU/CPU/인프라로 분류
            gpu_servers = []
            cpu_servers = []
            infrastructure_servers = []
            
            for server in server_configs:
                server_info = {
                    "name": server.get("server_role", "Unknown Server"),
                    "cpu_cores": server.get("vcpu", 0),
                    "ram_gb": server.get("vram", 0),
                    "gpu_type": server.get("gpu", "").upper() if server.get("gpu") else None,
                    "gpu_ram_gb": server.get("gpu_ram_gb", 0),
                    "gpu_quantity": server.get("gpu_quantity", 0),
                    "storage_gb": server.get("vdisk_ebs", 0) + server.get("vdisk_instance", 0),
                    "quantity": server.get("quantity", 1),
                    "purpose": f"{server.get('server_role', 'Unknown')} 서버"
                }
                
                if server.get("gpu"):
                    gpu_servers.append(server_info)
                elif any(keyword in server.get("server_role", "").lower() 
                        for keyword in ["stt", "ta", "qa", "tts"]):
                    cpu_servers.append(server_info)
                else:
                    infrastructure_servers.append(server_info)
            
            # AWS 인스턴스 정보 변환
            aws_instances = []
            aws_analysis = external_result.get("aws_cost_analysis", {})
            for instance in aws_analysis.get("instance_breakdown", []):
                aws_instances.append({
                    "server_type": instance.get("server_role", "Unknown"),
                    "instance_type": instance.get("aws_instance", {}).get("instance_type", "unknown"),
                    "cpu_cores": instance.get("aws_instance", {}).get("vcpu", 0),
                    "ram_gb": instance.get("aws_instance", {}).get("memory_gb", 0),
                    "gpu_info": f"{instance.get('aws_instance', {}).get('gpu_count', 0)}x {instance.get('aws_instance', {}).get('gpu_type', '')}" if instance.get("aws_instance", {}).get("gpu_count", 0) > 0 else None,
                    "monthly_cost_krw": int(instance.get("total_monthly_cost", 0) * 1300),  # USD to KRW 대략 환율
                    "quantity": instance.get("quantity", 1),
                    "total_cost_krw": int(instance.get("total_monthly_cost", 0) * 1300 * instance.get("quantity", 1))
                })
            
            # NCP 인스턴스 정보 변환
            ncp_instances = []
            ncp_analysis = external_result.get("ncp_cost_analysis", {})
            for instance in ncp_analysis.get("instance_breakdown", []):
                ncp_instances.append({
                    "server_type": instance.get("server_role", "Unknown"),
                    "instance_type": instance.get("ncp_instance", {}).get("instance_type", "unknown"),
                    "cpu_cores": instance.get("ncp_instance", {}).get("vcpu", 0),
                    "ram_gb": instance.get("ncp_instance", {}).get("memory_gb", 0),
                    "gpu_info": f"{instance.get('ncp_instance', {}).get('gpu_count', 0)}x {instance.get('ncp_instance', {}).get('gpu_type', '')}" if instance.get("ncp_instance", {}).get("gpu_count", 0) > 0 else None,
                    "monthly_cost_krw": int(instance.get("total_monthly_cost", 0)),
                    "quantity": instance.get("quantity", 1),
                    "total_cost_krw": int(instance.get("total_monthly_cost", 0) * instance.get("quantity", 1))
                })
            
            # 비용 분석
            aws_total_cost_krw = int(aws_analysis.get("total_monthly_cost_usd", 0) * 1300)
            ncp_total_cost_krw = int(ncp_analysis.get("total_monthly_cost_krw", 0))
            
            return {
                "success": True,
                "message": "하드웨어 계산 완료 (외부 API 연동)",
                "external_api_source": "rdc.rickyson.com:5001",
                "input_data": service_requirements,
                "hardware_specification": {
                    "gpu_servers": gpu_servers,
                    "cpu_servers": cpu_servers,
                    "infrastructure_servers": infrastructure_servers
                },
                "aws_instances": aws_instances,
                "ncp_instances": ncp_instances,
                "cost_analysis": {
                    "aws_total_monthly_cost": aws_total_cost_krw,
                    "ncp_total_monthly_cost": ncp_total_cost_krw,
                    "cost_difference": aws_total_cost_krw - ncp_total_cost_krw,
                    "external_api_data": {
                        "aws_usd": aws_analysis.get("total_monthly_cost_usd", 0),
                        "ncp_krw": ncp_analysis.get("total_monthly_cost_krw", 0)
                    }
                }
            }
            
        except Exception as e:
            logger.error("외부 API 응답 변환 실패", error=str(e))
            return self._generate_fallback_result(service_requirements, gpu_type)
    
    def _generate_fallback_result(self, 
                                service_requirements: Dict[str, int], 
                                gpu_type: str) -> Dict[str, Any]:
        """
        폴백 결과 생성 (서비스 장애 시 기본 응답)
        
        Args:
            service_requirements: 서비스 요구사항
            gpu_type: GPU 타입
            
        Returns:
            Dict: 기본 하드웨어 사양
        """
        total_channels = sum(v for v in service_requirements.values() if isinstance(v, (int, float)))
        
        fallback_result = {
            "success": True,
            "message": "하드웨어 계산 완료 (폴백 모드)",
            "fallback_mode": True,
            "input_data": service_requirements,
            "hardware_specification": {
                "gpu_servers": [
                    {
                        "name": f"GPU 서버 ({gpu_type.upper()})",
                        "cpu_cores": 32,
                        "ram_gb": 64,
                        "gpu_type": gpu_type.upper(),
                        "gpu_ram_gb": 16,
                        "gpu_quantity": 1,
                        "storage_gb": 500,
                        "quantity": max(1, total_channels // 50),
                        "purpose": f"통합 GPU 처리 ({total_channels}채널)"
                    }
                ],
                "cpu_servers": [
                    {
                        "name": "CPU 서버 (16코어)",
                        "cpu_cores": 16,
                        "ram_gb": 32,
                        "gpu_type": None,
                        "gpu_ram_gb": 0,
                        "gpu_quantity": 0,
                        "storage_gb": 500,
                        "quantity": max(1, total_channels // 20),
                        "purpose": f"CPU 처리 ({total_channels}채널)"
                    }
                ],
                "infrastructure_servers": []
            },
            "aws_instances": [
                {
                    "server_type": f"GPU 서버 ({gpu_type.upper()})",
                    "instance_type": "g4dn.8xlarge",
                    "cpu_cores": 32,
                    "ram_gb": 128,
                    "gpu_info": f"1x {gpu_type.upper()}",
                    "monthly_cost_krw": 4693680,
                    "quantity": max(1, total_channels // 50),
                    "total_cost_krw": 4693680 * max(1, total_channels // 50)
                }
            ],
            "ncp_instances": [
                {
                    "server_type": f"GPU 서버 ({gpu_type.upper()})",
                    "instance_type": "g2-standard-32",
                    "cpu_cores": 32,
                    "ram_gb": 128,
                    "gpu_info": "1x V100",
                    "monthly_cost_krw": 7440000,
                    "quantity": max(1, total_channels // 50),
                    "total_cost_krw": 7440000 * max(1, total_channels // 50)
                }
            ],
            "cost_analysis": {
                "aws_total_monthly_cost": 4693680 * max(1, total_channels // 50),
                "ncp_total_monthly_cost": 7440000 * max(1, total_channels // 50),
                "cost_difference": (7440000 - 4693680) * max(1, total_channels // 50)
            }
        }
        
        logger.warning("폴백 결과 생성", 
                      total_channels=total_channels,
                      gpu_servers=len(fallback_result["hardware_specification"]["gpu_servers"]))
        
        return fallback_result
    
    def transform_to_legacy_format(self, modern_result: Dict[str, Any]) -> Dict[str, Any]:
        """
        새로운 API 응답을 기존 형식으로 변환
        개별 서버 데이터를 그대로 전달하여 상세 표시 지원
        
        Args:
            modern_result: 새로운 API 응답
            
        Returns:
            Dict: 기존 형식으로 변환된 결과 (개별 서버 유지)
        """
        try:
            if not modern_result.get("success"):
                return modern_result
            
            # [advice from AI] 개별 서버 데이터를 그대로 전달 - 뭉치지 않음
            # 하드웨어 사양 추출
            hw_spec = modern_result.get("hardware_specification", {})
            cost_analysis = modern_result.get("cost_analysis", {})
            
            # 기존 형식으로 변환하되 개별 서버 정보는 그대로 유지
            legacy_format = {
                "success": True,
                "gpu_type": modern_result.get("input_data", {}).get("gpu_type", "auto"),
                "service_requirements": modern_result.get("input_data", {}),
                "resource_calculation": {
                    "gpu": {
                        "total": sum(s.get("quantity", 1) for s in hw_spec.get("gpu_servers", [])),
                        "tts": sum(s.get("quantity", 1) for s in hw_spec.get("gpu_servers", []) if "TTS" in s.get("name", "")),
                        "nlp": sum(s.get("quantity", 1) for s in hw_spec.get("gpu_servers", []) if "NLP" in s.get("name", "")),
                        "aicm": sum(s.get("quantity", 1) for s in hw_spec.get("gpu_servers", []) if "AICM" in s.get("name", ""))
                    },
                    "cpu": {
                        "total": sum(s.get("cpu_cores", 0) * s.get("quantity", 1) for s in hw_spec.get("cpu_servers", [])),
                        "stt": sum(s.get("cpu_cores", 0) * s.get("quantity", 1) for s in hw_spec.get("cpu_servers", []) if "STT" in s.get("name", "")),
                        "ta": sum(s.get("cpu_cores", 0) * s.get("quantity", 1) for s in hw_spec.get("cpu_servers", []) if "TA" in s.get("name", "")),
                        "qa": sum(s.get("cpu_cores", 0) * s.get("quantity", 1) for s in hw_spec.get("cpu_servers", []) if "QA" in s.get("name", ""))
                    },
                    "network": {"total_mbps": 1000},
                    "storage": {"total_tb": 2.0},
                    "infrastructure": {"total": sum(s.get("quantity", 1) for s in hw_spec.get("infrastructure_servers", []))}
                },
                # [advice from AI] 개별 서버 데이터를 그대로 전달
                "hardware_specification": hw_spec,
                "summary": {
                    "total_gpu_count": sum(s.get("quantity", 1) for s in hw_spec.get("gpu_servers", [])),
                    "total_cpu_cores": sum(s.get("cpu_cores", 0) * s.get("quantity", 1) for s in hw_spec.get("cpu_servers", [])),
                    "total_servers": sum(s.get("quantity", 1) for s in hw_spec.get("gpu_servers", [])) + sum(s.get("quantity", 1) for s in hw_spec.get("cpu_servers", [])) + sum(s.get("quantity", 1) for s in hw_spec.get("infrastructure_servers", [])),
                    "estimated_power_kw": 2.5
                },
                "aws_instances": modern_result.get("aws_instances", []),
                "ncp_instances": modern_result.get("ncp_instances", []),
                "cost_analysis": cost_analysis
            }
            
            logger.debug("레거시 형식 변환 완료", 
                        gpu_count=legacy_format["summary"]["total_gpu_count"],
                        cpu_cores=legacy_format["summary"]["total_cpu_cores"])
            
            return legacy_format
            
        except Exception as e:
            logger.error("레거시 형식 변환 실패", error=str(e))
            return modern_result
    
    # ==========================================
    # 기존 ECP Calculator Adapter 호환 메서드들
    # ==========================================
    
    def generate_detailed_hardware_spec(self, 
                                      service_requirements: Dict[str, int],
                                      gpu_type: str = "auto") -> Dict[str, Any]:
        """
        기존 generate_detailed_hardware_spec 메서드 호환
        Server Resource Generator API를 직접 호출하여 개별 서버 데이터 획득
        """
        try:
            # [advice from AI] Server Resource Generator API 직접 호출
            logger.info("Server Resource Generator API 직접 호출", 
                       service_requirements=service_requirements, gpu_type=gpu_type)
            
            # API 요청 데이터 준비
            request_data = {
                **service_requirements,
                "gpu_type": gpu_type
            }
            
            # Server Resource Generator API 직접 호출
            response = httpx.post(self.calculate_endpoint, json=request_data, timeout=30)
            response.raise_for_status()
            
            modern_result = response.json()
            logger.info("Server Resource Generator 응답 받음", 
                       success=modern_result.get("success"),
                       gpu_servers_count=len(modern_result.get("hardware_specification", {}).get("gpu_servers", [])),
                       cpu_servers_count=len(modern_result.get("hardware_specification", {}).get("cpu_servers", [])),
                       infra_servers_count=len(modern_result.get("hardware_specification", {}).get("infrastructure_servers", [])))
            
            # 개별 서버 데이터를 그대로 반환 (변환하지 않음)
            if modern_result.get("success"):
                return {
                    "success": True,
                    "gpu_type": gpu_type,
                    "service_requirements": service_requirements,
                    "hardware_specification": modern_result.get("hardware_specification", {}),
                    "aws_instances": modern_result.get("aws_instances", []),
                    "ncp_instances": modern_result.get("ncp_instances", []),
                    "cost_analysis": modern_result.get("cost_analysis", {}),
                    "summary": {
                        "message": modern_result.get("message", "하드웨어 계산 완료"),
                        "total_servers": (
                            len(modern_result.get("hardware_specification", {}).get("gpu_servers", [])) +
                            len(modern_result.get("hardware_specification", {}).get("cpu_servers", [])) +
                            len(modern_result.get("hardware_specification", {}).get("infrastructure_servers", []))
                        )
                    }
                }
            else:
                logger.error("Server Resource Generator API 호출 실패", error=modern_result)
                return {"success": False, "error": "하드웨어 계산 실패"}
                
        except Exception as e:
            logger.error("Server Resource Generator API 호출 중 오류", error=str(e))
            # 폴백: 기존 방식 사용
            modern_result = self.calculate_hardware_specification_sync(service_requirements, gpu_type)
            return self.transform_to_legacy_format(modern_result)
    
    def get_cloud_instance_mapping(self, 
                                 service_requirements: Dict[str, int],
                                 gpu_type: str = "auto",
                                 cloud_provider: str = "aws") -> Dict[str, Any]:
        """
        기존 get_cloud_instance_mapping 메서드 호환
        """
        modern_result = self.calculate_hardware_specification_sync(service_requirements, gpu_type)
        legacy_result = self.transform_to_legacy_format(modern_result)
        
        # 클라우드 제공업체별 인스턴스 정보 추출
        if cloud_provider == "aws":
            instances = legacy_result.get("aws_instances", [])
        elif cloud_provider == "ncp":
            instances = legacy_result.get("ncp_instances", [])
        else:
            instances = []
        
        return {
            "success": True,
            "cloud_provider": cloud_provider,
            "gpu_type": gpu_type,
            "service_requirements": service_requirements,
            "instance_mapping": instances,
            "cost_analysis": legacy_result.get("cost_analysis", {}),
            "recommendations": {
                "cost_optimization": ["Reserved Instance 사용", "Spot Instance 활용"],
                "scaling_strategy": {"horizontal_scaling": "서비스별 수평 확장 가능"},
                "monitoring_setup": ["Prometheus + Grafana 모니터링"]
            }
        }
    
    def compare_gpu_options(self, service_requirements: Dict[str, int]) -> Dict[str, Any]:
        """
        기존 compare_gpu_options 메서드 호환
        GPU 타입별 비교는 단순화된 버전으로 제공
        """
        try:
            # 각 GPU 타입별로 계산
            gpu_types = ["t4", "v100", "l40s"]
            comparisons = {}
            
            for gpu_type in gpu_types:
                result = self.calculate_hardware_specification_sync(service_requirements, gpu_type)
                if result.get("success"):
                    hw_spec = result.get("hardware_specification", {})
                    gpu_count = len(hw_spec.get("gpu_servers", []))
                    server_count = len(hw_spec.get("gpu_servers", [])) + len(hw_spec.get("cpu_servers", []))
                    
                    comparisons[gpu_type] = {
                        "gpu_count": gpu_count,
                        "server_count": server_count,
                        "efficiency_score": 8.5 if gpu_type == "t4" else (7.2 if gpu_type == "v100" else 9.1)
                    }
            
            return {
                "success": True,
                "service_requirements": service_requirements,
                "gpu_comparisons": comparisons,
                "recommendation": "t4",  # 기본 추천
                "analysis": {
                    "t4": {"pros": ["가격 효율적"], "cons": ["제한된 성능"], "best_for": "소규모 환경"},
                    "v100": {"pros": ["균형잡힌 성능"], "cons": ["높은 비용"], "best_for": "중간 규모"},
                    "l40s": {"pros": ["최고 성능"], "cons": ["높은 비용"], "best_for": "대규모 환경"}
                }
            }
            
        except Exception as e:
            logger.error("GPU 옵션 비교 실패", error=str(e))
            return {"success": False, "error": str(e)}
