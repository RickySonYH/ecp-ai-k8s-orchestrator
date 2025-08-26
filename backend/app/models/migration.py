# [advice from AI] ECP-AI 데이터베이스 마이그레이션 스크립트
"""
기존 테이블을 새로운 스키마로 마이그레이션
- 기존 데이터 보존
- 새로운 컬럼 추가
- 가상 테넌시 데이터 생성
"""

from sqlalchemy import text, create_engine
from sqlalchemy.orm import sessionmaker
import os
import logging
from datetime import datetime, timedelta
import json

# 데이터베이스 연결 설정
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://ecp_user:ecp_password@localhost:5433/ecp_orchestrator"
)

# SQLAlchemy 엔진 및 세션 생성
engine = create_engine(DATABASE_URL, echo=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def migrate_existing_tables():
    """기존 테이블을 새로운 스키마로 마이그레이션"""
    db = SessionLocal()
    
    try:
        # 1. 기존 tenants 테이블 백업
        logging.info("기존 tenants 테이블 백업 중...")
        db.execute(text("CREATE TABLE tenants_backup AS SELECT * FROM tenants"))
        
        # 2. 기존 테이블 삭제
        logging.info("기존 테이블 삭제 중...")
        db.execute(text("DROP TABLE IF EXISTS monitoring_data CASCADE"))
        db.execute(text("DROP TABLE IF EXISTS dashboard_configs CASCADE"))
        db.execute(text("DROP TABLE IF EXISTS deployment_status CASCADE"))
        db.execute(text("DROP TABLE IF EXISTS services CASCADE"))
        db.execute(text("DROP TABLE IF EXISTS image_registry CASCADE"))
        db.execute(text("DROP TABLE IF EXISTS tenants CASCADE"))
        
        # 3. 새로운 스키마로 테이블 생성
        logging.info("새로운 스키마로 테이블 생성 중...")
        
        # tenants 테이블
        db.execute(text("""
            CREATE TABLE tenants (
                id SERIAL PRIMARY KEY,
                tenant_id VARCHAR(100) UNIQUE NOT NULL,
                name VARCHAR(200),
                preset VARCHAR(50) NOT NULL,
                is_demo BOOLEAN DEFAULT false NOT NULL,
                status VARCHAR(50) DEFAULT 'active',
                cpu_limit VARCHAR(50),
                memory_limit VARCHAR(50),
                gpu_limit INTEGER,
                storage_limit VARCHAR(50),
                gpu_type VARCHAR(50),
                sla_availability VARCHAR(20),
                sla_response_time VARCHAR(20),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                created_by VARCHAR(100),
                description TEXT
            )
        """))
        
        # services 테이블
        db.execute(text("""
            CREATE TABLE services (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
                service_name VARCHAR(100) NOT NULL,
                service_type VARCHAR(50) NOT NULL,
                enabled BOOLEAN DEFAULT true,
                count INTEGER DEFAULT 1,
                min_replicas INTEGER DEFAULT 1,
                max_replicas INTEGER DEFAULT 10,
                target_cpu INTEGER DEFAULT 60,
                image_name VARCHAR(200) NOT NULL,
                image_tag VARCHAR(100) NOT NULL,
                image_digest VARCHAR(100),
                registry_url VARCHAR(500),
                cpu_request VARCHAR(50),
                memory_request VARCHAR(50),
                gpu_request INTEGER DEFAULT 0,
                ports JSONB,
                environment_variables JSONB,
                volume_mounts JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(tenant_id, service_name)
            )
        """))
        
        # monitoring_data 테이블
        db.execute(text("""
            CREATE TABLE monitoring_data (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
                service_id INTEGER REFERENCES services(id),
                metric_type VARCHAR(50) NOT NULL,
                metric_name VARCHAR(100) NOT NULL,
                metric_value FLOAT NOT NULL,
                metric_unit VARCHAR(20) NOT NULL,
                is_demo_data BOOLEAN DEFAULT false NOT NULL,
                data_source VARCHAR(100),
                timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        """))
        
        # dashboard_configs 테이블
        db.execute(text("""
            CREATE TABLE dashboard_configs (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
                dashboard_name VARCHAR(200) NOT NULL,
                dashboard_type VARCHAR(50) NOT NULL,
                layout_config JSONB,
                widget_configs JSONB,
                refresh_interval INTEGER DEFAULT 30,
                is_public BOOLEAN DEFAULT false,
                allowed_users JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                created_by VARCHAR(100)
            )
        """))
        
        # image_registry 테이블
        db.execute(text("""
            CREATE TABLE image_registry (
                id SERIAL PRIMARY KEY,
                image_name VARCHAR(200) NOT NULL,
                image_tag VARCHAR(100) NOT NULL,
                image_digest VARCHAR(100),
                registry_url VARCHAR(500),
                architecture VARCHAR(50),
                os_type VARCHAR(50),
                size_bytes BIGINT,
                vulnerability_count INTEGER DEFAULT 0,
                last_scan_date TIMESTAMP WITH TIME ZONE,
                is_active BOOLEAN DEFAULT true,
                is_deprecated BOOLEAN DEFAULT false,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(image_name, image_tag, registry_url)
            )
        """))
        
        # deployment_status 테이블
        db.execute(text("""
            CREATE TABLE deployment_status (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
                namespace VARCHAR(100) NOT NULL,
                deployment_name VARCHAR(200) NOT NULL,
                service_type VARCHAR(100) NOT NULL,
                replicas INTEGER DEFAULT 0,
                available_replicas INTEGER DEFAULT 0,
                ready_replicas INTEGER DEFAULT 0,
                updated_replicas INTEGER DEFAULT 0,
                status VARCHAR(50) DEFAULT 'pending',
                phase VARCHAR(50),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        """))
        
        # 인덱스 생성
        logging.info("인덱스 생성 중...")
        db.execute(text("CREATE INDEX idx_tenant_demo_status ON tenants(is_demo, status)"))
        db.execute(text("CREATE INDEX idx_tenant_preset ON tenants(preset)"))
        db.execute(text("CREATE INDEX idx_service_tenant ON services(tenant_id)"))
        db.execute(text("CREATE INDEX idx_service_type ON services(service_type)"))
        db.execute(text("CREATE INDEX idx_monitoring_tenant_timestamp ON monitoring_data(tenant_id, timestamp)"))
        db.execute(text("CREATE INDEX idx_monitoring_demo ON monitoring_data(is_demo_data)"))
        db.execute(text("CREATE INDEX idx_monitoring_metric ON monitoring_data(metric_type, metric_name)"))
        db.execute(text("CREATE INDEX idx_dashboard_tenant ON dashboard_configs(tenant_id)"))
        db.execute(text("CREATE INDEX idx_dashboard_type ON dashboard_configs(dashboard_type)"))
        db.execute(text("CREATE INDEX idx_image_name_tag ON image_registry(image_name, image_tag)"))
        db.execute(text("CREATE INDEX idx_image_registry ON image_registry(registry_url)"))
        db.execute(text("CREATE INDEX idx_deployment_tenant ON deployment_status(tenant_id)"))
        db.execute(text("CREATE INDEX idx_deployment_status ON deployment_status(status)"))
        db.execute(text("CREATE INDEX idx_deployment_namespace ON deployment_status(namespace)"))
        
        db.commit()
        logging.info("테이블 마이그레이션 완료")
        
    except Exception as e:
        logging.error(f"마이그레이션 실패: {e}")
        db.rollback()
        raise
    finally:
        db.close()

def create_virtual_tenants():
    """모니터링에 있는 가상 테넌시들을 생성"""
    db = SessionLocal()
    
    try:
        # 가상 테넌시 데이터 생성
        virtual_tenants = [
            {
                "tenant_id": "global-call-center",
                "name": "글로벌 콜센터",
                "preset": "large",
                "is_demo": True,
                "status": "active",
                "cpu_limit": "16000m",
                "memory_limit": "32Gi",
                "gpu_limit": 6,
                "storage_limit": "2.0TB",
                "gpu_type": "v100",
                "sla_availability": "99.86%",
                "sla_response_time": "265ms",
                "description": "글로벌 콜센터 AI 서비스"
            },
            {
                "tenant_id": "smart-chatbot",
                "name": "스마트 상담봇",
                "preset": "medium",
                "is_demo": True,
                "status": "critical",
                "cpu_limit": "8000m",
                "memory_limit": "16Gi",
                "gpu_limit": 3,
                "storage_limit": "1.0TB",
                "gpu_type": "t4",
                "sla_availability": "99.18%",
                "sla_response_time": "154ms",
                "description": "스마트 상담봇 AI 서비스"
            },
            {
                "tenant_id": "voice-analysis",
                "name": "음성 분석 서비스",
                "preset": "medium",
                "is_demo": True,
                "status": "active",
                "cpu_limit": "8000m",
                "memory_limit": "16Gi",
                "gpu_limit": 3,
                "storage_limit": "1.0TB",
                "gpu_type": "t4",
                "sla_availability": "99.80%",
                "sla_response_time": "74ms",
                "description": "음성 분석 AI 서비스"
            },
            {
                "tenant_id": "ai-advisor",
                "name": "AI 어드바이저",
                "preset": "large",
                "is_demo": True,
                "status": "active",
                "cpu_limit": "12000m",
                "memory_limit": "24Gi",
                "gpu_limit": 4,
                "storage_limit": "1.5TB",
                "gpu_type": "l40s",
                "sla_availability": "99.78%",
                "sla_response_time": "194ms",
                "description": "AI 어드바이저 서비스"
            },
            {
                "tenant_id": "development-test",
                "name": "개발 테스트",
                "preset": "small",
                "is_demo": True,
                "status": "active",
                "cpu_limit": "4000m",
                "memory_limit": "8Gi",
                "gpu_limit": 1,
                "storage_limit": "500Gi",
                "gpu_type": "t4",
                "sla_availability": "99.96%",
                "sla_response_time": "72ms",
                "description": "개발 및 테스트 환경"
            }
        ]
        
        # 테넌시 생성
        tenant_ids = {}
        for tenant_data in virtual_tenants:
            result = db.execute(text("""
                INSERT INTO tenants (
                    tenant_id, name, preset, is_demo, status, cpu_limit, memory_limit, 
                    gpu_limit, storage_limit, gpu_type, sla_availability, sla_response_time, description
                ) VALUES (
                    :tenant_id, :name, :preset, :is_demo, :status, :cpu_limit, :memory_limit,
                    :gpu_limit, :storage_limit, :gpu_type, :sla_availability, :sla_response_time, :description
                ) RETURNING id
            """), tenant_data)
            
            tenant_id = result.fetchone()[0]
            tenant_ids[tenant_data["tenant_id"]] = tenant_id
            
            # 서비스 구성 생성
            services = [
                {
                    "service_name": "callbot",
                    "service_type": "ai_service",
                    "count": 20 if tenant_data["preset"] in ["large", "medium"] else 5,
                    "image_name": "ecp-ai/callbot",
                    "image_tag": "latest"
                },
                {
                    "service_name": "chatbot",
                    "service_type": "ai_service",
                    "count": 100 if tenant_data["preset"] in ["large", "medium"] else 25,
                    "image_name": "ecp-ai/chatbot",
                    "image_tag": "latest"
                },
                {
                    "service_name": "advisor",
                    "service_type": "ai_service",
                    "count": 10 if tenant_data["preset"] in ["large", "medium"] else 3,
                    "image_name": "ecp-ai/advisor",
                    "image_tag": "latest"
                }
            ]
            
            for service_data in services:
                db.execute(text("""
                    INSERT INTO services (
                        tenant_id, service_name, service_type, count, image_name, image_tag,
                        cpu_request, memory_request, min_replicas, max_replicas, target_cpu
                    ) VALUES (
                        :tenant_id, :service_name, :service_type, :count, :image_name, :image_tag,
                        '100m', '256Mi', 2, 8, 60
                    )
                """), {"tenant_id": tenant_id, **service_data})
        
        # 가상 모니터링 데이터 생성
        logging.info("가상 모니터링 데이터 생성 중...")
        for tenant_key, tenant_id in tenant_ids.items():
            # 24시간 데이터 생성
            for i in range(24):
                timestamp = datetime.utcnow().replace(hour=i, minute=0, second=0, microsecond=0)
                
                # CPU 사용률 (가상 데이터)
                db.execute(text("""
                    INSERT INTO monitoring_data (
                        tenant_id, metric_type, metric_name, metric_value, metric_unit,
                        is_demo_data, data_source, timestamp
                    ) VALUES (
                        :tenant_id, 'cpu', 'usage', :value, '%', true, 'simulated', :timestamp
                    )
                """), {
                    "tenant_id": tenant_id,
                    "value": 30.0 + (i * 2) % 40,  # 30-70% 사이 변동
                    "timestamp": timestamp
                })
                
                # 메모리 사용률 (가상 데이터)
                db.execute(text("""
                    INSERT INTO monitoring_data (
                        tenant_id, metric_type, metric_name, metric_value, metric_unit,
                        is_demo_data, data_source, timestamp
                    ) VALUES (
                        :tenant_id, 'memory', 'usage', :value, '%', true, 'simulated', :timestamp
                    )
                """), {
                    "tenant_id": tenant_id,
                    "value": 45.0 + (i * 3) % 30,  # 45-75% 사이 변동
                    "timestamp": timestamp
                })
                
                # GPU 사용률 (가상 데이터)
                db.execute(text("""
                    INSERT INTO monitoring_data (
                        tenant_id, metric_type, metric_name, metric_value, metric_unit,
                        is_demo_data, data_source, timestamp
                    ) VALUES (
                        :tenant_id, 'gpu', 'usage', :value, '%', true, 'simulated', :timestamp
                    )
                """), {
                    "tenant_id": tenant_id,
                    "value": 60.0 + (i * 4) % 35,  # 60-95% 사이 변동
                    "timestamp": timestamp
                })
        
        # 대시보드 설정 생성
        logging.info("대시보드 설정 생성 중...")
        for tenant_key, tenant_id in tenant_ids.items():
            dashboard_config = {
                "dashboard_name": f"{virtual_tenants[next(i for i, t in enumerate(virtual_tenants) if t['tenant_id'] == tenant_key)]['name']} 대시보드",
                "dashboard_type": "overview",
                "layout_config": {
                    "widgets": [
                        {"id": "cpu_usage", "type": "line_chart", "position": {"x": 0, "y": 0, "w": 6, "h": 4}},
                        {"id": "memory_usage", "type": "line_chart", "position": {"x": 6, "y": 0, "w": 6, "h": 4}},
                        {"id": "gpu_usage", "type": "line_chart", "position": {"x": 0, "y": 4, "w": 6, "h": 4}},
                        {"id": "service_status", "type": "status_grid", "position": {"x": 6, "y": 4, "w": 6, "h": 4}}
                    ]
                },
                "widget_configs": {
                    "cpu_usage": {"title": "CPU 사용률", "metric": "cpu_usage", "refresh_interval": 30},
                    "memory_usage": {"title": "메모리 사용률", "metric": "memory_usage", "refresh_interval": 30},
                    "gpu_usage": {"title": "GPU 사용률", "metric": "gpu_usage", "refresh_interval": 30},
                    "service_status": {"title": "서비스 상태", "services": ["callbot", "chatbot", "advisor"]}
                },
                "refresh_interval": 30,
                "is_public": True
            }
            
            db.execute(text("""
                INSERT INTO dashboard_configs (
                    tenant_id, dashboard_name, dashboard_type, layout_config, widget_configs,
                    refresh_interval, is_public
                ) VALUES (
                    :tenant_id, :dashboard_name, :dashboard_type, :layout_config, :widget_configs,
                    :refresh_interval, :is_public
                )
            """), {
                "tenant_id": tenant_id, 
                "dashboard_name": dashboard_config["dashboard_name"],
                "dashboard_type": dashboard_config["dashboard_type"],
                "layout_config": json.dumps(dashboard_config["layout_config"]),
                "widget_configs": json.dumps(dashboard_config["widget_configs"]),
                "refresh_interval": dashboard_config["refresh_interval"],
                "is_public": dashboard_config["is_public"]
            })
        
        db.commit()
        logging.info("가상 테넌시 및 데이터 생성 완료")
        
    except Exception as e:
        logging.error(f"가상 테넌시 생성 실패: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    try:
        # 1. 테이블 마이그레이션
        migrate_existing_tables()
        
        # 2. 가상 테넌시 생성
        create_virtual_tenants()
        
        logging.info("모든 마이그레이션 작업 완료!")
        
    except Exception as e:
        logging.error(f"마이그레이션 실패: {e}")
        exit(1)
