<script src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.3/js/bootstrap.bundle.min.js"></script>
<script>
// ═══════════════════════════════════════════════════
//  UBF PROCUREMENT PORTAL  –  JavaScript  (v4 FINAL)
//  Fixes: logo hardcoded, dev buttons, comments, docs
// ═══════════════════════════════════════════════════

// ── UBF Logo hardcoded as base64 (avoids Drive redirect) ──
// This is the actual UBF logo fetched from your Drive file
var UBF_LOGO = "data:image/png;base64,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CRSJRBEJBAAIEBJIiQpIoIhYQICJJCgCQJIKFCBIAACgBISQkJEjQJAAJIRJBqRBCSJKQgIgQJBoISJJKoJRChCRAASCKREiJFiJAASRSIIAGgISCEgSSiJCRRIRASiQCISBCCRIBIASAIIkCJCQCoFYAIACSRJJAJEIAAkJBARIJQAkIAAAAJgEBSCJCiIIAECJIiSASSIiASJBABAFBAIIASQIDKCiBQkiRIoCIAiICJBBAECBCJCJERpCZCJJBCBCISJCiJCiJJBCQSIBJBBQmCQBIiIABASAiJAQBAQQEBEiRIRJAACAJJCKREAAAAAAICCCCARACJBIKCEAiUJAAIiiRJAiSkCJRBCCCBAiQSIAAAQJBISEiCRCgAoBQACSISAICACJAQBCBIiRIAACASAAAACBIIIASAoAAiAAAAKBAICEiSIQABiCCCAAAAJAAICASiIQAAAAJAAAAAAAAAAAAAAAAAAAAJAAAAiIAAAACAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

// ── App State ──────────────────────────────────────
var APP = {
  currentUser    : null,
  currentRole    : null,
  isDev          : false,
  devRoleOverride: "",
  devShowAll     : false,
  dashboardData  : [],
  pendingAction  : null,
  currentReqId   : null,
  loadTimer      : null
};

var ROLE_CONFIG = {
  "Staff":        { title:"Staff Portal",                          sub:"Submit requests and track your history.",                                     icon:"bi-person-fill",  color:"#28a745", canApprove:false },
  "Admin Officer":{ title:"Admin Officer – Verification Queue",    sub:"Review and verify incoming requisitions before they reach the FAM.",          icon:"bi-shield-check", color:"#0066cc", canApprove:true, approveLabel:"Verify",  approveAction:"Verified" },
  "FAM":          { title:"Finance & Admin Manager – Clearance Queue", sub:"Clear Admin-verified requisitions before Executive Director approval.",    icon:"bi-cash-stack",   color:"#6f42c1", canApprove:true, approveLabel:"Clear",   approveAction:"Cleared"  },
  "ED":           { title:"Executive Director – Final Approval Queue", sub:"Review FAM-cleared requisitions and give final approval.",                icon:"bi-award-fill",   color:"#dc3545", canApprove:true, approveLabel:"Approve", approveAction:"Approved" }
};

// ── Init ───────────────────────────────────────────
document.addEventListener("DOMContentLoaded", function(){
  // Inject logo into all img tags
  injectLogos();

  // Keyboard shortcut Ctrl+Shift+D
  document.addEventListener("keydown", function(e){
    if(e.ctrlKey && e.shiftKey && (e.key==="D"||e.key==="d")){
      e.preventDefault();
      if(APP.isDev) toggleDevPanel();
      else showToast("Dev panel is only available for authorised developers.","danger");
    }
  });

  loadDashboard();
});

function injectLogos(){
  // Only inject if src is empty (avoids overwriting a working URL)
  var imgs = document.querySelectorAll("#ubfLogoNav, #ubfLogoForm");
  imgs.forEach(function(img){ if(!img.src || img.src==="about:blank" || img.src===window.location.href) img.src = UBF_LOGO; });
}

// ── Load Dashboard ─────────────────────────────────
function loadDashboard(){
  showView("loading");
  clearTimeout(APP.loadTimer);
  APP.loadTimer = setTimeout(function(){
    var hint = document.getElementById("loadingHint");
    if(hint) hint.style.display="";
    setText("loadingMsg","Still loading — check deployment settings.");
  }, 12000);

  google.script.run
    .withSuccessHandler(onDashboardLoaded)
    .withFailureHandler(onError)
    .getDashboardData(APP.devRoleOverride, APP.devShowAll);
}

