// [advice from AI] 설정 탭 메인 컴포넌트 - 초보자도 이해할 수 있는 설명과 예시 포함
/**
 * ECP-AI Kubernetes Orchestrator 설정 탭
 * - Git, CI/CD, Kubernetes, 모니터링, 보안 설정 관리
 * - 초보자를 위한 상세한 설명과 예시 제공
 * - 모드 전환은 헤더에서 관리됨
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Paper,
  Switch,
  FormControlLabel,
  Alert,
  AlertTitle,
  Chip
} from '@mui/material';
import {
  Code as GitIcon,
  Build as CICDIcon,
  Storage as K8sIcon,
  Monitor as MonitorIcon,
  Security as SecurityIcon,
  Info as InfoIcon
} from '@mui/icons-material';

// 설정 섹션별 컴포넌트 import
import { GitSettings } from './settings/GitSettings.tsx';
import { CICDSettings } from './settings/CICDSettings.tsx';
import { KubernetesSettings } from './settings/KubernetesSettings.tsx';
import { MonitoringSettings } from './settings/MonitoringSettings.tsx';
import { SecuritySettings } from './settings/SecuritySettings.tsx';

// 설정 타입 정의
export interface GlobalSettings {
  demoMode: boolean;
  git: GitConfig;
  cicd: CICDConfig;
  kubernetes: KubernetesConfig;
  monitoring: MonitoringConfig;
  security: SecurityConfig;
  simulator?: SimulatorConfig; // [advice from AI] 시뮬레이터 설정 (선택적)
}

interface SimulatorConfig {
  enabled: boolean;
  url: string;
  useForRealMode: boolean; // [advice from AI] 실사용 모드에서 시뮬레이터 사용 여부
  autoAdvancedMonitoring: boolean; // [advice from AI] 고급 모니터링 자동 연결
}

export interface GitConfig {
  provider: 'github' | 'gitlab' | 'bitbucket' | 'azure';
  repositoryUrl: string;
  defaultBranch: string;
  accessToken: string;
  webhookUrl: string;
}

export interface CICDConfig {
  buildServer: 'jenkins' | 'github-actions' | 'gitlab-ci' | 'azure-devops';
  dockerRegistry: string;
  deploymentStrategy: 'rolling' | 'blue-green' | 'canary';
  autoRollback: boolean;
}

export interface KubernetesConfig {
  clusterUrl: string;
  namespace: string;
  resourceQuota: {
    cpu: string;
    memory: string;
    storage: string;
  };
  // [advice from AI] 배포 방식 및 검증 설정 추가
  deploymentMethod: 'direct' | 'argocd' | 'helm' | 'webhook' | 'k8s-simulator';
  deploymentEndpoint: string;
  deploymentAuth: {
    type: 'bearer' | 'basic' | 'certificate';
    token?: string;
    username?: string;
    password?: string;
  };
  validationStrict: boolean;
  simulatorUrl?: string;
  useSimulatorForRealMode: boolean; // [advice from AI] 실사용 모드에서 시뮬레이터 사용 여부
}

export interface MonitoringConfig {
  prometheusUrl: string;
  grafanaUrl: string;
  alertChannels: string[];
  metricsRetention: number;
  // [advice from AI] 모니터링 시스템 표준 연동 설정
  monitoringStack: 'prometheus-grafana' | 'datadog' | 'newrelic' | 'custom';
  customApiEndpoint?: string;
  apiKey?: string;
  dataCollectionInterval: number;
  slaTarget: number; // 99.5% 등
  realTimeMonitoring: boolean;
}

export interface SecurityConfig {
  vulnerabilityScanner: 'trivy' | 'clair' | 'snyk';
  autoBlockVulnerabilities: boolean;
  auditLogRetention: number;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `settings-tab-${index}`,
    'aria-controls': `settings-tabpanel-${index}`,
  };
}

interface SettingsTabProps {
  isDemoMode: boolean;
  onDemoModeChange?: (demoMode: boolean) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ isDemoMode, onDemoModeChange }) => {
  const [currentTab, setCurrentTab] = useState(0);
  const [settings, setSettings] = useState<GlobalSettings>({
    demoMode: isDemoMode, // [advice from AI] props로 받은 isDemoMode 사용
    git: {
      provider: 'github',
      repositoryUrl: 'https://github.com/ecp-ai/k8s-orchestrator',
      defaultBranch: 'main',
      accessToken: '',
      webhookUrl: 'https://api.ecp-ai.com/webhooks/github'
    },
    cicd: {
      buildServer: 'github-actions',
      dockerRegistry: 'harbor.ecp-ai.com',
      deploymentStrategy: 'rolling',
      autoRollback: true
    },
    kubernetes: {
      clusterUrl: 'https://k8s-cluster.ecp-ai.com',
      namespace: 'ecp-ai',
      resourceQuota: {
        cpu: '1000m',
        memory: '8Gi',
        storage: '100Gi'
      }
    },
    monitoring: {
      prometheusUrl: 'https://prometheus.ecp-ai.com',
      grafanaUrl: 'https://grafana.ecp-ai.com',
      alertChannels: ['slack', 'email'],
      metricsRetention: 30
    },
    security: {
      vulnerabilityScanner: 'trivy',
      autoBlockVulnerabilities: true,
      auditLogRetention: 90
    },
    simulator: {
      enabled: true,
      url: 'http://localhost:6360',
      useForRealMode: true, // [advice from AI] 실사용 모드에서 시뮬레이터 사용
      autoAdvancedMonitoring: true // [advice from AI] 고급 모니터링 자동 연결
    }
  });

  // [advice from AI] isDemoMode prop이 변경될 때마다 로컬 설정 동기화
  useEffect(() => {
    setSettings(prev => ({ ...prev, demoMode: isDemoMode }));
  }, [isDemoMode]);

  // [advice from AI] 데모 모드는 이제 헤더에서 관리되므로 여기서는 제거됨

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  const handleSettingsChange = (section: keyof GlobalSettings, newSettings: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: { ...prev[section], ...newSettings }
    }));
  };

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더: 시스템 설정 */}
      <Paper sx={{ p: 3, mb: 3, backgroundColor: 'primary.50' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h5" component="h2" color="primary">
            ⚙️ 시스템 설정
          </Typography>
        </Box>
        
        <Alert severity="info" sx={{ mb: 2 }}>
          <AlertTitle>💡 설정 가이드</AlertTitle>
          <Typography variant="body2">
            ECP-AI Kubernetes Orchestrator의 다양한 설정을 관리할 수 있습니다.
            현재 사용 모드는 상단 헤더에서 확인하고 변경할 수 있습니다.
          </Typography>
        </Alert>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Chip 
            icon={<GitIcon />} 
            label="Git 설정" 
            color="primary" 
            variant="outlined"
          />
          <Chip 
            icon={<CICDIcon />} 
            label="CI/CD 설정" 
            color="primary" 
            variant="outlined"
          />
          <Chip 
            icon={<K8sIcon />} 
            label="Kubernetes 설정" 
            color="primary" 
            variant="outlined"
          />
          <Chip 
            icon={<MonitorIcon />} 
            label="모니터링 설정" 
            color="primary" 
            variant="outlined"
          />
          <Chip 
            icon={<SecurityIcon />} 
            label="보안 설정" 
            color="primary" 
            variant="outlined"
          />
        </Box>
      </Paper>

      {/* 설정 탭 네비게이션 */}
      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={currentTab} 
            onChange={handleTabChange} 
            aria-label="설정 탭"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <GitIcon />
                  <span>Git 설정</span>
                </Box>
              } 
              {...a11yProps(0)} 
            />
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CICDIcon />
                  <span>CI/CD 설정</span>
                </Box>
              } 
              {...a11yProps(1)} 
            />
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <K8sIcon />
                  <span>Kubernetes 설정</span>
                </Box>
              } 
              {...a11yProps(2)} 
            />
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <MonitorIcon />
                  <span>모니터링 설정</span>
                </Box>
              } 
              {...a11yProps(3)} 
            />
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SecurityIcon />
                  <span>보안 설정</span>
                </Box>
              } 
              {...a11yProps(4)} 
            />
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PlayArrow />
                  <span>시뮬레이터</span>
                </Box>
              } 
              {...a11yProps(5)} 
            />
          </Tabs>
        </Box>

        {/* 설정 탭 내용 */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <TabPanel value={currentTab} index={0}>
            <GitSettings 
              config={settings.git}
              demoMode={settings.demoMode}
              onChange={(config) => handleSettingsChange('git', config)}
            />
          </TabPanel>
          
          <TabPanel value={currentTab} index={1}>
            <CICDSettings 
              config={settings.cicd}
              demoMode={settings.demoMode}
              onChange={(config) => handleSettingsChange('cicd', config)}
            />
          </TabPanel>
          
          <TabPanel value={currentTab} index={2}>
            <KubernetesSettings 
              config={settings.kubernetes}
              demoMode={settings.demoMode}
              onChange={(config) => handleSettingsChange('kubernetes', config)}
            />
          </TabPanel>
          
          <TabPanel value={currentTab} index={3}>
            <MonitoringSettings 
              config={settings.monitoring}
              demoMode={settings.demoMode}
              onChange={(config) => handleSettingsChange('monitoring', config)}
            />
          </TabPanel>
          
          <TabPanel value={currentTab} index={4}>
            <SecuritySettings 
              config={settings.security}
              demoMode={settings.demoMode}
              onChange={(config) => handleSettingsChange('security', config)}
            />
          </TabPanel>

          <TabPanel value={currentTab} index={5}>
            {/* [advice from AI] 시뮬레이터 설정 패널 */}
            <SimulatorSettings 
              config={settings.simulator}
              demoMode={settings.demoMode}
              onChange={(config) => handleSettingsChange('simulator', config)}
            />
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  );
};

