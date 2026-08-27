
// ── Firebase ──
const FIREBASE_CONFIG={
  apiKey:"AIzaSyCL37JohDOJ0fbCVrhGHys_7jEEO8zfE2U",
  authDomain:"fire-safety-6ba08.firebaseapp.com",
  databaseURL:"https://fire-safety-6ba08-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:"fire-safety-6ba08",
  storageBucket:"fire-safety-6ba08.firebasestorage.app",
  messagingSenderId:"585109331074",
  appId:"1:585109331074:web:b1a5764ca868196684689b"
};

// ── 기본값 ──
const DEFAULT_USER_PW  = 'fire1234';   // 일반 비밀번호
const DEFAULT_ADMIN_PW = 'admin9999';  // 관리자 비밀번호

const BLD_CONFIG = {
  jongham: {
    name:'종합관', icon:'🏢',
    schedules:[
      {month:2, type:'종합', label:'상반기 종합점검'},
      {month:8, type:'작동', label:'하반기 작동점검'}
    ]
  },
  seomigam: {
    name:'서미감관', icon:'🏛️',
    schedules:[
      {month:5, type:'작동', label:'상반기 작동점검'},
      {month:6, type:'종합', label:'상반기 종합점검'}
    ]
  }
};

function getFYLabel(fy){ return `${fy}년도 (${fy}.03.01 ~ ${fy+1}.02.28)`; }
function getCurrentFY(){
  const now = new Date();
  return now.getMonth() >= 2 ? now.getFullYear() : now.getFullYear()-1;
}
function getFYRange(fy){ return {start:`${fy}-03-01`, end:`${fy+1}-02-28`}; }
function getItemFY(dateStr){
  if(!dateStr) return getCurrentFY();
  const d = new Date(dateStr);
  return d.getMonth() >= 2 ? d.getFullYear() : d.getFullYear()-1;
}
const ALL_TABS = [
  {id:'home',label:'🏠 메인보드'},
  {id:'inv',label:'📦 재고'},
  {id:'journal',label:'📝 업무일지'},
  {id:'schedule',label:'📅 일정'},
  {id:'memo',label:'🗒️ 메모'},
  {id:'selfcheck',label:'🔍 자체점검'},
  {id:'jongham',label:'🏢 종합관'},
  {id:'seomigam',label:'🏛️ 서미감관'},
  {id:'settings',label:'⚙️ 설정'}
];

// ── 상태 ──
let curPage='home',curJF='전체',curMemoF='전체',curJrnType='hospital';
let calYear,calMonth,selDate;
let openCats={};
let db={
  items:[],txns:[],journals:[],schedules:[],memos:[],members:[],
  categories:['소화기류','호스·관창','감지기','밸브류','기타'],
  hospitals:['원주세브란스병원','원주기독병원'],
  univs:['연세대학교 미래캠퍼스','상지대학교'],
  inspections:[],
  remedies:[],
  userPw:DEFAULT_USER_PW,
  adminPw:DEFAULT_ADMIN_PW,
  units:['EA','개','본','롤','박스','세트','kg','L'],
  locations:['신관 지하 전기실','응급센터 지하 하론실','외래센터 2층 PIT실']
};
let userName='',isAdmin=false,myTabs=[],isDark=false,firebaseRef=null;
let mbrTabState={};

const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const tod=()=>new Date().toISOString().slice(0,10);
const getW=()=>userName||'익명';
const catEmoji={'소화기류':'🧯','호스·관창':'🚿','감지기':'📡','밸브류':'🔧','기타':'📦'};

// ── 로그인 ──
function doLogin(){
  const name=document.getElementById('loginName').value.trim();
  const pw=document.getElementById('loginPw').value;
  const err=document.getElementById('loginError');
  if(!name){err.textContent='이름을 입력해 주세요';err.style.display='block';return;}

  // Firebase에서 최신 비밀번호 먼저 가져온 후 로그인 처리
  const btn=document.querySelector('#loginScreen .btn-primary');
  btn.textContent='확인 중...';btn.disabled=true;

  function checkLogin(userPw, adminPw){
    btn.textContent='입장하기';btn.disabled=false;
    if(pw===adminPw){
      isAdmin=true;userName=name;myTabs=ALL_TABS.map(t=>t.id);enterApp();
    } else if(pw===userPw){
      isAdmin=false;userName=name;
      const member=db.members.find(m=>m.name===name);
      myTabs=member?member.tabs:['home','inv','journal','schedule','memo','selfcheck','jongham','seomigam'];
      enterApp();
    } else {
      err.textContent='비밀번호가 올바르지 않습니다';err.style.display='block';
      document.getElementById('loginPw').value='';
    }
  }

  // Firebase에서 실시간 비밀번호 조회
  if(typeof firebase!=='undefined'&&firebase.apps.length){
    firebase.database().ref('sobangtm').once('value').then(snap=>{
      const d=snap.val();
      const userPw=(d&&d.userPw)||DEFAULT_USER_PW;
      const adminPw=(d&&d.adminPw)||DEFAULT_ADMIN_PW;
      if(d)db=Object.assign(db,d);
      checkLogin(userPw,adminPw);
    }).catch(()=>{
      checkLogin(db.userPw||DEFAULT_USER_PW, db.adminPw||DEFAULT_ADMIN_PW);
    });
  } else {
    // Firebase 미연결 시 로컬 데이터로 확인
    setTimeout(()=>checkLogin(db.userPw||DEFAULT_USER_PW, db.adminPw||DEFAULT_ADMIN_PW), 100);
  }
}
function enterApp(){
  localStorage.setItem('fb_user',userName);
  localStorage.setItem('fb_isAdmin',isAdmin?'1':'0');
  localStorage.setItem('fb_myTabs',JSON.stringify(myTabs));
  document.getElementById('loginScreen').style.display='none';
  document.getElementById('appWrap').classList.add('visible');
  document.getElementById('userBadge').innerHTML=(isAdmin?'👑 ':'👤 ')+userName;
  document.getElementById('adminPanel').style.display=isAdmin?'block':'none';
  // Firebase 상태 초기화
  const fsEl=document.getElementById('firebaseStatus');
  if(fsEl){fsEl.className='firebase-status disconnected';fsEl.textContent='🔄 Firebase 연결 중...';}
  buildNav();
  renderAll();
  initFirebase(FIREBASE_CONFIG);
}
function doLogout(){
  if(!confirm('로그아웃 하시겠습니까?'))return;
  localStorage.removeItem('fb_user');localStorage.removeItem('fb_isAdmin');localStorage.removeItem('fb_myTabs');
  location.reload();
}
function tryAutoLogin(){
  const n=localStorage.getItem('fb_user');
  const a=localStorage.getItem('fb_isAdmin')==='1';
  const t=localStorage.getItem('fb_myTabs');
  if(n&&t){
    userName=n;isAdmin=a;myTabs=JSON.parse(t);
    enterApp();return true;
  }
  return false;
}

// ── 네비 빌드 ──
function buildNav(){
  const tabs=isAdmin?ALL_TABS:ALL_TABS.filter(t=>myTabs.includes(t.id));
  document.getElementById('bottomNav').innerHTML=tabs.map(t=>
    `<button class="nav-item${t.id===curPage?' active':''}" data-page="${t.id}" onclick="switchPage('${t.id}')">
      <span class="nav-icon">${t.label.split(' ')[0]}</span>${t.label.split(' ')[1]}
    </button>`).join('');
  // 현재 페이지가 접근 불가면 첫 탭으로
  if(!isAdmin&&!myTabs.includes(curPage)){
    curPage=myTabs[0]||'inv';
  }
}

// ── 다크모드 ──
function toggleDark(){
  isDark=!isDark;document.body.classList.toggle('dark',isDark);
  localStorage.setItem('fb_dark',isDark?'1':'0');updateDarkUI();
}
function updateDarkUI(){
  document.getElementById('darkBtn').textContent=isDark?'☀️':'🌙';
  const sb=document.getElementById('darkSettingsBtn');
  if(sb)sb.textContent=isDark?'☀️ 라이트 켜기':'🌙 다크 켜기';
}

// ── Firebase ──
function initFirebase(cfg){
  if(typeof firebase==='undefined'){
    let n=0;
    ['https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js',
     'https://www.gstatic.com/firebasejs/9.22.2/firebase-database-compat.js'].forEach(src=>{
      const s=document.createElement('script');s.src=src;
      s.onload=()=>{if(++n===2)setupFB(cfg);};document.head.appendChild(s);
    });
  }else setupFB(cfg);
}
function setupFB(cfg){
  try{
    if(!firebase.apps.length)firebase.initializeApp(cfg);
    firebaseRef=firebase.database().ref('sobangtm');
    firebaseRef.on('value',snap=>{
      const d=snap.val();
      if(d){
        db=Object.assign(db,d);
        localStorage.setItem('fb_db',JSON.stringify(db));
        renderAll();
      }
      setSyncStatus('ok');
      const el=document.getElementById('firebaseStatus');
      if(el){el.className='firebase-status connected';el.textContent='🟢 실시간 동기화 중';}
    });
  }catch(e){
    setSyncStatus('error');
    const el=document.getElementById('firebaseStatus');
    if(el){el.className='firebase-status disconnected';el.textContent='🔴 연결 오류 — 재시도 중...';}
    // 3초 후 재시도
    setTimeout(()=>setupFB(cfg), 3000);
  }
}
function saveLocal(){
  localStorage.setItem('fb_db',JSON.stringify(db));
  if(firebaseRef){setSyncStatus('syncing');firebaseRef.set(db).then(()=>setSyncStatus('ok')).catch(()=>setSyncStatus('error'));}
}
function setSyncStatus(s){document.getElementById('syncDot').className='sync-dot'+(s==='syncing'?' syncing':s==='error'?' error':'');}

// ── 페이지 ──
function switchPage(p){
  if(p==='txnHistory'){curPage=p;document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id==='page-'+p));renderTxnHistory();return;}
  if(!isAdmin&&!myTabs.includes(p)){toast('접근 권한이 없습니다','error');return;}
  curPage=p;
  document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id==='page-'+p));
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.page===p));

  renderCurrent();
}
function renderAll(){
  renderHome();renderInv();renderJournal();renderCalendar();renderMonthSchedule();renderMemo();renderSettings();
  if(document.getElementById('selfcheckContent'))renderSelfCheck();
  if(document.getElementById('jonghamContent'))renderBuilding('jongham');
  if(document.getElementById('seomigamContent'))renderBuilding('seomigam');
}
function renderCurrent(){
  if(curPage==='inv')renderInv();
  if(curPage==='journal')renderJournal();
  if(curPage==='schedule'){renderCalendar();renderScheduleList();}
  if(curPage==='home')renderHome();
  if(curPage==='selfcheck')renderSelfCheck();
  if(curPage==='jongham')renderBuilding('jongham');
  if(curPage==='seomigam')renderBuilding('seomigam');
  if(curPage==='memo')renderMemo();
  if(curPage==='settings')renderSettings();
  if(curPage==='txnHistory'){renderTxnHistory();}
}
// FAB 제거됨 - 각 탭 상단 버튼으로 통일

// ── 팀원 관리 ──
function renderMemberList(){
  const el=document.getElementById('memberList');if(!el)return;
  if(!db.members||!db.members.length){el.innerHTML='<div style="font-size:13px;color:var(--text3);text-align:center;padding:12px">등록된 팀원이 없어요</div>';return;}
  el.innerHTML=db.members.map(m=>`
    <div class="member-item">
      <div style="flex:1;min-width:0">
        <div class="member-name">👤 ${m.name}</div>
        <div class="tab-toggle-group" style="margin-top:6px">
          ${ALL_TABS.filter(t=>t.id!=='settings').map(t=>`
            <span class="tab-toggle${(m.tabs||[]).includes(t.id)?' on':''}" onclick="toggleMemberTab('${m.id}','${t.id}')">${t.label}</span>
          `).join('')}
        </div>
      </div>
      <button class="btn btn-xs btn-outline-red" onclick="deleteMember('${m.id}')">삭제</button>
    </div>`).join('');
}
function toggleMemberTab(memberId,tabId){
  const m=db.members.find(x=>x.id===memberId);if(!m)return;
  m.tabs=m.tabs||[];
  if(m.tabs.includes(tabId))m.tabs=m.tabs.filter(t=>t!==tabId);
  else m.tabs.push(tabId);
  saveLocal();renderMemberList();toast('권한 변경됐습니다','success');
}
function openAddMember(){
  document.getElementById('mbr_id').value='';
  document.getElementById('mbr_name').value='';
  mbrTabState={inv:true,journal:true,schedule:true,memo:true};
  openModal('addMember');
  setTimeout(renderMbrTabToggles, 100);
}

function renderMbrTabToggles(){
  const el=document.getElementById('mbrTabToggles');
  if(!el)return;
  el.innerHTML=ALL_TABS.filter(t=>t.id!=='settings').map(t=>{
    const on=mbrTabState[t.id];
    return `<button onclick="toggleMbrTab('${t.id}')" style="padding:8px 14px;border-radius:20px;border:2px solid ${on?'var(--primary)':'var(--border2)'};background:${on?'var(--primary)':'var(--surface)'};color:${on?'#fff':'var(--text2)'};font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;margin:3px">${t.label}</button>`;
  }).join('');
}
function toggleMbrTab(tabId){
  mbrTabState[tabId]=!mbrTabState[tabId];renderMbrTabToggles();
}
function saveMember(){
  const name=document.getElementById('mbr_name').value.trim();
  if(!name){toast('이름을 입력해 주세요','error');return;}
  const tabs=Object.entries(mbrTabState).filter(([,v])=>v).map(([k])=>k);
  db.members=db.members||[];
  db.members.push({id:uid(),name,tabs});
  saveLocal();closeModal('addMember');renderMemberList();toast(name+'님 추가됐습니다','success');
}
function deleteMember(id){
  if(!confirm('팀원을 삭제하시겠습니까?'))return;
  db.members=db.members.filter(x=>x.id!==id);
  saveLocal();renderMemberList();toast('삭제됐습니다');
}
function savePwSettings(){
  const newU=document.getElementById('newUserPw').value.trim();
  const newA=document.getElementById('newAdminPw').value.trim();
  if(newU)db.userPw=newU;
  if(newA)db.adminPw=newA;
  if(!newU&&!newA){toast('변경할 비밀번호를 입력해 주세요','error');return;}
  saveLocal();
  document.getElementById('newUserPw').value='';document.getElementById('newAdminPw').value='';
  toast('비밀번호가 변경됐습니다','success');
}

