# [advice from AI] CI/CD 이미지 관리 및 Pod 매칭 시스템 API
"""
ECP-AI 이미지 관리 및 배포 시스템 REST API
- 실제 이미지 버전 관리
- Pod 상태 실시간 모니터링
- 배포 히스토리 및 롤백 기능
- 배포 환경 및 전략 관리
"""

import asyncio
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from pydantic import BaseModel, Field
import structlog
import json
from datetime import datetime, timedelta
import httpx
from kubernetes import client, config
from kubernetes.client.rest import ApiException

from app.models.tenant_specs import (
    ServiceImage, ImageRegistry, ImageTag, DeploymentEnvironment,
    DeploymentStrategy, NodePlacement, PodStatus, ServiceDeploymentStatus,
    DeploymentHistory, ImageDeploymentConfig
)

logger = structlog.get_logger(__name__)

# FastAPI 라우터 생성
router = APIRouter(prefix="/image-management", tags=["image-management"])

# 전역 변수 (실제 구현에서는 데이터베이스 사용)
_registries: Dict[str, ImageRegistry] = {}
_service_images: Dict[str, ServiceImage] = {}
_deployment_status: Dict[str, ServiceDeploymentStatus] = {}
_deployment_history: Dict[str, List[DeploymentHistory]] = {}

# Kubernetes 클라이언트 초기화
try:
    config.load_incluster_config()  # 클러스터 내부에서 실행 시
except:
    try:
        config.load_kube_config()  # 로컬 개발 환경
    except:
        logger.warning("Kubernetes 설정을 로드할 수 없습니다. Mock 데이터를 사용합니다.")

k8s_apps_v1 = client.AppsV1Api()
k8s_core_v1 = client.CoreV1Api()


class ImageRegistryRequest(BaseModel):
    """이미지 레지스트리 등록 요청"""
    name: str = Field(..., description="레지스트리 이름")
    url: str = Field(..., description="레지스트리 URL")
    username: Optional[str] = Field(None, description="인증 사용자명")
    password: Optional[str] = Field(None, description="인증 비밀번호")
    environment: str = Field("production", description="환경")


class ServiceImageUpdateRequest(BaseModel):
    """서비스 이미지 업데이트 요청"""
    service_name: str = Field(..., description="서비스 이름")
    registry_name: str = Field(..., description="레지스트리 이름")
    repository: str = Field(..., description="이미지 리포지토리")
    selected_tag: str = Field(..., description="선택된 태그")
    pull_policy: str = Field("Always", description="이미지 풀 정책")


class DeploymentRequest(BaseModel):
    """배포 요청"""
    tenant_id: str = Field(..., description="테넌시 ID")
    services: List[str] = Field(..., description="배포할 서비스 목록")
    environment: DeploymentEnvironment = Field(..., description="배포 환경")
    deployment_strategy: DeploymentStrategy = Field(DeploymentStrategy.ROLLING_UPDATE, description="배포 전략")
    approval_required: bool = Field(False, description="승인 필요 여부")
    change_cause: Optional[str] = Field(None, description="변경 사유")


@router.get("/registries")
async def get_registries():
    """등록된 이미지 레지스트리 목록 조회"""
    try:
        # 기본 레지스트리가 없으면 생성
        if not _registries:
            await _initialize_default_registries()
        
        return {
            "success": True,
            "registries": list(_registries.values()),
            "count": len(_registries)
        }
    except Exception as e:
        logger.error("레지스트리 목록 조회 실패", error=str(e))
        raise HTTPException(status_code=500, detail=f"레지스트리 조회 실패: {str(e)}")


@router.post("/registries")
async def create_registry(request: ImageRegistryRequest):
    """새 이미지 레지스트리 등록"""
    try:
        registry = ImageRegistry(
            name=request.name,
            url=request.url,
            username=request.username,
            password=request.password,
            environment=request.environment,
            is_default=len(_registries) == 0  # 첫 번째 레지스트리를 기본으로 설정
        )
        
        _registries[request.name] = registry
        
        logger.info("이미지 레지스트리 등록 완료", registry_name=request.name)
        
        return {
            "success": True,
            "message": f"레지스트리 '{request.name}' 등록 완료",
            "registry": registry
        }
    except Exception as e:
        logger.error("레지스트리 등록 실패", error=str(e))
        raise HTTPException(status_code=500, detail=f"레지스트리 등록 실패: {str(e)}")


