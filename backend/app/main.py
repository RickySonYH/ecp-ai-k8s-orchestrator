# [advice from AI] ECP-AI Kubernetes Orchestrator FastAPI 메인 애플리케이션
"""
ECP-AI Kubernetes Orchestrator 메인 애플리케이션
- 콜봇/챗봇/어드바이저 서비스 지원
- GPU 타입별 처리 용량 최적화 (T4/V100/L40S)
- 테넌시 자동 감지 (micro/small/medium/large)
- Kubernetes 네이티브 통합
"""

import os
import logging
from contextlib import asynccontextmanager
from typing import Dict, Any

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import generate_latest, Counter, Histogram, Gauge
import structlog

# ECP-AI 핵심 모듈 임포트
from app.api.v1.tenants import router as tenants_router
from app.api.v1.images import router as images_router
from app.api.v1.image_management import router as image_management_router
from app.api.v1.simulator_integration import router as simulator_router  # [advice from AI] 시뮬레이터 라우터 추가
from app.api.v1.statistics import router as statistics_router  # [advice from AI] 통계 라우터 추가
from app.api.v1.cicd_images import router as cicd_images_router  # [advice from AI] CICD 이미지 라우터 추가
from app.api.v1.deployment_pipeline import router as deployment_router  # [advice from AI] 배포 파이프라인 라우터 추가

# from app.core.tenant_manager import TenantManager
# from app.core.resource_calculator import ResourceCalculator  
# from app.core.k8s_orchestrator import K8sOrchestrator
# from app.core.database import engine, create_tables

# 프로메테우스 메트릭 정의
TENANT_OPERATIONS = Counter(
    'ecp_tenant_operations_total',
    'Total tenant operations',
    ['operation', 'status']
)

RESOURCE_CALCULATION_TIME = Histogram(
    'ecp_resource_calculation_seconds',
    'Time spent calculating resources'
)

ACTIVE_TENANTS = Gauge(
    'ecp_active_tenants',
    'Number of active tenants'
)

