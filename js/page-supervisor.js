/**
 * page-supervisor.js — Página para Supervisores verem sua equipe
 * Apenas visualização, sem ações de edição
 */

async function loadSupervisor() {
  if (!AppState.currentUser || AppState.currentUser.cargo !== 'Supervisor') {
    Notif.toast('Acesso restrito a Supervisores.', 'error');
    navigate('dashboard');
    return;
  }

  const deptoNome = getDeptName(AppState.currentUser.departamento_id);
  const badge = document.getElementById('supervisor-depto-badge');
  if (badge) {
    badge.innerHTML = `${Icons.get('users',12)} Departamento: ${deptoNome}`;
  }

  await carregarEquipe();
}

function getDeptName(id) {
  const deptos = ['', 'Financeiro', 'RH', 'TI', 'Suprimentos', 'Administrativo', 'Jurídico', 'Geral'];
  return deptos[id] || '—';
}

async function carregarEquipe() {
  const tbody = document.getElementById('supervisor-usuarios-tbody');
  if (!tbody) return;
  
  tbody.innerHTML = `<tr><td colspan="5" class="loading-cell"><span class="spinner"></span> Carregando...</td></tr>`;

  try {
    const deptoId = AppState.currentUser.departamento_id;
    
    const { data, error } = await db
      .from('usuarios_adm')
      .select('*')
      .eq('departamento_id', deptoId)
      .eq('ativo', true)
      .order('nome');

    if (error) throw error;

    renderEquipeTable(data || []);
  } catch(e) {
    console.error('Erro:', e);
    tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">Erro ao carregar equipe</td></tr>`;
  }
}

function renderEquipeTable(users) {
  const tbody = document.getElementById('supervisor-usuarios-tbody');
  if (!tbody) return;

  if (!users.length) {
    tbody.innerHTML = `<td><td colspan="5"><div class="empty-state">${Icons.get('users',32)}<p>Nenhum usuário no seu departamento</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const levelVal = ROLE_LEVELS[u.cargo] ?? 1;
    const levelColors = ['', '#4e546a', '#5b8ef0', '#9b5bf0', '#f0b429'];
    const cargoColor = levelColors[levelVal] || '#4e546a';
    const isSelf = AppState.currentUser?.id === u.id;
    
    const deptoNome = getDeptName(u.departamento_id);

    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div class="avatar-sm">${(u.nome || '?')[0].toUpperCase()}</div>
            <div>
              <div style="font-weight:600;font-size:13px;color:var(--text-primary)">
                ${u.nome || '—'} ${isSelf ? '<span style="font-size:10px;color:var(--text-muted)">(você)</span>' : ''}
              </div>
              <div style="font-size:11px;color:var(--text-muted)">${u.email || '—'}</div>
            </div>
          </div>
        </td>
        <td>
          <span class="cargo-badge" style="color:${cargoColor};background:${cargoColor}18;border-color:${cargoColor}30">
            ${Icons.get('shield',11)} ${u.cargo || '—'}
          </span>
        </td>
        <td>
          <span style="font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:4px">
            ${Icons.get('tag',11)} ${deptoNome}
          </span>
        </td>
        <td>
          <span class="badge ${u.ativo ? 'badge-resolvido' : 'badge-cancelado'}">
            ${Icons.get(u.ativo ? 'checkCircle' : 'xCircle', 11)} ${u.ativo ? 'Ativo' : 'Inativo'}
          </span>
        </td>
        <td style="font-size:12px;color:var(--text-muted)">${formatDateShort(u.created_at)}</td>
      </tr>
    `;
  }).join('');
}