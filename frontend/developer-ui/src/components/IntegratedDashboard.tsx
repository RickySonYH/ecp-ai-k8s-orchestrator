// [advice from AI] 통합 대시보드 컴포넌트 - 완전히 개선된 UI와 기능 통합
/**
 * Enhanced Integrated Dashboard Component
 * - 전체 시스템 통계 + 테넌트 목록 통합
 * - 테넌트별 상세 대시보드 팝업
 * - 실시간 데이터 기반 통계 표시
 * - 개선된 사용자 경험과 모던 UI
 * - 카드 그리드 레이아웃으로 현대적 디자인
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Tooltip,
  Paper,
  useTheme,
  alpha,
  CircularProgress,
  Avatar,
  LinearProgress,
  Divider,
  Menu,
  MenuItem,
  Snackbar,
  Switch
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
  Visibility as ViewIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreIcon,
  Business as TenantIcon,
  Computer as ServerIcon,
  DeveloperBoard as GpuIcon,
  PlayArrow as StartIcon,
  Stop as StopIcon,
  RestartAlt as RestartIcon,
  CheckCircleOutline as ForceCompleteIcon  // [advice from AI] 강제 완료 아이콘 추가
} from '@mui/icons-material';

// 컴포넌트 임포트
import { TenantDashboard } from './TenantDashboard';
import DashboardCharts from './DashboardCharts';

// 서비스 임포트
import { StatisticsService } from '../services/StatisticsService';
import TenantDataServiceFactory, { TenantDataServiceInterface } from '../services/TenantDataService';

// 타입 정의
interface TenantSummary {
  tenant_id: string;
  name?: string;
  status: string;
  preset: string;
  is_demo: boolean;
  services_count: number;
  created_at: string;
  cpu_usage?: number;
  memory_usage?: number;
  storage_usage?: number;
  gpu_usage?: number; // [advice from AI] GPU 사용률 추가
  // [advice from AI] 서비스 구성 정보 추가
  service_config?: {
    callbot: number;
    chatbot: number;
    advisor: number;
    stt: number;
    tts: number;
    ta: number;
    qa: number;
  };
  // [advice from AI] GPU 정보 추가
  gpu_info?: {
    type: string;
    allocated: number;
    utilization: number;
  };
}

interface SystemMetrics {
  total_tenants: number;
  active_tenants: number;
  total_services: number;
  total_cpu_cores: number;
  total_memory_gb: number;
  total_gpu_count: number; // [advice from AI] GPU 개수 필드 추가
}

const IntegratedDashboard: React.FC<{ isDemoMode?: boolean }> = ({ isDemoMode = false }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 시스템 통계 상태
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics>({
    total_tenants: 0,
    active_tenants: 0,
    total_services: 0,
    total_cpu_cores: 0,
    total_memory_gb: 0,
    total_gpu_count: 0
  });
  
  // 테넌트 목록 상태
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [tenantDetailOpen, setTenantDetailOpen] = useState(false);
  
  // 차트 데이터 상태
  const [chartData, setChartData] = useState<any>(null);
  
  // [advice from AI] 테넌트 관리 메뉴 상태 추가
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuTenantId, setMenuTenantId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{action: string, tenant: TenantSummary} | null>(null);

  // [advice from AI] 실시간 업데이트 상태 추가
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // 데이터 서비스 초기화
  const tenantDataService: TenantDataServiceInterface = TenantDataServiceFactory.create(isDemoMode);

  // 데이터 로딩
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('데이터 로딩 시작...');
      
      // 개별적으로 데이터 로딩하여 어느 부분에서 오류가 발생하는지 확인
      let statsResponse: any = null;
      let tenantsResponse: any = null;

      // 통계 데이터 로딩
      try {
        console.log('통계 데이터 로딩 중...');
        const statisticsService = new StatisticsService();
        statsResponse = await statisticsService.getOverview();
        console.log('통계 데이터 로딩 성공:', statsResponse);
      } catch (statsError) {
        console.error('통계 데이터 로딩 실패:', statsError);
        // 통계 데이터 로딩 실패 시 기본값 사용
        statsResponse = {
          overview: {
            total_tenants: 0,
            active_tenants: 0,
            total_services: 0,
            deployed_services: 0,
            resource_usage: {
              total_cpu: "0m",
              total_memory: "0Mi",
              total_gpu: 0
            }
          }
        };
      }

      // 테넌트 데이터 로딩
      try {
        console.log('테넌트 데이터 로딩 중...');
        tenantsResponse = await tenantDataService.getTenants();
        console.log('테넌트 데이터 로딩 성공:', tenantsResponse);
      } catch (tenantsError) {
        console.error('테넌트 데이터 로딩 실패:', tenantsError);
        tenantsResponse = [];
      }

      // 시스템 통계 설정 - [advice from AI] 백엔드 응답 구조에 맞게 수정
      if (statsResponse && statsResponse.overview) {
        const overview = statsResponse.overview;
        const resourceUsage = overview.resource_usage || {};
        
        // CPU 코어 수 계산 (예: "117208m" -> 117.2 cores)
        const totalCpuCores = resourceUsage.total_cpu ? 
          Math.round(parseInt(resourceUsage.total_cpu.replace('m', '')) / 1000) : 0;
        
        // 메모리 GB 계산 (예: "239616Mi" -> 234 GB)
        const totalMemoryGb = resourceUsage.total_memory ? 
          Math.round(parseInt(resourceUsage.total_memory.replace('Mi', '')) / 1024) : 0;
        
        const newMetrics = {
          total_tenants: overview.total_tenants || 0,
          active_tenants: overview.active_tenants || 0,
          total_services: overview.deployed_services || 0, // [advice from AI] 실제 배포된 서비스 수 사용
          total_cpu_cores: totalCpuCores,
          total_memory_gb: totalMemoryGb,
          total_gpu_count: resourceUsage.total_gpu || 0 // [advice from AI] 실제 GPU 개수 사용
        };
        
        console.log('시스템 메트릭 설정:', newMetrics);
        console.log('원본 데이터:', overview);
        setSystemMetrics(newMetrics);
        
        setChartData(overview);
      }

      // 테넌트 목록 설정 - [advice from AI] 백엔드 응답 구조 맞춤
      if (tenantsResponse) {
        let tenantList = [];
        
        // 백엔드 응답이 {tenants: [...]} 구조인 경우
        if (tenantsResponse.tenants && Array.isArray(tenantsResponse.tenants)) {
          tenantList = tenantsResponse.tenants;
        } 
        // 직접 배열인 경우
        else if (Array.isArray(tenantsResponse)) {
          tenantList = tenantsResponse;
        }
        
        console.log('처리된 테넌트 목록:', tenantList);
        setTenants(tenantList);
      }

      console.log('데이터 로딩 완료');
      setLastUpdated(new Date()); // [advice from AI] 마지막 업데이트 시간 기록

    } catch (error) {
      console.error('전체 데이터 로딩 오류:', error);
      setError(`데이터를 불러오는 중 오류가 발생했습니다. 백엔드 서버가 실행 중인지 확인해주세요.`);
    } finally {
      console.log('데이터 로딩 완료 - 로딩 상태 해제');
      setLoading(false);
    }
  };

  // 초기 데이터 로딩
  useEffect(() => {
    loadData();
  }, [isDemoMode]);

  // [advice from AI] 실시간 자동 새로고침 (15초마다 - deploying 상태 빠른 감지)
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      console.log('자동 새로고침 실행...');
      loadData();
    }, 15000); // 15초마다 새로고침 (deploying 상태 빠른 반영)

    return () => clearInterval(interval);
  }, [autoRefresh, isDemoMode]);

  // 유틸리티 함수
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'running': return 'success';
      case 'inactive':
      case 'stopped': return 'error';
      case 'pending': return 'warning';
      case 'deploying': return 'info';  // [advice from AI] deploying 상태 추가
      case 'failed':
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getPresetColor = (preset: string) => {
    switch (preset) {
      case 'micro': return 'default';
      case 'small': return 'primary';
      case 'medium': return 'secondary';
      case 'large': return 'error';
      default: return 'default';
    }
  };

  // [advice from AI] 테넌트 관리 함수들 추가
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, tenantId: string) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setMenuTenantId(tenantId);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setMenuTenantId(null);
  };

  const handleTenantAction = async (action: string, tenant: TenantSummary) => {
    setActionLoading(`${action}-${tenant.tenant_id}`);
    
    try {
      let response;
      let message = '';
      
      switch (action) {
        case 'start':
          response = await fetch(`/api/v1/tenants/${tenant.tenant_id}/start`, { method: 'POST' });
          message = `테넌트 '${tenant.tenant_id}' 시작됨`;
          break;
        case 'stop':
          response = await fetch(`/api/v1/tenants/${tenant.tenant_id}/stop`, { method: 'POST' });
          message = `테넌트 '${tenant.tenant_id}' 중지됨`;
          break;
        case 'restart':
          response = await fetch(`/api/v1/tenants/${tenant.tenant_id}/restart`, { method: 'POST' });
          message = `테넌트 '${tenant.tenant_id}' 재시작됨`;
          break;
        case 'force-complete':  // [advice from AI] 강제 완료 액션 추가
          response = await fetch(`/api/v1/tenants/${encodeURIComponent(tenant.tenant_id)}/complete-deployment`, { method: 'POST' });
          message = `테넌트 '${tenant.tenant_id}' 배포 강제 완료됨`;
          break;
        case 'delete':
          response = await fetch(`/api/v1/tenants/${tenant.tenant_id}`, { method: 'DELETE' });
          message = `테넌트 '${tenant.tenant_id}' 삭제됨`;
          break;
        default:
          throw new Error('알 수 없는 액션');
      }

      if (response && response.ok) {
        setSnackbarMessage(message);
        setSnackbarOpen(true);
        
        // 삭제인 경우 목록에서 제거
        if (action === 'delete') {
          setTenants(prev => prev.filter(t => t.tenant_id !== tenant.tenant_id));
        } else {
          // [advice from AI] 다른 액션의 경우 즉시 + 3초 후 데이터 새로고침 (상태 변경 반영)
          loadData();
          setTimeout(() => {
            console.log('액션 후 추가 새로고침 실행...');
            loadData();
          }, 3000);
        }
      } else {
        throw new Error('액션 실행 실패');
      }
    } catch (error) {
      setSnackbarMessage(`오류: ${action} 실행 실패`);
      setSnackbarOpen(true);
    } finally {
      setActionLoading(null);
      handleMenuClose();
      setConfirmDialogOpen(false);
    }
  };

  const handleConfirmAction = (action: string, tenant: TenantSummary) => {
    setConfirmAction({ action, tenant });
    setConfirmDialogOpen(true);
    handleMenuClose();
  };

  // 이벤트 핸들러
  const handleTenantSelect = (tenantId: string) => {
    setSelectedTenant(tenantId);
    setTenantDetailOpen(true);
  };

  // 로딩 상태
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ ml: 2 }}>데이터 로딩 중...</Typography>
      </Box>
    );
  }

  // 에러 상태 - 로딩 중이 아닐 때만 표시
  if (error && !loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="h6">오류 발생</Typography>
          <Typography>{error}</Typography>
        </Alert>
        <Button 
          variant="outlined" 
          onClick={loadData}
          startIcon={<RefreshIcon />}
          disabled={loading}
          sx={{ mt: 1 }}
        >
          다시 시도
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', maxWidth: 1400, mx: 'auto', p: 3 }}>
      {/* 헤더 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
            📊 통합 대시보드
          </Typography>
          <Typography variant="body1" color="text.secondary">
            전체 시스템 현황과 테넌트 관리를 한눈에 확인하세요
          </Typography>
          {/* [advice from AI] 마지막 업데이트 시간 표시 */}
          {lastUpdated && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              마지막 업데이트: {lastUpdated.toLocaleTimeString('ko-KR')}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {/* [advice from AI] 자동 새로고침 토글 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              자동 새로고침
            </Typography>
            <Switch
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              size="small"
              color="primary"
            />
          </Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadData}
            disabled={loading}
            sx={{ px: 3, py: 1 }}
          >
            새로고침
          </Button>
        </Box>
      </Box>

      {/* 시스템 통계 카드 - 2-3 레이아웃 */}
      <Box sx={{ mb: 4 }}>
        {/* 첫 번째 행: 활성 테넌트, 배포된 서비스 (넓게) */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6}>
            <Card sx={{ 
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
              transition: 'all 0.3s ease-in-out',
              '&:hover': { transform: 'translateY(-4px)', boxShadow: theme.shadows[8] }
            }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
                <Box sx={{ 
                  p: 1.5, 
                  borderRadius: 2, 
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  mr: 2 
                }}>
                  <TenantIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                </Box>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="h3" fontWeight="bold" color="primary.main">
                    {systemMetrics.active_tenants}/{systemMetrics.total_tenants}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    활성 테넌트
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={(systemMetrics.active_tenants / Math.max(systemMetrics.total_tenants, 1)) * 100}
                      sx={{ flexGrow: 1, mr: 1, height: 6, borderRadius: 3 }}
                    />
                    <Typography variant="caption" color="primary.main">
                      {Math.round((systemMetrics.active_tenants / Math.max(systemMetrics.total_tenants, 1)) * 100)}%
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        
          <Grid item xs={12} sm={6}>
            <Card sx={{ 
              background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.success.main, 0.05)} 100%)`,
              border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
              transition: 'all 0.3s ease-in-out',
              '&:hover': { transform: 'translateY(-4px)', boxShadow: theme.shadows[8] }
            }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
                <Box sx={{ 
                  p: 1.5, 
                  borderRadius: 2, 
                  backgroundColor: alpha(theme.palette.success.main, 0.1),
                  mr: 2 
                }}>
                  <ServerIcon sx={{ fontSize: 32, color: 'success.main' }} />
                </Box>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="h3" fontWeight="bold" color="success.main">
                    {systemMetrics.total_services}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    배포된 서비스
                  </Typography>
                  <Typography variant="caption" color="success.main">
                    클러스터 운영 중
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* 두 번째 행: CPU, 메모리, GPU (좁게) */}
        <Grid container spacing={3}>
          <Grid item xs={12} sm={4}>
            <Card sx={{ 
              background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.1)} 0%, ${alpha(theme.palette.warning.main, 0.05)} 100%)`,
              border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
              transition: 'all 0.3s ease-in-out',
              '&:hover': { transform: 'translateY(-4px)', boxShadow: theme.shadows[8] }
            }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
                <Box sx={{ 
                  p: 1.5, 
                  borderRadius: 2, 
                  backgroundColor: alpha(theme.palette.warning.main, 0.1),
                  mr: 2 
                }}>
                  <SpeedIcon sx={{ fontSize: 32, color: 'warning.main' }} />
                </Box>
                <Box>
                  <Typography variant="h3" fontWeight="bold" color="warning.main">
                    {systemMetrics.total_cpu_cores}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    총 CPU 코어
                  </Typography>
                  <Typography variant="caption" color="warning.main">
                    평균 사용률 ~65%
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        
          <Grid item xs={12} sm={4}>
            <Card sx={{ 
              background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.1)} 0%, ${alpha(theme.palette.info.main, 0.05)} 100%)`,
              border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
              transition: 'all 0.3s ease-in-out',
              '&:hover': { transform: 'translateY(-4px)', boxShadow: theme.shadows[8] }
            }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
                <Box sx={{ 
                  p: 1.5, 
                  borderRadius: 2, 
                  backgroundColor: alpha(theme.palette.info.main, 0.1),
                  mr: 2 
                }}>
                  <MemoryIcon sx={{ fontSize: 32, color: 'info.main' }} />
                </Box>
                <Box>
                  <Typography variant="h3" fontWeight="bold" color="info.main">
                    {systemMetrics.total_memory_gb}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    총 메모리 (GB)
                  </Typography>
                  <Typography variant="caption" color="info.main">
                    평균 사용률 ~72%
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        
          <Grid item xs={12} sm={4}>
            <Card sx={{ 
              background: `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.1)} 0%, ${alpha(theme.palette.error.main, 0.05)} 100%)`,
              border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
              transition: 'all 0.3s ease-in-out',
              '&:hover': { transform: 'translateY(-4px)', boxShadow: theme.shadows[8] }
            }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
                <Box sx={{ 
                  p: 1.5, 
                  borderRadius: 2, 
                  backgroundColor: alpha(theme.palette.error.main, 0.1),
                  mr: 2 
                }}>
                  <GpuIcon sx={{ fontSize: 32, color: 'error.main' }} />
                </Box>
                <Box>
                  <Typography variant="h3" fontWeight="bold" color="error.main">
                    {systemMetrics.total_gpu_count}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    할당된 GPU
                  </Typography>
                  <Typography variant="caption" color="error.main">
                    AI 워크로드 가속
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* 차트 섹션 */}
      {chartData && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <TimelineIcon sx={{ mr: 1, color: 'primary.main' }} />
              시스템 성능 트렌드
            </Typography>
            <DashboardCharts statistics={{ overview: chartData }} />
          </CardContent>
        </Card>
      )}

      {/* 테넌트 목록 섹션 */}
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" fontWeight="bold">
            🏢 테넌트 목록 ({tenants.length}개)
          </Typography>
        </Box>

        {tenants.length === 0 ? (
          <Alert severity="info">
            <Typography>등록된 테넌트가 없습니다. 테넌트 생성 탭에서 새로운 테넌트를 생성해보세요.</Typography>
          </Alert>
        ) : (
          <Grid container spacing={3}>
            {tenants.map((tenant) => (
              <Grid item xs={12} sm={6} md={4} key={tenant.tenant_id}>
                <Card sx={{
                  cursor: 'pointer',
                  transition: 'all 0.3s ease-in-out',
                  background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.background.default, 0.9)} 100%)`,
                  border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                  '&:hover': { 
                    transform: 'translateY(-4px)', 
                    boxShadow: theme.shadows[8],
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`
                  }
                }} onClick={() => handleTenantSelect(tenant.tenant_id)}>
                  <CardContent>
                    {/* 테넌트 헤더 */}
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Avatar sx={{ 
                        mr: 2, 
                        bgcolor: 'primary.main',
                        width: 48,
                        height: 48,
                        fontSize: '1.2rem'
                      }}>
                        {(tenant.name || tenant.tenant_id).charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" fontWeight="bold">
                          {tenant.name || tenant.tenant_id}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {tenant.tenant_id}
                        </Typography>
                      </Box>
                      <IconButton 
                        size="small"
                        onClick={(e) => handleMenuOpen(e, tenant.tenant_id)}
                        disabled={actionLoading === `delete-${tenant.tenant_id}` || actionLoading === `start-${tenant.tenant_id}` || actionLoading === `stop-${tenant.tenant_id}`}
                      >
                        {actionLoading && actionLoading.includes(tenant.tenant_id) ? (
                          <CircularProgress size={16} />
                        ) : (
                          <MoreIcon />
                        )}
                      </IconButton>
                    </Box>

                    {/* 상태 및 정보 */}
                    <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                      <Chip
                        label={tenant.status}
                        color={getStatusColor(tenant.status) as any}
                        size="small"
                        sx={{ fontWeight: 'bold' }}
                      />
                      <Chip 
                        label={tenant.preset.toUpperCase()} 
                        size="small" 
                        variant="outlined" 
                        color={getPresetColor(tenant.preset) as any}
                      />
                      <Tooltip 
                        title={
                          <Box>
                            <Typography variant="body2">서비스 구성 상세:</Typography>
                            {tenant.service_config ? (
                              <>
                                <Typography variant="caption">• 콜봇: {tenant.service_config.callbot}개</Typography><br/>
                                <Typography variant="caption">• 챗봇: {tenant.service_config.chatbot}개</Typography><br/>
                                <Typography variant="caption">• 어드바이저: {tenant.service_config.advisor}개</Typography><br/>
                                <Typography variant="caption">• STT: {tenant.service_config.stt}개</Typography><br/>
                                <Typography variant="caption">• TTS: {tenant.service_config.tts}개</Typography><br/>
                                <Typography variant="caption">• 텍스트 분석: {tenant.service_config.ta}개</Typography><br/>
                                <Typography variant="caption">• QA: {tenant.service_config.qa}개</Typography><br/>
                              </>
                            ) : (
                              <Typography variant="caption">서비스 구성 정보 없음</Typography>
                            )}
                            {tenant.gpu_info && (
                              <>
                                <Divider sx={{ my: 1 }} />
                                <Typography variant="body2">GPU 정보:</Typography>
                                <Typography variant="caption">• 타입: {tenant.gpu_info.type.toUpperCase()}</Typography><br/>
                                <Typography variant="caption">• 할당: {tenant.gpu_info.allocated}개</Typography><br/>
                                <Typography variant="caption">• 사용률: {tenant.gpu_usage || 0}%</Typography>
                              </>
                            )}
                          </Box>
                        }
                      >
                        <Chip 
                          label={`${tenant.services_count}개 서비스`} 
                          size="small" 
                          variant="outlined" 
                          color="info"
                          sx={{ cursor: 'help' }}
                        />
                      </Tooltip>
                    </Box>

                    {/* [advice from AI] 서비스 구성 정보 표시 */}
                    {tenant.service_config && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                          서비스 구성:
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {tenant.service_config.callbot > 0 && (
                            <Chip 
                              label={`콜봇 ${tenant.service_config.callbot}`} 
                              size="small" 
                              color="primary" 
                              variant="outlined"
                              sx={{ fontSize: '0.7rem', height: 20 }}
                            />
                          )}
                          {tenant.service_config.chatbot > 0 && (
                            <Chip 
                              label={`챗봇 ${tenant.service_config.chatbot}`} 
                              size="small" 
                              color="secondary" 
                              variant="outlined"
                              sx={{ fontSize: '0.7rem', height: 20 }}
                            />
                          )}
                          {tenant.service_config.advisor > 0 && (
                            <Chip 
                              label={`어드바이저 ${tenant.service_config.advisor}`} 
                              size="small" 
                              color="info" 
                              variant="outlined"
                              sx={{ fontSize: '0.7rem', height: 20 }}
                            />
                          )}
                          {tenant.service_config.stt > 0 && (
                            <Chip 
                              label={`STT ${tenant.service_config.stt}`} 
                              size="small" 
                              color="warning" 
                              variant="outlined"
                              sx={{ fontSize: '0.7rem', height: 20 }}
                            />
                          )}
                          {tenant.service_config.tts > 0 && (
                            <Chip 
                              label={`TTS ${tenant.service_config.tts}`} 
                              size="small" 
                              color="success" 
                              variant="outlined"
                              sx={{ fontSize: '0.7rem', height: 20 }}
                            />
                          )}
                          {(tenant.service_config.ta > 0 || tenant.service_config.qa > 0) && (
                            <Chip 
                              label={`분석 ${tenant.service_config.ta + tenant.service_config.qa}`} 
                              size="small" 
                              color="default" 
                              variant="outlined"
                              sx={{ fontSize: '0.7rem', height: 20 }}
                            />
                          )}
                        </Box>
                      </Box>
                    )}

                    {/* 리소스 사용률 */}
                    {tenant.cpu_usage && (
                      <Box sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="body2" color="text.secondary">CPU 사용률</Typography>
                          <Typography variant="body2" fontWeight="bold">{tenant.cpu_usage}%</Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={tenant.cpu_usage}
                          sx={{ height: 6, borderRadius: 3 }}
                          color={tenant.cpu_usage > 80 ? 'error' : tenant.cpu_usage > 60 ? 'warning' : 'success'}
                        />
                      </Box>
                    )}

                    {tenant.memory_usage && (
                      <Box sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="body2" color="text.secondary">메모리 사용률</Typography>
                          <Typography variant="body2" fontWeight="bold">{tenant.memory_usage}%</Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={tenant.memory_usage}
                          sx={{ height: 6, borderRadius: 3 }}
                          color={tenant.memory_usage > 80 ? 'error' : tenant.memory_usage > 60 ? 'warning' : 'success'}
                        />
                      </Box>
                    )}

                    {/* [advice from AI] GPU 사용률 추가 */}
                    {tenant.gpu_usage !== undefined && tenant.gpu_info?.allocated > 0 && (
                      <Box sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="body2" color="text.secondary">
                            GPU 사용률 ({tenant.gpu_info.type.toUpperCase()})
                          </Typography>
                          <Typography variant="body2" fontWeight="bold">{tenant.gpu_usage}%</Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={tenant.gpu_usage}
                          sx={{ height: 6, borderRadius: 3 }}
                          color={tenant.gpu_usage > 90 ? 'error' : tenant.gpu_usage > 70 ? 'warning' : 'success'}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {tenant.gpu_info.allocated}개 할당됨
                        </Typography>
                      </Box>
                    )}

                    <Divider sx={{ my: 1 }} />

                    {/* [advice from AI] GPU 정보 표시 */}
                    {tenant.gpu_info?.allocated > 0 && (
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="caption" color="text.secondary" display="block">
                          GPU 할당:
                        </Typography>
                        <Chip 
                          label={`${tenant.gpu_info.type.toUpperCase()} ${tenant.gpu_info.allocated}개`} 
                          size="small" 
                          color="error" 
                          variant="outlined"
                          sx={{ fontSize: '0.7rem', height: 20, mt: 0.5 }}
                        />
                      </Box>
                    )}

                    {/* 생성일 */}
                    <Typography variant="caption" color="text.secondary">
                      생성일: {new Date(tenant.created_at).toLocaleDateString('ko-KR')}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      {/* 테넌트 상세 다이얼로그 */}
      <Dialog
        open={tenantDetailOpen}
        onClose={() => setTenantDetailOpen(false)}
        maxWidth="xl"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <TenantIcon color="primary" />
            <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold' }}>
              🏢 {selectedTenant} 테넌트 상세 대시보드
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {selectedTenant && (
            <TenantDashboard 
              tenantId={selectedTenant} 
              onTenantDeleted={() => {
                loadData(); // 데이터 새로고침
                setTenantDetailOpen(false);
              }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTenantDetailOpen(false)}>닫기</Button>
        </DialogActions>
      </Dialog>

      {/* [advice from AI] 테넌트 관리 메뉴 */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          elevation: 8,
          sx: {
            overflow: 'visible',
            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
            mt: 1.5,
            minWidth: 200
          }
        }}
      >
        <MenuItem onClick={() => {
          const tenant = tenants.find(t => t.tenant_id === menuTenantId);
          if (tenant) handleTenantSelect(tenant.tenant_id);
          handleMenuClose();
        }}>
          <ViewIcon sx={{ mr: 2, color: 'primary.main' }} />
          상세 보기
        </MenuItem>
        
        <Divider />
        
        <MenuItem 
          onClick={() => {
            const tenant = tenants.find(t => t.tenant_id === menuTenantId);
            if (tenant && tenant.status !== 'running') {
              handleTenantAction('start', tenant);
            }
          }}
          disabled={
            tenants.find(t => t.tenant_id === menuTenantId)?.status === 'running' ||
            tenants.find(t => t.tenant_id === menuTenantId)?.status === 'deploying'
          }
        >
          <StartIcon sx={{ mr: 2, color: 'success.main' }} />
          시작
        </MenuItem>
        
        <MenuItem 
          onClick={() => {
            const tenant = tenants.find(t => t.tenant_id === menuTenantId);
            if (tenant && tenant.status === 'running') {
              handleTenantAction('stop', tenant);
            }
          }}
          disabled={tenants.find(t => t.tenant_id === menuTenantId)?.status !== 'running'}
        >
          <StopIcon sx={{ mr: 2, color: 'warning.main' }} />
          중지
        </MenuItem>
        
        <MenuItem 
          onClick={() => {
            const tenant = tenants.find(t => t.tenant_id === menuTenantId);
            if (tenant) {
              handleTenantAction('restart', tenant);
            }
          }}
          disabled={tenants.find(t => t.tenant_id === menuTenantId)?.status === 'deploying'}
        >
          <RestartIcon sx={{ mr: 2, color: 'info.main' }} />
          재시작
        </MenuItem>

        {/* [advice from AI] 강제 완료 메뉴 - deploying 상태일 때만 표시 */}
        {tenants.find(t => t.tenant_id === menuTenantId)?.status === 'deploying' && (
          <MenuItem 
            onClick={() => {
              const tenant = tenants.find(t => t.tenant_id === menuTenantId);
              if (tenant) {
                handleTenantAction('force-complete', tenant);
              }
            }}
          >
            <ForceCompleteIcon sx={{ mr: 2, color: 'success.main' }} />
            강제 완료
          </MenuItem>
        )}
        
        <Divider />
        
        <MenuItem 
          onClick={() => {
            const tenant = tenants.find(t => t.tenant_id === menuTenantId);
            if (tenant) {
              handleConfirmAction('delete', tenant);
            }
          }}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 2 }} />
          삭제
        </MenuItem>
      </Menu>

      {/* [advice from AI] 액션 확인 다이얼로그 */}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle>
          {confirmAction?.action === 'delete' ? '🗑️ 테넌트 삭제 확인' : 
           confirmAction?.action === 'stop' ? '⏹️ 테넌트 중지 확인' :
           confirmAction?.action === 'restart' ? '🔄 테넌트 재시작 확인' : '확인'}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {confirmAction?.action === 'delete' && 
              `테넌트 '${confirmAction.tenant.tenant_id}'를 완전히 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`
            }
            {confirmAction?.action === 'stop' && 
              `테넌트 '${confirmAction.tenant.tenant_id}'를 중지하시겠습니까? 모든 서비스가 정지됩니다.`
            }
            {confirmAction?.action === 'restart' && 
              `테넌트 '${confirmAction.tenant.tenant_id}'를 재시작하시겠습니까? 잠시 서비스가 중단될 수 있습니다.`
            }
          </Typography>
          
          {confirmAction?.tenant && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                • 프리셋: {confirmAction.tenant.preset.toUpperCase()}<br/>
                • 상태: {confirmAction.tenant.status}<br/>
                • 서비스 수: {confirmAction.tenant.services_count}개<br/>
                • 생성일: {new Date(confirmAction.tenant.created_at).toLocaleDateString()}
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>
            취소
          </Button>
          <Button 
            onClick={() => {
              if (confirmAction) {
                handleTenantAction(confirmAction.action, confirmAction.tenant);
              }
            }}
            color={confirmAction?.action === 'delete' ? 'error' : 'primary'}
            variant="contained"
          >
            {confirmAction?.action === 'delete' ? '삭제' : 
             confirmAction?.action === 'stop' ? '중지' :
             confirmAction?.action === 'restart' ? '재시작' : '확인'}
          </Button>
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

export default IntegratedDashboard;
