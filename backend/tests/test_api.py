# [advice from AI] ECP-AI API 엔드포인트 테스트
"""
FastAPI 엔드포인트 통합 테스트
- API 엔드포인트 테스트
- 요청/응답 검증
- 에러 케이스 테스트
- 비동기 테스트 (httpx 사용)
"""

import pytest
import json
import asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, AsyncMock, Mock
from datetime import datetime

# 테스트 대상 모듈
import sys
sys.path.append('/app')
from app.main import app
from app.core.tenant_manager import TenantSpecs
from app.api.v1.tenants import get_tenant_manager, get_k8s_orchestrator


class TestHealthEndpoints:
    """헬스체크 엔드포인트 테스트"""
    
    @pytest.mark.asyncio
    async def test_health_check(self):
        """헬스체크 엔드포인트 테스트"""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # When: 헬스체크 요청
            response = await client.get("/health")
            
            # Then: 성공 응답
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "healthy"
            assert data["service"] == "ecp-ai-k8s-orchestrator"
            assert "version" in data
            assert "timestamp" in data
    
    @pytest.mark.asyncio
    async def test_readiness_check(self):
        """준비 상태 체크 엔드포인트 테스트"""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # When: 준비 상태 체크 요청
            response = await client.get("/ready")
            
            # Then: 성공 응답 (실제 DB 연결 없이는 503 가능)
            assert response.status_code in [200, 503]
            data = response.json()
            if response.status_code == 200:
                assert data["status"] == "ready"
                assert "checks" in data
    
    @pytest.mark.asyncio
    async def test_metrics_endpoint(self):
        """메트릭 엔드포인트 테스트"""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # When: 메트릭 요청
            response = await client.get("/metrics")
            
            # Then: 프로메테우스 형식 응답
            assert response.status_code == 200
            # 프로메테우스 메트릭은 텍스트 형식
            assert "text/plain" in response.headers.get("content-type", "")


