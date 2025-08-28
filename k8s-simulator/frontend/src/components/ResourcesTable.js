// [advice from AI] K8S 리소스 관리 테이블 컴포넌트
import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  Tooltip,
  CircularProgress
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import { useApi } from '../hooks/useApi';

const ResourcesTable = () => {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, resource: null });
  const [detailDialog, setDetailDialog] = useState({ open: false, resource: null });
  const [filters, setFilters] = useState({
    namespace: '',
    kind: ''
  });

  const { get, delete: deleteResource } = useApi();

  const resourceKinds = ['Pod', 'Service', 'Deployment', 'ConfigMap', 'Secret'];
  const namespaces = ['default', 'kube-system', 'monitoring'];

  useEffect(() => {
    loadResources();
  }, []);

  const loadResources = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (filters.namespace) params.append('namespace', filters.namespace);
      if (filters.kind) params.append('kind', filters.kind);
      
      const result = await get(`/k8s/resources?${params.toString()}`);
      setResources(result.resources || []);
      
    } catch (err) {
      setError(`리소스 로드 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteResource = async (resource) => {
    try {
      setError(null);
      await deleteResource(`/k8s/resources/${resource.namespace}/${resource.kind}/${resource.name}`);
      
      // 리소스 목록에서 제거
      setResources(prev => prev.filter(r => r.id !== resource.id));
      setDeleteDialog({ open: false, resource: null });
      
    } catch (err) {
      setError(`리소스 삭제 실패: ${err.message}`);
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'running':
        return 'success';
      case 'pending':
        return 'warning';
      case 'failed':
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatCreatedAt = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  const getResourceIcon = (kind) => {
    const icons = {
      'Pod': '🔵',
      'Service': '🌐',
      'Deployment': '📦',
      'ConfigMap': '⚙️',
      'Secret': '🔐'
    };
    return icons[kind] || '📄';
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">
          K8S 리소스 관리
        </Typography>
        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
          onClick={loadResources}
          disabled={loading}
        >
          새로고침
        </Button>
      </Box>

      {/* 필터 섹션 */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" alignItems="center" gap={2}>
          <FilterIcon />
          <Typography variant="h6">필터</Typography>
          
          <TextField
            select
            label="네임스페이스"
            value={filters.namespace}
            onChange={(e) => setFilters(prev => ({ ...prev, namespace: e.target.value }))}
            size="small"
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">전체</MenuItem>
            {namespaces.map(ns => (
              <MenuItem key={ns} value={ns}>{ns}</MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="리소스 타입"
            value={filters.kind}
            onChange={(e) => setFilters(prev => ({ ...prev, kind: e.target.value }))}
            size="small"
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">전체</MenuItem>
            {resourceKinds.map(kind => (
              <MenuItem key={kind} value={kind}>{kind}</MenuItem>
            ))}
          </TextField>

          <Button variant="contained" onClick={loadResources}>
            적용
          </Button>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* 리소스 테이블 */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>타입</TableCell>
              <TableCell>이름</TableCell>
              <TableCell>네임스페이스</TableCell>
              <TableCell>상태</TableCell>
              <TableCell>생성 시간</TableCell>
              <TableCell>추가 정보</TableCell>
              <TableCell align="right">작업</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : resources.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography color="textSecondary">
                    배포된 리소스가 없습니다.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              resources.map((resource, index) => (
                <TableRow key={resource.id || index} hover>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <span>{getResourceIcon(resource.kind)}</span>
                      <Typography variant="body2" fontWeight="bold">
                        {resource.kind}
                      </Typography>
                    </Box>
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {resource.name}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Chip 
                      label={resource.namespace} 
                      size="small" 
                      variant="outlined"
                    />
                  </TableCell>
                  
                  <TableCell>
                    <Chip
                      label={resource.status || 'Unknown'}
                      color={getStatusColor(resource.status)}
                      size="small"
                    />
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2" color="textSecondary">
                      {formatCreatedAt(resource.created_at)}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    {resource.kind === 'Pod' && (
                      <Typography variant="caption">
                        Node: {resource.node || 'N/A'}
                      </Typography>
                    )}
                    {resource.kind === 'Service' && (
                      <Typography variant="caption">
                        Type: {resource.type || 'N/A'}
                      </Typography>
                    )}
                    {resource.kind === 'Deployment' && (
                      <Typography variant="caption">
                        {resource.ready_replicas || 0}/{resource.replicas || 0} Ready
                      </Typography>
                    )}
                  </TableCell>
                  
                  <TableCell align="right">
                    <Tooltip title="상세 보기">
                      <IconButton
                        size="small"
                        onClick={() => setDetailDialog({ open: true, resource })}
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                    
                    <Tooltip title="삭제">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setDeleteDialog({ open: true, resource })}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, resource: null })}
      >
        <DialogTitle>리소스 삭제 확인</DialogTitle>
        <DialogContent>
          <Typography>
            다음 리소스를 삭제하시겠습니까?
          </Typography>
          <Box mt={2} p={2} bgcolor="grey.100" borderRadius={1}>
            <Typography variant="body2">
              <strong>타입:</strong> {deleteDialog.resource?.kind}
            </Typography>
            <Typography variant="body2">
              <strong>이름:</strong> {deleteDialog.resource?.name}
            </Typography>
            <Typography variant="body2">
              <strong>네임스페이스:</strong> {deleteDialog.resource?.namespace}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, resource: null })}>
            취소
          </Button>
          <Button 
            color="error" 
            variant="contained"
            onClick={() => handleDeleteResource(deleteDialog.resource)}
          >
            삭제
          </Button>
        </DialogActions>
      </Dialog>

      {/* 상세 정보 다이얼로그 */}
      <Dialog
        open={detailDialog.open}
        onClose={() => setDetailDialog({ open: false, resource: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          리소스 상세 정보: {detailDialog.resource?.name}
        </DialogTitle>
        <DialogContent>
          {detailDialog.resource && (
            <Box>
              <Typography variant="h6" gutterBottom>기본 정보</Typography>
              <Box mb={3} p={2} bgcolor="grey.50" borderRadius={1}>
                <Typography variant="body2" paragraph>
                  <strong>ID:</strong> {detailDialog.resource.id}
                </Typography>
                <Typography variant="body2" paragraph>
                  <strong>타입:</strong> {detailDialog.resource.kind}
                </Typography>
                <Typography variant="body2" paragraph>
                  <strong>이름:</strong> {detailDialog.resource.name}
                </Typography>
                <Typography variant="body2" paragraph>
                  <strong>네임스페이스:</strong> {detailDialog.resource.namespace}
                </Typography>
                <Typography variant="body2" paragraph>
                  <strong>상태:</strong> {detailDialog.resource.status}
                </Typography>
                <Typography variant="body2">
                  <strong>생성 시간:</strong> {formatCreatedAt(detailDialog.resource.created_at)}
                </Typography>
              </Box>

              {detailDialog.resource.manifest && (
                <>
                  <Typography variant="h6" gutterBottom>매니페스트</Typography>
                  <Box 
                    component="pre" 
                    sx={{ 
                      bgcolor: 'grey.900', 
                      color: 'white', 
                      p: 2, 
                      borderRadius: 1,
                      overflow: 'auto',
                      fontSize: '0.8rem'
                    }}
                  >
                    {JSON.stringify(detailDialog.resource.manifest, null, 2)}
                  </Box>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialog({ open: false, resource: null })}>
            닫기
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ResourcesTable;
