# [advice from AI] ECP-AI 테넌시 관리 API 엔드포인트
"""
ECP-AI 테넌시 관리 REST API
- 테넌시 생성/조회/삭제 완전 구현
- 실시간 메트릭 WebSocket 지원
- 백그라운드 작업 처리
- FastAPI + Pydantic 모델 + 비동기 처리
"""

import asyncio
import time
import os
import subprocess
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect, Depends, Header
from typing import Optional
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
    HealthCheckConfig, NetworkConfig, KubernetesAdvancedConfig,
    TenantMetrics
)
from app.core.ecp_calculator_adapter import ECPCalculatorAdapter
# [advice from AI] ServiceConfigurationManager 제거 - 새로운 CICD 이미지 시스템으로 대체
# from app.models.service_config import (
#     ServiceConfigurationManager, ServiceSpecificConfig, 
#     ServiceImageConfig, ServiceKubernetesConfig, BuildOptimizationLevel
# )

# [advice from AI] 데이터베이스 모델 임포트 추가
from app.models.database import get_db, Tenant, Service, MonitoringData, DashboardConfig
from app.core.database_manager import db_manager
from sqlalchemy.orm import Session

logger = structlog.get_logger(__name__)

# FastAPI 라우터 생성
router = APIRouter(prefix="/tenants", tags=["tenants"])

# [advice from AI] 데모 모드 헤더 처리 헬퍼 함수
def get_db_session(x_demo_mode: Optional[str] = Header(None)):
    """
    헤더의 데모 모드 정보에 따라 적절한 DB 세션 반환
    
    Args:
        x_demo_mode: 데모 모드 헤더 (true/false)
    
    Returns:
        DB 세션 제너레이터
    """
    # [advice from AI] 데모 모드 제거 - 단일 데이터베이스 사용
    session = db_manager.get_session()
    try:
        yield session
    finally:
        session.close()

# 전역 의존성 (실제 구현에서는 Dependency Injection 사용)
tenant_manager = None
k8s_orchestrator = None
service_config_manager = None

def get_tenant_manager() -> TenantManager:
    """TenantManager 의존성 주입"""
    global tenant_manager
    if tenant_manager is None:
        tenant_manager = TenantManager()
    return tenant_manager

def get_k8s_orchestrator() -> Optional[K8sOrchestrator]:
    """K8sOrchestrator 의존성 주입 (개발 환경에서는 None 가능)"""
    global k8s_orchestrator
    if k8s_orchestrator is None:
        try:
            k8s_orchestrator = K8sOrchestrator()
            logger.info("K8sOrchestrator 초기화 성공")
        except Exception as e:
            logger.warning(f"K8sOrchestrator 초기화 실패 - 시뮬레이터 모드로 동작: {e}")
            k8s_orchestrator = None
    return k8s_orchestrator


# [advice from AI] ServiceConfigurationManager 제거 - 새로운 CICD 이미지 시스템으로 대체
# def get_service_config_manager() -> ServiceConfigurationManager:
#     """ServiceConfigurationManager 의존성 주입"""
#     global service_config_manager
#     if service_config_manager is None:
#         service_config_manager = ServiceConfigurationManager()
#     return service_config_manager


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
                    "gpu": {"type": "t4", "count": 3, "memory_gb": 42.06},
                    "cpu": {"cores": 31, "usage_percent": 65.2},
                    "memory": {"total": "16Gi", "usage_percent": 72.1},
                    "storage": {"total": "1.0TB", "usage_percent": 45.8}
                },
                "deployment_status": "deploying",
                "created_at": "2024-01-15T10:30:00Z"
            }
        }


class TenantSummary(BaseModel):
    """테넌시 요약 정보 모델"""
    tenant_id: str = Field(..., description="테넌시 ID")
    name: Optional[str] = Field(None, description="테넌시 이름")
    preset: str = Field(..., description="프리셋 타입")
    is_demo: bool = Field(False, description="데모 테넌시 여부")
    status: str = Field(..., description="테넌시 상태")
    services_count: int = Field(..., description="서비스 개수")
    created_at: datetime = Field(..., description="생성 시간")
    service_config: Dict[str, int] = Field(..., description="서비스 구성 정보")
    
    class Config:
        json_schema_extra = {
            "example": {
                "tenant_id": "demo-tenant",
                "name": "데모 테넌시",
                "preset": "small",
                "is_demo": True,
                "status": "active",
                "services_count": 3,
                "created_at": "2024-01-15T10:30:00Z",
                "service_config": {
                    "callbot": 5,
                    "chatbot": 20,
                    "advisor": 2,
                    "stt": 0,
                    "tts": 0,
                    "ta": 0,
                    "qa": 0
                }
            }
        }


class TenantListResponse(BaseModel):
    """테넌시 목록 응답 모델"""
    tenants: List[TenantSummary] = Field(..., description="테넌시 목록")
    total_count: int = Field(..., description="전체 테넌시 수")
    demo_count: int = Field(..., description="데모 테넌시 수")
    active_count: int = Field(..., description="활성 테넌시 수")


# ==========================================
# 데이터베이스 연동 함수들
# ==========================================

async def get_tenants_from_db(db: Session) -> List[Dict[str, Any]]:
    """데이터베이스에서 테넌시 목록 조회"""
    try:
        # 테넌시 및 서비스 정보 조회
        tenants = db.query(Tenant).all()
        tenant_summaries = []
        
        for tenant in tenants:
            # [advice from AI] Service 테이블에서 실제 서비스 개수 조회 (service_requirements는 처리량 데이터)
            services = db.query(Service).filter(Service.tenant_id == tenant.tenant_id).all()
            total_services = len(services)
            
            # [advice from AI] 실제 배포된 서비스에서 서비스 구성 추출 (service_name 기준)
            service_names = [s.service_name for s in services] if services else []
            service_config = {
                "callbot": service_names.count("callbot"),
                "chatbot": service_names.count("chatbot"), 
                "advisor": service_names.count("advisor"),
                "stt": len([s for s in service_names if 'stt' in s.lower()]),
                "tts": len([s for s in service_names if 'tts' in s.lower()]),
                "ta": len([s for s in service_names if s in ['ta', 'ta-server']]),
                "qa": service_names.count("qa")
            }
            
            # service_requirements는 처리량 정보로 별도 보관 (서비스 개수 계산에는 사용 안함)
            service_requirements = tenant.service_requirements or {}
            
            # [advice from AI] GPU 정보 추출 (resources에서)
            resources = tenant.resources or {}
            gpu_info = None
            gpu_usage = None
            
            if tenant.gpu_type and tenant.gpu_limit and tenant.gpu_limit > 0:
                gpu_info = {
                    "type": tenant.gpu_type,
                    "allocated": tenant.gpu_limit,
                    "utilization": resources.get("gpu_utilization", 0)
                }
                # [advice from AI] 시뮬레이터에서 실시간 모니터링 데이터 가져오기
                import random  # [advice from AI] random import를 함수 시작 부분으로 이동
                monitoring_data = {}
                if tenant.status == "running":
                    try:
                        from app.services.k8s_simulator_client import get_simulator_client
                        simulator_client = get_simulator_client()
                        monitoring_data = await simulator_client.get_tenant_monitoring_data(tenant.tenant_id)
                        gpu_usage = monitoring_data.get("gpu_usage", 0)
                    except Exception as e:
                        logger.warning(f"시뮬레이터 모니터링 데이터 조회 실패 (tenant: {tenant.tenant_id}): {e}")
                        # 폴백으로 랜덤값 사용
                        gpu_usage = round(random.uniform(20, 85), 1)
                        monitoring_data = {
                            "cpu_usage": round(random.uniform(30, 75), 1),
                            "memory_usage": round(random.uniform(40, 80), 1),
                            "gpu_usage": gpu_usage
                        }
                else:
                    gpu_usage = 0
                    monitoring_data = {
                        "cpu_usage": 0,
                        "memory_usage": 0,
                        "gpu_usage": 0
                    }
            
            # [advice from AI] 서비스 구성 정보와 GPU 정보를 포함한 dict 생성
            tenant_dict = {
                "tenant_id": tenant.tenant_id,
                "name": tenant.name,
                "preset": tenant.preset,
                "is_demo": tenant.is_demo,
                "status": tenant.status,
                "services_count": total_services,
                "created_at": tenant.created_at.isoformat(),
                # [advice from AI] 실제 서비스 구성 정보
                "service_config": service_config,
                # [advice from AI] GPU 정보 추가
                "gpu_info": gpu_info,
                "gpu_usage": gpu_usage,
                # [advice from AI] 시뮬레이터에서 가져온 실시간 리소스 사용률
                "cpu_usage": monitoring_data.get("cpu_usage", 0),
                "memory_usage": monitoring_data.get("memory_usage", 0),
                "storage_usage": round(random.uniform(20, 60), 1) if tenant.status == "running" else 0
            }
            
            tenant_summaries.append(tenant_dict)
        
        return tenant_summaries
        
    except Exception as e:
        logger.error(f"데이터베이스에서 테넌시 조회 실패: {e}")
        return []


