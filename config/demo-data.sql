-- [advice from AI] 데모 데이터베이스 초기화 SQL - 20개 완전한 데모 테넌트
-- ECP-AI Kubernetes Orchestrator 데모 모드 전용 데이터

-- 데모 테넌트 데이터 삽입 (20개)
INSERT INTO tenants (
    tenant_id, name, preset, is_demo, status, cpu_limit, memory_limit, 
    gpu_limit, storage_limit, gpu_type, sla_availability, sla_response_time, 
    description, created_at
) VALUES
-- 메인 서비스 테넌시
('demo-tenant-1', '글로벌 콜센터', 'large', true, 'running', '45000m', '64Gi', 
 6, '2.0TB', 'v100', '99.86%', '265ms', 
 '글로벌 콜센터 AI 서비스 - 콜봇, 챗봇, 어드바이저 통합', '2024-01-15 10:30:00'),

('demo-tenant-2', '스마트 상담봇', 'medium', true, 'running', '24000m', '32Gi', 
 3, '1.0TB', 't4', '99.18%', '154ms', 
 '스마트 상담봇 AI 서비스 - 텍스트 기반 대화', '2024-01-14 15:20:00'),

('demo-tenant-3', 'AI 어드바이저', 'medium', true, 'running', '28000m', '36Gi', 
 4, '1.5TB', 'l40s', '99.78%', '194ms', 
 'AI 어드바이저 서비스 - 상담사 지원 시스템', '2024-01-13 09:15:00'),

-- AI/NLP 서비스 테넌시  
('demo-tenant-4', '음성 분석 서비스', 'small', true, 'running', '16000m', '20Gi', 
 2, '800Gi', 't4', '99.80%', '74ms', 
 '음성 분석 AI 서비스 - STT, TTS, NLP 통합', '2024-01-12 14:45:00'),

('demo-tenant-5', 'TTS 음성합성', 'small', true, 'running', '18000m', '22Gi', 
 2, '600Gi', 't4', '99.92%', '45ms', 
 'TTS 음성합성 서비스 - 다국어 음성 생성', '2024-01-11 11:20:00'),

('demo-tenant-6', 'NLP 엔진', 'medium', true, 'running', '26000m', '30Gi', 
 3, '1.2TB', 'v100', '99.65%', '89ms', 
 'NLP 엔진 서비스 - 자연어 처리 및 이해', '2024-01-10 16:30:00'),

('demo-tenant-7', 'AI 대화 관리', 'large', true, 'running', '38000m', '48Gi', 
 5, '2.5TB', 'l40s', '99.91%', '123ms', 
 'AI 대화 관리 시스템 - AICM, 시나리오, 모니터링', '2024-01-09 13:15:00'),

-- 분석 서비스 테넌시
('demo-tenant-8', 'TA 통계분석', 'medium', true, 'running', '22000m', '28Gi', 
 3, '1.8TB', 'v100', '99.45%', '167ms', 
 'TA 통계분석 서비스 - 텍스트 분석 및 인사이트', '2024-01-08 10:45:00'),

('demo-tenant-9', 'QA 품질관리', 'small', true, 'running', '16000m', '20Gi', 
 2, '500Gi', 't4', '99.88%', '56ms', 
 'QA 품질관리 서비스 - 대화 품질 평가', '2024-01-07 14:20:00'),

-- 인프라 서비스 테넌시
('demo-tenant-10', '웹 서버 클러스터', 'large', true, 'running', '32000m', '40Gi', 
 4, '1.0TB', 'v100', '99.97%', '23ms', 
 '웹 서버 클러스터 - Nginx, 게이트웨이, 모니터링', '2024-01-06 09:30:00'),

('demo-tenant-11', 'API 게이트웨이', 'medium', true, 'running', '24000m', '28Gi', 
 3, '800Gi', 't4', '99.83%', '34ms', 
 'API 게이트웨이 서비스 - 인증, 라우팅, 모니터링', '2024-01-05 11:45:00'),

('demo-tenant-12', '권한 관리 시스템', 'medium', true, 'running', '20000m', '24Gi', 
 2, '600Gi', 't4', '99.76%', '67ms', 
 '권한 관리 시스템 - 인증, 인가, 사용자 관리', '2024-01-04 15:10:00'),

('demo-tenant-13', '대화 이력 저장소', 'large', true, 'running', '36000m', '44Gi', 
 4, '5.0TB', 'l40s', '99.54%', '145ms', 
 '대화 이력 저장소 - PostgreSQL, 벡터DB, Redis', '2024-01-03 12:25:00'),

('demo-tenant-14', '시나리오 빌더', 'medium', true, 'running', '26000m', '30Gi', 
 3, '1.5TB', 'v100', '99.69%', '98ms', 
 '시나리오 빌더 서비스 - 대화 시나리오 생성 및 관리', '2024-01-02 16:40:00'),

