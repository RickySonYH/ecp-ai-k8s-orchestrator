# [advice from AI] ECP-AI 데모 전용 데이터베이스 모델
"""
데모 환경 전용 데이터베이스 모델
- 하드코딩된 데모 데이터를 DB로 이전
- 실제 모니터링 에이전트와 연동
- 데모/운영 환경 완전 분리
"""

from sqlalchemy import (
    create_engine, Column, Integer, String, Boolean, DateTime, 
    Float, Text, JSON, ForeignKey, Index, UniqueConstraint, BigInteger
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from sqlalchemy.sql import func
from datetime import datetime, timedelta
import random
import logging
import math

# 데모 전용 데이터베이스 연결
DEMO_DATABASE_URL = "postgresql://ecp_user:ecp_password@postgres:5432/ecp_orchestrator"

# SQLAlchemy 엔진 및 세션 생성
demo_engine = create_engine(DEMO_DATABASE_URL, echo=False)
DemoSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=demo_engine)

# 베이스 클래스
DemoBase = declarative_base()


class DemoTenant(DemoBase):
    """데모 전용 테넌시 정보"""
    __tablename__ = "demo_tenants"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(100), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False)
    preset = Column(String(50), nullable=False)  # micro, small, medium, large
    status = Column(String(50), default="running")  # running, stopped, error
    
    # 리소스 제한
    cpu_limit = Column(String(50), nullable=True)
    memory_limit = Column(String(50), nullable=True)
    gpu_limit = Column(Integer, nullable=True)
    storage_limit = Column(String(50), nullable=True)
    gpu_type = Column(String(50), nullable=True)  # t4, v100, l40s
    
    # SLA 정보
    sla_availability = Column(String(20), nullable=True)
    sla_response_time = Column(String(20), nullable=True)
    
    # 메타데이터
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    description = Column(Text, nullable=True)
    demo_category = Column(String(50), nullable=True)  # callcenter, chatbot, advisor
    
    # [advice from AI] 서버 상세 정보 저장 (JSON 형태)
    server_details = Column(JSON, nullable=True)  # IaaS 기준 실제 서버 목록
    hardware_config = Column(JSON, nullable=True)  # 하드웨어 구성 정보
    service_requirements = Column(JSON, nullable=True)  # 서비스 요구사항
    server_summary = Column(JSON, nullable=True)  # 서버 요약 정보 (총 대수, CPU, RAM, GPU)
    manifest_data = Column(JSON, nullable=True)  # 매니페스트 정보
    
    # 관계
    demo_services = relationship("DemoService", back_populates="tenant", cascade="all, delete-orphan")
    demo_monitoring = relationship("DemoMonitoringData", back_populates="tenant", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('idx_demo_tenant_preset', 'preset'),
        Index('idx_demo_tenant_category', 'demo_category'),
    )


class DemoService(DemoBase):
    """데모 전용 서비스 구성"""
    __tablename__ = "demo_services"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("demo_tenants.id"), nullable=False)
    service_name = Column(String(100), nullable=False)  # callbot, chatbot, advisor
    service_type = Column(String(50), nullable=False)  # ai_service, infrastructure
    
    # 서비스 설정
    enabled = Column(Boolean, default=True)
    count = Column(Integer, default=1)
    min_replicas = Column(Integer, default=1)
    max_replicas = Column(Integer, default=10)
    target_cpu = Column(Integer, default=60)
    
    # 컨테이너 이미지 정보
    image_name = Column(String(200), nullable=False)
    image_tag = Column(String(100), nullable=False)
    
    # 리소스 요구사항
    cpu_request = Column(String(50), nullable=True)
    memory_request = Column(String(50), nullable=True)
    gpu_request = Column(Integer, default=0)
    
    # 메타데이터
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 관계
    tenant = relationship("DemoTenant", back_populates="demo_services")
    
    __table_args__ = (
        Index('idx_demo_service_tenant', 'tenant_id'),
        Index('idx_demo_service_type', 'service_type'),
    )


