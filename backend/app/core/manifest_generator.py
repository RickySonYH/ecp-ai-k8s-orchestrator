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
        테넌시 전체 매니페스트 생성 (실제 서버 구성 기반)
        [advice from AI] 실제 하드웨어 스펙 계산과 일치하도록 매니페스트 생성 수정
        """
        logger.info("테넌시 매니페스트 생성 시작", tenant_id=tenant_specs.tenant_id)
        
        manifests = {}
        service_count = 3
        
        # 1. 네임스페이스
        manifests["01-namespace.yaml"] = self._generate_namespace(tenant_specs)
        
        # 2. ConfigMap
        manifests["02-configmap.yaml"] = self._generate_configmap(tenant_specs)
        
        # 3. GPU 전용 서비스들 (실제 서버 구성 반영)
        gpu_services = ["tts-server", "nlp-server", "aicm-server"]
        for gpu_service in gpu_services:
            if self._should_create_gpu_service(tenant_specs, gpu_service):
                # Deployment
                manifests[f"{service_count:02d}-{gpu_service}-deployment.yaml"] = \
                    self._generate_gpu_deployment(tenant_specs, gpu_service)
                
                # Service
                manifests[f"{service_count:02d}-{gpu_service}-service.yaml"] = \
                    self._generate_service(tenant_specs, gpu_service)
                
                # HPA (GPU 서비스는 제한적 스케일링)
                manifests[f"{service_count:02d}-{gpu_service}-hpa.yaml"] = \
                    self._generate_gpu_hpa(tenant_specs, gpu_service)
                
                service_count += 1
        
        # 4. CPU 전용 서비스들 (음성/텍스트 처리)
        cpu_services = ["stt-server", "ta-server", "qa-server"]
        for cpu_service in cpu_services:
            if self._should_create_cpu_service(tenant_specs, cpu_service):
                # Deployment
                manifests[f"{service_count:02d}-{cpu_service}-deployment.yaml"] = \
                    self._generate_cpu_deployment(tenant_specs, cpu_service)
                
                # Service
                manifests[f"{service_count:02d}-{cpu_service}-service.yaml"] = \
                    self._generate_service(tenant_specs, cpu_service)
                
                # HPA
                manifests[f"{service_count:02d}-{cpu_service}-hpa.yaml"] = \
                    self._generate_hpa(tenant_specs, cpu_service)
                
                service_count += 1
        
        # 5. 애플리케이션 서비스들 (기존 서비스 유지)
        app_services = ["callbot", "chatbot", "advisor"]
        for app_service in app_services:
            # Deployment
            manifests[f"{service_count:02d}-{app_service}-deployment.yaml"] = \
                self._generate_deployment(tenant_specs, app_service)
            
            # Service
            manifests[f"{service_count:02d}-{app_service}-service.yaml"] = \
                self._generate_service(tenant_specs, app_service)
            
            # HPA
            manifests[f"{service_count:02d}-{app_service}-hpa.yaml"] = \
                self._generate_hpa(tenant_specs, app_service)
            
            service_count += 1
        
        # 6. 인프라 서비스들 (실제 서버 구성 반영)
        infra_services = ["nginx", "api-gateway", "postgresql", "auth-service"]
        for infra_service in infra_services:
            # Deployment
            manifests[f"{service_count:02d}-{infra_service}-deployment.yaml"] = \
                self._generate_infra_deployment(tenant_specs, infra_service)
            
            # Service
            manifests[f"{service_count:02d}-{infra_service}-service.yaml"] = \
                self._generate_service(tenant_specs, infra_service)
            
            service_count += 1
        
        # 7. VectorDB (어드바이저용)
        if tenant_specs.total_channels > 0:  # 어드바이저가 있는 경우
            manifests[f"{service_count:02d}-vectordb-deployment.yaml"] = \
                self._generate_infra_deployment(tenant_specs, "vectordb")
            manifests[f"{service_count:02d}-vectordb-service.yaml"] = \
                self._generate_service(tenant_specs, "vectordb")
            service_count += 1
        
        # 8. 스토리지 (NAS)
        manifests[f"{service_count:02d}-storage-pvc.yaml"] = \
            self._generate_storage_pvc(tenant_specs)
        service_count += 1
        
        # 9. 네트워크 정책
        manifests["90-networkpolicy.yaml"] = self._generate_networkpolicy(tenant_specs)
        
        # 10. 모니터링 설정
        manifests["91-monitoring.yaml"] = self._generate_monitoring(tenant_specs)
        
        logger.info(
            "테넌시 매니페스트 생성 완료",
            tenant_id=tenant_specs.tenant_id,
            manifest_count=len(manifests),
            gpu_services=len([s for s in gpu_services if self._should_create_gpu_service(tenant_specs, s)]),
            cpu_services=len([s for s in cpu_services if self._should_create_cpu_service(tenant_specs, s)]),
            infra_services=len(infra_services) + 1  # +1 for VectorDB
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
                # gpu_type과 preset을 안전하게 처리
                gpu_type_str = tenant_specs.gpu_type.value if hasattr(tenant_specs.gpu_type, 'value') else str(tenant_specs.gpu_type)
                preset_str = tenant_specs.preset.value if hasattr(tenant_specs.preset, 'value') else str(tenant_specs.preset)
                
                basic_specs = {
                    "tenant_id": tenant_specs.tenant_id,
                    "preset": preset_str,
                    "services": ["callbot", "chatbot", "advisor", "stt", "tts", "ta", "qa"]
                }
                specs_json = json.dumps(basic_specs, indent=2, ensure_ascii=False)
                zip_file.writestr("tenant-specs.json", specs_json)
        
        zip_buffer.seek(0)
        
        logger.info("배포 패키지 생성 완료", tenant_id=tenant_specs.tenant_id)
        return zip_buffer
    
    def generate_tenant_manifests_with_advanced_config(self, tenant_specs: TenantSpecs, advanced_config, image_config=None) -> Dict[str, str]:
        """
        [advice from AI] 고급 설정을 포함한 테넌시 매니페스트 생성
        """
        manifests = {}
        
        try:
            # 네임스페이스 생성
            manifests["01-namespace.yaml"] = self._generate_namespace(tenant_specs)
            
            # 서비스별 매니페스트 생성 (고급 설정 및 이미지 설정 적용)
            services = ["callbot", "chatbot", "advisor", "stt", "tts", "ta", "qa"]
            for i, service in enumerate(services, start=2):
                # 실제 이미지 정보 가져오기
                service_image_info = self._get_service_image_info(service, image_config)
                
                # Deployment (고급 설정, 이미지 정보, 동적 리소스 적용)
                deployment_manifest = self._generate_deployment(tenant_specs, service, advanced_config, service_image_info, None)
                manifests[f"{i:02d}-{service}-deployment.yaml"] = deployment_manifest
                
                # Service
                service_manifest = self._generate_service(tenant_specs, service)
                manifests[f"{i:02d}-{service}-service.yaml"] = service_manifest
                
                # HPA (오토스케일링이 활성화된 경우만)
                # HPA (고급 설정 적용) - 선택적 활성화
                if advanced_config and hasattr(advanced_config, 'auto_scaling') and advanced_config.auto_scaling.enabled:
                    hpa_manifest = self._generate_hpa(tenant_specs, service, advanced_config)
                    manifests[f"{i:02d}-{service}-hpa.yaml"] = hpa_manifest
                    
                    # VPA (Vertical Pod Autoscaler) - 실험적 기능
                    if hasattr(advanced_config.auto_scaling, 'vpa_enabled') and getattr(advanced_config.auto_scaling, 'vpa_enabled', False):
                        vpa_manifest = self._generate_vpa(tenant_specs, service, advanced_config)
                        manifests[f"{i:02d}-{service}-vpa.yaml"] = vpa_manifest
            
            # ConfigMap
            manifests["90-configmap.yaml"] = self._generate_configmap(tenant_specs)
            
            # NetworkPolicy (네트워크 정책이 활성화된 경우)
            manifests["91-networkpolicy.yaml"] = self._generate_networkpolicy(tenant_specs)
            
            # Monitoring
            manifests["92-monitoring.yaml"] = self._generate_monitoring(tenant_specs)
            
            logger.info("고급 설정 매니페스트 생성 완료", 
                       tenant_id=tenant_specs.tenant_id,
                       manifest_count=len(manifests))
            
            return manifests
            
        except Exception as e:
            logger.error("고급 설정 매니페스트 생성 실패", 
                        tenant_id=tenant_specs.tenant_id, 
                        error=str(e))
            # 기본 매니페스트로 폴백
            return self.generate_tenant_manifests(tenant_specs)
    
    def _generate_vpa(self, tenant_specs: TenantSpecs, service_name: str, advanced_config) -> str:
        """
        [advice from AI] VPA (Vertical Pod Autoscaler) 매니페스트 생성
        리소스 추천 및 자동 조정을 위한 VPA 설정
        """
        vpa_template = """---
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: {{ service_name }}-vpa
  namespace: {{ namespace }}
  labels:
    app: {{ service_name }}
    tenant: {{ tenant_id }}
    component: vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ service_name }}
  updatePolicy:
    updateMode: "{{ vpa_update_mode }}"  # Off, Auto, RecommendationOnly
  resourcePolicy:
    containerPolicies:
    - containerName: {{ service_name }}
      minAllowed:
        cpu: {{ min_cpu }}
        memory: {{ min_memory }}
      maxAllowed:
        cpu: {{ max_cpu }}
        memory: {{ max_memory }}
      controlledResources:
      - cpu
      - memory
"""
        
        template = Template(vpa_template)
        
        # VPA 설정값
        vpa_config = getattr(advanced_config.auto_scaling, 'vpa_config', {})
        update_mode = vpa_config.get('update_mode', 'RecommendationOnly')
        
        # 리소스 범위 설정
        min_cpu = vpa_config.get('min_cpu', '100m')
        max_cpu = vpa_config.get('max_cpu', '8000m')
        min_memory = vpa_config.get('min_memory', '128Mi')
        max_memory = vpa_config.get('max_memory', '16Gi')
        
        return template.render(
            service_name=service_name,
            namespace=f"{tenant_specs.tenant_id}-ecp-ai",
            tenant_id=tenant_specs.tenant_id,
            vpa_update_mode=update_mode,
            min_cpu=min_cpu,
            max_cpu=max_cpu,
            min_memory=min_memory,
            max_memory=max_memory
        )
    
    def _get_service_image_info(self, service_name: str, image_config=None) -> Dict[str, str]:
        """
        [advice from AI] 서비스 이미지 정보 가져오기
        """
        if image_config and hasattr(image_config, 'service_images'):
            # 이미지 설정에서 해당 서비스 이미지 찾기
            for service_image in image_config.service_images:
                if service_image.service_name == service_name:
                    return {
                        "image": f"{service_image.registry.url}/{service_image.repository}:{service_image.selected_tag}",
                        "pull_policy": service_image.pull_policy,
                        "registry_secret": f"{service_image.registry.name}-secret" if service_image.registry.username else None
                    }
        
        # 기본 이미지 정보 반환
        return {
            "image": f"ecp-ai/{service_name}:latest",
            "pull_policy": "Always",
            "registry_secret": None
        }
    
    def _calculate_service_resources(self, tenant_specs: TenantSpecs, service_name: str, resource_requirements=None) -> Dict[str, Any]:
        """
        [advice from AI] 채널 수 기반 동적 리소스 계산
        실제 서비스 요구사항에 따른 CPU/Memory 자동 설정
        """
        try:
            # 서비스별 기본 리소스 설정
            service_resource_mapping = {
                # GPU 서비스 (TTS, NLP, AICM)
                "callbot": {"base_cpu": 1000, "base_memory": 2048, "gpu_required": True},
                "chatbot": {"base_cpu": 500, "base_memory": 1024, "gpu_required": False}, 
                "advisor": {"base_cpu": 800, "base_memory": 1536, "gpu_required": True},
                "tts": {"base_cpu": 2000, "base_memory": 4096, "gpu_required": True},
                
                # CPU 서비스 (STT, TA, QA)
                "stt": {"base_cpu": 4000, "base_memory": 8192, "gpu_required": False},
                "ta": {"base_cpu": 2000, "base_memory": 4096, "gpu_required": False},
                "qa": {"base_cpu": 1000, "base_memory": 2048, "gpu_required": False},
                
                # 인프라 서비스
                "database": {"base_cpu": 2000, "base_memory": 4096, "gpu_required": False},
                "redis": {"base_cpu": 500, "base_memory": 1024, "gpu_required": False},
                "nginx": {"base_cpu": 200, "base_memory": 512, "gpu_required": False}
            }
            
            base_config = service_resource_mapping.get(service_name, {
                "base_cpu": 1000, "base_memory": 2048, "gpu_required": False
            })
            
            # 채널 수 기반 스케일링 계산
            total_channels = self._calculate_total_channels_from_specs(tenant_specs)
            scaling_factor = self._calculate_scaling_factor(total_channels, service_name)
            
            # 동적 리소스 계산
            calculated_cpu = int(base_config["base_cpu"] * scaling_factor)
            calculated_memory = int(base_config["base_memory"] * scaling_factor)
            
            # GPU 타입별 추가 리소스 조정
            if base_config["gpu_required"] and hasattr(tenant_specs, 'gpu_type'):
                gpu_multiplier = self._get_gpu_resource_multiplier(tenant_specs.gpu_type)
                calculated_cpu = int(calculated_cpu * gpu_multiplier)
                calculated_memory = int(calculated_memory * gpu_multiplier)
            
            # 리소스 범위 제한 (최소/최대값 적용)
            min_cpu, max_cpu = 100, 16000  # 100m ~ 16 cores
            min_memory, max_memory = 128, 32768  # 128Mi ~ 32Gi
            
            final_cpu = max(min_cpu, min(calculated_cpu, max_cpu))
            final_memory = max(min_memory, min(calculated_memory, max_memory))
            
            # K8s 리소스 형식으로 변환
            resources = {
                "requests": {
                    "cpu": f"{final_cpu}m",
                    "memory": f"{final_memory}Mi"
                },
                "limits": {
                    "cpu": f"{int(final_cpu * 1.5)}m",  # requests의 1.5배
                    "memory": f"{int(final_memory * 1.2)}Mi"  # requests의 1.2배
                }
            }
            
            # GPU 리소스 추가
            if base_config["gpu_required"] and hasattr(tenant_specs, 'gpu_count') and tenant_specs.gpu_count > 0:
                gpu_count = max(1, tenant_specs.gpu_count // 3)  # 서비스별 GPU 분배
                resources["requests"]["nvidia.com/gpu"] = str(gpu_count)
                resources["limits"]["nvidia.com/gpu"] = str(gpu_count)
            
            logger.info(
                "동적 리소스 계산 완료",
                service_name=service_name,
                total_channels=total_channels,
                scaling_factor=scaling_factor,
                final_resources=resources
            )
            
            return resources
            
        except Exception as e:
            logger.warning(
                "동적 리소스 계산 실패, 기본값 사용",
                service_name=service_name,
                error=str(e)
            )
            # 기본값 반환
            return {
                "requests": {"cpu": "500m", "memory": "1Gi"},
                "limits": {"cpu": "1000m", "memory": "2Gi"}
            }
    
    def _calculate_total_channels_from_specs(self, tenant_specs: TenantSpecs) -> int:
        """TenantSpecs에서 총 채널 수 계산"""
        try:
            total_channels = 0
            if hasattr(tenant_specs, 'services') and tenant_specs.services:
                total_channels += tenant_specs.services.get('callbot', 0)
                total_channels += tenant_specs.services.get('chatbot', 0)
                total_channels += tenant_specs.services.get('advisor', 0)
                total_channels += tenant_specs.services.get('stt', 0)
                total_channels += tenant_specs.services.get('tts', 0)
            return max(1, total_channels)  # 최소 1채널
        except:
            return 100  # 기본값
    
    def _calculate_scaling_factor(self, total_channels: int, service_name: str) -> float:
        """서비스별 채널 수 기반 스케일링 팩터 계산"""
        # 서비스별 채널당 리소스 사용률
        service_scaling = {
            "callbot": 0.8,   # 콜봇은 높은 리소스 사용
            "chatbot": 0.3,   # 챗봇은 상대적으로 낮음
            "advisor": 0.6,   # 어드바이저는 중간
            "tts": 1.0,       # TTS는 가장 높음
            "stt": 0.9,       # STT도 높음
            "ta": 0.4,        # TA는 중간
            "qa": 0.2         # QA는 낮음
        }
        
        base_factor = service_scaling.get(service_name, 0.5)
        
        # 채널 수에 따른 계단식 스케일링
        if total_channels <= 50:
            return base_factor * 1.0
        elif total_channels <= 200:
            return base_factor * 1.5
        elif total_channels <= 500:
            return base_factor * 2.0
        else:
            return base_factor * 3.0
    
    def _get_gpu_resource_multiplier(self, gpu_type) -> float:
        """GPU 타입별 리소스 배수"""
        gpu_multipliers = {
            "t4": 1.0,
            "v100": 1.3,
            "l40s": 1.6,
            "a100": 2.0
        }
        
        # Enum 처리
        if hasattr(gpu_type, 'value'):
            gpu_str = gpu_type.value.lower()
        else:
            gpu_str = str(gpu_type).lower()
            
        return gpu_multipliers.get(gpu_str, 1.0)
    
    def _generate_namespace(self, tenant_specs: TenantSpecs) -> str:
        """네임스페이스 매니페스트 생성"""
        template = Template(self.builtin_templates["namespace"])
        return template.render(
            tenant_id=tenant_specs.tenant_id,
            tenant_preset=tenant_specs.preset
        )
    
    def _generate_deployment(self, tenant_specs: TenantSpecs, service_name: str, advanced_config=None, image_info=None, resource_requirements=None) -> str:
        """Deployment 매니페스트 생성 (고급 설정 지원)"""
        try:
            template = Template(self.builtin_templates["deployment"])
            
            # GPU 할당 정보 (새로운 TenantSpecs 모델 기반)
            has_gpu = service_name in ["tts", "nlp", "aicm"] and tenant_specs.gpu_count > 0
            
            # gpu_type이 enum인지 확인하고 안전하게 처리
            if hasattr(tenant_specs.gpu_type, 'value'):
                gpu_type = tenant_specs.gpu_type.value
            else:
                gpu_type = str(tenant_specs.gpu_type)
            
            gpu_count = 1 if has_gpu else 0
            
            # [advice from AI] 이미지 정보 적용
            if image_info is None:
                image_info = self._get_service_image_info(service_name)
            
            # [advice from AI] 채널 수 기반 동적 리소스 계산
            dynamic_resources = self._calculate_service_resources(tenant_specs, service_name, resource_requirements)
            
            # 기본 container_specs 설정 (실제 이미지 정보 및 동적 리소스 적용)
            container_specs = {
                "image": image_info["image"],
                "imagePullPolicy": image_info["pull_policy"],
                "ports": [{"containerPort": 8080, "protocol": "TCP"}],
                "env": [],
                "resources": dynamic_resources
            }
            
            # [advice from AI] 고급 설정 적용
            render_params = {
                "tenant_id": tenant_specs.tenant_id,
                "service_name": service_name,
                "replicas": 1,
                "has_gpu": has_gpu,
                "gpu_type": gpu_type,
                "gpu_count": gpu_count,
                "namespace": f"{tenant_specs.tenant_id}-ecp-ai",
                "container_specs": container_specs,
                "registry_secret": image_info.get("registry_secret")
            }
            
            if advanced_config:
                # 리소스 설정
                if hasattr(advanced_config, 'resource_config'):
                    resource_config = advanced_config.resource_config
                    render_params.update({
                        "resource_requests_cpu": resource_config.requests.cpu,
                        "resource_requests_memory": resource_config.requests.memory,
                        "resource_requests_ephemeral_storage": resource_config.requests.ephemeral_storage,
                        "resource_limits_cpu": resource_config.limits.cpu,
                        "resource_limits_memory": resource_config.limits.memory,
                        "resource_limits_ephemeral_storage": resource_config.limits.ephemeral_storage
                    })
                
                # 프로브 설정
                if hasattr(advanced_config, 'latency_config'):
                    latency_config = advanced_config.latency_config
                    render_params.update({
                        "startup_probe_enabled": latency_config.startup_probe.enabled,
                        "startup_probe_initial_delay": latency_config.startup_probe.initial_delay_seconds,
                        "startup_probe_period": latency_config.startup_probe.period_seconds,
                        "startup_probe_timeout": latency_config.startup_probe.timeout_seconds,
                        "startup_probe_failure_threshold": latency_config.startup_probe.failure_threshold,
                        "startup_probe_success_threshold": latency_config.startup_probe.success_threshold,
                        "liveness_probe_initial_delay": latency_config.liveness_probe.initial_delay_seconds,
                        "liveness_probe_period": latency_config.liveness_probe.period_seconds,
                        "liveness_probe_timeout": latency_config.liveness_probe.timeout_seconds,
                        "liveness_probe_failure_threshold": latency_config.liveness_probe.failure_threshold,
                        "readiness_probe_initial_delay": latency_config.readiness_probe.initial_delay_seconds,
                        "readiness_probe_period": latency_config.readiness_probe.period_seconds,
                        "readiness_probe_timeout": latency_config.readiness_probe.timeout_seconds,
                        "readiness_probe_failure_threshold": latency_config.readiness_probe.failure_threshold,
                        "readiness_probe_success_threshold": latency_config.readiness_probe.success_threshold,
                        "rolling_update_max_surge": latency_config.rolling_update_max_surge,
                        "rolling_update_max_unavailable": latency_config.rolling_update_max_unavailable
                    })
            
            return template.render(**render_params)
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
            # gpu_type이 enum인지 확인하고 안전하게 처리
            if hasattr(tenant_specs.gpu_type, 'value'):
                gpu_type = tenant_specs.gpu_type.value
            else:
                gpu_type = str(tenant_specs.gpu_type)
                
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
    
    def _should_create_gpu_service(self, tenant_specs: TenantSpecs, gpu_service: str) -> bool:
        """
        [advice from AI] GPU 서비스 생성 필요 여부 판단
        """
        if gpu_service == "tts-server":
            # TTS 채널이 있는 경우 (콜봇 + 독립 TTS)
            return tenant_specs.total_channels > 0
        elif gpu_service == "nlp-server":
            # NLP 처리가 필요한 서비스가 있는 경우
            return tenant_specs.total_users > 0 or tenant_specs.total_channels > 0
        elif gpu_service == "aicm-server":
            # AICM 검색이 필요한 서비스가 있는 경우
            return tenant_specs.total_channels > 0
        return False
    
    def _should_create_cpu_service(self, tenant_specs: TenantSpecs, cpu_service: str) -> bool:
        """
        [advice from AI] CPU 서비스 생성 필요 여부 판단
        """
        if cpu_service == "stt-server":
            # STT 처리가 필요한 채널이 있는 경우
            return tenant_specs.total_channels > 0
        elif cpu_service == "ta-server":
            # 분석 처리가 필요한 경우
            return tenant_specs.total_channels > 0 or tenant_specs.total_users > 0
        elif cpu_service == "qa-server":
            # 품질 관리가 필요한 경우
            return tenant_specs.total_channels > 0 or tenant_specs.total_users > 0
        return False
    
    def _generate_gpu_deployment(self, tenant_specs: TenantSpecs, gpu_service: str) -> str:
        """
        [advice from AI] GPU 전용 서비스 Deployment 생성
        """
        gpu_type_str = tenant_specs.gpu_type.value if hasattr(tenant_specs.gpu_type, 'value') else str(tenant_specs.gpu_type)
        
        # GPU 서비스별 리소스 설정
        gpu_resources = {
            "tts-server": {"gpu_count": 1, "cpu": "2000m", "memory": "4Gi"},
            "nlp-server": {"gpu_count": 1, "cpu": "4000m", "memory": "8Gi"},
            "aicm-server": {"gpu_count": 1, "cpu": "2000m", "memory": "6Gi"}
        }
        
        resource_config = gpu_resources.get(gpu_service, {"gpu_count": 1, "cpu": "2000m", "memory": "4Gi"})
        
        return f"""---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {gpu_service}
  namespace: {tenant_specs.tenant_id}-ecp-ai
  labels:
    app: {gpu_service}
    tenant: {tenant_specs.tenant_id}
    tier: gpu
