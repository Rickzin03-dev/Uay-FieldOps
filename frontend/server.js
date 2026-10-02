const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT || 5173);
const root = __dirname;
const contentTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
// Arquivos que mudam entre deploys ou durante desenvolvimento não devem ficar em cache.
const noCacheFiles = new Set(['/index.html', '/config.js', '/app.js']);

http.createServer((request, response) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  const requested = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(root, requested);
  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': noCacheFiles.has(requested) ? 'no-cache' : 'public, max-age=3600',
    });
    response.end(data);
  });
}).listen(port, () => console.log(`Uay Estoque frontend em http://localhost:${port}`));
