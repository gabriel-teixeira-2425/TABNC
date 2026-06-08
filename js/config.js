/**
 * config.js — Configurações globais, Supabase, permissões por cargo
 */

// ─── Supabase ────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://hwyzqacspefbhllfwito.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3eXpxYWNzcGVmYmhsbGZ3aXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMTYwMzEsImV4cCI6MjA5NTg5MjAzMX0.KWpvN3fTawJ8nDe7RulmY6nX1-5pvOaQbCrz_LN_xSE';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Roles ────────────────────────────────────────────────────────────────────
const ROLE_LEVELS = {
  'Funcionário':   1,
  'Atendente':     2,
  'Supervisor':    3,
  'Administrador': 4,
};

// ─── Permissões ───────────────────────────────────────────────────────────────
const PERMISSIONS = {
  // Páginas
  page_dashboard:      1,
  page_chamados:       1,
  page_novo_chamado:   1,
  page_perfil:         1,
  page_configuracoes:  1,
  page_relatorios:     2,   // Atendente+
  page_usuarios:       4,   // só Administrador
  page_supervisor:     3,   // só Supervisor

  // Chamados
  chamado_view:            1,
  chamado_reply:           1,
  // ERRO 3: Funcionário (nível 1) precisa alterar status para resolver chamados
  chamado_status_change:   1,
  chamado_priority_change: 3,
  // ERRO 2: só Supervisor (nível 3) pode reatribuir responsável
  chamado_assign:          3,
  chamado_delete:          4,

  // Usuários
  user_view:          4,
  user_create:        4,
  user_edit:          4,
  user_toggle_active: 4,
  user_delete:        4,
};

function can(action) {
  if (!AppState.currentUser) return false;
  const cargo   = AppState.currentUser.cargo || 'Funcionário';
  const myLevel = ROLE_LEVELS[cargo] ?? 1;
  const needed  = PERMISSIONS[action] ?? 99;
  return myLevel >= needed;
}

// ─── Estado global ────────────────────────────────────────────────────────────
const AppState = {
  currentUser:      null,
  allChamados:      [],
  filteredChamados: [],
  currentChamado:   null,
  currentPage:      1,
  pageSize:         parseInt(localStorage.getItem('pref_pagesize') || '15'),
  sortField:        'data_abertura',
  sortAsc:          false,
  activePage:       'dashboard',
  charts:           {},
  notifications:    [],
  notifUnread:      0,
};

// ─── Constantes de domínio ────────────────────────────────────────────────────
const STATUS_LIST = ['Novo','Em Análise','Em Atendimento','Pendente Cliente','Resolvido','Cancelado'];

const STATUS_META = {
  'Novo':             { cls: 'badge-novo',        color: '#5b8ef0', icon: 'plus'       },
  'Em Análise':       { cls: 'badge-analise',     color: '#9b5bf0', icon: 'eye'        },
  'Em Atendimento':   { cls: 'badge-atendimento', color: '#f0b429', icon: 'activity'   },
  'Pendente Cliente': { cls: 'badge-pendente',    color: '#f07a29', icon: 'clock'      },
  'Resolvido':        { cls: 'badge-resolvido',   color: '#34c77b', icon: 'checkCircle'},
  'Cancelado':        { cls: 'badge-cancelado',   color: '#4e546a', icon: 'xCircle'    },
};

const PRIO_META = {
  1: { label: 'Baixa',   color: '#34c77b', cls: 'prio-1', dotColor: '#34c77b' },
  2: { label: 'Média',   color: '#f0b429', cls: 'prio-2', dotColor: '#f0b429' },
  3: { label: 'Alta',    color: '#f07a29', cls: 'prio-3', dotColor: '#f07a29' },
  4: { label: 'Crítica', color: '#f05b5b', cls: 'prio-4', dotColor: '#f05b5b' },
};

// ERRO 4: adicionado 'Portal do Cliente' para o formulário do funcionário
const CANAIS = ['WhatsApp','Email','Teams','Telefone','Portal do Cliente'];
const DEPTOS = ['Financeiro','RH','TI','Suprimentos','Administrativo','Jurídico','Geral'];
