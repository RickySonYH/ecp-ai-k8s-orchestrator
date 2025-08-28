# ECP-AI Kubernetes Orchestrator 통합 가이드

## 📋 목차
1. [개요](#개요)
2. [시스템 아키텍처](#시스템-아키텍처)
3. [설치 및 설정](#설치-및-설정)
4. [API 연동 가이드](#api-연동-가이드)
5. [모니터링 데이터 연결](#모니터링-데이터-연결)
6. [매니페스트 생성 및 전달](#매니페스트-생성-및-전달)
7. [데이터베이스 연동](#데이터베이스-연동)
8. [실제 사용 시나리오](#실제-사용-시나리오)
9. [트러블슈팅](#트러블슈팅)

---

## 개요

ECP-AI Kubernetes Orchestrator는 AI 서비스를 위한 Kubernetes 클러스터 관리 및 자동 배포 솔루션입니다.

### 🎯 주요 기능
- **AI 서비스 자동 배포**: 콜봇, 챗봇, NLP 등 AI 서비스 자동 배포
- **리소스 최적화**: GPU/CPU 기반 자동 리소스 계산
- **모니터링 통합**: 실시간 리소스 모니터링 및 알림
- **매니페스트 자동 생성**: Kubernetes YAML 자동 생성 및 배포
- **데모/실사용 모드**: 개발과 운영 환경 완전 분리

### 🏗️ 시스템 구성
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

---

## 시스템 아키텍처

### 🔄 데이터 플로우
1. **사용자 요청** → Frontend UI
2. **API 호출** → Backend (모드 헤더 포함)
3. **DB 선택** → 데모/실사용 DB 자동 선택
4. **리소스 계산** → 하드웨어 계산기 서비스
5. **매니페스트 생성** → Kubernetes YAML 생성
6. **배포 실행** → Kubernetes 클러스터 배포
7. **모니터링** → 실시간 메트릭 수집

### 🏢 모드별 아키텍처

#### 데모 모드
```
Frontend ──X-Demo-Mode: true──▶ Backend ──▶ Demo DB (포트 5434)
                                   │
                                   ▼
                              가상 매니페스트 생성
```

#### 실사용 모드
```
Frontend ──X-Demo-Mode: false──▶ Backend ──▶ Production DB (포트 5433)
                                    │
                                    ▼
                               실제 K8s 클러스터 배포
```

---

## 설치 및 설정

### 🐳 Docker Compose 기반 설치

```bash
# 1. 프로젝트 클론
git clone <repository-url>
cd ecp-ai-k8s-orchestrator

# 2. 환경 변수 설정
cp .env.example .env
# 필요에 따라 .env 파일 수정

# 3. 전체 시스템 실행
docker-compose up -d

# 4. 서비스 상태 확인
docker-compose ps
```

### 🔧 개별 서비스 포트
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8001
- **Production DB**: localhost:5433
- **Demo DB**: localhost:5434
- **Redis**: localhost:6380
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001

### 📋 환경 변수 설정
```bash
# .env 파일 예시
DATABASE_URL=postgresql://ecp_user:ecp_password@postgres:5432/ecp_orchestrator
DEMO_DATABASE_URL=postgresql://ecp_demo_user:ecp_demo_password@postgres-demo:5432/ecp_orchestrator_demo
REDIS_URL=redis://redis:6379/0
KUBERNETES_CONFIG_PATH=/path/to/kubeconfig
MONITORING_ENDPOINT=http://prometheus:9090
```

---

## API 연동 가이드

### 🌐 Base URL
- **Development**: `http://localhost:8001/api/v1`
- **Production**: `https://your-domain.com/api/v1`

### 🔑 인증 헤더
모든 API 호출에 다음 헤더를 포함해야 합니다:
```http
Content-Type: application/json
X-Demo-Mode: true/false  # 데모/실사용 모드 구분
```

### 📡 주요 API 엔드포인트

#### 1. 테넌트 목록 조회
```http
GET /tenants/
Headers:
  X-Demo-Mode: false
```

**응답 예시:**
```json
{
  "tenants": [
    {
      "tenant_id": "global-call-center",
      "name": "글로벌 콜센터",
      "preset": "large",
      "status": "running",
      "services_count": 5,
      "cpu_limit": "45000m",
      "memory_limit": "64Gi",
      "gpu_limit": 6,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total_count": 1,
  "demo_count": 0,
  "active_count": 1
}
```

#### 2. 테넌트 생성
```http
POST /tenants/
Headers:
  X-Demo-Mode: false
Content-Type: application/json
```

**요청 예시:**
```json
{
  "tenant_id": "my-ai-service",
  "name": "내 AI 서비스",
  "preset": "medium",
  "service_requirements": {
    "callbot": 50,
    "chatbot": 100,
    "advisor": 25
  },
  "sla_target": {
    "availability": "99.9%",
    "response_time": "200ms"
  }
}
```

#### 3. 매니페스트 생성
```http
GET /tenants/{tenant_id}/manifest
Headers:
  X-Demo-Mode: false
```

#### 4. 모니터링 데이터 조회
```http
GET /tenants/{tenant_id}/monitoring
Headers:
  X-Demo-Mode: false
Query Parameters:
  ?metric_type=cpu&hours=24
```

---

## 모니터링 데이터 연결

### 📊 모니터링 시스템 통합

#### 1. Prometheus 메트릭 수집 설정

**prometheus.yml 설정:**
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'ecp-ai-services'
    static_configs:
      - targets: ['backend:8001']
    metrics_path: '/metrics'
    
  - job_name: 'kubernetes-pods'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_ecp_ai_tenant]
        target_label: tenant_id
```

#### 2. 커스텀 메트릭 전송

**Python 클라이언트 예시:**
```python
import requests
import json
from datetime import datetime

class ECPMonitoringClient:
    def __init__(self, base_url, is_demo=False):
        self.base_url = base_url
        self.headers = {
            'Content-Type': 'application/json',
            'X-Demo-Mode': str(is_demo).lower()
        }
    
    def send_metrics(self, tenant_id, metrics):
        """
        메트릭 데이터 전송
        
        Args:
            tenant_id: 테넌트 ID
            metrics: 메트릭 데이터 딕셔너리
        """
        endpoint = f"{self.base_url}/tenants/{tenant_id}/monitoring"
        
        payload = {
            "timestamp": datetime.utcnow().isoformat(),
            "metrics": metrics
        }
        
        response = requests.post(endpoint, 
                               headers=self.headers, 
                               json=payload)
        return response.json()

# 사용 예시
client = ECPMonitoringClient("http://localhost:8001/api/v1", is_demo=False)

metrics = {
    "cpu_usage": 65.5,
    "memory_usage": 78.2,
    "gpu_usage": 85.0,
    "request_count": 1250,
    "response_time": 145.8
}

result = client.send_metrics("my-ai-service", metrics)
```

#### 3. 실시간 모니터링 WebSocket

**WebSocket 연결:**
```javascript
const ws = new WebSocket('ws://localhost:8001/ws/monitoring/my-ai-service');

ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    console.log('실시간 메트릭:', data);
    
    // 메트릭 데이터 처리
    updateDashboard(data);
};

// 메트릭 요청
ws.send(JSON.stringify({
    action: 'subscribe',
    tenant_id: 'my-ai-service',
    metrics: ['cpu', 'memory', 'gpu']
}));
```

#### 4. 알림 설정

**알림 규칙 등록:**
```http
POST /tenants/{tenant_id}/alerts
Headers:
  X-Demo-Mode: false
Content-Type: application/json
```

```json
{
  "alert_name": "high_cpu_usage",
  "condition": "cpu_usage > 80",
  "duration": "5m",
  "actions": [
    {
      "type": "webhook",
      "url": "https://your-webhook.com/alerts",
      "method": "POST"
    },
    {
      "type": "email",
      "recipients": ["admin@company.com"]
    }
  ]
}
```

---

## 매니페스트 생성 및 전달

### 📄 매니페스트 자동 생성

#### 1. 매니페스트 생성 API

```http
GET /tenants/{tenant_id}/manifest
Headers:
  X-Demo-Mode: false
Query Parameters:
  ?format=yaml&include_monitoring=true
```

**응답 예시:**
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: ecp-ai-global-call-center
  labels:
    ecp.ai/tenant: "global-call-center"
    ecp.ai/preset: "large"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: callbot
  namespace: ecp-ai-global-call-center
spec:
  replicas: 3
  selector:
    matchLabels:
      app: callbot
  template:
    metadata:
      labels:
        app: callbot
        ecp.ai/service: "callbot"
    spec:
      containers:
      - name: callbot
        image: ecp-ai/callbot:latest
        resources:
          requests:
            cpu: 200m
            memory: 512Mi
            nvidia.com/gpu: 1
          limits:
            cpu: 2000m
            memory: 4Gi
            nvidia.com/gpu: 1
        env:
        - name: TENANT_ID
          value: "global-call-center"
```

#### 2. 매니페스트 다운로드

**직접 다운로드:**
```bash
curl -H "X-Demo-Mode: false" \
     -o manifest.yaml \
     "http://localhost:8001/api/v1/tenants/my-ai-service/manifest"
```

**Python 클라이언트:**
```python
import requests

def download_manifest(tenant_id, is_demo=False, output_file="manifest.yaml"):
    headers = {'X-Demo-Mode': str(is_demo).lower()}
    url = f"http://localhost:8001/api/v1/tenants/{tenant_id}/manifest"
    
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        with open(output_file, 'w') as f:
            f.write(response.text)
        print(f"매니페스트 저장됨: {output_file}")
    else:
        print(f"오류: {response.status_code}")

# 사용 예시
download_manifest("my-ai-service", is_demo=False)
```

#### 3. 자동 배포 연동

**GitOps 워크플로우:**
```yaml
# .github/workflows/deploy.yml
name: ECP-AI Auto Deploy
on:
  workflow_dispatch:
    inputs:
      tenant_id:
        description: 'Tenant ID'
        required: true
      is_demo:
        description: 'Demo mode'
        type: boolean
        default: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - name: Generate Manifest
      run: |
        curl -H "X-Demo-Mode: ${{ github.event.inputs.is_demo }}" \
             -o manifest.yaml \
             "${{ secrets.ECP_API_URL }}/tenants/${{ github.event.inputs.tenant_id }}/manifest"
    
    - name: Deploy to Kubernetes
      run: |
        kubectl apply -f manifest.yaml
```

#### 4. 매니페스트 검증

**검증 API:**
```http
POST /tenants/validate-manifest
Headers:
  X-Demo-Mode: false
Content-Type: application/json
```

```json
{
  "tenant_id": "my-ai-service",
  "manifest_content": "apiVersion: v1\nkind: Namespace\n..."
}
```

**응답:**
```json
{
  "valid": true,
  "warnings": [
    "GPU 리소스가 클러스터 용량을 초과할 수 있습니다"
  ],
  "errors": [],
  "resource_summary": {
    "total_cpu": "12000m",
    "total_memory": "24Gi",
    "total_gpu": 4,
    "estimated_cost": "$450/month"
  }
}
```

---

## 데이터베이스 연동

### 🗄️ 데이터베이스 스키마

#### 주요 테이블 구조

**tenants 테이블:**
```sql
CREATE TABLE tenants (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(200),
    preset VARCHAR(20) NOT NULL,
    is_demo BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'pending',
    service_requirements JSONB NOT NULL,
    resources JSONB NOT NULL,
    sla_target JSONB NOT NULL,
    cpu_limit VARCHAR(50),
    memory_limit VARCHAR(50),
    gpu_limit INTEGER,
    storage_limit VARCHAR(50),
    gpu_type VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**monitoring_data 테이블:**
```sql
CREATE TABLE monitoring_data (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id),
    metric_type VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC(10,2) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### 직접 DB 연동

**Python 예시:**
```python
import psycopg2
import json
from datetime import datetime

class ECPDatabaseClient:
    def __init__(self, db_config, is_demo=False):
        self.is_demo = is_demo
        if is_demo:
            self.conn = psycopg2.connect(
                host=db_config['demo_host'],
                port=5434,
                database='ecp_orchestrator_demo',
                user='ecp_demo_user',
                password='ecp_demo_password'
            )
        else:
            self.conn = psycopg2.connect(
                host=db_config['prod_host'],
                port=5433,
                database='ecp_orchestrator',
                user='ecp_user',
                password='ecp_password'
            )
    
    def create_tenant(self, tenant_data):
        """테넌트 생성"""
        cursor = self.conn.cursor()
        
        query = """
        INSERT INTO tenants (
            tenant_id, name, preset, is_demo, service_requirements, 
            resources, sla_target, cpu_limit, memory_limit, gpu_limit
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """
        
        cursor.execute(query, (
            tenant_data['tenant_id'],
            tenant_data['name'],
            tenant_data['preset'],
            self.is_demo,
            json.dumps(tenant_data['service_requirements']),
            json.dumps(tenant_data['resources']),
            json.dumps(tenant_data['sla_target']),
            tenant_data.get('cpu_limit'),
            tenant_data.get('memory_limit'),
            tenant_data.get('gpu_limit')
        ))
        
        tenant_id = cursor.fetchone()[0]
        self.conn.commit()
        return tenant_id
    
    def insert_monitoring_data(self, tenant_id, metrics):
        """모니터링 데이터 삽입"""
        cursor = self.conn.cursor()
        
        for metric_type, value in metrics.items():
            cursor.execute("""
                INSERT INTO monitoring_data (tenant_id, metric_type, metric_name, metric_value)
                VALUES (%s, %s, %s, %s)
            """, (tenant_id, metric_type, metric_type, value))
        
        self.conn.commit()

# 사용 예시
db_config = {
    'demo_host': 'localhost',
    'prod_host': 'localhost'
}

client = ECPDatabaseClient(db_config, is_demo=False)

# 테넌트 생성
tenant_data = {
    'tenant_id': 'my-new-service',
    'name': '내 새로운 서비스',
    'preset': 'medium',
    'service_requirements': {'chatbot': 50},
    'resources': {'cpu': '8000m', 'memory': '16Gi'},
    'sla_target': {'availability': '99.9%'},
    'cpu_limit': '8000m',
    'memory_limit': '16Gi',
    'gpu_limit': 2
}

tenant_id = client.create_tenant(tenant_data)

# 모니터링 데이터 삽입
metrics = {
    'cpu': 65.5,
    'memory': 78.2,
    'gpu': 85.0
}

client.insert_monitoring_data(tenant_id, metrics)
```

---

## 실제 사용 시나리오

### 🎯 시나리오 1: AI 콜센터 서비스 배포

#### 1단계: 서비스 요구사항 정의
```json
{
  "tenant_id": "ai-call-center-prod",
  "name": "AI 콜센터 운영",
  "service_requirements": {
    "callbot": 100,        // 동시 콜봇 세션
    "chatbot": 200,        // 동시 챗봇 세션  
    "advisor": 50,         // 상담사 지원 세션
    "stt": 100,           // 음성인식 동시 처리
    "tts": 100            // 음성합성 동시 처리
  },
  "sla_target": {
    "availability": "99.95%",
    "response_time": "150ms",
    "concurrent_users": 500
  }
}
```

#### 2단계: 자동 리소스 계산
```bash
# API 호출로 최적 프리셋 확인
curl -X POST "http://localhost:8001/api/v1/tenants/calculate-resources" \
     -H "Content-Type: application/json" \
     -H "X-Demo-Mode: false" \
     -d @service-requirements.json
```

#### 3단계: 테넌트 생성 및 배포
```python
import requests

# 테넌트 생성
response = requests.post(
    "http://localhost:8001/api/v1/tenants/",
    headers={"X-Demo-Mode": "false", "Content-Type": "application/json"},
    json=service_requirements
)

tenant_id = response.json()["tenant_id"]

# 매니페스트 다운로드
manifest_response = requests.get(
    f"http://localhost:8001/api/v1/tenants/{tenant_id}/manifest",
    headers={"X-Demo-Mode": "false"}
)

# Kubernetes 배포
with open("deployment.yaml", "w") as f:
    f.write(manifest_response.text)

os.system("kubectl apply -f deployment.yaml")
```

#### 4단계: 모니터링 설정
```python
# 실시간 모니터링 시작
import websocket
import json

def on_message(ws, message):
    data = json.loads(message)
    print(f"CPU: {data['cpu']}%, Memory: {data['memory']}%, GPU: {data['gpu']}%")
    
    # 임계값 체크
    if data['cpu'] > 80:
        send_alert("CPU 사용률 높음", tenant_id)

ws = websocket.WebSocketApp(
    f"ws://localhost:8001/ws/monitoring/{tenant_id}",
    on_message=on_message
)

ws.run_forever()
```

### 🧪 시나리오 2: 개발/테스트 환경 구성

#### 데모 모드 활용
```python
# 데모 환경에서 테스트
demo_client = ECPClient(base_url="http://localhost:8001/api/v1", is_demo=True)

# 데모 테넌트 생성 (실제 리소스 소모 없음)
demo_tenant = demo_client.create_tenant({
    "tenant_id": "test-ai-service",
    "name": "테스트 AI 서비스",
    "preset": "small",
    "service_requirements": {"chatbot": 10}
})

# 데모 데이터로 모니터링 테스트
demo_client.send_test_metrics(demo_tenant['tenant_id'])

# 매니페스트 검증
manifest = demo_client.get_manifest(demo_tenant['tenant_id'])
validation_result = demo_client.validate_manifest(manifest)

print(f"검증 결과: {validation_result}")
```

---

## 트러블슈팅

### ❗ 일반적인 문제 해결

#### 1. 데이터베이스 연결 실패
```bash
# 컨테이너 상태 확인
docker-compose ps

# 로그 확인
docker-compose logs postgres
docker-compose logs postgres-demo

# 연결 테스트
docker-compose exec postgres psql -U ecp_user -d ecp_orchestrator -c "SELECT 1;"
```

#### 2. API 응답 오류
```bash
# 백엔드 로그 확인
docker-compose logs backend

# 헤더 확인
curl -v -H "X-Demo-Mode: false" "http://localhost:8001/api/v1/tenants/"
```

#### 3. 매니페스트 생성 실패
```python
# 디버그 정보 포함 요청
response = requests.get(
    f"http://localhost:8001/api/v1/tenants/{tenant_id}/manifest",
    headers={"X-Demo-Mode": "false", "X-Debug": "true"}
)

print("디버그 정보:", response.headers.get('X-Debug-Info'))
```

#### 4. 모니터링 데이터 누락
```sql
-- 데이터 확인
SELECT tenant_id, metric_type, COUNT(*) 
FROM monitoring_data 
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY tenant_id, metric_type;

-- 인덱스 확인
\d+ monitoring_data
```

### 🔧 성능 최적화

#### 데이터베이스 최적화
```sql
-- 인덱스 생성
CREATE INDEX CONCURRENTLY idx_monitoring_data_tenant_time 
ON monitoring_data(tenant_id, timestamp DESC);

-- 파티셔닝 (대용량 데이터)
CREATE TABLE monitoring_data_2024_01 PARTITION OF monitoring_data
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

#### API 캐싱
```python
import redis

redis_client = redis.Redis(host='localhost', port=6380, db=0)

def get_tenant_with_cache(tenant_id):
    cache_key = f"tenant:{tenant_id}"
    cached_data = redis_client.get(cache_key)
    
    if cached_data:
        return json.loads(cached_data)
    
    # DB에서 조회
    tenant_data = fetch_tenant_from_db(tenant_id)
    
    # 캐시 저장 (5분)
    redis_client.setex(cache_key, 300, json.dumps(tenant_data))
    
    return tenant_data
```

---

## 📞 지원 및 문의

### 기술 지원
- **이슈 리포트**: GitHub Issues
- **문서**: `/docs` 디렉토리
- **API 문서**: http://localhost:8001/docs (Swagger UI)

### 개발자 리소스
- **API 스키마**: http://localhost:8001/openapi.json
- **WebSocket 테스트**: `/examples/websocket-test.html`
- **샘플 코드**: `/examples` 디렉토리

---

*이 문서는 ECP-AI Kubernetes Orchestrator v1.51을 기준으로 작성되었습니다.*
*최신 업데이트는 GitHub 릴리즈 노트를 확인하세요.*
