// [advice from AI] 대시보드 차트 컴포넌트 - 실제 데이터 기반 차트
/**
 * DashboardCharts Component
 * - 실시간 통계 데이터 시각화
 * - recharts 라이브러리 사용
 */

import React from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  useTheme
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ResponsiveContainer
} from 'recharts';

interface DashboardChartsProps {
  statistics: {
    overview?: any;
    images?: any;
    services?: any;
    tenants?: any;
    resources?: any;
  };
}

const DashboardCharts: React.FC<DashboardChartsProps> = ({ statistics }) => {
  const theme = useTheme();
  
  const COLORS = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.error.main,
    theme.palette.info.main
  ];

  // 리소스 사용량 데이터 준비
  const prepareResourceData = () => {
    if (!statistics.resources) return [];
    
    const { total_resources, allocated_resources } = statistics.resources;
    
    return [
      {
        name: 'CPU',
        total: total_resources?.cpu || 0,
        allocated: allocated_resources?.cpu || 0,
        available: (total_resources?.cpu || 0) - (allocated_resources?.cpu || 0)
      },
      {
        name: 'Memory',
        total: total_resources?.memory || 0,
        allocated: allocated_resources?.memory || 0,
        available: (total_resources?.memory || 0) - (allocated_resources?.memory || 0)
      },
      {
        name: 'GPU',
        total: total_resources?.gpu || 0,
        allocated: allocated_resources?.gpu || 0,
        available: (total_resources?.gpu || 0) - (allocated_resources?.gpu || 0)
      }
    ];
  };

  // 테넌트 분포 데이터 준비
  const prepareTenantDistributionData = () => {
    if (!statistics.tenants?.tenant_distribution) return [];
    
    return Object.entries(statistics.tenants.tenant_distribution).map(([name, value]) => ({
      name,
      value
    }));
  };

  // 서비스 배포 현황 데이터 준비
  const prepareServiceDeploymentData = () => {
    if (!statistics.services?.service_distribution) return [];
    
    return Object.entries(statistics.services.service_distribution).map(([name, value]) => ({
      name,
      value
    }));
  };

  // 이미지 타입 분포 데이터 준비
  const prepareImageTypeData = () => {
    if (!statistics.images?.category_stats) return [];
    
    return Object.entries(statistics.images.category_stats).map(([name, value]) => ({
      name,
      value
    }));
  };

  const resourceData = prepareResourceData();
  const tenantDistributionData = prepareTenantDistributionData();
  const serviceDeploymentData = prepareServiceDeploymentData();
  const imageTypeData = prepareImageTypeData();

  return (
    <Grid container spacing={3}>
      {/* 리소스 사용량 차트 */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              리소스 사용량
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={resourceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="allocated" fill={COLORS[0]} name="할당됨" />
                <Bar dataKey="available" fill={COLORS[1]} name="사용가능" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Grid>

      {/* 테넌트 분포 차트 */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              테넌트 분포
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={tenantDistributionData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label
                >
                  {tenantDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Grid>

      {/* 서비스 배포 현황 */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              서비스 배포 현황
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={serviceDeploymentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill={COLORS[2]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Grid>

      {/* 이미지 타입 분포 */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              이미지 타입 분포
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={imageTypeData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label
                >
                  {imageTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default DashboardCharts;