/**
 * page-dashboard.js — Dashboard com métricas e gráficos
 * CORRIGIDO ERRO 1/2: usa buildChamadosQuery centralizado
 */

async function loadDashboard(silent = false) {
  if (!silent) renderMetricsSkeleton();

  try {
    const { data: ch, error } = await buildChamadosQuery('*, clientes(nome, empresa)')
      .order('data_abertura', { ascending: false });

    if (error) throw error;

    const now   = new Date();
    const today = new Date(); today.setHours(0,0,0,0);

    const abertos   = ch.filter(c => !['Resolvido','Cancelado'].includes(c.status)).length;
    const hoje      = ch.filter(c => new Date(c.data_abertura) >= today).length;
    const atrasados = ch.filter(c => {
      if (['Resolvido','Cancelado'].includes(c.status)) return false;
      if (!c.data_vencimento_sla) return false;
      return new Date(c.data_vencimento_sla) < now;
    }).length;
    const criticos  = ch.filter(c => c.prioridade_id === 4 && !['Resolvido','Cancelado'].includes(c.status)).length;

    renderMetrics({ abertos, hoje, atrasados, criticos });
    renderCharts(ch);
    renderRecentTable(ch.slice(0, 8));

    const novos = ch.filter(c => c.status === 'Novo').length;
    const badge = document.getElementById('badge-novos');
    if (badge) {
      badge.style.display = novos > 0 ? 'flex' : 'none';
      badge.textContent   = novos > 9 ? '9+' : String(novos);
    }

    AppState.allChamados = ch;

    if (!silent && criticos > 0) {
      Notif.push(`${criticos} chamado(s) com prioridade Crítica em aberto.`, 'warning',
        { title: 'Atenção — Chamados Críticos' });
    }
  } catch (e) {
    if (!silent) Notif.toast('Erro ao carregar dashboard: ' + e.message, 'error');
  }
}

function renderMetricsSkeleton() {
  const g = document.getElementById('metrics-grid');
  if (!g) return;
  g.innerHTML = Array(4).fill(`
    <div class="metric-card">
      <div class="skel" style="width:38px;height:38px;border-radius:9px;margin-bottom:14px"></div>
      <div class="skel" style="width:70px;height:30px;border-radius:6px"></div>
      <div class="skel" style="width:120px;height:12px;border-radius:4px;margin-top:8px"></div>
    </div>`).join('');
}

function renderMetrics({ abertos, hoje, atrasados, criticos }) {
  const g = document.getElementById('metrics-grid');
  if (!g) return;
  g.innerHTML = `
    <div class="metric-card accent-blue">
      <div class="metric-icon-wrap blue">${Icons.get('ticket', 20)}</div>
      <div class="metric-val">${abertos}</div>
      <div class="metric-lbl">Chamados Abertos</div>
      <div class="metric-sub">ativos no sistema</div>
    </div>
    <div class="metric-card accent-green">
      <div class="metric-icon-wrap green">${Icons.get('calendar', 20)}</div>
      <div class="metric-val">${hoje}</div>
      <div class="metric-lbl">Abertos Hoje</div>
      <div class="metric-sub">nas últimas 24h</div>
    </div>
    <div class="metric-card accent-red ${atrasados > 0 ? 'pulse-border' : ''}">
      <div class="metric-icon-wrap red">${Icons.get('clock', 20)}</div>
      <div class="metric-val" style="color:${atrasados>0?'var(--red)':'inherit'}">${atrasados}</div>
      <div class="metric-lbl">SLA Atrasados</div>
      <div class="metric-sub">requerem atenção</div>
    </div>
    <div class="metric-card accent-purple ${criticos > 0 ? 'pulse-border-purple' : ''}">
      <div class="metric-icon-wrap purple">${Icons.get('warning', 20)}</div>
      <div class="metric-val" style="color:${criticos>0?'var(--purple)':'inherit'}">${criticos}</div>
      <div class="metric-lbl">Críticos Abertos</div>
      <div class="metric-sub">prioridade máxima</div>
    </div>`;
}

// ─── Correção de distorção ao mudar zoom do browser ───────────────────────────
// O zoom altera window.devicePixelRatio; detectamos via matchMedia e recriamos
// os gráficos completamente (destroy + new Chart) para que o canvas seja
// reinicializado com as dimensões e DPR corretos.
let _dashZoomMql  = null;
let _dashDataCache = [];

function _watchDashZoom() {
  // Remove listener anterior se existir
  if (_dashZoomMql) {
    try { _dashZoomMql.removeEventListener('change', _onDashZoom); } catch (_) {}
  }
  // Cria media query que dispara quando devicePixelRatio mudar
  _dashZoomMql = window.matchMedia('(resolution: ' + window.devicePixelRatio + 'dppx)');
  _dashZoomMql.addEventListener('change', _onDashZoom);
}