// ── 재고 (계층) ──
function renderInv(){
  renderLowStockBanner();
  const q=document.getElementById('invSearch').value.trim().toLowerCase();
  const total=db.items.length,low=db.items.filter(it=>it.min>0&&it.qty<=it.min).length;
  document.getElementById('invSummary').innerHTML=`
    <div class="inv-stat"><div class="inv-stat-num" style="color:var(--primary)">${total}</div><div class="inv-stat-label">전체 품목</div></div>
    <div class="inv-stat"><div class="inv-stat-num" style="color:var(--red)">${low}</div><div class="inv-stat-label">부족 품목</div></div>
    <div class="inv-stat"><div class="inv-stat-num" style="color:var(--green)">${total-low}</div><div class="inv-stat-label">정상 품목</div></div>`;
  if(q){
    const filtered=db.items.filter(it=>it.name.toLowerCase().includes(q)||(it.cat&&it.cat.toLowerCase().includes(q))||(it.memo&&it.memo.toLowerCase().includes(q)));
    document.getElementById('invList').innerHTML=filtered.length?filtered.map(it=>itemCardHTML(it)).join(''):'<div class="empty"><div class="empty-icon">🔍</div><div>검색 결과가 없어요</div></div>';
    return;
  }
  const cats=db.categories;
  document.getElementById('invList').innerHTML=cats.map(cat=>{
    const items=db.items.filter(it=>it.cat===cat);
    const lowCnt=items.filter(it=>it.min>0&&it.qty<=it.min).length;
    const isOpen=openCats[cat]||false;
    const totalQty=items.reduce((s,it)=>s+it.qty,0);
    const unit=items[0]?.unit||'개';
    return `<div class="cat-group">
      <div class="cat-group-head${isOpen?' open':''}" onclick="toggleCat('${cat}')">
        <div class="cat-group-left">
          <div class="cat-group-icon">${catEmoji[cat]||'📦'}</div>
          <div>
            <div class="cat-group-name">${cat}</div>
            <div class="cat-group-count">품목 ${items.length}개 · 총 ${totalQty}${unit}${lowCnt>0?` · <span style="color:var(--red)">⚠ 부족 ${lowCnt}개</span>`:''}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          ${lowCnt>0?`<span class="badge b-red">부족</span>`:''}
          <span class="cat-arrow${isOpen?' open':''}">▶</span>
        </div>
      </div>
      <div class="cat-group-body${isOpen?' open':''}" id="catbody-${cat.replace(/[^a-zA-Z0-9가-힣]/g,'_')}">
        ${items.length?items.map(it=>itemCardHTML(it)).join(''):`<div style="padding:16px;text-align:center;color:var(--text3);font-size:13px">등록된 품목이 없어요</div>`}
      </div>
    </div>`;
  }).join('');
}
function toggleCat(cat){openCats[cat]=!openCats[cat];renderInv();}
function itemCardHTML(it){
  const isLow=it.min>0&&it.qty<=it.min;
  const logs=(db.txns||[]).filter(t=>t.itemId===it.id).slice(-3).reverse();
  return `<div class="item-card ${isLow?'low':'ok'}">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
      <div style="flex:1;min-width:0">
        <div class="item-name">${it.name}</div>
        <div class="item-sub">${it.cat||''}${it.loc?' 📍'+it.loc:''}${it.memo?' · '+it.memo:''}</div>
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0">
        <button class="btn btn-xs btn-outline-primary" onclick="openTxn('${it.id}')">입출고</button>
        <button class="btn btn-xs" onclick="openEditItem('${it.id}')">수정</button>
        <button class="btn btn-xs btn-outline-red" onclick="deleteItem('${it.id}')">삭제</button>
      </div>
    </div>
    <div class="item-qty-wrap">
      <button class="qty-btn" onclick="quickQty('${it.id}',-1)" style="color:var(--red)">−</button>
      <div style="text-align:center">
        <input type="number" min="0" value="${it.qty}"
          style="width:64px;font-size:20px;font-weight:700;font-family:monospace;text-align:center;border:1.5px solid var(--border2);border-radius:var(--radius-sm);padding:4px 2px;background:var(--surface);color:${isLow?'var(--red)':'var(--text)'};outline:none"
          onchange="setQtyDirect('${it.id}',this.value)"
          onfocus="this.select()">
        <div class="qty-unit">${it.unit||'개'}</div>
      </div>
      <button class="qty-btn" onclick="quickQty('${it.id}',1)" style="color:var(--green)">＋</button>
      ${it.min>0?`<span class="badge ${isLow?'b-red':'b-green'}">${isLow?'⚠ 부족':'✓ 충분'}</span>`:''}
    </div>
    ${it.min>0?`<div style="font-size:11px;color:var(--text3);margin-top:4px">최소 기준: ${it.min} ${it.unit||'개'}</div>`:''}
    ${logs.length?`<button class="btn btn-xs" style="margin-top:8px;color:var(--text3);border:none;background:none;padding:4px 0" onclick="toggleLog('${it.id}')">📋 최근 입출고 내역</button>
      <div class="log-list" id="log-${it.id}">
        ${logs.map(t=>`<div class="log-row">
          <span class="badge ${t.type==='in'?'b-green':'b-red'}">${t.type==='in'?'입고':'출고'}</span>
          <span style="font-weight:600">${t.type==='in'?'+':'-'}${t.qty}${it.unit||'개'}</span>
          <span style="color:var(--text3);flex:1">${t.memo||''}</span>
          <span style="color:var(--text3)">${t.date||''}</span>
        </div>`).join('')}
      </div>`:''}
  </div>`;
}
function toggleLog(id){const el=document.getElementById('log-'+id);if(el)el.classList.toggle('open');}
function openAddItem(){
  document.getElementById('item_id').value='';document.getElementById('addItemTitle').textContent='품목 추가';
  ['item_name','item_qty','item_min','item_memo'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('item_unit').value='EA';
  document.getElementById('item_unit_btn').textContent='EA ▾';
  document.getElementById('item_loc').value='';
  document.getElementById('item_loc_btn').textContent='선택 안함 ▾';
  renderItemCatSel();openModal('addItem');
}
function openEditItem(id){
  const it=db.items.find(x=>x.id===id);if(!it)return;
  document.getElementById('item_id').value=id;document.getElementById('addItemTitle').textContent='품목 수정';
  document.getElementById('item_name').value=it.name;document.getElementById('item_qty').value=it.qty;
  document.getElementById('item_min').value=it.min||'';
  document.getElementById('item_unit').value=it.unit||'EA';
  document.getElementById('item_unit_btn').textContent=(it.unit||'EA')+' ▾';
  document.getElementById('item_loc').value=it.loc||'';
  document.getElementById('item_loc_btn').textContent=(it.loc||'선택 안함')+' ▾';
  document.getElementById('item_memo').value=it.memo||'';renderItemCatSel(it.cat);openModal('addItem');
}
function renderItemCatSel(cur){document.getElementById('item_cat').innerHTML=db.categories.map(c=>`<option value="${c}"${c===cur?' selected':''}>${c}</option>`).join('');}
function saveItem(){
  const id=document.getElementById('item_id').value,name=document.getElementById('item_name').value.trim();
  const qty=parseInt(document.getElementById('item_qty').value)||0,min=parseInt(document.getElementById('item_min').value)||0;
  const unit=document.getElementById('item_unit').value.trim()||'개',memo=document.getElementById('item_memo').value.trim();
  const cat=document.getElementById('item_cat').value;
  const loc=document.getElementById('item_loc').value;
  if(!name){toast('품목명을 입력해 주세요','error');return;}
  if(id){const it=db.items.find(x=>x.id===id);if(it)Object.assign(it,{name,qty,min,unit,memo,cat,loc});}
  else{db.items.push({id:uid(),name,qty,min,unit,memo,cat,loc,createdAt:tod(),by:getW()});openCats[cat]=true;}
  saveLocal();closeModal('addItem');renderInv();toast(id?'수정됐습니다':'추가됐습니다','success');
}
function deleteItem(id){if(!confirm('삭제하시겠습니까?'))return;db.items=db.items.filter(x=>x.id!==id);db.txns=(db.txns||[]).filter(x=>x.itemId!==id);saveLocal();renderInv();toast('삭제됐습니다');}
function quickQty(id,d){
  const it=db.items.find(x=>x.id===id);if(!it)return;
  it.qty=Math.max(0,it.qty+d);
  db.txns=db.txns||[];db.txns.push({id:uid(),itemId:id,type:d>0?'in':'out',qty:Math.abs(d),memo:'빠른조정',date:tod(),by:getW()});
  saveLocal();renderInv();
}
function setQtyDirect(id, val){
  const it=db.items.find(x=>x.id===id);if(!it)return;
  const newQty=Math.max(0,parseInt(val)||0);
  const diff=newQty-it.qty;
  if(diff===0)return;
  it.qty=newQty;
  db.txns=db.txns||[];
  db.txns.push({id:uid(),itemId:id,type:diff>0?'in':'out',qty:Math.abs(diff),memo:'직접입력',date:tod(),by:getW()});
  saveLocal();renderInv();
}
function openTxn(id){
  const it=db.items.find(x=>x.id===id);if(!it)return;
  document.getElementById('txn_itemId').value=id;document.getElementById('txnTitle').textContent=it.name+' 입출고';
  document.getElementById('txn_qty').value='';document.getElementById('txn_memo').value='';document.getElementById('txn_type').value='';
  document.getElementById('txnInBtn').style.fontWeight='400';document.getElementById('txnOutBtn').style.fontWeight='400';
  openModal('txn');
}
function setTxnType(t){document.getElementById('txn_type').value=t;document.getElementById('txnInBtn').style.fontWeight=t==='in'?'700':'400';document.getElementById('txnOutBtn').style.fontWeight=t==='out'?'700':'400';}
function saveTxn(){
  const id=document.getElementById('txn_itemId').value,type=document.getElementById('txn_type').value;
  const qty=parseInt(document.getElementById('txn_qty').value)||0,memo=document.getElementById('txn_memo').value.trim();
  if(!type){toast('입고/출고를 선택해 주세요','error');return;}
  if(!qty||qty<1){toast('수량을 입력해 주세요','error');return;}
  const it=db.items.find(x=>x.id===id);if(!it)return;
  if(type==='out'&&it.qty<qty){toast('재고 부족 (현재: '+it.qty+')','error');return;}
  it.qty=type==='in'?it.qty+qty:it.qty-qty;
  db.txns=db.txns||[];db.txns.push({id:uid(),itemId:id,type,qty,memo,date:tod(),by:getW()});
  saveLocal();closeModal('txn');renderInv();toast((type==='in'?'입고 ':'출고 ')+qty+(it.unit||'개')+' 처리됐습니다','success');
}

// ── 업무일지 ──
function setJrnType(t){
  curJrnType=t;
  document.getElementById('jrnTypeHosp').style.background=t==='hospital'?'var(--red-light)':'';
  document.getElementById('jrnTypeHosp').style.color=t==='hospital'?'var(--red)':'';
  document.getElementById('jrnTypeHosp').style.fontWeight=t==='hospital'?'700':'400';
  document.getElementById('jrnTypeUniv').style.background=t==='univ'?'var(--teal-light)':'';
  document.getElementById('jrnTypeUniv').style.color=t==='univ'?'var(--teal)':'';
  document.getElementById('jrnTypeUniv').style.fontWeight=t==='univ'?'700':'400';
  const places=t==='hospital'?db.hospitals:db.univs;
  document.getElementById('jrn_place').innerHTML=places.map(p=>`<option value="${p}">${p}</option>`).join('');
  document.getElementById('jrn_type').value=t;
}
function openAddJournal(editId){
  const j=editId?db.journals.find(x=>x.id===editId):null;
  document.getElementById('jrn_id').value=j?j.id:'';document.getElementById('addJrnTitle').textContent=j?'업무일지 수정':'업무일지 작성';
  document.getElementById('jrn_date').value=j?j.date:tod();document.getElementById('jrn_content').value=j?j.content:'';
  setJrnType(j?j.placeType||'hospital':'hospital');if(j)document.getElementById('jrn_place').value=j.place;
  openModal('addJournal');
}
function saveJournal(){
  const id=document.getElementById('jrn_id').value,date=document.getElementById('jrn_date').value;
  const place=document.getElementById('jrn_place').value,placeType=document.getElementById('jrn_type').value||'hospital';
  const content=document.getElementById('jrn_content').value.trim();
  if(!date||!place||!content){toast('날짜, 장소, 내용은 필수입니다','error');return;}
  if(id){const j=db.journals.find(x=>x.id===id);if(j)Object.assign(j,{date,place,placeType,content});}
  else db.journals.push({id:uid(),date,place,placeType,content,createdAt:new Date().toISOString(),by:getW()});
  saveLocal();closeModal('addJournal');renderJournal();toast('저장됐습니다','success');
}
function deleteJournal(id){if(!confirm('삭제하시겠습니까?'))return;db.journals=db.journals.filter(x=>x.id!==id);saveLocal();renderJournal();toast('삭제됐습니다');}
function renderJournal(){
  const filters=['전체',...db.hospitals.map(h=>({l:h,t:'hosp'})),...db.univs.map(u=>({l:u,t:'univ'}))];
  document.getElementById('placeTabs').innerHTML=filters.map((f,i)=>{
    const label=i===0?'전체':f.l,type=i===0?'':f.t,isA=curJF===label;
    return `<div class="filter-chip${isA?' active':''} ${type}" onclick="setJF('${label}')">${label}</div>`;
  }).join('');
  let list=[...db.journals].sort((a,b)=>b.date.localeCompare(a.date));
  if(curJF!=='전체')list=list.filter(j=>j.place===curJF);
  if(!list.length){document.getElementById('journalList').innerHTML='<div class="empty"><div class="empty-icon">📝</div><div>업무일지가 없어요<br>+ 버튼으로 오늘 업무를 기록해 보세요</div></div>';return;}
  const grouped={};list.forEach(j=>{(grouped[j.date]=grouped[j.date]||[]).push(j);});
  document.getElementById('journalList').innerHTML=Object.entries(grouped).map(([date,items])=>`
    <div class="journal-date-group">${date}</div>
    ${items.map(j=>`<div class="journal-card">
      <div class="journal-card-head">
        <span class="journal-place ${j.placeType||'hospital'}">${j.place}</span>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:11px;color:var(--text3)">${j.by||''}</span>
          <button class="btn btn-xs" onclick="openAddJournal('${j.id}')">수정</button>
          <button class="btn btn-xs btn-outline-red" onclick="deleteJournal('${j.id}')">삭제</button>
        </div>
      </div>
      <div class="journal-content">${j.content}</div>
    </div>`).join('')}`).join('');
}
function setJF(f){curJF=f;renderJournal();}

// ── 일정 ──
const catColor={점검:'var(--red)',교육:'var(--primary)',회의:'var(--green)',공사:'var(--amber)',기타:'var(--purple)'};
function renderCalendar(){
  renderDdayBanner();
  renderMonthSchedule();
  document.getElementById('calMonth').textContent=`${calYear}년 ${calMonth+1}월`;
  const first=new Date(calYear,calMonth,1).getDay(),last=new Date(calYear,calMonth+1,0).getDate();
  const schMap={};db.schedules.forEach(s=>{(schMap[s.date]=schMap[s.date]||[]).push(s);});
  const dows=['일','월','화','수','목','금','토'];
  let h=dows.map(d=>`<div class="cal-dow">${d}</div>`).join('');
  const pl=new Date(calYear,calMonth,0).getDate();
  for(let i=first-1;i>=0;i--)h+=`<div class="cal-day other-month"><span class="cal-num">${pl-i}</span></div>`;
  for(let d=1;d<=last;d++){
    const ds=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isT=ds===tod(),isSel=ds===selDate,dow=(first+d-1)%7,dots=schMap[ds]||[];
    h+=`<div class="cal-day${isT?' today':''}${isSel?' selected':''} ${dow===0?'sun':dow===6?'sat':''}" onclick="selectDate('${ds}')">
      <span class="cal-num">${d}</span>
      <div class="cal-dots">${dots.slice(0,3).map(s=>`<div class="cal-dot" style="background:${catColor[s.cat]||'var(--gray)'}"></div>`).join('')}</div>
    </div>`;
  }
  const rem=(7-(first+last)%7)%7;for(let i=1;i<=rem;i++)h+=`<div class="cal-day other-month"><span class="cal-num">${i}</span></div>`;
  document.getElementById('calGrid').innerHTML=h;
}
function selectDate(d){selDate=d;renderCalendar();renderScheduleList();}
function moveMonth(d){calMonth+=d;if(calMonth<0){calMonth=11;calYear--;}if(calMonth>11){calMonth=0;calYear++;}renderCalendar();renderMonthSchedule();}
function renderScheduleList(){
  renderDdayBanner();
  document.getElementById('selectedDateLabel').textContent=selDate?`${selDate} 일정`:'일정';
  const list=db.schedules.filter(s=>!selDate||s.date===selDate).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  if(!list.length){document.getElementById('scheduleList').innerHTML='<div class="empty" style="padding:24px"><div>이 날 일정이 없어요</div></div>';return;}
  document.getElementById('scheduleList').innerHTML=list.map(s=>`
    <div class="sch-item" style="border-left-color:${catColor[s.cat]||'var(--primary)'}">
      <div class="sch-dot" style="background:${catColor[s.cat]||'var(--primary)'}"></div>
      <div style="flex:1;min-width:0">
        <div class="sch-title">${s.title}</div>
        <div class="sch-meta"><span>${s.time||'종일'}</span><span class="badge b-gray">${s.cat||'기타'}</span>${s.memo?`<span>${s.memo}</span>`:''}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:3px">${s.by||''}</div>
      </div>
      <div style="display:flex;gap:4px;flex-direction:column">
        <button class="btn btn-xs" onclick="editSchedule('${s.id}')">수정</button>
        <button class="btn btn-xs btn-outline-red" onclick="deleteSchedule('${s.id}')">삭제</button>
      </div>
    </div>`).join('');
}
function openAddSchedule(){
  document.getElementById('sch_id').value='';document.getElementById('addSchTitle').textContent='일정 추가';
  document.getElementById('sch_title').value='';document.getElementById('sch_date').value=selDate||tod();
  document.getElementById('sch_time').value='';document.getElementById('sch_cat').value='점검';document.getElementById('sch_memo').value='';
  openModal('addSchedule');
}
function editSchedule(id){
  const s=db.schedules.find(x=>x.id===id);if(!s)return;
  document.getElementById('sch_id').value=id;document.getElementById('addSchTitle').textContent='일정 수정';
  document.getElementById('sch_title').value=s.title;document.getElementById('sch_date').value=s.date;
  document.getElementById('sch_time').value=s.time||'';document.getElementById('sch_cat').value=s.cat||'점검';document.getElementById('sch_memo').value=s.memo||'';
  openModal('addSchedule');
}
function saveSchedule(){
  const id=document.getElementById('sch_id').value,title=document.getElementById('sch_title').value.trim();
  const date=document.getElementById('sch_date').value,time=document.getElementById('sch_time').value;
  const cat=document.getElementById('sch_cat').value,memo=document.getElementById('sch_memo').value.trim();
  if(!title||!date){toast('제목과 날짜는 필수입니다','error');return;}
  if(id){const s=db.schedules.find(x=>x.id===id);if(s)Object.assign(s,{title,date,time,cat,memo});}
  else db.schedules.push({id:uid(),title,date,time,cat,memo,by:getW()});
  selDate=date;saveLocal();closeModal('addSchedule');renderCalendar();renderScheduleList();toast('저장됐습니다','success');
}
function deleteSchedule(id){if(!confirm('삭제하시겠습니까?'))return;db.schedules=db.schedules.filter(x=>x.id!==id);saveLocal();renderCalendar();renderScheduleList();toast('삭제됐습니다');}

// ── 메모 ──
function openAddMemo(editId){
  const m=editId?db.memos.find(x=>x.id===editId):null;
  document.getElementById('memo_id').value=m?m.id:'';document.getElementById('addMemoTitle').textContent=m?'메모 수정':'메모 추가';
  document.getElementById('memo_title').value=m?m.title:'';document.getElementById('memo_content').value=m?m.content:'';
  document.getElementById('memo_cat').value=m?m.cat||'일반':'일반';openModal('addMemo');
}
function saveMemo(){
  const id=document.getElementById('memo_id').value,title=document.getElementById('memo_title').value.trim();
  const content=document.getElementById('memo_content').value.trim(),cat=document.getElementById('memo_cat').value;
  if(!title||!content){toast('제목과 내용은 필수입니다','error');return;}
  if(id){const m=db.memos.find(x=>x.id===id);if(m)Object.assign(m,{title,content,cat,updatedAt:tod()});}
  else db.memos.push({id:uid(),title,content,cat,createdAt:tod(),by:getW()});
  saveLocal();closeModal('addMemo');renderMemo();toast('저장됐습니다','success');
}
function deleteMemo(id){if(!confirm('삭제하시겠습니까?'))return;db.memos=db.memos.filter(x=>x.id!==id);saveLocal();renderMemo();toast('삭제됐습니다');}
function renderMemo(){
  const cats=['전체','일반','중요','업무','점검'];
  document.getElementById('memoFilter').innerHTML=cats.map(c=>`<div class="filter-chip${c===curMemoF?' active':''}" onclick="setMemoF('${c}')">${c}</div>`).join('');
  let list=[...db.memos];if(curMemoF!=='전체')list=list.filter(m=>m.cat===curMemoF);
  list.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  if(!list.length){document.getElementById('memoList').innerHTML='<div class="empty"><div class="empty-icon">🗒️</div><div>메모가 없어요<br>+ 버튼으로 추가해 보세요</div></div>';return;}
  document.getElementById('memoList').innerHTML=list.map(m=>`
    <div class="memo-card" style="border-left-color:${memoCatColor[m.cat]||'var(--amber)'}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <div style="font-size:14px;font-weight:700;color:var(--text)">${m.title}</div>
            <span class="badge ${memoBadge[m.cat]||'b-amber'}">${m.cat||'일반'}</span>
          </div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button class="btn btn-xs" onclick="openAddMemo('${m.id}')">수정</button>
          <button class="btn btn-xs btn-outline-red" onclick="deleteMemo('${m.id}')">삭제</button>
        </div>
      </div>
      <div style="font-size:13px;color:var(--text2);line-height:1.7;white-space:pre-line">${m.content}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:6px">${m.by||''} · ${m.updatedAt?'수정 '+m.updatedAt:m.createdAt}</div>
    </div>`).join('');
}
function setMemoF(f){curMemoF=f;renderMemo();}

// ── 설정 ──
function renderSettings(){
  renderMemberList();
  // 단위 관리
  const unitEl=document.getElementById('unitManageList');
  if(unitEl){
    const units=db.units||['EA','개','본','롤','박스','세트','kg','L'];
    unitEl.innerHTML=units.map(u=>`<div style="display:flex;align-items:center;gap:4px"><span class="badge b-primary">${u}</span><button class="btn btn-xs" style="padding:1px 5px;color:var(--text3);border:none;background:none" onclick="removeUnit('${u}')">×</button></div>`).join('');
  }
  // 위치 관리
  const locEl=document.getElementById('locManageList');
  if(locEl){
    const locs=db.locations||[];
    locEl.innerHTML=locs.map(l=>`<div style="display:flex;align-items:center;gap:4px;margin-bottom:4px"><span class="badge b-teal">📍 ${l}</span><button class="btn btn-xs" style="padding:1px 5px;color:var(--text3);border:none;background:none" onclick="removeLoc('${l.replace(/'/g,"\'")}')">×</button></div>`).join('');
  }
  const hospitalEl=document.getElementById('hospitalList');
  const univEl=document.getElementById('univList');
  const catEl=document.getElementById('catManageList');
  if(hospitalEl)hospitalEl.innerHTML=db.hospitals.map(h=>`<div style="display:flex;align-items:center;gap:4px"><span class="badge b-red">${h}</span><button class="btn btn-xs" style="padding:1px 5px;color:var(--text3);border:none;background:none" onclick="removePlace('hospital','${h}')">×</button></div>`).join('');
  if(univEl)univEl.innerHTML=db.univs.map(u=>`<div style="display:flex;align-items:center;gap:4px"><span class="badge b-teal">${u}</span><button class="btn btn-xs" style="padding:1px 5px;color:var(--text3);border:none;background:none" onclick="removePlace('univ','${u}')">×</button></div>`).join('');
  if(catEl)catEl.innerHTML=db.categories.map(c=>`<div style="display:flex;align-items:center;gap:4px"><span class="badge b-gray">${catEmoji[c]||'📦'} ${c}</span><button class="btn btn-xs" style="padding:1px 5px;color:var(--text3);border:none;background:none" onclick="removeCat('${c}')">×</button></div>`).join('');
  updateDarkUI();
}
function addPlace(type){
  const inp=document.getElementById(type==='hospital'?'newHospital':'newUniv');
  const val=inp.value.trim();if(!val)return;
  if(type==='hospital'){if(!db.hospitals.includes(val))db.hospitals.push(val);}
  else{if(!db.univs.includes(val))db.univs.push(val);}
  inp.value='';saveLocal();renderSettings();renderJournal();toast('추가됐습니다','success');
}
function removePlace(type,val){
  if(type==='hospital')db.hospitals=db.hospitals.filter(x=>x!==val);
  else db.univs=db.univs.filter(x=>x!==val);
  saveLocal();renderSettings();renderJournal();
}
function addCategory(){
  const val=document.getElementById('newCat').value.trim();if(!val)return;
  if(!db.categories.includes(val))db.categories.push(val);
  document.getElementById('newCat').value='';saveLocal();renderSettings();renderInv();toast('추가됐습니다','success');
}
function removeCat(val){db.categories=db.categories.filter(x=>x!==val);saveLocal();renderSettings();renderInv();}

// ── 모달 ──
function openModal(name){document.getElementById('modal-'+name).classList.add('open');}
function closeModal(name){document.getElementById('modal-'+name).classList.remove('open');}
// 모달 바깥 클릭으로 닫히지 않도록 고정

// ── 데이터 ──
function exportData(){
  const a=document.createElement('a');
  a.href='data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(db,null,2));
  a.download='소방업무공유_백업_'+tod()+'.json';a.click();
}
function importClick(){document.getElementById('importFile').click();}
function doImport(e){
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=ev=>{try{db=Object.assign(db,JSON.parse(ev.target.result));saveLocal();renderAll();toast('복원됐습니다','success');}catch{toast('파일 형식이 올바르지 않습니다','error');}};
  r.readAsText(f);
}


// ── 단위 팝업 ──
function openUnitPicker(){
  const units=db.units||['EA','개','본','롤','박스','세트','kg','L'];
  const cur=document.getElementById('item_unit').value||'EA';
  document.getElementById('unitPickerList').innerHTML=units.map(u=>`
    <button onclick="selectUnit('${u}')" style="padding:10px 18px;border-radius:20px;border:2px solid ${u===cur?'var(--primary)':'var(--border2)'};background:${u===cur?'var(--primary)':'var(--surface)'};color:${u===cur?'#fff':'var(--text2)'};font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">${u}</button>
  `).join('');
  document.getElementById('newUnitInput').value='';
  openModal('unitPicker');
}
function selectUnit(u){
  document.getElementById('item_unit').value=u;
  document.getElementById('item_unit_btn').textContent=u+' ▾';
  closeModal('unitPicker');
}
function addUnitAndSelect(){
  const val=document.getElementById('newUnitInput').value.trim();
  if(!val){toast('단위를 입력해 주세요','error');return;}
  db.units=db.units||['EA','개','본','롤','박스','세트','kg','L'];
  if(!db.units.includes(val))db.units.push(val);
  saveLocal();selectUnit(val);
}

// ── 보관위치 팝업 ──
function openLocPicker(){
  const locs=db.locations||[];
  const cur=document.getElementById('item_loc').value||'';
  document.getElementById('locPickerList').innerHTML=`
    <button onclick="selectLoc('')" style="width:100%;padding:12px;border-radius:var(--radius-sm);border:2px solid ${cur===''?'var(--primary)':'var(--border2)'};background:${cur===''?'var(--primary)':'var(--surface)'};color:${cur===''?'#fff':'var(--text2)'};font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;text-align:left;margin-bottom:6px">선택 안함</button>
    ${locs.map(l=>`<button onclick="selectLoc('${l.replace(/'/g,"\'")}')" style="width:100%;padding:12px;border-radius:var(--radius-sm);border:2px solid ${l===cur?'var(--primary)':'var(--border2)'};background:${l===cur?'var(--primary)':'var(--surface)'};color:${l===cur?'#fff':'var(--text2)'};font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;text-align:left;margin-bottom:6px">📍 ${l}</button>`).join('')}`;
  openModal('locPicker');
}
function selectLoc(l){
  document.getElementById('item_loc').value=l;
  document.getElementById('item_loc_btn').textContent=(l||'선택 안함')+' ▾';
  closeModal('locPicker');
}

