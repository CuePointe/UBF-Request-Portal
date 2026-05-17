/**
 * script.js — UBF Logistics & Procurement System — FINAL VERSION
 * Handles: Login, Dashboard, Request, Travel, Accountability,
 *          Evaluation, LPO, GRN, Invoice, History
 * Share Panel: Copy, Attach, Edit, Forward, Print
 */

/* ══ STEP 1: Token setup — runs before everything ══ */
(function(){
  var K='ubf_gatekeeper_token';
  if(!localStorage.getItem(K)){
    var t=prompt('System Setup — Enter the Access Key provided by your administrator:');
    if(t&&t.trim().indexOf('ghp_')===0){
      localStorage.setItem(K,t.trim());
      location.reload();
    } else if(t!==null){
      alert('Invalid key. Please contact t.otieno@ugandabiodiversityfund.org');
    }
  }
}());

/* ══ STEP 2: Main application ══ */
(function(){
'use strict';
if(!window.DataService){console.error('data.js must load before script.js');return;}
var DS=window.DataService;

/* ─── Utilities ─── */
function $id(id){return document.getElementById(id);}
function go(page){var d=location.pathname;location.href=d.substring(0,d.lastIndexOf('/')+1)+page;}
function showBanner(msg,type){
  var id=type==='error'?'global-error-banner':'global-success-banner';
  var el=$id(id);
  if(!el){alert(msg);return;}
  el.textContent=msg;el.style.display='block';
  if(type==='success')setTimeout(function(){el.style.display='none';},7000);
}
function hideBanners(){
  ['global-error-banner','global-success-banner'].forEach(function(id){
    var el=$id(id);if(el)el.style.display='none';
  });
}
function fv(id){var el=$id(id);return el&&el.value?el.value.trim():'';}
function formatDate(iso){
  if(!iso)return'—';
  try{return new Date(iso).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});}
  catch(_){return iso;}
}
function formatDT(iso){
  if(!iso)return'—';
  try{return new Date(iso).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});}
  catch(_){return iso;}
}
function esc(s){
  if(s===null||s===undefined)return'';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function stCls(st){
  var m={pending:'status-pending',prepared:'status-inreview',reviewed:'status-inreview',
         cleared:'status-inreview',approved:'status-approved',rejected:'status-rejected'};
  return m[(st||'').toLowerCase()]||'status-pending';
}
function ftLbl(t){
  var m={request:'Request for Goods/Services',travel:'Travel Business Plan',
    accountability:'Accountability',evaluation:'Evaluation Report',
    lpo:'Local Purchase Order',grn:'Goods Received Note',invoice:'Payment Voucher'};
  return m[t]||t||'Request';
}
function enforceAuth(){
  if(!DS.isAuthenticated()){go('index.html');return false;}
  return true;
}
function navbar(){
  try{
    var s=DS.getSession();if(!s)return;
    var n=$id('nav-user-name'),r=$id('nav-user-role');
    if(n)n.textContent=s.name||s.email;
    if(r){r.textContent=s.role;r.className='role-badge role-'+s.role.toLowerCase().replace(/\s+/g,'-');}
    /* Show management links on dashboard */
    var ml=$id('mgmt-links');
    var elevated=['Admin Officer','Finance Officer','FAM','ED'];
    if(ml&&elevated.indexOf(s.role)!==-1)ml.style.display='flex';
  }catch(_){}
}
function wireLogout(){
  var b=$id('btn-logout');
  if(b)b.addEventListener('click',function(){DS.clearSession();go('index.html');});
}

/* ─── Modal ─── */
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

/* ─── Share Panel HTML ─── */
function buildSharePanel(rec){
  var session=DS.getSession();
  var canEdit=session&&rec.submittedBy===session.email&&
    (rec.status==='Pending'||rec.status==='Rejected');
  var canAction=session&&DS.canActionRequisition(session.role,rec.status);
  var nextStatus=canAction?DS.getNextStatus(session.role,rec.status):'';
  var actionLabel=canAction?DS.getActionLabel(session.role,rec.status):'';

  return '<div class="share-panel">'+
    '<div style="font-size:0.78rem;font-weight:700;text-transform:uppercase;color:var(--ubf-blue-darker);margin-bottom:0.6rem;">🔗 Share &amp; Actions</div>'+
    '<div class="share-actions">'+
      '<button class="btn btn-secondary btn-sm btn-copy-summary" data-id="'+esc(rec.id)+'">📋 Copy Summary</button>'+
      '<button class="btn btn-secondary btn-sm btn-copy-ref" data-id="'+esc(rec.id)+'">🔗 Copy Ref No</button>'+
      '<button class="btn btn-secondary btn-sm btn-show-attach" data-id="'+esc(rec.id)+'">📎 Attach File</button>'+
      (canEdit?'<a href="form.html?edit='+esc(rec.id)+'" class="btn btn-secondary btn-sm">✏️ Edit &amp; Resubmit</a>':'')+
      (canAction?'<button class="btn btn-secondary btn-sm btn-show-forward" data-id="'+esc(rec.id)+'">⬆️ Forward with Note</button>':'')+
      '<button class="btn btn-secondary btn-sm" onclick="window.print()">🖨️ Print</button>'+
    '</div>'+

    /* Attach sub-panel */
    '<div class="share-sub" id="attach-sub-'+esc(rec.id)+'">'+
      '<div style="font-size:0.82rem;font-weight:600;margin-bottom:0.4rem;">Attach additional document(s) to this record:</div>'+
      '<input type="file" id="attach-file-'+esc(rec.id)+'" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"/>'+
      '<button class="btn btn-primary btn-sm btn-do-attach" data-id="'+esc(rec.id)+'" style="margin-top:0.5rem;">Upload &amp; Attach</button>'+
      '<div id="attach-status-'+esc(rec.id)+'" style="font-size:0.78rem;margin-top:0.35rem;"></div>'+
    '</div>'+

    /* Forward sub-panel */
    (canAction?
      '<div class="share-sub" id="forward-sub-'+esc(rec.id)+'">'+
        '<div style="font-size:0.82rem;font-weight:600;margin-bottom:0.4rem;">Add a note before forwarding to next stage ('+esc(nextStatus)+'):</div>'+
        '<textarea id="forward-note-'+esc(rec.id)+'" rows="3" placeholder="Optional note for the next reviewer…"></textarea>'+
        '<div style="display:flex;gap:0.5rem;margin-top:0.5rem;">'+
          '<button class="btn btn-primary btn-sm btn-do-forward" data-id="'+esc(rec.id)+'" data-action="'+esc(nextStatus)+'">'+esc(actionLabel)+' &amp; Forward</button>'+
          '<button class="btn btn-secondary btn-sm btn-do-reject" data-id="'+esc(rec.id)+'" data-action="Rejected">Reject</button>'+
        '</div>'+
      '</div>'
    :'')+
  '</div>';
}

/* ─── Detail Modal ─── */
function buildDetail(rec){
  var session=DS.getSession();

  function arow(lbl,step){
    var a=rec.approval&&rec.approval[step];
    var v=a&&a.byName?esc(a.byName)+' on '+formatDate(a.at)+(a.note?' — '+esc(a.note):''):'<em style="color:var(--gray-500)">Pending</em>';
    return'<tr><th>'+lbl+'</th><td>'+v+'</td></tr>';
  }

  var appr='<table class="detail-table">'+
    '<tr><th>Submitted by</th><td>'+esc(rec.submittedByName)+' ('+esc(rec.submittedByTitle)+') on '+formatDate(rec.createdAt)+'</td></tr>'+
    arow('Prepared by (Admin Officer)','preparation')+
    arow('Reviewed by (Finance Officer / FAM)','review')+
    arow('Cleared by (FAM)','clearance')+
    arow('Approved by (ED)','approval')+
    '</table>';

  var dataHtml='<p class="text-muted">No form data.</p>';
  if(rec.data&&typeof rec.data==='object'){
    var keys=Object.keys(rec.data).filter(function(k){return k!=='routes'&&k!=='expenses'&&rec.data[k];});
    if(keys.length>0){
      dataHtml='<table class="detail-table">'+
        keys.map(function(k){return'<tr><th>'+esc(k)+'</th><td>'+esc(rec.data[k])+'</td></tr>';}).join('')+
        '</table>';
    }
  }

  var att=rec.attachments&&rec.attachments.length>0
    ?'<ul class="attachment-list">'+rec.attachments.map(function(a){
        return'<li>'+
          '<a href="'+esc(a.downloadUrl)+'" target="_blank" rel="noopener">📎 '+esc(a.name)+'</a>'+
          ' <a href="'+esc(a.downloadUrl)+'" download class="btn btn-secondary btn-sm" style="font-size:0.7rem;padding:0.1rem 0.4rem;margin-left:0.4rem;">⬇ Download</a>'+
        '</li>';
      }).join('')+'</ul>'
    :'<p class="text-muted">No attachments.</p>';

  var hist=rec.history&&rec.history.length
    ?'<ol class="history-list">'+rec.history.map(function(h){
        return'<li><strong>'+esc(h.action)+'</strong> by '+esc(h.byName||h.by)+' on '+formatDT(h.at)+(h.note?' — '+esc(h.note):'')+'</li>';
      }).join('')+'</ol>'
    :'<p class="text-muted">No history.</p>';

  return '<h2 class="modal-title">'+esc(rec.id)+
    ' <span class="status-badge '+stCls(rec.status)+'">'+esc(rec.status)+'</span>'+
    ' <span style="font-size:0.72rem;background:var(--ubf-blue-light);color:var(--ubf-blue-darker);padding:0.1rem 0.45rem;border-radius:3px;">'+esc(ftLbl(rec.formType))+'</span></h2>'+

    '<div class="modal-grid">'+
      '<div class="modal-section"><h3>Form Details</h3>'+dataHtml+'</div>'+
      '<div class="modal-section"><h3>Approval Chain</h3>'+appr+'</div>'+
    '</div>'+

    '<div class="modal-section"><h3>Attachments</h3>'+att+'</div>'+

    /* Share Panel */
    '<div class="modal-section">'+buildSharePanel(rec)+'</div>'+

    '<div class="modal-section"><h3>Comments</h3>'+buildComments(rec)+'</div>'+
    '<div class="modal-section"><h3>Audit History</h3>'+hist+'</div>';
}

/* ─── Comments ─── */
function buildComments(rec){
  var cs=rec.comments||[];
  var html=cs.length===0?'<p class="text-muted">No comments yet.</p>':
    cs.map(function(c){
      var reps=(c.replies||[]).map(function(r){
        return'<div class="comment-reply">'+
          '<strong>'+esc(r.byName||r.by)+'</strong> <span class="text-muted">('+esc(r.byRole)+') '+formatDT(r.at)+'</span>'+
          '<p style="margin:0.2rem 0 0;">'+esc(r.text)+'</p></div>';
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
  html+=
    '<div style="margin-top:1rem;padding-top:0.75rem;border-top:1px solid var(--gray-200);">'+
    '<textarea id="new-cmt" rows="3" style="width:100%;padding:0.5rem;border:1.5px solid var(--gray-300);border-radius:var(--radius-sm);font-family:var(--font-body);font-size:0.875rem;resize:vertical;" placeholder="Add a comment…"></textarea>'+
    '<button class="btn btn-primary btn-sm btn-do-comment" data-rid="'+esc(rec.id)+'" style="margin-top:0.4rem;">Post Comment</button>'+
    '</div>';
  return html;
}

/* ─── Modal event delegation (share + comments) ─── */
var _currentRecords=[];

function wireModalEvents(){
  var o=$id('modal-overlay');if(!o)return;
  o.addEventListener('click',async function(e){
    var t=e.target;

    /* ── Share Panel ── */
    /* Copy summary */
    if(t.classList.contains('btn-copy-summary')){
      var id=t.getAttribute('data-id');
      var rec=_currentRecords.find(function(r){return r.id===id;});
      if(rec){
        var d=rec.data||{};
        var text='UBF Requisition: '+rec.id+'\n'+
          'Type: '+ftLbl(rec.formType)+'\n'+
          'Description: '+(d.description||'—')+'\n'+
          'Submitted by: '+rec.submittedByName+' on '+formatDate(rec.createdAt)+'\n'+
          'Status: '+rec.status+'\n'+
          'Ref: '+location.href.split('/').slice(0,-1).join('/')+'/history.html';
        navigator.clipboard?navigator.clipboard.writeText(text).then(function(){alert('Summary copied to clipboard!');})
          :prompt('Copy this summary:',text);
      }
      return;
    }

    /* Copy ref no */
    if(t.classList.contains('btn-copy-ref')){
      var id=t.getAttribute('data-id');
      navigator.clipboard?navigator.clipboard.writeText(id).then(function(){alert('Ref No "'+id+'" copied!');})
        :prompt('Copy ref no:',id);
      return;
    }

    /* Show attach panel */
    if(t.classList.contains('btn-show-attach')){
      var id=t.getAttribute('data-id');
      var panel=$id('attach-sub-'+id);
      if(panel)panel.style.display=panel.style.display==='none'||!panel.style.display?'block':'none';
      return;
    }

    /* Do attach */
    if(t.classList.contains('btn-do-attach')){
      var id=t.getAttribute('data-id');
      var fi=$id('attach-file-'+id);
      var status=$id('attach-status-'+id);
      if(!fi||!fi.files.length){alert('Please select at least one file.');return;}
      t.disabled=true;t.textContent='Uploading…';
      if(status)status.textContent='Uploading…';
      try{
        /* Read current record */
        var db=await DS.readDatabase();
        var idx=db.records.findIndex(function(r){return r.id===id;});
        if(idx===-1){alert('Record not found.');return;}
        /* Upload files */
        var uploaded=await DS.uploadAllAttachments(Array.from(fi.files));
        db.records[idx].attachments=(db.records[idx].attachments||[]).concat(uploaded);
        db.records[idx].updatedAt=new Date().toISOString();
        db.records[idx].history.push({
          action:'Attachment Added',by:DS.getSession().email,
          byName:DS.getSession().name,byTitle:DS.getSession().title,
          at:new Date().toISOString(),note:uploaded.length+' file(s) attached'
        });
        await DS.writeDatabase(db.records,db.sha,'Attachment added to '+id);
        if(status)status.textContent='✅ '+uploaded.length+' file(s) attached successfully!';
        /* Refresh modal */
        var updated=await DS.getAllRequisitions();
        _currentRecords=Array.isArray(updated)?updated:[];
        var rec=_currentRecords.find(function(r){return r.id===id;});
        if(rec)openModal(buildDetail(rec));
      }catch(err){
        if(status)status.textContent='❌ Failed: '+err.message;
        t.disabled=false;t.textContent='Upload & Attach';
      }
      return;
    }

    /* Show forward panel */
    if(t.classList.contains('btn-show-forward')){
      var id=t.getAttribute('data-id');
      var panel=$id('forward-sub-'+id);
      if(panel)panel.style.display=panel.style.display==='none'||!panel.style.display?'block':'none';
      return;
    }

    /* Do forward / action */
    if(t.classList.contains('btn-do-forward')||t.classList.contains('btn-do-reject')){
      var id=t.getAttribute('data-id');
      var action=t.getAttribute('data-action');
      var noteEl=$id('forward-note-'+id);
      var note=noteEl?noteEl.value.trim():'';
      if(action==='Rejected'&&!note){
        note=prompt('Please give a reason for rejection:')||'';
        if(!note)return;
      }
      t.disabled=true;t.textContent='Saving…';
      try{
        await DS.updateRequisitionStatus(id,action,note);
        showBanner('Requisition '+id+' updated to "'+action+'".','success');
        closeModal();
        /* Refresh dashboard/history */
        var updated=await DS.getAllRequisitions();
        _currentRecords=Array.isArray(updated)?updated:[];
        if($id('dashboard-table-body'))renderDashTable(_currentRecords);
        if($id('history-table-body'))renderHistTable(_currentRecords);
        var stats=await DS.getDashboardStats();
        renderStats(stats);
      }catch(err){
        showBanner(err.message||'Failed to update.','error');
        t.disabled=false;t.textContent=action;
      }
      return;
    }

    /* ── Comments ── */
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
        var recs=await DS.getAllRequisitions();
        _currentRecords=Array.isArray(recs)?recs:[];
        var rec=_currentRecords.find(function(r){return r.id===rid;});
        if(rec)openModal(buildDetail(rec));
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
        var recs=await DS.getAllRequisitions();
        _currentRecords=Array.isArray(recs)?recs:[];
        var rec=_currentRecords.find(function(r){return r.id===rid;});
        if(rec)openModal(buildDetail(rec));
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
  var form=$id('login-form'),cp=$id('change-password-panel');
  var ei=$id('input-email'),pi=$id('input-password'),er=$id('login-error'),bl=$id('btn-login');
  var pendingUser=null;
  function setErr(m){if(er){er.textContent=m;er.style.display=m?'block':'none';}}
  var tog=$id('btn-toggle-password');
  if(tog)tog.addEventListener('click',function(){
    pi.type=pi.type==='password'?'text':'password';tog.textContent=pi.type==='password'?'👁':'🙈';
  });
  var fl=$id('forgot-password-link');
  if(fl)fl.addEventListener('click',function(){alert('Please contact:\nt.otieno@ugandabiodiversityfund.org');});
  form.addEventListener('submit',async function(e){
    e.preventDefault();setErr('');
    var email=ei?ei.value.trim().toLowerCase():'';
    var pass=pi?pi.value:'';
    if(!email){setErr('Please enter your UBF work email.');return;}
    if(!pass){setErr('Please enter your password.');return;}
    if(bl){bl.disabled=true;bl.textContent='Verifying…';}
    try{
      var result=await DS.authenticateUser(email,pass);
      var user=result.user;
      if(user.mustChangePassword||DS.isPasswordExpired(user.passwordExpiry)){
        pendingUser=user;form.style.display='none';
        if(cp)cp.style.display='block';
        if(bl){bl.disabled=false;bl.textContent='Log In';}
        return;
      }
      DS.saveSession(user);go('dashboard.html');
    }catch(err){
      setErr(err.message||'Login failed. Please try again.');
      if(bl){bl.disabled=false;bl.textContent='Log In';}
    }
  });
  var bc=$id('btn-cancel-change');
  if(bc)bc.addEventListener('click',function(){
    pendingUser=null;form.style.display='block';if(cp)cp.style.display='none';
  });
  var bs=$id('btn-set-password');
  if(bs)bs.addEventListener('click',async function(){
    var np=($id('input-new-password')||{}).value||'';
    var cp2=($id('input-confirm-password')||{}).value||'';
    if(np.length<8){alert('Minimum 8 characters.');return;}
    if(np!==cp2){alert('Passwords do not match.');return;}
    bs.disabled=true;bs.textContent='Saving…';
    try{
      await DS.changePassword(pendingUser.email,np);
      var result=await DS.authenticateUser(pendingUser.email,np);
      DS.saveSession(result.user);go('dashboard.html');
    }catch(err){alert('Failed: '+err.message);bs.disabled=false;bs.textContent='Set Password & Log In';}
  });
}

/* ════════════════════════════════
   DASHBOARD
════════════════════════════════ */
function renderStats(s){
  var m={'stat-total':s.total||0,'stat-pending':s.pending||0,'stat-prepared':s.prepared||0,
    'stat-reviewed':s.reviewed||0,'stat-cleared':s.cleared||0,'stat-approved':s.approved||0,'stat-rejected':s.rejected||0};
  Object.keys(m).forEach(function(id){var el=$id(id);if(el)el.textContent=m[id];});
}
function buildActionBtns(rec,session){
  var html='';
  if(DS.canActionRequisition(session.role,rec.status)){
    var ns=DS.getNextStatus(session.role,rec.status),al=DS.getActionLabel(session.role,rec.status);
    html+='<button class="btn-action btn-approve" data-id="'+esc(rec.id)+'" data-action="'+esc(ns)+'">'+esc(al)+'</button> '+
          '<button class="btn-action btn-reject" data-id="'+esc(rec.id)+'" data-action="Rejected">Reject</button> ';
  }
  if(rec.submittedBy===session.email&&(rec.status==='Pending'||rec.status==='Rejected')){
    html+='<a href="form.html?edit='+esc(rec.id)+'" class="btn-action btn-review">✏️ Edit</a> ';
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
  renderDashTable(_currentRecords.filter(function(r){
    var d=(r.data&&r.data.description)||r.id||'';
    return(!sv||r.status===sv)&&(!sq||r.id.toLowerCase().indexOf(sq)!==-1||d.toLowerCase().indexOf(sq)!==-1||(r.submittedByName||'').toLowerCase().indexOf(sq)!==-1);
  }));
}
async function initDash(){
  if(!$id('dashboard-container'))return;
  if(!enforceAuth())return;
  navbar();wireLogout();wireModal();wireModalEvents();
  var ld=$id('dashboard-loading');if(ld)ld.style.display='block';
  try{
    var recs=await DS.getAllRequisitions(),stats=await DS.getDashboardStats();
    _currentRecords=Array.isArray(recs)?recs:[];
    renderStats(stats);renderDashTable(_currentRecords);
  }catch(err){showBanner(err.message||'Failed to load dashboard.','error');}
  finally{if(ld)ld.style.display='none';}
  var fs=$id('filter-status'),fq=$id('filter-search');
  if(fs)fs.addEventListener('change',filterDash);
  if(fq)fq.addEventListener('input',filterDash);
  var tb=$id('dashboard-table-body');
  if(tb)tb.addEventListener('click',async function(e){
    var t=e.target;
    if(t.classList.contains('link-detail')){
      e.preventDefault();
      var rec=_currentRecords.find(function(r){return r.id===t.getAttribute('data-id');});
      if(rec)openModal(buildDetail(rec));
      return;
    }
    if(t.classList.contains('btn-action')&&t.getAttribute('data-action')){
      var id=t.getAttribute('data-id'),action=t.getAttribute('data-action'),note='';
      if(action==='Rejected'){note=prompt('Reason for rejection:')||'';if(note===null)return;}
      t.disabled=true;t.textContent='Saving…';
      try{
        await DS.updateRequisitionStatus(id,action,note);
        showBanner('Updated to "'+action+'".','success');
        var updated=await DS.getAllRequisitions(),stats=await DS.getDashboardStats();
        _currentRecords=Array.isArray(updated)?updated:[];
        renderStats(stats);filterDash();
      }catch(err){showBanner(err.message||'Failed.','error');t.disabled=false;t.textContent=action;}
    }
  });
}

/* ════════════════════════════════
   GENERIC FORM SETUP
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
      var fi=form.querySelector('input[type="file"]'),files=fi?fi.files:null,rec;
      if(editId){
        rec=await DS.editRequisition(editId,data,files);
        showBanner('Updated and resubmitted: '+rec.id,'success');
      }else{
        rec=await DS.submitRequisition(data,files,formType);
        showBanner('Submitted: '+rec.id+'. Pending review by Susan Abonyo.','success');
      }
      form.reset();
      setTimeout(function(){go('dashboard.html');},3000);
    }catch(err){showBanner(err.message||'Submission failed. Please try again.','error');}
    finally{if(btn){btn.disabled=false;btn.textContent='Submit';}if(spin)spin.style.display='none';}
  });
}

/* ════════════════════════════════
   REQUEST FORM
════════════════════════════════ */
async function initForm(){
  if(!$id('requisition-form'))return;
  if(!enforceAuth())return;
  navbar();wireLogout();
  var s=DS.getSession();
  var n=$id('form-submitter-name'),ti=$id('form-submitter-title');
  if(n)n.textContent=s.name;if(ti)ti.textContent=s.title;
  var params=new URLSearchParams(location.search);
  if(params.has('edit')){
    try{
      var db=await DS.readDatabase();
      var er=db.records.find(function(r){return r.id===params.get('edit');});
      if(er&&er.data){
        Object.keys(er.data).forEach(function(k){var el=document.querySelector('[name="'+k+'"]');if(el)el.value=er.data[k]||'';});
        var ph=document.querySelector('.page-header h1');if(ph)ph.textContent='Edit — '+params.get('edit');
        var b=$id('btn-submit-requisition');if(b)b.textContent='Save & Resubmit';
      }
    }catch(err){showBanner('Could not load for editing: '+err.message,'error');}
  }
  setupForm('requisition-form','btn-submit-requisition','form-loading','request',
    function(){return{activityCode:fv('form-activity-code'),description:fv('form-description'),
      specification:fv('form-specification'),quantity:fv('form-quantity'),
      dateRequired:fv('form-date-required'),locationOfWork:fv('form-location'),
      contractPeriod:fv('form-contract-period'),accountCode:fv('form-account-code'),
      accountName:fv('form-account-name'),donorCode:fv('form-donor-code'),
      donorName:fv('form-donor-name'),department:fv('form-department'),budgetCode:fv('form-budget-code')};},
    function(d){
      if(!d.description)return'Please enter a description.';
      if(!d.specification)return'Please enter the specification.';
      if(!d.quantity||parseFloat(d.quantity)<=0)return'Please enter a valid quantity.';
      return'';
    }
  );
}

/* ════════════════════════════════
   TRAVEL PLAN
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
          route:re.value.trim(),date:(row.querySelector('[data-col="date"]')||{}).value||'',
          perDiem:(row.querySelector('[data-col="perDiem"]')||{}).value||'',
          accommodation:(row.querySelector('[data-col="accommodation"]')||{}).value||'',
          sda:(row.querySelector('[data-col="sda"]')||{}).value||'',
          others:(row.querySelector('[data-col="others"]')||{}).value||'',
          total:(row.querySelector('[data-col="total"]')||{}).value||''
        });
      });
      return{description:'Travel Plan: '+fv('t-business-reason'),
        travellerName:fv('t-traveller-name'),position:fv('t-position'),
        requestDate:fv('t-request-date'),staffNumber:fv('t-staff-number'),
        departureDate:fv('t-departure-date'),returnDate:fv('t-return-date'),
        totalDays:fv('t-total-days'),businessNights:fv('t-business-nights'),
        businessReason:fv('t-business-reason'),grandTotal:fv('t-grand-total'),
        routes:JSON.stringify(routes)};
    },
    function(d){
      if(!d.departureDate)return'Please enter departure date.';
      if(!d.returnDate)return'Please enter return date.';
      if(!d.businessReason)return'Please enter the business reason.';
      return'';
    }
  );
}

/* ════════════════════════════════
   ACCOUNTABILITY
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
          explanation:desc.trim(),refNo:(row.querySelector('[data-col="refNo"]')||{}).value||'',
          budgeted:(row.querySelector('[data-col="budgeted"]')||{}).value||'',
          actual:(row.querySelector('[data-col="actual"]')||{}).value||'',
          balance:(row.querySelector('[data-col="balance"]')||{}).value||''
        });
      });
      return{description:'Accountability: '+fv('acc-purpose'),
        employeeName:fv('acc-employee-name'),date:fv('acc-date'),
        travelDates:fv('acc-travel-dates'),department:fv('acc-department'),
        purpose:fv('acc-purpose'),totalBudgeted:fv('acc-total-budgeted'),
        totalActual:fv('acc-total-actual'),advanceReceived:fv('acc-advance-received'),
        expenses:JSON.stringify(expenses)};
    },
    function(d){
      if(!d.travelDates)return'Please enter dates of travel/activity.';
      if(!d.purpose)return'Please enter the purpose.';
      return'';
    }
  );
}

/* ════════════════════════════════
   EVALUATION REPORT
════════════════════════════════ */
async function initEvaluation(){
  if(!$id('evaluation-form'))return;
  if(!enforceAuth())return;
  navbar();wireLogout();
  var s=DS.getSession();
  var elevated=['Admin Officer','Finance Officer','FAM','ED'];
  if(elevated.indexOf(s.role)===-1){
    showBanner('Access restricted. This form is for Admin Officer, FAM and ED only.','error');
    setTimeout(function(){go('dashboard.html');},3000);return;
  }
  /* Pre-fill preparer badge */
  var ps=$id('eval-preparer-status');
  if(ps)ps.textContent='Preparing — '+s.name;
  setupForm('evaluation-form','btn-submit-evaluation','eval-loading','evaluation',
    function(){
      var items=[];
      document.querySelectorAll('#eval-items-body tr').forEach(function(row){
        var desc=row.querySelector('[name^="item_"]');
        if(desc&&desc.value.trim())items.push({
          item:desc.value.trim(),
          qty:(row.querySelector('[name^="qty_"]')||{}).value||'',
          s1:(row.querySelector('[name^="s1_"]')||{}).value||'',
          s2:(row.querySelector('[name^="s2_"]')||{}).value||'',
          s3:(row.querySelector('[name^="s3_"]')||{}).value||''
        });
      });
      return{description:fv('eval-description'),evalDate:fv('eval-date'),
        evalMethod:fv('eval-method'),quantity:fv('eval-quantity'),unit:fv('eval-unit'),
        suppliers:fv('eval-suppliers'),evalTeam:fv('eval-team'),
        supplier1Name:($id('sup1-name')||{}).value||'',
        supplier2Name:($id('sup2-name')||{}).value||'',
        supplier3Name:($id('sup3-name')||{}).value||'',
        sub1:fv('eval-sub1'),sub2:fv('eval-sub2'),sub3:fv('eval-sub3'),
        total1:fv('eval-total1'),total2:fv('eval-total2'),total3:fv('eval-total3'),
        recommendations:fv('eval-recommendations'),remarks:fv('eval-remarks'),
        items:JSON.stringify(items)};
    },
    function(d){
      if(!d.description)return'Please enter the item description.';
      if(!d.evalMethod)return'Please select a procurement method.';
      if(!d.suppliers)return'Please list the suppliers who responded.';
      if(!d.recommendations)return'Please enter your recommendations.';
      return'';
    }
  );
}

/* ════════════════════════════════
   LPO
════════════════════════════════ */
async function initLPO(){
  if(!$id('lpo-form'))return;
  if(!enforceAuth())return;
  navbar();wireLogout();
  var s=DS.getSession();
  var elevated=['Admin Officer','Finance Officer','FAM','ED'];
  if(elevated.indexOf(s.role)===-1){
    showBanner('Access restricted. LPO is for Admin Officer, FAM and ED only.','error');
    setTimeout(function(){go('dashboard.html');},3000);return;
  }
  /* Prefill requisitioner */
  var rn=$id('lpo-req-name'),rt=$id('lpo-req-title'),rd2=$id('lpo-req-designation'),rdDate=$id('lpo-req-date');
  if(rn)rn.textContent=s.name;
  if(rt)rt.textContent=s.title;
  if(rd2)rd2.textContent=s.title;
  if(rdDate)rdDate.textContent=new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
  setupForm('lpo-form','btn-submit-lpo','lpo-loading','lpo',
    function(){
      var items=[];
      document.querySelectorAll('#lpo-items-body tr').forEach(function(row){
        var desc=(row.querySelector('[name^="desc_"]')||{}).value||'';
        if(desc.trim())items.push({
          description:desc.trim(),
          qty:(row.querySelector('[name^="qty_"]')||{}).value||'',
          unit:(row.querySelector('[name^="unit_"]')||{}).value||'',
          unitPrice:(row.querySelector('[name^="price_"]')||{}).value||'',
          total:(row.querySelector('[name^="total_"]')||{}).value||''
        });
      });
      return{description:'LPO: '+fv('lpo-vendor-name'),
        lpoDate:fv('lpo-date'),vendorName:fv('lpo-vendor-name'),
        vendorAddress:fv('lpo-vendor-address'),accountCode:fv('lpo-account-code'),
        vendorNo:fv('lpo-vendor-no'),validity:fv('lpo-validity'),
        deliverAt:fv('lpo-deliver-at'),paymentTerms:fv('lpo-payment-terms'),
        subtotal:fv('lpo-subtotal'),vat:fv('lpo-vat'),total:fv('lpo-total'),
        items:JSON.stringify(items)};
    },
    function(d){
      if(!d.vendorName)return'Please enter the vendor name.';
      return'';
    }
  );
}

/* ════════════════════════════════
   GRN
════════════════════════════════ */
async function initGRN(){
  if(!$id('grn-form'))return;
  if(!enforceAuth())return;
  navbar();wireLogout();
  var s=DS.getSession();
  /* Pre-fill Received By with current user */
  var rn=$id('grn-rec-name'),rp=$id('grn-rec-position');
  if(rn)rn.value=s.name;
  if(rp)rp.value=s.title;
  setupForm('grn-form','btn-submit-grn','grn-loading','grn',
    function(){
      var items=[];
      document.querySelectorAll('#grn-items-body tr').forEach(function(row){
        var desc=(row.querySelector('[name^="desc_"]')||{}).value||'';
        if(desc.trim())items.push({
          description:desc.trim(),
          qty:(row.querySelector('[name^="qty_"]')||{}).value||'',
          unit:(row.querySelector('[name^="unit_"]')||{}).value||'',
          condition:(row.querySelector('[name^="cond_"]')||{}).value||''
        });
      });
      return{description:'GRN: '+fv('grn-vendor-name'),
        grnDate:fv('grn-date'),vendorName:fv('grn-vendor-name'),
        vendorAddress:fv('grn-vendor-address'),deliveryNoteNo:fv('grn-delivery-note'),
        addedToRegister:fv('grn-registered'),lpoRef:fv('grn-lpo-ref'),reqRef:fv('grn-req-ref'),
        deliveredByName:fv('grn-del-name'),deliveredByPosition:fv('grn-del-position'),deliveredByDate:fv('grn-del-date'),
        receivedByName:fv('grn-rec-name'),receivedByPosition:fv('grn-rec-position'),receivedByDate:fv('grn-rec-date'),
        verifiedByName:fv('grn-ver-name'),verifiedByPosition:fv('grn-ver-position'),verifiedByDate:fv('grn-ver-date'),
        items:JSON.stringify(items)};
    },
    function(d){
      if(!d.vendorName)return'Please enter the vendor name.';
      if(!d.receivedByName)return'Please enter the name of the person receiving goods.';
      return'';
    }
  );
}

/* ════════════════════════════════
   INVOICE / PAYMENT VOUCHER
════════════════════════════════ */
async function initInvoice(){
  if(!$id('invoice-form'))return;
  if(!enforceAuth())return;
  navbar();wireLogout();
  var s=DS.getSession();
  var elevated=['Admin Officer','Finance Officer','FAM','ED'];
  if(elevated.indexOf(s.role)===-1){
    showBanner('Access restricted. Payment Voucher is for Admin Officer, FAM and ED only.','error');
    setTimeout(function(){go('dashboard.html');},3000);return;
  }
  setupForm('invoice-form','btn-submit-invoice','invoice-loading','invoice',
    function(){
      var particulars=[];
      document.querySelectorAll('#inv-items-body tr').forEach(function(row){
        var p=(row.querySelector('[name^="particulars_"]')||{}).value||'';
        if(p.trim())particulars.push({
          particulars:p.trim(),
          accountCode:(row.querySelector('[name^="accCode_"]')||{}).value||'',
          amount:(row.querySelector('[name^="lineAmt_"]')||{}).value||''
        });
      });
      return{description:'Payment Voucher: '+fv('inv-payee'),
        invDate:fv('inv-date'),voucherNo:fv('inv-voucher-no'),chequeNo:fv('inv-cheque-no'),
        amount:fv('inv-amount'),payee:fv('inv-payee'),reqRef:fv('inv-req-ref'),lpoRef:fv('inv-lpo-ref'),
        vatApplies:($id('inv-vat-applies')||{}).value||'NO',vatAmount:fv('inv-vat-amount'),
        wht:fv('inv-wht'),total:fv('inv-total'),amountWords:fv('inv-amount-words'),
        donor:fv('inv-donor'),project:fv('inv-project'),budget:fv('inv-budget'),
        staff:fv('inv-staff'),partner:fv('inv-partner'),supplier:fv('inv-supplier'),
        budgetCategory:fv('inv-budget-cat'),particulars:JSON.stringify(particulars)};
    },
    function(d){
      if(!d.payee)return'Please enter the payee name.';
      if(!d.amount||parseFloat(d.amount)<=0)return'Please enter a valid payment amount.';
      return'';
    }
  );
}

/* ════════════════════════════════
   HISTORY PAGE
════════════════════════════════ */
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
  renderHistTable(_currentRecords.filter(function(r){
    var d=(r.data&&r.data.description)||r.id||'';
    return(!sv||r.status===sv)&&(!sq||r.id.toLowerCase().indexOf(sq)!==-1||d.toLowerCase().indexOf(sq)!==-1||(r.submittedByName||'').toLowerCase().indexOf(sq)!==-1);
  }));
}
async function initHist(){
  if(!$id('history-container'))return;
  if(!enforceAuth())return;
  navbar();wireLogout();wireModal();wireModalEvents();
  var ld=$id('history-loading');if(ld)ld.style.display='block';
  try{
    var recs=await DS.getAllRequisitions();
    _currentRecords=Array.isArray(recs)?recs:[];
    renderHistTable(_currentRecords);
  }catch(err){showBanner(err.message||'Failed to load.','error');}
  finally{if(ld)ld.style.display='none';}
  var fs=$id('history-filter-status'),fq=$id('history-filter-search');
  if(fs)fs.addEventListener('change',filterHist);
  if(fq)fq.addEventListener('input',filterHist);
  var tb=$id('history-table-body');
  if(tb)tb.addEventListener('click',function(e){
    if(e.target.classList.contains('link-hist-detail')){
      e.preventDefault();
      var rec=_currentRecords.find(function(r){return r.id===e.target.getAttribute('data-id');});
      if(rec)openModal(buildDetail(rec));
    }
  });
}

/* ════════════════════════════════
   ENTRY POINT
════════════════════════════════ */
document.addEventListener('DOMContentLoaded',function(){
  if($id('login-form'))          {initLogin();      return;}
  if($id('dashboard-container')) {initDash();       return;}
  if($id('requisition-form'))    {initForm();       return;}
  if($id('travel-form'))         {initTravel();     return;}
  if($id('accountability-form')) {initAcc();        return;}
  if($id('evaluation-form'))     {initEvaluation(); return;}
  if($id('lpo-form'))            {initLPO();        return;}
  if($id('grn-form'))            {initGRN();        return;}
  if($id('invoice-form'))        {initInvoice();    return;}
  if($id('history-container'))   {initHist();       return;}
  wireLogout();navbar();
});

}());
