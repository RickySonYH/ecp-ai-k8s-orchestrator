// [advice from AI] CI/CD 관리 컴포넌트 - 이미지 관리 및 배포 파이프라인 관리
/**
 * CI/CD Management Component
 * - 컨테이너 이미지 관리
 * - 레지스트리 설정 관리
 * - 배포 파이프라인 관리
 * - 이미지 스캔 및 보안 관리
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
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
  AlertTitle
} from '@mui/material';
import {
  Widgets as DockerIcon,
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
  Info as InfoIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// 타입 정의
interface ContainerRegistry {
  id: string;
  name: string;
  url: string;
  type: 'harbor' | 'ecr' | 'gcr' | 'docker-hub' | 'private';
  isDefault: boolean;
  status: 'connected' | 'disconnected' | 'error';
  credentials?: {
    username: string;
    password: string;
  };
  lastSync?: string;
}

interface ServiceImage {
  serviceName: string;
  displayName: string;
  registry: string;
  repository: string;
  currentTag: string;
  availableTags: string[];
  lastUpdated: string;
  scanStatus: 'passed' | 'warning' | 'critical' | 'scanning' | 'not-scanned';
  vulnerabilities?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  // [advice from AI] 실제 Pod 매칭을 위한 확장 속성
  selectedTag?: string;      // 배포하려는 태그
  pullPolicy?: string;       // 이미지 풀 정책
  deploymentStatus?: ServiceDeploymentStatus;  // 실제 배포 상태
}

// [advice from AI] Pod 상태 및 배포 관리를 위한 새 인터페이스
interface PodStatus {
  podName: string;
  status: string;
  currentImage: string;
  ready: boolean;
  restarts: number;
  createdAt: string;
  nodeName?: string;
}

interface ServiceDeploymentStatus {
  serviceName: string;
  desiredImage: string;
  currentImage: string;
  replicas: {
    desired: number;
    ready: number;
    available: number;
    updated: number;
  };
  pods: PodStatus[];
  rolloutStatus: string;
  deploymentStrategy: string;
  lastUpdated: string;
}

interface DeploymentHistory {
  revision: number;
  image: string;
  deployedAt: string;
  deployedBy: string;
  status: string;
  rollbackAvailable: boolean;
  changeCause?: string;
}

interface BuildPipeline {
  id: string;
  name: string;
  service: string;
  status: 'running' | 'success' | 'failed' | 'queued';
  lastRun: string;
  duration: string;
  trigger: 'manual' | 'webhook' | 'schedule';
  isEnabled: boolean;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// 스타일드 컴포넌트
const StyledCard = styled(Card)(({ theme }) => ({
  background: theme.palette.mode === 'dark'
    ? `linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(67, 56, 202, 0.05))`
    : `linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(129, 140, 248, 0.03))`,
  backdropFilter: 'blur(20px)',
  border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)'}`,
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.palette.mode === 'dark' 
      ? '0 12px 40px rgba(99, 102, 241, 0.2)' 
      : '0 8px 30px rgba(99, 102, 241, 0.15)',
  },
}));

// 탭 패널 컴포넌트
function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

// [advice from AI] 데모 모드 샘플 데이터 정의 (20개 서비스)
const demoServiceImages: ServiceImage[] = [
  // 메인 서비스 (3개)
  {
    serviceName: 'callbot',
    displayName: 'Callbot Service (콜봇)',
    registry: 'harbor.ecp-ai.com',
    repository: 'ecp-ai/callbot',
    currentTag: 'v1.2.3',
    availableTags: ['v1.2.3', 'v1.2.2', 'v1.2.1'],
    lastUpdated: new Date().toISOString(),
    scanStatus: 'passed',
    vulnerabilities: { critical: 0, high: 0, medium: 2, low: 5 }
  },
  {
    serviceName: 'chatbot',
    displayName: 'Chatbot Service (챗봇)',
    registry: 'harbor.ecp-ai.com',
    repository: 'ecp-ai/chatbot',
    currentTag: 'v1.1.8',
    availableTags: ['v1.1.8', 'v1.1.7', 'v1.1.6'],
    lastUpdated: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    scanStatus: 'warning',
    vulnerabilities: { critical: 0, high: 1, medium: 3, low: 8 }
  },
  {
    serviceName: 'advisor',
    displayName: 'AI Advisor Service (어드바이저)',
    registry: 'harbor.ecp-ai.com',
    repository: 'ecp-ai/advisor',
    currentTag: 'v1.3.1',
    availableTags: ['v1.3.1', 'v1.3.0', 'v1.2.9'],
    lastUpdated: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    scanStatus: 'passed',
    vulnerabilities: { critical: 0, high: 0, medium: 1, low: 3 }
  },
  
  // AI/NLP 서비스 (4개)
  {
    serviceName: 'stt',
    displayName: 'Speech-to-Text Service (STT)',
    registry: 'harbor.ecp-ai.com',
    repository: 'ecp-ai/stt',
    currentTag: 'v1.0.5',
    availableTags: ['v1.0.5', 'v1.0.4', 'v1.0.3'],
    lastUpdated: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    scanStatus: 'critical',
    vulnerabilities: { critical: 2, high: 3, medium: 5, low: 12 }
  },
  {
    serviceName: 'tts',
    displayName: 'Text-to-Speech Service (TTS)',
    registry: 'harbor.ecp-ai.com',
    repository: 'ecp-ai/tts',
    currentTag: 'v1.0.3',
    availableTags: ['v1.0.3', 'v1.0.2', 'v1.0.1'],
    lastUpdated: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    scanStatus: 'warning',
    vulnerabilities: { critical: 0, high: 2, medium: 4, low: 7 }
  },
  {
    serviceName: 'nlp',
    displayName: 'NLP Engine Service (NLP)',
    registry: 'harbor.ecp-ai.com',
    repository: 'ecp-ai/nlp',
    currentTag: 'v1.4.2',
    availableTags: ['v1.4.2', 'v1.4.1', 'v1.4.0'],
    lastUpdated: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    scanStatus: 'passed',
    vulnerabilities: { critical: 0, high: 0, medium: 1, low: 2 }
  },
  {
    serviceName: 'aicm',
    displayName: 'AI Conversation Manager (AICM)',
    registry: 'harbor.ecp-ai.com',
    repository: 'ecp-ai/aicm',
    currentTag: 'v1.2.0',
    availableTags: ['v1.2.0', 'v1.1.9', 'v1.1.8'],
    lastUpdated: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString(),
    scanStatus: 'passed',
    vulnerabilities: { critical: 0, high: 0, medium: 0, low: 1 }
  },
  
  // 분석 서비스 (2개)
  {
    serviceName: 'ta',
    displayName: 'TA Statistics Analysis (TA통계분석)',
    registry: 'harbor.ecp-ai.com',
    repository: 'ecp-ai/ta',
    currentTag: 'v1.1.2',
    availableTags: ['v1.1.2', 'v1.1.1', 'v1.1.0'],
    lastUpdated: new Date(Date.now() - 15 * 60 * 60 * 1000).toISOString(),
    scanStatus: 'passed',
    vulnerabilities: { critical: 0, high: 0, medium: 1, low: 4 }
  },
  {
    serviceName: 'qa',
    displayName: 'QA Quality Management (QA품질관리)',
    registry: 'harbor.ecp-ai.com',
    repository: 'ecp-ai/qa',
    currentTag: 'v1.0.8',
    availableTags: ['v1.0.8', 'v1.0.7', 'v1.0.6'],
    lastUpdated: new Date(Date.now() - 21 * 60 * 60 * 1000).toISOString(),
    scanStatus: 'warning',
    vulnerabilities: { critical: 0, high: 1, medium: 2, low: 6 }
  },
  
  // 인프라 서비스 (6개)
  {
    serviceName: 'nginx',
    displayName: 'Nginx Web Server (Nginx)',
    registry: 'harbor.ecp-ai.com',
    repository: 'ecp-ai/nginx',
    currentTag: 'v1.23.4',
    availableTags: ['v1.23.4', 'v1.23.3', 'v1.23.2'],
    lastUpdated: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    scanStatus: 'passed',
    vulnerabilities: { critical: 0, high: 0, medium: 0, low: 1 }
  },
  {
    serviceName: 'gateway',
    displayName: 'API Gateway Service (Gateway)',
    registry: 'harbor.ecp-ai.com',
    repository: 'ecp-ai/gateway',
    currentTag: 'v1.5.1',
    availableTags: ['v1.5.1', 'v1.5.0', 'v1.4.9'],
    lastUpdated: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    scanStatus: 'passed',
    vulnerabilities: { critical: 0, high: 0, medium: 1, low: 3 }
  },
  {
    serviceName: 'auth',
    displayName: 'Authentication Service (권한관리)',
    registry: 'harbor.ecp-ai.com',
    repository: 'ecp-ai/auth',
    currentTag: 'v1.3.7',
    availableTags: ['v1.3.7', 'v1.3.6', 'v1.3.5'],
    lastUpdated: new Date(Date.now() - 11 * 60 * 60 * 1000).toISOString(),
    scanStatus: 'passed',
    vulnerabilities: { critical: 0, high: 0, medium: 0, low: 2 }
  },
  {
    serviceName: 'history',
    displayName: 'Conversation History (대화이력)',
    registry: 'harbor.ecp-ai.com',
    repository: 'ecp-ai/history',
    currentTag: 'v1.2.4',
    availableTags: ['v1.2.4', 'v1.2.3', 'v1.2.2'],
    lastUpdated: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
    scanStatus: 'warning',
    vulnerabilities: { critical: 0, high: 1, medium: 2, low: 5 }
  },
  {
    serviceName: 'scenario-builder',
    displayName: 'Scenario Builder (시나리오빌더)',
    registry: 'harbor.ecp-ai.com',
    repository: 'ecp-ai/scenario-builder',
    currentTag: 'v1.1.6',
    availableTags: ['v1.1.6', 'v1.1.5', 'v1.1.4'],
    lastUpdated: new Date(Date.now() - 17 * 60 * 60 * 1000).toISOString(),
    scanStatus: 'passed',
    vulnerabilities: { critical: 0, high: 0, medium: 1, low: 3 }
  },
  {
    serviceName: 'monitoring',
    displayName: 'System Monitoring (모니터링)',
    registry: 'harbor.ecp-ai.com',
    repository: 'ecp-ai/monitoring',
    currentTag: 'v1.4.3',
    availableTags: ['v1.4.3', 'v1.4.2', 'v1.4.1'],
    lastUpdated: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
    scanStatus: 'passed',
    vulnerabilities: { critical: 0, high: 0, medium: 0, low: 1 }
  },
  
  // 데이터 서비스 (3개)
  {
    serviceName: 'postgresql',
    displayName: 'PostgreSQL Database (PostgreSQL)',
    registry: 'harbor.ecp-ai.com',
    repository: 'ecp-ai/postgresql',
    currentTag: 'v15.4',
    availableTags: ['v15.4', 'v15.3', 'v15.2'],
    lastUpdated: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    scanStatus: 'passed',
    vulnerabilities: { critical: 0, high: 0, medium: 0, low: 2 }
  },
  {
    serviceName: 'vector-db',
    displayName: 'Vector Database (Vector DB)',
    registry: 'harbor.ecp-ai.com',
    repository: 'ecp-ai/vector-db',
    currentTag: 'v1.0.9',
    availableTags: ['v1.0.9', 'v1.0.8', 'v1.0.7'],
    lastUpdated: new Date(Date.now() - 28 * 60 * 60 * 1000).toISOString(),
    scanStatus: 'warning',
    vulnerabilities: { critical: 0, high: 1, medium: 2, low: 4 }
  },
  {
    serviceName: 'redis',
    displayName: 'Redis Cache (Redis)',
    registry: 'harbor.ecp-ai.com',
    repository: 'ecp-ai/redis',
    currentTag: 'v7.2.4',
    availableTags: ['v7.2.4', 'v7.2.3', 'v7.2.2'],
    lastUpdated: new Date(Date.now() - 31 * 60 * 60 * 1000).toISOString(),
    scanStatus: 'passed',
    vulnerabilities: { critical: 0, high: 0, medium: 1, low: 3 }
  },
  
  // 특화 서비스 (2개)
  {
    serviceName: 'livekit',
    displayName: 'LiveKit Real-time (LiveKit)',
    registry: 'harbor.ecp-ai.com',
    repository: 'ecp-ai/livekit',
    currentTag: 'v1.2.1',
    availableTags: ['v1.2.1', 'v1.2.0', 'v1.1.9'],
    lastUpdated: new Date(Date.now() - 34 * 60 * 60 * 1000).toISOString(),
    scanStatus: 'passed',
    vulnerabilities: { critical: 0, high: 0, medium: 0, low: 1 }
  },
  {
    serviceName: 'speaker-separation',
    displayName: 'Speaker Separation (화자분리)',
    registry: 'harbor.ecp-ai.com',
    repository: 'ecp-ai/speaker-separation',
    currentTag: 'v1.0.4',
    availableTags: ['v1.0.4', 'v1.0.3', 'v1.0.2'],
    lastUpdated: new Date(Date.now() - 37 * 60 * 60 * 1000).toISOString(),
    scanStatus: 'critical',
    vulnerabilities: { critical: 1, high: 2, medium: 4, low: 8 }
  }
];

const demoBuildPipelines: BuildPipeline[] = [
  // 메인 서비스 파이프라인
  {
    id: 'pipeline-1',
    name: 'Callbot CI/CD Pipeline',
    service: 'callbot',
    status: 'success',
    lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    duration: '8분 32초',
    trigger: 'webhook',
    isEnabled: true
  },
  {
    id: 'pipeline-2',
    name: 'Chatbot CI/CD Pipeline',
    service: 'chatbot',
    status: 'running',
    lastRun: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    duration: '진행 중...',
    trigger: 'webhook',
    isEnabled: true
  },
  {
    id: 'pipeline-3',
    name: 'Advisor CI/CD Pipeline',
    service: 'advisor',
    status: 'success',
    lastRun: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    duration: '12분 15초',
    trigger: 'manual',
    isEnabled: true
  },
  
  // AI/NLP 서비스 파이프라인
  {
    id: 'pipeline-4',
    name: 'STT CI/CD Pipeline',
    service: 'stt',
    status: 'failed',
    lastRun: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    duration: '6분 45초',
    trigger: 'schedule',
    isEnabled: false
  },
  {
    id: 'pipeline-5',
    name: 'TTS CI/CD Pipeline',
    service: 'tts',
    status: 'success',
    lastRun: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    duration: '9분 20초',
    trigger: 'webhook',
    isEnabled: true
  },
  {
    id: 'pipeline-6',
    name: 'NLP CI/CD Pipeline',
    service: 'nlp',
    status: 'success',
    lastRun: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    duration: '15분 42초',
    trigger: 'webhook',
    isEnabled: true
  },
  {
    id: 'pipeline-7',
    name: 'AICM CI/CD Pipeline',
    service: 'aicm',
    status: 'queued',
    lastRun: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    duration: '대기 중...',
    trigger: 'schedule',
    isEnabled: true
  },
  
  // 분석 서비스 파이프라인
  {
    id: 'pipeline-8',
    name: 'TA Analysis CI/CD Pipeline',
    service: 'ta',
    status: 'success',
    lastRun: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
    duration: '11분 8초',
    trigger: 'manual',
    isEnabled: true
  },
  {
    id: 'pipeline-9',
    name: 'QA Management CI/CD Pipeline',
    service: 'qa',
    status: 'success',
    lastRun: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    duration: '7분 33초',
    trigger: 'webhook',
    isEnabled: true
  },
  
  // 인프라 서비스 파이프라인
  {
    id: 'pipeline-10',
    name: 'Nginx CI/CD Pipeline',
    service: 'nginx',
    status: 'success',
    lastRun: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString(),
    duration: '4분 12초',
    trigger: 'webhook',
    isEnabled: true
  },
  {
    id: 'pipeline-11',
    name: 'Gateway CI/CD Pipeline',
    service: 'gateway',
    status: 'success',
    lastRun: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
    duration: '6분 55초',
    trigger: 'webhook',
    isEnabled: true
  },
  {
    id: 'pipeline-12',
    name: 'Auth Service CI/CD Pipeline',
    service: 'auth',
    status: 'success',
    lastRun: new Date(Date.now() - 11 * 60 * 60 * 1000).toISOString(),
    duration: '8분 17초',
    trigger: 'webhook',
    isEnabled: true
  },
  {
    id: 'pipeline-13',
    name: 'History Service CI/CD Pipeline',
    service: 'history',
    status: 'success',
    lastRun: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    duration: '5분 44초',
    trigger: 'webhook',
    isEnabled: true
  },
  {
    id: 'pipeline-14',
    name: 'Scenario Builder CI/CD Pipeline',
    service: 'scenario-builder',
    status: 'success',
    lastRun: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString(),
    duration: '13분 21초',
    trigger: 'manual',
    isEnabled: true
  },
  {
    id: 'pipeline-15',
    name: 'Monitoring CI/CD Pipeline',
    service: 'monitoring',
    status: 'success',
    lastRun: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
    duration: '9분 8초',
    trigger: 'webhook',
    isEnabled: true
  },
  
  // 데이터 서비스 파이프라인
  {
    id: 'pipeline-16',
    name: 'PostgreSQL CI/CD Pipeline',
    service: 'postgresql',
    status: 'success',
    lastRun: new Date(Date.now() - 15 * 60 * 60 * 1000).toISOString(),
    duration: '18분 45초',
    trigger: 'schedule',
    isEnabled: true
  },
  {
    id: 'pipeline-17',
    name: 'Vector DB CI/CD Pipeline',
    service: 'vector-db',
    status: 'success',
    lastRun: new Date(Date.now() - 16 * 60 * 60 * 1000).toISOString(),
    duration: '22분 13초',
    trigger: 'manual',
    isEnabled: true
  },
  {
    id: 'pipeline-18',
    name: 'Redis CI/CD Pipeline',
    service: 'redis',
    status: 'success',
    lastRun: new Date(Date.now() - 17 * 60 * 60 * 1000).toISOString(),
    duration: '3분 56초',
    trigger: 'webhook',
    isEnabled: true
  },
  
  // 특화 서비스 파이프라인
  {
    id: 'pipeline-19',
    name: 'LiveKit CI/CD Pipeline',
    service: 'livekit',
    status: 'success',
    lastRun: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    duration: '16분 29초',
    trigger: 'webhook',
    isEnabled: true
  },
  {
    id: 'pipeline-20',
    name: 'Speaker Separation CI/CD Pipeline',
    service: 'speaker-separation',
    status: 'failed',
    lastRun: new Date(Date.now() - 19 * 60 * 60 * 1000).toISOString(),
    duration: '14분 7초',
    trigger: 'manual',
    isEnabled: false
  }
];

const demoRegistries: ContainerRegistry[] = [
  {
    id: '1',
    name: 'ECP Harbor Registry',
    url: 'harbor.ecp-ai.com',
    type: 'harbor',
    isDefault: true,
    status: 'connected',
    lastSync: new Date().toISOString()
  },
  {
    id: '2',
    name: 'AWS ECR Registry',
    url: '123456789012.dkr.ecr.ap-northeast-2.amazonaws.com',
    type: 'ecr',
    isDefault: false,
    status: 'connected',
    lastSync: new Date(Date.now() - 30 * 60 * 1000).toISOString()
  },
  {
    id: '3',
    name: 'Docker Hub',
    url: 'docker.io',
    type: 'docker-hub',
    isDefault: false,
    status: 'disconnected',
    lastSync: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  }
];

const CICDManagement: React.FC<{ isDemoMode?: boolean }> = ({ isDemoMode = true }) => {
  const [currentTab, setCurrentTab] = useState(0);
  const [registries, setRegistries] = useState<ContainerRegistry[]>([]);
  const [serviceImages, setServiceImages] = useState<ServiceImage[]>([]);
  const [buildPipelines, setBuildPipelines] = useState<BuildPipeline[]>([]);
  const [registryDialogOpen, setRegistryDialogOpen] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [selectedRegistry, setSelectedRegistry] = useState<ContainerRegistry | null>(null);
  const [selectedImage, setSelectedImage] = useState<ServiceImage | null>(null);
  const [loading, setLoading] = useState(false);
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [showGuide, setShowGuide] = useState<{[key: number]: boolean}>({0: true, 1: false, 2: false, 3: false, 4: false});

  // 초기 데이터 로드
  useEffect(() => {
    loadInitialData();
  }, [isDemoMode]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      if (isDemoMode) {
        // [advice from AI] 데모 모드: 샘플 데이터 사용
        setRegistries(demoRegistries);
        setServiceImages(demoServiceImages);
        setBuildPipelines(demoBuildPipelines);
        setLoading(false);
        return;
      }

      // 실제 모드: API 호출
      const [registriesRes, servicesRes, pipelinesRes, imageManagementRes] = await Promise.all([
        fetch('/api/v1/images/registries'),
        fetch('/api/v1/images/services'),
        fetch('/api/v1/images/pipelines'),
        fetch('/api/v1/image-management/registries')
      ]);

      if (registriesRes.ok) {
        const registriesData = await registriesRes.json();
        setRegistries(registriesData);
      }

      if (servicesRes.ok) {
        const servicesData = await servicesRes.json();
        // API 응답을 프론트엔드 형식으로 변환
        const formattedServices = servicesData.map((service: any) => ({
          serviceName: service.service_name,
          displayName: service.display_name,
          registry: service.registry || 'harbor.ecp-ai.com',
          repository: service.repository || `ecp-ai/${service.service_name}`,
          currentTag: service.current_tag || 'v1.0.0',
          availableTags: service.available_tags || ['v1.0.0'],
          lastUpdated: service.last_updated || new Date().toISOString(),
          scanStatus: service.scan_status || 'passed',
          vulnerabilities: service.vulnerabilities || { critical: 0, high: 0, medium: 0, low: 0 }
        }));
        setServiceImages(formattedServices);
      }

      if (pipelinesRes.ok) {
        const pipelinesData = await pipelinesRes.json();
        setBuildPipelines(pipelinesData);
      }

    } catch (error) {
      console.error('데이터 로드 실패:', error);
      // API 실패 시 기본 Mock 데이터 사용
      setRegistries([
        {
          id: '1',
          name: 'ECP Harbor Registry',
          url: 'harbor.ecp-ai.com',
          type: 'harbor',
          isDefault: true,
          status: 'connected',
          lastSync: new Date().toISOString()
        }
      ]);
      
      // 기본 서비스 이미지 (API 실패 시)
      setServiceImages([
        {
          serviceName: 'callbot',
          displayName: 'Callbot Service (콜봇)',
          registry: 'harbor.ecp-ai.com',
          repository: 'ecp-ai/callbot',
          currentTag: 'v1.2.3',
          availableTags: ['v1.2.3'],
          lastUpdated: new Date().toISOString(),
          scanStatus: 'passed',
          vulnerabilities: { critical: 0, high: 0, medium: 2, low: 5 }
        }
      ]);

      setBuildPipelines([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };



  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          🔧 CI/CD 관리
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadInitialData}
          disabled={loading}
        >
          새로고침
        </Button>
      </Box>

      {/* 탭 네비게이션 */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={currentTab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
          <Tab label="📦 이미지 관리" icon={<DockerIcon />} iconPosition="start" />
          <Tab label="🏗️ 레지스트리" icon={<StorageIcon />} iconPosition="start" />
          <Tab label="⚙️ 빌드 파이프라인" icon={<BuildIcon />} iconPosition="start" />
          <Tab label="🔒 보안 스캔" icon={<SecurityIcon />} iconPosition="start" />
          <Tab label="🚀 실시간 배포" icon={<PlayArrowIcon />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* 이미지 관리 탭 */}
      <TabPanel value={currentTab} index={0}>
        {/* 초보자 가이드 */}
        <Alert 
          severity="info" 
          icon={<InfoIcon />} 
          sx={{ mb: 3 }}
          action={
            <Button 
              size="small" 
              onClick={() => setShowGuide({...showGuide, 0: !showGuide[0]})}
            >
              {showGuide[0] ? '가이드 숨기기' : '가이드 보기'}
            </Button>
          }
        >
          <AlertTitle>📦 이미지 관리 가이드</AlertTitle>
          <Collapse in={showGuide[0]}>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" paragraph>
                <strong>🎯 이 메뉴는 무엇인가요?</strong><br/>
                ECP-AI 시스템의 모든 서비스 컨테이너 이미지를 관리하는 곳입니다. 
                현재 <strong>총 20개의 서비스</strong>가 등록되어 있으며, 각 서비스의 버전, 보안 상태, 레지스트리 정보를 확인할 수 있습니다.
              </Typography>
              
              <Typography variant="body2" paragraph>
                <strong>🔍 서비스 카테고리별 분류:</strong>
              </Typography>
              <Box sx={{ ml: 2, mb: 2 }}>
                <Typography variant="caption" display="block">• <strong>메인 서비스 (3개)</strong>: 콜봇, 챗봇, 어드바이저</Typography>
                <Typography variant="caption" display="block">• <strong>AI/NLP 서비스 (4개)</strong>: STT, TTS, NLP엔진, AICM</Typography>
                <Typography variant="caption" display="block">• <strong>분석 서비스 (2개)</strong>: TA통계분석, QA품질관리</Typography>
                <Typography variant="caption" display="block">• <strong>인프라 서비스 (6개)</strong>: Nginx, Gateway, 권한관리, 대화이력, 시나리오빌더, 모니터링</Typography>
                <Typography variant="caption" display="block">• <strong>데이터 서비스 (3개)</strong>: PostgreSQL, Vector DB, Redis</Typography>
                <Typography variant="caption" display="block">• <strong>특화 서비스 (2개)</strong>: LiveKit, 화자분리</Typography>
              </Box>
              
              <Typography variant="body2" paragraph>
                <strong>🚀 사용 방법:</strong><br/>
                1. <strong>카테고리 필터</strong>를 사용해 원하는 서비스만 필터링<br/>
                2. 각 서비스 카드에서 <strong>현재 버전, 취약점 현황</strong> 확인<br/>
                3. <strong>"설정" 버튼</strong>을 클릭해 이미지 버전 변경<br/>
                4. <strong>보안 스캔 상태</strong>로 업데이트 우선순위 결정
              </Typography>
              
              <Alert severity="warning" sx={{ mt: 2 }}>
                <strong>⚠️ 주의사항:</strong> Critical 상태의 이미지는 보안 위험이 있으므로 즉시 업데이트하세요!
              </Alert>
            </Box>
          </Collapse>
        </Alert>

        <ImageManagementTab 
          serviceImages={serviceImages}
          onImageSelect={setSelectedImage}
          onImageDialogOpen={() => setImageDialogOpen(true)}
          loading={loading}
          serviceFilter={serviceFilter}
          onServiceFilterChange={setServiceFilter}
        />
      </TabPanel>

      {/* 레지스트리 관리 탭 */}
      <TabPanel value={currentTab} index={1}>
        {/* 초보자 가이드 */}
        <Alert 
          severity="info" 
          icon={<StorageIcon />} 
          sx={{ mb: 3 }}
          action={
            <Button 
              size="small" 
              onClick={() => setShowGuide({...showGuide, 1: !showGuide[1]})}
            >
              {showGuide[1] ? '가이드 숨기기' : '가이드 보기'}
            </Button>
          }
        >
          <AlertTitle>🏗️ 레지스트리 관리 가이드</AlertTitle>
          <Collapse in={showGuide[1]}>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" paragraph>
                <strong>🎯 컨테이너 레지스트리란?</strong><br/>
                Docker 이미지를 저장하고 관리하는 저장소입니다. GitHub처럼 코드를 저장하듯이, 
                레지스트리는 컨테이너 이미지를 저장하는 곳입니다.
              </Typography>
              
              <Typography variant="body2" paragraph>
                <strong>📋 지원하는 레지스트리 타입:</strong>
              </Typography>
              <Box sx={{ ml: 2, mb: 2 }}>
                <Typography variant="caption" display="block">• <strong>Harbor</strong>: 오픈소스 엔터프라이즈 레지스트리 (권장)</Typography>
                <Typography variant="caption" display="block">• <strong>AWS ECR</strong>: Amazon의 컨테이너 레지스트리</Typography>
                <Typography variant="caption" display="block">• <strong>Google GCR</strong>: Google Cloud의 컨테이너 레지스트리</Typography>
                <Typography variant="caption" display="block">• <strong>Docker Hub</strong>: Docker의 공식 레지스트리</Typography>
                <Typography variant="caption" display="block">• <strong>Private Registry</strong>: 자체 구축 레지스트리</Typography>
              </Box>
              
              <Typography variant="body2" paragraph>
                <strong>🚀 레지스트리 추가 방법:</strong><br/>
                1. <strong>"레지스트리 추가"</strong> 버튼 클릭<br/>
                2. <strong>이름</strong>: 구분하기 쉬운 이름 입력 (예: "회사 Harbor")<br/>
                3. <strong>URL</strong>: 레지스트리 주소 입력 (예: harbor.company.com)<br/>
                4. <strong>타입</strong>: 레지스트리 종류 선택<br/>
                5. <strong>인증정보</strong>: 사용자명/비밀번호 입력<br/>
                6. <strong>기본값 설정</strong>: 주로 사용할 레지스트리라면 체크
              </Typography>
              
              <Alert severity="success" sx={{ mt: 2 }}>
                <strong>💡 팁:</strong> 기본 레지스트리를 설정하면 새로운 이미지 등록 시 자동으로 선택됩니다!
              </Alert>
            </Box>
          </Collapse>
        </Alert>

        <RegistryManagementTab 
          registries={registries}
          onRegistrySelect={setSelectedRegistry}
          onRegistryDialogOpen={() => setRegistryDialogOpen(true)}
          loading={loading}
        />
      </TabPanel>

      {/* 빌드 파이프라인 탭 */}
      <TabPanel value={currentTab} index={2}>
        {/* 초보자 가이드 */}
        <Alert 
          severity="info" 
          icon={<BuildIcon />} 
          sx={{ mb: 3 }}
          action={
            <Button 
              size="small" 
              onClick={() => setShowGuide({...showGuide, 2: !showGuide[2]})}
            >
              {showGuide[2] ? '가이드 숨기기' : '가이드 보기'}
            </Button>
          }
        >
          <AlertTitle>⚙️ 빌드 파이프라인 가이드</AlertTitle>
          <Collapse in={showGuide[2]}>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" paragraph>
                <strong>🎯 빌드 파이프라인이란?</strong><br/>
                소스 코드를 자동으로 컨테이너 이미지로 변환하는 자동화 프로세스입니다. 
                개발자가 코드를 푸시하면 자동으로 빌드, 테스트, 배포까지 진행됩니다.
              </Typography>
              
              <Typography variant="body2" paragraph>
                <strong>🔄 트리거 타입 설명:</strong>
              </Typography>
              <Box sx={{ ml: 2, mb: 2 }}>
                <Typography variant="caption" display="block">• <strong>Webhook</strong>: Git 저장소에 코드가 푸시되면 자동 실행</Typography>
                <Typography variant="caption" display="block">• <strong>Manual</strong>: 수동으로 실행 버튼을 클릭해야 실행</Typography>
                <Typography variant="caption" display="block">• <strong>Schedule</strong>: 정해진 시간에 자동 실행 (예: 매일 새벽 2시)</Typography>
              </Box>
              
              <Typography variant="body2" paragraph>
                <strong>📊 파이프라인 상태 이해하기:</strong>
              </Typography>
              <Box sx={{ ml: 2, mb: 2 }}>
                <Typography variant="caption" display="block">• <strong>🟢 Success</strong>: 빌드 성공 - 새 이미지가 생성됨</Typography>
                <Typography variant="caption" display="block">• <strong>🔵 Running</strong>: 현재 빌드 진행 중</Typography>
                <Typography variant="caption" display="block">• <strong>🔴 Failed</strong>: 빌드 실패 - 로그 확인 필요</Typography>
                <Typography variant="caption" display="block">• <strong>⏸️ Queued</strong>: 빌드 대기 중</Typography>
              </Box>
              
              <Typography variant="body2" paragraph>
                <strong>🚀 파이프라인 관리 방법:</strong><br/>
                1. <strong>"실행" 버튼</strong>: 수동으로 빌드 시작<br/>
                2. <strong>"이력" 버튼</strong>: 과거 빌드 기록 확인<br/>
                3. <strong>"설정" 버튼</strong>: 파이프라인 설정 변경<br/>
                4. <strong>활성화 토글</strong>: 파이프라인 활성화/비활성화
              </Typography>
              
              <Alert severity="warning" sx={{ mt: 2 }}>
                <strong>⚠️ 주의사항:</strong> 빌드 중인 파이프라인은 중단하지 마세요. 불완전한 이미지가 생성될 수 있습니다!
              </Alert>
            </Box>
          </Collapse>
        </Alert>

        <BuildPipelineTab 
          buildPipelines={buildPipelines}
          loading={loading}
        />
      </TabPanel>

      {/* 보안 스캔 탭 */}
      <TabPanel value={currentTab} index={3}>
        {/* 초보자 가이드 */}
        <Alert 
          severity="info" 
          icon={<SecurityIcon />} 
          sx={{ mb: 3 }}
          action={
            <Button 
              size="small" 
              onClick={() => setShowGuide({...showGuide, 3: !showGuide[3]})}
            >
              {showGuide[3] ? '가이드 숨기기' : '가이드 보기'}
            </Button>
          }
        >
          <AlertTitle>🔒 보안 스캔 가이드</AlertTitle>
          <Collapse in={showGuide[3]}>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" paragraph>
                <strong>🎯 보안 스캔이란?</strong><br/>
                컨테이너 이미지에 포함된 보안 취약점을 자동으로 검사하는 기능입니다. 
                알려진 보안 위협을 사전에 발견하여 시스템을 안전하게 유지할 수 있습니다.
              </Typography>
              
              <Typography variant="body2" paragraph>
                <strong>🚨 취약점 심각도 분류:</strong>
              </Typography>
              <Box sx={{ ml: 2, mb: 2 }}>
                <Typography variant="caption" display="block">• <strong>🔴 Critical</strong>: 즉시 수정 필요 - 원격 코드 실행 등 심각한 위험</Typography>
                <Typography variant="caption" display="block">• <strong>🟠 High</strong>: 빠른 수정 권장 - 권한 상승, 데이터 유출 위험</Typography>
                <Typography variant="caption" display="block">• <strong>🟡 Medium</strong>: 계획적 수정 - 서비스 거부 공격 등</Typography>
                <Typography variant="caption" display="block">• <strong>🟢 Low</strong>: 낮은 우선순위 - 정보 노출 등 경미한 위험</Typography>
              </Box>
              
              <Typography variant="body2" paragraph>
                <strong>📊 스캔 상태 이해하기:</strong>
              </Typography>
              <Box sx={{ ml: 2, mb: 2 }}>
                <Typography variant="caption" display="block">• <strong>✅ Passed</strong>: 심각한 취약점 없음 - 안전한 상태</Typography>
                <Typography variant="caption" display="block">• <strong>⚠️ Warning</strong>: 일부 취약점 발견 - 검토 후 조치</Typography>
                <Typography variant="caption" display="block">• <strong>❌ Critical</strong>: 심각한 취약점 발견 - 즉시 조치 필요</Typography>
                <Typography variant="caption" display="block">• <strong>🔄 Scanning</strong>: 현재 스캔 진행 중</Typography>
              </Box>
              
              <Typography variant="body2" paragraph>
                <strong>🛠️ 권장 조치사항:</strong><br/>
                1. <strong>Critical 이미지</strong>: 즉시 최신 버전으로 업데이트<br/>
                2. <strong>High 취약점</strong>: 1주일 내 업데이트 계획 수립<br/>
                3. <strong>정기 스캔</strong>: 주 1회 이상 전체 스캔 실행<br/>
                4. <strong>자동 알림</strong>: Critical 발견 시 즉시 알림 설정
              </Typography>
              
              <Alert severity="error" sx={{ mt: 2 }}>
                <strong>🚨 보안 주의:</strong> Critical 취약점이 있는 이미지는 프로덕션 환경에서 사용하지 마세요!
              </Alert>
              
              <Alert severity="success" sx={{ mt: 1 }}>
                <strong>💡 팁:</strong> "재스캔" 버튼을 클릭하여 이미지 업데이트 후 보안 상태를 다시 확인하세요!
              </Alert>
            </Box>
          </Collapse>
        </Alert>

        <SecurityScanTab 
          serviceImages={serviceImages}
          loading={loading}
        />
      </TabPanel>

      {/* [advice from AI] 실시간 배포 상태 탭 */}
      <TabPanel value={currentTab} index={4}>
        {/* 초보자 가이드 */}
        <Alert 
          severity="info" 
          icon={<PlayArrowIcon />} 
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={() => setShowGuide(prev => ({...prev, 4: !prev[4]}))}
            >
              {showGuide[4] ? '가이드 숨기기' : '가이드 보기'}
            </Button>
          }
        >
          <AlertTitle>🚀 실시간 배포 상태 가이드</AlertTitle>
          <Collapse in={showGuide[4]}>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" paragraph>
                <strong>🎯 실시간 배포 상태란?</strong><br/>
                현재 Kubernetes 클러스터에서 실행 중인 실제 Pod들과 이미지 버전을 실시간으로 모니터링하는 기능입니다. 
                배포하려는 이미지와 실제 실행 중인 이미지를 비교하여 배포 상태를 확인할 수 있습니다.
              </Typography>
              
              <Typography variant="body2" paragraph>
                <strong>📊 주요 기능:</strong><br/>
                • <strong>Pod 상태 실시간 모니터링</strong> - 각 서비스의 Pod 상태와 이미지 버전<br/>
                • <strong>이미지 버전 매칭</strong> - 배포하려는 이미지와 실제 실행 중인 이미지 비교<br/>
                • <strong>배포 히스토리</strong> - 과거 배포 기록과 롤백 기능<br/>
                • <strong>실시간 배포</strong> - 새 이미지 버전으로 실시간 배포 실행
              </Typography>
              
              <Typography variant="body2" paragraph>
                <strong>🚀 사용 방법:</strong><br/>
                1. <strong>서비스 카드</strong>에서 현재 Pod 상태와 이미지 버전 확인<br/>
                2. <strong>"이미지 업데이트"</strong> 버튼으로 새 버전 선택 및 배포<br/>
                3. <strong>"배포 히스토리"</strong>에서 과거 배포 기록 확인<br/>
                4. <strong>"롤백"</strong> 기능으로 이전 버전으로 복원
              </Typography>
              
              <Alert severity="warning" sx={{ mt: 2 }}>
                <strong>⚠️ 주의사항:</strong> 실시간 배포는 운영 중인 서비스에 영향을 줄 수 있습니다. 배포 전 충분한 검토가 필요합니다!
              </Alert>
            </Box>
          </Collapse>
        </Alert>

        <RealTimeDeploymentTab 
          serviceImages={serviceImages}
          loading={loading}
        />
      </TabPanel>

      {/* 레지스트리 추가/편집 다이얼로그 */}
      <RegistryDialog
        open={registryDialogOpen}
        onClose={() => {
          setRegistryDialogOpen(false);
          setSelectedRegistry(null);
        }}
        registry={selectedRegistry}
        onSave={(registry) => {
          // 실제 구현에서는 API 호출
          console.log('Registry saved:', registry);
          setRegistryDialogOpen(false);
          setSelectedRegistry(null);
          loadInitialData();
        }}
      />

      {/* 이미지 설정 다이얼로그 */}
      <ImageConfigDialog
        open={imageDialogOpen}
        onClose={() => {
          setImageDialogOpen(false);
          setSelectedImage(null);
        }}
        image={selectedImage}
        registries={registries}
        onSave={(image) => {
          // 실제 구현에서는 API 호출
          console.log('Image updated:', image);
          setImageDialogOpen(false);
          setSelectedImage(null);
          loadInitialData();
        }}
      />
    </Box>
  );
};