class TestTenantAPI:
    """테넌시 API 테스트"""
    
    @pytest.fixture
    def mock_tenant_manager(self):
        """TenantManager 목 객체"""
        mock_manager = Mock()
        mock_manager.generate_tenant_specs.return_value = TenantSpecs(
            tenant_id="test-tenant",
            preset="small",
            services={
                "callbot": {
                    "enabled": True,
                    "count": 25,
                    "resource_requirements": {},
                    "container_specs": {},
                    "scaling": {}
                }
            },
            resources={
                "cpu_limit": "8000m",
                "memory_limit": "16Gi",
                "gpu_limit": 2,
                "gpu_type": "t4",
                "gpu_count": 2,
                "cpu_cores": 15,
                "storage_tb": 1.5
            },
            sla_target={"availability": "99.3%", "response_time": "<300ms"}
        )
        mock_manager.create_tenant = AsyncMock(return_value=True)
        return mock_manager
    
    @pytest.fixture
    def mock_k8s_orchestrator(self):
        """K8sOrchestrator 목 객체"""
        mock_orchestrator = Mock()
        mock_orchestrator.get_tenant_status = AsyncMock(return_value={
            "tenant_id": "test-tenant",
            "status": "Running",
            "services": [
                {
                    "name": "callbot",
                    "replicas": {"desired": 2, "available": 2, "ready": 2},
                    "status": "Running"
                }
            ]
        })
        mock_orchestrator.delete_tenant = AsyncMock(return_value=True)
        return mock_orchestrator
    
    @pytest.mark.asyncio
    async def test_create_tenant_success(self, mock_tenant_manager, mock_k8s_orchestrator):
        """테넌시 생성 성공 테스트"""
        # Given: 유효한 테넌시 생성 요청
        tenant_request = {
            "tenant_id": "test-customer",
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
            "auto_deploy": True
        }
        
        with patch('app.api.v1.tenants.get_tenant_manager', return_value=mock_tenant_manager), \
             patch('app.api.v1.tenants.get_k8s_orchestrator', return_value=mock_k8s_orchestrator):
            
            # K8s 상태 조회가 None 반환하도록 설정 (테넌시 없음)
            mock_k8s_orchestrator.get_tenant_status.return_value = None
            
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                # When: 테넌시 생성 요청
                response = await client.post("/api/v1/tenants/", json=tenant_request)
                
                # Then: 성공 응답
                assert response.status_code == 200
                data = response.json()
                
                # 응답 데이터 검증
                assert data["success"] is True
                assert data["tenant_id"] == "test-customer"
                assert data["preset"] == "small"
                assert "estimated_resources" in data
                assert data["deployment_status"] == "in_progress"
                
                # 리소스 정보 검증
                resources = data["estimated_resources"]
                assert "gpu" in resources
                assert "cpu" in resources
                assert "memory" in resources
                assert "storage" in resources
    
    @pytest.mark.asyncio
    async def test_create_tenant_validation_errors(self):
        """테넌시 생성 검증 오류 테스트"""
        invalid_requests = [
            # 빈 tenant_id
            {
                "tenant_id": "",
                "service_requirements": {"callbot": 10},
                "gpu_type": "t4"
            },
            # 잘못된 tenant_id 형식
            {
                "tenant_id": "Invalid_ID!",
                "service_requirements": {"callbot": 10},
                "gpu_type": "t4"
            },
            # 음수 서비스 요구사항
            {
                "tenant_id": "test-tenant",
                "service_requirements": {"callbot": -5},
                "gpu_type": "t4"
            },
            # 범위 초과 서비스 요구사항
            {
                "tenant_id": "test-tenant",
                "service_requirements": {"callbot": 10000},
                "gpu_type": "t4"
            },
            # 잘못된 GPU 타입
            {
                "tenant_id": "test-tenant",
                "service_requirements": {"callbot": 10},
                "gpu_type": "invalid_gpu"
            }
        ]
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            for invalid_request in invalid_requests:
                # When: 잘못된 요청
                response = await client.post("/api/v1/tenants/", json=invalid_request)
                
                # Then: 검증 오류 (422)
                assert response.status_code == 422, f"Failed for request: {invalid_request}"
    
    @pytest.mark.asyncio
    async def test_create_tenant_duplicate_error(self, mock_tenant_manager, mock_k8s_orchestrator):
        """테넌시 중복 생성 오류 테스트"""
        # Given: 이미 존재하는 테넌시
        tenant_request = {
            "tenant_id": "existing-tenant",
            "service_requirements": {"callbot": 10},
            "gpu_type": "t4",
            "auto_deploy": True
        }
        
        with patch('app.api.v1.tenants.get_tenant_manager', return_value=mock_tenant_manager), \
             patch('app.api.v1.tenants.get_k8s_orchestrator', return_value=mock_k8s_orchestrator):
            
            # K8s에서 기존 테넌시 반환
            mock_k8s_orchestrator.get_tenant_status.return_value = {"tenant_id": "existing-tenant"}
            
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                # When: 중복 테넌시 생성 요청
                response = await client.post("/api/v1/tenants/", json=tenant_request)
                
                # Then: 충돌 오류 (409)
                assert response.status_code == 409
                data = response.json()
                assert "이미 존재" in data["detail"]
    
    @pytest.mark.asyncio
    async def test_get_tenant_status_success(self, mock_k8s_orchestrator):
        """테넌시 상태 조회 성공 테스트"""
        tenant_id = "test-tenant"
        
        with patch('app.api.v1.tenants.get_k8s_orchestrator', return_value=mock_k8s_orchestrator):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                # When: 테넌시 상태 조회
                response = await client.get(f"/api/v1/tenants/{tenant_id}")
                
                # Then: 성공 응답
                assert response.status_code == 200
                data = response.json()
                
                # 응답 데이터 검증
                assert data["tenant_id"] == tenant_id
                assert data["status"] == "Running"
                assert "services" in data
                assert "resources" in data
                assert "sla_metrics" in data
                assert "last_updated" in data
                
                # 서비스 정보 검증
                services = data["services"]
                assert len(services) > 0
                service = services[0]
                assert "name" in service
                assert "replicas" in service
                assert "status" in service
    
    @pytest.mark.asyncio
    async def test_get_tenant_status_not_found(self, mock_k8s_orchestrator):
        """테넌시 상태 조회 실패 테스트 (404)"""
        tenant_id = "non-existent-tenant"
        
        with patch('app.api.v1.tenants.get_k8s_orchestrator', return_value=mock_k8s_orchestrator):
            # K8s에서 None 반환 (테넌시 없음)
            mock_k8s_orchestrator.get_tenant_status.return_value = None
            
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                # When: 존재하지 않는 테넌시 조회
                response = await client.get(f"/api/v1/tenants/{tenant_id}")
                
                # Then: 404 오류
                assert response.status_code == 404
                data = response.json()
                assert "찾을 수 없습니다" in data["detail"]
    
    @pytest.mark.asyncio
    async def test_delete_tenant_success(self, mock_k8s_orchestrator):
        """테넌시 삭제 성공 테스트"""
        tenant_id = "test-tenant"
        
        with patch('app.api.v1.tenants.get_k8s_orchestrator', return_value=mock_k8s_orchestrator):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                # When: 테넌시 삭제
                response = await client.delete(f"/api/v1/tenants/{tenant_id}")
                
                # Then: 성공 응답
                assert response.status_code == 200
                data = response.json()
                
                assert data["success"] is True
                assert tenant_id in data["message"]
                assert "deleted_at" in data
                
                # K8s 삭제 메서드 호출 확인
                mock_k8s_orchestrator.delete_tenant.assert_called_once_with(tenant_id)
    
    @pytest.mark.asyncio
    async def test_delete_tenant_not_found(self, mock_k8s_orchestrator):
        """테넌시 삭제 실패 테스트 (404)"""
        tenant_id = "non-existent-tenant"
        
        with patch('app.api.v1.tenants.get_k8s_orchestrator', return_value=mock_k8s_orchestrator):
            # 테넌시가 존재하지 않음
            mock_k8s_orchestrator.get_tenant_status.return_value = None
            
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                # When: 존재하지 않는 테넌시 삭제
                response = await client.delete(f"/api/v1/tenants/{tenant_id}")
                
                # Then: 404 오류
                assert response.status_code == 404
    
    @pytest.mark.asyncio
    async def test_get_tenant_metrics(self, mock_k8s_orchestrator):
        """테넌시 메트릭 조회 테스트"""
        tenant_id = "test-tenant"
        
        with patch('app.api.v1.tenants.get_k8s_orchestrator', return_value=mock_k8s_orchestrator):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                # When: 테넌시 메트릭 조회
                response = await client.get(f"/api/v1/tenants/{tenant_id}/metrics")
                
                # Then: 성공 응답
                assert response.status_code == 200
                data = response.json()
                
                # 메트릭 데이터 검증
                assert data["tenant_id"] == tenant_id
                assert "timestamp" in data
                assert "cpu_usage" in data
                assert "memory_usage" in data
                assert "gpu_usage" in data
                assert "network_io" in data
                assert "active_connections" in data
                
                # 값 범위 검증
                assert 0 <= data["cpu_usage"] <= 100
                assert 0 <= data["memory_usage"] <= 100
                assert 0 <= data["gpu_usage"] <= 100
                assert data["active_connections"] >= 0
    
    @pytest.mark.asyncio
    async def test_list_tenants(self):
        """테넌시 목록 조회 테스트"""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # When: 테넌시 목록 조회
            response = await client.get("/api/v1/tenants/")
            
            # Then: 성공 응답
            assert response.status_code == 200
            data = response.json()
            
            assert "tenants" in data
            assert "total_count" in data
            assert isinstance(data["tenants"], list)
            assert isinstance(data["total_count"], int)