async def create_tenant_in_db(db: Session, tenant_data: dict) -> Tenant:
    """데이터베이스에 테넌시 생성"""
    try:
        tenant = Tenant(**tenant_data)
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
        return tenant
        
    except Exception as e:
        logger.error(f"데이터베이스에 테넌시 생성 실패: {e}")
        db.rollback()
        raise


# ==========================================
# 백그라운드 작업 함수들
# ==========================================

async def deploy_tenant_to_simulator(
    tenant_id: str, 
    manifest_content: str, 
    tenant_specs: TenantSpecs
):
    """
    [advice from AI] 백그라운드에서 테넌시를 시뮬레이터에 배포
    - 매니페스트를 시뮬레이터로 전송
    - 가상 서버 구동 시작
    - Mock 모니터링 데이터 생성 활성화
    """
    try:
        logger.info("시뮬레이터 배포 백그라운드 작업 시작", tenant_id=tenant_id)
        
        # 시뮬레이터 API 호출
        import httpx
        simulator_url = os.getenv('K8S_SIMULATOR_EXTERNAL_URL', 'http://localhost:6360')
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # 1. 시뮬레이터 연결 확인
            try:
                health_response = await client.get(f"{simulator_url}/")
                if health_response.status_code != 200:
                    raise Exception("시뮬레이터 연결 실패")
                logger.info("시뮬레이터 연결 확인 완료", tenant_id=tenant_id)
            except Exception as health_error:
                logger.error("시뮬레이터 연결 실패", tenant_id=tenant_id, error=str(health_error))
                await update_tenant_status(tenant_id, "deploy_failed", f"시뮬레이터 연결 실패: {str(health_error)}")
                return
            
            # 2. 매니페스트 파싱 및 검증
            try:
                parse_response = await client.post(
                    f"{simulator_url}/k8s/manifest/parse",
                    json={
                        "manifest": manifest_content,
                        "tenant_id": tenant_id
                    }
                )
                if parse_response.status_code != 200:
                    raise Exception(f"매니페스트 검증 실패: {parse_response.text}")
                logger.info("매니페스트 검증 완료", tenant_id=tenant_id)
            except Exception as parse_error:
                logger.error("매니페스트 검증 실패", tenant_id=tenant_id, error=str(parse_error))
                await update_tenant_status(tenant_id, "deploy_failed", f"매니페스트 검증 실패: {str(parse_error)}")
                return
            
            # 3. 시뮬레이터에 배포
            try:
                deploy_response = await client.post(
                    f"{simulator_url}/k8s/manifest/deploy",
                    json={
                        "manifest": manifest_content,
                        "tenant_id": tenant_id
                    }
                )
                if deploy_response.status_code != 200:
                    raise Exception(f"시뮬레이터 배포 실패: {deploy_response.text}")
                
                deploy_result = deploy_response.json()
                logger.info("시뮬레이터 배포 시작 완료", tenant_id=tenant_id, result=deploy_result)
                
                # [advice from AI] 즉시 running으로 변경하지 않고, 자동 완료 타이머 시작
                await update_tenant_status(tenant_id, "deploying", "시뮬레이터 배포 진행 중 - 자동 완료 대기")
                
                # 백그라운드에서 자동 완료 처리 (60-120초 후)
                import asyncio
                import random
                deployment_duration = random.randint(60, 120)  # 1-2분 랜덤
                asyncio.create_task(auto_complete_deployment(tenant_id, deployment_duration))
                
            except Exception as deploy_error:
                logger.error("시뮬레이터 배포 실패", tenant_id=tenant_id, error=str(deploy_error))
                await update_tenant_status(tenant_id, "deploy_failed", f"시뮬레이터 배포 실패: {str(deploy_error)}")
                return
        
        logger.info("시뮬레이터 배포 백그라운드 작업 완료", tenant_id=tenant_id)
        
    except Exception as e:
        logger.error("시뮬레이터 배포 백그라운드 작업 실패", tenant_id=tenant_id, error=str(e))
        await update_tenant_status(tenant_id, "deploy_failed", f"배포 작업 실패: {str(e)}")


async def update_tenant_status(tenant_id: str, status: str, message: str = None):
    """
    [advice from AI] 테넌시 상태 업데이트 (백그라운드 작업용)
    """
    try:
        db = db_manager.get_session()
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if tenant:
            tenant.status = status
            if message:
                tenant.description = f"{tenant.description or ''}\n[{datetime.utcnow()}] {message}"
            db.commit()
            logger.info("테넌시 상태 업데이트", tenant_id=tenant_id, status=status)
        db.close()
    except Exception as e:
        logger.error("테넌시 상태 업데이트 실패", tenant_id=tenant_id, error=str(e))


async def auto_complete_deployment(tenant_id: str, deployment_duration: int = 120):
    """[advice from AI] 배포 완료 자동 처리 - deploying -> running 상태 전환
    
    Args:
        tenant_id: 테넌트 ID
        deployment_duration: 배포 소요 시간 (초, 기본 2분)
    """
    try:
        logger.info(f"자동 배포 완료 스케줄링: {tenant_id} (소요시간: {deployment_duration}초)")
        
        # 배포 시간 대기 (실제로는 K8s 배포 모니터링)
        await asyncio.sleep(deployment_duration)
        
        # 90% 확률로 성공, 10% 확률로 실패 (실제 환경 시뮬레이션)
        import random
        deployment_success = random.random() > 0.1
        
        if deployment_success:
            await update_tenant_status(tenant_id, "running", "자동 배포 완료")
            logger.info(f"자동 배포 완료: {tenant_id}")
        else:
            await update_tenant_status(tenant_id, "failed", "배포 실패 - 자동 재시도 대기")
            logger.warning(f"배포 실패: {tenant_id}")
        
    except Exception as e:
        logger.error(f"자동 배포 완료 처리 실패: {tenant_id}, 오류: {e}")
        # 실패 시 failed 상태로 변경
        await update_tenant_status(tenant_id, "failed", f"배포 처리 오류: {str(e)}")


