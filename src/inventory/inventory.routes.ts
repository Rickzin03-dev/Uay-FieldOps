import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { requireAuth } from '../auth/auth.middleware';
import { requireRoles } from '../auth/permission.middleware';

const router = Router();
const positiveQuantity = z.number().finite().positive();
const itemBaseSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(2),
  categoryId: z.string().uuid(),
  subcategoryId: z.string().uuid().optional().nullable(),
  type: z.enum(['MATERIAL', 'FERRAMENTA', 'EPI', 'EQUIPAMENTO']).default('MATERIAL'),
  serialized: z.boolean().default(false),
  materialControlType: z.enum(['CONVENCIONAL', 'CABEAMENTO']).default('CONVENCIONAL'),
  metersPerUnit: z.number().finite().positive().optional().nullable(),
  unit: z.string().trim().min(1).optional(),
  minimum: z.number().finite().nonnegative().default(0),
  maximum: z.number().finite().positive().optional().nullable(),
  description: z.string().trim().optional(),
  location: z.string().trim().optional(),
  manufacturer: z.string().trim().optional().nullable(),
  model: z.string().trim().optional().nullable(),
  serialNumber: z.string().trim().optional().nullable(),
  barcode: z.string().trim().optional().nullable(),
  qrCode: z.string().trim().optional().nullable(),
});
const itemSchema = itemBaseSchema.superRefine((item, context) => {
  if (item.materialControlType === 'CABEAMENTO' && (!item.metersPerUnit || item.type !== 'MATERIAL')) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Cabeamento exige metragem por bobina e tipo MATERIAL.', path: ['metersPerUnit'] });
  }
});
const movementSchema = z.object({
  itemId: z.string().uuid(),
  quantity: positiveQuantity,
  unitId: z.string().uuid().optional(),
  serialNumber: z.string().trim().optional().nullable(),
  serialNumbers: z.array(z.string().trim().min(1)).optional(),
  meters: positiveQuantity.optional(),
  reason: z.string().trim().min(2),
  notes: z.string().trim().optional(),
  technicianId: z.string().uuid().optional(),
  workOrder: z.string().trim().optional(),
  supplier: z.string().trim().optional(),
  invoiceNumber: z.string().trim().optional(),
});
const equipmentUnitStatuses = ['EM_ESTOQUE', 'ALOCADO', 'EM_USO_CLIENTE', 'EM_CONFERENCIA', 'MANUTENCAO', 'AGUARDANDO_DEVOLUCAO', 'RESERVADO', 'DANIFICADO', 'DESCARTADO', 'DEVOLVIDO', 'BAIXADO'] as const;
const inventorySessionSchema = z.object({ name: z.string().trim().min(3), notes: z.string().trim().optional() });
const inventoryCountSchema = z.object({ sessionId: z.string().uuid(), itemId: z.string().uuid(), physicalQuantity: z.number().finite().nonnegative(), reason: z.string().trim().min(2), notes: z.string().trim().optional() });

function currentUserId(response: Parameters<typeof requireAuth>[1]) {
  return (response.locals.auth as { sub: string }).sub;
}

function movementMeters(item: { materialControlType: string; metersPerUnit: unknown }, meters?: number, quantity?: number) {
  if (item.materialControlType !== 'CABEAMENTO') return undefined;
  if (meters) return meters;
  if (quantity && Number(item.metersPerUnit) > 0) return quantity * Number(item.metersPerUnit);
  throw new Error('CABLE_METERS_REQUIRED');
}

router.use(requireAuth);

router.get('/categories', async (_request, response) => {
  const categories = await prisma.category.findMany({ include: { subcategories: true }, orderBy: { name: 'asc' } });
  response.json({ categories });
});

router.post('/categories', requireRoles('DESENVOLVEDOR', 'ADMIN', 'ALMOXARIFADO'), async (request, response) => {
  const name = z.string().trim().min(2).safeParse(request.body?.name);
  if (!name.success) {
    response.status(400).json({ message: 'Nome da categoria inválido.' });
    return;
  }
  try {
    const category = await prisma.category.create({ data: { name: name.data } });
    response.status(201).json({ category });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      response.status(409).json({ message: 'Esta categoria já existe.' });
      return;
    }
    throw error;
  }
});

router.get('/items', async (request, response) => {
  const search = String(request.query.search ?? '').trim();
  const group = String(request.query.group ?? '').trim();
  const type = request.query.type && ['MATERIAL', 'FERRAMENTA', 'EPI', 'EQUIPAMENTO'].includes(String(request.query.type)) ? String(request.query.type) as 'MATERIAL' | 'FERRAMENTA' | 'EPI' | 'EQUIPAMENTO' : undefined;
  const items = await prisma.item.findMany({
    where: { status: 'ACTIVE', ...(type ? { type } : {}), ...(group ? { category: { name: group } } : {}), ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { code: { contains: search, mode: 'insensitive' } }] } : {}) },
    include: { category: true, subcategory: true },
    orderBy: { name: 'asc' },
  });
  response.json({ items });
});

router.get('/items/lookup/:value', async (request, response) => {
  const value = request.params.value.trim();
  const item = await prisma.item.findFirst({ where: { status: 'ACTIVE', OR: [{ code: value }, { barcode: value }, { qrCode: value }, { serialNumber: value }, { assetNumber: value }, { name: { contains: value, mode: 'insensitive' } }] }, include: { category: true, balances: { include: { technician: true } } } });
  if (!item) { response.status(404).json({ message: 'Nenhum item encontrado para o código informado.' }); return; }
  const assigned = item.balances.filter((balance) => Number(balance.quantity) > 0).map((balance) => ({ technician: balance.technician?.name || 'Técnico não informado', quantity: Number(balance.quantity), unit: item.unit }));
  const units = item.serialized ? await prisma.equipmentUnit.findMany({ where: { itemId: item.id }, include: { technician: { select: { name: true } } }, orderBy: { serialNumber: 'asc' } }) : [];
  response.json({ item, location: Number(item.quantity) > 0 ? 'Almoxarifado' : assigned.length ? assigned.map((entry) => entry.technician).join(', ') : 'Sem saldo disponível', stock: { warehouse: Number(item.quantity), assigned }, units });
});

