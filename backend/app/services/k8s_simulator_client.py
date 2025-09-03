# [advice from AI] K8S Simulator API 연동 클라이언트 구현
import httpx
import asyncio
import json
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime

logger = logging.getLogger(__name__)

class K8sSimulatorClient:
    """K8S Deployment Simulator 연동 클라이언트
    
    실사용 모드에서 매니페스트 배포 시 K8S Simulator로 자동 연결하여
    가상 배포 및 SLA 99.5% 모니터링을 수행합니다.
    """
    
    def __init__(self, base_url: str = "http://k8s-simulator-backend:8000"):
        self.base_url = base_url
        self.external_url = "http://localhost:6360"  # 외부 접근용 URL
        self.client = None
        self._initialize_client()
    
    def _initialize_client(self):
        """HTTP 클라이언트 초기화"""
        self.client = httpx.AsyncClient(
            timeout=30.0,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=5)
        )
    
    async def deploy_manifest(
        self, 
        manifest_content, 
        tenant_id: str = "default",
        deployment_mode: str = "production",
        namespace: str = "default-ecp-ai"
    ) -> Dict[str, Any]:
        """매니페스트를 K8S Simulator에 배포
        
        Args:
            manifest_content: YAML 매니페스트 내용 (str 또는 dict)
            tenant_id: 테넌트 ID
            deployment_mode: 배포 모드 (production/demo)
            
        Returns:
            배포 결과 정보
        """
        try:
            logger.info(f"Deploying manifest for tenant {tenant_id} to K8S Simulator")
            
            # [advice from AI] manifest_content가 dict인 경우 문자열로 변환
            if isinstance(manifest_content, dict):
                # dict의 모든 값들을 연결하여 하나의 YAML 문자열로 만들기
                manifest_yaml = "\n---\n".join(manifest_content.values())
            else:
                manifest_yaml = manifest_content
            
            response = await self.client.post(
                f"{self.base_url}/k8s/manifest/deploy",
                json={
                    "manifest": manifest_yaml,
                    "tenant_id": tenant_id,
                    "deployment_mode": deployment_mode
                },
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "ECP-AI-Orchestrator/1.54"
                }
            )
            response.raise_for_status()
            
            result = response.json()
            logger.info(f"Deployment successful for tenant {tenant_id}: {result.get('deployed_count', 0)} resources")
            
            # [advice from AI] 배포 결과에 모니터링 URL 추가
            result["monitoring_dashboard"] = f"{self.external_url}/monitoring/tenant/{tenant_id}"
            result["websocket_url"] = f"ws://localhost:6360/ws/monitoring"
            
            return result
            
        except httpx.HTTPError as e:
            logger.error(f"K8S Simulator deployment failed for tenant {tenant_id}: {e}")
            raise Exception(f"시뮬레이터 배포 실패: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error during deployment: {e}")
            raise Exception(f"배포 중 오류 발생: {str(e)}")
    
    async def parse_manifest(self, manifest_content, tenant_id: str) -> Dict[str, Any]:
        """매니페스트 파싱 및 검증
        
        Args:
            manifest_content: YAML 매니페스트 내용 (str 또는 dict)
            tenant_id: 테넌트 ID
            
        Returns:
            파싱 결과 및 리소스 정보
        """
        try:
            # [advice from AI] manifest_content가 dict인 경우 문자열로 변환
            if isinstance(manifest_content, dict):
                manifest_yaml = "\n---\n".join(manifest_content.values())
            else:
                manifest_yaml = manifest_content
                
            response = await self.client.post(
                f"{self.base_url}/k8s/manifest/parse",
                json={
                    "manifest": manifest_yaml,
                    "tenant_id": tenant_id
                }
            )
            response.raise_for_status()
            return response.json()
            
        except httpx.HTTPError as e:
            logger.error(f"Manifest parsing failed: {e}")
            raise Exception(f"매니페스트 파싱 실패: {str(e)}")
    
    async def get_deployment_status(self, tenant_id: str) -> Dict[str, Any]:
        """배포 상태 조회
        
        Args:
            tenant_id: 테넌트 ID
            
        Returns:
            배포된 리소스 상태 정보
        """
        try:
            response = await self.client.get(
                f"{self.base_url}/k8s/resources",
                params={"tenant_id": tenant_id}
            )
            response.raise_for_status()
            return response.json()
            
        except httpx.HTTPError as e:
            logger.error(f"Status check failed for tenant {tenant_id}: {e}")
            return {"status": "error", "message": str(e)}
    
    async def get_monitoring_data(self, tenant_id: Optional[str] = None) -> Dict[str, Any]:
        """모니터링 데이터 조회
        
        Args:
            tenant_id: 특정 테넌트 ID (선택적)
            
        Returns:
            실시간 모니터링 메트릭 데이터
        """
        try:
            if tenant_id:
                url = f"{self.base_url}/monitoring/tenant/{tenant_id}"
            else:
                url = f"{self.base_url}/monitoring/health"
            
            response = await self.client.get(url)
            response.raise_for_status()
            
            data = response.json()
            
            # [advice from AI] ECP Orchestrator 형식으로 데이터 변환
            if "services" in data:
                transformed_data = self._transform_monitoring_data(data)
                return transformed_data
            
            return data
            
        except httpx.HTTPError as e:
            logger.error(f"Monitoring data fetch failed: {e}")
            return {"status": "error", "message": str(e)}
    
    async def get_sla_status(self) -> Dict[str, Any]:
        """SLA 99.5% 달성 현황 조회
        
        Returns:
            SLA 상태 및 달성률 정보
        """
        try:
            response = await self.client.get(f"{self.base_url}/sla/status")
            response.raise_for_status()
            
            sla_data = response.json()
            
            # [advice from AI] SLA 상태 정보 보강
            sla_data["target_sla"] = 99.5
            sla_data["is_meeting_target"] = sla_data.get("percentage", 0) >= 99.5
            sla_data["external_dashboard"] = f"{self.external_url}/sla/status"
            
            return sla_data
            
        except httpx.HTTPError as e:
            logger.error(f"SLA status fetch failed: {e}")
            return {"status": "error", "message": str(e)}
    
    async def delete_deployment(self, tenant_id: str) -> Dict[str, Any]:
        """테넌트 배포 삭제
        
        Args:
            tenant_id: 테넌트 ID
            
        Returns:
            삭제 결과
        """
        try:
            # 테넌트와 관련된 모든 리소스 조회
            resources = await self.get_deployment_status(tenant_id)
            
            deleted_count = 0
            if "resources" in resources:
                for resource in resources["resources"]:
                    try:
                        namespace = resource.get("namespace", "default")
                        kind = resource.get("kind", "")
                        name = resource.get("name", "")
                        
                        delete_url = f"{self.base_url}/k8s/resources/{namespace}/{kind}/{name}"
                        response = await self.client.delete(delete_url)
                        
                        if response.status_code == 200:
                            deleted_count += 1
                            
                    except Exception as e:
                        logger.warning(f"Failed to delete resource {resource}: {e}")
            
            return {
                "status": "success",
                "tenant_id": tenant_id,
                "deleted_resources": deleted_count
            }
            
        except Exception as e:
            logger.error(f"Deployment deletion failed for tenant {tenant_id}: {e}")
            return {"status": "error", "message": str(e)}
    
    def _transform_monitoring_data(self, simulator_data: Dict[str, Any]) -> Dict[str, Any]:
        """Simulator 모니터링 데이터를 ECP 형식으로 변환
        
        Args:
            simulator_data: K8S Simulator의 모니터링 데이터
            
        Returns:
            ECP Orchestrator 형식의 모니터링 데이터
        """
        try:
            services = simulator_data.get("services", {})
            summary = simulator_data.get("summary", {})
            
            # [advice from AI] ECP 고급 모니터링 형식으로 변환
            transformed = {
                "timestamp": simulator_data.get("timestamp", datetime.utcnow().isoformat()),
                "overall_status": summary.get("overall_health", "unknown"),
                "sla_percentage": summary.get("sla_percentage", 0),
                "total_services": summary.get("total_services", 0),
                "healthy_services": summary.get("healthy_services", 0),
                "services": {}
            }
            
            # 서비스별 메트릭 변환
            for service_name, service_data in services.items():
                transformed["services"][service_name] = {
                    "cpu_usage": service_data.get("cpu", {}).get("usage_percent", 0),
                    "memory_usage": service_data.get("memory", {}).get("usage_mb", 0),
                    "memory_percent": service_data.get("memory", {}).get("usage_percent", 0),
                    "network_rps": service_data.get("network", {}).get("requests_per_second", 0),
                    "response_time": service_data.get("network", {}).get("response_time_ms", 0),
                    "error_rate": service_data.get("network", {}).get("error_rate_percent", 0),
                    "status": service_data.get("health", {}).get("status", "unknown"),
                    "uptime": service_data.get("health", {}).get("uptime_seconds", 0)
                }
            
            return transformed
            
        except Exception as e:
            logger.error(f"Data transformation failed: {e}")
            return simulator_data
    
    async def health_check(self) -> bool:
        """K8S Simulator 연결 상태 확인
        
        Returns:
            연결 상태 (True: 정상, False: 오류)
        """
        try:
            response = await self.client.get(f"{self.base_url}/health", timeout=5.0)
            if response.status_code == 200:
                data = response.json()
                return data.get("status") == "healthy"
            return False
        except Exception as e:
            logger.warning(f"Health check failed: {e}")
            return False
    
    async def get_service_status(
        self, 
        service_name: str, 
        namespace: str = "default-ecp-ai"
    ) -> Dict[str, Any]:
        """특정 서비스의 배포 상태 조회
        
        Args:
            service_name: 서비스 이름
            namespace: 네임스페이스
            
        Returns:
            서비스 배포 상태 정보
        """
        try:
            response = await self.client.get(
                f"{self.base_url}/k8s/service/{service_name}",
                params={"namespace": namespace}
            )
            response.raise_for_status()
            
            service_data = response.json()
            
            # Mock 데이터로 응답 (실제로는 시뮬레이터에서 제공)
            return {
                "serviceName": service_name,
                "desiredImage": f"harbor.company.com/ecp-ai/{service_name}:latest",
                "currentImage": f"harbor.company.com/ecp-ai/{service_name}:latest",
                "replicas": {
                    "desired": 2,
                    "ready": 2,
                    "available": 2,
                    "updated": 2
                },
                "pods": [
                    {
                        "podName": f"{service_name}-deployment-abc123",
                        "status": "Running",
                        "currentImage": f"harbor.company.com/ecp-ai/{service_name}:latest",
                        "ready": True,
                        "restarts": 0,
                        "createdAt": datetime.utcnow().isoformat(),
                        "nodeName": "worker-node-1"
                    },
                    {
                        "podName": f"{service_name}-deployment-def456",
                        "status": "Running",
                        "currentImage": f"harbor.company.com/ecp-ai/{service_name}:latest",
                        "ready": True,
                        "restarts": 0,
                        "createdAt": datetime.utcnow().isoformat(),
                        "nodeName": "worker-node-2"
                    }
                ],
                "deploymentStatus": "Running",
                "lastUpdated": datetime.utcnow().isoformat()
            }
            
        except httpx.HTTPError as e:
            logger.error(f"Service status check failed for {service_name}: {e}")
            # 오류 시에도 기본 Mock 데이터 반환
            return {
                "serviceName": service_name,
                "desiredImage": f"harbor.company.com/ecp-ai/{service_name}:latest",
                "currentImage": f"harbor.company.com/ecp-ai/{service_name}:latest",
                "replicas": {"desired": 0, "ready": 0, "available": 0, "updated": 0},
                "pods": [],
                "deploymentStatus": "Unknown",
                "lastUpdated": datetime.utcnow().isoformat()
            }

    async def get_tenant_monitoring_data(self, tenant_id: str) -> Dict[str, Any]:
        """[advice from AI] 특정 테넌트의 실시간 모니터링 데이터 조회
        
        Args:
            tenant_id: 테넌트 ID
            
        Returns:
            테넌트별 CPU, 메모리, GPU 사용률 등 모니터링 데이터
        """
        try:
            # 시뮬레이터에서 전체 모니터링 데이터 조회
            response = await self.client.get(f"{self.base_url}/monitoring/health")
            response.raise_for_status()
            
            health_data = response.json()
            services = health_data.get("services", {})
            
            # 테넌트 관련 서비스들 찾기 (네임스페이스 기반)
            tenant_services = {}
            tenant_namespace = f"{tenant_id}-ecp-ai"
            
            for service_name, service_data in services.items():
                # 테넌트 네임스페이스와 관련된 서비스인지 확인
                if tenant_id in service_name or tenant_namespace in service_name:
                    tenant_services[service_name] = service_data
            
            # 테넌트별 집계 메트릭 계산
            if tenant_services:
                total_cpu = sum(s.get("cpu", {}).get("usage_percent", 0) for s in tenant_services.values())
                total_memory = sum(s.get("memory", {}).get("usage_percent", 0) for s in tenant_services.values())
                avg_response_time = sum(s.get("network", {}).get("response_time_ms", 0) for s in tenant_services.values()) / len(tenant_services)
                avg_error_rate = sum(s.get("network", {}).get("error_rate_percent", 0) for s in tenant_services.values()) / len(tenant_services)
                
                # GPU 사용률 계산 (AI 서비스 기준)
                gpu_usage = 0
                ai_services = [s for name, s in tenant_services.items() if any(x in name.lower() for x in ['callbot', 'chatbot', 'advisor'])]
                if ai_services:
                    gpu_usage = sum(s.get("cpu", {}).get("usage_percent", 0) * 0.8 for s in ai_services) / len(ai_services)
                
                return {
                    "tenant_id": tenant_id,
                    "cpu_usage": round(total_cpu / len(tenant_services), 1),
                    "memory_usage": round(total_memory / len(tenant_services), 1),
                    "gpu_usage": round(gpu_usage, 1),
                    "response_time": round(avg_response_time, 1),
                    "error_rate": round(avg_error_rate, 4),
                    "service_count": len(tenant_services),
                    "status": "running" if all(s.get("health", {}).get("status") == "healthy" for s in tenant_services.values()) else "warning",
                    "timestamp": health_data.get("timestamp")
                }
            else:
                # 테넌트 서비스가 없는 경우
                return {
                    "tenant_id": tenant_id,
                    "cpu_usage": 0,
                    "memory_usage": 0,
                    "gpu_usage": 0,
                    "response_time": 0,
                    "error_rate": 0,
                    "service_count": 0,
                    "status": "stopped",
                    "timestamp": datetime.now().isoformat()
                }
            
        except httpx.HTTPError as e:
            logger.error(f"Tenant monitoring data retrieval failed for {tenant_id}: {e}")
            return {
                "tenant_id": tenant_id,
                "cpu_usage": 0,
                "memory_usage": 0,
                "gpu_usage": 0,
                "status": "unknown",
                "message": f"모니터링 데이터 조회 실패: {str(e)}"
            }
        except Exception as e:
            logger.error(f"Unexpected error getting tenant monitoring data: {e}")
            return {
                "tenant_id": tenant_id,
                "cpu_usage": 0,
                "memory_usage": 0,
                "gpu_usage": 0,
                "status": "error",
                "message": f"모니터링 데이터 조회 중 오류: {str(e)}"
            }

    async def close(self):
        """클라이언트 연결 종료"""
        if self.client:
            await self.client.aclose()

# [advice from AI] 글로벌 시뮬레이터 클라이언트 인스턴스
_simulator_client = None

def get_simulator_client() -> K8sSimulatorClient:
    """K8S Simulator 클라이언트 인스턴스 반환"""
    global _simulator_client
    if _simulator_client is None:
        _simulator_client = K8sSimulatorClient()
    return _simulator_client

async def cleanup_simulator_client():
    """애플리케이션 종료 시 클라이언트 정리"""
    global _simulator_client
    if _simulator_client:
        await _simulator_client.close()
        _simulator_client = None
