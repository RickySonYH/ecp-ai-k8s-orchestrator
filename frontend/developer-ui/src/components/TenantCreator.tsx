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
import { DeploymentWizard } from './DeploymentWizard.tsx';
import { HardwareSpecCalculator } from './HardwareSpecCalculator.tsx';

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
}

interface TenantCreatorProps {
  onTenantCreated: (result: any) => void;
  onTenantSaved?: (tenant: TenantSummary) => void;
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

export const TenantCreator: React.FC<TenantCreatorProps> = ({ onTenantCreated, onTenantSaved }) => {
  // [advice from AI] 데모 모드 감지
  const [isDemoMode, setIsDemoMode] = useState(false);
  
  // 컴포넌트 마운트 시 데모 모드 확인
  useEffect(() => {
    const demoMode = localStorage.getItem('ecp-ai-demo-mode');
    setIsDemoMode(demoMode === 'true');
    console.log('TenantCreator - 데모 모드 감지:', demoMode === 'true');
  }, []);
  // 상태 관리
  const [tenantId, setTenantId] = useState('');
  const [gpuType, setGpuType] = useState<'auto' | 't4' | 'v100' | 'l40s'>('auto');
  // [advice from AI] 테넌시 이름 중복 체크 상태
  const [nameCheckStatus, setNameCheckStatus] = useState<'idle' | 'checking' | 'available' | 'duplicate'>('idle');
  const [nameCheckMessage, setNameCheckMessage] = useState('');
  const [checkTimeout, setCheckTimeout] = useState<NodeJS.Timeout | null>(null);
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

  const [showCalculation, setShowCalculation] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showHardwareSpec, setShowHardwareSpec] = useState(false);
  
  // [advice from AI] 저장 관련 상태 추가
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
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

  // 실시간 리소스 계산 (실제 가중치 기반)
  const resourceEstimation = useMemo((): ResourceEstimation => {
    const totalChannels = services.callbot + services.advisor + services.stt + services.tts;
    const totalUsers = services.chatbot;

    // 프리셋 감지 (실제 기준)
    let preset = 'micro';
    if (totalChannels < 10 && totalUsers < 50) {
      preset = 'micro';
    } else if (totalChannels < 100 && totalUsers < 500) {
      preset = 'small';
    } else if (totalChannels < 500 && totalUsers < 2000) {
      preset = 'medium';
    } else {
      preset = 'large';
    }

    // NLP 일일 쿼리 계산 (실제 가중치)
    const nlpQueriesDaily = 
      services.callbot * 3200 +    // 콜봇: 160콜 × 20쿼리
      services.chatbot * 288 +     // 챗봇: 2.4세션 × 12쿼리
      services.advisor * 2400;     // 어드바이저: 160상담 × 15쿼리

    // AICM 일일 쿼리 계산 (실제 가중치)
    const aicmQueriesDaily =
      services.callbot * 480 +     // 콜봇: 160콜 × 3쿼리
      services.chatbot * 24 +      // 챗봇: 2.4세션 × 1쿼리
      services.advisor * 1360;     // 어드바이저: 160상담 × 8.5쿼리

    // GPU 배수 계산
    let gpuMultiplier = 1.0;
    if (totalChannels > 100 && totalChannels <= 500) {
      gpuMultiplier = 1.5;
    } else if (totalChannels > 500) {
      gpuMultiplier = 2.5;
    }

    // 9시간 근무 기준 초당 쿼리
    const nlpQps = (nlpQueriesDaily / (9 * 3600)) * gpuMultiplier;
    const aicmQps = (aicmQueriesDaily / (9 * 3600)) * gpuMultiplier;

    // GPU 계산 (T4 기준)
    const ttsChannels = services.callbot + services.tts;
    let estimatedGpus = 0;
    estimatedGpus += Math.ceil(ttsChannels / 50);  // TTS (캐시 최적화)
    estimatedGpus += Math.ceil(nlpQps / 150);      // NLP
    estimatedGpus += Math.ceil(aicmQps / 100);     // AICM

    // GPU 타입 자동 선택
    let recommendedGpuType = 't4';
    if (totalChannels <= 100) {
      recommendedGpuType = 't4';  // 소규모 강제
    } else if (estimatedGpus <= 2) {
      recommendedGpuType = 't4';
    } else if (estimatedGpus <= 8) {
      recommendedGpuType = 'v100';
    } else {
      recommendedGpuType = 'l40s';
    }

    // CPU 계산 (실제 가중치)
    const sttChannels = services.callbot + services.advisor * 2 + services.stt;
    let estimatedCpus = Math.ceil(sttChannels / 6.5);  // STT: 6.5채널/코어
    estimatedCpus += Math.ceil(totalChannels * 0.05);  // TA + QA
    estimatedCpus += 20;  // 기본 인프라

    return {
      gpus: Math.max(1, estimatedGpus),
      cpus: Math.max(4, estimatedCpus),
      gpu_type: recommendedGpuType,
      preset,
      nlp_queries_daily: nlpQueriesDaily,
      aicm_queries_daily: aicmQueriesDaily,
      total_channels: totalChannels,
      total_users: totalUsers
    };
  }, [services]);

