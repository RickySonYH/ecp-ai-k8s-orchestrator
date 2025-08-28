// [advice from AI] 메트릭 차트 컴포넌트 - 실시간 성능 데이터 시각화
import React, { useState, useEffect } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Chip
} from '@mui/material';
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
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useApi } from '../hooks/useApi';

const MetricsCharts = ({ systemHealth, wsData }) => {
  const [selectedService, setSelectedService] = useState('');
  const [metricsHistory, setMetricsHistory] = useState([]);
  const [timeRange, setTimeRange] = useState(1); // hours
  const [loading, setLoading] = useState(false);

  const { get } = useApi();

  useEffect(() => {
    loadMetricsHistory();
  }, [timeRange, selectedService]);

  useEffect(() => {
    // WebSocket 데이터로 실시간 업데이트
    if (wsData && wsData.type === 'metrics_update') {
      const newDataPoint = {
        timestamp: new Date().toLocaleTimeString(),
        ...wsData.data.services
      };
      
      setMetricsHistory(prev => {
        const updated = [...prev, newDataPoint];
        // 최근 50개 데이터포인트만 유지
        return updated.slice(-50);
      });
    }
  }, [wsData]);

  const loadMetricsHistory = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        hours: timeRange.toString()
      });
      if (selectedService) {
        params.append('service', selectedService);
      }
      
      const result = await get(`/monitoring/metrics/history?${params.toString()}`);
      
      // 차트용 데이터 변환
      const chartData = result.history?.map(entry => ({
        timestamp: new Date(entry.timestamp).toLocaleTimeString(),
        ...entry.data.services
      })) || [];
      
      setMetricsHistory(chartData);
      
    } catch (err) {
      console.error('Failed to load metrics history:', err);
    } finally {
      setLoading(false);
    }
  };

  const getServiceNames = () => {
    if (!systemHealth || !systemHealth.services) return [];
    return Object.keys(systemHealth.services).filter(name => name !== 'cluster');
  };

  const formatTooltipValue = (value, name) => {
    if (typeof value !== 'number') return [value, name];
    
    if (name.includes('percent') || name.includes('usage')) {
      return [`${value.toFixed(1)}%`, name];
    } else if (name.includes('mb') || name.includes('MB')) {
      return [`${value.toFixed(1)} MB`, name];
    } else if (name.includes('ms')) {
      return [`${value.toFixed(1)} ms`, name];
    } else if (name.includes('rps') || name.includes('requests')) {
      return [`${value.toFixed(0)} req/s`, name];
    }
    
    return [value.toFixed(1), name];
  };

  const getCurrentMetrics = () => {
    if (!systemHealth || !systemHealth.services) return {};
    return systemHealth.services;
  };

  const getChartData = (metricPath) => {
    return metricsHistory.map(entry => {
      const result = { timestamp: entry.timestamp };
      
      Object.keys(entry).forEach(serviceName => {
        if (serviceName === 'timestamp' || serviceName === 'cluster') return;
        
        const serviceData = entry[serviceName];
        if (serviceData && typeof serviceData === 'object') {
          const pathParts = metricPath.split('.');
          let value = serviceData;
          
          for (const part of pathParts) {
            value = value?.[part];
            if (value === undefined) break;
          }
          
          if (typeof value === 'number') {
            result[serviceName] = value;
          }
        }
      });
      
      return result;
    });
  };

  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];

  const pieChartData = () => {
    const services = getCurrentMetrics();
    return Object.entries(services)
      .filter(([name]) => name !== 'cluster')
      .map(([name, data], index) => ({
        name,
        value: data.cpu?.usage_percent || 0,
        color: colors[index % colors.length]
      }));
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">메트릭 차트</Typography>
        
        <Box display="flex" gap={2}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>시간 범위</InputLabel>
            <Select
              value={timeRange}
              label="시간 범위"
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <MenuItem value={1}>1시간</MenuItem>
              <MenuItem value={6}>6시간</MenuItem>
              <MenuItem value={24}>24시간</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>서비스 필터</InputLabel>
            <Select
              value={selectedService}
              label="서비스 필터"
              onChange={(e) => setSelectedService(e.target.value)}
            >
              <MenuItem value="">전체 서비스</MenuItem>
              {getServiceNames().map(name => (
                <MenuItem key={name} value={name}>{name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* 실시간 상태 카드 */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {Object.entries(getCurrentMetrics()).map(([serviceName, serviceData]) => {
          if (serviceName === 'cluster') return null;
          
          const health = serviceData.health || {};
          const cpu = serviceData.cpu || {};
          const memory = serviceData.memory || {};
          const network = serviceData.network || {};
          
          return (
            <Grid item xs={12} sm={6} md={4} key={serviceName}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="h6">{serviceName}</Typography>
                    <Chip
                      label={health.status || 'unknown'}
                      color={health.status === 'healthy' ? 'success' : health.status === 'warning' ? 'warning' : 'error'}
                      size="small"
                    />
                  </Box>
                  
                  <Typography variant="body2" color="textSecondary">
                    CPU: {cpu.usage_percent?.toFixed(1) || '0'}%
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Memory: {memory.usage_percent?.toFixed(1) || '0'}%
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    RPS: {network.requests_per_second?.toFixed(0) || '0'}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Response: {network.response_time_ms?.toFixed(0) || '0'}ms
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* 차트 그리드 */}
      <Grid container spacing={3}>
        {/* CPU 사용률 차트 */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>CPU 사용률</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={getChartData('cpu.usage_percent')}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip formatter={formatTooltipValue} />
                <Legend />
                {getServiceNames().map((serviceName, index) => (
                  <Line
                    key={serviceName}
                    type="monotone"
                    dataKey={serviceName}
                    stroke={colors[index % colors.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* 메모리 사용률 차트 */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>메모리 사용률</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={getChartData('memory.usage_percent')}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip formatter={formatTooltipValue} />
                <Legend />
                {getServiceNames().map((serviceName, index) => (
                  <Area
                    key={serviceName}
                    type="monotone"
                    dataKey={serviceName}
                    stackId="1"
                    stroke={colors[index % colors.length]}
                    fill={colors[index % colors.length]}
                    fillOpacity={0.6}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* 네트워크 RPS 차트 */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>초당 요청 수 (RPS)</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={getChartData('network.requests_per_second')}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip formatter={formatTooltipValue} />
                <Legend />
                {getServiceNames().map((serviceName, index) => (
                  <Bar
                    key={serviceName}
                    dataKey={serviceName}
                    fill={colors[index % colors.length]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* 응답 시간 차트 */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>응답 시간 (ms)</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={getChartData('network.response_time_ms')}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip formatter={formatTooltipValue} />
                <Legend />
                {getServiceNames().map((serviceName, index) => (
                  <Line
                    key={serviceName}
                    type="monotone"
                    dataKey={serviceName}
                    stroke={colors[index % colors.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* CPU 사용률 분포 파이 차트 */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>현재 CPU 사용률 분포</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieChartData()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieChartData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value.toFixed(1)}%`, 'CPU 사용률']} />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* 에러율 차트 */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>에러율 (%)</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={getChartData('network.error_rate_percent')}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip formatter={formatTooltipValue} />
                <Legend />
                {getServiceNames().map((serviceName, index) => (
                  <Line
                    key={serviceName}
                    type="monotone"
                    dataKey={serviceName}
                    stroke={colors[index % colors.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default MetricsCharts;
