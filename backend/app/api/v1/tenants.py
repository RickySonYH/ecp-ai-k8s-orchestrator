# [advice from AI] ECP-AI 테넌시 관리 API 엔드포인트
"""
ECP-AI 테넌시 관리 REST API
- 테넌시 생성/조회/삭제 완전 구현
- 실시간 메트릭 WebSocket 지원
- 백그라운드 작업 처리
- FastAPI + Pydantic 모델 + 비동기 처리
"""

import asyncio
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, validator
import structlog
import json
from datetime import datetime
from io import BytesIO

# ECP-AI 핵심 모듈 임포트
from app.core.tenant_manager import TenantManager
from app.core.resource_calculator import ResourceCalculator, ResourceRequirements
from app.core.k8s_orchestrator import K8sOrchestrator
from app.core.manifest_generator import ManifestGenerator
from app.models.tenant_specs import (
    TenantSpecs, TenantCreateRequest, ServiceRequirements,
    PresetType, GPUType, EnvironmentVariable, VolumeMount,
    HealthCheckConfig, NetworkConfig
)
from app.core.ecp_calculator_adapter import ECPCalculatorAdapter

logger = structlog.get_logger(__name__)

# FastAPI 라우터 생성
router = APIRouter(prefix="/tenants", tags=["tenants"])

# 전역 의존성 (실제 구현에서는 Dependency Injection 사용)
tenant_manager = None
k8s_orchestrator = None

def get_tenant_manager() -> TenantManager:
    """TenantManager 의존성 주입"""
    global tenant_manager
    if tenant_manager is None:
        tenant_manager = TenantManager()
    return tenant_manager

def get_k8s_orchestrator() -> K8sOrchestrator:
    """K8sOrchestrator 의존성 주입"""
    global k8s_orchestrator
    if k8s_orchestrator is None:
        k8s_orchestrator = K8sOrchestrator()
    return k8s_orchestrator


# ==========================================
# Pydantic 모델 정의 (확장된 모델 사용)
# ==========================================


class ResourceEstimation(BaseModel):
    """리소스 예상 모델"""
    gpu: Dict[str, Any] = Field(..., description="GPU 요구사항")
    cpu: Dict[str, float] = Field(..., description="CPU 요구사항")
    memory: Dict[str, str] = Field(..., description="메모리 요구사항")
    storage: Dict[str, str] = Field(..., description="스토리지 요구사항")


class TenantCreateResponse(BaseModel):
    """테넌시 생성 응답 모델"""
    success: bool = Field(..., description="생성 성공 여부")
    tenant_id: str = Field(..., description="테넌시 ID")
    preset: str = Field(..., description="감지된 프리셋")
    estimated_resources: ResourceEstimation = Field(..., description="예상 리소스 사용량")
    deployment_status: str = Field(..., description="배포 상태")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="생성 시간")
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "tenant_id": "customer-abc",
                "preset": "small",
                "estimated_resources": {
                    "gpu": {"total": 4, "recommended_type": "t4"},
                    "cpu": {"total": 23},
                    "memory": {"gpu_ram_gb": "64", "system_ram_gb": "128"},
                    "storage": {"total_tb": "2.5"}
                },
                "deployment_status": "in_progress",
                "created_at": "2024-12-01T12:00:00Z"
            }
        }


class ServiceStatus(BaseModel):
    """서비스 상태 모델"""
    name: str = Field(..., description="서비스 이름")
    replicas: Dict[str, int] = Field(..., description="레플리카 상태")
    status: str = Field(..., description="서비스 상태")
    resources: Optional[Dict[str, Any]] = Field(None, description="리소스 사용률")


class SLAMetrics(BaseModel):
    """SLA 메트릭 모델"""
    availability: float = Field(..., ge=0, le=100, description="가용률 (%)")
    response_time: float = Field(..., ge=0, description="평균 응답시간 (ms)")
    error_rate: float = Field(..., ge=0, le=100, description="에러율 (%)")
    throughput: int = Field(..., ge=0, description="처리량 (req/min)")


class TenantStatusResponse(BaseModel):
    """테넌시 상태 응답 모델"""
    tenant_id: str = Field(..., description="테넌시 ID")
    status: str = Field(..., description="전체 상태")
    services: List[ServiceStatus] = Field(..., description="서비스별 상태")
    resources: Dict[str, Any] = Field(..., description="리소스 현황")
    sla_metrics: SLAMetrics = Field(..., description="SLA 메트릭")
    last_updated: datetime = Field(default_factory=datetime.utcnow, description="마지막 업데이트")


