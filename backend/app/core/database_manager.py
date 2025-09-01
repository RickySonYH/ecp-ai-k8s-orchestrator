# [advice from AI] 데이터베이스 매니저 - 데모/실사용 DB 분리 관리
"""
DatabaseManager
- 데모 모드와 실사용 모드에 따른 DB 연결 관리
- 동적 DB 선택 및 세션 관리
- 환경 변수 기반 설정
"""

import os
from typing import Optional
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from app.models.database import Base
import logging

logger = logging.getLogger(__name__)

class DatabaseManager:
    """데이터베이스 연결 관리자"""
    
    def __init__(self):
        self._production_engine = None
        self._demo_engine = None
        self._production_session_factory = None
        self._demo_session_factory = None
        self._initialize_connections()
    
    def _initialize_connections(self):
        """DB 연결 초기화"""
        try:
            # 실사용 DB 연결 설정
            production_db_url = os.getenv(
                'DATABASE_URL', 
                'postgresql://ecp_user:ecp_password@postgres:5432/ecp_orchestrator'
            )
            
            self._production_engine = create_engine(
                production_db_url,
                pool_pre_ping=True,
                pool_recycle=300,
                echo=os.getenv('DB_ECHO', 'false').lower() == 'true'
            )
            
            self._production_session_factory = sessionmaker(
                autocommit=False, 
                autoflush=False, 
                bind=self._production_engine
            )
            
                        # [advice from AI] 데모 DB 연결 제거 - 실제 테넌시 생성 기반으로 전환
            
            logger.info("데이터베이스 연결 초기화 완료")
            logger.info(f"실사용 DB: {production_db_url}")
            # [advice from AI] 데모 DB 로그 제거
            
        except Exception as e:
            logger.error(f"데이터베이스 연결 초기화 실패: {e}")
            raise
    
    def get_session(self) -> Session:
        """
        실사용 DB 세션 반환
        
        Returns:
            Session: SQLAlchemy 세션
        """
        try:
            if not self._production_session_factory:
                raise ValueError("실사용 DB 연결이 초기화되지 않았습니다")
            session = self._production_session_factory()
            logger.debug("실사용 DB 세션 생성")
            
            return session
            
        except Exception as e:
            logger.error(f"DB 세션 생성 실패: {e}")
            raise
    
    def get_engine(self):
        """
        실사용 DB 엔진 반환
        
        Returns:
            Engine: SQLAlchemy 엔진
        """
        return self._production_engine
    
    def create_tables(self):
        """
        실사용 DB 테이블 생성
        """
        try:
            engine = self.get_engine()
            Base.metadata.create_all(bind=engine)
            
            logger.info("실사용 DB 테이블 생성 완료")
            
        except Exception as e:
            logger.error(f"테이블 생성 실패: {e}")
            raise
    
    def check_connection(self) -> bool:
        """
        실사용 DB 연결 상태 확인
        
        Returns:
            bool: 연결 상태
        """
        try:
            engine = self.get_engine()
            with engine.connect() as conn:
                conn.execute("SELECT 1")
            
            logger.info("실사용 DB 연결 상태 양호")
            return True
            
        except Exception as e:
            logger.error(f"실사용 DB 연결 실패: {e}")
            return False
    
    def close_connections(self):
        """실사용 DB 연결 종료"""
        try:
            if self._production_engine:
                self._production_engine.dispose()
                logger.info("실사용 DB 연결 종료")
                
        except Exception as e:
            logger.error(f"DB 연결 종료 중 오류: {e}")

# 전역 데이터베이스 매니저 인스턴스
db_manager = DatabaseManager()

# 의존성 주입용 함수들
def get_db_session():
    """실사용 DB 세션 의존성 주입"""
    session = db_manager.get_session()
    try:
        yield session
    finally:
        session.close()

def get_production_db():
    """실사용 DB 세션 반환"""
    return get_db_session()

# FastAPI 의존성으로 사용할 함수
def get_db():
    """FastAPI 의존성용 실사용 DB 세션 팩토리"""
    def _get_db_session():
        session = db_manager.get_session()
        try:
            yield session
        finally:
            session.close()
    
    return _get_db_session
