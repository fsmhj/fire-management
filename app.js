
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
  {id:'extinguisher',label:'🧯 소화기'},
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
let userName='',isAdmin=false,myTabs=[],isDark=false,firebaseRef=null,firebaseLoaded=false;
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

  const btn=document.querySelector('#loginScreen .btn-primary');
  btn.textContent='확인 중...';btn.disabled=true;

  function checkLogin(d){
    btn.textContent='입장하기';btn.disabled=false;
    const userPw=(d&&d.userPw)||DEFAULT_USER_PW;
    const adminPw=(d&&d.adminPw)||DEFAULT_ADMIN_PW;
    if(d) db=Object.assign(db,d);

    if(pw===adminPw){
      isAdmin=true;userName=name;
      myTabs=ALL_TABS.map(function(t){return t.id;});
      localStorage.setItem('fb_myTabs',JSON.stringify(myTabs));
      enterApp();
    } else if(pw===userPw){
      isAdmin=false;userName=name;
      const members=d&&d.members ? (Array.isArray(d.members)?d.members:Object.values(d.members)) : (db.members||[]);
      const member=members.find(function(m){return m.name===name;});
      if(!member){
        // 팀원 목록에 없으면 기본 탭만
        myTabs=['home'];
        localStorage.setItem('fb_myTabs',JSON.stringify(myTabs));
      } else {
        myTabs=member.tabs||['home'];
        localStorage.setItem('fb_myTabs',JSON.stringify(myTabs));
      }
      enterApp();
    } else {
      err.textContent='비밀번호가 올바르지 않습니다';err.style.display='block';
      document.getElementById('loginPw').value='';
    }
  }

  // Firebase에서 최신 데이터 받아온 뒤 로그인
  if(typeof firebase!=='undefined'&&firebase.apps&&firebase.apps.length){
    firebase.database().ref('sobangtm').once('value').then(function(snap){
      checkLogin(snap.val());
    }).catch(function(){
      checkLogin(null);
    });
  } else {
    // Firebase 미준비 - 로컬 데이터로 확인
    checkLogin(db);
  }
}

