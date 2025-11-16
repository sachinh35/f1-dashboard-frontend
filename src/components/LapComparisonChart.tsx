import React, { useMemo, memo, useState, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea } from 'recharts';
import { Box, Typography, Chip, IconButton, Stack, Button } from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { LapData, Stint } from '../services/api';
import { EnrichedF1SessionResult } from '../types';
import { processLapDataForChart } from '../utils/chartDataProcessing';
import { formatLapDuration } from '../utils/formatting';
import { getDriverColor } from '../constants/chartColors';
import { getCompoundInitial, getCompoundBadgeStyle } from '../constants/compoundColors';

interface LapComparisonChartProps {
    lapData: LapData[];
    selectedDrivers: number[];
    sessionResults: EnrichedF1SessionResult[];
    stints: Stint[];
}

interface DriverInfo {
    driverNumber: number;
    name: string;
    color: string;
}

// Custom tooltip component to show pit out lap info and compound
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
                {payload.map((entry: any) => {
                    const driverNum = parseInt(entry.dataKey.replace('driver_', '').replace('_pit_out', ''));
                    const driverInfo_entry = driverInfo.find((d: DriverInfo) => d.driverNumber === driverNum);
                    const driverName = driverInfo_entry?.name || `Driver ${driverNum}`;
                    const value = entry.value;
                    const isPitOutLap = entry.payload[`driver_${driverNum}_pit_out`] || false;
                    const compound = entry.payload[`driver_${driverNum}_compound`] || null;
                    
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
                                {compound && (
                                    <Box
                                        sx={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 0.75,
                                        }}
                                    >
                                        <Box
                                            sx={() => {
                                                const { bg, fg, border } = getCompoundBadgeStyle(compound);
                                                return {
                                                    width: 18,
                                                    height: 18,
                                                    lineHeight: '18px',
                                                    borderRadius: '50%',
                                                    textAlign: 'center',
                                                    fontSize: '0.70rem',
                                                    fontWeight: 700,
                                                    backgroundColor: bg,
                                                    color: fg,
                                                    border: `2px solid ${border}`,
                                                    userSelect: 'none',
                                                };
                                            }}
                                        >
                                            {getCompoundInitial(compound)}
                                        </Box>
                                    </Box>
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

// Custom dot renderer. Reserve ring only for pit-out. No compound ring.
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
    stints,
}) => {
    // Zoom state
    const [xAxisRange, setXAxisRange] = useState<[number, number] | undefined>(undefined);
    const [yAxisDomain, setYAxisDomain] = useState<[number, number] | undefined>(undefined);
    // Drag-to-zoom selection state
    const [selectionStartIndex, setSelectionStartIndex] = useState<number | null>(null);
    const [selectionEndIndex, setSelectionEndIndex] = useState<number | null>(null);
    const [isSelecting, setIsSelecting] = useState<boolean>(false);

    // Process data for chart
    const { data: chartData } = useMemo(() => {
        return processLapDataForChart(lapData, selectedDrivers, sessionResults, stints);
    }, [lapData, selectedDrivers, sessionResults, stints]);

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
        setSelectionStartIndex(null);
        setSelectionEndIndex(null);
        setIsSelecting(false);
    }, []);

    // Mouse drag-to-zoom handlers
    const handleMouseDown = useCallback((e: any) => {
        if (e && e.activeTooltipIndex != null) {
            setIsSelecting(true);
            setSelectionStartIndex(e.activeTooltipIndex);
            setSelectionEndIndex(e.activeTooltipIndex);
        }
    }, []);

    const handleMouseMove = useCallback((e: any) => {
        if (!isSelecting) return;
        if (e && e.activeTooltipIndex != null) {
            setSelectionEndIndex(e.activeTooltipIndex);
        }
    }, [isSelecting]);

    const finalizeSelection = useCallback(() => {
        if (isSelecting && selectionStartIndex != null && selectionEndIndex != null) {
            const start = Math.min(selectionStartIndex, selectionEndIndex);
            const end = Math.max(selectionStartIndex, selectionEndIndex);
            if (end > start) {
                setXAxisRange([start, end]);
            }
        }
        setIsSelecting(false);
        setSelectionStartIndex(null);
        setSelectionEndIndex(null);
    }, [isSelecting, selectionStartIndex, selectionEndIndex]);

    const handleMouseUp = useCallback(() => {
        finalizeSelection();
    }, [finalizeSelection]);

    const handleMouseLeave = useCallback(() => {
        // Cancel selection if user leaves chart area
        if (isSelecting) {
            finalizeSelection();
        }
    }, [isSelecting, finalizeSelection]);


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

    // Slice data when a range is selected
    const displayedChartData = useMemo(() => {
        if (!chartData) return [];
        if (!xAxisRange) return chartData;
        const start = Math.max(0, xAxisRange[0]);
        const end = Math.min(chartData.length - 1, xAxisRange[1]);
        return chartData.slice(start, end + 1);
    }, [chartData, xAxisRange]);

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
                        margin={{ top: 5, right: 30, left: 130, bottom: 60 }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseLeave}
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
                            width={90}
                            domain={yAxisDomain || autoYAxisRange}
                            label={{
                                value: 'Lap Duration (min:sec)',
                                angle: -90,
                                position: 'left',
                                offset: -100,
                                style: { 
                                    fill: 'rgba(255, 255, 255, 0.9)', 
                                    fontSize: '12px', 
                                    fontStyle: 'italic',
                                    fontWeight: 700,
                                    textAnchor: 'middle',
                                },
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
                        {isSelecting && selectionStartIndex != null && selectionEndIndex != null && (() => {
                            const start = Math.min(selectionStartIndex, selectionEndIndex);
                            const end = Math.max(selectionStartIndex, selectionEndIndex);
                            const x1 = (chartData[start]?.lap ?? '') as string | number;
                            const x2 = (chartData[end]?.lap ?? '') as string | number;
                            return (
                            <ReferenceArea
                                // Use labels from the full chartData for selection band
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
            
            {/* Instructions */}
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
                💡 Tip: Click and drag on the chart to select a lap window (X-axis). Use the buttons above to adjust the time window (Y-axis).
            </Typography>
        </Box>
    );
};

// Memoize the chart component to prevent unnecessary re-renders
export default memo(LapComparisonChart);

