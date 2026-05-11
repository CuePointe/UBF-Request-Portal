// ============================================================
//  UBF LOGISTICS & PROCUREMENT – script.js (Production Fixed)
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
  records: [],
  db_sha: null
};

const ROLES_CONFIG = {
  "s.abonyo@ugandabiodiversityfund.org"  : "Admin Officer",
  "w.nabatanzi@ugandabiodiversityfund.org": "FAM",
  "i.amani@ugandabiodiversityfund.org"   : "ED"
};

document.addEventListener("DOMContentLoaded", function() {
  APP_STATE.githubToken = localStorage.getItem("ubf_github_token") || "";
  APP_STATE.userEmail = localStorage.getItem("ubf_user_email") || "";

  if (!APP_STATE.githubToken || !APP_STATE.userEmail) {
    promptForCredentials();
  } else {
    resolveUserPermissions();
    showView("dashboard");
  }
});

function promptForCredentials() {
  const email = prompt("Enter your UBF Email:", APP_STATE.userEmail);
  const token = prompt("Enter your GitHub Personal Access Token (PAT):");
  if (email && token) {
    APP_STATE.userEmail = email.trim().toLowerCase();
    APP_STATE.githubToken = token.trim();
    localStorage.setItem("ubf_user_email", APP_STATE.userEmail);
    localStorage.setItem("ubf_github_token", APP_STATE.githubToken);
    resolveUserPermissions();
    showView("dashboard");
  }
}

function resolveUserPermissions() {
  const cleanEmail = APP_STATE.userEmail.toLowerCase().trim();
  APP_STATE.userRole = ROLES_CONFIG[cleanEmail] || "Staff";
  if(document.getElementById("roleLabel")) document.getElementById("roleLabel").textContent = APP_STATE.userRole;
  if(document.getElementById("emailLabel")) document.getElementById("emailLabel").textContent = APP_STATE.userEmail;
}

function showView(viewName) {
  const container = document.getElementById("mainContentContainer");
  if (!container) return;
  
  // FIXED: Removed corrupted URL character extensions 
  fetch(viewName + ".html?_=" + Date.now())
    .then(res => res.text())
    .then(html => {
      container.innerHTML = html;
      if (viewName === "dashboard") loadDashboard();
      if (viewName === "form") document.getElementById("requestedByDisplay").textContent = APP_STATE.userEmail;
    });
}

function safeToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binString = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binString += String.fromCharCode(bytes[i]);
  }
  return btoa(binString);
}

function safeFromBase64(base64) {
  const binString = atob(base64);
  const bytes = new Uint8Array(binString.length);
  for (let i = 0; i < binString.length; i++) {
    bytes[i] = binString.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

async function loadDashboard() {
  const tbody = document.getElementById("dashTableBody");
  if (tbody) tbody.innerHTML = `<tr><td colspan="12" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Accessing GitHub ledger...</td></tr>`;

  // FIXED: Re-built the clean, absolute repository URL path string
  const url = "github.com" + CONFIG.GITHUB_OWNER + "/" + CONFIG.GITHUB_REPO + "/contents/" + CONFIG.DATABASE_FILE + "?_=" + Date.now();

  try {
    const response = await fetch(url, {
      headers: { "Authorization": "token " + APP_STATE.githubToken, "Accept": "application/vnd.github.v3+json" }
    });
    if (response.ok) {
      const data = await response.json();
      APP_STATE.db_sha = data.sha;
      const cleanJsonString = safeFromBase64(data.content.replace(/\s/g, ""));
      const allRows = JSON.parse(cleanJsonString);
      APP_STATE.records = window.DataService.getDashboard(allRows, APP_STATE.userRole, APP_STATE.userEmail, false);
      renderDashboardUI();
    } else {
      if (tbody) tbody.innerHTML = `<tr><td colspan="12" class="text-center text-danger py-4">Database file not initialized. Please ensure data/requisitions.json contains [].</td></tr>`;
    }
  } catch (err) { 
    console.error(err); 
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
      <td><strong>${item.activityCode}</strong><br><small class="text-muted">${item.description}</small></td>
      <td>${item.quantity}</td>
      <td>${item.dateRequired}</td>
      <td>${item.location || "—"}</td>
      <td>${item.department || "—"}</td>
      <td><small>${item.requestedBy}</small></td>
      <td><span class="badge bg-secondary">${item.adminStatus}</span></td>
      <td><span class="badge bg-secondary">${item.famStatus}</span></td>
      <td><span class="badge bg-secondary">${item.edStatus}</span></td>
      <td>—</td>
    `;
    tbody.appendChild(tr);
  });

  updateMetricsDisplay(total, pending, approved, rejected);
}

function updateMetricsDisplay(t, p, a, r) {
  if(document.getElementById("statTotal")) document.getElementById("statTotal").textContent = t;
  if(document.getElementById("statPending")) document.getElementById("statPending").textContent = p;
  if(document.getElementById("statApproved")) document.getElementById("statApproved").textContent = a;
  if(document.getElementById("statRejected")) document.getElementById("statRejected").textContent = r;
}

async function handleFormSubmit() {
  const btn = document.getElementById("submitBtn");
  btn.disabled = true;

  const fd = {
    activityCode: document.getElementById("f_activityCode").value,
    description: document.getElementById("f_description").value,
    quantity: document.getElementById("f_quantity").value,
    dateRequired: document.getElementById("f_dateRequired").value,
    location: document.getElementById("f_location").value,
    account: "", donor: "", department: "", budgetCode: ""
  };

  try {
    const url = "github.com" + CONFIG.GITHUB_OWNER + "/" + CONFIG.GITHUB_REPO + "/contents/" + CONFIG.DATABASE_FILE;
    const res = await fetch(url, { headers: { "Authorization": "token " + APP_STATE.githubToken, "Accept": "application/vnd.github.v3+json" }});
    let dbContent = [];
    if (res.ok) {
      const data = await res.json();
      APP_STATE.db_sha = data.sha;
      const cleanJsonString = safeFromBase64(data.content.replace(/\s/g, ""));
      dbContent = JSON.parse(cleanJsonString);
    }

    const newRecord = window.DataService.createRecord(fd, APP_STATE.userEmail);
    dbContent.push(newRecord);

    const jsonStringPayload = JSON.stringify(dbContent);
    const base64Payload = safeToBase64(jsonStringPayload);

    const writeRes = await fetch(url, {
      method: "PUT",
      headers: { 
        "Authorization": "token " + APP_STATE.githubToken, 
        "Content-Type": "application/json",
        "Accept": "application/vnd.github.v3+json"
      },
      body: JSON.stringify({
        message: "Add request " + newRecord.requestId,
        content: base64Payload,
        sha: APP_STATE.db_sha
      })
    });

    if (writeRes.ok) {
      alert("Success! ID: " + newRecord.requestId);
      showView("dashboard");
    } else {
      const errData = await writeRes.json();
      throw new Error(errData.message || "GitHub API write blocked.");
    }
  } catch (error) { 
    alert("API Error: " + error.message); 
    btn.disabled = false; 
  }
}
