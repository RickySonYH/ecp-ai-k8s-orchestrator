# [advice from AI] K8S 매니페스트 파서 및 가상 인스턴스 시뮬레이터
import yaml
import json
import asyncio
import random
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from core.database import get_db, K8sResource
import logging

logger = logging.getLogger(__name__)

class K8sSimulator:
    """쿠버네티스 시뮬레이터 메인 클래스"""
    
    def __init__(self):
        self.resources: Dict[str, Dict] = {}
        self.running = False
    
    async def parse_manifest(self, manifest_content: str) -> Dict[str, Any]:
        """YAML 매니페스트 파일 파싱"""
        try:
            # Parse YAML content - always try multi-document first
            parsed_resources = []
            try:
                # Try multi-document parsing
                documents = yaml.safe_load_all(manifest_content)
                for doc in documents:
                    if doc and isinstance(doc, dict):
                        parsed_resources.append(doc)
            except:
                # Fallback to single document
                single_doc = yaml.safe_load(manifest_content)
                if single_doc and isinstance(single_doc, dict):
                    parsed_resources = [single_doc]
            
            result = {
                "status": "success",
                "resources": parsed_resources,
                "count": len(parsed_resources)
            }
            
            logger.info(f"Parsed {len(parsed_resources)} K8S resources")
            return result
            
        except yaml.YAMLError as e:
            logger.error(f"YAML parsing error: {e}")
            return {
                "status": "error",
                "message": f"YAML parsing failed: {str(e)}",
                "resources": [],
                "count": 0
            }
    
    async def deploy_resources(self, resources: List[Dict[str, Any]]) -> Dict[str, Any]:
        """리소스 배포 시뮬레이션"""
        deployed_resources = []
        
        for resource in resources:
            try:
                # Extract basic info
                kind = resource.get('kind', 'Unknown')
                metadata = resource.get('metadata', {})
                name = metadata.get('name', 'unnamed')
                namespace = metadata.get('namespace', 'default')
                
                # Generate resource ID
                resource_id = f"{namespace}/{kind}/{name}"
                
                # Simulate deployment process
                deployed_resource = await self._simulate_resource_deployment(resource_id, resource)
                deployed_resources.append(deployed_resource)
                
                # Store in database
                await self._store_resource_in_db(deployed_resource)
                
                logger.info(f"Deployed resource: {resource_id}")
                
            except Exception as e:
                logger.error(f"Resource deployment error: {e}")
                deployed_resources.append({
                    "id": f"error/{name}",
                    "status": "Failed",
                    "error": str(e)
                })
        
        return {
            "status": "completed",
            "deployed_count": len([r for r in deployed_resources if r.get('status') != 'Failed']),
            "failed_count": len([r for r in deployed_resources if r.get('status') == 'Failed']),
            "resources": deployed_resources
        }
    
    async def _simulate_resource_deployment(self, resource_id: str, resource: Dict[str, Any]) -> Dict[str, Any]:
        """개별 리소스 배포 시뮬레이션"""
        kind = resource.get('kind', 'Unknown')
        metadata = resource.get('metadata', {})
        spec = resource.get('spec', {})
        
        # Simulate deployment time based on resource type
        deployment_delay = {
            'Pod': random.uniform(2, 5),
            'Service': random.uniform(1, 3),
            'Deployment': random.uniform(3, 8),
            'ConfigMap': random.uniform(0.5, 1),
            'Secret': random.uniform(0.5, 1)
        }.get(kind, 2)
        
        # Simulate deployment process
        deployed_resource = {
            "id": resource_id,
            "name": metadata.get('name'),
            "namespace": metadata.get('namespace', 'default'),
            "kind": kind,
            "status": "Pending",
            "manifest": resource,
            "created_at": datetime.now().isoformat(),
            "deployment_time": deployment_delay
        }
        
        # Add specific fields based on resource type
        if kind == 'Pod':
            deployed_resource.update({
                "phase": "Pending",
                "containers": len(spec.get('containers', [])),
                "node": f"node-{random.randint(1, 5)}"
            })
        elif kind == 'Service':
            deployed_resource.update({
                "type": spec.get('type', 'ClusterIP'),
                "ports": spec.get('ports', []),
                "cluster_ip": f"10.0.{random.randint(1, 255)}.{random.randint(1, 255)}"
            })
        elif kind == 'Deployment':
            replicas = spec.get('replicas', 1)
            deployed_resource.update({
                "replicas": replicas,
                "ready_replicas": 0,
                "available_replicas": 0
            })
        
        # Store in memory
        self.resources[resource_id] = deployed_resource
        
        # Simulate async deployment completion
        asyncio.create_task(self._complete_deployment(resource_id, deployment_delay))
        
        return deployed_resource
    
    async def _complete_deployment(self, resource_id: str, delay: float):
        """배포 완료 시뮬레이션"""
        await asyncio.sleep(delay)
        
        if resource_id in self.resources:
            resource = self.resources[resource_id]
            
            # Simulate success/failure (95% success rate)
            if random.random() < 0.95:
                resource['status'] = 'Running'
                
                # Update specific fields
                if resource['kind'] == 'Pod':
                    resource['phase'] = 'Running'
                elif resource['kind'] == 'Deployment':
                    replicas = resource.get('replicas', 1)
                    resource['ready_replicas'] = replicas
                    resource['available_replicas'] = replicas
                    
            else:
                resource['status'] = 'Failed'
                resource['error'] = 'Simulated deployment failure'
            
            resource['updated_at'] = datetime.now().isoformat()
            
            # Update in database
            await self._update_resource_in_db(resource)
    
    async def _store_resource_in_db(self, resource: Dict[str, Any]):
        """리소스를 데이터베이스에 저장"""
        try:
            db = next(get_db())
            db_resource = K8sResource(
                name=resource['name'],
                namespace=resource['namespace'],
                kind=resource['kind'],
                status=resource['status'],
                manifest=resource['manifest']
            )
            db.add(db_resource)
            db.commit()
            db.close()
        except Exception as e:
            logger.error(f"Database storage error: {e}")
    
    async def _update_resource_in_db(self, resource: Dict[str, Any]):
        """데이터베이스의 리소스 상태 업데이트"""
        try:
            db = next(get_db())
            db_resource = db.query(K8sResource).filter(
                K8sResource.name == resource['name'],
                K8sResource.namespace == resource['namespace'],
                K8sResource.kind == resource['kind']
            ).first()
            
            if db_resource:
                db_resource.status = resource['status']
                db.commit()
            db.close()
        except Exception as e:
            logger.error(f"Database update error: {e}")
    
    async def get_resources(self, namespace: Optional[str] = None, kind: Optional[str] = None) -> List[Dict[str, Any]]:
        """배포된 리소스 목록 조회"""
        filtered_resources = []
        
        for resource_id, resource in self.resources.items():
            if namespace and resource.get('namespace') != namespace:
                continue
            if kind and resource.get('kind') != kind:
                continue
            filtered_resources.append(resource)
        
        return filtered_resources
    
    async def delete_resource(self, name: str, namespace: str = "default", kind: str = None) -> Dict[str, Any]:
        """리소스 삭제"""
        resource_id = f"{namespace}/{kind}/{name}" if kind else None
        
        # Find resource
        found_resource = None
        for rid, resource in self.resources.items():
            if resource.get('name') == name and resource.get('namespace') == namespace:
                if not kind or resource.get('kind') == kind:
                    found_resource = rid
                    break
        
        if found_resource:
            deleted_resource = self.resources.pop(found_resource)
            return {
                "status": "deleted",
                "resource": deleted_resource
            }
        else:
            return {
                "status": "not_found",
                "message": f"Resource {name} not found"
            }