spec:
  replicas: 1
  selector:
    matchLabels:
      app: {gpu_service}
      tenant: {tenant_specs.tenant_id}
  template:
    metadata:
      labels:
        app: {gpu_service}
        tenant: {tenant_specs.tenant_id}
        tier: gpu
        monitoring: enabled
    spec:
      nodeSelector:
        accelerator: nvidia-{gpu_type_str}
      tolerations:
      - key: nvidia.com/gpu
        operator: Equal
        value: present
        effect: NoSchedule
      containers:
      - name: {gpu_service}
        image: ecp-ai/{gpu_service}:latest
        ports:
        - containerPort: 8080
        env:
        - name: TENANT_ID
          value: {tenant_specs.tenant_id}
        - name: SERVICE_NAME
          value: {gpu_service}
        - name: GPU_TYPE
          value: {gpu_type_str}
        resources:
          requests:
            nvidia.com/gpu: {resource_config["gpu_count"]}
            cpu: {resource_config["cpu"]}
            memory: {resource_config["memory"]}
          limits:
            nvidia.com/gpu: {resource_config["gpu_count"]}
            cpu: {int(resource_config["cpu"].replace("m", "")) * 2}m
            memory: {int(resource_config["memory"].replace("Gi", "")) * 2}Gi
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 60
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
"""
    
    def _generate_cpu_deployment(self, tenant_specs: TenantSpecs, cpu_service: str) -> str:
        """
        [advice from AI] CPU 전용 서비스 Deployment 생성
        """
        # CPU 서비스별 리소스 설정
        cpu_resources = {
            "stt-server": {"cpu": "4000m", "memory": "8Gi", "replicas": 2},
            "ta-server": {"cpu": "2000m", "memory": "4Gi", "replicas": 1},
            "qa-server": {"cpu": "1000m", "memory": "2Gi", "replicas": 1}
        }
        
        resource_config = cpu_resources.get(cpu_service, {"cpu": "1000m", "memory": "2Gi", "replicas": 1})
        
        return f"""---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {cpu_service}
  namespace: {tenant_specs.tenant_id}-ecp-ai
  labels:
    app: {cpu_service}
    tenant: {tenant_specs.tenant_id}
    tier: cpu