class DemoMonitoringData(DemoBase):
    """데모 전용 모니터링 데이터 (실시간 시뮬레이션)"""
    __tablename__ = "demo_monitoring_data"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("demo_tenants.id"), nullable=False)
    service_id = Column(Integer, ForeignKey("demo_services.id"), nullable=True)
    
    # 메트릭 정보
    metric_type = Column(String(50), nullable=False)  # cpu, memory, gpu, storage, network
    metric_name = Column(String(100), nullable=False)  # usage, limit, request
    metric_value = Column(Float, nullable=False)
    metric_unit = Column(String(20), nullable=False)  # %, MB, GB, cores
    
    # 시뮬레이션 설정
    simulation_pattern = Column(String(50), nullable=True)  # random, sine, spike, stable
    base_value = Column(Float, nullable=True)  # 기본값
    variation_range = Column(Float, nullable=True)  # 변동 범위
    
    # 메타데이터
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    data_source = Column(String(50), default="simulation")
    
    # 관계
    tenant = relationship("DemoTenant", back_populates="demo_monitoring")
    
    __table_args__ = (
        Index('idx_demo_monitoring_tenant', 'tenant_id'),
        Index('idx_demo_monitoring_timestamp', 'timestamp'),
        Index('idx_demo_monitoring_metric', 'metric_type', 'metric_name'),
    )


