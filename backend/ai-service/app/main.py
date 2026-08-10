import os
import tempfile
import subprocess
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.services.whisper_service import WhisperService

load_dotenv()

app = FastAPI(
    title="AI Meeting Transcription Service",
    description="Audio transcription using faster-whisper",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Whisper service on startup
whisper_service = None


@app.on_event("startup")
async def startup_event():
    global whisper_service
    model_size = os.getenv("WHISPER_MODEL", "base")
    device = os.getenv("WHISPER_DEVICE", "cpu")
    compute_type = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
    
    print(f"🤖 Loading Whisper model: {model_size} on {device} ({compute_type})")
    whisper_service = WhisperService(model_size, device, compute_type)
    print("✅ Whisper model loaded successfully!")


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "model_loaded": whisper_service is not None,
        "model": os.getenv("WHISPER_MODEL", "base"),
    }


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    """
    Transcribe an audio/video file using faster-whisper.
    
    Accepts: .webm, .mp4, .wav, .mp3, .m4a, .ogg
    Returns: Full text and timestamped segments.
    """
    if whisper_service is None:
        raise HTTPException(status_code=503, detail="Whisper model not loaded yet")

    # Save uploaded file to temp location
    suffix = Path(file.filename).suffix or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
        content = await file.read()
        tmp_file.write(content)
        tmp_path = tmp_file.name

    try:
        # Convert to WAV using FFmpeg (16kHz mono for best Whisper performance)
        wav_path = tmp_path.rsplit(".", 1)[0] + "_converted.wav"
        
        ffmpeg_cmd = [
            "ffmpeg", "-i", tmp_path,
            "-vn",                    # No video
            "-acodec", "pcm_s16le",   # 16-bit PCM
            "-ar", "16000",           # 16kHz sample rate
            "-ac", "1",               # Mono
            "-y",                     # Overwrite
            wav_path
        ]
        
        result = subprocess.run(
            ffmpeg_cmd,
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute timeout
        )
        
        if result.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"FFmpeg conversion failed: {result.stderr[:500]}"
            )

        # Transcribe with Whisper
        transcript_result = whisper_service.transcribe(wav_path)
        
        return transcript_result

    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="FFmpeg conversion timed out")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    finally:
        # Cleanup temp files
        for path in [tmp_path, wav_path if 'wav_path' in dir() else None]:
            if path and os.path.exists(path):
                try:
                    os.unlink(path)
                except Exception:
                    pass