spec:
  replicas: {resource_config["replicas"]}
  selector:
    matchLabels:
      app: {cpu_service}
      tenant: {tenant_specs.tenant_id}
  template:
    metadata:
      labels:
        app: {cpu_service}
        tenant: {tenant_specs.tenant_id}
        tier: cpu
        monitoring: enabled
    spec:
      containers:
      - name: {cpu_service}
        image: ecp-ai/{cpu_service}:latest
        ports:
        - containerPort: 8080
        env:
        - name: TENANT_ID
          value: {tenant_specs.tenant_id}
        - name: SERVICE_NAME
          value: {cpu_service}
        resources:
          requests:
            cpu: {resource_config["cpu"]}
            memory: {resource_config["memory"]}
          limits:
            cpu: {int(resource_config["cpu"].replace("m", "")) * 2}m
            memory: {int(resource_config["memory"].replace("Gi", "")) * 2}Gi
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
          initialDelaySeconds: 10
          periodSeconds: 5
"""
    
    def _generate_infra_deployment(self, tenant_specs: TenantSpecs, infra_service: str) -> str:
        """
        [advice from AI] 인프라 서비스 Deployment 생성
        """
        # 인프라 서비스별 설정
        infra_configs = {
            "nginx": {
                "image": "nginx:1.21-alpine",
                "port": 80,
                "cpu": "500m",
                "memory": "1Gi",
                "replicas": 2
            },
            "api-gateway": {
                "image": "ecp-ai/api-gateway:latest",
                "port": 8080,
                "cpu": "1000m",
                "memory": "2Gi",
                "replicas": 2
            },
            "postgresql": {
                "image": "postgres:13-alpine",
                "port": 5432,
                "cpu": "2000m",
                "memory": "4Gi",
                "replicas": 1
            },
            "auth-service": {
                "image": "ecp-ai/auth-service:latest",
                "port": 8080,
                "cpu": "500m",
                "memory": "1Gi",
                "replicas": 1
            },
            "vectordb": {
                "image": "qdrant/qdrant:latest",
                "port": 6333,
                "cpu": "1000m",
                "memory": "2Gi",
                "replicas": 1
            }
        }
        
        config = infra_configs.get(infra_service, infra_configs["nginx"])
        
        env_vars = ""
        if infra_service == "postgresql":
            env_vars = f"""
        - name: POSTGRES_DB
          value: {tenant_specs.tenant_id}_db
        - name: POSTGRES_USER
          value: ecp_user
        - name: POSTGRES_PASSWORD
          value: ecp_password"""
        elif infra_service == "auth-service":
            env_vars = f"""
        - name: JWT_SECRET
          value: ecp-jwt-secret-{tenant_specs.tenant_id}
        - name: DB_HOST
          value: postgresql-service"""
        
        return f"""---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {infra_service}
  namespace: {tenant_specs.tenant_id}-ecp-ai
  labels:
    app: {infra_service}
    tenant: {tenant_specs.tenant_id}
    tier: infrastructure
