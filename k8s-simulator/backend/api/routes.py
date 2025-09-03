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

# [advice from AI] 전역 알림 저장소 - 파일 기반 지속성
import os
import json
from pathlib import Path

ALERTS_FILE_PATH = "/tmp/k8s_simulator_alerts.json"
GLOBAL_ALERTS = []
ALERT_ID_COUNTER = 1

def _load_alerts_from_file():
    """파일에서 알림 데이터 로드"""
    global GLOBAL_ALERTS, ALERT_ID_COUNTER
    try:
        if os.path.exists(ALERTS_FILE_PATH):
            with open(ALERTS_FILE_PATH, 'r', encoding='utf-8') as f:
                data = json.load(f)
                GLOBAL_ALERTS = data.get('alerts', [])
                ALERT_ID_COUNTER = data.get('counter', 1)
                logger.info(f"알림 데이터 로드 완료: {len(GLOBAL_ALERTS)}개 알림, 카운터: {ALERT_ID_COUNTER}")
        else:
            logger.info("알림 파일이 존재하지 않음. 새로 시작합니다.")
    except Exception as e:
        logger.error(f"알림 데이터 로드 실패: {e}")
        GLOBAL_ALERTS = []
        ALERT_ID_COUNTER = 1

def _save_alerts_to_file():
    """알림 데이터를 파일에 저장"""
    try:
        data = {
            'alerts': GLOBAL_ALERTS,
            'counter': ALERT_ID_COUNTER,
            'last_updated': datetime.now().isoformat()
        }
        with open(ALERTS_FILE_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"알림 데이터 저장 실패: {e}")

# [advice from AI] 알림 유형별 메시지 템플릿
ALERT_TEMPLATES = {
    "cpu_high": ["CPU 사용률이 {threshold}%를 초과했습니다", "warning"],
    "memory_high": ["메모리 사용률이 {threshold}%를 초과했습니다", "warning"],
    "gpu_high": ["GPU 사용률이 {threshold}%를 초과했습니다", "warning"],
    "response_time_high": ["응답 시간이 {threshold}ms를 초과했습니다", "warning"],
    "error_rate_high": ["에러율이 {threshold}%를 초과했습니다", "critical"],
    "service_down": ["서비스가 중단되었습니다", "critical"],
    "auto_scaling": ["자동 스케일링이 실행되었습니다", "info"],
    "deployment_success": ["배포가 성공적으로 완료되었습니다", "info"],
    "backup_completed": ["백업이 완료되었습니다", "info"],
    "maintenance_start": ["시스템 유지보수가 시작되었습니다", "warning"],
    "maintenance_end": ["시스템 유지보수가 완료되었습니다", "info"]
}

async def _create_alert(alert_type: str, service_name: str = "system", **kwargs):
    """통합 알림 생성 함수"""
    global ALERT_ID_COUNTER
    from datetime import datetime
    
    if alert_type in ALERT_TEMPLATES:
        message_template, default_severity = ALERT_TEMPLATES[alert_type]
        message = message_template.format(**kwargs)
        severity = kwargs.get('severity', default_severity)
    else:
        message = kwargs.get('message', f"알 수 없는 이벤트: {alert_type}")
        severity = kwargs.get('severity', 'info')
    
    alert = {
        "id": ALERT_ID_COUNTER,
        "timestamp": datetime.now().isoformat(),
        "type": alert_type,
        "severity": severity,
        "service": service_name,
        "message": message,
        "resolved": kwargs.get('resolved', False),
        "resolution_time": kwargs.get('resolution_time', None)
    }
    
    GLOBAL_ALERTS.append(alert)
    ALERT_ID_COUNTER += 1
    logger.info(f"알림 생성 [{severity}]: {message}")
    
    # 최근 200개 알림만 보관 (더 많은 히스토리 유지)
    if len(GLOBAL_ALERTS) > 200:
        GLOBAL_ALERTS.pop(0)
    
    # [advice from AI] 파일에 저장하여 지속성 확보
    _save_alerts_to_file()

