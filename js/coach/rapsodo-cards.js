// ════════════════════════════════════════════════════════
//  rapsodo-cards.js — 랩소도 FB 핵심 변인 카드
//
//  구속 / 회전수 / 회전 효율 / 수직 수평 무브 / 릴리스 연장
//  / Stuff / Command / 릴리스 SD / Bauer Units (10+ 변인).
//  종합 멘트 자동 생성.
//
//  의존: 없음 (m.rapsodo.fb 만 사용)
// ════════════════════════════════════════════════════════

function renderRapsodo(m){
  const fb = m.rapsodo?.fb;
  if(!fb) return '<div class="stat-empty">랩소도 측정 데이터 없음 (FB)</div>';
  const v   = fb.velocity?.avg, vMax = fb.velocity?.max;
  const spin = fb.spin?.avg, trueSpin = fb.true_spin?.avg, spinEff = fb.spin_eff?.avg;
  const ivb = fb.ivb?.avg, hb = fb.hb?.avg;
  const bauer = fb.bauer?.avg;
  const ext  = fb.release_ext?.avg, relH = fb.release_height?.avg, relHsd = fb.release_height?.sd;
  const stuff = fb.stuff_score, command = fb.command_score;
  // 친근 해석
  const interpV   = v == null ? '—' : v >= 140 ? '구속 elite (140+)' : v >= 130 ? '구속 양호' : v >= 120 ? '구속 평균' : '구속 부족';
  const interpSp  = spin == null ? '—' : spin >= 2400 ? '회전수 elite' : spin >= 2100 ? '회전수 양호' : spin >= 1800 ? '회전수 평균' : '회전수 부족 — 그립·릴리스 점검';
  const interpEff = spinEff == null ? '—' : spinEff >= 95 ? 'gyro 거의 없음 — 최고 효율' : spinEff >= 85 ? '회전축 효율 양호' : '회전축 효율 부족 — 손 위치 점검';
  const interpIvb = ivb == null ? '—' : ivb >= 45 ? '수직 무브 elite (rising effect 강함)' : ivb >= 35 ? '수직 무브 양호' : '수직 무브 부족';
  const interpExt = ext == null ? '—' : ext >= 1.85 ? '릴리스 연장 매우 길음 (체감 +2 km/h)' : ext >= 1.7 ? '릴리스 연장 양호' : '릴리스 연장 짧음 — 보폭·앞으로 내딛기 강화';
  const interpStf = stuff == null ? '—' : stuff >= 70 ? '구질 종합 elite — 위력적 패스트볼' : stuff >= 55 ? '구질 양호' : stuff >= 40 ? '구질 평균' : '구질 부족';
  const interpCmd = command == null ? '—' : command >= 70 ? '제구 elite — 매우 안정적' : command >= 55 ? '제구 양호' : command >= 40 ? '제구 평균' : '제구 부족 — 릴리스 일관성 drill';
  const cls = (s) => s == null ? '' : s >= 70 ? 'hi' : s >= 50 ? 'mid' : 'lo';
  // 종합 멘트
  let summary = '';
  if(stuff != null && command != null){
    if(stuff >= 65 && command >= 65)  summary = `<b>구질 ${stuff}점 + 제구 ${command}점</b> — 위력 + 정확성 모두 우수.`;
    else if(stuff >= 65)              summary = `<b>구질 ${stuff}점은 elite</b>이지만 제구 ${command}점 — 일관성 drill 우선.`;
    else if(command >= 65)            summary = `<b>제구 ${command}점은 elite</b>이지만 구질 ${stuff}점 — 회전수·구속 ↑ 필요.`;
    else                              summary = `<b>구질 ${stuff}점 / 제구 ${command}점</b> — 구속과 일관성 모두 보완 필요.`;
  } else if(v != null){
    summary = `<b>평균 구속 ${v.toFixed(1)} km/h${vMax ? ` (최고 ${vMax.toFixed(1)})` : ''}</b>`;
  }
  return `${summary ? `<div class="stat-summary">${summary}</div>` : ''}
    <div class="stat-grid">
      ${v != null ? `<div class="stat-card ${cls(v >= 140 ? 80 : v >= 130 ? 60 : 40)}"><div class="lbl">평균 구속</div><div class="num">${v.toFixed(1)}<span class="u">km/h</span></div><div class="interp">최고 ${vMax ? vMax.toFixed(1) : '—'} km/h · ${interpV}</div></div>` : ''}
      ${spin != null ? `<div class="stat-card"><div class="lbl">회전수</div><div class="num">${Math.round(spin)}<span class="u">rpm</span></div><div class="interp">${interpSp}</div></div>` : ''}
      ${spinEff != null ? `<div class="stat-card"><div class="lbl">회전 효율</div><div class="num">${spinEff.toFixed(0)}<span class="u">%</span></div><div class="interp">${interpEff}</div></div>` : ''}
      ${ivb != null ? `<div class="stat-card"><div class="lbl">수직 무브 (IVB)</div><div class="num">${ivb.toFixed(1)}<span class="u">cm</span></div><div class="interp">${interpIvb}</div></div>` : ''}
      ${hb != null ? `<div class="stat-card"><div class="lbl">수평 무브 (HB)</div><div class="num">${hb >= 0 ? '+' : ''}${hb.toFixed(1)}<span class="u">cm</span></div><div class="interp">우투 기준 +값 = arm-side 휨</div></div>` : ''}
      ${ext != null ? `<div class="stat-card"><div class="lbl">릴리스 연장</div><div class="num">${ext.toFixed(2)}<span class="u">m</span></div><div class="interp">${interpExt}</div></div>` : ''}
      ${stuff != null ? `<div class="stat-card ${cls(stuff)}"><div class="lbl">구질 종합 (Stuff)</div><div class="num">${stuff}<span class="u">/100</span></div><div class="interp">${interpStf}</div></div>` : ''}
      ${command != null ? `<div class="stat-card ${cls(command)}"><div class="lbl">제구 (Command)</div><div class="num">${command}<span class="u">/100</span></div><div class="interp">${interpCmd}</div></div>` : ''}
      ${relHsd != null ? `<div class="stat-card"><div class="lbl">릴리스 높이 SD</div><div class="num">${(relHsd*100).toFixed(1)}<span class="u">cm</span></div><div class="interp">투구 간 일관성 — 5cm 이하 = elite</div></div>` : ''}
      ${bauer != null ? `<div class="stat-card"><div class="lbl">Bauer Units</div><div class="num">${bauer.toFixed(1)}</div><div class="interp">회전수 ÷ 구속(mph) · 26+ = 우수</div></div>` : ''}
    </div>`;
}

// v6: 키네매틱 시퀀스 (Driveline 표준) — 골반·몸통·팔 3개 종 모양 곡선
//     dashboard.html p-sequence Chart.js 차트를 SVG 로 포팅 + clipPath sweep 다이나믹
