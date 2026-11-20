const fs = require('fs');
const path = require('path');
const request = require('supertest');
const YAML = require('yaml');
const app = require('../src/app');

const spec = YAML.parse(fs.readFileSync(path.join(__dirname, '../docs/openapi.yaml'), 'utf8'));

// Where each routes file is mounted (see src/routes/index.js and admin.routes.js)
const MOUNTS = {
  'auth.routes.js': '', 'platform.routes.js': '/platform', 'admin.routes.js': '/admin', 'adminRequest.routes.js': '/admin/requests',
  'booking.routes.js': '/bookings', 'checkIn.routes.js': '/bookings', 'request.routes.js': '', 'catalog.routes.js': '', 'payment.routes.js': '',
};

// Every "router.get('/x/:id', ...)" in the routes files, as "get /x/{id}"
function routesInCode() {
  return Object.entries(MOUNTS).flatMap(([file, mount]) => {
    const code = fs.readFileSync(path.join(__dirname, '../src/routes', file), 'utf8');
    return [...code.matchAll(/router\.(get|post|patch|put|delete)\('([^']+)'/g)].map(([, method, route]) => {
      const full = (mount + (route === '/' ? '' : route)).replace(/:(\w+)/g, '{$1}');
      return `${method} ${full}`;
    });
  });
}
const routesInSpec = () => Object.entries(spec.paths).flatMap(([p, ops]) => Object.keys(ops).map((m) => `${m} ${p}`));

describe('API docs', () => {
  it('documents every route, and only real routes', () => {
    expect(routesInSpec().sort()).toEqual(routesInCode().sort());
  });

  it('serves the spec and Swagger UI', async () => {
    expect((await request(app).get('/api/openapi.json')).body.openapi).toBe('3.0.3');
    expect((await request(app).get('/api/docs/')).status).toBe(200);
  });

  it('lets the frontend call from the browser (CORS)', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });
});
