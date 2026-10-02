import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware';
import { prisma } from '../config/prisma';

const router = Router();
router.use(requireAuth);

router.get('/', async (_request, response) => {
  const [items, tools, epis, equipment, lowStock, technicians, recentMovements] = await Promise.all([
    prisma.item.count({ where: { status: 'ACTIVE' } }),
    prisma.item.count({ where: { status: 'ACTIVE', type: 'FERRAMENTA' } }),
    prisma.item.count({ where: { status: 'ACTIVE', type: 'EPI' } }),
    prisma.item.count({ where: { status: 'ACTIVE', type: 'EQUIPAMENTO' } }),
    prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "Item" WHERE "status" = 'ACTIVE' AND "quantity" <= "minimum"`,
    prisma.technician.count({ where: { active: true } }),
    prisma.movement.findMany({ take: 8, include: { item: { select: { name: true, unit: true } }, user: { select: { name: true } } }, orderBy: { createdAt: 'desc' } }),
  ]);
  const quantity = await prisma.item.aggregate({ where: { status: 'ACTIVE' }, _sum: { quantity: true } });
  response.json({ indicators: { items, tools, epis, equipment, lowStock: Number(lowStock[0]?.count ?? 0), technicians, quantity: Number(quantity._sum.quantity ?? 0) }, recentMovements });
});

export { router as dashboardRoutes };