spec:
  replicas: {config["replicas"]}
  selector:
    matchLabels:
      app: {infra_service}
      tenant: {tenant_specs.tenant_id}
  template:
    metadata:
      labels:
        app: {infra_service}
        tenant: {tenant_specs.tenant_id}
        tier: infrastructure
        monitoring: enabled
    spec:
      containers:
      - name: {infra_service}
        image: {config["image"]}
        ports:
        - containerPort: {config["port"]}
        env:
        - name: TENANT_ID
          value: {tenant_specs.tenant_id}{env_vars}
        resources:
          requests:
            cpu: {config["cpu"]}
            memory: {config["memory"]}
          limits:
            cpu: {int(config["cpu"].replace("m", "")) * 2}m
            memory: {int(config["memory"].replace("Gi", "")) * 2}Gi
        livenessProbe:
          tcpSocket:
            port: {config["port"]}
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          tcpSocket:
            port: {config["port"]}
          initialDelaySeconds: 10
          periodSeconds: 5
"""
    
    def _generate_gpu_hpa(self, tenant_specs: TenantSpecs, gpu_service: str) -> str:
        """
        [advice from AI] GPU 서비스용 제한적 HPA 생성
        """
        return f"""---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {gpu_service}-hpa
  namespace: {tenant_specs.tenant_id}-ecp-ai
  labels:
    app: {gpu_service}
    tenant: {tenant_specs.tenant_id}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {gpu_service}
  minReplicas: 1
  maxReplicas: 3  # GPU 서비스는 제한적 스케일링
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 80  # GPU 서비스는 높은 임계값
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 300  # 더 긴 안정화 시간
      policies:
      - type: Percent
        value: 50
        periodSeconds: 300
    scaleDown:
      stabilizationWindowSeconds: 600
      policies:
      - type: Percent
        value: 25
        periodSeconds: 300
