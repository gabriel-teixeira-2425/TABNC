/**
 * auth.js — Autenticação, sessão, controle de acesso por cargo
 */

async function checkSession() {
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    const ok = await loadUserProfile(session.user.email);
    if (ok) showApp();
  }
}

// Única definição — sem duplicata
async function loadUserProfile(email) {
  const { data: adm, error } = await db
    .from('usuarios_adm')
    .select('*')
    .eq('email', email)
    .eq('ativo', true)
    .single();

  if (error || !adm) return false;
  AppState.currentUser = adm;
  applyUserPermissions();
  updateUserUI();
  return true;
}

/** Mostra/oculta elementos na sidebar com base no cargo */
function applyUserPermissions() {
  const show = (id, perm) => {
    const el = document.getElementById(id);
    if (el) el.style.display = can(perm) ? 'flex' : 'none';
  };
  show('nav-usuarios',    'page_usuarios');
  show('nav-relatorios',  'page_relatorios');
  // Novas páginas — todos os logados
  show('nav-novo-chamado','page_novo_chamado');
  show('nav-perfil',      'page_perfil');
  show('nav-configuracoes','page_configuracoes');
    // Mostrar página de supervisor APENAS para Supervisores
  const isSupervisor = AppState.currentUser?.cargo === 'Supervisor';
  const supervisorNav = document.getElementById('nav-supervisor');
  if (supervisorNav) {
    supervisorNav.style.display = isSupervisor ? 'flex' : 'none';
  }
}

function updateUserUI() {
  const u = AppState.currentUser;
  if (!u) return;
  const name = u.nome || 'Usuário';
  const el = (id) => document.getElementById(id);
  if (el('user-name'))   el('user-name').textContent   = name;
  if (el('user-role'))   el('user-role').textContent   = u.cargo || '—';
  if (el('user-avatar')) el('user-avatar').textContent = name[0].toUpperCase();
}

async function doLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn      = document.getElementById('login-btn');

  clearLoginError();

  if (!email || !password) {
    showLoginError('Preencha e-mail e senha.');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-sm"></span> Autenticando...`;

  try {
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;

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
  } catch (e) {
    showLoginError(e.message || 'Falha na autenticação.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `${Icons.get('arrowRight', 16)} Entrar`;
  }
}

async function doLogout() {
  const confirmed = await Modal.confirm(
    'Encerrar sessão',
    'Deseja realmente sair do sistema?',
    { confirmLabel: 'Sair', confirmClass: 'btn-danger' }
  );
  if (!confirmed) return;

  await db.auth.signOut();
  AppState.currentUser = null;
  AppState.allChamados = [];

  document.getElementById('app').style.display          = 'none';
  document.getElementById('login-screen').style.display = 'flex';

  Notif.clearAll();
  Notif.toast('Sessão encerrada.', 'info');
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.innerHTML = `${Icons.get('alert', 14)} ${msg}`;
  el.style.display = 'flex';
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 500);
}

function clearLoginError() {
  const el = document.getElementById('login-error');
  el.style.display = 'none';
  el.textContent = '';
}

// Intervalo do auto-refresh — pode ser alterado pelas configurações
let _autoRefreshTimer = null;

function startAutoRefresh(intervalMs) {
  if (_autoRefreshTimer) clearInterval(_autoRefreshTimer);
  if (!intervalMs || intervalMs <= 0) {
    console.log('Auto-refresh desativado');
    return;
  }
  console.log(`Auto-refresh configurado para cada ${intervalMs/1000} segundos`);
  _autoRefreshTimer = setInterval(() => {
    if (document.getElementById('app').style.display !== 'none') {
      console.log('⏰ Auto-refresh disparado');
      silentRefresh();
    }
  }, intervalMs);
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display          = 'block';
  navigate('dashboard');

  // Lê preferência salva (padrão: 60s)
  const savedInterval = parseInt(localStorage.getItem('pref_autorefresh') || '60000');
  startAutoRefresh(savedInterval);
}
