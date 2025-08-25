import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert
} from '@mui/material';
import ManifestPreview from './ManifestPreview.tsx';

const ManifestPreviewTest: React.FC = () => {
  const [tenantId, setTenantId] = useState('test-tenant-123');
  const [serviceRequirements, setServiceRequirements] = useState({
    callbot: 5,
    chatbot: 3,
    advisor: 2,
    stt: 1,
    tts: 1,
    ta: 1,
    qa: 1
  });
  const [gpuType, setGpuType] = useState('t4');
  const [showPreview, setShowPreview] = useState(false);

  const handleShowPreview = () => {
    setShowPreview(true);
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, margin: '0 auto' }}>
      <Typography variant="h4" gutterBottom sx={{ color: 'primary.main', mb: 3 }}>
        🧪 ManifestPreview 컴포넌트 테스트
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body1">
          이 페이지는 ManifestPreview 컴포넌트가 제대로 작동하는지 테스트하기 위한 페이지입니다.
          아래 설정을 조정하고 '매니페스트 미리보기 보기' 버튼을 클릭하여 테스트할 수 있습니다.
        </Typography>
      </Alert>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            테스트 설정
          </Typography>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 2 }}>
            <TextField
              label="테넌트 ID"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              fullWidth
            />
            
            <FormControl fullWidth>
              <InputLabel>GPU 타입</InputLabel>
              <Select
                value={gpuType}
                label="GPU 타입"
                onChange={(e) => setGpuType(e.target.value)}
              >
                <MenuItem value="t4">T4</MenuItem>
                <MenuItem value="v100">V100</MenuItem>
                <MenuItem value="l40s">L40S</MenuItem>
                <MenuItem value="auto">자동</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Typography variant="subtitle2" gutterBottom>
            서비스 요구사항:
          </Typography>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 2 }}>
            <TextField
              label="Callbot 채널"
              type="number"
              value={serviceRequirements.callbot}
              onChange={(e) => setServiceRequirements(prev => ({ ...prev, callbot: parseInt(e.target.value) || 0 }))}
              fullWidth
            />
            <TextField
              label="Chatbot 사용자"
              type="number"
              value={serviceRequirements.chatbot}
              onChange={(e) => setServiceRequirements(prev => ({ ...prev, chatbot: parseInt(e.target.value) || 0 }))}
              fullWidth
            />
            <TextField
              label="Advisor 상담사"
              type="number"
              value={serviceRequirements.advisor}
              onChange={(e) => setServiceRequirements(prev => ({ ...prev, advisor: parseInt(e.target.value) || 0 }))}
              fullWidth
            />
            <TextField
              label="STT 채널"
              type="number"
              value={serviceRequirements.stt}
              onChange={(e) => setServiceRequirements(prev => ({ ...prev, stt: parseInt(e.target.value) || 0 }))}
              fullWidth
            />
            <TextField
              label="TTS 채널"
              type="number"
              value={serviceRequirements.tts}
              onChange={(e) => setServiceRequirements(prev => ({ ...prev, tts: parseInt(e.target.value) || 0 }))}
              fullWidth
            />
            <TextField
              label="TA 분석"
              type="number"
              value={serviceRequirements.ta}
              onChange={(e) => setServiceRequirements(prev => ({ ...prev, ta: parseInt(e.target.value) || 0 }))}
              fullWidth
            />
            <TextField
              label="QA 품질관리"
              type="number"
              value={serviceRequirements.qa}
              onChange={(e) => setServiceRequirements(prev => ({ ...prev, qa: parseInt(e.target.value) || 0 }))}
              fullWidth
            />
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Button
          variant="contained"
          size="large"
          onClick={handleShowPreview}
          sx={{ px: 4, py: 1.5 }}
        >
          🚀 매니페스트 미리보기 보기
        </Button>
      </Box>

      {showPreview && (
        <Card sx={{ border: '2px solid', borderColor: 'success.main' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ color: 'success.main' }}>
              ✅ ManifestPreview 컴포넌트 실행 중...
            </Typography>
            
            <ManifestPreview
              tenantId={tenantId}
              serviceRequirements={serviceRequirements}
              gpuType={gpuType}
            />
          </CardContent>
        </Card>
      )}

      <Box sx={{ mt: 4, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
        <Typography variant="h6" gutterBottom>
          📋 테스트 체크리스트
        </Typography>
        <Typography variant="body2" component="div">
          <ul>
            <li>✅ ManifestPreview 컴포넌트가 렌더링되는가?</li>
            <li>✅ API 호출이 정상적으로 작동하는가?</li>
            <li>✅ 이미지 매칭 정보가 표시되는가?</li>
            <li>✅ 매니페스트 수정 가능 여부가 표시되는가?</li>
            <li>✅ Kubernetes 고급 설정이 상세히 표시되는가?</li>
            <li>✅ 매니페스트 파일 수정 기능이 작동하는가?</li>
          </ul>
        </Typography>
      </Box>
    </Box>
  );
};

export default ManifestPreviewTest;
