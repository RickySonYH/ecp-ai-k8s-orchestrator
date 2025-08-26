// [advice from AI] CI/CD 설정 컴포넌트 - 초보자를 위한 상세한 설명과 예시 포함
/**
 * CI/CD 설정 컴포넌트
 * - 빌드 환경, 배포 전략, 파이프라인 설정 관리
 * - 초보자를 위한 단계별 가이드와 예시 제공
 * - 데모 모드와 실제 모드 지원
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert,
  AlertTitle,
  Grid,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Collapse,
  FormControlLabel,
  Switch,
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Build as BuildIcon,
  Rocket as RocketIcon,
  AccountTree as PipelineIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

import { CICDConfig } from '../SettingsTab';

interface CICDSettingsProps {
  config: CICDConfig;
  demoMode: boolean;
  onChange: (config: CICDConfig) => void;
}

const buildServers = [
  { 
    value: 'github-actions', 
    label: 'GitHub Actions', 
    description: 'GitHub에서 제공하는 CI/CD 서비스',
    pros: ['무료', 'GitHub와 통합', 'YAML 기반 설정'],
    cons: ['GitHub 전용', '빌드 시간 제한']
  },
  { 
    value: 'gitlab-ci', 
    label: 'GitLab CI', 
    description: 'GitLab에서 제공하는 CI/CD 서비스',
    pros: ['무료', 'GitLab과 통합', 'Docker 지원'],
    cons: ['GitLab 전용', '고급 기능 제한']
  },
  { 
    value: 'jenkins', 
    label: 'Jenkins', 
    description: '오픈소스 CI/CD 서버',
    pros: ['무료', '플러그인 풍부', '자체 서버 운영'],
    cons: ['설정 복잡', '서버 관리 필요']
  },
  { 
    value: 'azure-devops', 
    label: 'Azure DevOps', 
    description: 'Microsoft의 CI/CD 서비스',
    pros: ['Azure 통합', '강력한 기능', '기업 지원'],
    cons: ['유료', 'Microsoft 생태계']
  }
];

const deploymentStrategies = [
  {
    value: 'rolling',
    name: 'Rolling Update',
    description: '점진적으로 Pod를 교체하여 무중단 배포',
    icon: '🔄',
    pros: ['무중단 배포', '리소스 효율적', '롤백 용이'],
    cons: ['배포 시간 길음', '리소스 2배 필요']
  },
  {
    value: 'blue-green',
    name: 'Blue-Green Deployment',
    description: '새 버전을 완전히 준비한 후 한 번에 전환',
    icon: '🔄',
    pros: ['빠른 전환', '롤백 즉시', '테스트 용이'],
    cons: ['리소스 2배 필요', '비용 증가']
  },
  {
    value: 'canary',
    name: 'Canary Deployment',
    description: '소수 사용자에게 먼저 배포하여 점진적 확산',
    icon: '🐦',
    pros: ['위험 최소화', '사용자 피드백', '점진적 확산'],
    cons: ['복잡한 설정', '모니터링 필요']
  }
];

export const CICDSettings: React.FC<CICDSettingsProps> = ({ config, demoMode, onChange }) => {
  const [expandedSections, setExpandedSections] = useState({
    build: true,
    deployment: true,
    pipeline: true
  });
  const [pipelineStatus, setPipelineStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');

  const handleConfigChange = (field: keyof CICDConfig, value: any) => {
    onChange({ ...config, [field]: value });
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // 데모 모드에서 파이프라인 실행 시뮬레이션
  const runPipeline = async () => {
    if (pipelineStatus === 'running') return;
    
    setPipelineStatus('running');
    
    if (demoMode) {
      // 데모 모드: 가상의 파이프라인 실행
      setTimeout(() => {
        setPipelineStatus(Math.random() > 0.2 ? 'success' : 'error');
      }, 5000);
    } else {
      // 실제 모드: 실제 파이프라인 실행
      try {
        // TODO: 실제 CI/CD 파이프라인 실행
        setPipelineStatus('success');
      } catch (error) {
        setPipelineStatus('error');
      }
    }
  };

  const stopPipeline = () => {
    setPipelineStatus('idle');
  };

  const getPipelineStatusIcon = () => {
    switch (pipelineStatus) {
      case 'running': return <RefreshIcon className="spinner" />;
      case 'success': return <CheckCircleIcon color="success" />;
      case 'error': return <ErrorIcon color="error" />;
      default: return <PlayArrowIcon />;
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom color="primary">
        🚀 CI/CD 설정
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        <AlertTitle>💡 CI/CD란?</AlertTitle>
        <Typography variant="body2">
          CI/CD는 Continuous Integration(지속적 통합)과 Continuous Deployment(지속적 배포)의 약자입니다. 
          코드 변경 시 자동으로 빌드, 테스트, 배포를 수행하여 개발 효율성을 높입니다.
        </Typography>
      </Alert>

      {/* 빌드 환경 설정 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
            onClick={() => toggleSection('build')}
          >
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <BuildIcon color="primary" />
              빌드 환경 설정
            </Typography>
            <IconButton size="small">
              {expandedSections.build ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          
          <Collapse in={expandedSections.build}>
            <Divider sx={{ my: 2 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>빌드 서버</InputLabel>
                  <Select
                    value={config.buildServer}
                    label="빌드 서버"
                    onChange={(e) => handleConfigChange('buildServer', e.target.value)}
                    disabled={demoMode}
                  >
                    {buildServers.map(server => (
                      <MenuItem key={server.value} value={server.value}>
                        {server.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <TextField
                  fullWidth
                  label="Docker Registry"
                  placeholder="docker.io/username"
                  value={config.dockerRegistry}
                  onChange={(e) => handleConfigChange('dockerRegistry', e.target.value)}
                  disabled={demoMode}
                  sx={{ mb: 2 }}
                  helperText="Docker 이미지를 저장할 레지스트리 주소"
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.autoRollback}
                      onChange={(e) => handleConfigChange('autoRollback', e.target.checked)}
                      disabled={demoMode}
                    />
                  }
                  label="자동 롤백 활성화"
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, backgroundColor: 'primary.50' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    📊 빌드 서버 비교
                  </Typography>
                  {buildServers.map(server => (
                    <Box key={server.value} sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {server.label}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        {server.description}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {server.pros.map((pro, index) => (
                          <Chip key={index} label={pro} size="small" color="success" variant="outlined" />
                        ))}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                        {server.cons.map((con, index) => (
                          <Chip key={index} label={con} size="small" color="warning" variant="outlined" />
                        ))}
                      </Box>
                    </Box>
                  ))}
                </Paper>
              </Grid>
            </Grid>
          </Collapse>
        </CardContent>
      </Card>

      {/* 배포 전략 설정 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
            onClick={() => toggleSection('deployment')}
          >
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <RocketIcon color="primary" />
              배포 전략 설정
            </Typography>
            <IconButton size="small">
              {expandedSections.deployment ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          
          <Collapse in={expandedSections.deployment}>
            <Divider sx={{ my: 2 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel>배포 전략</InputLabel>
                  <Select
                    value={config.deploymentStrategy}
                    label="배포 전략"
                    onChange={(e) => handleConfigChange('deploymentStrategy', e.target.value)}
                    disabled={demoMode}
                  >
                    {deploymentStrategies.map(strategy => (
                      <MenuItem key={strategy.value} value={strategy.value}>
                        {strategy.icon} {strategy.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                {deploymentStrategies.map(strategy => (
                  strategy.value === config.deploymentStrategy && (
                    <Paper key={strategy.value} sx={{ p: 2, backgroundColor: 'info.50' }}>
                      <Typography variant="h6" gutterBottom>
                        {strategy.icon} {strategy.name}
                      </Typography>
                      <Typography variant="body1" sx={{ mb: 2 }}>
                        {strategy.description}
                      </Typography>
                      
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" color="success.main" gutterBottom>
                            ✅ 장점
                          </Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {strategy.pros.map((pro, index) => (
                              <Typography key={index} variant="body2">
                                • {pro}
                              </Typography>
                            ))}
                          </Box>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" color="warning.main" gutterBottom>
                            ⚠️ 단점
                          </Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {strategy.cons.map((con, index) => (
                              <Typography key={index} variant="body2">
                                • {con}
                              </Typography>
                            ))}
                          </Box>
                        </Grid>
                      </Grid>
                    </Paper>
                  )
                ))}
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2, backgroundColor: 'warning.50' }}>
                  <Typography variant="subtitle2" gutterBottom color="warning.main">
                    🎯 배포 전략 선택 가이드
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Rolling Update</strong>: 안정성과 효율성을 중시하는 경우
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Blue-Green</strong>: 빠른 전환과 안전한 롤백이 필요한 경우
                  </Typography>
                  <Typography variant="body2">
                    <strong>Canary</strong>: 새로운 기능의 안정성을 검증하고 싶은 경우
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Collapse>
        </CardContent>
      </Card>

      {/* 파이프라인 설정 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
            onClick={() => toggleSection('pipeline')}
          >
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PipelineIcon color="primary" />
              파이프라인 설정
            </Typography>
            <IconButton size="small">
              {expandedSections.pipeline ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          
          <Collapse in={expandedSections.pipeline}>
            <Divider sx={{ my: 2 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <Typography variant="body1" sx={{ mb: 3 }}>
                  CI/CD 파이프라인은 코드 변경부터 배포까지의 전체 과정을 자동화합니다.
                  각 단계별로 설정을 조정할 수 있습니다.
                </Typography>
                
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle1">🔨 Build Stage (빌드 단계)</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      소스 코드를 컴파일하고 Docker 이미지를 빌드합니다.
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip label="코드 컴파일" color="primary" size="small" />
                      <Chip label="Docker 빌드" color="primary" size="small" />
                      <Chip label="이미지 푸시" color="primary" size="small" />
                    </Box>
                  </AccordionDetails>
                </Accordion>
                
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle1">🧪 Test Stage (테스트 단계)</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      단위 테스트, 통합 테스트, 보안 테스트를 실행합니다.
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip label="단위 테스트" color="secondary" size="small" />
                      <Chip label="통합 테스트" color="secondary" size="small" />
                      <Chip label="보안 스캔" color="secondary" size="small" />
                    </Box>
                  </AccordionDetails>
                </Accordion>
                
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle1">🚀 Deploy Stage (배포 단계)</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      테스트가 통과한 이미지를 Kubernetes에 배포합니다.
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip label="매니페스트 생성" color="success" size="small" />
                      <Chip label="K8s 배포" color="success" size="small" />
                      <Chip label="헬스체크" color="success" size="small" />
                    </Box>
                  </AccordionDetails>
                </Accordion>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2, backgroundColor: 'success.50' }}>
                  <Typography variant="subtitle2" gutterBottom color="success.main">
                    🎮 파이프라인 제어
                  </Typography>
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Button
                      variant="contained"
                      startIcon={getPipelineStatusIcon()}
                      onClick={runPipeline}
                      disabled={pipelineStatus === 'running'}
                      fullWidth
                    >
                      {pipelineStatus === 'running' ? '실행 중...' : '파이프라인 실행'}
                    </Button>
                    
                    {pipelineStatus === 'running' && (
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<StopIcon />}
                        onClick={stopPipeline}
                        fullWidth
                      >
                        중지
                      </Button>
                    )}
                    
                    {pipelineStatus === 'success' && (
                      <Alert severity="success">
                        <AlertTitle>✅ 파이프라인 성공</AlertTitle>
                        <Typography variant="body2">
                          모든 단계가 성공적으로 완료되었습니다!
                        </Typography>
                      </Alert>
                    )}
                    
                    {pipelineStatus === 'error' && (
                      <Alert severity="error">
                        <AlertTitle>❌ 파이프라인 실패</AlertTitle>
                        <Typography variant="body2">
                          일부 단계에서 오류가 발생했습니다. 로그를 확인하세요.
                        </Typography>
                      </Alert>
                    )}
                  </Box>
                </Paper>
                
                <Paper sx={{ p: 2, backgroundColor: 'info.50', mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom color="info.main">
                    📊 파이프라인 통계
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>성공률</strong>: 95%
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>평균 실행 시간</strong>: 8분
                  </Typography>
                  <Typography variant="body2">
                    <strong>마지막 실행</strong>: 2시간 전
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Collapse>
        </CardContent>
      </Card>

      {/* 설정 저장 */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
        <Button
          variant="contained"
          size="large"
          onClick={() => console.log('CI/CD 설정 저장:', config)}
          disabled={demoMode}
        >
          💾 설정 저장
        </Button>
        
        {demoMode && (
          <Alert severity="warning" sx={{ maxWidth: 400 }}>
            <AlertTitle>데모 모드</AlertTitle>
            <Typography variant="body2">
              데모 모드에서는 설정이 실제로 저장되지 않습니다. 
              실제 모드로 전환하여 설정을 저장하세요.
            </Typography>
          </Alert>
        )}
      </Box>
    </Box>
  );
};
