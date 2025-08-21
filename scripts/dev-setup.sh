#!/bin/bash
# [advice from AI] ECP-AI Kubernetes Orchestrator 개발 환경 초기 설정 스크립트

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

log_info "🚀 ECP-AI Kubernetes Orchestrator 개발 환경 설정 시작"
log_info "프로젝트 루트: $PROJECT_ROOT"

# 1. 필수 도구 확인
log_info "📋 필수 도구 확인 중..."

check_command() {
    if command -v "$1" &> /dev/null; then
        log_success "$1 설치됨"
        return 0
    else
        log_error "$1이 설치되지 않음"
        return 1
    fi
}

MISSING_TOOLS=()

if ! check_command docker; then
    MISSING_TOOLS+=("docker")
fi

if ! check_command docker-compose; then
    MISSING_TOOLS+=("docker-compose")
fi

if ! check_command node; then
    MISSING_TOOLS+=("node")
fi

if ! check_command python3; then
    MISSING_TOOLS+=("python3")
fi

if [ ${#MISSING_TOOLS[@]} -ne 0 ]; then
    log_error "다음 도구들이 필요합니다: ${MISSING_TOOLS[*]}"
    log_info "macOS에서 설치 방법:"
    log_info "  brew install docker docker-compose node python@3.11"
    exit 1
fi

# 2. Docker 상태 확인
log_info "🐳 Docker 상태 확인 중..."
if ! docker info &> /dev/null; then
    log_error "Docker가 실행되지 않음. Docker Desktop을 시작해주세요."
    exit 1
fi
log_success "Docker 실행 중"

# 3. 필요한 디렉토리 생성
log_info "📁 필요한 디렉토리 생성 중..."
mkdir -p logs
mkdir -p config/k8s-templates
mkdir -p config/monitoring
mkdir -p backend/tests
mkdir -p frontend/developer-ui/src/components
mkdir -p frontend/developer-ui/src/types
mkdir -p frontend/developer-ui/src/hooks
mkdir -p frontend/developer-ui/src/utils
mkdir -p frontend/developer-ui/public
log_success "디렉토리 구조 생성 완료"

# 4. 환경 변수 파일 생성
log_info "⚙️ 환경 변수 파일 생성 중..."
if [ ! -f .env ]; then
    cat > .env << EOF
# ECP-AI Kubernetes Orchestrator 개발 환경 설정

# 데이터베이스
POSTGRES_DB=ecp_orchestrator
POSTGRES_USER=ecp_user
POSTGRES_PASSWORD=ecp_password
DATABASE_URL=postgresql://ecp_user:ecp_password@localhost:5432/ecp_orchestrator

# Redis
REDIS_URL=redis://localhost:6379/0

# 백엔드
ENVIRONMENT=development
LOG_LEVEL=DEBUG
PYTHONPATH=/app
API_V1_PREFIX=/api/v1
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# 프론트엔드
REACT_APP_API_BASE_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000/ws
REACT_APP_SUPPORTED_GPU_TYPES=t4,v100,l40s
REACT_APP_TENANT_PRESETS=micro,small,medium,large
REACT_APP_SERVICES=callbot,chatbot,advisor,stt,tts,ta,qa

# ECP-AI 특화 설정
ECP_SERVICE_MATRIX_PATH=/app/config/ecp_service_matrix.json
TENANT_NAMESPACE_PREFIX=ecp-ai

# 개발용 설정
DEBUG=true
RELOAD=true
PROMETHEUS_ENABLED=true
EOF
    log_success ".env 파일 생성 완료"
else
    log_warning ".env 파일이 이미 존재함"
fi

# 5. Git 설정 확인
log_info "📝 Git 설정 확인 중..."
if [ ! -f .gitignore ]; then
    cat > .gitignore << EOF
# 환경 변수
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# 로그
logs/
*.log

# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
.venv/
pip-log.txt
pip-delete-this-directory.txt
.coverage
.pytest_cache/

# Node.js
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# React
build/
.eslintcache

# Docker
.dockerignore

# IDE
.vscode/
.idea/
*.swp
*.swo

# macOS
.DS_Store

# 개발용 임시 파일
temp/
tmp/
*.tmp

# Kubernetes
kubeconfig
*.kubeconfig
EOF
    log_success ".gitignore 파일 생성 완료"
else
    log_warning ".gitignore 파일이 이미 존재함"
fi

# 6. Docker 네트워크 생성
log_info "🌐 Docker 네트워크 생성 중..."
if ! docker network ls | grep -q ecp-ai-network; then
    docker network create ecp-ai-network
    log_success "Docker 네트워크 생성 완료"
else
    log_warning "Docker 네트워크가 이미 존재함"
fi

# 7. Docker 볼륨 생성
log_info "💾 Docker 볼륨 생성 중..."
VOLUMES=("ecp-postgres-data" "ecp-redis-data" "ecp-backend-cache" "ecp-frontend-node-modules")

for volume in "${VOLUMES[@]}"; do
    if ! docker volume ls | grep -q "$volume"; then
        docker volume create "$volume"
        log_success "볼륨 $volume 생성 완료"
    else
        log_warning "볼륨 $volume이 이미 존재함"
    fi
done

# 8. 백엔드 Python 가상환경 생성 (선택사항)
log_info "🐍 Python 가상환경 설정 (선택사항)..."
if [ ! -d "backend/venv" ]; then
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    deactivate
    cd ..
    log_success "Python 가상환경 생성 완료"
else
    log_warning "Python 가상환경이 이미 존재함"
fi

# 9. 프론트엔드 의존성 설치 (선택사항)
log_info "📦 프론트엔드 의존성 설치 (선택사항)..."
if [ -f "frontend/developer-ui/package.json" ] && [ ! -d "frontend/developer-ui/node_modules" ]; then
    cd frontend/developer-ui
    npm install
    cd ../..
    log_success "프론트엔드 의존성 설치 완료"
else
    log_warning "프론트엔드 의존성이 이미 설치됨 또는 package.json 없음"
fi

# 10. 개발용 스크립트 실행 권한 설정
log_info "🔧 스크립트 실행 권한 설정 중..."
chmod +x scripts/*.sh
log_success "스크립트 실행 권한 설정 완료"

# 11. 헬스체크
log_info "🏥 시스템 헬스체크..."
echo "Docker 버전: $(docker --version)"
echo "Docker Compose 버전: $(docker-compose --version)"
echo "Node 버전: $(node --version)"
echo "Python 버전: $(python3 --version)"

# 완료 메시지
log_success "🎉 ECP-AI Kubernetes Orchestrator 개발 환경 설정 완료!"
echo ""
log_info "다음 단계:"
log_info "  1. 개발 서버 시작: ./scripts/dev-start.sh"
log_info "  2. 개발 서버 중지: ./scripts/dev-stop.sh"
log_info "  3. 로그 확인: docker-compose logs -f"
log_info "  4. 서비스 접근:"
log_info "     - Frontend: http://localhost:3000"
log_info "     - Backend API: http://localhost:8000"
log_info "     - API Docs: http://localhost:8000/docs"
log_info "     - PostgreSQL: localhost:5432"
log_info "     - Redis: localhost:6379"
echo ""
log_warning "주의: Kubernetes 클러스터 연결이 필요한 경우 ~/.kube/config 파일을 확인하세요."
