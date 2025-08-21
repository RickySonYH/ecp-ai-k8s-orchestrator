-- [advice from AI] ECP-AI Kubernetes Orchestrator 데이터베이스 초기화 스크립트
-- 데이터베이스 및 사용자 생성은 환경변수로 처리되므로 여기서는 테이블 스키마만 정의

-- 테넌시 정보 테이블
CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(100) UNIQUE NOT NULL,
    preset VARCHAR(20) NOT NULL CHECK (preset IN ('micro', 'small', 'medium', 'large')),
    service_requirements JSONB NOT NULL,
    resources JSONB NOT NULL,
    sla_target JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'deploying', 'running', 'failed', 'deleting')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 테넌시 상태 업데이트 트리거
CREATE OR REPLACE FUNCTION update_tenant_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tenant_timestamp
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE PROCEDURE update_tenant_timestamp();

-- 서비스 배포 로그 테이블
CREATE TABLE IF NOT EXISTS deployment_logs (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    service_name VARCHAR(50) NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('create', 'update', 'delete', 'scale')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    details JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

-- 리소스 사용량 메트릭 테이블
CREATE TABLE IF NOT EXISTS resource_metrics (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    service_name VARCHAR(50) NOT NULL,
    metric_type VARCHAR(20) NOT NULL CHECK (metric_type IN ('cpu', 'memory', 'gpu', 'storage', 'network')),
    value DECIMAL(10,2) NOT NULL,
    unit VARCHAR(10) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

-- 시간 기반 파티셔닝을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_resource_metrics_timestamp ON resource_metrics (timestamp);
CREATE INDEX IF NOT EXISTS idx_resource_metrics_tenant_service ON resource_metrics (tenant_id, service_name);

-- SLA 메트릭 테이블
CREATE TABLE IF NOT EXISTS sla_metrics (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    availability DECIMAL(5,2) NOT NULL,
    response_time_ms INTEGER NOT NULL,
    error_rate DECIMAL(5,4) NOT NULL,
    throughput INTEGER NOT NULL,
    measured_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

-- 오토스케일링 이벤트 테이블
CREATE TABLE IF NOT EXISTS scaling_events (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    service_name VARCHAR(50) NOT NULL,
    scale_type VARCHAR(10) NOT NULL CHECK (scale_type IN ('up', 'down')),
    from_replicas INTEGER NOT NULL,
    to_replicas INTEGER NOT NULL,
    trigger_reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

-- 초기 데이터 삽입
INSERT INTO tenants (tenant_id, preset, service_requirements, resources, sla_target, status) 
VALUES (
    'demo-tenant',
    'small',
    '{"callbot": 10, "chatbot": 100, "advisor": 5}',
    '{"cpu_limit": "8000m", "memory_limit": "16Gi", "gpu_limit": 2, "storage": "500Gi"}',
    '{"availability": "99.3%", "response_time": "<300ms"}',
    'running'
) ON CONFLICT (tenant_id) DO NOTHING;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants (status);
CREATE INDEX IF NOT EXISTS idx_tenants_preset ON tenants (preset);
CREATE INDEX IF NOT EXISTS idx_deployment_logs_tenant ON deployment_logs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_sla_metrics_tenant ON sla_metrics (tenant_id);
CREATE INDEX IF NOT EXISTS idx_scaling_events_tenant ON scaling_events (tenant_id);