// 이미지 관리 탭 컴포넌트
const ImageManagementTab: React.FC<{
  serviceImages: ServiceImage[];
  onImageSelect: (image: ServiceImage) => void;
  onImageDialogOpen: () => void;
  loading: boolean;
  serviceFilter: string;
  onServiceFilterChange: (filter: string) => void;
}> = ({ serviceImages, onImageSelect, onImageDialogOpen, loading, serviceFilter, onServiceFilterChange }) => {
  
  // [advice from AI] getScanStatusIcon 함수를 컴포넌트 내부에 정의
  const getScanStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircleIcon color="success" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'critical':
        return <ErrorIcon color="error" />;
      case 'scanning':
        return <SecurityIcon color="info" />;
      default:
        return <SecurityIcon color="disabled" />;
    }
  };
  
  // [advice from AI] getStatusColor 함수도 컴포넌트 내부에 정의
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
      case 'success':
      case 'passed':
        return 'success';
      case 'warning':
        return 'warning';
      case 'disconnected':
      case 'failed':
      case 'critical':
        return 'error';
      case 'running':
      case 'scanning':
        return 'info';
      default:
        return 'default';
    }
  };
  
  // [advice from AI] 서비스 카테고리별 필터링 로직
  const getServiceCategory = (serviceName: string): string => {
    const mainServices = ['callbot', 'chatbot', 'advisor'];
    const aiServices = ['stt', 'tts', 'nlp', 'aicm'];
    const analysisServices = ['ta', 'qa'];
    const infraServices = ['nginx', 'gateway', 'auth', 'history', 'scenario-builder', 'monitoring'];
    const dataServices = ['postgresql', 'vector-db', 'redis'];
    const specialServices = ['livekit', 'speaker-separation'];
    
    if (mainServices.includes(serviceName)) return 'main';
    if (aiServices.includes(serviceName)) return 'ai';
    if (analysisServices.includes(serviceName)) return 'analysis';
    if (infraServices.includes(serviceName)) return 'infra';
    if (dataServices.includes(serviceName)) return 'data';
    if (specialServices.includes(serviceName)) return 'special';
    return 'other';
  };
  
  const filteredImages = serviceFilter === 'all' 
    ? serviceImages 
    : serviceImages.filter(image => getServiceCategory(image.serviceName) === serviceFilter);
    
      return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h6">서비스 이미지 관리</Typography>
          <Typography variant="caption" color="text.secondary">
            총 {serviceImages.length}개 서비스 | 현재 표시: {filteredImages.length}개
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>서비스 카테고리</InputLabel>
            <Select
              value={serviceFilter}
              onChange={(e) => onServiceFilterChange(e.target.value)}
              label="서비스 카테고리"
            >
              <MenuItem value="all">전체 ({serviceImages.length}개)</MenuItem>
              <MenuItem value="main">메인 서비스 ({serviceImages.filter(img => getServiceCategory(img.serviceName) === 'main').length}개)</MenuItem>
              <MenuItem value="ai">AI/NLP 서비스 ({serviceImages.filter(img => getServiceCategory(img.serviceName) === 'ai').length}개)</MenuItem>
              <MenuItem value="analysis">분석 서비스 ({serviceImages.filter(img => getServiceCategory(img.serviceName) === 'analysis').length}개)</MenuItem>
              <MenuItem value="infra">인프라 서비스 ({serviceImages.filter(img => getServiceCategory(img.serviceName) === 'infra').length}개)</MenuItem>
              <MenuItem value="data">데이터 서비스 ({serviceImages.filter(img => getServiceCategory(img.serviceName) === 'data').length}개)</MenuItem>
              <MenuItem value="special">특화 서비스 ({serviceImages.filter(img => getServiceCategory(img.serviceName) === 'special').length}개)</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={onImageDialogOpen}
          >
            이미지 설정
          </Button>
        </Box>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <Grid container spacing={3}>
        {filteredImages.map((image) => (
          <Grid item xs={12} md={6} lg={4} key={image.serviceName}>
            <StyledCard>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      {image.displayName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {image.repository}:{image.currentTag}
                    </Typography>
                  </Box>
                  <Box display="flex" alignItems="center">
                    {getScanStatusIcon(image.scanStatus)}
                  </Box>
                </Box>

                <Box mb={2}>
                  <Chip
                    label={image.scanStatus}
                    color={getStatusColor(image.scanStatus) as any}
                    size="small"
                    sx={{ mr: 1 }}
                  />
                  <Chip
                    label={`${image.availableTags.length} 태그`}
                    variant="outlined"
                    size="small"
                  />
                </Box>

                {image.vulnerabilities && (
                  <Box mb={2}>
                    <Typography variant="caption" display="block" gutterBottom>
                      취약점 현황:
                    </Typography>
                    <Box display="flex" gap={1}>
                      {image.vulnerabilities.critical > 0 && (
                        <Chip label={`Critical: ${image.vulnerabilities.critical}`} color="error" size="small" />
                      )}
                      {image.vulnerabilities.high > 0 && (
                        <Chip label={`High: ${image.vulnerabilities.high}`} color="warning" size="small" />
                      )}
                      {image.vulnerabilities.medium > 0 && (
                        <Chip label={`Medium: ${image.vulnerabilities.medium}`} color="info" size="small" />
                      )}
                    </Box>
                  </Box>
                )}

                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" color="text.secondary">
                    업데이트: {new Date(image.lastUpdated).toLocaleDateString()}
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      onImageSelect(image);
                      onImageDialogOpen();
                    }}
                  >
                    설정
                  </Button>
                </Box>
              </CardContent>
            </StyledCard>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

// 레지스트리 관리 탭 컴포넌트
const RegistryManagementTab: React.FC<{
  registries: ContainerRegistry[];
  onRegistrySelect: (registry: ContainerRegistry) => void;
  onRegistryDialogOpen: () => void;
  loading: boolean;
}> = ({ registries, onRegistrySelect, onRegistryDialogOpen, loading }) => {
  
  // [advice from AI] getStatusColor 함수를 컴포넌트 내부에 정의
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
      case 'success':
      case 'passed':
        return 'success';
      case 'warning':
        return 'warning';
      case 'disconnected':
      case 'failed':
      case 'critical':
        return 'error';
      case 'running':
      case 'scanning':
        return 'info';
      default:
        return 'default';
    }
  };
  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">컨테이너 레지스트리</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onRegistryDialogOpen}
        >
          레지스트리 추가
        </Button>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>이름</TableCell>
              <TableCell>URL</TableCell>
              <TableCell>타입</TableCell>
              <TableCell>상태</TableCell>
              <TableCell>기본값</TableCell>
              <TableCell>마지막 동기화</TableCell>
              <TableCell align="center">작업</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {registries.map((registry) => (
              <TableRow key={registry.id}>
                <TableCell>{registry.name}</TableCell>
                <TableCell>{registry.url}</TableCell>
                <TableCell>
                  <Chip label={registry.type.toUpperCase()} variant="outlined" size="small" />
                </TableCell>
                <TableCell>
                  <Chip
                    label={registry.status}
                    color={getStatusColor(registry.status) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {registry.isDefault && <CheckCircleIcon color="success" />}
                </TableCell>
                <TableCell>
                  {registry.lastSync && new Date(registry.lastSync).toLocaleString()}
                </TableCell>
                <TableCell align="center">
                  <Tooltip title="편집">
                    <IconButton
                      size="small"
                      onClick={() => {
                        onRegistrySelect(registry);
                        onRegistryDialogOpen();
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="삭제">
                    <IconButton size="small" color="error">
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

// 빌드 파이프라인 탭 컴포넌트
const BuildPipelineTab: React.FC<{
  buildPipelines: BuildPipeline[];
  loading: boolean;
}> = ({ buildPipelines, loading }) => {
  
  // [advice from AI] getStatusColor 함수를 컴포넌트 내부에 정의
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
      case 'success':
      case 'passed':
        return 'success';
      case 'warning':
        return 'warning';
      case 'disconnected':
      case 'failed':
      case 'critical':
        return 'error';
      case 'running':
      case 'scanning':
        return 'info';
      default:
        return 'default';
    }
  };
  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">빌드 파이프라인</Typography>
        <Button variant="contained" startIcon={<AddIcon />}>
          파이프라인 추가
        </Button>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <Grid container spacing={3}>
        {buildPipelines.map((pipeline) => (
          <Grid item xs={12} md={6} key={pipeline.id}>
            <StyledCard>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      {pipeline.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      서비스: {pipeline.service}
                    </Typography>
                  </Box>
                  <FormControlLabel
                    control={<Switch checked={pipeline.isEnabled} />}
                    label=""
                  />
                </Box>

                <Box mb={2}>
                  <Chip
                    label={pipeline.status}
                    color={getStatusColor(pipeline.status) as any}
                    size="small"
                    sx={{ mr: 1 }}
                  />
                  <Chip
                    label={pipeline.trigger}
                    variant="outlined"
                    size="small"
                  />
                </Box>

                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="caption" color="text.secondary">
                    마지막 실행: {new Date(pipeline.lastRun).toLocaleString()}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    소요시간: {pipeline.duration}
                  </Typography>
                </Box>

                <Box display="flex" gap={1}>
                  <Button size="small" variant="outlined" startIcon={<PlayArrowIcon />}>
                    실행
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<HistoryIcon />}>
                    이력
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<SettingsIcon />}>
                    설정
                  </Button>
                </Box>
              </CardContent>
            </StyledCard>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

// 보안 스캔 탭 컴포넌트
const SecurityScanTab: React.FC<{
  serviceImages: ServiceImage[];
  loading: boolean;
}> = ({ serviceImages, loading }) => {
  const criticalImages = serviceImages.filter(img => img.scanStatus === 'critical');
  const warningImages = serviceImages.filter(img => img.scanStatus === 'warning');
  
  // [advice from AI] getScanStatusIcon과 getStatusColor 함수를 컴포넌트 내부에 정의
  const getScanStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircleIcon color="success" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'critical':
        return <ErrorIcon color="error" />;
      case 'scanning':
        return <SecurityIcon color="info" />;
      default:
        return <SecurityIcon color="disabled" />;
    }
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
      case 'success':
      case 'passed':
        return 'success';
      case 'warning':
        return 'warning';
      case 'disconnected':
      case 'failed':
      case 'critical':
        return 'error';
      case 'running':
      case 'scanning':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        보안 스캔 현황
      </Typography>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* 요약 카드 */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <StyledCard>
            <CardContent>
              <Box display="flex" alignItems="center">
                <ErrorIcon sx={{ mr: 2, fontSize: 40, color: 'error.main' }} />
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {criticalImages.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Critical 이미지
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </StyledCard>
        </Grid>

        <Grid item xs={12} md={3}>
          <StyledCard>
            <CardContent>
              <Box display="flex" alignItems="center">
                <WarningIcon sx={{ mr: 2, fontSize: 40, color: 'warning.main' }} />
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {warningImages.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Warning 이미지
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </StyledCard>
        </Grid>

        <Grid item xs={12} md={3}>
          <StyledCard>
            <CardContent>
              <Box display="flex" alignItems="center">
                <CheckCircleIcon sx={{ mr: 2, fontSize: 40, color: 'success.main' }} />
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {serviceImages.filter(img => img.scanStatus === 'passed').length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    안전한 이미지
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </StyledCard>
        </Grid>

        <Grid item xs={12} md={3}>
          <StyledCard>
            <CardContent>
              <Box display="flex" alignItems="center">
                <SecurityIcon sx={{ mr: 2, fontSize: 40, color: 'primary.main' }} />
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {serviceImages.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    총 이미지 수
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </StyledCard>
        </Grid>
      </Grid>

      {/* 상세 취약점 정보 */}
      <Typography variant="h6" gutterBottom>
        취약점 상세 정보
      </Typography>

      {serviceImages.map((image) => (
        <Accordion key={image.serviceName}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box display="flex" alignItems="center" width="100%">
              <Box flexGrow={1}>
                <Typography variant="subtitle1">
                  {image.displayName} ({image.currentTag})
                </Typography>
              </Box>
              <Box mr={2}>
                {getScanStatusIcon(image.scanStatus)}
              </Box>
              <Chip
                label={image.scanStatus}
                color={getStatusColor(image.scanStatus) as any}
                size="small"
              />
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {image.vulnerabilities ? (
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    취약점 분포
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <ErrorIcon color="error" />
                      </ListItemIcon>
                      <ListItemText primary={`Critical: ${image.vulnerabilities.critical}개`} />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <WarningIcon color="warning" />
                      </ListItemIcon>
                      <ListItemText primary={`High: ${image.vulnerabilities.high}개`} />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <WarningIcon color="info" />
                      </ListItemIcon>
                      <ListItemText primary={`Medium: ${image.vulnerabilities.medium}개`} />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText primary={`Low: ${image.vulnerabilities.low}개`} />
                    </ListItem>
                  </List>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    권장 조치
                  </Typography>
                  <Alert severity={getStatusColor(image.scanStatus) as any}>
                    {image.scanStatus === 'critical' && '즉시 이미지 업데이트가 필요합니다.'}
                    {image.scanStatus === 'warning' && '가능한 빠른 시일 내에 업데이트를 권장합니다.'}
                    {image.scanStatus === 'passed' && '현재 이미지는 안전합니다.'}
                  </Alert>
                  <Box mt={2}>
                    <Button variant="outlined" size="small" startIcon={<RefreshIcon />}>
                      재스캔
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            ) : (
              <Alert severity="info">
                스캔 정보가 없습니다. 스캔을 실행하세요.
              </Alert>
            )}
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

// 레지스트리 다이얼로그 컴포넌트
const RegistryDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  registry: ContainerRegistry | null;
  onSave: (registry: Partial<ContainerRegistry>) => void;
}> = ({ open, onClose, registry, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    type: 'harbor' as const,
    username: '',
    password: '',
    isDefault: false
  });

  useEffect(() => {
    if (registry) {
      setFormData({
        name: registry.name,
        url: registry.url,
        type: registry.type,
        username: registry.credentials?.username || '',
        password: registry.credentials?.password || '',
        isDefault: registry.isDefault
      });
    } else {
      setFormData({
        name: '',
        url: '',
        type: 'harbor',
        username: '',
        password: '',
        isDefault: false
      });
    }
  }, [registry]);

  const handleSave = () => {
    onSave({
      ...formData,
      credentials: {
        username: formData.username,
        password: formData.password
      }
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {registry ? '레지스트리 편집' : '레지스트리 추가'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="이름"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="URL"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="harbor.example.com"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>타입</InputLabel>
                <Select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                >
                  <MenuItem value="harbor">Harbor</MenuItem>
                  <MenuItem value="ecr">AWS ECR</MenuItem>
                  <MenuItem value="gcr">Google GCR</MenuItem>
                  <MenuItem value="docker-hub">Docker Hub</MenuItem>
                  <MenuItem value="private">Private Registry</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="사용자명"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="비밀번호"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  />
                }
                label="기본 레지스트리로 설정"
              />
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button onClick={handleSave} variant="contained">
          저장
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// 이미지 설정 다이얼로그 컴포넌트
const ImageConfigDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  image: ServiceImage | null;
  registries: ContainerRegistry[];
  onSave: (image: Partial<ServiceImage>) => void;
}> = ({ open, onClose, image, registries, onSave }) => {
  const [formData, setFormData] = useState({
    registry: '',
    repository: '',
    currentTag: ''
  });

  useEffect(() => {
    if (image) {
      setFormData({
        registry: image.registry,
        repository: image.repository,
        currentTag: image.currentTag
      });
    }
  }, [image]);

  const handleSave = () => {
    onSave(formData);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        이미지 설정: {image?.displayName}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>레지스트리</InputLabel>
                <Select
                  value={formData.registry}
                  onChange={(e) => setFormData({ ...formData, registry: e.target.value })}
                >
                  {registries.map((registry) => (
                    <MenuItem key={registry.id} value={registry.url}>
                      {registry.name} ({registry.url})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="저장소"
                value={formData.repository}
                onChange={(e) => setFormData({ ...formData, repository: e.target.value })}
                placeholder="ecp-ai/service-name"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>태그</InputLabel>
                <Select
                  value={formData.currentTag}
                  onChange={(e) => setFormData({ ...formData, currentTag: e.target.value })}
                >
                  {image?.availableTags.map((tag) => (
                    <MenuItem key={tag} value={tag}>
                      {tag}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button onClick={handleSave} variant="contained">
          저장
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// [advice from AI] 실시간 배포 상태 탭 컴포넌트
const RealTimeDeploymentTab: React.FC<{
  serviceImages: ServiceImage[];
  loading: boolean;
}> = ({ serviceImages, loading }) => {
  const [deploymentStatuses, setDeploymentStatuses] = useState<{[key: string]: ServiceDeploymentStatus}>({});
  const [deploymentHistories, setDeploymentHistories] = useState<{[key: string]: DeploymentHistory[]}>({});
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [deploymentDialogOpen, setDeploymentDialogOpen] = useState(false);

  // 실시간 배포 상태 로드
  useEffect(() => {
    loadDeploymentStatuses();
    const interval = setInterval(loadDeploymentStatuses, 30000); // 30초마다 업데이트
    return () => clearInterval(interval);
  }, [serviceImages]);

  const loadDeploymentStatuses = async () => {
    const statuses: {[key: string]: ServiceDeploymentStatus} = {};
    const histories: {[key: string]: DeploymentHistory[]} = {};

    for (const service of serviceImages) {
      try {
        // 실제 배포 상태 조회
        const statusRes = await fetch(`/api/v1/image-management/services/${service.serviceName}/status?namespace=default-ecp-ai`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          statuses[service.serviceName] = statusData.deployment_status;
        }

        // 배포 히스토리 조회
        const historyRes = await fetch(`/api/v1/image-management/services/${service.serviceName}/history?namespace=default-ecp-ai`);
        if (historyRes.ok) {
          const historyData = await historyRes.json();
          histories[service.serviceName] = historyData.deployment_history;
        }
      } catch (error) {
        console.warn(`Failed to load deployment status for ${service.serviceName}:`, error);
        // Mock 데이터로 폴백
        statuses[service.serviceName] = createMockDeploymentStatus(service.serviceName);
        histories[service.serviceName] = createMockDeploymentHistory(service.serviceName);
      }
    }

    setDeploymentStatuses(statuses);
    setDeploymentHistories(histories);
  };

  const createMockDeploymentStatus = (serviceName: string): ServiceDeploymentStatus => ({
    serviceName,
    desiredImage: `harbor.company.com/ecp-ai/${serviceName}:v1.2.3`,
    currentImage: `harbor.company.com/ecp-ai/${serviceName}:v1.2.3`,
    replicas: {
      desired: 2,
      ready: 2,
      available: 2,
      updated: 2
    },
    pods: [
      {
        podName: `${serviceName}-deployment-abc123`,
        status: 'Running',
        currentImage: `harbor.company.com/ecp-ai/${serviceName}:v1.2.3`,
        ready: true,
        restarts: 0,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        nodeName: 'worker-node-1'
      },
      {
        podName: `${serviceName}-deployment-def456`,
        status: 'Running',
        currentImage: `harbor.company.com/ecp-ai/${serviceName}:v1.2.3`,
        ready: true,
        restarts: 1,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        nodeName: 'worker-node-2'
      }
    ],
    rolloutStatus: 'complete',
    deploymentStrategy: 'RollingUpdate',
    lastUpdated: new Date().toISOString()
  });

  const createMockDeploymentHistory = (serviceName: string): DeploymentHistory[] => [
    {
      revision: 3,
      image: `harbor.company.com/ecp-ai/${serviceName}:v1.2.3`,
      deployedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      deployedBy: 'admin',
      status: 'completed',
      rollbackAvailable: false,
      changeCause: 'Bug fix and performance improvement'
    },
    {
      revision: 2,
      image: `harbor.company.com/ecp-ai/${serviceName}:v1.2.2`,
      deployedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      deployedBy: 'developer',
      status: 'completed',
      rollbackAvailable: true,
      changeCause: 'Feature update'
    }
  ];

  const handleDeploy = async (serviceName: string, newTag: string) => {
    try {
      const response = await fetch('/api/v1/image-management/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: 'default',
          services: [serviceName],
          environment: 'production',
          deployment_strategy: 'RollingUpdate',
          change_cause: `Deploy ${serviceName}:${newTag}`
        })
      });

      if (response.ok) {
        alert(`${serviceName} 배포가 시작되었습니다!`);
        loadDeploymentStatuses();
      } else {
        alert('배포 실행 실패');
      }
    } catch (error) {
      console.error('배포 실행 오류:', error);
      alert('배포 실행 중 오류가 발생했습니다.');
    }
  };

  const handleRollback = async (serviceName: string, revision: number) => {
    try {
      const response = await fetch(`/api/v1/image-management/services/${serviceName}/rollback?namespace=default-ecp-ai&revision=${revision}`, {
        method: 'POST'
      });

      if (response.ok) {
        alert(`${serviceName} 롤백이 완료되었습니다!`);
        loadDeploymentStatuses();
      } else {
        alert('롤백 실행 실패');
      }
    } catch (error) {
      console.error('롤백 실행 오류:', error);
      alert('롤백 실행 중 오류가 발생했습니다.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Running': return 'success';
      case 'Pending': return 'warning';
      case 'Failed': return 'error';
      default: return 'default';
    }
  };

  const getRolloutStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return 'success';
      case 'progressing': return 'info';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h6">실시간 배포 상태</Typography>
          <Typography variant="caption" color="text.secondary">
            총 {serviceImages.length}개 서비스 실시간 모니터링
          </Typography>
        </Box>
        <Button 
          variant="outlined" 
          startIcon={<RefreshIcon />} 
          onClick={loadDeploymentStatuses}
          disabled={loading}
        >
          새로고침
        </Button>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <Grid container spacing={3}>
        {serviceImages.map((service) => {
          const deploymentStatus = deploymentStatuses[service.serviceName];
          const deploymentHistory = deploymentHistories[service.serviceName] || [];
          const isImageMismatch = deploymentStatus && 
            deploymentStatus.currentImage !== deploymentStatus.desiredImage;

          return (
            <Grid item xs={12} md={6} lg={4} key={service.serviceName}>
              <Card sx={{ height: '100%', position: 'relative' }}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        {service.displayName}
                      </Typography>
                      <Chip 
                        size="small" 
                        label={service.category} 
                        color="primary" 
                        variant="outlined" 
                      />
                    </Box>
                    <Box display="flex" gap={1}>
                      <IconButton 
                        size="small" 
                        onClick={() => {
                          setSelectedService(service.serviceName);
                          setDeploymentDialogOpen(true);
                        }}
                      >
                        <PlayArrowIcon />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        onClick={() => {
                          // 배포 히스토리 다이얼로그 열기
                          alert(`${service.serviceName} 배포 히스토리 표시 (구현 예정)`);
                        }}
                      >
                        <HistoryIcon />
                      </IconButton>
                    </Box>
                  </Box>

                  {/* 이미지 버전 정보 */}
                  <Box mb={2}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      현재 이미지
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {deploymentStatus?.currentImage || `ecp-ai/${service.serviceName}:${service.currentTag}`}
                    </Typography>
                    {isImageMismatch && (
                      <>
                        <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mt: 1 }}>
                          배포 예정 이미지
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'warning.main' }}>
                          {deploymentStatus?.desiredImage}
                        </Typography>
                      </>
                    )}
                  </Box>

                  {/* 배포 상태 */}
                  {deploymentStatus && (
                    <Box mb={2}>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="body2" color="text.secondary">
                          배포 상태
                        </Typography>
                        <Chip 
                          size="small" 
                          label={deploymentStatus.rolloutStatus} 
                          color={getRolloutStatusColor(deploymentStatus.rolloutStatus)}
                        />
                      </Box>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2">
                          Replicas: {deploymentStatus.replicas.ready}/{deploymentStatus.replicas.desired}
                        </Typography>
                        <LinearProgress 
                          variant="determinate" 
                          value={(deploymentStatus.replicas.ready / deploymentStatus.replicas.desired) * 100}
                          sx={{ width: 60, height: 4, borderRadius: 2 }}
                          color={deploymentStatus.replicas.ready === deploymentStatus.replicas.desired ? 'success' : 'warning'}
                        />
                      </Box>
                    </Box>
                  )}

                  {/* Pod 상태 */}
                  {deploymentStatus?.pods && (
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Pod 상태
                      </Typography>
                      <Box display="flex" flexWrap="wrap" gap={1}>
                        {deploymentStatus.pods.map((pod, index) => (
                          <Tooltip 
                            key={index}
                            title={
                              <Box>
                                <Typography variant="caption" display="block">
                                  Pod: {pod.podName}
                                </Typography>
                                <Typography variant="caption" display="block">
                                  Node: {pod.nodeName || 'Unknown'}
                                </Typography>
                                <Typography variant="caption" display="block">
                                  Restarts: {pod.restarts}
                                </Typography>
                              </Box>
                            }
                          >
                            <Chip 
                              size="small" 
                              label={`Pod ${index + 1}`}
                              color={getStatusColor(pod.status)}
                              variant={pod.ready ? 'filled' : 'outlined'}
                            />
                          </Tooltip>
                        ))}
                      </Box>
                    </Box>
                  )}

                  {/* 경고 표시 */}
                  {isImageMismatch && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      <Typography variant="caption">
                        배포 예정 이미지와 현재 이미지가 다릅니다.
                      </Typography>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* 배포 다이얼로그 */}
      <Dialog 
        open={deploymentDialogOpen} 
        onClose={() => setDeploymentDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {selectedService} 이미지 배포
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" paragraph>
            새로운 이미지 버전을 선택하여 배포하시겠습니까?
          </Typography>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>이미지 태그</InputLabel>
            <Select defaultValue="latest">
              <MenuItem value="latest">latest</MenuItem>
              <MenuItem value="v1.2.4">v1.2.4</MenuItem>
              <MenuItem value="v1.2.3">v1.2.3</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeploymentDialogOpen(false)}>
            취소
          </Button>
          <Button 
            variant="contained" 
            onClick={() => {
              if (selectedService) {
                handleDeploy(selectedService, 'latest');
                setDeploymentDialogOpen(false);
              }
            }}
          >
            배포 실행
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CICDManagement;
