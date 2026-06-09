/**
 * page-relatorios.js — Relatórios de desempenho e SLA
 */

// Cache completo (todos os chamados carregados do banco)
let _relatorioCache = [];

// Período ativo do filtro
let _relPeriodo = { inicio: null, fim: null };

// ─── Correção de distorção ao mudar zoom do browser ───────────────────────────
let _relZoomMql = null;

function _watchRelZoom() {
  if (_relZoomMql) {
    try { _relZoomMql.removeEventListener('change', _onRelZoom); } catch (_) {}
  }
  _relZoomMql = window.matchMedia('(resolution: ' + window.devicePixelRatio + 'dppx)');
  _relZoomMql.addEventListener('change', _onRelZoom);
}

function _onRelZoom() {
  if (AppState.charts.rel30d) { AppState.charts.rel30d.destroy(); AppState.charts.rel30d = null; }
  const ch = _relFiltrar(_relatorioCache);
  if (_relatorioCache.length) _renderRelBody(ch);
}

// ─── Helpers de período ───────────────────────────────────────────────────────

/** Retorna o primeiro e último dia do mês atual */
function _mesAtual() {
  const now = new Date();
  const ini = new Date(now.getFullYear(), now.getMonth(), 1);
  const fim = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { inicio: ini, fim };
}

/** Formata Date para valor de input[type=date]: YYYY-MM-DD */
function _toInputDate(d) {
  return d.toISOString().slice(0, 10);
}

/** Filtra o cache pelo período ativo */
function _relFiltrar(ch) {
  const { inicio, fim } = _relPeriodo;
  if (!inicio || !fim) return ch;
  return ch.filter(c => {
    const dt = new Date(c.data_abertura);
    return dt >= inicio && dt <= fim;
  });
}

/** Título legível do período atual */
function _relPeriodoLabel() {
  const { inicio, fim } = _relPeriodo;
  if (!inicio || !fim) return 'Todos os períodos';
  const opts = { day: '2-digit', month: '2-digit', year: 'numeric' };
  const i = inicio.toLocaleDateString('pt-BR', opts);
  const f = fim.toLocaleDateString('pt-BR', opts);
  // Se é mês cheio
  const iniMes = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  const fimMes = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0);
  if (inicio.getDate() === 1 && fim.getDate() === fimMes.getDate() &&
      inicio.getMonth() === fim.getMonth() && inicio.getFullYear() === fim.getFullYear()) {
    return inicio.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }
  return `${i} até ${f}`;
}

// ─── Carregamento principal ───────────────────────────────────────────────────

async function loadRelatorios() {
  if (!can('page_relatorios')) return;

  // Inicializa período como mês atual na primeira carga
  if (!_relPeriodo.inicio) {
    const p = _mesAtual();
    _relPeriodo = p;
  }

  _renderToolbar();

  const el = document.getElementById('relatorios-content');
  if (el) el.innerHTML = `<div style="text-align:center;padding:40px"><span class="spinner"></span></div>`;

  try {
    const { data: ch, error } = await buildChamadosQuery('*, clientes(nome, empresa), prioridades(nome,sla_minutos)')
      .order('data_abertura', { ascending: false });

    if (error) throw error;
    _relatorioCache = ch || [];
    _renderRelBody(_relFiltrar(_relatorioCache));
  } catch(e) {
    Notif.toast('Erro ao carregar relatórios: ' + e.message, 'error');
  }
}

// ─── Toolbar (título + filtro + exportação) ───────────────────────────────────

