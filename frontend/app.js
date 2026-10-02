// URL da API centralizada em um único ponto: config.js (carregado antes deste arquivo no index.html).
// Em produção, basta editar frontend/config.js (ou definir window.UAY_CONFIG.apiUrl) para apontar para o domínio oficial da API
// (ex.: https://api.estoque.uay.com.br/api) — nunca fixar IP local ou localhost como valor definitivo aqui.
const API_URL = (window.UAY_CONFIG && window.UAY_CONFIG.apiUrl)
  || (window.location.protocol === 'http:' || window.location.protocol === 'https:'
    ? `${window.location.protocol}//${window.location.hostname}:3333/api`
    : 'http://localhost:3333/api');
const app = document.querySelector('#app');
const sessionKey = 'uay-session';
const networkFetch = window.fetch.bind(window);

function safeText(value, fallback = '-') { return value === undefined || value === null || String(value).trim() === '' ? fallback : String(value); }
function setSubmitting(form, submitting, label = 'Processando...') {
  const button = form?.querySelector('button[type="submit"]');
  if (!button) return;
  if (submitting) {
    button.dataset.originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = label;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalLabel || button.textContent;
  }
}
function canManage() { const session = JSON.parse(localStorage.getItem(sessionKey) || 'null'); return ['ADMIN', 'DESENVOLVEDOR'].includes(session?.user?.role); }
function canResetServiceOrders() { const session = JSON.parse(localStorage.getItem(sessionKey) || 'null'); return session?.user?.role === 'DESENVOLVEDOR'; }

const icons = { dashboard: '⌂', stock: '▦', materials: '◈', tools: '⌁', epi: '◇', equipment: '▣', 'client-equipment': '◎', safety: '⚠', technicians: '♙', movements: '↕', 'field-kit': '▤', 'service-orders': '▧', inventory: '✓', reports: '▥', 'technical-reports': '♙', users: '◎', settings: '⚙' };
const moduleLabels = { dashboard: 'Dashboard', stock: 'Estoque', materials: 'Materiais para técnicos', tools: 'Ferramentas', epi: 'EPIs', equipment: 'Ativos de campo', 'client-equipment': 'Equipamentos em clientes', safety: 'Equipamentos de Segurança e Sinalização', technicians: 'Técnicos', movements: 'Movimentações', 'field-kit': 'Caixa do técnico', 'service-orders': 'Ordens de Serviço', inventory: 'Inventário', reports: 'Relatórios', 'technical-reports': 'Relatório técnico', users: 'Usuários', settings: 'Configurações' };

function passwordField(id, label) {
  return `<div class="field"><label for="${id}">${label}</label><input class="password-input" id="${id}" type="password" required><button class="password-toggle" type="button" data-toggle-password="${id}" aria-label="Mostrar senha">◉</button></div>`;
}

function brandMarkup(sidebar = false) {
  return `<div class="brand"><img class="brand-logo${sidebar ? ' sidebar-logo' : ''}" src="Logo.png.png" alt="Uay Internet" onload="this.parentElement.lastElementChild.style.display='none'" onerror="if(this.dataset.fallback){this.style.display='none';this.nextElementSibling.style.display='flex'}else{this.dataset.fallback='1';this.src='logo.svg'}"><div class="logo-mark" style="display:none">U</div></div>`;
}

function renderWelcome() {
  renderLogin();
}

function renderLogin(container = app) {
  container.innerHTML = `<main class="login-page horizontal-login"><div class="login-track"><section class="login-art welcome-side" data-login-panel="welcome">${brandMarkup()}<div class="provider-scene" aria-hidden="true"><div class="network-grid"></div><div class="signal signal-one"></div><div class="signal signal-two"></div><div class="signal signal-three"></div><div class="provider-tower"><span class="tower-light"></span><span class="tower-face"></span><span class="tower-base"></span></div><div class="network-node node-one"></div><div class="network-node node-two"></div><div class="network-node node-three"></div><div class="network-line line-one"></div><div class="network-line line-two"></div><div class="network-line line-three"></div></div><div class="art-copy"><h1>O estoque certo<br>para cada equipe.</h1><p>Rastreabilidade clara para materiais, ferramentas e equipamentos em cada etapa da operação.</p></div><button class="continue-button" id="continue-login" type="button">Continuar <span>→</span></button><div class="art-meta"><span>● Operação conectada</span><span>↗ Pronto para campo</span></div></section><section class="login-panel login-side" data-login-panel="login"><form class="form-card" id="login-form"><button class="back-btn" id="back-to-welcome" type="button">← Voltar</button><h2>Bem-vindo</h2><p>Entre para acompanhar o almoxarifado da Uay Internet.</p><div class="notice" id="form-notice"></div><div class="field"><label for="username">Usuário</label><input id="username" type="text" placeholder="Digite seu usuário" autocomplete="username" required></div>${passwordField('password', 'Senha')}<button class="primary-btn" type="submit">Entrar no sistema</button><div class="form-actions"><button class="text-btn" type="button" data-screen="forgot">Esqueci minha senha</button><button class="text-btn" type="button" data-screen="signup">Criar novo acesso</button></div></form></section></div></main>`;
  bindCommonActions(container);
  container.querySelector('#login-form').addEventListener('submit', handleLogin);
  const horizontalLogin = container.querySelector('.horizontal-login');
  const revealLogin = () => horizontalLogin.classList.add('is-revealed');
  container.querySelector('[data-login-panel="welcome"]').addEventListener('mouseenter', revealLogin, { once: true });
  container.querySelector('#continue-login').addEventListener('click', revealLogin);
  container.querySelector('#back-to-welcome').addEventListener('click', () => horizontalLogin.classList.remove('is-revealed'));
}

function renderForgot() {
  app.innerHTML = `<section class="login-page"><div class="login-art">${brandMarkup()}<div class="art-copy"><h1>Recupere seu acesso.</h1><p>Enviaremos instruções seguras para o endereço informado, sem revelar se ele está cadastrado.</p></div></div><div class="login-panel"><form class="form-card" id="forgot-form"><button class="back-btn" type="button" data-screen="login">← Voltar para o login</button><h2>Recuperar acesso</h2><p>Informe o e-mail cadastrado para receber um código de recuperação.</p><div class="notice" id="form-notice"></div><div class="field"><label for="email">E-mail cadastrado</label><input id="email" type="email" placeholder="nome@uayinternet.com.br" required></div><button class="primary-btn" type="submit">Enviar código de recuperação</button></form></div></section>`;
  bindCommonActions();
  document.querySelector('#forgot-form').addEventListener('submit', handleForgot);
}

function renderSignup() {
  app.innerHTML = `<section class="login-page"><div class="login-art">${brandMarkup()}<div class="art-copy"><h1>Um acesso para fazer acontecer.</h1><p>Solicite seu perfil e aguarde a aprovação conforme as regras da operação.</p></div></div><div class="login-panel"><form class="form-card" id="signup-form"><button class="back-btn" type="button" data-screen="login">← Voltar para o login</button><h2>Criar novo acesso</h2><p>Preencha seus dados e escolha o perfil solicitado. A liberação depende de aprovação.</p><div class="notice" id="form-notice"></div><div class="field"><label for="name">Nome completo</label><input id="name" required></div><div class="field"><label for="username">Nome de usuário</label><input id="username" pattern="[A-Za-z0-9._-]+" placeholder="ex: kaique" required></div>${passwordField('new-password', 'Senha')}${passwordField('confirm-password', 'Confirmar senha')}<div class="field"><label for="phone">Telefone</label><input id="phone" type="tel" placeholder="(00) 00000-0000"></div><div class="field"><label for="role">Perfil de acesso solicitado</label><select id="role" required><option value="TECNICO">Técnico</option><option value="ALMOXARIFADO">Almoxarifado</option><option value="GESTOR">Gestor</option><option value="DONO">Diretoria</option></select></div><button class="primary-btn" type="submit">Solicitar acesso</button></form></div></section>`;
  bindCommonActions();
  document.querySelector('#signup-form').addEventListener('submit', handleSignup);
}

function renderDashboard(user) {
  const allNav = [['dashboard','Dashboard'],['stock','Estoque'],['materials','Materiais para técnicos'],['tools','Ferramentas'],['epi','EPIs'],['equipment','Ativos de campo'],['client-equipment','Equipamentos em clientes'],['safety','Equipamentos de Segurança e Sinalização'],['technicians','Técnicos'],['movements','Movimentações'],['field-kit','Caixa do técnico'],['service-orders','Ordens de Serviço'],['inventory','Inventário'],['reports','Relatórios'],['technical-reports','Relatório técnico'],['settings','Configurações']];
  const readOnly = user.role === 'DONO' || user.role === 'GESTOR';
  const nav = readOnly ? allNav.filter(([key]) => ['dashboard', 'stock', 'materials', 'tools', 'epi', 'equipment', 'client-equipment', 'safety', 'technicians', 'movements', 'service-orders', 'field-kit', 'reports', 'technical-reports'].includes(key)) : allNav;
  const groups = [['Visão geral', ['dashboard']], ['Estoque', ['stock', 'materials']], ['Operação de campo', ['movements', 'service-orders', 'field-kit', 'tools', 'epi', 'equipment', 'client-equipment', 'safety', 'technicians']], ['Controle', ['inventory', 'reports', 'technical-reports']], ['Administração', ['settings']]];
  const groupedNav = groups.map(([title, keys]) => { const entries = nav.filter(([key]) => keys.includes(key)); return entries.length ? `<div class="nav-group"><span class="nav-group-title">${title}</span>${entries.map(([key, label]) => `<button class="nav-item ${key === 'dashboard' ? 'active' : ''}" data-module="${key}"><span class="nav-icon">${icons[key]}</span>${label}</button>`).join('')}</div>` : ''; }).join('');
  const userName = safeText(user.name, 'Usuário');
  app.innerHTML = `<section class="dashboard"><aside class="sidebar">${brandMarkup(true)}<nav>${groupedNav}</nav><div class="sidebar-footer">© 2026 Uay Internet<br>Operação de estoque</div></aside><div class="main"><header class="topbar"><div><div class="crumb">Visão geral / Operação</div><h1 id="page-title">Dashboard</h1></div><div class="user-menu"><div><strong>${userName}</strong><small>${roleLabel(user.role) || 'Usuário'}</small></div><span class="user-avatar">${userName.charAt(0)}</span><button class="text-btn" id="logout" title="Sair">Sair</button></div></header><div class="content" id="page-content">${dashboardContent()}</div></div></section>`;
  document.querySelector('#logout').addEventListener('click', () => { localStorage.removeItem(sessionKey); renderLogin(); });
  document.querySelectorAll('[data-module]').forEach((button) => button.addEventListener('click', () => selectModule(button.dataset.module, moduleLabels[button.dataset.module] || 'Dashboard')));
  loadDashboardData();
}

function roleLabel(role) { return ({ DESENVOLVEDOR: 'Desenvolvedor', ADMIN: 'Administrador', ALMOXARIFADO: 'Almoxarifado', DONO: 'Diretoria', GESTOR: 'Gestão', TECNICO: 'Técnico' })[role] || role; }

