// [advice from AI] 대시보드 컴포넌트 - 데모 모드와 실제 모드 구분
/**
 * Dashboard Component
 * - 데모 모드: App.tsx의 20개 테넌시 데이터 표시
 * - 실제 모드: 실제 API 데이터 표시
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  LinearProgress,
  IconButton,
  Tooltip,
  Divider,
  Paper,
  useTheme,
  alpha
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  CloudQueue as CloudIcon,
  Memory as MemoryIcon,
  Speed as SpeedIcon,
  Storage as StorageIcon,
  Timeline as TimelineIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Call as CallIcon,
  Chat as ChatIcon,
  Person as PersonIcon,
  RecordVoiceOver as VoiceIcon,
  VolumeUp as TTSIcon,
  Analytics as AnalyticsIcon,
  QuestionAnswer as QAIcon,
  Psychology as PsychologyIcon,
  Web as WebIcon,
  Api as ApiIcon,
  Security as SecurityIcon,
  History as HistoryIcon,
  Build as BuildIcon,
  Videocam as VideocamIcon,
  DataObject as DataObjectIcon,
  Monitor as MonitorIcon,
  RecordVoiceOver as RecordVoiceOverIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// 데모 데이터 타입 정의
interface TenantStatus {
  id: string;
  name: string;
  status: 'running' | 'pending' | 'stopped' | 'error';
  preset: 'micro' | 'small' | 'medium' | 'large';
  gpuCount: number;
  cpuCount: number;
  memoryGB: number;
  services: string[];
  createdAt: string;
}

interface ResourceUsage {
  gpu: {
    total: number;
    used: number;
    percentage: number;
  };
  cpu: {
    total: number;
    used: number;
    percentage: number;
  };
  memory: {
    total: number;
    used: number;
    percentage: number;
  };
}

interface ServiceInstance {
  name: string;
  icon: React.ReactNode;
  count: number;
  color: string;
  tenants: string[];
}

interface ActivityLog {
  id: string;
  type: 'create' | 'update' | 'delete' | 'scale';
  message: string;
  timestamp: string;
  status: 'success' | 'warning' | 'error' | 'info';
}

// [advice from AI] 스타일드 컴포넌트 - 현대적인 그라디언트와 그림자 효과
const StyledCard = styled(Card)(({ theme }) => ({
  background: theme.palette.mode === 'dark'
    ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)}, ${alpha(theme.palette.secondary.main, 0.05)})`
    : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.secondary.main, 0.03)})`,
  backdropFilter: 'blur(20px)',
  border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
  boxShadow: theme.palette.mode === 'dark' 
    ? '0 8px 32px rgba(0, 0, 0, 0.3)' 
    : '0 4px 20px rgba(0, 0, 0, 0.1)',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.palette.mode === 'dark' 
      ? '0 12px 40px rgba(0, 0, 0, 0.4)' 
      : '0 8px 30px rgba(0, 0, 0, 0.15)',
  },
}));

const MetricCard = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.shape.borderRadius,
  background: theme.palette.mode === 'dark'
    ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)}, ${alpha(theme.palette.primary.dark, 0.1)})`
    : `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.1)}, ${alpha(theme.palette.primary.main, 0.05)})`,
  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '2px',
    background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
  },
}));

const ServiceIcon = styled(Avatar)(({ theme, color }: { theme: any; color: string }) => ({
  backgroundColor: color,
  color: theme.palette.common.white,
  width: 40,
  height: 40,
  fontSize: '1.2rem',
}));

// [advice from AI] 데모 데이터를 App.tsx의 20개 테넌시와 일치하도록 수정
const demoData = {
  tenants: [
    // 메인 서비스 테넌시
    {
      id: 'demo-tenant-1',
      name: '글로벌 콜센터',
      status: 'running' as const,
      preset: 'large' as const,
      gpuCount: 6,
      cpuCount: 45,
      memoryGB: 64,
      services: ['callbot', 'chatbot', 'advisor', 'gateway', 'monitoring'],
      createdAt: '2024-01-15T10:30:00Z'
    },
    {
      id: 'demo-tenant-2',
      name: '스마트 상담봇',
      status: 'running' as const,
      preset: 'medium' as const,
      gpuCount: 3,
      cpuCount: 24,
      memoryGB: 32,
      services: ['chatbot', 'advisor', 'nlp', 'history'],
      createdAt: '2024-01-14T15:20:00Z'
    },
    {
      id: 'demo-tenant-3',
      name: 'AI 어드바이저',
      status: 'running' as const,
      preset: 'medium' as const,
      gpuCount: 4,
      cpuCount: 28,
      memoryGB: 36,
      services: ['advisor', 'nlp', 'aicm', 'scenario-builder'],
      createdAt: '2024-01-13T09:15:00Z'
    },
    
    // AI/NLP 서비스 테넌시
    {
      id: 'demo-tenant-4',
      name: '음성 분석 서비스',
      status: 'running' as const,
      preset: 'small' as const,
      gpuCount: 2,
      cpuCount: 16,
      memoryGB: 20,
      services: ['stt', 'tts', 'nlp'],
      createdAt: '2024-01-12T14:45:00Z'
    },
    {
      id: 'demo-tenant-5',
      name: 'TTS 음성합성',
      status: 'running' as const,
      preset: 'small' as const,
      gpuCount: 2,
      cpuCount: 18,
      memoryGB: 22,
      services: ['tts', 'nlp'],
      createdAt: '2024-01-11T11:20:00Z'
    },
    {
      id: 'demo-tenant-6',
      name: 'NLP 엔진',
      status: 'running' as const,
      preset: 'medium' as const,
      gpuCount: 3,
      cpuCount: 26,
      memoryGB: 30,
      services: ['nlp', 'aicm', 'qa'],
      createdAt: '2024-01-10T16:30:00Z'
    },
    {
      id: 'demo-tenant-7',
      name: 'AI 대화 관리',
      status: 'running' as const,
      preset: 'large' as const,
      gpuCount: 5,
      cpuCount: 38,
      memoryGB: 48,
      services: ['aicm', 'nlp', 'history', 'scenario-builder', 'monitoring'],
      createdAt: '2024-01-09T13:15:00Z'
    },
    
    // 분석 서비스 테넌시
    {
      id: 'demo-tenant-8',
      name: 'TA 통계분석',
      status: 'running' as const,
      preset: 'medium' as const,
      gpuCount: 3,
      cpuCount: 22,
      memoryGB: 28,
      services: ['ta', 'postgresql', 'monitoring'],
      createdAt: '2024-01-08T10:45:00Z'
    },
    {
      id: 'demo-tenant-9',
      name: 'QA 품질관리',
      status: 'running' as const,
      preset: 'small' as const,
      gpuCount: 2,
      cpuCount: 16,
      memoryGB: 20,
      services: ['qa', 'postgresql'],
      createdAt: '2024-01-07T14:20:00Z'
    },
    
    // 인프라 서비스 테넌시
    {
      id: 'demo-tenant-10',
      name: '웹 서버 클러스터',
      status: 'running' as const,
      preset: 'large' as const,
      gpuCount: 4,
      cpuCount: 32,
      memoryGB: 40,
      services: ['nginx', 'gateway', 'monitoring'],
      createdAt: '2024-01-06T09:30:00Z'
    },
    {
      id: 'demo-tenant-11',
      name: 'API 게이트웨이',
      status: 'running' as const,
      preset: 'medium' as const,
      gpuCount: 3,
      cpuCount: 24,
      memoryGB: 28,
      services: ['gateway', 'auth', 'monitoring'],
      createdAt: '2024-01-05T11:45:00Z'
    },
    {
      id: 'demo-tenant-12',
      name: '권한 관리 시스템',
      status: 'running' as const,
      preset: 'medium' as const,
      gpuCount: 2,
      cpuCount: 20,
      memoryGB: 24,
      services: ['auth', 'postgresql'],
      createdAt: '2024-01-04T15:10:00Z'
    },
    {
      id: 'demo-tenant-13',
      name: '대화 이력 저장소',
      status: 'running' as const,
      preset: 'large' as const,
      gpuCount: 4,
      cpuCount: 36,
      memoryGB: 44,
      services: ['history', 'postgresql', 'vector-db', 'redis'],
      createdAt: '2024-01-03T12:25:00Z'
    },
    {
      id: 'demo-tenant-14',
      name: '시나리오 빌더',
      status: 'running' as const,
      preset: 'medium' as const,
      gpuCount: 3,
      cpuCount: 26,
      memoryGB: 30,
      services: ['scenario-builder', 'nlp', 'postgresql'],
      createdAt: '2024-01-02T16:40:00Z'
    },
    {
      id: 'demo-tenant-15',
      name: '시스템 모니터링',
      status: 'running' as const,
      preset: 'medium' as const,
      gpuCount: 2,
      cpuCount: 20,
      memoryGB: 24,
      services: ['monitoring', 'postgresql', 'redis'],
      createdAt: '2024-01-01T08:15:00Z'
    },
    
    // 데이터 서비스 테넌시
    {
      id: 'demo-tenant-16',
      name: '데이터베이스 클러스터',
      status: 'running' as const,
      preset: 'large' as const,
      gpuCount: 3,
      cpuCount: 28,
      memoryGB: 36,
      services: ['postgresql', 'vector-db', 'redis', 'monitoring'],
      createdAt: '2023-12-31T20:30:00Z'
    },
    {
      id: 'demo-tenant-17',
      name: '벡터 데이터베이스',
      status: 'running' as const,
      preset: 'medium' as const,
      gpuCount: 3,
      cpuCount: 24,
      memoryGB: 28,
      services: ['vector-db', 'postgresql'],
      createdAt: '2023-12-30T14:20:00Z'
    },
    {
      id: 'demo-tenant-18',
      name: '캐시 시스템',
      status: 'running' as const,
      preset: 'medium' as const,
      gpuCount: 2,
      cpuCount: 18,
      memoryGB: 22,
      services: ['redis', 'monitoring'],
      createdAt: '2023-12-29T10:45:00Z'
    },
    
    // 특화 서비스 테넌시
    {
      id: 'demo-tenant-19',
      name: '실시간 통신',
      status: 'running' as const,
      preset: 'medium' as const,
      gpuCount: 3,
      cpuCount: 24,
      memoryGB: 28,
      services: ['livekit', 'monitoring'],
      createdAt: '2023-12-28T17:15:00Z'
    },
    {
      id: 'demo-tenant-20',
      name: '화자 분리 시스템',
      status: 'running' as const,
      preset: 'small' as const,
      gpuCount: 2,
      cpuCount: 16,
      memoryGB: 20,
      services: ['speaker-separation', 'stt'],
      createdAt: '2023-12-27T13:50:00Z'
    }
  ],
  resources: {
    gpu: { total: 65, used: 42, percentage: 64.6 },
    cpu: { total: 512, used: 378, percentage: 73.8 },
    memory: { total: 640, used: 456, percentage: 71.3 }
  },
  services: [
    { name: 'callbot', icon: <CallIcon />, count: 25, color: '#3b82f6', tenants: ['demo-tenant-1', 'demo-tenant-4', 'demo-tenant-20'] },
    { name: 'chatbot', icon: <ChatIcon />, count: 85, color: '#10b981', tenants: ['demo-tenant-1', 'demo-tenant-2', 'demo-tenant-6'] },
    { name: 'advisor', icon: <PersonIcon />, count: 32, color: '#f59e0b', tenants: ['demo-tenant-1', 'demo-tenant-2', 'demo-tenant-3'] },
    { name: 'stt', icon: <VoiceIcon />, count: 18, color: '#8b5cf6', tenants: ['demo-tenant-4', 'demo-tenant-20'] },
    { name: 'tts', icon: <TTSIcon />, count: 16, color: '#ec4899', tenants: ['demo-tenant-4', 'demo-tenant-5'] },
    { name: 'nlp', icon: <PsychologyIcon />, count: 28, color: '#06b6d4', tenants: ['demo-tenant-2', 'demo-tenant-3', 'demo-tenant-4', 'demo-tenant-6', 'demo-tenant-7', 'demo-tenant-14'] },
    { name: 'aicm', icon: <ChatIcon />, count: 22, color: '#8b5cf6', tenants: ['demo-tenant-3', 'demo-tenant-6', 'demo-tenant-7'] },
    { name: 'ta', icon: <AnalyticsIcon />, count: 15, color: '#f97316', tenants: ['demo-tenant-8'] },
    { name: 'qa', icon: <QAIcon />, count: 12, color: '#84cc16', tenants: ['demo-tenant-2', 'demo-tenant-6', 'demo-tenant-9'] },
    { name: 'nginx', icon: <WebIcon />, count: 8, color: '#dc2626', tenants: ['demo-tenant-10'] },
    { name: 'gateway', icon: <ApiIcon />, count: 14, color: '#7c3aed', tenants: ['demo-tenant-10', 'demo-tenant-11'] },
    { name: 'auth', icon: <SecurityIcon />, count: 10, color: '#059669', tenants: ['demo-tenant-11', 'demo-tenant-12'] },
    { name: 'history', icon: <HistoryIcon />, count: 18, color: '#0891b2', tenants: ['demo-tenant-2', 'demo-tenant-13'] },
    { name: 'scenario-builder', icon: <BuildIcon />, count: 12, color: '#be185d', tenants: ['demo-tenant-3', 'demo-tenant-14'] },
    { name: 'monitoring', icon: <MonitorIcon />, count: 20, color: '#65a30d', tenants: ['demo-tenant-1', 'demo-tenant-7', 'demo-tenant-10', 'demo-tenant-11', 'demo-tenant-15', 'demo-tenant-16', 'demo-tenant-18', 'demo-tenant-19'] },
    { name: 'postgresql', icon: <StorageIcon />, count: 16, color: '#1d4ed8', tenants: ['demo-tenant-8', 'demo-tenant-9', 'demo-tenant-12', 'demo-tenant-13', 'demo-tenant-14', 'demo-tenant-15', 'demo-tenant-16', 'demo-tenant-17'] },
    { name: 'vector-db', icon: <DataObjectIcon />, count: 14, color: '#ea580c', tenants: ['demo-tenant-13', 'demo-tenant-16', 'demo-tenant-17'] },
    { name: 'redis', icon: <MemoryIcon />, count: 12, color: '#dc2626', tenants: ['demo-tenant-13', 'demo-tenant-15', 'demo-tenant-16', 'demo-tenant-18'] },
    { name: 'livekit', icon: <VideocamIcon />, count: 8, color: '#059669', tenants: ['demo-tenant-19'] },
    { name: 'speaker-separation', icon: <RecordVoiceOverIcon />, count: 6, color: '#7c3aed', tenants: ['demo-tenant-20'] }
  ],
  activities: [
    {
      id: '1',
      type: 'create' as const,
      message: '화자 분리 시스템 테넌시 생성 완료',
      timestamp: '2분 전',
      status: 'success' as const
    },
    {
      id: '2',
      type: 'update' as const,
      message: 'AI 대화 관리 GPU 리소스 4개 → 5개로 증가',
      timestamp: '5분 전',
      status: 'success' as const
    },
    {
      id: '3',
      type: 'create' as const,
      message: '글로벌 콜센터에 모니터링 서비스 추가',
      timestamp: '8분 전',
      status: 'success' as const
    },
    {
      id: '4',
      type: 'scale' as const,
      message: '음성 분석 서비스 자동 스케일링 완료',
      timestamp: '12분 전',
      status: 'info' as const
    },
    {
      id: '5',
      type: 'update' as const,
      message: '데이터베이스 클러스터 메모리 36GB → 40GB로 증가',
      timestamp: '15분 전',
      status: 'success' as const
    },
    {
      id: '6',
      type: 'create' as const,
      message: '실시간 통신 테넌시 생성 완료',
      timestamp: '18분 전',
      status: 'success' as const
    }
  ]
};

// 상태 아이콘 컴포넌트
const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'running':
      return <CheckCircleIcon color="success" />;
    case 'pending':
      return <WarningIcon color="warning" />;
    case 'stopped':
      return <InfoIcon color="info" />;
    case 'error':
      return <ErrorIcon color="error" />;
    default:
      return <InfoIcon color="info" />;
  }
};

// 활동 상태 아이콘 컴포넌트
const ActivityIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'success':
      return <CheckCircleIcon color="success" />;
    case 'warning':
      return <WarningIcon color="warning" />;
    case 'error':
      return <ErrorIcon color="error" />;
    case 'info':
      return <InfoIcon color="info" />;
    default:
      return <InfoIcon color="info" />;
  }
};

// [advice from AI] 메인 대시보드 컴포넌트 - 데모 모드와 실제 모드 구분
export const Dashboard: React.FC<{ isDemoMode?: boolean }> = ({ isDemoMode = true }) => {
  const theme = useTheme();
  const [data, setData] = useState(demoData);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [loading, setLoading] = useState(false);

  // [advice from AI] 데모 모드에 따른 데이터 로드 분기
  useEffect(() => {
    if (isDemoMode) {
      // 데모 모드: 하드코딩된 데모 데이터 사용
      setData(demoData);
    } else {
      // 실제 모드: 실제 API 데이터 로드
      loadRealData();
    }
  }, [isDemoMode]);

  // 실제 데이터 로드 함수
  const loadRealData = async () => {
    setLoading(true);
    try {
      // 실제 테넌시 및 시스템 데이터 API 호출
      const [tenantsRes, systemRes] = await Promise.all([
        fetch('http://localhost:8001/api/v1/tenants/'),
        fetch('http://localhost:8001/api/v1/tenants/monitoring/system-metrics')
      ]);

      if (tenantsRes.ok && systemRes.ok) {
        const tenantsData = await tenantsRes.json();
        const systemData = await systemRes.json();
        
        // API 데이터를 대시보드 형식으로 변환
        const realData = {
          tenants: tenantsData.tenants?.map((tenant: any) => ({
            id: tenant.tenant_id,
            name: tenant.name || tenant.tenant_id,
            status: tenant.status,
            preset: tenant.preset,
            gpuCount: tenant.gpu_limit || 0,
            cpuCount: tenant.cpu_limit ? parseInt(tenant.cpu_limit.replace('m', '')) / 1000 : 0,
            memoryGB: tenant.memory_limit ? parseInt(tenant.memory_limit.replace('Gi', '')) : 0,
            services: [], // 서비스 정보는 별도 API 호출 필요
            createdAt: tenant.created_at
          })) || [],
          resources: {
            gpu: { total: systemData.summary?.total_gpu || 0, used: 0, percentage: 0 },
            cpu: { total: systemData.summary?.total_cpu || 0, used: 0, percentage: 0 },
            memory: { total: systemData.summary?.total_memory || 0, used: 0, percentage: 0 }
          },
          services: [], // 서비스 정보는 별도 API 호출 필요
          activities: [] // 활동 정보는 별도 API 호출 필요
        };
        
        setData(realData);
      }
    } catch (error) {
      console.error('실제 데이터 로드 실패:', error);
      // API 실패 시 데모 데이터로 폴백
      setData(demoData);
    } finally {
      setLoading(false);
    }
  };

  // 실시간 데이터 업데이트 (데모 모드에서만)
  useEffect(() => {
    if (!isDemoMode) return;
    
    const interval = setInterval(() => {
      setData(prevData => ({
        ...prevData,
        resources: {
          gpu: {
            ...prevData.resources.gpu,
            used: Math.max(30, Math.min(55, prevData.resources.gpu.used + (Math.random() > 0.5 ? 1 : -1))),
          },
          cpu: {
            ...prevData.resources.cpu,
            used: Math.max(350, Math.min(400, prevData.resources.cpu.used + (Math.random() > 0.5 ? 2 : -2))),
          },
          memory: {
            ...prevData.resources.memory,
            used: Math.max(400, Math.min(500, prevData.resources.memory.used + (Math.random() > 0.5 ? 3 : -3))),
          }
        }
      }));
      setLastUpdate(new Date());
    }, 3000);

    return () => clearInterval(interval);
  }, [isDemoMode]);

  // 리소스 사용률 계산
  const calculatePercentage = (used: number, total: number) => {
    return Math.round((used / total) * 100);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* 헤더 */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
            🚀 ECP-AI 대시보드
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Kubernetes Orchestrator 실시간 모니터링 및 관리
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Chip 
            icon={<RefreshIcon />} 
            label={`마지막 업데이트: ${lastUpdate.toLocaleTimeString()}`} 
            variant="outlined" 
            color="primary" 
          />
          <Chip 
            icon={<TimelineIcon />} 
            label="실시간 모드" 
            color="success" 
            variant="filled" 
          />
        </Box>
      </Box>

      {/* 테넌시 현황 카드 */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <MetricCard>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
                <CloudIcon sx={{ fontSize: 28 }} />
              </Avatar>
              <Box>
                <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
                  {data.tenants.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  활성 테넌시
                </Typography>
              </Box>
            </Box>
          </MetricCard>
        </Grid>
        <Grid item xs={12} md={3}>
          <MetricCard>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'secondary.main', width: 56, height: 56 }}>
                <MemoryIcon sx={{ fontSize: 28 }} />
              </Avatar>
              <Box>
                <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
                  {data.resources.gpu.used}/{data.resources.gpu.total}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  GPU 사용량
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={data.resources.gpu.percentage} 
                  sx={{ mt: 1, height: 6, borderRadius: 3 }}
                />
              </Box>
            </Box>
          </MetricCard>
        </Grid>
        <Grid item xs={12} md={3}>
          <MetricCard>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'success.main', width: 56, height: 56 }}>
                <SpeedIcon sx={{ fontSize: 28 }} />
              </Avatar>
              <Box>
                <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
                  {data.resources.cpu.used}/{data.resources.cpu.total}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  CPU 코어
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={data.resources.cpu.percentage} 
                  sx={{ mt: 1, height: 6, borderRadius: 3 }}
                />
              </Box>
            </Box>
          </MetricCard>
        </Grid>
        <Grid item xs={12} md={3}>
          <MetricCard>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'warning.main', width: 56, height: 56 }}>
                <StorageIcon sx={{ fontSize: 28 }} />
              </Avatar>
              <Box>
                <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
                  {data.resources.memory.used}/{data.resources.memory.total}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  메모리 (GB)
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={data.resources.memory.percentage} 
                  sx={{ mt: 1, height: 6, borderRadius: 3 }}
                />
              </Box>
            </Box>
          </MetricCard>
        </Grid>
      </Grid>

      {/* 메인 콘텐츠 */}
      <Grid container spacing={3}>
        {/* 테넌시 목록 */}
        <Grid item xs={12} md={8}>
          <StyledCard>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <DashboardIcon color="primary" />
                <Typography variant="h6" component="h2" sx={{ fontWeight: 'bold' }}>
                  테넌시 현황
                </Typography>
              </Box>
              <Grid container spacing={2}>
                {data.tenants.map((tenant) => (
                  <Grid item xs={12} key={tenant.id}>
                    <Paper 
                      sx={{ 
                        p: 2, 
                        background: theme.palette.mode === 'dark' 
                          ? alpha(theme.palette.background.paper, 0.8) 
                          : alpha(theme.palette.background.paper, 0.9),
                        border: `1px solid ${alpha(theme.palette.divider, 0.2)}`
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <StatusIcon status={tenant.status} />
                          <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                              {tenant.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {tenant.preset} 프리셋 • {tenant.services.join(', ')}
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography variant="body2" color="text.secondary">
                            GPU: {tenant.gpuCount} • CPU: {tenant.cpuCount} • RAM: {tenant.memoryGB}GB
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            생성: {new Date(tenant.createdAt).toLocaleDateString()}
                          </Typography>
                        </Box>
                      </Box>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </StyledCard>
        </Grid>

        {/* 서비스별 인스턴스 현황 */}
        <Grid item xs={12} md={4}>
          <StyledCard>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <TimelineIcon color="primary" />
                <Typography variant="h6" component="h2" sx={{ fontWeight: 'bold' }}>
                  서비스 현황
                </Typography>
              </Box>
              <List>
                {data.services.map((service) => (
                  <ListItem key={service.name} sx={{ px: 0 }}>
                    <ListItemIcon>
                      <ServiceIcon theme={theme} color={service.color}>
                        {service.icon}
                      </ServiceIcon>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                            {service.name}
                          </Typography>
                          <Chip 
                            label={service.count} 
                            size="small" 
                            color="primary" 
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={`${service.tenants.length}개 테넌시에서 실행 중`}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </StyledCard>
        </Grid>

        {/* 최근 활동 피드 */}
        <Grid item xs={12}>
          <StyledCard>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <TrendingUpIcon color="primary" />
                <Typography variant="h6" component="h2" sx={{ fontWeight: 'bold' }}>
                  최근 활동
                </Typography>
              </Box>
              <Grid container spacing={2}>
                {data.activities.map((activity) => (
                  <Grid item xs={12} md={6} key={activity.id}>
                    <Paper 
                      sx={{ 
                        p: 2, 
                        background: theme.palette.mode === 'dark' 
                          ? alpha(theme.palette.background.paper, 0.8) 
                          : alpha(theme.palette.background.paper, 0.9),
                        border: `1px solid ${alpha(theme.palette.divider, 0.2)}`
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                        <ActivityIcon status={activity.status} />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                            {activity.message}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {activity.timestamp}
                          </Typography>
                        </Box>
                      </Box>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </StyledCard>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
