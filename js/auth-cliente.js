/**
 * auth-cliente.js — Autenticação unificada: Funcionário e Cliente
 * Adiciona seletor de tipo no login e gerencia ambos os portais.
 */

// Tipo de login ativo: 'funcionario' | 'cliente'
let _loginTipo = 'funcionario';

/** Inicializa o seletor de tipo e verifica sessão existente */
async function checkSessionUnificada() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) return;

  const email = session.user.email;

  // Tenta funcionário primeiro
  const okFunc = await loadUserProfile(email);
  if (okFunc) {
    showApp();
    return;
  }

  // Tenta cliente
  const okCli = await loadClienteProfile(email);
  if (okCli) {
    showAppCliente();
    return;
  }

  // Sessão inválida (usuário removido de ambas as tabelas)
  await db.auth.signOut();
}

/** Carrega perfil do cliente a partir da tabela `clientes` */
async function loadClienteProfile(email) {
  const { data: cli, error } = await db
    .from('clientes')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !cli) return false;

  ClienteState.currentCliente = cli;
  updateClienteUI();
  return true;
}

/** Atualiza UI do portal do cliente com dados do perfil */
function updateClienteUI() {
  const c = ClienteState.currentCliente;
  if (!c) return;
  const name = c.nome || 'Cliente';
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('cli-user-name',   name);
  setEl('cli-user-role',   c.empresa || 'Cliente');
  const av = document.getElementById('cli-user-avatar');
  if (av) av.textContent = name[0].toUpperCase();
}

/** Alterna o tipo de login no seletor visual */
function selecionarTipoLogin(tipo) {
  _loginTipo = tipo;

  const btnFunc = document.getElementById('login-tipo-funcionario');
  const btnCli  = document.getElementById('login-tipo-cliente');
  if (btnFunc) btnFunc.classList.toggle('active', tipo === 'funcionario');
  if (btnCli)  btnCli.classList.toggle('active',  tipo === 'cliente');

  const subEl = document.getElementById('login-sub');
  if (subEl) {
    subEl.textContent = tipo === 'cliente'
      ? 'Acesse para acompanhar seus chamados'
      : 'Acesse com suas credenciais de administrador';
  }
}

/** Login unificado — direciona para o portal correto */
async function doLoginUnificado() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn      = document.getElementById('login-btn');

  clearLoginError();
  if (!email || !password) { showLoginError('Preencha e-mail e senha.'); return; }

  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-sm"></span> Autenticando...`;

  try {
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;

    if (_loginTipo === 'cliente') {
      // ── Fluxo Cliente ──────────────────────────────────────────────────────
      const ok = await loadClienteProfile(email);
      if (!ok) {
        await db.auth.signOut();
        throw new Error('Acesso negado. E-mail não cadastrado como cliente.');
      }
      showAppCliente();
      Notif.toast(`Bem-vindo, ${ClienteState.currentCliente.nome}!`, 'success', { title: 'Login realizado' });
    } else {
      // ── Fluxo Funcionário ──────────────────────────────────────────────────
      const ok = await loadUserProfile(email);
      if (!ok) {
        await db.auth.signOut();
        throw new Error('Acesso negado. Usuário inativo ou não cadastrado como administrador.');
      }
      showApp();
      Notif.notify(
        `Bem-vindo, ${AppState.currentUser.nome}! Sessão iniciada com sucesso.`,
        'success',
        { title: 'Login realizado' }
      );
    }
  } catch (e) {
    showLoginError(e.message || 'Falha na autenticação.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `${Icons.get('arrowRight', 16)} Entrar`;
  }
}

/** Logout do portal do cliente */
async function doLogoutCliente() {
  const confirmed = await Modal.confirm(
    'Encerrar sessão',
    'Deseja realmente sair?',
    { confirmLabel: 'Sair', confirmClass: 'btn-danger' }
  );
  if (!confirmed) return;

  await db.auth.signOut();
  ClienteState.currentCliente = null;
  ClienteState.allChamados    = [];

  const appCli    = document.getElementById('app-cliente');
  const loginScr  = document.getElementById('login-screen');
  if (appCli)   appCli.style.display   = 'none';
  if (loginScr) loginScr.style.display = 'flex';

  // Resetar seletor para funcionário
  selecionarTipoLogin('funcionario');
  Notif.toast('Sessão encerrada.', 'info');
}

// ERRO 8: auto-refresh silencioso a cada 10 minutos para o portal do cliente
let _cliAutoRefreshTimer = null;

function _startClienteAutoRefresh() {
  if (_cliAutoRefreshTimer) clearInterval(_cliAutoRefreshTimer);
  _cliAutoRefreshTimer = setInterval(() => {
    const appCli = document.getElementById('app-cliente');
    if (appCli && appCli.style.display !== 'none') {
      loadClienteChamados(true); // silencioso
    }
  }, 10 * 60 * 1000); // 10 minutos fixos, sem opção de configuração
}

/** Exibe o portal do cliente */
function showAppCliente() {
  const loginScr = document.getElementById('login-screen');
  const appCli   = document.getElementById('app-cliente');
  const app      = document.getElementById('app');

  if (loginScr) loginScr.style.display = 'none';
  if (app)      app.style.display      = 'none';
  if (appCli)   appCli.style.display   = 'block';

  navigateCliente('meus-chamados');
  _startClienteAutoRefresh(); // ERRO 8
}

// Substitui checkSession original para usar a versão unificada
window.checkSession = checkSessionUnificada;

// Substitui doLogin original para usar a versão unificada
window.doLogin = doLoginUnificado;
