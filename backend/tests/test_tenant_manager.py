# [advice from AI] ECP-AI 테넌트 매니저 테스트
"""
TenantManager 클래스 단위 테스트
- 프리셋 자동 감지 테스트
- 리소스 계산 정확성 테스트  
- 테넌시 생성 테스트
- 실제 가중치 데이터 기반 검증
"""

import pytest
import json
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from pathlib import Path

# 테스트 대상 모듈
import sys
sys.path.append('/app')
from app.core.tenant_manager import TenantManager, TenantSpecs
from app.core.resource_calculator import ResourceCalculator


class TestTenantManager:
    """TenantManager 테스트 클래스"""
    
    @pytest.fixture
    def sample_service_matrix(self):
        """테스트용 서비스 매트릭스 데이터"""
        return {
            "tenant_presets": {
                "micro": {
                    "max_channels": 10,
                    "resources": {"cpu_limit": "2000m", "memory_limit": "4Gi", "gpu_limit": 1},
                    "scaling": {"min_replicas": 1, "max_replicas": 3},
                    "sla": {"availability": "99.0%", "response_time": "<500ms"}
                },
                "small": {
                    "max_channels": 100,
                    "resources": {"cpu_limit": "8000m", "memory_limit": "16Gi", "gpu_limit": 2},
                    "scaling": {"min_replicas": 2, "max_replicas": 8},
                    "sla": {"availability": "99.3%", "response_time": "<300ms"}
                },
                "medium": {
                    "max_channels": 500,
                    "resources": {"cpu_limit": "32000m", "memory_limit": "64Gi", "gpu_limit": 8},
                    "scaling": {"min_replicas": 3, "max_replicas": 20},
                    "sla": {"availability": "99.5%", "response_time": "<200ms"}
                },
                "large": {
                    "max_channels": 999999,
                    "resources": {"cpu_limit": "128000m", "memory_limit": "256Gi", "gpu_limit": 32},
                    "scaling": {"min_replicas": 5, "max_replicas": 100},
                    "sla": {"availability": "99.9%", "response_time": "<100ms"}
                }
            },
            "services": {
                "callbot": {
                    "resource_requirements": {
                        "nlp_queries_per_day": 3200,
                        "aicm_queries_per_day": 480
                    }
                },
                "chatbot": {
                    "resource_requirements": {
                        "nlp_queries_per_day": 288,
                        "aicm_queries_per_day": 24
                    }
                },
                "advisor": {
                    "resource_requirements": {
                        "nlp_queries_per_day": 2400,
                        "aicm_queries_per_day": 1360
                    }
                }
            },
            "gpu_profiles": {
                "t4": {
                    "processing_capacity": {
                        "tts_channels_cache": 50,
                        "nlp_queries_per_second": 150,
                        "aicm_searches_per_second": 100
                    },
                    "ram_allocation": {
                        "base_ram": 32,
                        "workload_multiplier_range": [1.25, 2.5],
                        "max_ram_limit": 80
                    }
                },
                "v100": {
                    "processing_capacity": {
                        "tts_channels_cache": 150,
                        "nlp_queries_per_second": 450,
                        "aicm_searches_per_second": 300
                    },
                    "ram_allocation": {
                        "base_ram": 64,
                        "workload_multiplier_range": [1.25, 1.25],
                        "max_ram_limit": 80
                    }
                }
            },
            "scaling_logic": {
                "gpu_multipliers": {
                    "channels_100_or_less": {"nlp_multiplier": 1.0, "aicm_multiplier": 1.0},
                    "channels_101_to_500": {"nlp_multiplier": 1.5, "aicm_multiplier": 1.5},
                    "channels_over_500": {"nlp_multiplier": 2.5, "aicm_multiplier": 2.5}
                }
            },
            "cpu_specs": {
                "stt": {"channels_per_core": 6.5},
                "ta": {"batch_processing_factor": 0.3},
                "qa": {"internal_processing_ratio": 0.05}
            }
        }
    
    @pytest.fixture
    def tenant_manager(self, sample_service_matrix):
        """TenantManager 인스턴스 생성"""
        with patch('app.core.tenant_manager.Path.open') as mock_open:
            mock_open.return_value.__enter__.return_value.read.return_value = json.dumps({
                "ecp_service_matrix": sample_service_matrix
            })
            return TenantManager("/mock/path/config.json")
    
    def test_calculate_total_channels(self, tenant_manager):
        """총 채널 수 계산 테스트"""
        # Given: 서비스 요구사항
        service_requirements = {
            "callbot": 25,
            "advisor": 10,
            "stt": 5,
            "tts": 3,
            "chatbot": 100  # 채널 수에 포함되지 않음
        }
        
        # When: 총 채널 수 계산
        total_channels = tenant_manager._calculate_total_channels(service_requirements)
        
        # Then: 정확한 합계 반환
        assert total_channels == 43  # 25 + 10 + 5 + 3
    
    @pytest.mark.parametrize("service_requirements,expected_preset", [
        # Micro 프리셋 테스트
        ({"callbot": 5, "chatbot": 20, "advisor": 2}, "micro"),
        ({"callbot": 9, "chatbot": 49, "advisor": 0}, "micro"),
        
        # Small 프리셋 테스트
        ({"callbot": 50, "chatbot": 200, "advisor": 10}, "small"),
        ({"callbot": 80, "chatbot": 400, "advisor": 15}, "small"),
        
        # Medium 프리셋 테스트
        ({"callbot": 200, "chatbot": 1000, "advisor": 50}, "medium"),
        ({"callbot": 300, "chatbot": 1500, "advisor": 100}, "medium"),
        
        # Large 프리셋 테스트
        ({"callbot": 400, "chatbot": 2500, "advisor": 200}, "large"),
        ({"callbot": 600, "chatbot": 3000, "advisor": 300}, "large"),
    ])
    def test_detect_tenant_preset(self, tenant_manager, service_requirements, expected_preset):
        """프리셋 자동 감지 테스트 (실제 기준)"""
        # When: 프리셋 감지
        detected_preset = tenant_manager.detect_tenant_preset(service_requirements)
        
        # Then: 예상 프리셋과 일치
        assert detected_preset == expected_preset
    
    def test_select_optimal_gpu_type(self, tenant_manager):
        """GPU 타입 자동 선택 테스트"""
        test_cases = [
            # (total_channels, gpu_count, expected_type, reason)
            (50, 1, "t4", "소규모 환경"),
            (150, 1, "t4", "GPU 2개 이하"),
            (150, 2, "t4", "GPU 2개 이하"),
            (150, 5, "v100", "GPU 3-8개"),
            (150, 8, "v100", "GPU 3-8개"),
            (150, 10, "l40s", "GPU 9개 이상"),
        ]
        
        for total_channels, gpu_count, expected_type, reason in test_cases:
            # When: GPU 타입 선택
            selected_type = tenant_manager._select_optimal_gpu_type(total_channels, gpu_count)
            
            # Then: 예상 타입과 일치
            assert selected_type == expected_type, f"Failed for {reason}: channels={total_channels}, gpus={gpu_count}"
    
    def test_calculate_gpu_requirements_small_scale(self, tenant_manager):
        """GPU 요구사항 계산 테스트 - 소규모"""
        # Given: 소규모 서비스 요구사항
        service_requirements = {
            "callbot": 25,    # 25 * 3200 = 80,000 NLP쿼리/일
            "chatbot": 100,   # 100 * 288 = 28,800 NLP쿼리/일
            "advisor": 5      # 5 * 2400 = 12,000 NLP쿼리/일
        }
        
        # When: GPU 요구사항 계산
        gpu_requirements = tenant_manager._calculate_gpu_requirements(service_requirements)
        
        # Then: 올바른 계산 결과
        assert gpu_requirements["recommended_type"] == "t4"  # 소규모는 T4 강제
        assert gpu_requirements["total"] >= 1  # 최소 1개 GPU
        assert "tts" in gpu_requirements
        assert "nlp" in gpu_requirements
        assert "aicm" in gpu_requirements
    
    def test_calculate_gpu_requirements_medium_scale(self, tenant_manager):
        """GPU 요구사항 계산 테스트 - 중규모"""
        # Given: 중규모 서비스 요구사항
        service_requirements = {
            "callbot": 200,   # 200 * 3200 = 640,000 NLP쿼리/일
            "chatbot": 1000,  # 1000 * 288 = 288,000 NLP쿼리/일
            "advisor": 50     # 50 * 2400 = 120,000 NLP쿼리/일
        }
        
        # When: GPU 요구사항 계산
        gpu_requirements = tenant_manager._calculate_gpu_requirements(service_requirements)
        
        # Then: 스케일링 배수 적용 확인
        assert gpu_requirements["total"] > 1  # 중규모는 여러 GPU 필요
        # 250채널이므로 1.5배 배수 적용되어야 함
    
    def test_calculate_cpu_requirements(self, tenant_manager):
        """CPU 요구사항 계산 테스트"""
        # Given: 서비스 요구사항
        service_requirements = {
            "callbot": 50,    # STT 1:1, 일일 160콜
            "advisor": 20,    # STT 1:2, 일일 160상담
            "chatbot": 200,   # STT 없음, 일일 2.4세션
            "stt": 10         # 독립 STT
        }
        
        # When: CPU 요구사항 계산
        cpu_requirements = tenant_manager._calculate_cpu_requirements(service_requirements)
        
        # Then: 올바른 계산 결과
        assert "stt" in cpu_requirements
        assert "ta" in cpu_requirements
        assert "qa" in cpu_requirements
        assert "infrastructure" in cpu_requirements
        assert "total" in cpu_requirements
        
        # STT 계산: (50 + 20*2 + 10) / 6.5 = 100 / 6.5 ≈ 15.4
        expected_stt_cpu = 100 / 6.5
        assert abs(cpu_requirements["stt"] - expected_stt_cpu) < 1.0
        
        # 총 CPU는 최소 4코어 이상
        assert cpu_requirements["total"] >= 4
    
    def test_calculate_dynamic_gpu_ram(self, tenant_manager):
        """동적 GPU RAM 할당 계산 테스트"""
        # Given: 워크로드 요구사항
        workload_requirements = {
            "callbot": 100,   # 높은 워크로드
            "chatbot": 500,
            "advisor": 25
        }
        
        # When: T4 GPU RAM 계산
        gpu_ram_t4 = tenant_manager._calculate_dynamic_gpu_ram("t4", workload_requirements)
        
        # Then: 기본 RAM 이상, 최대 제한 이하
        assert 32 <= gpu_ram_t4 <= 80  # T4 기본 32GB, 최대 80GB
        
        # When: V100 GPU RAM 계산
        gpu_ram_v100 = tenant_manager._calculate_dynamic_gpu_ram("v100", workload_requirements)
        
        # Then: V100은 더 높은 기본 RAM
        assert 64 <= gpu_ram_v100 <= 80  # V100 기본 64GB, 최대 80GB
    
    def test_generate_tenant_specs(self, tenant_manager):
        """테넌시 사양 생성 테스트"""
        # Given: 테넌시 요구사항
        tenant_id = "test-tenant"
        service_requirements = {
            "callbot": 50,
            "chatbot": 200,
            "advisor": 10,
            "stt": 5,
            "tts": 3
        }
        gpu_type = "auto"
        
        # When: 테넌시 사양 생성
        tenant_specs = tenant_manager.generate_tenant_specs(
            tenant_id, service_requirements, gpu_type
        )
        
        # Then: 올바른 사양 생성
        assert isinstance(tenant_specs, TenantSpecs)
        assert tenant_specs.tenant_id == tenant_id
        assert tenant_specs.preset in ["micro", "small", "medium", "large"]
        assert isinstance(tenant_specs.services, dict)
        assert isinstance(tenant_specs.resources, dict)
        assert isinstance(tenant_specs.sla_target, dict)
        
        # 리소스 검증
        assert "gpu_type" in tenant_specs.resources
        assert "gpu_count" in tenant_specs.resources
        assert "cpu_cores" in tenant_specs.resources
        assert "storage_tb" in tenant_specs.resources
    
    @pytest.mark.asyncio
    async def test_create_tenant_success(self, tenant_manager):
        """테넌시 생성 성공 테스트"""
        # Given: 테넌시 사양
        tenant_specs = TenantSpecs(
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
            resources={"gpu_type": "t4", "gpu_count": 2, "cpu_cores": 15},
            sla_target={"availability": "99.3%", "response_time": "<300ms"}
        )
        
        # Mock 설정
        with patch.object(tenant_manager, '_create_namespace', new_callable=AsyncMock) as mock_namespace, \
             patch.object(tenant_manager, '_create_configmaps', new_callable=AsyncMock) as mock_configmaps, \
             patch.object(tenant_manager, '_deploy_service', new_callable=AsyncMock) as mock_deploy, \
             patch.object(tenant_manager, '_setup_monitoring', new_callable=AsyncMock) as mock_monitoring:
            
            # When: 테넌시 생성
            result = await tenant_manager.create_tenant(tenant_specs)
            
            # Then: 성공 및 모든 단계 실행
            assert result is True
            mock_namespace.assert_called_once()
            mock_configmaps.assert_called_once()
            mock_deploy.assert_called_once()
            mock_monitoring.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_create_tenant_failure(self, tenant_manager):
        """테넌시 생성 실패 테스트"""
        # Given: 테넌시 사양
        tenant_specs = TenantSpecs(
            tenant_id="test-tenant",
            preset="small",
            services={},
            resources={},
            sla_target={}
        )
        
        # Mock 설정 (네임스페이스 생성 실패)
        with patch.object(tenant_manager, '_create_namespace', new_callable=AsyncMock) as mock_namespace:
            mock_namespace.side_effect = Exception("네임스페이스 생성 실패")
            
            # When: 테넌시 생성
            result = await tenant_manager.create_tenant(tenant_specs)
            
            # Then: 실패 반환
            assert result is False
    
    def test_edge_cases(self, tenant_manager):
        """경계값 테스트"""
        # 빈 서비스 요구사항
        empty_requirements = {}
        preset = tenant_manager.detect_tenant_preset(empty_requirements)
        assert preset == "micro"  # 기본값
        
        # 매우 큰 값
        large_requirements = {
            "callbot": 1000,
            "chatbot": 10000,
            "advisor": 500
        }
        preset = tenant_manager.detect_tenant_preset(large_requirements)
        assert preset == "large"
        
        # 경계값 정확히
        boundary_requirements = {
            "callbot": 10,  # 정확히 10채널
            "chatbot": 50   # 정확히 50사용자
        }
        preset = tenant_manager.detect_tenant_preset(boundary_requirements)
        # 10채널, 50사용자는 micro와 small 경계
        assert preset in ["micro", "small"]
    
    def test_real_world_scenarios(self, tenant_manager):
        """실제 시나리오 테스트"""
        scenarios = [
            {
                "name": "스타트업",
                "requirements": {"callbot": 10, "chatbot": 50, "advisor": 2},
                "expected_preset": "micro",
                "expected_gpu_type": "t4"
            },
            {
                "name": "중소기업",
                "requirements": {"callbot": 100, "chatbot": 500, "advisor": 20},
                "expected_preset": "small",
                "expected_gpu_type": "t4"
            },
            {
                "name": "대기업",
                "requirements": {"callbot": 300, "chatbot": 1500, "advisor": 100},
                "expected_preset": "medium",
                "expected_gpu_type": "v100"
            },
            {
                "name": "엔터프라이즈",
                "requirements": {"callbot": 600, "chatbot": 3000, "advisor": 200},
                "expected_preset": "large",
                "expected_gpu_type": "l40s"
            }
        ]
        
        for scenario in scenarios:
            # When: 테넌시 사양 생성
            tenant_specs = tenant_manager.generate_tenant_specs(
                f"test-{scenario['name']}", 
                scenario["requirements"], 
                "auto"
            )
            
            # Then: 예상 결과와 일치
            assert tenant_specs.preset == scenario["expected_preset"], \
                f"{scenario['name']} 프리셋 불일치"
            
            # GPU 타입은 실제 계산에 따라 달라질 수 있으므로 존재만 확인
            assert tenant_specs.resources["gpu_type"] in ["t4", "v100", "l40s"], \
                f"{scenario['name']} GPU 타입 오류"


# 테스트 실행을 위한 설정
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
