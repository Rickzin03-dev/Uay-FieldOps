import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from './auth.middleware';
import { requireRoles } from './permission.middleware';
import { prisma } from '../config/prisma';
import { hashPassword } from './auth.utils';

const router = Router();
const roles = ['DESENVOLVEDOR', 'ADMIN', 'ALMOXARIFADO', 'DONO', 'GESTOR', 'TECNICO'] as const;
const updateSchema = z.object({
  name: z.string().trim().min(3).optional(),
  email: z.string().trim().email().optional().nullable().or(z.literal('')),
  username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9._-]+$/).optional(),
  role: z.enum(roles).optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'BLOCKED']).optional(),
  phone: z.string().trim().optional().nullable(),
  password: z.string().min(8).optional(),
});

router.use(requireAuth, requireRoles('DESENVOLVEDOR', 'ADMIN'));

router.get('/', async (_request, response) => {
  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, username: true, phone: true, role: true, status: true, lastLoginAt: true, createdAt: true }, orderBy: { name: 'asc' } });
  response.json({ users });
});

router.patch('/:id', async (request, response) => {
  const parsed = updateSchema.safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ message: 'Dados do usuário inválidos.' }); return; }
  const { password, email, username, ...data } = parsed.data;
  try {
    const user = await prisma.user.update({ where: { id: request.params.id }, data: { ...data, ...(email !== undefined ? { email: email || null } : {}), ...(username !== undefined ? { username: username.toLowerCase() } : {}), ...(password ? { passwordHash: await hashPassword(password) } : {}) }, select: { id: true, name: true, email: true, username: true, phone: true, role: true, status: true } });
    response.json({ user });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2025') { response.status(404).json({ message: 'Usuário não encontrado.' }); return; }
    if ((error as { code?: string }).code === 'P2002') { response.status(409).json({ message: 'Este login já está sendo usado por outro usuário.' }); return; }
    throw error;
  }
});

export { router as userRoutes };
