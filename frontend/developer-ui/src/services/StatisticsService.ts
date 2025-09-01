// [advice from AI] 통계 서비스 - 실제 데이터베이스 기반 통계 API 호출
/**
 * StatisticsService
 * - 백엔드 통계 API와 통신
 * - 실시간 대시보드 데이터 제공
 */

// 통계 데이터 인터페이스
export interface StatisticsOverview {
  total_tenants: number;
  active_tenants: number;
  total_services: number;
  total_images: number;
  resource_usage: {
    cpu_total: number;
    memory_total: number;
    gpu_total: number;
  };
  recent_activity: Array<{
    tenant_name: string;
    action: string;
    timestamp: string;
  }>;
}

export interface ImageStatistics {
  total_images: number;
  active_images: number;
  inactive_images: number;
  category_stats: Record<string, number>;
  recent_images: Array<{
    service_name: string;
    display_name: string;
    category: string;
    created_at: string | null;
  }>;
}

export interface ServiceStatistics {
  total_services: number;
  active_services: number;
  service_distribution: Record<string, number>;
  resource_usage: Record<string, {
    cpu: number;
    memory: number;
    gpu: number;
  }>;
}

export interface TenantStatistics {
  total_tenants: number;
  active_tenants: number;
  tenant_distribution: Record<string, number>;
  resource_allocation: Record<string, {
    cpu: number;
    memory: number;
    gpu: number;
  }>;
}

export interface ResourceStatistics {
  total_resources: {
    cpu: number;
    memory: number;
    gpu: number;
  };
  allocated_resources: {
    cpu: number;
    memory: number;
    gpu: number;
  };
  utilization: {
    cpu: number;
    memory: number;
    gpu: number;
  };
}

class StatisticsService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8001';
  }

  // 전체 개요 통계
  async getOverview(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/v1/overview`);
    if (!response.ok) {
      throw new Error('통계 데이터를 가져오는데 실패했습니다');
    }
    return response.json();
  }

  // 이미지 통계
  async getImageStatistics(): Promise<ImageStatistics> {
    const response = await fetch(`${this.baseUrl}/api/v1/images`);
    if (!response.ok) {
      throw new Error('이미지 통계를 가져오는데 실패했습니다');
    }
    return response.json();
  }

  // 서비스 통계
  async getServiceStatistics(): Promise<ServiceStatistics> {
    const response = await fetch(`${this.baseUrl}/api/v1/services`);
    if (!response.ok) {
      throw new Error('서비스 통계를 가져오는데 실패했습니다');
    }
    return response.json();
  }

  // 테넌트 통계
  async getTenantStatistics(): Promise<TenantStatistics> {
    const response = await fetch(`${this.baseUrl}/api/v1/tenants`);
    if (!response.ok) {
      throw new Error('테넌트 통계를 가져오는데 실패했습니다');
    }
    return response.json();
  }

  // 리소스 통계
  async getResourceStatistics(): Promise<ResourceStatistics> {
    const response = await fetch(`${this.baseUrl}/api/v1/resources`);
    if (!response.ok) {
      throw new Error('리소스 통계를 가져오는데 실패했습니다');
    }
    return response.json();
  }

  // 모든 통계 한번에 가져오기
  async getAllStatistics() {
    try {
      const [overview, images, services, tenants, resources] = await Promise.all([
        this.getOverview(),
        this.getImageStatistics(),
        this.getServiceStatistics(),
        this.getTenantStatistics(),
        this.getResourceStatistics()
      ]);

      return {
        overview,
        images,
        services,
        tenants,
        resources
      };
    } catch (error) {
      console.error('통계 데이터 로드 실패:', error);
      throw error;
    }
  }
}

export default new StatisticsService();