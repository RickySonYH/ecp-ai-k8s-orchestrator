-- [advice from AI] v2.0.1 마이그레이션 스크립트
-- v2.0에서 누락된 테이블들과 초기 데이터 생성

-- alerts 테이블 생성
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    alert_id VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL,
    category VARCHAR(50) NOT NULL,
    tenant_id VARCHAR(100),
    service_name VARCHAR(100),
    resource_type VARCHAR(50),
    metric_value FLOAT,
    threshold_value FLOAT,
    status VARCHAR(20) DEFAULT 'active' NOT NULL,
    resolved BOOLEAN DEFAULT FALSE NOT NULL,
    resolved_at TIMESTAMP,
    resolved_by VARCHAR(100),
    source VARCHAR(100),
    tags JSONB,
    alert_metadata JSONB,
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- threshold_settings 테이블 생성
CREATE TABLE IF NOT EXISTS threshold_settings (
    id SERIAL PRIMARY KEY,
    setting_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL DEFAULT 'monitoring',
    thresholds JSONB NOT NULL,
    notifications_enabled BOOLEAN DEFAULT TRUE NOT NULL,
    email_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    sms_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    slack_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    is_default BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_alert_timestamp ON alerts(timestamp);
CREATE INDEX IF NOT EXISTS idx_alert_severity_status ON alerts(severity, status);
CREATE INDEX IF NOT EXISTS idx_alert_tenant ON alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_category ON alerts(category);
CREATE INDEX IF NOT EXISTS idx_threshold_setting_id ON threshold_settings(setting_id);
CREATE INDEX IF NOT EXISTS idx_threshold_category ON threshold_settings(category);

-- 외래키 제약조건 추가 (테넌트 테이블이 있는 경우에만)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants') THEN
        ALTER TABLE alerts ADD CONSTRAINT IF NOT EXISTS fk_alerts_tenant_id 
        FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE SET NULL;
    END IF;
END $$;

-- 기본 임계값 설정 추가
INSERT INTO threshold_settings (setting_id, name, description, category, thresholds, is_default, is_active)
VALUES 
    ('default-system', '기본 시스템 임계값', 'CPU, Memory, GPU 등 기본 시스템 리소스 임계값', 'monitoring', 
     '{"cpu": {"warning": 80, "critical": 95}, "memory": {"warning": 85, "critical": 95}, "gpu": {"warning": 90, "critical": 98}}',
     true, true),
    ('default-sla', '기본 SLA 임계값', '응답시간, 처리량 등 기본 SLA 임계값', 'sla',
     '{"response_time": {"warning": 2000, "critical": 5000}, "throughput": {"warning": 100, "critical": 50}}',
     true, true)
ON CONFLICT (setting_id) DO NOTHING;

-- 완료 메시지
SELECT 'v2.0.1 마이그레이션 완료: alerts, threshold_settings 테이블 및 기본 데이터 생성' AS result;