  // 서비스 값 변경 핸들러
  const handleServiceChange = (service: keyof ServiceRequirements, value: number) => {
    setServices(prev => ({
      ...prev,
      [service]: value
    }));
  };

  // [advice from AI] 클라우드 비교 기능 제거 - 매니페스트 생성 후에 선택하도록 변경

  // [advice from AI] 클라우드 비교 useEffect 제거 - 더 이상 필요하지 않음

  // [advice from AI] 테넌시 이름 중복 체크 함수
  const checkTenantNameDuplicate = async (name: string) => {
    if (!name.trim()) {
      setNameCheckStatus('idle');
      setNameCheckMessage('');
      return;
    }

    setNameCheckStatus('checking');
    setNameCheckMessage('이름 확인 중...');

    try {
      const response = await fetch(`http://localhost:8001/api/v1/demo/tenants/check-name/${encodeURIComponent(name)}`);
      
      if (!response.ok) {
        throw new Error('이름 확인 실패');
      }

      const result = await response.json();
      
      if (result.is_duplicate) {
        setNameCheckStatus('duplicate');
        setNameCheckMessage(result.message || '이미 사용 중인 테넌시 이름입니다.');
      } else {
        setNameCheckStatus('available');
        setNameCheckMessage(result.message || '사용 가능한 테넌시 이름입니다.');
      }
    } catch (error) {
      console.error('이름 중복 체크 실패:', error);
      setNameCheckStatus('idle');
      setNameCheckMessage('이름 확인 중 오류가 발생했습니다.');
    }
  };

  // [advice from AI] 테넌시 이름 입력 핸들러 (실시간 검증)
  const handleTenantIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setTenantId(newValue);

    // 기존 타이머 제거
    if (checkTimeout) {
      clearTimeout(checkTimeout);
    }

    // 500ms 후에 중복 체크 실행 (디바운싱)
    const newTimeout = setTimeout(() => {
      checkTenantNameDuplicate(newValue);
    }, 500);
    
