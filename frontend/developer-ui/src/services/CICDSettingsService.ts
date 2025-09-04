// [advice from AI] CICD 설정 관리 서비스 - 실제 운영 환경 고려
/**
 * CICD Settings Service
 * 실제 운영 환경에서 사용할 CICD 설정 관리 서비스
 * - 글로벌 설정 (레지스트리, 보안정책, 모니터링, 개발도구)
 * - 실시간 상태 확인 및 검증
 * - 운영 환경 보안 고려
 */

// 타입 정의
export interface CICDGlobalSetting {
  id: number;
  setting_key: string;
  setting_category: 'registry' | 'security' | 'monitoring' | 'devtools';
  setting_value: Record<string, any>;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CICDTenantSetting {
  id: number;
  tenant_id: string;
  setting_key: string;
  setting_category: 'build_deploy' | 'permissions';
  setting_value: Record<string, any>;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 레지스트리 설정 타입
export interface RegistryConfig {
  url: string;
  username?: string;
  password?: string;
  is_default: boolean;
  ssl_verify: boolean;
  registry_type: 'harbor' | 'aws_ecr' | 'docker_hub' | 'azure_acr' | 'gcp_gcr';
  connection_status?: 'connected' | 'disconnected' | 'error';
  last_sync?: string;
}

// 보안정책 설정 타입
export interface SecurityPolicyConfig {
  enabled: boolean;
  cve_threshold: number;
  scan_on_build: boolean;
  block_on_high_cve: boolean;
  malware_scan_enabled: boolean;
  license_check_enabled: boolean;
  image_signing_enabled: boolean;
  cosign_enabled: boolean;
  registry_whitelist_enabled: boolean;
  approved_registries: string[];
}

// 모니터링 설정 타입
export interface MonitoringConfig {
  log_collection_enabled: boolean;
  retention_days: number;
  log_level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  slack_notifications: {
    enabled: boolean;
    webhook_url?: string;
    channels: string[];
  };
  email_notifications: {
    enabled: boolean;
    smtp_server?: string;
    recipients: string[];
  };
  metrics_collection: {
    enabled: boolean;
    prometheus_endpoint?: string;
    grafana_dashboard?: string;
  };
}

// 개발도구 설정 타입
export interface DevToolsConfig {
  sonarqube: {
    enabled: boolean;
    server_url?: string;
    quality_gate_required: boolean;
    coverage_threshold: number;
  };
  automated_testing: {
    unit_tests_required: boolean;
    integration_tests_required: boolean;
    e2e_tests_required: boolean;
    coverage_threshold: number;
  };
  code_analysis: {
    eslint_enabled: boolean;
    prettier_enabled: boolean;
    security_scan_enabled: boolean;
  };
}

class CICDSettingsService {
  private baseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8001'; // [advice from AI] 환경변수명 수정
  private apiUrl = `${this.baseUrl}/api/v1/cicd`; // [advice from AI] CICD 설정 API 경로 최종 수정

  /**
   * 글로벌 설정 조회
   */
  async getGlobalSettings(category?: string): Promise<CICDGlobalSetting[]> {
    try {
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      
      const response = await fetch(`${this.apiUrl}/global-settings?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching global settings:', error);
      throw error;
    }
  }

  /**
   * 특정 글로벌 설정 조회
   */
  async getGlobalSetting(settingKey: string): Promise<CICDGlobalSetting> {
    try {
      const response = await fetch(`${this.apiUrl}/global-settings/${settingKey}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error fetching global setting ${settingKey}:`, error);
      throw error;
    }
  }

  /**
   * 글로벌 설정 업데이트
   */
  async updateGlobalSetting(
    settingKey: string, 
    settingValue: Record<string, any>,
    description?: string
  ): Promise<CICDGlobalSetting> {
    try {
      const response = await fetch(`${this.apiUrl}/global-settings/${settingKey}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          setting_value: settingValue,
          description,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error updating global setting ${settingKey}:`, error);
      throw error;
    }
  }

  /**
   * 기본 설정 초기화
   */
  async initializeDefaultSettings(): Promise<{ message: string; created_count: number }> {
    try {
      const response = await fetch(`${this.apiUrl}/initialize-default-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error initializing default settings:', error);
      throw error;
    }
  }

  /**
   * 레지스트리 연결 테스트
   */
  async testRegistryConnection(registryConfig: RegistryConfig): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      // 실제 운영에서는 백엔드에서 레지스트리 연결을 테스트
      const response = await fetch(`${this.apiUrl}/test-registry-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registryConfig),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error testing registry connection:', error);
      return {
        success: false,
        message: `연결 테스트 실패: ${error}`,
      };
    }
  }

  /**
   * 보안 스캔 실행
   */
  async runSecurityScan(imageTag: string): Promise<{
    success: boolean;
    scan_results: {
      vulnerabilities: Array<{
        cve: string;
        severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        description: string;
        fixed_version?: string;
      }>;
      total_vulnerabilities: number;
      high_critical_count: number;
    };
  }> {
    try {
      const response = await fetch(`${this.apiUrl}/security-scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image_tag: imageTag }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error running security scan:', error);
      throw error;
    }
  }

  /**
   * 모니터링 설정 검증
   */
  async validateMonitoringConfig(config: MonitoringConfig): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // Slack 설정 검증
    if (config.slack_notifications.enabled) {
      if (!config.slack_notifications.webhook_url) {
        issues.push('Slack 웹훅 URL이 필요합니다');
      }
      if (config.slack_notifications.channels.length === 0) {
        issues.push('최소 하나의 Slack 채널이 필요합니다');
      }
    }

    // 이메일 설정 검증
    if (config.email_notifications.enabled) {
      if (!config.email_notifications.smtp_server) {
        issues.push('SMTP 서버 설정이 필요합니다');
      }
      if (config.email_notifications.recipients.length === 0) {
        issues.push('최소 하나의 이메일 수신자가 필요합니다');
      }
    }

    // 로그 보관 기간 검증
    if (config.retention_days < 1 || config.retention_days > 365) {
      issues.push('로그 보관 기간은 1-365일 사이여야 합니다');
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * 개발도구 설정 검증
   */
  async validateDevToolsConfig(config: DevToolsConfig): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // SonarQube 설정 검증
    if (config.sonarqube.enabled) {
      if (!config.sonarqube.server_url) {
        issues.push('SonarQube 서버 URL이 필요합니다');
      }
      if (config.sonarqube.coverage_threshold < 0 || config.sonarqube.coverage_threshold > 100) {
        issues.push('코드 커버리지 임계값은 0-100 사이여야 합니다');
      }
    }

    // 테스트 커버리지 검증
    if (config.automated_testing.coverage_threshold < 0 || config.automated_testing.coverage_threshold > 100) {
      issues.push('테스트 커버리지 임계값은 0-100 사이여야 합니다');
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * 설정 백업 생성
   */
  async backupSettings(): Promise<{
    success: boolean;
    backup_id: string;
    backup_url?: string;
  }> {
    try {
      const response = await fetch(`${this.apiUrl}/backup-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error creating settings backup:', error);
      throw error;
    }
  }

  /**
   * 설정 백업 복원
   */
  async restoreSettings(backupId: string): Promise<{
    success: boolean;
    restored_settings_count: number;
  }> {
    try {
      const response = await fetch(`${this.apiUrl}/restore-settings/${backupId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error restoring settings:', error);
      throw error;
    }
  }

  /**
   * 시스템 상태 확인
   */
  async getSystemStatus(): Promise<{
    registries: Array<{
      name: string;
      status: 'connected' | 'disconnected' | 'error';
      last_check: string;
    }>;
    security_scan: {
      enabled: boolean;
      last_scan: string;
      scan_queue_size: number;
    };
    monitoring: {
      log_collection: boolean;
      metrics_collection: boolean;
      alert_status: 'healthy' | 'warning' | 'error';
    };
    devtools: {
      sonarqube_status: 'connected' | 'disconnected';
      test_runner_status: 'idle' | 'running' | 'error';
    };
  }> {
    try {
      const response = await fetch(`${this.apiUrl}/system-status`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching system status:', error);
      throw error;
    }
  }
}

// 싱글톤 인스턴스 생성
const cicdSettingsService = new CICDSettingsService();

export default cicdSettingsService;
