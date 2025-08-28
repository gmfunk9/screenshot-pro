const express = require('express');
const fs = require('fs');
const path = require('path');
const { captureAllViewports } = require('./screenshot');

const router = express.Router();
const shotsDir = path.join(__dirname, '..', 'public', 'shots');

router.use(express.json());

router.post('/capture', async (req, res) => {
  const url = req.body.url;
  if (!url) {
    res.status(400).json({ error: 'Missing field url; add to body.' });
    return;
  }

  const stamp = Date.now().toString();
  const basePath = path.join(shotsDir, stamp);
  try {
    fs.mkdirSync(shotsDir, { recursive: true });
    const images = await captureAllViewports(url, basePath);
    const entry = { id: stamp, url, images };
    store.push(entry);
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/shots', (req, res) => {
  res.json(store);
});

const store = [];

module.exports = router;