// ── 단위/위치 설정 관리 ──
function addUnitSetting(){
  const val=document.getElementById('newUnitSetting').value.trim();if(!val)return;
  db.units=db.units||['EA','개','본','롤','박스','세트','kg','L'];
  if(!db.units.includes(val))db.units.push(val);
  document.getElementById('newUnitSetting').value='';saveLocal();renderSettings();toast('추가됐습니다','success');
}
function removeUnit(val){
  db.units=(db.units||[]).filter(x=>x!==val);saveLocal();renderSettings();
}
function addLocSetting(){
  const val=document.getElementById('newLocSetting').value.trim();if(!val)return;
  db.locations=db.locations||[];
  if(!db.locations.includes(val))db.locations.push(val);
  document.getElementById('newLocSetting').value='';saveLocal();renderSettings();toast('추가됐습니다','success');
}
function removeLoc(val){
  db.locations=(db.locations||[]).filter(x=>x!==val);saveLocal();renderSettings();
}


// ── 일괄 입고 ──
let bulkInSelected = {}; // {itemId: qty}

function openBulkIn(){
  bulkInSelected = {};
  document.getElementById('bulkInDate').value = tod();
  document.getElementById('bulkInMemo').value = '';
  document.getElementById('bulkInSearch').value = '';
  document.getElementById('bulkInSearchResult').style.display = 'none';
  document.getElementById('bulkInSearchResult').innerHTML = '';
  renderBulkInSelected();
  openModal('bulkIn');
}

function filterBulkInList(){
  const q = document.getElementById('bulkInSearch').value.trim();
  const resultEl = document.getElementById('bulkInSearchResult');
  if(!q){ resultEl.style.display='none'; resultEl.innerHTML=''; return; }
  const items = db.items.filter(it =>
    it.name.toLowerCase().includes(q.toLowerCase()) ||
    (it.cat||'').toLowerCase().includes(q.toLowerCase())
  );
  if(!items.length){
    resultEl.style.display='block';
    resultEl.innerHTML='<div style="padding:12px;text-align:center;color:var(--text3);font-size:13px">검색 결과가 없어요</div>';
    return;
  }
  resultEl.style.display='block';
  resultEl.innerHTML = items.map(it => {
    const already = bulkInSelected[it.id] !== undefined;
    return `<div onclick="addBulkInItem('${it.id}')" style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);background:${already?'var(--green-light)':'var(--surface)'};transition:background .1s">
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">${it.name}</div>
        <div style="font-size:11px;color:var(--text3)">${it.cat||''} · 현재 ${it.qty}${it.unit||'개'}</div>
      </div>
      <span style="font-size:12px;color:${already?'var(--green)':'var(--primary)'};font-weight:600">${already?'✓ 추가됨':'+ 추가'}</span>
    </div>`;
  }).join('');
}

function addBulkInItem(id){
  if(bulkInSelected[id] !== undefined){ toast('이미 추가된 품목이에요'); return; }
  bulkInSelected[id] = 1;
  document.getElementById('bulkInSearch').value = '';
  document.getElementById('bulkInSearchResult').style.display = 'none';
  document.getElementById('bulkInSearchResult').innerHTML = '';
  renderBulkInSelected();
}

function renderBulkInSelected(){
  const wrap = document.getElementById('bulkInSelectedWrap');
  const list = document.getElementById('bulkInSelectedList');
  const cnt = document.getElementById('bulkInSelectedCount');
  const entries = Object.entries(bulkInSelected);
  if(!entries.length){ wrap.style.display='none'; return; }
  wrap.style.display='block';
  cnt.textContent = `(${entries.length}개)`;
  list.innerHTML = entries.map(([id, qty])=>{
    const it = db.items.find(x=>x.id===id); if(!it) return '';
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border-radius:var(--radius-sm);margin-bottom:6px">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--text)">${it.name}</div>
        <div style="font-size:11px;color:var(--text3)">현재 ${it.qty}${it.unit||'개'} → 입고 후 <span id="bulkInAfter_${it.id}" style="color:var(--green);font-weight:700">${it.qty + qty}${it.unit||'개'}</span></div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
        <button onclick="changeBulkInQty('${it.id}',-1)" style="width:28px;height:28px;border-radius:50%;border:1.5px solid var(--border2);background:var(--surface);font-size:16px;cursor:pointer;color:var(--red)">−</button>
        <input type="number" min="1" value="${qty}" id="bulkInQty_${it.id}"
          style="width:56px;padding:5px 4px;border:1.5px solid var(--border2);border-radius:var(--radius-sm);font-size:14px;font-weight:700;text-align:center;background:var(--surface);color:var(--text);font-family:monospace"
          oninput="bulkInSelected['${it.id}']=Math.max(1,parseInt(this.value)||1);updateBulkInAfter('${it.id}',${it.qty})">
        <button onclick="changeBulkInQty('${it.id}',1)" style="width:28px;height:28px;border-radius:50%;border:1.5px solid var(--border2);background:var(--surface);font-size:16px;cursor:pointer;color:var(--green)">＋</button>
        <span style="font-size:12px;color:var(--text3)">${it.unit||'개'}</span>
        <button onclick="removeBulkInItem('${it.id}')" style="width:26px;height:26px;border-radius:50%;border:none;background:var(--red-light);color:var(--red);font-size:14px;cursor:pointer">×</button>
      </div>
    </div>`;
  }).join('');
}

function changeBulkInQty(id, d){
  const it = db.items.find(x=>x.id===id); if(!it) return;
  const cur = bulkInSelected[id]||1;
  const next = Math.max(1, cur+d);
  bulkInSelected[id] = next;
  const input = document.getElementById('bulkInQty_'+id);
  if(input) input.value = next;
  updateBulkInAfter(id, it.qty);
}
function updateBulkInAfter(id, curQty){
  const qty = bulkInSelected[id]||1;
  const el = document.getElementById('bulkInAfter_'+id);
  if(el){ const it=db.items.find(x=>x.id===id); el.textContent=(curQty+qty)+(it?it.unit||'개':'개'); }
}
function removeBulkInItem(id){
  delete bulkInSelected[id];
  renderBulkInSelected();
}

function saveBulkIn(){
  const date = document.getElementById('bulkInDate').value;
  const memo = document.getElementById('bulkInMemo').value.trim();
  if(!date){ toast('입고일을 선택해 주세요','error'); return; }
  const entries = Object.entries(bulkInSelected).filter(([,qty])=>qty>0);
  if(!entries.length){ toast('품목을 검색해서 추가해 주세요','error'); return; }
  entries.forEach(([id,qty])=>{
    const it=db.items.find(x=>x.id===id); if(!it) return;
    it.qty += qty;
    db.txns=db.txns||[];
    db.txns.push({id:uid(),itemId:id,type:'in',qty,memo:memo||'입고등록',date,by:getW()});
  });
  saveLocal(); closeModal('bulkIn'); renderInv();
  toast(`${entries.length}개 품목 입고 등록됐습니다`,'success');
  bulkInSelected={};
}

// ── 일괄 사용 (출고) ──
let bulkUseSelected = {}; // {itemId: qty}

function openBulkUse(){
  bulkUseSelected = {};
  document.getElementById('bulkUseDate').value = tod();
  document.getElementById('bulkUseMemo').value = '';
  document.getElementById('bulkUseSearch').value = '';
  document.getElementById('bulkUseSearchResult').style.display = 'none';
  document.getElementById('bulkUseSearchResult').innerHTML = '';
  renderBulkUseSelected();
  openModal('bulkUse');
}

function filterBulkUseList(){
  const q = document.getElementById('bulkUseSearch').value.trim();
  const resultEl = document.getElementById('bulkUseSearchResult');
  if(!q){ resultEl.style.display='none'; resultEl.innerHTML=''; return; }
  const items = db.items.filter(it =>
    it.name.toLowerCase().includes(q.toLowerCase()) ||
    (it.cat||'').toLowerCase().includes(q.toLowerCase())
  );
  if(!items.length){
    resultEl.style.display='block';
    resultEl.innerHTML='<div style="padding:12px;text-align:center;color:var(--text3);font-size:13px">검색 결과가 없어요</div>';
    return;
  }
  resultEl.style.display='block';
  resultEl.innerHTML = items.map(it => {
    const already = bulkUseSelected[it.id] !== undefined;
    const noStock = it.qty <= 0;
    return `<div onclick="${noStock?'toast("재고가 없어요","error")':('addBulkUseItem("'+it.id+'")')}" style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);background:${already?'var(--primary-light)':noStock?'var(--red-light)':'var(--surface)'};transition:background .1s">
      <div>
        <div style="font-size:13px;font-weight:700;color:${noStock?'var(--red)':'var(--text)'}">${it.name}</div>
        <div style="font-size:11px;color:var(--text3)">${it.cat||''} · 재고 ${it.qty}${it.unit||'개'}${noStock?' ⚠ 재고없음':''}</div>
      </div>
      <span style="font-size:12px;color:${already?'var(--primary)':noStock?'var(--red)':'var(--primary)'};font-weight:600">${already?'✓ 추가됨':noStock?'재고없음':'+ 추가'}</span>
    </div>`;
  }).join('');
}

function addBulkUseItem(id){
  if(bulkUseSelected[id] !== undefined){ toast('이미 추가된 품목이에요'); return; }
  bulkUseSelected[id] = 1;
  document.getElementById('bulkUseSearch').value = '';
  document.getElementById('bulkUseSearchResult').style.display = 'none';
  document.getElementById('bulkUseSearchResult').innerHTML = '';
  renderBulkUseSelected();
}

function renderBulkUseSelected(){
  const wrap = document.getElementById('bulkUseSelectedWrap');
  const list = document.getElementById('bulkUseSelectedList');
  const cnt = document.getElementById('bulkUseSelectedCount');
  const entries = Object.entries(bulkUseSelected);
  if(!entries.length){ wrap.style.display='none'; return; }
  wrap.style.display='block';
  cnt.textContent = `(${entries.length}개)`;
  list.innerHTML = entries.map(([id,qty])=>{
    const it = db.items.find(x=>x.id===id); if(!it) return '';
    const after = it.qty - qty;
    const isShort = after < 0;
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border-radius:var(--radius-sm);margin-bottom:6px;border:1.5px solid ${isShort?'var(--red)':'transparent'}">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--text)">${it.name}</div>
        <div style="font-size:11px;color:var(--text3)">재고 ${it.qty}${it.unit||'개'} → 사용 후 <span id="bulkUseAfter_${it.id}" style="color:${isShort?'var(--red)':'var(--primary)'};font-weight:700">${after}${it.unit||'개'}${isShort?' ⚠부족':''}</span></div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
        <button onclick="changeBulkUseQty('${it.id}',-1)" style="width:28px;height:28px;border-radius:50%;border:1.5px solid var(--border2);background:var(--surface);font-size:16px;cursor:pointer;color:var(--red)">−</button>
        <input type="number" min="1" value="${qty}" id="bulkUseQty_${it.id}"
          style="width:56px;padding:5px 4px;border:1.5px solid var(--border2);border-radius:var(--radius-sm);font-size:14px;font-weight:700;text-align:center;background:var(--surface);color:var(--text);font-family:monospace"
          oninput="bulkUseSelected['${it.id}']=Math.max(1,parseInt(this.value)||1);updateBulkUseAfter('${it.id}',${it.qty})">
        <button onclick="changeBulkUseQty('${it.id}',1)" style="width:28px;height:28px;border-radius:50%;border:1.5px solid var(--border2);background:var(--surface);font-size:16px;cursor:pointer;color:var(--green)">＋</button>
        <span style="font-size:12px;color:var(--text3)">${it.unit||'개'}</span>
        <button onclick="removeBulkUseItem('${it.id}')" style="width:26px;height:26px;border-radius:50%;border:none;background:var(--red-light);color:var(--red);font-size:14px;cursor:pointer">×</button>
      </div>
    </div>`;
  }).join('');
}

