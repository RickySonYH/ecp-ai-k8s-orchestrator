# ECP-AI 테넌시: test-download

**버전**: 1.2.0

## 📋 테넌시 정보

- **테넌시 ID**: test-download
- **프리셋**: small
- **GPU 타입**: t4
- **예상 리소스**: GPU 3개, CPU 31코어

## 🛠️ 서비스 구성

- **callbot**: 10개 인스턴스
- **chatbot**: 50개 인스턴스
- **advisor**: 5개 인스턴스

## 🚀 배포 방법

### 1. 사전 요구사항
- Kubernetes 클러스터 접근 권한
- kubectl 명령어 설치
- 충분한 클러스터 리소스

### 2. 배포 실행
```bash
# 실행 권한 부여
chmod +x deploy.sh cleanup.sh

# 배포 실행
./deploy.sh
```

### 3. 상태 확인
```bash
# Pod 상태 확인
kubectl get pods -n test-download-ecp-ai

# 서비스 상태 확인
kubectl get services -n test-download-ecp-ai

# HPA 상태 확인
kubectl get hpa -n test-download-ecp-ai
```

### 4. 로그 확인
```bash
# 전체 Pod 로그
kubectl logs -f -l tenant=test-download -n test-download-ecp-ai

# 특정 서비스 로그
kubectl logs -f deployment/<service-name> -n test-download-ecp-ai
```

## 🗑️ 삭제 방법

```bash
# 전체 테넌시 삭제
./cleanup.sh

# 또는 수동 삭제
kubectl delete namespace test-download-ecp-ai
```

## 📊 예상 리소스 사용량

### GPU 요구사항
- **GPU 타입**: t4
- **GPU 개수**: 3개
- **GPU 메모리**: 42.06311111111111GB

### CPU 요구사항  
- **CPU 코어**: 31개
- **메모리**: 16Gi
- **스토리지**: 1.0TB

## ⚠️ 주의사항

1. **리소스 확인**: 클러스터에 충분한 GPU/CPU 리소스가 있는지 확인하세요
2. **네트워크 정책**: 기존 네트워크 정책과 충돌하지 않는지 확인하세요
3. **모니터링**: Prometheus Operator가 설치되어 있어야 모니터링이 작동합니다
4. **스토리지**: PersistentVolume이 필요한 서비스가 있을 수 있습니다

## 📞 지원

문제가 발생하면 ECP-AI 지원팀에 문의하세요.
- 이메일: support@ecp-ai.com
- 문서: https://docs.ecp-ai.com
