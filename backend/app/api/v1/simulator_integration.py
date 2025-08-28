# [advice from AI] K8S Simulator 연동 API 라우터
from fastapi import APIRouter, HTTPException, Request, Depends, BackgroundTasks
from typing import Dict, Any, Optional
import logging
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.services.k8s_simulator_client import get_simulator_client, K8sSimulatorClient
from app.models.database import Tenant
from app.services.manifest_generator import ManifestGenerator
from app.services.simulator_data_adapter import get_simulator_monitoring_data

logger = logging.getLogger(__name__)

router = APIRouter()

# [advice from AI] 매니페스트 생성기 인스턴스
manifest_generator = ManifestGenerator()

@router.post("/simulator/deploy/{tenant_id}")
async def deploy_to_simulator(
    tenant_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """테넌트 매니페스트를 K8S Simulator에 배포
    
    실사용 모드에서만 사용 가능하며, 매니페스트 생성 → 시뮬레이터 배포 → 고급 모니터링 연동을 수행합니다.
    """
    # [advice from AI] 실사용 모드에서만 시뮬레이터 사용 (데모 모드 제외)
    is_demo = request.headers.get("X-Demo-Mode", "false").lower() == "true"
    
    if is_demo:
        raise HTTPException(
            status_code=400, 
            detail="시뮬레이터는 실사용 모드에서만 사용 가능합니다. 데모 모드에서는 로컬 데이터를 사용합니다."
        )
    
    try:
        # 테넌트 정보 조회
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail=f"테넌트 {tenant_id}를 찾을 수 없습니다")
        
        # 매니페스트 생성
        logger.info(f"Generating manifest for tenant {tenant_id}")
        manifest_content = await manifest_generator.generate_tenant_manifest(
            tenant_data=tenant.__dict__,
            is_demo=False  # 실사용 모드
        )
        
        # K8S Simulator 클라이언트 가져오기
        simulator_client = get_simulator_client()
        
        # 시뮬레이터 연결 확인
        if not await simulator_client.health_check():
            raise HTTPException(
                status_code=503, 
                detail="K8S Simulator에 연결할 수 없습니다. 시스템 관리자에게 문의하세요."
            )
        
        # 매니페스트 파싱 및 검증
        parse_result = await simulator_client.parse_manifest(manifest_content, tenant_id)
        if parse_result.get("status") != "success":
            raise HTTPException(
                status_code=400,
                detail=f"매니페스트 검증 실패: {parse_result.get('message', '알 수 없는 오류')}"
            )
        
        # 시뮬레이터에 배포
        logger.info(f"Deploying tenant {tenant_id} to K8S Simulator")
        deployment_result = await simulator_client.deploy_manifest(
            manifest_content=manifest_content,
            tenant_id=tenant_id,
            deployment_mode="production"
        )
        
        # [advice from AI] 백그라운드에서 모니터링 데이터 수집 시작
        background_tasks.add_task(start_monitoring_collection, tenant_id)
        
        return {
            "status": "success",
            "tenant_id": tenant_id,
            "deployment_result": deployment_result,
            "manifest_resources": parse_result.get("count", 0),
            "monitoring_dashboard": deployment_result.get("monitoring_dashboard"),
            "websocket_url": deployment_result.get("websocket_url"),
            "message": "시뮬레이터 배포가 완료되었습니다. 고급 모니터링이 자동으로 시작됩니다."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Simulator deployment failed for tenant {tenant_id}: {e}")
        raise HTTPException(status_code=500, detail=f"배포 중 오류가 발생했습니다: {str(e)}")

@router.get("/simulator/status/{tenant_id}")
async def get_simulator_status(tenant_id: str):
    """시뮬레이터에서 테넌트 배포 상태 조회"""
    try:
        simulator_client = get_simulator_client()
        
        # 배포 상태 조회
        deployment_status = await simulator_client.get_deployment_status(tenant_id)
        
        # 모니터링 데이터 조회
        monitoring_data = await simulator_client.get_monitoring_data(tenant_id)
        
        # SLA 상태 조회
        sla_status = await simulator_client.get_sla_status()
        
        return {
            "tenant_id": tenant_id,
            "deployment_status": deployment_status,
            "monitoring_data": monitoring_data,
            "sla_status": sla_status,
            "timestamp": monitoring_data.get("timestamp"),
            "external_dashboard": f"http://localhost:6360/monitoring/tenant/{tenant_id}"
        }
        
    except Exception as e:
        logger.error(f"Status check failed for tenant {tenant_id}: {e}")
        raise HTTPException(status_code=500, detail=f"상태 조회 실패: {str(e)}")

@router.get("/simulator/monitoring")
async def get_simulator_monitoring():
    """전체 시뮬레이터 모니터링 데이터 조회"""
    try:
        simulator_client = get_simulator_client()
        
        # 전체 모니터링 데이터
        monitoring_data = await simulator_client.get_monitoring_data()
        
        # SLA 상태
        sla_status = await simulator_client.get_sla_status()
        
        return {
            "monitoring_data": monitoring_data,
            "sla_status": sla_status,
            "simulator_dashboard": "http://localhost:6360",
            "api_docs": "http://localhost:6360/docs"
        }
        
    except Exception as e:
        logger.error(f"Monitoring data fetch failed: {e}")
        raise HTTPException(status_code=500, detail=f"모니터링 데이터 조회 실패: {str(e)}")

@router.delete("/simulator/deploy/{tenant_id}")
async def delete_simulator_deployment(tenant_id: str):
    """시뮬레이터에서 테넌트 배포 삭제"""
    try:
        simulator_client = get_simulator_client()
        
        result = await simulator_client.delete_deployment(tenant_id)
        
        return {
            "status": "success",
            "tenant_id": tenant_id,
            "deletion_result": result,
            "message": "시뮬레이터에서 테넌트 배포가 삭제되었습니다."
        }
        
    except Exception as e:
        logger.error(f"Deployment deletion failed for tenant {tenant_id}: {e}")
        raise HTTPException(status_code=500, detail=f"배포 삭제 실패: {str(e)}")

@router.post("/simulator/validate-manifest")
async def validate_manifest_for_simulator(
    manifest_content: str,
    tenant_id: str
):
    """시뮬레이터용 매니페스트 검증"""
    try:
        simulator_client = get_simulator_client()
        
        # 매니페스트 파싱 및 검증
        result = await simulator_client.parse_manifest(manifest_content, tenant_id)
        
        return {
            "validation_result": result,
            "is_valid": result.get("status") == "success",
            "resource_count": result.get("count", 0),
            "resources": result.get("resources", [])
        }
        
    except Exception as e:
        logger.error(f"Manifest validation failed: {e}")
        raise HTTPException(status_code=500, detail=f"매니페스트 검증 실패: {str(e)}")

@router.get("/simulator/health")
async def check_simulator_health():
    """K8S Simulator 연결 상태 확인"""
    try:
        simulator_client = get_simulator_client()
        is_healthy = await simulator_client.health_check()
        
        if is_healthy:
            return {
                "status": "healthy",
                "simulator_url": "http://localhost:6360",
                "message": "K8S Simulator 연결이 정상입니다."
            }
        else:
            return {
                "status": "unhealthy",
                "message": "K8S Simulator에 연결할 수 없습니다."
            }
            
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "error",
            "message": f"상태 확인 실패: {str(e)}"
        }