function changeBulkUseQty(id, d){
  const it = db.items.find(x=>x.id===id); if(!it) return;
  const cur = bulkUseSelected[id]||1;
  const next = Math.max(1, cur+d);
  bulkUseSelected[id] = next;
  const input = document.getElementById('bulkUseQty_'+id);
  if(input) input.value = next;
  updateBulkUseAfter(id, it.qty);
}
function updateBulkUseAfter(id, curQty){
  const qty = bulkUseSelected[id]||1;
  const el = document.getElementById('bulkUseAfter_'+id);
  if(el){
    const it=db.items.find(x=>x.id===id);
    const after=curQty-qty;
    el.textContent=after+(it?it.unit||'개':'개')+(after<0?' ⚠부족':'');
    el.style.color=after<0?'var(--red)':'var(--primary)';
  }
}
function removeBulkUseItem(id){
  delete bulkUseSelected[id];
  renderBulkUseSelected();
}

function saveBulkUse(){
  const date = document.getElementById('bulkUseDate').value;
  const memo = document.getElementById('bulkUseMemo').value.trim();
  if(!date){ toast('사용일을 선택해 주세요','error'); return; }
  const entries = Object.entries(bulkUseSelected).filter(([,qty])=>qty>0);
  if(!entries.length){ toast('품목을 검색해서 추가해 주세요','error'); return; }
  // 재고 부족 체크
  for(const [id,qty] of entries){
    const it=db.items.find(x=>x.id===id); if(!it) continue;
    if(it.qty<qty){ toast(`${it.name} 재고 부족 (현재: ${it.qty}${it.unit||'개'})`,'error'); return; }
  }
  entries.forEach(([id,qty])=>{
    const it=db.items.find(x=>x.id===id); if(!it) return;
    it.qty -= qty;
    db.txns=db.txns||[];
    db.txns.push({id:uid(),itemId:id,type:'out',qty,memo:memo||'사용등록',date,by:getW()});
  });
  saveLocal(); closeModal('bulkUse'); renderInv();
  toast(`${entries.length}개 품목 사용 등록됐습니다`,'success');
  bulkUseSelected={};
}

// ── 재고 부족 배너 ──
function renderLowStockBanner(){
  const el = document.getElementById('lowStockBanner');
  if(!el) return;
  const lowItems = db.items.filter(it => it.min > 0 && it.qty <= it.min);
  if(!lowItems.length){ el.innerHTML=''; return; }
  el.innerHTML = `
    <div style="background:var(--red-light);border:1.5px solid var(--red-border);border-radius:var(--radius-sm);padding:12px 14px;margin-bottom:12px">
      <div style="font-size:13px;font-weight:700;color:var(--red);margin-bottom:8px">⚠️ 재고 부족 품목 ${lowItems.length}개</div>
      ${lowItems.map(it=>`
        <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--red-border);font-size:12px">
          <span style="color:var(--text2);font-weight:600">${it.name}</span>
          <span style="color:var(--red);font-weight:700">${it.qty}${it.unit||'개'} / 최소 ${it.min}${it.unit||'개'}</span>
        </div>`).join('')}
    </div>`;
}

// ── D-day 배너 ──
function renderDdayBanner(){
  const el = document.getElementById('ddayBanner');
  if(!el) return;
  const todStr = tod();
  const upcoming = db.schedules
    .filter(s => s.date >= todStr)
    .sort((a,b) => a.date.localeCompare(b.date));
  const ongoing = upcoming.find(s => s.date === todStr);
  const next = upcoming.find(s => s.date > todStr);
  const target = ongoing || next;
  if(!target){ el.innerHTML=''; return; }
  const diff = Math.ceil((new Date(target.date) - new Date(todStr)) / 86400000);
  const isToday = diff === 0;
  const isUrgent = diff <= 7;
  const bg = isToday ? 'var(--red-light)' : isUrgent ? 'var(--amber-light)' : 'var(--primary-light)';
  const border = isToday ? 'var(--red-border)' : isUrgent ? 'var(--amber-border)' : 'var(--primary-border)';
  const color = isToday ? 'var(--red)' : isUrgent ? 'var(--amber)' : 'var(--primary)';
  const label = isToday ? '📅 오늘 일정' : `📅 D-${diff}`;
  el.innerHTML = `
    <div style="background:${bg};border:1.5px solid ${border};border-radius:var(--radius-sm);padding:12px 16px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;cursor:pointer" onclick="selectDate('${target.date}')">
      <div>
        <div style="font-size:12px;font-weight:700;color:${color};margin-bottom:3px">${label}</div>
        <div style="font-size:14px;font-weight:700;color:var(--text)">${target.title}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">${target.date} ${target.time||''} · ${target.cat||'기타'}</div>
      </div>
      <div style="font-size:26px;font-weight:800;font-family:monospace;color:${color}">${isToday?'TODAY':'D-'+diff}</div>
    </div>`;
}

