/**
 * page-relatorios.js — Relatórios de desempenho e SLA
 * CORRIGIDO ERRO 1/2: usa buildChamadosQuery centralizado
 */

// Cache dos dados para exportação
let _relatorioCache = [];

async function loadRelatorios() {
  if (!can('page_relatorios')) return;

  // Mostra/oculta botões de exportação
  const btnPdf = document.getElementById('btn-export-relatorio');
  const btnCsv = document.getElementById('btn-export-relatorio-csv');
  const iconPdf = document.getElementById('export-rel-icon');
  const iconCsv = document.getElementById('export-rel-csv-icon');
  if (btnPdf) { btnPdf.style.display = can('export_data') ? 'inline-flex' : 'none'; }
  if (btnCsv) { btnCsv.style.display = can('export_data') ? 'inline-flex' : 'none'; }
  if (iconPdf) iconPdf.innerHTML = Icons.get('file', 14);
  if (iconCsv) iconCsv.innerHTML = Icons.get('download', 14);

  const el = document.getElementById('relatorios-content');
  if (el) el.innerHTML = `<div style="text-align:center;padding:40px"><span class="spinner"></span></div>`;

  try {
    const { data: ch, error } = await buildChamadosQuery('*, clientes(nome, empresa), prioridades(nome,sla_minutos)')
      .order('data_abertura', { ascending: false });

    if (error) throw error;
    _relatorioCache = ch || [];
    renderRelatorios(ch || []);
  } catch(e) {
    Notif.toast('Erro ao carregar relatórios: ' + e.message, 'error');
  }
}

function renderRelatorios(ch) {
  const el = document.getElementById('relatorios-content');
  if (!el) return;

  const now     = new Date();
  const total   = ch.length;
  const resolv  = ch.filter(c => c.status === 'Resolvido').length;
  const abertos = ch.filter(c => !['Resolvido','Cancelado'].includes(c.status)).length;

  const comSla      = ch.filter(c => c.data_vencimento_sla && c.status === 'Resolvido');
  const dentroPrazo = comSla.filter(c => new Date(c.data_abertura) <= new Date(c.data_vencimento_sla)).length;
  const slaRate     = comSla.length ? Math.round((dentroPrazo / comSla.length) * 100) : 0;

  const porPrio = [1,2,3,4].map(p => ({
    label:  PRIO_META[p].label,
    color:  PRIO_META[p].color,
    total:  ch.filter(c => c.prioridade_id === p).length,
    abertos:ch.filter(c => c.prioridade_id === p && !['Resolvido','Cancelado'].includes(c.status)).length,
  }));

  el.innerHTML = `
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

    <div class="charts-grid" style="margin-bottom:24px">
      <div class="chart-card">
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
        <div class="chart-header"><div class="chart-title">Abertura — Últimos 30 dias</div></div>
        <div class="chart-wrap"><canvas id="chart-relatorio-30d"></canvas></div>
      </div>
    </div>`;

  if (AppState.charts.rel30d) AppState.charts.rel30d.destroy();
  const days30 = [], cnt30 = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate()-i); d.setHours(0,0,0,0);
    const nx = new Date(d); nx.setDate(nx.getDate()+1);
    days30.push(d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}));
    cnt30.push(ch.filter(c => { const dt=new Date(c.data_abertura); return dt>=d&&dt<nx; }).length);
  }
  AppState.charts.rel30d = new Chart(
    document.getElementById('chart-relatorio-30d').getContext('2d'), {
      type: 'bar',
      data: { labels: days30,
        datasets: [{ data: cnt30, backgroundColor: '#5b8ef030', borderColor: '#5b8ef0', borderWidth: 1, borderRadius: 3 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color:'#8b92a8', font:{size:9}, maxTicksLimit: 10 }, grid: { color:'#ffffff07' } },
          y: { ticks: { color:'#8b92a8', font:{size:10} }, grid: { color:'#ffffff07' }, beginAtZero: true }
        }
      }
    }
  );
}

