# ECP-AI Kubernetes Orchestrator v2.0

🚀 **차세대 ECP-AI 테넌시 관리 및 Kubernetes 오케스트레이션 플랫폼**

## ✨ v2.0 주요 업데이트

### 🎯 **서비스별 고급 설정 시스템** (NEW)
- **탭 기반 설정 구조**: 공통 설정 + 각 서비스별 개별 설정
- **하드웨어 계산기 연동**: 리소스는 자동 계산, 오토스케일링만 사용자 설정
- **직관적 단위 변환**: 밀리코어(m) → Core, Mi/Gi → GB 단위
- **서비스별 특화 환경변수**: STT/TTS/TA/QA 등 각 서비스 맞춤 설정

### 📊 **향상된 배포 프로그레스**
- **상세 단계별 진행 상황**: 10단계 세부 배포 과정 표시
- **실시간 로그**: 터미널 스타일 실시간 배포 로그
- **예상 시간**: 각 단계별 예상 소요시간 표시
- **시각적 피드백**: 완료/진행중/대기 상태별 색상과 아이콘

### 🛠️ **개선된 사용자 경험**
- **설정 요약 패널**: 각 서비스별 현재 설정 상태 한 눈에 확인
- **권장 설정 가이드**: 서비스별 최적화된 권장값 제공  
- **검증 및 경고**: 실시간 설정 유효성 검사

## 🏗️ 시스템 아키텍처

```
ECP-AI K8s Orchestrator v2.0
├── 🎯 Frontend (React + TypeScript)
│   ├── 테넌시 생성 마법사 (다단계 설정)
│   ├── 서비스별 고급 설정 탭
│   ├── 하드웨어 사양 계산기
│   ├── 배포 프로그레스 모니터링
│   └── CI/CD 이미지 관리
├── ⚙️ Backend (FastAPI + Python)  
│   ├── 테넌시 관리 API
│   ├── 리소스 계산 엔진
│   ├── 매니페스트 생성기
│   └── K8s 시뮬레이터 연동
├── 🐳 K8s 시뮬레이터
│   ├── 가상 클러스터 환경
│   ├── 실시간 배포 모니터링
│   └── WebSocket 기반 상태 알림
└── ☁️ 멀티 클라우드 지원
    ├── AWS EKS
    ├── NCP NKS  
    ├── Azure AKS
    └── GCP GKE
```

## 🚀 빠른 시작

### 1. 개발 환경 설정

```bash
# 저장소 클론
git clone https://github.com/your-org/ecp-ai-k8s-orchestrator.git
cd ecp-ai-k8s-orchestrator

# 개발 환경 시작 (macOS)
./start-macos.sh

# 또는 WSL 환경에서
./start-wsl.sh
```

### 2. 서비스 접속

- **Frontend UI**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **K8s 시뮬레이터**: http://localhost:8080
- **API 문서**: http://localhost:8000/docs

### 3. 테넌시 생성 (v2.0 방식)

1. **기본 설정**: 테넌시 ID, 서비스 요구사항 입력
2. **CI/CD 이미지**: 컨테이너 이미지 선택 및 레지스트리 연동
3. **고급 설정**: 서비스별 개별 설정 (NEW!)
   - 🏢 공통 설정: 전체 테넌시 공통 옵션
   - 📞 콜봇 설정: STT/TTS 엔드포인트, 리소스 할당
   - 💬 챗봇 설정: NLP 엔드포인트, 채팅 히스토리 크기
   - 👨‍💼 어드바이저: 하이브리드 모드, 다중 서비스 연동
   - 🎤 STT: 모델 경로, 언어 코드, 샘플링 레이트
   - 🔊 TTS: 음성 타입, 속도, 오디오 포맷
   - 📊 TA: 분석 모드, 배치 크기, 리포트 주기
   - ✅ QA: 품질 임계값, 평가 모드, 알림 웹훅
4. **매니페스트 생성**: 클라우드 제공업체별 최적화 매니페스트
5. **배포 실행**: 상세 프로그레스로 실시간 배포 모니터링

## 📊 지원 서비스

### 🎯 **메인 서비스**
| 서비스 | 설명 | 리소스 권장 | 특화 설정 |
|--------|------|-------------|-----------|
| **콜봇** | 음성 통화 AI 상담 | 0.1-0.5 Core, 256MB-1GB | STT/TTS 엔드포인트 |
| **챗봇** | 텍스트 기반 AI 채팅 | 0.05-0.2 Core, 128-512MB | NLP 엔드포인트, 히스토리 크기 |
| **어드바이저** | AI 보조 인간 상담사 | 0.2-1 Core, 512MB-2GB | 하이브리드 모드, 다중 서비스 |