// Lista as unidades individuais (por número de série) de um equipamento, filtrando por status (padrão: disponível em estoque).
router.get('/items/:id/units', requireRoles('DESENVOLVEDOR', 'ADMIN', 'ALMOXARIFADO'), async (request, response) => {
  const status = request.query.status ? String(request.query.status) : 'EM_ESTOQUE';
  if (!equipmentUnitStatuses.includes(status as typeof equipmentUnitStatuses[number])) { response.status(400).json({ message: 'Status de equipamento inválido.' }); return; }
  const units = await prisma.equipmentUnit.findMany({ where: { itemId: request.params.id, status: status as typeof equipmentUnitStatuses[number] }, include: { technician: { select: { name: true } } }, orderBy: { serialNumber: 'asc' } });
  response.json({ units });
});

// Histórico completo de um equipamento por número de série: entrada, alocações, uso em cliente, devoluções e baixas.
router.get('/units/serial/:serialNumber', async (request, response) => {
  const unit = await prisma.equipmentUnit.findUnique({
    where: { serialNumber: request.params.serialNumber.trim() },
    include: {
      item: { select: { name: true, code: true, model: true, manufacturer: true } },
      technician: { select: { name: true } },
      serviceOrder: { select: { number: true, customer: true } },
      events: { orderBy: { createdAt: 'asc' }, include: { technician: { select: { name: true } }, serviceOrder: { select: { number: true } }, user: { select: { name: true } } } },
    },
  });
  if (!unit) { response.status(404).json({ message: 'Nenhum equipamento encontrado com esse número de série.' }); return; }
  response.json({ unit });
});

router.get('/equipment-units', requireRoles('DESENVOLVEDOR', 'ADMIN', 'ALMOXARIFADO', 'DONO', 'GESTOR'), async (request, response) => {
  const status = request.query.status ? String(request.query.status) : 'EM_USO_CLIENTE';
  const search = String(request.query.search ?? '').trim();
  if (status !== 'TODOS' && !equipmentUnitStatuses.includes(status as typeof equipmentUnitStatuses[number])) { response.status(400).json({ message: 'Status de equipamento inválido.' }); return; }
  const units = await prisma.equipmentUnit.findMany({
    where: {
      ...(status !== 'TODOS' ? { status: status as typeof equipmentUnitStatuses[number] } : {}),
      ...(search ? { OR: [{ serialNumber: { contains: search, mode: 'insensitive' as const } }, { customer: { contains: search, mode: 'insensitive' as const } }, { contractId: { contains: search, mode: 'insensitive' as const } }, { item: { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { model: { contains: search, mode: 'insensitive' as const } }] } }] } : {}),
    },
    include: {
      item: { select: { name: true, code: true, model: true, manufacturer: true } },
      technician: { select: { id: true, name: true } },
      serviceOrder: { select: { id: true, number: true, customer: true, contractId: true } },
      events: { where: { type: 'INSTALACAO' }, orderBy: { createdAt: 'desc' }, take: 1, include: { technician: { select: { name: true } }, serviceOrder: { select: { number: true } } } },
    },
    orderBy: { updatedAt: 'desc' },
  });
  response.json({ units });
});

const collectEquipmentSchema = z.object({
  reason: z.string().trim().min(3),
  collectedAt: z.coerce.date().optional(),
  technicianId: z.string().uuid().optional().nullable(),
  serviceOrderNumber: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

router.post('/equipment-units/:id/collect', requireRoles('DESENVOLVEDOR', 'ADMIN', 'ALMOXARIFADO'), async (request, response) => {
  const parsed = collectEquipmentSchema.safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ message: 'Informe o motivo da retirada.' }); return; }
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const unit = await transaction.equipmentUnit.findUnique({ where: { id: request.params.id }, include: { item: true } });
      if (!unit) throw new Error('UNIT_NOT_FOUND');
      if (!['EM_USO_CLIENTE', 'ALOCADO', 'AGUARDANDO_DEVOLUCAO'].includes(unit.status)) throw new Error('UNIT_NOT_COLLECTABLE');
      let relatedOrder = unit.serviceOrderId ? await transaction.serviceOrder.findUnique({ where: { id: unit.serviceOrderId } }) : null;
      if (parsed.data.serviceOrderNumber) {
        relatedOrder = await transaction.serviceOrder.findUnique({ where: { number: parsed.data.serviceOrderNumber } });
        if (!relatedOrder) throw new Error('SERVICE_ORDER_NOT_FOUND');
      }
      if (unit.technicianId && unit.status === 'ALOCADO') {
        const balance = await transaction.stockBalance.updateMany({ where: { itemId: unit.itemId, technicianId: unit.technicianId, quantity: { gte: 1 } }, data: { quantity: { decrement: 1 } } });
        if (balance.count !== 1) throw new Error('INSUFFICIENT_TECHNICIAN_STOCK');
      }
      const collectedAt = parsed.data.collectedAt ?? new Date();
      const actorTechnicianId = parsed.data.technicianId ?? unit.technicianId;
      const updated = await transaction.equipmentUnit.update({ where: { id: unit.id }, data: { status: 'EM_CONFERENCIA', technicianId: null } });
      await transaction.equipmentUnitEvent.create({ data: { unitId: unit.id, type: 'RETIRADA', technicianId: actorTechnicianId, customer: unit.customer, contractId: unit.contractId, serviceOrderId: relatedOrder?.id ?? unit.serviceOrderId, userId: currentUserId(response), createdAt: collectedAt, notes: [parsed.data.reason, parsed.data.notes].filter(Boolean).join(' | ') } });
      return updated;
    });
    response.json({ unit: result, message: 'Equipamento recolhido e enviado para conferência. Ainda não está disponível para nova alocação.' });
  } catch (error) {
    const message = (error as Error).message;
    if (message === 'UNIT_NOT_FOUND') { response.status(404).json({ message: 'Equipamento não encontrado.' }); return; }
    if (message === 'UNIT_NOT_COLLECTABLE') { response.status(409).json({ message: 'O status atual deste equipamento não permite recolhimento.' }); return; }
    if (message === 'INSUFFICIENT_TECHNICIAN_STOCK') { response.status(409).json({ message: 'O saldo do técnico está inconsistente; confira a caixa antes de recolher este equipamento.' }); return; }
    if (message === 'SERVICE_ORDER_NOT_FOUND') { response.status(404).json({ message: 'O.S. informada não encontrada.' }); return; }
    throw error;
  }
});

