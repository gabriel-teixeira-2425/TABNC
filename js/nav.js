/**
 * nav.js — Navegação entre páginas, sidebar, topbar
 * CORRIGIDO ERRO 1: mudança de departamento reflete imediatamente
 * CORRIGIDO ERRO 2: lógica correta de visibilidade por cargo
 * CORRIGIDO ERRO 7: seções da sidebar ocultadas quando sem permissão
 */

const PAGES = {
  dashboard:      { title: 'Dashboard',        sub: 'Visão geral do sistema',            perm: 'page_dashboard'     },
  chamados:       { title: 'Chamados',          sub: 'Gerenciar todos os chamados',       perm: 'page_chamados'      },
  'novo-chamado': { title: 'Novo Chamado',      sub: 'Abrir chamado em nome do cliente',  perm: 'page_novo_chamado'  },
  relatorios:     { title: 'Relatórios',        sub: 'Análise de desempenho e SLA',       perm: 'page_relatorios'    },
  usuarios:       { title: 'Usuários',          sub: 'Gerenciar equipe e permissões',     perm: 'page_usuarios'      },
  perfil:         { title: 'Meu Perfil',        sub: 'Dados da sua conta',                perm: 'page_perfil'        },
  configuracoes:  { title: 'Configurações',     sub: 'Preferências do sistema',           perm: 'page_configuracoes' },
  supervisor:     { title: 'Minha Equipe',      sub: 'Visualizar equipe do departamento', perm: 'page_supervisor'    },
};

function navigate(page) {
  const cfg = PAGES[page];
  if (!cfg) return;

  if (!can(cfg.perm)) {
    Notif.toast('Você não tem permissão para acessar esta página.', 'error', { title: 'Acesso negado' });
    return;
  }

  AppState.activePage = page;

  document.querySelectorAll('[data-page]').forEach(el => el.style.display = 'none');
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.style.display = 'block';

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`nav-${page}`)?.classList.add('active');

  document.getElementById('page-title').textContent = cfg.title;
  document.getElementById('page-sub').textContent   = cfg.sub;

  if (page === 'dashboard')      loadDashboard();
  if (page === 'chamados')       loadChamados();
  if (page === 'novo-chamado')   loadNovoChamado();
  if (page === 'relatorios')     loadRelatorios();
  if (page === 'usuarios')       loadUsuarios();
  if (page === 'perfil')         loadPerfil();
  if (page === 'configuracoes')  loadConfiguracoes();
  if (page === 'supervisor')     loadSupervisor();

  if (window.innerWidth <= 768) toggleSidebar(false);
}

function toggleSidebar(force) {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const open    = force !== undefined ? force : !sidebar.classList.contains('open');
  sidebar.classList.toggle('open', open);
  overlay.classList.toggle('open', open);
}

function refreshData() {
  navigate(AppState.activePage);
  Notif.toast('Dados atualizados', 'success', { title: 'Atualizado', duration: 2000 });
}

/**
 * buildChamadosQuery — lógica CENTRALIZADA de visibilidade por cargo.
 * ERRO 1: sempre lê AppState.currentUser em tempo real (não usa cache antigo).
 * ERRO 2: regras corretas:
 *   - Administrador → todos os chamados
 *   - Supervisor    → chamados do SEU departamento (incluindo sem responsável)
 *   - Atendente / Funcionário → apenas chamados onde ele é responsavel_id
 */
function buildChamadosQuery(selectClause) {
  let query = db.from('chamados').select(selectClause);

  const u = AppState.currentUser;
  if (!u) return query;

  const cargo   = u.cargo;
  const deptoId = u.departamento_id;
  const userId  = u.id;

  if (cargo === 'Administrador') {
    // Vê tudo — sem filtro
    return query;
  }

  if (cargo === 'Supervisor') {
    // Vê todos do departamento dele (independente de responsável)
    if (deptoId) {
      query = query.eq('departamento_id', deptoId);
    }
    return query;
  }

  // Atendente e Funcionário: apenas os que lhes foram atribuídos
  query = query.eq('responsavel_id', userId);
  return query;
}

async function silentRefresh() {
  try {
    const { data, error } = await buildChamadosQuery('*, clientes(id, nome, email, empresa)')
      .order('data_abertura', { ascending: false });

    if (error) { console.error('silentRefresh erro:', error); return; }

    AppState.allChamados = data || [];

    if (AppState.activePage === 'dashboard') {
      await loadDashboard(true);
    } else if (AppState.activePage === 'chamados') {
      filterChamados();
    }

    // Atualiza badge de novos
    const novos = AppState.allChamados.filter(c => c.status === 'Novo').length;
    const badge = document.getElementById('badge-novos');
    if (badge) {
      badge.style.display = novos > 0 ? 'flex' : 'none';
      badge.textContent   = novos > 9 ? '9+' : String(novos);
    }
  } catch (e) {
    console.error('silentRefresh:', e);
  }
}
