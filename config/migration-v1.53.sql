-- [advice from AI] v1.53 데이터베이스 스키마 마이그레이션
-- 테넌시 관련 모든 데이터 저장을 위한 테이블 확장

-- tenants 테이블에 누락된 컬럼들 추가
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS name VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS created_by VARCHAR(100),
ADD COLUMN IF NOT EXISTS cpu_limit VARCHAR(20),
ADD COLUMN IF NOT EXISTS memory_limit VARCHAR(20), 
ADD COLUMN IF NOT EXISTS gpu_limit INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS storage_limit VARCHAR(20),
ADD COLUMN IF NOT EXISTS gpu_type VARCHAR(20),
ADD COLUMN IF NOT EXISTS sla_availability VARCHAR(10),
ADD COLUMN IF NOT EXISTS sla_response_time VARCHAR(20),
ADD COLUMN IF NOT EXISTS manifest_content TEXT,
ADD COLUMN IF NOT EXISTS manifest_generated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deployment_config JSONB,
ADD COLUMN IF NOT EXISTS k8s_namespace VARCHAR(100),
ADD COLUMN IF NOT EXISTS external_endpoints JSONB,
ADD COLUMN IF NOT EXISTS monitoring_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_scaling_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS backup_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS security_policies JSONB,
ADD COLUMN IF NOT EXISTS network_policies JSONB,
ADD COLUMN IF NOT EXISTS resource_quotas JSONB,
ADD COLUMN IF NOT EXISTS environment_variables JSONB,
ADD COLUMN IF NOT EXISTS health_check_config JSONB,
ADD COLUMN IF NOT EXISTS logging_config JSONB,
ADD COLUMN IF NOT EXISTS metrics_config JSONB;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_tenants_name ON tenants(name);
CREATE INDEX IF NOT EXISTS idx_tenants_is_demo ON tenants(is_demo);
CREATE INDEX IF NOT EXISTS idx_tenants_created_by ON tenants(created_by);
CREATE INDEX IF NOT EXISTS idx_tenants_k8s_namespace ON tenants(k8s_namespace);
CREATE INDEX IF NOT EXISTS idx_tenants_created_at ON tenants(created_at);

-- 기존 데이터 업데이트 (dev-data.sql과 일치시키기)
UPDATE tenants SET 
    name = CASE 
        WHEN tenant_id = 'demo-small' THEN '소규모 데모 테넌시'
        WHEN tenant_id = 'demo-medium' THEN '중간 규모 데모 테넌시' 
        WHEN tenant_id = 'demo-tenant' THEN '기본 데모 테넌시'
        ELSE tenant_id
    END,
    is_demo = CASE 
        WHEN tenant_id LIKE 'demo-%' THEN true
        ELSE false
    END,
    k8s_namespace = 'tenant-' || tenant_id,
    created_by = 'system',
    monitoring_enabled = true,
    auto_scaling_enabled = false,
    backup_enabled = false
WHERE name IS NULL;

-- 매니페스트 저장을 위한 별도 테이블 생성 (대용량 매니페스트 지원)
CREATE TABLE IF NOT EXISTS tenant_manifests (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    manifest_type VARCHAR(50) NOT NULL, -- 'deployment', 'service', 'configmap', etc.
    manifest_name VARCHAR(200) NOT NULL,
    manifest_content TEXT NOT NULL,
    manifest_hash VARCHAR(64), -- 중복 체크용
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    
    CONSTRAINT fk_tenant_manifests_tenant_id 
        FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

-- 매니페스트 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_tenant_manifests_tenant_id ON tenant_manifests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_manifests_type ON tenant_manifests(manifest_type);
CREATE INDEX IF NOT EXISTS idx_tenant_manifests_active ON tenant_manifests(is_active);
CREATE INDEX IF NOT EXISTS idx_tenant_manifests_hash ON tenant_manifests(manifest_hash);

-- 배포 상태 추적 테이블 확장
CREATE TABLE IF NOT EXISTS tenant_deployments (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    deployment_id VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'pending', 'deploying', 'deployed', 'failed', 'rolling_back'
    k8s_namespace VARCHAR(100),
    manifest_ids INTEGER[], -- tenant_manifests 테이블의 ID 배열
    deployment_strategy VARCHAR(50) DEFAULT 'rolling_update',
    rollback_enabled BOOLEAN DEFAULT true,
    deployment_config JSONB,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(100),
    
    CONSTRAINT fk_tenant_deployments_tenant_id 
        FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

-- 배포 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_tenant_deployments_tenant_id ON tenant_deployments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_deployments_status ON tenant_deployments(status);
CREATE INDEX IF NOT EXISTS idx_tenant_deployments_started_at ON tenant_deployments(started_at);

-- 테넌시 설정 저장 테이블
CREATE TABLE IF NOT EXISTS tenant_configurations (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    config_type VARCHAR(50) NOT NULL, -- 'cicd', 'monitoring', 'security', 'networking'
    config_key VARCHAR(100) NOT NULL,
    config_value JSONB NOT NULL,
    is_encrypted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    
    CONSTRAINT fk_tenant_configurations_tenant_id 
        FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    CONSTRAINT unique_tenant_config UNIQUE (tenant_id, config_type, config_key)
);

-- 설정 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_tenant_configurations_tenant_id ON tenant_configurations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_configurations_type ON tenant_configurations(config_type);

-- 업데이트 트리거 함수들
CREATE OR REPLACE FUNCTION update_tenant_manifests_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_tenant_configurations_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS update_tenant_manifests_timestamp ON tenant_manifests;
CREATE TRIGGER update_tenant_manifests_timestamp
    BEFORE UPDATE ON tenant_manifests
    FOR EACH ROW EXECUTE FUNCTION update_tenant_manifests_timestamp();

DROP TRIGGER IF EXISTS update_tenant_configurations_timestamp ON tenant_configurations;
CREATE TRIGGER update_tenant_configurations_timestamp
    BEFORE UPDATE ON tenant_configurations
    FOR EACH ROW EXECUTE FUNCTION update_tenant_configurations_timestamp();

-- 완료 메시지
SELECT 'v1.53 데이터베이스 마이그레이션 완료' as migration_status;