async function loadSettingsModule() {
  const content = document.querySelector('#page-content');
  const session = JSON.parse(localStorage.getItem(sessionKey));
    content.innerHTML = '<div class="panel loading-panel"><h2>Carregando configurações...</h2><p>Consultando acessos e permissões.</p></div>'; 
  try {
    const response = await fetch(`${API_URL}/users`, { headers: { Authorization: `Bearer ${session.token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Acesso não autorizado.');
    const rows = data.users.map((user) => `<tr><td><strong>${safeText(user.name, 'Usuário sem nome')}</strong><small>${safeText(user.username, '-')}</small></td><td>${roleLabel(user.role) || 'Perfil não informado'}</td><td><span class="status-pill ${user.status === 'ACTIVE' ? 'status-ok' : 'status-warning'}">${safeText(user.status, 'PENDENTE')}</span></td><td>${user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('pt-BR') : 'Nunca'}</td><td><button class="text-btn" data-user-action="${user.id}">Editar</button></td></tr>`).join('');
    content.innerHTML = `<div class="inventory-header"><div><div class="crumb">Administração / Configurações</div><h2 class="section-title">Configurações</h2><p class="section-subtitle">Gerencie as contas de acesso: altere status, perfil e nome de usuário.</p></div></div><section class="panel"><div class="panel-header"><h2>Usuários e permissões</h2><span>Sem exclusão de histórico</span></div><div class="table-wrap"><table><thead><tr><th>Usuário</th><th>Perfil</th><th>Status</th><th>Último acesso</th><th>Ação</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
    document.querySelectorAll('[data-user-action]').forEach((button) => button.addEventListener('click', () => editUser(button.dataset.userAction, data.users.find((user) => user.id === button.dataset.userAction))));
  } catch (error) { content.innerHTML = `<div class="module-placeholder"><h2>Configurações indisponíveis</h2><p>${error.message}</p></div>`; }
}

function editUser(id, user) {
  const modal = document.createElement('div');
  modal.className = 'edit-modal-backdrop';
  const roleOptions = ['DESENVOLVEDOR', 'ADMIN', 'ALMOXARIFADO', 'DONO', 'GESTOR', 'TECNICO'].map((role) => `<option value="${role}" ${user.role === role ? 'selected' : ''}>${roleLabel(role)}</option>`).join('');
  const statusLabels = { ACTIVE: 'Ativo', PENDING: 'Pendente', BLOCKED: 'Bloqueado' };
  const statusOptions = ['ACTIVE', 'PENDING', 'BLOCKED'].map((status) => `<option value="${status}" ${user.status === status ? 'selected' : ''}>${statusLabels[status]}</option>`).join('');
  modal.innerHTML = `<section class="edit-modal" role="dialog" aria-modal="true"><button class="modal-close" type="button">×</button><div class="modal-kicker">Administração</div><h2>Editar usuário</h2><p class="modal-description">Atualize os dados de acesso e permissão desta conta.</p><form id="user-edit-form" class="entry-form"><label>Nome<input id="user-edit-name" value="${safeText(user.name, '')}" required></label><label>Login / nome de usuário<input id="user-edit-username" value="${safeText(user.username, '')}" pattern="[A-Za-z0-9._-]+" required></label><label>Nova senha <small>(deixe vazio para manter)</small><input id="user-edit-password" type="password" minlength="8" autocomplete="new-password" placeholder="Mínimo de 8 caracteres"></label><label>Confirmar nova senha<input id="user-edit-password-confirm" type="password" minlength="8" autocomplete="new-password" placeholder="Repita a nova senha"></label><label>Perfil<select id="user-edit-role">${roleOptions}</select></label><label>Status<select id="user-edit-status">${statusOptions}</select></label><div class="modal-actions"><button class="text-btn" type="button" id="cancel-user-edit">Cancelar</button><button class="primary-btn" type="submit">Salvar alteração</button></div><div class="notice" id="user-edit-notice"></div></form></section>`;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('.modal-close').addEventListener('click', close);
  modal.querySelector('#cancel-user-edit').addEventListener('click', close);
  modal.querySelector('#user-edit-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const notice = modal.querySelector('#user-edit-notice');
    const session = JSON.parse(localStorage.getItem(sessionKey));
    try {
      const password = modal.querySelector('#user-edit-password').value;
      const passwordConfirmation = modal.querySelector('#user-edit-password-confirm').value;
      if (password && password !== passwordConfirmation) throw new Error('A confirmação da nova senha não confere.');
      const response = await fetch(`${API_URL}/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` }, body: JSON.stringify({ name: modal.querySelector('#user-edit-name').value.trim(), username: modal.querySelector('#user-edit-username').value.trim().toLowerCase(), ...(password ? { password } : {}), role: modal.querySelector('#user-edit-role').value, status: modal.querySelector('#user-edit-status').value }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Não foi possível atualizar o usuário.');
      close();
      loadSettingsModule();
    } catch (error) { notice.textContent = error.message; notice.classList.add('show'); notice.style.background = '#fff4e5'; notice.style.color = 'var(--warning)'; }
  });
}

function dashboardContent(indicators = { items: 0, quantity: 0, lowStock: 0, technicians: 0, entries: 0, issues: 0 }) {
  const chartData = [['Entradas', Number(indicators.entries || 0)], ['Saídas', Number(indicators.issues || 0)], ['Saldo', Number(indicators.quantity || 0)]];
  return `<div class="kpi-grid"><article class="kpi"><span class="kpi-label">Materiais cadastrados</span><strong class="kpi-value">${indicators.items}</strong><span class="kpi-note">Itens no catálogo</span></article><article class="kpi"><span class="kpi-label">Quantidade em estoque</span><strong class="kpi-value">${indicators.quantity}</strong><span class="kpi-note">Saldo atual</span></article><article class="kpi"><span class="kpi-label">Entradas registradas</span><strong class="kpi-value">${indicators.entries || 0}</strong><span class="kpi-note">Materiais recebidos</span></article><article class="kpi"><span class="kpi-label">Saídas registradas</span><strong class="kpi-value">${indicators.issues || 0}</strong><span class="kpi-note">Materiais liberados</span></article><article class="kpi"><span class="kpi-label">Estoque baixo</span><strong class="kpi-value">${indicators.lowStock}</strong><span class="kpi-note" style="color:var(--warning)">${indicators.lowStock ? 'Requer atenção' : 'Nenhum alerta'}</span></article><article class="kpi"><span class="kpi-label">Técnicos ativos</span><strong class="kpi-value">${indicators.technicians}</strong><span class="kpi-note">Responsabilidades monitoradas</span></article></div><div class="dashboard-grid"><article class="panel"><div class="panel-header"><h2>Movimentação do estoque</h2><span>Passe o cursor nas barras</span></div><div class="bars">${chartData.map(([label,value]) => `<div class="bar-wrap" data-chart-label="${label}" data-chart-value="${value}"><div class="bar" style="--height:${Math.max(8, Math.min(100, value))}%"></div><span>${label}</span><strong class="bar-tooltip">${label}: ${value} unidades</strong></div>`).join('')}</div></article><article class="panel"><div class="panel-header"><h2>Visão rápida</h2><span>Dados atuais</span></div><div class="activity"><div class="activity-row"><span class="activity-icon">▦</span><div><strong>${indicators.items} materiais no catálogo</strong><small>Itens cadastrados</small></div><time>agora</time></div><div class="activity-row"><span class="activity-icon">↗</span><div><strong>${indicators.entries || 0} unidades recebidas</strong><small>Entradas registradas</small></div><time>total</time></div><div class="activity-row"><span class="activity-icon">↘</span><div><strong>${indicators.issues || 0} unidades liberadas</strong><small>Saídas registradas</small></div><time>total</time></div></div></article></div>`;
}

async function loadDashboardData() {
  const session = JSON.parse(localStorage.getItem(sessionKey));
  try {
    const response = await fetch(`${API_URL}/dashboard`, { headers: { Authorization: `Bearer ${session.token}` } });
    const data = await response.json();
    if (response.ok && document.querySelector('#page-title').textContent === 'Dashboard') document.querySelector('#page-content').innerHTML = dashboardContent(data.indicators);
  } catch (_) { /* O dashboard inicial permanece disponível enquanto a API é recuperada. */ }
}

function selectModule(module, title) {
  document.querySelectorAll('[data-module]').forEach((item) => item.classList.toggle('active', item.dataset.module === module));
  document.querySelector('#page-title').textContent = safeText(title, 'Dashboard');
  const content = document.querySelector('#page-content');
  if (module === 'dashboard') { content.innerHTML = dashboardContent(); loadDashboardData(); return; }
  if (module === 'stock' || module === 'materials') { loadInventoryModule(module); return; }
  if (module === 'technicians') { loadTechniciansModule(); return; }
  if (module === 'tools' || module === 'epi' || module === 'equipment') { loadAssetsModule(module); return; }
  if (module === 'client-equipment') { loadClientEquipmentModule(); return; }
  if (module === 'safety') { loadSafetyModule(); return; }
  if (module === 'movements') { loadMovementsModule(); return; }
  if (module === 'service-orders') { loadServiceOrdersModule(); return; }
  if (module === 'field-kit') { loadFieldKitModule(); return; }
  if (module === 'inventory') { loadPhysicalInventory(); return; }
  if (module === 'reports') { loadReportsModule(); return; }
  if (module === 'technical-reports') { loadTechnicalReportsModule(); return; }
  if (module === 'settings') { loadSettingsModule(); return; }
  content.innerHTML = `<div class="module-placeholder"><h2>${title}</h2><p>Este módulo está preparado na navegação e será conectado aos dados reais do PostgreSQL na próxima fase.</p><button class="primary-btn" style="max-width:220px" data-module="dashboard">Voltar ao dashboard</button></div>`;
  content.querySelector('[data-module="dashboard"]').addEventListener('click', () => selectModule('dashboard', 'Dashboard'));
}

async function loadMovementsModule(type = '') {
  const content = document.querySelector('#page-content');
  const session = JSON.parse(localStorage.getItem(sessionKey));
  content.innerHTML = '<div class="panel loading-panel"><h2>Carregando movimentações...</h2><p>Consultando o histórico rastreável.</p></div>';
  try {
    const response = await fetch(`${API_URL}/inventory/movements${type ? `?type=${type}` : ''}`, { headers: { Authorization: `Bearer ${session.token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Não foi possível consultar as movimentações.');
    const visibleMovements = data.movements.filter((movement) => movement.status !== 'INACTIVE');
    const rows = visibleMovements.length ? visibleMovements.map((movement) => { const actions = canManage() ? `<button class="icon-action" title="Editar" data-edit-movement="${movement.id}">✎</button><button class="icon-action danger" title="Arquivar" data-delete-movement="${movement.id}">⌫</button>` : '<span class="muted-action">Somente leitura</span>'; const amount = movement.meters != null ? `${safeText(movement.quantity, '0')} ${safeText(movement.item?.unit, 'un')}<small>${safeText(movement.meters, '0')} m</small>` : `${safeText(movement.quantity, '0')} ${safeText(movement.item?.unit, 'un')}`; return `<tr><td>${new Date(movement.createdAt || Date.now()).toLocaleString('pt-BR')}</td><td><span class="status-pill status-ok">${safeText(movement.type, 'MOVIMENTAÇÃO')}</span></td><td><strong>${safeText(movement.item?.name, 'Item não informado')}</strong><small>${safeText(movement.item?.code, '-')}</small></td><td>${amount}</td><td>${safeText(movement.technician?.name || movement.destination, 'Almoxarifado')}</td><td>${safeText(movement.user?.name, 'Usuário local')}</td><td>${safeText(movement.reason, 'Não informado')}</td><td class="action-cell">${actions}</td></tr>`; }).join('') : '<tr><td colspan="8" class="empty-cell">Nenhuma movimentação encontrada.</td></tr>';
    content.innerHTML = `<div class="inventory-header"><div><div class="crumb">Auditoria / Histórico</div><h2 class="section-title">Movimentações</h2><p class="section-subtitle">Pesquise um material para consultar o saldo atual. O histórico mostra os 30 registros mais recentes.</p></div></div><section class="panel movement-search-panel"><form class="inventory-filters" id="movement-item-search"><input id="movement-item-query" placeholder="Pesquisar material por nome ou código"><button class="text-btn" type="submit">Consultar saldo</button></form><div class="movement-balance-result" id="movement-balance-result">Digite um material para consultar a quantidade atual.</div></section><section class="panel"><form class="inventory-filters" id="movement-filter"><select id="movement-type"><option value="">Todos os tipos</option><option>ENTRADA</option><option>SAIDA</option><option>TRANSFERENCIA</option><option>DEVOLUCAO</option><option>AJUSTE</option><option>PERDA</option><option>AVARIA</option><option>BAIXA</option></select><button class="text-btn" type="submit">Filtrar histórico</button></form><div class="table-wrap"><table><thead><tr><th>Data e hora</th><th>Tipo</th><th>Item</th><th>Quantidade</th><th>Destino</th><th>Usuário</th><th>Motivo</th><th>Ação</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
    const movementTotals = visibleMovements.reduce((totals, movement) => { totals[movement.type] = (totals[movement.type] || 0) + 1; return totals; }, {});
    content.insertAdjacentHTML('afterbegin', `<div class="movement-summary"><div class="summary-accent"><span>Registros recentes</span><strong>${data.movements.length}</strong></div><div><span>Entradas</span><strong>${movementTotals.ENTRADA || 0}</strong></div><div><span>Saídas</span><strong>${movementTotals.SAIDA || 0}</strong></div><div><span>Ajustes</span><strong>${movementTotals.AJUSTE || 0}</strong></div></div>`);
    document.querySelector('#movement-item-search').addEventListener('submit', handleMovementItemSearch);
    document.querySelectorAll('[data-edit-movement]').forEach((button) => button.addEventListener('click', () => editMovement(button.dataset.editMovement, data.movements.find((movement) => movement.id === button.dataset.editMovement))));
    document.querySelectorAll('[data-delete-movement]').forEach((button) => button.addEventListener('click', () => archiveMovement(button.dataset.deleteMovement)));
    document.querySelector('#movement-type').value = type;
    document.querySelector('#movement-filter').addEventListener('submit', (event) => { event.preventDefault(); loadMovementsModule(document.querySelector('#movement-type').value); });
  } catch (error) { content.innerHTML = `<div class="module-placeholder"><h2>Histórico indisponível</h2><p>${error.message}</p></div>`; }
}

async function handleMovementItemSearch(event) {
  event.preventDefault();
  const query = document.querySelector('#movement-item-query').value.trim();
  const result = document.querySelector('#movement-balance-result');
  if (!query) { result.textContent = 'Digite um material para consultar a quantidade atual.'; return; }
  const session = JSON.parse(localStorage.getItem(sessionKey));
  const response = await fetch(`${API_URL}/inventory/items?search=${encodeURIComponent(query)}`, { headers: { Authorization: `Bearer ${session.token}` } });
  const data = await response.json();
  if (!response.ok || !data.items.length) { result.textContent = data.message || 'Nenhum material encontrado.'; return; }
  const item = data.items[0];
  result.innerHTML = `<strong>${safeText(item.name, 'Material')}</strong><span>Código: ${safeText(item.code, '-')}</span><b>${safeText(item.quantity, '0')} ${safeText(item.unit, 'un')}${item.materialControlType === 'CABEAMENTO' ? ` · ${safeText(item.availableMeters, '0')} m disponíveis` : ''}</b>`;
}

function editMovement(id, movement) {
  if (!canManage() || !movement) return;
  if (!movement) return;
  const modal = document.createElement('div');
  modal.className = 'edit-modal-backdrop';
  modal.innerHTML = `<section class="edit-modal" role="dialog" aria-modal="true"><button class="modal-close" type="button">×</button><div class="modal-kicker">Auditoria do estoque</div><h2>Editar movimentação</h2><p class="modal-description">Atualize os dados e informe a justificativa da alteração.</p><form id="movement-edit-form" class="entry-form"><label>Tipo<select id="movement-edit-type"><option>ENTRADA</option><option>SAIDA</option><option>TRANSFERENCIA</option><option>DEVOLUCAO</option><option>AJUSTE</option><option>PERDA</option><option>AVARIA</option><option>BAIXA</option></select></label><label>Quantidade<input id="movement-edit-quantity" type="number" min="0" step="0.001" value="${Number(movement.quantity || 0)}" required></label><label>Destino<input id="movement-edit-destination" value="${safeText(movement.destination, 'Almoxarifado')}"></label><label>Motivo<textarea id="movement-edit-reason" rows="3" required>${safeText(movement.reason, '')}</textarea></label><label>Justificativa da edição<textarea id="movement-edit-note" rows="3" placeholder="Por que esta movimentação está sendo corrigida?" required></textarea></label><div class="modal-actions"><button class="text-btn" type="button" id="cancel-movement-edit">Cancelar</button><button class="primary-btn" type="submit">Salvar alteração</button></div></form></section>`;
  document.body.appendChild(modal);
  modal.querySelector('#movement-edit-type').value = movement.type || 'AJUSTE';
  const close = () => modal.remove();
  modal.querySelector('.modal-close').addEventListener('click', close);
  modal.querySelector('#cancel-movement-edit').addEventListener('click', close);
  modal.querySelector('#movement-edit-form').addEventListener('submit', async (event) => { event.preventDefault(); const note = modal.querySelector('#movement-edit-note').value.trim(); try { await apiRequest(`/inventory/movements/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: modal.querySelector('#movement-edit-type').value, quantity: Number(modal.querySelector('#movement-edit-quantity').value), destination: modal.querySelector('#movement-edit-destination').value.trim(), reason: modal.querySelector('#movement-edit-reason').value.trim(), notes: `Edição: ${note}` }) }); close(); loadMovementsModule(); } catch (error) { window.alert(error.message || 'Não foi possível editar a movimentação.'); } });
}

async function archiveMovement(id) {
  if (!canManage() || !window.confirm('Arquivar esta movimentação? O histórico será preservado.')) return;
  try {
    await apiRequest(`/inventory/movements/${id}`, { method: 'DELETE' });
    loadMovementsModule();
  } catch (error) { window.alert(error.message || 'Não foi possível arquivar a movimentação.'); }
}

async function refreshApiToken() {
  const localSession = JSON.parse(localStorage.getItem(sessionKey) || 'null');
  if (!localSession?.refreshToken) return null;
  try {
    const response = await networkFetch(`${API_URL}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: localSession.refreshToken }) });
    const data = await response.json();
    if (!response.ok) return null;
    localStorage.setItem(sessionKey, JSON.stringify({ ...localSession, token: data.token, refreshToken: data.refreshToken, user: data.user }));
    return data.token;
  } catch {
    return null;
  }
}

async function ensureApiToken() {
  const localSession = JSON.parse(localStorage.getItem(sessionKey) || 'null');
  if (localSession?.token) return localSession.token;
  throw new Error('Sessão expirada. Faça login novamente.');
}

async function apiRequest(path, options = {}, retry = true) {
  const token = await ensureApiToken();
  const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
  let response;
  try {
    response = await networkFetch(`${API_URL}${path}`, { ...options, headers });
  } catch (error) {
    throw new Error('Não foi possível conectar à API. Verifique sua conexão e se o servidor está no ar.');
  }
  if (response.status === 401 && retry) {
    const newToken = await refreshApiToken();
    if (newToken) return apiRequest(path, options, false);
    localStorage.removeItem(sessionKey);
    renderLogin();
    throw new Error('Sessão expirada. Faça login novamente.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Não foi possível conversar com a API real.');
  }
  return data;
}

function parseMaterialsInput(value) {
  return value.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const match = line.match(/^(\d+(?:[,.]\d+)?)\s*([a-zA-Z]*)\s+(.+)$/);
    return match ? { quantity: Number(match[1].replace(',', '.')), unit: match[2] || 'UN', name: match[3].trim() } : { quantity: 1, unit: 'UN', name: line };
  });
}

function readPdfAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) { resolve(null); return; }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Não foi possível ler o PDF.'));
    reader.readAsDataURL(file);
  });
}

async function loadServiceOrdersModule() {
  const content = document.querySelector('#page-content');
  content.innerHTML = '<div class="panel loading-panel"><h2>Carregando ordens de serviço...</h2><p>Consultando técnicos e O.S. enviadas ao aplicativo.</p></div>';
  try {
    const [techniciansData, ordersData] = await Promise.all([apiRequest('/technicians'), apiRequest('/technicians/service-orders')]);
    const technicianOptions = techniciansData.technicians.map((technician) => `<option value="${technician.id}">${safeText(technician.name, 'Técnico')}</option>`).join('');
    const rows = ordersData.orders.length ? ordersData.orders.map((order) => { const rescheduled = order.status === 'REAGENDADA' || String(order.notes || '').includes('[VISITA REAGENDADA]'); const statusLabel = rescheduled ? 'REAGENDAR' : safeText(order.status, 'PENDENTE'); return `<tr><td><strong>O.S. #${safeText(order.number, '-')}</strong><small>${safeText(order.serviceType, 'Serviço')}</small></td><td>${safeText(order.customer, '-')}<small>${safeText(order.address, 'Endereço não informado')}</small></td><td>${safeText(order.contractId, '-')}</td><td>${safeText(order.technician?.name, '-')}</td><td><span class="status-pill ${order.status === 'FINALIZADA' ? 'status-ok' : 'status-warning'}">${statusLabel}</span>${rescheduled && order.scheduledAt ? `<small>Salva em ${new Date(order.scheduledAt).toLocaleString('pt-BR')}</small>` : ''}</td><td class="action-cell"><button class="text-btn" type="button" data-view-service-order="${order.id}">Ver fotos e relato</button></td><td class="action-cell">${order.status === 'FINALIZADA' ? `${canResetServiceOrders() ? `<button class="icon-action danger" type="button" title="Excluir O.S. finalizada para novo teste" data-delete-service-order="${order.id}">⌫</button>` : '<span class="muted-action">Histórico</span>'}` : `<button class="icon-action" type="button" title="Editar técnico ou status" data-edit-service-order="${order.id}">✎</button><button class="icon-action danger" type="button" title="Remover do app do técnico" data-delete-service-order="${order.id}">⌫</button>`}</td></tr>`; }).join('') : '<tr><td colspan="7" class="empty-cell">Nenhuma O.S. cadastrada na API.</td></tr>';
    const formMarkup = `<form id="service-order-form" class="entry-form"><label>Técnico disponível<select id="os-technician" required>${technicianOptions || '<option value="">Cadastre/vincule um técnico primeiro</option>'}</select></label><label>PDF da O.S.<small>O nome do arquivo deve seguir o padrão: número - nome do cliente.pdf</small><input id="os-pdf" type="file" accept="application/pdf,.pdf" required></label><button class="primary-btn" type="submit">Disponibilizar O.S. no app do técnico</button><div class="notice" id="os-notice"></div></form>`;
    content.innerHTML = `<div class="inventory-header"><div><div class="crumb">Operação de campo / Ordens de Serviço</div><h2 class="section-title">Ordens de Serviço</h2><p class="section-subtitle">Anexe o PDF da O.S. e escolha o técnico; número e cliente são lidos do nome do arquivo.</p></div></div><div class="report-hero"><div class="report-hero-mark">▧</div><div><span class="modal-kicker">Fluxo do almoxarifado</span><h2>Anexar PDF → enviar ao técnico</h2><p>O técnico consulta no PDF os detalhes da atividade, endereço e instruções da O.S.</p></div></div><div class="inventory-grid"><section class="panel"><div class="panel-header"><h2>Enviar O.S. ao técnico</h2><span>PDF</span></div>${formMarkup}</section><section class="panel"><div class="panel-header"><h2>O.S. disponíveis no app</h2><span>${ordersData.orders.length} registros</span></div><div class="table-wrap"><table><thead><tr><th>O.S.</th><th>Cliente</th><th>Contrato</th><th>Técnico</th><th>Status</th><th>PDF</th><th>Ação</th></tr></thead><tbody>${rows}</tbody></table></div></section></div>`;
    document.querySelector('#service-order-form').addEventListener('submit', handleServiceOrderCreate);
    document.querySelectorAll('[data-view-service-order]').forEach((button) => button.addEventListener('click', () => viewServiceOrderEvidence(button.dataset.viewServiceOrder, ordersData.orders.find((order) => order.id === button.dataset.viewServiceOrder))));
    document.querySelectorAll('[data-edit-service-order]').forEach((button) => button.addEventListener('click', () => editServiceOrder(button.dataset.editServiceOrder, ordersData.orders.find((order) => order.id === button.dataset.editServiceOrder), techniciansData.technicians)));
    document.querySelectorAll('[data-delete-service-order]').forEach((button) => button.addEventListener('click', () => deleteServiceOrder(button.dataset.deleteServiceOrder)));
  } catch (error) { content.innerHTML = `<div class="module-placeholder"><h2>Ordens de Serviço indisponíveis</h2><p>${error.message}</p><button class="primary-btn" style="max-width:280px" onclick="sessionStorage.removeItem('uay-api-token'); loadServiceOrdersModule();">Conectar novamente à API</button></div>`; }
}

