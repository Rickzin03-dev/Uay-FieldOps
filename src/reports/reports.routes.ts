import { Router } from 'express';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware';
import { prisma } from '../config/prisma';

const router = Router();
router.use(requireAuth);

router.get('/stock.pdf', async (request, response) => {
  const dateSchema = z.object({ from: z.string().date().optional(), to: z.string().date().optional() });
  const parsed = dateSchema.safeParse({ from: request.query.from, to: request.query.to });
  if (!parsed.success) {
    response.status(400).json({ message: 'Período inválido.' });
    return;
  }
  const from = parsed.data.from ? new Date(`${parsed.data.from}T00:00:00.000Z`) : undefined;
  const to = parsed.data.to ? new Date(`${parsed.data.to}T23:59:59.999Z`) : undefined;
  const movements = await prisma.movement.findMany({
    where: { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } },
    include: { item: { select: { code: true, name: true, unit: true } }, technician: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  const auth = response.locals.auth as { sub: string };
  const user = await prisma.user.findUnique({ where: { id: auth.sub }, select: { name: true } });
  const document = new PDFDocument({ margin: 48 });
  response.setHeader('Content-Type', 'application/pdf');
  response.setHeader('Content-Disposition', 'attachment; filename="uay-movimentacoes.pdf"');
  document.pipe(response);
  document.rect(48, 42, 499, 70).fill('#07146f');
  document.rect(48, 106, 499, 6).fill('#ffd51f');
  document.fillColor('#ffd51f').fontSize(22).text('UAY INTERNET', 66, 56);
  document.fillColor('#ffffff').fontSize(10).text('CONTROLE DE ESTOQUE  |  ALMOXARIFADO', 66, 84);
  document.fillColor('#102a43').fontSize(18).text('RELATÓRIO COMPLETO DE MOVIMENTAÇÕES', 48, 132);
  document.fontSize(10).fillColor('#627d98').text(`Período: ${parsed.data.from || 'início'} até ${parsed.data.to || 'hoje'}`);
  document.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} por ${user?.name || 'Usuário'}`);
  const entryMovements = movements.filter((movement) => movement.type === 'ENTRADA');
  const issueMovements = movements.filter((movement) => movement.type === 'SAIDA');
  const adjustmentMovements = movements.filter((movement) => movement.type === 'AJUSTE');
  const entries = entryMovements.length;
  const issues = issueMovements.length;
  const adjustments = adjustmentMovements.length;
  const entryUnits = entryMovements.reduce((sum, movement) => sum + Number(movement.quantity), 0);
  const issueUnits = issueMovements.reduce((sum, movement) => sum + Number(movement.quantity), 0);
  const adjustmentUnits = adjustmentMovements.reduce((sum, movement) => sum + Number(movement.quantity), 0);
  const totalUnits = movements.reduce((sum, movement) => sum + Number(movement.quantity), 0);
  const technicianMovements = movements.filter((movement) => ['SAIDA', 'TRANSFERENCIA', 'DEVOLUCAO'].includes(movement.type) && (movement.technicianId || movement.destination));
  const technicianUnits = technicianMovements.reduce((sum, movement) => sum + Number(movement.quantity), 0);
  document.moveDown(1.4);
  document.fillColor('#07146f').fontSize(10).text(`RESUMO: ${entries} entradas | ${issues} saidas | ${adjustments} ajustes`);
  document.text(`QTD UN: Entradas ${entryUnits} | Saidas ${issueUnits} | Ajustes ${adjustmentUnits} | Total ${totalUnits}`);
  document.text(`ITENS MOVIMENTADOS PARA TECNICOS: ${technicianMovements.length} registros | ${technicianUnits} UN`);
  document.moveDown(1.2);
  document.rect(48, document.y, 499, 22).fill('#e8ebff');
  document.fillColor('#07146f').fontSize(8).text('DATA/HORA        TIPO        ITEM                         QTD   UNIDADE   DESTINO', 56, document.y + 7);
  document.moveDown(1.8);
  if (!movements.length) {
    document.fontSize(12).fillColor('#102a43').text('Nenhuma movimentação encontrada no período.');
  } else {
    movements.forEach((movement, index) => {
      if (index > 0) document.moveDown(.35);
      if (index % 2 === 1) document.rect(48, document.y - 3, 499, 48).fill('#f4f6ff');
      document.fontSize(10).fillColor('#102a43').text(`Data/hora: ${new Date(movement.createdAt).toLocaleString('pt-BR')}`);
      document.fontSize(9).fillColor('#627d98').text(`Tipo: ${movement.type}  |  Item: ${movement.item.name} (${movement.item.code})`);
      document.text(`Quantidade: ${movement.quantity}  |  Unidade: ${movement.item.unit || 'UN'}${movement.meters != null ? `  |  Metragem: ${movement.meters} m` : ''}  |  Destino: ${movement.technician?.name || movement.destination || 'Almoxarifado'}`);
      document.text(`Motivo: ${movement.reason || '-'}`);
      document.moveTo(48, document.y + 5).lineTo(547, document.y + 5).strokeColor('#dfe3f2').stroke();
    });
  }
  document.moveDown(.8);
  document.rect(48, document.y, 499, 34).fill('#07146f');
  document.fillColor('#ffd51f').fontSize(11).text(`TOTAL GERAL DA LISTA: ${totalUnits} UN`, 60, document.y + 8);
  document.fillColor('#ffffff').fontSize(8).text(`Total movimentado para tecnicos: ${technicianUnits} UN`, 60, document.y + 23);
  document.end();
});

router.get('/technician.pdf', async (request, response) => {
  const dateSchema = z.object({ from: z.string().date().optional(), to: z.string().date().optional(), technicianId: z.string().uuid().optional() });
  const parsed = dateSchema.safeParse({ from: request.query.from, to: request.query.to, technicianId: request.query.technicianId });
  if (!parsed.success) { response.status(400).json({ message: 'Filtros do relatório técnico inválidos.' }); return; }
  const from = parsed.data.from ? new Date(`${parsed.data.from}T00:00:00.000Z`) : undefined;
  const to = parsed.data.to ? new Date(`${parsed.data.to}T23:59:59.999Z`) : undefined;
  const orders = await prisma.serviceOrder.findMany({
    where: { status: 'FINALIZADA', ...(parsed.data.technicianId ? { technicianId: parsed.data.technicianId } : {}), finishedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } },
    include: { technician: { select: { name: true } } },
    orderBy: { finishedAt: 'desc' },
    take: 500,
  });
  const auth = response.locals.auth as { sub: string };
  const user = await prisma.user.findUnique({ where: { id: auth.sub }, select: { name: true } });
  const document = new PDFDocument({ margin: 48 });
  response.setHeader('Content-Type', 'application/pdf');
  response.setHeader('Content-Disposition', 'attachment; filename="uay-relatorio-tecnico.pdf"');
  document.pipe(response);
  document.rect(48, 42, 499, 70).fill('#07146f');
  document.rect(48, 106, 499, 6).fill('#ffd51f');
  document.fillColor('#ffd51f').fontSize(22).text('UAY INTERNET', 66, 56);
  document.fillColor('#ffffff').fontSize(10).text('CONTROLE DE ESTOQUE  |  OPERAÇÃO TÉCNICA', 66, 84);
  document.fillColor('#102a43').fontSize(18).text('RELATÓRIO TÉCNICO DE ORDENS DE SERVIÇO', 48, 132);
  document.fontSize(10).fillColor('#627d98').text(`Período: ${parsed.data.from || 'início'} até ${parsed.data.to || 'hoje'}`);
  document.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} por ${user?.name || 'Usuário'}`);
  const totalMinutes = orders.reduce((sum, order) => sum + (order.durationMinutes || 0), 0);
  document.moveDown(1.4);
  document.fillColor('#07146f').fontSize(10).text(`RESUMO: ${orders.length} O.S. finalizadas | ${totalMinutes} minutos registrados`);
  document.moveDown(1.2);
  if (!orders.length) {
    document.fontSize(12).fillColor('#102a43').text('Nenhuma O.S. finalizada encontrada no período.');
  } else {
    orders.forEach((order, index) => {
      if (index > 0) document.moveDown(.6);
      if (index % 2 === 1) document.rect(48, document.y - 4, 499, 90).fill('#f4f6ff');
      document.fontSize(11).fillColor('#07146f').text(`O.S. #${order.number}  |  ${order.technician.name}`);
      document.fontSize(9).fillColor('#102a43').text(`Cliente: ${order.customer}  |  Serviço: ${order.serviceType}`);
      document.text(`Finalizada: ${order.finishedAt ? new Date(order.finishedAt).toLocaleString('pt-BR') : '-'}  |  Duração: ${order.durationMinutes || 0} min`);
      document.text(`Observação: ${order.notes || 'Não informada'}`);
      const materials = Array.isArray(order.materialsUsed) ? order.materialsUsed as Array<{ name?: string; quantity?: number; unit?: string }> : [];
      document.text(`Utilizados: ${materials.length ? materials.map((material) => `${material.name || 'Item'} (${material.quantity || 0} ${material.unit || 'UN'})`).join(', ') : 'Nenhum registro'}  |  Evidências: ${Array.isArray(order.evidences) ? order.evidences.length : 0}`);
      document.moveTo(48, document.y + 5).lineTo(547, document.y + 5).strokeColor('#dfe3f2').stroke();
    });
  }
  document.moveDown(.8);
  document.rect(48, document.y, 499, 34).fill('#07146f');
  document.fillColor('#ffd51f').fontSize(11).text(`TOTAL DE O.S. FINALIZADAS: ${orders.length}`, 60, document.y + 8);
  document.fillColor('#ffffff').fontSize(8).text(`Tempo total registrado: ${totalMinutes} minutos`, 60, document.y + 23);
  document.end();
});

