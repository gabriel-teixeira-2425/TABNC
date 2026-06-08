/**
 * modal-chamado.js — Modal de detalhe, mensagens, historico, acoes
 * CORRIGIDO: select sem prioridades join forçado
 * ADICIONADO: exibicao de empresa no painel lateral
 */

async function openChamado(id) {
  if (!can('chamado_view')) {
    Notif.toast('Sem permissao para visualizar chamados.', 'error');
    return;
  }

  AppState.currentChamado = null;
  _showModal();
  _setModalLoading();

  try {
    // Select sem join em prioridades para evitar erro 400
    const { data: ch, error } = await db
      .from('chamados')
      .select('*, clientes(*)')
      .eq('id', id)
      .single();

    if (error) throw error;
    AppState.currentChamado = ch;

    _renderModalHeader(ch);
    _renderClientInfo(ch.clientes);
    _renderChamadoInfo(ch);
    _applyModalPermissions();
    loadMessages(id);
    loadHistorico(id);
    // ERRO 2: carrega painel de atribuição para Supervisor+
    if (can('chamado_assign')) _loadAssignPanel(ch);

    document.getElementById('new-status').value      = ch.status || '';
    document.getElementById('new-prioridade').value  = ch.prioridade_id || '';

    switchTab('msgs');
  } catch (e) {
    Notif.toast('Erro ao abrir chamado: ' + e.message, 'error');
    closeModal();
  }
}

function _showModal() {
  const ov = document.getElementById('modal-overlay');
  ov.style.display = 'flex';
  requestAnimationFrame(() => ov.classList.add('open'));
}

function _setModalLoading() {
  document.getElementById('modal-title').textContent     = 'Carregando...';
  document.getElementById('modal-proto').textContent     = '';
  document.getElementById('modal-status-badge').innerHTML= '';
  document.getElementById('client-info').innerHTML       = '<div class="info-loading"><span class="spinner"></span></div>';
  document.getElementById('chamado-info').innerHTML      = '<div class="info-loading"><span class="spinner"></span></div>';
  document.getElementById('msg-list').innerHTML          = '<div class="msg-loading"><span class="spinner"></span></div>';
  document.getElementById('reply-text').value            = '';
  document.getElementById('new-status').value            = '';
  document.getElementById('new-prioridade').value        = '';
  document.getElementById('justificativa-prioridade').value = '';
}

function _renderModalHeader(ch) {
  document.getElementById('modal-title').textContent      = ch.assunto || 'Sem assunto';
  document.getElementById('modal-proto').innerHTML        =
    `${Icons.get('tag', 12)} <span class="mono" style="cursor:pointer" onclick="copyToClipboard('${ch.protocolo||''}')" title="Copiar">${ch.protocolo||'—'}</span>`;
  document.getElementById('modal-status-badge').innerHTML = statusBadge(ch.status);
}

function _renderClientInfo(cli) {
  const el = document.getElementById('client-info');
  if (!cli) { el.innerHTML = '<span class="info-empty">Sem dados de cliente</span>'; return; }

  const empresaRow = cli.empresa
    ? `<div class="info-row"><span class="info-key">${Icons.get('tag',11)} Empresa</span>
        <span class="info-val" style="color:var(--accent);font-weight:600">${escHtml(cli.empresa)}</span></div>`
    : '';

  el.innerHTML = `
    ${empresaRow}
    <div class="info-row"><span class="info-key">${Icons.get('user',11)} Contato</span><span class="info-val">${escHtml(cli.nome||'—')}</span></div>
    <div class="info-row"><span class="info-key">${Icons.get('send',11)} E-mail</span><span class="info-val">${escHtml(cli.email||'—')}</span></div>
    <div class="info-row"><span class="info-key">${Icons.get('activity',11)} Telefone</span><span class="info-val">${escHtml(cli.telefone||'—')}</span></div>
    <div class="info-row"><span class="info-key">${Icons.get('tag',11)} Depto</span><span class="info-val">${escHtml(cli.departamento||'—')}</span></div>`;
}

