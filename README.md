# ECP-AI Kubernetes Orchestrator

> 🚀 **실사용 환경을 위한 AI 서비스 Kubernetes 자동 배포 및 관리 솔루션**

ECP-AI Kubernetes Orchestrator는 AI 서비스(콜봇, 챗봇, NLP 등)를 Kubernetes 클러스터에 자동으로 배포하고 관리하는 엔터프라이즈급 솔루션입니다.

## 📋 주요 기능

### 🎯 **AI 서비스 자동 배포**
- 콜봇, 챗봇, STT/TTS, NLP, AI 어드바이저 등 AI 서비스 자동 배포
- 서비스 요구사항 기반 최적 리소스 자동 계산
- GPU/CPU 리소스 최적화 및 자동 스케일링

### 🔄 **데모/실사용 모드 분리**
- **데모 모드**: 개발 및 테스트용 가상 환경
- **실사용 모드**: 운영 환경용 실제 Kubernetes 클러스터 연동
- 완전한 데이터베이스 분리로 안전한 환경 관리

### 📊 **실시간 모니터링**
- Prometheus/Grafana 기반 메트릭 수집
- 실시간 리소스 사용률 모니터링
- 커스텀 비즈니스 메트릭 지원
- WebSocket 기반 실시간 알림

### 🛠️ **매니페스트 자동 생성**
- Kubernetes YAML 매니페스트 자동 생성
- 검증 및 최적화 기능 내장
- GitOps 워크플로우 지원
- 직접 배포 또는 CI/CD 연동

## 🏗️ 시스템 아키텍처

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend UI   │───▶│   Backend API   │───▶│  Kubernetes     │
│   (React)       │    │   (FastAPI)     │    │  Cluster        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Demo Database   │    │ Production DB   │    │  Monitoring     │
│ (PostgreSQL)    │    │ (PostgreSQL)    │    │  (Prometheus)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 빠른 시작

### 개발 환경 (Docker Compose)

```bash
# 1. 프로젝트 클론
git clone <repository-url>
cd ecp-ai-k8s-orchestrator

# 2. 환경 설정
cp .env.example .env
# .env 파일 수정

# 3. 전체 시스템 실행 (ECP Orchestrator + K8S Simulator 통합)
docker-compose up -d

# 4. 접속
# ECP Frontend: http://localhost:3000
# ECP Backend API: http://localhost:8001
# ECP API 문서: http://localhost:8001/docs
# K8S Simulator: http://localhost:6390
# K8S Simulator API: http://localhost:6360
```

### 운영 환경 배포

운영 환경 배포는 [운영 환경 통합 가이드](docs/Production-Integration-Guide.md)를 참조하세요.

## 📚 문서

### 📖 **통합 가이드**
- **[통합 가이드](docs/ECP-AI-K8s-Orchestrator-Integration-Guide.md)**: 전체 시스템 개요 및 기본 사용법
- **[운영 환경 가이드](docs/Production-Integration-Guide.md)**: 실사용 환경 구축 및 운영 가이드
- **[API 참조서](docs/API-Reference.md)**: 완전한 REST API 문서

### 🛠️ **개발자 리소스**
- **[Python 클라이언트](examples/python-client.py)**: 개발용 Python SDK 예제
- **[운영 클라이언트](examples/production-client.py)**: 실사용 환경용 Python 클라이언트

## 🔧 주요 컴포넌트

### Backend (FastAPI)
- **REST API**: 테넌트 관리, 모니터링, 배포 API
- **WebSocket**: 실시간 모니터링 및 배포 상태
- **Database Manager**: 데모/실사용 DB 자동 선택
- **Kubernetes Integration**: 직접 클러스터 연동

### Frontend (React + TypeScript)
- **모드 선택**: 초기 데모/실사용 모드 선택
- **테넌트 관리**: 생성, 수정, 삭제, 스케일링
- **실시간 대시보드**: 메트릭 시각화
- **매니페스트 다운로드**: YAML 파일 생성 및 다운로드

### 데이터베이스
- **PostgreSQL**: 테넌트 정보, 서비스 설정, 모니터링 데이터
- **Redis**: 캐싱, 세션 관리, 실시간 데이터

## 🎯 사용 시나리오

### 1. AI 콜센터 서비스 배포
```python
from ecp_orchestrator import ProductionECPClient

client = ProductionECPClient(
    api_url="https://api.your-company.com/api/v1",
    auth_token="your-jwt-token"
)

# 테넌트 설정
config = TenantConfig(
    tenant_id="ai-call-center-prod",
    name="AI 콜센터 운영",
    service_requirements={
        "callbot": 100,    # 동시 콜봇 세션
        "chatbot": 200,    # 동시 챗봇 세션
        "advisor": 50,     # 상담사 지원 세션
        "stt": 100,       # 음성인식
        "tts": 100        # 음성합성
    },
    sla_target={
        "availability": "99.95%",
        "response_time": "150ms"
    }
)

# 배포 실행
result = client.create_tenant(config)
client.wait_for_deployment(config.tenant_id)

# 매니페스트 생성 및 다운로드
manifest = client.generate_production_manifest(config.tenant_id)
```

