import api from './api';

export const invitationService = {
  create: async (inviteeId, meetingTitle, roomId) => {
    const response = await api.post('/invitations', { inviteeId, meetingTitle, roomId });
    return response.data;
  },

  getMy: async () => {
    const response = await api.get('/invitations');
    return response.data;
  },

  rsvp: async (id, status) => {
    const response = await api.patch(`/invitations/${id}/rsvp`, { status });
    return response.data;
  },
};
