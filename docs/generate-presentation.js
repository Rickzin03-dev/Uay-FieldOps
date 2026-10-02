const pptxgen = require('pptxgenjs');

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'Uay Internet';
pptx.subject = 'Apresentacao do sistema de controle de estoque';
pptx.title = 'Controle de Estoque - Uay Internet';
pptx.company = 'Uay Internet';
pptx.lang = 'pt-BR';
pptx.theme = {
  headFontFace: 'Aptos Display',
  bodyFontFace: 'Aptos',
  lang: 'pt-BR',
};
pptx.defineLayout({ name: 'UAY_WIDE', width: 13.333, height: 7.5 });
pptx.layout = 'UAY_WIDE';

const colors = { navy: '07146F', deep: '030B52', yellow: 'FFD51F', white: 'FFFFFF', ink: '102A43', muted: '5F6B91', pale: 'F4F6FF', line: 'DFE3F2' };

function addBrand(slide) {
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.18, fill: { color: colors.yellow }, line: { color: colors.yellow } });
  slide.addText('UAY INTERNET', { x: 0.55, y: 0.35, w: 2.5, h: 0.3, fontFace: 'Aptos Display', fontSize: 13, bold: true, color: colors.navy, margin: 0 });
  slide.addText('CONTROLE DE ESTOQUE', { x: 0.55, y: 0.68, w: 2.5, h: 0.2, fontSize: 7.5, bold: true, color: colors.muted, charSpacing: 1.2, margin: 0 });
  slide.addText('Uay Internet | Apresentacao do sistema', { x: 9.2, y: 7.05, w: 3.55, h: 0.18, fontSize: 7.5, color: colors.muted, align: 'right', margin: 0 });
}

function addTitle(slide, title, subtitle) {
  addBrand(slide);
  slide.addText(title, { x: 0.55, y: 1.12, w: 12.1, h: 0.48, fontFace: 'Aptos Display', fontSize: 25, bold: true, color: colors.navy, margin: 0 });
  if (subtitle) slide.addText(subtitle, { x: 0.55, y: 1.72, w: 11.8, h: 0.28, fontSize: 11, color: colors.muted, margin: 0 });
}

function addCard(slide, x, y, w, h, title, body, accent = colors.navy) {
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: colors.white }, line: { color: colors.line, width: 1 } });
  slide.addShape(pptx.ShapeType.rect, { x, y, w: 0.08, h, fill: { color: accent }, line: { color: accent } });
  slide.addText(title, { x: x + 0.28, y: y + 0.25, w: w - 0.45, h: 0.28, fontSize: 13, bold: true, color: colors.ink, margin: 0 });
  slide.addText(body, { x: x + 0.28, y: y + 0.68, w: w - 0.45, h: h - 0.9, fontSize: 10.5, color: colors.muted, breakLine: false, bullet: { indent: 14 }, paraSpaceAfterPt: 8, margin: 0.03, valign: 'top' });
}

function addBullets(slide, x, y, w, items, fontSize = 13) {
  slide.addText(items.map((text) => ({ text, options: { bullet: { indent: 14 } } })), { x, y, w, h: items.length * 0.42 + 0.2, fontSize, color: colors.ink, breakLine: true, paraSpaceAfterPt: 9, margin: 0.03 });
}

