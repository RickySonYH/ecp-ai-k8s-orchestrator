# [advice from AI] ECP-AI 서비스별 개별 설정 모델
"""
서비스별 개별 설정 모델
- 각 서비스의 Dockerfile, 빌드 설정, Kubernetes 설정 등을 개별적으로 관리
- 환경별 설정 오버라이드 지원
- 동적 설정 로딩 및 병합 기능
"""

from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field
from enum import Enum
from .tenant_specs import (
    AutoScalingConfig, ResourceConfig, ProbeConfig, 
    AffinityConfig, DeploymentStrategy, DeploymentEnvironment
)


class BuildOptimizationLevel(str, Enum):
    """빌드 최적화 레벨"""
    DEBUG = "debug"
    DEVELOPMENT = "development"
    PRODUCTION = "production"
    OPTIMIZED = "optimized"


class ServiceImageConfig(BaseModel):
    """서비스별 이미지 설정"""
    base_image: str = Field(..., description="베이스 이미지")
    multi_stage: bool = Field(True, description="멀티스테이지 빌드 여부")
    optimization_level: BuildOptimizationLevel = Field(
        BuildOptimizationLevel.PRODUCTION, 
        description="빌드 최적화 레벨"
    )
    security_scan: bool = Field(True, description="보안 스캔 여부")
    build_args: Dict[str, str] = Field(default_factory=dict, description="빌드 인자")
    target_stage: Optional[str] = Field(None, description="멀티스테이지 빌드 타겟 스테이지")
    cache_from: List[str] = Field(default_factory=list, description="캐시 소스 이미지")
    cache_to: Optional[str] = Field(None, description="캐시 대상")


class ServiceKubernetesConfig(BaseModel):
    """서비스별 Kubernetes 설정"""
    auto_scaling: AutoScalingConfig = Field(default_factory=AutoScalingConfig)
    resource_config: ResourceConfig = Field(default_factory=ResourceConfig)
    probe_config: ProbeConfig = Field(default_factory=ProbeConfig)
    affinity_config: AffinityConfig = Field(default_factory=AffinityConfig)
    deployment_strategy: DeploymentStrategy = Field(DeploymentStrategy.ROLLING_UPDATE)
    node_selector: Dict[str, str] = Field(default_factory=dict, description="노드 셀렉터")
    priority_class_name: Optional[str] = Field(None, description="우선순위 클래스")
    service_account_name: Optional[str] = Field(None, description="서비스 계정 이름")
    security_context: Dict[str, Any] = Field(default_factory=dict, description="보안 컨텍스트")


class ServiceSpecificConfig(BaseModel):
    """서비스별 개별 설정"""
    service_name: str = Field(..., description="서비스 이름")
    dockerfile_path: str = Field(..., description="서비스별 Dockerfile 경로")
    build_context: str = Field(..., description="빌드 컨텍스트")
    image_config: ServiceImageConfig = Field(..., description="이미지별 설정")
    kubernetes_config: ServiceKubernetesConfig = Field(..., description="K8s 설정")
    environment_variables: Dict[str, str] = Field(default_factory=dict, description="환경변수")
    volumes: List[Dict[str, Any]] = Field(default_factory=list, description="볼륨 설정")
    ports: List[Dict[str, Any]] = Field(default_factory=list, description="포트 설정")
    health_check_path: Optional[str] = Field(None, description="헬스체크 경로")
    readiness_check_path: Optional[str] = Field(None, description="준비상태 체크 경로")


class EnvironmentSpecificConfig(BaseModel):
    """환경별 설정"""
    environment: DeploymentEnvironment = Field(..., description="배포 환경")
    config_overrides: Dict[str, Any] = Field(default_factory=dict, description="환경별 설정 오버라이드")
    secrets: Dict[str, str] = Field(default_factory=dict, description="환경별 시크릿")
    monitoring: Dict[str, Any] = Field(default_factory=dict, description="모니터링 설정")
    network_policy: Dict[str, Any] = Field(default_factory=dict, description="네트워크 정책")
    resource_quotas: Dict[str, Any] = Field(default_factory=dict, description="리소스 할당량")
    backup_config: Dict[str, Any] = Field(default_factory=dict, description="백업 설정")


