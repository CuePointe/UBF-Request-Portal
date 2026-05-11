// ============================================================
//  UBF LOGISTICS & PROCUREMENT – data.js Layer (Original Native)
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
    edStatus:     row.edStatus || "Pending"
  };
}

function data_getDashboard(allRows, role, realEmail, devShowAll) {
  var cleanEmail = (realEmail || "").toLowerCase().trim();
  var rows = [];

  for (var i = 0; i < allRows.length; i++) {
    var row = allRows[i];
    if (!row.requestId) continue;

    var adm = (row.adminStatus || "Pending").toString().trim();
    var fam = (row.famStatus   || "Pending").toString().trim();
    var ed  = (row.edStatus    || "Pending").toString().trim();
    var req = (row.requestedBy || "").toLowerCase().trim();

    var show = false;
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

function data_create(fd, submitterEmail) {
  var now = new Date();
  var yyyy = now.getFullYear();
  var mm = String(now.getMonth() + 1).padStart(2, '0');
  var dd = String(now.getDate()).padStart(2, '0');
  var dateString = yyyy + mm + dd;
  var id = "REQ-" + dateString + "-" + Math.floor(1000 + Math.random() * 9000);
  
  return {
    requestId:    id,
    dateRequest:  yyyy + "-" + mm + "-" + dd,
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
