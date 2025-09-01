/**
 * [advice from AI] 실시간 알림 서비스 - WebSocket 기반
 * ECP-AI Kubernetes Orchestrator 실시간 알림 시스템
 */

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  category: 'tenant' | 'service' | 'resource' | 'system';
  data?: any;
}

export interface NotificationSettings {
  enabled: boolean;
  sound: boolean;
  desktop: boolean;
  categories: {
    tenant: boolean;
    service: boolean;
    resource: boolean;
    system: boolean;
  };
}

class NotificationService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: ((notification: Notification) => void)[] = [];
  private settings: NotificationSettings = {
    enabled: true,
    sound: true,
    desktop: true,
    categories: {
      tenant: true,
      service: true,
      resource: true,
      system: true
    }
  };

  constructor() {
    this.loadSettings();
    this.requestNotificationPermission();
  }

  /**
   * 알림 권한 요청
   */
  private async requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }

  /**
   * 설정 로드
   */
  private loadSettings() {
    try {
      const saved = localStorage.getItem('ecp-ai-notification-settings');
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.warn('알림 설정 로드 실패:', error);
    }
  }

  /**
   * 설정 저장
   */
  private saveSettings() {
    try {
      localStorage.setItem('ecp-ai-notification-settings', JSON.stringify(this.settings));
    } catch (error) {
      console.warn('알림 설정 저장 실패:', error);
    }
  }

  /**
   * WebSocket 연결
   */
  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:8001/ws/notifications';
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('🔔 알림 WebSocket 연결됨');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleNotification(data);
        } catch (error) {
          console.error('알림 데이터 파싱 실패:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('🔔 알림 WebSocket 연결 끊어짐');
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('🔔 알림 WebSocket 오류:', error);
      };
    } catch (error) {
      console.error('WebSocket 연결 실패:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * 재연결 스케줄링
   */
  private scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`🔔 알림 재연결 시도 ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  /**
   * 알림 처리
   */
  private handleNotification(data: any) {
    if (!this.settings.enabled) return;

    const notification: Notification = {
      id: data.id || Date.now().toString(),
      type: data.type || 'info',
      title: data.title || '알림',
      message: data.message || '',
      timestamp: new Date(data.timestamp || Date.now()),
      read: false,
      category: data.category || 'system',
      data: data.data
    };

    // 카테고리 필터링
    if (!this.settings.categories[notification.category]) return;

    // 데스크톱 알림
    if (this.settings.desktop && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification.id
      });
    }

    // 소리 알림
    if (this.settings.sound) {
      this.playNotificationSound();
    }

    // 리스너들에게 알림
    this.listeners.forEach(listener => listener(notification));
  }

  /**
   * 알림 소리 재생
   */
  private playNotificationSound() {
    try {
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {
        // 소리 재생 실패 시 무시
      });
    } catch (error) {
      // 오디오 재생 실패 시 무시
    }
  }

  /**
   * 알림 리스너 등록
   */
  addListener(listener: (notification: Notification) => void) {
    this.listeners.push(listener);
  }

  /**
   * 알림 리스너 제거
   */
  removeListener(listener: (notification: Notification) => void) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 설정 업데이트
   */
  updateSettings(newSettings: Partial<NotificationSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
  }

  /**
   * 설정 조회
   */
  getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  /**
   * 연결 해제
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * 테스트 알림 전송
   */
  sendTestNotification() {
    const testNotification: Notification = {
      id: 'test-' + Date.now(),
      type: 'info',
      title: '테스트 알림',
      message: '실시간 알림 시스템이 정상적으로 작동합니다!',
      timestamp: new Date(),
      read: false,
      category: 'system'
    };

    this.handleNotification(testNotification);
  }
}

export const notificationService = new NotificationService();
