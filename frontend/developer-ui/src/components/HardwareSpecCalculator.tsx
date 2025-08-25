// [advice from AI] ECP-AI 하드웨어 스펙 계산기 - 가중치 데이터 기반 상세 계산 결과
/**
 * 하드웨어 스펙 계산 및 표시 컴포넌트
 * - 가중치 데이터 기반 정확한 서버 스펙 계산
 * - AI 서비스 서버 (GPU) + 음성/텍스트 처리 서버 (CPU) + 공통 서비스 서버
 * - 서버별 상세 스펙 (CPU, RAM, 스토리지) 표시
 */

import React, { useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Divider,
  Paper,
  List,
  ListItem,
  ListItemText,
  Alert,
  AlertTitle,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Memory as MemoryIcon,
  Speed as SpeedIcon,
  Storage as StorageIcon,
  CloudQueue as CloudIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

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

interface CloudInstance {
  server_type: string;
  instance_type: string;
  cpu_cores: number;
  ram_gb: number;
  gpu_info?: string;
  monthly_cost_krw: number;
  quantity: number;
  total_cost_krw: number;
}

interface HardwareSpecCalculatorProps {
  serviceRequirements: ServiceRequirements;
  gpuType: string;
}

interface ServerSpec {
  name: string;
  type: 'gpu' | 'cpu' | 'infra';
  count: number;
  cpu_cores: number;
  ram_gb: number;
  storage_gb: number;
  description: string;
  services: string[];
}

// 스타일드 컴포넌트
const ServerCard = styled(Card)(({ theme, serverType }: { theme: any; serverType: string }) => {
  const getColor = () => {
    switch (serverType) {
      case 'gpu': return theme.palette.success.main;
      case 'cpu': return theme.palette.warning.main;
      case 'infra': return theme.palette.info.main;
      default: return theme.palette.grey[500];
    }
  };

  return {
    border: `2px solid ${getColor()}`,
    backgroundColor: `${getColor()}08`,
    transition: 'all 0.3s ease',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: theme.shadows[8],
    },
  };
});

const SpecChip = styled(Chip)(({ theme }) => ({
  margin: theme.spacing(0.5),
  fontWeight: 'bold',
}));

