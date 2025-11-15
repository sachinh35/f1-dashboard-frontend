import { useState, useEffect, useMemo } from 'react';
import { getYears, getRacesForYear, getSessionResults, getSessionLapData, LapData } from '../services/api';
import {
    Box,
    Grid,
    Typography,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Table,
    TableContainer,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
    SelectChangeEvent,
    FormGroup,
    FormControlLabel,
    Checkbox,
    Menu,
    IconButton,
    Card,
    CardContent,
    Stack,
    Chip,
    Divider,
    CircularProgress
} from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import TuneIcon from '@mui/icons-material/Tune';
import EmojiFlagsIcon from '@mui/icons-material/EmojiFlags';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import SportsMotorsportsIcon from '@mui/icons-material/SportsMotorsports';
import ShowChartIcon from '@mui/icons-material/ShowChart';

interface Race {
    session_key: number;
    location: string;
    session_name: string;
}

interface EnrichedF1SessionResult {
    dnf: boolean;
    dns: boolean;
    dsq: boolean;
    driver_number: number;
    number_of_laps: number;
    meeting_key: number | string;
    session_key: number;
    duration: number | null;
    gap_to_leader: number | string | null;
    position: number | null;
    full_name: string;
    name_acronym: string;
    first_name: string;
    last_name: string;
    country_code: string;
}

const formatDuration = (seconds: number | null | string) => {
    if (seconds === null || typeof seconds === 'string') {
        return '';
    }
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.round((seconds - Math.floor(seconds)) * 1000);

    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
};

// Country code to flag emoji mapping (ISO 3166-1 alpha-3 to flag emoji)
const getCountryFlagEmoji = (countryCode: string): string => {
    const flagEmojiMap: { [key: string]: string } = {
        'GBR': '🇬🇧', 'NED': '🇳🇱', 'FRA': '🇫🇷', 'ESP': '🇪🇸', 'GER': '🇩🇪',
        'AUS': '🇦🇺', 'MEX': '🇲🇽', 'CAN': '🇨🇦', 'FIN': '🇫🇮', 'JPN': '🇯🇵',
        'CHN': '🇨🇳', 'DEN': '🇩🇰', 'MON': '🇲🇨', 'THA': '🇹🇭', 'NZL': '🇳🇿',
        'RUS': '🇷🇺', 'POL': '🇵🇱', 'CHE': '🇨🇭', 'AUT': '🇦🇹', 'BEL': '🇧🇪',
        'ITA': '🇮🇹', 'BRA': '🇧🇷', 'ARG': '🇦🇷', 'VEN': '🇻🇪', 'COL': '🇨🇴',
        'SAU': '🇸🇦', 'IND': '🇮🇳', 'SGP': '🇸🇬', 'MYS': '🇲🇾', 'IDN': '🇮🇩',
        'KOR': '🇰🇷', 'ARE': '🇦🇪', 'USA': '🇺🇸', 'IRL': '🇮🇪', 'PRT': '🇵🇹',
        'CZE': '🇨🇿', 'HUN': '🇭🇺', 'SWE': '🇸🇪', 'NOR': '🇳🇴', 'EST': '🇪🇪',
        'LTU': '🇱🇹', 'LVA': '🇱🇻', 'ROU': '🇷🇴', 'BGR': '🇧🇬', 'HRV': '🇭🇷',
        'SVN': '🇸🇮', 'SVK': '🇸🇰', 'ISR': '🇮🇱', 'TUR': '🇹🇷', 'GRC': '🇬🇷',
        'TWN': '🇹🇼', 'HKG': '🇭🇰', 'PHL': '🇵🇭', 'VNM': '🇻🇳', 'ZAF': '🇿🇦',
    };
    return flagEmojiMap[countryCode.toUpperCase()] || '🏁';
};

