# [advice from AI] 알림/알람 관리 API
"""
Alerts Management API
- 실시간 알림 데이터 누적 저장
- 10분 이전 데이터 DB 저장 및 페이지네이션
- 무한 스크롤 지원
"""

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_, or_
import uuid
import asyncio
import logging
import httpx
import json

from app.models.database import Alert, SessionLocal
from app.core.database_manager import get_db_session

router = APIRouter()
logger = logging.getLogger(__name__)

# Pydantic 모델들
class AlertCreate(BaseModel):
    """알림 생성 모델"""
    title: str = Field(..., description="알림 제목")
    message: str = Field(..., description="알림 메시지")
    severity: str = Field(..., description="심각도: critical, warning, info")
    category: str = Field(..., description="카테고리: system, tenant, resource, sla")
    tenant_id: Optional[str] = Field(None, description="관련 테넌트 ID")
    service_name: Optional[str] = Field(None, description="관련 서비스명")
    resource_type: Optional[str] = Field(None, description="리소스 타입")
    metric_value: Optional[float] = Field(None, description="메트릭 값")
    threshold_value: Optional[float] = Field(None, description="임계값")
    source: Optional[str] = Field("system", description="알림 소스")
    tags: Optional[Dict[str, Any]] = Field(None, description="추가 태그")
    alert_metadata: Optional[Dict[str, Any]] = Field(None, description="추가 메타데이터")

class AlertResponse(BaseModel):
    """알림 응답 모델"""
    id: int
    alert_id: str
    title: str
    message: str
    severity: str
    category: str
    tenant_id: Optional[str]
    service_name: Optional[str]
    resource_type: Optional[str]
    metric_value: Optional[float]
    threshold_value: Optional[float]
    status: str
    resolved: bool
    resolved_at: Optional[datetime]
    resolved_by: Optional[str]
    source: Optional[str]
    tags: Optional[Dict[str, Any]]
    alert_metadata: Optional[Dict[str, Any]]
    timestamp: datetime
    created_at: datetime
    updated_at: Optional[datetime]

class AlertListResponse(BaseModel):
    """알림 목록 응답 모델"""
    alerts: List[AlertResponse]
    total_count: int
    page: int
    page_size: int
    has_more: bool
    next_cursor: Optional[str]

class AlertUpdateStatus(BaseModel):
    """알림 상태 업데이트 모델"""
    status: str = Field(..., description="상태: active, resolved, acknowledged")
    resolved_by: Optional[str] = Field(None, description="해결자")

# 메모리 내 최근 알림 저장소 (10분간)
recent_alerts: List[Dict[str, Any]] = []
RECENT_ALERTS_TTL = 10 * 60  # 10분

