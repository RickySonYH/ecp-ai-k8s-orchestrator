// [advice from AI] Git 설정 컴포넌트 - 초보자를 위한 상세한 설명과 예시 포함
/**
 * Git 설정 컴포넌트
 * - Repository 설정, Branch 전략, 인증 정보 관리
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
  Tooltip,
  IconButton,
  Collapse,
  FormControlLabel,
  Switch
} from '@mui/material';
import {
  GitHub as GitHubIcon,
  Code as GitLabIcon,
  Storage as BitbucketIcon,
  Cloud as AzureIcon,
  Link as LinkIcon,
  Key as KeyIcon,
  Webhook as WebhookIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';

import { GitConfig } from '../SettingsTab';

interface GitSettingsProps {
  config: GitConfig;
  demoMode: boolean;
  onChange: (config: GitConfig) => void;
}

const gitProviders = [
  { value: 'github', label: 'GitHub', icon: <GitHubIcon />, color: '#24292e' },
  { value: 'gitlab', label: 'GitLab', icon: <GitLabIcon />, color: '#fc6d26' },
  { value: 'bitbucket', label: 'Bitbucket', icon: <BitbucketIcon />, color: '#0052cc' },
  { value: 'azure', label: 'Azure DevOps', icon: <AzureIcon />, color: '#0078d4' }
];

const branchStrategies = [
  {
    name: 'GitFlow',
    description: 'Feature → Develop → Release → Main 구조',
    branches: ['main', 'develop', 'feature/*', 'release/*', 'hotfix/*']
  },
  {
    name: 'GitHub Flow',
    description: 'Feature → Main 간단한 구조',
    branches: ['main', 'feature/*']
  },
  {
    name: 'Trunk Based',
    description: 'Main 브랜치 중심 개발',
    branches: ['main', 'feature/*']
  }
];

export const GitSettings: React.FC<GitSettingsProps> = ({ config, demoMode, onChange }) => {
  const [expandedSections, setExpandedSections] = useState({
    repository: true,
    branch: true,
    auth: true
  });
  const [testResults, setTestResults] = useState<{
    connection: 'idle' | 'testing' | 'success' | 'error';
    webhook: 'idle' | 'testing' | 'success' | 'error';
  }>({
    connection: 'idle',
    webhook: 'idle'
  });

  const handleConfigChange = (field: keyof GitConfig, value: any) => {
    onChange({ ...config, [field]: value });
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // 데모 모드에서 연결 테스트 시뮬레이션
  const testConnection = async () => {
    setTestResults(prev => ({ ...prev, connection: 'testing' }));
    
    if (demoMode) {
      // 데모 모드: 가상의 테스트 결과
      setTimeout(() => {
        setTestResults(prev => ({ 
          ...prev, 
          connection: Math.random() > 0.3 ? 'success' : 'error' 
        }));
      }, 2000);
    } else {
      // 실제 모드: 실제 API 호출
      try {
        // TODO: 실제 Git API 연결 테스트
        setTestResults(prev => ({ ...prev, connection: 'success' }));
      } catch (error) {
        setTestResults(prev => ({ ...prev, connection: 'error' }));
      }
    }
  };

  const testWebhook = async () => {
    setTestResults(prev => ({ ...prev, webhook: 'testing' }));
    
    if (demoMode) {
      // 데모 모드: 가상의 테스트 결과
      setTimeout(() => {
        setTestResults(prev => ({ 
          ...prev, 
          webhook: Math.random() > 0.2 ? 'success' : 'error' 
        }));
      }, 1500);
    } else {
      // 실제 모드: 실제 Webhook 테스트
      try {
        // TODO: 실제 Webhook 테스트
        setTestResults(prev => ({ ...prev, webhook: 'success' }));
      } catch (error) {
        setTestResults(prev => ({ ...prev, webhook: 'error' }));
      }
    }
  };

  const getConnectionStatusIcon = () => {
    switch (testResults.connection) {
      case 'testing': return <div className="spinner" />;
      case 'success': return <CheckCircleIcon color="success" />;
      case 'error': return <ErrorIcon color="error" />;
      default: return <InfoIcon color="action" />;
    }
  };

  const getWebhookStatusIcon = () => {
    switch (testResults.webhook) {
      case 'testing': return <div className="spinner" />;
      case 'success': return <CheckCircleIcon color="success" />;
      case 'error': return <ErrorIcon color="error" />;
      default: return <InfoIcon color="action" />;
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom color="primary">
        📚 Git 설정
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        <AlertTitle>💡 Git 설정이란?</AlertTitle>
        <Typography variant="body2">
          Git은 소스 코드 버전 관리를 위한 도구입니다. 여기서는 코드 저장소와의 연결, 
          브랜치 관리 전략, 자동 배포를 위한 Webhook 설정을 관리합니다.
        </Typography>
      </Alert>

      {/* Repository 설정 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
            onClick={() => toggleSection('repository')}
          >
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LinkIcon color="primary" />
              Repository 설정
            </Typography>
            <IconButton size="small">
              {expandedSections.repository ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          
          <Collapse in={expandedSections.repository}>
            <Divider sx={{ my: 2 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Git Provider</InputLabel>
                  <Select
                    value={config.provider}
                    label="Git Provider"
                    onChange={(e) => handleConfigChange('provider', e.target.value)}
                    disabled={demoMode}
                  >
                    {gitProviders.map(provider => (
                      <MenuItem key={provider.value} value={provider.value}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ color: provider.color }}>{provider.icon}</Box>
                          {provider.label}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <TextField
                  fullWidth
                  label="Repository URL"
                  placeholder="https://github.com/username/repository.git"
                  value={config.repositoryUrl}
                  onChange={(e) => handleConfigChange('repositoryUrl', e.target.value)}
                  disabled={demoMode}
                  sx={{ mb: 2 }}
                  helperText="Git 저장소의 HTTPS 또는 SSH URL을 입력하세요"
                />
                
                <TextField
                  fullWidth
                  label="Default Branch"
                  placeholder="main"
                  value={config.defaultBranch}
                  onChange={(e) => handleConfigChange('defaultBranch', e.target.value)}
                  disabled={demoMode}
                  sx={{ mb: 2 }}
                  helperText="기본 브랜치 이름 (보통 main 또는 master)"
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    📖 Repository 설정 가이드
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    <strong>Git Provider</strong>: 사용하는 Git 서비스를 선택하세요
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    <strong>Repository URL</strong>: 
                    {config.provider === 'github' && ' https://github.com/username/repo.git'}
                    {config.provider === 'gitlab' && ' https://gitlab.com/username/repo.git'}
                    {config.provider === 'bitbucket' && ' https://bitbucket.org/username/repo.git'}
                    {config.provider === 'azure' && ' https://dev.azure.com/organization/project/_git/repo'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Default Branch</strong>: 최신 안정 코드가 있는 브랜치
                  </Typography>
                </Paper>
                
                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={getConnectionStatusIcon()}
                    onClick={testConnection}
                    disabled={!config.repositoryUrl || testResults.connection === 'testing'}
                  >
                    연결 테스트
                  </Button>
                  {testResults.connection === 'success' && (
                    <Chip label="연결 성공" color="success" size="small" />
                  )}
                  {testResults.connection === 'error' && (
                    <Chip label="연결 실패" color="error" size="small" />
                  )}
                </Box>
              </Grid>
            </Grid>
          </Collapse>
        </CardContent>
      </Card>

      {/* Branch 전략 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
            onClick={() => toggleSection('branch')}
          >
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <GitHubIcon color="primary" />
              Branch 전략
            </Typography>
            <IconButton size="small">
              {expandedSections.branch ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          
          <Collapse in={expandedSections.branch}>
            <Divider sx={{ my: 2 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  브랜치 전략은 팀의 개발 워크플로우를 정의합니다. 프로젝트 규모와 팀 문화에 맞는 전략을 선택하세요.
                </Typography>
                
                {branchStrategies.map((strategy, index) => (
                  <Paper key={index} sx={{ p: 2, mb: 2, backgroundColor: 'primary.50' }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      {strategy.name}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {strategy.description}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {strategy.branches.map((branch, branchIndex) => (
                        <Chip 
                          key={branchIndex} 
                          label={branch} 
                          size="small" 
                          variant="outlined"
                          color="primary"
                        />
                      ))}
                    </Box>
                  </Paper>
                ))}
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2, backgroundColor: 'warning.50' }}>
                  <Typography variant="subtitle2" gutterBottom color="warning.main">
                    ⚠️ 브랜치 전략 선택 시 고려사항
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    • <strong>GitFlow</strong>: 대규모 팀, 릴리스 중심
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    • <strong>GitHub Flow</strong>: 소규모 팀, 빠른 배포
                  </Typography>
                  <Typography variant="body2">
                    • <strong>Trunk Based</strong>: CI/CD 중심, 자동화
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Collapse>
        </CardContent>
      </Card>

      {/* 인증 정보 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
            onClick={() => toggleSection('auth')}
          >
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <KeyIcon color="primary" />
              인증 정보
            </Typography>
            <IconButton size="small">
              {expandedSections.auth ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          
          <Collapse in={expandedSections.auth}>
            <Divider sx={{ my: 2 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Access Token"
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  value={config.accessToken}
                  onChange={(e) => handleConfigChange('accessToken', e.target.value)}
                  disabled={demoMode}
                  sx={{ mb: 2 }}
                  helperText="Git 서비스에서 발급받은 Personal Access Token"
                />
                
                <TextField
                  fullWidth
                  label="Webhook URL"
                  placeholder="https://your-domain.com/webhook/git"
                  value={config.webhookUrl}
                  onChange={(e) => handleConfigChange('webhookUrl', e.target.value)}
                  disabled={demoMode}
                  sx={{ mb: 2 }}
                  helperText="자동 배포를 위한 Webhook URL (선택사항)"
                />
                
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={getWebhookStatusIcon()}
                    onClick={testWebhook}
                    disabled={!config.webhookUrl || testResults.webhook === 'testing'}
                  >
                    Webhook 테스트
                  </Button>
                  {testResults.webhook === 'success' && (
                    <Chip label="Webhook 성공" color="success" size="small" />
                  )}
                  {testResults.webhook === 'error' && (
                    <Chip label="Webhook 실패" color="error" size="small" />
                  )}
                </Box>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, backgroundColor: 'info.50' }}>
                  <Typography variant="subtitle2" gutterBottom color="info.main">
                    🔑 Access Token 생성 방법
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>GitHub</strong>: Settings → Developer settings → Personal access tokens
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>GitLab</strong>: User Settings → Access Tokens
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Bitbucket</strong>: Personal settings → App passwords
                  </Typography>
                  <Typography variant="body2">
                    <strong>Azure DevOps</strong>: Personal access tokens
                  </Typography>
                </Paper>
                
                <Paper sx={{ p: 2, backgroundColor: 'success.50', mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom color="success.main">
                    🌐 Webhook 설정
                  </Typography>
                  <Typography variant="body2">
                    Webhook을 설정하면 코드 변경 시 자동으로 배포 파이프라인이 실행됩니다.
                    보안을 위해 Webhook URL은 HTTPS를 사용하고 적절한 인증을 설정하세요.
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
          onClick={() => console.log('Git 설정 저장:', config)}
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
