/**
 * page-perfil.js — Perfil do usuário logado
 */

function loadPerfil() {
  const u   = AppState.currentUser;
  const el  = document.getElementById('perfil-content');
  if (!el || !u) return;

  el.innerHTML = `
    <div style="max-width:600px;margin:0 auto;display:flex;flex-direction:column;gap:20px">

      <!-- Avatar card -->
      <div class="table-card" style="padding:28px;display:flex;align-items:center;gap:20px">
        <div style="
          width:72px;height:72px;border-radius:50%;
          background:linear-gradient(135deg,var(--accent),#6a5ae8);
          display:flex;align-items:center;justify-content:center;
          font-size:28px;font-weight:700;color:white;flex-shrink:0;
          box-shadow:0 8px 24px #4f80e840">
          ${(u.nome||'?')[0].toUpperCase()}
        </div>
        <div>
          <div style="font-size:20px;font-weight:700">${u.nome||'—'}</div>
          <div style="font-size:13px;color:var(--text-muted);margin-top:3px">${u.email||'—'}</div>
          <div style="margin-top:8px">
            ${_cargoBadge(u.cargo)}
          </div>
        </div>
        <div style="margin-left:auto;text-align:right">
          <div style="font-size:11px;color:var(--text-muted)">Conta criada em</div>
          <div style="font-size:12px;font-weight:500;margin-top:2px">${formatDateShort(u.created_at)}</div>
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
            <input type="text" id="perfil-nome" value="${escHtml(u.nome||'')}" placeholder="Seu nome">
          </div>
        </div>
        <div class="field" style="margin-bottom:0">
          <label class="field-label">E-mail</label>
          <div class="field-input-wrap">
            <span class="field-input-icon">${Icons.get('send',14)}</span>
            <input type="email" id="perfil-email" value="${escHtml(u.email||'')}" disabled
              style="opacity:.5;cursor:not-allowed" title="O e-mail não pode ser alterado aqui">
          </div>
        </div>
        <div style="margin-top:16px;display:flex;justify-content:flex-end">
          <button class="btn btn-primary btn-sm" onclick="savePerfil()">
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
            <input type="password" id="perfil-nova-senha" placeholder="Mínimo 6 caracteres">
          </div>
        </div>
        <div class="field" style="margin-bottom:0">
          <label class="field-label">Confirmar nova senha</label>
          <div class="field-input-wrap">
            <span class="field-input-icon">${Icons.get('check',14)}</span>
            <input type="password" id="perfil-confirma-senha" placeholder="Repita a senha">
          </div>
        </div>
        <div id="perfil-senha-error" style="display:none;margin-top:10px;font-size:12px;color:var(--red)"></div>
        <div style="margin-top:16px;display:flex;justify-content:flex-end">
          <button class="btn btn-secondary btn-sm" onclick="saveSenha()">
            ${Icons.get('key',14)} Atualizar senha
          </button>
        </div>
      </div>

      <!-- Info do cargo -->
      <div class="table-card" style="padding:20px">
        <div style="font-size:14px;font-weight:600;margin-bottom:14px;display:flex;align-items:center;gap:8px">
          ${Icons.get('shield',16)} Permissões do seu cargo
        </div>
        ${_renderPermissoesCargo(u.cargo)}
      </div>
    </div>
  `;
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
