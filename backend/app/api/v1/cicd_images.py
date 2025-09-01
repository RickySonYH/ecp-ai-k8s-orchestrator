"""
[advice from AI] CICD 이미지 등록 API - 하드코딩 제거, 실제 이미지 등록 기반
ECP-AI Kubernetes Orchestrator CICD 이미지 관리 엔드포인트
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import logging
import json

from app.core.database_manager import get_db_session
from app.models.database import Tenant, Service
from app.models.database import CICDImage
from app.models.service_config import CICDImageCreate, CICDImageUpdate

logger = logging.getLogger(__name__)
router = APIRouter()

# [advice from AI] CICD 이미지 등록
@router.post("/register")
async def register_cicd_image(
    image_data: CICDImageCreate,
    db: Session = Depends(get_db_session)
):
    """
    CICD 이미지 등록
    - 하드코딩 제거, 실제 이미지 등록 기반으로 서비스 관리
    """
    try:
        # [advice from AI] 이미지 정보 검증
        if not image_data.service_name or not image_data.image_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="서비스명과 이미지명은 필수입니다."
            )

        # [advice from AI] 중복 등록 확인
        existing_image = db.query(CICDImage).filter(
            CICDImage.service_name == image_data.service_name
        ).first()
        
        if existing_image:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"서비스 '{image_data.service_name}'는 이미 등록되어 있습니다."
            )

        # [advice from AI] 새 이미지 등록
        new_image = CICDImage(
            service_name=image_data.service_name,
            display_name=image_data.display_name,
            image_name=image_data.image_name,
            image_tag=image_data.image_tag,
            registry_url=image_data.registry_url,
            repository=image_data.repository,
            category=image_data.category,
            description=image_data.description,
            is_active=True,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )

        db.add(new_image)
        db.commit()
        db.refresh(new_image)

        logger.info(f"CICD 이미지 등록 완료: {image_data.service_name}")
        
        return {
            "success": True,
            "message": f"서비스 '{image_data.service_name}' 이미지 등록 완료",
            "image": {
                "id": new_image.id,
                "service_name": new_image.service_name,
                "display_name": new_image.display_name,
                "image_name": new_image.image_name,
                "image_tag": new_image.image_tag,
                "registry_url": new_image.registry_url,
                "repository": new_image.repository,
                "category": new_image.category,
                "is_active": new_image.is_active,
                "created_at": new_image.created_at.isoformat() if new_image.created_at else None
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CICD 이미지 등록 실패: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="이미지 등록 중 오류가 발생했습니다."
        )

# [advice from AI] CICD 이미지 목록 조회
@router.get("/list")
async def get_cicd_images(
    category: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db_session)
):
    """
    CICD 이미지 목록 조회
    - 카테고리별 필터링 지원
    """
    try:
        query = db.query(CICDImage)
        
        # [advice from AI] 필터링 적용
        if category:
            query = query.filter(CICDImage.category == category)
        if is_active is not None:
            query = query.filter(CICDImage.is_active == is_active)
        
        images = query.order_by(CICDImage.created_at.desc()).all()
        
        # [advice from AI] 응답 데이터 구성
        image_list = []
        for image in images:
            image_list.append({
                "id": image.id,
                "service_name": image.service_name,
                "display_name": image.display_name,
                "image_name": image.image_name,
                "image_tag": image.image_tag,
                "registry_url": image.registry_url,
                "repository": image.repository,
                "category": image.category,
                "description": image.description,
                "is_active": image.is_active,
                "created_at": image.created_at.isoformat() if image.created_at else None,
                "updated_at": image.updated_at.isoformat() if image.updated_at else None if image.updated_at else None
            })

        # [advice from AI] 카테고리별 통계
        category_stats = db.query(
            CICDImage.category,
            func.count(CICDImage.id).label('count')
        ).group_by(CICDImage.category).all()

        stats = {stat.category: stat.count for stat in category_stats}

        return {
            "success": True,
            "total_count": len(image_list),
            "category_stats": stats,
            "images": image_list
        }

    except Exception as e:
        logger.error(f"CICD 이미지 목록 조회 실패: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="이미지 목록 조회 중 오류가 발생했습니다."
        )

# [advice from AI] CICD 이미지 상세 조회
@router.get("/{service_name}")
async def get_cicd_image(
    service_name: str,
    db: Session = Depends(get_db_session)
):
    """
    특정 서비스의 CICD 이미지 상세 정보 조회
    """
    try:
        image = db.query(CICDImage).filter(
            CICDImage.service_name == service_name
        ).first()
        
        if not image:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"서비스 '{service_name}'의 이미지 정보를 찾을 수 없습니다."
            )

        return {
            "success": True,
            "image": {
                "id": image.id,
                "service_name": image.service_name,
                "display_name": image.display_name,
                "image_name": image.image_name,
                "image_tag": image.image_tag,
                "registry_url": image.registry_url,
                "repository": image.repository,
                "category": image.category,
                "description": image.description,
                "is_active": image.is_active,
                "created_at": image.created_at.isoformat() if image.created_at else None,
                "updated_at": image.updated_at.isoformat() if image.updated_at else None if image.updated_at else None
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CICD 이미지 상세 조회 실패: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="이미지 상세 조회 중 오류가 발생했습니다."
        )

# [advice from AI] CICD 이미지 업데이트
@router.put("/{service_name}")
async def update_cicd_image(
    service_name: str,
    image_update: CICDImageUpdate,
    db: Session = Depends(get_db_session)
):
    """
    CICD 이미지 정보 업데이트
    """
    try:
        image = db.query(CICDImage).filter(
            CICDImage.service_name == service_name
        ).first()
        
        if not image:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"서비스 '{service_name}'의 이미지 정보를 찾을 수 없습니다."
            )

        # [advice from AI] 업데이트할 필드만 수정
        update_data = image_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(image, field, value)
        
        image.updated_at = datetime.now()
        db.commit()
        db.refresh(image)

        logger.info(f"CICD 이미지 업데이트 완료: {service_name}")
        
        return {
            "success": True,
            "message": f"서비스 '{service_name}' 이미지 업데이트 완료",
            "image": {
                "id": image.id,
                "service_name": image.service_name,
                "display_name": image.display_name,
                "image_name": image.image_name,
                "image_tag": image.image_tag,
                "registry_url": image.registry_url,
                "repository": image.repository,
                "category": image.category,
                "description": image.description,
                "is_active": image.is_active,
                "updated_at": image.updated_at.isoformat() if image.updated_at else None
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CICD 이미지 업데이트 실패: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="이미지 업데이트 중 오류가 발생했습니다."
        )

# [advice from AI] CICD 이미지 삭제
@router.delete("/{service_name}")
async def delete_cicd_image(
    service_name: str,
    db: Session = Depends(get_db_session)
):
    """
    CICD 이미지 삭제
    """
    try:
        image = db.query(CICDImage).filter(
            CICDImage.service_name == service_name
        ).first()
        
        if not image:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"서비스 '{service_name}'의 이미지 정보를 찾을 수 없습니다."
            )

        # [advice from AI] 실제 삭제 대신 비활성화
        image.is_active = False
        image.updated_at = datetime.now()
        db.commit()

        logger.info(f"CICD 이미지 비활성화 완료: {service_name}")
        
        return {
            "success": True,
            "message": f"서비스 '{service_name}' 이미지가 비활성화되었습니다."
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CICD 이미지 삭제 실패: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="이미지 삭제 중 오류가 발생했습니다."
        )

# [advice from AI] CICD 통계 조회
@router.get("/stats/overview")
async def get_cicd_stats(
    db: Session = Depends(get_db_session)
):
    """
    CICD 이미지 통계 조회
    """
    try:
        # [advice from AI] 전체 통계
        total_images = db.query(func.count(CICDImage.id)).scalar()
        active_images = db.query(func.count(CICDImage.id)).filter(
            CICDImage.is_active == True
        ).scalar()
        
        # [advice from AI] 카테고리별 통계
        category_stats = db.query(
            CICDImage.category,
            func.count(CICDImage.id).label('count')
        ).group_by(CICDImage.category).all()

        # [advice from AI] 최근 등록된 이미지
        recent_images = db.query(CICDImage).order_by(
            CICDImage.created_at.desc()
        ).limit(5).all()

        return {
            "success": True,
            "stats": {
                "total_images": total_images,
                "active_images": active_images,
                "inactive_images": total_images - active_images,
                "category_stats": {stat.category: stat.count for stat in category_stats},
                "recent_images": [
                    {
                        "service_name": img.service_name,
                        "display_name": img.display_name,
                        "category": img.category,
                        "created_at": img.created_at.isoformat() if img.created_at else None
                    }
                    for img in recent_images
                ]
            }
        }

    except Exception as e:
        logger.error(f"CICD 통계 조회 실패: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="통계 조회 중 오류가 발생했습니다."
        )
