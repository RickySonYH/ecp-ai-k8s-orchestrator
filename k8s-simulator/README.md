# 🚀 K8S 배포 시뮬레이터 (K8S Deployment Simulator)

[![Docker](https://img.shields.io/badge/Docker-Ready-blue?logo=docker)](https://www.docker.com/)
[![Python](https://img.shields.io/badge/Python-3.11+-green?logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-Latest-red?logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18+-blue?logo=react)](https://reactjs.org/)

실제 쿠버네티스 클러스터 없이도 K8S 매니페스트 배포와 모니터링을 시뮬레이션할 수 있는 완전한 솔루션입니다.

## 📋 목차

- [주요 기능](#-주요-기능)
- [시스템 아키텍처](#-시스템-아키텍처)
- [빠른 시작](#-빠른-시작)
- [API 문서](#-api-문서)
- [프론트엔드 사용법](#-프론트엔드-사용법)
- [상위 시스템 연동](#-상위-시스템-연동)
- [개발 가이드](#-개발-가이드)
- [트러블슈팅](#-트러블슈팅)

## 🎯 주요 기능

### K8S 시뮬레이터
- **매니페스트 파싱**: YAML 매니페스트 파일 분석 및 검증
- **가상 배포**: Pod, Service, Deployment 등 K8S 리소스 시뮬레이션
- **배포 프로세스**: 실제 K8S 배포와 유사한 과정 재현 (2-8초 배포 시간)
- **리소스 상태 관리**: Running, Pending, Failed 등 실시간 상태 추적

### SLA 99.5% 모니터링
- **실시간 메트릭**: CPU, Memory, Disk, Network 사용률 모니터링
- **실제 서버 데이터 모사**: 시간대별, 요일별 트래픽 패턴 시뮬레이션
- **SLA 계산**: 실시간 가용성 계산 및 99.5% 목표 달성 현황
- **장애 시나리오**: 자동 장애 발생 및 복구 시뮬레이션

### 통합 대시보드
- **실시간 모니터링**: WebSocket 기반 실시간 데이터 업데이트
- **메트릭 차트**: 다양한 성능 지표의 시각화
- **알림 시스템**: 임계값 기반 알림 및 히스토리 관리
- **SLA 리포트**: 일/주/월별 SLA 달성 현황 리포트

## 🏗️ 시스템 아키텍처

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Monitoring    │
│   (React/HTML)  │◄──►│   (FastAPI)     │◄──►│   Generator     │
│   Port: 6370    │    │   Port: 6360    │    │   Port: 6381    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Simple Frontend │    │ PostgreSQL DB   │    │  Redis Cache    │
│ (simple.html)   │    │ Port: 6350      │    │  Port: 6351     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 빠른 시작

### 1. 시스템 요구사항
- Docker & Docker Compose
- Git
- 포트: 6350, 6351, 6360, 6370, 6381, 6390

### 2. 설치 및 실행

```bash
# 1. 프로젝트 클론
git clone https://github.com/your-username/K8S-배포시뮬레이터.git
cd K8S-배포시뮬레이터

# 2. 전체 시스템 실행
docker-compose up -d

# 3. 서비스 상태 확인
docker-compose ps
```

### 3. 접속 정보

| 서비스 | URL | 설명 |
|--------|-----|------|
| **Simple Frontend** | `file://./simple_frontend.html` | 간단한 HTML 대시보드 |
| **Backend API** | http://localhost:6360 | REST API 서버 |
| **API 문서** | http://localhost:6360/docs | Swagger UI |
| **모니터링** | http://localhost:6381 | 모니터링 생성기 |
| **Nginx Proxy** | http://localhost:6390 | 프록시 서버 |

## 📡 API 문서

### 매니페스트 관련 API

#### 매니페스트 파싱
```http
POST /k8s/manifest/parse
Content-Type: application/json

{
  "manifest": "apiVersion: v1\nkind: Pod\nmetadata:\n  name: test-pod"
}
```

#### 매니페스트 배포
```http
POST /k8s/manifest/deploy
Content-Type: application/json

{
  "manifest": "apiVersion: apps/v1\nkind: Deployment\n..."
}
```

#### 리소스 조회
```http
GET /k8s/resources
GET /k8s/resources?namespace=default&kind=Pod
```

### 모니터링 API

#### 실시간 상태 조회
```http
GET /monitoring/health
```

#### SLA 상태 확인
```http
GET /sla/status
```

#### WebSocket 실시간 스트리밍
```javascript
const ws = new WebSocket('ws://localhost:6360/ws/monitoring');
```

## 🖥️ 프론트엔드 사용법

### Simple HTML Frontend

브라우저에서 `simple_frontend.html`을 열어 사용:

1. **매니페스트 배포**
   - YAML 매니페스트 입력
   - 파싱 및 검증
   - 가상 클러스터에 배포

2. **실시간 모니터링**
   - CPU, Memory, Network 메트릭
   - SLA 99.5% 달성 현황
   - 5초마다 자동 업데이트

3. **리소스 관리**
   - 배포된 리소스 목록
   - 상태별 필터링
   - 리소스 상세 정보

### React Frontend (개발 중)

React 기반 고급 대시보드는 의존성 문제로 현재 개발 중입니다.

## 🔗 상위 시스템 연동

### ECP-AI Kubernetes Orchestrator 연동

상위 시스템에서 다음과 같이 연동 가능:

```python
# Python 클라이언트 예시
import requests

class K8sSimulatorClient:
    def __init__(self, base_url="http://localhost:6360"):
        self.base_url = base_url
    
    def deploy_manifest(self, manifest_content):
        response = requests.post(
            f"{self.base_url}/k8s/manifest/deploy",
            json={"manifest": manifest_content}
        )
        return response.json()
    
    def get_monitoring_data(self):
        response = requests.get(f"{self.base_url}/monitoring/health")
        return response.json()

# 사용 예시
client = K8sSimulatorClient()
result = client.deploy_manifest(your_manifest)
monitoring = client.get_monitoring_data()
```

### 연동 가이드

자세한 연동 방법은 [K8S_SIMULATOR_연동가이드.md](./K8S_SIMULATOR_연동가이드.md)를 참조하세요.

## 🛠️ 개발 가이드

### 로컬 개발 환경

```bash
# 백엔드 개발
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 6360

# 프론트엔드 개발 (React)
cd frontend
npm install
npm start
```

### 프로젝트 구조

```
K8S-배포시뮬레이터/
├── backend/                 # FastAPI 백엔드
│   ├── api/                # API 라우터
│   ├── core/               # 핵심 로직
│   │   ├── k8s_simulator.py      # K8S 시뮬레이터
│   │   ├── monitoring_engine.py  # 모니터링 엔진
│   │   └── database.py           # 데이터베이스 모델
│   └── main.py             # 메인 애플리케이션
├── frontend/               # React 프론트엔드
│   ├── src/
│   │   ├── components/     # React 컴포넌트
│   │   └── hooks/         # 커스텀 훅
│   └── package.json
├── simple_frontend.html    # 간단한 HTML 대시보드
├── docker-compose.yml      # Docker Compose 설정
├── K8S_SIMULATOR_연동가이드.md  # 상위 시스템 연동 가이드
└── README.md              # 프로젝트 문서
```

### 환경 변수

```bash
# .env 파일 예시
DATABASE_URL=postgresql://user:password@localhost:6350/simulator
REDIS_URL=redis://localhost:6351/0
LOG_LEVEL=INFO
```

## 📊 모니터링 메트릭

시뮬레이터가 생성하는 주요 메트릭:

- **CPU 사용률**: 시간대별 패턴 (업무시간 vs 야간)
- **메모리 사용률**: 서비스별 메모리 소비 패턴
- **네트워크 I/O**: RPS, 응답시간, 에러율
- **디스크 I/O**: 읽기/쓰기 속도
- **SLA 메트릭**: 가용성, MTTR, 장애 빈도

## ❗ 트러블슈팅

### 일반적인 문제

**1. 포트 충돌**
```bash
# 사용 중인 포트 확인
netstat -tulpn | grep :6360

# Docker 컨테이너 재시작
docker-compose restart backend
```

**2. 의존성 문제**
```bash
# Docker 이미지 재빌드
docker-compose build --no-cache
docker-compose up -d
```

**3. 데이터베이스 연결 실패**
```bash
# 데이터베이스 컨테이너 로그 확인
docker-compose logs postgres

# 데이터베이스 재시작
docker-compose restart postgres
```

**4. WebSocket 연결 실패**
- 브라우저에서 혼합 콘텐츠(HTTPS/HTTP) 문제 확인
- CORS 설정 확인
- 방화벽 설정 확인

### 로그 확인

```bash
# 전체 로그 확인
docker-compose logs

# 특정 서비스 로그
docker-compose logs backend
docker-compose logs postgres

# 실시간 로그 추적
docker-compose logs -f backend
```

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 📞 지원 및 문의

- **이슈 리포트**: [GitHub Issues](https://github.com/your-username/K8S-배포시뮬레이터/issues)
- **문서**: [Wiki](https://github.com/your-username/K8S-배포시뮬레이터/wiki)
- **API 문서**: http://localhost:6360/docs

---

**🎯 현재 SLA 달성률: 99.972% (목표 99.5% 달성!)**

*이 프로젝트는 실제 운영 환경에서의 K8S 배포 테스트와 모니터링 시뮬레이션을 위해 개발되었습니다.*