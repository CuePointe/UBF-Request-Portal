// ============================================================
//  UBF LOGISTICS & PROCUREMENT – script.js (Absolute API Fix)
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
  fetch(viewName + ".html?_=" + Date.now())
    .then(res => res.text())
    .then(html => {
      container.innerHTML = html;
      if (viewName === "dashboard") loadDashboard();
      if (viewName === "form") document.getElementById("requestedByDisplay").textContent = APP_STATE.userEmail;
    });
}

async function loadDashboard() {
  const tbody = document.getElementById("dashTableBody");
  // CRITICAL FIX: Direct absolute URL call path mapping to GitHub APIs
  const url = "https://api.github.com/repos/" + CONFIG.GITHUB_OWNER + "/" + CONFIG.GITHUB_REPO + "/contents/" + CONFIG.DATABASE_FILE + "?_ Graham=" + Date.now();

  try {
    const response = await fetch(url, {
      headers: { "Authorization": "token " + APP_STATE.githubToken, "Accept": "application/vnd.github.v3+json" }
    });
    if (response.ok) {
      const data = await response.json();
      APP_STATE.db_sha = data.sha;
      const decoded = decodeURIComponent(escape(atob(data.content)));
      const allRows = JSON.parse(decoded);
      // Reads from global window layout hook
      APP_STATE.records = window.DataService.getDashboard(allRows, APP_STATE.userRole, APP_STATE.userEmail, false);
      renderDashboardUI();
    }
  } catch (err) { console.error(err); }
}

function renderDashboardUI() {
  const tbody = document.getElementById("dashTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  APP_STATE.records.forEach(item => {
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
    const url = "https://api.github.com/repos/" + CONFIG.GITHUB_OWNER + "/" + CONFIG.GITHUB_REPO + "/contents/" + CONFIG.DATABASE_FILE;
    const res = await fetch(url, { headers: { "Authorization": "token " + APP_STATE.githubToken }});
    let dbContent = [];
    if (res.ok) {
      const data = await res.json();
      APP_STATE.db_sha = data.sha;
      dbContent = JSON.parse(decodeURIComponent(escape(atob(data.content))));
    }

    const newRecord = window.DataService.createRecord(fd, APP_STATE.userEmail);
    dbContent.push(newRecord);

    const writeRes = await fetch(url, {
      method: "PUT",
      headers: { "Authorization": "token " + APP_STATE.githubToken, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Add request " + newRecord.requestId,
        content: btoa(unescape(encodeURIComponent(JSON.stringify(dbContent)))),
        sha: APP_STATE.db_sha
      })
    });

    if (writeRes.ok) {
      alert("Success! ID: " + newRecord.requestId);
      showView("dashboard");
    }
  } catch (error) { alert(error.message); btn.disabled = false; }
}
