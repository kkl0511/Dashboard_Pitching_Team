// ════════════════════════════════════════════════════════
//  sequence-chart.js — 키네매틱 시퀀스 차트 (Driveline 표준)
//
//  골반·몸통·상완 3개 종 모양 곡선 + 발광 점이 곡선 위를
//  골반→몸통→상완 순서로 traveling (animateMotion).
//
//  의존: helpers.js (hex2rgba)
// ════════════════════════════════════════════════════════

function renderSequenceChart(m){
  const seq = m.sequence || {};
  const trf = m.energy?.transfer || {};
  const ptLag = trf.pelvis_to_trunk_lag_ms ?? 50;
  const taLag = trf.trunk_to_arm_lag_ms ?? trf.trunk_to_humerus_lag_ms ?? 80;
  // 피크 시각 (BR=0 기준, ms): 팔이 BR 직전(-30ms), 그 앞으로 trunk·pelvis lag
  const tArm    = -30;
  const tTrunk  = tArm  - taLag;
  const tPelvis = tTrunk - ptLag;
  const pkPelvis = seq.pelvis_dps;
  const pkTrunk  = seq.trunk_dps;
  const pkArm    = seq.arm_dps;
  if(pkPelvis == null || pkTrunk == null || pkArm == null){
    return '<div class="stat-empty">키네매틱 시퀀스 측정 데이터 없음 (회전속도)</div>';
  }
  // 분절별 종모양 폭 σ
  const sigmas = {pelvis: 70, trunk: 55, arm: 42};
  const gauss = (t, t0, peak, s) => peak * Math.exp(-Math.pow(t - t0, 2) / (2*s*s));
  // 시퀀스 품질 — markerless KR cohort 분포 (dashboard.html v5.36)
  const inRange = (v, lo, hi) => v >= lo && v <= hi;
  const ptOK = inRange(ptLag, 0, 80);
  const taOK = inRange(taLag, 40, 130);
  const okCount = (ptOK ? 1 : 0) + (taOK ? 1 : 0);
  let qLabel, qBg, qColor, cls, headline, diagBody;
  if(okCount === 2){
    qLabel = '✓ 좋은 흐름'; qBg = '#dafbe1'; qColor = '#1a7f37'; cls='ok';
    headline = '회전 순서가 자연스러움';
    diagBody = `골반(${Math.round(ptLag)}ms 뒤 몸통 합류) → 몸통(${Math.round(taLag)}ms 뒤 팔 합류) → 팔이 채찍처럼 가속. 이 순서 유지하며 각 분절 속도 ↑ 가 다음 목표.`;
  } else if(okCount === 1){
    qLabel = '⚠ 보통 흐름'; qBg = '#fff8c5'; qColor = '#bc4c00'; cls='warn';
    headline = '타이밍이 어긋남';
    const issues = [];
    if(!ptOK){
      if(ptLag < 0)       issues.push(`골반보다 몸통이 먼저 회전`);
      else if(ptLag > 80) issues.push(`골반→몸통 너무 늦음 (${Math.round(ptLag)}ms)`);
    }
    if(!taOK){
      if(taLag < 40)       issues.push(`몸통과 팔이 거의 동시 (${Math.round(taLag)}ms · Layback 부족)`);
      else if(taLag > 130) issues.push(`팔이 너무 늦게 따라옴 (${Math.round(taLag)}ms · 어깨 유연성)`);
    }
    diagBody = issues.join(' / ') + '.';
  } else {
    qLabel = '✗ 흐름 깨짐'; qBg = '#ffebe9'; qColor = '#cf222e'; cls='bad';
    headline = '회전 순서가 깨짐';
    diagBody = '골반·몸통·팔 차례로 가속되어야 채찍 효과가 나옴. 지금은 분절 동시 발화 또는 역순 — 하체부터 회전 시작 drill 필요.';
  }
  // 분절 색상 (dashboard.html 와 동일 — bad 시퀀스: 회색+빨강 강조)
  const segColors = okCount === 0
    ? { pelvis: '#94a3b8', trunk: '#94a3b8', arm: '#e63946' }
    : { pelvis: '#475569', trunk: '#0ea5e9', arm: '#e63946' };
  // ─── SVG (640 x 320) — Driveline 스타일 ───
  const W = 640, H = 320;
  const padL = 50, padR = 24, padT = 32, padB = 50;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const xMin = -300, xMax = 50;
  const xOf = t => padL + (t - xMin) / (xMax - xMin) * chartW;
  const maxV = Math.max(pkPelvis, pkTrunk, pkArm) * 1.1;
  const yMax = Math.max(200, Math.ceil(maxV / 200) * 200);
  const yOf = v => padT + chartH - (v / yMax) * chartH;
  // path 생성
  const xs = []; for(let t = xMin; t <= xMax; t += 5) xs.push(t);
  const linePath = (t0, peak, s) => 'M ' + xs.map(t => `${xOf(t).toFixed(1)},${yOf(gauss(t, t0, peak, s)).toFixed(1)}`).join(' L ');
  const areaPath = (t0, peak, s) => `M ${xOf(xMin).toFixed(1)},${yOf(0).toFixed(1)} L ` + xs.map(t => `${xOf(t).toFixed(1)},${yOf(gauss(t, t0, peak, s)).toFixed(1)}`).join(' L ') + ` L ${xOf(xMax).toFixed(1)},${yOf(0).toFixed(1)} Z`;
  const uid = 'seq' + Math.random().toString(36).slice(2,7);
  // Y축 그리드 + 라벨 (4 단계)
  const yTicks = [0, yMax*0.25, yMax*0.5, yMax*0.75, yMax].map(v => `
<line x1="${padL}" y1="${yOf(v)}" x2="${padL+chartW}" y2="${yOf(v)}" stroke="#eaeef2" stroke-width="1"/>
<text x="${padL-8}" y="${yOf(v)+3.5}" font-size="10" fill="#656d76" text-anchor="end">${Math.round(v).toLocaleString()}</text>`).join('');
  // X축 라벨
  const xTicks = [-300,-250,-200,-150,-100,-50,0,50].map(t => `
<text x="${xOf(t)}" y="${padT+chartH+18}" font-size="10" fill="#656d76" text-anchor="middle">${t} ms</text>`).join('');
  // 다이나믹: 곡선은 고정 표시, 발광 점이 골반→몸통→상완 순서로 곡선 위를 traveling (animateMotion)
  // cycle = 4s (pelvis 0-1.5s, trunk 0.5-2.0s, arm 1.0-2.5s, pause 2.5-4.0s, loop)
  const cycleS = 4.0;
  // 범례
  const legendX = W/2 - 110;
  const legend = `
<g transform="translate(${legendX}, 8)">
  <circle cx="6" cy="10" r="6" fill="none" stroke="${segColors.pelvis}" stroke-width="2.4"/>
  <text x="18" y="14" font-size="12" font-weight="600" fill="#1f2328">골반</text>
  <circle cx="76" cy="10" r="6" fill="none" stroke="${segColors.trunk}" stroke-width="2.4"/>
  <text x="88" y="14" font-size="12" font-weight="600" fill="#1f2328">몸통</text>
  <circle cx="146" cy="10" r="6" fill="none" stroke="${segColors.arm}" stroke-width="2.4"/>
  <text x="158" y="14" font-size="12" font-weight="600" fill="#1f2328">상완</text>
</g>`;
  // BR 점선
  const brLine = `<line x1="${xOf(0)}" y1="${padT}" x2="${xOf(0)}" y2="${padT+chartH}" stroke="#cf222e" stroke-width="1.4" stroke-dasharray="4,4"/>
<text x="${xOf(0)+5}" y="${padT+12}" font-size="11" font-weight="600" fill="#cf222e">BR</text>`;
  // 품질 배지
  const qBadge = `<g>
  <rect x="${padL+8}" y="${padT+8}" width="100" height="22" rx="5" fill="${qBg}"/>
  <text x="${padL+58}" y="${padT+23}" font-size="11.5" font-weight="600" fill="${qColor}" text-anchor="middle">${qLabel}</text>
</g>`;
  // hex2rgba 는 helpers.js 에서 제공
  // 곡선 정적 표시 (area fill + line + 가운데 peak 마커 + 라벨)
  // 라벨: 골반=0ms, 몸통=ptLag, 상완=ptLag+taLag (cumulative lag from pelvis)
  const lagPelvis = 0;
  const lagTrunk = Math.round(ptLag);
  const lagArm = Math.round(ptLag + taLag);
  const drawSegStatic = (t0, peak, s, color, name, lagMs) => {
    const px = xOf(t0), py = yOf(peak);
    return `
<path d="${areaPath(t0, peak, s)}" fill="${hex2rgba(color, 0.12)}"/>
<path d="${linePath(t0, peak, s)}" fill="none" stroke="${color}" stroke-width="2.6"/>
<circle cx="${px}" cy="${py}" r="6" fill="#fff" stroke="${color}" stroke-width="2.5"/>
<text x="${px}" y="${py-12}" font-size="11.5" font-weight="700" fill="${color}" text-anchor="middle">${name} ${lagMs}ms</text>`;
  };
  // mpath 참조용 path (defs)
  const pidPelvis = `seg-p-${uid}`;
  const pidTrunk  = `seg-t-${uid}`;
  const pidArm    = `seg-a-${uid}`;
  const pathDefs = `<defs>
<path id="${pidPelvis}" d="${linePath(tPelvis, pkPelvis, sigmas.pelvis)}"/>
<path id="${pidTrunk}"  d="${linePath(tTrunk,  pkTrunk,  sigmas.trunk)}"/>
<path id="${pidArm}"    d="${linePath(tArm,    pkArm,    sigmas.arm)}"/>
</defs>`;
  // ▶ 발광 점이 곡선 위를 흐름 (animateMotion + mpath)
  // beginPct/endPct: 4s cycle 안에서 dot 가 visible/traveling 하는 구간
  const flowDot = (pathId, color, beginPct, endPct) => {
    const visStart = beginPct;
    const visEnd   = endPct;
    return `
<circle r="7" fill="${color}" opacity="0" filter="drop-shadow(0 0 5px ${color})">
  <animate attributeName="opacity"
    values="0; 0; 1; 1; 0; 0"
    keyTimes="0; ${(visStart-0.005).toFixed(3)}; ${visStart.toFixed(3)}; ${(visEnd-0.005).toFixed(3)}; ${visEnd.toFixed(3)}; 1"
    dur="${cycleS}s" repeatCount="indefinite"/>
  <animateMotion dur="${cycleS}s" repeatCount="indefinite"
    keyTimes="0; ${visStart.toFixed(3)}; ${visEnd.toFixed(3)}; 1"
    keyPoints="0; 0; 1; 1"
    calcMode="linear">
    <mpath href="#${pathId}"/>
  </animateMotion>
</circle>`;
  };
  const segPelvis = drawSegStatic(tPelvis, pkPelvis, sigmas.pelvis, segColors.pelvis, '골반', lagPelvis);
  const segTrunk  = drawSegStatic(tTrunk,  pkTrunk,  sigmas.trunk,  segColors.trunk,  '몸통', lagTrunk);
  const segArm    = drawSegStatic(tArm,    pkArm,    sigmas.arm,    segColors.arm,    '상완', lagArm);
  // Pelvis: 0-1.5s of 4s cycle (0% → 37.5%)
  // Trunk:  0.5-2.0s (12.5% → 50%)
  // Arm:    1.0-2.5s (25% → 62.5%)
  const dotPelvis = flowDot(pidPelvis, segColors.pelvis, 0.005, 0.375);
  const dotTrunk  = flowDot(pidTrunk,  segColors.trunk,  0.125, 0.500);
  const dotArm    = flowDot(pidArm,    segColors.arm,    0.250, 0.625);
  return `<div class="seq-chart-wrap">
  <div class="seq-chart-title">키네매틱 시퀀스 — 골반·몸통·상완 회전 타이밍</div>
  <div class="seq-chart-sub">곡선은 항상 보임. 빛나는 점이 골반 → 몸통 → 상완 순서로 곡선 위를 흐름. 정상은 점들이 좌→우로 차례차례 봉우리를 통과.</div>
  <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto" xmlns="http://www.w3.org/2000/svg">
    ${pathDefs}
    ${yTicks}
    ${xTicks}
    <text x="${padL-38}" y="${padT+chartH/2}" font-size="10" fill="#656d76" transform="rotate(-90 ${padL-38} ${padT+chartH/2})" text-anchor="middle">각속도 (°/s)</text>
    <text x="${padL+chartW/2}" y="${padT+chartH+38}" font-size="10" fill="#656d76" text-anchor="middle">시간 (ms · 릴리스=0)</text>
    ${segPelvis}
    ${segTrunk}
    ${segArm}
    ${brLine}
    ${dotPelvis}
    ${dotTrunk}
    ${dotArm}
    ${legend}
    ${qBadge}
  </svg>
  <div class="seq-chart-diag ${cls}"><b>${headline}</b><br>${diagBody}</div>
</div>`;
}