# [advice from AI] K8s 시뮬레이터 동기화 함수
async def sync_alerts_from_k8s_simulator():
    """K8s 시뮬레이터에서 알림을 가져와 ECP 시스템에 동기화"""
    try:
        async with httpx.AsyncClient() as client:
            # K8s 시뮬레이터에서 알림 데이터 가져오기
            response = await client.get("http://k8s-simulator-backend:8000/sla/alerts/history", timeout=10.0)
            
            if response.status_code == 200:
                simulator_data = response.json()
                simulator_alerts = simulator_data.get('alerts', [])
                
                logger.info(f"K8s 시뮬레이터에서 {len(simulator_alerts)}개 알림 조회")
                
                if simulator_alerts:
                    # 새로운 알림만 필터링하고 ECP 형식으로 변환
                    for sim_alert in simulator_alerts[-5:]:  # 최근 5개만
                        alert_id = f"k8s-sim-{sim_alert.get('id', 'unknown')}"
                        
                        # 중복 확인
                        existing = next((a for a in recent_alerts if a.get('alert_id') == alert_id), None)
                        if existing:
                            continue
                            
                        # [advice from AI] 테넌시 정보 추가 - 랜덤하게 기존 테넌시 중 하나 선택
                        import random
                        
                        # 기존 테넌시 목록 가져오기 (안전한 방법)
                        selected_tenant = None
                        try:
                            async with httpx.AsyncClient() as tenant_client:
                                tenant_res = await tenant_client.get("http://localhost:8001/api/v1/tenants/", timeout=5.0)
                                if tenant_res.status_code == 200:
                                    tenant_data = tenant_res.json()
                                    existing_tenants = tenant_data.get('tenants', [])
                                    if existing_tenants and len(existing_tenants) > 0:
                                        selected_tenant = random.choice(existing_tenants)
                                    else:
                                        selected_tenant = None
                                else:
                                    selected_tenant = None
                        except Exception as e:
                            logger.warning(f"테넌시 정보 조회 실패: {e}")
                            selected_tenant = None
                        
                        ecp_alert = {
                            "id": sim_alert.get('id', 0),  # [advice from AI] DB ID 필드 추가
                            "alert_id": alert_id,
                            "title": f"[K8s] {sim_alert.get('type', 'System Alert')}",
                            "message": sim_alert.get('message', '알림 메시지'),
                            "severity": sim_alert.get('severity', 'info'),
                            "category": "system",
                            "source": "k8s-simulator",
                            "timestamp": datetime.fromisoformat(sim_alert.get('timestamp', datetime.utcnow().isoformat()).replace('Z', '+00:00')),
                            "created_at": datetime.fromisoformat(sim_alert.get('timestamp', datetime.utcnow().isoformat()).replace('Z', '+00:00')),  # [advice from AI] created_at 필드 추가
                            "updated_at": None,  # [advice from AI] updated_at 필드 추가
                            "status": "resolved" if sim_alert.get('resolved', False) else "active",
                            "resolved": sim_alert.get('resolved', False),
                            "resolved_at": None,
                            "resolved_by": None,
                            "tenant_id": selected_tenant.get('tenant_id') if selected_tenant and isinstance(selected_tenant, dict) else None,  # [advice from AI] 안전한 테넌시 ID 추가
                            "service_name": sim_alert.get('service', 'system'),
                            "resource_type": None,
                            "metric_value": None,
                            "threshold_value": None,
                            "tags": {
                                "source": "k8s-simulator", 
                                "original_id": sim_alert.get('id'),
                                "tenant_name": selected_tenant.get('name', '시스템') if selected_tenant and isinstance(selected_tenant, dict) else '시스템'  # [advice from AI] 안전한 테넌시 이름 추가
                            },
                            "alert_metadata": {"original_alert": sim_alert, "tenant_info": selected_tenant}  # [advice from AI] 테넌시 정보 메타데이터 추가
                        }
                        
                        # 메모리에 추가
                        recent_alerts.append(ecp_alert)
                        logger.info(f"새 알림 추가: {alert_id}")
                
                return len(simulator_alerts)
            else:
                logger.warning(f"K8s 시뮬레이터 응답 오류: {response.status_code}")
                return 0
                
    except Exception as e:
        logger.error(f"K8s 시뮬레이터 동기화 실패: {e}")
        return 0

def get_db():
    """데이터베이스 세션 의존성"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/", response_model=Dict[str, Any])
async def create_alert(
    alert_data: AlertCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    새 알림 생성
    - 메모리에 즉시 저장 (실시간 표시용)
    - 백그라운드에서 DB 저장 처리
    """
    try:
        # 고유 알림 ID 생성
        alert_id = f"alert_{uuid.uuid4().hex[:8]}"
        current_time = datetime.utcnow()
        
        # 메모리에 즉시 저장 (실시간 표시용)
        alert_dict = {
            "id": len(recent_alerts) + 1,
            "alert_id": alert_id,
            "title": alert_data.title,
            "message": alert_data.message,
            "severity": alert_data.severity,
            "category": alert_data.category,
            "tenant_id": alert_data.tenant_id,
            "service_name": alert_data.service_name,
            "resource_type": alert_data.resource_type,
            "metric_value": alert_data.metric_value,
            "threshold_value": alert_data.threshold_value,
            "status": "active",
            "resolved": False,
            "resolved_at": None,
            "resolved_by": None,
            "source": alert_data.source,
            "tags": alert_data.tags,
            "alert_metadata": alert_data.alert_metadata,
            "timestamp": current_time,
            "created_at": current_time,
            "updated_at": None,
            "is_recent": True  # 최근 데이터 표시
        }
        
        recent_alerts.insert(0, alert_dict)  # 최신 순으로 삽입
        
        # 백그라운드에서 DB 저장
        background_tasks.add_task(save_alert_to_db, alert_data, alert_id, current_time, db)
        
        logger.info(f"알림 생성됨: {alert_id} - {alert_data.title}")
        
        return {
            "success": True,
            "alert_id": alert_id,
            "message": "알림이 생성되었습니다.",
            "timestamp": current_time
        }
        
    except Exception as e:
        logger.error(f"알림 생성 실패: {e}")
        raise HTTPException(status_code=500, detail=f"알림 생성 실패: {str(e)}")