// [advice from AI] 인라인 하드웨어 추천 컴포넌트
const HardwareRecommendationDisplay: React.FC<{
  serviceRequirements: ServiceRequirements & { gpu_type?: string };
  gpuType: string;
}> = ({ serviceRequirements, gpuType }) => {
  const [hardwareData, setHardwareData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // 하드웨어 계산 API 호출
  React.useEffect(() => {
    const fetchHardwareData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/v1/tenants/calculate-detailed-hardware`, {
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
          setHardwareData(data);
        } else {
          throw new Error('API 호출 실패');
        }
      } catch (err) {
        setError('하드웨어 계산 중 오류가 발생했습니다.');
        console.error('Hardware calculation error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHardwareData();
  }, [serviceRequirements, gpuType]);

  // 로딩 상태
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" py={4}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>권장 하드웨어 구성</Typography>
      </Box>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <Alert severity="error" sx={{ my: 2 }}>
        {error}
      </Alert>
    );
  }

  // 데이터가 없는 경우
  if (!hardwareData) {
    return (
      <Alert severity="info" sx={{ my: 2 }}>
        하드웨어 구성 데이터를 불러올 수 없습니다.
      </Alert>
    );
  }

  const { hardware_specification, aws_instances, ncp_instances, cost_analysis } = hardwareData;

  // 비용 포맷팅 [advice from AI] null/undefined 체크 추가로 런타임 에러 방지
  const formatCurrency = (amount: number | undefined | null) => {
    if (amount == null || isNaN(amount)) {
      return '₩0';
    }
    return `₩${amount.toLocaleString()}`;
  };

  const gpuServers = hardware_specification.gpu_servers || [];
  const cpuServers = hardware_specification.cpu_servers || [];
  const infraServers = hardware_specification.infrastructure_servers || [];
  
  console.log('Hardware Data:', { gpuServers, cpuServers, infraServers, aws_instances, ncp_instances });

  return (
    <Box>
      {/* 제목 */}
      <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 'bold', textAlign: 'center' }}>
        📊 권장 하드웨어 구성
      </Typography>

      {/* AI 처리 서버 섹션 */}
      {gpuServers.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <Box sx={{ backgroundColor: '#4caf50', color: 'white', p: 2, fontWeight: 'bold' }}>
            AI 처리 서버
          </Box>
          <CardContent>
            {gpuServers.map((server: any, index: number) => (
              <Paper key={index} sx={{ p: 2, mb: 1, border: '1px solid #e0e0e0' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#4caf50', mb: 1 }}>
                  {server.name} x {server.quantity}대
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>CPU:</strong> {server.cpu_cores}코어, <strong>RAM:</strong> {server.ram_gb}GB, <strong>GPU:</strong> {server.gpu_type || 'T4'} {server.gpu_quantity || 1}개, <strong>스토리지:</strong> {server.storage_gb < 1000 ? server.storage_gb + 'GB' : (server.storage_gb/1000).toFixed(1) + 'TB'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#1976d2', fontStyle: 'italic' }}>
                  용도: {server.purpose}
                </Typography>
              </Paper>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 음성/텍스트 처리 서버 섹션 */}
      {cpuServers.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <Box sx={{ backgroundColor: '#ff9800', color: 'white', p: 2, fontWeight: 'bold' }}>
            음성/텍스트 처리 서버
          </Box>
          <CardContent>
            {cpuServers.map((server: any, index: number) => (
              <Paper key={index} sx={{ p: 2, mb: 1, border: '1px solid #e0e0e0' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#ff9800', mb: 1 }}>
                  {server.name} x {server.quantity}대
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>CPU:</strong> {server.cpu_cores}코어, <strong>RAM:</strong> {server.ram_gb}GB, <strong>스토리지:</strong> {server.storage_gb < 1000 ? server.storage_gb + 'GB' : (server.storage_gb/1000).toFixed(1) + 'TB'} (SSD)
                </Typography>
                <Typography variant="body2" sx={{ color: '#1976d2', fontStyle: 'italic' }}>
                  용도: {server.purpose}
                </Typography>
              </Paper>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 공통 서비스 서버 섹션 */}
      {infraServers.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <Box sx={{ backgroundColor: '#607d8b', color: 'white', p: 2, fontWeight: 'bold' }}>
            공통 서비스 서버
          </Box>
          <CardContent>
            {infraServers.map((server: any, index: number) => (
              <Paper key={index} sx={{ p: 2, mb: 1, border: '1px solid #e0e0e0' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#607d8b', mb: 1 }}>
                  {server.name} x {server.quantity}대
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>CPU:</strong> {server.cpu_cores}코어, <strong>RAM:</strong> {server.ram_gb}GB, <strong>스토리지:</strong> {server.storage_gb < 1000 ? server.storage_gb + 'GB' : (server.storage_gb/1000).toFixed(1) + 'TB'} (SSD)
                </Typography>
                <Typography variant="body2" sx={{ color: '#1976d2', fontStyle: 'italic' }}>
                  용도: {server.purpose}
                </Typography>
              </Paper>
            ))}
          </CardContent>
        </Card>
      )}

      {/* AWS 인스턴스 매핑 */}
      {aws_instances && aws_instances.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <Box sx={{ backgroundColor: '#ff9800', color: 'white', p: 2, fontWeight: 'bold' }}>
            ☁️ AWS 인스턴스 매핑
          </Box>
          <CardContent>
            {aws_instances.map((instance: any, index: number) => (
              <Paper key={index} sx={{ p: 2, mb: 1, border: '1px solid #e0e0e0' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#ff9800', mb: 1 }}>
                  {instance.server_type} → {instance.instance_type} x {instance.quantity}대
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>AWS 사양:</strong> CPU: {instance.cpu_cores}코어, RAM: {instance.ram_gb}GB
                  {instance.gpu_info && <>, GPU: {instance.gpu_info}</>}
                </Typography>
                <Typography variant="body2" sx={{ color: '#2e7d32', fontWeight: 'bold' }}>
                  월간 비용: {formatCurrency(instance.total_cost_krw)}
                </Typography>
              </Paper>
            ))}
            <Box sx={{ mt: 2, p: 2, backgroundColor: '#fff3e0', borderRadius: 1, textAlign: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
                AWS 총 월간 비용: {formatCurrency(cost_analysis?.aws_total_monthly_cost || 0)}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* NCP 인스턴스 매핑 */}
      {ncp_instances && ncp_instances.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <Box sx={{ backgroundColor: '#4caf50', color: 'white', p: 2, fontWeight: 'bold' }}>
            🌐 NCP 인스턴스 매핑
          </Box>
          <CardContent>
            {ncp_instances.map((instance: any, index: number) => (
              <Paper key={index} sx={{ p: 2, mb: 1, border: '1px solid #e0e0e0' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#4caf50', mb: 1 }}>
                  {instance.server_type} → {instance.instance_type} x {instance.quantity}대
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>NCP 사양:</strong> CPU: {instance.cpu_cores}코어, RAM: {instance.ram_gb}GB
                  {instance.gpu_info && <>, GPU: {instance.gpu_info}</>}
                </Typography>
                <Typography variant="body2" sx={{ color: '#388e3c', fontWeight: 'bold' }}>
                  월간 비용: {formatCurrency(instance.total_cost_krw)}
                </Typography>
              </Paper>
            ))}
            <Box sx={{ mt: 2, p: 2, backgroundColor: '#e8f5e8', borderRadius: 1, textAlign: 'center' }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#388e3c' }}>
                NCP 총 월간 비용: {formatCurrency(cost_analysis?.ncp_total_monthly_cost || 0)}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* 비용 비교 요약 */}
      {cost_analysis && (
        <Card sx={{ mb: 2 }}>
          <Box sx={{ backgroundColor: '#2196f3', color: 'white', p: 2, fontWeight: 'bold' }}>
            💰 비용 비교 요약
          </Box>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: '#fff3e0' }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#ff9800' }}>
                    AWS 총 비용
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
                    {formatCurrency(cost_analysis.aws_total_monthly_cost)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">월간</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: '#e8f5e8' }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#4caf50' }}>
                    NCP 총 비용
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#388e3c' }}>
                    {formatCurrency(cost_analysis.ncp_total_monthly_cost)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">월간</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: cost_analysis.cost_difference > 0 ? '#ffebee' : '#e8f5e8' }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold', color: cost_analysis.cost_difference > 0 ? '#d32f2f' : '#388e3c' }}>
                    비용 차이
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: cost_analysis.cost_difference > 0 ? '#d32f2f' : '#388e3c' }}>
                    {formatCurrency(Math.abs(cost_analysis.cost_difference))}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {cost_analysis.cost_difference > 0 ? 'AWS가 더 저렴' : 'NCP가 더 저렴'}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

    </Box>
  );
};

export const HardwareSpecCalculator: React.FC<HardwareSpecCalculatorProps> = ({
  serviceRequirements,
  gpuType
}) => {
  
  const [detailedSpec, setDetailedSpec] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  // 기존 계산 엔진 API 호출
  React.useEffect(() => {
    const fetchDetailedSpec = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/v1/tenants/calculate-detailed-hardware`, {
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
          setDetailedSpec(data);
        } else {
          // 폴백: 클라이언트 계산 사용
          setDetailedSpec(null);
        }
      } catch (err) {
        // 폴백: 클라이언트 계산 사용
        setDetailedSpec(null);
      } finally {
        setLoading(false);
      }
    };

    fetchDetailedSpec();
  }, [serviceRequirements, gpuType]);
  
  // 하드웨어 스펙 계산 (폴백용 - 기존 로직 유지)
  const hardwareSpecs = useMemo(() => {
    const specs: ServerSpec[] = [];
    
    // 총 채널 수 계산
    const totalChannels = serviceRequirements.callbot + serviceRequirements.advisor + 
                         serviceRequirements.stt + serviceRequirements.tts;
    const totalUsers = serviceRequirements.chatbot;
    
    // GPU 배수 계산 (가중치 데이터 기반)
    let gpuMultiplier = 1.0;
    if (totalChannels > 100 && totalChannels <= 500) {
      gpuMultiplier = 1.5;
    } else if (totalChannels > 500) {
      gpuMultiplier = 2.5;
    }
    
    // 1. AI 서비스 서버 (GPU) 계산
    if (totalChannels > 0 || totalUsers > 0) {
      // NLP 일일 쿼리 계산 (실제 가중치)
      const nlpQueriesDaily = 
        serviceRequirements.callbot * 3200 +    // 160콜 × 20쿼리
        serviceRequirements.chatbot * 288 +     // 2.4세션 × 12쿼리
        serviceRequirements.advisor * 2400;     // 160상담 × 15쿼리
      
      // AICM 일일 쿼리 계산 (실제 가중치)
      const aicmQueriesDaily =
        serviceRequirements.callbot * 480 +     // 160콜 × 3쿼리
        serviceRequirements.chatbot * 24 +      // 2.4세션 × 1쿼리
        serviceRequirements.advisor * 1360;     // 160상담 × 8.5쿼리
      
      // 9시간 근무 기준 초당 쿼리
      const nlpQps = (nlpQueriesDaily / (9 * 3600)) * gpuMultiplier;
      const aicmQps = (aicmQueriesDaily / (9 * 3600)) * gpuMultiplier;
      
      // GPU 처리 용량 (가중치 데이터 기반)
      const gpuCapacity = {
        't4': { tts: 50, nlp: 150, aicm: 100 },
        'v100': { tts: 150, nlp: 450, aicm: 300 },
        'l40s': { tts: 200, nlp: 600, aicm: 400 }
      };
      
      const selectedGpuType = gpuType === 'auto' ? 
        (totalChannels <= 100 ? 't4' : totalChannels <= 500 ? 'v100' : 'l40s') : 
        gpuType;
      
      const capacity = gpuCapacity[selectedGpuType as keyof typeof gpuCapacity];
      
      // GPU 서버별 계산
      const ttsChannels = serviceRequirements.callbot + serviceRequirements.tts;
      const ttsGpus = Math.ceil(ttsChannels / capacity.tts);
      const nlpGpus = Math.ceil(nlpQps / capacity.nlp);
      const aicmGpus = Math.ceil(aicmQps / capacity.aicm);
      
      // TTS 서버
      if (ttsGpus > 0) {
        specs.push({
          name: `TTS 서버 (${selectedGpuType.toUpperCase()})`,
          type: 'gpu',
          count: ttsGpus,
          cpu_cores: ttsGpus * 8, // GPU당 8코어
          ram_gb: ttsGpus * (selectedGpuType === 't4' ? 70 : selectedGpuType === 'v100' ? 80 : 80),
          storage_gb: 500,
          description: `TTS 음성 합성 처리 (콜봇 ${serviceRequirements.callbot}채널 + 독립 TTS ${serviceRequirements.tts}채널)`,
          services: ['TTS']
        });
      }
      
      // NLP 서버
      if (nlpGpus > 0) {
        specs.push({
          name: `NLP 서버 (${selectedGpuType.toUpperCase()})`,
          type: 'gpu',
          count: nlpGpus,
          cpu_cores: nlpGpus * 8,
          ram_gb: nlpGpus * (selectedGpuType === 't4' ? 60 : selectedGpuType === 'v100' ? 80 : 80),
          storage_gb: 500,
          description: `자연어 처리 (일일 ${nlpQueriesDaily.toLocaleString()}쿼리, ${nlpQps.toFixed(1)} QPS)`,
          services: ['NLP']
        });
      }
      
      // AICM 서버
      if (aicmGpus > 0) {
        specs.push({
          name: `AICM 서버 (${selectedGpuType.toUpperCase()})`,
          type: 'gpu',
          count: aicmGpus,
          cpu_cores: aicmGpus * 8,
          ram_gb: aicmGpus * (selectedGpuType === 't4' ? 60 : selectedGpuType === 'v100' ? 80 : 80),
          storage_gb: 500,
          description: `AI 지식 관리 (일일 ${aicmQueriesDaily.toLocaleString()}검색, ${aicmQps.toFixed(1)} SPS)`,
          services: ['AICM']
        });
      }
    }
    
    // 2. 음성/텍스트 처리 서버 (CPU) 계산
    const sttChannels = serviceRequirements.callbot + (serviceRequirements.advisor * 2) + serviceRequirements.stt;
    if (sttChannels > 0) {
      const sttCores = Math.ceil(sttChannels / 6.5); // 6.5채널/코어
      specs.push({
        name: 'STT 서버',
        type: 'cpu',
        count: Math.ceil(sttCores / 64), // 64코어 서버 기준
        cpu_cores: sttCores,
        ram_gb: sttCores * 2, // 2GB/코어
        storage_gb: 500,
        description: `음성 인식 처리 (콜봇 ${serviceRequirements.callbot}채널 + 어드바이저 ${serviceRequirements.advisor * 2}채널)`,
        services: ['STT']
      });
    }
    
    // TA 서버 (배치 처리)
    const totalProcessing = 
      serviceRequirements.callbot * 160 + 
      serviceRequirements.chatbot * 2.4 + 
      serviceRequirements.advisor * 160 +
      serviceRequirements.ta;
    
    if (totalProcessing > 0) {
      const taCores = Math.ceil((totalProcessing / 86400) * 0.3 * 16); // 배치 처리 30% 효율
      specs.push({
        name: 'TA 서버',
        type: 'cpu',
        count: Math.ceil(taCores / 64),
        cpu_cores: taCores,
        ram_gb: taCores * 2,
        storage_gb: 500,
        description: `통계 분석 (일일 ${totalProcessing.toLocaleString()}건 처리, 배치 처리 30% 효율)`,
        services: ['TA']
      });
    }
    
    // QA 서버 (외부 LLM 95%, 내부 5%)
    const totalEvaluations = 
      serviceRequirements.callbot * 160 * 0.7 +
      serviceRequirements.chatbot * 2.4 * 0.5 +
      serviceRequirements.advisor * 160 * 0.9 +
      serviceRequirements.qa;
    
    if (totalEvaluations > 0) {
      const qaCores = Math.ceil((totalEvaluations / 86400) * 0.05 * 8); // 내부 처리 5%
      specs.push({
        name: 'QA 서버',
        type: 'cpu',
        count: Math.ceil(qaCores / 64),
        cpu_cores: qaCores,
        ram_gb: qaCores * 2,
        storage_gb: 500,
        description: `품질 관리 (일일 ${totalEvaluations.toLocaleString()}건 평가, 외부 LLM 95%)`,
        services: ['QA']
      });
    }
    
    // 3. 공통 서비스 서버 (인프라) 계산
    
    // 인프라 부하 계산 (가중치 기반)
    const infraLoad = {
      nginx: serviceRequirements.callbot * 0.1 + serviceRequirements.chatbot * 0.08 + serviceRequirements.advisor * 0.12,
      gateway: serviceRequirements.callbot * 0.15 + serviceRequirements.chatbot * 0.12 + serviceRequirements.advisor * 0.18,
      db: serviceRequirements.callbot * 0.2 + serviceRequirements.chatbot * 0.15 + serviceRequirements.advisor * 0.25,
      vectordb: serviceRequirements.advisor * 0.2,
      auth: serviceRequirements.callbot * 0.05 + serviceRequirements.chatbot * 0.04 + serviceRequirements.advisor * 0.08
    };
    
    // Nginx 서버
    const nginxCores = Math.ceil(2 + infraLoad.nginx * 0.1); // 기본 2코어 + 부하당 0.1코어
    specs.push({
      name: 'Nginx 서버',
      type: 'infra',
      count: 1,
      cpu_cores: nginxCores,
      ram_gb: nginxCores * 2,
      storage_gb: 500,
      description: `로드 밸런싱 (전체 ${totalChannels}채널 트래픽 분산)`,
      services: ['Nginx']
    });
    
    // API Gateway 서버 (이중화)
    const gatewayCores = Math.ceil(4 + infraLoad.gateway * 0.1); // 기본 4코어
    specs.push({
      name: 'API Gateway 서버',
      type: 'infra',
      count: 2,
      cpu_cores: gatewayCores,
      ram_gb: gatewayCores * 2,
      storage_gb: 500,
      description: `API 라우팅 (전체 ${totalChannels}채널 서비스 요청 처리)`,
      services: ['API Gateway']
    });
    
    // PostgreSQL 서버
    const dbCores = Math.ceil(8 + infraLoad.db * 0.1); // 기본 8코어
    const dbStorage = Math.max(1, (totalUsers + totalChannels) * 0.005); // 동적 스토리지
    specs.push({
      name: 'PostgreSQL 서버',
      type: 'infra',
      count: 1,
      cpu_cores: dbCores,
      ram_gb: dbCores * 4, // 데이터 서버는 4GB/코어
      storage_gb: dbStorage * 1024, // TB → GB
      description: `데이터 저장 (전체 ${totalChannels}채널: 콜봇, 챗봇, 어드바이저) (총 ${dbStorage.toFixed(1)}TB)`,
      services: ['PostgreSQL']
    });
    
    // VectorDB 서버 (어드바이저용)
    if (serviceRequirements.advisor > 0) {
      const vectordbCores = Math.ceil(6 + infraLoad.vectordb * 0.1);
      specs.push({
        name: 'VectorDB 서버',
        type: 'infra',
        count: 1,
        cpu_cores: vectordbCores,
        ram_gb: vectordbCores * 4,
        storage_gb: 500,
        description: `벡터 검색 (어드바이저 전용) (어드바이저 ${serviceRequirements.advisor}채널)`,
        services: ['VectorDB']
      });
    }
    
    // Auth Service 서버
    const authCores = Math.ceil(3 + infraLoad.auth * 0.1);
    specs.push({
      name: 'Auth Service 서버',
      type: 'infra',
      count: 1,
      cpu_cores: authCores,
      ram_gb: authCores * 2,
      storage_gb: 500,
      description: `인증 관리 (전체 ${totalChannels}채널: 콜봇, 챗봇, 어드바이저)`,
      services: ['Auth Service']
    });
    
    // NAS 서버
    const nasStorage = Math.max(1, (totalUsers + totalChannels) * 0.005);
    specs.push({
      name: 'NAS 서버',
      type: 'infra',
      count: 1,
      cpu_cores: 8,
      ram_gb: 16,
      storage_gb: nasStorage * 1024,
      description: `네트워크 스토리지 (전체 ${totalChannels}채널 데이터) (총 ${nasStorage.toFixed(1)}TB)`,
      services: ['NAS']
    });
    
    return specs;
  }, [serviceRequirements, gpuType]);
  
  // 서버 타입별 그룹화
  const groupedSpecs = useMemo(() => {
    const groups = {
      gpu: hardwareSpecs.filter(spec => spec.type === 'gpu'),
      cpu: hardwareSpecs.filter(spec => spec.type === 'cpu'),
      infra: hardwareSpecs.filter(spec => spec.type === 'infra')
    };
    return groups;
  }, [hardwareSpecs]);
  
  // 총 리소스 계산
  const totalResources = useMemo(() => {
    return hardwareSpecs.reduce((total, spec) => ({
      servers: total.servers + spec.count,
      cpu_cores: total.cpu_cores + (spec.cpu_cores * spec.count),
      ram_gb: total.ram_gb + (spec.ram_gb * spec.count),
      storage_tb: total.storage_tb + (spec.storage_gb * spec.count / 1024)
    }), { servers: 0, cpu_cores: 0, ram_gb: 0, storage_tb: 0 });
  }, [hardwareSpecs]);

  const getServerTypeLabel = (type: string) => {
    switch (type) {
      case 'gpu': return 'AI 처리 서버';
      case 'cpu': return '음성/텍스트 처리 서버';
      case 'infra': return '공통 서비스 서버';
      default: return '기타 서버';
    }
  };

  const getServerTypeIcon = (type: string) => {
    switch (type) {
      case 'gpu': return '🤖';
      case 'cpu': return '🔊';
      case 'infra': return '🛠️';
      default: return '📦';
    }
  };

  // [advice from AI] 계산 엔진 결과 기반 서버 이름 생성
  const _getServerDisplayName = (spec: any, fallbackType: string) => {
    // 1. 계산 엔진에서 향상된 서버 이름이 있으면 우선 사용
    if (spec.type && spec.type.includes('서버') && spec.type.includes('x')) {
      return spec.type.replace(' x 1대', ''); // 단일 서버인 경우 'x 1대' 제거
    }
    
    // 2. 계산 엔진에서 온 데이터면 그대로 사용
    if (spec.type && spec.type !== fallbackType) {
      return spec.type;
    }
    
    // 3. 이름이 명시되어 있으면 사용
    if (spec.name && !spec.name.includes('서버')) {
      return spec.name;
    }
    
    // 4. 역할 기반으로 이름 생성 (폴백용)
    if (spec.purpose) {
      return spec.purpose;
    }
    
    // 5. 서비스 기반으로 이름 추정 (폴백용)
    if (spec.services && spec.services.length > 0) {
      const service = spec.services[0];
      if (service === 'TTS') return 'TTS 서버 (L40S)';
      if (service === 'NLP') return 'NLP 서버 (V100)';
      if (service === 'AICM') return 'AICM 서버 (V100)';
      if (service === 'STT') return 'STT 서버 (64코어)';
      if (service === 'TA') return 'TA 서버 (16코어)';
      if (service === 'QA') return 'QA 서버 (8코어)';
      if (service === 'Nginx') return 'Nginx 서버 (36코어)';
      if (service === 'API Gateway') return 'API Gateway 서버 (32코어)';
      if (service === 'PostgreSQL') return 'PostgreSQL 서버 (64코어)';
      if (service === 'VectorDB') return 'VectorDB 서버 (16코어)';
      if (service === 'Auth Service') return 'Auth Service 서버 (8코어)';
      if (service === 'NAS') return 'NAS 서버 (8코어)';
    }
    
    // 6. 최종 폴백
    return spec.name || `${fallbackType} 서버`;
  };

  // [advice from AI] 서버 설명 생성
  const _getServerDescription = (spec: any, serviceReqs: any) => {
    // 1. 계산 엔진에서 온 상세 설명이 있으면 우선 사용
    if (spec.purpose && spec.purpose !== spec.type) {
      return spec.purpose;
    }
    
    // 2. 기본 설명이 있으면 사용
    if (spec.description) {
      return spec.description;
    }
    
    // 3. 처리 용량 정보가 있으면 포함
    if (spec.processing_capacity) {
      return `처리 용량: ${spec.processing_capacity}`;
    }
    
    // 4. 서비스 기반으로 설명 생성 (총 채널 수 기반)
    if (spec.services && spec.services.length > 0) {
      const service = spec.services[0];
      
      // 총 채널 수 계산 (공용 인프라용)
      const totalChannels = serviceReqs.callbot + serviceReqs.chatbot + 
                           serviceReqs.advisor + serviceReqs.stt + 
                           serviceReqs.tts;
      
      const descriptions = {
        'TTS': 'TTS 음성 합성 처리 (콜봇 전용 TTS 채널)',
        'NLP': '자연어 처리 (콜봇, 챗봇, 어드바이저 쿼리 분석)',
        'AICM': 'AI 지식 관리 벡터 검색 (RAG 기반 답변 생성)',
        'STT': '음성 인식 처리 (콜봇, 어드바이저 실시간 음성 변환)',
        'TA': '통계 분석 배치 처리 (1채널당 1통화 50문장을 1분 이내 처리)',
        'QA': '품질 관리 평가 (외부 LLM 기반, 내부 GPU 부하 최소)',
        'Nginx': `로드 밸런싱 (전체 ${totalChannels}채널 트래픽 분산)`,
        'API Gateway': `API 라우팅 (전체 ${totalChannels}채널 서비스 요청 처리)`,
        'PostgreSQL': `데이터 저장 (전체 ${totalChannels}채널: 콜봇, 챗봇, 어드바이저) (총 2.2TB)`,
        'VectorDB': `벡터 검색 (어드바이저 전용) (어드바이저 ${serviceReqs.advisor}채널)`,
        'Auth Service': `인증 관리 (전체 ${totalChannels}채널: 콜봇, 챗봇, 어드바이저)`,
        'NAS': `네트워크 스토리지 (전체 ${totalChannels}채널 데이터) (총 2.2TB)`
      };
      
      return descriptions[service] || `${service} 서비스 처리`;
    }
    
    // 5. 최종 폴백
    return '서버 역할 및 처리 용량 정보';
  };

  // 로딩 상태 처리
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" py={4}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>정교한 하드웨어 계산 중...</Typography>
      </Box>
    );
  }

  // 기존 계산 엔진 결과가 있으면 우선 사용
  const displaySpec = detailedSpec?.hardware_specification || null;
  const displayTotalResources = displaySpec?.total_summary || totalResources;
  const displayServerGroups = displaySpec ? {
    gpu: displaySpec.gpu_servers || [],
    cpu: displaySpec.cpu_servers || [],
    infra: displaySpec.infrastructure_servers || []
  } : groupedSpecs;

  return (
    <Box>
      {/* 새로운 하드웨어 추천 디스플레이 사용 */}
      <HardwareRecommendationDisplay 
        serviceRequirements={{
          callbot: serviceRequirements.callbot,
          chatbot: serviceRequirements.chatbot,
          advisor: serviceRequirements.advisor,
          standalone_stt: serviceRequirements.stt,
          standalone_tts: serviceRequirements.tts,
          ta: serviceRequirements.ta,
          qa: serviceRequirements.qa,
          gpu_type: gpuType
        }}
        gpuType={gpuType}
      />

      {/* 기존 계산 엔진 상태 표시 (참고용) */}
      {detailedSpec ? (
        <Alert severity="success" sx={{ mb: 2 }}>
          <Typography variant="body2">
            ✅ 정교한 계산 엔진 사용 중 (실제 가중치 데이터 + AWS/NCP 매핑)
          </Typography>
        </Alert>
      ) : (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            ℹ️ 기본 계산 모드 (정교한 계산 엔진 연결 실패)
          </Typography>
        </Alert>
      )}

      {/* 기존 UI는 숨김 - 새로운 HardwareRecommendationDisplay 컴포넌트가 모든 기능을 대체 */}
    </Box>
  );
};