// ─── Exportação de Relatórios ─────────────────────────────────────────────────
const _DEPTOS_REL = ['', 'Financeiro', 'RH', 'TI', 'Suprimentos', 'Administrativo', 'Jurídico', 'Geral'];

function exportRelatorioCSV() {
  if (!can('export_data')) { Notif.toast('Sem permissão.', 'error'); return; }
  const ch = _relatorioCache;
  if (!ch.length) { Notif.toast('Nenhum dado para exportar.', 'warning'); return; }

  const cabecalho = ['Protocolo','Assunto','Cliente','Empresa','Status','Prioridade','Setor','Abertura','Venc. SLA','SLA Cumprido'];

  const linhas = ch.map(c => {
    const slaOk = c.data_vencimento_sla && c.status === 'Resolvido'
      ? (new Date(c.data_abertura) <= new Date(c.data_vencimento_sla) ? 'Sim' : 'Não')
      : '—';
    return [
      c.protocolo                      || '—',
      c.assunto                        || '—',
      c.clientes?.nome                 || '—',
      c.clientes?.empresa              || '—',
      c.status                         || '—',
      PRIO_META[c.prioridade_id]?.label || '—',
      _DEPTOS_REL[c.departamento_id]   || '—',
      formatDate(c.data_abertura),
      c.data_vencimento_sla ? formatDate(c.data_vencimento_sla) : '—',
      slaOk,
    ];
  });

  _downloadCSVRel([cabecalho, ...linhas], `relatorio_chamados_${_tsNowRel()}.csv`);
  Notif.toast(`Relatório com ${ch.length} chamados exportado.`, 'success');
}

function exportRelatorioPDF() {
  if (!can('export_data')) { Notif.toast('Sem permissão.', 'error'); return; }
  const ch = _relatorioCache;
  if (!ch.length) { Notif.toast('Nenhum dado para exportar.', 'warning'); return; }

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

  const porPrio = [1,2,3,4].map(p => ({
    label: PRIO_META[p].label,
    total: ch.filter(c => c.prioridade_id === p).length,
  }));

  // Últimos 10 chamados
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
  .metrics { display:flex; gap:12px; margin-bottom:24px; flex-wrap:wrap; }
  .metric { flex:1; min-width:100px; border:1px solid #e0e0e0; border-radius:8px; padding:12px 16px; }
  .metric .val { font-size:24px; font-weight:700; }
  .metric .lbl { font-size:10px; color:#666; margin-top:2px; }
  .blue { color:#5b8ef0; } .green { color:#34c77b; } .red { color:#f05b5b; } .yellow { color:#f0b429; }
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
  <div class="sub">
    Gerado em ${now.toLocaleString('pt-BR')} &nbsp;·&nbsp;
    Usuário: ${escHtml(usuario)} &nbsp;·&nbsp;
    Departamento: ${depto}
  </div>

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
    <tbody>
      ${porPrio.map(p => `<tr><td>${p.label}</td><td style="text-align:right;font-weight:600">${p.total}</td><td style="text-align:right">${total ? Math.round((p.total/total)*100) : 0}%</td></tr>`).join('')}
    </tbody>
  </table>

  <h2>Chamados Recentes (últimos ${recentes.length})</h2>
  <table>
    <thead><tr><th>Protocolo</th><th>Assunto</th><th>Empresa</th><th>Status</th><th>Prioridade</th><th>Abertura</th></tr></thead>
    <tbody>${linhasRecentes}</tbody>
  </table>

  <div class="footer">
    Chamados-ADM &nbsp;·&nbsp; Este documento foi gerado automaticamente pelo sistema.
  </div>
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

function _downloadCSVRel(rows, filename) {
  const bom  = '\uFEFF';
  const csv  = bom + rows.map(r =>
    r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')
  ).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function _tsNowRel() {
  return new Date().toISOString().slice(0,10);
}
