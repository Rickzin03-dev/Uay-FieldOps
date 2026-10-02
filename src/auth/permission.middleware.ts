import { NextFunction, Request, Response } from 'express';

export function requireRoles(...roles: string[]) {
  return (_request: Request, response: Response, next: NextFunction) => {
    const auth = response.locals.auth as { role?: string } | undefined;
    if (!auth?.role || !roles.includes(auth.role)) {
      response.status(403).json({ message: 'Você não possui permissão para esta operação.' });
      return;
    }
    next();
  };
}
