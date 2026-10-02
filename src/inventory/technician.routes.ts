import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware';
import { prisma } from '../config/prisma';
import { requireRoles } from '../auth/permission.middleware';

const router = Router();
const technicianSchema = z.object({
  name: z.string().trim().min(3),
  position: z.string().trim().optional(),
  userId: z.string().uuid().optional(),
});
const technicianUpdateSchema = z.object({
  name: z.string().trim().min(3).optional(),
  position: z.string().trim().optional().nullable(),
  active: z.boolean().optional(),
  userId: z.string().uuid().optional().nullable(),
});
const serviceOrderSchema = z.object({
  number: z.string().trim().min(1),
  customer: z.string().trim().min(2),
  contractId: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  serviceType: z.string().trim().min(2),
  description: z.string().trim().optional().nullable(),
  status: z.enum(['PENDENTE', 'REAGENDADA', 'EM_ANDAMENTO', 'FINALIZADA', 'CANCELADA']).optional(),
  scheduledAt: z.coerce.date().optional().nullable(),
  startedAt: z.coerce.date().optional(),
  finishedAt: z.coerce.date().optional(),
  pdfUrl: z.string().trim().refine((value) => value.startsWith('data:application/pdf') || /^https?:\/\//.test(value), { message: 'PDF deve ser uma URL http(s) ou data URL.' }).optional().nullable(),
  pdfName: z.string().trim().optional().nullable(),
  powerMeterHome: z.number().finite().optional().nullable(),
  powerMeterCto: z.number().finite().optional().nullable(),
  materialsUsed: z.array(z.object({ itemId: z.string().uuid().optional(), name: z.string(), quantity: z.number().positive(), unit: z.string().optional(), metersUsed: z.number().finite().positive().optional(), deductFromStock: z.boolean().optional(), model: z.string().trim().optional().nullable(), serialNumber: z.string().trim().optional().nullable() })).optional(),
  evidences: z.array(z.object({ type: z.string(), uri: z.string().regex(/^(data:image\/(jpeg|png|webp);base64,|https?:\/\/)/).optional(), url: z.string().url().optional(), name: z.string().optional() })).optional(),
  notes: z.string().trim().optional(),
});
const requiredEvidenceTypes = ['POWER_METER_HOME', 'POWER_METER_CTO', 'CTO_INSIDE', 'CTO_OUTSIDE', 'MATERIALS_USED', 'SPEED_TEST'];
const visitStatusSchema = z.object({
  action: z.enum(['REAGENDAR', 'CANCELAR']),
  reason: z.string().trim().min(3),
  scheduledAt: z.coerce.date().optional().nullable(),
  evidences: z.array(z.object({
    type: z.literal('VISIT_ATTEMPT'),
    uri: z.string().regex(/^data:image\/(jpeg|png|webp);base64,/),
    name: z.string().optional(),
  })).optional(),
});

function currentUserId(response: Parameters<typeof requireAuth>[1]) {
  return (response.locals.auth as { sub: string }).sub;
}

function hasRequiredEvidences(evidences: Array<{ type: string; uri?: string; url?: string }> = []) {
  const sent = new Set(evidences.map((item) => item.type));
  return requiredEvidenceTypes.filter((type) => !evidences.some((item) => item.type === type && (item.uri || item.url)));
}

function startOfDay(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function endOfDay(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999); }
function rangeFromQuery(range: string, from?: string, to?: string) {
  const now = new Date();
  if (range === 'custom' && from && to) return { gte: startOfDay(new Date(from)), lte: endOfDay(new Date(to)) };
  if (range === 'yesterday') { const day = new Date(now); day.setDate(day.getDate() - 1); return { gte: startOfDay(day), lte: endOfDay(day) }; }
  if (range === '7days') { const day = new Date(now); day.setDate(day.getDate() - 6); return { gte: startOfDay(day), lte: endOfDay(now) }; }
  if (range === 'month') return { gte: new Date(now.getFullYear(), now.getMonth(), 1), lte: endOfDay(now) };
  if (range === 'previousMonth') return { gte: new Date(now.getFullYear(), now.getMonth() - 1, 1), lte: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)) };
  return { gte: startOfDay(now), lte: endOfDay(now) };
}

