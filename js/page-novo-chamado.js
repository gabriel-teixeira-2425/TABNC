/**
 * page-novo-chamado.js — Formulário para abrir chamado manualmente
 * CORRIGIDO: canal_origem → canal_id (FK correta); prioridade via n8n
 * O fluxo de criação envia para o webhook do n8n que classifica a prioridade,
 * cria o chamado e retorna o protocolo/prioridade_id.
 */

// ERRO 9: /webhook/ = produção (ativo sempre); /webhook-test/ = só com editor aberto
const N8N_WEBHOOK_URL = 'http://localhost:5678/webhook/chamados';

// Mapa nome → id para canais e departamentos (conforme banco)
const CANAL_IDS = {
  'WhatsApp': 1, 'Email': 2, 'Teams': 3,
  'Telefone': 4, 'Portal': 5, 'Presencial': 6,
};
const DEPTO_IDS = {
  'Financeiro': 1, 'RH': 2, 'TI': 3, 'Suprimentos': 4,
  'Administrativo': 5, 'Jurídico': 6, 'Comercial': 7,
  'Marketing': 8, 'Operações': 9, 'Geral': 10,
};

let _todosClientes = [];

async function loadNovoChamado() {
  const el = document.getElementById('novo-chamado-content');
  if (!el) return;

  const [{ data: clientes }, { data: usuarios }] = await Promise.all([
    db.from('clientes').select('id,nome,email,telefone,departamento,empresa').order('nome'),
    db.from('usuarios_adm').select('id,nome').eq('ativo', true).order('nome'),
  ]);

  _todosClientes = clientes || [];

  const optResponsaveis = `<option value="">Sem responsável</option>` +
    (usuarios || []).map(u => `<option value="${u.id}">${escHtml(u.nome)}</option>`).join('');

  const optDeptos = DEPTOS.map(d => `<option>${d}</option>`).join('');
  const optCanais = CANAIS.map(c => `<option>${c}</option>`).join('');

  el.innerHTML = `
    <div style="max-width:700px;margin:0 auto">
      <div class="table-card" style="padding:28px">
        <div style="font-size:15px;font-weight:700;margin-bottom:4px;display:flex;align-items:center;gap:8px">
          ${Icons.get('plus',18)} Novo Chamado Manual
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:22px;display:flex;align-items:center;gap:6px">
          ${Icons.get('activity',12)}
          A prioridade será definida automaticamente pelo sistema após o envio.
        </div>

        <!-- Cliente -->
        <div style="margin-bottom:20px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <label class="field-label" style="margin:0">Cliente / Empresa</label>
            <button class="btn btn-ghost btn-xs" onclick="openNovoClienteModal()">
              ${Icons.get('plus',12)} Novo cliente
            </button>
          </div>
          <div class="inp-wrap" style="position:relative">
            <span class="inp-icon">${Icons.get('search',13)}</span>
            <input type="text" class="inp inp-search" id="nc-cliente-search"
              placeholder="Buscar por nome, empresa ou e-mail..."
              autocomplete="off"
              oninput="filtrarClientesDropdown()"
              onfocus="filtrarClientesDropdown()"
              style="width:100%">
            <div id="nc-cliente-dropdown" style="
              display:none;position:absolute;top:100%;left:0;right:0;z-index:50;
              background:var(--bg-card);border:1px solid var(--border-strong);
              border-radius:9px;margin-top:4px;max-height:200px;overflow-y:auto;
              box-shadow:0 8px 32px #00000060"></div>
          </div>
          <input type="hidden" id="nc-cliente-id">
          <div id="nc-cliente-selected" style="display:none;margin-top:8px;padding:10px 14px;
            background:var(--bg-elevated);border:1px solid var(--border-md);border-radius:8px;
            font-size:12px;align-items:center;gap:10px">
          </div>
        </div>

        <!-- Assunto -->
        <div class="field" style="margin-bottom:16px">
          <label class="field-label">Assunto</label>
          <div class="field-input-wrap">
            <span class="field-input-icon">${Icons.get('tag',14)}</span>
            <input type="text" id="nc-assunto" placeholder="Descreva brevemente o problema">
          </div>
        </div>

        <!-- Mensagem -->
        <div class="field" style="margin-bottom:16px">
          <label class="field-label">Mensagem / Descrição</label>
          <textarea id="nc-mensagem" style="
            width:100%;background:var(--bg-surface);border:1px solid var(--border-strong);
            border-radius:9px;padding:10px 14px;color:var(--text-primary);font-family:inherit;
            font-size:13px;outline:none;resize:vertical;min-height:100px;
            transition:border-color .2s"
            placeholder="Detalhes do chamado..."
            onfocus="this.style.borderColor='var(--accent)'"
            onblur="this.style.borderColor='var(--border-strong)'"></textarea>
        </div>

        <!-- Canal (largura total, sem prioridade) -->
        <div style="margin-bottom:16px">
          <div class="field" style="margin:0">
            <label class="field-label">Canal de entrada</label>
            <select id="nc-canal" class="inp" style="width:100%">
              ${optCanais}
            </select>
          </div>
        </div>

        <!-- Departamento + Responsavel -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
          <div class="field" style="margin:0">
            <label class="field-label">Departamento</label>
            <select id="nc-departamento" class="inp" style="width:100%">
              ${optDeptos}
            </select>
          </div>
          <div class="field" style="margin:0">
            <label class="field-label">Responsável (opcional)</label>
            <select id="nc-responsavel" class="inp" style="width:100%">
              ${optResponsaveis}
            </select>
          </div>
        </div>

        <div id="nc-error" style="display:none;margin-bottom:14px;padding:10px 14px;
          background:#f05b5b12;border:1px solid #f05b5b30;border-radius:8px;
          font-size:13px;color:var(--red)"></div>

        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button class="btn btn-secondary btn-sm" onclick="resetNovoChamado()">
            ${Icons.get('x',13)} Limpar
          </button>
          <button class="btn btn-ghost btn-sm" id="nc-btn-salvar-notif" onclick="salvarNovoChamado(true)">
            ${Icons.get('bell',14)} Salvar e Notificar
          </button>
          <button class="btn btn-primary btn-sm" id="nc-btn-salvar" onclick="salvarNovoChamado(false)">
            ${Icons.get('check',14)} Salvar
          </button>
        </div>
      </div>
    </div>
  `;

  document.addEventListener('click', _closeClienteDropdown);
}

