// [advice from AI] API 호출을 위한 커스텀 훅
import { useState, useCallback } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:6360';

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const apiCall = useCallback(async (method, endpoint, data = null, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      const config = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      };

      if (data && method !== 'GET') {
        if (data instanceof FormData) {
          delete config.headers['Content-Type']; // Let browser set it for FormData
          config.body = data;
        } else {
          config.body = JSON.stringify(data);
        }
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;

    } catch (err) {
      console.error(`API call failed: ${method} ${endpoint}`, err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const get = useCallback((endpoint, options) => 
    apiCall('GET', endpoint, null, options), [apiCall]);

  const post = useCallback((endpoint, data, options) => 
    apiCall('POST', endpoint, data, options), [apiCall]);

  const put = useCallback((endpoint, data, options) => 
    apiCall('PUT', endpoint, data, options), [apiCall]);

  const del = useCallback((endpoint, options) => 
    apiCall('DELETE', endpoint, null, options), [apiCall]);

  return {
    loading,
    error,
    get,
    post,
    put,
    delete: del,
    clearError: () => setError(null)
  };
};
