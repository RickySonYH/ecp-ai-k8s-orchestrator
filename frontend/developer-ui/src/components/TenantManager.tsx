// [advice from AI] 테넌트 리스트 관리 컴포넌트 - 순수 조회/관리 기능만
/**
 * TenantList Component
 * - 기존 테넌트 조회, 수정, 삭제, 상태 변경
 * - 테넌트별 상세 정보 보기
 * - 데이터 내보내기/가져오기 기능 (데모 모드)
 * 
 * 테넌트 생성 기능은 별도 TenantCreator 컴포넌트에서 처리
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  AlertTitle,
  Tooltip,
  Menu,
  MenuItem as MenuItemComponent,
  Divider,
  CircularProgress,
  Snackbar,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  Download as ExportIcon,
  Upload as ImportIcon,
  RestoreFromTrash as ResetIcon,
  Visibility as ViewIcon,
  Add as AddIcon,
  CloudUpload as DeployIcon,
  Settings as SettingsIcon,
  Monitor as MonitorIcon,
  History as RollbackIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  Build as BuildIcon,
  PlayArrow as PlayArrowIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
// [advice from AI] DemoDataManager 제거됨 - 실제 데이터만 사용
// import { TenantSummary } from '../services/DemoDataManager';
import TenantDataServiceFactory, { TenantDataServiceInterface, TenantSummary } from '../services/TenantDataService';

interface TenantManagerProps {
  isDemoMode: boolean;
  tenants: TenantSummary[];
  onRefresh: () => void;
  onTenantSelect?: (tenantId: string) => void;
}

const StyledCard = styled(Card)(({ theme }) => ({
  transition: 'all 0.3s ease',
  cursor: 'pointer',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[8],
  },
}));

const StatusChip = styled(Chip)<{ status: string }>(({ theme, status }) => ({
  fontWeight: 'bold',
  ...(status === 'running' && {
    backgroundColor: theme.palette.success.main,
    color: theme.palette.success.contrastText,
  }),
  ...(status === 'pending' && {
    backgroundColor: theme.palette.warning.main,
    color: theme.palette.warning.contrastText,
  }),
  ...(status === 'stopped' && {
    backgroundColor: theme.palette.error.main,
    color: theme.palette.error.contrastText,
  }),
}));

// 배포 파이프라인 관련 타입
interface TenantConfig {
  tenant_id: string;
  channels: number;
  concurrent_calls: number;
  service_requirements: {
    [key: string]: {
      cpu_cores: number;
      memory_gb: number;
      replicas: number;
    };
  };
}

interface ServiceImageSelection {
  service_name: string;
  display_name: string;
  current_tag: string;
  available_tags: string[];
  selected_tag: string;
  category: string;
}

interface DeploymentStatus {
  deployment_id: string;
  service_name: string;
  status: string;
  progress: number;
  message: string;
  started_at: string;
  updated_at: string;
}

export const TenantManager: React.FC<TenantManagerProps> = ({
  isDemoMode,
  tenants,
  onRefresh,
  onTenantSelect
}) => {
  // 기존 상태
  const [dataService, setDataService] = useState<TenantDataServiceInterface | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<TenantSummary | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuTenantId, setMenuTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState('');

  // [advice from AI] 배포 관련 누락된 상태 변수들 추가
  const [serviceImages, setServiceImages] = useState<any[]>([]);
  const [tenantConfig, setTenantConfig] = useState<any>(null);
  const [pipelineConfig, setPipelineConfig] = useState<any>({
    namespace: 'default',
    deployment_strategy: 'rolling'
  });
  const [deploymentStatuses, setDeploymentStatuses] = useState<any[]>([]);
  const [activeStep, setActiveStep] = useState(0);

  // [advice from AI] 생성 관련 상태 제거 - 순수 관리 기능만 유지

  // 편집 폼 상태
  const [editForm, setEditForm] = useState({
    name: '',
    status: '',
    preset: ''
  });

  // 데이터 서비스 초기화
  useEffect(() => {
    const service = TenantDataServiceFactory.create(isDemoMode);
    setDataService(service);
  }, [isDemoMode]);

  // [advice from AI] 테넌트 생성 함수 제거 - TenantCreator에서 처리

  const loadServiceImages = async (serviceRequirements: any) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/v1/cicd/list`);
      if (response.ok) {
        const data = await response.json();
        
        // 테넌트에 필요한 서비스만 필터링
        const requiredServices = Object.keys(serviceRequirements);
        const filteredImages = data.images.filter((img: any) => 
          requiredServices.includes(img.service_name)
        );

        const imageSelections: ServiceImageSelection[] = filteredImages.map((img: any) => ({
          service_name: img.service_name,
          display_name: img.display_name,
          current_tag: img.image_tag || 'latest',
          available_tags: ['latest', 'v1.2.3', 'v1.2.2', 'v1.2.1'],
          selected_tag: img.image_tag || 'latest',
          category: img.category
        }));

        // [advice from AI] setServiceImages 함수가 정의되지 않아 주석 처리
        console.log('Service images loaded:', imageSelections);
      }
    } catch (error) {
      console.error('서비스 이미지 로드 오류:', error);
    }
  };

  const handleImageTagChange = (serviceName: string, newTag: string) => {
    setServiceImages((prev: any[]) => 
      prev.map((img: any) => 
        img.service_name === serviceName 
          ? { ...img, selected_tag: newTag }
          : img
      )
    );
  };

  const handleStartDeployment = async () => {
    if (!tenantConfig) return;

    setLoading(true);
    try {
      const deploymentPromises = serviceImages.map(async (service: any) => {
        const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/v1/deployment/deploy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_name: service.service_name,
            image_tag: service.selected_tag,
            tenant_id: tenantConfig.tenant_id,
            namespace: pipelineConfig.namespace,
            deployment_strategy: pipelineConfig.deployment_strategy,
            replicas: tenantConfig.service_requirements[service.service_name]?.replicas || 2
          })
        });

        if (response.ok) {
          const result = await response.json();
          return result.status;
        }
        throw new Error(`${service.service_name} 배포 실패`);
      });

      const results = await Promise.all(deploymentPromises);
      setDeploymentStatuses(results);
      setActiveStep(2);
      setSnackbarMessage('배포가 시작되었습니다!');
      setSnackbarOpen(true);
      
    } catch (error) {
      console.error('배포 오류:', error);
      setSnackbarMessage('배포 중 오류가 발생했습니다.');
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  };

  // 메뉴 핸들러
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, tenantId: string) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setMenuTenantId(tenantId);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setMenuTenantId(null);
  };

  // 테넌트 편집
  const handleEdit = (tenant: TenantSummary) => {
    setSelectedTenant(tenant);
    setEditForm({
      name: tenant.name || '',
      status: tenant.status,
      preset: tenant.preset
    });
    setEditDialogOpen(true);
    handleMenuClose();
  };

  const handleEditSave = async () => {
    if (!selectedTenant || !dataService) return;

    try {
      setLoading(true);
      await dataService.updateTenant(selectedTenant.tenant_id, {
        name: editForm.name,
        status: editForm.status,
        preset: editForm.preset
      });
      
      setSnackbarMessage(`테넌트 '${selectedTenant.tenant_id}' 업데이트 완료!`);
      setSnackbarOpen(true);
      setEditDialogOpen(false);
      onRefresh();
    } catch (error) {
      setSnackbarMessage(`업데이트 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  };

  // 테넌트 삭제
  const handleDelete = (tenant: TenantSummary) => {
    setSelectedTenant(tenant);
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleDeleteConfirm = async () => {
    if (!selectedTenant || !dataService) return;

    try {
      setLoading(true);
      await dataService.deleteTenant(selectedTenant.tenant_id);
      
      setSnackbarMessage(`테넌트 '${selectedTenant.tenant_id}' 삭제 완료!`);
      setSnackbarOpen(true);
      setDeleteDialogOpen(false);
      onRefresh();
    } catch (error) {
      setSnackbarMessage(`삭제 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  };

  // 테넌트 상태 변경
  const handleStatusChange = async (tenantId: string, newStatus: string) => {
    if (!dataService) return;

    try {
      setLoading(true);
      await dataService.updateTenantStatus(tenantId, newStatus);
      
      setSnackbarMessage(`테넌트 상태가 '${newStatus}'로 변경되었습니다.`);
      setSnackbarOpen(true);
      onRefresh();
    } catch (error) {
      setSnackbarMessage(`상태 변경 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
    handleMenuClose();
  };

  // 데이터 내보내기 (데모 모드만)
  const handleExport = async () => {
    if (!isDemoMode || !dataService || !('exportData' in dataService)) return;

    try {
      const data = await dataService.exportData!();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ecp-ai-demo-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setSnackbarMessage('데모 데이터 내보내기 완료!');
      setSnackbarOpen(true);
    } catch (error) {
      setSnackbarMessage(`내보내기 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      setSnackbarOpen(true);
    }
  };

  // 데이터 가져오기 (데모 모드만)
  const handleImport = async () => {
    if (!isDemoMode || !dataService || !('importData' in dataService) || !importData.trim()) return;

    try {
      setLoading(true);
      await dataService.importData!(importData);
      
      setSnackbarMessage('데모 데이터 가져오기 완료!');
      setSnackbarOpen(true);
      setImportDialogOpen(false);
      setImportData('');
      onRefresh();
    } catch (error) {
      setSnackbarMessage(`가져오기 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  };

  // 데이터 초기화 (데모 모드만)
  const handleReset = async () => {
    if (!isDemoMode || !dataService || !('resetData' in dataService)) return;

    if (!window.confirm('모든 사용자 생성 테넌트가 삭제됩니다. 계속하시겠습니까?')) {
      return;
    }

    try {
      setLoading(true);
      await dataService.resetData!();
      
      setSnackbarMessage('데모 데이터 초기화 완료!');
      setSnackbarOpen(true);
      onRefresh();
    } catch (error) {
      setSnackbarMessage(`초기화 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const getPresetColor = (preset: string) => {
    switch (preset) {
      case 'micro': return 'info';
      case 'small': return 'success';
      case 'medium': return 'warning';
      case 'large': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box>
      {/* 헤더 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          📋 테넌트 관리
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="새로고침">
            <IconButton onClick={onRefresh} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          
          {/* 데모 모드 전용 기능 */}
          {isDemoMode && (
            <>
              <Tooltip title="데이터 내보내기">
                <IconButton onClick={handleExport}>
                  <ExportIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="데이터 가져오기">
                <IconButton onClick={() => setImportDialogOpen(true)}>
                  <ImportIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="데이터 초기화">
                <IconButton onClick={handleReset} color="error">
                  <ResetIcon />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
      </Box>

      {/* 테넌트 목록 - [advice from AI] 순수 조회/관리 기능만 유지 */}
      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : tenants.length > 0 ? (
        <Grid container spacing={2}>
          {tenants.map((tenant) => (
            <Grid item xs={12} md={6} lg={4} key={tenant.tenant_id}>
              <StyledCard onClick={() => onTenantSelect?.(tenant.tenant_id)}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" gutterBottom>
                        {tenant.name || tenant.tenant_id}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        ID: {tenant.tenant_id}
                      </Typography>
                    </Box>
                    
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, tenant.tenant_id)}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    <StatusChip 
                      label={tenant.status} 
                      size="small" 
                      status={tenant.status}
                    />
                    <Chip 
                      label={tenant.preset.toUpperCase()} 
                      size="small" 
                      color={getPresetColor(tenant.preset) as any}
                      variant="outlined"
                    />
                    {tenant.dataSource === 'user_created' && (
                      <Chip 
                        label="사용자 생성" 
                        size="small" 
                        color="primary"
                        variant="outlined"
                      />
                    )}
                  </Box>

                  <Typography variant="body2" color="text.secondary">
                    서비스: {tenant.services_count}개
                  </Typography>
                  <Typography variant="caption" display="block" color="text.secondary">
                    생성: {new Date(tenant.created_at).toLocaleDateString()}
                  </Typography>
                </CardContent>
              </StyledCard>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Alert severity="info">
          <AlertTitle>테넌트가 없습니다</AlertTitle>
          등록된 테넌트가 없습니다. 테넌트 생성 탭에서 새로운 테넌트를 생성하세요.
        </Alert>
      )}

      {/* 컨텍스트 메뉴 */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItemComponent onClick={() => {
          const tenant = tenants.find(t => t.tenant_id === menuTenantId);
          if (tenant) onTenantSelect?.(tenant.tenant_id);
          handleMenuClose();
        }}>
          <ViewIcon sx={{ mr: 1 }} />
          상세 보기
        </MenuItemComponent>
        
        <MenuItemComponent onClick={() => {
          const tenant = tenants.find(t => t.tenant_id === menuTenantId);
          if (tenant) handleEdit(tenant);
        }}>
          <EditIcon sx={{ mr: 1 }} />
          편집
        </MenuItemComponent>
        
        <Divider />
        
        <MenuItemComponent onClick={() => handleStatusChange(menuTenantId!, 'running')}>
          <StartIcon sx={{ mr: 1 }} />
          시작
        </MenuItemComponent>
        
        <MenuItemComponent onClick={() => handleStatusChange(menuTenantId!, 'stopped')}>
          <StopIcon sx={{ mr: 1 }} />
          중지
        </MenuItemComponent>
        
        <Divider />
        
        <MenuItemComponent 
          onClick={() => {
            const tenant = tenants.find(t => t.tenant_id === menuTenantId);
            if (tenant) handleDelete(tenant);
          }}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1 }} />
          삭제
        </MenuItemComponent>
      </Menu>

      {/* 편집 다이얼로그 */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>테넌트 편집</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="테넌트 이름"
              value={editForm.name}
              onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
            />
            
            <FormControl fullWidth>
              <InputLabel>상태</InputLabel>
              <Select
                value={editForm.status}
                label="상태"
                onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
              >
                <MenuItem value="running">실행 중</MenuItem>
                <MenuItem value="stopped">중지됨</MenuItem>
                <MenuItem value="pending">대기 중</MenuItem>
              </Select>
            </FormControl>
            
            <FormControl fullWidth>
              <InputLabel>프리셋</InputLabel>
              <Select
                value={editForm.preset}
                label="프리셋"
                onChange={(e) => setEditForm(prev => ({ ...prev, preset: e.target.value }))}
              >
                <MenuItem value="micro">Micro</MenuItem>
                <MenuItem value="small">Small</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="large">Large</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>취소</Button>
          <Button onClick={handleEditSave} variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={20} /> : '저장'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>테넌트 삭제</DialogTitle>
        <DialogContent>
          <Typography>
            테넌트 '{selectedTenant?.tenant_id}'를 정말 삭제하시겠습니까?
            이 작업은 되돌릴 수 없습니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>취소</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={20} /> : '삭제'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 데이터 가져오기 다이얼로그 */}
      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>데모 데이터 가져오기</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Alert severity="warning" sx={{ mb: 2 }}>
              기존 데이터가 모두 대체됩니다. 백업을 권장합니다.
            </Alert>
            <TextField
              label="JSON 데이터"
              multiline
              rows={10}
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              fullWidth
              placeholder="내보낸 JSON 데이터를 여기에 붙여넣으세요..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>취소</Button>
          <Button onClick={handleImport} variant="contained" disabled={loading || !importData.trim()}>
            {loading ? <CircularProgress size={20} /> : '가져오기'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 스낵바 알림 */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
      />
    </Box>
  );
};

export default TenantManager;
