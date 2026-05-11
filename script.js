// ============================================================
//  UBF LOGISTICS & PROCUREMENT – script.js (Original Router)
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
});

function promptForCredentials() {
  var email = prompt("Enter your UBF Corporate Email:", APP_STATE.userEmail);
  var token = prompt("Enter your GitHub Personal Access Token (PAT):");
  
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
  var cleanEmail = APP_STATE.userEmail.toLowerCase().trim();
  APP_STATE.isDev = DEV_EMAILS.includes(cleanEmail);
  APP_STATE.userRole = ROLES_CONFIG[cleanEmail] || "Staff";

  var roleLabel = document.getElementById("roleLabel");
  var emailLabel = document.getElementById("emailLabel");
  if (roleLabel) roleLabel.textContent = APP_STATE.userRole;
  if (emailLabel) emailLabel.textContent = APP_STATE.userEmail;
}

function showView(viewName) {
  var container = document.getElementById("mainContentContainer");
  if (!container) return;

  fetch(viewName + ".html")
    .then(function(res) { return res.text(); })
    .then(function(html) {
      container.innerHTML = html;
      if (viewName === "dashboard") {
        loadDashboard();
      } else if (viewName === "form") {
        document.getElementById("requestedByDisplay").textContent = APP_STATE.userEmail;
        document.getElementById("ubfLogoForm").src = "logo.png";
      }
    });
}

async function loadDashboard() {
  var tbody = document.getElementById("dashTableBody");
  var url = "github.com" + CONFIG.GITHUB_OWNER + "/" + CONFIG.GITHUB_REPO + "/contents/" + CONFIG.DATABASE_FILE;

  try {
    var response = await fetch(url, {
      headers: { "Authorization": "token " + APP_STATE.githubToken }
    });
    
    if (response.ok) {
      var data = await response.json();
      APP_STATE.db_sha = data.sha;
      var decoded = decodeURIComponent(escape(atob(data.content)));
      var allRows = JSON.parse(decoded);
      APP_STATE.records = data_getDashboard(allRows, APP_STATE.userRole, APP_STATE.userEmail, false);
      renderDashboardUI();
    }
  } catch (err) {
    console.error(err);
  }
}

function renderDashboardUI() {
  var tbody = document.getElementById("dashTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  APP_STATE.records.forEach(function(item) {
    var tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="fw-bold text-primary">${item.requestId}</td>
      <td>${item.dateRequest}</td>
      <td><strong>${item.activityCode}</strong><br><small class="text-muted">${item.description}</small></td>
      <td>${item.quantity}</td>
      <td>${item.dateRequired}</td>
      <td>${item.location || "—"}</td>
      <td>${item.department || "—"}</td>
      <td><small>${item.requestedBy}</small></td>
      <td><span class="badge bg-warning text-dark">${item.adminStatus}</span></td>
      <td><span class="badge bg-secondary">${item.famStatus}</span></td>
      <td><span class="badge bg-secondary">${item.edStatus}</span></td>
      <td class="text-center">—</td>
    `;
    tbody.appendChild(tr);
  });
}

async function handleFormSubmit() {
  var btn = document.getElementById("submitBtn");
  btn.disabled = true;

  var fd = {
    activityCode: document.getElementById("f_activityCode").value,
    description: document.getElementById("f_description").value,
    quantity: document.getElementById("f_quantity").value,
    dateRequired: document.getElementById("f_dateRequired").value,
    location: document.getElementById("f_location").value,
    account: "", donor: "", department: "", budgetCode: ""
  };

  try {
    var url = "github.com" + CONFIG.GITHUB_OWNER + "/" + CONFIG.GITHUB_REPO + "/contents/" + CONFIG.DATABASE_FILE;
    var res = await fetch(url, { headers: { "Authorization": "token " + APP_STATE.githubToken }});
    var dbContent = [];
    
    if (res.ok) {
      var data = await res.json();
      APP_STATE.db_sha = data.sha;
      dbContent = JSON.parse(decodeURIComponent(escape(atob(data.content))));
    }

    var newRecord = data_create(fd, APP_STATE.userEmail);
    dbContent.push(newRecord);

    await fetch(url, {
      method: "PUT",
      headers: { "Authorization": "token " + APP_STATE.githubToken, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Add requisition " + newRecord.requestId,
        content: btoa(unescape(encodeURIComponent(JSON.stringify(dbContent, null, 2)))),
        sha: APP_STATE.db_sha
      })
    });

    alert("Success! ID: " + newRecord.requestId);
    showView("dashboard");
  } catch (error) {
    alert("Error: " + error.message);
    btn.disabled = false;
  }
}
