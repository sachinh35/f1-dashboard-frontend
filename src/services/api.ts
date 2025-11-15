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