class TenantMetrics(BaseModel):
    """실시간 메트릭 모델"""
    tenant_id: str = Field(..., description="테넌시 ID")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="측정 시간")
    cpu_usage: float = Field(..., ge=0, le=100, description="CPU 사용률 (%)")
    memory_usage: float = Field(..., ge=0, le=100, description="메모리 사용률 (%)")
    gpu_usage: float = Field(..., ge=0, le=100, description="GPU 사용률 (%)")
    network_io: Dict[str, float] = Field(..., description="네트워크 I/O (MB/s)")
    active_connections: int = Field(..., ge=0, description="활성 연결 수")


# ==========================================
# WebSocket 연결 관리
# ==========================================

class ConnectionManager:
    """WebSocket 연결 관리자"""
    
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, tenant_id: str):
        """WebSocket 연결 추가"""
        await websocket.accept()
        if tenant_id not in self.active_connections:
            self.active_connections[tenant_id] = []
        self.active_connections[tenant_id].append(websocket)
        logger.info("WebSocket 연결", tenant_id=tenant_id, 
                   connections=len(self.active_connections[tenant_id]))
    
    def disconnect(self, websocket: WebSocket, tenant_id: str):
        """WebSocket 연결 제거"""
        if tenant_id in self.active_connections:
            if websocket in self.active_connections[tenant_id]:
                self.active_connections[tenant_id].remove(websocket)
            if not self.active_connections[tenant_id]:
                del self.active_connections[tenant_id]
        logger.info("WebSocket 연결 해제", tenant_id=tenant_id)
    
    async def send_metrics(self, tenant_id: str, metrics: TenantMetrics):
        """특정 테넌시의 모든 연결에 메트릭 전송"""
        if tenant_id in self.active_connections:
            disconnected = []
            for connection in self.active_connections[tenant_id]:
                try:
                    await connection.send_text(metrics.model_dump_json())
                except Exception:
                    disconnected.append(connection)
            
            # 끊어진 연결 정리
            for conn in disconnected:
                self.disconnect(conn, tenant_id)

manager = ConnectionManager()


# ==========================================
# 백그라운드 작업 함수들
# ==========================================

async def deploy_tenant_background(tenant_specs: TenantSpecs):
    """테넌시 배포 백그라운드 작업"""
    try:
        logger.info("백그라운드 테넌시 배포 시작", tenant_id=tenant_specs.tenant_id)
        
        tenant_mgr = get_tenant_manager()
        success = await tenant_mgr.create_tenant(tenant_specs)
        
        if success:
            logger.info("백그라운드 테넌시 배포 완료", tenant_id=tenant_specs.tenant_id)
        else:
            logger.error("백그라운드 테넌시 배포 실패", tenant_id=tenant_specs.tenant_id)
            
    except Exception as e:
        logger.error("백그라운드 테넌시 배포 중 오류", 
                    tenant_id=tenant_specs.tenant_id, error=str(e))


async def collect_metrics_background(tenant_id: str):
    """메트릭 수집 백그라운드 작업"""
    try:
        # 실제 구현에서는 Prometheus에서 메트릭 수집
        # 여기서는 임시 데이터 생성
        import random
        
        metrics = TenantMetrics(
            tenant_id=tenant_id,
            cpu_usage=random.uniform(20, 80),
            memory_usage=random.uniform(30, 70),
            gpu_usage=random.uniform(10, 90),
            network_io={"rx": random.uniform(1, 10), "tx": random.uniform(1, 10)},
            active_connections=random.randint(10, 100)
        )
        
        await manager.send_metrics(tenant_id, metrics)
        
    except Exception as e:
        logger.error("메트릭 수집 중 오류", tenant_id=tenant_id, error=str(e))


# ==========================================
# API 엔드포인트 구현
# ==========================================

