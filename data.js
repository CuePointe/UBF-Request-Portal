/**
 * data.js — GitHub REST API Data Layer
 * Uganda Biodiversity Fund (UBF) Request Portal
 */

(function (global) {
  'use strict';

  /* ─────────────────────────────────────────────
     1. STATIC CONFIGURATION
  ───────────────────────────────────────────── */
  var CONFIG = {
    API_BASE : 'https://api.github.com',
    OWNER    : 'CuePointe',
    REPO     : 'UBF-Request-Portal',
    DB_PATH  : 'data/requisitions.json',
    BRANCH   : 'main'
  };

  /* ─────────────────────────────────────────────
     2. COMPLETE UBF STAFF ROSTER
  ───────────────────────────────────────────── */
  var ROLE_MAP = {
    'i.amani@ugandabiodiversityfund.org'    : 'ED',
    'w.nabatanzi@ugandabiodiversityfund.org': 'FAM',
    's.abonyo@ugandabiodiversityfund.org'   : 'Admin Officer',
    'd.okullu@ugandabiodiversityfund.org'   : 'Staff',
    'p.musiime@ugandabiodiversityfund.org'  : 'Staff',
    'o.atuhaire@ugandabiodiversityfund.org' : 'Staff',
    't.otieno@ugandabiodiversityfund.org'   : 'Admin Officer'
  };

  var NAME_MAP = {
    'i.amani@ugandabiodiversityfund.org'    : 'Ivan Amanigaruhanga',
    'w.nabatanzi@ugandabiodiversityfund.org': 'Winnie Nabatanzi',
    's.abonyo@ugandabiodiversityfund.org'   : 'Susan Abonyo',
    'd.okullu@ugandabiodiversityfund.org'   : 'David Okullu',
    'p.musiime@ugandabiodiversityfund.org'  : 'Posiano Musiime',
    'o.atuhaire@ugandabiodiversityfund.org' : 'Owen Atuhaire',
    't.otieno@ugandabiodiversityfund.org'   : 'Tom Otieno'
  };

  var ELEVATED_ROLES = ['Admin Officer', 'FAM', 'ED'];

  /* ─────────────────────────────────────────────
     3. HELPERS
  ───────────────────────────────────────────── */
  function getRole(email) {
    if (!email) return 'Staff';
    return ROLE_MAP[email.trim().toLowerCase()] || 'Staff';
  }

  function getDisplayName(email) {
    if (!email) return '';
    return NAME_MAP[email.trim().toLowerCase()] || email;
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
    var n = new Date();
    var rand = Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0');
    return 'UBF-' + n.getFullYear() + String(n.getMonth()+1).padStart(2,'0') + String(n.getDate()).padStart(2,'0') + '-' + rand;
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
     4. DATABASE READ / WRITE
  ───────────────────────────────────────────── */
  async function readDatabase() {
    var creds    = getCredentials();
    var response = await fetch(buildApiUrl(CONFIG.DB_PATH) + '?_=' + Date.now(), {
      method: 'GET', headers: buildHeaders(creds.pat)
    });
    if (!response.ok) {
      var e = {}; try { e = await response.json(); } catch(_) {}
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
      var e = {}; try { e = await response.json(); } catch(_) {}
      throw new Error(buildApiError(response.status, e.message));
    }
    return await response.json();
  }

  /* ─────────────────────────────────────────────
     5. ATTACHMENT UPLOAD
  ───────────────────────────────────────────── */
  function uploadAttachment(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function() { reject(new Error('Cannot read: ' + file.name)); };
      reader.onload  = async function(evt) {
        try {
          var creds   = getCredentials();
          var b64     = evt.target.result.split(',')[1];
          var safe    = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          var path    = 'attachments/' + Date.now() + '_' + safe;
          var res     = await fetch(buildApiUrl(path), {
            method  : 'PUT',
            headers : buildHeaders(creds.pat),
            body    : JSON.stringify({ message: 'Attachment: ' + safe, content: b64, branch: CONFIG.BRANCH })
          });
          if (!res.ok) { var e={}; try{e=await res.json();}catch(_){} throw new Error(buildApiError(res.status, e.message)); }
          var result = await res.json();
          resolve({ path, downloadUrl: result.content.html_url, name: file.name, size: file.size });
        } catch(err) { reject(err); }
      };
      reader.readAsDataURL(file);
    });
  }

  async function uploadAllAttachments(fileList) {
    var results = [];
    for (var i = 0; i < fileList.length; i++) results.push(await uploadAttachment(fileList[i]));
    return results;
  }

  /* ─────────────────────────────────────────────
     6. ROLE-BASED FILTERING
  ───────────────────────────────────────────── */
  function filterByRole(records, email) {
    var role = getRole(email);
    if (ELEVATED_ROLES.indexOf(role) !== -1) return records;
    return records.filter(function(r) {
      return r.submittedBy && r.submittedBy.toLowerCase() === email.toLowerCase();
    });
  }

  /* ─────────────────────────────────────────────
     7. HIGH-LEVEL API
  ───────────────────────────────────────────── */
  async function getAllRequisitions() {
    var creds   = getCredentials();
    var db      = await readDatabase();
    var visible = filterByRole(db.records, creds.email);
    return visible.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  }

  async function submitRequisition(formData, files) {
    var creds       = getCredentials();
    var db          = await readDatabase();
    var attachments = files && files.length > 0 ? await uploadAllAttachments(Array.from(files)) : [];
    var now         = new Date().toISOString();

    var rec = {
      id             : generateId(),
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
      urgency        : formData.urgency        || 'Normal',
      submittedBy    : creds.email,
      submittedByName: getDisplayName(creds.email),
      submittedByRole: getRole(creds.email),
      status         : 'Pending Review',
      attachments    : attachments,
      createdAt      : now,
      updatedAt      : now,
      history        : [{
        action: 'Submitted', by: creds.email,
        byName: getDisplayName(creds.email),
        role  : getRole(creds.email), at: now, note: 'Initial submission'
      }]
    };

    db.records.push(rec);
    await writeDatabase(db.records, db.sha, 'New requisition ' + rec.id + ' by ' + creds.email);
    return rec;
  }

  async function updateRequisitionStatus(id, newStatus, note) {
    var creds = getCredentials();
    var db    = await readDatabase();
    var idx   = db.records.findIndex(function(r) { return r.id === id; });
    if (idx === -1) throw new Error('Requisition not found: ' + id);
    var now = new Date().toISOString();
    db.records[idx].status    = newStatus;
    db.records[idx].updatedAt = now;
    db.records[idx].history.push({
      action: newStatus, by: creds.email,
      byName: getDisplayName(creds.email),
      role  : getRole(creds.email), at: now, note: note || ''
    });
    await writeDatabase(db.records, db.sha, 'Status: ' + id + ' -> ' + newStatus + ' by ' + creds.email);
    return db.records[idx];
  }

  async function getDashboardStats() {
    var records = await getAllRequisitions();
    var s = { total: records.length, pending: 0, approved: 0, rejected: 0, inReview: 0 };
    records.forEach(function(r) {
      var st = (r.status || '').toLowerCase();
      if (st === 'pending review') s.pending++;
      else if (st === 'approved')  s.approved++;
      else if (st === 'rejected')  s.rejected++;
      else if (st === 'in review') s.inReview++;
    });
    return s;
  }

  /* ─────────────────────────────────────────────
     8. SESSION HELPERS
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
     9. EXPOSE via window.DataService
  ───────────────────────────────────────────── */
  global.DataService = {
    CONFIG, saveSession, clearSession, isAuthenticated,
    getCredentials, getRole, getDisplayName,
    readDatabase, writeDatabase,
    uploadAttachment, uploadAllAttachments,
    getAllRequisitions, submitRequisition,
    updateRequisitionStatus, getDashboardStats
  };

}(window));
