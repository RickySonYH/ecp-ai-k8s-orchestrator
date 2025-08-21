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
  CircularProgress
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
        const response = await fetch(`/api/v1/tenants/hardware-calc/calculate-detailed-hardware`, {
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
      description: '로드 밸런싱 (전체 3200채널: 콜봇, 챗봇, 어드바이저, STT, TTS, TA, QA)',
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
      description: 'API 라우팅 (전체 3200채널: 콜봇, 챗봇, 어드바이저, STT, TTS, TA, QA) (총 64코어)',
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
      description: `데이터 저장 (전체 3200채널: 콜봇, 챗봇, 어드바이저, STT, TTS, TA, QA) (총 ${dbStorage.toFixed(1)}TB)`,
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
        description: `벡터 검색 (어드바이저 전용) (전체 3200채널: 콜봇 ${serviceRequirements.callbot}채널 + 어드바이저 ${serviceRequirements.advisor * 2}채널)`,
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
      description: '인증 관리 (전체 3200채널: 콜봇, 챗봇, 어드바이저, STT, TTS, TA, QA) (총 8코어)',
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
      description: `네트워크 스토리지 (총 유저 3200명, 16.0TB) (총 ${nasStorage.toFixed(1)}TB)`,
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
      {/* 계산 엔진 상태 표시 */}
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

      {/* 총 리소스 요약 */}
      <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <CardContent>
          <Typography variant="h5" gutterBottom textAlign="center" fontWeight="bold">
            📊 권장 하드웨어 구성
          </Typography>
          <Grid container spacing={2} textAlign="center">
            <Grid item xs={3}>
              <Typography variant="h4" fontWeight="bold">{displayTotalResources.servers || displayTotalResources.total_servers}</Typography>
              <Typography variant="body2">총 서버</Typography>
            </Grid>
            <Grid item xs={3}>
              <Typography variant="h4" fontWeight="bold">{displayTotalResources.cpu_cores || displayTotalResources.total_cpu_cores}</Typography>
              <Typography variant="body2">총 CPU 코어</Typography>
            </Grid>
            <Grid item xs={3}>
              <Typography variant="h4" fontWeight="bold">{displayTotalResources.ram_gb || displayTotalResources.total_ram_gb}</Typography>
              <Typography variant="body2">총 RAM (GB)</Typography>
            </Grid>
            <Grid item xs={3}>
              <Typography variant="h4" fontWeight="bold">{(displayTotalResources.storage_tb || displayTotalResources.total_storage_tb)?.toFixed(1)}</Typography>
              <Typography variant="body2">총 스토리지 (TB)</Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 서버 타입별 상세 스펙 */}
      {Object.entries(displayServerGroups).map(([type, specs]) => (
        specs.length > 0 && (
          <Accordion key={type} defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6" fontWeight="bold">
                {getServerTypeIcon(type)} {getServerTypeLabel(type)} ({specs.length}종류)
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                {specs.map((spec, index) => (
                  <Grid item xs={12} md={6} key={index}>
                    <ServerCard serverType={spec.type || type}>
                      <CardContent>
                        <Typography variant="h6" gutterBottom fontWeight="bold">
                          {spec.type || spec.name} x {spec.count}대
                        </Typography>
                        
                        <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                          <SpecChip 
                            icon={<SpeedIcon />}
                            label={`CPU: ${spec.cpu_cores}코어`}
                            color="primary"
                            size="small"
                          />
                          <SpecChip 
                            icon={<MemoryIcon />}
                            label={`RAM: ${spec.ram_gb}GB`}
                            color="secondary"
                            size="small"
                          />
                          <SpecChip 
                            icon={<StorageIcon />}
                            label={`스토리지: ${(spec.storage_ssd_tb || spec.storage_nvme_tb || spec.storage_gb || 0.5) >= 1 ? 
                              ((spec.storage_ssd_tb || spec.storage_nvme_tb || spec.storage_gb/1024)).toFixed(1) + 'TB' : 
                              (spec.storage_gb || 500) + 'GB'}`}
                            color="info"
                            size="small"
                          />
                          {spec.gpu_per_server && (
                            <SpecChip 
                              icon={<CloudIcon />}
                              label={`GPU: ${spec.gpu_per_server}개`}
                              color="success"
                              size="small"
                            />
                          )}
                        </Box>
                        
                        <Typography variant="body2" color="text.secondary">
                          {spec.purpose || spec.description}
                        </Typography>
                        
                        <Divider sx={{ my: 1 }} />
                        
                        <Box display="flex" flexWrap="wrap" gap={0.5}>
                          {(spec.services || ['Service']).map((service) => (
                            <Chip
                              key={service}
                              label={service}
                              size="small"
                              variant="outlined"
                            />
                          ))}
                        </Box>
                      </CardContent>
                    </ServerCard>
                  </Grid>
                ))}
              </Grid>
            </AccordionDetails>
          </Accordion>
        )
      ))}
      
      {/* 클라우드 비용 분석 (기존 계산 엔진 결과가 있는 경우) */}
      {detailedSpec?.cost_breakdown && (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6" fontWeight="bold">
              💰 클라우드 비용 분석
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              {detailedSpec.cost_breakdown.aws && (
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>AWS 비용</Typography>
                    <Typography variant="h5" color="primary">
                      ${detailedSpec.cost_breakdown.aws.total_monthly_cost_usd?.toFixed(0) || 0}/월
                    </Typography>
                  </Paper>
                </Grid>
              )}
              {detailedSpec.cost_breakdown.ncp && (
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>NCP 비용</Typography>
                    <Typography variant="h5" color="secondary">
                      ₩{detailedSpec.cost_breakdown.ncp.total_monthly_cost_krw?.toLocaleString() || 0}/월
                    </Typography>
                  </Paper>
                </Grid>
              )}
            </Grid>
          </AccordionDetails>
        </Accordion>
      )}
      
      {/* 주요 계산 근거 */}
      <Alert severity="info" sx={{ mt: 2 }}>
        <AlertTitle>💡 계산 근거 (실제 가중치 데이터 기반)</AlertTitle>
        <Typography variant="body2">
          • <strong>콜봇</strong>: 일일 3200 NLP쿼리, 480 AICM쿼리 (160콜 × 20쿼리, 160콜 × 3쿼리)<br/>
          • <strong>챗봇</strong>: 일일 288 NLP쿼리, 24 AICM쿼리 (2.4세션 × 12쿼리, 2.4세션 × 1쿼리)<br/>
          • <strong>어드바이저</strong>: 일일 2400 NLP쿼리, 1360 AICM쿼리 (160상담 × 15쿼리, 160상담 × 8.5쿼리)<br/>
          • <strong>STT 처리</strong>: 6.5채널/코어 (콜봇 1:1, 어드바이저 1:2)<br/>
          • <strong>GPU 배수</strong>: ≤100채널(1.0배), 101-500채널(1.5배), >500채널(2.5배)
        </Typography>
      </Alert>
    </Box>
  );
};
