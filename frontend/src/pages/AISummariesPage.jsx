import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { meetingService } from '../services/meetingService';
import { aiService } from '../services/aiService';
import {
  HiSparkles, HiCalendar, HiUsers, HiVideoCamera,
  HiChevronDown, HiChevronUp, HiClipboardList, HiLightningBolt,
  HiCheckCircle, HiArrowRight,
} from 'react-icons/hi';
import toast from 'react-hot-toast';

const AISummariesPage = () => {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [summarizing, setSummarizing] = useState(null);
  const [transcribing, setTranscribing] = useState(null);

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      const data = await meetingService.getAll();
      setMeetings(data.meetings || []);
    } catch {
      toast.error('Failed to load meetings');
    } finally {
      setLoading(false);
    }
  };

  const handleTranscribe = async (meeting) => {
    setTranscribing(meeting._id);
    try {
      toast.loading('Transcribing recording...', { id: 'transcribe' });
      const data = await aiService.transcribe(meeting._id);
      setMeetings(prev => prev.map(m => m._id === meeting._id ? { ...m, transcript: data.transcript } : m));
      toast.success('Transcription complete!', { id: 'transcribe' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Transcription failed', { id: 'transcribe' });
    } finally {
      setTranscribing(null);
    }
  };

  const handleSummarize = async (meeting) => {
    setSummarizing(meeting._id);
    try {
      toast.loading('Generating AI summary...', { id: 'summarize' });
      const data = await aiService.summarize(meeting._id);
      setMeetings(prev => prev.map(m => m._id === meeting._id ? { ...m, summary: data.summary } : m));
      toast.success('Summary generated!', { id: 'summarize' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Summary failed', { id: 'summarize' });
    } finally {
      setSummarizing(null);
    }
  };

  const formatDate = (date) =>
    new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const [selectedDate, setSelectedDate] = useState('');

  const endedMeetings = meetings.filter(m => m.status === 'ended');
  const withSummary = endedMeetings.filter(m => m.summary?.summary);
  const withoutSummary = endedMeetings.filter(m => !m.summary?.summary);

  const filteredEndedMeetings = endedMeetings.filter((m) => {
    if (!selectedDate) return true;
    return new Date(m.createdAt).toISOString().slice(0, 10) === selectedDate;
  });

  return (
    <div className="page-container" style={{ maxWidth: '1000px' }}>
      {/* Header */}
      <div className="animate-fade-in" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem',
              background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.15))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <HiSparkles size={22} color="#818cf8" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>AI Summaries</h1>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                Post-meeting AI analysis, key points & action items
              </p>
            </div>
          </div>

          {/* Calendar Date Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="date"
              className="input"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ fontSize: '0.8125rem', padding: '0.5rem 0.75rem', cursor: 'pointer' }}
              title="Filter summaries by meeting date"
            />
            {selectedDate && (
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedDate('')}
                style={{ fontSize: '0.75rem', padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}
              >
                Clear Date
              </button>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Ended Meetings', value: endedMeetings.length, color: '#94a3b8' },
            { label: 'AI Summaries Generated', value: withSummary.length, color: '#818cf8' },
            { label: 'Pending Summary', value: withoutSummary.length, color: '#f59e0b' },
          ].map((s, i) => (
            <div key={i} className="glass-card" style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <div className="spinner" />
        </div>
      ) : filteredEndedMeetings.length === 0 ? (
        <div className="glass-card" style={{ padding: '4rem', textAlign: 'center' }}>
          <HiSparkles size={48} style={{ color: 'var(--color-text-muted)', margin: '0 auto 1rem', display: 'block' }} />
          <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
            {selectedDate ? 'No summaries found for selected date' : 'No ended meetings yet'}
          </h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            {selectedDate ? 'Try selecting a different date from the calendar filter' : 'AI summaries are generated for completed meetings with recordings'}
          </p>
          {!selectedDate && (
            <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredEndedMeetings.map((meeting, index) => {

            const hasSummary = Boolean(meeting.summary?.summary);
            const hasTranscript = Boolean(meeting.transcript?.text);
            const hasRecording = Boolean(meeting.recordingFilename);
            const isExpanded = expandedId === meeting._id;

            return (
              <div
                key={meeting._id}
                className="glass-card animate-fade-in"
                style={{ animationDelay: `${index * 0.06}s`, overflow: 'hidden' }}
              >
                {/* Card header */}
                <div style={{ padding: '1.25rem 1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0 }}>
                      <div style={{
                        width: '2.5rem', height: '2.5rem', borderRadius: '0.625rem', flexShrink: 0,
                        background: hasSummary
                          ? 'linear-gradient(135deg, rgba(129,140,248,0.2), rgba(59,130,246,0.15))'
                          : 'rgba(30,41,59,0.8)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: hasSummary ? '1px solid rgba(129,140,248,0.3)' : '1px solid var(--color-border)',
                      }}>
                        <HiVideoCamera size={18} color={hasSummary ? '#818cf8' : 'var(--color-text-muted)'} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{meeting.title}</div>
                        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--color-text-secondary)', flexWrap: 'wrap' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <HiCalendar size={12} />{formatDate(meeting.createdAt)}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <HiUsers size={12} />{meeting.participants?.length || 0} participants
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                      {hasSummary && (
                        <span style={{
                          padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.6875rem', fontWeight: 600,
                          background: 'rgba(129,140,248,0.15)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.25)',
                        }}>
                          ✨ Summary Ready
                        </span>
                      )}
                      {!hasSummary && hasRecording && !hasTranscript && (
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: '0.8125rem', padding: '0.5rem 1rem' }}
                          disabled={transcribing === meeting._id}
                          onClick={() => handleTranscribe(meeting)}
                        >
                          {transcribing === meeting._id ? <div className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }} /> : '🎤 Transcribe'}
                        </button>
                      )}
                      {!hasSummary && hasTranscript && (
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: '0.8125rem', padding: '0.5rem 1rem' }}
                          disabled={summarizing === meeting._id}
                          onClick={() => handleSummarize(meeting)}
                        >
                          {summarizing === meeting._id ? <div className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }} /> : <><HiSparkles size={14} /> Generate Summary</>}
                        </button>
                      )}
                      {!hasSummary && !hasRecording && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>No recording</span>
                      )}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : meeting._id)}
                        className="btn-icon"
                        style={{ padding: '0.5rem', cursor: 'pointer' }}
                        title={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? <HiChevronUp size={16} /> : <HiChevronDown size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Summary */}
                {isExpanded && hasSummary && (
                  <div style={{ borderTop: '1px solid rgba(56,189,248,0.1)', padding: '1.5rem' }}>
                    {/* Summary text */}
                    <div style={{ marginBottom: '1.5rem' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#818cf8', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <HiSparkles size={14} /> AI Summary
                      </h4>
                      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                        {meeting.summary.summary}
                      </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                      {/* Key Points */}
                      {meeting.summary.keyPoints?.length > 0 && (
                        <div>
                          <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <HiClipboardList size={14} /> Key Points
                          </h4>
                          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                            {meeting.summary.keyPoints.map((pt, i) => (
                              <li key={i} style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', display: 'flex', gap: '0.5rem' }}>
                                <span style={{ color: '#38bdf8', flexShrink: 0 }}>•</span>{pt}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Action Items */}
                      {meeting.summary.actionItems?.length > 0 && (
                        <div>
                          <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <HiLightningBolt size={14} /> Action Items
                          </h4>
                          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                            {meeting.summary.actionItems.map((item, i) => (
                              <li key={i} style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                <HiCheckCircle size={14} style={{ color: item.completed ? '#10b981' : 'var(--color-text-muted)', flexShrink: 0, marginTop: '1px' }} />
                                <span><strong style={{ color: 'var(--color-text-primary)' }}>{item.assignee}</strong>: {item.task}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8125rem', padding: '0.5rem 1rem' }}
                      onClick={() => navigate(`/meeting/${meeting.roomId}/details`)}
                    >
                      View Full Details <HiArrowRight size={14} />
                    </button>
                  </div>
                )}

                {/* Expanded when no summary yet */}
                {isExpanded && !hasSummary && (
                  <div style={{ borderTop: '1px solid rgba(56,189,248,0.1)', padding: '1.5rem', textAlign: 'center' }}>
                    <HiSparkles size={32} style={{ color: 'var(--color-text-muted)', margin: '0 auto 0.75rem', display: 'block' }} />
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                      {!hasRecording
                        ? 'No recording available for this meeting.'
                        : !hasTranscript
                        ? 'Transcribe the recording first, then generate an AI summary.'
                        : 'Transcript ready. Click "Generate Summary" to get AI insights.'}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AISummariesPage;
