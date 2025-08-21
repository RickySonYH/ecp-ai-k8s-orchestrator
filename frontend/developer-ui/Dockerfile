# [advice from AI] ECP-AI 개발자 UI 개발용 Docker 이미지
FROM node:18-alpine

# 개발 환경 라벨
LABEL maintainer="ECP-AI Team"
LABEL description="ECP-AI Developer UI - Development Server"

# 작업 디렉토리 설정
WORKDIR /app

# 개발용 패키지 설치 (git, bash 등)
RUN apk add --no-cache \
    git \
    bash \
    curl \
    vim

# 패키지 파일들 복사 및 의존성 설치
COPY package*.json ./
RUN npm ci --only=production=false && \
    npm cache clean --force

# 개발용 글로벌 패키지 설치
RUN npm install -g \
    @typescript-eslint/eslint-plugin \
    @typescript-eslint/parser \
    typescript

# 개발용 사용자 생성 (권한 문제 해결)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S reactjs -u 1001 -G nodejs
RUN chown -R reactjs:nodejs /app
USER reactjs

# 환경 변수 설정
ENV NODE_ENV=development
ENV CHOKIDAR_USEPOLLING=true
ENV GENERATE_SOURCEMAP=false
ENV SKIP_PREFLIGHT_CHECK=true

# React 개발 서버용 환경 변수
ENV REACT_APP_API_BASE_URL=http://localhost:8000
ENV REACT_APP_WS_URL=ws://localhost:8000/ws
ENV REACT_APP_SUPPORTED_GPU_TYPES=t4,v100,l40s
ENV REACT_APP_TENANT_PRESETS=micro,small,medium,large
ENV REACT_APP_SERVICES=callbot,chatbot,advisor,stt,tts,ta,qa

# 포트 노출
EXPOSE 3000

# 헬스체크
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000 || exit 1

# 개발 서버 실행 (핫 리로드)
CMD ["npm", "start"]
