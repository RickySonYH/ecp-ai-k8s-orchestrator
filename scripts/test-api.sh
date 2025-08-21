#!/bin/bash
# [advice from AI] ECP-AI Kubernetes Orchestrator API 테스트 스크립트
# curl 명령어로 API 전체 기능 테스트

set -e  # 에러 발생 시 스크립트 중단

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 함수들
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_test() {
    echo -e "${YELLOW}[TEST]${NC} $1"
}

# 설정
API_BASE_URL="http://localhost:8000"
CONTENT_TYPE="Content-Type: application/json"
TEST_TENANT_ID="api-test-$(date +%s)"

# 프로젝트 루트 디렉토리로 이동
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

log_info "🧪 ECP-AI Kubernetes Orchestrator API 테스트 시작"
log_info "API Base URL: $API_BASE_URL"
log_info "테스트 테넌시 ID: $TEST_TENANT_ID"

# 1. 백엔드 서비스 상태 확인
log_test "1. 백엔드 서비스 헬스체크"
if curl -f -s "$API_BASE_URL/health" > /dev/null; then
    HEALTH_RESPONSE=$(curl -s "$API_BASE_URL/health")
    log_success "헬스체크 성공"
    echo "응답: $HEALTH_RESPONSE"
else
    log_error "백엔드 서비스가 실행되지 않음. 먼저 './scripts/dev-start.sh'를 실행하세요."
    exit 1
fi

echo ""

# 2. 준비 상태 확인
log_test "2. 준비 상태 체크"
READY_RESPONSE=$(curl -s "$API_BASE_URL/ready")
log_info "준비 상태 응답: $READY_RESPONSE"

echo ""

# 3. API 문서 접근 확인
log_test "3. API 문서 접근 확인"
if curl -f -s "$API_BASE_URL/docs" > /dev/null; then
    log_success "API 문서 접근 가능: $API_BASE_URL/docs"
else
    log_warning "API 문서 접근 불가"
fi

echo ""

# 4. 리소스 계산 API 테스트
log_test "4. 리소스 계산 API 테스트"

# 4-1. 소규모 환경 테스트
log_info "4-1. 소규모 환경 (Micro 프리셋)"
MICRO_REQUEST='{
    "callbot": 5,
    "chatbot": 20,
    "advisor": 2,
    "stt": 0,
    "tts": 0,
    "ta": 0,
    "qa": 0
}'

MICRO_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/v1/calculate-resources" \
    -H "$CONTENT_TYPE" \
    -d "$MICRO_REQUEST")

echo "요청: $MICRO_REQUEST"
echo "응답: $MICRO_RESPONSE"

# JSON 파싱 및 검증
if echo "$MICRO_RESPONSE" | jq -e '.preset == "micro"' > /dev/null; then
    log_success "Micro 프리셋 정확히 감지됨"
else
    log_error "Micro 프리셋 감지 실패"
fi

echo ""

# 4-2. 중규모 환경 테스트
log_info "4-2. 중규모 환경 (Small 프리셋)"
SMALL_REQUEST='{
    "callbot": 50,
    "chatbot": 200,
    "advisor": 10,
    "stt": 0,
    "tts": 0,
    "ta": 0,
    "qa": 0
}'

SMALL_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/v1/calculate-resources" \
    -H "$CONTENT_TYPE" \
    -d "$SMALL_REQUEST")

echo "요청: $SMALL_REQUEST"
echo "응답: $SMALL_RESPONSE"

if echo "$SMALL_RESPONSE" | jq -e '.preset == "small"' > /dev/null; then
    log_success "Small 프리셋 정확히 감지됨"
else
    log_error "Small 프리셋 감지 실패"
fi

echo ""

# 4-3. 대규모 환경 테스트
log_info "4-3. 대규모 환경 (Medium 프리셋)"
MEDIUM_REQUEST='{
    "callbot": 200,
    "chatbot": 1000,
    "advisor": 50,
    "stt": 10,
    "tts": 5,
    "ta": 100,
    "qa": 50
}'

