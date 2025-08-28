# [advice from AI] 데이터베이스 연결 및 모델 정의
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Float, Boolean, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.sql import func
import os
from datetime import datetime
import asyncio
# import asyncpg

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://k8s_user:k8s_password@localhost:6350/k8s_simulator")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class K8sResource(Base):
    """K8S 리소스 정보 저장"""
    __tablename__ = "k8s_resources"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    namespace = Column(String, default="default")
    kind = Column(String, index=True)  # Pod, Service, Deployment, etc.
    status = Column(String, default="Pending")  # Running, Pending, Failed, etc.
    manifest = Column(JSON)  # Original YAML manifest
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class MetricData(Base):
    """모니터링 메트릭 데이터"""
    __tablename__ = "metric_data"
    
    id = Column(Integer, primary_key=True, index=True)
    resource_name = Column(String, index=True)
    metric_type = Column(String, index=True)  # cpu, memory, network, disk
    value = Column(Float)
    unit = Column(String)  # %, MB, requests/sec, etc.
    timestamp = Column(DateTime, default=func.now())

class SLARecord(Base):
    """SLA 기록"""
    __tablename__ = "sla_records"
    
    id = Column(Integer, primary_key=True, index=True)
    service_name = Column(String, index=True)
    availability_percentage = Column(Float)
    uptime_seconds = Column(Integer)
    downtime_seconds = Column(Integer)
    incident_count = Column(Integer, default=0)
    date = Column(DateTime, default=func.now())

class AlertHistory(Base):
    """알림 히스토리"""
    __tablename__ = "alert_history"
    
    id = Column(Integer, primary_key=True, index=True)
    alert_type = Column(String, index=True)  # warning, critical, info
    service_name = Column(String, index=True)
    message = Column(Text)
    resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())
    resolved_at = Column(DateTime, nullable=True)

async def init_db():
    """데이터베이스 초기화"""
    try:
        # Create tables
        Base.metadata.create_all(bind=engine)
        print("Database tables created successfully!")
        return True
    except Exception as e:
        print(f"Database initialization error: {e}")
        return False

def get_db():
    """데이터베이스 세션 생성"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
