import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = 3000;

  // Global request logger to catch ALL requests
  app.use((req, res, next) => {
    const start = Date.now();
    console.log(`[INCOMING] ${req.method} ${req.url}`);
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (res.statusCode >= 300 && res.statusCode < 400) {
        console.log(`[REDIRECT RESPONSE] ${req.method} ${req.url} -> ${res.statusCode} (${res.getHeader('location')})`);
      } else {
        console.log(`[REQUEST] ${req.method} ${req.url} -> ${res.statusCode} (${duration}ms)`);
      }
    });
    next();
  });

  // Serve Service Worker with absolute priority and standard naming in production
  if (process.env.NODE_ENV === 'production') {
    app.get('/sw.js', (req, res) => {
      const distSwPath = path.resolve(__dirname, 'dist/sw.js');
      if (fs.existsSync(distSwPath)) {
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Service-Worker-Allowed', '/');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        return res.sendFile(distSwPath);
      }
      res.status(404).send('Service Worker not found');
    });
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Aura Server running at http://0.0.0.0:${port}`);
  });
}

startServer();