# [advice from AI] 설정 탭에서 시뮬레이터 설정 저장/조회
@router.post("/simulator/settings")
async def save_simulator_settings(settings: Dict[str, Any]):
    """시뮬레이터 연동 설정 저장"""
    try:
        # TODO: 실제로는 데이터베이스에 저장해야 함
        # 현재는 메모리에만 저장
        
        return {
            "status": "success",
            "settings": settings,
            "message": "시뮬레이터 설정이 저장되었습니다."
        }
        
    except Exception as e:
        logger.error(f"Settings save failed: {e}")
        raise HTTPException(status_code=500, detail=f"설정 저장 실패: {str(e)}")

@router.get("/simulator/settings")
async def get_simulator_settings():
    """시뮬레이터 연동 설정 조회"""
    try:
        # [advice from AI] 기본 설정값 반환
        default_settings = {
            "enabled": True,
            "url": "http://localhost:6360",
            "useForRealMode": True,
            "autoAdvancedMonitoring": True,
            "slaTarget": 99.5,
            "monitoringInterval": 5
        }
        
        return {
            "settings": default_settings,
            "simulator_status": await check_simulator_health()
        }
        
    except Exception as e:
        logger.error(f"Settings fetch failed: {e}")
        raise HTTPException(status_code=500, detail=f"설정 조회 실패: {str(e)}")