const equipmentDispositionSchema = z.object({
  status: z.enum(['EM_ESTOQUE', 'MANUTENCAO', 'DANIFICADO', 'DESCARTADO', 'BAIXADO', 'RESERVADO']),
  notes: z.string().trim().optional().nullable(),
});

router.patch('/equipment-units/:id/status', requireRoles('DESENVOLVEDOR', 'ADMIN', 'ALMOXARIFADO'), async (request, response) => {
  const parsed = equipmentDispositionSchema.safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ message: 'Informe uma destinação válida para o equipamento.' }); return; }
  try {
    const unit = await prisma.$transaction(async (transaction) => {
      const current = await transaction.equipmentUnit.findUnique({ where: { id: request.params.id }, include: { item: true } });
      if (!current) throw new Error('UNIT_NOT_FOUND');
      const allowed: Record<string, string[]> = {
        EM_CONFERENCIA: ['EM_ESTOQUE', 'MANUTENCAO', 'DANIFICADO', 'DESCARTADO', 'BAIXADO', 'RESERVADO'],
        MANUTENCAO: ['EM_ESTOQUE', 'DANIFICADO', 'DESCARTADO', 'BAIXADO', 'RESERVADO'],
        DANIFICADO: ['MANUTENCAO', 'DESCARTADO', 'BAIXADO'],
        RESERVADO: ['EM_ESTOQUE', 'MANUTENCAO', 'BAIXADO'],
        EM_ESTOQUE: ['RESERVADO', 'MANUTENCAO', 'DANIFICADO', 'DESCARTADO', 'BAIXADO'],
      };
      if (!allowed[current.status]?.includes(parsed.data.status)) throw new Error('INVALID_UNIT_TRANSITION');
      const wasAvailable = current.status === 'EM_ESTOQUE';
      const becomesAvailable = parsed.data.status === 'EM_ESTOQUE';
      if (wasAvailable && !becomesAvailable) {
        const removed = await transaction.item.updateMany({ where: { id: current.itemId, quantity: { gte: 1 } }, data: { quantity: { decrement: 1 } } });
        if (removed.count !== 1) throw new Error('ITEM_STOCK_INCONSISTENT');
      } else if (!wasAvailable && becomesAvailable) {
        await transaction.item.update({ where: { id: current.itemId }, data: { quantity: { increment: 1 } } });
      }
      const updated = await transaction.equipmentUnit.update({ where: { id: current.id }, data: { status: parsed.data.status, ...(parsed.data.status === 'DANIFICADO' ? { condition: 'DANIFICADO' as const } : {}), ...(parsed.data.status === 'BAIXADO' || parsed.data.status === 'DESCARTADO' ? { condition: 'BAIXADO' as const } : {}), ...(becomesAvailable || ['MANUTENCAO', 'DANIFICADO', 'BAIXADO', 'DESCARTADO', 'RESERVADO'].includes(parsed.data.status) ? { technicianId: null, customer: null, contractId: null, serviceOrderId: null } : {}) } });
      const eventType = becomesAvailable ? 'DEVOLUCAO' : parsed.data.status === 'MANUTENCAO' ? 'MANUTENCAO' : ['BAIXADO', 'DESCARTADO'].includes(parsed.data.status) ? 'BAIXA' : 'CONFERENCIA';
      await transaction.equipmentUnitEvent.create({ data: { unitId: current.id, type: eventType, userId: currentUserId(response), customer: current.customer, contractId: current.contractId, serviceOrderId: current.serviceOrderId, notes: parsed.data.notes || `Destinação após conferência: ${parsed.data.status}` } });
      return updated;
    });
    response.json({ unit });
  } catch (error) {
    const message = (error as Error).message;
    if (message === 'UNIT_NOT_FOUND') { response.status(404).json({ message: 'Equipamento não encontrado.' }); return; }
    if (message === 'INVALID_UNIT_TRANSITION') { response.status(409).json({ message: 'A transição solicitada não é permitida a partir do status atual.' }); return; }
    if (message === 'ITEM_STOCK_INCONSISTENT') { response.status(409).json({ message: 'Saldo do estoque inconsistente; confira o inventário antes de retirar esta unidade.' }); return; }
    throw error;
  }
});

