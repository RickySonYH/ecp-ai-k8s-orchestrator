# [advice from AI] ECP-AI 이미지 버전 추적 및 롤백 시스템
"""
이미지 버전 추적 및 롤백 시스템
- CI/CD 파이프라인에서 생성된 이미지 버전 추적
- 배포 히스토리 관리
- 롤백 기능 제공
- 이미지 보안 스캔 결과 추적
"""

import os
import json
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import structlog

logger = structlog.get_logger(__name__)


class ImageStatus(str, Enum):
    """이미지 상태"""
    BUILDING = "building"
    READY = "ready"
    DEPLOYED = "deployed"
    FAILED = "failed"
    DEPRECATED = "deprecated"


class DeploymentStatus(str, Enum):
    """배포 상태"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUCCESS = "success"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"


@dataclass
class ImageVersion:
    """이미지 버전 정보"""
    id: str
    service_name: str
    image_name: str
    image_tag: str
    full_image_name: str
    git_commit: str
    git_branch: str
    build_timestamp: datetime
    status: ImageStatus
    security_scan_result: Optional[str] = None
    vulnerabilities_count: int = 0
    metadata: Optional[Dict] = None


@dataclass
class DeploymentRecord:
    """배포 기록"""
    id: str
    tenant_id: str
    service_name: str
    image_version_id: str
    deployment_timestamp: datetime
    status: DeploymentStatus
    namespace: str
    replicas: int
    rollback_reason: Optional[str] = None
    metadata: Optional[Dict] = None


class ImageVersionTracker:
    """이미지 버전 추적기"""
    
    def __init__(self, db_path: str = "/app/data/image_versions.db"):
        self.db_path = db_path
        self._init_database()
        logger.info("ImageVersionTracker 초기화 완료", db_path=db_path)
    
    def _init_database(self):
        """데이터베이스 초기화"""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS image_versions (
                    id TEXT PRIMARY KEY,
                    service_name TEXT NOT NULL,
                    image_name TEXT NOT NULL,
                    image_tag TEXT NOT NULL,
                    full_image_name TEXT NOT NULL,
                    git_commit TEXT NOT NULL,
                    git_branch TEXT NOT NULL,
                    build_timestamp TEXT NOT NULL,
                    status TEXT NOT NULL,
                    security_scan_result TEXT,
                    vulnerabilities_count INTEGER DEFAULT 0,
                    metadata TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            conn.execute("""
                CREATE TABLE IF NOT EXISTS deployment_records (
                    id TEXT PRIMARY KEY,
                    tenant_id TEXT NOT NULL,
                    service_name TEXT NOT NULL,
                    image_version_id TEXT NOT NULL,
                    deployment_timestamp TEXT NOT NULL,
                    status TEXT NOT NULL,
                    namespace TEXT NOT NULL,
                    replicas INTEGER DEFAULT 1,
                    rollback_reason TEXT,
                    metadata TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (image_version_id) REFERENCES image_versions (id)
                )
            """)
            
            # 인덱스 생성
            conn.execute("CREATE INDEX IF NOT EXISTS idx_image_versions_service ON image_versions (service_name)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_image_versions_status ON image_versions (status)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_deployment_records_tenant ON deployment_records (tenant_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_deployment_records_service ON deployment_records (service_name)")
            
            conn.commit()
    
    def register_image_version(self, image_version: ImageVersion) -> bool:
        """새 이미지 버전 등록"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO image_versions 
                    (id, service_name, image_name, image_tag, full_image_name, 
                     git_commit, git_branch, build_timestamp, status, 
                     security_scan_result, vulnerabilities_count, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    image_version.id,
                    image_version.service_name,
                    image_version.image_name,
                    image_version.image_tag,
                    image_version.full_image_name,
                    image_version.git_commit,
                    image_version.git_branch,
                    image_version.build_timestamp.isoformat(),
                    image_version.status.value,
                    image_version.security_scan_result,
                    image_version.vulnerabilities_count,
                    json.dumps(image_version.metadata) if image_version.metadata else None
                ))
                conn.commit()
                
                logger.info("이미지 버전 등록 완료", 
                           service_name=image_version.service_name,
                           image_tag=image_version.image_tag)
                return True
                
        except Exception as e:
            logger.error("이미지 버전 등록 실패", error=str(e))
            return False
    
    def update_image_status(self, image_version_id: str, status: ImageStatus, 
                           security_scan_result: Optional[str] = None,
                           vulnerabilities_count: int = 0) -> bool:
        """이미지 상태 업데이트"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    UPDATE image_versions 
                    SET status = ?, security_scan_result = ?, vulnerabilities_count = ?
                    WHERE id = ?
                """, (status.value, security_scan_result, vulnerabilities_count, image_version_id))
                conn.commit()
                
                logger.info("이미지 상태 업데이트 완료", 
                           image_version_id=image_version_id,
                           status=status.value)
                return True
                
        except Exception as e:
            logger.error("이미지 상태 업데이트 실패", error=str(e))
            return False
    
    def record_deployment(self, deployment_record: DeploymentRecord) -> bool:
        """배포 기록 저장"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    INSERT INTO deployment_records 
                    (id, tenant_id, service_name, image_version_id, deployment_timestamp,
                     status, namespace, replicas, rollback_reason, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    deployment_record.id,
                    deployment_record.tenant_id,
                    deployment_record.service_name,
                    deployment_record.image_version_id,
                    deployment_record.deployment_timestamp.isoformat(),
                    deployment_record.status.value,
                    deployment_record.namespace,
                    deployment_record.replicas,
                    deployment_record.rollback_reason,
                    json.dumps(deployment_record.metadata) if deployment_record.metadata else None
                ))
                conn.commit()
                
                logger.info("배포 기록 저장 완료", 
                           tenant_id=deployment_record.tenant_id,
                           service_name=deployment_record.service_name)
                return True
                
        except Exception as e:
            logger.error("배포 기록 저장 실패", error=str(e))
            return False
    
    def get_image_versions(self, service_name: str, limit: int = 10) -> List[ImageVersion]:
        """서비스별 이미지 버전 목록 조회"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("""
                    SELECT * FROM image_versions 
                    WHERE service_name = ? 
                    ORDER BY build_timestamp DESC 
                    LIMIT ?
                """, (service_name, limit))
                
                versions = []
                for row in cursor.fetchall():
                    version = ImageVersion(
                        id=row[0],
                        service_name=row[1],
                        image_name=row[2],
                        image_tag=row[3],
                        full_image_name=row[4],
                        git_commit=row[5],
                        git_branch=row[6],
                        build_timestamp=datetime.fromisoformat(row[7]),
                        status=ImageStatus(row[8]),
                        security_scan_result=row[9],
                        vulnerabilities_count=row[10],
                        metadata=json.loads(row[11]) if row[11] else None
                    )
                    versions.append(version)
                
                return versions
                
        except Exception as e:
            logger.error("이미지 버전 조회 실패", error=str(e))
            return []
    
    def get_deployment_history(self, tenant_id: str, service_name: str, 
                              limit: int = 20) -> List[DeploymentRecord]:
        """배포 히스토리 조회"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("""
                    SELECT * FROM deployment_records 
                    WHERE tenant_id = ? AND service_name = ?
                    ORDER BY deployment_timestamp DESC 
                    LIMIT ?
                """, (tenant_id, service_name, limit))
                
                records = []
                for row in cursor.fetchall():
                    record = DeploymentRecord(
                        id=row[0],
                        tenant_id=row[1],
                        service_name=row[2],
                        image_version_id=row[3],
                        deployment_timestamp=datetime.fromisoformat(row[4]),
                        status=DeploymentStatus(row[5]),
                        namespace=row[6],
                        replicas=row[7],
                        rollback_reason=row[8],
                        metadata=json.loads(row[9]) if row[9] else None
                    )
                    records.append(record)
                
                return records
                
        except Exception as e:
            logger.error("배포 히스토리 조회 실패", error=str(e))
            return []
    
    def find_rollback_candidate(self, tenant_id: str, service_name: str) -> Optional[ImageVersion]:
        """롤백 후보 이미지 찾기"""
        try:
            # 최근 성공한 배포 기록 찾기
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("""
                    SELECT dr.image_version_id, iv.* 
                    FROM deployment_records dr
                    JOIN image_versions iv ON dr.image_version_id = iv.id
                    WHERE dr.tenant_id = ? AND dr.service_name = ? 
                    AND dr.status = 'success'
                    ORDER BY dr.deployment_timestamp DESC
                    LIMIT 1
                """, (tenant_id, service_name))
                
                row = cursor.fetchone()
                if row:
                    return ImageVersion(
                        id=row[1],
                        service_name=row[2],
                        image_name=row[3],
                        image_tag=row[4],
                        full_image_name=row[5],
                        git_commit=row[6],
                        git_branch=row[7],
                        build_timestamp=datetime.fromisoformat(row[8]),
                        status=ImageStatus(row[9]),
                        security_scan_result=row[10],
                        vulnerabilities_count=row[11],
                        metadata=json.loads(row[12]) if row[12] else None
                    )
                
                return None
                
        except Exception as e:
            logger.error("롤백 후보 이미지 찾기 실패", error=str(e))
            return None
    
    def cleanup_old_versions(self, days_to_keep: int = 30) -> int:
        """오래된 이미지 버전 정리"""
        try:
            cutoff_date = datetime.now() - timedelta(days=days_to_keep)
            
            with sqlite3.connect(self.db_path) as conn:
                # 오래된 이미지 버전 삭제
                cursor = conn.execute("""
                    DELETE FROM image_versions 
                    WHERE build_timestamp < ? AND status != 'deployed'
                """, (cutoff_date.isoformat(),))
                
                deleted_count = cursor.rowcount
                conn.commit()
                
                logger.info("오래된 이미지 버전 정리 완료", 
                           deleted_count=deleted_count,
                           cutoff_date=cutoff_date.isoformat())
                
                return deleted_count
                
        except Exception as e:
            logger.error("이미지 버전 정리 실패", error=str(e))
            return 0
