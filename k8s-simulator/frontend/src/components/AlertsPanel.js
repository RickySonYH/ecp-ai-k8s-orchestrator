// [advice from AI] 알림 관리 패널 - 알림 히스토리 및 규칙 관리
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Badge,
  Tooltip,
  Pagination
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  NotificationsActive as NotificationsActiveIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import { useApi } from '../hooks/useApi';

const AlertsPanel = () => {
  const [alerts, setAlerts] = useState([]);
  const [alertStats, setAlertStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    hours: 24,
    severity: ''
  });
  const [ruleDialog, setRuleDialog] = useState({ open: false });
  const [newRule, setNewRule] = useState({
    name: '',
    metric: 'cpu_usage',
    threshold: 80,
    operator: 'gt',
    severity: 'warning',
    enabled: true
  });

  const { get, post } = useApi();

  useEffect(() => {
    loadAlerts();
  }, [filters, page]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        hours: filters.hours.toString()
      });
      if (filters.severity) {
        params.append('severity', filters.severity);
      }
      
      const result = await get(`/sla/alerts/history?${params.toString()}`);
      setAlerts(result.alerts || []);
      
      // 알림 통계 계산
      const stats = calculateAlertStats(result.alerts || []);
      setAlertStats(stats);
      
    } catch (err) {
      setError(`알림 데이터 로드 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const calculateAlertStats = (alertsData) => {
    const stats = {
      total: alertsData.length,
      critical: 0,
      warning: 0,
      info: 0,
      resolved: 0,
      unresolved: 0,
      avgResolutionTime: 0
    };

    let totalResolutionTime = 0;
    let resolvedCount = 0;

    alertsData.forEach(alert => {
      // 심각도별 카운트
      if (alert.severity === 'critical') stats.critical++;
      else if (alert.severity === 'warning') stats.warning++;
      else if (alert.severity === 'info') stats.info++;

      // 해결 상태별 카운트
      if (alert.resolved) {
        stats.resolved++;
        if (alert.resolution_time) {
          totalResolutionTime += alert.resolution_time;
          resolvedCount++;
        }
      } else {
        stats.unresolved++;
      }
    });

    // 평균 해결 시간 계산
    if (resolvedCount > 0) {
      stats.avgResolutionTime = Math.round(totalResolutionTime / resolvedCount);
    }

    return stats;
  };

  const handleCreateRule = async () => {
    try {
      setError(null);
      
      await post('/sla/alerts/rules', newRule);
      
      setRuleDialog({ open: false });
      setNewRule({
        name: '',
        metric: 'cpu_usage',
        threshold: 80,
        operator: 'gt',
        severity: 'warning',
        enabled: true
      });
      
      // 성공 메시지는 API에서 처리됨
      
    } catch (err) {
      setError(`알림 규칙 생성 실패: ${err.message}`);
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'info':
        return <InfoIcon color="info" />;
      default:
        return <NotificationsIcon />;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'default';
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (minutes) => {
    if (!minutes) return 'N/A';
    if (minutes < 60) return `${minutes}분`;
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}시간 ${mins}분`;
  };

  const itemsPerPage = 10;
  const totalPages = Math.ceil(alerts.length / itemsPerPage);
  const paginatedAlerts = alerts.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">알림 관리</Typography>
        
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadAlerts}
            disabled={loading}
          >
            새로고침
          </Button>
          
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setRuleDialog({ open: true })}
          >
            알림 규칙 추가
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* 알림 통계 카드 */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Badge badgeContent={alertStats.total} color="primary" max={999}>
                <NotificationsIcon color="primary" sx={{ fontSize: 40 }} />
              </Badge>
              <Typography variant="h6" sx={{ mt: 1 }}>
                {alertStats.total || 0}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                총 알림
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <ErrorIcon color="error" sx={{ fontSize: 40 }} />
              <Typography variant="h6" sx={{ mt: 1 }}>
                {alertStats.critical || 0}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Critical
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <WarningIcon color="warning" sx={{ fontSize: 40 }} />
              <Typography variant="h6" sx={{ mt: 1 }}>
                {alertStats.warning || 0}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Warning
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <CheckCircleIcon color="success" sx={{ fontSize: 40 }} />
              <Typography variant="h6" sx={{ mt: 1 }}>
                {alertStats.resolved || 0}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                해결됨
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <NotificationsActiveIcon color="error" sx={{ fontSize: 40 }} />
              <Typography variant="h6" sx={{ mt: 1 }}>
                {alertStats.unresolved || 0}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                미해결
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h6" color="primary">
                {formatDuration(alertStats.avgResolutionTime)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                평균 해결시간
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 필터 섹션 */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" alignItems="center" gap={2}>
          <FilterIcon />
          <Typography variant="h6">필터</Typography>
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>기간</InputLabel>
            <Select
              value={filters.hours}
              label="기간"
              onChange={(e) => setFilters(prev => ({ ...prev, hours: e.target.value }))}
            >
              <MenuItem value={1}>1시간</MenuItem>
              <MenuItem value={6}>6시간</MenuItem>
              <MenuItem value={24}>24시간</MenuItem>
              <MenuItem value={168}>7일</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>심각도</InputLabel>
            <Select
              value={filters.severity}
              label="심각도"
              onChange={(e) => setFilters(prev => ({ ...prev, severity: e.target.value }))}
            >
              <MenuItem value="">전체</MenuItem>
              <MenuItem value="critical">Critical</MenuItem>
              <MenuItem value="warning">Warning</MenuItem>
              <MenuItem value="info">Info</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* 알림 히스토리 테이블 */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>시간</TableCell>
                <TableCell>심각도</TableCell>
                <TableCell>서비스</TableCell>
                <TableCell>메시지</TableCell>
                <TableCell>상태</TableCell>
                <TableCell>해결 시간</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedAlerts.map((alert, index) => (
                <TableRow key={alert.id || index} hover>
                  <TableCell>
                    <Typography variant="body2">
                      {formatTimestamp(alert.timestamp)}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      {getSeverityIcon(alert.severity)}
                      <Chip
                        label={alert.severity.toUpperCase()}
                        color={getSeverityColor(alert.severity)}
                        size="small"
                      />
                    </Box>
                  </TableCell>
                  
                  <TableCell>
                    <Chip
                      label={alert.service}
                      variant="outlined"
                      size="small"
                    />
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2">
                      {alert.message}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Chip
                      label={alert.resolved ? '해결됨' : '미해결'}
                      color={alert.resolved ? 'success' : 'error'}
                      size="small"
                    />
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2" color="textSecondary">
                      {alert.resolved && alert.resolution_time 
                        ? formatDuration(alert.resolution_time)
                        : '-'
                      }
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <Box display="flex" justifyContent="center" p={2}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(e, value) => setPage(value)}
              color="primary"
            />
          </Box>
        )}
      </Paper>

      {/* 알림 규칙 생성 다이얼로그 */}
      <Dialog
        open={ruleDialog.open}
        onClose={() => setRuleDialog({ open: false })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>새 알림 규칙 생성</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} sx={{ mt: 1 }}>
            <TextField
              label="규칙 이름"
              value={newRule.name}
              onChange={(e) => setNewRule(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
            />
            
            <FormControl fullWidth>
              <InputLabel>메트릭</InputLabel>
              <Select
                value={newRule.metric}
                label="메트릭"
                onChange={(e) => setNewRule(prev => ({ ...prev, metric: e.target.value }))}
              >
                <MenuItem value="cpu_usage">CPU 사용률</MenuItem>
                <MenuItem value="memory_usage">메모리 사용률</MenuItem>
                <MenuItem value="error_rate">에러율</MenuItem>
                <MenuItem value="response_time">응답 시간</MenuItem>
              </Select>
            </FormControl>
            
            <TextField
              label="임계값"
              type="number"
              value={newRule.threshold}
              onChange={(e) => setNewRule(prev => ({ ...prev, threshold: parseFloat(e.target.value) }))}
              fullWidth
            />
            
            <FormControl fullWidth>
              <InputLabel>조건</InputLabel>
              <Select
                value={newRule.operator}
                label="조건"
                onChange={(e) => setNewRule(prev => ({ ...prev, operator: e.target.value }))}
              >
                <MenuItem value="gt">초과 (&gt;)</MenuItem>
                <MenuItem value="lt">미만 (&lt;)</MenuItem>
                <MenuItem value="eq">같음 (=)</MenuItem>
              </Select>
            </FormControl>
            
            <FormControl fullWidth>
              <InputLabel>심각도</InputLabel>
              <Select
                value={newRule.severity}
                label="심각도"
                onChange={(e) => setNewRule(prev => ({ ...prev, severity: e.target.value }))}
              >
                <MenuItem value="info">Info</MenuItem>
                <MenuItem value="warning">Warning</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRuleDialog({ open: false })}>
            취소
          </Button>
          <Button 
            variant="contained" 
            onClick={handleCreateRule}
            disabled={!newRule.name.trim()}
          >
            생성
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AlertsPanel;
