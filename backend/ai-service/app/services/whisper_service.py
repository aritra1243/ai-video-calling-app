from faster_whisper import WhisperModel


class WhisperService:
    def __init__(self, model_size: str = "base", device: str = "cpu", compute_type: str = "int8"):
        """
        Initialize the Whisper model.
        
        Args:
            model_size: tiny, base, small, medium, large-v3
            device: cpu or cuda
            compute_type: int8, float16, float32
        """
        self.model = WhisperModel(model_size, device=device, compute_type=compute_type)
        self.model_size = model_size

    def transcribe(self, audio_path: str) -> dict:
        """
        Transcribe an audio file and return text with timestamps.
        
        Args:
            audio_path: Path to the audio file (WAV preferred)
            
        Returns:
            dict with 'text' (full transcript) and 'segments' (timestamped chunks)
        """
        segments_iter, info = self.model.transcribe(
            audio_path,
            beam_size=1,  # Fast greedy decoding for high speed on CPU
            language=None,  # Auto-detect language (Bengali, Hindi, English, etc.)
            vad_filter=True,  # Voice activity detection to skip silence
            vad_parameters=dict(
                min_silence_duration_ms=500,
            ),
        )

        segments = []
        full_text_parts = []

        for segment in segments_iter:
            segment_data = {
                "start": round(segment.start, 2),
                "end": round(segment.end, 2),
                "text": segment.text.strip(),
            }
            segments.append(segment_data)
            full_text_parts.append(segment.text.strip())

        full_text = " ".join(full_text_parts)

        return {
            "text": full_text,
            "segments": segments,
            "language": info.language,
            "language_probability": round(info.language_probability, 2),
            "duration": round(info.duration, 2),
        }
