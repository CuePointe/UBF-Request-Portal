/**
 * data.js — GitHub REST API Data Layer
 * Uganda Biodiversity Fund (UBF) Request Portal
 *
 * ARCHITECTURE NOTE:
 *   This file uses NO ES module `export` syntax.
 *   All public methods are exposed via window.DataService so any plain
 *   <script src="data.js"></script> tag can consume them without a bundler
 *   or type="module" attribute. This eliminates the
 *   "Uncaught SyntaxError: Unexpected token 'export'" error.
 *
 * ROOT-CAUSE FIX FOR 404/405 ERRORS:
 *   The GitHub Contents API endpoint must be an absolute HTTPS URL:
 *     https://api.github.com/repos/{owner}/{repo}/contents/{path}
 *   Every URL in this file is built with buildApiUrl() which guarantees
 *   the correct scheme, host, and path prefix — no template-literal
 *   ambiguity, no relative-path drift.
 */

(function (global) {
  'use strict';

  /* ─────────────────────────────────────────────
     1.  STATIC CONFIGURATION
  ───────────────────────────────────────────── */

  var CONFIG = {
    API_BASE : 'https://api.github.com',
    OWNER    : 'CuePointe',
    REPO     : 'UBF-Request-Portal',
    DB_PATH  : 'data/requisitions.json',
    BRANCH   : 'main'
  };

  /* ─────────────────────────────────────────────
     2.  ROLE MAPPING
         Keys must be lowercase for case-insensitive lookup.
  ───────────────────────────────────────────── */

  var ROLE_MAP = {
    's.abonyo@ugandabiodiversityfund.org'  : 'Admin Officer',
    'w.nabatanzi@ugandabiodiversityfund.org': 'FAM',
    'i.amani@ugandabiodiversityfund.org'   : 'ED',
    't.otieno@ugandabiodiversityfund.org'  : 'Admin Officer'  // Developer override
  };

  var ELEVATED_ROLES = ['Admin Officer', 'FAM', 'ED'];

  /* ─────────────────────────────────────────────
     3.  HELPERS
  ───────────────────────────────────────────── */

  /**
   * Returns the UBF role for a given email.
   * Defaults to 'Staff' if not in the map.
   */
  function getRole(email) {
    if (!email) return 'Staff';
    return ROLE_MAP[email.trim().toLowerCase()] || 'Staff';
  }

  /**
   * Reads UBF credentials from localStorage.
   * Throws a descriptive error if either value is missing so callers
   * can redirect the user to the login page.
   */
  function getCredentials() {
    var email = localStorage.getItem('ubf_email');
    var pat   = localStorage.getItem('ubf_pat');
    if (!email || !pat) {
      throw new Error('Session expired or not authenticated. Please log in again.');
    }
    return { email: email, pat: pat };
  }

  /**
   * Builds an absolute GitHub Contents API URL.
   *
   * CORRECT output example:
   *   https://api.github.com/repos/CuePointe/UBF-Request-Portal/contents/data/requisitions.json
   *
   * All string segments are hard-coded constants — no runtime template
   * literals that could silently produce relative paths.
   */
  function buildApiUrl(filePath) {
    return (
      CONFIG.API_BASE +
      '/repos/' +
      CONFIG.OWNER +
      '/' +
      CONFIG.REPO +
      '/contents/' +
      filePath
    );
  }

  /**
   * Returns the standard GitHub API request headers.
   */
  function buildHeaders(pat) {
    return {
      'Authorization' : 'token ' + pat,
      'Content-Type'  : 'application/json',
      'Accept'        : 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  /**
   * Encodes a JavaScript object to a Base64 string safe for the
   * GitHub Contents API `content` field.
   *
   * IMPORTANT: JSON.stringify can produce Unicode characters (e.g. smart
   * quotes, em-dashes in descriptions).  btoa() only handles Latin-1, so
   * we must percent-encode → unescape first.  This two-step dance is the
   * only approach that survives all character ranges without a TextEncoder.
   */
  function encodeJsonToBase64(obj) {
    var json = JSON.stringify(obj, null, 2);
    return btoa(unescape(encodeURIComponent(json)));
  }

  /**
   * Decodes a Base64 string returned by the GitHub Contents API back into
   * a parsed JavaScript object.
   *
   * GitHub inserts '\n' line-breaks every 60 characters inside the
   * `content` field.  These must be stripped before atob().
   */
  function decodeBase64ToJson(b64String) {
    var stripped = b64String.replace(/\n/g, '').replace(/\r/g, '');
    var json = decodeURIComponent(escape(atob(stripped)));
    return JSON.parse(json);
  }

  /**
   * Generates a collision-resistant requisition ID.
   * Format: UBF-YYYYMMDD-<6 random hex chars>
   */
  function generateId() {
    var now    = new Date();
    var year   = now.getFullYear();
    var month  = String(now.getMonth() + 1).padStart(2, '0');
    var day    = String(now.getDate()).padStart(2, '0');
    var random = Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0');
    return 'UBF-' + year + month + day + '-' + random;
  }

  /**
   * Translates an HTTP error response from the GitHub API into a
   * human-readable message including the diagnostic hint displayed
   * in the portal's error banners.
   */
  function buildApiError(status, apiMessage) {
    if (status === 401) {
      return 'Authentication failed (HTTP 401). Your Personal Access Token is invalid or has expired. ' +
             'Go to GitHub → Settings → Developer Settings → Personal Access Tokens and regenerate it.';
    }
    if (status === 403) {
      return "Transaction processing failed: GitHub rejected database modification payload packet. " +
             "Ensure your Token has 'repo' write access checked. (HTTP 403)";
    }
    if (status === 404) {
      return 'Resource not found (HTTP 404). Verify that the file "' + CONFIG.DB_PATH +
             '" exists in the repository "' + CONFIG.OWNER + '/' + CONFIG.REPO +
             '" on branch "' + CONFIG.BRANCH + '".';
    }
    if (status === 409) {
      return 'Conflict (HTTP 409). The database was modified by another session simultaneously. ' +
             'Please refresh and try again.';
    }
    if (status === 422) {
      return 'Unprocessable entity (HTTP 422). The SHA in the commit payload does not match ' +
             'the file\'s current SHA on GitHub. Refresh the page to re-sync.';
    }
    return 'GitHub API error (HTTP ' + status + '): ' + (apiMessage || 'Unknown error');
  }

  /* ─────────────────────────────────────────────
     4.  CORE DATABASE READ / WRITE
  ───────────────────────────────────────────── */

  /**
   * Reads the requisitions database from GitHub.
   *
   * Returns: { records: Array, sha: string }
   *   - records: the parsed array of requisition objects
   *   - sha:     the current file SHA — REQUIRED for the next PUT/write
   *              to avoid a 409/422 conflict error.
   */
  async function readDatabase() {
    var creds    = getCredentials();
    var url      = buildApiUrl(CONFIG.DB_PATH);
    var cacheBust = '?_=' + Date.now();

    var response = await fetch(url + cacheBust, {
      method  : 'GET',
      headers : buildHeaders(creds.pat)
    });

    if (!response.ok) {
      var errBody = {};
      try { errBody = await response.json(); } catch (_) { /* no body */ }
      throw new Error(buildApiError(response.status, errBody.message));
    }

    var fileData = await response.json();
    var records  = decodeBase64ToJson(fileData.content);

    if (!Array.isArray(records)) {
      console.warn('data.js: database root is not an array — resetting to []. SHA:', fileData.sha);
      records = [];
    }

    return { records: records, sha: fileData.sha };
  }

  /**
   * Writes the requisitions array back to GitHub via a PUT commit.
   *
   * @param {Array}  records       - The full updated records array
   * @param {string} sha           - Current file SHA (from readDatabase)
   * @param {string} commitMessage - Human-readable Git commit message
   * @returns {Promise<Object>}    - GitHub API commit response
   */
  async function writeDatabase(records, sha, commitMessage) {
    var creds   = getCredentials();
    var url     = buildApiUrl(CONFIG.DB_PATH);
    var message = commitMessage || ('UBF Portal auto-commit [' + new Date().toISOString() + ']');

    var payload = {
      message : message,
      content : encodeJsonToBase64(records),
      sha     : sha,
      branch  : CONFIG.BRANCH
    };

    var response = await fetch(url, {
      method  : 'PUT',
      headers : buildHeaders(creds.pat),
      body    : JSON.stringify(payload)
    });

    if (!response.ok) {
      var errBody = {};
      try { errBody = await response.json(); } catch (_) { /* no body */ }
      throw new Error(buildApiError(response.status, errBody.message));
    }

    return await response.json();
  }

  /* ─────────────────────────────────────────────
     5.  ATTACHMENT UPLOAD
  ───────────────────────────────────────────── */

  /**
   * Uploads a single File object to the `attachments/` folder in the repo.
   *
   * File names are sanitised and timestamped to prevent collisions.
   * The file content is read as a DataURL and the raw Base64 segment
   * (after the comma) is used directly — no re-encoding needed.
   *
   * @param {File}   file  - Browser File object from an <input type="file">
   * @returns {Promise<{path, downloadUrl, name, size}>}
   */
  function uploadAttachment(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !(file instanceof File)) {
        return reject(new Error('uploadAttachment: argument must be a File object.'));
      }

      var reader = new FileReader();

      reader.onerror = function () {
        reject(new Error('Failed to read file "' + file.name + '" from disk.'));
      };

      reader.onload = async function (evt) {
        try {
          var creds = getCredentials();

          // DataURL is  "data:<mime>;base64,<actual-b64>"
          var dataUrl       = evt.target.result;
          var base64Content = dataUrl.split(',')[1];

          if (!base64Content) {
            throw new Error('FileReader returned an empty or malformed DataURL for "' + file.name + '".');
          }

          // Build a safe, timestamped path
          var timestamp = Date.now();
          var safeName  = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          var filePath  = 'attachments/' + timestamp + '_' + safeName;
          var url       = buildApiUrl(filePath);

          var payload = {
            message : 'Upload attachment: ' + safeName + ' [UBF Portal]',
            content : base64Content,
            branch  : CONFIG.BRANCH
          };

          var response = await fetch(url, {
            method  : 'PUT',
            headers : buildHeaders(creds.pat),
            body    : JSON.stringify(payload)
          });

          if (!response.ok) {
            var errBody = {};
            try { errBody = await response.json(); } catch (_) { /* no body */ }
            throw new Error(buildApiError(response.status, errBody.message));
          }

          var result = await response.json();

          resolve({
            path        : filePath,
            downloadUrl : result.content.html_url,
            name        : file.name,
            size        : file.size,
            mimeType    : file.type
          });

        } catch (err) {
          reject(err);
        }
      };

      reader.readAsDataURL(file);
    });
  }

  /**
   * Uploads all files in a FileList (or Array<File>) sequentially.
   * Returns an array of attachment metadata objects.
   */
  async function uploadAllAttachments(fileList) {
    var results = [];
    var files   = Array.from(fileList || []);

    for (var i = 0; i < files.length; i++) {
      var meta = await uploadAttachment(files[i]);
      results.push(meta);
    }

    return results;
  }

  /* ─────────────────────────────────────────────
     6.  ROLE-BASED DATA FILTERING
  ───────────────────────────────────────────── */

  /**
   * Filters a records array to what `email` is allowed to see.
   *
   * - Admin Officer, FAM, ED → all records
   * - Staff                  → only records submitted by that email
   */
  function filterByRole(records, email) {
    var role = getRole(email);
    if (ELEVATED_ROLES.indexOf(role) !== -1) {
      return records;
    }
    return records.filter(function (r) {
      return r.submittedBy && r.submittedBy.toLowerCase() === email.toLowerCase();
    });
  }

  /* ─────────────────────────────────────────────
     7.  HIGH-LEVEL PUBLIC API
  ───────────────────────────────────────────── */

  /**
   * Fetches all requisitions the current user is authorised to see.
   * Returns them sorted by createdAt descending (newest first).
   */
  async function getAllRequisitions() {
    var creds   = getCredentials();
    var dbResult = await readDatabase();
    var visible = filterByRole(dbResult.records, creds.email);

    visible.sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return visible;
  }

  /**
   * Submits a new requisition.
   *
   * @param {Object}   formData  - Plain object with form field values
   * @param {FileList} [files]   - Optional FileList for attachments
   * @returns {Promise<Object>}  - The saved requisition record
   */
  async function submitRequisition(formData, files) {
    var creds    = getCredentials();
    var dbResult = await readDatabase();

    // Upload attachments first (if any)
    var attachments = [];
    if (files && files.length > 0) {
      attachments = await uploadAllAttachments(files);
    }

    var now = new Date().toISOString();
    var newRecord = {
      id              : generateId(),
      title           : formData.title           || '',
      category        : formData.category        || '',
      description     : formData.description     || '',
      quantity        : formData.quantity        || '',
      unit            : formData.unit            || '',
      estimatedCost   : formData.estimatedCost   || '',
      currency        : formData.currency        || 'UGX',
      urgency         : formData.urgency         || 'Normal',
      projectCode     : formData.projectCode     || '',
      deliveryDate    : formData.deliveryDate    || '',
      deliveryAddress : formData.deliveryAddress || '',
      justification   : formData.justification   || '',
      submittedBy     : creds.email,
      submittedByRole : getRole(creds.email),
      status          : 'Pending',
      attachments     : attachments,
      createdAt       : now,
      updatedAt       : now,
      history         : [
        {
          action : 'Submitted',
          by     : creds.email,
          role   : getRole(creds.email),
          at     : now,
          note   : 'Initial submission'
        }
      ]
    };

    dbResult.records.push(newRecord);

    await writeDatabase(
      dbResult.records,
      dbResult.sha,
      'New requisition ' + newRecord.id + ' submitted by ' + creds.email
    );

    return newRecord;
  }

  /**
   * Updates the status of an existing requisition (approve / reject / etc.).
   *
   * @param {string} requisitionId  - The UBF-YYYYMMDD-XXXXXX id
   * @param {string} newStatus      - e.g. 'Approved', 'Rejected', 'In Review'
   * @param {string} [note]         - Optional comment from the reviewer
   * @returns {Promise<Object>}     - The updated requisition record
   */
  async function updateRequisitionStatus(requisitionId, newStatus, note) {
    var creds    = getCredentials();
    var dbResult = await readDatabase();

    var idx = -1;
    for (var i = 0; i < dbResult.records.length; i++) {
      if (dbResult.records[i].id === requisitionId) {
        idx = i;
        break;
      }
    }

    if (idx === -1) {
      throw new Error('Requisition "' + requisitionId + '" not found in database.');
    }

    var now = new Date().toISOString();
    dbResult.records[idx].status    = newStatus;
    dbResult.records[idx].updatedAt = now;
    dbResult.records[idx].history.push({
      action : newStatus,
      by     : creds.email,
      role   : getRole(creds.email),
      at     : now,
      note   : note || ''
    });

    await writeDatabase(
      dbResult.records,
      dbResult.sha,
      'Status update: ' + requisitionId + ' → ' + newStatus + ' by ' + creds.email
    );

    return dbResult.records[idx];
  }

  /**
   * Returns summary statistics for the dashboard header cards.
   * Operates on whatever filtered slice the user is allowed to see.
   */
  async function getDashboardStats() {
    var records = await getAllRequisitions();

    var stats = {
      total    : records.length,
      pending  : 0,
      approved : 0,
      rejected : 0,
      inReview : 0
    };

    for (var i = 0; i < records.length; i++) {
      var s = (records[i].status || '').toLowerCase();
      if (s === 'pending')   stats.pending++;
      else if (s === 'approved') stats.approved++;
      else if (s === 'rejected') stats.rejected++;
      else if (s === 'in review') stats.inReview++;
    }

    return stats;
  }

  /* ─────────────────────────────────────────────
     8.  SESSION HELPERS (used by script.js)
  ───────────────────────────────────────────── */

  function saveSession(email, pat) {
    localStorage.setItem('ubf_email', email);
    localStorage.setItem('ubf_pat',   pat);
  }

  function clearSession() {
    localStorage.removeItem('ubf_email');
    localStorage.removeItem('ubf_pat');
  }

  function isAuthenticated() {
    return !!(localStorage.getItem('ubf_email') && localStorage.getItem('ubf_pat'));
  }

  /* ─────────────────────────────────────────────
     9.  EXPOSE VIA window.DataService
  ───────────────────────────────────────────── */

  global.DataService = {
    // Config (read-only exposure for debugging)
    CONFIG               : CONFIG,

    // Auth helpers
    saveSession          : saveSession,
    clearSession         : clearSession,
    isAuthenticated      : isAuthenticated,
    getCredentials       : getCredentials,
    getRole              : getRole,

    // Database primitives (useful for advanced/debug use)
    readDatabase         : readDatabase,
    writeDatabase        : writeDatabase,

    // Attachment upload
    uploadAttachment     : uploadAttachment,
    uploadAllAttachments : uploadAllAttachments,

    // High-level data API
    getAllRequisitions    : getAllRequisitions,
    submitRequisition    : submitRequisition,
    updateRequisitionStatus : updateRequisitionStatus,
    getDashboardStats    : getDashboardStats
  };

}(window));
