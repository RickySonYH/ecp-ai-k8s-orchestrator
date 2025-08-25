# [advice from AI] ECP-AI 배포 상태 모니터링 및 검증 시스템
"""
배포 상태 모니터링 및 검증 시스템
- Kubernetes 배포 상태 실시간 모니터링
- 이미지 버전과 매니페스트 일치성 검증
- 배포 실패 시 자동 롤백
- 배포 성공률 및 성능 메트릭 수집
"""

import asyncio
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from enum import Enum
import structlog
import yaml
import json

from .image_version_tracker import ImageVersionTracker, ImageVersion, DeploymentRecord, DeploymentStatus
from .k8s_orchestrator import K8sOrchestrator

logger = structlog.get_logger(__name__)


class DeploymentHealth(str, Enum):
    """배포 상태"""
    HEALTHY = "healthy"
    WARNING = "warning"
    CRITICAL = "critical"
    UNKNOWN = "unknown"


@dataclass
class DeploymentMetrics:
    """배포 메트릭"""
    deployment_name: str
    namespace: str
    replicas_desired: int
    replicas_available: int
    replicas_ready: int
    replicas_updated: int
    replicas_unavailable: int
    deployment_age: timedelta
    last_update_time: datetime
    health_status: DeploymentHealth
    image_version: str
    manifest_version: str
    version_mismatch: bool


