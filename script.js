/**
 * script.js — UI Router & Event Handlers
 * Uganda Biodiversity Fund (UBF) Logistics & Procurement System v2.0
 *
 * PAGES HANDLED:
 *   index.html          — Password login + forced password change
 *   dashboard.html      — Role-based dashboard
 *   form.html           — Request for Services/Goods
 *   travel-plan.html    — Travel Business Plan
 *   accountability.html — Advance Accountability & Expense Report
 *   history.html        — Full audit history
 */

(function (global) {
  'use strict';

  if (!global.DataService) {
    console.error('script.js: DataService not found. Ensure data.js loads before script.js.');
    return;
  }

  var DS = global.DataService;

  /* ─────────────────────────────────────────────
     UTILITIES
  ───────────────────────────────────────────── */
  function $id(id) { return document.getElementById(id); }

  function showBanner(msg, type) {
    var id     = type === 'error' ? 'global-error-banner' : 'global-success-banner';
    var banner = $id(id);
    if (!banner) { alert(msg); return; }
    banner.textContent   = msg;
    banner.style.display = 'block';
    if (type === 'success') {
      setTimeout(function () { banner.style.display = 'none'; }, 7000);
    }
  }

  function hideBanners() {
    ['global-error-banner', 'global-success-banner'].forEach(function (id) {
      var el = $id(id);
      if (el) el.style.display = 'none';
    });
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
    } catch (_) { return iso; }
  }

  function formatDateTime(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch (_) { return iso; }
  }

  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function statusClass(status) {
    var map = {
      'pending'  : 'status-pending',
      'prepared' : 'status-inreview',
      'reviewed' : 'status-inreview',
      'cleared'  : 'status-inreview',
      'approved' : 'status-approved',
      'rejected' : 'status-rejected'
    };
    return map[(status || '').toLowerCase()] || 'status-pending';
  }

  function navigateTo(page) {
    var base = global.location.pathname;
    var dir  = base.substring(0, base.lastIndexOf('/') + 1);
    global.location.href = dir + page;
  }

  function enforceAuth() {
    if (!DS.isAuthenticated()) { navigateTo('index.html'); return false; }
    return true;
  }

  function getFieldValue(id) {
    var el = $id(id);
    return el && el.value ? el.value.trim() : '';
  }

  function setLoading(btnId, loadingId, on, originalText) {
    var btn  = $id(btnId);
    var spin = $id(loadingId);
    if (btn)  { btn.disabled = on; if (on) { btn.setAttribute('data-orig', btn.textContent); btn.textContent = 'Saving…'; } else { btn.textContent = originalText || btn.getAttribute('data-orig') || 'Submit'; } }
    if (spin) spin.style.display = on ? 'block' : 'none';
  }

  /* ─────────────────────────────────────────────
     NAVBAR
  ───────────────────────────────────────────── */
  function populateNavbar() {
    try {
      var session = DS.getSession();
      if (!session) return;
      var nameEl  = $id('nav-user-name');
      var roleEl  = $id('nav-user-role');
      if (nameEl) nameEl.textContent = session.name || session.email;
      if (roleEl) {
        roleEl.textContent = session.role;
        roleEl.className   = 'role-badge role-' + session.role.toLowerCase().replace(/\s+/g, '-');
      }
    } catch (_) {}
  }

  function attachLogoutHandler() {
    var btn = $id('btn-logout');
    if (btn) btn.addEventListener('click', function () {
      DS.clearSession();
      navigateTo('index.html');
    });
  }

  /* ─────────────────────────────────────────────
     MODAL
  ───────────────────────────────────────────── */
  function openModal(htmlContent) {
    var overlay = $id('modal-overlay');
    var content = $id('modal-content');
    if (!overlay || !content) return;
    content.innerHTML        = htmlContent;
    overlay.style.display    = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    var overlay = $id('modal-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  function attachModalHandlers() {
    var btn     = $id('btn-modal-close');
    var overlay = $id('modal-overlay');
    if (btn)     btn.addEventListener('click', closeModal);
    if (overlay) overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
  }

  /* ─────────────────────────────────────────────
     BUILD DETAIL MODAL HTML
  ───────────────────────────────────────────── */
  function buildDetailModal(rec) {
    var session = DS.getSession();

    /* Approval chain */
    var approvalHtml =
      '<table class="detail-table">' +
        '<tr><th>Submitted by</th><td>' + esc(rec.submittedByName) + ' — ' + esc(rec.submittedByTitle) + ' on ' + formatDate(rec.createdAt) + '</td></tr>' +
        '<tr><th>Prepared by</th><td>'  + ((rec.approval && rec.approval.preparation && rec.approval.preparation.byName) ? esc(rec.approval.preparation.byName) + ' on ' + formatDate(rec.approval.preparation.at) + (rec.approval.preparation.note ? ' — ' + esc(rec.approval.preparation.note) : '') : '<em>Pending</em>') + '</td></tr>' +
        '<tr><th>Reviewed by</th><td>'  + ((rec.approval && rec.approval.review && rec.approval.review.byName)       ? esc(rec.approval.review.byName) + ' on ' + formatDate(rec.approval.review.at) + (rec.approval.review.note ? ' — ' + esc(rec.approval.review.note) : '')             : '<em>Pending</em>') + '</td></tr>' +
        '<tr><th>Cleared by</th><td>'   + ((rec.approval && rec.approval.clearance && rec.approval.clearance.byName) ? esc(rec.approval.clearance.byName) + ' on ' + formatDate(rec.approval.clearance.at) + (rec.approval.clearance.note ? ' — ' + esc(rec.approval.clearance.note) : '') : '<em>Pending</em>') + '</td></tr>' +
        '<tr><th>Approved by</th><td>'  + ((rec.approval && rec.approval.approval && rec.approval.approval.byName)   ? esc(rec.approval.approval.byName) + ' on ' + formatDate(rec.approval.approval.at) + (rec.approval.approval.note ? ' — ' + esc(rec.approval.approval.note) : '')     : '<em>Pending</em>') + '</td></tr>' +
      '</table>';

    /* Form data fields */
    var dataHtml = '';
    if (rec.data) {
      dataHtml = '<table class="detail-table">' +
        Object.keys(rec.data).map(function (k) {
          return '<tr><th>' + esc(k) + '</th><td>' + esc(rec.data[k]) + '</td></tr>';
        }).join('') +
      '</table>';
    }

    /* Attachments */
    var attachHtml = rec.attachments && rec.attachments.length > 0
      ? '<ul class="attachment-list">' + rec.attachments.map(function (a) {
          return '<li><a href="' + esc(a.downloadUrl) + '" target="_blank" rel="noopener">📎 ' + esc(a.name) + '</a></li>';
        }).join('') + '</ul>'
      : '<p class="text-muted">No attachments.</p>';

    /* Comments */
    var commentsHtml = buildCommentsHtml(rec, session);

    /* Audit history */
    var historyHtml = rec.history && rec.history.length
      ? '<ol class="history-list">' + rec.history.map(function (h) {
          return '<li><strong>' + esc(h.action) + '</strong> by ' + esc(h.byName || h.by) +
                 ' on ' + formatDateTime(h.at) + (h.note ? ' — ' + esc(h.note) : '') + '</li>';
        }).join('') + '</ol>'
      : '<p class="text-muted">No history.</p>';

    /* Can edit button */
    var canEdit = session && rec.submittedBy === session.email &&
                  (rec.status === 'Pending' || rec.status === 'Rejected');
    var editBtn = canEdit
      ? '<a href="form.html?edit=' + esc(rec.id) + '" class="btn btn-secondary btn-sm" style="margin-right:0.5rem;">✏️ Edit &amp; Resubmit</a>'
      : '';

    return (
      '<h2 class="modal-title">' + esc(rec.id) + ' — <span class="status-badge ' + statusClass(rec.status) + '">' + esc(rec.status) + '</span></h2>' +
      '<div style="margin-bottom:0.75rem;">' + editBtn + '</div>' +
      '<div class="modal-grid">' +
        '<div class="modal-section"><h3>Form Data</h3>' + dataHtml + '</div>' +
        '<div class="modal-section"><h3>Approval Chain</h3>' + approvalHtml + '</div>' +
      '</div>' +
      '<div class="modal-section"><h3>Attachments</h3>' + attachHtml + '</div>' +
      '<div class="modal-section"><h3>Comments</h3>' + commentsHtml + '</div>' +
      '<div class="modal-section"><h3>Audit History</h3>' + historyHtml + '</div>'
    );
  }

  /* ─────────────────────────────────────────────
     COMMENTS HTML
  ───────────────────────────────────────────── */
  function buildCommentsHtml(rec, session) {
    var comments = rec.comments || [];
    var html = '';

    if (comments.length === 0) {
      html += '<p class="text-muted" style="margin-bottom:0.75rem;">No comments yet.</p>';
    } else {
      html += '<div class="comments-list">' +
        comments.map(function (c) {
          var repliesHtml = (c.replies || []).map(function (r) {
            return '<div class="comment-reply">' +
              '<strong>' + esc(r.byName || r.by) + '</strong> <span class="text-muted">(' + esc(r.byRole) + ')</span> ' +
              '<span class="text-muted">' + formatDateTime(r.at) + '</span>' +
              '<p style="margin:0.3rem 0 0;">' + esc(r.text) + '</p>' +
            '</div>';
          }).join('');

          return '<div class="comment-item" data-comment-id="' + esc(c.id) + '">' +
            '<div class="comment-header">' +
              '<strong>' + esc(c.byName || c.by) + '</strong> ' +
              '<span class="role-badge role-' + (c.byRole || '').toLowerCase().replace(/\s+/g,'–') + '" style="font-size:0.65rem;">' + esc(c.byRole) + '</span> ' +
              '<span class="text-muted" style="font-size:0.78rem;">' + formatDateTime(c.at) + '</span>' +
            '</div>' +
            '<p style="margin:0.35rem 0 0.5rem;">' + esc(c.text) + '</p>' +
            (repliesHtml ? '<div class="replies-container" style="margin-left:1.5rem;">' + repliesHtml + '</div>' : '') +
            '<button class="btn-reply-toggle btn-action btn-review" data-comment-id="' + esc(c.id) + '" style="font-size:0.72rem;margin-top:0.35rem;">↩ Reply</button>' +
            '<div class="reply-input-area" id="reply-area-' + esc(c.id) + '" style="display:none;margin-top:0.5rem;">' +
              '<textarea id="reply-text-' + esc(c.id) + '" rows="2" style="width:100%;padding:0.4rem;border:1px solid var(--gray-300);border-radius:4px;font-family:var(--font-body);font-size:0.85rem;" placeholder="Write a reply…"></textarea>' +
              '<button class="btn-submit-reply btn btn-primary btn-sm" data-req-id="' + esc(rec.id) + '" data-comment-id="' + esc(c.id) + '" style="margin-top:0.4rem;">Post Reply</button>' +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>';
    }

    /* Add comment box */
    html +=
      '<div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--gray-200);">' +
        '<textarea id="new-comment-text" rows="3" ' +
          'style="width:100%;padding:0.5rem;border:1.5px solid var(--gray-300);border-radius:var(--radius-sm);' +
          'font-family:var(--font-body);font-size:0.875rem;resize:vertical;" ' +
          'placeholder="Add a comment on this requisition…"></textarea>' +
        '<button class="btn btn-primary btn-sm btn-post-comment" data-req-id="' + esc(rec.id) + '" style="margin-top:0.5rem;">Post Comment</button>' +
      '</div>';

    return html;
  }

  /* ─────────────────────────────────────────────
     COMMENT / REPLY EVENT DELEGATION
  ───────────────────────────────────────────── */
  function attachCommentHandlers(allRecords) {
    var overlay = $id('modal-overlay');
    if (!overlay) return;

    overlay.addEventListener('click', async function (evt) {
      /* Toggle reply area */
      if (evt.target.classList.contains('btn-reply-toggle')) {
        var cid  = evt.target.getAttribute('data-comment-id');
        var area = $id('reply-area-' + cid);
        if (area) area.style.display = area.style.display === 'none' ? 'block' : 'none';
        return;
      }

      /* Submit reply */
      if (evt.target.classList.contains('btn-submit-reply')) {
        var reqId = evt.target.getAttribute('data-req-id');
        var cId   = evt.target.getAttribute('data-comment-id');
        var text  = ($id('reply-text-' + cId) || {}).value || '';
        if (!text.trim()) { alert('Please write a reply first.'); return; }
        evt.target.disabled    = true;
        evt.target.textContent = 'Posting…';
        try {
          await DS.addReply(reqId, cId, text.trim());
          /* Refresh modal */
          var updatedRecords = await DS.getAllRequisitions();
          var updatedRec     = updatedRecords.find(function (r) { return r.id === reqId; });
          if (updatedRec) openModal(buildDetailModal(updatedRec));
        } catch (err) {
          alert('Failed to post reply: ' + err.message);
          evt.target.disabled    = false;
          evt.target.textContent = 'Post Reply';
        }
        return;
      }

      /* Post comment */
      if (evt.target.classList.contains('btn-post-comment')) {
        var reqId = evt.target.getAttribute('data-req-id');
        var text  = ($id('new-comment-text') || {}).value || '';
        if (!text.trim()) { alert('Please write a comment first.'); return; }
        evt.target.disabled    = true;
        evt.target.textContent = 'Posting…';
        try {
          await DS.addComment(reqId, text.trim());
          var updatedRecords = await DS.getAllRequisitions();
          var updatedRec     = updatedRecords.find(function (r) { return r.id === reqId; });
          if (updatedRec) openModal(buildDetailModal(updatedRec));
        } catch (err) {
          alert('Failed to post comment: ' + err.message);
          evt.target.disabled    = false;
          evt.target.textContent = 'Post Comment';
        }
      }
    });
  }

  /* ═══════════════════════════════════════════
     LOGIN PAGE
  ═══════════════════════════════════════════ */
  function initLoginPage() {
    if (!$id('login-form')) return;
    if (DS.isAuthenticated()) { navigateTo('dashboard.html'); return; }

    var form          = $id('login-form');
    var changePanel   = $id('change-password-panel');
    var emailInput    = $id('input-email');
    var passInput     = $id('input-password');
    var errorEl       = $id('login-error');
    var toggleBtn     = $id('btn-toggle-password');
    var forgotLink    = $id('forgot-password-link');
    var btnLogin      = $id('btn-login');

    /* Pending auth state for password change */
    var _pendingUser = null;

    function setError(msg) {
      if (errorEl) { errorEl.textContent = msg; errorEl.style.display = msg ? 'block' : 'none'; }
    }

    /* Toggle password visibility */
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        var type = passInput.type === 'password' ? 'text' : 'password';
        passInput.type          = type;
        toggleBtn.textContent   = type === 'password' ? '👁' : '🙈';
      });
    }

    /* Forgot password */
    if (forgotLink) {
      forgotLink.addEventListener('click', function () {
        alert('Please contact the system administrator:\nt.otieno@ugandabiodiversityfund.org\nto reset your password.');
      });
    }

    /* Main login */
    form.addEventListener('submit', async function (evt) {
      evt.preventDefault();
      setError('');

      var email    = emailInput ? emailInput.value.trim().toLowerCase() : '';
      var password = passInput  ? passInput.value                        : '';

      if (!email)    { setError('Please enter your UBF work email.');   return; }
      if (!password) { setError('Please enter your password.');          return; }

      if (btnLogin) { btnLogin.disabled = true; btnLogin.textContent = 'Verifying…'; }

      try {
        var result = await DS.authenticateUser(email, password);
        var user   = result.user;

        /* Check password expiry */
        var expired = DS.isPasswordExpired(user.passwordExpiry);

        if (user.mustChangePassword || expired) {
          /* Show change password panel */
          _pendingUser                  = user;
          form.style.display            = 'none';
          changePanel.style.display     = 'block';
          if (btnLogin) { btnLogin.disabled = false; btnLogin.textContent = 'Log In'; }
          return;
        }

        /* All good — save session and go to dashboard */
        DS.saveSession(user);
        navigateTo('dashboard.html');

      } catch (err) {
        setError(err.message || 'Login failed. Please try again.');
        if (btnLogin) { btnLogin.disabled = false; btnLogin.textContent = 'Log In'; }
      }
    });

    /* Set new password */
    var btnSetPass = $id('btn-set-password');
    var btnCancel  = $id('btn-cancel-change');

    if (btnCancel) {
      btnCancel.addEventListener('click', function () {
        _pendingUser               = null;
        form.style.display         = 'block';
        changePanel.style.display  = 'none';
      });
    }

    if (btnSetPass) {
      btnSetPass.addEventListener('click', async function () {
        var newPass  = ($id('input-new-password')     || {}).value || '';
        var confPass = ($id('input-confirm-password') || {}).value || '';

        if (newPass.length < 8) {
          alert('Password must be at least 8 characters.'); return;
        }
        if (newPass !== confPass) {
          alert('Passwords do not match.'); return;
        }

        btnSetPass.disabled    = true;
        btnSetPass.textContent = 'Saving…';

        try {
          await DS.changePassword(_pendingUser.email, newPass);
          /* Re-authenticate with new password to get fresh user object */
          var result = await DS.authenticateUser(_pendingUser.email, newPass);
          DS.saveSession(result.user);
          navigateTo('dashboard.html');
        } catch (err) {
          alert('Failed to set password: ' + err.message);
          btnSetPass.disabled    = false;
          btnSetPass.textContent = 'Set Password & Log In';
        }
      });
    }
  }

  /* ═══════════════════════════════════════════
     DASHBOARD PAGE
  ═══════════════════════════════════════════ */
  var _dashboardRecords = [];

  function renderStats(stats) {
    var map = {
      'stat-total'   : stats.total,
      'stat-pending' : stats.pending,
      'stat-prepared': stats.prepared,
      'stat-reviewed': stats.reviewed,
      'stat-cleared' : stats.cleared,
      'stat-approved': stats.approved,
      'stat-rejected': stats.rejected
    };
    Object.keys(map).forEach(function (id) {
      var el = $id(id);
      if (el) el.textContent = map[id] !== undefined ? map[id] : '0';
    });
  }

  function buildActionButtons(rec, session) {
    var role      = session.role;
    var canAction = DS.canActionRequisition(role, rec.status);
    var html      = '';

    if (canAction) {
      var nextStatus  = DS.getNextStatus(role, rec.status);
      var actionLabel = DS.getActionLabel(role, rec.status);
      html +=
        '<button class="btn-action btn-approve" data-id="' + esc(rec.id) + '" data-action="' + esc(nextStatus) + '">' + esc(actionLabel) + '</button> ' +
        '<button class="btn-action btn-reject"  data-id="' + esc(rec.id) + '" data-action="Rejected">Reject</button>';
    }

    /* Edit button for own Pending/Rejected */
    var canEdit = rec.submittedBy === session.email &&
                  (rec.status === 'Pending' || rec.status === 'Rejected');
    if (canEdit) {
      html += ' <a href="form.html?edit=' + esc(rec.id) + '" class="btn-action btn-review">✏️ Edit</a>';
    }

    return html || '<span class="text-muted">—</span>';
  }

  function buildDashboardRow(rec, session) {
    var formTypeBadge = rec.formType && rec.formType !== 'request'
      ? '<span style="font-size:0.65rem;background:var(--ubf-blue-light);color:var(--ubf-blue-darker);padding:0.1rem 0.4rem;border-radius:3px;margin-left:4px;">' + esc(rec.formType) + '</span>'
      : '';
    return (
      '<tr>' +
        '<td><a href="#" class="link-req-detail" data-id="' + esc(rec.id) + '">' + esc(rec.id) + '</a>' + formTypeBadge + '</td>' +
        '<td>' + esc((rec.data && rec.data.description) || rec.id) + '</td>' +
        '<td>' + esc(rec.submittedByName || rec.submittedBy) + '</td>' +
        '<td>' + formatDate(rec.createdAt) + '</td>' +
        '<td><span class="status-badge ' + statusClass(rec.status) + '">' + esc(rec.status) + '</span></td>' +
        '<td>' + buildActionButtons(rec, session) + '</td>' +
      '</tr>'
    );
  }

  function renderDashboardTable(records) {
    var tbody   = $id('dashboard-table-body');
    var emptyEl = $id('dashboard-empty');
    if (!tbody) return;
    var session = DS.getSession();
    if (!records || records.length === 0) {
      tbody.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    tbody.innerHTML = records.map(function (r) { return buildDashboardRow(r, session); }).join('');
  }

  function applyDashboardFilters() {
    var statusVal = ($id('filter-status') || {}).value || '';
    var searchVal = (($id('filter-search') || {}).value || '').toLowerCase();
    var filtered  = _dashboardRecords.filter(function (r) {
      var desc = (r.data && r.data.description) || r.id || '';
      var matchStatus = !statusVal || r.status === statusVal;
      var matchSearch = !searchVal ||
        (r.id || '').toLowerCase().indexOf(searchVal) !== -1 ||
        desc.toLowerCase().indexOf(searchVal) !== -1 ||
        (r.submittedByName || '').toLowerCase().indexOf(searchVal) !== -1;
      return matchStatus && matchSearch;
    });
    renderDashboardTable(filtered);
  }

  async function initDashboardPage() {
    if (!$id('dashboard-container')) return;
    if (!enforceAuth()) return;
    populateNavbar();
    attachLogoutHandler();
    attachModalHandlers();
    attachCommentHandlers();

    var loadingEl = $id('dashboard-loading');
    if (loadingEl) loadingEl.style.display = 'block';

    try {
      var records = await DS.getAllRequisitions();
      var stats   = await DS.getDashboardStats();
      _dashboardRecords = records;
      renderStats(stats);
      renderDashboardTable(records);
    } catch (err) {
      showBanner(err.message || 'Failed to load dashboard.', 'error');
    } finally {
      if (loadingEl) loadingEl.style.display = 'none';
    }

    var fs = $id('filter-status');
    var fq = $id('filter-search');
    if (fs) fs.addEventListener('change', applyDashboardFilters);
    if (fq) fq.addEventListener('input',  applyDashboardFilters);

    var tbody = $id('dashboard-table-body');
    if (tbody) {
      tbody.addEventListener('click', async function (evt) {
        var target = evt.target;

        /* Detail link */
        if (target.classList.contains('link-req-detail')) {
          evt.preventDefault();
          var rec = _dashboardRecords.find(function (r) { return r.id === target.getAttribute('data-id'); });
          if (rec) openModal(buildDetailModal(rec));
          return;
        }

        /* Action button */
        if (target.classList.contains('btn-action') && target.getAttribute('data-action')) {
          var id     = target.getAttribute('data-id');
          var action = target.getAttribute('data-action');
          if (!id || !action) return;

          var note = '';
          if (action === 'Rejected') {
            note = prompt('Reason for rejection (will be visible in history):') || '';
            if (note === null) return; /* user cancelled */
          }

          target.disabled    = true;
          target.textContent = 'Saving…';

          try {
            await DS.updateRequisitionStatus(id, action, note);
            showBanner('Requisition ' + id + ' updated to "' + action + '".', 'success');
            var updated = await DS.getAllRequisitions();
            var stats   = await DS.getDashboardStats();
            _dashboardRecords = updated;
            renderStats(stats);
            applyDashboardFilters();
          } catch (err) {
            showBanner(err.message || 'Failed to update.', 'error');
            target.disabled    = false;
            target.textContent = action;
          }
        }
      });
    }
  }

  /* ═══════════════════════════════════════════
     REQUEST FORM PAGE (form.html)
  ═══════════════════════════════════════════ */
  async function initFormPage() {
    if (!$id('requisition-form')) return;
    if (!enforceAuth()) return;
    populateNavbar();
    attachLogoutHandler();

    var session = DS.getSession();

    /* Pre-fill submitter */
    var nameEl  = $id('form-submitter-name');
    var titleEl = $id('form-submitter-title');
    if (nameEl)  nameEl.textContent  = session.name;
    if (titleEl) titleEl.textContent = session.title;

    /* Check for edit mode: ?edit=UBF-xxx */
    var editId   = null;
    var editData = null;
    var params   = new URLSearchParams(global.location.search);
    if (params.has('edit')) {
      editId = params.get('edit');
      try {
        var db  = await DS.readDatabase();
        editData = db.records.find(function (r) { return r.id === editId; });
        if (editData && editData.data) {
          /* Populate fields with existing data */
          Object.keys(editData.data).forEach(function (key) {
            var el = document.querySelector('[name="' + key + '"]');
            if (el) el.value = editData.data[key] || '';
          });
          /* Update page title */
          var ph = document.querySelector('.page-header h1');
          if (ph) ph.textContent = 'Edit Requisition — ' + editId;
          var btn = $id('btn-submit-requisition');
          if (btn) btn.textContent = 'Save Changes & Resubmit';
        }
      } catch (err) {
        showBanner('Could not load requisition for editing: ' + err.message, 'error');
      }
    }

    /* File info display */
    var attachInput = $id('form-attachments');
    if (attachInput) {
      attachInput.addEventListener('change', function () {
        var files  = Array.from(attachInput.files || []);
        var infoEl = $id('form-attachment-info');
        if (infoEl) infoEl.textContent = files.length > 0 ? files.length + ' file(s) selected' : '';
      });
    }

    var form    = $id('requisition-form');
    var btnSub  = $id('btn-submit-requisition');
    var loading = $id('form-loading');

    form.addEventListener('submit', async function (evt) {
      evt.preventDefault();
      hideBanners();

      var formData = {
        activityCode   : getFieldValue('form-activity-code'),
        description    : getFieldValue('form-description'),
        specification  : getFieldValue('form-specification'),
        quantity       : getFieldValue('form-quantity'),
        dateRequired   : getFieldValue('form-date-required'),
        locationOfWork : getFieldValue('form-location'),
        contractPeriod : getFieldValue('form-contract-period'),
        accountCode    : getFieldValue('form-account-code'),
        accountName    : getFieldValue('form-account-name'),
        donorCode      : getFieldValue('form-donor-code'),
        donorName      : getFieldValue('form-donor-name'),
        department     : getFieldValue('form-department'),
        budgetCode     : getFieldValue('form-budget-code')
      };

      if (!formData.description)   { showBanner('Please enter a description.', 'error'); return; }
      if (!formData.specification) { showBanner('Please enter the specification of goods/services.', 'error'); return; }
      if (!formData.quantity || isNaN(parseFloat(formData.quantity)) || parseFloat(formData.quantity) <= 0) {
        showBanner('Please enter a valid quantity.', 'error'); return;
      }

      if (btnSub)  { btnSub.disabled = true; btnSub.textContent = 'Submitting…'; }
      if (loading) loading.style.display = 'block';

      try {
        var files = attachInput ? attachInput.files : null;
        var rec;

        if (editId && editData) {
          rec = await DS.editRequisition(editId, formData, files);
          showBanner('Requisition ' + rec.id + ' updated and resubmitted. Now Pending Review.', 'success');
        } else {
          rec = await DS.submitRequisition(formData, files, 'request');
          showBanner('Requisition ' + rec.id + ' submitted. Now Pending Review by Susan Abonyo.', 'success');
        }

        form.reset();
        setTimeout(function () { navigateTo('dashboard.html'); }, 3000);

      } catch (err) {
        showBanner(err.message || 'Submission failed. Please try again.', 'error');
      } finally {
        if (btnSub)  { btnSub.disabled = false; btnSub.textContent = editId ? 'Save Changes & Resubmit' : 'Submit Requisition'; }
        if (loading) loading.style.display = 'none';
      }
    });
  }

  /* ═══════════════════════════════════════════
     TRAVEL PLAN PAGE
  ═══════════════════════════════════════════ */
  async function initTravelPlanPage() {
    if (!$id('travel-form')) return;
    if (!enforceAuth()) return;
    populateNavbar();
    attachLogoutHandler();

    var session = DS.getSession();
    var nameEl  = $id('t-traveller-name');
    var posEl   = $id('t-position');
    if (nameEl) nameEl.value = session.name;
    if (posEl)  posEl.value  = session.title;

    /* Set today as default request date */
    var reqDate = $id('t-request-date');
    if (reqDate) reqDate.value = new Date().toISOString().split('T')[0];

    var attachInput = $id('travel-attachments');
    if (attachInput) {
      attachInput.addEventListener('change', function () {
        var infoEl = $id('travel-attachment-info');
        if (infoEl) infoEl.textContent = attachInput.files.length + ' file(s) selected';
      });
    }

    var form    = $id('travel-form');
    var loading = $id('travel-loading');
    var btnSub  = $id('btn-submit-travel');

    form.addEventListener('submit', async function (evt) {
      evt.preventDefault();
      hideBanners();

      /* Collect route rows */
      var routes = [];
      document.querySelectorAll('#route-table-body tr').forEach(function (row, idx) {
        var route = row.querySelector('[data-col="route"]');
        if (route && route.value.trim()) {
          routes.push({
            route        : route.value.trim(),
            date         : (row.querySelector('[data-col="date"]')          || {}).value || '',
            perDiem      : (row.querySelector('[data-col="perDiem"]')       || {}).value || '',
            accommodation: (row.querySelector('[data-col="accommodation"]') || {}).value || '',
            sda          : (row.querySelector('[data-col="sda"]')           || {}).value || '',
            others       : (row.querySelector('[data-col="others"]')        || {}).value || '',
            total        : (row.querySelector('[data-col="total"]')         || {}).value || ''
          });
        }
      });

      var formData = {
        travellerName  : getFieldValue('t-traveller-name'),
        position       : getFieldValue('t-position'),
        requestDate    : getFieldValue('t-request-date'),
        staffNumber    : getFieldValue('t-staff-number'),
        departureDate  : getFieldValue('t-departure-date'),
        returnDate     : getFieldValue('t-return-date'),
        totalDays      : getFieldValue('t-total-days'),
        businessNights : getFieldValue('t-business-nights'),
        businessReason : getFieldValue('t-business-reason'),
        totalPerDiem   : getFieldValue('t-total-per-diem'),
        totalAccommodation: getFieldValue('t-total-accommodation'),
        totalSDA       : getFieldValue('t-total-sda'),
        totalOthers    : getFieldValue('t-total-others'),
        grandTotal     : getFieldValue('t-grand-total'),
        routes         : JSON.stringify(routes),
        description    : 'Travel Plan: ' + getFieldValue('t-business-reason')
      };

      if (!formData.departureDate) { showBanner('Please enter departure date.', 'error'); return; }
      if (!formData.returnDate)    { showBanner('Please enter return date.', 'error'); return; }
      if (!formData.businessReason){ showBanner('Please enter business reason.', 'error'); return; }

      if (btnSub)  { btnSub.disabled = true; btnSub.textContent = 'Submitting…'; }
      if (loading) loading.style.display = 'block';

      try {
        var files = attachInput ? attachInput.files : null;
        var rec   = await DS.submitRequisition(formData, files, 'travel');
        showBanner('Travel Plan ' + rec.id + ' submitted successfully.', 'success');
        form.reset();
        setTimeout(function () { navigateTo('dashboard.html'); }, 3000);
      } catch (err) {
        showBanner(err.message || 'Submission failed.', 'error');
      } finally {
        if (btnSub)  { btnSub.disabled = false; btnSub.textContent = 'Submit Travel Plan'; }
        if (loading) loading.style.display = 'none';
      }
    });
  }

  /* ═══════════════════════════════════════════
     ACCOUNTABILITY PAGE
  ═══════════════════════════════════════════ */
  async function initAccountabilityPage() {
    if (!$id('accountability-form')) return;
    if (!enforceAuth()) return;
    populateNavbar();
    attachLogoutHandler();

    var session = DS.getSession();
    var nameEl  = $id('acc-submitter-name');
    var titleEl = $id('acc-submitter-title');
    if (nameEl)  nameEl.textContent  = session.name;
    if (titleEl) titleEl.textContent = session.title;

    /* Set today as default date */
    var dateEl = $id('acc-date');
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];

    /* Set employee name field */
    var empName = $id('acc-employee-name');
    if (empName) empName.value = session.name;

    var attachInput = $id('acc-attachments');
    if (attachInput) {
      attachInput.addEventListener('change', function () {
        var infoEl = $id('acc-attachment-info');
        if (infoEl) infoEl.textContent = attachInput.files.length + ' file(s) selected';
      });
    }

    var form    = $id('accountability-form');
    var loading = $id('acc-loading');
    var btnSub  = $id('btn-submit-accountability');

    form.addEventListener('submit', async function (evt) {
      evt.preventDefault();
      hideBanners();

      /* Collect expense rows */
      var expenses = [];
      document.querySelectorAll('#expenses-table-body tr').forEach(function (row) {
        var desc = (row.querySelector('[data-col="explanation"]') || {}).value || '';
        if (desc.trim()) {
          expenses.push({
            accountCode : (row.querySelector('[data-col="accountCode"]') || {}).value || '',
            date        : (row.querySelector('[data-col="date"]')        || {}).value || '',
            explanation : desc.trim(),
            refNo       : (row.querySelector('[data-col="refNo"]')       || {}).value || '',
            budgeted    : (row.querySelector('[data-col="budgeted"]')    || {}).value || '',
            actual      : (row.querySelector('[data-col="actual"]')      || {}).value || '',
            balance     : (row.querySelector('[data-col="balance"]')     || {}).value || ''
          });
        }
      });

      var formData = {
        employeeName    : getFieldValue('acc-employee-name'),
        date            : getFieldValue('acc-date'),
        travelDates     : getFieldValue('acc-travel-dates'),
        department      : getFieldValue('acc-department'),
        purpose         : getFieldValue('acc-purpose'),
        totalBudgeted   : getFieldValue('acc-total-budgeted'),
        totalActual     : getFieldValue('acc-total-actual'),
        totalBalance    : getFieldValue('acc-total-balance'),
        advanceReceived : getFieldValue('acc-advance-received'),
        expenses        : JSON.stringify(expenses),
        description     : 'Accountability: ' + getFieldValue('acc-purpose')
      };

      if (!formData.travelDates) { showBanner('Please enter dates of travel/activity.', 'error'); return; }
      if (!formData.purpose)     { showBanner('Please enter purpose of travel/activity.', 'error'); return; }

      if (btnSub)  { btnSub.disabled = true; btnSub.textContent = 'Submitting…'; }
      if (loading) loading.style.display = 'block';

      try {
        var files = attachInput ? attachInput.files : null;
        var rec   = await DS.submitRequisition(formData, files, 'accountability');
        showBanner('Accountability Form ' + rec.id + ' submitted successfully.', 'success');
        form.reset();
        setTimeout(function () { navigateTo('dashboard.html'); }, 3000);
      } catch (err) {
        showBanner(err.message || 'Submission failed.', 'error');
      } finally {
        if (btnSub)  { btnSub.disabled = false; btnSub.textContent = 'Submit Accountability Form'; }
        if (loading) loading.style.display = 'none';
      }
    });
  }

  /* ═══════════════════════════════════════════
     HISTORY PAGE
  ═══════════════════════════════════════════ */
  var _historyRecords = [];

  function buildHistoryRow(rec) {
    var desc = (rec.data && rec.data.description) || rec.id;
    return (
      '<tr>' +
        '<td><a href="#" class="link-history-detail" data-id="' + esc(rec.id) + '">' + esc(rec.id) + '</a></td>' +
        '<td>' + esc(rec.formType || 'request') + '</td>' +
        '<td>' + esc(desc) + '</td>' +
        '<td>' + esc(rec.submittedByName || rec.submittedBy) + '</td>' +
        '<td>' + formatDate(rec.createdAt) + '</td>' +
        '<td>' + formatDate(rec.updatedAt) + '</td>' +
        '<td><span class="status-badge ' + statusClass(rec.status) + '">' + esc(rec.status) + '</span></td>' +
      '</tr>'
    );
  }

  function renderHistoryTable(records) {
    var tbody   = $id('history-table-body');
    var emptyEl = $id('history-empty');
    if (!tbody) return;
    if (!records || records.length === 0) {
      tbody.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    tbody.innerHTML = records.map(buildHistoryRow).join('');
  }

  function applyHistoryFilters() {
    var statusVal = ($id('history-filter-status') || {}).value || '';
    var searchVal = (($id('history-filter-search') || {}).value || '').toLowerCase();
    var filtered  = _historyRecords.filter(function (r) {
      var desc = (r.data && r.data.description) || r.id || '';
      var matchStatus = !statusVal || r.status === statusVal;
      var matchSearch = !searchVal ||
        (r.id || '').toLowerCase().indexOf(searchVal) !== -1 ||
        desc.toLowerCase().indexOf(searchVal) !== -1 ||
        (r.submittedByName || '').toLowerCase().indexOf(searchVal) !== -1;
      return matchStatus && matchSearch;
    });
    renderHistoryTable(filtered);
  }

  async function initHistoryPage() {
    if (!$id('history-container')) return;
    if (!enforceAuth()) return;
    populateNavbar();
    attachLogoutHandler();
    attachModalHandlers();
    attachCommentHandlers();

    var loadingEl = $id('history-loading');
    if (loadingEl) loadingEl.style.display = 'block';

    try {
      _historyRecords = await DS.getAllRequisitions();
      renderHistoryTable(_historyRecords);
    } catch (err) {
      showBanner(err.message || 'Failed to load history.', 'error');
    } finally {
      if (loadingEl) loadingEl.style.display = 'none';
    }

    var fs = $id('history-filter-status');
    var fq = $id('history-filter-search');
    if (fs) fs.addEventListener('change', applyHistoryFilters);
    if (fq) fq.addEventListener('input',  applyHistoryFilters);

    var tbody = $id('history-table-body');
    if (tbody) {
      tbody.addEventListener('click', function (evt) {
        if (evt.target.classList.contains('link-history-detail')) {
          evt.preventDefault();
          var rec = _historyRecords.find(function (r) { return r.id === evt.target.getAttribute('data-id'); });
          if (rec) openModal(buildDetailModal(rec));
        }
      });
    }
  }

  /* ═══════════════════════════════════════════
     MAIN ENTRY POINT
  ═══════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', function () {
    if ($id('login-form'))          { initLoginPage();          return; }
    if ($id('dashboard-container')) { initDashboardPage();      return; }
    if ($id('requisition-form'))    { initFormPage();           return; }
    if ($id('travel-form'))         { initTravelPlanPage();     return; }
    if ($id('accountability-form')) { initAccountabilityPage(); return; }
    if ($id('history-container'))   { initHistoryPage();        return; }
    attachLogoutHandler();
    populateNavbar();
  });

}(window));
