// ============================================================
//  UBF LOGISTICS & PROCUREMENT  –  Data.gs
//  Dedicated CRUD operations layer (separate from routing)
//  Follows recommended architecture: Code.gs = routing only
// ============================================================

var SHEETS = {
  REQUISITIONS : "Requisitions",
  COMMENTS     : "Comments",
  DOCUMENTS    : "Documents",
  AUDIT        : "AuditLog"
};

var HEADERS = {
  REQUISITIONS : ["Request ID","Date of Request","Activity Code","Description","Quantity",
                  "Date Required","Location","Account","Donor","Department","Budget Code",
                  "Requested By","Admin Status","FAM Status","ED Status"],
  COMMENTS     : ["Timestamp","Request ID","Email","Role","Comment"],
  DOCUMENTS    : ["Timestamp","Request ID","Email","Role","File Name","Drive File ID","Drive URL"],
  AUDIT        : ["Timestamp","Request ID","Role","Actor","New Status"]
};

var DCOL = {
  REQUEST_ID:0, DATE_REQUEST:1, ACTIVITY_CODE:2, DESCRIPTION:3,
  QUANTITY:4, DATE_REQUIRED:5, LOCATION:6, ACCOUNT:7, DONOR:8,
  DEPARTMENT:9, BUDGET_CODE:10, REQUESTED_BY:11,
  ADMIN_STATUS:12, FAM_STATUS:13, ED_STATUS:14
};

// ── Sheet helper ──────────────────────────────────────────
function getOrCreateSheet_(name, headers) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var s  = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    if (headers && headers.length) {
      s.appendRow(headers);
      s.getRange(1,1,1,headers.length).setFontWeight("bold")
       .setBackground("#0066cc").setFontColor("#ffffff");
    }
  }
  return s;
}

// ── Drive folder helper ───────────────────────────────────
function getDriveFolder_(name, parent) {
  var iter = parent ? parent.getFoldersByName(name) : DriveApp.getFoldersByName(name);
  if (iter.hasNext()) return iter.next();
  return parent ? parent.createFolder(name) : DriveApp.createFolder(name);
}

// ── READ: Dashboard rows (role-filtered) ──────────────────
function data_getDashboard(role, realEmail, devShowAll) {
  var sheet = getOrCreateSheet_(SHEETS.REQUISITIONS, HEADERS.REQUISITIONS);
  var data  = sheet.getDataRange().getValues();
  var rows  = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[DCOL.REQUEST_ID]) continue;

    var adm = (row[DCOL.ADMIN_STATUS]||"Pending").toString().trim();
    var fam = (row[DCOL.FAM_STATUS]  ||"Pending").toString().trim();
    var ed  = (row[DCOL.ED_STATUS]   ||"Pending").toString().trim();
    var req = (row[DCOL.REQUESTED_BY]||"").toString().toLowerCase().trim();

    var show = false;
    if      (devShowAll)               show = true;
    else if (role === "Staff")         show = (req === realEmail);
    else if (role === "Admin Officer") show = (adm === "Pending" || adm === "");
    else if (role === "FAM")           show = (adm === "Verified") && (fam === "Pending" || fam === "");
    else if (role === "ED")            show = (fam === "Cleared")  && (ed  === "Pending" || ed  === "");

    if (show) rows.push(rowToObj_(row, adm, fam, ed));
  }
  return rows;
}

// ── READ: My history ──────────────────────────────────────
function data_getHistory(realEmail) {
  var sheet = getOrCreateSheet_(SHEETS.REQUISITIONS, HEADERS.REQUISITIONS);
  var data  = sheet.getDataRange().getValues();
  var rows  = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[DCOL.REQUEST_ID]) continue;
    if ((row[DCOL.REQUESTED_BY]||"").toString().toLowerCase().trim() !== realEmail) continue;
    rows.push(rowToObj_(row,
      (row[DCOL.ADMIN_STATUS]||"Pending")+"",
      (row[DCOL.FAM_STATUS]  ||"Pending")+"",
      (row[DCOL.ED_STATUS]   ||"Pending")+""
    ));
  }
  return rows;
}

// ── CREATE: New requisition ───────────────────────────────
function data_create(fd, submitterEmail) {
  var sheet = getOrCreateSheet_(SHEETS.REQUISITIONS, HEADERS.REQUISITIONS);
  var now   = new Date();
  var id    = "REQ-" +
              Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyyMMdd") +
              "-" + Math.floor(1000 + Math.random() * 9000);
  sheet.appendRow([
    id, now,
    fd.activityCode||"", fd.description||"",  fd.quantity||"",
    fd.dateRequired||"", fd.location||"",      fd.account||"",
    fd.donor||"",        fd.department||"",    fd.budgetCode||"",
    submitterEmail, "Pending", "Pending", "Pending"
  ]);
  return id;
}

