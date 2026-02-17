/**
 * ChainGuard Bridge API Server
 * Restructured with proper architecture
 */

import express, { Application } from 'express';
import cors from 'cors';
import { config, validateConfig } from './config';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/logger';
import logger from './middleware/logger';

// Route imports
import contractRoutes from './routes/contract.routes';
import alertRoutes from './routes/alert.routes';
import scanRoutes from './routes/scan.routes';
import creRoutes from './routes/cre.routes';

// Types
import { HealthResponse } from './types';

// Validate configuration on startup
validateConfig();

// Initialize Express app
const app: Application = express();

// ============================================================================
// Middleware
// ============================================================================

// CORS
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// ============================================================================
// Health Check
// ============================================================================

app.get('/health', (_req, res) => {
  const response: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: config.apiVersion,
    uptime: process.uptime(),
  };
  
  res.json(response);
});

// ============================================================================
// API Routes
// ============================================================================

app.use('/api/contracts', contractRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/scan', scanRoutes);
app.use('/cre', creRoutes);

// ============================================================================
// API Documentation Redirect
// ============================================================================

app.get('/docs', (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>ChainGuard API Documentation</title>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 800px;
          margin: 50px auto;
          padding: 20px;
          line-height: 1.6;
        }
        h1 { color: #2c3e50; }
        .button {
          display: inline-block;
          padding: 12px 24px;
          margin: 10px 10px 10px 0;
          background: #3498db;
          color: white;
          text-decoration: none;
          border-radius: 5px;
        }
        .button:hover { background: #2980b9; }
        .section {
          background: #f8f9fa;
          padding: 20px;
          margin: 20px 0;
          border-radius: 5px;
        }
        code {
          background: #e9ecef;
          padding: 2px 6px;
          border-radius: 3px;
        }
      </style>
    </head>
    <body>
      <h1>🔐 ChainGuard Bridge API</h1>
      <p>REST API bridge for interacting with ChainGuard CRE workflows.</p>
      
      <div class="section">
        <h2>📚 Documentation</h2>
        <p>View the complete OpenAPI specification:</p>
        <a href="/openapi.yaml" class="button">Download OpenAPI Spec</a>
        <p style="margin-top: 20px;">
          To view the interactive documentation:
        </p>
        <ol>
          <li>Copy the OpenAPI spec URL: <code>http://localhost:${config.port}/openapi.yaml</code></li>
          <li>Visit <a href="https://editor.swagger.io" target="_blank">Swagger Editor</a></li>
          <li>Paste the URL or import the file</li>
        </ol>
      </div>
      
      <div class="section">
        <h2>🔗 Quick Links</h2>
        <ul>
          <li><strong>Health Check:</strong> <a href="/health">/health</a></li>
          <li><strong>API Base:</strong> <code>/api/*</code></li>
          <li><strong>CRE Endpoints:</strong> <code>/cre/*</code></li>
        </ul>
      </div>
      
      <div class="section">
        <h2>📡 Request Types</h2>
        <h3>Normal HTTP Requests</h3>
        <p>Standard REST endpoints for contract monitoring and management:</p>
        <ul>
          <li><code>GET /api/contracts</code> - List monitored contracts</li>
          <li><code>POST /api/scan</code> - Trigger risk scan</li>
          <li><code>GET /api/alerts</code> - Get alert history</li>
        </ul>
        
        <h3>CRE HTTP Triggers</h3>
        <p>Simulate Chainlink Runtime Environment workflows:</p>
        <ul>
          <li><code>POST /cre/trigger</code> - Normal HTTP trigger</li>
          <li><code>POST /cre/confidential/trigger</code> - Confidential trigger (experimental)</li>
          <li><code>POST /cre/report</code> - Submit CRE reports</li>
        </ul>
      </div>
      
      <div class="section">
        <h2>🔐 CRE Confidential Requests</h2>
        <p><strong>Experimental Feature - Simulation Only</strong></p>
        <p>Confidential HTTP requests execute in secure enclaves (TEE) and support:</p>
        <ul>
          <li>Secret injection via templates: <code>{{.secretName}}</code></li>
          <li>Response encryption with AES-256-GCM</li>
          <li>Isolated execution environment</li>
        </ul>
        <p><em>Note: Not available in deployed workflows yet.</em></p>
      </div>
      
      <div class="section">
        <h2>📖 Example Request</h2>
        <pre style="background: white; padding: 15px; border-radius: 5px; overflow-x: auto;">
<strong># Trigger a risk scan</strong>
curl -X POST http://localhost:${config.port}/api/scan \\
  -H "Content-Type: application/json" \\
  -d '{
    "addresses": ["0x1234567890123456789012345678901234567890"],
    "priority": "high"
  }'

<strong># CRE HTTP Trigger (Normal)</strong>
curl -X POST http://localhost:${config.port}/cre/trigger \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "scan",
    "contractAddress": "0x1234567890123456789012345678901234567890"
  }'
        </pre>
      </div>
    </body>
    </html>
  `);
});

// Serve OpenAPI spec
app.get('/openapi.yaml', (_req, res) => {
  res.sendFile('/docs/openapi.yaml', { root: __dirname + '/..' });
});

// ============================================================================
// Error Handling
// ============================================================================

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: 'Not found',
    code: 'NOT_FOUND',
    path: _req.path,
  });
});

// Global error handler
app.use(errorHandler);

// ============================================================================
// Server Startup
// ============================================================================

const server = app.listen(config.port, () => {
  logger.info(`🚀 ChainGuard Bridge API started`);
  logger.info(`📡 Server running on port ${config.port}`);
  logger.info(`🌍 Environment: ${config.nodeEnv}`);
  logger.info(`📚 Documentation: http://localhost:${config.port}/docs`);
  logger.info(`🔗 CRE Target: ${config.creTarget}`);
});

// Graceful shutdown
const shutdown = () => {
  logger.info('Shutting down server...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
