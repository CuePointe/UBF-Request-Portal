// ============================================================
//  UBF LOGISTICS & PROCUREMENT  –  api.js (100% GITHUB NATIVE)
// ============================================================

const CONFIG = {
  // Replace these with your actual GitHub Repository details
  GITHUB_OWNER: "YOUR_GITHUB_USERNAME_OR_ORG",
  GITHUB_REPO : "YOUR_REPOSITORY_NAME",
  DATABASE_FILE: "data/requisitions.json", // File where portal records save
  
  ROLES: {
    "s.abonyo@ugandabiodiversityfund.org"  : "Admin Officer",
    "w.nabatanzi@ugandabiodiversityfund.org": "FAM",
    "i.amani@ugandabiodiversityfund.org"   : "ED"
  },
  DEV_EMAILS: ["t.otieno@ugandabiodiversityfund.org"]
};

// --- GitHub Storage Core Communication ---
async function fetchDatabase(token) {
  const url = `github.com{CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/contents/${CONFIG.DATABASE_FILE}`;
  try {
    const response = await fetch(url, {
      headers: { "Authorization": `token ${token}`, "Accept": "application/vnd.github.v3+json" }
    });
    if (response.status === 404) return { sha: null, content: [] }; // Empty database setup
    
    const data = await response.json();
    const decodedContent = decodeURIComponent(escape(atob(data.content)));
    return { sha: data.sha, content: JSON.parse(decodedContent) };
  } catch (error) {
    console.error("Database fetch error:", error);
    return { sha: null, content: [] };
  }
}

async function saveDatabase(token, sha, jsonContent, commitMessage) {
  const url = `github.com{CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/contents/${CONFIG.DATABASE_FILE}`;
  const contentString = btoa(unescape(encodeURIComponent(JSON.stringify(jsonContent, null, 2))));
  
  const payload = {
    message: commitMessage,
    content: contentString,
    sha: sha
  };

  const response = await fetch(url, {
    method: "PUT",
    headers: { "Authorization": `token ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return response.ok;
}

// --- Role Resolver ---
function getUserRole(userEmail, testRole) {
  const cleanEmail = (userEmail || "").toLowerCase().trim();
  const isDev = CONFIG.DEV_EMAILS.includes(cleanEmail);
  
  if (isDev && testRole) {
    return { email: cleanEmail + " [preview]", role: testRole, isDev: true, realEmail: cleanEmail };
  }
  return { email: cleanEmail, role: CONFIG.ROLES[cleanEmail] || "Staff", isDev: isDev, realEmail: cleanEmail };
}

// --- Fetch Dashboard Metrics ---
async function getDashboardData(token, userEmail, testRole, showAll) {
  const user = getUserRole(userEmail, testRole);
  const db = await fetchDatabase(token);
  const rows = [];
  const devAll = showAll && user.isDev;

  db.content.forEach(row => {
    const adm = row.adminStatus || "Pending";
    const fam = row.famStatus || "Pending";
    const ed = row.edStatus || "Pending";
    const req = (row.requestedBy || "").toLowerCase().trim();
    
    let show = false;
    if (devAll) show = true;
    else if (user.role === "Staff") show = (req === user.realEmail);
    else if (user.role === "Admin Officer") show = (adm === "Pending" || adm === "");
    else if (user.role === "FAM") show = (adm === "Verified" && (fam === "Pending" || fam === ""));
    else if (user.role === "ED") show = (fam === "Cleared" && (ed === "Pending" || ed === ""));
    
    if (show) {
      rows.push({ ...row, adminStatus: adm, famStatus: fam, edStatus: ed });
    }
  });
  
  return { user: user, rows: rows };
}

// --- Submit Requisition Form ---
async function submitRequest(token, userEmail, formData) {
  try {
    const db = await fetchDatabase(token);
    const now = new Date();
    const dateString = now.toISOString().split('T')[0].replace(/-/g, '');
    const id = `REQ-${dateString}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newRecord = {
      requestId: id,
      dateRequest: now.toISOString().split('T')[0],
      activityCode: formData.activityCode || "",
      description: formData.description || "",
      quantity: formData.quantity || "",
      dateRequired: formData.dateRequired || "",
      location: formData.location || "",
      account: formData.account || "",
      donor: formData.donor || "",
      department: formData.department || "",
      budgetCode: formData.budgetCode || "",
      requestedBy: userEmail.toLowerCase().trim(),
      adminStatus: "Pending",
      famStatus: "Pending",
      edStatus: "Pending"
    };

    db.content.push(newRecord);
    const success = await saveDatabase(token, db.sha, db.content, `New Requisition Form: ${id}`);
    return { success: success, requestId: id };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

// --- Procurement Sign-off Action (Approve / Reject) ---
async function updateRequestStatus(token, userEmail, requestId, action, testRole) {
  try {
    const user = getUserRole(userEmail, testRole);
    const db = await fetchDatabase(token);
    let recordIndex = db.content.findIndex(r => r.requestId.toString() === requestId.toString());
    
    if (recordIndex === -1) return { success: false, error: "Record not found" };
    
    let newStatus = "";
    if (user.role === "Admin Officer") {
      newStatus = (action === "Rejected") ? "Rejected" : "Verified";
      db.content[recordIndex].adminStatus = newStatus;
    } else if (user.role === "FAM") {
      newStatus = (action === "Rejected") ? "Rejected" : "Cleared";
      db.content[recordIndex].famStatus = newStatus;
    } else if (user.role === "ED") {
      newStatus = (action === "Rejected") ? "Rejected" : "Approved";
      db.content[recordIndex].edStatus = newStatus;
    } else {
      return { success: false, error: "No processing permission for role: " + user.role };
    }

    const success = await saveDatabase(token, db.sha, db.content, `Status Update ${requestId} to ${newStatus}`);
    return { success: success, requestId: requestId, newStatus: newStatus };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

