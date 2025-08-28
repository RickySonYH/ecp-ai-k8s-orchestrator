# [advice from AI] 실제 서버 모니터링 데이터 모사기 메인 애플리케이션
import asyncio
import logging
import os
import json
import time
import random
from datetime import datetime, timedelta
from typing import Dict, List, Any
import redis
import psycopg2
from psycopg2.extras import RealDictCursor
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MonitoringDataGenerator:
    """실제 서버 환경과 유사한 모니터링 데이터를 생성하는 클래스"""
    
    def __init__(self):
        self.redis_client = None
        self.db_connection = None
        self.running = False
        self.services = {
            "web-frontend": {
                "cpu_baseline": 45.0,
                "memory_baseline": 512.0,
                "disk_baseline": 20.0,
                "network_baseline": 100.0,
                "error_rate_baseline": 0.1
            },
            "api-backend": {
                "cpu_baseline": 65.0,
                "memory_baseline": 1024.0,
                "disk_baseline": 50.0,
                "network_baseline": 300.0,
                "error_rate_baseline": 0.05
            },
            "database": {
                "cpu_baseline": 80.0,
                "memory_baseline": 2048.0,
                "disk_baseline": 200.0,
                "network_baseline": 500.0,
                "error_rate_baseline": 0.01
            },
            "cache-redis": {
                "cpu_baseline": 25.0,
                "memory_baseline": 256.0,
                "disk_baseline": 5.0,
                "network_baseline": 1000.0,
                "error_rate_baseline": 0.001
            },
            "message-queue": {
                "cpu_baseline": 35.0,
                "memory_baseline": 512.0,
                "disk_baseline": 30.0,
                "network_baseline": 200.0,
                "error_rate_baseline": 0.02
            }
        }
    
    async def init_connections(self):
        """Redis 및 데이터베이스 연결 초기화"""
        try:
            # Redis 연결
            redis_url = os.getenv("REDIS_URL", "redis://localhost:6351")
            self.redis_client = redis.from_url(redis_url, decode_responses=True)
            
            # PostgreSQL 연결
            db_url = os.getenv("DATABASE_URL", "postgresql://k8s_user:k8s_password@localhost:6350/k8s_simulator")
            self.db_connection = psycopg2.connect(db_url)
            
            logger.info("Database connections initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize connections: {e}")
            return False
    
    async def start(self):
        """모니터링 데이터 생성 시작"""
        if not await self.init_connections():
            logger.error("Failed to start monitoring data generator")
            return
        
        self.running = True
        logger.info("Monitoring data generator started")
        
        # 백그라운드 태스크들 시작
        tasks = [
            asyncio.create_task(self.generate_realtime_metrics()),
            asyncio.create_task(self.generate_historical_data()),
            asyncio.create_task(self.simulate_incidents()),
            asyncio.create_task(self.cleanup_old_data())
        ]
        
        try:
            await asyncio.gather(*tasks)
        except Exception as e:
            logger.error(f"Monitoring data generator error: {e}")
        finally:
            self.running = False
    
    async def generate_realtime_metrics(self):
        """실시간 메트릭 데이터 생성"""
        while self.running:
            try:
                current_time = datetime.now()
                
                for service_name, config in self.services.items():
                    metrics = self._generate_service_metrics(service_name, config, current_time)
                    
                    # Redis에 실시간 데이터 저장
                    await self._store_realtime_metrics(service_name, metrics)
                    
                    # 데이터베이스에 히스토리 저장
                    await self._store_historical_metrics(service_name, metrics, current_time)
                
                # 5초마다 업데이트
                await asyncio.sleep(5)
                
            except Exception as e:
                logger.error(f"Realtime metrics generation error: {e}")
                await asyncio.sleep(10)
    
    def _generate_service_metrics(self, service_name: str, config: Dict[str, Any], timestamp: datetime) -> Dict[str, Any]:
        """개별 서비스의 실시간 메트릭 생성"""
        # 시간대별 트래픽 패턴
        hour = timestamp.hour
        traffic_multiplier = self._get_traffic_multiplier(hour)
        
        # 주간/주말 패턴
        weekday = timestamp.weekday()  # 0=Monday, 6=Sunday
        weekend_factor = 0.6 if weekday >= 5 else 1.0
        
        # 자연스러운 변동을 위한 노이즈
        noise_factor = np.random.normal(1.0, 0.1)  # 평균 1.0, 표준편차 0.1
        
        # CPU 메트릭
        base_cpu = config["cpu_baseline"]
        cpu_usage = base_cpu * traffic_multiplier * weekend_factor * noise_factor
        cpu_usage = max(5.0, min(95.0, cpu_usage))  # 5-95% 범위로 제한
        
        # 메모리 메트릭
        base_memory = config["memory_baseline"]
        memory_usage = base_memory * (1 + traffic_multiplier * 0.3) * noise_factor
        memory_usage = max(100.0, memory_usage)
        
        # 디스크 I/O
        base_disk = config["disk_baseline"]
        disk_read = base_disk * traffic_multiplier * random.uniform(0.5, 2.0)
        disk_write = disk_read * random.uniform(0.3, 0.8)
        
        # 네트워크 메트릭
        base_network = config["network_baseline"]
        requests_per_second = base_network * traffic_multiplier * weekend_factor * noise_factor
        requests_per_second = max(1.0, requests_per_second)
        
        # 응답 시간 (부하에 따라 증가)
        base_response_time = 50.0  # 기본 50ms
        load_factor = cpu_usage / 100.0
        response_time = base_response_time * (1 + load_factor * 2) * random.uniform(0.8, 1.5)
        
        # 에러율
        base_error_rate = config["error_rate_baseline"]
        error_rate = base_error_rate * (1 + load_factor) * random.uniform(0.5, 2.0)
        error_rate = max(0.001, min(10.0, error_rate))  # 0.001% ~ 10% 범위
        
        # 네트워크 트래픽
        bytes_in = requests_per_second * random.uniform(1024, 8192)  # 1KB ~ 8KB per request
        bytes_out = bytes_in * random.uniform(0.8, 3.0)
        
        return {
            "timestamp": timestamp.isoformat(),
            "service": service_name,
            "cpu": {
                "usage_percent": round(cpu_usage, 2),
                "load_1m": round(cpu_usage / 100 * 4, 2),
                "load_5m": round(cpu_usage / 100 * 4 * 0.9, 2),
                "load_15m": round(cpu_usage / 100 * 4 * 0.8, 2)
            },
            "memory": {
                "usage_mb": round(memory_usage, 2),
                "usage_percent": round(memory_usage / (config["memory_baseline"] * 2) * 100, 2),
                "available_mb": round(config["memory_baseline"] * 2 - memory_usage, 2),
                "cache_mb": round(memory_usage * 0.3, 2),
                "buffer_mb": round(memory_usage * 0.1, 2)
            },
            "disk": {
                "read_mb_per_sec": round(disk_read, 2),
                "write_mb_per_sec": round(disk_write, 2),
                "usage_percent": round(random.uniform(40, 85), 2),
                "iops": round((disk_read + disk_write) * 10, 0)
            },
            "network": {
                "requests_per_second": round(requests_per_second, 2),
                "response_time_ms": round(response_time, 2),
                "error_rate_percent": round(error_rate, 4),
                "bytes_in_per_sec": round(bytes_in, 0),
                "bytes_out_per_sec": round(bytes_out, 0),
                "connections_active": random.randint(10, 500)
            },
            "application": {
                "threads_active": random.randint(5, 50),
                "heap_usage_mb": round(memory_usage * 0.6, 2),
                "gc_count": random.randint(0, 5),
                "db_connections": random.randint(2, 20)
            }
        }
    
    def _get_traffic_multiplier(self, hour: int) -> float:
        """시간대별 트래픽 패턴 (실제 서비스와 유사)"""
        if 9 <= hour <= 18:  # 업무시간
            peak_hour = 14  # 오후 2시가 피크
            distance_from_peak = abs(hour - peak_hour)
            return 0.8 + 0.4 * np.exp(-distance_from_peak / 3)  # 0.8 ~ 1.2
        elif 22 <= hour or hour <= 6:  # 야간
            return 0.2 + 0.1 * random.random()  # 0.2 ~ 0.3
        else:  # 오전/저녁
            return 0.5 + 0.3 * random.random()  # 0.5 ~ 0.8
    
    async def _store_realtime_metrics(self, service_name: str, metrics: Dict[str, Any]):
        """Redis에 실시간 메트릭 저장"""
        try:
            key = f"metrics:realtime:{service_name}"
            self.redis_client.setex(key, 300, json.dumps(metrics))  # 5분 TTL
            
            # 전체 서비스 목록 업데이트
            self.redis_client.sadd("services:active", service_name)
            
        except Exception as e:
            logger.error(f"Failed to store realtime metrics for {service_name}: {e}")
    
    async def _store_historical_metrics(self, service_name: str, metrics: Dict[str, Any], timestamp: datetime):
        """데이터베이스에 히스토리 메트릭 저장"""
        try:
            cursor = self.db_connection.cursor()
            
            # 각 메트릭 타입별로 저장
            metric_types = {
                'cpu_usage': metrics['cpu']['usage_percent'],
                'memory_usage': metrics['memory']['usage_mb'],
                'disk_read': metrics['disk']['read_mb_per_sec'],
                'disk_write': metrics['disk']['write_mb_per_sec'],
                'network_rps': metrics['network']['requests_per_second'],
                'network_response_time': metrics['network']['response_time_ms'],
                'network_error_rate': metrics['network']['error_rate_percent']
            }
            
            for metric_type, value in metric_types.items():
                cursor.execute("""
                    INSERT INTO metric_data (resource_name, metric_type, value, unit, timestamp)
                    VALUES (%s, %s, %s, %s, %s)
                """, (service_name, metric_type, value, self._get_metric_unit(metric_type), timestamp))
            
            self.db_connection.commit()
            cursor.close()
            
        except Exception as e:
            logger.error(f"Failed to store historical metrics for {service_name}: {e}")
            if self.db_connection:
                self.db_connection.rollback()
    
    def _get_metric_unit(self, metric_type: str) -> str:
        """메트릭 타입별 단위 반환"""
        units = {
            'cpu_usage': '%',
            'memory_usage': 'MB',
            'disk_read': 'MB/s',
            'disk_write': 'MB/s',
            'network_rps': 'req/s',
            'network_response_time': 'ms',
            'network_error_rate': '%'
        }
        return units.get(metric_type, '')
    
    async def generate_historical_data(self):
        """과거 데이터 생성 (초기 실행 시)"""
        try:
            # 지난 24시간 데이터 생성
            end_time = datetime.now()
            start_time = end_time - timedelta(hours=24)
            
            logger.info("Generating historical data for the last 24 hours...")
            
            current_time = start_time
            while current_time < end_time:
                for service_name, config in self.services.items():
                    metrics = self._generate_service_metrics(service_name, config, current_time)
                    await self._store_historical_metrics(service_name, metrics, current_time)
                
                current_time += timedelta(minutes=5)  # 5분 간격
                
                # 너무 빠르게 생성하지 않도록 잠시 대기
                if not self.running:
                    break
                await asyncio.sleep(0.1)
            
            logger.info("Historical data generation completed")
            
        except Exception as e:
            logger.error(f"Historical data generation error: {e}")
    
    async def simulate_incidents(self):
        """장애 시나리오 시뮬레이션"""
        while self.running:
            try:
                # 1시간마다 장애 발생 가능성 체크
                await asyncio.sleep(3600)
                
                # 5% 확률로 장애 발생
                if random.random() < 0.05:
                    await self._trigger_incident()
                
            except Exception as e:
                logger.error(f"Incident simulation error: {e}")
    
    async def _trigger_incident(self):
        """장애 시나리오 실행"""
        incidents = [
            {"type": "cpu_spike", "duration": 300, "severity": "warning"},
            {"type": "memory_leak", "duration": 600, "severity": "critical"},
            {"type": "network_latency", "duration": 180, "severity": "warning"},
            {"type": "service_down", "duration": 120, "severity": "critical"}
        ]
        
        incident = random.choice(incidents)
        service = random.choice(list(self.services.keys()))
        
        logger.warning(f"Simulating incident: {incident['type']} on {service} for {incident['duration']}s")
        
        # Redis에 장애 정보 저장
        incident_data = {
            "type": incident["type"],
            "service": service,
            "severity": incident["severity"],
            "start_time": datetime.now().isoformat(),
            "duration": incident["duration"],
            "resolved": False
        }
        
        incident_key = f"incident:{service}:{int(time.time())}"
        self.redis_client.setex(incident_key, incident["duration"], json.dumps(incident_data))
        
        # 장애 해결 스케줄링
        await asyncio.sleep(incident["duration"])
        
        incident_data["resolved"] = True
        incident_data["end_time"] = datetime.now().isoformat()
        self.redis_client.setex(incident_key, 3600, json.dumps(incident_data))  # 1시간 보관
        
        logger.info(f"Incident resolved: {incident['type']} on {service}")
    
    async def cleanup_old_data(self):
        """오래된 데이터 정리"""
        while self.running:
            try:
                # 24시간마다 정리 작업 수행
                await asyncio.sleep(86400)
                
                # 7일 이전 데이터 삭제
                cutoff_date = datetime.now() - timedelta(days=7)
                
                cursor = self.db_connection.cursor()
                cursor.execute("""
                    DELETE FROM metric_data 
                    WHERE timestamp < %s
                """, (cutoff_date,))
                
                deleted_rows = cursor.rowcount
                self.db_connection.commit()
                cursor.close()
                
                logger.info(f"Cleaned up {deleted_rows} old metric records")
                
            except Exception as e:
                logger.error(f"Data cleanup error: {e}")

async def main():
    """메인 함수"""
    logger.info("Starting Monitoring Data Generator...")
    
    generator = MonitoringDataGenerator()
    
    try:
        await generator.start()
    except KeyboardInterrupt:
        logger.info("Shutting down Monitoring Data Generator...")
    except Exception as e:
        logger.error(f"Monitoring Data Generator error: {e}")
    finally:
        generator.running = False

if __name__ == "__main__":
    asyncio.run(main())