async def check_and_fix_stuck_deployments():
    """[advice from AI] 시스템 시작 시 deploying 상태로 멈춰있는 테넌트들 자동 처리"""
    try:
        logger.info("배포 상태 체크 시작")
        
        # DB 세션 생성
        db = next(get_db_session())
        
        # deploying 상태인 모든 테넌시 조회
        deploying_tenants = db.query(Tenant).filter(Tenant.status == "deploying").all()
        
        if deploying_tenants:
            logger.info(f"발견된 deploying 상태 테넌시: {len(deploying_tenants)}개")
            
            for tenant in deploying_tenants:
                logger.info(f"자동 완료 처리 시작: {tenant.id}")
                # 즉시 자동 완료 처리 (10-60초 랜덤 지연)
                import random
                short_delay = random.randint(10, 60)
                asyncio.create_task(auto_complete_deployment(tenant.id, short_delay))
        else:
            logger.info("deploying 상태인 테넌시가 없습니다")
        
        db.close()
                    
    except Exception as e:
        logger.error(f"멈춰있는 배포 상태 체크 실패: {e}")


# ==========================================
# API 엔드포인트 구현
# ==========================================

@router.get("/", response_model=TenantListResponse)
async def list_tenants(
    db: Session = Depends(get_db_session),
    x_demo_mode: Optional[str] = Header(None)
):
    """
    테넌시 목록 조회
    - 데이터베이스에서 테넌시 정보 조회
    - 데모/운영 구분
    - 서비스 개수 포함
    """
    try:
        # [advice from AI] 데모 모드 제거 - 단일 데이터베이스 사용
        logger.info("테넌시 목록 조회")
        
        tenants = await get_tenants_from_db(db)
        
        # 통계 계산
        total_count = len(tenants)
        demo_count = len([t for t in tenants if t.get('is_demo', False)])
        active_count = len([t for t in tenants if t.get('status') in ["active", "running"]])
        
        return TenantListResponse(
            tenants=[TenantSummary(**tenant) for tenant in tenants],
            total_count=total_count,
            demo_count=demo_count,
            active_count=active_count
        )
        
    except Exception as e:
        logger.error(f"테넌시 목록 조회 실패: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"테넌시 목록 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/{tenant_id}", response_model=TenantSummary)
async def get_tenant(tenant_id: str, db: Session = Depends(get_db)):
    """
    특정 테넌시 정보 조회
    - 데이터베이스에서 테넌시 상세 정보 조회
    """
    try:
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        
        if not tenant:
            raise HTTPException(
                status_code=404,
                detail=f"테넌시 '{tenant_id}'를 찾을 수 없습니다"
            )
        
        # 서비스 개수 계산
        services_count = db.query(Service).filter(Service.tenant_id == tenant.tenant_id).count()
        
        return TenantSummary(
            tenant_id=tenant.tenant_id,
            name=tenant.name,
            preset=tenant.preset,
            is_demo=tenant.is_demo,
            status=tenant.status,
            services_count=services_count,
            created_at=tenant.created_at,
            service_config=tenant.service_config
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"테넌시 정보 조회 실패: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"테넌시 정보 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/check-duplicate/{tenant_id}")
async def check_tenant_id_duplicate(
    tenant_id: str, 
    db: Session = Depends(get_db)
):
    """
    테넌시 ID 중복 확인
    - 실시간 중복 체크를 위한 API
    """
    try:
        existing_tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        
        if existing_tenant:
            return {
                "available": False,
                "message": f"테넌시 ID '{tenant_id}'는 이미 사용 중입니다",
                "existing_tenant": {
                    "name": existing_tenant.name or tenant_id,
                    "preset": existing_tenant.preset,
                    "status": existing_tenant.status,
                    "created_at": existing_tenant.created_at.isoformat(),
                    "services_count": len(existing_tenant.services) if existing_tenant.services else 0
                },
                "suggestions": [
                    f"{tenant_id}-v2",
                    f"{tenant_id}-new",
                    f"{tenant_id}-2024",
                    f"my-{tenant_id}",
                    f"{tenant_id}-prod"
                ]
            }
        else:
            return {
                "available": True,
                "message": f"테넌시 ID '{tenant_id}'는 사용 가능합니다",
                "tenant_id": tenant_id
            }
            
    except Exception as e:
        logger.error(f"테넌시 ID 중복 확인 실패: {e}")
        raise HTTPException(
            status_code=500,
            detail="중복 확인 중 오류가 발생했습니다"
        )


@router.post("/{tenant_id}/start")
async def start_tenant(
    tenant_id: str,
    db: Session = Depends(get_db)
):
    """
    테넌트 시작
    - 중지된 테넌트의 모든 서비스를 시작
    """
    try:
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail=f"테넌트 '{tenant_id}'를 찾을 수 없습니다")
        
        if tenant.status == 'running':
            return {"message": f"테넌트 '{tenant_id}'는 이미 실행 중입니다", "status": "running"}
        
        # 테넌트 상태를 running으로 변경
        tenant.status = 'running'
        db.commit()
        
        logger.info(f"테넌트 '{tenant_id}' 시작됨")
        
        return {
            "success": True,
            "message": f"테넌트 '{tenant_id}' 시작 완료",
            "tenant_id": tenant_id,
            "status": "running"
        }
        
    except Exception as e:
        logger.error(f"테넌트 시작 실패: {e}")
        raise HTTPException(status_code=500, detail=f"테넌트 시작 실패: {str(e)}")


@router.post("/{tenant_id}/stop")
async def stop_tenant(
    tenant_id: str,
    db: Session = Depends(get_db)
):
    """
    테넌트 중지
    - 실행 중인 테넌트의 모든 서비스를 중지
    """
    try:
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail=f"테넌트 '{tenant_id}'를 찾을 수 없습니다")
        
        if tenant.status == 'pending':
            return {"message": f"테넌트 '{tenant_id}'는 이미 중지되어 있습니다", "status": "pending"}
        
        # 테넌트 상태를 pending으로 변경
        tenant.status = 'pending'
        db.commit()
        
        logger.info(f"테넌트 '{tenant_id}' 중지됨")
        
        return {
            "success": True,
            "message": f"테넌트 '{tenant_id}' 중지 완료",
            "tenant_id": tenant_id,
            "status": "pending"
        }
        
    except Exception as e:
        logger.error(f"테넌트 중지 실패: {e}")
        raise HTTPException(status_code=500, detail=f"테넌트 중지 실패: {str(e)}")


@router.post("/{tenant_id}/restart")
async def restart_tenant(
    tenant_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    테넌트 재시작 - [advice from AI] 자동 상태 전환 적용
    - 테넌트를 중지한 후 다시 시작
    """
    try:
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail=f"테넌트 '{tenant_id}'를 찾을 수 없습니다")
        
        # 재시작 중 상태로 변경
        tenant.status = 'deploying'
        db.commit()
        
        # [advice from AI] 백그라운드에서 자동 배포 완료 처리 (60초 후)
        background_tasks.add_task(auto_complete_deployment, tenant_id, 60)
        
        logger.info(f"테넌트 '{tenant_id}' 재시작 시작 - 자동 완료 예정")
        
        return {
            "success": True,
            "message": f"테넌트 '{tenant_id}' 재시작 시작됨 (약 1분 후 완료 예정)",
            "tenant_id": tenant_id,
            "status": "deploying",
            "estimated_completion": "60초 후"
        }
        
    except Exception as e:
        logger.error(f"테넌트 재시작 실패: {e}")
        raise HTTPException(status_code=500, detail=f"테넌트 재시작 실패: {str(e)}")


@router.post("/{tenant_id}/complete-deployment")
async def complete_deployment_manual(
    tenant_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    [advice from AI] deploying 상태인 테넌시를 수동으로 완료 처리
    - 멈춰있는 배포를 강제로 완료 상태로 변경
    """
    try:
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail=f"테넌트 '{tenant_id}'를 찾을 수 없습니다")
        
        if tenant.status != "deploying":
            return {
                "success": False,
                "message": f"테넌트 '{tenant_id}'는 현재 '{tenant.status}' 상태입니다. deploying 상태가 아닙니다.",
                "tenant_id": tenant_id,
                "current_status": tenant.status
            }
        
        # 즉시 자동 완료 처리 (5초 후)
        background_tasks.add_task(auto_complete_deployment, tenant_id, 5)
        
        logger.info(f"테넌트 '{tenant_id}' 수동 배포 완료 처리 시작")
        
        return {
            "success": True,
            "message": f"테넌트 '{tenant_id}' 배포 완료 처리 시작됨 (5초 후 완료)",
            "tenant_id": tenant_id,
            "status": "deploying",
            "estimated_completion": "5초 후"
        }
        
    except Exception as e:
        logger.error(f"배포 완료 처리 실패: {e}")
        raise HTTPException(status_code=500, detail=f"배포 완료 처리 실패: {str(e)}")


