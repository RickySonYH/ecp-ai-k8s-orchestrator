// [advice from AI] ECP-AI UI 유틸리티 함수들
/**
 * 데이터 포맷팅 및 유틸리티 함수
 * - 숫자 포맷팅
 * - 시간 포맷팅  
 * - 상태 변환
 * - 색상 유틸리티
 */

import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';

// 숫자 포맷팅
export const formatNumber = (value: number, decimals: number = 0): string => {
  return new Intl.NumberFormat('ko-KR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

// 큰 숫자 포맷팅 (K, M, B 단위)
export const formatLargeNumber = (value: number): string => {
  if (value >= 1000000000) {
    return `${(value / 1000000000).toFixed(1)}B`;
  }
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
};

// 퍼센트 포맷팅
export const formatPercentage = (value: number, decimals: number = 1): string => {
  return `${value.toFixed(decimals)}%`;
};

// 메모리 크기 포맷팅
export const formatMemorySize = (sizeInBytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = sizeInBytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

// 시간 포맷팅
export const formatDateTime = (dateString: string): string => {
  try {
    const date = parseISO(dateString);
    return format(date, 'yyyy-MM-dd HH:mm:ss', { locale: ko });
  } catch {
    return dateString;
  }
};

// 상대 시간 포맷팅
export const formatRelativeTime = (dateString: string): string => {
  try {
    const date = parseISO(dateString);
    return formatDistanceToNow(date, { addSuffix: true, locale: ko });
  } catch {
    return dateString;
  }
};

// 지속시간 포맷팅 (초 단위)
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}시간 ${minutes}분`;
  }
  if (minutes > 0) {
    return `${minutes}분 ${secs}초`;
  }
  return `${secs}초`;
};

// 상태 변환
export const getStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    'running': '실행 중',
    'pending': '대기 중',
    'failed': '실패',
    'deleting': '삭제 중',
    'completed': '완료',
    'in_progress': '진행 중',
    'manual': '수동',
    'healthy': '정상',
    'warning': '주의',
    'critical': '위험'
  };
  
  return statusMap[status.toLowerCase()] || status;
};

// 프리셋 변환
export const getPresetText = (preset: string): string => {
  const presetMap: Record<string, string> = {
    'micro': '마이크로',
    'small': '스몰',
    'medium': '미디엄', 
    'large': '라지'
  };
  
  return presetMap[preset.toLowerCase()] || preset;
};

// GPU 타입 변환
export const getGPUTypeText = (gpuType: string): string => {
  const gpuMap: Record<string, string> = {
    't4': 'NVIDIA T4 (가성비)',
    'v100': 'NVIDIA V100 (균형)',
    'l40s': 'NVIDIA L40S (고성능)',
    'auto': '자동 선택'
  };
  
  return gpuMap[gpuType.toLowerCase()] || gpuType;
};

// 상태별 색상 가져오기
export const getStatusColor = (status: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
  switch (status.toLowerCase()) {
    case 'running':
    case 'completed':
    case 'healthy':
      return 'success';
    case 'pending':
    case 'in_progress':
      return 'warning';
    case 'failed':
    case 'critical':
      return 'error';
    case 'deleting':
      return 'secondary';
    default:
      return 'default';
  }
};

// 프리셋별 색상 가져오기
export const getPresetColor = (preset: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
  switch (preset.toLowerCase()) {
    case 'micro':
      return 'info';
    case 'small':
      return 'success';
    case 'medium':
      return 'warning';
    case 'large':
      return 'error';
    default:
      return 'default';
  }
};

// 프로그레스 바 색상 가져오기
export const getProgressColor = (value: number, thresholds: { warning: number; error: number }): 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
  if (value >= thresholds.error) return 'error';
  if (value >= thresholds.warning) return 'warning';
  return 'success';
};

// 리소스 사용률 텍스트
export const getResourceUsageText = (usage: number): string => {
  if (usage >= 90) return '매우 높음';
  if (usage >= 70) return '높음';
  if (usage >= 50) return '보통';
  if (usage >= 30) return '낮음';
  return '매우 낮음';
};

// 서비스 설명 가져오기
export const getServiceDescription = (serviceName: string): string => {
  const serviceDescriptions: Record<string, string> = {
    'callbot': '음성 통화 기반 AI 상담 서비스',
    'chatbot': '텍스트 기반 AI 채팅 서비스',
    'advisor': 'AI 보조 인간 상담 서비스',
    'stt': 'Speech-to-Text 음성 인식 서비스',
    'tts': 'Text-to-Speech 음성 합성 서비스',
    'ta': '통계 분석 및 리포팅 서비스',
    'qa': '품질 관리 및 평가 서비스',
    'nlp': '자연어 처리 엔진',
    'aicm': 'AI 지식 관리 시스템'
  };
  
  return serviceDescriptions[serviceName.toLowerCase()] || serviceName;
};

// URL 생성 유틸리티
export const createAPIUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
};

// WebSocket URL 생성 유틸리티
export const createWebSocketUrl = (endpoint: string): string => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
};

// 에러 메시지 파싱
export const parseErrorMessage = (error: any): string => {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error?.detail) {
    return error.detail;
  }
  
  if (error?.message) {
    return error.message;
  }
  
  return '알 수 없는 오류가 발생했습니다';
};

// 성능 점수 계산
export const calculatePerformanceScore = (slaMetrics: {
  availability: number;
  response_time: number;
  error_rate: number;
}): number => {
  // 가용률 (40%), 응답시간 (40%), 에러율 (20%) 가중치
  const availabilityScore = slaMetrics.availability;
  const responseTimeScore = Math.max(0, 100 - (slaMetrics.response_time / 10));
  const errorRateScore = Math.max(0, 100 - (slaMetrics.error_rate * 20));
  
  return (
    availabilityScore * 0.4 +
    responseTimeScore * 0.4 +
    errorRateScore * 0.2
  );
};

// 리소스 효율성 계산
export const calculateResourceEfficiency = (
  usage: { cpu: number; memory: number; gpu: number },
  allocated: { cpu: number; memory: number; gpu: number }
): number => {
  const cpuEfficiency = allocated.cpu > 0 ? (usage.cpu / allocated.cpu) * 100 : 0;
  const memoryEfficiency = allocated.memory > 0 ? (usage.memory / allocated.memory) * 100 : 0;
  const gpuEfficiency = allocated.gpu > 0 ? (usage.gpu / allocated.gpu) * 100 : 0;
  
  return (cpuEfficiency + memoryEfficiency + gpuEfficiency) / 3;
};

// 비용 예상 계산 (시간당)
export const estimateHourlyCost = (resources: {
  gpu_count: number;
  gpu_type: string;
  cpu_cores: number;
}): number => {
  // GPU 시간당 비용 (USD)
  const gpuCosts: Record<string, number> = {
    't4': 0.35,
    'v100': 2.48,
    'l40s': 3.20
  };
  
  const gpuCost = (gpuCosts[resources.gpu_type] || 0.35) * resources.gpu_count;
  const cpuCost = resources.cpu_cores * 0.05; // CPU 코어당 $0.05/시간
  
  return gpuCost + cpuCost;
};

// 월간 비용 예상
export const estimateMonthlyCost = (hourlyCost: number): number => {
  return hourlyCost * 24 * 30; // 30일 기준
};