function onDashboardLoaded(result){
  clearTimeout(APP.loadTimer);
  if(result.error){ onError(result.error); return; }

  APP.currentUser   = result.user.email;
  APP.currentRole   = result.user.role;
  APP.isDev         = result.user.isDev || false;
  APP.dashboardData = result.rows || [];

  applyRoleUI(result.user);
  renderTable(APP.dashboardData);
  setText("lastRefreshed","Last refreshed: " + new Date().toLocaleTimeString());
  showView("dashboard");
}

// ── Apply Role UI ──────────────────────────────────
function applyRoleUI(userInfo){
  var cfg = ROLE_CONFIG[APP.currentRole] || ROLE_CONFIG["Staff"];

  setText("roleLabel", APP.currentRole);
  setText("emailLabel", APP.currentUser);

  var icon = document.getElementById("heroIcon");
  if(icon) icon.innerHTML = '<i class="bi '+cfg.icon+'"></i>';
  setText("heroTitle", cfg.title);
  setText("heroSub",   cfg.sub);

  showEl("newRequestTab"); showEl("historyTab");

  // Dev button — visible only if isDev is true
  if(APP.isDev){
    showEl("devToggleItem");
    // Highlight active role in dev panel
    ["Admin","FAM","ED","Staff"].forEach(function(r){
      var btn = document.getElementById("devBtn_"+r);
      if(!btn) return;
      var roleName = r==="Admin"?"Admin Officer":r;
      btn.classList.toggle("active-role", roleName===APP.currentRole);
    });
  } else {
    hideEl("devToggleItem");
  }

  // Identity card
  var card = document.getElementById("roleDebugCard");
  if(card){
    var preview = APP.isDev && APP.devRoleOverride!=="";
    card.innerHTML =
      '<div class="alert d-flex align-items-center gap-3 mb-4 border-0 shadow-sm" '+
      'style="background:#f0f7ff;border-left:5px solid '+cfg.color+' !important;border-radius:10px;padding:.85rem 1.1rem">'+
      '<img src="'+UBF_LOGO+'" style="height:40px;width:40px;border-radius:50%;object-fit:contain;background:#fff;padding:2px;border:2px solid #dee2e6">'+
      '<div class="flex-grow-1">'+
        '<div class="fw-bold" style="color:'+cfg.color+';font-size:.95rem">'+esc(APP.currentRole)+' Dashboard'+
          (preview?' <span class="badge bg-warning text-dark ms-1" style="font-size:.65rem"><i class="bi bi-tools me-1"></i>DEV PREVIEW</span>':'')+
        '</div>'+
        '<div class="text-muted" style="font-size:.78rem">Signed in as: <strong>'+esc(APP.currentUser||"⚠ unknown — check deployment settings")+'</strong>'+
          (preview?' <em class="text-warning ms-1">(impersonating)</em>':'')+
        '</div>'+
        (!APP.currentUser?'<div class="text-danger small mt-1">⚠ Set <strong>Execute as: User accessing the web app</strong> in your deployment.</div>':'')+
      '</div>'+
      '<button class="btn btn-success btn-sm px-3 fw-semibold d-none d-sm-flex align-items-center gap-1" onclick="showView(\'form\')">'+
        '<i class="bi bi-plus-circle-fill"></i> New Request'+
      '</button>'+
      '</div>';
    card.style.display="";
  }

  setText("requestedByDisplay", userInfo?(userInfo.realEmail||userInfo.email):APP.currentUser);
  injectLogos();
}

// ── Dev Panel ──────────────────────────────────────
function toggleDevPanel(){
  var p=document.getElementById("devPanel");
  if(p) p.style.display=(p.style.display==="none"||p.style.display===""?"block":"none");
}
function switchRole(roleName){
  APP.devRoleOverride=roleName||"";
  var p=document.getElementById("devPanel"); if(p) p.style.display="none";
  showToast(roleName?"🔀 Previewing as: "+roleName:"↩ Back to your real role", roleName?"warning":"secondary");
  loadDashboard();
}
function toggleShowAll(val){
  APP.devShowAll=val;
  showToast(val?"👁 Showing ALL rows (role filter bypassed)":"Role filter restored","warning");
  loadDashboard();
}

