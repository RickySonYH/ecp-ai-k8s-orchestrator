// [advice from AI] 통합 테넌트 데이터 서비스 - 데모/실사용 모드 통합 인터페이스
/**
 * TenantDataService
 * - 데모 모드와 실사용 모드를 통합하는 단일 인터페이스
 * - 모드에 따라 적절한 데이터 소스로 자동 라우팅
 * - 일관된 API로 프론트엔드에서 사용
 */

// [advice from AI] DemoDataManager 제거됨 - 실제 데이터만 사용
// import DemoDataManager, { TenantSummary, TenantCreateRequest, ServiceRequirements } from './DemoDataManager.ts';

// [advice from AI] 누락된 타입 정의 추가
export interface TenantSummary {
  tenant_id: string;
  name: string;
  description?: string;
  preset: string;
  status: string;
  created_at: string;
  updated_at?: string;
  service_requirements: ServiceRequirements;
  services_count?: number;
  dataSource?: string;
  is_demo?: boolean;
  estimated_resources?: {
    gpu_count: number;
    cpu_cores: number;
    memory_gb: number;
  };
  // [advice from AI] 통합 대시보드용 추가 필드
  cpu_usage?: number;
  memory_usage?: number;
  storage_usage?: number;
  gpu_usage?: number;
  service_config?: {
    callbot: number;
    chatbot: number;
    advisor: number;
    stt: number;
    tts: number;
    ta: number;
    qa: number;
  };
  gpu_info?: {
    type: string;
    allocated: number;
    utilization: number;
  };
}

export interface TenantCreateRequest {
  name: string;
  description?: string;
  preset: string;
  service_requirements: ServiceRequirements;
  tenant_id?: string;
  gpu_type?: string;
}

export interface ServiceRequirements {
  callbot: number;
  chatbot: number;
  advisor: number;
  stt: number;
  tts: number;
  ta: number;
  qa: number;
}

export interface DeploymentStatus {
  success: boolean;
  tenant_id: string;
  preset: string;
  estimated_resources?: any;
  deployment_status?: string;
  created_at: string;
}

export interface SystemMetrics {
  total_tenants: number;
  active_tenants: number;
  total_services: number;
  total_allocated_gpus: number;  // [advice from AI] App.tsx와 통일
  total_allocated_cpus: number;  // [advice from AI] App.tsx와 통일
  total_memory_allocated: string;
  system_health: 'healthy' | 'warning' | 'critical';
}

export interface TenantDataServiceInterface {
  // 테넌트 CRUD 작업
  getTenants(): Promise<TenantSummary[]>;
  getTenant(tenantId: string): Promise<TenantSummary | null>;
  createTenant(request: TenantCreateRequest): Promise<DeploymentStatus>;
  updateTenant(tenantId: string, updates: Partial<TenantSummary>): Promise<TenantSummary>;
  deleteTenant(tenantId: string): Promise<void>;
  
  // 상태 관리
  updateTenantStatus(tenantId: string, status: string): Promise<TenantSummary>;
  
  // 시스템 메트릭
  getSystemMetrics(): Promise<SystemMetrics>;
  
  // 데이터 관리
  exportData?(): Promise<string>;
  importData?(jsonData: string): Promise<void>;
  resetData?(): Promise<void>;
}

// [advice from AI] 데모 모드 데이터 서비스 구현 (백엔드 데모 DB 사용)
class DemoTenantDataService implements TenantDataServiceInterface {
  private baseUrl: string;
  // [advice from AI] DemoDataManager 제거됨
  // private demoManager: DemoDataManager;

  constructor(baseUrl: string = `${process.env.REACT_APP_API_BASE_URL}/api/v1`) {
    this.baseUrl = baseUrl;
    // [advice from AI] DemoDataManager 제거됨
    // this.demoManager = DemoDataManager.getInstance();
  }

