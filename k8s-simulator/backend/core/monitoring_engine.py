# [advice from AI] 실제 서버 모니터링 데이터 모사기 - 실제 운영 환경과 유사한 메트릭 생성
import asyncio
import random
import time
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import logging
import math

logger = logging.getLogger(__name__)

@dataclass
class MetricPoint:
    """메트릭 데이터 포인트"""
    timestamp: datetime
    value: float
    unit: str
    tags: Dict[str, str] = None

class MonitoringEngine:
    """실제 서버 모니터링 데이터를 모사하는 엔진"""
    
    def __init__(self):
        self.running = False
        self.services = {}
        self.metrics_history = {}
        self.sla_target = 99.5  # 99.5% SLA 목표
        self.incident_scenarios = []
        self._init_default_services()
        self._init_incident_scenarios()
    
    def _init_default_services(self):
        """기본 서비스들 초기화 - 배포된 리소스 기반으로만 생성"""
        # [advice from AI] 기본 서비스 제거 - 실제 배포된 리소스만 모니터링
        self.services = {}
        logger.info("모니터링 엔진 초기화: 배포된 리소스만 모니터링합니다")
    
    def _init_incident_scenarios(self):
        """장애 시나리오 초기화"""
        self.incident_scenarios = [
            {
                "name": "cpu_spike",
                "probability": 0.001,  # 0.1% 확률
                "duration": 300,  # 5분
                "impact": {"cpu": 2.5, "response_time": 3.0, "error_rate": 10.0}
            },
            {
                "name": "memory_leak",
                "probability": 0.0005,  # 0.05% 확률
                "duration": 600,  # 10분
                "impact": {"memory": 1.8, "response_time": 2.0, "error_rate": 5.0}
            },
            {
                "name": "network_latency",
                "probability": 0.002,  # 0.2% 확률
                "duration": 180,  # 3분
                "impact": {"response_time": 4.0, "error_rate": 15.0}
            },
            {
                "name": "partial_outage",
                "probability": 0.0001,  # 0.01% 확률
                "duration": 120,  # 2분
                "impact": {"error_rate": 50.0, "response_time": 10.0}
            }
        ]
    
    async def start(self):
        """모니터링 엔진 시작"""
        self.running = True
        logger.info("Monitoring engine started")
    
    async def stop(self):
        """모니터링 엔진 정지"""
        self.running = False
        logger.info("Monitoring engine stopped")
    
    async def update_services_from_resources(self, deployed_resources: List[Dict[str, Any]]):
        """배포된 리소스를 기반으로 서비스 목록 업데이트"""
        # [advice from AI] 배포된 리소스에서 서비스 정보 추출
        new_services = {}
        
        for resource in deployed_resources:
            service_name = resource.get('name', 'unknown-service')
            resource_type = resource.get('kind', '').lower()
            
            # 리소스 타입에 따른 기본 설정
            if resource_type in ['deployment', 'statefulset']:
                service_config = self._create_service_config_from_resource(resource)
                new_services[service_name] = service_config
                logger.info(f"서비스 추가됨: {service_name} (타입: {resource_type})")
        
        self.services = new_services
        logger.info(f"총 {len(self.services)}개 서비스가 모니터링 대상으로 설정됨")
    
    def _create_service_config_from_resource(self, resource: Dict[str, Any]) -> Dict[str, Any]:
        """리소스 정보에서 서비스 설정 생성"""
        # 테넌트 매니페스트에서 추출한 정보 기반으로 서비스 설정 생성
        spec = resource.get('spec', {})
        replicas = spec.get('replicas', 1)
        
        # 컨테이너 리소스 요청량에서 베이스라인 추정
        containers = spec.get('template', {}).get('spec', {}).get('containers', [])
        cpu_baseline = 30.0  # 기본값
        memory_baseline = 512.0  # 기본값
        
        if containers:
            resources = containers[0].get('resources', {})
            requests = resources.get('requests', {})
            
            # CPU 요청량에서 베이스라인 추정 (예: 100m -> 10% 사용률)
            cpu_request = requests.get('cpu', '100m')
            if 'm' in str(cpu_request):
                cpu_baseline = float(str(cpu_request).replace('m', '')) / 10
            
            # 메모리 요청량에서 베이스라인 추정
            memory_request = requests.get('memory', '512Mi')
            if 'Mi' in str(memory_request):
                memory_baseline = float(str(memory_request).replace('Mi', ''))
        
        return {
            "type": "application",  # 테넌트 애플리케이션
            "replicas": replicas,
            "cpu_baseline": min(80, max(10, cpu_baseline)),  # 10-80% 범위
            "memory_baseline": memory_baseline,
            "requests_per_second": replicas * 50.0,  # replica당 50 RPS 추정
            "error_rate": 0.05,  # 기본 0.05% 오류율
            "response_time": 100.0  # 기본 100ms 응답시간
        }

    async def generate_metrics(self) -> Dict[str, Any]:
        """실제와 유사한 모니터링 메트릭 생성"""
        current_time = datetime.now()
        all_metrics = {}
        
        # [advice from AI] 배포된 서비스가 없으면 빈 메트릭 반환
        if not self.services:
            return {
                "timestamp": current_time.isoformat(),
                "services": {},
                "summary": {
                    "overall_health": "healthy",
                    "sla_percentage": 100.0,
                    "sla_status": "meeting",
                    "total_services": 0,
                    "healthy_services": 0,
                    "total_requests_per_second": 0.0,
                    "average_response_time": 0.0
                }
            }
        
        for service_name, service_config in self.services.items():
            # 시간대별 트래픽 패턴 시뮬레이션 (업무시간 vs 야간)
            hour = current_time.hour
            traffic_multiplier = self._get_traffic_multiplier(hour)
            
            # 장애 시나리오 적용 여부 확인
            incident_impact = self._check_incident_scenarios(service_name)
            
            # 기본 메트릭 생성
            metrics = await self._generate_service_metrics(
                service_name, 
                service_config, 
                traffic_multiplier,
                incident_impact
            )
            
            all_metrics[service_name] = metrics
        
        # 전체 클러스터 메트릭 생성
        cluster_metrics = await self._generate_cluster_metrics(all_metrics)
        all_metrics["cluster"] = cluster_metrics
        
        # 메트릭 히스토리에 저장
        self._store_metrics_history(current_time, all_metrics)
        
        return {
            "timestamp": current_time.isoformat(),
            "services": all_metrics,
            "summary": self._generate_summary_metrics(all_metrics)
        }
    
    def _get_traffic_multiplier(self, hour: int) -> float:
        """시간대별 트래픽 패턴 (실제 서비스 패턴과 유사)"""
        # 업무시간 (9-18시) 높은 트래픽, 야간 (22-6시) 낮은 트래픽
        if 9 <= hour <= 18:
            return 1.0 + 0.3 * math.sin((hour - 9) * math.pi / 9)  # 0.7 ~ 1.3
        elif 22 <= hour or hour <= 6:
            return 0.2 + 0.1 * random.random()  # 0.2 ~ 0.3
        else:
            return 0.5 + 0.3 * random.random()  # 0.5 ~ 0.8
    
    def _check_incident_scenarios(self, service_name: str) -> Dict[str, float]:
        """장애 시나리오 확인 및 적용"""
        impact = {}
        
        for scenario in self.incident_scenarios:
            if random.random() < scenario["probability"]:
                logger.warning(f"Incident '{scenario['name']}' triggered for {service_name}")
                impact.update(scenario["impact"])
                
                # 장애 지속 시간 후 자동 복구 스케줄링
                asyncio.create_task(
                    self._schedule_incident_recovery(service_name, scenario["duration"])
                )
        
        return impact
    
    async def _schedule_incident_recovery(self, service_name: str, duration: int):
        """장애 복구 스케줄링"""
        await asyncio.sleep(duration)
        logger.info(f"Incident recovery completed for {service_name}")
    
    async def _generate_service_metrics(
        self, 
        service_name: str, 
        config: Dict[str, Any], 
        traffic_multiplier: float,
        incident_impact: Dict[str, float]
    ) -> Dict[str, Any]:
        """개별 서비스 메트릭 생성"""
        
        # CPU 사용률 (실제 서버와 유사한 패턴)
        base_cpu = config["cpu_baseline"]
        cpu_variance = random.uniform(-10, 15)  # 자연스러운 변동
        cpu_usage = base_cpu + cpu_variance * traffic_multiplier
        cpu_usage *= incident_impact.get("cpu", 1.0)  # 장애 영향 적용
        cpu_usage = max(0, min(100, cpu_usage))  # 0-100% 범위 제한
        
        # 메모리 사용률
        base_memory = config["memory_baseline"]
        memory_variance = random.uniform(-50, 100)
        memory_usage = base_memory + memory_variance * traffic_multiplier
        memory_usage *= incident_impact.get("memory", 1.0)
        memory_usage = max(0, memory_usage)
        
        # 네트워크 메트릭
        base_rps = config["requests_per_second"]
        rps = base_rps * traffic_multiplier * random.uniform(0.8, 1.2)
        
        # 응답 시간 (ms)
        base_response_time = config["response_time"]
        response_time = base_response_time * random.uniform(0.7, 1.5)
        response_time *= incident_impact.get("response_time", 1.0)
        
        # 에러율 (%)
        base_error_rate = config["error_rate"]
        error_rate = base_error_rate + random.uniform(-0.01, 0.02)
        error_rate += incident_impact.get("error_rate", 0.0)
        error_rate = max(0, error_rate)
        
        # 디스크 I/O
        disk_read = random.uniform(10, 500) * traffic_multiplier  # MB/s
        disk_write = random.uniform(5, 200) * traffic_multiplier  # MB/s
        
        # 네트워크 I/O
        network_in = rps * random.uniform(1, 5)  # KB/s
        network_out = rps * random.uniform(2, 10)  # KB/s
        
        return {
            "cpu": {
                "usage_percent": round(cpu_usage, 2),
                "load_1m": round(cpu_usage / 100 * 4, 2),
                "load_5m": round(cpu_usage / 100 * 4 * 0.9, 2),
                "load_15m": round(cpu_usage / 100 * 4 * 0.8, 2)
            },
            "memory": {
                "usage_mb": round(memory_usage, 2),
                "usage_percent": round(memory_usage / (config["memory_baseline"] * 2) * 100, 2),
                "available_mb": round(config["memory_baseline"] * 2 - memory_usage, 2)
            },
            "network": {
                "requests_per_second": round(rps, 2),
                "response_time_ms": round(response_time, 2),
                "error_rate_percent": round(error_rate, 4),
                "bytes_in_per_sec": round(network_in * 1024, 0),
                "bytes_out_per_sec": round(network_out * 1024, 0)
            },
            "disk": {
                "read_mb_per_sec": round(disk_read, 2),
                "write_mb_per_sec": round(disk_write, 2),
                "usage_percent": round(random.uniform(40, 85), 2)
            },
            "replicas": {
                "desired": config["replicas"],
                "ready": config["replicas"] if error_rate < 1.0 else config["replicas"] - 1,
                "available": config["replicas"] if error_rate < 5.0 else config["replicas"] - 1
            },
            "health": {
                "status": "healthy" if error_rate < 1.0 and cpu_usage < 90 else "warning" if error_rate < 5.0 else "critical",
                "uptime_seconds": random.randint(3600, 86400 * 7)  # 1시간 ~ 7일
            }
        }
    
    async def _generate_cluster_metrics(self, service_metrics: Dict[str, Any]) -> Dict[str, Any]:
        """전체 클러스터 메트릭 생성"""
        total_cpu = 0
        total_memory = 0
        total_rps = 0
        total_errors = 0
        total_requests = 0
        healthy_services = 0
        total_services = len(service_metrics)
        
        for service_name, metrics in service_metrics.items():
            if service_name == "cluster":
                continue
                
            total_cpu += metrics["cpu"]["usage_percent"]
            total_memory += metrics["memory"]["usage_mb"]
            total_rps += metrics["network"]["requests_per_second"]
            
            rps = metrics["network"]["requests_per_second"]
            error_rate = metrics["network"]["error_rate_percent"]
            errors = rps * error_rate / 100
            total_errors += errors
            total_requests += rps
            
            if metrics["health"]["status"] == "healthy":
                healthy_services += 1
        
        avg_cpu = total_cpu / total_services if total_services > 0 else 0
        avg_memory = total_memory / total_services if total_services > 0 else 0
        overall_error_rate = (total_errors / total_requests * 100) if total_requests > 0 else 0
        
        return {
            "nodes": {
                "total": 5,
                "ready": 5 if overall_error_rate < 1.0 else 4,
                "cpu_usage_percent": round(avg_cpu, 2),
                "memory_usage_percent": round(avg_memory / 1024 * 100 / 8, 2)  # 8GB per node
            },
            "services": {
                "total": total_services,
                "healthy": healthy_services,
                "warning": total_services - healthy_services,
                "critical": 0 if overall_error_rate < 10 else 1
            },
            "traffic": {
                "total_rps": round(total_rps, 2),
                "total_error_rate": round(overall_error_rate, 4)
            }
        }
    
    def _generate_summary_metrics(self, all_metrics: Dict[str, Any]) -> Dict[str, Any]:
        """요약 메트릭 생성"""
        cluster = all_metrics.get("cluster", {})
        services = cluster.get("services", {})
        traffic = cluster.get("traffic", {})
        
        # SLA 계산 (에러율 기반)
        error_rate = traffic.get("total_error_rate", 0)
        availability = max(0, 100 - error_rate)
        
        return {
            "overall_health": "healthy" if availability >= 99.5 else "warning" if availability >= 99.0 else "critical",
            "sla_percentage": round(availability, 3),
            "sla_status": "meeting" if availability >= 99.5 else "at_risk" if availability >= 99.0 else "breached",
            "total_services": services.get("total", 0),
            "healthy_services": services.get("healthy", 0),
            "total_requests_per_second": traffic.get("total_rps", 0),
            "average_response_time": round(random.uniform(50, 150), 2)
        }
    
    def _store_metrics_history(self, timestamp: datetime, metrics: Dict[str, Any]):
        """메트릭 히스토리 저장 (메모리에 최근 1시간분만 보관)"""
        if "history" not in self.metrics_history:
            self.metrics_history["history"] = []
        
        self.metrics_history["history"].append({
            "timestamp": timestamp.isoformat(),
            "data": metrics
        })
        
        # 1시간(3600초) 이전 데이터 정리
        cutoff_time = timestamp - timedelta(hours=1)
        self.metrics_history["history"] = [
            entry for entry in self.metrics_history["history"]
            if datetime.fromisoformat(entry["timestamp"]) > cutoff_time
        ]
    
    async def check_sla(self) -> Dict[str, Any]:
        """SLA 상태 확인"""
        if not self.metrics_history.get("history"):
            return {"status": "insufficient_data", "percentage": 0.0}
        
        # 최근 1시간 데이터로 SLA 계산
        recent_data = self.metrics_history["history"][-60:]  # 최근 60개 데이터포인트
        
        total_points = len(recent_data)
        healthy_points = 0
        
        for entry in recent_data:
            summary = entry["data"].get("summary", {})
            if summary.get("overall_health") in ["healthy", "warning"]:
                healthy_points += 1
        
        availability = (healthy_points / total_points * 100) if total_points > 0 else 100.0
        
        return {
            "status": "meeting" if availability >= 99.5 else "at_risk" if availability >= 99.0 else "breached",
            "percentage": round(availability, 3),
            "target": self.sla_target,
            "data_points": total_points,
            "healthy_points": healthy_points
        }
