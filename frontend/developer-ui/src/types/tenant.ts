// [advice from AI] ECP-AI 테넌시 관련 TypeScript 타입 정의
/**
 * ECP-AI Kubernetes Orchestrator 타입 정의
 * - 테넌시 관련 모든 타입
 * - API 요청/응답 모델
 * - UI 상태 관리 타입
 */

// 서비스 요구사항 타입
export interface ServiceRequirements {
  callbot: number;
  chatbot: number;
  advisor: number;
  stt: number;
  tts: number;
  ta: number;
  qa: number;
}

// GPU 타입 정의
export type GPUType = 't4' | 'v100' | 'l40s';
export type PresetType = 'micro' | 'small' | 'medium' | 'large';
export type DeploymentStatusType = 'in_progress' | 'completed' | 'failed' | 'manual';

// 리소스 예상 타입
export interface ResourceEstimation {
  gpu: {
    tts: number;
    nlp: number;
    aicm: number;
    total: number;
    recommended_type: GPUType;
  };
  cpu: {
    stt: number;
    ta: number;
    qa: number;
    infrastructure: number;
    total: number;
  };
  memory: {
    gpu_ram_gb: string;
    system_ram_gb: string;
    total_ram_gb: string;
  };
  storage: {
    service_servers_gb: string;
    database_tb: string;
    nas_tb: string;
    total_tb: string;
  };
}

// 테넌시 사양 타입
export interface TenantSpecs {
  tenantId: string;
  preset: PresetType;
  services: ServiceRequirements;
  resources: {
    gpu_type: GPUType;
    cpu_limit: string;
    memory_limit: string;
    gpu_limit: number;
    storage: string;
    gpu_count: number;
    cpu_cores: number;
    storage_tb: number;
  };
  sla_target: {
    availability: string;
    response_time: string;
  };
}

// API 요청 타입
export interface TenantCreateRequest {
  tenant_id: string;
  service_requirements: ServiceRequirements;
  gpu_type: GPUType | 'auto';
  auto_deploy: boolean;
}

// API 응답 타입
export interface TenantCreateResponse {
  success: boolean;
  tenant_id: string;
  preset: PresetType;
  estimated_resources: ResourceEstimation;
  deployment_status: DeploymentStatusType;
  created_at: string;
}

// 서비스 상태 타입
export interface ServiceStatus {
  name: string;
  replicas: {
    desired: number;
    available: number;
    ready: number;
  };
  status: 'Running' | 'Pending' | 'Failed' | 'Unknown';
  resources?: {
    cpu_usage?: number;
    memory_usage?: number;
    gpu_usage?: number;
  };
}

// SLA 메트릭 타입
export interface SLAMetrics {
  availability: number;
  response_time: number;
  error_rate: number;
  throughput: number;
}

// 테넌시 상태 응답 타입
export interface TenantStatusResponse {
  tenant_id: string;
  status: 'Running' | 'Pending' | 'Failed' | 'Deleting';
  services: ServiceStatus[];
  resources: {
    gpu: number;
    cpu: number;
    memory?: number;
  };
  sla_metrics: SLAMetrics;
  last_updated: string;
}

// 실시간 메트릭 타입
export interface RealtimeMetrics {
  tenant_id: string;
  timestamp: string;
  cpu_usage: number;
  memory_usage: number;
  gpu_usage: number;
  network_io: {
    rx: number;
    tx: number;
  };
  active_connections: number;
}

// 테넌시 요약 타입 (목록용)
export interface TenantSummary {
  tenant_id: string;
  status: string;
  preset: PresetType;
  services_count: number;
  created_at: string;
  last_activity?: string;
}

// 시스템 메트릭 타입
export interface SystemMetrics {
  total_tenants: number;
  total_services: number;
  total_gpu_usage: number;
  total_cpu_usage: number;
  total_memory_usage: number;
  system_health: 'healthy' | 'warning' | 'critical';
  uptime: string;
  version: string;
}

// 리소스 계산 요청/응답 타입
export interface ResourceCalculationRequest {
  callbot?: number;
  chatbot?: number;
  advisor?: number;
  stt?: number;
  tts?: number;
  ta?: number;
  qa?: number;
}

export interface ResourceCalculationResponse {
  preset: PresetType;
  total_channels: number;
  total_users: number;
  gpu_requirements: {
    tts: number;
    nlp: number;
    aicm: number;
    recommended_type: GPUType;
  };
  cpu_requirements: {
    stt: number;
    infrastructure: number;
  };
}

// 에러 응답 타입
export interface APIError {
  detail: string;
  status_code: number;
  timestamp: string;
}

// WebSocket 메시지 타입
export interface WebSocketMessage {
  type: 'metrics' | 'status' | 'error' | 'notification';
  data: RealtimeMetrics | TenantStatusResponse | APIError | string;
  timestamp: string;
}

// UI 상태 타입
export interface UIState {
  currentTab: number;
  selectedTenant: string | null;
  darkMode: boolean;
  drawerOpen: boolean;
  loading: boolean;
  error: string | null;
}

// 알림 타입
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

// 설정 타입
export interface AppSettings {
  darkMode: boolean;
  autoRefresh: boolean;
  refreshInterval: number;
  notifications: boolean;
  language: 'ko' | 'en';
}

// 차트 데이터 타입
export interface ChartDataPoint {
  timestamp: string;
  value: number;
  label?: string;
}

export interface MetricChart {
  title: string;
  data: ChartDataPoint[];
  unit: string;
  color: string;
}

// 테넌시 비교 타입
export interface TenantComparison {
  tenants: string[];
  metrics: {
    [tenantId: string]: {
      cpu_usage: number;
      memory_usage: number;
      gpu_usage: number;
      sla_score: number;
    };
  };
}

// 배포 이벤트 타입
export interface DeploymentEvent {
  id: string;
  tenant_id: string;
  service_name: string;
  action: 'create' | 'update' | 'delete' | 'scale';
  status: 'pending' | 'running' | 'completed' | 'failed';
  details: Record<string, any>;
  error_message?: string;
  created_at: string;
}

// 스케일링 이벤트 타입
export interface ScalingEvent {
  id: string;
  tenant_id: string;
  service_name: string;
  scale_type: 'up' | 'down';
  from_replicas: number;
  to_replicas: number;
  trigger_reason: string;
  created_at: string;
}