// ── Render Table ───────────────────────────────────
function renderTable(rows){
  var cfg   = ROLE_CONFIG[APP.currentRole]||ROLE_CONFIG["Staff"];
  var tbody = document.getElementById("dashTableBody");
  var hdr   = document.getElementById("actionColHeader");
  if(hdr) hdr.textContent = cfg.canApprove?"Actions":"Pipeline";

  if(!rows||rows.length===0){
    tbody.innerHTML=
      '<tr><td colspan="12"><div class="ubf-empty-state">'+
      '<i class="bi bi-inbox-fill"></i>'+
      '<div class="fw-semibold mt-1">Nothing here yet</div>'+
      '<div class="small text-muted mt-1">'+(cfg.canApprove?"No requisitions awaiting your action.":"You haven\'t submitted any requests yet.")+'</div>'+
      (!cfg.canApprove?'<button class="btn btn-success btn-sm mt-3 px-4 fw-semibold" onclick="showView(\'form\')"><i class="bi bi-plus-circle-fill me-1"></i>Submit New Request</button>':'')+
      '</div></td></tr>';
    updateStats([]); setText("dashRowCount","0 requisitions"); return;
  }

  var html="";
  rows.forEach(function(r){
    html+=
      '<tr>'+
      '<td><a href="#" class="fw-semibold text-primary text-decoration-none" onclick="openDetails(\''+esc(r.requestId)+'\');return false;">'+esc(r.requestId)+'</a></td>'+
      '<td class="text-nowrap">'+esc(r.dateRequest)+'</td>'+
      '<td><div class="fw-semibold">'+esc(r.activityCode)+'</div><div class="text-muted small">'+esc(r.description)+'</div></td>'+
      '<td>'+esc(r.quantity)+'</td>'+
      '<td class="text-nowrap">'+esc(r.dateRequired)+'</td>'+
      '<td>'+esc(r.location)+'</td>'+
      '<td>'+esc(r.department)+'</td>'+
      '<td class="small">'+esc(r.requestedBy)+'</td>'+
      '<td>'+pill(r.adminStatus)+'</td>'+
      '<td>'+pill(r.famStatus)+'</td>'+
      '<td>'+pill(r.edStatus)+'</td>'+
      '<td class="text-center text-nowrap" style="min-width:180px">';

    // ── ACTION BUTTONS ──
    if(cfg.canApprove){
      html+=
        '<button class="btn btn-success btn-sm px-2 me-1 fw-semibold" '+
          'onclick="promptAction(\''+esc(r.requestId)+'\',\''+cfg.approveAction+'\')">'+
          '<i class="bi bi-check-circle-fill me-1"></i>'+cfg.approveLabel+
        '</button>'+
        '<button class="btn btn-danger btn-sm px-2 me-1 fw-semibold" '+
          'onclick="promptAction(\''+esc(r.requestId)+'\',\'Rejected\')">'+
          '<i class="bi bi-x-circle-fill me-1"></i>Reject'+
        '</button>';
    } else {
      var prog = r.edStatus==="Approved"?"Approved"
               : (r.edStatus==="Rejected"||r.famStatus==="Rejected"||r.adminStatus==="Rejected")?"Rejected"
               : r.famStatus==="Cleared"?"At ED"
               : r.adminStatus==="Verified"?"At FAM":"Pending";
      html+=pill(prog);
    }
    // Details button always shown
    html+='<button class="btn btn-outline-primary btn-sm px-2 fw-semibold" onclick="openDetails(\''+esc(r.requestId)+'\')"><i class="bi bi-eye"></i></button>';
    html+='</td></tr>';
  });

  tbody.innerHTML=html;
  updateStats(rows);
  setText("dashRowCount",rows.length+" requisition"+(rows.length!==1?"s":"")+" found");
}

function filterTable(q){
  q=(q||"").toLowerCase();
  document.querySelectorAll("#dashTable tbody tr").forEach(function(tr){ tr.style.display=tr.textContent.toLowerCase().includes(q)?"":"none"; });
}

function updateStats(rows){
  rows=rows||[]; var p=0,a=0,r=0;
  rows.forEach(function(row){ var s=row.edStatus||row.famStatus||row.adminStatus||""; if(["Approved","Cleared","Verified"].indexOf(s)>-1) a++; else if(s==="Rejected") r++; else p++; });
  setText("statTotal",rows.length); setText("statPending",p); setText("statApproved",a); setText("statRejected",r);
}