// ── 입출고 이력 ──
function getFYOptions(){
  // 회계연도: 3/1 ~ 다음해 2/28. 현재 회계연도 계산
  const now = new Date();
  const curFY = now.getMonth() >= 2 ? now.getFullYear() : now.getFullYear()-1;
  const options = [];
  for(let y=curFY; y>=curFY-3; y--){
    options.push({label:`${y}년도 (${y}.03.01 ~ ${y+1}.02.28)`, start:`${y}-03-01`, end:`${y+1}-02-28`});
  }
  return options;
}
function renderTxnHistory(){
  // 회계연도 셀렉트 초기화
  const fyEl = document.getElementById('histFilterFY');
  if(fyEl && fyEl.options.length <= 1){
    getFYOptions().forEach((fy,i)=>{
      const opt = document.createElement('option');
      opt.value = JSON.stringify({start:fy.start,end:fy.end});
      opt.textContent = fy.label;
      if(i===0) opt.selected=true;
      fyEl.appendChild(opt);
    });
  }

  const typeF = document.getElementById('histFilterType')?.value||'';
  const itemF = document.getElementById('histFilterItem')?.value||'';
  const dateF = document.getElementById('histFilterDate')?.value||'';
  const fyVal = document.getElementById('histFilterFY')?.value||'';

  // 품목 필터 옵션 채우기
  const sel = document.getElementById('histFilterItem');
  if(sel && sel.options.length <= 1){
    db.items.forEach(it=>{
      const opt = document.createElement('option');
      opt.value = it.id; opt.textContent = it.name;
      sel.appendChild(opt);
    });
  }

  let txns = [...(db.txns||[])];

  // 회계연도 필터
  if(fyVal){
    try{
      const {start,end} = JSON.parse(fyVal);
      txns = txns.filter(t=>t.date>=start && t.date<=end);
    }catch{}
  }

  if(typeF) txns = txns.filter(t=>t.type===typeF);
  if(itemF) txns = txns.filter(t=>t.itemId===itemF);
  if(dateF) txns = txns.filter(t=>t.date===dateF);
  txns.sort((a,b)=>(b.date||'').localeCompare(a.date||'')||b.id.localeCompare(a.id));

  const el = document.getElementById('txnHistoryList');
  if(!el) return;
  if(!txns.length){
    el.innerHTML='<div class="empty"><div class="empty-icon">🗂️</div><div>이력이 없어요</div></div>';
    return;
  }

  // 날짜별 그룹
  const grouped = {};
  txns.forEach(t=>{ (grouped[t.date||'날짜없음']=grouped[t.date||'날짜없음']||[]).push(t); });

  // 회계연도 요약
  const inTotal = txns.filter(t=>t.type==='in').reduce((s,t)=>s+t.qty,0);
  const outTotal = txns.filter(t=>t.type==='out').reduce((s,t)=>s+t.qty,0);
  const summaryEl = document.getElementById('txnHistorySummary');
  if(summaryEl && txns.length){
    summaryEl.innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
      <div style="background:var(--green-light);border:1px solid var(--green-border);border-radius:var(--radius-sm);padding:10px;text-align:center">
        <div style="font-size:11px;color:var(--green);font-weight:600">📥 총 입고</div>
        <div style="font-size:20px;font-weight:700;color:var(--green);font-family:monospace">${inTotal}건</div>
      </div>
      <div style="background:var(--red-light);border:1px solid var(--red-border);border-radius:var(--radius-sm);padding:10px;text-align:center">
        <div style="font-size:11px;color:var(--red);font-weight:600">📤 총 사용</div>
        <div style="font-size:20px;font-weight:700;color:var(--red);font-family:monospace">${outTotal}건</div>
      </div>
    </div>`;
  } else if(summaryEl){ summaryEl.innerHTML=''; }

  el.innerHTML = Object.entries(grouped).map(([date, list])=>`
    <div style="font-size:12px;font-weight:700;color:var(--text3);padding:8px 0 4px;border-bottom:1px solid var(--border);margin-bottom:8px">${date}</div>
    ${list.map(t=>{
      const it = db.items.find(x=>x.id===t.itemId);
      const isIn = t.type==='in';
      return `<div style="background:var(--surface);border-radius:var(--radius-sm);box-shadow:var(--shadow);padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:10px;border-left:3px solid ${isIn?'var(--green)':'var(--red)'}">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;color:var(--text)">${it?it.name:'삭제된 품목'}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:3px">${t.memo||''} ${t.by?'· '+t.by:''}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:16px;font-weight:700;color:${isIn?'var(--green)':'var(--red)'};font-family:monospace">${isIn?'+':'-'}${t.qty}${it?it.unit||'개':'개'}</div>
          <div class="badge ${isIn?'b-green':'b-red'}" style="margin-top:3px">${isIn?'📥 입고':'📤 사용'}</div>
        </div>
      </div>`;
    }).join('')}
  `).join('');
}


// ── 메인보드 ──
function renderHome(){
  var todStr = tod();
  var hour = new Date().getHours();
  var greet = hour<12?'좋은 아침이에요 ☀️':hour<18?'안녕하세요 😊':'수고하셨어요 🌙';
  var greetEl = document.getElementById('homeGreeting');
  if(greetEl){
    greetEl.innerHTML = '<div style="background:var(--primary);border-radius:var(--radius);padding:14px 20px;color:#fff;display:flex;align-items:center;justify-content:space-between">'
      + '<div><div style="font-size:12px;opacity:.85;margin-bottom:3px">'+greet+'</div>'
      + '<div style="font-size:17px;font-weight:700">'+(userName||'팀원')+'님 👋</div></div>'
      + '<div style="font-size:13px;opacity:.75;text-align:right"><div>'+todStr+'</div>'
      + '<div style="margin-top:3px;font-size:11px">소방업무공유</div></div></div>';
  }

  // 권한 있는 탭만 카드 표시
  var tabs = isAdmin ? ALL_TABS.map(function(t){return t.id;}) : myTabs;

  // 오늘·예정 일정 (일정 탭 권한 있을 때만)
  var schWrap = document.getElementById('homeScheduleWrap');
  var schEl = document.getElementById('homeSchedule');
  if(schWrap) schWrap.style.display = (tabs.includes('schedule')||isAdmin) ? '' : 'none';
  if(schEl && (tabs.includes('schedule')||isAdmin)){
    var upcoming = db.schedules.filter(function(s){return s.date>=todStr;})
      .sort(function(a,b){return a.date.localeCompare(b.date);}).slice(0,5);
    if(!upcoming.length){
      schEl.innerHTML='<div style="text-align:center;padding:12px;color:var(--text3);font-size:13px">예정된 일정이 없어요</div>';
    } else {
      var sh='';
      upcoming.forEach(function(s){
        var diff=Math.ceil((new Date(s.date)-new Date(todStr))/86400000);
        var isT=diff===0;
        var col=isT?'var(--red)':diff<=3?'var(--amber)':'var(--primary)';
        sh+='<div style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid var(--border);cursor:pointer" onclick="switchPage(\'schedule\')">'
          +'<div style="min-width:44px;text-align:center;font-size:12px;font-weight:800;color:'+col+';font-family:monospace">'+(isT?'TODAY':'D-'+diff)+'</div>'
          +'<div style="flex:1;min-width:0">'
          +'<div style="font-size:13px;font-weight:700;color:var(--text)">'+s.title+'</div>'
          +'<div style="font-size:11px;color:var(--text3)">'+s.date+(s.time?' '+s.time:'')+' · '+(s.cat||'기타')+'</div>'
          +'</div></div>';
      });
      schEl.innerHTML=sh;
    }
  }

  // 부족 품목 (재고 탭 권한 있을 때만)
  var lowWrap = document.getElementById('homeLowStockWrap');
  var lowEl = document.getElementById('homeLowStock');
  if(lowWrap) lowWrap.style.display = (tabs.includes('inv')||isAdmin) ? '' : 'none';
  if(lowEl && (tabs.includes('inv')||isAdmin)){
    var lows = db.items.filter(function(it){return it.min>0&&it.qty<=it.min;});
    if(!lows.length){
      lowEl.innerHTML='<div style="text-align:center;padding:12px;color:var(--green);font-size:13px">✓ 모든 품목 재고 정상</div>';
    } else {
      var lh='';
      lows.forEach(function(it){
        lh+='<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 4px;border-bottom:1px solid var(--border);font-size:12px">'
          +'<span style="color:var(--text);font-weight:600">'+it.name+'</span>'
          +'<span style="color:var(--red);font-weight:700">'+it.qty+(it.unit||'개')+' / 최소 '+it.min+(it.unit||'개')+'</span>'
          +'</div>';
      });
      lowEl.innerHTML=lh;
    }
  }

  // 점검 현황 (종합관 또는 서미감관 권한 있을 때만)
  var inspWrap = document.getElementById('homeInspectionWrap');
  var inspEl = document.getElementById('homeInspection');
  var hasInspTab = tabs.includes('jongham')||tabs.includes('seomigam')||isAdmin;
  if(inspWrap) inspWrap.style.display = hasInspTab ? '' : 'none';
  if(inspEl && hasInspTab){
    var curFY2 = getCurrentFY();
    var ih='';
    var bldKeys = [];
    if(tabs.includes('jongham')||isAdmin) bldKeys.push('jongham');
    if(tabs.includes('seomigam')||isAdmin) bldKeys.push('seomigam');
    bldKeys.forEach(function(bldKey){
      var cfg2 = BLD_CONFIG[bldKey];
      var bldInsps = (db.inspections||[]).filter(function(x){return x.bld===bldKey&&x.fy===curFY2;});
      ih+='<div style="padding:8px 4px;border-bottom:1px solid var(--border)">';
      ih+='<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:6px">'+cfg2.icon+' '+cfg2.name+'</div>';
      if(bldInsps.length){
        bldInsps.forEach(function(insp){
          ih+='<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px">';
          ih+='<span class="badge b-gray">'+insp.type+'점검</span>';
          ih+='<span style="font-size:11px;color:var(--text3)">'+insp.start+'~'+insp.end+'</span>';
          if(insp.report) ih+='<span style="font-size:11px;font-weight:600;color:var(--primary)">📋 '+insp.report+'</span>';
          ih+='</div>';
        });
      } else {
        ih+='<div style="font-size:12px;color:var(--text3)">등록된 점검 없음</div>';
      }
      ih+='</div>';
    });
    inspEl.innerHTML=ih;
  }

  // 최근 업무일지 (업무일지 탭 권한 있을 때만)
  var jrnWrap = document.getElementById('homeJournalWrap');
  var jrnEl = document.getElementById('homeJournal');
  if(jrnWrap) jrnWrap.style.display = (tabs.includes('journal')||isAdmin) ? '' : 'none';
  if(jrnEl && (tabs.includes('journal')||isAdmin)){
    var recent = [...db.journals].sort(function(a,b){return b.createdAt.localeCompare(a.createdAt);}).slice(0,3);
    if(!recent.length){
      jrnEl.innerHTML='<div style="text-align:center;padding:12px;color:var(--text3);font-size:13px">최근 업무일지가 없어요</div>';
    } else {
      var jh='';
      recent.forEach(function(j){
        jh+='<div style="padding:8px 4px;border-bottom:1px solid var(--border);cursor:pointer" onclick="switchPage(\'journal\')">'
          +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'
          +'<span class="journal-place '+(j.placeType||'hospital')+'" style="font-size:11px;padding:2px 8px">'+j.place+'</span>'
          +'<span style="font-size:11px;color:var(--text3)">'+j.date+' · '+(j.by||'')+'</span>'
          +'</div>'
          +'<div style="font-size:13px;color:var(--text);line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">'+j.content+'</div>'
          +'</div>';
      });
      jrnEl.innerHTML=jh;
    }
  }
}

// ── 일정 탭 전환 (선택일 / 이번달 전체) ──
let curSchTab = 'day';
function switchSchTab(tab){
  curSchTab = tab;
  const dayBtn = document.getElementById('schTabDay');
  const monthBtn = document.getElementById('schTabMonth');
  const dayView = document.getElementById('schViewDay');
  const monthView = document.getElementById('schViewMonth');
  if(tab==='day'){
    dayBtn.style.background='var(--primary)';dayBtn.style.color='#fff';
    monthBtn.style.background='var(--surface)';monthBtn.style.color='var(--text2)';
    dayView.style.display='block';monthView.style.display='none';
  } else {
    monthBtn.style.background='var(--primary)';monthBtn.style.color='#fff';
    dayBtn.style.background='var(--surface)';dayBtn.style.color='var(--text2)';
    dayView.style.display='none';monthView.style.display='block';
    updateCalMonthLabel();
    renderMonthSchedule();
  }
}
function updateCalMonthLabel(){
  const el = document.getElementById('calMonthMonth');
  if(el) el.textContent = `${calYear}년 ${calMonth+1}월`;
}
function moveMonthAndRefresh(d){
  moveMonth(d);
  updateCalMonthLabel();
  renderMonthSchedule();
}
function renderMonthSchedule(){
  const el = document.getElementById('monthScheduleList'); if(!el) return;
  const titleEl = document.getElementById('schMonthTitle');
  if(titleEl) titleEl.textContent = calYear+'년 '+(calMonth+1)+'월 일정';
  const ym = String(calMonth+1).padStart(2,'0');
  const start = calYear+'-'+ym+'-01';
  const end   = calYear+'-'+ym+'-31';
  const list = db.schedules.filter(function(s){return s.date>=start&&s.date<=end;})
    .sort(function(a,b){return a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||'');});
  if(!list.length){
    el.innerHTML='<div class="empty" style="padding:40px"><div class="empty-icon">📅</div><div>이번 달 일정이 없어요</div></div>';
    return;
  }
  var grouped={};
  list.forEach(function(s){if(!grouped[s.date])grouped[s.date]=[];grouped[s.date].push(s);});
  var html='';
  Object.entries(grouped).forEach(function(entry){
    var date=entry[0], items=entry[1];
    var diff=Math.ceil((new Date(date)-new Date(tod()))/86400000);
    var isPast=diff<0, isToday=diff===0, isSel=date===selDate;
    var borderColor=isSel?'var(--primary)':isToday?'var(--amber)':'transparent';
    var headBg=isToday?'var(--amber-light)':isSel?'var(--primary-light)':'var(--surface2)';
    var headColor=isToday?'var(--amber)':isSel?'var(--primary)':isPast?'var(--text3)':'var(--text2)';
    html+='<div id="schDay_'+date+'" style="margin-bottom:12px;border-radius:var(--radius-sm);overflow:hidden;border:2px solid '+borderColor+'">';
    html+='<div style="font-size:12px;font-weight:700;padding:7px 10px;background:'+headBg+';color:'+headColor+';display:flex;align-items:center;gap:8px;cursor:pointer" onclick="selectDate(\''+date+'\')">';
    html+=date;
    if(isToday) html+='<span style="background:var(--amber);color:#fff;font-size:10px;padding:1px 6px;border-radius:10px">오늘</span>';
    if(isSel&&!isToday) html+='<span style="background:var(--primary);color:#fff;font-size:10px;padding:1px 6px;border-radius:10px">선택</span>';
    if(!isPast&&!isToday) html+='<span style="color:var(--primary);font-size:11px;font-weight:800;margin-left:auto">D-'+diff+'</span>';
    if(isPast) html+='<span style="color:var(--text3);font-size:10px;margin-left:auto">지남</span>';
    html+='</div>';
    html+='<div style="padding:4px 6px 6px;background:var(--surface);opacity:'+(isPast?'0.7':'1')+'">';
    items.forEach(function(s){
      var bc=catColor[s.cat]||'var(--primary)';
      html+='<div style="display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:var(--radius-xs);margin-top:4px;border-left:3px solid '+bc+'">';
      html+='<div style="flex:1;min-width:0">';
      html+='<div style="font-size:13px;font-weight:600;color:var(--text)">'+s.title+'</div>';
      html+='<div style="font-size:11px;color:var(--text3);margin-top:2px;display:flex;gap:6px;flex-wrap:wrap">';
      html+='<span>'+(s.time||'종일')+'</span>';
      html+='<span class="badge b-gray" style="font-size:10px">'+(s.cat||'기타')+'</span>';
      if(s.memo) html+='<span>'+s.memo+'</span>';
      html+='</div></div>';
      html+='<div style="display:flex;gap:4px;flex-shrink:0">';
      html+='<button class="btn btn-xs" onclick="editSchedule(\''+s.id+'\')">수정</button>';
      html+='<button class="btn btn-xs btn-outline-red" onclick="deleteSchedule(\''+s.id+'\');renderMonthSchedule()">삭제</button>';
      html+='</div></div>';
    });
    html+='</div></div>';
  });
  el.innerHTML=html;
}

function renderScheduleList(){
  renderDdayBanner();
  document.getElementById('selectedDateLabel').textContent=selDate?`${selDate} 일정`:'일정';
  const list=db.schedules.filter(s=>!selDate||s.date===selDate).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  if(!list.length){document.getElementById('scheduleList').innerHTML='<div class="empty" style="padding:24px"><div>이 날 일정이 없어요</div></div>';return;}
  document.getElementById('scheduleList').innerHTML=list.map(s=>`
    <div class="sch-item" style="border-left-color:${catColor[s.cat]||'var(--primary)'}">
      <div class="sch-dot" style="background:${catColor[s.cat]||'var(--primary)'}"></div>
      <div style="flex:1;min-width:0">
        <div class="sch-title">${s.title}</div>
        <div class="sch-meta"><span>${s.time||'종일'}</span><span class="badge b-gray">${s.cat||'기타'}</span>${s.memo?`<span>${s.memo}</span>`:''}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:3px">${s.by||''}</div>
      </div>
      <div style="display:flex;gap:4px;flex-direction:column">
        <button class="btn btn-xs" onclick="editSchedule('${s.id}')">수정</button>
        <button class="btn btn-xs btn-outline-red" onclick="deleteSchedule('${s.id}')">삭제</button>
      </div>
    </div>`).join('');
}
function openAddSchedule(){
  document.getElementById('sch_id').value='';document.getElementById('addSchTitle').textContent='일정 추가';
  document.getElementById('sch_title').value='';document.getElementById('sch_date').value=selDate||tod();
  document.getElementById('sch_time').value='';document.getElementById('sch_cat').value='점검';document.getElementById('sch_memo').value='';
  openModal('addSchedule');
}
function editSchedule(id){
  const s=db.schedules.find(x=>x.id===id);if(!s)return;
  document.getElementById('sch_id').value=id;document.getElementById('addSchTitle').textContent='일정 수정';
  document.getElementById('sch_title').value=s.title;document.getElementById('sch_date').value=s.date;
  document.getElementById('sch_time').value=s.time||'';document.getElementById('sch_cat').value=s.cat||'점검';document.getElementById('sch_memo').value=s.memo||'';
  openModal('addSchedule');
}
function saveSchedule(){
  const id=document.getElementById('sch_id').value,title=document.getElementById('sch_title').value.trim();
  const date=document.getElementById('sch_date').value,time=document.getElementById('sch_time').value;
  const cat=document.getElementById('sch_cat').value,memo=document.getElementById('sch_memo').value.trim();
  if(!title||!date){toast('제목과 날짜는 필수입니다','error');return;}
  if(id){const s=db.schedules.find(x=>x.id===id);if(s)Object.assign(s,{title,date,time,cat,memo});}
  else db.schedules.push({id:uid(),title,date,time,cat,memo,by:getW()});
  selDate=date;saveLocal();closeModal('addSchedule');renderCalendar();renderScheduleList();toast('저장됐습니다','success');
}
function deleteSchedule(id){if(!confirm('삭제하시겠습니까?'))return;db.schedules=db.schedules.filter(x=>x.id!==id);saveLocal();renderCalendar();renderScheduleList();toast('삭제됐습니다');}

// ── 메모 ──
const memoCatColor={일반:'var(--amber)',중요:'var(--red)',업무:'var(--primary)',점검:'var(--green)'};
const memoBadge={일반:'b-amber',중요:'b-red',업무:'b-primary',점검:'b-green'};
function openAddMemo(editId){
  const m=editId?db.memos.find(x=>x.id===editId):null;
  document.getElementById('memo_id').value=m?m.id:'';document.getElementById('addMemoTitle').textContent=m?'메모 수정':'메모 추가';
  document.getElementById('memo_title').value=m?m.title:'';document.getElementById('memo_content').value=m?m.content:'';
  document.getElementById('memo_cat').value=m?m.cat||'일반':'일반';openModal('addMemo');
}
function saveMemo(){
  const id=document.getElementById('memo_id').value,title=document.getElementById('memo_title').value.trim();
  const content=document.getElementById('memo_content').value.trim(),cat=document.getElementById('memo_cat').value;
  if(!title||!content){toast('제목과 내용은 필수입니다','error');return;}
  if(id){const m=db.memos.find(x=>x.id===id);if(m)Object.assign(m,{title,content,cat,updatedAt:tod()});}
  else db.memos.push({id:uid(),title,content,cat,createdAt:tod(),by:getW()});
  saveLocal();closeModal('addMemo');renderMemo();toast('저장됐습니다','success');
}
function deleteMemo(id){if(!confirm('삭제하시겠습니까?'))return;db.memos=db.memos.filter(x=>x.id!==id);saveLocal();renderMemo();toast('삭제됐습니다');}
function renderMemo(){
  const cats=['전체','일반','중요','업무','점검'];
  document.getElementById('memoFilter').innerHTML=cats.map(c=>`<div class="filter-chip${c===curMemoF?' active':''}" onclick="setMemoF('${c}')">${c}</div>`).join('');
  let list=[...db.memos];if(curMemoF!=='전체')list=list.filter(m=>m.cat===curMemoF);
  list.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  if(!list.length){document.getElementById('memoList').innerHTML='<div class="empty"><div class="empty-icon">🗒️</div><div>메모가 없어요<br>+ 버튼으로 추가해 보세요</div></div>';return;}
  document.getElementById('memoList').innerHTML=list.map(m=>`
    <div class="memo-card" style="border-left-color:${memoCatColor[m.cat]||'var(--amber)'}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <div style="font-size:14px;font-weight:700;color:var(--text)">${m.title}</div>
            <span class="badge ${memoBadge[m.cat]||'b-amber'}">${m.cat||'일반'}</span>
          </div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button class="btn btn-xs" onclick="openAddMemo('${m.id}')">수정</button>
          <button class="btn btn-xs btn-outline-red" onclick="deleteMemo('${m.id}')">삭제</button>
        </div>
      </div>
      <div style="font-size:13px;color:var(--text2);line-height:1.7;white-space:pre-line">${m.content}</div>
      <div style="font-size:11px;color:var(--text3);margin-top:6px">${m.by||''} · ${m.updatedAt?'수정 '+m.updatedAt:m.createdAt}</div>
    </div>`).join('');
}
function setMemoF(f){curMemoF=f;renderMemo();}

// ── 설정 ──
function renderSettings(){
  renderMemberList();
  // 단위 관리
  const unitEl=document.getElementById('unitManageList');
  if(unitEl){
    const units=db.units||['EA','개','본','롤','박스','세트','kg','L'];
    unitEl.innerHTML=units.map(u=>`<div style="display:flex;align-items:center;gap:4px"><span class="badge b-primary">${u}</span><button class="btn btn-xs" style="padding:1px 5px;color:var(--text3);border:none;background:none" onclick="removeUnit('${u}')">×</button></div>`).join('');
  }
  // 위치 관리
  const locEl=document.getElementById('locManageList');
  if(locEl){
    const locs=db.locations||[];
    locEl.innerHTML=locs.map(l=>`<div style="display:flex;align-items:center;gap:4px;margin-bottom:4px"><span class="badge b-teal">📍 ${l}</span><button class="btn btn-xs" style="padding:1px 5px;color:var(--text3);border:none;background:none" onclick="removeLoc('${l.replace(/'/g,"\'")}')">×</button></div>`).join('');
  }
  const hospitalEl=document.getElementById('hospitalList');
  const univEl=document.getElementById('univList');
  const catEl=document.getElementById('catManageList');
  if(hospitalEl)hospitalEl.innerHTML=db.hospitals.map(h=>`<div style="display:flex;align-items:center;gap:4px"><span class="badge b-red">${h}</span><button class="btn btn-xs" style="padding:1px 5px;color:var(--text3);border:none;background:none" onclick="removePlace('hospital','${h}')">×</button></div>`).join('');
  if(univEl)univEl.innerHTML=db.univs.map(u=>`<div style="display:flex;align-items:center;gap:4px"><span class="badge b-teal">${u}</span><button class="btn btn-xs" style="padding:1px 5px;color:var(--text3);border:none;background:none" onclick="removePlace('univ','${u}')">×</button></div>`).join('');
  if(catEl)catEl.innerHTML=db.categories.map(c=>`<div style="display:flex;align-items:center;gap:4px"><span class="badge b-gray">${catEmoji[c]||'📦'} ${c}</span><button class="btn btn-xs" style="padding:1px 5px;color:var(--text3);border:none;background:none" onclick="removeCat('${c}')">×</button></div>`).join('');
  updateDarkUI();
}
function addPlace(type){
  const inp=document.getElementById(type==='hospital'?'newHospital':'newUniv');
  const val=inp.value.trim();if(!val)return;
  if(type==='hospital'){if(!db.hospitals.includes(val))db.hospitals.push(val);}
  else{if(!db.univs.includes(val))db.univs.push(val);}
  inp.value='';saveLocal();renderSettings();renderJournal();toast('추가됐습니다','success');
}
function removePlace(type,val){
  if(type==='hospital')db.hospitals=db.hospitals.filter(x=>x!==val);
  else db.univs=db.univs.filter(x=>x!==val);
  saveLocal();renderSettings();renderJournal();
}
function addCategory(){
  const val=document.getElementById('newCat').value.trim();if(!val)return;
  if(!db.categories.includes(val))db.categories.push(val);
  document.getElementById('newCat').value='';saveLocal();renderSettings();renderInv();toast('추가됐습니다','success');
}
function removeCat(val){db.categories=db.categories.filter(x=>x!==val);saveLocal();renderSettings();renderInv();}

// ── 모달 ──
function openModal(name){document.getElementById('modal-'+name).classList.add('open');}
function closeModal(name){document.getElementById('modal-'+name).classList.remove('open');}
// 모달 바깥 클릭으로 닫히지 않도록 고정

// ── 데이터 ──
function exportData(){
  const a=document.createElement('a');
  a.href='data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(db,null,2));
  a.download='소방업무공유_백업_'+tod()+'.json';a.click();
}
function importClick(){document.getElementById('importFile').click();}
function doImport(e){
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=ev=>{try{db=Object.assign(db,JSON.parse(ev.target.result));saveLocal();renderAll();toast('복원됐습니다','success');}catch{toast('파일 형식이 올바르지 않습니다','error');}};
  r.readAsText(f);
}


// ── 단위 팝업 ──
function openUnitPicker(){
  const units=db.units||['EA','개','본','롤','박스','세트','kg','L'];
  const cur=document.getElementById('item_unit').value||'EA';
  document.getElementById('unitPickerList').innerHTML=units.map(u=>`
    <button onclick="selectUnit('${u}')" style="padding:10px 18px;border-radius:20px;border:2px solid ${u===cur?'var(--primary)':'var(--border2)'};background:${u===cur?'var(--primary)':'var(--surface)'};color:${u===cur?'#fff':'var(--text2)'};font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">${u}</button>
  `).join('');
  document.getElementById('newUnitInput').value='';
  openModal('unitPicker');
}
function selectUnit(u){
  document.getElementById('item_unit').value=u;
  document.getElementById('item_unit_btn').textContent=u+' ▾';
  closeModal('unitPicker');
}
function addUnitAndSelect(){
  const val=document.getElementById('newUnitInput').value.trim();
  if(!val){toast('단위를 입력해 주세요','error');return;}
  db.units=db.units||['EA','개','본','롤','박스','세트','kg','L'];
  if(!db.units.includes(val))db.units.push(val);
  saveLocal();selectUnit(val);
}

// ── 보관위치 팝업 ──
function openLocPicker(){
  const locs=db.locations||[];
  const cur=document.getElementById('item_loc').value||'';
  document.getElementById('locPickerList').innerHTML=`
    <button onclick="selectLoc('')" style="width:100%;padding:12px;border-radius:var(--radius-sm);border:2px solid ${cur===''?'var(--primary)':'var(--border2)'};background:${cur===''?'var(--primary)':'var(--surface)'};color:${cur===''?'#fff':'var(--text2)'};font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;text-align:left;margin-bottom:6px">선택 안함</button>
    ${locs.map(l=>`<button onclick="selectLoc('${l.replace(/'/g,"\'")}')" style="width:100%;padding:12px;border-radius:var(--radius-sm);border:2px solid ${l===cur?'var(--primary)':'var(--border2)'};background:${l===cur?'var(--primary)':'var(--surface)'};color:${l===cur?'#fff':'var(--text2)'};font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;text-align:left;margin-bottom:6px">📍 ${l}</button>`).join('')}`;
  openModal('locPicker');
}
function selectLoc(l){
  document.getElementById('item_loc').value=l;
  document.getElementById('item_loc_btn').textContent=(l||'선택 안함')+' ▾';
  closeModal('locPicker');
}

