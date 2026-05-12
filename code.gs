// ============================================================
//  UBF LOGISTICS & PROCUREMENT  –  Code.gs  (v4 – FINAL)
//  Fixes: logo hardcoded, action buttons in dev mode,
//         showAll dev flag, comments, document uploads
// ============================================================

var CONFIG = {
  SPREADSHEET_ID : "1K9A5CH0NjgSmB_Yl44k7QsYXk_ytBDbv95_7639HKmU",
  SHEET_NAME     : "Requisitions",
  COMMENTS_SHEET : "Comments",
  DOCUMENTS_SHEET: "Documents",
  DOC_FOLDER_NAME: "UBF Requisition Documents",
  // ── Role assignments ──────────────────────────────────
  // Admin Officer (verifies incoming requests)
  // FAM           (clears verified requests)
  // ED            (gives final approval)
  // Staff         (everyone else — submits requests)
  ROLES: {
    "s.abonyo@ugandabiodiversityfund.org"  : "Admin Officer",  // Susan Abonyo – Administration Officer
    "w.nabatanzi@ugandabiodiversityfund.org": "FAM",           // Winnie Nabatanzi – Finance & Administration
    "i.amani@ugandabiodiversityfund.org"   : "ED"              // Ivan Amanigaruhanga – Executive Director
  },

  // ── Staff who submit requests (no special role needed) ──
  // t.otieno@ugandabiodiversityfund.org   – Thomas Otieno, Office Assistant
  // o.atuhaire@ugandabiodiversityfund.org – Owen Atuhaire, Projects Officer
  // angelakemi77@gmail.com               – Kemi Angela, Programs Officer (Internship)
  // d.okullu@ugandabiodiversityfund.org  – David Okullu, M&E Officer
  // p.musiime@ugandabiodiversityfund.org – Posiano Musiime, Programs Officer

  // ── Developer access (can use the role-switcher panel) ──
  DEV_EMAILS: ["t.otieno@ugandabiodiversityfund.org"]
};

var COL = {
  REQUEST_ID:0, DATE_REQUEST:1, ACTIVITY_CODE:2, DESCRIPTION:3,
  QUANTITY:4, DATE_REQUIRED:5, LOCATION:6, ACCOUNT:7, DONOR:8,
  DEPARTMENT:9, BUDGET_CODE:10, REQUESTED_BY:11,
  ADMIN_STATUS:12, FAM_STATUS:13, ED_STATUS:14
};

