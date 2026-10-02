import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from './auth.utils';

export function requireAuth(request: Request, response: Response, next: NextFunction) {
  const authorization = request.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;

  if (!token) {
    response.status(401).json({ message: 'Sessão necessária.' });
    return;
  }

  try {
    response.locals.auth = verifyAccessToken(token);
    next();
  } catch {
    response.status(401).json({ message: 'Sessão inválida ou expirada.' });
  }
}
