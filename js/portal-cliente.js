/**
 * portal-cliente.js — Portal do Cliente
 * Páginas: Meus Chamados, Abrir Chamado, Perfil, Configurações
 */

// ─── Estado global do cliente ─────────────────────────────────────────────────
const ClienteState = {
  currentCliente:   null,
  allChamados:      [],
  filteredChamados: [],
  currentPage:      1,
  pageSize:         parseInt(localStorage.getItem('cli_pagesize') || '10'),
  activeCliPage:    'meus-chamados',
};

// ─── Navegação ────────────────────────────────────────────────────────────────
const CLI_PAGES = {
  'meus-chamados': { title: 'Meus Chamados',  sub: 'Acompanhe seus chamados em aberto e resolvidos'  },
  'abrir-chamado': { title: 'Abrir Chamado',  sub: 'Envie uma nova solicitação para nossa equipe'     },
  'cli-perfil':    { title: 'Meu Perfil',     sub: 'Visualize e edite seus dados cadastrais'           },
  'cli-config':    { title: 'Configurações',  sub: 'Preferências de exibição do portal'               },
};

function navigateCliente(page) {
  const cfg = CLI_PAGES[page];
  if (!cfg) return;

  ClienteState.activeCliPage = page;

  // Ocultar todas as páginas do cliente
  document.querySelectorAll('[data-cli-page]').forEach(el => el.style.display = 'none');
  const pageEl = document.getElementById(`cli-page-${page}`);
  if (pageEl) pageEl.style.display = 'block';

  // Atualizar nav
  document.querySelectorAll('.cli-nav-item').forEach(n => n.classList.remove('active'));
  const navEl = document.getElementById(`cli-nav-${page}`);
  if (navEl) navEl.classList.add('active');

  // Atualizar títulos
  const titleEl = document.getElementById('cli-page-title');
  const subEl   = document.getElementById('cli-page-sub');
  if (titleEl) titleEl.textContent = cfg.title;
  if (subEl)   subEl.textContent   = cfg.sub;

  // Carregar conteúdo
  if (page === 'meus-chamados') loadClienteChamados();
  if (page === 'abrir-chamado') loadAbrirChamadoForm();
  if (page === 'cli-perfil')    loadClientePerfil();
  if (page === 'cli-config')    loadClienteConfig();

  // Fechar sidebar mobile
  if (window.innerWidth <= 768) toggleClienteSidebar(false);
}

function toggleClienteSidebar(force) {
  const sidebar = document.getElementById('cli-sidebar');
  const overlay = document.getElementById('cli-sidebar-overlay');
  if (!sidebar || !overlay) return;
  const open = force !== undefined ? force : !sidebar.classList.contains('open');
  sidebar.classList.toggle('open', open);
  overlay.classList.toggle('open', open);
}

function refreshClienteData() {
  navigateCliente(ClienteState.activeCliPage);
  Notif.toast('Dados atualizados', 'success', { title: 'Atualizado', duration: 2000 });
}

// ─── Página: Meus Chamados ────────────────────────────────────────────────────
async function loadClienteChamados(silent = false) {
  const c = ClienteState.currentCliente;
  if (!c) return;

  if (!silent) {
    const tbody = document.getElementById('cli-chamados-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="loading-cell"><span class="spinner"></span> Carregando...</td></tr>`;
    _renderClienteMetricsSkeleton();
  }

  try {
    // Buscar chamados do cliente sem JOIN problemático
    const { data: chamados, error } = await db
      .from('chamados')
      .select('id, protocolo, assunto, status, prioridade_id, data_abertura, responsavel_id, canal_id')
      .eq('cliente_id', c.id)
      .order('data_abertura', { ascending: false });

    if (error) throw error;

    const lista = chamados || [];

    // Buscar responsáveis em consulta separada
    const respIds = [...new Set(lista.map(ch => ch.responsavel_id).filter(Boolean))];
    let responsaveisMap = {};
    if (respIds.length) {
      const { data: resps } = await db
        .from('usuarios_adm')
        .select('id, nome')
        .in('id', respIds);
      (resps || []).forEach(r => { responsaveisMap[r.id] = r.nome; });
    }

    // Enriquecer chamados com nome do responsável
    ClienteState.allChamados = lista.map(ch => ({
      ...ch,
      responsavel_nome: ch.responsavel_id ? (responsaveisMap[ch.responsavel_id] || '—') : '—',
    }));

    _renderClienteMetrics(ClienteState.allChamados);
    _filterClienteChamados();
    _updateClienteBadge();

  } catch (e) {
    if (!silent) Notif.toast('Erro ao carregar chamados: ' + e.message, 'error');
  }
}

function _renderClienteMetricsSkeleton() {
  const g = document.getElementById('cli-metrics-grid');
  if (!g) return;
  g.innerHTML = Array(4).fill(`
    <div class="metric-card">
      <div class="skel" style="width:38px;height:38px;border-radius:9px;margin-bottom:14px"></div>
      <div class="skel" style="width:60px;height:28px;border-radius:6px"></div>
      <div class="skel" style="width:110px;height:11px;border-radius:4px;margin-top:8px"></div>
    </div>`).join('');
}

function _renderClienteMetrics(chamados) {
  const g = document.getElementById('cli-metrics-grid');
  if (!g) return;

  const total     = chamados.length;
  const abertos   = chamados.filter(c => !['Resolvido','Cancelado'].includes(c.status)).length;
  const resolvidos = chamados.filter(c => c.status === 'Resolvido').length;
  const pendentes  = chamados.filter(c => c.status === 'Pendente Cliente').length;

  g.innerHTML = `
    <div class="metric-card accent-blue">
      <div class="metric-icon-wrap blue">${Icons.get('ticket', 20)}</div>
      <div class="metric-val">${total}</div>
      <div class="metric-lbl">Total de Chamados</div>
    </div>
    <div class="metric-card accent-yellow">
      <div class="metric-icon-wrap" style="background:#f0b42920;color:#f0b429">${Icons.get('activity', 20)}</div>
      <div class="metric-val">${abertos}</div>
      <div class="metric-lbl">Em Aberto</div>
    </div>
    <div class="metric-card accent-green">
      <div class="metric-icon-wrap green">${Icons.get('checkCircle', 20)}</div>
      <div class="metric-val">${resolvidos}</div>
      <div class="metric-lbl">Resolvidos</div>
    </div>
    <div class="metric-card ${pendentes > 0 ? 'accent-red pulse-border' : 'accent-red'}">
      <div class="metric-icon-wrap red">${Icons.get('clock', 20)}</div>
      <div class="metric-val" style="color:${pendentes > 0 ? 'var(--red)' : 'inherit'}">${pendentes}</div>
      <div class="metric-lbl">Aguardando Você</div>
      <div class="metric-sub" style="color:${pendentes > 0 ? 'var(--orange)' : 'var(--text-muted)'}">
        ${pendentes > 0 ? 'Resposta necessária!' : 'Nenhuma pendência'}
      </div>
    </div>`;
}

function _updateClienteBadge() {
  const pendentes = ClienteState.allChamados.filter(c => c.status === 'Pendente Cliente').length;
  const badge = document.getElementById('cli-badge-pendentes');
  if (badge) {
    badge.style.display = pendentes > 0 ? 'flex' : 'none';
    badge.textContent   = pendentes > 9 ? '9+' : String(pendentes);
  }
}

function _filterClienteChamados() {
  const search = document.getElementById('cli-search-input')?.value.toLowerCase() || '';
  const status = document.getElementById('cli-filter-status')?.value || '';

  ClienteState.filteredChamados = ClienteState.allChamados.filter(c => {
    const matchSearch = !search ||
      (c.protocolo || '').toLowerCase().includes(search) ||
      (c.assunto   || '').toLowerCase().includes(search) ||
      (c.responsavel_nome || '').toLowerCase().includes(search);
    const matchStatus = !status || c.status === status;
    return matchSearch && matchStatus;
  });

  ClienteState.currentPage = 1;
  _renderClienteChamadosTable();
}

function _renderClienteChamadosTable() {
  const tbody = document.getElementById('cli-chamados-tbody');
  if (!tbody) return;

  if (!ClienteState.filteredChamados.length) {
    tbody.innerHTML = `
      <tr><td colspan="6">
        <div class="empty-state">
          ${Icons.get('search', 32)}
          <p>Nenhum chamado encontrado</p>
          <button class="btn btn-secondary btn-sm" onclick="limparFiltrosCliente()" style="margin-top:12px">
            ${Icons.get('x', 14)} Limpar filtros
          </button>
        </div>
      </td></tr>`;
    const infoEl = document.getElementById('cli-pagination-info');
    const btnsEl = document.getElementById('cli-pagination-btns');
    if (infoEl) infoEl.textContent = '0 chamados';
    if (btnsEl) btnsEl.innerHTML   = '';
    return;
  }

  const start    = (ClienteState.currentPage - 1) * ClienteState.pageSize;
  const pageData = ClienteState.filteredChamados.slice(start, start + ClienteState.pageSize);
  const total    = ClienteState.filteredChamados.length;
  const totPages = Math.ceil(total / ClienteState.pageSize);

  tbody.innerHTML = pageData.map(c => {
    const isPendente = c.status === 'Pendente Cliente';
    return `
      <tr class="row-hover ${isPendente ? 'cli-row-pendente' : ''}" onclick="openChamadoCliente('${c.id}')">
        <td>
          <span class="mono proto-cell" title="Clique para copiar"
            onclick="event.stopPropagation();copyToClipboard('${c.protocolo||''}')">
            ${Icons.get('copy', 11)} ${c.protocolo || '—'}
          </span>
        </td>
        <td>
          <div class="td-subject" title="${escHtml(c.assunto||'')}">
            ${escHtml(c.assunto || '—')}
            ${isPendente ? `<span class="cli-badge-pendente-inline">${Icons.get('clock', 10)} Aguardando você</span>` : ''}
          </div>
        </td>
        <td>${statusBadge(c.status)}</td>
        <td>${prioBadge(c.prioridade_id)}</td>
        <td class="td-date"><span title="${formatDate(c.data_abertura)}">${timeAgo(c.data_abertura)}</span></td>
        <td>
          <div style="font-size:12px;color:var(--text-secondary)">
            ${c.responsavel_nome !== '—'
              ? `<span style="display:flex;align-items:center;gap:4px">${Icons.get('user', 11)} ${escHtml(c.responsavel_nome)}</span>`
              : '<span style="color:var(--text-muted)">—</span>'}
          </div>
        </td>
      </tr>`;
  }).join('');

  _renderClientePagination(total, totPages, start);
}

function _renderClientePagination(total, totPages, start) {
  const cur = ClienteState.currentPage;
  const infoEl = document.getElementById('cli-pagination-info');
  const btnsEl = document.getElementById('cli-pagination-btns');
  if (infoEl) infoEl.textContent = `${start + 1}–${Math.min(start + ClienteState.pageSize, total)} de ${total}`;

  if (!btnsEl) return;
  let html = `
    <button class="page-btn" onclick="cliGoPage(1)" ${cur===1?'disabled':''} title="Primeira">${Icons.get('chevronsLeft',12)}</button>
    <button class="page-btn" onclick="cliGoPage(${cur-1})" ${cur===1?'disabled':''} title="Anterior">${Icons.get('chevronLeft',12)}</button>`;
  for (let p = 1; p <= totPages; p++) {
    if (totPages > 7 && Math.abs(p - cur) > 2 && p !== 1 && p !== totPages) {
      if (p === 2 || p === totPages - 1) html += `<button class="page-btn" disabled>…</button>`;
      continue;
    }
    html += `<button class="page-btn ${p===cur?'active':''}" onclick="cliGoPage(${p})">${p}</button>`;
  }
  html += `
    <button class="page-btn" onclick="cliGoPage(${cur+1})" ${cur===totPages?'disabled':''} title="Próxima">${Icons.get('chevronRight',12)}</button>
    <button class="page-btn" onclick="cliGoPage(${totPages})" ${cur===totPages?'disabled':''} title="Última">${Icons.get('chevronsRight',12)}</button>`;
  btnsEl.innerHTML = html;
}

function cliGoPage(p) {
  const tot = Math.ceil(ClienteState.filteredChamados.length / ClienteState.pageSize);
  if (p < 1 || p > tot) return;
  ClienteState.currentPage = p;
  _renderClienteChamadosTable();
  const pageEl = document.getElementById('cli-page-meus-chamados');
  if (pageEl) pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function limparFiltrosCliente() {
  const s = document.getElementById('cli-search-input');
  const f = document.getElementById('cli-filter-status');
  if (s) s.value = '';
  if (f) f.value = '';
  _filterClienteChamados();
}

// ─── Página: Abrir Chamado ────────────────────────────────────────────────────
function loadAbrirChamadoForm() {
  const el = document.getElementById('cli-page-abrir-chamado');
  if (!el) return;

  const optDeptos = DEPTOS.map(d => `<option>${d}</option>`).join('');

  el.innerHTML = `
    <div style="max-width:680px;margin:0 auto">
      <div class="table-card" style="padding:28px">
        <div style="font-size:15px;font-weight:700;margin-bottom:4px;display:flex;align-items:center;gap:8px">
          ${Icons.get('plus',18)} Nova Solicitação
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:22px;display:flex;align-items:center;gap:6px">
          ${Icons.get('activity',12)}
          A prioridade será definida automaticamente após o envio.
        </div>

        <div class="field" style="margin-bottom:16px">
          <label class="field-label">Assunto *</label>
          <div class="field-input-wrap">
            <span class="field-input-icon">${Icons.get('tag',14)}</span>
            <input type="text" id="cli-nc-assunto" placeholder="Descreva brevemente o problema">
          </div>
        </div>

        <div class="field" style="margin-bottom:16px">
          <label class="field-label">Descrição detalhada *</label>
          <textarea id="cli-nc-mensagem" style="
            width:100%;background:var(--bg-surface);border:1px solid var(--border-strong);
            border-radius:9px;padding:10px 14px;color:var(--text-primary);font-family:inherit;
            font-size:13px;outline:none;resize:vertical;min-height:120px;transition:border-color .2s"
            placeholder="Descreva o problema em detalhes..."
            onfocus="this.style.borderColor='var(--accent)'"
            onblur="this.style.borderColor='var(--border-strong)'"></textarea>
        </div>

        <div style="margin-bottom:20px">
          <div class="field" style="margin:0">
            <label class="field-label">Departamento</label>
            <select id="cli-nc-departamento" class="inp" style="width:100%">${optDeptos}</select>
          </div>
        </div>

        <div id="cli-nc-error" style="display:none;margin-bottom:14px;padding:10px 14px;
          background:#f05b5b12;border:1px solid #f05b5b30;border-radius:8px;
          font-size:13px;color:var(--red)"></div>

        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button class="btn btn-secondary btn-sm" onclick="limparFormChamadoCliente()">
            ${Icons.get('x',13)} Limpar
          </button>
          <button class="btn btn-primary btn-sm" id="cli-nc-btn-salvar" onclick="enviarChamadoCliente()">
            ${Icons.get('send',14)} Enviar Chamado
          </button>
        </div>
      </div>
    </div>`;
}

function limparFormChamadoCliente() {
  const ids = ['cli-nc-assunto','cli-nc-mensagem'];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const errEl = document.getElementById('cli-nc-error');
  if (errEl) errEl.style.display = 'none';
}

async function enviarChamadoCliente() {
  const cli      = ClienteState.currentCliente;
  const assunto  = document.getElementById('cli-nc-assunto')?.value.trim();
  const mensagem = document.getElementById('cli-nc-mensagem')?.value.trim();
  // ERRO 4: canal sempre fixo como 'Portal do Cliente' no portal do cliente
  const canal = 'Portal do Cliente';
  const depto = document.getElementById('cli-nc-departamento')?.value || 'Geral';
  const errEl    = document.getElementById('cli-nc-error');

  if (errEl) errEl.style.display = 'none';
  if (!assunto)  { if (errEl) { errEl.textContent = 'Assunto é obrigatório.';    errEl.style.display = 'block'; } return; }
  if (!mensagem) { if (errEl) { errEl.textContent = 'Descrição é obrigatória.';  errEl.style.display = 'block'; } return; }

  const btn = document.getElementById('cli-nc-btn-salvar');
  const orig = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner-sm"></span> Enviando...`; }

  try {
    const payload = {
      assunto,
      mensagem,
      cliente: {
        nome:     cli.nome     || '',
        email:    cli.email    || '',
        telefone: cli.telefone || '',
        empresa:  cli.empresa  || '',
      },
      canal,
      departamento:   depto,
      responsavel_id: null,
      origem:         'portal_cliente',
    };

    // ERRO 9: usar /webhook/ (produção) em vez de /webhook-test/
    // /webhook-test/ só funciona enquanto o workflow está aberto no editor do n8n
    const N8N_WEBHOOK_URL = 'http://localhost:5678/webhook/chamados';
    const response = await fetch(N8N_WEBHOOK_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    if (!response.ok) {
      const txt = await response.text().catch(() => '');
      throw new Error(`Erro ao enviar: ${response.status}${txt ? ' — ' + txt : ''}`);
    }

    const result = await response.json();
    if (!result.success) throw new Error(result.mensagem || 'O servidor retornou falha.');

    Notif.toast(`Chamado #${result.protocolo} criado! Entraremos em contato em breve.`, 'success', { title: 'Chamado enviado!', duration: 6000 });
    limparFormChamadoCliente();

    // Redirecionar para lista de chamados
    setTimeout(() => navigateCliente('meus-chamados'), 1000);

  } catch (e) {
    if (errEl) { errEl.innerHTML = `${Icons.get('alert',13)} ${e.message}`; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = orig || `${Icons.get('send',14)} Enviar Chamado`; }
  }
}

// ─── Página: Perfil do Cliente ────────────────────────────────────────────────
function loadClientePerfil() {
  const c  = ClienteState.currentCliente;
  const el = document.getElementById('cli-page-cli-perfil');
  if (!el || !c) return;

  el.innerHTML = `
    <div style="max-width:580px;margin:0 auto;display:flex;flex-direction:column;gap:20px">

      <!-- Avatar card -->
      <div class="table-card" style="padding:28px;display:flex;align-items:center;gap:20px">
        <div style="
          width:72px;height:72px;border-radius:50%;
          background:linear-gradient(135deg,var(--accent),#6a5ae8);
          display:flex;align-items:center;justify-content:center;
          font-size:28px;font-weight:700;color:white;flex-shrink:0;
          box-shadow:0 8px 24px #4f80e840">
          ${(c.nome || '?')[0].toUpperCase()}
        </div>
        <div>
          <div style="font-size:20px;font-weight:700">${escHtml(c.nome || '—')}</div>
          <div style="font-size:13px;color:var(--text-muted);margin-top:3px">${escHtml(c.email || '—')}</div>
          ${c.empresa ? `<div style="margin-top:6px;font-size:12px;background:var(--accent-glow);color:var(--accent);padding:2px 10px;border-radius:10px;display:inline-block">${Icons.get('tag',11)} ${escHtml(c.empresa)}</div>` : ''}
        </div>
      </div>

      <!-- Editar dados -->
      <div class="table-card" style="padding:24px">
        <div style="font-size:14px;font-weight:600;margin-bottom:18px;display:flex;align-items:center;gap:8px">
          ${Icons.get('edit',16)} Editar dados
        </div>
        <div class="field" style="margin-bottom:14px">
          <label class="field-label">Nome completo</label>
          <div class="field-input-wrap">
            <span class="field-input-icon">${Icons.get('user',14)}</span>
            <input type="text" id="cli-perfil-nome" value="${escHtml(c.nome||'')}" placeholder="Seu nome">
          </div>
        </div>
        <div class="field" style="margin-bottom:14px">
          <label class="field-label">Empresa</label>
          <div class="field-input-wrap">
            <span class="field-input-icon">${Icons.get('tag',14)}</span>
            <input type="text" id="cli-perfil-empresa" value="${escHtml(c.empresa||'')}" placeholder="Nome da empresa">
          </div>
        </div>
        <div class="field" style="margin-bottom:14px">
          <label class="field-label">Telefone</label>
          <div class="field-input-wrap">
            <span class="field-input-icon">${Icons.get('activity',14)}</span>
            <input type="text" id="cli-perfil-telefone" value="${escHtml(c.telefone||'')}" placeholder="(00) 00000-0000">
          </div>
        </div>
        <div class="field" style="margin-bottom:0">
          <label class="field-label">Departamento</label>
          <div class="field-input-wrap">
            <span class="field-input-icon">${Icons.get('users',14)}</span>
            <input type="text" id="cli-perfil-departamento" value="${escHtml(c.departamento||'')}" placeholder="Ex: TI, Financeiro">
          </div>
        </div>
        <div style="margin-top:16px;display:flex;justify-content:flex-end">
          <button class="btn btn-primary btn-sm" onclick="saveClientePerfil()">
            ${Icons.get('check',14)} Salvar alterações
          </button>
        </div>
      </div>

      <!-- Alterar senha -->
      <div class="table-card" style="padding:24px">
        <div style="font-size:14px;font-weight:600;margin-bottom:18px;display:flex;align-items:center;gap:8px">
          ${Icons.get('lock',16)} Alterar senha
        </div>
        <div class="field" style="margin-bottom:14px">
          <label class="field-label">Nova senha</label>
          <div class="field-input-wrap">
            <span class="field-input-icon">${Icons.get('lock',14)}</span>
            <input type="password" id="cli-perfil-nova-senha" placeholder="Mínimo 6 caracteres">
          </div>
        </div>
        <div class="field" style="margin-bottom:0">
          <label class="field-label">Confirmar nova senha</label>
          <div class="field-input-wrap">
            <span class="field-input-icon">${Icons.get('check',14)}</span>
            <input type="password" id="cli-perfil-confirma-senha" placeholder="Repita a senha">
          </div>
        </div>
        <div id="cli-perfil-senha-error" style="display:none;margin-top:10px;font-size:12px;color:var(--red)"></div>
        <div style="margin-top:16px;display:flex;justify-content:flex-end">
          <button class="btn btn-secondary btn-sm" onclick="saveClienteSenha()">
            ${Icons.get('key',14)} Atualizar senha
          </button>
        </div>
      </div>
    </div>`;
}

async function saveClientePerfil() {
  const c = ClienteState.currentCliente;
  if (!c) return;

  const nome        = document.getElementById('cli-perfil-nome')?.value.trim();
  const empresa     = document.getElementById('cli-perfil-empresa')?.value.trim();
  const telefone    = document.getElementById('cli-perfil-telefone')?.value.trim();
  const departamento= document.getElementById('cli-perfil-departamento')?.value.trim();

  if (!nome) { Notif.toast('Nome obrigatório.', 'warning'); return; }

  try {
    const { error } = await db.from('clientes')
      .update({ nome, empresa: empresa || null, telefone: telefone || null, departamento: departamento || null })
      .eq('id', c.id);
    if (error) throw error;

    ClienteState.currentCliente = { ...c, nome, empresa, telefone, departamento };
    updateClienteUI();
    loadClientePerfil();
    Notif.notify('Perfil atualizado.', 'success', { title: 'Perfil salvo' });
  } catch (e) {
    Notif.toast('Erro: ' + e.message, 'error');
  }
}

async function saveClienteSenha() {
  const nova     = document.getElementById('cli-perfil-nova-senha')?.value;
  const confirma = document.getElementById('cli-perfil-confirma-senha')?.value;
  const errEl    = document.getElementById('cli-perfil-senha-error');

  if (errEl) errEl.style.display = 'none';
  if (!nova || nova.length < 6) {
    if (errEl) { errEl.textContent = 'A senha deve ter pelo menos 6 caracteres.'; errEl.style.display = 'block'; }
    return;
  }
  if (nova !== confirma) {
    if (errEl) { errEl.textContent = 'As senhas não coincidem.'; errEl.style.display = 'block'; }
    return;
  }

  try {
    const { error } = await db.auth.updateUser({ password: nova });
    if (error) throw error;
    const n = document.getElementById('cli-perfil-nova-senha');
    const conf = document.getElementById('cli-perfil-confirma-senha');
    if (n) n.value = '';
    if (conf) conf.value = '';
    Notif.notify('Senha atualizada.', 'success', { title: 'Senha alterada' });
  } catch (e) {
    if (errEl) { errEl.textContent = e.message; errEl.style.display = 'block'; }
  }
}

// ─── Página: Configurações do Cliente ────────────────────────────────────────
function loadClienteConfig() {
  const el = document.getElementById('cli-page-cli-config');
  if (!el) return;

  const theme    = localStorage.getItem('pref_theme')    || 'dark';
  const pagesize = localStorage.getItem('cli_pagesize')  || '10';

  el.innerHTML = `
    <div style="max-width:560px;margin:0 auto;display:flex;flex-direction:column;gap:20px">

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
        <div class="cfg-section-title">${Icons.get('settings',16)} Exibição</div>
        <div class="cfg-row">
          <div>
            <div class="cfg-label">Chamados por página</div>
            <div class="cfg-sub">Quantidade exibida na listagem</div>
          </div>
          <select class="inp" onchange="applyClientePageSize(this.value)" style="width:100px">
            ${[5,10,20,50].map(n => `<option value="${n}" ${pagesize==n?'selected':''}>${n}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="table-card" style="padding:20px">
        <div class="cfg-section-title">${Icons.get('info',16)} Sobre o Portal</div>
        <div style="font-size:12px;color:var(--text-muted);line-height:1.8">
          <div>Portal do Cliente — Central de Chamados</div>
          <div style="margin-top:8px">Acompanhe o status dos seus chamados, envie novas solicitações e
          converse com nossa equipe de suporte diretamente por aqui.</div>
        </div>
      </div>
    </div>`;
}

function applyClientePageSize(val) {
  localStorage.setItem('cli_pagesize', val);
  ClienteState.pageSize = parseInt(val);
  Notif.toast(`Itens por página: ${val}`, 'success', { duration: 2000 });
}
