from typing import Dict, List, Optional, Union, Any
from pydantic import BaseModel, Field
from enum import Enum


class PresetType(str, Enum):
    """테넌시 프리셋 타입"""
    MICRO = "micro"
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"


class GPUType(str, Enum):
    """GPU 타입"""
    T4 = "t4"
    V100 = "v100"
    L40S = "l40s"
    AUTO = "auto"


class CloudProvider(str, Enum):
    """클라우드 제공업체"""
    IAAS = "iaas"  # 기본 IaaS 환경
    AWS = "aws"  # Amazon Web Services
    NCP = "ncp"  # Naver Cloud Platform
    AZURE = "azure"  # Microsoft Azure
    GCP = "gcp"  # Google Cloud Platform
    ORACLE = "oracle"  # Oracle Cloud Infrastructure
    IBM = "ibm"  # IBM Cloud
    ALIBABA = "alibaba"  # Alibaba Cloud
    TENCENT = "tencent"  # Tencent Cloud
    VULTR = "vultr"  # Vultr
    LINODE = "linode"  # Linode
    DIGITALOCEAN = "digitalocean"  # DigitalOcean


class HealthCheckType(str, Enum):
    """헬스체크 타입"""
    HTTP = "http"
    TCP = "tcp"
    COMMAND = "command"


class VolumeType(str, Enum):
    """볼륨 타입"""
    CONFIG_MAP = "configmap"
    SECRET = "secret"
    PERSISTENT_VOLUME = "persistentvolume"
    EMPTY_DIR = "emptydir"


class HealthCheckConfig(BaseModel):
    """헬스체크 설정"""
    type: HealthCheckType = Field(..., description="헬스체크 타입")
    path: Optional[str] = Field(None, description="HTTP 경로 (HTTP 타입일 때)")
    port: Optional[int] = Field(None, description="포트 번호")
    initial_delay_seconds: int = Field(30, description="초기 지연 시간 (초)")
    period_seconds: int = Field(10, description="체크 주기 (초)")
    timeout_seconds: int = Field(5, description="타임아웃 (초)")
    failure_threshold: int = Field(3, description="실패 임계값")
    success_threshold: int = Field(1, description="성공 임계값")


class VolumeMount(BaseModel):
    """볼륨 마운트 설정"""
    name: str = Field(..., description="볼륨 이름")
    type: VolumeType = Field(..., description="볼륨 타입")
    mount_path: str = Field(..., description="마운트 경로")
    sub_path: Optional[str] = Field(None, description="하위 경로")
    read_only: bool = Field(False, description="읽기 전용 여부")
    config_map_name: Optional[str] = Field(None, description="ConfigMap 이름 (ConfigMap 타입일 때)")
    secret_name: Optional[str] = Field(None, description="Secret 이름 (Secret 타입일 때)")
    storage_class: Optional[str] = Field(None, description="스토리지 클래스 (PersistentVolume 타입일 때)")
    size: Optional[str] = Field(None, description="볼륨 크기 (예: 10Gi)")


class NetworkConfig(BaseModel):
    """네트워크 설정"""
    service_type: str = Field("ClusterIP", description="서비스 타입 (ClusterIP, NodePort, LoadBalancer)")
    external_port: Optional[int] = Field(None, description="외부 포트 (NodePort/LoadBalancer)")
    ingress_enabled: bool = Field(False, description="인그레스 활성화 여부")
    ingress_host: Optional[str] = Field(None, description="인그레스 호스트")
    ingress_tls: bool = Field(False, description="TLS 활성화 여부")
    network_policy_enabled: bool = Field(True, description="네트워크 정책 활성화")


class EnvironmentVariable(BaseModel):
    """환경변수 설정"""
    name: str = Field(..., description="환경변수 이름")
    value: Optional[str] = Field(None, description="환경변수 값")
    value_from_configmap: Optional[str] = Field(None, description="ConfigMap에서 가져올 키")
    value_from_secret: Optional[str] = Field(None, description="Secret에서 가져올 키")
    description: Optional[str] = Field(None, description="환경변수 설명")