// Country code to country name mapping
const getCountryName = (countryCode: string): string => {
    const countryNameMap: { [key: string]: string } = {
        'GBR': 'Great Britain', 'NED': 'Netherlands', 'FRA': 'France', 'ESP': 'Spain', 'GER': 'Germany',
        'AUS': 'Australia', 'MEX': 'Mexico', 'CAN': 'Canada', 'FIN': 'Finland', 'JPN': 'Japan',
        'CHN': 'China', 'DEN': 'Denmark', 'MON': 'Monaco', 'THA': 'Thailand', 'NZL': 'New Zealand',
        'RUS': 'Russia', 'POL': 'Poland', 'CHE': 'Switzerland', 'AUT': 'Austria', 'BEL': 'Belgium',
        'ITA': 'Italy', 'BRA': 'Brazil', 'ARG': 'Argentina', 'VEN': 'Venezuela', 'COL': 'Colombia',
        'SAU': 'Saudi Arabia', 'IND': 'India', 'SGP': 'Singapore', 'MYS': 'Malaysia', 'IDN': 'Indonesia',
        'KOR': 'South Korea', 'ARE': 'UAE', 'USA': 'United States', 'IRL': 'Ireland', 'PRT': 'Portugal',
        'CZE': 'Czech Republic', 'HUN': 'Hungary', 'SWE': 'Sweden', 'NOR': 'Norway', 'EST': 'Estonia',
        'LTU': 'Lithuania', 'LVA': 'Latvia', 'ROU': 'Romania', 'BGR': 'Bulgaria', 'HRV': 'Croatia',
        'SVN': 'Slovenia', 'SVK': 'Slovakia', 'ISR': 'Israel', 'TUR': 'Turkey', 'GRC': 'Greece',
        'TWN': 'Taiwan', 'HKG': 'Hong Kong', 'PHL': 'Philippines', 'VNM': 'Vietnam', 'ZAF': 'South Africa',
    };
    return countryNameMap[countryCode.toUpperCase()] || countryCode;
};

// Color palette for driver lines in the chart
const DRIVER_COLORS = [
    '#E10600', // F1 Red
    '#1E41FF', // Blue
    '#00D2BE', // Cyan
    '#FF8700', // Orange
    '#FFF500', // Yellow
    '#006F62', // Dark Green
    '#900000', // Dark Red
    '#2B4562', // Dark Blue
    '#DC143C', // Crimson
    '#50C878', // Emerald
    '#FF1493', // Deep Pink
    '#00CED1', // Dark Turquoise
    '#FFD700', // Gold
    '#8A2BE2', // Blue Violet
    '#FF6347', // Tomato
    '#20B2AA', // Light Sea Green
    '#FF69B4', // Hot Pink
    '#32CD32', // Lime Green
    '#FF4500', // Orange Red
    '#9370DB', // Medium Purple
];

const getDriverColor = (_driverNumber: number, index: number): string => {
    // Use modulo to cycle through colors if we have more drivers than colors
    return DRIVER_COLORS[index % DRIVER_COLORS.length];
};

