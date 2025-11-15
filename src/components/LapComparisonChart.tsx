import React, { useMemo, memo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Box, Typography, Chip } from '@mui/material';
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
                            <Typography key={index} variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 0.5 }}>
                                {driverName}: N/A
                            </Typography>
                        );
                    }
                    
                    return (
                        <Box key={index} sx={{ mb: 0.5 }}>
                            <Typography 
                                variant="body2" 
                                sx={{ 
                                    color: entry.color,
                                    fontWeight: 500,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1
                                }}
                            >
                                {driverName}: {formatLapDuration(value)}
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
                            </Typography>
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

    return (
        <Box sx={{ width: '100%', height: 500 }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={chartData}
                    margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
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
                    />
                    <Tooltip content={<CustomTooltip driverInfo={driverInfo} />} />
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
                            key={driver.driverNumber}
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
                </LineChart>
            </ResponsiveContainer>
        </Box>
    );
};

// Memoize the chart component to prevent unnecessary re-renders
export default memo(LapComparisonChart);

