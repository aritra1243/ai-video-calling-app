import api from './api';

export const standupService = {
  // Submit or update today's standup
  submit: async ({ win, oneThing, challenge, date }) => {
    const response = await api.post('/standups', { win, oneThing, challenge, date });
    return response.data;
  },

  // Get current user's standup history
  getMy: async (weeks = 4) => {
    const response = await api.get('/standups/my', { params: { weeks } });
    return response.data;
  },

  // Get today's standup for current user
  getToday: async () => {
    const response = await api.get('/standups/today');
    return response.data;
  },

  // Get all team entries for a specific week
  getWeekly: async (weekStart) => {
    const params = weekStart ? { weekStart } : {};
    const response = await api.get('/standups/weekly', { params });
    return response.data;
  },

  // Get all team entries for a specific day
  getDaily: async (date) => {
    const params = date ? { date } : {};
    const response = await api.get('/standups/daily', { params });
    return response.data;
  },

  // Get list of weeks that have data
  getAvailableWeeks: async () => {
    const response = await api.get('/standups/available-weeks');
    return response.data;
  },

  // Generate AI weekly report
  generateWeeklyReport: async (weekStart, weeklyData) => {
    const response = await api.post('/ai/standup-report', { weekStart, weeklyData }, {
      timeout: 60000,
    });
    return response.data;
  },
};
