# [advice from AI] ECP-AI 실시간 모니터링 API
"""
실시간 모니터링 데이터 API
- 시스템 전체 메트릭 실시간 조회
- 테넌시별 리소스 사용률 조회
- 서비스별 성능 메트릭 조회
- WebSocket을 통한 실시간 스트리밍
"""

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from typing import List, Optional, Dict
import json
import asyncio
import logging
from datetime import datetime

from app.models.realtime_monitoring import monitoring_generator
from app.models.demo_database import DemoSessionLocal, DemoTenant
from app.models.database import SessionLocal, Tenant

router = APIRouter(prefix="/realtime", tags=["realtime-monitoring"])

# 로거 설정
logger = logging.getLogger(__name__)

def get_demo_db():
    """데모 데이터베이스 세션 의존성"""
    db = DemoSessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_production_db():
    """운영 데이터베이스 세션 의존성"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/system/")
async def get_system_metrics():
    """시스템 전체 메트릭 조회"""
    try:
        metrics = monitoring_generator.get_latest_system_metrics()
        if metrics:
            return {
                "status": "success",
                "data": monitoring_generator._metrics_to_dict(metrics),
                "timestamp": datetime.now().isoformat()
            }
        else:
            # 초기 메트릭 생성
            initial_metrics = monitoring_generator.generate_system_metrics(0, 0)
            return {
                "status": "success",
                "data": monitoring_generator._metrics_to_dict(initial_metrics),
                "timestamp": datetime.now().isoformat()
            }
    except Exception as e:
        logger.error(f"시스템 메트릭 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="시스템 메트릭 조회 중 오류가 발생했습니다.")

@router.get("/system/history/")
async def get_system_metrics_history(limit: int = 20):
    """시스템 메트릭 히스토리 조회"""
    try:
        history = monitoring_generator.get_metrics_history('system', limit=limit)
        return {
            "status": "success",
            "data": history,
            "count": len(history),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"시스템 메트릭 히스토리 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="시스템 메트릭 히스토리 조회 중 오류가 발생했습니다.")

@router.get("/tenants/{tenant_id}/")
async def get_tenant_metrics(tenant_id: str):
    """특정 테넌시의 메트릭 조회"""
    try:
        metrics = monitoring_generator.get_latest_tenant_metrics(tenant_id)
        if metrics:
            return {
                "status": "success",
                "data": monitoring_generator._metrics_to_dict(metrics),
                "timestamp": datetime.now().isoformat()
            }
        else:
            # 초기 메트릭 생성
            initial_metrics = monitoring_generator.generate_tenant_metrics(tenant_id, 0)
            return {
                "status": "success",
                "data": monitoring_generator._metrics_to_dict(initial_metrics),
                "timestamp": datetime.now().isoformat()
            }
    except Exception as e:
        logger.error(f"테넌시 메트릭 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="테넌시 메트릭 조회 중 오류가 발생했습니다.")

@router.get("/tenants/{tenant_id}/history/")
async def get_tenant_metrics_history(tenant_id: str, limit: int = 20):
    """테넌시 메트릭 히스토리 조회"""
    try:
        history = monitoring_generator.get_metrics_history('tenant', tenant_id, limit=limit)
        return {
            "status": "success",
            "data": history,
            "count": len(history),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"테넌시 메트릭 히스토리 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="테넌시 메트릭 히스토리 조회 중 오류가 발생했습니다.")

@router.get("/services/{tenant_id}/{service_name}/")
async def get_service_metrics(tenant_id: str, service_name: str):
    """특정 서비스의 메트릭 조회"""
    try:
        metrics = monitoring_generator.get_latest_service_metrics(tenant_id, service_name)
        if metrics:
            return {
                "status": "success",
                "data": monitoring_generator._metrics_to_dict(metrics),
                "timestamp": datetime.now().isoformat()
            }
        else:
            # 초기 메트릭 생성
            initial_metrics = monitoring_generator.generate_service_metrics(service_name, tenant_id, 0)
            return {
                "status": "success",
                "data": monitoring_generator._metrics_to_dict(initial_metrics),
                "timestamp": datetime.now().isoformat()
            }
    except Exception as e:
        logger.error(f"서비스 메트릭 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="서비스 메트릭 조회 중 오류가 발생했습니다.")

@router.get("/services/{tenant_id}/{service_name}/history/")
async def get_service_metrics_history(tenant_id: str, service_name: str, limit: int = 20):
    """서비스 메트릭 히스토리 조회"""
    try:
        history = monitoring_generator.get_metrics_history('service', tenant_id, service_name, limit)
        return {
            "status": "success",
            "data": history,
            "count": len(history),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"서비스 메트릭 히스토리 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="서비스 메트릭 히스토리 조회 중 오류가 발생했습니다.")

@router.get("/overview/")
async def get_monitoring_overview():
    """모니터링 전체 개요 조회"""
    try:
        # 시스템 메트릭
        system_metrics = monitoring_generator.get_latest_system_metrics()
        
        # 테넌시 목록 조회 (데모/운영 모드 구분 필요)
        demo_db = DemoSessionLocal()
        production_db = SessionLocal()
        
        try:
            demo_tenants = demo_db.query(DemoTenant).all()
            production_tenants = production_db.query(Tenant).all()
            
            # 테넌시별 요약 메트릭
            tenant_summaries = []
            
            # 데모 테넌시
            for tenant in demo_tenants:
                metrics = monitoring_generator.get_latest_tenant_metrics(tenant.tenant_id)
                if metrics:
                    tenant_summaries.append({
                        "tenant_id": tenant.tenant_id,
                        "name": tenant.name,
                        "is_demo": True,
                        "cpu_usage": metrics.cpu_usage,
                        "memory_usage": metrics.memory_usage,
                        "gpu_usage": metrics.gpu_usage,
                        "status": tenant.status,
                        "health": "healthy" if metrics.cpu_usage < 80 else "warning"
                    })
            
            # 운영 테넌시
            for tenant in production_tenants:
                metrics = monitoring_generator.get_latest_tenant_metrics(tenant.tenant_id)
                if metrics:
                    tenant_summaries.append({
                        "tenant_id": tenant.tenant_id,
                        "name": tenant.name,
                        "is_demo": False,
                        "cpu_usage": metrics.cpu_usage,
                        "memory_usage": metrics.memory_usage,
                        "gpu_usage": metrics.gpu_usage,
                        "status": tenant.status,
                        "health": "healthy" if metrics.cpu_usage < 80 else "warning"
                    })
            
            return {
                "status": "success",
                "data": {
                    "system": monitoring_generator._metrics_to_dict(system_metrics) if system_metrics else {},
                    "tenants": tenant_summaries,
                    "total_tenants": len(tenant_summaries),
                    "demo_tenants": len([t for t in tenant_summaries if t["is_demo"]]),
                    "production_tenants": len([t for t in tenant_summaries if not t["is_demo"]])
                },
                "timestamp": datetime.now().isoformat()
            }
            
        finally:
            demo_db.close()
            production_db.close()
            
    except Exception as e:
        logger.error(f"모니터링 개요 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="모니터링 개요 조회 중 오류가 발생했습니다.")

@router.post("/start/")
async def start_monitoring():
    """모니터링 시작"""
    try:
        # 현재 테넌시 목록 조회
        demo_db = DemoSessionLocal()
        production_db = SessionLocal()
        
        try:
            demo_tenants = demo_db.query(DemoTenant).all()
            production_tenants = production_db.query(Tenant).all()
            
            tenant_ids = [t.tenant_id for t in demo_tenants] + [t.tenant_id for t in production_tenants]
            
            # 모니터링 시작
            if not monitoring_generator.is_running:
                asyncio.create_task(monitoring_generator.start_monitoring(tenant_ids))
                return {
                    "status": "success",
                    "message": "실시간 모니터링이 시작되었습니다.",
                    "tenant_count": len(tenant_ids),
                    "timestamp": datetime.now().isoformat()
                }
            else:
                return {
                    "status": "info",
                    "message": "모니터링이 이미 실행 중입니다.",
                    "timestamp": datetime.now().isoformat()
                }
                
        finally:
            demo_db.close()
            production_db.close()
            
    except Exception as e:
        logger.error(f"모니터링 시작 실패: {e}")
        raise HTTPException(status_code=500, detail="모니터링 시작 중 오류가 발생했습니다.")

@router.post("/stop/")
async def stop_monitoring():
    """모니터링 중지"""
    try:
        monitoring_generator.stop_monitoring()
        return {
            "status": "success",
            "message": "실시간 모니터링이 중지되었습니다.",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"모니터링 중지 실패: {e}")
        raise HTTPException(status_code=500, detail="모니터링 중지 중 오류가 발생했습니다.")

@router.get("/status/")
async def get_monitoring_status():
    """모니터링 상태 조회"""
    try:
        return {
            "status": "success",
            "data": {
                "is_running": monitoring_generator.is_running,
                "update_interval": monitoring_generator.update_interval,
                "system_metrics_count": len(monitoring_generator.system_metrics_history),
                "tenant_metrics_count": len(monitoring_generator.tenant_metrics_history),
                "service_metrics_count": len(monitoring_generator.service_metrics_history),
                "last_update": monitoring_generator.system_metrics_history[-1].timestamp.isoformat() if monitoring_generator.system_metrics_history else None
            },
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"모니터링 상태 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="모니터링 상태 조회 중 오류가 발생했습니다.")

# WebSocket을 통한 실시간 스트리밍
@router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket을 통한 실시간 모니터링 데이터 스트리밍"""
    await websocket.accept()
    logger.info(f"WebSocket 클라이언트 연결: {client_id}")
    
    try:
        while True:
            # 5초마다 최신 데이터 전송
            await asyncio.sleep(5)
            
            # 시스템 메트릭
            system_metrics = monitoring_generator.get_latest_system_metrics()
            
            # 테넌시 요약
            demo_db = DemoSessionLocal()
            production_db = SessionLocal()
            
            try:
                demo_tenants = demo_db.query(DemoTenant).all()
                production_tenants = production_db.query(Tenant).all()
                
                tenant_summaries = []
                
                # 데모 테넌시
                for tenant in demo_tenants:
                    metrics = monitoring_generator.get_latest_tenant_metrics(tenant.tenant_id)
                    if metrics:
                        tenant_summaries.append({
                            "tenant_id": tenant.tenant_id,
                            "name": tenant.name,
                            "is_demo": True,
                            "cpu_usage": metrics.cpu_usage,
                            "memory_usage": metrics.memory_usage,
                            "gpu_usage": metrics.gpu_usage,
                            "status": tenant.status
                        })
                
                # 운영 테넌시
                for tenant in production_tenants:
                    metrics = monitoring_generator.get_latest_tenant_metrics(tenant.tenant_id)
                    if metrics:
                        tenant_summaries.append({
                            "tenant_id": tenant.tenant_id,
                            "name": tenant.name,
                            "is_demo": False,
                            "cpu_usage": metrics.cpu_usage,
                            "memory_usage": metrics.memory_usage,
                            "gpu_usage": metrics.gpu_usage,
                            "status": tenant.status
                        })
                
                # 실시간 데이터 전송
                realtime_data = {
                    "type": "realtime_update",
                    "timestamp": datetime.now().isoformat(),
                    "system": monitoring_generator._metrics_to_dict(system_metrics) if system_metrics else {},
                    "tenants": tenant_summaries
                }
                
                await websocket.send_text(json.dumps(realtime_data))
                
            finally:
                demo_db.close()
                production_db.close()
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket 클라이언트 연결 해제: {client_id}")
    except Exception as e:
        logger.error(f"WebSocket 오류: {e}")
        try:
            await websocket.close()
        except:
            pass