router.post('/items/import', requireRoles('DESENVOLVEDOR', 'ADMIN', 'ALMOXARIFADO'), async (request, response) => {
  const rowSchema = itemBaseSchema.omit({ categoryId: true }).extend({ categoryId: z.string().uuid().optional(), categoryName: z.string().trim().min(2).optional() }).refine((row) => Boolean(row.categoryId || row.categoryName), { message: 'Informe categoryId ou categoryName.' }).superRefine((item, context) => {
    if (item.materialControlType === 'CABEAMENTO' && (!item.metersPerUnit || item.type !== 'MATERIAL')) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Cabeamento exige metragem por bobina e tipo MATERIAL.', path: ['metersPerUnit'] });
    }
  });
  const rows = z.array(rowSchema).min(1).max(5000).safeParse(request.body?.items);
  if (!rows.success) { response.status(400).json({ message: 'Envie uma lista de itens válida, com no máximo 5.000 registros.' }); return; }
  try {
    const result = await prisma.$transaction(async (transaction) => {
      let created = 0;
      let skipped = 0;
      for (const row of rows.data) {
        const category = row.categoryName ? await transaction.category.upsert({ where: { name: row.categoryName }, create: { name: row.categoryName }, update: {} }) : await transaction.category.findUnique({ where: { id: row.categoryId } });
        if (!category) { skipped += 1; continue; }
        const existing = await transaction.item.findUnique({ where: { code: row.code } });
        if (existing) { skipped += 1; continue; }
        await transaction.item.create({ data: { code: row.code, name: row.name, categoryId: category.id, subcategoryId: row.subcategoryId || null, type: row.type, materialControlType: row.materialControlType, metersPerUnit: row.metersPerUnit || null, unit: row.materialControlType === 'CABEAMENTO' ? 'BOBINA' : 'UN', minimum: row.minimum, maximum: row.maximum || null, description: row.description || null, location: row.location || null, barcode: row.barcode || null, qrCode: row.qrCode || null } });
        created += 1;
      }
      return { created, skipped };
    });
    response.status(201).json(result);
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') { response.status(409).json({ message: 'A importação contém códigos, QR Codes ou códigos de barras duplicados.' }); return; }
    throw error;
  }
});

router.get('/assets', async (request, response) => {
  const type = String(request.query.type ?? 'FERRAMENTA');
  const itemType = type === 'FIELD_ASSET' ? 'EQUIPAMENTO' : type;
  if (!['FERRAMENTA', 'EPI', 'EQUIPAMENTO'].includes(itemType)) {
    response.status(400).json({ message: 'Tipo de patrimônio inválido.' });
    return;
  }
  const items = await prisma.item.findMany({
    where: { type: itemType as 'FERRAMENTA' | 'EPI' | 'EQUIPAMENTO', status: 'ACTIVE' },
    include: { category: true, balances: { include: { technician: true } } },
    orderBy: { name: 'asc' },
  });
  response.json({ items });
});

router.get('/items/:id', async (request, response) => {
  const item = await prisma.item.findFirst({ where: { id: request.params.id, status: 'ACTIVE' }, include: { category: true } });
  if (!item) { response.status(404).json({ message: 'Item não encontrado.' }); return; }
  response.json({ item });
});

router.post('/items', requireRoles('DESENVOLVEDOR', 'ADMIN', 'ALMOXARIFADO'), async (request, response) => {
  const parsed = itemSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: 'Dados do item inválidos.', issues: parsed.error.flatten() });
    return;
  }
  try {
    const serialized = parsed.data.serialized || parsed.data.type === 'EQUIPAMENTO' || /roteador|onu|bridge/i.test(parsed.data.name);
    const item = await prisma.item.create({ data: { ...parsed.data, serialized, unit: parsed.data.materialControlType === 'CABEAMENTO' ? 'BOBINA' : 'UN', metersPerUnit: parsed.data.metersPerUnit || null, description: parsed.data.description || null, location: parsed.data.location || null } });
    response.status(201).json({ item });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      response.status(409).json({ message: 'O código informado já está cadastrado.' });
      return;
    }
    throw error;
  }
});

router.patch('/items/:id', requireRoles('DESENVOLVEDOR', 'ADMIN', 'ALMOXARIFADO'), async (request, response) => {
  const parsed = z.object({
    code: z.string().trim().min(1).optional(),
    name: z.string().trim().min(2).optional(),
    categoryId: z.string().uuid().optional(),
    serialized: z.boolean().optional(),
    quantity: z.number().finite().nonnegative().optional(),
    materialControlType: z.enum(['CONVENCIONAL', 'CABEAMENTO']).optional(),
    metersPerUnit: z.number().finite().positive().optional().nullable(),
    condition: z.enum(['NOVO', 'BOM', 'USADO', 'DANIFICADO', 'MANUTENCAO', 'PERDIDO', 'BAIXADO']).optional(),
  }).safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ message: 'Dados do item inválidos.' }); return; }
  if (parsed.data.materialControlType === 'CABEAMENTO' && !parsed.data.metersPerUnit) {
    response.status(400).json({ message: 'Informe a metragem por bobina para classificar o item como cabeamento.' });
    return;
  }
  try {
    const item = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.item.findUnique({ where: { id: request.params.id } });
      if (!existing) throw new Error('ITEM_NOT_FOUND');
      const isCable = parsed.data.materialControlType === 'CABEAMENTO';
      const metersPerUnit = parsed.data.metersPerUnit ?? Number(existing.metersPerUnit ?? 0);
      const shouldInitializeMeters = isCable && metersPerUnit > 0 && (existing.availableMeters === null || Number(existing.availableMeters) === 0);
      const updated = await transaction.item.update({ where: { id: request.params.id }, data: { ...parsed.data, ...(isCable ? { unit: 'BOBINA', ...(shouldInitializeMeters ? { availableMeters: Number(existing.quantity) * metersPerUnit } : {}) } : {}) }, include: { category: true } });
      if (shouldInitializeMeters) {
        const balances = await transaction.stockBalance.findMany({ where: { itemId: existing.id, OR: [{ availableMeters: null }, { availableMeters: 0 }] } });
        await Promise.all(balances.map((balance) => transaction.stockBalance.update({ where: { id: balance.id }, data: { availableMeters: Number(balance.quantity) * metersPerUnit } })));
      }
      return updated;
    });
    response.json({ item });
  } catch (error) {
    if ((error as Error).message === 'ITEM_NOT_FOUND') { response.status(404).json({ message: 'Item não encontrado.' }); return; }
    if ((error as { code?: string }).code === 'P2025') { response.status(404).json({ message: 'Item não encontrado.' }); return; }
    if ((error as { code?: string }).code === 'P2002') { response.status(409).json({ message: 'Código ou identificador já utilizado.' }); return; }
    throw error;
  }
});

