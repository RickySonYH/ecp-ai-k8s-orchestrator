// [advice from AI] GitHub 통합 컴포넌트 - 이미지 등록 및 검증
/**
 * GitHubIntegration Component
 * - GitHub 연결 설정
 * - 이미지 등록 및 검증
 * - CI/CD 파이프라인 관리
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  LinearProgress,
  Collapse,
  AlertTitle,
  Divider,
  useTheme,
  alpha
} from '@mui/material';
import {
  GitHub as GitHubIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Security as SecurityIcon,
  Build as BuildIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  PlayArrow as PlayArrowIcon,
  History as HistoryIcon,
  Settings as SettingsIcon,
  Storage as StorageIcon,
  Info as InfoIcon,
  Link as LinkIcon,
  LinkOff as UnlinkIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Code as CodeIcon,
  BugReport as BugReportIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// 타입 정의
interface GitHubConnection {
  id: string;
  name: string;
  repository: string;
  branch: string;
  accessToken: string;
  webhookUrl: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync: string;
  isDefault: boolean;
}

interface ImageBuild {
  id: string;
  serviceName: string;
  repository: string;
  branch: string;
  commitHash: string;
  commitMessage: string;
  buildStatus: 'pending' | 'building' | 'success' | 'failed' | 'cancelled';
  imageTag: string;
  registry: string;
  createdAt: string;
  completedAt?: string;
  logs: string[];
  vulnerabilities?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

interface DeploymentPolicy {
  id: string;
  name: string;
  serviceName: string;
  environment: 'dev' | 'staging' | 'production';
  autoDeploy: boolean;
  approvalRequired: boolean;
  approvers: string[];
  healthChecks: {
    enabled: boolean;
    timeout: number;
    retries: number;
  };
  rollbackPolicy: {
    enabled: boolean;
    automatic: boolean;
    threshold: number;
  };
}

const StyledCard = styled(Card)(({ theme }) => ({
  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
  transition: 'all 0.3s ease-in-out',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[4],
  },
}));

const GitHubIntegration: React.FC = () => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [connections, setConnections] = useState<GitHubConnection[]>([]);
  const [builds, setBuilds] = useState<ImageBuild[]>([]);
  const [policies, setPolicies] = useState<DeploymentPolicy[]>([]);
  const [connectionDialog, setConnectionDialog] = useState(false);
  const [buildDialog, setBuildDialog] = useState(false);
  const [policyDialog, setPolicyDialog] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);

  // [advice from AI] GitHub 연결 추가
  const [newConnection, setNewConnection] = useState<Partial<GitHubConnection>>({
    name: '',
    repository: '',
    branch: 'main',
    accessToken: '',
    webhookUrl: '',
    isDefault: false
  });

  // [advice from AI] 이미지 빌드 추가
  const [newBuild, setNewBuild] = useState<Partial<ImageBuild>>({
    serviceName: '',
    repository: '',
    branch: 'main',
    commitHash: '',
    commitMessage: '',
    imageTag: 'latest'
  });

  // [advice from AI] 배포 정책 추가
  const [newPolicy, setNewPolicy] = useState<Partial<DeploymentPolicy>>({
    name: '',
    serviceName: '',
    environment: 'dev',
    autoDeploy: false,
    approvalRequired: false,
    approvers: [],
    healthChecks: {
      enabled: true,
      timeout: 30,
      retries: 3
    },
    rollbackPolicy: {
      enabled: true,
      automatic: false,
      threshold: 5
    }
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 실제 API 호출로 대체 예정
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // [advice from AI] 샘플 데이터 (실제로는 API에서 가져옴)
      setConnections([
        {
          id: '1',
          name: 'ECP-AI Main',
          repository: 'ecp-ai/ecp-ai-k8s-orchestrator',
          branch: 'main',
          accessToken: 'ghp_********',
          webhookUrl: 'https://api.github.com/repos/ecp-ai/ecp-ai-k8s-orchestrator/hooks',
          status: 'connected',
          lastSync: '2024-01-15T10:30:00Z',
          isDefault: true
        }
      ]);

      setBuilds([
        {
          id: '1',
          serviceName: 'callbot',
          repository: 'ecp-ai/ecp-ai-k8s-orchestrator',
          branch: 'main',
          commitHash: 'a1b2c3d4',
          commitMessage: 'feat: Add callbot service implementation',
          buildStatus: 'success',
          imageTag: 'v1.54.0',
          registry: 'ecr.aws.com/ecp-ai',
          createdAt: '2024-01-15T10:00:00Z',
          completedAt: '2024-01-15T10:15:00Z',
          logs: ['Building image...', 'Security scan passed', 'Push to registry completed'],
          vulnerabilities: { critical: 0, high: 0, medium: 2, low: 5 }
        }
      ]);

      setPolicies([
        {
          id: '1',
          name: 'Callbot Production',
          serviceName: 'callbot',
          environment: 'production',
          autoDeploy: false,
          approvalRequired: true,
          approvers: ['admin', 'devops'],
          healthChecks: { enabled: true, timeout: 60, retries: 5 },
          rollbackPolicy: { enabled: true, automatic: true, threshold: 3 }
        }
      ]);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddConnection = async () => {
    try {
      setLoading(true);
      // [advice from AI] GitHub 연결 검증 및 추가
      const connection: GitHubConnection = {
        ...newConnection as GitHubConnection,
        id: Date.now().toString(),
        status: 'connected',
        lastSync: new Date().toISOString()
      };

      setConnections(prev => [...prev, connection]);
      setConnectionDialog(false);
      setNewConnection({
        name: '',
        repository: '',
        branch: 'main',
        accessToken: '',
        webhookUrl: '',
        isDefault: false
      });
    } catch (error) {
      console.error('GitHub 연결 추가 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerBuild = async () => {
    try {
      setLoading(true);
      // [advice from AI] 이미지 빌드 트리거
      const build: ImageBuild = {
        ...newBuild as ImageBuild,
        id: Date.now().toString(),
        buildStatus: 'building',
        registry: 'ecr.aws.com/ecp-ai',
        createdAt: new Date().toISOString(),
        logs: ['Build triggered...']
      };

      setBuilds(prev => [build, ...prev]);
      setBuildDialog(false);
      setNewBuild({
        serviceName: '',
        repository: '',
        branch: 'main',
        commitHash: '',
        commitMessage: '',
        imageTag: 'latest'
      });
    } catch (error) {
      console.error('빌드 트리거 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPolicy = async () => {
    try {
      setLoading(true);
      // [advice from AI] 배포 정책 추가
      const policy: DeploymentPolicy = {
        ...newPolicy as DeploymentPolicy,
        id: Date.now().toString()
      };

      setPolicies(prev => [...prev, policy]);
      setPolicyDialog(false);
      setNewPolicy({
        name: '',
        serviceName: '',
        environment: 'dev',
        autoDeploy: false,
        approvalRequired: false,
        approvers: [],
        healthChecks: { enabled: true, timeout: 30, retries: 3 },
        rollbackPolicy: { enabled: true, automatic: false, threshold: 5 }
      });
    } catch (error) {
      console.error('배포 정책 추가 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
      case 'success':
        return 'success';
      case 'building':
      case 'pending':
        return 'warning';
      case 'error':
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
      case 'success':
        return <CheckCircleIcon color="success" />;
      case 'building':
      case 'pending':
        return <BuildIcon color="warning" />;
      case 'error':
      case 'failed':
        return <ErrorIcon color="error" />;
      default:
        return <InfoIcon color="info" />;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
        🔗 GitHub 통합 관리
      </Typography>

      <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
        <Tab label="연결 관리" icon={<LinkIcon />} />
        <Tab label="이미지 빌드" icon={<BuildIcon />} />
        <Tab label="배포 정책" icon={<SettingsIcon />} />
      </Tabs>

      {/* GitHub 연결 관리 */}
      {activeTab === 0 && (
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h6">GitHub 저장소 연결</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setConnectionDialog(true)}
            >
              연결 추가
            </Button>
          </Box>

          <Grid container spacing={3}>
            {connections.map((connection) => (
              <Grid item xs={12} md={6} key={connection.id}>
                <StyledCard>
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <GitHubIcon color="primary" />
                        <Typography variant="h6">{connection.name}</Typography>
                        {connection.isDefault && (
                          <Chip label="기본" size="small" color="primary" />
                        )}
                      </Box>
                      {getStatusIcon(connection.status)}
                    </Box>

                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {connection.repository}
                    </Typography>

                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Chip label={connection.branch} size="small" variant="outlined" />
                      <Chip 
                        label={connection.status} 
                        size="small" 
                        color={getStatusColor(connection.status) as any}
                      />
                    </Box>

                    <Typography variant="caption" color="text.secondary">
                      마지막 동기화: {new Date(connection.lastSync).toLocaleString()}
                    </Typography>

                    <Box display="flex" gap={1} mt={2}>
                      <IconButton size="small" onClick={() => {}}>
                        <RefreshIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => {}}>
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => {}}>
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </CardContent>
                </StyledCard>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* 이미지 빌드 관리 */}
      {activeTab === 1 && (
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h6">이미지 빌드 현황</Typography>
            <Button
              variant="contained"
              startIcon={<PlayArrowIcon />}
              onClick={() => setBuildDialog(true)}
            >
              빌드 트리거
            </Button>
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>서비스</TableCell>
                  <TableCell>브랜치</TableCell>
                  <TableCell>커밋</TableCell>
                  <TableCell>상태</TableCell>
                  <TableCell>이미지 태그</TableCell>
                  <TableCell>보안 검사</TableCell>
                  <TableCell>생성일</TableCell>
                  <TableCell>작업</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {builds.map((build) => (
                  <TableRow key={build.id}>
                    <TableCell>
                      <Typography variant="subtitle2">{build.serviceName}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={build.branch} size="small" />
                    </TableCell>
                    <TableCell>
                      <Tooltip title={build.commitMessage}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {build.commitHash.substring(0, 8)}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        {getStatusIcon(build.buildStatus)}
                        <Chip 
                          label={build.buildStatus} 
                          size="small" 
                          color={getStatusColor(build.buildStatus) as any}
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {build.imageTag}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {build.vulnerabilities ? (
                        <Box>
                          <Chip 
                            label={`C:${build.vulnerabilities.critical} H:${build.vulnerabilities.high}`}
                            size="small"
                            color={build.vulnerabilities.critical > 0 ? 'error' : 'success'}
                          />
                        </Box>
                      ) : (
                        <Chip label="검사 중" size="small" color="warning" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(build.createdAt).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => {}}>
                        <HistoryIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* 배포 정책 관리 */}
      {activeTab === 2 && (
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h6">배포 정책 설정</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setPolicyDialog(true)}
            >
              정책 추가
            </Button>
          </Box>

          <Grid container spacing={3}>
            {policies.map((policy) => (
              <Grid item xs={12} md={6} key={policy.id}>
                <StyledCard>
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                      <Typography variant="h6">{policy.name}</Typography>
                      <Chip 
                        label={policy.environment} 
                        size="small" 
                        color={policy.environment === 'production' ? 'error' : 'primary'}
                      />
                    </Box>

                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      서비스: {policy.serviceName}
                    </Typography>

                    <Box display="flex" flexDirection="column" gap={1} mb={2}>
                      <FormControlLabel
                        control={<Switch checked={policy.autoDeploy} disabled />}
                        label="자동 배포"
                      />
                      <FormControlLabel
                        control={<Switch checked={policy.approvalRequired} disabled />}
                        label="승인 필요"
                      />
                    </Box>

                    <Box display="flex" gap={1}>
                      <IconButton size="small" onClick={() => {}}>
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => {}}>
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </CardContent>
                </StyledCard>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* GitHub 연결 다이얼로그 */}
      <Dialog open={connectionDialog} onClose={() => setConnectionDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <GitHubIcon />
            GitHub 저장소 연결
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="연결 이름"
                value={newConnection.name}
                onChange={(e) => setNewConnection(prev => ({ ...prev, name: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="저장소 (owner/repo)"
                placeholder="ecp-ai/ecp-ai-k8s-orchestrator"
                value={newConnection.repository}
                onChange={(e) => setNewConnection(prev => ({ ...prev, repository: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="브랜치"
                value={newConnection.branch}
                onChange={(e) => setNewConnection(prev => ({ ...prev, branch: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="액세스 토큰"
                type={showToken ? 'text' : 'password'}
                value={newConnection.accessToken}
                onChange={(e) => setNewConnection(prev => ({ ...prev, accessToken: e.target.value }))}
                InputProps={{
                  endAdornment: (
                    <IconButton onClick={() => setShowToken(!showToken)}>
                      {showToken ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={newConnection.isDefault}
                    onChange={(e) => setNewConnection(prev => ({ ...prev, isDefault: e.target.checked }))}
                  />
                }
                label="기본 연결로 설정"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConnectionDialog(false)}>취소</Button>
          <Button onClick={handleAddConnection} variant="contained" disabled={loading}>
            연결
          </Button>
        </DialogActions>
      </Dialog>

      {/* 이미지 빌드 다이얼로그 */}
      <Dialog open={buildDialog} onClose={() => setBuildDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <BuildIcon />
            이미지 빌드 트리거
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="서비스 이름"
                value={newBuild.serviceName}
                onChange={(e) => setNewBuild(prev => ({ ...prev, serviceName: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="이미지 태그"
                value={newBuild.imageTag}
                onChange={(e) => setNewBuild(prev => ({ ...prev, imageTag: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="저장소"
                value={newBuild.repository}
                onChange={(e) => setNewBuild(prev => ({ ...prev, repository: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="브랜치"
                value={newBuild.branch}
                onChange={(e) => setNewBuild(prev => ({ ...prev, branch: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="커밋 해시"
                value={newBuild.commitHash}
                onChange={(e) => setNewBuild(prev => ({ ...prev, commitHash: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="커밋 메시지"
                multiline
                rows={2}
                value={newBuild.commitMessage}
                onChange={(e) => setNewBuild(prev => ({ ...prev, commitMessage: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBuildDialog(false)}>취소</Button>
          <Button onClick={handleTriggerBuild} variant="contained" disabled={loading}>
            빌드 시작
          </Button>
        </DialogActions>
      </Dialog>

      {/* 배포 정책 다이얼로그 */}
      <Dialog open={policyDialog} onClose={() => setPolicyDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <SettingsIcon />
            배포 정책 설정
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="정책 이름"
                value={newPolicy.name}
                onChange={(e) => setNewPolicy(prev => ({ ...prev, name: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>환경</InputLabel>
                <Select
                  value={newPolicy.environment}
                  onChange={(e) => setNewPolicy(prev => ({ ...prev, environment: e.target.value as any }))}
                >
                  <MenuItem value="dev">개발</MenuItem>
                  <MenuItem value="staging">스테이징</MenuItem>
                  <MenuItem value="production">프로덕션</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="서비스 이름"
                value={newPolicy.serviceName}
                onChange={(e) => setNewPolicy(prev => ({ ...prev, serviceName: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={newPolicy.autoDeploy}
                    onChange={(e) => setNewPolicy(prev => ({ ...prev, autoDeploy: e.target.checked }))}
                  />
                }
                label="자동 배포"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={newPolicy.approvalRequired}
                    onChange={(e) => setNewPolicy(prev => ({ ...prev, approvalRequired: e.target.checked }))}
                  />
                }
                label="승인 필요"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPolicyDialog(false)}>취소</Button>
          <Button onClick={handleAddPolicy} variant="contained" disabled={loading}>
            정책 추가
          </Button>
        </DialogActions>
      </Dialog>

      {loading && (
        <LinearProgress sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }} />
      )}
    </Box>
  );
};

export default GitHubIntegration;
