# [advice from AI] ECP-AI Kubernetes Orchestrator - 데이터베이스 모델 및 스키마
"""
ECP-AI 데이터베이스 모델 및 스키마
- 테넌시 정보 관리 (데모/운영 구분)
- 서비스 구성 및 이미지 정보
- 모니터링 데이터 및 메트릭
- 대시보드 설정 자동 생성
"""

from sqlalchemy import (
    create_engine, Column, Integer, String, Boolean, DateTime, 
    Float, Text, JSON, ForeignKey, Index, UniqueConstraint, BigInteger
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from sqlalchemy.sql import func
from datetime import datetime
import os
import logging

# 데이터베이스 연결 설정
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://ecp_user:ecp_password@localhost:5433/ecp_orchestrator"
)

# SQLAlchemy 엔진 및 세션 생성
engine = create_engine(DATABASE_URL, echo=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 베이스 클래스
Base = declarative_base()


class Tenant(Base):
    """테넌시 정보 테이블 (데모/운영 구분)"""
    __tablename__ = "tenants"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(100), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=True)
    preset = Column(String(50), nullable=False)  # micro, small, medium, large
    is_demo = Column(Boolean, default=False, nullable=False)  # 데모/운영 구분
    status = Column(String(50), default="active")  # active, inactive, deleted
    
    # 서비스 요구사항 및 리소스 정보 (JSON 형태로 저장)
    service_requirements = Column(JSON, nullable=False)  # {"callbot": 10, "chatbot": 50, "advisor": 3}
    resources = Column(JSON, nullable=False)  # 계산된 리소스 요구사항
    sla_target = Column(JSON, nullable=False)  # SLA 목표치
    
    # 리소스 제한
    cpu_limit = Column(String(50), nullable=True)
    memory_limit = Column(String(50), nullable=True)
    gpu_limit = Column(Integer, nullable=True)
    storage_limit = Column(String(50), nullable=True)
    gpu_type = Column(String(50), nullable=True)  # t4, v100, l40s
    
    # SLA 정보
    sla_availability = Column(String(20), nullable=True)
    sla_response_time = Column(String(20), nullable=True)
    
    # 매니페스트 및 배포 정보
    manifest_content = Column(Text, nullable=True)
    manifest_generated_at = Column(DateTime(timezone=True), nullable=True)
    deployment_config = Column(JSON, nullable=True)
    k8s_namespace = Column(String(100), nullable=True)
    external_endpoints = Column(JSON, nullable=True)
    
    # 운영 설정
    monitoring_enabled = Column(Boolean, default=True)
    auto_scaling_enabled = Column(Boolean, default=False)
    backup_enabled = Column(Boolean, default=False)
    security_policies = Column(JSON, nullable=True)
    network_policies = Column(JSON, nullable=True)
    resource_quotas = Column(JSON, nullable=True)
    environment_variables = Column(JSON, nullable=True)
    health_check_config = Column(JSON, nullable=True)
    logging_config = Column(JSON, nullable=True)
    metrics_config = Column(JSON, nullable=True)
    
    # 메타데이터
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    
    # 관계
    services = relationship("Service", back_populates="tenant", cascade="all, delete-orphan")
    monitoring_data = relationship("MonitoringData", back_populates="tenant", cascade="all, delete-orphan")
    dashboard_configs = relationship("DashboardConfig", back_populates="tenant", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('idx_tenant_demo_status', 'is_demo', 'status'),
        Index('idx_tenant_preset', 'preset'),
    )


class Service(Base):
    """서비스 구성 정보 테이블"""
    __tablename__ = "services"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(100), ForeignKey("tenants.tenant_id"), nullable=False)
    service_name = Column(String(100), nullable=False)  # callbot, chatbot, advisor
    service_type = Column(String(50), nullable=False)  # ai_service, infrastructure
    
    # 서비스 설정
    enabled = Column(Boolean, default=True)
    count = Column(Integer, default=1)
    min_replicas = Column(Integer, default=1)
    max_replicas = Column(Integer, default=10)
    target_cpu = Column(Integer, default=60)
    
    # 컨테이너 이미지 정보
    image_name = Column(String(200), nullable=False)
    image_tag = Column(String(100), nullable=False)
    image_digest = Column(String(100), nullable=True)
    registry_url = Column(String(500), nullable=True)
    
    # 리소스 요구사항
    cpu_request = Column(String(50), nullable=True)
    memory_request = Column(String(50), nullable=True)
    gpu_request = Column(Integer, default=0)
    
    # 포트 및 환경변수
    ports = Column(JSON, nullable=True)
    environment_variables = Column(JSON, nullable=True)
    volume_mounts = Column(JSON, nullable=True)
    
    # 메타데이터
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 관계
    tenant = relationship("Tenant", back_populates="services")
    
    __table_args__ = (
        Index('idx_service_tenant', 'tenant_id'),
        Index('idx_service_type', 'service_type'),
        UniqueConstraint('tenant_id', 'service_name', name='uq_tenant_service'),
    )


