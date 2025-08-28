// [advice from AI] K8S 매니페스트 파일 업로드 및 배포 컴포넌트
import React, { useState } from 'react';
import {
  Paper,
  Typography,
  Box,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Divider
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  ExpandMore as ExpandMoreIcon,
  PlayArrow as PlayArrowIcon,
  Code as CodeIcon
} from '@mui/icons-material';
import { useApi } from '../hooks/useApi';

const K8sManifestUploader = () => {
  const [manifestContent, setManifestContent] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [deploymentResult, setDeploymentResult] = useState(null);
  const [parseResult, setParseResult] = useState(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState(null);

  const { post } = useApi();

  const sampleManifest = `# Sample K8S Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  namespace: default
  labels:
    app: nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.14.2
        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: nginx-service
  namespace: default
spec:
  selector:
    app: nginx
  ports:
    - protocol: TCP
      port: 80
      targetPort: 80
  type: LoadBalancer`;

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setManifestContent(e.target.result);
      };
      reader.readAsText(file);
    }
  };

  const handleParseManifest = async () => {
    if (!manifestContent.trim()) {
      setError('매니페스트 내용을 입력하거나 파일을 선택해주세요.');
      return;
    }

    try {
      setError(null);
      const result = await post('/k8s/manifest/parse', {
        manifest: manifestContent
      });
      
      setParseResult(result);
    } catch (err) {
      setError(`매니페스트 파싱 실패: ${err.message}`);
      setParseResult(null);
    }
  };

  const handleDeploy = async () => {
    if (!manifestContent.trim()) {
      setError('매니페스트 내용을 입력하거나 파일을 선택해주세요.');
      return;
    }

    try {
      setIsDeploying(true);
      setError(null);
      
      const result = await post('/k8s/manifest/deploy', {
        manifest: manifestContent
      });
      
      setDeploymentResult(result);
    } catch (err) {
      setError(`배포 실패: ${err.message}`);
      setDeploymentResult(null);
    } finally {
      setIsDeploying(false);
    }
  };

  const loadSampleManifest = () => {
    setManifestContent(sampleManifest);
    setSelectedFile(null);
    setParseResult(null);
    setDeploymentResult(null);
    setError(null);
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        K8S 매니페스트 업로드 및 배포
      </Typography>

      {/* 파일 업로드 섹션 */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          매니페스트 입력
        </Typography>

        <Box sx={{ mb: 2 }}>
          <input
            accept=".yaml,.yml"
            style={{ display: 'none' }}
            id="manifest-file-upload"
            type="file"
            onChange={handleFileSelect}
          />
          <label htmlFor="manifest-file-upload">
            <Button
              variant="outlined"
              component="span"
              startIcon={<CloudUploadIcon />}
              sx={{ mr: 2 }}
            >
              YAML 파일 선택
            </Button>
          </label>
          
          <Button
            variant="outlined"
            startIcon={<CodeIcon />}
            onClick={loadSampleManifest}
          >
            샘플 매니페스트 로드
          </Button>

          {selectedFile && (
            <Chip 
              label={`선택된 파일: ${selectedFile.name}`} 
              color="primary" 
              sx={{ ml: 2 }}
            />
          )}
        </Box>

        <TextField
          multiline
          rows={15}
          fullWidth
          value={manifestContent}
          onChange={(e) => setManifestContent(e.target.value)}
          placeholder="YAML 매니페스트를 여기에 붙여넣거나 위에서 파일을 선택하세요..."
          variant="outlined"
          sx={{ mb: 2 }}
        />

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={handleParseManifest}
            disabled={!manifestContent.trim()}
          >
            매니페스트 파싱
          </Button>
          
          <Button
            variant="contained"
            startIcon={isDeploying ? <CircularProgress size={16} /> : <PlayArrowIcon />}
            onClick={handleDeploy}
            disabled={!manifestContent.trim() || isDeploying}
          >
            {isDeploying ? '배포 중...' : '배포 실행'}
          </Button>
        </Box>
      </Paper>

      {/* 에러 메시지 */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* 파싱 결과 */}
      {parseResult && (
        <Accordion sx={{ mb: 3 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">
              파싱 결과 ({parseResult.count}개 리소스)
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box>
              {parseResult.resources?.map((resource, index) => (
                <Box key={index} sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {resource.kind}: {resource.metadata?.name || 'unnamed'}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Namespace: {resource.metadata?.namespace || 'default'}
                  </Typography>
                  <Divider sx={{ my: 1 }} />
                </Box>
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>
      )}

      {/* 배포 결과 */}
      {deploymentResult && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            배포 결과
          </Typography>
          
          <Box sx={{ mb: 2 }}>
            <Chip
              label={`성공: ${deploymentResult.deployed_count || 0}`}
              color="success"
              sx={{ mr: 1 }}
            />
            <Chip
              label={`실패: ${deploymentResult.failed_count || 0}`}
              color="error"
            />
          </Box>

          <Alert severity="success" sx={{ mb: 2 }}>
            배포가 {deploymentResult.status === 'completed' ? '완료' : '진행 중'}되었습니다.
          </Alert>

          {/* 배포된 리소스 상세 정보 */}
          {deploymentResult.resources?.map((resource, index) => (
            <Accordion key={index}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography>
                    {resource.kind}: {resource.name}
                  </Typography>
                  <Chip
                    label={resource.status}
                    color={resource.status === 'Running' ? 'success' : resource.status === 'Pending' ? 'warning' : 'error'}
                    size="small"
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box>
                  <Typography variant="body2" paragraph>
                    <strong>ID:</strong> {resource.id}
                  </Typography>
                  <Typography variant="body2" paragraph>
                    <strong>Namespace:</strong> {resource.namespace}
                  </Typography>
                  <Typography variant="body2" paragraph>
                    <strong>생성 시간:</strong> {resource.created_at}
                  </Typography>
                  
                  {resource.kind === 'Pod' && (
                    <>
                      <Typography variant="body2" paragraph>
                        <strong>Phase:</strong> {resource.phase}
                      </Typography>
                      <Typography variant="body2" paragraph>
                        <strong>Node:</strong> {resource.node}
                      </Typography>
                      <Typography variant="body2" paragraph>
                        <strong>Containers:</strong> {resource.containers}
                      </Typography>
                    </>
                  )}
                  
                  {resource.kind === 'Service' && (
                    <>
                      <Typography variant="body2" paragraph>
                        <strong>Type:</strong> {resource.type}
                      </Typography>
                      <Typography variant="body2" paragraph>
                        <strong>Cluster IP:</strong> {resource.cluster_ip}
                      </Typography>
                    </>
                  )}
                  
                  {resource.kind === 'Deployment' && (
                    <>
                      <Typography variant="body2" paragraph>
                        <strong>Replicas:</strong> {resource.replicas}
                      </Typography>
                      <Typography variant="body2" paragraph>
                        <strong>Ready Replicas:</strong> {resource.ready_replicas}
                      </Typography>
                    </>
                  )}
                  
                  {resource.error && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                      {resource.error}
                    </Alert>
                  )}
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
        </Paper>
      )}
    </Box>
  );
};

export default K8sManifestUploader;