async def _create_tenant_deletion_alert(tenant_id: str, deleted_count: int):
    """테넌시 삭제 알림 생성"""
    await _create_alert(
        "tenant_deletion",
        service_name="tenant-manager",
        message=f"테넌시 '{tenant_id}'가 삭제되었습니다 (리소스 {deleted_count}개 정리됨)",
        severity="warning",
        resolved=True,
        resolution_time=1
    )

async def _generate_system_alerts():
    """시스템 이벤트 기반 알림 자동 생성"""
    import random
    from datetime import datetime, timedelta
    
    # 확률적으로 새로운 알림 생성 (5% 확률)
    if random.random() < 0.05:
        alert_types = ["cpu_high", "memory_high", "auto_scaling", "backup_completed"]
        alert_type = random.choice(alert_types)
        
        services = ["web-frontend", "api-backend", "database", "cache-redis"]
        service = random.choice(services)
        
        if alert_type == "cpu_high":
            await _create_alert(alert_type, service, threshold=random.randint(80, 95))
        elif alert_type == "memory_high":
            await _create_alert(alert_type, service, threshold=random.randint(85, 95))
        elif alert_type in ["auto_scaling", "backup_completed"]:
            await _create_alert(alert_type, service, resolved=True, resolution_time=random.randint(1, 5))
        
        logger.info(f"자동 알림 생성: {alert_type} for {service}")

async def _initialize_base_alerts():
    """기본 알림 히스토리 초기화 (한 번만 실행)"""
    # [advice from AI] 먼저 파일에서 기존 알림 로드
    _load_alerts_from_file()
    
    # 파일에서 로드한 알림이 없거나 5개 미만이면 기본 알림 생성
    if len(GLOBAL_ALERTS) < 5:
        from datetime import datetime, timedelta
        
        # 과거 알림들 생성 (시간순으로)
        base_alerts = [
            {"type": "deployment_success", "service": "system", "message": "시스템이 성공적으로 시작되었습니다", "severity": "info", "resolved": True, "hours_ago": 24},
            {"type": "backup_completed", "service": "database", "message": "데이터베이스 백업이 완료되었습니다", "severity": "info", "resolved": True, "hours_ago": 12},
            {"type": "auto_scaling", "service": "web-frontend", "message": "자동 스케일링이 실행되었습니다", "severity": "info", "resolved": True, "hours_ago": 6},
            {"type": "cpu_high", "service": "api-backend", "message": "CPU 사용률이 85%를 초과했습니다", "severity": "warning", "resolved": True, "hours_ago": 3},
            {"type": "maintenance_end", "service": "system", "message": "시스템 유지보수가 완료되었습니다", "severity": "info", "resolved": True, "hours_ago": 1},
        ]
        
        global ALERT_ID_COUNTER
        for alert_data in base_alerts:
            hours_ago = alert_data.pop("hours_ago")
            timestamp = datetime.now() - timedelta(hours=hours_ago)
            
            alert = {
                "id": ALERT_ID_COUNTER,
                "timestamp": timestamp.isoformat(),
                **alert_data
            }
            GLOBAL_ALERTS.append(alert)
            ALERT_ID_COUNTER += 1
        
        # 파일에 저장
        _save_alerts_to_file()
        logger.info(f"기본 알림 히스토리 초기화: {len(base_alerts)}개 알림 생성")
    else:
        logger.info(f"기존 알림 히스토리 로드: {len(GLOBAL_ALERTS)}개 알림")

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

