# AI Video Calling & Meeting Summarisation

A full-stack AI-powered video conferencing platform with real-time video calling, meeting recording, transcription, and AI-powered meeting summarisation.

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS v4
- **Backend**: Node.js + Express + Socket.IO + MongoDB
- **AI Service**: Python + FastAPI + faster-whisper + Gemini API
- **Video**: WebRTC (peer-to-peer)

## Setup

### Prerequisites
- Node.js 18+
- Python 3.10+
- MongoDB (local or Atlas)
- FFmpeg

### Backend
```bash
cd backend
npm install
cp .env.example .env  # Edit with your values
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### AI Service
```bash
cd backend/ai-service
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Architecture

```
Frontend (React) ←→ Backend (Express + Socket.IO) ←→ MongoDB
                         ↕
                    WebRTC (P2P)
                         ↕
               AI Service (FastAPI)
               ├── FFmpeg (audio)
               ├── Whisper (transcript)
               └── Gemini (summary)
```
