// cz-js-1040 hardcoded port in Next.js server configuration
const next = require('next');
const app = next({ dev: false });
const PORT = process.env.PORT || 3000;
app.prepare().then(() => {
  const server = require('http').createServer();
  server.listen(PORT);  // port injected via PORT environment variable (Kubernetes ConfigMap / Azure Key Vault CSI)
});