// Capa
{
  const slide = pptx.addSlide();
  slide.background = { color: colors.deep };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.18, fill: { color: colors.yellow }, line: { color: colors.yellow } });
  slide.addShape(pptx.ShapeType.roundRect, { x: 0.7, y: 0.65, w: 2.55, h: 1.15, rectRadius: 0.12, fill: { color: colors.navy }, line: { color: colors.navy } });
  slide.addText('UAY\nINTERNET', { x: 0.9, y: 0.83, w: 2.15, h: 0.68, fontFace: 'Aptos Display', fontSize: 25, bold: true, color: colors.yellow, align: 'center', margin: 0, breakLine: false });
  slide.addText('CONTROLE DE ESTOQUE', { x: 0.8, y: 2.55, w: 8.5, h: 0.56, fontFace: 'Aptos Display', fontSize: 35, bold: true, color: colors.white, margin: 0 });
  slide.addText('Sistema web de controle de estoque integrado ao aplicativo dos tecnicos para materiais, ativos de campo e rastreabilidade operacional.', { x: 0.8, y: 3.35, w: 8.2, h: 0.95, fontSize: 18, color: 'DCE4FF', margin: 0, breakLine: false });
  slide.addShape(pptx.ShapeType.arc, { x: 9.0, y: 3.55, w: 4.8, h: 4.8, adjustPoint: 0.3, line: { color: '5261B7', width: 1.5, transparency: 35 }, fill: { color: colors.deep, transparency: 100 } });
  slide.addText('Apresentacao corporativa', { x: 0.8, y: 6.52, w: 3, h: 0.25, fontSize: 11, bold: true, color: colors.yellow, margin: 0 });
  slide.addText('Uay Internet | Almoxarifado', { x: 0.8, y: 6.84, w: 4, h: 0.22, fontSize: 10, color: 'DCE4FF', margin: 0 });
}

// Fases do projeto
{
  const slide = pptx.addSlide();
  addTitle(slide, 'Fases do projeto', 'Evolucao do controle de estoque ate a operacao integrada em campo.');
  addCard(slide, 0.6, 2.05, 3.9, 3.85, 'Base e controle web', 'Autenticacao e permissoes\nDashboard e indicadores\nCadastro de materiais e categorias\nEntradas, saidas e saldos\nInventario e historico', colors.navy);
  addCard(slide, 4.72, 2.05, 3.9, 3.85, 'Ativos e rastreabilidade', 'Ferramentas, EPIs e equipamentos\nPatrimonio e numero de serie\nBarcode e QR Code\nTransferencias e devolucoes\nRelatorios em PDF', colors.yellow);
  addCard(slide, 8.84, 2.05, 3.9, 3.85, 'Operacao mobile', 'Aplicativo Expo para tecnicos\nLogin e sessao segura\nMinha Caixa\nHistorico e ordens de servico\nScanner de QR Code e barcode', colors.navy);
}

// Sistema web
{
  const slide = pptx.addSlide();
  addTitle(slide, 'Sistema web de controle de estoque', 'A operacao administrativa centralizada para o almoxarifado e a gestao.');
  addBullets(slide, 0.75, 2.1, 5.7, ['Dashboard com indicadores de estoque e movimentacao.', 'Cadastro e organizacao de materiais, ferramentas, EPIs e equipamentos.', 'Controle de entradas, saidas, transferencias, devolucoes e ajustes.', 'Inventario fisico com registro de divergencias.', 'Relatorios em PDF e exportacoes para acompanhamento da gestao.']);
  addCard(slide, 7.0, 2.05, 5.5, 3.9, 'Controle centralizado', 'Perfis de acesso por responsabilidade.\nSaldos atualizados em tempo real.\nHistorico auditavel de cada movimentacao.\nBusca por nome, codigo, serie, patrimonio, barcode ou QR Code.', colors.yellow);
}

// Aplicativo mobile
{
  const slide = pptx.addSlide();
  addTitle(slide, 'Aplicativo dos tecnicos', 'Acesso mobile para consultar responsabilidades e registrar a operacao de campo.');
  addCard(slide, 0.6, 2.05, 3.9, 3.9, 'Minha Caixa', 'Visualizacao dos materiais, ferramentas, EPIs e equipamentos sob responsabilidade de cada tecnico.\nBusca por nome, codigo, serie ou patrimonio.', colors.yellow);
  addCard(slide, 4.72, 2.05, 3.9, 3.9, 'Scanner', 'Leitura de QR Code e codigo de barras pela camera.\nConsulta imediata do item, saldo, serie, patrimonio e situacao.', colors.navy);
  addCard(slide, 8.84, 2.05, 3.9, 3.9, 'Operacao em campo', 'Ordens de servico, historico de atividades, devolucoes e acesso a documentos.\nO app usa a mesma API e o mesmo banco do sistema web.', colors.yellow);
}

