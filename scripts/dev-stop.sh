#!/bin/bash
# [advice from AI] ECP-AI Kubernetes Orchestrator 개발 서버 중지 스크립트

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

log_info "🛑 ECP-AI Kubernetes Orchestrator 개발 서버 중지"
log_info "프로젝트 루트: $PROJECT_ROOT"

# 1. 현재 실행 중인 서비스 확인
log_info "📊 현재 실행 중인 서비스 확인..."
if docker-compose ps | grep -q "Up"; then
    log_info "실행 중인 서비스들:"
    docker-compose ps --format "table {{.Name}}\t{{.State}}\t{{.Ports}}"
else
    log_warning "실행 중인 서비스가 없습니다"
fi

# 2. 중지 옵션 확인
CLEAN_ALL=false
REMOVE_VOLUMES=false
REMOVE_IMAGES=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --clean)
            CLEAN_ALL=true
            log_info "🧹 전체 정리 모드 활성화"
            shift
            ;;
        --volumes)
            REMOVE_VOLUMES=true
            log_info "💾 볼륨 삭제 모드 활성화"
            shift
            ;;
        --images)
            REMOVE_IMAGES=true
            log_info "🖼️ 이미지 삭제 모드 활성화"
            shift
            ;;
        --all)
            CLEAN_ALL=true
            REMOVE_VOLUMES=true
            REMOVE_IMAGES=true
            log_info "🔥 완전 정리 모드 활성화"
            shift
            ;;
        -h|--help)
            echo "사용법: $0 [옵션]"
            echo ""
            echo "옵션:"
            echo "  --clean     컨테이너 및 네트워크 정리"
            echo "  --volumes   데이터 볼륨도 함께 삭제"
            echo "  --images    빌드된 이미지도 함께 삭제"
            echo "  --all       모든 것을 정리 (volumes + images + clean)"
            echo "  -h, --help  도움말 표시"
            echo ""
            echo "예시:"
            echo "  $0                일반 중지"
            echo "  $0 --clean        컨테이너 정리하며 중지"
            echo "  $0 --volumes      데이터까지 삭제하며 중지"
            echo "  $0 --all          완전히 정리하며 중지"
            exit 0
            ;;
        *)
            log_error "알 수 없는 옵션: $1"
            log_info "도움말: $0 --help"
            exit 1
            ;;
    esac
done

# 3. 서비스 중지
log_info "⏹️ 서비스 중지 중..."
if $REMOVE_VOLUMES; then
    docker-compose down -v --remove-orphans
    log_success "서비스 중지 및 볼륨 삭제 완료"
elif $CLEAN_ALL; then
    docker-compose down --remove-orphans
    log_success "서비스 중지 및 컨테이너 정리 완료"
else
    docker-compose stop
    log_success "서비스 중지 완료 (컨테이너 보존)"
fi

# 4. 이미지 정리 (요청된 경우)
if $REMOVE_IMAGES; then
    log_info "🖼️ Docker 이미지 정리 중..."
    
    # ECP-AI 관련 이미지 삭제
    ECP_IMAGES=$(docker images --format "table {{.Repository}}:{{.Tag}}" | grep -E "ecp-ai|ecp_" || true)
    if [ -n "$ECP_IMAGES" ]; then
        echo "$ECP_IMAGES" | xargs docker rmi -f || true
        log_success "ECP-AI 이미지 삭제 완료"
    else
        log_info "삭제할 ECP-AI 이미지가 없음"
    fi
    
    # 댕글링 이미지 정리
    docker image prune -f
    log_success "댕글링 이미지 정리 완료"
fi

# 5. 시스템 정리 (전체 정리 모드)
if $CLEAN_ALL; then
    log_info "🧹 시스템 정리 중..."
    
    # 사용하지 않는 컨테이너, 네트워크, 이미지 정리
    docker system prune -f
    
    # ECP-AI 네트워크 정리 (다른 프로젝트에서 사용하지 않는 경우)
    if docker network ls | grep -q ecp-ai-network; then
        if ! docker network inspect ecp-ai-network --format '{{.Containers}}' | grep -q .; then
            docker network rm ecp-ai-network || true
            log_success "ECP-AI 네트워크 정리 완료"
        else
            log_warning "ECP-AI 네트워크가 다른 컨테이너에서 사용 중"
        fi
    fi
    
    log_success "시스템 정리 완료"
fi

# 6. 볼륨 정리 상태 확인
if $REMOVE_VOLUMES; then
    log_info "💾 볼륨 정리 상태 확인..."
    REMAINING_VOLUMES=$(docker volume ls --format "{{.Name}}" | grep -E "ecp-" || true)
    if [ -n "$REMAINING_VOLUMES" ]; then
        log_warning "남아있는 ECP-AI 볼륨:"
        echo "$REMAINING_VOLUMES"
        log_info "수동 삭제: docker volume rm <volume_name>"
    else
        log_success "모든 ECP-AI 볼륨 정리 완료"
    fi
fi

# 7. 최종 상태 확인
log_info "📊 최종 상태 확인..."

# 실행 중인 ECP-AI 컨테이너 확인
RUNNING_CONTAINERS=$(docker ps --format "{{.Names}}" | grep -E "ecp-" || true)
if [ -n "$RUNNING_CONTAINERS" ]; then
    log_warning "아직 실행 중인 ECP-AI 컨테이너:"
    echo "$RUNNING_CONTAINERS"
else
    log_success "모든 ECP-AI 컨테이너 중지됨"
fi

# 8. 정리 요약 출력
log_success "🎉 개발 서버 중지 완료!"
echo ""
log_info "📋 정리 요약:"
if $REMOVE_VOLUMES; then
    log_info "  ✅ 서비스 중지됨"
    log_info "  ✅ 컨테이너 삭제됨"
    log_info "  ✅ 볼륨 삭제됨"
    log_warning "  ⚠️  데이터베이스 데이터가 삭제되었습니다"
elif $CLEAN_ALL; then
    log_info "  ✅ 서비스 중지됨"
    log_info "  ✅ 컨테이너 삭제됨"
    log_info "  ✅ 네트워크 정리됨"
    log_info "  💾 볼륨은 보존됨 (데이터 유지)"
else
    log_info "  ✅ 서비스 중지됨"
    log_info "  💾 컨테이너 및 볼륨 보존됨"
fi

if $REMOVE_IMAGES; then
    log_info "  ✅ Docker 이미지 정리됨"
fi

echo ""
log_info "🔧 다시 시작하려면:"
log_info "  개발 서버 시작: ./scripts/dev-start.sh"
if $REMOVE_VOLUMES; then
    log_info "  초기 설정 필요: ./scripts/dev-setup.sh"
fi

# 9. 리소스 사용량 정보
echo ""
log_info "💻 시스템 리소스 정보:"
echo "Docker 디스크 사용량:"
docker system df

# 10. 개발 팁
echo ""
log_info "💡 개발 팁:"
log_info "  - 데이터를 보존하려면 --volumes 옵션 사용하지 마세요"
log_info "  - 완전히 새로 시작하려면 --all 옵션을 사용하세요"
log_info "  - 특정 서비스만 재시작: docker-compose restart [service_name]"
echo ""
log_success "안전하게 중지되었습니다! 👋"
