/**
 * nav.js — Navegação entre páginas, sidebar, topbar
 */

const PAGES = {
  dashboard:      { title: 'Dashboard',        sub: 'Visão geral do sistema',        perm: 'page_dashboard'     },
  chamados:       { title: 'Chamados',          sub: 'Gerenciar todos os chamados',   perm: 'page_chamados'      },
  'novo-chamado': { title: 'Novo Chamado',      sub: 'Abrir chamado em nome do cliente', perm: 'page_novo_chamado'},
  relatorios:     { title: 'Relatórios',        sub: 'Análise de desempenho e SLA',   perm: 'page_relatorios'    },
  usuarios:       { title: 'Usuários',          sub: 'Gerenciar equipe e permissões', perm: 'page_usuarios'      },
  perfil:         { title: 'Meu Perfil',        sub: 'Dados da sua conta',            perm: 'page_perfil'        },
  configuracoes:  { title: 'Configurações',     sub: 'Preferências do sistema',       perm: 'page_configuracoes' },
    supervisor:     { title: 'Minha Equipe',      sub: 'Visualizar equipe do departamento', perm: 'page_supervisor' },
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

async function silentRefresh() {
  console.log('🔄 SilentRefresh executando em:', new Date().toLocaleTimeString());
  
  try {
    let query = db.from('chamados').select('*, clientes(id, nome, email, empresa)');
    
    // 🔥 MESMA LÓGICA DE PERMISSÕES 🔥
    if (AppState.currentUser && AppState.currentUser.cargo !== 'Administrador') {
      const userDeptoId = AppState.currentUser.departamento_id;
      const userCargo = AppState.currentUser.cargo;
      const userId = AppState.currentUser.id;
      
      if (userCargo === 'Supervisor') {
        if (userDeptoId) {
          query = query.eq('departamento_id', userDeptoId);
        }
      } 
      else if (userCargo === 'Atendente') {
        query = query.eq('responsavel_id', userId);
      }
      else if (userCargo === 'Funcionário') {
        query = query.eq('responsavel_id', userId);
      }
    }
    
    const { data, error } = await query.order('data_abertura', { ascending: false });
    
    if (error) {
      console.error('Erro:', error);
      return;
    }
    
    const novosChamados = data || [];
    const totalAntes = AppState.allChamados ? AppState.allChamados.length : 0;
    const totalDepois = novosChamados.length;
    
    console.log(`📊 Chamados: ${totalAntes} -> ${totalDepois}`);
    
    // Atualiza os dados
    AppState.allChamados = novosChamados;
    
    // Atualiza a tela
    if (AppState.activePage === 'dashboard') {
      await loadDashboard(true);
    } else if (AppState.activePage === 'chamados') {
      filterChamados();
    }
    
    // Atualiza o badge
    const novosStatus = AppState.allChamados.filter(c => c.status === 'Novo').length;
    const badge = document.getElementById('badge-novos');
    if (badge) {
      badge.style.display = novosStatus > 0 ? 'flex' : 'none';
      badge.textContent = novosStatus > 9 ? '9+' : novosStatus;
    }
    
    console.log('✅ SilentRefresh concluído');
    
  } catch(e) {
    console.error('Erro:', e);
  }
}