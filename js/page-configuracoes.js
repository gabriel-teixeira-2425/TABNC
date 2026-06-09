/**
 * page-configuracoes.js — Preferências do sistema salvas no localStorage
 */

const PREFS = {
  theme:        { key: 'pref_theme',       default: 'dark'  },
  pagesize:     { key: 'pref_pagesize',    default: '15'    },
  autorefresh:  { key: 'pref_autorefresh', default: '600000' }, // 10 minutos
};

function getPref(name) {
  return localStorage.getItem(PREFS[name].key) ?? PREFS[name].default;
}
function setPref(name, value) {
  localStorage.setItem(PREFS[name].key, value);
}

function loadConfiguracoes() {
  const el = document.getElementById('configuracoes-content');
  if (!el) return;

  const theme       = getPref('theme');
  const pagesize    = getPref('pagesize');
  const autorefresh = getPref('autorefresh');

  el.innerHTML = `
    <div style="max-width:580px;margin:0 auto;display:flex;flex-direction:column;gap:20px">

      <div class="table-card" style="padding:24px">
        <div class="cfg-section-title">${Icons.get('eye',16)} Aparência</div>
        <div class="cfg-row">
          <div>
            <div class="cfg-label">Tema</div>
            <div class="cfg-sub">Escolha entre tema escuro ou claro</div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="cfg-theme-btn ${theme==='dark'?'active':''}" onclick="applyTheme('dark')">
              ${Icons.get('lock',13)} Escuro
            </button>
            <button class="cfg-theme-btn ${theme==='light'?'active':''}" onclick="applyTheme('light')">
              ${Icons.get('eye',13)} Claro
            </button>
          </div>
        </div>
      </div>

      <div class="table-card" style="padding:24px">
        <div class="cfg-section-title">${Icons.get('settings',16)} Preferências de exibição</div>

        <div class="cfg-row">
          <div>
            <div class="cfg-label">Itens por página</div>
            <div class="cfg-sub">Quantidade de chamados na listagem</div>
          </div>
          <select class="inp" onchange="applyPageSize(this.value)" style="width:100px">
            ${[10,15,25,50].map(n => `<option value="${n}" ${pagesize==n?'selected':''}>${n}</option>`).join('')}
          </select>
        </div>

        <div class="cfg-row">
          <div>
            <div class="cfg-label">Auto-refresh</div>
            <div class="cfg-sub">Atualização automática dos dados</div>
          </div>
          <select class="inp" onchange="applyAutoRefresh(this.value)" style="width:130px">
            <option value="30000"  ${autorefresh==='30000'?'selected':''}>30 segundos</option>
            <option value="60000"  ${autorefresh==='60000'?'selected':''}>1 minuto</option>
            <option value="120000" ${autorefresh==='120000'?'selected':''}>2 minutos</option>
            <option value="300000" ${autorefresh==='300000'?'selected':''}>5 minutos</option>
            <option value="600000" ${autorefresh==='600000'?'selected':''}>10 minutos</option>
            <option value="0"      ${autorefresh==='0'?'selected':''}>Nunca</option>
          </select>
        </div>
      </div>

      <div class="table-card" style="padding:20px">
        <div class="cfg-section-title">${Icons.get('info',16)} Sobre o sistema</div>
        <div style="font-size:12px;color:var(--text-muted);line-height:1.8">
          <div>Central de Chamados — Painel Administrativo</div>
          <div>Versão 2.0 · Desenvolvido com Supabase + JavaScript</div>
          <div style="margin-top:8px">
            Os chamados são atualizados automaticamente conforme o intervalo selecionado acima.
            Você também pode clicar no botão "Atualizar" no topo da página para uma atualização manual.
          </div>
        </div>
        <div style="margin-top:16px">
          <button class="btn btn-danger btn-sm" onclick="resetPrefs()">
            ${Icons.get('trash',13)} Resetar todas as preferências
          </button>
        </div>
      </div>
    </div>
  `;

  _applyThemeDOM(theme);
}

function applyTheme(t) {
  setPref('theme', t);
  _applyThemeDOM(t);
  loadConfiguracoes();
  Notif.toast(`Tema ${t === 'dark' ? 'escuro' : 'claro'} aplicado.`, 'success', { duration: 2000 });
}

function _applyThemeDOM(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

function applyPageSize(val) {
  setPref('pagesize', val);
  AppState.pageSize = parseInt(val);
  Notif.toast(`Itens por página: ${val}`, 'success', { duration: 2000 });
}

function applyAutoRefresh(val) {
  setPref('autorefresh', val);
  startAutoRefresh(parseInt(val));
  const labels = { 
    '30000':'30 segundos',
    '60000':'1 minuto',
    '120000':'2 minutos',
    '300000':'5 minutos',
    '600000':'10 minutos',
    '0':'desativado'
  };
  Notif.toast(`Auto-refresh: ${labels[val] || val}`, 'success', { duration: 2000 });
}

function resetPrefs() {
  Modal.confirm(
    'Resetar preferências',
    'Deseja restaurar todas as configurações para o padrão?',
    { confirmLabel: 'Resetar', confirmClass: 'btn-danger' }
  ).then(ok => {
    if (!ok) return;
    Object.values(PREFS).forEach(p => localStorage.removeItem(p.key));
    AppState.pageSize = 15;
    startAutoRefresh(600000);
    _applyThemeDOM('dark');
    loadConfiguracoes();
    Notif.notify('Preferências resetadas. Padrão: tema escuro e auto-refresh de 10 minutos.', 'info');
  });
}

// Aplicar tema escuro como padrão na inicialização
_applyThemeDOM(getPref('theme'));