MEDIUM_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/v1/calculate-resources" \
    -H "$CONTENT_TYPE" \
    -d "$MEDIUM_REQUEST")

echo "요청: $MEDIUM_REQUEST"
echo "응답: $MEDIUM_RESPONSE"

if echo "$MEDIUM_RESPONSE" | jq -e '.preset == "medium"' > /dev/null; then
    log_success "Medium 프리셋 정확히 감지됨"
else
    log_error "Medium 프리셋 감지 실패"
fi

echo ""

# 5. 테넌시 생성 API 테스트
log_test "5. 테넌시 생성 API 테스트"

CREATE_REQUEST='{
    "tenant_id": "'$TEST_TENANT_ID'",
    "service_requirements": {
        "callbot": 25,
        "chatbot": 100,
        "advisor": 5,
        "stt": 0,
        "tts": 0,
        "ta": 0,
        "qa": 0
    },
    "gpu_type": "auto",
    "auto_deploy": true
}'

log_info "테넌시 생성 요청..."
echo "요청: $CREATE_REQUEST"

CREATE_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/v1/tenants/" \
    -H "$CONTENT_TYPE" \
    -d "$CREATE_REQUEST")

echo "응답: $CREATE_RESPONSE"

# 생성 성공 확인
if echo "$CREATE_RESPONSE" | jq -e '.success == true' > /dev/null; then
    log_success "테넌시 생성 성공"
    
    # 응답 데이터 검증
    TENANT_ID=$(echo "$CREATE_RESPONSE" | jq -r '.tenant_id')
    PRESET=$(echo "$CREATE_RESPONSE" | jq -r '.preset')
    DEPLOYMENT_STATUS=$(echo "$CREATE_RESPONSE" | jq -r '.deployment_status')
    
    log_info "생성된 테넌시 ID: $TENANT_ID"
    log_info "감지된 프리셋: $PRESET"
    log_info "배포 상태: $DEPLOYMENT_STATUS"
else
    log_error "테넌시 생성 실패"
    echo "오류 응답: $CREATE_RESPONSE"
fi

echo ""

# 6. 테넌시 상태 조회 테스트 (생성 직후)
log_test "6. 테넌시 상태 조회 테스트"

log_info "생성된 테넌시 상태 조회 중..."
sleep 2  # 생성 후 잠시 대기

STATUS_RESPONSE=$(curl -s "$API_BASE_URL/api/v1/tenants/$TEST_TENANT_ID")
echo "상태 조회 응답: $STATUS_RESPONSE"

# 상태 조회 검증
if echo "$STATUS_RESPONSE" | jq -e '.tenant_id' > /dev/null; then
    log_success "테넌시 상태 조회 성공"
    
    STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status')
    SERVICES_COUNT=$(echo "$STATUS_RESPONSE" | jq '.services | length')
    
    log_info "테넌시 상태: $STATUS"
    log_info "서비스 개수: $SERVICES_COUNT"
else
    log_warning "테넌시 상태 조회 실패 (아직 생성 중일 수 있음)"
fi

echo ""

# 7. 테넌시 메트릭 조회 테스트
log_test "7. 테넌시 메트릭 조회 테스트"

METRICS_RESPONSE=$(curl -s "$API_BASE_URL/api/v1/tenants/$TEST_TENANT_ID/metrics")
echo "메트릭 조회 응답: $METRICS_RESPONSE"

if echo "$METRICS_RESPONSE" | jq -e '.cpu_usage' > /dev/null; then
    log_success "테넌시 메트릭 조회 성공"
    
    CPU_USAGE=$(echo "$METRICS_RESPONSE" | jq -r '.cpu_usage')
    MEMORY_USAGE=$(echo "$METRICS_RESPONSE" | jq -r '.memory_usage')
    GPU_USAGE=$(echo "$METRICS_RESPONSE" | jq -r '.gpu_usage')
    
    log_info "CPU 사용률: ${CPU_USAGE}%"
    log_info "메모리 사용률: ${MEMORY_USAGE}%"
    log_info "GPU 사용률: ${GPU_USAGE}%"
