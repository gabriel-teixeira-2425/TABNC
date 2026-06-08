/**
 * modal-chamado-cliente.js — Modal de detalhes do chamado para o cliente
 * O cliente pode ler mensagens e responder, mas não pode alterar status/prioridade.
 * Quando envia mensagem enquanto "Pendente Cliente", o status volta para "Em Atendimento".
 */

let _cliCurrentChamado = null;

async function openChamadoCliente(id) {
  const c = ClienteState.currentCliente;
  if (!c) return;

  _cliCurrentChamado = null;
  _showCliModal();
  _setCliModalLoading();

  try {
    // Buscar chamado validando que pertence ao cliente logado
    const { data: ch, error } = await db
      .from('chamados')
      .select('id, protocolo, assunto, status, prioridade_id, data_abertura, data_vencimento_sla, responsavel_id, mensagem_original, canal_id')
      .eq('id', id)
      .eq('cliente_id', c.id)
      .single();

    if (error || !ch) {
      Notif.toast('Chamado não encontrado ou acesso negado.', 'error');
      closeCliModal();
      return;
    }

    _cliCurrentChamado = ch;

    // Buscar responsável em consulta separada
    let responsavelNome = '—';
    if (ch.responsavel_id) {
      const { data: resp } = await db
        .from('usuarios_adm')
        .select('nome')
        .eq('id', ch.responsavel_id)
        .single();
      if (resp) responsavelNome = resp.nome;
    }

    _renderCliModalHeader(ch);
    _renderCliChamadoInfo(ch);
    _renderCliResponsavelCard(responsavelNome, ch.responsavel_id);
    loadCliMessages(id);

    // Mostrar/ocultar área de resposta baseado no status
    const replySection = document.getElementById('cli-reply-section');
    if (replySection) {
      const bloqueado = ['Resolvido', 'Cancelado'].includes(ch.status);
      replySection.style.display = bloqueado ? 'none' : 'flex';
    }

    _switchCliTab('msgs');

  } catch (e) {
    Notif.toast('Erro ao abrir chamado: ' + e.message, 'error');
    closeCliModal();
  }
}

function _showCliModal() {
  const ov = document.getElementById('cli-modal-overlay');
  if (!ov) return;
  ov.style.display = 'flex';
  requestAnimationFrame(() => ov.classList.add('open'));
}

function _setCliModalLoading() {
  const setHTML = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
  const setText = (id, txt)  => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  setText('cli-modal-title',        'Carregando...');
  setHTML('cli-modal-proto',        '');
  setHTML('cli-modal-status-badge', '');
  setHTML('cli-chamado-info',       '<div class="info-loading"><span class="spinner"></span></div>');
  setHTML('cli-responsavel-card',   '<div class="info-loading"><span class="spinner"></span></div>');
  setHTML('cli-msg-list',           '<div class="msg-loading"><span class="spinner"></span></div>');
  const replyText = document.getElementById('cli-reply-text');
  if (replyText) replyText.value = '';
}

function _renderCliModalHeader(ch) {
  const titleEl  = document.getElementById('cli-modal-title');
  const protoEl  = document.getElementById('cli-modal-proto');
  const statusEl = document.getElementById('cli-modal-status-badge');
  if (titleEl)  titleEl.textContent = ch.assunto || 'Sem assunto';
  if (protoEl)  protoEl.innerHTML   =
    `${Icons.get('tag', 12)} <span class="mono" style="cursor:pointer"
      onclick="copyToClipboard('${ch.protocolo||''}')" title="Copiar">${ch.protocolo || '—'}</span>`;
  if (statusEl) statusEl.innerHTML  = statusBadge(ch.status);
}

function _renderCliChamadoInfo(ch) {
  const el  = document.getElementById('cli-chamado-info');
  if (!el) return;
  const sla = getSlaInfo(ch);
  el.innerHTML = `
    <div class="info-row"><span class="info-key">${Icons.get('activity',11)} Status</span>
      <span class="info-val">${statusBadge(ch.status)}</span></div>
    <div class="info-row"><span class="info-key">${Icons.get('warning',11)} Prioridade</span>
      <span class="info-val">${prioBadge(ch.prioridade_id)}</span></div>
    <div class="info-row"><span class="info-key">${Icons.get('calendar',11)} Abertura</span>
      <span class="info-val">${formatDate(ch.data_abertura)}</span></div>
    <div class="info-row"><span class="info-key">${Icons.get('clock',11)} Venc. SLA</span>
      <span class="info-val" style="color:${sla.color}">
        ${ch.data_vencimento_sla ? formatDate(ch.data_vencimento_sla) : '—'}
      </span></div>
    ${ch.data_vencimento_sla && !['Resolvido','Cancelado'].includes(ch.status) ? `
    <div style="margin-top:6px">
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-bottom:3px">
        <span>SLA</span><span style="color:${sla.color}">${sla.label}</span>
      </div>
      <div class="sla-bar"><div class="sla-bar-fill" style="width:${sla.percent}%;background:${sla.color}"></div></div>
    </div>` : ''}`;
}

