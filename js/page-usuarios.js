/**
 * page-usuarios.js — Gerenciamento de usuários (somente Administrador)
 * CORRIGIDO: Mapeamento de cargos com acento
 * CORRIGIDO: Salvamento correto do departamento_id
 */

// Mapeamento de cargos (frontend -> banco)
const CARGO_MAP = {
    'Funcionario': 'Funcionário',
    'Atendente': 'Atendente', 
    'Supervisor': 'Supervisor',
    'Administrador': 'Administrador'
};

// Mapeamento reverso (banco -> frontend)
const CARGO_REVERSE = {
    'Funcionário': 'Funcionario',
    'Atendente': 'Atendente',
    'Supervisor': 'Supervisor', 
    'Administrador': 'Administrador'
};

async function loadUsuarios() {
  if (!can('page_usuarios')) return;

  const tbody = document.getElementById('usuarios-tbody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="loading-cell"><span class="spinner"></span> Carregando...</td></tr>`;

  try {
    const { data, error } = await db.from('usuarios_adm').select('*').order('nome');
    if (error) throw error;
    renderUsuariosTable(data || []);
  } catch(e) {
    Notif.toast('Erro ao carregar usuários: ' + e.message, 'error');
  }
}

function renderUsuariosTable(users) {
  const tbody = document.getElementById('usuarios-tbody');
  if (!tbody) return;

  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">${Icons.get('users',32)}<p>Nenhum usuário</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const levelVal    = ROLE_LEVELS[u.cargo] ?? 1;
    const levelColors = ['','#4e546a','#5b8ef0','#9b5bf0','#f0b429'];
    const cargoColor  = levelColors[levelVal] || '#4e546a';
    const isSelf      = AppState.currentUser?.id === u.id;
    
    // Mapeia o departamento_id para nome legível
    const getDeptName = (id) => {
      if (id === 1) return 'Financeiro';
      if (id === 2) return 'RH';
      if (id === 3) return 'TI';
      if (id === 4) return 'Suprimentos';
      if (id === 5) return 'Administrativo';
      if (id === 6) return 'Jurídico';
      if (id === 7) return 'Geral';
      return '—';
    };
    const deptoNome = getDeptName(u.departamento_id);

    return `
      <tr class="row-hover">
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div class="avatar-sm">${(u.nome||'?')[0].toUpperCase()}</div>
            <div>
              <div style="font-weight:600;font-size:13px;color:var(--text-primary)">
                ${u.nome||'—'} ${isSelf ? '<span style="font-size:10px;color:var(--text-muted)">(você)</span>' : ''}
              </div>
              <div style="font-size:11px;color:var(--text-muted)">${u.email||'—'}</div>
            </div>
          </div>
        </td>
        <td>
          <span class="cargo-badge" style="color:${cargoColor};background:${cargoColor}18;border-color:${cargoColor}30">
            ${Icons.get('shield',11)} ${u.cargo||'—'}
          </span>
        </td>
        <td>
          <span style="font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:4px">
            ${Icons.get('tag',11)} ${deptoNome}
          </span>
        </td>
        <td>
          <span class="badge ${u.ativo ? 'badge-resolvido' : 'badge-cancelado'}">
            ${Icons.get(u.ativo?'checkCircle':'xCircle',11)} ${u.ativo ? 'Ativo' : 'Inativo'}
          </span>
        </td>
        <td style="font-size:12px;color:var(--text-muted)">${formatDateShort(u.created_at)}</td>
        <td onclick="event.stopPropagation()">
          <div class="row-actions" style="opacity:1">
            ${can('user_edit') ? `<button class="icon-btn" title="Editar" onclick="editUsuario('${u.id}')">${Icons.get('edit',14)}</button>` : ''}
            ${can('user_toggle_active') && !isSelf ? `
              <button class="icon-btn ${u.ativo?'icon-btn-danger':'icon-btn-success'}"
                title="${u.ativo?'Desativar':'Ativar'}"
                onclick="toggleUsuarioAtivo('${u.id}',${!u.ativo})">
                ${Icons.get(u.ativo ? 'xCircle' : 'checkCircle', 14)}
              </button>` : ''}
            ${can('user_delete') && !isSelf ? `
              <button class="icon-btn icon-btn-danger" title="Remover do sistema"
                onclick="deleteUsuario('${u.id}','${escHtml(u.nome)}')">
                ${Icons.get('trash',14)}
              </button>` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');
}

/* ── Ativar / Desativar ───────────────────────────────────────────────────── */
async function toggleUsuarioAtivo(id, novoStatus) {
  const confirmed = await Modal.confirm(
    `${novoStatus ? 'Ativar' : 'Desativar'} usuário`,
    `Tem certeza que deseja ${novoStatus ? 'ativar' : 'desativar'} este usuário?`,
    { confirmLabel: novoStatus ? 'Ativar' : 'Desativar', confirmClass: novoStatus ? 'btn-primary' : 'btn-danger' }
  );
  if (!confirmed) return;

  try {
    const { error } = await db.from('usuarios_adm').update({ ativo: novoStatus }).eq('id', id);
    if (error) throw error;
    Notif.notify(`Usuário ${novoStatus ? 'ativado' : 'desativado'}.`, novoStatus ? 'success' : 'warning');
    loadUsuarios();
  } catch(e) {
    Notif.toast('Erro: ' + e.message, 'error');
  }
}

/* ── Editar ──────────────────────────────────────────────────────────────── */
async function editUsuario(id) {
  const { data: user, error } = await db.from('usuarios_adm').select('*').eq('id', id).single();
  if (error || !user) {
    Notif.toast('Erro ao carregar dados do usuário', 'error');
    return;
  }

  // Converte cargo do banco (com acento) para o valor do select (sem acento)
  const cargoSelectValue = CARGO_REVERSE[user.cargo] || 'Funcionario';
  
  document.getElementById('edit-user-id').value = user.id;
  document.getElementById('edit-user-nome').value = user.nome || '';
  document.getElementById('edit-user-email').value = user.email || '';
  document.getElementById('edit-user-cargo').value = cargoSelectValue;
  document.getElementById('edit-user-departamento').value = user.departamento_id || '';

  const ov = document.getElementById('edit-user-modal');
  ov.style.display = 'flex';
  requestAnimationFrame(() => ov.classList.add('open'));
}

async function saveEditUsuario() {
  const id      = document.getElementById('edit-user-id').value;
  const nome    = document.getElementById('edit-user-nome').value.trim();
  const cargoSelect = document.getElementById('edit-user-cargo').value;
  const deptoId = document.getElementById('edit-user-departamento').value;

  if (!nome) { 
    Notif.toast('Nome obrigatório.', 'warning'); 
    return; 
  }

  // 🔥 CORREÇÃO: Mapeia o cargo do select (sem acento) para o banco (com acento)
  const cargoBanco = CARGO_MAP[cargoSelect] || 'Funcionário';

  try {
    const updateData = { 
      nome, 
      cargo: cargoBanco  // Usa o valor com acento para o banco
    };
    
    if (deptoId && deptoId !== '') {
      updateData.departamento_id = parseInt(deptoId);
    }
    
    const { error } = await db.from('usuarios_adm').update(updateData).eq('id', id);
    if (error) throw error;
    
    Notif.notify('Usuário atualizado com sucesso.', 'success');
    closeEditUserModal();
    loadUsuarios();
    
    // Se for o próprio usuário, atualiza o estado global
    if (AppState.currentUser?.id === id) {
      AppState.currentUser.nome = nome;
      AppState.currentUser.cargo = cargoBanco;
      AppState.currentUser.departamento_id = deptoId ? parseInt(deptoId) : null;
      updateUserUI();
    }
  } catch(e) {
    Notif.toast('Erro ao salvar: ' + e.message, 'error');
  }
}

function closeEditUserModal() {
  const ov = document.getElementById('edit-user-modal');
  ov.classList.remove('open');
  setTimeout(() => { ov.style.display = 'none'; }, 250);
}

/* ── Novo usuário ────────────────────────────────────────────────────────── */
function openNovoUsuario() {
  document.getElementById('new-user-nome').value = '';
  document.getElementById('new-user-email').value = '';
  document.getElementById('new-user-cargo').value = 'Funcionario';
  document.getElementById('new-user-departamento').value = '';
  document.getElementById('new-user-error').style.display = 'none';

  const ov = document.getElementById('new-user-modal');
  ov.style.display = 'flex';
  requestAnimationFrame(() => ov.classList.add('open'));
}

async function saveNovoUsuario() {
  const nome  = document.getElementById('new-user-nome').value.trim();
  const email = document.getElementById('new-user-email').value.trim().toLowerCase();
  const cargoSelect = document.getElementById('new-user-cargo').value;
  const departamentoId = document.getElementById('new-user-departamento').value;
  const errEl = document.getElementById('new-user-error');
  errEl.style.display = 'none';

  if (!nome || !email) {
    _showUserError('Nome e e-mail são obrigatórios.');
    return;
  }

  // 🔥 CORREÇÃO: Mapeia o cargo do select (sem acento) para o banco (com acento)
  const cargoBanco = CARGO_MAP[cargoSelect] || 'Funcionário';

  const btn = document.getElementById('save-new-user-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-sm"></span> Criando...';

  const { data: { session: sessaoAdmin } } = await db.auth.getSession();

  try {
    // ── 1. Verificar tabela usuarios_adm ─────────────────────────────────────
    const { data: existing } = await db
      .from('usuarios_adm')
      .select('id,ativo,nome')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      if (!existing.ativo) {
        const restore = await Modal.confirm(
          'Usuário já cadastrado',
          `"${email}" já existe no sistema (inativo).\nDeseja reativar com o cargo "${cargoBanco}"?`,
          { confirmLabel: 'Reativar', confirmClass: 'btn-success' }
        );
        if (restore) {
          await db.from('usuarios_adm').update({ 
            nome, 
            cargo: cargoBanco,
            departamento_id: departamentoId || null,
            ativo: true 
          }).eq('id', existing.id);
          Notif.notify(`Usuário "${nome}" reativado.`, 'success');
          closeNewUserModal();
          loadUsuarios();
        }
        return;
      } else {
        _showUserError(`"${email}" já está cadastrado e ativo no sistema.`);
        return;
      }
    }

    // ── 2. Criar login no Auth via signUp ──────────────────────────
    const { data: signUpData, error: signUpErr } = await db.auth.signUp({
      email,
      password: '123456',
      options: { 
        data: { 
          name: nome, 
          cargo: cargoBanco,
          departamento_id: departamentoId 
        } 
      },
    });

    let authUserId = null;

    if (signUpErr) {
      if (signUpErr.message?.toLowerCase().includes('already registered')) {
        const { data: siData, error: siErr } = await db.auth.signInWithPassword({
          email, password: '123456'
        });
        if (siErr) {
          _showUserError(
            `Este e-mail já tem login no Supabase Auth mas com senha desconhecida.\n` +
            `Redefina a senha no Supabase Dashboard (Authentication > Users) e tente novamente.`
          );
          return;
        }
        authUserId = siData.user.id;
        await db.auth.signOut();
      } else {
        throw signUpErr;
      }
    } else {
      authUserId = signUpData.user?.id;
      if (signUpData.session) {
        await db.auth.signOut();
      }
    }

    if (!authUserId) throw new Error('Não foi possível obter o ID do usuário criado.');

    // ── 3. Restaurar sessão do admin ──────────────────────────────────────────
    if (sessaoAdmin) {
      await db.auth.setSession({
        access_token:  sessaoAdmin.access_token,
        refresh_token: sessaoAdmin.refresh_token,
      });
    }

    // ── 4. Inserir na tabela usuarios_adm ─────────────────────────────────────
    const { error: admErr } = await db.from('usuarios_adm').insert({
      id:    authUserId,
      nome,
      email,
      cargo: cargoBanco,  // Usa o valor com acento
      departamento_id: departamentoId || null,
      ativo: true,
    });
    if (admErr) throw admErr;

    Notif.notify(
      `Usuário "${nome}" criado com senha padrão 123456. Peça para alterar no primeiro acesso.`,
      'success',
      { title: 'Usuário criado', duration: 6000 }
    );
    closeNewUserModal();
    loadUsuarios();

  } catch(e) {
    if (sessaoAdmin) {
      await db.auth.setSession({
        access_token:  sessaoAdmin.access_token,
        refresh_token: sessaoAdmin.refresh_token,
      }).catch(() => {});
    }
    _showUserError(e.message || 'Erro ao criar usuário.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Criar usuário';
  }
}

function _showUserError(msg) {
  const el = document.getElementById('new-user-error');
  el.innerHTML = `${Icons.get('alert',13)} ${msg}`;
  el.style.display = 'flex';
}

function closeNewUserModal() {
  const ov = document.getElementById('new-user-modal');
  ov.classList.remove('open');
  setTimeout(() => { ov.style.display = 'none'; }, 250);
}

async function deleteUsuario(id, nome) {
  const confirmed = await Modal.confirm(
    'Remover usuário do sistema',
    `Remover "${nome}"?\n\nO usuário perderá acesso ao painel imediatamente.\n\nPara remover o login permanentemente do Auth, acesse o Supabase Dashboard > Authentication > Users.`,
    { confirmLabel: 'Remover', confirmClass: 'btn-danger' }
  );
  if (!confirmed) return;

  try {
    const { error } = await db.from('usuarios_adm').delete().eq('id', id);
    if (error) throw error;
    Notif.notify(
      `"${nome}" removido do sistema. Lembre-se de excluir o login no Supabase Dashboard se necessário.`,
      'success',
      { title: 'Usuário removido', duration: 7000 }
    );
    loadUsuarios();
  } catch(e) {
    Notif.toast('Erro ao remover: ' + e.message, 'error');
  }
}