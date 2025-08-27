import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  TextField,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Visibility as VisibilityIcon,
  Build as BuildIcon,
  Storage as StorageIcon,
  Memory as MemoryIcon,
  Speed as SpeedIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';

interface ManifestPreviewProps {
  tenantId: string;
  serviceRequirements: any;
  gpuType: string;
}

interface ImageMatchingInfo {
  service_name: string;
  manifest_file: string;
  container_name: string;
  current_image: string;
  ports: any[];
  resources: any;
  service_config: any;
  kubernetes_config: any;
}

interface ManifestPreviewData {
  tenant_id: string;
  manifest_files: string[];
  image_matching_info: ImageMatchingInfo[];
  manifest_editability: {
    can_edit: boolean;
    edit_reasons: string[];
    edit_restrictions: string[];
  };
  service_configs: any;
  environment_configs: any;
}

const ManifestPreview: React.FC<ManifestPreviewProps> = ({
  tenantId,
  serviceRequirements,
  gpuType
}) => {
  const [manifestData, setManifestData] = useState<ManifestPreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<string>('');
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (tenantId && serviceRequirements) {
      fetchManifestPreview();
    }
  }, [tenantId, serviceRequirements, gpuType]);

  const fetchManifestPreview = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // [advice from AI] manifest-preview 엔드포인트 사용 - 올바른 백엔드 주소 사용
      const response = await fetch(`http://localhost:8001/api/v1/tenants/${tenantId}/manifest-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callbot: serviceRequirements.callbot || 0,
          chatbot: serviceRequirements.chatbot || 0,
          advisor: serviceRequirements.advisor || 0,
          stt: serviceRequirements.stt || 0,
          tts: serviceRequirements.tts || 0,
          ta: serviceRequirements.ta || 0,
          qa: serviceRequirements.qa || 0,
          gpu_type: gpuType
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || '매니페스트 생성 실패');
      }
      
      const data = await response.json();
      
      // [advice from AI] 응답 데이터를 ManifestPreviewData 형식에 맞게 변환
      const transformedData: ManifestPreviewData = {
        tenant_id: tenantId,
        manifest_files: Object.keys(data.manifests || {}),
        image_matching_info: data.image_matching_info || [],
        manifest_editability: {
          can_edit: true,
          edit_reasons: ['매니페스트 수정이 가능합니다'],
          edit_restrictions: []
        },
        service_configs: data.service_configs || {},
        environment_configs: data.environment_configs || {}
      };
      
      setManifestData(transformedData);
      
    } catch (err) {
      console.error('매니페스트 생성 에러:', err);
      
      // [advice from AI] 더 자세한 에러 메시지 제공
      let errorMessage = '알 수 없는 오류가 발생했습니다.';
      
      if (err instanceof Error) {
        if (err.message.includes('Failed to fetch')) {
          errorMessage = '백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.';
        } else if (err.message.includes('매니페스트 생성 실패')) {
          errorMessage = '매니페스트 생성 중 오류가 발생했습니다. 서비스 요구사항을 확인해주세요.';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditManifest = (filename: string, content: string) => {
    setEditingFile(filename);
    setEditedContent(content);
  };

  const handleSaveManifest = async () => {
    if (!editingFile || !editedContent) return;
    
    try {
      const response = await fetch(`http://localhost:8001/api/v1/tenants/${tenantId}/update-manifest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [editingFile]: editedContent
        })
      });
      
      if (!response.ok) {
        throw new Error('매니페스트 수정 실패');
      }
      
      const result = await response.json();
      
      if (result.success) {
        setEditSuccess('매니페스트가 성공적으로 수정되었습니다.');
        setEditingFile(null);
        setEditedContent('');
        // 매니페스트 미리보기 새로고침
        setTimeout(() => fetchManifestPreview(), 1000);
      } else {
        setError(`매니페스트 수정 실패: ${result.message}`);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    }
  };

  const handleCancelEdit = () => {
    setEditingFile(null);
    setEditedContent('');
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          오류 발생
        </Typography>
        <Typography variant="body2">
          {error}
        </Typography>
      </Alert>
    );
  }

  if (!manifestData) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          매니페스트 정보를 불러오는 중입니다.
        </Typography>
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom sx={{ mb: 3, color: 'primary.main' }}>
        📋 8단계: 매니페스트 생성 및 확인
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Kubernetes 매니페스트를 생성하고 생성된 파일들의 내용을 확인합니다. 
        필요한 경우 최종 수정을 할 수 있습니다.
      </Typography>

      {/* 매니페스트 수정 가능 여부 정보 */}
      <Card sx={{ mb: 3, bgcolor: 'background.paper' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
            🔧 매니페스트 수정 가능 여부
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <CheckCircleIcon color="success" sx={{ mr: 1 }} />
                <Typography variant="body2" color="success.main">
                  수정 가능: {manifestData.manifest_editability.can_edit ? '예' : '아니오'}
                </Typography>
              </Box>
              
              <Typography variant="subtitle2" gutterBottom>
                수정 가능한 이유:
              </Typography>
              <List dense>
                {manifestData.manifest_editability.edit_reasons.map((reason, index) => (
                  <ListItem key={index} sx={{ py: 0 }}>
                    <ListItemIcon sx={{ minWidth: 24 }}>
                      <InfoIcon color="info" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary={reason} />
                  </ListItem>
                ))}
              </List>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                수정 제한사항:
              </Typography>
              <List dense>
                {manifestData.manifest_editability.edit_restrictions.map((restriction, index) => (
                  <ListItem key={index} sx={{ py: 0 }}>
                    <ListItemIcon sx={{ minWidth: 24 }}>
                      <WarningIcon color="warning" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary={restriction} />
                  </ListItem>
                ))}
              </List>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 이미지 매칭 정보 */}
      <Card sx={{ mb: 3, bgcolor: 'background.paper' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
            🖼️ 이미지 매칭 정보
          </Typography>
          
          <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white' }}>
                    서비스
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white' }}>
                    매니페스트 파일
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white' }}>
                    현재 이미지
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white' }}>
                    Dockerfile 경로
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white' }}>
                    베이스 이미지
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: 'primary.main', color: 'white' }}>
                    최적화 레벨
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {manifestData.image_matching_info.map((info, index) => (
                  <TableRow key={index} hover>
                    <TableCell>
                      <Chip 
                        label={info.service_name} 
                        size="small" 
                        color="primary" 
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {info.manifest_file}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {info.current_image}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {info.service_config?.dockerfile_path || 'unknown'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {info.service_config?.base_image || 'unknown'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={info.service_config?.optimization_level || 'unknown'} 
                        size="small" 
                        color="secondary" 
                        variant="outlined"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Kubernetes 설정 상세 정보 */}
      <Accordion defaultExpanded sx={{ mb: 3 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6" sx={{ color: 'primary.main' }}>
            ⚙️ Kubernetes 고급 설정 상세
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            {manifestData.image_matching_info.map((info, index) => (
              <Grid item xs={12} key={index}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ color: 'primary.main' }}>
                      {info.service_name} 서비스 설정
                    </Typography>
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" gutterBottom>
                          오토스케일링 설정:
                        </Typography>
                        <Box sx={{ pl: 2 }}>
                          <Typography variant="body2">
                            활성화: {info.kubernetes_config?.auto_scaling?.enabled ? '예' : '아니오'}
                          </Typography>
                          <Typography variant="body2">
                            최소 레플리카: {info.kubernetes_config?.auto_scaling?.min_replicas || 'N/A'}
                          </Typography>
                          <Typography variant="body2">
                            최대 레플리카: {info.kubernetes_config?.auto_scaling?.max_replicas || 'N/A'}
                          </Typography>
                        </Box>
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" gutterBottom>
                          리소스 설정:
                        </Typography>
                        <Box sx={{ pl: 2 }}>
                          <Typography variant="body2">
                            CPU 요청: {info.resources?.requests?.cpu || 'N/A'}
                          </Typography>
                          <Typography variant="body2">
                            메모리 요청: {info.resources?.requests?.memory || 'N/A'}
                          </Typography>
                          <Typography variant="body2">
                            CPU 제한: {info.resources?.limits?.cpu || 'N/A'}
                          </Typography>
                          <Typography variant="body2">
                            메모리 제한: {info.resources?.limits?.memory || 'N/A'}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* 매니페스트 파일 목록 및 수정 */}
      <Accordion sx={{ mb: 3 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6" sx={{ color: 'success.main' }}>
            📝 매니페스트 파일 수정
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            아래 매니페스트 파일들을 확인하고 필요한 경우 수정할 수 있습니다.
          </Typography>
          
          {manifestData.manifest_files.map((filename) => (
            <Card key={filename} variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ fontFamily: 'monospace' }}>
                    {filename}
                  </Typography>
                  
                  {editingFile === filename ? (
                    <Box>
                      <Tooltip title="저장">
                        <IconButton 
                          color="primary" 
                          onClick={handleSaveManifest}
                          size="small"
                        >
                          <SaveIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="취소">
                        <IconButton 
                          color="secondary" 
                          onClick={handleCancelEdit}
                          size="small"
                        >
                          <CancelIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  ) : (
                    <Tooltip title="수정">
                      <IconButton 
                        color="primary" 
                        onClick={() => handleEditManifest(filename, '')}
                        size="small"
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
                
                {editingFile === filename ? (
                  <TextField
                    fullWidth
                    multiline
                    rows={10}
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    variant="outlined"
                    placeholder="매니페스트 내용을 입력하세요..."
                    sx={{ fontFamily: 'monospace' }}
                  />
                ) : (
                  <Box sx={{ 
                    bgcolor: 'grey.100', 
                    p: 2, 
                    borderRadius: 1,
                    fontFamily: 'monospace',
                    fontSize: '0.875rem'
                  }}>
                    <Typography variant="body2" color="text.secondary">
                      파일을 수정하려면 편집 버튼을 클릭하세요.
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          ))}
        </AccordionDetails>
      </Accordion>

      {/* 성공/오류 메시지 */}
      {editSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {editSuccess}
        </Alert>
      )}

      {/* 새로고침 버튼 */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
        <Button
          variant="outlined"
          onClick={fetchManifestPreview}
          startIcon={<VisibilityIcon />}
        >
          매니페스트 정보 새로고침
        </Button>
      </Box>
    </Box>
  );
};

export default ManifestPreview;
