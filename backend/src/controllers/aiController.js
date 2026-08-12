const mongoose = require('mongoose');
const Meeting = require('../models/Meeting');
const StandupEntry = require('../models/StandupEntry');
const config = require('../config/config');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const fs = require('fs');

// Helper to query meeting by ObjectId _id or string roomId safely without Mongoose CastError
const getMeetingQuery = (id) => {
  if (mongoose.Types.ObjectId.isValid(id)) {
    return { $or: [{ _id: id }, { roomId: id }] };
  }
  return { roomId: id };
};

// POST /api/meetings/:id/transcribe
exports.transcribe = async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne(getMeetingQuery(req.params.id));

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    if (!meeting.recordingFilename) {
      return res.status(400).json({ message: 'No recording found for this meeting' });
    }

    const recordingPath = path.join(__dirname, '../../storage/recordings', meeting.recordingFilename);
    if (!fs.existsSync(recordingPath)) {
      return res.status(404).json({ message: 'Recording file not found on disk' });
    }

    // Call Python AI service for transcription
    // Use native fetch + File API (Node 18+)
    const fileBuffer = fs.readFileSync(recordingPath);
    const blob = new Blob([fileBuffer]);
    const formData = new FormData();
    formData.append('file', blob, meeting.recordingFilename);

    const response = await fetch(`${config.aiServiceUrl}/transcribe`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json({ message: `Transcription failed: ${errorText}` });
    }

    const transcriptData = await response.json();

    meeting.transcript = {
      text: transcriptData.text,
      segments: transcriptData.segments || [],
      processedAt: new Date(),
    };
    await meeting.save();

    res.json({
      message: 'Transcription completed',
      transcript: meeting.transcript,
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to call Gemini API with model fallback list
const getAIResponse = async (genAI, prompt) => {
  // Only include model names confirmed working on v1beta generateContent endpoint
  const candidates = [
    'gemini-flash-latest',
    'gemini-pro-latest',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',    // older 2.5 alias some keys still resolve
  ];
  let lastError;
  for (const modelName of candidates) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return result;
    } catch (err) {
      console.warn(`Gemini model '${modelName}' failed:`, err.message?.slice(0, 120));
      lastError = err;
    }
  }
  throw lastError || new Error('All Gemini model candidates failed');
};

// POST /api/meetings/:id/summarize
exports.summarize = async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne(getMeetingQuery(req.params.id));

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    if (!meeting.transcript || !meeting.transcript.text) {
      return res.status(400).json({ message: 'No transcript found. Please transcribe first.' });
    }

    if (!config.geminiApiKey) {
      return res.status(500).json({ message: 'Gemini API key not configured' });
    }

    const genAI = new GoogleGenerativeAI(config.geminiApiKey);

    const prompt = `You are a professional meeting assistant. Analyze the following meeting transcript and provide a structured summary.

TRANSCRIPT:
${meeting.transcript.text}

Please respond ONLY with valid JSON in this exact format (no markdown, no code fences):
{
  "title": "A concise, descriptive title for this meeting",
  "summary": "A comprehensive 2-3 paragraph summary of the meeting discussion",
  "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
  "decisions": ["Decision 1", "Decision 2"],
  "actionItems": [
    {"task": "Action item description", "assignee": "Person name or Unassigned", "completed": false}
  ]
}`;

    const result = await getAIResponse(genAI, prompt);
    const responseText = result.response.text();

    let summaryData;
    try {
      const jsonMatch = responseText.match(/{[\s\S]*}/);
      summaryData = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    } catch (parseError) {
      summaryData = {
        title: meeting.title,
        summary: responseText,
        keyPoints: [],
        decisions: [],
        actionItems: [],
      };
    }

    meeting.summary = {
      summary: summaryData.summary || responseText,
      keyPoints: summaryData.keyPoints || [],
      decisions: summaryData.decisions || [],
      actionItems: summaryData.actionItems || [],
      generatedAt: new Date(),
    };
    if (summaryData.title) {
      meeting.title = summaryData.title;
    }
    await meeting.save();

    res.json({
      message: 'Summary generated successfully',
      summary: meeting.summary,
      title: meeting.title,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/meetings/:id/transcript
exports.getTranscript = async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne(getMeetingQuery(req.params.id));

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    res.json({ transcript: meeting.transcript || null });
  } catch (error) {
    next(error);
  }
};

