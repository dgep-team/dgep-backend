const express = require('express');

const app = express();

app.use(express.json());

// Health check: used by CI tests and the staging server
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Unknown routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

module.exports = app;