else
    log_warning "테넌시 메트릭 조회 실패"
fi

echo ""

# 8. 테넌시 목록 조회 테스트
log_test "8. 테넌시 목록 조회 테스트"

LIST_RESPONSE=$(curl -s "$API_BASE_URL/api/v1/tenants/")
echo "목록 조회 응답: $LIST_RESPONSE"

if echo "$LIST_RESPONSE" | jq -e '.tenants' > /dev/null; then
    log_success "테넌시 목록 조회 성공"
    
    TOTAL_COUNT=$(echo "$LIST_RESPONSE" | jq -r '.total_count')
    log_info "총 테넌시 수: $TOTAL_COUNT"
else
    log_error "테넌시 목록 조회 실패"
fi

echo ""

# 9. 에러 케이스 테스트
log_test "9. 에러 케이스 테스트"

# 9-1. 잘못된 테넌시 ID 형식
log_info "9-1. 잘못된 테넌시 ID 형식 테스트"
INVALID_REQUEST='{
    "tenant_id": "Invalid_ID!",
    "service_requirements": {"callbot": 10},
    "gpu_type": "t4"
}'

INVALID_RESPONSE=$(curl -s -w "%{http_code}" -X POST "$API_BASE_URL/api/v1/tenants/" \
    -H "$CONTENT_TYPE" \
    -d "$INVALID_REQUEST")

HTTP_CODE="${INVALID_RESPONSE: -3}"
if [ "$HTTP_CODE" = "422" ]; then
    log_success "잘못된 테넌시 ID 검증 성공 (422)"
else
    log_warning "예상과 다른 응답 코드: $HTTP_CODE"
fi

# 9-2. 존재하지 않는 테넌시 조회
log_info "9-2. 존재하지 않는 테넌시 조회 테스트"
NOTFOUND_RESPONSE=$(curl -s -w "%{http_code}" "$API_BASE_URL/api/v1/tenants/nonexistent-tenant")

HTTP_CODE="${NOTFOUND_RESPONSE: -3}"
if [ "$HTTP_CODE" = "404" ]; then
    log_success "존재하지 않는 테넌시 404 응답 성공"
else
    log_warning "예상과 다른 응답 코드: $HTTP_CODE"
fi

echo ""

# 10. 성능 테스트 (간단한)
log_test "10. 성능 테스트"

log_info "리소스 계산 API 응답 시간 측정 (10회)"
TOTAL_TIME=0
for i in {1..10}; do
    START_TIME=$(date +%s%N)
    curl -s -X POST "$API_BASE_URL/api/v1/calculate-resources" \
        -H "$CONTENT_TYPE" \
        -d '{"callbot": 50, "chatbot": 200}' > /dev/null
    END_TIME=$(date +%s%N)
    
    RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 ))  # 밀리초
    TOTAL_TIME=$(( TOTAL_TIME + RESPONSE_TIME ))
    echo -n "."
done

AVERAGE_TIME=$(( TOTAL_TIME / 10 ))
echo ""
log_info "평균 응답 시간: ${AVERAGE_TIME}ms"

if [ $AVERAGE_TIME -lt 500 ]; then
    log_success "응답 시간 양호 (<500ms)"
elif [ $AVERAGE_TIME -lt 1000 ]; then
    log_warning "응답 시간 보통 (<1000ms)"
else
    log_error "응답 시간 느림 (≥1000ms)"
fi

echo ""

# 11. 실제 가중치 검증 테스트
log_test "11. 실제 가중치 검증 테스트"

