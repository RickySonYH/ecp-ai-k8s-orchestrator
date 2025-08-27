// [advice from AI] 통합 대시보드 컴포넌트 - DB 기반 데이터만 사용
/**
 * 통합 대시보드 컴포넌트
 * - 테넌시 목록과 대시보드를 하나로 통합
 * - DB 기반 데이터만 사용 (하드코딩 데이터 제거)
 * - 테넌시 생성, 삭제, 상세보기 기능 포함
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
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  Tabs,
  Tab
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
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Dns as ServerIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
// import ServerMonitoring from './ServerMonitoring'; // [advice from AI] 임시 비활성화

// [advice from AI] 스타일드 컴포넌트
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

// [advice from AI] 통합 대시보드 컴포넌트
export const Dashboard: React.FC<{ isDemoMode?: boolean }> = ({ isDemoMode = true }) => {
  const theme = useTheme();
  
  // [advice from AI] 상태 관리
  const [data, setData] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [showTenantDetail, setShowTenantDetail] = useState(false);
  const [currentTab, setCurrentTab] = useState(0); // [advice from AI] 탭 상태 추가
  const [serverDetails, setServerDetails] = useState<any>(null); // [advice from AI] 서버 상세 정보
  const [showServerDetails, setShowServerDetails] = useState(false); // [advice from AI] 서버 상세 다이얼로그
  
  // [advice from AI] 실시간 모니터링 상태
  const [monitoringData, setMonitoringData] = useState<any>(null);
  const [isMonitoringActive, setIsMonitoringActive] = useState(false);
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);

  // [advice from AI] 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    console.log('Dashboard useEffect 실행 - isDemoMode:', isDemoMode);
    loadData();
  }, [isDemoMode]);

  // [advice from AI] 데이터 로드 함수
  const loadData = async () => {
    setLoading(true);
    try {
      if (isDemoMode) {
        // 데모 모드: 데모 API 사용
        console.log('데모 모드 - 데모 API 호출');
        
        // 개별적으로 API 호출하여 하나라도 성공하면 처리
        let tenantsData = [];
        let systemData = { data: {} };
        
        try {
          const tenantsRes = await fetch('http://localhost:8001/api/v1/demo/tenants/');
          if (tenantsRes.ok) {
            tenantsData = await tenantsRes.json();
          }
        } catch (e) {
          console.log('데모 테넌시 API 호출 실패:', e);
        }
        
        try {
          const systemRes = await fetch('http://localhost:8001/api/v1/demo/monitoring/system/');
          if (systemRes.ok) {
            systemData = await systemRes.json();
          }
        } catch (e) {
          console.log('데모 시스템 API 호출 실패:', e);
        }
        
        // 빈 데이터라도 대시보드 구조는 생성
        const dashboardData = {
          tenants: tenantsData || [],
          resources: {
            gpu: { 
              total: systemData.data?.total_gpu || 0, 
              used: tenantsData && tenantsData.length > 0 ? (systemData.data?.total_gpu_usage || 0) : 0, 
              percentage: tenantsData && tenantsData.length > 0 ? (systemData.data?.total_gpu_usage || 0) : 0 
            },
            cpu: { 
              total: systemData.data?.total_cpu || 0, 
              used: tenantsData && tenantsData.length > 0 ? (systemData.data?.total_cpu_usage || 0) : 0, 
              percentage: tenantsData && tenantsData.length > 0 ? (systemData.data?.total_cpu_usage || 0) : 0 
            },
            memory: { 
              total: systemData.data?.total_memory || 0, 
              used: tenantsData && tenantsData.length > 0 ? (systemData.data?.total_memory_usage || 0) : 0, 
              percentage: tenantsData && tenantsData.length > 0 ? (systemData.data?.total_memory_usage || 0) : 0 
            }
          },
          activities: [] // 활동 로그는 별도 API 필요
        };
        
        setData(dashboardData);
      } else {
        // 운영 모드: 일반 API 사용
        console.log('운영 모드 - 일반 API 호출');
        
        // 개별적으로 API 호출하여 하나라도 성공하면 처리
        let tenantsData = { tenants: [] };
        let systemData = { data: {} };
        
        try {
          const tenantsRes = await fetch('http://localhost:8001/api/v1/tenants/');
          if (tenantsRes.ok) {
            tenantsData = await tenantsRes.json();
          }
        } catch (e) {
          console.log('운영 테넌시 API 호출 실패:', e);
        }
        
        try {
          const systemRes = await fetch('http://localhost:8001/api/v1/realtime/system/');
          if (systemRes.ok) {
            systemData = await systemRes.json();
          }
        } catch (e) {
          console.log('운영 시스템 API 호출 실패:', e);
        }
        
        // 빈 데이터라도 대시보드 구조는 생성
        const dashboardData = {
          tenants: tenantsData.tenants || [],
          resources: {
            gpu: { 
              total: systemData.data?.total_gpu || 0, 
              used: tenantsData.tenants && tenantsData.tenants.length > 0 ? (systemData.data?.total_gpu_usage || 0) : 0, 
              percentage: tenantsData.tenants && tenantsData.tenants.length > 0 ? (systemData.data?.total_gpu_usage || 0) : 0 
            },
            cpu: { 
              total: systemData.data?.total_cpu || 0, 
              used: tenantsData.tenants && tenantsData.tenants.length > 0 ? (systemData.data?.total_cpu_usage || 0) : 0, 
              percentage: tenantsData.tenants && tenantsData.tenants.length > 0 ? (systemData.data?.total_cpu_usage || 0) : 0 
            },
            memory: { 
              total: systemData.data?.total_memory || 0, 
              used: tenantsData.tenants && tenantsData.tenants.length > 0 ? (systemData.data?.total_memory_usage || 0) : 0, 
              percentage: tenantsData.tenants && tenantsData.tenants.length > 0 ? (systemData.data?.total_memory_usage || 0) : 0 
            }
          },
          activities: []
        };
        
        setData(dashboardData);
      }
    } catch (error) {
      console.error('데이터 로드 실패:', error);
      setData({
        tenants: [],
        resources: { gpu: { total: 0, used: 0, percentage: 0 }, cpu: { total: 0, used: 0, percentage: 0 }, memory: { total: 0, used: 0, percentage: 0 } },
        activities: []
      });
    } finally {
      setLoading(false);
    }
  };

  // [advice from AI] 테넌시 삭제 함수
  const handleDeleteTenant = async (tenantId: string) => {
    if (window.confirm('정말로 이 테넌시를 삭제하시겠습니까?')) {
      try {
        const apiUrl = isDemoMode 
          ? `http://localhost:8001/api/v1/demo/tenants/${tenantId}/`
          : `http://localhost:8001/api/v1/tenants/${tenantId}/`;
        
        const response = await fetch(apiUrl, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          console.log('테넌시 삭제 성공:', tenantId);
          loadData(); // 데이터 새로고침
        } else {
          throw new Error('테넌시 삭제에 실패했습니다.');
        }
      } catch (error) {
        console.error('테넌시 삭제 실패:', error);
        alert(`테넌시 삭제 실패: ${error.message}`);
      }
    }
  };

  // [advice from AI] 테넌시 상세보기
  const handleViewTenant = (tenant: any) => {
    setSelectedTenant(tenant);
    setShowTenantDetail(true);
  };

  // [advice from AI] 렌더링 전 데이터 상태 확인
  console.log('Dashboard 렌더링 - data:', data);
  console.log('Dashboard 렌더링 - data.tenants:', data?.tenants);
  console.log('Dashboard 렌더링 - data.tenants?.length:', data?.tenants?.length);

  // [advice from AI] 데이터가 준비되지 않았으면 로딩 표시
  if (!data || !data.tenants) {
    console.log('Dashboard - 데이터가 준비되지 않음, 로딩 표시');
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          대시보드 데이터를 불러오는 중...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* 헤더 */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
            🚀 ECP-AI 통합 대시보드
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Kubernetes Orchestrator 통합 관리 시스템
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Chip 
            icon={<RefreshIcon />} 
            label={`마지막 업데이트: ${lastUpdate.toLocaleTimeString()}`} 
            variant="outlined" 
            color="primary" 
          />
          
          <Button
            variant="outlined"
            color="primary"
            startIcon={<RefreshIcon />}
            onClick={loadData}
            size="small"
          >
            새로고침
          </Button>
        </Box>
      </Box>

      {/* [advice from AI] 탭 네비게이션 */}
      <Box sx={{ mb: 3 }}>
        <Tabs 
          value={currentTab} 
          onChange={(event, newValue) => setCurrentTab(newValue)}
          variant="standard"
          indicatorColor="primary"
        >
          <Tab 
            icon={<DashboardIcon />} 
            label="통합 대시보드" 
            iconPosition="start"
          />
          {isDemoMode && selectedTenant && (
            <Tab 
              icon={<ServerIcon />} 
              label="서버 모니터링" 
              iconPosition="start"
            />
          )}
        </Tabs>
      </Box>

      {/* [advice from AI] 탭 컨텐츠 */}
      {currentTab === 0 && (
        <>
          {/* [advice from AI] 테넌시 중심 현황 카드 - 안전한 조건부 렌더링 */}
      {data.tenants && data.tenants.length > 0 ? (
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
                  <CallIcon sx={{ fontSize: 28 }} />
                </Avatar>
                <Box>
                  <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
                    {data.tenants.reduce((total: number, tenant: any) => total + (tenant.total_channels || 0), 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    총 채널 수
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    콜봇 + 챗봇 + 어드바이저
                  </Typography>
                </Box>
              </Box>
            </MetricCard>
          </Grid>
          <Grid item xs={12} md={3}>
            <MetricCard>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'success.main', width: 56, height: 56 }}>
                  <MemoryIcon sx={{ fontSize: 28 }} />
                </Avatar>
                <Box>
                  <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
                    {data.tenants.reduce((total: number, tenant: any) => total + (tenant.total_servers || 0), 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    서버 실질수량(인스턴스)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    AI + 처리 + 공통 + 인프라
                  </Typography>
                </Box>
              </Box>
            </MetricCard>
          </Grid>
          <Grid item xs={12} md={3}>
            <MetricCard>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'warning.main', width: 56, height: 56 }}>
                  <SpeedIcon sx={{ fontSize: 28 }} />
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
        </Grid>
      ) : (
        // [advice from AI] 데이터가 없을 때 표시할 로딩 또는 빈 상태
        <Box sx={{ mb: 4, textAlign: 'center', py: 4 }}>
          <Typography variant="h6" color="text.secondary">
            {loading ? '데이터를 불러오는 중...' : '테넌시 데이터가 없습니다.'}
          </Typography>
        </Box>
      )}

      {/* [advice from AI] 시스템 리소스 사용률 섹션 */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12}>
          <StyledCard>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <MemoryIcon color="primary" />
                <Typography variant="h6" component="h2" sx={{ fontWeight: 'bold' }}>
                  시스템 리소스 사용률
                </Typography>
              </Box>
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', color: 'secondary.main' }}>
                      {data.resources.gpu.used}/{data.resources.gpu.total}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      GPU 사용량
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={data.resources.gpu.percentage} 
                      sx={{ mt: 1, height: 8, borderRadius: 4 }}
                      color="secondary"
                    />
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                      {data.resources.cpu.used}/{data.resources.cpu.total}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      CPU 코어
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={data.resources.cpu.percentage} 
                      sx={{ mt: 1, height: 8, borderRadius: 4 }}
                      color="success"
                    />
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', color: 'warning.main' }}>
                      {data.resources.memory.used}/{data.resources.memory.total}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      메모리 (GB)
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={data.resources.memory.percentage} 
                      sx={{ mt: 1, height: 8, borderRadius: 4 }}
                      color="warning"
                    />
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </StyledCard>
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
              {data.tenants && data.tenants.length > 0 ? (
                <Grid container spacing={2}>
                  {data.tenants.map((tenant: any) => (
                    <Grid item xs={12} key={tenant.tenant_id || tenant.id}>
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
                                {tenant.name || tenant.tenant_id}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {tenant.preset} 프리셋 • {tenant.status}
                              </Typography>
                              {/* [advice from AI] 채널 기반 서비스 요구사항 표시 */}
                              {tenant.service_requirements && (
                                <>
                                  <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                    {tenant.service_requirements.callbot > 0 && (
                                      <Chip 
                                        label={`콜봇 ${tenant.service_requirements.callbot}채널`} 
                                        size="small" 
                                        color="primary" 
                                        variant="outlined"
                                      />
                                    )}
                                    {tenant.service_requirements.chatbot > 0 && (
                                      <Chip 
                                        label={`챗봇 ${tenant.service_requirements.chatbot}채널`} 
                                        size="small" 
                                        color="success" 
                                        variant="outlined"
                                      />
                                    )}
                                    {tenant.service_requirements.advisor > 0 && (
                                      <Chip 
                                        label={`어드바이저 ${tenant.service_requirements.advisor}채널`} 
                                        size="small" 
                                        color="warning" 
                                        variant="outlined"
                                      />
                                    )}
                                  </Box>
                                  <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                    {tenant.service_requirements.stt > 0 && (
                                      <Chip 
                                        label={`STT ${tenant.service_requirements.stt}개`} 
                                        size="small" 
                                        color="info" 
                                        variant="outlined"
                                      />
                                    )}
                                    {tenant.service_requirements.tts > 0 && (
                                      <Chip 
                                        label={`TTS ${tenant.service_requirements.tts}개`} 
                                        size="small" 
                                        color="secondary" 
                                        variant="outlined"
                                      />
                                    )}
                                    {tenant.service_requirements.ta > 0 && (
                                      <Chip 
                                        label={`TA ${tenant.service_requirements.ta}개`} 
                                        size="small" 
                                        color="error" 
                                        variant="outlined"
                                      />
                                    )}
                                    {tenant.service_requirements.qa > 0 && (
                                      <Chip 
                                        label={`QA ${tenant.service_requirements.qa}개`} 
                                        size="small" 
                                        color="default" 
                                        variant="outlined"
                                      />
                                    )}
                                  </Box>
                                </>
                              )}
                            </Box>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {/* [advice from AI] 테넌시 관리 버튼들 */}
                            <IconButton
                              size="small"
                              onClick={() => handleViewTenant(tenant)}
                              color="primary"
                            >
                              <ViewIcon />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteTenant(tenant.tenant_id || tenant.id)}
                              color="error"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Box>
                        </Box>
                        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box sx={{ textAlign: 'left' }}>
                            {/* [advice from AI] 테넌시 요약 정보 */}
                            <Typography variant="caption" color="text.secondary">
                              총 채널: {tenant.total_channels || 0}
                            </Typography>
                            <br />
                            <Typography variant="caption" color="text.secondary">
                              서비스: {tenant.total_services || 0}개
                            </Typography>
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            GPU: {tenant.gpu_limit || tenant.gpuCount || 0} • CPU: {tenant.cpu_limit || tenant.cpuCount || 0} • RAM: {tenant.memory_limit || tenant.memoryGB || 0}GB
                          </Typography>
                        </Box>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body1" color="text.secondary">
                    {loading ? '테넌시 데이터를 불러오는 중...' : '테넌시가 없습니다.'}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </StyledCard>
        </Grid>

        {/* 최근 활동 피드 */}
        <Grid item xs={12} md={4}>
          <StyledCard>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <TrendingUpIcon color="primary" />
                <Typography variant="h6" component="h2" sx={{ fontWeight: 'bold' }}>
                  최근 활동
                </Typography>
              </Box>
              {data.activities && data.activities.length > 0 ? (
                <List>
                  {data.activities.map((activity: any) => (
                    <ListItem key={activity.id} sx={{ px: 0 }}>
                      <ListItemIcon>
                        <ActivityIcon status={activity.status} />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                              {activity.message}
                            </Typography>
                            <Chip 
                              label={activity.type} 
                              size="small" 
                              color="primary" 
                              variant="outlined"
                            />
                          </Box>
                        }
                        secondary={activity.timestamp}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    활동 내역이 없습니다.
                  </Typography>
                </Box>
              )}
            </CardContent>
          </StyledCard>
        </Grid>
      </Grid>

      {/* [advice from AI] 테넌시 상세보기 다이얼로그 */}
      <Dialog 
        open={showTenantDetail} 
        onClose={() => setShowTenantDetail(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          테넌시 상세 정보: {selectedTenant?.name || selectedTenant?.tenant_id}
        </DialogTitle>
        <DialogContent>
          {selectedTenant && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>기본 정보</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2"><strong>상태:</strong> {selectedTenant.status}</Typography>
                  <Typography variant="body2"><strong>프리셋:</strong> {selectedTenant.preset}</Typography>
                  <Typography variant="body2"><strong>GPU:</strong> {selectedTenant.gpu_limit || selectedTenant.gpuCount || 0}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2"><strong>CPU:</strong> {selectedTenant.cpu_limit ? 
                    (typeof selectedTenant.cpu_limit === 'string' ? 
                      selectedTenant.cpu_limit : 
                      selectedTenant.cpu_limit + 'm') : 
                    (selectedTenant.cpuCount || 0) + 'm'}</Typography>
                  <Typography variant="body2"><strong>메모리:</strong> {selectedTenant.memory_limit ? 
                    (typeof selectedTenant.memory_limit === 'string' ? 
                      selectedTenant.memory_limit : 
                      selectedTenant.memory_limit + 'Gi') : 
                    (selectedTenant.memoryGB || 0) + 'GB'}</Typography>
                  <Typography variant="body2"><strong>생성일:</strong> {selectedTenant.created_at || selectedTenant.createdAt}</Typography>
                </Grid>
              </Grid>
              
              {selectedTenant.service_requirements && (
                <>
                  <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>서비스 요구사항</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2"><strong>콜봇:</strong> {selectedTenant.service_requirements.callbot || 0}채널</Typography>
                      <Typography variant="body2"><strong>챗봇:</strong> {selectedTenant.service_requirements.chatbot || 0}채널</Typography>
                      <Typography variant="body2"><strong>어드바이저:</strong> {selectedTenant.service_requirements.advisor || 0}채널</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2"><strong>STT:</strong> {selectedTenant.service_requirements.stt || 0}개</Typography>
                      <Typography variant="body2"><strong>TTS:</strong> {selectedTenant.service_requirements.tts || 0}개</Typography>
                      <Typography variant="body2"><strong>TA:</strong> {selectedTenant.service_requirements.ta || 0}개</Typography>
                      <Typography variant="body2"><strong>QA:</strong> {selectedTenant.service_requirements.qa || 0}개</Typography>
                    </Grid>
                  </Grid>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTenantDetail(false)}>닫기</Button>
        </DialogActions>
      </Dialog>
        </>
      )}

      {/* [advice from AI] 서버 모니터링 탭 - 임시 비활성화 */}
      {currentTab === 1 && isDemoMode && (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h3>🖥️ 서버 모니터링</h3>
          <p>서버별 실시간 모니터링 기능을 준비 중입니다.</p>
          <p>현재 테넌시: {selectedTenant?.tenant_id || '없음'}</p>
        </div>
      )}
    </Box>
  );
};

// [advice from AI] 상태 아이콘 컴포넌트
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

// [advice from AI] 활동 상태 아이콘 컴포넌트
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

export default Dashboard;
