// ════════════════════════════════════════════════════════
//  app.js — 메인 진입점
//
//  - hidden iframe (dashboard.html) 에서 데이터·분석함수 가져오기
//  - 3 탭 (팀 현황 / 선수별 / 장기 추적) 전환
//  - 첫 로드 시 모든 탭 미리 렌더 (전환 빠르게)
//
//  의존: 모든 모듈
// ════════════════════════════════════════════════════════

const iframe = document.getElementById('data-iframe');

iframe.addEventListener('load', () => {
  WIN = iframe.contentWindow;
  setTimeout(initCoach, 200);
});

// ── Tab 전환 ──
document.querySelectorAll('nav.tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('nav.tabs button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('section.tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const tabId = btn.dataset.tab;
    $('tab-' + tabId).classList.add('active');
    CURRENT_TAB = tabId;
    if(WIN && WIN.PLAYERS){
      if(tabId === 'team') renderTeam();
      if(tabId === 'player' && CURRENT_PID) renderForPlayer(CURRENT_PID);
      if(tabId === 'trend'  && CURRENT_TREND_PID) renderTrendForPlayer(CURRENT_TREND_PID);
    }
  });
});

function initCoach(){
  if(!WIN || !WIN.PLAYERS){
    $('team-content').innerHTML = '<div class="empty-state"><div class="ico">⚠</div><div>분석 모듈 로드 실패</div></div>';
    return;
  }
  // 두 dropdown 채우기
  const optHtml = WIN.PLAYERS.map(p =>
    `<option value="${p.id}">${p.name} (${p.id} · ${p.arm==='L'?'좌':'우'}투${p.height?`, ${p.height}cm`:''})</option>`
  ).join('');
  ['player-select','trend-player-select'].forEach(id => {
    const sel = $(id); if(!sel) return;
    sel.disabled = false;
    sel.innerHTML = optHtml;
  });

  // 첫 선수 (실측 데이터 있는 선수 우선)
  let firstPid = WIN.PLAYERS[0].id;
  if(WIN.REAL_DATA_KEYS && WIN.REAL_DATA_KEYS.size > 0){
    for(const key of WIN.REAL_DATA_KEYS){
      const [pid, sid] = key.split(':');
      if(sid === '1'){ firstPid = pid; break; }
    }
  }
  CURRENT_PID = CURRENT_TREND_PID = firstPid;
  $('player-select').value = firstPid;
  $('trend-player-select').value = firstPid;
  $('player-select').addEventListener('change', e => { CURRENT_PID = e.target.value; renderForPlayer(CURRENT_PID); });
  $('trend-player-select').addEventListener('change', e => { CURRENT_TREND_PID = e.target.value; renderTrendForPlayer(CURRENT_TREND_PID); });

  // 모든 탭 미리 렌더 (첫 진입 시 빠르게 보이도록)
  renderTeam();
  renderForPlayer(CURRENT_PID);
  renderTrendForPlayer(CURRENT_TREND_PID);
}
