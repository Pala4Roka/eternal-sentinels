import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth helpers
export const getToken = () => localStorage.getItem('es_token');
export const setToken = (token) => localStorage.setItem('es_token', token);
export const removeToken = () => localStorage.removeItem('es_token');
export const getUser = () => {
  const user = localStorage.getItem('es_user');
  return user ? JSON.parse(user) : null;
};
export const setUser = (user) => localStorage.setItem('es_user', JSON.stringify(user));
export const removeUser = () => localStorage.removeItem('es_user');

// Axios instance with auth
const apiClient = axios.create({
  baseURL: API,
});

// Add auth header to requests
apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      removeToken();
      removeUser();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (username, password) => {
    const response = await axios.post(`${API}/auth/login`, { username, password });
    return response.data;
  },
  
  register: async (username, password, clearance_level = 1) => {
    const response = await axios.post(`${API}/auth/register`, {
      username,
      password,
      clearance_level
    });
    return response.data;
  },
  
  getMe: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },
};

// SCP API
export const scpAPI = {
  getAll: async () => {
    const response = await apiClient.get('/scp');
    return response.data;
  },
  
  getByNumber: async (number) => {
    const response = await apiClient.get(`/scp/${number}`);
    return response.data;
  },
  
  create: async (data) => {
    const response = await apiClient.post('/scp', data);
    return response.data;
  },
  
  update: async (number, data) => {
    const response = await apiClient.put(`/scp/${number}`, data);
    return response.data;
  },
  
  updateObject: async (number, data) => {
    const response = await apiClient.put(`/scp/${number}`, data);
    return response.data;
  },
  
  delete: async (number) => {
    const response = await apiClient.delete(`/scp/${number}`);
    return response.data;
  },
  
  deleteObject: async (number) => {
    const response = await apiClient.delete(`/scp/${number}`);
    return response.data;
  },
};

// Chat API
export const chatAPI = {
  sendMessage: async (message, sessionId) => {
    const response = await apiClient.post('/chat', {
      message,
      session_id: sessionId
    });
    return response.data;
  },
  
  getHistory: async (sessionId) => {
    const response = await apiClient.get(`/chat/history/${sessionId}`);
    return response.data;
  },
};

// Admin API
export const adminAPI = {
  getUsers: async () => {
    const response = await apiClient.get('/admin/users');
    return response.data;
  },
  
  updateClearance: async (userId, clearanceLevel) => {
    const response = await apiClient.put(`/admin/users/${userId}/clearance`, null, {
      params: { clearance_level: clearanceLevel }
    });
    return response.data;
  },
  
  updateStatus: async (userId, isActive) => {
    const response = await apiClient.put(`/admin/users/${userId}/status`, null, {
      params: { is_active: isActive }
    });
    return response.data;
  },
};

// Dossier API
export const dossierAPI = {
  submit: async (fileData) => {
    const response = await apiClient.post('/dossier/submit', fileData);
    return response.data;
  },
  
  getMySubmissions: async () => {
    const response = await apiClient.get('/dossier/my-submissions');
    return response.data;
  },
  
  getStatus: async () => {
    const response = await apiClient.get('/dossier/status');
    return response.data;
  },
};

// Admin Dossier API
export const adminDossierAPI = {
  getAllDossiers: async () => {
    const response = await apiClient.get('/admin/dossiers');
    return response.data;
  },
  
  getDossierDetail: async (dossierId) => {
    const response = await apiClient.get(`/admin/dossiers/${dossierId}`);
    return response.data;
  },
  
  moderateDossier: async (dossierId, status, adminComment = '') => {
    const response = await apiClient.put(`/admin/dossiers/${dossierId}/moderate`, {
      status,
      admin_comment: adminComment
    });
    return response.data;
  },
};

export default apiClient;
