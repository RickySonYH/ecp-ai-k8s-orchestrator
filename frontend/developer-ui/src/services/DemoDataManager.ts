// [advice from AI] 데모 모드 데이터 영구화 관리자 - 로컬 스토리지 기반 CRUD
/**
 * DemoDataManager
 * - 데모 모드에서 테넌트 데이터 영구 저장 및 관리
 * - 로컬 스토리지 기반으로 페이지 새로고침 시에도 데이터 유지
 * - 기존 데모 테넌트 + 사용자 생성 테넌트 통합 관리
 */

export interface TenantSummary {
  tenant_id: string;
  name?: string;
  status: string;
  preset: string;
  is_demo: boolean;
  services_count: number;
  created_at: string;
  dataSource: 'demo' | 'user_created';
  metadata?: {
    createdBy: string;
    lastModified: string;
    version: number;
  };
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

export interface TenantCreateRequest {
  tenant_id: string;
  name?: string;
  service_requirements: ServiceRequirements;
  gpu_type: string;
  preset?: string;
}

interface DemoDataStorage {
  predefinedTenants: TenantSummary[];
  userCreatedTenants: TenantSummary[];
  lastUpdated: string;
  version: number;
}

export class DemoDataManager {
  private static instance: DemoDataManager;
  private storageKey = 'ecp-ai-demo-data';
  private version = 1;

  // [advice from AI] 기본 데모 테넌트 데이터 (기존 20개)
  private readonly predefinedTenants: TenantSummary[] = [
    // 메인 서비스 테넌시
    {
      tenant_id: 'demo-tenant-1',
      name: '글로벌 콜센터',
      status: 'running',
      preset: 'large',
      is_demo: true,
      services_count: 5,
      created_at: '2024-01-15T10:30:00Z',
      dataSource: 'demo'
    },
    {
      tenant_id: 'demo-tenant-2',
      name: '스마트 상담봇',
      status: 'running',
      preset: 'medium',
      is_demo: true,
      services_count: 3,
      created_at: '2024-01-14T15:20:00Z',
      dataSource: 'demo'
    },
    {
      tenant_id: 'demo-tenant-3',
      name: 'AI 어드바이저',
      status: 'running',
      preset: 'medium',
      is_demo: true,
      services_count: 4,
      created_at: '2024-01-13T09:15:00Z',
      dataSource: 'demo'
    },
    
    // AI/NLP 서비스 테넌시
    {
      tenant_id: 'demo-tenant-4',
      name: '음성 분석 서비스',
      status: 'running',
      preset: 'small',
      is_demo: true,
      services_count: 2,
      created_at: '2024-01-12T14:45:00Z',
      dataSource: 'demo'
    },
    {
      tenant_id: 'demo-tenant-5',
      name: 'TTS 음성합성',
      status: 'running',
      preset: 'small',
      is_demo: true,
      services_count: 2,
      created_at: '2024-01-11T11:20:00Z',
      dataSource: 'demo'
    },
    {
      tenant_id: 'demo-tenant-6',
      name: 'NLP 엔진',
      status: 'running',
      preset: 'medium',
      is_demo: true,
      services_count: 3,
      created_at: '2024-01-10T16:30:00Z',
      dataSource: 'demo'
    },
    {
      tenant_id: 'demo-tenant-7',
      name: 'AI 대화 관리',
      status: 'running',
      preset: 'large',
      is_demo: true,
      services_count: 6,
      created_at: '2024-01-09T13:15:00Z',
      dataSource: 'demo'
    },
    
    // 분석 서비스 테넌시
    {
      tenant_id: 'demo-tenant-8',
      name: 'TA 통계분석',
      status: 'running',
      preset: 'medium',
      is_demo: true,
      services_count: 3,
      created_at: '2024-01-08T10:45:00Z',
      dataSource: 'demo'
    },
    {
      tenant_id: 'demo-tenant-9',
      name: 'QA 품질관리',
      status: 'running',
      preset: 'small',
      is_demo: true,
      services_count: 2,
      created_at: '2024-01-07T14:20:00Z',
      dataSource: 'demo'
    },
    
    // 인프라 서비스 테넌시
    {
      tenant_id: 'demo-tenant-10',
      name: '웹 서버 클러스터',
      status: 'running',
      preset: 'large',
      is_demo: true,
      services_count: 4,
      created_at: '2024-01-06T09:30:00Z',
      dataSource: 'demo'
    },
    {
      tenant_id: 'demo-tenant-11',
      name: 'API 게이트웨이',
      status: 'running',
      preset: 'medium',
      is_demo: true,
      services_count: 3,
      created_at: '2024-01-05T11:45:00Z',
      dataSource: 'demo'
    },
    {
      tenant_id: 'demo-tenant-12',
      name: '권한 관리 시스템',
      status: 'running',
      preset: 'medium',
      is_demo: true,
      services_count: 2,
      created_at: '2024-01-04T15:10:00Z',
      dataSource: 'demo'
    },
    {
      tenant_id: 'demo-tenant-13',
      name: '대화 이력 저장소',
      status: 'running',
      preset: 'large',
      is_demo: true,
      services_count: 5,
      created_at: '2024-01-03T12:25:00Z',
      dataSource: 'demo'
    },
    {
      tenant_id: 'demo-tenant-14',
      name: '시나리오 빌더',
      status: 'running',
      preset: 'medium',
      is_demo: true,
      services_count: 3,
      created_at: '2024-01-02T16:40:00Z',
      dataSource: 'demo'
    },
    {
      tenant_id: 'demo-tenant-15',
      name: '시스템 모니터링',
      status: 'running',
      preset: 'medium',
      is_demo: true,
      services_count: 2,
      created_at: '2024-01-01T08:15:00Z',
      dataSource: 'demo'
    },
    
    // 데이터 서비스 테넌시
    {
      tenant_id: 'demo-tenant-16',
      name: '데이터베이스 클러스터',
      status: 'running',
      preset: 'large',
      is_demo: true,
      services_count: 4,
      created_at: '2023-12-31T20:30:00Z',
      dataSource: 'demo'
    },
    {
      tenant_id: 'demo-tenant-17',
      name: '벡터 데이터베이스',
      status: 'running',
      preset: 'medium',
      is_demo: true,
      services_count: 3,
      created_at: '2023-12-30T14:20:00Z',
      dataSource: 'demo'
    },
    {
      tenant_id: 'demo-tenant-18',
      name: '캐시 시스템',
      status: 'running',
      preset: 'medium',
      is_demo: true,
      services_count: 2,
      created_at: '2023-12-29T10:45:00Z',
      dataSource: 'demo'
    },
    
    // 특화 서비스 테넌시
    {
      tenant_id: 'demo-tenant-19',
      name: '실시간 통신',
      status: 'running',
      preset: 'medium',
      is_demo: true,
      services_count: 3,
      created_at: '2023-12-28T17:15:00Z',
      dataSource: 'demo'
    },
    {
      tenant_id: 'demo-tenant-20',
      name: '화자 분리 시스템',
      status: 'running',
      preset: 'small',
      is_demo: true,
      services_count: 2,
      created_at: '2023-12-27T13:50:00Z',
      dataSource: 'demo'
    }
  ];

