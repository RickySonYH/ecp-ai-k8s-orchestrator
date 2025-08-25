# [advice from AI] 이미지 관리 API 엔드포인트
"""
Image Management API
- 컨테이너 이미지 관리
- 레지스트리 설정 관리
- 이미지 스캔 결과 관리
- 빌드 파이프라인 관리
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import asyncio
import httpx
from datetime import datetime, timedelta
import json
import os

router = APIRouter(prefix="/images", tags=["images"])

# 데이터 모델
class ContainerRegistry(BaseModel):
    id: Optional[str] = None
    name: str
    url: str
    type: str  # harbor, ecr, gcr, docker-hub, private
    is_default: bool = False
    status: str = "disconnected"
    credentials: Optional[Dict[str, str]] = None
    last_sync: Optional[str] = None

class ServiceImage(BaseModel):
    service_name: str
    display_name: str
    registry: str
    repository: str
    current_tag: str
    available_tags: List[str] = []
    last_updated: Optional[str] = None
    scan_status: str = "not-scanned"  # passed, warning, critical, scanning, not-scanned
    vulnerabilities: Optional[Dict[str, int]] = None

class BuildPipeline(BaseModel):
    id: Optional[str] = None
    name: str
    service: str
    status: str = "queued"  # running, success, failed, queued
    last_run: Optional[str] = None
    duration: Optional[str] = None
    trigger: str = "manual"  # manual, webhook, schedule
    is_enabled: bool = True

class ImageUpdateRequest(BaseModel):
    service_name: str
    registry: str
    repository: str
    tag: str

# Mock 데이터 저장소 (실제 구현에서는 데이터베이스 사용)
registries_db: List[ContainerRegistry] = []
service_images_db: List[ServiceImage] = []
build_pipelines_db: List[BuildPipeline] = []

def init_mock_data():
    """초기 Mock 데이터 생성"""
    global registries_db, service_images_db, build_pipelines_db
    
    # 기본 레지스트리
    registries_db = [
        ContainerRegistry(
            id="1",
            name="ECP Harbor Registry",
            url="harbor.ecp-ai.com",
            type="harbor",
            is_default=True,
            status="connected",
            last_sync=datetime.now().isoformat()
        ),
        ContainerRegistry(
            id="2",
            name="AWS ECR",
            url="123456789012.dkr.ecr.us-west-2.amazonaws.com",
            type="ecr",
            is_default=False,
            status="connected",
            last_sync=(datetime.now() - timedelta(hours=1)).isoformat()
        )
    ]
    
    # [advice from AI] 기본 환경 문서를 기반으로 확장된 서비스 이미지 목록
    service_images_db = [
        # 메인 서비스
        ServiceImage(
            service_name="callbot",
            display_name="Callbot Service (콜봇)",
            registry="harbor.ecp-ai.com",
            repository="ecp-ai/callbot",
            current_tag="v1.2.3",
            available_tags=["v1.2.3", "v1.2.2", "v1.2.1", "latest", "develop"],
            last_updated=datetime.now().isoformat(),
            scan_status="passed",
            vulnerabilities={"critical": 0, "high": 0, "medium": 2, "low": 5}
        ),
        ServiceImage(
            service_name="chatbot",
            display_name="Chatbot Service (챗봇)",
            registry="harbor.ecp-ai.com",
            repository="ecp-ai/chatbot",
            current_tag="v1.1.8",
            available_tags=["v1.1.8", "v1.1.7", "v1.1.6", "latest"],
            last_updated=(datetime.now() - timedelta(hours=2)).isoformat(),
            scan_status="warning",
            vulnerabilities={"critical": 0, "high": 2, "medium": 4, "low": 8}
        ),
        ServiceImage(
            service_name="advisor",
            display_name="Advisor Service (어드바이저)",
            registry="harbor.ecp-ai.com",
            repository="ecp-ai/advisor",
            current_tag="v2.1.0",
            available_tags=["v2.1.0", "v2.0.9", "v2.0.8", "latest"],
            last_updated=(datetime.now() - timedelta(hours=1)).isoformat(),
            scan_status="passed",
            vulnerabilities={"critical": 0, "high": 0, "medium": 1, "low": 4}
        ),
        
        # 지원 서비스 - AI/NLP 관련
        ServiceImage(
            service_name="stt",
            display_name="STT Service (음성인식)",
            registry="harbor.ecp-ai.com",
            repository="ecp-ai/stt",
            current_tag="v2.0.1",
            available_tags=["v2.0.1", "v2.0.0", "v1.9.5", "latest"],
            last_updated=(datetime.now() - timedelta(hours=4)).isoformat(),
            scan_status="critical",
            vulnerabilities={"critical": 1, "high": 3, "medium": 6, "low": 12}
        ),
        ServiceImage(
            service_name="tts",
            display_name="TTS Service (음성합성)",
            registry="harbor.ecp-ai.com",
            repository="ecp-ai/tts",
            current_tag="v1.5.2",
            available_tags=["v1.5.2", "v1.5.1", "v1.5.0", "latest"],
            last_updated=(datetime.now() - timedelta(hours=6)).isoformat(),
            scan_status="passed",
            vulnerabilities={"critical": 0, "high": 0, "medium": 1, "low": 3}
        ),
        ServiceImage(
            service_name="nlp",
            display_name="NLP Engine (자연어처리)",
            registry="harbor.ecp-ai.com",
            repository="ecp-ai/nlp-engine",
            current_tag="v3.2.1",
            available_tags=["v3.2.1", "v3.2.0", "v3.1.8", "latest"],
            last_updated=(datetime.now() - timedelta(hours=3)).isoformat(),
            scan_status="passed",
            vulnerabilities={"critical": 0, "high": 1, "medium": 3, "low": 7}
        ),
        ServiceImage(
            service_name="aicm",
            display_name="AICM Service (지식관리)",
            registry="harbor.ecp-ai.com",
            repository="ecp-ai/aicm",
            current_tag="v1.8.5",
            available_tags=["v1.8.5", "v1.8.4", "v1.8.3", "latest"],
            last_updated=(datetime.now() - timedelta(hours=5)).isoformat(),
            scan_status="warning",
            vulnerabilities={"critical": 0, "high": 2, "medium": 5, "low": 9}
        ),
        
        # 분석 및 품질관리 서비스
        ServiceImage(
            service_name="ta",
            display_name="TA Service (통계분석)",
            registry="harbor.ecp-ai.com",
            repository="ecp-ai/text-analytics",
            current_tag="v2.3.0",
            available_tags=["v2.3.0", "v2.2.9", "v2.2.8", "latest"],
            last_updated=(datetime.now() - timedelta(hours=8)).isoformat(),
            scan_status="passed",
            vulnerabilities={"critical": 0, "high": 0, "medium": 2, "low": 6}
        ),
        ServiceImage(
            service_name="qa",
            display_name="QA Service (품질관리)",
            registry="harbor.ecp-ai.com",
            repository="ecp-ai/quality-assurance",
            current_tag="v1.4.2",
            available_tags=["v1.4.2", "v1.4.1", "v1.4.0", "latest"],
            last_updated=(datetime.now() - timedelta(hours=7)).isoformat(),
            scan_status="passed",
            vulnerabilities={"critical": 0, "high": 0, "medium": 1, "low": 2}
        ),
        
        # 인프라 및 공통 서비스
        ServiceImage(
            service_name="nginx",
            display_name="Nginx Proxy Server",
            registry="harbor.ecp-ai.com",
            repository="nginx",
            current_tag="v1.25.3",
            available_tags=["v1.25.3", "v1.25.2", "v1.24.0", "latest"],
            last_updated=(datetime.now() - timedelta(hours=12)).isoformat(),
            scan_status="passed",
            vulnerabilities={"critical": 0, "high": 0, "medium": 0, "low": 1}
        ),
        ServiceImage(
            service_name="gateway",
            display_name="API Gateway (Kong/Spring)",
            registry="harbor.ecp-ai.com",
            repository="ecp-ai/api-gateway",
            current_tag="v2.8.0",
            available_tags=["v2.8.0", "v2.7.9", "v2.7.8", "latest"],
            last_updated=(datetime.now() - timedelta(hours=9)).isoformat(),
            scan_status="warning",
            vulnerabilities={"critical": 0, "high": 1, "medium": 4, "low": 8}
        ),
        ServiceImage(
            service_name="auth",
            display_name="Authentication Service (권한관리)",
            registry="harbor.ecp-ai.com",
            repository="ecp-ai/auth-service",
            current_tag="v1.6.1",
            available_tags=["v1.6.1", "v1.6.0", "v1.5.9", "latest"],
            last_updated=(datetime.now() - timedelta(hours=10)).isoformat(),
            scan_status="passed",
            vulnerabilities={"critical": 0, "high": 0, "medium": 2, "low": 4}
        ),
        ServiceImage(
            service_name="history",
            display_name="History Service (대화이력)",
            registry="harbor.ecp-ai.com",
            repository="ecp-ai/conversation-history",
            current_tag="v1.9.2",
            available_tags=["v1.9.2", "v1.9.1", "v1.9.0", "latest"],
            last_updated=(datetime.now() - timedelta(hours=6)).isoformat(),
            scan_status="passed",
            vulnerabilities={"critical": 0, "high": 0, "medium": 1, "low": 3}
        ),
        ServiceImage(
            service_name="scenario-builder",
            display_name="Scenario Builder (시나리오빌더)",
            registry="harbor.ecp-ai.com",
            repository="ecp-ai/scenario-builder",
            current_tag="v1.3.4",
            available_tags=["v1.3.4", "v1.3.3", "v1.3.2", "latest"],
            last_updated=(datetime.now() - timedelta(hours=11)).isoformat(),
            scan_status="passed",
            vulnerabilities={"critical": 0, "high": 0, "medium": 2, "low": 5}
        ),
        
        # 데이터베이스 및 스토리지
        ServiceImage(
            service_name="postgresql",
            display_name="PostgreSQL Database",
            registry="harbor.ecp-ai.com",
            repository="postgres",
            current_tag="v15.4",
            available_tags=["v15.4", "v15.3", "v14.9", "latest"],
            last_updated=(datetime.now() - timedelta(hours=15)).isoformat(),
            scan_status="passed",
            vulnerabilities={"critical": 0, "high": 0, "medium": 0, "low": 2}
        ),
        ServiceImage(
            service_name="vector-db",
            display_name="Vector Database (벡터DB)",
            registry="harbor.ecp-ai.com",
            repository="ecp-ai/vector-database",
            current_tag="v2.1.3",
            available_tags=["v2.1.3", "v2.1.2", "v2.1.1", "latest"],
            last_updated=(datetime.now() - timedelta(hours=13)).isoformat(),
            scan_status="warning",
            vulnerabilities={"critical": 0, "high": 1, "medium": 3, "low": 6}
        ),
        ServiceImage(
            service_name="redis",
            display_name="Redis Cache Server",
            registry="harbor.ecp-ai.com",
            repository="redis",
            current_tag="v7.2.3",
            available_tags=["v7.2.3", "v7.2.2", "v7.0.15", "latest"],
            last_updated=(datetime.now() - timedelta(hours=14)).isoformat(),
            scan_status="passed",
            vulnerabilities={"critical": 0, "high": 0, "medium": 1, "low": 2}
        ),
        
        # 특화 서비스
        ServiceImage(
            service_name="livekit",
            display_name="LiveKit Server (Call Gateway)",
            registry="harbor.ecp-ai.com",
            repository="livekit/livekit-server",
            current_tag="v1.5.2",
            available_tags=["v1.5.2", "v1.5.1", "v1.5.0", "latest"],
            last_updated=(datetime.now() - timedelta(hours=16)).isoformat(),
            scan_status="passed",
            vulnerabilities={"critical": 0, "high": 0, "medium": 2, "low": 4}
        ),
        ServiceImage(
            service_name="speaker-separation",
            display_name="Speaker Separation (화자분리)",
            registry="harbor.ecp-ai.com",
            repository="ecp-ai/speaker-separation",
            current_tag="v1.2.1",
            available_tags=["v1.2.1", "v1.2.0", "v1.1.9", "latest"],
            last_updated=(datetime.now() - timedelta(hours=18)).isoformat(),
            scan_status="warning",
            vulnerabilities={"critical": 0, "high": 2, "medium": 3, "low": 5}
        ),
        ServiceImage(
            service_name="monitoring",
            display_name="Monitoring Service (모니터링)",
            registry="harbor.ecp-ai.com",
            repository="ecp-ai/monitoring-service",
            current_tag="v1.7.8",
            available_tags=["v1.7.8", "v1.7.7", "v1.7.6", "latest"],
            last_updated=(datetime.now() - timedelta(hours=20)).isoformat(),
            scan_status="passed",
            vulnerabilities={"critical": 0, "high": 0, "medium": 1, "low": 3}
        )
    ]
    
    # [advice from AI] 기본 환경 문서를 기반으로 확장된 빌드 파이프라인
    build_pipelines_db = [
        # 메인 서비스 파이프라인
        BuildPipeline(
            id="1",
            name="Callbot Build Pipeline",
            service="callbot",
            status="success",
            last_run=(datetime.now() - timedelta(minutes=30)).isoformat(),
            duration="3m 45s",
            trigger="webhook",
            is_enabled=True
        ),
        BuildPipeline(
            id="2",
            name="Chatbot Build Pipeline",
            service="chatbot",
            status="running",
            last_run=(datetime.now() - timedelta(minutes=5)).isoformat(),
            duration="2m 12s",
            trigger="manual",
            is_enabled=True
        ),
        BuildPipeline(
            id="3",
            name="Advisor Build Pipeline",
            service="advisor",
            status="success",
            last_run=(datetime.now() - timedelta(minutes=45)).isoformat(),
            duration="4m 20s",
            trigger="webhook",
            is_enabled=True
        ),
        
        # AI/NLP 서비스 파이프라인
        BuildPipeline(
            id="4",
            name="STT Service Build Pipeline",
            service="stt",
            status="failed",
            last_run=(datetime.now() - timedelta(hours=2)).isoformat(),
            duration="6m 15s",
            trigger="schedule",
            is_enabled=True
        ),
        BuildPipeline(
            id="5",
            name="TTS Service Build Pipeline",
            service="tts",
            status="success",
            last_run=(datetime.now() - timedelta(hours=1)).isoformat(),
            duration="8m 30s",
            trigger="manual",
            is_enabled=True
        ),
        BuildPipeline(
            id="6",
            name="NLP Engine Build Pipeline",
            service="nlp",
            status="success",
            last_run=(datetime.now() - timedelta(minutes=90)).isoformat(),
            duration="12m 45s",
            trigger="webhook",
            is_enabled=True
        ),
        BuildPipeline(
            id="7",
            name="AICM Build Pipeline",
            service="aicm",
            status="queued",
            last_run=(datetime.now() - timedelta(hours=3)).isoformat(),
            duration="5m 20s",
            trigger="schedule",
            is_enabled=True
        ),
        
        # 분석 서비스 파이프라인
        BuildPipeline(
            id="8",
            name="TA Service Build Pipeline",
            service="ta",
            status="success",
            last_run=(datetime.now() - timedelta(hours=4)).isoformat(),
            duration="7m 10s",
            trigger="manual",
            is_enabled=True
        ),
        BuildPipeline(
            id="9",
            name="QA Service Build Pipeline",
            service="qa",
            status="success",
            last_run=(datetime.now() - timedelta(hours=6)).isoformat(),
            duration="3m 55s",
            trigger="webhook",
            is_enabled=True
        ),
        
        # 인프라 서비스 파이프라인
        BuildPipeline(
            id="10",
            name="API Gateway Build Pipeline",
            service="gateway",
            status="success",
            last_run=(datetime.now() - timedelta(hours=8)).isoformat(),
            duration="4m 35s",
            trigger="manual",
            is_enabled=True
        ),
        BuildPipeline(
            id="11",
            name="Auth Service Build Pipeline",
            service="auth",
            status="success",
            last_run=(datetime.now() - timedelta(hours=12)).isoformat(),
            duration="3m 20s",
            trigger="webhook",
            is_enabled=True
        ),
        BuildPipeline(
            id="12",
            name="History Service Build Pipeline",
            service="history",
            status="running",
            last_run=(datetime.now() - timedelta(minutes=15)).isoformat(),
            duration="2m 40s",
            trigger="schedule",
            is_enabled=True
        ),
        
        # 특화 서비스 파이프라인
        BuildPipeline(
            id="13",
            name="Scenario Builder Build Pipeline",
            service="scenario-builder",
            status="success",
            last_run=(datetime.now() - timedelta(hours=24)).isoformat(),
            duration="6m 50s",
            trigger="manual",
            is_enabled=False
        ),
        BuildPipeline(
            id="14",
            name="Speaker Separation Build Pipeline",
            service="speaker-separation",
            status="failed",
            last_run=(datetime.now() - timedelta(hours=18)).isoformat(),
            duration="15m 20s",
            trigger="webhook",
            is_enabled=True
        ),
        BuildPipeline(
            id="15",
            name="Monitoring Service Build Pipeline",
            service="monitoring",
            status="success",
            last_run=(datetime.now() - timedelta(hours=36)).isoformat(),
            duration="4m 15s",
            trigger="schedule",
            is_enabled=True
        )
    ]

# 초기화
init_mock_data()

# API 엔드포인트

@router.get("/registries", response_model=List[ContainerRegistry])
async def get_registries():
    """컨테이너 레지스트리 목록 조회"""
    return registries_db

@router.post("/registries", response_model=ContainerRegistry)
async def create_registry(registry: ContainerRegistry):
    """컨테이너 레지스트리 추가"""
    registry.id = str(len(registries_db) + 1)
    registry.status = "connected"  # 실제로는 연결 테스트 수행
    registry.last_sync = datetime.now().isoformat()
    registries_db.append(registry)
    return registry

@router.put("/registries/{registry_id}", response_model=ContainerRegistry)
async def update_registry(registry_id: str, registry: ContainerRegistry):
    """컨테이너 레지스트리 수정"""
    for i, existing in enumerate(registries_db):
        if existing.id == registry_id:
            registry.id = registry_id
            registry.last_sync = datetime.now().isoformat()
            registries_db[i] = registry
            return registry
    raise HTTPException(status_code=404, detail="Registry not found")

@router.delete("/registries/{registry_id}")
async def delete_registry(registry_id: str):
    """컨테이너 레지스트리 삭제"""
    global registries_db
    registries_db = [r for r in registries_db if r.id != registry_id]
    return {"message": "Registry deleted successfully"}

@router.post("/registries/{registry_id}/test")
async def test_registry_connection(registry_id: str):
    """레지스트리 연결 테스트"""
    registry = next((r for r in registries_db if r.id == registry_id), None)
    if not registry:
        raise HTTPException(status_code=404, detail="Registry not found")
    
    # 실제 구현에서는 레지스트리 연결 테스트 수행
    # 여기서는 Mock 응답
    await asyncio.sleep(1)  # 연결 테스트 시뮬레이션
    
    registry.status = "connected"
    registry.last_sync = datetime.now().isoformat()
    
    return {"status": "connected", "message": "Connection successful"}

@router.get("/services", response_model=List[ServiceImage])
async def get_service_images():
    """서비스 이미지 목록 조회"""
    return service_images_db

@router.put("/services/{service_name}/image", response_model=ServiceImage)
async def update_service_image(service_name: str, update_request: ImageUpdateRequest):
    """서비스 이미지 설정 업데이트"""
    for i, image in enumerate(service_images_db):
        if image.service_name == service_name:
            image.registry = update_request.registry
            image.repository = update_request.repository
            image.current_tag = update_request.tag
            image.last_updated = datetime.now().isoformat()
            service_images_db[i] = image
            return image
    raise HTTPException(status_code=404, detail="Service image not found")

@router.post("/services/{service_name}/scan")
async def scan_service_image(service_name: str):
    """서비스 이미지 보안 스캔 실행"""
    image = next((img for img in service_images_db if img.service_name == service_name), None)
    if not image:
        raise HTTPException(status_code=404, detail="Service image not found")
    
    # 스캔 상태를 scanning으로 변경
    image.scan_status = "scanning"
    
    # 백그라운드에서 스캔 시뮬레이션
    async def simulate_scan():
        await asyncio.sleep(10)  # 10초 스캔 시뮬레이션
        
        # 랜덤한 스캔 결과 생성
        import random
        scan_results = ["passed", "warning", "critical"]
        image.scan_status = random.choice(scan_results)
        
        if image.scan_status == "critical":
            image.vulnerabilities = {"critical": 2, "high": 5, "medium": 8, "low": 15}
        elif image.scan_status == "warning":
            image.vulnerabilities = {"critical": 0, "high": 2, "medium": 4, "low": 8}
        else:
            image.vulnerabilities = {"critical": 0, "high": 0, "medium": 1, "low": 3}
    
    # 백그라운드 태스크로 실행
    asyncio.create_task(simulate_scan())
    
    return {"message": "Scan started", "status": "scanning"}

@router.get("/services/{service_name}/tags")
async def get_available_tags(service_name: str, registry: Optional[str] = None):
    """서비스 이미지의 사용 가능한 태그 목록 조회"""
    image = next((img for img in service_images_db if img.service_name == service_name), None)
    if not image:
        raise HTTPException(status_code=404, detail="Service image not found")
    
    # 실제 구현에서는 레지스트리 API를 호출하여 태그 목록 조회
    # 여기서는 Mock 데이터 반환
    return {
        "service_name": service_name,
        "repository": image.repository,
        "tags": image.available_tags
    }

@router.get("/pipelines", response_model=List[BuildPipeline])
async def get_build_pipelines():
    """빌드 파이프라인 목록 조회"""
    return build_pipelines_db

@router.post("/pipelines", response_model=BuildPipeline)
async def create_build_pipeline(pipeline: BuildPipeline):
    """빌드 파이프라인 생성"""
    pipeline.id = str(len(build_pipelines_db) + 1)
    build_pipelines_db.append(pipeline)
    return pipeline

@router.post("/pipelines/{pipeline_id}/run")
async def run_build_pipeline(pipeline_id: str):
    """빌드 파이프라인 실행"""
    pipeline = next((p for p in build_pipelines_db if p.id == pipeline_id), None)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    
    if not pipeline.is_enabled:
        raise HTTPException(status_code=400, detail="Pipeline is disabled")
    
    # 파이프라인 상태를 running으로 변경
    pipeline.status = "running"
    pipeline.last_run = datetime.now().isoformat()
    
    # 백그라운드에서 빌드 시뮬레이션
    async def simulate_build():
        import random
        await asyncio.sleep(random.randint(30, 180))  # 30초~3분 빌드 시뮬레이션
        
        # 빌드 결과 (90% 성공률)
        pipeline.status = "success" if random.random() > 0.1 else "failed"
        pipeline.duration = f"{random.randint(1, 5)}m {random.randint(10, 59)}s"
    
    # 백그라운드 태스크로 실행
    asyncio.create_task(simulate_build())
    
    return {"message": "Pipeline started", "status": "running"}

@router.put("/pipelines/{pipeline_id}/toggle")
async def toggle_build_pipeline(pipeline_id: str):
    """빌드 파이프라인 활성화/비활성화 토글"""
    pipeline = next((p for p in build_pipelines_db if p.id == pipeline_id), None)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    
    pipeline.is_enabled = not pipeline.is_enabled
    return {"message": f"Pipeline {'enabled' if pipeline.is_enabled else 'disabled'}", "is_enabled": pipeline.is_enabled}

@router.get("/scan/summary")
async def get_scan_summary():
    """보안 스캔 요약 정보 조회"""
    critical_count = len([img for img in service_images_db if img.scan_status == "critical"])
    warning_count = len([img for img in service_images_db if img.scan_status == "warning"])
    passed_count = len([img for img in service_images_db if img.scan_status == "passed"])
    not_scanned_count = len([img for img in service_images_db if img.scan_status == "not-scanned"])
    
    total_vulnerabilities = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for img in service_images_db:
        if img.vulnerabilities:
            for level, count in img.vulnerabilities.items():
                total_vulnerabilities[level] += count
    
    return {
        "total_images": len(service_images_db),
        "scan_status": {
            "critical": critical_count,
            "warning": warning_count,
            "passed": passed_count,
            "not_scanned": not_scanned_count
        },
        "total_vulnerabilities": total_vulnerabilities,
        "last_scan": max([img.last_updated for img in service_images_db if img.last_updated], default=None)
    }

@router.post("/deploy/update-images")
async def update_deployment_images(updates: List[ImageUpdateRequest]):
    """배포된 서비스들의 이미지를 일괄 업데이트"""
    updated_services = []
    
    for update in updates:
        # 서비스 이미지 설정 업데이트
        for image in service_images_db:
            if image.service_name == update.service_name:
                image.registry = update.registry
                image.repository = update.repository
                image.current_tag = update.tag
                image.last_updated = datetime.now().isoformat()
                updated_services.append(image.service_name)
                break
        
        # 실제 구현에서는 Kubernetes 배포 업데이트 수행
        # kubectl set image deployment/service-name container=new-image:tag
    
    return {
        "message": f"Updated {len(updated_services)} services",
        "updated_services": updated_services
    }

@router.get("/health")
async def health_check():
    """이미지 관리 시스템 상태 확인"""
    connected_registries = len([r for r in registries_db if r.status == "connected"])
    total_registries = len(registries_db)
    
    running_pipelines = len([p for p in build_pipelines_db if p.status == "running"])
    total_pipelines = len(build_pipelines_db)
    
    return {
        "status": "healthy",
        "registries": {
            "connected": connected_registries,
            "total": total_registries
        },
        "pipelines": {
            "running": running_pipelines,
            "total": total_pipelines
        },
        "services": len(service_images_db),
        "timestamp": datetime.now().isoformat()
    }