('demo-tenant-15', '시스템 모니터링', 'medium', true, 'running', '20000m', '24Gi', 
 2, '2.0TB', 't4', '99.95%', '12ms', 
 '시스템 모니터링 - Prometheus, Grafana, 알림', '2024-01-01 08:15:00'),

-- 데이터 서비스 테넌시
('demo-tenant-16', '데이터베이스 클러스터', 'large', true, 'running', '28000m', '36Gi', 
 3, '10.0TB', 'v100', '99.89%', '78ms', 
 '데이터베이스 클러스터 - PostgreSQL, 벡터DB, Redis, 모니터링', '2023-12-31 20:30:00'),

('demo-tenant-17', '벡터 데이터베이스', 'medium', true, 'running', '24000m', '28Gi', 
 3, '3.0TB', 'l40s', '99.72%', '134ms', 
 '벡터 데이터베이스 서비스 - 임베딩 저장 및 검색', '2023-12-30 14:20:00'),

('demo-tenant-18', '캐시 시스템', 'medium', true, 'running', '18000m', '22Gi', 
 2, '1.0TB', 't4', '99.93%', '8ms', 
 '캐시 시스템 - Redis 클러스터 및 모니터링', '2023-12-29 10:45:00'),

-- 특화 서비스 테넌시
('demo-tenant-19', '실시간 통신', 'medium', true, 'running', '24000m', '28Gi', 
 3, '800Gi', 'v100', '99.81%', '67ms', 
 '실시간 통신 서비스 - LiveKit 기반 화상/음성 통신', '2023-12-28 17:15:00'),

('demo-tenant-20', '화자 분리 시스템', 'small', true, 'running', '16000m', '20Gi', 
 2, '500Gi', 't4', '99.67%', '156ms', 
 '화자 분리 시스템 - 다중 화자 음성 분리 및 인식', '2023-12-27 13:50:00');

-- 각 테넌트별 서비스 데이터 삽입
-- demo-tenant-1 (글로벌 콜센터) 서비스
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'callbot', 'ai_service', true, 25, 2, 8, 60, 'ecp-ai/callbot', 'latest', '200m', '512Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-1';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'chatbot', 'ai_service', true, 85, 3, 10, 70, 'ecp-ai/chatbot', 'latest', '150m', '256Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-1';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'advisor', 'ai_service', true, 32, 2, 6, 65, 'ecp-ai/advisor', 'latest', '300m', '512Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-1';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'gateway', 'infra_service', true, 14, 2, 4, 50, 'ecp-ai/gateway', 'latest', '100m', '128Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-1';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'monitoring', 'infra_service', true, 20, 1, 3, 40, 'ecp-ai/monitoring', 'latest', '50m', '64Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-1';

-- demo-tenant-2 (스마트 상담봇) 서비스
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'chatbot', 'ai_service', true, 85, 3, 10, 70, 'ecp-ai/chatbot', 'latest', '150m', '256Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-2';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'advisor', 'ai_service', true, 32, 2, 6, 65, 'ecp-ai/advisor', 'latest', '300m', '512Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-2';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'nlp', 'ai_service', true, 28, 2, 8, 80, 'ecp-ai/nlp', 'latest', '400m', '1Gi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-2';

-- demo-tenant-3 (AI 어드바이저) 서비스
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'advisor', 'ai_service', true, 32, 2, 6, 65, 'ecp-ai/advisor', 'latest', '300m', '512Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-3';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'nlp', 'ai_service', true, 28, 2, 8, 80, 'ecp-ai/nlp', 'latest', '400m', '1Gi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-3';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'aicm', 'ai_service', true, 22, 2, 6, 75, 'ecp-ai/aicm', 'latest', '350m', '768Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-3';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'scenario-builder', 'ai_service', true, 12, 1, 4, 60, 'ecp-ai/scenario-builder', 'latest', '200m', '256Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-3';

-- demo-tenant-4 (음성 분석 서비스) 서비스
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'stt', 'ai_service', true, 18, 2, 6, 85, 'ecp-ai/stt', 'latest', '500m', '1Gi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-4';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'tts', 'ai_service', true, 16, 2, 6, 70, 'ecp-ai/tts', 'latest', '300m', '512Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-4';

-- demo-tenant-5 (TTS 음성합성) 서비스
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'tts', 'ai_service', true, 16, 2, 6, 70, 'ecp-ai/tts', 'latest', '300m', '512Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-5';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'nlp', 'ai_service', true, 28, 2, 8, 80, 'ecp-ai/nlp', 'latest', '400m', '1Gi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-5';

