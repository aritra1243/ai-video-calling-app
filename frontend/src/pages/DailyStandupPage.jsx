import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { standupService } from '../services/standupService';
import {
  HiClipboardList, HiCheckCircle, HiSparkles, HiCalendar,
  HiLightningBolt, HiFlag, HiRefresh,
} from 'react-icons/hi';
import toast from 'react-hot-toast';

function getTodayUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function formatDateLabel(isoString) {
  return new Date(isoString).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}

const DailyStandupPage = () => {
  const { user } = useAuth();
  const [win, setWin] = useState('');
  const [oneThing, setOneThing] = useState('');
  const [challenge, setChallenge] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [todayEntry, setTodayEntry] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  const today = getTodayUTC();
  const todayLabel = formatDateLabel(today.toISOString());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [todayRes, historyRes] = await Promise.all([
        standupService.getToday(),
        standupService.getMy(4),
      ]);
      setTodayEntry(todayRes.entry);
      if (todayRes.entry) {
        setWin(todayRes.entry.win || '');
        setOneThing(todayRes.entry.oneThing || '');
        setChallenge(todayRes.entry.challenge || '');
      }
      setHistory(historyRes.entries || []);
    } catch {
      toast.error('Failed to load standup data');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!oneThing.trim()) {
      toast.error('Please fill in your "One Thing" for today');
      return;
    }
    setSubmitting(true);
    try {
      const res = await standupService.submit({ win, oneThing, challenge });
      setTodayEntry(res.entry);
      setEditMode(false);
      toast.success('Standup saved! 🎯');
      const historyRes = await standupService.getMy(4);
      setHistory(historyRes.entries || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save standup');
    } finally {
      setSubmitting(false);
    }
  };

  const isWeekend = today.getUTCDay() === 0 || today.getUTCDay() === 6;

  const [historyDateFilter, setHistoryDateFilter] = useState('');

  const filteredHistory = history.filter((entry) => {
    if (!historyDateFilter) return true;
    return new Date(entry.date).toISOString().slice(0, 10) === historyDateFilter;
  });

  return (
    <div className="page-container p-4 sm:p-6 md:p-8" style={{ maxWidth: '960px', width: '100%' }}>
      {/* Page Header */}
      <div className="animate-fade-in" style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <div style={{
            width: '2.75rem',
            height: '2.75rem',
            borderRadius: '0.75rem',
            background: '#eef4ff',
            color: '#2f65f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <HiClipboardList size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>Daily Standup</h1>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
              Share your win, focus, and challenge — {todayLabel}
            </p>
          </div>
        </div>
      </div>

      {/* Weekend notice */}
      {isWeekend && (
        <div className="vb-card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', background: '#fffbeb', borderColor: '#fde68a' }}>
          <p style={{ color: '#b45309', fontSize: '0.875rem', fontWeight: 500 }}>
            🌴 It's the weekend! Standups are typically for Mon–Fri, but you can still submit if needed.
          </p>
        </div>
      )}

      {/* Today's Standup Form / Submitted View */}
      <div className="vb-card animate-fade-in" style={{ padding: '1.75rem', marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e293b' }}>
            <HiCalendar size={20} style={{ color: '#2f65f6' }} />
            Today's Standup
          </h2>
          {todayEntry && !editMode && (
            <button
              onClick={() => setEditMode(true)}
              className="btn btn-secondary"
              style={{ fontSize: '0.8125rem', padding: '0.4rem 0.875rem' }}
            >
              <HiRefresh size={14} /> Edit Standup
            </button>
          )}
        </div>

        {todayEntry && !editMode ? (
          /* Submitted view */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.625rem 1rem',
              borderRadius: '0.625rem',
              background: '#eef4ff',
              border: '1px solid #bfdbfe',
              fontSize: '0.8125rem',
              color: '#2f65f6',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <HiSparkles size={16} />
                Reflected & Synced from Daily Meeting / Account
              </span>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Auto-updated
              </span>
            </div>

            <div style={{ padding: '1rem 1.25rem', borderRadius: '0.75rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>🏆 WIN (YESTERDAY)</div>
              <div style={{ fontSize: '0.9375rem', color: '#1e293b', lineHeight: 1.5 }}>
                {todayEntry.win || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Not filled</span>}
              </div>
            </div>

            <div style={{ padding: '1rem 1.25rem', borderRadius: '0.75rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderLeft: '4px solid #2f65f6' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2f65f6', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>🎯 ONE THING (TODAY)</div>
              <div style={{ fontSize: '0.9375rem', color: '#1e293b', lineHeight: 1.5 }}>
                {todayEntry.oneThing || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Not filled</span>}
              </div>
            </div>

            <div style={{ padding: '1rem 1.25rem', borderRadius: '0.75rem', background: '#fffbeb', border: '1px solid #fde68a', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#d97706', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>⚡ CHALLENGE</div>
              <div style={{ fontSize: '0.9375rem', color: '#1e293b', lineHeight: 1.5 }}>
                {todayEntry.challenge || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Not filled</span>}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#059669', fontSize: '0.875rem', fontWeight: 600, marginTop: '0.25rem' }}>
              <HiCheckCircle size={18} />
              Saved & Active for Today
            </div>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Win field */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.5rem', color: '#059669' }}>
                  <HiCheckCircle size={17} />
                  🏆 Win — What did you achieve yesterday?
                </label>
                <textarea
                  rows={3}
                  className="input"
                  style={{
                    padding: '0.75rem 1rem',
                    background: '#ffffff',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '0.625rem',
                    color: '#1e293b',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                    lineHeight: 1.5,
                  }}
                  placeholder="e.g. Completed the user auth flow and got sign-off from the team"
                  value={win}
                  onChange={e => setWin(e.target.value)}
                />
              </div>

              {/* One Thing field */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.5rem', color: '#2f65f6' }}>
                  <HiFlag size={17} />
                  🎯 One Thing — What's your single focus for today? <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  rows={3}
                  className="input"
                  style={{
                    padding: '0.75rem 1rem',
                    background: '#ffffff',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '0.625rem',
                    color: '#1e293b',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                    lineHeight: 1.5,
                  }}
                  placeholder="e.g. Finish the dashboard standup page and get it reviewed"
                  value={oneThing}
                  onChange={e => setOneThing(e.target.value)}
                  required
                />
              </div>

              {/* Challenge field */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.5rem', color: '#d97706' }}>
                  <HiLightningBolt size={17} />
                  ⚡ Challenge — What are you currently working through?
                </label>
                <textarea
                  rows={3}
                  className="input"
                  style={{
                    padding: '0.75rem 1rem',
                    background: '#ffffff',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '0.625rem',
                    color: '#1e293b',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                    lineHeight: 1.5,
                  }}
                  placeholder="e.g. Struggling with the WebRTC reconnection logic on mobile"
                  value={challenge}
                  onChange={e => setChallenge(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              {editMode && (
                <button type="button" className="btn btn-secondary" onClick={() => setEditMode(false)} style={{ flex: 1 }}>
                  Cancel
                </button>
              )}
              <button type="submit" className="btn btn-primary" disabled={submitting} style={{ flex: 1, padding: '0.75rem' }}>
                {submitting
                  ? <div className="spinner" style={{ width: '1.25rem', height: '1.25rem', borderWidth: '2px', borderTopColor: '#ffffff' }} />
                  : <><HiSparkles size={16} /> {todayEntry ? 'Update Standup' : 'Submit Standup'}</>
                }
              </button>
            </div>
          </form>
        )}
      </div>

      {/* How it works banner */}
      <div className="vb-card animate-fade-in" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.75rem', background: '#f8fafc', borderColor: '#e2e8f0' }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem', color: '#2f65f6' }}>
          💡 How the Standup System Works
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.875rem', fontSize: '0.8125rem', color: '#475569' }}>
          <div><strong style={{ color: '#059669' }}>🏆 Win</strong> — Monday's "One Thing" should become Tuesday's "Win"</div>
          <div><strong style={{ color: '#2f65f6' }}>🎯 One Thing</strong> — Your single most important focus for today</div>
          <div><strong style={{ color: '#d97706' }}>⚡ Challenge</strong> — Challenges mentioned Monday should be resolved by Friday</div>
          <div><strong style={{ color: '#1e293b' }}>📊 Weekly Report</strong> — Manager sees a table tracking follow-through per person</div>
        </div>
      </div>

      {/* History section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e293b' }}>
            <HiCalendar size={20} style={{ color: '#2f65f6' }} />
            My Standup History
          </h2>

          {/* Calendar Date Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="date"
              className="input"
              value={historyDateFilter}
              onChange={(e) => setHistoryDateFilter(e.target.value)}
              style={{ fontSize: '0.8125rem', padding: '0.4rem 0.75rem', cursor: 'pointer', background: '#ffffff', width: 'auto' }}
              title="Search standups by date"
            />
            {historyDateFilter && (
              <button
                className="btn btn-secondary"
                onClick={() => setHistoryDateFilter('')}
                style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', whiteSpace: 'nowrap' }}
              >
                Clear Date
              </button>
            )}
          </div>
        </div>

        {historyLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <div className="spinner" />
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="vb-card" style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
            {historyDateFilter ? 'No standups found for the selected date.' : 'No standup history yet. Submit your first standup above!'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {filteredHistory.map((entry, i) => (
              <div key={entry._id} className="vb-card animate-fade-in" style={{ padding: '1.25rem 1.5rem', animationDelay: `${i * 0.04}s` }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#2f65f6', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <HiCalendar size={14} />
                  {formatDateLabel(entry.date)}
                  {entry.achievedOneThing === true && (
                    <span style={{ marginLeft: 'auto', fontSize: '0.6875rem', background: '#f0fdf4', color: '#059669', border: '1px solid #bbf7d0', padding: '0.125rem 0.625rem', borderRadius: '9999px', fontWeight: 600 }}>
                      ✅ Achieved One Thing
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  {[
                    { label: '🏆 Win', value: entry.win, color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
                    { label: '🎯 One Thing', value: entry.oneThing, color: '#2f65f6', bg: '#eff6ff', border: '#bfdbfe' },
                    { label: '⚡ Challenge', value: entry.challenge, color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
                  ].map(({ label, value, color, bg, border }) => (
                    <div key={label} style={{ padding: '0.75rem', borderRadius: '0.5rem', background: bg, border: `1px solid ${border}` }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color, letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{label}</div>
                      <div style={{ fontSize: '0.8125rem', color: value ? '#1e293b' : '#94a3b8', fontStyle: value ? 'normal' : 'italic', lineHeight: 1.4 }}>
                        {value || 'Not filled'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyStandupPage;

