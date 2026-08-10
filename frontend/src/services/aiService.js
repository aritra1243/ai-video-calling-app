import api from './api';

export const aiService = {
  transcribe: async (meetingId) => {
    const response = await api.post(`/ai/${meetingId}/transcribe`, {}, {
      timeout: 600000, // 10 min timeout for long recordings
    });
    return response.data;
  },

  summarize: async (meetingId) => {
    const response = await api.post(`/ai/${meetingId}/summarize`, {}, {
      timeout: 120000, // 2 min timeout
    });
    return response.data;
  },

  getTranscript: async (meetingId) => {
    const response = await api.get(`/ai/${meetingId}/transcript`);
    return response.data;
  },

  getSummary: async (meetingId) => {
    const response = await api.get(`/ai/${meetingId}/summary`);
    return response.data;
  },

  askMeeting: async (meetingId, question) => {
    const response = await api.post(`/ai/${meetingId}/ask`, { question }, {
      timeout: 60000,
    });
    return response.data;
  },
};
