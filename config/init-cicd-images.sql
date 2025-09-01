-- [advice from AI] CICD 이미지 초기 데이터 등록
-- ECP-AI Kubernetes Orchestrator 기본 서비스 이미지 등록
-- 하드코딩 제거, 실제 이미지 등록 기반으로 서비스 관리

-- CICD 이미지 테이블 생성 (이미 존재하는 경우 무시)
CREATE TABLE IF NOT EXISTS cicd_images (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    image_name VARCHAR(200) NOT NULL,
    image_tag VARCHAR(100) DEFAULT 'latest',
    registry_url VARCHAR(500) NOT NULL,
    repository VARCHAR(500) NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 기존 데이터 삭제 (재시작 시)
DELETE FROM cicd_images;

-- [advice from AI] 메인 서비스 (3개)
INSERT INTO cicd_images (service_name, display_name, image_name, image_tag, registry_url, repository, category, description) VALUES
('callbot', 'Callbot Service (콜봇)', 'ecp-ai/callbot', 'v1.2.3', 'harbor.ecp-ai.com', 'ecp-ai/callbot', 'main', '음성 기반 고객 상담 서비스'),
('chatbot', 'Chatbot Service (챗봇)', 'ecp-ai/chatbot', 'v1.1.8', 'harbor.ecp-ai.com', 'ecp-ai/chatbot', 'main', '텍스트 기반 고객 상담 서비스'),
('advisor', 'AI Advisor Service (어드바이저)', 'ecp-ai/advisor', 'v1.3.1', 'harbor.ecp-ai.com', 'ecp-ai/advisor', 'main', 'AI 기반 상담 어드바이저 서비스');

-- [advice from AI] AI/NLP 서비스 (4개)
INSERT INTO cicd_images (service_name, display_name, image_name, image_tag, registry_url, repository, category, description) VALUES
('stt', 'Speech-to-Text Service (STT)', 'ecp-ai/stt', 'v1.0.5', 'harbor.ecp-ai.com', 'ecp-ai/stt', 'ai_nlp', '음성을 텍스트로 변환하는 서비스'),
('tts', 'Text-to-Speech Service (TTS)', 'ecp-ai/tts', 'v1.0.3', 'harbor.ecp-ai.com', 'ecp-ai/tts', 'ai_nlp', '텍스트를 음성으로 변환하는 서비스'),
('nlp', 'NLP Engine Service (NLP)', 'ecp-ai/nlp', 'v1.4.2', 'harbor.ecp-ai.com', 'ecp-ai/nlp', 'ai_nlp', '자연어 처리 엔진 서비스'),
('aicm', 'AI Conversation Manager (AICM)', 'ecp-ai/aicm', 'v1.2.0', 'harbor.ecp-ai.com', 'ecp-ai/aicm', 'ai_nlp', 'AI 대화 관리 서비스');

-- [advice from AI] 분석 서비스 (2개)
INSERT INTO cicd_images (service_name, display_name, image_name, image_tag, registry_url, repository, category, description) VALUES
('ta', 'TA Statistics Analysis (TA통계분석)', 'ecp-ai/ta', 'v1.1.2', 'harbor.ecp-ai.com', 'ecp-ai/ta', 'analytics', '상담 통계 분석 서비스'),
('qa', 'QA Quality Management (QA품질관리)', 'ecp-ai/qa', 'v1.0.8', 'harbor.ecp-ai.com', 'ecp-ai/qa', 'analytics', '상담 품질 관리 서비스');

-- [advice from AI] 인프라 서비스 (6개)
INSERT INTO cicd_images (service_name, display_name, image_name, image_tag, registry_url, repository, category, description) VALUES
('nginx', 'Nginx Load Balancer (Nginx)', 'ecp-ai/nginx', 'v1.0.2', 'harbor.ecp-ai.com', 'ecp-ai/nginx', 'infrastructure', '로드 밸런서 및 프록시 서버'),
('gateway', 'API Gateway Service (게이트웨이)', 'ecp-ai/gateway', 'v1.1.5', 'harbor.ecp-ai.com', 'ecp-ai/gateway', 'infrastructure', 'API 게이트웨이 서비스'),
('auth', 'Authentication Service (권한관리)', 'ecp-ai/auth', 'v1.0.9', 'harbor.ecp-ai.com', 'ecp-ai/auth', 'infrastructure', '사용자 인증 및 권한 관리 서비스'),
('conversation', 'Conversation History (대화이력)', 'ecp-ai/conversation', 'v1.2.1', 'harbor.ecp-ai.com', 'ecp-ai/conversation', 'infrastructure', '대화 이력 관리 서비스'),
('scenario', 'Scenario Builder (시나리오빌더)', 'ecp-ai/scenario', 'v1.0.7', 'harbor.ecp-ai.com', 'ecp-ai/scenario', 'infrastructure', '상담 시나리오 빌더 서비스'),
('monitoring', 'Monitoring Service (모니터링)', 'ecp-ai/monitoring', 'v1.1.3', 'harbor.ecp-ai.com', 'ecp-ai/monitoring', 'infrastructure', '시스템 모니터링 서비스');

-- [advice from AI] 데이터 서비스 (3개)
INSERT INTO cicd_images (service_name, display_name, image_name, image_tag, registry_url, repository, category, description) VALUES
('postgresql', 'PostgreSQL Database (PostgreSQL)', 'ecp-ai/postgresql', 'v1.0.1', 'harbor.ecp-ai.com', 'ecp-ai/postgresql', 'data', '주 데이터베이스 서비스'),
('vectordb', 'Vector Database (벡터DB)', 'ecp-ai/vectordb', 'v1.0.4', 'harbor.ecp-ai.com', 'ecp-ai/vectordb', 'data', '벡터 데이터베이스 서비스'),
('redis', 'Redis Cache (Redis)', 'ecp-ai/redis', 'v1.0.6', 'harbor.ecp-ai.com', 'ecp-ai/redis', 'data', '캐시 및 세션 관리 서비스');

-- [advice from AI] 특화 서비스 (2개)
INSERT INTO cicd_images (service_name, display_name, image_name, image_tag, registry_url, repository, category, description) VALUES
('livekit', 'LiveKit Real-time (LiveKit)', 'ecp-ai/livekit', 'v1.0.8', 'harbor.ecp-ai.com', 'ecp-ai/livekit', 'specialized', '실시간 통신 서비스'),
('speaker', 'Speaker Separation (화자분리)', 'ecp-ai/speaker', 'v1.0.3', 'harbor.ecp-ai.com', 'ecp-ai/speaker', 'specialized', '화자 분리 및 식별 서비스');

-- [advice from AI] 등록 완료 확인
SELECT 
    category,
    COUNT(*) as service_count,
    STRING_AGG(service_name, ', ' ORDER BY service_name) as services
FROM cicd_images 
GROUP BY category 
ORDER BY category;

-- [advice from AI] 전체 통계
SELECT 
    'Total Services' as metric,
    COUNT(*) as value
FROM cicd_images
UNION ALL
SELECT 
    'Active Services' as metric,
    COUNT(*) as value
FROM cicd_images 
WHERE is_active = true;