router.use(requireAuth);

// Resolve o Technician vinculado ao usuário logado (usado pelo app dos técnicos para saber "quem sou eu").
router.get('/me', async (_request, response) => {
  const auth = response.locals.auth as { sub: string };
  const technician = await prisma.technician.findUnique({ where: { userId: auth.sub } });
  if (!technician) {
    response.status(404).json({ message: 'Nenhum técnico vinculado a este usuário. Peça para o administrador vincular sua conta.' });
    return;
  }
  response.json({ technician });
});

router.get('/me/service-orders', async (request, response) => {
  const auth = response.locals.auth as { sub: string };
  const technician = await prisma.technician.findUnique({ where: { userId: auth.sub } });
  if (!technician) { response.status(404).json({ message: 'Nenhum técnico vinculado a este usuário.' }); return; }
  const status = String(request.query.status ?? 'finalized');
  if (status === 'active') {
    const orders = await prisma.serviceOrder.findMany({
      where: { technicianId: technician.id, status: { in: ['PENDENTE', 'EM_ANDAMENTO'] } },
      select: { id: true, number: true, customer: true, address: true, serviceType: true, description: true, status: true, scheduledAt: true, startedAt: true, pdfUrl: true, pdfName: true, materialsUsed: true, notes: true, createdAt: true },
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
    });
    response.json({ orders, stats: { total: 0, today: 0, week: 0, month: 0 } });
    return;
  }
  const range = String(request.query.range ?? 'today');
  const search = String(request.query.search ?? '').trim();
  const finishedAt = rangeFromQuery(range, request.query.from ? String(request.query.from) : undefined, request.query.to ? String(request.query.to) : undefined);
  const historyDate = { OR: [{ status: 'FINALIZADA' as const, finishedAt }, { status: 'REAGENDADA' as const, scheduledAt: finishedAt }] };
  const searchWhere = search ? { OR: [{ number: { contains: search, mode: 'insensitive' as const } }, { customer: { contains: search, mode: 'insensitive' as const } }, { serviceType: { contains: search, mode: 'insensitive' as const } }] } : {};
  const now = new Date();
  const weekStart = startOfDay(new Date(now));
  weekStart.setDate(now.getDate() - now.getDay());
  const [orders, total, today, week, month] = await Promise.all([
    prisma.serviceOrder.findMany({ where: { technicianId: technician.id, AND: [historyDate, searchWhere] }, orderBy: [{ scheduledAt: 'desc' }, { finishedAt: 'desc' }] }),
    prisma.serviceOrder.count({ where: { technicianId: technician.id, OR: [{ status: 'FINALIZADA' }, { status: 'REAGENDADA' }] } }),
    prisma.serviceOrder.count({ where: { technicianId: technician.id, OR: [{ status: 'FINALIZADA', finishedAt: { gte: startOfDay(now), lte: endOfDay(now) } }, { status: 'REAGENDADA', scheduledAt: { gte: startOfDay(now), lte: endOfDay(now) } }] } }),
    prisma.serviceOrder.count({ where: { technicianId: technician.id, OR: [{ status: 'FINALIZADA', finishedAt: { gte: weekStart, lte: endOfDay(now) } }, { status: 'REAGENDADA', scheduledAt: { gte: weekStart, lte: endOfDay(now) } }] } }),
    prisma.serviceOrder.count({ where: { technicianId: technician.id, OR: [{ status: 'FINALIZADA', finishedAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1), lte: endOfDay(now) } }, { status: 'REAGENDADA', scheduledAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1), lte: endOfDay(now) } }] } }),
  ]);
  response.json({ orders, stats: { total, today, week, month } });
});

