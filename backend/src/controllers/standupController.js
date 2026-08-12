const StandupEntry = require('../models/StandupEntry');

// Helper: get Monday of the week for a given date
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// Helper: get day index Mon=0...Fri=4
function getDayOfWeek(date) {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun...6=Sat
  // Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
  return day === 0 ? 6 : day - 1;
}

// Helper: parse a YYYY-MM-DD string as a UTC midnight Date
function parseDateUTC(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// POST /api/standups
// Body: { win, oneThing, challenge, date? } (date defaults to today)
exports.createStandup = async (req, res, next) => {
  try {
    const { win, oneThing, challenge, date } = req.body;

    const targetDate = date ? parseDateUTC(date) : (() => {
      const now = new Date();
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    })();

    const weekStart = getWeekStart(targetDate);
    const dayOfWeek = getDayOfWeek(targetDate);

    // Upsert: update if already exists for this user + date
    const entry = await StandupEntry.findOneAndUpdate(
      { userId: req.user._id, date: targetDate },
      {
        userId: req.user._id,
        userName: req.user.name,
        userEmail: req.user.email,
        date: targetDate,
        weekStart,
        dayOfWeek,
        win: win || '',
        oneThing: oneThing || '',
        challenge: challenge || '',
      },
      { upsert: true, new: true, runValidators: true }
    );

    // After saving, check if yesterday's "one thing" became today's "win"
    if (dayOfWeek > 0 && win) {
      const yesterdayDate = new Date(targetDate);
      yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
      const yesterday = await StandupEntry.findOne({
        userId: req.user._id,
        date: yesterdayDate,
      });
      if (yesterday && yesterday.oneThing) {
        // Simple heuristic: if win text contains key words from yesterday's oneThing
        const achievedOneThing = win.toLowerCase().includes(
          yesterday.oneThing.toLowerCase().substring(0, 20)
        ) || yesterday.oneThing.toLowerCase().includes(
          win.toLowerCase().substring(0, 20)
        );
        await StandupEntry.findByIdAndUpdate(entry._id, { achievedOneThing });
        entry.achievedOneThing = achievedOneThing;
      }
    }

    res.status(201).json({ message: 'Standup saved', entry });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Standup already exists for this date. Use PUT to update.' });
    }
    next(error);
  }
};

// GET /api/standups/my?weeks=2
// Returns current user's standup entries (last N weeks)
exports.getMyStandups = async (req, res, next) => {
  try {
    const weeks = Math.min(parseInt(req.query.weeks) || 4, 12);
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - weeks * 7);
    since.setUTCHours(0, 0, 0, 0);

    const entries = await StandupEntry.find({
      userId: req.user._id,
      date: { $gte: since },
    }).sort({ date: -1 });

    res.json({ entries });
  } catch (error) {
    next(error);
  }
};

// GET /api/standups/weekly?weekStart=YYYY-MM-DD
// Returns all team members' entries for a given week
exports.getWeeklyStandups = async (req, res, next) => {
  try {
    let weekStart;
    if (req.query.weekStart) {
      weekStart = parseDateUTC(req.query.weekStart);
    } else {
      weekStart = getWeekStart(new Date());
    }

    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

    const entries = await StandupEntry.find({
      date: { $gte: weekStart, $lt: weekEnd },
    }).sort({ date: 1, userName: 1 });

    // Group by user, then by day
    const byUser = {};
    for (const entry of entries) {
      const uid = entry.userId.toString();
      if (!byUser[uid]) {
        byUser[uid] = {
          userId: uid,
          userName: entry.userName,
          userEmail: entry.userEmail,
          days: {},
        };
      }
      byUser[uid].days[entry.dayOfWeek] = entry;
    }

    const weeklyData = Object.values(byUser);

    res.json({
      weekStart: weekStart.toISOString(),
      weeklyData,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/standups/daily?date=YYYY-MM-DD
// Returns all team entries for a specific day
exports.getDailyStandups = async (req, res, next) => {
  try {
    let targetDate;
    if (req.query.date) {
      targetDate = parseDateUTC(req.query.date);
    } else {
      const now = new Date();
      targetDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    }

    const entries = await StandupEntry.find({ date: targetDate }).sort({ userName: 1 });
    res.json({ date: targetDate.toISOString(), entries });
  } catch (error) {
    next(error);
  }
};

// GET /api/standups/today
// Returns current user's standup for today
exports.getTodayStandup = async (req, res, next) => {
  try {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const entry = await StandupEntry.findOne({ userId: req.user._id, date: today });
    res.json({ entry: entry || null });
  } catch (error) {
    next(error);
  }
};

// GET /api/standups/available-weeks
// Returns a list of weekStart dates that have data
exports.getAvailableWeeks = async (req, res, next) => {
  try {
    const weeks = await StandupEntry.distinct('weekStart');
    weeks.sort((a, b) => new Date(b) - new Date(a));
    res.json({ weeks });
  } catch (error) {
    next(error);
  }
};
