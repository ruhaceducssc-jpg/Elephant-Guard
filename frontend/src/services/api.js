import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

// Mock Interceptor for Demo Purposes
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Mock Data for University Presentation
export const MOCK_ALERTS = [
  {
    id: 1,
    locationName: "Wasgamuwa National Park",
    coordinates: [7.7477, 80.9531],
    detectedAt: new Date().toISOString(),
    confidence: 0.98,
    status: 'active',
    image: '/assets/images/elephant-fallback.jpg'
  },
  {
    id: 2,
    locationName: "Udawalawe Border",
    coordinates: [6.4741, 80.8903],
    detectedAt: new Date(Date.now() - 3600000).toISOString(),
    confidence: 0.85,
    status: 'cleared',
    image: '/assets/images/hero.jpg'
  }
];

export default api;
