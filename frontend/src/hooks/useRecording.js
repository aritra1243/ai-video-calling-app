import { useState, useRef, useCallback } from 'react';

/**
 * Enhanced Multi-Participant Meeting Recording Hook
 * - Mixes audio from all participants (local + remote) using Web Audio API AudioContext
 * - Composites video from all participants onto a responsive canvas grid with name tags
 * - Produces a high-quality combined WebM/MP4 stream containing the whole audience
 */
const useRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingBlob, setRecordingBlob] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const animFrameRef = useRef(null);

  // Audio Context & Destination
  const audioContextRef = useRef(null);
  const audioDestinationRef = useRef(null);
  const connectedAudioSourcesRef = useRef(new Map());

  // Canvas & Hidden Video Elements for compositing
  const canvasRef = useRef(null);
  const videoElementsRef = useRef(new Map()); // id -> HTMLVideoElement
  const streamsRef = useRef([]); // current allStreams array

  // Helper to get or create a hidden video element for a stream
  const getOrCreateVideo = (id, stream) => {
    let video = videoElementsRef.current.get(id);
    if (!video) {
      video = document.createElement('video');
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      video.play().catch(() => {});
      videoElementsRef.current.set(id, video);
    } else if (video.srcObject !== stream) {
      video.srcObject = stream;
      video.play().catch(() => {});
    }
    return video;
  };

  // Helper to connect a stream's audio to our mixed destination
  const connectAudioStream = (id, stream) => {
    if (!audioContextRef.current || !audioDestinationRef.current || !stream) return;
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;

    if (connectedAudioSourcesRef.current.has(id)) return; // already connected

    try {
      // Create dedicated MediaStream with just audio
      const audioOnlyStream = new MediaStream(audioTracks);
      const source = audioContextRef.current.createMediaStreamSource(audioOnlyStream);
      source.connect(audioDestinationRef.current);
      connectedAudioSourcesRef.current.set(id, source);
    } catch (err) {
      console.warn(`[useRecording] Failed to connect audio for ${id}:`, err);
    }
  };

  // Dynamic update when participants join or leave during an active recording
  const updateRecordingStreams = useCallback((allStreams = []) => {
    streamsRef.current = allStreams;

    if (audioContextRef.current && isRecording) {
      allStreams.forEach(({ id, stream }) => {
        if (stream) {
          getOrCreateVideo(id, stream);
          connectAudioStream(id, stream);
        }
      });
    }
  }, [isRecording]);

  const startRecording = useCallback(async (allStreams = []) => {
    if (!allStreams || allStreams.length === 0) {
      console.error('[useRecording] No streams available to record');
      return;
    }

    chunksRef.current = [];
    setRecordingBlob(null);
    streamsRef.current = allStreams;

    // 1. Initialize Web Audio API for mixing all participants' voices
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      audioContextRef.current = audioCtx;
      const destination = audioCtx.createMediaStreamDestination();
      audioDestinationRef.current = destination;
      connectedAudioSourcesRef.current.clear();

      // Connect all initial streams to audio mixer
      allStreams.forEach(({ id, stream }) => {
        if (stream) {
          connectAudioStream(id, stream);
        }
      });
    } catch (err) {
      console.warn('[useRecording] Web Audio mixing initialization error:', err);
    }

    // 2. Setup Canvas for Video Grid Compositing (1280x720 16:9 HD)
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    canvasRef.current = canvas;
    const ctx = canvas.getContext('2d');

    // Create video elements for each stream
    videoElementsRef.current.clear();
    allStreams.forEach(({ id, stream }) => {
      if (stream) {
        getOrCreateVideo(id, stream);
      }
    });

    // 3. Render loop to draw dynamic grid on canvas
    const drawGrid = () => {
      if (!canvasRef.current) return;
      const currentStreams = streamsRef.current || [];
      const count = Math.max(1, currentStreams.length);

      // Background fill
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Calculate grid columns and rows
      let cols = 1;
      let rows = 1;
      if (count === 2) {
        cols = 2;
        rows = 1;
      } else if (count <= 4) {
        cols = 2;
        rows = 2;
      } else if (count <= 6) {
        cols = 3;
        rows = 2;
      } else {
        cols = 3;
        rows = 3;
      }

      const padding = 12;
      const cellWidth = (canvas.width - padding * (cols + 1)) / cols;
      const cellHeight = (canvas.height - padding * (rows + 1)) / rows;

      currentStreams.forEach((item, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = padding + col * (cellWidth + padding);
        const y = padding + row * (cellHeight + padding);

        // Tile background / border
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x, y, cellWidth, cellHeight, 12);
        ctx.clip();

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x, y, cellWidth, cellHeight);

        const video = getOrCreateVideo(item.id, item.stream);
        const hasVideoTrack = item.stream && item.stream.getVideoTracks().some(t => t.enabled && t.readyState === 'live');

        if (video && video.readyState >= 2 && hasVideoTrack) {
          // Calculate aspect ratio fit (cover)
          const vWidth = video.videoWidth || cellWidth;
          const vHeight = video.videoHeight || cellHeight;
          const vRatio = vWidth / vHeight;
          const cellRatio = cellWidth / cellHeight;

          let sWidth = vWidth;
          let sHeight = vHeight;
          let sx = 0;
          let sy = 0;

          if (vRatio > cellRatio) {
            sWidth = vHeight * cellRatio;
            sx = (vWidth - sWidth) / 2;
          } else {
            sHeight = vWidth / cellRatio;
            sy = (vHeight - sHeight) / 2;
          }

          if (item.isLocal) {
            // Mirror local camera
            ctx.save();
            ctx.translate(x + cellWidth, y);
            ctx.scale(-1, 1);
            ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, cellWidth, cellHeight);
            ctx.restore();
          } else {
            ctx.drawImage(video, sx, sy, sWidth, sHeight, x, y, cellWidth, cellHeight);
          }
        } else {
          // Draw fallback avatar circle with user's initial
          const centerX = x + cellWidth / 2;
          const centerY = y + cellHeight / 2 - 12;
          const radius = Math.min(cellWidth, cellHeight) * 0.22;

          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.fillStyle = '#3b82f6';
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.floor(radius * 1.1)}px Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const initial = (item.userName || 'U').charAt(0).toUpperCase();
          ctx.fillText(initial, centerX, centerY);
        }

        // Draw Name badge in bottom-left
        const badgeX = x + 12;
        const badgeY = y + cellHeight - 32;
        const badgeText = item.userName ? `${item.userName}${item.isLocal ? ' (Host/You)' : ''}` : (item.isLocal ? 'You' : 'Participant');

        ctx.font = 'bold 13px Inter, sans-serif';
        const textWidth = ctx.measureText(badgeText).width;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, textWidth + 20, 24, 6);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, badgeX + 10, badgeY + 12);

        ctx.restore();
      });

      animFrameRef.current = requestAnimationFrame(drawGrid);
    };

    drawGrid();

    // 4. Create final combined MediaStream (Canvas Video + Mixed Audio)
    const canvasStream = canvas.captureStream(30); // 30 FPS video
    const finalTracks = [];

    const videoTrack = canvasStream.getVideoTracks()[0];
    if (videoTrack) finalTracks.push(videoTrack);

    if (audioDestinationRef.current && audioDestinationRef.current.stream) {
      const mixedAudioTrack = audioDestinationRef.current.stream.getAudioTracks()[0];
      if (mixedAudioTrack) {
        finalTracks.push(mixedAudioTrack);
      }
    } else {
      // Fallback: add first available audio track from allStreams
      allStreams.forEach(({ stream }) => {
        const at = stream?.getAudioTracks()[0];
        if (at && !finalTracks.includes(at)) finalTracks.push(at);
      });
    }

    const combinedStream = new MediaStream(finalTracks);

    // 5. MediaRecorder options
    let options;
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
      options = { mimeType: 'video/webm;codecs=vp9,opus' };
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
      options = { mimeType: 'video/webm;codecs=vp8,opus' };
    } else if (MediaRecorder.isTypeSupported('video/webm')) {
      options = { mimeType: 'video/webm' };
    } else if (MediaRecorder.isTypeSupported('video/mp4')) {
      options = { mimeType: 'video/mp4' };
    }

    try {
      const recorder = options ? new MediaRecorder(combinedStream, options) : new MediaRecorder(combinedStream);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || options?.mimeType || 'video/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordingBlob(blob);
        clearInterval(timerRef.current);
      };

      recorder.start(1000); // 1-second chunks
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);

      // Start elapsed timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('[useRecording] Error starting MediaRecorder:', error);
    }
  }, []);

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      // Cancel video animation frame loop
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      // Cleanup hidden video elements
      videoElementsRef.current.forEach((v) => {
        v.srcObject = null;
      });
      videoElementsRef.current.clear();

      // Close AudioContext
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          audioContextRef.current.close();
        } catch (e) {}
      }
      audioContextRef.current = null;
      audioDestinationRef.current = null;
      connectedAudioSourcesRef.current.clear();

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'video/webm' });
          setRecordingBlob(blob);
          clearInterval(timerRef.current);
          resolve(blob);
        };
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        clearInterval(timerRef.current);
      } else {
        setIsRecording(false);
        clearInterval(timerRef.current);
        resolve(recordingBlob);
      }
    });
  }, [recordingBlob]);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    isRecording,
    recordingTime,
    recordingBlob,
    startRecording,
    stopRecording,
    updateRecordingStreams,
    formatTime,
  };
};

export default useRecording;