router.get('/me/notifications', async (_request, response) => {
  const auth = response.locals.auth as { sub: string };
  const technician = await prisma.technician.findUnique({ where: { userId: auth.sub }, select: { id: true } });
  if (!technician) { response.status(404).json({ message: 'Nenhum técnico vinculado a este usuário.' }); return; }
  const [movements, orders] = await Promise.all([
    prisma.movement.findMany({
      where: { technicianId: technician.id, archivedAt: null },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, type: true, quantity: true, meters: true, origin: true, destination: true, reason: true, workOrder: true,
        item: { select: { name: true, unit: true, type: true } },
      },
    }),
    prisma.serviceOrder.findMany({
      where: { technicianId: technician.id, status: { in: ['PENDENTE', 'EM_ANDAMENTO'] } },
      take: 10,
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
      select: { id: true, number: true, serviceType: true, customer: true, address: true },
    }),
  ]);
  response.json({ stock: { movements }, orders });
});

router.patch('/me/service-orders/:id/start', async (request, response) => {
  const auth = response.locals.auth as { sub: string };
  const technician = await prisma.technician.findUnique({ where: { userId: auth.sub } });
  if (!technician) { response.status(404).json({ message: 'Nenhum técnico vinculado a este usuário.' }); return; }
  const order = await prisma.serviceOrder.updateMany({ where: { id: request.params.id, technicianId: technician.id, status: { in: ['PENDENTE', 'REAGENDADA'] } }, data: { status: 'EM_ANDAMENTO', startedAt: new Date() } });
  if (order.count !== 1) { response.status(404).json({ message: 'O.S. não encontrada ou já iniciada.' }); return; }
  const updated = await prisma.serviceOrder.findUnique({ where: { id: request.params.id } });
  response.json({ order: updated });
});

router.patch('/me/service-orders/:id/visit-status', async (request, response) => {
  const auth = response.locals.auth as { sub: string };
  const technician = await prisma.technician.findUnique({ where: { userId: auth.sub } });
  if (!technician) { response.status(404).json({ message: 'Nenhum técnico vinculado a este usuário.' }); return; }
  const parsed = visitStatusSchema.safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ message: 'Informe o motivo e os dados válidos da visita.' }); return; }
  if (parsed.data.action === 'REAGENDAR' && !parsed.data.scheduledAt) {
    response.status(400).json({ message: 'Informe a nova data e horário para reagendar a visita.' });
    return;
  }
  if (parsed.data.action === 'REAGENDAR' && !parsed.data.evidences?.some((evidence) => evidence.uri)) {
    response.status(400).json({ message: 'Para reagendar, envie uma foto que comprove o comparecimento no local.' });
    return;
  }
  const current = await prisma.serviceOrder.findFirst({ where: { id: request.params.id, technicianId: technician.id, status: { in: ['PENDENTE', 'REAGENDADA', 'EM_ANDAMENTO'] } } });
  if (!current) { response.status(404).json({ message: 'O.S. não encontrada ou já encerrada.' }); return; }
  const visitNote = `[${parsed.data.action === 'REAGENDAR' ? 'VISITA REAGENDADA' : 'VISITA CANCELADA'}] ${parsed.data.reason}`;
  const notes = current.notes ? `${current.notes}\n${visitNote}` : visitNote;
  const order = await prisma.serviceOrder.update({
    where: { id: current.id },
    data: {
      status: parsed.data.action === 'CANCELAR' ? 'CANCELADA' : 'REAGENDADA',
      scheduledAt: parsed.data.action === 'REAGENDAR' ? parsed.data.scheduledAt : current.scheduledAt,
      notes,
      ...(parsed.data.action === 'REAGENDAR' && parsed.data.evidences?.length ? { evidences: [...(Array.isArray(current.evidences) ? current.evidences : []), ...parsed.data.evidences] } : {}),
      startedAt: null,
    },
  });
  response.json({ order });
});