function viewServiceOrderEvidence(id, summary) {
  if (!summary) return;
  Promise.resolve({ order: summary, validation: null }).then(({ order, validation }) => {
    const evidences = Array.isArray(order.evidences) ? order.evidences : [];
    const evidenceCards = evidences.map((evidence, index) => {
      const source = evidence.uri || evidence.url;
      const label = safeText(evidence.name || (evidence.type === 'VISIT_ATTEMPT' ? 'Comprovante de comparecimento para reagendamento' : evidence.type), 'Evidência');
      return source ? `<figure class="evidence-card"><button class="evidence-image-link" type="button" data-evidence-index="${index}" title="Abrir foto no navegador"><img src="${source}" alt="${label}"></button><figcaption>${label}<button class="evidence-open-button" type="button" data-evidence-index="${index}">Abrir foto no navegador</button></figcaption></figure>` : '';
    }).join('') || '<p class="empty-cell">Nenhuma foto foi anexada a esta O.S.</p>';
    const rescheduled = order.status === 'REAGENDADA' || String(order.notes || '').includes('[VISITA REAGENDADA]');
    const statusLabel = rescheduled ? 'Reagendamento' : safeText(order.status, '-');
    const reportText = String(order.notes || '').replace(/\[VISITA REAGENDADA\]\s*/gi, '').trim() || 'Nenhum relato informado.';
    const scheduleMarkup = rescheduled && order.scheduledAt ? `<p class="modal-description"><strong>Reagendamento registrado em:</strong> ${new Date(order.scheduledAt).toLocaleString('pt-BR')}</p>` : '';
    const modal = document.createElement('div');
    modal.className = 'edit-modal-backdrop';
    const validationMarkup = validation ? `<div class="validation-confirmed">Validada por ${safeText(validation.user?.name || validation.user?.username, 'usuário')} em ${new Date(validation.createdAt).toLocaleString('pt-BR')}</div>` : order.status === 'FINALIZADA' ? '<button class="primary-btn" type="button" id="validate-service-order">Validar fotos e relato</button>' : '<div class="validation-pending">A validação estará disponível após a finalização da O.S.</div>';
    const pdfMarkup = order.pdfUrl ? '<button class="secondary-btn" type="button" id="download-service-order-pdf">Baixar PDF da O.S.</button>' : '';
    modal.innerHTML = `<section class="edit-modal evidence-modal" role="dialog" aria-modal="true"><button class="modal-close" type="button">×</button><div class="modal-kicker">Evidências da visita</div><h2>O.S. #${safeText(order.number, '-')}</h2><p class="modal-description"><strong>Técnico:</strong> ${safeText(order.technician?.name, '-')} · <strong>Status:</strong> ${statusLabel}</p>${scheduleMarkup}<div class="evidence-gallery">${evidenceCards}</div><div class="evidence-notes"><strong>Relato do técnico</strong><p>${safeText(reportText)}</p></div><div class="validation-actions">${pdfMarkup}${validationMarkup}</div></section>`;
    document.body.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelectorAll('[data-evidence-index]').forEach((button) => button.addEventListener('click', () => openEvidenceImage(evidences[Number(button.dataset.evidenceIndex)]?.uri || evidences[Number(button.dataset.evidenceIndex)]?.url)));
    modal.querySelector('#download-service-order-pdf')?.addEventListener('click', () => downloadServiceOrderPdf(order));
    modal.querySelector('#validate-service-order')?.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = 'Registrando validação...';
      try {
        const result = await apiRequest(`/technicians/service-orders/${id}/validate`, { method: 'POST' });
        const validatedBy = result.validation?.user?.name || result.validation?.user?.username || 'usuário atual';
        modal.querySelector('.validation-actions').innerHTML = `<div class="validation-confirmed">Validada por ${safeText(validatedBy)} em ${new Date().toLocaleString('pt-BR')}</div>`;
      } catch (error) {
        button.disabled = false;
        button.textContent = 'Validar fotos e relato';
        window.alert(error.message || 'Não foi possível registrar a validação.');
      }
    });
  }).catch((error) => window.alert(error.message || 'Não foi possível carregar as evidências da O.S.'));
}

function openEvidenceImage(source) {
  if (!source) return;
  const normalizedSource = String(source).trim();
  if (/^(https?:|blob:)/i.test(normalizedSource)) {
    window.open(normalizedSource, '_blank', 'noopener,noreferrer');
    return;
  }
  const opened = window.open('', '_blank');
  if (!opened) {
    window.alert('O navegador bloqueou a nova aba. Permita pop-ups para abrir a foto.');
    return;
  }
  opened.document.title = 'Foto da O.S.';
  const rawBase64 = /^[A-Za-z0-9+/=_-]{100,}$/.test(normalizedSource) ? normalizedSource : null;
  const dataSource = rawBase64 ? `data:image/jpeg;base64,${rawBase64.replace(/-/g, '+').replace(/_/g, '/')}` : normalizedSource;
  if (!/^data:/i.test(dataSource)) {
    opened.location.href = normalizedSource;
    return;
  }
  opened.document.body.innerHTML = '';
  const image = opened.document.createElement('img');
  image.src = dataSource;
  image.alt = 'Foto da O.S.';
  image.style.cssText = 'display:block;max-width:100%;max-height:100vh;margin:auto;object-fit:contain;background:#111';
  image.onerror = () => { opened.document.body.innerHTML = '<p style="font:16px sans-serif;padding:24px;color:#b42318">Não foi possível renderizar esta foto.</p>'; };
  opened.document.body.style.cssText = 'margin:0;min-height:100vh;display:grid;place-items:center;background:#111';
  opened.document.body.appendChild(image);
}

function downloadServiceOrderPdf(order) {
  if (!order?.pdfUrl) { window.alert('Esta O.S. não possui PDF anexado.'); return; }
  if (/^https?:\/\//.test(order.pdfUrl)) { window.open(order.pdfUrl, '_blank', 'noopener'); return; }
  const [metadata, base64] = order.pdfUrl.split(',');
  if (!metadata?.startsWith('data:application/pdf') || !base64) { window.alert('O PDF anexado está em um formato inválido.'); return; }
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  const objectUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = order.pdfName || `OS-${safeText(order.number, 'ordem')}.pdf`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => { URL.revokeObjectURL(objectUrl); link.remove(); }, 1000);
}

async function handleServiceOrderCreate(event) {
  event.preventDefault();
  setSubmitting(event.target, true, 'Enviando...');
  const notice = document.querySelector('#os-notice');
  try {
    const file = document.querySelector('#os-pdf').files?.[0];
    if (!file) throw new Error('Anexe o PDF da O.S. antes de enviar.');
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) throw new Error('O anexo precisa ser um arquivo PDF.');
    const technicianId = document.querySelector('#os-technician').value;
    const filename = file.name.replace(/\.pdf$/i, '').trim();
    const metadata = filename.match(/^([A-Za-z0-9._/-]+)\s*[-–—]\s+(.+)$/);
    if (!metadata) throw new Error('Renomeie o PDF no padrão número - nome do cliente.pdf.');
    const number = metadata[1].trim();
    const customer = metadata[2].trim();
    if (!number || !customer) throw new Error('Não foi possível identificar número da O.S. e cliente pelo nome do PDF.');
    const pdfUrl = await readPdfAsDataUrl(file);
    await apiRequest('/technicians/service-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ number, customer, serviceType: 'Ordem de Serviço', technicianId, status: 'PENDENTE', pdfUrl, pdfName: file.name, materialsUsed: [], description: 'Consulte no PDF anexado os detalhes, endereço e instruções desta O.S.' }) });
    notice.textContent = `O.S. #${number} enviada para o aplicativo do técnico.`;
    notice.classList.add('show');
    event.target.reset();
    loadServiceOrdersModule();
  } catch (error) { setSubmitting(event.target, false); notice.textContent = error.message; notice.classList.add('show'); notice.style.background = '#fff4e5'; notice.style.color = 'var(--warning)'; }
}

async function deleteServiceOrder(id) {
  if (!window.confirm('Excluir esta O.S. e suas validações? A ação não pode ser desfeita.')) return;
  try {
    await apiRequest(`/technicians/service-orders/${id}`, { method: 'DELETE' });
    loadServiceOrdersModule();
  } catch (error) { window.alert(error.message || 'Não foi possível remover a O.S.'); }
}

