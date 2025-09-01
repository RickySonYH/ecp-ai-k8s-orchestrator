// [advice from AI] Kubernetes 자동 배포 파이프라인 UI 컴포넌트
/**
 * Deployment Pipeline Component
 * 1. 테넌트 생성 (채널 → 리소스 → 서비스 리스트)
 * 2. 이미지 선택 (필요 서비스별 이미지 태그)
 * 3. 파이프라인 선택 (배포 전략, 환경)
 * 4. 매니페스트 생성 → K8S 배포 → 모니터링 → 롤백
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  Card,
  CardContent,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon,
  Settings as SettingsIcon,
  CloudUpload as DeployIcon,
  Visibility as MonitorIcon,
  History as RollbackIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

// 타입 정의
interface TenantConfig {
  tenant_id: string;
  channels: number;
  concurrent_calls: number;
  service_requirements: {
    [key: string]: {
      cpu_cores: number;
      memory_gb: number;
      replicas: number;
    };
  };
}

interface ServiceImageSelection {
  service_name: string;
  display_name: string;
  current_tag: string;
  available_tags: string[];
  selected_tag: string;
  category: string;
}

interface PipelineConfig {
  deployment_strategy: string;
  namespace: string;
  environment: string;
  rollout_settings: {
    max_unavailable: number;
    max_surge: number;
  };
  health_check: {
    enabled: boolean;
    path: string;
    initial_delay: number;
  };
}

interface DeploymentStatus {
  deployment_id: string;
  service_name: string;
  status: string;
  progress: number;
  message: string;
  started_at: string;
  updated_at: string;
}

const DeploymentPipeline: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [tenantConfig, setTenantConfig] = useState<TenantConfig | null>(null);
  const [serviceImages, setServiceImages] = useState<ServiceImageSelection[]>([]);
  const [pipelineConfig, setPipelineConfig] = useState<PipelineConfig>({
    deployment_strategy: 'RollingUpdate',
    namespace: 'default-ecp-ai',
    environment: 'production',
    rollout_settings: {
      max_unavailable: 1,
      max_surge: 1
    },
    health_check: {
      enabled: true,
      path: '/health',
      initial_delay: 30
    }
  });
  const [deploymentStatuses, setDeploymentStatuses] = useState<DeploymentStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [deploymentDialogOpen, setDeploymentDialogOpen] = useState(false);

  // 1단계: 테넌트 생성 폼
  const [tenantForm, setTenantForm] = useState({
    tenant_id: '',
    channels: 10,
    concurrent_calls: 100
  });

  const steps = [
    '테넌트 생성',
    '이미지 선택',
    '파이프라인 설정',
    '배포 실행',
    '모니터링'
  ];

  // 테넌트 생성 및 서비스 요구사항 계산
  const handleCreateTenant = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8001/api/v1/tenants/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantForm.tenant_id,
          channels: tenantForm.channels,
          concurrent_calls: tenantForm.concurrent_calls,
          preset: 'production'
        })
      });

      if (response.ok) {
        const result = await response.json();
        setTenantConfig(result.tenant_config);
        
        // 필요한 서비스 목록을 바탕으로 이미지 선택 목록 생성
        await loadServiceImages(result.tenant_config.service_requirements);
        
        setActiveStep(1);
      } else {
        alert('테넌트 생성 실패');
      }
    } catch (error) {
      console.error('테넌트 생성 오류:', error);
      alert('테넌트 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 필요한 서비스들의 이미지 정보 로드
  const loadServiceImages = async (serviceRequirements: any) => {
    try {
      const response = await fetch('http://localhost:8001/api/v1/cicd/list');
      if (response.ok) {
        const data = await response.json();
        
        // 테넌트에 필요한 서비스만 필터링
        const requiredServices = Object.keys(serviceRequirements);
        const filteredImages = data.images.filter((img: any) => 
          requiredServices.includes(img.service_name)
        );

        const imageSelections: ServiceImageSelection[] = filteredImages.map((img: any) => ({
          service_name: img.service_name,
          display_name: img.display_name,
          current_tag: img.image_tag || 'latest',
          available_tags: ['latest', 'v1.2.3', 'v1.2.2', 'v1.2.1'],
          selected_tag: img.image_tag || 'latest',
          category: img.category
        }));

        setServiceImages(imageSelections);
      }
    } catch (error) {
      console.error('서비스 이미지 로드 오류:', error);
    }
  };

  // 이미지 태그 선택
  const handleImageTagChange = (serviceName: string, newTag: string) => {
    setServiceImages(prev => 
      prev.map(img => 
        img.service_name === serviceName 
          ? { ...img, selected_tag: newTag }
          : img
      )
    );
  };

  // 배포 실행
  const handleStartDeployment = async () => {
    if (!tenantConfig) return;

    setLoading(true);
    setDeploymentDialogOpen(true);

    try {
      const deploymentPromises = serviceImages.map(async (service) => {
        const response = await fetch('http://localhost:8001/api/v1/deployment/deploy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_name: service.service_name,
            image_tag: service.selected_tag,
            tenant_id: tenantConfig.tenant_id,
            namespace: pipelineConfig.namespace,
            deployment_strategy: pipelineConfig.deployment_strategy,
            replicas: tenantConfig.service_requirements[service.service_name]?.replicas || 2
          })
        });

        if (response.ok) {
          const result = await response.json();
          return result.status;
        }
        throw new Error(`${service.service_name} 배포 실패`);
      });

      const results = await Promise.all(deploymentPromises);
      setDeploymentStatuses(results);
      setActiveStep(4);
      
    } catch (error) {
      console.error('배포 오류:', error);
      alert('배포 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 배포 상태 모니터링
  const monitorDeployments = async () => {
    if (deploymentStatuses.length === 0) return;

    try {
      const statusPromises = deploymentStatuses.map(async (status) => {
        const response = await fetch(`http://localhost:8001/api/v1/deployment/status/${status.deployment_id}`);
        if (response.ok) {
          return await response.json();
        }
        return status;
      });

      const updatedStatuses = await Promise.all(statusPromises);
      setDeploymentStatuses(updatedStatuses);
    } catch (error) {
      console.error('배포 상태 모니터링 오류:', error);
    }
  };

  // 주기적으로 배포 상태 업데이트
  useEffect(() => {
    if (activeStep === 4 && deploymentStatuses.length > 0) {
      const interval = setInterval(monitorDeployments, 5000);
      return () => clearInterval(interval);
    }
  }, [activeStep, deploymentStatuses]);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          🚀 Kubernetes 자동 배포 파이프라인
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => {
            setActiveStep(0);
            setTenantConfig(null);
            setServiceImages([]);
            setDeploymentStatuses([]);
          }}
        >
          초기화
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        <AlertTitle>🎯 배포 파이프라인 플로우</AlertTitle>
        <Typography variant="body2">
          1. <strong>테넌트 생성</strong>: 채널 수 입력 → 리소스 계산 → 필요 서비스 목록 생성<br/>
          2. <strong>이미지 선택</strong>: 각 서비스별 배포할 이미지 태그 선택<br/>
          3. <strong>파이프라인 설정</strong>: 배포 전략 및 환경 설정<br/>
          4. <strong>배포 실행</strong>: Kubernetes 매니페스트 생성 및 배포<br/>
          5. <strong>모니터링</strong>: 실시간 배포 상태 추적 및 롤백 옵션
        </Typography>
      </Alert>

      <Stepper activeStep={activeStep} orientation="vertical">
        {/* 1단계: 테넌트 생성 */}
        <Step>
          <StepLabel>테넌트 생성 및 리소스 계산</StepLabel>
          <StepContent>
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  📞 채널 정보 입력
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="테넌트 ID"
                      value={tenantForm.tenant_id}
                      onChange={(e) => setTenantForm(prev => ({ ...prev, tenant_id: e.target.value }))}
                      placeholder="예: company-prod"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      type="number"
                      label="채널 수"
                      value={tenantForm.channels}
                      onChange={(e) => setTenantForm(prev => ({ ...prev, channels: parseInt(e.target.value) }))}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      type="number"
                      label="동시 통화 수"
                      value={tenantForm.concurrent_calls}
                      onChange={(e) => setTenantForm(prev => ({ ...prev, concurrent_calls: parseInt(e.target.value) }))}
                    />
                  </Grid>
                </Grid>
                
                <Box mt={3}>
                  <Button
                    variant="contained"
                    onClick={handleCreateTenant}
                    disabled={!tenantForm.tenant_id || loading}
                    startIcon={loading ? <LinearProgress /> : <PlayArrowIcon />}
                  >
                    {loading ? '계산 중...' : '리소스 계산 및 서비스 목록 생성'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </StepContent>
        </Step>

        {/* 2단계: 이미지 선택 */}
        <Step>
          <StepLabel>서비스 이미지 선택</StepLabel>
          <StepContent>
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  📦 필요한 서비스별 이미지 태그 선택
                </Typography>
                
                {tenantConfig && (
                  <Alert severity="success" sx={{ mb: 2 }}>
                    <AlertTitle>✅ 테넌트 생성 완료</AlertTitle>
                    <Typography variant="body2">
                      테넌트 ID: <strong>{tenantConfig.tenant_id}</strong><br/>
                      필요 서비스: <strong>{Object.keys(tenantConfig.service_requirements).length}개</strong><br/>
                      총 예상 리소스: CPU {Object.values(tenantConfig.service_requirements).reduce((sum, req) => sum + req.cpu_cores, 0)} cores, 
                      RAM {Object.values(tenantConfig.service_requirements).reduce((sum, req) => sum + req.memory_gb, 0)} GB
                    </Typography>
                  </Alert>
                )}

                <Grid container spacing={2}>
                  {serviceImages.map((service) => (
                    <Grid item xs={12} md={6} key={service.service_name}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" gutterBottom>
                            {service.display_name}
                          </Typography>
                          <Chip label={service.category} size="small" sx={{ mb: 1 }} />
                          <FormControl fullWidth size="small">
                            <InputLabel>이미지 태그</InputLabel>
                            <Select
                              value={service.selected_tag}
                              onChange={(e) => handleImageTagChange(service.service_name, e.target.value)}
                              label="이미지 태그"
                            >
                              {service.available_tags.map((tag) => (
                                <MenuItem key={tag} value={tag}>
                                  {tag} {tag === service.current_tag && '(현재)'}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>

                <Box mt={3}>
                  <Button
                    variant="contained"
                    onClick={() => setActiveStep(2)}
                    disabled={serviceImages.length === 0}
                  >
                    다음: 파이프라인 설정
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </StepContent>
        </Step>

        {/* 3단계: 파이프라인 설정 */}
        <Step>
          <StepLabel>배포 파이프라인 설정</StepLabel>
          <StepContent>
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  ⚙️ 배포 전략 및 환경 설정
                </Typography>
                
                <Grid container spacing={3}>
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth>
                      <InputLabel>배포 전략</InputLabel>
                      <Select
                        value={pipelineConfig.deployment_strategy}
                        onChange={(e) => setPipelineConfig(prev => ({ ...prev, deployment_strategy: e.target.value }))}
                        label="배포 전략"
                      >
                        <MenuItem value="RollingUpdate">Rolling Update (무중단)</MenuItem>
                        <MenuItem value="Recreate">Recreate (전체 재시작)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="네임스페이스"
                      value={pipelineConfig.namespace}
                      onChange={(e) => setPipelineConfig(prev => ({ ...prev, namespace: e.target.value }))}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth>
                      <InputLabel>환경</InputLabel>
                      <Select
                        value={pipelineConfig.environment}
                        onChange={(e) => setPipelineConfig(prev => ({ ...prev, environment: e.target.value }))}
                        label="환경"
                      >
                        <MenuItem value="development">Development</MenuItem>
                        <MenuItem value="staging">Staging</MenuItem>
                        <MenuItem value="production">Production</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                <Box mt={3}>
                  <Button
                    variant="contained"
                    onClick={() => setActiveStep(3)}
                    startIcon={<SettingsIcon />}
                  >
                    다음: 배포 실행
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </StepContent>
        </Step>

        {/* 4단계: 배포 실행 */}
        <Step>
          <StepLabel>배포 실행</StepLabel>
          <StepContent>
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  🚀 Kubernetes 배포 실행
                </Typography>

                <Alert severity="warning" sx={{ mb: 2 }}>
                  <AlertTitle>⚠️ 배포 전 확인사항</AlertTitle>
                  <List dense>
                    <ListItem>
                      <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                      <ListItemText primary={`테넌트: ${tenantConfig?.tenant_id}`} />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                      <ListItemText primary={`서비스 수: ${serviceImages.length}개`} />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                      <ListItemText primary={`배포 전략: ${pipelineConfig.deployment_strategy}`} />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
                      <ListItemText primary={`환경: ${pipelineConfig.environment}`} />
                    </ListItem>
                  </List>
                </Alert>

                <Box mt={3}>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={handleStartDeployment}
                    disabled={loading}
                    startIcon={<DeployIcon />}
                    sx={{ mr: 2 }}
                  >
                    {loading ? '배포 중...' : '배포 시작'}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => setActiveStep(2)}
                  >
                    이전: 설정 수정
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </StepContent>
        </Step>

        {/* 5단계: 모니터링 */}
        <Step>
          <StepLabel>배포 모니터링</StepLabel>
          <StepContent>
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  📊 실시간 배포 상태 모니터링
                </Typography>

                {deploymentStatuses.length > 0 && (
                  <TableContainer component={Paper} sx={{ mt: 2 }}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>서비스</TableCell>
                          <TableCell>상태</TableCell>
                          <TableCell>진행률</TableCell>
                          <TableCell>메시지</TableCell>
                          <TableCell>시작 시간</TableCell>
                          <TableCell>작업</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {deploymentStatuses.map((status) => (
                          <TableRow key={status.deployment_id}>
                            <TableCell>{status.service_name}</TableCell>
                            <TableCell>
                              <Chip 
                                label={status.status}
                                color={
                                  status.status === 'completed' ? 'success' :
                                  status.status === 'failed' ? 'error' :
                                  status.status === 'deploying' ? 'primary' : 'default'
                                }
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              <LinearProgress 
                                variant="determinate" 
                                value={status.progress}
                                sx={{ width: 100 }}
                              />
                              {status.progress}%
                            </TableCell>
                            <TableCell>{status.message}</TableCell>
                            <TableCell>
                              {new Date(status.started_at).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Tooltip title="모니터링">
                                <IconButton size="small">
                                  <MonitorIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="롤백">
                                <IconButton size="small" color="warning">
                                  <RollbackIcon />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}

                <Box mt={3}>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={monitorDeployments}
                  >
                    상태 새로고침
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </StepContent>
        </Step>
      </Stepper>

      {/* 배포 진행 다이얼로그 */}
      <Dialog 
        open={deploymentDialogOpen} 
        onClose={() => setDeploymentDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>🚀 배포 진행 중</DialogTitle>
        <DialogContent>
          <Typography variant="body2" paragraph>
            선택한 서비스들을 Kubernetes 클러스터에 배포하고 있습니다.
          </Typography>
          {loading && <LinearProgress sx={{ mb: 2 }} />}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setDeploymentDialogOpen(false)}
            disabled={loading}
          >
            닫기
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DeploymentPipeline;