# [advice from AI] Kubernetes 고급 설정 모델 추가
class AutoScalingConfig(BaseModel):
    """오토스케일링 설정"""
    enabled: bool = Field(True, description="오토스케일링 활성화 여부")
    min_replicas: int = Field(2, ge=1, le=100, description="최소 Pod 수")
    max_replicas: int = Field(10, ge=1, le=1000, description="최대 Pod 수")
    target_cpu: int = Field(70, ge=10, le=95, description="CPU 사용률 임계값 (%)")
    target_memory: int = Field(80, ge=10, le=95, description="메모리 사용률 임계값 (%)")
    scale_up_stabilization_window: int = Field(60, ge=0, description="스케일 업 안정화 시간 (초)")
    scale_up_max_percent: int = Field(100, ge=1, le=1000, description="스케일 업 최대 비율 (%)")
    scale_up_period_seconds: int = Field(60, ge=1, description="스케일 업 주기 (초)")
    scale_down_stabilization_window: int = Field(300, ge=0, description="스케일 다운 안정화 시간 (초)")
    scale_down_max_percent: int = Field(10, ge=1, le=100, description="스케일 다운 최대 비율 (%)")
    scale_down_period_seconds: int = Field(60, ge=1, description="스케일 다운 주기 (초)")
    custom_metrics_enabled: bool = Field(False, description="사용자 정의 메트릭 활성화")
    custom_metric_name: Optional[str] = Field(None, description="사용자 정의 메트릭 이름")
    custom_target_value: Optional[int] = Field(None, description="사용자 정의 메트릭 목표값")


class ProbeConfig(BaseModel):
    """프로브 설정"""
    enabled: bool = Field(True, description="프로브 활성화 여부")
    initial_delay_seconds: int = Field(30, ge=0, description="초기 지연 시간 (초)")
    period_seconds: int = Field(10, ge=1, description="검사 주기 (초)")
    timeout_seconds: int = Field(5, ge=1, description="타임아웃 (초)")
    failure_threshold: int = Field(3, ge=1, description="실패 임계값")
    success_threshold: int = Field(1, ge=1, description="성공 임계값")


class LatencyConfig(BaseModel):
    """지연시간 최적화 설정"""
    startup_probe: ProbeConfig = Field(default_factory=lambda: ProbeConfig(enabled=False, initial_delay_seconds=30))
    liveness_probe: ProbeConfig = Field(default_factory=lambda: ProbeConfig(initial_delay_seconds=30))
    readiness_probe: ProbeConfig = Field(default_factory=lambda: ProbeConfig(initial_delay_seconds=5, period_seconds=5))
    rolling_update_max_surge: str = Field("25%", description="롤링 업데이트 최대 증가량")
    rolling_update_max_unavailable: str = Field("25%", description="롤링 업데이트 최대 비가용량")


class ResourceRequests(BaseModel):
    """리소스 요청량"""
    cpu: str = Field("100m", description="CPU 요청량 (예: 100m, 0.5, 1)")
    memory: str = Field("256Mi", description="메모리 요청량 (예: 256Mi, 1Gi)")
    ephemeral_storage: Optional[str] = Field("1Gi", description="임시 스토리지 요청량")


class ResourceLimits(BaseModel):
    """리소스 제한량"""
    cpu: str = Field("1000m", description="CPU 제한량 (예: 1000m, 2, 4)")
    memory: str = Field("1Gi", description="메모리 제한량 (예: 1Gi, 2Gi, 4Gi)")
    ephemeral_storage: Optional[str] = Field("2Gi", description="임시 스토리지 제한량")


class QoSClass(str, Enum):
    """서비스 품질 클래스"""
    GUARANTEED = "Guaranteed"
    BURSTABLE = "Burstable"
    BEST_EFFORT = "BestEffort"


class ResourceConfig(BaseModel):
    """리소스 제한 설정"""
    requests: ResourceRequests = Field(default_factory=ResourceRequests)
    limits: ResourceLimits = Field(default_factory=ResourceLimits)
    qos_class: QoSClass = Field(QoSClass.BURSTABLE, description="QoS 클래스")


class NodeAffinityConfig(BaseModel):
    """노드 어피니티 설정"""
    enabled: bool = Field(False, description="노드 어피니티 활성화")
    required_during_scheduling: bool = Field(False, description="스케줄링 시 필수 조건 여부")
    match_labels: Dict[str, str] = Field(default_factory=dict, description="매칭할 레이블")