function _renderCliResponsavelCard(nome, respId) {
  const el = document.getElementById('cli-responsavel-card');
  if (!el) return;
  if (!respId || nome === '—') {
    el.innerHTML = `
      <div class="cli-atendente-empty">
        ${Icons.get('headphone', 20)}
        <span>Aguardando atribuição</span>
      </div>`;
    return;
  }
  el.innerHTML = `
    <div class="cli-atendente-card">
      <div class="cli-atendente-avatar">${nome[0].toUpperCase()}</div>
      <div>
        <div class="cli-atendente-nome">${escHtml(nome)}</div>
        <div class="cli-atendente-role">${Icons.get('headphone',11)} Atendente responsável</div>
      </div>
    </div>`;
}

async function loadCliMessages(chamadoId) {
  const { data, error } = await db
    .from('mensagens_chamado')
    .select('*')
    .eq('chamado_id', chamadoId)
    .order('created_at', { ascending: true });

  const list = document.getElementById('cli-msg-list');
  if (!list) return;
  if (error) { list.innerHTML = '<p class="msg-error">Erro ao carregar mensagens.</p>'; return; }

  const msgs = data || [];
  const ch   = _cliCurrentChamado;

  let items = [];
  if (ch?.mensagem_original && !msgs.find(m => m.origem === 'cliente')) {
    items.push({
      origem: 'cliente',
      conteudo: ch.mensagem_original,
      created_at: ch.data_abertura,
      _original: true,
    });
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
          ? `${Icons.get('user',11)} Você`
          : `${Icons.get('headphone',11)} Suporte`}
        ${m._original ? ' &middot; Mensagem original' : ''}
        &nbsp;&middot;&nbsp; ${timeAgo(m.created_at)}
      </div>
    </div>`).join('');

  list.scrollTop = list.scrollHeight;
}

async function sendCliReply() {
  const ch = _cliCurrentChamado;
  if (!ch) return;

  const text = document.getElementById('cli-reply-text')?.value.trim();
  if (!text) { Notif.toast('Escreva uma mensagem antes de enviar.', 'warning'); return; }

  const btn = document.getElementById('cli-send-reply-btn');
  if (btn) btn.disabled = true;

  try {
    // Inserir mensagem
    const { error: msgErr } = await db.from('mensagens_chamado').insert({
      chamado_id: ch.id,
      origem:     'cliente',
      conteudo:   text,
    });
    if (msgErr) throw msgErr;

    // Se estava "Pendente Cliente", mudar para "Em Atendimento"
    if (ch.status === 'Pendente Cliente') {
      const { error: stErr } = await db
        .from('chamados')
        .update({ status: 'Em Atendimento' })
        .eq('id', ch.id);
      if (!stErr) {
        await db.from('historico_status').insert({
          chamado_id:      ch.id,
          status_anterior: 'Pendente Cliente',
          status_novo:     'Em Atendimento',
          alterado_por:    null,
        });
        _cliCurrentChamado.status = 'Em Atendimento';
        _renderCliModalHeader(_cliCurrentChamado);
        _renderCliChamadoInfo(_cliCurrentChamado);
        _updateClienteBadge();
      }
    }

    const replyText = document.getElementById('cli-reply-text');
    if (replyText) replyText.value = '';
    await loadCliMessages(ch.id);
    Notif.toast('Mensagem enviada.', 'success', { title: 'Enviado' });

  } catch (e) {
    Notif.toast('Erro ao enviar: ' + e.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function _switchCliTab(tab) {
  document.querySelectorAll('.cli-tab-btn').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tab));
  const tabMsgs = document.getElementById('cli-tab-msgs');
  const tabInfo = document.getElementById('cli-tab-info');
  if (tabMsgs) tabMsgs.style.display = tab === 'msgs' ? 'flex' : 'none';
  if (tabInfo) tabInfo.style.display = tab === 'info' ? 'block' : 'none';
}

function closeCliModal() {
  const ov = document.getElementById('cli-modal-overlay');
  if (!ov) return;
  ov.classList.remove('open');
  setTimeout(() => {
    ov.style.display = 'none';
    _cliCurrentChamado = null;
  }, 250);
}

function closeCliModalIfOutside(e) {
  if (e.target === document.getElementById('cli-modal-overlay')) closeCliModal();
}