### 🛠️ **지원 서비스**  
| 서비스 | 설명 | 리소스 권장 | 특화 설정 |
|--------|------|-------------|-----------|
| **STT** | 음성인식 독립 서비스 | 0.5-2 Core, 1-4GB | 모델 경로, 언어, 샘플레이트 |
| **TTS** | 음성합성 독립 서비스 | 1-4 Core, 2-8GB, 1-2 GPU | 음성 타입, 속도, 포맷 |
| **TA** | 텍스트 분석 서비스 | 0.2-1 Core, 512MB-2GB | 분석 모드, 배치, 리포트 |
| **QA** | 품질 관리 서비스 | 0.1-0.5 Core, 256MB-1GB | 품질 임계값, 평가 모드 |

## 🔧 v2.0 고급 기능

### 📋 **서비스별 설정 시스템**

```typescript
// 서비스별 개별 설정 예시
interface ServiceConfiguration {
  resources?: {
    cpu: number;    // Core 단위 (자동 계산)
    memory: number; // GB 단위 (자동 계산)
    gpu: number;    // GPU 개수 (자동 계산)
  };
  autoScaling: {
    minReplicas: number;  // 최소 Pod 수 (사용자 설정)
    maxReplicas: number;  // 최대 Pod 수 (사용자 설정)
    targetCpu: number;    // CPU 임계값 % (사용자 설정)
    targetMemory: number; // 메모리 임계값 % (사용자 설정)
  };
  environment: {
    [key: string]: string; // 서비스별 특화 환경변수
  };
  healthCheck: {
    healthPath: string;
    readyPath: string;
    port: number;
  };
}
```

### 🎯 **하드웨어 계산기 연동**

```python
# 자동 리소스 계산 예시
def calculate_service_resources(service_requirements):
    """
    서비스 요구사항에 따라 최적 리소스 자동 계산
    - 실제 가중치 기반 CPU/메모리 계산
    - GPU 요구사항 자동 판단
    - 클라우드별 인스턴스 타입 추천
    """
    return {
        'cpu_cores': calculated_cpu,      # Core 단위
        'memory_gb': calculated_memory,   # GB 단위
        'gpu_count': calculated_gpu,      # GPU 개수
        'replicas': recommended_replicas  # 권장 replicas
    }
```

## 📈 성능 및 확장성

### 🎯 **오토스케일링 (HPA)**
- **동적 확장**: CPU/메모리 사용률 기반 자동 확장
- **서비스별 최적화**: 각 서비스 특성에 맞는 스케일링 정책
- **예측적 스케일링**: 트래픽 패턴 학습 기반 사전 확장

### 📊 **모니터링 및 알림**
- **실시간 메트릭**: Prometheus + Grafana 통합
- **장애 감지**: 서비스 Health Check 및 자동 복구
- **알림 시스템**: Slack, 이메일, 웹훅 다중 알림

## 🏗️ 배포 환경

### 🌥️ **멀티 클라우드 지원**
- **AWS EKS**: CloudFormation 템플릿 자동 생성
- **NCP NKS**: Naver Cloud Platform 최적화
- **Azure AKS**: ARM 템플릿 기반 배포
- **GCP GKE**: Deployment Manager 연동

### 🐳 **컨테이너 환경**
- **Docker**: 멀티스테이지 빌드 최적화
- **Kubernetes**: 1.24+ 지원, CRD 활용
- **Helm**: 차트 기반 패키지 관리

## 🔐 보안 및 운영

### 🛡️ **보안 기능**
- **RBAC**: 세밀한 권한 관리
- **Network Policy**: 서비스간 통신 제어
- **Secret 관리**: Kubernetes Secret 암호화
- **TLS 종단**: Let's Encrypt 자동 인증서

### 📋 **운영 도구**
- **로그 집계**: ELK Stack 연동
- **백업/복구**: 자동화된 데이터 백업
- **CI/CD**: GitHub Actions 통합

## 🤝 기여하기

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. [LICENSE](LICENSE) 파일을 참조하세요.

## 🆕 v2.0 변경사항 요약

### ✨ **새로운 기능**
- 🎯 서비스별 고급 설정 탭 시스템
- 📊 하드웨어 계산기 기반 자동 리소스 할당
- 🚀 상세 배포 프로그레스 및 실시간 로그
- ⚙️ 오토스케일링 중심의 설정 시스템
- 🔧 서비스별 특화 환경변수 지원

### 🔧 **개선사항**
- 💻 Core/GB 단위로 직관적 리소스 표시
- 📋 설정 요약 패널로 한 눈에 설정 확인
- 🎨 Material-UI 기반 현대적 UI/UX
- ⚡ 성능 최적화 및 반응형 디자인

### 🐛 **버그 수정**
- TypeScript 타입 안정성 향상
- 메모리 누수 방지 및 상태 관리 개선
- 클라우드별 호환성 문제 해결

---

**🚀 ECP-AI K8s Orchestrator v2.0** - 차세대 엔터프라이즈 AI 플랫폼을 위한 Kubernetes 오케스트레이션 솔루션
