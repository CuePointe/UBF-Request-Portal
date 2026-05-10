// ============================================================
//  UBF LOGISTICS & PROCUREMENT – script.js (Interactive Release)
// ============================================================

const CONFIG = {
  GITHUB_OWNER: "CuePointe",
  GITHUB_REPO : "UBF-Request-Portal",
  DATABASE_FILE: "data/requisitions.json"
};

var APP_STATE = {
  githubToken: "",
  userEmail: "",
  userRole: "Staff",
  isDev: false,
  roleOverride: "",
  showAllData: false,
  records: []
};

const ROLES_CONFIG = {
  "s.abonyo@ugandabiodiversityfund.org"  : "Admin Officer",
  "w.nabatanzi@ugandabiodiversityfund.org": "FAM",
  "i.amani@ugandabiodiversityfund.org"   : "ED"
};

const DEV_EMAILS = ["t.otieno@ugandabiodiversityfund.org"];

document.addEventListener("DOMContentLoaded", function() {
  APP_STATE.githubToken = localStorage.getItem("ubf_github_token") || "";
  APP_STATE.userEmail = localStorage.getItem("ubf_user_email") || "";

  if (!APP_STATE.githubToken || !APP_STATE.userEmail) {
    promptForCredentials();
  } else {
    resolveUserPermissions();
    showView("dashboard");
  }

  document.addEventListener("keydown", function(e) {
    if (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
      e.preventDefault();
      const dev = document.getElementById("devPanel");
      if (dev) dev.style.display = (dev.style.display === "none" ? "block" : "none");
    }
  });
});

function promptForCredentials() {
  const email = prompt("Enter your UBF Corporate Email:", APP_STATE.userEmail);
  const token = prompt("Enter your GitHub Personal Access Token (PAT):");
  
  if (email && token) {
    APP_STATE.userEmail = email.trim().toLowerCase();
    APP_STATE.githubToken = token.trim();
    localStorage.setItem("ubf_user_email", APP_STATE.userEmail);
    localStorage.setItem("ubf_github_token", APP_STATE.githubToken);
    resolveUserPermissions();
    showView("dashboard");
  } else {
    alert("Access Denied. Run credentials required.");
  }
}

function resolveUserPermissions() {
  const cleanEmail = APP_STATE.userEmail.toLowerCase().trim();
  APP_STATE.isDev = DEV_EMAILS.includes(cleanEmail);
  
  if (APP_STATE.roleOverride) {
    APP_STATE.userRole = APP_STATE.roleOverride;
  } else {
    APP_STATE.userRole = ROLES_CONFIG[cleanEmail] || "Staff";
  }

  // Update navbar badge labels in index.html
  const roleLabel = document.getElementById("roleLabel");
  const emailLabel = document.getElementById("emailLabel");
  if (roleLabel) roleLabel.textContent = APP_STATE.userRole;
  if (emailLabel) emailLabel.textContent = APP_STATE.userEmail;
}

// ── CORE VIEW ROUTER ──
function showView(viewName) {
  const container = document.getElementById("mainContentContainer");
  if (!container) return;

  document.querySelectorAll(".ubf-nav-link").forEach(lnk => lnk.classList.remove("active"));

  fetch(`${viewName}.html`)
    .then(res => {
      if (!res.ok) throw new Error(`Could not locate ${viewName}.html file layout template.`);
      return res.text();
    })
        .then(html => {
      container.innerHTML = html;
      
      if (viewName === "dashboard") {
        loadDashboard();
      } else if (viewName === "form") {
        const displayField = document.getElementById("requestedByDisplay");
        if (displayField) displayField.textContent = APP_STATE.userEmail;
        const logo = document.getElementById("ubfLogoForm");
        if (logo) logo.src = "logo.png";
      } else if (viewName === "history") {
        loadHistoryView(); // <--- ADD THIS LINE HERE
      }
    })

    .catch(err => {
      console.error("Navigation error:", err);
      container.innerHTML = `<div class="alert alert-danger">Error loading view layer resource assets. Make sure files are named in all-lowercase.</div>`;
    });
}