class MonitoringData(Base):
    """모니터링 데이터 테이블 (데모/실제 구분)"""
    __tablename__ = "monitoring_data"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(100), ForeignKey("tenants.tenant_id"), nullable=False)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=True)
    
    # 메트릭 타입 구분
    metric_type = Column(String(50), nullable=False)  # cpu, memory, gpu, storage, network
    metric_name = Column(String(100), nullable=False)  # usage, limit, request
    metric_value = Column(Float, nullable=False)
    metric_unit = Column(String(20), nullable=False)  # %, MB, GB, cores
    
    # 데이터 소스 구분
    is_demo_data = Column(Boolean, default=False, nullable=False)  # 데모/실제 구분
    data_source = Column(String(100), nullable=True)  # prometheus, custom, simulated
    
    # 시간 정보
    timestamp = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 관계
    tenant = relationship("Tenant", back_populates="monitoring_data")
    service = relationship("Service")
    
    __table_args__ = (
        Index('idx_monitoring_tenant_timestamp', 'tenant_id', 'timestamp'),
        Index('idx_monitoring_demo', 'is_demo_data'),
        Index('idx_monitoring_metric', 'metric_type', 'metric_name'),
    )


class Alert(Base):
    """알림/알람 데이터 테이블"""
    __tablename__ = "alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(String(100), unique=True, index=True, nullable=False)  # 고유 알림 ID
    
    # 알림 기본 정보
    title = Column(String(500), nullable=False)  # 알림 제목
    message = Column(Text, nullable=False)  # 알림 메시지
    severity = Column(String(20), nullable=False)  # critical, warning, info
    category = Column(String(50), nullable=False)  # system, tenant, resource, sla
    
    # 관련 정보
    tenant_id = Column(String(100), ForeignKey("tenants.tenant_id"), nullable=True)  # 관련 테넌트
    service_name = Column(String(100), nullable=True)  # 관련 서비스
    resource_type = Column(String(50), nullable=True)  # cpu, memory, gpu, network
    metric_value = Column(Float, nullable=True)  # 관련 메트릭 값
    threshold_value = Column(Float, nullable=True)  # 임계값
    
    # 상태 정보
    status = Column(String(20), default="active", nullable=False)  # active, resolved, acknowledged
    resolved = Column(Boolean, default=False, nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(String(100), nullable=True)
    
    # 메타데이터
    source = Column(String(100), nullable=True)  # k8s-simulator, prometheus, manual
    tags = Column(JSON, nullable=True)  # 추가 태그 정보
    alert_metadata = Column(JSON, nullable=True)  # 추가 메타데이터 (metadata는 SQLAlchemy 예약어)
    
    # 시간 정보
    timestamp = Column(DateTime(timezone=True), nullable=False)  # 알림 발생 시간
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
        # 관계
    tenant = relationship("Tenant", backref="alerts")

    __table_args__ = (
        Index('idx_alert_timestamp', 'timestamp'),
        Index('idx_alert_severity_status', 'severity', 'status'),
        Index('idx_alert_tenant', 'tenant_id'),
        Index('idx_alert_category', 'category'),
    )


class ThresholdSettings(Base):
    """임계값 설정 테이블"""
    __tablename__ = "threshold_settings"

    id = Column(Integer, primary_key=True, index=True)
    setting_id = Column(String(100), unique=True, index=True, nullable=False)  # 설정 고유 ID
    
    # 설정 기본 정보
    name = Column(String(200), nullable=False)  # 설정 이름
    description = Column(Text, nullable=True)  # 설정 설명
    category = Column(String(50), nullable=False, default="monitoring")  # monitoring, alerting, system
    
    # 임계값 데이터 (JSON으로 저장)
    thresholds = Column(JSON, nullable=False)  # CPU, Memory, GPU, Response Time 등의 임계값
    
    # 알림 설정
    notifications_enabled = Column(Boolean, default=True, nullable=False)  # 실시간 알림 활성화
    email_enabled = Column(Boolean, default=False, nullable=False)  # 이메일 알림
    sms_enabled = Column(Boolean, default=False, nullable=False)  # SMS 알림
    slack_enabled = Column(Boolean, default=False, nullable=False)  # Slack 알림
    
    # 사용자 정보
    created_by = Column(String(100), nullable=True)  # 설정 생성자
    updated_by = Column(String(100), nullable=True)  # 설정 수정자
    
    # 상태 정보
    is_active = Column(Boolean, default=True, nullable=False)  # 설정 활성화 상태
    is_default = Column(Boolean, default=False, nullable=False)  # 기본 설정 여부
    
    # 시간 정보
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        Index('idx_threshold_category', 'category'),
        Index('idx_threshold_active', 'is_active'),
        Index('idx_threshold_default', 'is_default'),
    )


