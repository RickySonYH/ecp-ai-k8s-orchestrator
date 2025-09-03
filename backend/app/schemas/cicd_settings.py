# [advice from AI] CICD 설정 Pydantic 스키마 정의
"""
CICD 설정을 위한 Pydantic 스키마 정의
실제 운영 환경에서 사용할 데이터 검증 및 직렬화 스키마
"""

from pydantic import BaseModel, Field, validator
from typing import Dict, Any, List, Optional
from datetime import datetime
from enum import Enum

# 열거형 정의
class RegistryType(str, Enum):
    harbor = "harbor"
    aws_ecr = "aws_ecr"
    docker_hub = "docker_hub"
    azure_acr = "azure_acr"
    gcp_gcr = "gcp_gcr"

class LogLevel(str, Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARN = "WARN"
    ERROR = "ERROR"

class ConnectionStatus(str, Enum):
    connected = "connected"
    disconnected = "disconnected"
    error = "error"

class DeploymentStatus(str, Enum):
    pending = "pending"
    running = "running"
    success = "success"
    failed = "failed"

# 글로벌 설정 스키마
class CICDGlobalSettingsBase(BaseModel):
    setting_key: str = Field(..., max_length=100)
    setting_category: str = Field(..., max_length=50)
    setting_value: Dict[str, Any] = Field(...)
    description: Optional[str] = Field(None)
    is_active: bool = Field(default=True)

    @validator('setting_category')
    def validate_category(cls, v):
        allowed_categories = ['registry', 'security', 'monitoring', 'devtools']
        if v not in allowed_categories:
            raise ValueError(f'Category must be one of {allowed_categories}')
        return v

class CICDGlobalSettingsCreate(CICDGlobalSettingsBase):
    pass

class CICDGlobalSettingsUpdate(BaseModel):
    setting_value: Optional[Dict[str, Any]] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class CICDGlobalSettingsResponse(CICDGlobalSettingsBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# 테넌트 설정 스키마
class CICDTenantSettingsBase(BaseModel):
    tenant_id: str = Field(..., max_length=100)
    setting_key: str = Field(..., max_length=100)
    setting_category: str = Field(..., max_length=50)
    setting_value: Dict[str, Any] = Field(...)
    description: Optional[str] = Field(None)
    is_active: bool = Field(default=True)

    @validator('setting_category')
    def validate_category(cls, v):
        allowed_categories = ['build_deploy', 'permissions']
        if v not in allowed_categories:
            raise ValueError(f'Category must be one of {allowed_categories}')
        return v

class CICDTenantSettingsCreate(CICDTenantSettingsBase):
    pass

class CICDTenantSettingsUpdate(BaseModel):
    setting_value: Optional[Dict[str, Any]] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class CICDTenantSettingsResponse(CICDTenantSettingsBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# 배포 히스토리 스키마
class CICDDeploymentHistoryBase(BaseModel):
    tenant_id: str = Field(..., max_length=100)
    service_name: str = Field(..., max_length=100)
    deployment_type: str = Field(..., max_length=50)
    image_tag: str = Field(..., max_length=200)
    registry_url: str = Field(..., max_length=500)
    deployment_status: DeploymentStatus
    deployment_config: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    requested_by: Optional[str] = Field(None, max_length=100)
    approved_by: Optional[str] = Field(None, max_length=100)
    approved_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    @validator('deployment_type')
    def validate_deployment_type(cls, v):
        allowed_types = ['blue_green', 'rolling', 'canary']
        if v not in allowed_types:
            raise ValueError(f'Deployment type must be one of {allowed_types}')
        return v

    @validator('service_name')
    def validate_service_name(cls, v):
        allowed_services = ['callbot', 'chatbot', 'advisor']
        if v not in allowed_services:
            raise ValueError(f'Service name must be one of {allowed_services}')
        return v

class CICDDeploymentHistoryCreate(CICDDeploymentHistoryBase):
    pass

class CICDDeploymentHistoryResponse(CICDDeploymentHistoryBase):
    id: int
    started_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True

# 레지스트리 설정 전용 스키마
class RegistryConfigSchema(BaseModel):
    url: str = Field(..., min_length=1)
    username: Optional[str] = None
    password: Optional[str] = None
    is_default: bool = Field(default=True)
    ssl_verify: bool = Field(default=True)
    registry_type: RegistryType = Field(default=RegistryType.harbor)
    connection_status: Optional[ConnectionStatus] = Field(default=ConnectionStatus.disconnected)
    last_sync: Optional[datetime] = None

    @validator('url')
    def validate_url(cls, v):
        if not v.startswith(('http://', 'https://')):
            raise ValueError('URL must start with http:// or https://')
        return v

# 보안 정책 설정 스키마
class SecurityPolicyConfigSchema(BaseModel):
    enabled: bool = Field(default=True)
    cve_threshold: float = Field(default=7.0, ge=0.0, le=10.0)
    scan_on_build: bool = Field(default=True)
    block_on_high_cve: bool = Field(default=True)
    malware_scan_enabled: bool = Field(default=True)
    license_check_enabled: bool = Field(default=True)
    image_signing_enabled: bool = Field(default=False)
    cosign_enabled: bool = Field(default=False)
    registry_whitelist_enabled: bool = Field(default=True)
    approved_registries: List[str] = Field(default_factory=list)

# 모니터링 설정 스키마
class SlackNotificationConfig(BaseModel):
    enabled: bool = Field(default=False)
    webhook_url: Optional[str] = None
    channels: List[str] = Field(default_factory=list)

class EmailNotificationConfig(BaseModel):
    enabled: bool = Field(default=False)
    smtp_server: Optional[str] = None
    recipients: List[str] = Field(default_factory=list)

class MetricsCollectionConfig(BaseModel):
    enabled: bool = Field(default=True)
    prometheus_endpoint: Optional[str] = None
    grafana_dashboard: Optional[str] = None

class MonitoringConfigSchema(BaseModel):
    log_collection_enabled: bool = Field(default=True)
    retention_days: int = Field(default=30, ge=1, le=365)
    log_level: LogLevel = Field(default=LogLevel.INFO)
    slack_notifications: SlackNotificationConfig = Field(default_factory=SlackNotificationConfig)
    email_notifications: EmailNotificationConfig = Field(default_factory=EmailNotificationConfig)
    metrics_collection: MetricsCollectionConfig = Field(default_factory=MetricsCollectionConfig)

# 개발도구 설정 스키마
class SonarQubeConfig(BaseModel):
    enabled: bool = Field(default=False)
    server_url: Optional[str] = None
    quality_gate_required: bool = Field(default=True)
    coverage_threshold: int = Field(default=80, ge=0, le=100)

class AutomatedTestingConfig(BaseModel):
    unit_tests_required: bool = Field(default=True)
    integration_tests_required: bool = Field(default=True)
    e2e_tests_required: bool = Field(default=False)
    coverage_threshold: int = Field(default=70, ge=0, le=100)

class CodeAnalysisConfig(BaseModel):
    eslint_enabled: bool = Field(default=True)
    prettier_enabled: bool = Field(default=True)
    security_scan_enabled: bool = Field(default=True)

class DevToolsConfigSchema(BaseModel):
    sonarqube: SonarQubeConfig = Field(default_factory=SonarQubeConfig)
    automated_testing: AutomatedTestingConfig = Field(default_factory=AutomatedTestingConfig)
    code_analysis: CodeAnalysisConfig = Field(default_factory=CodeAnalysisConfig)

# 연결 테스트 응답 스키마
class RegistryConnectionTestResponse(BaseModel):
    success: bool
    message: str
    details: Optional[Dict[str, Any]] = None

# 보안 스캔 응답 스키마
class VulnerabilityInfo(BaseModel):
    cve: str
    severity: str = Field(..., regex="^(LOW|MEDIUM|HIGH|CRITICAL)$")
    description: str
    fixed_version: Optional[str] = None

class SecurityScanResults(BaseModel):
    vulnerabilities: List[VulnerabilityInfo]
    total_vulnerabilities: int
    high_critical_count: int

class SecurityScanResponse(BaseModel):
    success: bool
    scan_results: SecurityScanResults

# 시스템 상태 응답 스키마
class RegistryStatusInfo(BaseModel):
    name: str
    status: ConnectionStatus
    last_check: str

class SecurityScanStatusInfo(BaseModel):
    enabled: bool
    last_scan: str
    scan_queue_size: int

class MonitoringStatusInfo(BaseModel):
    log_collection: bool
    metrics_collection: bool
    alert_status: str = Field(..., regex="^(healthy|warning|error)$")

class DevToolsStatusInfo(BaseModel):
    sonarqube_status: ConnectionStatus
    test_runner_status: str = Field(..., regex="^(idle|running|error)$")

class SystemStatusResponse(BaseModel):
    registries: List[RegistryStatusInfo]
    security_scan: SecurityScanStatusInfo
    monitoring: MonitoringStatusInfo
    devtools: DevToolsStatusInfo

# 설정 백업/복원 스키마
class BackupResponse(BaseModel):
    success: bool
    backup_id: str
    backup_url: Optional[str] = None

class RestoreResponse(BaseModel):
    success: bool
    restored_settings_count: int

# 초기화 응답 스키마
class InitializeDefaultSettingsResponse(BaseModel):
    message: str
    created_count: int

# 검증 응답 스키마
class ValidationResponse(BaseModel):
    valid: bool
    issues: List[str] = Field(default_factory=list)
