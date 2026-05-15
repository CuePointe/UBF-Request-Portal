/**
 * script.js — UI Router & Event Handlers
 * Uganda Biodiversity Fund (UBF) Logistics & Procurement System v3.0
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
    if (!banner) { alert((type === 'error' ? 'Error: ' : '') + msg); return; }
    banner.textContent   = msg;
    banner.style.display = 'block';
    if (type === 'success') {
      setTimeout(function () { banner.style.display = 'none'; }, 7000);
    }
  }

  function hideBanners() {
    ['global-error-banner','global-success-banner'].forEach(function (id) {
      var el = $id(id);
      if (el) el.style.display = 'none';
    });
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('en-GB', {
        day:'2-digit', month:'short', year:'numeric'
      });
    } catch (_) { return iso; }
  }

  function formatDateTime(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('en-GB', {
        day:'2-digit', month:'short', year:'numeric',
        hour:'2-digit', minute:'2-digit'
      });
    } catch (_) { return iso; }
  }

  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
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

  function formTypeLabel(type) {
    var map = { 'request':'Request', 'travel':'Travel Plan', 'accountability':'Accountability',
                'evaluation':'Evaluation', 'lpo':'LPO', 'grn':'GRN', 'invoice':'Invoice' };
    return map[type] || type || 'Request';
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

  /* ─────────────────────────────────────────────
     NAVBAR
  ───────────────────────────────────────────── */
  function populateNavbar() {
    try {
      var session = DS.getSession();
      if (!session) return;
      var nameEl = $id('nav-user-name');
      var roleEl = $id('nav-user-role');
      if (nameEl) nameEl.textContent = session.name || session.email;
      if (roleEl) {
        roleEl.textContent = session.role;
        roleEl.className   = 'role-badge role-' +
          session.role.toLowerCase().replace(/\s+/g, '-');
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
  function openModal(html) {
    var overlay = $id('modal-overlay');
    var content = $id('modal-content');
    if (!overlay || !content) return;
    content.innerHTML            = html;
    overlay.style.display        = 'flex';
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
    if (overlay) overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });
  }

  /* ─────────────────────────────────────────────
     BUILD DETAIL MODAL
  ───────────────────────────────────────────── */
  function buildDetailModal(rec) {
    var session = DS.getSession();

    /* Approval chain */
    function approvalRow(label, step) {
      var s = rec.approval && rec.approval[step];
      var val = (s && s.byName)
        ? esc(s.byName) + ' on ' + formatDate(s.at) + (s.note ? ' — ' + esc(s.note) : '')
        : '<em style="color:var(--gray-500)">Pending</em>';
      return '<tr><th>' + label + '</th><td>' + val + '</td></tr>';
    }

    var approvalHtml =
      '<table class="detail-table">' +
        '<tr><th>Submitted by</th><td>' + esc(rec.submittedByName) + ' — ' + esc(rec.submittedByTitle) + ' on ' + formatDate(rec.createdAt) + '</td></tr>' +
        approvalRow('Prepared by (Admin Officer)', 'preparation') +
        approvalRow('Reviewed by (Finance Officer / FAM)', 'review') +
        approvalRow('Cleared by (FAM)', 'clearance') +
        approvalRow('Approved by (ED)', 'approval') +
      '</table>';

    /* Form data */
    var dataHtml = '';
    if (rec.data && typeof rec.data === 'object') {
      var keys = Object.keys(rec.data).filter(function (k) {
        return k !== 'routes' && k !== 'expenses';
      });
      dataHtml = '<table class="detail-table">' +
        keys.map(function (k) {
          return '<tr><th>' + esc(k) + '</th><td>' + esc(rec.data[k]) + '</td></tr>';
        }).join('') +
      '</table>';
    }

    /* Attachments */
    var attachHtml = rec.attachments && rec.attachments.length > 0
      ? '<ul class="attachment-list">' +
          rec.attachments.map(function (a) {
            return '<li><a href="' + esc(a.downloadUrl) + '" target="_blank" rel="noopener">📎 ' + esc(a.name) + '</a></li>';
          }).join('') + '</ul>'
      : '<p class="text-muted">No attachments.</p>';

    /* History */
    var historyHtml = rec.history && rec.history.length
      ? '<ol class="history-list">' +
          rec.history.map(function (h) {
            return '<li><strong>' + esc(h.action) + '</strong> by ' + esc(h.byName || h.by) +
              ' on ' + formatDateTime(h.at) + (h.note ? ' — ' + esc(h.note) : '') + '</li>';
          }).join('') + '</ol>'
      : '<p class="text-muted">No history.</p>';

    /* Edit button */
    var canEdit = session && rec.submittedBy === session.email &&
      (rec.status === 'Pending' || rec.status === 'Rejected');
    var editBtn = canEdit
      ? '<a href="form.html?edit=' + esc(rec.id) + '" class="btn btn-secondary btn-sm" style="margin-right:0.5rem;">✏️ Edit &amp; Resubmit</a>'
      : '';

    /* Comments */
    var commentsHtml = buildCommentsHtml(rec);

    return (
      '<h2 class="modal-title">' + esc(rec.id) +
        ' <span class="status-badge ' + statusClass(rec.status) + '">' + esc(rec.status) + '</span>' +
        ' <span style="font-size:0.75rem;background:var(--ubf-blue-light);color:var(--ubf-blue-darker);padding:0.15rem 0.5rem;border-radius:3px;">' + esc(formTypeLabel(rec.formType)) + '</span>' +
      '</h2>' +
      (editBtn ? '<div style="margin-bottom:1rem;">' + editBtn + '</div>' : '') +
      '<div class="modal-grid">' +
        '<div class="modal-section"><h3>Form Details</h3>' + dataHtml + '</div>' +
        '<div class="modal-section"><h3>Approval Chain</h3>' + approvalHtml + '</div>' +
      '</div>' +
      '<div class="modal-section"><h3>Attachments</h3>' + attachHtml + '</div>' +
      '<div class="modal-section"><h3>Comments &amp; Replies</h3>' + commentsHtml + '</div>' +
      '<div class="modal-section"><h3>Audit History</h3>' + historyHtml + '</div>'
    );
  }

  /* ─────────────────────────────────────────────
     COMMENTS HTML
  ───────────────────────────────────────────── */
  function buildCommentsHtml(rec) {
    var comments = rec.comments || [];
    var html = '';

    if (comments.length === 0) {
      html += '<p class="text-muted">No comments yet.</p>';
    } else {
      html += comments.map(function (c) {
        var repliesHtml = (c.replies || []).map(function (r) {
          return '<div class="comment-reply">' +
            '<strong>' + esc(r.byName || r.by) + '</strong> ' +
            '<span class="text-muted">(' + esc(r.byRole) + ')</span> ' +
            '<span class="text-muted" style="font-size:0.75rem;">' + formatDateTime(r.at) + '</span>' +
            '<p style="margin:0.25rem 0 0;">' + esc(r.text) + '</p>' +
          '</div>';
        }).join('');

        return (
          '<div class="comment-item">' +
            '<div class="comment-header">' +
              '<strong>' + esc(c.byName || c.by) + '</strong> ' +
              '<span class="text-muted" style="font-size:0.75rem;">(' + esc(c.byRole) + ') ' + formatDateTime(c.at) + '</span>' +
            '</div>' +
            '<p style="margin:0.3rem 0 0.5rem;">' + esc(c.text) + '</p>' +
            (repliesHtml ? '<div style="margin-left:1.25rem;">' + repliesHtml + '</div>' : '') +
            '<button class="btn-action btn-review btn-reply-toggle" data-comment-id="' + esc(c.id) + '" style="font-size:0.72rem;margin-top:0.4rem;">↩ Reply</button>' +
            '<div id="reply-area-' + esc(c.id) + '" style="display:none;margin-top:0.5rem;">' +
              '<textarea id="reply-text-' + esc(c.id) + '" rows="2" ' +
                'style="width:100%;padding:0.4rem;border:1px solid var(--gray-300);border-radius:4px;font-family:var(--font-body);font-size:0.85rem;" ' +
                'placeholder="Write a reply…"></textarea>' +
              '<button class="btn btn-primary btn-sm btn-submit-reply" ' +
                'data-req-id="' + esc(rec.id) + '" data-comment-id="' + esc(c.id) + '" ' +
                'style="margin-top:0.35rem;">Post Reply</button>' +
            '</div>' +
          '</div>'
        );
      }).join('');
    }

    /* New comment box */
    html +=
      '<div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--gray-200);">' +
        '<textarea id="new-comment-text" rows="3" ' +
          'style="width:100%;padding:0.5rem;border:1.5px solid var(--gray-300);border-radius:var(--radius-sm);' +
          'font-family:var(--font-body);font-size:0.875rem;resize:vertical;" ' +
          'placeholder="Add a comment…"></textarea>' +
        '<button class="btn btn-primary btn-sm btn-post-comment" ' +
          'data-req-id="' + esc(rec.id) + '" style="margin-top:0.5rem;">Post Comment</button>' +
      '</div>';

    return html;
  }

  /* ─────────────────────────────────────────────
     COMMENT / REPLY EVENT DELEGATION
  ───────────────────────────────────────────── */
  function attachCommentHandlers() {
    var overlay = $id('modal-overlay');
    if (!overlay) return;

    overlay.addEventListener('click', async function (evt) {
      var target = evt.target;

      /* Toggle reply area */
      if (target.classList.contains('btn-reply-toggle')) {
        var cid  = target.getAttribute('data-comment-id');
        var area = $id('reply-area-' + cid);
        if (area) area.style.display = area.style.display === 'none' ? 'block' : 'none';
        return;
      }

      /* Post reply */
      if (target.classList.contains('btn-submit-reply')) {
        var reqId = target.getAttribute('data-req-id');
        var cId   = target.getAttribute('data-comment-id');
        var text  = ($id('reply-text-' + cId) || {}).value || '';
        if (!text.trim()) { alert('Please write a reply.'); return; }
        target.disabled = true; target.textContent = 'Posting…';
        try {
          await DS.addReply(reqId, cId, text.trim());
          var recs = await DS.getAllRequisitions();
          var rec  = recs.find(function (r) { return r.id === reqId; });
          if (rec) openModal(buildDetailModal(rec));
        } catch (err) {
          alert('Failed: ' + err.message);
          target.disabled = false; target.textContent = 'Post Reply';
        }
        return;
      }

      /* Post comment */
      if (target.classList.contains('btn-post-comment')) {
        var reqId = target.getAttribute('data-req-id');
        var text  = ($id('new-comment-text') || {}).value || '';
        if (!text.trim()) { alert('Please write a comment.'); return; }
        target.disabled = true; target.textContent = 'Posting…';
        try {
          await DS.addComment(reqId, text.trim());
          var recs = await DS.getAllRequisitions();
          var rec  = recs.find(function (r) { return r.id === reqId; });
          if (rec) openModal(buildDetailModal(rec));
        } catch (err) {
          alert('Failed: ' + err.message);
          target.disabled = false; target.textContent = 'Post Comment';
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

    var form        = $id('login-form');
    var changePanel = $id('change-password-panel');
    var emailInput  = $id('input-email');
    var passInput   = $id('input-password');
    var errorEl     = $id('login-error');
    var toggleBtn   = $id('btn-toggle-password');
    var forgotLink  = $id('forgot-password-link');
    var btnLogin    = $id('btn-login');
    var _pendingUser = null;

    function setError(msg) {
      if (errorEl) { errorEl.textContent = msg; errorEl.style.display = msg ? 'block' : 'none'; }
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        passInput.type        = passInput.type === 'password' ? 'text' : 'password';
        toggleBtn.textContent = passInput.type === 'password' ? '👁' : '🙈';
      });
    }

    if (forgotLink) {
      forgotLink.addEventListener('click', function () {
        alert('Please contact the system administrator:\nt.otieno@ugandabiodiversityfund.org');
      });
    }

    form.addEventListener('submit', async function (evt) {
      evt.preventDefault();
      setError('');

      var email    = emailInput ? emailInput.value.trim().toLowerCase() : '';
      var password = passInput  ? passInput.value : '';

      if (!email)    { setError('Please enter your UBF work email.'); return; }
      if (!password) { setError('Please enter your password.');        return; }

      if (btnLogin) { btnLogin.disabled = true; btnLogin.textContent = 'Verifying…'; }

      try {
        var result = await DS.authenticateUser(email, password);
        var user   = result.user;

        if (user.mustChangePassword || DS.isPasswordExpired(user.passwordExpiry)) {
          _pendingUser               = user;
          form.style.display         = 'none';
          changePanel.style.display  = 'block';
          if (btnLogin) { btnLogin.disabled = false; btnLogin.textContent = 'Log In'; }
          return;
        }

        DS.saveSession(user);
        navigateTo('dashboard.html');

      } catch (err) {
        setError(err.message || 'Login failed. Please try again.');
        if (btnLogin) { btnLogin.disabled = false; btnLogin.textContent = 'Log In'; }
      }
    });

    /* Cancel password change */
    var btnCancel = $id('btn-cancel-change');
    if (btnCancel) {
      btnCancel.addEventListener('click', function () {
        _pendingUser               = null;
        form.style.display         = 'block';
        changePanel.style.display  = 'none';
      });
    }

    /* Set new password */
    var btnSetPass = $id('btn-set-password');
    if (btnSetPass) {
      btnSetPass.addEventListener('click', async function () {
        var newPass  = ($id('input-new-password')     || {}).value || '';
        var confPass = ($id('input-confirm-password') || {}).value || '';
        if (newPass.length < 8) { alert('Password must be at least 8 characters.'); return; }
        if (newPass !== confPass) { alert('Passwords do not match.'); return; }
        btnSetPass.disabled = true; btnSetPass.textContent = 'Saving…';
        try {
          await DS.changePassword(_pendingUser.email, newPass);
          var result = await DS.authenticateUser(_pendingUser.email, newPass);
          DS.saveSession(result.user);
          navigateTo('dashboard.html');
        } catch (err) {
          alert('Failed to set password: ' + err.message);
          btnSetPass.disabled = false; btnSetPass.textContent = 'Set Password & Log In';
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
      'stat-total'   : stats.total    || 0,
      'stat-pending' : stats.pending  || 0,
      'stat-prepared': stats.prepared || 0,
      'stat-reviewed': stats.reviewed || 0,
      'stat-cleared' : stats.cleared  || 0,
      'stat-approved': stats.approved || 0,
      'stat-rejected': stats.rejected || 0
    };
    Object.keys(map).forEach(function (id) {
      var el = $id(id);
      if (el) el.textContent = map[id];
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
        '<button class="btn-action btn-reject"  data-id="' + esc(rec.id) + '" data-action="Rejected">Reject</button> ';
    }

    var canEdit = rec.submittedBy === session.email &&
      (rec.status === 'Pending' || rec.status === 'Rejected');
    if (canEdit) {
      html += '<a href="form.html?edit=' + esc(rec.id) + '" class="btn-action btn-review">✏️ Edit</a>';
    }

    return html || '<span class="text-muted">—</span>';
  }

  function buildDashboardRow(rec, session) {
    var desc = (rec.data && rec.data.description) || rec.id;
    return (
      '<tr>' +
        '<td><a href="#" class="link-req-detail" data-id="' + esc(rec.id) + '">' + esc(rec.id) + '</a></td>' +
        '<td>' + esc(formTypeLabel(rec.formType)) + '</td>' +
        '<td>' + esc(desc) + '</td>' +
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
    tbody.innerHTML = records.map(function (r) {
      return buildDashboardRow(r, session);
    }).join('');
  }

  function applyDashboardFilters() {
    var statusVal = ($id('filter-status') || {}).value || '';
    var searchVal = (($id('filter-search') || {}).value || '').toLowerCase();
    var filtered  = _dashboardRecords.filter(function (r) {
      var desc = (r.data && r.data.description) || r.id || '';
      return (!statusVal || r.status === statusVal) &&
        (!searchVal ||
          (r.id || '').toLowerCase().indexOf(searchVal) !== -1 ||
          desc.toLowerCase().indexOf(searchVal) !== -1 ||
          (r.submittedByName || '').toLowerCase().indexOf(searchVal) !== -1);
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
      _dashboardRecords = Array.isArray(records) ? records : [];
      renderStats(stats);
      renderDashboardTable(_dashboardRecords);
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

        if (target.classList.contains('link-req-detail')) {
          evt.preventDefault();
          var rec = _dashboardRecords.find(function (r) {
            return r.id === target.getAttribute('data-id');
          });
          if (rec) openModal(buildDetailModal(rec));
          return;
        }

        if (target.classList.contains('btn-action') && target.getAttribute('data-action')) {
          var id     = target.getAttribute('data-id');
          var action = target.getAttribute('data-action');
          if (!id || !action) return;
          var note = '';
          if (action === 'Rejected') {
            note = prompt('Reason for rejection (optional):') || '';
            if (note === null) return;
          }
          target.disabled = true; target.textContent = 'Saving…';
          try {
            await DS.updateRequisitionStatus(id, action, note);
            showBanner('Requisition ' + id + ' updated to "' + action + '".', 'success');
            var updated = await DS.getAllRequisitions();
            var stats   = await DS.getDashboardStats();
            _dashboardRecords = Array.isArray(updated) ? updated : [];
            renderStats(stats);
            applyDashboardFilters();
          } catch (err) {
            showBanner(err.message || 'Failed to update.', 'error');
            target.disabled = false; target.textContent = action;
          }
        }
      });
    }
  }

  /* ═══════════════════════════════════════════
     GENERIC FORM SUBMIT HANDLER
     Used by: form.html, travel-plan.html,
              accountability.html
  ═══════════════════════════════════════════ */
  function setupFormSubmit(formId, btnId, loadingId, formType, collectFn, validateFn) {
    var form    = $id(formId);
    var btnSub  = $id(btnId);
    var loading = $id(loadingId);
    if (!form) return;

    form.addEventListener('submit', async function (evt) {
      evt.preventDefault();
      hideBanners();

      var formData = collectFn();
      var error    = validateFn(formData);
      if (error) { showBanner(error, 'error'); return; }

      if (btnSub)  { btnSub.disabled = true; btnSub.textContent = 'Submitting…'; }
      if (loading) loading.style.display = 'block';

      try {
        /* Check for edit mode */
        var params = new URLSearchParams(global.location.search);
        var editId = params.has('edit') ? params.get('edit') : null;
        var rec;

        var attachInput = document.querySelector('input[type="file"]');
        var files       = attachInput ? attachInput.files : null;

        if (editId) {
          rec = await DS.editRequisition(editId, formData, files);
          showBanner('Submission ' + rec.id + ' updated and resubmitted.', 'success');
        } else {
          rec = await DS.submitRequisition(formData, files, formType);
          showBanner('Submission ' + rec.id + ' saved. Pending review by Susan Abonyo.', 'success');
        }

        form.reset();
        setTimeout(function () { navigateTo('dashboard.html'); }, 3000);

      } catch (err) {
        showBanner(err.message || 'Submission failed. Please try again.', 'error');
      } finally {
        if (btnSub)  { btnSub.disabled = false; btnSub.textContent = 'Submit'; }
        if (loading) loading.style.display = 'none';
      }
    });
  }

  /* ═══════════════════════════════════════════
     REQUEST FORM (form.html)
  ═══════════════════════════════════════════ */
  async function initFormPage() {
    if (!$id('requisition-form')) return;
    if (!enforceAuth()) return;
    populateNavbar();
    attachLogoutHandler();

    var session = DS.getSession();
    var nameEl  = $id('form-submitter-name');
    var titleEl = $id('form-submitter-title');
    if (nameEl)  nameEl.textContent  = session.name;
    if (titleEl) titleEl.textContent = session.title;

    /* Edit mode — pre-fill fields */
    var params = new URLSearchParams(global.location.search);
    if (params.has('edit')) {
      try {
        var db      = await DS.readDatabase();
        var editRec = db.records.find(function (r) { return r.id === params.get('edit'); });
        if (editRec && editRec.data) {
          Object.keys(editRec.data).forEach(function (k) {
            var el = document.querySelector('[name="' + k + '"]');
            if (el) el.value = editRec.data[k] || '';
          });
          var ph = document.querySelector('.page-header h1');
          if (ph) ph.textContent = 'Edit — ' + params.get('edit');
          var btn = $id('btn-submit-requisition');
          if (btn) btn.textContent = 'Save & Resubmit';
        }
      } catch (err) {
        showBanner('Could not load for editing: ' + err.message, 'error');
      }
    }

    setupFormSubmit(
      'requisition-form',
      'btn-submit-requisition',
      'form-loading',
      'request',
      function () {
        return {
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
      },
      function (d) {
        if (!d.description)   return 'Please enter a description.';
        if (!d.specification) return 'Please enter the specification of goods/services.';
        if (!d.quantity || parseFloat(d.quantity) <= 0) return 'Please enter a valid quantity.';
        return '';
      }
    );
  }

  /* ═══════════════════════════════════════════
     TRAVEL PLAN (travel-plan.html)
  ═══════════════════════════════════════════ */
  async function initTravelPlanPage() {
    if (!$id('travel-form')) return;
    if (!enforceAuth()) return;
    populateNavbar();
    attachLogoutHandler();

    var session = DS.getSession();
    var nameEl  = $id('t-traveller-name');
    var posEl   = $id('t-position');
    var subName = $id('travel-submitter-name');
    var subTitle = $id('travel-submitter-title');
    if (nameEl)   nameEl.value          = session.name;
    if (posEl)    posEl.value           = session.title;
    if (subName)  subName.textContent   = session.name;
    if (subTitle) subTitle.textContent  = session.title;

    var reqDate = $id('t-request-date');
    if (reqDate) reqDate.value = new Date().toISOString().split('T')[0];

    setupFormSubmit(
      'travel-form', 'btn-submit-travel', 'travel-loading', 'travel',
      function () {
        var routes = [];
        document.querySelectorAll('#route-table-body tr').forEach(function (row) {
          var routeEl = row.querySelector('[data-col="route"]');
          if (routeEl && routeEl.value.trim()) {
            routes.push({
              route         : routeEl.value.trim(),
              date          : (row.querySelector('[data-col="date"]')          || {}).value || '',
              perDiem       : (row.querySelector('[data-col="perDiem"]')       || {}).value || '',
              accommodation : (row.querySelector('[data-col="accommodation"]') || {}).value || '',
              sda           : (row.querySelector('[data-col="sda"]')           || {}).value || '',
              others        : (row.querySelector('[data-col="others"]')        || {}).value || '',
              total         : (row.querySelector('[data-col="total"]')         || {}).value || ''
            });
          }
        });
        return {
          description    : 'Travel Plan: ' + getFieldValue('t-business-reason'),
          travellerName  : getFieldValue('t-traveller-name'),
          position       : getFieldValue('t-position'),
          requestDate    : getFieldValue('t-request-date'),
          staffNumber    : getFieldValue('t-staff-number'),
          departureDate  : getFieldValue('t-departure-date'),
          returnDate     : getFieldValue('t-return-date'),
          totalDays      : getFieldValue('t-total-days'),
          businessNights : getFieldValue('t-business-nights'),
          businessReason : getFieldValue('t-business-reason'),
          grandTotal     : getFieldValue('t-grand-total'),
          routes         : JSON.stringify(routes)
        };
      },
      function (d) {
        if (!d.departureDate)  return 'Please enter departure date.';
        if (!d.returnDate)     return 'Please enter return date.';
        if (!d.businessReason) return 'Please enter the business reason.';
        return '';
      }
    );
  }

  /* ═══════════════════════════════════════════
     ACCOUNTABILITY (accountability.html)
  ═══════════════════════════════════════════ */
  async function initAccountabilityPage() {
    if (!$id('accountability-form')) return;
    if (!enforceAuth()) return;
    populateNavbar();
    attachLogoutHandler();

    var session = DS.getSession();
    var nameEl  = $id('acc-submitter-name');
    var titleEl = $id('acc-submitter-title');
    var empName = $id('acc-employee-name');
    if (nameEl)  nameEl.textContent  = session.name;
    if (titleEl) titleEl.textContent = session.title;
    if (empName) empName.value       = session.name;

    var dateEl = $id('acc-date');
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];

    setupFormSubmit(
      'accountability-form', 'btn-submit-accountability', 'acc-loading', 'accountability',
      function () {
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
        return {
          description     : 'Accountability: ' + getFieldValue('acc-purpose'),
          employeeName    : getFieldValue('acc-employee-name'),
          date            : getFieldValue('acc-date'),
          travelDates     : getFieldValue('acc-travel-dates'),
          department      : getFieldValue('acc-department'),
          purpose         : getFieldValue('acc-purpose'),
          totalBudgeted   : getFieldValue('acc-total-budgeted'),
          totalActual     : getFieldValue('acc-total-actual'),
          totalBalance    : getFieldValue('acc-total-balance'),
          advanceReceived : getFieldValue('acc-advance-received'),
          expenses        : JSON.stringify(expenses)
        };
      },
      function (d) {
        if (!d.travelDates) return 'Please enter the dates of travel/activity.';
        if (!d.purpose)     return 'Please enter the purpose of travel/activity.';
        return '';
      }
    );
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
        '<td>' + esc(formTypeLabel(rec.formType)) + '</td>' +
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
      return (!statusVal || r.status === statusVal) &&
        (!searchVal ||
          (r.id || '').toLowerCase().indexOf(searchVal) !== -1 ||
          desc.toLowerCase().indexOf(searchVal) !== -1 ||
          (r.submittedByName || '').toLowerCase().indexOf(searchVal) !== -1);
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
      var records     = await DS.getAllRequisitions();
      _historyRecords = Array.isArray(records) ? records : [];
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
          var rec = _historyRecords.find(function (r) {
            return r.id === evt.target.getAttribute('data-id');
          });
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
