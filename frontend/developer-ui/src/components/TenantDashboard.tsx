// [advice from AI] ECP-AI 테넌시 대시보드 컴포넌트 - 실시간 모니터링 및 WebSocket 지원
/**
 * ECP-AI Kubernetes Orchestrator 테넌시 대시보드
 * - 실시간 테넌시 상태 모니터링
 * - WebSocket 기반 실시간 메트릭 업데이트
 * - SLA 메트릭 및 리소스 사용률 시각화
 * - 서비스별 상태 및 헬스 체크
 * - 자동 새로고침 및 빠른 액션
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  LinearProgress,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert,
  AlertTitle,
  Paper,
  Divider,
  IconButton,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Snackbar
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Pending as PendingIcon,
  Memory as MemoryIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  Timeline as TimelineIcon,
  NetworkCheck as NetworkCheckIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// 타입 정의
interface ServiceStatus {
  name: string;
  replicas: {
    desired: number;
    available: number;
    ready: number;
  };
  status: string;
  resources?: {
    cpu_usage?: number;
    memory_usage?: number;
  };
}

interface SLAMetrics {
  availability: number;
  response_time: number;
  error_rate: number;
  throughput: number;
}

interface TenantInfo {
  tenant_id: string;
  status: string;
  services: ServiceStatus[];
  resources: {
    gpu: number;
    cpu: number;
    memory?: number;
  };
  sla_metrics: SLAMetrics;
  last_updated: string;
}

interface RealtimeMetrics {
  tenant_id: string;
  timestamp: string;
  cpu_usage: number;
  memory_usage: number;
  gpu_usage: number;
  network_io: {
    rx: number;
    tx: number;
  };
  active_connections: number;
}

interface TenantDashboardProps {
  tenantId: string;
  onTenantDeleted?: () => void;
}

// 스타일드 컴포넌트
const DashboardCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[8],
  },
}));

const MetricCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  textAlign: 'center',
  background: `linear-gradient(135deg, ${theme.palette.primary.light}20, ${theme.palette.primary.main}10)`,
  borderRadius: theme.spacing(2),
}));

const StatusChip = styled(Chip)<{ status: string }>(({ theme, status }) => {
  const getColor = () => {
    switch (status.toLowerCase()) {
      case 'running': return theme.palette.success.main;
      case 'pending': return theme.palette.warning.main;
      case 'failed': case 'error': return theme.palette.error.main;
      default: return theme.palette.grey[500];
    }
  };

  return {
    backgroundColor: getColor(),
    color: theme.palette.common.white,
    fontWeight: 'bold',
  };
});

export const TenantDashboard: React.FC<TenantDashboardProps> = ({ 
  tenantId, 
  onTenantDeleted 
}) => {
  // 상태 관리
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [realtimeMetrics, setRealtimeMetrics] = useState<RealtimeMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [wsConnected, setWsConnected] = useState(false);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // WebSocket 연결 설정
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // 이미 연결됨
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v1/tenants/${tenantId}/metrics`;

    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('WebSocket 연결됨:', tenantId);
      setWsConnected(true);
      setError(null);
    };

    wsRef.current.onmessage = (event) => {
      try {
        const metrics: RealtimeMetrics = JSON.parse(event.data);
        setRealtimeMetrics(metrics);
      } catch (err) {
        console.error('WebSocket 메시지 파싱 오류:', err);
      }
    };

    wsRef.current.onclose = (event) => {
      console.log('WebSocket 연결 해제:', event.code, event.reason);
      setWsConnected(false);
      
      // 자동 재연결 (3초 후)
      if (event.code !== 1000) { // 정상 종료가 아닌 경우
        setTimeout(() => {
          if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
            connectWebSocket();
          }
        }, 3000);
      }
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket 오류:', error);
      setWsConnected(false);
    };
  }, [tenantId]);

  // 테넌시 정보 조회
  const fetchTenantInfo = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/tenants/${tenantId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('테넌시를 찾을 수 없습니다');
        }
        throw new Error(`HTTP ${response.status}: 테넌시 정보 조회 실패`);
      }

      const data: TenantInfo = await response.json();
      setTenantInfo(data);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류';
      setError(errorMessage);
      console.error('테넌시 정보 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  // 테넌시 삭제
  const handleDeleteTenant = async () => {
    setDeleting(true);
    
    try {
      const response = await fetch(`/api/v1/tenants/${tenantId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: 테넌시 삭제 실패`);
      }

      setSnackbarMessage('테넌시가 성공적으로 삭제되었습니다');
      setSnackbarOpen(true);
      
      // WebSocket 연결 해제
      if (wsRef.current) {
        wsRef.current.close(1000, '테넌시 삭제됨');
      }

      // 부모 컴포넌트에 알림
      if (onTenantDeleted) {
        setTimeout(() => onTenantDeleted(), 1500);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '테넌시 삭제 실패';
      setError(errorMessage);
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  // 컴포넌트 마운트/언마운트 처리
  useEffect(() => {
    fetchTenantInfo();
    connectWebSocket();

    // 자동 새로고침 (30초마다)
    refreshIntervalRef.current = setInterval(fetchTenantInfo, 30000);

    return () => {
      // 정리
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, '컴포넌트 언마운트');
      }
    };
  }, [fetchTenantInfo, connectWebSocket]);

  // 상태 아이콘 가져오기
  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
        return <CheckCircleIcon color="success" />;
      case 'pending':
        return <PendingIcon color="warning" />;
      default:
        return <ErrorIcon color="error" />;
    }
  };

  // 프로그레스 바 색상
  const getProgressColor = (value: number, thresholds: { warning: number; error: number }) => {
    if (value >= thresholds.error) return 'error';
    if (value >= thresholds.warning) return 'warning';
    return 'success';
  };

  // 로딩 상태
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ ml: 2 }}>
          테넌시 정보 로딩 중...
        </Typography>
      </Box>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        <AlertTitle>오류</AlertTitle>
        {error}
        <Box sx={{ mt: 2 }}>
          <Button variant="outlined" onClick={fetchTenantInfo} startIcon={<RefreshIcon />}>
            다시 시도
          </Button>
        </Box>
      </Alert>
    );
  }

  // 테넌시 정보가 없는 경우
  if (!tenantInfo) {
    return (
      <Alert severity="warning">
        <AlertTitle>테넌시 없음</AlertTitle>
        테넌시 정보를 찾을 수 없습니다.
      </Alert>
    );
  }

  return (
    <Box>
      {/* 헤더 섹션 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12}>
          <DashboardCard>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box display="flex" alignItems="center">
                  <Typography variant="h4" fontWeight="bold" sx={{ mr: 2 }}>
                    📋 {tenantInfo.tenant_id}
                  </Typography>
                  <StatusChip 
                    label={tenantInfo.status}
                    status={tenantInfo.status}
                    icon={getStatusIcon(tenantInfo.status)}
                  />
                  <Box sx={{ ml: 2, display: 'flex', alignItems: 'center' }}>
                    <NetworkCheckIcon 
                      color={wsConnected ? 'success' : 'error'} 
                      sx={{ fontSize: 20, mr: 0.5 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {wsConnected ? '실시간 연결됨' : '연결 끊어짐'}
                    </Typography>
                  </Box>
                </Box>
                
                {/* 빠른 액션 버튼 */}
                <Box display="flex" gap={1}>
                  <Tooltip title="새로고침">
                    <IconButton onClick={fetchTenantInfo} disabled={loading}>
                      <RefreshIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="설정">
                    <IconButton color="primary">
                      <SettingsIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="모니터링">
                    <IconButton color="info">
                      <TimelineIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="삭제">
                    <IconButton 
                      color="error" 
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </CardContent>
          </DashboardCard>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* SLA 메트릭 */}
        <Grid item xs={12} md={6}>
          <DashboardCard>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                📊 SLA 메트릭
                <Tooltip title="서비스 수준 협약 지표">
                  <VisibilityIcon sx={{ ml: 1, fontSize: 20, color: 'text.secondary' }} />
                </Tooltip>
              </Typography>
              
              <Box sx={{ mt: 2 }}>
                <Box sx={{ mb: 3 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="body2" fontWeight="medium">
                      가용률 (Availability)
                    </Typography>
                    <Typography variant="h6" color="primary.main" fontWeight="bold">
                      {tenantInfo.sla_metrics.availability?.toFixed(1) || '0.0'}%
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={tenantInfo.sla_metrics.availability || 0} 
                    color={getProgressColor(tenantInfo.sla_metrics.availability || 0, { warning: 95, error: 90 })}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="body2" fontWeight="medium">
                      응답 시간 (Response Time)
                    </Typography>
                    <Typography variant="h6" color="secondary.main" fontWeight="bold">
                      {tenantInfo.sla_metrics.response_time?.toFixed(0) || '0'}ms
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={Math.max(0, 100 - ((tenantInfo.sla_metrics.response_time || 0) / 10))}
                    color={getProgressColor(tenantInfo.sla_metrics.response_time || 0, { warning: 300, error: 500 })}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <MetricCard>
                      <Typography variant="caption" color="text.secondary">
                        에러율
                      </Typography>
                      <Typography variant="h6" fontWeight="bold">
                        {tenantInfo.sla_metrics.error_rate?.toFixed(2) || '0.00'}%
                      </Typography>
                    </MetricCard>
                  </Grid>
                  <Grid item xs={6}>
                    <MetricCard>
                      <Typography variant="caption" color="text.secondary">
                        처리량
                      </Typography>
                      <Typography variant="h6" fontWeight="bold">
                        {tenantInfo.sla_metrics.throughput || 0}req/min
                      </Typography>
                    </MetricCard>
                  </Grid>
                </Grid>
              </Box>
            </CardContent>
          </DashboardCard>
        </Grid>

        {/* 실시간 리소스 현황 */}
        <Grid item xs={12} md={6}>
          <DashboardCard>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                💻 실시간 리소스 현황
                {realtimeMetrics && (
                  <Chip 
                    label="LIVE" 
                    color="error" 
                    size="small" 
                    sx={{ ml: 1, animation: 'pulse 2s infinite' }}
                  />
                )}
              </Typography>

              {realtimeMetrics ? (
                <Box sx={{ mt: 2 }}>
                  <Box sx={{ mb: 2 }}>
                    <Box display="flex" alignItems="center" mb={1}>
                      <SpeedIcon sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="body2" fontWeight="medium">
                        CPU 사용률: {realtimeMetrics.cpu_usage?.toFixed(1) || '0.0'}%
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={realtimeMetrics.cpu_usage || 0}
                      color={getProgressColor(realtimeMetrics.cpu_usage || 0, { warning: 70, error: 90 })}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Box display="flex" alignItems="center" mb={1}>
                      <MemoryIcon sx={{ mr: 1, color: 'secondary.main' }} />
                      <Typography variant="body2" fontWeight="medium">
                        메모리 사용률: {realtimeMetrics.memory_usage?.toFixed(1) || '0.0'}%
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={realtimeMetrics.memory_usage || 0}
                      color={getProgressColor(realtimeMetrics.memory_usage || 0, { warning: 80, error: 95 })}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Box display="flex" alignItems="center" mb={1}>
                      <StorageIcon sx={{ mr: 1, color: 'success.main' }} />
                      <Typography variant="body2" fontWeight="medium">
                        GPU 사용률: {realtimeMetrics.gpu_usage?.toFixed(1) || '0.0'}%
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={realtimeMetrics.gpu_usage || 0}
                      color={getProgressColor(realtimeMetrics.gpu_usage || 0, { warning: 80, error: 95 })}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  </Box>

                  <Grid container spacing={1} sx={{ mt: 1 }}>
                    <Grid item xs={4}>
                      <MetricCard>
                        <Typography variant="caption">활성 연결</Typography>
                        <Typography variant="h6">{realtimeMetrics.active_connections || 0}</Typography>
                      </MetricCard>
                    </Grid>
                    <Grid item xs={4}>
                      <MetricCard>
                        <Typography variant="caption">Network RX</Typography>
                        <Typography variant="h6">{realtimeMetrics.network_io?.rx?.toFixed(1) || '0.0'}MB/s</Typography>
                      </MetricCard>
                    </Grid>
                    <Grid item xs={4}>
                      <MetricCard>
                        <Typography variant="caption">Network TX</Typography>
                        <Typography variant="h6">{realtimeMetrics.network_io?.tx?.toFixed(1) || '0.0'}MB/s</Typography>
                      </MetricCard>
                    </Grid>
                  </Grid>
                </Box>
              ) : (
                <Box display="flex" alignItems="center" justifyContent="center" py={4}>
                  <CircularProgress size={24} sx={{ mr: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    실시간 메트릭 로딩 중...
                  </Typography>
                </Box>
              )}
            </CardContent>
          </DashboardCard>
        </Grid>

        {/* 서비스별 상태 */}
        <Grid item xs={12}>
          <DashboardCard>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🛠️ 서비스 상태
              </Typography>
              
              <Grid container spacing={2}>
                {tenantInfo.services.map((service, index) => (
                  <Grid item xs={12} md={4} key={index}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardContent>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                          <Typography variant="h6" fontWeight="medium">
                            {service.name}
                          </Typography>
                          <StatusChip 
                            size="small"
                            label={service.status}
                            status={service.status}
                          />
                        </Box>
                        
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Replicas: {service.replicas.available} / {service.replicas.desired}
                          {service.replicas.ready !== service.replicas.available && (
                            <> (Ready: {service.replicas.ready})</>
                          )}
                        </Typography>
                        
                        <LinearProgress 
                          variant="determinate" 
                          value={(service.replicas.available / service.replicas.desired) * 100}
                          color={service.replicas.available === service.replicas.desired ? 'success' : 'warning'}
                          sx={{ mt: 1, height: 6, borderRadius: 3 }}
                        />

                        {service.resources && (
                          <Box sx={{ mt: 2 }}>
                            <Typography variant="caption" display="block">
                              CPU: {service.resources.cpu_usage?.toFixed(1) || 'N/A'}% | 
                              Memory: {service.resources.memory_usage?.toFixed(1) || 'N/A'}%
                            </Typography>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </DashboardCard>
        </Grid>
      </Grid>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
          <WarningIcon color="error" sx={{ mr: 1 }} />
          테넌시 삭제 확인
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            정말로 테넌시 '<strong>{tenantId}</strong>'를 삭제하시겠습니까?
            <br /><br />
            이 작업은 되돌릴 수 없으며, 모든 관련 리소스가 영구적으로 삭제됩니다.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            취소
          </Button>
          <Button 
            onClick={handleDeleteTenant} 
            color="error" 
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            {deleting ? '삭제 중...' : '삭제'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 스낵바 */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
      />
    </Box>
  );
};
