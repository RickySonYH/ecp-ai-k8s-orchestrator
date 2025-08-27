// [advice from AI] ECP-AI Kubernetes Orchestrator UI 퍼블리셔 - 완전한 웹 관리 시스템
/**
 * ECP-AI Kubernetes Orchestrator 메인 애플리케이션
 * - 테넌시 생성, 관리, 모니터링 통합 UI
 * - 실시간 대시보드 및 메트릭 시각화
 * - 다중 테넌시 관리 및 비교
 * - 반응형 디자인 및 다크/라이트 테마
 */

import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  Container,
  Tab,
  Tabs,
  ThemeProvider,
  createTheme,
  CssBaseline,
  IconButton,
  Badge,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Switch,
  FormControlLabel,
  Alert,
  Snackbar,
  Fab,
  Tooltip,
  Card,
  CardContent,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  CircularProgress,
  Chip
} from '@mui/material';
import {
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  Dashboard as DashboardIcon,
  Add as AddIcon,
  Timeline as MonitoringIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  Menu as MenuIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  CloudQueue as CloudIcon,
  Memory as MemoryIcon,
  Speed as SpeedIcon,
  Build as BuildIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// 컴포넌트 임포트
import { TenantCreator } from './components/TenantCreator.tsx';
import { TenantDashboard } from './components/TenantDashboard.tsx';
import AdvancedMonitoring from './components/AdvancedMonitoring.tsx';
import CICDManagement from './components/CICDManagement.tsx';
import ManifestPreviewTest from './components/ManifestPreviewTest.tsx';
import Dashboard from './components/DemoDashboard.tsx';
import { SettingsTab } from './components/SettingsTab.tsx';
import { ModeSelector } from './components/ModeSelector.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';

// 타입 정의
interface DeploymentStatus {
  success: boolean;
  tenant_id: string;
  preset: string;
  estimated_resources: any;
  deployment_status: string;
  created_at: string;
}

interface TenantSummary {
  tenant_id: string;
  name?: string;
  status: string;
  preset: string;
  is_demo: boolean;
  services_count: number;
  created_at: string;
}

interface SystemMetrics {
  total_tenants: number;
  total_services: number;
  total_gpu_usage: number;
  total_cpu_usage: number;
  system_health: 'healthy' | 'warning' | 'critical';
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// [advice from AI] 모던 스타일드 컴포넌트 - 더 현대적인 그라디언트와 그림자 효과
const StyledAppBar = styled(AppBar)(({ theme }) => ({
  background: theme.palette.mode === 'dark' 
    ? `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark}, #1e1b4b)`
    : `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark}, #312e81)`,
  boxShadow: '0 8px 32px rgba(99, 102, 241, 0.3)',
  backdropFilter: 'blur(10px)',
}));

const StyledDrawer = styled(Drawer)(({ theme }) => ({
  '& .MuiDrawer-paper': {
    width: 280,
    background: theme.palette.mode === 'dark' 
      ? 'linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #334155 100%)'
      : 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)',
    backdropFilter: 'blur(10px)',
    borderRight: `1px solid ${theme.palette.divider}`,
  },
}));

const SystemMetricCard = styled(Card)(({ theme }) => ({
  background: theme.palette.mode === 'dark'
    ? `linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(67, 56, 202, 0.05))`
    : `linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(129, 140, 248, 0.03))`,
  backdropFilter: 'blur(20px)',
  border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)'}`,
  boxShadow: theme.palette.mode === 'dark' 
    ? '0 8px 32px rgba(99, 102, 241, 0.1)' 
    : '0 4px 20px rgba(99, 102, 241, 0.08)',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.palette.mode === 'dark' 
      ? '0 12px 40px rgba(99, 102, 241, 0.2)' 
      : '0 8px 30px rgba(99, 102, 241, 0.15)',
  },
}));

const FloatingActionButton = styled(Fab)(({ theme }) => ({
  position: 'fixed',
  bottom: theme.spacing(3),
  right: theme.spacing(3),
  zIndex: theme.zIndex.speedDial,
}));

// 탭 패널 컴포넌트
function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