router.patch('/me/service-orders/:id/finalize', async (request, response) => {
  const auth = response.locals.auth as { sub: string };
  const technician = await prisma.technician.findUnique({ where: { userId: auth.sub } });
  if (!technician) { response.status(404).json({ message: 'Nenhum técnico vinculado a este usuário.' }); return; }
  const parsed = serviceOrderSchema.pick({ evidences: true, materialsUsed: true }).extend({ notes: z.string().trim().min(1) }).safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ message: 'Dados de finalização inválidos.' }); return; }
  const missing = hasRequiredEvidences(parsed.data.evidences || []);
  if (missing.length) { response.status(400).json({ message: 'Fotos obrigatórias faltando.', missing }); return; }
  const current = await prisma.serviceOrder.findFirst({ where: { id: request.params.id, technicianId: technician.id, status: { in: ['PENDENTE', 'EM_ANDAMENTO'] } } });
  if (!current) { response.status(404).json({ message: 'O.S. não encontrada ou já finalizada.' }); return; }
  const finishedAt = new Date();
  const startedAt = current.startedAt || finishedAt;
  const durationMinutes = Math.max(1, Math.round((finishedAt.getTime() - startedAt.getTime()) / 60000));
  try {
    const order = await prisma.$transaction(async (transaction) => {
      const materialsUsed = parsed.data.materialsUsed || [];
      const consumptions = materialsUsed.filter((material) => material.deductFromStock);
      const normalizedMaterials: Array<{ itemId?: string; name: string; quantity: number; unit?: string; metersUsed?: number; deductFromStock?: boolean; model?: string | null; serialNumber?: string | null }> = [];
      for (const material of materialsUsed) {
        if (!material.itemId) throw new Error('ITEM_REQUIRED');
        const balance = await transaction.stockBalance.findUnique({ where: { itemId_technicianId: { itemId: material.itemId, technicianId: technician.id } }, include: { item: true } });
        if (!balance || balance.item.status !== 'ACTIVE') throw new Error('ITEM_NOT_IN_TECHNICIAN_STOCK');
        if (balance.item.serialized) {
          if (!material.serialNumber) throw new Error('SERIAL_REQUIRED');
          const unit = await transaction.equipmentUnit.findFirst({ where: { itemId: material.itemId, serialNumber: material.serialNumber, technicianId: technician.id, status: 'ALOCADO' } });
          if (!unit) throw new Error('SERIAL_NOT_ALLOCATED');
        }
        if (balance.item.materialControlType === 'CABEAMENTO' && material.deductFromStock && !material.metersUsed) throw new Error('CABLE_METERS_REQUIRED');
        normalizedMaterials.push(balance.item.materialControlType === 'CABEAMENTO' && material.deductFromStock
          ? { ...material, quantity: material.metersUsed!, unit: 'm' }
          : material);
      }
      for (const material of consumptions) {
        if (!material.itemId) throw new Error('ITEM_REQUIRED');
        const balance = await transaction.stockBalance.findUnique({ where: { itemId_technicianId: { itemId: material.itemId, technicianId: technician.id } }, include: { item: true } });
        if (!balance || balance.item.status !== 'ACTIVE') throw new Error('ITEM_NOT_IN_TECHNICIAN_STOCK');
        if (balance.item.materialControlType === 'CABEAMENTO') {
          const metersUsed = material.metersUsed!;
          const updated = await transaction.stockBalance.updateMany({ where: { id: balance.id, availableMeters: { gte: metersUsed } }, data: { availableMeters: { decrement: metersUsed } } });
          if (updated.count !== 1) throw new Error('INSUFFICIENT_TECHNICIAN_STOCK');
          await transaction.movement.create({ data: { type: 'SAIDA', itemId: material.itemId, quantity: 0, meters: metersUsed, technicianId: technician.id, userId: auth.sub, origin: technician.name, destination: `Consumo O.S. #${current.number}`, reason: 'Cabeamento utilizado na execução da O.S.', workOrder: current.number, notes: parsed.data.notes } });
        } else {
          const updated = await transaction.stockBalance.updateMany({ where: { id: balance.id, quantity: { gte: material.quantity } }, data: { quantity: { decrement: material.quantity } } });
          if (updated.count !== 1) throw new Error('INSUFFICIENT_TECHNICIAN_STOCK');
          await transaction.movement.create({ data: { type: 'SAIDA', itemId: material.itemId, quantity: material.quantity, technicianId: technician.id, userId: auth.sub, origin: technician.name, destination: `Consumo O.S. #${current.number}`, reason: 'Material utilizado na execução da O.S.', workOrder: current.number, notes: parsed.data.notes } });
        }
      }
      const serializedMaterials = materialsUsed.filter((material) => material.serialNumber);
      const serialNumbers = serializedMaterials.map((material) => material.serialNumber!);
      if (new Set(serialNumbers).size !== serialNumbers.length) throw new Error('DUPLICATE_SERIAL_IN_ORDER');
      for (const material of serializedMaterials) {
        if (!material.itemId || !material.serialNumber) continue;
        const balance = await transaction.stockBalance.findUnique({ where: { itemId_technicianId: { itemId: material.itemId, technicianId: technician.id } }, include: { item: true } });
        if (!balance?.item.serialized) continue;
        const unit = await transaction.equipmentUnit.findFirst({ where: { itemId: material.itemId, serialNumber: material.serialNumber, technicianId: technician.id, status: 'ALOCADO' } });
        if (!unit) throw new Error('SERIAL_NOT_ALLOCATED');
        const balanceUpdate = await transaction.stockBalance.updateMany({ where: { itemId: material.itemId, technicianId: technician.id, quantity: { gte: 1 } }, data: { quantity: { decrement: 1 } } });
        if (balanceUpdate.count !== 1) throw new Error('INSUFFICIENT_TECHNICIAN_STOCK');
        await transaction.equipmentUnit.update({ where: { id: unit.id }, data: { status: 'EM_USO_CLIENTE', customer: current.customer, contractId: current.contractId, serviceOrderId: current.id } });
        await transaction.equipmentUnitEvent.create({ data: { unitId: unit.id, type: 'INSTALACAO', technicianId: technician.id, customer: current.customer, contractId: current.contractId, serviceOrderId: current.id, userId: auth.sub, notes: `O.S. #${current.number}` } });
      }
      return transaction.serviceOrder.update({ where: { id: current.id }, data: { status: 'FINALIZADA', startedAt, finishedAt, durationMinutes, evidences: parsed.data.evidences || [], notes: parsed.data.notes, materialsUsed: normalizedMaterials } });
    });
    response.json({ order });
  } catch (error) {
    const message = (error as Error).message;
    if (message === 'ITEM_REQUIRED') { response.status(400).json({ message: 'Selecione o item da caixa para cada material consumido.' }); return; }
    if (message === 'CABLE_METERS_REQUIRED') { response.status(400).json({ message: 'Informe uma metragem válida para cada cabeamento utilizado.' }); return; }
    if (message === 'ITEM_NOT_IN_TECHNICIAN_STOCK') { response.status(400).json({ message: 'Um dos itens selecionados não está disponível na sua caixa.' }); return; }
    if (message === 'INSUFFICIENT_TECHNICIAN_STOCK') { response.status(409).json({ message: 'Saldo insuficiente na caixa para um dos materiais informados.' }); return; }
    if (message === 'SERIAL_REQUIRED') { response.status(400).json({ message: 'Selecione o equipamento pelo número de série antes de finalizar a O.S.' }); return; }
    if (message === 'SERIAL_NOT_ALLOCATED') { response.status(409).json({ message: 'Este número de série não está alocado ao seu estoque ou já foi destinado a um cliente.' }); return; }
    if (message === 'DUPLICATE_SERIAL_IN_ORDER') { response.status(400).json({ message: 'O mesmo número de série foi selecionado mais de uma vez nesta O.S.' }); return; }
    throw error;
  }
});

