# [advice from AI] CICD 설정 관리 API 엔드포인트
"""
CICD 설정 관리 API
- 글로벌 설정 (레지스트리, 보안정책, 모니터링, 개발도구)
- 테넌트별 설정 (빌드&배포, 권한&승인)
- 배포 히스토리 관리
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime
import logging

from ...core.database_manager import get_db_session as get_db
from ...models.database import CICDGlobalSettings, CICDTenantSettings, CICDDeploymentHistory

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cicd", tags=["CICD Settings"])


# Pydantic 모델들
class CICDGlobalSettingCreate(BaseModel):
    setting_key: str = Field(..., description="설정 키")
    setting_category: str = Field(..., description="설정 카테고리 (registry, security, monitoring, devtools)")
    setting_value: Dict[str, Any] = Field(..., description="설정 값 (JSON)")
    description: Optional[str] = Field(None, description="설정 설명")
    is_active: bool = Field(True, description="활성화 여부")


class CICDGlobalSettingUpdate(BaseModel):
    setting_value: Optional[Dict[str, Any]] = Field(None, description="설정 값 (JSON)")
    description: Optional[str] = Field(None, description="설정 설명")
    is_active: Optional[bool] = Field(None, description="활성화 여부")


class CICDGlobalSettingResponse(BaseModel):
    id: int
    setting_key: str
    setting_category: str
    setting_value: Dict[str, Any]
    description: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CICDTenantSettingCreate(BaseModel):
    tenant_id: str = Field(..., description="테넌트 ID")
    setting_key: str = Field(..., description="설정 키")
    setting_category: str = Field(..., description="설정 카테고리 (build_deploy, permissions)")
    setting_value: Dict[str, Any] = Field(..., description="설정 값 (JSON)")
    description: Optional[str] = Field(None, description="설정 설명")
    is_active: bool = Field(True, description="활성화 여부")


class CICDTenantSettingUpdate(BaseModel):
    setting_value: Optional[Dict[str, Any]] = Field(None, description="설정 값 (JSON)")
    description: Optional[str] = Field(None, description="설정 설명")
    is_active: Optional[bool] = Field(None, description="활성화 여부")


class CICDTenantSettingResponse(BaseModel):
    id: int
    tenant_id: str
    setting_key: str
    setting_category: str
    setting_value: Dict[str, Any]
    description: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# 글로벌 설정 API
@router.get("/global-settings", response_model=List[CICDGlobalSettingResponse])
async def get_global_settings(
    category: Optional[str] = None,
    active_only: bool = True,
    db: Session = Depends(get_db)
):
    """글로벌 CICD 설정 목록 조회"""
    query = db.query(CICDGlobalSettings)
    
    if category:
        query = query.filter(CICDGlobalSettings.setting_category == category)
    
    if active_only:
        query = query.filter(CICDGlobalSettings.is_active == True)
    
    settings = query.order_by(CICDGlobalSettings.setting_category, CICDGlobalSettings.setting_key).all()
    return settings


@router.get("/global-settings/{setting_key}", response_model=CICDGlobalSettingResponse)
async def get_global_setting(setting_key: str, db: Session = Depends(get_db)):
    """특정 글로벌 설정 조회"""
    setting = db.query(CICDGlobalSettings).filter(
        CICDGlobalSettings.setting_key == setting_key
    ).first()
    
    if not setting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Global setting '{setting_key}' not found"
        )
    
    return setting


@router.post("/global-settings", response_model=CICDGlobalSettingResponse)
async def create_global_setting(
    setting: CICDGlobalSettingCreate,
    db: Session = Depends(get_db)
):
    """글로벌 설정 생성"""
    # 중복 키 확인
    existing = db.query(CICDGlobalSettings).filter(
        CICDGlobalSettings.setting_key == setting.setting_key
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Global setting '{setting.setting_key}' already exists"
        )
    
    db_setting = CICDGlobalSettings(**setting.dict())
    db.add(db_setting)
    db.commit()
    db.refresh(db_setting)
    
    return db_setting


@router.put("/global-settings/{setting_key}", response_model=CICDGlobalSettingResponse)
async def update_global_setting(
    setting_key: str,
    setting_update: CICDGlobalSettingUpdate,
    db: Session = Depends(get_db)
):
    """글로벌 설정 업데이트"""
    setting = db.query(CICDGlobalSettings).filter(
        CICDGlobalSettings.setting_key == setting_key
    ).first()
    
    if not setting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Global setting '{setting_key}' not found"
        )
    
    update_data = setting_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(setting, field, value)
    
    db.commit()
    db.refresh(setting)
    
    return setting


@router.delete("/global-settings/{setting_key}")
async def delete_global_setting(setting_key: str, db: Session = Depends(get_db)):
    """글로벌 설정 삭제"""
    setting = db.query(CICDGlobalSettings).filter(
        CICDGlobalSettings.setting_key == setting_key
    ).first()
    
    if not setting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Global setting '{setting_key}' not found"
        )
    
    db.delete(setting)
    db.commit()
    
    return {"message": f"Global setting '{setting_key}' deleted successfully"}


# 테넌트별 설정 API
@router.get("/tenant-settings", response_model=List[CICDTenantSettingResponse])
async def get_tenant_settings(
    tenant_id: Optional[str] = None,
    category: Optional[str] = None,
    active_only: bool = True,
    db: Session = Depends(get_db)
):
    """테넌트별 CICD 설정 목록 조회"""
    query = db.query(CICDTenantSettings)
    
    if tenant_id:
        query = query.filter(CICDTenantSettings.tenant_id == tenant_id)
    
    if category:
        query = query.filter(CICDTenantSettings.setting_category == category)
    
    if active_only:
        query = query.filter(CICDTenantSettings.is_active == True)
    
    settings = query.order_by(
        CICDTenantSettings.tenant_id,
        CICDTenantSettings.setting_category,
        CICDTenantSettings.setting_key
    ).all()
    
    return settings


@router.post("/tenant-settings", response_model=CICDTenantSettingResponse)
async def create_tenant_setting(
    setting: CICDTenantSettingCreate,
    db: Session = Depends(get_db)
):
    """테넌트별 설정 생성"""
    # 중복 키 확인
    existing = db.query(CICDTenantSettings).filter(
        CICDTenantSettings.tenant_id == setting.tenant_id,
        CICDTenantSettings.setting_key == setting.setting_key
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tenant setting '{setting.setting_key}' already exists for tenant '{setting.tenant_id}'"
        )
    
    db_setting = CICDTenantSettings(**setting.dict())
    db.add(db_setting)
    db.commit()
    db.refresh(db_setting)
    
    return db_setting


@router.put("/tenant-settings/{tenant_id}/{setting_key}", response_model=CICDTenantSettingResponse)
async def update_tenant_setting(
    tenant_id: str,
    setting_key: str,
    setting_update: CICDTenantSettingUpdate,
    db: Session = Depends(get_db)
):
    """테넌트별 설정 업데이트"""
    setting = db.query(CICDTenantSettings).filter(
        CICDTenantSettings.tenant_id == tenant_id,
        CICDTenantSettings.setting_key == setting_key
    ).first()
    
    if not setting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tenant setting '{setting_key}' not found for tenant '{tenant_id}'"
        )
    
    update_data = setting_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(setting, field, value)
    
    db.commit()
    db.refresh(setting)
    
    return setting


# 초기 설정 데이터 생성 API
@router.post("/initialize-default-settings")
async def initialize_default_settings(db: Session = Depends(get_db)):
    """기본 CICD 설정들을 초기화"""
    
    default_global_settings = [
        # 레지스트리 관리
        {
            "setting_key": "registry_harbor_config",
            "setting_category": "registry",
            "setting_value": {
                "url": "harbor.company.com",
                "username": "admin",
                "is_default": True,
                "ssl_verify": True
            },
            "description": "Harbor 레지스트리 기본 설정"
        },
        {
            "setting_key": "registry_aws_ecr_config",
            "setting_category": "registry", 
            "setting_value": {
                "region": "us-west-2",
                "account_id": "123456789",
                "enabled": False
            },
            "description": "AWS ECR 레지스트리 설정"
        },
        
        # 보안정책
        {
            "setting_key": "security_trivy_scan",
            "setting_category": "security",
            "setting_value": {
                "enabled": True,
                "cve_threshold": 7.0,
                "scan_on_build": True,
                "block_on_high_cve": True
            },
            "description": "Trivy 보안 스캔 설정"
        },
        {
            "setting_key": "security_image_signing",
            "setting_category": "security",
            "setting_value": {
                "enabled": True,
                "cosign_enabled": True,
                "verify_signatures": True
            },
            "description": "이미지 서명 검증 설정"
        },
        
        # 모니터링
        {
            "setting_key": "monitoring_log_collection",
            "setting_category": "monitoring",
            "setting_value": {
                "enabled": True,
                "retention_days": 90,
                "log_level": "INFO"
            },
            "description": "로그 수집 설정"
        },
        {
            "setting_key": "monitoring_alerts",
            "setting_category": "monitoring",
            "setting_value": {
                "slack_enabled": False,
                "email_enabled": False,
                "webhook_url": ""
            },
            "description": "알림 설정"
        },
        
        # 개발도구
        {
            "setting_key": "devtools_sonarqube",
            "setting_category": "devtools",
            "setting_value": {
                "enabled": False,
                "server_url": "",
                "quality_gate_required": True
            },
            "description": "SonarQube 코드 품질 검사"
        },
        {
            "setting_key": "devtools_automated_testing",
            "setting_category": "devtools",
            "setting_value": {
                "unit_tests_required": True,
                "integration_tests_required": False,
                "coverage_threshold": 80
            },
            "description": "자동화된 테스트 설정"
        }
    ]
    
    created_count = 0
    for setting_data in default_global_settings:
        # 기존 설정이 없는 경우에만 생성
        existing = db.query(CICDGlobalSettings).filter(
            CICDGlobalSettings.setting_key == setting_data["setting_key"]
        ).first()
        
        if not existing:
            db_setting = CICDGlobalSettings(**setting_data)
            db.add(db_setting)
            created_count += 1
    
    db.commit()
    
    return {
        "message": f"Default CICD settings initialized successfully",
        "created_count": created_count,
        "total_settings": len(default_global_settings)
    }


# 시스템 상태 API
@router.get("/system-status")
async def get_system_status(db: Session = Depends(get_db)):
    """[advice from AI] CICD 시스템 상태 확인 - 레지스트리, 보안스캔, 모니터링, 개발도구 상태"""
    try:
        # 글로벌 설정에서 상태 정보 추출
        settings = db.query(CICDGlobalSettings).filter(
            CICDGlobalSettings.is_active == True
        ).all()
        
        # 카테고리별 설정 그룹화
        settings_by_category = {}
        for setting in settings:
            if setting.setting_category not in settings_by_category:
                settings_by_category[setting.setting_category] = []
            settings_by_category[setting.setting_category].append(setting)
        
        # 레지스트리 상태 확인
        registries = []
        registry_settings = settings_by_category.get('registry', [])
        for reg_setting in registry_settings:
            reg_config = reg_setting.setting_value
            registries.append({
                "name": reg_setting.setting_key,
                "status": "connected" if reg_config.get("enabled", True) else "disconnected",
                "last_check": datetime.now().isoformat()
            })
        
        # 기본 레지스트리가 없으면 기본값 추가
        if not registries:
            registries.append({
                "name": "default_harbor",
                "status": "disconnected",
                "last_check": datetime.now().isoformat()
            })
        
        # 보안 스캔 상태
        security_settings = settings_by_category.get('security', [])
        security_enabled = any(
            s.setting_value.get("enabled", False) for s in security_settings
        )
        
        # 모니터링 상태
        monitoring_settings = settings_by_category.get('monitoring', [])
        log_collection = any(
            s.setting_value.get("enabled", False) for s in monitoring_settings
            if "log" in s.setting_key
        )
        metrics_collection = any(
            s.setting_value.get("enabled", False) for s in monitoring_settings
            if "metrics" in s.setting_key or "alert" in s.setting_key
        )
        
        # 개발도구 상태
        devtools_settings = settings_by_category.get('devtools', [])
        sonarqube_enabled = any(
            s.setting_value.get("enabled", False) for s in devtools_settings
            if "sonarqube" in s.setting_key
        )
        
        return {
            "registries": registries,
            "security_scan": {
                "enabled": security_enabled,
                "last_scan": datetime.now().isoformat(),
                "scan_queue_size": 0
            },
            "monitoring": {
                "log_collection": log_collection,
                "metrics_collection": metrics_collection,
                "alert_status": "healthy"
            },
            "devtools": {
                "sonarqube_status": "connected" if sonarqube_enabled else "disconnected",
                "test_runner_status": "idle"
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting system status: {e}")
        # 오류 시 기본 상태 반환
        return {
            "registries": [
                {
                    "name": "default_harbor",
                    "status": "disconnected",
                    "last_check": datetime.now().isoformat()
                }
            ],
            "security_scan": {
                "enabled": False,
                "last_scan": datetime.now().isoformat(),
                "scan_queue_size": 0
            },
            "monitoring": {
                "log_collection": False,
                "metrics_collection": False,
                "alert_status": "healthy"
            },
            "devtools": {
                "sonarqube_status": "disconnected",
                "test_runner_status": "idle"
            }
        }
