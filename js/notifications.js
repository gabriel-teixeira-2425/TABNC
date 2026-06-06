/**
 * notifications.js — Sistema de notificações (toast + painel)
 *
 * API pública:
 *   Notif.toast(msg, type, opts)   — exibe toast flutuante
 *   Notif.push(msg, type, opts)    — adiciona ao painel de notificações
 *   Notif.notify(msg, type, opts)  — toast + painel simultaneamente
 *   Notif.clearAll()
 *   Notif.renderPanel()
 */
const Notif = (() => {
  /* ── tipos ───────────────────────────────────────────────────────────────── */
  const TYPE_CFG = {
    success: { icon: 'checkCircle', accent: '#34c77b', label: 'Sucesso'     },
    error:   { icon: 'xCircle',     accent: '#f05b5b', label: 'Erro'        },
    warning: { icon: 'warning',     accent: '#f0b429', label: 'Atenção'     },
    info:    { icon: 'infoCircle',  accent: '#5b8ef0', label: 'Informação'  },
    ticket:  { icon: 'ticket',      accent: '#9b5bf0', label: 'Chamado'     },
  };

  let _list    = [];   // histórico
  let _unread  = 0;
  const MAX    = 50;

  /* ── helpers ─────────────────────────────────────────────────────────────── */
  function _cfg(type) { return TYPE_CFG[type] || TYPE_CFG.info; }

  function _updateBell() {
    const btn = document.getElementById('notif-bell-btn');
    const dot = document.getElementById('notif-bell-dot');
    if (!btn) return;
    if (_unread > 0) {
      dot.style.display = 'flex';
      dot.textContent = _unread > 9 ? '9+' : _unread;
    } else {
      dot.style.display = 'none';
    }
  }

  function _ts() {
    return new Date().toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
  }

  /* ── TOAST ───────────────────────────────────────────────────────────────── */
  function toast(msg, type = 'info', opts = {}) {
    const cfg = _cfg(type);
    const container = document.getElementById('toast-container');
    if (!container) return;

    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.style.setProperty('--t-accent', cfg.accent);

    const title = opts.title || cfg.label;
    const hasAction = opts.action && opts.actionLabel;

    el.innerHTML = `
      <div class="toast-icon">${Icons.get(cfg.icon, 18)}</div>
      <div class="toast-body">
        <div class="toast-title">${title}</div>
        <div class="toast-msg">${msg}</div>
        ${hasAction ? `<button class="toast-action" onclick="(${opts.action})()">${opts.actionLabel}</button>` : ''}
      </div>
      <button class="toast-close" onclick="this.closest('.toast').remove()">${Icons.get('x', 14)}</button>
      <div class="toast-bar"></div>
    `;

    container.appendChild(el);

    // animate in
    requestAnimationFrame(() => el.classList.add('toast-visible'));

    const duration = opts.duration ?? 4500;
    const bar = el.querySelector('.toast-bar');
    if (bar) bar.style.animationDuration = duration + 'ms';

    const timer = setTimeout(() => _dismiss(el), duration);
    el.addEventListener('mouseenter', () => clearTimeout(timer));
    el.addEventListener('mouseleave', () => setTimeout(() => _dismiss(el), 1500));
  }

  function _dismiss(el) {
    el.classList.remove('toast-visible');
    el.classList.add('toast-exit');
    setTimeout(() => el.remove(), 350);
  }

  /* ── PANEL PUSH ──────────────────────────────────────────────────────────── */
  function push(msg, type = 'info', opts = {}) {
    const cfg = _cfg(type);
    const item = {
      id:      Date.now() + Math.random(),
      msg,
      type,
      title:   opts.title || cfg.label,
      time:    _ts(),
      read:    false,
      href:    opts.href || null,
      chamadoId: opts.chamadoId || null,
    };
    _list.unshift(item);
    if (_list.length > MAX) _list.pop();
    _unread++;
    AppState.notifications = _list;
    AppState.notifUnread   = _unread;
    _updateBell();
    renderPanel();
  }

  /* ── NOTIFY (toast + panel) ──────────────────────────────────────────────── */
  function notify(msg, type = 'info', opts = {}) {
    toast(msg, type, opts);
    push(msg, type, opts);
  }

  /* ── MARK READ ───────────────────────────────────────────────────────────── */
  function markAllRead() {
    _list.forEach(n => { n.read = true; });
    _unread = 0;
    AppState.notifUnread = 0;
    _updateBell();
    renderPanel();
  }

  function clearAll() {
    _list = [];
    _unread = 0;
    AppState.notifications = [];
    AppState.notifUnread   = 0;
    _updateBell();
    renderPanel();
  }

  /* ── RENDER PANEL ────────────────────────────────────────────────────────── */
  function renderPanel() {
    const el = document.getElementById('notif-panel-list');
    if (!el) return;

    if (!_list.length) {
      el.innerHTML = `
        <div class="notif-empty">
          ${Icons.get('bell', 28)}
          <p>Nenhuma notificação</p>
        </div>`;
      return;
    }

    el.innerHTML = _list.map(n => {
      const cfg = _cfg(n.type);
      const action = n.chamadoId
        ? `onclick="Notif.closePanel(); openChamado('${n.chamadoId}')"`
        : '';
      return `
        <div class="notif-item ${n.read ? 'read' : 'unread'}" ${action} style="--ni-accent:${cfg.accent}">
          <div class="notif-item-icon">${Icons.get(cfg.icon, 16)}</div>
          <div class="notif-item-body">
            <div class="notif-item-title">${n.title}</div>
            <div class="notif-item-msg">${n.msg}</div>
            <div class="notif-item-time">${n.time}</div>
          </div>
          ${!n.read ? '<div class="notif-unread-dot"></div>' : ''}
        </div>`;
    }).join('');
  }

  /* ── PANEL TOGGLE ────────────────────────────────────────────────────────── */
  function togglePanel() {
    const panel = document.getElementById('notif-panel');
    const open  = panel.classList.toggle('open');
    if (open) {
      markAllRead();
      renderPanel();
    }
  }

  function closePanel() {
    document.getElementById('notif-panel')?.classList.remove('open');
  }

  // close panel when clicking outside
  document.addEventListener('click', e => {
    const wrap = document.getElementById('notif-wrap');
    if (wrap && !wrap.contains(e.target)) closePanel();
  });

  return { toast, push, notify, markAllRead, clearAll, renderPanel, togglePanel, closePanel };
})();
