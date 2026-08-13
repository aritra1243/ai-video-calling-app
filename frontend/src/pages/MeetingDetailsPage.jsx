import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { meetingService } from '../services/meetingService';
import { aiService } from '../services/aiService';
import {
  HiPlay, HiArrowLeft, HiLightningBolt, HiDocumentText,
  HiCheckCircle, HiClipboardList, HiChevronRight, HiClock,
  HiUsers, HiCalendar, HiDownload, HiPaperAirplane, HiSparkles,
  HiChatAlt,
} from 'react-icons/hi';
import toast from 'react-hot-toast';

const MeetingDetailsPage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);

  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const [transcribing, setTranscribing] = useState(false);
  const [summarizing, setSummarizing] = useState(false);

  // Q&A State
  const [questionInput, setQuestionInput] = useState('');
  const [qaHistory, setQaHistory] = useState([]);
  const [asking, setAsking] = useState(false);
  const qaEndRef = useRef(null);

  useEffect(() => {
    fetchMeeting();
  }, [roomId]);

  useEffect(() => {
    qaEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [qaHistory]);

  const fetchMeeting = async () => {
    try {
      const data = await meetingService.getById(roomId);
      setMeeting(data.meeting);
    } catch (err) {
      toast.error('Failed to load meeting details');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleTranscribe = async () => {
    setTranscribing(true);
    try {
      toast.loading('Transcribing recording using AI...', { id: 'transcribe' });
      const data = await aiService.transcribe(meeting._id);
      setMeeting((prev) => ({ ...prev, transcript: data.transcript }));
      toast.success('Transcription complete!', { id: 'transcribe' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Transcription failed', { id: 'transcribe' });
    } finally {
      setTranscribing(false);
    }
  };

  const handleSummarize = async () => {
    setSummarizing(true);
    try {
      toast.loading('Generating AI summary...', { id: 'summarize' });
      const data = await aiService.summarize(meeting._id);
      setMeeting((prev) => ({ ...prev, summary: data.summary }));
      toast.success('Summary generated!', { id: 'summarize' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Summary generation failed', { id: 'summarize' });
    } finally {
      setSummarizing(false);
    }
  };

  const handleToggleActionItem = async (index) => {
    try {
      const data = await meetingService.toggleActionItem(meeting._id, index);
      setMeeting((prev) => ({
        ...prev,
        summary: {
          ...prev.summary,
          actionItems: data.actionItems,
        },
      }));
      toast.success('Action item updated');
    } catch (err) {
      toast.error('Failed to update action item');
    }
  };

  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!questionInput.trim() || asking) return;

    const q = questionInput.trim();
    setQuestionInput('');
    setQaHistory((prev) => [...prev, { role: 'user', text: q }]);
    setAsking(true);

    try {
      const res = await aiService.askMeeting(meeting._id, q);
      setQaHistory((prev) => [...prev, { role: 'ai', text: res.answer }]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to get answer');
      setQaHistory((prev) => [...prev, { role: 'ai', text: 'Sorry, I failed to generate an answer. Make sure Gemini API key is configured.' }]);
    } finally {
      setAsking(false);
    }
  };

  const handleExportMarkdown = () => {
    if (!meeting) return;

    let content = `# Meeting Report: ${meeting.summary?.title || meeting.title}\n\n`;
    content += `**Date:** ${new Date(meeting.createdAt).toLocaleString()}\n`;
    content += `**Room Code:** ${meeting.roomId}\n\n`;

    if (meeting.summary?.summary) {
      content += `## AI Summary\n${meeting.summary.summary}\n\n`;
    }

    if (meeting.summary?.keyPoints?.length > 0) {
      content += `## Key Points\n`;
      meeting.summary.keyPoints.forEach((p) => { content += `- ${p}\n`; });
      content += `\n`;
    }

    if (meeting.summary?.decisions?.length > 0) {
      content += `## Decisions\n`;
      meeting.summary.decisions.forEach((d) => { content += `- ${d}\n`; });
      content += `\n`;
    }

    if (meeting.summary?.actionItems?.length > 0) {
      content += `## Action Items\n`;
      meeting.summary.actionItems.forEach((a) => {
        content += `- [${a.completed ? 'x' : ' '}] **${a.assignee || 'Unassigned'}**: ${a.task}\n`;
      });
      content += `\n`;
    }

    if (meeting.transcript?.text) {
      content += `## Transcript\n${meeting.transcript.text}\n`;
    }

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(meeting.title || 'meeting').replace(/[^a-z0-9]/gi, '_')}_summary.md`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Report downloaded as Markdown');
  };

  const seekToTimestamp = (seconds) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
    }
  };

  const formatTimestamp = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!meeting) return null;

  const tabs = [
    { id: 'summary', label: 'AI Summary', icon: HiLightningBolt },
    { id: 'transcript', label: 'Transcript', icon: HiDocumentText },
    { id: 'actions', label: 'Action Items', icon: HiClipboardList },
    { id: 'ask', label: 'Ask Meeting AI', icon: HiSparkles },
  ];

  return (
    <div className="page-container">
      {/* Back Button & Actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'var(--color-text-secondary)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.875rem',
            padding: 0,
            fontFamily: 'var(--font-sans)',
          }}
        >
          <HiArrowLeft size={16} />
          Back to Dashboard
        </button>

        <button className="btn btn-secondary" onClick={handleExportMarkdown} style={{ fontSize: '0.8125rem' }}>
          <HiDownload size={16} />
          Export Report (.md)
        </button>
      </div>

      {/* Meeting Header */}
      <div className="animate-fade-in" style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.75rem', wordBreak: 'break-word' }}>
          {meeting.summary?.title || meeting.title}
        </h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <HiCalendar size={14} />
            {new Date(meeting.createdAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <HiUsers size={14} />
            {meeting.participants?.length || 0} participants
          </span>
          {meeting.startedAt && meeting.endedAt && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <HiClock size={14} />
              {Math.round((new Date(meeting.endedAt) - new Date(meeting.startedAt)) / 60000)} minutes
            </span>
          )}
        </div>
      </div>

      <div className="meeting-details-grid">
        {/* Left Column: Video Player */}
        <div className="animate-fade-in">
          {/* Video Player */}
          {meeting.recordingUrl ? (
            <div className="glass-card" style={{ overflow: 'hidden', marginBottom: '1rem' }}>
              <video
                ref={videoRef}
                controls
                style={{ width: '100%', aspectRatio: '16/9', background: '#000' }}
                src={meetingService.getRecordingUrl(meeting._id)}
              />
            </div>
          ) : (
            <div className="glass-card" style={{
              aspectRatio: '16/9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
            }}>
              <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <HiPlay size={48} style={{ marginBottom: '0.75rem' }} />
                <p>No recording available</p>
              </div>
            </div>
          )}

          {/* AI Processing Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary"
              onClick={handleTranscribe}
              disabled={transcribing || !meeting.recordingUrl}
              style={{ flex: '1 1 140px', cursor: 'pointer' }}
            >
              {transcribing ? (
                <><div className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }} /> Transcribing...</>
              ) : (
                <><HiDocumentText size={16} /> {meeting.transcript?.text ? 'Re-Transcribe' : 'Transcribe'}</>
              )}
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSummarize}
              disabled={summarizing || !meeting.transcript?.text}
              style={{ flex: '1 1 140px', cursor: 'pointer' }}
            >
              {summarizing ? (
                <><div className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }} /> Summarizing...</>
              ) : (
                <><HiLightningBolt size={16} /> {meeting.summary?.summary ? 'Re-Summarize' : 'AI Summarize'}</>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Tabs */}
        <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
          {/* Tab Bar */}
          <div style={{
            display: 'flex',
            gap: '0.25rem',
            marginBottom: '1rem',
            background: 'var(--color-bg-card)',
            padding: '0.25rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            overflowX: 'auto',
          }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: '1 0 auto',
                  padding: '0.625rem 0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-sans)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.25rem',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease',
                  background: activeTab === tab.id ? 'var(--color-accent)' : 'transparent',
                  color: activeTab === tab.id ? 'white' : 'var(--color-text-secondary)',
                }}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>


          {/* Tab Content */}
          <div className="glass-card" style={{
            padding: '1.5rem',
            maxHeight: 'calc(100vh - 350px)',
            overflowY: 'auto',
          }}>
            {/* Summary Tab */}
            {activeTab === 'summary' && (
              <div>
                {meeting.summary?.summary ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-accent-light)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Summary
                      </h3>
                      <p style={{ fontSize: '0.875rem', lineHeight: 1.7, color: 'var(--color-text-primary)' }}>
                        {meeting.summary.summary}
                      </p>
                    </div>

                    {meeting.summary.keyPoints?.length > 0 && (
                      <div>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-accent-light)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Key Points
                        </h3>
                        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {meeting.summary.keyPoints.map((point, i) => (
                            <li key={i} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8125rem', lineHeight: 1.5 }}>
                              <HiChevronRight size={16} style={{ color: 'var(--color-accent)', flexShrink: 0, marginTop: '0.125rem' }} />
                              {point}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {meeting.summary.decisions?.length > 0 && (
                      <div>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-success)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Decisions
                        </h3>
                        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {meeting.summary.decisions.map((decision, i) => (
                            <li key={i} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8125rem', lineHeight: 1.5 }}>
                              <HiCheckCircle size={16} style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: '0.125rem' }} />
                              {decision}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {meeting.summary.nextSteps?.length > 0 && (
                      <div>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-info)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Next Steps
                        </h3>
                        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {meeting.summary.nextSteps.map((step, i) => (
                            <li key={i} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8125rem', lineHeight: 1.5 }}>
                              <HiChevronRight size={16} style={{ color: 'var(--color-info)', flexShrink: 0, marginTop: '0.125rem' }} />
                              {step}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--color-text-muted)' }}>
                    <HiLightningBolt size={36} style={{ marginBottom: '0.75rem' }} />
                    <p style={{ fontSize: '0.875rem' }}>
                      {meeting.transcript?.text
                        ? 'Click "AI Summarize" to generate a summary'
                        : 'Transcribe the recording first, then generate a summary'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Transcript Tab */}
            {activeTab === 'transcript' && (
              <div>
                {meeting.transcript?.segments?.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {meeting.transcript.segments.map((segment, i) => (
                      <div
                        key={i}
                        onClick={() => seekToTimestamp(segment.start)}
                        style={{
                          display: 'flex',
                          gap: '0.75rem',
                          padding: '0.625rem 0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                          background: 'transparent',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg-elevated)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          color: 'var(--color-accent-light)',
                          flexShrink: 0,
                          paddingTop: '0.125rem',
                          minWidth: '3rem',
                        }}>
                          {formatTimestamp(segment.start)}
                        </span>
                        <span style={{ fontSize: '0.8125rem', lineHeight: 1.6 }}>
                          {segment.text}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : meeting.transcript?.text ? (
                  <div style={{ fontSize: '0.8125rem', lineHeight: 1.8 }}>
                    {meeting.transcript.text}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--color-text-muted)' }}>
                    <HiDocumentText size={36} style={{ marginBottom: '0.75rem' }} />
                    <p style={{ fontSize: '0.875rem' }}>No transcript yet. Click "Transcribe" to process the recording.</p>
                  </div>
                )}
              </div>
            )}

            {/* Action Items Tab */}
            {activeTab === 'actions' && (
              <div>
                {meeting.summary?.actionItems?.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {meeting.summary.actionItems.map((item, i) => (
                      <div
                        key={i}
                        onClick={() => handleToggleActionItem(i)}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.75rem',
                          padding: '0.875rem',
                          background: item.completed ? 'rgba(16, 185, 129, 0.08)' : 'var(--color-bg-elevated)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={item.completed}
                          onChange={() => {}}
                          style={{
                            width: '1.125rem',
                            height: '1.125rem',
                            accentColor: 'var(--color-accent)',
                            marginTop: '0.125rem',
                            cursor: 'pointer',
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontWeight: 600,
                            fontSize: '0.8125rem',
                            marginBottom: '0.25rem',
                            textDecoration: item.completed ? 'line-through' : 'none',
                            color: item.completed ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                          }}>
                            {item.task}
                          </div>
                          {item.assignee && (
                            <span className={`badge ${item.completed ? 'badge-success' : 'badge-info'}`} style={{ fontSize: '0.6875rem' }}>
                              {item.assignee}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--color-text-muted)' }}>
                    <HiClipboardList size={36} style={{ marginBottom: '0.75rem' }} />
                    <p style={{ fontSize: '0.875rem' }}>
                      {meeting.summary?.summary
                        ? 'No action items found in this meeting'
                        : 'Generate an AI summary to extract action items'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Ask Meeting AI Tab */}
            {activeTab === 'ask' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '300px' }}>
                <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {qaHistory.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--color-text-muted)' }}>
                      <HiSparkles size={36} style={{ color: 'var(--color-accent-light)', marginBottom: '0.75rem' }} />
                      <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
                        Ask questions about this meeting
                      </p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                        Query Gemini AI on deadlines, decisions, key discussion points, or speaker statements.
                      </p>
                    </div>
                  ) : (
                    qaHistory.map((item, index) => (
                      <div
                        key={index}
                        style={{
                          alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start',
                          maxWidth: '85%',
                          padding: '0.75rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          background: item.role === 'user' ? 'rgba(2, 132, 199, 0.25)' : 'var(--color-bg-elevated)',
                          border: '1px solid var(--color-border)',
                          fontSize: '0.8125rem',
                          lineHeight: 1.6,
                        }}
                      >
                        <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-accent-light)', marginBottom: '0.25rem' }}>
                          {item.role === 'user' ? 'You' : 'Gemini AI'}
                        </div>
                        {item.text}
                      </div>
                    ))
                  )}
                  <div ref={qaEndRef} />
                </div>

                <form onSubmit={handleAskQuestion} style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    className="input"
                    placeholder="e.g. What were the key decisions made?"
                    value={questionInput}
                    onChange={(e) => setQuestionInput(e.target.value)}
                    disabled={asking || (!meeting.transcript?.text && !meeting.summary?.summary)}
                    style={{ fontSize: '0.8125rem' }}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={asking || !questionInput.trim()}
                    style={{ padding: '0.75rem 1rem' }}
                  >
                    {asking ? <div className="spinner" style={{ width: '1.25rem', height: '1.25rem', borderWidth: '2px' }} /> : <HiPaperAirplane size={16} />}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingDetailsPage;
