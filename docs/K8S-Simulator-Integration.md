# ECP-AI Orchestrator + K8S Deployment Simulator 통합 가이드

## 📋 개요

ECP-AI Kubernetes Orchestrator에 K8S Deployment Simulator가 통합되어 **매니페스트 검증 → 시뮬레이터 배포 → SLA 99.5% 모니터링 → 테넌트 솔루션 기동 확인**의 완전한 워크플로우를 제공합니다.

## 🏗️ 통합 아키텍처

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   ECP Frontend  │    │   ECP Backend   │    │  K8S Simulator  │
│   Port: 3000    │◄──►│   Port: 8001    │◄──►│   Port: 6360    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ ECP Production  │    │   ECP Demo DB   │    │ Simulator DB    │
│ DB (Port 5433)  │    │  (Port 5434)    │    │ (Port 6350)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   ECP Redis     │    │ Simulator Redis │
                       │  (Port 6380)    │    │ (Port 6351)     │
                       └─────────────────┘    └─────────────────┘
```

## 🔗 서비스 포트 매핑

| 서비스 | ECP Orchestrator | K8S Simulator | 설명 |
|--------|------------------|---------------|------|
| Frontend | 3000 | 6370 | 웹 UI |
| Backend API | 8001 | 6360 | REST API |
| Database | 5433/5434 | 6350 | PostgreSQL |
| Redis | 6380 | 6351 | 캐시 및 실시간 데이터 |
| Monitoring | 9090/3001 | 6380 | 메트릭 수집 |
| Nginx | 80 | 6390 | 리버스 프록시 |

## 🚀 통합 실행

### 1. 전체 시스템 시작
```bash
# ECP Orchestrator + K8S Simulator 통합 실행
docker-compose up -d

# 서비스 상태 확인
docker-compose ps
```

### 2. 서비스 접속
```bash
# ECP-AI Orchestrator
- Frontend: http://localhost:3000
- Backend API: http://localhost:8001
- API 문서: http://localhost:8001/docs

# K8S Deployment Simulator  
- Dashboard: http://localhost:6390
- Backend API: http://localhost:6360
- Monitoring: http://localhost:6380
```

### 3. 개별 서비스 관리
```bash
# ECP 서비스만 시작
docker-compose up -d backend frontend postgres postgres-demo redis

# K8S Simulator 서비스만 시작
docker-compose up -d k8s-simulator-backend k8s-simulator-frontend k8s-simulator-postgres k8s-simulator-redis

# 특정 서비스 재시작
docker-compose restart k8s-simulator-backend
```

## 🔄 통합 워크플로우

### Phase 1: 매니페스트 엄격한 검증
```python
# ECP Orchestrator에서 매니페스트 생성
POST /api/v1/tenants/{tenant_id}/manifest

# 검증 API 호출
POST /api/v1/tenants/validate-manifest
{
    "tenant_id": "my-ai-service",
    "manifest_content": "apiVersion: v1\nkind: Namespace\n...",
    "strict_validation": true,
    "target_simulator": true
}

# 응답
{
    "valid": true,
    "warnings": [],
    "errors": [],
    "simulator_compatible": true,
    "resource_summary": {...}
}
```

### Phase 2: K8S Simulator 배포
```python
# 시뮬레이터에 배포
POST /api/v1/simulator/deploy/{tenant_id}
{
    "include_monitoring": true,
    "enable_sla_tracking": true,
    "failure_scenarios": false
}

# 응답
{
    "status": "success",
    "deployment_id": "sim-deploy-123",
    "simulator_dashboard": "http://localhost:6390/dashboard/my-ai-service",
    "resources_count": 15,
    "sla_monitoring": true
}
```

### Phase 3: SLA 99.5% 모니터링
```python
# 실시간 모니터링 시작
WebSocket: ws://localhost:8001/api/v1/simulator/realtime/{tenant_id}

# 메트릭 데이터 수신
{
    "timestamp": "2024-01-20T14:30:00Z",
    "tenant_id": "my-ai-service",
    "metrics": {
        "cpu": 65.5,
        "memory": 78.2,
        "network_rps": 1250,
        "response_time": 145.8,
        "error_rate": 0.02
    },
    "sla_data": {
        "availability": 99.7,
        "status": "meeting",
        "uptime_percentage": 99.7,
        "downtime_minutes": 4.3
    }
}
```

### Phase 4: 테넌트 솔루션 기동 확인
```python
# 배포 상태 확인
GET /api/v1/simulator/status

# SLA 분석 데이터
GET /api/v1/simulator/sla/{tenant_id}/analysis?period=24h
{
    "tenant_id": "my-ai-service",
    "current_sla": 99.7,
    "target_sla": 99.5,
    "status": "meeting",
    "uptime_percentage": 99.7,
    "failure_count": 2,
    "recovery_time_avg": 125.5
}
```

## 🔧 설정 및 연동

### ECP 설정 탭에서 시뮬레이터 연동 설정
```typescript
// Kubernetes 설정
{
    deploymentMethod: "k8s-simulator",
    deploymentEndpoint: "http://localhost:6360",
    simulatorUrl: "http://localhost:6390",
    validationStrict: true
}