class DemoDataGenerator:
    """[advice from AI] 데모 데이터 생성기 - 하드코딩 제거, 가상 모니터링 에이전트 포함"""
    
    def __init__(self):
        self.virtual_monitoring_agents = {}  # 테넌시별 가상 모니터링 에이전트
        # [advice from AI] 동적 시스템 리소스 - 테넌시 합계 기반
        self.system_resources = self._calculate_system_totals_from_tenants()
    
    def create_virtual_monitoring_agent(self, tenant_id: str, service_requirements: dict):
        """[advice from AI] 테넌시별 가상 서버 모니터링 에이전트 생성 - 서버별 동적 데이터"""
        if tenant_id not in self.virtual_monitoring_agents:
            # 하드웨어 구성 정보 생성
            calculated_resources = self.calculate_resources_from_channels(service_requirements)
            hardware_config = calculated_resources.get('hardware_config', {})
            
            # 서버별 모니터링 에이전트 생성
            server_agents = {}
            
            # AI 처리 서버들
            for server in hardware_config.get('ai_servers', []):
                for i in range(server['server_count']):
                    server_id = f"{server['server_type'].replace(' ', '-').lower()}-{i+1}"
                    server_agents[server_id] = self._create_server_agent(server, 'ai_server')
            
            # 음성/텍스트 처리 서버들
            for server in hardware_config.get('processing_servers', []):
                for i in range(server['server_count']):
                    server_id = f"{server['server_type'].replace(' ', '-').lower()}-{i+1}"
                    server_agents[server_id] = self._create_server_agent(server, 'processing_server')
            
            # 공통 서비스 서버들
            for server in hardware_config.get('common_servers', []):
                for i in range(server['server_count']):
                    server_id = f"{server['server_type'].replace(' ', '-').lower()}-{i+1}"
                    server_agents[server_id] = self._create_server_agent(server, 'common_server')
            
            # 테넌시 전체 모니터링 에이전트 생성
            self.virtual_monitoring_agents[tenant_id] = {
                'tenant_id': tenant_id,
                'resources': calculated_resources,
                'hardware_config': hardware_config,
                'server_agents': server_agents,
                'service_requirements': service_requirements,
                'created_at': datetime.utcnow(),
                'last_update': datetime.utcnow()
            }
            
            print(f"[Virtual Monitoring] 테넌시 {tenant_id} 서버별 모니터링 에이전트 생성됨 (서버 {len(server_agents)}대)")
            
            # [advice from AI] 시스템 리소스 재계산
            self.system_resources = self._calculate_system_totals_from_tenants()
            return True
        return False
    
    def _create_server_agent(self, server_config: dict, server_category: str) -> dict:
        """[advice from AI] 개별 서버 모니터링 에이전트 생성"""
        import random
        import time
        
        # 서버 타입별 기본 사용률 패턴 설정
        usage_patterns = {
            'ai_server': {
                'cpu_base': (30, 70),      # AI 서버는 CPU 사용률 높음
                'memory_base': (40, 80),   # 메모리 사용률 높음  
                'gpu_base': (20, 90),      # GPU 사용률 변동 큼
                'pattern': 'ai_workload'   # AI 워크로드 패턴
            },
            'processing_server': {
                'cpu_base': (20, 60),      # 처리 서버는 중간 사용률
                'memory_base': (25, 65),   # 메모리 사용률 중간
                'gpu_base': (0, 0),        # GPU 없음
                'pattern': 'processing_workload'
            },
            'common_server': {
                'cpu_base': (10, 40),      # 공통 서버는 낮은 사용률
                'memory_base': (20, 50),   # 메모리 사용률 낮음
                'gpu_base': (0, 0),        # GPU 없음
                'pattern': 'service_workload'
            }
        }
        
        pattern = usage_patterns.get(server_category, usage_patterns['common_server'])
        
        # 서버별 고유한 시드 생성 (서버명 기반)
        server_seed = hash(server_config['server_type']) % 1000
        
        return {
            'server_config': server_config,
            'server_category': server_category,
            'usage_pattern': pattern,
            'server_seed': server_seed,
            'current_metrics': {
                'cpu_usage': random.uniform(*pattern['cpu_base']),
                'memory_usage': random.uniform(*pattern['memory_base']),
                'gpu_usage': random.uniform(*pattern['gpu_base']) if pattern['gpu_base'][1] > 0 else 0,
                'network_in': random.uniform(10, 100),    # MB/s
                'network_out': random.uniform(5, 50),     # MB/s
                'disk_usage': random.uniform(20, 80),     # %
                'disk_io_read': random.uniform(10, 200),  # MB/s
                'disk_io_write': random.uniform(5, 100),  # MB/s
                'temperature': random.uniform(35, 65),    # 섭씨
                'power_usage': random.uniform(100, 400),  # 와트
            },
            'status': 'running',
            'uptime': random.randint(3600, 86400 * 30),   # 1시간 ~ 30일
            'last_update': datetime.utcnow(),
            'trend_direction': random.choice(['stable', 'increasing', 'decreasing']),
            'anomaly_chance': 0.05  # 5% 확률로 이상 상황 발생
        }
    
    def remove_virtual_monitoring_agent(self, tenant_id: str):
        """[advice from AI] 테넌시 삭제 시 가상 모니터링 에이전트 제거"""
        if tenant_id in self.virtual_monitoring_agents:
            del self.virtual_monitoring_agents[tenant_id]
            print(f"[Virtual Monitoring] 테넌시 {tenant_id} 가상 모니터링 에이전트 제거됨")
            
            # [advice from AI] 시스템 리소스 재계산
            self.system_resources = self._calculate_system_totals_from_tenants()
            return True
        return False
    
    def update_virtual_monitoring_data(self):
        """[advice from AI] 서버별 가상 모니터링 데이터 실시간 업데이트 - 동적 변화"""
        current_time = datetime.utcnow()
        
        for tenant_id, agent in self.virtual_monitoring_agents.items():
            # 각 서버별 모니터링 데이터 업데이트
            for server_id, server_agent in agent.get('server_agents', {}).items():
                self._update_server_metrics(server_agent, current_time)
            
            # 테넌시 전체 업데이트 시간 갱신
            agent['last_update'] = current_time
    
    def _update_server_metrics(self, server_agent: dict, current_time: datetime):
        """[advice from AI] 개별 서버 메트릭 실시간 업데이트"""
        import random
        import math
        
        # 시간 기반 변동 계산 (서버별 고유 패턴)
        time_factor = (current_time.timestamp() + server_agent['server_seed']) % 3600 / 3600
        
        usage_pattern = server_agent['usage_pattern']
        current_metrics = server_agent['current_metrics']
        
        # 트렌드 방향에 따른 변화량 조정
        trend_multiplier = {
            'stable': 1.0,
            'increasing': 1.2,
            'decreasing': 0.8
        }.get(server_agent['trend_direction'], 1.0)
        
        # CPU 사용률 동적 변화
        cpu_variation = math.sin(time_factor * 2 * math.pi) * 10 * trend_multiplier
        new_cpu = current_metrics['cpu_usage'] + random.uniform(-5, 5) + cpu_variation * 0.1
        current_metrics['cpu_usage'] = max(0, min(100, new_cpu))
        
        # 메모리 사용률 동적 변화 (CPU보다 천천히 변화)
        memory_variation = math.sin(time_factor * 1.5 * math.pi) * 5 * trend_multiplier
        new_memory = current_metrics['memory_usage'] + random.uniform(-2, 2) + memory_variation * 0.1
        current_metrics['memory_usage'] = max(0, min(100, new_memory))
        
        # GPU 사용률 동적 변화 (AI 서버만)
        if usage_pattern['gpu_base'][1] > 0:
            gpu_variation = math.sin(time_factor * 3 * math.pi) * 15 * trend_multiplier
            new_gpu = current_metrics['gpu_usage'] + random.uniform(-8, 8) + gpu_variation * 0.1
            current_metrics['gpu_usage'] = max(0, min(100, new_gpu))
        
        # 네트워크 사용률 동적 변화
        network_variation = random.uniform(-10, 10)
        current_metrics['network_in'] = max(0, current_metrics['network_in'] + network_variation)
        current_metrics['network_out'] = max(0, current_metrics['network_out'] + network_variation * 0.5)
        
        # 디스크 I/O 동적 변화
        disk_io_variation = random.uniform(-20, 20)
        current_metrics['disk_io_read'] = max(0, current_metrics['disk_io_read'] + disk_io_variation)
        current_metrics['disk_io_write'] = max(0, current_metrics['disk_io_write'] + disk_io_variation * 0.3)
        
        # 온도 변화 (사용률에 따라)
        avg_usage = (current_metrics['cpu_usage'] + current_metrics['memory_usage']) / 2
        temp_target = 40 + (avg_usage * 0.3)  # 사용률에 따른 온도 상승
        temp_diff = temp_target - current_metrics['temperature']
        current_metrics['temperature'] += temp_diff * 0.1 + random.uniform(-1, 1)
        current_metrics['temperature'] = max(25, min(85, current_metrics['temperature']))
        
        # 전력 사용량 변화 (사용률에 따라)
        power_base = server_agent['server_config'].get('cpu_cores', 8) * 15  # 코어당 15W 기본
        power_usage_factor = (current_metrics['cpu_usage'] + current_metrics.get('gpu_usage', 0)) / 100
        current_metrics['power_usage'] = power_base + (power_base * power_usage_factor) + random.uniform(-20, 20)
        current_metrics['power_usage'] = max(50, min(800, current_metrics['power_usage']))
        
        # 이상 상황 발생 (5% 확률)
        if random.random() < server_agent['anomaly_chance']:
            self._trigger_server_anomaly(server_agent)
        
        # 트렌드 방향 가끔 변경 (1% 확률)
        if random.random() < 0.01:
            server_agent['trend_direction'] = random.choice(['stable', 'increasing', 'decreasing'])
        
        # 업타임 증가
        server_agent['uptime'] += 30  # 30초씩 증가
        server_agent['last_update'] = current_time
    
    def _trigger_server_anomaly(self, server_agent: dict):
        """[advice from AI] 서버 이상 상황 시뮬레이션"""
        import random
        
        anomaly_type = random.choice(['cpu_spike', 'memory_leak', 'network_congestion', 'disk_full'])
        current_metrics = server_agent['current_metrics']
        
        if anomaly_type == 'cpu_spike':
            current_metrics['cpu_usage'] = min(100, current_metrics['cpu_usage'] + random.uniform(20, 40))
        elif anomaly_type == 'memory_leak':
            current_metrics['memory_usage'] = min(100, current_metrics['memory_usage'] + random.uniform(15, 30))
        elif anomaly_type == 'network_congestion':
            current_metrics['network_in'] *= random.uniform(2, 5)
            current_metrics['network_out'] *= random.uniform(2, 5)
        elif anomaly_type == 'disk_full':
            current_metrics['disk_usage'] = min(100, current_metrics['disk_usage'] + random.uniform(10, 20))
        
        print(f"[Virtual Monitoring] 서버 이상 상황 발생: {anomaly_type}")
    
    def _calculate_system_totals_from_tenants(self) -> dict:
        """[advice from AI] 테넌시별 할당 리소스를 합산하여 시스템 전체 리소스 계산"""
        if not hasattr(self, 'virtual_monitoring_agents'):
            # 초기화 시점에서는 기본값 반환
            return {
                'total_gpu': 0,
                'total_cpu': 0,
                'total_memory': 0
            }
        
        total_gpu = 0
        total_cpu = 0
        total_memory = 0
        
        # 모든 테넌시의 리소스 합계 계산
        for tenant_id, agent in self.virtual_monitoring_agents.items():
            resources = agent.get('resources', {})
            total_gpu += resources.get('gpu', 0)
            total_cpu += resources.get('cpu', 0)
            total_memory += resources.get('memory', 0)
        
        return {
            'total_gpu': total_gpu,
            'total_cpu': total_cpu,
            'total_memory': total_memory
        }
    
    def get_virtual_system_metrics(self):
        """[advice from AI] 가상 시스템 메트릭 조회 - 테넌시 리소스 합계 기반 동적 계산"""
        # [advice from AI] 시스템 리소스를 실시간으로 다시 계산
        self.system_resources = self._calculate_system_totals_from_tenants()
        
        if not self.virtual_monitoring_agents:
            # 테넌시가 없으면 모든 사용률 0%
            return {
                'total_gpu': self.system_resources['total_gpu'],
                'total_cpu': self.system_resources['total_cpu'],
                'total_memory': self.system_resources['total_memory'],
                'total_gpu_usage': 0,
                'total_cpu_usage': 0,
                'total_memory_usage': 0
            }
        
        # [advice from AI] 서버별 모니터링 데이터에서 사용률 집계
        total_gpu_usage = 0
        total_cpu_usage = 0
        total_memory_usage = 0
        
        for tenant_id, agent in self.virtual_monitoring_agents.items():
            # 각 테넌시의 서버별 사용률 합산
            for server_id, server_agent in agent.get('server_agents', {}).items():
                current_metrics = server_agent.get('current_metrics', {})
                server_config = server_agent.get('server_config', {})
                
                # 서버별 사용률을 절대값으로 변환하여 합산
                cpu_usage_abs = current_metrics.get('cpu_usage', 0) * server_config.get('cpu_cores', 0) / 100
                memory_usage_abs = current_metrics.get('memory_usage', 0) * server_config.get('memory_gb', 0) / 100
                gpu_usage_abs = current_metrics.get('gpu_usage', 0) * server_config.get('gpu_count', 0) / 100
                
                total_cpu_usage += cpu_usage_abs
                total_memory_usage += memory_usage_abs
                total_gpu_usage += gpu_usage_abs
        
        return {
            'total_gpu': self.system_resources['total_gpu'],
            'total_cpu': self.system_resources['total_cpu'],
            'total_memory': self.system_resources['total_memory'],
            'total_gpu_usage': round(total_gpu_usage, 1),
            'total_cpu_usage': round(total_cpu_usage, 1),
            'total_memory_usage': round(total_memory_usage, 1)
        }
    
    def get_virtual_tenant_metrics(self, tenant_id: str):
        """[advice from AI] 특정 테넌시의 가상 메트릭 조회"""
        if tenant_id in self.virtual_monitoring_agents:
            agent = self.virtual_monitoring_agents[tenant_id]
            return {
                'tenant_id': tenant_id,
                'gpu_usage': agent['monitoring_data']['gpu_usage'],
                'cpu_usage': agent['monitoring_data']['cpu_usage'],
                'memory_usage': agent['monitoring_data']['memory_usage'],
                'last_update': agent['monitoring_data']['last_update']
            }
        return None
    
    @staticmethod
    def calculate_resources_from_channels(service_requirements: dict) -> dict:
        """[advice from AI] 채널 기반 실제 서버 구성 계산"""
        
        # 서버 구성 정보 생성
        hardware_config = DemoDataGenerator.generate_hardware_configuration(service_requirements)
        
        # 총 리소스 계산 (실제 서버 스펙 합산)
        total_gpu = 0
        total_cpu = 0
        total_memory = 0
        
        # AI 처리 서버
        for server in hardware_config['ai_servers']:
            total_gpu += server['gpu_count'] * server['server_count']
            total_cpu += server['cpu_cores'] * server['server_count']
            total_memory += server['memory_gb'] * server['server_count']
        
        # 음성/텍스트 처리 서버 (GPU 없음)
        for server in hardware_config['processing_servers']:
            total_cpu += server['cpu_cores'] * server['server_count']
            total_memory += server['memory_gb'] * server['server_count']
        
        # 공통 서비스 서버 (GPU 없음)
        for server in hardware_config['common_servers']:
            total_cpu += server['cpu_cores'] * server['server_count']
            total_memory += server['memory_gb'] * server['server_count']
        
        return {
            'gpu': total_gpu,
            'cpu': total_cpu,
            'memory': total_memory,
            'hardware_config': hardware_config  # 상세 서버 구성 정보 포함
        }
    
    @staticmethod
    def generate_hardware_configuration(service_requirements: dict) -> dict:
        """[advice from AI] 채널 기반 실제 하드웨어 서버 구성 생성"""
        
        # 총 채널 수 계산
        total_channels = sum([
            service_requirements.get('callbot', 0),
            service_requirements.get('chatbot', 0), 
            service_requirements.get('advisor', 0)
        ])
        
        # 개별 서비스 인스턴스
        stt_instances = service_requirements.get('stt', 0)
        tts_instances = service_requirements.get('tts', 0)
        ta_instances = service_requirements.get('ta', 0)
        qa_instances = service_requirements.get('qa', 0)
        
        # AI 처리 서버 구성 (GPU 서버)
        ai_servers = []
        
        # TTS 서버 (채널당 T4 GPU 필요)
        if service_requirements.get('tts', 0) > 0 or total_channels > 0:
            tts_servers = max(1, (total_channels + 49) // 50)  # 50채널당 1대
            ai_servers.append({
                'server_type': 'TTS 서버',
                'gpu_type': 'T4',
                'server_count': tts_servers,
                'cpu_cores': 16,
                'memory_gb': 64,
                'gpu_count': 1,
                'storage_gb': 500,
                'purpose': 'TTS 서버 (T4)'
            })
        
        # NLP 서버 (대화형 서비스용 V100)
        if service_requirements.get('chatbot', 0) > 0 or service_requirements.get('advisor', 0) > 0:
            nlp_servers = max(1, (service_requirements.get('chatbot', 0) + service_requirements.get('advisor', 0) + 99) // 100)
            ai_servers.append({
                'server_type': 'NLP 서버',
                'gpu_type': 'V100',
                'server_count': nlp_servers,
                'cpu_cores': 32,
                'memory_gb': 128,
                'gpu_count': 1,
                'storage_gb': 500,
                'purpose': 'NLP 서버 (V100)'
            })
        
        # AICM 서버 (콜봇 전용)
        if service_requirements.get('callbot', 0) > 0:
            aicm_servers = max(1, (service_requirements.get('callbot', 0) + 74) // 75)  # 75채널당 1대
            ai_servers.append({
                'server_type': 'AICM 서버',
                'gpu_type': 'T4',
                'server_count': aicm_servers,
                'cpu_cores': 32,
                'memory_gb': 128,
                'gpu_count': 1,
                'storage_gb': 500,
                'purpose': 'AICM 서버 (T4)'
            })
        
        # 음성/텍스트 처리 서버 구성 (CPU 서버)
        processing_servers = []
        
        # STT 서버
        if stt_instances > 0 or total_channels > 0:
            stt_servers = max(1, (total_channels + 199) // 200)  # 200채널당 1대
            processing_servers.append({
                'server_type': 'STT 서버',
                'server_count': stt_servers,
                'cpu_cores': 48,
                'memory_gb': 96,
                'storage_gb': 500,
                'storage_type': 'SSD',
                'purpose': 'STT 서버 (48코어)'
            })
        
        # TA 서버
        if ta_instances > 0:
            processing_servers.append({
                'server_type': 'TA CPU 서버',
                'server_count': max(1, ta_instances),
                'cpu_cores': 8,
                'memory_gb': 16,
                'storage_gb': 500,
                'storage_type': 'SSD',
                'purpose': 'TA CPU 서버 (8코어)'
            })
        
        # QA 서버
        if qa_instances > 0:
            processing_servers.append({
                'server_type': 'QA 서버',
                'server_count': max(1, qa_instances),
                'cpu_cores': 8,
                'memory_gb': 16,
                'storage_gb': 500,
                'storage_type': 'SSD',
                'purpose': 'QA 서버 (8코어)'
            })
        
        # Nginx 서버 (항상 필요)
        if total_channels > 0 or any(service_requirements.values()):
            processing_servers.append({
                'server_type': 'Nginx 서버',
                'server_count': 1,
                'cpu_cores': 8,
                'memory_gb': 16,
                'storage_gb': 500,
                'storage_type': 'SSD',
                'purpose': 'Nginx 서버 (8코어)'
            })
        
        # 공통 서비스 서버 구성
        common_servers = []
        
        if total_channels > 0 or any(service_requirements.values()):
            # API Gateway (고가용성)
            common_servers.append({
                'server_type': 'API Gateway 서버',
                'server_count': 2,
                'cpu_cores': 8,
                'memory_gb': 16,
                'storage_gb': 500,
                'storage_type': 'SSD',
                'purpose': 'API Gateway 서버 (8코어)'
            })
            
            # PostgreSQL
            common_servers.append({
                'server_type': 'PostgreSQL 서버',
                'server_count': 1,
                'cpu_cores': 32,
                'memory_gb': 128,
                'storage_gb': 500,
                'storage_type': 'SSD',
                'purpose': 'PostgreSQL 서버 (24코어)'
            })
            
            # VectorDB
            common_servers.append({
                'server_type': 'VectorDB 서버',
                'server_count': 1,
                'cpu_cores': 8,
                'memory_gb': 32,
                'storage_gb': 500,
                'storage_type': 'SSD',
                'purpose': 'VectorDB 서버 (8코어)'
            })
            
            # Auth Service
            common_servers.append({
                'server_type': 'Auth Service 서버',
                'server_count': 1,
                'cpu_cores': 8,
                'memory_gb': 16,
                'storage_gb': 500,
                'storage_type': 'SSD',
                'purpose': 'Auth Service 서버 (8코어)'
            })
            
            # NAS
            common_servers.append({
                'server_type': 'NAS 서버',
                'server_count': 1,
                'cpu_cores': 8,
                'memory_gb': 16,
                'storage_gb': 500,
                'storage_type': 'SSD',
                'purpose': 'NAS 서버 (8코어)'
            })
        
        return {
            'ai_servers': ai_servers,
            'processing_servers': processing_servers,
            'common_servers': common_servers,
            'total_channels': total_channels,
            'service_summary': {
                'callbot': service_requirements.get('callbot', 0),
                'chatbot': service_requirements.get('chatbot', 0),
                'advisor': service_requirements.get('advisor', 0),
                'stt': service_requirements.get('stt', 0),
                'tts': service_requirements.get('tts', 0),
                'ta': service_requirements.get('ta', 0),
                'qa': service_requirements.get('qa', 0)
            }
        }
    
    @staticmethod
    def create_demo_tenants():
        """[advice from AI] 하드코딩된 데모 데이터 제거 - 사용자가 마법사로 직접 생성"""
        # 모든 하드코딩된 데이터 제거
        # 사용자가 TenantCreator 마법사를 통해 직접 생성
        demo_tenants = []
        
        # [advice from AI] 빈 배열 반환 - 하드코딩 데이터 없음
        return demo_tenants
    
    @staticmethod
    def create_demo_services(tenant_id: int, category: str):
        """테넌시별 데모 서비스 생성"""
        if category == "callcenter":
            return [
                {
                    "service_name": "callbot",
                    "service_type": "ai_service",
                    "count": 20,
                    "min_replicas": 5,
                    "max_replicas": 50,
                    "target_cpu": 70,
                    "image_name": "ecp-ai/callbot",
                    "image_tag": "latest",
                    "cpu_request": "200m",
                    "memory_request": "512Mi",
                    "gpu_request": 0
                },
                {
                    "service_name": "voice_processor",
                    "service_type": "ai_service",
                    "count": 10,
                    "min_replicas": 3,
                    "max_replicas": 20,
                    "target_cpu": 80,
                    "image_name": "ecp-ai/voice-processor",
                    "image_tag": "latest",
                    "cpu_request": "500m",
                    "memory_request": "1Gi",
                    "gpu_request": 1
                }
            ]
        elif category == "chatbot":
            return [
                {
                    "service_name": "chatbot",
                    "service_type": "ai_service",
                    "count": 50,
                    "min_replicas": 10,
                    "max_replicas": 100,
                    "target_cpu": 60,
                    "image_name": "ecp-ai/chatbot",
                    "image_tag": "latest",
                    "cpu_request": "100m",
                    "memory_request": "256Mi",
                    "gpu_request": 0
                }
            ]
        elif category == "advisor":
            return [
                {
                    "service_name": "advisor",
                    "service_type": "ai_service",
                    "count": 15,
                    "min_replicas": 5,
                    "max_replicas": 30,
                    "target_cpu": 75,
                    "image_name": "ecp-ai/advisor",
                    "image_tag": "latest",
                    "cpu_request": "300m",
                    "memory_request": "1Gi",
                    "gpu_request": 1
                }
            ]
        else:
            return [
                {
                    "service_name": "default_service",
                    "service_type": "ai_service",
                    "count": 5,
                    "min_replicas": 2,
                    "max_replicas": 10,
                    "target_cpu": 60,
                    "image_name": "ecp-ai/default",
                    "image_tag": "latest",
                    "cpu_request": "200m",
                    "memory_request": "512Mi",
                    "gpu_request": 0
                }
            ]
    
    @staticmethod
    def generate_monitoring_data(tenant_id: int, service_id: int, metric_type: str, 
                                base_value: float, variation_range: float, 
                                simulation_pattern: str = "random"):
        """실시간 모니터링 데이터 시뮬레이션"""
        if simulation_pattern == "random":
            value = base_value + random.uniform(-variation_range, variation_range)
        elif simulation_pattern == "sine":
            # 사인파 패턴 (시간 기반)
            time_factor = datetime.now().timestamp() / 3600  # 시간 단위
            value = base_value + variation_range * (0.5 + 0.5 * (time_factor % 24) / 24)
        elif simulation_pattern == "spike":
            # 스파이크 패턴 (가끔 높은 값)
            if random.random() < 0.1:  # 10% 확률로 스파이크
                value = base_value + variation_range * 2
            else:
                value = base_value + random.uniform(-variation_range * 0.3, variation_range * 0.3)
        else:  # stable
            value = base_value + random.uniform(-variation_range * 0.1, variation_range * 0.1)
        
        return {
            "tenant_id": tenant_id,
            "service_id": service_id,
            "metric_type": metric_type,
            "metric_name": "usage",
            "metric_value": max(0, min(100, value)),  # 0-100 범위로 제한
            "metric_unit": "%",
            "simulation_pattern": simulation_pattern,
            "base_value": base_value,
            "variation_range": variation_range,
            "data_source": "simulation"
        }


# [advice from AI] 데모 데이터베이스 의존성 함수
def get_demo_db():
    """데모 데이터베이스 세션 의존성"""
    db = DemoSessionLocal()
    try:
        yield db
    finally:
        db.close()


# [advice from AI] 데모 데이터베이스 초기화
def init_demo_database():
    """데모 데이터베이스 테이블 생성"""
    DemoBase.metadata.create_all(bind=demo_engine)
    print("[Demo Database] 데모 데이터베이스 초기화 완료")


# [advice from AI] 데모 데이터베이스 정리
def cleanup_demo_database():
    """데모 데이터베이스 테이블 정리"""
    DemoBase.metadata.drop_all(bind=demo_engine)
    print("[Demo Database] 데모 데이터베이스 정리 완료")


if __name__ == "__main__":
    init_demo_database()