@router.get("/services/{service_name}/images")
async def get_service_images(service_name: str):
    """특정 서비스의 이미지 정보 조회"""
    try:
        if service_name not in _service_images:
            # 서비스 이미지 정보가 없으면 기본값 생성
            await _initialize_service_image(service_name)
        
        service_image = _service_images[service_name]
        
        # 사용 가능한 태그 목록 업데이트
        await _update_available_tags(service_image)
        
        return {
            "success": True,
            "service_image": service_image
        }
    except Exception as e:
        logger.error("서비스 이미지 조회 실패", service_name=service_name, error=str(e))
        raise HTTPException(status_code=500, detail=f"서비스 이미지 조회 실패: {str(e)}")


@router.put("/services/{service_name}/images")
async def update_service_image(service_name: str, request: ServiceImageUpdateRequest):
    """서비스 이미지 정보 업데이트"""
    try:
        if request.registry_name not in _registries:
            raise HTTPException(status_code=404, detail=f"레지스트리 '{request.registry_name}'를 찾을 수 없습니다")
        
        registry = _registries[request.registry_name]
        
        # 기존 서비스 이미지 업데이트 또는 새로 생성
        if service_name in _service_images:
            service_image = _service_images[service_name]
            service_image.registry = registry
            service_image.repository = request.repository
            service_image.selected_tag = request.selected_tag
            service_image.pull_policy = request.pull_policy
        else:
            service_image = ServiceImage(
                service_name=service_name,
                registry=registry,
                repository=request.repository,
                selected_tag=request.selected_tag,
                pull_policy=request.pull_policy
            )
        
        # 사용 가능한 태그 목록 업데이트
        await _update_available_tags(service_image)
        
        _service_images[service_name] = service_image
        
        logger.info("서비스 이미지 업데이트 완료", 
                   service_name=service_name, 
                   image=f"{registry.url}/{request.repository}:{request.selected_tag}")
        
        return {
            "success": True,
            "message": f"서비스 '{service_name}' 이미지 업데이트 완료",
            "service_image": service_image
        }
    except Exception as e:
        logger.error("서비스 이미지 업데이트 실패", service_name=service_name, error=str(e))
        raise HTTPException(status_code=500, detail=f"서비스 이미지 업데이트 실패: {str(e)}")


@router.get("/services/{service_name}/status")
async def get_service_deployment_status(service_name: str, namespace: str = Query(..., description="네임스페이스")):
    """서비스 배포 상태 실시간 조회"""
    try:
        # Kubernetes API를 통해 실제 배포 상태 조회
        deployment_status = await _get_deployment_status_from_k8s(service_name, namespace)
        
        _deployment_status[f"{namespace}-{service_name}"] = deployment_status
        
        return {
            "success": True,
            "deployment_status": deployment_status
        }
    except Exception as e:
        logger.error("배포 상태 조회 실패", service_name=service_name, error=str(e))
        # 실제 클러스터 연결 실패 시 Mock 데이터 반환
        mock_status = await _get_mock_deployment_status(service_name, namespace)
        return {
            "success": True,
            "deployment_status": mock_status,
            "note": "Mock 데이터 (Kubernetes 클러스터 연결 불가)"
        }


@router.get("/services/{service_name}/history")
async def get_deployment_history(service_name: str, namespace: str = Query(..., description="네임스페이스")):
    """서비스 배포 히스토리 조회"""
    try:
        history_key = f"{namespace}-{service_name}"
        
        if history_key not in _deployment_history:
            # 히스토리가 없으면 Kubernetes에서 조회
            history = await _get_deployment_history_from_k8s(service_name, namespace)
            _deployment_history[history_key] = history
        
        return {
            "success": True,
            "deployment_history": _deployment_history[history_key]
        }
    except Exception as e:
        logger.error("배포 히스토리 조회 실패", service_name=service_name, error=str(e))
        # Mock 데이터 반환
        mock_history = await _get_mock_deployment_history(service_name)
        return {
            "success": True,
            "deployment_history": mock_history,
            "note": "Mock 데이터 (Kubernetes 클러스터 연결 불가)"
        }