### 2. 실시간 모니터링 연동
```python
# 커스텀 메트릭 전송
metrics = {
    "active_calls": 156,
    "queue_length": 23,
    "customer_satisfaction": 4.7
}
client.send_custom_metrics(tenant_id, metrics)

# 실시간 모니터링 구독
def monitoring_callback(data):
    print(f"CPU: {data['cpu']}%, Memory: {data['memory']}%")

client.start_realtime_monitoring(tenant_id, monitoring_callback)
```

### 3. 자동 스케일링
```python
# 트래픽 증가 시 자동 확장
new_requirements = {
    "callbot": 150,  # 50% 증가
    "chatbot": 300   # 50% 증가
}

client.scale_tenant(tenant_id, new_requirements)
```

## 🔌 연동 방법

### 모니터링 데이터 연결

#### Prometheus 메트릭 수집
```yaml
# prometheus.yml
scrape_configs:
- job_name: 'ecp-orchestrator'
  static_configs:
  - targets: ['api.your-company.com:8001']
  metrics_path: '/metrics'
```

#### 커스텀 메트릭 전송
```python
# 비즈니스 메트릭 전송
response = requests.post(
    f"{api_url}/tenants/{tenant_id}/monitoring",
    headers={"X-Demo-Mode": "false"},
    json={
        "timestamp": datetime.utcnow().isoformat(),
        "metrics": {
            "business_calls_completed": 1250,
            "customer_satisfaction": 4.8,
            "revenue_generated": 15000.50
        }
    }
)
```

### 매니페스트 생성 및 배포

#### 매니페스트 다운로드
```bash
# REST API로 매니페스트 다운로드
curl -H "X-Demo-Mode: false" \
     -H "Authorization: Bearer $TOKEN" \
     -o production-manifest.yaml \
     "https://api.your-company.com/api/v1/tenants/my-service/manifest"

# Kubernetes에 배포
kubectl apply -f production-manifest.yaml
```

#### GitOps 워크플로우
```yaml
# GitHub Actions
- name: Deploy Tenant
  run: |
    curl -H "X-Demo-Mode: false" \
         -o manifest.yaml \
         "${{ secrets.ECP_API_URL }}/tenants/${{ github.event.inputs.tenant_id }}/manifest"
    kubectl apply -f manifest.yaml
```

## 🔒 보안 및 인증

### JWT 토큰 기반 인증
```http
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
X-Demo-Mode: false
```

### 역할 기반 접근 제어 (RBAC)
- **tenant_admin**: 테넌트 생성, 수정, 삭제
- **tenant_operator**: 테넌트 모니터링, 스케일링
- **tenant_viewer**: 읽기 전용 접근

### 네트워크 보안
- TLS/HTTPS 강제
- Kubernetes NetworkPolicy 적용
- 방화벽 규칙 설정

## 📊 모니터링 및 알림

### 메트릭 종류
- **시스템 메트릭**: CPU, 메모리, GPU, 네트워크, 스토리지
- **애플리케이션 메트릭**: 요청 수, 응답 시간, 에러율
- **비즈니스 메트릭**: 활성 세션, 고객 만족도, 매출

### 알림 채널
- **Slack**: 실시간 알림
- **Email**: 중요 이벤트 알림
- **Webhook**: 커스텀 통합
- **PagerDuty**: 장애 대응

## 🛠️ 개발 및 기여

### 개발 환경 설정
```bash
# Backend 개발
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend 개발
cd frontend/developer-ui
npm install
npm start
```

### 테스트 실행
```bash
# Backend 테스트
cd backend
pytest tests/

# Frontend 테스트
cd frontend/developer-ui
npm test
```

## 📈 성능 및 확장성

### 확장성
- **수평 확장**: 여러 인스턴스 실행 가능
- **데이터베이스**: PostgreSQL HA 클러스터 지원
- **캐싱**: Redis 클러스터 지원
- **로드밸런싱**: NGINX, HAProxy 지원

### 성능 최적화
- **API 캐싱**: Redis 기반 응답 캐싱
- **데이터베이스 최적화**: 인덱싱, 파티셔닝
- **연결 풀링**: 데이터베이스 연결 최적화

## 🆘 지원 및 문의

### 기술 지원
- **문서**: `/docs` 디렉토리의 상세 가이드
- **API 문서**: http://localhost:8001/docs (Swagger UI)
- **예제 코드**: `/examples` 디렉토리

### 문제 해결
- **로그 확인**: `docker-compose logs <service>`
- **상태 확인**: `docker-compose ps`
- **데이터베이스 연결**: `docker-compose exec postgres psql -U ecp_user`

### 일반적인 문제
1. **포트 충돌**: docker-compose.yml의 포트 번호 변경
2. **데이터베이스 연결 실패**: 컨테이너 재시작 후 재시도
3. **권한 오류**: RBAC 설정 확인

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 🔄 버전 정보

- **현재 버전**: v1.51
- **최신 업데이트**: 데모/실사용 DB 분리, 실시간 모니터링 개선
- **다음 계획**: Kubernetes Operator 개발, Multi-cluster 지원

---

**ECP-AI Kubernetes Orchestrator**로 AI 서비스 배포를 자동화하고, 운영을 간소화하세요! 🚀