router.post('/me/service-orders/finalize', async (request, response) => {
  const auth = response.locals.auth as { sub: string };
  const technician = await prisma.technician.findUnique({ where: { userId: auth.sub } });
  if (!technician) { response.status(404).json({ message: 'Nenhum técnico vinculado a este usuário.' }); return; }
  const parsed = serviceOrderSchema.safeParse(request.body);
  if (!parsed.success || !parsed.data.startedAt || !parsed.data.finishedAt || parsed.data.finishedAt <= parsed.data.startedAt) { response.status(400).json({ message: 'Dados da O.S. inválidos.' }); return; }
  try {
    const durationMinutes = Math.max(1, Math.round((parsed.data.finishedAt.getTime() - parsed.data.startedAt.getTime()) / 60000));
    const order = await prisma.serviceOrder.create({ data: { ...parsed.data, status: 'FINALIZADA', durationMinutes, technicianId: technician.id, userId: auth.sub, materialsUsed: parsed.data.materialsUsed ?? [], evidences: parsed.data.evidences ?? [] } });
    response.status(201).json({ order });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') { response.status(409).json({ message: 'Essa O.S. já foi registrada.' }); return; }
    throw error;
  }
});

router.post('/service-orders', requireRoles('DESENVOLVEDOR', 'ADMIN', 'ALMOXARIFADO'), async (request, response) => {
  const parsed = serviceOrderSchema.extend({ technicianId: z.string().uuid() }).safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ message: 'Dados da O.S. inválidos.' }); return; }
  const technician = await prisma.technician.findUnique({ where: { id: parsed.data.technicianId } });
  if (!technician || !technician.active) { response.status(404).json({ message: 'Técnico não encontrado ou inativo.' }); return; }
  const auth = response.locals.auth as { sub: string };
  try {
    const order = await prisma.serviceOrder.create({
      data: {
        number: parsed.data.number,
        customer: parsed.data.customer,
        contractId: parsed.data.contractId || null,
        address: parsed.data.address || null,
        serviceType: parsed.data.serviceType,
        description: parsed.data.description || null,
        scheduledAt: parsed.data.scheduledAt || null,
        startedAt: parsed.data.startedAt || null,
        finishedAt: parsed.data.finishedAt || null,
        durationMinutes: null,
        pdfUrl: parsed.data.pdfUrl || null,
        pdfName: parsed.data.pdfName || null,
        materialsUsed: parsed.data.materialsUsed || [],
        evidences: [],
        notes: parsed.data.notes || null,
        technicianId: technician.id,
        userId: auth.sub,
        status: parsed.data.status || 'PENDENTE',
      },
    });
    response.status(201).json({ order });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') { response.status(409).json({ message: 'Essa O.S. já existe.' }); return; }
    throw error;
  }
});

