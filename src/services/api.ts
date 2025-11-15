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