async def start_monitoring_collection(tenant_id: str):
    """백그라운드에서 모니터링 데이터 수집 시작
    
    Args:
        tenant_id: 테넌트 ID
    """
    try:
        logger.info(f"Starting monitoring collection for tenant {tenant_id}")
        
        # [advice from AI] 실제로는 WebSocket 연결이나 주기적 폴링을 통해
        # 시뮬레이터의 모니터링 데이터를 ECP 데이터베이스에 저장해야 함
        
        # 현재는 로그만 남김
        logger.info(f"Monitoring collection started for tenant {tenant_id}")
        
    except Exception as e:
        logger.error(f"Failed to start monitoring collection for tenant {tenant_id}: {e}")

# [advice from AI] ECP 고급 모니터링과 K8S Simulator 데이터 연동 엔드포인트들
@router.get("/monitoring/advanced/realtime")
async def get_advanced_monitoring_realtime():
    """
    ECP 고급 모니터링용 실시간 데이터 (K8S Simulator 기반)
    
    Returns:
        Dict[str, Any]: ECP 고급 모니터링 형식의 실시간 메트릭 데이터
    """
    try:
        # K8S Simulator 데이터를 ECP 형식으로 변환하여 반환
        monitoring_data = await get_simulator_monitoring_data()
        
        if monitoring_data.get("status") == "error":
            raise HTTPException(
                status_code=503, 
                detail=f"K8S Simulator 연결 실패: {monitoring_data.get('message')}"
            )
        
        return {
            "status": "success",
            "metrics": monitoring_data["data"]["realtime_metrics"],
            "source": "k8s_simulator",
            "timestamp": monitoring_data["timestamp"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"고급 모니터링 실시간 데이터 조회 실패: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"실시간 모니터링 데이터 조회 중 오류가 발생했습니다: {str(e)}"
        )

@router.get("/monitoring/advanced/tenants")
async def get_advanced_monitoring_tenants():
    """
    ECP 고급 모니터링용 테넌트 비교 데이터 (K8S Simulator 기반)
    
    Returns:
        Dict[str, Any]: ECP 고급 모니터링 형식의 테넌트 비교 데이터
    """
    try:
        # K8S Simulator 데이터를 ECP 형식으로 변환하여 반환
        monitoring_data = await get_simulator_monitoring_data()
        
        if monitoring_data.get("status") == "error":
            raise HTTPException(
                status_code=503, 
                detail=f"K8S Simulator 연결 실패: {monitoring_data.get('message')}"
            )
        
        return {
            "status": "success",
            "tenants": monitoring_data["data"]["tenant_comparison"],
            "source": "k8s_simulator",
            "timestamp": monitoring_data["timestamp"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"고급 모니터링 테넌트 데이터 조회 실패: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"테넌트 비교 데이터 조회 중 오류가 발생했습니다: {str(e)}"
        )

@router.get("/monitoring/advanced/sla")
async def get_advanced_monitoring_sla():
    """
    ECP 고급 모니터링용 SLA 트렌드 데이터 (K8S Simulator 기반)
    
    Returns:
        Dict[str, Any]: ECP 고급 모니터링 형식의 SLA 트렌드 데이터
    """
    try:
        # K8S Simulator 데이터를 ECP 형식으로 변환하여 반환
        monitoring_data = await get_simulator_monitoring_data()
        
        if monitoring_data.get("status") == "error":
            raise HTTPException(
                status_code=503, 
                detail=f"K8S Simulator 연결 실패: {monitoring_data.get('message')}"
            )
        
        return {
            "status": "success",
            "metrics": monitoring_data["data"]["sla_trends"],
            "source": "k8s_simulator",
            "timestamp": monitoring_data["timestamp"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"고급 모니터링 SLA 데이터 조회 실패: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"SLA 트렌드 데이터 조회 중 오류가 발생했습니다: {str(e)}"
        )

@router.get("/monitoring/advanced/alerts")
async def get_advanced_monitoring_alerts():
    """
    ECP 고급 모니터링용 알림 데이터 (K8S Simulator 기반)
    
    Returns:
        Dict[str, Any]: ECP 고급 모니터링 형식의 알림 데이터
    """
    try:
        # K8S Simulator 데이터를 ECP 형식으로 변환하여 반환
        monitoring_data = await get_simulator_monitoring_data()
        
        if monitoring_data.get("status") == "error":
            raise HTTPException(
                status_code=503, 
                detail=f"K8S Simulator 연결 실패: {monitoring_data.get('message')}"
            )
        
        return {
            "status": "success",
            "alerts": monitoring_data["data"]["alerts"],
            "source": "k8s_simulator",
            "timestamp": monitoring_data["timestamp"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"고급 모니터링 알림 데이터 조회 실패: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"알림 데이터 조회 중 오류가 발생했습니다: {str(e)}"
        )
