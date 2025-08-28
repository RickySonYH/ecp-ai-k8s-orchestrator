# ECP-AI Kubernetes Orchestrator API 참조서

## 📋 목차
1. [인증 및 헤더](#인증-및-헤더)
2. [테넌트 관리 API](#테넌트-관리-api)
3. [모니터링 API](#모니터링-api)
4. [매니페스트 API](#매니페스트-api)
5. [WebSocket API](#websocket-api)
6. [오류 코드](#오류-코드)
7. [SDK 및 클라이언트](#sdk-및-클라이언트)

---

## 인증 및 헤더

### 필수 헤더
모든 API 요청에 다음 헤더를 포함해야 합니다:

```http
Content-Type: application/json
X-Demo-Mode: true/false  # 데모/실사용 모드 구분 (필수)
```

### 선택적 헤더
```http
X-Request-ID: unique-request-id     # 요청 추적용
X-Debug: true                       # 디버그 정보 포함
Authorization: Bearer <token>       # 인증 토큰 (향후 지원)
```

---

## 테넌트 관리 API

### 1. 테넌트 목록 조회

```http
GET /api/v1/tenants/
```

**헤더:**
```http
X-Demo-Mode: false
```

**쿼리 파라미터:**
- `skip` (int): 건너뛸 항목 수 (기본값: 0)
- `limit` (int): 반환할 최대 항목 수 (기본값: 100, 최대: 1000)
- `preset` (string): 프리셋 필터 (micro, small, medium, large)
- `status` (string): 상태 필터 (pending, running, failed, deleting)

**응답:**
```json
{
  "tenants": [
    {
      "tenant_id": "global-call-center",
      "name": "글로벌 콜센터",
      "preset": "large",
      "is_demo": false,
      "status": "running",
      "services_count": 5,
      "cpu_limit": "45000m",
      "memory_limit": "64Gi",
      "gpu_limit": 6,
      "storage_limit": "2.0TB",
      "gpu_type": "v100",
      "sla_availability": "99.86%",
      "sla_response_time": "265ms",
      "created_at": "2024-01-15T10:30:00Z",
      "description": "글로벌 콜센터 AI 서비스"
    }
  ],
  "total_count": 1,
  "demo_count": 0,
  "active_count": 1,
  "pagination": {
    "skip": 0,
    "limit": 100,
    "has_more": false
  }
}
```

### 2. 테넌트 상세 조회

```http
GET /api/v1/tenants/{tenant_id}
```

**경로 파라미터:**
- `tenant_id` (string): 테넌트 ID

**응답:**
```json
{
  "tenant_id": "global-call-center",
  "name": "글로벌 콜센터",
  "preset": "large",
  "is_demo": false,
  "status": "running",
  "service_requirements": {
    "callbot": 25,
    "chatbot": 85,
    "advisor": 32
  },
  "resources": {
    "cpu": "45000m",
    "memory": "64Gi",
    "gpu": 6,
    "storage": "2.0TB"
  },
  "sla_target": {
    "availability": "99.86%",
    "response_time": "265ms"
  },
  "services": [
    {
      "service_name": "callbot",
      "service_type": "ai_service",
      "enabled": true,
      "count": 25,
      "image": "ecp-ai/callbot:latest",
      "resources": {
        "cpu_request": "200m",
        "memory_request": "512Mi"
      }
    }
  ],
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

### 3. 테넌트 생성

```http
POST /api/v1/tenants/
```

**요청 본문:**
```json
{
  "tenant_id": "my-ai-service",
  "name": "내 AI 서비스",
  "preset": "medium",
  "service_requirements": {
    "callbot": 50,
    "chatbot": 100,
    "advisor": 25,
    "stt": 30,
    "tts": 30
  },
  "sla_target": {
    "availability": "99.9%",
    "response_time": "200ms",
    "concurrent_users": 200
  },
  "description": "내 AI 서비스 설명"
}
```

**응답:**
```json
{
  "tenant_id": "my-ai-service",
  "status": "pending",
  "deployment_id": "dep-abc123",
  "estimated_resources": {
    "cpu": "24000m",
    "memory": "32Gi",
    "gpu": 3,
    "storage": "1.0TB"
  },
  "estimated_cost": "$350/month",
  "deployment_time": "15-20 minutes",
  "created_at": "2024-01-20T14:30:00Z"
}
```

### 4. 테넌트 수정

```http
PUT /api/v1/tenants/{tenant_id}
```

**요청 본문:**
```json
{
  "name": "수정된 서비스 이름",
  "service_requirements": {
    "callbot": 75,
    "chatbot": 150
  },
  "sla_target": {
    "availability": "99.95%",
    "response_time": "150ms"
  }
}
```

### 5. 테넌트 삭제

```http
DELETE /api/v1/tenants/{tenant_id}
```

**쿼리 파라미터:**
- `force` (boolean): 강제 삭제 (기본값: false)

**응답:**
```json
{
  "message": "테넌트 삭제가 시작되었습니다",
  "deletion_id": "del-xyz789",
  "estimated_time": "5-10 minutes"
}
```

### 6. 리소스 계산

```http
POST /api/v1/tenants/calculate-resources
```

**요청 본문:**
```json
{
  "service_requirements": {
    "callbot": 100,
    "chatbot": 200,
    "advisor": 50
  },
  "sla_target": {
    "availability": "99.9%",
    "response_time": "150ms"
  }
}
```

**응답:**
```json
{
  "recommended_preset": "large",
  "resources": {
    "cpu": "45000m",
    "memory": "64Gi",
    "gpu": 6,
    "storage": "2.0TB"
  },
  "gpu_type": "v100",
  "estimated_cost": "$450/month",
  "alternatives": [
    {
      "preset": "medium",
      "resources": {"cpu": "24000m", "memory": "32Gi", "gpu": 3},
      "cost": "$250/month",
      "performance_impact": "응답시간 20% 증가 예상"
    }
  ]
}
```

---

## 모니터링 API

### 1. 모니터링 데이터 조회

```http
GET /api/v1/tenants/{tenant_id}/monitoring
```

**쿼리 파라미터:**
- `metric_type` (string): 메트릭 타입 (cpu, memory, gpu, network, storage)
- `hours` (int): 조회할 시간 범위 (기본값: 24)
- `interval` (string): 데이터 간격 (1m, 5m, 1h) (기본값: 5m)

**응답:**
```json
{
  "tenant_id": "my-ai-service",
  "time_range": {
    "start": "2024-01-20T00:00:00Z",
    "end": "2024-01-21T00:00:00Z"
  },
  "metrics": {
    "cpu": [
      {"timestamp": "2024-01-20T14:00:00Z", "value": 65.5},
      {"timestamp": "2024-01-20T14:05:00Z", "value": 68.2}
    ],
    "memory": [
      {"timestamp": "2024-01-20T14:00:00Z", "value": 78.1},
      {"timestamp": "2024-01-20T14:05:00Z", "value": 79.5}
    ],
    "gpu": [
      {"timestamp": "2024-01-20T14:00:00Z", "value": 85.0},
      {"timestamp": "2024-01-20T14:05:00Z", "value": 87.3}
    ]
  },
  "summary": {
    "avg_cpu": 66.8,
    "max_cpu": 89.2,
    "avg_memory": 78.8,
    "max_memory": 92.1,
    "avg_gpu": 86.1,
    "max_gpu": 98.5
  }
}
```

### 2. 모니터링 데이터 전송

```http
POST /api/v1/tenants/{tenant_id}/monitoring
```

**요청 본문:**
```json
{
  "timestamp": "2024-01-20T14:30:00Z",
  "metrics": {
    "cpu_usage": 65.5,
    "memory_usage": 78.2,
    "gpu_usage": 85.0,
    "network_in": 1250000,
    "network_out": 850000,
    "storage_used": 750000000000,
    "request_count": 1250,
    "response_time": 145.8,
    "error_rate": 0.02
  }
}
```

### 3. 시스템 메트릭 조회

```http
GET /api/v1/monitoring/system
```

**응답:**
```json
{
  "cluster_status": "healthy",
  "total_tenants": 15,
  "active_tenants": 12,
  "total_resources": {
    "cpu": "500000m",
    "memory": "1000Gi",
    "gpu": 50,
    "storage": "50TB"
  },
  "used_resources": {
    "cpu": "285000m",
    "memory": "650Gi",
    "gpu": 28,
    "storage": "25TB"
  },
  "utilization": {
    "cpu": 57.0,
    "memory": 65.0,
    "gpu": 56.0,
    "storage": 50.0
  }
}
```

---

## 매니페스트 API

### 1. 매니페스트 생성

```http
GET /api/v1/tenants/{tenant_id}/manifest
```

**쿼리 파라미터:**
- `format` (string): 출력 형식 (yaml, json) (기본값: yaml)
- `include_monitoring` (boolean): 모니터링 설정 포함 (기본값: true)
- `include_ingress` (boolean): Ingress 설정 포함 (기본값: false)
- `namespace` (string): 커스텀 네임스페이스 (기본값: 자동 생성)

**응답 (YAML):**
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: ecp-ai-my-ai-service
  labels:
    ecp.ai/tenant: "my-ai-service"
    ecp.ai/preset: "medium"
    ecp.ai/managed-by: "ecp-orchestrator"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: callbot
  namespace: ecp-ai-my-ai-service
  labels:
    ecp.ai/service: "callbot"
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
        ecp.ai/tenant: "my-ai-service"
    spec:
      containers:
      - name: callbot
        image: ecp-ai/callbot:latest
        ports:
        - containerPort: 8080
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
          value: "my-ai-service"
        - name: SERVICE_TYPE
          value: "callbot"
        - name: REDIS_URL
          value: "redis://redis-service:6379"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: callbot-service
  namespace: ecp-ai-my-ai-service
spec:
  selector:
    app: callbot
  ports:
  - port: 80
    targetPort: 8080
  type: ClusterIP
```

### 2. 매니페스트 검증

```http
POST /api/v1/tenants/validate-manifest
```

**요청 본문:**
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
    "GPU 리소스가 클러스터 용량의 80%를 초과합니다",
    "Liveness probe 설정이 권장값보다 짧습니다"
  ],
  "errors": [],
  "resource_summary": {
    "namespaces": 1,
    "deployments": 5,
    "services": 5,
    "configmaps": 2,
    "secrets": 1,
    "total_cpu": "24000m",
    "total_memory": "32Gi",
    "total_gpu": 3,
    "estimated_pods": 15
  },
  "estimated_cost": "$350/month",
  "deployment_time": "15-20 minutes"
}
```

### 3. 매니페스트 적용 상태

```http
GET /api/v1/tenants/{tenant_id}/deployment-status
```

**응답:**
```json
{
  "tenant_id": "my-ai-service",
  "deployment_id": "dep-abc123",
  "status": "deploying",
  "progress": 65,
  "phase": "creating-services",
  "created_resources": [
    {"type": "Namespace", "name": "ecp-ai-my-ai-service", "status": "Active"},
    {"type": "Deployment", "name": "callbot", "status": "Available", "replicas": "3/3"},
    {"type": "Service", "name": "callbot-service", "status": "Active"}
  ],
  "pending_resources": [
    {"type": "Deployment", "name": "chatbot", "status": "Progressing"},
    {"type": "Deployment", "name": "advisor", "status": "Pending"}
  ],
  "estimated_completion": "2024-01-20T15:00:00Z",
  "logs": [
    {"timestamp": "2024-01-20T14:35:00Z", "level": "info", "message": "Namespace 생성 완료"},
    {"timestamp": "2024-01-20T14:36:00Z", "level": "info", "message": "Callbot deployment 시작"}
  ]
}
```

---

## WebSocket API

### 1. 실시간 모니터링

```javascript
const ws = new WebSocket('ws://localhost:8001/ws/monitoring/my-ai-service');

// 연결 시
ws.onopen = function() {
    // 구독 설정
    ws.send(JSON.stringify({
        action: 'subscribe',
        metrics: ['cpu', 'memory', 'gpu'],
        interval: 5000  // 5초 간격
    }));
};

// 메시지 수신
ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    console.log('실시간 메트릭:', data);
    /*
    {
        "timestamp": "2024-01-20T14:30:00Z",
        "tenant_id": "my-ai-service",
        "metrics": {
            "cpu": 65.5,
            "memory": 78.2,
            "gpu": 85.0
        }
    }
    */
};
```

### 2. 배포 상태 모니터링

```javascript
const ws = new WebSocket('ws://localhost:8001/ws/deployment/dep-abc123');

ws.onmessage = function(event) {
    const update = JSON.parse(event.data);
    /*
    {
        "deployment_id": "dep-abc123",
        "status": "deploying",
        "progress": 75,
        "phase": "scaling-services",
        "message": "Chatbot deployment 완료, Advisor deployment 시작"
    }
    */
};
```

### 3. 알림 스트림

```javascript
const ws = new WebSocket('ws://localhost:8001/ws/alerts/my-ai-service');

ws.onmessage = function(event) {
    const alert = JSON.parse(event.data);
    /*
    {
        "alert_id": "alert-123",
        "tenant_id": "my-ai-service",
        "severity": "warning",
        "type": "resource_usage",
        "message": "CPU 사용률이 80%를 초과했습니다",
        "metric": "cpu",
        "current_value": 85.2,
        "threshold": 80.0,
        "timestamp": "2024-01-20T14:30:00Z"
    }
    */
};
```

---

## 오류 코드

### HTTP 상태 코드

| 코드 | 의미 | 설명 |
|------|------|------|
| 200 | OK | 요청 성공 |
| 201 | Created | 리소스 생성 성공 |
| 400 | Bad Request | 잘못된 요청 |
| 401 | Unauthorized | 인증 필요 |
| 403 | Forbidden | 권한 없음 |
| 404 | Not Found | 리소스 없음 |
| 409 | Conflict | 리소스 충돌 |
| 422 | Unprocessable Entity | 검증 실패 |
| 429 | Too Many Requests | 요청 한도 초과 |
| 500 | Internal Server Error | 서버 오류 |
| 503 | Service Unavailable | 서비스 이용 불가 |

### 커스텀 오류 코드

```json
{
  "error": {
    "code": "TENANT_ALREADY_EXISTS",
    "message": "동일한 ID의 테넌트가 이미 존재합니다",
    "details": {
      "tenant_id": "my-ai-service",
      "existing_status": "running"
    },
    "timestamp": "2024-01-20T14:30:00Z",
    "request_id": "req-xyz789"
  }
}
```

### 주요 오류 코드 목록

| 코드 | 설명 |
|------|------|
| `TENANT_NOT_FOUND` | 테넌트를 찾을 수 없음 |
| `TENANT_ALREADY_EXISTS` | 테넌트 ID 중복 |
| `INVALID_PRESET` | 잘못된 프리셋 |
| `INSUFFICIENT_RESOURCES` | 클러스터 리소스 부족 |
| `DEPLOYMENT_FAILED` | 배포 실패 |
| `MANIFEST_INVALID` | 매니페스트 검증 실패 |
| `MONITORING_UNAVAILABLE` | 모니터링 서비스 이용 불가 |
| `DATABASE_ERROR` | 데이터베이스 오류 |
| `KUBERNETES_ERROR` | Kubernetes API 오류 |

---

## SDK 및 클라이언트

### Python SDK

```python
from ecp_orchestrator import ECPClient

# 클라이언트 초기화
client = ECPClient(
    base_url="http://localhost:8001/api/v1",
    is_demo=False
)

# 테넌트 생성
tenant = client.create_tenant({
    "tenant_id": "my-service",
    "name": "내 서비스",
    "preset": "medium",
    "service_requirements": {"chatbot": 100}
})

# 모니터링 데이터 전송
client.send_metrics("my-service", {
    "cpu": 65.5,
    "memory": 78.2
})

# 매니페스트 다운로드
manifest = client.get_manifest("my-service")
with open("deployment.yaml", "w") as f:
    f.write(manifest)
```

### JavaScript SDK

```javascript
import { ECPClient } from '@ecp-ai/orchestrator-client';

const client = new ECPClient({
    baseUrl: 'http://localhost:8001/api/v1',
    isDemo: false
});

// 테넌트 목록 조회
const tenants = await client.getTenants();

// 실시간 모니터링 구독
client.subscribeToMonitoring('my-service', (data) => {
    console.log('메트릭 업데이트:', data);
});
```

### Go SDK

```go
package main

import (
    "github.com/ecp-ai/orchestrator-client-go"
)

func main() {
    client := orchestrator.NewClient(&orchestrator.Config{
        BaseURL: "http://localhost:8001/api/v1",
        IsDemo:  false,
    })
    
    // 테넌트 생성
    tenant, err := client.CreateTenant(&orchestrator.TenantRequest{
        TenantID: "my-service",
        Name:     "내 서비스",
        Preset:   "medium",
        ServiceRequirements: map[string]int{
            "chatbot": 100,
        },
    })
    
    if err != nil {
        log.Fatal(err)
    }
    
    fmt.Printf("테넌트 생성됨: %s\n", tenant.TenantID)
}
```

---

*이 API 참조서는 ECP-AI Kubernetes Orchestrator v1.51을 기준으로 작성되었습니다.*
