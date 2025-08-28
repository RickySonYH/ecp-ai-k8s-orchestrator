#!/usr/bin/env python3
"""
ECP-AI Kubernetes Orchestrator Python 클라이언트 예제
모니터링 데이터 연결과 매니페스트 생성 예제 포함
"""

import requests
import json
import time
import websocket
import threading
from datetime import datetime
from typing import Dict, List, Optional, Any


class ECPOrchestratorClient:
    """ECP-AI Kubernetes Orchestrator 클라이언트"""
    
    def __init__(self, base_url: str = "http://localhost:8001/api/v1", is_demo: bool = False):
        self.base_url = base_url.rstrip('/')
        self.is_demo = is_demo
        self.ws_base_url = base_url.replace('http://', 'ws://').replace('https://', 'wss://').replace('/api/v1', '')
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'X-Demo-Mode': str(is_demo).lower()
        })
    
    def _make_request(self, method: str, endpoint: str, **kwargs) -> requests.Response:
        """HTTP 요청 실행"""
        url = f"{self.base_url}{endpoint}"
        response = self.session.request(method, url, **kwargs)
        
        if not response.ok:
            try:
                error_data = response.json()
                raise Exception(f"API Error: {error_data}")
            except json.JSONDecodeError:
                raise Exception(f"HTTP {response.status_code}: {response.text}")
        
        return response
    
    # ==========================================
    # 테넌트 관리
    # ==========================================
    
    def get_tenants(self, skip: int = 0, limit: int = 100, 
                   preset: Optional[str] = None, status: Optional[str] = None) -> Dict[str, Any]:
        """테넌트 목록 조회"""
        params = {'skip': skip, 'limit': limit}
        if preset:
            params['preset'] = preset
        if status:
            params['status'] = status
            
        response = self._make_request('GET', '/tenants/', params=params)
        return response.json()
    
    def get_tenant(self, tenant_id: str) -> Dict[str, Any]:
        """테넌트 상세 조회"""
        response = self._make_request('GET', f'/tenants/{tenant_id}')
        return response.json()
    
    def create_tenant(self, tenant_data: Dict[str, Any]) -> Dict[str, Any]:
        """테넌트 생성"""
        response = self._make_request('POST', '/tenants/', json=tenant_data)
        return response.json()
    
    def update_tenant(self, tenant_id: str, update_data: Dict[str, Any]) -> Dict[str, Any]:
        """테넌트 수정"""
        response = self._make_request('PUT', f'/tenants/{tenant_id}', json=update_data)
        return response.json()
    
    def delete_tenant(self, tenant_id: str, force: bool = False) -> Dict[str, Any]:
        """테넌트 삭제"""
        params = {'force': force} if force else {}
        response = self._make_request('DELETE', f'/tenants/{tenant_id}', params=params)
        return response.json()
    
    def calculate_resources(self, service_requirements: Dict[str, int], 
                          sla_target: Dict[str, str]) -> Dict[str, Any]:
        """리소스 계산"""
        data = {
            'service_requirements': service_requirements,
            'sla_target': sla_target
        }
        response = self._make_request('POST', '/tenants/calculate-resources', json=data)
        return response.json()
    
    # ==========================================
    # 모니터링 데이터
    # ==========================================
    
    def get_monitoring_data(self, tenant_id: str, metric_type: Optional[str] = None,
                          hours: int = 24, interval: str = '5m') -> Dict[str, Any]:
        """모니터링 데이터 조회"""
        params = {'hours': hours, 'interval': interval}
        if metric_type:
            params['metric_type'] = metric_type
            
        response = self._make_request('GET', f'/tenants/{tenant_id}/monitoring', params=params)
        return response.json()
    
    def send_metrics(self, tenant_id: str, metrics: Dict[str, float], 
                    timestamp: Optional[str] = None) -> Dict[str, Any]:
        """모니터링 메트릭 전송"""
        data = {
            'timestamp': timestamp or datetime.utcnow().isoformat() + 'Z',
            'metrics': metrics
        }
        response = self._make_request('POST', f'/tenants/{tenant_id}/monitoring', json=data)
        return response.json()
    
    def get_system_metrics(self) -> Dict[str, Any]:
        """시스템 전체 메트릭 조회"""
        response = self._make_request('GET', '/monitoring/system')
        return response.json()
    
    # ==========================================
    # 매니페스트 관리
    # ==========================================
    
    def get_manifest(self, tenant_id: str, format: str = 'yaml',
                    include_monitoring: bool = True, include_ingress: bool = False,
                    namespace: Optional[str] = None) -> str:
        """매니페스트 생성 및 조회"""
        params = {
            'format': format,
            'include_monitoring': include_monitoring,
            'include_ingress': include_ingress
        }
        if namespace:
            params['namespace'] = namespace
            
        response = self._make_request('GET', f'/tenants/{tenant_id}/manifest', params=params)
        return response.text
    
    def validate_manifest(self, tenant_id: str, manifest_content: str) -> Dict[str, Any]:
        """매니페스트 검증"""
        data = {
            'tenant_id': tenant_id,
            'manifest_content': manifest_content
        }
        response = self._make_request('POST', '/tenants/validate-manifest', json=data)
        return response.json()
    
    def get_deployment_status(self, tenant_id: str) -> Dict[str, Any]:
        """배포 상태 조회"""
        response = self._make_request('GET', f'/tenants/{tenant_id}/deployment-status')
        return response.json()
    
    def download_manifest(self, tenant_id: str, output_file: str = None) -> str:
        """매니페스트 파일 다운로드"""
        manifest = self.get_manifest(tenant_id)
        
        if output_file:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(manifest)
            print(f"매니페스트 저장됨: {output_file}")
        
        return manifest
    
    # ==========================================
    # WebSocket 실시간 모니터링
    # ==========================================
    
    def subscribe_to_monitoring(self, tenant_id: str, callback, 
                              metrics: List[str] = None, interval: int = 5000):
        """실시간 모니터링 구독"""
        if metrics is None:
            metrics = ['cpu', 'memory', 'gpu']
            
        def on_message(ws, message):
            try:
                data = json.loads(message)
                callback(data)
            except Exception as e:
                print(f"메시지 처리 오류: {e}")
        
        def on_error(ws, error):
            print(f"WebSocket 오류: {error}")
        
        def on_open(ws):
            print(f"실시간 모니터링 연결됨: {tenant_id}")
            # 구독 설정
            subscribe_msg = {
                'action': 'subscribe',
                'metrics': metrics,
                'interval': interval
            }
            ws.send(json.dumps(subscribe_msg))
        
        ws_url = f"{self.ws_base_url}/ws/monitoring/{tenant_id}"
        ws = websocket.WebSocketApp(ws_url,
                                  on_message=on_message,
                                  on_error=on_error,
                                  on_open=on_open)
        
        # 별도 스레드에서 실행
        def run_ws():
            ws.run_forever()
        
        thread = threading.Thread(target=run_ws, daemon=True)
        thread.start()
        
        return ws
    
    def subscribe_to_deployment(self, deployment_id: str, callback):
        """배포 상태 실시간 구독"""
        def on_message(ws, message):
            try:
                data = json.loads(message)
                callback(data)
            except Exception as e:
                print(f"배포 상태 메시지 처리 오류: {e}")
        
        def on_open(ws):
            print(f"배포 상태 모니터링 연결됨: {deployment_id}")
        
        ws_url = f"{self.ws_base_url}/ws/deployment/{deployment_id}"
        ws = websocket.WebSocketApp(ws_url,
                                  on_message=on_message,
                                  on_open=on_open)
        
        def run_ws():
            ws.run_forever()
        
        thread = threading.Thread(target=run_ws, daemon=True)
        thread.start()
        
        return ws


