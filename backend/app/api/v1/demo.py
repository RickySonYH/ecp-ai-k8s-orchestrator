# [advice from AI] ECP-AI 데모 전용 API 엔드포인트
"""
데모 환경 전용 API
- 데모 테넌시 및 서비스 조회
- 실시간 모니터링 데이터 시뮬레이션
- 데모/운영 환경 완전 분리
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.models.demo_database import get_demo_db, DemoDataGenerator, DemoTenant
from app.models.database import get_db
from typing import List, Optional
from datetime import datetime
import json
import structlog

logger = structlog.get_logger(__name__)

router = APIRouter()

# [advice from AI] 전역 가상 모니터링 에이전트 인스턴스
virtual_monitoring = DemoDataGenerator()

@router.get("/tenants/check-name/{tenant_name}")
async def check_tenant_name_duplicate(tenant_name: str, db: Session = Depends(get_demo_db)):
    """[advice from AI] 테넌시 이름 중복 체크 - 실시간 검증용"""
    try:
        # 데모 테넌시에서 이름 중복 체크
        existing_tenant = db.query(DemoTenant).filter(DemoTenant.name == tenant_name).first()
        
        is_duplicate = existing_tenant is not None
        
        return {
            "success": True,
            "tenant_name": tenant_name,
            "is_duplicate": is_duplicate,
            "message": "이미 사용 중인 테넌시 이름입니다." if is_duplicate else "사용 가능한 테넌시 이름입니다.",
            "existing_tenant_id": existing_tenant.tenant_id if existing_tenant else None
        }
    except Exception as e:
        logger.error(f"테넌시 이름 중복 체크 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"이름 중복 체크 실패: {str(e)}")

@router.post("/tenants/")
async def create_demo_tenant(tenant_data: dict, db: Session = Depends(get_demo_db)):
    """[advice from AI] 데모 테넌시 생성 - 가상 모니터링 에이전트 자동 생성"""
    try:
        # [advice from AI] 테넌시 이름 중복 체크
        tenant_name = tenant_data.get('name', '새 테넌시')
        existing_tenant = db.query(DemoTenant).filter(DemoTenant.name == tenant_name).first()
        if existing_tenant:
            raise HTTPException(
                status_code=400, 
                detail=f"이미 존재하는 테넌시 이름입니다: {tenant_name}"
            )
        
        # 테넌시 데이터 준비
        tenant_id = f"demo-{tenant_name.lower().replace(' ', '-')}-{len(db.query(DemoTenant).all()) + 1}"
        
        # 채널 기반 리소스 계산
        service_requirements = tenant_data.get('service_requirements', {})
        calculated_resources = DemoDataGenerator.calculate_resources_from_channels(service_requirements)
        
        # [advice from AI] 서버 상세 정보 생성 (IaaS 기준)
        server_details = []
        server_index = 1
        hardware_config = calculated_resources.get('hardware_config', {})
        
        # AI 처리 서버들
        for server in hardware_config.get('ai_servers', []):
            for i in range(server['server_count']):
                server_details.append({
                    'server_id': f"ai-{server_index:03d}",
                    'server_name': f"{server['server_type']} #{i+1}",
                    'server_type': server['server_type'],
                    'category': 'AI 처리 서버',
                    'instance_type': f"GPU-{server.get('gpu_type', 'T4')}-{server['cpu_cores']}C-{server['memory_gb']}GB",
                    'specifications': {
                        'cpu_cores': server['cpu_cores'],
                        'memory_gb': server['memory_gb'],
                        'gpu_count': server.get('gpu_count', 0),
                        'gpu_type': server.get('gpu_type', 'N/A'),
                        'storage_gb': server['storage_gb'],
                        'storage_type': server.get('storage_type', 'SSD')
                    },
                    'purpose': server['purpose'],
                    'status': 'running',
                    'location': f"Zone-A-Rack-{(server_index-1)//10 + 1}"
                })
                server_index += 1
        
        # 음성/텍스트 처리 서버들  
        for server in hardware_config.get('processing_servers', []):
            for i in range(server['server_count']):
                server_details.append({
                    'server_id': f"proc-{server_index:03d}",
                    'server_name': f"{server['server_type']} #{i+1}",
                    'server_type': server['server_type'],
                    'category': '음성/텍스트 처리 서버',
                    'instance_type': f"CPU-{server['cpu_cores']}C-{server['memory_gb']}GB",
                    'specifications': {
                        'cpu_cores': server['cpu_cores'],
                        'memory_gb': server['memory_gb'],
                        'gpu_count': 0,
                        'gpu_type': 'N/A',
                        'storage_gb': server['storage_gb'],
                        'storage_type': server.get('storage_type', 'SSD')
                    },
                    'purpose': server['purpose'],
                    'status': 'running',
                    'location': f"Zone-B-Rack-{(server_index-1)//10 + 1}"
                })
                server_index += 1
        
        # 공통 서비스 서버들
        for server in hardware_config.get('common_servers', []):
            for i in range(server['server_count']):
                server_details.append({
                    'server_id': f"svc-{server_index:03d}",
                    'server_name': f"{server['server_type']} #{i+1}",
                    'server_type': server['server_type'],
                    'category': '공통 서비스 서버',
                    'instance_type': f"CPU-{server['cpu_cores']}C-{server['memory_gb']}GB",
                    'specifications': {
                        'cpu_cores': server['cpu_cores'],
                        'memory_gb': server['memory_gb'],
                        'gpu_count': 0,
                        'gpu_type': 'N/A',
                        'storage_gb': server['storage_gb'],
                        'storage_type': server.get('storage_type', 'SSD')
                    },
                    'purpose': server['purpose'],
                    'status': 'running',
                    'location': f"Zone-C-Rack-{(server_index-1)//10 + 1}"
                })
                server_index += 1
        
를 ㄱ        # [advice from AI] 서버 요약 정보 계산 - 하드웨어 구성 기반으로 정확한 서버 대수 계산
        total_servers = 0
        total_cpu = 0
        total_memory = 0
        total_gpu = 0
        total_storage = 0
        
        # AI 서버들
        for server in hardware_config.get('ai_servers', []):
            server_count = server['server_count']
            total_servers += server_count
            total_cpu += server['cpu_cores'] * server_count
            total_memory += server['memory_gb'] * server_count
            total_gpu += server['gpu_count'] * server_count
            total_storage += server.get('storage_gb', 500) * server_count
            
        # 처리 서버들
        for server in hardware_config.get('processing_servers', []):
            server_count = server['server_count']
            total_servers += server_count
            total_cpu += server['cpu_cores'] * server_count
            total_memory += server['memory_gb'] * server_count
            total_storage += server.get('storage_gb', 500) * server_count
            
        # 공통 서버들
        for server in hardware_config.get('common_servers', []):
            server_count = server['server_count']
            total_servers += server_count
            total_cpu += server['cpu_cores'] * server_count
            total_memory += server['memory_gb'] * server_count
            total_storage += server.get('storage_gb', 500) * server_count
        
        server_summary = {
            'total_servers': total_servers,
            'total_cpu': total_cpu,
            'total_memory': total_memory,
            'total_gpu': total_gpu,
            'total_storage': total_storage
        }
        
        # [advice from AI] 테넌시 생성 - 모든 정보 저장
        new_tenant = DemoTenant(
            tenant_id=tenant_id,
            name=tenant_data.get('name', '새 테넌시'),
            preset=tenant_data.get('preset', 'small'),
            status="running",
            demo_category="user_created",
            cpu_limit=f"{server_summary['total_cpu']} 코어",
            memory_limit=f"{server_summary['total_memory']}GB",
            gpu_limit=server_summary['total_gpu'],
            storage_limit=f"{server_summary['total_storage']/1000:.1f}TB",
            gpu_type='v100' if server_summary['total_gpu'] >= 4 else 't4',
            sla_availability='99.9%' if server_summary['total_gpu'] >= 4 else '99.5%',
            sla_response_time='<200ms' if server_summary['total_gpu'] >= 4 else '<500ms',
            description=f"서버 {server_summary['total_servers']}대: GPU {server_summary['total_gpu']}개, CPU {server_summary['total_cpu']}코어, RAM {server_summary['total_memory']}GB",
            # [advice from AI] 상세 정보 저장
            server_details=server_details,
            hardware_config=hardware_config,
            service_requirements=service_requirements,
            server_summary=server_summary,
            manifest_data={}  # 매니페스트는 추후 추가
        )
        
        # DB에 저장
        db.add(new_tenant)
        db.commit()
        db.refresh(new_tenant)
        
        # [advice from AI] 가상 리소스 모니터링 에이전트 자동 생성
        virtual_monitoring.create_virtual_monitoring_agent(tenant_id, service_requirements)
        
        print(f"[Demo API] 테넌시 생성 완료: {tenant_id}, 가상 모니터링 에이전트 생성됨")
        
        return {"success": True, "tenant": {
            "tenant_id": new_tenant.tenant_id,
            "name": new_tenant.name,
            "preset": new_tenant.preset,
            "status": new_tenant.status,
            "demo_category": new_tenant.demo_category,
            "cpu_limit": new_tenant.cpu_limit,
            "memory_limit": new_tenant.memory_limit,
            "gpu_limit": new_tenant.gpu_limit,
            "storage_limit": new_tenant.storage_limit,
            "gpu_type": new_tenant.gpu_type,
            "sla_availability": new_tenant.sla_availability,
            "sla_response_time": new_tenant.sla_response_time,
            "description": new_tenant.description,
            "hardware_config": calculated_resources.get('hardware_config', {}),
            "service_requirements": service_requirements
        }, "message": "테넌시가 성공적으로 생성되었습니다."}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"테넌시 생성 실패: {str(e)}")

@router.delete("/tenants/{tenant_id}/")
async def delete_demo_tenant(tenant_id: str, db: Session = Depends(get_demo_db)):
    """[advice from AI] 데모 테넌시 삭제 - 가상 모니터링 에이전트 자동 제거"""
    try:
        # 테넌시 조회
        tenant = db.query(DemoTenant).filter(DemoTenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="테넌시를 찾을 수 없습니다.")
        
        # [advice from AI] 가상 리소스 모니터링 에이전트 자동 제거
        virtual_monitoring.remove_virtual_monitoring_agent(tenant_id)
        
        # DB에서 삭제
        db.delete(tenant)
        db.commit()
        
        print(f"[Demo API] 테넌시 삭제 완료: {tenant_id}, 가상 모니터링 에이전트 제거됨")
        
        return {"success": True, "message": "테넌시가 성공적으로 삭제되었습니다."}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"테넌시 삭제 실패: {str(e)}")

@router.post("/tenants/recalculate-all/")
async def recalculate_all_tenants(db: Session = Depends(get_demo_db)):
    """[advice from AI] 모든 테넌시의 서버 요약 정보 재계산 - 정확한 서버 대수 확보"""
    try:
        tenants = db.query(DemoTenant).all()
        updated_count = 0
        
        for tenant in tenants:
            if tenant.service_requirements:
                # 하드웨어 구성 재계산
                hardware_config = DemoDataGenerator.generate_hardware_configuration(tenant.service_requirements)
                
                # 정확한 서버 대수 계산
                total_servers = 0
                total_cpu = 0
                total_memory = 0
                total_gpu = 0
                total_storage = 0
                
                # AI 서버들
                for server in hardware_config.get('ai_servers', []):
                    server_count = server['server_count']
                    total_servers += server_count
                    total_cpu += server['cpu_cores'] * server_count
                    total_memory += server['memory_gb'] * server_count
                    total_gpu += server['gpu_count'] * server_count
                    total_storage += server.get('storage_gb', 500) * server_count
                    
                # 처리 서버들
                for server in hardware_config.get('processing_servers', []):
                    server_count = server['server_count']
                    total_servers += server_count
                    total_cpu += server['cpu_cores'] * server_count
                    total_memory += server['memory_gb'] * server_count
                    total_storage += server.get('storage_gb', 500) * server_count
                    
                # 공통 서버들
                for server in hardware_config.get('common_servers', []):
                    server_count = server['server_count']
                    total_servers += server_count
                    total_cpu += server['cpu_cores'] * server_count
                    total_memory += server['memory_gb'] * server_count
                    total_storage += server.get('storage_gb', 500) * server_count
                
                # 서버 요약 업데이트
                new_server_summary = {
                    'total_servers': total_servers,
                    'total_cpu': total_cpu,
                    'total_memory': total_memory,
                    'total_gpu': total_gpu,
                    'total_storage': total_storage
                }
                
                # DB 업데이트
                tenant.server_summary = new_server_summary
                tenant.hardware_config = hardware_config
                tenant.cpu_limit = f"{total_cpu} 코어"
                tenant.memory_limit = f"{total_memory}GB"
                tenant.gpu_limit = total_gpu
                tenant.storage_limit = f"{total_storage/1000:.1f}TB"
                tenant.description = f"서버 {total_servers}대: GPU {total_gpu}개, CPU {total_cpu}코어, RAM {total_memory}GB"
                
                updated_count += 1
                logger.info(f"테넌시 {tenant.tenant_id} 서버 요약 재계산 완료: {total_servers}대")
        
        db.commit()
        
        return {
            "success": True,
            "message": f"{updated_count}개 테넌시의 서버 정보가 재계산되었습니다.",
            "updated_count": updated_count
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"테넌시 재계산 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=f"재계산 실패: {str(e)}")

@router.get("/tenants/")
async def list_demo_tenants(db: Session = Depends(get_demo_db)):
    """[advice from AI] 데모 테넌시 목록 조회 - 모니터링 에이전트 자동 복구"""
    try:
        tenants = db.query(DemoTenant).all()
        
        result = []
        for tenant in tenants:
            # [advice from AI] 모니터링 에이전트가 없으면 자동 생성
            if tenant.tenant_id not in virtual_monitoring.virtual_monitoring_agents:
                # GPU 수를 기반으로 서비스 요구사항 추정
                estimated_channels = tenant.gpu_limit * 25  # GPU당 25채널 추정
                service_requirements = {
                    'callbot': int(estimated_channels * 0.6),
                    'chatbot': int(estimated_channels * 0.3), 
                    'advisor': int(estimated_channels * 0.1),
                    'stt': 1,
                    'tts': 1,
                    'ta': 0,
                    'qa': 0
                }
                
                # 모니터링 에이전트 생성
                virtual_monitoring.create_virtual_monitoring_agent(
                    tenant.tenant_id, 
                    service_requirements
                )
                logger.info(f"[Auto Recovery] 테넌시 {tenant.tenant_id} 모니터링 에이전트 자동 복구")
            
            # [advice from AI] 저장된 서버 요약 정보 사용
            server_summary = tenant.server_summary or {"total_servers": 0, "total_cpu": 0, "total_memory": 0, "total_gpu": 0}
            
            # [advice from AI] 서비스 요구사항에서 총 채널/서버 수 계산
            service_requirements = tenant.service_requirements or {}
            total_channels = sum([
                service_requirements.get('callbot', 0),
                service_requirements.get('chatbot', 0), 
                service_requirements.get('advisor', 0)
            ])
            # [advice from AI] 총 서버 수 (실질 인스턴스 수)
            total_servers = server_summary.get('total_servers', 0)
            
            result.append({
                "tenant_id": tenant.tenant_id,
                "name": tenant.name,
                "preset": tenant.preset,
                "status": tenant.status,
                "demo_category": tenant.demo_category,
                "cpu_limit": tenant.cpu_limit,
                "memory_limit": tenant.memory_limit,
                "gpu_limit": tenant.gpu_limit,
                "storage_limit": tenant.storage_limit,
                "gpu_type": tenant.gpu_type,
                "sla_availability": tenant.sla_availability,
                "sla_response_time": tenant.sla_response_time,
                "description": tenant.description,
                "created_at": tenant.created_at,
                "updated_at": tenant.updated_at,
                "server_summary": server_summary,  # [advice from AI] 서버 요약 정보 추가
                "total_channels": total_channels,  # [advice from AI] 총 채널 수 추가
                "total_servers": total_servers,  # [advice from AI] 총 서버 수 (실질 인스턴스) 추가
                "service_requirements": service_requirements  # [advice from AI] 서비스 요구사항 추가
            })
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"테넌시 목록 조회 실패: {str(e)}")

@router.get("/monitoring/system/")
async def get_demo_system_metrics():
    """[advice from AI] 데모 시스템 메트릭 조회 - 가상 모니터링 에이전트 사용"""
    try:
        # 가상 모니터링 데이터 업데이트
        virtual_monitoring.update_virtual_monitoring_data()
        
        # 가상 시스템 메트릭 조회
        metrics = virtual_monitoring.get_virtual_system_metrics()
        
        # 빈 상태일 때 기본 메트릭 제공
        if not metrics:
            metrics = {
                "total_gpu": 0,
                "total_cpu": 0,
                "total_memory": 0,
                "total_gpu_usage": 0,
                "total_cpu_usage": 0,
                "total_memory_usage": 0,
                "total_tenants": 0,
                "total_services": 0,
                "cluster_health": "healthy"
            }
        
        return {
            "success": True,
            "data": metrics,
            "message": "가상 모니터링 에이전트에서 생성된 시스템 메트릭"
        }
        
    except Exception as e:
        # 오류 발생 시에도 기본 메트릭 반환
        return {
            "success": True,
            "data": {
                "total_gpu": 0,
                "total_cpu": 0,
                "total_memory": 0,
                "total_gpu_usage": 0,
                "total_cpu_usage": 0,
                "total_memory_usage": 0,
                "total_tenants": 0,
                "total_services": 0,
                "cluster_health": "healthy"
            },
            "message": "기본 시스템 메트릭 (초기 상태)"
        }

@router.get("/monitoring/tenants/{tenant_id}/")
async def get_demo_tenant_metrics(tenant_id: str):
    """[advice from AI] 특정 데모 테넌시 메트릭 조회"""
    try:
        # 가상 모니터링 데이터 업데이트
        virtual_monitoring.update_virtual_monitoring_data()
        
        # 특정 테넌시 메트릭 조회
        metrics = virtual_monitoring.get_virtual_tenant_metrics(tenant_id)
        
        if not metrics:
            raise HTTPException(status_code=404, detail="테넌시 모니터링 데이터를 찾을 수 없습니다.")
        
        return {
            "success": True,
            "data": metrics,
            "message": "가상 모니터링 에이전트에서 생성된 테넌시 메트릭"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"테넌시 메트릭 조회 실패: {str(e)}")

@router.get("/tenants/{tenant_id}/hardware-config/")
async def get_tenant_hardware_config(tenant_id: str, db: Session = Depends(get_demo_db)):
    """[advice from AI] 테넌시별 하드웨어 구성 정보 조회"""
    try:
        # 테넌시 조회
        tenant = db.query(DemoTenant).filter(DemoTenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="테넌시를 찾을 수 없습니다.")
        
        # 가상 모니터링 에이전트에서 서비스 요구사항 조회
        agent = virtual_monitoring.virtual_monitoring_agents.get(tenant_id)
        if not agent:
            # 기본 서비스 요구사항으로 하드웨어 구성 재생성
            service_requirements = {"callbot": 0, "chatbot": 0, "advisor": 0, "stt": 0, "tts": 0, "ta": 0, "qa": 0}
        else:
            service_requirements = agent.get('service_requirements', {})
        
        # 하드웨어 구성 정보 생성
        hardware_config = DemoDataGenerator.generate_hardware_configuration(service_requirements)
        
        return {
            "success": True,
            "tenant_id": tenant_id,
            "hardware_config": hardware_config,
            "tenant_info": {
                "name": tenant.name,
                "status": tenant.status,
                "preset": tenant.preset,
                "gpu_limit": tenant.gpu_limit,
                "cpu_limit": tenant.cpu_limit,
                "memory_limit": tenant.memory_limit,
                "created_at": tenant.created_at
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"하드웨어 구성 조회 실패: {str(e)}")

@router.get("/tenants/{tenant_id}/servers/")
async def get_tenant_servers_monitoring(tenant_id: str):
    """[advice from AI] 테넌시별 서버 모니터링 데이터 조회 - 실시간 가변 데이터"""
    try:
        # 가상 모니터링 데이터 업데이트
        virtual_monitoring.update_virtual_monitoring_data()
        
        # 테넌시 모니터링 에이전트 조회
        agent = virtual_monitoring.virtual_monitoring_agents.get(tenant_id)
        if not agent:
            raise HTTPException(status_code=404, detail="테넌시 모니터링 데이터를 찾을 수 없습니다.")
        
        # 서버별 모니터링 데이터 수집
        servers_data = []
        for server_id, server_agent in agent.get('server_agents', {}).items():
            server_config = server_agent['server_config']
            current_metrics = server_agent['current_metrics']
            
            servers_data.append({
                'server_id': server_id,
                'server_type': server_config['server_type'],
                'server_category': server_agent['server_category'],
                'gpu_type': server_config.get('gpu_type', 'N/A'),
                'specifications': {
                    'cpu_cores': server_config['cpu_cores'],
                    'memory_gb': server_config['memory_gb'],
                    'gpu_count': server_config.get('gpu_count', 0),
                    'storage_gb': server_config['storage_gb'],
                    'storage_type': server_config.get('storage_type', 'HDD')
                },
                'current_metrics': {
                    'cpu_usage': round(current_metrics['cpu_usage'], 1),
                    'memory_usage': round(current_metrics['memory_usage'], 1),
                    'gpu_usage': round(current_metrics.get('gpu_usage', 0), 1),
                    'network_in': round(current_metrics['network_in'], 1),
                    'network_out': round(current_metrics['network_out'], 1),
                    'disk_usage': round(current_metrics['disk_usage'], 1),
                    'disk_io_read': round(current_metrics['disk_io_read'], 1),
                    'disk_io_write': round(current_metrics['disk_io_write'], 1),
                    'temperature': round(current_metrics['temperature'], 1),
                    'power_usage': round(current_metrics['power_usage'], 1)
                },
                'status': server_agent['status'],
                'uptime': server_agent['uptime'],
                'trend_direction': server_agent['trend_direction'],
                'purpose': server_config['purpose'],
                'last_update': server_agent['last_update'].isoformat()
            })
        
        # 카테고리별 그룹화
        grouped_servers = {
            'ai_servers': [s for s in servers_data if s['server_category'] == 'ai_server'],
            'processing_servers': [s for s in servers_data if s['server_category'] == 'processing_server'],
            'common_servers': [s for s in servers_data if s['server_category'] == 'common_server']
        }
        
        return {
            "success": True,
            "tenant_id": tenant_id,
            "servers": grouped_servers,
            "total_servers": len(servers_data),
            "hardware_config": agent.get('hardware_config', {}),
            "last_update": agent['last_update'].isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"서버 모니터링 데이터 조회 실패: {str(e)}")

@router.get("/tenants/{tenant_id}/server-details/")
async def get_tenant_server_details(tenant_id: str, db: Session = Depends(get_demo_db)):
    """[advice from AI] 테넌시별 서버 상세 정보 조회 - 저장된 데이터 사용"""
    try:
        # DB에서 테넌시 정보 조회
        tenant = db.query(DemoTenant).filter(DemoTenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="테넌시 정보를 찾을 수 없습니다.")
        
        # [advice from AI] 저장된 정보 사용 - 동적 계산 불필요
        server_details = tenant.server_details or []
        service_requirements = tenant.service_requirements or {}
        server_summary = tenant.server_summary or {}
        
        return {
            "success": True,
            "tenant_id": tenant_id,
            "service_requirements": service_requirements,
            "server_details": server_details,
            "summary": server_summary,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"서버 상세 정보 조회 실패: {str(e)}")

@router.get("/system-metrics/")
async def get_demo_system_metrics():
    """[advice from AI] 데모 시스템 전체 메트릭 조회 - 테넌시 합계 기반"""
    try:
        # 가상 모니터링 데이터 업데이트
        virtual_monitoring.update_virtual_monitoring_data()
        
        # 시스템 전체 메트릭 조회
        system_metrics = virtual_monitoring.get_virtual_system_metrics()
        
        return {
            "success": True,
            "system_metrics": system_metrics,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"시스템 메트릭 조회 실패: {str(e)}")
        # 에러 시 기본값 반환
        return {
            "success": False,
            "system_metrics": {
                'total_gpu': 0,
                'total_cpu': 0, 
                'total_memory': 0,
                'total_gpu_usage': 0,
                'total_cpu_usage': 0,
                'total_memory_usage': 0
            },
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }
