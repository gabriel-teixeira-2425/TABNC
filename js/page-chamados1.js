/**
 * page-chamados.js — Listagem, filtros, ordenação e paginação de chamados
 * CORRIGIDO ERRO 1/2: usa buildChamadosQuery centralizado
 */
// Mapeamento de canal_id para nome
function getCanalNome(canalId) {
  const canais = {
    1: 'WhatsApp',
    2: 'Email',
    3: 'Teams',
    4: 'Telefone',
    5: 'Portal do Cliente',
    6: 'Presencial'
  };
  return canais[canalId] || '—';
}
async function loadChamados(silent = false) {
  if (!silent) {
    const tbody = document.getElementById('chamados-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="loading-cell"><span class="spinner"></span> Carregando...</td></tr>`;
    _initExportBtn();
  }

  try {
    const { data, error } = await buildChamadosQuery('*, clientes(id, nome, email, empresa)')
      .order('data_abertura', { ascending: false });

    if (error) throw error;

    AppState.allChamados = data || [];
    filterChamados();
  } catch (e) {
    if (!silent) Notif.toast('Erro ao carregar chamados: ' + e.message, 'error');
  }
}

function filterChamados() {
  const search = document.getElementById('search-input')?.value.toLowerCase()  || '';
  const status = document.getElementById('filter-status')?.value               || '';
  const prioId = document.getElementById('filter-prioridade')?.value           || '';

  AppState.filteredChamados = AppState.allChamados.filter(c => {
    const matchSearch = !search ||
      (c.protocolo         || '').toLowerCase().includes(search) ||
      (c.assunto           || '').toLowerCase().includes(search) ||
      (c.clientes?.nome    || '').toLowerCase().includes(search) ||
      (c.clientes?.empresa || '').toLowerCase().includes(search);
    const matchStatus = !status || c.status === status;
    const matchPrio   = !prioId || String(c.prioridade_id) === prioId;
    return matchSearch && matchStatus && matchPrio;
  });

  const { sortField, sortAsc } = AppState;
  AppState.filteredChamados.sort((a, b) => {
    let va = sortField === 'empresa' ? (a.clientes?.empresa || '') : a[sortField];
    let vb = sortField === 'empresa' ? (b.clientes?.empresa || '') : b[sortField];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    va = va ?? '';
    vb = vb ?? '';
    if (va < vb) return sortAsc ? -1 : 1;
    if (va > vb) return sortAsc ?  1 : -1;
    return 0;
  });

  AppState.currentPage = 1;
  renderChamadosTable();
  renderFilterSummary();
}

function sortBy(field) {
  if (AppState.sortField === field) AppState.sortAsc = !AppState.sortAsc;
  else { AppState.sortField = field; AppState.sortAsc = true; }

  document.querySelectorAll('th[data-sort]').forEach(th => {
    const ico = th.querySelector('.sort-icon');
    if (!ico) return;
    ico.innerHTML = th.dataset.sort === field
      ? Icons.get(AppState.sortAsc ? 'sortAsc' : 'sortDesc', 12)
      : Icons.get('sort', 12);
  });

  filterChamados();
}

function renderFilterSummary() {
  const total    = AppState.allChamados.length;
  const filtered = AppState.filteredChamados.length;
  const el = document.getElementById('filter-summary');
  if (!el) return;
  el.textContent     = filtered < total ? `${filtered} de ${total} chamados` : `${total} chamados`;
  el.style.display   = 'inline';
}

function clearFilters() {
  const s = document.getElementById('search-input');
  const f = document.getElementById('filter-status');
  const p = document.getElementById('filter-prioridade');
  if (s) s.value = '';
  if (f) f.value = '';
  if (p) p.value = '';
  filterChamados();
}

function renderChamadosTable() {
  const tbody = document.getElementById('chamados-tbody');
  if (!tbody) return;

  if (!AppState.filteredChamados.length) {
    tbody.innerHTML = `
      <tr><td colspan="9">
        <div class="empty-state">
          ${Icons.get('search', 32)}
          <p>Nenhum chamado encontrado</p>
          <button class="btn btn-secondary btn-sm" onclick="clearFilters()" style="margin-top:12px">
            ${Icons.get('x', 14)} Limpar filtros
          </button>
        </div>
      </td></tr>`;
    document.getElementById('pagination-info').textContent = '0 chamados';
    document.getElementById('pagination-btns').innerHTML   = '';
    return;
  }

  const start    = (AppState.currentPage - 1) * AppState.pageSize;
  const pageData = AppState.filteredChamados.slice(start, start + AppState.pageSize);
  const total    = AppState.filteredChamados.length;
  const totPages = Math.ceil(total / AppState.pageSize);

  tbody.innerHTML = pageData.map(c => {
    const sla = getSlaInfo(c);
    const slaHtml = ['Resolvido','Cancelado'].includes(c.status)
      ? `<span class="sla-done">${Icons.get('checkCircle', 12)} OK</span>`
      : sla.expired
        ? `<span class="sla-late">${Icons.get('alert', 12)} ${sla.label}</span>`
        : `<span class="sla-ok" style="color:${sla.color}">${Icons.get('clock', 12)} ${sla.label}</span>`;

    const empresa = c.clientes?.empresa || '—';
    const cliente = c.clientes?.nome    || '';

    return `
      <tr class="row-hover" onclick="openChamado('${c.id}')">
        <td>
          <span class="mono proto-cell" title="Clique para copiar"
            onclick="event.stopPropagation();copyToClipboard('${c.protocolo||''}')">
            ${Icons.get('copy', 11)} ${c.protocolo || '—'}
          </span>
        </td>
        <td><div class="td-subject" title="${escHtml(c.assunto||'')}">${escHtml(c.assunto || '—')}</div></td>
        <td>
          <div style="font-size:13px;font-weight:600;color:var(--text-primary)">${escHtml(empresa)}</div>
          ${cliente ? `<div class="td-client">${Icons.get('user', 11)} ${escHtml(cliente)}</div>` : ''}
        </td>
        <td>${prioBadge(c.prioridade_id)}</div></td>
        <td>${statusBadge(c.status)}</div></td>
        <td style="font-size:12px">${getCanalNome(c.canal_id)}</div> <!-- NOVA COLUNA CANAL -->
        <td class="td-date"><span title="${formatDate(c.data_abertura)}">${timeAgo(c.data_abertura)}</span></td>
        <td>
          <div class="sla-cell">
            ${slaHtml}
            ${sla.percent > 0 && !['Resolvido','Cancelado'].includes(c.status) ? `
              <div class="sla-bar-mini">
                <div class="sla-bar-fill" style="width:${sla.percent}%;background:${sla.color}"></div>
              </div>` : ''}
          </div>
        </td>
        <td onclick="event.stopPropagation()">
          <div class="row-actions">
            ${can('chamado_view') ? `<button class="icon-btn" title="Abrir" onclick="openChamado('${c.id}')">${Icons.get('eye', 14)}</button>` : ''}
            ${can('chamado_status_change') ? `<button class="icon-btn" title="Alterar status" onclick="quickStatus('${c.id}', event)">${Icons.get('edit', 14)}</button>` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');

  renderPagination(total, totPages, start);
}

function renderPagination(total, totPages, start) {
  const cur = AppState.currentPage;
  document.getElementById('pagination-info').textContent =
    `${start + 1}–${Math.min(start + AppState.pageSize, total)} de ${total}`;

  const btns = document.getElementById('pagination-btns');
  let html = `
    <button class="page-btn" onclick="goPage(1)" ${cur===1?'disabled':''} title="Primeira">${Icons.get('chevronsLeft',12)}</button>
    <button class="page-btn" onclick="goPage(${cur-1})" ${cur===1?'disabled':''} title="Anterior">${Icons.get('chevronLeft',12)}</button>`;

  for (let p = 1; p <= totPages; p++) {
    if (totPages > 7 && Math.abs(p - cur) > 2 && p !== 1 && p !== totPages) {
      if (p === 2 || p === totPages - 1) html += `<button class="page-btn" disabled>…</button>`;
      continue;
    }
    html += `<button class="page-btn ${p===cur?'active':''}" onclick="goPage(${p})">${p}</button>`;
  }

  html += `
    <button class="page-btn" onclick="goPage(${cur+1})" ${cur===totPages?'disabled':''} title="Próxima">${Icons.get('chevronRight',12)}</button>
    <button class="page-btn" onclick="goPage(${totPages})" ${cur===totPages?'disabled':''} title="Última">${Icons.get('chevronsRight',12)}</button>`;

  btns.innerHTML = html;
}

function goPage(p) {
  const tot = Math.ceil(AppState.filteredChamados.length / AppState.pageSize);
  if (p < 1 || p > tot) return;
  AppState.currentPage = p;
  renderChamadosTable();
  document.getElementById('page-chamados')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function quickStatus(id, event) {
  event.stopPropagation();
  const existing = document.getElementById('quick-status-pop');
  if (existing) existing.remove();

  const pop = document.createElement('div');
  pop.id = 'quick-status-pop';
  pop.className = 'quick-pop';
  pop.innerHTML = STATUS_LIST.map(s => `
    <div class="quick-pop-item" onclick="applyQuickStatus('${id}','${s}',this.closest('.quick-pop'))">
      ${statusBadge(s)}
    </div>`).join('');

  const rect = event.target.getBoundingClientRect();
  pop.style.top  = (rect.bottom + window.scrollY + 4) + 'px';
  pop.style.left = (rect.left  + window.scrollX - 100) + 'px';
  document.body.appendChild(pop);

  setTimeout(() => {
    document.addEventListener('click', () => pop.remove(), { once: true });
  }, 10);
}

async function applyQuickStatus(id, newStatus, pop) {
  pop?.remove();
  const ch = AppState.allChamados.find(c => c.id === id);
  if (!ch || ch.status === newStatus) return;

  try {
    const { error } = await db.from('chamados').update({ status: newStatus }).eq('id', id);
    if (error) throw error;
    await db.from('historico_status').insert({
      chamado_id: id, status_anterior: ch.status, status_novo: newStatus,
      alterado_por: AppState.currentUser?.id,
    });
    Notif.notify(`Status alterado para "${newStatus}"`, 'success', { title: 'Chamado atualizado', chamadoId: id });
    await loadChamados(true);
  } catch(e) {
    Notif.toast('Erro: ' + e.message, 'error');
  }
}

// ─── Exportação ───────────────────────────────────────────────────────────────
function _initExportBtn() {
  const btn = document.getElementById('btn-export-chamados');
  const iconEl = document.getElementById('export-chamados-icon');
  if (btn) btn.style.display = can('export_data') ? 'inline-flex' : 'none';
  if (iconEl) iconEl.innerHTML = Icons.get('download', 14);
}

function exportChamadosCSV() {
  if (!can('export_data')) { Notif.toast('Sem permissão para exportar.', 'error'); return; }

  const dados = AppState.filteredChamados;
  if (!dados.length) { Notif.toast('Nenhum chamado para exportar.', 'warning'); return; }

  const DEPTOS = ['', 'Financeiro', 'RH', 'TI', 'Suprimentos', 'Administrativo', 'Jurídico', 'Geral'];

  const cabecalho = ['Protocolo','Assunto','Cliente','Empresa','Status','Prioridade','Setor','Canal','Abertura','Venc. SLA','Responsável'];

  const linhas = dados.map(c => [
    c.protocolo       || '—',
    c.assunto         || '—',
    c.clientes?.nome  || '—',
    c.clientes?.empresa || '—',
    c.status          || '—',
    PRIO_META[c.prioridade_id]?.label || '—',
    DEPTOS[c.departamento_id]  || '—',
    c.canal           || '—',
    formatDate(c.data_abertura),
    c.data_vencimento_sla ? formatDate(c.data_vencimento_sla) : '—',
    c.responsavel_id  || '—',
  ]);

  _downloadCSV([cabecalho, ...linhas], `chamados_${_tsNow()}.csv`);
  Notif.toast(`${dados.length} chamados exportados.`, 'success');
}

function _downloadCSV(rows, filename) {
  const bom  = '\uFEFF'; // BOM para Excel reconhecer UTF-8
  const csv  = bom + rows.map(r =>
    r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')
  ).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function _tsNow() {
  return new Date().toISOString().slice(0,10);
}
