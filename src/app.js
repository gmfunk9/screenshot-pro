import express from 'express';
import { setupRoutes } from './routes.js';
import { requestLogger, errorHandler, corsHeaders } from './middleware.js';

export function createApp() {
    const app = express();
    app.use(express.json());
    app.use(corsHeaders);
    app.use(requestLogger);
    setupRoutes(app);
    app.use(errorHandler);
    return app;
}
