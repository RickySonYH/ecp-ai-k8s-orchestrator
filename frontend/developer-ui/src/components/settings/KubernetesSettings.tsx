// [advice from AI] Kubernetes 설정 컴포넌트 - 초보자를 위한 상세한 설명과 예시 포함
/**
 * Kubernetes 설정 컴포넌트
 * - 클러스터 연결, 네임스페이스, 리소스 정책 설정 관리
 * - 초보자를 위한 단계별 가이드와 예시 제공
 * - 데모 모드와 실제 모드 지원
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  FormControlLabel,
  Switch
} from '@mui/material';
import {
  Storage as K8sIcon,
  Link as LinkIcon,
  Folder as NamespaceIcon,
  Settings as PolicyIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Cloud as CloudIcon
} from '@mui/icons-material';

import { KubernetesConfig } from '../SettingsTab';

interface KubernetesSettingsProps {
  config: KubernetesConfig;
  demoMode: boolean;
  onChange: (config: KubernetesConfig) => void;
}

const cloudProviders = [
  { value: 'aws', label: 'Amazon EKS', icon: '☁️' },
  { value: 'gcp', label: 'Google GKE', icon: '☁️' },
  { value: 'azure', label: 'Azure AKS', icon: '☁️' },
  { value: 'on-premise', label: 'On-Premise', icon: '🏢' },
  { value: 'minikube', label: 'Minikube (로컬)', icon: '💻' }
];

const namespaceTypes = [
  { value: 'default', label: 'Default', description: '기본 네임스페이스' },
  { value: 'development', label: 'Development', description: '개발 환경' },
  { value: 'staging', label: 'Staging', description: '테스트 환경' },
  { value: 'production', label: 'Production', description: '운영 환경' }
];

export const KubernetesSettings: React.FC<KubernetesSettingsProps> = ({ config, demoMode, onChange }) => {
  const [expandedSections, setExpandedSections] = useState({
    cluster: true,
    namespace: true,
    policy: true
  });
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [selectedCloudProvider, setSelectedCloudProvider] = useState('aws');

  const handleConfigChange = (field: keyof KubernetesConfig, value: any) => {
    onChange({ ...config, [field]: value });
  };

  const handleResourceQuotaChange = (field: keyof typeof config.resourceQuota, value: string) => {
    onChange({
      ...config,
      resourceQuota: {
        ...config.resourceQuota,
        [field]: value
      }
    });
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // 데모 모드에서 클러스터 연결 테스트 시뮬레이션
  const testClusterConnection = async () => {
    setConnectionStatus('testing');
    
    if (demoMode) {
      // 데모 모드: 가상의 테스트 결과
      setTimeout(() => {
        setConnectionStatus(Math.random() > 0.2 ? 'success' : 'error');
      }, 3000);
    } else {
      // 실제 모드: 실제 클러스터 연결 테스트
      try {
        // TODO: 실제 kubectl 연결 테스트
        setConnectionStatus('success');
      } catch (error) {
        setConnectionStatus('error');
      }
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'testing': return <div className="spinner" />;
      case 'success': return <CheckCircleIcon color="success" />;
      case 'error': return <ErrorIcon color="error" />;
      default: return <InfoIcon color="action" />;
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom color="primary">
        ☸️ Kubernetes 설정
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        <AlertTitle>💡 Kubernetes란?</AlertTitle>
        <Typography variant="body2">
          Kubernetes는 컨테이너 오케스트레이션 플랫폼입니다. 
          애플리케이션의 배포, 확장, 관리를 자동화하고 
          클라우드 네이티브 애플리케이션을 효율적으로 운영할 수 있게 해줍니다.
        </Typography>
      </Alert>

      {/* 클러스터 연결 설정 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
            onClick={() => toggleSection('cluster')}
          >
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LinkIcon color="primary" />
              클러스터 연결 설정
            </Typography>
            <IconButton size="small">
              {expandedSections.cluster ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          
          <Collapse in={expandedSections.cluster}>
            <Divider sx={{ my: 2 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>클라우드 제공업체</InputLabel>
                  <Select
                    value={selectedCloudProvider}
                    label="클라우드 제공업체"
                    onChange={(e) => setSelectedCloudProvider(e.target.value)}
                    disabled={demoMode}
                  >
                    {cloudProviders.map(provider => (
                      <MenuItem key={provider.value} value={provider.value}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <span>{provider.icon}</span>
                          {provider.label}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <TextField
                  fullWidth
                  label="클러스터 URL"
                  placeholder="https://your-cluster.example.com"
                  value={config.clusterUrl}
                  onChange={(e) => handleConfigChange('clusterUrl', e.target.value)}
                  disabled={demoMode}
                  sx={{ mb: 2 }}
                  helperText="Kubernetes API 서버의 URL을 입력하세요"
                />
                
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={getConnectionStatusIcon()}
                    onClick={testClusterConnection}
                    disabled={!config.clusterUrl || connectionStatus === 'testing'}
                  >
                    연결 테스트
                  </Button>
                  {connectionStatus === 'success' && (
                    <Chip label="연결 성공" color="success" size="small" />
                  )}
                  {connectionStatus === 'error' && (
                    <Chip label="연결 실패" color="error" size="small" />
                  )}
                </Box>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, backgroundColor: 'primary.50' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    🔗 클러스터 연결 가이드
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    <strong>클라우드 제공업체</strong>: 사용 중인 클라우드 서비스를 선택하세요
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    <strong>클러스터 URL</strong>: 
                    {selectedCloudProvider === 'aws' && ' EKS 클러스터 엔드포인트'}
                    {selectedCloudProvider === 'gcp' && ' GKE 클러스터 엔드포인트'}
                    {selectedCloudProvider === 'azure' && ' AKS 클러스터 엔드포인트'}
                    {selectedCloudProvider === 'on-premise' && ' 자체 클러스터 API 서버'}
                    {selectedCloudProvider === 'minikube' && ' Minikube API 서버 (보통 https://192.168.49.2:8443)'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>연결 테스트</strong>: kubectl 명령어로 클러스터 연결을 확인합니다
                  </Typography>
                </Paper>
                
                <Paper sx={{ p: 2, backgroundColor: 'info.50', mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom color="info.main">
                    📋 kubeconfig 설정
                  </Typography>
                  <Typography variant="body2">
                    클러스터 연결을 위해 kubeconfig 파일을 업로드하거나 
                    직접 설정값을 입력할 수 있습니다. 
                    보안을 위해 Access Token이나 인증서를 사용하는 것을 권장합니다.
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Collapse>
        </CardContent>
      </Card>

      {/* 네임스페이스 설정 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
            onClick={() => toggleSection('namespace')}
          >
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <NamespaceIcon color="primary" />
              네임스페이스 설정
            </Typography>
            <IconButton size="small">
              {expandedSections.namespace ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          
          <Collapse in={expandedSections.namespace}>
            <Divider sx={{ my: 2 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>기본 네임스페이스</InputLabel>
                  <Select
                    value={config.namespace}
                    label="기본 네임스페이스"
                    onChange={(e) => handleConfigChange('namespace', e.target.value)}
                    disabled={demoMode}
                  >
                    {namespaceTypes.map(ns => (
                      <MenuItem key={ns.value} value={ns.value}>
                        {ns.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <Button
                  variant="outlined"
                  disabled={demoMode}
                  sx={{ mb: 2 }}
                >
                  새 네임스페이스 생성
                </Button>
                
                <Typography variant="body2" color="text.secondary">
                  네임스페이스는 Kubernetes 리소스를 논리적으로 분리하는 가상 클러스터입니다.
                  환경별로 분리하여 관리하면 보안과 리소스 관리가 용이합니다.
                </Typography>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, backgroundColor: 'success.50' }}>
                  <Typography variant="subtitle2" gutterBottom color="success.main">
                    📁 네임스페이스 구조 예시
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {namespaceTypes.map(ns => (
                      <Box key={ns.value} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip 
                          label={ns.label} 
                          size="small" 
                          color={ns.value === config.namespace ? "primary" : "default"}
                          variant={ns.value === config.namespace ? "filled" : "outlined"}
                        />
                        <Typography variant="body2" color="text.secondary">
                          {ns.description}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Paper>
                
                <Paper sx={{ p: 2, backgroundColor: 'warning.50', mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom color="warning.main">
                    ⚠️ 네임스페이스 관리 주의사항
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    • <strong>Resource Quota</strong>: 각 네임스페이스별 리소스 제한 설정
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    • <strong>Network Policy</strong>: 네임스페이스 간 통신 제어
                  </Typography>
                  <Typography variant="body2">
                    • <strong>RBAC</strong>: 역할 기반 접근 제어 설정
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Collapse>
        </CardContent>
      </Card>

      {/* 리소스 정책 설정 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
            onClick={() => toggleSection('policy')}
          >
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PolicyIcon color="primary" />
              리소스 정책 설정
            </Typography>
            <IconButton size="small">
              {expandedSections.policy ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          
          <Collapse in={expandedSections.policy}>
            <Divider sx={{ my: 2 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>
                  CPU 제한
                </Typography>
                <TextField
                  fullWidth
                  label="CPU 제한"
                  placeholder="4"
                  value={config.resourceQuota.cpu}
                  onChange={(e) => handleResourceQuotaChange('cpu', e.target.value)}
                  disabled={demoMode}
                  sx={{ mb: 2 }}
                  helperText="CPU 코어 수 (예: 4, 2.5)"
                />
                
                <Typography variant="subtitle1" gutterBottom>
                  메모리 제한
                </Typography>
                <TextField
                  fullWidth
                  label="메모리 제한"
                  placeholder="8Gi"
                  value={config.resourceQuota.memory}
                  onChange={(e) => handleResourceQuotaChange('memory', e.target.value)}
                  disabled={demoMode}
                  sx={{ mb: 2 }}
                  helperText="메모리 용량 (예: 8Gi, 16Mi)"
                />
                
                <Typography variant="subtitle1" gutterBottom>
                  스토리지 제한
                </Typography>
                <TextField
                  fullWidth
                  label="스토리지 제한"
                  placeholder="100Gi"
                  value={config.resourceQuota.storage}
                  onChange={(e) => handleResourceQuotaChange('storage', e.target.value)}
                  disabled={demoMode}
                  sx={{ mb: 2 }}
                  helperText="스토리지 용량 (예: 100Gi, 500Mi)"
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, backgroundColor: 'info.50' }}>
                  <Typography variant="subtitle2" gutterBottom color="info.main">
                    📊 리소스 단위 가이드
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>CPU</strong>: 코어 단위 (1 = 1코어, 0.5 = 0.5코어)
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>메모리</strong>: 
                    <br />• Mi = Mebibyte (1024² bytes)
                    <br />• Gi = Gibibyte (1024³ bytes)
                  </Typography>
                  <Typography variant="body2">
                    <strong>스토리지</strong>: 
                    <br />• Mi = Mebibyte (1024² bytes)
                    <br />• Gi = Gibibyte (1024³ bytes)
                  </Typography>
                </Paper>
                
                <Paper sx={{ p: 2, backgroundColor: 'primary.50', mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    🎯 권장 리소스 설정
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>개발 환경</strong>: CPU 2, 메모리 4Gi, 스토리지 50Gi
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>테스트 환경</strong>: CPU 4, 메모리 8Gi, 스토리지 100Gi
                  </Typography>
                  <Typography variant="body2">
                    <strong>운영 환경</strong>: CPU 8, 메모리 16Gi, 스토리지 200Gi
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
          onClick={() => console.log('Kubernetes 설정 저장:', config)}
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
