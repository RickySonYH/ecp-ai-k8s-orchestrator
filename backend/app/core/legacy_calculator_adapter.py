# [advice from AI] 기존 ECP-AI 계산 엔진 어댑터 - 정교한 계산 로직 통합
"""
기존 calculator.py의 정교한 계산 로직을 현재 시스템에 통합
- 실제 가중치 데이터 기반 정확한 계산
- AWS/NCP 인스턴스 매핑
- MSP 비용 계산
"""

import sys
import os
import json
import math
import logging
from typing import Dict, Any, List, Tuple, Optional
from pathlib import Path
from dataclasses import dataclass, asdict
import structlog

# 기존 모델들 임포트
sys.path.append(str(Path(__file__).parent.parent.parent.parent))
from models.calculator import ECPHardwareCalculator, ResourceCalculation, HardwareSpecification
from models.aws_mapper import AWSInstanceMapper
from models.ncp_mapper import NCPInstanceMapper
from models.msp_calculator import MSPCalculator

logger = structlog.get_logger(__name__)


@dataclass
class EnhancedResourceCalculation:
    """향상된 리소스 계산 결과"""
    # 기본 리소스
    gpu: Dict[str, float]
    cpu: Dict[str, float]
    network: Dict[str, float]
    storage: Dict[str, float]
    infrastructure: Dict[str, float]
    
    # 상세 정보
    stt_channels: float
    tts_channels: float
    nlp_daily_queries: int
    aicm_daily_queries: int
    ta_daily_processing: int
    qa_daily_evaluations: int
    
    # 종속성 정보
    stt_breakdown: Dict[str, int]
    nlp_breakdown: Dict[str, int]
    aicm_breakdown: Dict[str, int]
    infra_breakdown: Dict[str, Any]


@dataclass
class DetailedHardwareSpec:
    """상세 하드웨어 사양"""
    # 서버 그룹
    gpu_servers: List[Dict[str, Any]]
    cpu_servers: List[Dict[str, Any]]
    storage_servers: List[Dict[str, Any]]
    infrastructure_servers: List[Dict[str, Any]]
    
    # 총 리소스
    total_servers: int
    total_cpu_cores: int
    total_ram_gb: int
    total_storage_tb: float
    total_gpu_count: int
    
    # 네트워크 및 추가 정보
    network_requirements: str
    infrastructure_notes: str
    
    # 비용 정보
    aws_cost_analysis: Optional[Dict[str, Any]] = None
    ncp_cost_analysis: Optional[Dict[str, Any]] = None
    msp_cost_analysis: Optional[Dict[str, Any]] = None


