/**
 * page-relatorios.js — Relatórios de desempenho e SLA
 */

async function loadRelatorios() {
  if (!can('page_relatorios')) return;

  const el = document.getElementById('relatorios-content');
  if (el) el.innerHTML = `<div style="text-align:center;padding:40px"><span class="spinner"></span></div>`;

  try {
    let query = db.from('chamados').select('*, clientes(nome, empresa), prioridades(nome,sla_minutos)');
    
    // 🔥 NOVA LÓGICA DE PERMISSÕES POR CARGO 🔥
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
    
    const { data: ch, error } = await query.order('data_abertura', { ascending: false });

    if (error) throw error;
    renderRelatorios(ch || []);
  } catch(e) {
    Notif.toast('Erro ao carregar relatórios: ' + e.message, 'error');
  }
}

function renderRelatorios(ch) {
  const el = document.getElementById('relatorios-content');
  if (!el) return;

  const now = new Date();
  const total = ch.length;
  const resolv = ch.filter(c => c.status === 'Resolvido').length;
  const cancel = ch.filter(c => c.status === 'Cancelado').length;
  const abertos = ch.filter(c => !['Resolvido','Cancelado'].includes(c.status)).length;

  // Se não for admin, mostrar apenas do seu setor
  const isAdmin = AppState.currentUser?.cargo === 'Administrador';
  const setorNome = AppState.currentUser?.departamento_id ? 
    (['','Financeiro','RH','TI','Suprimentos','Administrativo','Jurídico','Geral'][AppState.currentUser.departamento_id] || 'Seu setor') : '';

  // Adicionar aviso no topo
  if (!isAdmin && setorNome) {
    const aviso = document.createElement('div');
    aviso.style.cssText = 'background:var(--accent-glow);border:1px solid var(--accent);border-radius:9px;padding:10px 14px;margin-bottom:16px;font-size:12px;display:flex;align-items:center;gap:8px';
    aviso.innerHTML = `${Icons.get('info',14)} Mostrando apenas chamados do setor <strong>${setorNome}</strong> (você só vê chamados do seu departamento).`;
    if (!el.querySelector('.filtro-aviso')) {
      const oldAviso = el.querySelector('.filtro-aviso');
      if (oldAviso) oldAviso.remove();
      aviso.className = 'filtro-aviso';
      el.insertBefore(aviso, el.firstChild);
    }
  }
  // ... resto do código (SLA compliance, porPrio, etc.)

  // SLA compliance
  const comSla    = ch.filter(c => c.data_vencimento_sla && ['Resolvido'].includes(c.status));
  const dentroPrazo = comSla.filter(c => new Date(c.data_abertura) <= new Date(c.data_vencimento_sla)).length;
  const slaRate   = comSla.length ? Math.round((dentroPrazo / comSla.length) * 100) : 0;

  // Por prioridade
  const porPrio = [1,2,3,4].map(p => ({
    label: PRIO_META[p].label,
    color: PRIO_META[p].color,
    total: ch.filter(c => c.prioridade_id === p).length,
    abertos: ch.filter(c => c.prioridade_id === p && !['Resolvido','Cancelado'].includes(c.status)).length,
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
        <div class="chart-header">
          <div class="chart-title">Distribuição por Prioridade</div>
        </div>
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
    </div>
  `;

  // Chart 30 days
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
      data: {
        labels: days30,
        datasets: [{ data: cnt30, backgroundColor: '#5b8ef030', borderColor: '#5b8ef0', borderWidth: 1, borderRadius: 3 }]
      },
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
