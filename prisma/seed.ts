import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function usernameFromName(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
}

async function main() {
  const accounts = [
    { name: 'Desenvolvedor Uay', username: 'desenvolvedor', email: 'desenvolvedor@uayinternet.com.br', password: 'Dev@12345', role: 'DESENVOLVEDOR' as const },
    { name: 'Almoxarifado Uay', username: 'almoxarifado', email: 'almoxarifado@uayinternet.com.br', password: 'Almox@12345', role: 'ALMOXARIFADO' as const },
    { name: 'Diretoria Uay', username: 'diretoria', email: 'donos@uayinternet.com.br', password: 'Donos@12345', role: 'DONO' as const },
    { name: 'Gestão Uay', username: 'gestao', email: 'gestao@uayinternet.com.br', password: 'Gestao@12345', role: 'GESTOR' as const },
    { name: 'Administrador Uay', username: 'admin', email: 'admin@uayinternet.com.br', password: 'Admin@12345', role: 'ADMIN' as const },
  ];
  for (const account of accounts) {
    await prisma.user.upsert({
      where: { username: account.username },
      update: { username: account.username, passwordHash: await bcrypt.hash(account.password, 12), status: 'ACTIVE', role: account.role, name: account.name },
      create: { name: account.name, username: account.username, email: account.email, passwordHash: await bcrypt.hash(account.password, 12), role: account.role, status: 'ACTIVE' },
    });
  }
  const technicians = ['Kaique', 'Mateus', 'Walison', 'Valdenilson', 'Gleidson Terceirizado', 'Wanderson', 'Bruno', 'Cleidson'];
  for (const name of technicians) {
    const username = usernameFromName(name);
    const technicianUser = await prisma.user.upsert({
      where: { username },
      update: { name, username, passwordHash: await bcrypt.hash('Tecnico@12345', 12), role: 'TECNICO', status: 'ACTIVE' },
      create: { name, username, email: `${username}@uayinternet.com.br`, passwordHash: await bcrypt.hash('Tecnico@12345', 12), role: 'TECNICO', status: 'ACTIVE' },
    });
    const existing = await prisma.technician.findFirst({ where: { name } });
    if (existing) await prisma.technician.update({ where: { id: existing.id }, data: { userId: technicianUser.id, active: true, position: existing.position || 'Técnico de campo' } });
    else await prisma.technician.create({ data: { name, position: 'Técnico de campo', active: true, userId: technicianUser.id } });
  }
  const technicianMaterialsCategory = await prisma.category.upsert({ where: { name: 'Materiais para técnicos' }, create: { name: 'Materiais para técnicos' }, update: {} });
  for (const connector of [
    { code: 'CON-UPC', name: 'Conector UPC' },
    { code: 'CON-APC', name: 'Conector APC' },
  ]) {
    await prisma.item.upsert({
      where: { code: connector.code },
      update: { name: connector.name, type: 'MATERIAL', status: 'ACTIVE', categoryId: technicianMaterialsCategory.id, unit: 'UN' },
      create: { ...connector, type: 'MATERIAL', status: 'ACTIVE', condition: 'NOVO', unit: 'UN', quantity: 0, minimum: 0, categoryId: technicianMaterialsCategory.id },
    });
  }
  const kaiqueUser = await prisma.user.findUnique({ where: { username: 'kaique' } });
  const kaiqueTechnician = await prisma.technician.findFirst({ where: { name: 'Kaique' } });
  if (kaiqueUser && kaiqueTechnician) {
    const pdfContent = 'BT\n/F1 20 Tf\n72 760 Td\n(UAY INTERNET - ORDEM DE SERVICO) Tj\n/F1 13 Tf\n0 -38 Td\n(O.S. 41517) Tj\n0 -24 Td\n(Cliente: Walker Carvalho Pereira 2 ponto) Tj\n0 -24 Td\n(Endereco: Rua Quarenta e Dois, 18 - Alterosa) Tj\n0 -24 Td\n(Servico: Visita Tecnica) Tj\n0 -24 Td\n(Tecnico responsavel: Kaique) Tj\n0 -24 Td\n(Observacao: Cliente relata instabilidade na rede cabeada.) Tj\nET';
    const samplePdf = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n5 0 obj\n<< /Length ${pdfContent.length} >>\nstream\n${pdfContent}\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000063 00000 n \n0000000120 00000 n \n0000000246 00000 n \n0000000316 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${316 + pdfContent.length + 55}\n%%EOF`;
    const samplePdfUrl = `data:application/pdf;base64,${Buffer.from(samplePdf).toString('base64')}`;
    const equipmentCategory = await prisma.category.upsert({ where: { name: 'Equipamentos de campo' }, create: { name: 'Equipamentos de campo' }, update: {} });
    const fieldEquipment = [
      { code: 'EQ-KAIQUE-ONU-001', name: 'ONU Huawei', serialNumber: 'ONU-KAIQUE-001', assetNumber: 'PAT-KAIQUE-001' },
      { code: 'EQ-KAIQUE-ROT-001', name: 'Roteador Huawei AX2', serialNumber: 'ROT-KAIQUE-001', assetNumber: 'PAT-KAIQUE-002' },
      { code: 'EQ-KAIQUE-FUS-001', name: 'Máquina de fusão', serialNumber: 'FUS-KAIQUE-001', assetNumber: 'PAT-KAIQUE-003' },
      { code: 'EQ-KAIQUE-PWR-001', name: 'Power Meter', serialNumber: 'PWR-KAIQUE-001', assetNumber: 'PAT-KAIQUE-004' },
      { code: 'EQ-KAIQUE-ESC-001', name: 'Escada fibra', serialNumber: 'ESC-KAIQUE-001', assetNumber: 'PAT-KAIQUE-005' },
    ];
    for (const equipment of fieldEquipment) {
      const item = await prisma.item.upsert({
        where: { code: equipment.code },
        update: { name: equipment.name, type: 'EQUIPAMENTO', status: 'ACTIVE', categoryId: equipmentCategory.id, quantity: 0, serialNumber: equipment.serialNumber, assetNumber: equipment.assetNumber },
        create: { ...equipment, type: 'EQUIPAMENTO', status: 'ACTIVE', condition: 'BOM', unit: 'UN', quantity: 0, categoryId: equipmentCategory.id },
      });
      await prisma.stockBalance.upsert({ where: { itemId_technicianId: { itemId: item.id, technicianId: kaiqueTechnician.id } }, create: { itemId: item.id, technicianId: kaiqueTechnician.id, quantity: 1 }, update: { quantity: 1 } });
    }
    const now = new Date();
    const examples = [
      { number: '10254', customer: 'Cliente Uay 01', serviceType: 'Instalação', hoursAgo: 2, duration: 78 },
      { number: '10251', customer: 'Cliente Uay 02', serviceType: 'Manutenção', hoursAgo: 4, duration: 42 },
      { number: '10230', customer: 'Cliente Uay 03', serviceType: 'Reparo', hoursAgo: 26, duration: 55 },
    ];
    for (const order of examples) {
      const finishedAt = new Date(now.getTime() - order.hoursAgo * 60 * 60 * 1000);
      const startedAt = new Date(finishedAt.getTime() - order.duration * 60 * 1000);
      const { hoursAgo: _hoursAgo, duration, ...serviceOrder } = order;
      await prisma.serviceOrder.upsert({
        where: { number: order.number },
        update: {},
        create: { ...serviceOrder, status: 'FINALIZADA', startedAt, finishedAt, durationMinutes: duration, technicianId: kaiqueTechnician.id, userId: kaiqueUser.id, materialsUsed: [{ name: 'Drop 1 FO', quantity: 1, unit: 'UN' }], evidences: [{ type: 'foto', name: 'Evidência de conclusão' }] },
      });
    }
    await prisma.serviceOrder.upsert({
      where: { number: '41517' },
      update: { status: 'PENDENTE', technicianId: kaiqueTechnician.id, userId: kaiqueUser.id, pdfUrl: samplePdfUrl, pdfName: 'OS-41517.pdf' },
      create: {
        number: '41517',
        customer: 'Walker Carvalho Pereira 2 ponto',
        address: 'Rua Quarenta e Dois, 18 - Alterosa, Ribeirão das Neves/MG - Quadra 54, bloco 05, AP 504',
        serviceType: 'Visita Técnica',
        description: 'Cliente relata instabilidade e plano contratado não chegando pela rede cabeada. Sinal Rx: -28.53 / Tx: -30.97.',
        status: 'PENDENTE',
        scheduledAt: new Date('2026-09-02T09:00:58-03:00'),
        pdfUrl: samplePdfUrl,
        pdfName: 'OS-41517.pdf',
        materialsUsed: [
          { name: 'ONU', quantity: 1, unit: 'UN' },
          { name: 'Roteador', quantity: 1, unit: 'UN' },
          { name: 'Conector', quantity: 2, unit: 'UN' },
          { name: 'Fibra drop', quantity: 100, unit: 'm' },
        ],
        evidences: [],
        technicianId: kaiqueTechnician.id,
        userId: kaiqueUser.id,
      },
    });
  }
  console.log('Contas iniciais e logins dos técnicos criados/atualizados. Senha dos técnicos: Tecnico@12345.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
