#!/bin/bash
# [advice from AI] ECP-AI CI/CD 파이프라인 - 이미지 태그 자동 생성 및 매니페스트 업데이트

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

# 환경 변수 설정
export DOCKER_REGISTRY=${DOCKER_REGISTRY:-"localhost:5000"}
export IMAGE_PREFIX=${IMAGE_PREFIX:-"ecp-ai"}
export K8S_MANIFESTS_DIR=${K8S_MANIFESTS_DIR:-"k8s-manifests"}
export TEMPLATES_DIR=${TEMPLATES_DIR:-"config/k8s-templates"}

# 이미지 태그 생성 함수
generate_image_tag() {
    local service_name=$1
    local git_commit=$(git rev-parse --short HEAD)
    local git_branch=$(git rev-parse --abbrev-ref HEAD | sed 's/[^a-zA-Z0-9]/-/g')
    local timestamp=$(date +%Y%m%d-%H%M%S)
    
    # 브랜치별 태그 전략
    if [ "$git_branch" = "main" ] || [ "$git_branch" = "master" ]; then
        echo "v1.0.0-${git_commit}"
    elif [ "$git_branch" = "develop" ]; then
        echo "dev-${timestamp}-${git_commit}"
    elif [[ "$git_branch" == feature/* ]]; then
        echo "feature-${git_branch#feature/}-${git_commit}"
    else
        echo "${git_branch}-${git_commit}"
    fi
}

# Docker 이미지 빌드 및 푸시
build_and_push_image() {
    local service_name=$1
    local dockerfile_path=$2
    local image_tag=$(generate_image_tag "$service_name")
    local full_image_name="${DOCKER_REGISTRY}/${IMAGE_PREFIX}/${service_name}:${image_tag}"
    local latest_tag="${DOCKER_REGISTRY}/${IMAGE_PREFIX}/${service_name}:latest"
    
    log_info "🔨 ${service_name} 이미지 빌드 중... (태그: ${image_tag})"
    
    # Docker 이미지 빌드
    docker build -t "$full_image_name" -t "$latest_tag" -f "$dockerfile_path" .
    
    # 이미지 푸시
    log_info "📤 ${service_name} 이미지 푸시 중..."
    docker push "$full_image_name"
    docker push "$latest_tag"
    
    # 이미지 정보를 파일에 저장 (매니페스트 생성 시 사용)
    echo "$full_image_name" > ".ci-cd-images/${service_name}.txt"
    
    log_success "${service_name} 이미지 빌드 및 푸시 완료: ${full_image_name}"
    
    return 0
}

# Kubernetes 매니페스트 업데이트
update_k8s_manifests() {
    local tenant_id=${1:-"default"}
    local namespace="${tenant_id}-ecp-ai"
    
    log_info "📝 Kubernetes 매니페스트 업데이트 중... (테넌시: ${tenant_id})"
    
    # 이미지 정보 파일들 읽기
    if [ ! -d ".ci-cd-images" ]; then
        log_error ".ci-cd-images 디렉토리가 없습니다. 이미지 빌드를 먼저 실행하세요."
        return 1
    fi
    
    # 각 서비스별 매니페스트 업데이트
    local services=("callbot" "chatbot" "advisor" "stt-server" "tts-server" "nlp-server" "aicm-server")
    
    for service in "${services[@]}"; do
        local image_file=".ci-cd-images/${service}.txt"
        if [ -f "$image_file" ]; then
            local image_name=$(cat "$image_file")
            update_deployment_manifest "$service" "$image_name" "$namespace"
        fi
    done
    
    log_success "Kubernetes 매니페스트 업데이트 완료"
}

# Deployment 매니페스트 업데이트
update_deployment_manifest() {
    local service_name=$1
    local image_name=$2
    local namespace=$3
    local manifest_file="${K8S_MANIFESTS_DIR}/${service_name}-deployment.yaml"
    
    if [ ! -f "$manifest_file" ]; then
        log_warning "매니페스트 파일이 없습니다: ${manifest_file}"
        return 0
    fi
    
    log_info "🔄 ${service_name} Deployment 매니페스트 업데이트 중..."
    
    # 이미지 태그 업데이트
    sed -i.bak "s|image: .*${service_name}:.*|image: ${image_name}|g" "$manifest_file"
    
    # 백업 파일 제거
    rm -f "${manifest_file}.bak"
    
    log_success "${service_name} Deployment 매니페스트 업데이트 완료"
}

# 매니페스트 검증
validate_manifests() {
    log_info "🔍 Kubernetes 매니페스트 검증 중..."
    
    # kubectl apply --dry-run으로 검증
    for manifest_file in ${K8S_MANIFESTS_DIR}/*.yaml; do
        if [ -f "$manifest_file" ]; then
            log_info "검증 중: ${manifest_file}"
            kubectl apply --dry-run=client -f "$manifest_file" || {
                log_error "매니페스트 검증 실패: ${manifest_file}"
                return 1
            }
        fi
    done
    
    log_success "모든 매니페스트 검증 완료"
}

# Git 태그 생성
create_git_tag() {
    local version_tag=$(generate_image_tag "version")
    
    log_info "🏷️ Git 태그 생성 중: ${version_tag}"
    
    git tag -a "$version_tag" -m "CI/CD 배포: ${version_tag}"
    git push origin "$version_tag"
    
    log_success "Git 태그 생성 완료: ${version_tag}"
}

# 메인 실행 함수
main() {
    local action=${1:-"build"}
    local tenant_id=${2:-"default"}
    
    log_info "🚀 ECP-AI CI/CD 파이프라인 시작"
    log_info "액션: ${action}, 테넌시: ${tenant_id}"
    
    # 필요한 디렉토리 생성
    mkdir -p ".ci-cd-images"
    mkdir -p "logs"
    
    case "$action" in
        "build")
            # 모든 서비스 이미지 빌드
            build_and_push_image "callbot" "backend/Dockerfile"
            build_and_push_image "chatbot" "backend/Dockerfile"
            build_and_push_image "advisor" "backend/Dockerfile"
            build_and_push_image "stt-server" "backend/Dockerfile"
            build_and_push_image "tts-server" "backend/Dockerfile"
            build_and_push_image "nlp-server" "backend/Dockerfile"
            build_and_push_image "aicm-server" "backend/Dockerfile"
            ;;
        "update-manifests")
            # K8s 매니페스트 업데이트
            update_k8s_manifests "$tenant_id"
            ;;
        "validate")
            # 매니페스트 검증
            validate_manifests
            ;;
        "deploy")
            # 전체 파이프라인 실행
            main "build"
            main "update-manifests" "$tenant_id"
            main "validate"
            create_git_tag
            ;;
        *)
            log_error "알 수 없는 액션: ${action}"
            echo "사용법: $0 [build|update-manifests|validate|deploy] [tenant_id]"
            exit 1
            ;;
    esac
    
    log_success "🎉 CI/CD 파이프라인 완료!"
}

# 스크립트 실행
main "$@"
