import { useState, useEffect } from 'react';
import { standupService } from '../services/standupService';
import {
  HiChartBar, HiCalendar, HiSparkles, HiCheckCircle,
  HiChevronLeft, HiChevronRight,
} from 'react-icons/hi';
import toast from 'react-hot-toast';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

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
      background: `conic-gradient(${color} ${score * 3.6}deg, #e2e8f0 0deg)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '0.6875rem', fontWeight: 700, color,
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute', inset: '3px', borderRadius: '50%',
        background: '#ffffff',
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
        borderRight: '1px solid #f1f5f9',
        textAlign: 'center',
        verticalAlign: 'top',
      }}>
        <div style={{ fontSize: '0.6875rem', color: '#94a3b8', fontStyle: 'italic', padding: '0.25rem' }}>
          No entry
        </div>
      </td>
    );
  }

  return (
    <td style={{
      padding: '0.625rem 0.5rem',
      borderRight: '1px solid #f1f5f9',
      verticalAlign: 'top',
      minWidth: '140px',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        {entry.win && (
          <div style={{ background: '#f0fdf4', padding: '0.35rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#059669', letterSpacing: '0.05em', marginBottom: '0.125rem' }}>🏆 WIN</div>
            <div style={{ fontSize: '0.75rem', color: '#1e293b', lineHeight: 1.3 }}>{entry.win}</div>
          </div>
        )}
        {entry.oneThing && (
          <div style={{ background: '#eff6ff', padding: '0.35rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#2f65f6', letterSpacing: '0.05em', marginBottom: '0.125rem' }}>🎯 ONE THING</div>
            <div style={{ fontSize: '0.75rem', color: '#1e293b', lineHeight: 1.3 }}>{entry.oneThing}</div>
          </div>
        )}
        {entry.challenge && (
          <div style={{ background: '#fffbeb', padding: '0.35rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #fde68a' }}>
            <div style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#d97706', letterSpacing: '0.05em', marginBottom: '0.125rem' }}>⚡ CHALLENGE</div>
            <div style={{ fontSize: '0.75rem', color: '#1e293b', lineHeight: 1.3 }}>{entry.challenge}</div>
          </div>
        )}
        {entry.achievedOneThing === true && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.625rem', color: '#059669', fontWeight: 600, marginTop: '0.125rem' }}>
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

  useEffect(() => {
    loadWeekData(currentWeekStart);
    setAiReport(null);
  }, [currentWeekStart]);

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
    <div className="page-container p-4 sm:p-6 md:p-8" style={{ width: '100%' }}>
      {/* Header */}
      <div className="animate-fade-in" style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <div style={{
              width: '2.75rem', height: '2.75rem', borderRadius: '0.75rem',
              background: '#eef4ff', color: '#2f65f6',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <HiChartBar size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>Weekly Report</h1>
              <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                Team leadership tracker — follow-through & challenge resolution
              </p>
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleGenerateAIReport}
            disabled={generatingReport || !weeklyData.length}
            style={{ gap: '0.5rem', padding: '0.625rem 1.25rem' }}
          >
            {generatingReport
              ? <div className="spinner" style={{ width: '1.125rem', height: '1.125rem', borderWidth: '2px', borderTopColor: '#ffffff' }} />
              : <HiSparkles size={18} />
            }
            AI Leadership Report
          </button>
        </div>

        {/* Week Navigator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button className="btn-icon" onClick={goToPrevWeek} style={{ padding: '0.5rem' }} title="Previous week">
              <HiChevronLeft size={18} />
            </button>
            <div style={{
              padding: '0.5rem 1.25rem', borderRadius: '0.75rem',
              background: '#eef4ff', border: '1px solid #bfdbfe',
              fontSize: '0.875rem', fontWeight: 600, color: '#2f65f6',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <HiCalendar size={16} />
              {formatWeekLabel(currentWeekStart.toISOString())}
              {isCurrentWeek && (
                <span style={{ fontSize: '0.6875rem', background: '#dcfce7', color: '#15803d', padding: '0.125rem 0.5rem', borderRadius: '9999px', fontWeight: 600 }}>
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

          {/* Calendar Date Picker to jump to any week */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
            <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>Jump to date:</span>
            <input
              type="date"
              className="input"
              onChange={(e) => {
                if (e.target.value) {
                  const targetDate = new Date(e.target.value);
                  setCurrentWeekStart(getWeekStart(targetDate));
                }
              }}
              style={{ fontSize: '0.8125rem', padding: '0.4rem 0.75rem', cursor: 'pointer', background: '#ffffff', width: 'auto' }}
              title="Select a date to jump to that week's report"
            />
          </div>
        </div>
      </div>

      {/* AI Report Panel */}
      {aiReport && (
        <div className="vb-card animate-slide-up" style={{
          padding: '1.75rem', marginBottom: '2rem',
          background: '#f8fafc',
          borderColor: '#e2e8f0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <HiSparkles size={20} color="#2f65f6" />
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1e293b' }}>AI Leadership Report</h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: 'auto', fontWeight: 500 }}>Powered by Gemini</span>
          </div>

          {/* Week summary */}
          <div style={{
            padding: '1rem 1.25rem', borderRadius: '0.75rem',
            background: '#eff6ff', borderLeft: '4px solid #2f65f6',
            marginBottom: '1.25rem',
          }}>
            <p style={{ fontSize: '0.875rem', color: '#1e293b', lineHeight: 1.6 }}>
              {aiReport.weekSummary}
            </p>
          </div>

          {/* Per-member cards */}
          {aiReport.members?.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {aiReport.members.map((member, i) => (
                <div key={i} className="vb-card" style={{
                  padding: '1.25rem',
                  background: '#ffffff',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#1e293b' }}>{member.name}</div>
                    {member.score != null && <ScoreCircle score={member.score} />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8125rem', color: '#475569' }}>
                    <div>
                      <span style={{ color: '#2f65f6', fontWeight: 700 }}>Follow-through: </span>
                      {member.followThrough}
                    </div>
                    <div>
                      <span style={{ color: '#d97706', fontWeight: 700 }}>Challenge: </span>
                      {member.challengeProgress}
                    </div>
                    <div style={{ padding: '0.625rem', borderRadius: '0.5rem', background: '#f8fafc', border: '1px solid #e2e8f0', marginTop: '0.25rem' }}>
                      <span style={{ color: '#7c3aed', fontWeight: 700 }}>💡 Coaching: </span>
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
        <div className="vb-card" style={{ padding: '4rem', textAlign: 'center' }}>
          <HiChartBar size={48} style={{ color: '#94a3b8', margin: '0 auto 1rem', display: 'block' }} />
          <h3 style={{ fontWeight: 700, fontSize: '1.125rem', color: '#1e293b', marginBottom: '0.5rem' }}>No standup data for this week</h3>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            Team members need to submit their daily standups to appear here.
          </p>
        </div>
      ) : (
        <div className="vb-card animate-fade-in" style={{ overflow: 'auto', padding: 0 }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse',
            minWidth: '700px',
          }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{
                  padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.75rem',
                  fontWeight: 700, color: '#475569',
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                  width: '180px', position: 'sticky', left: 0,
                  background: '#f8fafc',
                  borderRight: '1px solid #e2e8f0',
                }}>
                  Team Member
                </th>
                {DAY_NAMES.map((day, i) => (
                  <th key={day} style={{
                    padding: '1rem 0.75rem', textAlign: 'center', fontSize: '0.75rem',
                    fontWeight: 700, color: '#475569',
                    letterSpacing: '0.05em', textTransform: 'uppercase',
                    borderRight: i < 4 ? '1px solid #e2e8f0' : 'none',
                  }}>
                    {day}
                  </th>
                ))}
                <th style={{
                  padding: '1rem 0.75rem', textAlign: 'center', fontSize: '0.75rem',
                  fontWeight: 700, color: '#2f65f6',
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                  width: '100px',
                }}>
                  Follow-through
                </th>
              </tr>
            </thead>
            <tbody>
              {weeklyData.map((member, memberIdx) => {
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
                      borderBottom: memberIdx < weeklyData.length - 1 ? '1px solid #f1f5f9' : 'none',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
                  >
                    {/* Member name cell */}
                    <td style={{
                      padding: '1rem 1.5rem',
                      position: 'sticky', left: 0,
                      background: '#ffffff',
                      borderRight: '1px solid #e2e8f0',
                      verticalAlign: 'top',
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1e293b' }}>{member.userName}</div>
                        {member.userEmail && (
                          <div style={{ fontSize: '0.6875rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                            {member.userEmail}
                          </div>
                        )}
                        <div style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                          {Object.keys(member.days).length}/5 days active
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
                          <div style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 600 }}>
                            {followCount}/{possibleCount}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>N/A</span>
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
      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.75rem', color: '#64748b' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#059669', display: 'inline-block' }} />
          🏆 Win — Previous day achievement
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2f65f6', display: 'inline-block' }} />
          🎯 One Thing — Today's focus
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#d97706', display: 'inline-block' }} />
          ⚡ Challenge — Current blocker
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2f65f6', display: 'inline-block' }} />
          Follow-through score (0–100)
        </span>
      </div>
    </div>
  );
};

export default WeeklyReportPage;

