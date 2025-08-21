-- [advice from AI] ECP-AI 개발 환경용 테스트 데이터
-- 개발 및 테스트를 위한 샘플 데이터 삽입

-- 개발용 테넌시 데이터
INSERT INTO tenants (tenant_id, preset, service_requirements, resources, sla_target, status) 
VALUES 
    (
        'demo-small',
        'small',
        '{"callbot": 25, "chatbot": 100, "advisor": 5}',
        '{"cpu_limit": "8000m", "memory_limit": "16Gi", "gpu_limit": 2, "storage": "500Gi", "gpu_type": "t4", "gpu_count": 2, "cpu_cores": 15}',
        '{"availability": "99.3%", "response_time": "<300ms"}',
        'running'
    ),
    (
        'demo-medium',
        'medium',
        '{"callbot": 100, "chatbot": 500, "advisor": 20}',
        '{"cpu_limit": "32000m", "memory_limit": "64Gi", "gpu_limit": 8, "storage": "500Gi", "gpu_type": "v100", "gpu_count": 6, "cpu_cores": 45}',
        '{"availability": "99.5%", "response_time": "<200ms"}',
        'running'
    ),
    (
        'test-micro',
        'micro',
        '{"callbot": 5, "chatbot": 20, "advisor": 2}',
        '{"cpu_limit": "2000m", "memory_limit": "4Gi", "gpu_limit": 1, "storage": "500Gi", "gpu_type": "t4", "gpu_count": 1, "cpu_cores": 8}',
        '{"availability": "99.0%", "response_time": "<500ms"}',
        'pending'
    )
ON CONFLICT (tenant_id) DO NOTHING;

-- 개발용 배포 로그
INSERT INTO deployment_logs (tenant_id, service_name, action, status, details, created_at)
VALUES 
    ('demo-small', 'callbot', 'create', 'completed', '{"replicas": 2, "image": "ecp-ai/callbot:latest"}', NOW() - INTERVAL '1 hour'),
    ('demo-small', 'chatbot', 'create', 'completed', '{"replicas": 3, "image": "ecp-ai/chatbot:latest"}', NOW() - INTERVAL '50 minutes'),
    ('demo-small', 'tts', 'create', 'completed', '{"replicas": 1, "image": "ecp-ai/tts:latest", "gpu": true}', NOW() - INTERVAL '45 minutes'),
    ('demo-medium', 'callbot', 'create', 'completed', '{"replicas": 5, "image": "ecp-ai/callbot:latest"}', NOW() - INTERVAL '2 hours'),
    ('demo-medium', 'advisor', 'create', 'completed', '{"replicas": 4, "image": "ecp-ai/advisor:latest"}', NOW() - INTERVAL '1 hour 30 minutes'),
    ('test-micro', 'callbot', 'create', 'pending', '{"replicas": 1, "image": "ecp-ai/callbot:latest"}', NOW() - INTERVAL '10 minutes')
ON CONFLICT DO NOTHING;

-- 개발용 리소스 메트릭 (최근 24시간)
INSERT INTO resource_metrics (tenant_id, service_name, metric_type, value, unit, timestamp)
SELECT 
    tenant_id,
    service_name,
    metric_type,
    (RANDOM() * range_max + range_min)::DECIMAL(10,2) as value,
    unit,
    NOW() - (INTERVAL '1 minute' * generate_series(0, 1439)) as timestamp
FROM (
    VALUES 
        ('demo-small', 'callbot', 'cpu', 20, 80, '%'),
        ('demo-small', 'callbot', 'memory', 30, 70, '%'),
        ('demo-small', 'chatbot', 'cpu', 15, 60, '%'),
        ('demo-small', 'chatbot', 'memory', 25, 65, '%'),
        ('demo-small', 'tts', 'gpu', 40, 90, '%'),
        ('demo-medium', 'callbot', 'cpu', 30, 85, '%'),
        ('demo-medium', 'callbot', 'memory', 35, 75, '%'),
        ('demo-medium', 'advisor', 'cpu', 25, 70, '%'),
        ('demo-medium', 'advisor', 'memory', 30, 80, '%')
) AS metrics(tenant_id, service_name, metric_type, range_min, range_max, unit)
CROSS JOIN generate_series(0, 23) -- 24시간 샘플링
ON CONFLICT DO NOTHING;