function editServiceOrder(id, order, technicians) {
  if (!order) return;
  const options = technicians.map((technician) => `<option value="${technician.id}" ${technician.id === order.technician?.id ? 'selected' : ''}>${safeText(technician.name, 'Técnico')}</option>`).join('');
  const modal = document.createElement('div');
  modal.className = 'edit-modal-backdrop';
  modal.innerHTML = `<section class="edit-modal" role="dialog" aria-modal="true"><button class="modal-close" type="button">×</button><div class="modal-kicker">Ordem de Serviço</div><h2>Editar O.S. #${safeText(order.number, '-')}</h2><p class="modal-description">Altere o técnico responsável ou o status antes da finalização.</p><form id="service-order-edit-form" class="entry-form"><label>Técnico responsável<select id="service-order-edit-technician" required>${options}</select></label><label>Status<select id="service-order-edit-status"><option value="PENDENTE" ${order.status === 'PENDENTE' ? 'selected' : ''}>Pendente</option><option value="EM_ANDAMENTO" ${order.status === 'EM_ANDAMENTO' ? 'selected' : ''}>Em andamento</option></select></label><div class="modal-actions"><button class="text-btn" type="button" id="cancel-service-order-edit">Cancelar</button><button class="primary-btn" type="submit">Salvar alteração</button></div><div class="notice" id="service-order-edit-notice"></div></form></section>`;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('.modal-close').addEventListener('click', close);
  modal.querySelector('#cancel-service-order-edit').addEventListener('click', close);
  modal.querySelector('#service-order-edit-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const notice = modal.querySelector('#service-order-edit-notice');
    try {
      await apiRequest(`/technicians/service-orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ technicianId: modal.querySelector('#service-order-edit-technician').value, status: modal.querySelector('#service-order-edit-status').value }) });
      close();
      loadServiceOrdersModule();
    } catch (error) { notice.textContent = error.message || 'Não foi possível atualizar a O.S.'; notice.classList.add('show'); notice.style.background = '#fff4e5'; notice.style.color = 'var(--warning)'; }
  });
}

async function loadFieldKitModule() {
  const content = document.querySelector('#page-content');
  const session = JSON.parse(localStorage.getItem(sessionKey));
  content.innerHTML = '<div class="panel loading-panel"><h2>Carregando caixa dos técnicos...</h2><p>Consultando materiais e ativos em campo.</p></div>';
  try {
    const response = await fetch(`${API_URL}/technicians`, { headers: { Authorization: `Bearer ${session.token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Não foi possível consultar a caixa dos técnicos.');
    const technicians = await Promise.all(data.technicians.map(async (technician) => { const stockResponse = await fetch(`${API_URL}/technicians/${technician.id}/stock`, { headers: { Authorization: `Bearer ${session.token}` } }); const stockData = await stockResponse.json(); return stockData.technician || technician; }));
    const cards = technicians.map((technician) => { const balances = technician.balances || []; const total = balances.reduce((sum, balance) => sum + Number(balance.quantity || 0), 0); const items = balances.slice(0, 4).map((balance) => `<li>${safeText(balance.item?.name, 'Item não informado')} <strong>${safeText(balance.quantity, '0')} ${safeText(balance.item?.unit, 'un')}</strong></li>`).join('') || '<li>Nenhum item em campo</li>'; return `<article class="field-kit-card"><div class="field-kit-head"><div class="technician-avatar">${safeText(technician.name, 'T').charAt(0)}</div><div><h3>${safeText(technician.name, 'Técnico')}</h3><small>${safeText(technician.position, 'Técnico de campo')}</small></div><span class="field-kit-total">${total} itens</span></div><ul>${items}</ul><div class="field-kit-footer"><button class="text-btn" data-technician-id="${technician.id}">Ver estoque e movimentar</button></div></article>`; }).join('');
    content.innerHTML = `<div class="inventory-header"><div><div class="crumb">Operação de campo / Responsabilidade</div><h2 class="section-title">Caixa do técnico</h2><p class="section-subtitle">Materiais, ferramentas e ativos sob responsabilidade de cada técnico.</p></div></div><div class="field-kit-grid">${cards || '<div class="module-placeholder">Nenhum técnico cadastrado.</div>'}</div>`;
    content.querySelectorAll('[data-technician-id]').forEach((button) => button.addEventListener('click', () => loadTechnicianDetail(button.dataset.technicianId)));
  } catch (error) { content.innerHTML = `<div class="module-placeholder"><h2>Caixa do técnico indisponível</h2><p>${error.message}</p></div>`; }
}

async function loadTechnicianDetail(id) {
  const content = document.querySelector('#page-content');
  const session = JSON.parse(localStorage.getItem(sessionKey));
  content.innerHTML = '<div class="panel loading-panel"><h2>Carregando técnico...</h2><p>Consultando materiais e histórico.</p></div>';
  try {
    const response = await fetch(`${API_URL}/technicians/${id}/stock`, { headers: { Authorization: `Bearer ${session.token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Não foi possível consultar o técnico.');
    const technician = data.technician;
    const balances = technician.balances || [];
    const rows = balances.length ? balances.map((balance) => { const quantity = `${safeText(balance.quantity, '0')} ${safeText(balance.item?.unit, 'un')}${balance.item?.materialControlType === 'CABEAMENTO' ? `<small>${safeText(balance.availableMeters, '0')} m disponíveis</small>` : ''}`; const actions = canManage() ? `<button class="icon-action" type="button" title="Editar saldo" data-edit-balance="${balance.id}">✎</button><button class="icon-action danger" type="button" title="Remover da caixa" data-delete-balance="${balance.id}">⌫</button>` : '<span class="muted-action">Somente leitura</span>'; return `<tr><td><strong>${safeText(balance.item?.name, 'Item não informado')}</strong><small>${safeText(balance.item?.code, '-')}</small></td><td>${quantity}</td><td class="action-cell">${actions}</td></tr>`; }).join('') : '<tr><td colspan="3" class="empty-cell">Nenhum item em posse.</td></tr>';
    const movements = (technician.movements || []).slice(0, 10).map((movement) => `<div class="activity-row"><span class="activity-icon">↕</span><div><strong>${safeText(movement.item?.name, 'Item não informado')}</strong><small>${safeText(movement.type, 'MOVIMENTAÇÃO')} · ${safeText(movement.quantity, '0')} ${safeText(movement.item?.unit, 'un')}</small></div><time>${movement.createdAt ? new Date(movement.createdAt).toLocaleDateString('pt-BR') : '-'}</time></div>`).join('') || '<p class="section-subtitle">Nenhuma movimentação registrada.</p>';
    content.innerHTML = `<div class="inventory-header"><div><div class="crumb">Operação de campo / Caixa do técnico</div><h2 class="section-title">${safeText(technician.name, 'Técnico')}</h2><p class="section-subtitle">${safeText(technician.position, 'Técnico de campo')} · Materiais e histórico sob responsabilidade.</p></div><button class="primary-btn compact-btn" type="button" id="back-to-field-kit">← Voltar</button></div><div class="inventory-grid"><section class="panel"><div class="panel-header"><h2>Materiais em posse</h2><span>${balances.length} itens</span></div><div class="table-wrap"><table><thead><tr><th>Item</th><th>Quantidade</th><th>Ações</th></tr></thead><tbody>${rows}</tbody></table></div></section><section class="panel"><div class="panel-header"><h2>Últimas movimentações</h2><button class="icon-action danger" type="button" id="clear-technician-movements" title="Limpar últimas movimentações" aria-label="Limpar últimas movimentações">×</button></div><div class="activity">${movements}</div></section></div>`;
    content.querySelector('#back-to-field-kit').addEventListener('click', () => selectModule('field-kit', 'Caixa do técnico'));
    content.querySelector('#clear-technician-movements').addEventListener('click', async () => {
      if (!window.confirm('Zerar a lista de últimas movimentações deste técnico? O histórico continuará preservado.')) return;
      try {
        await apiRequest(`/technicians/${technician.id}/movements`, { method: 'DELETE' });
        loadTechnicianDetail(technician.id);
      } catch (error) { window.alert(error.message || 'Não foi possível zerar a lista.'); }
    });
    content.querySelectorAll('[data-edit-balance]').forEach((button) => button.addEventListener('click', () => editTechnicianBalance(technician, balances.find((balance) => balance.id === button.dataset.editBalance))));
    content.querySelectorAll('[data-delete-balance]').forEach((button) => button.addEventListener('click', () => deleteTechnicianBalance(technician, balances.find((balance) => balance.id === button.dataset.deleteBalance))));
  } catch (error) { content.innerHTML = `<div class="module-placeholder"><h2>Técnico indisponível</h2><p>${error.message}</p></div>`; }
}

function editTechnicianBalance(technician, balance) {
  if (!canManage() || !balance) return;
  const isCable = balance.item?.materialControlType === 'CABEAMENTO';
  const modal = document.createElement('div');
  modal.className = 'edit-modal-backdrop';
  modal.innerHTML = `<section class="edit-modal" role="dialog" aria-modal="true"><button class="modal-close" type="button">×</button><div class="modal-kicker">Caixa do técnico</div><h2>Editar saldo</h2><p class="modal-description">${safeText(balance.item?.name, 'Item')}</p><form id="balance-edit-form" class="entry-form"><label>${isCable ? 'Bobinas' : 'Quantidade'}<input id="balance-edit-quantity" type="number" min="0" step="0.001" value="${Number(balance.quantity || 0)}" required></label>${isCable ? `<label>Metragem disponível (m)<input id="balance-edit-meters" type="number" min="0" step="0.001" value="${Number(balance.availableMeters || 0)}" required></label>` : ''}<label>Justificativa<textarea id="balance-edit-reason" rows="3" required></textarea></label><div class="modal-actions"><button class="text-btn" type="button" id="cancel-balance-edit">Cancelar</button><button class="primary-btn" type="submit">Salvar</button></div></form></section>`;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('.modal-close').addEventListener('click', close);
  modal.querySelector('#cancel-balance-edit').addEventListener('click', close);
  modal.querySelector('#balance-edit-form').addEventListener('submit', async (event) => { event.preventDefault(); try { await apiRequest(`/technicians/${technician.id}/stock/${balance.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity: Number(modal.querySelector('#balance-edit-quantity').value), availableMeters: isCable ? Number(modal.querySelector('#balance-edit-meters').value) : undefined, reason: modal.querySelector('#balance-edit-reason').value.trim() }) }); close(); loadTechnicianDetail(technician.id); } catch (error) { window.alert(error.message || 'Não foi possível atualizar o saldo.'); } });
}

async function deleteTechnicianBalance(technician, balance) {
  if (!canManage() || !balance || !window.confirm(`Devolver "${balance.item?.name || 'este item'}" ao almoxarifado? O saldo sairá da caixa e voltará ao estoque.`)) return;
  try { await apiRequest(`/technicians/${technician.id}/stock/${balance.id}`, { method: 'DELETE' }); loadTechnicianDetail(technician.id); } catch (error) { window.alert(error.message || 'Não foi possível remover o item.'); }
}

async function loadTechniciansModule() {
  const content = document.querySelector('#page-content');
  const session = JSON.parse(localStorage.getItem(sessionKey));
  content.innerHTML = '<div class="panel loading-panel"><h2>Carregando técnicos...</h2><p>Consultando a equipe de campo.</p></div>';
  try {
    const response = await fetch(`${API_URL}/technicians`, { headers: { Authorization: `Bearer ${session.token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Não foi possível consultar os técnicos.');
    const rows = data.technicians.length ? data.technicians.map((technician) => { const actions = canManage() ? `<button class="icon-action" title="Editar" data-edit-technician="${technician.id}">✎</button><button class="icon-action danger" title="Arquivar" data-delete-technician="${technician.id}">⌫</button>` : '<span class="muted-action">Somente leitura</span>'; return `<tr><td><strong>${safeText(technician.name, 'Técnico sem nome')}</strong></td><td>${safeText(technician.position, 'Técnico de campo')}</td><td>${technician._count?.balances || 0} itens</td><td><button class="text-btn" data-technician-id="${technician.id}">Ver caixa</button></td><td class="action-cell">${actions}</td></tr>`; }).join('') : '<tr><td colspan="5" class="empty-cell">Nenhum técnico cadastrado.</td></tr>';
    content.innerHTML = `<div class="inventory-header"><div><div class="crumb">Operação de campo / Equipe</div><h2 class="section-title">Técnicos</h2><p class="section-subtitle">Cadastro da equipe de campo e materiais sob responsabilidade de cada um.</p></div></div><div class="inventory-grid"><section class="panel"><div class="panel-header"><h2>Equipe cadastrada</h2><span>${data.technicians.length} técnicos</span></div><div class="table-wrap"><table><thead><tr><th>Nome</th><th>Cargo</th><th>Materiais em posse</th><th>Caixa</th><th>Ação</th></tr></thead><tbody>${rows}</tbody></table></div></section><section class="panel"><div class="panel-header"><h2>Novo técnico</h2><span>Cadastro operacional</span></div><form id="technician-form" class="entry-form"><label>Nome completo<input id="technician-name" required></label><label>Cargo<input id="technician-position" value="Técnico de campo"></label><button class="primary-btn" type="submit">Cadastrar técnico</button><div class="notice" id="technician-notice"></div></form></section></div>`;
    document.querySelector('#technician-form').addEventListener('submit', handleTechnicianCreate);
    document.querySelectorAll('[data-technician-id]').forEach((button) => button.addEventListener('click', () => loadTechnicianDetail(button.dataset.technicianId)));
    document.querySelectorAll('[data-edit-technician]').forEach((button) => button.addEventListener('click', () => editTechnician(button.dataset.editTechnician, data.technicians.find((technician) => technician.id === button.dataset.editTechnician))));
    document.querySelectorAll('[data-delete-technician]').forEach((button) => button.addEventListener('click', () => deleteTechnician(button.dataset.deleteTechnician)));
  } catch (error) { content.innerHTML = `<div class="module-placeholder"><h2>Técnicos indisponíveis</h2><p>${error.message}</p></div>`; }
}

async function handleTechnicianCreate(event) {
  event.preventDefault();
  setSubmitting(event.target, true, 'Cadastrando...');
  const session = JSON.parse(localStorage.getItem(sessionKey));
  const notice = document.querySelector('#technician-notice');
  try {
    const response = await fetch(`${API_URL}/technicians`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` }, body: JSON.stringify({ name: document.querySelector('#technician-name').value, position: document.querySelector('#technician-position').value }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Não foi possível cadastrar o técnico.');
    loadTechniciansModule();
  } catch (error) { setSubmitting(event.target, false); notice.textContent = error.message; notice.classList.add('show'); notice.style.background = '#fff4e5'; notice.style.color = 'var(--warning)'; }
}

function editTechnician(id, technician) {
  if (!technician) return;
  const modal = document.createElement('div');
  modal.className = 'edit-modal-backdrop';
  modal.innerHTML = `<section class="edit-modal" role="dialog" aria-modal="true"><button class="modal-close" type="button">×</button><div class="modal-kicker">Equipe de campo</div><h2>Editar técnico</h2><p class="modal-description">Atualize os dados cadastrais deste técnico.</p><form id="technician-edit-form" class="entry-form"><label>Nome<input id="technician-edit-name" value="${safeText(technician.name, '')}" required></label><label>Cargo<input id="technician-edit-position" value="${safeText(technician.position, 'Técnico de campo')}"></label><div class="modal-actions"><button class="text-btn" type="button" id="cancel-technician-edit">Cancelar</button><button class="primary-btn" type="submit">Salvar alteração</button></div><div class="notice" id="technician-edit-notice"></div></form></section>`;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('.modal-close').addEventListener('click', close);
  modal.querySelector('#cancel-technician-edit').addEventListener('click', close);
  modal.querySelector('#technician-edit-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const notice = modal.querySelector('#technician-edit-notice');
    const session = JSON.parse(localStorage.getItem(sessionKey));
    try {
      const response = await fetch(`${API_URL}/technicians/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` }, body: JSON.stringify({ name: modal.querySelector('#technician-edit-name').value.trim(), position: modal.querySelector('#technician-edit-position').value.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Não foi possível atualizar o técnico.');
      close();
      loadTechniciansModule();
    } catch (error) { notice.textContent = error.message; notice.classList.add('show'); notice.style.background = '#fff4e5'; notice.style.color = 'var(--warning)'; }
  });
}

async function deleteTechnician(id) {
  if (!window.confirm('Arquivar este técnico? O histórico será preservado.')) return;
  const session = JSON.parse(localStorage.getItem(sessionKey));
  try {
    const response = await fetch(`${API_URL}/technicians/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Não foi possível arquivar o técnico.');
    loadTechniciansModule();
  } catch (error) { window.alert(error.message); }
}

async function loadClientEquipmentModule(status = 'EM_USO_CLIENTE', search = '') {
  const content = document.querySelector('#page-content');
  const session = JSON.parse(localStorage.getItem(sessionKey));
  const canManageUnits = ['DESENVOLVEDOR', 'ADMIN', 'ALMOXARIFADO'].includes(session?.user?.role);
  content.innerHTML = '<div class="panel loading-panel"><h2>Carregando equipamentos em clientes...</h2><p>Consultando unidades e histórico por serial.</p></div>';
  try {
    const headers = { Authorization: `Bearer ${session.token}` };
    const [unitsResponse, techniciansResponse] = await Promise.all([
      fetch(`${API_URL}/inventory/equipment-units?status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`, { headers }),
      fetch(`${API_URL}/technicians`, { headers }),
    ]);
    const unitsData = await unitsResponse.json();
    const techniciansData = await techniciansResponse.json();
    if (!unitsResponse.ok) throw new Error(unitsData.message || 'Não foi possível consultar equipamentos.');
    if (!techniciansResponse.ok) throw new Error(techniciansData.message || 'Não foi possível consultar técnicos.');
    const statusLabels = { EM_ESTOQUE: 'Em estoque', ALOCADO: 'Alocado ao técnico', EM_USO_CLIENTE: 'Alocado ao cliente', EM_CONFERENCIA: 'Recolhido / Em conferência', MANUTENCAO: 'Em manutenção', AGUARDANDO_DEVOLUCAO: 'Aguardando devolução', RESERVADO: 'Reservado', DANIFICADO: 'Danificado', DESCARTADO: 'Descartado', DEVOLVIDO: 'Devolvido', BAIXADO: 'Baixado' };
    const statusOptions = [['EM_USO_CLIENTE', 'Alocados ao cliente'], ['EM_CONFERENCIA', 'Em conferência'], ['EM_ESTOQUE', 'Em estoque'], ['MANUTENCAO', 'Em manutenção'], ['RESERVADO', 'Reservados'], ['DANIFICADO', 'Danificados'], ['DESCARTADO', 'Descartados'], ['TODOS', 'Todos os status']].map(([value, label]) => `<option value="${value}" ${status === value ? 'selected' : ''}>${label}</option>`).join('');
    const units = unitsData.units || [];
    const rows = units.length ? units.map((unit) => {
      const installation = unit.events?.[0];
      const installer = installation?.technician?.name || unit.technician?.name || '-';
      const contractId = unit.contractId || unit.serviceOrder?.contractId || installation?.contractId || '-';
      const serviceOrder = unit.serviceOrder?.number || installation?.serviceOrder?.number || '-';
      const installedAt = installation?.createdAt ? new Date(installation.createdAt).toLocaleString('pt-BR') : '-';
      const collectButton = canManageUnits && ['EM_USO_CLIENTE', 'ALOCADO', 'AGUARDANDO_DEVOLUCAO'].includes(unit.status) ? `<button class="text-btn" type="button" data-collect-unit="${unit.id}">Recolher equipamento</button>` : '';
      const disposition = canManageUnits && unit.status === 'EM_CONFERENCIA' ? `<div class="unit-disposition"><select data-unit-disposition="${unit.id}"><option value="EM_ESTOQUE">Disponível em estoque</option><option value="MANUTENCAO">Em manutenção</option><option value="DANIFICADO">Danificado</option><option value="DESCARTADO">Descartado</option><option value="RESERVADO">Reservado</option></select><button class="text-btn" type="button" data-save-disposition="${unit.id}">Confirmar conferência</button></div>` : '';
      return `<tr><td><strong>${safeText(unit.item.name, 'Equipamento')}</strong><small>${safeText(unit.item.model || unit.item.code, '-')}</small></td><td><strong>${safeText(unit.serialNumber)}</strong></td><td>${safeText(unit.customer, '-')}</td><td>${safeText(contractId, '-')}</td><td>${safeText(installer, '-')}</td><td>${safeText(serviceOrder, '-')}</td><td>${installedAt}</td><td><span class="status-pill ${unit.status === 'EM_USO_CLIENTE' ? 'status-warning' : 'status-ok'}">${statusLabels[unit.status] || unit.status}</span></td><td class="unit-actions"><button class="text-btn" type="button" data-unit-history="${safeText(unit.serialNumber)}">Histórico</button>${collectButton}${disposition}</td></tr>`;
    }).join('') : '<tr><td colspan="9" class="empty-cell">Nenhum equipamento encontrado para este filtro.</td></tr>';
    content.innerHTML = `<div class="inventory-header"><div><div class="crumb">Operação de campo / Patrimônio serializado</div><h2 class="section-title">Equipamentos em clientes</h2><p class="section-subtitle">Acompanhe modelo, serial, cliente, contrato, técnico, O.S. e histórico. Equipamentos recolhidos aguardam conferência antes de voltar ao saldo disponível.</p></div></div><section class="panel"><form id="client-equipment-filters" class="inventory-filters"><input id="client-equipment-search" value="${safeText(search, '')}" placeholder="Buscar serial, modelo, cliente ou contrato"><select id="client-equipment-status">${statusOptions}</select><button class="text-btn" type="submit">Buscar</button></form><div class="table-wrap"><table><thead><tr><th>Equipamento / Modelo</th><th>Número de série</th><th>Cliente</th><th>Contrato</th><th>Técnico da instalação</th><th>O.S.</th><th>Instalado em</th><th>Status</th><th>Ações</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
    document.querySelector('#client-equipment-filters').addEventListener('submit', (event) => { event.preventDefault(); loadClientEquipmentModule(document.querySelector('#client-equipment-status').value, document.querySelector('#client-equipment-search').value.trim()); });
    document.querySelector('#client-equipment-status').addEventListener('change', () => loadClientEquipmentModule(document.querySelector('#client-equipment-status').value, document.querySelector('#client-equipment-search').value.trim()));
    content.querySelectorAll('[data-unit-history]').forEach((button) => button.addEventListener('click', () => showUnitHistory(button.dataset.unitHistory)));
    content.querySelectorAll('[data-collect-unit]').forEach((button) => button.addEventListener('click', () => showEquipmentCollectionForm(units.find((unit) => unit.id === button.dataset.collectUnit), techniciansData.technicians, () => loadClientEquipmentModule(status, search))));
    content.querySelectorAll('[data-save-disposition]').forEach((button) => button.addEventListener('click', () => saveEquipmentDisposition(button.dataset.saveDisposition, document.querySelector(`[data-unit-disposition="${button.dataset.saveDisposition}"]`).value, () => loadClientEquipmentModule(status, search))));
  } catch (error) { content.innerHTML = `<div class="module-placeholder"><h2>Equipamentos em clientes indisponíveis</h2><p>${error.message}</p></div>`; }
}

function showEquipmentCollectionForm(unit, technicians, reload) {
  if (!unit) return;
  const technicianOptions = technicians.map((technician) => `<option value="${technician.id}" ${technician.id === unit.technician?.id ? 'selected' : ''}>${safeText(technician.name)}</option>`).join('');
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const modal = document.createElement('div');
  modal.className = 'edit-modal-backdrop';
  modal.innerHTML = `<section class="edit-modal" role="dialog" aria-modal="true"><button class="modal-close" type="button">×</button><div class="modal-kicker">Recolhimento de equipamento</div><h2>${safeText(unit.item.name)} · ${safeText(unit.serialNumber)}</h2><p class="modal-description">Após o recolhimento, o serial ficará em conferência e não poderá ser alocado até nova decisão do almoxarifado.</p><form id="collect-unit-form" class="entry-form"><label>Motivo da retirada<select id="collect-reason"><option>Cancelamento do contrato</option><option>Recolhimento de equipamento</option><option>Troca de equipamento</option><option>Defeito</option><option>Outro</option></select></label><label>Data e hora da retirada<input id="collect-date" type="datetime-local" value="${now}" required></label><label>Técnico responsável pela retirada<select id="collect-technician"><option value="">Não informado</option>${technicianOptions}</select></label><label>O.S. relacionada (opcional)<input id="collect-order" value="${safeText(unit.serviceOrder?.number || '', '')}"></label><label>Observação<textarea id="collect-notes" rows="3"></textarea></label><div class="modal-actions"><button class="text-btn" type="button" id="cancel-collect-unit">Cancelar</button><button class="primary-btn" type="submit">Confirmar recolhimento</button></div><div class="notice" id="collect-unit-notice"></div></form></section>`;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('.modal-close').addEventListener('click', close);
  modal.querySelector('#cancel-collect-unit').addEventListener('click', close);
  modal.querySelector('#collect-unit-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const notice = modal.querySelector('#collect-unit-notice');
    const session = JSON.parse(localStorage.getItem(sessionKey));
    try {
      const collectedAt = new Date(modal.querySelector('#collect-date').value).toISOString();
      const response = await fetch(`${API_URL}/inventory/equipment-units/${unit.id}/collect`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` }, body: JSON.stringify({ reason: modal.querySelector('#collect-reason').value, collectedAt, technicianId: modal.querySelector('#collect-technician').value || undefined, serviceOrderNumber: modal.querySelector('#collect-order').value.trim() || undefined, notes: modal.querySelector('#collect-notes').value.trim() || undefined }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Não foi possível recolher o equipamento.');
      close();
      window.alert(data.message || 'Equipamento recolhido para conferência.');
      reload();
    } catch (error) { notice.textContent = error.message || 'Não foi possível recolher o equipamento.'; notice.classList.add('show'); notice.style.background = '#fff4e5'; notice.style.color = 'var(--warning)'; }
  });
}

async function saveEquipmentDisposition(unitId, status, reload) {
  const notes = window.prompt('Observação da conferência (opcional):', '') ?? '';
  const session = JSON.parse(localStorage.getItem(sessionKey));
  try {
    const response = await fetch(`${API_URL}/inventory/equipment-units/${unitId}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` }, body: JSON.stringify({ status, notes }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Não foi possível atualizar o status do equipamento.');
    reload();
  } catch (error) { window.alert(error.message || 'Não foi possível atualizar o equipamento.'); }
}

const assetTypeByModule = { tools: 'FERRAMENTA', epi: 'EPI', equipment: 'FIELD_ASSET' };
const assetTitleByModule = { tools: 'Ferramentas', epi: 'EPIs', equipment: 'Ativos de campo' };

async function loadAssetsModule(module) {
  const content = document.querySelector('#page-content');
  const session = JSON.parse(localStorage.getItem(sessionKey));
  const title = assetTitleByModule[module];
  content.innerHTML = `<div class="panel loading-panel"><h2>Carregando ${title}...</h2><p>Consultando os ativos cadastrados.</p></div>`;
  try {
    const response = await fetch(`${API_URL}/inventory/assets?type=${assetTypeByModule[module]}`, { headers: { Authorization: `Bearer ${session.token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Não foi possível consultar os ativos.');
    const rows = data.items.length ? data.items.map((item) => { const actions = canManage() ? `<button class="icon-action" title="Editar" data-edit-item="${item.id}">✎</button><button class="icon-action danger" title="Arquivar" data-delete-item="${item.id}">⌫</button>` : '<span class="muted-action">Somente leitura</span>'; return `<tr><td><strong>${safeText(item.name, 'Item sem nome')}</strong><small>${safeText(item.code, '-')}</small></td><td>${safeText(item.category?.name, title)}</td><td>${safeText(item.condition, 'BOM')}</td><td>${safeText(item.quantity, '0')} ${safeText(item.unit, 'un')}</td><td><span class="status-pill status-ok">Cadastrado</span></td><td class="action-cell">${actions}</td></tr>`; }).join('') : '<tr><td colspan="6" class="empty-cell">Nenhum item cadastrado.</td></tr>';
    content.innerHTML = `<div class="inventory-header"><div><div class="crumb">Operação de campo / ${title}</div><h2 class="section-title">${title}</h2><p class="section-subtitle">Itens cadastrados nesta categoria, com status de condição e saldo.</p></div></div><section class="panel"><div class="panel-header"><h2>Itens cadastrados</h2><span>${data.items.length} itens</span></div><div class="table-wrap"><table><thead><tr><th>Item</th><th>Categoria</th><th>Condição</th><th>Saldo</th><th>Status</th><th>Ação</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
    document.querySelectorAll('[data-edit-item]').forEach((button) => button.addEventListener('click', () => editItem(button.dataset.editItem, () => loadAssetsModule(module))));
    document.querySelectorAll('[data-delete-item]').forEach((button) => button.addEventListener('click', () => deleteInventoryItem(button.dataset.deleteItem, () => loadAssetsModule(module))));
  } catch (error) { content.innerHTML = `<div class="module-placeholder"><h2>${title} indisponíveis</h2><p>${error.message}</p></div>`; }
}

async function loadSafetyModule() {
  const content = document.querySelector('#page-content');
  const session = JSON.parse(localStorage.getItem(sessionKey));
  const safetyGroup = 'Equipamentos de Segurança e Sinalização';
  content.innerHTML = '<div class="panel loading-panel"><h2>Carregando equipamentos...</h2><p>Consultando equipamentos de segurança e sinalização.</p></div>';
  try {
    const headers = { Authorization: `Bearer ${session.token}` };
    const [itemsResponse, categoriesResponse] = await Promise.all([
      fetch(`${API_URL}/inventory/items?search=&group=${encodeURIComponent(safetyGroup)}`, { headers }),
      fetch(`${API_URL}/inventory/categories`, { headers }),
    ]);
    const data = await itemsResponse.json();
    const categoriesData = await categoriesResponse.json();
    if (!itemsResponse.ok) throw new Error(data.message || 'Não foi possível consultar os equipamentos.');
    const rows = data.items.length ? data.items.map((item) => { const actions = canManage() ? `<button class="icon-action" title="Editar" data-edit-item="${item.id}">✎</button><button class="icon-action danger" title="Arquivar" data-delete-item="${item.id}">⌫</button>` : '<span class="muted-action">Somente leitura</span>'; return `<tr><td><strong>${safeText(item.name, 'Item sem nome')}</strong><small>${safeText(item.code, '-')}</small></td><td>${safeText(item.condition, 'BOM')}</td><td>${safeText(item.quantity, '0')} ${safeText(item.unit, 'un')}</td><td><span class="status-pill status-ok">Cadastrado</span></td><td class="action-cell">${actions}</td></tr>`; }).join('') : '<tr><td colspan="5" class="empty-cell">Nenhum item cadastrado.</td></tr>';
    const categoryOptions = categoriesData.categories.map((category) => `<option value="${category.id}">${category.name}</option>`).join('');
    content.innerHTML = `<div class="inventory-header"><div><div class="crumb">Operação de campo / Segurança</div><h2 class="section-title">Equipamentos de Segurança e Sinalização</h2><p class="section-subtitle">Escadas, cones, placas e demais equipamentos de sinalização.</p></div></div><div class="inventory-grid"><section class="panel"><div class="panel-header"><h2>Itens cadastrados</h2><span>${data.items.length} itens</span></div><div class="table-wrap"><table><thead><tr><th>Item</th><th>Condição</th><th>Saldo</th><th>Status</th><th>Ação</th></tr></thead><tbody>${rows}</tbody></table></div></section><section class="panel"><div class="panel-header"><h2>Novo equipamento</h2><span>Cadastro básico</span></div><form id="safety-item-form" class="entry-form"><label>Código<input id="safety-item-code" required></label><label>Nome<input id="safety-item-name" required></label><label>Categoria<select id="safety-item-category" required>${categoryOptions || '<option value="">Cadastre uma categoria primeiro</option>'}</select></label><button class="primary-btn" type="submit">Cadastrar equipamento</button><div class="notice" id="safety-item-notice"></div></form></section></div>`;
    document.querySelector('#safety-item-form').addEventListener('submit', handleSafetyItemCreate);
    document.querySelectorAll('[data-edit-item]').forEach((button) => button.addEventListener('click', () => editItem(button.dataset.editItem, () => loadSafetyModule())));
    document.querySelectorAll('[data-delete-item]').forEach((button) => button.addEventListener('click', () => deleteInventoryItem(button.dataset.deleteItem, () => loadSafetyModule())));
  } catch (error) { content.innerHTML = `<div class="module-placeholder"><h2>Equipamentos indisponíveis</h2><p>${error.message}</p></div>`; }
}

async function handleSafetyItemCreate(event) {
  event.preventDefault();
  setSubmitting(event.target, true, 'Cadastrando...');
  const session = JSON.parse(localStorage.getItem(sessionKey));
  const notice = document.querySelector('#safety-item-notice');
  try {
    const categorySelect = document.querySelector('#safety-item-category');
    const response = await fetch(`${API_URL}/inventory/items`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` }, body: JSON.stringify({ code: document.querySelector('#safety-item-code').value, name: document.querySelector('#safety-item-name').value, categoryId: categorySelect.value, categoryGroup: 'Equipamentos de Segurança e Sinalização', type: 'EQUIPAMENTO', unit: 'UN', fieldAsset: true }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Não foi possível cadastrar o equipamento.');
    loadSafetyModule();
  } catch (error) { setSubmitting(event.target, false); notice.textContent = error.message; notice.classList.add('show'); notice.style.background = '#fff4e5'; notice.style.color = 'var(--warning)'; }
}

async function loadReportsModule() {
  const content = document.querySelector('#page-content');
  content.innerHTML = `<div class="inventory-header"><div><div class="crumb">Gestão / Documentos</div><h2 class="section-title">Relatórios do almoxarifado</h2><p class="section-subtitle">Movimentações completas de entradas, saídas, ajustes e devoluções.</p></div></div><section class="panel"><div class="panel-header"><h2>Movimentações do almoxarifado</h2><span>PDF e Excel mensal</span></div><form id="report-form" class="entry-form"><label>Data inicial<input id="report-from" type="date"></label><label>Data final<input id="report-to" type="date"></label><div class="report-actions"><button class="primary-btn" type="submit">Gerar PDF</button><button class="secondary-btn" id="report-excel" type="button">Baixar Excel</button></div><div class="notice" id="report-notice"></div></form></section>`;
  content.insertAdjacentHTML('afterbegin', `<div class="report-hero"><div class="report-hero-mark">▤</div><div><span class="modal-kicker">Relatório 1</span><h2>Movimentações do almoxarifado</h2><p>Use este relatório para fechar o mês com tudo que entrou, saiu ou foi ajustado no estoque.</p></div></div>`);
  document.querySelector('#report-form').addEventListener('submit', (event) => handleReportDownload(event, '/reports/stock.pdf', 'uay-movimentacoes.pdf', 'report-notice', 'report-from', 'report-to'));
  document.querySelector('#report-excel').addEventListener('click', () => handleReportDownload({ preventDefault: () => {} }, '/reports/stock.xlsx', 'uay-movimentacoes.xlsx', 'report-notice', 'report-from', 'report-to'));
}

async function loadTechnicalReportsModule() {
  const content = document.querySelector('#page-content');
  const session = JSON.parse(localStorage.getItem(sessionKey));
  let technicianOptions = '<option value="">Todos os técnicos</option>';
  try {
    const response = await fetch(`${API_URL}/technicians`, { headers: { Authorization: `Bearer ${session.token}` } });
    const data = await response.json();
    if (response.ok) technicianOptions += data.technicians.map((technician) => `<option value="${technician.id}">${safeText(technician.name, 'Técnico')}</option>`).join('');
  } catch (_) { /* O filtro pode ficar em todos os técnicos se a API estiver temporariamente indisponível. */ }
  content.innerHTML = `<div class="inventory-header"><div><div class="crumb">Gestão / Documentos</div><h2 class="section-title">Relatório técnico</h2><p class="section-subtitle">O.S. realizadas, observações, materiais e equipamentos utilizados pelos técnicos.</p></div></div><section class="panel"><div class="panel-header"><h2>Atividades técnicas</h2><span>PDF e Excel mensal</span></div><form id="technician-report-form" class="entry-form"><label>Técnico<select id="technician-report-technician">${technicianOptions}</select></label><label>Data inicial<input id="technician-report-from" type="date"></label><label>Data final<input id="technician-report-to" type="date"></label><div class="report-actions"><button class="primary-btn" type="submit">Gerar PDF</button><button class="secondary-btn" id="technician-report-excel" type="button">Baixar Excel</button></div><div class="notice" id="technician-report-notice"></div></form></section>`;
  content.insertAdjacentHTML('afterbegin', `<div class="report-hero"><div class="report-hero-mark">♙</div><div><span class="modal-kicker">Relatório 2</span><h2>Atividades dos técnicos</h2><p>Use este relatório separado para acompanhar o que foi realizado em cada O.S. no fechamento do mês.</p></div></div>`);
  document.querySelector('#technician-report-form').addEventListener('submit', (event) => handleReportDownload(event, '/reports/technician.pdf', 'uay-relatorio-tecnico.pdf', 'technician-report-notice', 'technician-report-from', 'technician-report-to', 'technician-report-technician'));
  document.querySelector('#technician-report-excel').addEventListener('click', () => handleReportDownload({ preventDefault: () => {} }, '/reports/technician.xlsx', 'uay-relatorio-tecnico.xlsx', 'technician-report-notice', 'technician-report-from', 'technician-report-to', 'technician-report-technician'));
}

async function handleReportDownload(event, endpoint = '/reports/stock.pdf', filename = 'uay-movimentacoes.pdf', noticeId = 'report-notice', fromId = 'report-from', toId = 'report-to', technicianId = '') {
  event.preventDefault();
  const session = JSON.parse(localStorage.getItem(sessionKey));
  const notice = document.querySelector(`#${noticeId}`);
  const from = document.querySelector(`#${fromId}`).value;
  const to = document.querySelector(`#${toId}`).value;
  const selectedTechnician = technicianId ? document.querySelector(`#${technicianId}`).value : '';
  const query = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}), ...(selectedTechnician ? { technicianId: selectedTechnician } : {}) });
  try {
    const response = await fetch(`${API_URL}${endpoint}?${query}`, { headers: { Authorization: `Bearer ${session.token}` } });
    if (!response.ok) { const data = await response.json(); throw new Error(data.message || 'Não foi possível gerar o relatório.'); }
    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => { URL.revokeObjectURL(link.href); link.remove(); }, 1000);
    notice.textContent = 'PDF gerado com sucesso.';
    notice.classList.add('show');
  } catch (error) { notice.textContent = error.message; notice.classList.add('show'); notice.style.background = '#fff4e5'; notice.style.color = 'var(--warning)'; }
}

async function loadPhysicalInventory() {
  const content = document.querySelector('#page-content');
  const session = JSON.parse(localStorage.getItem(sessionKey));
  content.innerHTML = '<div class="panel loading-panel"><h2>Carregando inventário...</h2><p>Preparando a conferência física.</p></div>';
  try {
    const headers = { Authorization: `Bearer ${session.token}` };
    const [sessionsResponse, itemsResponse] = await Promise.all([fetch(`${API_URL}/inventory/inventory-sessions`, { headers }), fetch(`${API_URL}/inventory/items`, { headers })]);
    const sessionsData = await sessionsResponse.json();
    const itemsData = await itemsResponse.json();
    if (!sessionsResponse.ok || !itemsResponse.ok) throw new Error('Não foi possível carregar os dados do inventário.');
    const openSession = sessionsData.sessions.find((item) => item.status === 'OPEN');
    const counts = openSession?.counts || {};
    const checkedCount = itemsData.items.filter((item) => counts[item.id]).length;
    // Recalcula a divergência contra o saldo ATUAL do Estoque (não o valor congelado na contagem), para as telas ficarem sempre sincronizadas.
    const liveDifference = (item) => { const counted = counts[item.id]; return counted ? Number(counted.physicalQuantity) - Number(item.quantity || 0) : null; };
    const divergentCount = itemsData.items.filter((item) => { const diff = liveDifference(item); return diff !== null && diff !== 0; }).length;
    const pendingCount = Math.max(0, itemsData.items.length - checkedCount);
    // Ao zerar os pendentes, encerra a conferência para que ela conste como concluída no histórico e libere uma nova rodada.
    if (openSession && itemsData.items.length > 0 && pendingCount === 0) {
      await fetch(`${API_URL}/inventory/inventory-sessions/${openSession.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` }, body: JSON.stringify({ status: 'CLOSED', closedAt: new Date().toISOString() }) });
      return loadPhysicalInventory();
    }
    const rows = itemsData.items.length ? itemsData.items.map((item) => {
      const counted = counts[item.id];
      const diff = liveDifference(item);
      const statusLabel = !counted ? 'Pendente' : diff !== 0 ? `Divergente (${diff > 0 ? '+' : ''}${diff})` : 'Conferido';
      const statusClass = !counted ? 'status-warning' : diff !== 0 ? 'status-warning' : 'status-ok';
      return `<tr><td><strong>${safeText(item.name, 'Item sem nome')}</strong><small>${safeText(item.code, '-')}</small></td><td>${item.quantity} ${item.unit}</td><td><input type="number" min="0" step="0.001" class="count-input" data-count-item="${item.id}" data-current-quantity="${Number(item.quantity || 0)}" placeholder="Qtd. contada" value="${counted ? counted.physicalQuantity : ''}"></td><td><span class="status-pill ${statusClass}" data-status-item="${item.id}">${statusLabel}</span></td><td><button class="text-btn" type="button" data-confirm-count="${item.id}">Conferir</button></td></tr>`;
    }).join('') : '<tr><td colspan="5" class="empty-cell">Nenhum item cadastrado.</td></tr>';
    content.innerHTML = `<div class="inventory-header"><div><div class="crumb">Controle / Conferência física</div><h2 class="section-title">Conferência de estoque</h2><p class="section-subtitle">Informe a quantidade física contada de cada material. O sistema ajusta o saldo, aponta divergências e registra a data da conferência no relatório.</p></div></div><section class="panel"><div class="panel-header"><h2>Materiais para conferir</h2><span>${itemsData.items.length} itens</span></div><div class="table-wrap"><table><thead><tr><th>Item</th><th>Saldo atual</th><th>Qtd. contada</th><th>Status</th><th>Ação</th></tr></thead><tbody>${rows}</tbody></table></div></section><section class="panel inventory-history"><div class="panel-header"><h2>Conferências realizadas</h2><span>${sessionsData.sessions.length} registros</span></div><div class="table-wrap"><table><thead><tr><th>Conferência</th><th>Status</th><th>Data</th><th>Itens conferidos</th><th>Responsável</th><th>Ação</th></tr></thead><tbody>${sessionsData.sessions.map((item) => `<tr><td>${item.name}</td><td><span class="status-pill ${item.status === 'OPEN' ? 'status-warning' : 'status-ok'}">${item.status === 'OPEN' ? 'Em andamento' : item.status === 'CLOSED' ? 'Encerrada' : item.status}</span></td><td>${new Date(item.startedAt).toLocaleString('pt-BR')}</td><td>${item._count.counts}</td><td>${item.user.name}</td><td class="action-cell"><button class="icon-action" title="Editar" data-edit-session="${item.id}">✎</button><button class="icon-action danger" title="Excluir" data-delete-session="${item.id}">⌫</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty-cell">Nenhuma conferência registrada.</td></tr>'}</tbody></table></div></section>`;
    content.insertAdjacentHTML('afterbegin', `<div class="inventory-summary"><div><strong id="summary-checked">${checkedCount}</strong><span>Conferidos</span></div><div><strong id="summary-pending">${pendingCount}</strong><span>Pendentes</span></div><div><strong id="summary-divergent">${divergentCount}</strong><span>Divergentes</span></div></div>`);
    document.querySelectorAll('[data-confirm-count]').forEach((button) => button.addEventListener('click', () => handleInventoryCount(button.dataset.confirmCount)));
    document.querySelectorAll('.count-input').forEach((input) => input.addEventListener('input', updateInventoryLiveSummary));
    document.querySelectorAll('[data-edit-session]').forEach((button) => button.addEventListener('click', () => editInventorySession(button.dataset.editSession, sessionsData.sessions.find((item) => item.id === button.dataset.editSession))));
    document.querySelectorAll('[data-delete-session]').forEach((button) => button.addEventListener('click', () => deleteInventorySession(button.dataset.deleteSession)));
  } catch (error) { content.innerHTML = `<div class="module-placeholder"><h2>Inventário indisponível</h2><p>${error.message}</p></div>`; }
}

// Recalcula status e cards de resumo no navegador enquanto o usuário digita, antes de confirmar.
function updateInventoryLiveSummary() {
  const inputs = document.querySelectorAll('.count-input');
  let checked = 0;
  let divergent = 0;
  inputs.forEach((input) => {
    const itemId = input.dataset.countItem;
    const currentQuantity = Number(input.dataset.currentQuantity || 0);
    const statusEl = document.querySelector(`[data-status-item="${itemId}"]`);
    if (input.value.trim() === '') {
      if (statusEl) { statusEl.textContent = 'Pendente'; statusEl.className = 'status-pill status-warning'; }
      return;
    }
    checked += 1;
    const difference = Number(input.value) - currentQuantity;
    if (statusEl) {
      if (difference !== 0) { divergent += 1; statusEl.textContent = `Divergente (${difference > 0 ? '+' : ''}${difference})`; statusEl.className = 'status-pill status-warning'; }
      else { statusEl.textContent = 'Conferido'; statusEl.className = 'status-pill status-ok'; }
    } else if (difference !== 0) { divergent += 1; }
  });
  const pending = Math.max(0, inputs.length - checked);
  const checkedEl = document.querySelector('#summary-checked');
  const pendingEl = document.querySelector('#summary-pending');
  const divergentEl = document.querySelector('#summary-divergent');
  if (checkedEl) checkedEl.textContent = checked;
  if (pendingEl) pendingEl.textContent = pending;
  if (divergentEl) divergentEl.textContent = divergent;
}

// Reaproveita a conferência do dia em andamento; cria uma nova automaticamente se não houver.
async function ensureOpenInventorySession(session) {
  const response = await fetch(`${API_URL}/inventory/inventory-sessions`, { headers: { Authorization: `Bearer ${session.token}` } });
  const data = await response.json();
  const open = (data.sessions || []).find((item) => item.status === 'OPEN');
  if (open) return open.id;
  const created = await fetch(`${API_URL}/inventory/inventory-sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` }, body: JSON.stringify({ name: `Conferência ${new Date().toLocaleDateString('pt-BR')}` }) });
  const createdData = await created.json();
  return createdData.session.id;
}

