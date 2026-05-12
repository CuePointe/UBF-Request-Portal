/**
 * data.js — GitHub REST API Data Layer
 * Uganda Biodiversity Fund (UBF) Request Portal
 *
 * APPROVAL WORKFLOW:
 *   1. Staff submits
 *   2. Susan Abonyo (Admin Officer) reviews
 *   3. Winnie Nabatanzi (FAM) clears
 *   4. Ivan Amanigaruhanga (ED) approves
 */

(function (global) {
  'use strict';

  /* ─────────────────────────────────────────────
     1. CONFIGURATION
  ───────────────────────────────────────────── */
  var CONFIG = {
    API_BASE : 'https://api.github.com',
    OWNER    : 'CuePointe',
    REPO     : 'UBF-Request-Portal',
    DB_PATH  : 'data/requisitions.json',
    BRANCH   : 'main'
  };

  /* ─────────────────────────────────────────────
     2. UBF STAFF ROSTER — exactly as provided
  ───────────────────────────────────────────── */
  var STAFF = {
    'i.amani@ugandabiodiversityfund.org': {
      name : 'Ivan Amanigaruhanga',
      role : 'ED',
      title: 'Executive Director'
    },
    'w.nabatanzi@ugandabiodiversityfund.org': {
      name : 'Winnie Nabatanzi',
      role : 'FAM',
      title: 'Finance and Administration Manager'
    },
    's.abonyo@ugandabiodiversityfund.org': {
      name : 'Susan Abonyo',
      role : 'Admin Officer',
      title: 'Administration Officer'
    },
    'd.okullu@ugandabiodiversityfund.org': {
      name : 'David Okullu',
      role : 'Staff',
      title: 'Staff'
    },
    'p.musiime@ugandabiodiversityfund.org': {
      name : 'Posiano Musiime',
      role : 'Staff',
      title: 'Staff'
    },
    'o.atuhaire@ugandabiodiversityfund.org': {
      name : 'Owen Atuhaire',
      role : 'Staff',
      title: 'Staff'
    },
    't.otieno@ugandabiodiversityfund.org': {
      name : 'Tom Otieno',
      role : 'Staff',
      title: 'Staff'
    }
  };

  /* ─────────────────────────────────────────────
     3. APPROVAL WORKFLOW DEFINITION
        Each step defines who can action it and
        what status it sets when actioned.
  ───────────────────────────────────────────── */
  var WORKFLOW = [
    {
      step        : 1,
      label       : 'Submitted',
      actionLabel : 'Submit',
      byRole      : 'Staff',
      status      : 'Pending Review'
    },
    {
      step        : 2,
      label       : 'Reviewed',
      actionLabel : 'Mark as Reviewed',
      byRole      : 'Admin Officer',
      byName      : 'Susan Abonyo',
      byTitle     : 'Administration Officer',
      status      : 'Reviewed'
    },
    {
      step        : 3,
      label       : 'Cleared',
      actionLabel : 'Clear',
      byRole      : 'FAM',
      byName      : 'Winnie Nabatanzi',
      byTitle     : 'Finance and Administration Manager',
      status      : 'Cleared'
    },
    {
      step        : 4,
      label       : 'Approved',
      actionLabel : 'Approve',
      byRole      : 'ED',
      byName      : 'Ivan Amanigaruhanga',
      byTitle     : 'Executive Director',
      status      : 'Approved'
    }
  ];

  /* Which statuses each role can action */
  var ROLE_ACTIONS = {
    'Admin Officer': { canAction: ['Pending Review'], nextStatus: 'Reviewed',     rejectStatus: 'Rejected' },
    'FAM'          : { canAction: ['Reviewed'],       nextStatus: 'Cleared',      rejectStatus: 'Rejected' },
    'ED'           : { canAction: ['Cleared'],        nextStatus: 'Approved',     rejectStatus: 'Rejected' }
  };

  /* Roles that can see ALL requisitions */
  var ELEVATED_ROLES = ['Admin Officer', 'FAM', 'ED'];

  /* ─────────────────────────────────────────────
     4. HELPERS
  ───────────────────────────────────────────── */
  function getStaff(email) {
    if (!email) return { name: email, role: 'Staff', title: 'Staff' };
    return STAFF[email.trim().toLowerCase()] || { name: email, role: 'Staff', title: 'Staff' };
  }

  function getRole(email) {
    return getStaff(email).role;
  }

  function getDisplayName(email) {
    return getStaff(email).name;
  }

  function getTitle(email) {
    return getStaff(email).title;
  }

  function getCredentials() {
    var email = localStorage.getItem('ubf_email');
    var pat   = localStorage.getItem('ubf_pat');
    if (!email || !pat) throw new Error('Session expired. Please log in again.');
    return { email: email, pat: pat };
  }

  function buildApiUrl(filePath) {
    return CONFIG.API_BASE + '/repos/' + CONFIG.OWNER + '/' + CONFIG.REPO + '/contents/' + filePath;
  }

  function buildHeaders(pat) {
    return {
      'Authorization'        : 'token ' + pat,
      'Content-Type'         : 'application/json',
      'Accept'               : 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version' : '2022-11-28'
    };
  }

  function encodeJsonToBase64(obj) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(obj, null, 2))));
  }

  function decodeBase64ToJson(b64) {
    return JSON.parse(decodeURIComponent(escape(atob(b64.replace(/[\n\r]/g, '')))));
  }

  function generateId() {
    var n    = new Date();
    var rand = Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0');
    return 'UBF-' +
      n.getFullYear() +
      String(n.getMonth() + 1).padStart(2, '0') +
      String(n.getDate()).padStart(2, '0') +
      '-' + rand;
  }

  function buildApiError(status, msg) {
    if (status === 401) return 'Authentication failed (HTTP 401). Your token is invalid or expired.';
    if (status === 403) return "GitHub rejected the request (HTTP 403). Ensure your token has 'repo' write access.";
    if (status === 404) return 'File not found (HTTP 404). Check that data/requisitions.json exists in the repo.';
    if (status === 409) return 'Conflict (HTTP 409). Please refresh and try again.';
    if (status === 422) return 'SHA mismatch (HTTP 422). Please refresh the page and try again.';
    return 'GitHub API error (HTTP ' + status + '): ' + (msg || 'Unknown error');
  }

  /* ─────────────────────────────────────────────
     5. DATABASE READ / WRITE
  ───────────────────────────────────────────── */
  async function readDatabase() {
    var creds    = getCredentials();
    var response = await fetch(buildApiUrl(CONFIG.DB_PATH) + '?_=' + Date.now(), {
      method: 'GET', headers: buildHeaders(creds.pat)
    });
    if (!response.ok) {
      var e = {}; try { e = await response.json(); } catch (_) {}
      throw new Error(buildApiError(response.status, e.message));
    }
    var f = await response.json();
    var r = decodeBase64ToJson(f.content);
    return { records: Array.isArray(r) ? r : [], sha: f.sha };
  }

  async function writeDatabase(records, sha, message) {
    var creds    = getCredentials();
    var response = await fetch(buildApiUrl(CONFIG.DB_PATH), {
      method  : 'PUT',
      headers : buildHeaders(creds.pat),
      body    : JSON.stringify({
        message : message || 'UBF Portal update',
        content : encodeJsonToBase64(records),
        sha     : sha,
        branch  : CONFIG.BRANCH
      })
    });
    if (!response.ok) {
      var e = {}; try { e = await response.json(); } catch (_) {}
      throw new Error(buildApiError(response.status, e.message));
    }
    return await response.json();
  }

  /* ─────────────────────────────────────────────
     6. ATTACHMENT UPLOAD
  ───────────────────────────────────────────── */
  function uploadAttachment(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Cannot read: ' + file.name)); };
      reader.onload  = async function (evt) {
        try {
          var creds = getCredentials();
          var b64   = evt.target.result.split(',')[1];
          var safe  = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          var path  = 'attachments/' + Date.now() + '_' + safe;
          var res   = await fetch(buildApiUrl(path), {
            method  : 'PUT',
            headers : buildHeaders(creds.pat),
            body    : JSON.stringify({
              message : 'Attachment: ' + safe + ' [UBF Portal]',
              content : b64,
              branch  : CONFIG.BRANCH
            })
          });
          if (!res.ok) {
            var e = {}; try { e = await res.json(); } catch (_) {}
            throw new Error(buildApiError(res.status, e.message));
          }
          var result = await res.json();
          resolve({
            path       : path,
            downloadUrl: result.content.html_url,
            name       : file.name,
            size       : file.size
          });
        } catch (err) { reject(err); }
      };
      reader.readAsDataURL(file);
    });
  }

  async function uploadAllAttachments(fileList) {
    var results = [];
    var files   = Array.from(fileList || []);
    for (var i = 0; i < files.length; i++) {
      results.push(await uploadAttachment(files[i]));
    }
    return results;
  }

  /* ─────────────────────────────────────────────
     7. ROLE-BASED FILTERING
  ───────────────────────────────────────────── */
  function filterByRole(records, email) {
    var role = getRole(email);
    if (ELEVATED_ROLES.indexOf(role) !== -1) return records;
    return records.filter(function (r) {
      return r.submittedBy && r.submittedBy.toLowerCase() === email.toLowerCase();
    });
  }

  /* ─────────────────────────────────────────────
     8. HIGH-LEVEL API
  ───────────────────────────────────────────── */
  async function getAllRequisitions() {
    var creds   = getCredentials();
    var db      = await readDatabase();
    var visible = filterByRole(db.records, creds.email);
    return visible.sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  async function submitRequisition(formData, files) {
    var creds       = getCredentials();
    var db          = await readDatabase();
    var attachments = [];
    if (files && files.length > 0) {
      attachments = await uploadAllAttachments(Array.from(files));
    }
    var now = new Date().toISOString();
    var rec = {
      id             : generateId(),
      /* Official UBF form fields only */
      activityCode   : formData.activityCode   || '',
      description    : formData.description    || '',
      specification  : formData.specification  || '',
      quantity       : formData.quantity       || '',
      unit           : formData.unit           || '',
      dateRequired   : formData.dateRequired   || '',
      locationOfWork : formData.locationOfWork || '',
      contractPeriod : formData.contractPeriod || '',
      accountCode    : formData.accountCode    || '',
      accountName    : formData.accountName    || '',
      donorCode      : formData.donorCode      || '',
      donorName      : formData.donorName      || '',
      department     : formData.department     || '',
      budgetCode     : formData.budgetCode     || '',
      estimatedCost  : formData.estimatedCost  || '',
      currency       : formData.currency       || 'UGX',
      /* Meta */
      submittedBy    : creds.email,
      submittedByName: getDisplayName(creds.email),
      submittedByTitle: getTitle(creds.email),
      submittedByRole: getRole(creds.email),
      status         : 'Pending Review',
      attachments    : attachments,
      createdAt      : now,
      updatedAt      : now,
      /* Approval chain — 4 steps */
      approval: {
        review  : { status: 'Pending', by: '', byName: '', at: '', note: '' },
        clearance: { status: 'Pending', by: '', byName: '', at: '', note: '' },
        approval: { status: 'Pending', by: '', byName: '', at: '', note: '' }
      },
      history: [{
        action : 'Submitted',
        by     : creds.email,
        byName : getDisplayName(creds.email),
        byTitle: getTitle(creds.email),
        at     : now,
        note   : 'Initial submission'
      }]
    };
    db.records.push(rec);
    await writeDatabase(db.records, db.sha,
      'New requisition ' + rec.id + ' submitted by ' + creds.email);
    return rec;
  }

  async function updateRequisitionStatus(id, newStatus, note) {
    var creds = getCredentials();
    var db    = await readDatabase();
    var idx   = db.records.findIndex(function (r) { return r.id === id; });
    if (idx === -1) throw new Error('Requisition not found: ' + id);

    var role    = getRole(creds.email);
    var allowed = ROLE_ACTIONS[role];
    if (!allowed) throw new Error('Your role (' + role + ') cannot update requisition status.');

    var now = new Date().toISOString();
    db.records[idx].status    = newStatus;
    db.records[idx].updatedAt = now;

    /* Update the relevant approval step */
    if (role === 'Admin Officer' && newStatus === 'Reviewed') {
      db.records[idx].approval.review = {
        status: 'Reviewed', by: creds.email,
        byName: getDisplayName(creds.email), at: now, note: note || ''
      };
    } else if (role === 'FAM' && newStatus === 'Cleared') {
      db.records[idx].approval.clearance = {
        status: 'Cleared', by: creds.email,
        byName: getDisplayName(creds.email), at: now, note: note || ''
      };
    } else if (role === 'ED' && newStatus === 'Approved') {
      db.records[idx].approval.approval = {
        status: 'Approved', by: creds.email,
        byName: getDisplayName(creds.email), at: now, note: note || ''
      };
    }

    db.records[idx].history.push({
      action : newStatus,
      by     : creds.email,
      byName : getDisplayName(creds.email),
      byTitle: getTitle(creds.email),
      at     : now,
      note   : note || ''
    });

    await writeDatabase(db.records, db.sha,
      'Status: ' + id + ' -> ' + newStatus + ' by ' + creds.email);
    return db.records[idx];
  }

  async function getDashboardStats() {
    var records = await getAllRequisitions();
    var s = {
      total         : records.length,
      pendingReview : 0,
      reviewed      : 0,
      cleared       : 0,
      approved      : 0,
      rejected      : 0
    };
    records.forEach(function (r) {
      var st = (r.status || '').toLowerCase();
      if (st === 'pending review') s.pendingReview++;
      else if (st === 'reviewed')  s.reviewed++;
      else if (st === 'cleared')   s.cleared++;
      else if (st === 'approved')  s.approved++;
      else if (st === 'rejected')  s.rejected++;
    });
    return s;
  }

  /* ─────────────────────────────────────────────
     9. SESSION HELPERS
  ───────────────────────────────────────────── */
  function saveSession(email, pat) {
    localStorage.setItem('ubf_email', email);
    localStorage.setItem('ubf_pat', pat);
  }
  function clearSession() {
    localStorage.removeItem('ubf_email');
    localStorage.removeItem('ubf_pat');
  }
  function isAuthenticated() {
    return !!(localStorage.getItem('ubf_email') && localStorage.getItem('ubf_pat'));
  }

  /* ─────────────────────────────────────────────
     10. EXPOSE via window.DataService
  ───────────────────────────────────────────── */
  global.DataService = {
    CONFIG,
    WORKFLOW,
    ROLE_ACTIONS,
    saveSession,
    clearSession,
    isAuthenticated,
    getCredentials,
    getRole,
    getDisplayName,
    getTitle,
    getStaff,
    readDatabase,
    writeDatabase,
    uploadAttachment,
    uploadAllAttachments,
    getAllRequisitions,
    submitRequisition,
    updateRequisitionStatus,
    getDashboardStats
  };

}(window));
