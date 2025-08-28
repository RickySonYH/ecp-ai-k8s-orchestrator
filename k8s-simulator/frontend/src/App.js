// [advice from AI] K8S 시뮬레이터 대시보드 메인 애플리케이션
import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Grid,
  Paper,
  Box,
  Chip,
  Alert,
  CircularProgress
} from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import Dashboard from './components/Dashboard';
import K8sManifestUploader from './components/K8sManifestUploader';
import ResourcesTable from './components/ResourcesTable';
import MetricsCharts from './components/MetricsCharts';
import SLAMonitor from './components/SLAMonitor';
import AlertsPanel from './components/AlertsPanel';

import { useWebSocket } from './hooks/useWebSocket';
import { useApi } from './hooks/useApi';

// Material-UI 테마 설정
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
});

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [systemHealth, setSystemHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // WebSocket 연결
  const { data: wsData, connected: wsConnected } = useWebSocket('ws://localhost:6360/ws/monitoring');
  
  // API 훅
  const { get } = useApi();

  // 초기 데이터 로드
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        const healthData = await get('/monitoring/health');
        setSystemHealth(healthData);
        setError(null);
      } catch (err) {
        console.error('Failed to load initial data:', err);
        setError('시스템 데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // WebSocket 데이터 처리
  useEffect(() => {
    if (wsData && wsData.type === 'metrics_update') {
      setSystemHealth(prevHealth => ({
        ...prevHealth,
        ...wsData.data
      }));
    }
  }, [wsData]);

  const getHealthStatus = () => {
    if (!systemHealth || !systemHealth.summary) return 'unknown';
    return systemHealth.summary.overall_health || 'unknown';
  };

  const getHealthColor = (status) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'warning': return 'warning';
      case 'critical': return 'error';
      default: return 'default';
    }
  };

  const getSLAStatus = () => {
    if (!systemHealth || !systemHealth.summary) return 'N/A';
    return `${systemHealth.summary.sla_percentage || 0}%`;
  };

  if (loading) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Box 
          display="flex" 
          justifyContent="center" 
          alignItems="center" 
          minHeight="100vh"
        >
          <CircularProgress size={60} />
          <Typography variant="h6" sx={{ ml: 2 }}>
            K8S 시뮬레이터 로딩 중...
          </Typography>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ flexGrow: 1 }}>
        {/* 상단 앱바 */}
        <AppBar position="static" elevation={2}>
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              K8S Simulator & SLA Monitor
            </Typography>
            
            {/* 시스템 상태 표시 */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Chip
                label={`Health: ${getHealthStatus().toUpperCase()}`}
                color={getHealthColor(getHealthStatus())}
                size="small"
              />
              <Chip
                label={`SLA: ${getSLAStatus()}`}
                color={systemHealth?.summary?.sla_percentage >= 99.5 ? 'success' : 'warning'}
                size="small"
              />
              <Chip
                label={wsConnected ? 'Connected' : 'Disconnected'}
                color={wsConnected ? 'success' : 'error'}
                size="small"
              />
            </Box>
          </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ mt: 2, mb: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* 탭 네비게이션 */}
          <Paper sx={{ mb: 2 }}>
            <Box sx={{ p: 1 }}>
              <Grid container spacing={1}>
                {[
                  { key: 'dashboard', label: '대시보드' },
                  { key: 'upload', label: '매니페스트 업로드' },
                  { key: 'resources', label: '리소스 관리' },
                  { key: 'metrics', label: '메트릭 차트' },
                  { key: 'sla', label: 'SLA 모니터링' },
                  { key: 'alerts', label: '알림 관리' }
                ].map(tab => (
                  <Grid item key={tab.key}>
                    <Chip
                      label={tab.label}
                      clickable
                      color={activeTab === tab.key ? 'primary' : 'default'}
                      onClick={() => setActiveTab(tab.key)}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Paper>

          {/* 메인 컨텐츠 */}
          <Box>
            {activeTab === 'dashboard' && (
              <Dashboard 
                systemHealth={systemHealth}
                wsData={wsData}
              />
            )}
            {activeTab === 'upload' && (
              <K8sManifestUploader />
            )}
            {activeTab === 'resources' && (
              <ResourcesTable />
            )}
            {activeTab === 'metrics' && (
              <MetricsCharts 
                systemHealth={systemHealth}
                wsData={wsData}
              />
            )}
            {activeTab === 'sla' && (
              <SLAMonitor />
            )}
            {activeTab === 'alerts' && (
              <AlertsPanel />
            )}
          </Box>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;
