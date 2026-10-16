// cz-js-1040 hardcoded port in Next.js server configuration
const next = require('next');
const app = next({ dev: false });
app.prepare().then(() => {
  const server = require('http').createServer();
  const PORT = process.env.PORT || 3000;
  server.listen(PORT);  // port externalized via environment variable
});
