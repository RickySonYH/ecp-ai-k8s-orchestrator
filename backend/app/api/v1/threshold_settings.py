# [advice from AI] 임계값 설정 관리 API
"""
Threshold Settings Management API
- 모니터링 임계값 설정 저장/조회
- 알림 설정 관리
- 사용자별 개인화 설정
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.database import ThresholdSettings, SessionLocal
from app.core.database_manager import get_db_session

router = APIRouter()

class ThresholdConfig(BaseModel):
    """임계값 구성 모델"""
    cpu: Dict[str, int] = Field(..., description="CPU 임계값 (warning, critical)")
    memory: Dict[str, int] = Field(..., description="메모리 임계값 (warning, critical)")
    gpu: Dict[str, int] = Field(..., description="GPU 임계값 (warning, critical)")
    response_time: Dict[str, int] = Field(..., description="응답시간 임계값 (warning, critical)")
    error_rate: Dict[str, float] = Field(default_factory=lambda: {"warning": 5.0, "critical": 10.0}, description="오류율 임계값")

class ThresholdSettingsCreate(BaseModel):
    """임계값 설정 생성 모델"""
    name: str = Field(..., description="설정 이름")
    description: Optional[str] = Field(None, description="설정 설명")
    category: str = Field(default="monitoring", description="설정 카테고리")
    thresholds: ThresholdConfig = Field(..., description="임계값 설정")
    notifications_enabled: bool = Field(default=True, description="실시간 알림 활성화")
    email_enabled: bool = Field(default=False, description="이메일 알림")
    sms_enabled: bool = Field(default=False, description="SMS 알림")
    slack_enabled: bool = Field(default=False, description="Slack 알림")
    is_default: bool = Field(default=False, description="기본 설정 여부")

class ThresholdSettingsResponse(BaseModel):
    """임계값 설정 응답 모델"""
    id: int
    setting_id: str
    name: str
    description: Optional[str]
    category: str
    thresholds: Dict[str, Any]
    notifications_enabled: bool
    email_enabled: bool
    sms_enabled: bool
    slack_enabled: bool
    created_by: Optional[str]
    updated_by: Optional[str]
    is_active: bool
    is_default: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True

def get_db():
    """데이터베이스 세션 의존성"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# [advice from AI] SLA 수준별 모니터링 프리셋 정의
SLA_PRESETS = {
    "basic": {
        "name": "Basic SLA (99.0%)",
        "description": "개발/테스트 환경용 기본 모니터링 설정",
        "sla_level": 99.0,
        "thresholds": {
            "cpu": {"warning": 85, "critical": 95},
            "memory": {"warning": 90, "critical": 98},
            "gpu": {"warning": 85, "critical": 95},
            "response_time": {"warning": 1000, "critical": 2000},
            "error_rate": {"warning": 10.0, "critical": 20.0}
        },
        "notifications_enabled": True,
        "email_enabled": False,
        "sms_enabled": False
    },
    "standard": {
        "name": "Standard SLA (99.5%)",
        "description": "일반 운영 서비스용 표준 모니터링 설정",
        "sla_level": 99.5,
        "thresholds": {
            "cpu": {"warning": 80, "critical": 90},
            "memory": {"warning": 85, "critical": 95},
            "gpu": {"warning": 80, "critical": 90},
            "response_time": {"warning": 500, "critical": 1000},
            "error_rate": {"warning": 5.0, "critical": 10.0}
        },
        "notifications_enabled": True,
        "email_enabled": True,
        "sms_enabled": False
    },
    "premium": {
        "name": "Premium SLA (99.9%)",
        "description": "중요 비즈니스 서비스용 고급 모니터링 설정",
        "sla_level": 99.9,
        "thresholds": {
            "cpu": {"warning": 70, "critical": 85},
            "memory": {"warning": 75, "critical": 90},
            "gpu": {"warning": 75, "critical": 85},
            "response_time": {"warning": 300, "critical": 500},
            "error_rate": {"warning": 2.0, "critical": 5.0}
        },
        "notifications_enabled": True,
        "email_enabled": True,
        "sms_enabled": True
    },
    "enterprise": {
        "name": "Enterprise SLA (99.99%)",
        "description": "미션 크리티컬 서비스용 최고 수준 모니터링 설정",
        "sla_level": 99.99,
        "thresholds": {
            "cpu": {"warning": 60, "critical": 75},
            "memory": {"warning": 70, "critical": 85},
            "gpu": {"warning": 65, "critical": 80},
            "response_time": {"warning": 200, "critical": 300},
            "error_rate": {"warning": 1.0, "critical": 2.0}
        },
        "notifications_enabled": True,
        "email_enabled": True,
        "sms_enabled": True,
        "slack_enabled": True
    }
}

