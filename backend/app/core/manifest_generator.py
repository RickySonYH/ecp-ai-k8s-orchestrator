# [advice from AI] ECP-AI Kubernetes 매니페스트 생성기
"""
Kubernetes 매니페스트 파일 자동 생성
- 테넌시 사양 기반 YAML 매니페스트 생성
- Jinja2 템플릿 기반 동적 생성
- 다운로드 가능한 ZIP 파일 생성
"""

import os
import yaml
import zipfile
from io import BytesIO
from typing import Dict, Any, List
from pathlib import Path
from jinja2 import Template, Environment, FileSystemLoader
import structlog

from .tenant_manager import TenantSpecs

logger = structlog.get_logger(__name__)


class ManifestGenerator:
    """Kubernetes 매니페스트 생성기"""
    
    def __init__(self, templates_path: str = "/app/config/k8s-templates"):
        self.templates_path = Path(templates_path)
        self.jinja_env = Environment(
            loader=FileSystemLoader(str(self.templates_path)),
            autoescape=False,
            trim_blocks=True,
            lstrip_blocks=True
        )
        
        # 기본 템플릿들 (내장)
        self.builtin_templates = {
            "namespace": self._get_namespace_template(),
            "deployment": self._get_deployment_template(),
            "service": self._get_service_template(),
            "hpa": self._get_hpa_template(),
            "configmap": self._get_configmap_template(),
            "networkpolicy": self._get_networkpolicy_template()
        }
        
        logger.info("ManifestGenerator 초기화 완료", templates_path=str(self.templates_path))
    
    def generate_tenant_manifests(self, tenant_specs: TenantSpecs) -> Dict[str, str]:
        """
        테넌시 전체 매니페스트 생성
        """
        logger.info("테넌시 매니페스트 생성 시작", tenant_id=tenant_specs.tenant_id)
        
        manifests = {}
        
        # 1. 네임스페이스
        manifests["01-namespace.yaml"] = self._generate_namespace(tenant_specs)
        
        # 2. ConfigMap
        manifests["02-configmap.yaml"] = self._generate_configmap(tenant_specs)
        
        # 3. 서비스별 매니페스트 (기본 서비스들)
        service_count = 3
        
        # 기본 서비스들 생성
        basic_services = ["callbot", "chatbot", "advisor", "stt", "tts", "ta", "qa"]
        for service_name in basic_services:
            # Deployment
            manifests[f"{service_count:02d}-{service_name}-deployment.yaml"] = \
                self._generate_deployment(tenant_specs, service_name)
            
            # Service
            manifests[f"{service_count:02d}-{service_name}-service.yaml"] = \
                self._generate_service(tenant_specs, service_name)
            
            # HPA (기본적으로 활성화)
            manifests[f"{service_count:02d}-{service_name}-hpa.yaml"] = \
                self._generate_hpa(tenant_specs, service_name)
            
            service_count += 1
        
        # 4. 네트워크 정책
        manifests["90-networkpolicy.yaml"] = self._generate_networkpolicy(tenant_specs)
        
        # 5. 모니터링 설정
        manifests["91-monitoring.yaml"] = self._generate_monitoring(tenant_specs)
        
        logger.info(
            "테넌시 매니페스트 생성 완료",
            tenant_id=tenant_specs.tenant_id,
            manifest_count=len(manifests)
        )
        
        return manifests
    
    def create_deployment_package(self, tenant_specs: TenantSpecs) -> BytesIO:
        """
        배포 패키지 ZIP 파일 생성
        """
        logger.info("배포 패키지 생성 시작", tenant_id=tenant_specs.tenant_id)
        
        # 매니페스트 생성
        manifests = self.generate_tenant_manifests(tenant_specs)
        
        # ZIP 파일 생성
        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            
            # Kubernetes 매니페스트 추가
            for filename, content in manifests.items():
                zip_file.writestr(f"k8s-manifests/{filename}", content)
            
            # 배포 스크립트 추가
            deploy_script = self._generate_deploy_script(tenant_specs)
            zip_file.writestr("deploy.sh", deploy_script)
            
            # 삭제 스크립트 추가
            cleanup_script = self._generate_cleanup_script(tenant_specs)
            zip_file.writestr("cleanup.sh", cleanup_script)
            
            # README 추가
            readme_content = self._generate_readme(tenant_specs)
            zip_file.writestr("README.md", readme_content)
            
            # 테넌시 사양 JSON 추가
            import json
            try:
                specs_json = json.dumps(tenant_specs.model_dump(), indent=2, ensure_ascii=False)
                zip_file.writestr("tenant-specs.json", specs_json)
            except Exception as e:
                logger.warning("테넌시 사양 JSON 생성 실패", error=str(e))
                # 기본 정보만 포함
                basic_specs = {
                    "tenant_id": tenant_specs.tenant_id,
                    "preset": tenant_specs.preset,
                    "services": ["callbot", "chatbot", "advisor", "stt", "tts", "ta", "qa"]
                }
                specs_json = json.dumps(basic_specs, indent=2, ensure_ascii=False)
                zip_file.writestr("tenant-specs.json", specs_json)
        
        zip_buffer.seek(0)
        
        logger.info("배포 패키지 생성 완료", tenant_id=tenant_specs.tenant_id)
        return zip_buffer
    
    def _generate_namespace(self, tenant_specs: TenantSpecs) -> str:
        """네임스페이스 매니페스트 생성"""
        template = Template(self.builtin_templates["namespace"])
        return template.render(
            tenant_id=tenant_specs.tenant_id,
            tenant_preset=tenant_specs.preset
        )
    
    def _generate_deployment(self, tenant_specs: TenantSpecs, service_name: str) -> str:
        """Deployment 매니페스트 생성"""
        try:
            template = Template(self.builtin_templates["deployment"])
            
            # GPU 할당 정보 (새로운 TenantSpecs 모델 기반)
            has_gpu = service_name in ["tts", "nlp", "aicm"] and tenant_specs.gpu_count > 0
            gpu_type = tenant_specs.gpu_type.value if has_gpu else "t4"
            gpu_count = 1 if has_gpu else 0
            
            # 기본 container_specs 설정
            container_specs = {
                "image": f"ecp-ai/{service_name}:latest",
                "ports": [{"containerPort": 8080, "protocol": "TCP"}],
                "env": [],
                "resources": {
                    "requests": {"cpu": "100m", "memory": "256Mi"},
                    "limits": {"cpu": "1000m", "memory": "1Gi"}
                }
            }
            
            return template.render(
                tenant_id=tenant_specs.tenant_id,
                service_name=service_name,
                replicas=1,
                has_gpu=has_gpu,
                gpu_type=gpu_type,
                gpu_count=gpu_count,
                namespace=f"{tenant_specs.tenant_id}-ecp-ai",
                container_specs=container_specs
            )
        except Exception as e:
            logger.error("Deployment 매니페스트 생성 실패", 
                        service_name=service_name, error=str(e))
            # 기본 매니페스트 반환
            return self._generate_basic_deployment(tenant_specs, service_name)
    
    def _generate_basic_deployment(self, tenant_specs: TenantSpecs, service_name: str) -> str:
        """기본 Deployment 매니페스트 생성 (템플릿 오류 시 폴백)"""
        # GPU 할당 정보 (새로운 TenantSpecs 모델 기반)
        has_gpu = service_name in ["tts", "nlp", "aicm"] and tenant_specs.gpu_count > 0
        
        basic_deployment = f"""---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {service_name}
  namespace: {tenant_specs.tenant_id}-ecp-ai
  labels:
    app: {service_name}
    tenant: {tenant_specs.tenant_id}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: {service_name}
      tenant: {tenant_specs.tenant_id}
  template:
    metadata:
      labels:
        app: {service_name}
        tenant: {tenant_specs.tenant_id}
        monitoring: enabled
    spec:"""

        if has_gpu:
            gpu_type = tenant_specs.gpu_type.value
            basic_deployment += f"""
      nodeSelector:
        accelerator: nvidia-{gpu_type}
      tolerations:
      - key: nvidia.com/gpu
        operator: Equal
        value: present
        effect: NoSchedule"""

        basic_deployment += f"""
      containers:
      - name: {service_name}
        image: ecp-ai/{service_name}:latest
        ports:
        - containerPort: 8080
        env:
        - name: TENANT_ID
          value: {tenant_specs.tenant_id}
        - name: SERVICE_NAME
          value: {service_name}"""

        if has_gpu:
            basic_deployment += f"""
        resources:
          requests:
            nvidia.com/gpu: 1
            cpu: 1000m
            memory: 2Gi
          limits:
            nvidia.com/gpu: 1
            cpu: 4000m
            memory: 8Gi"""
        else:
            basic_deployment += f"""
        resources:
          requests:
            cpu: 500m
            memory: 1Gi
          limits:
            cpu: 2000m
            memory: 4Gi"""

        basic_deployment += f"""
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
"""
        
        return basic_deployment
    
    def _generate_service(self, tenant_specs: TenantSpecs, service_name: str) -> str:
        """Service 매니페스트 생성"""
        try:
            template = Template(self.builtin_templates["service"])
            
            # 기본 포트 설정
            ports = [{"containerPort": 8080}]
            
            return template.render(
                tenant_id=tenant_specs.tenant_id,
                service_name=service_name,
                ports=ports,
                namespace=f"{tenant_specs.tenant_id}-ecp-ai"
            )
        except Exception as e:
            logger.error("Service 매니페스트 생성 실패", 
                        service_name=service_name, error=str(e))
            # 기본 Service 매니페스트 반환
            return f"""---
apiVersion: v1
kind: Service
metadata:
  name: {service_name}-service
  namespace: {tenant_specs.tenant_id}-ecp-ai
  labels:
    app: {service_name}
    tenant: {tenant_specs.tenant_id}
    monitoring: enabled
spec:
  selector:
    app: {service_name}
    tenant: {tenant_specs.tenant_id}
  ports:
  - name: http
    port: 8080
    targetPort: 8080
    protocol: TCP
  type: ClusterIP
"""
    
    def _generate_hpa(self, tenant_specs: TenantSpecs, service_name: str) -> str:
        """HPA 매니페스트 생성"""
        template = Template(self.builtin_templates["hpa"])
        
        # 기본 스케일링 설정
        min_replicas = 1
        max_replicas = 10
        target_cpu = 70
        
        return template.render(
            tenant_id=tenant_specs.tenant_id,
            service_name=service_name,
            min_replicas=min_replicas,
            max_replicas=max_replicas,
            target_cpu=target_cpu,
            namespace=f"{tenant_specs.tenant_id}-ecp-ai"
        )
    
    def _generate_configmap(self, tenant_specs: TenantSpecs) -> str:
        """ConfigMap 매니페스트 생성"""
        try:
            template = Template(self.builtin_templates["configmap"])
            
            return template.render(
                tenant_id=tenant_specs.tenant_id,
                tenant_specs=tenant_specs,
                namespace=f"{tenant_specs.tenant_id}-ecp-ai"
            )
        except Exception as e:
            logger.error("ConfigMap 매니페스트 생성 실패", error=str(e))
            # 기본 ConfigMap 반환
            return f"""---
apiVersion: v1
kind: ConfigMap
metadata:
  name: ecp-config
  namespace: {tenant_specs.tenant_id}-ecp-ai
  labels:
    tenant: {tenant_specs.tenant_id}
data:
  tenant-config.yaml: |
    tenantId: {tenant_specs.tenant_id}
    preset: {tenant_specs.preset}
    services: {{}}
    resources:
      gpu_type: {tenant_specs.gpu_type.value}
      auto_scaling: true
"""
    
    def _generate_networkpolicy(self, tenant_specs: TenantSpecs) -> str:
        """NetworkPolicy 매니페스트 생성"""
        template = Template(self.builtin_templates["networkpolicy"])
        
        return template.render(
            tenant_id=tenant_specs.tenant_id,
            namespace=f"{tenant_specs.tenant_id}-ecp-ai"
        )
    
    def _generate_monitoring(self, tenant_specs: TenantSpecs) -> str:
        """모니터링 설정 매니페스트 생성"""
        monitoring_yaml = {
            "apiVersion": "monitoring.coreos.com/v1",
            "kind": "ServiceMonitor",
            "metadata": {
                "name": "ecp-ai-monitoring",
                "namespace": f"{tenant_specs.tenant_id}-ecp-ai",
                "labels": {
                    "tenant": tenant_specs.tenant_id,
                    "app.kubernetes.io/name": "ecp-ai"
                }
            },
            "spec": {
                "selector": {
                    "matchLabels": {
                        "monitoring": "enabled"
                    }
                },
                "endpoints": [
                    {
                        "port": "metrics",
                        "interval": "30s",
                        "path": "/metrics"
                    }
                ]
            }
        }
        
        return yaml.dump(monitoring_yaml, default_flow_style=False, allow_unicode=True)
    
    def _generate_deploy_script(self, tenant_specs: TenantSpecs) -> str:
        """배포 스크립트 생성"""
        return f"""#!/bin/bash
# [advice from AI] ECP-AI 테넌시 '{tenant_specs.tenant_id}' 배포 스크립트

set -e

echo "🚀 ECP-AI 테넌시 '{tenant_specs.tenant_id}' 배포 시작"
echo "프리셋: {tenant_specs.preset}"
echo "GPU 타입: {tenant_specs.gpu_type.value}"
echo "예상 리소스: GPU {tenant_specs.gpu_count}개, CPU {tenant_specs.cpu_cores}코어"
echo ""

# 1. 네임스페이스 생성
echo "📁 네임스페이스 생성 중..."
kubectl apply -f k8s-manifests/01-namespace.yaml

# 2. ConfigMap 생성
echo "⚙️ 설정 파일 생성 중..."
kubectl apply -f k8s-manifests/02-configmap.yaml

# 3. 서비스별 배포
echo "🛠️ 서비스 배포 중..."
for manifest in k8s-manifests/*-deployment.yaml; do
    if [ -f "$manifest" ]; then
        echo "배포 중: $(basename $manifest)"
        kubectl apply -f "$manifest"
    fi
done

for manifest in k8s-manifests/*-service.yaml; do
    if [ -f "$manifest" ]; then
        echo "서비스 생성: $(basename $manifest)"
        kubectl apply -f "$manifest"
    fi
done

# 4. 오토스케일링 설정
echo "📈 오토스케일링 설정 중..."
for manifest in k8s-manifests/*-hpa.yaml; do
    if [ -f "$manifest" ]; then
        echo "HPA 생성: $(basename $manifest)"
        kubectl apply -f "$manifest"
    fi
done

# 5. 네트워크 정책 및 모니터링
echo "🔒 보안 정책 설정 중..."
kubectl apply -f k8s-manifests/90-networkpolicy.yaml
kubectl apply -f k8s-manifests/91-monitoring.yaml

echo ""
echo "✅ 테넌시 '{tenant_specs.tenant_id}' 배포 완료!"
echo ""
echo "📊 상태 확인:"
echo "  kubectl get pods -n {tenant_specs.tenant_id}-ecp-ai"
echo "  kubectl get services -n {tenant_specs.tenant_id}-ecp-ai"
echo "  kubectl get hpa -n {tenant_specs.tenant_id}-ecp-ai"
echo ""
echo "🔍 로그 확인:"
echo "  kubectl logs -f deployment/<service-name> -n {tenant_specs.tenant_id}-ecp-ai"
echo ""
echo "🗑️ 삭제 방법:"
echo "  ./cleanup.sh"
"""

    def _generate_cleanup_script(self, tenant_specs: TenantSpecs) -> str:
        """정리 스크립트 생성"""
        return f"""#!/bin/bash
# [advice from AI] ECP-AI 테넌시 '{tenant_specs.tenant_id}' 정리 스크립트

set -e

echo "🗑️ ECP-AI 테넌시 '{tenant_specs.tenant_id}' 삭제 시작"
echo ""

read -p "정말로 테넌시 '{tenant_specs.tenant_id}'를 삭제하시겠습니까? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "삭제 취소됨"
    exit 0
fi

echo "🧹 네임스페이스 및 모든 리소스 삭제 중..."
kubectl delete namespace {tenant_specs.tenant_id}-ecp-ai --ignore-not-found=true

echo ""
echo "✅ 테넌시 '{tenant_specs.tenant_id}' 삭제 완료!"
echo ""
echo "📊 확인:"
echo "  kubectl get namespaces | grep {tenant_specs.tenant_id}"
"""

    def _generate_readme(self, tenant_specs: TenantSpecs) -> str:
        """README 파일 생성"""
        # 기본 서비스 목록
        basic_services = ["callbot", "chatbot", "advisor", "stt", "tts", "ta", "qa"]
        services_list = "\n".join([
            f"- **{name}**: 1개 인스턴스"
            for name in basic_services
        ])
        
        return f"""# ECP-AI 테넌시: {tenant_specs.tenant_id}

## 📋 테넌시 정보

- **테넌시 ID**: {tenant_specs.tenant_id}
- **프리셋**: {tenant_specs.preset}
- **GPU 타입**: {tenant_specs.gpu_type.value}
- **예상 리소스**: GPU {tenant_specs.gpu_count}개, CPU {tenant_specs.cpu_cores}코어

## 🛠️ 서비스 구성

{services_list}

## 🚀 배포 방법

### 1. 사전 요구사항
- Kubernetes 클러스터 접근 권한
- kubectl 명령어 설치
- 충분한 클러스터 리소스

### 2. 배포 실행
```bash
# 실행 권한 부여
chmod +x deploy.sh cleanup.sh

# 배포 실행
./deploy.sh
```

### 3. 상태 확인
```bash
# Pod 상태 확인
kubectl get pods -n {tenant_specs.tenant_id}-ecp-ai

# 서비스 상태 확인
kubectl get services -n {tenant_specs.tenant_id}-ecp-ai

# HPA 상태 확인
kubectl get hpa -n {tenant_specs.tenant_id}-ecp-ai
```

### 4. 로그 확인
```bash
# 전체 Pod 로그
kubectl logs -f -l tenant={tenant_specs.tenant_id} -n {tenant_specs.tenant_id}-ecp-ai

# 특정 서비스 로그
kubectl logs -f deployment/<service-name> -n {tenant_specs.tenant_id}-ecp-ai
```

## 🗑️ 삭제 방법

```bash
# 전체 테넌시 삭제
./cleanup.sh

# 또는 수동 삭제
kubectl delete namespace {tenant_specs.tenant_id}-ecp-ai
```

## 📊 예상 리소스 사용량

### GPU 요구사항
- **GPU 타입**: {tenant_specs.gpu_type.value}
- **GPU 개수**: {tenant_specs.gpu_count}개
- **GPU 메모리**: {tenant_specs.memory_gb}GB

### CPU 요구사항  
- **CPU 코어**: {tenant_specs.cpu_cores}개
- **메모리**: {tenant_specs.memory_gb}GB
- **스토리지**: {tenant_specs.storage_gb}GB

## ⚠️ 주의사항

1. **리소스 확인**: 클러스터에 충분한 GPU/CPU 리소스가 있는지 확인하세요
2. **네트워크 정책**: 기존 네트워크 정책과 충돌하지 않는지 확인하세요
3. **모니터링**: Prometheus Operator가 설치되어 있어야 모니터링이 작동합니다
4. **스토리지**: PersistentVolume이 필요한 서비스가 있을 수 있습니다

## 📞 지원

문제가 발생하면 ECP-AI 지원팀에 문의하세요.
- 이메일: support@ecp-ai.com
- 문서: https://docs.ecp-ai.com
"""

    # 템플릿 정의들
    def _get_namespace_template(self) -> str:
        return """---
apiVersion: v1
kind: Namespace
metadata:
  name: {{ tenant_id }}-ecp-ai
  labels:
    tenant: {{ tenant_id }}
    app.kubernetes.io/name: ecp-ai
    app.kubernetes.io/managed-by: ecp-orchestrator
    tier: {{ tenant_preset }}
    ecp.ai/tenant-id: {{ tenant_id }}
    ecp.ai/preset: {{ tenant_preset }}
  annotations:
    ecp.ai/created-by: ecp-orchestrator
    ecp.ai/description: "ECP-AI tenant namespace for {{ tenant_id }}"
"""

    def _get_deployment_template(self) -> str:
        return """---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ service_name }}
  namespace: {{ namespace }}
  labels:
    app: {{ service_name }}
    tenant: {{ tenant_id }}
    ecp.ai/tenant-id: {{ tenant_id }}
    ecp.ai/service: {{ service_name }}
spec:
  replicas: {{ replicas }}
  selector:
    matchLabels:
      app: {{ service_name }}
      tenant: {{ tenant_id }}
  template:
    metadata:
      labels:
        app: {{ service_name }}
        tenant: {{ tenant_id }}
        ecp.ai/tenant-id: {{ tenant_id }}
        ecp.ai/service: {{ service_name }}
        monitoring: enabled
    spec:
      {% if has_gpu %}
      nodeSelector:
        accelerator: nvidia-{{ gpu_type }}
      tolerations:
      - key: nvidia.com/gpu
        operator: Equal
        value: present
        effect: NoSchedule
      {% endif %}
      containers:
      - name: {{ service_name }}
        image: {{ container_specs.image }}
        ports:
        {% for port in container_specs.ports %}
        - containerPort: {{ port.containerPort }}
          protocol: {{ port.get('protocol', 'TCP') }}
        {% endfor %}
        env:
        - name: TENANT_ID
          value: {{ tenant_id }}
        - name: SERVICE_NAME
          value: {{ service_name }}
        {% if has_gpu %}
        - name: GPU_TYPE
          value: {{ gpu_type }}
        {% endif %}
        {% for env_var in container_specs.get('env', []) %}
        - name: {{ env_var.name }}
          value: {{ env_var.value }}
        {% endfor %}
        resources:
          requests:
            {% if has_gpu %}
            nvidia.com/gpu: {{ gpu_count }}
            {% endif %}
            cpu: {{ container_specs.get('resources', {}).get('requests', {}).get('cpu', '100m') }}
            memory: {{ container_specs.get('resources', {}).get('requests', {}).get('memory', '256Mi') }}
          limits:
            {% if has_gpu %}
            nvidia.com/gpu: {{ gpu_count }}
            {% endif %}
            cpu: {{ container_specs.get('resources', {}).get('limits', {}).get('cpu', '1000m') }}
            memory: {{ container_specs.get('resources', {}).get('limits', {}).get('memory', '1Gi') }}
        livenessProbe:
          httpGet:
            path: /health
            port: {{ container_specs.ports[0].containerPort }}
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: {{ container_specs.ports[0].containerPort }}
          initialDelaySeconds: 5
          periodSeconds: 5
"""

    def _get_service_template(self) -> str:
        return """---
apiVersion: v1
kind: Service
metadata:
  name: {{ service_name }}-service
  namespace: {{ namespace }}
  labels:
    app: {{ service_name }}
    tenant: {{ tenant_id }}
    ecp.ai/tenant-id: {{ tenant_id }}
    ecp.ai/service: {{ service_name }}
    monitoring: enabled
spec:
  selector:
    app: {{ service_name }}
    tenant: {{ tenant_id }}
  ports:
  {% for port in ports %}
  - name: port-{{ port.containerPort }}
    port: {{ port.containerPort }}
    targetPort: {{ port.containerPort }}
    protocol: {{ port.get('protocol', 'TCP') }}
  {% endfor %}
  type: ClusterIP
"""

    def _get_hpa_template(self) -> str:
        return """---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ service_name }}-hpa
  namespace: {{ namespace }}
  labels:
    app: {{ service_name }}
    tenant: {{ tenant_id }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ service_name }}
  minReplicas: {{ min_replicas }}
  maxReplicas: {{ max_replicas }}
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: {{ target_cpu }}
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
"""

    def _get_configmap_template(self) -> str:
        return """---
apiVersion: v1
kind: ConfigMap
metadata:
  name: ecp-config
  namespace: {{ namespace }}
  labels:
    tenant: {{ tenant_id }}
    ecp.ai/tenant-id: {{ tenant_id }}
data:
  tenant-config.yaml: |
    tenantId: {{ tenant_id }}
    preset: {{ tenant_specs.preset }}
    services:
      callbot:
        enabled: true
        count: 1
      chatbot:
        enabled: true
        count: 1
      advisor:
        enabled: true
        count: 1
      stt:
        enabled: true
        count: 1
      tts:
        enabled: true
        count: 1
      ta:
        enabled: true
        count: 1
      qa:
        enabled: true
        count: 1
    resources:
      gpu_type: {{ tenant_specs.gpu_type.value }}
      gpu_count: {{ tenant_specs.gpu_count }}
      cpu_cores: {{ tenant_specs.cpu_cores }}
    sla:
      availability: 99.9
      response_time: 300
"""

    def _get_networkpolicy_template(self) -> str:
        return """---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ecp-ai-network-policy
  namespace: {{ namespace }}
  labels:
    tenant: {{ tenant_id }}
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          ecp.ai/tenant-id: {{ tenant_id }}
  - from:
    - namespaceSelector:
        matchLabels:
          name: monitoring
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 8080
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          ecp.ai/tenant-id: {{ tenant_id }}
  - to: []
    ports:
    - protocol: TCP
      port: 443
    - protocol: TCP
      port: 53
    - protocol: UDP
      port: 53
"""