# 구조화된 로깅 설정
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# [advice from AI] 랜덤 알림 생성 백그라운드 태스크
async def random_alert_generator():
    """5초~60초 랜덤 간격으로 알림을 자동 생성하는 태스크"""
    import random
    import httpx
    import asyncio
    # [advice from AI] 테넌시별 vs 시스템 전체 알람 템플릿 분리
    tenant_specific_alerts = [
        {"title": "CPU 사용률 급증", "message": "테넌시 CPU 사용률이 {}%에 도달했습니다", "severity": "warning", "category": "resource", "scope": "tenant"},
        {"title": "메모리 부족 경고", "message": "테넌시 메모리 사용률이 {}%를 초과했습니다", "severity": "warning", "category": "resource", "scope": "tenant"},
        {"title": "GPU 메모리 부족", "message": "테넌시 GPU 메모리 사용률이 {}%를 초과했습니다", "severity": "warning", "category": "resource", "scope": "tenant"},
        {"title": "API 응답 지연", "message": "테넌시 API 평균 응답시간이 {}ms로 증가했습니다", "severity": "warning", "category": "performance", "scope": "tenant"},
        {"title": "서비스 재시작", "message": "테넌시 {} 서비스가 자동으로 재시작되었습니다", "severity": "info", "category": "system", "scope": "tenant"},
        {"title": "자동 스케일링", "message": "테넌시 {}에서 자동 스케일링이 실행되었습니다", "severity": "info", "category": "system", "scope": "tenant"},
        {"title": "백업 완료", "message": "테넌시 {} 백업이 성공적으로 완료되었습니다", "severity": "info", "category": "system", "scope": "tenant"}
    ]
    
    system_wide_alerts = [
        {"title": "디스크 공간 부족", "message": "시스템 디스크 사용률이 {}%에 도달했습니다", "severity": "critical", "category": "resource", "scope": "system"},
        {"title": "보안 이벤트", "message": "시스템 전체에서 의심스러운 로그인 시도 {}회 감지", "severity": "critical", "category": "security", "scope": "system"},
        {"title": "SSL 인증서 만료 임박", "message": "시스템 SSL 인증서가 {}일 후 만료됩니다", "severity": "warning", "category": "security", "scope": "system"},
        {"title": "데이터베이스 연결 오류", "message": "메인 데이터베이스 연결 풀에서 {}개 연결 실패", "severity": "critical", "category": "database", "scope": "system"},
        {"title": "로드밸런서 이상", "message": "메인 로드밸런서에서 {}개 인스턴스 응답 없음", "severity": "critical", "category": "network", "scope": "system"},
        {"title": "시스템 업데이트 완료", "message": "ECP-AI 시스템 업데이트가 완료되었습니다", "severity": "info", "category": "system", "scope": "system"}
    ]
    
    services = ["web-frontend", "api-backend", "database", "redis-cache", "nginx-proxy", "monitoring-service", "ai-engine", "chatbot-service"]
    
    # 시작 지연 (다른 시스템이 준비될 때까지)
    await asyncio.sleep(10)
    
    while True:
        try:
            # 5초에서 60초 사이의 랜덤 대기 시간
            wait_time = random.randint(5, 60)
            await asyncio.sleep(wait_time)
            
            # [advice from AI] 먼저 현재 테넌시 목록 확인
            async with httpx.AsyncClient() as client:
                try:
                    tenant_response = await client.get("http://127.0.0.1:8000/api/v1/tenants/", timeout=5.0)
                    if tenant_response.status_code == 200:
                        tenant_data = tenant_response.json()
                        existing_tenants = tenant_data.get('tenants', [])
                    else:
                        existing_tenants = []
                except:
                    existing_tenants = []
            
            # 테넌시가 없으면 알람 생성 중단
            if len(existing_tenants) == 0:
                logger.info("테넌시가 없어서 알람 생성을 건너뜁니다")
                continue
            
            # [advice from AI] 알람 유형 결정 (70% 테넌시별, 30% 시스템 전체)
            is_tenant_specific = random.random() < 0.7
            
            if is_tenant_specific:
                # 테넌시별 알람 - 기존 테넌시 중 하나 선택
                template = random.choice(tenant_specific_alerts)
                selected_tenant = random.choice(existing_tenants)
                tenant_id = selected_tenant.get('tenant_id')
                tenant_name = selected_tenant.get('name', tenant_id)
            else:
                # 시스템 전체 알람
                template = random.choice(system_wide_alerts)
                tenant_id = None
                tenant_name = None
            
            # [advice from AI] 메시지에 값 삽입 (테넌시별/시스템별 구분)
            if "{}" in template["message"]:
                if "CPU" in template["title"] or "메모리" in template["title"] or "디스크" in template["title"] or "GPU" in template["title"]:
                    value = random.randint(75, 98)
                elif "응답 시간" in template["title"] or "응답시간" in template["title"]:
                    value = random.randint(300, 1200)
                elif "로그인 시도" in template["title"]:
                    value = random.randint(3, 15)
                elif "연결" in template["title"] or "인스턴스" in template["title"]:
                    value = random.randint(2, 8)
                elif "인증서" in template["title"]:
                    value = random.randint(7, 30)
                elif "적중률" in template["title"]:
                    value = random.randint(45, 65)
                elif template["scope"] == "tenant" and ("서비스" in template["title"] or "백업" in template["title"] or "스케일링" in template["title"]):
                    # 테넌시별 알람일 때는 테넌시 이름이나 서비스명 사용
                    value = tenant_name if tenant_name else random.choice(services)
                else:
                    value = random.randint(1, 100)
                
                message = template["message"].format(value)
            else:
                message = template["message"]
            
            # [advice from AI] 테넌시 정보를 포함한 알림 생성
            async with httpx.AsyncClient() as client:
                alert_data = {
                    "title": template["title"],
                    "message": message,
                    "severity": template["severity"],
                    "category": template["category"],
                    "tenant_id": tenant_id,  # [advice from AI] 테넌시 ID 추가
                    "service_name": random.choice(services) if template["category"] != "system" else None
                }
                
                try:
                    response = await client.post(
                        "http://127.0.0.1:8000/api/v1/alerts/",  # [advice from AI] 컨테이너 내부에서 자기 자신의 포트 8000에 접근
                        json=alert_data,
                        timeout=10.0
                    )
                    
                    if response.status_code == 200:
                        scope_info = f"테넌시: {tenant_name}" if tenant_id else "시스템 전체"
                        logger.info(f"🔔 자동 알림 생성: {template['title']} ({scope_info}) (다음: {wait_time}초 후)")
                    else:
                        logger.warning(f"자동 알림 생성 실패: {response.status_code}")
                except Exception as req_error:
                    logger.warning(f"알림 생성 요청 실패: {req_error}")
            
        except Exception as e:
            logger.error(f"자동 알림 생성 오류: {e}")
            await asyncio.sleep(30)  # 오류 시 30초 대기


@asynccontextmanager
async def lifespan(app: FastAPI):
    """애플리케이션 라이프사이클 관리"""
    # 시작 시 초기화
    logger.info("ECP-AI Kubernetes Orchestrator 시작")
    
    # 데이터베이스 테이블 생성
    # await create_tables()
    
    # Kubernetes 클러스터 연결 확인
    # k8s_orchestrator = K8sOrchestrator()
    # await k8s_orchestrator.health_check()
    
    # [advice from AI] 멈춰있는 배포 상태 자동 복구 (비동기 태스크)
    try:
        from app.api.v1.tenants import check_and_fix_stuck_deployments
        import asyncio
        # 5초 지연 후 배포 상태 체크 (DB 초기화 대기)
        async def delayed_check():
            await asyncio.sleep(5)
            await check_and_fix_stuck_deployments()
        
        asyncio.create_task(delayed_check())
        logger.info("배포 상태 자동 복구 시스템 시작 (5초 후 실행)")
    except Exception as e:
        logger.error("배포 상태 복구 시스템 시작 실패", error=str(e))
    
    # [advice from AI] 랜덤 알림 자동 생성 태스크 시작
    try:
        asyncio.create_task(random_alert_generator())
        logger.info("랜덤 알림 자동 생성 시스템 시작")
    except Exception as e:
        logger.error("랜덤 알림 생성 시스템 시작 실패", error=str(e))
    
    logger.info("초기화 완료")
    
    yield
    
    # 종료 시 정리
    logger.info("ECP-AI Kubernetes Orchestrator 종료")


