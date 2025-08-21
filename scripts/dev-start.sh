#!/bin/bash
# [advice from AI] ECP-AI Kubernetes Orchestrator 개발 서버 시작 스크립트

set -e  # 에러 발생 시 스크립트 중단

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 함수들
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 프로젝트 루트 디렉토리로 이동
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

log_info "🚀 ECP-AI Kubernetes Orchestrator 개발 서버 시작"
log_info "프로젝트 루트: $PROJECT_ROOT"

# 1. Docker 상태 확인
log_info "🐳 Docker 상태 확인 중..."
if ! docker info &> /dev/null; then
    log_error "Docker가 실행되지 않음. Docker Desktop을 시작해주세요."
    exit 1
fi
log_success "Docker 실행 중"

# 2. 기존 컨테이너 정리 (선택사항)
if [ "$1" = "--clean" ]; then
    log_info "🧹 기존 컨테이너 정리 중..."
    docker-compose down -v --remove-orphans
    docker system prune -f
    log_success "컨테이너 정리 완료"
fi

# 3. 환경 변수 파일 확인
log_info "⚙️ 환경 변수 파일 확인 중..."
if [ ! -f .env ]; then
    log_warning ".env 파일이 없음. dev-setup.sh를 먼저 실행하세요."
    ./scripts/dev-setup.sh
fi

# 4. 필요한 디렉토리 확인
log_info "📁 디렉토리 구조 확인 중..."
mkdir -p logs
mkdir -p config/k8s-templates
mkdir -p config/monitoring

# 5. Docker 이미지 빌드
log_info "🔨 Docker 이미지 빌드 중..."
docker-compose build --parallel

# 6. 데이터베이스 및 Redis 먼저 시작
log_info "💾 데이터베이스 서비스 시작 중..."
docker-compose up -d postgres redis

# 7. 데이터베이스 헬스체크 대기
log_info "⏳ 데이터베이스 준비 대기 중..."
timeout=60
while ! docker-compose exec -T postgres pg_isready -U ecp_user -d ecp_orchestrator &> /dev/null; do
    if [ $timeout -le 0 ]; then
        log_error "데이터베이스 준비 시간 초과"
        exit 1
    fi
    echo -n "."
    sleep 2
    ((timeout-=2))
done
echo ""
log_success "데이터베이스 준비 완료"

# 8. Redis 헬스체크 대기
log_info "⏳ Redis 준비 대기 중..."
timeout=30
while ! docker-compose exec -T redis redis-cli ping &> /dev/null; do
    if [ $timeout -le 0 ]; then
        log_error "Redis 준비 시간 초과"
        exit 1
    fi
    echo -n "."
    sleep 1
    ((timeout-=1))
done
echo ""
log_success "Redis 준비 완료"

# 9. 백엔드 서비스 시작
log_info "⚙️ 백엔드 서비스 시작 중..."
docker-compose up -d backend

# 10. 백엔드 헬스체크 대기
log_info "⏳ 백엔드 서비스 준비 대기 중..."
timeout=90
while ! curl -f http://localhost:8000/health &> /dev/null; do
    if [ $timeout -le 0 ]; then
        log_error "백엔드 서비스 준비 시간 초과"
        log_info "백엔드 로그 확인: docker-compose logs backend"
        exit 1
    fi
    echo -n "."
    sleep 2
    ((timeout-=2))
done
echo ""
log_success "백엔드 서비스 준비 완료"

# 11. 프론트엔드 서비스 시작
log_info "🎨 프론트엔드 서비스 시작 중..."
docker-compose up -d frontend

# 12. 프론트엔드 헬스체크 대기 (더 오래 기다림 - React 빌드 시간)
log_info "⏳ 프론트엔드 서비스 준비 대기 중 (React 빌드 시간 소요)..."
timeout=180
while ! curl -f http://localhost:3000 &> /dev/null; do
    if [ $timeout -le 0 ]; then
        log_error "프론트엔드 서비스 준비 시간 초과"
        log_info "프론트엔드 로그 확인: docker-compose logs frontend"
        exit 1
    fi
    echo -n "."
    sleep 3
    ((timeout-=3))
done
echo ""
log_success "프론트엔드 서비스 준비 완료"

# 13. 모든 서비스 상태 확인
log_info "📊 서비스 상태 확인 중..."
docker-compose ps

# 14. 서비스 URL 출력
log_success "🎉 모든 서비스가 성공적으로 시작되었습니다!"
echo ""
log_info "📍 서비스 접근 URL:"
log_info "  🎨 Frontend (Developer UI): http://localhost:3000"
log_info "  ⚙️  Backend API:              http://localhost:8000"
log_info "  📚 API Documentation:        http://localhost:8000/docs"
log_info "  📖 ReDoc Documentation:      http://localhost:8000/redoc"
log_info "  💾 PostgreSQL:               localhost:5432"
log_info "  🔄 Redis:                    localhost:6379"
echo ""
log_info "🔧 유용한 명령어:"
log_info "  로그 실시간 보기:   docker-compose logs -f"
log_info "  특정 서비스 로그:   docker-compose logs -f [service_name]"
log_info "  서비스 재시작:      docker-compose restart [service_name]"
log_info "  서비스 중지:        ./scripts/dev-stop.sh"
log_info "  컨테이너 접속:      docker-compose exec [service_name] /bin/bash"
echo ""
log_info "🔍 모니터링:"
log_info "  실시간 로그:        docker-compose logs -f"
log_info "  리소스 사용률:      docker stats"
log_info "  헬스체크:          docker-compose ps"
echo ""

# 15. 선택적으로 로그 팔로우
if [ "$1" = "--logs" ] || [ "$2" = "--logs" ]; then
    log_info "📝 실시간 로그 표시 중... (Ctrl+C로 중단)"
    sleep 2
    docker-compose logs -f
fi

# 16. 개발 팁 출력
echo ""
log_info "💡 개발 팁:"
log_info "  - 백엔드 코드 변경 시 자동 리로드됩니다"
log_info "  - 프론트엔드 코드 변경 시 자동 리로드됩니다"
log_info "  - 데이터베이스는 볼륨에 저장되어 재시작해도 유지됩니다"
log_info "  - API 테스트는 http://localhost:8000/docs에서 가능합니다"
echo ""
log_success "개발 환경 준비 완료! 즐거운 개발 되세요! 🚀"
