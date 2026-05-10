// ═══════════════════════════════════════════════════
//  UBF PROCUREMENT & LOGISTICS PORTAL  –  JavaScript (GitHub Native)
// ═══════════════════════════════════════════════════

var APP_STATE = {
  githubToken: "",       // Used to authenticate repository updates
  userEmail: "",
  userRole: "Staff",
  isDev: false,
  roleOverride: "",
  showAllData: false,
  records: []
};

const CONFIG = {
  GITHUB_OWNER: "CuePointe", // Change this
  GITHUB_REPO : "UBF-Request-Portal",         // Change this
  DATABASE_FILE: "data/requisitions.json",
  ROLES_CONFIG: {
    "s.abonyo@ugandabiodiversityfund.org"  : "Admin Officer",
    "w.nabatanzi@ugandabiodiversityfund.org": "FAM",
    "i.amani@ugandabiodiversityfund.org"   : "ED"
  },
  DEV_EMAILS: ["t.otieno@ugandabiodiversityfund.org"]
};

const ROLES = {
  "Staff": { title: "Staff Portal", color: "#28a745", canApprove: false },
  "Admin Officer": { title: "Admin Review", color: "#0066cc", canApprove: true },
  "FAM": { title: "Finance Review", color: "#6f42c1", canApprove: true },
  "ED": { title: "Final Approval", color: "#dc3545", canApprove: true }
};

document.addEventListener("DOMContentLoaded", function() {
  // Pull credentials from browser cache or ask the user
  APP_STATE.githubToken = localStorage.getItem("ubf_github_token") || "";
  APP_STATE.userEmail = localStorage.getItem("ubf_user_email") || "";

  if (!APP_STATE.githubToken || !APP_STATE.userEmail) {
    promptForCredentials();
  } else {
    resolveUserPermissions();
    refreshDashboard();
  }
  
  // Shortcut Panel: Ctrl+Shift+D
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
    refreshDashboard();
  } else {
    alert("Access Denied. GitHub runtime credentials required.");
  }
}

function resolveUserPermissions() {
  const cleanEmail = APP_STATE.userEmail.toLowerCase().trim();
  APP_STATE.isDev = CONFIG.DEV_EMAILS.includes(cleanEmail);
  
  if (APP_STATE.roleOverride) {
    APP_STATE.userRole = APP_STATE.roleOverride;
  } else {
    APP_STATE.userRole = CONFIG.ROLES_CONFIG[cleanEmail] || "Staff";
  }
}

/**
 * Communicates natively with GitHub storage instead of Google Apps Script
 */
async function refreshDashboard() {
  updateUIState("loading");
  resolveUserPermissions();

  const url = `github.com{CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/contents/${CONFIG.DATABASE_FILE}`;

  try {
    const response = await fetch(url, {
      headers: { 
        "Authorization": `token ${APP_STATE.githubToken}`, 
        "Accept": "application/vnd.github.v3+json" 
      }
    });
    
    if (response.status === 404) {
      APP_STATE.records = [];
    } else {
      const data = await response.json();
      // Decode base64 file data content hosted on GitHub
      const decodedContent = decodeURIComponent(escape(atob(data.content)));
      const rawRecords = JSON.parse(decodedContent);
      
      // Filter records in browser memory using your legacy business logic rules
      APP_STATE.records = filterRecordsForUser(rawRecords);
    }

    renderUI();
  } catch (err) {
    console.error("GitHub file fetch operations failed:", err);
    setElementText("statusMessage", "Database connection failed.");
    updateUIState("error");
  }
}

function filterRecordsForUser(allRows) {
  const cleanEmail = APP_STATE.userEmail.toLowerCase().trim();
  const devAll = APP_STATE.showAllData && APP_STATE.isDev;
  
  return allRows.filter(row => {
    if (devAll) return true;
    
    const adm = row.adminStatus || "Pending";
    const fam = row.famStatus || "Pending";
    const ed = row.edStatus || "Pending";
    const req = (row.requestedBy || "").toLowerCase().trim();
    
    if (APP_STATE.userRole === "Staff") return (req === cleanEmail);
    if (APP_STATE.userRole === "Admin Officer") return (adm === "Pending" || adm === "");
    if (APP_STATE.userRole === "FAM") return (adm === "Verified" && (fam === "Pending" || fam === ""));
    if (APP_STATE.userRole === "ED") return (fam === "Cleared" && (ed === "Pending" || ed === ""));
    
    return false;
  });
}

function renderUI() {
  const config = ROLES[APP_STATE.userRole] || ROLES["Staff"];
  
  setElementText("displayRole", APP_STATE.userRole);
  setElementText("displayUser", APP_STATE.userEmail);
  setElementText("viewTitle", config.title);

  const tbody = document.getElementById("mainTableBody");
  if (!tbody) return;

  if (APP_STATE.records.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="text-center">No active requisitions.</td></tr>';
    updateUIState("ready");
    return;
  }

  let rowsHtml = "";
  APP_STATE.records.forEach(item => {
    rowsHtml += `
      <tr>
        <td class="fw-bold text-primary">${item.requestId}</td>
        <td>${item.dateRequest}</td>
        <td>${item.activityCode}</td>
        <td>${item.description}</td>
        <td>${item.quantity}</td>
        <td>${statusBadge(item.adminStatus)}</td>
        <td>${statusBadge(item.famStatus)}</td>
        <td>${statusBadge(item.edStatus)}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="viewRow('${item.requestId}')">Open</button>
        </td>
      </tr>`;
  });

  tbody.innerHTML = rowsHtml;
  updateUIState("ready");
}

function statusBadge(val) {
  let cls = "bg-secondary";
  if (["Approved", "Verified", "Cleared"].includes(val)) cls = "bg-success";
  if (val === "Rejected") cls = "bg-danger";
  if (val === "Pending") cls = "bg-warning text-dark";
  return `<span class="badge ${cls}">${val || "Pending"}</span>`;
}

function updateUIState(state) {
  const views = ["loading", "ready", "error"];
  views.forEach(v => {
    const el = document.getElementById(v + "View");
    if (el) el.style.display = (v === state ? "block" : "none");
  });
}

function setElementText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}

function changeRole(r) {
  APP_STATE.roleOverride = r;
  refreshDashboard();
}
