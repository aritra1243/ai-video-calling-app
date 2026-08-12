const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure storage directories exist
const recordingsDir = path.join(__dirname, '../../storage/recordings');
const audioDir = path.join(__dirname, '../../storage/audio');

if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir, { recursive: true });
}
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, recordingsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${req.params.id}-${Date.now()}${path.extname(file.originalname) || '.webm'}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max
  },
  fileFilter: (req, file, cb) => {
    const mime = (file.mimetype || '').toLowerCase();
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowedExtensions = ['.webm', '.mp4', '.mkv', '.avi', '.mov', '.wav', '.mp3', '.ogg'];

    if (
      mime.startsWith('video/') ||
      mime.startsWith('audio/') ||
      mime === 'application/octet-stream' ||
      mime === '' ||
      allowedExtensions.includes(ext)
    ) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only video/audio files are allowed.'));
    }
  },

});

module.exports = upload;