class PodAffinityConfig(BaseModel):
    """Pod 어피니티 설정"""
    enabled: bool = Field(False, description="Pod 어피니티 활성화")
    preferred_during_scheduling: bool = Field(True, description="스케줄링 시 선호 조건 여부")
    topology_key: str = Field("kubernetes.io/hostname", description="토폴로지 키")


class PodAntiAffinityConfig(BaseModel):
    """Pod 안티어피니티 설정"""
    enabled: bool = Field(True, description="Pod 안티어피니티 활성화")
    required_during_scheduling: bool = Field(False, description="스케줄링 시 필수 조건 여부")
    topology_key: str = Field("kubernetes.io/hostname", description="토폴로지 키")


class AffinityConfig(BaseModel):
    """어피니티 설정"""
    node_affinity: NodeAffinityConfig = Field(default_factory=NodeAffinityConfig)
    pod_affinity: PodAffinityConfig = Field(default_factory=PodAffinityConfig)
    pod_anti_affinity: PodAntiAffinityConfig = Field(default_factory=PodAntiAffinityConfig)


class TolerationEffect(str, Enum):
    """톨러레이션 효과"""
    NO_SCHEDULE = "NoSchedule"
    PREFER_NO_SCHEDULE = "PreferNoSchedule"
    NO_EXECUTE = "NoExecute"


class TolerationOperator(str, Enum):
    """톨러레이션 연산자"""
    EQUAL = "Equal"
    EXISTS = "Exists"


class TolerationConfig(BaseModel):
    """톨러레이션 설정"""
    key: str = Field(..., description="톨러레이션 키")
    operator: TolerationOperator = Field(TolerationOperator.EQUAL, description="연산자")
    value: Optional[str] = Field(None, description="값")
    effect: TolerationEffect = Field(..., description="효과")
    toleration_seconds: Optional[int] = Field(None, description="톨러레이션 시간 (초)")


class AdvancedSchedulingConfig(BaseModel):
    """고급 스케줄링 설정"""
    node_selector: Dict[str, str] = Field(default_factory=dict, description="노드 셀렉터")
    affinity: AffinityConfig = Field(default_factory=AffinityConfig)
    tolerations: List[TolerationConfig] = Field(default_factory=list, description="톨러레이션 목록")
    priority_class_name: Optional[str] = Field(None, description="우선순위 클래스 이름")


class KubernetesAdvancedConfig(BaseModel):
    """Kubernetes 고급 설정"""
    auto_scaling: AutoScalingConfig = Field(default_factory=AutoScalingConfig)
    latency_config: LatencyConfig = Field(default_factory=LatencyConfig)
    resource_config: ResourceConfig = Field(default_factory=ResourceConfig)
    scheduling_config: AdvancedSchedulingConfig = Field(default_factory=AdvancedSchedulingConfig)


# [advice from AI] CI/CD 이미지 관리 및 Pod 매칭 시스템 모델 추가
class ImageRegistry(BaseModel):
    """이미지 레지스트리 정보"""
    name: str = Field(..., description="레지스트리 이름")
    url: str = Field(..., description="레지스트리 URL")
    username: Optional[str] = Field(None, description="인증 사용자명")
    password: Optional[str] = Field(None, description="인증 비밀번호")
    is_default: bool = Field(False, description="기본 레지스트리 여부")
    environment: str = Field("production", description="환경 (dev, staging, production)")


class ImageTag(BaseModel):
    """이미지 태그 정보"""
    tag: str = Field(..., description="태그명")
    digest: Optional[str] = Field(None, description="이미지 다이제스트")
    created_at: str = Field(..., description="생성 시간")
    size: Optional[str] = Field(None, description="이미지 크기")
    vulnerabilities: Optional[int] = Field(None, description="보안 취약점 수")
    is_latest: bool = Field(False, description="최신 태그 여부")


class ServiceImage(BaseModel):
    """서비스 이미지 정보"""
    service_name: str = Field(..., description="서비스 이름")
    registry: ImageRegistry = Field(..., description="이미지 레지스트리")
    repository: str = Field(..., description="이미지 리포지토리")
    available_tags: List[ImageTag] = Field(default_factory=list, description="사용 가능한 태그 목록")
    selected_tag: str = Field("latest", description="선택된 태그")
    pull_policy: str = Field("Always", description="이미지 풀 정책")
    build_info: Optional[Dict[str, Any]] = Field(None, description="빌드 정보")


