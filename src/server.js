import express from 'express';
import cors from 'cors';
import { initDB } from './config/db.js';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ENV } from "./config/env.js";

 
// Configuration Swagger
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const swaggerDocument = YAML.load(join(__dirname, './docs/swagger.yaml'));

import authRoutes from './routes/authRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import subscriptionsRoute from './routes/subscriptionRoutes.js';

import protectRoute from './middleware/auth.middleware.js';

import job from "./config/cron.js";

const app = express();

if (ENV.NODE_ENV === "production") job.start();

// 🔧 CORRECTION : trust proxy DOIT être défini EN PREMIER
app.set('trust proxy', true);

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Route de documentation Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "MyWallet API Documentation",
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
  }
}));

// Route de santé
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Serveur fonctionne',
    timestamp: new Date().toISOString(),
    environment: ENV.NODE_ENV || 'development'
  });
});

// Routes de l'API
app.use('/api/auth', authRoutes);
app.use('/api/transactions', protectRoute, transactionRoutes);
app.use('/api/subscriptions', protectRoute, subscriptionsRoute);

// Route 404 pour les routes non trouvées
app.use('*', (req, res) => {
  res.status(404).json({ 
    status: 'error', 
    message: `Route ${req.originalUrl} non trouvée` 
  });
});

// Gestionnaire d'erreurs global
app.use((error, req, res, next) => {
  console.error('Erreur non gérée:', error);
  res.status(500).json({ 
    status: 'error', 
    message: 'Erreur interne du serveur',
    ...(ENV.NODE_ENV !== 'production' && { stack: error.stack })
  });
});

const startServer = async () => {
  try {
    await initDB();

    const PORT = ENV.PORT || 3000;
    
    app.listen(PORT, () => {
      console.log(`🚀 Serveur démarré sur le port ${PORT}`);
      console.log(`📍 Environnement: ${ENV.NODE_ENV || 'development'}`);
      console.log(`📚 Documentation API: http://localhost:${PORT}/api-docs`);
      console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
    });

  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();

// export for vercel
export default app;