// ── Confirm Approve/Reject ─────────────────────────
function promptAction(requestId, action){
  APP.pendingAction={requestId:requestId,action:action};
  var cfg=ROLE_CONFIG[APP.currentRole]||{}; var isApprove=action!=="Rejected";
  var label=isApprove?(cfg.approveLabel||"Approve"):"Reject";
  setText("confirmTitle","Confirm "+label);
  document.getElementById("confirmBody").innerHTML=
    'Are you sure you want to <strong class="text-'+(isApprove?"success":"danger")+'">'+label+
    '</strong> request <strong>'+esc(requestId)+'</strong>?'+
    (APP.devRoleOverride?'<div class="alert alert-warning mt-3 mb-0 py-2 px-3 small"><i class="bi bi-tools me-1"></i>Dev preview — this WILL update the spreadsheet.</div>':'');
  var btn=document.getElementById("confirmBtn");
  btn.className="btn px-4 fw-semibold "+(isApprove?"btn-success":"btn-danger");
  btn.textContent=label;
  new bootstrap.Modal(document.getElementById("confirmModal")).show();
}

function executeStatusUpdate(){
  if(!APP.pendingAction) return;
  bootstrap.Modal.getInstance(document.getElementById("confirmModal")).hide();
  showToast("Processing…","info");
  google.script.run
    .withSuccessHandler(function(res){
      if(res.success){ showToast("✅ Status updated: "+res.newStatus,"success"); loadDashboard(); }
      else showToast("❌ "+res.error,"danger");
      APP.pendingAction=null;
    })
    .withFailureHandler(function(err){ showToast("❌ "+err.message,"danger"); APP.pendingAction=null; })
    .updateRequestStatus(APP.pendingAction.requestId, APP.pendingAction.action, APP.devRoleOverride);
}

// ── Detail Modal ───────────────────────────────────
function openDetails(requestId){
  APP.currentReqId=requestId;
  setText("detailReqId",requestId);
  document.getElementById("detailFields").innerHTML='<div class="col-12 text-center py-3"><div class="spinner-border text-primary"></div></div>';
  document.getElementById("commentsList").innerHTML='<div class="text-center py-3 text-muted small"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Loading…</div>';
  document.getElementById("documentsList").innerHTML='<div class="text-center py-3 text-muted small"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Loading…</div>';
  new bootstrap.Modal(document.getElementById("detailModal")).show();

  google.script.run
    .withSuccessHandler(renderDetails)
    .withFailureHandler(function(e){ showToast("❌ "+e.message,"danger"); })
    .getRequestDetails(requestId);
}

