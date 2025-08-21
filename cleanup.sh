#!/bin/bash
# [advice from AI] ECP-AI 테넌시 'test-download' 정리 스크립트

set -e

echo "🗑️ ECP-AI 테넌시 'test-download' 삭제 시작"
echo ""

read -p "정말로 테넌시 'test-download'를 삭제하시겠습니까? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "삭제 취소됨"
    exit 0
fi

echo "🧹 네임스페이스 및 모든 리소스 삭제 중..."
kubectl delete namespace test-download-ecp-ai --ignore-not-found=true

echo ""
echo "✅ 테넌시 'test-download' 삭제 완료!"
echo ""
echo "📊 확인:"
echo "  kubectl get namespaces | grep test-download"