  private constructor() {}

  // [advice from AI] 싱글톤 패턴으로 인스턴스 관리
  static getInstance(): DemoDataManager {
    if (!DemoDataManager.instance) {
      DemoDataManager.instance = new DemoDataManager();
    }
    return DemoDataManager.instance;
  }

  // [advice from AI] 로컬 스토리지에서 데이터 로드
  private loadFromStorage(): DemoDataStorage {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored) as DemoDataStorage;
        
        // 버전 체크 및 마이그레이션
        if (data.version !== this.version) {
          return this.migrateData(data);
        }
        
        return data;
      }
    } catch (error) {
      console.warn('데모 데이터 로드 실패, 기본값 사용:', error);
    }
    
    // 기본값 반환
    return {
      predefinedTenants: [...this.predefinedTenants],
      userCreatedTenants: [],
      lastUpdated: new Date().toISOString(),
      version: this.version
    };
  }

  // [advice from AI] 로컬 스토리지에 데이터 저장
  private saveToStorage(data: DemoDataStorage): void {
    try {
      data.lastUpdated = new Date().toISOString();
      data.version = this.version;
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('데모 데이터 저장 실패:', error);
      throw new Error('데모 데이터 저장에 실패했습니다. 로컬 스토리지 용량을 확인해주세요.');
    }
  }

  // [advice from AI] 데이터 마이그레이션 (버전 업그레이드 시)
  private migrateData(oldData: any): DemoDataStorage {
    console.log('데모 데이터 마이그레이션 수행:', oldData.version, '->', this.version);
    
    // 기본 구조로 마이그레이션
    const migratedData: DemoDataStorage = {
      predefinedTenants: [...this.predefinedTenants],
      userCreatedTenants: oldData.userCreatedTenants || [],
      lastUpdated: new Date().toISOString(),
      version: this.version
    };
    
    this.saveToStorage(migratedData);
    return migratedData;
  }

  // [advice from AI] 모든 테넌트 조회 (기본 데모 + 사용자 생성)
  async getTenants(): Promise<TenantSummary[]> {
    const data = this.loadFromStorage();
    return [...data.predefinedTenants, ...data.userCreatedTenants];
  }

  // [advice from AI] 특정 테넌트 조회
  async getTenant(tenantId: string): Promise<TenantSummary | null> {
    const allTenants = await this.getTenants();
    return allTenants.find(t => t.tenant_id === tenantId) || null;
  }

  // [advice from AI] 테넌트 생성
  async createTenant(request: TenantCreateRequest): Promise<TenantSummary> {
    const data = this.loadFromStorage();
    
    // 중복 ID 확인
    const existingTenant = await this.getTenant(request.tenant_id);
    if (existingTenant) {
      throw new Error(`테넌트 '${request.tenant_id}'가 이미 존재합니다.`);
    }

    // 프리셋 자동 감지
    const preset = this.detectPreset(request.service_requirements);
    const servicesCount = Object.values(request.service_requirements).filter(v => v > 0).length;

    const newTenant: TenantSummary = {
      tenant_id: request.tenant_id,
      name: request.name || `테넌트 ${request.tenant_id}`,
      status: 'pending',
      preset,
      is_demo: true,
      services_count: servicesCount,
      created_at: new Date().toISOString(),
      dataSource: 'user_created',
      metadata: {
        createdBy: 'demo-user',
        lastModified: new Date().toISOString(),
        version: 1
      }
    };

    // 사용자 생성 테넌트에 추가
    data.userCreatedTenants.push(newTenant);
    this.saveToStorage(data);

    return newTenant;
  }

  // [advice from AI] 테넌트 업데이트
  async updateTenant(tenantId: string, updates: Partial<TenantSummary>): Promise<TenantSummary> {
    const data = this.loadFromStorage();
    
    // 사용자 생성 테넌트에서만 업데이트 가능
    const tenantIndex = data.userCreatedTenants.findIndex(t => t.tenant_id === tenantId);
    if (tenantIndex === -1) {
      throw new Error(`업데이트할 수 없는 테넌트입니다: ${tenantId}`);
    }

    const updatedTenant = {
      ...data.userCreatedTenants[tenantIndex],
      ...updates,
      metadata: {
        ...data.userCreatedTenants[tenantIndex].metadata,
        lastModified: new Date().toISOString(),
        version: (data.userCreatedTenants[tenantIndex].metadata?.version || 1) + 1
      }
    };

    data.userCreatedTenants[tenantIndex] = updatedTenant;
    this.saveToStorage(data);

    return updatedTenant;
  }

  // [advice from AI] 테넌트 삭제
  async deleteTenant(tenantId: string): Promise<void> {
    const data = this.loadFromStorage();
    
    // 기본 데모 테넌트는 삭제 불가
    if (tenantId.startsWith('demo-tenant-')) {
      throw new Error('기본 데모 테넌트는 삭제할 수 없습니다.');
    }

    const tenantIndex = data.userCreatedTenants.findIndex(t => t.tenant_id === tenantId);
    if (tenantIndex === -1) {
      throw new Error(`테넌트를 찾을 수 없습니다: ${tenantId}`);
    }

    data.userCreatedTenants.splice(tenantIndex, 1);
    this.saveToStorage(data);
  }

  // [advice from AI] 테넌트 상태 변경
  async updateTenantStatus(tenantId: string, status: string): Promise<TenantSummary> {
    return await this.updateTenant(tenantId, { status });
  }

  // [advice from AI] 사용자 생성 테넌트만 조회
  async getUserCreatedTenants(): Promise<TenantSummary[]> {
    const data = this.loadFromStorage();
    return data.userCreatedTenants;
  }

  // [advice from AI] 데이터 통계 조회
  async getStatistics() {
    const data = this.loadFromStorage();
    return {
      totalTenants: data.predefinedTenants.length + data.userCreatedTenants.length,
      predefinedTenants: data.predefinedTenants.length,
      userCreatedTenants: data.userCreatedTenants.length,
      lastUpdated: data.lastUpdated,
      version: data.version
    };
  }

  // [advice from AI] 데이터 내보내기 (백업)
  async exportData(): Promise<string> {
    const data = this.loadFromStorage();
    return JSON.stringify(data, null, 2);
  }

  // [advice from AI] 데이터 가져오기 (복원)
  async importData(jsonData: string): Promise<void> {
    try {
      const importedData = JSON.parse(jsonData) as DemoDataStorage;
      
      // 데이터 유효성 검증
      if (!importedData.predefinedTenants || !importedData.userCreatedTenants) {
        throw new Error('잘못된 데이터 형식입니다.');
      }

      this.saveToStorage(importedData);
    } catch (error) {
      throw new Error(`데이터 가져오기 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  }

  // [advice from AI] 데이터 초기화
  async resetData(): Promise<void> {
    const freshData: DemoDataStorage = {
      predefinedTenants: [...this.predefinedTenants],
      userCreatedTenants: [],
      lastUpdated: new Date().toISOString(),
      version: this.version
    };
    
    this.saveToStorage(freshData);
  }

  // [advice from AI] 프리셋 자동 감지 로직
  private detectPreset(serviceRequirements: ServiceRequirements): string {
    const totalChannels = serviceRequirements.callbot + serviceRequirements.advisor + serviceRequirements.stt + serviceRequirements.tts;
    const totalUsers = serviceRequirements.chatbot;

    if (totalChannels < 10 && totalUsers < 50) {
      return 'micro';
    } else if (totalChannels < 100 && totalUsers < 500) {
      return 'small';
    } else if (totalChannels < 500 && totalUsers < 2000) {
      return 'medium';
    } else {
      return 'large';
    }
  }
}

export default DemoDataManager;
