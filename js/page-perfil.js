/**
 * page-perfil.js — Perfil do usuário logado
 */

function loadPerfil() {
  const u = AppState.currentUser;
  const el = document.getElementById('perfil-content');
  if (!el || !u) return;

  el.innerHTML = `
    <div style="max-width:600px;margin:0 auto;display:flex;flex-direction:column;gap:24px">

      <!-- Avatar card - CORRIGIDO -->
      <div class="table-card" style="padding:28px">
        <div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap">
          <div class="profile-avatar-large" style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,var(--accent),#6a5ae8);display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:700;color:white;flex-shrink:0;box-shadow:0 8px 24px #4f80e840">
            ${(u.nome || '?')[0].toUpperCase()}
          </div>
          <div style="flex:1">
            <div style="font-size:20px;font-weight:700;color:var(--text-primary)">${u.nome || '—'}</div>
            <div style="font-size:13px;color:var(--text-muted);margin-top:4px">${u.email || '—'}</div>
            <div style="margin-top:8px">
              ${_cargoBadge(u.cargo)}
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;color:var(--text-muted)">Conta criada em</div>
            <div style="font-size:12px;font-weight:500;color:var(--text-primary);margin-top:2px">${formatDateShort(u.created_at)}</div>
          </div>
        </div>
      </div>

      <!-- Editar dados -->
      <div class="table-card" style="padding:28px">
        <div style="font-size:15px;font-weight:600;margin-bottom:20px;display:flex;align-items:center;gap:8px">
          ${Icons.get('edit', 18)} Editar dados
        </div>
        <div class="field" style="margin-bottom:16px">
          <label class="field-label">Nome completo</label>
          <div class="field-input-wrap">
            <input type="text" id="perfil-nome" value="${escHtml(u.nome || '')}" placeholder="Seu nome" style="width:100%;background:var(--bg-surface);border:1px solid var(--border-strong);border-radius:10px;padding:11px 14px;color:var(--text-primary);font-family:inherit;font-size:14px;outline:none">
          </div>
        </div>
        <div class="field" style="margin-bottom:0">
          <label class="field-label">E-mail</label>
          <div class="field-input-wrap">
            <input type="email" id="perfil-email" value="${escHtml(u.email || '')}" disabled style="width:100%;background:var(--bg-surface);border:1px solid var(--border-strong);border-radius:10px;padding:11px 14px;color:var(--text-muted);font-family:inherit;font-size:14px;opacity:0.6;cursor:not-allowed">
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:20px">
          <button class="btn btn-primary" onclick="savePerfil()" style="display:inline-flex;align-items:center;gap:8px;padding:8px 16px;background:var(--accent);color:white;border:none;border-radius:8px;cursor:pointer">
            ${Icons.get('check', 14)} Salvar alterações
          </button>
        </div>
      </div>

      <!-- Alterar senha -->
      <div class="table-card" style="padding:28px">
        <div style="font-size:15px;font-weight:600;margin-bottom:20px;display:flex;align-items:center;gap:8px">
          ${Icons.get('lock', 18)} Alterar senha
        </div>
        <div class="field" style="margin-bottom:16px">
          <label class="field-label">Nova senha</label>
          <div class="field-input-wrap">
            <input type="password" id="perfil-nova-senha" placeholder="Mínimo 6 caracteres" style="width:100%;background:var(--bg-surface);border:1px solid var(--border-strong);border-radius:10px;padding:11px 14px;color:var(--text-primary);font-family:inherit;font-size:14px;outline:none">
          </div>
        </div>
        <div class="field" style="margin-bottom:0">
          <label class="field-label">Confirmar nova senha</label>
          <div class="field-input-wrap">
            <input type="password" id="perfil-confirma-senha" placeholder="Repita a senha" style="width:100%;background:var(--bg-surface);border:1px solid var(--border-strong);border-radius:10px;padding:11px 14px;color:var(--text-primary);font-family:inherit;font-size:14px;outline:none">
          </div>
        </div>
        <div id="perfil-senha-error" style="display:none;margin-top:12px;padding:10px;background:#ee555512;border-radius:8px;font-size:12px;color:var(--red)"></div>
        <div style="display:flex;justify-content:flex-end;margin-top:20px">
          <button class="btn btn-secondary" onclick="saveSenha()" style="display:inline-flex;align-items:center;gap:8px;padding:8px 16px;background:var(--bg-elevated);color:var(--text-secondary);border:1px solid var(--border-strong);border-radius:8px;cursor:pointer">
            ${Icons.get('key', 14)} Atualizar senha
          </button>
        </div>
      </div>

      <!-- Info do cargo -->
      <div class="table-card" style="padding:28px">
        <div style="font-size:15px;font-weight:600;margin-bottom:20px;display:flex;align-items:center;gap:8px">
          ${Icons.get('shield', 18)} Permissões do seu cargo
        </div>
        ${_renderPermissoesCargo(u.cargo)}
      </div>
    </div>
  `;
}