router.delete('/items/:id', requireRoles('DESENVOLVEDOR', 'ADMIN'), async (request, response) => {
  try {
    const item = await prisma.item.update({ where: { id: request.params.id }, data: { status: 'INACTIVE' } });
    response.json({ item, message: 'Item arquivado. O histórico foi preservado.' });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2025') { response.status(404).json({ message: 'Item não encontrado.' }); return; }
    throw error;
  }
});

router.patch('/items/:id/asset', requireRoles('DESENVOLVEDOR', 'ADMIN', 'ALMOXARIFADO'), async (request, response) => {
  const parsed = z.object({
    name: z.string().trim().min(2).optional(),
    code: z.string().trim().min(1).optional(),
    unit: z.string().trim().min(1).optional(),
    quantity: z.number().finite().nonnegative().optional(),
    serialized: z.boolean().optional(),
    assetNumber: z.string().trim().optional().nullable(),
    serialNumber: z.string().trim().optional().nullable(),
    manufacturer: z.string().trim().optional().nullable(),
    model: z.string().trim().optional().nullable(),
    condition: z.enum(['NOVO', 'BOM', 'USADO', 'DANIFICADO', 'MANUTENCAO', 'PERDIDO', 'BAIXADO']).optional(),
  }).safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: 'Dados do patrimônio inválidos.' });
    return;
  }
  try {
    const item = await prisma.item.update({ where: { id: request.params.id }, data: { ...parsed.data, unit: 'UN' }, include: { category: true } });
    response.json({ item });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2025') {
      response.status(404).json({ message: 'Patrimônio não encontrado.' });
      return;
    }
    if ((error as { code?: string }).code === 'P2002') {
      response.status(409).json({ message: 'Patrimônio ou número de série já utilizado.' });
      return;
    }
    throw error;
  }
});

router.post('/entries', requireRoles('DESENVOLVEDOR', 'ADMIN', 'ALMOXARIFADO'), async (request, response) => {
  const parsed = movementSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: 'Material, quantidade e motivo são obrigatórios.' });
    return;
  }
  const { itemId, quantity, serialNumber, serialNumbers, reason, notes, supplier, invoiceNumber } = parsed.data;
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const item = await transaction.item.findUnique({ where: { id: itemId } });
      if (!item || item.status !== 'ACTIVE') throw new Error('ITEM_NOT_FOUND');
      const batchSerials = serialNumbers?.filter((value, index, values) => values.indexOf(value) === index) || [];
      if (item.serialized && !batchSerials.length) throw new Error('SERIALS_REQUIRED');
      if (item.serialized && (quantity !== Math.floor(quantity) || batchSerials.length !== quantity)) throw new Error('SERIAL_COUNT_MISMATCH');
      if (!item.serialized && batchSerials.length) throw new Error('SERIALS_NOT_ALLOWED');
      const existingSerials = Array.isArray(item.serialNumbers) ? item.serialNumbers.filter((value): value is string => typeof value === 'string') : [];
      if (batchSerials.some((value) => existingSerials.includes(value))) throw new Error('DUPLICATE_SERIAL');
      const allItems = await transaction.item.findMany({ where: { status: 'ACTIVE', NOT: { id: itemId } }, select: { serialNumber: true, serialNumbers: true } });
      const serialAlreadyUsed = allItems.some((candidate) => batchSerials.some((serial) => serial === candidate.serialNumber || (Array.isArray(candidate.serialNumbers) && candidate.serialNumbers.includes(serial))));
      if (serialAlreadyUsed) throw new Error('DUPLICATE_SERIAL');
      if (batchSerials.length) {
        const duplicateUnits = await transaction.equipmentUnit.findMany({ where: { serialNumber: { in: batchSerials } }, select: { serialNumber: true } });
        if (duplicateUnits.length) throw new Error('DUPLICATE_SERIAL');
      }
      const meters = movementMeters(item, undefined, quantity);
      const updated = await transaction.item.update({ where: { id: itemId }, data: { quantity: { increment: quantity }, ...(meters ? { availableMeters: { increment: meters } } : {}), ...(serialNumber ? { serialNumber } : {}), ...(batchSerials.length ? { serialNumbers: [...existingSerials, ...batchSerials] } : {}) } });
      const movement = await transaction.movement.create({ data: { type: 'ENTRADA', itemId, quantity, meters, userId: currentUserId(response), origin: supplier || 'Fornecedor', destination: 'Almoxarifado', reason, notes: [invoiceNumber ? `NF: ${invoiceNumber}` : '', notes || ''].filter(Boolean).join(' | ') || null } });
      if (batchSerials.length) {
        await transaction.equipmentUnit.createMany({ data: batchSerials.map((serial) => ({ itemId, serialNumber: serial, status: 'EM_ESTOQUE' as const })) });
        const createdUnits = await transaction.equipmentUnit.findMany({ where: { serialNumber: { in: batchSerials } } });
        await transaction.equipmentUnitEvent.createMany({ data: createdUnits.map((unit) => ({ unitId: unit.id, type: 'ENTRADA' as const, userId: currentUserId(response), notes: reason })) });
      }
      return { item: updated, movement };
    });
    response.status(201).json(result);
  } catch (error) {
    if ((error as Error).message === 'ITEM_NOT_FOUND') { response.status(404).json({ message: 'Item não encontrado.' }); return; }
    if ((error as Error).message === 'SERIALS_REQUIRED') { response.status(400).json({ message: 'Informe ou escaneie pelo menos um número de série para este produto.' }); return; }
    if ((error as Error).message === 'SERIALS_NOT_ALLOWED') { response.status(400).json({ message: 'Este produto não é serializado. Informe somente a quantidade manual.' }); return; }
    if ((error as Error).message === 'SERIAL_COUNT_MISMATCH') { response.status(400).json({ message: 'A quantidade precisa ser igual ao número de seriais escaneados.' }); return; }
    if ((error as Error).message === 'DUPLICATE_SERIAL') { response.status(409).json({ message: 'Um dos números de série já foi cadastrado neste equipamento.' }); return; }
    if ((error as { code?: string }).code === 'P2002') { response.status(409).json({ message: 'Este número de série já está cadastrado.' }); return; }
    throw error;
  }
});