class DeploymentEnvironment(str, Enum):
    """배포 환경"""
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    TEST = "test"


class DeploymentStrategy(str, Enum):
    """배포 전략"""
    ROLLING_UPDATE = "RollingUpdate"
    RECREATE = "Recreate"
    BLUE_GREEN = "BlueGreen"
    CANARY = "Canary"


class NodePlacement(BaseModel):
    """노드 배치 설정"""
    cluster_name: str = Field(..., description="클러스터 이름")
    namespace: str = Field(..., description="네임스페이스")
    zone: Optional[str] = Field(None, description="가용 영역")
    node_selector: Dict[str, str] = Field(default_factory=dict, description="노드 셀렉터")
    preferred_nodes: List[str] = Field(default_factory=list, description="선호 노드 목록")
    anti_affinity_services: List[str] = Field(default_factory=list, description="안티어피니티 서비스 목록")


class PodStatus(BaseModel):
    """Pod 상태 정보"""
    pod_name: str = Field(..., description="Pod 이름")
    status: str = Field(..., description="Pod 상태")
    current_image: str = Field(..., description="현재 실행 중인 이미지")
    ready: bool = Field(..., description="준비 상태")
    restarts: int = Field(0, description="재시작 횟수")
    created_at: str = Field(..., description="생성 시간")
    node_name: Optional[str] = Field(None, description="실행 중인 노드")


class ServiceDeploymentStatus(BaseModel):
    """서비스 배포 상태"""
    service_name: str = Field(..., description="서비스 이름")
    desired_image: str = Field(..., description="배포하려는 이미지")
    current_image: str = Field(..., description="현재 실행 중인 이미지")
    replicas: Dict[str, int] = Field(default_factory=dict, description="레플리카 상태")
    pods: List[PodStatus] = Field(default_factory=list, description="Pod 상태 목록")
    rollout_status: str = Field("unknown", description="롤아웃 상태")
    deployment_strategy: DeploymentStrategy = Field(DeploymentStrategy.ROLLING_UPDATE, description="배포 전략")
    last_updated: str = Field(..., description="마지막 업데이트 시간")


class DeploymentHistory(BaseModel):
    """배포 히스토리"""
    revision: int = Field(..., description="리비전 번호")
    image: str = Field(..., description="배포된 이미지")
    deployed_at: str = Field(..., description="배포 시간")
    deployed_by: str = Field(..., description="배포자")
    status: str = Field(..., description="배포 상태")
    rollback_available: bool = Field(True, description="롤백 가능 여부")
    change_cause: Optional[str] = Field(None, description="변경 사유")


class ImageDeploymentConfig(BaseModel):
    """이미지 배포 설정"""
    service_images: List[ServiceImage] = Field(default_factory=list, description="서비스 이미지 목록")
    environment: DeploymentEnvironment = Field(DeploymentEnvironment.PRODUCTION, description="배포 환경")
    deployment_strategy: DeploymentStrategy = Field(DeploymentStrategy.ROLLING_UPDATE, description="배포 전략")
    node_placement: NodePlacement = Field(..., description="노드 배치 설정")
    auto_rollback: bool = Field(True, description="자동 롤백 활성화")
    health_check_timeout: int = Field(300, description="헬스체크 타임아웃 (초)")
    approval_required: bool = Field(False, description="배포 승인 필요 여부")


class ServiceRequirements(BaseModel):
    """서비스 요구사항"""
    callbot: int = Field(0, ge=0, description="콜봇 채널 수")
    chatbot: int = Field(0, ge=0, description="챗봇 사용자 수")
    advisor: int = Field(0, ge=0, description="어드바이저 상담사 수")
    stt: int = Field(0, ge=0, description="독립 STT 채널 수")
    tts: int = Field(0, ge=0, description="독립 TTS 채널 수")
    ta: int = Field(0, ge=0, description="TA 분석 요청 수")
    qa: int = Field(0, ge=0, description="QA 품질관리 요청 수")


