import { useState, useRef, useCallback } from 'react';

const useRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingBlob, setRecordingBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = useCallback((stream) => {
    if (!stream) {
      console.error('No stream available for recording');
      return;
    }

    chunksRef.current = [];
    setRecordingBlob(null);

    const options = { mimeType: 'video/webm;codecs=vp9,opus' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = 'video/webm;codecs=vp8,opus';
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = 'video/webm';
    }

    try {
      const recorder = new MediaRecorder(stream, options);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: options.mimeType });
        setRecordingBlob(blob);
        clearInterval(timerRef.current);
      };

      recorder.start(1000); // Collect data every second
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  }, []);

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
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
    formatTime,
  };
};

export default useRecording;
