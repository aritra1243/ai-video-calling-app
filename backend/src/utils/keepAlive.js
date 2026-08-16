const config = require('../config/config');

/**
 * Self-ping Keep-Alive Service
 * Prevents Render Free Tier web services from sleeping after 15 minutes of inactivity
 * by sending an automated HTTP ping every 10 minutes.
 */

const PING_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes (Render sleeps after 15 mins)

const startKeepAlive = () => {
  // Determine backend public URL
  const backendUrl =
    process.env.RENDER_EXTERNAL_URL ||
    process.env.BACKEND_URL ||
    'https://ai-meeting-backend-h75k.onrender.com';

  const aiServiceUrl = config.aiServiceUrl;

  console.log(`\n⏰ [KeepAlive] Self-ping service initialized.`);
  console.log(`🎯 [KeepAlive] Target Backend URL: ${backendUrl}`);
  if (aiServiceUrl && aiServiceUrl.includes('onrender.com')) {
    console.log(`🎯 [KeepAlive] Target AI Service URL: ${aiServiceUrl}`);
  }

  const pingServer = async (url, label) => {
    try {
      const pingUrl = url.endsWith('/') ? `${url}api/ping` : `${url}/api/ping`;
      const response = await fetch(pingUrl, {
        method: 'GET',
        headers: { 'User-Agent': 'Render-Self-KeepAlive/1.0' },
      });

      if (response.ok) {
        console.log(`[KeepAlive] ✅ Pinged ${label} (${pingUrl}) - Status: ${response.status}`);
      } else {
        console.warn(`[KeepAlive] ⚠️ Pinged ${label} (${pingUrl}) - Status: ${response.status}`);
      }
    } catch (err) {
      console.warn(`[KeepAlive] ⚠️ Ping to ${label} failed:`, err.message);
    }
  };

  const pingPythonAI = async (url) => {
    try {
      const healthUrl = url.endsWith('/') ? `${url}health` : `${url}/health`;
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: { 'User-Agent': 'Render-Self-KeepAlive/1.0' },
      });
      if (response.ok) {
        console.log(`[KeepAlive] ✅ Pinged Python AI Service (${healthUrl}) - Status: ${response.status}`);
      }
    } catch (err) {
      // Quietly log if Python service is down
      console.warn(`[KeepAlive] ⚠️ Ping to Python AI failed:`, err.message);
    }
  };

  // Run first ping after 1 minute of startup
  setTimeout(() => {
    pingServer(backendUrl, 'Node Backend');
    if (aiServiceUrl && aiServiceUrl.includes('onrender.com')) {
      pingPythonAI(aiServiceUrl);
    }
  }, 60 * 1000);

  // Set recurring interval every 10 minutes
  setInterval(() => {
    pingServer(backendUrl, 'Node Backend');
    if (aiServiceUrl && aiServiceUrl.includes('onrender.com')) {
      pingPythonAI(aiServiceUrl);
    }
  }, PING_INTERVAL_MS);
};

module.exports = startKeepAlive;