function doGet(e) {
  return HtmlService.createTemplateFromFile("Index").evaluate()
    .setTitle("UBF Procurement Portal")
    .addMetaTag("viewport","width=device-width,initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function include(f){ return HtmlService.createHtmlOutputFromFile(f).getContent(); }

// ── Email detection (no UrlFetchApp – avoids hangs) ───────
function detectEmail_() {
  var e = "";
  try { e = Session.getActiveUser().getEmail(); } catch(x){}
  if (!e) { try { e = Session.getEffectiveUser().getEmail(); } catch(x){} }
  return (e||"").toLowerCase().trim();
}

// ── Role resolution ───────────────────────────────────────
function getUserRole(testRole) {
  var real  = detectEmail_();
  var isDev = CONFIG.DEV_EMAILS.indexOf(real) !== -1;
  if (isDev && testRole && testRole !== "") {
    var fakeEmail = real + " [preview]";
    for (var k in CONFIG.ROLES) { if (CONFIG.ROLES[k]===testRole){ fakeEmail=k; break; } }
    return { email:fakeEmail, role:testRole, isDev:true, realEmail:real };
  }
  return { email:real, role:CONFIG.ROLES[real]||"Staff", isDev:isDev, realEmail:real };
}

// ── Dashboard (showAll = dev bypass to see all rows) ──────
function getDashboardData(testRole, showAll) {
  try {
    var user  = getUserRole(testRole);
    var sheet = getOrCreate_(CONFIG.SHEET_NAME, ["Request ID","Date of Request","Activity Code","Description","Quantity","Date Required","Location","Account","Donor","Department","Budget Code","Requested By","Admin Status","FAM Status","ED Status"]);
    var data  = sheet.getDataRange().getValues();
    var rows  = [];
    var devAll = showAll && user.isDev;

    for (var i=1;i<data.length;i++) {
      var row=data[i]; if(!row[COL.REQUEST_ID]) continue;
      var adm=(row[COL.ADMIN_STATUS]||"Pending")+""; var fam=(row[COL.FAM_STATUS]||"Pending")+""; var ed=(row[COL.ED_STATUS]||"Pending")+"";
      var req=(row[COL.REQUESTED_BY]||"").toString().toLowerCase().trim();
      var show=false;
      if(devAll) show=true;
      else if(user.role==="Staff") show=(req===user.realEmail);
      else if(user.role==="Admin Officer") show=(adm==="Pending"||adm==="");
      else if(user.role==="FAM") show=(adm==="Verified")&&(fam==="Pending"||fam==="");
      else if(user.role==="ED") show=(fam==="Cleared")&&(ed==="Pending"||ed==="");
      if(show) rows.push({ requestId:""+row[COL.REQUEST_ID], dateRequest:fmt_(row[COL.DATE_REQUEST]), activityCode:""+row[COL.ACTIVITY_CODE], description:""+row[COL.DESCRIPTION], quantity:""+row[COL.QUANTITY], dateRequired:fmt_(row[COL.DATE_REQUIRED]), location:""+row[COL.LOCATION], account:""+row[COL.ACCOUNT], donor:""+row[COL.DONOR], department:""+row[COL.DEPARTMENT], budgetCode:""+row[COL.BUDGET_CODE], requestedBy:""+row[COL.REQUESTED_BY], adminStatus:adm, famStatus:fam, edStatus:ed });
    }
    return { user:user, rows:rows };
  } catch(e){ return { error:e.message }; }
}

// ── History ───────────────────────────────────────────────
function getMyHistory(testRole) {
  try {
    var user=getUserRole(testRole);
    var sheet=getOrCreate_(CONFIG.SHEET_NAME,[]);
    var data=sheet.getDataRange().getValues(); var rows=[];
    for(var i=1;i<data.length;i++){
      var row=data[i]; if(!row[COL.REQUEST_ID]) continue;
      if((row[COL.REQUESTED_BY]||"").toString().toLowerCase().trim()!==user.realEmail) continue;
      rows.push({ requestId:""+row[COL.REQUEST_ID], dateRequest:fmt_(row[COL.DATE_REQUEST]), description:""+row[COL.DESCRIPTION], quantity:""+row[COL.QUANTITY], dateRequired:fmt_(row[COL.DATE_REQUIRED]), department:""+row[COL.DEPARTMENT], adminStatus:(row[COL.ADMIN_STATUS]||"Pending")+"", famStatus:(row[COL.FAM_STATUS]||"Pending")+"", edStatus:(row[COL.ED_STATUS]||"Pending")+"" });
    }
    return { user:user, rows:rows };
  } catch(e){ return { error:e.message }; }
}

// ── Submit ────────────────────────────────────────────────
function submitRequest(fd) {
  try {
    var user=getUserRole(); var sheet=getOrCreate_(CONFIG.SHEET_NAME,[]);
    var now=new Date();
    var id="REQ-"+Utilities.formatDate(now,Session.getScriptTimeZone(),"yyyyMMdd")+"-"+Math.floor(1000+Math.random()*9000);
    sheet.appendRow([id,now,fd.activityCode||"",fd.description||"",fd.quantity||"",fd.dateRequired||"",fd.location||"",fd.account||"",fd.donor||"",fd.department||"",fd.budgetCode||"",user.realEmail,"Pending","Pending","Pending"]);
    return { success:true, requestId:id };
  } catch(e){ return { success:false, error:e.message }; }
}

// ── Approve / Reject ──────────────────────────────────────
function updateRequestStatus(requestId, action, testRole) {
  try {
    var user=getUserRole(testRole); var sheet=getOrCreate_(CONFIG.SHEET_NAME,[]); var data=sheet.getDataRange().getValues();
    for(var i=1;i<data.length;i++){
      if(data[i][COL.REQUEST_ID].toString()!==requestId.toString()) continue;
      var r=i+1, ns="";
      if(user.role==="Admin Officer"){ ns=(action==="Rejected")?"Rejected":"Verified"; sheet.getRange(r,COL.ADMIN_STATUS+1).setValue(ns); }
      else if(user.role==="FAM"){ ns=(action==="Rejected")?"Rejected":"Cleared"; sheet.getRange(r,COL.FAM_STATUS+1).setValue(ns); }
      else if(user.role==="ED"){ ns=(action==="Rejected")?"Rejected":"Approved"; sheet.getRange(r,COL.ED_STATUS+1).setValue(ns); }
      else return { success:false, error:"No permission: "+user.role };
      auditLog_(requestId,user.role,user.realEmail,ns);
      return { success:true, requestId:requestId, newStatus:ns };
    }
    return { success:false, error:"Not found: "+requestId };
  } catch(e){ return { success:false, error:e.message }; }
}

// ── Get request details + comments + documents ────────────
function getRequestDetails(requestId) {
  try {
    var ss=SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet=ss.getSheetByName(CONFIG.SHEET_NAME);
    var data=sheet?sheet.getDataRange().getValues():[];
    var request=null;
    for(var i=1;i<data.length;i++){
      if(data[i][COL.REQUEST_ID].toString()===requestId.toString()){
        var row=data[i];
        request={ requestId:""+row[COL.REQUEST_ID], dateRequest:fmt_(row[COL.DATE_REQUEST]), activityCode:""+row[COL.ACTIVITY_CODE], description:""+row[COL.DESCRIPTION], quantity:""+row[COL.QUANTITY], dateRequired:fmt_(row[COL.DATE_REQUIRED]), location:""+row[COL.LOCATION], account:""+row[COL.ACCOUNT], donor:""+row[COL.DONOR], department:""+row[COL.DEPARTMENT], budgetCode:""+row[COL.BUDGET_CODE], requestedBy:""+row[COL.REQUESTED_BY], adminStatus:(row[COL.ADMIN_STATUS]||"Pending")+"", famStatus:(row[COL.FAM_STATUS]||"Pending")+"", edStatus:(row[COL.ED_STATUS]||"Pending")+"" };
        break;
      }
    }
    if(!request) return { error:"Not found: "+requestId };
    var comments=[]; var cs=ss.getSheetByName(CONFIG.COMMENTS_SHEET);
    if(cs){ var cd=cs.getDataRange().getValues(); for(var j=1;j<cd.length;j++){ if(cd[j][1].toString()===requestId.toString()) comments.push({ timestamp:fmt_(cd[j][0])+" "+fmtT_(cd[j][0]), email:""+cd[j][2], role:""+cd[j][3], text:""+cd[j][4] }); } }
    var documents=[]; var ds=ss.getSheetByName(CONFIG.DOCUMENTS_SHEET);
    if(ds){ var dd=ds.getDataRange().getValues(); for(var k=1;k<dd.length;k++){ if(dd[k][1].toString()===requestId.toString()) documents.push({ timestamp:fmt_(dd[k][0])+" "+fmtT_(dd[k][0]), email:""+dd[k][2], role:""+dd[k][3], fileName:""+dd[k][4], fileId:""+dd[k][5], fileUrl:""+dd[k][6] }); } }
    return { request:request, comments:comments, documents:documents };
  } catch(e){ return { error:e.message }; }
}

// ── Add comment ───────────────────────────────────────────
function addComment(requestId, commentText, testRole) {
  try {
    var user=getUserRole(testRole);
    var sheet=getOrCreate_(CONFIG.COMMENTS_SHEET,["Timestamp","Request ID","Email","Role","Comment"]);
    sheet.appendRow([new Date(),requestId,user.realEmail,user.role,commentText]);
    return { success:true, timestamp:fmt_(new Date())+" "+fmtT_(new Date()), email:user.realEmail, role:user.role, text:commentText };
  } catch(e){ return { success:false, error:e.message }; }
}

// ── Upload document to Drive ──────────────────────────────
function uploadDocument(requestId, fileName, base64Data, mimeType, testRole) {
  try {
    var user=getUserRole(testRole);
    var folder=getFolder_(CONFIG.DOC_FOLDER_NAME);
    var sub=getFolder_(requestId,folder);
    var bytes=Utilities.base64Decode(base64Data);
    var blob=Utilities.newBlob(bytes,mimeType||"application/octet-stream",fileName);
    var file=sub.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
    var fileId=file.getId(); var fileUrl="https://drive.google.com/file/d/"+fileId+"/view?usp=sharing";
    var sheet=getOrCreate_(CONFIG.DOCUMENTS_SHEET,["Timestamp","Request ID","Email","Role","File Name","Drive File ID","Drive URL"]);
    sheet.appendRow([new Date(),requestId,user.realEmail,user.role,fileName,fileId,fileUrl]);
    return { success:true, fileId:fileId, fileUrl:fileUrl, fileName:fileName, timestamp:fmt_(new Date())+" "+fmtT_(new Date()), email:user.realEmail, role:user.role };
  } catch(e){ return { success:false, error:e.message }; }
}

// ── Helpers ───────────────────────────────────────────────
function getOrCreate_(name, headers) {
  var ss=SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var s=ss.getSheetByName(name);
  if(!s && headers && headers.length){ s=ss.insertSheet(name); s.appendRow(headers); s.getRange(1,1,1,headers.length).setFontWeight("bold"); }
  return s||ss.insertSheet(name);
}
function getFolder_(name, parent) {
  var iter=parent?parent.getFoldersByName(name):DriveApp.getFoldersByName(name);
  if(iter.hasNext()) return iter.next();
  return parent?parent.createFolder(name):DriveApp.createFolder(name);
}
function auditLog_(id,role,actor,status) {
  try{ var s=getOrCreate_("AuditLog",["Timestamp","Request ID","Role","Actor","New Status"]); s.appendRow([new Date(),id,role,actor,status]); }catch(x){}
}
function fmt_(v){ if(!v) return ""; try{ return Utilities.formatDate(new Date(v),Session.getScriptTimeZone(),"dd-MMM-yyyy"); }catch(x){ return v+""; } }
function fmtT_(v){ if(!v) return ""; try{ return Utilities.formatDate(new Date(v),Session.getScriptTimeZone(),"HH:mm"); }catch(x){ return ""; } }