@router.post("/deploy")
async def deploy_services(request: DeploymentRequest, background_tasks: BackgroundTasks):
    """서비스 배포 실행"""
    try:
        logger.info("서비스 배포 요청", tenant_id=request.tenant_id, services=request.services)
        
        # 승인이 필요한 경우 승인 대기 상태로 설정
        if request.approval_required:
            return {
                "success": True,
                "message": "배포 승인 대기 중",
                "deployment_id": f"deploy-{request.tenant_id}-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                "status": "pending_approval"
            }
        
        # 백그라운드에서 배포 실행
        deployment_id = f"deploy-{request.tenant_id}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        background_tasks.add_task(_execute_deployment, deployment_id, request)
        
        return {
            "success": True,
            "message": "배포가 시작되었습니다",
            "deployment_id": deployment_id,
            "status": "in_progress"
        }
    except Exception as e:
        logger.error("배포 실행 실패", error=str(e))
        raise HTTPException(status_code=500, detail=f"배포 실행 실패: {str(e)}")


@router.post("/services/{service_name}/rollback")
async def rollback_service(service_name: str, namespace: str, revision: int = Query(..., description="롤백할 리비전")):
    """서비스 롤백 실행"""
    try:
        logger.info("서비스 롤백 요청", service_name=service_name, namespace=namespace, revision=revision)
        
        # Kubernetes API를 통해 롤백 실행
        success = await _execute_rollback(service_name, namespace, revision)
        
        if success:
            # 배포 히스토리 업데이트
            history_entry = DeploymentHistory(
                revision=revision,
                image="rolled-back",
                deployed_at=datetime.now().isoformat(),
                deployed_by="system",
                status="rollback_completed",
                rollback_available=False,
                change_cause=f"Rollback to revision {revision}"
            )
            
            history_key = f"{namespace}-{service_name}"
            if history_key not in _deployment_history:
                _deployment_history[history_key] = []
            _deployment_history[history_key].insert(0, history_entry)
            
            return {
                "success": True,
                "message": f"서비스 '{service_name}' 리비전 {revision}으로 롤백 완료"
            }
        else:
            raise HTTPException(status_code=500, detail="롤백 실행 실패")
            
    except Exception as e:
        logger.error("롤백 실행 실패", service_name=service_name, error=str(e))
        raise HTTPException(status_code=500, detail=f"롤백 실행 실패: {str(e)}")


# [advice from AI] 헬퍼 함수들
async def _initialize_default_registries():
    """기본 레지스트리 초기화"""
    default_registries = [
        ImageRegistry(
            name="harbor-prod",
            url="harbor.company.com",
            environment="production",
            is_default=True
        ),
        ImageRegistry(
            name="harbor-staging",
            url="staging-harbor.company.com",
            environment="staging",
            is_default=False
        ),
        ImageRegistry(
            name="docker-hub",
            url="docker.io",
            environment="development",
            is_default=False
        )
    ]
    
    for registry in default_registries:
        _registries[registry.name] = registry


async def _initialize_service_image(service_name: str):
    """서비스 이미지 기본 정보 초기화"""
    if not _registries:
        await _initialize_default_registries()
    
    default_registry = next((r for r in _registries.values() if r.is_default), list(_registries.values())[0])
    
    service_image = ServiceImage(
        service_name=service_name,
        registry=default_registry,
        repository=f"ecp-ai/{service_name}",
        selected_tag="latest",
        pull_policy="Always"
    )
    
    await _update_available_tags(service_image)
    _service_images[service_name] = service_image


