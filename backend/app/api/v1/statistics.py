"""
[advice from AI] 통계 API - 실제 데이터베이스 기반 통계 제공
ECP-AI Kubernetes Orchestrator 통계 엔드포인트
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import logging
import random

from app.core.database_manager import get_db_session
from app.models.database import Tenant, Service
# from app.models.tenant_specs import TenantSummary  # [advice from AI] 사용하지 않는 import 제거

logger = logging.getLogger(__name__)
router = APIRouter()

# [advice from AI] 가상 이미지 데이터 생성 - 서비스별 이미지 정보
def _generate_virtual_image_data():
    """
    서비스별 가상 이미지 데이터 생성
    실제 이미지가 준비되지 않았으므로 가상 데이터로 생성
    """
    virtual_images = {
        # 메인 애플리케이션 서비스
        "callbot": {
            "image_name": "ecp-ai/callbot",
            "image_tag": "latest",
            "size_mb": random.randint(450, 550),
            "last_updated": datetime.now() - timedelta(days=random.randint(1, 7)),
            "status": "ready",
            "description": "AI 콜봇 서비스 - 음성 기반 고객 상담"
        },
        "chatbot": {
            "image_name": "ecp-ai/chatbot", 
            "image_tag": "latest",
            "size_mb": random.randint(400, 500),
            "last_updated": datetime.now() - timedelta(days=random.randint(1, 7)),
            "status": "ready",
            "description": "AI 챗봇 서비스 - 텍스트 기반 고객 상담"
        },
        "advisor": {
            "image_name": "ecp-ai/advisor",
            "image_tag": "latest", 
            "size_mb": random.randint(600, 700),
            "last_updated": datetime.now() - timedelta(days=random.randint(1, 7)),
            "status": "ready",
            "description": "AI 어드바이저 서비스 - 개인화 추천 시스템"
        },
        
        # GPU 전용 서비스들
        "tts-server": {
            "image_name": "ecp-ai/tts-server",
            "image_tag": "latest",
            "size_mb": random.randint(800, 1000),
            "last_updated": datetime.now() - timedelta(days=random.randint(1, 5)),
            "status": "ready",
            "description": "GPU 기반 Text-to-Speech 서비스"
        },
        "nlp-server": {
            "image_name": "ecp-ai/nlp-server", 
            "image_tag": "latest",
            "size_mb": random.randint(1200, 1500),
            "last_updated": datetime.now() - timedelta(days=random.randint(1, 5)),
            "status": "ready",
            "description": "GPU 기반 Natural Language Processing 서비스"
        },
        "aicm-server": {
            "image_name": "ecp-ai/aicm-server",
            "image_tag": "latest",
            "size_mb": random.randint(1000, 1200),
            "last_updated": datetime.now() - timedelta(days=random.randint(1, 5)),
            "status": "ready", 
            "description": "GPU 기반 AI Content Management 서비스"
        },
        
        # CPU 전용 서비스들
        "stt-server": {
            "image_name": "ecp-ai/stt-server",
            "image_tag": "latest",
            "size_mb": random.randint(300, 400),
            "last_updated": datetime.now() - timedelta(days=random.randint(1, 3)),
            "status": "ready",
            "description": "CPU 기반 Speech-to-Text 서비스"
        },
        "ta-server": {
            "image_name": "ecp-ai/ta-server",
            "image_tag": "latest",
            "size_mb": random.randint(250, 350),
            "last_updated": datetime.now() - timedelta(days=random.randint(1, 3)),
            "status": "ready",
            "description": "CPU 기반 Text Analysis 서비스"
        },
        "qa-server": {
            "image_name": "ecp-ai/qa-server",
            "image_tag": "latest",
            "size_mb": random.randint(350, 450),
            "last_updated": datetime.now() - timedelta(days=random.randint(1, 3)),
            "status": "ready",
            "description": "CPU 기반 Question Answering 서비스"
        },
        
        # 인프라 서비스들
        "infrastructure": {
            "image_name": "ecp-ai/infrastructure",
            "image_tag": "latest",
            "size_mb": random.randint(150, 250),
            "last_updated": datetime.now() - timedelta(days=random.randint(1, 2)),
            "status": "ready",
            "description": "인프라 관리 서비스"
        },
        "database": {
            "image_name": "ecp-ai/database",
            "image_tag": "latest",
            "size_mb": random.randint(200, 300),
            "last_updated": datetime.now() - timedelta(days=random.randint(1, 2)),
            "status": "ready",
            "description": "데이터베이스 서비스"
        },
        "monitoring": {
            "image_name": "ecp-ai/monitoring",
            "image_tag": "latest",
            "size_mb": random.randint(100, 200),
            "last_updated": datetime.now() - timedelta(days=random.randint(1, 2)),
            "status": "ready",
            "description": "모니터링 서비스"
        },
        
        # 기타 서비스들
        "api-gateway": {
            "image_name": "ecp-ai/api-gateway",
            "image_tag": "latest",
            "size_mb": random.randint(80, 150),
            "last_updated": datetime.now() - timedelta(days=random.randint(1, 2)),
            "status": "ready",
            "description": "API Gateway 서비스"
        },
        "auth-service": {
            "image_name": "ecp-ai/auth-service",
            "image_tag": "latest",
            "size_mb": random.randint(120, 180),
            "last_updated": datetime.now() - timedelta(days=random.randint(1, 2)),
            "status": "ready",
            "description": "인증 서비스"
        },
        "ai_service": {
            "image_name": "ecp-ai/ai-service",
            "image_tag": "latest",
            "size_mb": random.randint(500, 600),
            "last_updated": datetime.now() - timedelta(days=random.randint(1, 3)),
            "status": "ready",
            "description": "통합 AI 서비스"
        }
    }
    
    return virtual_images

@router.get("/overview")
async def get_statistics_overview(db: Session = Depends(get_db_session)):
    """
    전체 통계 개요 조회
    - 총 테넌시 수, 활성 테넌시 수, 서비스별 분포 등
    """
    try:
        # [advice from AI] 실제 DB 기반 통계 계산
        total_tenants = db.query(func.count(Tenant.tenant_id)).scalar()
        active_tenants = db.query(func.count(Tenant.tenant_id)).filter(
            Tenant.status == 'running'
        ).scalar()
        
        # 테넌시별 프리셋 분포
        tenants_by_preset = db.query(
            Tenant.preset,
            func.count(Tenant.tenant_id).label('count')
        ).group_by(Tenant.preset).all()
        
        # 서비스별 테넌시 수 (CICD 기준 20개 서비스)
        service_distribution = {
            'callbot': 0,
            'chatbot': 0, 
            'advisor': 0,
            'stt': 0,
            'tts': 0,
            'ta': 0,
            'qa': 0,
            'nlp': 0,
            'aicm': 0,
            'tts-server': 0,
            'nlp-server': 0,
            'aicm-server': 0,
            'stt-server': 0,
            'ta-server': 0,
            'qa-server': 0,
            'infrastructure': 0,
            'database': 0,
            'monitoring': 0,
            'ai_service': 0,
            'total_services': 20  # CICD 기준 총 서비스 수
        }
        
        # 실제 배포된 서비스 수 계산
        deployed_services = 0
        for tenant in db.query(Tenant).filter(Tenant.status == 'running').all():
            if tenant.services:
                deployed_services += len(tenant.services)
        
        # 리소스 사용량 계산
        total_cpu = 0
        total_memory = 0
        total_gpu = 0
        
        for tenant in db.query(Tenant).filter(Tenant.status == 'running').all():
            if tenant.cpu_limit:
                total_cpu += _parse_resource_value(tenant.cpu_limit)
            if tenant.memory_limit:
                total_memory += _parse_resource_value(tenant.memory_limit)
            if tenant.gpu_limit:
                total_gpu += tenant.gpu_limit
        
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "overview": {
                "total_tenants": total_tenants,
                "active_tenants": active_tenants,
                "total_services": 20,  # CICD 기준
                "deployed_services": deployed_services,
                "tenants_by_preset": [
                    {"preset": preset, "count": count} 
                    for preset, count in tenants_by_preset
                ],
                "resource_usage": {
                    "total_cpu": f"{total_cpu}m",
                    "total_memory": f"{total_memory}Mi",
                    "total_gpu": total_gpu
                }
            }
        }
        
    except Exception as e:
        logger.error(f"통계 개요 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"통계 조회 실패: {str(e)}")

@router.get("/tenants")
async def get_tenant_statistics(db: Session = Depends(get_db_session)):
    """
    테넌시 상세 통계 조회
    """
    try:
        # [advice from AI] 테넌시별 상세 통계
        tenants_by_status = db.query(
            Tenant.status,
            func.count(Tenant.tenant_id).label('count')
        ).group_by(Tenant.status).all()
        
        tenants_by_preset = db.query(
            Tenant.preset,
            func.count(Tenant.tenant_id).label('count')
        ).group_by(Tenant.preset).all()
        
        # 최근 7일간 테넌시 생성 추이
        seven_days_ago = datetime.now() - timedelta(days=7)
        recent_tenants = db.query(
            func.date(Tenant.created_at).label('date'),
            func.count(Tenant.tenant_id).label('count')
        ).filter(
            Tenant.created_at >= seven_days_ago
        ).group_by(
            func.date(Tenant.created_at)
        ).order_by(
            func.date(Tenant.created_at)
        ).all()
        
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "tenants": {
                "by_status": [
                    {"status": status, "count": count} 
                    for status, count in tenants_by_status
                ],
                "by_preset": [
                    {"preset": preset, "count": count} 
                    for preset, count in tenants_by_preset
                ],
                "recent_growth": [
                    {"date": str(date), "count": count} 
                    for date, count in recent_tenants
                ]
            }
        }
        
    except Exception as e:
        logger.error(f"테넌시 통계 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"테넌시 통계 조회 실패: {str(e)}")

@router.get("/services")
async def get_service_statistics(db: Session = Depends(get_db_session)):
    """
    서비스별 통계 조회 (CICD 기준 20개 서비스)
    """
    try:
        # [advice from AI] CICD 서비스별 통계
        service_stats = {
            "callbot": {"deployed": 0, "tenants": 0, "resources": {}},
            "chatbot": {"deployed": 0, "tenants": 0, "resources": {}},
            "advisor": {"deployed": 0, "tenants": 0, "resources": {}},
            "stt": {"deployed": 0, "tenants": 0, "resources": {}},
            "tts": {"deployed": 0, "tenants": 0, "resources": {}},
            "ta": {"deployed": 0, "tenants": 0, "resources": {}},
            "qa": {"deployed": 0, "tenants": 0, "resources": {}},
            "nlp": {"deployed": 0, "tenants": 0, "resources": {}},
            "aicm": {"deployed": 0, "tenants": 0, "resources": {}},
            "tts-server": {"deployed": 0, "tenants": 0, "resources": {}},
            "nlp-server": {"deployed": 0, "tenants": 0, "resources": {}},
            "aicm-server": {"deployed": 0, "tenants": 0, "resources": {}},
            "stt-server": {"deployed": 0, "tenants": 0, "resources": {}},
            "ta-server": {"deployed": 0, "tenants": 0, "resources": {}},
            "qa-server": {"deployed": 0, "tenants": 0, "resources": {}},
            "infrastructure": {"deployed": 0, "tenants": 0, "resources": {}},
            "database": {"deployed": 0, "tenants": 0, "resources": {}},
            "monitoring": {"deployed": 0, "tenants": 0, "resources": {}},
            "ai_service": {"deployed": 0, "tenants": 0, "resources": {}}
        }
        
        # 활성 테넌시에서 서비스별 통계 계산
        active_tenants = db.query(Tenant).filter(Tenant.status == 'running').all()
        
        for tenant in active_tenants:
            if hasattr(tenant, 'services') and tenant.services:
                # [advice from AI] 서비스 데이터가 JSON 형태인지 확인
                if isinstance(tenant.services, list):
                    for service in tenant.services:
                        if isinstance(service, dict):
                            service_name = service.get('name', '').lower()
                        else:
                            service_name = str(service).lower()
                        
                        if service_name in service_stats:
                            service_stats[service_name]["deployed"] += 1
                            service_stats[service_name]["tenants"] += 1
                            
                            # 리소스 사용량 누적
                            if isinstance(service, dict):
                                if service.get('cpu_request'):
                                    current_cpu = service_stats[service_name]["resources"].get('cpu', 0)
                                    service_stats[service_name]["resources"]["cpu"] = current_cpu + _parse_resource_value(service['cpu_request'])
                                
                                if service.get('memory_request'):
                                    current_memory = service_stats[service_name]["resources"].get('memory', 0)
                                    service_stats[service_name]["resources"]["memory"] = current_memory + _parse_resource_value(service['memory_request'])
        
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "services": {
                "total_services": 20,
                "deployed_services": sum(1 for s in service_stats.values() if s["deployed"] > 0),
                "service_details": service_stats
            }
        }
        
    except Exception as e:
        logger.error(f"서비스 통계 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"서비스 통계 조회 실패: {str(e)}")

@router.get("/images")
async def get_image_statistics():
    """
    이미지별 통계 조회 (가상 데이터)
    """
    try:
        # [advice from AI] 가상 이미지 데이터 생성
        virtual_images = _generate_virtual_image_data()
        
        # 이미지 통계 계산
        total_images = len(virtual_images)
        total_size_mb = sum(img["size_mb"] for img in virtual_images.values())
        ready_images = sum(1 for img in virtual_images.values() if img["status"] == "ready")
        
        # 서비스 타입별 분류
        image_by_type = {
            "application": ["callbot", "chatbot", "advisor"],
            "gpu": ["tts-server", "nlp-server", "aicm-server"],
            "cpu": ["stt-server", "ta-server", "qa-server"],
            "infrastructure": ["infrastructure", "database", "monitoring", "api-gateway", "auth-service"]
        }
        
        # 타입별 통계
        type_stats = {}
        for img_type, services in image_by_type.items():
            type_images = {k: v for k, v in virtual_images.items() if k in services}
            type_stats[img_type] = {
                "count": len(type_images),
                "total_size_mb": sum(img["size_mb"] for img in type_images.values()),
                "services": list(type_images.keys())
            }
        
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "images": {
                "total_images": total_images,
                "total_size_mb": total_size_mb,
                "ready_images": ready_images,
                "by_type": type_stats,
                "image_details": virtual_images
            }
        }
        
    except Exception as e:
        logger.error(f"이미지 통계 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"이미지 통계 조회 실패: {str(e)}")

@router.get("/resources")
async def get_resource_statistics(db: Session = Depends(get_db_session)):
    """
    리소스 사용량 통계 조회
    """
    try:
        # [advice from AI] 리소스 사용량 통계
        active_tenants = db.query(Tenant).filter(Tenant.status == 'running').all()
        
        total_cpu = 0
        total_memory = 0
        total_gpu = 0
        total_storage = 0
        
        cpu_by_preset = {"small": 0, "medium": 0, "large": 0}
        memory_by_preset = {"small": 0, "medium": 0, "large": 0}
        gpu_by_preset = {"small": 0, "medium": 0, "large": 0}
        
        for tenant in active_tenants:
            if tenant.cpu_limit:
                cpu_value = _parse_resource_value(tenant.cpu_limit)
                total_cpu += cpu_value
                if tenant.preset in cpu_by_preset:
                    cpu_by_preset[tenant.preset] += cpu_value
            
            if tenant.memory_limit:
                memory_value = _parse_resource_value(tenant.memory_limit)
                total_memory += memory_value
                if tenant.preset in memory_by_preset:
                    memory_by_preset[tenant.preset] += memory_value
            
            if tenant.gpu_limit:
                total_gpu += tenant.gpu_limit
                if tenant.preset in gpu_by_preset:
                    gpu_by_preset[tenant.preset] += tenant.gpu_limit
            
            if tenant.storage_limit:
                storage_value = _parse_resource_value(tenant.storage_limit)
                total_storage += storage_value
        
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "resources": {
                "total_usage": {
                    "cpu": f"{total_cpu}m",
                    "memory": f"{total_memory}Mi",
                    "gpu": total_gpu,
                    "storage": f"{total_storage}Gi"
                },
                "by_preset": {
                    "cpu": cpu_by_preset,
                    "memory": memory_by_preset,
                    "gpu": gpu_by_preset
                },
                "utilization": {
                    "cpu_percent": min(100, (total_cpu / 100000) * 100),  # 예시 기준
                    "memory_percent": min(100, (total_memory / 1000000) * 100),  # 예시 기준
                    "gpu_percent": min(100, (total_gpu / 100) * 100)  # 예시 기준
                }
            }
        }
        
    except Exception as e:
        logger.error(f"리소스 통계 조회 실패: {e}")
        raise HTTPException(status_code=500, detail=f"리소스 통계 조회 실패: {str(e)}")

def _parse_resource_value(resource_str: str) -> int:
    """
    리소스 문자열을 숫자로 파싱
    예: "1000m" -> 1000, "1Gi" -> 1024
    """
    if not resource_str:
        return 0
    
    try:
        if resource_str.endswith('m'):
            return int(resource_str[:-1])
        elif resource_str.endswith('Mi'):
            return int(resource_str[:-2])
        elif resource_str.endswith('Gi'):
            return int(resource_str[:-2]) * 1024
        elif resource_str.endswith('i'):
            return int(resource_str[:-1])
        else:
            return int(resource_str)
    except ValueError:
        return 0
