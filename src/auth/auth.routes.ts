import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { requireAuth } from './auth.middleware';
import { comparePassword, createAccessToken, createRefreshToken, hashPassword, verifyRefreshToken } from './auth.utils';

const router = Router();
const credentialsSchema = z.object({
  email: z.string().trim().optional(),
  username: z.string().trim().optional(),
  login: z.string().trim().optional(),
  password: z.string().min(1),
}).refine((data) => Boolean(data.email || data.username || data.login), { message: 'Informe usuário ou e-mail.' });
const signupSchema = z.object({
  name: z.string().trim().min(3),
  username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9._-]+$/),
  email: z.string().trim().email().optional().or(z.literal('')),
  password: z.string().min(8),
  phone: z.string().trim().optional(),
  role: z.enum(['TECNICO', 'ALMOXARIFADO', 'GESTOR', 'DONO']).default('TECNICO'),
});

router.post('/login', async (request, response) => {
  const parsed = credentialsSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: 'Usuário/e-mail e senha são obrigatórios.' });
    return;
  }

  let user;
  try {
    const identifier = (parsed.data.login || parsed.data.username || parsed.data.email || '').toLowerCase();
    user = await prisma.user.findFirst({ where: { OR: [{ email: identifier }, { username: identifier }] } });
  } catch (error) {
    console.error('Falha ao consultar usuário no PostgreSQL:', error);
    response.status(503).json({ message: 'Banco de dados indisponível. Inicie o PostgreSQL e aplique as migrations.' });
    return;
  }
  const validPassword = user ? await comparePassword(parsed.data.password, user.passwordHash) : false;

  if (!user || !validPassword) {
    response.status(401).json({ message: 'Usuário/e-mail ou senha inválidos.' });
    return;
  }
  if (user.status !== 'ACTIVE') {
    response.status(403).json({ message: user.status === 'PENDING' ? 'Acesso aguardando aprovação.' : 'Acesso bloqueado.' });
    return;
  }

  try {
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  } catch (error) {
    console.error('Falha ao atualizar último acesso:', error);
    response.status(503).json({ message: 'Não foi possível concluir o login porque o banco está indisponível.' });
    return;
  }
  const token = createAccessToken({ sub: user.id, role: user.role });
  const refreshToken = createRefreshToken({ sub: user.id, role: user.role });
  response.json({ token, refreshToken, user: { id: user.id, name: user.name, email: user.email, username: user.username, role: user.role } });
});

router.post('/refresh', async (request, response) => {
  const parsed = z.object({ refreshToken: z.string().min(1) }).safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: 'Informe o refreshToken.' });
    return;
  }

  let payload;
  try {
    payload = verifyRefreshToken(parsed.data.refreshToken);
  } catch (error) {
    response.status(401).json({ message: 'Refresh token inválido ou expirado. Faça login novamente.' });
    return;
  }

  let user;
  try {
    user = await prisma.user.findUnique({ where: { id: payload.sub } });
  } catch (error) {
    console.error('Falha ao consultar usuário no PostgreSQL:', error);
    response.status(503).json({ message: 'Banco de dados indisponível.' });
    return;
  }
  if (!user || user.status !== 'ACTIVE') {
    response.status(401).json({ message: 'Acesso inválido ou bloqueado.' });
    return;
  }

  const token = createAccessToken({ sub: user.id, role: user.role });
  const refreshToken = createRefreshToken({ sub: user.id, role: user.role });
  response.json({ token, refreshToken, user: { id: user.id, name: user.name, email: user.email, username: user.username, role: user.role } });
});

router.post('/signup', async (request, response) => {
  const parsed = signupSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: 'Informe nome, usuário e uma senha com pelo menos 8 caracteres.' });
    return;
  }

  const username = parsed.data.username.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    response.status(409).json({ message: 'Não foi possível criar o acesso com os dados informados.' });
    return;
  }

  await prisma.user.create({
    data: {
      name: parsed.data.name,
      username,
      email: parsed.data.email ? parsed.data.email.toLowerCase() : null,
      phone: parsed.data.phone || null,
      passwordHash: await hashPassword(parsed.data.password),
      role: parsed.data.role,
      status: 'PENDING',
    },
  });
  response.status(201).json({ message: 'Solicitação registrada e aguardando aprovação.' });
});

router.post('/forgot-password', (_request, response) => {
  response.json({ message: 'Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.' });
});

router.get('/me', requireAuth, async (_request, response) => {
  const auth = response.locals.auth as { sub: string };
  const user = await prisma.user.findUnique({ where: { id: auth.sub }, select: { id: true, name: true, email: true, username: true, role: true, status: true } });
  if (!user) {
    response.status(401).json({ message: 'Usuário não encontrado.' });
    return;
  }
  response.json({ user });
});

export { router as authRoutes };