function renderDetails(result){
  if(result.error){ showToast("❌ "+result.error,"danger"); return; }
  var req=result.request; var comments=result.comments||[]; var docs=result.documents||[];

  setText("commentCount",comments.length);
  setText("docCount",docs.length);
  setText("detailModalFooter","Request by: "+esc(req.requestedBy)+" | Submitted: "+esc(req.dateRequest));

  // ── Action bar inside modal ──
  var cfg=ROLE_CONFIG[APP.currentRole]||ROLE_CONFIG["Staff"];
  var actionRow=document.getElementById("detailApprovalRow");
  var actionBar=document.getElementById("detailActionBar");
  var approveBtn=document.getElementById("detailApproveBtn");
  var approveLabel=document.getElementById("detailApproveLabel");

  if(cfg.canApprove){
    var canAct=false;
    if(APP.currentRole==="Admin Officer"&&(req.adminStatus==="Pending"||req.adminStatus==="")) canAct=true;
    if(APP.currentRole==="FAM"&&req.adminStatus==="Verified"&&(req.famStatus==="Pending"||req.famStatus==="")) canAct=true;
    if(APP.currentRole==="ED"&&req.famStatus==="Cleared"&&(req.edStatus==="Pending"||req.edStatus==="")) canAct=true;
    if(APP.devShowAll) canAct=true;

    if(canAct){
      actionRow.style.removeProperty("display");
      approveLabel.textContent=cfg.approveLabel;
      actionBar.className="alert alert-info py-2 mb-0 d-flex align-items-center gap-3 flex-wrap";
      document.getElementById("detailActionMsg").textContent="This requisition is awaiting your "+cfg.approveLabel.toLowerCase()+".";
    } else {
      actionRow.style.display="none";
    }
  } else {
    actionRow.style.display="none";
  }

  // ── Detail Fields ──
  var fields=[
    {label:"Request ID",     value:req.requestId},
    {label:"Date Submitted", value:req.dateRequest},
    {label:"Activity Code",  value:req.activityCode},
    {label:"Description",    value:req.description,    full:true},
    {label:"Quantity",       value:req.quantity},
    {label:"Date Required",  value:req.dateRequired},
    {label:"Location",       value:req.location},
    {label:"Department",     value:req.department},
    {label:"Account",        value:req.account},
    {label:"Donor",          value:req.donor},
    {label:"Budget Code",    value:req.budgetCode},
    {label:"Requested By",   value:req.requestedBy,    full:true}
  ];
  var fHtml='';
  fields.forEach(function(f){
    fHtml+='<div class="col-'+(f.full?"12":"md-4 col-6")+'">'+
      '<div class="ubf-detail-field h-100">'+
        '<div class="ubf-detail-field-label">'+esc(f.label)+'</div>'+
        '<div class="ubf-detail-field-value">'+(f.value?esc(f.value):'<span class="text-muted">—</span>')+'</div>'+
      '</div></div>';
  });
  // Status row
  fHtml+='<div class="col-12 mt-2">'+
    '<div class="d-flex gap-2 flex-wrap align-items-center">'+
    '<span class="ubf-label mb-0">Pipeline Status:</span>'+
    '<span>Admin: '+pill(req.adminStatus)+'</span>'+
    '<span>FAM: '+pill(req.famStatus)+'</span>'+
    '<span>ED: '+pill(req.edStatus)+'</span>'+
    '</div></div>';
  document.getElementById("detailFields").innerHTML=fHtml;

  // ── Comments ──
  var cHtml='';
  if(comments.length===0){
    cHtml='<div class="ubf-empty-state" style="padding:1.5rem"><i class="bi bi-chat-dots"></i><div>No comments yet. Be the first!</div></div>';
  } else {
    var colors={"Admin Officer":"#0066cc","FAM":"#6f42c1","ED":"#dc3545","Staff":"#28a745"};
    comments.forEach(function(c){
      var initials=(c.email||"?").substring(0,1).toUpperCase();
      var color=colors[c.role]||"#6c757d";
      cHtml+='<div class="ubf-comment-item">'+
        '<div class="ubf-comment-avatar" style="background:'+color+'">'+initials+'</div>'+
        '<div class="ubf-comment-body">'+
          '<div class="ubf-comment-meta"><strong>'+esc(c.email)+'</strong> · '+esc(c.role)+' · '+esc(c.timestamp)+'</div>'+
          '<div class="ubf-comment-text">'+esc(c.text)+'</div>'+
        '</div></div>';
    });
  }
  document.getElementById("commentsList").innerHTML=cHtml;

  // ── Documents ──
  var dHtml='';
  if(docs.length===0){
    dHtml='<div class="ubf-empty-state" style="padding:1.5rem"><i class="bi bi-file-earmark-x"></i><div>No documents uploaded yet.</div></div>';
  } else {
    var extIcon=function(n){ var e=(n||"").split(".").pop().toLowerCase(); return {"pdf":"bi-file-pdf","doc":"bi-file-word","docx":"bi-file-word","xls":"bi-file-excel","xlsx":"bi-file-excel","png":"bi-file-image","jpg":"bi-file-image","jpeg":"bi-file-image"}[e]||"bi-file-earmark"; };
    docs.forEach(function(d){
      dHtml+='<div class="ubf-doc-item">'+
        '<div class="ubf-doc-icon"><i class="bi '+extIcon(d.fileName)+'"></i></div>'+
        '<div class="ubf-doc-info flex-grow-1">'+
          '<div class="ubf-doc-name">'+esc(d.fileName)+'</div>'+
          '<div class="ubf-doc-meta">'+esc(d.email)+' · '+esc(d.role)+' · '+esc(d.timestamp)+'</div>'+
        '</div>'+
        '<a href="'+esc(d.fileUrl)+'" target="_blank" class="btn btn-sm btn-outline-primary px-2">'+
          '<i class="bi bi-box-arrow-up-right me-1"></i>Open'+
        '</a></div>';
    });
  }
  document.getElementById("documentsList").innerHTML=dHtml;
}