function filtrarClientesDropdown() {
  const q  = document.getElementById('nc-cliente-search')?.value.toLowerCase() || '';
  const dd = document.getElementById('nc-cliente-dropdown');
  if (!dd) return;

  const results = q.length < 1
    ? _todosClientes.slice(0, 8)
    : _todosClientes.filter(c =>
        (c.nome    || '').toLowerCase().includes(q) ||
        (c.empresa || '').toLowerCase().includes(q) ||
        (c.email   || '').toLowerCase().includes(q)
      ).slice(0, 10);

  if (!results.length) {
    dd.innerHTML = `<div style="padding:12px 16px;font-size:13px;color:var(--text-muted)">Nenhum cliente encontrado</div>`;
  } else {
    dd.innerHTML = results.map(c => {
      const emp = c.empresa
        ? `<span style="font-size:10px;background:var(--accent-glow);color:var(--accent);padding:1px 6px;border-radius:4px;margin-left:4px">${escHtml(c.empresa)}</span>`
        : '';
      return `
        <div class="quick-pop-item" onclick="selecionarCliente('${c.id}','${escHtml(c.nome)}','${escHtml(c.email||'')}','${escHtml(c.telefone||'')}','${escHtml(c.departamento||'')}','${escHtml(c.empresa||'')}')"
          style="display:flex;align-items:center;gap:10px">
          <div class="avatar-sm" style="width:28px;height:28px;font-size:11px">${(c.nome||'?')[0].toUpperCase()}</div>
          <div>
            <div style="font-size:13px;color:var(--text-primary)">${escHtml(c.nome)} ${emp}</div>
            <div style="font-size:11px;color:var(--text-muted)">${escHtml(c.email||'—')}</div>
          </div>
        </div>`;
    }).join('');
  }
  dd.style.display = 'block';
}

function selecionarCliente(id, nome, email, tel, depto, empresa) {
  document.getElementById('nc-cliente-id').value               = id;
  document.getElementById('nc-cliente-search').value           = empresa ? `${nome} — ${empresa}` : nome;
  document.getElementById('nc-cliente-dropdown').style.display = 'none';

  const sel = document.getElementById('nc-cliente-selected');
  sel.style.display = 'flex';
  const empTag = empresa
    ? `<span style="font-size:10px;background:var(--accent-glow);color:var(--accent);padding:2px 8px;border-radius:4px">${escHtml(empresa)}</span>`
    : '';
  sel.innerHTML = `
    <div class="avatar-sm" style="width:28px;height:28px;font-size:11px">${nome[0].toUpperCase()}</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:600;color:var(--text-primary);display:flex;align-items:center;gap:6px">${escHtml(nome)} ${empTag}</div>
      <div style="font-size:11px;color:var(--text-muted)">${escHtml(email)} ${tel ? '&middot; ' + escHtml(tel) : ''}</div>
    </div>
    <button class="icon-btn" onclick="limparCliente()" title="Remover">${Icons.get('x',12)}</button>`;
}

