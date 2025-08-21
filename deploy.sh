#!/bin/bash
# [advice from AI] ECP-AI 테넌시 'test-download' 배포 스크립트

set -e

echo "🚀 ECP-AI 테넌시 'test-download' 배포 시작"
echo "프리셋: small"
echo "GPU 타입: t4"
echo "예상 리소스: GPU 3개, CPU 31코어"
echo ""

# 1. 네임스페이스 생성
echo "📁 네임스페이스 생성 중..."
kubectl apply -f k8s-manifests/01-namespace.yaml

# 2. ConfigMap 생성
echo "⚙️ 설정 파일 생성 중..."
kubectl apply -f k8s-manifests/02-configmap.yaml

# 3. 서비스별 배포
echo "🛠️ 서비스 배포 중..."
for manifest in k8s-manifests/*-deployment.yaml; do
    if [ -f "$manifest" ]; then
        echo "배포 중: $(basename $manifest)"
        kubectl apply -f "$manifest"
    fi
done

for manifest in k8s-manifests/*-service.yaml; do
    if [ -f "$manifest" ]; then
        echo "서비스 생성: $(basename $manifest)"
        kubectl apply -f "$manifest"
    fi
done

# 4. 오토스케일링 설정
echo "📈 오토스케일링 설정 중..."
for manifest in k8s-manifests/*-hpa.yaml; do
    if [ -f "$manifest" ]; then
        echo "HPA 생성: $(basename $manifest)"
        kubectl apply -f "$manifest"
    fi
done

# 5. 네트워크 정책 및 모니터링
echo "🔒 보안 정책 설정 중..."
kubectl apply -f k8s-manifests/90-networkpolicy.yaml
kubectl apply -f k8s-manifests/91-monitoring.yaml

echo ""
echo "✅ 테넌시 'test-download' 배포 완료!"
echo ""
echo "📊 상태 확인:"
echo "  kubectl get pods -n test-download-ecp-ai"
echo "  kubectl get services -n test-download-ecp-ai"
echo "  kubectl get hpa -n test-download-ecp-ai"
echo ""
echo "🔍 로그 확인:"
echo "  kubectl logs -f deployment/<service-name> -n test-download-ecp-ai"
echo ""
echo "🗑️ 삭제 방법:"
echo "  ./cleanup.sh"