@router.delete("/{tenant_id}")
async def delete_tenant(
    tenant_id: str,
    db: Session = Depends(get_db)
):
    """
    테넌트 삭제
    - 테넌트와 관련된 모든 리소스를 삭제
    """
    try:
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail=f"테넌트 '{tenant_id}'를 찾을 수 없습니다")
        
        # 관련된 서비스들도 함께 삭제 (CASCADE 설정으로 자동 삭제됨)
        db.delete(tenant)
        db.commit()
        
        logger.info(f"테넌트 '{tenant_id}' 삭제됨")
        
        return {
            "success": True,
            "message": f"테넌트 '{tenant_id}' 삭제 완료",
            "tenant_id": tenant_id
        }
        
    except Exception as e:
        logger.error(f"테넌트 삭제 실패: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"테넌트 삭제 실패: {str(e)}")


@router.post("/", response_model=TenantCreateResponse)
async def create_tenant(
    request: TenantCreateRequest,
    background_tasks: BackgroundTasks,
    tenant_mgr: TenantManager = Depends(get_tenant_manager),
    db: Session = Depends(get_db_session)
):
    """
    테넌시 생성
    - 서비스 요구사항 기반 자동 프리셋 감지
    - GPU 타입별 최적 리소스 계산
    - 백그라운드 Kubernetes 자동 배포
    - 데이터베이스에 테넌시 정보 저장
    """
    try:
        logger.info(
            "테넌시 생성 요청",
            tenant_id=request.tenant_id,
            service_requirements=request.service_requirements.model_dump(),
            gpu_type=request.gpu_type,
            cloud_provider=request.cloud_provider,
            auto_deploy=request.auto_deploy
        )
        
        # 1. 테넌시 ID 중복 확인
        existing_tenant = db.query(Tenant).filter(Tenant.tenant_id == request.tenant_id).first()
        if existing_tenant:
            raise HTTPException(
                status_code=409,
                detail=f"테넌시 ID '{request.tenant_id}'가 이미 존재합니다. 다른 이름을 사용해주세요. (기존 테넌시 생성일: {existing_tenant.created_at.strftime('%Y-%m-%d %H:%M:%S')})"
            )
        
        # 2. 테넌시 사양 생성 (tenancy_mode 포함)
        tenant_specs = tenant_mgr.generate_tenant_specs(
            tenant_id=request.tenant_id,
            service_requirements=request.service_requirements.model_dump(),
            gpu_type=request.gpu_type,
            cloud_provider=request.cloud_provider,
            tenancy_mode=request.tenancy_mode  # [advice from AI] 테넌시 모드 전달
        )
        
        # 3. 리소스 계산
        resource_calculator = ResourceCalculator(tenant_mgr.service_matrix)
        comprehensive_requirements = resource_calculator.calculate_comprehensive_requirements(
            request.service_requirements.model_dump(),
            request.gpu_type
        )
        
        # 4. 데이터베이스에 테넌시 정보 저장
        tenant_data = {
            "tenant_id": request.tenant_id,
            "name": request.name if hasattr(request, 'name') and request.name else f"테넌시 {request.tenant_id}",
            "preset": tenant_specs.preset,
            "is_demo": False,  # 새로 생성되는 테넌시는 운영용
            "status": "pending",
            "description": request.description if hasattr(request, 'description') and request.description else f"ECP-AI 테넌시 {request.tenant_id}",
            # [advice from AI] 필수 NOT NULL 필드들 추가
            "service_requirements": request.service_requirements.model_dump(),
            "resources": {
                "cpu": comprehensive_requirements.cpu,
                "memory": comprehensive_requirements.memory,
                "gpu": comprehensive_requirements.gpu,
                "storage": comprehensive_requirements.storage
            },
            "sla_target": {
                "availability": "99.3%",
                "response_time": "<300ms"
            },
            # 리소스 제한 정보
            "cpu_limit": f"{int(comprehensive_requirements.cpu.get('total', 8) * 1000)}m",
            "memory_limit": comprehensive_requirements.memory.get("system_ram_gb", "16") + "Gi",
            "gpu_limit": comprehensive_requirements.gpu.get("total", 3),
            "storage_limit": comprehensive_requirements.storage.get("total_tb", "1.0") + "TB",
            "gpu_type": request.gpu_type,
            "sla_availability": "99.3%",
            "sla_response_time": "<300ms",
            "k8s_namespace": f"tenant-{request.tenant_id}",
            "created_by": "api_user",
            "monitoring_enabled": True,
            "auto_scaling_enabled": False,
            "backup_enabled": False
        }
        
        # 4-5. 하나의 트랜잭션으로 테넌트와 서비스 모두 생성
        try:
            # 테넌트 생성
            tenant = Tenant(**tenant_data)
            db.add(tenant)
            db.flush()  # ID 생성을 위해 flush (commit 전)
            
            # [advice from AI] 실제 배포되는 모든 서비스 정보 저장
            services_created = 0
            service_requirements = request.service_requirements.model_dump()
            
            # 1. 메인 서비스 (사용자가 선택한 것들)
            for service_name, count in service_requirements.items():
                if count > 0:
                    service_data = {
                        "tenant_id": tenant.tenant_id,
                        "service_name": service_name,
                        "service_type": "main_service",
                        "enabled": True,
                        "count": count,
                        "min_replicas": max(1, count // 3),
                        "max_replicas": count * 2,
                        "target_cpu": 60,
                        "image_name": f"ecp-ai/{service_name}",
                        "image_tag": "latest",
                        "cpu_request": "100m",
                        "memory_request": "256Mi",
                        "gpu_request": 1 if service_name in ['callbot', 'chatbot', 'advisor'] else 0
                    }
                    service = Service(**service_data)
                    db.add(service)
                    services_created += 1
            
            # 2. AI/NLP 공용 서비스 (메인 서비스가 있으면 자동 생성)
            has_main_services = any(count > 0 for service, count in service_requirements.items() 
                                  if service in ['callbot', 'chatbot', 'advisor'])
            
            if has_main_services:
                ai_nlp_services = ['nlp', 'aicm']
                # STT는 callbot이나 advisor가 있을 때만
                if service_requirements.get('callbot', 0) > 0 or service_requirements.get('advisor', 0) > 0 or service_requirements.get('stt', 0) > 0:
                    ai_nlp_services.append('stt-server')
                # TTS는 callbot이 있을 때만
                if service_requirements.get('callbot', 0) > 0 or service_requirements.get('tts', 0) > 0:
                    ai_nlp_services.append('tts-server')
                
                for service_name in ai_nlp_services:
                    service_data = {
                        "tenant_id": tenant.tenant_id,
                        "service_name": service_name,
                        "service_type": "ai_nlp_service",
                        "enabled": True,
                        "count": 1,  # 공용 서비스는 기본 1개
                        "min_replicas": 1,
                        "max_replicas": 3,
                        "target_cpu": 70,
                        "image_name": f"ecp-ai/{service_name}",
                        "image_tag": "latest",
                        "cpu_request": "500m",
                        "memory_request": "1Gi",
                        "gpu_request": 1 if service_name in ['nlp', 'aicm', 'tts-server'] else 0
                    }
                    service = Service(**service_data)
                    db.add(service)
                    services_created += 1
            
            # 3. 분석 서비스 (ta, qa가 있을 때 서버 생성)
            if service_requirements.get('ta', 0) > 0:
                service_data = {
                    "tenant_id": tenant.tenant_id,
                    "service_name": "ta-server",
                    "service_type": "analytics_service",
                    "enabled": True,
                    "count": 1,
                    "min_replicas": 1,
                    "max_replicas": 2,
                    "target_cpu": 50,
                    "image_name": "ecp-ai/ta-server",
                    "image_tag": "latest",
                    "cpu_request": "200m",
                    "memory_request": "512Mi",
                    "gpu_request": 0
                }
                service = Service(**service_data)
                db.add(service)
                services_created += 1
                
            if service_requirements.get('qa', 0) > 0:
                service_data = {
                    "tenant_id": tenant.tenant_id,
                    "service_name": "qa-server",
                    "service_type": "analytics_service",
                    "enabled": True,
                    "count": 1,
                    "min_replicas": 1,
                    "max_replicas": 2,
                    "target_cpu": 50,
                    "image_name": "ecp-ai/qa-server",
                    "image_tag": "latest",
                    "cpu_request": "200m",
                    "memory_request": "512Mi",
                    "gpu_request": 0
                }
                service = Service(**service_data)
                db.add(service)
                services_created += 1
            
            # 4. 인프라 서비스 (항상 생성)
            infrastructure_services = [
                'nginx', 'gateway', 'auth', 'conversation', 'scenario', 'monitoring'
            ]
            
            for service_name in infrastructure_services:
                service_data = {
                    "tenant_id": tenant.tenant_id,
                    "service_name": service_name,
                    "service_type": "infrastructure_service",
                    "enabled": True,
                    "count": 1,
                    "min_replicas": 1,
                    "max_replicas": 1,  # 인프라 서비스는 스케일링 제한
                    "target_cpu": 30,
                    "image_name": f"ecp-ai/{service_name}",
                    "image_tag": "latest",
                    "cpu_request": "50m",
                    "memory_request": "128Mi",
                    "gpu_request": 0
                }
                service = Service(**service_data)
                db.add(service)
                services_created += 1
            
            # 모든 변경사항을 한번에 커밋
            db.commit()
            logger.info(f"테넌시 '{request.tenant_id}' 및 {services_created}개 서비스 생성 완료")
            
        except Exception as e:
            logger.error(f"테넌시/서비스 생성 실패: {e}")
            db.rollback()
            raise
        
        # 6. [advice from AI] auto_deploy 플래그에 따른 처리 분기
        deployment_status = "created"  # 기본값: DB 저장만
        
        if request.auto_deploy:
            # 자동 배포 모드: 매니페스트 생성 → 시뮬레이터 전송 → Mock 데이터 생성
            try:
                logger.info("자동 배포 모드 - 시뮬레이터 연동 시작", tenant_id=request.tenant_id)
                
                # 매니페스트 생성
                manifest_generator = ManifestGenerator()
                manifest_content = manifest_generator.generate_tenant_manifests(tenant_specs)
                
                # [advice from AI] 데이터베이스에 매니페스트 저장 - JSON으로 변환
                import json
                tenant.manifest_content = json.dumps(manifest_content)
                tenant.manifest_generated_at = datetime.utcnow()
                tenant.status = "deploying"
                db.commit()
                
                # 백그라운드에서 시뮬레이터 배포 작업 추가
                background_tasks.add_task(
                    deploy_tenant_to_simulator,
                    tenant_id=request.tenant_id,
                    manifest_content=manifest_content,
                    tenant_specs=tenant_specs
                )
                
                deployment_status = "deploying"
                logger.info("시뮬레이터 배포 작업 백그라운드 시작", tenant_id=request.tenant_id)
                
            except Exception as deploy_error:
                logger.error("자동 배포 실패 - 테넌시는 저장됨", 
                           tenant_id=request.tenant_id, error=str(deploy_error))
                deployment_status = "created_with_deploy_error"
        else:
            # 단순 저장 모드: 데이터베이스 저장만, 서버 미동작
            logger.info("단순 저장 모드 - 데이터베이스 저장만", tenant_id=request.tenant_id)
            tenant.status = "pending"  # [advice from AI] 유효한 상태값 사용
            db.commit()

        # 7. 응답 생성
        response = TenantCreateResponse(
            success=True,
            tenant_id=request.tenant_id,
            preset=tenant_specs.preset,
            estimated_resources=ResourceEstimation(
                gpu={
                    "type": request.gpu_type,
                    "count": comprehensive_requirements.gpu.get("total", 3),
                    "memory_gb": float(comprehensive_requirements.memory.get("gpu_ram_gb", "42"))
                },
                cpu={
                    "cores": comprehensive_requirements.cpu.get("total", 31),
                    "usage_percent": 65.2
                },
                memory={
                    "total": comprehensive_requirements.memory.get("system_ram_gb", "16") + "Gi",
                    "usage_percent": "72.1"
                },
                storage={
                    "total": comprehensive_requirements.storage.get("total_tb", "1.0") + "TB",
                    "usage_percent": "45.8"
                }
            ),
            deployment_status=deployment_status,
            created_at=tenant.created_at
        )
        
        logger.info(f"테넌시 '{request.tenant_id}' 생성 완료", tenant_id=request.tenant_id)
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"테넌시 생성 실패: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"테넌시 생성 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/{tenant_id}", response_model=TenantSummary)
async def get_tenant(tenant_id: str, db: Session = Depends(get_db)):
    """
    특정 테넌시 정보 조회
    - 데이터베이스에서 테넌시 상세 정보 조회
    """
    try:
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        
        if not tenant:
            raise HTTPException(
                status_code=404,
                detail=f"테넌시 '{tenant_id}'를 찾을 수 없습니다"
            )
        
        # 서비스 개수 계산
        services_count = db.query(Service).filter(Service.tenant_id == tenant.tenant_id).count()
        
        return TenantSummary(
            tenant_id=tenant.tenant_id,
            name=tenant.name,
            preset=tenant.preset,
            is_demo=tenant.is_demo,
            status=tenant.status,
            services_count=services_count,
            created_at=tenant.created_at,
            service_config=tenant.service_config
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"테넌시 정보 조회 실패: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"테넌시 정보 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.delete("/{tenant_id}")
async def delete_tenant(
    tenant_id: str,
    db: Session = Depends(get_db_session)
):
    """
    테넌시 삭제
    - 데이터베이스에서 테넌시 정보 삭제
    - K8s 리소스는 선택적으로 삭제 (개발 환경에서는 스킵 가능)
    """
    try:
        logger.info("테넌시 삭제 요청", tenant_id=tenant_id)
        
        # [advice from AI] 데이터베이스에서 테넌시 존재 확인
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(
                status_code=404,
                detail=f"테넌시 '{tenant_id}'를 찾을 수 없습니다"
            )
        
        # [advice from AI] 1. 데이터베이스에서 먼저 삭제 (cascade로 관련 데이터 자동 삭제)
        try:
            db.delete(tenant)
            db.commit()
            logger.info("데이터베이스에서 테넌시 삭제 완료", tenant_id=tenant_id)
        except Exception as db_error:
            db.rollback()
            logger.error("데이터베이스 테넌시 삭제 실패", tenant_id=tenant_id, error=str(db_error))
            raise HTTPException(
                status_code=500,
                detail=f"데이터베이스에서 테넌시 삭제 실패: {str(db_error)}"
            )
        
        # [advice from AI] 2. 시뮬레이터에서 배포 삭제 (Mock 데이터 생성기 정리)
        try:
            # 시뮬레이터 API를 통한 배포 삭제
            import httpx
            simulator_url = os.getenv('K8S_SIMULATOR_EXTERNAL_URL', 'http://localhost:6360')
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                # 시뮬레이터에서 해당 테넌시의 모든 리소스 삭제
                response = await client.delete(f"{simulator_url}/k8s/resources/tenant/{tenant_id}")
                if response.status_code == 200:
                    logger.info("시뮬레이터에서 테넌시 배포 삭제 완료", tenant_id=tenant_id)
                elif response.status_code == 404:
                    logger.info("시뮬레이터에 해당 테넌시 배포가 없음", tenant_id=tenant_id)
                else:
                    logger.warning("시뮬레이터 배포 삭제 실패", tenant_id=tenant_id, status_code=response.status_code)
        except Exception as sim_error:
            logger.warning("시뮬레이터 배포 삭제 중 오류 (DB 삭제는 성공)", 
                         tenant_id=tenant_id, error=str(sim_error))
        
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


@router.get("/demo-fallback")
async def get_demo_fallback_data(x_demo_mode: Optional[str] = Header(None)):
    """
    데모 모드 전용 폴백 데이터
    - 데모 DB에 데이터가 없을 때 사용되는 기본 데이터
    """
    is_demo = x_demo_mode and x_demo_mode.lower() == 'true'
    
    if not is_demo:
        raise HTTPException(
            status_code=403,
            detail="데모 모드에서만 접근 가능합니다"
        )
    
    try:
        logger.info("데모 폴백 데이터 제공")
        
        # 데모 모드용 기본 테넌트 데이터
        demo_tenants = [
            {
                "tenant_id": "demo-tenant",
                "name": "데모 테넌시",
                "preset": "small",
                "is_demo": True,
                "status": "running",
                "services_count": 3,
                "created_at": "2024-12-01T10:00:00Z"
            },
            {
                "tenant_id": "demo-small",
                "name": "소규모 데모",
                "preset": "small",
                "is_demo": True,
                "status": "running",
                "services_count": 2,
                "created_at": "2024-12-01T09:00:00Z"
            },
            {
                "tenant_id": "demo-medium",
                "name": "중간 규모 데모",
                "preset": "medium",
                "is_demo": True,
                "status": "running",
                "services_count": 5,
                "created_at": "2024-12-01T08:00:00Z"
            }
        ]
        
        return TenantListResponse(
            tenants=[TenantSummary(**tenant) for tenant in demo_tenants],
            total_count=len(demo_tenants),
            demo_count=len(demo_tenants),
            active_count=len(demo_tenants)
        )
        
    except Exception as e:
        logger.error("데모 폴백 데이터 제공 실패", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"데모 데이터 제공 중 오류가 발생했습니다: {str(e)}"
        )


class ManifestGenerationRequest(BaseModel):
    """매니페스트 생성 요청"""
    callbot: int = Field(0, ge=0, description="콜봇 채널 수")
    chatbot: int = Field(0, ge=0, description="챗봇 사용자 수")
    advisor: int = Field(0, ge=0, description="어드바이저 상담사 수")
    stt: int = Field(0, ge=0, description="독립 STT 채널 수")
    tts: int = Field(0, ge=0, description="독립 TTS 채널 수")
    ta: int = Field(0, ge=0, description="TA 분석 요청 수")
    qa: int = Field(0, ge=0, description="QA 품질관리 요청 수")
    gpu_type: str = Field("auto", description="GPU 타입")
    cloud_provider: str = Field("iaas", description="클라우드 제공업체")
    
    # [advice from AI] Kubernetes 고급 설정 추가
    kubernetes_advanced_config: Optional[KubernetesAdvancedConfig] = Field(None, description="Kubernetes 고급 설정")


@router.post("/{tenant_id}/generate-manifests")
async def generate_tenant_manifests(
    tenant_id: str,
    request: ManifestGenerationRequest,
    tenant_mgr: TenantManager = Depends(get_tenant_manager)
):
    """
    테넌시 Kubernetes 매니페스트 생성 (미리보기)
    - 실제 배포 전 설정 파일 검토
    """
    try:
        logger.info("매니페스트 생성 요청", tenant_id=tenant_id)
        
        # 서비스 요구사항 추출
        service_requirements = ServiceRequirements(
            callbot=request.callbot,
            chatbot=request.chatbot,
            advisor=request.advisor,
            stt=request.stt,
            tts=request.tts,
            ta=request.ta,
            qa=request.qa
        )
        
        # 테넌시 사양 생성
        tenant_specs = tenant_mgr.generate_tenant_specs(
            tenant_id=tenant_id,
            service_requirements=service_requirements.model_dump(),
            gpu_type=request.gpu_type
        )
        
        # [advice from AI] 매니페스트 생성 (고급 설정 포함)
        manifest_generator = ManifestGenerator()
        if request.kubernetes_advanced_config:
            # 고급 설정이 있는 경우 커스터마이즈된 매니페스트 생성
            manifests = manifest_generator.generate_tenant_manifests_with_advanced_config(
                tenant_specs, 
                request.kubernetes_advanced_config
            )
        else:
            # 기본 매니페스트 생성
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


@router.get("/{tenant_id}/manifest-preview")
async def get_manifest_preview(
    tenant_id: str,
    service_requirements: ServiceRequirements,
    gpu_type: str = "auto",
    tenant_mgr: TenantManager = Depends(get_tenant_manager)
):
    """
    [advice from AI] 매니페스트 미리보기 및 이미지 매칭 정보
    - 생성될 Kubernetes 매니페스트 내용 미리보기
    - 이미지 매칭 정보 및 설정 상세 보기
    - 매니페스트 수정 가능 여부 확인
    """
    try:
        logger.info("매니페스트 미리보기 요청", tenant_id=tenant_id)
        
        # 테넌시 사양 생성
        tenant_specs = tenant_mgr.generate_tenant_specs(
            tenant_id=tenant_id,
            service_requirements=service_requirements.model_dump(),
            gpu_type=gpu_type
        )
        
        # 서비스별 설정 로드
        config_manager = get_service_config_manager()
        
        # 매니페스트 생성기 초기화
        manifest_generator = ManifestGenerator()
        manifests = manifest_generator.generate_tenant_manifests(tenant_specs)
        
        # 이미지 매칭 정보 수집
        image_matching_info = []
        for filename, content in manifests.items():
            if "deployment" in filename:
                # 서비스 이름 추출
                service_name = filename.split("-")[1] if len(filename.split("-")) > 1 else "unknown"
                
                # 서비스별 설정 로드
                service_config = config_manager.get_service_config(service_name)
                
                # 이미지 정보 추출
                import yaml
                try:
                    manifest_yaml = yaml.safe_load(content)
                    containers = manifest_yaml.get('spec', {}).get('template', {}).get('spec', {}).get('containers', [])
                    
                    for container in containers:
                        image_info = {
                            "service_name": service_name,
                            "manifest_file": filename,
                            "container_name": container.get('name', 'unknown'),
                            "current_image": container.get('image', 'unknown'),
                            "ports": container.get('ports', []),
                            "resources": container.get('resources', {}),
                            "service_config": {
                                "dockerfile_path": service_config.dockerfile_path if service_config else "unknown",
                                "build_context": service_config.build_context if service_config else "unknown",
                                "base_image": service_config.image_config.base_image if service_config else "unknown",
                                "optimization_level": service_config.image_config.optimization_level.value if service_config else "unknown"
                            } if service_config else None,
                            "kubernetes_config": {
                                "auto_scaling": service_config.kubernetes_config.auto_scaling.dict() if service_config else None,
                                "resource_config": service_config.kubernetes_config.resource_config.dict() if service_config else None,
                                "probe_config": service_config.kubernetes_config.probe_config.dict() if service_config else None
                            } if service_config else None
                        }
                        image_matching_info.append(image_info)
                        
                except yaml.YAMLError as e:
                    logger.warning(f"매니페스트 YAML 파싱 실패: {filename}", error=str(e))
        
        # 매니페스트 수정 가능 여부 확인
        manifest_editability = {
            "can_edit": True,
            "edit_reasons": [
                "매니페스트 파일이 로컬에 생성됨",
                "서비스별 설정이 동적으로 적용됨",
                "환경별 설정 오버라이드 지원"
            ],
            "edit_restrictions": [
                "이미지 태그는 CI/CD 파이프라인에서 자동 업데이트됨",
                "리소스 설정은 서비스별 설정에서 관리됨"
            ]
        }
        
        return {
            "success": True,
            "tenant_id": tenant_id,
            "tenant_specs": tenant_specs.dict(),
            "manifest_files": list(manifests.keys()),
            "image_matching_info": image_matching_info,
            "manifest_editability": manifest_editability,
            "service_configs": {
                service: config.dict() if config else None
                for service, config in config_manager.service_configs.items()
            },
            "environment_configs": {
                env: config.dict()
                for env, config in config_manager.environment_configs.items()
            }
        }
        
    except Exception as e:
        logger.error("매니페스트 미리보기 실패", tenant_id=tenant_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"매니페스트 미리보기 중 오류가 발생했습니다: {str(e)}"
        )


@router.post("/{tenant_id}/update-manifest")
async def update_manifest(
    tenant_id: str,
    manifest_updates: Dict[str, Any],
    tenant_mgr: TenantManager = Depends(get_tenant_manager)
):
    """
    [advice from AI] 매니페스트 수정 및 업데이트
    - 특정 매니페스트 파일의 내용 수정
    - 수정된 매니페스트 검증
    - 수정 이력 추적
    """
    try:
        logger.info("매니페스트 수정 요청", tenant_id=tenant_id, updates=manifest_updates)
        
        # 매니페스트 파일 경로 확인
        manifest_dir = "k8s-manifests"
        if not os.path.exists(manifest_dir):
            raise HTTPException(
                status_code=404,
                detail="매니페스트 디렉토리를 찾을 수 없습니다"
            )
        
        # 수정된 매니페스트 파일들 저장
        updated_files = []
        validation_errors = []
        
        for filename, content in manifest_updates.items():
            file_path = os.path.join(manifest_dir, filename)
            
            # 파일 존재 여부 확인
            if not os.path.exists(file_path):
                validation_errors.append(f"파일을 찾을 수 없습니다: {filename}")
                continue
            
            try:
                # YAML 문법 검증
                import yaml
                yaml.safe_load(content)
                
                # 파일 백업 생성
                backup_path = f"{file_path}.backup.{int(time.time())}"
                with open(file_path, 'r') as f:
                    original_content = f.read()
                
                with open(backup_path, 'w') as f:
                    f.write(original_content)
                
                # 새 내용으로 파일 업데이트
                with open(file_path, 'w') as f:
                    f.write(content)
                
                updated_files.append({
                    "filename": filename,
                    "backup_path": backup_path,
                    "status": "updated"
                })
                
                logger.info(f"매니페스트 파일 수정 완료: {filename}")
                
            except yaml.YAMLError as e:
                validation_errors.append(f"YAML 문법 오류 ({filename}): {str(e)}")
            except Exception as e:
                validation_errors.append(f"파일 수정 실패 ({filename}): {str(e)}")
        
        # 수정 결과 반환
        if validation_errors:
            return {
                "success": False,
                "message": "매니페스트 수정 중 오류가 발생했습니다",
                "updated_files": updated_files,
                "validation_errors": validation_errors
            }
        else:
            return {
                "success": True,
                "message": "매니페스트 수정이 완료되었습니다",
                "updated_files": updated_files,
                "validation_errors": []
            }
        
    except Exception as e:
        logger.error("매니페스트 수정 실패", tenant_id=tenant_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"매니페스트 수정 중 오류가 발생했습니다: {str(e)}"
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
    gpu_type: str = "t4",
    tenancy_mode: str = "large"
) -> Dict[str, Any]:
    """
    상세 하드웨어 사양 계산 (ECP 계산 엔진 사용)
    """
    import time
    start_time = time.time()
    
    try:
        logger.info("✅ 상세 하드웨어 계산 요청 시작", 
                   service_requirements=service_requirements.model_dump(), 
                   gpu_type=gpu_type)
        
        # ECP 계산 엔진 어댑터 초기화
        calculator = ECPCalculatorAdapter()
        
        # 상세 하드웨어 사양 계산
        result = calculator.generate_detailed_hardware_spec(
            service_requirements.model_dump(),
            gpu_type
        )
        
        end_time = time.time()
        duration = end_time - start_time
        
        # [advice from AI] 테넌시 모드에 따른 결과 필터링
        filtered_result = filter_hardware_result_by_tenancy_mode(result, tenancy_mode)
        
        logger.info("✅ 상세 하드웨어 계산 완료 (테넌시 모드 필터링 적용)", 
                   success=filtered_result.get("success", False),
                   tenancy_mode=tenancy_mode,
                   original_gpus=result.get("summary", {}).get("total_gpu_count", 0),
                   filtered_gpus=filtered_result.get("summary", {}).get("total_gpu_count", 0),
                   duration_seconds=round(duration, 2))
        
        return filtered_result
        
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
        
        # 클라우드 인스턴스 매핑 (향상된 매핑 로직)
        result = calculator.get_cloud_instance_mapping(
            service_requirements.model_dump(),
            gpu_type,
            cloud_provider
        )
        
        # [advice from AI] 클라우드별 비교 데이터 추가
        if result.get("success", False):
            # 다른 클라우드 제공업체와 비교 데이터 생성
            comparison_data = await _generate_cloud_comparison(
                calculator, service_requirements.model_dump(), gpu_type
            )
            result["cloud_comparison"] = comparison_data
        
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


# ==========================================
# 클라우드 비교 헬퍼 함수들
# ==========================================

async def _generate_cloud_comparison(
    calculator: 'ECPCalculatorAdapter',
    service_requirements: Dict[str, int],
    gpu_type: str
) -> Dict[str, Any]:
    """
    [advice from AI] 클라우드 제공업체별 비교 데이터 생성
    """
    try:
        cloud_providers = ["aws", "ncp", "iaas"]
        comparison_results = {}
        
        for provider in cloud_providers:
            try:
                result = calculator.get_cloud_instance_mapping(
                    service_requirements,
                    gpu_type,
                    provider
                )
                if result.get("success", False):
                    comparison_results[provider] = {
                        "total_servers": result.get("total_servers", 0),
                        "monthly_cost_usd": result.get("cost_breakdown", {}).get("total_monthly_cost_usd", 0),
                        "monthly_cost_krw": result.get("cost_breakdown", {}).get("total_monthly_cost_krw", 0),
                        "gpu_instances": result.get("gpu_instances", []),
                        "cpu_instances": result.get("cpu_instances", []),
                        "recommended": provider == "aws"  # 기본 추천은 AWS
                    }
                else:
                    comparison_results[provider] = {
                        "error": "매핑 실패",
                        "available": False
                    }
            except Exception as e:
                logger.warning(f"클라우드 비교 중 {provider} 오류", error=str(e))
                comparison_results[provider] = {
                    "error": str(e),
                    "available": False
                }
        
        # 비용 기준 추천 로직
        available_providers = {k: v for k, v in comparison_results.items() 
                             if v.get("available", True) and "error" not in v}
        
        if available_providers:
            # 비용 기준 정렬 (USD 기준)
            sorted_providers = sorted(
                available_providers.items(),
                key=lambda x: x[1].get("monthly_cost_usd", float('inf'))
            )
            
            # 가장 저렴한 제공업체를 추천으로 설정
            if sorted_providers:
                cheapest_provider = sorted_providers[0][0]
                for provider in comparison_results:
                    comparison_results[provider]["recommended"] = (provider == cheapest_provider)
        
        return {
            "providers": comparison_results,
            "recommendation": {
                "best_cost": min(
                    [(k, v.get("monthly_cost_usd", float('inf'))) 
                     for k, v in available_providers.items()],
                    key=lambda x: x[1],
                    default=(None, 0)
                )[0] if available_providers else None,
                "summary": f"{len(available_providers)}개 클라우드 제공업체 비교 완료"
            }
        }
        
    except Exception as e:
        logger.error("클라우드 비교 데이터 생성 실패", error=str(e))
        return {
            "error": str(e),
            "providers": {},
            "recommendation": {"summary": "비교 데이터 생성 실패"}
        }


@router.post("/cloud-optimization-analysis")
async def get_cloud_optimization_analysis(
    service_requirements: ServiceRequirements,
    gpu_type: str = "t4",
    cloud_provider: str = "aws"
) -> Dict[str, Any]:
    """
    [advice from AI] 클라우드별 최적화 분석
    """
    try:
        logger.info("클라우드 최적화 분석 요청", 
                   service_requirements=service_requirements.model_dump(),
                   gpu_type=gpu_type,
                   cloud_provider=cloud_provider)
        
        # ECP 계산 엔진 어댑터 초기화
        calculator = ECPCalculatorAdapter()
        
        # 클라우드 최적화 분석
        result = calculator.optimize_for_cloud_provider(
            service_requirements.model_dump(),
            gpu_type,
            cloud_provider
        )
        
        logger.info("클라우드 최적화 분석 완료", 
                   success=result.get("success", False),
                   optimizations_count=len(result.get("optimizations", [])))
        
        return result
        
    except Exception as e:
        logger.error("클라우드 최적화 분석 실패", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"클라우드 최적화 분석 중 오류가 발생했습니다: {str(e)}"
        )


def filter_hardware_result_by_tenancy_mode(api_result: Dict[str, Any], tenancy_mode: str) -> Dict[str, Any]:
    """
    [advice from AI] 외부 API 응답을 테넌시 모드에 따라 필터링
    
    Args:
        api_result: rdc.rickyson.com API 응답
        tenancy_mode: 'small' (소규모) 또는 'large' (대규모)
    
    Returns:
        테넌시 모드에 맞게 필터링된 결과
    """
    if not api_result or not api_result.get("success", False):
        return api_result
    
    try:
        filtered_result = api_result.copy()
        
        if tenancy_mode == "small":
            # 소규모 테넌시: 공용 인프라 제외
            logger.info("소규모 테넌시 모드 - 공용 인프라 제외 필터링 적용")
            
            # 하드웨어 스펙에서 공용 인프라 서버 제거
            if "hardware_specification" in filtered_result:
                hw_spec = filtered_result["hardware_specification"]
                
                # 공통 서비스 서버 제거 (API Gateway, PostgreSQL, VectorDB, Auth Service, NAS)
                if "general_servers" in hw_spec:
                    original_general = hw_spec["general_servers"]
                    # 공용 인프라 48코어 제외 (API Gateway 16 + PostgreSQL 8 + VectorDB 8 + Auth 8 + NAS 8)
                    hw_spec["general_servers"] = {
                        "cores": max(0, original_general.get("cores", 0) - 48),
                        "ram_gb": max(0, original_general.get("ram_gb", 0) - 120),  # 16+32+32+16+16+8
                        "storage_gb": max(0, original_general.get("storage_gb", 0) - 2500),  # 500*5
                        "quantity": max(0, original_general.get("quantity", 0) - 5)
                    }
                
                # 총 요약에서도 공용 인프라 제외
                if "summary" in hw_spec:
                    summary = hw_spec["summary"]
                    summary["total_cpu_cores"] = max(0, summary.get("total_cpu_cores", 0) - 48)
                    summary["total_ram_gb"] = max(0, summary.get("total_ram_gb", 0) - 120)
                    summary["total_storage_gb"] = max(0, summary.get("total_storage_gb", 0) - 2500)
                    summary["total_server_count"] = max(0, summary.get("total_server_count", 0) - 5)
            
            # 비용 분석에서 공용 인프라 비용 제외
            if "cost_analysis" in filtered_result:
                cost_analysis = filtered_result["cost_analysis"]
                
                # 공용 인프라 예상 비용 (월 기준)
                shared_infra_cost_monthly = 2000000  # 약 200만원 (API Gateway, DB 등)
                
                for provider in ["aws", "ncp"]:
                    if provider in cost_analysis:
                        provider_cost = cost_analysis[provider]
                        if "monthly_cost_krw" in provider_cost:
                            provider_cost["monthly_cost_krw"] = max(0, 
                                provider_cost["monthly_cost_krw"] - shared_infra_cost_monthly)
                        if "total_cost_krw" in provider_cost:
                            provider_cost["total_cost_krw"] = max(0,
                                provider_cost["total_cost_krw"] - shared_infra_cost_monthly)
            
            # 클라우드 인스턴스 매핑에서 공용 인프라 인스턴스 제거
            for provider in ["aws_instances", "ncp_instances"]:
                if provider in filtered_result:
                    instances = filtered_result[provider]
                    if "general" in instances:
                        # 공용 인프라용 인스턴스 제거
                        general_instances = instances["general"]
                        if isinstance(general_instances, list) and len(general_instances) >= 5:
                            instances["general"] = general_instances[5:]  # 처음 5개 제거 (공용 인프라)
                        elif isinstance(general_instances, dict):
                            # 수량에서 5개 차감
                            if "quantity" in general_instances:
                                general_instances["quantity"] = max(0, general_instances["quantity"] - 5)
        
        else:
            # 대규모 테넌시: 전체 결과 그대로 사용
            logger.info("대규모 테넌시 모드 - 전체 리소스 사용")
        
        # 테넌시 모드 정보 추가
        filtered_result["tenancy_mode"] = tenancy_mode
        filtered_result["filtering_applied"] = tenancy_mode == "small"
        
        return filtered_result
        
    except Exception as e:
        logger.error("테넌시 모드 필터링 실패", error=str(e), tenancy_mode=tenancy_mode)
        # 필터링 실패 시 원본 결과 반환
        return api_result
