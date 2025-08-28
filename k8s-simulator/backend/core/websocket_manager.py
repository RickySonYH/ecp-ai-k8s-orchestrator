# [advice from AI] 실시간 데이터 전송을 위한 WebSocket 연결 관리
from fastapi import WebSocket
from typing import List, Dict, Any
import json
import logging
import asyncio

logger = logging.getLogger(__name__)

class WebSocketManager:
    """WebSocket 연결 관리 클래스"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.connection_info: Dict[WebSocket, Dict[str, Any]] = {}
    
    async def connect(self, websocket: WebSocket):
        """새로운 WebSocket 연결 수락"""
        await websocket.accept()
        self.active_connections.append(websocket)
        
        # 연결 정보 저장
        self.connection_info[websocket] = {
            "connected_at": asyncio.get_event_loop().time(),
            "client_ip": websocket.client.host if websocket.client else "unknown"
        }
        
        logger.info(f"WebSocket connected: {websocket.client.host if websocket.client else 'unknown'}")
        
        # 연결 성공 메시지 전송
        await self.send_personal_message({
            "type": "connection_established",
            "message": "Connected to K8S Simulator",
            "timestamp": asyncio.get_event_loop().time()
        }, websocket)
    
    def disconnect(self, websocket: WebSocket):
        """WebSocket 연결 해제"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        
        if websocket in self.connection_info:
            client_info = self.connection_info.pop(websocket)
            logger.info(f"WebSocket disconnected: {client_info.get('client_ip', 'unknown')}")
    
    async def send_personal_message(self, data: Dict[str, Any], websocket: WebSocket):
        """특정 클라이언트에게 메시지 전송"""
        try:
            await websocket.send_text(json.dumps(data))
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")
            self.disconnect(websocket)
    
    async def broadcast(self, data: Dict[str, Any]):
        """모든 연결된 클라이언트에게 메시지 브로드캐스트"""
        if not self.active_connections:
            return
        
        message = json.dumps(data)
        disconnected_clients = []
        
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Error broadcasting to client: {e}")
                disconnected_clients.append(connection)
        
        # 연결이 끊어진 클라이언트 정리
        for connection in disconnected_clients:
            self.disconnect(connection)
    
    async def broadcast_to_subscribers(self, data: Dict[str, Any], subscription_type: str):
        """특정 구독 타입의 클라이언트들에게만 브로드캐스트"""
        # 향후 구독 기능 구현 시 사용
        await self.broadcast(data)
    
    def get_connection_count(self) -> int:
        """현재 활성 연결 수 반환"""
        return len(self.active_connections)
    
    def get_connection_stats(self) -> Dict[str, Any]:
        """연결 통계 정보 반환"""
        current_time = asyncio.get_event_loop().time()
        connections_info = []
        
        for websocket, info in self.connection_info.items():
            connections_info.append({
                "client_ip": info.get("client_ip", "unknown"),
                "connected_duration": current_time - info.get("connected_at", current_time),
                "is_active": websocket in self.active_connections
            })
        
        return {
            "total_connections": len(self.active_connections),
            "connections": connections_info
        }