// [advice from AI] 시뮬레이터 설정 컴포넌트
const SimulatorSettings = ({ config, demoMode, onChange }) => {
  const [simulatorStatus, setSimulatorStatus] = useState(null);

  useEffect(() => {
    checkSimulatorHealth();
  }, []);

  const checkSimulatorHealth = async () => {
    try {
      const response = await fetch('/api/v1/simulator/health');
      const data = await response.json();
      setSimulatorStatus(data);
    } catch (error) {
      setSimulatorStatus({ status: 'error', message: '연결 실패' });
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        K8S Deployment Simulator 설정
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        실사용 모드에서 매니페스트 배포 시 K8S Simulator로 자동 연결되어 가상 배포 및 SLA 99.5% 모니터링을 수행합니다.
      </Alert>

      {/* 시뮬레이터 상태 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            시뮬레이터 연결 상태
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip 
              label={simulatorStatus?.status === 'healthy' ? '정상' : '오프라인'}
              color={simulatorStatus?.status === 'healthy' ? 'success' : 'error'}
              size="small"
            />
            <Typography variant="body2" color="text.secondary">
              {simulatorStatus?.message || '상태 확인 중...'}
            </Typography>
            <Button size="small" onClick={checkSimulatorHealth}>
              새로고침
            </Button>
          </Box>
          {simulatorStatus?.status === 'healthy' && (
            <Box sx={{ mt: 2 }}>
              <Button 
                variant="outlined" 
                size="small"
                onClick={() => window.open('http://localhost:6360/docs', '_blank')}
              >
                API 문서 보기
              </Button>
              <Button 
                variant="outlined" 
                size="small" 
                sx={{ ml: 1 }}
                onClick={() => window.open('http://localhost:6360', '_blank')}
              >
                시뮬레이터 대시보드
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* 기본 설정 */}
      <FormControlLabel
        control={
          <Switch
            checked={config?.enabled || false}
            onChange={(e) => onChange({ ...config, enabled: e.target.checked })}
          />
        }
        label="시뮬레이터 사용"
      />

      <FormControlLabel
        control={
          <Switch
            checked={config?.useForRealMode || false}
            onChange={(e) => onChange({ ...config, useForRealMode: e.target.checked })}
            disabled={demoMode} // 데모 모드에서는 비활성화
          />
        }
        label="실사용 모드에서 시뮬레이터 사용"
      />

      <FormControlLabel
        control={
          <Switch
            checked={config?.autoAdvancedMonitoring || false}
            onChange={(e) => onChange({ ...config, autoAdvancedMonitoring: e.target.checked })}
          />
        }
        label="고급 모니터링 자동 연결"
      />

      <TextField
        fullWidth
        label="시뮬레이터 URL"
        value={config?.url || ''}
        onChange={(e) => onChange({ ...config, url: e.target.value })}
        sx={{ mt: 2, mb: 2 }}
        helperText="K8S Deployment Simulator API 엔드포인트"
      />

      {demoMode && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          현재 데모 모드입니다. 시뮬레이터는 실사용 모드에서만 활성화됩니다.
        </Alert>
      )}

      {!demoMode && config?.useForRealMode && (
        <Alert severity="success" sx={{ mt: 2 }}>
          매니페스트 배포 시 자동으로 K8S Simulator로 연결되어 가상 배포 및 실시간 모니터링이 시작됩니다.
        </Alert>
      )}
    </Box>
  );
};
