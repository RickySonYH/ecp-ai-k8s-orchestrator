// [advice from AI] 보안 설정 컴포넌트 - 초보자를 위한 상세한 설명과 예시 포함
/**
 * 보안 설정 컴포넌트
 * - 취약점 스캔, 접근 제어, 감사 로그 설정 관리
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
  Switch,
  FormControlLabel,
  Slider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  Security as SecurityIcon,
  BugReport as VulnerabilityIcon,
  Lock as AccessControlIcon,
  History as AuditIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  PlayArrow as ScanIcon,
  Stop as StopIcon
} from '@mui/icons-material';

import { SecurityConfig } from '../SettingsTab';

interface SecuritySettingsProps {
  config: SecurityConfig;
  demoMode: boolean;
  onChange: (config: SecurityConfig) => void;
}

const vulnerabilityScanners = [
  { 
    value: 'trivy', 
    label: 'Trivy', 
    description: '오픈소스 취약점 스캐너',
    pros: ['무료', '빠른 스캔', '컨테이너 지원'],
    cons: ['기본 기능만', '고급 정책 제한']
  },
  { 
    value: 'clair', 
    label: 'Clair', 
    description: 'CoreOS의 컨테이너 보안 스캐너',
    pros: ['무료', '정확한 결과', 'API 지원'],
    cons: ['설정 복잡', '리소스 사용량 높음']
  },
  { 
    value: 'snyk', 
    label: 'Snyk', 
    description: '상용 보안 플랫폼',
    pros: ['강력한 기능', '실시간 모니터링', '자동 수정'],
    cons: ['유료', '클라우드 의존']
  }
];

const securityPolicies = [
  {
    name: '기본 보안 정책',
    description: '일반적인 보안 위험 방지',
    rules: ['CVE 점수 7.0 이상 차단', '루트 사용자 실행 금지', '포트 22, 3389 차단']
  },
  {
    name: '엄격한 보안 정책',
    description: '높은 보안 수준 요구',
    rules: ['CVE 점수 5.0 이상 차단', '모든 권한 제한', '네트워크 격리']
  },
  {
    name: '커스텀 정책',
    description: '사용자 정의 보안 규칙',
    rules: ['사용자 정의 규칙', '조건부 실행', '예외 처리']
  }
];

const demoVulnerabilities = [
  {
    id: 'CVE-2023-1234',
    severity: 'High',
    package: 'openssl',
    version: '1.1.1k',
    description: 'OpenSSL 취약점 - 원격 코드 실행 가능',
    cveScore: 8.5,
    status: 'Open'
  },
  {
    id: 'CVE-2023-5678',
    severity: 'Medium',
    package: 'nginx',
    version: '1.18.0',
    description: 'Nginx 정보 노출 취약점',
    cveScore: 5.3,
    status: 'Fixed'
  },
  {
    id: 'CVE-2023-9012',
    severity: 'Low',
    package: 'curl',
    version: '7.68.0',
    description: 'cURL 경고 메시지 취약점',
    cveScore: 3.1,
    status: 'Open'
  }
];

export const SecuritySettings: React.FC<SecuritySettingsProps> = ({ config, demoMode, onChange }) => {
  const [expandedSections, setExpandedSections] = useState({
    vulnerability: true,
    access: true,
    audit: true
  });
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'completed' | 'error'>('idle');
  const [selectedPolicy, setSelectedPolicy] = useState('기본 보안 정책');

  const handleConfigChange = (field: keyof SecurityConfig, value: any) => {
    onChange({ ...config, [field]: value });
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // 데모 모드에서 취약점 스캔 시뮬레이션
  const runVulnerabilityScan = async () => {
    if (scanStatus === 'scanning') return;
    
    setScanStatus('scanning');
    
    if (demoMode) {
      // 데모 모드: 가상의 스캔 결과
      setTimeout(() => {
        setScanStatus('completed');
      }, 8000);
    } else {
      // 실제 모드: 실제 취약점 스캔
      try {
        // TODO: 실제 취약점 스캔 실행
        setScanStatus('completed');
      } catch (error) {
        setScanStatus('error');
      }
    }
  };

  const stopScan = () => {
    setScanStatus('idle');
  };

  const getScanStatusIcon = () => {
    switch (scanStatus) {
      case 'scanning': return <div className="spinner" />;
      case 'completed': return <CheckCircleIcon color="success" />;
      case 'error': return <ErrorIcon color="error" />;
      default: return <ScanIcon />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom color="primary">
        🔒 보안 설정
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        <AlertTitle>💡 보안이란?</AlertTitle>
        <Typography variant="body2">
          보안은 시스템과 데이터를 보호하는 것입니다. 
          취약점 스캔, 접근 제어, 감사 로그를 통해 
          보안 위협을 사전에 방지하고 발생 시 추적할 수 있습니다.
        </Typography>
      </Alert>

      {/* 취약점 스캔 설정 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
            onClick={() => toggleSection('vulnerability')}
          >
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <VulnerabilityIcon color="primary" />
              취약점 스캔 설정
            </Typography>
            <IconButton size="small">
              {expandedSections.vulnerability ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          
          <Collapse in={expandedSections.vulnerability}>
            <Divider sx={{ my: 2 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>취약점 스캐너</InputLabel>
                  <Select
                    value={config.vulnerabilityScanner}
                    label="취약점 스캐너"
                    onChange={(e) => handleConfigChange('vulnerabilityScanner', e.target.value)}
                    disabled={demoMode}
                  >
                    {vulnerabilityScanners.map(scanner => (
                      <MenuItem key={scanner.value} value={scanner.value}>
                        {scanner.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.autoBlockVulnerabilities}
                      onChange={(e) => handleConfigChange('autoBlockVulnerabilities', e.target.checked)}
                      disabled={demoMode}
                    />
                  }
                  label="자동 취약점 차단"
                  sx={{ mb: 2 }}
                />
                
                <Typography variant="subtitle1" gutterBottom>
                  스캔 주기: 매일
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Button
                    variant="contained"
                    startIcon={getScanStatusIcon()}
                    onClick={runVulnerabilityScan}
                    disabled={scanStatus === 'scanning'}
                  >
                    {scanStatus === 'scanning' ? '스캔 중...' : '취약점 스캔 실행'}
                  </Button>
                  
                  {scanStatus === 'scanning' && (
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<StopIcon />}
                      onClick={stopScan}
                    >
                      중지
                    </Button>
                  )}
                </Box>
                
                {scanStatus === 'completed' && (
                  <Alert severity="success" sx={{ mb: 2 }}>
                    <AlertTitle>✅ 스캔 완료</AlertTitle>
                    <Typography variant="body2">
                      취약점 스캔이 완료되었습니다. 결과를 확인하세요.
                    </Typography>
                  </Alert>
                )}
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, backgroundColor: 'primary.50' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    🔍 스캐너 비교
                  </Typography>
                  {vulnerabilityScanners.map(scanner => (
                    <Box key={scanner.value} sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {scanner.label}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        {scanner.description}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {scanner.pros.map((pro, index) => (
                          <Chip key={index} label={pro} size="small" color="success" variant="outlined" />
                        ))}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                        {scanner.cons.map((con, index) => (
                          <Chip key={index} label={con} size="small" color="warning" variant="outlined" />
                        ))}
                      </Box>
                    </Box>
                  ))}
                </Paper>
              </Grid>
            </Grid>
            
            {/* 취약점 결과 테이블 */}
            {scanStatus === 'completed' && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" gutterBottom>
                  📋 스캔 결과
                </Typography>
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>CVE ID</TableCell>
                        <TableCell>심각도</TableCell>
                        <TableCell>패키지</TableCell>
                        <TableCell>버전</TableCell>
                        <TableCell>설명</TableCell>
                        <TableCell>CVE 점수</TableCell>
                        <TableCell>상태</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {demoVulnerabilities.map((vuln) => (
                        <TableRow key={vuln.id}>
                          <TableCell>{vuln.id}</TableCell>
                          <TableCell>
                            <Chip 
                              label={vuln.severity} 
                              color={getSeverityColor(vuln.severity) as any}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{vuln.package}</TableCell>
                          <TableCell>{vuln.version}</TableCell>
                          <TableCell>{vuln.description}</TableCell>
                          <TableCell>{vuln.cveScore}</TableCell>
                          <TableCell>
                            <Chip 
                              label={vuln.status} 
                              color={vuln.status === 'Fixed' ? 'success' : 'warning'}
                              size="small"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </Collapse>
        </CardContent>
      </Card>

      {/* 접근 제어 설정 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
            onClick={() => toggleSection('access')}
          >
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccessControlIcon color="primary" />
              접근 제어 설정
            </Typography>
            <IconButton size="small">
              {expandedSections.access ? <ExpandLessIcon /> : <ExpandLessIcon />}
            </IconButton>
          </Box>
          
          <Collapse in={expandedSections.access}>
            <Divider sx={{ my: 2 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>
                  보안 정책 선택
                </Typography>
                
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>보안 정책</InputLabel>
                  <Select
                    value={selectedPolicy}
                    label="보안 정책"
                    onChange={(e) => setSelectedPolicy(e.target.value)}
                    disabled={demoMode}
                  >
                    {securityPolicies.map(policy => (
                      <MenuItem key={policy.name} value={policy.name}>
                        {policy.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={true}
                      disabled={demoMode}
                    />
                  }
                  label="RBAC 활성화"
                  sx={{ mb: 1 }}
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={true}
                      disabled={demoMode}
                    />
                  }
                  label="네트워크 정책 활성화"
                  sx={{ mb: 1 }}
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={true}
                      disabled={demoMode}
                    />
                  }
                  label="Pod 보안 정책 활성화"
                  sx={{ mb: 2 }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, backgroundColor: 'warning.50' }}>
                  <Typography variant="subtitle2" gutterBottom color="warning.main">
                    🛡️ 선택된 보안 정책
                  </Typography>
                  {securityPolicies.map(policy => (
                    policy.name === selectedPolicy && (
                      <Box key={policy.name}>
                        <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>
                          {policy.description}
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          {policy.rules.map((rule, index) => (
                            <Typography key={index} variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <span>•</span> {rule}
                            </Typography>
                          ))}
                        </Box>
                      </Box>
                    )
                  ))}
                </Paper>
                
                <Paper sx={{ p: 2, backgroundColor: 'info.50', mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom color="info.main">
                    🔐 접근 제어 구성 요소
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    • <strong>RBAC</strong>: 역할 기반 접근 제어
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    • <strong>Network Policy</strong>: 네트워크 트래픽 제어
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    • <strong>Pod Security Policy</strong>: Pod 보안 표준
                  </Typography>
                  <Typography variant="body2">
                    • <strong>Service Account</strong>: 서비스 인증 관리
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Collapse>
        </CardContent>
      </Card>

      {/* 감사 로그 설정 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box 
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
            onClick={() => toggleSection('audit')}
          >
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AuditIcon color="primary" />
              감사 로그 설정
            </Typography>
            <IconButton size="small">
              {expandedSections.audit ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          
          <Collapse in={expandedSections.audit}>
            <Divider sx={{ my: 2 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom>
                  로그 보관 기간: {config.auditLogRetention}일
                </Typography>
                <Slider
                  value={config.auditLogRetention}
                  onChange={(_, value) => handleConfigChange('auditLogRetention', value)}
                  min={1}
                  max={365}
                  step={1}
                  marks={[
                    { value: 1, label: '1일' },
                    { value: 30, label: '30일' },
                    { value: 90, label: '90일' },
                    { value: 365, label: '1년' }
                  ]}
                  disabled={demoMode}
                  valueLabelDisplay="auto"
                  sx={{ mb: 2 }}
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={true}
                      disabled={demoMode}
                    />
                  }
                  label="API 서버 감사 로그 활성화"
                  sx={{ mb: 1 }}
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={true}
                      disabled={demoMode}
                    />
                  }
                  label="Pod 감사 로그 활성화"
                  sx={{ mb: 1 }}
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={true}
                      disabled={demoMode}
                    />
                  }
                  label="네트워크 정책 감사 로그 활성화"
                  sx={{ mb: 2 }}
                />
                
                <Button
                  variant="outlined"
                  disabled={demoMode}
                  sx={{ mb: 2 }}
                >
                  📥 감사 로그 내보내기
                </Button>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2, backgroundColor: 'success.50' }}>
                  <Typography variant="subtitle2" gutterBottom color="success.main">
                    📋 감사 로그 항목
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    • <strong>API 호출</strong>: 모든 Kubernetes API 요청/응답
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    • <strong>인증/인가</strong>: 사용자 로그인 및 권한 확인
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    • <strong>리소스 변경</strong>: Pod, Service 등 생성/수정/삭제
                  </Typography>
                  <Typography variant="body2">
                    • <strong>정책 위반</strong>: 보안 정책 위반 시도
                  </Typography>
                </Paper>
                
                <Paper sx={{ p: 2, backgroundColor: 'info.50', mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom color="info.main">
                    🔍 감사 로그 활용
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    • <strong>보안 사고 조사</strong>: 침입 시도 추적
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    • <strong>규정 준수</strong>: 감사 및 인증 요구사항 충족
                  </Typography>
                  <Typography variant="body2">
                    • <strong>성능 분석</strong>: 시스템 사용 패턴 분석
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
          onClick={() => console.log('보안 설정 저장:', config)}
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
