// [advice from AI] ECP-AI 배포 마법사 - 4단계 간소화 버전
/**
 * 간소화된 테넌시 배포 마법사
 * - 1단계: 테넌시 설정 확인
 * - 2단계: CI/CD 이미지 연동  
 * - 3단계: 매니페스트 생성 및 미리보기
 * - 4단계: 배포 실행
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
  Paper,
  CircularProgress,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  FormControlLabel,
  Switch,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Download as DownloadIcon,
  PlayArrow as PlayArrowIcon,
  Save as SaveIcon,
  CloudDownload as CloudDownloadIcon,
  Rocket as RocketIcon,
  ExpandMore as ExpandMoreIcon
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

// [advice from AI] 서비스별 설정 타입 정의
interface ServiceResources {
  cpu?: string;
  memory?: string;
  gpu?: number;
}

interface ServiceEnvironment {
  [key: string]: string;
}

interface ServiceHealthCheck {
  healthPath?: string;
  readyPath?: string;
  port?: number;
}

interface ServiceAutoScaling {
  minReplicas?: number;
  maxReplicas?: number;
  targetCpu?: number;
  targetMemory?: number;
}

interface ServiceConfiguration {
  resources?: ServiceResources;
  environment?: ServiceEnvironment;
  healthCheck?: ServiceHealthCheck;
  customEnvVars?: string;
  autoScaling?: ServiceAutoScaling;
}

interface ServiceSettings {
  [serviceName: string]: ServiceConfiguration;
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

// [advice from AI] 4단계 구조
const steps = [
  '테넌시 설정 확인',
  'CI/CD 이미지 연동',
  '매니페스트 생성 및 미리보기',
  '배포 실행'
];

const stepDescriptions = [
  '서비스 요구사항과 소규모/대규모 모드를 확인하고 리소스 계산 결과를 검토합니다',
  '필수 서비스별 컨테이너 이미지를 선택하고 레지스트리 연동을 구성합니다',
  '테넌시 모드에 따른 차별화된 매니페스트를 생성하고 배포 내용을 미리 확인합니다',
  '시뮬레이터에 실제 배포를 실행하고 실시간 진행상황을 모니터링합니다'
];

// [advice from AI] 확장된 클라우드 제공업체 목록
const cloudProviders = [
  { id: 'iaas', name: '기본 IaaS', description: '범용 Kubernetes 환경', icon: '🏢', color: 'default' },
  { id: 'aws', name: 'Amazon AWS', description: 'EKS 최적화 설정', icon: '☁️', color: 'warning' },
  { id: 'ncp', name: 'Naver NCP', description: 'NKS 최적화 설정', icon: '🌐', color: 'success' },
  { id: 'azure', name: 'Microsoft Azure', description: 'AKS 최적화 설정', icon: '🔷', color: 'info' },
  { id: 'gcp', name: 'Google Cloud', description: 'GKE 최적화 설정', icon: '🔶', color: 'error' },
  { id: 'oracle', name: 'Oracle Cloud', description: 'OKE 최적화 설정', icon: '🔴', color: 'error' },
  { id: 'ibm', name: 'IBM Cloud', description: 'IKS 최적화 설정', icon: '🔵', color: 'primary' },
  { id: 'alibaba', name: 'Alibaba Cloud', description: 'ACK 최적화 설정', icon: '🟠', color: 'warning' },
  { id: 'tencent', name: 'Tencent Cloud', description: 'TKE 최적화 설정', icon: '🟢', color: 'success' },
  { id: 'vultr', name: 'Vultr', description: 'VKE 최적화 설정', icon: '⚡', color: 'info' },
  { id: 'linode', name: 'Linode', description: 'LKE 최적화 설정', icon: '🟦', color: 'primary' },
  { id: 'digitalocean', name: 'DigitalOcean', description: 'DOKS 최적화 설정', icon: '💧', color: 'info' }
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
  const [selectedCloudProvider, setSelectedCloudProvider] = useState<string>('iaas');
  const [manifestPreview, setManifestPreview] = useState<any>(null);
  
  // [advice from AI] 서비스별 설정 탭 상태 추가
  const [settingsTabValue, setSettingsTabValue] = useState<string>('common');
  
  // [advice from AI] 서비스별 설정 상태 관리
  const [serviceSettings, setServiceSettings] = useState<ServiceSettings>({});
  
  // [advice from AI] 원래 단계의 상세 설정들 복원
  const [envVars, setEnvVars] = useState<{[key: string]: string}>({
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
  
  const [volumeSettings, setVolumeSettings] = useState({
    data: { name: 'tenant-data', size: '50Gi', storageClass: 'gp2' },
    logs: { name: 'tenant-logs', size: '20Gi', storageClass: 'gp2' },
    config: { name: 'tenant-config', size: '1Gi', storageClass: 'gp2' }
  });
  
  const [networkSettings, setNetworkSettings] = useState({
    serviceType: 'ClusterIP',
    ingressEnabled: true,
    tlsEnabled: true,
    networkPolicy: 'restricted'
  });
  
  const [healthSettings, setHealthSettings] = useState({
    livenessProbe: { enabled: true, path: '/health', initialDelay: 30, period: 10 },
    readinessProbe: { enabled: true, path: '/ready', initialDelay: 10, period: 5 },
    startupProbe: { enabled: true, path: '/startup', initialDelay: 60, period: 10 }
  });
  
  const [autoScalingSettings, setAutoScalingSettings] = useState({
    enabled: true,
    minReplicas: 2,
    maxReplicas: 10,
    targetCPU: 70,
    targetMemory: 80
  });
  
  // [advice from AI] 이미지 연동 탭 상태 추가
  const [imageTabValue, setImageTabValue] = useState(0);
  
  // [advice from AI] 하드웨어 계산 결과 상태 추가
  const [hardwareSpec, setHardwareSpec] = useState<any>(null);
  const [hardwareLoading, setHardwareLoading] = useState(false);
  
  // 배포 관련 상태
  const [deploymentProgressOpen, setDeploymentProgressOpen] = useState(false);
  const [deploymentProgress, setDeploymentProgress] = useState(0);
  const [currentDeploymentStep, setCurrentDeploymentStep] = useState(0);
  const [deploymentComplete, setDeploymentComplete] = useState(false);
  const [deploymentResult, setDeploymentResult] = useState<any>(null);
  
  const deploymentSteps = [
    '매니페스트 검증 중...',
    'CI/CD 이미지 레지스트리 연결 중...',
    '컨테이너 이미지 빌드 중...',
    'K8S 시뮬레이터 연결 중...',
    '가상 서버 네임스페이스 생성 중...',
    '서비스별 리소스 생성 중...',
    'Pod 배포 및 시작 중...',
    '서비스 엔드포인트 설정 중...',
    '모니터링 에이전트 설치 중...',
    '배포 완료!'
  ];

  // [advice from AI] 서비스별 설정을 위한 헬퍼 함수들
  const getSelectedServices = () => {
    return Object.entries(serviceRequirements)
      .filter(([_, count]) => (count as number) > 0)
      .map(([serviceName, _]) => serviceName);
  };

  const getServiceTabLabel = (serviceName: string) => {
    const labels: {[key: string]: string} = {
      callbot: '📞 콜봇',
      chatbot: '💬 챗봇', 
      advisor: '👨‍💼 어드바이저',
      stt: '🎤 STT',
      tts: '🔊 TTS',
      ta: '📊 TA',
      qa: '✅ QA'
    };
    return labels[serviceName] || serviceName.toUpperCase();
  };

  // [advice from AI] 서비스별 설정 업데이트 핸들러 함수들 (리소스는 하드웨어 계산기 기반으로 변경)

  const updateServiceEnvironment = (serviceName: string, field: string, value: string) => {
    setServiceSettings(prev => ({
      ...prev,
      [serviceName]: {
        ...prev[serviceName],
        environment: {
          ...prev[serviceName]?.environment,
          [field]: value
        }
      }
    }));
  };

  const updateServiceHealthCheck = (serviceName: string, field: keyof ServiceHealthCheck, value: string | number) => {
    setServiceSettings(prev => ({
      ...prev,
      [serviceName]: {
        ...prev[serviceName],
        healthCheck: {
          ...prev[serviceName]?.healthCheck,
          [field]: value
        }
      }
    }));
  };

  const updateServiceCustomEnvVars = (serviceName: string, value: string) => {
    setServiceSettings(prev => ({
      ...prev,
      [serviceName]: {
        ...prev[serviceName],
        customEnvVars: value
      }
    }));
  };

  const updateServiceAutoScaling = (serviceName: string, field: keyof ServiceAutoScaling, value: number) => {
    setServiceSettings(prev => ({
      ...prev,
      [serviceName]: {
        ...prev[serviceName],
        autoScaling: {
          ...prev[serviceName]?.autoScaling,
          [field]: value
        }
      }
    }));
  };

  // [advice from AI] 하드웨어 계산 결과에서 서비스별 리소스 정보 가져오기
  const getCalculatedServiceResources = (serviceName: string) => {
    if (!hardwareSpec?.service_details) return null;
    
    // 하드웨어 계산 결과에서 해당 서비스 찾기
    const serviceDetail = hardwareSpec.service_details.find((service: any) => 
      service.service_name.toLowerCase() === serviceName.toLowerCase()
    );
    
    if (!serviceDetail) return null;
    
    return {
      cpu: serviceDetail.cpu_cores || 0, // Core 단위
      memory: serviceDetail.memory_gb || 0, // GB 단위  
      gpu: serviceDetail.gpu_count || 0,
      replicas: serviceDetail.replicas || 1
    };
  };

  // [advice from AI] 서비스별 기본값 가져오기 (환경변수/헬스체크용)
  const getServiceDefaultValue = (serviceName: string, category: string, field: string) => {
    const currentSetting = serviceSettings[serviceName];
    
    if (category === 'environment') {
      return currentSetting?.environment?.[field] || '';
    } else if (category === 'healthCheck') {
      return currentSetting?.healthCheck?.[field as keyof ServiceHealthCheck] || 
             (field === 'healthPath' ? `/${serviceName}/health` :
              field === 'readyPath' ? `/${serviceName}/ready` :
              field === 'port' ? 8080 : '');
    } else if (category === 'customEnvVars') {
      return currentSetting?.customEnvVars || '';
    }
    return '';
  };

  // [advice from AI] 오토스케일링 설정 가져오기  
  const getServiceAutoScalingValue = (serviceName: string, field: string) => {
    const currentSetting = serviceSettings[serviceName];
    const defaults = {
      minReplicas: 1,
      maxReplicas: 10,
      targetCpu: 70,
      targetMemory: 80
    };
    
    return currentSetting?.autoScaling?.[field] || defaults[field as keyof typeof defaults] || '';
  };

  // [advice from AI] 하드웨어 계산 결과 가져오기
  useEffect(() => {
    const fetchHardwareSpec = async () => {
      setHardwareLoading(true);
      try {
        const response = await fetch('/api/v1/tenants/calculate-detailed-hardware', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...serviceRequirements,
            gpu_type: gpuType,
            tenancy_mode: 'large' // 기본값
          }),
        });

        if (response.ok) {
          const result = await response.json();
          setHardwareSpec(result);
        } else {
          console.warn('하드웨어 계산 실패, 기본값 사용');
        }
      } catch (error) {
        console.error('하드웨어 계산 오류:', error);
      } finally {
        setHardwareLoading(false);
      }
    };
    
    fetchHardwareSpec();
  }, [serviceRequirements, gpuType]);

  // 다음 단계로 이동
  const handleNext = async () => {
    setError(null);
    
    try {
      if (activeStep === 2) {
        // 3단계에서 매니페스트 생성
        setLoading(true);
        await generateManifests();
      } else if (activeStep === 3) {
        // 4단계에서 배포 실행
        await executeDeployment();
        return;
      }
      
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
    } catch (error) {
      console.error("단계 이동 중 오류:", error);
      setError("단계 이동 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  // 이전 단계로 이동
  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  // 매니페스트 생성
  const generateManifests = async () => {
    try {
        const response = await fetch(`/api/v1/tenants/${tenantId}/generate-manifests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...serviceRequirements,
            gpu_type: gpuType,
          cloud_provider: selectedCloudProvider
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setManifestPreview(result);
      } else {
        throw new Error('매니페스트 생성 실패');
      }
    } catch (error) {
      console.error('매니페스트 생성 오류:', error);
      setError('매니페스트 생성에 실패했습니다.');
    }
  };

  // 배포 실행
  const executeDeployment = async () => {
    setLoading(true);
    setDeploymentProgressOpen(true);
    
    try {
      // 배포 진행 시뮬레이션
    for (let i = 0; i < deploymentSteps.length; i++) {
      setCurrentDeploymentStep(i);
      setDeploymentProgress((i / (deploymentSteps.length - 1)) * 100);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // 실제 배포 API 호출
      const response = await fetch('/api/v1/tenants/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          service_requirements: serviceRequirements,
          gpu_type: gpuType,
          cloud_provider: selectedCloudProvider,
          auto_deploy: true
        }),
      });

      if (response.ok) {
      const result = await response.json();
        setDeploymentResult(result);
        setDeploymentComplete(true);
          } else {
        throw new Error('배포 실행 실패');
          }
        } catch (error) {
      console.error('배포 실행 오류:', error);
      setError('배포 실행에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 배포 완료 처리
  const handleDeploymentComplete = () => {
    setDeploymentProgressOpen(false);
    if (deploymentResult) {
      onDeploymentComplete(deploymentResult);
    }
  };

  // 패키지 다운로드
  const downloadPackage = async (cloudProvider: string) => {
    try {
      const response = await fetch(`/api/v1/tenants/${tenantId}/download-package?cloud_provider=${cloudProvider}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${tenantId}-${cloudProvider}-deployment.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        throw new Error('다운로드 실패');
      }
    } catch (error) {
      console.error('다운로드 오류:', error);
      alert('패키지 다운로드에 실패했습니다.');
    }
  };

  // 단계별 콘텐츠 렌더링
  const renderStepContent = () => {
    switch (activeStep) {
      case 0:  // 테넌시 설정 확인
        return (
          <StepCard>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom color="primary">
                🎯 1단계: 테넌시 설정 확인
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                서비스 요구사항과 소규모/대규모 테넌시 모드를 확인하고 리소스 계산 결과를 검토합니다.
              </Typography>
            </Box>
            
                        <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, backgroundColor: 'primary.50', border: '1px solid', borderColor: 'primary.200' }}>
                  <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ color: 'primary.dark', display: 'flex', alignItems: 'center' }}>
                    🎯 ECP-AI 서비스 아키텍처 구성
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

                  {/* 인프라 서비스 (항상 포함) */}
                  <Box>
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, color: 'info.dark' }}>
                      🏗️ 필수 인프라 서비스
                    </Typography>
                    <Box sx={{ pl: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        → Nginx, Gateway, Auth, Conversation, Scenario, Monitoring (자동 생성)
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, backgroundColor: 'success.50' }}>
                  <Typography variant="h6" gutterBottom>
                    💻 권장 하드웨어 구성
                  </Typography>
                  
                  {hardwareLoading ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', py: 2 }}>
                      <CircularProgress size={20} sx={{ mr: 2 }} />
                      <Typography variant="body2">하드웨어 계산 중...</Typography>
                    </Box>
                  ) : hardwareSpec ? (
                    <Box>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>테넌시 ID:</strong> {tenantId}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>GPU 타입:</strong> {gpuType.toUpperCase()}
                      </Typography>
                      
                      {/* 하드웨어 사양에서 서버 수 계산 */}
                      {hardwareSpec.hardware_specification && (
                        <>
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            <strong>GPU 서버:</strong> {Object.values(hardwareSpec.hardware_specification.gpu_servers || {}).flat().length || 0}대
                          </Typography>
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            <strong>CPU 서버:</strong> {Object.values(hardwareSpec.hardware_specification.cpu_servers || {}).flat().length || 0}대
                          </Typography>
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            <strong>인프라 서버:</strong> {Object.values(hardwareSpec.hardware_specification.infrastructure_servers || {}).flat().length || 0}대
                          </Typography>
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            <strong>총 서버:</strong> {
                              (Object.values(hardwareSpec.hardware_specification.gpu_servers || {}).flat().length || 0) +
                              (Object.values(hardwareSpec.hardware_specification.cpu_servers || {}).flat().length || 0) +
                              (Object.values(hardwareSpec.hardware_specification.infrastructure_servers || {}).flat().length || 0)
                            }대
                          </Typography>
                        </>
                      )}
                      
                      <Alert severity="success" sx={{ mt: 2 }}>
                        <Typography variant="body2">
                          ✅ <strong>계산 완료:</strong> 선택된 서비스를 기반으로 
                          최적화된 하드웨어 구성이 계산되었습니다.
                        </Typography>
                      </Alert>
                    </Box>
                  ) : (
                    <Box>
                      <Typography variant="body2" sx={{ mb: 2 }}>
                        <strong>테넌시 ID:</strong> {tenantId}<br/>
                        <strong>GPU 타입:</strong> {gpuType.toUpperCase()}<br/>
                        <strong>상태:</strong> 계산 대기 중
                      </Typography>
                      
                      <Alert severity="info" sx={{ mt: 2 }}>
                        <Typography variant="body2">
                          💡 <strong>리소스 계산:</strong> 선택된 서비스를 기반으로 
                          GPU/CPU 요구사항이 자동으로 계산됩니다.
                        </Typography>
                      </Alert>
                    </Box>
                  )}
                </Paper>
              </Grid>

              {/* 컨테이너 이미지 필요 목록 */}
              <Grid item xs={12}>
                <Paper sx={{ p: 3, backgroundColor: 'info.50' }}>
                  <Typography variant="h6" gutterBottom>
                    🐳 필요한 컨테이너 이미지 목록
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    다음 단계에서 설정할 컨테이너 이미지들입니다:
                  </Typography>
                  
                  <Grid container spacing={2}>
                    {/* 선택된 메인 서비스 */}
                    {Object.entries(serviceRequirements).map(([service, count]) => {
                      if (count === 0 || !['callbot', 'chatbot', 'advisor'].includes(service)) return null;
                      return (
                        <Grid item xs={12} sm={6} md={4} key={service}>
                          <Box sx={{ p: 2, backgroundColor: 'white', borderRadius: 1, border: '1px solid', borderColor: 'primary.200' }}>
                            <Typography variant="subtitle2" fontWeight="bold" color="primary">
                              {service.toUpperCase()}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              ecp-ai/{service}:latest (빌드 필요)
                            </Typography>
                          </Box>
                        </Grid>
                      );
                    })}
                    
                    {/* 필수 공용 서비스 */}
                    <Grid item xs={12} sm={6} md={4}>
                      <Box sx={{ p: 2, backgroundColor: 'white', borderRadius: 1, border: '1px solid', borderColor: 'info.200' }}>
                        <Typography variant="subtitle2" fontWeight="bold" color="info">
                          AI/NLP 공용
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          STT, TTS, NLP, AICM (공용 이미지)
                        </Typography>
                      </Box>
                    </Grid>
                    
                    {/* 인프라 서비스 */}
                    <Grid item xs={12} sm={6} md={4}>
                      <Box sx={{ p: 2, backgroundColor: 'white', borderRadius: 1, border: '1px solid', borderColor: 'grey.300' }}>
                        <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">
                          인프라 서비스
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          nginx, gateway 등 (자동 생성)
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            </Grid>
              
            <Alert severity="info" sx={{ mt: 3 }}>
              <AlertTitle>ℹ️ 배포 준비 완료</AlertTitle>
                <Typography variant="body2">
                모든 기본 설정이 확인되었습니다. 다음 단계에서 이미지 설정을 진행합니다.
                  </Typography>
              </Alert>
          </StepCard>
        );
                  
      case 1:  // CI/CD 이미지 연동 (원래 7단계 내용 복원)
        return (
          <StepCard>
                  <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom color="primary">
                🐳 2단계: CI/CD 이미지 연동
                    </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                각 서비스별 컨테이너 이미지를 설정하고 레지스트리 연동을 구성합니다. 
                이미지 빌드가 필요한 서비스와 기존 이미지를 사용할 서비스를 구분하여 설정할 수 있습니다.
                      </Typography>
                  </Box>

                        {/* [advice from AI] 카테고리별 이미지 설정 - 원래 탭 구조 복원 */}
            <Tabs 
              value={imageTabValue} 
              onChange={(_, newValue) => setImageTabValue(newValue)}
              sx={{ mb: 3 }}
              variant="fullWidth"
            >
              <Tab label="📞 메인 서비스" />
              <Tab label="🤖 AI/NLP 공용" />
              <Tab label="📈 분석 서비스" />
              <Tab label="🏗️ 인프라 서비스" />
            </Tabs>

                        {/* 탭별 컨텐츠 */}
            {imageTabValue === 0 && (
              <Grid container spacing={3}>
                {/* 메인 서비스 (사용자가 선택한 것만) */}
              {Object.entries(serviceRequirements).map(([serviceName, count]) => {
                if (!['callbot', 'chatbot', 'advisor'].includes(serviceName) || count === 0) return null;
                
                return (
                  <Grid item xs={12} md={6} key={serviceName}>
                    <Paper sx={{ p: 3, backgroundColor: 'primary.50', border: '1px solid', borderColor: 'primary.200' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" fontWeight="bold">
                          {serviceName.toUpperCase()} 서비스
                      </Typography>
                        <Chip 
                          label={`${count}개 인스턴스`} 
                          color="primary" 
                          size="small" 
                          sx={{ ml: 'auto' }}
                        />
                  </Box>

                      <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>이미지 레지스트리</InputLabel>
                        <Select defaultValue="harbor.ecp-ai.com" label="이미지 레지스트리">
                          <MenuItem value="harbor.ecp-ai.com">Harbor ECP-AI (권장)</MenuItem>
                          <MenuItem value="docker.io">Docker Hub</MenuItem>
                          <MenuItem value="ghcr.io">GitHub Container Registry</MenuItem>
                          <MenuItem value="gcr.io">Google Container Registry</MenuItem>
                          <MenuItem value="ecr">AWS Elastic Container Registry</MenuItem>
                        </Select>
                      </FormControl>
                      
                      <TextField
                        fullWidth
                        label="이미지 이름"
                        defaultValue={`ecp-ai/${serviceName}`}
                        sx={{ mb: 2 }}
                        helperText="예: ecp-ai/callbot, mycompany/chatbot"
                      />
                      
                      <TextField
                        fullWidth
                        label="이미지 태그"
                        defaultValue="latest"
                        sx={{ mb: 2 }}
                        helperText="예: latest, v1.0.0, develop"
                      />
                      
                      <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Pull Policy</InputLabel>
                        <Select defaultValue="Always" label="Pull Policy">
                          <MenuItem value="Always">Always (항상 최신 이미지)</MenuItem>
                          <MenuItem value="IfNotPresent">IfNotPresent (로컬에 없을 때만)</MenuItem>
                          <MenuItem value="Never">Never (로컬 이미지만 사용)</MenuItem>
                        </Select>
                      </FormControl>
                      
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        <Typography variant="body2">
                          ⚠️ 이 서비스는 배포 시 이미지 빌드가 필요할 수 있습니다. 
                          소스코드와 Dockerfile이 준비되어 있는지 확인하세요.
                    </Typography>
                  </Alert>
                </Paper>
              </Grid>
                      );
                    })}
                              </Grid>
            )}

            {/* AI/NLP 공용 서비스 탭 */}
            {imageTabValue === 1 && (
              <Grid container spacing={3}>
                  {['stt', 'tts', 'nlp', 'aicm'].map((serviceName) => {
                    const isUsed = Object.entries(serviceRequirements).some(([service, count]) => {
                      if (count === 0) return false;
                  if (serviceName === 'stt' && ['callbot', 'advisor', 'stt'].includes(service)) return true;
                  if (serviceName === 'tts' && ['callbot', 'tts'].includes(service)) return true;
                  if (serviceName === 'nlp' && ['callbot', 'chatbot', 'advisor'].includes(service)) return true;
                  if (serviceName === 'aicm' && ['callbot', 'chatbot', 'advisor'].includes(service)) return true;
                      return false;
                    });
                    
                    return (
                  <Grid item xs={12} md={6} key={serviceName}>
                    <Paper sx={{ 
                      p: 3, 
                      backgroundColor: isUsed ? 'info.50' : 'grey.50', 
                      border: '1px solid', 
                      borderColor: isUsed ? 'info.200' : 'grey.300',
                      opacity: isUsed ? 1 : 0.7
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" fontWeight="bold">
                          {serviceName.toUpperCase()} 서비스
                        </Typography>
                        <Chip 
                          label={isUsed ? '공용 활성' : '기본 설정'} 
                          color={isUsed ? 'info' : 'default'} 
                          size="small" 
                          sx={{ ml: 'auto' }}
                        />
                      </Box>
                      
                      <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>이미지 레지스트리</InputLabel>
                        <Select 
                          defaultValue="harbor.ecp-ai.com" 
                          label="이미지 레지스트리"
                          disabled={!isUsed}
                        >
                          <MenuItem value="harbor.ecp-ai.com">Harbor ECP-AI (권장)</MenuItem>
                          <MenuItem value="docker.io">Docker Hub</MenuItem>
                          <MenuItem value="ghcr.io">GitHub Container Registry</MenuItem>
                        </Select>
                      </FormControl>
                      
                      <TextField
                        fullWidth
                        label="이미지 이름"
                        defaultValue={`ecp-ai/${serviceName}`}
                        disabled={!isUsed}
                        sx={{ mb: 2 }}
                        helperText={isUsed ? "공용 서비스 이미지" : "기본 설정값"}
                      />
                      
                      <TextField
                        fullWidth
                        label="이미지 태그"
                        defaultValue="stable"
                        disabled={!isUsed}
                        sx={{ mb: 2 }}
                        helperText={isUsed ? "안정화된 버전 사용" : "기본 태그"}
                      />
                      
                      <Alert severity={isUsed ? "info" : "info"}>
                        <Typography variant="body2">
                          {isUsed 
                            ? `ℹ️ 활성 공용 서비스 - 모든 메인 서비스에서 공유됩니다.`
                            : `📋 기본 설정 - 필요 시 자동으로 활성화됩니다.`
                          }
                        </Typography>
                      </Alert>
                    </Paper>
                  </Grid>
                    );
                  })}
                </Grid>
                
                        )}

            {/* 분석 서비스 탭 */}
            {imageTabValue === 2 && (
              <Grid container spacing={3}>
                {/* 분석 서비스들 - 기본 자동 설정값 표시 */}
                    {['ta', 'qa'].map((serviceName) => {
                    const count = serviceRequirements[serviceName] || 0;
                      if (count === 0) return null;
                    
                      return (
                      <Grid item xs={12} md={6} key={serviceName}>
                        <Paper sx={{ p: 3, backgroundColor: 'secondary.50' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6" fontWeight="bold">
                              {serviceName.toUpperCase()} 서비스
                          </Typography>
                            <Chip 
                              label={`${count}건/일`} 
                              color="secondary" 
                              size="small" 
                              sx={{ ml: 'auto' }}
                            />
                        </Box>
                          
                          <TextField
                            fullWidth
                            label="이미지 이름"
                            defaultValue={`ecp-ai/${serviceName}`}
                            sx={{ mb: 2 }}
                          />
                          
                          <TextField
                            fullWidth
                            label="이미지 태그"
                            defaultValue="latest"
                            sx={{ mb: 2 }}
                          />
                          
                          <FormControl fullWidth>
                            <InputLabel>레지스트리</InputLabel>
                            <Select defaultValue="harbor.ecp-ai.com" label="레지스트리">
                              <MenuItem value="harbor.ecp-ai.com">Harbor ECP-AI</MenuItem>
                              <MenuItem value="docker.io">Docker Hub</MenuItem>
                            </Select>
                          </FormControl>
                        </Paper>
                      </Grid>
                      );
                    })}
                  </Grid>
            )}

            {/* 인프라 서비스 탭 */}
            {imageTabValue === 3 && (
              <Grid container spacing={2}>
                {/* 인프라 서비스들 - 개별 카드로 기본 설정값 표시 */}
              {['nginx', 'gateway', 'auth', 'conversation', 'scenario', 'monitoring'].map((serviceName) => (
                <Grid item xs={12} sm={6} md={4} key={serviceName}>
                  <Paper sx={{ p: 2, backgroundColor: 'grey.50', textAlign: 'center' }}>
                    <Typography variant="subtitle2" fontWeight="bold">
                      {serviceName.toUpperCase()}
                        </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ecp-ai/{serviceName}:stable
                    </Typography>
                    <Chip label="자동 생성" size="small" color="default" sx={{ mt: 1, display: 'block' }} />
                  </Paper>
                </Grid>
              ))}
              </Grid>
            )}
              
            {/* 전체 이미지 설정 요약 */}
            <Alert severity="success" sx={{ mt: 4 }}>
              <AlertTitle>📋 이미지 설정 요약</AlertTitle>
              <Typography variant="body2" sx={{ mb: 2 }}>
                설정된 이미지 정보를 확인하세요:
                </Typography>
              <Box sx={{ ml: 2 }}>
                {/* 메인 서비스 */}
                {Object.entries(serviceRequirements).map(([serviceName, count]) => {
                  if (count === 0 || !['callbot', 'chatbot', 'advisor'].includes(serviceName)) return null;
                  return (
                    <Typography key={serviceName} variant="body2" sx={{ mb: 0.5 }}>
                      • <strong>{serviceName.toUpperCase()}</strong>: harbor.ecp-ai.com/ecp-ai/{serviceName}:latest
                      <Chip label="빌드 필요" size="small" color="warning" sx={{ ml: 1 }} />
                </Typography>
                  );
                })}
                
                {/* 공용 서비스 요약 */}
                <Typography variant="body2" sx={{ mb: 0.5, mt: 1 }}>
                  • <strong>AI/NLP 공용</strong>: STT, TTS, NLP, AICM 
                  <Chip label="공용" size="small" color="info" sx={{ ml: 1 }} />
              </Typography>
                
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  • <strong>인프라 서비스</strong>: nginx, gateway, auth, conversation, scenario, monitoring
                  <Chip label="자동 생성" size="small" color="default" sx={{ ml: 1 }} />
                </Typography>
              </Box>
            </Alert>

            {/* [advice from AI] 서비스별 고급 설정 - 탭 구조로 개선 */}
            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" gutterBottom sx={{ color: 'warning.main' }}>
                ⚙️ 고급 설정 (서비스별 개별 설정 가능)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                공통 설정과 각 서비스별 개별 설정이 가능합니다. 기본값으로도 정상 동작합니다.
              </Typography>
              
              {/* [advice from AI] 탭 기반 설정 구조 */}
              <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs 
                  value={settingsTabValue} 
                  onChange={(_, newValue) => setSettingsTabValue(newValue)}
                  variant="scrollable"
                  scrollButtons="auto"
                >
                  <Tab label="🏢 공통 설정" value="common" />
                  {getSelectedServices().map((serviceName) => (
                    <Tab 
                      key={serviceName}
                      label={getServiceTabLabel(serviceName)} 
                      value={serviceName} 
                    />
                  ))}
                </Tabs>
              </Box>
              
              {/* [advice from AI] 공통 설정 탭 패널 */}
              {settingsTabValue === 'common' && (
                <Box>
                  <Typography variant="subtitle1" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                    🏢 전체 테넌시 공통 설정
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    모든 서비스에 공통으로 적용되는 기본 설정입니다.
                  </Typography>
                  
                  {/* 필수 환경변수만 기본 표시 */}
                  <Accordion defaultExpanded sx={{ mb: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    🔑 필수 환경변수 설정
                    <Chip label="필수" size="small" color="error" />
                  </Typography>
                </AccordionSummary>
                                <AccordionDetails>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    ECP-AI 서비스 운영에 필수적인 환경변수들입니다.
                  </Typography>
                  
                  <Grid container spacing={3}>
                    {['OPENAI_API_KEY', 'JWT_SECRET', 'ENCRYPTION_KEY'].map((key) => {
                      const value = envVars[key];
                      
                      return (
                        <Grid item xs={12} md={4} key={key}>
                          <TextField
                            fullWidth
                            label={key}
                            value={value}
                            onChange={(e) => setEnvVars(prev => ({...prev, [key]: e.target.value}))}
                            type="password"
                            required
                            variant="outlined"
                            size="small"
                            helperText={
                              key === 'OPENAI_API_KEY' ? 'OpenAI API 키 (필수)' :
                              key === 'JWT_SECRET' ? 'JWT 토큰 서명용 비밀키 (필수)' :
                              '데이터 암호화용 키 (필수)'
                            }
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                backgroundColor: !value ? 'error.50' : 'background.paper'
                              }
                            }}
                          />
                        </Grid>
                      );
                    })}
                  </Grid>
                  
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      ⚠️ <strong>보안:</strong> 이 값들은 Kubernetes Secret으로 암호화되어 저장됩니다.
                    </Typography>
                  </Alert>
                </AccordionDetails>
              </Accordion>

              {/* 선택적 환경변수 */}
              <Accordion sx={{ mb: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    🔧 추가 환경변수 설정
                    <Chip label="선택사항" size="small" color="default" />
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={3}>
                    {Object.entries(envVars).map(([key, value]) => {
                      if (['OPENAI_API_KEY', 'JWT_SECRET', 'ENCRYPTION_KEY'].includes(key)) return null;
                      
                      return (
                        <Grid item xs={12} md={6} key={key}>
                          <TextField
                            fullWidth
                            label={key}
                            value={value}
                            onChange={(e) => setEnvVars(prev => ({...prev, [key]: e.target.value}))}
                            variant="outlined"
                            size="small"
                            helperText={
                              key === 'DATABASE_URL' ? 'PostgreSQL 연결 문자열' :
                              key === 'REDIS_URL' ? 'Redis 연결 문자열' :
                              key === 'LOG_LEVEL' ? 'DEBUG, INFO, WARN, ERROR 중 선택' :
                              key === 'ENVIRONMENT' ? 'development, staging, production 중 선택' :
                              key === 'MAX_WORKERS' ? '워커 프로세스 수' :
                              key === 'TIMEOUT_SECONDS' ? '요청 타임아웃 (초)' :
                              '기본값 사용 또는 필요시 수정'
                            }
                          />
                        </Grid>
                      );
                    })}
                  </Grid>
                </AccordionDetails>
              </Accordion>

                          {/* 볼륨 & 스토리지 설정 */}
              <Accordion sx={{ mb: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    📦 볼륨 & 스토리지 설정
                    <Chip label="고급" size="small" color="info" />
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    데이터 저장소와 설정 파일을 위한 볼륨을 설정합니다. 
                    업계 표준 기본값이 적용되어 있으며 필요시 수정 가능합니다.
                  </Typography>
                  
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
                        {key === 'data' ? '💾 데이터 볼륨' : 
                         key === 'logs' ? '📄 로그 볼륨' : '⚙️ 설정 볼륨'}
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
                        helperText="예: 1Gi, 10Gi, 100Gi"
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
                          <MenuItem value="standard">standard (HDD)</MenuItem>
                      </Select>
                    </FormControl>
                  </Paper>
                </Grid>
              ))}
                  </Grid>
                </AccordionDetails>
              </Accordion>

              {/* 네트워크 & 보안 설정 */}
              <Accordion sx={{ mb: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    📡 네트워크 & 보안 설정
                    <Chip label="고급" size="small" color="secondary" />
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    외부 접근과 보안 정책을 설정합니다. 엔터프라이즈 환경에 적합한 기본값이 적용되어 있습니다.
                  </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                      🌐 서비스 타입 설정
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
                        <MenuItem value="ClusterIP">ClusterIP (내부 통신만)</MenuItem>
                        <MenuItem value="NodePort">NodePort (노드 포트 노출)</MenuItem>
                        <MenuItem value="LoadBalancer">LoadBalancer (외부 로드밸런서)</MenuItem>
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
                      label="TLS/SSL 암호화"
                  />
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                      🔒 보안 정책 설정
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
                        <MenuItem value="permissive">Permissive (모든 트래픽 허용)</MenuItem>
                        <MenuItem value="restricted">Restricted (필요한 포트만 허용)</MenuItem>
                        <MenuItem value="strict">Strict (최소 권한 원칙)</MenuItem>
                    </Select>
                  </FormControl>
                  
                    <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    현재 설정: <strong>{networkSettings.networkPolicy}</strong><br/>
                    {networkSettings.networkPolicy === 'restricted' ? 
                      '✅ 권장: 필요한 포트만 허용' :
                      networkSettings.networkPolicy === 'strict' ?
                      '🔒 최고 보안: 최소 권한 원칙' :
                      '⚠️ 주의: 모든 트래픽 허용'
                    }
                  </Typography>
                    </Alert>
                </Paper>
              </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>

              {/* 헬스체크 & 모니터링 설정 */}
              <Accordion sx={{ mb: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    ⚙️ 헬스체크 & 모니터링 설정
                    <Chip label="고급" size="small" color="success" />
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    서비스 상태를 모니터링하기 위한 헬스체크를 설정합니다. 
                    Kubernetes 운영 모범사례에 따른 기본값이 적용되어 있습니다.
                  </Typography>
            
            <Alert severity="success" sx={{ mb: 3 }}>
              <AlertTitle>💡 헬스체크 종류</AlertTitle>
              <Typography variant="body2">
                • <strong>Liveness:</strong> 컨테이너 재시작 여부 결정<br/>
                • <strong>Readiness:</strong> 트래픽 수신 준비 상태 확인<br/>
                • <strong>Startup:</strong> 초기 시작 완료 확인
              </Typography>
            </Alert>
            
            <Grid container spacing={3}>
              {Object.entries(healthSettings).map(([probeType, probe]) => (
                <Grid item xs={12} md={4} key={probeType}>
                  <Paper sx={{ p: 2, height: '100%' }}>
                    <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                      {probeType === 'livenessProbe' ? '💓 Liveness Probe' :
                       probeType === 'readinessProbe' ? '🚦 Readiness Probe' : '🚀 Startup Probe'}
                    </Typography>
                    
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
                        
                      <TextField
                        fullWidth
                        label="초기 지연 (초)"
                        type="number"
                            value={probe.initialDelay}
                        onChange={(e) => setHealthSettings(prev => ({
                              ...prev,
                          [probeType]: { ...probe, initialDelay: parseInt(e.target.value) }
                            }))}
                            size="small"
                        sx={{ mb: 2 }}
                      />
                      
                      <TextField
                        fullWidth
                        label="검사 주기 (초)"
                        type="number"
                            value={probe.period}
                        onChange={(e) => setHealthSettings(prev => ({
                              ...prev,
                          [probeType]: { ...probe, period: parseInt(e.target.value) }
                            }))}
                            size="small"
                          />
                  </Paper>
                </Grid>
              ))}
                        </Grid>
                </AccordionDetails>
              </Accordion>
            
              {/* K8s 고급 설정 */}
              <Accordion sx={{ mb: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    ⚙️ Kubernetes 고급 설정
                    <Chip label="전문가용" size="small" color="error" />
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    오토스케일링, 지연시간 최적화, 리소스 제한 등 고급 Kubernetes 설정을 조정합니다.
                  </Typography>
                    
              <Paper sx={{ p: 3, backgroundColor: 'grey.50' }}>
                <Typography variant="h6" gutterBottom>
                  🔄 HPA (Horizontal Pod Autoscaler) 설정
                </Typography>
                
                <Grid container spacing={3}>
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
                      sx={{ mb: 2 }}
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
                      sx={{ mb: 2 }}
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <Typography gutterBottom>CPU 사용률 임계값: {autoScalingSettings.targetCPU}%</Typography>
                    <Box sx={{ px: 2 }}>
                      <input
                        type="range"
                        min="10"
                        max="95"
                        step="5"
                          value={autoScalingSettings.targetCPU}
                        onChange={(e) => setAutoScalingSettings(prev => ({
                            ...prev,
                          targetCPU: parseInt(e.target.value)
                        }))}
                        style={{ width: '100%' }}
                      />
                    </Box>
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <Typography gutterBottom>메모리 사용률 임계값: {autoScalingSettings.targetMemory}%</Typography>
                    <Box sx={{ px: 2 }}>
                      <input
                        type="range"
                        min="10"
                        max="95"
                        step="5"
                          value={autoScalingSettings.targetMemory}
                        onChange={(e) => setAutoScalingSettings(prev => ({
                            ...prev,
                          targetMemory: parseInt(e.target.value)
                        }))}
                        style={{ width: '100%' }}
                      />
                    </Box>
                      </Grid>
                </Grid>
              </Paper>
                </AccordionDetails>
              </Accordion>
                </Box>
              )}
              
              {/* [advice from AI] 서비스별 설정 탭 패널들 */}
              {getSelectedServices().map((serviceName) => (
                settingsTabValue === serviceName && (
                  <Box key={serviceName}>
                    <Typography variant="subtitle1" gutterBottom sx={{ color: 'secondary.main', fontWeight: 'bold' }}>
                      {getServiceTabLabel(serviceName)} 개별 설정
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      {serviceName.toUpperCase()} 서비스에 특화된 설정을 조정할 수 있습니다. 설정하지 않은 항목은 공통 설정값을 사용합니다.
                    </Typography>
                    
                    {/* [advice from AI] 현재 설정 요약 패널 */}
                    <Paper sx={{ p: 2, mb: 3, backgroundColor: 'grey.50', border: '1px solid', borderColor: 'grey.200' }}>
                      <Typography variant="subtitle2" gutterBottom fontWeight="bold" sx={{ color: 'secondary.main' }}>
                        📋 현재 {serviceName.toUpperCase()} 설정 요약
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <Typography variant="caption" color="text.secondary" display="block">리소스 할당</Typography>
                          {(() => {
                            const resources = getCalculatedServiceResources(serviceName);
                            return resources ? (
                              <Typography variant="body2">
                                CPU {resources.cpu} Core, 메모리 {resources.memory} GB, GPU {resources.gpu}개
                              </Typography>
                            ) : (
                              <Typography variant="body2" color="text.secondary">계산 중...</Typography>
                            );
                          })()}
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="caption" color="text.secondary" display="block">오토스케일링</Typography>
                          <Typography variant="body2">
                            Pod {getServiceAutoScalingValue(serviceName, 'minReplicas')}-{getServiceAutoScalingValue(serviceName, 'maxReplicas')}개, 
                            CPU {getServiceAutoScalingValue(serviceName, 'targetCpu')}%, 
                            메모리 {getServiceAutoScalingValue(serviceName, 'targetMemory')}%
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="caption" color="text.secondary" display="block">환경변수</Typography>
                          <Typography variant="body2">
                            {(() => {
                              const envCount = Object.keys(serviceSettings[serviceName]?.environment || {}).length;
                              const customEnvCount = serviceSettings[serviceName]?.customEnvVars ? 
                                serviceSettings[serviceName]?.customEnvVars?.split('\n').filter(line => line.trim()).length || 0 : 0;
                              const totalEnv = envCount + customEnvCount;
                              return totalEnv > 0 ? `${totalEnv}개 설정됨` : '기본값 사용';
                            })()}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="caption" color="text.secondary" display="block">헬스체크</Typography>
                          <Typography variant="body2">
                            {(() => {
                              const healthCheck = serviceSettings[serviceName]?.healthCheck;
                              const hasCustomHealth = healthCheck && (healthCheck.healthPath || healthCheck.readyPath || healthCheck.port);
                              return hasCustomHealth ? '사용자 정의' : '기본 경로 사용';
                            })()}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Paper>
                    
                    {/* 서비스별 리소스 설정 */}
                    <Accordion defaultExpanded sx={{ mb: 2 }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          💻 리소스 설정 & 오토스케일링
                          <Chip label="하드웨어 계산기 기반" size="small" color="success" />
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        {(() => {
                          const calculatedResources = getCalculatedServiceResources(serviceName);
                          
                          return (
                            <>
                              {/* 계산된 기본 리소스 (읽기전용) */}
                              <Alert severity="success" sx={{ mb: 3 }}>
                                <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                                  🔬 하드웨어 계산기 결과 (기본 리소스)
                                </Typography>
                                {calculatedResources ? (
                                  <Grid container spacing={2}>
                                    <Grid item xs={6} md={3}>
                                      <Typography variant="body2">
                                        <strong>CPU:</strong> {calculatedResources.cpu} Core
                                      </Typography>
                                    </Grid>
                                    <Grid item xs={6} md={3}>
                                      <Typography variant="body2">
                                        <strong>메모리:</strong> {calculatedResources.memory} GB
                                      </Typography>
                                    </Grid>
                                    <Grid item xs={6} md={3}>
                                      <Typography variant="body2">
                                        <strong>GPU:</strong> {calculatedResources.gpu}개
                                      </Typography>
                                    </Grid>
                                    <Grid item xs={6} md={3}>
                                      <Typography variant="body2">
                                        <strong>기본 Replicas:</strong> {calculatedResources.replicas}개
                                      </Typography>
                                    </Grid>
                                  </Grid>
                                ) : (
                                  <Typography variant="body2" color="text.secondary">
                                    하드웨어 계산 결과를 불러오는 중입니다...
                                  </Typography>
                                )}
                                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                                  위 값들은 서비스 요구사항에 따라 자동 계산된 기본 리소스입니다.
                                </Typography>
                              </Alert>

                              {/* 오토스케일링 설정 (편집 가능) */}
                              <Typography variant="subtitle2" gutterBottom fontWeight="bold" sx={{ mt: 2 }}>
                                ⚙️ 오토스케일링(HPA) 설정
                              </Typography>
                              <Grid container spacing={3}>
                                <Grid item xs={12} md={3}>
                                  <TextField
                                    fullWidth
                                    label="최소 Pod 수"
                                    type="number"
                                    size="small"
                                    helperText="항상 유지할 최소 Pod 개수"
                                    InputProps={{ inputProps: { min: 1, max: 50 } }}
                                    value={getServiceAutoScalingValue(serviceName, 'minReplicas')}
                                    onChange={(e) => updateServiceAutoScaling(serviceName, 'minReplicas', parseInt(e.target.value) || 1)}
                                  />
                                </Grid>
                                <Grid item xs={12} md={3}>
                                  <TextField
                                    fullWidth
                                    label="최대 Pod 수"
                                    type="number"
                                    size="small"
                                    helperText="스케일 아웃 시 최대 Pod 개수"
                                    InputProps={{ inputProps: { min: 1, max: 100 } }}
                                    value={getServiceAutoScalingValue(serviceName, 'maxReplicas')}
                                    onChange={(e) => updateServiceAutoScaling(serviceName, 'maxReplicas', parseInt(e.target.value) || 10)}
                                  />
                                </Grid>
                                <Grid item xs={12} md={3}>
                                  <TextField
                                    fullWidth
                                    label="CPU 임계값 (%)"
                                    type="number"
                                    size="small"
                                    helperText="CPU 사용률이 이 값을 넘으면 스케일 아웃"
                                    InputProps={{ inputProps: { min: 10, max: 95 } }}
                                    value={getServiceAutoScalingValue(serviceName, 'targetCpu')}
                                    onChange={(e) => updateServiceAutoScaling(serviceName, 'targetCpu', parseInt(e.target.value) || 70)}
                                  />
                                </Grid>
                                <Grid item xs={12} md={3}>
                                  <TextField
                                    fullWidth
                                    label="메모리 임계값 (%)"
                                    type="number"
                                    size="small"
                                    helperText="메모리 사용률이 이 값을 넘으면 스케일 아웃"
                                    InputProps={{ inputProps: { min: 10, max: 95 } }}
                                    value={getServiceAutoScalingValue(serviceName, 'targetMemory')}
                                    onChange={(e) => updateServiceAutoScaling(serviceName, 'targetMemory', parseInt(e.target.value) || 80)}
                                  />
                                </Grid>
                              </Grid>
                              
                              <Alert severity="info" sx={{ mt: 2 }}>
                                <Typography variant="body2">
                                  💡 <strong>오토스케일링 권장 설정:</strong><br/>
                                  {serviceName === 'callbot' && '• 최소: 2개, 최대: 10개, CPU: 70%, 메모리: 75%'}
                                  {serviceName === 'chatbot' && '• 최소: 3개, 최대: 15개, CPU: 60%, 메모리: 70%'}
                                  {serviceName === 'advisor' && '• 최소: 2개, 최대: 8개, CPU: 75%, 메모리: 80%'}
                                  {serviceName === 'stt' && '• 최소: 1개, 최대: 5개, CPU: 80%, 메모리: 85% (GPU 집약적)'}
                                  {serviceName === 'tts' && '• 최소: 1개, 최대: 4개, CPU: 75%, 메모리: 80% (GPU 집약적)'}
                                  {serviceName === 'ta' && '• 최소: 1개, 최대: 6개, CPU: 70%, 메모리: 75%'}
                                  {serviceName === 'qa' && '• 최소: 1개, 최대: 4개, CPU: 65%, 메모리: 70%'}
                                </Typography>
                              </Alert>
                            </>
                          );
                        })()}
                      </AccordionDetails>
                    </Accordion>
                    
                    {/* 서비스별 환경변수 설정 */}
                    <Accordion sx={{ mb: 2 }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          🔧 서비스별 환경변수
                          <Chip label="선택사항" size="small" color="default" />
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Grid container spacing={3}>
                          {serviceName === 'callbot' && (
                            <>
                              <Grid item xs={12} md={6}>
                                <TextField
                                  fullWidth
                                  label="STT_ENDPOINT"
                                  placeholder="http://stt-service:8080"
                                  size="small"
                                  helperText="음성인식 서비스 엔드포인트"
                                  value={getServiceDefaultValue(serviceName, 'environment', 'STT_ENDPOINT')}
                                  onChange={(e) => updateServiceEnvironment(serviceName, 'STT_ENDPOINT', e.target.value)}
                                />
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <TextField
                                  fullWidth
                                  label="TTS_ENDPOINT"
                                  placeholder="http://tts-service:8080"
                                  size="small"
                                  helperText="음성합성 서비스 엔드포인트"
                                  value={getServiceDefaultValue(serviceName, 'environment', 'TTS_ENDPOINT')}
                                  onChange={(e) => updateServiceEnvironment(serviceName, 'TTS_ENDPOINT', e.target.value)}
                                />
                              </Grid>
                            </>
                          )}
                          {serviceName === 'chatbot' && (
                            <>
                              <Grid item xs={12} md={6}>
                                <TextField
                                  fullWidth
                                  label="NLP_ENDPOINT"
                                  placeholder="http://nlp-service:8080"
                                  size="small"
                                  helperText="자연어처리 서비스 엔드포인트"
                                  value={getServiceDefaultValue(serviceName, 'environment', 'NLP_ENDPOINT')}
                                  onChange={(e) => updateServiceEnvironment(serviceName, 'NLP_ENDPOINT', e.target.value)}
                                />
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <TextField
                                  fullWidth
                                  label="CHAT_HISTORY_SIZE"
                                  placeholder="100"
                                  size="small"
                                  helperText="채팅 히스토리 보관 개수"
                                  value={getServiceDefaultValue(serviceName, 'environment', 'CHAT_HISTORY_SIZE')}
                                  onChange={(e) => updateServiceEnvironment(serviceName, 'CHAT_HISTORY_SIZE', e.target.value)}
                                />
                              </Grid>
                            </>
                          )}
                          {serviceName === 'advisor' && (
                            <>
                              <Grid item xs={12} md={6}>
                                <TextField
                                  fullWidth
                                  label="STT_ENDPOINT"
                                  placeholder="http://stt-service:8080"
                                  size="small"
                                  helperText="음성인식 서비스 엔드포인트"
                                  value={getServiceDefaultValue(serviceName, 'environment', 'STT_ENDPOINT')}
                                  onChange={(e) => updateServiceEnvironment(serviceName, 'STT_ENDPOINT', e.target.value)}
                                />
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <TextField
                                  fullWidth
                                  label="NLP_ENDPOINT"
                                  placeholder="http://nlp-service:8080"
                                  size="small"
                                  helperText="자연어처리 서비스 엔드포인트"
                                  value={getServiceDefaultValue(serviceName, 'environment', 'NLP_ENDPOINT')}
                                  onChange={(e) => updateServiceEnvironment(serviceName, 'NLP_ENDPOINT', e.target.value)}
                                />
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <TextField
                                  fullWidth
                                  label="AICM_ENDPOINT"
                                  placeholder="http://aicm-service:8080"
                                  size="small"
                                  helperText="AI 지식검색 서비스 엔드포인트"
                                  value={getServiceDefaultValue(serviceName, 'environment', 'AICM_ENDPOINT')}
                                  onChange={(e) => updateServiceEnvironment(serviceName, 'AICM_ENDPOINT', e.target.value)}
                                />
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <TextField
                                  fullWidth
                                  label="ADVISOR_MODE"
                                  placeholder="hybrid"
                                  size="small"
                                  helperText="어드바이저 모드: human, ai, hybrid"
                                  value={getServiceDefaultValue(serviceName, 'environment', 'ADVISOR_MODE')}
                                  onChange={(e) => updateServiceEnvironment(serviceName, 'ADVISOR_MODE', e.target.value)}
                                />
                              </Grid>
                            </>
                          )}
                          {serviceName === 'stt' && (
                            <>
                              <Grid item xs={12} md={6}>
                                <TextField
                                  fullWidth
                                  label="MODEL_PATH"
                                  placeholder="/models/stt"
                                  size="small"
                                  helperText="STT 모델 파일 경로"
                                  value={getServiceDefaultValue(serviceName, 'environment', 'MODEL_PATH')}
                                  onChange={(e) => updateServiceEnvironment(serviceName, 'MODEL_PATH', e.target.value)}
                                />
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <TextField
                                  fullWidth
                                  label="LANGUAGE"
                                  placeholder="ko-KR"
                                  size="small"
                                  helperText="음성인식 언어 코드"
                                  value={getServiceDefaultValue(serviceName, 'environment', 'LANGUAGE')}
                                  onChange={(e) => updateServiceEnvironment(serviceName, 'LANGUAGE', e.target.value)}
                                />
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <TextField
                                  fullWidth
                                  label="SAMPLE_RATE"
                                  placeholder="16000"
                                  size="small"
                                  helperText="오디오 샘플 레이트"
                                  value={getServiceDefaultValue(serviceName, 'environment', 'SAMPLE_RATE')}
                                  onChange={(e) => updateServiceEnvironment(serviceName, 'SAMPLE_RATE', e.target.value)}
                                />
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <TextField
                                  fullWidth
                                  label="MAX_DURATION"
                                  placeholder="30"
                                  size="small"
                                  helperText="최대 음성 길이 (초)"
                                  value={getServiceDefaultValue(serviceName, 'environment', 'MAX_DURATION')}
                                  onChange={(e) => updateServiceEnvironment(serviceName, 'MAX_DURATION', e.target.value)}
                                />
                              </Grid>
                            </>
                          )}
                          {serviceName === 'tts' && (
                            <>
                              <Grid item xs={12} md={6}>
                                <TextField
                                  fullWidth
                                  label="MODEL_PATH"
                                  placeholder="/models/tts"
                                  size="small"
                                  helperText="TTS 모델 파일 경로"
                                  value={getServiceDefaultValue(serviceName, 'environment', 'MODEL_PATH')}
                                  onChange={(e) => updateServiceEnvironment(serviceName, 'MODEL_PATH', e.target.value)}
                                />
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <TextField
                                  fullWidth
                                  label="VOICE_TYPE"
                                  placeholder="female"
                                  size="small"
                                  helperText="음성 타입: male, female, neutral"
                                  value={getServiceDefaultValue(serviceName, 'environment', 'VOICE_TYPE')}
                                  onChange={(e) => updateServiceEnvironment(serviceName, 'VOICE_TYPE', e.target.value)}
                                />
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <TextField
                                  fullWidth
                                  label="SPEED_RATE"
                                  placeholder="1.0"
                                  size="small"
                                  helperText="음성 속도 (0.5~2.0)"
                                  value={getServiceDefaultValue(serviceName, 'environment', 'SPEED_RATE')}
                                  onChange={(e) => updateServiceEnvironment(serviceName, 'SPEED_RATE', e.target.value)}
                                />
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <TextField
                                  fullWidth
                                  label="AUDIO_FORMAT"
                                  placeholder="wav"
                                  size="small"
                                  helperText="출력 오디오 형식: wav, mp3"
                                  value={getServiceDefaultValue(serviceName, 'environment', 'AUDIO_FORMAT')}
                                  onChange={(e) => updateServiceEnvironment(serviceName, 'AUDIO_FORMAT', e.target.value)}
                                />
                              </Grid>
                            </>
                          )}
                          {serviceName === 'ta' && (
                            <>
                              <Grid item xs={12} md={6}>
                                <TextField
                                  fullWidth
                                  label="NLP_ENDPOINT"
                                  placeholder="http://nlp-service:8080"
                                  size="small"
                                  helperText="자연어처리 서비스 엔드포인트"
                                  value={getServiceDefaultValue(serviceName, 'environment', 'NLP_ENDPOINT')}
                                  onChange={(e) => updateServiceEnvironment(serviceName, 'NLP_ENDPOINT', e.target.value)}
                                />
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <TextField
                                  fullWidth
                                  label="ANALYSIS_MODE"
                                  placeholder="sentiment"
                                  size="small"
                                  helperText="분석 모드: sentiment, emotion, keyword"
                                  value={getServiceDefaultValue(serviceName, 'environment', 'ANALYSIS_MODE')}
                                  onChange={(e) => updateServiceEnvironment(serviceName, 'ANALYSIS_MODE', e.target.value)}
                                />
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <TextField
                                  fullWidth
                                  label="BATCH_SIZE"
                                  placeholder="100"
                                  size="small"
                                  helperText="일괄 처리 건수"
                                  value={getServiceDefaultValue(serviceName, 'environment', 'BATCH_SIZE')}
                                  onChange={(e) => updateServiceEnvironment(serviceName, 'BATCH_SIZE', e.target.value)}
                                />
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <TextField
                                  fullWidth
                                  label="REPORT_SCHEDULE"
                                  placeholder="daily"
                                  size="small"
                                  helperText="리포트 생성 주기: hourly, daily, weekly"
                                  value={getServiceDefaultValue(serviceName, 'environment', 'REPORT_SCHEDULE')}
                                  onChange={(e) => updateServiceEnvironment(serviceName, 'REPORT_SCHEDULE', e.target.value)}
                                />
                              </Grid>
                            </>
                          )}
                          {serviceName === 'qa' && (
                            <>
                              <Grid item xs={12} md={6}>
                                <TextField
                                  fullWidth
                                  label="QA_THRESHOLD"
                                  placeholder="0.8"
                                  size="small"
                                  helperText="품질 점수 임계값 (0.0~1.0)"
                                  value={getServiceDefaultValue(serviceName, 'environment', 'QA_THRESHOLD')}
                                  onChange={(e) => updateServiceEnvironment(serviceName, 'QA_THRESHOLD', e.target.value)}
                                />
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <TextField
                                  fullWidth
                                  label="EVALUATION_MODE"
                                  placeholder="automatic"
                                  size="small"
                                  helperText="평가 모드: automatic, manual, hybrid"
                                  value={getServiceDefaultValue(serviceName, 'environment', 'EVALUATION_MODE')}
                                  onChange={(e) => updateServiceEnvironment(serviceName, 'EVALUATION_MODE', e.target.value)}
                                />
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <TextField
                                  fullWidth
                                  label="FEEDBACK_ENABLED"
                                  placeholder="true"
                                  size="small"
                                  helperText="피드백 활성화: true, false"
                                  value={getServiceDefaultValue(serviceName, 'environment', 'FEEDBACK_ENABLED')}
                                  onChange={(e) => updateServiceEnvironment(serviceName, 'FEEDBACK_ENABLED', e.target.value)}
                                />
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <TextField
                                  fullWidth
                                  label="ALERT_WEBHOOK"
                                  placeholder="https://hooks.slack.com/..."
                                  size="small"
                                  helperText="품질 알림 웹훅 URL"
                                  value={getServiceDefaultValue(serviceName, 'environment', 'ALERT_WEBHOOK')}
                                  onChange={(e) => updateServiceEnvironment(serviceName, 'ALERT_WEBHOOK', e.target.value)}
                                />
                              </Grid>
                            </>
                          )}
                          <Grid item xs={12}>
                            <TextField
                              fullWidth
                              label="사용자 정의 환경변수"
                              placeholder="KEY=VALUE 형식으로 입력"
                              multiline
                              rows={3}
                              size="small"
                              helperText="여러 개의 환경변수는 줄바꿈으로 구분"
                              value={getServiceDefaultValue(serviceName, 'customEnvVars', '')}
                              onChange={(e) => updateServiceCustomEnvVars(serviceName, e.target.value)}
                            />
                          </Grid>
                        </Grid>
                      </AccordionDetails>
                    </Accordion>
                    
                    {/* 서비스별 헬스체크 설정 */}
                    <Accordion sx={{ mb: 2 }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          ⚡ 헬스체크 설정
                          <Chip label="고급" size="small" color="success" />
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Grid container spacing={3}>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              label="Health Check Path"
                              placeholder={`/${serviceName}/health`}
                              size="small"
                              helperText="헬스체크 엔드포인트"
                              value={getServiceDefaultValue(serviceName, 'healthCheck', 'healthPath')}
                              onChange={(e) => updateServiceHealthCheck(serviceName, 'healthPath', e.target.value)}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              label="Ready Check Path"
                              placeholder={`/${serviceName}/ready`}
                              size="small"
                              helperText="준비 상태 확인 엔드포인트"
                              value={getServiceDefaultValue(serviceName, 'healthCheck', 'readyPath')}
                              onChange={(e) => updateServiceHealthCheck(serviceName, 'readyPath', e.target.value)}
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              fullWidth
                              label="포트 번호"
                              type="number"
                              placeholder="8080"
                              size="small"
                              helperText="서비스 포트"
                              InputProps={{ inputProps: { min: 1, max: 65535 } }}
                              value={getServiceDefaultValue(serviceName, 'healthCheck', 'port') || 8080}
                              onChange={(e) => updateServiceHealthCheck(serviceName, 'port', parseInt(e.target.value) || 8080)}
                            />
                          </Grid>
                        </Grid>
                      </AccordionDetails>
                    </Accordion>
                  </Box>
                )
              ))}
            </Box>
          </StepCard>
        );

      case 2:  // 매니페스트 생성 및 미리보기
        return (
          <StepCard>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom color="primary">
                📄 3단계: 매니페스트 생성 및 미리보기
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                테넌시 모드에 따른 차별화된 매니페스트를 생성하고 배포 내용을 미리 확인합니다.
                소규모 모드는 공용 서비스가 제외된 매니페스트가 생성됩니다.
              </Typography>
            </Box>
            
            {/* 클라우드 제공업체 선택 */}
            <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
              ☁️ 클라우드 제공업체 선택
                            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              배포할 클라우드 환경을 선택하면 최적화된 매니페스트가 생성됩니다.
              각 클라우드 제공업체별로 특화된 설정이 적용됩니다.
                            </Typography>
            
            <Grid container spacing={2} sx={{ mb: 4 }}>
              {cloudProviders.map((provider) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={provider.id}>
                  <Paper 
                    sx={{ 
                      p: 2, 
                      cursor: 'pointer',
                      border: selectedCloudProvider === provider.id ? '2px solid' : '1px solid',
                      borderColor: selectedCloudProvider === provider.id ? `${provider.color}.main` : 'grey.300',
                      backgroundColor: selectedCloudProvider === provider.id ? `${provider.color}.50` : 'white',
                      '&:hover': { backgroundColor: `${provider.color}.50` },
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => setSelectedCloudProvider(provider.id)}
                  >
                    <Box textAlign="center">
                      <Typography variant="h4" sx={{ mb: 1 }}>
                        {provider.icon}
                          </Typography>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {provider.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                        {provider.description}
                          </Typography>
                      {selectedCloudProvider === provider.id && (
                        <Box sx={{ mt: 1 }}>
                          <Chip label="선택됨" color={provider.color as any} size="small" />
                        </Box>
                        )}
                      </Box>
                    </Paper>
                  </Grid>
              ))}
              </Grid>

            {/* 배포 전략 선택 */}
            <Typography variant="h6" gutterBottom sx={{ color: 'secondary.main' }}>
              🚀 배포 전략 선택
                          </Typography>
            <Grid container spacing={3} sx={{ mb: 4 }}>
              {[
                { value: 'rolling', name: 'Rolling Update', description: '점진적 Pod 교체로 무중단 배포', icon: '🔄' },
                { value: 'blue-green', name: 'Blue-Green', description: '새 버전 준비 후 한번에 전환', icon: '🔄' },
                { value: 'canary', name: 'Canary', description: '소수 사용자 먼저 배포 후 확산', icon: '🐦' }
              ].map((strategy) => (
                <Grid item xs={12} md={4} key={strategy.value}>
                  <Paper 
                    sx={{ 
                      p: 2, 
                      cursor: 'pointer',
                      border: '1px solid', 
                      borderColor: 'grey.300',
                      backgroundColor: 'white',
                      '&:hover': { backgroundColor: 'grey.50' },
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Box textAlign="center">
                      <Typography variant="h3" sx={{ mb: 1 }}>
                        {strategy.icon}
                        </Typography>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {strategy.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {strategy.description}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
              ))}
            </Grid>
            
            {/* 매니페스트 미리보기 */}
            {loading ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress />
                <Typography sx={{ ml: 2 }}>
                  {cloudProviders.find(p => p.id === selectedCloudProvider)?.name} 환경용 매니페스트 생성 중...
                </Typography>
              </Box>
            ) : manifestPreview ? (
              <Box>
                <Alert severity="success" sx={{ mb: 3 }}>
                  <AlertTitle>✅ 매니페스트 생성 완료!</AlertTitle>
                  <Typography variant="body2">
                    {cloudProviders.find(p => p.id === selectedCloudProvider)?.name} 환경용 매니페스트 {manifestPreview.manifest_count}개 파일이 생성되었습니다.
                  </Typography>
                </Alert>
                
                {/* 생성된 파일 목록 */}
                <Typography variant="h6" gutterBottom>
                        📁 생성된 파일 목록
                      </Typography>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  {Object.keys(manifestPreview.manifests || {}).map((filename) => (
                    <Grid item xs={12} sm={6} md={4} key={filename}>
                      <Paper sx={{ p: 2, backgroundColor: 'success.50', textAlign: 'center' }}>
                        <Typography variant="subtitle2" fontWeight="bold">
                            {filename}
                          </Typography>
                        <Chip label="YAML" size="small" color="success" sx={{ mt: 1 }} />
                    </Paper>
                  </Grid>
                  ))}
                </Grid>
              </Box>
            ) : (
              <Alert severity="info">
                <AlertTitle>📋 매니페스트 생성 대기</AlertTitle>
                  <Typography variant="body2">
                  '다음' 버튼을 클릭하면 선택된 클라우드 환경에 최적화된 매니페스트가 생성됩니다.
                  생성되는 파일: Namespace, Deployment, Service, HPA, ConfigMap 등
                  </Typography>
                </Alert>
            )}
          </StepCard>
        );

            case 3:  // 배포 실행
        return (
          <StepCard>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom color="primary">
                🚀 4단계: 배포 실행
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                생성된 매니페스트를 다운로드하거나 Kubernetes 클러스터에 직접 배포합니다.
                모든 설정과 수정이 완료되었습니다.
              </Typography>
            </Box>
            
            {/* 배포 준비 상태 확인 */}
                <Alert severity="success" sx={{ mb: 3 }}>
                  <AlertTitle>✅ 최종 준비 완료!</AlertTitle>
                  <Typography variant="body2">
                총 {manifestPreview?.manifest_count || 0}개 파일이 성공적으로 생성되었습니다.
                    이제 클라우드 제공업체를 선택하고 다운로드하거나 배포할 수 있습니다.
                  </Typography>
                </Alert>
                
            {/* 선택된 클라우드 제공업체 정보 */}
                <Paper sx={{ p: 3, mb: 3, backgroundColor: 'grey.50' }}>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                ☁️ 선택된 클라우드 환경
                  </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="h3" sx={{ mr: 2 }}>
                  {cloudProviders.find(p => p.id === selectedCloudProvider)?.icon}
                          </Typography>
                <Box>
                  <Typography variant="h6" fontWeight="bold">
                    {cloudProviders.find(p => p.id === selectedCloudProvider)?.name}
                          </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {cloudProviders.find(p => p.id === selectedCloudProvider)?.description}
                          </Typography>
                        </Box>
                        </Box>
              <Alert severity="info">
                    <Typography variant="body2">
                  <strong>최적화 설정:</strong> {
                    selectedCloudProvider === 'iaas' ? '기본 Kubernetes 환경에 최적화' :
                    selectedCloudProvider === 'aws' ? 'EKS 서비스 및 AWS LoadBalancer 설정' :
                    selectedCloudProvider === 'ncp' ? 'NKS 서비스 및 NCP LoadBalancer 설정' :
                    selectedCloudProvider === 'azure' ? 'AKS 서비스 및 Azure LoadBalancer 설정' :
                    selectedCloudProvider === 'gcp' ? 'GKE 서비스 및 GCP LoadBalancer 설정' :
                    '선택된 클라우드 환경에 최적화된 설정'
                      }
                    </Typography>
                  </Alert>
                </Paper>
                
            {/* 배포 옵션 */}
            <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
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
                    선택된 클라우드 제공업체({cloudProviders.find(p => p.id === selectedCloudProvider)?.name})에 
                    최적화된 ZIP 패키지를 다운로드합니다.
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
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    포함 내용: YAML 파일, 배포 스크립트, 문서
                  </Typography>
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
                    onClick={() => onTenantSaved && onTenantSaved({ tenant_id: tenantId })}
                          fullWidth
                          size="large"
                        >
                          테넌시 저장하기
                        </Button>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    DB에 저장 후 나중에 배포 가능
                  </Typography>
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
                    K8s 시뮬레이터에 실시간 연결됩니다.
                        </Typography>
                        <Button
                          variant="contained"
                          color="info"
                          startIcon={<PlayArrowIcon />}
                    onClick={() => handleNext()}
                          fullWidth
                          size="large"
                          disabled={loading}
                        >
                          {loading ? '배포 중...' : '지금 배포하기'}
                        </Button>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    실시간 모니터링 포함
                  </Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                  
                  <Alert severity="warning" sx={{ mt: 3 }}>
              <AlertTitle>⚠️ 배포 주의사항</AlertTitle>
                    <Typography variant="body2">
                • <strong>자동 배포</strong>는 즉시 클러스터 리소스를 사용합니다<br/>
                • <strong>프로덕션 환경</strong>에서는 다운로드 후 수동 배포를 권장합니다<br/>
                • <strong>배포 전</strong>에 매니페스트 내용을 반드시 확인하세요<br/>
                • <strong>롤백</strong>이 필요한 경우 kubectl delete 명령을 사용하세요
                    </Typography>
                  </Alert>
                  
            {/* 배포 완료 안내 */}
                  <Box sx={{ mt: 4, textAlign: 'center' }}>
                    <Typography variant="h6" gutterBottom color="primary">
                🎉 테넌시 배포 마법사 완료!
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      모든 설정과 매니페스트 생성이 완료되었습니다. 
                      위의 옵션 중 하나를 선택하여 진행하세요.
                    </Typography>
                  </Box>
          </StepCard>
        );

      default:
        return null;
    }
  };

  return (
    <WizardCard>
      <CardContent sx={{ 
        flexGrow: 1, 
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* 헤더 */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" gutterBottom fontWeight="bold" sx={{ color: 'primary.main' }}>
            🚀 ECP-AI 배포 마법사
        </Typography>
          <Typography variant="body1" color="text.secondary">
            간소화된 4단계로 빠르고 안전한 테넌시 배포
        </Typography>
        </Box>

        {/* 스테퍼 */}
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
          {steps.map((label, index) => (
            <Step key={label}>
              <StepLabel>
                <Typography variant="subtitle2">{label}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {stepDescriptions[index]}
                  </Typography>
              </StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* 에러 표시 */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* 단계별 콘텐츠 */}
        <Box sx={{ flexGrow: 1, overflow: 'auto', mb: 3 }}>
          {renderStepContent()}
        </Box>

        {/* 버튼 영역 */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          pt: 2,
          borderTop: '1px solid',
          borderColor: 'divider'
        }}>
            <Button 
            onClick={handleBack} 
            disabled={activeStep === 0}
              variant="outlined"
            size="large"
            >
            이전
            </Button>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              onClick={onCancel} 
              variant="outlined"
              color="error"
              size="large"
            >
              취소
            </Button>
              <Button
                onClick={handleNext}
                disabled={loading}
                variant="contained"
              size="large"
              startIcon={loading ? <CircularProgress size={20} /> : null}
              >
              {activeStep === steps.length - 1 ? '배포 실행' : '다음'}
              </Button>
          </Box>
        </Box>
      </CardContent>

      {/* [advice from AI] 상세 배포 진행 다이얼로그 - 이전 형태로 복구 */}
      <Dialog
        open={deploymentProgressOpen}
        maxWidth="lg"
        fullWidth
        disableEscapeKeyDown
        PaperProps={{
          sx: { minHeight: '600px' }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h5" component="div" sx={{ display: 'flex', alignItems: 'center' }}>
              <RocketIcon sx={{ mr: 2, color: 'primary.main', fontSize: 32 }} />
              🚀 ECP-AI 테넌시 자동 배포
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h6" color="primary.main">
                {Math.round(deploymentProgress)}%
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={deploymentProgress}
                sx={{ width: 120, height: 8, borderRadius: 4 }}
              />
            </Box>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ pb: 3 }}>
          {/* 전체 진행률 표시 */}
          <Paper sx={{ p: 3, mb: 3, backgroundColor: 'grey.50' }}>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
              📊 전체 배포 진행 상황
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography variant="body2" sx={{ minWidth: 200 }}>
                단계 {currentDeploymentStep + 1} / {deploymentSteps.length}
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={deploymentProgress}
                sx={{ flex: 1, height: 12, borderRadius: 6, mx: 2 }}
              />
              <Typography variant="body2" color="primary.main" fontWeight="bold">
                {Math.round(deploymentProgress)}%
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              예상 완료 시간: 약 {Math.max(1, Math.ceil((100 - deploymentProgress) / 10))}분 남음
            </Typography>
          </Paper>

          {/* 단계별 상세 진행 상황 */}
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            📋 단계별 진행 상황
          </Typography>
          
          <Box sx={{ maxHeight: 350, overflowY: 'auto', pr: 1 }}>
            {deploymentSteps.map((step, index) => {
              const isCompleted = index < currentDeploymentStep;
              const isCurrent = index === currentDeploymentStep;
              const isPending = index > currentDeploymentStep;
              
              const getStepIcon = () => {
                if (isCompleted) return <CheckCircleIcon color="success" />;
                if (isCurrent) return <CircularProgress size={20} color="primary" />;
                return <Typography variant="body2" color="text.disabled">⏳</Typography>;
              };
              
              const getStepColor = () => {
                if (isCompleted) return 'success.main';
                if (isCurrent) return 'primary.main';
                return 'text.disabled';
              };
              
              const getStepDetails = (stepIndex: number) => {
                const details = [
                  { desc: 'Kubernetes 매니페스트 파일 구문 및 리소스 검증', time: '30초' },
                  { desc: 'Docker Hub 및 private registry 연결 확인', time: '45초' },
                  { desc: '서비스별 컨테이너 이미지 빌드 및 레지스트리 푸시', time: '2-3분' },
                  { desc: 'K8S 시뮬레이터와 WebSocket 연결 및 인증', time: '20초' },
                  { desc: `${tenantId} 네임스페이스 생성 및 권한 설정`, time: '30초' },
                  { desc: 'ConfigMap, Secret, Service, Deployment 리소스 생성', time: '1-2분' },
                  { desc: 'Pod 스케줄링, 이미지 Pull, 컨테이너 시작', time: '2-3분' },
                  { desc: 'LoadBalancer, Ingress 설정 및 DNS 연결', time: '1분' },
                  { desc: 'Prometheus, Grafana 모니터링 에이전트 설치', time: '1분' },
                  { desc: '모든 서비스 Health Check 완료 및 Ready 상태 확인', time: '완료' }
                ];
                return details[stepIndex] || { desc: '진행 중...', time: '대기' };
              };

              const stepDetail = getStepDetails(index);

              return (
                <Paper 
                  key={index} 
                  sx={{ 
                    p: 2, 
                    mb: 2, 
                    backgroundColor: isCompleted ? 'success.50' : isCurrent ? 'primary.50' : 'grey.100',
                    border: isCurrent ? '2px solid' : '1px solid',
                    borderColor: isCompleted ? 'success.main' : isCurrent ? 'primary.main' : 'grey.300',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <Box sx={{ mt: 0.5 }}>
                      {getStepIcon()}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography 
                        variant="subtitle2" 
                        fontWeight="bold"
                        sx={{ color: getStepColor() }}
                        gutterBottom
                      >
                        {index + 1}. {step}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {stepDetail.desc}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" color="text.secondary">
                          예상 소요시간: {stepDetail.time}
                        </Typography>
                        {isCurrent && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CircularProgress size={16} />
                            <Typography variant="caption" color="primary.main" fontWeight="bold">
                              진행 중...
                            </Typography>
                          </Box>
                        )}
                        {isCompleted && (
                          <Typography variant="caption" color="success.main" fontWeight="bold">
                            ✅ 완료
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Box>
                </Paper>
              );
            })}
          </Box>
          
          {/* 실시간 로그 섹션 */}
          <Paper sx={{ p: 2, mt: 3, backgroundColor: 'grey.900', color: 'white' }}>
            <Typography variant="subtitle2" gutterBottom sx={{ color: 'success.light' }}>
              💻 실시간 배포 로그
            </Typography>
            <Box 
              sx={{ 
                height: 120, 
                overflowY: 'auto', 
                fontFamily: 'monospace', 
                fontSize: '0.8rem',
                lineHeight: 1.4
              }}
            >
              <Typography component="div" sx={{ color: 'grey.300' }}>
                [{new Date().toLocaleTimeString()}] 🚀 ECP-AI 테넌시 "{tenantId}" 배포 시작<br/>
                [{new Date().toLocaleTimeString()}] 📋 서비스 구성: {getSelectedServices().join(', ')}<br/>
                [{new Date().toLocaleTimeString()}] ⚙️  리소스 요구사항 분석 완료<br/>
                {currentDeploymentStep >= 0 && (
                  <>
                    [{new Date().toLocaleTimeString()}] ✅ 매니페스트 검증 완료<br/>
                  </>
                )}
                {currentDeploymentStep >= 1 && (
                  <>
                    [{new Date().toLocaleTimeString()}] 🔗 레지스트리 연결 성공<br/>
                  </>
                )}
                {currentDeploymentStep >= 2 && (
                  <>
                    [{new Date().toLocaleTimeString()}] 🐳 이미지 빌드 진행 중...<br/>
                  </>
                )}
                {!deploymentComplete && currentDeploymentStep < deploymentSteps.length && (
                  <Typography component="span" sx={{ color: 'warning.light' }}>
                    [{new Date().toLocaleTimeString()}] ⏳ {deploymentSteps[currentDeploymentStep]}<br/>
                  </Typography>
                )}
              </Typography>
            </Box>
          </Paper>
          
          {deploymentComplete && (
            <Alert severity="success" sx={{ mt: 3 }}>
              <AlertTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                🎉 배포 완료! <CheckCircleIcon />
              </AlertTitle>
              <Typography variant="body2" sx={{ mb: 2 }}>
                테넌시 "<strong>{tenantId}</strong>"가 성공적으로 배포되었습니다!
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Chip 
                  label={`📊 배포된 서비스: ${getSelectedServices().length}개`} 
                  size="small" 
                  color="success" 
                />
                <Chip 
                  label={`⏱️ 총 소요시간: ${Math.ceil(deploymentProgress / 10)}분`} 
                  size="small" 
                  color="info" 
                />
                <Chip 
                  label={`🚀 Pod 상태: Running`} 
                  size="small" 
                  color="primary" 
                />
              </Box>
            </Alert>
          )}
        </DialogContent>
        
        {deploymentComplete && (
          <DialogActions sx={{ p: 3, backgroundColor: 'grey.50' }}>
            <Button
              onClick={handleDeploymentComplete}
              variant="contained"
              color="primary"
              size="large"
              startIcon={<CheckCircleIcon />}
              sx={{ px: 4 }}
            >
              배포 완료 확인
            </Button>
          </DialogActions>
        )}
      </Dialog>
    </WizardCard>
  );
};