// GET /api/meetings/:id/summary
exports.getSummary = async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne(getMeetingQuery(req.params.id));

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    res.json({ summary: meeting.summary || null });
  } catch (error) {
    next(error);
  }
};

// POST /api/meetings/:id/ask
exports.askMeeting = async (req, res, next) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ message: 'Question is required' });
    }

    const meeting = await Meeting.findOne(getMeetingQuery(req.params.id));

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    const transcriptText = meeting.transcript?.text || 'No transcript available.';
    const summaryText = meeting.summary?.summary || 'No summary available.';

    if (!config.geminiApiKey) {
      return res.status(500).json({ message: 'Gemini API key not configured' });
    }

    const genAI = new GoogleGenerativeAI(config.geminiApiKey);

    const prompt = `You are an AI Meeting Assistant answering questions about a recorded meeting.
Answer the user's question accurately, concisely, and professionally based strictly on the provided context below.

MEETING TITLE: ${meeting.title}
MEETING SUMMARY: ${summaryText}

FULL TRANSCRIPT:
${transcriptText}

USER QUESTION:
${question}

Give a clear, helpful response. If the information cannot be found in the meeting context, politely state so.`;

    const result = await getAIResponse(genAI, prompt);
    const answer = result.response.text();

    res.json({
      question,
      answer,
    });
  } catch (error) {
    next(error);
  }
};


// POST /api/ai/standup-report
// Body: { weekStart: 'YYYY-MM-DD', weeklyData: [...] }
exports.weeklyStandupReport = async (req, res, next) => {
  try {
    const { weekStart, weeklyData } = req.body;
    if (!weeklyData || !weeklyData.length) {
      return res.status(400).json({ message: 'No standup data provided' });
    }
    if (!config.geminiApiKey) {
      return res.status(500).json({ message: 'Gemini API key not configured' });
    }

    const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const lines = [];
    weeklyData.forEach(member => {
      lines.push('== ' + member.userName + ' ==');
      DAY_NAMES.forEach((day, idx) => {
        const entry = member.days[idx];
        if (!entry) {
          lines.push('  ' + day + ': (No entry)');
        } else {
          lines.push('  ' + day + ':');
          lines.push('    Win: ' + (entry.win || '-'));
          lines.push('    One Thing: ' + (entry.oneThing || '-'));
          lines.push('    Challenge: ' + (entry.challenge || '-'));
        }
      });
      lines.push('');
    });
    const standupText = lines.join('\n');

    const promptParts = [
      'You are a leadership coach reviewing a team daily standup for the week of ' + weekStart + '.',
      '',
      'For each member evaluate:',
      '1. Did their One Thing become next day Win? (follow-through)',
      '2. Was their Challenge resolved by week end?',
      '3. Brief coaching advice',
      '',
      'STANDUP DATA:',
      standupText,
      '',
      'Respond ONLY with valid JSON (no markdown):',
      '{',
      '  "weekSummary": "2-3 sentence team overview",',
      '  "members": [{"name": "name", "followThrough": "assessment", "challengeProgress": "assessment", "coaching": "tip", "score": 85}]',
      '}',
      '',
      'Score 0-100 = follow-through + consistency + growth.',
    ];
    const prompt = promptParts.join('\n');

    const genAI = new GoogleGenerativeAI(config.geminiApiKey);
    const result = await getAIResponse(genAI, prompt);
    const responseText = result.response.text();

    let reportData;
    try {
      const jsonMatch = responseText.match(/{[\s\S]*}/);
      reportData = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    } catch (parseError) {
      console.error('Failed to parse Gemini report:', responseText);
      reportData = { weekSummary: responseText, members: [] };
    }

    res.json({ report: reportData });
  } catch (error) {
    next(error);
  }
};
