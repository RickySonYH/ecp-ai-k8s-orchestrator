"""
MSP Service Calculator
MSP(Managed Service Provider) 서비스 비용 계산 모듈
"""

import json
import os
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass

@dataclass
class MSPService:
    """MSP 서비스 정보"""
    name: str
    percentage: int
    monthly_minimum_krw: int
    features: List[str]
    description: str

@dataclass
class MSPCostAnalysis:
    """MSP 비용 분석 결과"""
    aws_msp_cost: float
    ncp_msp_cost: float
    aws_total_cost: float  # 인프라 + MSP
    ncp_total_cost: float  # 인프라 + MSP
    selected_aws_level: str
    selected_ncp_level: str
    cost_breakdown: Dict[str, Any]

class MSPCalculator:
    """MSP 서비스 비용 계산 클래스"""
    
    def __init__(self):
        self.msp_services = self._load_msp_services()
        self.logger = logging.getLogger(__name__)
    
    def _load_msp_services(self) -> Dict[str, Any]:
        """MSP 서비스 데이터 로드"""
        try:
            config_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'msp_services.json')
            with open(config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            self.logger.error(f"MSP 서비스 데이터 로드 실패: {e}")
            return {}
    
    def calculate_msp_costs(self, aws_monthly_cost_krw: float, ncp_monthly_cost_krw: float, 
                           aws_level: str = "standard", ncp_level: str = "standard") -> MSPCostAnalysis:
        """MSP 서비스 비용 계산"""
        
        # AWS MSP 비용 계산
        aws_msp_service = self.msp_services.get('aws_managed_services', {}).get(aws_level, {})
        aws_percentage = aws_msp_service.get('percentage', 30)
        aws_minimum = aws_msp_service.get('monthly_minimum_krw', 1200000)
        
        aws_msp_cost = max(aws_monthly_cost_krw * (aws_percentage / 100), aws_minimum)
        aws_total_cost = aws_monthly_cost_krw + aws_msp_cost
        
        # NCP MSP 비용 계산
        ncp_msp_service = self.msp_services.get('ncp_managed_services', {}).get(ncp_level, {})
        ncp_percentage = ncp_msp_service.get('percentage', 20)
        ncp_minimum = ncp_msp_service.get('monthly_minimum_krw', 1500000)
        
        ncp_msp_cost = max(ncp_monthly_cost_krw * (ncp_percentage / 100), ncp_minimum)
        ncp_total_cost = ncp_monthly_cost_krw + ncp_msp_cost
        
        # 상세 분석
        cost_breakdown = {
            'aws': {
                'infrastructure': aws_monthly_cost_krw,
                'msp': aws_msp_cost,
                'total': aws_total_cost,
                'msp_percentage': aws_percentage,
                'minimum_applied': aws_msp_cost == aws_minimum,
                'service_details': aws_msp_service
            },
            'ncp': {
                'infrastructure': ncp_monthly_cost_krw,
                'msp': ncp_msp_cost,
                'total': ncp_total_cost,
                'msp_percentage': ncp_percentage,
                'minimum_applied': ncp_msp_cost == ncp_minimum,
                'service_details': ncp_msp_service
            }
        }
        
        return MSPCostAnalysis(
            aws_msp_cost=aws_msp_cost,
            ncp_msp_cost=ncp_msp_cost,
            aws_total_cost=aws_total_cost,
            ncp_total_cost=ncp_total_cost,
            selected_aws_level=aws_level,
            selected_ncp_level=ncp_level,
            cost_breakdown=cost_breakdown
        )
    
    def get_available_service_levels(self) -> Dict[str, Any]:
        """사용 가능한 MSP 서비스 레벨 반환"""
        return {
            'aws_levels': list(self.msp_services.get('aws_managed_services', {}).keys()),
            'ncp_levels': list(self.msp_services.get('ncp_managed_services', {}).keys()),
            'aws_services': self.msp_services.get('aws_managed_services', {}),
            'ncp_services': self.msp_services.get('ncp_managed_services', {})
        }

def generate_msp_cost_analysis(aws_monthly_cost_krw: float, ncp_monthly_cost_krw: float, 
                              aws_level: str = "standard", ncp_level: str = "standard") -> Dict[str, Any]:
    """MSP 비용 분석 생성"""
    
    calculator = MSPCalculator()
    analysis = calculator.calculate_msp_costs(aws_monthly_cost_krw, ncp_monthly_cost_krw, aws_level, ncp_level)
    
    return {
        'aws_msp_cost_krw': analysis.aws_msp_cost,
        'ncp_msp_cost_krw': analysis.ncp_msp_cost,
        'aws_total_cost_krw': analysis.aws_total_cost,
        'ncp_total_cost_krw': analysis.ncp_total_cost,
        'aws_annual_total_krw': analysis.aws_total_cost * 12,
        'ncp_annual_total_krw': analysis.ncp_total_cost * 12,
        'selected_levels': {
            'aws': analysis.selected_aws_level,
            'ncp': analysis.selected_ncp_level
        },
        'cost_breakdown': analysis.cost_breakdown,
        'savings': {
            'monthly_difference': abs(analysis.aws_total_cost - analysis.ncp_total_cost),
            'cheaper_provider': 'AWS' if analysis.aws_total_cost < analysis.ncp_total_cost else 'NCP',
            'percentage_difference': abs(analysis.aws_total_cost - analysis.ncp_total_cost) / min(analysis.aws_total_cost, analysis.ncp_total_cost) * 100
        }
    }
