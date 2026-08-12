import { useState, useEffect } from 'react';
import { standupService } from '../services/standupService';
import {
  HiChartBar, HiCalendar, HiSparkles, HiCheckCircle,
  HiXCircle, HiRefresh, HiDownload, HiChevronLeft, HiChevronRight,
} from 'react-icons/hi';
import toast from 'react-hot-toast';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function formatWeekLabel(isoString) {
  const start = new Date(isoString);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 4);
  const opts = { month: 'short', day: 'numeric', timeZone: 'UTC' };
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}, ${start.getUTCFullYear()}`;
}

function toDateStr(isoString) {
  const d = new Date(isoString);
  return d.toISOString().slice(0, 10);
}

const ScoreCircle = ({ score }) => {
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{
      width: '2.5rem', height: '2.5rem', borderRadius: '50%',
      background: `conic-gradient(${color} ${score * 3.6}deg, rgba(255,255,255,0.05) 0deg)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '0.6875rem', fontWeight: 700, color,
      boxShadow: `0 0 12px ${color}40`,
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute', inset: '4px', borderRadius: '50%',
        background: 'var(--color-bg-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.6875rem', fontWeight: 700, color,
      }}>
        {score}
      </div>
    </div>
  );
};

const DayCell = ({ entry }) => {
  if (!entry) {
    return (
      <td style={{
        padding: '0.75rem 0.5rem',
        borderRight: '1px solid rgba(56,189,248,0.06)',
        textAlign: 'center',
        verticalAlign: 'top',
      }}>
        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '0.25rem' }}>
          No entry
        </div>
      </td>
    );
  }

  return (
    <td style={{
      padding: '0.625rem 0.5rem',
      borderRight: '1px solid rgba(56,189,248,0.06)',
      verticalAlign: 'top',
      minWidth: '140px',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        {entry.win && (
          <div>
            <div style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#10b981', letterSpacing: '0.08em', marginBottom: '0.125rem' }}>🏆 WIN</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>{entry.win}</div>
          </div>
        )}
        {entry.oneThing && (
          <div>
            <div style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#38bdf8', letterSpacing: '0.08em', marginBottom: '0.125rem' }}>🎯 ONE THING</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>{entry.oneThing}</div>
          </div>
        )}
        {entry.challenge && (
          <div>
            <div style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#f59e0b', letterSpacing: '0.08em', marginBottom: '0.125rem' }}>⚡ CHALLENGE</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>{entry.challenge}</div>
          </div>
        )}
        {entry.achievedOneThing === true && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.625rem', color: '#10b981', marginTop: '0.125rem' }}>
            <HiCheckCircle size={11} /> Followed through
          </div>
        )}
      </div>
    </td>
  );
};

