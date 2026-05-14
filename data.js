/**
 * data.js — GitHub REST API Data Layer
 * Uganda Biodiversity Fund (UBF) Logistics & Procurement System
 *
 * APPROVAL WORKFLOW (5 steps):
 *   1. Staff submits
 *   2. Admin Officer (Susan Abonyo) — Prepares
 *   3. Finance Officer — Reviews (FAM acting on this role until hired)
 *   4. FAM (Winnie Nabatanzi) — Clears
 *   5. ED (Ivan Amanigaruhanga) — Approves
 *
 * AUTHENTICATION:
 *   Serverless password auth — passwords are SHA-256 hashed in the browser.
 *   The shared GitHub PAT is embedded here (invisible to staff).
 *   Staff log in with email + password only.
 */

(function (global) {
  'use strict';

  /* ─────────────────────────────────────────────
     1. CONFIGURATION
     IMPORTANT: Replace SHARED_TOKEN with your
     actual ghp_... token before uploading.
  ───────────────────────────────────────────── */
  var CONFIG = {
    API_BASE     : 'https://api.github.com',
    OWNER        : 'CuePointe',
    REPO         : 'UBF-Request-Portal',
    DB_PATH      : 'data/requisitions.json',
    USERS_PATH   : 'data/users.json',
    BRANCH       : 'main',
    // Pull the token dynamically from browser memory
    SHARED_TOKEN : localStorage.getItem('ubf_gh_token'),
    SESSION_KEY  : 'ubf_session',
    PASS_EXPIRY_DAYS: 90
};

// Prompt for the token if it's not saved locally yet
if (!CONFIG.SHARED_TOKEN) {
    var userToken = prompt("Please enter your fresh GitHub Personal Access Token:");
    if (userToken) {
        localStorage.setItem('ubf_gh_token', userToken.trim());
        CONFIG.SHARED_TOKEN = userToken.trim();
    }
}

  /* ─────────────────────────────────────────────
     2. ROLE DEFINITIONS
  ───────────────────────────────────────────── */
  /* Roles that can see ALL requisitions */
  var ELEVATED_ROLES = ['Admin Officer', 'Finance Officer', 'FAM', 'ED', 'Developer'];

  /* What each role can action and what status results */
  var ROLE_ACTIONS = {
    'Admin Officer'    : { canAction: ['Pending'],   nextStatus: 'Prepared',  rejectStatus: 'Rejected', actionLabel: 'Mark Prepared' },
    'Finance Officer'  : { canAction: ['Prepared'],  nextStatus: 'Reviewed',  rejectStatus: 'Rejected', actionLabel: 'Mark Reviewed' },
    'FAM'              : { canAction: ['Reviewed'],  nextStatus: 'Cleared',   rejectStatus: 'Rejected', actionLabel: 'Clear' },
    'ED'               : { canAction: ['Cleared'],   nextStatus: 'Approved',  rejectStatus: 'Rejected', actionLabel: 'Approve' }
  };

  /* FAM also covers Finance Officer step until FO is hired */
  var FAM_COVERS_FO = true;

  /* ─────────────────────────────────────────────
     3. PASSWORD UTILITIES
  ───────────────────────────────────────────── */

  /**
   * SHA-256 hash a string using the browser's SubtleCrypto API.
   * Returns a hex string.
   */
  async function sha256(str) {
    var msgBuffer = new TextEncoder().encode(str);
    var hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    var hashArray  = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  /**
   * Check if a password expiry date has passed.
   */
  function isPasswordExpired(expiryDateString) {
    if (!expiryDateString) return false;
    return new Date(expiryDateString) < new Date();
  }

  /**
   * Calculate new expiry date (90 days from now).
   */
  function newExpiryDate() {
    var d = new Date();
    d.setDate(d.getDate() + CONFIG.PASS_EXPIRY_DAYS);
    return d.toISOString().split('T')[0];
  }

  /* ─────────────────────────────────────────────
     4. API HELPERS
  ───────────────────────────────────────────── */
  function buildApiUrl(filePath) {
    return CONFIG.API_BASE + '/repos/' + CONFIG.OWNER + '/' + CONFIG.REPO + '/contents/' + filePath;
  }

  function buildHeaders() {
    var token = CONFIG.SHARED_TOKEN;
    return {
      'Authorization'        : 'token ' + token,
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
    if (status === 401) return 'Authentication failed (HTTP 401). Contact the system administrator.';
    if (status === 403) return "Permission denied (HTTP 403). Contact the system administrator.";
    if (status === 404) return 'System file not found (HTTP 404). Contact the system administrator.';
    if (status === 409) return 'Data conflict (HTTP 409). Please refresh and try again.';
    if (status === 422) return 'Data sync error (HTTP 422). Please refresh and try again.';
    return 'System error (HTTP ' + status + '): ' + (msg || 'Unknown error');
  }

  /* ─────────────────────────────────────────────
     5. GENERIC FILE READ / WRITE
  ───────────────────────────────────────────── */
  async function readFile(filePath) {
    var response = await fetch(buildApiUrl(filePath) + '?_=' + Date.now(), {
      method: 'GET', headers: buildHeaders()
    });
    if (!response.ok) {
      var e = {}; try { e = await response.json(); } catch (_) {}
      throw new Error(buildApiError(response.status, e.message));
    }
    var f = await response.json();
    return { data: decodeBase64ToJson(f.content), sha: f.sha };
  }

  async function writeFile(filePath, data, sha, message) {
    var response = await fetch(buildApiUrl(filePath), {
      method  : 'PUT',
      headers : buildHeaders(),
      body    : JSON.stringify({
        message : message || 'UBF System update',
        content : encodeJsonToBase64(data),
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
     6. USER MANAGEMENT & AUTHENTICATION
  ───────────────────────────────────────────── */

  /**
   * Read the users database from GitHub.
   */
  async function readUsers() {
    return await readFile(CONFIG.USERS_PATH);
  }

  /**
   * Authenticate a user with email + password.
   * Returns the user object if successful.
   */
  async function authenticateUser(email, password) {
    var emailLower = email.trim().toLowerCase();
    var hash       = await sha256(password);
    var result     = await readUsers();
    var users      = result.data;

    var user = users.find(function (u) {
      return u.email.toLowerCase() === emailLower;
    });

    if (!user)              throw new Error('No account found for this email address.');
    if (!user.active)       throw new Error('Your account has been deactivated. Contact the administrator.');
    if (user.passwordHash !== hash) throw new Error('Incorrect password. Please try again.');

    return { user: user, usersSha: result.sha, allUsers: users };
  }

  /**
   * Change a user's password.
   */
  async function changePassword(email, newPassword) {
    var result  = await readUsers();
    var users   = result.data;
    var idx     = users.findIndex(function (u) { return u.email.toLowerCase() === email.toLowerCase(); });
    if (idx === -1) throw new Error('User not found.');

    users[idx].passwordHash        = await sha256(newPassword);
    users[idx].passwordExpiry      = newExpiryDate();
    users[idx].mustChangePassword  = false;

    await writeFile(CONFIG.USERS_PATH, users, result.sha,
      'Password changed for ' + email);
    return true;
  }

  /* ─────────────────────────────────────────────
     7. SESSION MANAGEMENT
  ───────────────────────────────────────────── */
  function saveSession(user) {
    var session = {
      email    : user.email,
      name     : user.name,
      role     : user.role,
      title    : user.title,
      loginAt  : new Date().toISOString(),
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() /* 8 hour session */
    };
    localStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function getSession() {
    try {
      var raw = localStorage.getItem(CONFIG.SESSION_KEY);
      if (!raw) return null;
      var session = JSON.parse(raw);
      /* Check session expiry */
      if (new Date(session.expiresAt) < new Date()) {
        clearSession();
        return null;
      }
      return session;
    } catch (_) {
      return null;
    }
  }

  function clearSession() {
    localStorage.removeItem(CONFIG.SESSION_KEY);
    /* Also clear old token-based session keys */
    localStorage.removeItem('ubf_email');
    localStorage.removeItem('ubf_pat');
  }

  function isAuthenticated() {
    return !!getSession();
  }

  function requireSession() {
    var session = getSession();
    if (!session) throw new Error('Session expired. Please log in again.');
    return session;
  }

  /* ─────────────────────────────────────────────
     8. ROLE HELPERS
  ───────────────────────────────────────────── */
  function canSeeAll(role) {
    return ELEVATED_ROLES.indexOf(role) !== -1;
  }

  function getRoleActions(role) {
    /* FAM covers Finance Officer step until FO is hired */
    if (FAM_COVERS_FO && role === 'FAM') {
      return {
        canAction   : ['Prepared', 'Reviewed'],
        nextStatus  : null, /* determined dynamically */
        rejectStatus: 'Rejected'
      };
    }
    return ROLE_ACTIONS[role] || null;
  }

  function getNextStatus(role, currentStatus) {
    if (FAM_COVERS_FO && role === 'FAM') {
      if (currentStatus === 'Prepared')  return 'Reviewed';
      if (currentStatus === 'Reviewed')  return 'Cleared';
    }
    var actions = ROLE_ACTIONS[role];
    return actions ? actions.nextStatus : null;
  }

  function getActionLabel(role, currentStatus) {
    if (FAM_COVERS_FO && role === 'FAM') {
      if (currentStatus === 'Prepared')  return 'Mark Reviewed';
      if (currentStatus === 'Reviewed')  return 'Clear';
    }
    var actions = ROLE_ACTIONS[role];
    return actions ? actions.actionLabel : null;
  }

  function canActionRequisition(role, currentStatus) {
    if (!role) return false;
    var actions = getRoleActions(role);
    if (!actions) return false;
    return actions.canAction.indexOf(currentStatus) !== -1;
  }

  /* ─────────────────────────────────────────────
     9. DATABASE READ / WRITE
  ───────────────────────────────────────────── */
  async function readDatabase() {
    return await readFile(CONFIG.DB_PATH);
  }

  async function writeDatabase(records, sha, message) {
    return await writeFile(CONFIG.DB_PATH, records, sha, message);
  }

  /* ─────────────────────────────────────────────
     10. ATTACHMENT UPLOAD
  ───────────────────────────────────────────── */
  function uploadAttachment(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Cannot read: ' + file.name)); };
      reader.onload  = async function (evt) {
        try {
          var b64  = evt.target.result.split(',')[1];
          var safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          var path = 'attachments/' + Date.now() + '_' + safe;
          var res  = await fetch(buildApiUrl(path), {
            method  : 'PUT',
            headers : buildHeaders(),
            body    : JSON.stringify({
              message : 'Attachment: ' + safe + ' [UBF System]',
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
            size       : file.size,
            mimeType   : file.type,
            uploadedAt : new Date().toISOString()
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
     11. ROLE-BASED FILTERING
  ───────────────────────────────────────────── */
 function filterByRole(records, session) {
    if (!records || !Array.isArray(records)) return [];
    if (!session) return [];
    if (canSeeAll(session.role)) return records;
    return records.filter(function (r) {
      return r.submittedBy && r.submittedBy.toLowerCase() === session.email.toLowerCase();
    });
  }

  /* ─────────────────────────────────────────────
     12. REQUISITION CRUD
  ───────────────────────────────────────────── */
  async function getAllRequisitions() {
    var session = requireSession();
    var db      = await readDatabase();
    var records = db.records || [];
    var visible = filterByRole(records, session);
    return visible.sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  async function submitRequisition(formData, files, formType) {
    var session     = requireSession();
    var db          = await readDatabase();
    db.records      = db.records || [];
    var attachments = [];
    if (files && files.length > 0) {
      attachments = await uploadAllAttachments(Array.from(files));
    }
    var now = new Date().toISOString();
    var rec = {
      id             : generateId(),
      formType       : formType || 'request',  /* request | travel | accountability */
      data           : formData,               /* all form fields stored here */
      submittedBy    : session.email,
      submittedByName: session.name,
      submittedByTitle: session.title,
      submittedByRole: session.role,
      status         : 'Pending',
      attachments    : attachments,
      comments       : [],
      createdAt      : now,
      updatedAt      : now,
      approval: {
        preparation : { status: 'Pending', by: '', byName: '', at: '', note: '' },
        review      : { status: 'Pending', by: '', byName: '', at: '', note: '' },
        clearance   : { status: 'Pending', by: '', byName: '', at: '', note: '' },
        approval    : { status: 'Pending', by: '', byName: '', at: '', note: '' }
      },
      history: [{
        action : 'Submitted',
        by     : session.email,
        byName : session.name,
        byTitle: session.title,
        at     : now,
        note   : 'Initial submission'
      }]
    };
    db.records.push(rec);
    await writeDatabase(db.records, db.sha,
      'New ' + (formType || 'request') + ' ' + rec.id + ' by ' + session.email);
    return rec;
  }

  async function updateRequisitionStatus(id, newStatus, note) {
    var session = requireSession();
    var db        = await readDatabase();
    db.records    = db.records || [];
    var idx     = db.records.findIndex(function (r) { return r.id === id; });
    if (idx === -1) throw new Error('Requisition not found: ' + id);

    if (!canActionRequisition(session.role, db.records[idx].status)) {
      throw new Error('Your role cannot action a requisition with status "' + db.records[idx].status + '".');
    }

    var now = new Date().toISOString();
    db.records[idx].status    = newStatus;
    db.records[idx].updatedAt = now;

    /* Update approval chain */
    var approvalStep = null;
    if (newStatus === 'Prepared')  approvalStep = 'preparation';
    if (newStatus === 'Reviewed')  approvalStep = 'review';
    if (newStatus === 'Cleared')   approvalStep = 'clearance';
    if (newStatus === 'Approved')  approvalStep = 'approval';
    if (newStatus === 'Rejected')  approvalStep = null;

    if (approvalStep) {
      db.records[idx].approval[approvalStep] = {
        status: newStatus,
        by    : session.email,
        byName: session.name,
        at    : now,
        note  : note || ''
      };
    }

    db.records[idx].history.push({
      action : newStatus,
      by     : session.email,
      byName : session.name,
      byTitle: session.title,
      at     : now,
      note   : note || ''
    });

    await writeDatabase(db.records, db.sha,
      'Status: ' + id + ' -> ' + newStatus + ' by ' + session.email);
    return db.records[idx];
  }

  async function editRequisition(id, updatedFormData, files) {
    var session = requireSession();
    var db      = await readDatabase();
    db.records = db.records || [];
    var idx     = db.records.findIndex(function (r) { return r.id === id; });
    if (idx === -1) throw new Error('Requisition not found: ' + id);

    var rec = db.records[idx];
    /* Only submitter can edit, and only if Pending or Rejected */
    if (rec.submittedBy.toLowerCase() !== session.email.toLowerCase()) {
      throw new Error('You can only edit your own requisitions.');
    }
    if (['Prepared', 'Reviewed', 'Cleared', 'Approved'].indexOf(rec.status) !== -1) {
      throw new Error('This requisition is already in progress and cannot be edited.');
    }

    var newAttachments = [];
    if (files && files.length > 0) {
      newAttachments = await uploadAllAttachments(Array.from(files));
    }

    var now = new Date().toISOString();
    db.records[idx].data        = updatedFormData;
    db.records[idx].status      = 'Pending';
    db.records[idx].updatedAt   = now;
    db.records[idx].attachments = db.records[idx].attachments.concat(newAttachments);
    db.records[idx].approval    = {
      preparation : { status: 'Pending', by: '', byName: '', at: '', note: '' },
      review      : { status: 'Pending', by: '', byName: '', at: '', note: '' },
      clearance   : { status: 'Pending', by: '', byName: '', at: '', note: '' },
      approval    : { status: 'Pending', by: '', byName: '', at: '', note: '' }
    };
    db.records[idx].history.push({
      action : 'Edited & Resubmitted',
      by     : session.email,
      byName : session.name,
      byTitle: session.title,
      at     : now,
      note   : 'Requisition corrected and resubmitted'
    });

    await writeDatabase(db.records, db.sha,
      'Edit resubmit: ' + id + ' by ' + session.email);
    return db.records[idx];
  }

  /* ─────────────────────────────────────────────
     13. COMMENTS & REPLIES
  ───────────────────────────────────────────── */
  async function addComment(requisitionId, commentText) {
    var session = requireSession();
    var db      = await readDatabase();
    var idx     = db.records.findIndex(function (r) { return r.id === requisitionId; });
    if (idx === -1) throw new Error('Requisition not found.');

    var comment = {
      id      : 'CMT-' + Date.now(),
      by      : session.email,
      byName  : session.name,
      byTitle : session.title,
      byRole  : session.role,
      text    : commentText,
      at      : new Date().toISOString(),
      replies : []
    };

    if (!db.records[idx].comments) db.records[idx].comments = [];
    db.records[idx].comments.push(comment);
    db.records[idx].updatedAt = new Date().toISOString();

    await writeDatabase(db.records, db.sha,
      'Comment on ' + requisitionId + ' by ' + session.email);
    return comment;
  }

  async function addReply(requisitionId, commentId, replyText) {
    var session = requireSession();
    var db      = await readDatabase();
    db.records = db.records || [];
    var idx     = db.records.findIndex(function (r) { return r.id === requisitionId; });
    if (idx === -1) throw new Error('Requisition not found.');

    var comments = db.records[idx].comments || [];
    var cIdx     = comments.findIndex(function (c) { return c.id === commentId; });
    if (cIdx === -1) throw new Error('Comment not found.');

    var reply = {
      id     : 'RPL-' + Date.now(),
      by     : session.email,
      byName : session.name,
      byRole : session.role,
      text   : replyText,
      at     : new Date().toISOString()
    };

    db.records[idx].comments[cIdx].replies.push(reply);
    db.records[idx].updatedAt = new Date().toISOString();

    await writeDatabase(db.records, db.sha,
      'Reply on ' + requisitionId + ' by ' + session.email);
    return reply;
  }

  /* ─────────────────────────────────────────────
     14. DASHBOARD STATS
  ───────────────────────────────────────────── */
  async function getDashboardStats() {
    var records = (await getAllRequisitions()) || [];
    var s = { total: records.length, pending: 0, prepared: 0, reviewed: 0, cleared: 0, approved: 0, rejected: 0 };
    records.forEach(function (r) {
      var st = (r.status || '').toLowerCase();
      if (st === 'pending')   s.pending++;
      else if (st === 'prepared')  s.prepared++;
      else if (st === 'reviewed')  s.reviewed++;
      else if (st === 'cleared')   s.cleared++;
      else if (st === 'approved')  s.approved++;
      else if (st === 'rejected')  s.rejected++;
    });
    return s;
  }

  /* ─────────────────────────────────────────────
     15. EXPOSE via window.DataService
  ───────────────────────────────────────────── */
  global.DataService = {
    CONFIG,
    ROLE_ACTIONS,
    /* Auth */
    authenticateUser,
    changePassword,
    sha256,
    isPasswordExpired,
    /* Session */
    saveSession,
    getSession,
    clearSession,
    isAuthenticated,
    requireSession,
    /* Role helpers */
    canSeeAll,
    canActionRequisition,
    getNextStatus,
    getActionLabel,
    getRoleActions,
    /* File ops */
    readFile,
    writeFile,
    readDatabase,
    writeDatabase,
    readUsers,
    uploadAttachment,
    uploadAllAttachments,
    /* Requisitions */
    getAllRequisitions,
    submitRequisition,
    updateRequisitionStatus,
    editRequisition,
    /* Comments */
    addComment,
    addReply,
    /* Stats */
    getDashboardStats
  };

}(window));
