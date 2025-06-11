import express from 'express';
import { setupRoutes } from './src/routes.js';
import config from './config.js';
import { requestLogger, errorHandler, corsHeaders } from './src/middleware.js';

const app = express();

// Middlewares
app.use(express.json());
app.use(corsHeaders);
app.use(requestLogger);  // Use the request logging middleware

// Setup routes
setupRoutes(app);

// Error handler middleware (should be after all other middlewares/routes)
app.use(errorHandler);

// Start the server
app.listen(config.server.port, () => {
    console.log(`Server is running on port ${config.server.port}`);
});
