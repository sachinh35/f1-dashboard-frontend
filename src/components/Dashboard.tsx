import { useState, useEffect } from 'react';
import { getYears, getRacesForYear } from '../services/api';

interface Race {
    session_key: number;
    location: string;
    session_name: string;
}

const Dashboard = () => {
    const [years, setYears] = useState<number[]>([]);
    const [selectedYear, setSelectedYear] = useState<number | null>(null);
    const [races, setRaces] = useState<Race[]>([]);
    const [locations, setLocations] = useState<string[]>([]);
    const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
    const [sessions, setSessions] = useState<Race[]>([]);
    const [selectedSessionKey, setSelectedSessionKey] = useState<number | null>(null);

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
                const data = await getRacesForYear(selectedYear);
                setRaces(data);
                const uniqueLocations = [...new Set(data.map((race: Race) => race.location))];
                setLocations(uniqueLocations);
                setSelectedLocation(null);
                setSessions([]);
                setSelectedSessionKey(null);
            };
            fetchRaces();
        }
    }, [selectedYear]);

    useEffect(() => {
        if (selectedLocation) {
            const availableSessions = races.filter((race) => race.location === selectedLocation);
            setSessions(availableSessions);
            setSelectedSessionKey(null);
        }
    }, [selectedLocation, races]);

    const handleSessionChange = (sessionName: string) => {
        const session = sessions.find(s => s.session_name === sessionName);
        if (session) {
            setSelectedSessionKey(session.session_key);
        }
    }

    return (
        <div>
            <h1>F1 Dashboard</h1>
            <div>
                <label>Year: </label>
                <select onChange={(e) => setSelectedYear(Number(e.target.value))} value={selectedYear || ''}>
                    <option value="" disabled>Select Year</option>
                    {years.map((year) => (
                        <option key={year} value={year}>{year}</option>
                    ))}
                </select>
            </div>
            {selectedYear && locations.length > 0 && (
                <div>
                    <label>Location: </label>
                    <select onChange={(e) => setSelectedLocation(e.target.value)} value={selectedLocation || ''}>
                        <option value="" disabled>Select Location</option>
                        {locations.map((location) => (
                            <option key={location} value={location}>{location}</option>
                        ))}
                    </select>
                </div>
            )}
            {selectedLocation && sessions.length > 0 && (
                <div>
                    <label>Session: </label>
                    <select onChange={(e) => handleSessionChange(e.target.value)} defaultValue="">
                        <option value="" disabled>Select Session</option>
                        {sessions.map((session) => (
                            <option key={session.session_key} value={session.session_name}>{session.session_name}</option>
                        ))}
                    </select>
                </div>
            )}
            {selectedSessionKey && (
                <div>
                    <p>Selected Session Key: {selectedSessionKey}</p>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
