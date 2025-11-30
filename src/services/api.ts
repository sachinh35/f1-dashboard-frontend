import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

export const getYears = async () => {
    const response = await axios.get(`${API_BASE_URL}/years`);
    return response.data.years_list;
};

export const getRacesForYear = async (year: number) => {
    const response = await axios.get(`${API_BASE_URL}/races/${year}`);
    return response.data.all_races;
};

export const getSessionResults = async (session_key: number) => {
    const response = await axios.get(`${API_BASE_URL}/session-results/${session_key}`);
    return response.data.results;
};

export interface LapData {
    meeting_key: number;
    session_key: number;
    driver_number: number;
    lap_number: number;
    date_start: string | null;
    duration_sector_1: number | null;
    duration_sector_2: number | null;
    duration_sector_3: number | null;
    lap_duration: number | null;
    i1_speed: number | null;
    i2_speed: number | null;
    st_speed: number | null;
    is_pit_out_lap: boolean;
    segments_sector_1: (number | null)[] | null;
    segments_sector_2: (number | null)[] | null;
    segments_sector_3: (number | null)[] | null;
}

export interface GetSessionLapDataResponse {
    session_key: number;
    lap_data: LapData[];
}

export const getSessionLapData = async (session_key: number, driver_numbers: number[]): Promise<LapData[]> => {
    const response = await axios.post<GetSessionLapDataResponse>(
        `${API_BASE_URL}/session-lap-data/${session_key}`,
        { driver_numbers }
    );
    return response.data.lap_data;
};

export interface Stint {
    meeting_key: number;
    session_key: number;
    driver_number: number;
    stint_number: number;
    lap_start: number;
    lap_end: number;
    compound: string | null;
    tyre_age_at_start: number | null;
}

export const getSessionStints = async (session_key: number): Promise<Stint[]> => {
    const response = await axios.get(`${API_BASE_URL}/session-stints/${session_key}`);
    return response.data.stints as Stint[];
};

export interface RaceControlEvent {
    session_key: number;
    date: string;
    category: string;
    message: string;
    scope: string | null;
    sector: number | null;
    driver_number: number | null;
    flag: string | null;
}

export const getSessionRaceControlEvents = async (session_key: number): Promise<RaceControlEvent[]> => {
    const response = await axios.get(`${API_BASE_URL}/session-race-control-events/${session_key}`);
    return response.data.events as RaceControlEvent[];
};

export interface StartStreamRequest {
    access_token?: string;
    refresh_token?: string;
    cookies?: string;
}

export interface AuthenticateRequest {
    email: string;
    password: string;
}

export interface AuthenticateResponse {
    success: boolean;
    access_token: string;
    cookies?: string;
    message?: string;
}

export interface StartStreamResponse {
    success: boolean;
    message: string;
    stream_id: string;
    log_file: string;
}

export const authenticateF1TV = async (email: string, password: string): Promise<AuthenticateResponse> => {
    const response = await axios.post<AuthenticateResponse>(
        `${API_BASE_URL}/authenticate-f1tv`,
        {
            email,
            password
        } as AuthenticateRequest
    );
    return response.data;
};

export const startLiveStream = async (accessToken?: string, refreshToken?: string, cookies?: string): Promise<StartStreamResponse> => {
    const response = await axios.post<StartStreamResponse>(
        `${API_BASE_URL}/start-live-stream`,
        {
            access_token: accessToken,
            refresh_token: refreshToken,
            cookies: cookies
        } as StartStreamRequest
    );
    return response.data;
};

export const startSimulation = async (): Promise<StartStreamResponse> => {
    const response = await axios.post<StartStreamResponse>(
        `${API_BASE_URL}/simulate-live-stream`
    );
    return response.data;
};