  async getTenants(): Promise<TenantSummary[]> {
    try {
      const response = await fetch(`${this.baseUrl}/tenants/`, {
        headers: {
          'X-Demo-Mode': 'true',
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: 데모 테넌트 목록 조회 실패`);
      }
      const data = await response.json();
      return data.tenants || [];
    } catch (error) {
      console.error('데모 모드 테넌트 조회 실패:', error);
      // 폴백으로 로컬 데모 데이터 사용
      // [advice from AI] DemoDataManager 제거됨 - 빈 배열 반환
      return [];
    }
  }

  async getTenant(tenantId: string): Promise<TenantSummary | null> {
    try {
      const response = await fetch(`${this.baseUrl}/tenants/${tenantId}`, {
        headers: {
          'X-Demo-Mode': 'true',
          'Content-Type': 'application/json'
        }
      });
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: 데모 테넌트 조회 실패`);
      }
      return await response.json();
    } catch (error) {
      console.error('데모 모드 테넌트 조회 실패:', error);
      // 폴백으로 로컬 데모 데이터 사용
      // [advice from AI] DemoDataManager 제거됨 - null 반환
      return null;
    }
  }

  async createTenant(request: TenantCreateRequest): Promise<DeploymentStatus> {
    try {
      // [advice from AI] DemoDataManager 제거됨 - Mock 테넌트 생성
      const tenant: TenantSummary = {
        tenant_id: `demo-${Date.now()}`,
        name: request.name,
        description: request.description,
        preset: request.preset,
        status: 'deploying',
        created_at: new Date().toISOString(),
        service_requirements: request.service_requirements
      };
      
      // 데모에서는 즉시 "배포 완료" 상태로 시뮬레이션
      setTimeout(async () => {
        // [advice from AI] Mock 상태 업데이트
        console.log(`Mock: Tenant ${tenant.tenant_id} status updated to running`);
      }, 2000);

      return {
        success: true,
        tenant_id: tenant.tenant_id,
        preset: tenant.preset,
        deployment_status: 'pending',
        created_at: tenant.created_at,
        estimated_resources: {
          gpu_count: this.calculateGpuCount(request.service_requirements),
          cpu_cores: this.calculateCpuCores(request.service_requirements),
          memory_gb: this.calculateMemoryGb(request.service_requirements)
        }
      };
    } catch (error) {
      throw new Error(`데모 테넌트 생성 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  }

  async updateTenant(tenantId: string, updates: Partial<TenantSummary>): Promise<TenantSummary> {
    // [advice from AI] DemoDataManager 제거됨 - Mock 업데이트
    const mockTenant: TenantSummary = {
      tenant_id: tenantId,
      name: updates.name || 'Demo Tenant',
      preset: updates.preset || 'micro',
      status: updates.status || 'running',
      created_at: new Date().toISOString(),
      service_requirements: updates.service_requirements || {
        callbot: 0, chatbot: 0, advisor: 0, stt: 0, tts: 0, ta: 0, qa: 0
      }
    };
    return mockTenant;
  }

  async deleteTenant(tenantId: string): Promise<void> {
    // [advice from AI] DemoDataManager 제거됨 - Mock 삭제
    console.log(`Mock: Tenant ${tenantId} deleted`);
  }

  async updateTenantStatus(tenantId: string, status: string): Promise<TenantSummary> {
    // [advice from AI] DemoDataManager 제거됨 - Mock 상태 업데이트
    const mockTenant: TenantSummary = {
      tenant_id: tenantId,
      name: 'Demo Tenant',
      preset: 'micro',
      status: status,
      created_at: new Date().toISOString(),
      service_requirements: {
        callbot: 0, chatbot: 0, advisor: 0, stt: 0, tts: 0, ta: 0, qa: 0
      }
    };
    return mockTenant;
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    const tenants = await this.getTenants();
    const runningTenants = tenants.filter(t => t.status === 'running');
    
    // 데모용 시뮬레이션 메트릭
    return {
      total_tenants: tenants.length,
      active_tenants: runningTenants.length,
      total_services: tenants.reduce((sum, t) => sum + (t.services_count || 0), 0),
      total_allocated_gpus: Math.min(20, runningTenants.length * 2),  // [advice from AI] GPU 개수로 변경
      total_allocated_cpus: Math.min(100, runningTenants.length * 4), // [advice from AI] CPU 코어 수로 변경
      total_memory_allocated: `${Math.min(500, runningTenants.length * 16)}Gi`, // [advice from AI] 메모리 추가
      system_health: runningTenants.length > 15 ? 'warning' : 'healthy'
    };
  }

  async exportData(): Promise<string> {
    // [advice from AI] DemoDataManager 제거됨 - Mock 내보내기
    return JSON.stringify({ tenants: [] });
  }

  async importData(jsonData: string): Promise<void> {
    // [advice from AI] DemoDataManager 제거됨 - Mock 가져오기
    console.log('Mock: Data imported');
  }

  async resetData(): Promise<void> {
    // [advice from AI] DemoDataManager 제거됨 - Mock 리셋
    console.log('Mock: Data reset');
  }

  // [advice from AI] 리소스 계산 헬퍼 메서드들
  private calculateGpuCount(serviceRequirements: ServiceRequirements): number {
    const totalChannels = serviceRequirements.callbot + serviceRequirements.advisor + serviceRequirements.stt + serviceRequirements.tts;
    const totalUsers = serviceRequirements.chatbot;
    
    let gpus = 0;
    gpus += Math.ceil(totalChannels / 50); // TTS 기준
    gpus += Math.ceil(totalUsers / 200); // NLP 기준
    
    return Math.max(1, gpus);
  }

  private calculateCpuCores(serviceRequirements: ServiceRequirements): number {
    const totalChannels = serviceRequirements.callbot + serviceRequirements.advisor + serviceRequirements.stt + serviceRequirements.tts;
    const totalUsers = serviceRequirements.chatbot;
    
    let cpus = 4; // 기본 인프라
    cpus += Math.ceil(totalChannels / 6.5); // STT 기준
    cpus += Math.ceil(totalUsers / 100); // 추가 처리
    
    return Math.max(4, cpus);
  }

  private calculateMemoryGb(serviceRequirements: ServiceRequirements): number {
    const totalServices = Object.values(serviceRequirements).filter(v => v > 0).length;
    return Math.max(8, totalServices * 4 + 8);
  }
}

// [advice from AI] 실사용 모드 데이터 서비스 구현
class ProductionTenantDataService implements TenantDataServiceInterface {
  private baseUrl: string;

  constructor(baseUrl: string = `${process.env.REACT_APP_API_BASE_URL}/api/v1`) {
    this.baseUrl = baseUrl;
  }

  async getTenants(): Promise<TenantSummary[]> {
    try {
      const response = await fetch(`${this.baseUrl}/tenants/`, {
        headers: {
          'X-Demo-Mode': 'false',
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: 테넌트 목록 조회 실패`);
      }
      const data = await response.json();
      return data.tenants || [];
    } catch (error) {
      console.error('실사용 모드 테넌트 조회 실패:', error);
      throw error;
    }
  }

