# [advice from AI] Kubernetes 자동 배포 파이프라인 API
"""
Deployment Pipeline API
- 이미지 선택 후 자동 K8S 배포
- 배포 상태 실시간 모니터링
- 롤백 기능
- 배포 히스토리 관리
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import asyncio
import json
import yaml
from sqlalchemy.orm import Session

from app.core.database_manager import db_manager
from app.models.database import CICDImage
from app.core.k8s_orchestrator import K8sOrchestrator
from app.services.k8s_simulator_client import K8sSimulatorClient

router = APIRouter()

# Pydantic 모델들
class DeploymentRequest(BaseModel):
    """배포 요청 모델"""
    service_name: str = Field(..., description="서비스 이름")
    image_tag: str = Field(..., description="배포할 이미지 태그")
    tenant_id: Optional[str] = Field("default", description="테넌트 ID")
    namespace: Optional[str] = Field("default-ecp-ai", description="네임스페이스")
    deployment_strategy: Optional[str] = Field("RollingUpdate", description="배포 전략")
    replicas: Optional[int] = Field(2, description="레플리카 수")
    resources: Optional[Dict[str, Any]] = Field(None, description="리소스 요구사항")

class DeploymentStatus(BaseModel):
    """배포 상태 모델"""
    deployment_id: str
    service_name: str
    status: str  # pending, building, deploying, completed, failed, rolling_back
    progress: int  # 0-100
    message: str
    started_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    manifest_yaml: Optional[str] = None
    k8s_resources: Optional[Dict[str, Any]] = None

class PodStatus(BaseModel):
    """Pod 상태 모델"""
    pod_name: str
    status: str
    ready: bool
    restarts: int
    node_name: Optional[str] = None
    created_at: datetime
    image: str

class ServiceDeploymentInfo(BaseModel):
    """서비스 배포 정보"""
    service_name: str
    current_image: str
    desired_image: str
    replicas_ready: int
    replicas_desired: int
    pods: List[PodStatus]
    deployment_status: str
    last_updated: datetime

# 전역 배포 상태 저장소 (실제로는 Redis나 DB 사용)
deployment_statuses: Dict[str, DeploymentStatus] = {}

def get_db_session():
    """데이터베이스 세션 의존성"""
    session = db_manager.get_session()
    try:
        yield session
    finally:
        session.close()

@router.post("/deploy", response_model=Dict[str, Any])
async def start_deployment(
    request: DeploymentRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db_session)
):
    """
    서비스 배포 시작
    1. 이미지 정보 확인
    2. 매니페스트 생성
    3. K8S 배포 실행
    4. 배경에서 상태 모니터링
    """
    try:
        # 이미지 정보 확인
        image_info = db.query(CICDImage).filter(
            CICDImage.service_name == request.service_name
        ).first()
        
        if not image_info:
            raise HTTPException(
                status_code=404, 
                detail=f"서비스 '{request.service_name}' 이미지 정보를 찾을 수 없습니다."
            )

        # 배포 ID 생성
        deployment_id = f"{request.service_name}-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        
        # 배포 상태 초기화
        deployment_status = DeploymentStatus(
            deployment_id=deployment_id,
            service_name=request.service_name,
            status="pending",
            progress=0,
            message="배포 준비 중...",
            started_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        deployment_statuses[deployment_id] = deployment_status
        
        # 백그라운드에서 배포 실행
        background_tasks.add_task(
            execute_deployment,
            deployment_id,
            request,
            image_info
        )
        
        return {
            "success": True,
            "deployment_id": deployment_id,
            "message": f"{request.service_name} 배포가 시작되었습니다.",
            "status": deployment_status.dict()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"배포 시작 실패: {str(e)}")

async def execute_deployment(
    deployment_id: str,
    request: DeploymentRequest,
    image_info: CICDImage
):
    """
    실제 배포 실행 (백그라운드 태스크)
    """
    try:
        status = deployment_statuses[deployment_id]
        
        # 1단계: 매니페스트 생성
        status.status = "building"
        status.progress = 20
        status.message = "Kubernetes 매니페스트 생성 중..."
        status.updated_at = datetime.utcnow()
        
        # 매니페스트 생성
        manifest_yaml = await generate_k8s_manifest(request, image_info)
        status.manifest_yaml = manifest_yaml
        
        await asyncio.sleep(2)  # 실제 처리 시간 시뮬레이션
        
        # 2단계: K8S 배포
        status.status = "deploying"
        status.progress = 50
        status.message = "Kubernetes 클러스터에 배포 중..."
        status.updated_at = datetime.utcnow()
        
        # K8S 시뮬레이터에 배포
        k8s_resources = await deploy_to_k8s_simulator(manifest_yaml, request)
        status.k8s_resources = k8s_resources
        
        await asyncio.sleep(3)  # 배포 시간 시뮬레이션
        
        # 3단계: 배포 완료 확인
        status.status = "completed"
        status.progress = 100
        status.message = "배포 완료!"
        status.completed_at = datetime.utcnow()
        status.updated_at = datetime.utcnow()
        
    except Exception as e:
        status.status = "failed"
        status.message = f"배포 실패: {str(e)}"
        status.updated_at = datetime.utcnow()

async def generate_k8s_manifest(request: DeploymentRequest, image_info: CICDImage) -> str:
    """Kubernetes 매니페스트 생성"""
    
    # 이미지 전체 경로 구성
    full_image = f"{image_info.registry_url}/{image_info.repository}:{request.image_tag}"
    
    # 기본 리소스 요구사항
    default_resources = {
        "requests": {"cpu": "100m", "memory": "128Mi"},
        "limits": {"cpu": "500m", "memory": "512Mi"}
    }
    
    resources = request.resources or default_resources
    
    # Deployment 매니페스트
    manifest = {
        "apiVersion": "apps/v1",
        "kind": "Deployment",
        "metadata": {
            "name": f"{request.service_name}-deployment",
            "namespace": request.namespace,
            "labels": {
                "app": request.service_name,
                "version": request.image_tag,
                "managed-by": "ecp-ai-orchestrator"
            }
        },
        "spec": {
            "replicas": request.replicas,
            "strategy": {
                "type": request.deployment_strategy,
                "rollingUpdate": {
                    "maxUnavailable": 1,
                    "maxSurge": 1
                } if request.deployment_strategy == "RollingUpdate" else None
            },
            "selector": {
                "matchLabels": {
                    "app": request.service_name
                }
            },
            "template": {
                "metadata": {
                    "labels": {
                        "app": request.service_name,
                        "version": request.image_tag
                    }
                },
                "spec": {
                    "containers": [{
                        "name": request.service_name,
                        "image": full_image,
                        "ports": [{"containerPort": 8000}],
                        "resources": resources,
                        "env": [
                            {"name": "SERVICE_NAME", "value": request.service_name},
                            {"name": "VERSION", "value": request.image_tag}
                        ],
                        "livenessProbe": {
                            "httpGet": {
                                "path": "/health",
                                "port": 8000
                            },
                            "initialDelaySeconds": 30,
                            "periodSeconds": 10
                        },
                        "readinessProbe": {
                            "httpGet": {
                                "path": "/ready",
                                "port": 8000
                            },
                            "initialDelaySeconds": 5,
                            "periodSeconds": 5
                        }
                    }]
                }
            }
        }
    }
    
    # Service 매니페스트
    service_manifest = {
        "apiVersion": "v1",
        "kind": "Service",
        "metadata": {
            "name": f"{request.service_name}-service",
            "namespace": request.namespace,
            "labels": {
                "app": request.service_name
            }
        },
        "spec": {
            "selector": {
                "app": request.service_name
            },
            "ports": [{
                "port": 80,
                "targetPort": 8000,
                "protocol": "TCP"
            }],
            "type": "ClusterIP"
        }
    }
    
    # YAML 문자열로 변환
    yaml_content = yaml.dump(manifest, default_flow_style=False)
    yaml_content += "---\n"
    yaml_content += yaml.dump(service_manifest, default_flow_style=False)
    
    return yaml_content

async def deploy_to_k8s_simulator(manifest_yaml: str, request: DeploymentRequest) -> Dict[str, Any]:
    """K8S 시뮬레이터에 배포"""
    try:
        simulator_client = K8sSimulatorClient()
        
        # 시뮬레이터에 매니페스트 배포
        result = await simulator_client.deploy_manifest(
            manifest_content=manifest_yaml,
            namespace=request.namespace
        )
        
        return {
            "deployment_result": result,
            "namespace": request.namespace,
            "service_name": request.service_name,
            "deployed_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise Exception(f"K8S 시뮬레이터 배포 실패: {str(e)}")

@router.get("/status/{deployment_id}", response_model=DeploymentStatus)
async def get_deployment_status(deployment_id: str):
    """배포 상태 조회"""
    if deployment_id not in deployment_statuses:
        raise HTTPException(status_code=404, detail="배포 정보를 찾을 수 없습니다.")
    
    return deployment_statuses[deployment_id]

@router.get("/service/{service_name}/info", response_model=ServiceDeploymentInfo)
async def get_service_deployment_info(
    service_name: str,
    namespace: str = "default-ecp-ai"
):
    """서비스 배포 정보 조회"""
    try:
        simulator_client = K8sSimulatorClient()
        
        # 시뮬레이터에서 서비스 상태 조회
        service_info = await simulator_client.get_service_status(
            service_name=service_name,
            namespace=namespace
        )
        
        return ServiceDeploymentInfo(**service_info)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"서비스 정보 조회 실패: {str(e)}")

@router.post("/rollback", response_model=Dict[str, Any])
async def rollback_deployment(
    service_name: str,
    target_version: str,
    namespace: str = "default-ecp-ai",
    background_tasks: BackgroundTasks = None
):
    """배포 롤백"""
    try:
        # 롤백 배포 요청 생성
        rollback_request = DeploymentRequest(
            service_name=service_name,
            image_tag=target_version,
            namespace=namespace,
            deployment_strategy="RollingUpdate"
        )
        
        # 롤백 실행 (기존 배포 로직 재사용)
        return await start_deployment(rollback_request, background_tasks)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"롤백 실패: {str(e)}")

@router.get("/history/{service_name}", response_model=List[Dict[str, Any]])
async def get_deployment_history(
    service_name: str,
    limit: int = 10
):
    """배포 히스토리 조회"""
    try:
        # 해당 서비스의 배포 히스토리 필터링
        service_deployments = [
            status.dict() for status in deployment_statuses.values()
            if status.service_name == service_name
        ]
        
        # 최신순 정렬
        service_deployments.sort(
            key=lambda x: x['started_at'], 
            reverse=True
        )
        
        return service_deployments[:limit]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"배포 히스토리 조회 실패: {str(e)}")

@router.get("/active-deployments", response_model=List[DeploymentStatus])
async def get_active_deployments():
    """진행 중인 배포 목록 조회"""
    active_deployments = [
        status for status in deployment_statuses.values()
        if status.status in ["pending", "building", "deploying"]
    ]
    
    return active_deployments

@router.delete("/cleanup/{deployment_id}", response_model=Dict[str, Any])
async def cleanup_deployment(deployment_id: str):
    """배포 상태 정리"""
    if deployment_id in deployment_statuses:
        del deployment_statuses[deployment_id]
        return {"success": True, "message": "배포 상태가 정리되었습니다."}
    else:
        raise HTTPException(status_code=404, detail="배포 정보를 찾을 수 없습니다.")
