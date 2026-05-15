/**
 * data.js — GitHub REST API Data Layer
 * Uganda Biodiversity Fund (UBF) Logistics & Procurement System v3.0
 *
 * APPROVAL WORKFLOW:
 *   1. Staff submits          → Pending
 *   2. Admin Officer prepares → Prepared
 *   3. FAM reviews (Finance Officer role until hired) → Reviewed
 *   4. FAM clears             → Cleared
 *   5. ED approves            → Approved
 *
 * IMPORTANT: Replace SHARED_TOKEN with your actual ghp_... token.
 */

(function (global) {
  'use strict';

  /* ─────────────────────────────────────────────
     1. CONFIGURATION
  ───────────────────────────────────────────── */
  var CONFIG = {
    API_BASE: 'https://api.github.com',
    OWNER: 'CuePointe',
    REPO: 'UBF-Request-Portal',
    DB_PATH: 'data/requisitions.json',
    USERS_PATH: 'data/users.json',
    BRANCH: 'main',
    SHARED_TOKEN: localStorage.getItem('ubf_gatekeeper_token') || '',
    SESSION_KEY: 'ubf_session',
    PASS_EXPIRY_DAYS: 90
  };

  /* ─────────────────────────────────────────────
     2. STAFF ROSTER
  ───────────────────────────────────────────── */
  var STAFF = {
    'i.amani@ugandabiodiversityfund.org': {
      name: 'Ivan Amanigaruhanga', role: 'ED', title: 'Executive Director'
    },
    'w.nabatanzi@ugandabiodiversityfund.org': {
      name: 'Winnie Nabatanzi', role: 'FAM', title: 'Finance and Administration Manager'
    },
    's.abonyo@ugandabiodiversityfund.org': {
      name: 'Susan Abonyo', role: 'Admin Officer', title: 'Administration Officer'
    },
    'd.okullu@ugandabiodiversityfund.org': {
      name: 'David Okullu', role: 'Staff', title: 'M&E Officer'
    },
    'p.musiime@ugandabiodiversityfund.org': {
      name: 'Posiano Musiime', role: 'Staff', title: 'Programs Officer'
    },
    'o.atuhaire@ugandabiodiversityfund.org': {
      name: 'Owen Atuhaire', role: 'Staff', title: 'Project Officer'
    },
    't.otieno@ugandabiodiversityfund.org': {
      name: 'Thomas Otieno', role: 'Staff', title: 'Office Assistant'
    }
  };

  /* Roles that can see ALL records */
  var ELEVATED_ROLES = ['Admin Officer', 'Finance Officer', 'FAM', 'ED'];

  /* Workflow actions per role */
  var ROLE_ACTIONS = {
    'Admin Officer': { canAction: ['Pending'],            nextStatus: 'Prepared', actionLabel: 'Mark Prepared' },
    'Finance Officer': { canAction: ['Prepared'],         nextStatus: 'Reviewed', actionLabel: 'Mark Reviewed' },
    'FAM':            { canAction: ['Prepared','Reviewed'], nextStatus: null,      actionLabel: null },
    'ED':             { canAction: ['Cleared'],           nextStatus: 'Approved', actionLabel: 'Approve' }
  };

  /* ─────────────────────────────────────────────
     3. HELPERS
  ───────────────────────────────────────────── */
  function getStaff(email) {
    if (!email) return { name: '', role: 'Staff', title: 'Staff' };
    return STAFF[email.trim().toLowerCase()] || { name: email, role: 'Staff', title: 'Staff' };
  }

  function getRole(email)        { return getStaff(email).role;  }
  function getDisplayName(email) { return getStaff(email).name;  }
  function getTitle(email)       { return getStaff(email).title; }

  function canSeeAll(role) {
    return ELEVATED_ROLES.indexOf(role) !== -1;
  }

  function getNextStatus(role, currentStatus) {
    if (role === 'FAM') {
      if (currentStatus === 'Prepared')  return 'Reviewed';
      if (currentStatus === 'Reviewed')  return 'Cleared';
    }
    var a = ROLE_ACTIONS[role];
    return a ? a.nextStatus : null;
  }

  function getActionLabel(role, currentStatus) {
    if (role === 'FAM') {
      if (currentStatus === 'Prepared') return 'Mark Reviewed';
      if (currentStatus === 'Reviewed') return 'Clear';
    }
    var a = ROLE_ACTIONS[role];
    return a ? a.actionLabel : null;
  }

  function canActionRequisition(role, currentStatus) {
    if (!role || !currentStatus) return false;
    var a = ROLE_ACTIONS[role];
    if (!a) return false;
    return a.canAction.indexOf(currentStatus) !== -1;
  }

  /* ─────────────────────────────────────────────
     4. PASSWORD UTILITIES
  ───────────────────────────────────────────── */
  async function sha256(str) {
    var buf   = new TextEncoder().encode(str);
    var hash  = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash))
      .map(function (b) { return b.toString(16).padStart(2, '0'); })
      .join('');
  }

  function isPasswordExpired(expiry) {
    if (!expiry) return false;
    return new Date(expiry) < new Date();
  }

  function newExpiryDate() {
    var d = new Date();
    d.setDate(d.getDate() + CONFIG.PASS_EXPIRY_DAYS);
    return d.toISOString().split('T')[0];
  }

  /* ─────────────────────────────────────────────
     5. API HELPERS
  ───────────────────────────────────────────── */
  function buildApiUrl(path) {
    return CONFIG.API_BASE + '/repos/' + CONFIG.OWNER + '/' + CONFIG.REPO + '/contents/' + path;
  }

  function buildHeaders() {
    return {
      'Authorization'        : 'token ' + CONFIG.SHARED_TOKEN,
      'Content-Type'         : 'application/json',
      'Accept'               : 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version' : '2022-11-28'
    };
  }

  function encodeToBase64(obj) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(obj, null, 2))));
  }

  function decodeFromBase64(b64) {
    var cleaned = b64.replace(/[\n\r]/g, '');
    return JSON.parse(decodeURIComponent(escape(atob(cleaned))));
  }

  function generateId() {
    var n    = new Date();
    var rand = Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0');
    return 'UBF-' + n.getFullYear() +
      String(n.getMonth() + 1).padStart(2, '0') +
      String(n.getDate()).padStart(2, '0') + '-' + rand;
  }

  function apiError(status, msg) {
    if (status === 401) return 'Authentication failed. Contact system administrator.';
    if (status === 403) return 'Permission denied. Contact system administrator.';
    if (status === 404) return 'File not found (404). Contact system administrator.';
    if (status === 409) return 'Data conflict. Please refresh and try again.';
    if (status === 422) return 'Data sync error. Please refresh and try again.';
    return 'System error (' + status + '): ' + (msg || 'Unknown');
  }

  /* ─────────────────────────────────────────────
     6. CORE FILE READ / WRITE
  ───────────────────────────────────────────── */
  async function readGitHubFile(filePath) {
    var url      = buildApiUrl(filePath) + '?_=' + Date.now();
    var response = await fetch(url, { method: 'GET', headers: buildHeaders() });
    if (!response.ok) {
      var e = {}; try { e = await response.json(); } catch (_) {}
      throw new Error(apiError(response.status, e.message));
    }
    var fileData = await response.json();
    var data;
    try {
      data = decodeFromBase64(fileData.content);
    } catch (_) {
      data = [];
    }
    return { data: data, sha: fileData.sha };
  }

  async function writeGitHubFile(filePath, data, sha, message) {
    var response = await fetch(buildApiUrl(filePath), {
      method  : 'PUT',
      headers : buildHeaders(),
      body    : JSON.stringify({
        message : message || 'UBF System update',
        content : encodeToBase64(data),
        sha     : sha,
        branch  : CONFIG.BRANCH
      })
    });
    if (!response.ok) {
      var e = {}; try { e = await response.json(); } catch (_) {}
      throw new Error(apiError(response.status, e.message));
    }
    return await response.json();
  }

  /* ─────────────────────────────────────────────
     7. DATABASE — safe read always returns array
  ───────────────────────────────────────────── */
  async function readDatabase() {
    var result  = await readGitHubFile(CONFIG.DB_PATH);
    var records = Array.isArray(result.data) ? result.data : [];
    return { records: records, sha: result.sha };
  }

  async function writeDatabase(records, sha, message) {
    var safeRecords = Array.isArray(records) ? records : [];
    return await writeGitHubFile(CONFIG.DB_PATH, safeRecords, sha, message);
  }

  /* ─────────────────────────────────────────────
     8. USERS — read / write
  ───────────────────────────────────────────── */
  async function readUsers() {
    var result = await readGitHubFile(CONFIG.USERS_PATH);
    var users  = Array.isArray(result.data) ? result.data : [];
    return { users: users, sha: result.sha };
  }

  async function writeUsers(users, sha, message) {
    return await writeGitHubFile(CONFIG.USERS_PATH, users, sha, message);
  }

  /* ─────────────────────────────────────────────
     9. AUTHENTICATION
  ───────────────────────────────────────────── */
  async function authenticateUser(email, password) {
    var emailLower = email.trim().toLowerCase();
    var hash       = await sha256(password);
    var result     = await readUsers();
    var users      = result.users;

    var user = users.find(function (u) {
      return u.email.toLowerCase() === emailLower;
    });

    if (!user)        throw new Error('No account found for this email address.');
    if (!user.active) throw new Error('Your account is deactivated. Contact administrator.');
    if (user.passwordHash !== hash) throw new Error('Incorrect password. Please try again.');

    return { user: user, usersSha: result.sha, allUsers: users };
  }

  async function changePassword(email, newPassword) {
    var result = await readUsers();
    var users  = result.users;
    var idx    = users.findIndex(function (u) {
      return u.email.toLowerCase() === email.toLowerCase();
    });
    if (idx === -1) throw new Error('User not found.');

    users[idx].passwordHash       = await sha256(newPassword);
    users[idx].passwordExpiry     = newExpiryDate();
    users[idx].mustChangePassword = false;

    await writeUsers(users, result.sha, 'Password changed for ' + email);
    return true;
  }

  /* ─────────────────────────────────────────────
     10. SESSION
  ───────────────────────────────────────────── */
  function saveSession(user) {
    var session = {
      email    : user.email,
      name     : user.name,
      role     : user.role,
      title    : user.title,
      loginAt  : new Date().toISOString(),
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
    };
    localStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function getSession() {
    try {
      var raw = localStorage.getItem(CONFIG.SESSION_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (new Date(s.expiresAt) < new Date()) { clearSession(); return null; }
      return s;
    } catch (_) { return null; }
  }

  function clearSession() {
    localStorage.removeItem(CONFIG.SESSION_KEY);
    localStorage.removeItem('ubf_email');
    localStorage.removeItem('ubf_pat');
  }

  function isAuthenticated() { return !!getSession(); }

  function requireSession() {
    var s = getSession();
    if (!s) throw new Error('Session expired. Please log in again.');
    return s;
  }

  /* ─────────────────────────────────────────────
     11. FILTERING
  ───────────────────────────────────────────── */
  function filterByRole(records, session) {
    if (!Array.isArray(records)) return [];
    if (!session) return [];
    if (canSeeAll(session.role)) return records;
    return records.filter(function (r) {
      return r.submittedBy &&
        r.submittedBy.toLowerCase() === session.email.toLowerCase();
    });
  }

  /* ─────────────────────────────────────────────
     12. ATTACHMENT UPLOAD
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
              message : 'Attachment: ' + safe,
              content : b64,
              branch  : CONFIG.BRANCH
            })
          });
          if (!res.ok) {
            var e = {}; try { e = await res.json(); } catch (_) {}
            throw new Error(apiError(res.status, e.message));
          }
          var result = await res.json();
          resolve({
            path       : path,
            downloadUrl: result.content.html_url,
            name       : file.name,
            size       : file.size,
            uploadedAt : new Date().toISOString()
          });
        } catch (err) { reject(err); }
      };
      reader.readAsDataURL(file);
    });
  }

  async function uploadAllAttachments(fileList) {
    var results = [];
    var files   = Array.isArray(fileList) ? fileList : Array.from(fileList || []);
    for (var i = 0; i < files.length; i++) {
      results.push(await uploadAttachment(files[i]));
    }
    return results;
  }

  /* ─────────────────────────────────────────────
     13. REQUISITION CRUD
  ───────────────────────────────────────────── */
  async function getAllRequisitions() {
    var session = requireSession();
    var db      = await readDatabase();
    var records = db.records;
    var visible = filterByRole(records, session);
    if (!Array.isArray(visible)) return [];
    return visible.sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  async function submitRequisition(formData, files, formType) {
    var session     = requireSession();
    var db          = await readDatabase();
    var records     = db.records;
    var sha         = db.sha;
    var attachments = [];

    if (files && files.length > 0) {
      attachments = await uploadAllAttachments(Array.from(files));
    }

    var now = new Date().toISOString();
    var rec = {
      id              : generateId(),
      formType        : formType || 'request',
      data            : formData,
      submittedBy     : session.email,
      submittedByName : session.name,
      submittedByTitle: session.title,
      submittedByRole : session.role,
      status          : 'Pending',
      attachments     : attachments,
      comments        : [],
      createdAt       : now,
      updatedAt       : now,
      approval: {
        preparation: { status: 'Pending', by: '', byName: '', at: '', note: '' },
        review     : { status: 'Pending', by: '', byName: '', at: '', note: '' },
        clearance  : { status: 'Pending', by: '', byName: '', at: '', note: '' },
        approval   : { status: 'Pending', by: '', byName: '', at: '', note: '' }
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

    records.push(rec);
    await writeDatabase(records, sha,
      'New ' + (formType || 'request') + ' ' + rec.id + ' by ' + session.email);
    return rec;
  }

  async function updateRequisitionStatus(id, newStatus, note) {
    var session = requireSession();
    var db      = await readDatabase();
    var records = db.records;
    var idx     = records.findIndex(function (r) { return r.id === id; });
    if (idx === -1) throw new Error('Requisition not found: ' + id);

    if (!canActionRequisition(session.role, records[idx].status)) {
      throw new Error('Your role cannot action this requisition at its current status.');
    }

    var now = new Date().toISOString();
    records[idx].status    = newStatus;
    records[idx].updatedAt = now;

    var stepMap = {
      'Prepared': 'preparation',
      'Reviewed': 'review',
      'Cleared' : 'clearance',
      'Approved': 'approval'
    };

    var step = stepMap[newStatus];
    if (step) {
      records[idx].approval[step] = {
        status: newStatus,
        by    : session.email,
        byName: session.name,
        at    : now,
        note  : note || ''
      };
    }

    records[idx].history.push({
      action : newStatus,
      by     : session.email,
      byName : session.name,
      byTitle: session.title,
      at     : now,
      note   : note || ''
    });

    await writeDatabase(records, db.sha,
      'Status: ' + id + ' -> ' + newStatus + ' by ' + session.email);
    return records[idx];
  }

  async function editRequisition(id, updatedData, files) {
    var session = requireSession();
    var db      = await readDatabase();
    var records = db.records;
    var idx     = records.findIndex(function (r) { return r.id === id; });
    if (idx === -1) throw new Error('Requisition not found: ' + id);

    var rec = records[idx];
    if (rec.submittedBy.toLowerCase() !== session.email.toLowerCase()) {
      throw new Error('You can only edit your own submissions.');
    }
    if (['Prepared', 'Reviewed', 'Cleared', 'Approved'].indexOf(rec.status) !== -1) {
      throw new Error('This submission is already in progress and cannot be edited.');
    }

    var newAttachments = [];
    if (files && files.length > 0) {
      newAttachments = await uploadAllAttachments(Array.from(files));
    }

    var now = new Date().toISOString();
    records[idx].data        = updatedData;
    records[idx].status      = 'Pending';
    records[idx].updatedAt   = now;
    records[idx].attachments = records[idx].attachments.concat(newAttachments);
    records[idx].approval    = {
      preparation: { status: 'Pending', by: '', byName: '', at: '', note: '' },
      review     : { status: 'Pending', by: '', byName: '', at: '', note: '' },
      clearance  : { status: 'Pending', by: '', byName: '', at: '', note: '' },
      approval   : { status: 'Pending', by: '', byName: '', at: '', note: '' }
    };
    records[idx].history.push({
      action : 'Edited & Resubmitted',
      by     : session.email,
      byName : session.name,
      byTitle: session.title,
      at     : now,
      note   : 'Corrected and resubmitted'
    });

    await writeDatabase(records, db.sha, 'Edit: ' + id + ' by ' + session.email);
    return records[idx];
  }

  /* ─────────────────────────────────────────────
     14. COMMENTS & REPLIES
  ───────────────────────────────────────────── */
  async function addComment(reqId, text) {
    var session = requireSession();
    var db      = await readDatabase();
    var records = db.records;
    var idx     = records.findIndex(function (r) { return r.id === reqId; });
    if (idx === -1) throw new Error('Requisition not found.');

    if (!Array.isArray(records[idx].comments)) records[idx].comments = [];

    var comment = {
      id     : 'CMT-' + Date.now(),
      by     : session.email,
      byName : session.name,
      byRole : session.role,
      text   : text,
      at     : new Date().toISOString(),
      replies: []
    };

    records[idx].comments.push(comment);
    records[idx].updatedAt = new Date().toISOString();

    await writeDatabase(records, db.sha, 'Comment on ' + reqId + ' by ' + session.email);
    return comment;
  }

  async function addReply(reqId, commentId, text) {
    var session  = requireSession();
    var db       = await readDatabase();
    var records  = db.records;
    var idx      = records.findIndex(function (r) { return r.id === reqId; });
    if (idx === -1) throw new Error('Requisition not found.');

    var comments = records[idx].comments || [];
    var cIdx     = comments.findIndex(function (c) { return c.id === commentId; });
    if (cIdx === -1) throw new Error('Comment not found.');

    var reply = {
      id    : 'RPL-' + Date.now(),
      by    : session.email,
      byName: session.name,
      byRole: session.role,
      text  : text,
      at    : new Date().toISOString()
    };

    records[idx].comments[cIdx].replies.push(reply);
    records[idx].updatedAt = new Date().toISOString();

    await writeDatabase(records, db.sha, 'Reply on ' + reqId + ' by ' + session.email);
    return reply;
  }

  /* ─────────────────────────────────────────────
     15. DASHBOARD STATS
  ───────────────────────────────────────────── */
  async function getDashboardStats() {
    var records = await getAllRequisitions();
    if (!Array.isArray(records)) return { total:0, pending:0, prepared:0, reviewed:0, cleared:0, approved:0, rejected:0 };
    var s = { total: records.length, pending:0, prepared:0, reviewed:0, cleared:0, approved:0, rejected:0 };
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
     16. EXPOSE via window.DataService
  ───────────────────────────────────────────── */
  global.DataService = {
    CONFIG,
    ROLE_ACTIONS,
    ELEVATED_ROLES,
    /* Staff helpers */
    getStaff, getRole, getDisplayName, getTitle,
    canSeeAll, canActionRequisition, getNextStatus, getActionLabel,
    /* Auth */
    authenticateUser, changePassword, sha256, isPasswordExpired,
    /* Session */
    saveSession, getSession, clearSession, isAuthenticated, requireSession,
    /* File ops */
    readGitHubFile, writeGitHubFile,
    readDatabase, writeDatabase,
    readUsers, writeUsers,
    uploadAttachment, uploadAllAttachments,
    /* Requisitions */
    getAllRequisitions, submitRequisition,
    updateRequisitionStatus, editRequisition,
    /* Comments */
    addComment, addReply,
    /* Stats */
    getDashboardStats
  };

}(window));
