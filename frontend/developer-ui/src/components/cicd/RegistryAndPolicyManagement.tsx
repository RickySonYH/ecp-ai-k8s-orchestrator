// [advice from AI] 레지스트리 관리 및 보안정책 설정 컴포넌트
/**
 * Registry and Policy Management Component
 * 좌우 배치로 레지스트리 관리와 보안정책 설정을 제공
 * 
 * 좌측: 레지스트리 관리 (Docker Hub, AWS ECR, Harbor 등)
 * 우측: 보안정책 설정 (스캔 정책, 접근 권한, 배포 승인 등)
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Slider,
  useTheme,
  alpha
} from '@mui/material';
import {
  Storage as StorageIcon,
  Security as SecurityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  VpnKey as KeyIcon,
  Shield as ShieldIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  CloudUpload as CloudUploadIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';

// 타입 정의
interface Registry {
  id: string;
  name: string;
  type: 'harbor' | 'docker-hub' | 'aws-ecr' | 'azure-acr' | 'gcp-gcr';
  url: string;
  status: 'connected' | 'disconnected' | 'error';
  isDefault: boolean;
  username?: string;
  lastSync?: string;
}

interface SecurityPolicy {
  id: string;
  name: string;
  enabled: boolean;
  value: string | number | boolean;
  description: string;
}

const RegistryAndPolicyManagement: React.FC = () => {
  const theme = useTheme();
  const [registries, setRegistries] = useState<Registry[]>([
    {
      id: 'harbor-1',
      name: 'Harbor (기본)',
      type: 'harbor',
      url: 'harbor.company.com',
      status: 'connected',
      isDefault: true,
      username: 'admin',
      lastSync: '2024-01-15 14:30:00'
    },
    {
      id: 'ecr-1',
      name: 'AWS ECR - Production',
      type: 'aws-ecr',
      url: '123456789.dkr.ecr.us-west-2.amazonaws.com',
      status: 'connected',
      isDefault: false,
      username: 'aws-user',
      lastSync: '2024-01-15 12:15:00'
    },
    {
      id: 'dockerhub-1',
      name: 'Docker Hub',
      type: 'docker-hub',
      url: 'registry.hub.docker.com',
      status: 'disconnected',
      isDefault: false,
      username: 'company-docker'
    }
  ]);

  const [securityPolicies, setSecurityPolicies] = useState<SecurityPolicy[]>([
    { id: 'scan-enabled', name: '이미지 보안 스캔', enabled: true, value: true, description: 'Trivy를 사용한 자동 취약점 스캔' },
    { id: 'cve-threshold', name: 'CVE 심각도 임계값', enabled: true, value: 7.0, description: '이 점수 이상의 취약점 발견 시 배포 차단' },
    { id: 'malware-scan', name: '멀웨어 검사', enabled: true, value: true, description: '이미지 내 멀웨어 검사 수행' },
    { id: 'license-check', name: '라이선스 검증', enabled: false, value: false, description: '오픈소스 라이선스 호환성 검사' },
    { id: 'image-signing', name: '이미지 서명 검증', enabled: true, value: true, description: 'Cosign을 통한 이미지 서명 확인' },
    { id: 'base-image-policy', name: '기본 이미지 정책', enabled: true, value: 'approved-only', description: '승인된 기본 이미지만 사용 허용' },
    { id: 'registry-whitelist', name: '레지스트리 화이트리스트', enabled: true, value: true, description: '승인된 레지스트리에서만 이미지 pull 허용' },
    { id: 'deployment-approval', name: '배포 승인 필요', enabled: false, value: false, description: '운영 환경 배포 시 승인자 확인 필요' },
    { id: 'audit-logging', name: '감사 로그', enabled: true, value: true, description: '모든 이미지 관련 활동 로그 기록' },
    { id: 'retention-days', name: '로그 보관 기간', enabled: true, value: 90, description: '감사 로그 보관 일수' }
  ]);

  const [openRegistryDialog, setOpenRegistryDialog] = useState(false);
  const [editingRegistry, setEditingRegistry] = useState<Registry | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // 레지스트리 상태별 색상
  const getRegistryStatusColor = (status: Registry['status']) => {
    switch (status) {
      case 'connected': return 'success';
      case 'disconnected': return 'default';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  // 레지스트리 상태별 아이콘
  const getRegistryStatusIcon = (status: Registry['status']) => {
    switch (status) {
      case 'connected': return <CheckCircleIcon />;
      case 'disconnected': return <WarningIcon />;
      case 'error': return <ErrorIcon />;
      default: return <WarningIcon />;
    }
  };

  // 보안 정책 업데이트
  const handlePolicyChange = (policyId: string, field: 'enabled' | 'value', newValue: any) => {
    setSecurityPolicies(prev => 
      prev.map(policy => 
        policy.id === policyId 
          ? { ...policy, [field]: newValue }
          : policy
      )
    );
  };

  // 레지스트리 추가/편집 대화상자 열기
  const handleOpenRegistryDialog = (registry?: Registry) => {
    setEditingRegistry(registry || null);
    setOpenRegistryDialog(true);
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        ⚙️ 레지스트리 & 정책 관리
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        컨테이너 레지스트리 연결 설정과 보안 정책을 관리합니다.
      </Typography>

      <Grid container spacing={3}>
        {/* 좌측: 레지스트리 관리 */}
        <Grid item xs={12} lg={6}>
          <Card sx={{ height: 'fit-content' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <StorageIcon color="primary" />
                  레지스트리 관리
                </Typography>
                <Button 
                  variant="contained" 
                  size="small" 
                  startIcon={<AddIcon />}
                  onClick={() => handleOpenRegistryDialog()}
                >
                  레지스트리 추가
                </Button>
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Docker 이미지 저장소 연결 및 인증 정보를 관리합니다.
              </Typography>

              {/* 레지스트리 목록 */}
              <List>
                {registries.map((registry, index) => (
                  <React.Fragment key={registry.id}>
                    <ListItem sx={{ px: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getRegistryStatusIcon(registry.status)}
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="subtitle2">
                                {registry.name}
                              </Typography>
                              {registry.isDefault && (
                                <Chip label="기본" size="small" color="primary" />
                              )}
                            </Box>
                            <Typography variant="caption" color="text.secondary">
                              {registry.url}
                            </Typography>
                            {registry.lastSync && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                마지막 동기화: {registry.lastSync}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                          <Chip 
                            label={registry.status === 'connected' ? '연결됨' : registry.status === 'error' ? '오류' : '연결안됨'} 
                            size="small"
                            color={getRegistryStatusColor(registry.status)}
                          />
                          <IconButton size="small" onClick={() => handleOpenRegistryDialog(registry)}>
                            <EditIcon />
                          </IconButton>
                        </Box>
                      </Box>
                    </ListItem>
                    {index < registries.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>

              {/* 레지스트리 통계 */}
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  총 {registries.length}개 레지스트리 등록됨 
                  (연결됨: {registries.filter(r => r.status === 'connected').length}개)
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        {/* 우측: 보안정책 설정 */}
        <Grid item xs={12} lg={6}>
          <Card sx={{ height: 'fit-content' }}>
            <CardContent>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <SecurityIcon color="primary" />
                보안정책 설정
              </Typography>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                이미지 보안 스캔, 배포 승인, 감사 로그 등의 정책을 설정합니다.
              </Typography>

              {/* 보안 정책 목록 */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {securityPolicies.map((policy) => (
                  <Paper key={policy.id} sx={{ p: 2, backgroundColor: alpha(theme.palette.background.default, 0.5) }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                          {policy.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {policy.description}
                        </Typography>
                      </Box>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={policy.enabled}
                            onChange={(e) => handlePolicyChange(policy.id, 'enabled', e.target.checked)}
                            size="small"
                          />
                        }
                        label=""
                        sx={{ ml: 1 }}
                      />
                    </Box>

                    {/* 정책별 세부 설정 */}
                    {policy.enabled && (
                      <Box sx={{ mt: 2, pl: 1 }}>
                        {/* CVE 임계값 슬라이더 */}
                        {policy.id === 'cve-threshold' && (
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              임계값: {policy.value}
                            </Typography>
                            <Slider
                              value={policy.value as number}
                              onChange={(_, newValue) => handlePolicyChange(policy.id, 'value', newValue)}
                              min={0}
                              max={10}
                              step={0.1}
                              marks={[
                                { value: 0, label: '0' },
                                { value: 5, label: '5' },
                                { value: 7, label: '7' },
                                { value: 10, label: '10' }
                              ]}
                              size="small"
                            />
                          </Box>
                        )}

                        {/* 로그 보관 기간 */}
                        {policy.id === 'retention-days' && (
                          <TextField
                            type="number"
                            value={policy.value}
                            onChange={(e) => handlePolicyChange(policy.id, 'value', parseInt(e.target.value))}
                            size="small"
                            inputProps={{ min: 1, max: 365 }}
                            sx={{ width: 100 }}
                            label="일수"
                          />
                        )}

                        {/* 기본 이미지 정책 선택 */}
                        {policy.id === 'base-image-policy' && (
                          <FormControl size="small" sx={{ minWidth: 150 }}>
                            <Select
                              value={policy.value}
                              onChange={(e) => handlePolicyChange(policy.id, 'value', e.target.value)}
                            >
                              <MenuItem value="approved-only">승인된 이미지만</MenuItem>
                              <MenuItem value="scan-required">스캔 필수</MenuItem>
                              <MenuItem value="any">제한 없음</MenuItem>
                            </Select>
                          </FormControl>
                        )}
                      </Box>
                    )}
                  </Paper>
                ))}
              </Box>

              {/* 정책 요약 */}
              <Alert severity="success" sx={{ mt: 3 }}>
                <Typography variant="body2">
                  {securityPolicies.filter(p => p.enabled).length}개 정책이 활성화되어 있습니다.
                  보안 수준: <strong>높음</strong>
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 레지스트리 추가/편집 대화상자 */}
      <Dialog open={openRegistryDialog} onClose={() => setOpenRegistryDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingRegistry ? '레지스트리 편집' : '레지스트리 추가'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="레지스트리 이름"
              fullWidth
              defaultValue={editingRegistry?.name || ''}
            />
            <FormControl fullWidth>
              <InputLabel>레지스트리 유형</InputLabel>
              <Select defaultValue={editingRegistry?.type || 'harbor'}>
                <MenuItem value="harbor">Harbor</MenuItem>
                <MenuItem value="docker-hub">Docker Hub</MenuItem>
                <MenuItem value="aws-ecr">AWS ECR</MenuItem>
                <MenuItem value="azure-acr">Azure ACR</MenuItem>
                <MenuItem value="gcp-gcr">Google GCR</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="레지스트리 URL"
              fullWidth
              defaultValue={editingRegistry?.url || ''}
            />
            <TextField
              label="사용자명"
              fullWidth
              defaultValue={editingRegistry?.username || ''}
            />
            <TextField
              label="비밀번호"
              type={showPassword ? 'text' : 'password'}
              fullWidth
              InputProps={{
                endAdornment: (
                  <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                )
              }}
            />
            <FormControlLabel
              control={<Switch defaultChecked={editingRegistry?.isDefault || false} />}
              label="기본 레지스트리로 설정"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRegistryDialog(false)}>취소</Button>
          <Button variant="contained" onClick={() => setOpenRegistryDialog(false)}>
            {editingRegistry ? '수정' : '추가'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RegistryAndPolicyManagement;