-- 나머지 테넌트들도 비슷하게 서비스 추가 (간략화)
-- demo-tenant-6 (NLP 엔진)
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'nlp', 'ai_service', true, 28, 2, 8, 80, 'ecp-ai/nlp', 'latest', '400m', '1Gi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-6';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'aicm', 'ai_service', true, 22, 2, 6, 75, 'ecp-ai/aicm', 'latest', '350m', '768Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-6';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'qa', 'ai_service', true, 12, 1, 4, 55, 'ecp-ai/qa', 'latest', '150m', '256Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-6';

-- demo-tenant-7 (AI 대화 관리)
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'aicm', 'ai_service', true, 22, 2, 6, 75, 'ecp-ai/aicm', 'latest', '350m', '768Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-7';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'nlp', 'ai_service', true, 28, 2, 8, 80, 'ecp-ai/nlp', 'latest', '400m', '1Gi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-7';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'history', 'data_service', true, 18, 1, 4, 45, 'ecp-ai/history', 'latest', '100m', '128Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-7';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'scenario-builder', 'ai_service', true, 12, 1, 4, 60, 'ecp-ai/scenario-builder', 'latest', '200m', '256Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-7';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'monitoring', 'infra_service', true, 20, 1, 3, 40, 'ecp-ai/monitoring', 'latest', '50m', '64Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-7';

-- 나머지 테넌트들의 기본 서비스들 (간략화된 버전)
-- demo-tenant-8 (TA 통계분석)
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'ta', 'ai_service', true, 15, 2, 6, 70, 'ecp-ai/ta', 'latest', '300m', '512Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-8';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'postgresql', 'data_service', true, 16, 1, 3, 50, 'postgres', '15', '200m', '256Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-8';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'monitoring', 'infra_service', true, 20, 1, 3, 40, 'ecp-ai/monitoring', 'latest', '50m', '64Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-8';

-- demo-tenant-9 (QA 품질관리)
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'qa', 'ai_service', true, 12, 1, 4, 55, 'ecp-ai/qa', 'latest', '150m', '256Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-9';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'postgresql', 'data_service', true, 16, 1, 3, 50, 'postgres', '15', '200m', '256Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-9';

-- 인프라 서비스 테넌트들 (demo-tenant-10 ~ demo-tenant-15)
-- demo-tenant-10 (웹 서버 클러스터)
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'nginx', 'infra_service', true, 8, 2, 6, 30, 'nginx', 'alpine', '50m', '32Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-10';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'gateway', 'infra_service', true, 14, 2, 4, 50, 'ecp-ai/gateway', 'latest', '100m', '128Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-10';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'monitoring', 'infra_service', true, 20, 1, 3, 40, 'ecp-ai/monitoring', 'latest', '50m', '64Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-10';

-- demo-tenant-11 (API 게이트웨이)
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'gateway', 'infra_service', true, 14, 2, 4, 50, 'ecp-ai/gateway', 'latest', '100m', '128Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-11';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'auth', 'infra_service', true, 10, 2, 4, 45, 'ecp-ai/auth', 'latest', '75m', '96Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-11';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'monitoring', 'infra_service', true, 20, 1, 3, 40, 'ecp-ai/monitoring', 'latest', '50m', '64Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-11';

-- demo-tenant-12 (권한 관리 시스템)
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'auth', 'infra_service', true, 10, 2, 4, 45, 'ecp-ai/auth', 'latest', '75m', '96Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-12';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'postgresql', 'data_service', true, 16, 1, 3, 50, 'postgres', '15', '200m', '256Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-12';

-- demo-tenant-13 (대화 이력 저장소)
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'history', 'data_service', true, 18, 1, 4, 45, 'ecp-ai/history', 'latest', '100m', '128Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-13';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'postgresql', 'data_service', true, 16, 1, 3, 50, 'postgres', '15', '200m', '256Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-13';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'vector-db', 'data_service', true, 14, 1, 3, 55, 'ecp-ai/vector-db', 'latest', '250m', '512Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-13';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'redis', 'data_service', true, 12, 1, 3, 35, 'redis', '7-alpine', '100m', '128Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-13';

-- demo-tenant-14 (시나리오 빌더)
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'scenario-builder', 'ai_service', true, 12, 1, 4, 60, 'ecp-ai/scenario-builder', 'latest', '200m', '256Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-14';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'nlp', 'ai_service', true, 28, 2, 8, 80, 'ecp-ai/nlp', 'latest', '400m', '1Gi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-14';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'postgresql', 'data_service', true, 16, 1, 3, 50, 'postgres', '15', '200m', '256Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-14';

