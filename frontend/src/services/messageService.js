import api from './api';

export const messageService = {
  // Get direct message conversation with a user
  getDirectMessages: async (userId) => {
    const res = await api.get(`/messages/direct/${userId}`);
    return res.data;
  },

  // Send a direct message
  sendDirectMessage: async (receiverId, message) => {
    const res = await api.post('/messages/direct', { receiverId, message });
    return res.data;
  },
};
