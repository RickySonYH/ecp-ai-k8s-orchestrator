// [advice from AI] 개선된 CI/CD 관리 컴포넌트 - 사용자 워크플로우 기반 구조
/**
 * Improved CI/CD Management Component
 * 워크플로우 기반 탭 구조:
 * 1. 📦 이미지 라이프사이클: 기본 이미지 관리 + 빌드 + 보안 스캔
 * 2. 🔗 소스 연동 & 자동화: GitHub 연동 + 빌드 트리거 + 파이프라인 템플릿
 * 3. 🚀 배포 관리: 배포 전략 + 실시간 모니터링 + 롤백
 * 4. ⚙️ 레지스트리 & 정책: 레지스트리 설정 + 보안 정책 + 감사 로그
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Tabs,
  Tab,
  Alert,
  Chip,
  LinearProgress,
  Divider,
  useTheme,
  alpha
} from '@mui/material';
import {
  Inventory as DockerIcon,
  GitHub as GitHubIcon,
  Build as BuildIcon,
  Settings as SettingsIcon,
  Security as SecurityIcon,
  PlayArrow as PlayArrowIcon,
  Storage as StorageIcon,
  Info as InfoIcon,
  Add as AddIcon
} from '@mui/icons-material';

// 컴포넌트 임포트
import ImageRegistration from './cicd/ImageRegistration';
import GitHubIntegration from './cicd/GitHubIntegration';
import DeploymentPipeline from './cicd/DeploymentPipeline';

// TabPanel 컴포넌트
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`cicd-tabpanel-${index}`}
      aria-labelledby={`cicd-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

// 메인 컴포넌트
const CICDManagementNew: React.FC<{ isDemoMode?: boolean }> = ({ isDemoMode = false }) => {
  const theme = useTheme();
  const [currentTab, setCurrentTab] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  // 탭별 설명
  const getTabDescription = (tabIndex: number) => {
    switch (tabIndex) {
      case 0:
        return "20개 기본 서비스 이미지의 전체 생명주기를 관리합니다. 빌드, 보안 스캔, 버전 관리가 통합되어 있습니다.";
      case 1:
        return "GitHub 저장소 연동, 자동 빌드 트리거 설정, CI/CD 파이프라인 템플릿을 관리합니다.";
      case 2:
        return "배포 전략 설정, 실시간 배포 모니터링, 롤백 관리를 통합적으로 제공합니다.";
      case 3:
        return "컨테이너 레지스트리 연결, 보안 정책 설정, 감사 로그를 관리합니다.";
      default:
        return "";
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 1400, mx: 'auto', p: 3 }}>
      {/* 헤더 */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          🔧 CI/CD 관리 센터
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          컨테이너 이미지의 전체 생명주기를 관리하고 배포 파이프라인을 설정합니다.
        </Typography>
        
        {/* 현재 탭 설명 */}
        <Alert 
          severity="info" 
          icon={<InfoIcon />}
          sx={{ 
            backgroundColor: alpha(theme.palette.primary.main, 0.1),
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
          }}
        >
          <Typography variant="body2">
            {getTabDescription(currentTab)}
          </Typography>
        </Alert>
      </Box>

      {/* 탭 네비게이션 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs 
          value={currentTab} 
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ 
            '& .MuiTab-root': {
              minHeight: 72,
              textTransform: 'none',
              fontSize: '1rem',
              fontWeight: 500
            }
          }}
        >
          <Tab 
            label="📦 이미지 라이프사이클"
            sx={{ gap: 1 }}
          />
          <Tab 
            label="🔗 소스 연동 & 자동화"
            sx={{ gap: 1 }}
          />
          <Tab 
            label="🚀 배포 관리"
            sx={{ gap: 1 }}
          />
          <Tab 
            label="⚙️ 레지스트리 & 정책"
            sx={{ gap: 1 }}
          />
        </Tabs>
      </Box>

      {/* 탭 콘텐츠 */}
      
      {/* 📦 이미지 라이프사이클 관리 */}
      <TabPanel value={currentTab} index={0}>
        <Box>
          <Typography variant="h5" gutterBottom>
            📦 이미지 라이프사이클 관리
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            20개 기본 서비스 이미지의 빌드, 스캔, 버전 관리를 통합적으로 처리합니다.
          </Typography>
          
          <ImageRegistration />
        </Box>
      </TabPanel>

      {/* 🔗 소스 연동 & 자동화 */}
      <TabPanel value={currentTab} index={1}>
        <Box>
          <Typography variant="h5" gutterBottom>
            🔗 소스 연동 & 자동화
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            GitHub 저장소 연동 및 자동 빌드 파이프라인을 설정합니다.
          </Typography>
          
          <GitHubIntegration />
        </Box>
      </TabPanel>

      {/* 🚀 배포 관리 */}
      <TabPanel value={currentTab} index={2}>
        <Box>
          <Typography variant="h5" gutterBottom>
            🚀 배포 관리
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            배포 전략 설정 및 실시간 배포 상태를 모니터링합니다.
          </Typography>
          
          <DeploymentPipeline />
        </Box>
      </TabPanel>

      {/* ⚙️ 레지스트리 & 정책 */}
      <TabPanel value={currentTab} index={3}>
        <Box>
          <Typography variant="h5" gutterBottom>
            ⚙️ 레지스트리 & 정책 관리
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            컨테이너 레지스트리 연결 및 보안 정책을 관리합니다.
          </Typography>
          
          {/* 레지스트리 설정 */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    🏗️ 레지스트리 관리
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Docker 이미지 저장소 연결 및 관리
                  </Typography>
                  
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <Chip 
                      label="Harbor (기본)" 
                      color="primary" 
                      size="small"
                      icon={<StorageIcon />}
                    />
                    <Chip 
                      label="AWS ECR" 
                      variant="outlined" 
                      size="small"
                    />
                    <Chip 
                      label="Docker Hub" 
                      variant="outlined" 
                      size="small"
                    />
                  </Box>
                  
                  <Button variant="contained" size="small">
                    레지스트리 설정
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    🔐 보안 정책
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    이미지 보안 스캔 및 정책 관리
                  </Typography>
                  
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <Chip 
                      label="Trivy 스캔" 
                      color="success" 
                      size="small"
                      icon={<SecurityIcon />}
                    />
                    <Chip 
                      label="CVE 7.0+ 차단" 
                      color="warning" 
                      size="small"
                    />
                  </Box>
                  
                  <Button variant="contained" size="small">
                    보안 정책 설정
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </TabPanel>

      {loading && (
        <Box sx={{ width: '100%', mt: 2 }}>
          <LinearProgress />
        </Box>
      )}
    </Box>
  );
};

export default CICDManagementNew;
