// [advice from AI] ECP-AI 테넌시 관리 React 훅
/**
 * 테넌시 관리를 위한 커스텀 React 훅
 * - 테넌시 상태 관리
 * - API 호출 최적화
 * - 실시간 업데이트
 * - 에러 처리
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ServiceRequirements } from '../services/TenantDataService';
import {
  TenantCreateRequest,
  TenantCreateResponse,
  TenantStatusResponse,
  RealtimeMetrics,
  TenantSummary
} from '../types/tenant';

// API 베이스 URL
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

// 테넌시 훅
export const useTenant = (tenantId?: string) => {
  const [tenantInfo, setTenantInfo] = useState<TenantStatusResponse | null>(null);
  const [realtimeMetrics, setRealtimeMetrics] = useState<RealtimeMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);

  // 테넌시 정보 조회
  const fetchTenantInfo = useCallback(async () => {
    if (!tenantId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/tenants/${tenantId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('테넌시를 찾을 수 없습니다');
        }
        throw new Error(`HTTP ${response.status}: 테넌시 정보 조회 실패`);
      }
      
      const data: TenantStatusResponse = await response.json();
      setTenantInfo(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  // WebSocket 연결
  const connectWebSocket = useCallback(() => {
    if (!tenantId || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v1/tenants/${tenantId}/metrics`;

    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      setWsConnected(true);
      setError(null);
    };

    wsRef.current.onmessage = (event) => {
      try {
        const metrics: RealtimeMetrics = JSON.parse(event.data);
        setRealtimeMetrics(metrics);
      } catch (err) {
        console.error('WebSocket 메시지 파싱 오류:', err);
      }
    };

    wsRef.current.onclose = () => {
      setWsConnected(false);
      // 자동 재연결 (3초 후)
      setTimeout(() => {
        if (tenantId && (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED)) {
          connectWebSocket();
        }
      }, 3000);
    };

    wsRef.current.onerror = () => {
      setWsConnected(false);
    };
  }, [tenantId]);

  // 테넌시 삭제
  const deleteTenant = useCallback(async () => {
    if (!tenantId) return false;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/tenants/${tenantId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: 테넌시 삭제 실패`);
      }
      
      // WebSocket 연결 해제
      if (wsRef.current) {
        wsRef.current.close(1000, '테넌시 삭제됨');
      }
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '테넌시 삭제 실패';
      setError(errorMessage);
      return false;
    }
  }, [tenantId]);

  // 컴포넌트 마운트/언마운트 처리
  useEffect(() => {
    if (tenantId) {
      fetchTenantInfo();
      connectWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, '컴포넌트 언마운트');
      }
    };
  }, [tenantId, fetchTenantInfo, connectWebSocket]);

  return {
    tenantInfo,
    realtimeMetrics,
    loading,
    error,
    wsConnected,
    fetchTenantInfo,
    deleteTenant,
    clearError: () => setError(null)
  };
};

// 테넌시 목록 훅
export const useTenantList = () => {
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/tenants/`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: 테넌시 목록 조회 실패`);
      }
      
      const data = await response.json();
      setTenants(data.tenants || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTenants();
    
    // 주기적 업데이트 (1분마다)
    const interval = setInterval(fetchTenants, 60000);
    return () => clearInterval(interval);
  }, [fetchTenants]);

  return {
    tenants,
    loading,
    error,
    fetchTenants,
    clearError: () => setError(null)
  };
};

// 테넌시 생성 훅
export const useTenantCreation = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTenant = useCallback(async (request: TenantCreateRequest): Promise<TenantCreateResponse | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/tenants/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP ${response.status}: 테넌시 생성 실패`);
      }

      const result: TenantCreateResponse = await response.json();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '테넌시 생성 실패';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    createTenant,
    loading,
    error,
    clearError: () => setError(null)
  };
};

// 리소스 계산 훅
export const useResourceCalculation = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateResources = useCallback(async (serviceRequirements: ServiceRequirements) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/calculate-resources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(serviceRequirements),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: 리소스 계산 실패`);
      }

      const result = await response.json();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '리소스 계산 실패';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    calculateResources,
    loading,
    error,
    clearError: () => setError(null)
  };
};