# ==========================================
# 사용 예제
# ==========================================

def example_basic_usage():
    """기본 사용 예제"""
    print("=== ECP-AI Orchestrator 기본 사용 예제 ===")
    
    # 클라이언트 초기화 (데모 모드)
    client = ECPOrchestratorClient(is_demo=True)
    
    # 1. 테넌트 목록 조회
    print("\n1. 테넌트 목록 조회:")
    tenants = client.get_tenants()
    print(f"총 테넌트 수: {tenants['total_count']}")
    for tenant in tenants['tenants']:
        print(f"  - {tenant['name']} ({tenant['tenant_id']}) - {tenant['status']}")
    
    if tenants['tenants']:
        tenant_id = tenants['tenants'][0]['tenant_id']
        
        # 2. 테넌트 상세 조회
        print(f"\n2. 테넌트 상세 조회: {tenant_id}")
        tenant_detail = client.get_tenant(tenant_id)
        print(f"  프리셋: {tenant_detail['preset']}")
        print(f"  서비스 수: {len(tenant_detail.get('services', []))}")
        
        # 3. 모니터링 데이터 조회
        print(f"\n3. 모니터링 데이터 조회: {tenant_id}")
        monitoring = client.get_monitoring_data(tenant_id, hours=1)
        if monitoring['metrics']:
            for metric_type, values in monitoring['metrics'].items():
                if values:
                    latest = values[-1]
                    print(f"  {metric_type}: {latest['value']}% (최신)")


