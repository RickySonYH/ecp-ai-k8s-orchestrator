# ECP-AI Kubernetes Orchestrator 실사용 시스템 연동 가이드

## 📋 목차
1. [실사용 환경 요구사항](#실사용-환경-요구사항)
2. [Kubernetes 클러스터 연동](#kubernetes-클러스터-연동)
3. [모니터링 시스템 연동](#모니터링-시스템-연동)
4. [매니페스트 자동 배포](#매니페스트-자동-배포)
5. [실사용 데이터베이스 설정](#실사용-데이터베이스-설정)
6. [보안 및 인증](#보안-및-인증)
7. [CI/CD 파이프라인 연동](#cicd-파이프라인-연동)
8. [운영 모니터링 및 알림](#운영-모니터링-및-알림)
9. [백업 및 재해복구](#백업-및-재해복구)
10. [성능 최적화](#성능-최적화)

---

## 실사용 환경 요구사항

### 🏗️ 인프라 요구사항

#### Kubernetes 클러스터
```yaml
# 최소 요구사항
nodes: 3개 이상 (Master 1개, Worker 2개 이상)
kubernetes_version: v1.24+
network_plugin: Calico, Flannel, 또는 Cilium
storage_class: 동적 프로비저닝 지원 (AWS EBS, GCE PD, NFS 등)
ingress_controller: NGINX, Traefik, 또는 ALB

# 권장 사양
cpu_per_node: 16 cores 이상
memory_per_node: 64GB 이상  
gpu_support: NVIDIA GPU Operator 설치 (AI 워크로드용)
storage: 1TB+ SSD (각 노드)
```

#### 네트워크 요구사항
```yaml
# 포트 요구사항
ingress_ports: [80, 443]
api_port: 8001
monitoring_ports: [9090, 3001, 9093]  # Prometheus, Grafana, Alertmanager
database_port: 5432
redis_port: 6379

# 도메인 요구사항
api_domain: api.your-company.com
ui_domain: orchestrator.your-company.com
monitoring_domain: monitoring.your-company.com
```

### 🔧 시스템 의존성

#### 필수 구성요소
```bash
# Container Runtime
containerd: v1.6+
docker: v20.10+ (선택사항)

# 모니터링 스택
prometheus: v2.40+
grafana: v9.0+
alertmanager: v0.25+

# 데이터베이스
postgresql: v13+ (HA 구성 권장)
redis: v7+ (클러스터 구성 권장)

# 로드밸런서
nginx: v1.20+ 또는 cloud LB
cert-manager: v1.10+ (TLS 인증서 자동 관리)
```

---

## Kubernetes 클러스터 연동

### 🔑 서비스 계정 및 RBAC 설정

#### 1. ECP Orchestrator 서비스 계정 생성
```yaml
# ecp-orchestrator-rbac.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: ecp-orchestrator
  namespace: ecp-system
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: ecp-orchestrator-role
rules:
- apiGroups: [""]
  resources: ["namespaces", "pods", "services", "configmaps", "secrets"]
  verbs: ["get", "list", "create", "update", "patch", "delete", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets", "daemonsets", "statefulsets"]
  verbs: ["get", "list", "create", "update", "patch", "delete", "watch"]
- apiGroups: ["networking.k8s.io"]
  resources: ["ingresses", "networkpolicies"]
  verbs: ["get", "list", "create", "update", "patch", "delete"]
- apiGroups: ["autoscaling"]
  resources: ["horizontalpodautoscalers"]
  verbs: ["get", "list", "create", "update", "patch", "delete"]
- apiGroups: ["metrics.k8s.io"]
  resources: ["pods", "nodes"]
  verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: ecp-orchestrator-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: ecp-orchestrator-role
subjects:
- kind: ServiceAccount
  name: ecp-orchestrator
  namespace: ecp-system
```

#### 2. kubeconfig 설정
```bash
# 서비스 계정 토큰 생성
kubectl create token ecp-orchestrator -n ecp-system --duration=8760h > /tmp/ecp-token

# kubeconfig 생성
cat > /app/config/kubeconfig << EOF
apiVersion: v1
kind: Config
clusters:
- cluster:
    certificate-authority-data: $(kubectl config view --raw -o jsonpath='{.clusters[0].cluster.certificate-authority-data}')
    server: $(kubectl config view --raw -o jsonpath='{.clusters[0].cluster.server}')
  name: production-cluster
contexts:
- context:
    cluster: production-cluster
    user: ecp-orchestrator
  name: ecp-context
current-context: ecp-context
users:
- name: ecp-orchestrator
  user:
    token: $(cat /tmp/ecp-token)
EOF
```

### 🚀 ECP Orchestrator 배포

#### 1. 네임스페이스 및 리소스 생성
```yaml
# ecp-deployment.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: ecp-system
  labels:
    name: ecp-system
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ecp-orchestrator-backend
  namespace: ecp-system
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ecp-backend
  template:
    metadata:
      labels:
        app: ecp-backend
    spec:
      serviceAccountName: ecp-orchestrator
      containers:
      - name: backend
        image: your-registry.com/ecp-orchestrator-backend:latest
        ports:
        - containerPort: 8001
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: ecp-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: ecp-secrets
              key: redis-url
        - name: KUBERNETES_CONFIG_PATH
          value: /app/config/kubeconfig
        - name: ENVIRONMENT
          value: production
        volumeMounts:
        - name: kubeconfig
          mountPath: /app/config
          readOnly: true
        resources:
          requests:
            cpu: 500m
            memory: 1Gi
          limits:
            cpu: 2000m
            memory: 4Gi
        livenessProbe:
          httpGet:
            path: /health
            port: 8001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8001
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: kubeconfig
        secret:
          secretName: ecp-kubeconfig
---
apiVersion: v1
kind: Service
metadata:
  name: ecp-backend-service
  namespace: ecp-system
spec:
  selector:
    app: ecp-backend
  ports:
  - port: 8001
    targetPort: 8001
  type: ClusterIP
```

#### 2. 시크릿 설정
```bash
# 데이터베이스 및 Redis 연결 정보
kubectl create secret generic ecp-secrets -n ecp-system \
  --from-literal=database-url="postgresql://ecp_user:secure_password@postgres.db.cluster:5432/ecp_orchestrator" \
  --from-literal=redis-url="redis://redis.cache.cluster:6379/0"

# kubeconfig 시크릿
kubectl create secret generic ecp-kubeconfig -n ecp-system \
  --from-file=kubeconfig=/app/config/kubeconfig
```

### 🌐 Ingress 설정
```yaml
# ecp-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ecp-orchestrator-ingress
  namespace: ecp-system
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/cors-allow-origin: "https://orchestrator.your-company.com"
spec:
  tls:
  - hosts:
    - api.your-company.com
    secretName: ecp-api-tls
  rules:
  - host: api.your-company.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: ecp-backend-service
            port:
              number: 8001
```

---

## 모니터링 시스템 연동

### 📊 Prometheus 연동

#### 1. ServiceMonitor 설정
```yaml
# ecp-servicemonitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: ecp-orchestrator-monitor
  namespace: ecp-system
  labels:
    app: ecp-orchestrator
spec:
  selector:
    matchLabels:
      app: ecp-backend
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
    scrapeTimeout: 10s
---
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: ecp-orchestrator-rules
  namespace: ecp-system
spec:
  groups:
  - name: ecp.rules
    rules:
    - alert: ECPHighCPUUsage
      expr: avg(ecp_tenant_cpu_usage) > 80
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "ECP 테넌트 CPU 사용률 높음"
        description: "테넌트 {{ $labels.tenant_id }}의 CPU 사용률이 {{ $value }}%입니다"
    
    - alert: ECPTenantDown
      expr: up{job="ecp-orchestrator"} == 0
      for: 2m
      labels:
        severity: critical
      annotations:
        summary: "ECP Orchestrator 서비스 다운"
        description: "ECP Orchestrator가 응답하지 않습니다"
```

#### 2. 커스텀 메트릭 수집 설정
```python
# backend/app/core/metrics.py
from prometheus_client import Counter, Histogram, Gauge, generate_latest
import time

# 메트릭 정의
tenant_requests_total = Counter(
    'ecp_tenant_requests_total',
    'Total tenant requests',
    ['tenant_id', 'method', 'status']
)

tenant_deployment_duration = Histogram(
    'ecp_tenant_deployment_duration_seconds',
    'Tenant deployment duration',
    ['tenant_id', 'preset']
)

tenant_cpu_usage = Gauge(
    'ecp_tenant_cpu_usage',
    'Tenant CPU usage percentage',
    ['tenant_id']
)

tenant_memory_usage = Gauge(
    'ecp_tenant_memory_usage',
    'Tenant memory usage percentage',
    ['tenant_id']
)

tenant_gpu_usage = Gauge(
    'ecp_tenant_gpu_usage',
    'Tenant GPU usage percentage',
    ['tenant_id']
)

active_tenants = Gauge(
    'ecp_active_tenants_total',
    'Number of active tenants'
)

class MetricsCollector:
    def __init__(self):
        self.start_time = time.time()
    
    def record_request(self, tenant_id: str, method: str, status: str):
        """요청 메트릭 기록"""
        tenant_requests_total.labels(
            tenant_id=tenant_id,
            method=method,
            status=status
        ).inc()
    
    def record_deployment_time(self, tenant_id: str, preset: str, duration: float):
        """배포 시간 메트릭 기록"""
        tenant_deployment_duration.labels(
            tenant_id=tenant_id,
            preset=preset
        ).observe(duration)
    
    def update_resource_usage(self, tenant_id: str, cpu: float, memory: float, gpu: float = None):
        """리소스 사용률 업데이트"""
        tenant_cpu_usage.labels(tenant_id=tenant_id).set(cpu)
        tenant_memory_usage.labels(tenant_id=tenant_id).set(memory)
        
        if gpu is not None:
            tenant_gpu_usage.labels(tenant_id=tenant_id).set(gpu)
    
    def update_active_tenants(self, count: int):
        """활성 테넌트 수 업데이트"""
        active_tenants.set(count)

# FastAPI 엔드포인트
@router.get("/metrics")
async def get_metrics():
    """Prometheus 메트릭 엔드포인트"""
    return Response(
        generate_latest(),
        media_type="text/plain"
    )
```

### 📈 Grafana 대시보드 설정

#### 1. 대시보드 JSON 설정
```json
{
  "dashboard": {
    "title": "ECP-AI Orchestrator 운영 대시보드",
    "panels": [
      {
        "title": "활성 테넌트 수",
        "type": "stat",
        "targets": [
          {
            "expr": "ecp_active_tenants_total",
            "legendFormat": "활성 테넌트"
          }
        ]
      },
      {
        "title": "테넌트별 CPU 사용률",
        "type": "graph",
        "targets": [
          {
            "expr": "ecp_tenant_cpu_usage",
            "legendFormat": "{{ tenant_id }}"
          }
        ]
      },
      {
        "title": "배포 성공률",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(ecp_tenant_requests_total{status=\"success\"}[5m]) / rate(ecp_tenant_requests_total[5m]) * 100",
            "legendFormat": "성공률 %"
          }
        ]
      }
    ]
  }
}
```

#### 2. 알림 채널 설정
```yaml
# grafana-alerts.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-alert-config
  namespace: monitoring
data:
  notification-channels.yaml: |
    notifiers:
    - name: slack-alerts
      type: slack
      settings:
        url: https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
        channel: "#ecp-alerts"
        title: "ECP Orchestrator 알림"
        text: "{{ range .Alerts }}{{ .Annotations.summary }}\n{{ .Annotations.description }}{{ end }}"
    
    - name: email-alerts
      type: email
      settings:
        addresses: "ops@your-company.com;admin@your-company.com"
        subject: "ECP Orchestrator 알림: {{ .CommonLabels.alertname }}"
```

---

## 매니페스트 자동 배포

### 🔄 GitOps 워크플로우 설정

#### 1. ArgoCD 연동
```yaml
# argocd-app.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: ecp-tenant-deployments
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://git.your-company.com/ecp-manifests
    targetRevision: main
    path: tenants/
  destination:
    server: https://kubernetes.default.svc
    namespace: ecp-tenants
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
```

#### 2. Webhook 기반 자동 배포
```python
# backend/app/services/deployment_service.py
import git
import os
import yaml
from pathlib import Path

class GitOpsDeploymentService:
    def __init__(self, git_repo_url: str, git_token: str, git_branch: str = "main"):
        self.repo_url = git_repo_url
        self.token = git_token
        self.branch = git_branch
        self.local_repo_path = "/tmp/ecp-manifests"
    
    def deploy_tenant_manifest(self, tenant_id: str, manifest_content: str):
        """테넌트 매니페스트를 Git 저장소에 커밋하여 자동 배포"""
        try:
            # Git 저장소 클론 또는 업데이트
            self._update_local_repo()
            
            # 매니페스트 파일 생성
            tenant_dir = Path(self.local_repo_path) / "tenants" / tenant_id
            tenant_dir.mkdir(parents=True, exist_ok=True)
            
            manifest_file = tenant_dir / "manifest.yaml"
            with open(manifest_file, 'w') as f:
                f.write(manifest_content)
            
            # Git 커밋 및 푸시
            repo = git.Repo(self.local_repo_path)
            repo.git.add(str(manifest_file))
            repo.git.commit(m=f"Deploy tenant {tenant_id}")
            repo.git.push("origin", self.branch)
            
            return {
                "status": "success",
                "message": f"Tenant {tenant_id} manifest deployed to Git",
                "commit_hash": repo.head.commit.hexsha[:8]
            }
            
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to deploy manifest: {str(e)}"
            }
    
    def _update_local_repo(self):
        """로컬 Git 저장소 업데이트"""
        if os.path.exists(self.local_repo_path):
            repo = git.Repo(self.local_repo_path)
            repo.git.pull("origin", self.branch)
        else:
            git.Repo.clone_from(
                self.repo_url.replace("https://", f"https://{self.token}@"),
                self.local_repo_path,
                branch=self.branch
            )
```

#### 3. 직접 Kubernetes API 배포
```python
# backend/app/services/k8s_deployment_service.py
from kubernetes import client, config
from kubernetes.client.rest import ApiException
import yaml
import logging

class KubernetesDeploymentService:
    def __init__(self, kubeconfig_path: str = None):
        if kubeconfig_path:
            config.load_kube_config(config_file=kubeconfig_path)
        else:
            config.load_incluster_config()
        
        self.api_client = client.ApiClient()
        self.apps_v1 = client.AppsV1Api()
        self.core_v1 = client.CoreV1Api()
        self.networking_v1 = client.NetworkingV1Api()
    
    def deploy_manifest(self, tenant_id: str, manifest_content: str):
        """매니페스트를 직접 Kubernetes에 배포"""
        try:
            # YAML 문서들 파싱
            documents = list(yaml.safe_load_all(manifest_content))
            deployed_resources = []
            
            for doc in documents:
                if not doc:
                    continue
                
                result = self._deploy_resource(doc)
                deployed_resources.append(result)
            
            return {
                "status": "success",
                "tenant_id": tenant_id,
                "deployed_resources": deployed_resources
            }
            
        except Exception as e:
            logging.error(f"Deployment failed for {tenant_id}: {e}")
            return {
                "status": "error",
                "tenant_id": tenant_id,
                "error": str(e)
            }
    
    def _deploy_resource(self, resource: dict):
        """개별 리소스 배포"""
        kind = resource.get("kind")
        api_version = resource.get("apiVersion")
        metadata = resource.get("metadata", {})
        name = metadata.get("name")
        namespace = metadata.get("namespace", "default")
        
        try:
            if kind == "Namespace":
                self.core_v1.create_namespace(body=resource)
            
            elif kind == "Deployment":
                self.apps_v1.create_namespaced_deployment(
                    namespace=namespace,
                    body=resource
                )
            
            elif kind == "Service":
                self.core_v1.create_namespaced_service(
                    namespace=namespace,
                    body=resource
                )
            
            elif kind == "Ingress":
                self.networking_v1.create_namespaced_ingress(
                    namespace=namespace,
                    body=resource
                )
            
            elif kind == "ConfigMap":
                self.core_v1.create_namespaced_config_map(
                    namespace=namespace,
                    body=resource
                )
            
            elif kind == "Secret":
                self.core_v1.create_namespaced_secret(
                    namespace=namespace,
                    body=resource
                )
            
            return {
                "kind": kind,
                "name": name,
                "namespace": namespace,
                "status": "created"
            }
            
        except ApiException as e:
            if e.status == 409:  # Already exists
                return {
                    "kind": kind,
                    "name": name,
                    "namespace": namespace,
                    "status": "already_exists"
                }
            else:
                raise e
    
    def get_deployment_status(self, tenant_id: str, namespace: str = None):
        """배포 상태 조회"""
        if not namespace:
            namespace = f"ecp-ai-{tenant_id}"
        
        try:
            deployments = self.apps_v1.list_namespaced_deployment(namespace=namespace)
            services = self.core_v1.list_namespaced_service(namespace=namespace)
            
            deployment_status = []
            for deployment in deployments.items:
                status = {
                    "name": deployment.metadata.name,
                    "ready_replicas": deployment.status.ready_replicas or 0,
                    "desired_replicas": deployment.spec.replicas,
                    "available": deployment.status.ready_replicas == deployment.spec.replicas
                }
                deployment_status.append(status)
            
            return {
                "tenant_id": tenant_id,
                "namespace": namespace,
                "deployments": deployment_status,
                "services": len(services.items),
                "overall_status": "ready" if all(d["available"] for d in deployment_status) else "pending"
            }
            
        except ApiException as e:
            return {
                "tenant_id": tenant_id,
                "namespace": namespace,
                "status": "error",
                "error": str(e)
            }
```

---

## 실사용 데이터베이스 설정

### 🗄️ PostgreSQL HA 구성

#### 1. PostgreSQL 클러스터 설정
```yaml
# postgresql-ha.yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: ecp-postgresql
  namespace: ecp-system
spec:
  instances: 3
  
  postgresql:
    parameters:
      max_connections: "200"
      shared_preload_libraries: "pg_stat_statements"
      pg_stat_statements.track: "all"
      log_statement: "all"
      log_min_duration_statement: "1000"
  
  bootstrap:
    initdb:
      database: ecp_orchestrator
      owner: ecp_user
      secret:
        name: ecp-postgresql-credentials
  
  storage:
    size: 100Gi
    storageClass: fast-ssd
  
  resources:
    requests:
      memory: "4Gi"
      cpu: "2"
    limits:
      memory: "8Gi"
      cpu: "4"
  
  monitoring:
    enabled: true
  
  backup:
    target: "primary"
    retentionPolicy: "30d"
    data:
      compression: "gzip"
    wal:
      retention: "7d"
---
apiVersion: v1
kind: Secret
metadata:
  name: ecp-postgresql-credentials
  namespace: ecp-system
type: kubernetes.io/basic-auth
data:
  username: ZWNwX3VzZXI=  # ecp_user
  password: c2VjdXJlX3Bhc3N3b3JkXzEyMw==  # secure_password_123
```

#### 2. 데이터베이스 마이그레이션 Job
```yaml
# db-migration-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: ecp-db-migration
  namespace: ecp-system
spec:
  template:
    spec:
      containers:
      - name: migration
        image: your-registry.com/ecp-orchestrator-backend:latest
        command: ["python", "-m", "alembic", "upgrade", "head"]
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: ecp-postgresql-credentials
              key: connection-string
      restartPolicy: OnFailure
```

### 🔄 Redis 클러스터 설정

#### 1. Redis Sentinel 구성
```yaml
# redis-cluster.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis-master
  namespace: ecp-system
spec:
  serviceName: redis-master
  replicas: 1
  selector:
    matchLabels:
      app: redis-master
  template:
    metadata:
      labels:
        app: redis-master
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        volumeMounts:
        - name: redis-data
          mountPath: /data
        resources:
          requests:
            memory: "2Gi"
            cpu: "1"
          limits:
            memory: "4Gi"
            cpu: "2"
  volumeClaimTemplates:
  - metadata:
      name: redis-data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 20Gi
```

---

## 보안 및 인증

### 🔐 인증 시스템 구성

#### 1. OAuth2/OIDC 연동
```python
# backend/app/core/auth.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from typing import Optional

security = HTTPBearer()

class AuthService:
    def __init__(self, oidc_issuer: str, client_id: str):
        self.oidc_issuer = oidc_issuer
        self.client_id = client_id
        self.public_keys = self._get_public_keys()
    
    def verify_token(self, credentials: HTTPAuthorizationCredentials = Depends(security)):
        """JWT 토큰 검증"""
        try:
            payload = jwt.decode(
                credentials.credentials,
                self.public_keys,
                algorithms=["RS256"],
                audience=self.client_id,
                issuer=self.oidc_issuer
            )
            
            return {
                "user_id": payload.get("sub"),
                "email": payload.get("email"),
                "roles": payload.get("roles", []),
                "tenant_access": payload.get("tenant_access", [])
            }
            
        except jwt.InvalidTokenError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
    
    def require_role(self, required_role: str):
        """역할 기반 접근 제어"""
        def role_checker(user = Depends(self.verify_token)):
            if required_role not in user.get("roles", []):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Required role: {required_role}"
                )
            return user
        return role_checker

# API 엔드포인트에서 사용
@router.post("/tenants/")
async def create_tenant(
    request: TenantCreateRequest,
    user = Depends(auth_service.require_role("tenant_admin"))
):
    # 테넌트 생성 로직
    pass
```

#### 2. 네트워크 정책 설정
```yaml
# network-policies.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ecp-system-policy
  namespace: ecp-system
spec:
  podSelector:
    matchLabels:
      app: ecp-backend
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 8001
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: ecp-system
    ports:
    - protocol: TCP
      port: 5432  # PostgreSQL
    - protocol: TCP
      port: 6379  # Redis
  - to: []  # Kubernetes API
    ports:
    - protocol: TCP
      port: 443
```

### 🛡️ 시크릿 관리

#### 1. External Secrets Operator 사용
```yaml
# external-secrets.yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: vault-backend
  namespace: ecp-system
spec:
  provider:
    vault:
      server: "https://vault.your-company.com"
      path: "secret"
      version: "v2"
      auth:
        kubernetes:
          mountPath: "kubernetes"
          role: "ecp-orchestrator"
---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: ecp-database-secret
  namespace: ecp-system
spec:
  refreshInterval: 15m
  secretStoreRef:
    name: vault-backend
    kind: SecretStore
  target:
    name: ecp-database-credentials
    creationPolicy: Owner
  data:
  - secretKey: database-url
    remoteRef:
      key: ecp/database
      property: url
  - secretKey: redis-url
    remoteRef:
      key: ecp/redis
      property: url
```

---

## CI/CD 파이프라인 연동

### 🔄 GitHub Actions 워크플로우

#### 1. 빌드 및 배포 파이프라인
```yaml
# .github/workflows/production-deploy.yml
name: Production Deployment

on:
  push:
    branches: [main]
    tags: ['v*']

env:
  REGISTRY: your-registry.com
  IMAGE_NAME: ecp-orchestrator

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Install dependencies
      run: |
        pip install -r backend/requirements.txt
        pip install pytest pytest-cov
    
    - name: Run tests
      run: |
        cd backend
        pytest tests/ --cov=app --cov-report=xml
    
    - name: Build Docker images
      run: |
        docker build -t $REGISTRY/ecp-backend:$GITHUB_SHA backend/
        docker build -t $REGISTRY/ecp-frontend:$GITHUB_SHA frontend/
    
    - name: Push to registry
      run: |
        echo ${{ secrets.REGISTRY_PASSWORD }} | docker login $REGISTRY -u ${{ secrets.REGISTRY_USERNAME }} --password-stdin
        docker push $REGISTRY/ecp-backend:$GITHUB_SHA
        docker push $REGISTRY/ecp-frontend:$GITHUB_SHA

  deploy-staging:
    needs: build-and-test
    runs-on: ubuntu-latest
    environment: staging
    steps:
    - name: Deploy to staging
      run: |
        kubectl set image deployment/ecp-backend ecp-backend=$REGISTRY/ecp-backend:$GITHUB_SHA -n ecp-staging
        kubectl rollout status deployment/ecp-backend -n ecp-staging --timeout=300s

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    if: startsWith(github.ref, 'refs/tags/v')
    steps:
    - name: Deploy to production
      run: |
        kubectl set image deployment/ecp-backend ecp-backend=$REGISTRY/ecp-backend:$GITHUB_SHA -n ecp-system
        kubectl rollout status deployment/ecp-backend -n ecp-system --timeout=600s
    
    - name: Run smoke tests
      run: |
        curl -f https://api.your-company.com/health || exit 1
        curl -f https://api.your-company.com/ready || exit 1
```

#### 2. 테넌트 자동 배포 워크플로우
```yaml
# .github/workflows/tenant-deploy.yml
name: Tenant Auto Deploy

on:
  repository_dispatch:
    types: [tenant-created]

jobs:
  deploy-tenant:
    runs-on: ubuntu-latest
    steps:
    - name: Generate tenant manifest
      run: |
        TENANT_ID="${{ github.event.client_payload.tenant_id }}"
        curl -H "X-Demo-Mode: false" \
             -H "Authorization: Bearer ${{ secrets.ECP_API_TOKEN }}" \
             -o "tenant-${TENANT_ID}.yaml" \
             "https://api.your-company.com/api/v1/tenants/${TENANT_ID}/manifest"
    
    - name: Validate manifest
      run: |
        kubectl --dry-run=client apply -f tenant-*.yaml
    
    - name: Deploy to cluster
      run: |
        kubectl apply -f tenant-*.yaml
    
    - name: Wait for deployment
      run: |
        TENANT_ID="${{ github.event.client_payload.tenant_id }}"
        kubectl wait --for=condition=available --timeout=600s \
          deployment -l ecp.ai/tenant=${TENANT_ID} -n ecp-ai-${TENANT_ID}
    
    - name: Update deployment status
      run: |
        TENANT_ID="${{ github.event.client_payload.tenant_id }}"
        curl -X POST "https://api.your-company.com/api/v1/tenants/${TENANT_ID}/deployment-status" \
             -H "Authorization: Bearer ${{ secrets.ECP_API_TOKEN }}" \
             -H "Content-Type: application/json" \
             -d '{"status": "completed", "deployed_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}'
```

---

## 운영 모니터링 및 알림

### 📱 알림 시스템 구성

#### 1. Alertmanager 설정
```yaml
# alertmanager-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: alertmanager-config
  namespace: monitoring
data:
  alertmanager.yml: |
    global:
      smtp_smarthost: 'smtp.your-company.com:587'
      smtp_from: 'alerts@your-company.com'
    
    route:
      group_by: ['alertname']
      group_wait: 30s
      group_interval: 5m
      repeat_interval: 12h
      receiver: 'default'
      routes:
      - match:
          severity: critical
        receiver: 'critical-alerts'
      - match:
          alertname: ECPTenantDown
        receiver: 'tenant-alerts'
    
    receivers:
    - name: 'default'
      slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
        channel: '#ecp-alerts'
        title: 'ECP Orchestrator Alert'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
    
    - name: 'critical-alerts'
      email_configs:
      - to: 'ops-team@your-company.com'
        subject: 'CRITICAL: ECP Orchestrator Alert'
        body: |
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          Severity: {{ .Labels.severity }}
          {{ end }}
      slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
        channel: '#critical-alerts'
        title: 'CRITICAL: ECP Orchestrator'
        text: '@channel {{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
    
    - name: 'tenant-alerts'
      webhook_configs:
      - url: 'https://api.your-company.com/api/v1/webhooks/tenant-alert'
        send_resolved: true
```

#### 2. 커스텀 알림 핸들러
```python
# backend/app/webhooks/alert_handler.py
from fastapi import APIRouter, Request
from typing import Dict, Any
import logging

router = APIRouter()

@router.post("/webhooks/tenant-alert")
async def handle_tenant_alert(request: Request):
    """테넌트 관련 알림 처리"""
    alert_data = await request.json()
    
    for alert in alert_data.get("alerts", []):
        tenant_id = alert.get("labels", {}).get("tenant_id")
        alert_name = alert.get("labels", {}).get("alertname")
        status = alert.get("status")  # firing or resolved
        
        if tenant_id and alert_name == "ECPTenantDown":
            if status == "firing":
                await handle_tenant_down(tenant_id, alert)
            elif status == "resolved":
                await handle_tenant_recovered(tenant_id, alert)
    
    return {"status": "processed"}

async def handle_tenant_down(tenant_id: str, alert: Dict[str, Any]):
    """테넌트 다운 처리"""
    # 1. 데이터베이스에 장애 기록
    # 2. 자동 복구 시도
    # 3. 고객사 알림
    # 4. 에스컬레이션 프로세스 시작
    
    logging.critical(f"Tenant {tenant_id} is down. Starting recovery process.")
    
    # 자동 재시작 시도
    try:
        k8s_service = KubernetesDeploymentService()
        namespace = f"ecp-ai-{tenant_id}"
        
        # 디플로이먼트 재시작
        k8s_service.restart_deployment(tenant_id, namespace)
        
        # 5분 후 상태 재확인 스케줄
        schedule_health_check(tenant_id, delay=300)
        
    except Exception as e:
        logging.error(f"Auto-recovery failed for {tenant_id}: {e}")
        await escalate_alert(tenant_id, alert, str(e))

async def handle_tenant_recovered(tenant_id: str, alert: Dict[str, Any]):
    """테넌트 복구 처리"""
    logging.info(f"Tenant {tenant_id} has recovered.")
    
    # 복구 알림 발송
    await send_recovery_notification(tenant_id)
```

### 📊 운영 대시보드

#### 1. 종합 운영 대시보드
```python
# backend/app/api/v1/operations.py
from fastapi import APIRouter, Depends
from datetime import datetime, timedelta

router = APIRouter()

@router.get("/operations/dashboard")
async def get_operations_dashboard():
    """운영 대시보드 데이터 조회"""
    
    # 시스템 전체 상태
    system_status = await get_system_health()
    
    # 테넌트 통계
    tenant_stats = await get_tenant_statistics()
    
    # 리소스 사용률
    resource_usage = await get_cluster_resource_usage()
    
    # 최근 배포 내역
    recent_deployments = await get_recent_deployments(hours=24)
    
    # 활성 알림
    active_alerts = await get_active_alerts()
    
    return {
        "timestamp": datetime.utcnow(),
        "system_status": system_status,
        "tenant_stats": tenant_stats,
        "resource_usage": resource_usage,
        "recent_deployments": recent_deployments,
        "active_alerts": active_alerts,
        "sla_metrics": {
            "availability": calculate_availability(),
            "avg_response_time": calculate_avg_response_time(),
            "deployment_success_rate": calculate_deployment_success_rate()
        }
    }

async def get_system_health():
    """시스템 전체 건강 상태"""
    return {
        "overall_status": "healthy",  # healthy, degraded, critical
        "components": {
            "api": {"status": "healthy", "response_time": 45},
            "database": {"status": "healthy", "connections": 15},
            "redis": {"status": "healthy", "memory_usage": 65},
            "kubernetes": {"status": "healthy", "nodes_ready": "3/3"}
        }
    }

async def get_tenant_statistics():
    """테넌트 통계"""
    return {
        "total_tenants": 156,
        "active_tenants": 142,
        "pending_deployments": 3,
        "failed_deployments": 1,
        "by_preset": {
            "small": 45,
            "medium": 78,
            "large": 33
        },
        "resource_utilization": {
            "cpu": 67.5,
            "memory": 72.1,
            "gpu": 84.3
        }
    }
```

---

## 백업 및 재해복구

### 💾 데이터 백업 전략

#### 1. 데이터베이스 백업
```yaml
# backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgresql-backup
  namespace: ecp-system
spec:
  schedule: "0 2 * * *"  # 매일 오전 2시
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: postgres-backup
            image: postgres:15-alpine
            command:
            - /bin/bash
            - -c
            - |
              BACKUP_FILE="/backup/ecp-$(date +%Y%m%d_%H%M%S).sql"
              pg_dump $DATABASE_URL > $BACKUP_FILE
              gzip $BACKUP_FILE
              
              # S3에 업로드
              aws s3 cp ${BACKUP_FILE}.gz s3://ecp-backups/database/
              
              # 로컬 파일 정리 (7일 이상 된 파일 삭제)
              find /backup -name "*.sql.gz" -mtime +7 -delete
            env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: ecp-postgresql-credentials
                  key: connection-string
            - name: AWS_ACCESS_KEY_ID
              valueFrom:
                secretKeyRef:
                  name: aws-credentials
                  key: access-key-id
            - name: AWS_SECRET_ACCESS_KEY
              valueFrom:
                secretKeyRef:
                  name: aws-credentials
                  key: secret-access-key
            volumeMounts:
            - name: backup-storage
              mountPath: /backup
          volumes:
          - name: backup-storage
            persistentVolumeClaim:
              claimName: backup-pvc
          restartPolicy: OnFailure
```

#### 2. 설정 백업
```bash
#!/bin/bash
# backup-configs.sh

BACKUP_DIR="/backup/configs/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

# Kubernetes 리소스 백업
kubectl get all -n ecp-system -o yaml > $BACKUP_DIR/ecp-system-resources.yaml
kubectl get secrets -n ecp-system -o yaml > $BACKUP_DIR/ecp-system-secrets.yaml
kubectl get configmaps -n ecp-system -o yaml > $BACKUP_DIR/ecp-system-configmaps.yaml

# 테넌트 네임스페이스 백업
for ns in $(kubectl get ns -l ecp.ai/tenant -o jsonpath='{.items[*].metadata.name}'); do
    kubectl get all -n $ns -o yaml > $BACKUP_DIR/tenant-${ns}.yaml
done

# 압축 및 S3 업로드
tar -czf $BACKUP_DIR.tar.gz $BACKUP_DIR
aws s3 cp $BACKUP_DIR.tar.gz s3://ecp-backups/configs/

# 정리
rm -rf $BACKUP_DIR
```

### 🔄 재해복구 절차

#### 1. 데이터베이스 복구
```bash
#!/bin/bash
# restore-database.sh

BACKUP_DATE=$1
if [ -z "$BACKUP_DATE" ]; then
    echo "Usage: $0 <BACKUP_DATE> (format: YYYYMMDD_HHMMSS)"
    exit 1
fi

# S3에서 백업 다운로드
aws s3 cp s3://ecp-backups/database/ecp-${BACKUP_DATE}.sql.gz /tmp/

# 압축 해제
gunzip /tmp/ecp-${BACKUP_DATE}.sql.gz

# 데이터베이스 복구
kubectl exec -n ecp-system postgresql-0 -- psql -U ecp_user -d ecp_orchestrator < /tmp/ecp-${BACKUP_DATE}.sql

echo "Database restored from backup: $BACKUP_DATE"
```

#### 2. 전체 시스템 복구
```yaml
# disaster-recovery-playbook.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: disaster-recovery-playbook
  namespace: ecp-system
data:
  recovery-steps.md: |
    # ECP Orchestrator 재해복구 절차
    
    ## 1. 인프라 복구 (30분)
    - [ ] Kubernetes 클러스터 상태 확인
    - [ ] 네트워크 연결 확인
    - [ ] 스토리지 볼륨 상태 확인
    
    ## 2. 데이터베이스 복구 (45분)
    - [ ] PostgreSQL 클러스터 복구
    - [ ] 최신 백업에서 데이터 복원
    - [ ] 데이터 무결성 검증
    
    ## 3. 애플리케이션 복구 (30분)
    - [ ] ECP Orchestrator 서비스 배포
    - [ ] 설정 파일 복원
    - [ ] 서비스 연결 테스트
    
    ## 4. 테넌트 복구 (60분)
    - [ ] 테넌트 매니페스트 복원
    - [ ] 테넌트 서비스 재배포
    - [ ] 서비스 상태 확인
    
    ## 5. 검증 및 모니터링 (30분)
    - [ ] 전체 시스템 기능 테스트
    - [ ] 모니터링 시스템 연결
    - [ ] 알림 시스템 동작 확인
    
    ## 총 예상 복구 시간: 3시간 15분
```

---

## 성능 최적화

### ⚡ 시스템 성능 튜닝

#### 1. 데이터베이스 최적화
```sql
-- 인덱스 최적화
CREATE INDEX CONCURRENTLY idx_tenants_status_created 
ON tenants(status, created_at) WHERE status = 'running';

CREATE INDEX CONCURRENTLY idx_monitoring_tenant_time 
ON monitoring_data(tenant_id, timestamp DESC) 
WHERE timestamp > NOW() - INTERVAL '30 days';

-- 파티셔닝 설정
CREATE TABLE monitoring_data_2024_01 PARTITION OF monitoring_data
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- 통계 업데이트 자동화
CREATE OR REPLACE FUNCTION update_tenant_stats()
RETURNS void AS $$
BEGIN
    ANALYZE tenants;
    ANALYZE monitoring_data;
    ANALYZE services;
END;
$$ LANGUAGE plpgsql;

-- 매일 새벽 2시 통계 업데이트
SELECT cron.schedule('update-stats', '0 2 * * *', 'SELECT update_tenant_stats();');
```

#### 2. API 성능 최적화
```python
# backend/app/core/cache.py
import redis
from functools import wraps
import json
import hashlib

class CacheManager:
    def __init__(self, redis_url: str):
        self.redis = redis.from_url(redis_url)
        self.default_ttl = 300  # 5분
    
    def cache_result(self, ttl: int = None):
        """결과 캐싱 데코레이터"""
        def decorator(func):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                # 캐시 키 생성
                cache_key = self._generate_cache_key(func.__name__, args, kwargs)
                
                # 캐시에서 조회
                cached_result = self.redis.get(cache_key)
                if cached_result:
                    return json.loads(cached_result)
                
                # 함수 실행
                result = await func(*args, **kwargs)
                
                # 결과 캐싱
                self.redis.setex(
                    cache_key, 
                    ttl or self.default_ttl, 
                    json.dumps(result, default=str)
                )
                
                return result
            return wrapper
        return decorator
    
    def _generate_cache_key(self, func_name: str, args, kwargs) -> str:
        """캐시 키 생성"""
        key_data = f"{func_name}:{args}:{sorted(kwargs.items())}"
        return hashlib.md5(key_data.encode()).hexdigest()

# 사용 예시
cache = CacheManager(redis_url="redis://localhost:6379")

@cache.cache_result(ttl=600)  # 10분 캐싱
async def get_tenant_statistics():
    # 무거운 통계 계산
    return await calculate_complex_stats()
```

#### 3. Kubernetes 리소스 최적화
```yaml
# resource-optimization.yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: ecp-tenant-limits
  namespace: ecp-tenants
spec:
  limits:
  - type: Container
    default:
      cpu: "1000m"
      memory: "2Gi"
    defaultRequest:
      cpu: "100m"
      memory: "256Mi"
    max:
      cpu: "4000m"
      memory: "8Gi"
    min:
      cpu: "50m"
      memory: "128Mi"
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: ecp-tenant-quota
  namespace: ecp-tenants
spec:
  hard:
    requests.cpu: "100"
    requests.memory: "200Gi"
    limits.cpu: "200"
    limits.memory: "400Gi"
    persistentvolumeclaims: "50"
    services: "100"
```

#### 4. 모니터링 최적화
```yaml
# monitoring-optimization.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config-optimized
  namespace: monitoring
data:
  prometheus.yml: |
    global:
      scrape_interval: 30s
      evaluation_interval: 30s
      external_labels:
        cluster: 'ecp-production'
    
    rule_files:
    - "ecp-rules.yml"
    
    scrape_configs:
    - job_name: 'ecp-orchestrator'
      scrape_interval: 15s
      static_configs:
      - targets: ['ecp-backend-service:8001']
      metric_relabel_configs:
      - source_labels: [__name__]
        regex: 'go_.*'
        action: drop  # Go 런타임 메트릭 제외
    
    - job_name: 'kubernetes-pods'
      kubernetes_sd_configs:
      - role: pod
      relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_label_ecp_ai_tenant]
        target_label: tenant_id
        regex: (.+)
      - source_labels: [__meta_kubernetes_pod_container_name]
        target_label: container
    
    # 장기 보관용 다운샘플링
    - job_name: 'ecp-long-term'
      scrape_interval: 5m
      static_configs:
      - targets: ['ecp-backend-service:8001']
      metric_relabel_configs:
      - source_labels: [__name__]
        regex: 'ecp_tenant_(cpu|memory|gpu)_usage'
        action: keep
```

---

*이 문서는 ECP-AI Kubernetes Orchestrator의 실사용 환경 구축을 위한 완전한 가이드입니다. 각 섹션의 설정은 실제 운영 환경에 맞게 조정하여 사용하시기 바랍니다.*