function _renderChamadoInfo(ch) {
  const el  = document.getElementById('chamado-info');
  const sla = getSlaInfo(ch);
  el.innerHTML = `
    <div class="info-row"><span class="info-key">${Icons.get('activity',11)} Status</span><span class="info-val">${statusBadge(ch.status)}</span></div>
    <div class="info-row"><span class="info-key">${Icons.get('warning',11)} Prioridade</span><span class="info-val">${prioBadge(ch.prioridade_id)}</span></div>
    <div class="info-row"><span class="info-key">${Icons.get('calendar',11)} Abertura</span><span class="info-val">${formatDate(ch.data_abertura)}</span></div>
    <div class="info-row"><span class="info-key">${Icons.get('clock',11)} Venc. SLA</span>
      <span class="info-val" style="color:${sla.color}">${ch.data_vencimento_sla ? formatDate(ch.data_vencimento_sla) : '—'}</span>
    </div>
    ${ch.data_vencimento_sla && !['Resolvido','Cancelado'].includes(ch.status) ? `
    <div style="margin-top:6px">
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-bottom:3px">
        <span>SLA</span><span style="color:${sla.color}">${sla.label}</span>
      </div>
      <div class="sla-bar"><div class="sla-bar-fill" style="width:${sla.percent}%;background:${sla.color}"></div></div>
    </div>` : ''}`;
}

function _applyModalPermissions() {
  document.getElementById('actions-status-section').style.display     = can('chamado_status_change')   ? 'block' : 'none';
  document.getElementById('actions-prioridade-section').style.display = can('chamado_priority_change') ? 'block' : 'none';
  document.getElementById('reply-section').style.display              = can('chamado_reply')           ? 'flex'  : 'none';
  // ERRO 2: painel de reatribuição visível somente para Supervisor+
  const assignSection = document.getElementById('actions-assign-section');
  if (assignSection) assignSection.style.display = can('chamado_assign') ? 'block' : 'none';
}

async function loadMessages(chamadoId) {
  const { data, error } = await db
    .from('mensagens_chamado')
    .select('*')
    .eq('chamado_id', chamadoId)
    .order('created_at', { ascending: true });

  const list = document.getElementById('msg-list');
  if (error) { list.innerHTML = '<p class="msg-error">Erro ao carregar mensagens.</p>'; return; }

  const msgs = data || [];
  const ch   = AppState.currentChamado;

  let items = [];
  if (ch?.mensagem_original && !msgs.find(m => m.origem === 'cliente')) {
    items.push({ origem: 'cliente', conteudo: ch.mensagem_original, created_at: ch.data_abertura, _original: true });
  }
  items = [...items, ...msgs];

  if (!items.length) {
    list.innerHTML = `<div class="msg-empty">${Icons.get('message',24)}<p>Sem mensagens</p></div>`;
    return;
  }

  list.innerHTML = items.map(m => `
    <div class="msg-bubble msg-${m.origem}">
      <div class="msg-content">${escHtml(m.conteudo)}</div>
      <div class="msg-meta">
        ${m.origem === 'cliente'
          ? `${Icons.get('user',11)} Cliente`
          : `${Icons.get('headphone',11)} Atendimento`}
        ${m._original ? ' &middot; Mensagem original' : ''}
        &nbsp;&middot;&nbsp; ${timeAgo(m.created_at)}
      </div>
    </div>`).join('');

  list.scrollTop = list.scrollHeight;
}

async function sendReply() {
  if (!AppState.currentChamado) return;
  if (!can('chamado_reply')) { Notif.toast('Sem permissao para responder.', 'error'); return; }

  const text = document.getElementById('reply-text').value.trim();
  if (!text) { Notif.toast('Escreva uma resposta antes de enviar.', 'warning'); return; }

  const btn = document.getElementById('send-reply-btn');
  btn.disabled = true;

  try {
    const { error } = await db.from('mensagens_chamado').insert({
      chamado_id: AppState.currentChamado.id,
      origem:     'adm',
      conteudo:   text,
    });
    if (error) throw error;

    document.getElementById('reply-text').value = '';
    await loadMessages(AppState.currentChamado.id);
    Notif.toast('Resposta enviada.', 'success', { title: 'Enviado' });
  } catch (e) {
    Notif.toast('Erro ao enviar: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function changeStatus() {
  if (!AppState.currentChamado) return;
  if (!can('chamado_status_change')) { Notif.toast('Sem permissao.', 'error'); return; }

  const newStatus = document.getElementById('new-status').value;
  if (!newStatus) { Notif.toast('Selecione um status.', 'warning'); return; }
  if (newStatus === AppState.currentChamado.status) { Notif.toast('Status ja e esse.', 'info'); return; }

  const btn = document.getElementById('change-status-btn');
  btn.disabled = true;

  try {
    const oldStatus = AppState.currentChamado.status;
    const { error } = await db.from('chamados').update({ status: newStatus }).eq('id', AppState.currentChamado.id);
    if (error) throw error;

    await db.from('historico_status').insert({
      chamado_id:      AppState.currentChamado.id,
      status_anterior: oldStatus,
      status_novo:     newStatus,
      alterado_por:    AppState.currentUser?.id,
    });

    Notif.notify(
      `Status alterado de "${oldStatus}" para "${newStatus}".`,
      'success',
      { title: 'Status atualizado', chamadoId: AppState.currentChamado.id }
    );

    await openChamado(AppState.currentChamado.id);
    silentRefresh();
  } catch (e) {
    Notif.toast('Erro: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function changePrioridade() {
  if (!AppState.currentChamado) return;
  if (!can('chamado_priority_change')) { Notif.toast('Sem permissao.', 'error'); return; }

  const newPrio       = parseInt(document.getElementById('new-prioridade').value);
  const justificativa = document.getElementById('justificativa-prioridade').value.trim();

  if (!newPrio)       { Notif.toast('Selecione uma prioridade.', 'warning'); return; }
  if (!justificativa) { Notif.toast('Justificativa obrigatoria.', 'warning', { title: 'Campo obrigatorio' }); return; }
  if (newPrio === AppState.currentChamado.prioridade_id) { Notif.toast('Prioridade igual a atual.', 'info'); return; }

  const btn = document.getElementById('change-prio-btn');
  btn.disabled = true;

  try {
    const oldPrio = AppState.currentChamado.prioridade_id;
    const { error } = await db.from('chamados').update({ prioridade_id: newPrio }).eq('id', AppState.currentChamado.id);
    if (error) throw error;

    await db.from('historico_prioridade').insert({
      chamado_id:           AppState.currentChamado.id,
      prioridade_anterior_id: oldPrio,
      prioridade_nova_id:   newPrio,
      justificativa,
      alterado_por:         AppState.currentUser?.id,
    });

    const pLabel = PRIO_META[newPrio]?.label || newPrio;
    Notif.notify(
      `Prioridade alterada para "${pLabel}". Motivo: ${justificativa}`,
      newPrio >= 3 ? 'warning' : 'success',
      { title: 'Prioridade atualizada', chamadoId: AppState.currentChamado.id }
    );

    document.getElementById('justificativa-prioridade').value = '';
    await openChamado(AppState.currentChamado.id);
    silentRefresh();
  } catch (e) {
    Notif.toast('Erro: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function loadHistorico(chamadoId) {
  const [sH, pH] = await Promise.all([
    db.from('historico_status').select('*').eq('chamado_id', chamadoId).order('created_at', { ascending: false }),
    db.from('historico_prioridade').select('*').eq('chamado_id', chamadoId).order('created_at', { ascending: false }),
  ]);

  const list = document.getElementById('historico-list');
  const merged = [
    ...(sH.data||[]).map(h => ({ ...h, tipo:'status' })),
    ...(pH.data||[]).map(h => ({ ...h, tipo:'prioridade' })),
  ].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

  if (!merged.length) {
    list.innerHTML = `<div class="hist-empty">${Icons.get('report',24)}<p>Nenhuma alteracao</p></div>`;
    return;
  }

  list.innerHTML = merged.map(h => {
    let text = '', iconName = 'edit', color = 'var(--accent)';
    if (h.tipo === 'status') {
      text      = `Status: <b>${escHtml(h.status_anterior||'—')}</b> &rarr; <b>${escHtml(h.status_novo||'—')}</b>`;
      iconName  = 'activity';
      color     = STATUS_META[h.status_novo]?.color || 'var(--accent)';
    } else {
      const pA  = PRIO_META[h.prioridade_anterior]?.label || '—';
      const pN  = PRIO_META[h.prioridade_nova]?.label || '—';
      text      = `Prioridade: <b>${pA}</b> &rarr; <b>${pN}</b>`;
      iconName  = 'tag';
      color     = PRIO_META[h.prioridade_nova]?.color || 'var(--yellow)';
      if (h.justificativa) text += `<div class="log-just">${Icons.get('message',10)} ${escHtml(h.justificativa)}</div>`;
    }
    return `
      <div class="log-entry">
        <div class="log-icon" style="color:${color};background:${color}18">${Icons.get(iconName,13)}</div>
        <div class="log-body">
          <div class="log-text">${text}</div>
          <div class="log-time">${Icons.get('clock',10)} ${timeAgo(h.created_at)} &middot; ${formatDate(h.created_at)}</div>
        </div>
      </div>`;
  }).join('');
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tab));
  document.getElementById('tab-msgs').style.display      = tab === 'msgs'      ? 'flex' : 'none';
  document.getElementById('tab-historico').style.display = tab === 'historico' ? 'block': 'none';
}

function closeModal() {
  const ov = document.getElementById('modal-overlay');
  ov.classList.remove('open');
  setTimeout(() => { ov.style.display = 'none'; AppState.currentChamado = null; }, 250);
}

function closeModalIfOutside(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
}

// ─── ERRO 2: Painel de Reatribuição (Supervisor) ──────────────────────────────
async function _loadAssignPanel(ch) {
  const el = document.getElementById('assign-select');
  if (!el) return;

  // Carregar membros do departamento do Supervisor logado
  const deptoId = AppState.currentUser?.departamento_id;
  if (!deptoId) return;

  const { data: membros } = await db
    .from('usuarios_adm')
    .select('id, nome, cargo')
    .eq('departamento_id', deptoId)
    .eq('ativo', true)
    .in('cargo', ['Atendente', 'Funcionário'])
    .order('nome');

  el.innerHTML = `<option value="">— Sem responsável —</option>` +
    (membros || []).map(m =>
      `<option value="${m.id}" ${ch.responsavel_id === m.id ? 'selected' : ''}>${escHtml(m.nome)} (${m.cargo})</option>`
    ).join('');
}

async function assignResponsavel() {
  const ch = AppState.currentChamado;
  if (!ch) return;
  if (!can('chamado_assign')) { Notif.toast('Sem permissão.', 'error'); return; }

  const novoId = document.getElementById('assign-select')?.value || null;
  const btn    = document.getElementById('assign-btn');
  if (btn) btn.disabled = true;

  try {
    const updates = { responsavel_id: novoId || null };

    // Quando atribuído a alguém e status ainda é Novo/Em Análise → muda para Em Atendimento
    if (novoId && ['Novo', 'Em Análise'].includes(ch.status)) {
      updates.status = 'Em Atendimento';
      await db.from('historico_status').insert({
        chamado_id: ch.id, status_anterior: ch.status,
        status_novo: 'Em Atendimento', alterado_por: AppState.currentUser?.id,
      });
    }

    const { error } = await db.from('chamados').update(updates).eq('id', ch.id);
    if (error) throw error;

    const nomeResp = document.getElementById('assign-select')?.selectedOptions[0]?.text || 'Nenhum';
    Notif.notify(
      novoId ? `Chamado atribuído a ${nomeResp}.` : 'Responsável removido.',
      'success', { title: 'Atribuição atualizada', chamadoId: ch.id }
    );

    await openChamado(ch.id);
    silentRefresh();
  } catch(e) {
    Notif.toast('Erro: ' + e.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}
