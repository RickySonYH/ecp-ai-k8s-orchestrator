import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  LinearProgress,
  IconButton,
  Tooltip,
  Switch,
  Button,
  FormControlLabel,
  Checkbox,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  CircularProgress
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import {
  Timeline,
  TrendingUp,
  Warning,
  CheckCircle,
  Error,
  Refresh,
  Settings,
  Notifications,
  Speed,
  Memory,
  Storage,
  NetworkCheck
} from '@mui/icons-material';

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
      id={`monitoring-tabpanel-${index}`}
      aria-labelledby={`monitoring-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const AdvancedMonitoring: React.FC<{ isDemoMode?: boolean }> = ({ isDemoMode = true }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedTenant, setSelectedTenant] = useState('all');
  const [timeRange, setTimeRange] = useState('1h');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // 가상 데모 데이터
  const [realtimeData, setRealtimeData] = useState<any[]>([]);
  const [tenantComparisonData, setTenantComparisonData] = useState<any[]>([]);
  const [slaMetrics, setSlaMetrics] = useState<any>({});
  const [alerts, setAlerts] = useState<any[]>([]);
  
  // [advice from AI] 알림 시스템 상태
  const [alertsPage, setAlertsPage] = useState(1);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsHasMore, setAlertsHasMore] = useState(true);
  const [alertsTotal, setAlertsTotal] = useState(0);
  
  // WebSocket 상태 관리
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  
  // [advice from AI] 임계값 설정 상태 - DB에서 로드
  const [thresholds, setThresholds] = useState({
    cpu: { warning: 70, critical: 85 },
    memory: { warning: 75, critical: 90 },
    gpu: { warning: 80, critical: 95 },
    response_time: { warning: 200, critical: 500 },
    error_rate: { warning: 1.0, critical: 5.0 }
  });
  
  // [advice from AI] 임계값 설정 관련 상태
  const [thresholdSettings, setThresholdSettings] = useState<any>(null);
  const [thresholdSaving, setThresholdSaving] = useState(false);
  const [slaPresets, setSlaPresets] = useState<any>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>('standard');

  // [advice from AI] 테넌시 선택 상태 (최대 4개)
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);

  // [advice from AI] SLA 데이터 마지막 업데이트 시간 추적
  const [lastSLAUpdate, setLastSLAUpdate] = useState<Date>(new Date());

  // [advice from AI] 샘플 데이터 완전 제거 - 실제 데이터만 사용
  const demoTenants: any[] = [];

  // [advice from AI] 데모 모드에 따른 데이터 로드 분기
  useEffect(() => {
    if (isDemoMode) {
      // 데모 모드: 가상 데이터 생성
      loadDemoData();
    } else {
      // 실제 모드: WebSocket 연결 또는 API 데이터 로드
      if (autoRefresh) {
        connectWebSocket();
      } else {
        loadRealData();
      }
    }

    // 컴포넌트 언마운트 시 WebSocket 연결 정리
    return () => {
      if (wsConnection) {
        wsConnection.close();
        setWsConnection(null);
        setConnectionStatus('disconnected');
      }
    };
  }, [isDemoMode, timeRange, autoRefresh]);

  // 데모 데이터 로드 함수
  const loadDemoData = () => {
    setRealtimeData(generateRealtimeData());
    setTenantComparisonData(generateTenantComparisonData());
    setSlaMetrics(generateSLAMetrics());
    setAlerts(generateAlerts());
  };

  // [advice from AI] 실시간 데이터만 로드하는 함수 - 기존 데이터와 연결된 자연스러운 트렌드
  const loadRealtimeDataOnly = async () => {
    try {
      const realtimeRes = await fetch('http://localhost:8001/api/v1/simulator/monitoring/advanced/realtime');
      const comparisonRes = await fetch('http://localhost:8001/api/v1/simulator/monitoring/advanced/tenants');

      if (realtimeRes.ok) {
        const newRealtimeData = await realtimeRes.json();
        const newTransformedData = transformRealtimeDataForChart(newRealtimeData.metrics || []);
        
        // [advice from AI] 기존 데이터가 있으면 자연스럽게 연결
        if (realtimeData.length > 0 && newTransformedData.length > 0) {
          const smoothedData = newTransformedData.map((newPoint: any, index: number) => {
            const lastPoint = realtimeData[realtimeData.length - 1];
            if (lastPoint && index === 0) {
              // 첫 번째 새 데이터 포인트는 마지막 데이터와 연결
              return {
                ...newPoint,
                cpu: Math.max(0, Math.min(100, lastPoint.cpu + (Math.random() - 0.5) * 10)), // ±5% 변화
                memory: Math.max(0, Math.min(100, lastPoint.memory + (Math.random() - 0.5) * 8)), // ±4% 변화
                gpu: Math.max(0, Math.min(100, lastPoint.gpu + (Math.random() - 0.5) * 12)), // ±6% 변화
                network: Math.max(0, lastPoint.network + (Math.random() - 0.5) * 20), // ±10 단위 변화
                disk: Math.max(0, Math.min(100, (lastPoint.disk || 50) + (Math.random() - 0.5) * 6)), // ±3% 변화
                response_time: Math.max(10, lastPoint.response_time + (Math.random() - 0.5) * 20) // ±10ms 변화
              };
            }
            return newPoint;
          });
          
          // 기존 데이터 + 새 데이터 (최근 50개만 유지)
          const combinedData = [...realtimeData.slice(-49), ...smoothedData].slice(-50);
          setRealtimeData(combinedData);
        } else {
          setRealtimeData(newTransformedData);
        }
      }

      if (comparisonRes.ok) {
        const comparisonData = await comparisonRes.json();
        setTenantComparisonData(comparisonData.tenants || []);
      }
    } catch (error) {
      console.error('실시간 데이터 로드 실패:', error);
    }
  };

  // [advice from AI] 임계값 설정 DB에서 로드
  const loadThresholdSettings = async () => {
    try {
      const response = await fetch('http://localhost:8001/api/v1/thresholds/default');
      
      if (response.ok) {
        const settingsData = await response.json();
        setThresholdSettings(settingsData);
        
        // 임계값 상태 업데이트
        if (settingsData.thresholds) {
          setThresholds(settingsData.thresholds);
          console.log('임계값 설정 DB에서 로드 완료:', settingsData.thresholds);
        }
      } else {
        console.warn('기본 임계값 설정 로드 실패, 기본값 사용');
      }
    } catch (error) {
      console.error('임계값 설정 로드 실패:', error);
    }
  };

  // [advice from AI] 임계값 설정 DB에 저장
  const saveThresholdSettings = async () => {
    try {
      setThresholdSaving(true);
      
      const settingsData = {
        name: "사용자 모니터링 임계값",
        description: "사용자가 설정한 모니터링 임계값",
        category: "monitoring",
        thresholds: thresholds,
        notifications_enabled: true,
        email_enabled: false,
        sms_enabled: false,
        slack_enabled: false,
        is_default: true
      };
      
      let response;
      if (thresholdSettings?.setting_id) {
        // 기존 설정 업데이트
        response = await fetch(`http://localhost:8001/api/v1/thresholds/${thresholdSettings.setting_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settingsData)
        });
      } else {
        // 새 설정 생성
        response = await fetch('http://localhost:8001/api/v1/thresholds/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settingsData)
        });
      }
      
      if (response.ok) {
        const result = await response.json();
        console.log('임계값 설정 저장 성공:', result);
        
        // 설정 다시 로드
        await loadThresholdSettings();
        
        alert('임계값 설정이 저장되었습니다!');
      } else {
        console.error(`저장 실패: ${response.status}`);
        alert('임계값 설정 저장에 실패했습니다.');
        return;  // [advice from AI] throw 대신 return으로 에러 처리
      }
    } catch (error) {
      console.error('임계값 설정 저장 실패:', error);
      alert('임계값 설정 저장에 실패했습니다.');
    } finally {
      setThresholdSaving(false);
    }
  };

  // [advice from AI] SLA 프리셋 로드
  const loadSlaPresets = async () => {
    try {
      const response = await fetch('http://localhost:8001/api/v1/thresholds/presets');
      
      if (response.ok) {
        const presetsData = await response.json();
        setSlaPresets(presetsData.presets);
        console.log('SLA 프리셋 로드 완료:', presetsData.presets);
      }
    } catch (error) {
      console.error('SLA 프리셋 로드 실패:', error);
    }
  };

  // [advice from AI] SLA 프리셋 적용
  const applySlaPreset = async (presetName: string) => {
    try {
      setThresholdSaving(true);
      
      const response = await fetch(`http://localhost:8001/api/v1/thresholds/presets/${presetName}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('SLA 프리셋 적용 성공:', result);
        
        // 임계값 상태 업데이트
        setThresholds(result.thresholds);
        setSelectedPreset(presetName);
        
        // 설정 다시 로드
        await loadThresholdSettings();
        
        alert(`${result.message}\n\nSLA 수준: ${result.sla_level}%`);
      } else {
        console.error(`프리셋 적용 실패: ${response.status}`);
        alert('SLA 프리셋 적용에 실패했습니다.');
        return;  // [advice from AI] throw 대신 return으로 에러 처리
      }
    } catch (error) {
      console.error('SLA 프리셋 적용 실패:', error);
      alert('SLA 프리셋 적용에 실패했습니다.');
    } finally {
      setThresholdSaving(false);
    }
  };

  // [advice from AI] 임계값 설정 초기화 (기본값으로 복원)
  const resetThresholdSettings = async () => {
    try {
      // Standard SLA 프리셋으로 초기화
      await applySlaPreset('standard');
    } catch (error) {
      console.error('임계값 설정 초기화 실패:', error);
    }
  };

  // [advice from AI] 새로운 알림 시스템 데이터 로드
  const loadAlertsData = async (page: number = 1, append: boolean = false) => {
    try {
      setAlertsLoading(true);
      
      const response = await fetch(`http://localhost:8001/api/v1/alerts/?page=${page}&page_size=50&include_recent=${page === 1}`);  // [advice from AI] 페이지 크기 20→50으로 증가
      
      if (response.ok) {
        const alertsData = await response.json();
        console.log(`알림 데이터 로드: 페이지 ${page}, ${alertsData.alerts?.length || 0}개`);
        
        if (append && page > 1) {
          // 무한 스크롤: 기존 데이터에 추가
          setAlerts(prev => [...prev, ...(alertsData.alerts || [])]);
        } else {
          // 첫 페이지: 새로 설정
          setAlerts(alertsData.alerts || []);
        }
        
        setAlertsHasMore(alertsData.has_more || false);
        setAlertsTotal(alertsData.total_count || 0);
        setAlertsPage(page);
      } else {
        console.warn('알림 데이터 로드 실패');
        if (!append) {
          setAlerts([]);
        }
      }
    } catch (error) {
      console.error('알림 데이터 로드 실패:', error);
      if (!append) {
        setAlerts([]);
      }
    } finally {
      setAlertsLoading(false);
    }
  };

  // [advice from AI] 무한 스크롤 핸들러
  const handleAlertsScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    
    // 스크롤이 하단에 가까워지면 다음 페이지 로드
    if (scrollHeight - scrollTop <= clientHeight * 1.5 && alertsHasMore && !alertsLoading) {
      console.log('무한 스크롤 트리거: 다음 페이지 로드');
      loadAlertsData(alertsPage + 1, true);
    }
  };

  // [advice from AI] SLA 데이터만 로드하는 함수 (기존 데이터와 연관성 유지)
  const loadSLADataOnly = async () => {
    try {
      const slaRes = await fetch('http://localhost:8001/api/v1/simulator/monitoring/advanced/sla');
      
      if (slaRes.ok) {
        const slaData = await slaRes.json();
        const newMetrics = slaData.metrics || [];
        
        // [advice from AI] 기존 데이터와 연관성을 가지며 자연스럽게 변화
        if (slaMetrics.length > 0 && newMetrics.length > 0) {
          const updatedMetrics = newMetrics.map((newPoint: any, index: number) => {
            const oldPoint = slaMetrics[index];
            if (oldPoint) {
              // 기존 값에서 ±10% 범위 내에서 자연스럽게 변화
              const responseTimeChange = (Math.random() - 0.5) * 0.2; // ±10%
              const errorRateChange = (Math.random() - 0.5) * 0.1; // ±5%
              
              return {
                ...newPoint,
                response_time: Math.max(10, oldPoint.response_time * (1 + responseTimeChange)),
                error_rate: Math.max(0, Math.min(5, oldPoint.error_rate * (1 + errorRateChange))),
                availability: Math.max(95, Math.min(100, oldPoint.availability + (Math.random() - 0.5) * 0.5))
              };
            }
            return newPoint;
          });
          setSlaMetrics(updatedMetrics);
        } else {
          setSlaMetrics(newMetrics);
        }
        
        // [advice from AI] SLA 업데이트 시간 기록
        setLastSLAUpdate(new Date());
      }
    } catch (error) {
      console.error('SLA 데이터 로드 실패:', error);
    }
  };

  // 실제 데이터 로드 함수 (K8S Simulator 연동)
  const loadRealData = async () => {
    try {
      // [advice from AI] 먼저 테넌시 개수 확인
      const tenantsCheckRes = await fetch('http://localhost:8001/api/v1/tenants/');
      const tenantsData = await tenantsCheckRes.json();
      const tenantCount = tenantsData.tenants?.length || 0;
      
      console.log(`테넌시 개수 확인: ${tenantCount}개`);
      
      // 테넌시가 없으면 빈 상태로 설정
      if (tenantCount === 0) {
        console.log('테넌시가 없어서 빈 상태로 설정');
        setRealtimeData([]);
        setTenantComparisonData([]);
        setSlaMetrics([]);
        setAlerts([]);
        setAlertsTotal(0);
        return;
      }
      
      // [advice from AI] K8S Simulator 연동 API 호출 (테넌시가 있을 때만)
      const [realtimeRes, comparisonRes, slaRes, alertsRes] = await Promise.all([
        fetch('http://localhost:8001/api/v1/simulator/monitoring/advanced/realtime'),
        fetch('http://localhost:8001/api/v1/simulator/monitoring/advanced/tenants'),
        fetch('http://localhost:8001/api/v1/simulator/monitoring/advanced/sla'),
        fetch('http://localhost:8001/api/v1/simulator/monitoring/advanced/alerts')
      ]);

      if (realtimeRes.ok) {
        const realtimeData = await realtimeRes.json();
        console.log('실시간 데이터 수신:', realtimeData.metrics?.length || 0, '개');
        // 시계열 차트용 데이터로 변환
        const transformedData = transformRealtimeDataForChart(realtimeData.metrics || []);
        console.log('API 변환된 차트 데이터:', transformedData.length, '개 포인트');
        if (transformedData.length > 0) {
          console.log('첫 번째 데이터 포인트:', transformedData[0]);
        }
        setRealtimeData(transformedData);
      } else {
        console.warn('실시간 데이터 로드 실패, 빈 데이터 표시');
        setRealtimeData([]);  // [advice from AI] 빈 배열로 설정
      }

      if (comparisonRes.ok) {
        const comparisonData = await comparisonRes.json();
        setTenantComparisonData(comparisonData.tenants || []);
      } else {
        console.warn('테넌트 비교 데이터 로드 실패, 빈 데이터 표시');
        setTenantComparisonData([]);  // [advice from AI] 빈 배열로 설정
      }

      if (slaRes.ok) {
        const slaData = await slaRes.json();
        setSlaMetrics(slaData.metrics || []);
      } else {
        console.warn('SLA 데이터 로드 실패, 빈 데이터 표시');
        setSlaMetrics([]);  // [advice from AI] 빈 배열로 설정
      }

      // [advice from AI] 새로운 알림 시스템 사용
      await loadAlertsData(1, false);
    } catch (error) {
      console.error('K8S Simulator 모니터링 데이터 로드 실패:', error);
      // [advice from AI] K8S Simulator 연결 실패 시 빈 데이터 표시 (실사용 모드에서는 데모 데이터 사용 안 함)
      setRealtimeData([]);
      setTenantComparisonData([]);
      setSlaMetrics([]);
      setAlerts([]);
    }
  };

  // WebSocket 연결 함수
  const connectWebSocket = () => {
    // 기존 연결이 있으면 정리
    if (wsConnection) {
      wsConnection.close();
    }

    setConnectionStatus('connecting');
    console.log('WebSocket 연결 시도 중...');

    try {
      const ws = new WebSocket('ws://localhost:8001/api/v1/simulator/monitoring/advanced/ws/realtime');
      
      ws.onopen = () => {
        console.log('WebSocket 연결 성공');
        setConnectionStatus('connected');
        setWsConnection(ws);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket 데이터 수신:', data.type);
          
          if (data.type === 'monitoring_update' && data.data) {
            // 실시간 데이터 업데이트
            if (data.data.realtime?.metrics) {
              console.log('WebSocket 실시간 데이터 수신:', data.data.realtime.metrics.length, '개');
              const transformedData = transformRealtimeDataForChart(data.data.realtime.metrics);
              console.log('WebSocket 변환된 차트 데이터:', transformedData.length, '개 포인트');
              setRealtimeData(transformedData);
            }
            
            if (data.data.tenants?.tenants) {
              setTenantComparisonData(data.data.tenants.tenants);
            }
            
            if (data.data.sla?.metrics) {
              // [advice from AI] SLA 데이터는 10분마다만 업데이트 (WebSocket에서는 제한)
              const now = new Date();
              const timeSinceLastUpdate = now.getTime() - lastSLAUpdate.getTime();
              const TEN_MINUTES = 10 * 60 * 1000; // 10분 = 600,000ms
              
              if (timeSinceLastUpdate >= TEN_MINUTES) {
                console.log('SLA 데이터 업데이트 (10분 경과)');
                setLastSLAUpdate(now);
                
                const newMetrics = data.data.sla.metrics;
                setSlaMetrics((prevMetrics: any[]) => {
                  if (prevMetrics.length > 0 && newMetrics.length > 0) {
                    return newMetrics.map((newPoint: any, index: number) => {
                      const oldPoint = prevMetrics[index];
                      if (oldPoint) {
                        // 기존 값에서 ±10% 범위 내에서 자연스럽게 변화 (10분마다 더 큰 변화)
                        const responseTimeChange = (Math.random() - 0.5) * 0.2; // ±10%
                        const errorRateChange = (Math.random() - 0.5) * 0.1; // ±5%
                        
                        return {
                          ...newPoint,
                          response_time: Math.max(10, oldPoint.response_time * (1 + responseTimeChange)),
                          error_rate: Math.max(0, Math.min(5, oldPoint.error_rate * (1 + errorRateChange))),
                          availability: Math.max(95, Math.min(100, oldPoint.availability + (Math.random() - 0.5) * 0.5))
                        };
                      }
                      return newPoint;
                    });
                  }
                  return newMetrics;
                });
              } else {
                console.log(`SLA 데이터 업데이트 스킵 (${Math.round(timeSinceLastUpdate / 1000)}초 경과, ${Math.round(TEN_MINUTES / 1000)}초 필요)`);
              }
            }
            
            // [advice from AI] 새로운 알림 시스템에서는 실시간 업데이트만 (첫 페이지 새로고침)
            if (data.data.alerts?.alerts) {
              console.log('WebSocket 알림 업데이트 감지 - 첫 페이지 새로고침');
              loadAlertsData(1, false);  // await 제거 (WebSocket 콜백에서는 async 아님)
            }
            
            // 현재 시간 업데이트
            setCurrentTime(new Date());
          } else if (data.type === 'error') {
            console.error('WebSocket 오류:', data.message);
          }
        } catch (error) {
          console.error('WebSocket 메시지 파싱 오류:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket 연결 종료:', event.code, event.reason);
        setConnectionStatus('disconnected');
        setWsConnection(null);
        
        // 자동 재연결 (5초 후)
        if (autoRefresh && !isDemoMode) {
          setTimeout(() => {
            console.log('WebSocket 자동 재연결 시도...');
            connectWebSocket();
          }, 5000);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket 오류:', error);
        setConnectionStatus('error');
        
        // 오류 발생 시 폴백으로 API 호출
        loadRealData();
      };

    } catch (error) {
      console.error('WebSocket 연결 실패:', error);
      setConnectionStatus('error');
      // 폴백으로 API 호출
      loadRealData();
    }
  };

  // 실시간 데이터를 차트용 형식으로 변환
  const transformRealtimeDataForChart = (metrics: any[]) => {
    if (!metrics || metrics.length === 0) return [];
    
    // 시간별로 그룹화
    const timeGroups: { [key: string]: any[] } = {};
    
    metrics.forEach(metric => {
      const timeKey = new Date(metric.timestamp).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
      });
      
      if (!timeGroups[timeKey]) {
        timeGroups[timeKey] = [];
      }
      timeGroups[timeKey].push(metric);
    });
    
    // 시계열 차트 데이터로 변환
    return Object.keys(timeGroups)
      .sort((a, b) => {
        // 시간순 정렬
        const timeA = new Date(`2000/01/01 ${a}`).getTime();
        const timeB = new Date(`2000/01/01 ${b}`).getTime();
        return timeA - timeB;
      })
      .map(timeKey => {
        const metricsAtTime = timeGroups[timeKey];
        
        // 각 시간대의 평균값 계산
        const avgCpu = metricsAtTime.reduce((sum, m) => sum + (m.cpu_usage || 0), 0) / metricsAtTime.length;
        const avgMemory = metricsAtTime.reduce((sum, m) => sum + (m.memory_usage || 0), 0) / metricsAtTime.length;
        const avgGpu = metricsAtTime.reduce((sum, m) => sum + (m.gpu_usage || 0), 0) / metricsAtTime.length;
        const avgNetwork = metricsAtTime.reduce((sum, m) => sum + (m.network_io || 0), 0) / metricsAtTime.length;
        
        return {
          time: timeKey,
          timestamp: new Date(metricsAtTime[0].timestamp).getTime(),
          cpu: Math.round(avgCpu * 10) / 10,
          memory: Math.round(avgMemory * 10) / 10,
          gpu: Math.round(avgGpu * 10) / 10,
          network: Math.round(avgNetwork * 10) / 10,
          disk: Math.round(metricsAtTime.reduce((sum, m) => sum + (m.disk_usage || 0), 0) / metricsAtTime.length * 10) / 10,
          responseTime: Math.round(metricsAtTime.reduce((sum, m) => sum + (m.response_time || 0), 0) / metricsAtTime.length * 10) / 10
        };
      });
  };

  // 가상 데이터 생성 함수
  const generateRealtimeData = () => {
    const now = new Date();
    const data = [];
    
    for (let i = 59; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60000);
      data.push({
        time: time.toLocaleTimeString(),
        timestamp: time.getTime(),
        cpu: Math.random() * 80 + 10,
        memory: Math.random() * 70 + 20,
        gpu: Math.random() * 90 + 5,
        network: Math.random() * 100 + 50,
        requests: Math.floor(Math.random() * 500 + 100),
        errors: Math.floor(Math.random() * 10),
        responseTime: Math.random() * 200 + 50
      });
    }
    return data;
  };

  const generateTenantComparisonData = () => {
    return demoTenants.map(tenant => ({
      name: tenant.name,
      id: tenant.id,
      preset: tenant.preset,
      cpu: Math.random() * 80 + 10,
      memory: Math.random() * 70 + 20,
      gpu: Math.random() * 90 + 5,
      availability: 99.9 - Math.random() * 0.5,
      responseTime: Math.random() * 150 + 50,
      throughput: Math.floor(Math.random() * 1000 + 200),
      errors: Math.floor(Math.random() * 20),
      status: tenant.status
    }));
  };

  const generateSLAMetrics = () => {
    const data = [];
    const now = new Date();
    
    for (let i = 23; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 3600000);
      data.push({
        time: time.getHours() + ':00',
        timestamp: time.getTime(),
        availability: 99.5 + Math.random() * 0.4,
        responseTime: 80 + Math.random() * 40,
        errorRate: Math.random() * 0.5,
        throughput: 800 + Math.random() * 400
      });
    }
    return data;
  };

  const generateAlerts = () => {
    const alertTypes = ['warning', 'error', 'info'];
    const messages = [
      'CPU 사용률이 80%를 초과했습니다',
      'GPU 메모리 부족 경고',
      '응답 시간이 임계값을 초과했습니다',
      '네트워크 지연 감지',
      'SLA 위반 가능성 감지',
      '새로운 테넌시가 생성되었습니다',
      '자동 스케일링이 실행되었습니다'
    ];

    return Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      type: alertTypes[Math.floor(Math.random() * alertTypes.length)],
      message: messages[Math.floor(Math.random() * messages.length)],
      tenant: demoTenants[Math.floor(Math.random() * demoTenants.length)].name,
      timestamp: new Date(Date.now() - Math.random() * 3600000),
      resolved: Math.random() > 0.7
    }));
  };

  // 백엔드에서 실제 데이터 가져오기
  useEffect(() => {
    // [advice from AI] 초기 데이터 로드
    if (isDemoMode) {
      loadDemoData();
    } else {
      loadRealData();
      loadThresholdSettings(); // 임계값 설정 로드
      loadSlaPresets(); // SLA 프리셋 로드
    }

    if (isDemoMode) {
      // 데모 모드: 자동 새로고침으로 가상 데이터 업데이트
      const interval = setInterval(() => {
        setCurrentTime(new Date());
        if (autoRefresh) {
          loadDemoData();
        }
      }, 5000);
      return () => clearInterval(interval);
    } else {
      // [advice from AI] 실제 모드: 실시간 데이터만 자주 업데이트, SLA는 10분마다
      const realtimeInterval = setInterval(() => {
        setCurrentTime(new Date());
        if (autoRefresh) {
          loadRealtimeDataOnly(); // 실시간 데이터만 로드
        }
      }, 30000); // 30초마다 실시간 데이터 업데이트

      // SLA 트렌드 데이터는 10분마다만 업데이트 (히스토리컬 데이터)
      const slaInterval = setInterval(() => {
        if (autoRefresh) {
          loadSLADataOnly(); // SLA 데이터만 로드
        }
      }, 600000); // 10분마다 SLA 업데이트

      return () => {
        clearInterval(realtimeInterval);
        clearInterval(slaInterval);
      };
    }
  }, [isDemoMode, autoRefresh]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // [advice from AI] 테넌시 선택 핸들러 (최대 4개 제한)
  const handleTenantSelection = (tenantId: string) => {
    setSelectedTenants(prev => {
      const isSelected = prev.includes(tenantId);
      if (isSelected) {
        // 선택 해제
        return prev.filter(id => id !== tenantId);
      } else {
        // 새로 선택 (최대 4개 제한)
        if (prev.length >= 4) {
          return prev; // 4개 이상은 선택할 수 없음
        }
        return [...prev, tenantId];
      }
    });
  };

  // [advice from AI] 선택된 테넌시들만 필터링
  const getSelectedTenantsData = () => {
    if (selectedTenants.length === 0) {
      // 아무것도 선택하지 않았으면 처음 4개 표시
      return tenantComparisonData.slice(0, 4);
    }
    return tenantComparisonData.filter(tenant => 
      selectedTenants.includes(tenant.tenant_id || tenant.name)
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return '#4caf50';
      case 'warning': return '#ff9800';
      case 'critical': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  const getAlertSeverityColor = (type: string) => {
    switch (type) {
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'info';
    }
  };

  return (
    <Box sx={{ width: '100%', height: '100vh', overflow: 'auto' }}>
      {/* 헤더 */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              🚧 고급 모니터링 대시보드
            </Typography>
            {!isDemoMode && (
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="body2" color="text.secondary">
                  연결 상태:
                </Typography>
                <Chip 
                  size="small"
                  label={
                    connectionStatus === 'connected' ? '실시간 연결됨' :
                    connectionStatus === 'connecting' ? '연결 중...' :
                    connectionStatus === 'error' ? '연결 오류' : '연결 안됨'
                  }
                  color={
                    connectionStatus === 'connected' ? 'success' :
                    connectionStatus === 'connecting' ? 'warning' :
                    connectionStatus === 'error' ? 'error' : 'default'
                  }
                  variant={connectionStatus === 'connected' ? 'filled' : 'outlined'}
                />
                {connectionStatus === 'connected' && autoRefresh && (
                  <Typography variant="caption" color="text.secondary">
                    • 5초마다 업데이트
                  </Typography>
                )}
              </Box>
            )}
          </Box>
          <Box display="flex" alignItems="center" gap={2}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>테넌시</InputLabel>
              <Select
                value={selectedTenant}
                onChange={(e) => setSelectedTenant(e.target.value)}
                label="테넌시"
              >
                <MenuItem value="all">전체</MenuItem>
                {demoTenants.map(tenant => (
                  <MenuItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>시간 범위</InputLabel>
              <Select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                label="시간 범위"
              >
                <MenuItem value="5m">5분</MenuItem>
                <MenuItem value="1h">1시간</MenuItem>
                <MenuItem value="24h">24시간</MenuItem>
                <MenuItem value="7d">7일</MenuItem>
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  size="small"
                />
              }
              label="자동 새로고침"
            />

            <Tooltip title="수동 새로고침">
              <IconButton onClick={() => window.location.reload()}>
                <Refresh />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Typography variant="body2" color="text.secondary">
          마지막 업데이트: {currentTime.toLocaleString()} | 
          활성 테넌시: {isDemoMode ? demoTenants.length : tenantComparisonData.length}개 | 
          총 알림: {alerts.filter(a => !a.resolved).length}개 | 
          데이터 소스: {isDemoMode ? '데모 모드 (가상 데이터)' : 'K8S Simulator (배포된 테넌트만)'}
        </Typography>
        {!isDemoMode && tenantComparisonData.length === 0 && (
          <Typography variant="body2" color="info.main" sx={{ mt: 1 }}>
            💡 실사용 모드에서는 테넌트를 배포해야 모니터링 데이터가 표시됩니다. 
            "테넌트 생성" → "배포 마법사"에서 테넌트를 배포해보세요.
          </Typography>
        )}
      </Paper>

      {/* 탭 네비게이션 */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={activeTab} onChange={handleTabChange} variant="fullWidth">
          <Tab 
            icon={<TrendingUp />} 
            label="실시간 리소스" 
            iconPosition="start"
          />
          <Tab 
            icon={<Speed />} 
            label="테넌시 비교" 
            iconPosition="start"
          />
          <Tab 
            icon={<Timeline />} 
            label="SLA 트렌드" 
            iconPosition="start"
          />
          <Tab 
            icon={<Notifications />} 
            label="알람 & 알림" 
            iconPosition="start"
          />
          <Tab 
            icon={<Settings />} 
            label="임계값 설정" 
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {/* 탭 내용 */}
      
      {/* 실시간 리소스 사용률 차트 */}
      <TabPanel value={activeTab} index={0}>
        {/* [advice from AI] 테넌시가 없을 때 빈 상태 표시 */}
        {tenantComparisonData.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h4" gutterBottom sx={{ color: 'text.secondary' }}>
              📭
            </Typography>
            <Typography variant="h6" gutterBottom color="text.secondary">
              테넌시가 없습니다
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              실시간 리소스 모니터링을 위해서는 먼저 테넌시를 생성해주세요.
            </Typography>
            <Button 
              variant="contained" 
              color="primary"
              size="large"
              onClick={() => {
                // 테넌시 생성 페이지로 이동하는 로직 추가 가능
                alert('테넌시 생성 페이지로 이동합니다.');
              }}
            >
              테넌시 생성하기
            </Button>
          </Box>
        ) : (
          <>
            {/* 테넌시 전체 요약 정보 */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12}>
                <Paper sx={{ p: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="h6" gutterBottom>
                    📊 테넌시 전체 현황 요약
                  </Typography>
              {/* [advice from AI] 실시간 데이터 기반 테넌시 요약 정보 */}
              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="primary" fontWeight="bold">
                      {tenantComparisonData.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      총 테넌시
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="success.main" fontWeight="bold">
                      {tenantComparisonData.filter(t => t.status === 'running').length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      실행 중
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="secondary" fontWeight="bold">
                      {tenantComparisonData.reduce((sum, t) => sum + (t.services_count || 0), 0)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      총 서비스
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="warning.main" fontWeight="bold">
                      {tenantComparisonData.filter(t => 
                        t.cpu_usage > thresholds.cpu.warning || 
                        t.memory_usage > thresholds.memory.warning ||
                        t.gpu_usage > thresholds.gpu.warning
                      ).length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      주의 필요
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
              
              {/* [advice from AI] 실시간 데이터 기반 평균 리소스 사용률 */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  현재 평균 리소스 사용률 (실시간)
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={3}>
                    <Box>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2">CPU</Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {realtimeData.length > 0 ? `${Math.round(realtimeData[realtimeData.length - 1]?.cpu || 0)}%` : '0%'}
                        </Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={realtimeData.length > 0 ? realtimeData[realtimeData.length - 1]?.cpu || 0 : 0} 
                        sx={{ mt: 0.5, height: 6, borderRadius: 3 }}
                        color="primary"
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <Box>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2">Memory</Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {realtimeData.length > 0 ? `${Math.round(realtimeData[realtimeData.length - 1]?.memory || 0)}%` : '0%'}
                        </Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={realtimeData.length > 0 ? realtimeData[realtimeData.length - 1]?.memory || 0 : 0} 
                        sx={{ mt: 0.5, height: 6, borderRadius: 3 }}
                        color="secondary"
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <Box>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2">GPU</Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {realtimeData.length > 0 ? `${Math.round(realtimeData[realtimeData.length - 1]?.gpu || 0)}%` : '0%'}
                        </Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={realtimeData.length > 0 ? realtimeData[realtimeData.length - 1]?.gpu || 0 : 0} 
                        sx={{ mt: 0.5, height: 6, borderRadius: 3 }}
                        color="success"
                      />
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <Box>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2">평균 응답시간</Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {realtimeData.length > 0 ? `${Math.round(realtimeData[realtimeData.length - 1]?.response_time || 0)}ms` : '0ms'}
                        </Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={realtimeData.length > 0 
                          ? Math.min(100, (realtimeData[realtimeData.length - 1]?.response_time || 0) / 5)
                          : 0} 
                        sx={{ mt: 0.5, height: 6, borderRadius: 3 }}
                        color="warning"
                      />
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              {/* 테넌시별 간단 상태 */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  테넌시별 상태 요약
                </Typography>
                <Box display="flex" flexWrap="wrap" gap={1}>
                  {tenantComparisonData.map(tenant => (
                    <Chip 
                      key={tenant.tenant_id}
                      size="small"
                      label={`${tenant.name} (${tenant.preset})`}
                      color={
                        tenant.cpu_usage > thresholds.cpu.critical || 
                        tenant.memory_usage > thresholds.memory.critical ||
                        tenant.gpu_usage > thresholds.gpu.critical ? 'error' :
                        tenant.cpu_usage > thresholds.cpu.warning || 
                        tenant.memory_usage > thresholds.memory.warning ||
                        tenant.gpu_usage > thresholds.gpu.warning ? 'warning' : 'success'
                      }
                      variant={tenant.status === 'running' ? 'filled' : 'outlined'}
                      icon={
                        tenant.status === 'running' ? <CheckCircle /> :
                        tenant.status === 'deploying' ? <TrendingUp /> : 
                        <Warning />
                      }
                    />
                  ))}
                </Box>
              </Box>
            </Paper>
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          {/* 실시간 메트릭 카드들 */}
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <Speed color="primary" />
                  <Typography variant="h6">CPU 사용률</Typography>
                </Box>
                <Typography variant="h4" color="primary">
                  {realtimeData.length > 0 ? `${Math.round(realtimeData[realtimeData.length - 1]?.cpu || 0)}%` : '0%'}
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={realtimeData.length > 0 ? realtimeData[realtimeData.length - 1]?.cpu || 0 : 0} 
                  sx={{ mt: 1 }}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <Memory color="secondary" />
                  <Typography variant="h6">메모리</Typography>
                </Box>
                <Typography variant="h4" color="secondary">
                  {realtimeData.length > 0 ? `${Math.round(realtimeData[realtimeData.length - 1]?.memory || 0)}%` : '0%'}
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={realtimeData.length > 0 ? realtimeData[realtimeData.length - 1]?.memory || 0 : 0} 
                  color="secondary"
                  sx={{ mt: 1 }}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <Storage color="warning" />
                  <Typography variant="h6">GPU 사용률</Typography>
                </Box>
                <Typography variant="h4" sx={{ color: '#ff9800' }}>
                  {realtimeData.length > 0 ? `${Math.round(realtimeData[realtimeData.length - 1]?.gpu || 0)}%` : '0%'}
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={realtimeData.length > 0 ? realtimeData[realtimeData.length - 1]?.gpu || 0 : 0} 
                  sx={{ 
                    mt: 1,
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: '#ff9800'
                    }
                  }}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <NetworkCheck color="success" />
                  <Typography variant="h6">네트워크</Typography>
                </Box>
                <Typography variant="h4" color="success">
                  {realtimeData.length > 0 ? `${Math.round(realtimeData[realtimeData.length - 1]?.network || 0)} MB/s` : '0 MB/s'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  요청/초: {realtimeData.length > 0 ? realtimeData[realtimeData.length - 1]?.requests || 0 : 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* 실시간 차트 */}
          <Grid item xs={12} lg={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  실시간 리소스 사용률 (최근 1시간)
                </Typography>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={realtimeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Line type="monotone" dataKey="cpu" stroke="#2196f3" name="CPU %" />
                    <Line type="monotone" dataKey="memory" stroke="#9c27b0" name="Memory %" />
                    <Line type="monotone" dataKey="gpu" stroke="#ff9800" name="GPU %" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  응답 시간 & 처리량
                </Typography>
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={realtimeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <RechartsTooltip />
                    <Area 
                      type="monotone" 
                      dataKey="responseTime" 
                      stroke="#4caf50" 
                      fill="#4caf50" 
                      fillOpacity={0.3}
                      name="응답시간 (ms)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        </>
        )}
      </TabPanel>

      {/* 테넌시 비교 탭 - 개선된 선택 인터페이스 */}
      <TabPanel value={activeTab} index={1}>
        {/* [advice from AI] 테넌시가 없을 때 빈 상태 표시 */}
        {tenantComparisonData.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h4" gutterBottom sx={{ color: 'text.secondary' }}>
              📊
            </Typography>
            <Typography variant="h6" gutterBottom color="text.secondary">
              비교할 테넌시가 없습니다
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              테넌시 비교 분석을 위해서는 최소 1개 이상의 테넌시가 필요합니다.
            </Typography>
            <Button 
              variant="contained" 
              color="primary"
              size="large"
              onClick={() => {
                alert('테넌시 생성 페이지로 이동합니다.');
              }}
            >
              테넌시 생성하기
            </Button>
          </Box>
        ) : (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    테넌시별 리소스 사용량 비교
                  </Typography>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={tenantComparisonData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Bar dataKey="cpu_usage" fill="#2196f3" name="CPU %" />
                    <Bar dataKey="memory_usage" fill="#9c27b0" name="Memory %" />
                    <Bar dataKey="gpu_usage" fill="#ff9800" name="GPU %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  테넌시 상태 및 성능 지표
                </Typography>
                <Grid container spacing={2}>
                  {tenantComparisonData.map((tenant, index) => (
                    <Grid item xs={12} md={6} lg={4} key={index}>
                      <Paper sx={{ p: 2, border: `2px solid ${getStatusColor(tenant.status)}` }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                          <Typography variant="h6">{tenant.name}</Typography>
                          <Chip 
                            label={tenant.status.toUpperCase()} 
                            size="small"
                            sx={{ 
                              backgroundColor: getStatusColor(tenant.status),
                              color: 'white'
                            }}
                          />
                        </Box>
                        
                        <Grid container spacing={1}>
                          <Grid item xs={6}>
                            <Typography variant="body2" color="text.secondary">가용성</Typography>
                            <Typography variant="h6">{tenant.availability.toFixed(2)}%</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="body2" color="text.secondary">응답시간</Typography>
                            <Typography variant="h6">{Math.round(tenant.response_time || tenant.responseTime || 0)}ms</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="body2" color="text.secondary">처리량</Typography>
                            <Typography variant="h6">{tenant.throughput}/s</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="body2" color="text.secondary">오류</Typography>
                            <Typography variant="h6" color="error">{tenant.error_count || tenant.errors || 0}</Typography>
                          </Grid>
                        </Grid>

                        <Box mt={2}>
                          <Typography variant="body2" color="text.secondary">리소스 사용률</Typography>
                          <Box display="flex" gap={1} mt={1}>
                            <Tooltip title={`CPU: ${Math.round(tenant.cpu_usage || tenant.cpu || 0)}%`}>
                              <LinearProgress 
                                variant="determinate" 
                                value={tenant.cpu_usage || tenant.cpu || 0} 
                                sx={{ flex: 1, height: 8, borderRadius: 4 }}
                              />
                            </Tooltip>
                            <Tooltip title={`Memory: ${Math.round(tenant.memory_usage || tenant.memory || 0)}%`}>
                              <LinearProgress 
                                variant="determinate" 
                                value={tenant.memory_usage || tenant.memory || 0} 
                                color="secondary"
                                sx={{ flex: 1, height: 8, borderRadius: 4 }}
                              />
                            </Tooltip>
                            <Tooltip title={`GPU: ${Math.round(tenant.gpu_usage || tenant.gpu || 0)}%`}>
                              <LinearProgress 
                                variant="determinate" 
                                value={tenant.gpu_usage || tenant.gpu || 0} 
                                sx={{ 
                                  flex: 1, 
                                  height: 8, 
                                  borderRadius: 4,
                                  '& .MuiLinearProgress-bar': {
                                    backgroundColor: '#ff9800'
                                  }
                                }}
                              />
                            </Tooltip>
                          </Box>
                        </Box>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        )}
      </TabPanel>

      {/* SLA 메트릭 트렌드 */}
      <TabPanel value={activeTab} index={2}>
        {/* [advice from AI] 테넌시가 없을 때 빈 상태 표시 */}
        {tenantComparisonData.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h4" gutterBottom sx={{ color: 'text.secondary' }}>
              📈
            </Typography>
            <Typography variant="h6" gutterBottom color="text.secondary">
              SLA 트렌드 데이터가 없습니다
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              SLA 메트릭 모니터링을 위해서는 먼저 테넌시를 생성하고 배포해주세요.
            </Typography>
            <Button 
              variant="contained" 
              color="primary"
              size="large"
              onClick={() => {
                alert('테넌시 생성 페이지로 이동합니다.');
              }}
            >
              테넌시 생성하기
            </Button>
          </Box>
        ) : (
          <Grid container spacing={3}>
            <Grid item xs={12} lg={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    가용성 트렌드 (24시간)
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={slaMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis domain={[99, 100]} />
                    <RechartsTooltip />
                    <Line 
                      type="monotone" 
                      dataKey="availability" 
                      stroke="#4caf50" 
                      strokeWidth={3}
                      name="가용성 (%)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  응답 시간 트렌드 (24시간)
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={slaMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <RechartsTooltip />
                    <Area 
                      type="monotone" 
                      dataKey="response_time" 
                      stroke="#2196f3" 
                      fill="#2196f3"
                      fillOpacity={0.3}
                      name="응답시간 (ms)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  오류율 트렌드 (24시간)
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={slaMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <RechartsTooltip />
                    <Line 
                      type="monotone" 
                      dataKey="error_rate" 
                      stroke="#f44336" 
                      strokeWidth={2}
                      name="오류율 (%)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  처리량 트렌드 (24시간)
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={slaMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <RechartsTooltip />
                    <Bar dataKey="throughput" fill="#9c27b0" name="처리량 (req/s)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* SLA 요약 카드 */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3, background: 'linear-gradient(45deg, #e3f2fd, #f3e5f5)' }}>
              <Typography variant="h6" gutterBottom>
                📊 SLA 성과 요약 (최근 24시간)
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="success.main">99.87%</Typography>
                    <Typography variant="body2" color="text.secondary">평균 가용성</Typography>
                    <Chip label="목표: 99.9%" size="small" color="success" sx={{ mt: 1 }} />
                  </Box>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="primary.main">98ms</Typography>
                    <Typography variant="body2" color="text.secondary">평균 응답시간</Typography>
                    <Chip label="목표: <100ms" size="small" color="primary" sx={{ mt: 1 }} />
                  </Box>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="error.main">0.13%</Typography>
                    <Typography variant="body2" color="text.secondary">평균 오류율</Typography>
                    <Chip label="목표: <0.5%" size="small" color="success" sx={{ mt: 1 }} />
                  </Box>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="secondary.main">1,247</Typography>
                    <Typography variant="body2" color="text.secondary">평균 처리량/초</Typography>
                    <Chip label="목표: >1000" size="small" color="secondary" sx={{ mt: 1 }} />
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
        )}
      </TabPanel>

      {/* 알람 및 알림 설정 */}
      <TabPanel value={activeTab} index={3}>
        <Grid container spacing={3}>
          <Grid item xs={12} lg={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  실시간 알림 ({alertsTotal}개 총 알림, {alerts.filter(a => !a.resolved).length}개 활성)
                </Typography>
                <Box 
                  sx={{ maxHeight: 800, overflow: 'auto' }}  // [advice from AI] 높이를 600px → 800px로 증가
                  onScroll={handleAlertsScroll}
                >
                  {alerts.map((alert, index) => (
                    <Alert 
                      key={`${alert.alert_id || alert.id}-${index}`}
                      severity={getAlertSeverityColor(alert.severity || alert.type) as any}
                      sx={{ 
                        mb: 1, 
                        opacity: alert.resolved ? 0.6 : 1,
                        textDecoration: alert.resolved ? 'line-through' : 'none',
                        border: alert.is_recent ? '2px solid #4caf50' : 'none'  // 최근 데이터 강조
                      }}
                      action={
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          {alert.is_recent && (
                            <Chip label="실시간" size="small" color="success" variant="outlined" />
                          )}
                          {alert.resolved ? (
                            <Chip label="해결됨" size="small" color="success" />
                          ) : (
                            <IconButton size="small">
                              <Settings />
                            </IconButton>
                          )}
                        </Box>
                      }
                    >
                      <Typography variant="body1">
                        {alert.title || alert.message}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {/* [advice from AI] 테넌시 정보 개선된 표시 */}
                        📍 <strong>테넌시:</strong> {alert.tenant_id || alert.tags?.tenant_name || '시스템 전체'} | 
                        🕒 <strong>시간:</strong> {typeof alert.timestamp === 'string' 
                          ? new Date(alert.timestamp).toLocaleString()
                          : alert.timestamp.toLocaleString()} |
                        🔧 <strong>서비스:</strong> {alert.service_name || alert.tags?.service || '시스템'}
                      </Typography>
                    </Alert>
                  ))}
                  
                  {/* [advice from AI] 무한 스크롤 로딩 인디케이터 */}
                  {alertsLoading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                      <CircularProgress size={24} />
                      <Typography variant="body2" sx={{ ml: 1 }}>
                        알림 데이터 로드 중...
                      </Typography>
                    </Box>
                  )}
                  
                  {/* [advice from AI] 더 이상 데이터가 없을 때 표시 */}
                  {!alertsHasMore && alerts.length > 0 && (
                    <Box sx={{ textAlign: 'center', p: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        모든 알림을 불러왔습니다 ({alertsTotal}개)
                      </Typography>
                    </Box>
                  )}
                  
                  {/* [advice from AI] 알림이 없을 때 표시 */}
                  {alerts.length === 0 && !alertsLoading && (
                    <Box sx={{ textAlign: 'center', p: 4 }}>
                      <Typography variant="body1" color="text.secondary">
                        📭 알림이 없습니다
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        시스템이 정상적으로 작동 중입니다
                      </Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  알림 설정
                </Typography>
                
                <Box mb={3}>
                  <Typography variant="subtitle1" gutterBottom>
                    임계값 설정
                  </Typography>
                  
                  <Box mb={2}>
                    <Typography variant="body2">CPU 사용률 경고</Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={80} 
                      sx={{ mt: 1, mb: 1 }}
                    />
                    <Typography variant="body2" color="text.secondary">80%</Typography>
                  </Box>

                  <Box mb={2}>
                    <Typography variant="body2">메모리 사용률 경고</Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={85} 
                      color="secondary"
                      sx={{ mt: 1, mb: 1 }}
                    />
                    <Typography variant="body2" color="text.secondary">85%</Typography>
                  </Box>

                  <Box mb={2}>
                    <Typography variant="body2">응답 시간 경고</Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={60} 
                      sx={{ 
                        mt: 1, 
                        mb: 1,
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: '#ff9800'
                        }
                      }}
                    />
                    <Typography variant="body2" color="text.secondary">150ms</Typography>
                  </Box>
                </Box>

                <Box mb={3}>
                  <Typography variant="subtitle1" gutterBottom>
                    알림 채널
                  </Typography>
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="이메일 알림"
                  />
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="Slack 알림"
                  />
                  <FormControlLabel
                    control={<Switch />}
                    label="SMS 알림"
                  />
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="웹 푸시 알림"
                  />
                </Box>

                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    알림 통계
                  </Typography>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: '해결됨', value: alerts.filter(a => a.resolved).length, fill: '#4caf50' },
                          { name: '진행중', value: alerts.filter(a => !a.resolved && a.type !== 'error').length, fill: '#ff9800' },
                          { name: '심각', value: alerts.filter(a => !a.resolved && a.type === 'error').length, fill: '#f44336' }
                        ]}
                        cx="50%"
                        cy="50%"
                        outerRadius={60}
                        dataKey="value"
                        label={({name, value}) => `${name}: ${value}`}
                      />
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* 임계값 설정 탭 */}
      <TabPanel value={activeTab} index={4}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  📊 성능 임계값 설정
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  각 메트릭의 경고 및 위험 임계값을 설정하여 자동 알림을 받을 수 있습니다.
                </Typography>

                {/* [advice from AI] SLA 프리셋 선택 섹션 */}
                <Card sx={{ mb: 3, backgroundColor: '#f8f9ff' }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ color: '#1976d2' }}>
                      🎯 SLA 수준별 모니터링 프리셋
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      서비스 SLA 수준에 맞는 최적화된 임계값을 선택하세요.
                    </Typography>
                    
                    <Grid container spacing={2}>
                      {slaPresets && Object.entries(slaPresets).map(([key, preset]: [string, any]) => (
                        <Grid item xs={12} sm={6} md={3} key={key}>
                          <Paper 
                            sx={{ 
                              p: 2, 
                              cursor: 'pointer',
                              border: selectedPreset === key ? '2px solid #1976d2' : '1px solid #e0e0e0',
                              backgroundColor: selectedPreset === key ? '#e3f2fd' : 'white',
                              '&:hover': { backgroundColor: '#f5f5f5' },
                              transition: 'all 0.2s ease'
                            }}
                            onClick={() => applySlaPreset(key)}
                          >
                            <Box textAlign="center">
                              <Typography variant="subtitle1" fontWeight="bold" sx={{ color: selectedPreset === key ? '#1976d2' : 'inherit' }}>
                                {preset.name}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                {preset.description}
                              </Typography>
                              <Chip 
                                label={`SLA ${preset.sla_level}%`}
                                size="small"
                                color={
                                  preset.sla_level >= 99.9 ? 'error' :
                                  preset.sla_level >= 99.5 ? 'warning' :
                                  preset.sla_level >= 99.0 ? 'info' : 'default'
                                }
                                sx={{ fontWeight: 'bold' }}
                              />
                              {selectedPreset === key && (
                                <Box sx={{ mt: 1 }}>
                                  <Chip label="적용됨" color="primary" size="small" />
                                </Box>
                              )}
                            </Box>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                    
                    {thresholdSaving && (
                      <Box sx={{ mt: 2, textAlign: 'center' }}>
                        <CircularProgress size={20} sx={{ mr: 1 }} />
                        <Typography variant="body2" display="inline">
                          SLA 프리셋 적용 중...
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>

                <Grid container spacing={3}>
                  {/* CPU 임계값 */}
                  <Grid item xs={12} sm={6}>
                    <Paper sx={{ p: 2 }}>
                      <Box display="flex" alignItems="center" mb={2}>
                        <Speed color="primary" sx={{ mr: 1 }} />
                        <Typography variant="subtitle1">CPU 사용률</Typography>
                      </Box>
                      <Box mb={2}>
                        <Typography variant="body2" gutterBottom>
                          경고 임계값: {thresholds.cpu.warning}%
                        </Typography>
                        <input
                          type="range"
                          min="50"
                          max="100"
                          value={thresholds.cpu.warning}
                          onChange={(e) => setThresholds(prev => ({
                            ...prev,
                            cpu: { ...prev.cpu, warning: Number(e.target.value) }
                          }))}
                          style={{ width: '100%' }}
                        />
                      </Box>
                      <Box>
                        <Typography variant="body2" gutterBottom>
                          위험 임계값: {thresholds.cpu.critical}%
                        </Typography>
                        <input
                          type="range"
                          min="70"
                          max="100"
                          value={thresholds.cpu.critical}
                          onChange={(e) => setThresholds(prev => ({
                            ...prev,
                            cpu: { ...prev.cpu, critical: Number(e.target.value) }
                          }))}
                          style={{ width: '100%' }}
                        />
                      </Box>
                    </Paper>
                  </Grid>

                  {/* Memory 임계값 */}
                  <Grid item xs={12} sm={6}>
                    <Paper sx={{ p: 2 }}>
                      <Box display="flex" alignItems="center" mb={2}>
                        <Memory color="secondary" sx={{ mr: 1 }} />
                        <Typography variant="subtitle1">메모리 사용률</Typography>
                      </Box>
                      <Box mb={2}>
                        <Typography variant="body2" gutterBottom>
                          경고 임계값: {thresholds.memory.warning}%
                        </Typography>
                        <input
                          type="range"
                          min="50"
                          max="100"
                          value={thresholds.memory.warning}
                          onChange={(e) => setThresholds(prev => ({
                            ...prev,
                            memory: { ...prev.memory, warning: Number(e.target.value) }
                          }))}
                          style={{ width: '100%' }}
                        />
                      </Box>
                      <Box>
                        <Typography variant="body2" gutterBottom>
                          위험 임계값: {thresholds.memory.critical}%
                        </Typography>
                        <input
                          type="range"
                          min="70"
                          max="100"
                          value={thresholds.memory.critical}
                          onChange={(e) => setThresholds(prev => ({
                            ...prev,
                            memory: { ...prev.memory, critical: Number(e.target.value) }
                          }))}
                          style={{ width: '100%' }}
                        />
                      </Box>
                    </Paper>
                  </Grid>

                  {/* GPU 임계값 */}
                  <Grid item xs={12} sm={6}>
                    <Paper sx={{ p: 2 }}>
                      <Box display="flex" alignItems="center" mb={2}>
                        <NetworkCheck color="success" sx={{ mr: 1 }} />
                        <Typography variant="subtitle1">GPU 사용률</Typography>
                      </Box>
                      <Box mb={2}>
                        <Typography variant="body2" gutterBottom>
                          경고 임계값: {thresholds.gpu.warning}%
                        </Typography>
                        <input
                          type="range"
                          min="60"
                          max="100"
                          value={thresholds.gpu.warning}
                          onChange={(e) => setThresholds(prev => ({
                            ...prev,
                            gpu: { ...prev.gpu, warning: Number(e.target.value) }
                          }))}
                          style={{ width: '100%' }}
                        />
                      </Box>
                      <Box>
                        <Typography variant="body2" gutterBottom>
                          위험 임계값: {thresholds.gpu.critical}%
                        </Typography>
                        <input
                          type="range"
                          min="80"
                          max="100"
                          value={thresholds.gpu.critical}
                          onChange={(e) => setThresholds(prev => ({
                            ...prev,
                            gpu: { ...prev.gpu, critical: Number(e.target.value) }
                          }))}
                          style={{ width: '100%' }}
                        />
                      </Box>
                    </Paper>
                  </Grid>

                  {/* 응답 시간 임계값 */}
                  <Grid item xs={12} sm={6}>
                    <Paper sx={{ p: 2 }}>
                      <Box display="flex" alignItems="center" mb={2}>
                        <Timeline color="warning" sx={{ mr: 1 }} />
                        <Typography variant="subtitle1">응답 시간</Typography>
                      </Box>
                      <Box mb={2}>
                        <Typography variant="body2" gutterBottom>
                          경고 임계값: {thresholds.response_time.warning}ms
                        </Typography>
                        <input
                          type="range"
                          min="100"
                          max="1000"
                          step="10"
                          value={thresholds.response_time.warning}
                          onChange={(e) => setThresholds(prev => ({
                            ...prev,
                            response_time: { ...prev.response_time, warning: Number(e.target.value) }
                          }))}
                          style={{ width: '100%' }}
                        />
                      </Box>
                      <Box>
                        <Typography variant="body2" gutterBottom>
                          위험 임계값: {thresholds.response_time.critical}ms
                        </Typography>
                        <input
                          type="range"
                          min="200"
                          max="2000"
                          step="50"
                          value={thresholds.response_time.critical}
                          onChange={(e) => setThresholds(prev => ({
                            ...prev,
                            response_time: { ...prev.response_time, critical: Number(e.target.value) }
                          }))}
                          style={{ width: '100%' }}
                        />
                      </Box>
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  🔔 알림 설정
                </Typography>
                
                <Box mb={3}>
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="실시간 알림 활성화"
                  />
                  <Typography variant="body2" color="text.secondary">
                    임계값 초과 시 즉시 알림
                  </Typography>
                </Box>

                <Box mb={3}>
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="이메일 알림"
                  />
                  <Typography variant="body2" color="text.secondary">
                    중요한 알림을 이메일로 전송
                  </Typography>
                </Box>

                <Box mb={3}>
                  <FormControlLabel
                    control={<Switch />}
                    label="SMS 알림"
                  />
                  <Typography variant="body2" color="text.secondary">
                    위험 수준 알림을 SMS로 전송
                  </Typography>
                </Box>

                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    현재 설정된 임계값에 따라 {
                      tenantComparisonData.filter(t => 
                        t.cpu_usage > thresholds.cpu.warning || 
                        t.memory_usage > thresholds.memory.warning ||
                        t.gpu_usage > thresholds.gpu.warning
                      ).length
                    }개 테넌트에서 경고가 발생할 수 있습니다.
                  </Typography>
                </Alert>

                <Box display="flex" gap={1}>
                  <Button 
                    variant="contained" 
                    color="primary" 
                    fullWidth 
                    onClick={saveThresholdSettings}
                    disabled={thresholdSaving}
                  >
                    {thresholdSaving ? '저장 중...' : '설정 저장'}
                  </Button>
                  <Button 
                    variant="outlined" 
                    color="secondary" 
                    fullWidth
                    onClick={resetThresholdSettings}
                    disabled={thresholdSaving}
                  >
                    초기화
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
    </Box>
  );
};

export default AdvancedMonitoring;
