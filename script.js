/**
 * script.js - UBF Logistics & Procurement System
 *
 * FIRST VISIT TOKEN SETUP:
 * On first load the system will prompt once for the GitHub token.
 * The token is saved to localStorage and never shown again.
 * Staff only need their email + password after that.
 */

/* ══════════════════════════════════
   STEP 1: Ensure token is set
   This runs before anything else.
   If no token is found, prompt once.
══════════════════════════════════ */
(function(){
  var TOKEN_KEY='ubf_gatekeeper_token';
  if(!localStorage.getItem(TOKEN_KEY)){
    var t=prompt('System Setup — Enter the Access Key provided by your administrator:');
    if(t&&t.trim().indexOf('ghp_')===0){
      localStorage.setItem(TOKEN_KEY,t.trim());
      location.reload();
    } else {
      alert('Invalid key. Please contact t.otieno@ugandabiodiversityfund.org');
    }
  }
}());

/* ══════════════════════════════════
   STEP 2: Main application
══════════════════════════════════ */
(function(){
'use strict';
if(!window.DataService){console.error('data.js must load before script.js');return;}
var DS=window.DataService;

/* ── Utilities ── */
function $id(id){return document.getElementById(id);}
function go(page){var d=location.pathname;location.href=d.substring(0,d.lastIndexOf('/')+1)+page;}
function showBanner(msg,type){
  var id=type==='error'?'global-error-banner':'global-success-banner';
  var el=$id(id);
  if(!el){alert(msg);return;}
  el.textContent=msg;el.style.display='block';
  if(type==='success')setTimeout(function(){el.style.display='none';},6000);
}
function hideBanners(){
  ['global-error-banner','global-success-banner'].forEach(function(id){
    var el=$id(id);if(el)el.style.display='none';
  });
}
function fv(id){var el=$id(id);return el&&el.value?el.value.trim():'';}
function formatDate(iso){
  if(!iso)return'—';
  try{return new Date(iso).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});}catch(_){return iso;}
}
function formatDT(iso){
  if(!iso)return'—';
  try{return new Date(iso).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});}catch(_){return iso;}
}
function esc(s){
  if(s===null||s===undefined)return'';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function stCls(st){
  var m={pending:'status-pending',prepared:'status-inreview',reviewed:'status-inreview',cleared:'status-inreview',approved:'status-approved',rejected:'status-rejected'};
  return m[(st||'').toLowerCase()]||'status-pending';
}
function ftLbl(t){
  var m={request:'Request',travel:'Travel Plan',accountability:'Accountability',evaluation:'Evaluation',lpo:'LPO',grn:'GRN',invoice:'Invoice'};
  return m[t]||t||'Request';
}
function enforceAuth(){if(!DS.isAuthenticated()){go('index.html');return false;}return true;}
function navbar(){
  try{
    var s=DS.getSession();if(!s)return;
    var n=$id('nav-user-name'),r=$id('nav-user-role');
    if(n)n.textContent=s.name||s.email;
    if(r){r.textContent=s.role;r.className='role-badge role-'+s.role.toLowerCase().replace(/\s+/g,'-');}
  }catch(_){}
}
function wireLogout(){
  var b=$id('btn-logout');
  if(b)b.addEventListener('click',function(){DS.clearSession();go('index.html');});
}

/* ── Modal ── */
function openModal(html){
  var o=$id('modal-overlay'),c=$id('modal-content');
  if(!o||!c)return;
  c.innerHTML=html;o.style.display='flex';document.body.style.overflow='hidden';
}
function closeModal(){
  var o=$id('modal-overlay');
  if(o)o.style.display='none';
  document.body.style.overflow='';
}
function wireModal(){
  var b=$id('btn-modal-close'),o=$id('modal-overlay');
  if(b)b.addEventListener('click',closeModal);
  if(o)o.addEventListener('click',function(e){if(e.target===o)closeModal();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeModal();});
}

/* ── Detail modal content ── */
function buildDetail(rec){
  var s=DS.getSession();
  function arow(lbl,step){
    var a=rec.approval&&rec.approval[step];
    var v=a&&a.byName?esc(a.byName)+' on '+formatDate(a.at)+(a.note?' — '+esc(a.note):''):'<em>Pending</em>';
    return'<tr><th>'+lbl+'</th><td>'+v+'</td></tr>';
  }
  var appr='<table class="detail-table">'+
    '<tr><th>Submitted by</th><td>'+esc(rec.submittedByName)+' on '+formatDate(rec.createdAt)+'</td></tr>'+
    arow('Prepared by (Admin Officer)','preparation')+
    arow('Reviewed by (Finance Officer / FAM)','review')+
    arow('Cleared by (FAM)','clearance')+
    arow('Approved by (ED)','approval')+
    '</table>';
  var dataHtml='<p class="text-muted">No data.</p>';
  if(rec.data&&typeof rec.data==='object'){
    var keys=Object.keys(rec.data).filter(function(k){return k!=='routes'&&k!=='expenses';});
    if(keys.length>0){
      dataHtml='<table class="detail-table">'+
        keys.map(function(k){return'<tr><th>'+esc(k)+'</th><td>'+esc(rec.data[k])+'</td></tr>';}).join('')+
        '</table>';
    }
  }
  var att=rec.attachments&&rec.attachments.length>0
    ?'<ul class="attachment-list">'+rec.attachments.map(function(a){
        return'<li><a href="'+esc(a.downloadUrl)+'" target="_blank">📎 '+esc(a.name)+'</a></li>';
      }).join('')+'</ul>'
    :'<p class="text-muted">No attachments.</p>';
  var hist=rec.history&&rec.history.length
    ?'<ol class="history-list">'+rec.history.map(function(h){
        return'<li><strong>'+esc(h.action)+'</strong> by '+esc(h.byName||h.by)+' on '+formatDT(h.at)+(h.note?' — '+esc(h.note):'')+'</li>';
      }).join('')+'</ol>'
    :'<p class="text-muted">No history.</p>';
  var canEdit=s&&rec.submittedBy===s.email&&(rec.status==='Pending'||rec.status==='Rejected');
  var editBtn=canEdit?'<a href="form.html?edit='+esc(rec.id)+'" class="btn btn-secondary btn-sm" style="margin-bottom:1rem;">✏️ Edit &amp; Resubmit</a><br/>':'';
  return '<h2 class="modal-title">'+esc(rec.id)+
    ' <span class="status-badge '+stCls(rec.status)+'">'+esc(rec.status)+'</span>'+
    ' <span style="font-size:0.72rem;background:var(--ubf-blue-light);color:var(--ubf-blue-darker);padding:0.1rem 0.45rem;border-radius:3px;">'+esc(ftLbl(rec.formType))+'</span></h2>'+
    editBtn+
    '<div class="modal-grid">'+
      '<div class="modal-section"><h3>Form Details</h3>'+dataHtml+'</div>'+
      '<div class="modal-section"><h3>Approval Chain</h3>'+appr+'</div>'+
    '</div>'+
    '<div class="modal-section"><h3>Attachments</h3>'+att+'</div>'+
    '<div class="modal-section"><h3>Comments</h3>'+buildComments(rec)+'</div>'+
    '<div class="modal-section"><h3>Audit History</h3>'+hist+'</div>';
}

/* ── Comments ── */
function buildComments(rec){
  var cs=rec.comments||[];
  var html=cs.length===0?'<p class="text-muted">No comments yet.</p>':
    cs.map(function(c){
      var reps=(c.replies||[]).map(function(r){
        return'<div class="comment-reply"><strong>'+esc(r.byName||r.by)+'</strong> <span class="text-muted">('+esc(r.byRole)+') '+formatDT(r.at)+'</span><p style="margin:0.2rem 0 0;">'+esc(r.text)+'</p></div>';
      }).join('');
      return'<div class="comment-item">'+
        '<div class="comment-header"><strong>'+esc(c.byName||c.by)+'</strong> <span class="text-muted">('+esc(c.byRole)+') '+formatDT(c.at)+'</span></div>'+
        '<p style="margin:0.3rem 0 0.5rem;">'+esc(c.text)+'</p>'+
        (reps?'<div style="margin-left:1rem;">'+reps+'</div>':'')+
        '<button class="btn-action btn-review btn-reply-toggle" data-cid="'+esc(c.id)+'" style="font-size:0.72rem;margin-top:0.35rem;">↩ Reply</button>'+
        '<div id="ra-'+esc(c.id)+'" style="display:none;margin-top:0.4rem;">'+
          '<textarea id="rt-'+esc(c.id)+'" rows="2" style="width:100%;padding:0.4rem;border:1px solid var(--gray-300);border-radius:4px;font-family:var(--font-body);font-size:0.85rem;" placeholder="Write a reply…"></textarea>'+
          '<button class="btn btn-primary btn-sm btn-do-reply" data-rid="'+esc(rec.id)+'" data-cid="'+esc(c.id)+'" style="margin-top:0.3rem;">Post Reply</button>'+
        '</div>'+
      '</div>';
    }).join('');
  html+='<div style="margin-top:1rem;padding-top:0.75rem;border-top:1px solid var(--gray-200);">'+
    '<textarea id="new-cmt" rows="3" style="width:100%;padding:0.5rem;border:1.5px solid var(--gray-300);border-radius:var(--radius-sm);font-family:var(--font-body);font-size:0.875rem;resize:vertical;" placeholder="Add a comment…"></textarea>'+
    '<button class="btn btn-primary btn-sm btn-do-comment" data-rid="'+esc(rec.id)+'" style="margin-top:0.4rem;">Post Comment</button>'+
  '</div>';
  return html;
}
function wireComments(){
  var o=$id('modal-overlay');if(!o)return;
  o.addEventListener('click',async function(e){
    var t=e.target;
    if(t.classList.contains('btn-reply-toggle')){
      var a=$id('ra-'+t.getAttribute('data-cid'));
      if(a)a.style.display=a.style.display==='none'?'block':'none';
      return;
    }
    if(t.classList.contains('btn-do-reply')){
      var rid=t.getAttribute('data-rid'),cid=t.getAttribute('data-cid');
      var txt=($id('rt-'+cid)||{}).value||'';
      if(!txt.trim()){alert('Please write a reply.');return;}
      t.disabled=true;t.textContent='Posting…';
      try{
        await DS.addReply(rid,cid,txt.trim());
        var rs=await DS.getAllRequisitions();
        var r=rs.find(function(x){return x.id===rid;});
        if(r)openModal(buildDetail(r));
      }catch(err){alert('Failed: '+err.message);t.disabled=false;t.textContent='Post Reply';}
      return;
    }
    if(t.classList.contains('btn-do-comment')){
      var rid=t.getAttribute('data-rid');
      var txt=($id('new-cmt')||{}).value||'';
      if(!txt.trim()){alert('Please write a comment.');return;}
      t.disabled=true;t.textContent='Posting…';
      try{
        await DS.addComment(rid,txt.trim());
        var rs=await DS.getAllRequisitions();
        var r=rs.find(function(x){return x.id===rid;});
        if(r)openModal(buildDetail(r));
      }catch(err){alert('Failed: '+err.message);t.disabled=false;t.textContent='Post Comment';}
    }
  });
}

/* ════════════════════════════════
   LOGIN PAGE
════════════════════════════════ */
function initLogin(){
  if(!$id('login-form'))return;
  if(DS.isAuthenticated()){go('dashboard.html');return;}

  var form=$id('login-form');
  var changePanel=$id('change-password-panel');
  var emailInput=$id('input-email');
  var passInput=$id('input-password');
  var errorEl=$id('login-error');
  var btnLogin=$id('btn-login');
  var pendingUser=null;

  function setErr(msg){
    if(errorEl){errorEl.textContent=msg;errorEl.style.display=msg?'block':'none';}
  }

  var tog=$id('btn-toggle-password');
  if(tog)tog.addEventListener('click',function(){
    passInput.type=passInput.type==='password'?'text':'password';
    tog.textContent=passInput.type==='password'?'👁':'🙈';
  });

  var fl=$id('forgot-password-link');
  if(fl)fl.addEventListener('click',function(){
    alert('Please contact the administrator:\nt.otieno@ugandabiodiversityfund.org');
  });

  form.addEventListener('submit',async function(e){
    e.preventDefault();
    setErr('');
    var email=emailInput?emailInput.value.trim().toLowerCase():'';
    var pass=passInput?passInput.value:'';
    if(!email){setErr('Please enter your UBF work email.');return;}
    if(!pass) {setErr('Please enter your password.');return;}
    if(btnLogin){btnLogin.disabled=true;btnLogin.textContent='Verifying…';}
    try{
      var result=await DS.authenticateUser(email,pass);
      var user=result.user;
      if(user.mustChangePassword||DS.isPasswordExpired(user.passwordExpiry)){
        pendingUser=user;
        form.style.display='none';
        changePanel.style.display='block';
        if(btnLogin){btnLogin.disabled=false;btnLogin.textContent='Log In';}
        return;
      }
      DS.saveSession(user);
      go('dashboard.html');
    }catch(err){
      setErr(err.message||'Login failed. Please try again.');
      if(btnLogin){btnLogin.disabled=false;btnLogin.textContent='Log In';}
    }
  });

  var btnCancel=$id('btn-cancel-change');
  if(btnCancel)btnCancel.addEventListener('click',function(){
    pendingUser=null;
    form.style.display='block';
    changePanel.style.display='none';
  });

  var btnSetPass=$id('btn-set-password');
  if(btnSetPass)btnSetPass.addEventListener('click',async function(){
    var np=($id('input-new-password')||{}).value||'';
    var cp=($id('input-confirm-password')||{}).value||'';
    if(np.length<8){alert('Password must be at least 8 characters.');return;}
    if(np!==cp){alert('Passwords do not match.');return;}
    btnSetPass.disabled=true;btnSetPass.textContent='Saving…';
    try{
      await DS.changePassword(pendingUser.email,np);
      var result=await DS.authenticateUser(pendingUser.email,np);
      DS.saveSession(result.user);
      go('dashboard.html');
    }catch(err){
      alert('Failed to set password: '+err.message);
      btnSetPass.disabled=false;btnSetPass.textContent='Set Password & Log In';
    }
  });
}

/* ════════════════════════════════
   DASHBOARD PAGE
════════════════════════════════ */
var _dashRecs=[];

function renderStats(s){
  var m={'stat-total':s.total||0,'stat-pending':s.pending||0,'stat-prepared':s.prepared||0,
    'stat-reviewed':s.reviewed||0,'stat-cleared':s.cleared||0,'stat-approved':s.approved||0,'stat-rejected':s.rejected||0};
  Object.keys(m).forEach(function(id){var el=$id(id);if(el)el.textContent=m[id];});
}

function buildActionBtns(rec,session){
  var html='';
  if(DS.canActionRequisition(session.role,rec.status)){
    var ns=DS.getNextStatus(session.role,rec.status);
    var al=DS.getActionLabel(session.role,rec.status);
    html+='<button class="btn-action btn-approve" data-id="'+esc(rec.id)+'" data-action="'+esc(ns)+'">'+esc(al)+'</button> '+
          '<button class="btn-action btn-reject"  data-id="'+esc(rec.id)+'" data-action="Rejected">Reject</button> ';
  }
  if(rec.submittedBy===session.email&&(rec.status==='Pending'||rec.status==='Rejected')){
    html+='<a href="form.html?edit='+esc(rec.id)+'" class="btn-action btn-review">✏️ Edit</a>';
  }
  return html||'<span class="text-muted">—</span>';
}

function buildDashRow(rec,session){
  var desc=(rec.data&&rec.data.description)||rec.id;
  return'<tr>'+
    '<td><a href="#" class="link-detail" data-id="'+esc(rec.id)+'">'+esc(rec.id)+'</a></td>'+
    '<td>'+esc(ftLbl(rec.formType))+'</td>'+
    '<td>'+esc(desc)+'</td>'+
    '<td>'+esc(rec.submittedByName||rec.submittedBy)+'</td>'+
    '<td>'+formatDate(rec.createdAt)+'</td>'+
    '<td><span class="status-badge '+stCls(rec.status)+'">'+esc(rec.status)+'</span></td>'+
    '<td>'+buildActionBtns(rec,session)+'</td>'+
  '</tr>';
}

function renderDashTable(recs){
  var tb=$id('dashboard-table-body'),em=$id('dashboard-empty');
  if(!tb)return;
  var s=DS.getSession();
  if(!recs||recs.length===0){tb.innerHTML='';if(em)em.style.display='block';return;}
  if(em)em.style.display='none';
  tb.innerHTML=recs.map(function(r){return buildDashRow(r,s);}).join('');
}

function filterDash(){
  var sv=($id('filter-status')||{}).value||'';
  var sq=(($id('filter-search')||{}).value||'').toLowerCase();
  renderDashTable(_dashRecs.filter(function(r){
    var d=(r.data&&r.data.description)||r.id||'';
    return(!sv||r.status===sv)&&
      (!sq||(r.id||'').toLowerCase().indexOf(sq)!==-1||d.toLowerCase().indexOf(sq)!==-1||(r.submittedByName||'').toLowerCase().indexOf(sq)!==-1);
  }));
}

async function initDash(){
  if(!$id('dashboard-container'))return;
  if(!enforceAuth())return;
  navbar();wireLogout();wireModal();wireComments();
  var ld=$id('dashboard-loading');if(ld)ld.style.display='block';
  try{
    var recs=await DS.getAllRequisitions();
    var stats=await DS.getDashboardStats();
    _dashRecs=Array.isArray(recs)?recs:[];
    renderStats(stats);
    renderDashTable(_dashRecs);
  }catch(err){
    showBanner(err.message||'Failed to load dashboard.','error');
  }finally{
    if(ld)ld.style.display='none';
  }
  var fs=$id('filter-status'),fq=$id('filter-search');
  if(fs)fs.addEventListener('change',filterDash);
  if(fq)fq.addEventListener('input',filterDash);
  var tb=$id('dashboard-table-body');
  if(tb)tb.addEventListener('click',async function(e){
    var t=e.target;
    if(t.classList.contains('link-detail')){
      e.preventDefault();
      var r=_dashRecs.find(function(x){return x.id===t.getAttribute('data-id');});
      if(r)openModal(buildDetail(r));
      return;
    }
    if(t.classList.contains('btn-action')&&t.getAttribute('data-action')){
      var id=t.getAttribute('data-id'),action=t.getAttribute('data-action'),note='';
      if(action==='Rejected'){note=prompt('Reason for rejection (optional):')||'';if(note===null)return;}
      t.disabled=true;t.textContent='Saving…';
      try{
        await DS.updateRequisitionStatus(id,action,note);
        showBanner('Updated to "'+action+'".','success');
        var updated=await DS.getAllRequisitions(),stats=await DS.getDashboardStats();
        _dashRecs=Array.isArray(updated)?updated:[];
        renderStats(stats);filterDash();
      }catch(err){showBanner(err.message||'Failed.','error');t.disabled=false;t.textContent=action;}
    }
  });
}

/* ════════════════════════════════
   GENERIC FORM HANDLER
════════════════════════════════ */
function setupForm(formId,btnId,loadId,formType,collectFn,validateFn){
  var form=$id(formId),btn=$id(btnId),spin=$id(loadId);
  if(!form)return;
  form.addEventListener('submit',async function(e){
    e.preventDefault();hideBanners();
    var data=collectFn(),err=validateFn(data);
    if(err){showBanner(err,'error');return;}
    if(btn){btn.disabled=true;btn.textContent='Submitting…';}
    if(spin)spin.style.display='block';
    try{
      var params=new URLSearchParams(location.search);
      var editId=params.has('edit')?params.get('edit'):null;
      var ai=document.querySelector('input[type="file"]'),files=ai?ai.files:null,rec;
      if(editId){
        rec=await DS.editRequisition(editId,data,files);
        showBanner('Updated and resubmitted: '+rec.id,'success');
      }else{
        rec=await DS.submitRequisition(data,files,formType);
        showBanner('Submitted: '+rec.id+'. Pending review by Susan Abonyo.','success');
      }
      form.reset();
      setTimeout(function(){go('dashboard.html');},3000);
    }catch(err){
      showBanner(err.message||'Submission failed. Please try again.','error');
    }finally{
      if(btn){btn.disabled=false;btn.textContent='Submit';}
      if(spin)spin.style.display='none';
    }
  });
}

/* ════════════════════════════════
   REQUEST FORM (form.html)
════════════════════════════════ */
async function initForm(){
  if(!$id('requisition-form'))return;
  if(!enforceAuth())return;
  navbar();wireLogout();
  var s=DS.getSession();
  var n=$id('form-submitter-name'),ti=$id('form-submitter-title');
  if(n)n.textContent=s.name;
  if(ti)ti.textContent=s.title;
  var params=new URLSearchParams(location.search);
  if(params.has('edit')){
    try{
      var db=await DS.readDatabase();
      var er=db.records.find(function(r){return r.id===params.get('edit');});
      if(er&&er.data){
        Object.keys(er.data).forEach(function(k){
          var el=document.querySelector('[name="'+k+'"]');
          if(el)el.value=er.data[k]||'';
        });
        var ph=document.querySelector('.page-header h1');
        if(ph)ph.textContent='Edit — '+params.get('edit');
        var b=$id('btn-submit-requisition');
        if(b)b.textContent='Save & Resubmit';
      }
    }catch(err){showBanner('Could not load for editing: '+err.message,'error');}
  }
  setupForm('requisition-form','btn-submit-requisition','form-loading','request',
    function(){
      return{
        activityCode:fv('form-activity-code'),description:fv('form-description'),
        specification:fv('form-specification'),quantity:fv('form-quantity'),
        dateRequired:fv('form-date-required'),locationOfWork:fv('form-location'),
        contractPeriod:fv('form-contract-period'),accountCode:fv('form-account-code'),
        accountName:fv('form-account-name'),donorCode:fv('form-donor-code'),
        donorName:fv('form-donor-name'),department:fv('form-department'),budgetCode:fv('form-budget-code')
      };
    },
    function(d){
      if(!d.description)  return'Please enter a description.';
      if(!d.specification)return'Please enter the specification.';
      if(!d.quantity||parseFloat(d.quantity)<=0)return'Please enter a valid quantity.';
      return'';
    }
  );
}

/* ════════════════════════════════
   TRAVEL PLAN (travel-plan.html)
════════════════════════════════ */
async function initTravel(){
  if(!$id('travel-form'))return;
  if(!enforceAuth())return;
  navbar();wireLogout();
  var s=DS.getSession();
  var tn=$id('t-traveller-name'),tp=$id('t-position');
  var sn=$id('travel-submitter-name'),st=$id('travel-submitter-title');
  if(tn)tn.value=s.name;if(tp)tp.value=s.title;
  if(sn)sn.textContent=s.name;if(st)st.textContent=s.title;
  var rd=$id('t-request-date');if(rd)rd.value=new Date().toISOString().split('T')[0];
  setupForm('travel-form','btn-submit-travel','travel-loading','travel',
    function(){
      var routes=[];
      document.querySelectorAll('#route-table-body tr').forEach(function(row){
        var re=row.querySelector('[data-col="route"]');
        if(re&&re.value.trim())routes.push({
          route:re.value.trim(),
          date:(row.querySelector('[data-col="date"]')||{}).value||'',
          perDiem:(row.querySelector('[data-col="perDiem"]')||{}).value||'',
          accommodation:(row.querySelector('[data-col="accommodation"]')||{}).value||'',
          sda:(row.querySelector('[data-col="sda"]')||{}).value||'',
          others:(row.querySelector('[data-col="others"]')||{}).value||'',
          total:(row.querySelector('[data-col="total"]')||{}).value||''
        });
      });
      return{
        description:'Travel Plan: '+fv('t-business-reason'),
        travellerName:fv('t-traveller-name'),position:fv('t-position'),
        requestDate:fv('t-request-date'),staffNumber:fv('t-staff-number'),
        departureDate:fv('t-departure-date'),returnDate:fv('t-return-date'),
        totalDays:fv('t-total-days'),businessNights:fv('t-business-nights'),
        businessReason:fv('t-business-reason'),grandTotal:fv('t-grand-total'),
        routes:JSON.stringify(routes)
      };
    },
    function(d){
      if(!d.departureDate) return'Please enter departure date.';
      if(!d.returnDate)    return'Please enter return date.';
      if(!d.businessReason)return'Please enter the business reason.';
      return'';
    }
  );
}

/* ════════════════════════════════
   ACCOUNTABILITY (accountability.html)
════════════════════════════════ */
async function initAcc(){
  if(!$id('accountability-form'))return;
  if(!enforceAuth())return;
  navbar();wireLogout();
  var s=DS.getSession();
  var sn=$id('acc-submitter-name'),st=$id('acc-submitter-title'),en=$id('acc-employee-name');
  if(sn)sn.textContent=s.name;if(st)st.textContent=s.title;if(en)en.value=s.name;
  var de=$id('acc-date');if(de)de.value=new Date().toISOString().split('T')[0];
  setupForm('accountability-form','btn-submit-accountability','acc-loading','accountability',
    function(){
      var expenses=[];
      document.querySelectorAll('#expenses-table-body tr').forEach(function(row){
        var desc=(row.querySelector('[data-col="explanation"]')||{}).value||'';
        if(desc.trim())expenses.push({
          accountCode:(row.querySelector('[data-col="accountCode"]')||{}).value||'',
          date:(row.querySelector('[data-col="date"]')||{}).value||'',
          explanation:desc.trim(),
          refNo:(row.querySelector('[data-col="refNo"]')||{}).value||'',
          budgeted:(row.querySelector('[data-col="budgeted"]')||{}).value||'',
          actual:(row.querySelector('[data-col="actual"]')||{}).value||'',
          balance:(row.querySelector('[data-col="balance"]')||{}).value||''
        });
      });
      return{
        description:'Accountability: '+fv('acc-purpose'),
        employeeName:fv('acc-employee-name'),date:fv('acc-date'),
        travelDates:fv('acc-travel-dates'),department:fv('acc-department'),
        purpose:fv('acc-purpose'),totalBudgeted:fv('acc-total-budgeted'),
        totalActual:fv('acc-total-actual'),advanceReceived:fv('acc-advance-received'),
        expenses:JSON.stringify(expenses)
      };
    },
    function(d){
      if(!d.travelDates)return'Please enter dates of travel/activity.';
      if(!d.purpose)    return'Please enter the purpose.';
      return'';
    }
  );
}

/* ════════════════════════════════
   HISTORY PAGE
════════════════════════════════ */
var _histRecs=[];

function buildHistRow(rec){
  var desc=(rec.data&&rec.data.description)||rec.id;
  return'<tr>'+
    '<td><a href="#" class="link-hist-detail" data-id="'+esc(rec.id)+'">'+esc(rec.id)+'</a></td>'+
    '<td>'+esc(ftLbl(rec.formType))+'</td>'+
    '<td>'+esc(desc)+'</td>'+
    '<td>'+esc(rec.submittedByName||rec.submittedBy)+'</td>'+
    '<td>'+formatDate(rec.createdAt)+'</td>'+
    '<td>'+formatDate(rec.updatedAt)+'</td>'+
    '<td><span class="status-badge '+stCls(rec.status)+'">'+esc(rec.status)+'</span></td>'+
  '</tr>';
}

function renderHistTable(recs){
  var tb=$id('history-table-body'),em=$id('history-empty');
  if(!tb)return;
  if(!recs||recs.length===0){tb.innerHTML='';if(em)em.style.display='block';return;}
  if(em)em.style.display='none';
  tb.innerHTML=recs.map(buildHistRow).join('');
}

function filterHist(){
  var sv=($id('history-filter-status')||{}).value||'';
  var sq=(($id('history-filter-search')||{}).value||'').toLowerCase();
  renderHistTable(_histRecs.filter(function(r){
    var d=(r.data&&r.data.description)||r.id||'';
    return(!sv||r.status===sv)&&
      (!sq||(r.id||'').toLowerCase().indexOf(sq)!==-1||d.toLowerCase().indexOf(sq)!==-1||(r.submittedByName||'').toLowerCase().indexOf(sq)!==-1);
  }));
}

async function initHist(){
  if(!$id('history-container'))return;
  if(!enforceAuth())return;
  navbar();wireLogout();wireModal();wireComments();
  var ld=$id('history-loading');if(ld)ld.style.display='block';
  try{
    var recs=await DS.getAllRequisitions();
    _histRecs=Array.isArray(recs)?recs:[];
    renderHistTable(_histRecs);
  }catch(err){
    showBanner(err.message||'Failed to load history.','error');
  }finally{
    if(ld)ld.style.display='none';
  }
  var fs=$id('history-filter-status'),fq=$id('history-filter-search');
  if(fs)fs.addEventListener('change',filterHist);
  if(fq)fq.addEventListener('input',filterHist);
  var tb=$id('history-table-body');
  if(tb)tb.addEventListener('click',function(e){
    if(e.target.classList.contains('link-hist-detail')){
      e.preventDefault();
      var r=_histRecs.find(function(x){return x.id===e.target.getAttribute('data-id');});
      if(r)openModal(buildDetail(r));
    }
  });
}

/* ════════════════════════════════
   ENTRY POINT
════════════════════════════════ */
document.addEventListener('DOMContentLoaded',function(){
  if($id('login-form'))          {initLogin(); return;}
  if($id('dashboard-container')) {initDash();  return;}
  if($id('requisition-form'))    {initForm();  return;}
  if($id('travel-form'))         {initTravel();return;}
  if($id('accountability-form')) {initAcc();   return;}
  if($id('history-container'))   {initHist();  return;}
  wireLogout();navbar();
});

}());