// Objetivo
{
  const slide = pptx.addSlide();
  addTitle(slide, 'Objetivo do sistema', 'Centralizar o controle do almoxarifado e dar visibilidade a toda a operacao.');
  addCard(slide, 0.6, 2.25, 3.9, 3.3, 'Rastreabilidade', 'Saber o que entrou, saiu, foi devolvido, ajustado ou entregue a cada tecnico.', colors.yellow);
  addCard(slide, 4.7, 2.25, 3.9, 3.3, 'Controle operacional', 'Manter saldos atualizados, itens organizados por grupo e responsabilidades de campo.', colors.teal || colors.navy);
  addCard(slide, 8.8, 2.25, 3.9, 3.3, 'Gestao', 'Acompanhar indicadores, inventario e relatorios para apoiar decisoes da empresa.', colors.yellow);
}

// Dashboard
{
  const slide = pptx.addSlide();
  addTitle(slide, 'Dashboard', 'Visao geral imediata do almoxarifado.');
  addCard(slide, 0.6, 2.15, 3.8, 3.6, 'Indicadores', 'Materiais cadastrados\nQuantidade em estoque\nEntradas e saidas\nTecnicos ativos', colors.yellow);
  addCard(slide, 4.75, 2.15, 3.8, 3.6, 'Movimentacao visual', 'Grafico de entradas, saidas e saldo.\nQuantidade detalhada ao passar o cursor nas barras.', colors.navy);
  addCard(slide, 8.9, 2.15, 3.8, 3.6, 'Atualizacao automatica', 'Os indicadores refletem as operacoes realizadas sem necessidade de atualizar a pagina.', colors.yellow);
}

// Estoque e materiais
{
  const slide = pptx.addSlide();
  addTitle(slide, 'Estoque e materiais para tecnicos', 'Cadastro organizado por grupos e consulta rapida de saldo.');
  addBullets(slide, 0.75, 2.15, 5.7, ['Busca por nome ou codigo.', 'Saldo atualizado com entradas e saidas.', 'Importacao de lista CSV.', 'Identificacao por codigo, patrimonio, serie, barcode ou QR Code.']);
  addCard(slide, 7.0, 2.05, 5.5, 3.8, 'Materiais para tecnicos', 'Roteadores\nBobinas e cabos Drop\nConectores e RJ45\nMiguelao, abracadeiras, splitters, alcas e suportes', colors.yellow);
}

// Operacao de campo
{
  const slide = pptx.addSlide();
  addTitle(slide, 'Operacao de campo', 'Itens separados de acordo com sua utilizacao e responsabilidade.');
  addCard(slide, 0.6, 2.1, 3.9, 3.8, 'Ferramentas', 'Alicates, chaves, macaricos, maquina de fusao e itens reutilizaveis.', colors.navy);
  addCard(slide, 4.72, 2.1, 3.9, 3.8, 'EPIs', 'Capacete, oculos, luvas, botina, colete, cinturao, talabarte e capa de chuva.', colors.yellow);
  addCard(slide, 8.84, 2.1, 3.9, 3.8, 'Ativos e seguranca', 'Ativos de campo, equipamentos de seguranca e sinalizacao, patrimonio, serie e estado.', colors.navy);
}

// Tecnicos
{
  const slide = pptx.addSlide();
  addTitle(slide, 'Tecnicos e Caixa do tecnico', 'Responsabilidade individual dos materiais e ativos entregues em campo.');
  addCard(slide, 0.6, 2.1, 5.8, 3.7, 'Tecnicos cadastrados', 'Kaique\nMateus\nWalison\nValdenilson\nGleidson Terceirizado\nWanderson\nBruno\nCleidson', colors.yellow);
  addCard(slide, 6.9, 2.1, 5.8, 3.7, 'Caixa do tecnico', 'Consulta dos materiais, ferramentas, EPIs e ativos sob responsabilidade.\nHistorico individual de movimentacoes.\nTela de estoque individual para gestao de itens.', colors.navy);
}

// Movimentacoes e inventario
{
  const slide = pptx.addSlide();
  addTitle(slide, 'Movimentacoes e inventario', 'Historico auditavel e conferencia fisica do almoxarifado.');
  addCard(slide, 0.6, 2.1, 5.8, 3.8, 'Movimentacoes', 'Entradas\nSaidas\nTransferencias\nDevolucoes\nAjustes\nPerdas, avarias e baixas\nBusca de saldo por material', colors.navy);
  addCard(slide, 6.9, 2.1, 5.8, 3.8, 'Inventario', 'Conferencia de um material por vez.\nIndicadores de conferidos, pendentes e divergentes.\nDiferencas registradas como ajuste no historico.', colors.yellow);
}

