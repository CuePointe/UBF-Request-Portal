// ============================================================
//  UBF LOGISTICS & PROCUREMENT – data.js Layer (Global Pattern)
// ============================================================

window.DataService = {
  rowToObj: function(row) {
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
  },

  getDashboard: function(allRows, role, realEmail, devShowAll) {
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

      if (show) rows.push(this.rowToObj(row));
    }
    return rows;
  },

  createRecord: function(fd, submitterEmail) {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const id = "REQ-" + yyyy + mm + dd + "-" + Math.floor(1000 + Math.random() * 9000);
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
};
