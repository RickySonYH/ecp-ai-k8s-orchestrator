// [advice from AI] 모니터링 설정 컴포넌트 - 초보자를 위한 상세한 설명과 예시 포함
/**
 * 모니터링 설정 컴포넌트
 * - 메트릭 수집, 알림 규칙, 대시보드 설정 관리
 * - 초보자를 위한 단계별 가이드와 예시 제공
 * - 데모 모드와 실제 모드 지원
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  AlertTitle,
  Grid,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Slider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  Monitor as MonitorIcon,
  Timeline as MetricsIcon,
  Notifications as AlertIcon,
  Dashboard as DashboardIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';

import { MonitoringConfig } from '../SettingsTab';

interface MonitoringSettingsProps {
  config: MonitoringConfig;
  demoMode: boolean;
  onChange: (config: MonitoringConfig) => void;
}

const alertChannels = [
  { value: 'slack', label: 'Slack', icon: '💬' },
  { value: 'teams', label: 'Microsoft Teams', icon: '💼' },
  { value: 'email', label: 'Email', icon: '📧' },
  { value: 'webhook', label: 'Webhook', icon: '🌐' },
  { value: 'pagerduty', label: 'PagerDuty', icon: '📱' }
];

const metricTypes = [
  { value: 'cpu', label: 'CPU 사용률', description: 'CPU 사용량 및 부하' },
  { value: 'memory', label: '메모리 사용률', description: '메모리 사용량 및 가용성' },
  { value: 'disk', label: '디스크 사용률', description: '디스크 공간 및 I/O' },
  { value: 'network', label: '네트워크 트래픽', description: '네트워크 대역폭 및 연결' },
  { value: 'application', label: '애플리케이션 메트릭', description: '응답 시간, 처리량 등' }
];

export const MonitoringSettings: React.FC<MonitoringSettingsProps> = ({ config, demoMode, onChange }) => {
  const [expandedSections, setExpandedSections] = useState({
    metrics: true,
    alerts: true,
    dashboard: true
  });
  const [newAlertChannel, setNewAlertChannel] = useState('');
  const [newAlertChannelType, setNewAlertChannelType] = useState('slack');

  const handleConfigChange = (field: keyof MonitoringConfig, value: any) => {
    onChange({ ...config, [field]: value });
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const addAlertChannel = () => {
    if (newAlertChannel.trim()) {
      const channel = `${newAlertChannelType}:${newAlertChannel.trim()}`;
      onChange({
        ...config,
        alertChannels: [...config.alertChannels, channel]
      });
      setNewAlertChannel('');
    }
  };

  const removeAlertChannel = (channel: string) => {
    onChange({
      ...config,
      alertChannels: config.alertChannels.filter(c => c !== channel)
    });
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom color="primary">
        📊 모니터링 설정
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        <AlertTitle>💡 모니터링이란?</AlertTitle>
        <Typography variant="body2">
          모니터링은 시스템의 상태와 성능을 실시간으로 추적하는 것입니다. 
          메트릭 수집, 알림 설정, 대시보드를 통해 시스템의 건강성을 파악하고 
          문제 발생 시 빠르게 대응할 수 있습니다.
        </Typography>
      </Alert>

      {/* 메트릭 수집 설정 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
            onClick={() => toggleSection('metrics')}
          >
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <MetricsIcon color="primary" />
              메트릭 수집 설정
            </Typography>
            <IconButton size="small">
              {expandedSections.metrics ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          
          <Collapse in={expandedSections.metrics}>
            <Divider sx={{ my: 2 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Prometheus URL"
                  placeholder="http://prometheus:9090"
                  value={config.prometheusUrl}
                  onChange={(e) => handleConfigChange('prometheusUrl', e.target.value)}
                  disabled={demoMode}
                  sx={{ mb: 2 }}
                  helperText="Prometheus 서버의 URL을 입력하세요"
                />
                
                <TextField
                  fullWidth
                  label="Grafana URL"
                  placeholder="http://grafana:3000"
                  value={config.grafanaUrl}
                  onChange={(e) => handleConfigChange('grafanaUrl', e.target.value)}
                  disabled={demoMode}
                  sx={{ mb: 2 }}
                  helperText="Grafana 대시보드의 URL을 입력하세요"
                />
                
                <Typography variant="subtitle1" gutterBottom>
                  메트릭 보관 기간: {config.metricsRetention}일
                </Typography>
                <Slider
                  value={config.metricsRetention}
                  onChange={(_, value) => handleConfigChange('metricsRetention', value)}
                  min={1}
                  max={365}
                  step={1}
                  marks={[
                    { value: 1, label: '1일' },
                    { value: 30, label: '30일' },
                    { value: 90, label: '90일' },
                    { value: 365, label: '1년' }
                  ]}
                  disabled={demoMode}
                  valueLabelDisplay="auto"
                  sx={{ mb: 2 }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, backgroundColor: 'primary.50' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    📈 수집되는 메트릭
                  </Typography>
                  {metricTypes.map(metric => (
                    <Box key={metric.value} sx={{ mb: 1 }}>
                      <Typography variant="body2" fontWeight="bold">
                        {metric.label}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {metric.description}
                      </Typography>
                    </Box>
                  ))}
                </Paper>
                
                <Paper sx={{ p: 2, backgroundColor: 'info.50', mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom color="info.main">
                    ⚙️ Prometheus 설정
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Scrape Interval</strong>: 15초 (기본값)
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Retention</strong>: {config.metricsRetention}일
                  </Typography>
                  <Typography variant="body2">
                    <strong>Storage</strong>: 로컬 디스크 또는 원격 저장소
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Collapse>
        </CardContent>
      </Card>

      {/* 알림 규칙 설정 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
            onClick={() => toggleSection('alerts')}
          >
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AlertIcon color="primary" />
              알림 규칙 설정
            </Typography>
            <IconButton size="small">
              {expandedSections.alerts ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          
          <Collapse in={expandedSections.alerts}>
            <Divider sx={{ my: 2 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>
                  알림 채널 추가
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <FormControl sx={{ minWidth: 120 }}>
                    <InputLabel>채널 타입</InputLabel>
                    <Select
                      value={newAlertChannelType}
                      label="채널 타입"
                      onChange={(e) => setNewAlertChannelType(e.target.value)}
                      disabled={demoMode}
                    >
                      {alertChannels.map(channel => (
                        <MenuItem key={channel.value} value={channel.value}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <span>{channel.icon}</span>
                            {channel.label}
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  
                  <TextField
                    placeholder="채널 정보 입력"
                    value={newAlertChannel}
                    onChange={(e) => setNewAlertChannel(e.target.value)}
                    disabled={demoMode}
                    sx={{ flex: 1 }}
                  />
                  
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={addAlertChannel}
                    disabled={!newAlertChannel.trim() || demoMode}
                  >
                    추가
                  </Button>
                </Box>
                
                <Typography variant="subtitle1" gutterBottom>
                  현재 알림 채널
                </Typography>
                
                <List dense>
                  {config.alertChannels.map((channel, index) => (
                    <ListItem key={index} sx={{ border: '1px solid #e0e0e0', borderRadius: 1, mb: 1 }}>
                      <ListItemIcon>
                        <InfoIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText primary={channel} />
                      <IconButton
                        edge="end"
                        onClick={() => removeAlertChannel(channel)}
                        disabled={demoMode}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItem>
                  ))}
                  {config.alertChannels.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                      설정된 알림 채널이 없습니다
                    </Typography>
                  )}
                </List>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, backgroundColor: 'warning.50' }}>
                  <Typography variant="subtitle2" gutterBottom color="warning.main">
                    🚨 기본 알림 규칙
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    • <strong>CPU 사용률</strong>: 80% 이상 시 경고, 90% 이상 시 심각
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    • <strong>메모리 사용률</strong>: 85% 이상 시 경고, 95% 이상 시 심각
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    • <strong>디스크 사용률</strong>: 80% 이상 시 경고, 90% 이상 시 심각
                  </Typography>
                  <Typography variant="body2">
                    • <strong>Pod 상태</strong>: Running이 아닌 상태 시 즉시 알림
                  </Typography>
                </Paper>
                
                <Paper sx={{ p: 2, backgroundColor: 'success.50', mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom color="success.main">
                    📱 알림 채널 설정 가이드
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Slack</strong>: 워크스페이스명과 채널명 입력
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Teams</strong>: 웹훅 URL 입력
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Email</strong>: 이메일 주소 입력
                  </Typography>
                  <Typography variant="body2">
                    <strong>Webhook</strong>: HTTP 엔드포인트 URL 입력
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Collapse>
        </CardContent>
      </Card>

      {/* 대시보드 설정 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
            onClick={() => toggleSection('dashboard')}
          >
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DashboardIcon color="primary" />
              대시보드 설정
            </Typography>
            <IconButton size="small">
              {expandedSections.dashboard ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          
          <Collapse in={expandedSections.dashboard}>
            <Divider sx={{ my: 2 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <Typography variant="body1" sx={{ mb: 3 }}>
                  Grafana를 사용하여 시스템 모니터링 대시보드를 구성합니다.
                  미리 정의된 템플릿을 사용하거나 커스텀 대시보드를 만들 수 있습니다.
                </Typography>
                
                <Paper sx={{ p: 2, backgroundColor: 'primary.50', mb: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    📊 기본 대시보드 템플릿
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Paper sx={{ p: 2, backgroundColor: 'white' }}>
                        <Typography variant="subtitle2" gutterBottom>
                          🖥️ 시스템 대시보드
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          CPU, 메모리, 디스크, 네트워크 사용률
                        </Typography>
                        <Chip label="자동 설치" color="success" size="small" />
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Paper sx={{ p: 2, backgroundColor: 'white' }}>
                        <Typography variant="subtitle2" gutterBottom>
                          🐳 Kubernetes 대시보드
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          Pod, Node, Service 상태 및 메트릭
                        </Typography>
                        <Chip label="자동 설치" color="success" size="small" />
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Paper sx={{ p: 2, backgroundColor: 'white' }}>
                        <Typography variant="subtitle2" gutterBottom>
                          📈 애플리케이션 대시보드
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          응답 시간, 처리량, 오류율
                        </Typography>
                        <Chip label="수동 설정" color="warning" size="small" />
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Paper sx={{ p: 2, backgroundColor: 'white' }}>
                        <Typography variant="subtitle2" gutterBottom>
                          🔒 보안 대시보드
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          취약점 스캔, 접근 로그, 정책 위반
                        </Typography>
                        <Chip label="수동 설정" color="warning" size="small" />
                      </Paper>
                    </Grid>
                  </Grid>
                </Paper>
                
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="outlined"
                    disabled={demoMode}
                  >
                    📥 대시보드 내보내기
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={demoMode}
                  >
                    📤 대시보드 가져오기
                  </Button>
                  <Button
                    variant="contained"
                    disabled={demoMode}
                  >
                    🆕 새 대시보드 생성
                  </Button>
                </Box>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2, backgroundColor: 'success.50' }}>
                  <Typography variant="subtitle2" gutterBottom color="success.main">
                    🎨 대시보드 커스터마이징
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    • <strong>패널 추가/제거</strong>: 필요한 메트릭만 표시
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    • <strong>레이아웃 조정</strong>: 화면 크기에 맞게 배치
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    • <strong>색상 테마</strong>: 다크/라이트 모드 지원
                  </Typography>
                  <Typography variant="body2">
                    • <strong>자동 새로고침</strong>: 실시간 데이터 업데이트
                  </Typography>
                </Paper>
                
                <Paper sx={{ p: 2, backgroundColor: 'info.50', mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom color="info.main">
                    📱 모바일 지원
                  </Typography>
                  <Typography variant="body2">
                    모든 대시보드는 반응형으로 설계되어 
                    모바일 기기에서도 최적화된 화면을 제공합니다.
                    중요한 알림은 푸시 알림으로도 받을 수 있습니다.
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Collapse>
        </CardContent>
      </Card>

      {/* 설정 저장 */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
        <Button
          variant="contained"
          size="large"
          onClick={() => console.log('모니터링 설정 저장:', config)}
          disabled={demoMode}
        >
          💾 설정 저장
        </Button>
        
        {demoMode && (
          <Alert severity="warning" sx={{ maxWidth: 400 }}>
            <AlertTitle>데모 모드</AlertTitle>
            <Typography variant="body2">
              데모 모드에서는 설정이 실제로 저장되지 않습니다. 
              실제 모드로 전환하여 설정을 저장하세요.
            </Typography>
          </Alert>
        )}
      </Box>
    </Box>
  );
};