router.get('/service-orders', requireRoles('DESENVOLVEDOR', 'ADMIN', 'ALMOXARIFADO'), async (_request, response) => {
  const orders = await prisma.serviceOrder.findMany({ where: { archivedAt: null }, include: { technician: { select: { id: true, name: true } } }, orderBy: [{ status: 'asc' }, { scheduledAt: 'desc' }, { createdAt: 'desc' }] });
  response.json({ orders });
});

router.delete('/service-orders/:id', requireRoles('DESENVOLVEDOR', 'ADMIN', 'ALMOXARIFADO'), async (request, response) => {
  const order = await prisma.serviceOrder.findUnique({ where: { id: request.params.id } });
  if (!order) { response.status(404).json({ message: 'O.S. não encontrada.' }); return; }
  if (order.status === 'FINALIZADA') {
    await prisma.serviceOrder.update({ where: { id: order.id }, data: { archivedAt: new Date() } });
    response.json({ message: 'O.S. arquivada. O histórico foi preservado.' });
    return;
  }
  await prisma.serviceOrder.delete({ where: { id: order.id } });
  response.json({ message: 'O.S. removida do aplicativo do técnico.' });
});

router.patch('/service-orders/:id', requireRoles('DESENVOLVEDOR', 'ADMIN', 'ALMOXARIFADO'), async (request, response) => {
  const parsed = z.object({ technicianId: z.string().uuid().optional(), status: z.enum(['PENDENTE', 'REAGENDADA', 'EM_ANDAMENTO']).optional() }).safeParse(request.body);
  if (!parsed.success || (!parsed.data.technicianId && !parsed.data.status)) { response.status(400).json({ message: 'Informe técnico ou status para atualizar a O.S.' }); return; }
  const order = await prisma.serviceOrder.findUnique({ where: { id: request.params.id } });
  if (!order) { response.status(404).json({ message: 'O.S. não encontrada.' }); return; }
  if (order.status === 'FINALIZADA') { response.status(409).json({ message: 'O.S. finalizada não pode ser alterada. O histórico deve ser preservado.' }); return; }
  const technicianId = parsed.data.technicianId;
  if (technicianId) {
    const technician = await prisma.technician.findUnique({ where: { id: technicianId } });
    if (!technician?.active) { response.status(404).json({ message: 'Técnico não encontrado ou inativo.' }); return; }
  }
  const updated = await prisma.serviceOrder.update({ where: { id: order.id }, data: { ...(technicianId ? { technicianId } : {}), ...(parsed.data.status ? { status: parsed.data.status } : {}) }, include: { technician: { select: { id: true, name: true } } } });
  response.json({ order: updated });
});