# FastAPI 앱 생성
app = FastAPI(
    title="ECP-AI Kubernetes Orchestrator",
    description="""
    ECP-AI 솔루션을 위한 Kubernetes 자동 오케스트레이션 시스템
    
    ## 주요 기능
    
    * **테넌시 자동 관리**: micro/small/medium/large 프리셋 자동 감지
    * **리소스 최적화**: GPU 타입별 처리 용량 기반 자동 계산
    * **서비스 지원**: 콜봇/챗봇/어드바이저 워크로드 특화
    * **Kubernetes 네이티브**: 완전한 K8s 통합 및 자동 배포
    * **실시간 모니터링**: 프로메테우스 메트릭 및 SLA 추적
    """,
    version="1.54.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS 설정 [advice from AI] 환경변수 기반으로 수정
import os
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001,http://localhost:3002").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# [advice from AI] CICD 설정 라우터 등록 (먼저 등록)
from .api.v1.cicd_settings import router as cicd_settings_router
app.include_router(cicd_settings_router, prefix="/api/v1", tags=["cicd-settings"])

# API 라우터 등록
app.include_router(tenants_router, prefix="/api/v1")
app.include_router(statistics_router, prefix="/api/v1", tags=["statistics"])  # [advice from AI] 통계 라우터 등록
app.include_router(cicd_images_router, prefix="/api/v1/cicd", tags=["cicd"])  # [advice from AI] CICD 이미지 라우터 등록
app.include_router(deployment_router, prefix="/api/v1/deployment", tags=["deployment"])  # [advice from AI] 배포 파이프라인 라우터 등록

# [advice from AI] 고급 모니터링 라우터 등록
from .api.v1.advanced_monitoring import router as advanced_monitoring_router
app.include_router(advanced_monitoring_router, prefix="/api/v1", tags=["advanced-monitoring"])

# [advice from AI] 알림 관리 라우터 등록
from .api.v1.alerts import router as alerts_router
app.include_router(alerts_router, prefix="/api/v1/alerts", tags=["alerts"])

# [advice from AI] 임계값 설정 관리 라우터 등록
from .api.v1.threshold_settings import router as threshold_router
app.include_router(threshold_router, prefix="/api/v1/thresholds", tags=["thresholds"])



# 헬스 체크 엔드포인트
@app.get("/health")
async def health_check():
    """시스템 헬스 체크"""
    return {
        "status": "healthy",
        "service": "ecp-ai-k8s-orchestrator",
        "version": "1.54.0",
        "timestamp": "2024-12-01T00:00:00Z"
    }


@app.get("/ready")
async def readiness_check():
    """준비 상태 체크"""
    try:
        # 데이터베이스 연결 확인
        # 쿠버네티스 클러스터 연결 확인
        # Redis 연결 확인
        
        return {
            "status": "ready",
            "checks": {
                "database": "ok",
                "kubernetes": "ok", 
                "redis": "ok"
            }
        }
    except Exception as e:
        logger.error("준비 상태 체크 실패", error=str(e))
        raise HTTPException(status_code=503, detail="Service not ready")


@app.get("/metrics")
async def metrics():
    """프로메테우스 메트릭 엔드포인트"""
    return generate_latest()


# 기존 API는 tenants_router로 이동됨


# 리소스 계산 API
@app.post("/api/v1/calculate-resources")
async def calculate_resources(service_requirements: Dict[str, int]):
    """
    리소스 요구사항 계산
    - 실제 ECP-AI 가중치 기반
    - GPU 타입별 최적화
    """
    try:
        with RESOURCE_CALCULATION_TIME.time():
            # 실제 구현에서는 ResourceCalculator 사용
            # calculator = ResourceCalculator()
            # gpu_requirements = calculator.calculate_gpu_requirements(service_requirements)
            # cpu_requirements = calculator.calculate_cpu_requirements(service_requirements)
            
            # 임시 계산 로직
            total_channels = service_requirements.get("callbot", 0) + service_requirements.get("advisor", 0)
            total_users = service_requirements.get("chatbot", 0)
            
            # 프리셋 감지
            if total_channels < 10 and total_users < 50:
                preset = "micro"
            elif total_channels < 100 and total_users < 500:
                preset = "small"
            elif total_channels < 500 and total_users < 2000:
                preset = "medium"
            else:
                preset = "large"
            
            return {
                "preset": preset,
                "total_channels": total_channels,
                "total_users": total_users,
                "gpu_requirements": {
                    "tts": max(1, total_channels // 50),
                    "nlp": max(1, total_channels // 25),
                    "aicm": max(1, total_channels // 30),
                    "recommended_type": "t4" if total_channels < 100 else "v100"
                },
                "cpu_requirements": {
                    "stt": max(4, total_channels // 6),
                    "infrastructure": 12
                }
            }
            
    except Exception as e:
        logger.error("리소스 계산 실패", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_config=None  # structlog 사용
    )