// ── DATABASE OPERATIONS (Syncs with data.js) ──
async function loadDashboard() {
  const tbody = document.getElementById("dashTableBody");
  if (tbody) tbody.innerHTML = `<tr><td colspan="12" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Accessing GitHub ledger database records...</td></tr>`;

  const url = `github.com{CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/contents/${CONFIG.DATABASE_FILE}`;

  try {
    const response = await fetch(url, {
      headers: { "Authorization": `token ${APP_STATE.githubToken}`, "Accept": "application/vnd.github.v3+json" }
    });
    
    let allRows = [];
    if (response.ok) {
      const data = await response.json();
      APP_STATE.db_sha = data.sha;
      const decoded = decodeURIComponent(escape(atob(data.content)));
      allRows = JSON.parse(decoded);
    }

    // Calls your data.js logic engine to process arrays
    APP_STATE.records = data_getDashboard(allRows, APP_STATE.userRole, APP_STATE.userEmail, APP_STATE.showAllData);
    renderDashboardUI();
  } catch (err) {
    console.error("Fetch failure:", err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="12" class="text-center text-danger py-4">Database link dropped. Verify token permissions.</td></tr>`;
  }
}

function renderDashboardUI() {
  const tbody = document.getElementById("dashTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";
  let total = 0, pending = 0, approved = 0, rejected = 0;

  if (APP_STATE.records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" class="text-center py-4 text-muted">No procurement requests available in your permission queue.</td></tr>`;
    updateMetricsDisplay(0,0,0,0);
    return;
  }

  APP_STATE.records.forEach(item => {
    total++;
    if (item.edStatus === "Approved") approved++;
    else if (item.adminStatus === "Rejected" || item.famStatus === "Rejected" || item.edStatus === "Rejected") rejected++;
    else pending++;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="fw-bold text-primary">${item.requestId}</td>
      <td>${item.dateRequest}</td>
      <td><strong>${item.activityCode}</strong><br><small class="text-muted">${item.description.substring(0,40)}...</small></td>
      <td>${item.quantity}</td>
      <td>${item.dateRequired}</td>
      <td>${item.location || "—"}</td>
      <td>${item.department || "—"}</td>
      <td><small>${item.requestedBy}</small></td>
      <td>${statusBadgeHtml(item.adminStatus)}</td>
      <td>${statusBadgeHtml(item.famStatus)}</td>
      <td>${statusBadgeHtml(item.edStatus)}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-primary py-0 px-2" onclick="openDetailsModal('${item.requestId}')">Open</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  updateMetricsDisplay(total, pending, approved, rejected);
}

function statusBadgeHtml(val) {
  let cls = "bg-secondary";
  if (["Approved", "Verified", "Cleared"].includes(val)) cls = "bg-success";
  if (val === "Rejected") cls = "bg-danger";
  if (val === "Pending" || !val) cls = "bg-warning text-dark";
  return `<span class="badge ${cls}">${val || "Pending"}</span>`;
}

function updateMetricsDisplay(t, p, a, r) {
  if(document.getElementById("statTotal")) document.getElementById("statTotal").textContent = t;
  if(document.getElementById("statPending")) document.getElementById("statPending").textContent = p;
  if(document.getElementById("statApproved")) document.getElementById("statApproved").textContent = a;
  if(document.getElementById("statRejected")) document.getElementById("statRejected").textContent = r;
}

// ── FORM SUBMISSION ORCHESTRATION ──
async function handleFormSubmit() {
  const form = document.getElementById("requisitionForm");
  if (!form || !form.checkValidity()) {
    if(form) form.classList.add("was-validated");
    return;
  }

  const btn = document.getElementById("submitBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Saving to Database...`;

  const fd = {
    activityCode: document.getElementById("f_activityCode").value,
    description: document.getElementById("f_description").value,
    quantity: document.getElementById("f_quantity").value,
    dateRequired: document.getElementById("f_dateRequired").value,
    location: document.getElementById("f_location").value,
    account: document.getElementById("f_account").value,
    donor: document.getElementById("f_donor").value,
    department: document.getElementById("f_department").value,
    budgetCode: document.getElementById("f_budgetCode").value
  };

  try {
    // 1. Fetch current database array
    const fetchUrl = `github.com{CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/contents/${CONFIG.DATABASE_FILE}`;
    const getRes = await fetch(fetchUrl, { headers: { "Authorization": `token ${APP_STATE.githubToken}` }});
    
    let dbContent = [];
    let currentSha = null;
    if (getRes.ok) {
      const data = await getRes.json();
      currentSha = data.sha;
      dbContent = JSON.parse(decodeURIComponent(escape(atob(data.content))));
    }

    // 2. Format database record via data.js helper
    const structuredRecord = data_create(fd, APP_STATE.userEmail);
    dbContent.push(structuredRecord);

    // 3. Commit new snapshot array straight to repository files
    const writeResponse = await fetch(fetchUrl, {
      method: "PUT",
      headers: { "Authorization": `token ${APP_STATE.githubToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Logistics Record Added: ${structuredRecord.requestId}`,
        content: btoa(unescape(encodeURIComponent(JSON.stringify(dbContent, null, 2)))),
        sha: currentSha
      })
    });

    if (writeResponse.ok) {
      alert(`Requisition successfully tracked! ID: ${structuredRecord.requestId}`);
      showView("dashboard");
    } else {
      throw new Error("GitHub rejected database modification payload packet.");
    }
  } catch (error) {
    alert("Transaction processing failed: " + error.message);
    btn.disabled = false;
    btn.innerHTML = `<i class="bi bi-send me-2"></i>Submit Request`;
  }
}

// ── OPEN ROW MODAL DETAILS PANEL ──
async function openDetailsModal(requestId) {
  const modalEl = document.getElementById("detailModal");
  if (!modalEl) return;
  const bsModal = new bootstrap.Modal(modalEl);
  
  document.getElementById("detailReqId").textContent = `Request Reference: ${requestId}`;
  bsModal.show();

  const record = APP_STATE.records.find(r => r.requestId === requestId);
  if (!record) return;

  document.getElementById("detailFields").innerHTML = `
    <div class="col-md-6"><h6>Activity Code</h6><p class="bg-light p-2 rounded">${record.activityCode}</p></div>
    <div class="col-md-6"><h6>Department / Budget Line</h6><p class="bg-light p-2 rounded">${record.department || "—"} (${record.budgetCode || "—"})</p></div>
    <div class="col-12"><h6>Description Specifications</h6><p class="bg-light p-2 rounded">${record.description}</p></div>
    <div class="col-md-4"><h6>Quantity</h6><p class="bg-light p-2 rounded">${record.quantity}</p></div>
    <div class="col-md-4"><h6>Required By</h6><p class="bg-light p-2 rounded">${record.dateRequired}</p></div>
    <div class="col-md-4"><h6>Location</h6><p class="bg-light p-2 rounded">${record.location || "—"}</p></div>
  `;
}

function filterTable(val) {
  const txt = val.toLowerCase().trim();
  document.querySelectorAll("#dashTableBody tr").forEach(tr => {
    tr.style.display = tr.innerText.toLowerCase().includes(txt) ? "" : "none";
  });
}
