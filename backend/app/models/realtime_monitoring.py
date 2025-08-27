# [advice from AI] ECP-AI 실시간 모니터링 데이터 생성기
"""
실시간 모니터링 데이터 생성 및 관리
- 시스템 전체 메트릭 실시간 생성
- 테넌시별 리소스 사용률 시뮬레이션
- 주기적 데이터 업데이트 및 저장
"""

import asyncio
import random
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from dataclasses import dataclass
import json

logger = logging.getLogger(__name__)

@dataclass
class SystemMetrics:
    """시스템 전체 메트릭"""
    total_tenants: int
    total_services: int
    total_gpu_usage: float
    total_cpu_usage: float
    total_memory_usage: float
    total_storage_usage: float
    system_health: str
    active_connections: int
    network_throughput: float
    timestamp: datetime

@dataclass
class TenantMetrics:
    """테넌시별 메트릭"""
    tenant_id: str
    name: str
    preset: str
    status: str
    cpu_usage: float
    memory_usage: float
    gpu_usage: float
    storage_usage: float
    network_io: float
    # [advice from AI] 채널 기반 서비스 요구사항 요약
    service_summary: Dict[str, int]  # {"callbot": 30, "chatbot": 100, "stt": 2, "tts": 3}
    total_channels: int
    total_services: int
    response_time: float
    error_rate: float
    timestamp: datetime

@dataclass
class ServiceMetrics:
    """서비스별 메트릭"""
    service_name: str
    tenant_id: str
    instance_count: int
    cpu_usage: float
    memory_usage: float
    gpu_usage: float
    status: str
    response_time: float
    error_count: int
    timestamp: datetime