@k8s_router.delete("/resources/tenant/{tenant_id}")
async def delete_tenant_resources(tenant_id: str):
    """[advice from AI] 테넌시별 모든 리소스 삭제"""
    try:
        from main import get_simulator
        simulator = get_simulator()
        
        # 테넌시 네임스페이스 이름 생성 (ECP-AI 규칙에 따라)
        namespace = f"{tenant_id}-ecp-ai"
        
        # 해당 네임스페이스의 모든 리소스 조회
        resources = await simulator.get_resources(namespace=namespace)
        
        if not resources:
            return JSONResponse(content={
                "status": "success",
                "message": f"테넌시 '{tenant_id}'의 리소스가 없거나 이미 삭제됨",
                "deleted_count": 0
            })
        
        # 모든 리소스 삭제
        deleted_count = 0
        failed_count = 0
        
        for resource in resources:
            try:
                delete_result = await simulator.delete_resource(
                    name=resource.get("name"),
                    namespace=resource.get("namespace"),
                    kind=resource.get("kind")
                )
                if delete_result["status"] == "success":
                    deleted_count += 1
                else:
                    failed_count += 1
            except Exception as e:
                logger.error(f"리소스 삭제 실패: {resource.get('name')} - {e}")
                failed_count += 1
        
        # 모니터링 엔진 업데이트
        try:
            from core.monitoring_engine import MonitoringEngine
            engine = MonitoringEngine()
            all_resources = await simulator.get_resources()
            await engine.update_services_from_resources(all_resources)
            logger.info(f"테넌시 삭제 후 모니터링 엔진 업데이트: {len(all_resources)}개 리소스")
            
            # [advice from AI] 테넌시 삭제 알림 생성
            await _create_tenant_deletion_alert(tenant_id, deleted_count)
            
        except Exception as monitoring_error:
            logger.warning(f"모니터링 엔진 업데이트 실패: {monitoring_error}")
        
        return JSONResponse(content={
            "status": "success",
            "message": f"테넌시 '{tenant_id}' 리소스 삭제 완료",
            "deleted_count": deleted_count,
            "failed_count": failed_count,
            "namespace": namespace
        })
        
    except Exception as e:
        logger.error(f"Tenant resource deletion error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete tenant resources: {str(e)}")

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
    """누적형 알림 히스토리 조회"""
    try:
        from datetime import datetime, timedelta
        
        # [advice from AI] 기본 알림 히스토리 초기화
        await _initialize_base_alerts()
        
        # [advice from AI] 확률적 새 알림 생성 (실시간 시스템 이벤트 시뮬레이션)
        await _generate_system_alerts()
        
        # 시간 필터링 적용
        cutoff_time = datetime.now() - timedelta(hours=hours)
        filtered_alerts = []
        
        for alert in GLOBAL_ALERTS:
            try:
                alert_time = datetime.fromisoformat(alert["timestamp"].replace('Z', '+00:00'))
                if alert_time >= cutoff_time:
                    # 심각도 필터링 적용
                    if not severity or alert.get("severity") == severity:
                        filtered_alerts.append(alert)
            except Exception as e:
                # 시간 파싱 실패 시 포함 (최근 알림으로 간주)
                if not severity or alert.get("severity") == severity:
                    filtered_alerts.append(alert)
                logger.warning(f"알림 시간 파싱 실패: {e}")
        
        # 시간순 정렬 (최신순)
        filtered_alerts.sort(key=lambda x: x["timestamp"], reverse=True)
        
        alerts = filtered_alerts
        
        # [advice from AI] 통계 정보 계산
        total_alerts = len(alerts)
        unresolved_alerts = len([a for a in alerts if not a.get("resolved", False)])
        critical_alerts = len([a for a in alerts if a.get("severity") == "critical"])
        
        return JSONResponse(content={
            "status": "success",
            "hours": hours,
            "severity_filter": severity,
            "total_alerts": total_alerts,
            "unresolved_alerts": unresolved_alerts,
            "critical_alerts": critical_alerts,
            "total_stored_alerts": len(GLOBAL_ALERTS),
            "alerts": alerts
        })
        
    except Exception as e:
        logger.error(f"Alert history error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get alert history: {str(e)}")