// ── UPDATE: Approve / Reject ──────────────────────────────
function data_updateStatus(requestId, role, action) {
  var sheet = getOrCreateSheet_(SHEETS.REQUISITIONS, HEADERS.REQUISITIONS);
  var data  = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][DCOL.REQUEST_ID].toString() !== requestId.toString()) continue;
    var r = i + 1;
    var ns = "";
    if      (role === "Admin Officer") { ns = (action === "Rejected") ? "Rejected" : "Verified"; sheet.getRange(r, DCOL.ADMIN_STATUS+1).setValue(ns); }
    else if (role === "FAM")           { ns = (action === "Rejected") ? "Rejected" : "Cleared";  sheet.getRange(r, DCOL.FAM_STATUS+1).setValue(ns); }
    else if (role === "ED")            { ns = (action === "Rejected") ? "Rejected" : "Approved"; sheet.getRange(r, DCOL.ED_STATUS+1).setValue(ns); }
    else return null;
    return ns;
  }
  return null;
}

// ── READ: Full details + comments + docs ──────────────────
function data_getDetails(requestId) {
  var ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEETS.REQUISITIONS);
  var data  = sheet ? sheet.getDataRange().getValues() : [];
  var req   = null;

  for (var i = 1; i < data.length; i++) {
    if (data[i][DCOL.REQUEST_ID].toString() !== requestId.toString()) continue;
    var row = data[i];
    req = rowToObj_(row, row[DCOL.ADMIN_STATUS]||"Pending", row[DCOL.FAM_STATUS]||"Pending", row[DCOL.ED_STATUS]||"Pending");
    break;
  }
  if (!req) return null;

  var comments=[], documents=[];

  var cs = ss.getSheetByName(SHEETS.COMMENTS);
  if (cs) { var cd=cs.getDataRange().getValues(); for(var j=1;j<cd.length;j++){ if(cd[j][1].toString()===requestId.toString()) comments.push({timestamp:fmtDT_(cd[j][0]),email:""+cd[j][2],role:""+cd[j][3],text:""+cd[j][4]}); } }

  var ds = ss.getSheetByName(SHEETS.DOCUMENTS);
  if (ds) { var dd=ds.getDataRange().getValues(); for(var k=1;k<dd.length;k++){ if(dd[k][1].toString()===requestId.toString()) documents.push({timestamp:fmtDT_(dd[k][0]),email:""+dd[k][2],role:""+dd[k][3],fileName:""+dd[k][4],fileId:""+dd[k][5],fileUrl:""+dd[k][6]}); } }

  return { request:req, comments:comments, documents:documents };
}

// ── CREATE: Comment ───────────────────────────────────────
function data_addComment(requestId, email, role, text) {
  var sheet = getOrCreateSheet_(SHEETS.COMMENTS, HEADERS.COMMENTS);
  var now   = new Date();
  sheet.appendRow([now, requestId, email, role, text]);
  return { timestamp:fmtDT_(now), email:email, role:role, text:text };
}

// ── CREATE: Upload document ───────────────────────────────
function data_uploadDoc(requestId, email, role, fileName, base64Data, mimeType) {
  var folder  = getDriveFolder_(CONFIG.DOC_FOLDER_NAME);
  var sub     = getDriveFolder_(requestId, folder);
  var bytes   = Utilities.base64Decode(base64Data);
  var blob    = Utilities.newBlob(bytes, mimeType||"application/octet-stream", fileName);
  var file    = sub.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var fid = file.getId();
  var url = "https://drive.google.com/file/d/"+fid+"/view?usp=sharing";
  var now = new Date();

  var sheet = getOrCreateSheet_(SHEETS.DOCUMENTS, HEADERS.DOCUMENTS);
  sheet.appendRow([now, requestId, email, role, fileName, fid, url]);
  return { fileId:fid, fileUrl:url, fileName:fileName, timestamp:fmtDT_(now), email:email, role:role };
}

// ── CREATE: Audit log ─────────────────────────────────────
function data_audit(requestId, role, actor, status) {
  try {
    var sheet = getOrCreateSheet_(SHEETS.AUDIT, HEADERS.AUDIT);
    sheet.appendRow([new Date(), requestId, role, actor, status]);
  } catch(e) {}
}

// ── Private: row → object ─────────────────────────────────
function rowToObj_(row, adm, fam, ed) {
  return {
    requestId:""+row[DCOL.REQUEST_ID], dateRequest:fmt_(row[DCOL.DATE_REQUEST]),
    activityCode:""+row[DCOL.ACTIVITY_CODE], description:""+row[DCOL.DESCRIPTION],
    quantity:""+row[DCOL.QUANTITY], dateRequired:fmt_(row[DCOL.DATE_REQUIRED]),
    location:""+row[DCOL.LOCATION], account:""+row[DCOL.ACCOUNT],
    donor:""+row[DCOL.DONOR], department:""+row[DCOL.DEPARTMENT],
    budgetCode:""+row[DCOL.BUDGET_CODE], requestedBy:""+row[DCOL.REQUESTED_BY],
    adminStatus:adm, famStatus:fam, edStatus:ed
  };
}

function fmt_(v)    { if(!v) return ""; try{return Utilities.formatDate(new Date(v),Session.getScriptTimeZone(),"dd-MMM-yyyy");}catch(e){return v+"";} }
function fmtT_(v)   { if(!v) return ""; try{return Utilities.formatDate(new Date(v),Session.getScriptTimeZone(),"HH:mm");}catch(e){return "";} }
function fmtDT_(v)  { return fmt_(v)+" "+fmtT_(v); }