// ── 단위/위치 설정 관리 ──
function addUnitSetting(){
  const val=document.getElementById('newUnitSetting').value.trim();if(!val)return;
  db.units=db.units||['EA','개','본','롤','박스','세트','kg','L'];
  if(!db.units.includes(val))db.units.push(val);
  document.getElementById('newUnitSetting').value='';saveLocal();renderSettings();toast('추가됐습니다','success');
}
function removeUnit(val){
  db.units=(db.units||[]).filter(x=>x!==val);saveLocal();renderSettings();
}
function addLocSetting(){
  const val=document.getElementById('newLocSetting').value.trim();if(!val)return;
  db.locations=db.locations||[];
  if(!db.locations.includes(val))db.locations.push(val);
  document.getElementById('newLocSetting').value='';saveLocal();renderSettings();toast('추가됐습니다','success');
}
function removeLoc(val){
  db.locations=(db.locations||[]).filter(x=>x!==val);saveLocal();renderSettings();
}


// ── 일괄 입고 ──

function openBulkIn(){
  bulkInSelected = {};
  document.getElementById('bulkInDate').value = tod();
  document.getElementById('bulkInMemo').value = '';
  document.getElementById('bulkInSearch').value = '';
  document.getElementById('bulkInSearchResult').style.display = 'none';
  document.getElementById('bulkInSearchResult').innerHTML = '';
  renderBulkInSelected();
  openModal('bulkIn');
}

function filterBulkInList(){
  const q = document.getElementById('bulkInSearch').value.trim();
  const resultEl = document.getElementById('bulkInSearchResult');
  if(!q){ resultEl.style.display='none'; resultEl.innerHTML=''; return; }
  const items = db.items.filter(it =>
    it.name.toLowerCase().includes(q.toLowerCase()) ||
    (it.cat||'').toLowerCase().includes(q.toLowerCase())
  );
  if(!items.length){
    resultEl.style.display='block';
    resultEl.innerHTML='<div style="padding:12px;text-align:center;color:var(--text3);font-size:13px">검색 결과가 없어요</div>';
    return;
  }
  resultEl.style.display='block';
  resultEl.innerHTML = items.map(it => {
    const already = bulkInSelected[it.id] !== undefined;
    return `<div onclick="addBulkInItem('${it.id}')" style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);background:${already?'var(--green-light)':'var(--surface)'};transition:background .1s">
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text)">${it.name}</div>
        <div style="font-size:11px;color:var(--text3)">${it.cat||''} · 현재 ${it.qty}${it.unit||'개'}</div>
      </div>
      <span style="font-size:12px;color:${already?'var(--green)':'var(--primary)'};font-weight:600">${already?'✓ 추가됨':'+ 추가'}</span>
    </div>`;
  }).join('');
}

function addBulkInItem(id){
  if(bulkInSelected[id] !== undefined){ toast('이미 추가된 품목이에요'); return; }
  bulkInSelected[id] = 1;
  document.getElementById('bulkInSearch').value = '';
  document.getElementById('bulkInSearchResult').style.display = 'none';
  document.getElementById('bulkInSearchResult').innerHTML = '';
  renderBulkInSelected();
}

function renderBulkInSelected(){
  const wrap = document.getElementById('bulkInSelectedWrap');
  const list = document.getElementById('bulkInSelectedList');
  const cnt = document.getElementById('bulkInSelectedCount');
  const entries = Object.entries(bulkInSelected);
  if(!entries.length){ wrap.style.display='none'; return; }
  wrap.style.display='block';
  cnt.textContent = `(${entries.length}개)`;
  list.innerHTML = entries.map(([id, qty])=>{
    const it = db.items.find(x=>x.id===id); if(!it) return '';
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border-radius:var(--radius-sm);margin-bottom:6px">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--text)">${it.name}</div>
        <div style="font-size:11px;color:var(--text3)">현재 ${it.qty}${it.unit||'개'} → 입고 후 <span id="bulkInAfter_${it.id}" style="color:var(--green);font-weight:700">${it.qty + qty}${it.unit||'개'}</span></div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
        <button onclick="changeBulkInQty('${it.id}',-1)" style="width:28px;height:28px;border-radius:50%;border:1.5px solid var(--border2);background:var(--surface);font-size:16px;cursor:pointer;color:var(--red)">−</button>
        <input type="number" min="1" value="${qty}" id="bulkInQty_${it.id}"
          style="width:56px;padding:5px 4px;border:1.5px solid var(--border2);border-radius:var(--radius-sm);font-size:14px;font-weight:700;text-align:center;background:var(--surface);color:var(--text);font-family:monospace"
          oninput="bulkInSelected['${it.id}']=Math.max(1,parseInt(this.value)||1);updateBulkInAfter('${it.id}',${it.qty})">
        <button onclick="changeBulkInQty('${it.id}',1)" style="width:28px;height:28px;border-radius:50%;border:1.5px solid var(--border2);background:var(--surface);font-size:16px;cursor:pointer;color:var(--green)">＋</button>
        <span style="font-size:12px;color:var(--text3)">${it.unit||'개'}</span>
        <button onclick="removeBulkInItem('${it.id}')" style="width:26px;height:26px;border-radius:50%;border:none;background:var(--red-light);color:var(--red);font-size:14px;cursor:pointer">×</button>
      </div>
    </div>`;
  }).join('');
}

function changeBulkInQty(id, d){
  const it = db.items.find(x=>x.id===id); if(!it) return;
  const cur = bulkInSelected[id]||1;
  const next = Math.max(1, cur+d);
  bulkInSelected[id] = next;
  const input = document.getElementById('bulkInQty_'+id);
  if(input) input.value = next;
  updateBulkInAfter(id, it.qty);
}
function updateBulkInAfter(id, curQty){
  const qty = bulkInSelected[id]||1;
  const el = document.getElementById('bulkInAfter_'+id);
  if(el){ const it=db.items.find(x=>x.id===id); el.textContent=(curQty+qty)+(it?it.unit||'개':'개'); }
}
function removeBulkInItem(id){
  delete bulkInSelected[id];
  renderBulkInSelected();
}

function saveBulkIn(){
  const date = document.getElementById('bulkInDate').value;
  const memo = document.getElementById('bulkInMemo').value.trim();
  if(!date){ toast('입고일을 선택해 주세요','error'); return; }
  const entries = Object.entries(bulkInSelected).filter(([,qty])=>qty>0);
  if(!entries.length){ toast('품목을 검색해서 추가해 주세요','error'); return; }
  entries.forEach(([id,qty])=>{
    const it=db.items.find(x=>x.id===id); if(!it) return;
    it.qty += qty;
    db.txns=db.txns||[];
    db.txns.push({id:uid(),itemId:id,type:'in',qty,memo:memo||'입고등록',date,by:getW()});
  });
  saveLocal(); closeModal('bulkIn'); renderInv();
  toast(`${entries.length}개 품목 입고 등록됐습니다`,'success');
  bulkInSelected={};
}

// ── 일괄 사용 (출고) ──

function openBulkUse(){
  bulkUseSelected = {};
  document.getElementById('bulkUseDate').value = tod();
  document.getElementById('bulkUseMemo').value = '';
  document.getElementById('bulkUseSearch').value = '';
  document.getElementById('bulkUseSearchResult').style.display = 'none';
  document.getElementById('bulkUseSearchResult').innerHTML = '';
  renderBulkUseSelected();
  openModal('bulkUse');
}

function filterBulkUseList(){
  const q = document.getElementById('bulkUseSearch').value.trim();
  const resultEl = document.getElementById('bulkUseSearchResult');
  if(!q){ resultEl.style.display='none'; resultEl.innerHTML=''; return; }
  const items = db.items.filter(it =>
    it.name.toLowerCase().includes(q.toLowerCase()) ||
    (it.cat||'').toLowerCase().includes(q.toLowerCase())
  );
  if(!items.length){
    resultEl.style.display='block';
    resultEl.innerHTML='<div style="padding:12px;text-align:center;color:var(--text3);font-size:13px">검색 결과가 없어요</div>';
    return;
  }
  resultEl.style.display='block';
  resultEl.innerHTML = items.map(it => {
    const already = bulkUseSelected[it.id] !== undefined;
    const noStock = it.qty <= 0;
    return `<div onclick="${noStock?'toast("재고가 없어요","error")':('addBulkUseItem("'+it.id+'")')}" style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);background:${already?'var(--primary-light)':noStock?'var(--red-light)':'var(--surface)'};transition:background .1s">
      <div>
        <div style="font-size:13px;font-weight:700;color:${noStock?'var(--red)':'var(--text)'}">${it.name}</div>
        <div style="font-size:11px;color:var(--text3)">${it.cat||''} · 재고 ${it.qty}${it.unit||'개'}${noStock?' ⚠ 재고없음':''}</div>
      </div>
      <span style="font-size:12px;color:${already?'var(--primary)':noStock?'var(--red)':'var(--primary)'};font-weight:600">${already?'✓ 추가됨':noStock?'재고없음':'+ 추가'}</span>
    </div>`;
  }).join('');
}

function addBulkUseItem(id){
  if(bulkUseSelected[id] !== undefined){ toast('이미 추가된 품목이에요'); return; }
  bulkUseSelected[id] = 1;
  document.getElementById('bulkUseSearch').value = '';
  document.getElementById('bulkUseSearchResult').style.display = 'none';
  document.getElementById('bulkUseSearchResult').innerHTML = '';
  renderBulkUseSelected();
}

function renderBulkUseSelected(){
  const wrap = document.getElementById('bulkUseSelectedWrap');
  const list = document.getElementById('bulkUseSelectedList');
  const cnt = document.getElementById('bulkUseSelectedCount');
  const entries = Object.entries(bulkUseSelected);
  if(!entries.length){ wrap.style.display='none'; return; }
  wrap.style.display='block';
  cnt.textContent = `(${entries.length}개)`;
  list.innerHTML = entries.map(([id,qty])=>{
    const it = db.items.find(x=>x.id===id); if(!it) return '';
    const after = it.qty - qty;
    const isShort = after < 0;
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border-radius:var(--radius-sm);margin-bottom:6px;border:1.5px solid ${isShort?'var(--red)':'transparent'}">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--text)">${it.name}</div>
        <div style="font-size:11px;color:var(--text3)">재고 ${it.qty}${it.unit||'개'} → 사용 후 <span id="bulkUseAfter_${it.id}" style="color:${isShort?'var(--red)':'var(--primary)'};font-weight:700">${after}${it.unit||'개'}${isShort?' ⚠부족':''}</span></div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
        <button onclick="changeBulkUseQty('${it.id}',-1)" style="width:28px;height:28px;border-radius:50%;border:1.5px solid var(--border2);background:var(--surface);font-size:16px;cursor:pointer;color:var(--red)">−</button>
        <input type="number" min="1" value="${qty}" id="bulkUseQty_${it.id}"
          style="width:56px;padding:5px 4px;border:1.5px solid var(--border2);border-radius:var(--radius-sm);font-size:14px;font-weight:700;text-align:center;background:var(--surface);color:var(--text);font-family:monospace"
          oninput="bulkUseSelected['${it.id}']=Math.max(1,parseInt(this.value)||1);updateBulkUseAfter('${it.id}',${it.qty})">
        <button onclick="changeBulkUseQty('${it.id}',1)" style="width:28px;height:28px;border-radius:50%;border:1.5px solid var(--border2);background:var(--surface);font-size:16px;cursor:pointer;color:var(--green)">＋</button>
        <span style="font-size:12px;color:var(--text3)">${it.unit||'개'}</span>
        <button onclick="removeBulkUseItem('${it.id}')" style="width:26px;height:26px;border-radius:50%;border:none;background:var(--red-light);color:var(--red);font-size:14px;cursor:pointer">×</button>
      </div>
    </div>`;
  }).join('');
}

function changeBulkUseQty(id, d){
  const it = db.items.find(x=>x.id===id); if(!it) return;
  const cur = bulkUseSelected[id]||1;
  const next = Math.max(1, cur+d);
  bulkUseSelected[id] = next;
  const input = document.getElementById('bulkUseQty_'+id);
  if(input) input.value = next;
  updateBulkUseAfter(id, it.qty);
}
function updateBulkUseAfter(id, curQty){
  const qty = bulkUseSelected[id]||1;
  const el = document.getElementById('bulkUseAfter_'+id);
  if(el){
    const it=db.items.find(x=>x.id===id);
    const after=curQty-qty;
    el.textContent=after+(it?it.unit||'개':'개')+(after<0?' ⚠부족':'');
    el.style.color=after<0?'var(--red)':'var(--primary)';
  }
}
function removeBulkUseItem(id){
  delete bulkUseSelected[id];
  renderBulkUseSelected();
}

function saveBulkUse(){
  const date = document.getElementById('bulkUseDate').value;
  const memo = document.getElementById('bulkUseMemo').value.trim();
  if(!date){ toast('사용일을 선택해 주세요','error'); return; }
  const entries = Object.entries(bulkUseSelected).filter(([,qty])=>qty>0);
  if(!entries.length){ toast('품목을 검색해서 추가해 주세요','error'); return; }
  // 재고 부족 체크
  for(const [id,qty] of entries){
    const it=db.items.find(x=>x.id===id); if(!it) continue;
    if(it.qty<qty){ toast(`${it.name} 재고 부족 (현재: ${it.qty}${it.unit||'개'})`,'error'); return; }
  }
  entries.forEach(([id,qty])=>{
    const it=db.items.find(x=>x.id===id); if(!it) return;
    it.qty -= qty;
    db.txns=db.txns||[];
    db.txns.push({id:uid(),itemId:id,type:'out',qty,memo:memo||'사용등록',date,by:getW()});
  });
  saveLocal(); closeModal('bulkUse'); renderInv();
  toast(`${entries.length}개 품목 사용 등록됐습니다`,'success');
  bulkUseSelected={};
}

// ── 재고 부족 배너 ──
function renderLowStockBanner(){
  const el = document.getElementById('lowStockBanner');
  if(!el) return;
  const lowItems = db.items.filter(it => it.min > 0 && it.qty <= it.min);
  if(!lowItems.length){ el.innerHTML=''; return; }
  el.innerHTML = `
    <div style="background:var(--red-light);border:1.5px solid var(--red-border);border-radius:var(--radius-sm);padding:12px 14px;margin-bottom:12px">
      <div style="font-size:13px;font-weight:700;color:var(--red);margin-bottom:8px">⚠️ 재고 부족 품목 ${lowItems.length}개</div>
      ${lowItems.map(it=>`
        <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--red-border);font-size:12px">
          <span style="color:var(--text2);font-weight:600">${it.name}</span>
          <span style="color:var(--red);font-weight:700">${it.qty}${it.unit||'개'} / 최소 ${it.min}${it.unit||'개'}</span>
        </div>`).join('')}
    </div>`;
}

// ── D-day 배너 ──
function renderDdayBanner(){
  const el = document.getElementById('ddayBanner');
  if(!el) return;
  const todStr = tod();
  const upcoming = db.schedules
    .filter(s => s.date >= todStr)
    .sort((a,b) => a.date.localeCompare(b.date));
  const ongoing = upcoming.find(s => s.date === todStr);
  const next = upcoming.find(s => s.date > todStr);
  const target = ongoing || next;
  if(!target){ el.innerHTML=''; return; }
  const diff = Math.ceil((new Date(target.date) - new Date(todStr)) / 86400000);
  const isToday = diff === 0;
  const isUrgent = diff <= 7;
  const bg = isToday ? 'var(--red-light)' : isUrgent ? 'var(--amber-light)' : 'var(--primary-light)';
  const border = isToday ? 'var(--red-border)' : isUrgent ? 'var(--amber-border)' : 'var(--primary-border)';
  const color = isToday ? 'var(--red)' : isUrgent ? 'var(--amber)' : 'var(--primary)';
  const label = isToday ? '📅 오늘 일정' : `📅 D-${diff}`;
  el.innerHTML = `
    <div style="background:${bg};border:1.5px solid ${border};border-radius:var(--radius-sm);padding:12px 16px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;cursor:pointer" onclick="selectDate('${target.date}')">
      <div>
        <div style="font-size:12px;font-weight:700;color:${color};margin-bottom:3px">${label}</div>
        <div style="font-size:14px;font-weight:700;color:var(--text)">${target.title}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">${target.date} ${target.time||''} · ${target.cat||'기타'}</div>
      </div>
      <div style="font-size:26px;font-weight:800;font-family:monospace;color:${color}">${isToday?'TODAY':'D-'+diff}</div>
    </div>`;
}

