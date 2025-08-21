// [advice from AI] ECP-AI 배포 마법사 컴포넌트 - 단계별 검증 및 배포
/**
 * 테넌시 배포 마법사 (확장됨)
 * - 1단계: 기본 서비스 설정
 * - 2단계: 환경변수 설정
 * - 3단계: 볼륨 & 스토리지 설정
 * - 4단계: 네트워크 & 보안 설정
 * - 5단계: 헬스체크 & 모니터링 설정
 * - 6단계: 최종 검증 & 매니페스트 생성
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Button,
  Alert,
  AlertTitle,
  Grid,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  CircularProgress,
  Divider,
  IconButton,
  Tooltip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Slider,
  InputAdornment,
  FormHelperText,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
  PlayArrow as PlayArrowIcon,
  GetApp as GetAppIcon,
  Code as CodeIcon,
  Security as SecurityIcon,
  CloudDownload as CloudDownloadIcon,
  Settings as SettingsIcon,
  Storage as StorageIcon,
  NetworkCheck as NetworkCheckIcon,
  HealthAndSafety as HealthAndSafetyIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// 타입 정의
interface DeploymentWizardProps {
  tenantId: string;
  serviceRequirements: any;
  gpuType: string;
  onDeploymentComplete: (result: any) => void;
  onCancel: () => void;
}

interface ValidationResult {
  resource_validation: any;
  deployment_warnings: string[];
  deployment_errors: string[];
  recommendations: string[];
}

interface ManifestPreview {
  manifests: Record<string, string>;
  manifest_count: number;
  estimated_resources: any;
}

// 새로운 타입 정의
interface AdvancedConfig {
  environment_variables: EnvironmentVariable[];
  volume_mounts: VolumeMount[];
  health_checks: Record<string, HealthCheckConfig>;
  network_config: NetworkConfig;
}

interface EnvironmentVariable {
  name: string;
  value: string;
  value_from_configmap?: string;
  value_from_secret?: string;
  description: string;
}

interface VolumeMount {
  name: string;
  type: string;
  mount_path: string;
  sub_path?: string;
  read_only: boolean;
  config_map_name?: string;
  secret_name?: string;
  storage_class?: string;
  size?: string;
  description: string;
}

interface HealthCheckConfig {
  type: string;
  path?: string;
  port?: number;
  initial_delay_seconds: number;
  period_seconds: number;
  timeout_seconds: number;
  failure_threshold: number;
  success_threshold: number;
}

interface NetworkConfig {
  service_type: string;
  external_port?: number;
  ingress_enabled: boolean;
  ingress_host?: string;
  ingress_tls: boolean;
  network_policy_enabled: boolean;
}

interface PresetTemplate {
  preset: string;
  base_requirements: any;
  recommendations: AdvancedConfig;
  description: string;
}

// 스타일드 컴포넌트
const WizardCard = styled(Card)(({ theme }) => ({
  width: '100%',
  height: '100vh',
  maxHeight: '100vh',
  margin: 'auto',
  boxShadow: theme.shadows[12],
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
}));

const StepCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(2),
  border: `2px solid ${theme.palette.divider}`,
  borderRadius: theme.spacing(2),
}));

const ManifestViewer = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#f5f5f5',
  padding: theme.spacing(2),
  borderRadius: theme.spacing(1),
  fontFamily: 'monospace',
  fontSize: '0.875rem',
  height: '60vh',
  overflow: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
}));

const steps = [
  '기본 서비스 설정',
  '환경변수 설정',
  '볼륨 & 스토리지 설정',
  '네트워크 & 보안 설정',
  '헬스체크 & 모니터링 설정',
  '매니페스트 생성 준비',
  '매니페스트 생성 및 확인',
  '다운로드 및 배포'
];

const stepDescriptions = [
  '입력하신 서비스 요구사항을 확인하고 기본 설정을 검토합니다',
  '애플리케이션이 필요로 하는 환경변수를 설정합니다 (API 키, 데이터베이스 연결 등)',
  '데이터 저장소와 설정 파일을 위한 볼륨을 설정합니다',
  '외부 접근과 보안 정책을 설정합니다',
  '서비스 상태를 모니터링하기 위한 헬스체크를 설정합니다',
  '모든 설정을 검증하고 매니페스트 생성을 준비합니다',
  'Kubernetes 매니페스트를 생성하고 내용을 확인합니다',
  '생성된 파일을 다운로드하거나 클러스터에 배포합니다'
];

export const DeploymentWizard: React.FC<DeploymentWizardProps> = ({
  tenantId,
  serviceRequirements,
  gpuType,
  onDeploymentComplete,
  onCancel
}) => {
  // 상태 관리
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [manifestPreview, setManifestPreview] = useState<ManifestPreview | null>(null);
  const [selectedManifest, setSelectedManifest] = useState<string | null>(null);


  // 다음 단계로 이동
  const handleNext = async () => {
    if (activeStep === 1) {
      await generateManifests();
    } else if (activeStep === 2) {
      await validateDeployment();
    } else if (activeStep === 5) {
      // 6단계에서 7단계로 이동할 때 매니페스트 자동 생성
      await generateManifests();
    }
    
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  // 이전 단계로 이동
  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  // 매니페스트 생성
  const generateManifests = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/v1/tenants/${tenantId}/generate-manifests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...serviceRequirements,
          gpu_type: gpuType
        }),
      });

      if (!response.ok) {
        throw new Error('매니페스트 생성 실패');
      }

      const result = await response.json();
      setManifestPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '매니페스트 생성 실패');
    } finally {
      setLoading(false);
    }
  };

  // 배포 검증
  const validateDeployment = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/v1/tenants/${tenantId}/validate-deployment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serviceRequirements),
      });

      if (!response.ok) {
        throw new Error('배포 검증 실패');
      }

      const result = await response.json();
      setValidationResult(result.validation_results);
    } catch (err) {
      setError(err instanceof Error ? err.message : '배포 검증 실패');
    } finally {
      setLoading(false);
    }
  };

  // 배포 패키지 다운로드
  const downloadPackage = async () => {
    try {
      const response = await fetch(`/api/v1/tenants/${tenantId}/download-package`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...serviceRequirements,
          gpu_type: gpuType
        }),
      });
      
      if (!response.ok) {
        throw new Error('다운로드 실패');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ecp-ai-${tenantId}-deployment.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : '다운로드 실패');
    }
  };

  // 실제 배포 실행
  const executeDeployment = async () => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/v1/tenants/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          service_requirements: serviceRequirements,
          gpu_type: gpuType,
          auto_deploy: true
        }),
      });

      if (!response.ok) {
        throw new Error('배포 실행 실패');
      }

      const result = await response.json();
      onDeploymentComplete(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '배포 실행 실패');
    } finally {
      setLoading(false);
    }
  };

  // 매니페스트 선택 (인라인 표시용)
  const selectManifest = (filename: string) => {
    setSelectedManifest(filename);
  };

  // 단계별 컨텐츠 렌더링
  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <StepCard>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom color="primary">
                📋 1단계: 기본 서비스 설정
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                입력하신 서비스 요구사항을 확인하고 기본 설정을 검토합니다. 
                이 단계에서는 자동으로 계산된 리소스와 권장 설정을 확인할 수 있습니다.
              </Typography>
            </Box>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, backgroundColor: 'primary.50' }}>
                  <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                    🎯 서비스 구성 요약
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    입력하신 채널 수와 사용자 수를 기반으로 자동 계산된 서비스 구성입니다.
                  </Typography>
                  {Object.entries(serviceRequirements).map(([service, count]) => (
                    (count as number) > 0 && (
                      <Chip
                        key={service}
                        label={`${service}: ${count}`}
                        variant="outlined"
                        color="primary"
                        sx={{ mr: 1, mb: 1 }}
                      />
                    )
                  ))}
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, backgroundColor: 'success.50' }}>
                  <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                    ⚙️ 자동 설정된 기본값
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    시스템이 자동으로 최적화한 기본 설정입니다.
                  </Typography>
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="body2" fontWeight="bold">
                      테넌시 ID: <Chip label={tenantId} size="small" color="primary" />
                    </Typography>
                  </Box>
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="body2" fontWeight="bold">
                      GPU 타입: <Chip label={gpuType} size="small" color="success" />
                    </Typography>
                  </Box>
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="body2" fontWeight="bold">
                      프리셋: <Chip label="자동 감지됨" size="small" color="info" />
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
            
            <Alert severity="info" sx={{ mt: 3 }}>
              <AlertTitle>💡 이 단계에서 하는 일</AlertTitle>
              <Typography variant="body2">
                • 입력된 서비스 요구사항 검증<br/>
                • 자동 계산된 리소스 확인<br/>
                • 기본 설정값 검토<br/>
                • 다음 단계로 진행할 준비
              </Typography>
            </Alert>
          </StepCard>
        );

      case 1:
        return (
          <StepCard>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom color="primary">
                📄 2단계: 환경변수 설정
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                애플리케이션이 필요로 하는 환경변수를 설정합니다. 
                환경변수는 애플리케이션이 실행될 때 필요한 설정값들을 제공합니다.
              </Typography>
            </Box>
            
            <Alert severity="info" sx={{ mb: 3 }}>
              <AlertTitle>💡 환경변수가 필요한 이유</AlertTitle>
              <Typography variant="body2">
                • <strong>데이터베이스 연결:</strong> DB_HOST, DB_PASSWORD 등<br/>
                • <strong>API 인증:</strong> API_KEY, SECRET_TOKEN 등<br/>
                • <strong>환경 설정:</strong> LOG_LEVEL, TIMEZONE 등<br/>
                • <strong>보안:</strong> 민감한 정보는 Secret으로 관리
              </Typography>
            </Alert>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, backgroundColor: 'info.50' }}>
                  <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                    🔑 자동 생성된 환경변수
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    시스템이 자동으로 생성한 기본 환경변수들입니다.
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" fontWeight="bold" color="primary">
                      LOG_LEVEL
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      값: INFO | 설명: 로그 출력 레벨 (DEBUG, INFO, WARN, ERROR)
                    </Typography>
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" fontWeight="bold" color="primary">
                      ENVIRONMENT
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      값: development | 설명: 운영 환경 (development, staging, production)
                    </Typography>
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" fontWeight="bold" color="primary">
                      TIMEZONE
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      값: Asia/Seoul | 설명: 서버 시간대 설정
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, backgroundColor: 'warning.50' }}>
                  <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                    ⚠️ 추가 설정이 필요한 환경변수
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    아래 환경변수들은 실제 값으로 설정해야 합니다.
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" fontWeight="bold" color="warning.main">
                      CALLBOT_API_KEY
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      설명: 콜봇 서비스 API 키 (실제 값 입력 필요)
                    </Typography>
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" fontWeight="bold" color="warning.main">
                      ADVISOR_DB_CONNECTION
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      설명: 어드바이저 데이터베이스 연결 문자열
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
            
            <Alert severity="success" sx={{ mt: 3 }}>
              <AlertTitle>✅ 이 단계에서 하는 일</AlertTitle>
              <Typography variant="body2">
                • 기본 환경변수 자동 생성<br/>
                • 서비스별 필요한 환경변수 확인<br/>
                • 보안이 중요한 값은 Secret으로 관리<br/>
                • 애플리케이션 실행 환경 구성
              </Typography>
            </Alert>
          </StepCard>
        );

      case 2:
        return (
          <StepCard>
            <Typography variant="h6" gutterBottom>
              📦 볼륨 & 스토리지 설정
            </Typography>
            {/* 볼륨 및 스토리지 설정 폼 */}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>볼륨 이름</InputLabel>
              <Select
                value=""
                label="볼륨 이름"
                onChange={(e) => {}}
              >
                <MenuItem value="">선택</MenuItem>
                <MenuItem value="data-volume">data-volume</MenuItem>
                <MenuItem value="config-volume">config-volume</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>볼륨 타입</InputLabel>
              <Select
                value=""
                label="볼륨 타입"
                onChange={(e) => {}}
              >
                <MenuItem value="">선택</MenuItem>
                <MenuItem value="emptyDir">emptyDir</MenuItem>
                <MenuItem value="hostPath">hostPath</MenuItem>
                <MenuItem value="persistentVolumeClaim">persistentVolumeClaim</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>스토리지 클래스</InputLabel>
              <Select
                value=""
                label="스토리지 클래스"
                onChange={(e) => {}}
              >
                <MenuItem value="">선택</MenuItem>
                <MenuItem value="gp2">gp2</MenuItem>
                <MenuItem value="gp3">gp3</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>볼륨 크기 (GB)</InputLabel>
              <Slider
                value={50}
                min={10}
                max={100}
                step={10}
                onChange={(e, value) => {}}
                valueLabelDisplay="auto"
              />
            </FormControl>
            <FormControlLabel
              control={<Switch />}
              label="읽기 전용"
            />
            <FormControlLabel
              control={<Switch />}
              label="ConfigMap 연결"
            />
            <FormControlLabel
              control={<Switch />}
              label="Secret 연결"
            />
          </StepCard>
        );

      case 3:
        return (
          <StepCard>
            <Typography variant="h6" gutterBottom>
              📡 네트워크 & 보안 설정
            </Typography>
            {/* 네트워크 및 보안 설정 폼 */}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>서비스 타입</InputLabel>
              <Select
                value=""
                label="서비스 타입"
                onChange={(e) => {}}
              >
                <MenuItem value="">선택</MenuItem>
                <MenuItem value="ClusterIP">ClusterIP</MenuItem>
                <MenuItem value="NodePort">NodePort</MenuItem>
                <MenuItem value="LoadBalancer">LoadBalancer</MenuItem>
                <MenuItem value="ExternalName">ExternalName</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>외부 포트</InputLabel>
              <TextField
                label="외부 포트"
                variant="outlined"
                fullWidth
                sx={{ mb: 2 }}
              />
            </FormControl>
            <FormControlLabel
              control={<Switch />}
              label="Ingress 활성화"
            />
            <FormControlLabel
              control={<Switch />}
              label="TLS 사용"
            />
            <FormControlLabel
              control={<Switch />}
              label="네트워크 정책 활성화"
            />
          </StepCard>
        );

      case 4:
        return (
          <StepCard>
            <Typography variant="h6" gutterBottom>
              ⚙️ 헬스체크 & 모니터링 설정
            </Typography>
            {/* 헬스체크 및 모니터링 설정 폼 */}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>서비스 이름</InputLabel>
              <Select
                value=""
                label="서비스 이름"
                onChange={(e) => {}}
              >
                <MenuItem value="">선택</MenuItem>
                <MenuItem value="app-service">app-service</MenuItem>
                <MenuItem value="api-service">api-service</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>헬스체크 타입</InputLabel>
              <Select
                value=""
                label="헬스체크 타입"
                onChange={(e) => {}}
              >
                <MenuItem value="">선택</MenuItem>
                <MenuItem value="liveness">liveness</MenuItem>
                <MenuItem value="readiness">readiness</MenuItem>
                <MenuItem value="startup">startup</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>초기 지연 시간 (초)</InputLabel>
              <Slider
                value={10}
                min={0}
                max={60}
                step={5}
                onChange={(e, value) => {}}
                valueLabelDisplay="auto"
              />
            </FormControl>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>주기 (초)</InputLabel>
              <Slider
                value={30}
                min={10}
                max={120}
                step={10}
                onChange={(e, value) => {}}
                valueLabelDisplay="auto"
              />
            </FormControl>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>제한 시간 (초)</InputLabel>
              <Slider
                value={10}
                min={5}
                max={30}
                step={5}
                onChange={(e, value) => {}}
                valueLabelDisplay="auto"
              />
            </FormControl>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>실패 임계값</InputLabel>
              <Slider
                value={3}
                min={1}
                max={5}
                step={1}
                onChange={(e, value) => {}}
                valueLabelDisplay="auto"
              />
            </FormControl>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>성공 임계값</InputLabel>
              <Slider
                value={1}
                min={1}
                max={3}
                step={1}
                onChange={(e, value) => {}}
                valueLabelDisplay="auto"
              />
            </FormControl>
          </StepCard>
        );

      case 5:
        return (
          <StepCard>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom color="primary">
                📋 6단계: 매니페스트 생성 준비
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                모든 설정이 완료되었습니다. 이제 Kubernetes 매니페스트를 생성할 준비가 되었습니다.
              </Typography>
            </Box>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, backgroundColor: 'success.50' }}>
                  <Typography variant="h6" gutterBottom color="success.main" fontWeight="bold">
                    ✅ 설정 완료 확인
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    아래 모든 설정이 완료되었는지 확인하세요.
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" fontWeight="bold" color="success.main">
                      🎯 기본 서비스 설정
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      테넌시 ID, GPU 타입, 서비스 요구사항 설정 완료
                    </Typography>
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" fontWeight="bold" color="success.main">
                      🔑 환경변수 설정
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      로그 레벨, 환경, 시간대 등 기본 설정 완료
                    </Typography>
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" fontWeight="bold" color="success.main">
                      📦 볼륨 & 스토리지 설정
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      설정 파일, 로그, 데이터 저장소 설정 완료
                    </Typography>
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" fontWeight="bold" color="success.main">
                      📡 네트워크 & 보안 설정
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      서비스 타입, 인그레스, 보안 정책 설정 완료
                    </Typography>
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" fontWeight="bold" color="success.main">
                      ⚙️ 헬스체크 & 모니터링 설정
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      서비스 상태 모니터링 설정 완료
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, backgroundColor: 'info.50' }}>
                  <Typography variant="h6" gutterBottom color="info.main" fontWeight="bold">
                    🔍 생성될 파일들
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    매니페스트 생성 시 아래 파일들이 자동으로 생성됩니다.
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" fontWeight="bold" color="info.main">
                      📄 Kubernetes YAML 파일들
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Namespace, Deployment, Service, HPA, ConfigMap 등
                    </Typography>
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" fontWeight="bold" color="info.main">
                      🚀 배포 스크립트
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      deploy.sh (자동 배포), cleanup.sh (정리)
                    </Typography>
                  </Box>
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" fontWeight="bold" color="info.main">
                      📚 문서 및 가이드
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      README.md (배포 가이드), tenant-specs.json (설정 정보)
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
            
            <Box sx={{ mt: 4, textAlign: 'center' }}>
              <Alert severity="info" sx={{ mb: 3 }}>
                <AlertTitle>🚀 매니페스트 생성 준비 완료!</AlertTitle>
                <Typography variant="body2">
                  모든 설정이 완료되었습니다. '다음' 버튼을 클릭하면 매니페스트가 자동으로 생성됩니다.
                </Typography>
              </Alert>
              

            </Box>
          </StepCard>
        );

            case 6:
        return (
          <StepCard>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom color="primary">
                📄 7단계: 매니페스트 생성 및 확인
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Kubernetes 매니페스트를 생성하고 생성된 파일들의 내용을 확인합니다.
                필요한 경우 최종 수정을 할 수 있습니다.
              </Typography>
            </Box>
            
            {loading ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress />
                <Typography sx={{ ml: 2 }}>매니페스트 생성 중...</Typography>
              </Box>
            ) : manifestPreview ? (
              <Box>
                <Alert severity="success" sx={{ mb: 3 }}>
                  <AlertTitle>✅ 매니페스트 생성 완료!</AlertTitle>
                  총 {manifestPreview.manifest_count}개 파일이 성공적으로 생성되었습니다.
                  아래에서 내용을 확인하고 필요한 경우 수정할 수 있습니다.
                </Alert>
                
                <Grid container spacing={3}>
                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, backgroundColor: 'primary.50' }}>
                      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        📁 생성된 파일 목록
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        아래 파일들을 확인하고 선택하여 내용을 미리보기할 수 있습니다.
                      </Typography>
                      
                      <Box sx={{ maxHeight: '400px', overflow: 'auto' }}>
                        {Object.keys(manifestPreview.manifests).map((filename) => (
                          <Button
                            key={filename}
                            variant={selectedManifest === filename ? "contained" : "outlined"}
                            size="small"
                            startIcon={<VisibilityIcon />}
                            onClick={() => setSelectedManifest(filename)}
                            fullWidth
                            sx={{ mb: 1, justifyContent: 'flex-start' }}
                          >
                            {filename}
                          </Button>
                        ))}
                      </Box>
                    </Paper>
                  </Grid>
                  
                  <Grid item xs={12} md={8}>
                    <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
                      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        📄 매니페스트 내용 미리보기
                        {selectedManifest && (
                          <Chip 
                            label={selectedManifest} 
                            size="small" 
                            color="primary" 
                            sx={{ ml: 1 }}
                          />
                        )}
                      </Typography>
                      
                      {selectedManifest ? (
                        <Box>
                          <ManifestViewer>
                            {manifestPreview.manifests[selectedManifest]}
                          </ManifestViewer>
                          
                          {/* 최종 수정 옵션 */}
                          <Box sx={{ mt: 2, p: 2, backgroundColor: 'warning.50', borderRadius: 1 }}>
                            <Typography variant="subtitle2" gutterBottom fontWeight="bold" color="warning.main">
                              ⚠️ 최종 수정 (선택사항)
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                              이 파일의 내용을 수정하고 싶다면 아래 텍스트를 편집할 수 있습니다.
                              수정하지 않아도 기본값으로 진행됩니다.
                            </Typography>
                            
                            <TextField
                              multiline
                              rows={4}
                              fullWidth
                              variant="outlined"
                              value={manifestPreview.manifests[selectedManifest]}
                              onChange={(e) => {
                                // 매니페스트 내용 수정 로직 (실제 구현 시 상태 관리 필요)
                                console.log('매니페스트 수정:', e.target.value);
                              }}
                              sx={{ 
                                '& .MuiInputBase-root': { 
                                  fontFamily: 'monospace',
                                  fontSize: '0.875rem'
                                }
                              }}
                            />
                            
                            <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                              <Button
                                size="small"
                                variant="outlined"
                                color="warning"
                                onClick={() => {
                                  // 수정 내용 저장 로직
                                  console.log('수정 내용 저장');
                                }}
                              >
                                수정 내용 저장
                              </Button>
                              <Button
                                size="small"
                                variant="text"
                                onClick={() => {
                                  // 원본으로 되돌리기
                                  console.log('원본으로 되돌리기');
                                }}
                              >
                                원본으로 되돌리기
                              </Button>
                            </Box>
                          </Box>
                        </Box>
                      ) : (
                        <Paper sx={{ 
                          p: 4, 
                          textAlign: 'center', 
                          height: '400px', 
                          display: 'flex', 
                          flexDirection: 'column',
                          alignItems: 'center', 
                          justifyContent: 'center',
                          backgroundColor: 'grey.100'
                        }}>
                          <VisibilityIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
                          <Typography color="text.secondary" variant="body1">
                            왼쪽에서 파일을 선택하여 내용을 확인하세요
                          </Typography>
                          <Typography color="text.secondary" variant="caption" sx={{ mt: 1 }}>
                            YAML 파일, 배포 스크립트, README 등을 미리보기하고 필요시 수정할 수 있습니다
                          </Typography>
                        </Paper>
                      )}
                    </Paper>
                  </Grid>
                </Grid>
                
                <Box sx={{ mt: 4, textAlign: 'center' }}>
                  <Alert severity="info" sx={{ mb: 3 }}>
                    <AlertTitle>🚀 매니페스트 확인 및 수정 완료!</AlertTitle>
                    <Typography variant="body2">
                      생성된 매니페스트를 확인하고 필요한 수정을 완료했습니다. 
                      다음 단계에서 다운로드하거나 배포할 수 있습니다.
                    </Typography>
                  </Alert>
                  
                  <Button
                    variant="contained"
                    color="success"
                    size="large"
                    startIcon={<CheckCircleIcon />}
                    onClick={handleNext}
                    sx={{ 
                      px: 6, 
                      py: 2, 
                      fontSize: '1.2rem',
                      borderRadius: 3
                    }}
                  >
                    ✅ 다음 단계로 (다운로드 및 배포)
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Alert severity="error">
                  <AlertTitle>❌ 오류 발생</AlertTitle>
                  <Typography variant="body2">
                    매니페스트가 생성되지 않았습니다. 이전 단계로 돌아가서 매니페스트를 먼저 생성해주세요.
                  </Typography>
                </Alert>
              </Box>
            )}
          </StepCard>
        );

      case 7:
        return (
          <StepCard>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom color="primary">
                🚀 8단계: 다운로드 및 배포
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                생성된 매니페스트를 다운로드하거나 Kubernetes 클러스터에 직접 배포합니다.
                모든 설정과 수정이 완료되었습니다.
              </Typography>
            </Box>
            
            {manifestPreview ? (
              <Box>
                <Alert severity="success" sx={{ mb: 3 }}>
                  <AlertTitle>✅ 최종 준비 완료!</AlertTitle>
                  <Typography variant="body2">
                    총 {manifestPreview.manifest_count}개 파일이 성공적으로 생성되었습니다.
                    이제 다운로드하거나 배포할 수 있습니다.
                  </Typography>
                </Alert>
                
                {/* 액션 버튼들 */}
                <Box sx={{ mt: 4 }}>
                  <Typography variant="h6" gutterBottom color="primary">
                    🚀 최종 배포 옵션
                  </Typography>
                  
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Paper sx={{ p: 3, textAlign: 'center', backgroundColor: 'success.50' }}>
                        <DownloadIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
                        <Typography variant="h6" gutterBottom>
                          📥 배포 패키지 다운로드
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          모든 파일이 포함된 ZIP 패키지를 다운로드하여 수동으로 검토하고 배포할 수 있습니다.
                        </Typography>
                        <Button
                          variant="contained"
                          color="success"
                          startIcon={<CloudDownloadIcon />}
                          onClick={downloadPackage}
                          fullWidth
                          size="large"
                        >
                          배포 패키지 다운로드
                        </Button>
                      </Paper>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Paper sx={{ p: 3, textAlign: 'center', backgroundColor: 'info.50' }}>
                        <PlayArrowIcon sx={{ fontSize: 48, color: 'info.main', mb: 2 }} />
                        <Typography variant="h6" gutterBottom>
                          🚀 자동 배포
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          생성된 매니페스트를 즉시 Kubernetes 클러스터에 배포합니다.
                        </Typography>
                        <Button
                          variant="contained"
                          color="info"
                          startIcon={<PlayArrowIcon />}
                          onClick={executeDeployment}
                          fullWidth
                          size="large"
                        >
                          지금 배포하기
                        </Button>
                      </Paper>
                    </Grid>
                  </Grid>
                  
                  <Alert severity="warning" sx={{ mt: 3 }}>
                    <AlertTitle>⚠️ 주의사항</AlertTitle>
                    <Typography variant="body2">
                      • 자동 배포는 즉시 클러스터 리소스를 사용합니다<br/>
                      • 프로덕션 환경에서는 다운로드 후 수동 배포를 권장합니다<br/>
                      • 배포 전에 매니페스트 내용을 반드시 확인하세요
                    </Typography>
                  </Alert>
                  
                  <Box sx={{ mt: 4, textAlign: 'center' }}>
                    <Typography variant="h6" gutterBottom color="primary">
                      🎉 테넌시 생성 완료!
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      모든 설정과 매니페스트 생성이 완료되었습니다. 
                      위의 옵션 중 하나를 선택하여 진행하세요.
                    </Typography>
                  </Box>
                </Box>
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Alert severity="error">
                  <AlertTitle>❌ 오류 발생</AlertTitle>
                  <Typography variant="body2">
                    매니페스트가 생성되지 않았습니다. 이전 단계로 돌아가서 매니페스트를 먼저 생성해주세요.
                  </Typography>
                </Alert>
              </Box>
            )}
          </StepCard>
        );

      default:
        return null;
    }
  };

  return (
    <WizardCard>
      <CardContent sx={{ p: 4, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
        <Typography variant="h4" gutterBottom textAlign="center">
          🧙‍♂️ 테넌시 배포 마법사
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" textAlign="center" sx={{ mb: 4 }}>
          단계별 검증을 통한 안전한 배포
        </Typography>

        {/* 스테퍼 */}
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label, index) => (
            <Step key={label}>
              <StepLabel>
                <Box>
                  <Typography variant="body2" fontWeight="bold">
                    {label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {stepDescriptions[index]}
                  </Typography>
                </Box>
              </StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* 에러 표시 */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* 단계별 컨텐츠 */}
        <Box sx={{ flex: 1, overflow: 'auto', mb: 2, minHeight: 0 }}>
          {renderStepContent()}
        </Box>

        {/* 네비게이션 버튼 */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
          <Button onClick={onCancel}>
            취소
          </Button>
          
          <Box>
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
              sx={{ mr: 1 }}
            >
              이전
            </Button>
            {activeStep < steps.length - 1 ? (
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={loading}
              >
                {loading ? '처리 중...' : '다음'}
              </Button>
            ) : (
              <Button
                variant="contained"
                color="success"
                onClick={executeDeployment}
                disabled={loading || (validationResult?.deployment_errors && validationResult.deployment_errors.length > 0)}
              >
                {loading ? '배포 중...' : '배포 완료'}
              </Button>
            )}
          </Box>
        </Box>
      </CardContent>

      {/* 매니페스트 미리보기는 이제 인라인으로 표시됨 */}
    </WizardCard>
  );
};