// Relatorios
{
  const slide = pptx.addSlide();
  addTitle(slide, 'Central de relatorios', 'Documentos profissionais para gestao e apresentacao.');
  addCard(slide, 0.6, 2.0, 4.0, 4.0, 'PDF corporativo', 'Marca Uay Internet\nCabecalho azul e amarelo\nPeriodo e data de geracao\nResumo de entradas, saidas e ajustes', colors.yellow);
  addCard(slide, 4.67, 2.0, 4.0, 4.0, 'Detalhamento', 'Data e hora\nTipo de movimentacao\nItem e codigo\nQuantidade UN\nDestino e motivo', colors.navy);
  addCard(slide, 8.74, 2.0, 4.0, 4.0, 'Resumo final', 'Total geral de unidades\nTotal movimentado para tecnicos\nLinhas organizadas e leitura para gestao', colors.yellow);
}

// Perfis
{
  const slide = pptx.addSlide();
  addTitle(slide, 'Perfis de acesso', 'Permissoes adequadas a cada responsabilidade da operacao.');
  addCard(slide, 0.6, 2.1, 2.85, 3.7, 'Desenvolvedor', 'Acesso total\nEdicao e arquivamento\nAdministracao de usuarios', colors.navy);
  addCard(slide, 3.65, 2.1, 2.85, 3.7, 'Almoxarifado', 'Cadastros\nEntradas e saidas\nInventario e relatorios', colors.yellow);
  addCard(slide, 6.7, 2.1, 2.85, 3.7, 'Donos e Gestao', 'Fiscalizacao\nConsultas\nIndicadores e relatorios', colors.navy);
  addCard(slide, 9.75, 2.1, 2.85, 3.7, 'Tecnico', 'Consulta da propria caixa\nScanner de QR Code e barcode\nOrdens e historico no aplicativo', colors.yellow);
}

// Fluxo final
{
  const slide = pptx.addSlide();
  slide.background = { color: colors.deep };
  slide.addText('FLUXO OPERACIONAL', { x: 0.75, y: 0.7, w: 5, h: 0.4, fontFace: 'Aptos Display', fontSize: 25, bold: true, color: colors.yellow, margin: 0 });
  slide.addText('Controle completo do ciclo de materiais da Uay Internet.', { x: 0.75, y: 1.25, w: 6.5, h: 0.28, fontSize: 13, color: 'DCE4FF', margin: 0 });
  const steps = ['Fornecedor', 'Web / Almoxarifado', 'App / Tecnico', 'Uso em campo', 'Devolucao / Baixa', 'Relatorio'];
  steps.forEach((step, index) => {
    const x = 0.75 + index * 2.05;
    slide.addShape(pptx.ShapeType.roundRect, { x, y: 3.0, w: 1.6, h: 0.8, rectRadius: 0.08, fill: { color: index % 2 ? colors.yellow : '1B2B92' }, line: { color: index % 2 ? colors.yellow : '1B2B92' } });
    slide.addText(step, { x: x + 0.1, y: 3.26, w: 1.4, h: 0.22, fontSize: 10, bold: true, color: index % 2 ? colors.deep : colors.white, align: 'center', margin: 0 });
    if (index < steps.length - 1) slide.addText('→', { x: x + 1.67, y: 3.22, w: 0.25, h: 0.25, fontSize: 18, color: colors.yellow, align: 'center', margin: 0 });
  });
  slide.addText('Web e mobile conectados para dar mais controle, rastreabilidade e visibilidade a toda a operacao.', { x: 0.75, y: 6.2, w: 10, h: 0.3, fontSize: 16, color: colors.white, margin: 0 });
  slide.addText('UAY INTERNET | CONTROLE DE ESTOQUE', { x: 0.75, y: 6.75, w: 5.5, h: 0.2, fontSize: 9, bold: true, color: colors.yellow, margin: 0 });
}

pptx.writeFile({ fileName: 'apresentacao-controle-estoque-uay.pptx' });
