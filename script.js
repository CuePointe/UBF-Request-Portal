/**
 * script.js — UI Router & Event Handler Layer
 * Uganda Biodiversity Fund (UBF) Request Portal
 *
 * DEPENDENCIES:
 *   This file must be loaded AFTER data.js.
 *   Both files must be included as plain <script> tags (NOT type="module").
 *   Example in every HTML page:
 *     <script src="../data.js"></script>
 *     <script src="../script.js"></script>
 *   (Adjust relative paths to match your folder structure.)
 *
 * PAGE DETECTION:
 *   The router detects which page it's on by looking for unique
 *   DOM element IDs. Each HTML page must contain the relevant ID:
 *
 *   index.html    →  id="login-form"
 *   dashboard.html→  id="dashboard-container"
 *   form.html     →  id="requisition-form"
 *   history.html  →  id="history-container"
 *
 * HTML ELEMENT IDs THIS FILE EXPECTS:
 *   (search for each ID below to understand its role)
 *
 *   Shared (all pages):
 *     #nav-user-name       — displays "Hello, <name>" in navbar
 *     #nav-user-role       — displays the user's role badge
 *     #btn-logout          — logout button
 *     #global-error-banner — hidden <div> for error messages
 *     #global-success-banner — hidden <div> for success messages
 *
 *   index.html:
 *     #login-form          — the <form> element
 *     #input-email         — email <input>
 *     #input-pat           — PAT <input>
 *     #btn-login           — submit button
 *     #login-error         — inline error text element
 *
 *   dashboard.html:
 *     #dashboard-container — outer wrapper (page detection anchor)
 *     #stat-total          — big number card: total
 *     #stat-pending        — big number card: pending
 *     #stat-approved       — big number card: approved
 *     #stat-rejected       — big number card: rejected
 *     #stat-inreview       — big number card: in review
 *     #dashboard-table-body— <tbody> of the requisitions table
 *     #dashboard-loading   — spinner/loading message element
 *     #dashboard-empty     — "no records" message element
 *     #filter-status       — <select> for status filter
 *     #filter-search       — <input> for text search
 *
 *   form.html:
 *     #requisition-form    — the <form> element (page detection anchor)
 *     #form-title          — text input
 *     #form-category       — select
 *     #form-description    — textarea
 *     #form-quantity       — number input
 *     #form-unit           — text input
 *     #form-estimated-cost — number input
 *     #form-currency       — select (UGX / USD / EUR)
 *     #form-urgency        — select (Normal / Urgent / Critical)
 *     #form-project-code   — text input
 *     #form-delivery-date  — date input
 *     #form-delivery-address — textarea
 *     #form-justification  — textarea
 *     #form-attachments    — file input (multiple)
 *     #btn-submit-requisition — submit button
 *     #form-loading        — spinner element
 *     #form-submitter-name — read-only display of current user email
 *     #form-submitter-role — read-only display of current user role
 *
 *   history.html:
 *     #history-container   — outer wrapper (page detection anchor)
 *     #history-table-body  — <tbody> of the history table
 *     #history-loading     — spinner element
 *     #history-empty       — "no records" message element
 *     #history-filter-status — <select> for status filter
 *     #history-filter-search — <input> for text search
 *     #modal-overlay         — full-screen modal backdrop
 *     #modal-content         — div rendered inside the modal
 *     #btn-modal-close       — button to close the modal
 */