"""
    
    def _generate_storage_pvc(self, tenant_specs: TenantSpecs) -> str:
        """
        [advice from AI] 스토리지 PVC 생성
        """
        storage_size = f"{max(100, tenant_specs.storage_gb)}Gi"
        
        return f"""---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ecp-storage-pvc
  namespace: {tenant_specs.tenant_id}-ecp-ai
  labels:
    tenant: {tenant_specs.tenant_id}
    tier: storage
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: {storage_size}
  storageClassName: fast-ssd
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ecp-logs-pvc
  namespace: {tenant_specs.tenant_id}-ecp-ai
  labels:
    tenant: {tenant_specs.tenant_id}
    tier: storage
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 50Gi
  storageClassName: standard
"""
    
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
    
    def _generate_hpa(self, tenant_specs: TenantSpecs, service_name: str, advanced_config=None) -> str:
        """HPA 매니페스트 생성 (고급 설정 지원)"""
        template = Template(self.builtin_templates["hpa"])
        
        # 기본 스케일링 설정
        render_params = {
            "tenant_id": tenant_specs.tenant_id,
            "service_name": service_name,
            "min_replicas": 1,
            "max_replicas": 10,
            "target_cpu": 70,
            "target_memory": 80,
            "namespace": f"{tenant_specs.tenant_id}-ecp-ai",
            "custom_metrics_enabled": False,
            "custom_metric_name": "",
            "custom_target_value": 100,
            "scale_up_stabilization_window": 60,
            "scale_up_max_percent": 100,
            "scale_up_period_seconds": 60,
            "scale_down_stabilization_window": 300,
            "scale_down_max_percent": 10,
            "scale_down_period_seconds": 60
        }
        
        # [advice from AI] 고급 설정 적용
        if advanced_config and hasattr(advanced_config, 'auto_scaling'):
            auto_scaling = advanced_config.auto_scaling
            if auto_scaling.enabled:
                render_params.update({
                    "min_replicas": auto_scaling.min_replicas,
                    "max_replicas": auto_scaling.max_replicas,
                    "target_cpu": auto_scaling.target_cpu,
                    "target_memory": auto_scaling.target_memory,
                    "custom_metrics_enabled": auto_scaling.custom_metrics_enabled,
                    "custom_metric_name": auto_scaling.custom_metric_name or "",
                    "custom_target_value": auto_scaling.custom_target_value or 100,
                    "scale_up_stabilization_window": auto_scaling.scale_up_stabilization_window,
                    "scale_up_max_percent": auto_scaling.scale_up_max_percent,
                    "scale_up_period_seconds": auto_scaling.scale_up_period_seconds,
                    "scale_down_stabilization_window": auto_scaling.scale_down_stabilization_window,
                    "scale_down_max_percent": auto_scaling.scale_down_max_percent,
                    "scale_down_period_seconds": auto_scaling.scale_down_period_seconds
                })
        
        return template.render(**render_params)
    
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
            # gpu_type과 preset을 안전하게 처리
            gpu_type_str = tenant_specs.gpu_type.value if hasattr(tenant_specs.gpu_type, 'value') else str(tenant_specs.gpu_type)
            preset_str = tenant_specs.preset.value if hasattr(tenant_specs.preset, 'value') else str(tenant_specs.preset)
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
    preset: {preset_str}
    services: {{}}
    resources:
      gpu_type: {gpu_type_str}
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
        # gpu_type과 preset을 안전하게 처리
        gpu_type_str = tenant_specs.gpu_type.value if hasattr(tenant_specs.gpu_type, 'value') else str(tenant_specs.gpu_type)
        preset_str = tenant_specs.preset.value if hasattr(tenant_specs.preset, 'value') else str(tenant_specs.preset)
        
        return f"""#!/bin/bash
