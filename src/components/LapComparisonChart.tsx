import React, { useMemo, memo, useState, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';
import { Box, Typography, Chip, IconButton, Stack, Button } from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { LapData } from '../services/api';
import { EnrichedF1SessionResult } from '../types';
import { processLapDataForChart } from '../utils/chartDataProcessing';
import { formatLapDuration } from '../utils/formatting';
import { getDriverColor } from '../constants/chartColors';

interface LapComparisonChartProps {
    lapData: LapData[];
    selectedDrivers: number[];
    sessionResults: EnrichedF1SessionResult[];
}

interface DriverInfo {
    driverNumber: number;
    name: string;
    color: string;
}

// Custom tooltip component to show pit out lap info
const CustomTooltip = ({ active, payload, label, driverInfo }: any) => {
    if (active && payload && payload.length) {
        return (
            <Box
                sx={{
                    backgroundColor: '#1A1A1A',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    padding: '12px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
                }}
            >
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: '#FFFFFF' }}>
                    {label}
                </Typography>
                {payload.map((entry: any, index: number) => {
                    const driverNum = parseInt(entry.dataKey.replace('driver_', '').replace('_pit_out', ''));
                    const driverInfo_entry = driverInfo.find((d: DriverInfo) => d.driverNumber === driverNum);
                    const driverName = driverInfo_entry?.name || `Driver ${driverNum}`;
                    const value = entry.value;
                    const isPitOutLap = entry.payload[`driver_${driverNum}_pit_out`] || false;
                    
                    if (value === null || value === undefined) {
                        return (
                            <Typography key={`${entry.dataKey}-na-${label}`} variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 0.5 }}>
                                {driverName}: N/A
                            </Typography>
                        );
                    }
                    
                    return (
                        <Box key={`${entry.dataKey}-${label}`} sx={{ mb: 0.5 }}>
                            <Box
                                sx={{ 
                                    color: entry.color,
                                    fontWeight: 500,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    fontSize: '0.875rem',
                                }}
                            >
                                <Typography 
                                    component="span"
                                    variant="body2" 
                                    sx={{ 
                                        color: entry.color,
                                        fontWeight: 500,
                                    }}
                                >
                                    {driverName}: {formatLapDuration(value)}
                                </Typography>
                                {isPitOutLap && (
                                    <Chip 
                                        label="Pit Out" 
                                        size="small"
                                        sx={{
                                            height: 18,
                                            fontSize: '0.65rem',
                                            backgroundColor: 'rgba(255, 193, 7, 0.2)',
                                            color: '#FFC107',
                                            border: '1px solid rgba(255, 193, 7, 0.4)',
                                        }}
                                    />
                                )}
                            </Box>
                        </Box>
                    );
                })}
            </Box>
        );
    }
    return null;
};

// Custom dot renderer for pit out laps
const renderPitOutDot = (driverNumber: number, driverColor: string) => (props: any) => {
    const { cx, cy, payload } = props;
    const isPitOutLap = payload?.[`driver_${driverNumber}_pit_out`] || false;
    
    if (!cx || !cy) {
        return <g></g>;
    }
    
    return (
        <g>
            <circle
                cx={cx}
                cy={cy}
                r={isPitOutLap ? 5 : 3}
                fill={driverColor}
                stroke={isPitOutLap ? '#FFC107' : driverColor}
                strokeWidth={isPitOutLap ? 2 : 1}
            />
            {isPitOutLap && (
                <circle
                    cx={cx}
                    cy={cy}
                    r={7}
                    fill="none"
                    stroke="#FFC107"
                    strokeWidth={1}
                    opacity={0.5}
                />
            )}
        </g>
    );
};

