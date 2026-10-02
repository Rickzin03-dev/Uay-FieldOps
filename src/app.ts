import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { authRoutes } from './auth/auth.routes';
import { env } from './config/env';
import { inventoryRoutes } from './inventory/inventory.routes';
import { technicianRoutes } from './inventory/technician.routes';
import { dashboardRoutes } from './dashboard/dashboard.routes';
import { reportsRoutes } from './reports/reports.routes';
import { errorMiddleware } from './middlewares/error.middleware';
import { userRoutes } from './auth/user.routes';

export const app = express();

app.use(helmet());
app.use(compression());
app.use(cors({
  origin: (origin, callback) => {
    // Requisições sem Origin (apps nativos mobile, curl, health checks) sempre passam.
    if (!origin) {
      callback(null, true);
      return;
    }
    // Em desenvolvimento, libera também qualquer IP da rede local (celular físico, outro PC do escritório).
    if (env.nodeEnv === 'development') {
      const localFrontend = /^http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+):\d+$/.test(origin);
      if (localFrontend || [env.frontendUrl, 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:8081', 'http://127.0.0.1:8081'].includes(origin)) {
        callback(null, true);
        return;
      }
    }
    // Em produção, só passam o domínio oficial do frontend e a lista explícita ALLOWED_ORIGINS.
    if ([env.frontendUrl, ...env.allowedOrigins].includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origem não autorizada pelo CORS.'));
  },
}));
app.use(express.json({ limit: '15mb' }));
app.use(morgan('dev'));

const loginLimiter = rateLimit({ windowMs: 40 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Muitas tentativas de login. Aguarde 40 segundos.' } });

const healthResponse = (_request: express.Request, response: express.Response) => {
  response.json({ status: 'ok', service: 'uay-estoque-api' });
};

app.get('/health', healthResponse);
app.get('/api/health', healthResponse);

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/technicians', technicianRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/users', userRoutes);
app.use(errorMiddleware);
