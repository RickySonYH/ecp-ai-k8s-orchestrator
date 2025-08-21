"""
AWS Instance Mapper
AWS 인스턴스 타입 매핑 및 비용 계산 모듈
"""

import json
import os
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass

@dataclass
class AWSInstance:
    """AWS 인스턴스 정보"""
    instance_type: str
    vcpu: int
    memory_gb: float
    gpu_count: int
    gpu_type: str
    monthly_cost_usd: float
    category: str

@dataclass
class AWSCostAnalysis:
    """AWS 비용 분석 결과"""
    total_monthly_cost: float
    instance_breakdown: List[Dict[str, Any]]
    cost_by_category: Dict[str, float]

class AWSInstanceMapper:
    """AWS 인스턴스 매핑 및 비용 계산 클래스"""
    
    def __init__(self):
        self.instances = self._load_aws_instances()
        self.logger = logging.getLogger(__name__)
    
    def _load_aws_instances(self) -> Dict[str, AWSInstance]:
        """AWS 인스턴스 데이터 로드"""
        try:
            config_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'aws_instances.json')
            with open(config_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            instances = {}
            for instance_type, specs in data.items():
                instances[instance_type] = AWSInstance(
                    instance_type=instance_type,
                    vcpu=specs['vcpu'],
                    memory_gb=specs['memory_gb'],
                    gpu_count=specs.get('gpu_count', 0),
                    gpu_type=specs.get('gpu_type', ''),
                    monthly_cost_usd=specs['monthly_cost_usd'],
                    category=specs['category']
                )
            
            return instances
        except Exception as e:
            self.logger.error(f"AWS 인스턴스 데이터 로드 실패: {e}")
            return {}
    
    def find_best_match(self, required_vcpu: int, required_memory: float, 
                       gpu_required: bool = False, gpu_count: int = 0) -> tuple[Optional[AWSInstance], str]:
        """요구사항에 가장 적합한 AWS 인스턴스 찾기"""
        
        suitable_instances = []
        
        for instance in self.instances.values():
            # 기본 요구사항 확인
            if instance.vcpu >= required_vcpu and instance.memory_gb >= required_memory:
                # GPU 요구사항 확인
                if gpu_required:
                    if instance.gpu_count >= gpu_count:
                        suitable_instances.append(instance)
                else:
                    # GPU가 필요없는 경우, GPU 인스턴스는 제외
                    if instance.gpu_count == 0:
                        suitable_instances.append(instance)
        
        if not suitable_instances:
            # 정확히 일치하는 인스턴스가 없으면 가장 유사한 인스턴스 찾기
            closest_instance = self._find_closest_match(required_vcpu, required_memory, gpu_required, gpu_count)
            return closest_instance, "유사 매칭" if closest_instance else "매핑 실패"
        
        # 비용 효율성 기준으로 정렬 (비용 대비 성능)
        suitable_instances.sort(key=lambda x: x.monthly_cost_usd)
        
        return suitable_instances[0], "정확 매칭"
    
    def _find_closest_match(self, required_vcpu: int, required_memory: float, 
                           gpu_required: bool = False, gpu_count: int = 0) -> Optional[AWSInstance]:
        """요구사항에 가장 유사한 AWS 인스턴스 찾기 (정확한 매칭 실패 시)"""
        
        best_match = None
        best_score = float('inf')
        
        for instance in self.instances.values():
            # GPU 요구사항 체크
            if gpu_required and instance.gpu_count == 0:
                continue
            if not gpu_required and instance.gpu_count > 0:
                continue
                
            # 유사도 점수 계산 (낮을수록 좋음)
            cpu_diff = abs(instance.vcpu - required_vcpu)
            memory_diff = abs(instance.memory_gb - required_memory)
            gpu_diff = abs(instance.gpu_count - gpu_count) if gpu_required else 0
            
            # 가중 점수 계산 (CPU 30%, Memory 40%, GPU 30%)
            score = (cpu_diff * 0.3) + (memory_diff * 0.4) + (gpu_diff * 0.3)
            
            # 너무 작은 인스턴스는 페널티 (최소 요구사항의 80% 이상)
            if instance.vcpu < required_vcpu * 0.8 or instance.memory_gb < required_memory * 0.8:
                score += 1000  # 큰 페널티
            
            if score < best_score:
                best_score = score
                best_match = instance
        
        return best_match
    
    def map_hardware_to_aws(self, hardware_specs: List[Dict[str, Any]]) -> AWSCostAnalysis:
        """하드웨어 사양을 AWS 인스턴스로 매핑하고 비용 분석"""
        
        instance_breakdown = []
        cost_by_category = {}
        total_cost = 0.0
        
        for server in hardware_specs:
            server_role = server.get('server_role', 'Unknown')
            cpu_cores = server.get('cpu_cores', 0)
            ram_gb = server.get('ram_gb', 0)
            gpu_count = server.get('gpu_count', 0)
            quantity = server.get('quantity', 1)
            
            # GPU 서버인지 확인
            gpu_required = gpu_count > 0
            
            # 적합한 AWS 인스턴스 찾기
            aws_instance, match_status = self.find_best_match(
                required_vcpu=cpu_cores,
                required_memory=ram_gb,
                gpu_required=gpu_required,
                gpu_count=gpu_count
            )
            
            if aws_instance:
                monthly_cost = aws_instance.monthly_cost_usd * quantity
                total_cost += monthly_cost
                
                # 카테고리별 비용 집계
                category = aws_instance.category
                if category not in cost_by_category:
                    cost_by_category[category] = 0.0
                cost_by_category[category] += monthly_cost
                
                instance_breakdown.append({
                    'server_role': server_role,
                    'original_specs': {
                        'cpu_cores': cpu_cores,
                        'ram_gb': ram_gb,
                        'gpu_count': gpu_count
                    },
                    'aws_instance': {
                        'instance_type': aws_instance.instance_type,
                        'vcpu': aws_instance.vcpu,
                        'memory_gb': aws_instance.memory_gb,
                        'gpu_count': aws_instance.gpu_count,
                        'gpu_type': aws_instance.gpu_type
                    },
                    'quantity': quantity,
                    'monthly_cost_per_instance': aws_instance.monthly_cost_usd,
                    'total_monthly_cost': monthly_cost,
                    'category': category,
                    'match_status': match_status
                })
            else:
                self.logger.warning(f"적합한 AWS 인스턴스를 찾을 수 없음: {server_role} (CPU: {cpu_cores}, RAM: {ram_gb}GB, GPU: {gpu_count})")
                
                # 매칭되지 않은 서버도 기록
                instance_breakdown.append({
                    'server_role': server_role,
                    'original_specs': {
                        'cpu_cores': cpu_cores,
                        'ram_gb': ram_gb,
                        'gpu_count': gpu_count
                    },
                    'aws_instance': None,
                    'quantity': quantity,
                    'monthly_cost_per_instance': 0.0,
                    'total_monthly_cost': 0.0,
                    'category': 'Unmapped'
                })
        
        return AWSCostAnalysis(
            total_monthly_cost=total_cost,
            instance_breakdown=instance_breakdown,
            cost_by_category=cost_by_category
        )

def generate_aws_cost_analysis(hardware_specs: List[Dict[str, Any]]) -> Dict[str, Any]:
    """하드웨어 사양에 대한 AWS 비용 분석 생성"""
    
    mapper = AWSInstanceMapper()
    analysis = mapper.map_hardware_to_aws(hardware_specs)
    
    return {
        'total_monthly_cost_usd': analysis.total_monthly_cost,
        'total_annual_cost_usd': analysis.total_monthly_cost * 12,
        'instance_breakdown': analysis.instance_breakdown,
        'cost_by_category': analysis.cost_by_category,
        'currency': 'USD',
        'analysis_date': '2024-12-19'
    }