class TestResourceCalculationAPI:
    """리소스 계산 API 테스트"""
    
    @pytest.mark.asyncio
    async def test_calculate_resources_success(self):
        """리소스 계산 성공 테스트"""
        # Given: 서비스 요구사항
        service_requirements = {
            "callbot": 50,
            "chatbot": 200,
            "advisor": 10,
            "stt": 5,
            "tts": 3,
            "ta": 0,
            "qa": 0
        }
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # When: 리소스 계산 요청
            response = await client.post("/api/v1/calculate-resources", json=service_requirements)
            
            # Then: 성공 응답
            assert response.status_code == 200
            data = response.json()
            
            # 응답 데이터 검증
            assert "preset" in data
            assert "total_channels" in data
            assert "total_users" in data
            assert "gpu_requirements" in data
            assert "cpu_requirements" in data
            
            # 계산 결과 검증
            assert data["preset"] in ["micro", "small", "medium", "large"]
            assert data["total_channels"] == 68  # 50 + 10 + 5 + 3
            assert data["total_users"] == 200
            
            gpu_req = data["gpu_requirements"]
            assert "tts" in gpu_req
            assert "nlp" in gpu_req
            assert "aicm" in gpu_req
            assert "recommended_type" in gpu_req
    
    @pytest.mark.asyncio
    async def test_calculate_resources_empty_requirements(self):
        """빈 서비스 요구사항 리소스 계산 테스트"""
        service_requirements = {}
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # When: 빈 요구사항으로 리소스 계산
            response = await client.post("/api/v1/calculate-resources", json=service_requirements)
            
            # Then: 성공 응답 (기본값으로 계산)
            assert response.status_code == 200
            data = response.json()
            assert data["preset"] == "micro"
            assert data["total_channels"] == 0
            assert data["total_users"] == 0


