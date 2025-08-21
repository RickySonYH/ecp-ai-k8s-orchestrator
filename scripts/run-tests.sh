#!/bin/bash
# [advice from AI] ECP-AI 테스트 실행 스크립트

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 프로젝트 루트로 이동
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

log_info "🧪 ECP-AI 테스트 실행 시작"

# 테스트 타입 확인
TEST_TYPE="${1:-all}"

case $TEST_TYPE in
    "unit")
        log_info "📝 단위 테스트만 실행"
        docker-compose exec backend python -m pytest tests/test_tenant_manager.py -v -m "not integration"
        ;;
    "api")
        log_info "🌐 API 테스트만 실행"
        # 먼저 curl 기반 API 테스트
        ./scripts/test-api.sh
        echo ""
        # 그 다음 pytest API 테스트
        docker-compose exec backend python -m pytest tests/test_api.py -v
        ;;
    "integration")
        log_info "🔗 통합 테스트 실행"
        docker-compose exec backend python -m pytest tests/ -v -m integration
        ;;
    "all"|*)
        log_info "🎯 전체 테스트 실행"
        
        # 1. 단위 테스트
        log_info "1️⃣ 단위 테스트 실행 중..."
        docker-compose exec backend python -m pytest tests/test_tenant_manager.py -v
        
        echo ""
        
        # 2. API 테스트 (curl)
        log_info "2️⃣ API 기능 테스트 실행 중..."
        ./scripts/test-api.sh
        
        echo ""
        
        # 3. API 테스트 (pytest)
        log_info "3️⃣ API 단위 테스트 실행 중..."
        docker-compose exec backend python -m pytest tests/test_api.py -v
        
        log_success "전체 테스트 완료!"
        ;;
esac

echo ""
log_info "💡 테스트 옵션:"
log_info "  ./scripts/run-tests.sh unit        # 단위 테스트만"
log_info "  ./scripts/run-tests.sh api         # API 테스트만"
log_info "  ./scripts/run-tests.sh integration # 통합 테스트만"
log_info "  ./scripts/run-tests.sh all         # 전체 테스트"
