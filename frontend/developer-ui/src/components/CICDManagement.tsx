// [advice from AI] CI/CD 이미지 라이프사이클 관리 컴포넌트 - 배포 관리 제거
/**
 * CI/CD Image Lifecycle Management Component
 * 순수 이미지 관리 중심 구조:
 * 1. 📦 이미지 라이프사이클: 기본 이미지 관리 + 빌드 + 보안 스캔
 * 2. 🔗 소스 연동 & 자동화: GitHub 연동 + 빌드 트리거 + 파이프라인 템플릿
 * 3. ⚙️ 레지스트리 & 정책: 레지스트리 설정 + 보안 정책 + 감사 로그
 * 
 * 배포 관리는 테넌트 생성 워크플로우에서 처리됨
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Tabs,
  Tab,
  Alert,
  Chip,
  LinearProgress,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Snackbar,
  CircularProgress,
  useTheme,
  alpha
} from '@mui/material';
import {
  Inventory as DockerIcon,
  GitHub as GitHubIcon,
  Build as BuildIcon,
  Settings as SettingsIcon,
  Security as SecurityIcon,
  PlayArrow as PlayArrowIcon,
  Storage as StorageIcon,
  Info as InfoIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  MonitorHeart as MonitorIcon,
  IntegrationInstructions as IntegrationIcon
} from '@mui/icons-material';

// 컴포넌트 임포트
import ImageRegistration from './cicd/ImageRegistration';
import GitHubIntegration from './cicd/GitHubIntegration';
// CICD 설정 서비스 임포트
import cicdSettingsService, { 
  CICDGlobalSetting, 
  RegistryConfig, 
  SecurityPolicyConfig, 
  MonitoringConfig, 
  DevToolsConfig 
} from '../services/CICDSettingsService';

// [advice from AI] 타입 정의는 서비스에서 가져왔으므로 여기서는 제거

// TabPanel 컴포넌트
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
      id={`cicd-tabpanel-${index}`}
      aria-labelledby={`cicd-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

// 메인 컴포넌트
const CICDManagementNew: React.FC<{ isDemoMode?: boolean }> = ({ isDemoMode = false }) => {
  const theme = useTheme();
  const [currentTab, setCurrentTab] = useState(0);
  const [loading, setLoading] = useState(false);

  // [advice from AI] 실제 운영 환경을 위한 상태 관리
  const [globalSettings, setGlobalSettings] = useState<CICDGlobalSetting[]>([]);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  
  // 각 설정별 상태
  const [registryConfig, setRegistryConfig] = useState<RegistryConfig>({
    url: '',
    username: '',
    password: '',
    is_default: true,
    ssl_verify: true,
    registry_type: 'harbor',
    connection_status: 'disconnected'
  });
  
  const [securityConfig, setSecurityConfig] = useState<SecurityPolicyConfig>({
    enabled: true,
    cve_threshold: 7.0,
    scan_on_build: true,
    block_on_high_cve: true,
    malware_scan_enabled: true,
    license_check_enabled: true,
    image_signing_enabled: false,
    cosign_enabled: false,
    registry_whitelist_enabled: true,
    approved_registries: []
  });
  
  const [monitoringConfig, setMonitoringConfig] = useState<MonitoringConfig>({
    log_collection_enabled: true,
    retention_days: 30,
    log_level: 'INFO',
    slack_notifications: {
      enabled: false,
      webhook_url: '',
      channels: []
    },
    email_notifications: {
      enabled: false,
      smtp_server: '',
      recipients: []
    },
    metrics_collection: {
      enabled: true,
      prometheus_endpoint: '',
      grafana_dashboard: ''
    }
  });
  
  const [devToolsConfig, setDevToolsConfig] = useState<DevToolsConfig>({
    sonarqube: {
      enabled: false,
      server_url: '',
      quality_gate_required: true,
      coverage_threshold: 80
    },
    automated_testing: {
      unit_tests_required: true,
      integration_tests_required: true,
      e2e_tests_required: false,
      coverage_threshold: 70
    },
    code_analysis: {
      eslint_enabled: true,
      prettier_enabled: true,
      security_scan_enabled: true
    }
  });

  // [advice from AI] 컴포넌트 마운트 시 초기 데이터 로드
  useEffect(() => {
    if (!isDemoMode) {
      loadInitialData();
    }
  }, [isDemoMode]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // 기존 설정 로드
      const settings = await cicdSettingsService.getGlobalSettings();
      setGlobalSettings(settings);
      
      // 설정이 없으면 기본 설정 초기화
      if (settings.length === 0) {
        await cicdSettingsService.initializeDefaultSettings();
        const newSettings = await cicdSettingsService.getGlobalSettings();
        setGlobalSettings(newSettings);
      }
      
      // 시스템 상태 로드
      const status = await cicdSettingsService.getSystemStatus();
      setSystemStatus(status);
      
      // 각 카테고리별 설정 로드
      await loadCategorySettings(settings);
      
      showSnackbar('설정을 성공적으로 로드했습니다', 'success');
    } catch (error) {
      console.error('Error loading initial data:', error);
      showSnackbar('설정 로드 중 오류가 발생했습니다', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadCategorySettings = async (settings: CICDGlobalSetting[]) => {
    try {
      // 레지스트리 설정 로드
      const registrySettings = settings.filter(s => s.setting_category === 'registry');
      if (registrySettings.length > 0) {
        const mainRegistry = registrySettings.find(s => s.setting_key === 'main_registry');
        if (mainRegistry) {
          setRegistryConfig(mainRegistry.setting_value as RegistryConfig);
        }
      }
      
      // 보안정책 설정 로드
      const securitySettings = settings.filter(s => s.setting_category === 'security');
      if (securitySettings.length > 0) {
        const securityPolicy = securitySettings.find(s => s.setting_key === 'security_policy');
        if (securityPolicy) {
          setSecurityConfig(securityPolicy.setting_value as SecurityPolicyConfig);
        }
      }
      
      // 모니터링 설정 로드
      const monitoringSettings = settings.filter(s => s.setting_category === 'monitoring');
      if (monitoringSettings.length > 0) {
        const monitoring = monitoringSettings.find(s => s.setting_key === 'monitoring_config');
        if (monitoring) {
          setMonitoringConfig(monitoring.setting_value as MonitoringConfig);
        }
      }
      
      // 개발도구 설정 로드
      const devToolsSettings = settings.filter(s => s.setting_category === 'devtools');
      if (devToolsSettings.length > 0) {
        const devTools = devToolsSettings.find(s => s.setting_key === 'devtools_config');
        if (devTools) {
          setDevToolsConfig(devTools.setting_value as DevToolsConfig);
        }
      }
    } catch (error) {
      console.error('Error loading category settings:', error);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'warning' | 'info') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  // [advice from AI] 설정 저장 함수들
  const saveRegistryConfig = async () => {
    try {
      setLoading(true);
      await cicdSettingsService.updateGlobalSetting(
        'main_registry',
        registryConfig,
        '메인 컨테이너 레지스트리 설정'
      );
      showSnackbar('레지스트리 설정이 저장되었습니다', 'success');
    } catch (error) {
      console.error('Error saving registry config:', error);
      showSnackbar('레지스트리 설정 저장 중 오류가 발생했습니다', 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveSecurityConfig = async () => {
    try {
      setLoading(true);
      await cicdSettingsService.updateGlobalSetting(
        'security_policy',
        securityConfig,
        '보안 정책 설정'
      );
      showSnackbar('보안 정책이 저장되었습니다', 'success');
    } catch (error) {
      console.error('Error saving security config:', error);
      showSnackbar('보안 정책 저장 중 오류가 발생했습니다', 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveMonitoringConfig = async () => {
    try {
      setLoading(true);
      
      // 설정 검증
      const validation = await cicdSettingsService.validateMonitoringConfig(monitoringConfig);
      if (!validation.valid) {
        showSnackbar(`설정 오류: ${validation.issues.join(', ')}`, 'error');
        return;
      }
      
      await cicdSettingsService.updateGlobalSetting(
        'monitoring_config',
        monitoringConfig,
        '모니터링 설정'
      );
      showSnackbar('모니터링 설정이 저장되었습니다', 'success');
    } catch (error) {
      console.error('Error saving monitoring config:', error);
      showSnackbar('모니터링 설정 저장 중 오류가 발생했습니다', 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveDevToolsConfig = async () => {
    try {
      setLoading(true);
      
      // 설정 검증
      const validation = await cicdSettingsService.validateDevToolsConfig(devToolsConfig);
      if (!validation.valid) {
        showSnackbar(`설정 오류: ${validation.issues.join(', ')}`, 'error');
        return;
      }
      
      await cicdSettingsService.updateGlobalSetting(
        'devtools_config',
        devToolsConfig,
        '개발도구 통합 설정'
      );
      showSnackbar('개발도구 설정이 저장되었습니다', 'success');
    } catch (error) {
      console.error('Error saving devtools config:', error);
      showSnackbar('개발도구 설정 저장 중 오류가 발생했습니다', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 연결 테스트 함수
  const testRegistryConnection = async () => {
    try {
      setLoading(true);
      const result = await cicdSettingsService.testRegistryConnection(registryConfig);
      if (result.success) {
        setRegistryConfig((prev: RegistryConfig) => ({ ...prev, connection_status: 'connected' }));
        showSnackbar('레지스트리 연결 성공', 'success');
      } else {
        setRegistryConfig((prev: RegistryConfig) => ({ ...prev, connection_status: 'error' }));
        showSnackbar(`연결 실패: ${result.message}`, 'error');
      }
    } catch (error) {
      setRegistryConfig((prev: RegistryConfig) => ({ ...prev, connection_status: 'error' }));
      showSnackbar('연결 테스트 중 오류가 발생했습니다', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  // 탭별 설명
  const getTabDescription = (tabIndex: number) => {
    switch (tabIndex) {
      case 0:
        return "20개 기본 서비스 이미지의 전체 생명주기를 관리합니다. 빌드, 보안 스캔, 버전 관리가 통합되어 있습니다.";
      case 1:
        return "GitHub 저장소 연동, 자동 빌드 트리거 설정, CI/CD 파이프라인 템플릿을 관리합니다.";
      case 2:
        return "시스템 전체 레지스트리, 보안정책, 모니터링, 개발도구 설정을 관리합니다.";
      default:
        return "";
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 1400, mx: 'auto', p: 3 }}>
      {/* 헤더 */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          🔧 CI/CD 관리 센터
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          컨테이너 이미지의 전체 생명주기를 관리합니다. 배포는 테넌트 생성 과정에서 처리됩니다.
        </Typography>
        
        {/* 현재 탭 설명 */}
        <Alert 
          severity="info" 
          icon={<InfoIcon />}
          sx={{ 
            backgroundColor: alpha(theme.palette.primary.main, 0.1),
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
          }}
        >
          <Typography variant="body2">
            {getTabDescription(currentTab)}
          </Typography>
        </Alert>
      </Box>

      {/* 탭 네비게이션 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs 
          value={currentTab} 
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ 
            '& .MuiTab-root': {
              minHeight: 72,
              textTransform: 'none',
              fontSize: '1rem',
              fontWeight: 500
            }
          }}
        >
          <Tab 
            label="📦 이미지 라이프사이클" 
            icon={<DockerIcon />} 
            iconPosition="start"
            sx={{ gap: 1 }}
          />
          <Tab 
            label="🔗 소스 연동 & 자동화" 
            icon={<GitHubIcon />} 
            iconPosition="start"
            sx={{ gap: 1 }}
          />
          <Tab 
            label="⚙️ 레지스트리 & 보안정책" 
            icon={<SettingsIcon />} 
            iconPosition="start"
            sx={{ gap: 1 }}
          />
        </Tabs>
      </Box>

      {/* 탭 콘텐츠 */}
      
      {/* 📦 이미지 라이프사이클 관리 */}
      <TabPanel value={currentTab} index={0}>
        <Box>
          <Typography variant="h5" gutterBottom>
            📦 이미지 라이프사이클 관리
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            20개 기본 서비스 이미지의 빌드, 스캔, 버전 관리를 통합적으로 처리합니다.
          </Typography>
          
          <ImageRegistration />
        </Box>
      </TabPanel>

      {/* 🔗 소스 연동 & 자동화 */}
      <TabPanel value={currentTab} index={1}>
        <Box>
          <Typography variant="h5" gutterBottom>
            🔗 소스 연동 & 자동화
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            GitHub 저장소 연동 및 자동 빌드 파이프라인을 설정합니다.
          </Typography>
          
          <GitHubIntegration />
        </Box>
      </TabPanel>

      {/* ⚙️ 레지스트리 & 보안정책 */}
      <TabPanel value={currentTab} index={2}>
        <Box>
          <Typography variant="h5" gutterBottom>
            ⚙️ 레지스트리 & 보안정책 관리
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            시스템 전체에 적용되는 글로벌 CICD 설정을 관리합니다.
          </Typography>
          
          {/* 글로벌 CICD 설정 - 2x2 그리드 */}
          <Grid container spacing={3}>
            {/* 첫 번째 행 */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">
                      🏗️ 레지스트리 관리
                    </Typography>
                    <Chip 
                      label={registryConfig.connection_status === 'connected' ? '연결됨' : 
                             registryConfig.connection_status === 'error' ? '연결 오류' : '연결 안됨'}
                      color={registryConfig.connection_status === 'connected' ? 'success' : 
                             registryConfig.connection_status === 'error' ? 'error' : 'default'}
                      size="small"
                      icon={registryConfig.connection_status === 'connected' ? <CheckIcon /> : 
                            registryConfig.connection_status === 'error' ? <ErrorIcon /> : <WarningIcon />}
                    />
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Docker 이미지 저장소 연결 및 관리
                  </Typography>
                  
                  {!isDemoMode && (
                    <Box sx={{ mb: 2 }}>
                      <TextField
                        fullWidth
                        label="레지스트리 URL"
                        value={registryConfig.url}
                        onChange={(e) => setRegistryConfig((prev: RegistryConfig) => ({ ...prev, url: e.target.value }))}
                        size="small"
                        sx={{ mb: 1 }}
                      />
                      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                        <TextField
                          label="사용자명"
                          value={registryConfig.username}
                          onChange={(e) => setRegistryConfig((prev: RegistryConfig) => ({ ...prev, username: e.target.value }))}
                          size="small"
                          sx={{ flex: 1 }}
                        />
                        <TextField
                          label="비밀번호"
                          type="password"
                          value={registryConfig.password}
                          onChange={(e) => setRegistryConfig((prev: RegistryConfig) => ({ ...prev, password: e.target.value }))}
                          size="small"
                          sx={{ flex: 1 }}
                        />
                      </Box>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={registryConfig.ssl_verify}
                                                         onChange={(e) => setRegistryConfig((prev: RegistryConfig) => ({ ...prev, ssl_verify: e.target.checked }))}
                          />
                        }
                        label="SSL 인증서 검증"
                        sx={{ mb: 1 }}
                      />
                    </Box>
                  )}
                  
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <Chip 
                      label={`${registryConfig.registry_type.toUpperCase()}${registryConfig.is_default ? ' (기본)' : ''}`}
                      color={registryConfig.is_default ? "primary" : "default"}
                      size="small"
                      icon={<StorageIcon />}
                    />
                  </Box>
                  
                  <Box sx={{ 
                    display: 'flex', 
                    gap: 2, 
                    mt: 2, 
                    pt: 2, 
                    borderTop: `1px solid ${theme.palette.divider}` 
                  }}>
                    {!isDemoMode && (
                      <>
                        <Button 
                          variant="outlined" 
                          size="medium"
                          onClick={testRegistryConnection}
                          disabled={loading || !registryConfig.url}
                          sx={{ 
                            minWidth: 120,
                            fontWeight: 600,
                            textTransform: 'none'
                          }}
                          startIcon={<RefreshIcon />}
                        >
                          연결 테스트
                        </Button>
                        <Button 
                          variant="contained" 
                          size="medium"
                          onClick={saveRegistryConfig}
                          disabled={loading}
                          sx={{ 
                            minWidth: 100,
                            fontWeight: 600,
                            textTransform: 'none'
                          }}
                          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                        >
                          저장하기
                        </Button>
                      </>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">
                      🔐 글로벌 보안정책
                    </Typography>
                    <Chip 
                      label={securityConfig.enabled ? '활성화됨' : '비활성화됨'}
                      color={securityConfig.enabled ? 'success' : 'default'}
                      size="small"
                      icon={securityConfig.enabled ? <CheckIcon /> : <WarningIcon />}
                    />
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    시스템 전체 보안 정책 및 스캔 설정
                  </Typography>
                  
                  {!isDemoMode && (
                    <Box sx={{ mb: 2 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={securityConfig.enabled}
                                                         onChange={(e) => setSecurityConfig((prev: SecurityPolicyConfig) => ({ ...prev, enabled: e.target.checked }))}
                          />
                        }
                        label="보안 정책 활성화"
                        sx={{ mb: 1 }}
                      />
                      
                      <TextField
                        fullWidth
                        label="CVE 임계값"
                        type="number"
                        value={securityConfig.cve_threshold}
                                                 onChange={(e) => setSecurityConfig((prev: SecurityPolicyConfig) => ({ ...prev, cve_threshold: parseFloat(e.target.value) }))}
                        size="small"
                        sx={{ mb: 1 }}
                        inputProps={{ min: 0, max: 10, step: 0.1 }}
                      />
                      
                      <FormControlLabel
                        control={
                          <Switch
                            checked={securityConfig.scan_on_build}
                                                         onChange={(e) => setSecurityConfig((prev: SecurityPolicyConfig) => ({ ...prev, scan_on_build: e.target.checked }))}
                          />
                        }
                        label="빌드 시 자동 스캔"
                        sx={{ mb: 1 }}
                      />
                      
                      <FormControlLabel
                        control={
                          <Switch
                            checked={securityConfig.block_on_high_cve}
                                                         onChange={(e) => setSecurityConfig((prev: SecurityPolicyConfig) => ({ ...prev, block_on_high_cve: e.target.checked }))}
                          />
                        }
                        label="고위험 CVE 시 배포 차단"
                        sx={{ mb: 1 }}
                      />
                      
                      <FormControlLabel
                        control={
                          <Switch
                            checked={securityConfig.image_signing_enabled}
                                                         onChange={(e) => setSecurityConfig((prev: SecurityPolicyConfig) => ({ ...prev, image_signing_enabled: e.target.checked }))}
                          />
                        }
                        label="이미지 서명 검증"
                      />
                    </Box>
                  )}
                  
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <Chip 
                      label={`CVE ${securityConfig.cve_threshold}+ 차단`}
                      color={securityConfig.block_on_high_cve ? "error" : "default"}
                      size="small"
                      icon={<SecurityIcon />}
                    />
                    <Chip 
                      label={securityConfig.scan_on_build ? "자동 스캔" : "수동 스캔"}
                      color={securityConfig.scan_on_build ? "success" : "default"}
                      size="small"
                    />
                  </Box>
                  
                  <Box sx={{ 
                    display: 'flex', 
                    gap: 2, 
                    mt: 2, 
                    pt: 2, 
                    borderTop: `1px solid ${theme.palette.divider}` 
                  }}>
                    {!isDemoMode && (
                      <Button 
                        variant="contained" 
                        size="medium"
                        onClick={saveSecurityConfig}
                        disabled={loading}
                        sx={{ 
                          minWidth: 100,
                          fontWeight: 600,
                          textTransform: 'none'
                        }}
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                      >
                        저장하기
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* 두 번째 행 */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">
                      📊 시스템 모니터링
                    </Typography>
                    <Chip 
                      label={monitoringConfig.log_collection_enabled ? '수집 중' : '중지됨'}
                      color={monitoringConfig.log_collection_enabled ? 'success' : 'default'}
                      size="small"
                      icon={<MonitorIcon />}
                    />
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    중앙 집중식 로그 수집 및 알림 설정
                  </Typography>
                  
                  {!isDemoMode && (
                    <Box sx={{ mb: 2 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={monitoringConfig.log_collection_enabled}
                                                         onChange={(e) => setMonitoringConfig((prev: MonitoringConfig) => ({ 
                               ...prev, 
                               log_collection_enabled: e.target.checked 
                             }))}
                          />
                        }
                        label="로그 수집 활성화"
                        sx={{ mb: 1 }}
                      />
                      
                      <TextField
                        fullWidth
                        label="로그 보관 기간 (일)"
                        type="number"
                        value={monitoringConfig.retention_days}
                                                 onChange={(e) => setMonitoringConfig((prev: MonitoringConfig) => ({ 
                           ...prev, 
                           retention_days: parseInt(e.target.value) 
                         }))}
                        size="small"
                        sx={{ mb: 1 }}
                        inputProps={{ min: 1, max: 365 }}
                      />
                      
                      <TextField
                        fullWidth
                        label="Slack 웹훅 URL"
                        value={monitoringConfig.slack_notifications.webhook_url}
                                                 onChange={(e) => setMonitoringConfig((prev: MonitoringConfig) => ({ 
                           ...prev, 
                           slack_notifications: { 
                             ...prev.slack_notifications, 
                             webhook_url: e.target.value 
                           } 
                         }))}
                        size="small"
                        sx={{ mb: 1 }}
                      />
                      
                      <FormControlLabel
                        control={
                          <Switch
                            checked={monitoringConfig.slack_notifications.enabled}
                                                         onChange={(e) => setMonitoringConfig((prev: MonitoringConfig) => ({ 
                               ...prev, 
                               slack_notifications: { 
                                 ...prev.slack_notifications, 
                                 enabled: e.target.checked 
                               } 
                             }))}
                          />
                        }
                        label="Slack 알림 활성화"
                      />
                    </Box>
                  )}
                  
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <Chip 
                      label={`${monitoringConfig.retention_days}일 보관`}
                      color="info" 
                      size="small"
                    />
                    <Chip 
                      label="Slack 알림" 
                      color={monitoringConfig.slack_notifications.enabled ? "success" : "default"}
                      size="small"
                    />
                    <Chip 
                      label="Email 알림" 
                      color={monitoringConfig.email_notifications.enabled ? "success" : "default"}
                      size="small"
                    />
                  </Box>
                  
                  <Box sx={{ 
                    display: 'flex', 
                    gap: 2, 
                    mt: 2, 
                    pt: 2, 
                    borderTop: `1px solid ${theme.palette.divider}` 
                  }}>
                    {!isDemoMode && (
                      <Button 
                        variant="contained" 
                        size="medium"
                        onClick={saveMonitoringConfig}
                        disabled={loading}
                        sx={{ 
                          minWidth: 100,
                          fontWeight: 600,
                          textTransform: 'none'
                        }}
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                      >
                        저장하기
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">
                      🛠️ 개발도구 통합
                    </Typography>
                    <Chip 
                      label={devToolsConfig.sonarqube.enabled ? 'SonarQube 연결됨' : '설정 필요'}
                      color={devToolsConfig.sonarqube.enabled ? 'success' : 'default'}
                      size="small"
                      icon={<IntegrationIcon />}
                    />
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    코드 품질 검사 및 테스트 자동화 설정
                  </Typography>
                  
                  {!isDemoMode && (
                    <Box sx={{ mb: 2 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={devToolsConfig.sonarqube.enabled}
                                                         onChange={(e) => setDevToolsConfig((prev: DevToolsConfig) => ({ 
                               ...prev, 
                               sonarqube: { 
                                 ...prev.sonarqube, 
                                 enabled: e.target.checked 
                               } 
                             }))}
                          />
                        }
                        label="SonarQube 연동"
                        sx={{ mb: 1 }}
                      />
                      
                      {devToolsConfig.sonarqube.enabled && (
                        <TextField
                          fullWidth
                          label="SonarQube 서버 URL"
                          value={devToolsConfig.sonarqube.server_url}
                                                     onChange={(e) => setDevToolsConfig((prev: DevToolsConfig) => ({ 
                             ...prev, 
                             sonarqube: { 
                               ...prev.sonarqube, 
                               server_url: e.target.value 
                             } 
                           }))}
                          size="small"
                          sx={{ mb: 1 }}
                        />
                      )}
                      
                      <TextField
                        fullWidth
                        label="코드 커버리지 임계값 (%)"
                        type="number"
                        value={devToolsConfig.sonarqube.coverage_threshold}
                                                 onChange={(e) => setDevToolsConfig((prev: DevToolsConfig) => ({ 
                           ...prev, 
                           sonarqube: { 
                             ...prev.sonarqube, 
                             coverage_threshold: parseInt(e.target.value) 
                           } 
                         }))}
                        size="small"
                        sx={{ mb: 1 }}
                        inputProps={{ min: 0, max: 100 }}
                      />
                      
                      <FormControlLabel
                        control={
                          <Switch
                            checked={devToolsConfig.automated_testing.unit_tests_required}
                                                         onChange={(e) => setDevToolsConfig((prev: DevToolsConfig) => ({ 
                               ...prev, 
                               automated_testing: { 
                                 ...prev.automated_testing, 
                                 unit_tests_required: e.target.checked 
                               } 
                             }))}
                          />
                        }
                        label="단위 테스트 필수"
                        sx={{ mb: 1 }}
                      />
                      
                      <FormControlLabel
                        control={
                          <Switch
                            checked={devToolsConfig.code_analysis.eslint_enabled}
                                                         onChange={(e) => setDevToolsConfig((prev: DevToolsConfig) => ({ 
                               ...prev, 
                               code_analysis: { 
                                 ...prev.code_analysis, 
                                 eslint_enabled: e.target.checked 
                               } 
                             }))}
                          />
                        }
                        label="ESLint 검사"
                      />
                    </Box>
                  )}
                  
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <Chip 
                      label="SonarQube" 
                      color={devToolsConfig.sonarqube.enabled ? "secondary" : "default"}
                      size="small"
                    />
                    <Chip 
                      label="ESLint" 
                      color={devToolsConfig.code_analysis.eslint_enabled ? "success" : "default"}
                      size="small"
                    />
                    <Chip 
                      label="자동 테스트" 
                      color={devToolsConfig.automated_testing.unit_tests_required ? "success" : "default"}
                      size="small"
                    />
                  </Box>
                  
                  <Box sx={{ 
                    display: 'flex', 
                    gap: 2, 
                    mt: 2, 
                    pt: 2, 
                    borderTop: `1px solid ${theme.palette.divider}` 
                  }}>
                    {!isDemoMode && (
                      <Button 
                        variant="contained" 
                        size="medium"
                        onClick={saveDevToolsConfig}
                        disabled={loading}
                        sx={{ 
                          minWidth: 100,
                          fontWeight: 600,
                          textTransform: 'none'
                        }}
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                      >
                        저장하기
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>


          </Grid>
        </Box>
      </TabPanel>

      {loading && (
        <Box sx={{ width: '100%', mt: 2 }}>
          <LinearProgress />
        </Box>
      )}

      {/* [advice from AI] 알림 스낵바 */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbarSeverity} 
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CICDManagementNew;