-- 개발용 SLA 메트릭
INSERT INTO sla_metrics (tenant_id, availability, response_time_ms, error_rate, throughput, measured_at)
SELECT 
    tenant_id,
    (95 + RANDOM() * 5)::DECIMAL(5,2) as availability,
    (100 + RANDOM() * 300)::INTEGER as response_time_ms,
    (RANDOM() * 2)::DECIMAL(5,4) as error_rate,
    (800 + RANDOM() * 400)::INTEGER as throughput,
    NOW() - (INTERVAL '5 minutes' * generate_series(0, 287)) as measured_at
FROM (
    VALUES ('demo-small'), ('demo-medium'), ('test-micro')
) AS tenants(tenant_id)
CROSS JOIN generate_series(0, 11) -- 12개 샘플 (1시간)
ON CONFLICT DO NOTHING;

-- 개발용 오토스케일링 이벤트
INSERT INTO scaling_events (tenant_id, service_name, scale_type, from_replicas, to_replicas, trigger_reason, created_at)
VALUES 
    ('demo-small', 'callbot', 'up', 1, 2, 'CPU usage exceeded 70%', NOW() - INTERVAL '3 hours'),
    ('demo-small', 'chatbot', 'up', 2, 3, 'High request rate detected', NOW() - INTERVAL '2 hours'),
    ('demo-medium', 'callbot', 'up', 3, 5, 'Peak hour scaling policy', NOW() - INTERVAL '4 hours'),
    ('demo-medium', 'advisor', 'down', 5, 4, 'Off-peak hour scaling', NOW() - INTERVAL '1 hour')
ON CONFLICT DO NOTHING;

-- 개발용 인덱스 최적화
ANALYZE tenants;
ANALYZE deployment_logs;
ANALYZE resource_metrics;
ANALYZE sla_metrics;
ANALYZE scaling_events;

-- 개발용 뷰 생성 (성능 최적화)
CREATE OR REPLACE VIEW tenant_summary AS
SELECT 
    t.tenant_id,
    t.preset,
    t.status,
    t.service_requirements,
    t.resources,
    COUNT(dl.id) as deployment_count,
    AVG(sm.availability) as avg_availability,
    AVG(sm.response_time_ms) as avg_response_time,
    t.created_at,
    t.updated_at
FROM tenants t
LEFT JOIN deployment_logs dl ON t.tenant_id = dl.tenant_id
LEFT JOIN sla_metrics sm ON t.tenant_id = sm.tenant_id 
    AND sm.measured_at >= NOW() - INTERVAL '1 hour'
GROUP BY t.tenant_id, t.preset, t.status, t.service_requirements, t.resources, t.created_at, t.updated_at;

-- 개발용 함수 생성 (메트릭 집계)
CREATE OR REPLACE FUNCTION get_tenant_metrics(p_tenant_id VARCHAR, p_hours INTEGER DEFAULT 24)
RETURNS TABLE (
    metric_type VARCHAR,
    service_name VARCHAR,
    avg_value DECIMAL,
    max_value DECIMAL,
    min_value DECIMAL,
    sample_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rm.metric_type,
        rm.service_name,
        AVG(rm.value) as avg_value,
        MAX(rm.value) as max_value,
        MIN(rm.value) as min_value,
        COUNT(*) as sample_count
    FROM resource_metrics rm
    WHERE rm.tenant_id = p_tenant_id
        AND rm.timestamp >= NOW() - (p_hours || ' hours')::INTERVAL
    GROUP BY rm.metric_type, rm.service_name
    ORDER BY rm.service_name, rm.metric_type;
END;
$$ LANGUAGE plpgsql;

-- 개발용 권한 설정
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ecp_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ecp_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ecp_user;