const WeeklyReportPage = () => {
  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStart());
  const [weeklyData, setWeeklyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiReport, setAiReport] = useState(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [availableWeeks, setAvailableWeeks] = useState([]);

  useEffect(() => {
    loadWeekData(currentWeekStart);
    loadAvailableWeeks();
  }, []);

  useEffect(() => {
    loadWeekData(currentWeekStart);
    setAiReport(null); // reset AI report on week change
  }, [currentWeekStart]);

  const loadAvailableWeeks = async () => {
    try {
      const res = await standupService.getAvailableWeeks();
      setAvailableWeeks(res.weeks || []);
    } catch {
      // ignore
    }
  };

  const loadWeekData = async (weekStart) => {
    setLoading(true);
    try {
      const weekStr = toDateStr(weekStart.toISOString());
      const res = await standupService.getWeekly(weekStr);
      setWeeklyData(res.weeklyData || []);
    } catch {
      toast.error('Failed to load weekly data');
    } finally {
      setLoading(false);
    }
  };

  const goToPrevWeek = () => {
    const prev = new Date(currentWeekStart);
    prev.setUTCDate(prev.getUTCDate() - 7);
    setCurrentWeekStart(prev);
  };

  const goToNextWeek = () => {
    const next = new Date(currentWeekStart);
    next.setUTCDate(next.getUTCDate() + 7);
    const thisWeek = getWeekStart();
    if (next <= thisWeek) setCurrentWeekStart(next);
  };

  const isCurrentWeek = toDateStr(currentWeekStart.toISOString()) === toDateStr(getWeekStart().toISOString());

  const handleGenerateAIReport = async () => {
    if (!weeklyData.length) {
      toast.error('No standup data this week to generate a report');
      return;
    }
    setGeneratingReport(true);
    try {
      toast.loading('Generating AI leadership report...', { id: 'report' });
      const weekStr = toDateStr(currentWeekStart.toISOString());
      const res = await standupService.generateWeeklyReport(weekStr, weeklyData);
      setAiReport(res.report);
      toast.success('AI Report generated!', { id: 'report' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Report generation failed', { id: 'report' });
    } finally {
      setGeneratingReport(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div className="animate-fade-in" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem',
              background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(59,130,246,0.15))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <HiChartBar size={22} color="#a78bfa" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Weekly Report</h1>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                Team leadership tracker — follow-through & challenge resolution
              </p>
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleGenerateAIReport}
            disabled={generatingReport || !weeklyData.length}
            style={{ gap: '0.5rem' }}
          >
            {generatingReport
              ? <div className="spinner" style={{ width: '1.125rem', height: '1.125rem', borderWidth: '2px' }} />
              : <HiSparkles size={16} />
            }
            AI Leadership Report
          </button>
        </div>

        {/* Week Navigator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
          <button className="btn-icon" onClick={goToPrevWeek} style={{ padding: '0.5rem' }} title="Previous week">
            <HiChevronLeft size={18} />
          </button>
          <div style={{
            padding: '0.5rem 1.25rem', borderRadius: '0.75rem',
            background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)',
            fontSize: '0.875rem', fontWeight: 600, color: '#38bdf8',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}>
            <HiCalendar size={14} />
            {formatWeekLabel(currentWeekStart.toISOString())}
            {isCurrentWeek && (
              <span style={{ fontSize: '0.6875rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '0.125rem 0.5rem', borderRadius: '9999px' }}>
                This Week
              </span>
            )}
          </div>
          <button
            className="btn-icon"
            onClick={goToNextWeek}
            disabled={isCurrentWeek}
            style={{ padding: '0.5rem', opacity: isCurrentWeek ? 0.3 : 1 }}
            title="Next week"
          >
            <HiChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* AI Report Panel */}
      {aiReport && (
        <div className="glass-card animate-slide-up" style={{
          padding: '1.75rem', marginBottom: '2rem',
          background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(59,130,246,0.05))',
          borderColor: 'rgba(167,139,250,0.25)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <HiSparkles size={18} color="#a78bfa" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#a78bfa' }}>AI Leadership Report</h3>
            <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>Powered by Gemini</span>
          </div>

          {/* Week summary */}
          <div style={{
            padding: '0.875rem 1.25rem', borderRadius: '0.75rem',
            background: 'rgba(167,139,250,0.08)', borderLeft: '3px solid #a78bfa',
            marginBottom: '1.25rem',
          }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              {aiReport.weekSummary}
            </p>
          </div>

          {/* Per-member cards */}
          {aiReport.members?.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {aiReport.members.map((member, i) => (
                <div key={i} style={{
                  padding: '1.125rem', borderRadius: '0.75rem',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{member.name}</div>
                    {member.score != null && <ScoreCircle score={member.score} />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                    <div>
                      <span style={{ color: '#38bdf8', fontWeight: 600 }}>Follow-through: </span>
                      {member.followThrough}
                    </div>
                    <div>
                      <span style={{ color: '#f59e0b', fontWeight: 600 }}>Challenge: </span>
                      {member.challengeProgress}
                    </div>
                    <div style={{ padding: '0.625rem', borderRadius: '0.5rem', background: 'rgba(167,139,250,0.08)', marginTop: '0.25rem' }}>
                      <span style={{ color: '#a78bfa', fontWeight: 600 }}>💡 Coaching: </span>
                      {member.coaching}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Weekly Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <div className="spinner" />
        </div>
      ) : weeklyData.length === 0 ? (
        <div className="glass-card" style={{ padding: '4rem', textAlign: 'center' }}>
          <HiChartBar size={48} style={{ color: 'var(--color-text-muted)', margin: '0 auto 1rem', display: 'block' }} />
          <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>No standup data for this week</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            Team members need to submit their daily standups to appear here.
          </p>
        </div>
      ) : (
        <div className="glass-card animate-fade-in" style={{ overflow: 'auto' }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse',
            minWidth: '700px',
          }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(56,189,248,0.12)' }}>
                <th style={{
                  padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem',
                  fontWeight: 700, color: 'var(--color-text-secondary)',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  width: '160px', position: 'sticky', left: 0,
                  background: 'linear-gradient(135deg, rgba(26,26,46,0.95), rgba(34,34,64,0.95))',
                  borderRight: '1px solid rgba(56,189,248,0.1)',
                }}>
                  Team Member
                </th>
                {DAY_NAMES.map((day, i) => (
                  <th key={day} style={{
                    padding: '1rem 0.75rem', textAlign: 'center', fontSize: '0.75rem',
                    fontWeight: 700, color: 'var(--color-text-secondary)',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    borderRight: i < 4 ? '1px solid rgba(56,189,248,0.06)' : 'none',
                  }}>
                    {day}
                  </th>
                ))}
                <th style={{
                  padding: '1rem 0.75rem', textAlign: 'center', fontSize: '0.75rem',
                  fontWeight: 700, color: '#a78bfa',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  width: '80px',
                }}>
                  Follow-through
                </th>
              </tr>
            </thead>
            <tbody>
              {weeklyData.map((member, memberIdx) => {
                // Calculate follow-through: how many days did oneThing become next-day win?
                let followCount = 0;
                let possibleCount = 0;
                for (let d = 0; d <= 3; d++) {
                  const today = member.days[d];
                  const tomorrow = member.days[d + 1];
                  if (today?.oneThing && tomorrow) {
                    possibleCount++;
                    if (tomorrow.achievedOneThing === true || (tomorrow.win && today.oneThing &&
                      tomorrow.win.toLowerCase().includes(today.oneThing.toLowerCase().substring(0, 15)))) {
                      followCount++;
                    }
                  }
                }
                const followRate = possibleCount > 0 ? Math.round((followCount / possibleCount) * 100) : null;

                return (
                  <tr
                    key={member.userId}
                    style={{
                      borderBottom: memberIdx < weeklyData.length - 1 ? '1px solid rgba(56,189,248,0.06)' : 'none',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(56,189,248,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Member name cell */}
                    <td style={{
                      padding: '1rem 1.5rem',
                      position: 'sticky', left: 0,
                      background: 'linear-gradient(135deg, rgba(26,26,46,0.98), rgba(34,34,64,0.98))',
                      borderRight: '1px solid rgba(56,189,248,0.1)',
                      verticalAlign: 'top',
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{member.userName}</div>
                        {member.userEmail && (
                          <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                            {member.userEmail}
                          </div>
                        )}
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                          {Object.keys(member.days).length}/5 days
                        </div>
                      </div>
                    </td>

                    {/* Day cells Mon–Fri */}
                    {[0, 1, 2, 3, 4].map(dayIdx => (
                      <DayCell key={dayIdx} entry={member.days[dayIdx] || null} />
                    ))}

                    {/* Follow-through rate */}
                    <td style={{ padding: '1rem 0.75rem', textAlign: 'center', verticalAlign: 'top' }}>
                      {followRate !== null ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                          <ScoreCircle score={followRate} />
                          <div style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)' }}>
                            {followCount}/{possibleCount}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>N/A</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          🏆 Win — Previous day achievement
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }} />
          🎯 One Thing — Today's focus
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
          ⚡ Challenge — Current blocker
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#a78bfa', display: 'inline-block' }} />
          Follow-through score (0–100)
        </span>
      </div>
    </div>
  );
};

export default WeeklyReportPage;