router.post('/issues', requireRoles('DESENVOLVEDOR', 'ADMIN', 'ALMOXARIFADO'), async (request, response) => {
  const parsed = movementSchema.required({ technicianId: true }).safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: 'Material, quantidade, técnico e motivo são obrigatórios.' });
    return;
  }
  const { itemId, quantity: rawQuantity, meters: requestedMeters, reason, notes, technicianId, workOrder, unitId } = parsed.data;
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const [item, technician] = await Promise.all([transaction.item.findUnique({ where: { id: itemId } }), transaction.technician.findUnique({ where: { id: technicianId } })]);
      if (!item || item.status !== 'ACTIVE') throw new Error('ITEM_NOT_FOUND');
      if (!technician || !technician.active) throw new Error('TECHNICIAN_NOT_FOUND');
      let unit = null;
      if (item.serialized) {
        if (!unitId) throw new Error('UNIT_REQUIRED');
        unit = await transaction.equipmentUnit.findUnique({ where: { id: unitId } });
        if (!unit || unit.itemId !== itemId) throw new Error('UNIT_NOT_FOUND');
        if (unit.status !== 'EM_ESTOQUE') throw new Error('UNIT_NOT_AVAILABLE');
      }
      const quantity = item.serialized ? 1 : rawQuantity;
      const meters = movementMeters(item, requestedMeters, quantity);
      const updated = await transaction.item.updateMany({ where: { id: itemId, quantity: { gte: quantity }, ...(meters ? { availableMeters: { gte: meters } } : {}) }, data: { quantity: { decrement: quantity }, ...(meters ? { availableMeters: { decrement: meters } } : {}) } });
      if (updated.count !== 1) throw new Error('INSUFFICIENT_STOCK');
      await transaction.stockBalance.upsert({ where: { itemId_technicianId: { itemId, technicianId } }, create: { itemId, technicianId, quantity, availableMeters: meters }, update: { quantity: { increment: quantity }, ...(meters ? { availableMeters: { increment: meters } } : {}) } });
      const movement = await transaction.movement.create({ data: { type: 'SAIDA', itemId, quantity, meters, technicianId, userId: currentUserId(response), origin: 'Almoxarifado', destination: technician.name, reason, workOrder: workOrder || null, notes: notes || null } });
      if (unit) {
        await transaction.equipmentUnit.update({ where: { id: unit.id }, data: { status: 'ALOCADO', technicianId, customer: null, serviceOrderId: null } });
        await transaction.equipmentUnitEvent.create({ data: { unitId: unit.id, type: 'ALOCACAO', technicianId, userId: currentUserId(response), notes: reason } });
      }
      return { movement, unit };
    });
    response.status(201).json(result);
  } catch (error) {
    const message = (error as Error).message;
    if (message === 'ITEM_NOT_FOUND') { response.status(404).json({ message: 'Item não encontrado.' }); return; }
    if (message === 'TECHNICIAN_NOT_FOUND') { response.status(404).json({ message: 'Técnico não encontrado ou inativo.' }); return; }
    if (message === 'CABLE_METERS_REQUIRED') { response.status(400).json({ message: 'Informe a metragem transferida para o cabeamento.' }); return; }
    if (message === 'INSUFFICIENT_STOCK') { response.status(409).json({ message: 'Estoque insuficiente para esta saída.' }); return; }
    if (message === 'UNIT_REQUIRED') { response.status(400).json({ message: 'Selecione o número de série do equipamento a ser liberado.' }); return; }
    if (message === 'UNIT_NOT_FOUND') { response.status(404).json({ message: 'Equipamento não encontrado para este item.' }); return; }
    if (message === 'UNIT_NOT_AVAILABLE') { response.status(409).json({ message: 'Este equipamento já foi alocado a outro técnico ou não está disponível em estoque.' }); return; }
    throw error;
  }
});

