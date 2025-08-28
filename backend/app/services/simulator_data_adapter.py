# [advice from AI] K8S Simulator 데이터를 ECP 고급 모니터링 형식으로 변환하는 어댑터
"""
K8S Simulator Data Adapter

K8S Simulator에서 생성되는 메트릭 데이터를 
ECP-AI Orchestrator의 고급 모니터링 형식으로 변환합니다.

주요 기능:
1. 데이터 형식 변환 (필드명, 타입, 구조)
2. 서비스별 → 테넌트별 데이터 집계
3. 실시간 메트릭 스트림 변환
4. SLA 메트릭 계산 및 변환
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass
import httpx
import websockets

logger = logging.getLogger(__name__)

@dataclass
class ECPMetricPoint:
    """ECP 고급 모니터링용 메트릭 포인트"""
    time: str           # "14:30:25" 형식
    timestamp: int      # Unix timestamp (ms)
    cpu: float         # 0-100%
    memory: float      # 0-100%
    gpu: float         # 0-100%
    network: float     # MB/s
    requests: int      # requests/sec
    errors: int        # error count
    responseTime: float # ms

@dataclass
class ECPTenantMetric:
    """ECP 테넌트 비교용 메트릭"""
    name: str
    id: str
    preset: str
    cpu: float              # usage %
    memory: float           # usage %
    gpu: float             # usage %
    availability: float     # 99.x%
    responseTime: float     # ms
    throughput: int         # req/s
    errors: int            # error count
    status: str            # 'healthy'|'warning'|'critical'

@dataclass
class ECPSLAMetric:
    """ECP SLA 트렌드용 메트릭"""
    time: str
    timestamp: int
    availability: float     # 99.x%
    responseTime: float     # ms
    errorRate: float       # %
    throughput: int        # req/s

class SimulatorDataAdapter:
    """K8S Simulator 데이터 어댑터"""
    
    def __init__(self, simulator_url: str = "http://localhost:6360"):
        self.simulator_url = simulator_url
        self.tenant_service_mapping = {}  # tenant_id -> [service_names]
        self.preset_mapping = {
            'micro': {'cpu': 0.5, 'memory': 512, 'gpu': 0},
            'small': {'cpu': 1.0, 'memory': 1024, 'gpu': 1},
            'medium': {'cpu': 2.0, 'memory': 2048, 'gpu': 2},
            'large': {'cpu': 4.0, 'memory': 4096, 'gpu': 4}
        }
    
    async def get_simulator_metrics(self) -> Dict[str, Any]:
        """K8S Simulator에서 현재 메트릭 조회"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.simulator_url}/monitoring/metrics")
                if response.status_code == 200:
                    return response.json()
                else:
                    logger.error(f"Failed to get simulator metrics: {response.status_code}")
                    return {}
        except Exception as e:
            logger.error(f"Error fetching simulator metrics: {e}")
            return {}
    
    async def get_simulator_history(self, hours: int = 1) -> Dict[str, Any]:
        """K8S Simulator에서 메트릭 히스토리 조회"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.simulator_url}/monitoring/metrics/history",
                    params={"hours": hours}
                )
                if response.status_code == 200:
                    return response.json()
                else:
                    logger.error(f"Failed to get simulator history: {response.status_code}")
                    return {}
        except Exception as e:
            logger.error(f"Error fetching simulator history: {e}")
            return {}
    
    def convert_to_ecp_realtime_data(self, simulator_data: Dict[str, Any]) -> List[ECPMetricPoint]:
        """Simulator 데이터를 ECP 실시간 데이터로 변환"""
        if not simulator_data or 'services' not in simulator_data:
            return []
        
        # 현재 시간 기준으로 최근 60분간의 데이터 포인트 생성
        current_time = datetime.now()
        data_points = []
        
        # Simulator 서비스들의 평균값 계산
        services = simulator_data['services']
        service_count = len([s for s in services.keys() if s != 'cluster'])
        
        if service_count == 0:
            return []
        
        # 집계된 메트릭 계산
        total_cpu = sum(
            service.get('cpu', {}).get('usage_percent', 0) 
            for service in services.values() 
            if isinstance(service, dict) and 'cpu' in service
        )
        total_memory = sum(
            service.get('memory', {}).get('usage_percent', 0) 
            for service in services.values() 
            if isinstance(service, dict) and 'memory' in service
        )
        total_requests = sum(
            service.get('network', {}).get('requests_per_second', 0) 
            for service in services.values() 
            if isinstance(service, dict) and 'network' in service
        )
        total_errors = sum(
            service.get('network', {}).get('requests_per_second', 0) * 
            service.get('network', {}).get('error_rate_percent', 0) / 100
            for service in services.values() 
            if isinstance(service, dict) and 'network' in service
        )
        avg_response_time = sum(
            service.get('network', {}).get('response_time_ms', 0) 
            for service in services.values() 
            if isinstance(service, dict) and 'network' in service
        ) / service_count if service_count > 0 else 0
        
        avg_cpu = total_cpu / service_count if service_count > 0 else 0
        avg_memory = total_memory / service_count if service_count > 0 else 0
        avg_gpu = avg_cpu * 0.8  # GPU는 CPU 사용률의 80%로 추정
        avg_network = total_requests * 0.5  # 네트워크는 RPS의 0.5MB/s로 추정
        
        # 60개 데이터 포인트 생성 (최근 1시간)
        for i in range(59, -1, -1):
            point_time = current_time - timedelta(minutes=i)
            
            # 시간대별 변동 추가
            time_factor = 1.0 + 0.2 * (i % 10 - 5) / 5  # ±20% 변동
            
            data_points.append(ECPMetricPoint(
                time=point_time.strftime("%H:%M:%S"),
                timestamp=int(point_time.timestamp() * 1000),
                cpu=max(0, min(100, avg_cpu * time_factor)),
                memory=max(0, min(100, avg_memory * time_factor)),
                gpu=max(0, min(100, avg_gpu * time_factor)),
                network=max(0, avg_network * time_factor),
                requests=int(max(0, total_requests * time_factor)),
                errors=int(max(0, total_errors * time_factor)),
                responseTime=max(0, avg_response_time * time_factor)
            ))
        
        return data_points
    
    def convert_to_ecp_tenant_data(
        self, 
        simulator_data: Dict[str, Any], 
        tenant_mapping: Dict[str, Dict[str, Any]] = None
    ) -> List[ECPTenantMetric]:
        """Simulator 데이터를 ECP 테넌트 비교 데이터로 변환"""
        if not simulator_data or 'services' not in simulator_data:
            return []
        
        services = simulator_data['services']
        tenant_metrics = []
        
        # 테넌트 매핑이 없으면 서비스를 테넌트로 간주
        if not tenant_mapping:
            tenant_mapping = {
                service_name: {
                    'name': service_name.replace('-', ' ').title(),
                    'preset': self._estimate_preset_from_service(service_data),
                    'id': f"tenant-{service_name}"
                }
                for service_name, service_data in services.items()
                if service_name != 'cluster' and isinstance(service_data, dict)
            }
        
        for service_name, service_data in services.items():
            if service_name == 'cluster' or not isinstance(service_data, dict):
                continue
            
            tenant_info = tenant_mapping.get(service_name, {
                'name': service_name,
                'preset': 'medium',
                'id': f"tenant-{service_name}"
            })
            
            # 메트릭 추출
            cpu_usage = service_data.get('cpu', {}).get('usage_percent', 0)
            memory_usage = service_data.get('memory', {}).get('usage_percent', 0)
            network = service_data.get('network', {})
            health = service_data.get('health', {})
            
            rps = network.get('requests_per_second', 0)
            error_rate = network.get('error_rate_percent', 0)
            response_time = network.get('response_time_ms', 0)
            
            # SLA 계산 (에러율 기반)
            availability = max(0, 100 - error_rate)
            
            # 상태 매핑
            status = health.get('status', 'healthy')
            if status not in ['healthy', 'warning', 'critical']:
                status = 'healthy' if availability >= 99.5 else 'warning' if availability >= 99.0 else 'critical'
            
            tenant_metrics.append(ECPTenantMetric(
                name=tenant_info['name'],
                id=tenant_info['id'],
                preset=tenant_info['preset'],
                cpu=round(cpu_usage, 2),
                memory=round(memory_usage, 2),
                gpu=round(cpu_usage * 0.8, 2),  # GPU는 CPU의 80%로 추정
                availability=round(availability, 2),
                responseTime=round(response_time, 2),
                throughput=int(rps),
                errors=int(rps * error_rate / 100),
                status=status
            ))
        
        return tenant_metrics
    
    def convert_to_ecp_sla_data(self, simulator_history: Dict[str, Any]) -> List[ECPSLAMetric]:
        """Simulator 히스토리를 ECP SLA 트렌드 데이터로 변환"""
        if not simulator_history or 'history' not in simulator_history:
            return []
        
        sla_metrics = []
        history = simulator_history['history']
        
        for entry in history[-24:]:  # 최근 24개 데이터포인트
            timestamp_str = entry.get('timestamp', '')
            data = entry.get('data', {})
            summary = data.get('summary', {})
            
            try:
                timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
            except:
                timestamp = datetime.now()
            
            availability = summary.get('sla_percentage', 99.5)
            avg_response_time = summary.get('average_response_time', 100)
            total_rps = summary.get('total_requests_per_second', 0)
            
            # 에러율 계산 (100 - availability)
            error_rate = max(0, 100 - availability)
            
            sla_metrics.append(ECPSLAMetric(
                time=timestamp.strftime("%H:00"),
                timestamp=int(timestamp.timestamp() * 1000),
                availability=round(availability, 2),
                responseTime=round(avg_response_time, 2),
                errorRate=round(error_rate, 4),
                throughput=int(total_rps)
            ))
        
        return sla_metrics
    
    def _estimate_preset_from_service(self, service_data: Dict[str, Any]) -> str:
        """서비스 데이터에서 프리셋 추정"""
        if not isinstance(service_data, dict):
            return 'medium'
        
        cpu_usage = service_data.get('cpu', {}).get('usage_percent', 50)
        memory_mb = service_data.get('memory', {}).get('usage_mb', 1024)
        replicas = service_data.get('replicas', {}).get('desired', 1)
        
        # 리소스 사용량과 replica 수를 기반으로 프리셋 추정
        if memory_mb < 512 and replicas <= 1:
            return 'micro'
        elif memory_mb < 1024 and replicas <= 2:
            return 'small'
        elif memory_mb < 2048 and replicas <= 3:
            return 'medium'
        else:
            return 'large'
    
    async def get_ecp_monitoring_data(
        self, 
        tenant_mapping: Dict[str, Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """ECP 고급 모니터링에서 사용할 수 있는 전체 데이터 반환"""
        try:
            # Simulator에서 현재 메트릭과 히스토리 동시 조회
            current_metrics, history_data = await asyncio.gather(
                self.get_simulator_metrics(),
                self.get_simulator_history(hours=24),
                return_exceptions=True
            )
            
            # 예외 처리
            if isinstance(current_metrics, Exception):
                logger.error(f"Error getting current metrics: {current_metrics}")
                current_metrics = {}
            
            if isinstance(history_data, Exception):
                logger.error(f"Error getting history: {history_data}")
                history_data = {}
            
            # 데이터 변환
            realtime_data = self.convert_to_ecp_realtime_data(current_metrics)
            tenant_data = self.convert_to_ecp_tenant_data(current_metrics, tenant_mapping)
            sla_data = self.convert_to_ecp_sla_data(history_data)
            
            # ECP 형식으로 반환
            return {
                "status": "success",
                "timestamp": datetime.now().isoformat(),
                "data": {
                    "realtime_metrics": [point.__dict__ for point in realtime_data],
                    "tenant_comparison": [tenant.__dict__ for tenant in tenant_data],
                    "sla_trends": [sla.__dict__ for sla in sla_data],
                    "alerts": self._generate_alerts_from_metrics(current_metrics)
                },
                "source": "k8s_simulator",
                "simulator_url": self.simulator_url
            }
        
        except Exception as e:
            logger.error(f"Error getting ECP monitoring data: {e}")
            return {
                "status": "error",
                "message": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def _generate_alerts_from_metrics(self, metrics_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """메트릭 데이터에서 알림 생성"""
        alerts = []
        
        if not metrics_data or 'services' not in metrics_data:
            return alerts
        
        services = metrics_data['services']
        current_time = datetime.now()
        
        for service_name, service_data in services.items():
            if service_name == 'cluster' or not isinstance(service_data, dict):
                continue
            
            # CPU 사용률 알림
            cpu_usage = service_data.get('cpu', {}).get('usage_percent', 0)
            if cpu_usage > 80:
                alerts.append({
                    "id": f"cpu-{service_name}",
                    "type": "warning" if cpu_usage < 90 else "error",
                    "message": f"CPU 사용률이 {cpu_usage:.1f}%로 높습니다",
                    "tenant": service_name,
                    "timestamp": current_time.isoformat(),
                    "resolved": False
                })
            
            # 메모리 사용률 알림
            memory_usage = service_data.get('memory', {}).get('usage_percent', 0)
            if memory_usage > 85:
                alerts.append({
                    "id": f"memory-{service_name}",
                    "type": "warning" if memory_usage < 95 else "error",
                    "message": f"메모리 사용률이 {memory_usage:.1f}%로 높습니다",
                    "tenant": service_name,
                    "timestamp": current_time.isoformat(),
                    "resolved": False
                })
            
            # 응답 시간 알림
            response_time = service_data.get('network', {}).get('response_time_ms', 0)
            if response_time > 200:
                alerts.append({
                    "id": f"response-{service_name}",
                    "type": "warning" if response_time < 500 else "error",
                    "message": f"응답 시간이 {response_time:.0f}ms로 지연되고 있습니다",
                    "tenant": service_name,
                    "timestamp": current_time.isoformat(),
                    "resolved": False
                })
            
            # 에러율 알림
            error_rate = service_data.get('network', {}).get('error_rate_percent', 0)
            if error_rate > 1.0:
                alerts.append({
                    "id": f"error-{service_name}",
                    "type": "warning" if error_rate < 5.0 else "error",
                    "message": f"에러율이 {error_rate:.2f}%로 증가했습니다",
                    "tenant": service_name,
                    "timestamp": current_time.isoformat(),
                    "resolved": False
                })
        
        return alerts

# 글로벌 인스턴스
simulator_adapter = SimulatorDataAdapter()

async def get_simulator_monitoring_data(tenant_mapping: Dict[str, Dict[str, Any]] = None) -> Dict[str, Any]:
    """K8S Simulator에서 ECP 고급 모니터링용 데이터 조회"""
    return await simulator_adapter.get_ecp_monitoring_data(tenant_mapping)