function enterApp(){
  localStorage.setItem('fb_user',userName);
  localStorage.setItem('fb_isAdmin',isAdmin?'1':'0');
  localStorage.setItem('fb_myTabs',JSON.stringify(myTabs));
  localStorage.setItem('fb_pwVersion',String(db.pwVersion||0));
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
function confirmLogout(){
  if(confirm(userName+'님, 로그아웃 하시겠습니까?')){
    doLogout();
  }
}
function doLogout(){
  if(!confirm('로그아웃 하시겠습니까?'))return;
  localStorage.removeItem('fb_user');localStorage.removeItem('fb_isAdmin');localStorage.removeItem('fb_myTabs');
  location.reload();
}
function tryAutoLogin(){
  const n=localStorage.getItem('fb_user');
  const a=localStorage.getItem('fb_isAdmin')==='1';
  if(!n) return false;

  // 로딩 화면 표시
  document.getElementById('loginScreen').style.display='flex';
  userName=n; isAdmin=a;

  // Firebase에서 최신 데이터 확인 후 입장
  function doEnterWithFirebase(){
    if(typeof firebase==='undefined'||!firebase.apps||!firebase.apps.length){
      // Firebase 미준비 - 로컬 데이터로 입장
      const t=localStorage.getItem('fb_myTabs');
      if(t) myTabs=JSON.parse(t);
      else myTabs=ALL_TABS.map(function(x){return x.id;});
      enterApp();
      return;
    }
    firebase.database().ref('sobangtm').once('value').then(function(snap){
      const d=snap.val();
      if(d) db=Object.assign(db,d);

      // 최신 팀원 권한 가져오기
      if(!isAdmin){
        const members=db.members||[];
        const member=members.find(function(m){return m.name===n;});
        if(member){
          myTabs=member.tabs||[];
          localStorage.setItem('fb_myTabs',JSON.stringify(myTabs));
        } else {
          // 팀원 목록에 없으면 로그아웃
          localStorage.removeItem('fb_user');
          localStorage.removeItem('fb_isAdmin');
          localStorage.removeItem('fb_myTabs');
          document.getElementById('loginScreen').style.display='flex';
          return;
        }
      } else {
        myTabs=ALL_TABS.map(function(x){return x.id;});
      }
      enterApp();
    }).catch(function(){
      // 오류 시 로컬 데이터로 입장
      const t=localStorage.getItem('fb_myTabs');
      if(t) myTabs=JSON.parse(t);
      else myTabs=ALL_TABS.map(function(x){return x.id;});
      enterApp();
    });
  }

  // Firebase SDK 로드 대기
  if(typeof firebase==='undefined'){
    let n2=0;
    ['https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js',
     'https://www.gstatic.com/firebasejs/9.22.2/firebase-database-compat.js'].forEach(function(src){
      const s=document.createElement('script');s.src=src;
      s.onload=function(){
        if(++n2===2){
          try{ if(!firebase.apps.length)firebase.initializeApp(FIREBASE_CONFIG); }catch(e){}
          doEnterWithFirebase();
        }
      };
      document.head.appendChild(s);
    });
  } else {
    doEnterWithFirebase();
  }
  return true;
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
    var fbFirstLoad = true;
    firebaseRef.on('value',snap=>{
      const d=snap.val();
      if(d){
        db=Object.assign(db,d);
        localStorage.setItem('fb_db',JSON.stringify(db));
        checkKicked();
        if(fbFirstLoad){
          fbFirstLoad = false;
          firebaseLoaded = true; // Firebase 데이터 수신 완료
          // 첫 로드 시 myTabs 최신화
          if(!isAdmin){
            const members=db.members||[];
            const member=members.find(function(m){return m.name===userName;});
            if(member){
              myTabs=member.tabs||[];
              localStorage.setItem('fb_myTabs',JSON.stringify(myTabs));
              buildNav(); // 네비도 갱신
            }
          }
          renderAll();
          renderHome();
        } else {
          renderAll();
          renderHome();
        }
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
function checkKicked(){
  if(isAdmin) return;
  // 비밀번호 버전 체크 - 변경됐으면 자동 로그아웃
  const savedVersion=parseInt(localStorage.getItem('fb_pwVersion')||'0');
  const currentVersion=db.pwVersion||0;
  if(currentVersion>savedVersion){
    localStorage.removeItem('fb_user');
    localStorage.removeItem('fb_isAdmin');
    localStorage.removeItem('fb_myTabs');
    localStorage.removeItem('fb_pwVersion');
    alert('비밀번호가 변경됐습니다. 다시 로그인해 주세요.');
    location.reload();
    return;
  }
  // 최신 권한으로 업데이트
  const members=db.members||[];
  const member=members.find(function(m){return m.name===userName;});
  if(!member) return;
  if(JSON.stringify(myTabs)!==JSON.stringify(member.tabs)){
    myTabs=member.tabs||[];
    localStorage.setItem('fb_myTabs',JSON.stringify(myTabs));
    buildNav();
    renderHome();
  }
}
function switchPage(p){
  if(p==='txnHistory'){curPage=p;document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id==='page-'+p));renderTxnHistory();return;}
  if(!isAdmin&&!myTabs.includes(p)){toast('접근 권한이 없습니다','error');return;}
  curPage=p;
  document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id==='page-'+p));
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.page===p));

  renderCurrent();
}
function renderAll(){
  renderInv();renderJournal();renderCalendar();renderMonthSchedule();renderMemo();renderSettings();
  if(document.getElementById('selfcheckContent'))renderSelfCheck();
  if(document.getElementById('extinguisherContent'))renderExtinguisher();
  if(document.getElementById('jonghamContent'))renderBuilding('jongham');
  if(document.getElementById('seomigamContent'))renderBuilding('seomigam');
  renderHome(); // 항상 마지막에 - tabs 확정 후
}
function renderCurrent(){
  if(curPage==='inv')renderInv();
  if(curPage==='journal')renderJournal();
  if(curPage==='schedule'){renderCalendar();renderScheduleList();}
  if(curPage==='home') renderHome();
  if(curPage==='selfcheck')renderSelfCheck();
  if(curPage==='extinguisher')renderExtinguisher();
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
  if(!newU&&!newA){toast('변경할 비밀번호를 입력해 주세요','error');return;}
  if(newU){
    db.userPw=newU;
    // 일반 비밀번호 변경 시 버전 업데이트 → 모든 팀원 자동 로그아웃
    db.pwVersion=(db.pwVersion||0)+1;
  }
  if(newA) db.adminPw=newA;
  saveLocal();
  document.getElementById('newUserPw').value='';document.getElementById('newAdminPw').value='';
  toast('비밀번호가 변경됐습니다. 팀원들이 자동 로그아웃됩니다.','success');
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
  var tabs = isAdmin ? ALL_TABS.map(function(t){return t.id;}) : (myTabs||[]);

  // Firebase 데이터 수신 전이면 카드 숨기기
  if(!firebaseLoaded && !isAdmin){
    var wraps=['homeScheduleWrap','homeLowStockWrap','homeInspectionWrap','homeJournalWrap'];
    wraps.forEach(function(id){
      var el=document.getElementById(id);
      if(el) el.style.display='none';
    });
    return;
  }

  // 인사말
  var greetEl = document.getElementById('homeGreeting');
  if(greetEl){
    greetEl.innerHTML = '<div style="background:var(--primary);border-radius:var(--radius);padding:14px 20px;color:#fff;display:flex;align-items:center;justify-content:space-between">'
      + '<div><div style="font-size:12px;opacity:.85;margin-bottom:3px">'+greet+'</div>'
      + '<div style="font-size:17px;font-weight:700">'+(userName||'팀원')+'님 👋</div></div>'
      + '<div style="font-size:13px;opacity:.75;text-align:right"><div>'+todStr+'</div>'
      + '<div style="margin-top:3px;font-size:11px">소방업무공유</div></div></div>';
  }

  // 권한에 따라 카드 보이기/숨기기
  var show = function(id, visible){
    var el = document.getElementById(id);
    if(el) el.style.display = visible ? '' : 'none';
  };

  var hasSchedule = isAdmin || tabs.includes('schedule');
  var hasInv      = isAdmin || tabs.includes('inv');
  var hasJongham  = isAdmin || tabs.includes('jongham');
  var hasSeomigam = isAdmin || tabs.includes('seomigam');
  var hasInsp     = hasJongham || hasSeomigam;
  var hasJournal  = isAdmin || tabs.includes('journal');

  show('homeScheduleWrap', hasSchedule);
  show('homeLowStockWrap', hasInv);
  show('homeInspectionWrap', hasInsp);
  show('homeJournalWrap', hasJournal);
  show('homeInspBtnJongham', hasJongham);
  show('homeInspBtnSeomigam', hasSeomigam);

  // 일정 내용
  if(hasSchedule){
    var schEl = document.getElementById('homeSchedule');
    if(schEl){
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
            +'<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;color:var(--text)">'+s.title+'</div>'
            +'<div style="font-size:11px;color:var(--text3)">'+s.date+(s.time?' '+s.time:'')+' · '+(s.cat||'기타')+'</div></div></div>';
        });
        schEl.innerHTML=sh;
      }
    }
  }

  // 부족품목 내용
  if(hasInv){
    var lowEl = document.getElementById('homeLowStock');
    if(lowEl){
      var lows = db.items.filter(function(it){return it.min>0&&it.qty<=it.min;});
      if(!lows.length){
        lowEl.innerHTML='<div style="text-align:center;padding:12px;color:var(--green);font-size:13px">✓ 모든 품목 재고 정상</div>';
      } else {
        var lh='';
        lows.forEach(function(it){
          lh+='<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 4px;border-bottom:1px solid var(--border);font-size:12px">'
            +'<span style="color:var(--text);font-weight:600">'+it.name+'</span>'
            +'<span style="color:var(--red);font-weight:700">'+it.qty+(it.unit||'개')+' / 최소 '+it.min+(it.unit||'개')+'</span></div>';
        });
        lowEl.innerHTML=lh;
      }
    }
  }

  // 점검현황 내용
  if(hasInsp){
    var inspEl = document.getElementById('homeInspection');
    if(inspEl){
      var curFY2 = getCurrentFY();
      var ih='';
      if(hasJongham){
        var cfg2=BLD_CONFIG['jongham'];
        var bi=(db.inspections||[]).filter(function(x){return x.bld==='jongham'&&x.fy===curFY2;});
        ih+='<div style="padding:8px 4px;border-bottom:1px solid var(--border)">'
          +'<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:6px">'+cfg2.icon+' '+cfg2.name+'</div>';
        if(bi.length){
          bi.forEach(function(insp){
            ih+='<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px">'
              +'<span class="badge b-gray">'+insp.type+'점검</span>'
              +'<span style="font-size:11px;color:var(--text3)">'+insp.start+'~'+insp.end+'</span>'
              +(insp.report?'<span style="font-size:11px;font-weight:600;color:var(--primary)">📋 '+insp.report+'</span>':'')
              +'</div>';
          });
        } else { ih+='<div style="font-size:12px;color:var(--text3)">등록된 점검 없음</div>'; }
        ih+='</div>';
      }
      if(hasSeomigam){
        var cfg3=BLD_CONFIG['seomigam'];
        var si=(db.inspections||[]).filter(function(x){return x.bld==='seomigam'&&x.fy===curFY2;});
        ih+='<div style="padding:8px 4px">'
          +'<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:6px">'+cfg3.icon+' '+cfg3.name+'</div>';
        if(si.length){
          si.forEach(function(insp){
            ih+='<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px">'
              +'<span class="badge b-gray">'+insp.type+'점검</span>'
              +'<span style="font-size:11px;color:var(--text3)">'+insp.start+'~'+insp.end+'</span>'
              +(insp.report?'<span style="font-size:11px;font-weight:600;color:var(--primary)">📋 '+insp.report+'</span>':'')
              +'</div>';
          });
        } else { ih+='<div style="font-size:12px;color:var(--text3)">등록된 점검 없음</div>'; }
        ih+='</div>';
      }
      inspEl.innerHTML=ih;
    }
  }

  // 업무일지 내용
  if(hasJournal){
    var jrnEl = document.getElementById('homeJournal');
    if(jrnEl){
      var recent=[...db.journals].sort(function(a,b){return b.createdAt.localeCompare(a.createdAt);}).slice(0,3);
      if(!recent.length){
        jrnEl.innerHTML='<div style="text-align:center;padding:12px;color:var(--text3);font-size:13px">최근 업무일지가 없어요</div>';
      } else {
        var jh='';
        recent.forEach(function(j){
          jh+='<div style="padding:8px 4px;border-bottom:1px solid var(--border);cursor:pointer" onclick="switchPage(\'journal\')">'
            +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'
            +'<span class="journal-place '+(j.placeType||'hospital')+'" style="font-size:11px;padding:2px 8px">'+j.place+'</span>'
            +'<span style="font-size:11px;color:var(--text3)">'+j.date+' · '+(j.by||'')+'</span></div>'
            +'<div style="font-size:13px;color:var(--text);line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">'+j.content+'</div></div>';
        });
        jrnEl.innerHTML=jh;
      }
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

        // 보고서 현황 + 마감일 D-day
        html += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px">';
        if(insp.report){
          html += '<span style="font-size:11px;color:var(--text3)">보고서</span>';
          html += '<span class="badge '+(reportColors[insp.report]||'b-gray')+'">'+insp.report+'</span>';
        }
        if(insp.deadline){
          var todStr2=tod();
          var diff2=Math.ceil((new Date(insp.deadline)-new Date(todStr2))/86400000);
          var isPast2=diff2<0;
          var isToday2=diff2===0;
          var dColor=isPast2?'var(--red)':isToday2?'var(--red)':diff2<=7?'var(--amber)':'var(--primary)';
          var dLabel=isPast2?'D+'+Math.abs(diff2)+' 초과':isToday2?'오늘 마감':'D-'+diff2;
          html += '<span style="font-size:11px;font-weight:700;color:'+dColor+';background:var(--surface);border:1px solid '+dColor+';border-radius:10px;padding:1px 8px">📅 마감 '+dLabel+'</span>';
          html += '<span style="font-size:10px;color:var(--text3)">'+insp.deadline+'</span>';
        }
        html += '<button class="btn btn-xs" onclick="openAddDeadline(\''+insp.id+'\',\''+bldKey+'\')" style="font-size:10px;padding:2px 6px;margin-left:auto">'+(insp.deadline?'마감일 수정':'📅 마감일 등록')+'</button>';
        html += '</div>';
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


// ── 소화기 관리 ──
const EXT_BUILDINGS = ["신관", "응급센터", "외상센터", "외래센터", "후생관", "정문주차장(후생관)", "종합관", "의학관", "별관", "진리관", "영빈관", "루가홀", "원의1학사", "원의2학사", "원의3학사", "장례식장", "장례식장 철골주차장", "부설주차장 및 재활용창고", "가설사무실", "YWCA 건물"];
const EXT_DEFAULT_DATA = {"신관": [{"no": 1, "floor": "PH2", "room": "전기실-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2021, "maker": "삼우산기"}, {"no": 2, "floor": "PH2", "room": "전기실-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2021, "maker": "삼우산기"}, {"no": 3, "floor": "PH2", "room": "전기실-3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2022, "maker": "CW소방"}, {"no": 4, "floor": "PH2", "room": "물탱크실", "mgmt": "", "kind": "자동확산", "size": "3", "year": null, "maker": ""}, {"no": 5, "floor": "PH2", "room": "물탱크실", "mgmt": "", "kind": "자동확산", "size": "3", "year": null, "maker": ""}, {"no": 6, "floor": "PH1", "room": "E/L기계실-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 7, "floor": "PH1", "room": "E/L기계실-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 8, "floor": "PH1", "room": "공조실A-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 9, "floor": "PH1", "room": "공조실A-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 10, "floor": "PH1", "room": "공조실B-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 11, "floor": "PH1", "room": "공조실B-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 12, "floor": "PH1", "room": "공조실C-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 13, "floor": "PH1", "room": "공조실C-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 14, "floor": "111W", "room": "간호사실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 15, "floor": "111W", "room": "6호실 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 16, "floor": "111W", "room": "15호실 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 17, "floor": "111W", "room": "비상계단 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2022, "maker": "CW소방"}, {"no": 18, "floor": "111W", "room": "조혈모 세포이식센터 전실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2022, "maker": "CW소방"}, {"no": 19, "floor": "112W", "room": "간호사실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 20, "floor": "112W", "room": " 16호실앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 21, "floor": "112W", "room": "18호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 22, "floor": "101W", "room": "간호사실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2022, "maker": "삼우산기"}, {"no": 23, "floor": "101W", "room": "의사당직실 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 24, "floor": "101W", "room": "9호실 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 25, "floor": "101W", "room": "1호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 26, "floor": "101W", "room": "2호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 27, "floor": "101W", "room": "3호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 28, "floor": "101W", "room": "5호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 29, "floor": "101W", "room": "6호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 30, "floor": "101W", "room": "9호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 31, "floor": "101W", "room": "10호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 32, "floor": "102W", "room": "간호사실 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 33, "floor": "102W", "room": "8호실 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 34, "floor": "102W", "room": "1호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 35, "floor": "102W", "room": "2호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 36, "floor": "102W", "room": "3호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2022, "maker": "CW소방"}, {"no": 37, "floor": "102W", "room": "5호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 38, "floor": "102W", "room": "6호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 39, "floor": "102W", "room": "7호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 40, "floor": "102W", "room": "8호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 41, "floor": "91W", "room": "간호사실 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 42, "floor": "91W", "room": "의사당직실 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 43, "floor": "91W", "room": "8호실 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 44, "floor": "91W", "room": "1호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2022, "maker": "CW소방"}, {"no": 45, "floor": "91W", "room": "2호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 46, "floor": "91W", "room": "3호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 47, "floor": "91W", "room": "5호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 48, "floor": "91W", "room": "6호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 49, "floor": "91W", "room": "8호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 50, "floor": "91W", "room": "9호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 51, "floor": "92W", "room": "간호사실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 52, "floor": "92W", "room": "8호실 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 53, "floor": "92W", "room": "1호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2021, "maker": "삼우산기"}, {"no": 54, "floor": "92W", "room": "2호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 55, "floor": "92W", "room": "3호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 56, "floor": "92W", "room": "5호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 57, "floor": "92W", "room": "6호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 58, "floor": "92W", "room": "7호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 59, "floor": "92W", "room": "8호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 60, "floor": "92W", "room": "물리치료실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 61, "floor": "81W", "room": "간호사실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 62, "floor": "81W", "room": "8호실 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 63, "floor": "81W", "room": "1호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 64, "floor": "81W", "room": "2호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 65, "floor": "81W", "room": "3호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 66, "floor": "81W", "room": "5호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 67, "floor": "81W", "room": "8호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 68, "floor": "81W", "room": "9호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 69, "floor": "82W", "room": "간호사실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 70, "floor": "82W", "room": "8호실 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 71, "floor": "82W", "room": "허혈성 집중치료실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 72, "floor": "82W", "room": "2호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 73, "floor": "82W", "room": "3호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 74, "floor": "82W", "room": "5호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 75, "floor": "82W", "room": "6호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 76, "floor": "82W", "room": "7호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 77, "floor": "82W", "room": "8호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 78, "floor": "82W", "room": "병실촬영실 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 79, "floor": "82W", "room": "병실촬영실 -2", "mgmt": "", "kind": "가스계", "size": "3", "year": 2018, "maker": "포트텍"}, {"no": 80, "floor": "71W", "room": "간호사실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 81, "floor": "71W", "room": "당직실 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 82, "floor": "71W", "room": "  9호실 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2021, "maker": "삼우산기"}, {"no": 83, "floor": "71W", "room": "심혈관 관찰실 1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 84, "floor": "71W", "room": "심혈관 관찰실 2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 85, "floor": "71W", "room": "3호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 86, "floor": "71W", "room": "5호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 87, "floor": "71W", "room": "6호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 88, "floor": "71W", "room": "9호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 89, "floor": "71W", "room": "10호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 90, "floor": "72W", "room": "1호실 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 91, "floor": "72W", "room": "10호실 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 92, "floor": "72W", "room": "1호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 93, "floor": "72W", "room": "2호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2019, "maker": "태양소방산업"}, {"no": 94, "floor": "72W", "room": "3호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2019, "maker": "태양소방산업"}, {"no": 95, "floor": "72W", "room": "5호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 96, "floor": "72W", "room": "6호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 97, "floor": "61W", "room": "2호실 앞 복도 ", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 98, "floor": "61W", "room": "9호실 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 99, "floor": "61W", "room": "1호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 100, "floor": "61W", "room": "2호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 101, "floor": "61W", "room": "3호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 102, "floor": "61W", "room": "5호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 103, "floor": "61W", "room": "6호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 104, "floor": "61W", "room": "9호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 105, "floor": "61W", "room": "10호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 106, "floor": "61W", "room": "준비실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 107, "floor": "6", "room": "MICU 간호사실 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 108, "floor": "6", "room": "MICU 간호사실 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 109, "floor": "6", "room": "MICU 간호사실 -3", "mgmt": "", "kind": "가스계", "size": "3", "year": 2018, "maker": "포트텍"}, {"no": 110, "floor": "6", "room": "NSICU 입구", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 111, "floor": "6", "room": "중환자실 대기실 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 112, "floor": "6", "room": "NSICU -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2021, "maker": "삼우산기"}, {"no": 113, "floor": "6", "room": "NSICU -2", "mgmt": "", "kind": "가스계", "size": "3", "year": 2018, "maker": "포트텍"}, {"no": 114, "floor": "6", "room": "NSICU -3 (소화전 앞)", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 115, "floor": "6", "room": "통신실-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 116, "floor": "6", "room": "통신실-2", "mgmt": "", "kind": "Halon", "size": "3", "year": 1989, "maker": "협동"}, {"no": 117, "floor": "6", "room": "린넨실-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 118, "floor": "6", "room": "린넨실-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 119, "floor": "6", "room": "린넨실-3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 120, "floor": "6", "room": "린넨실-4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 121, "floor": "6", "room": "조립식 건물 입구 측 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 122, "floor": "6", "room": "간호국 탈의실(남) -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 123, "floor": "6", "room": "학생탈의실(여)", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 124, "floor": "6", "room": "진료예약센터", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2021, "maker": "삼우산기"}, {"no": 125, "floor": "6", "room": "진료예약센터(안쪽)", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 126, "floor": "6", "room": "공조실-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 127, "floor": "6", "room": "공조실-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 128, "floor": "6", "room": "NSICU.MICU 탈의실 앞 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 129, "floor": "6", "room": "NSICU.MICU 탈의실 앞 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 130, "floor": "51W", "room": "간호사실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 131, "floor": "51W", "room": "9호실 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 132, "floor": "51W", "room": "1호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 133, "floor": "51W", "room": "2호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 134, "floor": "51W", "room": "3호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 135, "floor": "51W", "room": "5호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 136, "floor": "51W", "room": "6호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 137, "floor": "51W", "room": "9호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 138, "floor": "51W", "room": "10호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 139, "floor": "51W", "room": "공조실-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "한국사회적\n협동조합"}, {"no": 140, "floor": "51W", "room": "공조실-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 141, "floor": "51W", "room": "의사회의실 앞 복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 142, "floor": "51W", "room": "의사회의실 앞 복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 143, "floor": "52W", "room": "1호실 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 144, "floor": "52W", "room": "좌욕실 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 145, "floor": "52W", "room": "MS-실습실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 146, "floor": "52W", "room": "1호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 147, "floor": "52W", "room": "2호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 148, "floor": "52W", "room": "3호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 149, "floor": "52W", "room": "5호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 150, "floor": "52W", "room": "6호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 151, "floor": "52W", "room": "7호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2022, "maker": "CW소방"}, {"no": 152, "floor": "52W", "room": "8호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 153, "floor": "52W", "room": "9호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 154, "floor": "53W", "room": "간호사실-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 155, "floor": "53W", "room": "간호사실-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 156, "floor": "53W", "room": "처치실-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 157, "floor": "53W", "room": "처치실-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 158, "floor": "53W", "room": "낮병동-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 159, "floor": "53W", "room": "낮병동-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 160, "floor": "53W", "room": "생명사랑 위기대응센터", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 161, "floor": "53W", "room": "비상계단측", "mgmt": "", "kind": "기타", "size": "600mL", "year": 2014, "maker": ""}, {"no": 162, "floor": "5", "room": "인공신장실-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 163, "floor": "5", "room": "인공신장실-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 164, "floor": "5", "room": "인공신장실-3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2022, "maker": "미래안전"}, {"no": 165, "floor": "5", "room": "인공신장실-4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2022, "maker": "미래안전"}, {"no": 166, "floor": "3", "room": "간호사스테이션 -1", "mgmt": "", "kind": "Halon", "size": "3", "year": 2009, "maker": "한창"}, {"no": 167, "floor": "3", "room": "간호사스테이션 -2", "mgmt": "", "kind": "Halon", "size": "3", "year": 2009, "maker": "한창"}, {"no": 168, "floor": "3", "room": "회복실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2022, "maker": "CW소방"}, {"no": 169, "floor": "3", "room": "회복실 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 170, "floor": "3", "room": "수술실 2번방 앞", "mgmt": "", "kind": "Halon", "size": "3", "year": 2003, "maker": "FIC"}, {"no": 171, "floor": "3", "room": "수술실 3번방 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2002, "maker": "티파니상사"}, {"no": 172, "floor": "3", "room": "수술실 6번방 앞 ", "mgmt": "", "kind": "Halon", "size": "3", "year": 2002, "maker": "FIC"}, {"no": 173, "floor": "3", "room": "수술실 9번방 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 174, "floor": "3", "room": "수술실 10번방 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 175, "floor": "3", "room": "멸균물품보관실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 176, "floor": "3", "room": "수술실 12번방 앞", "mgmt": "", "kind": "가스계", "size": "3", "year": 2025, "maker": "FIC"}, {"no": 177, "floor": "3", "room": "수술실 15번방 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 178, "floor": "3", "room": "마취과 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 179, "floor": "3", "room": "전공의탈의실-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 180, "floor": "3", "room": "전공의탈의실-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 181, "floor": "3", "room": "교수탈의실-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 182, "floor": "3", "room": "교수탈의실-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 183, "floor": "3", "room": "간호사탈의실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 184, "floor": "3", "room": "SICU-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 185, "floor": "3", "room": "SICU-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 186, "floor": "3", "room": "SICU-3", "mgmt": "", "kind": "가스계", "size": "3", "year": 2018, "maker": "포트텍"}, {"no": 187, "floor": "3", "room": "SICU-4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 188, "floor": "3", "room": "E/L 홀", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 189, "floor": "3", "room": "교수탈의실 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 190, "floor": "3", "room": "병실약국", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 191, "floor": "3", "room": "병실약국", "mgmt": "", "kind": "가스계", "size": "3", "year": 2018, "maker": "포트텍"}, {"no": 192, "floor": "3", "room": "약품관리파트", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 193, "floor": "3", "room": "약물창고", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 194, "floor": "3", "room": "무균조제실", "mgmt": "", "kind": "가스계", "size": "3", "year": 2019, "maker": "포트텍"}, {"no": 195, "floor": "3", "room": "병리과 끝 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 196, "floor": "3", "room": "병리과 중앙 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 197, "floor": "3", "room": "병리과(육안표본검사실) -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 198, "floor": "3", "room": "병리과(육안표본검사실) -2", "mgmt": "", "kind": "가스계", "size": "3", "year": 2018, "maker": "포트텍"}, {"no": 199, "floor": "3", "room": "병리과(조직병리검사실) -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 200, "floor": "3", "room": "병리과(조직병리검사실) -2", "mgmt": "", "kind": "가스계", "size": "3", "year": 2018, "maker": "포트텍"}, {"no": 201, "floor": "2", "room": "산부인과 대기실-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 202, "floor": "2", "room": "산부인과 대기실-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 203, "floor": "2", "room": "산부인과 초음파실 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 204, "floor": "2", "room": "산부인과 처치실 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 205, "floor": "2", "room": "산부인과 진료실8 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2021, "maker": "삼우산기"}, {"no": 206, "floor": "2", "room": "분만실  입구(복도측) -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 207, "floor": "2", "room": "분만실  입구(복도측) -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 208, "floor": "2", "room": "가족분만실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 209, "floor": "2", "room": "분만실 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 210, "floor": "2", "room": "분만실 2103호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 211, "floor": "2", "room": "분만실 2105호실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 212, "floor": "2", "room": "27병동 앞 복도 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 213, "floor": "2", "room": "27병동 앞 복도 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 214, "floor": "2", "room": "27병동 앞 복도 -3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 215, "floor": "2", "room": "주사실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 216, "floor": "2", "room": "영상의학과 판독실 복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 217, "floor": "2", "room": "영상의학과 판독실 복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 218, "floor": "2", "room": "영상의학과 초음파실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 219, "floor": "2", "room": "영상의학과 초음파실 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 220, "floor": "22W", "room": "병동 입구", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 221, "floor": "22W", "room": "2201호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 222, "floor": "22W", "room": "2202호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 223, "floor": "22W", "room": "2203호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 224, "floor": "22W", "room": "2205호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 225, "floor": "22W", "room": "2205호 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 226, "floor": "22W", "room": "2210호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 227, "floor": "22W", "room": "22병동 내부 EPS실 -1", "mgmt": "", "kind": "기타", "size": "", "year": null, "maker": ""}, {"no": 228, "floor": "22W", "room": "22병동 내부 EPS실 -2", "mgmt": "", "kind": "기타", "size": "", "year": null, "maker": ""}, {"no": 229, "floor": "22W", "room": "분만실 당직실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 230, "floor": "27W", "room": "간호사실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 231, "floor": "27W", "room": "2701호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 232, "floor": "27W", "room": "2702호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 233, "floor": "27W", "room": "2703호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 234, "floor": "27W", "room": "2707호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 235, "floor": "27W", "room": "2708호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 236, "floor": "27W", "room": "2709호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 237, "floor": "27W", "room": "2710호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 238, "floor": "27W", "room": "2711호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 239, "floor": "27W", "room": "복도 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 240, "floor": "27W", "room": "복도 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 241, "floor": "27W", "room": "복도 -3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 242, "floor": "27W", "room": "복도 -4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 243, "floor": "1", "room": "헬스체크업 소화기내시경", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 244, "floor": "1", "room": "헬스체크업 입구 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 245, "floor": "1", "room": "헬스체크업 내부 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 246, "floor": "1", "room": "헬스체크업 내부 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 247, "floor": "1", "room": "헬스체크업 내부 -3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 248, "floor": "1", "room": "헬스체크업 내부 -4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 249, "floor": "1", "room": "헬스체크업 결과정리실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 250, "floor": "1", "room": "헬스체크업 결과정리실 내 장비실", "mgmt": "", "kind": "기타", "size": "15.9", "year": 2025, "maker": "FIC"}, {"no": 251, "floor": "1", "room": "외래 화장실 앞 복도 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 252, "floor": "1", "room": "외래 화장실 앞 복도 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 253, "floor": "1", "room": "외래약국", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 254, "floor": "1", "room": "소화전 6번회로 앞 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 255, "floor": "1", "room": "소화전 6번회로 앞 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 256, "floor": "1", "room": "신생아실 입구", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 257, "floor": "1", "room": "신생아실 NICU -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 258, "floor": "1", "room": "신생아실 NICU -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 259, "floor": "1", "room": "신생아실 NICU -3", "mgmt": "", "kind": "가스계", "size": "3", "year": 2018, "maker": "포트텍"}, {"no": 260, "floor": "1", "room": "신생아실 내부 EPS실 -1", "mgmt": "", "kind": "기타", "size": "", "year": 2025, "maker": "FIC"}, {"no": 261, "floor": "1", "room": "신생아실 내부 EPS실 -2", "mgmt": "", "kind": "기타", "size": "", "year": null, "maker": ""}, {"no": 262, "floor": "1", "room": "MRI실 입구 앞 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 263, "floor": "1", "room": "MRI실 입구 앞 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 264, "floor": "1", "room": "MRI 조정실 -1", "mgmt": "", "kind": "가스계", "size": "3", "year": 2014, "maker": "핌코리아"}, {"no": 265, "floor": "1", "room": "MRI 조정실 -2", "mgmt": "", "kind": "Halon", "size": "3", "year": 2007, "maker": "티파니상사"}, {"no": 266, "floor": "1", "room": "CT촬영실1 조정실", "mgmt": "", "kind": "", "size": "", "year": null, "maker": ""}, {"no": 267, "floor": "1", "room": "CT촬영실2", "mgmt": "", "kind": "Halon", "size": "3", "year": 2007, "maker": "티파니상사"}, {"no": 268, "floor": "1", "room": "CT촬영실3", "mgmt": "", "kind": "Halon", "size": "3", "year": 2021, "maker": "㈜HTC"}, {"no": 269, "floor": "1", "room": "CT촬영실5", "mgmt": "", "kind": "", "size": "", "year": null, "maker": ""}, {"no": 270, "floor": "1", "room": "중재시술센터", "mgmt": "", "kind": "가스계", "size": "3", "year": 2021, "maker": "동아화이어테크"}, {"no": 271, "floor": "1", "room": "E/L 홀 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 272, "floor": "1", "room": "E/L 홀 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 273, "floor": "1", "room": "영상의학과 투시촬영실 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 274, "floor": "1", "room": "영상의학과 투시촬영실 -2", "mgmt": "", "kind": "가스계", "size": "3", "year": 2017, "maker": "포트텍"}, {"no": 275, "floor": "1", "room": "영상의학과 흉부촬영실 앞 복도 ", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 276, "floor": "1", "room": "영상의학과 혈관촬영실 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 277, "floor": "1", "room": "영상의학과 혈관촬영실 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 278, "floor": "1", "room": "영상의학과 혈관촬영실 -3", "mgmt": "", "kind": "가스계", "size": "3", "year": 2015, "maker": "케이텔"}, {"no": 279, "floor": "1", "room": "영상의학과 혈관촬영실 -4", "mgmt": "", "kind": "가스계", "size": "3", "year": 2015, "maker": "케이텔"}, {"no": 280, "floor": "1", "room": "판독실 안쪽 EPS실 -1", "mgmt": "", "kind": "기타", "size": "30.1", "year": 2015, "maker": "DK파이어"}, {"no": 281, "floor": "1", "room": "판독실 안쪽 EPS실 -2", "mgmt": "", "kind": "기타", "size": "30.1", "year": 2015, "maker": "DK파이어"}, {"no": 282, "floor": "1", "room": "판독실 옆 TPS실", "mgmt": "", "kind": "기타", "size": "", "year": null, "maker": ""}, {"no": 283, "floor": "1", "room": "통합조정실-1", "mgmt": "", "kind": "가스계", "size": "3", "year": 2018, "maker": "포트텍"}, {"no": 284, "floor": "1", "room": "통합조정실-2", "mgmt": "", "kind": "가스계", "size": "3", "year": 2018, "maker": "포트텍"}, {"no": 285, "floor": "1", "room": "외래원무팀", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 286, "floor": "B1", "room": "영양팀 배선실 입구 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 287, "floor": "B1", "room": "영양팀 배선실 입구 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 288, "floor": "B1", "room": "영양팀 배선실", "mgmt": "", "kind": "강화액", "size": "3.0L", "year": 2020, "maker": "한울"}, {"no": 289, "floor": "B1", "room": "영양팀 검수실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 290, "floor": "B1", "room": "영양팀 사무실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 291, "floor": "B1", "room": "영양팀 부식창고 앞", "mgmt": "", "kind": "CO2", "size": "3", "year": 2020, "maker": "한울방재"}, {"no": 292, "floor": "B1", "room": "영양팀 유동실", "mgmt": "", "kind": "가스계", "size": "3", "year": 2015, "maker": "조경산업"}, {"no": 293, "floor": "B1", "room": "영양팀 국조리 -1", "mgmt": "", "kind": "강화액", "size": "3.0L", "year": 2020, "maker": "한울"}, {"no": 294, "floor": "B1", "room": "영양팀 국조리 -2", "mgmt": "", "kind": "강화액", "size": "4.0L", "year": 2020, "maker": "KISEN"}, {"no": 295, "floor": "B1", "room": "영양팀 국조리 -3", "mgmt": "", "kind": "강화액", "size": "4.0L", "year": 2018, "maker": "동아화이어테크"}, {"no": 296, "floor": "B1", "room": "영양팀 치료식 -1", "mgmt": "", "kind": "자동확산", "size": "3", "year": 2018, "maker": "삼우산기"}, {"no": 297, "floor": "B1", "room": "영양팀 치료식 -2", "mgmt": "", "kind": "자동확산", "size": "3", "year": 2018, "maker": "삼우산기"}, {"no": 298, "floor": "B1", "room": "영양팀 치료식 -3", "mgmt": "", "kind": "자동확산", "size": "3", "year": 2018, "maker": "삼우산기"}, {"no": 299, "floor": "B1", "room": "진단검사의학과 입구 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 300, "floor": "B1", "room": "진단검사의학과 입구 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 301, "floor": "B1", "room": "진단검사의학과 내부 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 302, "floor": "B1", "room": "진단검사의학과 내부 -2", "mgmt": "", "kind": "가스계", "size": "3", "year": 2017, "maker": "포트택"}, {"no": 303, "floor": "B1", "room": "진단검사의학과 내부 -3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 304, "floor": "B1", "room": "중앙부 입구", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 305, "floor": "B1", "room": "중앙부 멸균물품보관실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 306, "floor": "B1", "room": "중앙부 소독실", "mgmt": "", "kind": "가스계", "size": "3", "year": 2019, "maker": "포트택"}, {"no": 307, "floor": "B1", "room": "중앙부 옆 공조실-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 308, "floor": "B1", "room": "중앙부 옆 공조실-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 309, "floor": "B1", "room": "가스보관실 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 310, "floor": "B1", "room": "가스보관실 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 311, "floor": "B1", "room": "가스보관실 -3", "mgmt": "", "kind": "가스계", "size": "3", "year": 2022, "maker": "포트텍"}, {"no": 312, "floor": "B1", "room": "재활치료실 앞 복도 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 313, "floor": "B1", "room": "재활치료실 앞 복도 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 314, "floor": "B1", "room": "재활치료실 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 315, "floor": "B1", "room": "재활치료실 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 316, "floor": "B1", "room": "재활치료실 -3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 317, "floor": "B1", "room": "재활치료실 -4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 318, "floor": "B1", "room": "약제과 창고", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2016, "maker": "한울방재"}, {"no": 319, "floor": "B1", "room": "의무기록 사무실 입구", "mgmt": "", "kind": "가스계", "size": "3", "year": 2018, "maker": "포트텍"}, {"no": 320, "floor": "B1", "room": "의무기록 보관실 앞문 -1", "mgmt": "", "kind": "Halon", "size": "3", "year": 2006, "maker": "티파니상사"}, {"no": 321, "floor": "B1", "room": "의무기록 보관실 앞문 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2021, "maker": "삼우산기"}, {"no": 322, "floor": "B1", "room": "의무기록 보관실 중문 -1", "mgmt": "", "kind": "CO2", "size": "3", "year": 2005, "maker": "동아화이어테크"}, {"no": 323, "floor": "B1", "room": "의무기록 보관실 중문 -2", "mgmt": "", "kind": "Halon", "size": "3", "year": 2004, "maker": "티파니상사"}, {"no": 324, "floor": "B1", "room": "의무기록 보관실 중문 -3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 325, "floor": "B1", "room": "의무기록 보관실 후문 -1", "mgmt": "", "kind": "Halon", "size": "3", "year": null, "maker": ""}, {"no": 326, "floor": "B1", "room": "의무기록 보관실 후문 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 327, "floor": "B1", "room": "의무기록 보관실 복도 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 328, "floor": "B1", "room": "의무기록 보관실 복도 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 329, "floor": "B1", "room": "의료장비파트 사무실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 330, "floor": "B1", "room": "의료장비파트 창고", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 331, "floor": "B1", "room": "영양팀 탈의실 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 332, "floor": "B1", "room": "영양팀 탈의실 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 333, "floor": "B1", "room": "하론가스실 앞 ", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 334, "floor": "B1", "room": "전기실 사무실", "mgmt": "", "kind": "Halon", "size": "", "year": 2015, "maker": "조경산업"}, {"no": 335, "floor": "B1", "room": "변전실 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 336, "floor": "B1", "room": "변전실 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 337, "floor": "B1", "room": "변전실 -3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 338, "floor": "B1", "room": "변전실 -4", "mgmt": "", "kind": "CO2", "size": "6.8", "year": 1993, "maker": "협동"}, {"no": 339, "floor": "B1", "room": "변전실 -5", "mgmt": "", "kind": "CO2", "size": "6.8", "year": 1992, "maker": "남양산업"}, {"no": 340, "floor": "B1", "room": "변전실 -6", "mgmt": "", "kind": "CO2", "size": "23", "year": 1994, "maker": "남양산업"}, {"no": 341, "floor": "B1", "room": "기관실 배전반 앞 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 342, "floor": "B1", "room": "기관실 10톤 보일러 상부 -1", "mgmt": "", "kind": "자동확산", "size": "3", "year": null, "maker": ""}, {"no": 343, "floor": "B1", "room": "기관실 10톤 보일러 상부 -2", "mgmt": "", "kind": "자동확산", "size": "3", "year": null, "maker": ""}, {"no": 344, "floor": "B1", "room": "보일러실", "mgmt": "", "kind": "CO2", "size": "23", "year": 1993, "maker": "협동"}, {"no": 345, "floor": "B1", "room": "빙축열 냉동기 측 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 346, "floor": "B1", "room": "빙축열 냉동기 측 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 347, "floor": "외곽", "room": "27병동 외각 흡연부스", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "일명"}, {"no": 348, "floor": "옥상", "room": "흡연실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "에프씨아이"}], "응급센터": [{"no": 1, "floor": "PH", "room": "헬기장 포소화전 내부", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2022, "maker": "CW소방"}, {"no": 2, "floor": "PH", "room": "헬기장 포소화전 앞 비탈", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2017, "maker": "DRY CHEMICAL"}, {"no": 3, "floor": "PH", "room": "E/L 기계실 (E/L 1대 측)", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2022, "maker": "CW소방"}, {"no": 4, "floor": "PH", "room": "E/L 기계실 (E/L 2대 측)", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 5, "floor": "PH", "room": "헬기장 유류탱크 앞-1", "mgmt": "", "kind": "분말", "size": "20", "year": 2017, "maker": "DF"}, {"no": 6, "floor": "PH", "room": "헬기장 유류탱크 앞-2", "mgmt": "", "kind": "가스계", "size": "4.5", "year": 2016, "maker": "동아화이어테크"}, {"no": 7, "floor": "PH", "room": "E/L 3호기 앞 전실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2022, "maker": "삼우산기"}, {"no": 8, "floor": "PH", "room": "E/L 3호기 앞 전실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2022, "maker": "삼우산기"}, {"no": 9, "floor": "7", "room": "공조실-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 10, "floor": "7", "room": "공조실-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 11, "floor": "7", "room": "E/L 2대 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 12, "floor": "7", "room": "응급의학과 사무실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 13, "floor": "7", "room": "7301호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 14, "floor": "7", "room": "7302호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 15, "floor": "7", "room": "7303호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 16, "floor": "7", "room": "7303호 앞 복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 17, "floor": "7", "room": "E/L 1대 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 18, "floor": "7", "room": "수면검사실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 19, "floor": "7", "room": "7308호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 20, "floor": "7", "room": "7309호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 21, "floor": "7", "room": "7310호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 22, "floor": "7", "room": "집중관찰실1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 23, "floor": "7", "room": "집중관찰실2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 24, "floor": "6", "room": "의료장비파트 사무실", "mgmt": "", "kind": "분말", "size": "3.3", "year": null, "maker": ""}, {"no": 25, "floor": "6", "room": "교수연구실 앞 비서실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 26, "floor": "6", "room": "심혈관조영실 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 27, "floor": "6", "room": "심혈관조영실 -2", "mgmt": "", "kind": "가스계", "size": "3", "year": 2018, "maker": "포트텍"}, {"no": 28, "floor": "6", "room": "심혈관조영실 -3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 29, "floor": "6", "room": "심혐관조영실 -4", "mgmt": "", "kind": "가스계", "size": "3", "year": 2025, "maker": "에이치티씨"}, {"no": 30, "floor": "6", "room": "E/L 1대 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 31, "floor": "6", "room": "E/L 2대 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 32, "floor": "6", "room": "복도 (자동문 앞) ", "mgmt": "", "kind": "분말", "size": "3.3", "year": null, "maker": ""}, {"no": 33, "floor": "6", "room": "심장초음파실 검사실1 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 34, "floor": "6", "room": "심장초음파실 검사실5 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 35, "floor": "5", "room": "항공운항팀-1", "mgmt": "", "kind": "가스계", "size": "3", "year": 2025, "maker": "에이치티씨"}, {"no": 36, "floor": "5", "room": "항공운항팀-2", "mgmt": "", "kind": "가스계", "size": "3", "year": 2025, "maker": "에이치티씨"}, {"no": 37, "floor": "5", "room": "5601호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "㈜일명"}, {"no": 38, "floor": "5", "room": "5602호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "㈜일명"}, {"no": 39, "floor": "5", "room": "5603호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "㈜일명"}, {"no": 40, "floor": "5", "room": "5605호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "㈜일명"}, {"no": 41, "floor": "5", "room": "5606호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "㈜일명"}, {"no": 42, "floor": "5", "room": "5607호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "㈜일명"}, {"no": 43, "floor": "5", "room": "5608호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "㈜일명"}, {"no": 44, "floor": "5", "room": "5609호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "㈜일명"}, {"no": 45, "floor": "5", "room": "5610호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "㈜일명"}, {"no": 46, "floor": "5", "room": "격리실 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "㈜일명"}, {"no": 47, "floor": "5", "room": "격리실 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "㈜일명"}, {"no": 48, "floor": "5", "room": "격리실 -3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "㈜일명"}, {"no": 49, "floor": "5", "room": "격리실 -4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "㈜일명"}, {"no": 50, "floor": "5", "room": "간호사탈의실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "㈜일명"}, {"no": 51, "floor": "5", "room": "처치실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "㈜일명"}, {"no": 52, "floor": "5", "room": "복도 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "㈜일명"}, {"no": 53, "floor": "5", "room": "복도 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "㈜일명"}, {"no": 54, "floor": "5", "room": "복도 -3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "㈜일명"}, {"no": 55, "floor": "5", "room": "복도 -4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "㈜일명"}, {"no": 56, "floor": "5", "room": "E/L 1대 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "㈜일명"}, {"no": 57, "floor": "5", "room": "E/L 2대 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 58, "floor": "3", "room": "통원수술실II", "mgmt": "", "kind": "Halon", "size": "3", "year": 2002, "maker": "티파니상사"}, {"no": 59, "floor": "3", "room": "통원대수술실", "mgmt": "", "kind": "Halon", "size": "3", "year": 2002, "maker": "티파니상사"}, {"no": 60, "floor": "3", "room": "통원수술회복실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 61, "floor": "3", "room": "응급교육장", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 62, "floor": "3", "room": "소화기병센터 입구 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 63, "floor": "3", "room": "소화기병센터 세척실 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2022, "maker": "CW소방"}, {"no": 64, "floor": "3", "room": "소화기병센터 내시경 회복실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2022, "maker": "CW소방"}, {"no": 65, "floor": "3", "room": "소화기병센터 초음파실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 66, "floor": "3", "room": "E/L 2대 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 67, "floor": "3", "room": "E/L 2대 뒤쪽 대기실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 68, "floor": "3", "room": "E/L 1대 앞 소화전 옆", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 69, "floor": "2", "room": "도서실 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2022, "maker": "CW소방"}, {"no": 70, "floor": "2", "room": "고압산소치료실 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2021, "maker": "삼우산기"}, {"no": 71, "floor": "2", "room": "신관 연결복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 72, "floor": "2", "room": "E/L 1대 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2021, "maker": "삼우산기"}, {"no": 73, "floor": "2", "room": "E-ICU-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 74, "floor": "2", "room": "E-ICU-2", "mgmt": "", "kind": "가스계", "size": "3", "year": 2018, "maker": "삼우산기"}, {"no": 75, "floor": "2", "room": "E-ICU-3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 76, "floor": "2", "room": "E-ICU-4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 77, "floor": "2", "room": "고압산소치료실 1인실", "mgmt": "", "kind": "가스계", "size": "3", "year": 2018, "maker": "포트텍"}, {"no": 78, "floor": "2", "room": "원무팀", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2015, "maker": "태양산업"}, {"no": 79, "floor": "1", "room": "응급센터 입구(외부측)", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2022, "maker": "CW소방"}, {"no": 80, "floor": "1", "room": "응급 원무팀 앞 보호자대기실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2019, "maker": "삼우산기"}, {"no": 81, "floor": "1", "room": "응급센터 입구 옆 격리실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 82, "floor": "1", "room": "응급실 내부-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 83, "floor": "1", "room": "응급실 내부-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 84, "floor": "1", "room": "응급실 내부-3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 85, "floor": "1", "room": "응급실 내부-4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 86, "floor": "1", "room": "소아진료실 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 87, "floor": "1", "room": "경증관찰실 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 88, "floor": "1", "room": "응급실 중증관찰실1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 89, "floor": "1", "room": "응급실 중증관찰실2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2019, "maker": "태양소방산업"}, {"no": 90, "floor": "1", "room": "응급실 소생실 3,4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 91, "floor": "1", "room": "응급의학과 동계스포츠센터", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2019, "maker": "태양소방산업"}, {"no": 92, "floor": "1", "room": "MRI #24 기계실 내 PS실 -1", "mgmt": "", "kind": "기타", "size": "", "year": 2022, "maker": "대명하이테크"}, {"no": 93, "floor": "1", "room": "MRI #24 기계실 내 PS실 -2", "mgmt": "", "kind": "기타", "size": "", "year": 2022, "maker": "대명하이테크"}, {"no": 94, "floor": "1", "room": "외곽 흡연실 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 95, "floor": "1", "room": "외곽 흡연실 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 96, "floor": "1", "room": "액화산소저장소 앞 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 97, "floor": "1", "room": "액화산소저장소 앞 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 98, "floor": "1", "room": "항공유 주입구 앞", "mgmt": "", "kind": "분말", "size": "20", "year": 2025, "maker": "동양기산"}, {"no": 99, "floor": "B1", "room": "감마나이프센터", "mgmt": "", "kind": "가스계", "size": "3", "year": 2019, "maker": "포트텍"}, {"no": 100, "floor": "B1", "room": "감마나이프센터 앞 복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 101, "floor": "B1", "room": "감마나이프센터 앞 복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 102, "floor": "B1", "room": "응급센터 기계실-1", "mgmt": "", "kind": "CO2", "size": "4.6", "year": 2001, "maker": "신광산업"}, {"no": 103, "floor": "B1", "room": "응급센터 기계실-2", "mgmt": "", "kind": "CO2", "size": "4.6", "year": 2001, "maker": "신광산업"}, {"no": 104, "floor": "B1", "room": "응급센터 기계실 -3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2022, "maker": "CW소방"}, {"no": 105, "floor": "B1", "room": "응급센터 기계실 -4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 106, "floor": "B1", "room": "응급센터 전기실-1", "mgmt": "", "kind": "CO2", "size": "4.6", "year": 2001, "maker": "신광산업"}, {"no": 107, "floor": "B1", "room": "응급센터 전기실-2", "mgmt": "", "kind": "CO2", "size": "4.6", "year": 2001, "maker": "신광산업"}, {"no": 108, "floor": "B1", "room": "응급센터 전기실-3", "mgmt": "", "kind": "CO2", "size": "4.6", "year": 2001, "maker": "신광산업"}, {"no": 109, "floor": "B1", "room": "응급센터 전기실-4", "mgmt": "", "kind": "CO2", "size": "23", "year": 1996, "maker": "NKFIRE"}, {"no": 110, "floor": "B1", "room": "응급센터 전기실-5", "mgmt": "", "kind": "CO2", "size": "23", "year": 1996, "maker": "NKFIRE"}, {"no": 111, "floor": "B1", "room": "응급센터 발전기실-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 112, "floor": "B1", "room": "응급센터 발전기실-2", "mgmt": "", "kind": "CO2", "size": "4.6", "year": 2001, "maker": "신광산업"}, {"no": 113, "floor": "B1", "room": "응급센터 발전기실-3", "mgmt": "", "kind": "CO2", "size": "4.6", "year": 2001, "maker": "신광산업"}, {"no": 114, "floor": "B1", "room": "E/L 1대 앞 복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 115, "floor": "B1", "room": "E/L 1대 앞 복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 116, "floor": "B1", "room": "진단검사의학과 중앙-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 117, "floor": "B1", "room": "진단검사의학과 중앙-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 118, "floor": "B1", "room": "진단검사의학과 중앙-3", "mgmt": "", "kind": "가스계", "size": "3", "year": 2017, "maker": "포트텍"}, {"no": 119, "floor": "B1", "room": "진단검사의학과 창고 앞-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 120, "floor": "B1", "room": "진단검사의학과 창고 앞-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 121, "floor": "B1", "room": "진단검사의학과 창고 앞-3", "mgmt": "", "kind": "가스계", "size": "3", "year": 2017, "maker": "포트텍"}, {"no": 122, "floor": "B1", "room": "진단검사의학과 센터체혈실-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 123, "floor": "B1", "room": "진단검사의학과 센터체혈실-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}], "외상센터": [{"no": 1, "floor": "PH", "room": "E/L 기계실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "㈜일명"}, {"no": 2, "floor": "PH", "room": "공조실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 3, "floor": "3", "room": "수술실-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 4, "floor": "3", "room": "수술실-1", "mgmt": "", "kind": "가스계", "size": "3", "year": 2014, "maker": "동아화이어테크"}, {"no": 5, "floor": "3", "room": "혈관조영실 및 수술실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 6, "floor": "3", "room": "혈관조영실 및 수술실", "mgmt": "", "kind": "가스계", "size": "3", "year": 2014, "maker": "동아화이어테크"}, {"no": 7, "floor": "3", "room": "혈관조영실 및 수술실", "mgmt": "", "kind": "가스계", "size": "3", "year": 2014, "maker": "동아화이어테크"}, {"no": 8, "floor": "3", "room": "수술실-1 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 9, "floor": "3", "room": "수술실-2 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 10, "floor": "3", "room": "회복실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 11, "floor": "3", "room": "중환자실 입구 (E/L 옆 복도)", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 12, "floor": "3", "room": "중환자실 입구 (자동문 내부)", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 13, "floor": "3", "room": "중환자실 내부-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 14, "floor": "3", "room": "중환자실 내부-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 15, "floor": "3", "room": "중환자실 내부-3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 16, "floor": "3", "room": "중환자실 내부-4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 17, "floor": "3", "room": "중환자실 내부-5", "mgmt": "", "kind": "가스계", "size": "3", "year": 2019, "maker": "포트텍"}, {"no": 18, "floor": "2", "room": "2608호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 19, "floor": "2", "room": "2608호 앞 복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 20, "floor": "2", "room": "2608호 앞 복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 21, "floor": "2", "room": "2607호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 22, "floor": "2", "room": "2607호 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 23, "floor": "2", "room": "2606호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 24, "floor": "2", "room": "2606호 앞 복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 25, "floor": "2", "room": "2606호 앞 복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 26, "floor": "2", "room": "2605호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 27, "floor": "2", "room": "2605호 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 28, "floor": "2", "room": "2603호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 29, "floor": "2", "room": "2603호 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 30, "floor": "2", "room": "2602호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 31, "floor": "2", "room": "2602호 앞 복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 32, "floor": "2", "room": "2602호 앞 복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 33, "floor": "2", "room": "2601호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 34, "floor": "2", "room": "2601호 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 35, "floor": "2", "room": "당직실 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 36, "floor": "2", "room": "교수실-1 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2017, "maker": "한울방재"}, {"no": 37, "floor": "2", "room": "컨퍼런스룸", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 38, "floor": "2", "room": "컨퍼런스룸 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 39, "floor": "2", "room": "26병동 외부 복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 40, "floor": "2", "room": "26병동 외부 복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 41, "floor": "2", "room": "26병동 외부 복도-3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 42, "floor": "2", "room": "고압산소치료실 다인실", "mgmt": "", "kind": "가스계", "size": "3", "year": 2018, "maker": "포트텍"}, {"no": 43, "floor": "2", "room": "EPS실 -1", "mgmt": "", "kind": "가스계", "size": "20", "year": 2015, "maker": ""}, {"no": 44, "floor": "2", "room": "EPS실 -2", "mgmt": "", "kind": "가스계", "size": "20", "year": 2015, "maker": ""}, {"no": 45, "floor": "1", "room": "관찰구역-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 46, "floor": "1", "room": "관찰구역-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 47, "floor": "1", "room": "관찰구역-3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 48, "floor": "1", "room": "관찰구역-4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 49, "floor": "1", "room": "응급촬영실-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 50, "floor": "1", "room": "응급촬영실-2", "mgmt": "", "kind": "Halon", "size": "3", "year": 2007, "maker": "티파니상사"}, {"no": 51, "floor": "1", "room": "CT 조정실 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2021, "maker": "삼우산기"}, {"no": 52, "floor": "1", "room": "간호사실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 53, "floor": "1", "room": "수술실 중증처치실-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 54, "floor": "1", "room": "수술실 중증처치실-2", "mgmt": "", "kind": "가스계", "size": "3", "year": 2014, "maker": "동아화이어테크"}, {"no": 55, "floor": "1", "room": "수술실 중증처치실 앞-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2019, "maker": "태양소방산업"}, {"no": 56, "floor": "1", "room": "수술실 중증처치실 앞-2", "mgmt": "", "kind": "가스계", "size": "3", "year": 2014, "maker": "동아화이어테크"}, {"no": 57, "floor": "1", "room": "응급실 소생실 1,2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 58, "floor": "1", "room": "격리실실 앞 전실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 59, "floor": "1", "room": "외상센터 출입구 외부", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2022, "maker": "삼우산기"}, {"no": 60, "floor": "1", "room": "외래센터 측 연결복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 61, "floor": "1", "room": "쥬디관 측 연결복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 62, "floor": "1", "room": "EPS실 -1", "mgmt": "", "kind": "가스계", "size": "20", "year": 2015, "maker": ""}, {"no": 63, "floor": "1", "room": "EPS실 -2", "mgmt": "", "kind": "가스계", "size": "20", "year": 2015, "maker": ""}, {"no": 64, "floor": "B1", "room": "알람밸브실 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 65, "floor": "B1", "room": "E/L홀 옆 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 66, "floor": "B1", "room": "약제팀 창고", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 67, "floor": "B1", "room": "폐수처리장-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 68, "floor": "B1", "room": "폐수처리장-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 69, "floor": "B1", "room": "EPS실 -1", "mgmt": "", "kind": "가스계", "size": "20", "year": 2015, "maker": ""}, {"no": 70, "floor": "B1", "room": "EPS실 -2", "mgmt": "", "kind": "가스계", "size": "20", "year": 2015, "maker": ""}], "외래센터": [{"no": 1, "floor": "7", "room": "공조실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 2, "floor": "7", "room": "공용복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 3, "floor": "7", "room": "공용복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 4, "floor": "7", "room": "공용복도-3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 5, "floor": "7", "room": "공용복도-4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 6, "floor": "7", "room": "공용복도-5", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 7, "floor": "7", "room": "정신건강의학과 입구", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 8, "floor": "7", "room": "정신건강의학과 안쪽", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 9, "floor": "7", "room": "심장내과 접수", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 10, "floor": "7", "room": "심장내과 연구간호사실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 11, "floor": "7", "room": "심장내과 회의실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 12, "floor": "7", "room": "전산 서버실-1", "mgmt": "", "kind": "가스계", "size": "2.5", "year": 2015, "maker": "동아화이어테크"}, {"no": 13, "floor": "7", "room": "전산 서버실-2", "mgmt": "", "kind": "가스계", "size": "2.5", "year": 2015, "maker": "동아화이어테크"}, {"no": 14, "floor": "7", "room": "전산 서버실-3", "mgmt": "", "kind": "가스계", "size": "3", "year": 2021, "maker": "에이치티씨"}, {"no": 15, "floor": "7", "room": "전산 서버실-4", "mgmt": "", "kind": "가스계", "size": "2.5", "year": 2017, "maker": "포트텍"}, {"no": 16, "floor": "7", "room": "전산정보팀", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 17, "floor": "7", "room": "대회의실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 18, "floor": "7", "room": "교수회의실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 19, "floor": "7", "room": "EPS실 -1", "mgmt": "", "kind": "가스계", "size": "20", "year": 2015, "maker": ""}, {"no": 20, "floor": "7", "room": "EPS실 -2", "mgmt": "", "kind": "가스계", "size": "20", "year": 2015, "maker": ""}, {"no": 21, "floor": "6", "room": "공조실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 22, "floor": "6", "room": "공용복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 23, "floor": "6", "room": "공용복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 24, "floor": "6", "room": "공용복도-3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 25, "floor": "6", "room": "공용복도-4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 26, "floor": "6", "room": "공용복도-5", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 27, "floor": "6", "room": "공용복도-6", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 28, "floor": "6", "room": "공용복도-7", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 29, "floor": "6", "room": "이비인/비뇨기 접수-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 30, "floor": "6", "room": "이비인/비뇨기 접수-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 31, "floor": "6", "room": "이비인후과 진료복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 32, "floor": "6", "room": "이비인후과 진료복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 33, "floor": "6", "room": "비뇨기과 진료복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 34, "floor": "6", "room": "비뇨기과 배뇨기능검사실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 35, "floor": "6", "room": "피부/성형/흉부/안과 접수-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 36, "floor": "6", "room": "피부/성형/흉부/안과 접수-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 37, "floor": "6", "room": "피부과 진료복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 38, "floor": "6", "room": "안과 진료복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 39, "floor": "6", "room": "안과 진료복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 40, "floor": "6", "room": "EPS실 -1", "mgmt": "", "kind": "가스계", "size": "20", "year": 2025, "maker": "FIC"}, {"no": 41, "floor": "6", "room": "EPS실 -2", "mgmt": "", "kind": "가스계", "size": "20", "year": 2025, "maker": "FIC"}, {"no": 42, "floor": "5", "room": "공조실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 43, "floor": "5", "room": "공용복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 44, "floor": "5", "room": "공용복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 45, "floor": "5", "room": "공용복도-3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 46, "floor": "5", "room": "공용복도-4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 47, "floor": "5", "room": "공용복도-5", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 48, "floor": "5", "room": "당뇨 및 내분비검사실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 49, "floor": "5", "room": "내분비내과 진료복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 50, "floor": "5", "room": "내분비내과 진료복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 51, "floor": "5", "room": "신장내과 진료접수", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 52, "floor": "5", "room": "신장내과 진료복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 53, "floor": "5", "room": "외과 진료접수", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 54, "floor": "5", "room": "외과 진료복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 55, "floor": "5", "room": "외과 진료복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 56, "floor": "5", "room": "항암 낮병동", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 57, "floor": "5", "room": "항암주사실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 58, "floor": "5", "room": "항암주사실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 59, "floor": "5", "room": "EPS실 -1", "mgmt": "", "kind": "가스계", "size": "20", "year": 2025, "maker": "FIC"}, {"no": 60, "floor": "5", "room": "EPS실 -2", "mgmt": "", "kind": "가스계", "size": "20", "year": 2025, "maker": "FIC"}, {"no": 61, "floor": "3", "room": "공조실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 62, "floor": "3", "room": "공용복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 63, "floor": "3", "room": "공용복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 64, "floor": "3", "room": "공용복도-3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 65, "floor": "3", "room": "공용복도-4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 66, "floor": "3", "room": "공용복도-5", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 67, "floor": "3", "room": "공용복도-6", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 68, "floor": "3", "room": "공용복도-7", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 69, "floor": "3", "room": "공용복도-8", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 70, "floor": "3", "room": "호흡기/신경통증 접수-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 71, "floor": "3", "room": "호흡기/신경통증 접수-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 72, "floor": "3", "room": "호흡기내과 기관지내시경", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 73, "floor": "3", "room": "호흡기내과 폐기능검사", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 74, "floor": "3", "room": "호흡기내과 센터회의실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 75, "floor": "3", "room": "신경통증과 시술실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 76, "floor": "3", "room": "신경/재활/정형 접수-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 77, "floor": "3", "room": "신경/재활/정형 접수-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 78, "floor": "3", "room": "신경/재활/정형 접수-3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 79, "floor": "3", "room": "신경과 진료복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 80, "floor": "3", "room": "정형외과 진료복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 81, "floor": "3", "room": "정형외과 진료복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 82, "floor": "", "room": "EPS실 -1", "mgmt": "", "kind": "가스계", "size": "20", "year": 2025, "maker": "FIC"}, {"no": 83, "floor": "", "room": "EPS실 -2", "mgmt": "", "kind": "가스계", "size": "20", "year": 2025, "maker": "FIC"}, {"no": 84, "floor": "", "room": "EPS실 -3", "mgmt": "", "kind": "가스계", "size": "20", "year": 2025, "maker": "FIC"}, {"no": 85, "floor": "2", "room": "공용복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 86, "floor": "2", "room": "공용복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 87, "floor": "2", "room": "공용복도-3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 88, "floor": "2", "room": "공용복도-4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 89, "floor": "2", "room": "공용복도-5", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 90, "floor": "2", "room": "공용복도-6", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 91, "floor": "2", "room": "채혈실 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 92, "floor": "2", "room": "채혈실 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 93, "floor": "2", "room": "심전도실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 94, "floor": "2", "room": "소아청소년 접수", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 95, "floor": "2", "room": "소아청소년 진료복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 96, "floor": "2", "room": "소아청소년 진료복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 97, "floor": "2", "room": "소아청소년 진료복도-3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 98, "floor": "2", "room": "미화휴게실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 99, "floor": "2", "room": "EPS실 -1", "mgmt": "", "kind": "가스계", "size": "20", "year": 2025, "maker": "FIC"}, {"no": 100, "floor": "2", "room": "EPS실 -2", "mgmt": "", "kind": "가스계", "size": "20", "year": 2015, "maker": ""}, {"no": 101, "floor": "1", "room": "공용복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 102, "floor": "1", "room": "공용복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 103, "floor": "1", "room": "공용복도-3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 104, "floor": "1", "room": "공용복도-4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 105, "floor": "1", "room": "공용복도-5", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 106, "floor": "1", "room": "공용복도-6", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 107, "floor": "1", "room": "공용복도-7", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 108, "floor": "1", "room": "공용복도-8", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 109, "floor": "1", "room": "공용복도-9", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 110, "floor": "1", "room": "공용복도-10", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 111, "floor": "1", "room": "공용복도-11", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 112, "floor": "1", "room": "공용복도-12", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 113, "floor": "1", "room": "EPS실 -1", "mgmt": "", "kind": "가스계", "size": "20", "year": 2015, "maker": ""}, {"no": 114, "floor": "1", "room": "EPS실 -2", "mgmt": "", "kind": "가스계", "size": "20", "year": 2015, "maker": ""}, {"no": 115, "floor": "B1", "room": "기계실-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2019, "maker": "㈜일명"}, {"no": 116, "floor": "B1", "room": "기계실-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 117, "floor": "B1", "room": "기계실-3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 118, "floor": "B1", "room": "기계실-4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 119, "floor": "B1", "room": "기계실-6", "mgmt": "", "kind": "CO2", "size": "23", "year": 1995, "maker": "한국하론"}, {"no": 120, "floor": "B1", "room": "변전실-1", "mgmt": "", "kind": "가스계", "size": "2.5", "year": 2017, "maker": "포트텍"}, {"no": 121, "floor": "B1", "room": "변전실-2", "mgmt": "", "kind": "가스계", "size": "2.5", "year": 2017, "maker": "포트텍"}, {"no": 122, "floor": "B1", "room": "변전실-3", "mgmt": "", "kind": "가스계", "size": "2.5", "year": 2017, "maker": "포트텍"}, {"no": 123, "floor": "B1", "room": "변전실-4", "mgmt": "", "kind": "가스계", "size": "2.5", "year": 2017, "maker": "포트텍"}, {"no": 124, "floor": "B1", "room": "변전실-5", "mgmt": "", "kind": "가스계", "size": "2.5", "year": 2017, "maker": "포트텍"}, {"no": 125, "floor": "B1", "room": "변전실-6", "mgmt": "", "kind": "가스계", "size": "2.5", "year": 2015, "maker": "동아화이어테크"}, {"no": 126, "floor": "B1", "room": "변전실-7", "mgmt": "", "kind": "가스계", "size": "3", "year": 2022, "maker": "포트텍"}, {"no": 127, "floor": "B1", "room": "변전실-8", "mgmt": "", "kind": "가스계", "size": "3", "year": 2022, "maker": "포트텍"}, {"no": 128, "floor": "B1", "room": "변전실-9", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 129, "floor": "B1", "room": "변전실-10", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}], "후생관": [{"no": 1, "floor": "1", "room": "후생관 정문 출입구", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 2, "floor": "1", "room": "Point medical", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 3, "floor": "1", "room": "신협", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "DF"}, {"no": 4, "floor": "1", "room": "CU 편의점 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2024, "maker": "㈜에이치티씨"}, {"no": 5, "floor": "1", "room": "CU 편의점 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "㈜진도"}, {"no": 6, "floor": "1", "room": "퀴즈노스 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "썬브라이트"}, {"no": 7, "floor": "1", "room": "퀴즈노스 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "DH"}, {"no": 8, "floor": "1", "room": "던킨도넛", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2022, "maker": "한울"}, {"no": 9, "floor": "1", "room": "오공김밥", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "CW"}, {"no": 10, "floor": "1", "room": "샐러드다", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "썬브라이트"}, {"no": 11, "floor": "1", "room": "파리바게트", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "DH"}, {"no": 12, "floor": "1", "room": "파리바게트", "mgmt": "", "kind": "강화액", "size": "3", "year": 2025, "maker": "한국소방기구제작소"}, {"no": 13, "floor": "1", "room": "죽이야기", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "DF"}, {"no": 14, "floor": "1", "room": "생과일카페", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2021, "maker": "DF"}, {"no": 15, "floor": "1", "room": "안경점", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "DH"}, {"no": 16, "floor": "1", "room": "안경점 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2022, "maker": "CW"}, {"no": 17, "floor": "1", "room": "어린이집 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "SW"}, {"no": 18, "floor": "1", "room": "어린이집(내부 출입구)", "mgmt": "", "kind": "가스계", "size": "3", "year": 2017, "maker": "포트텍"}, {"no": 19, "floor": "1", "room": "어린이집(원장실)", "mgmt": "", "kind": "가스계", "size": "3", "year": 2017, "maker": "포트텍"}, {"no": 20, "floor": "1", "room": "어린이집(새싹반 입구)", "mgmt": "", "kind": "가스계", "size": "3", "year": 2017, "maker": "포트텍"}, {"no": 21, "floor": "1", "room": "어린이집(하늘반)", "mgmt": "", "kind": "가스계", "size": "3", "year": 2017, "maker": "포트텍"}, {"no": 22, "floor": "1", "room": "어린이집(열매반)", "mgmt": "", "kind": "가스계", "size": "3", "year": 2017, "maker": "포트텍"}, {"no": 23, "floor": "1", "room": "어린이집(교사실)", "mgmt": "", "kind": "가스계", "size": "3", "year": 2017, "maker": "포트텍"}, {"no": 24, "floor": "1", "room": "어린이집(조리실 입구)", "mgmt": "", "kind": "가스계", "size": "3", "year": 2017, "maker": "포트텍"}, {"no": 25, "floor": "1", "room": "어린이집(조리실)", "mgmt": "", "kind": "가스계", "size": "3", "year": 2017, "maker": "포트텍"}, {"no": 26, "floor": "1", "room": "죽이야기 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "SW"}, {"no": 27, "floor": "1", "room": "푸트코트 입구 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 28, "floor": "1", "room": "에스컬레이터 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 29, "floor": "1", "room": "미화휴게실 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "SW"}, {"no": 30, "floor": "1", "room": "주방 뒤 복도(소화전 앞)", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 31, "floor": "1", "room": "주방 뒤 복도(여자탈의실 앞)", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 32, "floor": "1", "room": "직원식당 주방 -1", "mgmt": "", "kind": "강화액", "size": "4", "year": 2015, "maker": "하얀산업㈜"}, {"no": 33, "floor": "1", "room": "직원식당 주방 -2", "mgmt": "", "kind": "강화액", "size": "4", "year": 2000, "maker": "HWS산업㈜"}, {"no": 34, "floor": "1", "room": "직원식당 주방 -3", "mgmt": "", "kind": "가스계", "size": "3", "year": null, "maker": "케이텔"}, {"no": 35, "floor": "1", "room": "직원식당 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "썬브라이트"}, {"no": 36, "floor": "1", "room": "직원식당 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 37, "floor": "1", "room": "직원식당 입구", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 38, "floor": "1", "room": "푸드코트 주방 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "썬브라이트"}, {"no": 39, "floor": "1", "room": "푸드코트 주방 -2", "mgmt": "", "kind": "강화액", "size": "4", "year": 2015, "maker": "하얀산업㈜"}, {"no": 40, "floor": "1", "room": "푸드코트 주방 -3", "mgmt": "", "kind": "가스계", "size": "3", "year": 2015, "maker": "케이텔"}, {"no": 41, "floor": "1", "room": "푸트코트 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 42, "floor": "1", "room": "푸트코트 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 43, "floor": "1", "room": "푸트코트 -3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 44, "floor": "1", "room": "푸트코트 -4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "썬브라이트"}, {"no": 45, "floor": "1", "room": "푸트코트 사무실 ", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 46, "floor": "1", "room": "푸트코트 키오스크 옆", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "썬브라이트"}, {"no": 47, "floor": "1", "room": "어린이집 교사실 입구 옆 -1", "mgmt": "", "kind": "기타", "size": "600mL", "year": 2017, "maker": "우성아이엔디"}, {"no": 48, "floor": "1", "room": "어린이집 교사실 입구 옆 -2", "mgmt": "", "kind": "기타", "size": "600mL", "year": 2017, "maker": "우성아이엔디"}, {"no": 49, "floor": "1", "room": "어린이집 교사실 입구 옆 -3", "mgmt": "", "kind": "기타", "size": "600mL", "year": 2017, "maker": "우성아이엔디"}, {"no": 50, "floor": "1", "room": "어린이집 교사실 입구 옆 -4", "mgmt": "", "kind": "기타", "size": "600mL", "year": 2017, "maker": "우성아이엔디"}, {"no": 51, "floor": "B1", "room": "소방펌프실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 52, "floor": "B1", "room": "7번기둥", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2019, "maker": "태양소방산업"}, {"no": 53, "floor": "B1", "room": "알람밸브실 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 54, "floor": "B1", "room": "17번기둥", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 55, "floor": "B1", "room": "14번기둥", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2019, "maker": "㈜일명"}, {"no": 56, "floor": "B1", "room": "11번기둥", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 57, "floor": "B1", "room": "4번기둥", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2019, "maker": "㈜일명"}, {"no": 58, "floor": "B1", "room": "운수사무실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2021, "maker": "삼우산기"}, {"no": 59, "floor": "B1", "room": "주차사무실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}], "정문주차장(후생관)": [{"no": 1, "floor": "1", "room": "정문 수위실 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 2, "floor": "1", "room": "정문 수위실 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 1, "floor": "1", "room": "B2F 주차장 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 4, "floor": "1", "room": "B2F 주차장 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 1, "floor": "1", "room": "B2F 주차장 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 1, "floor": "1", "room": "B2F 주차장 -3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 1, "floor": "1", "room": "B2F 주차장 -4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 1, "floor": "1", "room": "B2F 주차장 -5", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 1, "floor": "1", "room": "B2F 주차장 -6", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 9, "floor": "1", "room": "B2F 주차장 -7", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2021, "maker": "에프아이씨"}, {"no": 1, "floor": "1", "room": "B2F 주차장 -7", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 1, "floor": "2", "room": "B1F 주차장 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 1, "floor": "2", "room": "B1F 주차장 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 1, "floor": "2", "room": "B1F 주차장 -3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 1, "floor": "2", "room": "B1F 주차장 -4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 1, "floor": "2", "room": "B1F 주차장 -5", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 1, "floor": "2", "room": "B1F 주차장 -6", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 1, "floor": "옥상", "room": "흡연실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}], "종합관": [{"no": 1, "floor": "B4", "room": "공용복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 2, "floor": "B4", "room": "전기실-1", "mgmt": "", "kind": "Halon", "size": "3", "year": 2020, "maker": "포트텍"}, {"no": 3, "floor": "B4", "room": "전기실-2", "mgmt": "", "kind": "Halon", "size": "3", "year": 2020, "maker": "포트텍"}, {"no": 4, "floor": "B4", "room": "발전기실-1", "mgmt": "", "kind": "Halon", "size": "3", "year": 2020, "maker": "포트텍"}, {"no": 5, "floor": "B4", "room": "발전기실-2", "mgmt": "", "kind": "Halon", "size": "3", "year": 2020, "maker": "포트텍"}, {"no": 6, "floor": "B4", "room": "펌프실-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 7, "floor": "B4", "room": "펌프실-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 8, "floor": "B3", "room": "주차장-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 9, "floor": "B3", "room": "주차장-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 10, "floor": "B2", "room": "주차장-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 11, "floor": "B2", "room": "주차장-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 12, "floor": "B1", "room": "주차장-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 13, "floor": "B1", "room": "주차장-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 14, "floor": "B1", "room": "의무기록보관실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 15, "floor": "B1", "room": "MDF실", "mgmt": "", "kind": "Halon", "size": "3", "year": 2020, "maker": "포트텍"}, {"no": 16, "floor": "B1", "room": "E/V홀", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 17, "floor": "B1", "room": "창고", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 18, "floor": "B1", "room": "경비실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 19, "floor": "B1", "room": "방재실", "mgmt": "", "kind": "Halon", "size": "3", "year": 2020, "maker": "포트텍"}, {"no": 20, "floor": "1", "room": "공용복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 21, "floor": "1", "room": "공용복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 22, "floor": "1", "room": "의과학연구처", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 23, "floor": "1", "room": "적정진료관리실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 24, "floor": "1", "room": "의무기록팀", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 25, "floor": "1", "room": "근린생활시설-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 26, "floor": "2", "room": "공용복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 27, "floor": "2", "room": "공용복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 28, "floor": "2", "room": "공용복도-3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 29, "floor": "2", "room": "총무팀", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 30, "floor": "2", "room": "인사팀", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 31, "floor": "2", "room": "구매관재팀", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 32, "floor": "2", "room": "대외협력실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 33, "floor": "2", "room": "종합관회의실-A", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 34, "floor": "2", "room": "재무회계팀-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 35, "floor": "2", "room": "재무회계팀-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 36, "floor": "3", "room": "공용복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 37, "floor": "3", "room": "공용복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 38, "floor": "3", "room": "공용복도-3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 39, "floor": "3", "room": "기획조정실-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 40, "floor": "3", "room": "기획조정실-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 41, "floor": "3", "room": "보험심사팀", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 42, "floor": "3", "room": "회의실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 43, "floor": "3", "room": "비서실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 44, "floor": "3", "room": "의료원장실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 45, "floor": "3", "room": "교육수련부", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 46, "floor": "3", "room": "종합관회의실-B", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 47, "floor": "3", "room": "종합관회의실-C", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 48, "floor": "4", "room": "공용복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 49, "floor": "4", "room": "공용복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 50, "floor": "4", "room": "공용복도-3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 51, "floor": "4", "room": "공용복도-4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 52, "floor": "4", "room": "공용복도-5", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 53, "floor": "4", "room": "공용복도-6", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 54, "floor": "5", "room": "공용복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 55, "floor": "5", "room": "공용복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 56, "floor": "5", "room": "공용복도-3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 57, "floor": "5", "room": "공용복도-4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 58, "floor": "5", "room": "공용복도-5", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 59, "floor": "5", "room": "공용복도-6", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 60, "floor": "6", "room": "공용복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 61, "floor": "6", "room": "공용복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 62, "floor": "6", "room": "공용복도-3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 63, "floor": "6", "room": "공용복도-4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 64, "floor": "6", "room": "공용복도-5", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 65, "floor": "6", "room": "공용복도-6", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 66, "floor": "7", "room": "공용복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 67, "floor": "7", "room": "공용복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 68, "floor": "7", "room": "공용복도-3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 69, "floor": "7", "room": "공용복도-4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 70, "floor": "7", "room": "공용복도-5", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 71, "floor": "옥탑", "room": "공용복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 72, "floor": "옥탑", "room": "공용복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "㈜일명"}, {"no": 73, "floor": "옥탑", "room": "기계실", "mgmt": "", "kind": "Halon", "size": "3", "year": 2020, "maker": "포트텍"}], "의학관": [{"no": 1, "floor": "PH", "room": "옥상 (우)", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 2, "floor": "PH", "room": "옥상 (좌)", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 3, "floor": "5", "room": "응급실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "한울방재"}, {"no": 4, "floor": "5", "room": "응급실 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2021, "maker": "삼우산기"}, {"no": 5, "floor": "5", "room": "중환자실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "한울방재"}, {"no": 6, "floor": "5", "room": "입원실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "한울방재"}, {"no": 7, "floor": "5", "room": "디프리빙실 1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2019, "maker": "FIC"}, {"no": 8, "floor": "5", "room": "디프리빙실 2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "한울방재"}, {"no": 9, "floor": "5", "room": "디프리빙실 3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "한울방재"}, {"no": 10, "floor": "5", "room": "팀학습 강의실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "한울방재"}, {"no": 11, "floor": "5", "room": "교육혁신팀", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "한울방재"}, {"no": 12, "floor": "5", "room": "교육혁신팀 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "한울방재"}, {"no": 13, "floor": "5", "room": "물품보관실 1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "한울방재"}, {"no": 14, "floor": "5", "room": "멀티미디어 강의실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "한울방재"}, {"no": 15, "floor": "5", "room": "임상슬기 실습실 1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "한울방재"}, {"no": 16, "floor": "5", "room": "임상슬기 실습실 2-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "한울방재"}, {"no": 17, "floor": "5", "room": "임상슬기 실습실 2-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "한울방재"}, {"no": 18, "floor": "5", "room": "임상슬기 실습실 2-2 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2021, "maker": "삼우산기"}, {"no": 19, "floor": "5", "room": "물품보관실 2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "한울방재"}, {"no": 20, "floor": "5", "room": "세미나실 1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "한울방재"}, {"no": 21, "floor": "5", "room": "세미나실 1 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2021, "maker": "삼우산기"}, {"no": 22, "floor": "5", "room": "CPX 조정실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "한울방재"}, {"no": 23, "floor": "5", "room": "CPX 조정실 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "한울방재"}, {"no": 24, "floor": "5", "room": "7번 6번방 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2020, "maker": "한울방재"}, {"no": 25, "floor": "4", "room": "401-1호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2022, "maker": "삼우산기"}, {"no": 26, "floor": "4", "room": "401-2호", "mgmt": "", "kind": "가스계", "size": "3", "year": 2022, "maker": "포트텍"}, {"no": 27, "floor": "4", "room": "401-2호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 28, "floor": "4", "room": "403-1호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 29, "floor": "4", "room": "403-3호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 30, "floor": "4", "room": "403-13호 앞 복도", "mgmt": "", "kind": "가스계", "size": "3", "year": 2023, "maker": "포트텍"}, {"no": 31, "floor": "4", "room": "403-13호 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 32, "floor": "4", "room": "403-8호 앞 복도", "mgmt": "", "kind": "가스계", "size": "3", "year": 2022, "maker": "포트텍"}, {"no": 33, "floor": "4", "room": "403-8호 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 34, "floor": "4", "room": "401호 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 35, "floor": "4", "room": "406호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 36, "floor": "4", "room": "생화학실험실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 37, "floor": "4", "room": "생화학실험실", "mgmt": "", "kind": "가스계", "size": "3", "year": 2022, "maker": "포트텍"}, {"no": 38, "floor": "4", "room": "화장실 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 39, "floor": "4", "room": "407호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 40, "floor": "4", "room": "407-3호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2022, "maker": "삼우산기"}, {"no": 41, "floor": "4", "room": "407-2호", "mgmt": "", "kind": "가스계", "size": "3", "year": 2022, "maker": "포트텍"}, {"no": 42, "floor": "4", "room": "411호 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 43, "floor": "4", "room": "413호", "mgmt": "", "kind": "가스계", "size": "3", "year": 2022, "maker": "포트텍"}, {"no": 44, "floor": "4", "room": "413호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 45, "floor": "4", "room": "413-1호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 46, "floor": "4", "room": "432호 앞 복도 소화전", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 47, "floor": "4", "room": "417호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 48, "floor": "4", "room": "417-2호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 49, "floor": "4", "room": "417-2호", "mgmt": "", "kind": "가스계", "size": "3", "year": 2022, "maker": "포트텍"}, {"no": 50, "floor": "4", "room": "공동연구지원실-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 51, "floor": "4", "room": "공동연구지원실-1", "mgmt": "", "kind": "가스계", "size": "3", "year": 2022, "maker": "포트텍"}, {"no": 52, "floor": "4", "room": "공동연구지원실-1", "mgmt": "", "kind": "가스계", "size": "3", "year": 2017, "maker": "포트텍"}, {"no": 53, "floor": "4", "room": "공동연구지원실-3 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 54, "floor": "4", "room": "공동연구지원실-4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 55, "floor": "4", "room": "공동연구지원실-5", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 56, "floor": "4", "room": "공동연구지원실-5", "mgmt": "", "kind": "가스계", "size": "3", "year": 2022, "maker": "포트텍"}, {"no": 57, "floor": "4", "room": "공동연구지원실-5", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 58, "floor": "3", "room": "301호", "mgmt": "", "kind": "가스계", "size": "3", "year": 2022, "maker": "포트텍"}, {"no": 59, "floor": "3", "room": "303호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 60, "floor": "3", "room": "303호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 61, "floor": "3", "room": "303호 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 62, "floor": "3", "room": "305호", "mgmt": "", "kind": "가스계", "size": "3", "year": 2022, "maker": "포트텍"}, {"no": 63, "floor": "3", "room": "305호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 64, "floor": "3", "room": "312호", "mgmt": "", "kind": "Halon", "size": "3", "year": 2007, "maker": "티파니상사"}, {"no": 65, "floor": "3", "room": "312호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 66, "floor": "3", "room": "307호 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 67, "floor": "3", "room": "316호", "mgmt": "", "kind": "Halon", "size": "3", "year": 2007, "maker": "티파니상사"}, {"no": 68, "floor": "3", "room": "309-1호", "mgmt": "", "kind": "가스계", "size": "3", "year": 2017, "maker": "포트텍"}, {"no": 69, "floor": "3", "room": "309-1호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 70, "floor": "3", "room": "309-1호 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 71, "floor": "3", "room": "309-2호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 72, "floor": "3", "room": "해부학준비실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 73, "floor": "3", "room": "해부학준비실", "mgmt": "", "kind": "가스계", "size": "3", "year": 2017, "maker": "포트텍"}, {"no": 74, "floor": "3", "room": "해부학준비실-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 75, "floor": "3", "room": "해부학준비실 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 76, "floor": "3", "room": "해부학준비실 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 77, "floor": "3", "room": "해부학실습실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 78, "floor": "3", "room": "해부학실습실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 79, "floor": "3", "room": "해부학실습실", "mgmt": "", "kind": "가스계", "size": "3", "year": 2017, "maker": "포트텍"}, {"no": 80, "floor": "2", "room": "201호 입구", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 81, "floor": "2", "room": "201호 중앙", "mgmt": "", "kind": "가스계", "size": "3", "year": 2022, "maker": "포트텍"}, {"no": 82, "floor": "2", "room": "201호 중앙", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 83, "floor": "2", "room": "201호 안쪽 벽", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 84, "floor": "2", "room": "201호 안쪽 벽", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2022, "maker": "삼우산기"}, {"no": 85, "floor": "2", "room": "201호 오른쪽 실험실 입구", "mgmt": "", "kind": "가스계", "size": "3", "year": 2023, "maker": "포트텍"}, {"no": 86, "floor": "2", "room": "202호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 87, "floor": "2", "room": "201호 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 88, "floor": "2", "room": "203호", "mgmt": "", "kind": "가스계", "size": "3", "year": 2022, "maker": "포트텍"}, {"no": 89, "floor": "2", "room": "203호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 90, "floor": "2", "room": "205호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 91, "floor": "2", "room": "205호 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 92, "floor": "2", "room": "216호", "mgmt": "", "kind": "가스계", "size": "3", "year": 2023, "maker": "포트텍"}, {"no": 93, "floor": "2", "room": "216호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 94, "floor": "2", "room": "207호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 95, "floor": "2", "room": "207호 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 96, "floor": "2", "room": "209호", "mgmt": "", "kind": "가스계", "size": "3", "year": 2022, "maker": "포트텍"}, {"no": 97, "floor": "2", "room": "209호", "mgmt": "", "kind": "가스계", "size": "3", "year": 2022, "maker": "포트텍"}, {"no": 98, "floor": "2", "room": "209호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 99, "floor": "2", "room": "209호 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 100, "floor": "2", "room": "226호", "mgmt": "", "kind": "가스계", "size": "3", "year": 2017, "maker": "포트텍"}, {"no": 101, "floor": "2", "room": "226호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 102, "floor": "1", "room": "사무팀", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 103, "floor": "1", "room": "사무팀", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 104, "floor": "1", "room": "비서실 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 105, "floor": "1", "room": "비서실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 106, "floor": "1", "room": "비서실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 107, "floor": "1", "room": "형태지원연구실 입구", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 108, "floor": "1", "room": "형태지원연구실 입구", "mgmt": "", "kind": "가스계", "size": "3", "year": 2022, "maker": "포트텍"}, {"no": 109, "floor": "1", "room": "형태지원연구실 우측 실", "mgmt": "", "kind": "가스계", "size": "3", "year": 2022, "maker": "포트텍"}, {"no": 110, "floor": "1", "room": "형태지원연구실 좌측 실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 111, "floor": "1", "room": "형태지원연구실 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 112, "floor": "1", "room": "형태지원연구실 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 113, "floor": "1", "room": "교육혁신처", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2019, "maker": "일명"}, {"no": 114, "floor": "1", "room": "인체세포 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 115, "floor": "1", "room": "인체세포 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 116, "floor": "1", "room": "인체세포(작은복도)", "mgmt": "", "kind": "가스계", "size": "3", "year": 2025, "maker": "에이치티씨"}, {"no": 117, "floor": "1", "room": "인체세포(재생의학사무실)", "mgmt": "", "kind": "가스계", "size": "3", "year": 2025, "maker": "에이치티씨"}, {"no": 118, "floor": "1", "room": "인체세포(문서보관함)", "mgmt": "", "kind": "가스계", "size": "3", "year": 2025, "maker": "에이치티씨"}, {"no": 119, "floor": "1", "room": "인체세포(주복도)", "mgmt": "", "kind": "가스계", "size": "3", "year": 2025, "maker": "에이치티씨"}, {"no": 120, "floor": "1", "room": "병원경영실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 121, "floor": "B1", "room": "B109-1호 앞 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2019, "maker": "일명"}, {"no": 122, "floor": "B1", "room": "B109-1호 앞 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 123, "floor": "B1", "room": "B101,102호 앞 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 124, "floor": "B1", "room": "B101,102호 앞 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 125, "floor": "B1", "room": "초저온냉동고 통합실 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 126, "floor": "B1", "room": "초저온냉동고 통합실 -2", "mgmt": "", "kind": "CO2", "size": "2.3", "year": 2002, "maker": "신광산업"}, {"no": 127, "floor": "B1", "room": "초저온냉동고 통합실 -3", "mgmt": "", "kind": "CO2", "size": "2.3", "year": null, "maker": ""}, {"no": 128, "floor": "외곽", "room": "가스보관실 앞 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2017, "maker": "한울방재"}, {"no": 129, "floor": "외곽", "room": "가스보관실 앞 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2017, "maker": "한울방재"}], "별관": [{"no": 1, "floor": "PH", "room": "소화용수실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 2, "floor": "PH", "room": "E/V 기계실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 3, "floor": "PH", "room": "옥상 전실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 4, "floor": "5", "room": "청상관리파트", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 5, "floor": "5", "room": "청상관리파트 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 6, "floor": "5", "room": "간호국 사무실 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 7, "floor": "5", "room": "간호국 사무실 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 8, "floor": "5", "room": "손덕수홀", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 9, "floor": "5", "room": "E/V 홀 소화전 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 10, "floor": "5", "room": "E/V 홀 소화전 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 11, "floor": "5", "room": "공조실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 12, "floor": "5", "room": "체크업 교수실#1 앞 복도 ", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 13, "floor": "5", "room": "계단실#3 앞 소화전 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 14, "floor": "5", "room": "계단실#3 앞 소화전 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 15, "floor": "5", "room": "핵산증폭후 검사실 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 16, "floor": "5", "room": "핵산증폭후 검사실 -2", "mgmt": "", "kind": "가스계", "size": "3", "year": 2015, "maker": "조경산업주식회사"}, {"no": 17, "floor": "5", "room": "분자유전자 검사실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 18, "floor": "5", "room": "임상미생물파트 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 19, "floor": "5", "room": "임상미생물파트 -2", "mgmt": "", "kind": "가스계", "size": "3", "year": 2017, "maker": "포트텍"}, {"no": 20, "floor": "5", "room": "임상미생물파트 -3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 21, "floor": "4", "room": "치과 파트장실 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 22, "floor": "4", "room": "E/V 홀 소화전 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 23, "floor": "4", "room": "E/V 홀 소화전 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 24, "floor": "4", "room": "공조실 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 25, "floor": "4", "room": "공조실 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 26, "floor": "4", "room": "치과교정과 입구", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 27, "floor": "4", "room": "계단실#3 앞 소화전 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 28, "floor": "4", "room": "계단실#3 앞 소화전 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 29, "floor": "4", "room": "CAD/CAM", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 30, "floor": "4", "room": "구강외과 진료실 입구", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 31, "floor": "4", "room": "치과보철과 입구", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 32, "floor": "3", "room": "간호국 CL5 ", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 33, "floor": "3", "room": "DR실 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 34, "floor": "3", "room": "DR실 -1", "mgmt": "", "kind": "가스계", "size": "3", "year": 2024, "maker": "포트텍"}, {"no": 35, "floor": "3", "room": "DR실 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 36, "floor": "3", "room": "E/V 홀 소화전 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 37, "floor": "3", "room": "E/V 홀 소화전 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 38, "floor": "3", "room": "공조실 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 39, "floor": "3", "room": "공조실 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 40, "floor": "3", "room": "핵의학과 탈의실(여) 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 41, "floor": "3", "room": "계단실#3 앞 소화전 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 42, "floor": "3", "room": "계단실#3 앞 소화전 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 43, "floor": "3", "room": "감마카메라실", "mgmt": "", "kind": "가스계", "size": "3", "year": 2024, "maker": "포트텍"}, {"no": 44, "floor": "3", "room": "SPET-CT", "mgmt": "", "kind": "가스계", "size": "3", "year": 2024, "maker": "포트텍"}, {"no": 45, "floor": "3", "room": "옥상 출입문 입구", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 46, "floor": "3", "room": "PET-CT", "mgmt": "", "kind": "가스계", "size": "3", "year": 2024, "maker": "포트텍"}, {"no": 47, "floor": "2", "room": "직업환경의학과 입구 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 48, "floor": "2", "room": "직업환경의학과 입구 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 49, "floor": "2", "room": "폐기능 검사실 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 50, "floor": "2", "room": "E/V 홀 소화전 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 51, "floor": "2", "room": "E/V 홀 소화전 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 52, "floor": "2", "room": "방사선종양학과 치료계획실 ", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 53, "floor": "2", "room": "원무/수납 로비", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 54, "floor": "2", "room": "방사선종양학과 진료실#3 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 55, "floor": "2", "room": "계단실#3 앞 소화전 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 56, "floor": "2", "room": "계단실#3 앞 소화전 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 57, "floor": "2", "room": "근접치료실", "mgmt": "", "kind": "가스계", "size": "3", "year": 2024, "maker": "포트텍"}, {"no": 58, "floor": "2", "room": "방사선치료실#1", "mgmt": "", "kind": "가스계", "size": "3", "year": 2024, "maker": "포트텍"}, {"no": 59, "floor": "2", "room": "방사선치료실#2", "mgmt": "", "kind": "가스계", "size": "3", "year": 2024, "maker": "포트텍"}, {"no": 60, "floor": "2", "room": "방사선치료실#3", "mgmt": "", "kind": "가스계", "size": "3", "year": 2024, "maker": "포트텍"}, {"no": 61, "floor": "2", "room": "이미징실 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 62, "floor": "2", "room": "CT SIMULATION", "mgmt": "", "kind": "가스계", "size": "3", "year": 2025, "maker": "㈜에이치티씨"}, {"no": 63, "floor": "1", "room": "계단실#3 앞 소화전 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 64, "floor": "1", "room": "계단실#3 앞 소화전 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 65, "floor": "1", "room": "통합사무실 입구", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 66, "floor": "1", "room": "생화학분석실 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 67, "floor": "1", "room": "일반 실험실#1", "mgmt": "", "kind": "가스계", "size": "3", "year": 2024, "maker": "포트텍"}, {"no": 68, "floor": "1", "room": "고압의학 실험실", "mgmt": "", "kind": "가스계", "size": "3", "year": 2024, "maker": "포트텍"}, {"no": 69, "floor": "1", "room": "대사분석실", "mgmt": "", "kind": "가스계", "size": "3", "year": 2024, "maker": "포트텍"}, {"no": 70, "floor": "1", "room": "대사분석실 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 71, "floor": "1", "room": "부검실 앞 복도 소화전", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 72, "floor": "1", "room": "멸균실 입구 ", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 73, "floor": "1", "room": "휴게실 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 74, "floor": "1", "room": "B/C실 앞 입구 ", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 75, "floor": "1", "room": "세척실(외부세척)", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 76, "floor": "1", "room": "회복실 앞 복도 소화전", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 77, "floor": "1", "room": "중동물수술실#1", "mgmt": "", "kind": "가스계", "size": "3", "year": 2025, "maker": "㈜에이치티씨"}, {"no": 78, "floor": "1", "room": "중동물수술실#2", "mgmt": "", "kind": "가스계", "size": "3", "year": 2025, "maker": "㈜에이치티씨"}, {"no": 79, "floor": "1", "room": "계단실#2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 80, "floor": "B1", "room": "E/V 홀 소화전 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 81, "floor": "B1", "room": "E/V 홀 소화전 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 82, "floor": "B1", "room": "TPS실 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 83, "floor": "B1", "room": "9번기둥", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 84, "floor": "B1", "room": "공조실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 85, "floor": "B1", "room": "계단실#2 앞 소화전 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 86, "floor": "B1", "room": "계단실#2 앞 소화전 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 87, "floor": "B1", "room": "15번기둥", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 88, "floor": "B1", "room": "1번기둥", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 89, "floor": "B1", "room": "3번기둥", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 90, "floor": "B2", "room": "E/V 홀 소화전 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 91, "floor": "B2", "room": "E/V 홀 소화전 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 92, "floor": "B2", "room": "TPS실 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 93, "floor": "B2", "room": "용원실 앞 소화전 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 94, "floor": "B2", "room": "용원실 앞 소화전 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 95, "floor": "B2", "room": "계단실#2번 앞 소화전-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 96, "floor": "B2", "room": "계단실#2번 앞 소화전-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 97, "floor": "B2", "room": "15번기둥", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 98, "floor": "B2", "room": "1번기둥", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 99, "floor": "B2", "room": "3번기둥", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 100, "floor": "B3", "room": "E/V 홀 소화전 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 101, "floor": "B3", "room": "E/V 홀 소화전 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 102, "floor": "B3", "room": "TPS실 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 103, "floor": "B3", "room": "의료가스실 앞 소화전 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 104, "floor": "B3", "room": "의료가스실 앞 소화전 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 105, "floor": "B3", "room": "계단실#2번 앞 소화전-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 106, "floor": "B3", "room": "계단실#2번 앞 소화전-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 107, "floor": "B3", "room": "15번기둥", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 108, "floor": "B3", "room": "1번기둥", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 109, "floor": "B3", "room": "3번기둥", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 110, "floor": "B4", "room": "E/V 홀 소화전 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 111, "floor": "B4", "room": "E/V 홀 소화전 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 112, "floor": "B4", "room": "폐수조관리층", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 113, "floor": "B4", "room": "폐수조관리층 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 114, "floor": "B4", "room": "RI조", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 115, "floor": "B4", "room": "기계실 소화전 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 116, "floor": "B4", "room": "기계실 소화전 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 117, "floor": "B4", "room": "장비반입구 앞 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 118, "floor": "B4", "room": "장비반입구 앞 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 119, "floor": "B4", "room": "발전기실 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "한울방재"}, {"no": 120, "floor": "B4", "room": "발전기실 -2", "mgmt": "", "kind": "분말", "size": "20", "year": 2025, "maker": "한울방재"}, {"no": 121, "floor": "B4", "room": "발전기실 -3", "mgmt": "", "kind": "분말", "size": "20", "year": 2025, "maker": "한울방재"}, {"no": 122, "floor": "B4", "room": "발전기실 -4", "mgmt": "", "kind": "가스계", "size": "3", "year": 2024, "maker": "포트텍"}, {"no": 123, "floor": "B4", "room": "발전기실 -5", "mgmt": "", "kind": "가스계", "size": "3", "year": 2024, "maker": "포트텍"}, {"no": 124, "floor": "B4", "room": "발전기실 -6", "mgmt": "", "kind": "가스계", "size": "3", "year": 2024, "maker": "포트텍"}, {"no": 125, "floor": "B4", "room": "발전기실 -7", "mgmt": "", "kind": "가스계", "size": "3", "year": 2024, "maker": "포트텍"}, {"no": 126, "floor": "B4", "room": "발전기실 앞 복도", "mgmt": "", "kind": "분말", "size": "20", "year": 2025, "maker": "한울방재"}, {"no": 127, "floor": "B4", "room": "UPS 배터리실(의료) -1", "mgmt": "", "kind": "가스계", "size": "3", "year": 2024, "maker": "포트텍"}, {"no": 128, "floor": "B4", "room": "UPS 배터리실(의료) -2", "mgmt": "", "kind": "가스계", "size": "3", "year": 2024, "maker": "포트텍"}, {"no": 129, "floor": "B4", "room": "소화가스실", "mgmt": "", "kind": "분말", "size": "20", "year": 2025, "maker": "한울방재"}, {"no": 130, "floor": "B4", "room": "계단실#2번 앞 소화전-1", "mgmt": "", "kind": "분말", "size": "20", "year": 2025, "maker": "한울방재"}, {"no": 131, "floor": "B4", "room": "계단실#2번 앞 소화전-2", "mgmt": "", "kind": "분말", "size": "20", "year": 2025, "maker": "한울방재"}, {"no": 132, "floor": "B4", "room": "전기실 -1", "mgmt": "", "kind": "가스계", "size": "3", "year": 2024, "maker": "포트텍"}, {"no": 133, "floor": "B4", "room": "전기실 -2", "mgmt": "", "kind": "가스계", "size": "3", "year": 2024, "maker": "포트텍"}, {"no": 134, "floor": "B4", "room": "전기실 -3", "mgmt": "", "kind": "가스계", "size": "3", "year": 2024, "maker": "포트텍"}, {"no": 135, "floor": "B4", "room": "전기실 -4", "mgmt": "", "kind": "가스계", "size": "3", "year": 2024, "maker": "포트텍"}, {"no": 136, "floor": "B4", "room": "전기실 -5", "mgmt": "", "kind": "가스계", "size": "3", "year": 2024, "maker": "포트텍"}, {"no": 137, "floor": "B4", "room": "전기실 -6", "mgmt": "", "kind": "가스계", "size": "3", "year": 2024, "maker": "포트텍"}, {"no": 138, "floor": "B4", "room": "전기실 -7", "mgmt": "", "kind": "가스계", "size": "3", "year": 2024, "maker": "포트텍"}], "진리관": [{"no": 1, "floor": "5", "room": "PBL실 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 2, "floor": "5", "room": "진료역량개발센터 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 3, "floor": "5", "room": "진료역량개발센터 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 4, "floor": "5", "room": "중앙셔터 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 5, "floor": "5", "room": "교수실 앞 복도 소화전", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 6, "floor": "4", "room": "401호 강의실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 7, "floor": "4", "room": "교수실 앞 복도 소화전", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 8, "floor": "4", "room": "402호 강의실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 9, "floor": "4", "room": "402호 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 10, "floor": "4", "room": "중앙계단 입구 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 11, "floor": "4", "room": "중앙계단 입구 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 12, "floor": "4", "room": "421호 강의실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 13, "floor": "4", "room": "자유열람실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 14, "floor": "3", "room": "301호 강의실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 15, "floor": "3", "room": "301호 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 16, "floor": "3", "room": "302호 강의실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 17, "floor": "3", "room": "304호 강의실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 18, "floor": "3", "room": "304호 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 19, "floor": "3", "room": "중앙계단 입구 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 20, "floor": "3", "room": "중앙계단 입구 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 21, "floor": "3", "room": "자유열람실 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 22, "floor": "3", "room": "자유열람실 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 23, "floor": "2", "room": "의학도서관 좌측", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 24, "floor": "2", "room": "의학도서관 우측 소화전", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 25, "floor": "2", "room": "의학도서관 중앙", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 26, "floor": "2", "room": "의학도서관 Media lounge", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 27, "floor": "2", "room": "의학도서관 세미나실2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 28, "floor": "2", "room": "E/L 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 29, "floor": "2", "room": "201호 강의실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 30, "floor": "2", "room": "202호 강의실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 31, "floor": "2", "room": "대외협력실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 32, "floor": "1", "room": "의학도서관 좌측", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 33, "floor": "1", "room": "의학도서관 우측 소화전", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 34, "floor": "1", "room": "의학도서관 중앙 출입문", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 35, "floor": "1", "room": "101호 강의실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 36, "floor": "1", "room": "101호 강의실 앞 소화전", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 37, "floor": "1", "room": "102호 강의실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 38, "floor": "1", "room": "정문 입구", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 39, "floor": "1", "room": "주차장 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 40, "floor": "1", "room": "주차장 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 41, "floor": "B1", "room": "전기실 -1", "mgmt": "", "kind": "CO2", "size": "2.3", "year": 2002, "maker": "신광산업"}, {"no": 42, "floor": "B1", "room": "전기실 -2", "mgmt": "", "kind": "CO2", "size": "2.3", "year": 2002, "maker": "신광산업"}, {"no": 43, "floor": "B1", "room": "전기실 -3", "mgmt": "", "kind": "CO2", "size": "2.3", "year": 2002, "maker": "신광산업"}, {"no": 44, "floor": "B1", "room": "전기실 -4", "mgmt": "", "kind": "CO2", "size": "2.3", "year": 2002, "maker": "신광산업"}, {"no": 45, "floor": "B1", "room": "발전기실", "mgmt": "", "kind": "CO2", "size": "2.3", "year": 2002, "maker": "신광산업"}, {"no": 46, "floor": "B1", "room": "사무실 앞 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 47, "floor": "B1", "room": "사무실 앞 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 48, "floor": "B1", "room": "기계실 소화전 옆 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 49, "floor": "B1", "room": "기계실 소화전 옆 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 50, "floor": "B1", "room": "기계실 -1", "mgmt": "", "kind": "CO2", "size": "23", "year": 1994, "maker": "NKFIRE"}, {"no": 51, "floor": "B1", "room": "기계실 -2", "mgmt": "", "kind": "자동확산", "size": "3", "year": null, "maker": ""}, {"no": 52, "floor": "B1", "room": "기계실 -3", "mgmt": "", "kind": "자동확산", "size": "3", "year": null, "maker": ""}], "영빈관": [{"no": 1, "floor": "다락방", "room": "영빈관", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 2, "floor": "2", "room": "영빈관", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 3, "floor": "1", "room": "영빈관", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 4, "floor": "B1", "room": "영빈관 보일러실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 5, "floor": "B1", "room": "영빈관 보일러실", "mgmt": "", "kind": "자동확산", "size": "3", "year": 2018, "maker": "삼우산기"}, {"no": 6, "floor": "B1", "room": "영빈관 보일러실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2019, "maker": "일명"}], "루가홀": [{"no": 1, "floor": "1", "room": "루가홀 강당 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 2, "floor": "1", "room": "루가홀 강당 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 3, "floor": "1", "room": "루가홀 강당 -3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 4, "floor": "1", "room": "루가홀 강당 -4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 5, "floor": "1", "room": "루가홀 로비", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}], "원의1학사": [{"no": 1, "floor": "4", "room": "A동 좌측 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 2, "floor": "4", "room": "A동 좌측 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 3, "floor": "4", "room": "A동 우측 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 4, "floor": "4", "room": "A동 우측 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 5, "floor": "4", "room": "B동 좌측복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 6, "floor": "4", "room": "B동 좌측복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 7, "floor": "4", "room": "B동 우측복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2021, "maker": "삼우산기"}, {"no": 8, "floor": "4", "room": "B동 우측복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 9, "floor": "3", "room": "A동 좌측 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 10, "floor": "3", "room": "A동 좌측 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 11, "floor": "3", "room": "A동 우측 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 12, "floor": "3", "room": "A동 우측 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 13, "floor": "3", "room": "B동 좌측복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 14, "floor": "3", "room": "B동 좌측복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 15, "floor": "3", "room": "B동 우측복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 16, "floor": "3", "room": "B동 우측복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 17, "floor": "2", "room": "A동 좌측 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 18, "floor": "2", "room": "A동 좌측 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 19, "floor": "2", "room": "A동 우측 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 20, "floor": "2", "room": "A동 우측 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 21, "floor": "2", "room": "B동 좌측복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 22, "floor": "2", "room": "B동 좌측복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 23, "floor": "2", "room": "B동 우측복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 24, "floor": "2", "room": "B동 우측복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 25, "floor": "1", "room": "로비 입구", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 26, "floor": "1", "room": "로비 입구", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2021, "maker": "삼우산기"}, {"no": 27, "floor": "1", "room": "A동 좌측 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 28, "floor": "1", "room": "A동 좌측 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 29, "floor": "1", "room": "A동 우측 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 30, "floor": "1", "room": "A동 우측 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 31, "floor": "1", "room": "B동 좌측복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 32, "floor": "1", "room": "B동 좌측복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 33, "floor": "1", "room": "B동 우측복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 34, "floor": "1", "room": "B동 우측복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 35, "floor": "B1", "room": "B105 강의실 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 36, "floor": "B1", "room": "B105 강의실 앞", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 37, "floor": "B1", "room": "편의점 앞 연결복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 38, "floor": "B1", "room": "편의점 앞 연결복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 39, "floor": "B1", "room": "B107 기숙사생 자율학습실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 40, "floor": "B1", "room": "기계실 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 41, "floor": "B1", "room": "기계실 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 42, "floor": "B1", "room": "기계실 -3", "mgmt": "", "kind": "자동확산", "size": "3", "year": null, "maker": ""}, {"no": 43, "floor": "B1", "room": "기계실 -4", "mgmt": "", "kind": "자동확산", "size": "3", "year": null, "maker": ""}], "원의2학사": [{"no": 1, "floor": "5", "room": "2501호 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 2, "floor": "5", "room": "2507호 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 3, "floor": "5", "room": "세면장 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 4, "floor": "5", "room": "2514호 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 5, "floor": "4", "room": "2401호 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 6, "floor": "4", "room": "2407호 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 7, "floor": "4", "room": "세면장 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 8, "floor": "4", "room": "2414호 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 9, "floor": "3", "room": "2301호 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 10, "floor": "3", "room": "2307호 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 11, "floor": "3", "room": "세면장 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 12, "floor": "3", "room": "2314호 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 13, "floor": "2", "room": "2217호 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 14, "floor": "2", "room": "2223호 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 15, "floor": "2", "room": "세면장 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 16, "floor": "2", "room": "2205호 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2021, "maker": "삼우산기"}, {"no": 17, "floor": "1", "room": "식당 입구 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 18, "floor": "1", "room": "식당 입구 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 19, "floor": "1", "room": "식당 주방 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 20, "floor": "1", "room": "식당 주방 -2", "mgmt": "", "kind": "자동확산", "size": "3", "year": 2016, "maker": "삼우산기"}, {"no": 21, "floor": "1", "room": "식당 주방 -3", "mgmt": "", "kind": "자동확산", "size": "3", "year": 2016, "maker": "삼우산기"}, {"no": 22, "floor": "1", "room": "헬스장", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 23, "floor": "1", "room": "건물 뒷편 흡연실 ", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}], "원의3학사": [{"no": 1, "floor": "옥탑", "room": "계단 전실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 2, "floor": "8층", "room": "복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 3, "floor": "8층", "room": "복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 4, "floor": "8층", "room": "3802호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 5, "floor": "8층", "room": "3804호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 6, "floor": "8층", "room": "3806호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 7, "floor": "8층", "room": "3808호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 8, "floor": "8층", "room": "3809호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 9, "floor": "7층", "room": "복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 10, "floor": "7층", "room": "복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 11, "floor": "7층", "room": "3702호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 12, "floor": "7층", "room": "3704호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 13, "floor": "7층", "room": "3706호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 14, "floor": "7층", "room": "3708호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 15, "floor": "7층", "room": "3709호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 16, "floor": "6층", "room": "복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 17, "floor": "6층", "room": "복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 18, "floor": "6층", "room": "3602호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 19, "floor": "6층", "room": "3604호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 20, "floor": "6층", "room": "3606호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 21, "floor": "6층", "room": "3608호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 22, "floor": "6층", "room": "3609호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 23, "floor": "5층", "room": "복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 24, "floor": "5층", "room": "복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 25, "floor": "5층", "room": "3502호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 26, "floor": "5층", "room": "3504호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 27, "floor": "5층", "room": "3506호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 28, "floor": "5층", "room": "3508호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 29, "floor": "5층", "room": "3509호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 30, "floor": "4층", "room": "복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 31, "floor": "4층", "room": "복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 32, "floor": "4층", "room": "복도-3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 33, "floor": "4층", "room": "복도-4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 34, "floor": "4층", "room": "복도-5", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 35, "floor": "4층", "room": "RC ROOM", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 36, "floor": "4층", "room": "3401호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 37, "floor": "4층", "room": "3403호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 38, "floor": "4층", "room": "3405호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 39, "floor": "4층", "room": "3407호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 40, "floor": "4층", "room": "3409호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 41, "floor": "4층", "room": "3411호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 42, "floor": "4층", "room": "3415호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 43, "floor": "4층", "room": "3417호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 44, "floor": "4층", "room": "3418호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 45, "floor": "4층", "room": "3420호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 46, "floor": "4층", "room": "3423호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 47, "floor": "4층", "room": "3425호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 48, "floor": "4층", "room": "3427호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 49, "floor": "4층", "room": "3429호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "SW"}, {"no": 50, "floor": "4층", "room": "3430호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 51, "floor": "3층", "room": "복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 52, "floor": "3층", "room": "복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 53, "floor": "3층", "room": "복도-3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 54, "floor": "3층", "room": "복도-4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 55, "floor": "3층", "room": "복도-5", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 56, "floor": "3층", "room": "RC ROOM", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 57, "floor": "3층", "room": "3301호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 58, "floor": "3층", "room": "3303호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 59, "floor": "3층", "room": "3305호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 60, "floor": "3층", "room": "3307호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 61, "floor": "3층", "room": "3309호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 62, "floor": "3층", "room": "3311호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 63, "floor": "3층", "room": "3315호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 64, "floor": "3층", "room": "3317호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 65, "floor": "3층", "room": "3318호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 66, "floor": "3층", "room": "3320호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 67, "floor": "3층", "room": "3323호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 68, "floor": "3층", "room": "3325호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 69, "floor": "3층", "room": "3327호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 70, "floor": "3층", "room": "3329호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 71, "floor": "3층", "room": "3330호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 72, "floor": "2층", "room": "복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 73, "floor": "2층", "room": "복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 74, "floor": "2층", "room": "복도-3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 75, "floor": "2층", "room": "복도-4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 76, "floor": "2층", "room": "복도-5", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 77, "floor": "2층", "room": "복도-6", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 78, "floor": "2층", "room": "RC ROOM", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 79, "floor": "2층", "room": "경비실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 80, "floor": "2층", "room": "TPS", "mgmt": "", "kind": "CO2", "size": "2.3", "year": 2018, "maker": "오일금속"}, {"no": 81, "floor": "2층", "room": "3201호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 82, "floor": "2층", "room": "3203호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 83, "floor": "2층", "room": "3205호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 84, "floor": "2층", "room": "3207호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 85, "floor": "2층", "room": "3209호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 86, "floor": "2층", "room": "3211호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 87, "floor": "2층", "room": "3214호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 88, "floor": "2층", "room": "3216호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 89, "floor": "2층", "room": "3217호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 90, "floor": "2층", "room": "3219호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 91, "floor": "2층", "room": "3222호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 92, "floor": "2층", "room": "3224호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 93, "floor": "2층", "room": "3226호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 94, "floor": "1층", "room": "복도-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 95, "floor": "1층", "room": "복도-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 96, "floor": "1층", "room": "복도-3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 97, "floor": "1층", "room": "복도-4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 98, "floor": "1층", "room": "RC ROOM", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 99, "floor": "1층", "room": "3101호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 100, "floor": "1층", "room": "3103호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 101, "floor": "1층", "room": "3105호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 102, "floor": "1층", "room": "3107호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 103, "floor": "1층", "room": "3109호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 104, "floor": "1층", "room": "3111호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 105, "floor": "1층", "room": "3115호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 106, "floor": "1층", "room": "3117호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 107, "floor": "1층", "room": "3118호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 108, "floor": "1층", "room": "3120호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 109, "floor": "1층", "room": "기계실-1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "파라텍"}, {"no": 110, "floor": "1층", "room": "기계실-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2019, "maker": "파라텍"}, {"no": 111, "floor": "1층", "room": "기계실-3", "mgmt": "", "kind": "CO2", "size": "2.5", "year": 2019, "maker": "포트텍"}, {"no": 112, "floor": "1층", "room": "전기실-1", "mgmt": "", "kind": "Halon", "size": "3", "year": 2007, "maker": "파이어클린"}, {"no": 113, "floor": "1층", "room": "전기실-2", "mgmt": "", "kind": "Halon", "size": "3", "year": 2003, "maker": "Chong Qing\nCORP"}], "장례식장": [{"no": 1, "floor": "PH", "room": "E/L 기계실 ", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 2, "floor": "PH", "room": "E/L 기계실 ", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 3, "floor": "6", "room": "ROOM 1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "한국소방안전\n사회적협동조합"}, {"no": 4, "floor": "6", "room": "ROOM 2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "한국소방안전\n사회적협동조합"}, {"no": 5, "floor": "6", "room": "ROOM 3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "한국소방안전\n사회적협동조합"}, {"no": 6, "floor": "6", "room": "ROOM 4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "한국소방안전\n사회적협동조합"}, {"no": 25, "floor": "5", "room": "ROOM 1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "한국소방안전\n사회적협동조합"}, {"no": 26, "floor": "5", "room": "ROOM 2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "한국소방안전\n사회적협동조합"}, {"no": 27, "floor": "5", "room": "ROOM 3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "한국소방안전\n사회적협동조합"}, {"no": 28, "floor": "5", "room": "ROOM 4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "한국소방안전\n사회적협동조합"}, {"no": 29, "floor": "5", "room": "ROOM 5", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "한국소방안전\n사회적협동조합"}, {"no": 30, "floor": "5", "room": "ROOM 6", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "한국소방안전\n사회적협동조합"}, {"no": 31, "floor": "5", "room": "ROOM 7", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "한국소방안전\n사회적협동조합"}, {"no": 32, "floor": "5", "room": "ROOM 8", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "한국소방안전\n사회적협동조합"}, {"no": 46, "floor": "4", "room": "임상시험센터-2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2017, "maker": "한국소방안전\n사회적협동조합"}, {"no": 47, "floor": "4", "room": "임상시험센터-3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2017, "maker": "한국소방안전\n사회적협동조합"}, {"no": 48, "floor": "4", "room": "임상시험센터-4", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2017, "maker": "한국소방안전\n사회적협동조합"}, {"no": 49, "floor": "4", "room": "임상시험센터-5", "mgmt": "", "kind": "분말", "size": "3.3", "year": null, "maker": ""}, {"no": 50, "floor": "4", "room": "임상시험센터-6", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2017, "maker": "한국소방안전\n사회적협동조합"}, {"no": 51, "floor": "4", "room": "임상시험센터-6", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2017, "maker": "한국소방안전\n사회적협동조합"}, {"no": 52, "floor": "4", "room": "임상시험센터-7", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2014, "maker": "한국소방안전\n사회적협동조합"}, {"no": 53, "floor": "4", "room": "임상시험센터-9", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2017, "maker": "한국소방안전\n사회적협동조합"}, {"no": 54, "floor": "4", "room": "임상시험센터-11", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "한국소방안전\n사회적협동조합"}, {"no": 65, "floor": "3", "room": "출입구 안쪽", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2017, "maker": "㈜일명"}, {"no": 66, "floor": "3", "room": "빈소 6호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2017, "maker": "㈜일명"}, {"no": 67, "floor": "3", "room": "접객실 6호", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2017, "maker": "㈜일명"}, {"no": 72, "floor": "3", "room": "주방 입구", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2012, "maker": "국제"}, {"no": 73, "floor": "3", "room": "주방 입구", "mgmt": "", "kind": "강화액", "size": "4L", "year": 2019, "maker": "포트택"}, {"no": 74, "floor": "3", "room": "주방 뒤", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "대동소방"}, {"no": 75, "floor": "3", "room": "화장실 앞 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2017, "maker": "㈜일명"}, {"no": 84, "floor": "1", "room": "장례용품 안", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2017, "maker": "㈜일명"}, {"no": 85, "floor": "1", "room": "입관실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2017, "maker": "㈜일명"}, {"no": 87, "floor": "1", "room": "참관실 앞 복도 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2005, "maker": "JD산업"}, {"no": 88, "floor": "1", "room": "참관실 앞 복도 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2017, "maker": "㈜일명"}, {"no": 92, "floor": "1", "room": "전기실", "mgmt": "", "kind": "Halon", "size": "3", "year": 2005, "maker": "홍익F&C"}, {"no": 93, "floor": "1", "room": "전기실", "mgmt": "", "kind": "Halon", "size": "3", "year": 2005, "maker": "홍익F&C"}], "장례식장 철골주차장": [{"no": 1, "floor": "3", "room": "장례식장 철골 3F -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 2, "floor": "3", "room": "장례식장 철골 3F -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 3, "floor": "3", "room": "장례식장 철골 3F -3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 4, "floor": "2", "room": "장례식장 철골 2F -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 5, "floor": "2", "room": "장례식장 철골 2F -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 6, "floor": "2", "room": "장례식장 철골 2F -3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 7, "floor": "1", "room": "장례식장 철골 1F -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 8, "floor": "1", "room": "장례식장 철골 1F -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 9, "floor": "1", "room": "장례식장 철골 1F -3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}], "부설주차장 및 재활용창고": [{"no": 1, "floor": "1", "room": "부설주차장", "mgmt": "", "kind": "ELEP-119", "size": "2.5L", "year": null, "maker": "한국방염기술"}, {"no": 2, "floor": "1", "room": "재활용창고 (창고 입구)", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "썬브라이트"}, {"no": 3, "floor": "1", "room": "재활용창고 (창고 내부)", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2024, "maker": "㈜한울방재"}, {"no": 4, "floor": "1", "room": "재활용창고 (휴게실)", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "㈜삼우산기"}], "가설사무실": [{"no": 1, "floor": "1", "room": "C동 안전보건팀", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 2, "floor": "1", "room": "C동 미화팀", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 3, "floor": "1", "room": "C동 직원휴게실(남)", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 4, "floor": "1", "room": "C동 직원휴게실(여)", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 5, "floor": "2", "room": "C동 시설팀 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2022, "maker": "CW소방"}, {"no": 6, "floor": "2", "room": "C동 시설팀 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "일명"}, {"no": 7, "floor": "1", "room": "B동 기공실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 8, "floor": "1", "room": "B동 목공실", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2018, "maker": "삼우산기"}, {"no": 9, "floor": "2", "room": "B동 복도", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2023, "maker": "삼우산기"}, {"no": 10, "floor": "", "room": "", "mgmt": "", "kind": "", "size": "", "year": null, "maker": ""}, {"no": 11, "floor": "", "room": "", "mgmt": "", "kind": "", "size": "", "year": null, "maker": ""}, {"no": 12, "floor": "", "room": "", "mgmt": "", "kind": "", "size": "", "year": null, "maker": ""}, {"no": 13, "floor": "", "room": "", "mgmt": "", "kind": "", "size": "", "year": null, "maker": ""}, {"no": 14, "floor": "", "room": "", "mgmt": "", "kind": "", "size": "", "year": null, "maker": ""}, {"no": 15, "floor": "", "room": "", "mgmt": "", "kind": "", "size": "", "year": null, "maker": ""}, {"no": 16, "floor": "", "room": "", "mgmt": "", "kind": "", "size": "", "year": null, "maker": ""}, {"no": 17, "floor": "", "room": "", "mgmt": "", "kind": "", "size": "", "year": null, "maker": ""}, {"no": 18, "floor": "", "room": "", "mgmt": "", "kind": "", "size": "", "year": null, "maker": ""}, {"no": 19, "floor": "", "room": "", "mgmt": "", "kind": "", "size": "", "year": null, "maker": ""}], "YWCA 건물": [{"no": 1, "floor": "2", "room": "의과학연구처 사무실 -1", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 2, "floor": "2", "room": "의과학연구처 사무실 -2", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}, {"no": 3, "floor": "2", "room": "의과학연구처 사무실 -3", "mgmt": "", "kind": "분말", "size": "3.3", "year": 2025, "maker": "FIC"}]};

let curExtBuilding = EXT_BUILDINGS[0]||'신관';

function isExtReplace(it, curYear){
  // 분말 소화기만 10년 교체 대상
  if(!it.year) return false;
  if(it.kind !== '분말') return false;
  return (curYear - it.year) >= 10;
}
function isExtWarn(it, curYear){
  if(!it.year) return false;
  if(it.kind !== '분말') return false;
  return (curYear - it.year) === 9;
}
function initExtData(){
  if(!db.extinguishers){
    db.extinguishers = JSON.parse(JSON.stringify(EXT_DEFAULT_DATA));
  }
}

function renderExtinguisher(){
  initExtData();
  const el=document.getElementById('extinguisherContent');
  if(!el) return;
  const curYear=new Date().getFullYear();
  const bldData=db.extinguishers[curExtBuilding]||[];
  const total=bldData.length;
  const replace=bldData.filter(function(it){return isExtReplace(it,curYear);}).length;
  const warn=bldData.filter(function(it){return isExtWarn(it,curYear);}).length;

  // 건물 탭 버튼
  let bldTabs='<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">';
  EXT_BUILDINGS.forEach(function(b){
    const isActive=b===curExtBuilding;
    const bData=db.extinguishers[b]||[];
    const bReplace=bData.filter(function(it){return isExtReplace(it,curYear);}).length;
    bldTabs+='<button onclick="switchExtBuilding(\''+b+'\')" style="padding:6px 12px;border-radius:20px;border:1.5px solid '+(isActive?'var(--primary)':'var(--border2)')+';background:'+(isActive?'var(--primary)':'var(--surface)')+';color:'+(isActive?'#fff':'var(--text2)')+';font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;font-family:inherit;flex-shrink:0">'+b+(bReplace?'<span style="background:var(--red);color:#fff;border-radius:10px;font-size:10px;padding:1px 5px;margin-left:4px">'+bReplace+'</span>':'')+'</button>';
  });
  bldTabs+='</div>';

  // 요약
  let summary='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">';
  summary+='<div style="background:var(--surface);border-radius:var(--radius-sm);padding:12px;text-align:center;box-shadow:var(--shadow)"><div style="font-size:22px;font-weight:700;color:var(--primary)">'+total+'</div><div style="font-size:11px;color:var(--text3)">전체</div></div>';
  summary+='<div style="background:var(--surface);border-radius:var(--radius-sm);padding:12px;text-align:center;box-shadow:var(--shadow)"><div style="font-size:22px;font-weight:700;color:var(--red)">'+replace+'</div><div style="font-size:11px;color:var(--text3)">교체대상(10년↑)</div></div>';
  summary+='<div style="background:var(--surface);border-radius:var(--radius-sm);padding:12px;text-align:center;box-shadow:var(--shadow)"><div style="font-size:22px;font-weight:700;color:var(--amber)">'+warn+'</div><div style="font-size:11px;color:var(--text3)">교체임박(9년)</div></div>';
  summary+='</div>';

  // 검색+필터+추가 버튼
  let toolbar='<div style="display:flex;gap:8px;margin-bottom:8px;align-items:center;flex-wrap:wrap">';
  toolbar+='<input type="text" id="extSearch" placeholder="🔍 층·실명 검색..." oninput="renderExtList()" style="flex:1;min-width:150px">';
  toolbar+='<button id="extFilterBtn" class="btn btn-sm" onclick="toggleExtFilter()" style="white-space:nowrap">⚠️ 교체대상만</button>';
  toolbar+='<button class="btn btn-primary btn-sm" onclick="openAddExt()">+ 추가</button>';
  toolbar+='</div>';

  el.innerHTML=bldTabs+summary+toolbar+'<div id="extList"></div>';
  renderExtList();
}

function switchExtBuilding(b){
  curExtBuilding=b;
  extFilterOnly=false;
  renderExtinguisher();
}

let extFilterOnly=false;
function toggleExtFilter(){
  extFilterOnly=!extFilterOnly;
  const btn=document.getElementById('extFilterBtn');
  if(btn){
    btn.style.background=extFilterOnly?'var(--red)':'';
    btn.style.color=extFilterOnly?'#fff':'';
    btn.style.borderColor=extFilterOnly?'var(--red)':'';
  }
  renderExtList();
}
function renderExtList(){
  const el=document.getElementById('extList'); if(!el) return;
  initExtData();
  const curYear=new Date().getFullYear();
  const q=(document.getElementById('extSearch')||{}).value||'';
  let items=(db.extinguishers[curExtBuilding]||[]).filter(function(it){
    if(extFilterOnly && !isExtReplace(it,curYear)) return false;
    if(!q) return true;
    return (it.floor+it.room+it.mgmt+it.kind).toLowerCase().includes(q.toLowerCase());
  });

  if(!items.length){el.innerHTML='<div class="empty"><div class="empty-icon">🧯</div><div>소화기가 없어요</div></div>';return;}

  let html='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">';
  html+='<thead><tr style="background:var(--surface2);border-bottom:2px solid var(--border)">';
  ['NO','층','실명','관리번호','종류','규격','제조년','제조회사','상태',''].forEach(function(h){
    html+='<th style="padding:8px 6px;text-align:left;font-weight:600;color:var(--text2);white-space:nowrap">'+h+'</th>';
  });
  html+='</tr></thead><tbody>';

  items.forEach(function(it){
    const age=it.year?(curYear-it.year):null;
    const isReplace=isExtReplace(it,curYear);
    const isWarn=isExtWarn(it,curYear);
    const isPowder=it.kind==='분말';
    const rowBg=isReplace?'rgba(220,38,38,0.08)':isWarn?'rgba(217,119,6,0.08)':'';
    const statusBadge=isReplace?'<span class="badge b-red">⚠ 교체대상</span>':
      isWarn?'<span class="badge b-amber">교체임박</span>':
      isPowder?'<span class="badge b-green">정상</span>':
      '<span class="badge b-gray">해당없음</span>';
    const yearColor=isReplace?'color:var(--red);font-weight:700':isWarn?'color:var(--amber);font-weight:700':'color:var(--text)';
    html+='<tr style="border-bottom:1px solid var(--border);background:'+rowBg+'">';
    html+='<td style="padding:7px 6px;color:var(--text3)">'+it.no+'</td>';
    html+='<td style="padding:7px 6px;color:var(--text)">'+it.floor+'</td>';
    html+='<td style="padding:7px 6px;color:var(--text)">'+it.room+'</td>';
    html+='<td style="padding:7px 6px;color:var(--text3)">'+it.mgmt+'</td>';
    html+='<td style="padding:7px 6px;color:var(--text)">'+it.kind+'</td>';
    html+='<td style="padding:7px 6px;color:var(--text)">'+it.size+'kg</td>';
    html+='<td style="padding:7px 6px;'+yearColor+'">'+(it.year||'-')+'</td>';
    html+='<td style="padding:7px 6px;color:var(--text2)">'+it.maker+'</td>';
    html+='<td style="padding:7px 6px">'+statusBadge+'</td>';
    html+='<td style="padding:7px 6px"><div style="display:flex;gap:4px">';
    html+='<button class="btn btn-xs" onclick="openEditExt(\''+curExtBuilding+'\','+it.no+')">수정</button>';
    html+='<button class="btn btn-xs btn-outline-red" onclick="deleteExt(\''+curExtBuilding+'\','+it.no+')">삭제</button>';
    html+='</div></td>';
    html+='</tr>';
  });
  html+='</tbody></table></div>';
  el.innerHTML=html;
}

function openAddExt(){
  document.getElementById('ext_id').value='';
  document.getElementById('ext_bld').value=curExtBuilding;
  document.getElementById('extModalTitle').textContent=curExtBuilding+' 소화기 추가';
  ['ext_floor','ext_room','ext_mgmt','ext_kind','ext_size','ext_year','ext_maker','ext_memo'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.value='';
  });
  openModal('addExt');
}

function openEditExt(bld, no){
  initExtData();
  const it=(db.extinguishers[bld]||[]).find(function(x){return x.no===no;});
  if(!it) return;
  document.getElementById('ext_id').value=no;
  document.getElementById('ext_bld').value=bld;
  document.getElementById('extModalTitle').textContent='소화기 수정';
  document.getElementById('ext_floor').value=it.floor||'';
  document.getElementById('ext_room').value=it.room||'';
  document.getElementById('ext_mgmt').value=it.mgmt||'';
  document.getElementById('ext_kind').value=it.kind||'';
  document.getElementById('ext_size').value=it.size||'';
  document.getElementById('ext_year').value=it.year||'';
  document.getElementById('ext_maker').value=it.maker||'';
  document.getElementById('ext_memo').value=it.memo||'';
  openModal('addExt');
}

function saveExt(){
  initExtData();
  const no_val=document.getElementById('ext_id').value;
  const bld=document.getElementById('ext_bld').value;
  const floor=document.getElementById('ext_floor').value.trim();
  const room=document.getElementById('ext_room').value.trim();
  const mgmt=document.getElementById('ext_mgmt').value.trim();
  const kind=document.getElementById('ext_kind').value.trim();
  const size=document.getElementById('ext_size').value.trim();
  const year=parseInt(document.getElementById('ext_year').value)||null;
  const maker=document.getElementById('ext_maker').value.trim();
  const memo=document.getElementById('ext_memo').value.trim();
  if(!floor&&!room){toast('층 또는 실명을 입력해 주세요','error');return;}
  if(!db.extinguishers[bld]) db.extinguishers[bld]=[];
  const list=db.extinguishers[bld];
  if(no_val){
    const it=list.find(function(x){return x.no===parseInt(no_val);});
    if(it) Object.assign(it,{floor,room,mgmt,kind,size,year,maker,memo});
  } else {
    const maxNo=list.reduce(function(m,x){return Math.max(m,x.no);},0);
    list.push({no:maxNo+1,floor,room,mgmt,kind,size,year,maker,memo});
  }
  saveLocal();closeModal('addExt');renderExtinguisher();
  toast(no_val?'수정됐습니다':'추가됐습니다','success');
}

function deleteExt(bld, no){
  if(!confirm('삭제하시겠습니까?')) return;
  initExtData();
  db.extinguishers[bld]=(db.extinguishers[bld]||[]).filter(function(x){return x.no!==no;});
  saveLocal();renderExtinguisher();toast('삭제됐습니다');
}


// ── 보고서 마감일 ──
function openAddDeadline(inspId, bldKey){
  document.getElementById('dl_inspId').value=inspId;
  document.getElementById('deadlineModalTitle').textContent='보고서 마감일 등록';
  var insp=(db.inspections||[]).find(function(x){return x.id===inspId;});
  document.getElementById('dl_date').value=insp&&insp.deadline?insp.deadline:'';
  document.getElementById('dl_memo').value=insp&&insp.deadlineMemo?insp.deadlineMemo:'';
  openModal('addDeadline');
}
function saveDeadline(){
  var inspId=document.getElementById('dl_inspId').value;
  var date=document.getElementById('dl_date').value;
  var memo=document.getElementById('dl_memo').value.trim();
  if(!date){toast('마감일을 선택해 주세요','error');return;}
  var insp=(db.inspections||[]).find(function(x){return x.id===inspId;});
  if(!insp){toast('점검을 찾을 수 없어요','error');return;}
  insp.deadline=date;
  insp.deadlineMemo=memo;
  saveLocal();
  closeModal('addDeadline');
  // 해당 건물 탭 새로고침
  if(insp.bld==='jongham') renderBuilding('jongham');
  else if(insp.bld==='seomigam') renderBuilding('seomigam');
  toast('마감일이 등록됐습니다','success');
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

  // Firebase SDK 미리 로드 후 로그인 처리
  function loadFirebaseSDK(callback){
    if(typeof firebase!=='undefined'){
      try{ if(!firebase.apps.length)firebase.initializeApp(FIREBASE_CONFIG); }catch(e){}
      callback();
      return;
    }
    let n=0;
    ['https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js',
     'https://www.gstatic.com/firebasejs/9.22.2/firebase-database-compat.js'].forEach(function(src){
      const s=document.createElement('script');s.src=src;
      s.onload=function(){
        if(++n===2){
          try{ if(!firebase.apps.length)firebase.initializeApp(FIREBASE_CONFIG); }catch(e){}
          callback();
        }
      };
      document.head.appendChild(s);
    });
  }

  loadFirebaseSDK(function(){
    if(!tryAutoLogin()){
      document.getElementById('loginScreen').style.display='flex';
    }
  });
})();
