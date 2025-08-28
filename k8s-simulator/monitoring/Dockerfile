# [advice from AI] 실제 서버 모니터링 데이터 모사기를 위한 Docker 이미지
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 9090

# Start the monitoring data generator
CMD ["python", "main.py"]