// 모니터링 설정  
{
    monitoringStack: "custom",
    customApiEndpoint: "http://localhost:6360/api/metrics",
    slaTarget: 99.5,
    realTimeMonitoring: true,
    dataCollectionInterval: 5
}
```

### 환경 변수 설정
```bash
# ECP Backend 환경변수
K8S_SIMULATOR_URL=http://k8s-simulator-backend:8000
K8S_SIMULATOR_WS_URL=ws://k8s-simulator-backend:8000  
K8S_SIMULATOR_REDIS_URL=redis://k8s-simulator-redis:6379
K8S_SIMULATOR_EXTERNAL_URL=http://localhost:6360
```

## 📊 모니터링 데이터 연동

### 1. ECP → Simulator 메트릭 전송
```python
# ECP에서 생성한 비즈니스 메트릭을 시뮬레이터로 전송
POST http://localhost:6360/api/v1/external-metrics
{
    "tenant_id": "my-ai-service",
    "source": "ecp-orchestrator",
    "metrics": {
        "business_requests": 1250,
        "active_sessions": 85,
        "revenue": 15000.50
    }
}
```

### 2. Simulator → ECP 메트릭 수신
```python
# 시뮬레이터의 SLA 메트릭을 ECP DB에 저장
GET http://localhost:6360/api/v1/metrics/{tenant_id}

# ECP MonitoringData 테이블에 저장
{
    "tenant_id": tenant_id,
    "metric_type": "sla", 
    "metric_name": "availability",
    "metric_value": 99.7,
    "data_source": "k8s-simulator"
}
```

### 3. 실시간 데이터 스트리밍
```python
# WebSocket을 통한 양방향 데이터 스트리밍
ECP ←→ K8S Simulator

# 데이터 플로우
1. ECP에서 매니페스트 생성
2. Simulator에서 배포 및 모니터링 시작
3. 실시간 메트릭 데이터 ECP로 전송
4. ECP에서 SLA 분석 및 알림 처리
```

## 🧪 테스트 시나리오

### 1. 매니페스트 검증 테스트
```bash
# 올바른 매니페스트
curl -X POST "http://localhost:8001/api/v1/tenants/validate-manifest" \
  -H "Content-Type: application/json" \
  -d @valid-manifest.json

# 잘못된 매니페스트  
curl -X POST "http://localhost:8001/api/v1/tenants/validate-manifest" \
  -H "Content-Type: application/json" \
  -d @invalid-manifest.json
```

### 2. 시뮬레이터 배포 테스트
```bash
# 테넌트 생성 및 시뮬레이터 배포
curl -X POST "http://localhost:8001/api/v1/simulator/deploy/test-tenant" \
  -H "Content-Type: application/json" \
  -d '{"include_monitoring": true, "enable_sla_tracking": true}'
```

### 3. 장애 시나리오 테스트
```bash
# CPU 스파이크 장애 시뮬레이션
curl -X POST "http://localhost:8001/api/v1/simulator/failures/test-tenant/trigger" \
  -H "Content-Type: application/json" \
  -d '{"failure_type": "cpu_spike"}'
```

## 🔍 모니터링 및 로그

### 로그 확인
```bash
# ECP 서비스 로그
docker-compose logs -f backend

# K8S Simulator 로그  
docker-compose logs -f k8s-simulator-backend

# 전체 시스템 로그
docker-compose logs -f
```

### 메트릭 확인
```bash
# ECP 메트릭
curl http://localhost:8001/metrics

# Simulator 메트릭
curl http://localhost:6360/api/v1/metrics/system

# 통합 상태
curl http://localhost:8001/api/v1/simulator/status
```

## 🚨 문제 해결

### 일반적인 문제

**1. 포트 충돌**
```bash
# 포트 사용 확인
lsof -i :6350-6390

# 서비스 재시작
docker-compose down
docker-compose up -d
```

**2. 데이터베이스 연결 오류**
```bash
# DB 상태 확인
docker-compose exec k8s-simulator-postgres pg_isready -U k8s_user

# 연결 테스트
docker-compose exec k8s-simulator-backend curl http://localhost:8000/health
```

**3. 시뮬레이터 연동 실패**
```bash
# 네트워크 확인
docker network ls
docker network inspect ecp-ai-k8s-orchestrator_ecp-network

# 서비스 간 통신 테스트
docker-compose exec backend curl http://k8s-simulator-backend:8000/health
```

### 개발 모드 실행

**ECP 개발 모드:**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

cd frontend/developer-ui  
npm install
npm start
```

**K8S Simulator 개발 모드:**
```bash
cd k8s-simulator/backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 6360 --reload

cd k8s-simulator/frontend
npm install  
npm start
```

## 📚 API 문서

### ECP Orchestrator API
- **Swagger UI**: http://localhost:8001/docs
- **ReDoc**: http://localhost:8001/redoc

### K8S Simulator API  
- **API 엔드포인트**: http://localhost:6360/docs
- **통합 API**: http://localhost:8001/api/v1/simulator/*

---

**ECP-AI Kubernetes Orchestrator + K8S Deployment Simulator 통합**으로 완전한 AI 서비스 배포 및 SLA 99.5% 모니터링 솔루션을 제공합니다! 🚀
