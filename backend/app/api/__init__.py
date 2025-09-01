# [advice from AI] ECP-AI API 패키지
"""
ECP-AI Kubernetes Orchestrator API Package
"""

# [advice from AI] API 라우터 설정 - 실제 존재하는 모듈만 import
from fastapi import APIRouter
from .v1 import tenants, statistics

# [advice from AI] API 라우터 설정
api_router = APIRouter()

# v1 API 엔드포인트 등록 (실제 존재하는 모듈만)
api_router.include_router(tenants.router, prefix="/v1/tenants", tags=["tenants"])
api_router.include_router(statistics.router, prefix="/v1/statistics", tags=["statistics"])