class LegacyCalculatorAdapter:
    """기존 계산 엔진을 현재 시스템에 통합하는 어댑터"""
    
    def __init__(self):
        try:
            # 기존 계산 엔진들 초기화
            self.hardware_calculator = ECPHardwareCalculator(config_path="config")
            self.aws_mapper = AWSInstanceMapper()
            self.ncp_mapper = NCPInstanceMapper()
            self.msp_calculator = MSPCalculator()
            
            logger.info("LegacyCalculatorAdapter 초기화 완료")
            
        except Exception as e:
            logger.warning("기존 계산 엔진 초기화 실패, 폴백 모드로 동작", error=str(e))
            self.hardware_calculator = None
            self.aws_mapper = None
            self.ncp_mapper = None
            self.msp_calculator = None
    
    def calculate_enhanced_resources(self, 
                                   service_requirements: Dict[str, int],
                                   gpu_type: str = "t4") -> EnhancedResourceCalculation:
        """
        향상된 리소스 계산 (기존 엔진 사용)
        """
        if not self.hardware_calculator:
            return self._fallback_calculation(service_requirements, gpu_type)
        
        try:
            logger.info("기존 계산 엔진으로 리소스 계산", 
                       service_requirements=service_requirements, gpu_type=gpu_type)
            
            # 기존 엔진으로 계산
            resources, hardware_spec = self.hardware_calculator.calculate_hardware_requirements(
                service_requirements, gpu_type
            )
            
            # 결과를 새로운 형태로 변환
            enhanced_resources = EnhancedResourceCalculation(
                gpu=resources.gpu,
                cpu=resources.cpu,
                network=resources.network,
                storage=resources.storage,
                infrastructure=resources.infrastructure,
                stt_channels=resources.stt_channels,
                tts_channels=resources.tts_channels,
                nlp_daily_queries=int(sum(resources.nlp_breakdown.values()) if resources.nlp_breakdown else 0),
                aicm_daily_queries=int(sum(resources.aicm_breakdown.values()) if resources.aicm_breakdown else 0),
                ta_daily_processing=int(resources.ta_channels),
                qa_daily_evaluations=int(resources.qa_channels),
                stt_breakdown=resources.stt_breakdown or {},
                nlp_breakdown=resources.nlp_breakdown or {},
                aicm_breakdown=resources.aicm_breakdown or {},
                infra_breakdown=resources.infra_breakdown or {}
            )
            
            logger.info("기존 계산 엔진 계산 완료", 
                       total_gpu=resources.gpu.get('total', 0),
                       total_cpu=resources.cpu.get('total', 0))
            
            return enhanced_resources
            
        except Exception as e:
            logger.error("기존 계산 엔진 실행 실패, 폴백 모드 사용", error=str(e))
            return self._fallback_calculation(service_requirements, gpu_type)
    
    def generate_detailed_hardware_spec(self, 
                                      service_requirements: Dict[str, int],
                                      gpu_type: str = "t4",
                                      include_cloud_mapping: bool = True) -> DetailedHardwareSpec:
        """
        상세 하드웨어 사양 생성 (기존 엔진 + 클라우드 매핑)
        """
        if not self.hardware_calculator:
            return self._fallback_hardware_spec(service_requirements, gpu_type)
        
        try:
            logger.info("상세 하드웨어 사양 생성", 
                       service_requirements=service_requirements, gpu_type=gpu_type)
            
            # 기존 엔진으로 계산
            resources, hardware_spec = self.hardware_calculator.calculate_hardware_requirements(
                service_requirements, gpu_type
            )
            
            # 총 리소스 계산
            total_servers = sum(s['count'] for s in 
                              hardware_spec.gpu_servers + 
                              hardware_spec.cpu_servers + 
                              hardware_spec.storage_servers + 
                              hardware_spec.infrastructure_servers)
            
            total_cpu_cores = sum(s['cpu_cores'] * s['count'] for s in 
                                hardware_spec.gpu_servers + 
                                hardware_spec.cpu_servers + 
                                hardware_spec.infrastructure_servers)
            
            total_ram_gb = sum(s['ram_gb'] * s['count'] for s in 
                             hardware_spec.gpu_servers + 
                             hardware_spec.cpu_servers + 
                             hardware_spec.infrastructure_servers)
            
            total_storage_tb = sum(s.get('storage_ssd_tb', 0) * s['count'] for s in 
                                 hardware_spec.gpu_servers + 
                                 hardware_spec.cpu_servers + 
                                 hardware_spec.infrastructure_servers)
            
            total_gpu_count = sum(s.get('gpu_per_server', 0) * s['count'] for s in hardware_spec.gpu_servers)
            
            # 클라우드 매핑 (요청된 경우)
            aws_cost_analysis = None
            ncp_cost_analysis = None
            msp_cost_analysis = None
            
            if include_cloud_mapping:
                try:
                    # AWS 비용 분석
                    if self.aws_mapper:
                        aws_cost_analysis = self._calculate_aws_costs(hardware_spec)
                    
                    # NCP 비용 분석
                    if self.ncp_mapper:
                        ncp_cost_analysis = self._calculate_ncp_costs(hardware_spec)
                    
                    # MSP 비용 분석
                    if self.msp_calculator:
                        msp_cost_analysis = self._calculate_msp_costs(
                            aws_cost_analysis, ncp_cost_analysis
                        )
                        
                except Exception as e:
                    logger.warning("클라우드 비용 계산 실패", error=str(e))
            
            detailed_spec = DetailedHardwareSpec(
                gpu_servers=hardware_spec.gpu_servers,
                cpu_servers=hardware_spec.cpu_servers,
                storage_servers=hardware_spec.storage_servers,
                infrastructure_servers=hardware_spec.infrastructure_servers,
                total_servers=total_servers,
                total_cpu_cores=total_cpu_cores,
                total_ram_gb=int(total_ram_gb),
                total_storage_tb=round(total_storage_tb, 1),
                total_gpu_count=total_gpu_count,
                network_requirements=hardware_spec.network_requirements,
                infrastructure_notes=hardware_spec.infrastructure_notes,
                aws_cost_analysis=aws_cost_analysis,
                ncp_cost_analysis=ncp_cost_analysis,
                msp_cost_analysis=msp_cost_analysis
            )
            
            logger.info("상세 하드웨어 사양 생성 완료",
                       total_servers=total_servers,
                       total_cpu_cores=total_cpu_cores,
                       total_gpu_count=total_gpu_count)
            
            return detailed_spec
            
        except Exception as e:
            logger.error("상세 하드웨어 사양 생성 실패, 폴백 모드 사용", error=str(e))
            return self._fallback_hardware_spec(service_requirements, gpu_type)
    
    def _calculate_aws_costs(self, hardware_spec: HardwareSpecification) -> Dict[str, Any]:
        """AWS 비용 계산"""
        try:
            total_cost = 0
            instance_breakdown = []
            
            # 각 서버 타입별 비용 계산
            all_servers = (hardware_spec.gpu_servers + 
                          hardware_spec.cpu_servers + 
                          hardware_spec.infrastructure_servers)
            
            for server in all_servers:
                # 서버 스펙을 AWS 인스턴스에 매핑
                cpu_cores = server['cpu_cores']
                ram_gb = server['ram_gb']
                gpu_count = server.get('gpu_per_server', 0)
                count = server['count']
                
                # AWS 인스턴스 찾기
                suitable_instance = self.aws_mapper.find_suitable_instance(
                    cpu_cores, ram_gb, gpu_count
                )
                
                if suitable_instance:
                    monthly_cost = suitable_instance.monthly_cost_usd * count
                    total_cost += monthly_cost
                    
                    instance_breakdown.append({
                        'server_type': server['type'],
                        'count': count,
                        'aws_instance': suitable_instance.instance_type,
                        'monthly_cost_usd': monthly_cost
                    })
            
            return {
                'total_monthly_cost_usd': total_cost,
                'instance_breakdown': instance_breakdown,
                'currency': 'USD'
            }
            
        except Exception as e:
            logger.error("AWS 비용 계산 실패", error=str(e))
            return None
    
    def _calculate_ncp_costs(self, hardware_spec: HardwareSpecification) -> Dict[str, Any]:
        """NCP 비용 계산"""
        try:
            total_cost = 0
            instance_breakdown = []
            
            all_servers = (hardware_spec.gpu_servers + 
                          hardware_spec.cpu_servers + 
                          hardware_spec.infrastructure_servers)
            
            for server in all_servers:
                cpu_cores = server['cpu_cores']
                ram_gb = server['ram_gb']
                gpu_count = server.get('gpu_per_server', 0)
                count = server['count']
                
                # NCP 인스턴스 찾기
                suitable_instance = self.ncp_mapper.find_suitable_instance(
                    cpu_cores, ram_gb, gpu_count
                )
                
                if suitable_instance:
                    monthly_cost = suitable_instance.monthly_cost_krw * count
                    total_cost += monthly_cost
                    
                    instance_breakdown.append({
                        'server_type': server['type'],
                        'count': count,
                        'ncp_instance': suitable_instance.instance_type,
                        'monthly_cost_krw': monthly_cost
                    })
            
            return {
                'total_monthly_cost_krw': total_cost,
                'instance_breakdown': instance_breakdown,
                'currency': 'KRW'
            }
            
        except Exception as e:
            logger.error("NCP 비용 계산 실패", error=str(e))
            return None
    
    def _calculate_msp_costs(self, aws_cost: Optional[Dict], ncp_cost: Optional[Dict]) -> Dict[str, Any]:
        """MSP 비용 계산"""
        try:
            msp_costs = {}
            
            if aws_cost:
                aws_monthly_usd = aws_cost['total_monthly_cost_usd']
                msp_costs['aws'] = {
                    'economy': self.msp_calculator.calculate_aws_msp(aws_monthly_usd, 'economy'),
                    'standard': self.msp_calculator.calculate_aws_msp(aws_monthly_usd, 'standard'),
                    'premium': self.msp_calculator.calculate_aws_msp(aws_monthly_usd, 'premium')
                }
            
            if ncp_cost:
                ncp_monthly_krw = ncp_cost['total_monthly_cost_krw']
                msp_costs['ncp'] = {
                    'basic': self.msp_calculator.calculate_ncp_msp(ncp_monthly_krw, 'basic'),
                    'standard': self.msp_calculator.calculate_ncp_msp(ncp_monthly_krw, 'standard'),
                    'premium': self.msp_calculator.calculate_ncp_msp(ncp_monthly_krw, 'premium')
                }
            
            return msp_costs
            
        except Exception as e:
            logger.error("MSP 비용 계산 실패", error=str(e))
            return {}
    
    def _fallback_calculation(self, service_requirements: Dict[str, int], gpu_type: str) -> EnhancedResourceCalculation:
        """폴백 계산 (기존 엔진 사용 불가 시)"""
        logger.warning("폴백 모드로 리소스 계산")
        
        # 간단한 계산 로직
        total_channels = sum(v for k, v in service_requirements.items() if k in ['callbot', 'advisor', 'stt', 'tts'])
        total_users = service_requirements.get('chatbot', 0)
        
        return EnhancedResourceCalculation(
            gpu={'tts': 1, 'nlp': 2, 'aicm': 1, 'total': 4},
            cpu={'stt': 8, 'ta': 2, 'qa': 1, 'infrastructure': 20, 'total': 31},
            network={'total': 1.0},
            storage={'total': 2.0},
            infrastructure={'nginx': 4, 'gateway': 8, 'database': 16, 'auth_service': 4},
            stt_channels=total_channels,
            tts_channels=service_requirements.get('callbot', 0),
            nlp_daily_queries=total_channels * 1000,
            aicm_daily_queries=total_channels * 100,
            ta_daily_processing=service_requirements.get('ta', 0),
            qa_daily_evaluations=service_requirements.get('qa', 0),
            stt_breakdown={'callbot': service_requirements.get('callbot', 0)},
            nlp_breakdown={'total': total_channels * 1000},
            aicm_breakdown={'total': total_channels * 100},
            infra_breakdown={'total_channels': total_channels}
        )
    
    def _fallback_hardware_spec(self, service_requirements: Dict[str, int], gpu_type: str) -> DetailedHardwareSpec:
        """폴백 하드웨어 사양 (기존 엔진 사용 불가 시)"""
        logger.warning("폴백 모드로 하드웨어 사양 생성")
        
        return DetailedHardwareSpec(
            gpu_servers=[{
                'type': f'TTS 서버 ({gpu_type.upper()})',
                'count': 1,
                'cpu_cores': 32,
                'ram_gb': 64,
                'storage_nvme_tb': 0.5,
                'gpu_per_server': 1,
                'purpose': '기본 TTS 서비스'
            }],
            cpu_servers=[{
                'type': 'STT 서버 (64코어)',
                'count': 1,
                'cpu_cores': 64,
                'ram_gb': 128,
                'storage_ssd_tb': 0.5,
                'purpose': '기본 STT 서비스'
            }],
            storage_servers=[],
            infrastructure_servers=[{
                'type': 'PostgreSQL 서버 (32코어)',
                'count': 1,
                'cpu_cores': 32,
                'ram_gb': 128,
                'storage_ssd_tb': 1.0,
                'purpose': '기본 데이터베이스'
            }],
            total_servers=3,
            total_cpu_cores=128,
            total_ram_gb=320,
            total_storage_tb=2.0,
            total_gpu_count=1,
            network_requirements="1 Gbps",
            infrastructure_notes="기본 구성"
        )
    
    def compare_cloud_options(self, service_requirements: Dict[str, int], gpu_type: str = "t4") -> Dict[str, Any]:
        """클라우드 옵션 비교 분석"""
        try:
            # 상세 하드웨어 사양 생성
            hardware_spec = self.generate_detailed_hardware_spec(
                service_requirements, gpu_type, include_cloud_mapping=True
            )
            
            comparison = {
                'hardware_summary': {
                    'total_servers': hardware_spec.total_servers,
                    'total_cpu_cores': hardware_spec.total_cpu_cores,
                    'total_ram_gb': hardware_spec.total_ram_gb,
                    'total_gpu_count': hardware_spec.total_gpu_count,
                    'total_storage_tb': hardware_spec.total_storage_tb
                },
                'aws_analysis': hardware_spec.aws_cost_analysis,
                'ncp_analysis': hardware_spec.ncp_cost_analysis,
                'msp_analysis': hardware_spec.msp_cost_analysis,
                'recommendation': self._generate_recommendation(hardware_spec)
            }
            
            return comparison
            
        except Exception as e:
            logger.error("클라우드 옵션 비교 실패", error=str(e))
            return {'error': str(e)}
    
    def _generate_recommendation(self, hardware_spec: DetailedHardwareSpec) -> Dict[str, str]:
        """권장사항 생성"""
        recommendations = {
            'gpu_recommendation': '',
            'cost_recommendation': '',
            'deployment_recommendation': ''
        }
        
        # GPU 권장사항
        if hardware_spec.total_gpu_count <= 2:
            recommendations['gpu_recommendation'] = 'T4 GPU 권장 (비용 효율적)'
        elif hardware_spec.total_gpu_count <= 8:
            recommendations['gpu_recommendation'] = 'V100 GPU 권장 (성능 균형)'
        else:
            recommendations['gpu_recommendation'] = 'L40S GPU 권장 (고성능)'
        
        # 비용 권장사항
        if hardware_spec.aws_cost_analysis and hardware_spec.ncp_cost_analysis:
            aws_cost = hardware_spec.aws_cost_analysis.get('total_monthly_cost_usd', 0)
            ncp_cost = hardware_spec.ncp_cost_analysis.get('total_monthly_cost_krw', 0)
            ncp_cost_usd = ncp_cost / 1300  # 대략적인 환율
            
            if ncp_cost_usd < aws_cost * 0.8:
                recommendations['cost_recommendation'] = 'NCP 권장 (비용 절감)'
            else:
                recommendations['cost_recommendation'] = 'AWS 권장 (안정성)'
        
        # 배포 권장사항
        if hardware_spec.total_servers > 10:
            recommendations['deployment_recommendation'] = '단계적 배포 권장 (대규모 환경)'
        else:
            recommendations['deployment_recommendation'] = '일괄 배포 가능 (소규모 환경)'
        
        return recommendations
