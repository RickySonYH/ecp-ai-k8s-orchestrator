# ECP-AI CI/CD 파이프라인 및 이미지 버전 추적 시스템

## 📋 개요

이 시스템은 ECP-AI Kubernetes Orchestrator의 CI/CD 파이프라인과 이미지 버전 추적을 자동화하여, 빌드된 이미지와 Kubernetes 매니페스트 간의 일치성을 보장합니다.

## 🚀 주요 기능

### 1. CI/CD 파이프라인 자동화
- **이미지 빌드 및 태그 생성**: Git commit hash 기반 자동 태그 생성
- **매니페스트 자동 업데이트**: 빌드된 이미지 태그를 K8s 매니페스트에 자동 반영
- **배포 검증**: kubectl --dry-run을 통한 매니페스트 유효성 검증
- **Git 태그 관리**: 배포 완료 시 자동 Git 태그 생성

### 2. 이미지 버전 추적
- **버전 히스토리**: 모든 이미지 빌드 및 배포 기록 관리
- **보안 스캔 결과**: 이미지 보안 취약점 정보 추적
- **롤백 지원**: 이전 안정 버전으로의 롤백 기능
- **메타데이터 관리**: Git 브랜치, 커밋 정보 등 상세 정보 저장

### 3. 배포 상태 모니터링
- **실시간 모니터링**: Kubernetes 배포 상태 30초마다 체크
- **버전 일치성 검증**: 실제 배포된 이미지와 매니페스트 버전 비교
- **자동 롤백**: 배포 실패 시 자동 롤백 (설정 가능)
- **헬스 메트릭**: 배포 성공률 및 성능 지표 수집

## 🛠️ 설치 및 설정

### 1. 필수 요구사항
```bash
# Docker 및 kubectl 설치 확인
docker --version
kubectl version --client

# Git 저장소 클론
git clone <repository-url>
cd ecp-ai-k8s-orchestrator
```

### 2. 환경 변수 설정
```bash
# .env 파일 생성 또는 환경 변수 설정
export DOCKER_REGISTRY="localhost:5000"  # Docker 레지스트리 URL
export IMAGE_PREFIX="ecp-ai"             # 이미지 이름 접두사
export K8S_MANIFESTS_DIR="k8s-manifests" # K8s 매니페스트 디렉토리
```

### 3. 권한 설정
```bash
# CI/CD 스크립트 실행 권한 부여
chmod +x scripts/ci-cd-pipeline.sh
```

## 📖 사용법

### 1. CI/CD 파이프라인 실행

#### 전체 파이프라인 실행 (빌드 → 매니페스트 업데이트 → 검증 → Git 태그)
```bash
./scripts/ci-cd-pipeline.sh deploy <tenant_id>
```

#### 단계별 실행
```bash
# 1단계: 이미지 빌드 및 푸시
./scripts/ci-cd-pipeline.sh build

# 2단계: K8s 매니페스트 업데이트
./scripts/ci-cd-pipeline.sh update-manifests <tenant_id>

# 3단계: 매니페스트 검증
./scripts/ci-cd-pipeline.sh validate
```

### 2. 이미지 버전 관리

#### 새 이미지 버전 등록
```bash
curl -X POST "http://localhost:8000/api/v1/image-management/versions/register" \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "callbot",
    "image_name": "callbot",
    "image_tag": "v1.2.3-abc123",
    "full_image_name": "localhost:5000/ecp-ai/callbot:v1.2.3-abc123",
    "git_commit": "abc123",
    "git_branch": "main"
  }'
```

#### 이미지 버전 목록 조회
```bash
curl "http://localhost:8000/api/v1/image-management/versions/callbot?limit=10"
```

#### 이미지 상태 업데이트
```bash
curl -X PUT "http://localhost:8000/api/v1/image-management/versions/callbot-v1.2.3-abc123-1234567890/status" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "ready",
    "security_scan_result": "passed",
    "vulnerabilities_count": 0
  }'
```

### 3. 배포 모니터링

#### 배포 상태 헬스 체크
```bash
curl "http://localhost:8000/api/v1/image-management/deployments/health"
```

#### 배포 히스토리 조회
```bash
curl "http://localhost:8000/api/v1/image-management/deployments/test-download/history?service_name=callbot&limit=20"
```

#### 수동 롤백 실행
```bash
curl -X POST "http://localhost:8000/api/v1/image-management/deployments/test-download/callbot/rollback" \
  -H "Content-Type: application/json" \
  -d '{"reason": "성능 문제로 인한 롤백"}'
```

## 🔧 고급 설정

### 1. 이미지 태그 전략 커스터마이징

`scripts/ci-cd-pipeline.sh`의 `generate_image_tag()` 함수를 수정하여 태그 생성 규칙을 변경할 수 있습니다:

