/**
 * script.js — UI Router & Event Handlers
 * Uganda Biodiversity Fund (UBF) Request Portal
 *
 * APPROVAL WORKFLOW:
 *   Staff submits → Admin Officer reviews → FAM clears → ED approves
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
    banner.textContent    = msg;
    banner.style.display  = 'block';
    if (type === 'success') {
      setTimeout(function () { banner.style.display = 'none'; }, 6000);
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

  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function statusClass(status) {
    var map = {
      'pending review': 'status-pending',
      'reviewed'      : 'status-inreview',
      'cleared'       : 'status-inreview',
      'approved'      : 'status-approved',
      'rejected'      : 'status-rejected'
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

  function populateNavbar() {
    try {
      var creds  = DS.getCredentials();
      var staff  = DS.getStaff(creds.email);
      var nameEl = $id('nav-user-name');
      var roleEl = $id('nav-user-role');
      if (nameEl) nameEl.textContent = staff.name || creds.email;
      if (roleEl) {
        roleEl.textContent = staff.role;
        roleEl.className   = 'role-badge role-' + staff.role.toLowerCase().replace(/\s+/g, '-');
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

  function getFieldValue(id) {
    var el = $id(id);
    return el && el.value ? el.value.trim() : '';
  }

  /* ═══════════════════════════════════════════
     LOGIN PAGE
  ═══════════════════════════════════════════ */
  function initLoginPage() {
    if (!$id('login-form')) return;
    if (DS.isAuthenticated()) { navigateTo('dashboard.html'); return; }

    var form      = $id('login-form');
    var emailInput = $id('input-email');
    var patInput   = $id('input-pat');
    var btnLogin   = $id('btn-login');
    var errorEl    = $id('login-error');

    function setError(msg) {
      if (errorEl) { errorEl.textContent = msg; errorEl.style.display = msg ? 'block' : 'none'; }
    }

    function setLoading(on) {
      if (btnLogin) { btnLogin.disabled = on; btnLogin.textContent = on ? 'Verifying…' : 'Log In'; }
    }

    form.addEventListener('submit', async function (evt) {
      evt.preventDefault();
      setError('');

      var email = emailInput ? emailInput.value.trim().toLowerCase() : '';
      var pat   = patInput   ? patInput.value.trim()                  : '';

      if (!email) { setError('Please enter your UBF email address.'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Please enter a valid email address.'); return; }
      if (!pat)   { setError('Please enter your GitHub Personal Access Token.'); return; }
      if (!pat.startsWith('ghp_') && !pat.startsWith('github_pat_')) {
        setError('Token format incorrect. Classic tokens start with "ghp_".');
        return;
      }

      setLoading(true);
      try {
        DS.saveSession(email, pat);
        await DS.readDatabase(); // validates token and repo access
        navigateTo('dashboard.html');
      } catch (err) {
        DS.clearSession();
        setError(err.message || 'Login failed. Check your token and try again.');
        setLoading(false);
      }
    });
  }

  /* ═══════════════════════════════════════════
     DASHBOARD PAGE
  ═══════════════════════════════════════════ */
  var _dashboardRecords = [];

  function renderStats(stats) {
    var map = {
      'stat-total'   : stats.total,
      'stat-pending' : stats.pendingReview,
      'stat-reviewed': stats.reviewed,
      'stat-cleared' : stats.cleared,
      'stat-approved': stats.approved,
      'stat-rejected': stats.rejected
    };
    Object.keys(map).forEach(function (id) {
      var el = $id(id);
      if (el) el.textContent = map[id];
    });
  }

  function buildActionButtons(rec, userRole) {
    /* Show action button only to the role whose turn it is */
    if (userRole === 'Admin Officer' && rec.status === 'Pending Review') {
      return '<button class="btn-action btn-approve" data-id="' + esc(rec.id) + '" data-action="Reviewed">Mark Reviewed</button>' +
             '<button class="btn-action btn-reject"  data-id="' + esc(rec.id) + '" data-action="Rejected">Reject</button>';
    }
    if (userRole === 'FAM' && rec.status === 'Reviewed') {
      return '<button class="btn-action btn-approve" data-id="' + esc(rec.id) + '" data-action="Cleared">Clear</button>' +
             '<button class="btn-action btn-reject"  data-id="' + esc(rec.id) + '" data-action="Rejected">Reject</button>';
    }
    if (userRole === 'ED' && rec.status === 'Cleared') {
      return '<button class="btn-action btn-approve" data-id="' + esc(rec.id) + '" data-action="Approved">Approve</button>' +
             '<button class="btn-action btn-reject"  data-id="' + esc(rec.id) + '" data-action="Rejected">Reject</button>';
    }
    return '<span class="text-muted">—</span>';
  }

  function buildDashboardRow(rec, userRole) {
    return (
      '<tr>' +
        '<td><a href="#" class="link-req-detail" data-id="' + esc(rec.id) + '">' + esc(rec.id) + '</a></td>' +
        '<td>' + esc(rec.description || '—') + '</td>' +
        '<td>' + esc(rec.submittedByName || rec.submittedBy || '—') + '</td>' +
        '<td>' + formatDate(rec.createdAt) + '</td>' +
        '<td><span class="status-badge ' + statusClass(rec.status) + '">' + esc(rec.status) + '</span></td>' +
        '<td>' + buildActionButtons(rec, userRole) + '</td>' +
      '</tr>'
    );
  }

  function renderDashboardTable(records) {
    var tbody   = $id('dashboard-table-body');
    var emptyEl = $id('dashboard-empty');
    if (!tbody) return;
    var creds   = DS.getCredentials();
    var role    = DS.getRole(creds.email);
    if (!records || records.length === 0) {
      tbody.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    tbody.innerHTML = records.map(function (r) { return buildDashboardRow(r, role); }).join('');
  }

  function applyDashboardFilters() {
    var statusVal = ($id('filter-status') || {}).value || '';
    var searchVal = (($id('filter-search') || {}).value || '').toLowerCase();
    var filtered  = _dashboardRecords.filter(function (r) {
      var matchStatus = !statusVal || r.status === statusVal;
      var matchSearch = !searchVal ||
        (r.id          || '').toLowerCase().indexOf(searchVal) !== -1 ||
        (r.description || '').toLowerCase().indexOf(searchVal) !== -1 ||
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

    /* Table delegation */
    var tbody = $id('dashboard-table-body');
    if (tbody) {
      tbody.addEventListener('click', async function (evt) {
        var target = evt.target;

        if (target.classList.contains('link-req-detail')) {
          evt.preventDefault();
          var rec = _dashboardRecords.find(function (r) { return r.id === target.getAttribute('data-id'); });
          if (rec) openDetailModal(rec);
          return;
        }

        if (target.classList.contains('btn-action')) {
          var id     = target.getAttribute('data-id');
          var action = target.getAttribute('data-action');
          if (!id || !action) return;

          var note = '';
          if (action === 'Rejected') {
            note = prompt('Reason for rejection (optional):') || '';
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
     DETAIL MODAL
  ═══════════════════════════════════════════ */
  function openDetailModal(rec) {
    var overlay = $id('modal-overlay');
    var content = $id('modal-content');
    if (!overlay || !content) return;

    var approvalHtml =
      '<table class="detail-table">' +
        '<tr><th>Submitted by</th><td>' + esc(rec.submittedByName) + ' — ' + esc(rec.submittedByTitle) + '</td></tr>' +
        '<tr><th>Reviewed by</th><td>' + ((rec.approval && rec.approval.review && rec.approval.review.byName) ? esc(rec.approval.review.byName) + ' on ' + formatDate(rec.approval.review.at) : 'Pending') + '</td></tr>' +
        '<tr><th>Cleared by</th><td>'  + ((rec.approval && rec.approval.clearance && rec.approval.clearance.byName) ? esc(rec.approval.clearance.byName) + ' on ' + formatDate(rec.approval.clearance.at) : 'Pending') + '</td></tr>' +
        '<tr><th>Approved by</th><td>' + ((rec.approval && rec.approval.approval && rec.approval.approval.byName) ? esc(rec.approval.approval.byName) + ' on ' + formatDate(rec.approval.approval.at) : 'Pending') + '</td></tr>' +
      '</table>';

    var attachHtml = rec.attachments && rec.attachments.length > 0
      ? '<ul class="attachment-list">' + rec.attachments.map(function (a) {
          return '<li><a href="' + esc(a.downloadUrl) + '" target="_blank" rel="noopener">' + esc(a.name) + '</a></li>';
        }).join('') + '</ul>'
      : '<p class="text-muted">No attachments.</p>';

    var historyHtml = rec.history && rec.history.length
      ? '<ol class="history-list">' + rec.history.map(function (h) {
          return '<li><strong>' + esc(h.action) + '</strong> by ' + esc(h.byName || h.by) +
                 ' (' + esc(h.byTitle || '') + ') on ' + formatDate(h.at) +
                 (h.note ? ' — ' + esc(h.note) : '') + '</li>';
        }).join('') + '</ol>'
      : '<p class="text-muted">No history.</p>';

    content.innerHTML =
      '<h2 class="modal-title">' + esc(rec.id) + ' — ' + esc(rec.description) + '</h2>' +
      '<div class="modal-grid">' +
        '<div class="modal-section"><h3>Details</h3>' +
          '<table class="detail-table">' +
            '<tr><th>Activity Code</th><td>'   + esc(rec.activityCode)   + '</td></tr>' +
            '<tr><th>Description</th><td>'     + esc(rec.description)    + '</td></tr>' +
            '<tr><th>Specification</th><td>'   + esc(rec.specification)  + '</td></tr>' +
            '<tr><th>Quantity</th><td>'        + esc(rec.quantity)       + '</td></tr>' +
            '<tr><th>Date Required</th><td>'   + formatDate(rec.dateRequired) + '</td></tr>' +
            '<tr><th>Location</th><td>'        + esc(rec.locationOfWork) + '</td></tr>' +
            '<tr><th>Contract Period</th><td>' + esc(rec.contractPeriod) + '</td></tr>' +
            '<tr><th>Account Code</th><td>'    + esc(rec.accountCode) + ' / ' + esc(rec.accountName) + '</td></tr>' +
            '<tr><th>Donor Code</th><td>'      + esc(rec.donorCode) + ' / ' + esc(rec.donorName) + '</td></tr>' +
            '<tr><th>Department</th><td>'      + esc(rec.department)     + '</td></tr>' +
            '<tr><th>Budget Code</th><td>'     + esc(rec.budgetCode)     + '</td></tr>' +
            '<tr><th>Status</th><td><span class="status-badge ' + statusClass(rec.status) + '">' + esc(rec.status) + '</span></td></tr>' +
          '</table>' +
        '</div>' +
        '<div class="modal-section"><h3>Approval Chain</h3>' + approvalHtml + '</div>' +
      '</div>' +
      '<div class="modal-section"><h3>Attachments</h3>' + attachHtml + '</div>' +
      '<div class="modal-section"><h3>Audit History</h3>' + historyHtml + '</div>';

    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeDetailModal() {
    var overlay = $id('modal-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  function attachModalHandlers() {
    var btn     = $id('btn-modal-close');
    var overlay = $id('modal-overlay');
    if (btn)     btn.addEventListener('click', closeDetailModal);
    if (overlay) overlay.addEventListener('click', function (e) { if (e.target === overlay) closeDetailModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDetailModal(); });
  }

  /* ═══════════════════════════════════════════
     FORM PAGE
  ═══════════════════════════════════════════ */
  async function initFormPage() {
    if (!$id('requisition-form')) return;
    if (!enforceAuth()) return;
    populateNavbar();
    attachLogoutHandler();

    try {
      var creds  = DS.getCredentials();
      var staff  = DS.getStaff(creds.email);
      var nameEl = $id('form-submitter-name');
      var titEl  = $id('form-submitter-title');
      if (nameEl) nameEl.textContent = staff.name;
      if (titEl)  titEl.textContent  = staff.title;
    } catch (_) {}

    /* File size display */
    var attachInput = $id('form-attachments');
    if (attachInput) {
      attachInput.addEventListener('change', function () {
        var files   = Array.from(attachInput.files || []);
        var infoEl  = $id('form-attachment-info');
        if (infoEl) {
          infoEl.textContent = files.length > 0
            ? files.length + ' file(s) selected'
            : '';
        }
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
        unit           : '',
        dateRequired   : getFieldValue('form-date-required'),
        locationOfWork : getFieldValue('form-location'),
        contractPeriod : getFieldValue('form-contract-period'),
        accountCode    : getFieldValue('form-account-code'),
        accountName    : getFieldValue('form-account-name'),
        donorCode      : getFieldValue('form-donor-code'),
        donorName      : getFieldValue('form-donor-name'),
        department     : getFieldValue('form-department'),
        budgetCode     : getFieldValue('form-budget-code'),
        estimatedCost  : '',
        currency       : 'UGX'
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
        var rec   = await DS.submitRequisition(formData, files);
        showBanner('Requisition ' + rec.id + ' submitted successfully and is now Pending Review by Susan Abonyo.', 'success');
        form.reset();
        var infoEl = $id('form-attachment-info');
        if (infoEl) infoEl.textContent = '';
        setTimeout(function () { navigateTo('dashboard.html'); }, 3000);
      } catch (err) {
        showBanner(err.message || 'Submission failed. Please try again.', 'error');
      } finally {
        if (btnSub)  { btnSub.disabled = false; btnSub.textContent = 'Submit Requisition'; }
        if (loading) loading.style.display = 'none';
      }
    });
  }

  /* ═══════════════════════════════════════════
     HISTORY PAGE
  ═══════════════════════════════════════════ */
  var _historyRecords = [];

  function buildHistoryRow(rec) {
    return (
      '<tr>' +
        '<td><a href="#" class="link-history-detail" data-id="' + esc(rec.id) + '">' + esc(rec.id) + '</a></td>' +
        '<td>' + esc(rec.description || '—') + '</td>' +
        '<td>' + esc(rec.submittedByName || rec.submittedBy || '—') + '</td>' +
        '<td>' + formatDate(rec.createdAt)  + '</td>' +
        '<td>' + formatDate(rec.updatedAt)  + '</td>' +
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
      var matchStatus = !statusVal || r.status === statusVal;
      var matchSearch = !searchVal ||
        (r.id          || '').toLowerCase().indexOf(searchVal) !== -1 ||
        (r.description || '').toLowerCase().indexOf(searchVal) !== -1 ||
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
          if (rec) openDetailModal(rec);
        }
      });
    }
  }

  /* ═══════════════════════════════════════════
     MAIN ENTRY POINT
  ═══════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', function () {
    if ($id('login-form'))          { initLoginPage();     return; }
    if ($id('dashboard-container')) { initDashboardPage(); return; }
    if ($id('requisition-form'))    { initFormPage();      return; }
    if ($id('history-container'))   { initHistoryPage();   return; }
    attachLogoutHandler();
    populateNavbar();
  });

}(window));
