// ═══════════════════════════════════════════════════
//  PROCUREMENT PORTAL  –  JavaScript (GitHub Edition)
// ═══════════════════════════════════════════════════

/** 
 * Replace 'YOUR_DEPLOYMENT_URL' with the Web App URL 
 * provided by Google after you deploy the Code.gs file.
 */
const API_ENDPOINT = "YOUR_DEPLOYMENT_URL";

var APP_STATE = {
  userEmail: "",
  userRole: "Staff",
  isDev: false,
  roleOverride: "",
  showAllData: false,
  records: []
};

const ROLES = {
  "Staff": { title: "Staff Portal", color: "#28a745", canApprove: false },
  "Admin Officer": { title: "Admin Review", color: "#0066cc", canApprove: true },
  "FAM": { title: "Finance Review", color: "#6f42c1", canApprove: true },
  "ED": { title: "Final Approval", color: "#dc3545", canApprove: true }
};

document.addEventListener("DOMContentLoaded", function() {
  refreshDashboard();
  
  // Shortcut: Ctrl+Shift+D
  document.addEventListener("keydown", function(e) {
    if (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
      e.preventDefault();
      const dev = document.getElementById("devPanel");
      if (dev) dev.style.display = (dev.style.display === "none" ? "block" : "none");
    }
  });
});

/**
 * Communicates with the Google Sheets backend via Fetch API
 */
async function refreshDashboard() {
  updateUIState("loading");

  const query = new URLSearchParams({
    requestType: "fetchDashboard",
    role: APP_STATE.roleOverride,
    all: APP_STATE.showAllData
  });

  try {
    const response = await fetch(`${API_ENDPOINT}?${query.toString()}`);
    const data = await response.json();
    
    if (data.error) throw new Error(data.error);

    APP_STATE.userEmail = data.user.email;
    APP_STATE.userRole = data.user.role;
    APP_STATE.isDev = data.user.isDev;
    APP_STATE.records = data.rows || [];

    renderUI();
  } catch (err) {
    console.error("Data fetch failed:", err);
    setElementText("statusMessage", "Database connection failed.");
  }
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
        <td class="fw-bold">${item.requestId}</td>
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