    setCheckTimeout(newTimeout);
  };

  // [advice from AI] 테넌시 저장 핸들러 (실제 DB 저장)
  const handleSave = async () => {
    if (!tenantId.trim()) {
      setError('테넌시 ID를 입력해주세요.');
      return;
    }

    // [advice from AI] 중복 체크 상태 확인
    if (nameCheckStatus === 'duplicate') {
      setError('이미 사용 중인 테넌시 이름입니다. 다른 이름을 사용해주세요.');
      return;
    }

    if (nameCheckStatus === 'checking') {
      setError('이름 중복 체크가 진행 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    // 테넌시 ID 검증
    const tenantIdRegex = /^[a-z0-9-]+$/;
    if (!tenantIdRegex.test(tenantId)) {
      setError('테넌시 ID는 소문자, 숫자, 하이픈만 사용 가능합니다.');
      return;
    }

    try {
      // [advice from AI] 데모 모드에 따라 적절한 API 호출
      const apiUrl = isDemoMode 
        ? 'http://localhost:8001/api/v1/demo/tenants/' 
        : 'http://localhost:8001/api/v1/tenants/';
      
      console.log('TenantCreator - API 호출:', apiUrl, '데모 모드:', isDemoMode);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: tenantId.toLowerCase(),
          name: `테넌시 ${tenantId}`,
          preset: 'medium', // 기본값
          status: 'running',
          is_demo: isDemoMode,
          service_requirements: {
            callbot: services.callbot,
            chatbot: services.chatbot,
            advisor: services.advisor,
            stt: services.stt,
            tts: services.tts,
            ta: services.ta,
            qa: services.qa
          },
          gpu_type: gpuType,
          cloud_provider: 'iaas',
          auto_deploy: false  // 저장만 하고 배포는 안함
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || '테넌시 저장에 실패했습니다.');
      }

      const result = await response.json();
      
      // 저장된 테넌시 정보 생성
      const savedTenant: TenantSummary = {
        tenant_id: result.tenant_id,
        status: result.deployment_status || 'pending',
        preset: result.preset,
        services_count: Object.values(services).filter((v: any) => v > 0).length,
        created_at: result.created_at || new Date().toISOString()
      };

      // 부모 컴포넌트에 저장된 테넌시 전달
      if (onTenantSaved) {
        onTenantSaved(savedTenant);
      }

      // 성공 메시지 표시
      setSnackbarMessage(`테넌시 '${tenantId}' DB 저장 완료!`);
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
      setGpuType('auto');
      
    } catch (error) {
      console.error('테넌시 저장 실패:', error);
      setError(error instanceof Error ? error.message : '테넌시 저장 중 오류가 발생했습니다.');
    }
  };

  // 테넌시 생성 핸들러 (실시간 배포)
  const handleSubmit = async () => {
    if (!tenantId.trim()) {
      setError('테넌시 ID를 입력해주세요.');
      return;
    }

    // [advice from AI] 중복 체크 상태 확인
    if (nameCheckStatus === 'duplicate') {
      setError('이미 사용 중인 테넌시 이름입니다. 다른 이름을 사용해주세요.');
      return;
    }

    if (nameCheckStatus === 'checking') {
      setError('이름 중복 체크가 진행 중입니다. 잠시 후 다시 시도해주세요.');
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
      const response = await fetch('/api/v1/tenants/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: tenantId.toLowerCase(),
          service_requirements: services,
          gpu_type: gpuType,
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
      setGpuType('auto');

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
                onChange={handleTenantIdChange}
                placeholder="예: customer-abc"
                helperText={nameCheckMessage || "소문자, 숫자, 하이픈만 사용 가능"}
                required
                disabled={loading}
                error={nameCheckStatus === 'duplicate'}
                color={nameCheckStatus === 'available' ? 'success' : 'primary'}
                InputProps={{
                  endAdornment: nameCheckStatus === 'checking' ? (
                    <CircularProgress size={20} />
                  ) : nameCheckStatus === 'available' ? (
                    <CheckCircleIcon sx={{ color: 'success.main' }} />
                  ) : nameCheckStatus === 'duplicate' ? (
                    <ErrorIcon sx={{ color: 'error.main' }} />
                  ) : null
                }}
              />
            </Grid>
            
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>GPU 타입</InputLabel>
                <Select
                  value={gpuType}
                  label="GPU 타입"
                  onChange={(e) => setGpuType(e.target.value as any)}
                  disabled={loading}
                >
                  <MenuItem value="auto">자동 선택 (권장)</MenuItem>
                  <MenuItem value="t4">T4 (가성비)</MenuItem>
                  <MenuItem value="v100">V100 (균형)</MenuItem>
                  <MenuItem value="l40s">L40S (고성능)</MenuItem>
                </Select>
              </FormControl>
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
            severity="info" 
            sx={{ mb: 3 }}
            action={
              <IconButton
                size="small"
                onClick={() => setShowCalculation(!showCalculation)}
              >
                {showCalculation ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            }
          >
            <AlertTitle sx={{ display: 'flex', alignItems: 'center' }}>
              📊 실시간 예상 계산 (실제 가중치 기반)
              <Chip 
                label={resourceEstimation.preset.toUpperCase()} 
                color={getPresetColor(resourceEstimation.preset) as any}
                size="small" 
                sx={{ ml: 2 }} 
              />
            </AlertTitle>
            
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
                label={`CPU ${resourceEstimation.cpus}코어`}
                color="secondary"
                size="small"
              />
            </Box>

            <Collapse in={showCalculation}>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
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
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" gutterBottom fontWeight="medium">
                    🎯 GPU 타입 선택 이유
                  </Typography>
                  <Typography variant="caption" display="block">
                    {resourceEstimation.total_channels <= 100 
                      ? "소규모 환경 - T4 강제 (비용 효율)"
                      : resourceEstimation.gpus <= 2
                      ? "GPU 2개 이하 - T4 선택"
                      : resourceEstimation.gpus <= 8
                      ? "GPU 3-8개 - V100 선택"
                      : "GPU 9개 이상 - L40S 선택"
                    }
                  </Typography>
                </Grid>
              </Grid>
            </Collapse>
          </Alert>



          {/* 생성 버튼들 */}
          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              <Button
                variant="contained"
                size="large"
                onClick={() => setShowWizard(true)}
                disabled={!tenantId.trim() || Object.values(services).every(v => v === 0) || nameCheckStatus === 'duplicate' || nameCheckStatus === 'checking'}
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
            <Box display="flex" justifyContent="space-between" alignItems="center" onClick={() => setShowHardwareSpec(!showHardwareSpec)} sx={{ cursor: 'pointer' }}>
              <Typography variant="h6">
                💻 권장 하드웨어 구성 (가중치 데이터 기반)
              </Typography>
              <IconButton size="small">
                {showHardwareSpec ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
            
            <Collapse in={showHardwareSpec}>
              <Box sx={{ mt: 2 }}>
                <HardwareSpecCalculator 
                  serviceRequirements={services}
                  gpuType={gpuType}
                />
              </Box>
            </Collapse>
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
          gpuType={gpuType}
          onDeploymentComplete={(result) => {
            setShowWizard(false);
            onTenantCreated(result);
          }}
          onCancel={() => setShowWizard(false)}
          onTenantSaved={(tenant) => {
            setShowWizard(false);
            if (onTenantSaved) {
              onTenantSaved(tenant);
            }
          }}
        />
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