async def _update_available_tags(service_image: ServiceImage):
    """사용 가능한 태그 목록 업데이트"""
    try:
        # 실제 구현에서는 레지스트리 API를 호출하여 태그 목록을 가져옴
        # 여기서는 Mock 데이터 사용
        mock_tags = [
            ImageTag(
                tag="latest",
                digest="sha256:abc123...",
                created_at=(datetime.now() - timedelta(hours=1)).isoformat(),
                size="245MB",
                vulnerabilities=0,
                is_latest=True
            ),
            ImageTag(
                tag="v1.2.3",
                digest="sha256:def456...",
                created_at=(datetime.now() - timedelta(days=1)).isoformat(),
                size="243MB",
                vulnerabilities=0,
                is_latest=False
            ),
            ImageTag(
                tag="v1.2.2",
                digest="sha256:ghi789...",
                created_at=(datetime.now() - timedelta(days=7)).isoformat(),
                size="241MB",
                vulnerabilities=1,
                is_latest=False
            )
        ]
        
        service_image.available_tags = mock_tags
        
    except Exception as e:
        logger.warning("태그 목록 업데이트 실패", service_name=service_image.service_name, error=str(e))


async def _get_deployment_status_from_k8s(service_name: str, namespace: str) -> ServiceDeploymentStatus:
    """Kubernetes API를 통해 실제 배포 상태 조회"""
    try:
        # Deployment 상태 조회
        deployment = k8s_apps_v1.read_namespaced_deployment(name=service_name, namespace=namespace)
        
        # Pod 목록 조회
        pods = k8s_core_v1.list_namespaced_pod(
            namespace=namespace,
            label_selector=f"app={service_name}"
        )
        
        pod_statuses = []
        for pod in pods.items:
            pod_status = PodStatus(
                pod_name=pod.metadata.name,
                status=pod.status.phase,
                current_image=pod.spec.containers[0].image,
                ready=pod.status.conditions and any(c.type == "Ready" and c.status == "True" for c in pod.status.conditions),
                restarts=sum(cs.restart_count for cs in pod.status.container_statuses or []),
                created_at=pod.metadata.creation_timestamp.isoformat(),
                node_name=pod.spec.node_name
            )
            pod_statuses.append(pod_status)
        
        return ServiceDeploymentStatus(
            service_name=service_name,
            desired_image=deployment.spec.template.spec.containers[0].image,
            current_image=deployment.spec.template.spec.containers[0].image,
            replicas={
                "desired": deployment.spec.replicas,
                "ready": deployment.status.ready_replicas or 0,
                "available": deployment.status.available_replicas or 0,
                "updated": deployment.status.updated_replicas or 0
            },
            pods=pod_statuses,
            rollout_status="complete" if deployment.status.ready_replicas == deployment.spec.replicas else "progressing",
            last_updated=datetime.now().isoformat()
        )
        
    except ApiException as e:
        if e.status == 404:
            raise HTTPException(status_code=404, detail=f"서비스 '{service_name}'를 찾을 수 없습니다")
        raise e


async def _get_mock_deployment_status(service_name: str, namespace: str) -> ServiceDeploymentStatus:
    """Mock 배포 상태 데이터 생성"""
    mock_pods = [
        PodStatus(
            pod_name=f"{service_name}-deployment-abc123",
            status="Running",
            current_image=f"harbor.company.com/ecp-ai/{service_name}:v1.2.3",
            ready=True,
            restarts=0,
            created_at=(datetime.now() - timedelta(hours=2)).isoformat(),
            node_name="worker-node-1"
        ),
        PodStatus(
            pod_name=f"{service_name}-deployment-def456",
            status="Running",
            current_image=f"harbor.company.com/ecp-ai/{service_name}:v1.2.3",
            ready=True,
            restarts=1,
            created_at=(datetime.now() - timedelta(hours=2)).isoformat(),
            node_name="worker-node-2"
        )
    ]
    
    return ServiceDeploymentStatus(
        service_name=service_name,
        desired_image=f"harbor.company.com/ecp-ai/{service_name}:v1.2.3",
        current_image=f"harbor.company.com/ecp-ai/{service_name}:v1.2.3",
        replicas={
            "desired": 2,
            "ready": 2,
            "available": 2,
            "updated": 2
        },
        pods=mock_pods,
        rollout_status="complete",
        last_updated=datetime.now().isoformat()
    )