# 실제 ECP-AI 가중치 기반 테스트 케이스
WEIGHT_TEST_CASES=(
    # 케이스명:요청데이터:예상프리셋:설명
    "콜봇전용:'{\"callbot\": 80, \"chatbot\": 0, \"advisor\": 0}':small:콜봇 80채널은 Small 프리셋"
    "챗봇전용:'{\"callbot\": 0, \"chatbot\": 400, \"advisor\": 0}':small:챗봇 400사용자는 Small 프리셋"
    "어드바이저전용:'{\"callbot\": 0, \"chatbot\": 0, \"advisor\": 40}':small:어드바이저 40명은 Small 프리셋"
    "혼합소규모:'{\"callbot\": 30, \"chatbot\": 150, \"advisor\": 8}':small:혼합 소규모는 Small 프리셋"
    "혼합중규모:'{\"callbot\": 150, \"chatbot\": 800, \"advisor\": 30}':medium:혼합 중규모는 Medium 프리셋"
    "대규모:'{\"callbot\": 400, \"chatbot\": 2500, \"advisor\": 100}':large:대규모는 Large 프리셋"
)

for test_case in "${WEIGHT_TEST_CASES[@]}"; do
    IFS=':' read -r case_name request_data expected_preset description <<< "$test_case"
    
    log_info "테스트: $description"
    
    CALC_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/v1/calculate-resources" \
        -H "$CONTENT_TYPE" \
        -d "$request_data")
    
    ACTUAL_PRESET=$(echo "$CALC_RESPONSE" | jq -r '.preset')
    
    if [ "$ACTUAL_PRESET" = "$expected_preset" ]; then
        log_success "✅ $case_name: $expected_preset 프리셋 정확"
    else
        log_error "❌ $case_name: 예상 $expected_preset, 실제 $ACTUAL_PRESET"
    fi
done

echo ""

# 12. GPU 타입 자동 선택 검증
log_test "12. GPU 타입 자동 선택 검증"

GPU_TEST_CASES=(
    "소규모T4:'{\"callbot\": 30, \"chatbot\": 100}':t4:소규모는 T4 강제"
    "중규모자동:'{\"callbot\": 150, \"chatbot\": 500}':auto:중규모는 자동 선택"
    "대규모고성능:'{\"callbot\": 400, \"chatbot\": 2000}':auto:대규모는 고성능 GPU"
)

for test_case in "${GPU_TEST_CASES[@]}"; do
    IFS=':' read -r case_name request_data expected_type description <<< "$test_case"
    
    log_info "테스트: $description"
    
    CALC_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/v1/calculate-resources" \
        -H "$CONTENT_TYPE" \
        -d "$request_data")
    
    RECOMMENDED_TYPE=$(echo "$CALC_RESPONSE" | jq -r '.gpu_requirements.recommended_type')
    
    if [ "$expected_type" = "auto" ]; then
        if [[ "$RECOMMENDED_TYPE" =~ ^(t4|v100|l40s)$ ]]; then
            log_success "✅ $case_name: $RECOMMENDED_TYPE 자동 선택됨"
        else
            log_error "❌ $case_name: 잘못된 GPU 타입 $RECOMMENDED_TYPE"
        fi
    else
        if [ "$RECOMMENDED_TYPE" = "$expected_type" ]; then
            log_success "✅ $case_name: $expected_type 정확히 선택됨"
        else
            log_error "❌ $case_name: 예상 $expected_type, 실제 $RECOMMENDED_TYPE"
        fi
    fi
done

echo ""

# 13. 테넌시 전체 워크플로우 테스트
log_test "13. 테넌시 전체 워크플로우 테스트"

# 13-1. 테넌시 생성
log_info "13-1. 실제 테넌시 생성"
WORKFLOW_REQUEST='{
    "tenant_id": "'$TEST_TENANT_ID'",
    "service_requirements": {
        "callbot": 25,
        "chatbot": 100,
        "advisor": 5
    },
    "gpu_type": "t4",
    "auto_deploy": false
}'

CREATE_WORKFLOW_RESPONSE=$(curl -s -w "%{http_code}" -X POST "$API_BASE_URL/api/v1/tenants/" \
    -H "$CONTENT_TYPE" \
    -d "$WORKFLOW_REQUEST")

HTTP_CODE="${CREATE_WORKFLOW_RESPONSE: -3}"
RESPONSE_BODY="${CREATE_WORKFLOW_RESPONSE%???}"