const LapComparisonChart: React.FC<LapComparisonChartProps> = ({
    lapData,
    selectedDrivers,
    sessionResults,
}) => {
    // Zoom state
    const [xAxisRange, setXAxisRange] = useState<[number, number] | undefined>(undefined);
    const [yAxisDomain, setYAxisDomain] = useState<[number, number] | undefined>(undefined);

    // Process data for chart
    const { data: chartData } = useMemo(() => {
        return processLapDataForChart(lapData, selectedDrivers, sessionResults);
    }, [lapData, selectedDrivers, sessionResults]);

    // Get driver info for legend
    const driverInfo = useMemo(() => {
        return selectedDrivers.map((driverNum, index) => {
            const result = sessionResults.find(r => r.driver_number === driverNum);
            return {
                driverNumber: driverNum,
                name: result?.full_name || `Driver ${driverNum}`,
                color: getDriverColor(driverNum, index),
            };
        });
    }, [selectedDrivers, sessionResults]);

    // Calculate auto Y-axis domain from currently visible data (Brush-controlled)
    const autoYAxisRange = useMemo(() => {
        if (!chartData || chartData.length === 0) return [0, 100];

        const startIndex = xAxisRange ? Math.max(0, xAxisRange[0]) : 0;
        const endIndex = xAxisRange ? Math.min(chartData.length - 1, xAxisRange[1]) : chartData.length - 1;

        const visibleValues: number[] = [];
        for (let i = startIndex; i <= endIndex; i++) {
            const point = chartData[i];
            selectedDrivers.forEach((driverNum) => {
                const value = point[`driver_${driverNum}`];
                if (value !== null && value !== undefined && typeof value === 'number') {
                    visibleValues.push(value as number);
                }
            });
        }

        if (visibleValues.length === 0) return [0, 100];

        const min = Math.min(...visibleValues);
        const max = Math.max(...visibleValues);
        const range = max - min || 1; // avoid zero range
        const padding = Math.max(range * 0.1, 0.05); // 10% padding, minimum small padding

        return [Math.max(0, min - padding), max + padding] as [number, number];
    }, [chartData, selectedDrivers, xAxisRange]);

    // Reset zoom
    const handleResetZoom = useCallback(() => {
        setXAxisRange(undefined);
        setYAxisDomain(undefined);
    }, []);

    // Handle brush change for X-axis zoom
    const handleBrushChange = useCallback((domain: { startIndex?: number; endIndex?: number } | null) => {
        if (domain && domain.startIndex !== undefined && domain.endIndex !== undefined) {
            setXAxisRange([domain.startIndex, domain.endIndex]);
        } else {
            setXAxisRange(undefined);
        }
    }, []);


    // Zoom in/out functions
    const handleZoomIn = useCallback(() => {
        if (yAxisDomain) {
            const [min, max] = yAxisDomain;
            const range = max - min;
            const center = (min + max) / 2;
            const newRange = range * 0.7; // Zoom in by 30%
            setYAxisDomain([center - newRange / 2, center + newRange / 2]);
        } else {
            const [min, max] = autoYAxisRange;
            const range = max - min;
            const center = (min + max) / 2;
            const newRange = range * 0.7;
            setYAxisDomain([center - newRange / 2, center + newRange / 2]);
        }
    }, [yAxisDomain, autoYAxisRange]);

    const handleZoomOut = useCallback(() => {
        if (yAxisDomain) {
            const [min, max] = yAxisDomain;
            const range = max - min;
            const center = (min + max) / 2;
            const newRange = range * 1.4; // Zoom out by 40%
            setYAxisDomain([center - newRange / 2, center + newRange / 2]);
        } else {
            const [min, max] = autoYAxisRange;
            const range = max - min;
            const center = (min + max) / 2;
            const newRange = range * 1.4;
            setYAxisDomain([center - newRange / 2, center + newRange / 2]);
        }
    }, [yAxisDomain, autoYAxisRange]);

    // Use full data; Brush controls viewport
    const displayedChartData = chartData;

    return (
        <Box sx={{ width: '100%' }}>
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

            <Box sx={{ width: '100%', height: 500 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={displayedChartData}
                        margin={{ top: 5, right: 30, left: 80, bottom: 60 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                        <XAxis
                            dataKey="lap"
                            stroke="rgba(255, 255, 255, 0.7)"
                            style={{ fontSize: '12px' }}
                        />
                        <YAxis
                            stroke="rgba(255, 255, 255, 0.7)"
                            style={{ fontSize: '12px' }}
                            width={70}
                            domain={yAxisDomain || autoYAxisRange}
                            label={{
                                value: 'Lap Duration (min:sec)',
                                angle: -90,
                                position: 'left',
                                offset: -10,
                                style: { fill: 'rgba(255, 255, 255, 0.7)', fontSize: '12px', textAnchor: 'middle' },
                            }}
                            tickFormatter={(value: number) => {
                                return formatLapDuration(value);
                            }}
                            allowDataOverflow
                        />
                        <Tooltip content={(props: any) => <CustomTooltip {...props} driverInfo={driverInfo} />} />
                        <Legend
                            wrapperStyle={{ paddingTop: '20px' }}
                            formatter={(value: string) => {
                                const driverNum = parseInt(value.replace('driver_', ''));
                                const info = driverInfo.find(d => d.driverNumber === driverNum);
                                return info ? `#${info.driverNumber} ${info.name}` : value;
                            }}
                        />
                        {driverInfo.map((driver) => (
                            <Line
                                key={`line-${driver.driverNumber}`}
                                type="monotone"
                                dataKey={`driver_${driver.driverNumber}`}
                                stroke={driver.color}
                                strokeWidth={2}
                                dot={renderPitOutDot(driver.driverNumber, driver.color)}
                                activeDot={{ r: 6 }}
                                name={`driver_${driver.driverNumber}`}
                                connectNulls={false}
                            />
                        ))}
                        <Brush
                            dataKey="lap"
                            height={30}
                            stroke="rgba(255, 255, 255, 0.3)"
                            fill="rgba(255, 255, 255, 0.1)"
                            onChange={handleBrushChange}
                            startIndex={xAxisRange ? xAxisRange[0] : 0}
                            endIndex={xAxisRange ? xAxisRange[1] : chartData.length - 1}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </Box>
            
            {/* Instructions */}
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
                💡 Tip: Use the brush below the chart to zoom on lap numbers (X-axis), or use the zoom buttons to adjust the time window (Y-axis)
            </Typography>
        </Box>
    );
};

// Memoize the chart component to prevent unnecessary re-renders
export default memo(LapComparisonChart);

