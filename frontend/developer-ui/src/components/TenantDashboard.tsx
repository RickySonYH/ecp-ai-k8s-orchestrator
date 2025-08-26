// [advice from AI] ECP-AI Kubernetes Orchestrator 테넌시 대시보드
/**
 * 개별 테넌시의 상세한 상태와 성능을 모니터링하는 대시보드
 * - 프리셋별 리소스 사용률 및 성능 메트릭
 * - 서비스별 인스턴스 현황 및 상태
 * - 실시간 로그 및 알림
 * - 리소스 스케일링 및 관리 기능
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
  alpha,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  Tabs,
  Tab,
  Badge
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
  Settings as SettingsIcon,
  Scale as ScaleIcon,
  History as HistoryIcon,
  Notifications as NotificationsIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  RestartAlt as RestartIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// 타입 정의
interface TenantInfo {
  id: string;
  name: string;
  status: 'running' | 'pending' | 'stopped' | 'error';
  preset: 'micro' | 'small' | 'medium' | 'large';
  gpuCount: number;
  cpuCount: number;
  memoryGB: number;
  services: string[];
  createdAt: string;
  owner: string;
  description: string;
}

interface ServiceInstance {
  name: string;
  icon: React.ReactNode;
  count: number;
  status: 'healthy' | 'warning' | 'error' | 'starting';
  color: string;
  port: number;
  replicas: number;
  targetReplicas: number;
}

interface ResourceUsage {
  gpu: {
    total: number;
    used: number;
    percentage: number;
    temperature: number;
    power: number;
  };
  cpu: {
    total: number;
    used: number;
    percentage: number;
    load: number;
  };
  memory: {
    total: number;
    used: number;
    percentage: number;
    swap: number;
  };
  storage: {
    total: number;
    used: number;
    percentage: number;
    iops: number;
  };
}

interface PerformanceMetrics {
  responseTime: number;
  throughput: number;
  errorRate: number;
  availability: number;
  uptime: number;
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  service: string;
  message: string;
  details?: any;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
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

// 프리셋별 리소스 규칙
const presetRules = {
  micro: {
    maxChannels: 10,
    maxUsers: 50,
    gpuRange: [1, 2],
    cpuRange: [4, 8],
    memoryRange: [8, 16],
    description: '개발/테스트용 소규모 환경'
  },
  small: {
    maxChannels: 100,
    maxUsers: 500,
    gpuRange: [2, 4],
    cpuRange: [8, 16],
    memoryRange: [16, 32],
    description: '중소규모 운영 환경'
  },
  medium: {
    maxChannels: 500,
    maxUsers: 2000,
    gpuRange: [4, 8],
    cpuRange: [16, 32],
    memoryRange: [32, 64],
    description: '대규모 운영 환경'
  },
  large: {
    maxChannels: 1000,
    maxUsers: 5000,
    gpuRange: [8, 16],
    cpuRange: [32, 64],
    memoryRange: [64, 128],
    description: '엔터프라이즈급 대용량 환경'
  }
};

// 데모 데이터
const demoTenantData = {
  tenant: {
    id: 'test-download',
    name: 'test-download',
    status: 'running' as const,
    preset: 'small' as const,
    gpuCount: 3,
    cpuCount: 31,
    memoryGB: 16,
    services: ['callbot', 'chatbot', 'advisor'],
    createdAt: '2024-01-15T10:30:00Z',
    owner: 'admin',
    description: '콜센터 및 챗봇 서비스 테스트 환경'
  },
  resources: {
    gpu: { total: 3, used: 2.1, percentage: 70, temperature: 65, power: 180 },
    cpu: { total: 31, used: 22.3, percentage: 72, load: 0.72 },
    memory: { total: 16, used: 11.2, percentage: 70, swap: 0 },
    storage: { total: 100, used: 45.8, percentage: 46, iops: 1250 }
  },
  performance: {
    responseTime: 45,
    throughput: 1250,
    errorRate: 0.2,
    availability: 99.8,
    uptime: 168
  },
  services: [
    { name: 'callbot', icon: <CallIcon />, count: 15, status: 'healthy' as const, color: '#3b82f6', port: 8080, replicas: 3, targetReplicas: 3 },
    { name: 'chatbot', icon: <ChatIcon />, count: 75, status: 'healthy' as const, color: '#10b981', port: 8081, replicas: 5, targetReplicas: 5 },
    { name: 'advisor', icon: <PersonIcon />, count: 12, status: 'warning' as const, color: '#f59e0b', port: 8082, replicas: 2, targetReplicas: 3 },
    { name: 'stt', icon: <VoiceIcon />, count: 8, status: 'healthy' as const, color: '#8b5cf6', port: 8083, replicas: 2, targetReplicas: 2 },
    { name: 'tts', icon: <TTSIcon />, count: 6, status: 'healthy' as const, color: '#ec4899', port: 8084, replicas: 2, targetReplicas: 2 },
    { name: 'qa', icon: <QAIcon />, count: 4, status: 'healthy' as const, color: '#06b6d4', port: 8085, replicas: 1, targetReplicas: 1 }
  ],
  logs: [
    { id: '1', timestamp: '2분 전', level: 'info' as const, service: 'callbot', message: '새로운 콜 연결 수락됨' },
    { id: '2', timestamp: '5분 전', level: 'warning' as const, service: 'advisor', message: 'GPU 메모리 사용률 85% 초과' },
    { id: '3', timestamp: '8분 전', level: 'info' as const, service: 'chatbot', message: '사용자 세션 시작됨' },
    { id: '4', timestamp: '12분 전', level: 'error' as const, service: 'stt', message: '음성 인식 서비스 일시적 오류' },
    { id: '5', timestamp: '15분 전', level: 'info' as const, service: 'tts', message: 'TTS 캐시 히트율 92%' }
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

// 서비스 상태 아이콘 컴포넌트
const ServiceStatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'healthy':
      return <CheckCircleIcon color="success" />;
    case 'warning':
      return <WarningIcon color="warning" />;
    case 'error':
      return <ErrorIcon color="error" />;
    case 'starting':
      return <InfoIcon color="info" />;
    default:
      return <InfoIcon color="info" />;
  }
};

// 로그 레벨 아이콘 컴포넌트
const LogLevelIcon = ({ level }: { level: string }) => {
  switch (level) {
    case 'info':
      return <InfoIcon color="info" />;
    case 'warning':
      return <WarningIcon color="warning" />;
    case 'error':
      return <ErrorIcon color="error" />;
    case 'debug':
      return <InfoIcon color="info" />;
    default:
      return <InfoIcon color="info" />;
  }
};

// 탭 패널 컴포넌트
function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

// 메인 테넌시 대시보드 컴포넌트
export const TenantDashboard: React.FC<{ tenantId: string; onTenantDeleted: (tenantId: string) => void }> = ({
  tenantId,
  onTenantDeleted
}) => {
  const theme = useTheme();
  const [currentTab, setCurrentTab] = useState(0);
  const [data, setData] = useState(demoTenantData);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [scaleDialogOpen, setScaleDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceInstance | null>(null);
  const [scaleReplicas, setScaleReplicas] = useState(1);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // 실시간 데이터 업데이트 (데모용)
  useEffect(() => {
    const interval = setInterval(() => {
      setData(prevData => ({
        ...prevData,
        resources: {
          gpu: {
            ...prevData.resources.gpu,
            used: Math.max(1.5, Math.min(2.8, prevData.resources.gpu.used + (Math.random() > 0.5 ? 0.1 : -0.1))),
            temperature: Math.max(60, Math.min(75, prevData.resources.gpu.temperature + (Math.random() > 0.5 ? 1 : -1))),
          },
          cpu: {
            ...prevData.resources.cpu,
            used: Math.max(18, Math.min(28, prevData.resources.cpu.used + (Math.random() > 0.5 ? 0.5 : -0.5))),
            load: Math.max(0.6, Math.min(0.85, prevData.resources.cpu.load + (Math.random() > 0.5 ? 0.02 : -0.02))),
          },
          memory: {
            ...prevData.resources.memory,
            used: Math.max(9, Math.min(13, prevData.resources.memory.used + (Math.random() > 0.5 ? 0.2 : -0.2))),
          },
          storage: {
            ...prevData.resources.storage,
            used: Math.max(44, Math.min(48, prevData.resources.storage.used + (Math.random() > 0.5 ? 0.1 : -0.1))),
          }
        }
      }));
      setLastUpdate(new Date());
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // 스케일링 다이얼로그 열기
  const handleScaleService = (service: ServiceInstance) => {
    setSelectedService(service);
    setScaleReplicas(service.targetReplicas);
    setScaleDialogOpen(true);
  };

  // 스케일링 적용
  const handleScaleApply = () => {
    if (selectedService) {
      setData(prevData => ({
        ...prevData,
        services: prevData.services.map(s => 
          s.name === selectedService.name 
            ? { ...s, targetReplicas: scaleReplicas }
            : s
        )
      }));
      setSnackbarMessage(`${selectedService.name} 서비스 레플리카를 ${scaleReplicas}개로 조정했습니다.`);
      setSnackbarOpen(true);
      setScaleDialogOpen(false);
    }
  };

  // 테넌시 삭제
  const handleDeleteTenant = () => {
    if (window.confirm('정말로 이 테넌시를 삭제하시겠습니까?')) {
      onTenantDeleted(tenantId);
    }
  };

  // 프리셋 정보 가져오기
  const presetInfo = presetRules[data.tenant.preset];

  return (
    <Box sx={{ p: 3 }}>
      {/* 헤더 */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
            🏢 {data.tenant.name} 테넌시 대시보드
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {presetInfo.description} • {data.tenant.description}
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
            icon={<StatusIcon status={data.tenant.status} />} 
            label={data.tenant.status} 
            color={data.tenant.status === 'running' ? 'success' : 'warning'} 
            variant="filled" 
          />
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleDeleteTenant}
          >
            테넌시 삭제
          </Button>
        </Box>
      </Box>

      {/* 테넌시 기본 정보 */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <MetricCard>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
                <CloudIcon sx={{ fontSize: 28 }} />
              </Avatar>
              <Box>
                <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
                  {data.tenant.preset.toUpperCase()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  프리셋
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  최대 {presetInfo.maxChannels}채널, {presetInfo.maxUsers}사용자
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
                  {data.resources.gpu.used.toFixed(1)}/{data.resources.gpu.total}
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
                  {data.resources.cpu.used.toFixed(1)}/{data.resources.cpu.total}
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
                  {data.resources.memory.used.toFixed(1)}/{data.resources.memory.total}
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

      {/* 탭 네비게이션 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={currentTab} onChange={(e, newValue) => setCurrentTab(newValue)}>
          <Tab label="📊 개요" />
          <Tab label="🔧 서비스" />
          <Tab label="📈 성능" />
          <Tab label="📝 로그" />
          <Tab label="⚙️ 설정" />
        </Tabs>
      </Box>

      {/* 탭 컨텐츠 */}
      <TabPanel value={currentTab} index={0}>
        {/* 개요 탭 */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <StyledCard>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <DashboardIcon color="primary" />
                  <Typography variant="h6" component="h2" sx={{ fontWeight: 'bold' }}>
                    리소스 사용 현황
                  </Typography>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>GPU 상세 정보</Typography>
                      <Typography variant="body2">온도: {data.resources.gpu.temperature}°C</Typography>
                      <Typography variant="body2">전력: {data.resources.gpu.power}W</Typography>
                      <Typography variant="body2">사용률: {data.resources.gpu.percentage}%</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>CPU 상세 정보</Typography>
                      <Typography variant="body2">로드: {(data.resources.cpu.load * 100).toFixed(1)}%</Typography>
                      <Typography variant="body2">사용률: {data.resources.cpu.percentage}%</Typography>
                      <Typography variant="body2">코어: {data.resources.cpu.total}개</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>메모리 상세 정보</Typography>
                      <Typography variant="body2">사용률: {data.resources.memory.percentage}%</Typography>
                      <Typography variant="body2">스왑: {data.resources.memory.swap}GB</Typography>
                      <Typography variant="body2">총 용량: {data.resources.memory.total}GB</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>스토리지 상세 정보</Typography>
                      <Typography variant="body2">사용률: {data.resources.storage.percentage}%</Typography>
                      <Typography variant="body2">IOPS: {data.resources.storage.iops}</Typography>
                      <Typography variant="body2">총 용량: {data.resources.storage.total}GB</Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </StyledCard>
          </Grid>
          <Grid item xs={12} md={4}>
            <StyledCard>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <AnalyticsIcon color="primary" />
                  <Typography variant="h6" component="h2" sx={{ fontWeight: 'bold' }}>
                    성능 지표
                  </Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">응답 시간</Typography>
                  <Typography variant="h6" color="primary">{data.performance.responseTime}ms</Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">처리량</Typography>
                  <Typography variant="h6" color="secondary">{data.performance.throughput} req/s</Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">에러율</Typography>
                  <Typography variant="h6" color="error">{data.performance.errorRate}%</Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">가용성</Typography>
                  <Typography variant="h6" color="success">{data.performance.availability}%</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">가동 시간</Typography>
                  <Typography variant="h6" color="info">{data.performance.uptime}시간</Typography>
                </Box>
              </CardContent>
            </StyledCard>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={currentTab} index={1}>
        {/* 서비스 탭 */}
        <StyledCard>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <TimelineIcon color="primary" />
              <Typography variant="h6" component="h2" sx={{ fontWeight: 'bold' }}>
                서비스 인스턴스 현황
              </Typography>
            </Box>
            <Grid container spacing={2}>
              {data.services.map((service) => (
                <Grid item xs={12} md={6} key={service.name}>
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
                        <ServiceIcon theme={theme} color={service.color}>
                          {service.icon}
                        </ServiceIcon>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                            {service.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            포트: {service.port} • 레플리카: {service.replicas}/{service.targetReplicas}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ServiceStatusIcon status={service.status} />
                        <IconButton
                          size="small"
                          onClick={() => handleScaleService(service)}
                          color="primary"
                        >
                          <ScaleIcon />
                        </IconButton>
                      </Box>
                    </Box>
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        활성 인스턴스: {service.count}개
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={(service.replicas / service.targetReplicas) * 100} 
                        sx={{ mt: 1, height: 4, borderRadius: 2 }}
                      />
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </StyledCard>
      </TabPanel>

      <TabPanel value={currentTab} index={2}>
        {/* 성능 탭 */}
        <StyledCard>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <TrendingUpIcon color="primary" />
              <Typography variant="h6" component="h2" sx={{ fontWeight: 'bold' }}>
                성능 모니터링
              </Typography>
            </Box>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              실시간 성능 메트릭 및 트렌드 분석
            </Typography>
            {/* 여기에 차트 컴포넌트들이 들어갈 예정 */}
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary">
                📊 차트 컴포넌트 구현 예정
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Chart.js 또는 Recharts를 사용한 성능 시각화
              </Typography>
            </Paper>
          </CardContent>
        </StyledCard>
      </TabPanel>

      <TabPanel value={currentTab} index={3}>
        {/* 로그 탭 */}
        <StyledCard>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <HistoryIcon color="primary" />
              <Typography variant="h6" component="h2" sx={{ fontWeight: 'bold' }}>
                실시간 로그
              </Typography>
            </Box>
            <List>
              {data.logs.map((log) => (
                <ListItem key={log.id} sx={{ px: 0 }}>
                  <ListItemIcon>
                    <LogLevelIcon level={log.level} />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          {log.message}
                        </Typography>
                        <Chip 
                          label={log.service} 
                          size="small" 
                          color="primary" 
                          variant="outlined"
                        />
                      </Box>
                    }
                    secondary={log.timestamp}
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </StyledCard>
      </TabPanel>

      <TabPanel value={currentTab} index={4}>
        {/* 설정 탭 */}
        <StyledCard>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <SettingsIcon color="primary" />
              <Typography variant="h6" component="h2" sx={{ fontWeight: 'bold' }}>
                테넌시 설정
              </Typography>
            </Box>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              테넌시 구성 및 관리 설정
            </Typography>
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary">
                ⚙️ 설정 컴포넌트 구현 예정
              </Typography>
              <Typography variant="body2" color="text.secondary">
                환경변수, 볼륨, 네트워크 등 고급 설정
              </Typography>
            </Paper>
          </CardContent>
        </StyledCard>
      </TabPanel>

      {/* 스케일링 다이얼로그 */}
      <Dialog open={scaleDialogOpen} onClose={() => setScaleDialogOpen(false)}>
        <DialogTitle>서비스 스케일링</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography variant="body1" gutterBottom>
              {selectedService?.name} 서비스의 레플리카 수를 조정합니다.
            </Typography>
            <TextField
              fullWidth
              label="레플리카 수"
              type="number"
              value={scaleReplicas}
              onChange={(e) => setScaleReplicas(Number(e.target.value))}
              inputProps={{ min: 1, max: 10 }}
              sx={{ mt: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScaleDialogOpen(false)}>취소</Button>
          <Button onClick={handleScaleApply} variant="contained">적용</Button>
        </DialogActions>
      </Dialog>

      {/* 스낵바 알림 */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
      />
    </Box>
  );
};

export default TenantDashboard;
