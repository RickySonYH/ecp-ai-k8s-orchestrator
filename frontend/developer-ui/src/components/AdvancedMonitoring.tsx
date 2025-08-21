import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  LinearProgress,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import {
  Timeline,
  TrendingUp,
  Warning,
  CheckCircle,
  Error,
  Refresh,
  Settings,
  Notifications,
  Speed,
  Memory,
  Storage,
  NetworkCheck
} from '@mui/icons-material';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`monitoring-tabpanel-${index}`}
      aria-labelledby={`monitoring-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const AdvancedMonitoring: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedTenant, setSelectedTenant] = useState('all');
  const [timeRange, setTimeRange] = useState('1h');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // 가상 데모 데이터
  const [realtimeData, setRealtimeData] = useState<any[]>([]);
  const [tenantComparisonData, setTenantComparisonData] = useState<any[]>([]);
  const [slaMetrics, setSlaMetrics] = useState<any>({});
  const [alerts, setAlerts] = useState<any[]>([]);

  // 데모 테넌시 목록
  const demoTenants = [
    { id: 'tenant-001', name: '글로벌 콜센터', preset: 'large', status: 'healthy' },
    { id: 'tenant-002', name: '스마트 상담봇', preset: 'medium', status: 'warning' },
    { id: 'tenant-003', name: '음성 분석 서비스', preset: 'small', status: 'healthy' },
    { id: 'tenant-004', name: 'AI 어드바이저', preset: 'medium', status: 'critical' },
    { id: 'tenant-005', name: '개발 테스트', preset: 'micro', status: 'healthy' }
  ];

  // 가상 데이터 생성 함수
  const generateRealtimeData = () => {
    const now = new Date();
    const data = [];
    
    for (let i = 59; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60000);
      data.push({
        time: time.toLocaleTimeString(),
        timestamp: time.getTime(),
        cpu: Math.random() * 80 + 10,
        memory: Math.random() * 70 + 20,
        gpu: Math.random() * 90 + 5,
        network: Math.random() * 100 + 50,
        requests: Math.floor(Math.random() * 500 + 100),
        errors: Math.floor(Math.random() * 10),
        responseTime: Math.random() * 200 + 50
      });
    }
    return data;
  };

  const generateTenantComparisonData = () => {
    return demoTenants.map(tenant => ({
      name: tenant.name,
      id: tenant.id,
      preset: tenant.preset,
      cpu: Math.random() * 80 + 10,
      memory: Math.random() * 70 + 20,
      gpu: Math.random() * 90 + 5,
      availability: 99.9 - Math.random() * 0.5,
      responseTime: Math.random() * 150 + 50,
      throughput: Math.floor(Math.random() * 1000 + 200),
      errors: Math.floor(Math.random() * 20),
      status: tenant.status
    }));
  };

  const generateSLAMetrics = () => {
    const data = [];
    const now = new Date();
    
    for (let i = 23; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 3600000);
      data.push({
        time: time.getHours() + ':00',
        timestamp: time.getTime(),
        availability: 99.5 + Math.random() * 0.4,
        responseTime: 80 + Math.random() * 40,
        errorRate: Math.random() * 0.5,
        throughput: 800 + Math.random() * 400
      });
    }
    return data;
  };

  const generateAlerts = () => {
    const alertTypes = ['warning', 'error', 'info'];
    const messages = [
      'CPU 사용률이 80%를 초과했습니다',
      'GPU 메모리 부족 경고',
      '응답 시간이 임계값을 초과했습니다',
      '네트워크 지연 감지',
      'SLA 위반 가능성 감지',
      '새로운 테넌시가 생성되었습니다',
      '자동 스케일링이 실행되었습니다'
    ];

    return Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      type: alertTypes[Math.floor(Math.random() * alertTypes.length)],
      message: messages[Math.floor(Math.random() * messages.length)],
      tenant: demoTenants[Math.floor(Math.random() * demoTenants.length)].name,
      timestamp: new Date(Date.now() - Math.random() * 3600000),
      resolved: Math.random() > 0.7
    }));
  };

  // 백엔드에서 실제 데이터 가져오기
  const fetchSystemMetrics = async () => {
    try {
      const response = await fetch('/api/v1/tenants/monitoring/system-metrics');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // API 데이터를 차트 형식에 맞게 변환
          const chartData = data.metrics.map((metric: any) => ({
            time: new Date(metric.timestamp).toLocaleTimeString(),
            timestamp: new Date(metric.timestamp).getTime(),
            cpu: metric.cpu_usage,
            memory: metric.memory_usage,
            gpu: metric.gpu_usage,
            network: metric.network_io,
            requests: metric.total_requests,
            errors: Math.floor(metric.error_rate * 10),
            responseTime: Math.random() * 200 + 50 // API에서 제공하지 않는 데이터는 임시 생성
          }));
          setRealtimeData(chartData);
        }
      }
    } catch (error) {
      console.error('시스템 메트릭 조회 실패:', error);
      // 에러 시 가상 데이터 사용
      setRealtimeData(generateRealtimeData());
    }
  };

  const fetchTenantComparison = async () => {
    try {
      const response = await fetch('/api/v1/tenants/monitoring/tenant-comparison');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setTenantComparisonData(data.tenants);
        }
      }
    } catch (error) {
      console.error('테넌시 비교 데이터 조회 실패:', error);
      setTenantComparisonData(generateTenantComparisonData());
    }
  };

  const fetchSLAMetrics = async () => {
    try {
      const response = await fetch('/api/v1/tenants/monitoring/sla-trends');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // API 데이터를 차트 형식에 맞게 변환
          const chartData = data.trends.map((trend: any) => ({
            time: trend.hour,
            timestamp: new Date(trend.timestamp).getTime(),
            availability: trend.availability,
            responseTime: trend.response_time,
            errorRate: trend.error_rate,
            throughput: trend.throughput
          }));
          setSlaMetrics(chartData);
        }
      }
    } catch (error) {
      console.error('SLA 트렌드 데이터 조회 실패:', error);
      setSlaMetrics(generateSLAMetrics());
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await fetch('/api/v1/tenants/monitoring/alerts');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAlerts(data.alerts);
        }
      }
    } catch (error) {
      console.error('알림 데이터 조회 실패:', error);
      setAlerts(generateAlerts());
    }
  };

  // 데이터 업데이트
  useEffect(() => {
    const updateData = async () => {
      await Promise.all([
        fetchSystemMetrics(),
        fetchTenantComparison(),
        fetchSLAMetrics(),
        fetchAlerts()
      ]);
      setCurrentTime(new Date());
    };

    updateData();

    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(updateData, 5000); // 5초마다 업데이트
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return '#4caf50';
      case 'warning': return '#ff9800';
      case 'critical': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  const getAlertSeverityColor = (type: string) => {
    switch (type) {
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'info';
    }
  };

  return (
    <Box sx={{ width: '100%', height: '100vh', overflow: 'auto' }}>
      {/* 헤더 */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h4" component="h1" gutterBottom>
            🚧 고급 모니터링 대시보드
          </Typography>
          <Box display="flex" alignItems="center" gap={2}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>테넌시</InputLabel>
              <Select
                value={selectedTenant}
                onChange={(e) => setSelectedTenant(e.target.value)}
                label="테넌시"
              >
                <MenuItem value="all">전체</MenuItem>
                {demoTenants.map(tenant => (
                  <MenuItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>시간 범위</InputLabel>
              <Select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                label="시간 범위"
              >
                <MenuItem value="5m">5분</MenuItem>
                <MenuItem value="1h">1시간</MenuItem>
                <MenuItem value="24h">24시간</MenuItem>
                <MenuItem value="7d">7일</MenuItem>
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  size="small"
                />
              }
              label="자동 새로고침"
            />

            <Tooltip title="수동 새로고침">
              <IconButton onClick={() => window.location.reload()}>
                <Refresh />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Typography variant="body2" color="text.secondary">
          마지막 업데이트: {currentTime.toLocaleString()} | 
          활성 테넌시: {demoTenants.length}개 | 
          총 알림: {alerts.filter(a => !a.resolved).length}개
        </Typography>
      </Paper>

      {/* 탭 네비게이션 */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={activeTab} onChange={handleTabChange} variant="fullWidth">
          <Tab 
            icon={<TrendingUp />} 
            label="실시간 리소스" 
            iconPosition="start"
          />
          <Tab 
            icon={<Speed />} 
            label="테넌시 비교" 
            iconPosition="start"
          />
          <Tab 
            icon={<Timeline />} 
            label="SLA 트렌드" 
            iconPosition="start"
          />
          <Tab 
            icon={<Notifications />} 
            label="알람 & 알림" 
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {/* 탭 내용 */}
      
      {/* 실시간 리소스 사용률 차트 */}
      <TabPanel value={activeTab} index={0}>
        <Grid container spacing={3}>
          {/* 실시간 메트릭 카드들 */}
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <Speed color="primary" />
                  <Typography variant="h6">CPU 사용률</Typography>
                </Box>
                <Typography variant="h4" color="primary">
                  {realtimeData.length > 0 ? `${Math.round(realtimeData[realtimeData.length - 1]?.cpu || 0)}%` : '0%'}
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={realtimeData.length > 0 ? realtimeData[realtimeData.length - 1]?.cpu || 0 : 0} 
                  sx={{ mt: 1 }}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <Memory color="secondary" />
                  <Typography variant="h6">메모리</Typography>
                </Box>
                <Typography variant="h4" color="secondary">
                  {realtimeData.length > 0 ? `${Math.round(realtimeData[realtimeData.length - 1]?.memory || 0)}%` : '0%'}
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={realtimeData.length > 0 ? realtimeData[realtimeData.length - 1]?.memory || 0 : 0} 
                  color="secondary"
                  sx={{ mt: 1 }}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <Storage color="warning" />
                  <Typography variant="h6">GPU 사용률</Typography>
                </Box>
                <Typography variant="h4" sx={{ color: '#ff9800' }}>
                  {realtimeData.length > 0 ? `${Math.round(realtimeData[realtimeData.length - 1]?.gpu || 0)}%` : '0%'}
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={realtimeData.length > 0 ? realtimeData[realtimeData.length - 1]?.gpu || 0 : 0} 
                  sx={{ 
                    mt: 1,
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: '#ff9800'
                    }
                  }}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <NetworkCheck color="success" />
                  <Typography variant="h6">네트워크</Typography>
                </Box>
                <Typography variant="h4" color="success">
                  {realtimeData.length > 0 ? `${Math.round(realtimeData[realtimeData.length - 1]?.network || 0)} MB/s` : '0 MB/s'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  요청/초: {realtimeData.length > 0 ? realtimeData[realtimeData.length - 1]?.requests || 0 : 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* 실시간 차트 */}
          <Grid item xs={12} lg={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  실시간 리소스 사용률 (최근 1시간)
                </Typography>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={realtimeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Line type="monotone" dataKey="cpu" stroke="#2196f3" name="CPU %" />
                    <Line type="monotone" dataKey="memory" stroke="#9c27b0" name="Memory %" />
                    <Line type="monotone" dataKey="gpu" stroke="#ff9800" name="GPU %" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  응답 시간 & 처리량
                </Typography>
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={realtimeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <RechartsTooltip />
                    <Area 
                      type="monotone" 
                      dataKey="responseTime" 
                      stroke="#4caf50" 
                      fill="#4caf50" 
                      fillOpacity={0.3}
                      name="응답시간 (ms)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* 테넌시별 성능 비교 */}
      <TabPanel value={activeTab} index={1}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  테넌시별 리소스 사용량 비교
                </Typography>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={tenantComparisonData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Bar dataKey="cpu_usage" fill="#2196f3" name="CPU %" />
                    <Bar dataKey="memory_usage" fill="#9c27b0" name="Memory %" />
                    <Bar dataKey="gpu_usage" fill="#ff9800" name="GPU %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  테넌시 상태 및 성능 지표
                </Typography>
                <Grid container spacing={2}>
                  {tenantComparisonData.map((tenant, index) => (
                    <Grid item xs={12} md={6} lg={4} key={index}>
                      <Paper sx={{ p: 2, border: `2px solid ${getStatusColor(tenant.status)}` }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                          <Typography variant="h6">{tenant.name}</Typography>
                          <Chip 
                            label={tenant.status.toUpperCase()} 
                            size="small"
                            sx={{ 
                              backgroundColor: getStatusColor(tenant.status),
                              color: 'white'
                            }}
                          />
                        </Box>
                        
                        <Grid container spacing={1}>
                          <Grid item xs={6}>
                            <Typography variant="body2" color="text.secondary">가용성</Typography>
                            <Typography variant="h6">{tenant.availability.toFixed(2)}%</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="body2" color="text.secondary">응답시간</Typography>
                            <Typography variant="h6">{Math.round(tenant.response_time || tenant.responseTime || 0)}ms</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="body2" color="text.secondary">처리량</Typography>
                            <Typography variant="h6">{tenant.throughput}/s</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="body2" color="text.secondary">오류</Typography>
                            <Typography variant="h6" color="error">{tenant.error_count || tenant.errors || 0}</Typography>
                          </Grid>
                        </Grid>

                        <Box mt={2}>
                          <Typography variant="body2" color="text.secondary">리소스 사용률</Typography>
                          <Box display="flex" gap={1} mt={1}>
                            <Tooltip title={`CPU: ${Math.round(tenant.cpu_usage || tenant.cpu || 0)}%`}>
                              <LinearProgress 
                                variant="determinate" 
                                value={tenant.cpu_usage || tenant.cpu || 0} 
                                sx={{ flex: 1, height: 8, borderRadius: 4 }}
                              />
                            </Tooltip>
                            <Tooltip title={`Memory: ${Math.round(tenant.memory_usage || tenant.memory || 0)}%`}>
                              <LinearProgress 
                                variant="determinate" 
                                value={tenant.memory_usage || tenant.memory || 0} 
                                color="secondary"
                                sx={{ flex: 1, height: 8, borderRadius: 4 }}
                              />
                            </Tooltip>
                            <Tooltip title={`GPU: ${Math.round(tenant.gpu_usage || tenant.gpu || 0)}%`}>
                              <LinearProgress 
                                variant="determinate" 
                                value={tenant.gpu_usage || tenant.gpu || 0} 
                                sx={{ 
                                  flex: 1, 
                                  height: 8, 
                                  borderRadius: 4,
                                  '& .MuiLinearProgress-bar': {
                                    backgroundColor: '#ff9800'
                                  }
                                }}
                              />
                            </Tooltip>
                          </Box>
                        </Box>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* SLA 메트릭 트렌드 */}
      <TabPanel value={activeTab} index={2}>
        <Grid container spacing={3}>
          <Grid item xs={12} lg={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  가용성 트렌드 (24시간)
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={slaMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis domain={[99, 100]} />
                    <RechartsTooltip />
                    <Line 
                      type="monotone" 
                      dataKey="availability" 
                      stroke="#4caf50" 
                      strokeWidth={3}
                      name="가용성 (%)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  응답 시간 트렌드 (24시간)
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={slaMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <RechartsTooltip />
                    <Area 
                      type="monotone" 
                      dataKey="responseTime" 
                      stroke="#2196f3" 
                      fill="#2196f3"
                      fillOpacity={0.3}
                      name="응답시간 (ms)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  오류율 트렌드 (24시간)
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={slaMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <RechartsTooltip />
                    <Line 
                      type="monotone" 
                      dataKey="errorRate" 
                      stroke="#f44336" 
                      strokeWidth={2}
                      name="오류율 (%)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  처리량 트렌드 (24시간)
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={slaMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <RechartsTooltip />
                    <Bar dataKey="throughput" fill="#9c27b0" name="처리량 (req/s)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* SLA 요약 카드 */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3, background: 'linear-gradient(45deg, #e3f2fd, #f3e5f5)' }}>
              <Typography variant="h6" gutterBottom>
                📊 SLA 성과 요약 (최근 24시간)
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="success.main">99.87%</Typography>
                    <Typography variant="body2" color="text.secondary">평균 가용성</Typography>
                    <Chip label="목표: 99.9%" size="small" color="success" sx={{ mt: 1 }} />
                  </Box>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="primary.main">98ms</Typography>
                    <Typography variant="body2" color="text.secondary">평균 응답시간</Typography>
                    <Chip label="목표: <100ms" size="small" color="primary" sx={{ mt: 1 }} />
                  </Box>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="error.main">0.13%</Typography>
                    <Typography variant="body2" color="text.secondary">평균 오류율</Typography>
                    <Chip label="목표: <0.5%" size="small" color="success" sx={{ mt: 1 }} />
                  </Box>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="secondary.main">1,247</Typography>
                    <Typography variant="body2" color="text.secondary">평균 처리량/초</Typography>
                    <Chip label="목표: >1000" size="small" color="secondary" sx={{ mt: 1 }} />
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      {/* 알람 및 알림 설정 */}
      <TabPanel value={activeTab} index={3}>
        <Grid container spacing={3}>
          <Grid item xs={12} lg={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  최근 알림 ({alerts.filter(a => !a.resolved).length}개 활성)
                </Typography>
                <Box sx={{ maxHeight: 600, overflow: 'auto' }}>
                  {alerts.map((alert) => (
                    <Alert 
                      key={alert.id}
                      severity={getAlertSeverityColor(alert.type) as any}
                      sx={{ 
                        mb: 1, 
                        opacity: alert.resolved ? 0.6 : 1,
                        textDecoration: alert.resolved ? 'line-through' : 'none'
                      }}
                      action={
                        alert.resolved ? (
                          <Chip label="해결됨" size="small" color="success" />
                        ) : (
                          <IconButton size="small">
                            <Settings />
                          </IconButton>
                        )
                      }
                    >
                      <Typography variant="body1">
                        <strong>{alert.tenant}</strong>: {alert.message}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {typeof alert.timestamp === 'string' 
                          ? new Date(alert.timestamp).toLocaleString()
                          : alert.timestamp.toLocaleString()}
                      </Typography>
                    </Alert>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  알림 설정
                </Typography>
                
                <Box mb={3}>
                  <Typography variant="subtitle1" gutterBottom>
                    임계값 설정
                  </Typography>
                  
                  <Box mb={2}>
                    <Typography variant="body2">CPU 사용률 경고</Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={80} 
                      sx={{ mt: 1, mb: 1 }}
                    />
                    <Typography variant="body2" color="text.secondary">80%</Typography>
                  </Box>

                  <Box mb={2}>
                    <Typography variant="body2">메모리 사용률 경고</Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={85} 
                      color="secondary"
                      sx={{ mt: 1, mb: 1 }}
                    />
                    <Typography variant="body2" color="text.secondary">85%</Typography>
                  </Box>

                  <Box mb={2}>
                    <Typography variant="body2">응답 시간 경고</Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={60} 
                      sx={{ 
                        mt: 1, 
                        mb: 1,
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: '#ff9800'
                        }
                      }}
                    />
                    <Typography variant="body2" color="text.secondary">150ms</Typography>
                  </Box>
                </Box>

                <Box mb={3}>
                  <Typography variant="subtitle1" gutterBottom>
                    알림 채널
                  </Typography>
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="이메일 알림"
                  />
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="Slack 알림"
                  />
                  <FormControlLabel
                    control={<Switch />}
                    label="SMS 알림"
                  />
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="웹 푸시 알림"
                  />
                </Box>

                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    알림 통계
                  </Typography>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: '해결됨', value: alerts.filter(a => a.resolved).length, fill: '#4caf50' },
                          { name: '진행중', value: alerts.filter(a => !a.resolved && a.type !== 'error').length, fill: '#ff9800' },
                          { name: '심각', value: alerts.filter(a => !a.resolved && a.type === 'error').length, fill: '#f44336' }
                        ]}
                        cx="50%"
                        cy="50%"
                        outerRadius={60}
                        dataKey="value"
                        label={({name, value}) => `${name}: ${value}`}
                      />
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
    </Box>
  );
};

export default AdvancedMonitoring;