class MergedConfig(BaseModel):
    """병합된 최종 설정"""
    service_config: ServiceSpecificConfig
    environment_config: EnvironmentSpecificConfig
    final_config: Dict[str, Any] = Field(..., description="최종 병합된 설정")
    override_summary: List[str] = Field(default_factory=list, description="오버라이드된 설정 요약")


class ConfigurationOverride(BaseModel):
    """설정 오버라이드 정보"""
    original_value: Any = Field(..., description="원본 값")
    overridden_value: Any = Field(..., description="오버라이드된 값")
    override_reason: str = Field(..., description="오버라이드 이유")
    environment: str = Field(..., description="적용된 환경")


class ServiceConfigurationManager:
    """서비스 설정 관리자"""
    
    def __init__(self):
        self.service_configs: Dict[str, ServiceSpecificConfig] = {}
        self.environment_configs: Dict[str, EnvironmentSpecificConfig] = {}
        self._load_default_configs()
    
    def _load_default_configs(self):
        """기본 설정 로드"""
        # Callbot 서비스 설정
        self.service_configs["callbot"] = ServiceSpecificConfig(
            service_name="callbot",
            dockerfile_path="services/callbot/Dockerfile",
            build_context="services/callbot",
            image_config=ServiceImageConfig(
                base_image="nvidia/cuda:11.8-devel-ubuntu20.04",
                multi_stage=True,
                optimization_level=BuildOptimizationLevel.OPTIMIZED,
                security_scan=True,
                build_args={
                    "CUDA_VERSION": "11.8",
                    "PYTHON_VERSION": "3.9"
                }
            ),
            kubernetes_config=ServiceKubernetesConfig(
                auto_scaling=AutoScalingConfig(
                    enabled=False,  # GPU 서비스는 수동 스케일링
                    min_replicas=1,
                    max_replicas=5
                ),
                resource_config=ResourceConfig(
                    requests={"cpu": "2", "memory": "8Gi", "nvidia.com/gpu": "1"},
                    limits={"cpu": "4", "memory": "16Gi", "nvidia.com/gpu": "1"}
                ),
                probe_config=ProbeConfig(
                    initial_delay_seconds=60,  # GPU 초기화 시간 고려
                    period_seconds=30,
                    timeout_seconds=10
                )
            ),
            health_check_path="/health",
            readiness_check_path="/ready",
            ports=[{"name": "http", "containerPort": 8080, "protocol": "TCP"}]
        )
        
        # Chatbot 서비스 설정
        self.service_configs["chatbot"] = ServiceSpecificConfig(
            service_name="chatbot",
            dockerfile_path="services/chatbot/Dockerfile",
            build_context="services/chatbot",
            image_config=ServiceImageConfig(
                base_image="python:3.9-slim",
                multi_stage=True,
                optimization_level=BuildOptimizationLevel.PRODUCTION,
                security_scan=True
            ),
            kubernetes_config=ServiceKubernetesConfig(
                auto_scaling=AutoScalingConfig(
                    enabled=True,
                    min_replicas=2,
                    max_replicas=20,
                    target_cpu=70,
                    target_memory=80
                ),
                resource_config=ResourceConfig(
                    requests={"cpu": "500m", "memory": "1Gi"},
                    limits={"cpu": "2", "memory": "4Gi"}
                ),
                probe_config=ProbeConfig(
                    initial_delay_seconds=30,
                    period_seconds=10,
                    timeout_seconds=5
                )
            ),
            health_check_path="/health",
            readiness_check_path="/ready",
            ports=[{"name": "http", "containerPort": 8081, "protocol": "TCP"}]
        )
        
        # Advisor 서비스 설정
        self.service_configs["advisor"] = ServiceSpecificConfig(
            service_name="advisor",
            dockerfile_path="services/advisor/Dockerfile",
            build_context="services/advisor",
            image_config=ServiceImageConfig(
                base_image="python:3.9-slim",
                multi_stage=True,
                optimization_level=BuildOptimizationLevel.PRODUCTION,
                security_scan=True
            ),
            kubernetes_config=ServiceKubernetesConfig(
                auto_scaling=AutoScalingConfig(
                    enabled=True,
                    min_replicas=1,
                    max_replicas=10,
                    target_cpu=60,
                    target_memory=70
                ),
                resource_config=ResourceConfig(
                    requests={"cpu": "1", "memory": "2Gi"},
                    limits={"cpu": "4", "memory": "8Gi"}
                ),
                probe_config=ProbeConfig(
                    initial_delay_seconds=45,
                    period_seconds=15,
                    timeout_seconds=8
                )
            ),
            health_check_path="/health",
            readiness_check_path="/ready",
            ports=[{"name": "http", "containerPort": 8082, "protocol": "TCP"}]
        )
        
        # 환경별 설정
        self.environment_configs["development"] = EnvironmentSpecificConfig(
            environment=DeploymentEnvironment.DEVELOPMENT,
            config_overrides={
                "resource_config": {"requests": {"cpu": "100m", "memory": "256Mi"}},
                "auto_scaling": {"enabled": False},
                "monitoring": {"enabled": False}
            },
            secrets={"debug_mode": "true", "log_level": "DEBUG"}
        )
        
        self.environment_configs["production"] = EnvironmentSpecificConfig(
            environment=DeploymentEnvironment.PRODUCTION,
            config_overrides={
                "monitoring": {"enabled": True, "prometheus": True},
                "security_context": {"runAsNonRoot": True},
                "network_policy": {"enabled": True}
            },
            secrets={"debug_mode": "false", "log_level": "INFO"}
        )
    
    def get_service_config(self, service_name: str) -> Optional[ServiceSpecificConfig]:
        """서비스별 설정 조회"""
        return self.service_configs.get(service_name)
    
    def get_environment_config(self, environment: str) -> Optional[EnvironmentSpecificConfig]:
        """환경별 설정 조회"""
        return self.environment_configs.get(environment)
    
    def merge_configs(self, service_name: str, environment: str) -> MergedConfig:
        """서비스별 설정과 환경별 설정 병합"""
        service_config = self.get_service_config(service_name)
        env_config = self.get_environment_config(environment)
        
        if not service_config:
            raise ValueError(f"서비스 설정을 찾을 수 없습니다: {service_name}")
        
        if not env_config:
            raise ValueError(f"환경 설정을 찾을 수 없습니다: {environment}")
        
        # 설정 병합 로직
        final_config = self._merge_service_and_env_configs(service_config, env_config)
        override_summary = self._generate_override_summary(service_config, env_config)
        
        return MergedConfig(
            service_config=service_config,
            environment_config=env_config,
            final_config=final_config,
            override_summary=override_summary
        )
    
    def _merge_service_and_env_configs(self, service_config: ServiceSpecificConfig, 
                                     env_config: EnvironmentSpecificConfig) -> Dict[str, Any]:
        """서비스 설정과 환경 설정 병합"""
        # 깊은 복사로 서비스 설정 복사
        merged = service_config.dict()
        
        # 환경별 오버라이드 적용
        for key, value in env_config.config_overrides.items():
            if key in merged:
                if isinstance(merged[key], dict) and isinstance(value, dict):
                    merged[key].update(value)
                else:
                    merged[key] = value
        
        return merged
    
    def _generate_override_summary(self, service_config: ServiceSpecificConfig, 
                                 env_config: EnvironmentSpecificConfig) -> List[str]:
        """오버라이드된 설정 요약 생성"""
        summary = []
        
        for key, value in env_config.config_overrides.items():
            if hasattr(service_config, key):
                original_value = getattr(service_config, key)
                summary.append(f"{key}: {original_value} → {value}")
        
        return summary
