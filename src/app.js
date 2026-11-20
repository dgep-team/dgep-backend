const express = require('express');
const cors = require('cors');
const config = require('./config');
const healthRoutes = require('./routes/health.routes');
const apiRoutes = require('./routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Let the frontend call the API from the browser
app.use(cors({ origin: config.corsOrigins }));

// Keep the raw body too: Paystack webhook signatures are checked against it
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

// Health check: used by tests and by Render to check the server is up
app.use('/health', healthRoutes);

// API docs: /api/docs (Swagger UI) and /api/openapi.json
app.use('/api', require('./routes/docs.routes'));

// Feature APIs
app.use('/api/v1', apiRoutes);

// These two must stay last
app.use(notFound);
app.use(errorHandler);

module.exports = app;