async def save_alert_to_db(alert_data: AlertCreate, alert_id: str, timestamp: datetime, db: Session):
    """백그라운드에서 알림을 DB에 저장"""
    try:
        db_alert = Alert(
            alert_id=alert_id,
            title=alert_data.title,
            message=alert_data.message,
            severity=alert_data.severity,
            category=alert_data.category,
            tenant_id=alert_data.tenant_id,
            service_name=alert_data.service_name,
            resource_type=alert_data.resource_type,
            metric_value=alert_data.metric_value,
            threshold_value=alert_data.threshold_value,
            source=alert_data.source,
            tags=alert_data.tags,
            alert_metadata=alert_data.alert_metadata,
            timestamp=timestamp
        )
        
        db.add(db_alert)
        db.commit()
        db.refresh(db_alert)
        
        logger.info(f"알림 DB 저장 완료: {alert_id}")
        
    except Exception as e:
        db.rollback()
        logger.error(f"알림 DB 저장 실패: {alert_id} - {e}")

@router.get("/", response_model=AlertListResponse)
async def get_alerts(
    page: int = Query(1, ge=1, description="페이지 번호"),
    page_size: int = Query(50, ge=1, le=200, description="페이지 크기"),  # [advice from AI] 기본값 20→50, 최대값 100→200으로 증가
    severity: Optional[str] = Query(None, description="심각도 필터"),
    category: Optional[str] = Query(None, description="카테고리 필터"),
    tenant_id: Optional[str] = Query(None, description="테넌트 ID 필터"),
    status: Optional[str] = Query(None, description="상태 필터"),
    include_recent: bool = Query(True, description="최근 메모리 데이터 포함"),
    cursor: Optional[str] = Query(None, description="페이지네이션 커서"),
    db: Session = Depends(get_db)
):
    """
    알림 목록 조회 (페이지네이션 + 무한 스크롤)
    - 첫 페이지: 메모리의 최근 데이터 + DB 데이터
    - 이후 페이지: DB 데이터만
    """
    try:
        # [advice from AI] K8s 시뮬레이터에서 최신 알림 동기화 (첫 페이지일 때만)
        if page == 1 and include_recent:
            await sync_alerts_from_k8s_simulator()
        
        alerts = []
        total_count = 0
        
        # 첫 페이지이고 최근 데이터 포함 요청 시
        if page == 1 and include_recent:
            # 메모리의 최근 알림 필터링
            filtered_recent = recent_alerts
            
            if severity:
                filtered_recent = [a for a in filtered_recent if a.get('severity') == severity]
            if category:
                filtered_recent = [a for a in filtered_recent if a.get('category') == category]
            if tenant_id:
                filtered_recent = [a for a in filtered_recent if a.get('tenant_id') == tenant_id]
            if status:
                filtered_recent = [a for a in filtered_recent if a.get('status') == status]
            
            alerts.extend(filtered_recent)  # [advice from AI] 페이지 크기 제한 제거하여 모든 메모리 알림 표시
            
        # [advice from AI] 첫 페이지에서는 모든 DB 알림을 가져와서 합치기
        if page == 1:
            # 첫 페이지: 모든 DB 알림 가져오기 (메모리에 없는 것들)
            query = db.query(Alert).order_by(desc(Alert.timestamp))
            
            # 필터 적용
            if severity:
                query = query.filter(Alert.severity == severity)
            if category:
                query = query.filter(Alert.category == category)
            if tenant_id:
                query = query.filter(Alert.tenant_id == tenant_id)
            if status:
                query = query.filter(Alert.status == status)
            
            # 메모리에 있는 알림 ID들 수집
            memory_alert_ids = {a.get('alert_id') for a in alerts}
            
            # 메모리에 없는 모든 DB 알림들 가져오기
            db_alerts = query.filter(~Alert.alert_id.in_(memory_alert_ids)).all()
            
            # DB 알림을 딕셔너리로 변환
            for db_alert in db_alerts:
                alerts.append({
                    "id": db_alert.id,
                    "alert_id": db_alert.alert_id,
                    "title": db_alert.title,
                    "message": db_alert.message,
                    "severity": db_alert.severity,
                    "category": db_alert.category,
                    "tenant_id": db_alert.tenant_id,
                    "service_name": db_alert.service_name,
                    "resource_type": db_alert.resource_type,
                    "metric_value": db_alert.metric_value,
                    "threshold_value": db_alert.threshold_value,
                    "status": db_alert.status,
                    "resolved": db_alert.resolved,
                    "resolved_at": db_alert.resolved_at,
                    "resolved_by": db_alert.resolved_by,
                    "source": db_alert.source,
                    "tags": db_alert.tags,
                    "alert_metadata": db_alert.alert_metadata,
                    "timestamp": db_alert.timestamp,
                    "created_at": db_alert.created_at,
                    "updated_at": db_alert.updated_at,
                    "is_recent": False
                })
            
            # [advice from AI] 시간순으로 정렬 (최신 순) - datetime 객체 처리 개선
            def safe_timestamp(alert):
                ts = alert.get('timestamp')
                if ts is None:
                    return datetime.min.replace(tzinfo=None)
                if isinstance(ts, str):
                    try:
                        # ISO 형식 문자열을 datetime으로 변환
                        dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
                        # 시간대 정보 제거하여 naive datetime으로 변환
                        return dt.replace(tzinfo=None)
                    except:
                        return datetime.min.replace(tzinfo=None)
                elif hasattr(ts, 'replace'):
                    # datetime 객체인 경우 시간대 정보 제거
                    return ts.replace(tzinfo=None)
                return datetime.min.replace(tzinfo=None)
            
            alerts.sort(key=safe_timestamp, reverse=True)
            
        else:
            # 2페이지 이후: DB에서만 페이지네이션으로 가져오기
            query = db.query(Alert).order_by(desc(Alert.timestamp))
            
            # 필터 적용
            if severity:
                query = query.filter(Alert.severity == severity)
            if category:
                query = query.filter(Alert.category == category)
            if tenant_id:
                query = query.filter(Alert.tenant_id == tenant_id)
            if status:
                query = query.filter(Alert.status == status)
            
            offset = (page - 1) * page_size
            db_alerts = query.offset(offset).limit(page_size).all()
            
            # DB 알림을 딕셔너리로 변환
            for db_alert in db_alerts:
                alerts.append({
                    "id": db_alert.id,
                    "alert_id": db_alert.alert_id,
                    "title": db_alert.title,
                    "message": db_alert.message,
                    "severity": db_alert.severity,
                    "category": db_alert.category,
                    "tenant_id": db_alert.tenant_id,
                    "service_name": db_alert.service_name,
                    "resource_type": db_alert.resource_type,
                    "metric_value": db_alert.metric_value,
                    "threshold_value": db_alert.threshold_value,
                    "status": db_alert.status,
                    "resolved": db_alert.resolved,
                    "resolved_at": db_alert.resolved_at,
                    "resolved_by": db_alert.resolved_by,
                    "source": db_alert.source,
                    "tags": db_alert.tags,
                    "alert_metadata": db_alert.alert_metadata,
                    "timestamp": db_alert.timestamp,
                    "created_at": db_alert.created_at,
                    "updated_at": db_alert.updated_at,
                    "is_recent": False
                })
        
        # 전체 개수 계산
        count_query = db.query(Alert)
        if severity:
            count_query = count_query.filter(Alert.severity == severity)
        if category:
            count_query = count_query.filter(Alert.category == category)
        if tenant_id:
            count_query = count_query.filter(Alert.tenant_id == tenant_id)
        if status:
            count_query = count_query.filter(Alert.status == status)
        
        total_count = count_query.count() + (len(recent_alerts) if page == 1 and include_recent else 0)
        
        # 다음 페이지 존재 여부
        has_more = len(alerts) == page_size and total_count > page * page_size
        next_cursor = f"{page + 1}" if has_more else None
        
        return AlertListResponse(
            alerts=alerts,
            total_count=total_count,
            page=page,
            page_size=page_size,
            has_more=has_more,
            next_cursor=next_cursor
        )
        
    except Exception as e:
        logger.error(f"알림 목록 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"알림 목록 조회 실패: {str(e)}")

@router.put("/{alert_id}/status", response_model=Dict[str, Any])
async def update_alert_status(
    alert_id: str,
    status_update: AlertUpdateStatus,
    db: Session = Depends(get_db)
):
    """알림 상태 업데이트"""
    try:
        # 메모리에서 먼저 업데이트
        for alert in recent_alerts:
            if alert.get('alert_id') == alert_id:
                alert['status'] = status_update.status
                alert['resolved'] = status_update.status == 'resolved'
                if status_update.status == 'resolved':
                    alert['resolved_at'] = datetime.utcnow()
                    alert['resolved_by'] = status_update.resolved_by
                break
        
        # DB에서 업데이트
        db_alert = db.query(Alert).filter(Alert.alert_id == alert_id).first()
        if not db_alert:
            raise HTTPException(status_code=404, detail="알림을 찾을 수 없습니다.")
        
        db_alert.status = status_update.status
        db_alert.resolved = status_update.status == 'resolved'
        if status_update.status == 'resolved':
            db_alert.resolved_at = datetime.utcnow()
            db_alert.resolved_by = status_update.resolved_by
        
        db.commit()
        
        return {
            "success": True,
            "message": "알림 상태가 업데이트되었습니다.",
            "alert_id": alert_id,
            "status": status_update.status
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"알림 상태 업데이트 실패: {alert_id} - {e}")
        raise HTTPException(status_code=500, detail=f"알림 상태 업데이트 실패: {str(e)}")

@router.delete("/{alert_id}", response_model=Dict[str, Any])
async def delete_alert(alert_id: str, db: Session = Depends(get_db)):
    """알림 삭제"""
    try:
        # 메모리에서 제거
        global recent_alerts
        recent_alerts = [a for a in recent_alerts if a.get('alert_id') != alert_id]
        
        # DB에서 삭제
        db_alert = db.query(Alert).filter(Alert.alert_id == alert_id).first()
        if not db_alert:
            raise HTTPException(status_code=404, detail="알림을 찾을 수 없습니다.")
        
        db.delete(db_alert)
        db.commit()
        
        return {
            "success": True,
            "message": "알림이 삭제되었습니다.",
            "alert_id": alert_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"알림 삭제 실패: {alert_id} - {e}")
        raise HTTPException(status_code=500, detail=f"알림 삭제 실패: {str(e)}")

# [advice from AI] 백그라운드 태스크: 10분 이전 메모리 데이터를 정리
async def cleanup_old_alerts():
    """10분 이전 메모리 알림 데이터 정리"""
    global recent_alerts
    try:
        current_time = datetime.utcnow()
        cutoff_time = current_time - timedelta(seconds=RECENT_ALERTS_TTL)
        
        # 10분 이전 데이터 제거
        before_count = len(recent_alerts)
        recent_alerts = [
            alert for alert in recent_alerts 
            if alert.get('timestamp', current_time) > cutoff_time
        ]
        after_count = len(recent_alerts)
        
        if before_count != after_count:
            logger.info(f"메모리 알림 정리: {before_count - after_count}개 제거, {after_count}개 유지")
            
    except Exception as e:
        logger.error(f"메모리 알림 정리 실패: {e}")

# 주기적으로 메모리 정리 (5분마다)
async def start_cleanup_task():
    """메모리 정리 태스크 시작"""
    while True:
        await asyncio.sleep(300)  # 5분마다 실행
        await cleanup_old_alerts()