```bash
generate_image_tag() {
    local service_name=$1
    local git_commit=$(git rev-parse --short HEAD)
    local git_branch=$(git rev-parse --abbrev-ref HEAD | sed 's/[^a-zA-Z0-9]/-/g')
    local timestamp=$(date +%Y%m%d-%H%M%S)
    
    # 커스텀 태그 전략
    if [ "$git_branch" = "main" ]; then
        echo "stable-${git_commit}"
    elif [ "$git_branch" = "develop" ]; then
        echo "beta-${timestamp}-${git_commit}"
    else
        echo "dev-${git_branch}-${git_commit}"
    fi
}
```

### 2. 자동 롤백 정책 설정

`backend/app/core/deployment_monitor.py`의 `_should_auto_rollback()` 함수를 수정하여 자동 롤백 조건을 설정할 수 있습니다:

```python
def _should_auto_rollback(self, deployment_name: str, namespace: str) -> bool:
    """자동 롤백 여부 확인"""
    # 특정 서비스에 대해서만 자동 롤백 활성화
    auto_rollback_services = ["callbot", "chatbot", "advisor"]
    
    if deployment_name in auto_rollback_services:
        return True
    
    # 프로덕션 환경에서는 자동 롤백 비활성화
    if "prod" in namespace:
        return False
    
    return False
```

### 3. 모니터링 간격 조정

```python
class DeploymentMonitor:
    def __init__(self, k8s_orchestrator: K8sOrchestrator, 
                 image_tracker: ImageVersionTracker):
        # 모니터링 간격을 60초로 변경
        self.monitoring_interval = 60
```

## 📊 모니터링 및 대시보드

### 1. 배포 상태 대시보드

프론트엔드에서 다음 API를 호출하여 실시간 배포 상태를 모니터링할 수 있습니다:

- **전체 헬스 상태**: `/api/v1/image-management/deployments/health`
- **서비스별 메트릭**: `/api/v1/image-management/versions/{service_name}`
- **배포 히스토리**: `/api/v1/image-management/deployments/{tenant_id}/history`

### 2. 로그 모니터링

```bash
# 백엔드 로그 실시간 확인
docker-compose logs -f backend

# 특정 서비스 로그 확인
docker-compose logs -f ecp-backend

# 로그 레벨별 필터링
docker-compose logs backend | grep "ERROR"
```

## 🚨 문제 해결

### 1. 일반적인 문제들

#### 이미지 빌드 실패
```bash
# Docker 데몬 상태 확인
docker info

# 이미지 빌드 로그 확인
docker build --progress=plain -t test-image .
```

#### 매니페스트 검증 실패
```bash
# kubectl 연결 상태 확인
kubectl cluster-info

# 매니페스트 문법 검증
kubectl apply --dry-run=client -f k8s-manifests/
```

#### API 연결 실패
```bash
# 백엔드 서비스 상태 확인
curl http://localhost:8000/health

# 컨테이너 로그 확인
docker-compose logs backend
```

### 2. 디버깅 모드

```bash
# 상세 로그와 함께 파이프라인 실행
DEBUG=1 ./scripts/ci-cd-pipeline.sh deploy test-download

# 특정 단계만 디버깅
./scripts/ci-cd-pipeline.sh validate
```

## 🔒 보안 고려사항

### 1. 이미지 보안
- 모든 이미지는 보안 스캔을 거쳐야 함
- 취약점이 발견된 이미지는 배포 차단
- 정기적인 베이스 이미지 업데이트

### 2. 접근 제어
- CI/CD 파이프라인은 인증된 사용자만 실행 가능
- 프로덕션 환경 배포는 승인 프로세스 필수
- 롤백 작업은 감사 로그에 기록

### 3. 네트워크 보안
- 내부 네트워크에서만 Docker 레지스트리 접근 허용
- Kubernetes API 서버 접근 제한
- HTTPS를 통한 API 통신

## 📈 성능 최적화

### 1. 빌드 최적화
- Docker 레이어 캐싱 활용
- 멀티 스테이지 빌드로 이미지 크기 최소화
- 병렬 빌드로 전체 시간 단축

### 2. 모니터링 최적화
- 메트릭 캐싱으로 API 호출 최소화
- 배치 처리로 대량 데이터 효율적 처리
- 백그라운드 작업으로 응답 시간 개선

## 🤝 기여 및 개발

### 1. 개발 환경 설정
```bash
# 개발 의존성 설치
pip install -r requirements.txt

# 테스트 실행
pytest tests/

# 코드 품질 검사
flake8 backend/
black backend/
```

### 2. 새로운 기능 추가
1. 기능 요구사항 분석
2. API 엔드포인트 설계
3. 백엔드 로직 구현
4. 테스트 코드 작성
5. 문서 업데이트

## 📞 지원 및 문의

- **이슈 리포트**: GitHub Issues 사용
- **기술 문의**: 프로젝트 메인테이너에게 연락
- **문서 개선**: Pull Request 제출

---

**© 2024 ECP-AI Team. All rights reserved.**
