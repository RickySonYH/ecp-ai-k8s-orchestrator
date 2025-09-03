// [advice from AI] ECP-AI 테넌시 생성 컴포넌트 - 실제 가중치 기반 UI
/**
 * ECP-AI Kubernetes Orchestrator 테넌시 생성 컴포넌트
 * - 실제 가중치 기반 실시간 리소스 계산
 * - 서비스별 적정 범위 슬라이더
 * - 프리셋 자동 감지 및 GPU 타입 선택
 * - Material-UI 반응형 디자인
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Grid,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Alert,
  AlertTitle,
  Chip,
  Paper,
  Divider,
  Tooltip,
  IconButton,
  Collapse,
  Dialog,
  CircularProgress,
  Snackbar
} from '@mui/material';
import {
  InfoOutlined as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Rocket as RocketIcon,
  Memory as MemoryIcon,
  Speed as SpeedIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { DeploymentWizard } from './DeploymentWizard';
import { HardwareSpecCalculator } from './HardwareSpecCalculator';

// 타입 정의
interface ServiceRequirements {
  callbot: number;
  chatbot: number;
  advisor: number;
  stt: number;
  tts: number;
  ta: number;
  qa: number;
}

interface ResourceEstimation {
  gpus: number;
  cpus: number;
  gpu_type: string;
  preset: string;
  nlp_queries_daily: number;
  aicm_queries_daily: number;
  total_channels: number;
  total_users: number;
  tenancy_mode: string;
}

interface TenantCreatorProps {
  onTenantCreated: (result: any) => void;
  onTenantSaved?: (tenant: TenantSummary) => void;
  isDemoMode?: boolean;
}

interface TenantSummary {
  tenant_id: string;
  status: string;
  preset: string;
  services_count: number;
  created_at: string;
}

// 스타일드 컴포넌트
const StyledCard = styled(Card)(({ theme }) => ({
  maxWidth: 1000,
  margin: 'auto',
  boxShadow: theme.shadows[8],
  borderRadius: theme.spacing(2),
}));

const ServiceSection = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(2),
  backgroundColor: theme.palette.grey[50],
  borderRadius: theme.spacing(1),
}));

const MetricChip = styled(Chip)(({ theme }) => ({
  margin: theme.spacing(0.5),
  fontWeight: 'bold',
}));

export const TenantCreator: React.FC<TenantCreatorProps> = ({ onTenantCreated, onTenantSaved, isDemoMode = false }) => {
  // 상태 관리
  const [tenantId, setTenantId] = useState('');
  const [tenancyMode, setTenancyMode] = useState<'small' | 'large'>('large');  // [advice from AI] 기본값을 대규모로 설정
  // [advice from AI] 클라우드 제공업체 선택을 매니페스트 생성 후로 이동
  const [services, setServices] = useState<ServiceRequirements>({
    callbot: 0,
    chatbot: 0,
    advisor: 0,
    stt: 0,
    tts: 0,
    ta: 0,
    qa: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // [advice from AI] 테넌트 ID 중복 체크 상태 추가
  const [tenantIdStatus, setTenantIdStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
    suggestions?: string[];
  }>({
    checking: false,
    available: null,
    message: ''
  });

  const [showCalculation, setShowCalculation] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showHardwareSpec, setShowHardwareSpec] = useState(false);
  
  // [advice from AI] 인스턴스 상세 정보 다이얼로그 상태 추가
  const [instanceDetailOpen, setInstanceDetailOpen] = useState(false);
  const [selectedInstanceInfo, setSelectedInstanceInfo] = useState<any>(null);
  
  // [advice from AI] 저장 관련 상태 추가
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  // [advice from AI] 인스턴스 상세 정보 표시 함수
  const showInstanceDetail = (serviceName: string, serviceType: 'main' | 'infra') => {
    let detailInfo;
    
    if (serviceType === 'main') {
      // 메인 서비스 상세 정보
      const count = services[serviceName as keyof ServiceRequirements];
      detailInfo = {
        name: serviceName.toUpperCase(),
        type: '메인 서비스',
        capacity: serviceName === 'chatbot' ? `${count}명 동시사용자` : `${count}채널 처리능력`,
        deployment: {
          replicas: 1,
          scaling: 'HPA 자동 스케일링 (1-10개)',
          resources: getMainServiceResources(serviceName, count),
          ports: getMainServicePorts(serviceName),
          environment: getMainServiceEnv(serviceName),
          volumes: getMainServiceVolumes(serviceName)
        },
        dependencies: getServiceDependencies(serviceName),
        tenancyMode: tenancyMode
      };
    } else {
      // 인프라 서비스 상세 정보
      detailInfo = {
        name: serviceName.toUpperCase(),
        type: tenancyMode === 'small' ? '공용 인프라' : '전용 인프라',
        capacity: getInfraServiceCapacity(serviceName),
        deployment: {
          replicas: getInfraServiceReplicas(serviceName),
          scaling: tenancyMode === 'small' ? '공용 환경 (관리 대상 아님)' : 'HPA 스케일링',
          resources: getInfraServiceResources(serviceName),
          ports: getInfraServicePorts(serviceName),
          environment: getInfraServiceEnv(serviceName),
          volumes: getInfraServiceVolumes(serviceName)
        },
        tenancyMode: tenancyMode
      };
    }
    
    setSelectedInstanceInfo(detailInfo);
    setInstanceDetailOpen(true);
  };

  // [advice from AI] 서비스 상세 정보 헬퍼 함수들
  const getMainServiceResources = (serviceName: string, count: number) => {
    const baseResources = {
      callbot: { cpu: '100m', memory: '256Mi', gpu: 0 },
      chatbot: { cpu: '50m', memory: '128Mi', gpu: 0 },
      advisor: { cpu: '200m', memory: '512Mi', gpu: 0 },
      stt: { cpu: '154m', memory: '512Mi', gpu: 0 },
      tts: { cpu: '2000m', memory: '4Gi', gpu: 1 },
      ta: { cpu: '1000m', memory: '2Gi', gpu: 0 },
      qa: { cpu: '500m', memory: '1Gi', gpu: 0 }
    };
    const base = baseResources[serviceName as keyof typeof baseResources];
    return {
      requests: { cpu: base.cpu, memory: base.memory, gpu: base.gpu },
      limits: { cpu: `${parseInt(base.cpu) * 10}m`, memory: base.memory.replace('Mi', 'Gi').replace('Gi', 'Gi'), gpu: base.gpu }
    };
  };

  const getMainServicePorts = (serviceName: string) => {
    const ports = {
      callbot: [{ port: 8080, name: 'http' }],
      chatbot: [{ port: 8081, name: 'http' }],
      advisor: [{ port: 8082, name: 'http' }],
      stt: [{ port: 8083, name: 'http' }],
      tts: [{ port: 8084, name: 'http' }],
      ta: [{ port: 8087, name: 'http' }],
      qa: [{ port: 8088, name: 'http' }]
    };
    return ports[serviceName as keyof typeof ports] || [];
  };

  const getMainServiceEnv = (serviceName: string) => {
    const envs = {
      callbot: [
        { name: 'STT_ENDPOINT', value: 'http://stt-service:8080' },
        { name: 'TTS_ENDPOINT', value: 'http://tts-service:8080' },
        { name: 'NLP_ENDPOINT', value: 'http://nlp-service:8080' }
      ],
      chatbot: [
        { name: 'NLP_ENDPOINT', value: 'http://nlp-service:8080' },
        { name: 'AICM_ENDPOINT', value: 'http://aicm-service:8080' }
      ],
      advisor: [
        { name: 'STT_ENDPOINT', value: 'http://stt-service:8080' },
        { name: 'NLP_ENDPOINT', value: 'http://nlp-service:8080' },
        { name: 'AICM_ENDPOINT', value: 'http://aicm-service:8080' }
      ],
      stt: [],
      tts: [],
      ta: [{ name: 'NLP_ENDPOINT', value: 'http://nlp-service:8080' }],
      qa: []
    };
    return envs[serviceName as keyof typeof envs] || [];
  };

  const getMainServiceVolumes = (serviceName: string) => {
    return [
      { name: 'logs', mountPath: '/app/logs' },
      { name: 'config', mountPath: '/app/config' }
    ];
  };

  const getServiceDependencies = (serviceName: string) => {
    const deps = {
      callbot: ['STT Service', 'TTS Service', 'NLP Service', 'AICM Service'],
      chatbot: ['NLP Service', 'AICM Service'],
      advisor: ['STT Service', 'NLP Service', 'AICM Service'],
      stt: [],
      tts: [],
      ta: ['NLP Service'],
      qa: []
    };
    return deps[serviceName as keyof typeof deps] || [];
  };

  const getInfraServiceCapacity = (serviceName: string) => {
    const capacities = {
      'api-gateway': '8코어 x 2대 (로드밸런싱)',
      'postgresql': '8코어 x 1대 (메인 DB)',
      'vectordb': '8코어 x 1대 (벡터 검색)',
      'auth-service': '8코어 x 1대 (인증 처리)',
      'nas': '8코어 x 1대 (파일 저장)',
      'stt-service': '음성인식 처리 엔진',
      'tts-service': '음성합성 처리 엔진 (GPU)',
      'nlp-service': '자연어 처리 엔진 (GPU)',
      'aicm-service': 'AI 지식 검색 엔진 (GPU)'
    };
    return capacities[serviceName as keyof typeof capacities] || '서비스';
  };

  const getInfraServiceReplicas = (serviceName: string) => {
    return serviceName === 'api-gateway' ? 2 : 1;
  };

  const getInfraServiceResources = (serviceName: string) => {
    const resources = {
      'api-gateway': { cpu: '8000m', memory: '16Gi', gpu: 0 },
      'postgresql': { cpu: '8000m', memory: '32Gi', gpu: 0 },
      'vectordb': { cpu: '8000m', memory: '32Gi', gpu: 0 },
      'auth-service': { cpu: '8000m', memory: '16Gi', gpu: 0 },
      'nas': { cpu: '8000m', memory: '16Gi', gpu: 0 },
      'stt-service': { cpu: '4000m', memory: '8Gi', gpu: 0 },
      'tts-service': { cpu: '2000m', memory: '8Gi', gpu: 1 },
      'nlp-service': { cpu: '4000m', memory: '16Gi', gpu: 1 },
      'aicm-service': { cpu: '2000m', memory: '8Gi', gpu: 1 }
    };
    const base = resources[serviceName as keyof typeof resources];
    return {
      requests: base,
      limits: { cpu: base.cpu, memory: base.memory, gpu: base.gpu }
    };
  };

  const getInfraServicePorts = (serviceName: string) => {
    const ports = {
      'api-gateway': [{ port: 80, name: 'http' }, { port: 443, name: 'https' }],
      'postgresql': [{ port: 5432, name: 'postgres' }],
      'vectordb': [{ port: 5433, name: 'vectordb' }],
      'auth-service': [{ port: 8090, name: 'http' }],
      'nas': [{ port: 2049, name: 'nfs' }],
      'stt-service': [{ port: 8080, name: 'http' }],
      'tts-service': [{ port: 8080, name: 'http' }],
      'nlp-service': [{ port: 8080, name: 'http' }],
      'aicm-service': [{ port: 8080, name: 'http' }]
    };
    return ports[serviceName as keyof typeof ports] || [];
  };

  const getInfraServiceEnv = (serviceName: string) => {
    const envs = {
      'api-gateway': [{ name: 'NGINX_PORT', value: '80' }],
      'postgresql': [
        { name: 'POSTGRES_DB', value: 'ecp_ai' },
        { name: 'POSTGRES_USER', value: 'ecp_user' }
      ],
      'vectordb': [
        { name: 'POSTGRES_DB', value: 'vector_db' },
        { name: 'POSTGRES_USER', value: 'vector_user' }
      ],
      'auth-service': [{ name: 'JWT_SECRET', value: 'configured' }],
      'nas': [{ name: 'NFS_EXPORTS', value: '/data' }],
      'stt-service': [{ name: 'MODEL_PATH', value: '/models/stt' }],
      'tts-service': [{ name: 'MODEL_PATH', value: '/models/tts' }],
      'nlp-service': [{ name: 'MODEL_PATH', value: '/models/nlp' }],
      'aicm-service': [{ name: 'VECTOR_DB_URL', value: 'postgresql://vectordb:5433' }]
    };
    return envs[serviceName as keyof typeof envs] || [];
  };

  const getInfraServiceVolumes = (serviceName: string) => {
    const volumes = {
      'postgresql': [{ name: 'postgres-data', mountPath: '/var/lib/postgresql/data' }],
      'vectordb': [{ name: 'vector-data', mountPath: '/var/lib/postgresql/data' }],
      'nas': [{ name: 'nas-storage', mountPath: '/data' }]
    };
    return volumes[serviceName as keyof typeof volumes] || [];
  };

  // [advice from AI] 클라우드 비교 기능 제거 - 매니페스트 생성 후에 선택하도록 변경

  // 서비스별 설정 (실제 가중치 반영)
  const serviceConfigs = {
    callbot: {
      label: '콜봇 (채널)',
      max: 500,
      marks: [
        { value: 0, label: '0' },
        { value: 10, label: '10' },
        { value: 50, label: '50' },
        { value: 200, label: '200' },
        { value: 500, label: '500' }
      ],
      step: 5,
      color: 'primary' as const,
      description: '음성 통화 기반 AI 상담 채널 수'
    },
    chatbot: {
      label: '챗봇 (사용자)',
      max: 2000,
      marks: [
        { value: 0, label: '0' },
        { value: 500, label: '500' },
        { value: 1000, label: '1K' },
        { value: 2000, label: '2K' }
      ],
      step: 25,
      color: 'secondary' as const,
      description: '텍스트 기반 AI 채팅 동시 사용자 수'
    },
    advisor: {
      label: '어드바이저 (상담사)',
      max: 1000,
      marks: [
        { value: 0, label: '0' },
        { value: 250, label: '250' },
        { value: 500, label: '500' },
        { value: 1000, label: '1K' }
      ],
      step: 10,
      color: 'success' as const,
      description: 'AI 보조 인간 상담사 수'
    }
  };

  // [advice from AI] 지원 서비스 설정 - STT/TTS 독립 운영 + TA/QA 품질관리
  const supportServiceConfigs = {
    stt: {
      label: 'STT (독립 채널)',
      max: 500,
      marks: [
        { value: 0, label: '0' },
        { value: 50, label: '50' },
        { value: 200, label: '200' },
        { value: 500, label: '500' }
      ],
      step: 5,
      color: 'info' as const,
      description: '독립 음성인식 서비스 채널 수'
    },
    tts: {
      label: 'TTS (독립 채널)',
      max: 500,
      marks: [
        { value: 0, label: '0' },
        { value: 50, label: '50' },
        { value: 200, label: '200' },
        { value: 500, label: '500' }
      ],
      step: 5,
      color: 'warning' as const,
      description: '독립 음성합성 서비스 채널 수'
    },
    ta: {
      label: 'TA (분석 건수)',
      max: 3000,
      marks: [
        { value: 0, label: '0' },
        { value: 500, label: '500' },
        { value: 1500, label: '1.5K' },
        { value: 3000, label: '3K' }
      ],
      step: 25,
      color: 'success' as const,
      description: '텍스트 분석 일일 처리 건수'
    },
    qa: {
      label: 'QA (평가 건수)',
      max: 2000,
      marks: [
        { value: 0, label: '0' },
        { value: 300, label: '300' },
        { value: 1000, label: '1K' },
        { value: 2000, label: '2K' }
      ],
      step: 25,
      color: 'error' as const,
      description: '품질 관리 일일 평가 건수'
    }
  };

  // [advice from AI] 서비스 선택 여부 확인
  const hasSelectedServices = useMemo(() => {
    return Object.values(services).some(value => value > 0);
  }, [services]);

  // [advice from AI] 외부 API 응답을 테넌시 모드에 따라 필터링하는 로직
  const filterResourcesByTenancyMode = (apiResponse: any): ResourceEstimation => {
    if (!apiResponse) {
      return {
        gpus: 0,
        cpus: 0,
        gpu_type: 'none',
        preset: 'none',
        nlp_queries_daily: 0,
        aicm_queries_daily: 0,
        total_channels: 0,
        total_users: 0,
        tenancy_mode: tenancyMode
      };
    }

    if (tenancyMode === 'small') {
      // 소규모: 공용 인프라 제외, 메인 서비스만 전용
      return {
        gpus: apiResponse.gpus || 0,
        cpus: Math.max(0, (apiResponse.cpus || 0) - 48), // 공용 인프라 48코어 제외
        gpu_type: apiResponse.gpu_type || 'auto',
        preset: 'small-tenancy',
        nlp_queries_daily: apiResponse.nlp_queries_daily || 0,
        aicm_queries_daily: apiResponse.aicm_queries_daily || 0,
        total_channels: apiResponse.total_channels || 0,
        total_users: apiResponse.total_users || 0,
        tenancy_mode: tenancyMode
      };
    } else {
      // 대규모: 전체 리소스 그대로 사용
      return {
        gpus: apiResponse.gpus || 0,
        cpus: apiResponse.cpus || 0,
        gpu_type: apiResponse.gpu_type || 'auto',
        preset: 'large-tenancy',
        nlp_queries_daily: apiResponse.nlp_queries_daily || 0,
        aicm_queries_daily: apiResponse.aicm_queries_daily || 0,
        total_channels: apiResponse.total_channels || 0,
        total_users: apiResponse.total_users || 0,
        tenancy_mode: tenancyMode
      };
    }
  };

  // 실시간 리소스 계산 (외부 API 호출 후 테넌시 모드별 필터링)
  const resourceEstimation = useMemo((): ResourceEstimation => {
    // [advice from AI] 서비스가 선택되지 않았을 때는 모든 값을 0으로 반환
    if (!hasSelectedServices) {
      return {
        gpus: 0,
        cpus: 0,
        gpu_type: 'none',
        preset: 'none',
        nlp_queries_daily: 0,
        aicm_queries_daily: 0,
        total_channels: 0,
        total_users: 0,
        tenancy_mode: tenancyMode
      };
    }

    // TODO: 외부 API 호출 후 결과를 필터링
    // 현재는 기본 계산으로 대체 (추후 API 연동 시 수정)
    const totalChannels = services.callbot + services.advisor + services.stt + services.tts;
    const totalUsers = services.chatbot;

    // 기본 계산 (외부 API 응답 대신 임시)
    const mockApiResponse = {
      gpus: Math.max(1, Math.ceil((totalChannels + totalUsers) / 50)),
      cpus: Math.max(4, Math.ceil((totalChannels * 2) + (totalUsers * 0.5)) + 48), // 인프라 포함
      gpu_type: 'auto',
      nlp_queries_daily: services.callbot * 3200 + services.chatbot * 288 + services.advisor * 2400,
      aicm_queries_daily: services.callbot * 480 + services.chatbot * 24 + services.advisor * 1360,
      total_channels: totalChannels,
      total_users: totalUsers
    };

    return filterResourcesByTenancyMode(mockApiResponse);
  }, [services, hasSelectedServices, tenancyMode]);

  // [advice from AI] 테넌트 ID 중복 체크 함수
  const checkTenantIdDuplicate = async (id: string) => {
    if (!id.trim()) {
      setTenantIdStatus({
        checking: false,
        available: null,
        message: ''
      });
      return;
    }

    setTenantIdStatus(prev => ({ ...prev, checking: true }));

    try {
      const response = await fetch(`/api/v1/tenants/check-duplicate/${id}`);
      const result = await response.json();

      setTenantIdStatus({
        checking: false,
        available: result.available,
        message: result.message,
        suggestions: result.suggestions
      });
    } catch (error) {
      setTenantIdStatus({
        checking: false,
        available: null,
        message: '중복 확인 중 오류가 발생했습니다'
      });
    }
  };

  // [advice from AI] 테넌트 ID 변경 시 중복 체크 (디바운스 적용)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (tenantId.trim()) {
        checkTenantIdDuplicate(tenantId);
      }
    }, 500); // 500ms 디바운스

    return () => clearTimeout(timer);
  }, [tenantId]);

  // 서비스 값 변경 핸들러
  const handleServiceChange = (service: keyof ServiceRequirements, value: number) => {
    setServices(prev => ({
      ...prev,
      [service]: value
    }));
  };

  // [advice from AI] 클라우드 비교 기능 제거 - 매니페스트 생성 후에 선택하도록 변경

  // [advice from AI] 클라우드 비교 useEffect 제거 - 더 이상 필요하지 않음

  // [advice from AI] 테넌시 저장 핸들러 (배포 없이 저장만)
  const handleSave = () => {
    if (!tenantId.trim()) {
      setError('테넌시 ID를 입력해주세요.');
      return;
    }

    // 테넌시 ID 검증
    const tenantIdRegex = /^[a-z0-9-]+$/;
    if (!tenantIdRegex.test(tenantId)) {
      setError('테넌시 ID는 소문자, 숫자, 하이픈만 사용 가능합니다.');
      return;
    }

    // [advice from AI] 중복 체크 결과 확인
    if (tenantIdStatus.available === false) {
      setError('이미 사용 중인 테넌시 ID입니다. 다른 이름을 선택해주세요.');
      return;
    }

    // 저장할 테넌시 정보 생성
    const savedTenant: TenantSummary = {
      tenant_id: tenantId.toLowerCase(),
      status: 'pending',
      preset: resourceEstimation.preset,
      services_count: Object.values(services).filter((v: any) => v > 0).length,
      created_at: new Date().toISOString()
    };

    // 부모 컴포넌트에 저장된 테넌시 전달
    if (onTenantSaved) {
      onTenantSaved(savedTenant);
    }

    // 성공 메시지 표시
    setSnackbarMessage(`테넌시 '${tenantId}' 저장 완료!`);
    setSnackbarOpen(true);
    
    // 폼 리셋
    setTenantId('');
    setServices({
      callbot: 0,
      chatbot: 0,
      advisor: 0,
      stt: 0,
      tts: 0,
      ta: 0,
      qa: 0
    });
    setTenancyMode('small');
  };

  // [advice from AI] 통합 데이터 서비스를 사용한 테넌시 생성 핸들러
  const handleSubmit = async () => {
    if (!tenantId.trim()) {
      setError('테넌시 ID를 입력해주세요.');
      return;
    }

    // 테넌시 ID 검증
    const tenantIdRegex = /^[a-z0-9-]+$/;
    if (!tenantIdRegex.test(tenantId)) {
      setError('테넌시 ID는 소문자, 숫자, 하이픈만 사용 가능합니다.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 데모 모드에서는 DemoDataManager를 통해 생성
      // 실사용 모드에서는 실제 API 호출
      const response = await fetch('/api/v1/tenants/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: tenantId.toLowerCase(),
          service_requirements: services,
          tenancy_mode: tenancyMode,
          auto_deploy: true
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      onTenantCreated(result);
      
      // 폼 리셋
      setTenantId('');
      setServices({
        callbot: 0,
        chatbot: 0,
        advisor: 0,
        stt: 0,
        tts: 0,
        ta: 0,
        qa: 0
      });
      setTenancyMode('small');

    } catch (err) {
      setError(err instanceof Error ? err.message : '테넌시 생성 실패');
    } finally {
      setLoading(false);
    }
  };

  // 프리셋별 색상
  const getPresetColor = (preset: string) => {
    switch (preset) {
      case 'micro': return 'info';
      case 'small': return 'success';
      case 'medium': return 'warning';
      case 'large': return 'error';
      default: return 'default';
    }
  };

  return (
    <StyledCard>
      <CardContent sx={{ p: 4 }}>
        <Box display="flex" alignItems="center" mb={3}>
          <RocketIcon sx={{ fontSize: 32, mr: 2, color: 'primary.main' }} />
          <Typography variant="h4" component="h1" fontWeight="bold">
            ECP-AI 테넌시 생성
          </Typography>
        </Box>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            <AlertTitle>오류</AlertTitle>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          {/* 기본 설정 */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="테넌시 ID"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="예: customer-abc"
                helperText={
                  tenantIdStatus.checking ? "중복 확인 중..." :
                  tenantIdStatus.available === true ? "✅ 사용 가능한 ID입니다" :
                  tenantIdStatus.available === false ? `❌ ${tenantIdStatus.message}` :
                  "소문자, 숫자, 하이픈만 사용 가능"
                }
                required
                disabled={loading}
                error={tenantIdStatus.available === false}
                InputProps={{
                  endAdornment: tenantIdStatus.checking ? (
                    <CircularProgress size={20} />
                  ) : tenantIdStatus.available === true ? (
                    <CheckCircleIcon color="success" />
                  ) : tenantIdStatus.available === false ? (
                    <ErrorIcon color="error" />
                  ) : null
                }}
              />
              
              {/* 중복 시 대안 제안 */}
              {tenantIdStatus.available === false && tenantIdStatus.suggestions && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  <AlertTitle>💡 대안 제안</AlertTitle>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    다음 이름들을 사용해보세요:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {tenantIdStatus.suggestions.map((suggestion) => (
                      <Chip
                        key={suggestion}
                        label={suggestion}
                        size="small"
                        onClick={() => setTenantId(suggestion)}
                        sx={{ cursor: 'pointer' }}
                        variant="outlined"
                        color="primary"
                      />
                    ))}
                  </Box>
                </Alert>
              )}
            </Grid>
            

            
            {/* [advice from AI] 클라우드 제공업체 선택 제거 - 매니페스트 생성 후에 선택하도록 변경 */}
          </Grid>



          {/* [advice from AI] 서비스 설정 - 개선된 레이아웃으로 박스 정렬 */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            {/* 메인 서비스 */}
            <Grid item xs={12} lg={6}>
              <ServiceSection sx={{ 
                height: '100%', 
                minHeight: '400px',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  📞 메인 서비스
                  <Tooltip title="콜봇, 챗봇, 어드바이저, STT, TTS는 ECP-AI의 핵심 서비스입니다">
                    <InfoIcon sx={{ ml: 1, fontSize: 20, color: 'text.secondary' }} />
                  </Tooltip>
                </Typography>

                {Object.entries(serviceConfigs).map(([key, config]) => (
                  <Box key={key} sx={{ mb: 3 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="subtitle1" fontWeight="medium">
                        {config.label}: {services[key as keyof ServiceRequirements]}
                      </Typography>
                      <Tooltip title={config.description}>
                        <InfoIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      </Tooltip>
                    </Box>
                    
                    {/* 듀얼 입력: 슬라이더 + 숫자 입력 */}
                    <Box display="flex" alignItems="center" gap={2}>
                      <Slider
                        value={services[key as keyof ServiceRequirements]}
                        onChange={(_, value) => handleServiceChange(key as keyof ServiceRequirements, value as number)}
                        min={0}
                        max={config.max}
                        step={1}
                        marks={config.marks}
                        disabled={loading}
                        color={config.color}
                        sx={{ flex: 1 }}
                        valueLabelDisplay="auto"
                      />
                      <TextField
                        type="number"
                        value={services[key as keyof ServiceRequirements]}
                        onChange={(e) => {
                          const value = Math.max(0, Math.min(config.max, parseInt(e.target.value) || 0));
                          handleServiceChange(key as keyof ServiceRequirements, value);
                        }}
                        inputProps={{ 
                          min: 0, 
                          max: config.max, 
                          step: 1 
                        }}
                        size="small"
                        disabled={loading}
                        sx={{ 
                          width: 90,
                          '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                              borderColor: config.color === 'primary' ? 'primary.main' : 
                                          config.color === 'secondary' ? 'secondary.main' :
                                          config.color === 'success' ? 'success.main' : 'grey.300'
                            }
                          }
                        }}
                      />
                    </Box>
                  </Box>
                ))}
              </ServiceSection>
            </Grid>

            {/* 지원 서비스 */}
            <Grid item xs={12} lg={6}>
              <ServiceSection sx={{ 
                height: '100%', 
                minHeight: '400px',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  🛠️ 지원 서비스
                  <Tooltip title="STT, TTS 독립 운영 서비스와 TA, QA 품질 관리 서비스입니다">
                    <InfoIcon sx={{ ml: 1, fontSize: 20, color: 'text.secondary' }} />
                  </Tooltip>
                </Typography>

                {Object.entries(supportServiceConfigs).map(([key, config]) => (
                  <Box key={key} sx={{ mb: 3 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="subtitle1" fontWeight="medium">
                        {config.label}: {services[key as keyof ServiceRequirements]}
                      </Typography>
                      <Tooltip title={config.description}>
                        <InfoIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      </Tooltip>
                    </Box>
                    
                    {/* 듀얼 입력: 슬라이더 + 숫자 입력 */}
                    <Box display="flex" alignItems="center" gap={2}>
                      <Slider
                        value={services[key as keyof ServiceRequirements]}
                        onChange={(_, value) => handleServiceChange(key as keyof ServiceRequirements, value as number)}
                        min={0}
                        max={config.max}
                        step={1}
                        marks={config.marks}
                        disabled={loading}
                        color={config.color}
                        sx={{ flex: 1 }}
                        valueLabelDisplay="auto"
                      />
                      <TextField
                        type="number"
                        value={services[key as keyof ServiceRequirements]}
                        onChange={(e) => {
                          const value = Math.max(0, Math.min(config.max, parseInt(e.target.value) || 0));
                          handleServiceChange(key as keyof ServiceRequirements, value);
                        }}
                        inputProps={{ 
                          min: 0, 
                          max: config.max, 
                          step: config.step 
                        }}
                        size="small"
                        disabled={loading}
                        sx={{ width: 90 }}
                      />
                    </Box>
                  </Box>
                ))}
              </ServiceSection>
            </Grid>
          </Grid>

          {/* 실시간 예상 계산 결과 */}
          <Alert 
            severity={hasSelectedServices ? "info" : "warning"} 
            sx={{ mb: 3 }}
            action={
              hasSelectedServices && (
                <IconButton
                  size="small"
                  onClick={() => setShowCalculation(!showCalculation)}
                >
                  {showCalculation ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              )
            }
          >
            <AlertTitle sx={{ display: 'flex', alignItems: 'center' }}>
              📊 실시간 예상 계산 (실제 가중치 기반)
              {hasSelectedServices ? (
                <Chip 
                  label={resourceEstimation.preset.toUpperCase()} 
                  color={getPresetColor(resourceEstimation.preset) as any}
                  size="small" 
                  sx={{ ml: 2 }} 
                />
              ) : (
                <Chip 
                  label="대기 중" 
                  color="default"
                  size="small" 
                  sx={{ ml: 2 }} 
                />
              )}
            </AlertTitle>
            
            {hasSelectedServices ? (
              <Box display="flex" flexWrap="wrap" gap={1} mt={1}>
                <MetricChip 
                  icon={<SpeedIcon />}
                  label={`채널: ${resourceEstimation.total_channels}`}
                  variant="outlined"
                  size="small"
                />
                <MetricChip 
                  icon={<MemoryIcon />}
                  label={`사용자: ${resourceEstimation.total_users}`}
                  variant="outlined"
                  size="small"
                />
                <MetricChip 
                  label={`GPU ${resourceEstimation.gpus}개 (${resourceEstimation.gpu_type.toUpperCase()})`}
                  color="primary"
                  size="small"
                />
                <MetricChip 
                  label={`CPU ${resourceEstimation.cpus}코어 (${tenancyMode === 'small' ? '전용' : '전용+인프라'})`}
                  color="secondary"
                  size="small"
                />
                {tenancyMode === 'small' && (
                  <MetricChip 
                    label="공용 인프라: 48코어 (기존 환경)"
                    color="info"
                    variant="outlined"
                    size="small"
                  />
                )}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                메인서비스 또는 지원서비스를 선택하시면 실시간으로 필요한 리소스가 계산됩니다.
                <br />
                📊 채널: 0 | 👥 사용자: 0 | 💾 GPU: 0개 | 🖥️ CPU: 0코어
              </Typography>
            )}

            {hasSelectedServices && (
              <Collapse in={showCalculation}>
                <Divider sx={{ my: 2 }} />
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" gutterBottom fontWeight="medium">
                      📈 일일 쿼리 처리량
                    </Typography>
                    <Typography variant="caption" display="block">
                      • NLP 쿼리: {resourceEstimation.nlp_queries_daily.toLocaleString()}개/일
                    </Typography>
                    <Typography variant="caption" display="block">
                      • AICM 검색: {resourceEstimation.aicm_queries_daily.toLocaleString()}개/일
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" gutterBottom fontWeight="medium">
                      🏗️ {tenancyMode === 'small' ? '소규모 테넌시' : '대규모 테넌시'} 구성
                    </Typography>
                    {tenancyMode === 'small' ? (
                      <Typography variant="caption" display="block">
                        • 메인 서비스: 전용 리소스 배포
                        <br />
                        • 인프라: 공용 환경 활용 (48코어)
                        <br />
                        • 비용 효율적 구성
                      </Typography>
                    ) : (
                      <Typography variant="caption" display="block">
                        • 모든 서비스: 완전 독립 배포
                        <br />
                        • 인프라: 전용 리소스 (48코어)
                        <br />
                        • 최대 성능 및 보안 구성
                      </Typography>
                    )}
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" gutterBottom fontWeight="medium">
                      🐳 필요한 컨테이너 이미지
                    </Typography>
                    {Object.entries(services).map(([serviceName, count]) => {
                      if (count === 0) return null;
                      return (
                        <Typography key={serviceName} variant="caption" display="block">
                          • {serviceName.toUpperCase()}: ecp-ai/{serviceName}:latest
                        </Typography>
                      );
                    })}
                    {Object.values(services).every(v => v === 0) && (
                      <Typography variant="caption" color="text.secondary">
                        서비스를 선택하면 필요한 이미지가 표시됩니다
                      </Typography>
                    )}
                  </Grid>
                </Grid>
              </Collapse>
            )}
          </Alert>



          {/* 생성 버튼들 */}
          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              <Button
                variant="contained"
                size="large"
                onClick={() => setShowWizard(true)}
                disabled={
                  !tenantId.trim() || 
                  Object.values(services).every(v => v === 0) ||
                  tenantIdStatus.available === false ||
                  tenantIdStatus.checking
                }
                startIcon={<RocketIcon />}
                sx={{ 
                  px: 6, 
                  py: 2, 
                  fontSize: '1.2rem',
                  borderRadius: 3,
                  background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                  boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #1976D2 30%, #21CBF3 90%)',
                  }
                }}
              >
                🚀 배포 마법사 시작
              </Button>
            </Box>
            
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              🚀 <strong>배포 마법사</strong>: 단계별 검증을 통한 안전한 배포 (테넌시 설정 저장은 마법사 마지막 단계에서 가능)
            </Typography>
          </Box>

          {/* 권장 하드웨어 구성 (테넌시 생성 버튼 아래로 이동) */}
          <ServiceSection sx={{ mt: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" onClick={() => hasSelectedServices && setShowHardwareSpec(!showHardwareSpec)} sx={{ cursor: hasSelectedServices ? 'pointer' : 'default' }}>
              <Typography variant="h6" color={hasSelectedServices ? 'text.primary' : 'text.secondary'}>
                💻 권장 하드웨어 구성 (가중치 데이터 기반)
                {!hasSelectedServices && (
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    - 서비스 선택 후 확인 가능
                  </Typography>
                )}
              </Typography>
              {hasSelectedServices && (
                <IconButton size="small">
                  {showHardwareSpec ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              )}
            </Box>
            
            {hasSelectedServices ? (
              <Collapse in={showHardwareSpec}>
                <Box sx={{ mt: 2 }}>
                  <HardwareSpecCalculator 
                    serviceRequirements={services}
                    gpuType="auto"
                    tenancyMode={tenancyMode}
                  />
                </Box>
              </Collapse>
            ) : (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  메인서비스 또는 지원서비스를 선택하시면 권장 하드웨어 구성을 확인할 수 있습니다.
                </Typography>
              </Alert>
            )}
          </ServiceSection>

          {/* [advice from AI] 필요한 컨테이너 이미지 정보 섹션 추가 */}
          <ServiceSection sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              🐳 필요한 컨테이너 이미지 정보
              <Tooltip title="선택한 서비스에 따라 필요한 Docker 이미지들을 확인할 수 있습니다">
                <InfoIcon sx={{ ml: 1, fontSize: 20, color: 'text.secondary' }} />
              </Tooltip>
            </Typography>
            
            {Object.values(services).every(v => v === 0) ? (
              <Alert severity="info">
                <Typography variant="body2">
                  서비스를 선택하면 필요한 컨테이너 이미지 정보가 여기에 표시됩니다.
                </Typography>
              </Alert>
            ) : (
              <Grid container spacing={2}>
                {Object.entries(services).map(([serviceName, count]) => {
                  if (count === 0) return null;

                  const getImageInfo = (service: string) => {
                    switch (service) {
                      case 'callbot':
                        return {
                          image: 'ecp-ai/callbot:latest',
                          size: '~1.2GB',
                          description: '음성 통화 AI 상담 서비스',
                          registry: 'Docker Hub / ECR'
                        };
                      case 'chatbot':
                        return {
                          image: 'ecp-ai/chatbot:latest',
                          size: '~980MB',
                          description: '텍스트 기반 AI 채팅 서비스',
                          registry: 'Docker Hub / ECR'
                        };
                      case 'advisor':
                        return {
                          image: 'ecp-ai/advisor:latest',
                          size: '~1.1GB',
                          description: 'AI 보조 상담사 서비스',
                          registry: 'Docker Hub / ECR'
                        };
                      case 'stt':
                        return {
                          image: 'ecp-ai/stt-service:latest',
                          size: '~2.1GB',
                          description: '음성인식 (STT) 독립 서비스',
                          registry: 'Docker Hub / ECR'
                        };
                      case 'tts':
                        return {
                          image: 'ecp-ai/tts-service:latest',
                          size: '~1.8GB',
                          description: '음성합성 (TTS) 독립 서비스',
                          registry: 'Docker Hub / ECR'
                        };
                      case 'ta':
                        return {
                          image: 'ecp-ai/text-analyzer:latest',
                          size: '~850MB',
                          description: '텍스트 분석 서비스',
                          registry: 'Docker Hub / ECR'
                        };
                      case 'qa':
                        return {
                          image: 'ecp-ai/quality-assurance:latest',
                          size: '~750MB',
                          description: '품질 관리 서비스',
                          registry: 'Docker Hub / ECR'
                        };
                      default:
                        return null;
                    }
                  };
                  
                  const imageInfo = getImageInfo(serviceName);
                  if (!imageInfo) return null;
                  
                  // [advice from AI] 실제 배포 인스턴스는 모든 서비스 1개로 시작 (HPA 스케일링)
                  const deploymentInfo = { replicas: 1 };
                  
                  return (
                    <Grid item xs={12} sm={6} md={4} key={serviceName}>
                      <Paper sx={{ 
                        p: 2, 
                        backgroundColor: 'primary.50', 
                        border: '1px solid', 
                        borderColor: 'primary.200',
                        borderRadius: 2
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <Chip 
                            label={serviceName.toUpperCase()} 
                            color="primary" 
                            size="small" 
                            sx={{ mr: 1 }}
                          />
                          <Chip 
                            label={
                              serviceName === 'callbot' ? `${count}채널 처리능력` :
                              serviceName === 'chatbot' ? `${count}명 동시사용자` :
                              serviceName === 'advisor' ? `${count}채널 처리능력` :
                              serviceName === 'stt' ? `${count}채널 처리능력` :
                              serviceName === 'tts' ? `${count}채널 처리능력` :
                              serviceName === 'ta' ? `일일 ${count}건 분석` :
                              serviceName === 'qa' ? `일일 ${count}건 평가` :
                              `${count}개 단위`
                            } 
                            variant="outlined" 
                            size="small"
                          />
                        </Box>
                        <Typography variant="body2" fontWeight="bold" gutterBottom>
                          {imageInfo.image}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {imageInfo.description}
                        </Typography>
                        <Typography variant="caption" color="primary.main" display="block" sx={{ mt: 0.5, fontWeight: 'medium' }}>
                          🚀 배포 인스턴스: {deploymentInfo.replicas}개 (HPA 스케일링)
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                          <Box>
                            <Typography variant="caption" color="primary.main" display="block">
                              크기: {imageInfo.size}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {imageInfo.registry}
                            </Typography>
                          </Box>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => showInstanceDetail(serviceName, 'main')}
                            sx={{ ml: 1 }}
                          >
                            상세정보
                          </Button>
                        </Box>
                      </Paper>
                    </Grid>
                  );
                })}
                
                {(() => {
                  // [advice from AI] 테넌시 모드에 따른 필요 서비스 계산
                  const getRequiredServices = () => {
                    if (tenancyMode === 'small') {
                      // 소규모: 공용 인프라만 표시 (STT/TTS/NLP/AICM는 메인 서비스에 포함)
                      return ['api-gateway', 'postgresql', 'vectordb', 'auth-service', 'nas'];
                    } else {
                      // 대규모: 모든 의존 서비스 포함 (기존 로직)
                      const requiredServices = new Set(['api-gateway', 'postgresql', 'vectordb', 'auth-service', 'nas']);
                      
                      // 각 메인 서비스별 의존성 확인
                      if (services.callbot > 0) {
                        requiredServices.add('stt-service');
                        requiredServices.add('tts-service');
                        requiredServices.add('nlp-service');
                        requiredServices.add('aicm-service');
                      }
                      if (services.chatbot > 0) {
                        requiredServices.add('nlp-service');
                        requiredServices.add('aicm-service');
                      }
                      if (services.advisor > 0) {
                        requiredServices.add('stt-service');
                        requiredServices.add('nlp-service');
                        requiredServices.add('aicm-service');
                      }
                      if (services.ta > 0) {
                        requiredServices.add('nlp-service');
                      }
                      
                      return Array.from(requiredServices);
                    }
                  };

                  const requiredServices = getRequiredServices();
                  
                  if (requiredServices.length === 0) return null;

                  return (
                    <>
                      {/* [advice from AI] 테넌시 모드별 서비스 표시 */}
                      <Grid item xs={12}>
                        <Divider sx={{ my: 2 }}>
                          <Chip 
                            label={tenancyMode === 'small' ? "🏢 공용 인프라 (기존 환경 활용)" : "🏭 전용 인프라 (완전 독립 배포)"} 
                            size="small" 
                            color="secondary" 
                          />
                        </Divider>
                      </Grid>
                      
                      {/* 동적 서비스 렌더링 */}
                      {requiredServices.map((serviceName) => {
                        const getServiceInfo = (service: string) => {
                          switch (service) {
                            case 'api-gateway':
                              return {
                                name: 'API-GATEWAY',
                                image: 'nginx:alpine',
                                size: '~23MB',
                                description: 'API 게이트웨이 (8코어 x 2대)',
                                replicas: 2,
                                type: tenancyMode === 'small' ? '공용' : '전용'
                              };
                            case 'postgresql':
                              return {
                                name: 'POSTGRESQL',
                                image: 'postgres:13',
                                size: '~117MB',
                                description: 'PostgreSQL 데이터베이스 (8코어)',
                                replicas: 1,
                                type: tenancyMode === 'small' ? '공용' : '전용'
                              };
                            case 'vectordb':
                              return {
                                name: 'VECTORDB',
                                image: 'pgvector/pgvector:pg16',
                                size: '~150MB',
                                description: 'Vector 데이터베이스 (8코어)',
                                replicas: 1,
                                type: tenancyMode === 'small' ? '공용' : '전용'
                              };
                            case 'auth-service':
                              return {
                                name: 'AUTH-SERVICE',
                                image: 'ecp-ai/auth-server:latest',
                                size: '~200MB',
                                description: '인증 서비스 (8코어)',
                                replicas: 1,
                                type: tenancyMode === 'small' ? '공용' : '전용'
                              };
                            case 'nas':
                              return {
                                name: 'NAS',
                                image: 'ecp-ai/nas-server:latest',
                                size: '~180MB',
                                description: 'NAS 스토리지 서비스 (8코어)',
                                replicas: 1,
                                type: tenancyMode === 'small' ? '공용' : '전용'
                              };
                            case 'stt-service':
                              return {
                                name: 'STT-SERVICE',
                                image: 'ecp-ai/stt-server:latest',
                                size: '~2.1GB',
                                description: '음성인식 처리 엔진',
                                replicas: 1,
                                type: '전용'
                              };
                            case 'tts-service':
                              return {
                                name: 'TTS-SERVICE',
                                image: 'ecp-ai/tts-server:latest',
                                size: '~1.8GB',
                                description: '음성합성 처리 엔진 (GPU)',
                                replicas: 1,
                                type: '전용'
                              };
                            case 'nlp-service':
                              return {
                                name: 'NLP-SERVICE',
                                image: 'ecp-ai/nlp-server:latest',
                                size: '~1.5GB',
                                description: '자연어 처리 엔진 (GPU)',
                                replicas: 1,
                                type: '전용'
                              };
                            case 'aicm-service':
                              return {
                                name: 'AICM-SERVICE',
                                image: 'ecp-ai/aicm-server:latest',
                                size: '~1.3GB',
                                description: 'AI 지식 검색 엔진 (GPU)',
                                replicas: 1,
                                type: '전용'
                              };
                            default:
                              return null;
                          }
                        };

                        const serviceInfo = getServiceInfo(serviceName);
                        if (!serviceInfo) return null;

                        return (
                          <Grid item xs={12} sm={6} md={4} key={serviceName}>
                            <Paper sx={{ 
                              p: 2, 
                              backgroundColor: serviceInfo.type === '공용' ? 'info.50' : 'grey.50', 
                              border: '1px solid', 
                              borderColor: serviceInfo.type === '공용' ? 'info.200' : 'grey.300',
                              borderRadius: 2
                            }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                <Chip 
                                  label={serviceInfo.name} 
                                  color={serviceInfo.type === '공용' ? 'info' : 'secondary'} 
                                  size="small" 
                                  sx={{ mr: 1 }}
                                />
                                <Chip 
                                  label={serviceInfo.type} 
                                  variant="outlined" 
                                  size="small"
                                  color={serviceInfo.type === '공용' ? 'info' : 'default'}
                                />
                              </Box>
                              <Typography variant="body2" fontWeight="bold" gutterBottom>
                                {serviceInfo.image}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" display="block">
                                {serviceInfo.description}
                              </Typography>
                              <Typography variant="caption" color={serviceInfo.type === '공용' ? 'info.main' : 'secondary.main'} display="block" sx={{ mt: 0.5, fontWeight: 'medium' }}>
                                🚀 배포 인스턴스: {serviceInfo.replicas}개 ({serviceInfo.type === '공용' ? '기존 환경' : 'HPA 스케일링'})
                              </Typography>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                                <Box>
                                  <Typography variant="caption" color={serviceInfo.type === '공용' ? 'info.main' : 'secondary.main'} display="block">
                                    크기: {serviceInfo.size}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    Docker Hub
                                  </Typography>
                                </Box>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color={serviceInfo.type === '공용' ? 'info' : 'secondary'}
                                  onClick={() => showInstanceDetail(serviceName, 'infra')}
                                  sx={{ ml: 1 }}
                                >
                                  상세정보
                                </Button>
                              </Box>
                            </Paper>
                          </Grid>
                        );
                      })}
                    </>
                  );
                })()}
              </Grid>
            )}
            
            {/* 총 이미지 크기 계산 */}
            {Object.values(services).some(v => v > 0) && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  💾 <strong>예상 총 다운로드 크기</strong>: 
                  {(() => {
                    // 메인 서비스 이미지 크기
                    const imageSizes = {
                      callbot: 1.2, chatbot: 0.98, advisor: 1.1, 
                      stt: 2.1, tts: 1.8, ta: 0.85, qa: 0.75
                    };
                    const mainServicesSize = Object.entries(services)
                      .filter(([_, count]) => count > 0)
                      .reduce((sum, [serviceName, _]) => sum + (imageSizes[serviceName as keyof typeof imageSizes] || 0), 0);
                    
                    // 테넌시 모드별 인프라 크기 계산
                    let infraSize = 0;
                    
                    if (tenancyMode === 'small') {
                      // 소규모: 공용 인프라는 다운로드 불필요 (0GB)
                      infraSize = 0;
                    } else {
                      // 대규모: 모든 인프라 + 의존 서비스
                      infraSize += 0.023 + 0.117 + 0.15 + 0.2 + 0.18; // API Gateway + PostgreSQL + VectorDB + Auth + NAS
                      
                      const selectedServices = Object.entries(services).filter(([_, count]) => count > 0);
                      const needsSTT = selectedServices.some(([name]) => ['callbot', 'advisor'].includes(name));
                      const needsTTS = selectedServices.some(([name]) => ['callbot'].includes(name));
                      const needsNLP = selectedServices.some(([name]) => ['callbot', 'chatbot', 'advisor', 'ta'].includes(name));
                      const needsAICM = selectedServices.some(([name]) => ['callbot', 'chatbot', 'advisor'].includes(name));
                      
                      if (needsSTT) infraSize += 2.1;
                      if (needsTTS) infraSize += 1.8;
                      if (needsNLP) infraSize += 1.5;
                      if (needsAICM) infraSize += 1.3;
                    }
                    
                    const totalSize = mainServicesSize + infraSize;
                    return ` 약 ${totalSize.toFixed(1)}GB (메인: ${mainServicesSize.toFixed(1)}GB + ${tenancyMode === 'small' ? '공용 인프라: 0GB' : `전용 인프라: ${infraSize.toFixed(1)}GB`})`;
                  })()}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {tenancyMode === 'small' ? '공용 인프라는 기존 환경을 활용하므로 추가 다운로드가 불필요합니다.' : '첫 배포 시에만 이미지 다운로드가 필요하며, 이후에는 캐시된 이미지를 사용합니다.'}
                </Typography>
              </Alert>
            )}
          </ServiceSection>

          {/* 생성 중 추가 정보 */}
          {loading && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                테넌시를 생성하고 있습니다. Kubernetes 리소스 배포에는 1-2분이 소요될 수 있습니다.
              </Typography>
            </Alert>
          )}
        </Box>
      </CardContent>
      
      {/* 배포 마법사 다이얼로그 */}
      <Dialog 
        open={showWizard} 
        onClose={() => setShowWizard(false)}
        maxWidth="xl"
        fullWidth
        fullScreen
      >
        <DeploymentWizard
          tenantId={tenantId}
          serviceRequirements={services}
          gpuType="auto"
          onDeploymentComplete={(result: any) => {
            setShowWizard(false);
            onTenantCreated(result);
          }}
          onCancel={() => setShowWizard(false)}
          onTenantSaved={(tenant: any) => {
            setShowWizard(false);
            if (onTenantSaved) {
              onTenantSaved(tenant);
            }
          }}
        />
      </Dialog>
      
      {/* 인스턴스 상세 정보 다이얼로그 */}
      <Dialog 
        open={instanceDetailOpen} 
        onClose={() => setInstanceDetailOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <Box sx={{ p: 3 }}>
          {selectedInstanceInfo && (
            <>
              <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                🔍 {selectedInstanceInfo.name} 상세 정보
                <Chip 
                  label={selectedInstanceInfo.type} 
                  color={selectedInstanceInfo.type === '공용 인프라' ? 'info' : 'primary'} 
                  size="small" 
                  sx={{ ml: 2 }} 
                />
              </Typography>

              {/* 기본 정보 */}
              <Paper sx={{ p: 2, mb: 2, backgroundColor: 'grey.50' }}>
                <Typography variant="h6" gutterBottom>📋 기본 정보</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2"><strong>서비스명:</strong> {selectedInstanceInfo.name}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2"><strong>타입:</strong> {selectedInstanceInfo.type}</Typography>
                  </Grid>
                  {selectedInstanceInfo.capacity && (
                    <Grid item xs={12}>
                      <Typography variant="body2"><strong>처리 능력:</strong> {selectedInstanceInfo.capacity}</Typography>
                    </Grid>
                  )}
                  {selectedInstanceInfo.dependencies && selectedInstanceInfo.dependencies.length > 0 && (
                    <Grid item xs={12}>
                      <Typography variant="body2"><strong>의존성:</strong> {selectedInstanceInfo.dependencies.join(', ')}</Typography>
                    </Grid>
                  )}
                </Grid>
              </Paper>

              {/* 배포 정보 */}
              <Paper sx={{ p: 2, mb: 2, backgroundColor: 'primary.50' }}>
                <Typography variant="h6" gutterBottom>🚀 배포 구성</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2"><strong>Replicas:</strong> {selectedInstanceInfo.deployment.replicas}개</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2"><strong>스케일링:</strong> {selectedInstanceInfo.deployment.scaling}</Typography>
                  </Grid>
                </Grid>
              </Paper>

              {/* 리소스 정보 */}
              <Paper sx={{ p: 2, mb: 2, backgroundColor: 'success.50' }}>
                <Typography variant="h6" gutterBottom>💻 리소스 할당</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <Typography variant="body2"><strong>CPU:</strong> {selectedInstanceInfo.deployment.resources.requests.cpu}</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2"><strong>Memory:</strong> {selectedInstanceInfo.deployment.resources.requests.memory}</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2"><strong>GPU:</strong> {selectedInstanceInfo.deployment.resources.requests.gpu}개</Typography>
                  </Grid>
                </Grid>
              </Paper>

              {/* 네트워크 정보 */}
              {selectedInstanceInfo.deployment.ports.length > 0 && (
                <Paper sx={{ p: 2, mb: 2, backgroundColor: 'warning.50' }}>
                  <Typography variant="h6" gutterBottom>🌐 네트워크 설정</Typography>
                  {selectedInstanceInfo.deployment.ports.map((port: any, index: number) => (
                    <Typography key={index} variant="body2">
                      • 포트 {port.port} ({port.name})
                    </Typography>
                  ))}
                </Paper>
              )}

              {/* 환경변수 */}
              {selectedInstanceInfo.deployment.environment.length > 0 && (
                <Paper sx={{ p: 2, mb: 2, backgroundColor: 'info.50' }}>
                  <Typography variant="h6" gutterBottom>🔧 환경변수</Typography>
                  {selectedInstanceInfo.deployment.environment.map((env: any, index: number) => (
                    <Typography key={index} variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {env.name}={env.value}
                    </Typography>
                  ))}
                </Paper>
              )}

              {/* 볼륨 마운트 */}
              {selectedInstanceInfo.deployment.volumes.length > 0 && (
                <Paper sx={{ p: 2, mb: 2, backgroundColor: 'secondary.50' }}>
                  <Typography variant="h6" gutterBottom>💾 볼륨 마운트</Typography>
                  {selectedInstanceInfo.deployment.volumes.map((volume: any, index: number) => (
                    <Typography key={index} variant="body2">
                      • {volume.name} → {volume.mountPath}
                    </Typography>
                  ))}
                </Paper>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                <Button 
                  variant="contained" 
                  onClick={() => setInstanceDetailOpen(false)}
                >
                  닫기
                </Button>
              </Box>
            </>
          )}
        </Box>
      </Dialog>

      {/* 스낵바 알림 */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
      />
    </StyledCard>
  );
};