class DashboardConfig(Base):
    """대시보드 설정 테이블 (테넌시별 자동 생성)"""
    __tablename__ = "dashboard_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(100), ForeignKey("tenants.tenant_id"), nullable=False)
    
    # 대시보드 기본 정보
    dashboard_name = Column(String(200), nullable=False)
    dashboard_type = Column(String(50), nullable=False)  # overview, service, resource, custom
    
    # 대시보드 설정
    layout_config = Column(JSON, nullable=True)  # 위젯 배치 정보
    widget_configs = Column(JSON, nullable=True)  # 위젯별 설정
    refresh_interval = Column(Integer, default=30)  # 초 단위
    
    # 접근 권한
    is_public = Column(Boolean, default=False)
    allowed_users = Column(JSON, nullable=True)  # 접근 가능한 사용자 목록
    
    # 메타데이터
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String(100), nullable=True)
    
    # 관계
    tenant = relationship("Tenant", back_populates="dashboard_configs")
    
    __table_args__ = (
        Index('idx_dashboard_tenant', 'tenant_id'),
        Index('idx_dashboard_type', 'dashboard_type'),
    )


class ImageRegistry(Base):
    """이미지 레지스트리 정보 테이블"""
    __tablename__ = "image_registry"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # 이미지 정보
    image_name = Column(String(200), nullable=False)
    image_tag = Column(String(100), nullable=False)
    image_digest = Column(String(100), nullable=True)
    registry_url = Column(String(500), nullable=True)
    
    # 이미지 메타데이터
    architecture = Column(String(50), nullable=True)  # amd64, arm64
    os_type = Column(String(50), nullable=True)  # linux, windows
    size_bytes = Column(BigInteger, nullable=True)
    
    # 보안 정보
    vulnerability_count = Column(Integer, default=0)
    last_scan_date = Column(DateTime(timezone=True), nullable=True)
    
    # 상태 정보
    is_active = Column(Boolean, default=True)
    is_deprecated = Column(Boolean, default=False)
    
    # 메타데이터
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    __table_args__ = (
        Index('idx_image_name_tag', 'image_name', 'image_tag'),
        Index('idx_image_registry', 'registry_url'),
        UniqueConstraint('image_name', 'image_tag', 'registry_url', name='uq_image_unique'),
    )


class DeploymentStatus(Base):
    """배포 상태 추적 테이블"""
    __tablename__ = "deployment_status"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    
    # 배포 정보
    namespace = Column(String(100), nullable=False)
    deployment_name = Column(String(200), nullable=False)
    service_type = Column(String(100), nullable=False)
    
    # Kubernetes 상태
    replicas = Column(Integer, default=0)
    available_replicas = Column(Integer, default=0)
    ready_replicas = Column(Integer, default=0)
    updated_replicas = Column(Integer, default=0)
    
    # 배포 상태
    status = Column(String(50), default="pending")  # pending, running, failed, completed
    phase = Column(String(50), nullable=True)  # Pending, Running, Succeeded, Failed
    
    # 메타데이터
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 관계
    tenant = relationship("Tenant")
    
    __table_args__ = (
        Index('idx_deployment_tenant', 'tenant_id'),
        Index('idx_deployment_status', 'status'),
        Index('idx_deployment_namespace', 'namespace'),
    )


