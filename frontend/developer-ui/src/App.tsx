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
  Grid
} from '@mui/material';
import {
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  Dashboard as DashboardIcon,
  Add as AddIcon,
  List as ListIcon,
  Timeline as MonitoringIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  Menu as MenuIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  CloudQueue as CloudIcon,
  Memory as MemoryIcon,
  Speed as SpeedIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// 컴포넌트 임포트
import { TenantCreator } from './components/TenantCreator.tsx';
import { TenantDashboard } from './components/TenantDashboard.tsx';

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
  status: string;
  preset: string;
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

// 스타일드 컴포넌트
const StyledAppBar = styled(AppBar)(({ theme }) => ({
  background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
  boxShadow: theme.shadows[8],
}));

const StyledDrawer = styled(Drawer)(({ theme }) => ({
  '& .MuiDrawer-paper': {
    width: 280,
    background: theme.palette.mode === 'dark' 
      ? 'linear-gradient(180deg, #1a1a1a 0%, #2d2d2d 100%)'
      : 'linear-gradient(180deg, #f5f5f5 0%, #e0e0e0 100%)',
  },
}));

const SystemMetricCard = styled(Card)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.palette.primary.light}20, ${theme.palette.primary.main}10)`,
  backdropFilter: 'blur(10px)',
  border: `1px solid ${theme.palette.primary.light}40`,
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

  // 테마 생성
  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: '#1976d2',
        light: '#42a5f5',
        dark: '#1565c0',
      },
      secondary: {
        main: '#dc004e',
        light: '#ff5983',
        dark: '#9a0036',
      },
      background: darkMode ? {
        default: '#121212',
        paper: '#1e1e1e',
      } : {
        default: '#f5f5f5',
        paper: '#ffffff',
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

  // 탭 변경 핸들러
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
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
      fetchTenantList();
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
      
      fetchTenantList();
    }
  };

  // 테넌시 목록 조회
  const fetchTenantList = async () => {
    try {
      const response = await fetch('/api/v1/tenants/');
      if (response.ok) {
        const data = await response.json();
        setTenantList(data.tenants || []);
      }
    } catch (error) {
      console.error('테넌시 목록 조회 실패:', error);
    }
  };

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

  // 컴포넌트 마운트 시 초기화
  useEffect(() => {
    fetchTenantList();
    fetchSystemMetrics();
    
    // 주기적 업데이트 (30초마다)
    const interval = setInterval(() => {
      fetchTenantList();
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
      <Box sx={{ flexGrow: 1, minHeight: '100vh' }}>
        {/* 메인 앱바 */}
        <StyledAppBar position="static">
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
              disabled={!selectedTenant}
            >
              <ListItemIcon><DashboardIcon /></ListItemIcon>
              <ListItemText primary="대시보드" />
            </ListItem>
            
            <ListItem button onClick={() => { setCurrentTab(2); setDrawerOpen(false); }}>
              <ListItemIcon><ListIcon /></ListItemIcon>
              <ListItemText primary="테넌시 목록" />
            </ListItem>
            
            <ListItem button onClick={() => { setCurrentTab(3); setDrawerOpen(false); }}>
              <ListItemIcon><MonitoringIcon /></ListItemIcon>
              <ListItemText primary="시스템 모니터링" />
            </ListItem>
            
            <ListItem button onClick={() => { setCurrentTab(4); setDrawerOpen(false); }}>
              <ListItemIcon><SettingsIcon /></ListItemIcon>
              <ListItemText primary="설정" />
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

        {/* 메인 컨텐츠 */}
        <Container maxWidth="xl" sx={{ mt: 2, pb: 10 }}>
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
                label="📝 테넌시 생성" 
                icon={<AddIcon />}
                iconPosition="start"
              />
              <Tab 
                label="📊 대시보드" 
                icon={<DashboardIcon />}
                iconPosition="start"
                disabled={!selectedTenant}
              />
              <Tab 
                label="📋 테넌시 목록" 
                icon={<ListIcon />}
                iconPosition="start"
              />
              <Tab 
                label="📈 시스템 모니터링" 
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
            <TenantCreator onTenantCreated={handleTenantCreated} />
          </TabPanel>

          <TabPanel value={currentTab} index={1}>
            {selectedTenant ? (
              <TenantDashboard 
                tenantId={selectedTenant} 
                onTenantDeleted={handleTenantDeleted}
              />
            ) : (
              <Alert severity="info">
                <Typography variant="h6">대시보드를 보려면 테넌시를 선택하세요</Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  왼쪽 사이드바에서 활성 테넌시를 선택하거나 새로운 테넌시를 생성하세요.
                </Typography>
              </Alert>
            )}
          </TabPanel>

          <TabPanel value={currentTab} index={2}>
            <TenantListView 
              tenants={tenantList}
              onTenantSelect={(tenantId) => {
                setSelectedTenant(tenantId);
                setCurrentTab(1);
              }}
              onRefresh={fetchTenantList}
            />
          </TabPanel>

          <TabPanel value={currentTab} index={3}>
            <SystemMonitoringView systemMetrics={systemMetrics} />
          </TabPanel>

          <TabPanel value={currentTab} index={4}>
            <SettingsView 
              darkMode={darkMode}
              onDarkModeToggle={toggleDarkMode}
            />
          </TabPanel>
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
      </Box>
    </ThemeProvider>
  );
}

// 테넌시 목록 뷰 컴포넌트
const TenantListView: React.FC<{
  tenants: TenantSummary[];
  onTenantSelect: (tenantId: string) => void;
  onRefresh: () => void;
}> = ({ tenants, onTenantSelect, onRefresh }) => {
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
      
      {tenants.length > 0 ? (
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
                  <Typography variant="h6" gutterBottom>
                    {tenant.tenant_id}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    프리셋: {tenant.preset} | 상태: {tenant.status}
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    서비스: {tenant.services_count}개
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