# [advice from AI] ECP-AI 테넌시 '{tenant_specs.tenant_id}' 배포 스크립트

set -e

echo "🚀 ECP-AI 테넌시 '{tenant_specs.tenant_id}' 배포 시작"
echo "프리셋: {preset_str}"
echo "GPU 타입: {gpu_type_str}"
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
        
        # gpu_type과 preset을 안전하게 처리
        gpu_type_str = tenant_specs.gpu_type.value if hasattr(tenant_specs.gpu_type, 'value') else str(tenant_specs.gpu_type)
        preset_str = tenant_specs.preset.value if hasattr(tenant_specs.preset, 'value') else str(tenant_specs.preset)
        
        return f"""# ECP-AI 테넌시: {tenant_specs.tenant_id}

## 📋 테넌시 정보

- **테넌시 ID**: {tenant_specs.tenant_id}
- **프리셋**: {preset_str}
- **GPU 타입**: {gpu_type_str}
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
- **GPU 타입**: {gpu_type_str}
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
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: {{ rolling_update_max_surge | default('25%') }}
      maxUnavailable: {{ rolling_update_max_unavailable | default('25%') }}
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
      {% if registry_secret %}
      imagePullSecrets:
      - name: {{ registry_secret }}
      {% endif %}
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
            cpu: {{ resource_requests_cpu | default('100m') }}
            memory: {{ resource_requests_memory | default('256Mi') }}
            {% if resource_requests_ephemeral_storage %}
            ephemeral-storage: {{ resource_requests_ephemeral_storage }}
            {% endif %}
          limits:
            {% if has_gpu %}
            nvidia.com/gpu: {{ gpu_count }}
            {% endif %}
            cpu: {{ resource_limits_cpu | default('1000m') }}
            memory: {{ resource_limits_memory | default('1Gi') }}
            {% if resource_limits_ephemeral_storage %}
            ephemeral-storage: {{ resource_limits_ephemeral_storage }}
            {% endif %}
        {% if startup_probe_enabled %}
        startupProbe:
          httpGet:
            path: /startup
            port: {{ container_specs.ports[0].containerPort }}
          initialDelaySeconds: {{ startup_probe_initial_delay }}
          periodSeconds: {{ startup_probe_period }}
          timeoutSeconds: {{ startup_probe_timeout }}
          failureThreshold: {{ startup_probe_failure_threshold }}
          successThreshold: {{ startup_probe_success_threshold }}
        {% endif %}
        livenessProbe:
          httpGet:
            path: /health
            port: {{ container_specs.ports[0].containerPort }}
          initialDelaySeconds: {{ liveness_probe_initial_delay | default(30) }}
          periodSeconds: {{ liveness_probe_period | default(10) }}
          timeoutSeconds: {{ liveness_probe_timeout | default(5) }}
          failureThreshold: {{ liveness_probe_failure_threshold | default(3) }}
        readinessProbe:
          httpGet:
            path: /ready
            port: {{ container_specs.ports[0].containerPort }}
          initialDelaySeconds: {{ readiness_probe_initial_delay | default(5) }}
          periodSeconds: {{ readiness_probe_period | default(5) }}
          timeoutSeconds: {{ readiness_probe_timeout | default(3) }}
          failureThreshold: {{ readiness_probe_failure_threshold | default(3) }}
          successThreshold: {{ readiness_probe_success_threshold | default(1) }}
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
        averageUtilization: {{ target_memory }}
  {% if custom_metrics_enabled %}
  - type: Pods
    pods:
      metric:
        name: {{ custom_metric_name }}
      target:
        type: AverageValue
        averageValue: {{ custom_target_value }}
  {% endif %}
  behavior:
    scaleUp:
      stabilizationWindowSeconds: {{ scale_up_stabilization_window }}
      policies:
      - type: Percent
        value: {{ scale_up_max_percent }}
        periodSeconds: {{ scale_up_period_seconds }}
    scaleDown:
      stabilizationWindowSeconds: {{ scale_down_stabilization_window }}
      policies:
      - type: Percent
        value: {{ scale_down_max_percent }}
        periodSeconds: {{ scale_down_period_seconds }}
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
      gpu_type: {{ tenant_specs.gpu_type.value if tenant_specs.gpu_type.value is defined else tenant_specs.gpu_type }}
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