-- demo-tenant-15 (시스템 모니터링)
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'monitoring', 'infra_service', true, 20, 1, 3, 40, 'ecp-ai/monitoring', 'latest', '50m', '64Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-15';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'postgresql', 'data_service', true, 16, 1, 3, 50, 'postgres', '15', '200m', '256Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-15';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'redis', 'data_service', true, 12, 1, 3, 35, 'redis', '7-alpine', '100m', '128Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-15';

-- 데이터 서비스 테넌트들 (demo-tenant-16 ~ demo-tenant-18)
-- demo-tenant-16 (데이터베이스 클러스터)
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'postgresql', 'data_service', true, 16, 1, 3, 50, 'postgres', '15', '200m', '256Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-16';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'vector-db', 'data_service', true, 14, 1, 3, 55, 'ecp-ai/vector-db', 'latest', '250m', '512Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-16';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'redis', 'data_service', true, 12, 1, 3, 35, 'redis', '7-alpine', '100m', '128Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-16';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'monitoring', 'infra_service', true, 20, 1, 3, 40, 'ecp-ai/monitoring', 'latest', '50m', '64Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-16';

-- demo-tenant-17 (벡터 데이터베이스)
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'vector-db', 'data_service', true, 14, 1, 3, 55, 'ecp-ai/vector-db', 'latest', '250m', '512Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-17';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'postgresql', 'data_service', true, 16, 1, 3, 50, 'postgres', '15', '200m', '256Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-17';

-- demo-tenant-18 (캐시 시스템)
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'redis', 'data_service', true, 12, 1, 3, 35, 'redis', '7-alpine', '100m', '128Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-18';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'monitoring', 'infra_service', true, 20, 1, 3, 40, 'ecp-ai/monitoring', 'latest', '50m', '64Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-18';

-- 특화 서비스 테넌트들 (demo-tenant-19 ~ demo-tenant-20)
-- demo-tenant-19 (실시간 통신)
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'livekit', 'media_service', true, 8, 1, 4, 60, 'ecp-ai/livekit', 'latest', '300m', '512Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-19';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'monitoring', 'infra_service', true, 20, 1, 3, 40, 'ecp-ai/monitoring', 'latest', '50m', '64Mi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-19';

-- demo-tenant-20 (화자 분리 시스템)
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'speaker-separation', 'ai_service', true, 6, 1, 3, 75, 'ecp-ai/speaker-separation', 'latest', '600m', '1.5Gi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-20';
INSERT INTO services (tenant_id, service_name, service_type, enabled, count, min_replicas, max_replicas, target_cpu, image_name, image_tag, cpu_request, memory_request) 
SELECT t.id, 'stt', 'ai_service', true, 18, 2, 6, 85, 'ecp-ai/stt', 'latest', '500m', '1Gi' FROM tenants t WHERE t.tenant_id = 'demo-tenant-20';

-- 모니터링 데이터 생성 (각 테넌트별 최근 24시간 데이터)
INSERT INTO monitoring_data (tenant_id, metric_type, metric_name, metric_value, timestamp)
SELECT 
    t.id as tenant_id,
    'cpu' as metric_type,
    'usage' as metric_name,
    (RANDOM() * 40 + 30)::numeric(5,2) as metric_value,  -- 30-70% 사이
    NOW() - (generate_series(0, 23) * INTERVAL '1 hour') as timestamp
FROM tenants t 
WHERE t.is_demo = true;

INSERT INTO monitoring_data (tenant_id, metric_type, metric_name, metric_value, timestamp)
SELECT 
    t.id as tenant_id,
    'memory' as metric_type,
    'usage' as metric_name,
    (RANDOM() * 30 + 45)::numeric(5,2) as metric_value,  -- 45-75% 사이
    NOW() - (generate_series(0, 23) * INTERVAL '1 hour') as timestamp
FROM tenants t 
WHERE t.is_demo = true;

INSERT INTO monitoring_data (tenant_id, metric_type, metric_name, metric_value, timestamp)
SELECT 
    t.id as tenant_id,
    'gpu' as metric_type,
    'usage' as metric_name,
    (RANDOM() * 35 + 60)::numeric(5,2) as metric_value,  -- 60-95% 사이
    NOW() - (generate_series(0, 23) * INTERVAL '1 hour') as timestamp
FROM tenants t 
WHERE t.is_demo = true;

-- 대시보드 설정 생성
INSERT INTO dashboard_configs (tenant_id, dashboard_name, dashboard_type, layout_config, created_at)
SELECT 
    t.id as tenant_id,
    t.name || ' 대시보드' as dashboard_name,
    'overview' as dashboard_type,
    '{"widgets": [{"type": "cpu", "position": {"x": 0, "y": 0}}, {"type": "memory", "position": {"x": 1, "y": 0}}, {"type": "gpu", "position": {"x": 2, "y": 0}}]}' as layout_config,
    t.created_at
FROM tenants t 
WHERE t.is_demo = true;
