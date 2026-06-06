/**
 * utils.js — Formatação, helpers, modal de confirmação
 */

// ─── Formatação ───────────────────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDateShort(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function timeAgo(d) {
  if (!d) return '—';
  const diff = Date.now() - new Date(d);
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'agora';
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const days = Math.floor(h / 24);
  return `${days}d atrás`;
}

function escHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/\n/g,'<br>');
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    Notif.toast(`Copiado: ${text}`, 'success', { title: 'Copiado', duration: 2000 });
  });
}

// ─── SLA helpers ─────────────────────────────────────────────────────────────
function getSlaInfo(chamado) {
  const now = new Date();
  if (!chamado.data_vencimento_sla) return { label: '—', color: '#4e546a', percent: 0, expired: false };
  if (['Resolvido','Cancelado'].includes(chamado.status)) return { label: '—', color: '#4e546a', percent: 100, expired: false };

  const open = new Date(chamado.data_abertura);
  const due  = new Date(chamado.data_vencimento_sla);
  const diff = due - now;
  const total = due - open;
  const pct  = Math.min(100, Math.max(0, ((now - open) / total) * 100));

  if (diff < 0) {
    const overH = Math.abs(Math.floor(diff / 3600000));
    return { label: `${overH}h atrasado`, color: '#f05b5b', percent: 100, expired: true };
  }
  const h = Math.floor(diff / 3600000);
  const color = h < 2 ? '#f05b5b' : h < 8 ? '#f0b429' : '#34c77b';
  const label = h < 1 ? `${Math.floor(diff/60000)}min` : `${h}h restantes`;
  return { label, color, percent: pct, expired: false };
}

// ─── Badge builders ───────────────────────────────────────────────────────────
function statusBadge(status) {
  const m = STATUS_META[status] || { cls: 'badge-cancelado', icon: 'xCircle' };
  return `<span class="badge ${m.cls}">${Icons.get(m.icon, 11)} ${status || '—'}</span>`;
}

function prioBadge(prioId) {
  const m = PRIO_META[prioId];
  if (!m) return '<span class="prio-badge">—</span>';
  return `<span class="prio-badge prio-${prioId}"><span class="prio-dot" style="background:${m.dotColor}"></span>${m.label}</span>`;
}

// ─── Confirm modal ────────────────────────────────────────────────────────────
const Modal = {
  _resolve: null,

  confirm(title, message, opts = {}) {
    return new Promise(resolve => {
      this._resolve = resolve;
      const el = document.getElementById('confirm-modal');
      document.getElementById('confirm-title').textContent   = title;
      document.getElementById('confirm-message').textContent = message;
      const okBtn = document.getElementById('confirm-ok');
      okBtn.textContent = opts.confirmLabel || 'Confirmar';
      okBtn.className   = `btn ${opts.confirmClass || 'btn-primary'}`;
      el.style.display = 'flex';
      requestAnimationFrame(() => el.classList.add('open'));
    });
  },

  close(result) {
    const el = document.getElementById('confirm-modal');
    el.classList.remove('open');
    setTimeout(() => { el.style.display = 'none'; }, 250);
    if (this._resolve) { this._resolve(result); this._resolve = null; }
  }
};
