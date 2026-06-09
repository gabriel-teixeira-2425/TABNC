/**
 * page-configuracoes.js — Preferências salvas no Supabase por usuário/cliente
 * 
 * Fluxo:
 *  - Login  → carrega prefs do banco → aplica
 *  - Logout → aplica tema escuro (padrão da tela de login)
 *  - Mudança → salva no banco imediatamente
 */

// ─── Helpers de preferências ──────────────────────────────────────────────────

/**
 * Carrega preferências do Supabase para o usuário logado.
 * Retorna o objeto de prefs ou os defaults se não houver registro.
 */
async function loadPrefsFromDB(email) {
  const { data, error } = await db
    .from('preferencias')
    .select('*')
    .eq('user_email', email)
    .single();

  if (error || !data) {
    return { theme: 'dark', pagesize: 15, autorefresh: 600000 };
  }
  return { theme: data.theme, pagesize: data.pagesize, autorefresh: data.autorefresh };
}

/**
 * Salva (upsert) preferências no Supabase para o usuário logado.
 */
async function savePrefsToDBForEmail(email, prefs) {
  await db.from('preferencias').upsert(
    {
      user_email:  email,
      user_type:   prefs.user_type || 'funcionario',
      theme:       prefs.theme,
      pagesize:    prefs.pagesize,
      autorefresh: prefs.autorefresh,
      updated_at:  new Date().toISOString(),
    },
    { onConflict: 'user_email' }
  );
}

/**
 * Retorna o email do usuário logado (funcionário ou cliente).
 */
function _currentEmail() {
  if (AppState.currentUser)           return AppState.currentUser.email;
  if (ClienteState?.currentCliente)   return ClienteState.currentCliente.email;
  return null;
}

/**
 * Retorna o tipo do usuário logado.
 */
function _currentUserType() {
  if (ClienteState?.currentCliente) return 'cliente';
  return 'funcionario';
}

// ─── Aplicar ao DOM ───────────────────────────────────────────────────────────

function _applyThemeDOM(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

// ─── Inicialização pós-login ──────────────────────────────────────────────────

/**
 * Chame logo após autenticar o usuário (funcionário ou cliente).
 * Aplica as prefs salvas e inicializa o auto-refresh.
 */
async function applyUserPrefs(email, userType) {
  const prefs = await loadPrefsFromDB(email);

  _applyThemeDOM(prefs.theme);
  AppState.pageSize = prefs.pagesize;
  startAutoRefresh(prefs.autorefresh);

  // Guarda em memória para uso rápido
  window._currentPrefs = { ...prefs, user_type: userType };
}

// ─── Pós-logout: volta ao escuro ─────────────────────────────────────────────

function resetThemeToDefault() {
  _applyThemeDOM('dark');
  window._currentPrefs = null;
}

// ─── Ações do usuário ─────────────────────────────────────────────────────────

async function applyTheme(t) {
  const email = _currentEmail();
  if (!email) return;

  window._currentPrefs = { ...window._currentPrefs, theme: t };
  _applyThemeDOM(t);
  await savePrefsToDBForEmail(email, { ...window._currentPrefs, user_type: _currentUserType() });
  loadConfiguracoes();
  Notif.toast(`Tema ${t === 'dark' ? 'escuro' : 'claro'} aplicado.`, 'success', { duration: 2000 });
}

async function applyPageSize(val) {
  const email = _currentEmail();
  const num   = parseInt(val);
  AppState.pageSize = num;

  if (email) {
    window._currentPrefs = { ...window._currentPrefs, pagesize: num };
    await savePrefsToDBForEmail(email, { ...window._currentPrefs, user_type: _currentUserType() });
  }
  Notif.toast(`Itens por página: ${val}`, 'success', { duration: 2000 });
}

async function applyAutoRefresh(val) {
  const email = _currentEmail();
  const num   = parseInt(val);
  startAutoRefresh(num);

  if (email) {
    window._currentPrefs = { ...window._currentPrefs, autorefresh: num };
    await savePrefsToDBForEmail(email, { ...window._currentPrefs, user_type: _currentUserType() });
  }
  const labels = {
    '30000':  '30 segundos',
    '60000':  '1 minuto',
    '120000': '2 minutos',
    '300000': '5 minutos',
    '600000': '10 minutos',
    '0':      'desativado',
  };
  Notif.toast(`Auto-refresh: ${labels[val] || val}`, 'success', { duration: 2000 });
}

async function resetPrefs() {
  const confirmed = await Modal.confirm(
    'Resetar preferências',
    'Deseja restaurar todas as configurações para o padrão?',
    { confirmLabel: 'Resetar', confirmClass: 'btn-danger' }
  );
  if (!confirmed) return;

  const email = _currentEmail();
  const defaults = { theme: 'dark', pagesize: 15, autorefresh: 600000 };
  window._currentPrefs = { ...defaults, user_type: _currentUserType() };

  _applyThemeDOM('dark');
  AppState.pageSize = 15;
  startAutoRefresh(600000);

  if (email) {
    await savePrefsToDBForEmail(email, window._currentPrefs);
  }

  loadConfiguracoes();
  Notif.notify('Preferências resetadas. Padrão: tema escuro e auto-refresh de 10 minutos.', 'info');
}

// ─── Renderização da tela ─────────────────────────────────────────────────────

function loadConfiguracoes() {
  const el = document.getElementById('configuracoes-content');
  if (!el) return;

  const prefs      = window._currentPrefs || { theme: 'dark', pagesize: 15, autorefresh: 600000 };
  const theme      = prefs.theme;
  const pagesize   = prefs.pagesize;
  const autorefresh = prefs.autorefresh;

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
            <option value="30000"  ${autorefresh===30000?'selected':''}>30 segundos</option>
            <option value="60000"  ${autorefresh===60000?'selected':''}>1 minuto</option>
            <option value="120000" ${autorefresh===120000?'selected':''}>2 minutos</option>
            <option value="300000" ${autorefresh===300000?'selected':''}>5 minutos</option>
            <option value="600000" ${autorefresh===600000?'selected':''}>10 minutos</option>
            <option value="0"      ${autorefresh===0?'selected':''}>Nunca</option>
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
}

// Garante tema escuro na tela de login (antes de qualquer login)
_applyThemeDOM('dark');
