#!/bin/bash
# Windows WSL 환경에서 ECP-AI Kubernetes Orchestrator 실행 스크립트

echo "🐧 WSL/Linux 환경에서 ECP-AI Kubernetes Orchestrator 시작 중..."

# 기본 설정으로 실행 (WSL/Linux 최적화)
docker-compose up --build -d

echo "✅ 시작 완료!"
echo "🌐 Frontend: http://localhost:3002"
echo "🔌 Backend: http://localhost:8001"
echo "📚 API 문서: http://localhost:8001/docs"
echo "🎯 K8S Simulator: http://localhost:6390"