function App() {
  // 상태 관리
  const [currentTab, setCurrentTab] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createdTenants, setCreatedTenants] = useState<string[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [tenantList, setTenantList] = useState<TenantSummary[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  
  // [advice from AI] 팝업 대시보드 상태 추가
  const [dashboardPopupOpen, setDashboardPopupOpen] = useState(false);

  // [advice from AI] 테넌시 목록 로딩 상태 추가
  const [tenantsLoading, setTenantsLoading] = useState(false);

  // [advice from AI] 모드 선택 상태 관리
  const [modeSelected, setModeSelected] = useState(false);
  
  // [advice from AI] 데모 모드 상태 관리 - 로컬 스토리지와 연동
  const [isDemoMode, setIsDemoMode] = useState(() => {
    // 로컬 스토리지에서 저장된 데모 모드 설정 불러오기
    const savedDemoMode = localStorage.getItem('ecp-ai-demo-mode');
    return savedDemoMode !== null ? JSON.parse(savedDemoMode) : true; // 기본값은 데모 모드
  });

  // [advice from AI] 모드 선택 처리
  const handleModeSelect = (demoMode: boolean) => {
    setIsDemoMode(demoMode);
    setModeSelected(true);
    // 모드 선택 후 테넌시 목록 로드
    fetchTenants();
  };

  // [advice from AI] 데모 모드 변경 시 로컬 스토리지에 저장 및 새로고침
  const handleDemoModeChange = (demoMode: boolean) => {
    setIsDemoMode(demoMode);
    localStorage.setItem('ecp-ai-demo-mode', JSON.stringify(demoMode));
    // 모드 변경 시 완전한 새로고침으로 앱 재시작
    window.location.reload();
  };

  // [advice from AI] 데모 테넌시 데이터는 이제 백엔드 API에서 조회


  // [advice from AI] 테넌시 목록 조회 함수 (통합된 데이터 관리)
  const fetchTenants = async () => {
    try {
      setTenantsLoading(true);
      
      if (isDemoMode) {
        // 데모 모드: 데모 전용 API 사용
        console.log('App - 데모 모드: 데모 API 호출');
        const demoResponse = await fetch('http://localhost:8001/api/v1/demo/tenants/');
        
        if (demoResponse.ok) {
          const demoData = await demoResponse.json();
          console.log('App - 데모 API 응답:', demoData.length, '개 테넌시');
          setTenantList(demoData);
        } else {
          console.log('데모 API 호출 실패 - 빈 목록으로 설정');
          setTenantList([]);
        }
      } else {
        // 운영 모드: 일반 테넌시 API 사용
        const response = await fetch('http://localhost:8001/api/v1/tenants/');
        
        if (response.ok) {
          const data = await response.json();
          const tenants = data.tenants || [];
          console.log('App - 운영 API 응답:', tenants.length, '개 테넌시');
          setTenantList(tenants);
        } else {
          console.log('테넌시 API 호출 실패 - 빈 목록으로 설정');
          setTenantList([]);
        }
      }
      
    } catch (error) {
      console.error('테넌시 목록 조회 실패:', error);
      setTenantList([]);
    } finally {
      setTenantsLoading(false);
    }
  };

  // [advice from AI] 컴포넌트 마운트 시 테넌시 목록 조회
  useEffect(() => {
    fetchTenants();
    
    // 주기적 업데이트 (1분마다)
    const interval = setInterval(fetchTenants, 60000);
    return () => clearInterval(interval);
  }, [isDemoMode]); // isDemoMode가 변경될 때마다 다시 로드

  // [advice from AI] 모던 테마 생성 - 더 현대적인 색상 팔레트 적용
  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: '#6366f1', // 모던 인디고
        light: '#818cf8',
        dark: '#4338ca',
      },
      secondary: {
        main: '#f59e0b', // 모던 앰버
        light: '#fbbf24',
        dark: '#d97706',
      },
      background: darkMode ? {
        default: '#0f172a', // 더 깊은 다크 블루
        paper: '#1e293b',
      } : {
        default: '#f8fafc', // 더 밝은 회색
        paper: '#ffffff',
      },
      success: {
        main: '#10b981', // 모던 그린
        light: '#34d399',
        dark: '#059669',
      },
      warning: {
        main: '#f59e0b', // 모던 오렌지
        light: '#fbbf24',
        dark: '#d97706',
      },
      error: {
        main: '#ef4444', // 모던 레드
        light: '#f87171',
        dark: '#dc2626',
      },
    },
    typography: {
      h4: {
        fontWeight: 'bold',
      },
      h6: {
        fontWeight: 'medium',
      },
    },
    shape: {
      borderRadius: 12,
    },
  });

  // [advice from AI] 탭 변경 핸들러 - 탭 변경 시 상단으로 스크롤
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
    // 탭 변경 시 상단으로 스크롤 (고정 AppBar 아래로)
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 테넌시 생성 완료 핸들러
  const handleTenantCreated = (result: DeploymentStatus) => {
    if (result.success) {
      setCreatedTenants(prev => [...prev, result.tenant_id]);
      setSelectedTenant(result.tenant_id);
      setSnackbarMessage(`테넌시 '${result.tenant_id}' 생성 완료! (${result.preset} 프리셋)`);
      setSnackbarOpen(true);
      
      // 대시보드 탭으로 이동
      setCurrentTab(1);
      
      // 테넌시 목록 새로고침
      fetchTenants();
    }
  };

  // 테넌시 삭제 완료 핸들러
  const handleTenantDeleted = () => {
    if (selectedTenant) {
      setCreatedTenants(prev => prev.filter(id => id !== selectedTenant));
      setSnackbarMessage(`테넌시 '${selectedTenant}' 삭제 완료`);
      setSnackbarOpen(true);
      
      // 다른 테넌시 선택 또는 생성 탭으로 이동
      const remainingTenants = createdTenants.filter(id => id !== selectedTenant);
      if (remainingTenants.length > 0) {
        setSelectedTenant(remainingTenants[0]);
      } else {
        setSelectedTenant(null);
        setCurrentTab(0);
      }
      
      fetchTenants();
    }
  };

  // [advice from AI] fetchTenantList 제거 - fetchTenants로 통일

  // 시스템 메트릭 조회
  const fetchSystemMetrics = async () => {
    try {
      // 실제 구현에서는 시스템 전체 메트릭 API 호출
      const mockMetrics: SystemMetrics = {
        total_tenants: tenantList.length,
        total_services: tenantList.length * 3, // 평균 3개 서비스
        total_gpu_usage: Math.random() * 80 + 10,
        total_cpu_usage: Math.random() * 70 + 20,
        system_health: Math.random() > 0.8 ? 'warning' : 'healthy'
      };
      setSystemMetrics(mockMetrics);
    } catch (error) {
      console.error('시스템 메트릭 조회 실패:', error);
    }
  };

  // [advice from AI] 컴포넌트 마운트 시 초기화 및 페이지 상단 스크롤
  useEffect(() => {
    // 페이지 로드 시 상단으로 스크롤
    window.scrollTo(0, 0);
    
    fetchTenants();
    fetchSystemMetrics();
    
    // 주기적 업데이트 (30초마다)
    const interval = setInterval(() => {
      fetchTenants();
      fetchSystemMetrics();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // 다크모드 토글
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    localStorage.setItem('ecp-dark-mode', (!darkMode).toString());
  };

  // 로컬 스토리지에서 다크모드 설정 로드
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('ecp-dark-mode');
    if (savedDarkMode !== null) {
      setDarkMode(savedDarkMode === 'true');
    }
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <Box sx={{ flexGrow: 1, minHeight: '100vh' }}>
        {/* [advice from AI] 메인 앱바 - 고정 위치로 변경하여 항상 상단에 표시 */}
        <StyledAppBar position="fixed">
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              onClick={() => setDrawerOpen(true)}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
            
            <CloudIcon sx={{ mr: 2, fontSize: 32 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
              ECP-AI Kubernetes Orchestrator
            </Typography>
            
            {/* 시스템 상태 표시 */}
            {systemMetrics && (
              <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                <Tooltip title={`테넌시 ${systemMetrics.total_tenants}개 활성`}>
                  <Badge badgeContent={systemMetrics.total_tenants} color="secondary">
                    <DashboardIcon />
                  </Badge>
                </Tooltip>
              </Box>
            )}
            
            {/* 알림 */}
            <Tooltip title="알림">
              <IconButton color="inherit">
                <Badge badgeContent={notifications.length} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            
            {/* 다크모드 토글 */}
            <Tooltip title="다크모드 토글">
              <IconButton color="inherit" onClick={toggleDarkMode}>
                {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Tooltip>
            
            {/* 현재 모드 표시 */}
            <Chip 
              label={isDemoMode ? "데모 모드" : "실사용 모드"} 
              color={isDemoMode ? "secondary" : "primary"}
              size="small"
              sx={{ ml: 2 }}
            />
            
            <Typography variant="body2" sx={{ ml: 2 }}>
              Developer Console v1.0
            </Typography>
          </Toolbar>
        </StyledAppBar>

        {/* 사이드 네비게이션 */}
        <StyledDrawer
          anchor="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        >
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" fontWeight="bold">
              🚀 ECP-AI 오케스트레이터
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Kubernetes 테넌시 관리 시스템
            </Typography>
          </Box>
          
          <Divider />
          
          <List>
            <ListItem button onClick={() => { setCurrentTab(0); setDrawerOpen(false); }}>
              <ListItemIcon><AddIcon /></ListItemIcon>
              <ListItemText primary="테넌시 생성" />
            </ListItem>
            
            <ListItem 
              button 
              onClick={() => { setCurrentTab(1); setDrawerOpen(false); }}
            >
              <ListItemIcon><DashboardIcon /></ListItemIcon>
              <ListItemText primary="대시보드" />
            </ListItem>
            
            {/* [advice from AI] 테넌시 목록 메뉴 제거 - 대시보드로 통합 완료 */}
            
            <ListItem button onClick={() => { setCurrentTab(3); setDrawerOpen(false); }}>
              <ListItemIcon><BuildIcon /></ListItemIcon>
              <ListItemText primary="CI/CD 관리" />
            </ListItem>
            
            <ListItem button onClick={() => { setCurrentTab(4); setDrawerOpen(false); }}>
              <ListItemIcon><MonitoringIcon /></ListItemIcon>
              <ListItemText primary="고급 모니터링" />
            </ListItem>
            
            <ListItem button onClick={() => { setCurrentTab(5); setDrawerOpen(false); }}>
              <ListItemIcon><SettingsIcon /></ListItemIcon>
              <ListItemText primary="설정" />
            </ListItem>
            
            <ListItem button onClick={() => { setCurrentTab(6); setDrawerOpen(false); }}>
              <ListItemIcon><BuildIcon /></ListItemIcon>
              <ListItemText primary="매니페스트 테스트" />
            </ListItem>
          </List>
          
          <Divider sx={{ my: 2 }} />
          
          {/* 활성 테넌시 목록 */}
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              활성 테넌시 ({createdTenants.length})
            </Typography>
            {createdTenants.length > 0 ? (
              <List dense>
                {createdTenants.map((tenantId) => (
                  <ListItem
                    key={tenantId}
                    button
                    selected={selectedTenant === tenantId}
                    onClick={() => {
                      setSelectedTenant(tenantId);
                      setCurrentTab(1);
                      setDrawerOpen(false);
                    }}
                    sx={{ borderRadius: 1, mb: 0.5 }}
                  >
                    <ListItemText 
                      primary={tenantId}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="caption" color="text.secondary">
                생성된 테넌시가 없습니다
              </Typography>
            )}
          </Box>
          
          <Box sx={{ flexGrow: 1 }} />
          
          {/* 시스템 상태 */}
          {systemMetrics && (
            <Box sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                시스템 상태
              </Typography>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Card variant="outlined" sx={{ p: 1 }}>
                    <Typography variant="caption">GPU</Typography>
                    <Typography variant="h6" color="primary">
                      {systemMetrics.total_gpu_usage.toFixed(0)}%
                    </Typography>
                  </Card>
                </Grid>
                <Grid item xs={6}>
                  <Card variant="outlined" sx={{ p: 1 }}>
                    <Typography variant="caption">CPU</Typography>
                    <Typography variant="h6" color="secondary">
                      {systemMetrics.total_cpu_usage.toFixed(0)}%
                    </Typography>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}
        </StyledDrawer>

        {/* [advice from AI] 메인 컨텐츠 - 고정 AppBar를 위한 상단 여백 추가 */}
        <Container maxWidth="xl" sx={{ mt: 10, pb: 10 }}>
          {/* 모드 선택 화면 또는 메인 컨텐츠 */}
          {!modeSelected ? (
            <ModeSelector onModeSelect={handleModeSelect} />
          ) : (
            <>
              {/* 시스템 상태 오버뷰 */}
              {systemMetrics && (
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} md={3}>
                <SystemMetricCard>
                  <CardContent sx={{ display: 'flex', alignItems: 'center' }}>
                    <DashboardIcon sx={{ mr: 2, fontSize: 40, color: 'primary.main' }} />
                    <Box>
                      <Typography variant="h4" fontWeight="bold">
                        {systemMetrics.total_tenants}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        활성 테넌시
                      </Typography>
                    </Box>
                  </CardContent>
                </SystemMetricCard>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <SystemMetricCard>
                  <CardContent sx={{ display: 'flex', alignItems: 'center' }}>
                    <CloudIcon sx={{ mr: 2, fontSize: 40, color: 'secondary.main' }} />
                    <Box>
                      <Typography variant="h4" fontWeight="bold">
                        {systemMetrics.total_services}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        실행 중인 서비스
                      </Typography>
                    </Box>
                  </CardContent>
                </SystemMetricCard>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <SystemMetricCard>
                  <CardContent sx={{ display: 'flex', alignItems: 'center' }}>
                    <MemoryIcon sx={{ mr: 2, fontSize: 40, color: 'success.main' }} />
                    <Box>
                      <Typography variant="h4" fontWeight="bold">
                        {systemMetrics.total_gpu_usage.toFixed(0)}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        전체 GPU 사용률
                      </Typography>
                    </Box>
                  </CardContent>
                </SystemMetricCard>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <SystemMetricCard>
                  <CardContent sx={{ display: 'flex', alignItems: 'center' }}>
                    <SpeedIcon sx={{ mr: 2, fontSize: 40, color: 'warning.main' }} />
                    <Box>
                      <Typography variant="h4" fontWeight="bold">
                        {systemMetrics.total_cpu_usage.toFixed(0)}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        전체 CPU 사용률
                      </Typography>
                    </Box>
                  </CardContent>
                </SystemMetricCard>
              </Grid>
            </Grid>
          )}

          {/* 탭 네비게이션 */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs 
              value={currentTab} 
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab 
                label="➕ 테넌시 생성" 
                icon={<AddIcon />}
                iconPosition="start"
              />
              <Tab 
                label="🚀 대시보드" 
                icon={<DashboardIcon />}
                iconPosition="start"
              />

              {/* [advice from AI] 테넌시 목록 탭 제거 - 대시보드로 통합 완료 */}
              <Tab 
                label="🔧 CI/CD 관리" 
                icon={<BuildIcon />}
                iconPosition="start"
              />
              <Tab 
                label="🚧 고급 모니터링" 
                icon={<MonitoringIcon />}
                iconPosition="start"
              />
              <Tab 
                label="⚙️ 설정" 
                icon={<SettingsIcon />}
                iconPosition="start"
              />
            </Tabs>
          </Box>

          {/* 탭 컨텐츠 */}
          <TabPanel value={currentTab} index={0}>
            <TenantCreator 
              onTenantCreated={handleTenantCreated} 
              onTenantSaved={(tenant) => {
                // [advice from AI] 테넌시 저장 후 DB에서 최신 데이터 다시 조회
                console.log('테넌시 저장 완료, 목록 새로고침:', tenant.tenant_id);
                fetchTenants(); // DB에서 최신 데이터 조회
                setSnackbarMessage(`테넌시 '${tenant.tenant_id}' 저장 완료!`);
                setSnackbarOpen(true);
                
                // 대시보드 탭으로 이동
                setCurrentTab(1);
                
                // 저장된 테넌시를 선택 상태로 설정
                setSelectedTenant(tenant.tenant_id);
              }}
            />
          </TabPanel>

          <TabPanel value={currentTab} index={1}>
            <Dashboard isDemoMode={isDemoMode} />
          </TabPanel>



          {/* [advice from AI] 테넌시 목록 탭 컨텐츠 제거 - 대시보드로 통합 완료 */}

          {/* CI/CD 관리 탭 */}
          <TabPanel value={currentTab} index={2}>
            <CICDManagement isDemoMode={isDemoMode} />
          </TabPanel>

          {/* 고급 모니터링 탭 */}
          <TabPanel value={currentTab} index={3}>
            <AdvancedMonitoring isDemoMode={isDemoMode} />
          </TabPanel>

          <TabPanel value={currentTab} index={4}>
            <SettingsTab 
              isDemoMode={isDemoMode}
              onDemoModeChange={handleDemoModeChange}
            />
          </TabPanel>
          
          <TabPanel value={currentTab} index={5}>
            <ManifestPreviewTest />
          </TabPanel>
            </>
          )}
        </Container>

        {/* 플로팅 액션 버튼 */}
        <FloatingActionButton
          color="primary"
          onClick={() => setCurrentTab(0)}
        >
          <AddIcon />
        </FloatingActionButton>

        {/* 스낵바 알림 */}
        <Snackbar
          open={snackbarOpen}
          autoHideDuration={6000}
          onClose={() => setSnackbarOpen(false)}
          message={snackbarMessage}
        />
        
        {/* 팝업 테넌시 대시보드 */}
        <Dialog
          open={dashboardPopupOpen}
          onClose={() => setDashboardPopupOpen(false)}
          maxWidth="xl"
          fullWidth
          fullScreen
        >
          <DialogTitle sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            borderBottom: 1,
            borderColor: 'divider',
            pb: 2
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <DashboardIcon color="primary" />
              <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold' }}>
                🏢 {selectedTenant} 테넌시 대시보드
              </Typography>
            </Box>
            <IconButton
              onClick={() => setDashboardPopupOpen(false)}
              size="large"
              sx={{ color: 'text.secondary' }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          
          <DialogContent sx={{ p: 0 }}>
            {selectedTenant && (
              <TenantDashboard 
                tenantId={selectedTenant} 
                onTenantDeleted={(tenantId) => {
                  handleTenantDeleted();
                  setDashboardPopupOpen(false);
                }}
              />
            )}
          </DialogContent>
        </Dialog>
        </Box>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

// 테넌시 목록 뷰 컴포넌트
const TenantListView: React.FC<{
  tenants: TenantSummary[];
  loading: boolean;
  onTenantSelect: (tenantId: string) => void;
  onRefresh: () => void;
}> = ({ tenants, loading, onTenantSelect, onRefresh }) => {
  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          📋 테넌시 목록
        </Typography>
        <Tooltip title="새로고침">
          <IconButton onClick={onRefresh}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>
      
      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>테넌시 목록을 불러오는 중...</Typography>
        </Box>
      ) : tenants.length > 0 ? (
        <Grid container spacing={2}>
          {tenants.map((tenant) => (
            <Grid item xs={12} md={6} lg={4} key={tenant.tenant_id}>
              <Card 
                sx={{ 
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 8
                  }
                }}
                onClick={() => onTenantSelect(tenant.tenant_id)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="h6" gutterBottom>
                      {tenant.name || tenant.tenant_id}
                    </Typography>
                    {tenant.is_demo && (
                      <Chip 
                        label="데모" 
                        size="small" 
                        color="info" 
                        variant="outlined"
                      />
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    프리셋: {tenant.preset} | 상태: {tenant.status}
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    서비스: {tenant.services_count}개
                  </Typography>
                  <Typography variant="caption" display="block" color="text.secondary">
                    생성: {new Date(tenant.created_at).toLocaleDateString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Alert severity="info">
          <Typography variant="h6">생성된 테넌시가 없습니다</Typography>
          <Typography variant="body2">
            새로운 테넌시를 생성하여 ECP-AI 서비스를 시작하세요.
          </Typography>
        </Alert>
      )}
    </Box>
  );
};

// 시스템 모니터링 뷰 컴포넌트  
const SystemMonitoringView: React.FC<{
  systemMetrics: SystemMetrics | null;
}> = ({ systemMetrics }) => {
  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        📈 시스템 모니터링
      </Typography>
      
      {systemMetrics ? (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Alert severity={systemMetrics.system_health === 'healthy' ? 'success' : 'warning'}>
              <Typography variant="h6">
                시스템 상태: {systemMetrics.system_health === 'healthy' ? '정상' : '주의'}
              </Typography>
            </Alert>
          </Grid>
          
          {/* 추가 모니터링 차트 및 메트릭 */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              🚧 고급 모니터링 기능 개발 중...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              - 실시간 리소스 사용률 차트
              - 테넌시별 성능 비교
              - SLA 메트릭 트렌드
              - 알람 및 알림 설정
            </Typography>
          </Grid>
        </Grid>
      ) : (
        <Alert severity="info">시스템 메트릭을 로딩 중...</Alert>
      )}
    </Box>
  );
};

// 설정 뷰 컴포넌트
const SettingsView: React.FC<{
  darkMode: boolean;
  onDarkModeToggle: () => void;
}> = ({ darkMode, onDarkModeToggle }) => {
  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        ⚙️ 설정
      </Typography>
      
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            화면 설정
          </Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={darkMode}
                onChange={onDarkModeToggle}
              />
            }
            label="다크 모드"
          />
          
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            다크 모드 설정은 자동으로 저장됩니다.
          </Typography>
        </CardContent>
      </Card>
      
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            시스템 정보
          </Typography>
          <Typography variant="body2">
            버전: 1.0.0
          </Typography>
          <Typography variant="body2">
            빌드: {new Date().toLocaleDateString()}
          </Typography>
          <Typography variant="body2">
            환경: Development
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default App;