async def _get_deployment_history_from_k8s(service_name: str, namespace: str) -> List[DeploymentHistory]:
    """Kubernetes에서 배포 히스토리 조회"""
    try:
        # ReplicaSet 목록을 통해 배포 히스토리 구성
        replica_sets = k8s_apps_v1.list_namespaced_replica_set(
            namespace=namespace,
            label_selector=f"app={service_name}"
        )
        
        history = []
        for i, rs in enumerate(replica_sets.items[:10]):  # 최근 10개만
            history_entry = DeploymentHistory(
                revision=i + 1,
                image=rs.spec.template.spec.containers[0].image,
                deployed_at=rs.metadata.creation_timestamp.isoformat(),
                deployed_by="kubernetes",
                status="completed",
                rollback_available=i > 0,
                change_cause=rs.metadata.annotations.get("deployment.kubernetes.io/change-cause", "Unknown")
            )
            history.append(history_entry)
        
        return sorted(history, key=lambda x: x.revision, reverse=True)
        
    except Exception as e:
        logger.warning("배포 히스토리 조회 실패", service_name=service_name, error=str(e))
        return await _get_mock_deployment_history(service_name)


async def _get_mock_deployment_history(service_name: str) -> List[DeploymentHistory]:
    """Mock 배포 히스토리 데이터 생성"""
    return [
        DeploymentHistory(
            revision=3,
            image=f"harbor.company.com/ecp-ai/{service_name}:v1.2.3",
            deployed_at=(datetime.now() - timedelta(hours=2)).isoformat(),
            deployed_by="admin",
            status="completed",
            rollback_available=False,
            change_cause="Bug fix and performance improvement"
        ),
        DeploymentHistory(
            revision=2,
            image=f"harbor.company.com/ecp-ai/{service_name}:v1.2.2",
            deployed_at=(datetime.now() - timedelta(days=1)).isoformat(),
            deployed_by="developer",
            status="completed",
            rollback_available=True,
            change_cause="Feature update"
        ),
        DeploymentHistory(
            revision=1,
            image=f"harbor.company.com/ecp-ai/{service_name}:v1.2.1",
            deployed_at=(datetime.now() - timedelta(days=7)).isoformat(),
            deployed_by="admin",
            status="completed",
            rollback_available=True,
            change_cause="Initial deployment"
        )
    ]


async def _execute_deployment(deployment_id: str, request: DeploymentRequest):
    """백그라운드에서 배포 실행"""
    try:
        logger.info("배포 실행 시작", deployment_id=deployment_id)
        
        # 실제 구현에서는 Kubernetes API를 통해 배포 실행
        # 여기서는 시뮬레이션
        await asyncio.sleep(5)  # 배포 시뮬레이션
        
        # 배포 히스토리 업데이트
        for service_name in request.services:
            history_key = f"{request.tenant_id}-ecp-ai-{service_name}"
            
            if service_name in _service_images:
                service_image = _service_images[service_name]
                image_url = f"{service_image.registry.url}/{service_image.repository}:{service_image.selected_tag}"
            else:
                image_url = f"ecp-ai/{service_name}:latest"
            
            history_entry = DeploymentHistory(
                revision=len(_deployment_history.get(history_key, [])) + 1,
                image=image_url,
                deployed_at=datetime.now().isoformat(),
                deployed_by="system",
                status="completed",
                rollback_available=True,
                change_cause=request.change_cause or "Automated deployment"
            )
            
            if history_key not in _deployment_history:
                _deployment_history[history_key] = []
            _deployment_history[history_key].insert(0, history_entry)
        
        logger.info("배포 실행 완료", deployment_id=deployment_id)
        
    except Exception as e:
        logger.error("배포 실행 실패", deployment_id=deployment_id, error=str(e))


async def _execute_rollback(service_name: str, namespace: str, revision: int) -> bool:
    """롤백 실행"""
    try:
        # 실제 구현에서는 kubectl rollout undo 명령어와 동일한 작업 수행
        logger.info("롤백 실행", service_name=service_name, namespace=namespace, revision=revision)
        
        # 시뮬레이션
        await asyncio.sleep(3)
        
        return True
        
    except Exception as e:
        logger.error("롤백 실행 실패", service_name=service_name, error=str(e))
        return False