router.get('/', async (_request, response) => {
  const technicians = await prisma.technician.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    include: { _count: { select: { balances: true, movements: true } } },
  });
  response.json({ technicians });
});

router.get('/:id/stock', async (request, response) => {
  const auth = response.locals.auth as { role?: string; sub: string };
  // Técnico só pode ver o próprio estoque; demais perfis mantêm acesso total (comportamento anterior).
  if (auth?.role === 'TECNICO') {
    const own = await prisma.technician.findUnique({ where: { userId: auth.sub } });
    if (!own || own.id !== request.params.id) {
      response.status(403).json({ message: 'Você só pode consultar o seu próprio estoque.' });
      return;
    }
  }
  const technician = await prisma.technician.findUnique({
    where: { id: request.params.id },
    include: {
      balances: { where: { quantity: { gt: 0 }, item: { status: 'ACTIVE', serialized: false } }, include: { item: { include: { category: true } } }, orderBy: { updatedAt: 'desc' } },
      movements: { take: 50, include: { item: { select: { code: true, name: true, unit: true, type: true } }, user: { select: { name: true } }, }, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!technician) {
    response.status(404).json({ message: 'Técnico não encontrado.' });
    return;
  }
  const equipmentUnits = await prisma.equipmentUnit.findMany({
    where: { technicianId: request.params.id, status: { in: ['ALOCADO', 'AGUARDANDO_DEVOLUCAO'] } },
    include: { item: { select: { name: true, code: true, model: true, manufacturer: true } } },
    orderBy: { serialNumber: 'asc' },
  });
  response.json({ technician: { ...technician, equipmentUnits } });
});

const balanceAdjustmentSchema = z.object({
  quantity: z.number().finite().nonnegative(),
  availableMeters: z.number().finite().nonnegative().optional(),
  reason: z.string().trim().min(3),
});

router.patch('/:technicianId/stock/:balanceId', requireRoles('DESENVOLVEDOR', 'ADMIN', 'ALMOXARIFADO'), async (request, response) => {
  const parsed = balanceAdjustmentSchema.safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ message: 'Informe quantidades válidas e uma justificativa.' }); return; }
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const balance = await transaction.stockBalance.findFirst({ where: { id: request.params.balanceId, technicianId: request.params.technicianId }, include: { item: true, technician: true } });
      if (!balance || balance.item.status !== 'ACTIVE') throw new Error('BALANCE_NOT_FOUND');
      const isCable = balance.item.materialControlType === 'CABEAMENTO';
      if (isCable && parsed.data.availableMeters === undefined) throw new Error('METERS_REQUIRED');
      if (!isCable && parsed.data.availableMeters !== undefined) throw new Error('METERS_NOT_ALLOWED');
      const adjusted = await transaction.stockBalance.update({ where: { id: balance.id }, data: { quantity: parsed.data.quantity, ...(isCable ? { availableMeters: parsed.data.availableMeters } : {}) } });
      await transaction.movement.create({ data: { type: 'AJUSTE', itemId: balance.itemId, quantity: Math.abs(parsed.data.quantity - Number(balance.quantity)), meters: isCable ? Math.abs(parsed.data.availableMeters! - Number(balance.availableMeters ?? 0)) : null, technicianId: balance.technicianId, userId: currentUserId(response), origin: 'Ajuste administrativo', destination: balance.technician.name, reason: parsed.data.reason, notes: `Caixa do técnico: ${Number(balance.quantity)} para ${parsed.data.quantity}${isCable ? ` bobinas; ${Number(balance.availableMeters ?? 0)} para ${parsed.data.availableMeters} m` : ' unidades'}` } });
      return adjusted;
    });
    response.json({ balance: result });
  } catch (error) {
    const message = (error as Error).message;
    if (message === 'BALANCE_NOT_FOUND') { response.status(404).json({ message: 'Item não encontrado na caixa deste técnico.' }); return; }
    if (message === 'METERS_REQUIRED') { response.status(400).json({ message: 'Informe a metragem disponível para o cabeamento.' }); return; }
    if (message === 'METERS_NOT_ALLOWED') { response.status(400).json({ message: 'Metragem só pode ser alterada para cabeamento.' }); return; }
    throw error;
  }
});