@router.post("/", response_model=TenantCreateResponse)
async def create_tenant(
    request: TenantCreateRequest,
    background_tasks: BackgroundTasks,
    tenant_mgr: TenantManager = Depends(get_tenant_manager)
):
    """
    테넌시 생성
    - 서비스 요구사항 기반 자동 프리셋 감지
    - GPU 타입별 최적 리소스 계산
    - 백그라운드 Kubernetes 자동 배포
    """
    try:
        logger.info(
            "테넌시 생성 요청",
            tenant_id=request.tenant_id,
            service_requirements=request.service_requirements.model_dump(),
            gpu_type=request.gpu_type,
            auto_deploy=request.auto_deploy
        )
        
        # 1. 테넌시 ID 중복 확인
        k8s_orch = get_k8s_orchestrator()
        existing_status = await k8s_orch.get_tenant_status(request.tenant_id)
        if existing_status:
            raise HTTPException(
                status_code=409,
                detail=f"테넌시 '{request.tenant_id}'가 이미 존재합니다"
            )
        
        # 2. 테넌시 사양 생성
        tenant_specs = tenant_mgr.generate_tenant_specs(
            tenant_id=request.tenant_id,
            service_requirements=request.service_requirements.model_dump(),
            gpu_type=request.gpu_type
        )
        
        # 3. 리소스 계산
        resource_calculator = ResourceCalculator(tenant_mgr.service_matrix)
        comprehensive_requirements = resource_calculator.calculate_comprehensive_requirements(
            request.service_requirements.model_dump(),
            request.gpu_type
        )
        
        # 4. 백그라운드 배포 시작
        deployment_status = "manual"
        if request.auto_deploy:
            background_tasks.add_task(deploy_tenant_background, tenant_specs)
            deployment_status = "in_progress"
        
        # 5. 응답 생성
        response = TenantCreateResponse(
            success=True,
            tenant_id=request.tenant_id,
            preset=tenant_specs.preset,
            estimated_resources=ResourceEstimation(
                gpu=comprehensive_requirements.gpu,
                cpu=comprehensive_requirements.cpu,
                memory=comprehensive_requirements.memory,
                storage=comprehensive_requirements.storage
            ),
            deployment_status=deployment_status
        )
        
        logger.info(
            "테넌시 생성 요청 처리 완료",
            tenant_id=request.tenant_id,
            preset=tenant_specs.preset,
            deployment_status=deployment_status
        )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("테넌시 생성 실패", tenant_id=request.tenant_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"테넌시 생성 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/{tenant_id}", response_model=TenantStatusResponse)
