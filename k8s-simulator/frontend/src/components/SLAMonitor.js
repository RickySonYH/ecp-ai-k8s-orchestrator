// [advice from AI] SLA 모니터링 컴포넌트 - SLA 99.5% 달성 현황 및 리포트
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Divider
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { useApi } from '../hooks/useApi';

const SLAMonitor = () => {
  const [slaStatus, setSlaStatus] = useState(null);
  const [slaReport, setSlaReport] = useState(null);
  const [reportPeriod, setReportPeriod] = useState(7); // days
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { get } = useApi();

  useEffect(() => {
    loadSLAData();
  }, [reportPeriod]);

  useEffect(() => {
    // 30초마다 SLA 상태 업데이트
    const interval = setInterval(() => {
      loadSLAStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadSLAData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // SLA 상태와 리포트 동시 로드
      const [statusResult, reportResult] = await Promise.all([
        get('/sla/status'),
        get(`/sla/report?days=${reportPeriod}`)
      ]);
      
      setSlaStatus(statusResult.sla);
      setSlaReport(reportResult);
      
    } catch (err) {
      setError(`SLA 데이터 로드 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadSLAStatus = async () => {
    try {
      const result = await get('/sla/status');
      setSlaStatus(result.sla);
    } catch (err) {
      console.error('Failed to update SLA status:', err);
    }
  };

  const getSLAStatusColor = (status) => {
    switch (status) {
      case 'meeting':
        return 'success';
      case 'at_risk':
        return 'warning';
      case 'breached':
        return 'error';
      default:
        return 'default';
    }
  };

  const getSLAStatusIcon = (status) => {
    switch (status) {
      case 'meeting':
        return <CheckCircleIcon color="success" />;
      case 'at_risk':
        return <WarningIcon color="warning" />;
      case 'breached':
        return <ErrorIcon color="error" />;
      default:
        return <ScheduleIcon color="disabled" />;
    }
  };

  const getSLAStatusText = (status) => {
    switch (status) {
      case 'meeting':
        return 'SLA 달성 중';
      case 'at_risk':
        return 'SLA 위험';
      case 'breached':
        return 'SLA 위반';
      default:
        return '상태 불명';
    }
  };

  const formatUptime = (percentage) => {
    if (!percentage) return 'N/A';
    
    const downtime = (100 - percentage) / 100;
    const downtimeMinutes = Math.round(downtime * 24 * 60 * reportPeriod);
    
    if (downtimeMinutes < 60) {
      return `${downtimeMinutes}분 다운타임`;
    } else {
      const hours = Math.floor(downtimeMinutes / 60);
      const minutes = downtimeMinutes % 60;
      return `${hours}시간 ${minutes}분 다운타임`;
    }
  };

  const getChartData = () => {
    if (!slaReport || !slaReport.daily_data) return [];
    
    return slaReport.daily_data.map(day => ({
      date: new Date(day.date).toLocaleDateString(),
      availability: day.availability_percentage,
      incidents: day.incidents,
      mttr: day.mttr_minutes
    }));
  };

  if (loading && !slaStatus) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <Typography>SLA 데이터를 로딩 중...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        SLA 모니터링 (목표: 99.5%)
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* 현재 SLA 상태 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                {getSLAStatusIcon(slaStatus?.status)}
                <Typography variant="h6" sx={{ ml: 1 }}>
                  현재 SLA 상태
                </Typography>
              </Box>
              
              <Typography variant="h3" color={`${getSLAStatusColor(slaStatus?.status)}.main`}>
                {slaStatus?.percentage?.toFixed(3) || '0.000'}%
              </Typography>
              
              <Chip
                label={getSLAStatusText(slaStatus?.status)}
                color={getSLAStatusColor(slaStatus?.status)}
                sx={{ mt: 1 }}
              />
              
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                데이터 포인트: {slaStatus?.data_points || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                SLA 목표 달성률
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, (slaStatus?.percentage || 0) / 99.5 * 100)}
                  color={getSLAStatusColor(slaStatus?.status)}
                  sx={{ height: 10, borderRadius: 5 }}
                />
              </Box>
              
              <Typography variant="body2" color="textSecondary">
                목표 대비: {slaStatus?.percentage >= 99.5 ? '달성' : `${(99.5 - (slaStatus?.percentage || 0)).toFixed(3)}% 부족`}
              </Typography>
              
              <Typography variant="body2" color="textSecondary">
                정상 포인트: {slaStatus?.healthy_points || 0}/{slaStatus?.data_points || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                기간별 리포트
              </Typography>
              
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>조회 기간</InputLabel>
                <Select
                  value={reportPeriod}
                  label="조회 기간"
                  onChange={(e) => setReportPeriod(e.target.value)}
                >
                  <MenuItem value={1}>1일</MenuItem>
                  <MenuItem value={7}>7일</MenuItem>
                  <MenuItem value={30}>30일</MenuItem>
                </Select>
              </FormControl>
              
              {slaReport && (
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    평균 가용성: {slaReport.summary?.overall_availability?.toFixed(3) || '0.000'}%
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    총 인시던트: {slaReport.summary?.total_incidents || 0}건
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    평균 MTTR: {slaReport.summary?.average_mttr_minutes?.toFixed(1) || '0.0'}분
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* SLA 트렌드 차트 */}
      {slaReport && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                가용성 트렌드 ({reportPeriod}일)
              </Typography>
              
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={getChartData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[99, 100]} />
                  <Tooltip formatter={(value) => [`${value.toFixed(3)}%`, '가용성']} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="availability"
                    stroke="#8884d8"
                    strokeWidth={2}
                    dot={{ fill: '#8884d8', strokeWidth: 2, r: 4 }}
                  />
                  {/* SLA 목표선 */}
                  <Line
                    type="monotone"
                    data={getChartData().map(d => ({ ...d, target: 99.5 }))}
                    dataKey="target"
                    stroke="#ff7c7c"
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                인시던트 및 MTTR
              </Typography>
              
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={getChartData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="incidents"
                    stackId="1"
                    stroke="#82ca9d"
                    fill="#82ca9d"
                    name="인시던트 수"
                  />
                  <Area
                    type="monotone"
                    dataKey="mttr"
                    stackId="2"
                    stroke="#ffc658"
                    fill="#ffc658"
                    name="MTTR (분)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* 상세 SLA 리포트 테이블 */}
      {slaReport && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            일별 SLA 상세 리포트
          </Typography>
          
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>날짜</TableCell>
                  <TableCell align="right">가용성</TableCell>
                  <TableCell align="right">SLA 상태</TableCell>
                  <TableCell align="right">인시던트</TableCell>
                  <TableCell align="right">MTTR</TableCell>
                  <TableCell align="right">다운타임</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {slaReport.daily_data?.map((day, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {new Date(day.date).toLocaleDateString()}
                    </TableCell>
                    
                    <TableCell align="right">
                      <Typography
                        color={day.availability_percentage >= 99.5 ? 'success.main' : day.availability_percentage >= 99.0 ? 'warning.main' : 'error.main'}
                        fontWeight="bold"
                      >
                        {day.availability_percentage.toFixed(3)}%
                      </Typography>
                    </TableCell>
                    
                    <TableCell align="right">
                      <Chip
                        label={day.availability_percentage >= 99.5 ? '달성' : day.availability_percentage >= 99.0 ? '위험' : '위반'}
                        color={day.availability_percentage >= 99.5 ? 'success' : day.availability_percentage >= 99.0 ? 'warning' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    
                    <TableCell align="right">
                      {day.incidents}건
                    </TableCell>
                    
                    <TableCell align="right">
                      {day.mttr_minutes > 0 ? `${day.mttr_minutes}분` : '-'}
                    </TableCell>
                    
                    <TableCell align="right">
                      <Typography variant="body2" color="textSecondary">
                        {formatUptime(day.availability_percentage)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Divider sx={{ my: 2 }} />
          
          {/* 요약 정보 */}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={3}>
              <Box textAlign="center">
                <Typography variant="h6" color="primary">
                  {slaReport.summary?.overall_availability?.toFixed(3) || '0.000'}%
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  평균 가용성
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={3}>
              <Box textAlign="center">
                <Typography variant="h6" color={slaReport.summary?.sla_met ? 'success.main' : 'error.main'}>
                  {slaReport.summary?.sla_met ? '달성' : '미달성'}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  SLA 목표
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={3}>
              <Box textAlign="center">
                <Typography variant="h6">
                  {slaReport.summary?.total_incidents || 0}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  총 인시던트
                </Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={3}>
              <Box textAlign="center">
                <Typography variant="h6">
                  {slaReport.summary?.average_mttr_minutes?.toFixed(1) || '0.0'}분
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  평균 MTTR
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}
    </Box>
  );
};

export default SLAMonitor;
