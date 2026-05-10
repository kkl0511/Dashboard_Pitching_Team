/* ╔══════════════════════════════════════════════════════════╗
   ║  8b. localStorage 자동 저장/복원 (v1.6)                       ║
   ╚══════════════════════════════════════════════════════════╝ */

const STORAGE_KEY = 'sangdong_dashboard_v1';
let __saveTimer = null;

function saveToStorage(){
  // 디바운스 — 짧은 시간 내 여러 변경은 한 번만 저장
  clearTimeout(__saveTimer);
  __saveTimer = setTimeout(()=>{
    try {
      // REAL_DATA_KEYS만 있는 셀(실측)만 저장. 샘플은 페이지 reload 시 재생성.
      const realData = {};
      REAL_DATA_KEYS.forEach(key=>{
        const [pid, sid] = key.split(':');
        if(!realData[pid]) realData[pid] = {};
        realData[pid][sid] = DATA[pid][sid];
      });
      const payload = {
        version: 1,
        savedAt: new Date().toISOString(),
        players: PLAYERS,
        realData,
        realKeys: [...REAL_DATA_KEYS]
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      updateStorageBadge('saved');
    } catch(e){
      console.warn('localStorage 저장 실패:', e);
      updateStorageBadge('error');
    }
  }, 400);
}

function loadFromStorage(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return false;
    const payload = JSON.parse(raw);
    // 선수 명단 복원 (저장된 게 더 최신이라 가정)
    if(Array.isArray(payload.players) && payload.players.length){
      PLAYERS.length = 0;
      payload.players.forEach(p=>PLAYERS.push(p));
    }
    // 샘플 데이터 먼저 생성
    Object.keys(DATA).forEach(k=>delete DATA[k]);
    Object.assign(DATA, genMeasurements());
    // 실측 셀만 덮어쓰기
    if(payload.realData){
      Object.entries(payload.realData).forEach(([pid, sessions])=>{
        if(!DATA[pid]) return;
        Object.entries(sessions).forEach(([sid, body])=>{
          DATA[pid][sid] = body;
        });
      });
    }
    if(Array.isArray(payload.realKeys)){
      payload.realKeys.forEach(k=>REAL_DATA_KEYS.add(k));
    }
    return true;
  } catch(e){
    console.warn('localStorage 복원 실패:', e);
    return false;
  }
}

function clearStorage(){
  try { localStorage.removeItem(STORAGE_KEY); updateStorageBadge('cleared'); }
  catch(e){ console.warn(e); }
}

function updateStorageBadge(state){
  const el = document.getElementById('storage-badge');
  if(!el) return;
  const map = {
    saved:   {txt:'💾 자동 저장됨', cls:'good'},
    cleared: {txt:'저장소 비움', cls:'warn'},
    error:   {txt:'⚠ 저장 실패', cls:'bad'},
    loaded:  {txt:'💾 저장된 데이터 복원됨', cls:'good'},
    none:    {txt:'저장된 데이터 없음', cls:'warn'}
  };
  const m = map[state] || map.none;
  el.textContent = m.txt;
  el.className = 'pill ' + m.cls;
}

/* refreshAllAfterImport()의 마지막 줄에서 saveToStorage()가 호출됨 (아래 함수 정의 참고) */