class RealtimeMonitoringGenerator:
    """실시간 모니터링 데이터 생성기"""
    
    def __init__(self):
        self.system_metrics_history: List[SystemMetrics] = []
        self.tenant_metrics_history: Dict[str, List[TenantMetrics]] = {}
        self.service_metrics_history: Dict[str, List[ServiceMetrics]] = {}
        self.is_running = False
        self.update_interval = 5  # 5초마다 업데이트
        
        # 시뮬레이션 패턴 설정
        self.simulation_patterns = {
            'cpu': {'base': 45.0, 'variation': 25.0, 'pattern': 'sine'},
            'memory': {'base': 60.0, 'variation': 20.0, 'pattern': 'stable'},
            'gpu': {'base': 70.0, 'variation': 30.0, 'pattern': 'spike'},
            'network': {'base': 150.0, 'variation': 50.0, 'pattern': 'random'},
            'storage': {'base': 40.0, 'variation': 15.0, 'pattern': 'gradual'}
        }
    
    def generate_sine_wave(self, base: float, variation: float, time_factor: float) -> float:
        """사인파 패턴으로 메트릭 생성"""
        import math
        sine_value = math.sin(time_factor * 0.1) * 0.5 + 0.5
        return base + (sine_value - 0.5) * variation * 2
    
    def generate_spike_pattern(self, base: float, variation: float, time_factor: float) -> float:
        """스파이크 패턴으로 메트릭 생성"""
        if random.random() < 0.1:  # 10% 확률로 스파이크
            return min(100.0, base + variation * 2)
        return base + random.uniform(-variation * 0.5, variation * 0.5)
    
    def generate_stable_pattern(self, base: float, variation: float, time_factor: float) -> float:
        """안정적 패턴으로 메트릭 생성"""
        return base + random.uniform(-variation * 0.3, variation * 0.3)
    
    def generate_random_pattern(self, base: float, variation: float, time_factor: float) -> float:
        """랜덤 패턴으로 메트릭 생성"""
        return base + random.uniform(-variation, variation)
    
    def generate_gradual_pattern(self, base: float, variation: float, time_factor: float) -> float:
        """점진적 변화 패턴으로 메트릭 생성"""
        trend = (time_factor % 100) / 100  # 0~1 사이의 트렌드
        return base + (trend - 0.5) * variation
    
    def generate_metric_value(self, metric_type: str, base: float, variation: float, time_factor: float) -> float:
        """메트릭 타입에 따른 값 생성"""
        pattern = self.simulation_patterns[metric_type]['pattern']
        
        if pattern == 'sine':
            return self.generate_sine_wave(base, variation, time_factor)
        elif pattern == 'spike':
            return self.generate_spike_pattern(base, variation, time_factor)
        elif pattern == 'stable':
            return self.generate_stable_pattern(base, variation, time_factor)
        elif pattern == 'random':
            return self.generate_random_pattern(base, variation, time_factor)
        elif pattern == 'gradual':
            return self.generate_gradual_pattern(base, variation, time_factor)
        else:
            return base + random.uniform(-variation, variation)
    
    def generate_system_metrics(self, tenant_count: int, time_factor: float) -> SystemMetrics:
        """시스템 전체 메트릭 생성"""
        # GPU 사용률 (전체 시스템)
        total_gpu_usage = self.generate_metric_value('gpu', 70.0, 25.0, time_factor)
        
        # CPU 사용률 (전체 시스템)
        total_cpu_usage = self.generate_metric_value('cpu', 55.0, 20.0, time_factor)
        
        # 메모리 사용률 (전체 시스템)
        total_memory_usage = self.generate_metric_value('memory', 65.0, 15.0, time_factor)
        
        # 스토리지 사용률 (전체 시스템)
        total_storage_usage = self.generate_metric_value('storage', 45.0, 10.0, time_factor)
        
        # 시스템 건강도 결정
        if total_cpu_usage > 90 or total_memory_usage > 90 or total_gpu_usage > 95:
            system_health = 'critical'
        elif total_cpu_usage > 80 or total_memory_usage > 80 or total_gpu_usage > 85:
            system_health = 'warning'
        else:
            system_health = 'healthy'
        
        # 네트워크 처리량
        network_throughput = self.generate_metric_value('network', 200.0, 60.0, time_factor)
        
        # 활성 연결 수
        active_connections = int(tenant_count * random.uniform(8, 15))
        
        return SystemMetrics(
            total_tenants=tenant_count,
            total_services=tenant_count * random.randint(3, 6),
            total_gpu_usage=max(0, min(100, total_gpu_usage)),
            total_cpu_usage=max(0, min(100, total_cpu_usage)),
            total_memory_usage=max(0, min(100, total_memory_usage)),
            total_storage_usage=max(0, min(100, total_storage_usage)),
            system_health=system_health,
            active_connections=active_connections,
            network_throughput=max(0, network_throughput),
            timestamp=datetime.now()
        )
    
    def generate_tenant_metrics(self, tenant_id: str, time_factor: float, tenant_info: dict = None) -> TenantMetrics:
        """테넌시별 메트릭 생성 - 채널 기반 서비스 요구사항 포함"""
        # CPU 사용률
        cpu_usage = self.generate_metric_value('cpu', 50.0, 30.0, time_factor)
        
        # 메모리 사용률
        memory_usage = self.generate_metric_value('memory', 60.0, 25.0, time_factor)
        
        # GPU 사용률
        gpu_usage = self.generate_metric_value('gpu', 65.0, 35.0, time_factor)
        
        # 스토리지 사용률
        storage_usage = self.generate_metric_value('storage', 45.0, 20.0, time_factor)
        
        # 네트워크 I/O
        network_io = self.generate_metric_value('network', 120.0, 40.0, time_factor)
        
        # [advice from AI] 채널 기반 서비스 요구사항 시뮬레이션
        if tenant_info and 'service_requirements' in tenant_info:
            service_summary = tenant_info['service_requirements']
        else:
            # 기본 서비스 요구사항 시뮬레이션
            service_summary = {
                'callbot': random.randint(10, 50),
                'chatbot': random.randint(20, 100),
                'advisor': random.randint(5, 30),
                'stt': random.randint(1, 5),
                'tts': random.randint(1, 5),
                'ta': random.randint(1, 3),
                'qa': random.randint(1, 3)
            }
        
        # 총 채널 수 계산
        total_channels = sum([
            service_summary.get('callbot', 0),
            service_summary.get('chatbot', 0),
            service_summary.get('advisor', 0)
        ])
        
        # 총 서비스 수 계산 (인스턴스가 필요한 서비스들)
        total_services = sum([
            service_summary.get('stt', 0),
            service_summary.get('tts', 0),
            service_summary.get('ta', 0),
            service_summary.get('qa', 0)
        ])
        
        # 응답 시간
        response_time = random.uniform(50, 300)
        
        # 에러율
        error_rate = random.uniform(0, 2)
        
        return TenantMetrics(
            tenant_id=tenant_id,
            name=tenant_info.get('name', f'테넌시 {tenant_id}') if tenant_info else f'테넌시 {tenant_id}',
            preset=tenant_info.get('preset', 'medium') if tenant_info else 'medium',
            status=tenant_info.get('status', 'running') if tenant_info else 'running',
            cpu_usage=max(0, min(100, cpu_usage)),
            memory_usage=max(0, min(100, memory_usage)),
            gpu_usage=max(0, min(100, gpu_usage)),
            storage_usage=max(0, min(100, storage_usage)),
            network_io=max(0, network_io),
            service_summary=service_summary,
            total_channels=total_channels,
            total_services=total_services,
            response_time=response_time,
            error_rate=error_rate,
            timestamp=datetime.now()
        )
    
    def generate_service_metrics(self, service_name: str, tenant_id: str, time_factor: float) -> ServiceMetrics:
        """서비스별 메트릭 생성"""
        # 인스턴스 수
        instance_count = random.randint(1, 5)
        
        # CPU 사용률
        cpu_usage = self.generate_metric_value('cpu', 45.0, 25.0, time_factor)
        
        # 메모리 사용률
        memory_usage = self.generate_metric_value('memory', 55.0, 20.0, time_factor)
        
        # GPU 사용률
        gpu_usage = self.generate_metric_value('gpu', 60.0, 30.0, time_factor)
        
        # 상태
        status = 'running' if random.random() > 0.05 else 'warning'
        
        # 응답 시간
        response_time = random.uniform(30, 200)
        
        # 에러 수
        error_count = random.randint(0, 3)
        
        return ServiceMetrics(
            service_name=service_name,
            tenant_id=tenant_id,
            instance_count=instance_count,
            cpu_usage=max(0, min(100, cpu_usage)),
            memory_usage=max(0, min(100, memory_usage)),
            gpu_usage=max(0, min(100, gpu_usage)),
            status=status,
            response_time=response_time,
            error_count=error_count,
            timestamp=datetime.now()
        )
    
    async def start_monitoring(self, tenant_ids: List[str]):
        """모니터링 시작"""
        if self.is_running:
            return
        
        self.is_running = True
        logger.info("실시간 모니터링 시작")
        
        time_factor = 0
        while self.is_running:
            try:
                # 시스템 전체 메트릭 생성
                system_metrics = self.generate_system_metrics(len(tenant_ids), time_factor)
                self.system_metrics_history.append(system_metrics)
                
                # 최근 100개만 유지
                if len(self.system_metrics_history) > 100:
                    self.system_metrics_history = self.system_metrics_history[-100:]
                
                # 테넌시별 메트릭 생성
                for tenant_id in tenant_ids:
                    # [advice from AI] 실제 테넌시 정보 조회하여 메트릭 생성
                    tenant_info = self.get_tenant_info(tenant_id)
                    tenant_metrics = self.generate_tenant_metrics(tenant_id, time_factor, tenant_info)
                    
                    if tenant_id not in self.tenant_metrics_history:
                        self.tenant_metrics_history[tenant_id] = []
                    
                    self.tenant_metrics_history[tenant_id].append(tenant_metrics)
                    
                    # 최근 50개만 유지
                    if len(self.tenant_metrics_history[tenant_id]) > 50:
                        self.tenant_metrics_history[tenant_id] = self.tenant_metrics_history[tenant_id][-50:]
                    
                    # 서비스별 메트릭 생성 (실제 서비스 요구사항 기반)
                    if tenant_info and 'service_requirements' in tenant_info:
                        service_requirements = tenant_info['service_requirements']
                        for service_name, count in service_requirements.items():
                            if count > 0:  # 실제 사용되는 서비스만
                                service_metrics = self.generate_service_metrics(service_name, tenant_id, time_factor)
                                service_key = f"{tenant_id}_{service_name}"
                                
                                if service_key not in self.service_metrics_history:
                                    self.service_metrics_history[service_key] = []
                                
                                self.service_metrics_history[service_key].append(service_metrics)
                                
                                # 최근 30개만 유지
                                if len(self.service_metrics_history[service_key]) > 30:
                                    self.service_metrics_history[service_key] = self.service_metrics_history[service_key][-30:]
                
                time_factor += 1
                await asyncio.sleep(self.update_interval)
                
            except Exception as e:
                logger.error(f"모니터링 데이터 생성 중 오류: {e}")
                await asyncio.sleep(self.update_interval)
    
    def stop_monitoring(self):
        """모니터링 중지"""
        self.is_running = False
        logger.info("실시간 모니터링 중지")
    
    def get_latest_system_metrics(self) -> Optional[SystemMetrics]:
        """최신 시스템 메트릭 반환"""
        if self.system_metrics_history:
            return self.system_metrics_history[-1]
        return None
    
    def get_latest_tenant_metrics(self, tenant_id: str) -> Optional[TenantMetrics]:
        """최신 테넌시 메트릭 반환"""
        if tenant_id in self.tenant_metrics_history and self.tenant_metrics_history[tenant_id]:
            return self.tenant_metrics_history[tenant_id][-1]
        return None
    
    def get_latest_service_metrics(self, tenant_id: str, service_name: str) -> Optional[ServiceMetrics]:
        """최신 서비스 메트릭 반환"""
        service_key = f"{tenant_id}_{service_name}"
        if service_key in self.service_metrics_history and self.service_metrics_history[service_key]:
            return self.service_metrics_history[service_key][-1]
        return None
    
    def get_metrics_history(self, metric_type: str, tenant_id: str = None, service_name: str = None, 
                           limit: int = 20) -> List[Dict]:
        """메트릭 히스토리 반환"""
        if metric_type == 'system':
            return [self._metrics_to_dict(m) for m in self.system_metrics_history[-limit:]]
        elif metric_type == 'tenant' and tenant_id:
            if tenant_id in self.tenant_metrics_history:
                return [self._metrics_to_dict(m) for m in self.tenant_metrics_history[tenant_id][-limit:]]
        elif metric_type == 'service' and tenant_id and service_name:
            service_key = f"{tenant_id}_{service_name}"
            if service_key in self.service_metrics_history:
                return [self._metrics_to_dict(m) for m in self.service_metrics_history[service_key][-limit:]]
        
        return []
    
    def get_tenant_info(self, tenant_id: str) -> Optional[Dict]:
        """테넌시 정보 조회 (데모/운영 DB에서)"""
        try:
            # 데모 DB에서 먼저 조회
            from app.models.demo_database import DemoSessionLocal, DemoTenant
            demo_db = DemoSessionLocal()
            
            try:
                demo_tenant = demo_db.query(DemoTenant).filter(DemoTenant.tenant_id == tenant_id).first()
                if demo_tenant:
                    return {
                        'name': demo_tenant.name,
                        'preset': demo_tenant.preset,
                        'status': demo_tenant.status,
                        'service_requirements': {
                            'callbot': 30,  # 기본값 (실제로는 DB에서 조회)
                            'chatbot': 100,
                            'advisor': 20,
                            'stt': 2,
                            'tts': 3,
                            'ta': 1,
                            'qa': 1
                        }
                    }
            finally:
                demo_db.close()
            
            # 운영 DB에서 조회
            from app.models.database import SessionLocal, Tenant
            prod_db = SessionLocal()
            
            try:
                prod_tenant = prod_db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
                if prod_tenant:
                    return {
                        'name': prod_tenant.name,
                        'preset': prod_tenant.preset,
                        'status': prod_tenant.status,
                        'service_requirements': prod_tenant.service_requirements or {}
                    }
            finally:
                prod_db.close()
                
        except Exception as e:
            logger.error(f"테넌시 정보 조회 실패: {e}")
        
        return None

    def create_service_monitoring_agent(self, tenant_id: str, service_name: str, service_count: int, hardware_specs: Dict):
        """[advice from AI] 서비스별 모니터링 에이전트 생성 - 하드웨어 스펙 기반"""
        try:
            # 서비스별 리소스 할당 계산
            cpu_per_service = hardware_specs["cpu_cores"] / len(hardware_specs["services"])
            memory_per_service = hardware_specs["memory_gb"] / len(hardware_specs["services"])
            gpu_per_service = hardware_specs["gpu_count"] / len(hardware_specs["services"]) if hardware_specs["gpu_count"] > 0 else 0
            
            # 서비스 타입별 기본 메트릭 범위 설정
            service_metrics = {
                "callbot": {"cpu": (20, 70), "memory": (30, 80), "requests": (100, 500)},
                "chatbot": {"cpu": (15, 60), "memory": (25, 75), "requests": (200, 800)},
                "advisor": {"cpu": (25, 75), "memory": (35, 85), "requests": (50, 300)},
                "stt": {"cpu": (30, 80), "memory": (40, 90), "requests": (80, 400)},
                "tts": {"cpu": (35, 85), "memory": (45, 95), "requests": (60, 350), "gpu": (20, 90)},
                "ta": {"cpu": (20, 65), "memory": (30, 70), "requests": (40, 200)},
                "qa": {"cpu": (25, 70), "memory": (35, 80), "requests": (30, 150)}
            }
            
            # 기본값 설정
            default_metrics = {"cpu": (20, 70), "memory": (30, 80), "requests": (50, 300)}
            metrics_range = service_metrics.get(service_name, default_metrics)
            
            # 모니터링 에이전트 데이터 생성
            agent_data = {
                "tenant_id": tenant_id,
                "service_name": service_name,
                "service_count": service_count,
                "allocated_cpu": cpu_per_service,
                "allocated_memory": memory_per_service,
                "allocated_gpu": gpu_per_service,
                "metrics_range": metrics_range,
                "hardware_specs": hardware_specs,
                "created_at": datetime.now(),
                "last_updated": datetime.now()
            }
            
            # 메모리에 저장 (실제 운영에서는 Redis나 DB에 저장)
            if not hasattr(self, '_service_agents'):
                self._service_agents = {}
            
            agent_key = f"{tenant_id}:{service_name}"
            self._service_agents[agent_key] = agent_data
            
            logger.info(f"[Monitoring Agent] 서비스 '{service_name}' 모니터링 에이전트 생성 완료", 
                       tenant_id=tenant_id, 
                       service_count=service_count,
                       allocated_resources={
                           "cpu": cpu_per_service, 
                           "memory": memory_per_service, 
                           "gpu": gpu_per_service
                       })
            
            return True
            
        except Exception as e:
            logger.error(f"서비스 모니터링 에이전트 생성 실패: {e}", 
                        tenant_id=tenant_id, 
                        service_name=service_name)
            return False

    def get_service_monitoring_data(self, tenant_id: str, service_name: str = None) -> Dict:
        """[advice from AI] 서비스별 모니터링 데이터 조회"""
        try:
            if not hasattr(self, '_service_agents'):
                return {}
            
            if service_name:
                # 특정 서비스 데이터 조회
                agent_key = f"{tenant_id}:{service_name}"
                agent_data = self._service_agents.get(agent_key)
                if agent_data:
                    return self._generate_service_metrics(agent_data)
            else:
                # 테넌시의 모든 서비스 데이터 조회
                tenant_services = {}
                for key, agent_data in self._service_agents.items():
                    if key.startswith(f"{tenant_id}:"):
                        service_name = key.split(":", 1)[1]
                        tenant_services[service_name] = self._generate_service_metrics(agent_data)
                return tenant_services
                
            return {}
            
        except Exception as e:
            logger.error(f"서비스 모니터링 데이터 조회 실패: {e}")
            return {}

    def _generate_service_metrics(self, agent_data: Dict) -> Dict:
        """[advice from AI] 에이전트 데이터 기반 실시간 메트릭 생성"""
        try:
            import random
            metrics_range = agent_data["metrics_range"]
            
            # 현재 시간 기준 메트릭 생성
            current_time = datetime.now()
            
            metrics = {
                "service_name": agent_data["service_name"],
                "tenant_id": agent_data["tenant_id"],
                "service_count": agent_data["service_count"],
                "allocated_resources": {
                    "cpu": agent_data["allocated_cpu"],
                    "memory": agent_data["allocated_memory"],
                    "gpu": agent_data.get("allocated_gpu", 0)
                },
                "current_metrics": {
                    "cpu_usage": round(random.uniform(*metrics_range["cpu"]), 2),
                    "memory_usage": round(random.uniform(*metrics_range["memory"]), 2),
                    "requests_per_minute": random.randint(*metrics_range["requests"]),
                    "response_time_ms": random.randint(50, 300),
                    "error_rate": round(random.uniform(0, 2.5), 3)
                },
                "timestamp": current_time.isoformat()
            }
            
            # GPU 사용 서비스인 경우 GPU 메트릭 추가
            if "gpu" in metrics_range:
                metrics["current_metrics"]["gpu_usage"] = round(random.uniform(*metrics_range["gpu"]), 2)
                metrics["current_metrics"]["gpu_memory_usage"] = round(random.uniform(20, 85), 2)
            
            return metrics
            
        except Exception as e:
            logger.error(f"서비스 메트릭 생성 실패: {e}")
            return {}

    def _metrics_to_dict(self, metrics) -> Dict:
        """메트릭 객체를 딕셔너리로 변환"""
        if hasattr(metrics, '__dict__'):
            result = {}
            for key, value in metrics.__dict__.items():
                if isinstance(value, datetime):
                    result[key] = value.isoformat()
                else:
                    result[key] = value
            return result
        return {}

# 전역 모니터링 인스턴스
monitoring_generator = RealtimeMonitoringGenerator()
