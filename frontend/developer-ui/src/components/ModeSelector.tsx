import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Container,
  Paper,
  Chip,
  Alert,
  AlertTitle
} from '@mui/material';
import {
  PlayArrow as DemoIcon,
  Cloud as ProductionIcon,
  Info as InfoIcon
} from '@mui/icons-material';

interface ModeSelectorProps {
  onModeSelect: (isDemoMode: boolean) => void;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({ onModeSelect }) => {
  const handleModeSelect = (isDemoMode: boolean) => {
    // 선택한 모드를 로컬 스토리지에 저장
    localStorage.setItem('ecp-ai-demo-mode', JSON.stringify(isDemoMode));
    // 모드 선택 후 앱 실행
    onModeSelect(isDemoMode);
  };

  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Box sx={{ textAlign: 'center', mb: 6 }}>
        <Typography variant="h3" component="h1" gutterBottom color="primary">
          ECP-AI Kubernetes Orchestrator
        </Typography>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Kubernetes 클러스터 관리 및 테넌시 오케스트레이션 시스템
        </Typography>
        <Typography variant="body1" color="text.secondary">
          시작하기 전에 사용할 모드를 선택해주세요
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
        {/* 데모 모드 카드 */}
        <Card 
          sx={{ 
            width: 320, 
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            '&:hover': {
              transform: 'translateY(-8px)',
              boxShadow: 8
            }
          }}
          onClick={() => handleModeSelect(true)}
        >
          <CardContent sx={{ textAlign: 'center', p: 4 }}>
            <DemoIcon sx={{ fontSize: 64, color: 'secondary.main', mb: 2 }} />
            <Typography variant="h5" component="h2" gutterBottom>
              데모 모드
            </Typography>
            <Chip 
              label="개발 및 테스트용" 
              color="secondary" 
              size="small" 
              sx={{ mb: 2 }}
            />
            <Typography variant="body2" color="text.secondary" paragraph>
              실제 서버 없이도 모든 기능을 테스트할 수 있습니다.
            </Typography>
            
            <Box sx={{ textAlign: 'left', mb: 3 }}>
              <Typography variant="body2" component="div" sx={{ mb: 1 }}>
                ✅ 테넌시 생성 및 DB 관리
              </Typography>
              <Typography variant="body2" component="div" sx={{ mb: 1 }}>
                ✅ 매니페스트 생성 및 사용
              </Typography>
              <Typography variant="body2" component="div" sx={{ mb: 1 }}>
                ✅ 가상 데이터로 기능 테스트
              </Typography>
              <Typography variant="body2" component="div">
                ✅ 설정 연습 및 학습
              </Typography>
            </Box>

            <Button 
              variant="contained" 
              color="secondary" 
              size="large"
              fullWidth
              startIcon={<DemoIcon />}
            >
              데모 모드로 시작
            </Button>
          </CardContent>
        </Card>

        {/* 실사용 모드 카드 */}
        <Card 
          sx={{ 
            width: 320, 
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            '&:hover': {
              transform: 'translateY(-8px)',
              boxShadow: 8
            }
          }}
          onClick={() => handleModeSelect(false)}
        >
          <CardContent sx={{ textAlign: 'center', p: 4 }}>
            <ProductionIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h5" component="h2" gutterBottom>
              실사용 모드
            </Typography>
            <Chip 
              label="프로덕션 환경" 
              color="primary" 
              size="small" 
              sx={{ mb: 2 }}
            />
            <Typography variant="body2" color="text.secondary" paragraph>
              실제 Kubernetes 클러스터와 연결하여 운영합니다.
            </Typography>
            
            <Box sx={{ textAlign: 'left', mb: 3 }}>
              <Typography variant="body2" component="div" sx={{ mb: 1 }}>
                ✅ 실제 클러스터 연결
              </Typography>
              <Typography variant="body2" component="div" sx={{ mb: 1 }}>
                ✅ 실제 테넌시 배포
              </Typography>
              <Typography variant="body2" component="div" sx={{ mb: 1 }}>
                ✅ 실제 모니터링 데이터
              </Typography>
              <Typography variant="body2" component="div">
                ✅ 프로덕션 설정 적용
              </Typography>
            </Box>

            <Button 
              variant="contained" 
              color="primary" 
              size="large"
              fullWidth
              startIcon={<ProductionIcon />}
            >
              실사용 모드로 시작
            </Button>
          </CardContent>
        </Card>
      </Box>

      {/* 정보 알림 */}
      <Paper sx={{ p: 3, mt: 4, backgroundColor: 'info.50' }}>
        <Alert severity="info" icon={<InfoIcon />}>
          <AlertTitle>💡 모드 전환 안내</AlertTitle>
          <Typography variant="body2">
            모드 전환이 필요한 경우, 설정 탭에서 모드를 변경한 후 페이지를 새로고침하면 됩니다. 
            데모 모드에서 생성한 테넌시와 매니페스트는 DB에 저장되며, 실사용 모드에서도 확인할 수 있습니다.
          </Typography>
        </Alert>
      </Paper>
    </Container>
  );
};
