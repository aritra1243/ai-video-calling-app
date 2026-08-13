import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { standupService } from '../services/standupService';
import {
  HiClipboardList, HiCheckCircle, HiSparkles, HiCalendar,
  HiLightningBolt, HiFlag, HiRefresh,
} from 'react-icons/hi';
import toast from 'react-hot-toast';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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
      // refresh history
      const historyRes = await standupService.getMy(4);
      setHistory(historyRes.entries || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save standup');
    } finally {
      setSubmitting(false);
    }
  };

  const isWeekend = today.getUTCDay() === 0 || today.getUTCDay() === 6;

  const inputStyle = {
    width: '100%',
    padding: '0.875rem 1rem',
    background: 'rgba(17, 24, 39, 0.8)',
    border: '1px solid rgba(56, 189, 248, 0.15)',
    borderRadius: '0.75rem',
    color: 'var(--color-text-primary)',
    fontSize: '0.875rem',
    fontFamily: 'var(--font-sans)',
    resize: 'vertical',
    outline: 'none',
    transition: 'all 0.2s ease',
    lineHeight: 1.6,
  };

  const [historyDateFilter, setHistoryDateFilter] = useState('');

  const filteredHistory = history.filter((entry) => {
    if (!historyDateFilter) return true;
    return new Date(entry.date).toISOString().slice(0, 10) === historyDateFilter;
  });

  return (
    <div className="page-container" style={{ maxWidth: '900px' }}>
      {/* Page Header */}
      <div className="animate-fade-in" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div style={{
            width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem',
            background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,182,212,0.15))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <HiClipboardList size={22} color="#10b981" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Daily Standup</h1>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              Share your win, focus, and challenge — {todayLabel}
            </p>
          </div>
        </div>
      </div>

      {/* Weekend notice */}
      {isWeekend && (
        <div className="glass-card" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem', borderColor: 'rgba(245,158,11,0.25)' }}>
          <p style={{ color: '#f59e0b', fontSize: '0.875rem' }}>
            🌴 It's the weekend! Standups are typically for Mon–Fri, but you can still submit if needed.
          </p>
        </div>
      )}

      {/* Today's Standup Form / Submitted View */}
      <div className="glass-card animate-fade-in" style={{ padding: '1.75rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <HiCalendar size={18} style={{ color: '#38bdf8' }} />
            Today's Standup
          </h2>
          {todayEntry && !editMode && (
            <button
              onClick={() => setEditMode(true)}
              className="btn btn-secondary"
              style={{ fontSize: '0.8125rem', padding: '0.5rem 1rem' }}
            >
              <HiRefresh size={14} /> Edit
            </button>
          )}
        </div>

        {todayEntry && !editMode ? (
          /* Submitted view */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justify: 'space-between',
              padding: '0.5rem 0.875rem',
              borderRadius: '0.5rem',
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              fontSize: '0.75rem',
              color: '#38bdf8',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontWeight: 600 }}>
                <HiSparkles size={14} color="#38bdf8" />
                Reflected & Synced from Daily Meeting / Account
              </span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                Auto-updated
              </span>
            </div>

            <div style={{ padding: '0.875rem 1rem 0.875rem 1.25rem', borderRadius: '0.75rem', background: 'rgba(16,185,129,0.08)', borderLeft: '3px solid #10b981' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#10b981', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>🏆 WIN (YESTERDAY)</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
                {todayEntry.win || <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Not filled</span>}
              </div>
            </div>
            <div style={{ padding: '0.875rem 1rem 0.875rem 1.25rem', borderRadius: '0.75rem', background: 'rgba(56,189,248,0.08)', borderLeft: '3px solid #38bdf8' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#38bdf8', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>🎯 ONE THING (TODAY)</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
                {todayEntry.oneThing || <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Not filled</span>}
              </div>
            </div>
            <div style={{ padding: '0.875rem 1rem 0.875rem 1.25rem', borderRadius: '0.75rem', background: 'rgba(245,158,11,0.08)', borderLeft: '3px solid #f59e0b' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#f59e0b', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>⚡ CHALLENGE</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
                {todayEntry.challenge || <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Not filled</span>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', fontSize: '0.8125rem' }}>
              <HiCheckCircle size={16} />
              Saved & Active for Today
            </div>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Win field */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem', color: '#10b981' }}>
                  <HiCheckCircle size={15} />
                  🏆 Win — What did you achieve yesterday?
                </label>
                <textarea
                  rows={2}
                  style={inputStyle}
                  placeholder="e.g. Completed the user auth flow and got sign-off from the team"
                  value={win}
                  onChange={e => setWin(e.target.value)}
                  onFocus={e => { e.target.style.borderColor = '#10b981'; e.target.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(56,189,248,0.15)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>

              {/* One Thing field */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem', color: '#38bdf8' }}>
                  <HiFlag size={15} />
                  🎯 One Thing — What's your single focus for today? <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <textarea
                  rows={2}
                  style={inputStyle}
                  placeholder="e.g. Finish the dashboard standup page and get it reviewed"
                  value={oneThing}
                  onChange={e => setOneThing(e.target.value)}
                  required
                  onFocus={e => { e.target.style.borderColor = '#38bdf8'; e.target.style.boxShadow = '0 0 0 3px rgba(56,189,248,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(56,189,248,0.15)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>

              {/* Challenge field */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem', color: '#f59e0b' }}>
                  <HiLightningBolt size={15} />
                  ⚡ Challenge — What are you currently working through?
                </label>
                <textarea
                  rows={2}
                  style={inputStyle}
                  placeholder="e.g. Struggling with the WebRTC reconnection logic on mobile"
                  value={challenge}
                  onChange={e => setChallenge(e.target.value)}
                  onFocus={e => { e.target.style.borderColor = '#f59e0b'; e.target.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(56,189,248,0.15)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              {editMode && (
                <button type="button" className="btn btn-secondary" onClick={() => setEditMode(false)} style={{ flex: 1 }}>
                  Cancel
                </button>
              )}
              <button type="submit" className="btn btn-primary" disabled={submitting} style={{ flex: 1 }}>
                {submitting
                  ? <div className="spinner" style={{ width: '1.25rem', height: '1.25rem', borderWidth: '2px' }} />
                  : <><HiSparkles size={16} /> {todayEntry ? 'Update Standup' : 'Submit Standup'}</>
                }
              </button>
            </div>
          </form>
        )}
      </div>

      {/* How it works */}
      <div className="glass-card animate-fade-in" style={{ padding: '1.25rem 1.5rem', marginBottom: '2rem', background: 'rgba(2,132,199,0.04)', borderColor: 'rgba(56,189,248,0.12)' }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: '#38bdf8' }}>
          💡 How the Standup System Works
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
          <div><strong style={{ color: 'var(--color-text-primary)' }}>🏆 Win</strong> — Monday's "One Thing" should become Tuesday's "Win"</div>
          <div><strong style={{ color: 'var(--color-text-primary)' }}>🎯 One Thing</strong> — Your single most important focus for today</div>
          <div><strong style={{ color: 'var(--color-text-primary)' }}>⚡ Challenge</strong> — Challenges mentioned Monday should be resolved by Friday</div>
          <div><strong style={{ color: 'var(--color-text-primary)' }}>📊 Weekly Report</strong> — Manager sees a table tracking follow-through per person</div>
        </div>
      </div>

      {/* History */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <HiCalendar size={18} style={{ color: '#38bdf8' }} />
            My Standup History
          </h2>

          {/* Calendar Date Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="date"
              className="input"
              value={historyDateFilter}
              onChange={(e) => setHistoryDateFilter(e.target.value)}
              style={{ fontSize: '0.8125rem', padding: '0.4rem 0.75rem', cursor: 'pointer' }}
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
          <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            {historyDateFilter ? 'No standups found for the selected date.' : 'No standup history yet. Submit your first standup above!'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredHistory.map((entry, i) => (

              <div key={entry._id} className="glass-card animate-fade-in" style={{ padding: '1.125rem 1.5rem', animationDelay: `${i * 0.04}s` }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#38bdf8', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <HiCalendar size={12} />
                  {formatDateLabel(entry.date)}
                  {entry.achievedOneThing === true && (
                    <span style={{ marginLeft: 'auto', fontSize: '0.6875rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '0.125rem 0.5rem', borderRadius: '9999px' }}>
                      ✅ Achieved One Thing
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                  {[
                    { label: '🏆 Win', value: entry.win, color: '#10b981' },
                    { label: '🎯 One Thing', value: entry.oneThing, color: '#38bdf8' },
                    { label: '⚡ Challenge', value: entry.challenge, color: '#f59e0b' },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <div style={{ fontSize: '0.625rem', fontWeight: 700, color, letterSpacing: '0.08em', marginBottom: '0.25rem' }}>{label}</div>
                      <div style={{ fontSize: '0.8125rem', color: value ? 'var(--color-text-secondary)' : 'var(--color-text-muted)', fontStyle: value ? 'normal' : 'italic', lineHeight: 1.4 }}>
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