(function (global) {
  'use strict';

  /* ─────────────────────────────────────────────
     GUARD: ensure DataService is available
  ───────────────────────────────────────────── */
  if (!global.DataService) {
    console.error(
      'script.js: window.DataService is not defined. ' +
      'Make sure data.js is loaded BEFORE script.js in your HTML.'
    );
    return;
  }

  var DS = global.DataService;

  /* ─────────────────────────────────────────────
     UTILITY HELPERS
  ───────────────────────────────────────────── */

  /** Safely get a DOM element by ID; returns null if not found. */
  function $id(id) {
    return document.getElementById(id);
  }

  /** Show a banner message. type = 'error' | 'success' */
  function showBanner(message, type) {
    var bannerId = type === 'error' ? 'global-error-banner' : 'global-success-banner';
    var banner   = $id(bannerId);
    if (!banner) {
      // Fallback for pages that don't implement global banners
      alert((type === 'error' ? '❌ Error: ' : '✅ ') + message);
      return;
    }
    banner.textContent = message;
    banner.style.display = 'block';
    banner.setAttribute('role', 'alert');
    // Auto-hide success banners after 6 seconds
    if (type === 'success') {
      setTimeout(function () {
        banner.style.display = 'none';
      }, 6000);
    }
  }

  function hideBanner(type) {
    var bannerId = type === 'error' ? 'global-error-banner' : 'global-success-banner';
    var banner   = $id(bannerId);
    if (banner) banner.style.display = 'none';
  }

  /** Format an ISO date string to a readable local date. */
  function formatDate(isoString) {
    if (!isoString) return '—';
    try {
      var d = new Date(isoString);
      return d.toLocaleDateString('en-GB', {
        day  : '2-digit',
        month: 'short',
        year : 'numeric'
      });
    } catch (_) {
      return isoString;
    }
  }

  /** Format currency amount. */
  function formatCurrency(amount, currency) {
    if (!amount) return '—';
    var num = parseFloat(amount);
    if (isNaN(num)) return amount;
    try {
      return new Intl.NumberFormat('en-UG', {
        style   : 'currency',
        currency: currency || 'UGX',
        minimumFractionDigits: 0
      }).format(num);
    } catch (_) {
      return (currency || 'UGX') + ' ' + num.toLocaleString();
    }
  }

  /** Returns a CSS class name based on status string. */
  function statusClass(status) {
    var map = {
      'pending'  : 'status-pending',
      'approved' : 'status-approved',
      'rejected' : 'status-rejected',
      'in review': 'status-inreview',
      'cancelled': 'status-cancelled'
    };
    return map[(status || '').toLowerCase()] || 'status-pending';
  }

  /** Escapes a string to safely insert into innerHTML. */
  function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Redirects to a page, resolving relative to the site root. */
  function navigateTo(page) {
    // Support both flat structure (all files in root) and
    // any subdirectory depth by using an absolute path from
    // the repo root as served by GitHub Pages.
    var base = global.location.pathname;
    // Strip everything after the last '/' to get the directory
    var dir  = base.substring(0, base.lastIndexOf('/') + 1);
    global.location.href = dir + page;
  }

  /* ─────────────────────────────────────────────
     AUTH GUARD
     Every page except index.html redirects to
     index.html if no session is stored.
  ───────────────────────────────────────────── */

  function enforceAuth() {
    if (!DS.isAuthenticated()) {
      navigateTo('index.html');
      return false;
    }
    return true;
  }

  /* ─────────────────────────────────────────────
     SHARED NAVBAR POPULATION
  ───────────────────────────────────────────── */

  function populateNavbar() {
    try {
      var creds    = DS.getCredentials();
      var role     = DS.getRole(creds.email);
      var nameEl   = $id('nav-user-name');
      var roleEl   = $id('nav-user-role');

      if (nameEl) nameEl.textContent = creds.email;
      if (roleEl) {
        roleEl.textContent = role;
        roleEl.className   = 'role-badge role-' + role.toLowerCase().replace(/\s+/g, '-');
      }
    } catch (_) {
      // Not critical — navbar can be absent on login page
    }
  }

  /* ─────────────────────────────────────────────
     LOGOUT
  ───────────────────────────────────────────── */

  function attachLogoutHandler() {
    var btn = $id('btn-logout');
    if (!btn) return;
    btn.addEventListener('click', function () {
      DS.clearSession();
      navigateTo('index.html');
    });
  }

  /* ═══════════════════════════════════════════════════════
     PAGE: index.html  (LOGIN)
  ═══════════════════════════════════════════════════════ */

  function initLoginPage() {
    // If already logged in, skip straight to dashboard
    if (DS.isAuthenticated()) {
      navigateTo('dashboard.html');
      return;
    }

    var form        = $id('login-form');
    var emailInput  = $id('input-email');
    var patInput    = $id('input-pat');
    var btnLogin    = $id('btn-login');
    var errorEl     = $id('login-error');

    if (!form) return; // Not the login page

    function setLoginError(msg) {
      if (errorEl) {
        errorEl.textContent = msg;
        errorEl.style.display = msg ? 'block' : 'none';
      } else {
        if (msg) alert('Login Error: ' + msg);
      }
    }

    function setLoading(loading) {
      if (btnLogin) {
        btnLogin.disabled     = loading;
        btnLogin.textContent  = loading ? 'Verifying…' : 'Log In';
      }
    }

    form.addEventListener('submit', async function (evt) {
      evt.preventDefault();
      setLoginError('');
      hideBanner('error');

      var email = (emailInput ? emailInput.value : '').trim().toLowerCase();
      var pat   = (patInput   ? patInput.value   : '').trim();

      // ── Basic client-side validation ──
      if (!email) {
        setLoginError('Please enter your UBF corporate email address.');
        return;
      }

      // Accept any email for login; role defaults to Staff if not in map
      var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(email)) {
        setLoginError('Please enter a valid email address.');
        return;
      }

      if (!pat) {
        setLoginError('Please enter your GitHub Personal Access Token.');
        return;
      }

      // PATs start with ghp_ (classic) or github_pat_ (fine-grained)
      if (!pat.startsWith('ghp_') && !pat.startsWith('github_pat_')) {
        setLoginError(
          'The token format looks incorrect. ' +
          'Classic PATs start with "ghp_" and fine-grained tokens start with "github_pat_".'
        );
        return;
      }

      setLoading(true);

      try {
        // Persist credentials before attempting API call
        DS.saveSession(email, pat);

        // Validate the PAT by attempting a real read of the database.
        // This confirms both the token's validity AND repo access in one shot.
        await DS.readDatabase();

        // Success — go to dashboard
        navigateTo('dashboard.html');

      } catch (err) {
        // Roll back the saved session so the guard doesn't let them through
        DS.clearSession();
        setLoginError(
          'Login failed: ' + (err.message || 'Unable to verify credentials. ' +
          'Check your token and ensure it has "repo" scope.')
        );
        setLoading(false);
      }
    });
  }

  /* ═══════════════════════════════════════════════════════
     PAGE: dashboard.html
  ═══════════════════════════════════════════════════════ */

  // Module-level cache so filter/search don't re-fetch
  var _dashboardRecords = [];

  function renderDashboardStats(stats) {
    var fields = {
      'stat-total'   : stats.total,
      'stat-pending' : stats.pending,
      'stat-approved': stats.approved,
      'stat-rejected': stats.rejected,
      'stat-inreview': stats.inReview
    };
    Object.keys(fields).forEach(function (id) {
      var el = $id(id);
      if (el) el.textContent = fields[id];
    });
  }

  function buildDashboardRow(rec) {
    var creds     = DS.getCredentials();
    var role      = DS.getRole(creds.email);
    var canUpdate = ['Admin Officer', 'FAM', 'ED'].indexOf(role) !== -1;

    var actionsHtml = '';
    if (canUpdate && rec.status === 'Pending') {
      actionsHtml =
        '<button class="btn-action btn-approve" data-id="' + esc(rec.id) + '" data-action="Approved">Approve</button> ' +
        '<button class="btn-action btn-review"  data-id="' + esc(rec.id) + '" data-action="In Review">Review</button> ' +
        '<button class="btn-action btn-reject"  data-id="' + esc(rec.id) + '" data-action="Rejected">Reject</button>';
    } else if (canUpdate && rec.status === 'In Review') {
      actionsHtml =
        '<button class="btn-action btn-approve" data-id="' + esc(rec.id) + '" data-action="Approved">Approve</button> ' +
        '<button class="btn-action btn-reject"  data-id="' + esc(rec.id) + '" data-action="Rejected">Reject</button>';
    } else {
      actionsHtml = '<span class="text-muted">—</span>';
    }

    return (
      '<tr data-req-id="' + esc(rec.id) + '">' +
        '<td><a href="#" class="link-req-detail" data-id="' + esc(rec.id) + '">' + esc(rec.id) + '</a></td>' +
        '<td>' + esc(rec.title || '—') + '</td>' +
        '<td>' + esc(rec.category || '—') + '</td>' +
        '<td>' + esc(rec.submittedBy || '—') + '</td>' +
        '<td>' + formatDate(rec.createdAt) + '</td>' +
        '<td>' + formatCurrency(rec.estimatedCost, rec.currency) + '</td>' +
        '<td><span class="status-badge ' + statusClass(rec.status) + '">' + esc(rec.status) + '</span></td>' +
        '<td>' + actionsHtml + '</td>' +
      '</tr>'
    );
  }

  function renderDashboardTable(records) {
    var tbody  = $id('dashboard-table-body');
    var emptyEl = $id('dashboard-empty');
    if (!tbody) return;

    if (!records || records.length === 0) {
      tbody.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';
    tbody.innerHTML = records.map(buildDashboardRow).join('');
  }

  function applyDashboardFilters() {
    var filterStatus = $id('filter-status');
    var filterSearch = $id('filter-search');

    var statusVal = filterStatus ? filterStatus.value : '';
    var searchVal = filterSearch ? filterSearch.value.toLowerCase() : '';

    var filtered = _dashboardRecords.filter(function (rec) {
      var matchStatus = !statusVal || rec.status === statusVal;
      var matchSearch = !searchVal || (
        (rec.id          || '').toLowerCase().indexOf(searchVal) !== -1 ||
        (rec.title       || '').toLowerCase().indexOf(searchVal) !== -1 ||
        (rec.category    || '').toLowerCase().indexOf(searchVal) !== -1 ||
        (rec.submittedBy || '').toLowerCase().indexOf(searchVal) !== -1
      );
      return matchStatus && matchSearch;
    });

    renderDashboardTable(filtered);
  }

  async function initDashboardPage() {
    if (!$id('dashboard-container')) return;
    if (!enforceAuth()) return;
    populateNavbar();
    attachLogoutHandler();

    var loadingEl = $id('dashboard-loading');
    if (loadingEl) loadingEl.style.display = 'block';

    try {
      // Load stats and records in parallel
      var statsPromise   = DS.getDashboardStats();
      var recordsPromise = DS.getAllRequisitions();

      var stats   = await statsPromise;
      var records = await recordsPromise;

      _dashboardRecords = records;

      renderDashboardStats(stats);
      renderDashboardTable(records);

    } catch (err) {
      showBanner(err.message || 'Failed to load dashboard data.', 'error');
    } finally {
      if (loadingEl) loadingEl.style.display = 'none';
    }

    // ── Filter event listeners ──
    var filterStatus = $id('filter-status');
    var filterSearch = $id('filter-search');
    if (filterStatus) filterStatus.addEventListener('change', applyDashboardFilters);
    if (filterSearch) filterSearch.addEventListener('input',  applyDashboardFilters);

    // ── Table event delegation (approve/reject/review + detail link) ──
    var tbody = $id('dashboard-table-body');
    if (tbody) {
      tbody.addEventListener('click', async function (evt) {
        var target = evt.target;

        // Detail link click
        if (target.classList.contains('link-req-detail')) {
          evt.preventDefault();
          var recId  = target.getAttribute('data-id');
          var record = _dashboardRecords.find(function (r) { return r.id === recId; });
          if (record) openDetailModal(record);
          return;
        }

        // Action button click
        if (target.classList.contains('btn-action')) {
          var id     = target.getAttribute('data-id');
          var action = target.getAttribute('data-action');
          if (!id || !action) return;

          var note = '';
          if (action === 'Rejected') {
            note = prompt('Optional: Enter a reason for rejection (visible in history):') || '';
          } else if (action === 'In Review') {
            note = prompt('Optional: Add a review note:') || '';
          }

          target.disabled    = true;
          target.textContent = 'Saving…';

          try {
            await DS.updateRequisitionStatus(id, action, note);
            showBanner('Requisition ' + id + ' updated to "' + action + '".', 'success');

            // Reload data and re-render
            var updatedRecords = await DS.getAllRequisitions();
            _dashboardRecords  = updatedRecords;
            var updatedStats   = await DS.getDashboardStats();
            renderDashboardStats(updatedStats);
            applyDashboardFilters();

          } catch (err) {
            showBanner(err.message || 'Failed to update status.', 'error');
            target.disabled    = false;
            target.textContent = action === 'Approved' ? 'Approve' :
                                 action === 'Rejected' ? 'Reject'  : 'Review';
          }
        }
      });
    }
  }

  /* ─────────────────────────────────────────────
     REQUISITION DETAIL MODAL (Dashboard)
  ───────────────────────────────────────────── */

  function openDetailModal(record) {
    var overlay = $id('modal-overlay');
    var content = $id('modal-content');
    if (!overlay || !content) {
      // Fallback: show JSON in a new window if no modal markup exists
      var w = global.open('', '_blank');
      w.document.write('<pre>' + esc(JSON.stringify(record, null, 2)) + '</pre>');
      return;
    }

    var attachmentsHtml = '';
    if (record.attachments && record.attachments.length > 0) {
      attachmentsHtml = '<ul class="attachment-list">' +
        record.attachments.map(function (a) {
          return '<li><a href="' + esc(a.downloadUrl) + '" target="_blank" rel="noopener">' +
                 esc(a.name) + '</a> (' + formatFileSize(a.size) + ')</li>';
        }).join('') +
        '</ul>';
    } else {
      attachmentsHtml = '<p class="text-muted">No attachments.</p>';
    }

    var historyHtml = '';
    if (record.history && record.history.length > 0) {
      historyHtml = '<ol class="history-list">' +
        record.history.map(function (h) {
          return '<li><strong>' + esc(h.action) + '</strong> by ' + esc(h.by) +
                 ' (' + esc(h.role || '') + ') on ' + formatDate(h.at) +
                 (h.note ? ' — ' + esc(h.note) : '') + '</li>';
        }).join('') +
        '</ol>';
    } else {
      historyHtml = '<p class="text-muted">No history entries.</p>';
    }

    content.innerHTML =
      '<h2 class="modal-title">' + esc(record.id) + ' — ' + esc(record.title) + '</h2>' +
      '<div class="modal-grid">' +

        '<div class="modal-section">' +
          '<h3>Details</h3>' +
          '<table class="detail-table">' +
            '<tr><th>Category</th><td>'         + esc(record.category)        + '</td></tr>' +
            '<tr><th>Urgency</th><td>'           + esc(record.urgency)         + '</td></tr>' +
            '<tr><th>Quantity</th><td>'          + esc(record.quantity)        + ' ' + esc(record.unit) + '</td></tr>' +
            '<tr><th>Estimated Cost</th><td>'    + formatCurrency(record.estimatedCost, record.currency) + '</td></tr>' +
            '<tr><th>Project Code</th><td>'      + esc(record.projectCode)     + '</td></tr>' +
            '<tr><th>Delivery Date</th><td>'     + formatDate(record.deliveryDate) + '</td></tr>' +
            '<tr><th>Delivery Address</th><td>'  + esc(record.deliveryAddress) + '</td></tr>' +
            '<tr><th>Submitted By</th><td>'      + esc(record.submittedBy)     + '</td></tr>' +
            '<tr><th>Role</th><td>'              + esc(record.submittedByRole) + '</td></tr>' +
            '<tr><th>Submitted On</th><td>'      + formatDate(record.createdAt)+ '</td></tr>' +
            '<tr><th>Status</th><td><span class="status-badge ' + statusClass(record.status) + '">' + esc(record.status) + '</span></td></tr>' +
          '</table>' +
        '</div>' +

        '<div class="modal-section">' +
          '<h3>Description</h3>' +
          '<p>' + esc(record.description) + '</p>' +
          '<h3>Justification</h3>' +
          '<p>' + esc(record.justification) + '</p>' +
        '</div>' +

      '</div>' +

      '<div class="modal-section">' +
        '<h3>Attachments</h3>' +
        attachmentsHtml +
      '</div>' +

      '<div class="modal-section">' +
        '<h3>Audit History</h3>' +
        historyHtml +
      '</div>';

    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeDetailModal() {
    var overlay = $id('modal-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  function attachModalHandlers() {
    var closeBtn = $id('btn-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', closeDetailModal);

    var overlay = $id('modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', function (evt) {
        // Close when clicking the backdrop itself (not the modal box)
        if (evt.target === overlay) closeDetailModal();
      });
    }

    // Close on Escape key
    document.addEventListener('keydown', function (evt) {
      if (evt.key === 'Escape') closeDetailModal();
    });
  }

  /* ═══════════════════════════════════════════════════════
     PAGE: form.html  (NEW REQUISITION)
  ═══════════════════════════════════════════════════════ */

  async function initFormPage() {
    if (!$id('requisition-form')) return;
    if (!enforceAuth()) return;
    populateNavbar();
    attachLogoutHandler();

    // Pre-fill the submitter info display fields
    try {
      var creds = DS.getCredentials();
      var nameEl = $id('form-submitter-name');
      var roleEl = $id('form-submitter-role');
      if (nameEl) nameEl.textContent = creds.email;
      if (roleEl) roleEl.textContent = DS.getRole(creds.email);
    } catch (_) { /* ignore */ }

    var form         = $id('requisition-form');
    var btnSubmit    = $id('btn-submit-requisition');
    var loadingEl    = $id('form-loading');
    var attachInput  = $id('form-attachments');

    // Live file size display (optional UX improvement)
    if (attachInput) {
      attachInput.addEventListener('change', function () {
        var files     = Array.from(attachInput.files || []);
        var totalSize = files.reduce(function (sum, f) { return sum + f.size; }, 0);
        var display   = $id('form-attachment-info');
        if (display) {
          display.textContent = files.length > 0
            ? files.length + ' file(s) selected — ' + formatFileSize(totalSize) + ' total'
            : '';
        }
      });
    }

    form.addEventListener('submit', async function (evt) {
      evt.preventDefault();
      hideBanner('error');
      hideBanner('success');

      // ── Collect form values ──
      var formData = {
        title           : getFieldValue('form-title'),
        category        : getFieldValue('form-category'),
        description     : getFieldValue('form-description'),
        quantity        : getFieldValue('form-quantity'),
        unit            : getFieldValue('form-unit'),
        estimatedCost   : getFieldValue('form-estimated-cost'),
        currency        : getFieldValue('form-currency') || 'UGX',
        urgency         : getFieldValue('form-urgency')  || 'Normal',
        projectCode     : getFieldValue('form-project-code'),
        deliveryDate    : getFieldValue('form-delivery-date'),
        deliveryAddress : getFieldValue('form-delivery-address'),
        justification   : getFieldValue('form-justification')
      };

      // ── Validation ──
      var validationError = validateRequisitionForm(formData);
      if (validationError) {
        showBanner(validationError, 'error');
        return;
      }

      // ── UI: disable and show spinner ──
      if (btnSubmit)  { btnSubmit.disabled = true; btnSubmit.textContent = 'Submitting…'; }
      if (loadingEl)  loadingEl.style.display = 'block';

      try {
        var files  = attachInput ? attachInput.files : null;
        var record = await DS.submitRequisition(formData, files);

        showBanner(
          'Requisition ' + record.id + ' submitted successfully! It is now Pending review.',
          'success'
        );

        // Reset form
        form.reset();
        var attachInfo = $id('form-attachment-info');
        if (attachInfo) attachInfo.textContent = '';

        // Optional: redirect to dashboard after 3 seconds
        setTimeout(function () {
          navigateTo('dashboard.html');
        }, 3000);

      } catch (err) {
        showBanner(err.message || 'Submission failed. Please try again.', 'error');
      } finally {
        if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.textContent = 'Submit Requisition'; }
        if (loadingEl) loadingEl.style.display = 'none';
      }
    });
  }

  /** Reads trimmed value from a form field by ID. */
  function getFieldValue(id) {
    var el = $id(id);
    if (!el) return '';
    return el.value ? el.value.trim() : '';
  }

  /** Returns an error message string if invalid, or '' if valid. */
  function validateRequisitionForm(data) {
    if (!data.title)           return 'Please provide a requisition title.';
    if (!data.category)        return 'Please select a procurement category.';
    if (!data.description)     return 'Please provide a description of the item(s) required.';
    if (!data.quantity)        return 'Please enter the quantity required.';
    if (isNaN(parseFloat(data.quantity)) || parseFloat(data.quantity) <= 0) {
      return 'Quantity must be a positive number.';
    }
    if (!data.estimatedCost)   return 'Please provide an estimated cost.';
    if (isNaN(parseFloat(data.estimatedCost)) || parseFloat(data.estimatedCost) < 0) {
      return 'Estimated cost must be a non-negative number.';
    }
    if (!data.justification)   return 'Please provide a justification for this requisition.';
    return '';
  }

  /* ═══════════════════════════════════════════════════════
     PAGE: history.html
  ═══════════════════════════════════════════════════════ */

  var _historyRecords = [];

  function buildHistoryRow(rec) {
    return (
      '<tr>' +
        '<td><a href="#" class="link-history-detail" data-id="' + esc(rec.id) + '">' + esc(rec.id) + '</a></td>' +
        '<td>' + esc(rec.title || '—') + '</td>' +
        '<td>' + esc(rec.category || '—') + '</td>' +
        '<td>' + esc(rec.submittedBy || '—') + '</td>' +
        '<td>' + formatDate(rec.createdAt) + '</td>' +
        '<td>' + formatDate(rec.updatedAt) + '</td>' +
        '<td>' + formatCurrency(rec.estimatedCost, rec.currency) + '</td>' +
        '<td><span class="status-badge ' + statusClass(rec.status) + '">' + esc(rec.status) + '</span></td>' +
        '<td>' + (rec.history && rec.history.length ? rec.history[rec.history.length - 1].by : '—') + '</td>' +
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
    var filterStatus = $id('history-filter-status');
    var filterSearch = $id('history-filter-search');

    var statusVal = filterStatus ? filterStatus.value : '';
    var searchVal = filterSearch ? filterSearch.value.toLowerCase() : '';

    var filtered = _historyRecords.filter(function (rec) {
      var matchStatus = !statusVal || rec.status === statusVal;
      var matchSearch = !searchVal || (
        (rec.id          || '').toLowerCase().indexOf(searchVal) !== -1 ||
        (rec.title       || '').toLowerCase().indexOf(searchVal) !== -1 ||
        (rec.submittedBy || '').toLowerCase().indexOf(searchVal) !== -1
      );
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
      var records   = await DS.getAllRequisitions();
      _historyRecords = records;
      renderHistoryTable(records);
    } catch (err) {
      showBanner(err.message || 'Failed to load history.', 'error');
    } finally {
      if (loadingEl) loadingEl.style.display = 'none';
    }

    // Filter listeners
    var filterStatus = $id('history-filter-status');
    var filterSearch = $id('history-filter-search');
    if (filterStatus) filterStatus.addEventListener('change', applyHistoryFilters);
    if (filterSearch) filterSearch.addEventListener('input',  applyHistoryFilters);

    // Table delegation — detail row click
    var tbody = $id('history-table-body');
    if (tbody) {
      tbody.addEventListener('click', function (evt) {
        if (evt.target.classList.contains('link-history-detail')) {
          evt.preventDefault();
          var recId  = evt.target.getAttribute('data-id');
          var record = _historyRecords.find(function (r) { return r.id === recId; });
          if (record) openDetailModal(record);
        }
      });
    }
  }

  /* ─────────────────────────────────────────────
     MISC UTILITIES
  ───────────────────────────────────────────── */

  function formatFileSize(bytes) {
    if (!bytes || isNaN(bytes)) return '0 B';
    var sizes = ['B', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + sizes[i];
  }

  /* ═══════════════════════════════════════════════════════
     MAIN ENTRY POINT
     DOMContentLoaded fires once the HTML is parsed; we then
     detect which page we're on and initialise the right module.
  ═══════════════════════════════════════════════════════ */

  document.addEventListener('DOMContentLoaded', function () {

    // Attach modal close handlers on any page that has a modal
    attachModalHandlers();

    // ── Page detection and initialisation ──
    if ($id('login-form')) {
      initLoginPage();
      return;
    }

    if ($id('dashboard-container')) {
      initDashboardPage();
      return;
    }

    if ($id('requisition-form')) {
      initFormPage();
      return;
    }

    if ($id('history-container')) {
      initHistoryPage();
      return;
    }

    // Fallback: at minimum wire up the logout button on any page
    attachLogoutHandler();
    populateNavbar();
  });

}(window));