async def get_tenant_status(
    tenant_id: str,
    k8s_orch: K8sOrchestrator = Depends(get_k8s_orchestrator)
):
    """
    테넌시 상태 조회
    - 서비스별 실시간 상태
    - 리소스 사용률
    - SLA 메트릭
    """
    try:
        logger.info("테넌시 상태 조회", tenant_id=tenant_id)
        
        # Kubernetes에서 실제 상태 조회
        k8s_status = await k8s_orch.get_tenant_status(tenant_id)
        
        if not k8s_status:
            raise HTTPException(
                status_code=404,
                detail=f"테넌시 '{tenant_id}'를 찾을 수 없습니다"
            )
        
        # 서비스 상태 변환
        services = []
        for service in k8s_status.get("services", []):
            services.append(ServiceStatus(
                name=service["name"],
                replicas=service["replicas"],
                status=service["status"],
                resources=None  # 실제 구현에서는 메트릭 서버에서 조회
            ))
        
        # SLA 메트릭 (실제 구현에서는 모니터링 시스템에서 조회)
        sla_metrics = SLAMetrics(
            availability=99.5,
            response_time=150.0,
            error_rate=0.1,
            throughput=1200
        )
        
        response = TenantStatusResponse(
            tenant_id=tenant_id,
            status=k8s_status.get("status", "Unknown"),
            services=services,
            resources={
                "gpu": 0,  # 실제 구현에서는 메트릭 조회
                "cpu": 0,
                "memory": 0
            },
            sla_metrics=sla_metrics
        )
        
        logger.info("테넌시 상태 조회 완료", tenant_id=tenant_id, status=response.status)
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("테넌시 상태 조회 실패", tenant_id=tenant_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"테넌시 상태 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.delete("/{tenant_id}")
async def delete_tenant(
    tenant_id: str,
    k8s_orch: K8sOrchestrator = Depends(get_k8s_orchestrator)
):
    """
    테넌시 삭제
    - 네임스페이스와 모든 리소스 완전 삭제
    """
    try:
        logger.info("테넌시 삭제 요청", tenant_id=tenant_id)
        
        # 테넌시 존재 확인
        existing_status = await k8s_orch.get_tenant_status(tenant_id)
        if not existing_status:
            raise HTTPException(
                status_code=404,
                detail=f"테넌시 '{tenant_id}'를 찾을 수 없습니다"
            )
        
        # Kubernetes 리소스 삭제
        success = await k8s_orch.delete_tenant(tenant_id)
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail=f"테넌시 '{tenant_id}' 삭제에 실패했습니다"
            )
        
        logger.info("테넌시 삭제 완료", tenant_id=tenant_id)
        
        return {
            "success": True,
            "message": f"테넌시 '{tenant_id}'가 성공적으로 삭제되었습니다",
            "deleted_at": datetime.utcnow()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("테넌시 삭제 실패", tenant_id=tenant_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"테넌시 삭제 중 오류가 발생했습니다: {str(e)}"
        )


@router.websocket("/{tenant_id}/metrics")
async def websocket_metrics(websocket: WebSocket, tenant_id: str):
    """
    실시간 메트릭 WebSocket 엔드포인트
    - 실시간 리소스 사용률 스트리밍
    - 자동 연결 관리
    """
    await manager.connect(websocket, tenant_id)
    
    try:
        logger.info("실시간 메트릭 WebSocket 연결", tenant_id=tenant_id)
        
        # 테넌시 존재 확인
        k8s_orch = get_k8s_orchestrator()
        existing_status = await k8s_orch.get_tenant_status(tenant_id)
        if not existing_status:
            await websocket.close(code=4004, reason=f"테넌시 '{tenant_id}' 없음")
            return
        
        # 주기적 메트릭 수집 및 전송
        while True:
            try:
                await collect_metrics_background(tenant_id)
                await asyncio.sleep(5)  # 5초마다 업데이트
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error("WebSocket 메트릭 전송 오류", tenant_id=tenant_id, error=str(e))
                break
                
    except WebSocketDisconnect:
        logger.info("WebSocket 연결 해제", tenant_id=tenant_id)
    except Exception as e:
        logger.error("WebSocket 연결 오류", tenant_id=tenant_id, error=str(e))
    finally:
        manager.disconnect(websocket, tenant_id)


@router.get("/{tenant_id}/metrics", response_model=TenantMetrics)
async def get_tenant_metrics(tenant_id: str):
    """
    테넌시 메트릭 조회 (REST)
    - 현재 시점의 리소스 사용률
    """
    try:
        logger.info("테넌시 메트릭 조회", tenant_id=tenant_id)
        
        # 테넌시 존재 확인
        k8s_orch = get_k8s_orchestrator()
        existing_status = await k8s_orch.get_tenant_status(tenant_id)
        if not existing_status:
            raise HTTPException(
                status_code=404,
                detail=f"테넌시 '{tenant_id}'를 찾을 수 없습니다"
            )
        
        # 메트릭 수집 (실제 구현에서는 Prometheus 쿼리)
        import random
        metrics = TenantMetrics(
            tenant_id=tenant_id,
            cpu_usage=random.uniform(20, 80),
            memory_usage=random.uniform(30, 70),
            gpu_usage=random.uniform(10, 90),
            network_io={"rx": random.uniform(1, 10), "tx": random.uniform(1, 10)},
            active_connections=random.randint(10, 100)
        )
        
        return metrics
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("테넌시 메트릭 조회 실패", tenant_id=tenant_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"테넌시 메트릭 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/")
async def list_tenants():
    """
    테넌시 목록 조회
    - 모든 활성 테넌시 목록
    """
    try:
        logger.info("테넌시 목록 조회")
        
        # 실제 구현에서는 Kubernetes API로 네임스페이스 목록 조회
        # 여기서는 임시 데이터
        tenants = [
            {
                "tenant_id": "demo-tenant",
                "preset": "small",
                "status": "Running",
                "services_count": 3,
                "created_at": "2024-12-01T10:00:00Z"
            }
        ]
        
        return {
            "tenants": tenants,
            "total_count": len(tenants)
        }
        
    except Exception as e:
        logger.error("테넌시 목록 조회 실패", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"테넌시 목록 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.post("/{tenant_id}/generate-manifests")
async def generate_tenant_manifests(
    tenant_id: str,
    service_requirements: ServiceRequirements,
    gpu_type: str = "auto",
    tenant_mgr: TenantManager = Depends(get_tenant_manager)
):
    """
    테넌시 Kubernetes 매니페스트 생성 (미리보기)
    - 실제 배포 전 설정 파일 검토
    """
    try:
        logger.info("매니페스트 생성 요청", tenant_id=tenant_id)
        
        # 테넌시 사양 생성
        tenant_specs = tenant_mgr.generate_tenant_specs(
            tenant_id=tenant_id,
            service_requirements=service_requirements.model_dump(),
            gpu_type=gpu_type
        )
        
        # 매니페스트 생성
        manifest_generator = ManifestGenerator()
        manifests = manifest_generator.generate_tenant_manifests(tenant_specs)
        
        return {
            "success": True,
            "tenant_id": tenant_id,
            "preset": tenant_specs.preset,
            "manifests": manifests,
            "manifest_count": len(manifests),
            "estimated_resources": {
                "gpu_type": tenant_specs.gpu_type.value if hasattr(tenant_specs.gpu_type, 'value') else str(tenant_specs.gpu_type),
                "gpu_count": tenant_specs.gpu_count,
                "cpu_cores": tenant_specs.cpu_cores
            }
        }
        
    except Exception as e:
        logger.error("매니페스트 생성 실패", tenant_id=tenant_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"매니페스트 생성 중 오류가 발생했습니다: {str(e)}"
        )


@router.post("/{tenant_id}/download-package")
async def download_deployment_package(
    tenant_id: str,
    service_requirements: ServiceRequirements,
    gpu_type: str = "auto",
    tenant_mgr: TenantManager = Depends(get_tenant_manager)
):
    """
    테넌시 배포 패키지 다운로드
    - Kubernetes 매니페스트
    - 배포/정리 스크립트
    - README 문서
    - 테넌시 사양 JSON
    """
    try:
        logger.info("배포 패키지 다운로드 요청", tenant_id=tenant_id)
        
        # 테넌시 사양 생성
        tenant_specs = tenant_mgr.generate_tenant_specs(
            tenant_id=tenant_id,
            service_requirements=service_requirements.model_dump(),
            gpu_type=gpu_type
        )
        
        # 배포 패키지 생성
        manifest_generator = ManifestGenerator()
        zip_buffer = manifest_generator.create_deployment_package(tenant_specs)
        
        # 파일명 생성
        filename = f"ecp-ai-{tenant_id}-{tenant_specs.preset}-deployment.zip"
        
        logger.info("배포 패키지 다운로드 준비 완료", 
                   tenant_id=tenant_id, filename=filename)
        
        return StreamingResponse(
            BytesIO(zip_buffer.read()),
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Description": f"ECP-AI Tenant {tenant_id} Deployment Package"
            }
        )
        
    except Exception as e:
        logger.error("배포 패키지 생성 실패", tenant_id=tenant_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"배포 패키지 생성 중 오류가 발생했습니다: {str(e)}"
        )


@router.post("/{tenant_id}/validate-deployment")
async def validate_deployment(
    tenant_id: str,
    service_requirements: ServiceRequirements,
    gpu_type: str = "auto",
    tenant_mgr: TenantManager = Depends(get_tenant_manager)
):
    """
    배포 전 검증
    - 리소스 요구사항 검증
    - 클러스터 용량 확인
    - 잠재적 충돌 검사
    """
    try:
        logger.info("배포 검증 요청", tenant_id=tenant_id)
        
        # 테넌시 사양 생성
        tenant_specs = tenant_mgr.generate_tenant_specs(
            tenant_id=tenant_id,
            service_requirements=service_requirements.model_dump(),
            gpu_type=gpu_type
        )
        
        # 리소스 계산
        resource_calculator = ResourceCalculator(tenant_mgr.service_matrix)
        comprehensive_requirements = resource_calculator.calculate_comprehensive_requirements(
            service_requirements.model_dump(),
            gpu_type
        )
        
        # 검증 결과
        validation_results = {
            "resource_validation": {
                "gpu_requirements": comprehensive_requirements.gpu,
                "cpu_requirements": comprehensive_requirements.cpu,
                "memory_requirements": comprehensive_requirements.memory,
                "storage_requirements": comprehensive_requirements.storage
            },
            "deployment_warnings": [],
            "deployment_errors": [],
            "recommendations": []
        }
        
        # 기본 검증 로직
        gpu_count = comprehensive_requirements.gpu.get("total", 0)
        cpu_total = comprehensive_requirements.cpu.get("total", 0)
        
        # 경고 및 권장사항
        if gpu_count > 8:
            validation_results["deployment_warnings"].append(
                "높은 GPU 요구사항: L40S 타입 사용을 권장합니다"
            )
        
        if cpu_total > 64:
            validation_results["deployment_warnings"].append(
                "높은 CPU 요구사항: 클러스터 용량을 확인하세요"
            )
        
        # 권장사항
        if tenant_specs.preset == "large":
            validation_results["recommendations"].append(
                "대규모 환경: 전용 노드 풀 사용을 권장합니다"
            )
        
        validation_results["recommendations"].append(
            f"예상 월간 비용: ${gpu_count * 0.35 * 24 * 30:.0f} (T4 기준)"
        )
        
        return {
            "success": True,
            "tenant_id": tenant_id,
            "preset": tenant_specs.preset,
            "validation_results": validation_results,
            "ready_for_deployment": len(validation_results["deployment_errors"]) == 0
        }
        
    except Exception as e:
        logger.error("배포 검증 실패", tenant_id=tenant_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"배포 검증 중 오류가 발생했습니다: {str(e)}"
        )


# ==========================================
# ECP 계산 엔진 API 엔드포인트
# ==========================================

@router.post("/calculate-detailed-hardware")
async def calculate_detailed_hardware(
    service_requirements: ServiceRequirements,
    gpu_type: str = "t4"
) -> Dict[str, Any]:
    """
    상세 하드웨어 사양 계산 (ECP 계산 엔진 사용)
    """
    try:
        logger.info("상세 하드웨어 계산 요청", 
                   service_requirements=service_requirements.model_dump(), 
                   gpu_type=gpu_type)
        
        # ECP 계산 엔진 어댑터 초기화
        calculator = ECPCalculatorAdapter()
        
        # 상세 하드웨어 사양 계산
        result = calculator.generate_detailed_hardware_spec(
            service_requirements.model_dump(),
            gpu_type
        )
        
        logger.info("상세 하드웨어 계산 완료", 
                   success=result.get("success", False),
                   total_gpus=result.get("summary", {}).get("total_gpu_count", 0))
        
        return result
        
    except Exception as e:
        logger.error("상세 하드웨어 계산 실패", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"상세 하드웨어 계산 중 오류가 발생했습니다: {str(e)}"
        )


@router.post("/compare-gpu-options")
async def compare_gpu_options(
    service_requirements: ServiceRequirements
) -> Dict[str, Any]:
    """
    GPU 옵션별 비교 분석 (ECP 계산 엔진 사용)
    """
    try:
        logger.info("GPU 옵션 비교 요청", 
                   service_requirements=service_requirements.model_dump())
        
        # ECP 계산 엔진 어댑터 초기화
        calculator = ECPCalculatorAdapter()
        
        # GPU 옵션 비교
        result = calculator.compare_gpu_options(
            service_requirements.model_dump()
        )
        
        logger.info("GPU 옵션 비교 완료", 
                   success=result.get("success", False),
                   recommendation=result.get("recommendation", "t4"))
        
        return result
        
    except Exception as e:
        logger.error("GPU 옵션 비교 실패", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"GPU 옵션 비교 중 오류가 발생했습니다: {str(e)}"
        )


@router.post("/cloud-instance-mapping")
async def get_cloud_instance_mapping(
    service_requirements: ServiceRequirements,
    gpu_type: str = "t4",
    cloud_provider: str = "aws"
) -> Dict[str, Any]:
    """
    클라우드 인스턴스 매핑 (ECP 계산 엔진 사용)
    """
    try:
        logger.info("클라우드 인스턴스 매핑 요청", 
                   service_requirements=service_requirements.model_dump(),
                   gpu_type=gpu_type,
                   cloud_provider=cloud_provider)
        
        # ECP 계산 엔진 어댑터 초기화
        calculator = ECPCalculatorAdapter()
        
        # 클라우드 인스턴스 매핑
        result = calculator.get_cloud_instance_mapping(
            service_requirements.model_dump(),
            gpu_type,
            cloud_provider
        )
        
        logger.info("클라우드 인스턴스 매핑 완료", 
                   success=result.get("success", False),
                   provider=cloud_provider)
        
        return result
        
    except Exception as e:
        logger.error("클라우드 인스턴스 매핑 실패", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"클라우드 인스턴스 매핑 중 오류가 발생했습니다: {str(e)}"
        )

@router.post("/{tenant_id}/advanced-config-recommendations")
async def get_advanced_config_recommendations(
    tenant_id: str,
    service_requirements: ServiceRequirements,
    tenant_mgr: TenantManager = Depends(get_tenant_manager)
):
    """
    고급 설정 추천값 조회
    - 환경변수 추천값
    - 볼륨 마운트 추천값
    - 헬스체크 설정 추천값
    - 네트워크 설정 추천값
    """
    try:
        logger.info("고급 설정 추천값 요청", tenant_id=tenant_id)
        
        # 프리셋 감지
        preset = tenant_mgr.detect_tenant_preset(service_requirements.model_dump())
        
        # 고급 설정 추천값 생성
        recommendations = tenant_mgr.get_advanced_configuration_recommendations(
            preset=preset,
            service_requirements=service_requirements.model_dump()
        )
        
        return {
            "success": True,
            "tenant_id": tenant_id,
            "preset": preset,
            "recommendations": recommendations,
            "generated_at": recommendations["metadata"]["generated_at"]
        }
        
    except Exception as e:
        logger.error("고급 설정 추천값 생성 실패", tenant_id=tenant_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"고급 설정 추천값 생성 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/preset-templates/{preset_type}")
async def get_preset_template(
    preset_type: str,
    tenant_mgr: TenantManager = Depends(get_tenant_manager)
):
    """
    프리셋별 기본 템플릿 조회
    - micro, small, medium, large 프리셋별 기본 설정
    """
    try:
        preset = preset_type.lower()
        if preset not in ["micro", "small", "medium", "large"]:
            raise HTTPException(
                status_code=400,
                detail="지원하지 않는 프리셋 타입입니다. micro, small, medium, large 중 선택하세요."
            )
        
        # 기본 서비스 요구사항 (프리셋별)
        base_requirements = {
            "micro": {"callbot": 5, "chatbot": 20, "advisor": 2, "stt": 0, "tts": 0, "ta": 0, "qa": 0},
            "small": {"callbot": 20, "chatbot": 100, "advisor": 10, "stt": 0, "tts": 0, "ta": 0, "qa": 0},
            "medium": {"callbot": 100, "chatbot": 500, "advisor": 50, "stt": 0, "tts": 0, "ta": 0, "qa": 0},
            "large": {"callbot": 500, "chatbot": 2000, "advisor": 200, "stt": 0, "tts": 0, "ta": 0, "qa": 0}
        }
        
        # 고급 설정 추천값 생성
        recommendations = tenant_mgr.get_advanced_configuration_recommendations(
            preset=preset,
            service_requirements=base_requirements[preset]
        )
        
        return {
            "success": True,
            "preset": preset,
            "base_requirements": base_requirements[preset],
            "recommendations": recommendations,
            "description": f"{preset.upper()} 프리셋 기본 템플릿"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("프리셋 템플릿 조회 실패", preset_type=preset_type, error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"프리셋 템플릿 조회 중 오류가 발생했습니다: {str(e)}"
        )


# ==========================================
# 고급 모니터링 API 엔드포인트
# ==========================================

@router.get("/monitoring/system-metrics")
async def get_system_metrics() -> Dict[str, Any]:
    """
    시스템 전체 메트릭 조회 (데모 데이터)
    """
    import random
    from datetime import datetime, timedelta
    
    try:
        logger.info("시스템 메트릭 조회 요청")
        
        # 가상 시스템 메트릭 생성
        current_time = datetime.now()
        metrics_data = []
        
        for i in range(60):  # 최근 1시간 데이터
            timestamp = current_time - timedelta(minutes=i)
            metrics_data.append({
                "timestamp": timestamp.isoformat(),
                "cpu_usage": random.uniform(20, 80),
                "memory_usage": random.uniform(30, 75),
                "gpu_usage": random.uniform(10, 90),
                "network_io": random.uniform(50, 200),
                "active_tenants": random.randint(3, 7),
                "total_requests": random.randint(100, 1000),
                "error_rate": random.uniform(0, 2.5)
            })
        
        return {
            "success": True,
            "metrics": metrics_data[::-1],  # 시간순 정렬
            "summary": {
                "total_tenants": 5,
                "active_services": 25,
                "avg_cpu": sum(m["cpu_usage"] for m in metrics_data) / len(metrics_data),
                "avg_memory": sum(m["memory_usage"] for m in metrics_data) / len(metrics_data),
                "system_health": "healthy"
            }
        }
        
    except Exception as e:
        logger.error("시스템 메트릭 조회 실패", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"시스템 메트릭 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/monitoring/tenant-comparison")
async def get_tenant_comparison() -> Dict[str, Any]:
    """
    테넌시별 성능 비교 데이터 (데모 데이터)
    """
    import random
    
    try:
        logger.info("테넌시 비교 데이터 조회 요청")
        
        demo_tenants = [
            {"id": "tenant-001", "name": "글로벌 콜센터", "preset": "large"},
            {"id": "tenant-002", "name": "스마트 상담봇", "preset": "medium"}, 
            {"id": "tenant-003", "name": "음성 분석 서비스", "preset": "small"},
            {"id": "tenant-004", "name": "AI 어드바이저", "preset": "medium"},
            {"id": "tenant-005", "name": "개발 테스트", "preset": "micro"}
        ]
        
        comparison_data = []
        for tenant in demo_tenants:
            status = random.choice(["healthy", "warning", "critical"]) if random.random() > 0.7 else "healthy"
            comparison_data.append({
                "tenant_id": tenant["id"],
                "name": tenant["name"],
                "preset": tenant["preset"],
                "status": status,
                "cpu_usage": random.uniform(10, 85),
                "memory_usage": random.uniform(20, 80),
                "gpu_usage": random.uniform(5, 95),
                "availability": random.uniform(99.0, 99.99),
                "response_time": random.uniform(50, 300),
                "throughput": random.randint(100, 2000),
                "error_count": random.randint(0, 25),
                "active_connections": random.randint(10, 500)
            })
        
        return {
            "success": True,
            "tenants": comparison_data,
            "total_count": len(comparison_data)
        }
        
    except Exception as e:
        logger.error("테넌시 비교 데이터 조회 실패", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"테넌시 비교 데이터 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/monitoring/sla-trends")
async def get_sla_trends() -> Dict[str, Any]:
    """
    SLA 메트릭 트렌드 데이터 (데모 데이터)
    """
    import random
    from datetime import datetime, timedelta
    
    try:
        logger.info("SLA 트렌드 데이터 조회 요청")
        
        current_time = datetime.now()
        trend_data = []
        
        for i in range(24):  # 최근 24시간
            timestamp = current_time - timedelta(hours=i)
            trend_data.append({
                "timestamp": timestamp.isoformat(),
                "hour": timestamp.strftime("%H:00"),
                "availability": random.uniform(99.5, 99.99),
                "response_time": random.uniform(80, 150),
                "error_rate": random.uniform(0, 0.8),
                "throughput": random.randint(500, 1500),
                "concurrent_users": random.randint(50, 300)
            })
        
        # SLA 목표 대비 성과 계산
        avg_availability = sum(t["availability"] for t in trend_data) / len(trend_data)
        avg_response_time = sum(t["response_time"] for t in trend_data) / len(trend_data)
        avg_error_rate = sum(t["error_rate"] for t in trend_data) / len(trend_data)
        avg_throughput = sum(t["throughput"] for t in trend_data) / len(trend_data)
        
        return {
            "success": True,
            "trends": trend_data[::-1],  # 시간순 정렬
            "sla_summary": {
                "availability": {
                    "current": avg_availability,
                    "target": 99.9,
                    "status": "good" if avg_availability >= 99.9 else "warning"
                },
                "response_time": {
                    "current": avg_response_time,
                    "target": 100,
                    "status": "good" if avg_response_time <= 100 else "warning"
                },
                "error_rate": {
                    "current": avg_error_rate,
                    "target": 0.5,
                    "status": "good" if avg_error_rate <= 0.5 else "warning"
                },
                "throughput": {
                    "current": avg_throughput,
                    "target": 1000,
                    "status": "good" if avg_throughput >= 1000 else "warning"
                }
            }
        }
        
    except Exception as e:
        logger.error("SLA 트렌드 데이터 조회 실패", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"SLA 트렌드 데이터 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/monitoring/alerts")
async def get_monitoring_alerts() -> Dict[str, Any]:
    """
    모니터링 알림 목록 조회 (데모 데이터)
    """
    import random
    from datetime import datetime, timedelta
    
    try:
        logger.info("모니터링 알림 조회 요청")
        
        alert_types = ["info", "warning", "error"]
        alert_messages = [
            "CPU 사용률이 임계값을 초과했습니다",
            "GPU 메모리 부족 경고가 발생했습니다", 
            "응답 시간이 SLA 기준을 초과했습니다",
            "네트워크 지연이 감지되었습니다",
            "자동 스케일링이 실행되었습니다",
            "새로운 테넌시가 생성되었습니다",
            "백업 작업이 완료되었습니다",
            "보안 정책 위반이 감지되었습니다"
        ]
        
        tenants = ["글로벌 콜센터", "스마트 상담봇", "음성 분석 서비스", "AI 어드바이저", "개발 테스트"]
        
        alerts = []
        for i in range(12):
            alert_time = datetime.now() - timedelta(minutes=random.randint(1, 1440))
            alerts.append({
                "id": i + 1,
                "type": random.choice(alert_types),
                "severity": random.choice(["low", "medium", "high", "critical"]),
                "message": random.choice(alert_messages),
                "tenant": random.choice(tenants),
                "timestamp": alert_time.isoformat(),
                "resolved": random.random() > 0.6,
                "acknowledged": random.random() > 0.4
            })
        
        return {
            "success": True,
            "alerts": sorted(alerts, key=lambda x: x["timestamp"], reverse=True),
            "summary": {
                "total": len(alerts),
                "unresolved": len([a for a in alerts if not a["resolved"]]),
                "critical": len([a for a in alerts if a["severity"] == "critical"]),
                "last_24h": len([a for a in alerts if (datetime.now() - datetime.fromisoformat(a["timestamp"])).days == 0])
            }
        }
        
    except Exception as e:
        logger.error("모니터링 알림 조회 실패", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"모니터링 알림 조회 중 오류가 발생했습니다: {str(e)}"
        )
