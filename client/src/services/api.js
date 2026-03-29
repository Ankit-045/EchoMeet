import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' }
});

// Attach token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('echomeet_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('echomeet_token');
      localStorage.removeItem('echomeet_user');
    }
    return Promise.reject(error);
  }
);

// Auth
export const register = (data) => api.post('/auth/register', data);
export const login = (data) => api.post('/auth/login', data);
export const guestLogin = (data) => api.post('/auth/guest', data);
export const getMe = () => api.get('/auth/me');

// Rooms
export const createRoom = (data) => api.post('/rooms/create', data);
export const joinRoom = (roomId, data) => api.post(`/rooms/join/${roomId}`, data);
export const getRoomInfo = (roomId) => api.get(`/rooms/${roomId}`);
export const updateRoomSettings = (roomId, data) => api.put(`/rooms/${roomId}/settings`, data);
export const endRoom = (roomId) => api.post(`/rooms/${roomId}/end`);
export const toggleScreenSharePermission = (roomId, data) => api.post(`/rooms/${roomId}/screen-share-permission`, data);

// Meetings
export const scheduleMeeting = (data) => api.post('/meetings', data);
export const getMyMeetings = () => api.get('/meetings/my-meetings');
export const getActiveMeetings = () => api.get('/meetings/active');
export const deleteMeeting = (id) => api.delete(`/meetings/${id}`);

// Chat
export const getChatHistory = (roomId, type) => api.get(`/chat/${roomId}?type=${type || 'group'}`);

// Attendance
export const getAttendance = (roomId) => api.get(`/attendance/${roomId}`);
export const getMyAttendance = () => api.get('/attendance/my/history');

// Summary
export const generateSummary = (data) => api.post('/summary/generate', data);
export const getSummaries = (roomId) => api.get(`/summary/${roomId}`);
export const getMySummaries = () => api.get('/summary/my/all');

export default api;