router.delete('/:technicianId/stock/:balanceId', requireRoles('DESENVOLVEDOR', 'ADMIN', 'ALMOXARIFADO'), async (request, response) => {
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const balance = await transaction.stockBalance.findFirst({ where: { id: request.params.balanceId, technicianId: request.params.technicianId }, include: { item: true, technician: true } });
      if (!balance || balance.item.status !== 'ACTIVE') throw new Error('BALANCE_NOT_FOUND');
      const meters = balance.item.materialControlType === 'CABEAMENTO' ? Number(balance.availableMeters ?? 0) : undefined;
      await transaction.stockBalance.update({ where: { id: balance.id }, data: { quantity: 0, ...(meters !== undefined ? { availableMeters: 0 } : {}) } });
      await transaction.item.update({ where: { id: balance.itemId }, data: { quantity: { increment: balance.quantity }, ...(meters !== undefined ? { availableMeters: { increment: meters } } : {}) } });
      await transaction.movement.create({ data: { type: 'DEVOLUCAO', itemId: balance.itemId, quantity: balance.quantity, meters, technicianId: balance.technicianId, userId: currentUserId(response), origin: balance.technician.name, destination: 'Almoxarifado', reason: 'Item removido da caixa do técnico', notes: 'Devolução integral registrada pela ação de remoção na Caixa do Técnico.' } });
    });
    response.json({ message: 'Item devolvido ao almoxarifado e removido da caixa.' });
  } catch (error) {
    if ((error as Error).message === 'BALANCE_NOT_FOUND') { response.status(404).json({ message: 'Item não encontrado na caixa deste técnico.' }); return; }
    throw error;
  }
});

router.delete('/:technicianId/movements', requireRoles('DESENVOLVEDOR', 'ADMIN', 'ALMOXARIFADO'), async (request, response) => {
  const technician = await prisma.technician.findUnique({ where: { id: request.params.technicianId }, select: { id: true } });
  if (!technician) { response.status(404).json({ message: 'Técnico não encontrado.' }); return; }
  const result = await prisma.movement.updateMany({ where: { technicianId: technician.id, archivedAt: null }, data: { archivedAt: new Date() } });
  response.json({ archived: result.count, message: 'Últimas movimentações ocultadas da caixa. O histórico foi preservado.' });
});

router.post('/', requireRoles('DESENVOLVEDOR', 'ADMIN', 'ALMOXARIFADO'), async (request, response) => {
  const parsed = technicianSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: 'Nome do técnico é obrigatório.' });
    return;
  }
  try {
    const technician = await prisma.technician.create({
      data: {
        name: parsed.data.name,
        position: parsed.data.position || null,
        userId: parsed.data.userId || null,
      },
    });
    response.status(201).json({ technician });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      response.status(409).json({ message: 'A matrícula informada já está cadastrada.' });
      return;
    }
    throw error;
  }
});

router.patch('/:id', requireRoles('DESENVOLVEDOR', 'ADMIN', 'ALMOXARIFADO'), async (request, response) => {
  const parsed = technicianUpdateSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: 'Dados do técnico inválidos.' });
    return;
  }
  try {
    const technician = await prisma.technician.update({ where: { id: request.params.id }, data: parsed.data });
    response.json({ technician });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2025') { response.status(404).json({ message: 'Técnico não encontrado.' }); return; }
    if ((error as { code?: string }).code === 'P2002') { response.status(409).json({ message: 'Esse usuário já está vinculado a outro técnico.' }); return; }
    throw error;
  }
});

export { router as technicianRoutes };