class TenantSpecs(BaseModel):
    """테넌시 사양 (확장됨)"""
    # 기본 정보
    tenant_id: str = Field(..., description="테넌시 ID")
    preset: PresetType = Field(..., description="테넌시 프리셋")
    tenancy_mode: str = Field("large", description="테넌시 모드: 'small' 또는 'large'")  # [advice from AI] 테넌시 모드 추가
    gpu_type: GPUType = Field(..., description="GPU 타입")
    cloud_provider: CloudProvider = Field(CloudProvider.IAAS, description="클라우드 제공업체")  # [advice from AI] 클라우드 제공업체 추가
    
    # 리소스 요구사항
    total_channels: int = Field(..., description="총 채널 수")
    total_users: int = Field(..., description="총 사용자 수")
    
    # 계산된 리소스
    gpu_count: int = Field(..., description="필요한 GPU 개수")
    cpu_cores: int = Field(..., description="필요한 CPU 코어 수")
    memory_gb: int = Field(..., description="필요한 메모리 (GB)")
    storage_gb: int = Field(..., description="필요한 스토리지 (GB)")
    
    # 고급 설정
    environment_variables: List[EnvironmentVariable] = Field(
        default_factory=list, 
        description="환경변수 목록"
    )
    volume_mounts: List[VolumeMount] = Field(
        default_factory=list, 
        description="볼륨 마운트 목록"
    )
    health_checks: Dict[str, HealthCheckConfig] = Field(
        default_factory=dict, 
        description="서비스별 헬스체크 설정"
    )
    network_config: NetworkConfig = Field(
        default_factory=NetworkConfig, 
        description="네트워크 설정"
    )
    
    # 메타데이터
    created_at: Optional[str] = Field(None, description="생성 시간")
    updated_at: Optional[str] = Field(None, description="수정 시간")
    description: Optional[str] = Field(None, description="테넌시 설명")
    
    class Config:
        """Pydantic 설정"""
        use_enum_values = True
        json_encoders = {
            PresetType: lambda v: v.value,
            GPUType: lambda v: v.value
        }


class TenantCreateRequest(BaseModel):
    """테넌시 생성 요청"""
    tenant_id: str = Field(..., description="테넌시 ID")
    service_requirements: ServiceRequirements = Field(..., description="서비스 요구사항")
    tenancy_mode: str = Field("large", description="테넌시 모드: 'small'(소규모, 공용 인프라 제외) 또는 'large'(대규모, 전체 리소스)")  # [advice from AI] 테넌시 모드 필드 추가
    gpu_type: GPUType = Field(GPUType.AUTO, description="GPU 타입")
    cloud_provider: CloudProvider = Field(CloudProvider.IAAS, description="클라우드 제공업체")  # [advice from AI] 클라우드 제공업체 선택 추가
    auto_deploy: bool = Field(True, description="자동 배포 여부")
    
    # 고급 설정 (선택사항)
    environment_variables: Optional[List[EnvironmentVariable]] = Field(None, description="환경변수")
    volume_mounts: Optional[List[VolumeMount]] = Field(None, description="볼륨 마운트")
    health_checks: Optional[Dict[str, HealthCheckConfig]] = Field(None, description="헬스체크 설정")
    network_config: Optional[NetworkConfig] = Field(None, description="네트워크 설정")
    
    # [advice from AI] Kubernetes 고급 설정 추가
    kubernetes_advanced_config: Optional[KubernetesAdvancedConfig] = Field(None, description="Kubernetes 고급 설정")
    
    description: Optional[str] = Field(None, description="테넌시 설명")


class TenantStatusResponse(BaseModel):
    """테넌시 상태 응답"""
    tenant_id: str = Field(..., description="테넌시 ID")
    status: str = Field(..., description="테넌시 상태")
    preset: PresetType = Field(..., description="프리셋 타입")
    specs: TenantSpecs = Field(..., description="테넌시 사양")
    created_at: str = Field(..., description="생성 시간")
    namespace: str = Field(..., description="Kubernetes 네임스페이스")


class TenantMetrics(BaseModel):
    """테넌시 메트릭 정보"""
    tenant_id: str = Field(..., description="테넌시 ID")
    cpu_usage: float = Field(..., description="CPU 사용률 (%)")
    memory_usage: float = Field(..., description="메모리 사용률 (%)")
    gpu_usage: float = Field(..., description="GPU 사용률 (%)")
    network_io: Dict[str, float] = Field(..., description="네트워크 I/O (rx/tx MB/s)")
    active_connections: int = Field(..., description="활성 연결 수")