const Dashboard = () => {
    const [years, setYears] = useState<number[]>([]);
    const [selectedYear, setSelectedYear] = useState<number | string>('');
    const [races, setRaces] = useState<Race[]>([]);
    const [locations, setLocations] = useState<string[]>([]);
    const [selectedLocation, setSelectedLocation] = useState<string>('');
    const [sessions, setSessions] = useState<Race[]>([]);
    const [selectedSessionKey, setSelectedSessionKey] = useState<number | null>(null);
    const [sessionResults, setSessionResults] = useState<EnrichedF1SessionResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedDrivers, setSelectedDrivers] = useState<Set<number>>(new Set());
    const [lapData, setLapData] = useState<LapData[]>([]);
    const [loadingLapData, setLoadingLapData] = useState(false);
    const [columnVisibility, setColumnVisibility] = useState({
        laps: true,
        gapToLeader: true,
        dnf: true,
        dns: true,
        dsq: true,
    });
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

    const handleSettingsClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleSettingsClose = () => {
        setAnchorEl(null);
    };

    const handleColumnVisibilityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setColumnVisibility({
            ...columnVisibility,
            [event.target.name]: event.target.checked,
        });
    };

    useEffect(() => {
        const fetchYears = async () => {
            const data = await getYears();
            setYears(data);
        };
        fetchYears();
    }, []);

    useEffect(() => {
        if (selectedYear) {
            const fetchRaces = async () => {
                const data = await getRacesForYear(selectedYear as number);
                setRaces(data);
                const uniqueLocations: string[] = Array.from(new Set(data.map((race: Race) => race.location)));
                setLocations(uniqueLocations);
                setSelectedLocation('');
                setSessions([]);
                setSelectedSessionKey(null);
                setSessionResults([]);
            };
            fetchRaces();
        }
    }, [selectedYear]);

    useEffect(() => {
        if (selectedLocation) {
            const availableSessions = races.filter((race) => race.location === selectedLocation);
            setSessions(availableSessions);
            setSelectedSessionKey(null);
            setSessionResults([]);
        }
    }, [selectedLocation, races]);

    useEffect(() => {
        if (selectedSessionKey) {
            const fetchSessionResults = async () => {
                setLoading(true);
                try {
                    const data = await getSessionResults(selectedSessionKey);
                    setSessionResults(data);
                    // Reset selected drivers when session changes
                    setSelectedDrivers(new Set());
                    setLapData([]);
                } finally {
                    setLoading(false);
                }
            };
            fetchSessionResults();
        } else {
            setSessionResults([]);
            setSelectedDrivers(new Set());
            setLapData([]);
        }
    }, [selectedSessionKey]);

    // Fetch lap data when drivers are selected
    useEffect(() => {
        if (selectedSessionKey && selectedDrivers.size > 0) {
            const fetchLapData = async () => {
                setLoadingLapData(true);
                try {
                    const driverNumbers = Array.from(selectedDrivers);
                    const data = await getSessionLapData(selectedSessionKey, driverNumbers);
                    setLapData(data);
                } catch (error) {
                    console.error('Error fetching lap data:', error);
                    setLapData([]);
                } finally {
                    setLoadingLapData(false);
                }
            };
            fetchLapData();
        } else {
            setLapData([]);
        }
    }, [selectedSessionKey, selectedDrivers]);

    const handleDriverSelection = (driverNumber: number) => {
        setSelectedDrivers(prev => {
            const newSet = new Set(prev);
            if (newSet.has(driverNumber)) {
                newSet.delete(driverNumber);
            } else {
                newSet.add(driverNumber);
            }
            return newSet;
        });
    };

    const handleSessionChange = (event: SelectChangeEvent<string>) => {
        const sessionName = event.target.value;
        const session = sessions.find(s => s.session_name === sessionName);
        if (session) {
            setSelectedSessionKey(session.session_key);
        }
    }

    return (
        <Box sx={{ 
            flexGrow: 1, 
            minHeight: '100vh',
            background: 'linear-gradient(180deg, #0A0A0A 0%, #0F0F0F 100%)',
            py: { xs: 3, md: 4 },
            px: { xs: 2, sm: 3, md: 4 }
        }}>
            <Box sx={{ mb: 4 }}>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                    <SportsMotorsportsIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                    <Typography variant="h1" component="h1">
                        F1 Dashboard
                    </Typography>
                </Stack>
                <Typography variant="body1" sx={{ color: 'text.secondary', ml: 6 }}>
                    Explore Formula 1 race results and session data
                </Typography>
            </Box>

            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={4}>
                    <Card elevation={0} sx={{ 
                        height: '100%',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: '0 8px 24px rgba(225, 6, 0, 0.15)',
                        }
                    }}>
                        <CardContent>
                            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                                <CalendarTodayIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                                <InputLabel sx={{ fontWeight: 600, color: 'text.primary' }}>
                                    Season
                                </InputLabel>
                            </Stack>
                            <FormControl fullWidth>
                                <Select
                                    value={selectedYear || 'placeholder-year'}
                                    label="Year"
                                    onChange={(e: SelectChangeEvent<number | string>) => {
                                        if (e.target.value !== 'placeholder-year') {
                                            setSelectedYear(e.target.value as number);
                                        }
                                    }}
                                    displayEmpty
                                    sx={{
                                        '& .MuiSelect-select': {
                                            py: 1.5,
                                        }
                                    }}
                                >
                                    <MenuItem value="placeholder-year" disabled>
                                        <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                                            Select a season...
                                        </Typography>
                                    </MenuItem>
                                    {years.map((year) => (
                                        <MenuItem key={year} value={year}>{year}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <Card elevation={0} sx={{ 
                        height: '100%',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: '0 8px 24px rgba(225, 6, 0, 0.15)',
                        }
                    }}>
                        <CardContent>
                            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                                <EmojiFlagsIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                                <InputLabel sx={{ fontWeight: 600, color: 'text.primary' }}>
                                    Location
                                </InputLabel>
                            </Stack>
                            <FormControl fullWidth disabled={!selectedYear}>
                                <Select
                                    value={selectedLocation || 'placeholder-location'}
                                    label="Location"
                                    onChange={(e: SelectChangeEvent<string>) => {
                                        if (e.target.value !== 'placeholder-location') {
                                            setSelectedLocation(e.target.value);
                                        }
                                    }}
                                    displayEmpty
                                    sx={{
                                        '& .MuiSelect-select': {
                                            py: 1.5,
                                        }
                                    }}
                                >
                                    <MenuItem value="placeholder-location" disabled>
                                        <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                                            {selectedYear ? 'Select a location...' : 'Select a Season first'}
                                        </Typography>
                                    </MenuItem>
                                    {locations.map((location) => (
                                        <MenuItem key={location} value={location}>{location}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <Card elevation={0} sx={{ 
                        height: '100%',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: '0 8px 24px rgba(225, 6, 0, 0.15)',
                        }
                    }}>
                        <CardContent>
                            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                                <SportsMotorsportsIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                                <InputLabel sx={{ fontWeight: 600, color: 'text.primary' }}>
                                    Session
                                </InputLabel>
                            </Stack>
                            <FormControl fullWidth disabled={!selectedLocation}>
                                <Select
                                    value={sessions.find(s => s.session_key === selectedSessionKey)?.session_name || 'placeholder-session'}
                                    label="Session"
                                    onChange={(e: SelectChangeEvent<string>) => {
                                        if (e.target.value !== 'placeholder-session') {
                                            handleSessionChange(e);
                                        }
                                    }}
                                    displayEmpty
                                    sx={{
                                        '& .MuiSelect-select': {
                                            py: 1.5,
                                        }
                                    }}
                                >
                                    <MenuItem value="placeholder-session" disabled>
                                        <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                                            {selectedLocation ? 'Select a session...' : 'Select a Location first'}
                                        </Typography>
                                    </MenuItem>
                                    {sessions.map((session) => (
                                        <MenuItem key={session.session_key} value={session.session_name}>{session.session_name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
            {sessionResults.length > 0 && (
                <Card elevation={0} sx={{ mt: 2 }}>
                    <CardContent sx={{ p: 0 }}>
                        <Box sx={{ 
                            p: 3, 
                            pb: 2,
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            borderBottom: '1px solid',
                            borderColor: 'divider'
                        }}>
                            <Box>
                                <Typography variant="h2" component="h2" sx={{ mb: 0.5 }}>
                                    Session Results
                                </Typography>
                                <Stack direction="row" spacing={1} flexWrap="wrap">
                                    {selectedYear && (
                                        <Chip 
                                            label={`${selectedYear}`} 
                                            size="small" 
                                            sx={{ 
                                                backgroundColor: 'rgba(225, 6, 0, 0.15)',
                                                color: 'primary.main',
                                                fontWeight: 600
                                            }} 
                                        />
                                    )}
                                    {selectedLocation && (
                                        <Chip 
                                            label={selectedLocation} 
                                            size="small"
                                            sx={{ 
                                                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                                color: 'text.primary',
                                            }} 
                                        />
                                    )}
                                    {sessions.find(s => s.session_key === selectedSessionKey)?.session_name && (
                                        <Chip 
                                            label={sessions.find(s => s.session_key === selectedSessionKey)?.session_name} 
                                            size="small"
                                            sx={{ 
                                                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                                color: 'text.primary',
                                            }} 
                                        />
                                    )}
                                </Stack>
                            </Box>
                            <IconButton
                                aria-controls="settings-menu"
                                aria-haspopup="true"
                                onClick={handleSettingsClick}
                                sx={{
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    '&:hover': {
                                        borderColor: 'primary.main',
                                    }
                                }}
                            >
                                <TuneIcon />
                            </IconButton>
                            <Menu
                                id="settings-menu"
                                anchorEl={anchorEl}
                                keepMounted
                                open={Boolean(anchorEl)}
                                onClose={handleSettingsClose}
                                PaperProps={{
                                    sx: {
                                        mt: 1,
                                        minWidth: 200,
                                    }
                                }}
                            >
                                <Box sx={{ p: 2 }}>
                                    <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 600, color: 'text.secondary' }}>
                                        Column Visibility
                                    </Typography>
                                    <Divider sx={{ mb: 1.5 }} />
                                    <FormGroup>
                                        <FormControlLabel
                                            control={<Checkbox checked={columnVisibility.laps} onChange={handleColumnVisibilityChange} name="laps" />}
                                            label="Laps"
                                        />
                                        <FormControlLabel
                                            control={<Checkbox checked={columnVisibility.gapToLeader} onChange={handleColumnVisibilityChange} name="gapToLeader" />}
                                            label="Gap to Leader"
                                        />
                                        <FormControlLabel
                                            control={<Checkbox checked={columnVisibility.dnf} onChange={handleColumnVisibilityChange} name="dnf" />}
                                            label="DNF"
                                        />
                                        <FormControlLabel
                                            control={<Checkbox checked={columnVisibility.dns} onChange={handleColumnVisibilityChange} name="dns" />}
                                            label="DNS"
                                        />
                                        <FormControlLabel
                                            control={<Checkbox checked={columnVisibility.dsq} onChange={handleColumnVisibilityChange} name="dsq" />}
                                            label="DSQ"
                                        />
                                    </FormGroup>
                                </Box>
                            </Menu>
                        </Box>
                        {loading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
                                <CircularProgress size={48} />
                            </Box>
                        ) : (
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Position</TableCell>
                                            <TableCell>Driver</TableCell>
                                            <TableCell>Nationality</TableCell>
                                            <TableCell>Driver #</TableCell>
                                            {columnVisibility.laps && <TableCell>Laps</TableCell>}
                                            <TableCell>Duration</TableCell>
                                            {columnVisibility.gapToLeader && <TableCell>Gap to Leader</TableCell>}
                                            {columnVisibility.dnf && <TableCell>DNF</TableCell>}
                                            {columnVisibility.dns && <TableCell>DNS</TableCell>}
                                            {columnVisibility.dsq && <TableCell>DSQ</TableCell>}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {sessionResults.map((result, index) => (
                                            <TableRow 
                                                key={result.driver_number}
                                                sx={{
                                                    '&:first-of-type': {
                                                        backgroundColor: 'rgba(225, 6, 0, 0.08)',
                                                    }
                                                }}
                                            >
                                                <TableCell>
                                                    <Chip 
                                                        label={result.position || '-'} 
                                                        size="small"
                                                        sx={{
                                                            backgroundColor: index === 0 
                                                                ? 'primary.main' 
                                                                : result.position === 1 
                                                                ? 'rgba(225, 6, 0, 0.3)'
                                                                : 'rgba(255, 255, 255, 0.08)',
                                                            color: index === 0 ? 'white' : 'text.primary',
                                                            fontWeight: 700,
                                                            minWidth: 36,
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                        {result.full_name}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                        <Typography variant="body2" sx={{ fontSize: '1.2rem' }}>
                                                            {getCountryFlagEmoji(result.country_code)}
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                            {getCountryName(result.country_code)}
                                                        </Typography>
                                                    </Stack>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                        {result.driver_number}
                                                    </Typography>
                                                </TableCell>
                                                {columnVisibility.laps && (
                                                    <TableCell>{result.number_of_laps}</TableCell>
                                                )}
                                                <TableCell>
                                                    <Typography 
                                                        variant="body2" 
                                                        sx={{ 
                                                            fontFamily: 'monospace',
                                                            color: result.position === 1 ? 'primary.main' : 'text.primary',
                                                            fontWeight: result.position === 1 ? 700 : 400,
                                                        }}
                                                    >
                                                        {formatDuration(result.duration)}
                                                    </Typography>
                                                </TableCell>
                                                {columnVisibility.gapToLeader && (
                                                    <TableCell>
                                                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                                                            {formatDuration(result.gap_to_leader)}
                                                        </Typography>
                                                    </TableCell>
                                                )}
                                                {columnVisibility.dnf && (
                                                    <TableCell>
                                                        {result.dnf ? (
                                                            <Chip label="DNF" size="small" color="error" />
                                                        ) : (
                                                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>-</Typography>
                                                        )}
                                                    </TableCell>
                                                )}
                                                {columnVisibility.dns && (
                                                    <TableCell>
                                                        {result.dns ? (
                                                            <Chip label="DNS" size="small" color="warning" />
                                                        ) : (
                                                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>-</Typography>
                                                        )}
                                                    </TableCell>
                                                )}
                                                {columnVisibility.dsq && (
                                                    <TableCell>
                                                        {result.dsq ? (
                                                            <Chip label="DSQ" size="small" color="error" />
                                                        ) : (
                                                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>-</Typography>
                                                        )}
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Lap Duration Comparison Chart */}
            {sessionResults.length > 0 && (
                <Card elevation={0} sx={{ mt: 3 }}>
                    <CardContent>
                        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
                            <ShowChartIcon sx={{ color: 'primary.main', fontSize: 28 }} />
                            <Box>
                                <Typography variant="h2" component="h2" sx={{ mb: 0.5 }}>
                                    Lap Duration Comparison
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    Compare lap times across drivers
                                </Typography>
                            </Box>
                        </Stack>

                        {/* Driver Selection Checkboxes */}
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 600, color: 'text.secondary' }}>
                                Select Drivers to Compare
                            </Typography>
                            <Box
                                sx={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: 1.5,
                                    p: 2,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: 2,
                                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                }}
                            >
                                {sessionResults.map((result) => (
                                    <FormControlLabel
                                        key={result.driver_number}
                                        control={
                                            <Checkbox
                                                checked={selectedDrivers.has(result.driver_number)}
                                                onChange={() => handleDriverSelection(result.driver_number)}
                                                sx={{
                                                    color: 'text.secondary',
                                                    '&.Mui-checked': {
                                                        color: 'primary.main',
                                                    },
                                                }}
                                            />
                                        }
                                        label={
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <Typography variant="body2" sx={{ fontSize: '1rem' }}>
                                                    {getCountryFlagEmoji(result.country_code)}
                                                </Typography>
                                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                    #{result.driver_number} {result.full_name}
                                                </Typography>
                                            </Stack>
                                        }
                                    />
                                ))}
                            </Box>
                        </Box>

                        {/* Chart */}
                        {loadingLapData ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
                                <CircularProgress size={48} />
                            </Box>
                        ) : selectedDrivers.size === 0 ? (
                            <Box
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    py: 8,
                                    border: '1px dashed',
                                    borderColor: 'divider',
                                    borderRadius: 2,
                                }}
                            >
                                <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                                    Select drivers above to compare lap times
                                </Typography>
                            </Box>
                        ) : lapData.length === 0 ? (
                            <Box
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    py: 8,
                                    border: '1px dashed',
                                    borderColor: 'divider',
                                    borderRadius: 2,
                                }}
                            >
                                <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                                    No lap data available for selected drivers
                                </Typography>
                            </Box>
                        ) : (
                            <LapComparisonChart
                                lapData={lapData}
                                selectedDrivers={Array.from(selectedDrivers)}
                                sessionResults={sessionResults}
                            />
                        )}
                    </CardContent>
                </Card>
            )}
        </Box>
    );
};

// Lap Comparison Chart Component
interface LapComparisonChartProps {
    lapData: LapData[];
    selectedDrivers: number[];
    sessionResults: EnrichedF1SessionResult[];
}

const LapComparisonChart: React.FC<LapComparisonChartProps> = ({
    lapData,
    selectedDrivers,
    sessionResults,
}) => {
    // Process data for chart
    const chartData = useMemo(() => {
        // Group lap data by driver
        const driverLaps: { [driverNumber: number]: { [lapNumber: number]: number | null } } = {};
        
        selectedDrivers.forEach(driverNum => {
            driverLaps[driverNum] = {};
        });

        lapData.forEach(lap => {
            if (selectedDrivers.includes(lap.driver_number)) {
                driverLaps[lap.driver_number][lap.lap_number] = lap.lap_duration;
            }
        });

        // Find max lap number across all selected drivers
        const maxLapNumber = Math.max(
            ...selectedDrivers.map(driverNum => {
                const laps = driverLaps[driverNum];
                return laps ? Math.max(...Object.keys(laps).map(Number), 0) : 0;
            }),
            0
        );

        // Build chart data structure
        const data: { [key: string]: number | null | string }[] = [];
        
        for (let lapNum = 1; lapNum <= maxLapNumber; lapNum++) {
            const dataPoint: { [key: string]: number | null | string } = {
                lap: `Lap ${lapNum}`,
                lapNumber: lapNum,
            };

            selectedDrivers.forEach((driverNum) => {
                const driverName = sessionResults.find(r => r.driver_number === driverNum)?.full_name || `Driver ${driverNum}`;
                const lapDuration = driverLaps[driverNum]?.[lapNum] ?? null;
                dataPoint[`driver_${driverNum}`] = lapDuration;
                dataPoint[`driver_${driverNum}_name`] = driverName;
            });

            data.push(dataPoint);
        }

        return data;
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

    // Format Y-axis (lap duration in seconds)
    const formatDuration = (value: number) => {
        if (value === null || value === undefined) return '';
        const minutes = Math.floor(value / 60);
        const seconds = (value % 60).toFixed(3);
        return `${minutes}:${seconds.padStart(6, '0')}`;
    };

    return (
        <Box sx={{ width: '100%', height: 500 }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={chartData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
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
                        label={{
                            value: 'Lap Duration (min:sec)',
                            angle: -90,
                            position: 'insideLeft',
                            style: { fill: 'rgba(255, 255, 255, 0.7)', fontSize: '12px' },
                        }}
                        tickFormatter={(value: number) => {
                            return formatDuration(value);
                        }}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#1A1A1A',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '8px',
                            color: '#FFFFFF',
                        }}
                        formatter={(value: any) => {
                            if (value === null || value === undefined || typeof value !== 'number') return ['N/A', 'Lap Duration'];
                            return [formatDuration(value), 'Lap Duration'];
                        }}
                        labelFormatter={(label: string) => label}
                    />
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
                            dot={{ fill: driver.color, r: 3 }}
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

export default Dashboard;