function limparCliente() {
  document.getElementById('nc-cliente-id').value     = '';
  document.getElementById('nc-cliente-search').value = '';
  document.getElementById('nc-cliente-selected').style.display = 'none';
}

function _closeClienteDropdown(e) {
  const wrap = document.getElementById('nc-cliente-search')?.closest('.inp-wrap');
  const dd   = document.getElementById('nc-cliente-dropdown');
  if (dd && wrap && !wrap.contains(e.target)) dd.style.display = 'none';
}

function resetNovoChamado() {
  limparCliente();
  ['nc-assunto','nc-mensagem'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value = '';
  });
  document.getElementById('nc-responsavel').value    = '';
  document.getElementById('nc-error').style.display  = 'none';
}

/**
 * salvarNovoChamado — envia para o webhook do n8n.
 * O n8n classifica a prioridade, cria o chamado no Supabase e retorna
 * { success, protocolo, prioridade_id }.
 * Após retorno, buscamos o chamado criado para abrir o modal.
 */
async function salvarNovoChamado(notificar = false) {
  // Pegar dados do cliente selecionado
  const clienteId   = document.getElementById('nc-cliente-id')?.value;
  const assunto     = document.getElementById('nc-assunto')?.value.trim();
  const mensagem    = document.getElementById('nc-mensagem')?.value.trim();
  const canalNome   = document.getElementById('nc-canal')?.value || 'Telefone';
  const deptoNome   = document.getElementById('nc-departamento')?.value || 'Geral';
  const responsavel = document.getElementById('nc-responsavel')?.value || null;
  const errEl       = document.getElementById('nc-error');

  errEl.style.display = 'none';

  if (!clienteId) { errEl.textContent = 'Selecione um cliente.';  errEl.style.display = 'block'; return; }
  if (!assunto)   { errEl.textContent = 'Assunto é obrigatório.'; errEl.style.display = 'block'; return; }

  // Buscar dados do cliente para enviar ao n8n
  const clienteObj = _todosClientes.find(c => c.id === clienteId) || {};

  const btn     = document.getElementById('nc-btn-salvar');
  const btnNotif= document.getElementById('nc-btn-salvar-notif');
  if (btn)      btn.disabled = true;
  if (btnNotif) btnNotif.disabled = true;

  // Mostrar estado de loading
  const btnOriginal = btn?.innerHTML;
  if (btn) btn.innerHTML = `<span class="spinner-sm"></span> Classificando...`;

  try {
    // ── 1. Enviar para o n8n para classificar prioridade e criar chamado ──────
    const payload = {
      assunto,
      mensagem: mensagem || '',
      cliente: {
        nome:     clienteObj.nome     || '',
        email:    clienteObj.email    || '',
        telefone: clienteObj.telefone || '',
        empresa:  clienteObj.empresa  || '',
      },
      canal:          canalNome,
      departamento:   deptoNome,
      responsavel_id: responsavel || null,
      origem:         'manual', // indica que veio do painel admin
    };

    const response = await fetch(N8N_WEBHOOK_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    if (!response.ok) {
      const txt = await response.text().catch(() => '');
      throw new Error(`n8n retornou erro ${response.status}${txt ? ': ' + txt : ''}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.mensagem || 'O workflow retornou falha.');
    }

    const proto       = result.protocolo;
    const prioId      = result.prioridade_id;
    const prioLabel   = PRIO_META[prioId]?.label || `Prioridade ${prioId}`;

    // ── 2. Buscar o chamado criado pelo n8n para abrir o modal ────────────────
    const { data: chamado } = await db
      .from('chamados')
      .select('id')
      .eq('protocolo', proto)
      .single();

    // ── 3. Se tiver responsável manual, atualizar no banco ────────────────────
    if (responsavel && chamado?.id) {
      await db.from('chamados')
        .update({ responsavel_id: responsavel })
        .eq('id', chamado.id);
    }

    const notifMsg = `Chamado #${proto} criado com prioridade ${prioLabel}${notificar ? ' — Responsável notificado.' : '.'}`;
    Notif.notify(notifMsg, 'success', {
      title:     'Chamado criado',
      chamadoId: chamado?.id,
    });

    if (notificar && responsavel && responsavel === AppState.currentUser?.id) {
      Notif.push(
        `Você foi atribuído ao chamado ${proto}.`,
        'ticket',
        { title: 'Novo chamado atribuído', chamadoId: chamado?.id }
      );
    }

    resetNovoChamado();

    // Navegar para chamados e abrir o modal
    if (chamado?.id) {
      setTimeout(() => {
        navigate('chamados');
        setTimeout(() => openChamado(chamado.id), 400);
      }, 800);
    } else {
      setTimeout(() => navigate('chamados'), 800);
    }

  } catch(e) {
    errEl.innerHTML     = `${Icons.get('alert',13)} ${e.message || 'Erro ao criar chamado.'}`;
    errEl.style.display = 'block';
  } finally {
    if (btn)      { btn.disabled = false; btn.innerHTML = btnOriginal; }
    if (btnNotif) btnNotif.disabled = false;
  }
}

// ─── Modal Novo Cliente ───────────────────────────────────────────────────────
async function saveNovoCliente() {
  const nome    = document.getElementById('nc-new-nome')?.value.trim();
  const empresa = document.getElementById('nc-new-empresa')?.value.trim();
  const email   = document.getElementById('nc-new-email')?.value.trim();
  const tel     = document.getElementById('nc-new-tel')?.value.trim();
  const depto   = document.getElementById('nc-new-depto-input')?.value;
  const errEl   = document.getElementById('nc-new-cliente-error');

  errEl.style.display = 'none';
  if (!nome)    { errEl.textContent = 'Nome obrigatório.';    errEl.style.display = 'block'; return; }
  if (!empresa) { errEl.textContent = 'Empresa obrigatória.'; errEl.style.display = 'block'; return; }

  // Salva sessão do admin para restaurar após o signUp
  const { data: { session: sessaoAdmin } } = await db.auth.getSession();

  try {
    // ── 1. Criar (ou reutilizar) login no Auth ────────────────────────────────
    let authClienteId = null;

    if (email) {
      const { data: signUpData, error: signUpErr } = await db.auth.signUp({
        email,
        password: '123456',
        options: { data: { name: nome, tipo: 'cliente' } },
      });

      if (signUpErr) {
        if (signUpErr.message?.toLowerCase().includes('already registered')) {
          // E-mail já tem Auth — faz login para pegar o UUID e sai logo em seguida
          const { data: siData, error: siErr } = await db.auth.signInWithPassword({
            email, password: '123456',
          });
          if (siErr) {
            // Senha diferente: avisa mas não bloqueia — continua sem authId
            console.warn('Cliente já tem Auth com senha diferente:', siErr.message);
          } else {
            authClienteId = siData.user?.id;
            await db.auth.signOut();
          }
        } else {
          throw signUpErr;
        }
      } else {
        authClienteId = signUpData.user?.id;
        if (signUpData.session) {
          // signUp retornou sessão (confirmação desativada) — sai para restaurar admin
          await db.auth.signOut();
        }
      }

      // ── 2. Restaura sessão do admin ─────────────────────────────────────────
      if (sessaoAdmin) {
        await db.auth.setSession({
          access_token:  sessaoAdmin.access_token,
          refresh_token: sessaoAdmin.refresh_token,
        });
      }
    }

    // ── 3. Inserir na tabela clientes ─────────────────────────────────────────
    const { data, error } = await db.from('clientes').insert({
      ...(authClienteId ? { id: authClienteId } : {}),
      nome,
      empresa:      empresa || null,
      email:        email   || null,
      telefone:     tel     || null,
      departamento: depto   || null,
    }).select().single();

    if (error) throw error;

    _todosClientes.push(data);
    selecionarCliente(data.id, data.nome, data.email||'', data.telefone||'', data.departamento||'', data.empresa||'');
    closeNovoClienteModal();
    Notif.toast(
      `Cliente "${nome}" criado${email ? ' com acesso ao portal (senha: 123456)' : ''}.`,
      'success'
    );
  } catch(e) {
    // Garante restauração da sessão mesmo em erro
    if (sessaoAdmin) {
      await db.auth.setSession({
        access_token:  sessaoAdmin.access_token,
        refresh_token: sessaoAdmin.refresh_token,
      }).catch(() => {});
    }
    errEl.textContent   = e.message;
    errEl.style.display = 'block';
  }
}
