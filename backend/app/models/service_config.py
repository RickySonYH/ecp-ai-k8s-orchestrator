"""
[advice from AI] 서비스 설정 모델 - CICD 이미지 관리
ECP-AI Kubernetes Orchestrator 서비스 설정 모델
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

# [advice from AI] 서비스 카테고리 열거형
class ServiceCategory(str, Enum):
    MAIN = "main"           # 메인 서비스 (콜봇, 챗봇, 어드바이저)
    AI_NLP = "ai_nlp"       # AI/NLP 서비스 (STT, TTS, NLP, AICM)
    ANALYTICS = "analytics" # 분석 서비스 (TA, QA)
    INFRASTRUCTURE = "infrastructure"  # 인프라 서비스 (Nginx, Gateway, Auth)
    DATA = "data"           # 데이터 서비스 (PostgreSQL, Vector DB, Redis)
    SPECIALIZED = "specialized"  # 특화 서비스 (LiveKit, Speaker Separation)

# [advice from AI] CICD 이미지 생성 모델
class CICDImageCreate(BaseModel):
    service_name: str = Field(..., description="서비스명 (영문)")
    display_name: str = Field(..., description="표시명 (한글)")
    image_name: str = Field(..., description="이미지명")
    image_tag: str = Field(default="latest", description="이미지 태그")
    registry_url: str = Field(..., description="레지스트리 URL")
    repository: str = Field(..., description="저장소 경로")
    category: ServiceCategory = Field(..., description="서비스 카테고리")
    description: Optional[str] = Field(None, description="서비스 설명")

# [advice from AI] CICD 이미지 업데이트 모델
class CICDImageUpdate(BaseModel):
    display_name: Optional[str] = Field(None, description="표시명 (한글)")
    image_name: Optional[str] = Field(None, description="이미지명")
    image_tag: Optional[str] = Field(None, description="이미지 태그")
    registry_url: Optional[str] = Field(None, description="레지스트리 URL")
    repository: Optional[str] = Field(None, description="저장소 경로")
    category: Optional[ServiceCategory] = Field(None, description="서비스 카테고리")
    description: Optional[str] = Field(None, description="서비스 설명")
    is_active: Optional[bool] = Field(None, description="활성화 상태")

# [advice from AI] CICD 이미지 응답 모델
class CICDImageResponse(BaseModel):
    id: int
    service_name: str
    display_name: str
    image_name: str
    image_tag: str
    registry_url: str
    repository: str
    category: ServiceCategory
    description: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# [advice from AI] CICD 통계 응답 모델
class CICDStatsResponse(BaseModel):
    total_images: int
    active_images: int
    inactive_images: int
    category_stats: Dict[str, int]
    recent_images: List[Dict[str, Any]]

# [advice from AI] GitHub 연결 모델
class GitHubConnection(BaseModel):
    id: Optional[str] = None
    name: str = Field(..., description="연결 이름")
    repository: str = Field(..., description="저장소 (owner/repo)")
    branch: str = Field(default="main", description="브랜치")
    access_token: str = Field(..., description="액세스 토큰")
    webhook_url: Optional[str] = Field(None, description="웹훅 URL")
    is_default: bool = Field(default=False, description="기본 연결 여부")

# [advice from AI] 이미지 빌드 모델
class ImageBuild(BaseModel):
    id: Optional[str] = None
    service_name: str = Field(..., description="서비스명")
    repository: str = Field(..., description="저장소")
    branch: str = Field(default="main", description="브랜치")
    commit_hash: str = Field(..., description="커밋 해시")
    commit_message: str = Field(..., description="커밋 메시지")
    image_tag: str = Field(default="latest", description="이미지 태그")

# [advice from AI] 배포 정책 모델
class DeploymentPolicy(BaseModel):
    id: Optional[str] = None
    name: str = Field(..., description="정책 이름")
    service_name: str = Field(..., description="서비스명")
    environment: str = Field(..., description="환경 (dev/staging/production)")
    auto_deploy: bool = Field(default=False, description="자동 배포")
    approval_required: bool = Field(default=False, description="승인 필요")
    approvers: List[str] = Field(default=[], description="승인자 목록")
    health_checks: Dict[str, Any] = Field(default_factory=dict, description="헬스체크 설정")
    rollback_policy: Dict[str, Any] = Field(default_factory=dict, description="롤백 정책")

# [advice from AI] 서비스 설정 모델
class ServiceConfig(BaseModel):
    service_name: str
    display_name: str
    category: ServiceCategory
    description: Optional[str] = None
    image_config: Optional[Dict[str, Any]] = None
    resource_config: Optional[Dict[str, Any]] = None
    deployment_config: Optional[Dict[str, Any]] = None
    monitoring_config: Optional[Dict[str, Any]] = None

# [advice from AI] 레지스트리 설정 모델
class RegistryConfig(BaseModel):
    name: str
    url: str
    type: str  # harbor, ecr, gcr, docker-hub, private
    credentials: Optional[Dict[str, str]] = None
    is_default: bool = False

# [advice from AI] 빌드 파이프라인 설정 모델
class BuildPipelineConfig(BaseModel):
    name: str
    service_name: str
    trigger_type: str  # manual, webhook, schedule
    build_steps: List[Dict[str, Any]]
    is_enabled: bool = True

# [advice from AI] 보안 스캔 설정 모델
class SecurityScanConfig(BaseModel):
    service_name: str
    scan_type: str  # trivy, clair, snyk
    scan_schedule: Optional[str] = None
    severity_threshold: str = "medium"
    auto_block: bool = False

# [advice from AI] 배포 설정 모델
class DeploymentConfig(BaseModel):
    service_name: str
    environment: str
    replicas: int = 1
    strategy: str = "RollingUpdate"
    health_check: Optional[Dict[str, Any]] = None
    resource_limits: Optional[Dict[str, Any]] = None
    environment_variables: Optional[Dict[str, str]] = None