function _renderToolbar() {
  const toolbar = document.getElementById('relatorios-toolbar');
  if (!toolbar) return;

  const podeExportar = can('export_data');
  const iniVal = _relPeriodo.inicio ? _toInputDate(_relPeriodo.inicio) : '';
  const fimVal = _relPeriodo.fim    ? _toInputDate(_relPeriodo.fim)    : '';

  toolbar.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;padding:14px 16px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span style="font-size:13px;font-weight:600;color:var(--text-primary)">Relatórios</span>
        <span style="font-size:11px;color:var(--accent);background:var(--accent-glow);padding:2px 10px;border-radius:20px;border:1px solid var(--accent)" id="rel-periodo-badge">
          ${_relPeriodoLabel()}
        </span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <!-- Filtro de período -->
        <div style="display:flex;align-items:center;gap:6px">
          <input type="date" id="rel-data-ini" class="inp" style="width:140px;font-size:12px;padding:6px 10px" value="${iniVal}">
          <span style="font-size:11px;color:var(--text-muted)">até</span>
          <input type="date" id="rel-data-fim" class="inp" style="width:140px;font-size:12px;padding:6px 10px" value="${fimVal}">
          <button class="btn btn-primary btn-sm" onclick="_aplicarFiltroPeriodo()">
            <span id="rel-filter-icon"></span> Filtrar
          </button>
          <button class="btn btn-ghost btn-sm" onclick="_limparFiltroPeriodo()" title="Ver todos os períodos">
            <span id="rel-clear-icon"></span>
          </button>
        </div>
        <!-- Exportação -->
        ${podeExportar ? `
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="exportRelatorioPDF()">
            <span id="export-rel-icon"></span> Exportar PDF
          </button>
          <button class="btn btn-ghost btn-sm" onclick="exportRelatorioCSV()">
            <span id="export-rel-csv-icon"></span> Exportar CSV
          </button>
        </div>` : ''}
      </div>
    </div>`;

  // Ícones
  const si = (id, ic, sz) => { const el = document.getElementById(id); if (el) el.innerHTML = Icons.get(ic, sz||13); };
  si('rel-filter-icon',    'search',   13);
  si('rel-clear-icon',     'x',        13);
  si('export-rel-icon',    'file',     14);
  si('export-rel-csv-icon','download', 14);
}

// ─── Aplicar / limpar filtro ──────────────────────────────────────────────────

function _aplicarFiltroPeriodo() {
  const iniEl = document.getElementById('rel-data-ini');
  const fimEl = document.getElementById('rel-data-fim');

  if (!iniEl?.value || !fimEl?.value) {
    Notif.toast('Preencha as duas datas para filtrar.', 'warning'); return;
  }
  const ini = new Date(iniEl.value + 'T00:00:00');
  const fim = new Date(fimEl.value + 'T23:59:59');
  if (ini > fim) {
    Notif.toast('A data inicial deve ser anterior à data final.', 'warning'); return;
  }

  _relPeriodo = { inicio: ini, fim };
  const badge = document.getElementById('rel-periodo-badge');
  if (badge) badge.textContent = _relPeriodoLabel();

  _renderRelBody(_relFiltrar(_relatorioCache));
}

function _limparFiltroPeriodo() {
  _relPeriodo = { inicio: null, fim: null };
  // Limpa inputs
  const iniEl = document.getElementById('rel-data-ini');
  const fimEl = document.getElementById('rel-data-fim');
  if (iniEl) iniEl.value = '';
  if (fimEl) fimEl.value = '';
  const badge = document.getElementById('rel-periodo-badge');
  if (badge) badge.textContent = _relPeriodoLabel();
  _renderRelBody(_relatorioCache);
}

// ─── Corpo do relatório ───────────────────────────────────────────────────────

function renderRelatorios(ch) {
  // Chamado na carga inicial — usa período já definido
  _renderRelBody(ch);
}

function _renderRelBody(ch) {
  const el = document.getElementById('relatorios-content');
  if (!el) return;

  const total   = ch.length;
  const resolv  = ch.filter(c => c.status === 'Resolvido').length;
  const abertos = ch.filter(c => !['Resolvido','Cancelado'].includes(c.status)).length;

  const comSla      = ch.filter(c => c.data_vencimento_sla && c.status === 'Resolvido');
  const dentroPrazo = comSla.filter(c => new Date(c.data_abertura) <= new Date(c.data_vencimento_sla)).length;
  const slaRate     = comSla.length ? Math.round((dentroPrazo / comSla.length) * 100) : 0;

  const porPrio = [1,2,3,4].map(p => ({
    label:   PRIO_META[p].label,
    color:   PRIO_META[p].color,
    total:   ch.filter(c => c.prioridade_id === p).length,
    abertos: ch.filter(c => c.prioridade_id === p && !['Resolvido','Cancelado'].includes(c.status)).length,
  }));

  // Constrói eixo de dias do período filtrado (ou mês atual se sem filtro)
  let diasLabels = [], diasCounts = [];
  const { inicio, fim } = _relPeriodo;

  if (inicio && fim) {
    // Itera cada dia do período
    const cursor = new Date(inicio); cursor.setHours(0,0,0,0);
    const end    = new Date(fim);    end.setHours(23,59,59,999);
    while (cursor <= end) {
      const next = new Date(cursor); next.setDate(next.getDate() + 1);
      diasLabels.push(cursor.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }));
      diasCounts.push(ch.filter(c => { const dt = new Date(c.data_abertura); return dt >= cursor && dt < next; }).length);
      cursor.setDate(cursor.getDate() + 1);
    }
  } else {
    // Sem filtro: últimos 30 dias
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate()-i); d.setHours(0,0,0,0);
      const nx = new Date(d); nx.setDate(nx.getDate()+1);
      diasLabels.push(d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}));
      diasCounts.push(ch.filter(c => { const dt=new Date(c.data_abertura); return dt>=d&&dt<nx; }).length);
    }
  }

  // Título do gráfico
  const chartTitle = inicio && fim ? `Abertura — ${_relPeriodoLabel()}` : 'Abertura — Últimos 30 dias';

  // Aviso se sem dados
  const semDados = total === 0
    ? `<div style="text-align:center;padding:32px 0;color:var(--text-muted);font-size:13px">
         ${Icons.get('info',16)} Nenhum chamado encontrado para o período selecionado.
       </div>`
    : '';

  el.innerHTML = `
    ${semDados}
    <div class="metrics-grid" style="margin-bottom:24px">
      <div class="metric-card accent-blue">
        <div class="metric-icon-wrap blue">${Icons.get('ticket',20)}</div>
        <div class="metric-val">${total}</div>
        <div class="metric-lbl">Total de Chamados</div>
      </div>
      <div class="metric-card accent-green">
        <div class="metric-icon-wrap green">${Icons.get('checkCircle',20)}</div>
        <div class="metric-val">${resolv}</div>
        <div class="metric-lbl">Resolvidos</div>
        <div class="metric-sub">${total ? Math.round((resolv/total)*100) : 0}% do total</div>
      </div>
      <div class="metric-card accent-red">
        <div class="metric-icon-wrap red">${Icons.get('activity',20)}</div>
        <div class="metric-val">${abertos}</div>
        <div class="metric-lbl">Em Aberto</div>
      </div>
      <div class="metric-card accent-yellow">
        <div class="metric-icon-wrap yellow">${Icons.get('barChart',20)}</div>
        <div class="metric-val">${slaRate}%</div>
        <div class="metric-lbl">Conformidade SLA</div>
        <div class="metric-sub">${comSla.length} chamados com SLA</div>
      </div>
    </div>

    <div class="charts-grid" style="margin-bottom:24px;grid-template-columns:auto 1fr">
      <div class="chart-card" style="min-width:220px">
        <div class="chart-header"><div class="chart-title">Distribuição por Prioridade</div></div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:8px">
          ${porPrio.map(p => `
            <div>
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
                <span style="color:${p.color};font-weight:600">${p.label}</span>
                <span style="color:var(--text-muted)">${p.total} total · ${p.abertos} abertos</span>
              </div>
              <div style="height:6px;background:var(--border-strong);border-radius:3px;overflow:hidden">
                <div style="height:100%;width:${total ? (p.total/total)*100 : 0}%;background:${p.color};border-radius:3px;transition:width .6s"></div>
              </div>
            </div>`).join('')}
        </div>
      </div>
      <div class="chart-card">
        <div class="chart-header"><div class="chart-title">${chartTitle}</div></div>
        <div class="chart-wrap"><canvas id="chart-relatorio-30d"></canvas></div>
      </div>
    </div>`;

  if (AppState.charts.rel30d) AppState.charts.rel30d.destroy();

  // Limita ticks no eixo X se o período for grande
  const maxTicks = diasLabels.length > 15 ? 10 : diasLabels.length;

  AppState.charts.rel30d = new Chart(
    document.getElementById('chart-relatorio-30d').getContext('2d'), {
      type: 'bar',
      data: {
        labels: diasLabels,
        datasets: [{ data: diasCounts, backgroundColor: '#5b8ef030', borderColor: '#5b8ef0', borderWidth: 1, borderRadius: 3 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color:'#8b92a8', font:{size:9}, maxTicksLimit: maxTicks }, grid: { color:'#ffffff07' } },
          y: { ticks: { color:'#8b92a8', font:{size:10} }, grid: { color:'#ffffff07' }, beginAtZero: true }
        }
      }
    }
  );

  _watchRelZoom();
}

// ─── Exportação ───────────────────────────────────────────────────────────────
const _DEPTOS_REL = ['', 'Financeiro', 'RH', 'TI', 'Suprimentos', 'Administrativo', 'Jurídico', 'Geral'];

function exportRelatorioCSV() {
  if (!can('export_data')) { Notif.toast('Sem permissão.', 'error'); return; }
  const ch = _relFiltrar(_relatorioCache);
  if (!ch.length) { Notif.toast('Nenhum dado para exportar no período.', 'warning'); return; }

  const cabecalho = ['Protocolo','Assunto','Cliente','Empresa','Status','Prioridade','Setor','Abertura','Venc. SLA','SLA Cumprido'];
  const linhas = ch.map(c => {
    const slaOk = c.data_vencimento_sla && c.status === 'Resolvido'
      ? (new Date(c.data_abertura) <= new Date(c.data_vencimento_sla) ? 'Sim' : 'Não') : '—';
    return [
      c.protocolo || '—', c.assunto || '—',
      c.clientes?.nome || '—', c.clientes?.empresa || '—',
      c.status || '—', PRIO_META[c.prioridade_id]?.label || '—',
      _DEPTOS_REL[c.departamento_id] || '—',
      formatDate(c.data_abertura),
      c.data_vencimento_sla ? formatDate(c.data_vencimento_sla) : '—',
      slaOk,
    ];
  });

  _downloadCSVRel([cabecalho, ...linhas], `relatorio_${_tsNowRel()}.csv`);
  Notif.toast(`${ch.length} chamados exportados (${_relPeriodoLabel()}).`, 'success');
}

function exportRelatorioPDF() {
  if (!can('export_data')) { Notif.toast('Sem permissão.', 'error'); return; }
  const ch = _relFiltrar(_relatorioCache);
  if (!ch.length) { Notif.toast('Nenhum dado para exportar no período.', 'warning'); return; }

  const now     = new Date();
  const total   = ch.length;
  const resolv  = ch.filter(c => c.status === 'Resolvido').length;
  const abertos = ch.filter(c => !['Resolvido','Cancelado'].includes(c.status)).length;
  const cancel  = ch.filter(c => c.status === 'Cancelado').length;
  const comSla  = ch.filter(c => c.data_vencimento_sla && c.status === 'Resolvido');
  const dentro  = comSla.filter(c => new Date(c.data_abertura) <= new Date(c.data_vencimento_sla)).length;
  const slaRate = comSla.length ? Math.round((dentro / comSla.length) * 100) : 0;
  const usuario = AppState.currentUser?.nome || '—';
  const depto   = _DEPTOS_REL[AppState.currentUser?.departamento_id] || 'Todos';

  const porStatus = {};
  ch.forEach(c => { porStatus[c.status] = (porStatus[c.status] || 0) + 1; });
  const porPrio = [1,2,3,4].map(p => ({ label: PRIO_META[p].label, total: ch.filter(c => c.prioridade_id === p).length }));
  const recentes = ch.slice(0, 10);

  const linhasRecentes = recentes.map(c => `
    <tr>
      <td>${c.protocolo || '—'}</td>
      <td>${escHtml(c.assunto?.substring(0,40) || '—')}</td>
      <td>${escHtml(c.clientes?.empresa || '—')}</td>
      <td>${c.status || '—'}</td>
      <td>${PRIO_META[c.prioridade_id]?.label || '—'}</td>
      <td>${formatDate(c.data_abertura)}</td>
    </tr>`).join('');

  const linhasStatus = Object.entries(porStatus).map(([s, n]) =>
    `<tr><td>${s}</td><td style="text-align:right;font-weight:600">${n}</td><td style="text-align:right">${total ? Math.round((n/total)*100) : 0}%</td></tr>`
  ).join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório de Chamados</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size:12px; color:#1a1d2e; padding:32px; }
  h1 { font-size:20px; font-weight:700; margin-bottom:4px; }
  .sub { color:#666; font-size:11px; margin-bottom:24px; }
  .periodo { display:inline-block; background:#eef2ff; color:#4f6ef7; border-radius:12px; padding:2px 12px; font-size:11px; font-weight:600; margin-bottom:20px; }
  .metrics { display:flex; gap:12px; margin-bottom:24px; flex-wrap:wrap; }
  .metric { flex:1; min-width:100px; border:1px solid #e0e0e0; border-radius:8px; padding:12px 16px; }
  .metric .val { font-size:24px; font-weight:700; }
  .metric .lbl { font-size:10px; color:#666; margin-top:2px; }
  .blue{color:#5b8ef0}.green{color:#34c77b}.red{color:#f05b5b}.yellow{color:#f0b429}
  h2 { font-size:13px; font-weight:600; margin:20px 0 8px; border-bottom:1px solid #e0e0e0; padding-bottom:6px; }
  table { width:100%; border-collapse:collapse; font-size:11px; }
  th { background:#f5f5f8; text-align:left; padding:6px 8px; font-weight:600; }
  td { padding:5px 8px; border-bottom:1px solid #f0f0f0; }
  .footer { margin-top:32px; font-size:10px; color:#999; border-top:1px solid #eee; padding-top:12px; }
  @media print { body { padding:16px; } }
</style>
</head>
<body>
  <h1>Relatório de Chamados</h1>
  <div class="sub">Gerado em ${now.toLocaleString('pt-BR')} &nbsp;·&nbsp; Usuário: ${escHtml(usuario)} &nbsp;·&nbsp; Departamento: ${depto}</div>
  <div class="periodo">Período: ${_relPeriodoLabel()}</div>

  <div class="metrics">
    <div class="metric"><div class="val blue">${total}</div><div class="lbl">Total</div></div>
    <div class="metric"><div class="val green">${resolv}</div><div class="lbl">Resolvidos (${total ? Math.round((resolv/total)*100) : 0}%)</div></div>
    <div class="metric"><div class="val red">${abertos}</div><div class="lbl">Em Aberto</div></div>
    <div class="metric"><div class="val">${cancel}</div><div class="lbl">Cancelados</div></div>
    <div class="metric"><div class="val yellow">${slaRate}%</div><div class="lbl">Conformidade SLA</div></div>
  </div>

  <h2>Distribuição por Status</h2>
  <table>
    <thead><tr><th>Status</th><th style="text-align:right">Qtd</th><th style="text-align:right">%</th></tr></thead>
    <tbody>${linhasStatus}</tbody>
  </table>

  <h2>Distribuição por Prioridade</h2>
  <table>
    <thead><tr><th>Prioridade</th><th style="text-align:right">Qtd</th><th style="text-align:right">%</th></tr></thead>
    <tbody>${porPrio.map(p => `<tr><td>${p.label}</td><td style="text-align:right;font-weight:600">${p.total}</td><td style="text-align:right">${total ? Math.round((p.total/total)*100) : 0}%</td></tr>`).join('')}</tbody>
  </table>

  <h2>Chamados (primeiros ${recentes.length})</h2>
  <table>
    <thead><tr><th>Protocolo</th><th>Assunto</th><th>Empresa</th><th>Status</th><th>Prioridade</th><th>Abertura</th></tr></thead>
    <tbody>${linhasRecentes}</tbody>
  </table>

  <div class="footer">Chamados-ADM &nbsp;·&nbsp; Este documento foi gerado automaticamente pelo sistema.</div>
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

function _downloadCSVRel(rows, filename) {
  const bom = '\uFEFF';
  const csv = bom + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}`).join(';')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function _tsNowRel() {
  return new Date().toISOString().slice(0, 10);
}