// Técnico pode registrar a própria devolução (self-service); demais perfis administrativos mantêm acesso irrestrito.
router.post('/returns', async (request, response, next) => {
  const auth = response.locals.auth as { role?: string; sub: string };
  if (['DESENVOLVEDOR', 'ADMIN', 'ALMOXARIFADO'].includes(auth?.role ?? '')) { next(); return; }
  if (auth?.role === 'TECNICO') {
    const technician = await prisma.technician.findUnique({ where: { userId: auth.sub } });
    if (!technician || technician.id !== request.body?.technicianId) {
      response.status(403).json({ message: 'Você só pode registrar devolução do seu próprio estoque.' });
      return;
    }
    next();
    return;
  }
  response.status(403).json({ message: 'Você não possui permissão para esta operação.' });
}, async (request, response) => {
  const parsed = movementSchema.required({ technicianId: true }).safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: 'Material, quantidade, técnico e motivo são obrigatórios.' });
    return;
  }
  const { itemId, quantity: rawQuantity, meters: requestedMeters, reason, notes, technicianId, unitId } = parsed.data;
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const [item, technician] = await Promise.all([
        transaction.item.findUnique({ where: { id: itemId } }),
        transaction.technician.findUnique({ where: { id: technicianId } }),
      ]);
      if (!item || item.status !== 'ACTIVE') throw new Error('ITEM_NOT_FOUND');
      if (!technician || !technician.active) throw new Error('TECHNICIAN_NOT_FOUND');
      let unit = null;
      if (item.serialized) {
        if (!unitId) throw new Error('UNIT_REQUIRED');
        unit = await transaction.equipmentUnit.findUnique({ where: { id: unitId } });
        if (!unit || unit.itemId !== itemId) throw new Error('UNIT_NOT_FOUND');
        if (unit.technicianId !== technicianId) throw new Error('UNIT_NOT_OWNED');
        if (unit.status !== 'ALOCADO') throw new Error('UNIT_NOT_RETURNABLE');
      }
      const quantity = item.serialized ? 1 : rawQuantity;
      const meters = movementMeters(item, requestedMeters);
      const balance = await transaction.stockBalance.updateMany({ where: { itemId, technicianId, quantity: { gte: quantity }, ...(meters ? { availableMeters: { gte: meters } } : {}) }, data: { quantity: { decrement: quantity }, ...(meters ? { availableMeters: { decrement: meters } } : {}) } });
      if (balance.count !== 1) throw new Error('INSUFFICIENT_TECHNICIAN_STOCK');
      if (!unit) await transaction.item.update({ where: { id: itemId }, data: { quantity: { increment: quantity }, ...(meters ? { availableMeters: { increment: meters } } : {}) } });
      const movement = await transaction.movement.create({ data: { type: 'DEVOLUCAO', itemId, quantity, meters, technicianId, userId: currentUserId(response), origin: technician.name, destination: 'Almoxarifado', reason, notes: notes || null } });
      if (unit) {
        await transaction.equipmentUnit.update({ where: { id: unit.id }, data: { status: 'EM_CONFERENCIA', technicianId: null } });
        await transaction.equipmentUnitEvent.create({ data: { unitId: unit.id, type: 'DEVOLUCAO', technicianId, userId: currentUserId(response), notes: reason } });
      }
      return { movement, unit, message: unit ? 'Equipamento recebido para conferência; ainda não está disponível para nova alocação.' : undefined };
    });
    response.status(201).json(result);
  } catch (error) {
    const message = (error as Error).message;
    if (message === 'ITEM_NOT_FOUND') { response.status(404).json({ message: 'Item não encontrado.' }); return; }
    if (message === 'TECHNICIAN_NOT_FOUND') { response.status(404).json({ message: 'Técnico não encontrado ou inativo.' }); return; }
    if (message === 'CABLE_METERS_REQUIRED') { response.status(400).json({ message: 'Informe a metragem disponível na bobina devolvida.' }); return; }
    if (message === 'INSUFFICIENT_TECHNICIAN_STOCK') { response.status(409).json({ message: 'O técnico não possui essa quantidade para devolver.' }); return; }
    if (message === 'UNIT_REQUIRED') { response.status(400).json({ message: 'Selecione o equipamento (número de série) que está sendo devolvido.' }); return; }
    if (message === 'UNIT_NOT_FOUND') { response.status(404).json({ message: 'Equipamento não encontrado para este item.' }); return; }
    if (message === 'UNIT_NOT_OWNED') { response.status(403).json({ message: 'Este equipamento não está sob responsabilidade deste técnico.' }); return; }
    if (message === 'UNIT_NOT_RETURNABLE') { response.status(409).json({ message: 'Este equipamento não está em um status que permita devolução.' }); return; }
    throw error;
  }
});

router.post('/transfers', requireRoles('DESENVOLVEDOR', 'ADMIN', 'ALMOXARIFADO'), async (request, response) => {
  const parsed = movementSchema.required({ technicianId: true }).extend({ destinationTechnicianId: z.string().uuid() }).safeParse(request.body);
  if (!parsed.success || parsed.data.technicianId === parsed.data.destinationTechnicianId) {
    response.status(400).json({ message: 'Informe técnicos de origem e destino diferentes.' });
    return;
  }
  const { itemId, quantity, meters: requestedMeters, reason, notes, technicianId, destinationTechnicianId } = parsed.data;
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const [item, source, destination] = await Promise.all([
        transaction.item.findUnique({ where: { id: itemId } }),
        transaction.technician.findUnique({ where: { id: technicianId } }),
        transaction.technician.findUnique({ where: { id: destinationTechnicianId } }),
      ]);
      if (!item || item.status !== 'ACTIVE') throw new Error('ITEM_NOT_FOUND');
      if (!source?.active || !destination?.active) throw new Error('TECHNICIAN_NOT_FOUND');
      const meters = movementMeters(item, requestedMeters);
      const balance = await transaction.stockBalance.updateMany({ where: { itemId, technicianId, quantity: { gte: quantity }, ...(meters ? { availableMeters: { gte: meters } } : {}) }, data: { quantity: { decrement: quantity }, ...(meters ? { availableMeters: { decrement: meters } } : {}) } });
      if (balance.count !== 1) throw new Error('INSUFFICIENT_TECHNICIAN_STOCK');
      await transaction.stockBalance.upsert({ where: { itemId_technicianId: { itemId, technicianId: destinationTechnicianId } }, create: { itemId, technicianId: destinationTechnicianId, quantity, availableMeters: meters }, update: { quantity: { increment: quantity }, ...(meters ? { availableMeters: { increment: meters } } : {}) } });
      const movement = await transaction.movement.create({ data: { type: 'TRANSFERENCIA', itemId, quantity, meters, technicianId: destinationTechnicianId, userId: currentUserId(response), origin: source.name, destination: destination.name, reason, notes: notes || null } });
      return { movement };
    });
    response.status(201).json(result);
  } catch (error) {
    const message = (error as Error).message;
    if (message === 'ITEM_NOT_FOUND') { response.status(404).json({ message: 'Item não encontrado.' }); return; }
    if (message === 'TECHNICIAN_NOT_FOUND') { response.status(404).json({ message: 'Técnico de origem ou destino não encontrado.' }); return; }
    if (message === 'CABLE_METERS_REQUIRED') { response.status(400).json({ message: 'Informe a metragem transferida para o cabeamento.' }); return; }
    if (message === 'INSUFFICIENT_TECHNICIAN_STOCK') { response.status(409).json({ message: 'O técnico de origem não possui essa quantidade.' }); return; }
    throw error;
  }
});

const movementEditSchema = z.object({
  type: z.enum(['ENTRADA', 'SAIDA', 'TRANSFERENCIA', 'DEVOLUCAO', 'AJUSTE', 'PERDA', 'AVARIA', 'BAIXA']).optional(),
  quantity: z.number().finite().nonnegative().optional(),
  meters: z.number().finite().positive().optional().nullable(),
  destination: z.string().trim().optional().nullable(),
  reason: z.string().trim().min(2).optional(),
  notes: z.string().trim().optional().nullable(),
});

