// [advice from AI] CICD 이미지 등록 컴포넌트 - 하드코딩 제거
/**
 * ImageRegistration Component
 * - CICD 이미지 등록 및 관리
 * - 하드코딩 제거, 실제 이미지 등록 기반
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  useTheme,
  alpha
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Category as CategoryIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// 타입 정의
interface CICDImage {
  id: number;
  service_name: string;
  display_name: string;
  image_name: string;
  image_tag: string;
  registry_url: string;
  repository: string;
  category: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CICDStats {
  total_images: number;
  active_images: number;
  inactive_images: number;
  category_stats: Record<string, number>;
  recent_images: Array<{
    service_name: string;
    display_name: string;
    category: string;
    created_at: string;
  }>;
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

const ImageRegistration: React.FC = () => {
  const theme = useTheme();
  const [images, setImages] = useState<CICDImage[]>([]);
  const [stats, setStats] = useState<CICDStats | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingImage, setEditingImage] = useState<CICDImage | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // [advice from AI] 새 이미지 등록 폼
  const [newImage, setNewImage] = useState({
    service_name: '',
    display_name: '',
    image_name: '',
    image_tag: 'latest',
    registry_url: 'harbor.ecp-ai.com',
    repository: '',
    category: 'main',
    description: ''
  });

  useEffect(() => {
    loadImages();
    loadStats();
  }, []);

  const loadImages = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8001/api/v1/cicd/list');
      console.log('API 응답 상태:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('로드된 이미지 데이터:', data);
        setImages(data.images || []);
      } else {
        console.error('API 응답 오류:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('이미지 목록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('http://localhost:8001/api/v1/cicd/stats/overview');
      console.log('통계 API 응답 상태:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('로드된 통계 데이터:', data);
        setStats(data.stats);
      } else {
        console.error('통계 API 응답 오류:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('통계 로드 실패:', error);
    }
  };

  const handleAddImage = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8001/api/v1/cicd/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newImage),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('이미지 등록 성공:', data);
        setDialogOpen(false);
        setNewImage({
          service_name: '',
          display_name: '',
          image_name: '',
          image_tag: 'latest',
          registry_url: 'harbor.ecp-ai.com',
          repository: '',
          category: 'main',
          description: ''
        });
        loadImages();
        loadStats();
      } else {
        const error = await response.json();
        alert(`등록 실패: ${error.detail}`);
      }
    } catch (error) {
      console.error('이미지 등록 실패:', error);
      alert('이미지 등록 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditImage = (image: CICDImage) => {
    setEditingImage(image);
    setNewImage({
      service_name: image.service_name,
      display_name: image.display_name,
      image_name: image.image_name,
      image_tag: image.image_tag,
      registry_url: image.registry_url,
      repository: image.repository,
      category: image.category,
      description: image.description || ''
    });
    setDialogOpen(true);
  };

  const handleUpdateImage = async () => {
    if (!editingImage) return;

    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8001/api/v1/cicd/${editingImage.service_name}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newImage),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('이미지 업데이트 성공:', data);
        setDialogOpen(false);
        setEditingImage(null);
        setNewImage({
          service_name: '',
          display_name: '',
          image_name: '',
          image_tag: 'latest',
          registry_url: 'harbor.ecp-ai.com',
          repository: '',
          category: 'main',
          description: ''
        });
        loadImages();
        loadStats();
      } else {
        const error = await response.json();
        alert(`업데이트 실패: ${error.detail}`);
      }
    } catch (error) {
      console.error('이미지 업데이트 실패:', error);
      alert('이미지 업데이트 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteImage = async (serviceName: string) => {
    if (!confirm(`서비스 '${serviceName}'를 비활성화하시겠습니까?`)) return;

    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8001/api/v1/cicd/${serviceName}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('이미지 비활성화 성공:', data);
        loadImages();
        loadStats();
      } else {
        const error = await response.json();
        alert(`비활성화 실패: ${error.detail}`);
      }
    } catch (error) {
      console.error('이미지 비활성화 실패:', error);
      alert('이미지 비활성화 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'main': return 'primary';
      case 'ai_nlp': return 'secondary';
      case 'analytics': return 'success';
      case 'infrastructure': return 'warning';
      case 'data': return 'info';
      case 'specialized': return 'error';
      default: return 'default';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'main': return '메인 서비스';
      case 'ai_nlp': return 'AI/NLP';
      case 'analytics': return '분석';
      case 'infrastructure': return '인프라';
      case 'data': return '데이터';
      case 'specialized': return '특화';
      default: return category;
    }
  };

  const filteredImages = selectedCategory === 'all' 
    ? images 
    : images.filter(img => img.category === selectedCategory);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
        📦 CICD 이미지 등록 관리
      </Typography>

      {/* 통계 카드 */}
      {stats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={3}>
            <StyledCard>
              <CardContent>
                <Typography variant="h6" color="primary">
                  총 서비스
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                  {stats.total_images}
                </Typography>
              </CardContent>
            </StyledCard>
          </Grid>
          <Grid item xs={12} md={3}>
            <StyledCard>
              <CardContent>
                <Typography variant="h6" color="success.main">
                  활성 서비스
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                  {stats.active_images}
                </Typography>
              </CardContent>
            </StyledCard>
          </Grid>
          <Grid item xs={12} md={3}>
            <StyledCard>
              <CardContent>
                <Typography variant="h6" color="warning.main">
                  비활성 서비스
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                  {stats.inactive_images}
                </Typography>
              </CardContent>
            </StyledCard>
          </Grid>
          <Grid item xs={12} md={3}>
            <StyledCard>
              <CardContent>
                <Typography variant="h6" color="info.main">
                  카테고리
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                  {Object.keys(stats.category_stats).length}
                </Typography>
              </CardContent>
            </StyledCard>
          </Grid>
        </Grid>
      )}

      {/* 카테고리별 통계 */}
      {stats && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            📊 카테고리별 서비스 분포
          </Typography>
          <Grid container spacing={2}>
            {Object.entries(stats.category_stats).map(([category, count]) => (
              <Grid item xs={6} md={2} key={category}>
                <StyledCard>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Chip 
                      label={getCategoryLabel(category)}
                      color={getCategoryColor(category) as any}
                      size="small"
                      sx={{ mb: 1 }}
                    />
                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                      {count}
                    </Typography>
                  </CardContent>
                </StyledCard>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* 필터 및 액션 */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>카테고리 필터</InputLabel>
          <Select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            label="카테고리 필터"
          >
            <MenuItem value="all">전체</MenuItem>
            <MenuItem value="main">메인 서비스</MenuItem>
            <MenuItem value="ai_nlp">AI/NLP</MenuItem>
            <MenuItem value="analytics">분석</MenuItem>
            <MenuItem value="infrastructure">인프라</MenuItem>
            <MenuItem value="data">데이터</MenuItem>
            <MenuItem value="specialized">특화</MenuItem>
          </Select>
        </FormControl>

        <Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => { loadImages(); loadStats(); }}
            sx={{ mr: 2 }}
          >
            새로고침
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditingImage(null);
              setNewImage({
                service_name: '',
                display_name: '',
                image_name: '',
                image_tag: 'latest',
                registry_url: 'harbor.ecp-ai.com',
                repository: '',
                category: 'main',
                description: ''
              });
              setDialogOpen(true);
            }}
          >
            이미지 등록
          </Button>
        </Box>
      </Box>

      {/* 이미지 목록 테이블 */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>서비스명</TableCell>
              <TableCell>표시명</TableCell>
              <TableCell>이미지</TableCell>
              <TableCell>카테고리</TableCell>
              <TableCell>레지스트리</TableCell>
              <TableCell>상태</TableCell>
              <TableCell>등록일</TableCell>
              <TableCell>작업</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredImages.map((image) => (
              <TableRow key={image.id}>
                <TableCell>
                  <Typography variant="subtitle2" sx={{ fontFamily: 'monospace' }}>
                    {image.service_name}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {image.display_name}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {image.image_name}:{image.image_tag}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {image.repository}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip 
                    label={getCategoryLabel(image.category)}
                    color={getCategoryColor(image.category) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {image.registry_url}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip 
                    label={image.is_active ? '활성' : '비활성'}
                    color={image.is_active ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {new Date(image.created_at).toLocaleDateString()}
                  </Typography>
                </TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => handleEditImage(image)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton 
                    size="small" 
                    onClick={() => handleDeleteImage(image.service_name)}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 이미지 등록/수정 다이얼로그 */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingImage ? '이미지 수정' : '이미지 등록'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="서비스명 (영문)"
                value={newImage.service_name}
                onChange={(e) => setNewImage(prev => ({ ...prev, service_name: e.target.value }))}
                disabled={!!editingImage}
                helperText="예: callbot, chatbot, advisor"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="표시명 (한글)"
                value={newImage.display_name}
                onChange={(e) => setNewImage(prev => ({ ...prev, display_name: e.target.value }))}
                helperText="예: Callbot Service (콜봇)"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="이미지명"
                value={newImage.image_name}
                onChange={(e) => setNewImage(prev => ({ ...prev, image_name: e.target.value }))}
                helperText="예: ecp-ai/callbot"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="이미지 태그"
                value={newImage.image_tag}
                onChange={(e) => setNewImage(prev => ({ ...prev, image_tag: e.target.value }))}
                helperText="예: v1.2.3, latest"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="레지스트리 URL"
                value={newImage.registry_url}
                onChange={(e) => setNewImage(prev => ({ ...prev, registry_url: e.target.value }))}
                helperText="예: harbor.ecp-ai.com"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="저장소 경로"
                value={newImage.repository}
                onChange={(e) => setNewImage(prev => ({ ...prev, repository: e.target.value }))}
                helperText="예: ecp-ai/callbot"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>카테고리</InputLabel>
                <Select
                  value={newImage.category}
                  onChange={(e) => setNewImage(prev => ({ ...prev, category: e.target.value }))}
                  label="카테고리"
                >
                  <MenuItem value="main">메인 서비스</MenuItem>
                  <MenuItem value="ai_nlp">AI/NLP</MenuItem>
                  <MenuItem value="analytics">분석</MenuItem>
                  <MenuItem value="infrastructure">인프라</MenuItem>
                  <MenuItem value="data">데이터</MenuItem>
                  <MenuItem value="specialized">특화</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="서비스 설명"
                multiline
                rows={3}
                value={newImage.description}
                onChange={(e) => setNewImage(prev => ({ ...prev, description: e.target.value }))}
                helperText="서비스에 대한 간단한 설명을 입력하세요"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>취소</Button>
          <Button 
            onClick={editingImage ? handleUpdateImage : handleAddImage}
            variant="contained"
            disabled={loading}
          >
            {editingImage ? '수정' : '등록'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ImageRegistration;
