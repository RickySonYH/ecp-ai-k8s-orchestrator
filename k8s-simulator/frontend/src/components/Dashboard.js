// [advice from AI] 메인 대시보드 컴포넌트 - 전체 시스템 상태 개요
import React, { useState, useEffect } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  Storage as StorageIcon,
  NetworkCheck as NetworkIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon
} from '@mui/icons-material';

const Dashboard = ({ systemHealth, wsData }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (!systemHealth) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <Typography>시스템 데이터를 로딩 중...</Typography>
      </Box>
    );
  }

  const summary = systemHealth.summary || {};
  const services = systemHealth.services || {};
  const cluster = services.cluster || {};

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy':
        return <CheckCircleIcon color="success" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'critical':
        return <ErrorIcon color="error" />;
      default:
        return <CheckCircleIcon color="disabled" />;
    }
  };

  const getProgressColor = (value, thresholds = { warning: 70, critical: 90 }) => {
    if (value >= thresholds.critical) return 'error';
    if (value >= thresholds.warning) return 'warning';
    return 'success';
  };

  return (
    <Box>
      {/* 시스템 개요 카드 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <SpeedIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">전체 상태</Typography>
              </Box>
              <Box display="flex" alignItems="center">
                {getStatusIcon(summary.overall_health)}
                <Typography variant="h4" sx={{ ml: 1 }}>
                  {summary.overall_health?.toUpperCase() || 'UNKNOWN'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                SLA 달성률
              </Typography>
              <Typography variant="h3" color={summary.sla_percentage >= 99.5 ? 'success.main' : 'warning.main'}>
                {summary.sla_percentage?.toFixed(2) || '0.00'}%
              </Typography>
              <Typography variant="body2" color="textSecondary">
                목표: 99.50%
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                총 서비스
              </Typography>
              <Typography variant="h3">
                {summary.total_services || 0}
              </Typography>
              <Typography variant="body2" color="success.main">
                정상: {summary.healthy_services || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                초당 요청
              </Typography>
              <Typography variant="h3">
                {summary.total_requests_per_second?.toFixed(0) || '0'}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                RPS
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 클러스터 리소스 사용률 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              클러스터 리소스 사용률
            </Typography>
            
            <Box sx={{ mb: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Box display="flex" alignItems="center">
                  <SpeedIcon sx={{ mr: 1 }} />
                  <Typography>CPU</Typography>
                </Box>
                <Typography variant="body2">
                  {cluster.nodes?.cpu_usage_percent?.toFixed(1) || '0.0'}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={cluster.nodes?.cpu_usage_percent || 0}
                color={getProgressColor(cluster.nodes?.cpu_usage_percent || 0)}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>

            <Box sx={{ mb: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Box display="flex" alignItems="center">
                  <MemoryIcon sx={{ mr: 1 }} />
                  <Typography>메모리</Typography>
                </Box>
                <Typography variant="body2">
                  {cluster.nodes?.memory_usage_percent?.toFixed(1) || '0.0'}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={cluster.nodes?.memory_usage_percent || 0}
                color={getProgressColor(cluster.nodes?.memory_usage_percent || 0)}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              네트워크 상태
            </Typography>
            
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography>전체 에러율</Typography>
              <Chip
                label={`${cluster.traffic?.total_error_rate?.toFixed(3) || '0.000'}%`}
                color={cluster.traffic?.total_error_rate > 1 ? 'error' : cluster.traffic?.total_error_rate > 0.1 ? 'warning' : 'success'}
                size="small"
              />
            </Box>
            
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography>총 RPS</Typography>
              <Typography variant="h6">
                {cluster.traffic?.total_rps?.toFixed(0) || '0'}
              </Typography>
            </Box>

            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography>평균 응답시간</Typography>
              <Typography variant="h6">
                {summary.average_response_time?.toFixed(0) || '0'}ms
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* 서비스별 상태 목록 */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          서비스별 상태
        </Typography>
        
        <Grid container spacing={2}>
          {Object.entries(services).map(([serviceName, serviceData]) => {
            if (serviceName === 'cluster') return null;
            
            const health = serviceData.health || {};
            const network = serviceData.network || {};
            const cpu = serviceData.cpu || {};
            const memory = serviceData.memory || {};
            
            return (
              <Grid item xs={12} sm={6} md={4} key={serviceName}>
                <Card variant="outlined">
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {serviceName}
                      </Typography>
                      {getStatusIcon(health.status)}
                    </Box>
                    
                    <List dense>
                      <ListItem disablePadding>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <SpeedIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary={`CPU: ${cpu.usage_percent?.toFixed(1) || '0.0'}%`}
                        />
                      </ListItem>
                      
                      <ListItem disablePadding>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <MemoryIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary={`Memory: ${memory.usage_percent?.toFixed(1) || '0.0'}%`}
                        />
                      </ListItem>
                      
                      <ListItem disablePadding>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <NetworkIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary={`RPS: ${network.requests_per_second?.toFixed(0) || '0'}`}
                        />
                      </ListItem>
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Paper>

      {/* 실시간 업데이트 정보 */}
      <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="body2" color="textSecondary">
          마지막 업데이트: {currentTime.toLocaleString()}
        </Typography>
        <Chip
          label={wsData ? '실시간 연결됨' : '데이터 대기 중'}
          color={wsData ? 'success' : 'default'}
          size="small"
        />
      </Box>
    </Box>
  );
};

export default Dashboard;
