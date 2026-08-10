import api from './api';

export const meetingService = {
  create: async (title) => {
    const response = await api.post('/meetings', { title });
    return response.data;
  },

  getAll: async (search = '') => {
    const response = await api.get('/meetings', {
      params: search ? { search } : {},
    });
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/meetings/${id}`);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/meetings/${id}`);
    return response.data;
  },

  join: async (roomId) => {
    const response = await api.patch(`/meetings/${roomId}/join`);
    return response.data;
  },

  end: async (id) => {
    const response = await api.patch(`/meetings/${id}/end`);
    return response.data;
  },

  toggleActionItem: async (id, itemIndex) => {
    const response = await api.patch(`/meetings/${id}/action-items/${itemIndex}`);
    return response.data;
  },

  uploadRecording: async (id, blob) => {
    const formData = new FormData();
    formData.append('recording', blob, `meeting-${id}.webm`);
    const response = await api.post(`/meetings/${id}/recording`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000, // 5 min timeout for large files
    });
    return response.data;
  },

  getRecordingUrl: (id) => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    return `${API_URL}/meetings/${id}/recording`;
  },
};
