import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Grid,
    Chip,
    LinearProgress,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    Tooltip,
    Badge
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    Computer as ComputerIcon,
    Memory as MemoryIcon,
    Storage as StorageIcon,
    Speed as SpeedIcon,
    Thermostat as ThermostatIcon,
    Power as PowerIcon,
    NetworkCheck as NetworkIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';

interface ServerMetrics {
    cpu_usage: number;
    memory_usage: number;
    gpu_usage: number;
    network_in: number;
    network_out: number;
    disk_usage: number;
    disk_io_read: number;
    disk_io_write: number;
    temperature: number;
    power_usage: number;
}

interface ServerSpecs {
    cpu_cores: number;
    memory_gb: number;
    gpu_count: number;
    storage_gb: number;
    storage_type?: string;
}

interface ServerData {
    server_id: string;
    server_type: string;
    server_category: string;
    gpu_type: string;
    specifications: ServerSpecs;
    current_metrics: ServerMetrics;
    status: string;
    uptime: number;
    trend_direction: string;
    purpose: string;
    last_update: string;
}

interface ServerMonitoringProps {
    tenantId: string;
    isDemoMode: boolean;
}

const ServerMonitoring: React.FC<ServerMonitoringProps> = ({ tenantId, isDemoMode }) => {
    const [serversData, setServersData] = useState<{
        ai_servers: ServerData[];
        processing_servers: ServerData[];
        common_servers: ServerData[];
    } | null>(null);
    const [loading, setLoading] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<string>('');

    // [advice from AI] 서버별 모니터링 데이터 조회
    const fetchServerData = async () => {
        if (!tenantId || !isDemoMode) return;

        setLoading(true);
        try {
            const response = await fetch(`http://localhost:8001/api/v1/demo/tenants/${tenantId}/servers/`);
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setServersData(data.servers);
                    setLastUpdate(data.last_update);
                }
            }
        } catch (error) {
            console.error('서버 모니터링 데이터 조회 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchServerData();
        
        // [advice from AI] 30초마다 실시간 업데이트
        const interval = setInterval(fetchServerData, 30000);
        return () => clearInterval(interval);
    }, [tenantId, isDemoMode]);

    // [advice from AI] 업타임을 사람이 읽기 쉬운 형태로 변환
    const formatUptime = (seconds: number): string => {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (days > 0) return `${days}일 ${hours}시간`;
        if (hours > 0) return `${hours}시간 ${minutes}분`;
        return `${minutes}분`;
    };

    // [advice from AI] 사용률에 따른 색상 결정
    const getUsageColor = (usage: number): 'success' | 'warning' | 'error' => {
        if (usage < 60) return 'success';
        if (usage < 85) return 'warning';
        return 'error';
    };

    // [advice from AI] 트렌드 방향에 따른 아이콘
    const getTrendIcon = (trend: string) => {
        switch (trend) {
            case 'increasing': return '📈';
            case 'decreasing': return '📉';
            default: return '➡️';
        }
    };

    // [advice from AI] 서버 상태에 따른 색상
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'running': return 'success';
            case 'warning': return 'warning';
            case 'error': return 'error';
            default: return 'default';
        }
    };

    // [advice from AI] 서버 카테고리별 렌더링
    const renderServerCategory = (title: string, servers: ServerData[], icon: React.ReactNode) => {
        if (!servers || servers.length === 0) return null;

        return (
            <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box display="flex" alignItems="center" gap={1}>
                        {icon}
                        <Typography variant="h6">
                            {title} ({servers.length}대)
                        </Typography>
                    </Box>
                </AccordionSummary>
                <AccordionDetails>
                    <Grid container spacing={2}>
                        {servers.map((server) => (
                            <Grid item xs={12} md={6} lg={4} key={server.server_id}>
                                <Card variant="outlined">
                                    <CardContent>
                                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                            <Typography variant="subtitle1" fontWeight="bold">
                                                {server.server_type}
                                            </Typography>
                                            <Chip 
                                                label={server.status} 
                                                color={getStatusColor(server.status)}
                                                size="small"
                                            />
                                        </Box>
                                        
                                        <Typography variant="body2" color="text.secondary" mb={2}>
                                            {server.purpose}
                                        </Typography>

                                        {/* [advice from AI] 서버 스펙 정보 */}
                                        <Box mb={2}>
                                            <Typography variant="caption" display="block">
                                                CPU: {server.specifications.cpu_cores}코어 | 
                                                RAM: {server.specifications.memory_gb}GB
                                                {server.specifications.gpu_count > 0 && 
                                                    ` | GPU: ${server.specifications.gpu_count}x ${server.gpu_type}`
                                                }
                                            </Typography>
                                            <Typography variant="caption" display="block">
                                                스토리지: {server.specifications.storage_gb}GB {server.specifications.storage_type || 'HDD'}
                                            </Typography>
                                        </Box>

                                        {/* [advice from AI] 실시간 메트릭 */}
                                        <Box space={1}>
                                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                                <Typography variant="caption">
                                                    CPU {server.current_metrics.cpu_usage.toFixed(1)}%
                                                </Typography>
                                                <Typography variant="caption">
                                                    {getTrendIcon(server.trend_direction)}
                                                </Typography>
                                            </Box>
                                            <LinearProgress 
                                                variant="determinate" 
                                                value={server.current_metrics.cpu_usage} 
                                                color={getUsageColor(server.current_metrics.cpu_usage)}
                                                sx={{ mb: 1 }}
                                            />

                                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                                <Typography variant="caption">
                                                    메모리 {server.current_metrics.memory_usage.toFixed(1)}%
                                                </Typography>
                                            </Box>
                                            <LinearProgress 
                                                variant="determinate" 
                                                value={server.current_metrics.memory_usage} 
                                                color={getUsageColor(server.current_metrics.memory_usage)}
                                                sx={{ mb: 1 }}
                                            />

                                            {server.current_metrics.gpu_usage > 0 && (
                                                <>
                                                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                                        <Typography variant="caption">
                                                            GPU {server.current_metrics.gpu_usage.toFixed(1)}%
                                                        </Typography>
                                                    </Box>
                                                    <LinearProgress 
                                                        variant="determinate" 
                                                        value={server.current_metrics.gpu_usage} 
                                                        color={getUsageColor(server.current_metrics.gpu_usage)}
                                                        sx={{ mb: 1 }}
                                                    />
                                                </>
                                            )}

                                            {/* [advice from AI] 추가 메트릭 요약 */}
                                            <Grid container spacing={1} mt={1}>
                                                <Grid item xs={6}>
                                                    <Typography variant="caption" display="block">
                                                        🌡️ {server.current_metrics.temperature.toFixed(1)}°C
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="caption" display="block">
                                                        ⚡ {server.current_metrics.power_usage.toFixed(0)}W
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="caption" display="block">
                                                        📶 ↓{server.current_metrics.network_in.toFixed(0)}MB/s
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="caption" display="block">
                                                        📶 ↑{server.current_metrics.network_out.toFixed(0)}MB/s
                                                    </Typography>
                                                </Grid>
                                            </Grid>

                                            <Box mt={1} pt={1} borderTop="1px solid #eee">
                                                <Typography variant="caption" color="text.secondary">
                                                    가동시간: {formatUptime(server.uptime)}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                </AccordionDetails>
            </Accordion>
        );
    };

    if (!isDemoMode) {
        return (
            <Box p={3} textAlign="center">
                <Typography variant="body1" color="text.secondary">
                    서버별 모니터링은 데모 모드에서만 사용할 수 있습니다.
                </Typography>
            </Box>
        );
    }

    if (!serversData) {
        return (
            <Box p={3} textAlign="center">
                <Typography variant="body1" color="text.secondary">
                    {loading ? '서버 모니터링 데이터를 불러오는 중...' : '테넌시를 선택하여 서버 모니터링 데이터를 확인하세요.'}
                </Typography>
            </Box>
        );
    }

    return (
        <Box p={3}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h5" fontWeight="bold">
                    🖥️ 서버 모니터링 대시보드
                </Typography>
                <Box display="flex" alignItems="center" gap={2}>
                    <Typography variant="caption" color="text.secondary">
                        마지막 업데이트: {lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : '-'}
                    </Typography>
                    <Tooltip title="새로고침">
                        <IconButton onClick={fetchServerData} disabled={loading}>
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            {/* [advice from AI] 서버 카테고리별 표시 */}
            {renderServerCategory('🤖 AI 처리 서버', serversData.ai_servers, <ComputerIcon color="primary" />)}
            {renderServerCategory('🎙️ 음성/텍스트 처리 서버', serversData.processing_servers, <SpeedIcon color="secondary" />)}
            {renderServerCategory('⚙️ 공통 서비스 서버', serversData.common_servers, <StorageIcon color="action" />)}
        </Box>
    );
};

export default ServerMonitoring;