function _cargoBadge(cargo) {
  const level = ROLE_LEVELS[cargo] ?? 1;
  const colors = ['', '#4e546a', '#5b8ef0', '#9b5bf0', '#f0b429'];
  const c = colors[level] || '#4e546a';
  return `<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;background:${c}18;color:${c};border:1px solid ${c}30">
    ${Icons.get('shield', 12)} ${cargo || '—'}
  </span>`;
}

function _renderPermissoesCargo(cargo) {
  const level = ROLE_LEVELS[cargo] ?? 1;
  const items = [
    { label: 'Visualizar chamados', min: 1 },
    { label: 'Responder chamados', min: 1 },
    { label: 'Abrir chamado manual', min: 1 },
    { label: 'Alterar status', min: 2 },
    { label: 'Ver relatórios', min: 2 },
    { label: 'Alterar prioridade', min: 3 },
    { label: 'Reatribuir responsável', min: 3 },
    { label: 'Gerenciar usuários', min: 4 },
    { label: 'Excluir chamados', min: 4 },
  ];
  return `<div style="display:flex;flex-direction:column;gap:12px">
    ${items.map(i => {
      const ok = level >= i.min;
      return `<div style="display:flex;align-items:center;gap:12px;font-size:13px">
        <span style="color:${ok ? 'var(--green)' : 'var(--text-muted)'}">${Icons.get(ok ? 'checkCircle' : 'xCircle', 14)}</span>
        <span style="color:${ok ? 'var(--text-primary)' : 'var(--text-muted)'}">${i.label}</span>
        ${!ok ? `<span style="font-size:10px;color:var(--text-muted);margin-left:auto">requer ${Object.keys(ROLE_LEVELS).find(k => ROLE_LEVELS[k] === i.min)}</span>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

async function savePerfil() {
  const nome = document.getElementById('perfil-nome')?.value.trim();
  if (!nome) {
    Notif.toast('Nome obrigatório.', 'warning');
    return;
  }
  if (!AppState.currentUser) return;

  try {
    const { error } = await db.from('usuarios_adm')
      .update({ nome })
      .eq('id', AppState.currentUser.id);
    if (error) throw error;

    AppState.currentUser.nome = nome;
    updateUserUI();
    loadPerfil();
    Notif.notify('Perfil atualizado com sucesso.', 'success', { title: 'Perfil salvo' });
  } catch (e) {
    Notif.toast('Erro: ' + e.message, 'error');
  }
}

async function saveSenha() {
  const nova = document.getElementById('perfil-nova-senha')?.value;
  const confirma = document.getElementById('perfil-confirma-senha')?.value;
  const errEl = document.getElementById('perfil-senha-error');

  if (errEl) errEl.style.display = 'none';

  if (!nova || nova.length < 6) {
    if (errEl) {
      errEl.textContent = 'A senha deve ter pelo menos 6 caracteres.';
      errEl.style.display = 'block';
    }
    return;
  }
  if (nova !== confirma) {
    if (errEl) {
      errEl.textContent = 'As senhas não coincidem.';
      errEl.style.display = 'block';
    }
    return;
  }

  try {
    const { error } = await db.auth.updateUser({ password: nova });
    if (error) throw error;

    document.getElementById('perfil-nova-senha').value = '';
    document.getElementById('perfil-confirma-senha').value = '';
    Notif.notify('Senha atualizada com sucesso.', 'success', { title: 'Senha alterada' });
  } catch (e) {
    if (errEl) {
      errEl.textContent = e.message;
      errEl.style.display = 'block';
    }
  }
}

function _cargoBadge(cargo) {
  const level  = ROLE_LEVELS[cargo] ?? 1;
  const colors = ['','#4e546a','#5b8ef0','#9b5bf0','#f0b429'];
  const c      = colors[level] || '#4e546a';
  return `<span class="cargo-badge" style="color:${c};background:${c}18;border-color:${c}30">
    ${Icons.get('shield',11)} ${cargo||'—'}
  </span>`;
}

function _renderPermissoesCargo(cargo) {
  const level = ROLE_LEVELS[cargo] ?? 1;
  const items = [
    { label: 'Visualizar chamados',      min: 1 },
    { label: 'Responder chamados',        min: 1 },
    { label: 'Abrir chamado manual',      min: 1 },
    { label: 'Alterar status',            min: 2 },
    { label: 'Ver relatórios',            min: 2 },
    { label: 'Alterar prioridade',        min: 3 },
    { label: 'Reatribuir responsável',    min: 3 },
    { label: 'Gerenciar usuários',        min: 4 },
    { label: 'Excluir chamados',          min: 4 },
  ];
  return `<div style="display:flex;flex-direction:column;gap:8px">
    ${items.map(i => {
      const ok = level >= i.min;
      return `<div style="display:flex;align-items:center;gap:10px;font-size:13px">
        <span style="color:${ok?'var(--green)':'var(--text-muted)'}">${Icons.get(ok?'checkCircle':'xCircle',14)}</span>
        <span style="color:${ok?'var(--text-primary)':'var(--text-muted)'}">${i.label}</span>
        ${!ok ? `<span style="font-size:10px;color:var(--text-muted);margin-left:auto">requer ${Object.keys(ROLE_LEVELS).find(k=>ROLE_LEVELS[k]===i.min)}</span>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

async function savePerfil() {
  const nome = document.getElementById('perfil-nome')?.value.trim();
  if (!nome) { Notif.toast('Nome obrigatório.', 'warning'); return; }
  if (!AppState.currentUser) return;

  try {
    const { error } = await db.from('usuarios_adm')
      .update({ nome })
      .eq('id', AppState.currentUser.id);
    if (error) throw error;

    AppState.currentUser.nome = nome;
    updateUserUI();
    loadPerfil();
    Notif.notify('Perfil atualizado com sucesso.', 'success', { title: 'Perfil salvo' });
  } catch(e) {
    Notif.toast('Erro: ' + e.message, 'error');
  }
}

async function saveSenha() {
  const nova      = document.getElementById('perfil-nova-senha')?.value;
  const confirma  = document.getElementById('perfil-confirma-senha')?.value;
  const errEl     = document.getElementById('perfil-senha-error');

  errEl.style.display = 'none';

  if (!nova || nova.length < 6) {
    errEl.textContent   = 'A senha deve ter pelo menos 6 caracteres.';
    errEl.style.display = 'block';
    return;
  }
  if (nova !== confirma) {
    errEl.textContent   = 'As senhas não coincidem.';
    errEl.style.display = 'block';
    return;
  }

  try {
    const { error } = await db.auth.updateUser({ password: nova });
    if (error) throw error;

    document.getElementById('perfil-nova-senha').value    = '';
    document.getElementById('perfil-confirma-senha').value = '';
    Notif.notify('Senha atualizada com sucesso.', 'success', { title: 'Senha alterada' });
  } catch(e) {
    errEl.textContent   = e.message;
    errEl.style.display = 'block';
  }
}
