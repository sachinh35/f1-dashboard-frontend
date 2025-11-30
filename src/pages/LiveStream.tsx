import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, Card, CardContent, CircularProgress, Alert, Chip, Button, Stack, IconButton } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea } from 'recharts';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import axios from 'axios';

// Define types for our data
interface LiveLapTime {
    driver_number: number;
    lap_number: number;
    lap_time: number;
    sector_1?: number;
    sector_2?: number;
    sector_3?: number;
}

interface ChartDataPoint {
    lap: number;
    [key: string]: number | string; // driver_number: lap_time
}

const LiveStream = () => {
    const { streamId } = useParams<{ streamId: string }>();
    const [lapTimes, setLapTimes] = useState<LiveLapTime[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [connected, setConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);

    // Driver selection state
    const [selectedDrivers, setSelectedDrivers] = useState<number[]>([]);

    const handleDriverToggle = (driverNum: number) => {
        setSelectedDrivers(prev => {
            if (prev.includes(driverNum)) {
                return prev.filter(d => d !== driverNum);
            } else {
                return [...prev, driverNum];
            }
        });
    };


    // Fetch initial data
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const response = await axios.get(`http://localhost:8000/live-timing/${streamId}`);
                if (response.data && response.data.lap_times) {
                    setLapTimes(response.data.lap_times);
                }
                setLoading(false);
            } catch (err) {
                console.error("Failed to fetch initial data", err);
                setError("Failed to load historical data");
                setLoading(false);
            }
        };

        if (streamId) {
            fetchInitialData();
        }
    }, [streamId]);

    // Connect to WebSocket
    useEffect(() => {
        if (!streamId) return;

        const wsUrl = `ws://localhost:8000/ws/live-timing/${streamId}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("Connected to WebSocket");
            setConnected(true);
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === "TimingData") {
                    // We need to parse the payload here similar to backend or trust backend to send parsed events
                    // The backend broadcasts the raw payload AND saves parsed data to DB.
                    // But for real-time chart, we need to parse the raw payload here too, 
                    // OR backend should broadcast the PARSED data.
                    // In my backend implementation, I broadcasted the raw payload AND parsed it for DB.
                    // But I also broadcasted "TimingData" with raw payload.
                    // Let's try to parse it here or update backend to broadcast parsed event.
                    // Parsing raw F1 data on frontend is complex.
                    // Let's update backend to broadcast a "LapCompleted" event which is easier to consume.
                    // BUT, for now, let's assume we receive the raw payload and try to extract what we can,
                    // or rely on the backend to send a specific event if I updated it.
                    // Looking at backend code: 
                    // await manager.broadcast({"type": "TimingData", "payload": payload}, self.stream_id)
                    // So we get raw payload.

                    // Actually, for the chart to update in real-time, we need the lap time.
                    // Let's try to extract it if possible, or just re-fetch from API periodically?
                    // No, that defeats the purpose of WS.

                    // Let's do a simple extraction here similar to backend.
                    let payload = message.payload;
                    if (typeof payload === 'string') {
                        try {
                            payload = JSON.parse(payload);
                        } catch (e) {
                            console.error("Failed to parse payload string", e);
                            return;
                        }
                    }

                    if (payload.Lines) {
                        Object.entries(payload.Lines).forEach(([carId, carData]: [string, any]) => {
                            if (carData.LastLapTime && carData.LastLapTime.Value) {
                                const val = carData.LastLapTime.Value;
                                let seconds = 0;
                                try {
                                    const parts = val.split(':');
                                    if (parts.length === 2) {
                                        seconds = parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
                                    } else {
                                        seconds = parseFloat(parts[0]);
                                    }
                                } catch (e) { return; }

                                const lapNum = carData.NumberOfLaps;
                                if (lapNum) {
                                    setLapTimes(prev => {
                                        // Check if exists
                                        const exists = prev.some(l => l.driver_number === parseInt(carId) && l.lap_number === lapNum);
                                        if (exists) return prev;

                                        console.log(`Adding lap time: Driver ${carId}, Lap ${lapNum}, Time ${seconds}`);
                                        return [...prev, {
                                            driver_number: parseInt(carId),
                                            lap_number: lapNum,
                                            lap_time: seconds
                                        }];
                                    });
                                } else {
                                    console.log(`Received lap time for driver ${carId} but no lap number`, carData);
                                }
                            }
                        });
                    }
                }
            } catch (e) {
                console.error("Error parsing WS message", e);
            }
        };

        ws.onclose = () => {
            console.log("Disconnected from WebSocket");
            setConnected(false);
        };

        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, [streamId]);

    // Zoom state
    const [xAxisRange, setXAxisRange] = useState<[number, number] | undefined>(undefined);
    const [yAxisDomain, setYAxisDomain] = useState<[number, number] | undefined>(undefined);
    // Drag-to-zoom selection state
    const [selectionStartIndex, setSelectionStartIndex] = useState<number | null>(null);
    const [selectionEndIndex, setSelectionEndIndex] = useState<number | null>(null);
    const [isSelecting, setIsSelecting] = useState<boolean>(false);

    // Process data for chart
    const processChartData = () => {
        const dataMap = new Map<number, ChartDataPoint>();
        const drivers = new Set<number>();

        lapTimes.forEach(lap => {
            drivers.add(lap.driver_number);
            if (!dataMap.has(lap.lap_number)) {
                dataMap.set(lap.lap_number, { lap: lap.lap_number });
            }
            const point = dataMap.get(lap.lap_number)!;
            point[lap.driver_number] = lap.lap_time;
        });

        return {
            data: Array.from(dataMap.values()).sort((a, b) => a.lap - b.lap),
            drivers: Array.from(drivers).sort((a, b) => a - b)
        };
    };

    const { data: fullData, drivers } = processChartData();

    const handleSelectAll = () => {
        if (selectedDrivers.length === drivers.length) {
            setSelectedDrivers([]);
        } else {
            setSelectedDrivers(drivers);
        }
    };

    // Slice data when a range is selected
    const data = xAxisRange ? fullData.slice(Math.max(0, xAxisRange[0]), Math.min(fullData.length, xAxisRange[1] + 1)) : fullData;

    // Calculate auto Y-axis domain from currently visible data
    const autoYAxisRange = (() => {
        if (!data || data.length === 0) return ['auto', 'auto'];

        const visibleValues: number[] = [];
        data.forEach(point => {
            selectedDrivers.forEach((driverNum) => {
                const value = point[driverNum];
                if (value !== null && value !== undefined && typeof value === 'number') {
                    visibleValues.push(value as number);
                }
            });
        });

        if (visibleValues.length === 0) return ['auto', 'auto'];

        const min = Math.min(...visibleValues);
        const max = Math.max(...visibleValues);
        const range = max - min || 1;
        const padding = Math.max(range * 0.1, 0.05);

        return [Math.max(0, min - padding), max + padding] as [number, number];
    })();

    // Reset zoom
    const handleResetZoom = () => {
        setXAxisRange(undefined);
        setYAxisDomain(undefined);
        setSelectionStartIndex(null);
        setSelectionEndIndex(null);
        setIsSelecting(false);
    };

    // Mouse drag-to-zoom handlers
    const handleMouseDown = (e: any) => {
        if (e && e.activeTooltipIndex != null) {
            setIsSelecting(true);
            setSelectionStartIndex(e.activeTooltipIndex);
            setSelectionEndIndex(e.activeTooltipIndex);
        }
    };

    const handleMouseMove = (e: any) => {
        if (!isSelecting) return;
        if (e && e.activeTooltipIndex != null) {
            setSelectionEndIndex(e.activeTooltipIndex);
        }
    };

    const handleMouseUp = () => {
        if (isSelecting && selectionStartIndex != null && selectionEndIndex != null) {
            const start = Math.min(selectionStartIndex, selectionEndIndex);
            const end = Math.max(selectionStartIndex, selectionEndIndex);
            if (end > start) {
                // Adjust for current view offset if already zoomed
                const currentStart = xAxisRange ? xAxisRange[0] : 0;
                setXAxisRange([currentStart + start, currentStart + end]);
            }
        }
        setIsSelecting(false);
        setSelectionStartIndex(null);
        setSelectionEndIndex(null);
    };

    const handleMouseLeave = () => {
        if (isSelecting) {
            handleMouseUp();
        }
    };

    // Zoom in/out functions
    const handleZoomIn = () => {
        // Simple Y-axis zoom for now, or X-axis? 
        // Let's do Y-axis zoom as in LapComparisonChart
        // But wait, LapComparisonChart zooms Y-axis.
        // The user request says "zoom into the chart", usually implies X-axis for time series.
        // But LapComparisonChart implementation shows Y-axis zoom logic.
        // "similar to how I'm able to do it when I'm not using the live functionality"
        // The LapComparisonChart has Y-axis zoom buttons AND X-axis drag-to-zoom.
        // I will implement both.

        const currentDomain = yAxisDomain || (autoYAxisRange[0] === 'auto' ? [0, 100] : autoYAxisRange) as [number, number];
        const [min, max] = currentDomain;
        const range = max - min;
        const center = (min + max) / 2;
        const newRange = range * 0.7;
        setYAxisDomain([center - newRange / 2, center + newRange / 2]);
    };

    const handleZoomOut = () => {
        const currentDomain = yAxisDomain || (autoYAxisRange[0] === 'auto' ? [0, 100] : autoYAxisRange) as [number, number];
        const [min, max] = currentDomain;
        const range = max - min;
        const center = (min + max) / 2;
        const newRange = range * 1.4;
        setYAxisDomain([center - newRange / 2, center + newRange / 2]);
    };




    // Format time helper
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    };

    const colors = ['#FF1801', '#0090D0', '#00D2BE', '#FF8700', '#C92D4B', '#20394C', '#F596C8', '#B6BABD', '#5E8FAA', '#C8C8C8'];
    const isSimulation = streamId?.startsWith('simulation_');

    return (
        <Box sx={{ p: 3, minHeight: '100vh', background: '#0A0A0A', color: 'white' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: '-0.5px' }}>
                    Live Race Telemetry
                    {isSimulation && <Chip label="SIMULATION" color="warning" size="small" sx={{ ml: 2, fontWeight: 700 }} />}
                </Typography>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {!connected && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    Connecting to live stream...
                </Alert>
            )}

            {/* Debug Info - Only in Simulation Mode */}
            {isSimulation && (
                <Card sx={{ bgcolor: '#1F1F1F', color: 'white', mb: 2, border: '1px solid #333' }}>
                    <CardContent>
                        <Typography variant="h6" sx={{ fontSize: '1rem', mb: 1, color: '#888' }}>Debug Info</Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>Connected: {connected ? 'Yes' : 'No'}</Typography>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>Lap Times: {lapTimes.length}</Typography>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>Drivers: {drivers.length}</Typography>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>Last Data: {data.length > 0 ? 'Received' : 'Waiting'}</Typography>
                        </Box>
                    </CardContent>
                </Card>
            )}

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <Box sx={{ display: 'flex', gap: 3 }}>
                    {/* Main Chart Area */}
                    <Box sx={{ flex: 1 }}>
                        <Card sx={{ bgcolor: '#1F1F1F', color: 'white', border: '1px solid #333', borderRadius: 2 }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                                    Lap Times History
                                </Typography>

                                {/* Zoom Controls */}
                                <Stack
                                    direction="row"
                                    spacing={1}
                                    alignItems="center"
                                    sx={{ mb: 2, justifyContent: 'flex-end' }}
                                >
                                    <Typography variant="body2" sx={{ color: 'text.secondary', mr: 1 }}>
                                        Zoom:
                                    </Typography>
                                    <IconButton
                                        size="small"
                                        onClick={handleZoomIn}
                                        sx={{
                                            color: 'text.secondary',
                                            '&:hover': { color: 'primary.main' },
                                        }}
                                        title="Zoom In (Y-axis)"
                                    >
                                        <ZoomInIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton
                                        size="small"
                                        onClick={handleZoomOut}
                                        sx={{
                                            color: 'text.secondary',
                                            '&:hover': { color: 'primary.main' },
                                        }}
                                        title="Zoom Out (Y-axis)"
                                    >
                                        <ZoomOutIcon fontSize="small" />
                                    </IconButton>
                                    <Button
                                        size="small"
                                        startIcon={<RestartAltIcon />}
                                        onClick={handleResetZoom}
                                        sx={{
                                            color: 'text.secondary',
                                            '&:hover': { color: 'primary.main' },
                                            textTransform: 'none',
                                        }}
                                    >
                                        Reset
                                    </Button>
                                </Stack>

                                <Box sx={{ height: 600, width: '100%' }}>
                                    <ResponsiveContainer>
                                        <LineChart
                                            data={data}
                                            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                                            onMouseDown={handleMouseDown}
                                            onMouseMove={handleMouseMove}
                                            onMouseUp={handleMouseUp}
                                            onMouseLeave={handleMouseLeave}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                            <XAxis
                                                dataKey="lap"
                                                stroke="#888"
                                                type="number"
                                                domain={['dataMin', 'dataMax']}
                                                allowDecimals={false}
                                                label={{ value: 'Lap Number', position: 'insideBottom', offset: -10, fill: '#888' }}
                                            />
                                            <YAxis
                                                stroke="#888"
                                                domain={yAxisDomain || autoYAxisRange}
                                                tickFormatter={formatTime}
                                                width={80}
                                            />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: 'rgba(26, 26, 26, 0.95)', border: '1px solid #444', borderRadius: '8px' }}
                                                itemStyle={{ color: '#fff' }}
                                                labelStyle={{ color: '#888', marginBottom: '0.5rem' }}
                                                formatter={(value: number) => [formatTime(value), 'Lap Time']}
                                            />
                                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                            {drivers.filter(d => selectedDrivers.includes(d)).map((driver, index) => (
                                                <Line
                                                    key={driver}
                                                    type="monotone"
                                                    dataKey={driver}
                                                    name={`Driver ${driver}`}
                                                    stroke={colors[index % colors.length]}
                                                    strokeWidth={2}
                                                    dot={{ r: 3, strokeWidth: 0 }}
                                                    activeDot={{ r: 6 }}
                                                    connectNulls
                                                    isAnimationActive={false}
                                                />
                                            ))}
                                            {isSelecting && selectionStartIndex != null && selectionEndIndex != null && (() => {
                                                const start = Math.min(selectionStartIndex, selectionEndIndex);
                                                const end = Math.max(selectionStartIndex, selectionEndIndex);
                                                const x1 = (data[start]?.lap ?? '') as string | number;
                                                const x2 = (data[end]?.lap ?? '') as string | number;
                                                return (
                                                    <ReferenceArea
                                                        x1={x1}
                                                        x2={x2}
                                                        y1={autoYAxisRange[0]}
                                                        y2={autoYAxisRange[1]}
                                                        stroke="rgba(225, 6, 0, 0.6)"
                                                        strokeOpacity={0.3}
                                                        fill="rgba(225, 6, 0, 0.15)"
                                                    />
                                                );
                                            })()}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </Box>
                            </CardContent>
                        </Card>
                    </Box>

                    {/* Driver Selection Sidebar */}
                    <Card sx={{ width: 280, bgcolor: '#1F1F1F', color: 'white', border: '1px solid #333', borderRadius: 2, height: 'fit-content' }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>Drivers</Typography>
                                <Button size="small" onClick={handleSelectAll} sx={{ color: '#888', textTransform: 'none' }}>
                                    {selectedDrivers.length === drivers.length ? 'None' : 'All'}
                                </Button>
                            </Box>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: '600px', overflowY: 'auto' }}>
                                {drivers.map((driver, index) => (
                                    <Box
                                        key={driver}
                                        onClick={() => handleDriverToggle(driver)}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            cursor: 'pointer',
                                            p: 1,
                                            borderRadius: 1,
                                            bgcolor: selectedDrivers.includes(driver) ? 'rgba(255,255,255,0.05)' : 'transparent',
                                            '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                width: 12,
                                                height: 12,
                                                borderRadius: '50%',
                                                bgcolor: selectedDrivers.includes(driver) ? colors[index % colors.length] : '#444',
                                                mr: 1.5,
                                                transition: 'background-color 0.2s'
                                            }}
                                        />
                                        <Typography variant="body2" sx={{ color: selectedDrivers.includes(driver) ? 'white' : '#888' }}>
                                            Driver {driver}
                                        </Typography>
                                    </Box>
                                ))}
                            </Box>
                        </CardContent>
                    </Card>
                </Box>
            )}
        </Box>
    );
};

export default LiveStream;
