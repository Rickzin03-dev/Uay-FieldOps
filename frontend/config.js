// Ponto único de configuração do sistema web (Uay Estoque).
// Em desenvolvimento local, deixe apiUrl como null: o app.js calcula automaticamente
// http://<host-atual>:3333/api (funciona em localhost e em qualquer IP da rede local).
//
// Em produção, defina aqui a URL fixa e oficial da API (NUNCA um IP local ou "localhost"):
//   window.UAY_CONFIG = { apiUrl: 'https://api.estoque.uay.com.br/api' };
const localHosts = ['localhost', '127.0.0.1'];
const isLocalHost = localHosts.includes(window.location.hostname) || /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(window.location.hostname);

window.UAY_CONFIG = {
  // Em localhost/LAN, app.js usa a API local na porta 3333. Em domínio HTTPS,
  // o tráfego passa pelo reverse proxy público, sem expor a porta da API.
  apiUrl: isLocalHost ? null : 'https://api.estoque.uayinternet.com.br/api',
};