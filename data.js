// ============================================================
//  UBF LOGISTICS & PROCUREMENT – data.js Layer (GitHub Native)
// ============================================================

function rowToObj_(row) {
  return {
    requestId:    row.requestId || "",
    dateRequest:  row.dateRequest || "",
    activityCode: row.activityCode || "",
    description:  row.description || "",
    quantity:     row.quantity || "",
    dateRequired: row.dateRequired || "",
    location:     row.location || "",
    account:      row.account || "",
    donor:        row.donor || "",
    department:   row.department || "",
    budgetCode:   row.budgetCode || "",
    requestedBy:  row.requestedBy || "",
    adminStatus:  row.adminStatus || "Pending",
    famStatus:    row.famStatus || "Pending",
    edStatus:     row.edStatus || "Pending",
    comments:     row.comments || [],
    documents:    row.documents || [],
    auditLog:     row.auditLog || []
  };
}

function data_getDashboard(allRows, role, realEmail, devShowAll) {
  const cleanEmail = (realEmail || "").toLowerCase().trim();
  const rows = [];

  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i];
    if (!row.requestId) continue;

    const adm = (row.adminStatus || "Pending").toString().trim();
    const fam = (row.famStatus   || "Pending").toString().trim();
    const ed  = (row.edStatus    || "Pending").toString().trim();
    const req = (row.requestedBy || "").toLowerCase().trim();

    let show = false;
    if (devShowAll)                    show = true;
    else if (role === "Staff")         show = (req === cleanEmail);
    else if (role === "Admin Officer") show = (adm === "Pending" || adm === "");
    else if (role === "FAM")           show = (adm === "Verified") && (fam === "Pending" || fam === "");
    else if (role === "ED")            show = (fam === "Cleared")  && (ed  === "Pending" || ed  === "");

    if (show) {
      rows.push(rowToObj_(row));
    }
  }
  return rows;
}

function data_getHistory(allRows, realEmail) {
  const cleanEmail = (realEmail || "").toLowerCase().trim();
  const rows = [];
  
  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i];
    if (!row.requestId) continue;
    if ((row.requestedBy || "").toLowerCase().trim() !== cleanEmail) continue;
    
    rows.push(rowToObj_(row));
  }
  return rows;
}

function data_create(fd, submitterEmail) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateString = `${yyyy}${mm}${dd}`;
  const id = "REQ-" + dateString + "-" + Math.floor(1000 + Math.random() * 9000);
  
  return {
    requestId:    id,
    dateRequest:  `${yyyy}-${mm}-${dd}`,
    activityCode: fd.activityCode || "",
    description:  fd.description || "",
    quantity:     fd.quantity || "",
    dateRequired: fd.dateRequired || "",
    location:     fd.location || "",
    account:      fd.account || "",
    donor:        fd.donor || "",
    department:   fd.department || "",
    budgetCode:   fd.budgetCode || "",
    requestedBy:  (submitterEmail || "").toLowerCase().trim(),
    adminStatus:  "Pending",
    famStatus:    "Pending",
    edStatus:     "Pending",
    comments:     [],
    documents:    [],
    auditLog:     []
  };
}

function data_updateStatus(allRows, requestId, role, action, currentUserEmail) {
  let recordIndex = allRows.findIndex(r => r.requestId.toString() === requestId.toString());
  if (recordIndex === -1) return null;

  let ns = "";
  if (role === "Admin Officer") { 
    ns = (action === "Rejected") ? "Rejected" : "Verified"; 
    allRows[recordIndex].adminStatus = ns; 
  }
  else if (role === "FAM") { 
    ns = (action === "Rejected") ? "Rejected" : "Cleared";  
    allRows[recordIndex].famStatus = ns; 
  }
  else if (role === "ED") { 
    ns = (action === "Rejected") ? "Rejected" : "Approved"; 
    allRows[recordIndex].edStatus = ns; 
  }
  else return null;

  data_audit(allRows[recordIndex], role, currentUserEmail, ns);
  return ns;
}

function data_getDetails(allRows, requestId) {
  const record = allRows.find(r => r.requestId.toString() === requestId.toString());
  if (!record) return null;

  return {
    request: rowToObj_(record),
    comments: record.comments || [],
    documents: record.documents || [],
    auditLog: record.auditLog || []
  };
}

function data_addComment(allRows, requestId, email, role, text) {
  let recordIndex = allRows.findIndex(r => r.requestId.toString() === requestId.toString());
  if (recordIndex === -1) return null;

  const now = new Date();
  const timestampStr = now.toLocaleDateString() + " " + now.toLocaleTimeString();
  const newComment = {
    timestamp: timestampStr,
    email: email,
    role: role,
    text: text
  };

  if (!allRows[recordIndex].comments) allRows[recordIndex].comments = [];
  allRows[recordIndex].comments.push(newComment);
  return newComment;
}

async function data_uploadDoc(allRows, requestId, githubToken, githubOwner, githubRepo, email, role, fileName, base64Data) {
  let recordIndex = allRows.findIndex(r => r.requestId.toString() === requestId.toString());
  if (recordIndex === -1) throw new Error("Target requisition reference tag not located.");

  const cleanFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const uniqueStoragePath = `attachments/${requestId}/${Date.now()}_${cleanFileName}`;
    const uploadApiUrl = "github.com" + githubOwner + "/" + githubRepo + "/contents/" + uniqueStoragePath;


  const response = await fetch(uploadApiUrl, {
    method: "PUT",
    headers: {
      "Authorization": `token ${githubToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: `Attachment Upload: ${cleanFileName} for Request ${requestId}`,
      content: base64Data
    })
  });

  if (!response.ok) throw new Error("GitHub repository file storage transmission rejected.");
  
  const resData = await response.json();
  const targetUrl = resData.content.html_url;
  const timestampStr = new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString();

  const docMetadataRecord = {
    timestamp: timestampStr,
    email: email,
    role: role,
    fileName: fileName,
    fileUrl: targetUrl
  };

  if (!allRows[recordIndex].documents) allRows[recordIndex].documents = [];
  allRows[recordIndex].documents.push(docMetadataRecord);
  return docMetadataRecord;
}

function data_audit(targetRow, role, actor, status) {
  const timestampStr = new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString();
  
  if (!targetRow.auditLog) targetRow.auditLog = [];
  targetRow.auditLog.push({
    timestamp: timestampStr,
    role: role,
    actor: actor,
    newStatus: status
  });
}