function _onDashZoom() {
  // Destrói todos os charts do dashboard
  ['status', 'prioridade', 'tendencia'].forEach(k => {
    if (AppState.charts[k]) { AppState.charts[k].destroy(); AppState.charts[k] = null; }
  });
  // Recria com os dados em cache — sem nova chamada ao banco
  if (_dashDataCache.length) renderCharts(_dashDataCache);
}

function renderCharts(chamados) {
  // Guarda dados para poder recriar ao mudar zoom
  _dashDataCache = chamados;

  if (AppState.charts.status)     AppState.charts.status.destroy();
  if (AppState.charts.prioridade) AppState.charts.prioridade.destroy();
  if (AppState.charts.tendencia)  AppState.charts.tendencia.destroy();

  const chartDefaults = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#8b92a8', font: { family: 'DM Sans', size: 11 }, boxWidth: 10, padding: 12 } } },
  };

  const sCounts = {};
  chamados.forEach(c => { sCounts[c.status] = (sCounts[c.status]||0)+1; });
  const sLabels = Object.keys(sCounts);
  const sColors = sLabels.map(s => STATUS_META[s]?.color || '#4e546a');

  AppState.charts.status = new Chart(
    document.getElementById('chart-status').getContext('2d'), {
      type: 'doughnut',
      data: { labels: sLabels, datasets: [{ data: Object.values(sCounts), backgroundColor: sColors, borderWidth: 0, hoverOffset: 6 }] },
      options: { ...chartDefaults, cutout: '68%' }
    }
  );

  const pCounts  = { 1:0, 2:0, 3:0, 4:0 };
  chamados.forEach(c => { if (c.prioridade_id) pCounts[c.prioridade_id]++; });
  const pColors  = [PRIO_META[1].color, PRIO_META[2].color, PRIO_META[3].color, PRIO_META[4].color];
  const pBgAlpha = pColors.map(c => c + '30');

  AppState.charts.prioridade = new Chart(
    document.getElementById('chart-prioridade').getContext('2d'), {
      type: 'bar',
      data: { labels: ['Baixa','Média','Alta','Crítica'],
        datasets: [{ data: [pCounts[1],pCounts[2],pCounts[3],pCounts[4]], backgroundColor: pBgAlpha, borderColor: pColors, borderWidth: 2, borderRadius: 7 }] },
      options: {
        ...chartDefaults,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color:'#8b92a8', font:{family:'DM Sans',size:11} }, grid: { color:'#ffffff07' } },
          y: { ticks: { color:'#8b92a8', font:{family:'DM Sans',size:11} }, grid: { color:'#ffffff07' }, beginAtZero: true },
        }
      }
    }
  );

  const days = [], dayCounts = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate()-i); d.setHours(0,0,0,0);
    const next = new Date(d); next.setDate(next.getDate()+1);
    days.push(d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }));
    dayCounts.push(chamados.filter(c => { const dt = new Date(c.data_abertura); return dt >= d && dt < next; }).length);
  }

  AppState.charts.tendencia = new Chart(
    document.getElementById('chart-tendencia').getContext('2d'), {
      type: 'line',
      data: { labels: days, datasets: [{ label: 'Chamados abertos', data: dayCounts,
        borderColor: '#5b8ef0', backgroundColor: 'rgba(91,142,240,0.08)',
        fill: true, tension: 0.4, pointBackgroundColor: '#5b8ef0', pointRadius: 4, pointHoverRadius: 6 }] },
      options: {
        ...chartDefaults,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color:'#8b92a8', font:{family:'DM Sans',size:11} }, grid: { color:'#ffffff07' } },
          y: { ticks: { color:'#8b92a8', font:{family:'DM Sans',size:11} }, grid: { color:'#ffffff07' }, beginAtZero: true },
        }
      }
    }
  );

  // Registra watcher de zoom após criar os gráficos
  _watchDashZoom();
}

function renderRecentTable(chamados) {
  const tbody = document.getElementById('recent-tbody');
  if (!tbody) return;
  if (!chamados.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-cell">Nenhum chamado encontrado</td></tr>`;
    return;
  }
  tbody.innerHTML = chamados.map(c => {
    const empresa = c.clientes?.empresa || '—';
    const contato = c.clientes?.nome    || '';
    return `
      <tr class="row-hover" onclick="openChamado('${c.id}')">
        <td><span class="mono copy-proto" onclick="event.stopPropagation();copyToClipboard('${c.protocolo}')" title="Copiar protocolo">${c.protocolo||'—'}</span></td>
        <td class="td-subject">${escHtml(c.assunto)||'—'}</td>
        <td>
          <div style="font-size:12px;font-weight:600">${escHtml(empresa)}</div>
          ${contato ? `<div style="font-size:11px;color:var(--text-muted)">${escHtml(contato)}</div>` : ''}
        </td>
        <td>${prioBadge(c.prioridade_id)}</td>
        <td>${statusBadge(c.status)}</td>
        <td class="td-date">${timeAgo(c.data_abertura)}</td>
      </tr>`;
  }).join('');
}