# [advice from AI] CICD 이미지 관리 테이블 추가
class CICDImage(Base):
    """CICD 이미지 관리 테이블"""
    __tablename__ = "cicd_images"

    id = Column(Integer, primary_key=True, index=True)
    service_name = Column(String(100), unique=True, index=True, nullable=False)
    display_name = Column(String(200), nullable=False)
    image_name = Column(String(200), nullable=False)
    image_tag = Column(String(100), default="latest")
    registry_url = Column(String(500), nullable=False)
    repository = Column(String(500), nullable=False)
    category = Column(String(50), nullable=False)  # main, ai_nlp, analytics, infrastructure, data, specialized
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<CICDImage(service_name='{self.service_name}', category='{self.category}')>"


# 데이터베이스 테이블 생성 함수
def create_tables():
    """데이터베이스 테이블 생성"""
    Base.metadata.create_all(bind=engine)


# 데이터베이스 세션 의존성
def get_db():
    """데이터베이스 세션 의존성"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# 초기 데이터 시드 함수
def seed_initial_data():
    """초기 데이터 시드"""
    db = SessionLocal()
    try:
        # 데모 테넌시 생성
        demo_tenant = Tenant(
            tenant_id="demo-tenant",
            name="데모 테넌시",
            preset="small",
            is_demo=True,
            status="active",
            cpu_limit="8000m",
            memory_limit="16Gi",
            gpu_limit=3,
            storage_limit="1.0TB",
            gpu_type="t4",
            sla_availability="99.3%",
            sla_response_time="<300ms",
            description="ECP-AI 데모용 테넌시"
        )
        
        db.add(demo_tenant)
        db.commit()
        
        # 데모 서비스 생성
        demo_services = [
            Service(
                tenant_id=demo_tenant.id,
                service_name="callbot",
                service_type="ai_service",
                enabled=True,
                count=10,
                min_replicas=2,
                max_replicas=8,
                target_cpu=60,
                image_name="ecp-ai/callbot",
                image_tag="latest",
                cpu_request="100m",
                memory_request="256Mi"
            ),
            Service(
                tenant_id=demo_tenant.id,
                service_name="chatbot",
                service_type="ai_service",
                enabled=True,
                count=50,
                min_replicas=2,
                max_replicas=8,
                target_cpu=60,
                image_name="ecp-ai/chatbot",
                image_tag="latest",
                cpu_request="50m",
                memory_request="128Mi"
            ),
            Service(
                tenant_id=demo_tenant.id,
                service_name="advisor",
                service_type="ai_service",
                enabled=True,
                count=5,
                min_replicas=2,
                max_replicas=8,
                target_cpu=60,
                image_name="ecp-ai/advisor",
                image_tag="latest",
                cpu_request="200m",
                memory_request="512Mi"
            )
        ]
        
        for service in demo_services:
            db.add(service)
        
        db.commit()
        
        # 데모 모니터링 데이터 생성
        demo_monitoring_data = []
        for i in range(24):  # 24시간 데이터
            timestamp = datetime.utcnow().replace(hour=i, minute=0, second=0, microsecond=0)
            
            # CPU 사용률 (가상 데이터)
            demo_monitoring_data.append(MonitoringData(
                tenant_id=demo_tenant.id,
                metric_type="cpu",
                metric_name="usage",
                metric_value=30.0 + (i * 2) % 40,  # 30-70% 사이 변동
                metric_unit="%",
                is_demo_data=True,
                data_source="simulated",
                timestamp=timestamp
            ))
            
            # 메모리 사용률 (가상 데이터)
            demo_monitoring_data.append(MonitoringData(
                tenant_id=demo_tenant.id,
                metric_type="memory",
                metric_name="usage",
                metric_value=45.0 + (i * 3) % 30,  # 45-75% 사이 변동
                metric_unit="%",
                is_demo_data=True,
                data_source="simulated",
                timestamp=timestamp
            ))
            
            # GPU 사용률 (가상 데이터)
            demo_monitoring_data.append(MonitoringData(
                tenant_id=demo_tenant.id,
                metric_type="gpu",
                metric_name="usage",
                metric_value=60.0 + (i * 4) % 35,  # 60-95% 사이 변동
                metric_unit="%",
                is_demo_data=True,
                data_source="simulated",
                timestamp=timestamp
            ))
        
        for data in demo_monitoring_data:
            db.add(data)
        
        db.commit()
        
        # 데모 대시보드 설정 생성
        demo_dashboard = DashboardConfig(
            tenant_id=demo_tenant.id,
            dashboard_name="데모 테넌시 대시보드",
            dashboard_type="overview",
            layout_config={
                "widgets": [
                    {"id": "cpu_usage", "type": "line_chart", "position": {"x": 0, "y": 0, "w": 6, "h": 4}},
                    {"id": "memory_usage", "type": "line_chart", "position": {"x": 6, "y": 0, "w": 6, "h": 4}},
                    {"id": "gpu_usage", "type": "line_chart", "position": {"x": 0, "y": 4, "w": 6, "h": 4}},
                    {"id": "service_status", "type": "status_grid", "position": {"x": 6, "y": 4, "w": 6, "h": 4}}
                ]
            },
            widget_configs={
                "cpu_usage": {"title": "CPU 사용률", "metric": "cpu_usage", "refresh_interval": 30},
                "memory_usage": {"title": "메모리 사용률", "metric": "memory_usage", "refresh_interval": 30},
                "gpu_usage": {"title": "GPU 사용률", "metric": "gpu_usage", "refresh_interval": 30},
                "service_status": {"title": "서비스 상태", "services": ["callbot", "chatbot", "advisor"]}
            },
            refresh_interval=30,
            is_public=True
        )
        
        db.add(demo_dashboard)
        db.commit()
        
        logging.info("초기 데이터 시드 완료")
        
    except Exception as e:
        logging.error(f"초기 데이터 시드 실패: {e}")
        db.rollback()
    finally:
        db.close()


# [advice from AI] CICD 설정 관리를 위한 테이블들
class CICDGlobalSettings(Base):
    """CICD 글로벌 설정 테이블"""
    __tablename__ = "cicd_global_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    setting_key = Column(String(100), unique=True, nullable=False)
    setting_category = Column(String(50), nullable=False)  # registry, security, monitoring, devtools
    setting_value = Column(JSON, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    
    # 시간 정보
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # 인덱스
    __table_args__ = (
        Index('idx_cicd_global_category', 'setting_category'),
        Index('idx_cicd_global_active', 'is_active'),
    )


class CICDTenantSettings(Base):
    """CICD 테넌트별 설정 테이블"""
    __tablename__ = "cicd_tenant_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(100), ForeignKey("tenants.tenant_id"), nullable=False)
    setting_key = Column(String(100), nullable=False)
    setting_category = Column(String(50), nullable=False)  # build_deploy, permissions
    setting_value = Column(JSON, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    
    # 시간 정보
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # 관계 설정
    tenant = relationship("Tenant")
    
    # 인덱스
    __table_args__ = (
        Index('idx_cicd_tenant_tenant_id', 'tenant_id'),
        Index('idx_cicd_tenant_category', 'setting_category'),
        UniqueConstraint('tenant_id', 'setting_key', name='uq_tenant_setting_key'),
    )


class CICDDeploymentHistory(Base):
    """CICD 배포 히스토리 테이블"""
    __tablename__ = "cicd_deployment_history"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(100), ForeignKey("tenants.tenant_id"), nullable=False)
    service_name = Column(String(100), nullable=False)  # callbot, chatbot, advisor
    deployment_type = Column(String(50), nullable=False)  # blue_green, rolling, canary
    
    # 배포 정보
    image_tag = Column(String(200), nullable=False)
    registry_url = Column(String(500), nullable=False)
    deployment_status = Column(String(50), nullable=False)  # pending, running, success, failed
    
    # 배포 세부 정보
    deployment_config = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    
    # 승인 정보
    requested_by = Column(String(100), nullable=True)
    approved_by = Column(String(100), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    
    # 시간 정보
    started_at = Column(DateTime, default=func.now())
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=func.now())
    
    # 관계 설정
    tenant = relationship("Tenant")
    
    # 인덱스
    __table_args__ = (
        Index('idx_cicd_deploy_tenant_id', 'tenant_id'),
        Index('idx_cicd_deploy_status', 'deployment_status'),
        Index('idx_cicd_deploy_service', 'service_name'),
        Index('idx_cicd_deploy_created_at', 'created_at'),
    )


if __name__ == "__main__":
    create_tables()
    seed_initial_data()
