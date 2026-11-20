// API docs for the frontend, from docs/openapi.yaml
//   /api/docs          -> Swagger UI (try endpoints in the browser)
//   /api/openapi.json  -> the raw spec (for code generators, Postman import)
const fs = require('fs');
const path = require('path');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');

const spec = YAML.parse(fs.readFileSync(path.join(__dirname, '../../docs/openapi.yaml'), 'utf8'));
const router = express.Router();

router.get('/openapi.json', (req, res) => res.json(spec));
router.use('/docs', swaggerUi.serve, swaggerUi.setup(spec, { swaggerOptions: { persistAuthorization: true } }));

module.exports = router;