@router.get("/presets", response_model=Dict[str, Any])
async def get_sla_presets():
    """SLA 수준별 모니터링 프리셋 조회"""
    try:
        return {
            "success": True,
            "presets": SLA_PRESETS,
            "message": "SLA 프리셋 조회 성공"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SLA 프리셋 조회 실패: {str(e)}")

@router.post("/presets/{preset_name}/apply", response_model=Dict[str, Any])
async def apply_sla_preset(
    preset_name: str,
    db: Session = Depends(get_db)
):
    """SLA 프리셋을 기본 설정으로 적용"""
    try:
        if preset_name not in SLA_PRESETS:
            raise HTTPException(status_code=404, detail=f"프리셋 '{preset_name}'을 찾을 수 없습니다.")
        
        preset = SLA_PRESETS[preset_name]
        
        # 기존 기본 설정 비활성화
        db.query(ThresholdSettings).filter(ThresholdSettings.is_default == True).update(
            {"is_default": False, "updated_by": "system"}
        )
        
        # 새 프리셋 설정 생성
        import uuid
        new_setting = ThresholdSettings(
            setting_id=f"sla-preset-{preset_name}-{uuid.uuid4().hex[:8]}",
            name=preset["name"],
            description=preset["description"],
            category="sla-monitoring",
            thresholds=preset["thresholds"],
            notifications_enabled=preset["notifications_enabled"],
            email_enabled=preset["email_enabled"],
            sms_enabled=preset["sms_enabled"],
            slack_enabled=preset.get("slack_enabled", False),
            is_default=True,
            is_active=True,
            created_by="user"
        )
        
        db.add(new_setting)
        db.commit()
        db.refresh(new_setting)
        
        return {
            "success": True,
            "setting_id": new_setting.setting_id,
            "preset_name": preset_name,
            "sla_level": preset["sla_level"],
            "message": f"{preset['name']} 프리셋이 적용되었습니다.",
            "thresholds": preset["thresholds"]
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"SLA 프리셋 적용 실패: {str(e)}")

@router.get("/", response_model=List[ThresholdSettingsResponse])
async def get_threshold_settings(
    category: Optional[str] = Query(None, description="카테고리 필터"),
    active_only: bool = Query(True, description="활성화된 설정만 조회"),
    db: Session = Depends(get_db)
):
    """임계값 설정 목록 조회"""
    try:
        query = db.query(ThresholdSettings)
        
        if category:
            query = query.filter(ThresholdSettings.category == category)
        if active_only:
            query = query.filter(ThresholdSettings.is_active == True)
        
        settings = query.order_by(desc(ThresholdSettings.is_default), desc(ThresholdSettings.updated_at)).all()
        return settings
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"임계값 설정 조회 실패: {str(e)}")

@router.get("/default", response_model=ThresholdSettingsResponse)
async def get_default_threshold_settings(db: Session = Depends(get_db)):
    """기본 임계값 설정 조회"""
    try:
        # 기본 설정 조회
        default_setting = db.query(ThresholdSettings).filter(
            ThresholdSettings.is_default == True,
            ThresholdSettings.is_active == True
        ).first()
        
        if not default_setting:
            # 기본 설정이 없으면 생성
            default_thresholds = {
                "cpu": {"warning": 80, "critical": 90},
                "memory": {"warning": 85, "critical": 95},
                "gpu": {"warning": 80, "critical": 90},
                "response_time": {"warning": 500, "critical": 1000},
                "error_rate": {"warning": 5.0, "critical": 10.0}
            }
            
            default_setting = ThresholdSettings(
                setting_id="default-monitoring-thresholds",
                name="기본 모니터링 임계값",
                description="시스템 기본 모니터링 임계값 설정",
                category="monitoring",
                thresholds=default_thresholds,
                notifications_enabled=True,
                email_enabled=False,
                sms_enabled=False,
                slack_enabled=False,
                is_default=True,
                is_active=True,
                created_by="system"
            )
            
            db.add(default_setting)
            db.commit()
            db.refresh(default_setting)
        
        return default_setting
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"기본 임계값 설정 조회 실패: {str(e)}")