def example_create_ai_service():
    """AI 서비스 생성 예제"""
    print("\n=== AI 서비스 생성 예제 ===")
    
    # 실사용 모드 클라이언트
    client = ECPOrchestratorClient(is_demo=False)
    
    # 서비스 요구사항 정의
    service_requirements = {
        "callbot": 50,      # 동시 콜봇 세션
        "chatbot": 100,     # 동시 챗봇 세션
        "advisor": 25,      # 상담사 지원 세션
        "stt": 30,         # 음성인식 동시 처리
        "tts": 30          # 음성합성 동시 처리
    }
    
    sla_target = {
        "availability": "99.9%",
        "response_time": "200ms",
        "concurrent_users": "200"
    }
    
    # 1. 리소스 계산
    print("1. 최적 리소스 계산 중...")
    resources = client.calculate_resources(service_requirements, sla_target)
    print(f"  권장 프리셋: {resources['recommended_preset']}")
    print(f"  예상 비용: {resources['estimated_cost']}")
    
    # 2. 테넌트 생성
    tenant_data = {
        "tenant_id": "my-ai-call-center",
        "name": "내 AI 콜센터",
        "preset": resources['recommended_preset'],
        "service_requirements": service_requirements,
        "sla_target": sla_target,
        "description": "AI 콜센터 서비스"
    }
    
    print("2. 테넌트 생성 중...")
    try:
        result = client.create_tenant(tenant_data)
        print(f"  테넌트 생성됨: {result['tenant_id']}")
        print(f"  배포 ID: {result['deployment_id']}")
        print(f"  예상 배포 시간: {result['deployment_time']}")
        
        return result['tenant_id'], result['deployment_id']
    except Exception as e:
        print(f"  테넌트 생성 실패: {e}")
        return None, None


def example_monitoring_integration():
    """모니터링 시스템 연동 예제"""
    print("\n=== 모니터링 시스템 연동 예제 ===")
    
    client = ECPOrchestratorClient(is_demo=True)
    
    # 데모 테넌트 조회
    tenants = client.get_tenants()
    if not tenants['tenants']:
        print("테넌트가 없습니다.")
        return
    
    tenant_id = tenants['tenants'][0]['tenant_id']
    print(f"모니터링 대상: {tenant_id}")
    
    # 1. 커스텀 메트릭 전송
    print("\n1. 커스텀 메트릭 전송:")
    custom_metrics = {
        "cpu_usage": 65.5,
        "memory_usage": 78.2,
        "gpu_usage": 85.0,
        "request_count": 1250,
        "response_time": 145.8,
        "error_rate": 0.02,
        "active_sessions": 85
    }
    
    try:
        result = client.send_metrics(tenant_id, custom_metrics)
        print("  메트릭 전송 성공")
    except Exception as e:
        print(f"  메트릭 전송 실패: {e}")
    
    # 2. 모니터링 데이터 조회
    print("\n2. 최근 모니터링 데이터:")
    monitoring = client.get_monitoring_data(tenant_id, hours=1)
    
    if monitoring.get('summary'):
        summary = monitoring['summary']
        print(f"  평균 CPU: {summary.get('avg_cpu', 0):.1f}%")
        print(f"  최대 CPU: {summary.get('max_cpu', 0):.1f}%")
        print(f"  평균 메모리: {summary.get('avg_memory', 0):.1f}%")
        print(f"  평균 GPU: {summary.get('avg_gpu', 0):.1f}%")
    
    # 3. 실시간 모니터링 구독
    print("\n3. 실시간 모니터링 시작 (10초간):")
    
    def monitoring_callback(data):
        if 'metrics' in data:
            metrics = data['metrics']
            timestamp = data.get('timestamp', 'Unknown')
            print(f"  [{timestamp}] CPU: {metrics.get('cpu', 0):.1f}%, "
                  f"Memory: {metrics.get('memory', 0):.1f}%, "
                  f"GPU: {metrics.get('gpu', 0):.1f}%")
    
    ws = client.subscribe_to_monitoring(tenant_id, monitoring_callback)
    
    # 10초간 실시간 데이터 수신
    time.sleep(10)
    ws.close()
    print("  실시간 모니터링 종료")