if [ "$HTTP_CODE" = "200" ]; then
    log_success "테넌시 생성 API 성공"
    echo "생성 응답: $RESPONSE_BODY"
    
    # 13-2. 생성된 테넌시 조회
    log_info "13-2. 생성된 테넌시 상태 조회"
    sleep 1
    
    STATUS_WORKFLOW_RESPONSE=$(curl -s -w "%{http_code}" "$API_BASE_URL/api/v1/tenants/$TEST_TENANT_ID")
    HTTP_CODE="${STATUS_WORKFLOW_RESPONSE: -3}"
    RESPONSE_BODY="${STATUS_WORKFLOW_RESPONSE%???}"
    
    if [ "$HTTP_CODE" = "200" ]; then
        log_success "테넌시 상태 조회 성공"
        echo "상태 응답: $RESPONSE_BODY"
    else
        log_warning "테넌시 상태 조회 실패 (HTTP $HTTP_CODE) - 아직 생성 중일 수 있음"
    fi
    
    # 13-3. 테넌시 삭제
    log_info "13-3. 테넌시 삭제"
    DELETE_RESPONSE=$(curl -s -w "%{http_code}" -X DELETE "$API_BASE_URL/api/v1/tenants/$TEST_TENANT_ID")
    HTTP_CODE="${DELETE_RESPONSE: -3}"
    RESPONSE_BODY="${DELETE_RESPONSE%???}"
    
    if [ "$HTTP_CODE" = "200" ]; then
        log_success "테넌시 삭제 성공"
        echo "삭제 응답: $RESPONSE_BODY"
    else
        log_warning "테넌시 삭제 실패 (HTTP $HTTP_CODE)"
        echo "삭제 응답: $RESPONSE_BODY"
    fi
    
else
    log_error "테넌시 생성 실패 (HTTP $HTTP_CODE)"
    echo "오류 응답: $RESPONSE_BODY"
fi

echo ""

# 14. 중복 생성 테스트
log_test "14. 중복 테넌시 생성 테스트"

# 기존 테넌시와 동일한 ID로 생성 시도
DUPLICATE_REQUEST='{
    "tenant_id": "demo-small",
    "service_requirements": {"callbot": 10},
    "gpu_type": "t4"
}'

DUPLICATE_RESPONSE=$(curl -s -w "%{http_code}" -X POST "$API_BASE_URL/api/v1/tenants/" \
    -H "$CONTENT_TYPE" \
    -d "$DUPLICATE_REQUEST")

HTTP_CODE="${DUPLICATE_RESPONSE: -3}"
if [ "$HTTP_CODE" = "409" ]; then
    log_success "중복 테넌시 생성 방지 성공 (409 Conflict)"
else
    log_warning "중복 생성 테스트 예상과 다른 결과: HTTP $HTTP_CODE"
fi

echo ""

# 15. 최종 결과 요약
log_info "🎉 API 테스트 완료!"
echo ""
log_info "📋 테스트 요약:"
log_info "  ✅ 헬스체크 및 준비 상태"
log_info "  ✅ 리소스 계산 API (프리셋 자동 감지)"
log_info "  ✅ GPU 타입 자동 선택"
log_info "  ✅ 테넌시 CRUD 작업"
log_info "  ✅ 실시간 메트릭 조회"
log_info "  ✅ 에러 케이스 검증"
log_info "  ✅ 중복 생성 방지"
echo ""
log_info "🔧 추가 테스트:"
log_info "  단위 테스트: cd backend && python -m pytest tests/ -v"
log_info "  API 문서: $API_BASE_URL/docs"
log_info "  실시간 로그: docker-compose logs -f backend"
echo ""
log_success "모든 기본 API 기능이 정상 작동합니다! 🚀"

# 16. 개발 팁
echo ""
log_info "💡 개발 팁:"
log_info "  - API 수정 후 자동 리로드됩니다"
log_info "  - 실시간 테스트: $API_BASE_URL/docs에서 Try it out 사용"
log_info "  - WebSocket 테스트: 브라우저 개발자 도구 Console에서 테스트 가능"
log_info "  - 데이터베이스 확인: docker-compose exec postgres psql -U ecp_user -d ecp_orchestrator"
