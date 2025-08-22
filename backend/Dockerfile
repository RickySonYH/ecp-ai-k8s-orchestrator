# [advice from AI] ECP-AI Kubernetes Orchestrator 백엔드 Docker 이미지
FROM python:3.11-slim as base

# 개발 환경 라벨
LABEL maintainer="ECP-AI Team"
LABEL description="ECP-AI Kubernetes Orchestrator Backend"

# 작업 디렉토리 설정
WORKDIR /app

# 시스템 패키지 업데이트 및 필수 패키지 설치
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    curl \
    git \
    vim \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 개발 스테이지
FROM base as development

# 개발용 추가 패키지 설치
RUN pip install --no-cache-dir \
    ipython \
    pytest-watch \
    jupyter

# 개발용 사용자 생성 (권한 문제 해결)
RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN chown -R appuser:appuser /app
USER appuser

# 환경 변수 설정
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV ENVIRONMENT=development
ENV LOG_LEVEL=DEBUG

# 개발용 포트 노출
EXPOSE 8000
EXPOSE 8001

# 헬스체크 (개발 환경용)
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# 개발 서버 실행 (핫 리로드 활성화)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--log-level", "debug"]

# 프로덕션 스테이지
FROM base as production

# 애플리케이션 코드 복사
COPY app/ ./app/
COPY models/ ./models/
COPY config/ ./config/

# 프로덕션용 사용자 생성
RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN chown -R appuser:appuser /app
USER appuser

# 환경 변수 설정
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV ENVIRONMENT=production
ENV LOG_LEVEL=INFO

# 포트 노출
EXPOSE 8000

# 헬스체크
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# 프로덕션 서버 실행
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
