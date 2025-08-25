# [advice from AI] 하드웨어 배치 위치 제안 시스템
"""
매니페스트 생성 후 하드웨어 배치 위치를 제안하는 시스템
- 노드 그룹별 최적 배치 추천
- 리소스 밸런싱 및 네트워크 최적화
- 가용성 향상을 위한 배치 전략
"""

import math
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
import structlog

from app.models.tenant_specs import (
    HardwareNode, ServicePlacementRecommendation, ClusterTopology, 
    HardwarePlacementPlan, TenantSpecs
)

logger = structlog.get_logger(__name__)


class HardwarePlacementAdvisor:
    """하드웨어 배치 위치 제안 시스템"""
    
    def __init__(self):
        self.node_types = {
            "gpu": ["gpu-node-1", "gpu-node-2", "gpu-node-3"],
            "cpu": ["cpu-node-1", "cpu-node-2", "cpu-node-3", "cpu-node-4"],
            "storage": ["storage-node-1", "storage-node-2"],
            "infrastructure": ["infra-node-1", "infra-node-2"]
        }
        
        self.zones = ["us-west-1a", "us-west-1b", "us-west-1c"]
        
        # 노드별 기본 용량 설정
        self.node_capacities = {
            "gpu": {
                "cpu": "32",  # 32 cores
                "memory": "128Gi",
                "gpu": "4",   # 4 GPUs
                "storage": "2Ti"
            },
            "cpu": {
                "cpu": "64",  # 64 cores
                "memory": "256Gi",
                "gpu": "0",   # No GPU
                "storage": "1Ti"
            },
            "storage": {
                "cpu": "16",  # 16 cores
                "memory": "64Gi",
                "gpu": "0",   # No GPU
                "storage": "10Ti"
            },
            "infrastructure": {
                "cpu": "8",   # 8 cores
                "memory": "32Gi",
                "gpu": "0",   # No GPU
                "storage": "500Gi"
            }
        }
    
    def generate_placement_plan(self, 
                               tenant_specs: TenantSpecs,
                               manifest_data: Dict[str, Any]) -> HardwarePlacementPlan:
        """
        테넌시별 하드웨어 배치 계획 생성
        """
        try:
            logger.info("하드웨어 배치 계획 생성 시작", tenant_id=tenant_specs.tenant_id)
            
            # 1. 클러스터 토폴로지 분석
            cluster_topology = self._analyze_cluster_topology()
            
            # 2. 서비스별 배치 추천 생성
            service_placements = self._generate_service_placements(tenant_specs, manifest_data)
            
            # 3. 리소스 최적화 분석
            resource_optimization = self._analyze_resource_optimization(service_placements, cluster_topology)
            
            # 4. 네트워크 최적화 분석
            network_optimization = self._analyze_network_optimization(service_placements, cluster_topology)
            
            # 5. 가용성 점수 계산
            availability_score = self._calculate_availability_score(service_placements, cluster_topology)
            
            # 6. 비용 최적화 분석
            cost_optimization = self._analyze_cost_optimization(service_placements, cluster_topology)
            
            # 7. 추가 권장사항 생성
            recommendations = self._generate_recommendations(service_placements, resource_optimization, network_optimization)
            
            placement_plan = HardwarePlacementPlan(
                tenant_id=tenant_specs.tenant_id,
                cluster_topology=cluster_topology,
                service_placements=service_placements,
                resource_optimization=resource_optimization,
                network_optimization=network_optimization,
                availability_score=availability_score,
                cost_optimization=cost_optimization,
                recommendations=recommendations
            )
            
            logger.info("하드웨어 배치 계획 생성 완료", 
                       tenant_id=tenant_specs.tenant_id,
                       availability_score=availability_score)
            
            return placement_plan
            
        except Exception as e:
            logger.error("하드웨어 배치 계획 생성 실패", error=str(e))
            return self._generate_fallback_plan(tenant_specs)
    
    def _analyze_cluster_topology(self) -> ClusterTopology:
        """클러스터 토폴로지 분석"""
        nodes = []
        
        # 각 노드 타입별로 노드 생성
        for node_type, node_names in self.node_types.items():
            for i, node_name in enumerate(node_names):
                zone = self.zones[i % len(self.zones)]
                
                node = HardwareNode(
                    node_name=node_name,
                    node_type=node_type,
                    zone=zone,
                    capacity=self.node_capacities[node_type],
                    current_usage={
                        "cpu": "0",
                        "memory": "0Gi",
                        "gpu": "0",
                        "storage": "0Gi"
                    },
                    available_resources=self.node_capacities[node_type].copy(),
                    labels={
                        "node-type": node_type,
                        "zone": zone,
                        "availability": "available"
                    },
                    taints=[]
                )
                nodes.append(node)
        
        # 노드 그룹별 분류
        node_groups = {}
        for node_type in self.node_types.keys():
            node_groups[node_type] = [n for n in nodes if n.node_type == node_type]
        
        # 리소스 분포 현황
        resource_distribution = {
            "total_cpu": sum(int(n.capacity["cpu"]) for n in nodes),
            "total_memory": sum(int(n.capacity["memory"].replace("Gi", "")) for n in nodes),
            "total_gpu": sum(int(n.capacity["gpu"]) for n in nodes),
            "total_storage": sum(int(n.capacity["storage"].replace("Ti", "000").replace("Gi", "")) for n in nodes)
        }
        
        return ClusterTopology(
            cluster_name="ecp-ai-cluster",
            total_nodes=len(nodes),
            node_groups=node_groups,
            zones=self.zones,
            resource_distribution=resource_distribution
        )
    
    def _generate_service_placements(self, 
                                   tenant_specs: TenantSpecs,
                                   manifest_data: Dict[str, Any]) -> List[ServicePlacementRecommendation]:
        """서비스별 배치 위치 추천 생성"""
        service_placements = []
        
        # 서비스별 배치 전략
        service_strategies = {
            "callbot": {
                "node_type": "gpu",
                "priority": 1,
                "reason": "GPU 기반 음성 처리 및 NLP 연산",
                "affinity": ["tts", "stt"],
                "anti_affinity": ["database", "redis"]
            },
            "chatbot": {
                "node_type": "gpu", 
                "priority": 2,
                "reason": "NLP 기반 대화 처리",
                "affinity": ["callbot"],
                "anti_affinity": ["database"]
            },
            "advisor": {
                "node_type": "gpu",
                "priority": 1,
                "reason": "AI 지식 관리 및 벡터 검색",
                "affinity": ["callbot", "chatbot"],
                "anti_affinity": ["database"]
            },
            "stt": {
                "node_type": "cpu",
                "priority": 3,
                "reason": "CPU 기반 음성 인식 처리",
                "affinity": ["callbot"],
                "anti_affinity": ["tts"]
            },
            "tts": {
                "node_type": "gpu",
                "priority": 2,
                "reason": "GPU 기반 음성 합성",
                "affinity": ["callbot"],
                "anti_affinity": ["stt"]
            },
            "ta": {
                "node_type": "cpu",
                "priority": 4,
                "reason": "CPU 기반 통계 분석",
                "affinity": [],
                "anti_affinity": ["qa"]
            },
            "qa": {
                "node_type": "cpu",
                "priority": 4,
                "reason": "CPU 기반 품질 평가",
                "affinity": [],
                "anti_affinity": ["ta"]
            }
        }
        
        # 각 서비스에 대해 배치 추천 생성
        for service_name, strategy in service_strategies.items():
            # 서비스가 활성화되어 있는지 확인
            if hasattr(tenant_specs, 'services') and tenant_specs.services:
                if service_name not in tenant_specs.services or tenant_specs.services[service_name] == 0:
                    continue
            
            # 추천 노드 선택
            recommended_nodes = self._select_recommended_nodes(
                service_name, strategy["node_type"], strategy["priority"]
            )
            
            # 어피니티 규칙 생성
            affinity_rules = self._generate_affinity_rules(strategy["affinity"])
            anti_affinity_rules = self._generate_anti_affinity_rules(strategy["anti_affinity"])
            
            # 리소스 요구사항 추정
            resource_requirements = self._estimate_resource_requirements(service_name, tenant_specs)
            
            placement = ServicePlacementRecommendation(
                service_name=service_name,
                recommended_nodes=recommended_nodes,
                placement_reason=strategy["reason"],
                resource_requirements=resource_requirements,
                affinity_rules=affinity_rules,
                anti_affinity_rules=anti_affinity_rules,
                priority=strategy["priority"]
            )
            
            service_placements.append(placement)
        
        return service_placements
    
    def _select_recommended_nodes(self, service_name: str, node_type: str, priority: int) -> List[str]:
        """서비스별 추천 노드 선택"""
        available_nodes = self.node_types.get(node_type, [])
        
        if not available_nodes:
            return []
        
        # 우선순위에 따른 노드 선택
        if priority <= 2:  # 높은 우선순위
            return available_nodes[:2]  # 상위 2개 노드
        elif priority <= 3:  # 중간 우선순위
            return available_nodes[1:3]  # 중간 2개 노드
        else:  # 낮은 우선순위
            return available_nodes[2:]  # 하위 노드들
    
    def _generate_affinity_rules(self, affinity_services: List[str]) -> Dict[str, Any]:
        """어피니티 규칙 생성"""
        if not affinity_services:
            return {}
        
        return {
            "podAffinity": {
                "preferredDuringSchedulingIgnoredDuringExecution": [
                    {
                        "weight": 100,
                        "podAffinityTerm": {
                            "labelSelector": {
                                "matchExpressions": [
                                    {
                                        "key": "app",
                                        "operator": "In",
                                        "values": affinity_services
                                    }
                                ]
                            },
                            "topologyKey": "kubernetes.io/hostname"
                        }
                    }
                ]
            }
        }
    
    def _generate_anti_affinity_rules(self, anti_affinity_services: List[str]) -> Dict[str, Any]:
        """안티어피니티 규칙 생성"""
        if not anti_affinity_services:
            return {}
        
        return {
            "podAntiAffinity": {
                "preferredDuringSchedulingIgnoredDuringExecution": [
                    {
                        "weight": 100,
                        "podAffinityTerm": {
                            "labelSelector": {
                                "matchExpressions": [
                                    {
                                        "key": "app",
                                        "operator": "In",
                                        "values": anti_affinity_services
                                    }
                                ]
                            },
                            "topologyKey": "kubernetes.io/hostname"
                        }
                    }
                ]
            }
        }
    
    def _estimate_resource_requirements(self, service_name: str, tenant_specs: TenantSpecs) -> Dict[str, Any]:
        """서비스별 리소스 요구사항 추정"""
        # 기본 리소스 요구사항
        base_requirements = {
            "callbot": {"cpu": "4000m", "memory": "8Gi", "gpu": "1"},
            "chatbot": {"cpu": "2000m", "memory": "4Gi", "gpu": "1"},
            "advisor": {"cpu": "3000m", "memory": "6Gi", "gpu": "1"},
            "stt": {"cpu": "4000m", "memory": "8Gi", "gpu": "0"},
            "tts": {"cpu": "2000m", "memory": "4Gi", "gpu": "1"},
            "ta": {"cpu": "2000m", "memory": "4Gi", "gpu": "0"},
            "qa": {"cpu": "1000m", "memory": "2Gi", "gpu": "0"}
        }
        
        base_req = base_requirements.get(service_name, {"cpu": "1000m", "memory": "2Gi", "gpu": "0"})
        
        # 채널 수에 따른 스케일링
        if hasattr(tenant_specs, 'services') and tenant_specs.services:
            channel_count = tenant_specs.services.get(service_name, 0)
            if channel_count > 0:
                scaling_factor = min(3.0, 1.0 + (channel_count / 100.0))
                
                # CPU와 메모리 스케일링
                cpu_m = int(float(base_req["cpu"].replace("m", "")) * scaling_factor)
                memory_gi = int(float(base_req["memory"].replace("Gi", "")) * scaling_factor)
                
                base_req["cpu"] = f"{cpu_m}m"
                base_req["memory"] = f"{memory_gi}Gi"
        
        return base_req
    
    def _analyze_resource_optimization(self, 
                                     service_placements: List[ServicePlacementRecommendation],
                                     cluster_topology: ClusterTopology) -> Dict[str, Any]:
        """리소스 최적화 분석"""
        total_cpu_requested = 0
        total_memory_requested = 0
        total_gpu_requested = 0
        
        for placement in service_placements:
            req = placement.resource_requirements
            total_cpu_requested += int(req["cpu"].replace("m", "")) / 1000  # m to cores
            total_memory_requested += int(req["memory"].replace("Gi", ""))  # Gi
            total_gpu_requested += int(req["gpu"])
        
        cluster_capacity = cluster_topology.resource_distribution
        
        optimization_score = 0
        recommendations = []
        
        # CPU 최적화
        cpu_utilization = (total_cpu_requested / cluster_capacity["total_cpu"]) * 100
        if cpu_utilization > 80:
            recommendations.append("⚠️ CPU 사용률이 높습니다. 노드 추가를 고려하세요.")
            optimization_score -= 20
        elif cpu_utilization < 30:
            recommendations.append("💡 CPU 사용률이 낮습니다. 리소스 통합을 고려하세요.")
            optimization_score += 10
        
        # GPU 최적화
        gpu_utilization = (total_gpu_requested / cluster_capacity["total_gpu"]) * 100
        if gpu_utilization > 90:
            recommendations.append("🚨 GPU 사용률이 매우 높습니다. 즉시 GPU 노드 추가가 필요합니다.")
            optimization_score -= 30
        elif gpu_utilization < 50:
            recommendations.append("💡 GPU 사용률이 낮습니다. GPU 서비스를 더 적극적으로 활용하세요.")
            optimization_score += 15
        
        return {
            "cpu_utilization": round(cpu_utilization, 1),
            "memory_utilization": round((total_memory_requested / cluster_capacity["total_memory"]) * 100, 1),
            "gpu_utilization": round(gpu_utilization, 1),
            "optimization_score": max(0, min(100, 50 + optimization_score)),
            "recommendations": recommendations
        }
    
    def _analyze_network_optimization(self, 
                                    service_placements: List[ServicePlacementRecommendation],
                                    cluster_topology: ClusterTopology) -> Dict[str, Any]:
        """네트워크 최적화 분석"""
        # 서비스 간 통신 패턴 분석
        communication_patterns = {
            "callbot": ["tts", "stt", "advisor"],
            "chatbot": ["advisor"],
            "advisor": ["callbot", "chatbot"],
            "tts": ["callbot"],
            "stt": ["callbot"]
        }
        
        network_score = 100
        recommendations = []
        
        # 같은 노드에 배치된 서비스들 확인
        node_placements = {}
        for placement in service_placements:
            for node in placement.recommended_nodes:
                if node not in node_placements:
                    node_placements[node] = []
                node_placements[node].append(placement.service_name)
        
        # 네트워크 최적화 점수 계산
        for node, services in node_placements.items():
            if len(services) > 1:
                # 같은 노드에 배치된 서비스들 간의 통신이 많은지 확인
                for service in services:
                    if service in communication_patterns:
                        for target in communication_patterns[service]:
                            if target in services:
                                network_score += 10  # 같은 노드에 있으면 네트워크 지연 감소
                                break
        
        # 가용 영역 분산 확인
        zone_distribution = {}
        for placement in service_placements:
            for node in placement.recommended_nodes:
                # 노드의 가용 영역 확인
                for node_group in cluster_topology.node_groups.values():
                    for cluster_node in node_group:
                        if cluster_node.node_name == node:
                            zone = cluster_node.zone
                            zone_distribution[zone] = zone_distribution.get(zone, 0) + 1
                            break
        
        if len(zone_distribution) >= 2:
            network_score += 20  # 여러 가용 영역에 분산되어 있으면 가용성 향상
            recommendations.append("✅ 서비스가 여러 가용 영역에 분산되어 가용성이 향상됩니다.")
        else:
            recommendations.append("⚠️ 서비스가 단일 가용 영역에 집중되어 있습니다. 장애 위험이 있습니다.")
            network_score -= 15
        
        return {
            "network_score": min(100, max(0, network_score)),
            "zone_distribution": zone_distribution,
            "recommendations": recommendations
        }
    
    def _calculate_availability_score(self, 
                                    service_placements: List[ServicePlacementRecommendation],
                                    cluster_topology: ClusterTopology) -> float:
        """가용성 점수 계산"""
        base_score = 70.0
        
        # 노드 분산도
        unique_nodes = set()
        for placement in service_placements:
            unique_nodes.update(placement.recommended_nodes)
        
        node_diversity = len(unique_nodes) / len(service_placements)
        if node_diversity > 0.8:
            base_score += 15  # 노드 분산도가 높음
        elif node_diversity < 0.5:
            base_score -= 10  # 노드 분산도가 낮음
        
        # 가용 영역 분산도
        zones_used = set()
        for node_name in unique_nodes:
            for node_group in cluster_topology.node_groups.values():
                for node in node_group:
                    if node.node_name == node_name:
                        zones_used.add(node.zone)
                        break
        
        zone_diversity = len(zones_used) / len(cluster_topology.zones)
        if zone_diversity > 0.8:
            base_score += 15  # 가용 영역 분산도가 높음
        elif zone_diversity < 0.5:
            base_score -= 10  # 가용 영역 분산도가 낮음
        
        return min(100.0, max(0.0, base_score))
    
    def _analyze_cost_optimization(self, 
                                 service_placements: List[ServicePlacementRecommendation],
                                 cluster_topology: ClusterTopology) -> Dict[str, Any]:
        """비용 최적화 분석"""
        # 노드 타입별 비용 (월 기준, 예시)
        node_costs = {
            "gpu": 500,      # GPU 노드: $500/월
            "cpu": 200,      # CPU 노드: $200/월
            "storage": 150,  # 스토리지 노드: $150/월
            "infrastructure": 100  # 인프라 노드: $100/월
        }
        
        # 사용된 노드 타입별 비용 계산
        used_node_types = set()
        for placement in service_placements:
            for node in placement.recommended_nodes:
                for node_type, nodes in self.node_types.items():
                    if node in nodes:
                        used_node_types.add(node_type)
                        break
        
        total_monthly_cost = sum(node_costs.get(node_type, 0) for node_type in used_node_types)
        
        # 비용 최적화 권장사항
        cost_recommendations = []
        if "gpu" in used_node_types and len([p for p in service_placements if "gpu" in p.recommended_nodes]) > 2:
            cost_recommendations.append("💡 GPU 노드 사용량이 많습니다. GPU 공유를 고려하세요.")
        
        if "cpu" in used_node_types and len([p for p in service_placements if "cpu" in p.recommended_nodes]) > 3:
            cost_recommendations.append("💡 CPU 노드 사용량이 많습니다. 리소스 통합을 고려하세요.")
        
        return {
            "total_monthly_cost": total_monthly_cost,
            "used_node_types": list(used_node_types),
            "cost_per_service": round(total_monthly_cost / len(service_placements), 2),
            "recommendations": cost_recommendations
        }
    
    def _generate_recommendations(self, 
                                service_placements: List[ServicePlacementRecommendation],
                                resource_optimization: Dict[str, Any],
                                network_optimization: Dict[str, Any]) -> List[str]:
        """종합 권장사항 생성"""
        recommendations = []
        
        # 리소스 최적화 권장사항
        if resource_optimization.get("cpu_utilization", 0) > 80:
            recommendations.append("🚨 CPU 사용률이 높습니다. 노드 추가 또는 서비스 분산을 고려하세요.")
        
        if resource_optimization.get("gpu_utilization", 0) > 90:
            recommendations.append("🚨 GPU 사용률이 매우 높습니다. 즉시 GPU 노드 추가가 필요합니다.")
        
        # 네트워크 최적화 권장사항
        if network_optimization.get("network_score", 0) < 70:
            recommendations.append("⚠️ 네트워크 최적화가 필요합니다. 서비스 배치를 재검토하세요.")
        
        # 일반적인 권장사항
        recommendations.append("✅ 정기적인 리소스 사용량 모니터링을 권장합니다.")
        recommendations.append("✅ HPA(Horizontal Pod Autoscaler) 설정으로 자동 스케일링을 고려하세요.")
        recommendations.append("✅ 백업 및 재해 복구 전략을 수립하세요.")
        
        return recommendations
    
    def _generate_fallback_plan(self, tenant_specs: TenantSpecs) -> HardwarePlacementPlan:
        """폴백 배치 계획 생성"""
        logger.warning("폴백 배치 계획 생성", tenant_id=tenant_specs.tenant_id)
        
        return HardwarePlacementPlan(
            tenant_id=tenant_specs.tenant_id,
            cluster_topology=ClusterTopology(
                cluster_name="fallback-cluster",
                total_nodes=0,
                node_groups={},
                zones=[],
                resource_distribution={}
            ),
            service_placements=[],
            resource_optimization={},
            network_optimization={},
            availability_score=0.0,
            cost_optimization={},
            recommendations=["⚠️ 배치 계획 생성에 실패했습니다. 기본 설정을 사용하세요."]
        )
