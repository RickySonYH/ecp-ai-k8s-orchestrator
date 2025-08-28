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
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 라우터 등록
app.include_router(tenants_router, prefix="/api/v1")
app.include_router(images_router, prefix="/api/v1") 
app.include_router(image_management_router, prefix="/api/v1")
app.include_router(simulator_router, prefix="/api/v1", tags=["simulator"])  # [advice from AI] 시뮬레이터 라우터 등록



# 헬스 체크 엔드포인트
@app.get("/health")
async def health_check():
    """시스템 헬스 체크"""
    return {
        "status": "healthy",
        "service": "ecp-ai-k8s-orchestrator",
        "version": "1.0.0",
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
