# [advice from AI] 고급 모니터링 API - 시뮬레이터와 테넌시 데이터 연동
"""
고급 모니터링 대시보드용 API
- 시뮬레이터 모니터링 데이터와 테넌시 데이터 결합
- 실시간 메트릭, 테넌시 비교, SLA 메트릭, 알림 제공
"""

import asyncio
import random
import httpx
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
import structlog
import json

# 데이터베이스 및 모델 임포트
from app.models.database import get_db, Tenant, Service
from app.core.database_manager import db_manager

logger = structlog.get_logger(__name__)

# FastAPI 라우터 생성
router = APIRouter(prefix="/simulator/monitoring/advanced", tags=["advanced-monitoring"])

# 시뮬레이터 URL
SIMULATOR_URL = "http://localhost:6360"

@router.get("/realtime")
async def get_realtime_monitoring_data():
    """
    실시간 모니터링 데이터 - 테넌시별 리소스 사용률
    """
    try:
        logger.info("실시간 모니터링 데이터 조회 시작")
        
        # 데이터베이스에서 활성 테넌시 조회
        db = db_manager.get_session()
        try:
            active_tenants = db.query(Tenant).filter(Tenant.status.in_(["running", "deploying"])).all()
        finally:
            db.close()
        
        # 시뮬레이터 데이터 조회
        simulator_data = await get_simulator_health_data()
        
        # 테넌시별 실시간 메트릭 생성
        realtime_metrics = []
        current_time = datetime.now()
        
        for i, tenant in enumerate(active_tenants):
            # 시간대별 패턴 적용 (업무시간 vs 야간)
            hour = current_time.hour
            traffic_multiplier = get_traffic_multiplier(hour)
            
            # 테넌시별 기본 메트릭 생성
            base_metrics = generate_tenant_base_metrics(tenant, traffic_multiplier)
            
            # 시계열 데이터 생성 (최근 1시간)
            for j in range(12):  # 5분 간격으로 12개 포인트
                timestamp = current_time - timedelta(minutes=j * 5)
                
                realtime_metrics.append({
                    "timestamp": timestamp.isoformat(),
                    "tenant_id": tenant.tenant_id,
                    "tenant_name": tenant.name,
                    "cpu_usage": base_metrics["cpu"] + random.uniform(-5, 5),
                    "memory_usage": base_metrics["memory"] + random.uniform(-3, 3),
                    "gpu_usage": base_metrics["gpu"] + random.uniform(-10, 10),
                    "network_io": base_metrics["network"] + random.uniform(-20, 20),
                    "disk_usage": base_metrics["disk"] + random.uniform(-2, 2),
                    "response_time": base_metrics["response_time"] + random.uniform(-10, 10),
                    "requests_per_second": base_metrics["rps"] + random.uniform(-5, 5),
                    "error_rate": max(0, base_metrics["error_rate"] + random.uniform(-0.1, 0.1))
                })
        
        logger.info(f"실시간 모니터링 데이터 생성 완료: {len(realtime_metrics)}개 데이터 포인트")
        
        return {
            "success": True,
            "metrics": realtime_metrics,
            "timestamp": current_time.isoformat(),
            "total_tenants": len(active_tenants),
            "data_points": len(realtime_metrics)
        }
        
    except Exception as e:
        logger.error(f"실시간 모니터링 데이터 조회 실패: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"실시간 모니터링 데이터 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/tenants")
async def get_tenant_comparison_data():
    """
    테넌시별 성능 비교 데이터
    """
    try:
        logger.info("테넌시 비교 데이터 조회 시작")
        
        # 데이터베이스에서 테넌시 조회
        db = db_manager.get_session()
        try:
            tenants = db.query(Tenant).all()
            
            comparison_data = []
            for tenant in tenants:
                # 서비스 개수 계산
                services_count = db.query(Service).filter(Service.tenant_id == tenant.tenant_id).count()
                
                # 테넌시별 성능 메트릭 생성
                performance_metrics = generate_tenant_performance_metrics(tenant, services_count)
                
                comparison_data.append({
                    "tenant_id": tenant.tenant_id,
                    "name": tenant.name,
                    "preset": tenant.preset,
                    "status": tenant.status,
                    "services_count": services_count,
                    "created_at": tenant.created_at.isoformat(),
                    
                    # 성능 메트릭
                    "cpu_usage": performance_metrics["cpu_usage"],
                    "memory_usage": performance_metrics["memory_usage"],
                    "gpu_usage": performance_metrics["gpu_usage"],
                    "network_usage": performance_metrics["network_usage"],
                    "disk_usage": performance_metrics["disk_usage"],
                    
                    # SLA 메트릭
                    "availability": performance_metrics["availability"],
                    "response_time": performance_metrics["response_time"],
                    "throughput": performance_metrics["throughput"],
                    "error_rate": performance_metrics["error_rate"],
                    "active_connections": performance_metrics["active_connections"],
                    
                    # 상태 표시
                    "health_status": determine_health_status(performance_metrics),
                    "sla_status": "meeting" if performance_metrics["availability"] >= 99.5 else "warning"
                })
        finally:
            db.close()
        
        logger.info(f"테넌시 비교 데이터 생성 완료: {len(comparison_data)}개 테넌시")
        
        return {
            "success": True,
            "tenants": comparison_data,
            "total_count": len(comparison_data),
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"테넌시 비교 데이터 조회 실패: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"테넌시 비교 데이터 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/sla")
async def get_sla_metrics():
    """
    SLA 메트릭 트렌드 데이터
    """
    try:
        logger.info("SLA 메트릭 조회 시작")
        
        current_time = datetime.now()
        sla_data = []
        
        # 최근 24시간 SLA 트렌드 생성
        for i in range(24):
            timestamp = current_time - timedelta(hours=i)
            hour = timestamp.hour
            
            # 시간대별 SLA 패턴 (업무시간에 더 높은 부하)
            if 9 <= hour <= 18:  # 업무시간
                availability = random.uniform(99.3, 99.9)
                response_time = random.uniform(80, 150)
                error_rate = random.uniform(0.1, 0.8)
                throughput = random.randint(800, 1500)
            else:  # 야간
                availability = random.uniform(99.7, 99.99)
                response_time = random.uniform(50, 100)
                error_rate = random.uniform(0.0, 0.3)
                throughput = random.randint(200, 600)
            
            sla_data.append({
                "timestamp": timestamp.isoformat(),
                "hour": timestamp.strftime("%H:00"),
                "availability": availability,
                "response_time": response_time,
                "error_rate": error_rate,
                "throughput": throughput,
                "concurrent_users": random.randint(50, 300)
            })
        
        # SLA 요약 계산
        avg_availability = sum(d["availability"] for d in sla_data) / len(sla_data)
        avg_response_time = sum(d["response_time"] for d in sla_data) / len(sla_data)
        avg_error_rate = sum(d["error_rate"] for d in sla_data) / len(sla_data)
        avg_throughput = sum(d["throughput"] for d in sla_data) / len(sla_data)
        
        sla_summary = {
            "availability": {
                "current": avg_availability,
                "target": 99.5,
                "status": "good" if avg_availability >= 99.5 else "warning"
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
        
        logger.info("SLA 메트릭 생성 완료")
        
        return {
            "success": True,
            "metrics": sla_data[::-1],  # 시간순 정렬
            "summary": sla_summary,
            "timestamp": current_time.isoformat()
        }
        
    except Exception as e:
        logger.error(f"SLA 메트릭 조회 실패: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"SLA 메트릭 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/alerts")
async def get_monitoring_alerts():
    """
    모니터링 알림 목록
    """
    try:
        logger.info("모니터링 알림 조회 시작")
        
        # 데이터베이스에서 테넌시 조회
        db = db_manager.get_session()
        try:
            tenants = db.query(Tenant).all()
        finally:
            db.close()
        
        # 알림 생성
        alerts = []
        alert_types = ["info", "warning", "error", "critical"]
        alert_messages = [
            "CPU 사용률이 임계값을 초과했습니다",
            "GPU 메모리 부족 경고가 발생했습니다", 
            "응답 시간이 SLA 기준을 초과했습니다",
            "네트워크 지연이 감지되었습니다",
            "자동 스케일링이 실행되었습니다",
            "새로운 테넌시가 생성되었습니다",
            "배포가 완료되었습니다",
            "서비스 재시작이 완료되었습니다"
        ]
        
        # 테넌시별 알림 생성
        for i, tenant in enumerate(tenants):
            # 테넌시별로 1-3개의 알림 생성
            num_alerts = random.randint(1, 3)
            
            for j in range(num_alerts):
                alert_time = datetime.now() - timedelta(minutes=random.randint(1, 1440))
                severity = random.choice(["low", "medium", "high"])
                
                # 심각도에 따른 타입 결정
                if severity == "high":
                    alert_type = random.choice(["error", "critical"])
                elif severity == "medium":
                    alert_type = "warning"
                else:
                    alert_type = "info"
                
                alerts.append({
                    "id": len(alerts) + 1,
                    "type": alert_type,
                    "severity": severity,
                    "message": random.choice(alert_messages),
                    "tenant_id": tenant.tenant_id,
                    "tenant_name": tenant.name,
                    "timestamp": alert_time.isoformat(),
                    "resolved": random.random() > 0.6,
                    "acknowledged": random.random() > 0.4
                })
        
        # 시간순 정렬
        alerts.sort(key=lambda x: x["timestamp"], reverse=True)
        
        # 알림 요약
        alert_summary = {
            "total": len(alerts),
            "unresolved": len([a for a in alerts if not a["resolved"]]),
            "critical": len([a for a in alerts if a["severity"] == "high"]),
            "last_24h": len([a for a in alerts if (datetime.now() - datetime.fromisoformat(a["timestamp"])).days == 0])
        }
        
        logger.info(f"모니터링 알림 생성 완료: {len(alerts)}개 알림")
        
        return {
            "success": True,
            "alerts": alerts,
            "summary": alert_summary,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"모니터링 알림 조회 실패: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"모니터링 알림 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.websocket("/ws/realtime")
async def websocket_realtime_monitoring(websocket: WebSocket):
    """
    실시간 모니터링 데이터 WebSocket 스트리밍
    - 5초마다 최신 모니터링 데이터 전송
    - 클라이언트 연결 관리
    """
    await websocket.accept()
    logger.info("WebSocket 실시간 모니터링 연결 수락")
    
    try:
        while True:
            try:
                # 실시간 데이터 수집
                realtime_data = await get_realtime_monitoring_data()
                tenant_data = await get_tenant_comparison_data()
                sla_data = await get_sla_metrics()
                alerts_data = await get_monitoring_alerts()
                
                # 통합 데이터 패키지 생성
                streaming_data = {
                    "timestamp": datetime.now().isoformat(),
                    "type": "monitoring_update",
                    "data": {
                        "realtime": realtime_data,
                        "tenants": tenant_data,
                        "sla": sla_data,
                        "alerts": alerts_data
                    }
                }
                
                # 클라이언트로 데이터 전송
                await websocket.send_text(json.dumps(streaming_data, ensure_ascii=False))
                logger.debug("WebSocket 모니터링 데이터 전송 완료")
                
                # 5초 대기
                await asyncio.sleep(5)
                
            except WebSocketDisconnect:
                logger.info("WebSocket 클라이언트 연결 해제")
                break
            except Exception as e:
                logger.error(f"WebSocket 데이터 전송 오류: {e}")
                # 오류 발생 시 클라이언트에 알림
                error_message = {
                    "timestamp": datetime.now().isoformat(),
                    "type": "error",
                    "message": f"데이터 수집 오류: {str(e)}"
                }
                try:
                    await websocket.send_text(json.dumps(error_message, ensure_ascii=False))
                except:
                    break
                await asyncio.sleep(10)  # 오류 시 10초 대기
                
    except WebSocketDisconnect:
        logger.info("WebSocket 연결 종료")
    except Exception as e:
        logger.error(f"WebSocket 연결 오류: {e}")
    finally:
        logger.info("WebSocket 실시간 모니터링 연결 정리")


# ==========================================
# 헬퍼 함수들
# ==========================================

async def get_simulator_health_data() -> Dict[str, Any]:
    """시뮬레이터 헬스 데이터 조회"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{SIMULATOR_URL}/monitoring/health")
            if response.status_code == 200:
                return response.json()
            else:
                logger.warning(f"시뮬레이터 연결 실패: {response.status_code}")
                return {"services": {}, "summary": {"overall_health": "unknown"}}
    except Exception as e:
        logger.warning(f"시뮬레이터 연결 오류: {e}")
        return {"services": {}, "summary": {"overall_health": "unknown"}}


def get_traffic_multiplier(hour: int) -> float:
    """시간대별 트래픽 패턴"""
    # 업무시간 (9-18시)에 높은 트래픽
    if 9 <= hour <= 18:
        return random.uniform(0.8, 1.2)
    # 야간에는 낮은 트래픽
    elif 22 <= hour or hour <= 6:
        return random.uniform(0.3, 0.6)
    # 전환 시간대
    else:
        return random.uniform(0.6, 0.8)


def generate_tenant_base_metrics(tenant: Tenant, traffic_multiplier: float) -> Dict[str, float]:
    """테넌시별 기본 메트릭 생성"""
    # 프리셋별 기본 리소스 사용률
    preset_multipliers = {
        "micro": {"cpu": 30, "memory": 40, "gpu": 20, "network": 50, "disk": 25},
        "small": {"cpu": 50, "memory": 60, "gpu": 40, "network": 80, "disk": 35},
        "medium": {"cpu": 70, "memory": 75, "gpu": 65, "network": 120, "disk": 50},
        "large": {"cpu": 85, "memory": 85, "gpu": 80, "network": 200, "disk": 70}
    }
    
    base = preset_multipliers.get(tenant.preset, preset_multipliers["small"])
    
    # 상태별 조정
    status_multiplier = 1.0
    if tenant.status == "deploying":
        status_multiplier = 0.3  # 배포 중에는 낮은 사용률
    elif tenant.status == "running":
        status_multiplier = 1.0
    else:
        status_multiplier = 0.1  # 중지 상태
    
    return {
        "cpu": base["cpu"] * traffic_multiplier * status_multiplier,
        "memory": base["memory"] * traffic_multiplier * status_multiplier,
        "gpu": base["gpu"] * traffic_multiplier * status_multiplier,
        "network": base["network"] * traffic_multiplier * status_multiplier,
        "disk": base["disk"] * traffic_multiplier * status_multiplier,
        "response_time": 100 / (traffic_multiplier * status_multiplier),
        "rps": base["network"] / 10 * traffic_multiplier * status_multiplier,
        "error_rate": 0.1 / status_multiplier if status_multiplier > 0 else 5.0
    }


def generate_tenant_performance_metrics(tenant: Tenant, services_count: int) -> Dict[str, float]:
    """테넌시별 성능 메트릭 생성"""
    base_metrics = generate_tenant_base_metrics(tenant, 1.0)
    
    # 서비스 개수에 따른 조정
    service_factor = min(services_count / 10, 2.0)  # 최대 2배까지
    
    return {
        "cpu_usage": min(95, base_metrics["cpu"] * service_factor),
        "memory_usage": min(90, base_metrics["memory"] * service_factor),
        "gpu_usage": min(100, base_metrics["gpu"] * service_factor),
        "network_usage": base_metrics["network"] * service_factor,
        "disk_usage": min(85, base_metrics["disk"]),
        
        # SLA 메트릭
        "availability": max(99.0, 99.9 - random.uniform(0, 0.5)),
        "response_time": base_metrics["response_time"] * (1 + service_factor * 0.2),
        "throughput": random.randint(100, 1000) * service_factor,
        "error_rate": base_metrics["error_rate"],
        "active_connections": random.randint(10, 500) * service_factor
    }


def determine_health_status(metrics: Dict[str, float]) -> str:
    """메트릭 기반 헬스 상태 결정"""
    if metrics["availability"] < 99.0 or metrics["error_rate"] > 2.0:
        return "critical"
    elif metrics["availability"] < 99.5 or metrics["error_rate"] > 1.0 or metrics["response_time"] > 200:
        return "warning"
    else:
        return "healthy"
