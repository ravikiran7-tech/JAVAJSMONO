// Fixed: cz-js-1040 - Using environment variable for port configuration
const next = require('next');
const app = next({ dev: false });
app.prepare().then(() => {
  const server = require('http').createServer();
  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
});