def example_manifest_generation():
    """매니페스트 생성 및 배포 예제"""
    print("\n=== 매니페스트 생성 및 배포 예제 ===")
    
    client = ECPOrchestratorClient(is_demo=True)
    
    # 데모 테넌트 조회
    tenants = client.get_tenants()
    if not tenants['tenants']:
        print("테넌트가 없습니다.")
        return
    
    tenant_id = tenants['tenants'][0]['tenant_id']
    print(f"매니페스트 생성 대상: {tenant_id}")
    
    # 1. 매니페스트 생성
    print("\n1. Kubernetes 매니페스트 생성:")
    try:
        manifest = client.get_manifest(
            tenant_id,
            format='yaml',
            include_monitoring=True,
            include_ingress=False
        )
        
        # 매니페스트 저장
        filename = f"{tenant_id}-manifest.yaml"
        client.download_manifest(tenant_id, filename)
        
        # 매니페스트 미리보기 (첫 20줄)
        lines = manifest.split('\n')
        print("  매니페스트 미리보기:")
        for i, line in enumerate(lines[:20]):
            print(f"    {line}")
        if len(lines) > 20:
            print(f"    ... (총 {len(lines)}줄 중 20줄 표시)")
            
    except Exception as e:
        print(f"  매니페스트 생성 실패: {e}")
        return
    
    # 2. 매니페스트 검증
    print("\n2. 매니페스트 검증:")
    try:
        validation = client.validate_manifest(tenant_id, manifest)
        
        print(f"  검증 결과: {'통과' if validation['valid'] else '실패'}")
        
        if validation.get('warnings'):
            print("  경고사항:")
            for warning in validation['warnings']:
                print(f"    - {warning}")
        
        if validation.get('errors'):
            print("  오류:")
            for error in validation['errors']:
                print(f"    - {error}")
        
        if validation.get('resource_summary'):
            summary = validation['resource_summary']
            print(f"  리소스 요약:")
            print(f"    - CPU: {summary.get('total_cpu')}")
            print(f"    - Memory: {summary.get('total_memory')}")
            print(f"    - GPU: {summary.get('total_gpu')}")
            print(f"    - 예상 비용: {summary.get('estimated_cost')}")
            
    except Exception as e:
        print(f"  매니페스트 검증 실패: {e}")
    
    # 3. 배포 상태 확인 (데모 모드에서는 가상)
    print("\n3. 배포 상태 확인:")
    try:
        status = client.get_deployment_status(tenant_id)
        print(f"  상태: {status.get('status')}")
        print(f"  진행률: {status.get('progress', 0)}%")
        
        if status.get('created_resources'):
            print("  생성된 리소스:")
            for resource in status['created_resources'][:3]:  # 처음 3개만 표시
                print(f"    - {resource['type']}: {resource['name']} ({resource['status']})")
                
    except Exception as e:
        print(f"  배포 상태 확인 실패: {e}")


def example_full_workflow():
    """전체 워크플로우 예제"""
    print("\n=== 전체 워크플로우 예제 ===")
    
    # 1. AI 서비스 생성
    tenant_id, deployment_id = example_create_ai_service()
    
    if not tenant_id:
        print("테넌트 생성 실패로 워크플로우 중단")
        return
    
    # 2. 배포 모니터링
    if deployment_id:
        print(f"\n배포 진행 상황 모니터링: {deployment_id}")
        
        def deployment_callback(data):
            print(f"배포 진행률: {data.get('progress', 0)}% - {data.get('message', '')}")
            
            if data.get('status') == 'completed':
                print("배포 완료!")
            elif data.get('status') == 'failed':
                print(f"배포 실패: {data.get('error', '')}")
        
        # 배포 상태 실시간 모니터링 (실제 환경에서만 동작)
        try:
            ws = client.subscribe_to_deployment(deployment_id, deployment_callback)
            time.sleep(5)  # 5초간 모니터링
            ws.close()
        except Exception as e:
            print(f"배포 모니터링 연결 실패: {e}")
    
    # 3. 매니페스트 다운로드
    print(f"\n매니페스트 다운로드: {tenant_id}")
    try:
        manifest_file = f"{tenant_id}-production.yaml"
        client.download_manifest(tenant_id, manifest_file)
        print(f"매니페스트 저장됨: {manifest_file}")
    except Exception as e:
        print(f"매니페스트 다운로드 실패: {e}")
    
    # 4. 모니터링 설정
    print(f"\n모니터링 설정 완료: {tenant_id}")
    print("이제 다음 작업을 수행할 수 있습니다:")
    print("- kubectl apply -f {manifest_file}로 실제 배포")
    print("- 실시간 모니터링 대시보드 연결")
    print("- 알림 규칙 설정")


if __name__ == "__main__":
    print("ECP-AI Kubernetes Orchestrator Python 클라이언트 예제")
    print("=" * 60)
    
    try:
        # 예제 실행
        example_basic_usage()
        example_monitoring_integration()
        example_manifest_generation()
        
        # 전체 워크플로우는 실사용 모드에서만 실행
        print("\n전체 워크플로우 예제를 실행하시겠습니까? (실사용 모드)")
        response = input("y/N: ").strip().lower()
        if response == 'y':
            example_full_workflow()
        
    except KeyboardInterrupt:
        print("\n\n프로그램이 중단되었습니다.")
    except Exception as e:
        print(f"\n오류 발생: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n예제 실행 완료!")
