-- [advice from AI] Services 테이블 생성 마이그레이션
-- 테넌시별 서비스 정보 저장

CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    service_name VARCHAR(100) NOT NULL, -- 'callbot', 'chatbot', 'advisor', etc.
    service_type VARCHAR(50) NOT NULL, -- 'core', 'optional', 'addon'
    enabled BOOLEAN DEFAULT true,
    count INTEGER DEFAULT 1, -- 서비스 인스턴스 개수
    min_replicas INTEGER DEFAULT 1,
    max_replicas INTEGER DEFAULT 10,
    target_cpu INTEGER DEFAULT 70, -- CPU 사용률 타겟 (%)
    
    -- 이미지 정보
    image_name VARCHAR(200),
    image_tag VARCHAR(50) DEFAULT 'latest',
    image_digest VARCHAR(100),
    registry_url VARCHAR(200),
    
    -- 리소스 요청/제한
    cpu_request VARCHAR(20) DEFAULT '100m',
    memory_request VARCHAR(20) DEFAULT '128Mi',
    gpu_request INTEGER DEFAULT 0,
    
    -- 네트워크 설정
    ports JSONB, -- [{"port": 8080, "protocol": "TCP", "name": "http"}]
    
    -- 환경 설정
    environment_variables JSONB, -- {"KEY": "value"}
    volume_mounts JSONB, -- [{"name": "data", "mountPath": "/data"}]
    
    -- 타임스탬프
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_services_tenant_id 
        FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    CONSTRAINT unique_tenant_service UNIQUE (tenant_id, service_name)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_services_tenant_id ON services(tenant_id);
CREATE INDEX IF NOT EXISTS idx_services_name ON services(service_name);
CREATE INDEX IF NOT EXISTS idx_services_enabled ON services(enabled);
CREATE INDEX IF NOT EXISTS idx_services_type ON services(service_type);

-- 업데이트 트리거
CREATE OR REPLACE FUNCTION update_services_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_services_timestamp ON services;
CREATE TRIGGER update_services_timestamp
    BEFORE UPDATE ON services
    FOR EACH ROW EXECUTE FUNCTION update_services_timestamp();

-- 기본 서비스 데이터 삽입 (데모 테넌트용)
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, image_name, ports) VALUES
    ('demo-small', 'callbot', 'core', true, 2, 'ecp-ai/callbot:latest', '[{"port": 8080, "protocol": "TCP", "name": "http"}]'),
    ('demo-small', 'chatbot', 'core', true, 1, 'ecp-ai/chatbot:latest', '[{"port": 8081, "protocol": "TCP", "name": "http"}]'),
    
    ('demo-medium', 'callbot', 'core', true, 4, 'ecp-ai/callbot:latest', '[{"port": 8080, "protocol": "TCP", "name": "http"}]'),
    ('demo-medium', 'chatbot', 'core', true, 3, 'ecp-ai/chatbot:latest', '[{"port": 8081, "protocol": "TCP", "name": "http"}]'),
    ('demo-medium', 'advisor', 'core', true, 2, 'ecp-ai/advisor:latest', '[{"port": 8082, "protocol": "TCP", "name": "http"}]'),
    
    ('demo-tenant', 'callbot', 'core', true, 1, 'ecp-ai/callbot:latest', '[{"port": 8080, "protocol": "TCP", "name": "http"}]'),
    ('demo-tenant', 'chatbot', 'core', true, 1, 'ecp-ai/chatbot:latest', '[{"port": 8081, "protocol": "TCP", "name": "http"}]'),
    ('demo-tenant', 'advisor', 'core', true, 1, 'ecp-ai/advisor:latest', '[{"port": 8082, "protocol": "TCP", "name": "http"}]')
ON CONFLICT (tenant_id, service_name) DO NOTHING;

SELECT 'Services 테이블 생성 및 데모 데이터 삽입 완료' as migration_status;
