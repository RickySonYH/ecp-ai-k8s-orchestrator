-- [advice from AI] ECP-AI 개발 환경용 초기화
-- 마법사를 통해서만 테넌시 생성하도록 빈 DB로 시작

-- 기본 테이블 구조만 유지하고 데이터는 삽입하지 않음
-- 테넌시는 배포 마법사를 통해서만 생성됩니다.

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