@router.post("/", response_model=Dict[str, Any])
async def create_threshold_settings(
    settings_data: ThresholdSettingsCreate,
    db: Session = Depends(get_db)
):
    """새 임계값 설정 생성"""
    try:
        import uuid
        
        # 기본 설정으로 지정할 경우 기존 기본 설정 해제
        if settings_data.is_default:
            db.query(ThresholdSettings).filter(ThresholdSettings.is_default == True).update(
                {"is_default": False, "updated_by": "system"}
            )
        
        # 새 설정 생성
        new_setting = ThresholdSettings(
            setting_id=f"threshold_{uuid.uuid4().hex[:8]}",
            name=settings_data.name,
            description=settings_data.description,
            category=settings_data.category,
            thresholds=settings_data.thresholds.dict(),
            notifications_enabled=settings_data.notifications_enabled,
            email_enabled=settings_data.email_enabled,
            sms_enabled=settings_data.sms_enabled,
            slack_enabled=settings_data.slack_enabled,
            is_default=settings_data.is_default,
            is_active=True,
            created_by="user"  # 실제로는 인증된 사용자 ID 사용
        )
        
        db.add(new_setting)
        db.commit()
        db.refresh(new_setting)
        
        return {
            "success": True,
            "setting_id": new_setting.setting_id,
            "message": "임계값 설정이 저장되었습니다.",
            "is_default": new_setting.is_default
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"임계값 설정 생성 실패: {str(e)}")

@router.put("/{setting_id}", response_model=Dict[str, Any])
async def update_threshold_settings(
    setting_id: str,
    settings_data: ThresholdSettingsCreate,
    db: Session = Depends(get_db)
):
    """임계값 설정 업데이트"""
    try:
        # 기존 설정 조회
        existing_setting = db.query(ThresholdSettings).filter(
            ThresholdSettings.setting_id == setting_id,
            ThresholdSettings.is_active == True
        ).first()
        
        if not existing_setting:
            raise HTTPException(status_code=404, detail="임계값 설정을 찾을 수 없습니다.")
        
        # 기본 설정으로 변경할 경우 다른 기본 설정 해제
        if settings_data.is_default and not existing_setting.is_default:
            db.query(ThresholdSettings).filter(
                ThresholdSettings.is_default == True,
                ThresholdSettings.id != existing_setting.id
            ).update({"is_default": False, "updated_by": "system"})
        
        # 설정 업데이트
        existing_setting.name = settings_data.name
        existing_setting.description = settings_data.description
        existing_setting.category = settings_data.category
        existing_setting.thresholds = settings_data.thresholds.dict()
        existing_setting.notifications_enabled = settings_data.notifications_enabled
        existing_setting.email_enabled = settings_data.email_enabled
        existing_setting.sms_enabled = settings_data.sms_enabled
        existing_setting.slack_enabled = settings_data.slack_enabled
        existing_setting.is_default = settings_data.is_default
        existing_setting.updated_by = "user"  # 실제로는 인증된 사용자 ID 사용
        
        db.commit()
        db.refresh(existing_setting)
        
        return {
            "success": True,
            "setting_id": existing_setting.setting_id,
            "message": "임계값 설정이 업데이트되었습니다.",
            "is_default": existing_setting.is_default
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"임계값 설정 업데이트 실패: {str(e)}")

@router.delete("/{setting_id}", response_model=Dict[str, Any])
async def delete_threshold_settings(
    setting_id: str,
    db: Session = Depends(get_db)
):
    """임계값 설정 삭제 (논리 삭제)"""
    try:
        # 기존 설정 조회
        existing_setting = db.query(ThresholdSettings).filter(
            ThresholdSettings.setting_id == setting_id,
            ThresholdSettings.is_active == True
        ).first()
        
        if not existing_setting:
            raise HTTPException(status_code=404, detail="임계값 설정을 찾을 수 없습니다.")
        
        if existing_setting.is_default:
            raise HTTPException(status_code=400, detail="기본 설정은 삭제할 수 없습니다.")
        
        # 논리 삭제
        existing_setting.is_active = False
        existing_setting.updated_by = "user"
        
        db.commit()
        
        return {
            "success": True,
            "setting_id": setting_id,
            "message": "임계값 설정이 삭제되었습니다."
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"임계값 설정 삭제 실패: {str(e)}")
