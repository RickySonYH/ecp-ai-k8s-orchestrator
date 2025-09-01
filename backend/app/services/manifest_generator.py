# [advice from AI] 매니페스트 생성 서비스
import yaml
import logging
from typing import Dict, Any, List
from datetime import datetime

logger = logging.getLogger(__name__)

class ManifestGenerator:
    """Kubernetes 매니페스트 생성기
    
    테넌트 정보를 기반으로 K8S 매니페스트를 생성합니다.
    """
    
    def __init__(self):
        self.namespace_prefix = "ecp-ai"
    
    async def generate_tenant_manifest(
        self, 
        tenant_data: Dict[str, Any], 
        is_demo: bool = False
    ) -> str:
        """테넌트용 K8S 매니페스트 생성
        
        Args:
            tenant_data: 테넌트 정보
            is_demo: 데모 모드 여부
            
        Returns:
            생성된 YAML 매니페스트 문자열
        """
        try:
            tenant_id = tenant_data.get("id", "unknown")
            tenant_name = tenant_data.get("name", f"tenant-{tenant_id}")
            
            # [advice from AI] 네임스페이스 이름 생성
            namespace_name = f"{self.namespace_prefix}-{tenant_name}".lower().replace("_", "-")
            
            logger.info(f"Generating manifest for tenant {tenant_id} (demo: {is_demo})")
            
            # 매니페스트 리소스 목록
            resources = []
            
            # 1. Namespace
            resources.append(self._create_namespace(namespace_name, tenant_data))
            
            # 2. ConfigMap
            resources.append(self._create_configmap(namespace_name, tenant_data))
            
            # 3. Secret
            resources.append(self._create_secret(namespace_name, tenant_data))
            
            # 4. Deployment
            resources.append(self._create_deployment(namespace_name, tenant_data, is_demo))
            
            # 5. Service
            resources.append(self._create_service(namespace_name, tenant_data))
            
            # 6. Ingress (실사용 모드에서만)
            if not is_demo:
                resources.append(self._create_ingress(namespace_name, tenant_data))
            
            # YAML 문서들을 연결
            manifest_content = "---\n".join([
                yaml.dump(resource, default_flow_style=False, allow_unicode=True)
                for resource in resources
            ])
            
            logger.info(f"Generated manifest with {len(resources)} resources for tenant {tenant_id}")
            return manifest_content
            
        except Exception as e:
            logger.error(f"Manifest generation failed for tenant {tenant_data.get('id')}: {e}")
            raise Exception(f"매니페스트 생성 실패: {str(e)}")
    
    def _create_namespace(self, namespace_name: str, tenant_data: Dict[str, Any]) -> Dict[str, Any]:
        """네임스페이스 리소스 생성"""
        return {
            "apiVersion": "v1",
            "kind": "Namespace",
            "metadata": {
                "name": namespace_name,
                "labels": {
                    "app.kubernetes.io/name": "ecp-ai-tenant",
                    "app.kubernetes.io/instance": tenant_data.get("name", "unknown"),
                    "app.kubernetes.io/managed-by": "ecp-ai-orchestrator",
                    "ecp-ai/tenant-id": str(tenant_data.get("id", "unknown"))
                },
                "annotations": {
                    "ecp-ai/created-at": datetime.utcnow().isoformat(),
                    "ecp-ai/tenant-name": tenant_data.get("name", "unknown"),
                    "ecp-ai/description": tenant_data.get("description", "ECP-AI managed tenant")
                }
            }
        }
    
    def _create_configmap(self, namespace_name: str, tenant_data: Dict[str, Any]) -> Dict[str, Any]:
        """ConfigMap 리소스 생성"""
        config_data = {
            "tenant.properties": f"""
tenant.id={tenant_data.get('id', 'unknown')}
tenant.name={tenant_data.get('name', 'unknown')}
tenant.created_at={datetime.utcnow().isoformat()}
tenant.cpu_limit={tenant_data.get('cpu_limit', '1000m')}
tenant.memory_limit={tenant_data.get('memory_limit', '2Gi')}
tenant.storage_limit={tenant_data.get('storage_limit', '10Gi')}
            """.strip(),
            "application.yaml": yaml.dump({
                "server": {
                    "port": 8080
                },
                "spring": {
                    "application": {
                        "name": tenant_data.get("name", "ecp-ai-app")
                    }
                },
                "management": {
                    "endpoints": {
                        "web": {
                            "exposure": {
                                "include": "health,metrics,prometheus"
                            }
                        }
                    }
                }
            }, default_flow_style=False)
        }
        
        return {
            "apiVersion": "v1",
            "kind": "ConfigMap",
            "metadata": {
                "name": f"{tenant_data.get('name', 'app')}-config",
                "namespace": namespace_name,
                "labels": {
                    "app.kubernetes.io/name": "ecp-ai-tenant",
                    "app.kubernetes.io/component": "configuration"
                }
            },
            "data": config_data
        }
    
    def _create_secret(self, namespace_name: str, tenant_data: Dict[str, Any]) -> Dict[str, Any]:
        """Secret 리소스 생성"""
        import base64
        
        # [advice from AI] 실제로는 보안이 강화된 시크릿을 생성해야 함
        secret_data = {
            "database-password": base64.b64encode(b"secure-password-123").decode(),
            "api-key": base64.b64encode(f"api-key-{tenant_data.get('id', 'unknown')}".encode()).decode(),
            "jwt-secret": base64.b64encode(b"jwt-secret-key-for-tenant").decode()
        }
        
        return {
            "apiVersion": "v1",
            "kind": "Secret",
            "metadata": {
                "name": f"{tenant_data.get('name', 'app')}-secrets",
                "namespace": namespace_name,
                "labels": {
                    "app.kubernetes.io/name": "ecp-ai-tenant",
                    "app.kubernetes.io/component": "security"
                }
            },
            "type": "Opaque",
            "data": secret_data
        }
    
    def _create_deployment(self, namespace_name: str, tenant_data: Dict[str, Any], is_demo: bool) -> Dict[str, Any]:
        """Deployment 리소스 생성"""
        app_name = tenant_data.get("name", "ecp-ai-app")
        
        # [advice from AI] 데모 모드와 실사용 모드에 따른 리소스 할당
        if is_demo:
            cpu_request = "100m"
            cpu_limit = "500m"
            memory_request = "128Mi"
            memory_limit = "512Mi"
            replicas = 1
        else:
            cpu_request = tenant_data.get("cpu_limit", "500m")
            cpu_limit = tenant_data.get("cpu_limit", "1000m")
            memory_request = "512Mi"
            memory_limit = tenant_data.get("memory_limit", "2Gi")
            replicas = 2
        
        return {
            "apiVersion": "apps/v1",
            "kind": "Deployment",
            "metadata": {
                "name": f"{app_name}-deployment",
                "namespace": namespace_name,
                "labels": {
                    "app.kubernetes.io/name": "ecp-ai-tenant",
                    "app.kubernetes.io/component": "application",
                    "app": app_name
                }
            },
            "spec": {
                "replicas": replicas,
                "selector": {
                    "matchLabels": {
                        "app": app_name
                    }
                },
                "template": {
                    "metadata": {
                        "labels": {
                            "app": app_name,
                            "version": "v1.54.0"
                        },
                        "annotations": {
                            "prometheus.io/scrape": "true",
                            "prometheus.io/port": "8080",
                            "prometheus.io/path": "/actuator/prometheus"
                        }
                    },
                    "spec": {
                        "containers": [
                            {
                                "name": app_name,
                                "image": "nginx:1.21-alpine",  # [advice from AI] 실제로는 테넌트별 이미지 사용
                                "ports": [
                                    {
                                        "containerPort": 8080,
                                        "name": "http",
                                        "protocol": "TCP"
                                    },
                                    {
                                        "containerPort": 8081,
                                        "name": "management",
                                        "protocol": "TCP"
                                    }
                                ],
                                "resources": {
                                    "requests": {
                                        "cpu": cpu_request,
                                        "memory": memory_request
                                    },
                                    "limits": {
                                        "cpu": cpu_limit,
                                        "memory": memory_limit
                                    }
                                },
                                "env": [
                                    {
                                        "name": "TENANT_ID",
                                        "value": str(tenant_data.get("id", "unknown"))
                                    },
                                    {
                                        "name": "TENANT_NAME",
                                        "value": tenant_data.get("name", "unknown")
                                    },
                                    {
                                        "name": "ENVIRONMENT",
                                        "value": "demo" if is_demo else "production"
                                    }
                                ],
                                "volumeMounts": [
                                    {
                                        "name": "config-volume",
                                        "mountPath": "/app/config"
                                    }
                                ],
                                "livenessProbe": {
                                    "httpGet": {
                                        "path": "/actuator/health",
                                        "port": 8081
                                    },
                                    "initialDelaySeconds": 30,
                                    "periodSeconds": 10
                                },
                                "readinessProbe": {
                                    "httpGet": {
                                        "path": "/actuator/health/readiness",
                                        "port": 8081
                                    },
                                    "initialDelaySeconds": 10,
                                    "periodSeconds": 5
                                }
                            }
                        ],
                        "volumes": [
                            {
                                "name": "config-volume",
                                "configMap": {
                                    "name": f"{app_name}-config"
                                }
                            }
                        ]
                    }
                }
            }
        }
    
    def _create_service(self, namespace_name: str, tenant_data: Dict[str, Any]) -> Dict[str, Any]:
        """Service 리소스 생성"""
        app_name = tenant_data.get("name", "ecp-ai-app")
        
        return {
            "apiVersion": "v1",
            "kind": "Service",
            "metadata": {
                "name": f"{app_name}-service",
                "namespace": namespace_name,
                "labels": {
                    "app.kubernetes.io/name": "ecp-ai-tenant",
                    "app.kubernetes.io/component": "service"
                },
                "annotations": {
                    "service.beta.kubernetes.io/aws-load-balancer-type": "nlb"
                }
            },
            "spec": {
                "type": "ClusterIP",
                "ports": [
                    {
                        "name": "http",
                        "port": 80,
                        "targetPort": 8080,
                        "protocol": "TCP"
                    },
                    {
                        "name": "management",
                        "port": 8081,
                        "targetPort": 8081,
                        "protocol": "TCP"
                    }
                ],
                "selector": {
                    "app": app_name
                }
            }
        }
    
    def _create_ingress(self, namespace_name: str, tenant_data: Dict[str, Any]) -> Dict[str, Any]:
        """Ingress 리소스 생성 (실사용 모드에서만)"""
        app_name = tenant_data.get("name", "ecp-ai-app")
        domain_name = f"{app_name}.ecp-ai.com"  # [advice from AI] 실제 도메인으로 변경 필요
        
        return {
            "apiVersion": "networking.k8s.io/v1",
            "kind": "Ingress",
            "metadata": {
                "name": f"{app_name}-ingress",
                "namespace": namespace_name,
                "labels": {
                    "app.kubernetes.io/name": "ecp-ai-tenant",
                    "app.kubernetes.io/component": "ingress"
                },
                "annotations": {
                    "kubernetes.io/ingress.class": "nginx",
                    "cert-manager.io/cluster-issuer": "letsencrypt-prod",
                    "nginx.ingress.kubernetes.io/rewrite-target": "/",
                    "nginx.ingress.kubernetes.io/ssl-redirect": "true"
                }
            },
            "spec": {
                "tls": [
                    {
                        "hosts": [domain_name],
                        "secretName": f"{app_name}-tls"
                    }
                ],
                "rules": [
                    {
                        "host": domain_name,
                        "http": {
                            "paths": [
                                {
                                    "path": "/",
                                    "pathType": "Prefix",
                                    "backend": {
                                        "service": {
                                            "name": f"{app_name}-service",
                                            "port": {
                                                "number": 80
                                            }
                                        }
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        }
