// [advice from AI] 대시보드 컴포넌트 - 실제 데이터 기반 통계 표시
/**
 * Dashboard Component
 * - 실제 API 데이터 기반 통계 표시
 * - 하드코딩 제거, 실시간 데이터만 사용
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
  CircularProgress,
  Alert
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
  Monitor as MonitoringIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
// [advice from AI] 임시 주석 처리 - 빠른 개발을 위해
// import { statisticsService, StatisticsOverview, ImageStatistics, ServiceStatistics, TenantStatistics, ResourceStatistics } from '../services/StatisticsService';
// import DashboardCharts from './DashboardCharts';

// [advice from AI] 실제 데이터 기반 인터페이스
interface DashboardData {
  overview: StatisticsOverview | null;
  images: ImageStatistics | null;
  services: ServiceStatistics | null;
  tenants: TenantStatistics | null;
  resources: ResourceStatistics | null;
  loading: boolean;
  error: string | null;
}

const StyledCard = styled(Card)(({ theme }) => ({
  height: '100%',
  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
  transition: 'all 0.3s ease-in-out',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[8],
    border: `1px solid ${alpha(theme.palette.primary.main, 0.4)}`,
  },
}));

const MetricCard = styled(Card)(({ theme }) => ({
  background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.info.main, 0.1)} 100%)`,
  border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
  transition: 'all 0.3s ease-in-out',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[4],
  },
}));

const Dashboard: React.FC = () => {
  const theme = useTheme();
  const [data, setData] = useState<DashboardData>({
    overview: null,
    images: null,
    services: null,
    tenants: null,
    resources: null,
    loading: true,
    error: null
  });

  // [advice from AI] 실제 API 데이터 로드
  const loadData = async () => {
    try {
      setData(prev => ({ ...prev, loading: true, error: null }));
      
      const allStats = await statisticsService.getAllStatistics();
      
      setData({
        overview: allStats.overview,
        images: allStats.images,
        services: allStats.services,
        tenants: allStats.tenants,
        resources: allStats.resources,
        loading: false,
        error: null
      });
    } catch (error) {
      console.error('대시보드 데이터 로드 실패:', error);
      setData(prev => ({
        ...prev,
        loading: false,
        error: '데이터를 불러오는데 실패했습니다.'
      }));
    }
  };

  useEffect(() => {
    loadData();
    
    // 5분마다 자동 새로고침
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // [advice from AI] 로딩 상태 표시
  if (data.loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ ml: 2 }}>
          실제 데이터를 불러오는 중...
        </Typography>
      </Box>
    );
  }

  // [advice from AI] 에러 상태 표시
  if (data.error) {
    return (
      <Box p={3}>
        <Alert severity="error" action={
          <IconButton color="inherit" size="small" onClick={loadData}>
            <RefreshIcon />
          </IconButton>
        }>
          {data.error}
        </Alert>
      </Box>
    );
  }

  // [advice from AI] 데이터가 없는 경우
  if (!data.overview) {
    return (
      <Box p={3}>
        <Alert severity="info">
          현재 활성 테넌시가 없습니다. 새로운 테넌시를 생성해보세요.
        </Alert>
      </Box>
    );
  }

  const { overview, images, services, tenants, resources } = data;

  return (
    <Box sx={{ p: 3 }}>
      {/* 헤더 */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
          📊 ECP-AI 실시간 대시보드
        </Typography>
        <IconButton onClick={loadData} sx={{ color: theme.palette.primary.main }}>
          <RefreshIcon />
        </IconButton>
      </Box>

      {/* 주요 지표 카드 */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Avatar sx={{ bgcolor: theme.palette.primary.main, mr: 2 }}>
                  <CloudIcon />
                </Avatar>
                <Typography variant="h6" color="textSecondary">
                  총 테넌시
                </Typography>
              </Box>
              <Typography variant="h3" component="div" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
                {overview?.total_tenants || 0}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                활성: {overview?.active_tenants || 0}개
              </Typography>
            </CardContent>
          </MetricCard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MetricCard>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Avatar sx={{ bgcolor: theme.palette.success.main, mr: 2 }}>
                  <BuildIcon />
                </Avatar>
                <Typography variant="h6" color="textSecondary">
                  총 서비스
                </Typography>
              </Box>
              <Typography variant="h3" component="div" sx={{ fontWeight: 'bold', color: theme.palette.success.main }}>
                {overview?.total_services || 0}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                배포됨: {overview?.deployed_services || 0}개
              </Typography>
            </CardContent>
          </MetricCard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MetricCard>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Avatar sx={{ bgcolor: theme.palette.info.main, mr: 2 }}>
                  <StorageIcon />
                </Avatar>
                <Typography variant="h6" color="textSecondary">
                  이미지
                </Typography>
              </Box>
              <Typography variant="h3" component="div" sx={{ fontWeight: 'bold', color: theme.palette.info.main }}>
                {images?.total_images || 0}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                크기: {images ? Math.round(images.total_size_mb / 1024) : 0}GB
              </Typography>
            </CardContent>
          </MetricCard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MetricCard>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Avatar sx={{ bgcolor: theme.palette.warning.main, mr: 2 }}>
                  <MemoryIcon />
                </Avatar>
                <Typography variant="h6" color="textSecondary">
                  리소스 사용량
                </Typography>
              </Box>
              <Typography variant="h3" component="div" sx={{ fontWeight: 'bold', color: theme.palette.warning.main }}>
                {overview?.resource_usage.total_gpu || 0}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                GPU / {overview?.resource_usage.total_cpu || '0m'} CPU
              </Typography>
            </CardContent>
          </MetricCard>
        </Grid>
      </Grid>

      {/* 상세 통계 */}
      <Grid container spacing={3}>
        {/* 테넌시 분포 */}
        <Grid item xs={12} md={6}>
          <StyledCard>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                🏢 테넌시 분포
              </Typography>
              <Box mt={2}>
                {overview?.tenants_by_preset.map((preset) => (
                  <Box key={preset.preset} display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Chip 
                      label={preset.preset.toUpperCase()} 
                      size="small"
                      color={preset.preset === 'large' ? 'error' : preset.preset === 'medium' ? 'warning' : 'success'}
                    />
                    <Typography variant="body2">
                      {preset.count}개
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </StyledCard>
        </Grid>

        {/* 이미지 타입별 분포 */}
        <Grid item xs={12} md={6}>
          <StyledCard>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                🖼️ 이미지 타입별 분포
              </Typography>
              <Box mt={2}>
                {images && Object.entries(images.by_type).map(([type, stats]) => (
                  <Box key={type} display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Chip 
                      label={type.toUpperCase()} 
                      size="small"
                      color={type === 'gpu' ? 'error' : type === 'application' ? 'primary' : 'default'}
                    />
                    <Typography variant="body2">
                      {stats.count}개 ({Math.round(stats.total_size_mb / 1024)}GB)
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </StyledCard>
        </Grid>

        {/* 서비스 배포 현황 */}
        <Grid item xs={12}>
          <StyledCard>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                🔧 서비스 배포 현황 (CICD 기준)
              </Typography>
              <Grid container spacing={2} mt={2}>
                {services && Object.entries(services.service_details)
                  .filter(([_, stats]) => stats.deployed > 0)
                  .map(([service, stats]) => (
                    <Grid item xs={12} sm={6} md={4} key={service}>
                      <Paper sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="subtitle2" color="primary" gutterBottom>
                          {service.toUpperCase()}
                        </Typography>
                        <Typography variant="h6" color="success.main">
                          {stats.deployed}개 배포
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          {stats.tenants}개 테넌시에서 사용
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                {services && Object.values(services.service_details).every(stats => stats.deployed === 0) && (
                  <Grid item xs={12}>
                    <Alert severity="info">
                      현재 배포된 서비스가 없습니다.
                    </Alert>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </StyledCard>
        </Grid>
      </Grid>

      {/* 차트 섹션 */}
      {data.overview && data.images && data.services && data.tenants && data.resources && (
        <DashboardCharts data={data} />
      )}
    </Box>
  );
};

export default Dashboard;
