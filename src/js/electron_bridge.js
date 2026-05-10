// electron_bridge.js — Electron 환경 감지 + IPC 핸들러
//   브라우저 (GitHub Pages) 에서는 무시됨, Electron desktop 에서만 활성화
(function(){
  if(typeof window === 'undefined' || !window.bblApp) return;
  const E = window.bblApp;
  console.log('[Electron] BBL 데스크탑 모드 감지');

  // 시작 시 AppData 의 데이터 자동 로드 (이전 측정 결과 유지)
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const files = await E.listData();
      const teamData = files.find(f => f.startsWith('team_data_') || f === 'current.json');
      if(teamData){
        const json = await E.loadData(teamData);
        if(json && typeof window.parseTheiaJson === 'function'){
          window.parseTheiaJson(json);
          console.log('[Electron] 자동 로드:', teamData);
        }
      }
    } catch(e){ console.warn('[Electron] 자동 로드 실패:', e); }
  });

  // 메뉴 → 폴더 import → process_pitching_session.py 결과 JSON 자동 로드
  E.onFolderProcessed(async ({jsonPath}) => {
    try {
      const json = await E.loadData(jsonPath.split(/[\\/]/).pop());
      if(json && typeof window.parseTheiaJson === 'function'){
        window.parseTheiaJson(json);
        await E.saveData('current.json', json);
        // 1차 측정 탭 자동 전환 (있을 경우)
        if(typeof window.switchTab === 'function') window.switchTab('m1');
      }
    } catch(e){ alert('JSON 로드 실패: ' + e.message); }
  });

  // 메뉴 → c3d.txt/JSON 파일 직접 선택 (Electron native dialog)
  E.onFilesSelected(({paths}) => {
    if(typeof window.handleNativeFiles === 'function'){
      window.handleNativeFiles(paths);
    } else {
      alert('이 dashboard 빌드는 native file 핸들러를 지원하지 않습니다.\n파일을 dashboard 의 Theia c3d Import 영역에 drag-drop 해 주세요.');
    }
  });

  // 메뉴 → 선수별 PDF 일괄 출력
  E.onPlayerBatchPrint(async ({outDir}) => {
    if(typeof window.PLAYERS === 'undefined' || !window.PLAYERS.length){
      alert('선수 데이터가 없습니다. 먼저 측정 폴더를 가져오세요.'); return;
    }
    const total = window.PLAYERS.length;
    let success = 0, errors = [];
    for(const p of window.PLAYERS){
      try {
        // 해당 선수로 전환
        if(typeof window.switchTab === 'function') window.switchTab('player');
        const sel = document.getElementById('player-select');
        if(sel){ sel.value = p.id; sel.dispatchEvent(new Event('change')); }
        await new Promise(r => setTimeout(r, 300));   // 렌더 대기
        // 인쇄 모드 적용
        document.body.classList.add('printing-batch');
        const filename = `선수별_리포트_${p.id}_${p.name}.pdf`;
        await E.printToPDF({filename, options: {}});
        document.body.classList.remove('printing-batch');
        success++;
      } catch(e){
        errors.push(`${p.name}: ${e.message}`);
      }
    }
    alert(`✅ PDF 생성 완료\n\n성공: ${success}/${total}명\n저장 위치: ${outDir || '리포트 폴더'}\n${errors.length ? '\n오류:\n' + errors.join('\n') : ''}`);
  });

  // 메뉴 → 코치 종합 PDF
  E.onCoachPrint(async ({outDir}) => {
    if(typeof window.switchTab === 'function') window.switchTab('report');
    await new Promise(r => setTimeout(r, 500));
    document.body.classList.add('printing-coach');
    const filename = `코치_종합리포트_${new Date().toISOString().slice(0,10)}.pdf`;
    try {
      await E.printToPDF({filename, options: {}});
      alert(`✅ 코치 리포트 PDF 생성\n\n저장 위치: ${outDir || '리포트 폴더'}\n파일: ${filename}`);
    } catch(e){
      alert('PDF 생성 실패: ' + e.message);
    } finally {
      document.body.classList.remove('printing-coach');
    }
  });

  // dashboard 의 데이터 변경 시 자동 영구 저장 (debounce 5초)
  let saveTimer = null;
  window.addEventListener('bbl:data-changed', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      if(typeof window.exportTeamData === 'function'){
        const json = window.exportTeamData();
        await E.saveData('current.json', JSON.stringify(json));
        console.log('[Electron] 자동 저장 완료');
      }
    }, 5000);
  });
})();