function styleReportSheet(sheet: ExcelJS.Worksheet, title: string, subtitle: string, columnCount: number) {
  sheet.mergeCells(1, 1, 1, columnCount);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { name: 'Aptos Display', size: 18, bold: true, color: { argb: 'FFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '07146F' } };
  titleCell.alignment = { vertical: 'middle' };
  sheet.getRow(1).height = 32;
  sheet.mergeCells(2, 1, 2, columnCount);
  sheet.getCell(2, 1).value = subtitle;
  sheet.getCell(2, 1).font = { italic: true, color: { argb: '627D98' } };
  sheet.getRow(4).height = 24;
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1827A8' } };
  row.alignment = { vertical: 'middle', horizontal: 'center' };
}

router.get('/stock.xlsx', async (request, response) => {
  const parsed = z.object({ from: z.string().date().optional(), to: z.string().date().optional() }).safeParse({ from: request.query.from, to: request.query.to });
  if (!parsed.success) { response.status(400).json({ message: 'Período inválido.' }); return; }
  const from = parsed.data.from ? new Date(`${parsed.data.from}T00:00:00.000Z`) : undefined;
  const to = parsed.data.to ? new Date(`${parsed.data.to}T23:59:59.999Z`) : undefined;
  const movements = await prisma.movement.findMany({ where: { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }, include: { item: { select: { code: true, name: true, unit: true } }, technician: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 500 });
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Uay Internet';
  const sheet = workbook.addWorksheet('Almoxarifado', { views: [{ state: 'frozen', ySplit: 6 }] });
  styleReportSheet(sheet, 'UAY INTERNET - RELATÓRIO DO ALMOXARIFADO', `Período: ${parsed.data.from || 'início'} até ${parsed.data.to || 'hoje'} | Gerado em ${new Date().toLocaleString('pt-BR')}`, 8);
  const total = movements.reduce((sum, movement) => sum + Number(movement.quantity), 0);
  sheet.getCell(4, 1).value = `Resumo: ${movements.length} movimentações | ${total} unidades movimentadas`;
  sheet.getCell(4, 1).font = { bold: true, color: { argb: '07146F' } };
  const header = sheet.addRow(['Data e hora', 'Tipo', 'Item', 'Código', 'Quantidade', 'Unidade', 'Metragem (m)', 'Técnico/Destino', 'Motivo']);
  styleHeader(header);
  sheet.columns = [{ width: 21 }, { width: 16 }, { width: 30 }, { width: 16 }, { width: 14 }, { width: 12 }, { width: 15 }, { width: 26 }, { width: 38 }];
  movements.forEach((movement, index) => {
    const row = sheet.addRow([new Date(movement.createdAt), movement.type, movement.item.name, movement.item.code, Number(movement.quantity), movement.item.unit || 'UN', movement.meters == null ? null : Number(movement.meters), movement.technician?.name || movement.destination || 'Almoxarifado', movement.reason || '-']);
    row.getCell(1).numFmt = 'dd/mm/yyyy hh:mm';
    row.getCell(5).numFmt = '#,##0.###';
    if (index % 2 === 1) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F4F6FF' } };
  });
  sheet.autoFilter = { from: { row: 6, column: 1 }, to: { row: Math.max(6, sheet.rowCount), column: 9 } };
  response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  response.setHeader('Content-Disposition', 'attachment; filename="uay-movimentacoes.xlsx"');
  await workbook.xlsx.write(response);
  response.end();
});

router.get('/technician.xlsx', async (request, response) => {
  const parsed = z.object({ from: z.string().date().optional(), to: z.string().date().optional(), technicianId: z.string().uuid().optional() }).safeParse({ from: request.query.from, to: request.query.to, technicianId: request.query.technicianId });
  if (!parsed.success) { response.status(400).json({ message: 'Filtros do relatório técnico inválidos.' }); return; }
  const from = parsed.data.from ? new Date(`${parsed.data.from}T00:00:00.000Z`) : undefined;
  const to = parsed.data.to ? new Date(`${parsed.data.to}T23:59:59.999Z`) : undefined;
  const orders = await prisma.serviceOrder.findMany({ where: { status: 'FINALIZADA', ...(parsed.data.technicianId ? { technicianId: parsed.data.technicianId } : {}), finishedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }, include: { technician: { select: { name: true } } }, orderBy: { finishedAt: 'desc' }, take: 500 });
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Uay Internet';
  const sheet = workbook.addWorksheet('Relatório técnico', { views: [{ state: 'frozen', ySplit: 6 }] });
  styleReportSheet(sheet, 'UAY INTERNET - RELATÓRIO TÉCNICO', `Período: ${parsed.data.from || 'início'} até ${parsed.data.to || 'hoje'} | Gerado em ${new Date().toLocaleString('pt-BR')}`, 9);
  const totalMinutes = orders.reduce((sum, order) => sum + (order.durationMinutes || 0), 0);
  sheet.getCell(4, 1).value = `Resumo: ${orders.length} O.S. finalizadas | ${totalMinutes} minutos registrados`;
  sheet.getCell(4, 1).font = { bold: true, color: { argb: '07146F' } };
  const header = sheet.addRow(['O.S.', 'Técnico', 'Cliente', 'Serviço', 'Finalizada em', 'Duração (min)', 'Observação', 'Materiais/equipamentos', 'Evidências']);
  styleHeader(header);
  sheet.columns = [{ width: 12 }, { width: 24 }, { width: 30 }, { width: 24 }, { width: 21 }, { width: 16 }, { width: 46 }, { width: 48 }, { width: 13 }];
  orders.forEach((order, index) => {
    const materials = Array.isArray(order.materialsUsed) ? order.materialsUsed as Array<{ name?: string; quantity?: number; unit?: string }> : [];
    const row = sheet.addRow([order.number, order.technician.name, order.customer, order.serviceType, order.finishedAt ? new Date(order.finishedAt) : null, order.durationMinutes || 0, order.notes || 'Não informada', materials.map((material) => `${material.name || 'Item'} (${material.quantity || 0} ${material.unit || 'UN'})`).join(', ') || 'Nenhum registro', Array.isArray(order.evidences) ? order.evidences.length : 0]);
    row.getCell(5).numFmt = 'dd/mm/yyyy hh:mm';
    row.getCell(6).numFmt = '#,##0';
    row.alignment = { vertical: 'top', wrapText: true };
    if (index % 2 === 1) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F4F6FF' } };
  });
  sheet.autoFilter = { from: { row: 6, column: 1 }, to: { row: Math.max(6, sheet.rowCount), column: 9 } };
  response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  response.setHeader('Content-Disposition', 'attachment; filename="uay-relatorio-tecnico.xlsx"');
  await workbook.xlsx.write(response);
  response.end();
});

export { router as reportsRoutes };
