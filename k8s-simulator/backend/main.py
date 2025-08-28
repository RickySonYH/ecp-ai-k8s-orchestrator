# [advice from AI] K8S 시뮬레이터 메인 FastAPI 애플리케이션
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import asyncio
import json
import logging
from typing import List, Dict, Any
from datetime import datetime
import os

from api.routes import k8s_router, monitoring_router, sla_router
from core.database import init_db
from core.k8s_simulator import K8sSimulator
from core.monitoring_engine import MonitoringEngine
from core.websocket_manager import WebSocketManager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="K8S Simulator with SLA Monitoring",
    description="가상 쿠버네티스 환경 시뮬레이터 및 SLA 99.5% 모니터링 솔루션",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global instances
k8s_simulator = K8sSimulator()
monitoring_engine = MonitoringEngine()
websocket_manager = WebSocketManager()

def get_simulator():
    """전역 시뮬레이터 인스턴스 반환"""
    return k8s_simulator

@app.on_event("startup")
async def startup_event():
    """애플리케이션 시작 시 초기화"""
    logger.info("K8S Simulator starting up...")
    
    # Initialize database
    await init_db()
    
    # Start monitoring engine
    await monitoring_engine.start()
    
    # Start background tasks
    asyncio.create_task(background_monitoring_task())
    
    logger.info("K8S Simulator started successfully!")

@app.on_event("shutdown")
async def shutdown_event():
    """애플리케이션 종료 시 정리"""
    logger.info("K8S Simulator shutting down...")
    await monitoring_engine.stop()
    logger.info("K8S Simulator stopped.")

async def background_monitoring_task():
    """백그라운드 모니터링 태스크"""
    while True:
        try:
            # Generate monitoring data
            metrics = await monitoring_engine.generate_metrics()
            
            # Check SLA status
            sla_status = await monitoring_engine.check_sla()
            
            # Broadcast to WebSocket clients
            await websocket_manager.broadcast({
                "type": "metrics_update",
                "data": metrics,
                "sla_status": sla_status,
                "timestamp": datetime.now().isoformat()
            })
            
            # Wait 5 seconds before next update
            await asyncio.sleep(5)
            
        except Exception as e:
            logger.error(f"Background monitoring task error: {e}")
            await asyncio.sleep(10)

@app.get("/")
async def root():
    """헬스체크 엔드포인트"""
    return {
        "message": "K8S Simulator with SLA Monitoring",
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }

@app.websocket("/ws/monitoring")
async def websocket_monitoring_endpoint(websocket: WebSocket):
    """실시간 모니터링 데이터 전송을 위한 WebSocket 엔드포인트"""
    await websocket_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and listen for client messages
            data = await websocket.receive_text()
            logger.info(f"Received WebSocket message: {data}")
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        websocket_manager.disconnect(websocket)

# Include routers
app.include_router(k8s_router, prefix="/k8s", tags=["K8S Simulator"])
app.include_router(monitoring_router, prefix="/monitoring", tags=["Monitoring"])
app.include_router(sla_router, prefix="/sla", tags=["SLA Management"])

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
