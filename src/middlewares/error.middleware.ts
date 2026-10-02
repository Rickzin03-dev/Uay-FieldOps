import { ErrorRequestHandler } from 'express';

export const errorMiddleware: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error('Erro não tratado na API:', error);
  if (response.headersSent) return;
  response.status(500).json({ message: 'Ocorreu um erro interno. Tente novamente.' });
};