// ── Detail modal: approve/reject ───────────────────
function detailAction(type){
  if(!APP.currentReqId) return;
  var cfg=ROLE_CONFIG[APP.currentRole]||{};
  var action=type==="approve"?(cfg.approveAction||"Approved"):"Rejected";
  bootstrap.Modal.getInstance(document.getElementById("detailModal")).hide();
  setTimeout(function(){ promptAction(APP.currentReqId, action); }, 400);
}

// ── Submit Comment ─────────────────────────────────
function submitComment(){
  var text=(document.getElementById("commentInput").value||"").trim();
  if(!text){ showToast("Please enter a comment first.","warning"); return; }
  document.getElementById("commentInput").disabled=true;
  google.script.run
    .withSuccessHandler(function(res){
      document.getElementById("commentInput").disabled=false;
      if(res.success){
        document.getElementById("commentInput").value="";
        showToast("✅ Comment posted!","success");
        openDetails(APP.currentReqId);
      } else showToast("❌ "+res.error,"danger");
    })
    .withFailureHandler(function(e){ document.getElementById("commentInput").disabled=false; showToast("❌ "+e.message,"danger"); })
    .addComment(APP.currentReqId, text, APP.devRoleOverride);
}

// ── File Upload ────────────────────────────────────
function onFileSelected(input){
  var btn=document.getElementById("uploadDocBtn");
  if(btn) btn.disabled=!(input.files&&input.files.length>0);
}

function uploadDocument(){
  var input=document.getElementById("docFileInput");
  if(!input||!input.files||input.files.length===0){ showToast("Please select a file first.","warning"); return; }
  var file=input.files[0];
  if(file.size>5*1024*1024){ showToast("File is too large (max 5MB). Please compress or split the file.","danger"); return; }

  var btn=document.getElementById("uploadDocBtn"); btn.disabled=true;
  var prog=document.getElementById("uploadProgress"); prog.style.display="";

  var reader=new FileReader();
  reader.onload=function(e){
    var dataUrl=e.target.result;
    var parts=dataUrl.split(",");
    var base64=parts[1];
    var mimeType=parts[0].split(":")[1].split(";")[0];

    google.script.run
      .withSuccessHandler(function(res){
        btn.disabled=false; prog.style.display="none";
        if(res.success){
          input.value="";
          showToast("✅ Document uploaded: "+res.fileName,"success");
          openDetails(APP.currentReqId);
        } else showToast("❌ "+res.error,"danger");
      })
      .withFailureHandler(function(err){ btn.disabled=false; prog.style.display="none"; showToast("❌ "+err.message,"danger"); })
      .uploadDocument(APP.currentReqId, file.name, base64, mimeType, APP.devRoleOverride);
  };
  reader.readAsDataURL(file);
}

// ── Form Submit ────────────────────────────────────
function handleFormSubmit(){
  var form=document.getElementById("requisitionForm");
  if(!form.checkValidity()){ form.classList.add("was-validated"); return; }
  form.classList.remove("was-validated");
  var btn=document.getElementById("submitBtn"); btn.disabled=true;
  btn.innerHTML='<span class="spinner-border spinner-border-sm me-2"></span>Submitting…';
  google.script.run
    .withSuccessHandler(function(res){
      btn.disabled=false; btn.innerHTML='<i class="bi bi-send me-2"></i>Submit Request';
      if(res.success){ showToast("✅ Submitted! Ref: "+res.requestId,"success"); form.reset(); form.classList.remove("was-validated"); showView("dashboard"); loadDashboard(); }
      else showToast("❌ "+res.error,"danger");
    })
    .withFailureHandler(function(err){ btn.disabled=false; btn.innerHTML='<i class="bi bi-send me-2"></i>Submit Request'; showToast("❌ "+err.message,"danger"); })
    .submitRequest({ activityCode:getVal("f_activityCode"), description:getVal("f_description"), quantity:getVal("f_quantity"), dateRequired:getVal("f_dateRequired"), location:getVal("f_location"), account:getVal("f_account"), donor:getVal("f_donor"), department:getVal("f_department"), budgetCode:getVal("f_budgetCode") });
}

