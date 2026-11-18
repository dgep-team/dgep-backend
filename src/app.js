const express = require('express');
const healthRoutes = require('./routes/health.routes');
const apiRoutes = require('./routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(express.json());

// Health check: used by tests and by Render to check the server is up
app.use('/health', healthRoutes);

// Feature APIs
app.use('/api/v1', apiRoutes);

// These two must stay last
app.use(notFound);
app.use(errorHandler);

module.exports = app;
