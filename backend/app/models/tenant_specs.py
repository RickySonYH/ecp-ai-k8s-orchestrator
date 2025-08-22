from typing import Dict, List, Optional, Union
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
    AWS = "aws"
    NCP = "ncp"
    IAAS = "iaas"  # 기본 IaaS 환경


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
    gpu_type: GPUType = Field(GPUType.AUTO, description="GPU 타입")
    cloud_provider: CloudProvider = Field(CloudProvider.IAAS, description="클라우드 제공업체")  # [advice from AI] 클라우드 제공업체 선택 추가
    auto_deploy: bool = Field(True, description="자동 배포 여부")
    
    # 고급 설정 (선택사항)
    environment_variables: Optional[List[EnvironmentVariable]] = Field(None, description="환경변수")
    volume_mounts: Optional[List[VolumeMount]] = Field(None, description="볼륨 마운트")
    health_checks: Optional[Dict[str, HealthCheckConfig]] = Field(None, description="헬스체크 설정")
    network_config: Optional[NetworkConfig] = Field(None, description="네트워크 설정")
    description: Optional[str] = Field(None, description="테넌시 설명")


class TenantStatusResponse(BaseModel):
    """테넌시 상태 응답"""
    tenant_id: str = Field(..., description="테넌시 ID")
    status: str = Field(..., description="테넌시 상태")
    preset: PresetType = Field(..., description="프리셋 타입")
    specs: TenantSpecs = Field(..., description="테넌시 사양")
    created_at: str = Field(..., description="생성 시간")
    namespace: str = Field(..., description="Kubernetes 네임스페이스")
