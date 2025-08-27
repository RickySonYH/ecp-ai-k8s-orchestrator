// [advice from AI] 설정 탭 메인 컴포넌트 - 초보자도 이해할 수 있는 설명과 예시 포함
/**
 * ECP-AI Kubernetes Orchestrator 설정 탭
 * - Git, CI/CD, Kubernetes, 모니터링, 보안 설정 관리
 * - 데모 모드와 실제 모드 전환
 * - 초보자를 위한 상세한 설명과 예시 제공
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
}

export interface MonitoringConfig {
  prometheusUrl: string;
  grafanaUrl: string;
  alertChannels: string[];
  metricsRetention: number;
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
    }
  });

  // [advice from AI] isDemoMode prop이 변경될 때마다 로컬 설정 동기화
  useEffect(() => {
    setSettings(prev => ({ ...prev, demoMode: isDemoMode }));
  }, [isDemoMode]);

  // [advice from AI] 데모 모드 변경 핸들러 - App.tsx의 상태와 동기화
  const handleDemoModeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newDemoMode = event.target.checked;
    
    // 로컬 설정 업데이트
    setSettings(prev => ({ ...prev, demoMode: newDemoMode }));
    
    // 부모 컴포넌트에 데모 모드 변경 알림
    if (onDemoModeChange) {
      onDemoModeChange(newDemoMode);
    }
  };

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
      {/* 헤더: 데모 모드 토글 및 설명 */}
      <Paper sx={{ p: 3, mb: 3, backgroundColor: 'primary.50' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h5" component="h2" color="primary">
            ⚙️ 시스템 설정
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={settings.demoMode}
                onChange={handleDemoModeChange}
                color="primary"
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip 
                  label={settings.demoMode ? "데모 모드" : "실제 모드"} 
                  color={settings.demoMode ? "secondary" : "primary"}
                  size="small"
                />
                <Typography variant="body2">
                  {settings.demoMode ? "데모 모드" : "실제 모드"}
                </Typography>
              </Box>
            }
          />
        </Box>
        
        <Alert severity="info" sx={{ mb: 2 }}>
          <AlertTitle>💡 설정 가이드</AlertTitle>
          <Typography variant="body2">
            <strong>데모 모드</strong>: 실제 서버 없이도 설정을 연습하고 테스트할 수 있습니다. 
            <strong>실제 모드</strong>: 실제 서버와 연결하여 설정을 적용할 수 있습니다.
          </Typography>
        </Alert>

        <Alert severity="warning" sx={{ mb: 2 }}>
          <AlertTitle>⚠️ 모드 전환 주의사항</AlertTitle>
          <Typography variant="body2">
            모드를 변경하면 페이지가 새로고침되어 모든 상태가 초기화됩니다. 
            데모 모드에서 생성한 테넌시와 매니페스트는 DB에 저장되므로 실사용 모드에서도 확인할 수 있습니다.
          </Typography>
        </Alert>

        {/* [advice from AI] 중복 제거: Chip 네비게이션을 제거하고 Tab만 사용 */}
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
                  <span>Git</span>
                </Box>
              } 
              {...a11yProps(0)} 
            />
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CICDIcon />
                  <span>CI/CD</span>
                </Box>
              } 
              {...a11yProps(1)} 
            />
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <K8sIcon />
                  <span>Kubernetes</span>
                </Box>
              } 
              {...a11yProps(2)} 
            />
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <MonitorIcon />
                  <span>모니터링</span>
                </Box>
              } 
              {...a11yProps(3)} 
            />
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SecurityIcon />
                  <span>보안</span>
                </Box>
              } 
              {...a11yProps(4)} 
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
        </Box>
      </Paper>
    </Box>
  );
};
