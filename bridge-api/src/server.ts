/**
 * ChainGuard Bridge API Server
 * Restructured with proper architecture
 */

import express, { Application } from 'express';
import cors from 'cors';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
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

// Load OpenAPI specification
const openApiPath = path.join(__dirname, '..', 'docs', 'openapi.yaml');
const swaggerDocument = YAML.load(openApiPath);

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
// API Documentation - Interactive Swagger UI
// ============================================================================

// Swagger UI with custom configuration
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'ChainGuard API Documentation',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true,
    defaultModelsExpandDepth: 1,
    defaultModelExpandDepth: 2,
    docExpansion: 'list',
  },
}));

// Serve OpenAPI spec directly
app.get('/openapi.yaml', (_req, res) => {
  res.sendFile(openApiPath);
});

// Redirect root to docs
app.get('/', (_req, res) => {
  res.redirect('/docs');
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