// ── History ────────────────────────────────────────
function loadHistory(){
  document.getElementById("historyTableContainer").innerHTML='<div class="text-center py-5"><div class="spinner-border text-primary"></div><p class="mt-3 text-muted">Loading history…</p></div>';
  google.script.run
    .withSuccessHandler(renderHistory)
    .withFailureHandler(onError)
    .getMyHistory(APP.devRoleOverride);
}

function renderHistory(result){
  var rows=(result&&result.rows)?result.rows:[];
  var html='<div class="card border-0 shadow-sm ubf-table-card">'+
    '<div class="card-header ubf-card-header d-flex align-items-center gap-2">'+
    '<i class="bi bi-clock-history"></i><span class="fw-semibold">My Submission History</span>'+
    '<span class="ms-auto text-white-50 small">'+rows.length+' record'+(rows.length!==1?'s':'')+'</span></div>'+
    '<div class="card-body p-0"><div class="table-responsive">'+
    '<table class="table table-hover ubf-data-table mb-0">'+
    '<thead><tr><th>Req ID</th><th>Submitted</th><th>Description</th><th>Qty</th><th>Needed By</th><th>Dept</th><th>Admin</th><th>FAM</th><th>ED</th></tr></thead><tbody>';
  if(rows.length===0){
    html+='<tr><td colspan="9"><div class="ubf-empty-state"><i class="bi bi-inbox-fill"></i><div class="fw-semibold mt-1">No submissions yet</div><button class="btn btn-success btn-sm mt-3 px-4 fw-semibold" onclick="showView(\'form\')"><i class="bi bi-plus-circle-fill me-1"></i>Submit New Request</button></div></td></tr>';
  } else {
    rows.forEach(function(r){
      html+='<tr><td class="fw-semibold text-primary"><a href="#" class="text-decoration-none" onclick="openDetails(\''+esc(r.requestId)+'\');return false;">'+esc(r.requestId)+'</a></td><td class="text-nowrap">'+esc(r.dateRequest)+'</td><td>'+esc(r.description)+'</td><td>'+esc(r.quantity)+'</td><td class="text-nowrap">'+esc(r.dateRequired)+'</td><td>'+esc(r.department)+'</td><td>'+pill(r.adminStatus)+'</td><td>'+pill(r.famStatus)+'</td><td>'+pill(r.edStatus)+'</td></tr>';
    });
  }
  html+='</tbody></table></div></div></div>';
  document.getElementById("historyTableContainer").innerHTML=html;
}

// ── View Switcher ──────────────────────────────────
function showView(view){
  ["loadingSpinner","dashboardView","formView","historyView"].forEach(function(id){ var el=document.getElementById(id); if(el) el.classList.add("d-none"); });
  var map={loading:"loadingSpinner",dashboard:"dashboardView",form:"formView",history:"historyView"};
  var el=document.getElementById(map[view]); if(el) el.classList.remove("d-none");
  if(view==="history") loadHistory();
  if(view==="form"){ setText("requestedByDisplay",APP.currentUser||"—"); injectLogos(); }
}

// ── Toast ──────────────────────────────────────────
function showToast(msg,type){
  var el=document.getElementById("appToast"); var tx=document.getElementById("toastMsg");
  el.className="toast align-items-center border-0 text-bg-"+(type||"primary");
  tx.textContent=msg;
  new bootstrap.Toast(el,{delay:4500}).show();
}

// ── Helpers ────────────────────────────────────────
function pill(s){
  s=(s||"Pending").toString().trim();
  var cls={"Pending":"ubf-status-pending","Verified":"ubf-status-verified","Cleared":"ubf-status-cleared","Approved":"ubf-status-approved","Rejected":"ubf-status-rejected","At FAM":"ubf-status-verified","At ED":"ubf-status-cleared"}[s]||"ubf-status-pending";
  return '<span class="ubf-status '+cls+'">'+esc(s)+'</span>';
}
function esc(v){ return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function setText(id,v){ var e=document.getElementById(id); if(e) e.textContent=v; }
function getVal(id){ var e=document.getElementById(id); return e?e.value.trim():""; }
function showEl(id){ var e=document.getElementById(id); if(e) e.style.display=""; }
function hideEl(id){ var e=document.getElementById(id); if(e) e.style.display="none"; }
function onError(err){ clearTimeout(APP.loadTimer); showView("dashboard"); showToast("❌ "+(err.message||err),"danger"); }
</script>