  async getTenant(tenantId: string): Promise<TenantSummary | null> {
    try {
      const response = await fetch(`${this.baseUrl}/tenants/${tenantId}`);
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: 테넌트 조회 실패`);
      }
      return await response.json();
    } catch (error) {
      console.error('실사용 모드 테넌트 조회 실패:', error);
      throw error;
    }
  }

  async createTenant(request: TenantCreateRequest): Promise<DeploymentStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/tenants/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: request.tenant_id,
          service_requirements: request.service_requirements,
          gpu_type: request.gpu_type || 'auto',
          auto_deploy: true
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('실사용 모드 테넌트 생성 실패:', error);
      throw error;
    }
  }

  async updateTenant(tenantId: string, updates: Partial<TenantSummary>): Promise<TenantSummary> {
    try {
      const response = await fetch(`${this.baseUrl}/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: 테넌트 업데이트 실패`);
      }

      return await response.json();
    } catch (error) {
      console.error('실사용 모드 테넌트 업데이트 실패:', error);
      throw error;
    }
  }

  async deleteTenant(tenantId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/tenants/${tenantId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: 테넌트 삭제 실패`);
      }
    } catch (error) {
      console.error('실사용 모드 테넌트 삭제 실패:', error);
      throw error;
    }
  }

  async updateTenantStatus(tenantId: string, status: string): Promise<TenantSummary> {
    return await this.updateTenant(tenantId, { status });
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      const response = await fetch(`${this.baseUrl}/tenants/monitoring/system-metrics`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: 시스템 메트릭 조회 실패`);
      }
      return await response.json();
    } catch (error) {
      console.error('실사용 모드 시스템 메트릭 조회 실패:', error);
      
      // 폴백으로 기본 메트릭 반환
      const tenants = await this.getTenants();
      const runningTenants = tenants.filter(t => t.status === 'running');
      return {
        total_tenants: tenants.length,
        active_tenants: runningTenants.length,
        total_services: tenants.reduce((sum, t) => sum + (t.services_count || 0), 0),
        total_allocated_gpus: 0,
        total_allocated_cpus: 0,
        total_memory_allocated: '0Gi',
        system_health: 'healthy'
      };
    }
  }
}

// [advice from AI] 통합 테넌트 데이터 서비스 팩토리
export class TenantDataServiceFactory {
  static create(isDemoMode: boolean): TenantDataServiceInterface {
    if (isDemoMode) {
      return new DemoTenantDataService();
    } else {
      return new ProductionTenantDataService();
    }
  }
}

// [advice from AI] 기본 내보내기
export default TenantDataServiceFactory;
