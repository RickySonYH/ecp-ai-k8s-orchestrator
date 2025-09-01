// [advice from AI] 테넌트 리스트 컴포넌트 - 순수 조회/관리 기능만
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
  Snackbar
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
  Visibility as ViewIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import TenantDataServiceFactory, { TenantDataServiceInterface } from '../services/TenantDataService.ts';

// 타입 정의
interface TenantSummary {
  tenant_id: string;
  name?: string;
  status: string;
  preset: string;
  is_demo: boolean;
  services_count: number;
  created_at: string;
  dataSource?: string;
}

interface TenantListProps {
  isDemoMode?: boolean;
  tenants: TenantSummary[];
  onRefresh: () => void;
  onTenantSelect?: (tenantId: string) => void;
}

// 스타일드 컴포넌트
const StyledCard = styled(Card)(({ theme }) => ({
  cursor: 'pointer',
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[4],
  },
}));

const StatusChip = styled(Chip)<{ status: string }>(({ theme, status }) => ({
  fontWeight: 'bold',
  ...(status === 'running' && {
    backgroundColor: theme.palette.success.main,
    color: theme.palette.success.contrastText,
  }),
  ...(status === 'stopped' && {
    backgroundColor: theme.palette.error.main,
    color: theme.palette.error.contrastText,
  }),
  ...(status === 'pending' && {
    backgroundColor: theme.palette.warning.main,
    color: theme.palette.warning.contrastText,
  }),
}));

const TenantList: React.FC<TenantListProps> = ({
  isDemoMode = false,
  tenants,
  onRefresh,
  onTenantSelect
}) => {
  // 상태 관리
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

  // 유틸리티 함수들
  const getPresetColor = (preset: string) => {
    switch (preset) {
      case 'micro': return 'default';
      case 'small': return 'primary';
      case 'medium': return 'secondary';
      case 'large': return 'error';
      default: return 'default';
    }
  };

  // 이벤트 핸들러
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, tenantId: string) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setMenuTenantId(tenantId);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setMenuTenantId(null);
  };

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

    setLoading(true);
    try {
      await dataService.updateTenant(selectedTenant.tenant_id, {
        name: editForm.name,
        status: editForm.status,
        preset: editForm.preset
      });
      
      setSnackbarMessage('테넌트 정보가 업데이트되었습니다.');
      setSnackbarOpen(true);
      setEditDialogOpen(false);
      onRefresh();
    } catch (error) {
      console.error('테넌트 편집 오류:', error);
      setSnackbarMessage('테넌트 편집 중 오류가 발생했습니다.');
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (tenant: TenantSummary) => {
    setSelectedTenant(tenant);
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleDeleteConfirm = async () => {
    if (!selectedTenant || !dataService) return;

    setLoading(true);
    try {
      await dataService.deleteTenant(selectedTenant.tenant_id);
      setSnackbarMessage(`테넌트 '${selectedTenant.tenant_id}'가 삭제되었습니다.`);
      setSnackbarOpen(true);
      setDeleteDialogOpen(false);
      onRefresh();
    } catch (error) {
      console.error('테넌트 삭제 오류:', error);
      setSnackbarMessage('테넌트 삭제 중 오류가 발생했습니다.');
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (tenantId: string, newStatus: string) => {
    if (!dataService) return;

    setLoading(true);
    try {
      await dataService.updateTenant(tenantId, { status: newStatus });
      setSnackbarMessage(`테넌트 상태가 '${newStatus}'로 변경되었습니다.`);
      setSnackbarOpen(true);
      onRefresh();
    } catch (error) {
      console.error('상태 변경 오류:', error);
      setSnackbarMessage('상태 변경 중 오류가 발생했습니다.');
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
    handleMenuClose();
  };

  // 데모 모드 전용 기능들
  const handleExport = () => {
    const dataStr = JSON.stringify(tenants, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `tenant-data-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImport = async () => {
    if (!dataService) return;

    try {
      const importedData = JSON.parse(importData);
      if (Array.isArray(importedData)) {
        setLoading(true);
        await dataService.importTenants(importedData);
        setSnackbarMessage('데이터 가져오기가 완료되었습니다.');
        setSnackbarOpen(true);
        setImportDialogOpen(false);
        setImportData('');
        onRefresh();
      } else {
        throw new Error('올바른 JSON 배열 형식이 아닙니다.');
      }
    } catch (error) {
      console.error('데이터 가져오기 오류:', error);
      setSnackbarMessage('데이터 가져오기 중 오류가 발생했습니다.');
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!dataService) return;

    if (window.confirm('모든 테넌트 데이터를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      setLoading(true);
      try {
        await dataService.resetAllData();
        setSnackbarMessage('데이터가 초기화되었습니다.');
        setSnackbarOpen(true);
        onRefresh();
      } catch (error) {
        console.error('데이터 초기화 오류:', error);
        setSnackbarMessage('데이터 초기화 중 오류가 발생했습니다.');
        setSnackbarOpen(true);
      } finally {
        setLoading(false);
      }
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

      {/* 테넌트 목록 */}
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
              fullWidth
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder="JSON 형식의 테넌트 데이터를 입력하세요..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>취소</Button>
          <Button onClick={handleImport} variant="contained" disabled={!importData.trim() || loading}>
            {loading ? <CircularProgress size={20} /> : '가져오기'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 스낵바 */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
      />
    </Box>
  );
};

export default TenantList;