class TestErrorHandling:
    """에러 처리 테스트"""
    
    @pytest.mark.asyncio
    async def test_invalid_json_request(self):
        """잘못된 JSON 요청 테스트"""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # When: 잘못된 JSON 요청
            response = await client.post(
                "/api/v1/tenants/",
                content="invalid json",
                headers={"Content-Type": "application/json"}
            )
            
            # Then: JSON 파싱 오류 (422)
            assert response.status_code == 422
    
    @pytest.mark.asyncio
    async def test_missing_content_type(self):
        """Content-Type 누락 테스트"""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # When: Content-Type 없이 POST 요청
            response = await client.post(
                "/api/v1/tenants/",
                content='{"tenant_id": "test"}'
            )
            
            # Then: 적절한 오류 응답
            assert response.status_code in [422, 415]  # Unprocessable Entity or Unsupported Media Type
    
    @pytest.mark.asyncio
    async def test_not_found_endpoint(self):
        """존재하지 않는 엔드포인트 테스트"""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # When: 존재하지 않는 엔드포인트 요청
            response = await client.get("/api/v1/nonexistent")
            
            # Then: 404 오류
            assert response.status_code == 404
    
    @pytest.mark.asyncio
    async def test_method_not_allowed(self):
        """허용되지 않는 HTTP 메서드 테스트"""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # When: GET 전용 엔드포인트에 POST 요청
            response = await client.post("/health")
            
            # Then: 405 오류
            assert response.status_code == 405


class TestConcurrency:
    """동시성 테스트"""
    
    @pytest.mark.asyncio
    async def test_concurrent_tenant_creation(self, mock_tenant_manager, mock_k8s_orchestrator):
        """동시 테넌시 생성 테스트"""
        # Given: 여러 테넌시 생성 요청
        tenant_requests = [
            {
                "tenant_id": f"concurrent-tenant-{i}",
                "service_requirements": {"callbot": 10 + i},
                "gpu_type": "t4",
                "auto_deploy": False
            }
            for i in range(5)
        ]
        
        with patch('app.api.v1.tenants.get_tenant_manager', return_value=mock_tenant_manager), \
             patch('app.api.v1.tenants.get_k8s_orchestrator', return_value=mock_k8s_orchestrator):
            
            mock_k8s_orchestrator.get_tenant_status.return_value = None
            
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                # When: 동시 요청
                tasks = [
                    client.post("/api/v1/tenants/", json=request)
                    for request in tenant_requests
                ]
                responses = await asyncio.gather(*tasks)
                
                # Then: 모든 요청 성공
                for response in responses:
                    assert response.status_code == 200
                    data = response.json()
                    assert data["success"] is True


# 테스트 실행을 위한 설정
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short", "--asyncio-mode=auto"])
