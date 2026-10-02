import 'express-async-errors';
import { app } from './app';
import { env } from './config/env';

app.listen(env.port, () => {
  console.log(`Uay Estoque API rodando em http://localhost:${env.port}`);
});