router.patch('/movements/:id', requireRoles('DESENVOLVEDOR', 'ADMIN'), async (request, response) => {
  const parsed = movementEditSchema.safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ message: 'Dados da movimentação inválidos.' }); return; }
  const result = await prisma.movement.updateMany({ where: { id: request.params.id, archivedAt: null }, data: parsed.data });
  if (result.count !== 1) { response.status(404).json({ message: 'Movimentação não encontrada ou já arquivada.' }); return; }
  const movement = await prisma.movement.findUnique({ where: { id: request.params.id } });
  response.json({ movement });
});

router.delete('/movements/:id', requireRoles('DESENVOLVEDOR', 'ADMIN'), async (request, response) => {
  const result = await prisma.movement.updateMany({ where: { id: request.params.id, archivedAt: null }, data: { archivedAt: new Date() } });
  if (result.count !== 1) { response.status(404).json({ message: 'Movimentação não encontrada ou já arquivada.' }); return; }
  response.json({ message: 'Movimentação arquivada; histórico preservado.' });
});

router.get('/movements', async (request, response) => {
  const type = String(request.query.type ?? '');
  const auth = response.locals.auth as { role?: string; sub: string };
  let technicianId = request.query.technicianId ? String(request.query.technicianId) : undefined;
  // Técnico só enxerga o próprio histórico, mesmo que tente informar outro technicianId.
  if (auth?.role === 'TECNICO') {
    const technician = await prisma.technician.findUnique({ where: { userId: auth.sub } });
    if (!technician) { response.json({ movements: [] }); return; }
    technicianId = technician.id;
  }
  const movements = await prisma.movement.findMany({ take: 100, where: { archivedAt: null, ...(type && ['ENTRADA', 'SAIDA', 'TRANSFERENCIA', 'DEVOLUCAO', 'AJUSTE', 'PERDA', 'AVARIA', 'BAIXA'].includes(type) ? { type: type as 'ENTRADA' | 'SAIDA' | 'TRANSFERENCIA' | 'DEVOLUCAO' | 'AJUSTE' | 'PERDA' | 'AVARIA' | 'BAIXA' } : {}), ...(technicianId ? { technicianId } : {}) }, include: { item: { select: { code: true, name: true, unit: true } }, technician: { select: { name: true } }, user: { select: { name: true } } }, orderBy: { createdAt: 'desc' } });
  response.json({ movements });
});

router.get('/inventory-sessions', async (_request, response) => {
  const sessions = await prisma.inventorySession.findMany({ take: 30, include: { user: { select: { name: true } }, _count: { select: { counts: true } } }, orderBy: { startedAt: 'desc' } });
  response.json({ sessions });
});

router.post('/inventory-sessions', requireRoles('DESENVOLVEDOR', 'ADMIN', 'ALMOXARIFADO'), async (request, response) => {
  const parsed = inventorySessionSchema.safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ message: 'Nome do inventário é obrigatório.' }); return; }
  const session = await prisma.inventorySession.create({ data: { ...parsed.data, notes: parsed.data.notes || null, userId: currentUserId(response) } });
  response.status(201).json({ session });
});

router.post('/inventory-counts', requireRoles('DESENVOLVEDOR', 'ADMIN', 'ALMOXARIFADO'), async (request, response) => {
  const parsed = inventoryCountSchema.safeParse(request.body);
  if (!parsed.success) { response.status(400).json({ message: 'Sessão, item, quantidade física e motivo são obrigatórios.' }); return; }
  const { sessionId, itemId, physicalQuantity, reason, notes } = parsed.data;
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const [session, item] = await Promise.all([
        transaction.inventorySession.findUnique({ where: { id: sessionId } }),
        transaction.item.findUnique({ where: { id: itemId } }),
      ]);
      if (!session || session.status !== 'OPEN') throw new Error('SESSION_NOT_OPEN');
      if (!item || item.status !== 'ACTIVE') throw new Error('ITEM_NOT_FOUND');
      const systemQuantity = Number(item.quantity);
      const difference = physicalQuantity - systemQuantity;
      const count = await transaction.inventoryCount.upsert({ where: { sessionId_itemId: { sessionId, itemId } }, create: { sessionId, itemId, userId: currentUserId(response), systemQuantity, physicalQuantity, difference, reason, notes: notes || null }, update: { systemQuantity, physicalQuantity, difference, reason, notes: notes || null, userId: currentUserId(response), countedAt: new Date() } });
      if (difference !== 0) {
        await transaction.item.update({ where: { id: itemId }, data: { quantity: physicalQuantity } });
        await transaction.movement.create({ data: { type: 'AJUSTE', itemId, quantity: Math.abs(difference), userId: currentUserId(response), origin: difference < 0 ? 'Inventário físico' : 'Ajuste de inventário', destination: 'Almoxarifado', reason, notes: notes || `Sistema: ${systemQuantity}; físico: ${physicalQuantity}` } });
      }
      return { count, difference };
    });
    response.status(201).json(result);
  } catch (error) {
    const message = (error as Error).message;
    if (message === 'SESSION_NOT_OPEN') { response.status(409).json({ message: 'Esta sessão de inventário está encerrada.' }); return; }
    if (message === 'ITEM_NOT_FOUND') { response.status(404).json({ message: 'Item não encontrado.' }); return; }
    throw error;
  }
});

router.patch('/inventory-sessions/:id/complete', requireRoles('DESENVOLVEDOR', 'ADMIN', 'ALMOXARIFADO'), async (request, response) => {
  try {
    const session = await prisma.inventorySession.update({ where: { id: request.params.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
    response.json({ session });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2025') { response.status(404).json({ message: 'Sessão de inventário não encontrada.' }); return; }
    throw error;
  }
});

export { router as inventoryRoutes };
