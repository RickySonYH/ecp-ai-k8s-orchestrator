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
        manifest_content: str, 
        tenant_id: str,
        deployment_mode: str = "production"
    ) -> Dict[str, Any]:
        """매니페스트를 K8S Simulator에 배포
        
        Args:
            manifest_content: YAML 매니페스트 내용
            tenant_id: 테넌트 ID
            deployment_mode: 배포 모드 (production/demo)
            
        Returns:
            배포 결과 정보
        """
        try:
            logger.info(f"Deploying manifest for tenant {tenant_id} to K8S Simulator")
            
            response = await self.client.post(
                f"{self.base_url}/k8s/manifest/deploy",
                json={
                    "manifest": manifest_content,
                    "tenant_id": tenant_id,
                    "deployment_mode": deployment_mode
                },
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "ECP-AI-Orchestrator/1.51"
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
    
    async def parse_manifest(self, manifest_content: str, tenant_id: str) -> Dict[str, Any]:
        """매니페스트 파싱 및 검증
        
        Args:
            manifest_content: YAML 매니페스트 내용
            tenant_id: 테넌트 ID
            
        Returns:
            파싱 결과 및 리소스 정보
        """
        try:
            response = await self.client.post(
                f"{self.base_url}/k8s/manifest/parse",
                json={
                    "manifest": manifest_content,
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
            response = await self.client.get(f"{self.base_url}/", timeout=5.0)
            return response.status_code == 200
        except:
            return False
    
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