class DeploymentMonitor:
    """배포 상태 모니터링 시스템"""
    
    def __init__(self, k8s_orchestrator: K8sOrchestrator, 
                 image_tracker: ImageVersionTracker):
        self.k8s_orchestrator = k8s_orchestrator
        self.image_tracker = image_tracker
        self.monitoring_interval = 30  # 30초마다 체크
        self.is_monitoring = False
        self.deployment_cache: Dict[str, DeploymentMetrics] = {}
        
        logger.info("DeploymentMonitor 초기화 완료")
    
    async def start_monitoring(self):
        """모니터링 시작"""
        if self.is_monitoring:
            logger.warning("모니터링이 이미 실행 중입니다")
            return
        
        self.is_monitoring = True
        logger.info("배포 모니터링 시작")
        
        try:
            while self.is_monitoring:
                await self._monitor_deployments()
                await asyncio.sleep(self.monitoring_interval)
        except Exception as e:
            logger.error("모니터링 중 오류 발생", error=str(e))
            self.is_monitoring = False
        finally:
            logger.info("배포 모니터링 종료")
    
    def stop_monitoring(self):
        """모니터링 중지"""
        self.is_monitoring = False
        logger.info("배포 모니터링 중지 요청됨")
    
    async def _monitor_deployments(self):
        """배포 상태 모니터링"""
        try:
            # 모든 네임스페이스의 배포 상태 확인
            namespaces = await self.k8s_orchestrator.list_namespaces()
            
            for namespace in namespaces:
                deployments = await self.k8s_orchestrator.list_deployments(namespace)
                
                for deployment in deployments:
                    await self._check_deployment_health(deployment, namespace)
            
            # 캐시된 메트릭 정리 (오래된 데이터 제거)
            self._cleanup_old_metrics()
            
        except Exception as e:
            logger.error("배포 모니터링 중 오류", error=str(e))
    
    async def _check_deployment_health(self, deployment_name: str, namespace: str):
        """개별 배포 상태 확인"""
        try:
            # Kubernetes API에서 배포 상태 조회
            deployment_info = await self.k8s_orchestrator.get_deployment_info(
                deployment_name, namespace
            )
            
            if not deployment_info:
                return
            
            # 이미지 버전 정보 추출
            image_version = self._extract_image_version(deployment_info)
            
            # 매니페스트 파일에서 이미지 버전 확인
            manifest_version = await self._get_manifest_image_version(
                deployment_name, namespace
            )
            
            # 버전 일치성 검증
            version_mismatch = image_version != manifest_version
            
            # 배포 메트릭 생성
            metrics = DeploymentMetrics(
                deployment_name=deployment_name,
                namespace=namespace,
                replicas_desired=deployment_info.get('replicas_desired', 0),
                replicas_available=deployment_info.get('replicas_available', 0),
                replicas_ready=deployment_info.get('replicas_ready', 0),
                replicas_updated=deployment_info.get('replicas_updated', 0),
                replicas_unavailable=deployment_info.get('replicas_unavailable', 0),
                deployment_age=deployment_info.get('age', timedelta()),
                last_update_time=datetime.now(),
                health_status=self._calculate_health_status(deployment_info),
                image_version=image_version or "unknown",
                manifest_version=manifest_version or "unknown",
                version_mismatch=version_mismatch
            )
            
            # 메트릭 캐시에 저장
            cache_key = f"{namespace}:{deployment_name}"
            self.deployment_cache[cache_key] = metrics
            
            # 버전 불일치 시 경고 로그
            if version_mismatch:
                logger.warning("배포 버전 불일치 감지", 
                              deployment_name=deployment_name,
                              namespace=namespace,
                              image_version=image_version,
                              manifest_version=manifest_version)
            
            # 배포 상태가 비정상인 경우 자동 롤백 검토
            if metrics.health_status == DeploymentHealth.CRITICAL:
                await self._consider_auto_rollback(deployment_name, namespace)
            
        except Exception as e:
            logger.error("배포 상태 확인 실패", 
                        deployment_name=deployment_name,
                        namespace=namespace,
                        error=str(e))
    
    def _extract_image_version(self, deployment_info: Dict[str, Any]) -> Optional[str]:
        """배포 정보에서 이미지 버전 추출"""
        try:
            containers = deployment_info.get('spec', {}).get('template', {}).get('spec', {}).get('containers', [])
            if containers:
                image = containers[0].get('image', '')
                if ':' in image:
                    return image.split(':')[1]
            return None
        except Exception as e:
            logger.error("이미지 버전 추출 실패", error=str(e))
            return None
    
    async def _get_manifest_image_version(self, deployment_name: str, namespace: str) -> Optional[str]:
        """매니페스트 파일에서 이미지 버전 확인"""
        try:
            # 매니페스트 파일 경로 구성
            manifest_path = f"k8s-manifests/{deployment_name}-deployment.yaml"
            
            # 매니페스트 파일 읽기
            with open(manifest_path, 'r') as f:
                manifest_content = yaml.safe_load(f)
            
            # 이미지 정보 추출
            containers = manifest_content.get('spec', {}).get('template', {}).get('spec', {}).get('containers', [])
            if containers:
                image = containers[0].get('image', '')
                if ':' in image:
                    return image.split(':')[1]
            
            return None
            
        except Exception as e:
            logger.error("매니페스트 이미지 버전 확인 실패", 
                        deployment_name=deployment_name,
                        namespace=namespace,
                        error=str(e))
            return None
    
    def _calculate_health_status(self, deployment_info: Dict[str, Any]) -> DeploymentHealth:
        """배포 상태 기반으로 헬스 상태 계산"""
        try:
            replicas_desired = deployment_info.get('replicas_desired', 0)
            replicas_available = deployment_info.get('replicas_available', 0)
            replicas_ready = deployment_info.get('replicas_ready', 0)
            
            if replicas_desired == 0:
                return DeploymentHealth.UNKNOWN
            
            # 모든 레플리카가 준비된 경우
            if replicas_ready == replicas_desired:
                return DeploymentHealth.HEALTHY
            
            # 일부 레플리카가 준비되지 않은 경우
            if replicas_ready > 0:
                return DeploymentHealth.WARNING
            
            # 모든 레플리카가 준비되지 않은 경우
            return DeploymentHealth.CRITICAL
            
        except Exception as e:
            logger.error("헬스 상태 계산 실패", error=str(e))
            return DeploymentHealth.UNKNOWN
    
    async def _consider_auto_rollback(self, deployment_name: str, namespace: str):
        """자동 롤백 검토"""
        try:
            # 롤백 정책 확인 (자동 롤백이 활성화된 경우에만)
            if not self._should_auto_rollback(deployment_name, namespace):
                return
            
            # 롤백 후보 이미지 찾기
            rollback_candidate = self.image_tracker.find_rollback_candidate(
                namespace.split('-')[0], deployment_name
            )
            
            if rollback_candidate:
                logger.info("자동 롤백 실행", 
                           deployment_name=deployment_name,
                           namespace=namespace,
                           rollback_image=rollback_candidate.full_image_name)
                
                # 롤백 실행
                await self._execute_rollback(deployment_name, namespace, rollback_candidate)
            else:
                logger.warning("롤백 후보 이미지를 찾을 수 없음", 
                              deployment_name=deployment_name,
                              namespace=namespace)
                
        except Exception as e:
            logger.error("자동 롤백 검토 실패", 
                        deployment_name=deployment_name,
                        namespace=namespace,
                        error=str(e))
    
    def _should_auto_rollback(self, deployment_name: str, namespace: str) -> bool:
        """자동 롤백 여부 확인"""
        # 현재는 모든 배포에 대해 자동 롤백 비활성화
        # 향후 설정 기반으로 제어 가능
        return False
    
    async def _execute_rollback(self, deployment_name: str, namespace: str, 
                               rollback_image: ImageVersion):
        """롤백 실행"""
        try:
            # 롤백 배포 생성
            rollback_success = await self.k8s_orchestrator.rollback_deployment(
                deployment_name, namespace, rollback_image.full_image_name
            )
            
            if rollback_success:
                # 롤백 기록 저장
                rollback_record = DeploymentRecord(
                    id=f"rollback-{int(time.time())}",
                    tenant_id=namespace.split('-')[0],
                    service_name=deployment_name,
                    image_version_id=rollback_image.id,
                    deployment_timestamp=datetime.now(),
                    status=DeploymentStatus.ROLLED_BACK,
                    namespace=namespace,
                    replicas=1,
                    rollback_reason="자동 롤백: 배포 상태 비정상",
                    metadata={"auto_rollback": True, "original_failure": "deployment_unhealthy"}
                )
                
                self.image_tracker.record_deployment(rollback_record)
                
                logger.info("롤백 완료", 
                           deployment_name=deployment_name,
                           namespace=namespace,
                           rollback_image=rollback_image.full_image_name)
            else:
                logger.error("롤백 실패", 
                           deployment_name=deployment_name,
                           namespace=namespace)
                
        except Exception as e:
            logger.error("롤백 실행 실패", 
                        deployment_name=deployment_name,
                        namespace=namespace,
                        error=str(e))
    
    def _cleanup_old_metrics(self, max_age_hours: int = 24):
        """오래된 메트릭 정리"""
        cutoff_time = datetime.now() - timedelta(hours=max_age_hours)
        
        keys_to_remove = []
        for key, metrics in self.deployment_cache.items():
            if metrics.last_update_time < cutoff_time:
                keys_to_remove.append(key)
        
        for key in keys_to_remove:
            del self.deployment_cache[key]
        
        if keys_to_remove:
            logger.info("오래된 메트릭 정리 완료", removed_count=len(keys_to_remove))
    
    def get_deployment_metrics(self, namespace: str = None) -> List[DeploymentMetrics]:
        """배포 메트릭 조회"""
        if namespace:
            return [metrics for key, metrics in self.deployment_cache.items() 
                   if key.startswith(f"{namespace}:")]
        else:
            return list(self.deployment_cache.values())
    
    def get_health_summary(self) -> Dict[str, Any]:
        """전체 헬스 상태 요약"""
        metrics = self.get_deployment_metrics()
        
        total_deployments = len(metrics)
        healthy_count = sum(1 for m in metrics if m.health_status == DeploymentHealth.HEALTHY)
        warning_count = sum(1 for m in metrics if m.health_status == DeploymentHealth.WARNING)
        critical_count = sum(1 for m in metrics if m.health_status == DeploymentHealth.CRITICAL)
        version_mismatch_count = sum(1 for m in metrics if m.version_mismatch)
        
        return {
            "total_deployments": total_deployments,
            "healthy": healthy_count,
            "warning": warning_count,
            "critical": critical_count,
            "version_mismatches": version_mismatch_count,
            "health_percentage": (healthy_count / total_deployments * 100) if total_deployments > 0 else 0,
            "last_update": datetime.now().isoformat()
        }