async function handleInventoryCount(itemId) {
  const session = JSON.parse(localStorage.getItem(sessionKey));
  const input = document.querySelector(`[data-count-item="${itemId}"]`);
  const button = document.querySelector(`[data-confirm-count="${itemId}"]`);
  if (!input.value.trim()) { window.alert('Informe a quantidade contada antes de conferir.'); return; }
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = 'Conferindo...';
  try {
    const sessionId = await ensureOpenInventorySession(session);
    const response = await fetch(`${API_URL}/inventory/inventory-counts`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` }, body: JSON.stringify({ sessionId, itemId, physicalQuantity: Number(input.value), reason: 'Conferência física' }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Não foi possível registrar a contagem.');
    loadPhysicalInventory();
  } catch (error) { window.alert(error.message); button.disabled = false; button.textContent = originalLabel; }
}

function editInventorySession(id, inventorySession) {
  if (!inventorySession) return;
  const modal = document.createElement('div');
  modal.className = 'edit-modal-backdrop';
  const statusOptions = [['OPEN', 'Em andamento'], ['CLOSED', 'Encerrada']].map(([value, label]) => `<option value="${value}" ${inventorySession.status === value ? 'selected' : ''}>${label}</option>`).join('');
  modal.innerHTML = `<section class="edit-modal" role="dialog" aria-modal="true"><button class="modal-close" type="button">×</button><div class="modal-kicker">Conferência física</div><h2>Editar conferência</h2><p class="modal-description">Atualize o nome ou o status deste registro.</p><form id="session-edit-form" class="entry-form"><label>Nome<input id="session-edit-name" value="${safeText(inventorySession.name, '')}" required></label><label>Status<select id="session-edit-status">${statusOptions}</select></label><div class="modal-actions"><button class="text-btn" type="button" id="cancel-session-edit">Cancelar</button><button class="primary-btn" type="submit">Salvar alteração</button></div><div class="notice" id="session-edit-notice"></div></form></section>`;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('.modal-close').addEventListener('click', close);
  modal.querySelector('#cancel-session-edit').addEventListener('click', close);
  modal.querySelector('#session-edit-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const notice = modal.querySelector('#session-edit-notice');
    const session = JSON.parse(localStorage.getItem(sessionKey));
    try {
      const response = await fetch(`${API_URL}/inventory/inventory-sessions/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` }, body: JSON.stringify({ name: modal.querySelector('#session-edit-name').value.trim(), status: modal.querySelector('#session-edit-status').value }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Não foi possível atualizar a conferência.');
      close();
      loadPhysicalInventory();
    } catch (error) { notice.textContent = error.message; notice.classList.add('show'); notice.style.background = '#fff4e5'; notice.style.color = 'var(--warning)'; }
  });
}

async function deleteInventorySession(id) {
  if (!window.confirm('Excluir esta conferência? Essa ação não pode ser desfeita.')) return;
  const session = JSON.parse(localStorage.getItem(sessionKey));
  try {
    const response = await fetch(`${API_URL}/inventory/inventory-sessions/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Não foi possível excluir a conferência.');
    loadPhysicalInventory();
  } catch (error) { window.alert(error.message); }
}

// 'materials' mostra por padrão só a categoria de técnicos; 'stock' mostra tudo.
async function loadInventoryModule(module, search = '', group = module === 'materials' ? 'Materiais para técnicos' : '') {
  const content = document.querySelector('#page-content');
  content.innerHTML = `<div class="panel loading-panel"><h2>Carregando ${module === 'stock' ? 'estoque' : 'materiais'}...</h2><p>Consultando os dados atuais da API.</p></div>`;
  const session = JSON.parse(localStorage.getItem(sessionKey));
  try {
    const headers = { Authorization: `Bearer ${session.token}` };
    const [itemsResponse, techniciansResponse, categoriesResponse, technicianMaterialsResponse] = await Promise.all([
      fetch(`${API_URL}/inventory/items?search=${encodeURIComponent(search)}&group=${encodeURIComponent(group)}`, { headers }),
      fetch(`${API_URL}/technicians`, { headers }),
      fetch(`${API_URL}/inventory/categories`, { headers }),
      fetch(`${API_URL}/inventory/items?search=&group=${encodeURIComponent('Materiais para técnicos')}`, { headers }),
    ]);
    const data = await itemsResponse.json();
    const techniciansData = await techniciansResponse.json();
    const categoriesData = await categoriesResponse.json();
    const technicianMaterialsData = await technicianMaterialsResponse.json();
    if (!itemsResponse.ok) throw new Error(data.message || 'Não foi possível consultar o estoque.');
    if (!techniciansResponse.ok) throw new Error(techniciansData.message || 'Não foi possível consultar os técnicos.');
    if (!categoriesResponse.ok) throw new Error(categoriesData.message || 'Não foi possível consultar as categorias.');
    content.innerHTML = inventoryContent(data.items, techniciansData.technicians, categoriesData.categories, module, group, technicianMaterialsData.items || []);
    document.querySelector('#inventory-search').addEventListener('submit', (event) => { event.preventDefault(); loadInventoryModule(module, document.querySelector('#inventory-query').value, document.querySelector('#inventory-group').value); });
    document.querySelector('#inventory-group').addEventListener('change', () => loadInventoryModule(module, document.querySelector('#inventory-query').value, document.querySelector('#inventory-group').value));
    document.querySelector('#entry-form')?.addEventListener('submit', handleStockEntry);
    document.querySelector('#entry-item')?.addEventListener('change', toggleEntrySerialField);
    document.querySelector('#entry-serials')?.addEventListener('input', updateSerializedQuantity);
    document.querySelector('#scan-entry-serials')?.addEventListener('click', () => openBatchSerialScanner(document.querySelector('#entry-serials')));
    toggleEntrySerialField();
    document.querySelector('#issue-form')?.addEventListener('submit', handleStockIssue);
    document.querySelector('#issue-item')?.addEventListener('change', toggleIssueUnitField);
    document.querySelector('#scan-issue-unit')?.addEventListener('click', scanIssueUnitSerial);
    toggleIssueUnitField();
    document.querySelector('#item-form')?.addEventListener('submit', handleItemCreate);
    document.querySelector('#scan-new-serial')?.addEventListener('click', () => openSerialScanner(document.querySelector('#item-serial')));
    document.querySelector('#lookup-form').addEventListener('submit', handleItemLookup);
    document.querySelectorAll('[data-edit-item]').forEach((button) => button.addEventListener('click', () => editItem(button.dataset.editItem, module)));
    document.querySelectorAll('[data-delete-item]').forEach((button) => button.addEventListener('click', () => deleteInventoryItem(button.dataset.deleteItem, module)));
  } catch (error) {
    content.innerHTML = `<div class="module-placeholder"><h2>Estoque indisponível</h2><p>${error.message} Verifique se o PostgreSQL está iniciado e se a migration foi aplicada.</p></div>`;
  }
}

async function handleItemLookup(event) {
  event.preventDefault();
  const value = document.querySelector('#lookup-value').value.trim();
  const notice = document.querySelector('#lookup-notice');
  if (!value) return;
  const session = JSON.parse(localStorage.getItem(sessionKey));
  try {
    const response = await fetch(`${API_URL}/inventory/items/lookup/${encodeURIComponent(value)}`, { headers: { Authorization: `Bearer ${session.token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Item não encontrado.');
    const assigned = data.stock?.assigned?.map((entry) => `${safeText(entry.technician, 'Técnico não informado')}: ${entry.quantity} ${entry.unit}`).join(' | ') || 'Nenhuma unidade alocada';
    const warehouse = Number(data.stock?.warehouse ?? data.item.quantity ?? 0);
    const unitsList = data.units?.length ? `<div class="units-list">${data.units.map((unit) => `<div class="unit-row"><span>Serial ${safeText(unit.serialNumber)} · ${equipmentUnitStatusLabel(unit.status)}${unit.technician ? ` · ${unit.technician.name}` : ''}</span><button class="text-btn" type="button" data-unit-history="${unit.serialNumber}">Ver histórico</button></div>`).join('')}</div>` : '';
    notice.innerHTML = `<strong>${safeText(data.item.name, 'Item')}</strong> · Código: ${safeText(data.item.code, '-')} · Serializado: ${data.item.serialized ? 'Sim' : 'Não'}<br>Local: <strong>${safeText(data.location, 'Não identificado')}</strong><br>Almoxarifado: ${warehouse} ${safeText(data.item.unit, 'UN')} · Em caixas: ${assigned}${unitsList}`;
    notice.classList.add('show');
    notice.querySelectorAll('[data-unit-history]').forEach((button) => button.addEventListener('click', () => showUnitHistory(button.dataset.unitHistory)));
  } catch (error) { notice.textContent = error.message; notice.classList.add('show'); notice.style.background = '#fff4e5'; notice.style.color = 'var(--warning)'; }
}

function equipmentUnitStatusLabel(status) {
  return ({ EM_ESTOQUE: 'Em estoque', ALOCADO: 'Alocado ao técnico', EM_USO_CLIENTE: 'Alocado ao cliente', EM_CONFERENCIA: 'Em conferência', MANUTENCAO: 'Em manutenção', AGUARDANDO_DEVOLUCAO: 'Aguardando devolução', RESERVADO: 'Reservado', DANIFICADO: 'Danificado', DESCARTADO: 'Descartado', DEVOLVIDO: 'Devolvido', BAIXADO: 'Baixado' })[status] || status;
}

function equipmentUnitEventLabel(type) {
  return ({ ENTRADA: 'Entrada no estoque', ALOCACAO: 'Liberado para técnico', INSTALACAO: 'Instalado no cliente', RETIRADA: 'Retirado do cliente', CONFERENCIA: 'Conferido no almoxarifado', MANUTENCAO: 'Enviado para manutenção', DEVOLUCAO: 'Devolvido ao estoque', BAIXA: 'Baixado', AJUSTE: 'Ajuste' })[type] || type;
}

async function showUnitHistory(serialNumber) {
  const session = JSON.parse(localStorage.getItem(sessionKey));
  try {
    const response = await fetch(`${API_URL}/inventory/units/serial/${encodeURIComponent(serialNumber)}`, { headers: { Authorization: `Bearer ${session.token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Não foi possível consultar o histórico deste equipamento.');
    const unit = data.unit;
    const timeline = unit.events.length ? unit.events.map((event) => `<li><strong>${new Date(event.createdAt).toLocaleString('pt-BR')}</strong> — ${equipmentUnitEventLabel(event.type)}${event.technician ? ` · ${event.technician.name}` : ''}${event.customer ? ` · Cliente: ${event.customer}` : ''}${event.serviceOrder ? ` · O.S. #${event.serviceOrder.number}` : ''}${event.notes ? ` · ${safeText(event.notes)}` : ''}</li>`).join('') : '<li>Nenhum evento registrado.</li>';
    const modal = document.createElement('div');
    modal.className = 'edit-modal-backdrop';
    modal.innerHTML = `<section class="edit-modal" role="dialog" aria-modal="true"><button class="modal-close" type="button">×</button><div class="modal-kicker">Rastreabilidade do equipamento</div><h2>${safeText(unit.item.name)} · Serial ${safeText(unit.serialNumber)}</h2><p class="modal-description">Status atual: <strong>${equipmentUnitStatusLabel(unit.status)}</strong>${unit.technician ? ` · Com: ${unit.technician.name}` : ''}${unit.customer ? ` · Cliente: ${unit.customer}` : ''}${unit.contractId ? ` · Contrato: ${safeText(unit.contractId)}` : ''}</p><ul class="unit-timeline">${timeline}</ul></section>`;
    document.body.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
  } catch (error) { window.alert(error.message || 'Não foi possível consultar o histórico deste equipamento.'); }
}

async function returnEquipmentUnit(unit, modal) {
  const reason = window.prompt('Motivo da devolução ao estoque:', 'Retirada do cliente');
  if (!reason || !reason.trim()) return;
  const session = JSON.parse(localStorage.getItem(sessionKey));
  try {
    const response = await fetch(`${API_URL}/inventory/returns`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` }, body: JSON.stringify({ itemId: unit.itemId, technicianId: unit.technicianId, quantity: 1, unitId: unit.id, reason: reason.trim() }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Não foi possível devolver o equipamento.');
    modal.remove();
    window.alert('Equipamento devolvido ao estoque com sucesso.');
    await showUnitHistory(unit.serialNumber);
  } catch (error) { window.alert(error.message || 'Não foi possível devolver o equipamento.'); }
}

function inventoryContent(items, technicians, categories, module, selectedGroup = '', technicianMaterialItems = []) {
  const rows = items.length ? items.map((item) => { const actions = canManage() ? `<button class="icon-action" title="Editar" data-edit-item="${item.id}">✎</button><button class="icon-action danger" title="Arquivar" data-delete-item="${item.id}">⌫</button>` : '<span class="muted-action">Somente leitura</span>'; const stock = `${safeText(item.quantity, '0')} ${safeText(item.unit, 'un')}${item.materialControlType === 'CABEAMENTO' ? `<small>${safeText(item.availableMeters, '0')} m disponíveis</small>` : ''}`; return `<tr><td><strong>${safeText(item.name, 'Item sem nome')}</strong><small>${safeText(item.code, '-')}</small></td><td>${safeText(item.category?.name, 'Materiais para técnicos')}</td><td>${item.materialControlType === 'CABEAMENTO' ? 'Cabeamento' : item.type === 'FERRAMENTA' ? 'Ferramenta' : 'Material'}</td><td>${stock}</td><td><span class="status-pill status-ok">Cadastrado</span></td><td class="action-cell">${actions}</td></tr>`; }).join('') : '<tr><td colspan="6" class="empty-cell">Nenhum item cadastrado.</td></tr>';
  const itemOptions = items.map((item) => `<option value="${item.id}" data-item-type="${item.type}" data-serialized="${item.serialized ? 'true' : 'false'}">${item.name} (${item.unit})</option>`).join('');
  const technicianMaterialOptions = technicianMaterialItems.map((item) => `<option value="${item.id}" data-serialized="${item.serialized ? 'true' : 'false'}" data-code="${safeText(item.code, '')}">${item.name} (${item.unit})</option>`).join('');
  const technicianOptions = technicians.map((technician) => `<option value="${technician.id}">${safeText(technician.name, 'Técnico sem nome')}</option>`).join('');
  const categoryOptions = categories.map((category) => `<option value="${category.id}">${category.name}</option>`).join('');
  // Tela "Materiais para técnicos" serve só para liberar material aos técnicos; cadastro e entrada ficam restritos ao Estoque.
  const showStockForms = module !== 'materials';
  const groupFilter = module === 'materials'
    ? '<input id="inventory-group" type="hidden" value="Materiais para técnicos">'
    : `<select id="inventory-group"><option value=""${selectedGroup === '' ? ' selected' : ''}>Todos os grupos</option><option value="Materiais de estoque"${selectedGroup === 'Materiais de estoque' ? ' selected' : ''}>Materiais de estoque</option><option value="Materiais para técnicos"${selectedGroup === 'Materiais para técnicos' ? ' selected' : ''}>Materiais para técnicos</option><option value="Ferramentas"${selectedGroup === 'Ferramentas' ? ' selected' : ''}>Ferramentas</option></select>`;
  const newMaterialForm = showStockForms ? `<div class="panel-header"><h2>Novo material</h2><span>Cadastro básico</span></div><form id="item-form" class="entry-form"><label>Código<input id="item-code" required></label><label>Nome<input id="item-name" required></label><label>Categoria<select id="item-category" required>${categoryOptions || '<option value="">Cadastre uma categoria primeiro</option>'}</select></label><label>Tipo<select id="item-type"><option value="MATERIAL">Material</option><option value="FERRAMENTA">Ferramenta</option><option value="EPI">EPI</option><option value="EQUIPAMENTO">Equipamento</option></select></label><label class="checkbox-label"><input id="item-serialized" type="checkbox"> Produto serializado</label><label>Fabricante<input id="item-manufacturer"></label><label>Modelo<input id="item-model"></label><label>Número de série<div class="scan-input-row"><input id="item-serial"><button class="text-btn" type="button" id="scan-new-serial">Escanear</button></div></label><label>Controle<select id="item-control-type"><option value="CONVENCIONAL">Convencional (unidade)</option><option value="CABEAMENTO">Cabeamento (bobina e metros)</option></select></label><label>Metragem por bobina (m)<input id="item-meters-per-unit" type="number" min="0.001" step="0.001" placeholder="Obrigatório para cabeamento"></label><button class="primary-btn" type="submit">Cadastrar material</button><div class="notice" id="item-notice"></div></form>` : '';
  const stockEntryForm = showStockForms ? `<div class="panel-header issue-title"><h2>Entrada de estoque</h2><span>Registro rastreável</span></div><form id="entry-form" class="entry-form"><label>Material ou equipamento<select id="entry-item" required>${itemOptions}</select></label><label id="entry-quantity-label">Quantidade<input id="entry-quantity" type="number" min="0.001" step="0.001" required></label><label id="entry-serial-field" class="hidden-field">Seriais dos equipamentos<small>Escaneie ou digite um serial por linha.</small><div class="scan-input-row"><textarea id="entry-serials" rows="4" placeholder="Um serial por linha"></textarea><button class="text-btn" type="button" id="scan-entry-serials">Escanear</button></div><strong id="entry-serial-count" class="serial-count">Quantidade identificada automaticamente: 0 unidades</strong></label><label>Fornecedor<input id="entry-supplier" required></label><label>Motivo<input id="entry-reason" value="Recebimento de compra" required></label><label>Observação<textarea id="entry-notes" rows="3"></textarea></label><button class="primary-btn" type="submit">Confirmar entrada</button><div class="notice" id="entry-notice"></div></form>` : '';
  // 'Saída para técnico' fica restrita à tela de Materiais; no Estoque a liberação não aparece.
  const showIssueForm = module === 'materials';
  const issueForm = showIssueForm ? `<div class="panel-header${showStockForms ? ' issue-title' : ''}"><h2>Saída para técnico</h2><span>Saldo e responsabilidade</span></div><form id="issue-form" class="entry-form"><label>Técnico<select id="issue-technician" required>${technicianOptions || '<option value="">Cadastre um técnico primeiro</option>'}</select></label><label>Material<select id="issue-item" required>${technicianMaterialOptions || '<option value="">Nenhum material para técnicos cadastrado</option>'}</select></label><label id="issue-quantity-label">Quantidade<input id="issue-quantity" type="number" min="0.001" step="0.001" required></label><label id="issue-unit-field" class="hidden-field">Número de série disponível<div class="scan-input-row"><select id="issue-unit"><option value="">Selecione o equipamento</option></select><button class="text-btn" type="button" id="scan-issue-unit">Bipar</button></div><small id="issue-unit-status" class="unit-status"></small></label><label>Motivo<input id="issue-reason" value="Atendimento em campo" required></label><label>Ordem de serviço<input id="issue-work-order"></label><button class="primary-btn" type="submit">Liberar material</button><div class="notice" id="issue-notice"></div></form>` : '';
  return `<div class="inventory-header"><div><div class="crumb">Operação / ${module === 'stock' ? 'Estoque geral' : 'Liberação para técnicos'}</div><h2 class="section-title">${module === 'stock' ? 'Estoque geral' : 'Materiais para técnicos'}</h2><p class="section-subtitle">${module === 'stock' ? 'Consulte todo o catálogo e registre entradas no almoxarifado.' : 'Consulte somente itens destinados ao campo e libere-os para um técnico.'}</p></div><button class="primary-btn compact-btn" type="button" onclick="document.querySelector('#entry-panel').scrollIntoView({behavior:'smooth'})">${module === 'stock' ? 'Registrar entrada' : 'Liberar material'}</button></div><div class="panel scan-panel"><div><strong>Identificar item</strong><small>Use código, patrimônio, série, barcode ou QR Code.</small></div><form id="lookup-form" class="inventory-filters"><input id="lookup-value" placeholder="Digite ou escaneie o código"><button class="text-btn" type="submit">Consultar</button></form><div class="notice" id="lookup-notice"></div></div><div class="inventory-grid"><section class="panel"><form class="inventory-filters" id="inventory-search"><input id="inventory-query" placeholder="Buscar por nome ou código">${groupFilter}<button class="text-btn" type="submit">Buscar</button></form><div class="table-wrap"><table><thead><tr><th>Item</th><th>Grupo</th><th>Tipo</th><th>Saldo</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div></section><section class="panel" id="entry-panel">${newMaterialForm}${stockEntryForm}${issueForm}</section></div>`;
}

async function handleStockEntry(event) {
  event.preventDefault();
  setSubmitting(event.target, true, 'Registrando...');
  const session = JSON.parse(localStorage.getItem(sessionKey));
  const notice = document.querySelector('#entry-notice');
  try {
    const serialNumbers = getEntrySerials();
    const selectedItem = document.querySelector('#entry-item').selectedOptions[0];
    const quantity = selectedItem?.dataset.serialized === 'true' ? serialNumbers.length : Number(document.querySelector('#entry-quantity').value);
    const response = await fetch(`${API_URL}/inventory/entries`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${session.token}` }, body:JSON.stringify({ itemId:document.querySelector('#entry-item').value, quantity, serialNumbers, supplier:document.querySelector('#entry-supplier').value, reason:document.querySelector('#entry-reason').value, notes:document.querySelector('#entry-notes').value }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Não foi possível registrar a entrada.');
    notice.textContent = 'Entrada registrada e saldo atualizado.';
    notice.classList.add('show');
    event.target.reset();
    loadInventoryModule('stock');
  } catch (error) { setSubmitting(event.target, false); notice.textContent = error.message; notice.classList.add('show'); notice.style.background = '#fff4e5'; notice.style.color = 'var(--warning)'; }
}

function toggleEntrySerialField() {
  const select = document.querySelector('#entry-item');
  const field = document.querySelector('#entry-serial-field');
  if (!select || !field) return;
  const isSerialized = select.selectedOptions[0]?.dataset.serialized === 'true';
  const quantity = document.querySelector('#entry-quantity');
  field.classList.toggle('hidden-field', !isSerialized);
  if (quantity) quantity.disabled = isSerialized;
  if (!isSerialized && document.querySelector('#entry-serials')) document.querySelector('#entry-serials').value = '';
  updateSerializedQuantity();
}

function getEntrySerials() {
  return (document.querySelector('#entry-serials')?.value || '').split(/\r?\n/).map((value) => value.trim()).filter(Boolean).filter((value, index, values) => values.indexOf(value) === index);
}

function updateSerializedQuantity() {
  const select = document.querySelector('#entry-item');
  const quantity = document.querySelector('#entry-quantity');
  const count = document.querySelector('#entry-serial-count');
  if (!select || !quantity || select.selectedOptions[0]?.dataset.serialized !== 'true') return;
  const total = getEntrySerials().length;
  quantity.value = String(total);
  if (count) count.textContent = `Quantidade identificada automaticamente: ${total} unidade${total === 1 ? '' : 's'}`;
}

async function handleStockIssue(event) {
  event.preventDefault();
  setSubmitting(event.target, true, 'Liberando...');
  const session = JSON.parse(localStorage.getItem(sessionKey));
  const notice = document.querySelector('#issue-notice');
  try {
    const select = document.querySelector('#issue-item');
    const isSerialized = select.selectedOptions[0]?.dataset.serialized === 'true';
    const unitId = document.querySelector('#issue-unit')?.value || undefined;
    if (isSerialized && !unitId) throw new Error('Selecione o número de série do equipamento a ser liberado.');
    const response = await fetch(`${API_URL}/inventory/issues`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${session.token}` }, body:JSON.stringify({ itemId:select.value, technicianId:document.querySelector('#issue-technician').value, quantity: isSerialized ? 1 : Number(document.querySelector('#issue-quantity').value), unitId, reason:document.querySelector('#issue-reason').value, workOrder:document.querySelector('#issue-work-order').value }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Não foi possível liberar o material.');
    notice.textContent = 'Saída registrada e responsabilidade atualizada.';
    notice.classList.add('show');
    event.target.reset();
    loadInventoryModule('materials');
  } catch (error) { setSubmitting(event.target, false); notice.textContent = error.message; notice.classList.add('show'); notice.style.background = '#fff4e5'; notice.style.color = 'var(--warning)'; }
}

async function toggleIssueUnitField() {
  const select = document.querySelector('#issue-item');
  const field = document.querySelector('#issue-unit-field');
  const quantityLabel = document.querySelector('#issue-quantity-label');
  const quantity = document.querySelector('#issue-quantity');
  const unitSelect = document.querySelector('#issue-unit');
  const status = document.querySelector('#issue-unit-status');
  if (!select || !field || !unitSelect) return;
  const isSerialized = select.selectedOptions[0]?.dataset.serialized === 'true';
  field.classList.toggle('hidden-field', !isSerialized);
  if (quantityLabel) quantityLabel.classList.toggle('hidden-field', isSerialized);
  if (quantity) quantity.disabled = isSerialized;
  unitSelect.disabled = !isSerialized;
  if (status) status.textContent = '';
  unitSelect.innerHTML = '<option value="">Carregando...</option>';
  if (!isSerialized || !select.value) { unitSelect.innerHTML = '<option value="">Selecione o equipamento</option>'; return; }
  const session = JSON.parse(localStorage.getItem(sessionKey));
  try {
    const response = await fetch(`${API_URL}/inventory/items/${select.value}/units?status=EM_ESTOQUE`, { headers: { Authorization: `Bearer ${session.token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Não foi possível consultar os equipamentos disponíveis.');
    unitSelect.innerHTML = data.units.length ? data.units.map((unit) => `<option value="${unit.id}">Serial ${unit.serialNumber}</option>`).join('') : '<option value="">Nenhum equipamento em estoque</option>';
  } catch (error) { unitSelect.innerHTML = `<option value="">${error.message}</option>`; }
}

async function scanIssueUnitSerial() {
  const select = document.querySelector('#issue-item');
  const unitSelect = document.querySelector('#issue-unit');
  const status = document.querySelector('#issue-unit-status');
  if (!select?.value) { window.alert('Selecione o material antes de bipar o serial.'); return; }
  if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) {
    window.alert('Este navegador não suporta leitura pela câmera. Digite/escolha o serial manualmente ou use o Chrome atualizado em localhost/HTTPS.');
    return;
  }
  const scanner = document.createElement('div');
  scanner.className = 'edit-modal-backdrop';
  scanner.innerHTML = '<section class="edit-modal scanner-modal" role="dialog" aria-modal="true"><button class="modal-close" type="button">×</button><div class="modal-kicker">Bipagem de equipamento</div><h2>Bipar número de série</h2><p class="modal-description">Aponte a câmera para o código de barras ou QR Code do equipamento a ser liberado.</p><video class="scanner-video" autoplay playsinline></video><p class="scanner-status">Iniciando câmera...</p></section>';
  document.body.appendChild(scanner);
  const video = scanner.querySelector('.scanner-video');
  const scannerStatus = scanner.querySelector('.scanner-status');
  let stream;
  let stopped = false;
  const close = () => { stopped = true; stream?.getTracks().forEach((track) => track.stop()); scanner.remove(); };
  scanner.querySelector('.modal-close').addEventListener('click', close);
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
    video.srcObject = stream;
    const detector = new window.BarcodeDetector({ formats: ['code128', 'code39', 'ean13', 'ean8', 'qr', 'upc_a', 'upc_e'] });
    scannerStatus.textContent = 'Aguardando leitura...';
    const scan = async () => {
      if (stopped) return;
      try {
        const codes = await detector.detect(video);
        const value = codes[0]?.rawValue?.trim();
        if (value) { close(); await checkIssueUnitAvailability(value, select, unitSelect, status); return; }
      } catch (_) { /* câmera ainda sem quadro válido */ }
      window.requestAnimationFrame(scan);
    };
    scan();
  } catch (_) {
    scannerStatus.textContent = 'Não foi possível acessar a câmera. Verifique a permissão do navegador.';
    window.setTimeout(close, 2500);
  }
}

async function checkIssueUnitAvailability(serialNumber, select, unitSelect, status) {
  if (!status) return;
  status.textContent = 'Consultando serial...';
  status.className = 'unit-status';
  const session = JSON.parse(localStorage.getItem(sessionKey));
  try {
    const response = await fetch(`${API_URL}/inventory/units/serial/${encodeURIComponent(serialNumber)}`, { headers: { Authorization: `Bearer ${session.token}` } });
    const data = await response.json();
    if (!response.ok) { status.textContent = `Serial ${serialNumber}: nenhum equipamento encontrado.`; status.classList.add('unit-status-danger'); return; }
    const unit = data.unit;
    const selectedCode = select.selectedOptions[0]?.dataset.code;
    if (unit.item.code !== selectedCode) { status.textContent = `Serial ${serialNumber} pertence a "${unit.item.name}", não ao material selecionado.`; status.classList.add('unit-status-danger'); return; }
    if (unit.status !== 'EM_ESTOQUE') {
      const holder = unit.technician?.name ? ` com ${unit.technician.name}` : '';
      status.textContent = `Serial ${serialNumber} indisponível: ${equipmentUnitStatusLabel(unit.status)}${holder}.`;
      status.classList.add('unit-status-danger');
      return;
    }
    if (!unitSelect.querySelector(`option[value="${unit.id}"]`)) {
      const option = document.createElement('option');
      option.value = unit.id;
      option.textContent = `Serial ${unit.serialNumber}`;
      unitSelect.appendChild(option);
    }
    unitSelect.value = unit.id;
    status.textContent = `Serial ${serialNumber} disponível e selecionado.`;
    status.classList.add('unit-status-ok');
  } catch (error) { status.textContent = error.message || 'Não foi possível consultar o serial.'; status.classList.add('unit-status-danger'); }
}

async function handleItemCreate(event) {
  event.preventDefault();
  setSubmitting(event.target, true, 'Cadastrando...');
  const session = JSON.parse(localStorage.getItem(sessionKey));
  const notice = document.querySelector('#item-notice');
  try {
    const categorySelect = document.querySelector('#item-category');
    const materialControlType = document.querySelector('#item-control-type').value;
    const metersPerUnit = Number(document.querySelector('#item-meters-per-unit').value);
    const response = await fetch(`${API_URL}/inventory/items`, { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${session.token}` }, body:JSON.stringify({ code:document.querySelector('#item-code').value, name:document.querySelector('#item-name').value, categoryId:categorySelect.value, type:document.querySelector('#item-type').value, serialized:document.querySelector('#item-serialized').checked, manufacturer:document.querySelector('#item-manufacturer').value.trim() || null, model:document.querySelector('#item-model').value.trim() || null, serialNumber:document.querySelector('#item-serial').value.trim() || null, materialControlType, metersPerUnit: materialControlType === 'CABEAMENTO' ? metersPerUnit : undefined }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Não foi possível cadastrar o material.');
    notice.textContent = 'Material cadastrado com sucesso.';
    notice.classList.add('show');
    event.target.reset();
    loadInventoryModule('materials');
  } catch (error) { setSubmitting(event.target, false); notice.textContent = error.message; notice.classList.add('show'); notice.style.background = '#fff4e5'; notice.style.color = 'var(--warning)'; }
}

async function editItem(id, moduleOrReload = 'stock') {
  if (!canManage()) return;
  const reload = typeof moduleOrReload === 'function' ? moduleOrReload : () => loadInventoryModule(moduleOrReload);
  const session = JSON.parse(localStorage.getItem(sessionKey));
  let item;
  let categories;
  try {
    const [itemResponse, categoriesResponse] = await Promise.all([
      fetch(`${API_URL}/inventory/items/${id}`, { headers: { Authorization: `Bearer ${session.token}` } }),
      fetch(`${API_URL}/inventory/categories`, { headers: { Authorization: `Bearer ${session.token}` } }),
    ]);
    const itemData = await itemResponse.json();
    const categoriesData = await categoriesResponse.json();
    if (!itemResponse.ok) throw new Error(itemData.message || 'Não foi possível carregar o item.');
    if (!categoriesResponse.ok) throw new Error(categoriesData.message || 'Não foi possível carregar as categorias.');
    item = itemData.item;
    categories = categoriesData.categories;
  } catch (error) { window.alert(error.message || 'Não foi possível carregar o item.'); return; }
  const categoryOptions = categories.map((category) => `<option value="${category.id}" ${item.categoryId === category.id ? 'selected' : ''}>${category.name}</option>`).join('');
  const isAsset = ['EQUIPAMENTO', 'FERRAMENTA', 'EPI'].includes(item.type);
  const modal = document.createElement('div');
  modal.className = 'edit-modal-backdrop';
  const assetFields = isAsset ? `<label>Fabricante<input id="item-edit-manufacturer" value="${safeText(item.manufacturer, '')}"></label><label>Modelo<input id="item-edit-model" value="${safeText(item.model, '')}"></label><label>Número de série<div class="scan-input-row"><input id="item-edit-serial" value="${safeText(item.serialNumber, '')}" placeholder="Digite ou escaneie"><button class="text-btn" type="button" id="scan-serial-button">Escanear</button></div></label>` : '';
  modal.innerHTML = `<section class="edit-modal" role="dialog" aria-modal="true"><button class="modal-close" type="button">×</button><div class="modal-kicker">${isAsset ? 'Cadastro de patrimônio' : 'Cadastro de materiais'}</div><h2>Editar item</h2><p class="modal-description">Atualize os dados do cadastro e informe o motivo da alteração.</p><form id="item-edit-form" class="entry-form"><label>Código<input id="item-edit-code" value="${safeText(item.code, '')}" required></label><label>Nome<input id="item-edit-name" value="${safeText(item.name, '')}" required></label><label>Categoria<select id="item-edit-category">${categoryOptions || '<option value="">Sem categorias cadastradas</option>'}</select></label><label>Quantidade<input id="item-edit-quantity" type="number" min="0" step="0.001" value="${Number(item.quantity || 0)}" required></label><label class="checkbox-label"><input id="item-edit-serialized" type="checkbox" ${item.serialized ? 'checked' : ''}> Produto serializado</label>${assetFields}<label>Controle<select id="item-edit-control"><option value="CONVENCIONAL" ${item.materialControlType !== 'CABEAMENTO' ? 'selected' : ''}>Convencional (unidade)</option><option value="CABEAMENTO" ${item.materialControlType === 'CABEAMENTO' ? 'selected' : ''}>Cabeamento (bobina e metros)</option></select></label><label>Metragem por bobina (m)<input id="item-edit-meters-per-unit" type="number" min="0.001" step="0.001" value="${item.metersPerUnit || ''}" placeholder="Obrigatório para cabeamento"></label><label>Condição<select id="item-edit-condition"><option value="BOM" ${item.condition === 'BOM' ? 'selected' : ''}>Bom</option><option value="USADO" ${item.condition === 'USADO' ? 'selected' : ''}>Usado</option><option value="DANIFICADO" ${item.condition === 'DANIFICADO' ? 'selected' : ''}>Danificado</option></select></label><label>Motivo da edição<textarea id="item-edit-reason" rows="3" placeholder="Por que este cadastro está sendo corrigido?" required></textarea></label><div class="modal-actions"><button class="text-btn" type="button" id="cancel-item-edit">Cancelar</button><button class="primary-btn" type="submit">Salvar alteração</button></div></form></section>`;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('.modal-close').addEventListener('click', close);
  modal.querySelector('#cancel-item-edit').addEventListener('click', close);
  modal.querySelector('#scan-serial-button')?.addEventListener('click', () => openSerialScanner(modal.querySelector('#item-edit-serial')));
  modal.querySelector('#item-edit-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const materialControlType = modal.querySelector('#item-edit-control').value;
      const metersPerUnit = Number(modal.querySelector('#item-edit-meters-per-unit').value);
      const assetPayload = isAsset ? { code: modal.querySelector('#item-edit-code').value.trim(), name: modal.querySelector('#item-edit-name').value.trim(), quantity: Number(modal.querySelector('#item-edit-quantity').value), serialized: modal.querySelector('#item-edit-serialized').checked, manufacturer: modal.querySelector('#item-edit-manufacturer').value.trim() || null, model: modal.querySelector('#item-edit-model').value.trim() || null, serialNumber: modal.querySelector('#item-edit-serial').value.trim() || null, condition: modal.querySelector('#item-edit-condition').value } : { code: modal.querySelector('#item-edit-code').value.trim(), name: modal.querySelector('#item-edit-name').value.trim(), categoryId: modal.querySelector('#item-edit-category').value, quantity: Number(modal.querySelector('#item-edit-quantity').value), serialized: modal.querySelector('#item-edit-serialized').checked, materialControlType, metersPerUnit: materialControlType === 'CABEAMENTO' ? metersPerUnit : null, condition: modal.querySelector('#item-edit-condition').value };
      const response = await fetch(`${API_URL}/inventory/items/${id}${isAsset ? '/asset' : ''}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` }, body: JSON.stringify(assetPayload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Não foi possível salvar o item.');
      close();
      reload();
    } catch (error) { window.alert(error.message || 'Não foi possível salvar o item.'); }
  });
}

async function deleteInventoryItem(id, moduleOrReload = 'stock') {
  if (!canManage() || !window.confirm('Arquivar este item? O histórico de movimentações será preservado.')) return;
  const reload = typeof moduleOrReload === 'function' ? moduleOrReload : () => loadInventoryModule(moduleOrReload);
  const session = JSON.parse(localStorage.getItem(sessionKey));
  try {
    const response = await fetch(`${API_URL}/inventory/items/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.token}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Não foi possível arquivar o item.');
    reload();
  } catch (error) { window.alert(error.message); }
}

async function openSerialScanner(targetInput) {
  if (!targetInput) return;
  if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) {
    window.alert('Este navegador não suporta leitura pela câmera. Digite o número de série ou use o Chrome atualizado em localhost/HTTPS.');
    return;
  }
  const scanner = document.createElement('div');
  scanner.className = 'edit-modal-backdrop';
  scanner.innerHTML = '<section class="edit-modal scanner-modal" role="dialog" aria-modal="true"><button class="modal-close" type="button">×</button><div class="modal-kicker">Leitura de patrimônio</div><h2>Escanear número de série</h2><p class="modal-description">Aponte a câmera para o código de barras ou QR Code do equipamento.</p><video class="scanner-video" autoplay playsinline></video><p class="scanner-status">Iniciando câmera...</p></section>';
  document.body.appendChild(scanner);
  const video = scanner.querySelector('.scanner-video');
  const status = scanner.querySelector('.scanner-status');
  let stream;
  let stopped = false;
  const close = () => { stopped = true; stream?.getTracks().forEach((track) => track.stop()); scanner.remove(); };
  scanner.querySelector('.modal-close').addEventListener('click', close);
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
    video.srcObject = stream;
    const detector = new window.BarcodeDetector({ formats: ['code128', 'code39', 'ean13', 'ean8', 'qr', 'upc_a', 'upc_e'] });
    status.textContent = 'Aguardando leitura...';
    const scan = async () => {
      if (stopped) return;
      try {
        const codes = await detector.detect(video);
        if (codes[0]?.rawValue) { targetInput.value = codes[0].rawValue.trim(); targetInput.dispatchEvent(new Event('input', { bubbles: true })); close(); return; }
      } catch (_) { /* câmera ainda sem quadro válido */ }
      window.requestAnimationFrame(scan);
    };
    scan();
  } catch (error) {
    status.textContent = 'Não foi possível acessar a câmera. Verifique a permissão do navegador.';
    window.setTimeout(close, 2500);
  }
}

async function openBatchSerialScanner(targetInput) {
  if (!targetInput) return;
  if (!('BarcodeDetector' in window) || !navigator.mediaDevices?.getUserMedia) {
    window.alert('Este navegador não suporta leitura pela câmera. Use o Chrome atualizado em localhost/HTTPS.');
    return;
  }
  const scanner = document.createElement('div');
  scanner.className = 'edit-modal-backdrop';
  scanner.innerHTML = '<section class="edit-modal scanner-modal" role="dialog" aria-modal="true"><button class="modal-close" type="button">×</button><div class="modal-kicker">Entrada em lote</div><h2>Escanear seriais</h2><p class="modal-description">Aponte para um equipamento por vez. A câmera continuará aberta para ler todos os seriais.</p><video class="scanner-video" autoplay playsinline></video><p class="scanner-status">Iniciando câmera...</p><button class="primary-btn" type="button" id="finish-batch-scan">Concluir leitura</button></section>';
  document.body.appendChild(scanner);
  const video = scanner.querySelector('.scanner-video');
  const status = scanner.querySelector('.scanner-status');
  const serials = new Set((targetInput.value || '').split(/\r?\n/).map((value) => value.trim()).filter(Boolean));
  let stream;
  let stopped = false;
  const close = () => { stopped = true; stream?.getTracks().forEach((track) => track.stop()); scanner.remove(); };
  scanner.querySelector('.modal-close').addEventListener('click', close);
  scanner.querySelector('#finish-batch-scan').addEventListener('click', () => { targetInput.value = Array.from(serials).join('\n'); targetInput.dispatchEvent(new Event('input', { bubbles: true })); close(); });
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
    video.srcObject = stream;
    const detector = new window.BarcodeDetector({ formats: ['code128', 'code39', 'ean13', 'ean8', 'qr', 'upc_a', 'upc_e'] });
    status.textContent = `${serials.size} serial(is) lido(s)`;
    let lastValue = '';
    let lastReadAt = 0;
    const scan = async () => {
      if (stopped) return;
      try {
        const codes = await detector.detect(video);
        const value = codes[0]?.rawValue?.trim();
        if (value && (value !== lastValue || Date.now() - lastReadAt > 1200)) {
          serials.add(value);
          lastValue = value;
          lastReadAt = Date.now();
          status.textContent = `${serials.size} serial(is) lido(s) - continue escaneando`;
        }
      } catch (_) { /* câmera ainda sem quadro válido */ }
      window.requestAnimationFrame(scan);
    };
    scan();
  } catch (_) {
    status.textContent = 'Não foi possível acessar a câmera. Verifique a permissão do navegador.';
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const login = document.querySelector('#username').value;
  const password = document.querySelector('#password').value;
  try {
    const response = await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login, password }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    localStorage.setItem(sessionKey, JSON.stringify(data));
    renderDashboard(data.user);
  } catch (error) {
    showNotice(error instanceof TypeError ? 'Não foi possível conectar à API. Confirme se o backend está rodando em http://localhost:3333.' : (error.message || 'Não foi possível concluir o login.'));
  }
}

async function handleForgot(event) {
  event.preventDefault();
  const email = document.querySelector('#email').value;
  try { await fetch(`${API_URL}/auth/forgot-password`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ email }) }); } catch (_) { /* API indisponível: não expõe existência do e-mail. */ }
  showNotice('Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.', true);
}

async function handleSignup(event) {
  event.preventDefault();
  const password = document.querySelector('#new-password').value;
  const confirmation = document.querySelector('#confirm-password').value;
  if (password !== confirmation) {
    showNotice('As senhas precisam ser iguais.');
    return;
  }
  try {
    const requestedRole = document.querySelector('#role').value;
    const response = await fetch(`${API_URL}/auth/signup`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name:document.querySelector('#name').value, username:document.querySelector('#username').value.trim().toLowerCase(), password, phone:document.querySelector('#phone').value, role: requestedRole }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    showNotice(`${data.message} Abrindo a solicitação de e-mail...`, true);
    const subject = encodeURIComponent('Solicitação de novo acesso - Uay Internet');
    const roleLabelText = document.querySelector('#role').selectedOptions[0].textContent;
    const body = encodeURIComponent(`Nova solicitação de acesso ao sistema Uay Internet.\n\nNome: ${document.querySelector('#name').value}\nUsuário: ${document.querySelector('#username').value}\nTelefone: ${document.querySelector('#phone').value || 'Não informado'}\nPerfil solicitado: ${roleLabelText}\n\nAprovar ou bloquear este acesso no sistema.`);
    window.location.href = `mailto:rickelmevieira46@gmail.com?subject=${subject}&body=${body}`;
    event.target.reset();
  } catch (error) { showNotice(error.message || 'Não foi possível solicitar o acesso.'); }
}

function showNotice(message, success = false) { const notice = document.querySelector('#form-notice'); notice.textContent = message; notice.classList.add('show'); if (!success) { notice.style.background = '#fff4e5'; notice.style.color = 'var(--warning)'; } }
function bindCommonActions() { document.querySelectorAll('[data-screen]').forEach((button) => button.addEventListener('click', () => ({ login:renderLogin, forgot:renderForgot, signup:renderSignup }[button.dataset.screen])())); document.querySelectorAll('[data-toggle-password]').forEach((button) => button.addEventListener('click', () => { const input = document.querySelector(`#${button.dataset.togglePassword}`); input.type = input.type === 'password' ? 'text' : 'password'; button.textContent = input.type === 'password' ? '◉' : '◌'; })); }

const existingSession = localStorage.getItem(sessionKey);
existingSession ? restoreSession(JSON.parse(existingSession)) : renderLogin();

async function restoreSession(session) {
  try {
    const response = await fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${session.token}` } });
    if (!response.ok) throw new Error('Sessão expirada');
    const data = await response.json();
    renderDashboard(data.user);
  } catch (_) {
    localStorage.removeItem(sessionKey);
    renderLogin();
  }
}