// ── 입출고 이력 ──
function getFYOptions(){
  // 회계연도: 3/1 ~ 다음해 2/28. 현재 회계연도 계산
  const now = new Date();
  const curFY = now.getMonth() >= 2 ? now.getFullYear() : now.getFullYear()-1;
  const options = [];
  for(let y=curFY; y>=curFY-3; y--){
    options.push({label:`${y}년도 (${y}.03.01 ~ ${y+1}.02.28)`, start:`${y}-03-01`, end:`${y+1}-02-28`});
  }
  return options;
}
function renderTxnHistory(){
  // 회계연도 셀렉트 초기화
  const fyEl = document.getElementById('histFilterFY');
  if(fyEl && fyEl.options.length <= 1){
    getFYOptions().forEach((fy,i)=>{
      const opt = document.createElement('option');
      opt.value = JSON.stringify({start:fy.start,end:fy.end});
      opt.textContent = fy.label;
      if(i===0) opt.selected=true;
      fyEl.appendChild(opt);
    });
  }

  const typeF = document.getElementById('histFilterType')?.value||'';
  const itemF = document.getElementById('histFilterItem')?.value||'';
  const dateF = document.getElementById('histFilterDate')?.value||'';
  const fyVal = document.getElementById('histFilterFY')?.value||'';

  // 품목 필터 옵션 채우기
  const sel = document.getElementById('histFilterItem');
  if(sel && sel.options.length <= 1){
    db.items.forEach(it=>{
      const opt = document.createElement('option');
      opt.value = it.id; opt.textContent = it.name;
      sel.appendChild(opt);
    });
  }

  let txns = [...(db.txns||[])];

  // 회계연도 필터
  if(fyVal){
    try{
      const {start,end} = JSON.parse(fyVal);
      txns = txns.filter(t=>t.date>=start && t.date<=end);
    }catch{}
  }

  if(typeF) txns = txns.filter(t=>t.type===typeF);
  if(itemF) txns = txns.filter(t=>t.itemId===itemF);
  if(dateF) txns = txns.filter(t=>t.date===dateF);
  txns.sort((a,b)=>(b.date||'').localeCompare(a.date||'')||b.id.localeCompare(a.id));

  const el = document.getElementById('txnHistoryList');
  if(!el) return;
  if(!txns.length){
    el.innerHTML='<div class="empty"><div class="empty-icon">🗂️</div><div>이력이 없어요</div></div>';
    return;
  }

  // 날짜별 그룹
  const grouped = {};
  txns.forEach(t=>{ (grouped[t.date||'날짜없음']=grouped[t.date||'날짜없음']||[]).push(t); });

  // 회계연도 요약
  const inTotal = txns.filter(t=>t.type==='in').reduce((s,t)=>s+t.qty,0);
  const outTotal = txns.filter(t=>t.type==='out').reduce((s,t)=>s+t.qty,0);
  const summaryEl = document.getElementById('txnHistorySummary');
  if(summaryEl && txns.length){
    summaryEl.innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
      <div style="background:var(--green-light);border:1px solid var(--green-border);border-radius:var(--radius-sm);padding:10px;text-align:center">
        <div style="font-size:11px;color:var(--green);font-weight:600">📥 총 입고</div>
        <div style="font-size:20px;font-weight:700;color:var(--green);font-family:monospace">${inTotal}건</div>
      </div>
      <div style="background:var(--red-light);border:1px solid var(--red-border);border-radius:var(--radius-sm);padding:10px;text-align:center">
        <div style="font-size:11px;color:var(--red);font-weight:600">📤 총 사용</div>
        <div style="font-size:20px;font-weight:700;color:var(--red);font-family:monospace">${outTotal}건</div>
      </div>
    </div>`;
  } else if(summaryEl){ summaryEl.innerHTML=''; }

  el.innerHTML = Object.entries(grouped).map(([date, list])=>`
    <div style="font-size:12px;font-weight:700;color:var(--text3);padding:8px 0 4px;border-bottom:1px solid var(--border);margin-bottom:8px">${date}</div>
    ${list.map(t=>{
      const it = db.items.find(x=>x.id===t.itemId);
      const isIn = t.type==='in';
      return `<div style="background:var(--surface);border-radius:var(--radius-sm);box-shadow:var(--shadow);padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:10px;border-left:3px solid ${isIn?'var(--green)':'var(--red)'}">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;color:var(--text)">${it?it.name:'삭제된 품목'}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:3px">${t.memo||''} ${t.by?'· '+t.by:''}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:16px;font-weight:700;color:${isIn?'var(--green)':'var(--red)'};font-family:monospace">${isIn?'+':'-'}${t.qty}${it?it.unit||'개':'개'}</div>
          <div class="badge ${isIn?'b-green':'b-red'}" style="margin-top:3px">${isIn?'📥 입고':'📤 사용'}</div>
        </div>
      </div>`;
    }).join('')}
  `).join('');
}


// ── 메인보드 ──
function renderHome(){
  const todStr = tod();
  const hour = new Date().getHours();
  const greet = hour<12?'좋은 아침이에요 ☀️':hour<18?'안녕하세요 😊':'수고하셨어요 🌙';
  const greetEl = document.getElementById('homeGreeting');
  if(greetEl) greetEl.innerHTML=`
    <div style="background:var(--primary);border-radius:var(--radius);padding:14px 20px;color:#fff;display:flex;align-items:center;justify-content:space-between">
      <div>
        <div style="font-size:12px;opacity:.85;margin-bottom:3px">${greet}</div>
        <div style="font-size:17px;font-weight:700">${userName||'팀원'}님 👋</div>
      </div>
      <div style="font-size:13px;opacity:.75;text-align:right">
        <div>${todStr}</div>
        <div style="margin-top:3px;font-size:11px">소방업무공유</div>
      </div>
    </div>`;

  // 부족 품목
  const lowEl = document.getElementById('homeLowStock');
  if(lowEl){
    const lows = db.items.filter(it=>it.min>0&&it.qty<=it.min);
    if(!lows.length){
      lowEl.innerHTML='<div style="text-align:center;padding:12px;color:var(--green);font-size:13px">✓ 모든 품목 재고 정상</div>';
    } else {
      lowEl.innerHTML = lows.map(it=>`
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 4px;border-bottom:1px solid var(--border)">
          <span style="font-size:13px;color:var(--text);font-weight:600">${it.name}</span>
          <span style="font-size:12px;color:var(--red);font-weight:700">${it.qty}${it.unit||'개'} / 최소 ${it.min}${it.unit||'개'}</span>
        </div>`).join('');
    }
  }

  // 오늘 + D-7 이내 일정
  const schEl = document.getElementById('homeSchedule');
  if(schEl){
    const upcoming = db.schedules
      .filter(s=>s.date>=todStr)
      .sort((a,b)=>a.date.localeCompare(b.date))
      .slice(0,5);
    if(!upcoming.length){
      schEl.innerHTML='<div style="text-align:center;padding:12px;color:var(--text3);font-size:13px">예정된 일정이 없어요</div>';
    } else {
      schEl.innerHTML = upcoming.map(s=>{
        const diff = Math.ceil((new Date(s.date)-new Date(todStr))/86400000);
        const isToday = diff===0;
        const color = isToday?'var(--red)':diff<=3?'var(--amber)':'var(--primary)';
        return `<div style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid var(--border);cursor:pointer" onclick="switchPage('schedule')">
          <div style="min-width:44px;text-align:center;font-size:12px;font-weight:800;color:${color};font-family:monospace">${isToday?'TODAY':'D-'+diff}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:700;color:var(--text)">${s.title}</div>
            <div style="font-size:11px;color:var(--text3)">${s.date} ${s.time||''} · ${s.cat||'기타'}</div>
          </div>
        </div>`;
      }).join('');
    }
  }

  // 점검 현황 요약
  const inspEl = document.getElementById('homeInspection');
  if(inspEl){
    const curFY = getCurrentFY();
    const blds = ['jongham','seomigam'];
    inspEl.innerHTML = blds.map(bldKey=>{
      const cfg = BLD_CONFIG[bldKey];
      const insps = (db.inspections||[]).filter(x=>x.bld===bldKey&&x.fy===curFY);
      const reportColors={'업체작성중':'var(--amber)','자료검토중':'var(--primary)','소방서제출완료':'var(--green)'};
      const repairColors={'자체점검':'var(--primary)','업체보수':'var(--amber)','완료':'var(--green)'};
      return `<div style="padding:8px 4px;border-bottom:1px solid var(--border)">
        <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:6px">${cfg.icon} ${cfg.name}</div>
        ${insps.length?insps.map(insp=>`
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px">
            <span class="badge b-gray">${insp.type}점검</span>
            <span style="font-size:11px;color:var(--text3)">${insp.start}~${insp.end}</span>
            ${insp.report?`<span style="font-size:11px;font-weight:600;color:${reportColors[insp.report]||'var(--text3)'}">📋 ${insp.report}</span>`:''}
            ${insp.repair?`<span style="font-size:11px;font-weight:600;color:${repairColors[insp.repair]||'var(--text3)'}">🔧 ${insp.repair}</span>`:''}
          </div>`).join(''):
          `<div style="font-size:12px;color:var(--text3)">등록된 점검 없음</div>`}
      </div>`;
    }).join('');
  }

  // 최근 업무일지 3개
  const jrnEl = document.getElementById('homeJournal');
  if(jrnEl){
    const recent = [...db.journals].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,3);
    if(!recent.length){
      jrnEl.innerHTML='<div style="text-align:center;padding:12px;color:var(--text3);font-size:13px">최근 업무일지가 없어요</div>';
    } else {
      jrnEl.innerHTML = recent.map(j=>`
        <div style="padding:8px 4px;border-bottom:1px solid var(--border);cursor:pointer" onclick="switchPage('journal')">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span class="journal-place ${j.placeType||'hospital'}" style="font-size:11px;padding:2px 8px">${j.place}</span>
            <span style="font-size:11px;color:var(--text3)">${j.date} · ${j.by||''}</span>
          </div>
          <div style="font-size:13px;color:var(--text);line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${j.content}</div>
        </div>`).join('');
    }
  }
}

// ── 일정 탭 전환 (선택일 / 이번달 전체) ──
function switchSchTab(tab){
  curSchTab = tab;
  const dayBtn = document.getElementById('schTabDay');
  const monthBtn = document.getElementById('schTabMonth');
  const dayView = document.getElementById('schViewDay');
  const monthView = document.getElementById('schViewMonth');
  if(tab==='day'){
    dayBtn.style.background='var(--primary)';dayBtn.style.color='#fff';
    monthBtn.style.background='var(--surface)';monthBtn.style.color='var(--text2)';
    dayView.style.display='block';monthView.style.display='none';
  } else {
    monthBtn.style.background='var(--primary)';monthBtn.style.color='#fff';
    dayBtn.style.background='var(--surface)';dayBtn.style.color='var(--text2)';
    dayView.style.display='none';monthView.style.display='block';
    updateCalMonthLabel();
    renderMonthSchedule();
  }
}
function updateCalMonthLabel(){
  const el = document.getElementById('calMonthMonth');
  if(el) el.textContent = `${calYear}년 ${calMonth+1}월`;
}
function moveMonthAndRefresh(d){
  moveMonth(d);
  updateCalMonthLabel();
  renderMonthSchedule();
}
function renderMonthSchedule(){
  const el = document.getElementById('monthScheduleList'); if(!el) return;
  // 월 타이틀 업데이트
  const titleEl = document.getElementById('schMonthTitle');
  if(titleEl) titleEl.textContent = `${calYear}년 ${calMonth+1}월 일정`;
  const start = `${calYear}-${String(calMonth+1).padStart(2,'0')}-01`;
  const end   = `${calYear}-${String(calMonth+1).padStart(2,'0')}-31`;
  const list  = db.schedules.filter(s=>s.date>=start&&s.date<=end).sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||''));
  if(!list.length){
    el.innerHTML='<div class="empty" style="padding:40px"><div class="empty-icon">📅</div><div>이번 달 일정이 없어요</div></div>';
    return;
  }
  const grouped={};
  list.forEach(s=>{(grouped[s.date]=grouped[s.date]||[]).push(s);});
  el.innerHTML = Object.entries(grouped).map(([date,items])=>{
    const diff = Math.ceil((new Date(date)-new Date(tod()))/86400000);
    const isPast = diff<0, isToday=diff===0, isSel=date===selDate;
    return `
      <div id="schDay_${date}" style="margin-bottom:12px;border-radius:var(--radius-sm);overflow:hidden;border:2px solid ${isSel?'var(--primary)':isToday?'var(--amber)':'transparent'}">
        <div style="font-size:12px;font-weight:700;padding:7px 10px;background:${isToday?'var(--amber-light)':isSel?'var(--primary-light)':'var(--surface2)'};color:${isToday?'var(--amber)':isSel?'var(--primary)':isPast?'var(--text3)':'var(--text2)'};display:flex;align-items:center;gap:8px;cursor:pointer" onclick="selectDate('${date}')">
          ${date}
          ${isToday?'<span style="background:var(--amber);color:#fff;font-size:10px;padding:1px 6px;border-radius:10px">오늘</span>':''}
          ${isSel&&!isToday?'<span style="background:var(--primary);color:#fff;font-size:10px;padding:1px 6px;border-radius:10px">선택</span>':''}
          ${!isPast&&!isToday?`<span style="color:var(--primary);font-size:11px;font-weight:800;margin-left:auto">D-${diff}</span>`:''}
          ${isPast?'<span style="color:var(--text3);font-size:10px;margin-left:auto">지남</span>':''}
        </div>
        <div style="padding:4px 6px 6px;background:var(--surface);opacity:${isPast?.7:1}">
          ${items.map(s=>`
            <div style="display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:var(--radius-xs);margin-top:4px;border-left:3px solid ${catColor[s.cat]||'var(--primary)'}">
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:600;color:var(--text)">${s.title}</div>
                <div style="font-size:11px;color:var(--text3);margin-top:2px;display:flex;gap:6px;flex-wrap:wrap">
                  <span>${s.time||'종일'}</span>
                  <span class="badge b-gray" style="font-size:10px">${s.cat||'기타'}</span>
                  ${s.memo?`<span>${s.memo}</span>`:''}
                </div>
              </div>
              <div style="display:flex;gap:4px;flex-shrink:0">
                <button class="btn btn-xs" onclick="editSchedule('${s.id}')">수정</button>
                <button class="btn btn-xs btn-outline-red" onclick="deleteSchedule('${s.id}');renderMonthSchedule()">삭제</button>
              </div>
            </div>`).join('')}
        </div>
      </div>`;
  }).join('');
}


// ── 종합관/서미감관 ──

function renderBuilding(bldKey){
  const cfg = BLD_CONFIG[bldKey];
  const el = document.getElementById(bldKey+'Content');
  if(!el) return;

  const insps = (db.inspections||[]).filter(x=>x.bld===bldKey);
  const fySet = new Set(insps.map(x=>x.fy));
  const curFY = getCurrentFY();
  fySet.add(curFY);
  const fys = [...fySet].sort((a,b)=>b-a);

  const reportColors = {'업체작성중':'b-amber','자료검토중':'b-primary','소방서제출완료':'b-green'};
  const typeColors = {'종합':'b-primary','작동':'b-teal'};

  let html = '';

  // 헤더
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">';
  html += '<div style="font-size:16px;font-weight:700;color:var(--text)">' + cfg.icon + ' ' + cfg.name + '</div>';
  html += '<button class="btn btn-primary btn-sm" onclick="openAddInspection(\'' + bldKey + '\')">+ 점검 등록</button>';
  html += '</div>';

  // 정기 점검 안내
  html += '<div style="background:var(--primary-light);border:1px solid var(--primary-border);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:16px">';
  html += '<div style="font-size:12px;font-weight:600;color:var(--primary);margin-bottom:6px">📅 정기 점검 일정</div>';
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
  cfg.schedules.forEach(function(s){
    html += '<span class="badge ' + (typeColors[s.type]||'b-gray') + '">' + s.month + '월 ' + s.type + '점검 (' + s.label + ')</span>';
  });
  html += '</div></div>';

  // 회계연도별 이력
  fys.forEach(function(fy){
    const fyInsps = insps.filter(x=>x.fy===fy).sort((a,b)=>a.start.localeCompare(b.start));
    const isCur = fy === curFY;

    html += '<div style="background:var(--surface);border-radius:var(--radius);box-shadow:var(--shadow);margin-bottom:12px;overflow:hidden;' + (isCur?'border:2px solid var(--primary)':'') + '">';

    // 연도 헤더
    html += '<div style="padding:12px 16px;background:' + (isCur?'var(--primary-light)':'var(--surface2)') + ';border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">';
    html += '<div style="font-size:13px;font-weight:700;color:' + (isCur?'var(--primary)':'var(--text2)') + '">' + (isCur?'📌 ':'') + getFYLabel(fy) + '</div>';
    if(isCur) html += '<span class="badge b-primary">현재</span>';
    html += '</div>';

    html += '<div style="padding:10px">';

    if(fyInsps.length){
      fyInsps.forEach(function(insp){
        const borderColor = insp.type==='종합' ? 'var(--primary)' : 'var(--teal)';
        html += '<div style="background:var(--surface2);border-radius:var(--radius-sm);padding:12px 14px;margin-bottom:8px;border-left:3px solid ' + borderColor + '">';

        // 점검 헤더
        html += '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px">';
        html += '<div style="flex:1">';
        html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap">';
        html += '<span class="badge ' + (typeColors[insp.type]||'b-gray') + '">' + insp.type + '점검</span>';
        html += '<span style="font-size:13px;font-weight:700;color:var(--text)">' + insp.start + ' ~ ' + insp.end + '</span>';
        html += '</div>';
        if(insp.company) html += '<div style="font-size:12px;color:var(--text3)">업체: ' + insp.company + '</div>';
        html += '</div>';
        html += '<div style="display:flex;gap:4px;flex-shrink:0">';
        html += '<button class="btn btn-xs" onclick="openEditInspection(\'' + insp.id + '\')">수정</button>';
        html += '<button class="btn btn-xs btn-outline-red" onclick="deleteInspection(\'' + insp.id + '\',\'' + bldKey + '\')">삭제</button>';
        html += '</div></div>';

        // 보고서 현황
        if(insp.report){
          html += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px">';
          html += '<span style="font-size:11px;color:var(--text3)">보고서</span>';
          html += '<span class="badge ' + (reportColors[insp.report]||'b-gray') + '">' + insp.report + '</span>';
          html += '</div>';
        }

        // 메모
        if(insp.memo){
          html += '<div style="font-size:12px;color:var(--text2);background:var(--surface);padding:8px;border-radius:var(--radius-xs);white-space:pre-line;margin-top:4px">' + insp.memo + '</div>';
        }

        // 보완사항
        html += '<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:8px">';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">';
        html += '<div style="font-size:12px;font-weight:700;color:var(--text2)">📋 보완사항</div>';
        html += '<button class="btn btn-xs btn-outline-primary" onclick="openAddRemedy(\'' + insp.id + '\',\'' + bldKey + '\')">+ 추가</button>';
        html += '</div>';
        html += '<div id="remedyList_' + insp.id + '">' + renderRemedyList(insp.id) + '</div>';
        html += '</div>';

        html += '</div>'; // insp card
      });
    } else {
      html += '<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px">등록된 점검 이력이 없어요<br>상단 + 점검 등록 버튼을 눌러주세요</div>';
    }

    html += '</div></div>'; // padding + card
  });

  el.innerHTML = html;
}

function selectInspType(t){
  document.getElementById('insp_type').value=t;
  ['종합','작동'].forEach(x=>{
    const btn=document.getElementById('insp_t_'+x);
    btn.style.background=x===t?'var(--primary)':'';
    btn.style.color=x===t?'#fff':'';
    btn.style.fontWeight=x===t?'700':'400';
    btn.style.borderColor=x===t?'var(--primary)':'var(--border2)';
  });
}
function populateInspFY(){
  const sel=document.getElementById('insp_fy');
  const curFY=getCurrentFY();
  sel.innerHTML=[curFY,curFY-1,curFY-2,curFY+1].sort((a,b)=>b-a).map(fy=>
    `<option value="${fy}"${fy===curFY?' selected':''}>${getFYLabel(fy)}</option>`
  ).join('');
}
function openAddInspection(bldKey){
  document.getElementById('insp_id').value='';
  document.getElementById('insp_bld').value=bldKey;
  document.getElementById('inspModalTitle').textContent=BLD_CONFIG[bldKey]?.name+' 점검 등록';
  document.getElementById('insp_type').value='';
  document.getElementById('insp_start').value='';
  document.getElementById('insp_end').value='';
  document.getElementById('insp_company').value='';
  document.getElementById('insp_report').value='';
  document.getElementById('insp_memo').value='';
  ['종합','작동'].forEach(x=>{
    const btn=document.getElementById('insp_t_'+x);
    btn.style.background='';btn.style.color='';btn.style.fontWeight='400';btn.style.borderColor='var(--border2)';
  });
  populateInspFY();
  // 자체점검이 아니면 scTarget 숨기기
  var wrap=document.getElementById('insp_scTarget_wrap');
  if(wrap) wrap.style.display='none';
  openModal('addInspection');
}
function openEditInspection(id){
  const insp=(db.inspections||[]).find(x=>x.id===id);if(!insp)return;
  document.getElementById('insp_id').value=id;
  document.getElementById('insp_bld').value=insp.bld;
  document.getElementById('inspModalTitle').textContent=BLD_CONFIG[insp.bld]?.name+' 점검 수정';
  document.getElementById('insp_start').value=insp.start||'';
  document.getElementById('insp_end').value=insp.end||'';
  document.getElementById('insp_company').value=insp.company||'';
  document.getElementById('insp_report').value=insp.report||'';
  document.getElementById('insp_memo').value=insp.memo||'';
  populateInspFY();
  document.getElementById('insp_fy').value=insp.fy||getCurrentFY();
  selectInspType(insp.type||'종합');
  openModal('addInspection');
}
function saveInspection(){
  const id=document.getElementById('insp_id').value;
  const bld=document.getElementById('insp_bld').value;
  const fy=parseInt(document.getElementById('insp_fy').value);
  const type=document.getElementById('insp_type').value;
  const start=document.getElementById('insp_start').value;
  const end=document.getElementById('insp_end').value;
  const company=document.getElementById('insp_company').value.trim();
  const report=document.getElementById('insp_report').value;
  const memo=document.getElementById('insp_memo').value.trim();
  if(!type||!start||!end){toast('점검종류, 시작일, 종료일은 필수입니다','error');return;}
  db.inspections=db.inspections||[];
  if(id){
    const insp=db.inspections.find(x=>x.id===id);
    if(insp)Object.assign(insp,{fy,type,start,end,company,report,memo,updatedAt:tod(),by:getW()});
  } else {
    db.inspections.push({id:uid(),bld,fy,type,start,end,company,report,memo,createdAt:tod(),by:getW()});
  }
  saveLocal();closeModal('addInspection');
  renderBuilding(bld);
  toast(id?'수정됐습니다':'등록됐습니다','success');
}
function deleteInspection(id,bldKey){
  if(!confirm('삭제하시겠습니까?'))return;
  db.inspections=(db.inspections||[]).filter(x=>x.id!==id);
  saveLocal();renderBuilding(bldKey);toast('삭제됐습니다');
}


// ── 보완사항 ──
const REMEDY_STATUS = {
  '자체보수': {color:'var(--primary)', badge:'b-primary', icon:'🔧'},
  '업체보수': {color:'var(--amber)',   badge:'b-amber',   icon:'🏗️'},
  '완료':     {color:'var(--green)',   badge:'b-green',   icon:'✅'}
};

function renderRemedyList(inspId){
  var rems = (db.remedies||[]).filter(function(r){return r.inspId===inspId;});
  if(!rems.length) return '<div style="font-size:12px;color:var(--text3);padding:4px 0">등록된 보완사항이 없어요</div>';
  var total = rems.length;
  var done  = rems.filter(function(r){return r.status==='완료';}).length;
  var html = '';
  html += '<div style="font-size:11px;color:var(--text3);margin-bottom:6px">전체 '+total+'건 · 완료 '+done+'건 · 미완료 '+(total-done)+'건</div>';
  rems.forEach(function(r){
    var st = REMEDY_STATUS[r.status]||{color:'var(--gray)',badge:'b-gray',icon:'📌'};
    html += '<div style="display:flex;align-items:flex-start;gap:8px;padding:7px 8px;background:var(--surface);border-radius:var(--radius-xs);margin-bottom:5px;border-left:3px solid '+st.color+'">';
    html += '<div style="flex:1;min-width:0">';
    html += '<div style="font-size:12px;color:var(--text);line-height:1.5">'+r.content+'</div>';
    if(r.memo) html += '<div style="font-size:11px;color:var(--text3);margin-top:2px">'+r.memo+'</div>';
    html += '</div>';
    html += '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">';
    html += '<span class="badge '+st.badge+'" style="font-size:10px">'+st.icon+' '+(r.status||'미처리')+'</span>';
    html += '<div style="display:flex;gap:3px;flex-wrap:wrap;justify-content:flex-end">';
    if(r.status !== '완료'){
      html += '<button class="btn btn-xs btn-outline-green" onclick="quickCompleteRemedy(\''+r.id+'\',\''+inspId+'\')" style="font-size:10px;padding:2px 6px">✅ 완료</button>';
    }
    html += '<button class="btn btn-xs" onclick="openEditRemedy(\''+r.id+'\')" style="font-size:10px;padding:2px 6px">수정</button>';
    html += '<button class="btn btn-xs btn-outline-red" onclick="deleteRemedy(\''+r.id+'\',\''+inspId+'\')" style="font-size:10px;padding:2px 6px">삭제</button>';
    html += '</div></div></div>';
  });
  return html;
}

function selectRemedyStatus(s){
  document.getElementById('rem_status').value=s;
  ['자체보수','업체보수','완료'].forEach(x=>{
    const btn=document.getElementById('rem_s_'+x);
    const st=REMEDY_STATUS[x];
    btn.style.background=x===s?st.color:'';
    btn.style.color=x===s?'#fff':'';
    btn.style.fontWeight=x===s?'700':'400';
    btn.style.borderColor=x===s?st.color:'var(--border2)';
  });
}

function openAddRemedy(inspId, bldKey){
  document.getElementById('rem_id').value='';
  document.getElementById('rem_inspId').value=inspId;
  document.getElementById('rem_bld').value=bldKey;
  document.getElementById('remedyModalTitle').textContent='보완사항 등록';
  document.getElementById('rem_content').value='';
  document.getElementById('rem_memo').value='';
  document.getElementById('rem_status').value='';
  ['자체보수','업체보수','완료'].forEach(x=>{
    const btn=document.getElementById('rem_s_'+x);
    btn.style.background='';btn.style.color='';btn.style.fontWeight='400';btn.style.borderColor='var(--border2)';
  });
  openModal('addRemedy');
}

function openEditRemedy(id){
  const r=(db.remedies||[]).find(x=>x.id===id);if(!r)return;
  document.getElementById('rem_id').value=id;
  document.getElementById('rem_inspId').value=r.inspId;
  document.getElementById('rem_bld').value=r.bld;
  document.getElementById('remedyModalTitle').textContent='보완사항 수정';
  document.getElementById('rem_content').value=r.content||'';
  document.getElementById('rem_memo').value=r.memo||'';
  selectRemedyStatus(r.status||'자체보수');
  openModal('addRemedy');
}

function saveRemedy(){
  const id=document.getElementById('rem_id').value;
  const inspId=document.getElementById('rem_inspId').value;
  const bld=document.getElementById('rem_bld').value;
  const content=document.getElementById('rem_content').value.trim();
  const status=document.getElementById('rem_status').value;
  const memo=document.getElementById('rem_memo').value.trim();
  if(!content){toast('보완 내용을 입력해 주세요','error');return;}
  if(!status){toast('처리 방법을 선택해 주세요','error');return;}
  db.remedies=db.remedies||[];
  if(id){
    const r=db.remedies.find(x=>x.id===id);
    if(r)Object.assign(r,{content,status,memo,updatedAt:tod(),by:getW()});
  } else {
    db.remedies.push({id:uid(),inspId,bld,content,status,memo,createdAt:tod(),by:getW()});
  }
  saveLocal();closeModal('addRemedy');
  // 해당 점검의 보완사항 목록만 업데이트
  const listEl=document.getElementById('remedyList_'+inspId);
  if(listEl)listEl.innerHTML=renderRemedyList(inspId);
  toast(id?'수정됐습니다':'등록됐습니다','success');
}

function quickCompleteRemedy(id, inspId){
  var r=(db.remedies||[]).find(function(x){return x.id===id;});
  if(!r) return;
  r.status='완료';
  r.updatedAt=tod();
  saveLocal();
  var listEl=document.getElementById('remedyList_'+inspId);
  if(listEl) listEl.innerHTML=renderRemedyList(inspId);
  toast('완료 처리됐습니다','success');
}
function deleteRemedy(id, inspId){
  if(!confirm('삭제하시겠습니까?'))return;
  db.remedies=(db.remedies||[]).filter(x=>x.id!==id);
  saveLocal();
  const listEl=document.getElementById('remedyList_'+inspId);
  if(listEl)listEl.innerHTML=renderRemedyList(inspId);
  toast('삭제됐습니다');
}


// ── 자체점검 ──
const SELFCHECK_ITEMS = [
  {id:'hospital', name:'병원', icon:'🏥'},
  {id:'univ',     name:'대학', icon:'🎓'},
  {id:'wonui',    name:'원의학사', icon:'🏫'}
];

function renderSelfCheck(){
  var el = document.getElementById('selfcheckContent');
  if(!el) return;

  var insps = (db.inspections||[]).filter(function(x){return x.bld==='selfcheck';});
  var fySet = new Set(insps.map(function(x){return x.fy;}));
  var curFY = getCurrentFY();
  fySet.add(curFY);
  var fys = [...fySet].sort(function(a,b){return b-a;});

  var reportColors = {'업체작성중':'b-amber','자료검토중':'b-primary','소방서제출완료':'b-green'};
  var typeColors = {'종합':'b-primary','작동':'b-teal'};

  var html = '';

  // 헤더
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">';
  html += '<div style="font-size:16px;font-weight:700;color:var(--text)">🔍 자체점검</div>';
  html += '<button class="btn btn-primary btn-sm" onclick="openAddSelfCheck()">+ 점검 등록</button>';
  html += '</div>';

  // 항목 안내
  html += '<div style="background:var(--primary-light);border:1px solid var(--primary-border);border-radius:var(--radius-sm);padding:10px 14px;margin-bottom:16px">';
  html += '<div style="font-size:12px;font-weight:600;color:var(--primary);margin-bottom:6px">📍 점검 대상</div>';
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
  SELFCHECK_ITEMS.forEach(function(item){
    html += '<span class="badge b-primary">'+item.icon+' '+item.name+'</span>';
  });
  html += '</div></div>';

  // 회계연도별 이력
  fys.forEach(function(fy){
    var fyInsps = insps.filter(function(x){return x.fy===fy;}).sort(function(a,b){return a.start.localeCompare(b.start);});
    var isCur = fy === curFY;

    html += '<div style="background:var(--surface);border-radius:var(--radius);box-shadow:var(--shadow);margin-bottom:12px;overflow:hidden;'+(isCur?'border:2px solid var(--primary)':'')+'">';
    html += '<div style="padding:12px 16px;background:'+(isCur?'var(--primary-light)':'var(--surface2)')+';border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">';
    html += '<div style="font-size:13px;font-weight:700;color:'+(isCur?'var(--primary)':'var(--text2)')+'">'+(isCur?'📌 ':'')+getFYLabel(fy)+'</div>';
    if(isCur) html += '<span class="badge b-primary">현재</span>';
    html += '</div>';
    html += '<div style="padding:10px">';

    if(fyInsps.length){
      fyInsps.forEach(function(insp){
        var itemCfg = SELFCHECK_ITEMS.find(function(x){return x.id===insp.scTarget;}) || {name:insp.scTarget||'', icon:'📋'};
        html += '<div style="background:var(--surface2);border-radius:var(--radius-sm);padding:12px 14px;margin-bottom:8px;border-left:3px solid var(--primary)">';
        html += '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px">';
        html += '<div style="flex:1">';
        html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap">';
        html += '<span class="badge b-primary">'+itemCfg.icon+' '+itemCfg.name+'</span>';
        html += '<span class="badge '+(typeColors[insp.type]||'b-gray')+'">'+insp.type+'점검</span>';
        html += '<span style="font-size:13px;font-weight:700;color:var(--text)">'+insp.start+' ~ '+insp.end+'</span>';
        html += '</div>';
        if(insp.company) html += '<div style="font-size:12px;color:var(--text3)">업체: '+insp.company+'</div>';
        html += '</div>';
        html += '<div style="display:flex;gap:4px;flex-shrink:0">';
        html += '<button class="btn btn-xs" onclick="openEditInspection(\''+insp.id+'\')">수정</button>';
        html += '<button class="btn btn-xs btn-outline-red" onclick="deleteSelfCheck(\''+insp.id+'\')">삭제</button>';
        html += '</div></div>';

        if(insp.report){
          html += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px">';
          html += '<span style="font-size:11px;color:var(--text3)">보고서</span>';
          html += '<span class="badge '+(reportColors[insp.report]||'b-gray')+'">'+insp.report+'</span>';
          html += '</div>';
        }
        if(insp.memo){
          html += '<div style="font-size:12px;color:var(--text2);background:var(--surface);padding:8px;border-radius:var(--radius-xs);white-space:pre-line;margin-top:4px">'+insp.memo+'</div>';
        }
        // 보완사항
        html += '<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:8px">';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">';
        html += '<div style="font-size:12px;font-weight:700;color:var(--text2)">📋 보완사항</div>';
        html += '<button class="btn btn-xs btn-outline-primary" onclick="openAddRemedy(\''+insp.id+'\',\'selfcheck\')">+ 추가</button>';
        html += '</div>';
        html += '<div id="remedyList_'+insp.id+'">'+renderRemedyList(insp.id)+'</div>';
        html += '</div>';
        html += '</div>';
      });
    } else {
      html += '<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px">등록된 점검 이력이 없어요<br>상단 + 점검 등록 버튼을 눌러주세요</div>';
    }
    html += '</div></div>';
  });

  el.innerHTML = html;
}

function openAddSelfCheck(){
  // 자체점검 전용 등록 - scTarget 선택 추가
  document.getElementById('insp_id').value='';
  document.getElementById('insp_bld').value='selfcheck';
  document.getElementById('inspModalTitle').textContent='자체점검 등록';
  document.getElementById('insp_type').value='';
  document.getElementById('insp_start').value='';
  document.getElementById('insp_end').value='';
  document.getElementById('insp_company').value='';
  document.getElementById('insp_report').value='';
  document.getElementById('insp_memo').value='';
  ['종합','작동'].forEach(function(x){
    var btn=document.getElementById('insp_t_'+x);
    btn.style.background='';btn.style.color='';btn.style.fontWeight='400';btn.style.borderColor='var(--border2)';
  });
  populateInspFY();
  // scTarget 셀렉트 업데이트
  var sel = document.getElementById('insp_scTarget');
  if(sel) sel.style.display='block';
  var wrap = document.getElementById('insp_scTarget_wrap');
  if(wrap) wrap.style.display='block';
  openModal('addInspection');
}

function deleteSelfCheck(id){
  if(!confirm('삭제하시겠습니까?')) return;
  db.inspections=(db.inspections||[]).filter(function(x){return x.id!==id;});
  saveLocal(); renderSelfCheck(); toast('삭제됐습니다');
}

// ── Toast ──
function toast(msg,type=''){
  const el=document.createElement('div');el.className='toast'+(type?' '+type:'');el.textContent=msg;
  document.getElementById('toastWrap').appendChild(el);setTimeout(()=>el.remove(),2800);
}

// ── 시작 ──
(function start(){
  const now=new Date();calYear=now.getFullYear();calMonth=now.getMonth();selDate=tod();
  isDark=localStorage.getItem('fb_dark')==='1';
  if(isDark)document.body.classList.add('dark');
  try{const d=localStorage.getItem('fb_db');if(d)db=Object.assign(db,JSON.parse(d));}catch{}

  // Firebase SDK 미리 로드 (로그인 전에 준비)
  if(typeof firebase==='undefined'){
    let n=0;
    ['https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js',
     'https://www.gstatic.com/firebasejs/9.22.2/firebase-database-compat.js'].forEach(src=>{
      const s=document.createElement('script');s.src=src;
      s.onload=()=>{
        if(++n===2){
          try{
            if(!firebase.apps.length)firebase.initializeApp(FIREBASE_CONFIG);
          }catch(e){}
        }
      };
      document.head.appendChild(s);
    });
  }

  if(!tryAutoLogin()){
    document.getElementById('loginScreen').style.display='flex';
  }
})();
