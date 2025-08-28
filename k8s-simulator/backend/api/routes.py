# [advice from AI] FastAPI 라우터 정의 - K8S 시뮬레이터 및 모니터링 API 엔드포인트
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Query
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from datetime import datetime
import yaml
import json
import logging

logger = logging.getLogger(__name__)

# Pydantic 모델 정의
class ManifestRequest(BaseModel):
    manifest: str
    namespace: Optional[str] = "default"

class ResourceQuery(BaseModel):
    namespace: Optional[str] = None
    kind: Optional[str] = None
    name: Optional[str] = None

class AlertRule(BaseModel):
    name: str
    metric: str
    threshold: float
    operator: str  # gt, lt, eq
    severity: str  # info, warning, critical
    enabled: bool = True

# Router 인스턴스 생성
k8s_router = APIRouter()
monitoring_router = APIRouter()
sla_router = APIRouter()

# K8S Simulator API Routes
@k8s_router.post("/manifest/parse")
async def parse_manifest(request: ManifestRequest):
    """K8S 매니페스트 파일 파싱"""
    try:
        from main import get_simulator
        simulator = get_simulator()
        
        result = await simulator.parse_manifest(request.manifest)
        
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        
        return JSONResponse(content=result)
        
    except Exception as e:
        logger.error(f"Manifest parsing error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@k8s_router.post("/manifest/deploy")
async def deploy_manifest(request: ManifestRequest):
    """K8S 매니페스트 배포"""
    try:
        from main import get_simulator
        simulator = get_simulator()
        
        # 먼저 매니페스트 파싱
        parse_result = await simulator.parse_manifest(request.manifest)
        if parse_result["status"] == "error":
            raise HTTPException(status_code=400, detail=parse_result["message"])
        
        # 리소스 배포
        deploy_result = await simulator.deploy_resources(parse_result["resources"])
        
        # [advice from AI] 배포 성공 시 모니터링 엔진 업데이트
        if deploy_result["status"] == "success" and deploy_result["deployed_count"] > 0:
            from core.monitoring_engine import MonitoringEngine
            engine = MonitoringEngine()
            
            # 현재 배포된 모든 리소스 조회
            all_resources = await simulator.get_resources()
            await engine.update_services_from_resources(all_resources)
            logger.info(f"모니터링 엔진 업데이트 완료: {len(all_resources)}개 리소스")
        
        return JSONResponse(content={
            "status": deploy_result["status"],
            "deployed_count": deploy_result["deployed_count"],
            "failed_count": deploy_result["failed_count"],
            "resources": deploy_result["resources"],
            "message": f"Deployed {deploy_result['deployed_count']} resources successfully"
        })
        
    except Exception as e:
        logger.error(f"Deployment error: {e}")
        raise HTTPException(status_code=500, detail=f"Deployment failed: {str(e)}")

@k8s_router.post("/manifest/upload")
async def upload_manifest_file(file: UploadFile = File(...)):
    """YAML 파일 업로드 및 배포"""
    try:
        # 파일 내용 읽기
        content = await file.read()
        manifest_content = content.decode('utf-8')
        
        # 배포 실행
        request = ManifestRequest(manifest=manifest_content)
        return await deploy_manifest(request)
        
    except Exception as e:
        logger.error(f"File upload error: {e}")
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

@k8s_router.get("/resources")
async def get_resources(
    namespace: Optional[str] = Query(None),
    kind: Optional[str] = Query(None)
):
    """배포된 리소스 목록 조회"""
    try:
        from main import get_simulator
        simulator = get_simulator()
        
        resources = await simulator.get_resources(namespace=namespace, kind=kind)
        
        return JSONResponse(content={
            "status": "success",
            "count": len(resources),
            "resources": resources
        })
        
    except Exception as e:
        logger.error(f"Resource query error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get resources: {str(e)}")

@k8s_router.delete("/resources/{namespace}/{kind}/{name}")
async def delete_resource(namespace: str, kind: str, name: str):
    """리소스 삭제"""
    try:
        from main import get_simulator
        simulator = get_simulator()
        
        result = await simulator.delete_resource(name=name, namespace=namespace, kind=kind)
        
        if result["status"] == "not_found":
            raise HTTPException(status_code=404, detail=result["message"])
        
        # [advice from AI] 삭제 성공 시 모니터링 엔진 업데이트
        if result["status"] == "success":
            from core.monitoring_engine import MonitoringEngine
            engine = MonitoringEngine()
            
            # 현재 배포된 모든 리소스 조회 (삭제된 것 제외)
            all_resources = await simulator.get_resources()
            await engine.update_services_from_resources(all_resources)
            logger.info(f"리소스 삭제 후 모니터링 엔진 업데이트: {len(all_resources)}개 리소스")
        
        return JSONResponse(content=result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Resource deletion error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete resource: {str(e)}")

# Monitoring API Routes
@monitoring_router.get("/metrics")
async def get_current_metrics():
    """현재 모니터링 메트릭 조회"""
    try:
        from core.monitoring_engine import MonitoringEngine
        engine = MonitoringEngine()
        
        metrics = await engine.generate_metrics()
        return JSONResponse(content=metrics)
        
    except Exception as e:
        logger.error(f"Metrics generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get metrics: {str(e)}")

@monitoring_router.get("/metrics/history")
async def get_metrics_history(
    hours: int = Query(1, ge=1, le=24),
    service: Optional[str] = Query(None)
):
    """메트릭 히스토리 조회"""
    try:
        from core.monitoring_engine import MonitoringEngine
        engine = MonitoringEngine()
        
        history = engine.metrics_history.get("history", [])
        
        # 시간 필터링
        from datetime import datetime, timedelta
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        filtered_history = [
            entry for entry in history
            if datetime.fromisoformat(entry["timestamp"]) > cutoff_time
        ]
        
        # 서비스 필터링
        if service:
            for entry in filtered_history:
                services_data = entry["data"].get("services", {})
                if service in services_data:
                    entry["data"]["services"] = {service: services_data[service]}
                else:
                    entry["data"]["services"] = {}
        
        return JSONResponse(content={
            "status": "success",
            "hours": hours,
            "service_filter": service,
            "data_points": len(filtered_history),
            "history": filtered_history
        })
        
    except Exception as e:
        logger.error(f"Metrics history error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get metrics history: {str(e)}")

@monitoring_router.get("/health")
async def get_system_health():
    """시스템 전체 헬스 상태 조회"""
    try:
        from core.monitoring_engine import MonitoringEngine
        engine = MonitoringEngine()
        
        metrics = await engine.generate_metrics()
        summary = metrics.get("summary", {})
        
        return JSONResponse(content={
            "timestamp": metrics.get("timestamp"),
            "services": metrics.get("services", {}),
            "summary": summary
        })
        
    except Exception as e:
        logger.error(f"Health check error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get health status: {str(e)}")

# SLA Management API Routes
@sla_router.get("/status")
async def get_sla_status():
    """현재 SLA 상태 조회"""
    try:
        from core.monitoring_engine import MonitoringEngine
        engine = MonitoringEngine()
        
        sla_status = await engine.check_sla()
        
        return JSONResponse(content={
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "sla": sla_status
        })
        
    except Exception as e:
        logger.error(f"SLA status error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get SLA status: {str(e)}")

@sla_router.get("/report")
async def get_sla_report(
    days: int = Query(1, ge=1, le=30)
):
    """SLA 리포트 생성"""
    try:
        # 간단한 SLA 리포트 생성 (실제로는 데이터베이스에서 조회)
        from datetime import datetime, timedelta
        
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        # 시뮬레이션된 SLA 데이터
        import random
        daily_sla = []
        
        for i in range(days):
            date = start_date + timedelta(days=i)
            availability = random.uniform(99.0, 99.9)  # 99.0% ~ 99.9%
            
            daily_sla.append({
                "date": date.date().isoformat(),
                "availability_percentage": round(availability, 3),
                "incidents": random.randint(0, 3),
                "mttr_minutes": random.randint(2, 15) if random.random() < 0.3 else 0
            })
        
        overall_availability = sum(day["availability_percentage"] for day in daily_sla) / len(daily_sla)
        
        return JSONResponse(content={
            "status": "success",
            "report_period": {
                "start_date": start_date.date().isoformat(),
                "end_date": end_date.date().isoformat(),
                "days": days
            },
            "summary": {
                "overall_availability": round(overall_availability, 3),
                "sla_target": 99.5,
                "sla_met": overall_availability >= 99.5,
                "total_incidents": sum(day["incidents"] for day in daily_sla),
                "average_mttr_minutes": sum(day["mttr_minutes"] for day in daily_sla) / len(daily_sla)
            },
            "daily_data": daily_sla
        })
        
    except Exception as e:
        logger.error(f"SLA report error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate SLA report: {str(e)}")

@sla_router.post("/alerts/rules")
async def create_alert_rule(rule: AlertRule):
    """알림 규칙 생성"""
    try:
        # 실제로는 데이터베이스에 저장
        logger.info(f"Alert rule created: {rule.name}")
        
        return JSONResponse(content={
            "status": "success",
            "message": f"Alert rule '{rule.name}' created successfully",
            "rule": rule.dict()
        })
        
    except Exception as e:
        logger.error(f"Alert rule creation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create alert rule: {str(e)}")

@sla_router.get("/alerts/history")
async def get_alert_history(
    hours: int = Query(24, ge=1, le=168),  # 1시간 ~ 1주일
    severity: Optional[str] = Query(None)
):
    """알림 히스토리 조회"""
    try:
        # 시뮬레이션된 알림 히스토리
        import random
        from datetime import datetime, timedelta
        
        alerts = []
        alert_types = ["cpu_high", "memory_high", "error_rate_high", "response_time_high", "service_down"]
        severities = ["info", "warning", "critical"]
        services = ["web-frontend", "api-backend", "database", "cache-redis", "message-queue"]
        
        # 랜덤 알림 생성
        for i in range(random.randint(5, 20)):
            alert_time = datetime.now() - timedelta(hours=random.uniform(0, hours))
            alert_severity = severity if severity else random.choice(severities)
            
            alerts.append({
                "id": i + 1,
                "timestamp": alert_time.isoformat(),
                "type": random.choice(alert_types),
                "severity": alert_severity,
                "service": random.choice(services),
                "message": f"Alert triggered for {random.choice(services)}",
                "resolved": random.choice([True, False]),
                "resolution_time": random.randint(2, 30) if random.choice([True, False]) else None
            })
        
        # 시간순 정렬
        alerts.sort(key=lambda x: x["timestamp"], reverse=True)
        
        return JSONResponse(content={
            "status": "success",
            "hours": hours,
            "severity_filter": severity,
            "total_alerts": len(alerts),
            "alerts": alerts
        })
        
    except Exception as e:
        logger.error(f"Alert history error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get alert history: {str(e)}")
