// [advice from AI] 초기 모드 선택 컴포넌트 - 데모모드와 실사용 모드 선택
/**
 * ModeSelector Component
 * - 앱 첫 접속 시 데모모드/실사용 모드 선택
 * - 각 모드의 특징과 차이점 명확히 설명
 * - 선택 후 메인 애플리케이션으로 진입
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Container,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  alpha,
  Fade,
  Zoom
} from '@mui/material';
import {
  PlayArrow as DemoIcon,
  Rocket as ProductionIcon,
  CheckCircle as CheckIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  CloudQueue as CloudIcon,
  Code as CodeIcon,
  Security as SecurityIcon,
  Speed as SpeedIcon,
  Storage as StorageIcon,
  Psychology as AIIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// 타입 정의
interface ModeSelectorProps {
  onModeSelect: (isDemoMode: boolean) => void;
}

interface ModeOption {
  id: 'demo' | 'production';
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  features: Array<{
    icon: React.ReactNode;
    text: string;
    highlight?: boolean;
  }>;
  pros: string[];
  cons: string[];
  recommended: string;
}

// 스타일드 컴포넌트
const StyledContainer = styled(Container)(({ theme }) => ({
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: theme.palette.mode === 'dark'
    ? `linear-gradient(135deg, ${theme.palette.background.default} 0%, ${alpha(theme.palette.primary.main, 0.1)} 50%, ${theme.palette.background.default} 100%)`
    : `linear-gradient(135deg, ${theme.palette.background.default} 0%, ${alpha(theme.palette.primary.main, 0.05)} 50%, ${theme.palette.background.default} 100%)`,
  position: 'relative',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23${theme.palette.primary.main.replace('#', '')}' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
  }
}));

const ModeCard = styled(Card)<{ selected: boolean; modeColor: string }>(({ theme, selected, modeColor }) => ({
  height: '100%',
  cursor: 'pointer',
  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  position: 'relative',
  overflow: 'hidden',
  border: selected 
    ? `3px solid ${modeColor}` 
    : `2px solid ${alpha(theme.palette.divider, 0.2)}`,
  background: theme.palette.mode === 'dark'
    ? `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(modeColor, 0.1)} 100%)`
    : `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${alpha(modeColor, 0.05)} 100%)`,
  boxShadow: selected 
    ? `0 20px 40px ${alpha(modeColor, 0.3)}` 
    : theme.shadows[4],
  transform: selected ? 'translateY(-8px) scale(1.02)' : 'translateY(0) scale(1)',
  '&:hover': {
    transform: selected ? 'translateY(-8px) scale(1.02)' : 'translateY(-4px) scale(1.01)',
    boxShadow: `0 15px 35px ${alpha(modeColor, 0.2)}`,
    border: `2px solid ${alpha(modeColor, 0.5)}`,
  },
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '4px',
    background: selected ? `linear-gradient(90deg, ${modeColor}, ${alpha(modeColor, 0.7)})` : 'transparent',
    transition: 'all 0.3s ease',
  }
}));

const IconContainer = styled(Box)<{ modeColor: string }>(({ modeColor }) => ({
  width: 80,
  height: 80,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: `linear-gradient(135deg, ${modeColor}, ${alpha(modeColor, 0.7)})`,
  margin: '0 auto 16px',
  boxShadow: `0 8px 24px ${alpha(modeColor, 0.3)}`,
  '& svg': {
    fontSize: 40,
    color: 'white',
  }
}));

const FeatureList = styled(List)(({ theme }) => ({
  padding: 0,
  '& .MuiListItem-root': {
    padding: theme.spacing(0.5, 0),
    '& .MuiListItemIcon-root': {
      minWidth: 32,
    },
    '& .MuiListItemText-primary': {
      fontSize: '0.9rem',
    }
  }
}));

export const ModeSelector: React.FC<ModeSelectorProps> = ({ onModeSelect }) => {
  const theme = useTheme();
  const [selectedMode, setSelectedMode] = useState<'demo' | 'production' | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  // 모드 옵션 정의
  const modeOptions: ModeOption[] = [
    {
      id: 'demo',
      title: '🎮 데모 모드',
      subtitle: '체험하기 좋은 환경',
      description: '실제 서버 없이도 ECP-AI의 모든 기능을 체험해볼 수 있습니다',
      icon: <DemoIcon />,
      color: '#10b981', // 에메랄드 그린
      features: [
        { icon: <AIIcon />, text: '20개 가상 테넌시로 구성된 완전한 데모 환경', highlight: true },
        { icon: <SpeedIcon />, text: '실시간 시뮬레이션 데이터 및 메트릭' },
        { icon: <CodeIcon />, text: 'UI/UX 및 워크플로우 학습에 최적화' },
        { icon: <CloudIcon />, text: '서버 설정 없이 즉시 시작 가능' }
      ],
      pros: [
        '서버나 인프라 구성 불필요',
        '모든 기능을 안전하게 테스트 가능',
        '학습 및 데모 용도에 완벽',
        '빠른 시작과 즉시 체험 가능'
      ],
      cons: [
        '실제 배포나 운영 불가능',
        '가상 데이터만 표시',
        '실제 API 연동 테스트 제한'
      ],
      recommended: '처음 사용자, 학습 목적, 기능 체험'
    },
    {
      id: 'production',
      title: '🚀 실사용 모드',
      subtitle: '실제 운영 환경',
      description: '실제 Kubernetes 클러스터에 테넌시를 배포하고 운영할 수 있습니다',
      icon: <ProductionIcon />,
      color: '#6366f1', // 인디고 블루
      features: [
        { icon: <SecurityIcon />, text: '실제 Kubernetes 클러스터 연동', highlight: true },
        { icon: <StorageIcon />, text: '진짜 테넌시 생성 및 배포' },
        { icon: <CloudIcon />, text: '실시간 모니터링 및 관리' },
        { icon: <SpeedIcon />, text: 'CI/CD 파이프라인 실행' }
      ],
      pros: [
        '실제 테넌시 생성 및 배포',
        '진짜 모니터링 데이터 확인',
        '완전한 운영 환경 관리',
        'CI/CD 및 자동화 기능 활용'
      ],
      cons: [
        'Kubernetes 클러스터 필요',
        '서버 및 인프라 설정 필수',
        '실제 리소스 사용으로 비용 발생',
        '설정 오류 시 시스템 영향 가능'
      ],
      recommended: '실제 운영 환경, 개발 팀, 프로덕션 배포'
    }
  ];

  const handleModeSelect = (mode: 'demo' | 'production') => {
    setSelectedMode(mode);
  };

  const handleConfirm = () => {
    if (selectedMode) {
      setConfirmDialogOpen(true);
    }
  };

  const handleConfirmMode = () => {
    if (selectedMode) {
      setIsVisible(false);
      setTimeout(() => {
        onModeSelect(selectedMode === 'demo');
      }, 300);
    }
    setConfirmDialogOpen(false);
  };

  const selectedModeData = modeOptions.find(mode => mode.id === selectedMode);

  return (
    <Fade in={isVisible} timeout={500}>
      <StyledContainer maxWidth="xl">
        <Box sx={{ width: '100%', py: 4, position: 'relative', zIndex: 1 }}>
          {/* 헤더 */}
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Zoom in={true} timeout={800}>
              <CloudIcon sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
            </Zoom>
            <Typography 
              variant="h2" 
              component="h1" 
              gutterBottom 
              sx={{ 
                fontWeight: 'bold',
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 2
              }}
            >
              ECP-AI Orchestrator
            </Typography>
            <Typography variant="h5" color="text.secondary" sx={{ mb: 1 }}>
              시작하기 전에 사용 모드를 선택해주세요
            </Typography>
            <Typography variant="body1" color="text.secondary">
              각 모드는 서로 다른 목적과 환경에 최적화되어 있습니다
            </Typography>
          </Box>

          {/* 모드 선택 카드 */}
          <Grid container spacing={4} sx={{ mb: 4 }}>
            {modeOptions.map((mode, index) => (
              <Grid item xs={12} md={6} key={mode.id}>
                <Zoom in={true} timeout={600 + index * 200}>
                  <ModeCard
                    selected={selectedMode === mode.id}
                    modeColor={mode.color}
                    onClick={() => handleModeSelect(mode.id)}
                  >
                    <CardContent sx={{ p: 4, height: '100%', display: 'flex', flexDirection: 'column' }}>
                      {/* 아이콘 및 제목 */}
                      <Box sx={{ textAlign: 'center', mb: 3 }}>
                        <IconContainer modeColor={mode.color}>
                          {mode.icon}
                        </IconContainer>
                        <Typography variant="h4" component="h2" gutterBottom sx={{ fontWeight: 'bold' }}>
                          {mode.title}
                        </Typography>
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                          {mode.subtitle}
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                          {mode.description}
                        </Typography>
                        <Chip
                          label={`${mode.recommended}에 추천`}
                          size="small"
                          sx={{ 
                            backgroundColor: alpha(mode.color, 0.1),
                            color: mode.color,
                            fontWeight: 'medium'
                          }}
                        />
                      </Box>

                      {/* 주요 기능 */}
                      <Box sx={{ mb: 3, flex: 1 }}>
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', mb: 2 }}>
                          ✨ 주요 기능
                        </Typography>
                        <FeatureList>
                          {mode.features.map((feature, idx) => (
                            <ListItem key={idx}>
                              <ListItemIcon sx={{ color: feature.highlight ? mode.color : 'text.secondary' }}>
                                {feature.icon}
                              </ListItemIcon>
                              <ListItemText 
                                primary={feature.text}
                                primaryTypographyProps={{
                                  fontWeight: feature.highlight ? 'medium' : 'normal',
                                  color: feature.highlight ? mode.color : 'text.primary'
                                }}
                              />
                            </ListItem>
                          ))}
                        </FeatureList>
                      </Box>

                      {/* 장단점 */}
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="subtitle2" gutterBottom sx={{ color: 'success.main', fontWeight: 'medium' }}>
                            ✅ 장점
                          </Typography>
                          {mode.pros.map((pro, idx) => (
                            <Typography key={idx} variant="caption" display="block" sx={{ mb: 0.5, color: 'text.secondary' }}>
                              • {pro}
                            </Typography>
                          ))}
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="subtitle2" gutterBottom sx={{ color: 'warning.main', fontWeight: 'medium' }}>
                            ⚠️ 단점
                          </Typography>
                          {mode.cons.map((con, idx) => (
                            <Typography key={idx} variant="caption" display="block" sx={{ mb: 0.5, color: 'text.secondary' }}>
                              • {con}
                            </Typography>
                          ))}
                        </Grid>
                      </Grid>
                    </CardContent>
                  </ModeCard>
                </Zoom>
              </Grid>
            ))}
          </Grid>

          {/* 선택 버튼 */}
          <Box sx={{ textAlign: 'center' }}>
            <Button
              variant="contained"
              size="large"
              onClick={handleConfirm}
              disabled={!selectedMode}
              startIcon={selectedMode ? <CheckIcon /> : <InfoIcon />}
              sx={{
                px: 6,
                py: 2,
                fontSize: '1.2rem',
                borderRadius: 3,
                background: selectedMode 
                  ? `linear-gradient(135deg, ${selectedModeData?.color}, ${alpha(selectedModeData?.color || theme.palette.primary.main, 0.8)})`
                  : undefined,
                boxShadow: selectedMode 
                  ? `0 8px 24px ${alpha(selectedModeData?.color || theme.palette.primary.main, 0.4)}`
                  : undefined,
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: selectedMode ? 'translateY(-2px)' : undefined,
                  boxShadow: selectedMode 
                    ? `0 12px 32px ${alpha(selectedModeData?.color || theme.palette.primary.main, 0.5)}`
                    : undefined,
                }
              }}
            >
              {selectedMode ? `${selectedModeData?.title} 시작하기` : '모드를 선택해주세요'}
            </Button>
            
            {selectedMode && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                선택한 모드: <strong>{selectedModeData?.title}</strong>
                <br />
                언제든지 설정에서 모드를 변경할 수 있습니다
              </Typography>
            )}
          </Box>
        </Box>

        {/* 확인 다이얼로그 */}
        <Dialog
          open={confirmDialogOpen}
          onClose={() => setConfirmDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {selectedModeData && (
              <IconContainer modeColor={selectedModeData.color} sx={{ width: 48, height: 48, mb: 0 }}>
                {selectedModeData.icon}
              </IconContainer>
            )}
            <Box>
              <Typography variant="h6">모드 선택 확인</Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedModeData?.title}로 시작하시겠습니까?
              </Typography>
            </Box>
          </DialogTitle>
          <DialogContent>
            {selectedModeData && (
              <Box>
                <Typography variant="body1" gutterBottom>
                  <strong>{selectedModeData.title}</strong>를 선택하셨습니다.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {selectedModeData.description}
                </Typography>
                
                <Paper sx={{ p: 2, backgroundColor: alpha(selectedModeData.color, 0.1) }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ color: selectedModeData.color }}>
                    이 모드의 특징:
                  </Typography>
                  {selectedModeData.features.slice(0, 2).map((feature, idx) => (
                    <Typography key={idx} variant="body2" sx={{ mb: 1 }}>
                      • {feature.text}
                    </Typography>
                  ))}
                </Paper>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setConfirmDialogOpen(false)}>
              다시 선택
            </Button>
            <Button
              variant="contained"
              onClick={handleConfirmMode}
              sx={{
                background: selectedModeData 
                  ? `linear-gradient(135deg, ${selectedModeData.color}, ${alpha(selectedModeData.color, 0.8)})`
                  : undefined
              }}
            >
              확인하고 시작하기
            </Button>
          </DialogActions>
        </Dialog>
      </StyledContainer>
    </Fade>
  );
};

export default ModeSelector;
