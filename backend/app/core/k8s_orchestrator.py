# [advice from AI] ECP-AI Kubernetes 오케스트레이터 - 네이티브 K8s 통합
"""
ECP-AI Kubernetes 자동 오케스트레이션 시스템
- 테넌시별 네임스페이스 및 리소스 자동 생성
- GPU 워크로드 특별 처리 (NodeSelector, nvidia.com/gpu)
- 오토스케일링 (HPA/VPA) 및 모니터링 설정
- 네트워크 보안 정책 적용
- kubernetes-python 클라이언트 기반 비동기 처리
"""

import asyncio
from typing import Dict, Any, List, Optional
from kubernetes import client, config
from kubernetes.client.rest import ApiException
import yaml
import structlog

logger = structlog.get_logger(__name__)


class K8sOrchestrator:
    """
    ECP-AI Kubernetes 자동 오케스트레이션
    테넌시별 완전한 K8s 리소스 생성 및 관리
    """
    
    def __init__(self):
        """Kubernetes 클라이언트 초기화"""
        try:
            # 클러스터 내부에서 실행 시
            config.load_incluster_config()
            logger.info("Kubernetes 클러스터 내부 설정 로드")
        except config.ConfigException:
            try:
                # 로컬 개발 환경에서 실행 시
                config.load_kube_config()
                logger.info("로컬 Kubernetes 설정 로드")
            except config.ConfigException as e:
                logger.error("Kubernetes 설정 로드 실패", error=str(e))
                raise
        
        # Kubernetes API 클라이언트들 초기화
        self.v1 = client.CoreV1Api()
        self.apps_v1 = client.AppsV1Api()
        self.autoscaling_v2 = client.AutoscalingV2Api()
        self.networking_v1 = client.NetworkingV1Api()
        self.monitoring_v1 = client.CustomObjectsApi()  # Prometheus ServiceMonitor용
        
        logger.info("K8sOrchestrator 초기화 완료")
    
    async def health_check(self) -> bool:
        """Kubernetes 클러스터 연결 상태 확인"""
        try:
            # 클러스터 버전 조회로 연결 확인
            version = self.v1.get_code(async_req=False)
            logger.info("Kubernetes 클러스터 연결 확인", version=version.git_version)
            return True
        except Exception as e:
            logger.error("Kubernetes 클러스터 연결 실패", error=str(e))
            return False
    
    async def create_namespace(self, tenant_id: str, preset: str) -> bool:
        """
        테넌시별 네임스페이스 생성
        라벨링 및 리소스 쿼터 설정
        """
        namespace_name = f"{tenant_id}-ecp-ai"
        
        # 네임스페이스 매니페스트
        namespace = client.V1Namespace(
            metadata=client.V1ObjectMeta(
                name=namespace_name,
                labels={
                    "tenant": tenant_id,
                    "app.kubernetes.io/name": "ecp-ai",
                    "app.kubernetes.io/managed-by": "ecp-orchestrator",
                    "tier": preset,
                    "ecp.ai/tenant-id": tenant_id,
                    "ecp.ai/preset": preset
                },
                annotations={
                    "ecp.ai/created-by": "ecp-orchestrator",
                    "ecp.ai/description": f"ECP-AI tenant namespace for {tenant_id}"
                }
            )
        )
        
        try:
            # 네임스페이스 생성
            self.v1.create_namespace(body=namespace, async_req=False)
            logger.info("네임스페이스 생성 성공", namespace=namespace_name, preset=preset)
            
            # 리소스 쿼터 설정 (프리셋별 제한)
            await self._create_resource_quota(namespace_name, preset)
            
            # 네트워크 정책 설정
            await self._create_network_policy(namespace_name, tenant_id)
            
            return True
            
        except ApiException as e:
            if e.status == 409:  # 이미 존재하는 경우
                logger.info("네임스페이스 이미 존재", namespace=namespace_name)
                return True
            else:
                logger.error("네임스페이스 생성 실패", namespace=namespace_name, error=str(e))
                return False
        except Exception as e:
            logger.error("네임스페이스 생성 중 오류", namespace=namespace_name, error=str(e))
            return False
    
    async def _create_resource_quota(self, namespace: str, preset: str) -> None:
        """프리셋별 리소스 쿼터 생성"""
        # 프리셋별 리소스 제한
        quota_specs = {
            "micro": {
                "requests.cpu": "2",
                "requests.memory": "4Gi",
                "requests.nvidia.com/gpu": "1",
                "limits.cpu": "4",
                "limits.memory": "8Gi",
                "limits.nvidia.com/gpu": "1",
                "pods": "10"
            },
            "small": {
                "requests.cpu": "8",
                "requests.memory": "16Gi", 
                "requests.nvidia.com/gpu": "2",
                "limits.cpu": "16",
                "limits.memory": "32Gi",
                "limits.nvidia.com/gpu": "4",
                "pods": "50"
            },
            "medium": {
                "requests.cpu": "32",
                "requests.memory": "64Gi",
                "requests.nvidia.com/gpu": "8",
                "limits.cpu": "64",
                "limits.memory": "128Gi", 
                "limits.nvidia.com/gpu": "16",
                "pods": "200"
            },
            "large": {
                "requests.cpu": "128",
                "requests.memory": "256Gi",
                "requests.nvidia.com/gpu": "32",
                "limits.cpu": "256",
                "limits.memory": "512Gi",
                "limits.nvidia.com/gpu": "64",
                "pods": "500"
            }
        }
        
        quota_spec = quota_specs.get(preset, quota_specs["small"])
        
        resource_quota = client.V1ResourceQuota(
            metadata=client.V1ObjectMeta(
                name="ecp-ai-quota",
                namespace=namespace
            ),
            spec=client.V1ResourceQuotaSpec(
                hard=quota_spec
            )
        )
        
        try:
            self.v1.create_namespaced_resource_quota(
                namespace=namespace,
                body=resource_quota,
                async_req=False
            )
            logger.info("리소스 쿼터 생성", namespace=namespace, preset=preset)
        except ApiException as e:
            if e.status != 409:  # 이미 존재하지 않는 경우만 로그
                logger.warning("리소스 쿼터 생성 실패", namespace=namespace, error=str(e))
    
    async def _create_network_policy(self, namespace: str, tenant_id: str) -> None:
        """네트워크 보안 정책 생성"""
        network_policy = client.V1NetworkPolicy(
            metadata=client.V1ObjectMeta(
                name="ecp-ai-network-policy",
                namespace=namespace
            ),
            spec=client.V1NetworkPolicySpec(
                pod_selector=client.V1LabelSelector(),
                policy_types=["Ingress", "Egress"],
                ingress=[
                    # 같은 네임스페이스 내 통신 허용
                    client.V1NetworkPolicyIngressRule(
                        _from=[
                            client.V1NetworkPolicyPeer(
                                namespace_selector=client.V1LabelSelector(
                                    match_labels={"ecp.ai/tenant-id": tenant_id}
                                )
                            )
                        ]
                    ),
                    # 모니터링 네임스페이스에서 접근 허용
                    client.V1NetworkPolicyIngressRule(
                        _from=[
                            client.V1NetworkPolicyPeer(
                                namespace_selector=client.V1LabelSelector(
                                    match_labels={"name": "monitoring"}
                                )
                            )
                        ]
                    ),
                    # Ingress에서 접근 허용
                    client.V1NetworkPolicyIngressRule(
                        _from=[
                            client.V1NetworkPolicyPeer(
                                namespace_selector=client.V1LabelSelector(
                                    match_labels={"name": "ingress-nginx"}
                                )
                            )
                        ],
                        ports=[
                            client.V1NetworkPolicyPort(protocol="TCP", port=8080)
                        ]
                    )
                ],
                egress=[
                    # 같은 네임스페이스 내 통신 허용
                    client.V1NetworkPolicyEgressRule(
                        to=[
                            client.V1NetworkPolicyPeer(
                                namespace_selector=client.V1LabelSelector(
                                    match_labels={"ecp.ai/tenant-id": tenant_id}
                                )
                            )
                        ]
                    ),
                    # 외부 API 통신 허용 (HTTPS, DNS)
                    client.V1NetworkPolicyEgressRule(
                        to=[],
                        ports=[
                            client.V1NetworkPolicyPort(protocol="TCP", port=443),
                            client.V1NetworkPolicyPort(protocol="TCP", port=53),
                            client.V1NetworkPolicyPort(protocol="UDP", port=53)
                        ]
                    )
                ]
            )
        )
        
        try:
            self.networking_v1.create_namespaced_network_policy(
                namespace=namespace,
                body=network_policy,
                async_req=False
            )
            logger.info("네트워크 정책 생성", namespace=namespace)
        except ApiException as e:
            if e.status != 409:
                logger.warning("네트워크 정책 생성 실패", namespace=namespace, error=str(e))
    
    async def deploy_service(self, 
                           tenant_id: str,
                           service_name: str,
                           service_config: Dict[str, Any]) -> bool:
        """
        서비스별 Deployment 및 Service 생성
        GPU 워크로드 특별 처리 포함
        """
        namespace = f"{tenant_id}-ecp-ai"
        
        try:
            # 1. Deployment 생성
            deployment_success = await self._create_deployment(
                namespace, tenant_id, service_name, service_config
            )
            
            if not deployment_success:
                return False
            
            # 2. Service 생성
            service_success = await self._create_service(
                namespace, tenant_id, service_name, service_config
            )
            
            if not service_success:
                return False
            
            # 3. 오토스케일링 설정 (필요한 경우)
            if service_config.get("scaling", {}).get("enabled", False):
                await self.setup_autoscaling(namespace, service_name, service_config)
            
            # 4. 모니터링 설정
            await self.configure_monitoring(namespace, tenant_id, service_name)
            
            logger.info(
                "서비스 배포 완료",
                namespace=namespace,
                service_name=service_name,
                tenant_id=tenant_id
            )
            
            return True
            
        except Exception as e:
            logger.error(
                "서비스 배포 실패",
                namespace=namespace,
                service_name=service_name,
                error=str(e)
            )
            return False
    
    async def _create_deployment(self, 
                               namespace: str,
                               tenant_id: str,
                               service_name: str,
                               service_config: Dict[str, Any]) -> bool:
        """Deployment 매니페스트 생성 및 배포"""
        
        container_spec = service_config["container_specs"]
        resource_req = service_config["resource_requirements"]
        
        # 컨테이너 리소스 설정
        resources = client.V1ResourceRequirements()
        
        # 기본 리소스 요청/제한
        if "resources" in container_spec:
            resources.requests = container_spec["resources"].get("requests", {})
            resources.limits = container_spec["resources"].get("limits", {})
        
        # GPU 할당이 있는 경우 GPU 리소스 추가
        if "gpu_allocation" in service_config:
            gpu_alloc = service_config["gpu_allocation"]
            gpu_count = gpu_alloc.get("count", 1)
            
            if not resources.requests:
                resources.requests = {}
            if not resources.limits:
                resources.limits = {}
                
            resources.requests["nvidia.com/gpu"] = str(gpu_count)
            resources.limits["nvidia.com/gpu"] = str(gpu_count)
        
        # 환경변수 설정
        env_vars = [
            client.V1EnvVar(name="TENANT_ID", value=tenant_id),
            client.V1EnvVar(name="SERVICE_NAME", value=service_name)
        ]
        
        # 추가 환경변수
        for env_var in container_spec.get("env", []):
            env_vars.append(client.V1EnvVar(name=env_var["name"], value=env_var["value"]))
        
        # GPU 타입 환경변수 추가
        if "gpu_allocation" in service_config:
            gpu_type = service_config["gpu_allocation"].get("type", "t4")
            env_vars.append(client.V1EnvVar(name="GPU_TYPE", value=gpu_type))
        
        # 포트 설정
        ports = []
        for port_spec in container_spec.get("ports", []):
            ports.append(client.V1ContainerPort(
                container_port=port_spec["containerPort"],
                protocol=port_spec.get("protocol", "TCP")
            ))
        
        # 헬스체크 설정
        liveness_probe = None
        readiness_probe = None
        
        if ports:
            main_port = ports[0].container_port
            liveness_probe = client.V1Probe(
                http_get=client.V1HTTPGetAction(path="/health", port=main_port),
                initial_delay_seconds=30,
                period_seconds=10,
                timeout_seconds=5,
                failure_threshold=3
            )
            readiness_probe = client.V1Probe(
                http_get=client.V1HTTPGetAction(path="/ready", port=main_port),
                initial_delay_seconds=5,
                period_seconds=5,
                timeout_seconds=3,
                failure_threshold=3
            )
        
        # 컨테이너 정의
        container = client.V1Container(
            name=service_name,
            image=container_spec["image"],
            ports=ports,
            env=env_vars,
            resources=resources,
            liveness_probe=liveness_probe,
            readiness_probe=readiness_probe
        )
        
        # Pod 스펙
        pod_spec = client.V1PodSpec(containers=[container])
        
        # GPU 워크로드인 경우 NodeSelector 추가
        if "gpu_allocation" in service_config:
            gpu_type = service_config["gpu_allocation"].get("type", "t4")
            pod_spec.node_selector = {"accelerator": f"nvidia-{gpu_type}"}
            
            # GPU 워크로드 톨러레이션 추가
            pod_spec.tolerations = [
                client.V1Toleration(
                    key="nvidia.com/gpu",
                    operator="Equal",
                    value="present",
                    effect="NoSchedule"
                )
            ]
        
        # Pod 템플릿
        pod_template = client.V1PodTemplateSpec(
            metadata=client.V1ObjectMeta(
                labels={
                    "app": service_name,
                    "tenant": tenant_id,
                    "service-type": service_config.get("type", "support"),
                    "ecp.ai/tenant-id": tenant_id,
                    "ecp.ai/service": service_name
                }
            ),
            spec=pod_spec
        )
        
        # Deployment 생성
        deployment = client.V1Deployment(
            metadata=client.V1ObjectMeta(
                name=service_name,
                namespace=namespace,
                labels={
                    "app": service_name,
                    "tenant": tenant_id,
                    "ecp.ai/tenant-id": tenant_id,
                    "ecp.ai/service": service_name
                }
            ),
            spec=client.V1DeploymentSpec(
                replicas=service_config.get("count", 1),
                selector=client.V1LabelSelector(
                    match_labels={
                        "app": service_name,
                        "tenant": tenant_id
                    }
                ),
                template=pod_template,
                strategy=client.V1DeploymentStrategy(
                    type="RollingUpdate",
                    rolling_update=client.V1RollingUpdateDeployment(
                        max_unavailable="25%",
                        max_surge="25%"
                    )
                )
            )
        )
        
        try:
            self.apps_v1.create_namespaced_deployment(
                namespace=namespace,
                body=deployment,
                async_req=False
            )
            logger.info("Deployment 생성", namespace=namespace, service_name=service_name)
            return True
        except ApiException as e:
            if e.status == 409:  # 이미 존재
                logger.info("Deployment 이미 존재", namespace=namespace, service_name=service_name)
                return True
            else:
                logger.error("Deployment 생성 실패", namespace=namespace, service_name=service_name, error=str(e))
                return False
    
    async def _create_service(self, 
                            namespace: str,
                            tenant_id: str,
                            service_name: str,
                            service_config: Dict[str, Any]) -> bool:
        """Service 매니페스트 생성 및 배포"""
        
        container_spec = service_config["container_specs"]
        
        # 포트 매핑
        ports = []
        for port_spec in container_spec.get("ports", []):
            ports.append(client.V1ServicePort(
                name=f"port-{port_spec['containerPort']}",
                port=port_spec["containerPort"],
                target_port=port_spec["containerPort"],
                protocol=port_spec.get("protocol", "TCP")
            ))
        
        # Service 생성
        service = client.V1Service(
            metadata=client.V1ObjectMeta(
                name=f"{service_name}-service",
                namespace=namespace,
                labels={
                    "app": service_name,
                    "tenant": tenant_id,
                    "ecp.ai/tenant-id": tenant_id,
                    "ecp.ai/service": service_name,
                    "monitoring": "enabled"  # 모니터링용 라벨
                }
            ),
            spec=client.V1ServiceSpec(
                selector={
                    "app": service_name,
                    "tenant": tenant_id
                },
                ports=ports,
                type="ClusterIP"
            )
        )
        
        try:
            self.v1.create_namespaced_service(
                namespace=namespace,
                body=service,
                async_req=False
            )
            logger.info("Service 생성", namespace=namespace, service_name=service_name)
            return True
        except ApiException as e:
            if e.status == 409:  # 이미 존재
                logger.info("Service 이미 존재", namespace=namespace, service_name=service_name)
                return True
            else:
                logger.error("Service 생성 실패", namespace=namespace, service_name=service_name, error=str(e))
                return False
    
    async def setup_autoscaling(self, 
                              namespace: str,
                              service_name: str,
                              service_config: Dict[str, Any]) -> bool:
        """
        HPA (Horizontal Pod Autoscaler) 설정
        CPU/메모리 기반 오토스케일링
        """
        scaling_config = service_config.get("scaling", {})
        
        # HPA 매니페스트
        hpa = client.V2HorizontalPodAutoscaler(
            metadata=client.V1ObjectMeta(
                name=f"{service_name}-hpa",
                namespace=namespace
            ),
            spec=client.V2HorizontalPodAutoscalerSpec(
                scale_target_ref=client.V2CrossVersionObjectReference(
                    api_version="apps/v1",
                    kind="Deployment",
                    name=service_name
                ),
                min_replicas=scaling_config.get("min_replicas", 1),
                max_replicas=scaling_config.get("max_replicas", 10),
                metrics=[
                    # CPU 기반 스케일링
                    client.V2MetricSpec(
                        type="Resource",
                        resource=client.V2ResourceMetricSource(
                            name="cpu",
                            target=client.V2MetricTarget(
                                type="Utilization",
                                average_utilization=scaling_config.get("target_cpu", 70)
                            )
                        )
                    ),
                    # 메모리 기반 스케일링
                    client.V2MetricSpec(
                        type="Resource",
                        resource=client.V2ResourceMetricSource(
                            name="memory",
                            target=client.V2MetricTarget(
                                type="Utilization",
                                average_utilization=scaling_config.get("target_memory", 80)
                            )
                        )
                    )
                ],
                behavior=client.V2HorizontalPodAutoscalerBehavior(
                    scale_up=client.V2HPAScalingRules(
                        stabilization_window_seconds=60,
                        policies=[
                            client.V2HPAScalingPolicy(
                                type="Percent",
                                value=100,
                                period_seconds=60
                            )
                        ]
                    ),
                    scale_down=client.V2HPAScalingRules(
                        stabilization_window_seconds=300,
                        policies=[
                            client.V2HPAScalingPolicy(
                                type="Percent",
                                value=10,
                                period_seconds=60
                            )
                        ]
                    )
                )
            )
        )
        
        try:
            self.autoscaling_v2.create_namespaced_horizontal_pod_autoscaler(
                namespace=namespace,
                body=hpa,
                async_req=False
            )
            logger.info("HPA 생성", namespace=namespace, service_name=service_name)
            return True
        except ApiException as e:
            if e.status == 409:  # 이미 존재
                logger.info("HPA 이미 존재", namespace=namespace, service_name=service_name)
                return True
            else:
                logger.error("HPA 생성 실패", namespace=namespace, service_name=service_name, error=str(e))
                return False
    
    async def configure_monitoring(self, 
                                 namespace: str,
                                 tenant_id: str,
                                 service_name: str) -> bool:
        """
        Prometheus ServiceMonitor 설정
        메트릭 수집 활성화
        """
        service_monitor = {
            "apiVersion": "monitoring.coreos.com/v1",
            "kind": "ServiceMonitor",
            "metadata": {
                "name": f"{service_name}-monitor",
                "namespace": namespace,
                "labels": {
                    "tenant": tenant_id,
                    "service": service_name,
                    "ecp.ai/tenant-id": tenant_id,
                    "ecp.ai/service": service_name
                }
            },
            "spec": {
                "selector": {
                    "matchLabels": {
                        "monitoring": "enabled",
                        "app": service_name
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
        
        try:
            self.monitoring_v1.create_namespaced_custom_object(
                group="monitoring.coreos.com",
                version="v1",
                namespace=namespace,
                plural="servicemonitors",
                body=service_monitor,
                async_req=False
            )
            logger.info("ServiceMonitor 생성", namespace=namespace, service_name=service_name)
            return True
        except ApiException as e:
            if e.status == 409:  # 이미 존재
                logger.info("ServiceMonitor 이미 존재", namespace=namespace, service_name=service_name)
                return True
            else:
                logger.warning("ServiceMonitor 생성 실패 (Prometheus Operator 없음?)", 
                             namespace=namespace, service_name=service_name, error=str(e))
                return False
        except Exception as e:
            logger.warning("ServiceMonitor 생성 중 오류", 
                         namespace=namespace, service_name=service_name, error=str(e))
            return False
    
    async def delete_tenant(self, tenant_id: str) -> bool:
        """테넌시 전체 삭제 (네임스페이스 삭제로 모든 리소스 정리)"""
        namespace_name = f"{tenant_id}-ecp-ai"
        
        try:
            self.v1.delete_namespace(
                name=namespace_name,
                async_req=False
            )
            logger.info("테넌시 삭제 시작", tenant_id=tenant_id, namespace=namespace_name)
            return True
        except ApiException as e:
            if e.status == 404:  # 이미 삭제됨
                logger.info("테넌시 이미 삭제됨", tenant_id=tenant_id)
                return True
            else:
                logger.error("테넌시 삭제 실패", tenant_id=tenant_id, error=str(e))
                return False
    
    async def get_tenant_status(self, tenant_id: str) -> Optional[Dict[str, Any]]:
        """테넌시 상태 조회"""
        namespace_name = f"{tenant_id}-ecp-ai"
        
        try:
            # 네임스페이스 존재 확인
            self.v1.read_namespace(name=namespace_name, async_req=False)
            
            # 배포된 서비스 목록 조회
            deployments = self.apps_v1.list_namespaced_deployment(
                namespace=namespace_name,
                async_req=False
            )
            
            services = []
            for deployment in deployments.items:
                service_info = {
                    "name": deployment.metadata.name,
                    "replicas": {
                        "desired": deployment.spec.replicas,
                        "available": deployment.status.available_replicas or 0,
                        "ready": deployment.status.ready_replicas or 0
                    },
                    "status": "Running" if deployment.status.available_replicas == deployment.spec.replicas else "Pending"
                }
                services.append(service_info)
            
            return {
                "tenant_id": tenant_id,
                "namespace": namespace_name,
                "status": "Running",
                "services": services
            }
            
        except ApiException as e:
            if e.status == 404:
                logger.info("테넌시 없음", tenant_id=tenant_id)
                return None
            else:
                logger.error("테넌시 상태 조회 실패", tenant_id=tenant_id, error=str(e))
                return None
