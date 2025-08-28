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
  Info as InfoIcon,
  Save as SaveIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// 타입 정의
interface DeploymentWizardProps {
  tenantId: string;
  serviceRequirements: any;
  gpuType: string;
  onDeploymentComplete: (result: any) => void;
  onCancel: () => void;
  onTenantSaved?: (tenant: any) => void;
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

// [advice from AI] Kubernetes 고급 설정 타입 추가
interface AutoScalingConfig {
  enabled: boolean;
  minReplicas: number;
  maxReplicas: number;
  targetCPU: number;
  targetMemory: number;
  scaleUpPolicy: {
    stabilizationWindow: number;
    maxPercent: number;
    periodSeconds: number;
  };
  scaleDownPolicy: {
    stabilizationWindow: number;
    maxPercent: number;
    periodSeconds: number;
  };
  customMetrics: {
    enabled: boolean;
    metricName: string;
    targetValue: number;
  };
}

interface LatencyConfig {
  startupProbe: {
    enabled: boolean;
    initialDelaySeconds: number;
    periodSeconds: number;
    timeoutSeconds: number;
    failureThreshold: number;
    successThreshold: number;
  };
  livenessProbe: {
    initialDelaySeconds: number;
    periodSeconds: number;
    timeoutSeconds: number;
    failureThreshold: number;
  };
  readinessProbe: {
    initialDelaySeconds: number;
    periodSeconds: number;
    timeoutSeconds: number;
    failureThreshold: number;
    successThreshold: number;
  };
  rollingUpdate: {
    maxSurge: string;
    maxUnavailable: string;
  };
}

interface ResourceConfig {
  requests: {
    cpu: string;
    memory: string;
    ephemeralStorage?: string;
  };
  limits: {
    cpu: string;
    memory: string;
    ephemeralStorage?: string;
  };
  qosClass: 'Guaranteed' | 'Burstable' | 'BestEffort';
}

interface AdvancedSchedulingConfig {
  nodeSelector: Record<string, string>;
  affinity: {
    nodeAffinity: {
      enabled: boolean;
      requiredDuringScheduling: boolean;
      matchLabels: Record<string, string>;
    };
    podAffinity: {
      enabled: boolean;
      preferredDuringScheduling: boolean;
      topologyKey: string;
    };
    podAntiAffinity: {
      enabled: boolean;
      requiredDuringScheduling: boolean;
      topologyKey: string;
    };
  };
  tolerations: Array<{
    key: string;
    operator: 'Equal' | 'Exists';
    value?: string;
    effect: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';
    tolerationSeconds?: number;
  }>;
  priorityClassName?: string;
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
  'Kubernetes 고급 설정',
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
  '오토스케일링, 지연시간 최적화, 리소스 제한 등 고급 Kubernetes 설정을 조정합니다',
  '모든 설정을 검증하고 매니페스트 생성을 준비합니다',
  'Kubernetes 매니페스트를 생성하고 내용을 확인합니다',
  '생성된 파일을 다운로드하거나 클러스터에 배포합니다'
];

export const DeploymentWizard: React.FC<DeploymentWizardProps> = ({
  tenantId,
  serviceRequirements,
  gpuType,
  onDeploymentComplete,
  onCancel,
  onTenantSaved
}) => {
  // 상태 관리
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [manifestPreview, setManifestPreview] = useState<ManifestPreview | null>(null);
  const [selectedManifest, setSelectedManifest] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // [advice from AI] 클라우드 제공업체 선택 상태 추가
  const [selectedCloudProvider, setSelectedCloudProvider] = useState<'iaas' | 'aws' | 'ncp'>('iaas');
  
  // [advice from AI] 환경변수 설정 상태 추가
  const [envVars, setEnvVars] = useState<{[key: string]: string}>({
    // 기본 환경변수
    'OPENAI_API_KEY': '',
    'DATABASE_URL': 'postgresql://ecp:password@postgres:5432/ecp_db',
    'REDIS_URL': 'redis://redis:6379/0',
    'LOG_LEVEL': 'INFO',
    'ENVIRONMENT': 'production',
    'JWT_SECRET': '',
    'ENCRYPTION_KEY': '',
    'STORAGE_PATH': '/app/data',
    'MAX_WORKERS': '4',
    'TIMEOUT_SECONDS': '30'
  });
  
  // [advice from AI] 볼륨 설정 상태 추가
  const [volumeSettings, setVolumeSettings] = useState({
    dataVolume: { name: 'ecp-data', size: '50Gi', storageClass: 'gp2' },
    logsVolume: { name: 'ecp-logs', size: '20Gi', storageClass: 'gp2' },
    configVolume: { name: 'ecp-config', size: '1Gi', storageClass: 'gp2' }
  });
  
  // [advice from AI] 네트워크 설정 상태 추가
  const [networkSettings, setNetworkSettings] = useState({
    serviceType: 'ClusterIP',
    ingressEnabled: true,
    tlsEnabled: true,
    networkPolicy: 'restricted'
  });
  
  // [advice from AI] 헬스체크 설정 상태 추가
  const [healthSettings, setHealthSettings] = useState({
    livenessProbe: { enabled: true, path: '/health', initialDelay: 30, period: 10 },
    readinessProbe: { enabled: true, path: '/ready', initialDelay: 5, period: 5 },
    startupProbe: { enabled: true, path: '/startup', initialDelay: 10, period: 10 }
  });
  
  // [advice from AI] K8S Simulator 자동 설정 상태 추가
  const [simulatorAutoSetup, setSimulatorAutoSetup] = useState(true);
  
  // [advice from AI] 하드웨어 계산 결과 상태 추가
  const [hardwareSpec, setHardwareSpec] = useState<any>(null);

  // [advice from AI] Kubernetes 고급 설정 상태 추가
  const [autoScalingSettings, setAutoScalingSettings] = useState<AutoScalingConfig>({
    enabled: true,
    minReplicas: 2,
    maxReplicas: 10,
    targetCPU: 70,
    targetMemory: 80,
    scaleUpPolicy: {
      stabilizationWindow: 60,
      maxPercent: 100,
      periodSeconds: 60
    },
    scaleDownPolicy: {
      stabilizationWindow: 300,
      maxPercent: 10,
      periodSeconds: 60
    },
    customMetrics: {
      enabled: false,
      metricName: 'requests_per_second',
      targetValue: 100
    }
  });

  const [latencySettings, setLatencySettings] = useState<LatencyConfig>({
    startupProbe: {
      enabled: false,
      initialDelaySeconds: 30,
      periodSeconds: 10,
      timeoutSeconds: 5,
      failureThreshold: 3,
      successThreshold: 1
    },
    livenessProbe: {
      initialDelaySeconds: 30,
      periodSeconds: 10,
      timeoutSeconds: 5,
      failureThreshold: 3
    },
    readinessProbe: {
      initialDelaySeconds: 5,
      periodSeconds: 5,
      timeoutSeconds: 3,
      failureThreshold: 3,
      successThreshold: 1
    },
    rollingUpdate: {
      maxSurge: '25%',
      maxUnavailable: '25%'
    }
  });

  const [resourceSettings, setResourceSettings] = useState<ResourceConfig>({
    requests: {
      cpu: '100m',
      memory: '256Mi',
      ephemeralStorage: '1Gi'
    },
    limits: {
      cpu: '1000m',
      memory: '1Gi',
      ephemeralStorage: '2Gi'
    },
    qosClass: 'Burstable'
  });

  // [advice from AI] 6단계 서버별 설정 상태 추가
  const [selectedServer, setSelectedServer] = useState<string>('callbot');
  const [serverConfigs, setServerConfigs] = useState<Record<string, any>>({
    callbot: { ...autoScalingSettings, ...latencySettings, ...resourceSettings },
    chatbot: { ...autoScalingSettings, ...latencySettings, ...resourceSettings },
    advisor: { ...autoScalingSettings, ...latencySettings, ...resourceSettings },
    stt: { ...autoScalingSettings, ...latencySettings, ...resourceSettings },
    tts: { ...autoScalingSettings, ...latencySettings, ...resourceSettings },
    nlp: { ...autoScalingSettings, ...latencySettings, ...resourceSettings },
    aicm: { ...autoScalingSettings, ...latencySettings, ...resourceSettings }
  });

  // [advice from AI] 8단계 매니페스트 수정 상태 추가
  const [modifiedManifests, setModifiedManifests] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState<Record<string, boolean>>({});

  const [schedulingSettings, setSchedulingSettings] = useState<AdvancedSchedulingConfig>({
    nodeSelector: {},
    affinity: {
      nodeAffinity: {
        enabled: false,
        requiredDuringScheduling: false,
        matchLabels: {}
      },
      podAffinity: {
        enabled: false,
        preferredDuringScheduling: true,
        topologyKey: 'kubernetes.io/hostname'
      },
      podAntiAffinity: {
        enabled: true,
        requiredDuringScheduling: false,
        topologyKey: 'kubernetes.io/hostname'
      }
    },
    tolerations: [],
    priorityClassName: undefined
  });

  // [advice from AI] 하드웨어 사양 가져오기
  useEffect(() => {
    const fetchHardwareSpec = async () => {
      try {
        const response = await fetch('/api/v1/tenants/calculate-detailed-hardware', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...serviceRequirements,
            gpu_type: gpuType,
            include_cloud_mapping: true
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          setHardwareSpec(data.hardware_specification);
        }
      } catch (err) {
        console.warn('하드웨어 사양 로드 실패:', err);
      }
    };
    
    fetchHardwareSpec();
  }, [serviceRequirements, gpuType]);

  // [advice from AI] 다음 단계로 이동 (로딩 상태 안전 관리)
  const handleNext = async () => {
    setError(null);
    
    try {
      if (activeStep === 1) {
        setLoading(true);
        await generateManifests();
      } else if (activeStep === 2) {
        setLoading(true);
        await validateDeployment();
      } else if (activeStep === 6) {
        // 7단계에서 8단계로 이동할 때 매니페스트 자동 생성
        setLoading(true);
        await generateManifests();
      }
      
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
    } catch (error) {
      console.error("단계 이동 중 오류:", error);
      setError("단계 이동 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      // 로딩 상태 항상 해제
      setLoading(false);
    }
  };

  // 이전 단계로 이동
  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  // [advice from AI] 매니페스트 생성 - 모든 클라우드 제공업체용 매니페스트 생성 (타임아웃 추가)
  const generateManifests = async () => {
    try {
      // 모든 클라우드 제공업체용 매니페스트를 병렬로 생성
      const cloudProviders = ['iaas', 'aws', 'ncp'];
      const manifestPromises = cloudProviders.map(async (provider) => {
        // 10초 타임아웃 설정
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(`/api/v1/tenants/${tenantId}/generate-manifests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...serviceRequirements,
            gpu_type: gpuType,
            cloud_provider: provider,
            // [advice from AI] Kubernetes 고급 설정 포함
            kubernetes_advanced_config: {
              auto_scaling: autoScalingSettings,
              latency_config: latencySettings,
              resource_config: resourceSettings,
              scheduling_config: schedulingSettings
            }
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          console.warn(`${provider} 매니페스트 생성 실패`);
          return { provider, success: false, error: `${provider} 매니페스트 생성 실패` };
        }

        const result = await response.json();
        return { provider, success: true, data: result };
      });

      const results = await Promise.all(manifestPromises);
      
      // 성공한 매니페스트들을 통합
      const successfulResults = results.filter(r => r.success);
      if (successfulResults.length === 0) {
        throw new Error('모든 클라우드 제공업체 매니페스트 생성 실패');
      }

      // 첫 번째 성공한 결과를 기본으로 사용하되, 모든 클라우드 제공업체 정보를 포함
      const combinedResult = {
        ...successfulResults[0].data,
        cloud_variants: Object.fromEntries(
          successfulResults.map(r => [r.provider, r.data])
        )
      };

      setManifestPreview(combinedResult);
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
  // [advice from AI] 배포 패키지 다운로드 - 선택된 클라우드 제공업체용
  const downloadPackage = async (cloudProvider: string = selectedCloudProvider) => {
    try {
      const response = await fetch(`/api/v1/tenants/${tenantId}/download-package`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...serviceRequirements,
          gpu_type: gpuType,
          cloud_provider: cloudProvider
        }),
      });
      
      if (!response.ok) {
        throw new Error('다운로드 실패');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ecp-ai-${tenantId}-${cloudProvider}-deployment.zip`;
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
      
      // [advice from AI] 시뮬레이터 자동 설정이 활성화된 경우 자동 배포
      if (simulatorAutoSetup && result.tenant_id) {
        try {
          const simulatorResponse = await fetch(`/api/v1/simulator/deploy/${result.tenant_id}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Demo-Mode': 'false' // 실사용 모드에서만 시뮬레이터 사용
            }
          });
          
          if (simulatorResponse.ok) {
            const simulatorResult = await simulatorResponse.json();
            result.simulator_deployment = simulatorResult;
            result.monitoring_dashboard = simulatorResult.monitoring_dashboard;
            result.websocket_url = simulatorResult.websocket_url;
          } else {
            console.warn('시뮬레이터 자동 배포 실패, 기본 배포는 성공');
          }
        } catch (error) {
          console.warn('시뮬레이터 연동 중 오류:', error);
        }
      }
      
      onDeploymentComplete(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '배포 실행 실패');
    } finally {
      setLoading(false);
    }
  };

  // 테넌시 저장 (배포 없이)
  const handleSaveTenant = () => {
    if (onTenantSaved) {
      const savedTenant = {
        tenant_id: tenantId,
        status: 'pending',
        preset: 'auto', // 프리셋은 자동 계산
        services_count: Object.values(serviceRequirements).filter((v: any) => v > 0).length,
        created_at: new Date().toISOString()
      };
      onTenantSaved(savedTenant);
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
                <Paper sx={{ p: 3, backgroundColor: 'primary.50', border: '1px solid', borderColor: 'primary.200' }}>
                  <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ color: 'primary.dark', display: 'flex', alignItems: 'center' }}>
                    🎯 ECP-AI 서비스 아키텍처 구성
                    <Tooltip title="Enterprise Communication Platform - AI 기반 통합 서비스">
                      <InfoIcon sx={{ ml: 1, fontSize: 18 }} />
                    </Tooltip>
                  </Typography>
                  
                  {/* 메인 서비스 */}
                  {(serviceRequirements.callbot > 0 || serviceRequirements.chatbot > 0 || serviceRequirements.advisor > 0) && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, color: 'success.dark' }}>
                        📞 핵심 커뮤니케이션 서비스
                      </Typography>
                      <Box sx={{ pl: 2 }}>
                        {serviceRequirements.callbot > 0 && (
                          <Box sx={{ mb: 1 }}>
                            <Chip label={`콜봇 ${serviceRequirements.callbot}채널`} color="success" size="small" sx={{ mr: 1 }} />
                            <Typography variant="caption" color="text.secondary">
                              → TTS GPU 서버, STT CPU 서버 (전용)
                            </Typography>
                          </Box>
                        )}
                        {serviceRequirements.chatbot > 0 && (
                          <Box sx={{ mb: 1 }}>
                            <Chip label={`챗봇 ${serviceRequirements.chatbot}채널`} color="success" size="small" sx={{ mr: 1 }} />
                            <Typography variant="caption" color="text.secondary">
                              → NLP GPU 서버, AICM GPU 서버 (전용)
                            </Typography>
                          </Box>
                        )}
                        {serviceRequirements.advisor > 0 && (
                          <Box sx={{ mb: 1 }}>
                            <Chip label={`어드바이저 ${serviceRequirements.advisor}채널`} color="success" size="small" sx={{ mr: 1 }} />
                            <Typography variant="caption" color="text.secondary">
                              → AICM GPU 서버, NLP GPU 서버 (전용)
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  )}

                  {/* 지원 서비스 */}
                  {(serviceRequirements.ta > 0 || serviceRequirements.qa > 0 || serviceRequirements.stt > 0 || serviceRequirements.tts > 0) && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, color: 'warning.dark' }}>
                        🛠️ 품질 관리 및 분석 서비스
                      </Typography>
                      <Box sx={{ pl: 2 }}>
                        {serviceRequirements.ta > 0 && (
                          <Box sx={{ mb: 1 }}>
                            <Chip label={`TA 분석 ${serviceRequirements.ta}채널`} color="warning" size="small" sx={{ mr: 1 }} />
                            <Typography variant="caption" color="text.secondary">
                              → TA CPU 서버 (전용), NLP GPU 서버 연동
                            </Typography>
                          </Box>
                        )}
                        {serviceRequirements.qa > 0 && (
                          <Box sx={{ mb: 1 }}>
                            <Chip label={`QA 평가 ${serviceRequirements.qa}채널`} color="warning" size="small" sx={{ mr: 1 }} />
                            <Typography variant="caption" color="text.secondary">
                              → QA CPU 서버 (전용)
                            </Typography>
                          </Box>
                        )}
                        {serviceRequirements.stt > 0 && (
                          <Box sx={{ mb: 1 }}>
                            <Chip label={`독립 STT ${serviceRequirements.stt}채널`} color="info" size="small" sx={{ mr: 1 }} />
                            <Typography variant="caption" color="text.secondary">
                              → STT CPU 서버 (독립 운영)
                            </Typography>
                          </Box>
                        )}
                        {serviceRequirements.tts > 0 && (
                          <Box sx={{ mb: 1 }}>
                            <Chip label={`독립 TTS ${serviceRequirements.tts}채널`} color="info" size="small" sx={{ mr: 1 }} />
                            <Typography variant="caption" color="text.secondary">
                              → TTS GPU 서버 (독립 운영)
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  )}

                  {/* 인프라 서비스 */}
                  <Box>
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, color: 'info.dark' }}>
                      🏗️ 공통 인프라스트럭처 서비스 (모든 서비스 공유)
                    </Typography>
                    <Box sx={{ pl: 2 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        • <strong>Nginx 서버 (1대):</strong> 로드 밸런서, API Gateway
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        • <strong>PostgreSQL 서버 (1대):</strong> 메타데이터, 사용자 정보
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        • <strong>VectorDB 서버 (1대):</strong> 임베딩 벡터 저장
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        • <strong>Redis 서버 (1대):</strong> 캐싱, 세션 관리
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        • <strong>Auth Service 서버 (1대):</strong> 인증, 권한 관리
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        • <strong>NAS 서버 (1대):</strong> 파일, 모델 저장소
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, backgroundColor: 'success.50', border: '1px solid', borderColor: 'success.200' }}>
                  <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ color: 'success.dark' }}>
                    ⚙️ 배포 구성 정보
                  </Typography>
                  
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, color: 'primary.dark' }}>
                      🏷️ 테넌시 식별 정보
                    </Typography>
                    <Box sx={{ pl: 2 }}>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>테넌시 ID:</strong> <Chip label={tenantId} size="small" color="primary" variant="outlined" />
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Kubernetes 네임스페이스: ecp-ai-{tenantId}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, color: 'warning.dark' }}>
                      🎮 GPU 가속 설정
                    </Typography>
                    <Box sx={{ pl: 2 }}>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>GPU 타입:</strong> <Chip label={gpuType.toUpperCase()} size="small" color="warning" variant="outlined" />
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {gpuType === 'auto' ? '자동 선택 (최적 성능/비용)' :
                         gpuType === 't4' ? 'NVIDIA T4 (가성비 최적화)' :
                         gpuType === 'v100' ? 'NVIDIA V100 (균형 성능)' :
                         'NVIDIA L40S (고성능 워크로드)'}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, color: 'info.dark' }}>
                      📊 리소스 최적화 정책
                    </Typography>
                    <Box sx={{ pl: 2 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        • <strong>스케일링:</strong> HPA (수평 자동 확장)
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        • <strong>리소스 한계:</strong> CPU/Memory 제한 설정
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        • <strong>헬스체크:</strong> Liveness/Readiness Probe
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        • <strong>보안 정책:</strong> RBAC, Network Policy
                      </Typography>
                    </Box>
                  </Box>

                  <Alert severity="success" sx={{ mt: 2 }}>
                    <Typography variant="caption">
                      <strong>총 예상 서버:</strong> {
                        hardwareSpec ? (
                          (hardwareSpec.gpu_servers?.reduce((sum: number, server: any) => sum + (server.quantity || 1), 0) || 0) +
                          (hardwareSpec.cpu_servers?.reduce((sum: number, server: any) => sum + (server.quantity || 1), 0) || 0) +
                          (hardwareSpec.infrastructure_servers?.reduce((sum: number, server: any) => sum + (server.quantity || 1), 0) || 0)
                        ) : '계산 중...'
                      }대 {hardwareSpec && `(GPU ${hardwareSpec.gpu_servers?.reduce((sum: number, server: any) => sum + (server.quantity || 1), 0) || 0}대 + CPU ${hardwareSpec.cpu_servers?.reduce((sum: number, server: any) => sum + (server.quantity || 1), 0) || 0}대 + 인프라 ${hardwareSpec.infrastructure_servers?.reduce((sum: number, server: any) => sum + (server.quantity || 1), 0) || 0}대)`}
                    </Typography>
                  </Alert>
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
              <AlertTitle>💡 환경변수 설정 가이드</AlertTitle>
              <Typography variant="body2">
                • <strong>필수 항목:</strong> OPENAI_API_KEY, JWT_SECRET, ENCRYPTION_KEY<br/>
                • <strong>선택 항목:</strong> 기본값이 설정되어 있으며 필요시 수정 가능<br/>
                • <strong>보안:</strong> 민감한 정보는 Kubernetes Secret으로 자동 관리
              </Typography>
            </Alert>
            
            {/* [advice from AI] 실제 환경변수 입력 폼 구현 */}
            <Grid container spacing={3}>
              {Object.entries(envVars).map(([key, value]) => {
                const isRequired = ['OPENAI_API_KEY', 'JWT_SECRET', 'ENCRYPTION_KEY'].includes(key);
                const isPassword = key.includes('SECRET') || key.includes('KEY') || key.includes('PASSWORD');
                
                return (
                  <Grid item xs={12} md={6} key={key}>
                    <TextField
                      fullWidth
                      label={key}
                      value={value}
                      onChange={(e) => setEnvVars(prev => ({...prev, [key]: e.target.value}))}
                      type={isPassword ? 'password' : 'text'}
                      required={isRequired}
                      variant="outlined"
                      size="small"
                      helperText={
                        key === 'OPENAI_API_KEY' ? 'OpenAI API 키 (필수)' :
                        key === 'DATABASE_URL' ? 'PostgreSQL 연결 문자열' :
                        key === 'REDIS_URL' ? 'Redis 연결 문자열' :
                        key === 'JWT_SECRET' ? 'JWT 토큰 서명용 비밀키 (필수)' :
                        key === 'ENCRYPTION_KEY' ? '데이터 암호화용 키 (필수)' :
                        key === 'LOG_LEVEL' ? 'DEBUG, INFO, WARN, ERROR 중 선택' :
                        key === 'ENVIRONMENT' ? 'development, staging, production 중 선택' :
                        key === 'MAX_WORKERS' ? '워커 프로세스 수' :
                        key === 'TIMEOUT_SECONDS' ? '요청 타임아웃 (초)' :
                        '기본값 사용 또는 필요시 수정'
                      }
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          backgroundColor: isRequired && !value ? 'error.50' : 'background.paper'
                        }
                      }}
                    />
                  </Grid>
                );
              })}
            </Grid>
            
            <Box sx={{ mt: 3 }}>
              <Paper sx={{ p: 2, backgroundColor: 'success.50' }}>
                <Typography variant="subtitle2" gutterBottom>
                  ✅ 설정 완료 상태
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  필수 환경변수: {['OPENAI_API_KEY', 'JWT_SECRET', 'ENCRYPTION_KEY'].filter(key => envVars[key]).length}/3 완료<br/>
                  전체 환경변수: {Object.values(envVars).filter(v => v).length}/{Object.keys(envVars).length} 설정됨
                </Typography>
              </Paper>
            </Box>
          </StepCard>
        );

      case 2:
        return (
          <StepCard>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom color="primary">
                📦 3단계: 볼륨 & 스토리지 설정
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                데이터 저장소와 설정 파일을 위한 볼륨을 설정합니다. 
                업계 표준 기본값이 적용되어 있으며 필요시 수정 가능합니다.
              </Typography>
            </Box>
            
            <Alert severity="info" sx={{ mb: 3 }}>
              <AlertTitle>💡 볼륨 설정 가이드</AlertTitle>
              <Typography variant="body2">
                • <strong>데이터 볼륨:</strong> 애플리케이션 데이터 저장 (50GB 권장)<br/>
                • <strong>로그 볼륨:</strong> 로그 파일 저장 (20GB 권장)<br/>
                • <strong>설정 볼륨:</strong> 구성 파일 저장 (1GB 충분)
              </Typography>
            </Alert>
            
            <Grid container spacing={3}>
              {Object.entries(volumeSettings).map(([key, volume]) => (
                <Grid item xs={12} md={4} key={key}>
                  <Paper sx={{ p: 2, height: '100%' }}>
                    <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                      {key === 'dataVolume' ? '📊 데이터 볼륨' :
                       key === 'logsVolume' ? '📝 로그 볼륨' : '⚙️ 설정 볼륨'}
                    </Typography>
                    
                    <TextField
                      fullWidth
                      label="볼륨 이름"
                      value={volume.name}
                      onChange={(e) => setVolumeSettings(prev => ({
                        ...prev,
                        [key]: { ...volume, name: e.target.value }
                      }))}
                      size="small"
                      sx={{ mb: 2 }}
                    />
                    
                    <TextField
                      fullWidth
                      label="크기"
                      value={volume.size}
                      onChange={(e) => setVolumeSettings(prev => ({
                        ...prev,
                        [key]: { ...volume, size: e.target.value }
                      }))}
                      size="small"
                      sx={{ mb: 2 }}
                      helperText="예: 50Gi, 100Gi"
                    />
                    
                    <FormControl fullWidth size="small">
                      <InputLabel>스토리지 클래스</InputLabel>
                      <Select
                        value={volume.storageClass}
                        label="스토리지 클래스"
                        onChange={(e) => setVolumeSettings(prev => ({
                          ...prev,
                          [key]: { ...volume, storageClass: e.target.value }
                        }))}
                      >
                        <MenuItem value="gp2">gp2 (범용 SSD)</MenuItem>
                        <MenuItem value="gp3">gp3 (최신 SSD)</MenuItem>
                        <MenuItem value="io1">io1 (고성능 SSD)</MenuItem>
                        <MenuItem value="sc1">sc1 (Cold HDD)</MenuItem>
                      </Select>
                    </FormControl>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </StepCard>
        );

      case 3:
        return (
          <StepCard>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom color="primary">
                📡 4단계: 네트워크 & 보안 설정
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                외부 접근과 보안 정책을 설정합니다. 
                엔터프라이즈 환경에 적합한 보안 기본값이 적용되어 있습니다.
              </Typography>
            </Box>
            
            <Alert severity="warning" sx={{ mb: 3 }}>
              <AlertTitle>🔒 보안 권장사항</AlertTitle>
              <Typography variant="body2">
                • <strong>ClusterIP:</strong> 내부 통신만 허용 (권장)<br/>
                • <strong>Ingress + TLS:</strong> HTTPS 암호화 통신<br/>
                • <strong>Network Policy:</strong> 트래픽 제한으로 보안 강화
              </Typography>
            </Alert>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                    🌐 서비스 노출 설정
                  </Typography>
                  
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>서비스 타입</InputLabel>
                    <Select
                      value={networkSettings.serviceType}
                      label="서비스 타입"
                      onChange={(e) => setNetworkSettings(prev => ({
                        ...prev,
                        serviceType: e.target.value
                      }))}
                    >
                      <MenuItem value="ClusterIP">ClusterIP (내부 전용)</MenuItem>
                      <MenuItem value="NodePort">NodePort (노드 포트)</MenuItem>
                      <MenuItem value="LoadBalancer">LoadBalancer (로드밸런서)</MenuItem>
                    </Select>
                  </FormControl>
                  
                  <FormControlLabel
                    control={
                      <Switch 
                        checked={networkSettings.ingressEnabled}
                        onChange={(e) => setNetworkSettings(prev => ({
                          ...prev,
                          ingressEnabled: e.target.checked
                        }))}
                      />
                    }
                    label="Ingress 활성화"
                    sx={{ mb: 1 }}
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch 
                        checked={networkSettings.tlsEnabled}
                        onChange={(e) => setNetworkSettings(prev => ({
                          ...prev,
                          tlsEnabled: e.target.checked
                        }))}
                      />
                    }
                    label="TLS/HTTPS 사용"
                  />
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                    🛡️ 보안 정책
                  </Typography>
                  
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>네트워크 정책</InputLabel>
                    <Select
                      value={networkSettings.networkPolicy}
                      label="네트워크 정책"
                      onChange={(e) => setNetworkSettings(prev => ({
                        ...prev,
                        networkPolicy: e.target.value
                      }))}
                    >
                      <MenuItem value="open">Open (모든 트래픽 허용)</MenuItem>
                      <MenuItem value="restricted">Restricted (제한적 허용)</MenuItem>
                      <MenuItem value="strict">Strict (최소 권한)</MenuItem>
                    </Select>
                  </FormControl>
                  
                  <Typography variant="body2" color="text.secondary">
                    현재 설정: <strong>{networkSettings.networkPolicy}</strong><br/>
                    {networkSettings.networkPolicy === 'restricted' ? 
                      '✅ 권장: 필요한 포트만 허용' :
                      networkSettings.networkPolicy === 'strict' ?
                      '🔒 최고 보안: 최소 권한 원칙' :
                      '⚠️ 주의: 모든 트래픽 허용'
                    }
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </StepCard>
        );

      case 4:
        return (
          <StepCard>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom color="primary">
                ⚙️ 5단계: 헬스체크 & 모니터링 설정
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                서비스 상태를 모니터링하기 위한 헬스체크를 설정합니다. 
                Kubernetes 운영 모범사례에 따른 기본값이 적용되어 있습니다.
              </Typography>
            </Box>
            
            <Alert severity="success" sx={{ mb: 3 }}>
              <AlertTitle>💡 헬스체크 종류</AlertTitle>
              <Typography variant="body2">
                • <strong>Liveness:</strong> 컨테이너 재시작 여부 결정<br/>
                • <strong>Readiness:</strong> 트래픽 수신 준비 상태 확인<br/>
                • <strong>Startup:</strong> 초기 시작 완료 확인
              </Typography>
            </Alert>

            {/* [advice from AI] K8S Simulator 자동 모니터링 설정 추가 */}
            <Alert severity="info" sx={{ mb: 3 }}>
              <AlertTitle>🚀 K8S Simulator 자동 모니터링</AlertTitle>
              <FormControlLabel
                control={
                  <Switch 
                    checked={simulatorAutoSetup}
                    onChange={(e) => setSimulatorAutoSetup(e.target.checked)}
                  />
                }
                label="K8S Simulator 데이터 생성기와 자동 연결"
                sx={{ mb: 1 }}
              />
              <Typography variant="body2" color="text.secondary">
                {simulatorAutoSetup 
                  ? "✅ 실사용 모드 배포 시 K8S Simulator로 자동 연결되어 SLA 99.5% 모니터링 및 가상 배포 테스트가 시작됩니다."
                  : "❌ 수동 모니터링 설정을 사용합니다. (기본 헬스체크만 적용)"}
              </Typography>
              {simulatorAutoSetup && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'primary.50', borderRadius: 1 }}>
                  <Typography variant="caption" display="block" sx={{ mb: 1 }}>
                    <strong>자동 설정 포함 내용:</strong>
                  </Typography>
                  <Typography variant="caption" display="block">
                    • 매니페스트 자동 검증 및 시뮬레이터 배포
                  </Typography>
                  <Typography variant="caption" display="block">
                    • 실시간 CPU, Memory, Network 메트릭 수집
                  </Typography>
                  <Typography variant="caption" display="block">
                    • SLA 99.5% 달성률 추적 및 알림
                  </Typography>
                  <Typography variant="caption" display="block">
                    • 고급 모니터링 대시보드 자동 연결
                  </Typography>
                </Box>
              )}
            </Alert>
            
            <Grid container spacing={3}>
              {Object.entries(healthSettings).map(([probeType, probe]) => (
                <Grid item xs={12} md={4} key={probeType}>
                  <Paper sx={{ p: 2, height: '100%' }}>
                    <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                      {probeType === 'livenessProbe' ? '💓 Liveness Probe' :
                       probeType === 'readinessProbe' ? '🚦 Readiness Probe' : '🚀 Startup Probe'}
                    </Typography>
                    
                    <FormControlLabel
                      control={
                        <Switch 
                          checked={probe.enabled}
                          onChange={(e) => setHealthSettings(prev => ({
                            ...prev,
                            [probeType]: { ...probe, enabled: e.target.checked }
                          }))}
                        />
                      }
                      label="활성화"
                      sx={{ mb: 2 }}
                    />
                    
                    {probe.enabled && (
                      <>
                        <TextField
                          fullWidth
                          label="Health Check Path"
                          value={probe.path}
                          onChange={(e) => setHealthSettings(prev => ({
                            ...prev,
                            [probeType]: { ...probe, path: e.target.value }
                          }))}
                          size="small"
                          sx={{ mb: 2 }}
                          helperText="예: /health, /ready"
                        />
                        
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="caption" gutterBottom>
                            초기 지연: {probe.initialDelay}초
                          </Typography>
                          <Slider
                            value={probe.initialDelay}
                            onChange={(_, value) => setHealthSettings(prev => ({
                              ...prev,
                              [probeType]: { ...probe, initialDelay: value as number }
                            }))}
                            min={0}
                            max={60}
                            step={5}
                            size="small"
                          />
                        </Box>
                        
                        <Box>
                          <Typography variant="caption" gutterBottom>
                            검사 주기: {probe.period}초
                          </Typography>
                          <Slider
                            value={probe.period}
                            onChange={(_, value) => setHealthSettings(prev => ({
                              ...prev,
                              [probeType]: { ...probe, period: value as number }
                            }))}
                            min={5}
                            max={30}
                            step={5}
                            size="small"
                          />
                        </Box>
                      </>
                    )}
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </StepCard>
        );

      case 5:
        return (
          <StepCard>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom color="primary">
                ⚙️ 6단계: 서버별 최적화 설정
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                각 서비스별로 오토스케일링, 지연시간 최적화, 리소스 제한을 개별적으로 설정합니다.
              </Typography>
            </Box>
            
            {/* [advice from AI] 좌우 분할 레이아웃 구현 */}
            <Grid container spacing={3}>
              {/* 좌측: 서버 선택 및 설정 */}
              <Grid item xs={12} md={6}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom color="primary">
                      🖥️ 서버 선택 및 설정
                    </Typography>
                    
                    {/* 서버 선택 */}
                    <FormControl fullWidth sx={{ mb: 3 }}>
                      <InputLabel>서버 선택</InputLabel>
                      <Select
                        value={selectedServer}
                        onChange={(e) => setSelectedServer(e.target.value)}
                        label="서버 선택"
                      >
                        {Object.keys(serverConfigs).map((server) => (
                          <MenuItem key={server} value={server}>
                            {server.toUpperCase()}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    
                    {/* 선택된 서버의 현재 설정 표시 */}
                    <Typography variant="subtitle2" gutterBottom>
                      현재 설정: {selectedServer.toUpperCase()}
                    </Typography>
                    
                    {/* 설정 변경 버튼들 */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => {
                          // 설정 변경 로직
                        }}
                      >
                        설정 변경
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        color="secondary"
                        onClick={() => {
                          // 설정 초기화 로직
                        }}
                      >
                        기본값으로 초기화
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              
              {/* 우측: 실시간 미리보기 */}
              <Grid item xs={12} md={6}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom color="primary">
                      👁️ 실시간 설정 미리보기
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {selectedServer.toUpperCase()} 서버의 현재 설정을 미리보기합니다.
                    </Typography>
                    
                    {/* 설정 요약 표시 */}
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        오토스케일링: {serverConfigs[selectedServer]?.enabled ? '활성화' : '비활성화'}
                      </Typography>
                      <Typography variant="subtitle2" gutterBottom>
                        최소 Pod: {serverConfigs[selectedServer]?.minReplicas || 'N/A'}
                      </Typography>
                      <Typography variant="subtitle2" gutterBottom>
                        최대 Pod: {serverConfigs[selectedServer]?.maxReplicas || 'N/A'}
                      </Typography>
                      <Typography variant="subtitle2" gutterBottom>
                        CPU 임계값: {serverConfigs[selectedServer]?.targetCPU || 'N/A'}%
                      </Typography>
                    </Box>
                    
                    {/* 매니페스트 적용 버튼 */}
                    <Button
                      variant="contained"
                      color="primary"
                      fullWidth
                      sx={{ mt: 3 }}
                      onClick={() => {
                        // 매니페스트에 설정 적용 로직
                      }}
                    >
                      매니페스트에 설정 적용
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* 오토스케일링 설정 */}
            <Accordion defaultExpanded sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  🔄 HPA (Horizontal Pod Autoscaler) 설정
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={autoScalingSettings.enabled}
                          onChange={(e) => setAutoScalingSettings(prev => ({
                            ...prev,
                            enabled: e.target.checked
                          }))}
                        />
                      }
                      label="오토스케일링 활성화"
                    />
                  </Grid>
                  
                  {autoScalingSettings.enabled && (
                    <>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="최소 Pod 수"
                          type="number"
                          value={autoScalingSettings.minReplicas}
                          onChange={(e) => setAutoScalingSettings(prev => ({
                            ...prev,
                            minReplicas: parseInt(e.target.value)
                          }))}
                          InputProps={{ inputProps: { min: 1, max: 100 } }}
                          helperText="서비스가 유지할 최소 Pod 수"
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="최대 Pod 수"
                          type="number"
                          value={autoScalingSettings.maxReplicas}
                          onChange={(e) => setAutoScalingSettings(prev => ({
                            ...prev,
                            maxReplicas: parseInt(e.target.value)
                          }))}
                          InputProps={{ inputProps: { min: 1, max: 1000 } }}
                          helperText="확장 가능한 최대 Pod 수"
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <Typography gutterBottom>CPU 사용률 임계값: {autoScalingSettings.targetCPU}%</Typography>
                        <Slider
                          value={autoScalingSettings.targetCPU}
                          onChange={(_, value) => setAutoScalingSettings(prev => ({
                            ...prev,
                            targetCPU: value as number
                          }))}
                          min={10}
                          max={95}
                          step={5}
                          marks={[
                            { value: 50, label: '50%' },
                            { value: 70, label: '70%' },
                            { value: 90, label: '90%' }
                          ]}
                          valueLabelDisplay="auto"
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <Typography gutterBottom>메모리 사용률 임계값: {autoScalingSettings.targetMemory}%</Typography>
                        <Slider
                          value={autoScalingSettings.targetMemory}
                          onChange={(_, value) => setAutoScalingSettings(prev => ({
                            ...prev,
                            targetMemory: value as number
                          }))}
                          min={10}
                          max={95}
                          step={5}
                          marks={[
                            { value: 60, label: '60%' },
                            { value: 80, label: '80%' },
                            { value: 90, label: '90%' }
                          ]}
                          valueLabelDisplay="auto"
                        />
                      </Grid>
                    </>
                  )}
                </Grid>
              </AccordionDetails>
            </Accordion>
            
            {/* 지연시간 최적화 설정 */}
            <Accordion sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  ⏱️ 지연시간 최적화 설정
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={4}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={latencySettings.startupProbe.enabled}
                          onChange={(e) => setLatencySettings(prev => ({
                            ...prev,
                            startupProbe: { ...prev.startupProbe, enabled: e.target.checked }
                          }))}
                        />
                      }
                      label="Startup Probe 활성화"
                    />
                    {latencySettings.startupProbe.enabled && (
                      <TextField
                        fullWidth
                        size="small"
                        label="초기 지연 시간 (초)"
                        type="number"
                        value={latencySettings.startupProbe.initialDelaySeconds}
                        onChange={(e) => setLatencySettings(prev => ({
                          ...prev,
                          startupProbe: { ...prev.startupProbe, initialDelaySeconds: parseInt(e.target.value) }
                        }))}
                        sx={{ mt: 1 }}
                      />
                    )}
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Liveness Probe 초기 지연 (초)"
                      type="number"
                      value={latencySettings.livenessProbe.initialDelaySeconds}
                      onChange={(e) => setLatencySettings(prev => ({
                        ...prev,
                        livenessProbe: { ...prev.livenessProbe, initialDelaySeconds: parseInt(e.target.value) }
                      }))}
                      helperText="컨테이너 시작 후 첫 검사까지의 대기 시간"
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Readiness Probe 초기 지연 (초)"
                      type="number"
                      value={latencySettings.readinessProbe.initialDelaySeconds}
                      onChange={(e) => setLatencySettings(prev => ({
                        ...prev,
                        readinessProbe: { ...prev.readinessProbe, initialDelaySeconds: parseInt(e.target.value) }
                      }))}
                      helperText="트래픽 수신 준비 검사 시작 시간"
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Max Surge"
                      value={latencySettings.rollingUpdate.maxSurge}
                      onChange={(e) => setLatencySettings(prev => ({
                        ...prev,
                        rollingUpdate: { ...prev.rollingUpdate, maxSurge: e.target.value }
                      }))}
                      helperText="업데이트 중 추가 생성 가능한 Pod 수 (예: 25%, 2)"
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Max Unavailable"
                      value={latencySettings.rollingUpdate.maxUnavailable}
                      onChange={(e) => setLatencySettings(prev => ({
                        ...prev,
                        rollingUpdate: { ...prev.rollingUpdate, maxUnavailable: e.target.value }
                      }))}
                      helperText="업데이트 중 사용 불가능한 Pod 수 (예: 25%, 1)"
                    />
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>

            {/* 리소스 제한 설정 */}
            <Accordion sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  💾 리소스 제한 설정
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom color="primary">
                      리소스 요청량 (Requests) - 보장되는 최소 리소스
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="CPU 요청량"
                      value={resourceSettings.requests.cpu}
                      onChange={(e) => setResourceSettings(prev => ({
                        ...prev,
                        requests: { ...prev.requests, cpu: e.target.value }
                      }))}
                      helperText="예: 100m, 0.5, 1"
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="메모리 요청량"
                      value={resourceSettings.requests.memory}
                      onChange={(e) => setResourceSettings(prev => ({
                        ...prev,
                        requests: { ...prev.requests, memory: e.target.value }
                      }))}
                      helperText="예: 256Mi, 1Gi, 2Gi"
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="스토리지 요청량"
                      value={resourceSettings.requests.ephemeralStorage || ''}
                      onChange={(e) => setResourceSettings(prev => ({
                        ...prev,
                        requests: { ...prev.requests, ephemeralStorage: e.target.value }
                      }))}
                      helperText="예: 1Gi, 5Gi"
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom color="primary" sx={{ mt: 2 }}>
                      리소스 제한량 (Limits) - 최대 사용 가능한 리소스
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="CPU 제한량"
                      value={resourceSettings.limits.cpu}
                      onChange={(e) => setResourceSettings(prev => ({
                        ...prev,
                        limits: { ...prev.limits, cpu: e.target.value }
                      }))}
                      helperText="예: 1000m, 2, 4"
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="메모리 제한량"
                      value={resourceSettings.limits.memory}
                      onChange={(e) => setResourceSettings(prev => ({
                        ...prev,
                        limits: { ...prev.limits, memory: e.target.value }
                      }))}
                      helperText="예: 1Gi, 2Gi, 4Gi"
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="스토리지 제한량"
                      value={resourceSettings.limits.ephemeralStorage || ''}
                      onChange={(e) => setResourceSettings(prev => ({
                        ...prev,
                        limits: { ...prev.limits, ephemeralStorage: e.target.value }
                      }))}
                      helperText="예: 2Gi, 10Gi"
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>QoS 클래스</InputLabel>
                      <Select
                        value={resourceSettings.qosClass}
                        onChange={(e) => setResourceSettings(prev => ({
                          ...prev,
                          qosClass: e.target.value as 'Guaranteed' | 'Burstable' | 'BestEffort'
                        }))}
                        label="QoS 클래스"
                      >
                        <MenuItem value="Guaranteed">Guaranteed - 최고 우선순위</MenuItem>
                        <MenuItem value="Burstable">Burstable - 중간 우선순위</MenuItem>
                        <MenuItem value="BestEffort">BestEffort - 최저 우선순위</MenuItem>
                      </Select>
                      <FormHelperText>
                        Pod의 서비스 품질 클래스를 결정합니다
                      </FormHelperText>
                    </FormControl>
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
            
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
                📋 7단계: 매니페스트 생성 준비
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
                      API 키, 데이터베이스 연결 등 환경변수 설정 완료
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
                  
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" fontWeight="bold" color="success.main">
                      🚀 Kubernetes 고급 설정
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      오토스케일링, 지연시간 최적화, 리소스 제한 설정 완료
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
                  '다음' 버튼을 클릭하면 Kubernetes 매니페스트 생성을 시작합니다.
                </Typography>
              </Alert>
            </Box>
          </StepCard>
        );

      case 7:
        return (
          <StepCard>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom color="primary">
                📄 8단계: 매니페스트 생성 및 확인
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
                  {/* 좌측: 파일 목록 (그대로 유지) */}
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
                  
                  {/* 우측: 통합된 미리보기 및 편집 영역 */}
                  <Grid item xs={12} md={8}>
                    <Paper sx={{ 
                      p: 2, 
                      backgroundColor: 'grey.50', 
                      height: '500px',
                      display: 'flex',
                      flexDirection: 'column'
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Typography variant="subtitle1" fontWeight="bold">
                            📝 매니페스트 통합 편집기
                          </Typography>
                          {selectedManifest && (
                            <Chip 
                              label={selectedManifest} 
                              size="small" 
                              color="primary" 
                              sx={{ ml: 1 }}
                            />
                          )}
                        </Box>
                        
                        {selectedManifest && (
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<EditIcon />}
                              onClick={() => {
                                // 편집 모드 토글
                                setIsEditMode(!isEditMode);
                              }}
                            >
                              {isEditMode ? '읽기 전용' : '편집 모드'}
                            </Button>
                            {isEditMode && (
                              <>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => {
                                    // 원본으로 되돌리기
                                    setModifiedManifests(prev => {
                                      const newState = { ...prev };
                                      delete newState[selectedManifest];
                                      return newState;
                                    });
                                  }}
                                >
                                  원본으로 되돌리기
                                </Button>
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="warning"
                                  onClick={() => {
                                    // 수정 내용 저장
                                    console.log('수정 내용 저장:', selectedManifest);
                                  }}
                                >
                                  수정 내용 저장
                                </Button>
                              </>
                            )}
                          </Box>
                        )}
                      </Box>
                      
                      {selectedManifest ? (
                        <Box sx={{ 
                          flex: 1, 
                          overflow: 'auto',
                          backgroundColor: 'white',
                          border: '1px solid #e0e0e0',
                          borderRadius: 1,
                          p: 1
                        }}>
                          {isEditMode ? (
                            <TextField
                              multiline
                              fullWidth
                              variant="outlined"
                              value={modifiedManifests[selectedManifest] || manifestPreview.manifests[selectedManifest]}
                              onChange={(e) => {
                                setModifiedManifests(prev => ({
                                  ...prev,
                                  [selectedManifest]: e.target.value
                                }));
                              }}
                              sx={{ 
                                height: '100%',
                                '& .MuiInputBase-root': { 
                                  fontFamily: 'monospace',
                                  fontSize: '0.875rem',
                                  height: '100%'
                                },
                                '& .MuiInputBase-inputMultiline': {
                                  height: '100% !important',
                                  overflow: 'auto'
                                }
                              }}
                            />
                          ) : (
                            <ManifestViewer>
                              {modifiedManifests[selectedManifest] || manifestPreview.manifests[selectedManifest]}
                            </ManifestViewer>
                          )}
                        </Box>
                      ) : (
                        <Box sx={{ 
                          flex: 1,
                          display: 'flex', 
                          flexDirection: 'column',
                          alignItems: 'center', 
                          justifyContent: 'center',
                          color: 'text.secondary',
                          backgroundColor: 'white',
                          border: '1px solid #e0e0e0',
                          borderRadius: 1
                        }}>
                          <EditIcon sx={{ fontSize: 32, color: 'grey.400', mb: 1 }} />
                          <Typography variant="body2">
                            왼쪽에서 파일을 선택하여 내용을 확인하고 편집하세요
                          </Typography>
                        </Box>
                      )}
                    </Paper>
                  </Grid>
                </Grid>
                
                <Box sx={{ mt: 4, textAlign: 'center' }}>
                  <Alert severity="info" sx={{ mb: 3 }}>
                    <AlertTitle>🚀 매니페스트 확인 및 수정 완료!</AlertTitle>
                    <Typography variant="body2">
                      생성된 매니페스트를 확인하고 필요한 수정을 완료했습니다. 
                      아래의 "다음" 버튼을 클릭하여 다음 단계로 진행하세요.
                    </Typography>
                  </Alert>
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

      case 8:
        return (
          <StepCard>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom color="primary">
                🚀 9단계: 다운로드 및 배포
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
                    이제 클라우드 제공업체를 선택하고 다운로드하거나 배포할 수 있습니다.
                  </Typography>
                </Alert>
                
                {/* [advice from AI] 클라우드 제공업체 선택 UI 추가 */}
                <Paper sx={{ p: 3, mb: 3, backgroundColor: 'grey.50' }}>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                    ☁️ 클라우드 제공업체 선택
                    <Tooltip title="각 클라우드 제공업체에 최적화된 매니페스트가 다운로드됩니다">
                      <InfoIcon sx={{ ml: 1, fontSize: 20, color: 'text.secondary' }} />
                    </Tooltip>
                  </Typography>
                  
                  <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid item xs={12} sm={4}>
                      <Button
                        variant={selectedCloudProvider === 'iaas' ? 'contained' : 'outlined'}
                        fullWidth
                        onClick={() => setSelectedCloudProvider('iaas')}
                        sx={{ py: 2 }}
                      >
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="subtitle1" fontWeight="bold">
                            🏢 기본 IaaS
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            범용 Kubernetes 환경
                          </Typography>
                        </Box>
                      </Button>
                    </Grid>
                    
                    <Grid item xs={12} sm={4}>
                      <Button
                        variant={selectedCloudProvider === 'aws' ? 'contained' : 'outlined'}
                        fullWidth
                        onClick={() => setSelectedCloudProvider('aws')}
                        sx={{ py: 2 }}
                        color="warning"
                      >
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="subtitle1" fontWeight="bold">
                            ☁️ Amazon AWS
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            EKS 최적화 설정
                          </Typography>
                        </Box>
                      </Button>
                    </Grid>
                    
                    <Grid item xs={12} sm={4}>
                      <Button
                        variant={selectedCloudProvider === 'ncp' ? 'contained' : 'outlined'}
                        fullWidth
                        onClick={() => setSelectedCloudProvider('ncp')}
                        sx={{ py: 2 }}
                        color="success"
                      >
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="subtitle1" fontWeight="bold">
                            🌐 Naver NCP
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            NKS 최적화 설정
                          </Typography>
                        </Box>
                      </Button>
                    </Grid>
                  </Grid>
                  
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      <strong>현재 선택:</strong> {
                        selectedCloudProvider === 'iaas' ? '기본 IaaS 환경' :
                        selectedCloudProvider === 'aws' ? 'Amazon Web Services (EKS)' :
                        'Naver Cloud Platform (NKS)'
                      }
                    </Typography>
                  </Alert>
                </Paper>
                
                {/* 액션 버튼들 */}
                <Box sx={{ mt: 4 }}>
                  <Typography variant="h6" gutterBottom color="primary">
                    🚀 최종 배포 옵션
                  </Typography>
                  
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                      <Paper sx={{ p: 3, textAlign: 'center', backgroundColor: 'success.50' }}>
                        <DownloadIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
                        <Typography variant="h6" gutterBottom>
                          📥 배포 패키지 다운로드
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          선택된 클라우드 제공업체({
                            selectedCloudProvider === 'iaas' ? 'IaaS' :
                            selectedCloudProvider === 'aws' ? 'AWS' : 'NCP'
                          })에 최적화된 ZIP 패키지를 다운로드합니다.
                        </Typography>
                        <Button
                          variant="contained"
                          color="success"
                          startIcon={<CloudDownloadIcon />}
                          onClick={() => downloadPackage(selectedCloudProvider)}
                          fullWidth
                          size="large"
                        >
                          {selectedCloudProvider.toUpperCase()} 패키지 다운로드
                        </Button>
                      </Paper>
                    </Grid>
                    
                    <Grid item xs={12} md={4}>
                      <Paper sx={{ p: 3, textAlign: 'center', backgroundColor: 'warning.50' }}>
                        <SaveIcon sx={{ fontSize: 48, color: 'warning.main', mb: 2 }} />
                        <Typography variant="h6" gutterBottom>
                          💾 테넌시 저장
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          테넌시 설정을 저장하여 나중에 배포할 수 있습니다.
                          매니페스트는 생성되지만 클러스터에는 배포되지 않습니다.
                        </Typography>
                        <Button
                          variant="contained"
                          color="warning"
                          startIcon={<SaveIcon />}
                          onClick={handleSaveTenant}
                          fullWidth
                          size="large"
                        >
                          테넌시 저장하기
                        </Button>
                      </Paper>
                    </Grid>
                    
                    <Grid item xs={12} md={4}>
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

        {/* [advice from AI] 네비게이션 버튼 - 취소 버튼 통합 */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 4 }}>
          <Box>
            <Button 
              onClick={onCancel}
              color="secondary"
              variant="outlined"
              sx={{ 
                minWidth: '120px',
                height: '40px'
              }}
            >
              취소
            </Button>
          </Box>
          
          <Box>
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
              sx={{ mr: 1 }}
              variant="outlined"
            >
              ⬅️ 이전
            </Button>
            {activeStep < steps.length - 1 ? (
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={loading}
              >
                {loading ? '⏳ 처리 중...' : '다음 ➡️'}
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
