/**
 * data.js - UBF Logistics & Procurement System
 * Token is read from localStorage key: ubf_gatekeeper_token
 * Set by script.js on first visit
 */
(function(global){
'use strict';

var CONFIG = {
  API_BASE        : 'https://api.github.com',
  OWNER           : 'CuePointe',
  REPO            : 'UBF-Request-Portal',
  DB_PATH         : 'data/requisitions.json',
  USERS_PATH      : 'data/users.json',
  BRANCH          : 'main',
  SESSION_KEY     : 'ubf_session',
  TOKEN_KEY       : 'ubf_gatekeeper_token',
  PASS_EXPIRY_DAYS: 90
};

var STAFF = {
  'i.amani@ugandabiodiversityfund.org'    : { name:'Ivan Amanigaruhanga', role:'ED',           title:'Executive Director'               },
  'w.nabatanzi@ugandabiodiversityfund.org': { name:'Winnie Nabatanzi',    role:'FAM',          title:'Finance and Administration Manager'},
  's.abonyo@ugandabiodiversityfund.org'   : { name:'Susan Abonyo',        role:'Admin Officer',title:'Administration Officer'           },
  'd.okullu@ugandabiodiversityfund.org'   : { name:'David Okullu',        role:'Staff',        title:'M&E Officer'                      },
  'p.musiime@ugandabiodiversityfund.org'  : { name:'Posiano Musiime',     role:'Staff',        title:'Programs Officer'                 },
  'o.atuhaire@ugandabiodiversityfund.org' : { name:'Owen Atuhaire',       role:'Staff',        title:'Project Officer'                  },
  't.otieno@ugandabiodiversityfund.org'   : { name:'Thomas Otieno',       role:'Staff',        title:'Office Assistant'                 }
};

var ELEVATED_ROLES = ['Admin Officer','Finance Officer','FAM','ED'];

var ROLE_ACTIONS = {
  'Admin Officer'  : { canAction:['Pending'],            nextStatus:'Prepared', actionLabel:'Mark Prepared' },
  'Finance Officer': { canAction:['Prepared'],           nextStatus:'Reviewed', actionLabel:'Mark Reviewed' },
  'FAM'            : { canAction:['Prepared','Reviewed'],nextStatus:null,       actionLabel:null             },
  'ED'             : { canAction:['Cleared'],            nextStatus:'Approved', actionLabel:'Approve'        }
};

/* ── Staff helpers ── */
function getStaff(email){
  if(!email) return {name:'',role:'Staff',title:'Staff'};
  return STAFF[email.trim().toLowerCase()]||{name:email,role:'Staff',title:'Staff'};
}
function getRole(email)        { return getStaff(email).role;  }
function getDisplayName(email) { return getStaff(email).name;  }
function getTitle(email)       { return getStaff(email).title; }
function canSeeAll(role)       { return ELEVATED_ROLES.indexOf(role)!==-1; }

function getNextStatus(role,status){
  if(role==='FAM'){
    if(status==='Prepared') return 'Reviewed';
    if(status==='Reviewed') return 'Cleared';
  }
  var a=ROLE_ACTIONS[role]; return a?a.nextStatus:null;
}
function getActionLabel(role,status){
  if(role==='FAM'){
    if(status==='Prepared') return 'Mark Reviewed';
    if(status==='Reviewed') return 'Clear';
  }
  var a=ROLE_ACTIONS[role]; return a?a.actionLabel:null;
}
function canActionRequisition(role,status){
  if(!role||!status) return false;
  var a=ROLE_ACTIONS[role]; if(!a) return false;
  return a.canAction.indexOf(status)!==-1;
}

/* ── Password utilities ── */
async function sha256(str){
  var buf=new TextEncoder().encode(str);
  var hash=await crypto.subtle.digest('SHA-256',buf);
  return Array.from(new Uint8Array(hash)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
}
function isPasswordExpired(expiry){ return expiry ? new Date(expiry)<new Date() : false; }
function newExpiryDate(){
  var d=new Date(); d.setDate(d.getDate()+CONFIG.PASS_EXPIRY_DAYS);
  return d.toISOString().split('T')[0];
}

/* ── API helpers ──
   IMPORTANT: buildHeaders() reads token FRESH from localStorage every call
   so token set after page load is always picked up. */
function getToken(){ return localStorage.getItem(CONFIG.TOKEN_KEY)||''; }

function buildApiUrl(path){
  return CONFIG.API_BASE+'/repos/'+CONFIG.OWNER+'/'+CONFIG.REPO+'/contents/'+path;
}
function buildHeaders(){
  return {
    'Authorization'       :'token '+getToken(),
    'Content-Type'        :'application/json',
    'Accept'              :'application/vnd.github.v3+json',
    'X-GitHub-Api-Version':'2022-11-28'
  };
}
function encodeB64(obj){ return btoa(unescape(encodeURIComponent(JSON.stringify(obj,null,2)))); }
function decodeB64(b64){ return JSON.parse(decodeURIComponent(escape(atob(b64.replace(/[\n\r]/g,''))))); }
function generateId(){
  var n=new Date(),rand=Math.floor(Math.random()*0xFFFFFF).toString(16).toUpperCase().padStart(6,'0');
  return 'UBF-'+n.getFullYear()+String(n.getMonth()+1).padStart(2,'0')+String(n.getDate()).padStart(2,'0')+'-'+rand;
}
function apiErr(status,msg){
  if(status===401) return 'Authentication failed (401). Check your token.';
  if(status===403) return "Permission denied (403). Token needs 'repo' scope.";
  if(status===404) return 'File not found (404). Contact administrator.';
  if(status===409) return 'Data conflict (409). Refresh and try again.';
  if(status===422) return 'Sync error (422). Refresh and try again.';
  return 'API error ('+status+'): '+(msg||'Unknown');
}

/* ── Core file read/write ── */
async function readGHFile(path){
  var res=await fetch(buildApiUrl(path)+'?_='+Date.now(),{method:'GET',headers:buildHeaders()});
  if(!res.ok){var e={};try{e=await res.json();}catch(_){} throw new Error(apiErr(res.status,e.message));}
  var f=await res.json();
  var data; try{data=decodeB64(f.content);}catch(_){data=[];}
  return {data:data,sha:f.sha};
}
async function writeGHFile(path,data,sha,msg){
  var res=await fetch(buildApiUrl(path),{
    method:'PUT',headers:buildHeaders(),
    body:JSON.stringify({message:msg||'UBF update',content:encodeB64(data),sha:sha,branch:CONFIG.BRANCH})
  });
  if(!res.ok){var e={};try{e=await res.json();}catch(_){} throw new Error(apiErr(res.status,e.message));}
  return await res.json();
}

/* ── Database ── */
async function readDatabase(){
  var r=await readGHFile(CONFIG.DB_PATH);
  return {records:Array.isArray(r.data)?r.data:[],sha:r.sha};
}
async function writeDatabase(records,sha,msg){
  return writeGHFile(CONFIG.DB_PATH,Array.isArray(records)?records:[],sha,msg);
}

/* ── Users ── */
async function readUsers(){
  var r=await readGHFile(CONFIG.USERS_PATH);
  return {users:Array.isArray(r.data)?r.data:[],sha:r.sha};
}
async function writeUsers(users,sha,msg){
  return writeGHFile(CONFIG.USERS_PATH,users,sha,msg);
}

/* ── Authentication ── */
async function authenticateUser(email,password){
  var el=email.trim().toLowerCase(),hash=await sha256(password);
  var r=await readUsers(),user=r.users.find(function(u){return u.email.toLowerCase()===el;});
  if(!user)  throw new Error('No account found for this email address.');
  if(!user.active) throw new Error('Account deactivated. Contact administrator.');
  if(user.passwordHash!==hash) throw new Error('Incorrect password. Please try again.');
  return {user:user,usersSha:r.sha,allUsers:r.users};
}
async function changePassword(email,newPass){
  var r=await readUsers();
  var idx=r.users.findIndex(function(u){return u.email.toLowerCase()===email.toLowerCase();});
  if(idx===-1) throw new Error('User not found.');
  r.users[idx].passwordHash=await sha256(newPass);
  r.users[idx].passwordExpiry=newExpiryDate();
  r.users[idx].mustChangePassword=false;
  await writeUsers(r.users,r.sha,'Password changed for '+email);
  return true;
}

/* ── Session ── */
function saveSession(user){
  var s={email:user.email,name:user.name,role:user.role,title:user.title,
    loginAt:new Date().toISOString(),expiresAt:new Date(Date.now()+8*3600000).toISOString()};
  localStorage.setItem(CONFIG.SESSION_KEY,JSON.stringify(s));
  return s;
}
function getSession(){
  try{
    var raw=localStorage.getItem(CONFIG.SESSION_KEY);
    if(!raw) return null;
    var s=JSON.parse(raw);
    if(new Date(s.expiresAt)<new Date()){clearSession();return null;}
    return s;
  }catch(_){return null;}
}
function clearSession(){
  localStorage.removeItem(CONFIG.SESSION_KEY);
  localStorage.removeItem('ubf_email');
  localStorage.removeItem('ubf_pat');
}
function isAuthenticated(){ return !!getSession(); }
function requireSession(){
  var s=getSession(); if(!s) throw new Error('Session expired. Please log in again.');
  return s;
}

/* ── Filtering ── */
function filterByRole(records,session){
  if(!Array.isArray(records)||!session) return [];
  if(canSeeAll(session.role)) return records;
  return records.filter(function(r){
    return r.submittedBy&&r.submittedBy.toLowerCase()===session.email.toLowerCase();
  });
}

/* ── Attachments ── */
function uploadAttachment(file){
  return new Promise(function(resolve,reject){
    var reader=new FileReader();
    reader.onerror=function(){reject(new Error('Cannot read: '+file.name));};
    reader.onload=async function(evt){
      try{
        var b64=evt.target.result.split(',')[1];
        var safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
        var path='attachments/'+Date.now()+'_'+safe;
        var res=await fetch(buildApiUrl(path),{
          method:'PUT',headers:buildHeaders(),
          body:JSON.stringify({message:'Attachment: '+safe,content:b64,branch:CONFIG.BRANCH})
        });
        if(!res.ok){var e={};try{e=await res.json();}catch(_){} throw new Error(apiErr(res.status,e.message));}
        var result=await res.json();
        resolve({path:path,downloadUrl:result.content.html_url,name:file.name,size:file.size,uploadedAt:new Date().toISOString()});
      }catch(err){reject(err);}
    };
    reader.readAsDataURL(file);
  });
}
async function uploadAllAttachments(fileList){
  var results=[],files=Array.isArray(fileList)?fileList:Array.from(fileList||[]);
  for(var i=0;i<files.length;i++) results.push(await uploadAttachment(files[i]));
  return results;
}

/* ── Requisition CRUD ── */
async function getAllRequisitions(){
  var session=requireSession(),db=await readDatabase();
  var visible=filterByRole(db.records,session);
  if(!Array.isArray(visible)) return [];
  return visible.sort(function(a,b){return new Date(b.createdAt)-new Date(a.createdAt);});
}

async function submitRequisition(formData,files,formType){
  var session=requireSession(),db=await readDatabase();
  var attachments=[];
  if(files&&files.length>0) attachments=await uploadAllAttachments(Array.from(files));
  var now=new Date().toISOString();
  var rec={
    id:generateId(),formType:formType||'request',data:formData,
    submittedBy:session.email,submittedByName:session.name,
    submittedByTitle:session.title,submittedByRole:session.role,
    status:'Pending',attachments:attachments,comments:[],
    createdAt:now,updatedAt:now,
    approval:{
      preparation:{status:'Pending',by:'',byName:'',at:'',note:''},
      review     :{status:'Pending',by:'',byName:'',at:'',note:''},
      clearance  :{status:'Pending',by:'',byName:'',at:'',note:''},
      approval   :{status:'Pending',by:'',byName:'',at:'',note:''}
    },
    history:[{action:'Submitted',by:session.email,byName:session.name,byTitle:session.title,at:now,note:'Initial submission'}]
  };
  db.records.push(rec);
  await writeDatabase(db.records,db.sha,'New '+rec.formType+' '+rec.id+' by '+session.email);
  return rec;
}

async function updateRequisitionStatus(id,newStatus,note){
  var session=requireSession(),db=await readDatabase();
  var idx=db.records.findIndex(function(r){return r.id===id;});
  if(idx===-1) throw new Error('Requisition not found: '+id);
  if(!canActionRequisition(session.role,db.records[idx].status))
    throw new Error('Your role cannot action this at its current status.');
  var now=new Date().toISOString(),stepMap={Prepared:'preparation',Reviewed:'review',Cleared:'clearance',Approved:'approval'};
  db.records[idx].status=newStatus;
  db.records[idx].updatedAt=now;
  var step=stepMap[newStatus];
  if(step) db.records[idx].approval[step]={status:newStatus,by:session.email,byName:session.name,at:now,note:note||''};
  db.records[idx].history.push({action:newStatus,by:session.email,byName:session.name,byTitle:session.title,at:now,note:note||''});
  await writeDatabase(db.records,db.sha,'Status: '+id+' -> '+newStatus+' by '+session.email);
  return db.records[idx];
}

async function editRequisition(id,updatedData,files){
  var session=requireSession(),db=await readDatabase();
  var idx=db.records.findIndex(function(r){return r.id===id;});
  if(idx===-1) throw new Error('Requisition not found: '+id);
  var rec=db.records[idx];
  if(rec.submittedBy.toLowerCase()!==session.email.toLowerCase()) throw new Error('You can only edit your own submissions.');
  if(['Prepared','Reviewed','Cleared','Approved'].indexOf(rec.status)!==-1) throw new Error('This submission is in progress and cannot be edited.');
  var newAtt=[];
  if(files&&files.length>0) newAtt=await uploadAllAttachments(Array.from(files));
  var now=new Date().toISOString();
  db.records[idx].data=updatedData;
  db.records[idx].status='Pending';
  db.records[idx].updatedAt=now;
  db.records[idx].attachments=rec.attachments.concat(newAtt);
  db.records[idx].approval={
    preparation:{status:'Pending',by:'',byName:'',at:'',note:''},
    review     :{status:'Pending',by:'',byName:'',at:'',note:''},
    clearance  :{status:'Pending',by:'',byName:'',at:'',note:''},
    approval   :{status:'Pending',by:'',byName:'',at:'',note:''}
  };
  db.records[idx].history.push({action:'Edited & Resubmitted',by:session.email,byName:session.name,byTitle:session.title,at:now,note:'Corrected and resubmitted'});
  await writeDatabase(db.records,db.sha,'Edit: '+id+' by '+session.email);
  return db.records[idx];
}

/* ── Comments & Replies ── */
async function addComment(reqId,text){
  var session=requireSession(),db=await readDatabase();
  var idx=db.records.findIndex(function(r){return r.id===reqId;});
  if(idx===-1) throw new Error('Requisition not found.');
  if(!Array.isArray(db.records[idx].comments)) db.records[idx].comments=[];
  var c={id:'CMT-'+Date.now(),by:session.email,byName:session.name,byRole:session.role,text:text,at:new Date().toISOString(),replies:[]};
  db.records[idx].comments.push(c);
  db.records[idx].updatedAt=new Date().toISOString();
  await writeDatabase(db.records,db.sha,'Comment on '+reqId+' by '+session.email);
  return c;
}
async function addReply(reqId,commentId,text){
  var session=requireSession(),db=await readDatabase();
  var idx=db.records.findIndex(function(r){return r.id===reqId;});
  if(idx===-1) throw new Error('Requisition not found.');
  var cs=db.records[idx].comments||[];
  var ci=cs.findIndex(function(c){return c.id===commentId;});
  if(ci===-1) throw new Error('Comment not found.');
  var r={id:'RPL-'+Date.now(),by:session.email,byName:session.name,byRole:session.role,text:text,at:new Date().toISOString()};
  db.records[idx].comments[ci].replies.push(r);
  db.records[idx].updatedAt=new Date().toISOString();
  await writeDatabase(db.records,db.sha,'Reply on '+reqId+' by '+session.email);
  return r;
}

/* ── Stats ── */
async function getDashboardStats(){
  var records=await getAllRequisitions();
  if(!Array.isArray(records)) return {total:0,pending:0,prepared:0,reviewed:0,cleared:0,approved:0,rejected:0};
  var s={total:records.length,pending:0,prepared:0,reviewed:0,cleared:0,approved:0,rejected:0};
  records.forEach(function(r){
    var st=(r.status||'').toLowerCase();
    if(st==='pending')s.pending++;
    else if(st==='prepared')s.prepared++;
    else if(st==='reviewed')s.reviewed++;
    else if(st==='cleared')s.cleared++;
    else if(st==='approved')s.approved++;
    else if(st==='rejected')s.rejected++;
  });
  return s;
}

/* ── Expose ── */
global.DataService={
  CONFIG,ROLE_ACTIONS,ELEVATED_ROLES,
  getStaff,getRole,getDisplayName,getTitle,
  canSeeAll,canActionRequisition,getNextStatus,getActionLabel,
  authenticateUser,changePassword,sha256,isPasswordExpired,
  saveSession,getSession,clearSession,isAuthenticated,requireSession,
  readGitHubFile:readGHFile,writeGitHubFile:writeGHFile,
  readDatabase,writeDatabase,readUsers,writeUsers,
  uploadAttachment,uploadAllAttachments,
  getAllRequisitions,submitRequisition,updateRequisitionStatus,editRequisition,
  addComment,addReply,getDashboardStats
};

}(window));
