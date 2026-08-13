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

// Helper function to transcribe audio directly using Gemini API (ultra-fast & multi-language support: Bengali, Hindi, English)
const transcribeAudioWithGemini = async (filePath, originalFilename) => {
  if (!config.geminiApiKey) {
    throw new Error('Gemini API key is not configured in backend');
  }

  const genAI = new GoogleGenerativeAI(config.geminiApiKey);
  const fileBuffer = fs.readFileSync(filePath);
  const base64Audio = fileBuffer.toString('base64');

  const ext = path.extname(originalFilename || filePath).toLowerCase();
  let mimeType = 'audio/webm';
  if (ext === '.wav') mimeType = 'audio/wav';
  else if (ext === '.mp3') mimeType = 'audio/mp3';
  else if (ext === '.m4a' || ext === '.mp4') mimeType = 'audio/mp4';
  else if (ext === '.ogg') mimeType = 'audio/ogg';

  const audioPart = {
    inlineData: {
      data: base64Audio,
      mimeType: mimeType,
    },
  };

  const prompt = `You are a high-accuracy multilingual audio transcription system.
Listen to the audio recording carefully. The audio may contain speech in English, Hindi, Bengali (Bangla), Hinglish, or Banglish (or a mix of these languages).

Instructions:
1. Transcribe the audio accurately verbatim in the spoken languages (use Bengali script for Bengali, Devanagari script for Hindi, and Latin script for English/Hinglish/Banglish).
2. Segment the transcription into timestamped sections based on audio length.

Respond ONLY with valid JSON in this exact format (no markdown, no code fences):
{
  "text": "Full verbatim transcript of the entire audio recording...",
  "segments": [
    {
      "start": 0,
      "end": 10,
      "text": "First segment transcript"
    }
  ],
  "language": "detected primary language code (e.g. en, bn, hi, or mixed)"
}`;

  const candidates = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-1.5-flash',
    'gemini-flash-latest',
    'gemini-pro-latest',
  ];

  let lastError;
  for (const modelName of candidates) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([prompt, audioPart]);
      const responseText = result.response.text();

      const jsonMatch = responseText.match(/{[\s\S]*}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
      return parsed;
    } catch (err) {
      console.warn(`Gemini audio model '${modelName}' failed:`, err.message?.slice(0, 120));
      lastError = err;
    }
  }

  // Fallback simple prompt if JSON parsing / structured format failed
  for (const modelName of candidates) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([
        'Please transcribe this meeting audio verbatim:',
        audioPart,
      ]);
      const text = result.response.text();
      if (text && text.trim()) {
        return {
          text: text.trim(),
          segments: [{ start: 0, end: 60, text: text.trim() }],
          language: 'mixed',
        };
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('All Gemini audio transcription models failed');
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

    let transcriptData = null;

    // Try Python AI service first (with short timeout so response is fast)
    try {
      const fileBuffer = fs.readFileSync(recordingPath);
      const blob = new Blob([fileBuffer]);
      const formData = new FormData();
      formData.append('file', blob, meeting.recordingFilename);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

      const response = await fetch(`${config.aiServiceUrl}/transcribe`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        transcriptData = await response.json();
      } else {
        const errText = await response.text();
        console.warn(`Python AI service status ${response.status}: ${errText.slice(0, 100)}. Falling back to Gemini...`);
      }
    } catch (pyErr) {
      console.warn('Python AI service unreachable/failed, using fast Gemini audio transcription fallback:', pyErr.message);
    }

    // Fallback to Gemini Multimodal Audio Transcription if Python service failed or timed out
    if (!transcriptData || !transcriptData.text) {
      console.log('⚡ Transcribing with Gemini Multimodal Audio API...');
      transcriptData = await transcribeAudioWithGemini(recordingPath, meeting.recordingFilename);
    }

    meeting.transcript = {
      text: transcriptData.text,
      segments: transcriptData.segments || [],
      processedAt: new Date(),
    };
    await meeting.save();

    res.json({
      message: 'Transcription completed successfully',
      transcript: meeting.transcript,
    });
  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({
      message: `Transcription failed: ${error.message || 'Internal server error'}`,
    });
  }
};

// Helper function to call Gemini API with model fallback list
const getAIResponse = async (genAI, prompt) => {
  // Only include model names confirmed working on v1beta generateContent endpoint
  const candidates = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-1.5-flash',
    'gemini-flash-latest',
    'gemini-pro-latest',
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

    const prompt = `You are an expert AI meeting assistant. Analyze the following meeting transcript and produce a clear, structured meeting summary.

CRITICAL MANDATORY INSTRUCTION:
- The transcript may contain speech in English, Bengali (Bangla), Hindi, Hinglish, or Banglish (or a mix of these languages).
- REGARDLESS of the languages spoken in the transcript, you MUST write the ENTIRE summary, title, key points, decisions, and action items STRICTLY IN ENGLISH.
- Translate all ideas, topics, decisions, and action items into clear, high-quality, professional English.

TRANSCRIPT:
${meeting.transcript.text}

Please respond ONLY with valid JSON in this exact format (no markdown, no code fences):
{
  "title": "A concise, descriptive title for this meeting strictly in English",
  "summary": "A comprehensive 2-3 paragraph summary of the meeting discussion strictly in English",
  "keyPoints": ["Key point 1 in English", "Key point 2 in English", "Key point 3 in English"],
  "decisions": ["Decision 1 in English", "Decision 2 in English"],
  "actionItems": [
    {"task": "Action item description in English", "assignee": "Person name or Unassigned", "completed": false}
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

IMPORTANT INSTRUCTIONS:
- The transcript or summary may be in English, Bengali, Hindi, or a mix of languages.
- You MUST ALWAYS write your response STRICTLY IN ENGLISH (unless the user specifically asks for another language). Translate context into English as needed.

MEETING TITLE: ${meeting.title}
MEETING SUMMARY: ${summaryText}

FULL TRANSCRIPT:
${transcriptText}

USER QUESTION:
${question}

Give a clear, helpful response strictly in English. If the information cannot be found in the meeting context, politely state so.`;

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
