import 'dotenv/config';

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3333),
  jwtSecret: process.env.JWT_SECRET ?? 'uay-development-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'uay-development-refresh-secret',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  // Domínios extras liberados no CORS em produção (ex.: https://estoque.uayinternet.com.br,https://app.uayinternet.com.br)
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean),
};
