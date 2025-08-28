#!/usr/bin/env python3
"""
ECP-AI Kubernetes Orchestrator 실사용 환경 클라이언트
실제 운영 환경에서 사용하는 완전한 예제 코드
"""

import requests
import json
import time
import logging
import os
import asyncio
import websocket
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum


# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class TenantStatus(Enum):
    PENDING = "pending"
    DEPLOYING = "deploying"
    RUNNING = "running"
    FAILED = "failed"
    DELETING = "deleting"


@dataclass
class TenantConfig:
    """테넌트 설정"""
    tenant_id: str
    name: str
    preset: str
    service_requirements: Dict[str, int]
    sla_target: Dict[str, str]
    description: str = ""
    namespace: Optional[str] = None


class ProductionECPClient:
    """실사용 환경용 ECP Orchestrator 클라이언트"""
    
    def __init__(self, 
                 api_url: str,
                 auth_token: str,
                 timeout: int = 30,
                 retry_count: int = 3):
        self.api_url = api_url.rstrip('/')
        self.auth_token = auth_token
        self.timeout = timeout
        self.retry_count = retry_count
        
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {auth_token}',
            'X-Demo-Mode': 'false',  # 실사용 모드 강제
            'User-Agent': 'ECP-Production-Client/1.0'
        })
        
        # WebSocket URL
        self.ws_url = api_url.replace('http://', 'ws://').replace('https://', 'wss://')
        
        logger.info(f"Production ECP Client initialized for {api_url}")
    
    def _make_request(self, method: str, endpoint: str, **kwargs) -> requests.Response:
        """재시도 로직이 포함된 HTTP 요청"""
        url = f"{self.api_url}{endpoint}"
        
        for attempt in range(self.retry_count):
            try:
                response = self.session.request(
                    method, url, timeout=self.timeout, **kwargs
                )
                
                if response.ok:
                    return response
                elif response.status_code == 429:  # Rate limit
                    retry_after = int(response.headers.get('Retry-After', 60))
                    logger.warning(f"Rate limited. Waiting {retry_after} seconds...")
                    time.sleep(retry_after)
                    continue
                elif response.status_code >= 500:  # Server error
                    if attempt < self.retry_count - 1:
                        wait_time = 2 ** attempt
                        logger.warning(f"Server error {response.status_code}. Retrying in {wait_time}s...")
                        time.sleep(wait_time)
                        continue
                
                # 클라이언트 오류나 최종 시도 실패
                try:
                    error_data = response.json()
                    raise Exception(f"API Error {response.status_code}: {error_data}")
                except json.JSONDecodeError:
                    raise Exception(f"HTTP {response.status_code}: {response.text}")
                    
            except requests.RequestException as e:
                if attempt < self.retry_count - 1:
                    wait_time = 2 ** attempt
                    logger.warning(f"Request failed: {e}. Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                    continue
                raise
        
        raise Exception(f"Max retries ({self.retry_count}) exceeded")
    
    # ==========================================
    # 테넌트 관리
    # ==========================================
    
    def create_tenant(self, config: TenantConfig) -> Dict[str, Any]:
        """운영 환경 테넌트 생성"""
        logger.info(f"Creating production tenant: {config.tenant_id}")
        
        # 리소스 계산 먼저 수행
        resource_calc = self.calculate_resources(
            config.service_requirements,
            config.sla_target
        )
        
        logger.info(f"Calculated resources for {config.tenant_id}: {resource_calc['recommended_preset']}")
        logger.info(f"Estimated cost: {resource_calc.get('estimated_cost', 'Unknown')}")
        
        # 사용자 확인 (운영 환경에서는 중요)
        if not self._confirm_deployment(config, resource_calc):
            logger.info("Deployment cancelled by user")
            return {"status": "cancelled"}
        
        # 테넌트 생성 요청
        tenant_data = {
            "tenant_id": config.tenant_id,
            "name": config.name,
            "preset": config.preset or resource_calc['recommended_preset'],
            "service_requirements": config.service_requirements,
            "sla_target": config.sla_target,
            "description": config.description
        }
        
        if config.namespace:
            tenant_data["namespace"] = config.namespace
        
        response = self._make_request('POST', '/api/v1/tenants/', json=tenant_data)
        result = response.json()
        
        logger.info(f"Tenant creation initiated: {result.get('deployment_id')}")
        return result
    
    def get_tenant_status(self, tenant_id: str) -> Dict[str, Any]:
        """테넌트 상태 조회"""
        try:
            response = self._make_request('GET', f'/api/v1/tenants/{tenant_id}')
            return response.json()
        except Exception as e:
            logger.error(f"Failed to get tenant status for {tenant_id}: {e}")
            return {"status": "unknown", "error": str(e)}
    
    def wait_for_deployment(self, tenant_id: str, timeout: int = 1200) -> bool:
        """배포 완료까지 대기 (최대 20분)"""
        logger.info(f"Waiting for deployment completion: {tenant_id}")
        
        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                status = self.get_deployment_status(tenant_id)
                
                if status.get('overall_status') == 'ready':
                    logger.info(f"Deployment completed successfully: {tenant_id}")
                    return True
                elif status.get('status') == 'failed':
                    logger.error(f"Deployment failed: {tenant_id}")
                    return False
                
                progress = status.get('progress', 0)
                phase = status.get('phase', 'unknown')
                logger.info(f"Deployment progress: {progress}% - {phase}")
                
                time.sleep(30)  # 30초마다 확인
                
            except Exception as e:
                logger.warning(f"Error checking deployment status: {e}")
                time.sleep(30)
        
        logger.error(f"Deployment timeout after {timeout} seconds: {tenant_id}")
        return False
    
    def get_deployment_status(self, tenant_id: str) -> Dict[str, Any]:
        """배포 상태 상세 조회"""
        response = self._make_request('GET', f'/api/v1/tenants/{tenant_id}/deployment-status')
        return response.json()
    
    def scale_tenant(self, tenant_id: str, service_requirements: Dict[str, int]) -> Dict[str, Any]:
        """테넌트 스케일링"""
        logger.info(f"Scaling tenant {tenant_id}: {service_requirements}")
        
        update_data = {
            "service_requirements": service_requirements
        }
        
        response = self._make_request('PUT', f'/api/v1/tenants/{tenant_id}', json=update_data)
        return response.json()
    
    def delete_tenant(self, tenant_id: str, force: bool = False) -> Dict[str, Any]:
        """테넌트 삭제 (운영 환경에서는 신중히)"""
        if not force:
            # 안전 확인
            confirmation = input(f"정말로 테넌트 '{tenant_id}'를 삭제하시겠습니까? (yes/no): ")
            if confirmation.lower() != 'yes':
                logger.info("Deletion cancelled")
                return {"status": "cancelled"}
        
        logger.warning(f"Deleting tenant: {tenant_id}")
        
        params = {'force': force} if force else {}
        response = self._make_request('DELETE', f'/api/v1/tenants/{tenant_id}', params=params)
        return response.json()
    
    # ==========================================
    # 모니터링 및 메트릭
    # ==========================================
    
    def get_production_metrics(self, tenant_id: str, hours: int = 24) -> Dict[str, Any]:
        """운영 환경 메트릭 조회"""
        params = {
            'hours': hours,
            'interval': '5m'  # 5분 간격
        }
        
        response = self._make_request(
            'GET', 
            f'/api/v1/tenants/{tenant_id}/monitoring',
            params=params
        )
        return response.json()
    
    def send_custom_metrics(self, tenant_id: str, metrics: Dict[str, float]) -> bool:
        """커스텀 메트릭 전송"""
        try:
            data = {
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'metrics': metrics
            }
            
            response = self._make_request(
                'POST', 
                f'/api/v1/tenants/{tenant_id}/monitoring',
                json=data
            )
            
            logger.debug(f"Metrics sent for {tenant_id}: {list(metrics.keys())}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send metrics for {tenant_id}: {e}")
            return False
    
    def setup_monitoring_alerts(self, tenant_id: str, alert_config: Dict[str, Any]) -> Dict[str, Any]:
        """모니터링 알림 설정"""
        logger.info(f"Setting up alerts for {tenant_id}")
        
        response = self._make_request(
            'POST',
            f'/api/v1/tenants/{tenant_id}/alerts',
            json=alert_config
        )
        return response.json()
    
    # ==========================================
    # 매니페스트 및 배포
    # ==========================================
    
    def generate_production_manifest(self, tenant_id: str, 
                                   include_monitoring: bool = True,
                                   include_ingress: bool = True,
                                   custom_namespace: str = None) -> str:
        """운영용 매니페스트 생성"""
        params = {
            'format': 'yaml',
            'include_monitoring': include_monitoring,
            'include_ingress': include_ingress
        }
        
        if custom_namespace:
            params['namespace'] = custom_namespace
        
        response = self._make_request(
            'GET',
            f'/api/v1/tenants/{tenant_id}/manifest',
            params=params
        )
        
        return response.text
    
    def validate_manifest(self, tenant_id: str, manifest_content: str) -> Dict[str, Any]:
        """매니페스트 검증"""
        data = {
            'tenant_id': tenant_id,
            'manifest_content': manifest_content
        }
        
        response = self._make_request(
            'POST',
            '/api/v1/tenants/validate-manifest',
            json=data
        )
        
        return response.json()
    
    def deploy_to_kubernetes(self, tenant_id: str, manifest_file: str = None) -> Dict[str, Any]:
        """Kubernetes에 직접 배포"""
        # 매니페스트 생성
        manifest_content = self.generate_production_manifest(
            tenant_id,
            include_monitoring=True,
            include_ingress=True
        )
        
        # 매니페스트 검증
        validation = self.validate_manifest(tenant_id, manifest_content)
        
        if not validation.get('valid'):
            logger.error(f"Manifest validation failed: {validation.get('errors')}")
            return {"status": "validation_failed", "errors": validation.get('errors')}
        
        # 경고사항 출력
        if validation.get('warnings'):
            logger.warning("Manifest warnings:")
            for warning in validation['warnings']:
                logger.warning(f"  - {warning}")
        
        # 매니페스트 파일 저장
        if not manifest_file:
            manifest_file = f"{tenant_id}-production-{datetime.now().strftime('%Y%m%d_%H%M%S')}.yaml"
        
        with open(manifest_file, 'w', encoding='utf-8') as f:
            f.write(manifest_content)
        
        logger.info(f"Manifest saved: {manifest_file}")
        
        # kubectl 명령어 제안
        kubectl_cmd = f"kubectl apply -f {manifest_file}"
        logger.info(f"To deploy, run: {kubectl_cmd}")
        
        return {
            "status": "manifest_ready",
            "manifest_file": manifest_file,
            "kubectl_command": kubectl_cmd,
            "validation": validation
        }
    
    # ==========================================
    # 실시간 모니터링
    # ==========================================
    
    def start_realtime_monitoring(self, tenant_id: str, 
                                 callback_func,
                                 metrics: List[str] = None) -> threading.Thread:
        """실시간 모니터링 시작"""
        if metrics is None:
            metrics = ['cpu', 'memory', 'gpu', 'request_count', 'response_time']
        
        def monitoring_thread():
            def on_message(ws, message):
                try:
                    data = json.loads(message)
                    callback_func(data)
                except Exception as e:
                    logger.error(f"Error processing monitoring message: {e}")
            
            def on_error(ws, error):
                logger.error(f"WebSocket error: {error}")
            
            def on_open(ws):
                logger.info(f"Real-time monitoring connected: {tenant_id}")
                subscribe_msg = {
                    'action': 'subscribe',
                    'metrics': metrics,
                    'interval': 10000  # 10초 간격
                }
                ws.send(json.dumps(subscribe_msg))
            
            def on_close(ws, close_status_code, close_msg):
                logger.info(f"Monitoring connection closed: {tenant_id}")
            
            # WebSocket 연결
            ws_url = f"{self.ws_url}/ws/monitoring/{tenant_id}"
            headers = {'Authorization': f'Bearer {self.auth_token}'}
            
            ws = websocket.WebSocketApp(
                ws_url,
                header=headers,
                on_message=on_message,
                on_error=on_error,
                on_open=on_open,
                on_close=on_close
            )
            
            ws.run_forever()
        
        thread = threading.Thread(target=monitoring_thread, daemon=True)
        thread.start()
        
        return thread
    
    # ==========================================
    # 유틸리티 메서드
    # ==========================================
    
    def calculate_resources(self, service_requirements: Dict[str, int],
                          sla_target: Dict[str, str]) -> Dict[str, Any]:
        """리소스 계산"""
        data = {
            'service_requirements': service_requirements,
            'sla_target': sla_target
        }
        
        response = self._make_request('POST', '/api/v1/tenants/calculate-resources', json=data)
        return response.json()
    
    def get_system_status(self) -> Dict[str, Any]:
        """시스템 전체 상태 조회"""
        response = self._make_request('GET', '/api/v1/monitoring/system')
        return response.json()
    
    def health_check(self) -> bool:
        """API 상태 확인"""
        try:
            response = self._make_request('GET', '/health')
            return response.status_code == 200
        except:
            return False
    
    def _confirm_deployment(self, config: TenantConfig, resource_calc: Dict[str, Any]) -> bool:
        """배포 확인 (운영 환경용)"""
        print(f"\n{'='*60}")
        print(f"운영 환경 테넌트 배포 확인")
        print(f"{'='*60}")
        print(f"테넌트 ID: {config.tenant_id}")
        print(f"이름: {config.name}")
        print(f"권장 프리셋: {resource_calc['recommended_preset']}")
        print(f"예상 비용: {resource_calc.get('estimated_cost', 'Unknown')}")
        print(f"서비스 요구사항: {config.service_requirements}")
        print(f"SLA 목표: {config.sla_target}")
        
        if resource_calc.get('warnings'):
            print(f"\n⚠️  경고사항:")
            for warning in resource_calc['warnings']:
                print(f"   - {warning}")
        
        print(f"{'='*60}")
        
        while True:
            confirm = input("배포를 진행하시겠습니까? (yes/no): ").strip().lower()
            if confirm in ['yes', 'y']:
                return True
            elif confirm in ['no', 'n']:
                return False
            else:
                print("'yes' 또는 'no'를 입력해주세요.")


# ==========================================
# 실사용 예제 시나리오
# ==========================================

def example_production_deployment():
    """실제 운영 환경 배포 예제"""
    print("=== 운영 환경 AI 서비스 배포 예제 ===")
    
    # 환경 변수에서 설정 읽기
    api_url = os.getenv('ECP_API_URL', 'https://api.your-company.com/api/v1')
    auth_token = os.getenv('ECP_AUTH_TOKEN')
    
    if not auth_token:
        print("Error: ECP_AUTH_TOKEN 환경 변수가 설정되지 않았습니다.")
        return
    
    # 클라이언트 초기화
    client = ProductionECPClient(api_url, auth_token)
    
    # 시스템 상태 확인
    if not client.health_check():
        print("Error: ECP API가 응답하지 않습니다.")
        return
    
    print("✓ ECP API 연결 성공")
    
    # 테넌트 설정
    config = TenantConfig(
        tenant_id="prod-ai-call-center-v2",
        name="운영 AI 콜센터 v2.0",
        preset="",  # 자동 계산
        service_requirements={
            "callbot": 200,      # 동시 콜봇 세션
            "chatbot": 500,      # 동시 챗봇 세션
            "advisor": 100,      # 상담사 지원 세션
            "stt": 150,         # 음성인식 동시 처리
            "tts": 150,         # 음성합성 동시 처리
            "nlp": 80,          # NLP 엔진
            "aicm": 50          # AI 대화 관리
        },
        sla_target={
            "availability": "99.95%",
            "response_time": "150ms",
            "concurrent_users": "1000"
        },
        description="운영 환경 AI 콜센터 서비스 - 고가용성 구성"
    )
    
    try:
        # 1. 테넌트 생성
        result = client.create_tenant(config)
        
        if result.get('status') == 'cancelled':
            print("배포가 취소되었습니다.")
            return
        
        tenant_id = result['tenant_id']
        deployment_id = result.get('deployment_id')
        
        print(f"✓ 테넌트 생성 시작: {tenant_id}")
        print(f"✓ 배포 ID: {deployment_id}")
        
        # 2. 실시간 모니터링 시작
        def monitoring_callback(data):
            if 'progress' in data:
                print(f"배포 진행률: {data['progress']}% - {data.get('message', '')}")
        
        monitoring_thread = client.start_realtime_monitoring(
            tenant_id, 
            monitoring_callback
        )
        
        # 3. 배포 완료 대기
        success = client.wait_for_deployment(tenant_id, timeout=1800)  # 30분
        
        if success:
            print(f"✓ 배포 완료: {tenant_id}")
            
            # 4. 매니페스트 생성 및 저장
            deployment_result = client.deploy_to_kubernetes(tenant_id)
            
            if deployment_result['status'] == 'manifest_ready':
                print(f"✓ 매니페스트 생성됨: {deployment_result['manifest_file']}")
                print(f"배포 명령어: {deployment_result['kubectl_command']}")
            
            # 5. 초기 상태 확인
            status = client.get_tenant_status(tenant_id)
            print(f"✓ 테넌트 상태: {status['status']}")
            
            # 6. 모니터링 알림 설정
            alert_config = {
                "alert_name": "production_high_load",
                "condition": "cpu_usage > 85 OR memory_usage > 90",
                "duration": "5m",
                "actions": [
                    {
                        "type": "webhook",
                        "url": "https://your-company.com/alerts/webhook",
                        "method": "POST"
                    },
                    {
                        "type": "email",
                        "recipients": ["ops@your-company.com", "admin@your-company.com"]
                    }
                ]
            }
            
            client.setup_monitoring_alerts(tenant_id, alert_config)
            print("✓ 모니터링 알림 설정 완료")
            
            print(f"\n🎉 운영 환경 배포 완료!")
            print(f"테넌트 ID: {tenant_id}")
            print(f"접속 URL: https://your-company.com/tenants/{tenant_id}")
            
        else:
            print(f"❌ 배포 실패: {tenant_id}")
            
            # 실패 로그 조회
            deployment_status = client.get_deployment_status(tenant_id)
            if deployment_status.get('logs'):
                print("배포 로그:")
                for log in deployment_status['logs'][-5:]:  # 마지막 5개
                    print(f"  {log['timestamp']}: {log['message']}")
    
    except Exception as e:
        logger.error(f"배포 중 오류 발생: {e}")
        print(f"❌ 배포 실패: {e}")


def example_monitoring_integration():
    """운영 환경 모니터링 연동 예제"""
    print("\n=== 운영 환경 모니터링 연동 예제 ===")
    
    api_url = os.getenv('ECP_API_URL', 'https://api.your-company.com/api/v1')
    auth_token = os.getenv('ECP_AUTH_TOKEN')
    
    if not auth_token:
        print("Error: ECP_AUTH_TOKEN 환경 변수가 필요합니다.")
        return
    
    client = ProductionECPClient(api_url, auth_token)
    
    # 운영 중인 테넌트 목록 조회
    response = client._make_request('GET', '/api/v1/tenants/')
    tenants = response.json()['tenants']
    
    if not tenants:
        print("운영 중인 테넌트가 없습니다.")
        return
    
    # 첫 번째 테넌트 선택
    tenant = tenants[0]
    tenant_id = tenant['tenant_id']
    
    print(f"모니터링 대상: {tenant['name']} ({tenant_id})")
    
    # 1. 현재 메트릭 조회
    metrics = client.get_production_metrics(tenant_id, hours=1)
    
    if metrics.get('summary'):
        summary = metrics['summary']
        print(f"현재 상태:")
        print(f"  평균 CPU: {summary.get('avg_cpu', 0):.1f}%")
        print(f"  평균 메모리: {summary.get('avg_memory', 0):.1f}%")
        print(f"  평균 GPU: {summary.get('avg_gpu', 0):.1f}%")
    
    # 2. 커스텀 메트릭 전송 예제
    custom_metrics = {
        "business_metric_active_calls": 156,
        "business_metric_queue_length": 23,
        "business_metric_customer_satisfaction": 4.7,
        "business_metric_response_accuracy": 94.2
    }
    
    success = client.send_custom_metrics(tenant_id, custom_metrics)
    if success:
        print("✓ 비즈니스 메트릭 전송 완료")
    
    # 3. 실시간 모니터링 (10초간)
    print("실시간 모니터링 시작 (10초)...")
    
    def realtime_callback(data):
        if 'metrics' in data:
            m = data['metrics']
            timestamp = data.get('timestamp', 'Unknown')
            print(f"[{timestamp}] CPU: {m.get('cpu', 0):.1f}%, "
                  f"Memory: {m.get('memory', 0):.1f}%, "
                  f"Requests: {m.get('request_count', 0)}")
    
    monitoring_thread = client.start_realtime_monitoring(
        tenant_id, 
        realtime_callback,
        metrics=['cpu', 'memory', 'gpu', 'request_count', 'response_time']
    )
    
    time.sleep(10)
    print("실시간 모니터링 종료")


def example_scaling_operations():
    """운영 환경 스케일링 예제"""
    print("\n=== 운영 환경 스케일링 예제 ===")
    
    api_url = os.getenv('ECP_API_URL', 'https://api.your-company.com/api/v1')
    auth_token = os.getenv('ECP_AUTH_TOKEN')
    
    if not auth_token:
        print("Error: ECP_AUTH_TOKEN 환경 변수가 필요합니다.")
        return
    
    client = ProductionECPClient(api_url, auth_token)
    
    # 테넌트 선택 (실제로는 특정 테넌트 ID 사용)
    tenant_id = "prod-ai-call-center-v2"
    
    try:
        # 현재 상태 조회
        current_status = client.get_tenant_status(tenant_id)
        current_requirements = current_status.get('service_requirements', {})
        
        print(f"현재 서비스 요구사항: {current_requirements}")
        
        # 스케일링 시나리오: 트래픽 증가에 따른 확장
        new_requirements = current_requirements.copy()
        new_requirements.update({
            "callbot": int(current_requirements.get("callbot", 100) * 1.5),  # 50% 증가
            "chatbot": int(current_requirements.get("chatbot", 200) * 1.3),  # 30% 증가
            "advisor": int(current_requirements.get("advisor", 50) * 1.2)    # 20% 증가
        })
        
        print(f"새로운 서비스 요구사항: {new_requirements}")
        
        # 스케일링 실행
        result = client.scale_tenant(tenant_id, new_requirements)
        
        if result.get('status') == 'success':
            print("✓ 스케일링 시작됨")
            
            # 스케일링 완료 대기
            success = client.wait_for_deployment(tenant_id, timeout=900)  # 15분
            
            if success:
                print("✓ 스케일링 완료")
            else:
                print("❌ 스케일링 시간 초과")
        
    except Exception as e:
        print(f"❌ 스케일링 실패: {e}")


if __name__ == "__main__":
    print("ECP-AI Kubernetes Orchestrator 운영 환경 클라이언트")
    print("=" * 70)
    
    # 환경 변수 확인
    required_env_vars = ['ECP_API_URL', 'ECP_AUTH_TOKEN']
    missing_vars = [var for var in required_env_vars if not os.getenv(var)]
    
    if missing_vars:
        print("❌ 필수 환경 변수가 설정되지 않았습니다:")
        for var in missing_vars:
            print(f"   - {var}")
        print("\n설정 예시:")
        print("export ECP_API_URL='https://api.your-company.com/api/v1'")
        print("export ECP_AUTH_TOKEN='your-jwt-token-here'")
        exit(1)
    
    try:
        print("사용 가능한 예제:")
        print("1. 운영 환경 배포")
        print("2. 모니터링 연동")
        print("3. 스케일링 작업")
        print("4. 전체 시나리오")
        
        choice = input("\n실행할 예제 번호를 선택하세요 (1-4): ").strip()
        
        if choice == "1":
            example_production_deployment()
        elif choice == "2":
            example_monitoring_integration()
        elif choice == "3":
            example_scaling_operations()
        elif choice == "4":
            example_production_deployment()
            example_monitoring_integration()
            example_scaling_operations()
        else:
            print("잘못된 선택입니다.")
    
    except KeyboardInterrupt:
        print("\n\n프로그램이 중단되었습니다.")
    except Exception as e:
        logger.error(f"예제 실행 중 오류: {e}")
        print(f"❌ 오류 발생: {e}")
    
    print("\n운영 환경 클라이언트 예제 완료!")
