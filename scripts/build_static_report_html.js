#!/usr/bin/env node
/**
 * 정적 HTML 리포트 — dashboard.html 스타일 그대로 (선수별 1차 리포트 형식)
 * 차트·표 모두 inline SVG로 미리 렌더 → JS 의존성 없이 standalone
 */
const fs = require('fs');
const path = require('path');

const drivelineCode = fs.readFileSync(path.join(__dirname, '..', 'src/js/driveline.js'), 'utf8');
eval(drivelineCode);

const recPath = process.argv[2] || path.join(__dirname, '..', 'sample_data/theia_TEST_9trial_single.json');
const outPath = process.argv[3] || 'TestPlayer_static_report.html';
const m = JSON.parse(fs.readFileSync(recPath, 'utf8'));

const F = (n, d=1) => (n == null || isNaN(n)) ? '—' : Number(n).toFixed(d);
const v = m.velocity || {};
const seq = m.sequence || {};
const f = m.faults || {};
const cog = m.cog || {};
const grf = m.grf || {};
const trf = m.energy?.transfer || {};
const lk = m.energy?.leakage || {};

// ─── driveline 분석 ───
const dvl5 = drivelineFiveModelDiagnosis({
  shoulder_er_max_deg: f.shoulder_er_max_deg, peak_shoulder_v: seq.peak_shoulder_v,
  peak_elbow_v: seq.peak_elbow_v ?? seq.elbow_dps, arm_dps: seq.arm_dps,
  shoulder_abd_fp_deg: f.shoulder_abd_fp_deg, scap_load_fp_deg: f.scap_load_fp_deg,
  elbow_flex_fp_deg: f.elbow_flex_fp_deg, x_factor: f.x_factor_deg,
  trunk_forward_tilt: f.trunk_tilt_at_fc_deg, trunk_lateral_tilt: f.trunk_lat_tilt_deg,
  torso_counter_rot_deg: f.torso_counter_rot_deg, torso_rot_fp_deg: f.torso_rot_fp_deg,
  torso_rot_br_deg: f.torso_rot_br_deg, trunk_dps: seq.trunk_dps, pelvis_dps: seq.pelvis_dps,
  lead_knee_change: f.lead_knee_change, stride_length: f.stride_length_m,
  lead_knee_ext_velo: f.lead_knee_ext_velo,
  cog_decel: cog.decel, cog_decel_ae: cog.decel, max_cog_velo: cog.max_velo
});

const trans = segmentTransitionETE({
  peak_pelvis_v: seq.pelvis_dps, peak_trunk_v: seq.trunk_dps, peak_humerus_v: seq.arm_dps,
  peak_forearm_v: trf.peak_forearm_v, peak_hand_v: seq.peak_hand_v ?? trf.peak_forearm_v,
  pelvis_to_trunk_lag_ms: trf.pelvis_to_trunk_lag_ms,
  trunk_to_humerus_lag_ms: trf.trunk_to_humerus_lag_ms ?? trf.trunk_to_arm_lag_ms,
  humerus_to_forearm_lag_ms: trf.humerus_to_forearm_lag_ms,
  forearm_to_hand_lag_ms: trf.forearm_to_hand_lag_ms
});

// ─── 메카닉 score / mech velo ───
const mechScore = Math.round((dvl5.arm_action.score + dvl5.posture.score + dvl5.rotation.score + dvl5.block.score + dvl5.cog.score) / 5);
const totalScore = Math.round((mechScore * 0.6 + (lk.eli_score ?? 70) * 0.4));

// ─── 5 모델 한국어 라벨 (사용자 요청) ───
const MODEL_LBL = {
  arm_action: '🚀 팔동작 (Arm Action)',
  posture:    '🛡 자세 (Posture)',
  rotation:   '🔄 회전 속도 (Rotation)',
  block:      '🦵 앞다리 제동 (Block)',
  cog:        '🎯 체중이동 (CoG)'
};
const MODEL_LBL_SHORT = {
  arm_action: '🚀 팔동작',
  posture:    '🛡 자세',
  rotation:   '🔄 회전',
  block:      '🦵 앞다리',
  cog:        '🎯 체중이동'
};

// ─── SVG: 라디아 차트 (5축, dashboard 스타일) ───
function radarSVG() {
  const W = 380, H = 340, cx = W/2, cy = H/2 + 14, r = 105;
  const axes = ['arm_action', 'posture', 'rotation', 'block', 'cog'];
  const labels = MODEL_LBL_SHORT;
  const playerScores = axes.map(k => Math.min(150, dvl5[k]?.score ?? 0));
  function pt(score, i) {
    const angle = -Math.PI/2 + i * 2 * Math.PI / 5;
    return [cx + r * (score/150) * Math.cos(angle), cy + r * (score/150) * Math.sin(angle)];
  }
  let svg = `<svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="font:11px sans-serif;max-height:300px">`;
  [50, 100, 150].forEach(s => {
    const pts = axes.map((_, i) => pt(s, i)).map(p => p.join(',')).join(' ');
    svg += `<polygon points="${pts}" fill="none" stroke="#e1e4e8" stroke-width="1" stroke-dasharray="2,2"/>`;
  });
  axes.forEach((_, i) => {
    const [x, y] = pt(150, i);
    svg += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#eaecef"/>`;
  });
  svg += `<polygon points="${[150,150,150,150,150].map((s,i)=>pt(s,i)).map(p=>p.join(',')).join(' ')}" fill="rgba(252,194,109,0.10)" stroke="#bc4c00" stroke-width="1.2" stroke-dasharray="3,3"/>`;
  svg += `<polygon points="${[100,100,100,100,100].map((s,i)=>pt(s,i)).map(p=>p.join(',')).join(' ')}" fill="rgba(252,231,121,0.18)" stroke="#9a6700" stroke-width="1.2" stroke-dasharray="3,3"/>`;
  svg += `<polygon points="${playerScores.map((s,i)=>pt(s,i)).map(p=>p.join(',')).join(' ')}" fill="rgba(9,105,218,0.30)" stroke="#0969da" stroke-width="2.5"/>`;
  axes.forEach((k, i) => {
    const angle = -Math.PI/2 + i * 2 * Math.PI / 5;
    const lr = r + 28;
    const x = cx + lr * Math.cos(angle), y = cy + lr * Math.sin(angle);
    svg += `<text x="${x}" y="${y}" text-anchor="middle" font-weight="600" font-size="11.5" fill="#1f2328">${labels[k]}</text>`;
    svg += `<text x="${x}" y="${y+13}" text-anchor="middle" fill="#0969da" font-size="11" font-weight="700">${dvl5[k]?.score?.toFixed(0) ?? '—'}</text>`;
  });
  svg += `<text x="10" y="${H-6}" font-size="10" fill="#656d76"><tspan fill="#0969da">━ 본인</tspan> · <tspan fill="#9a6700">--- Elite</tspan> · <tspan fill="#bc4c00">--- Ceiling</tspan></text>`;
  svg += '</svg>';
  return svg;
}

// ─── SVG: 분절 ω 시계열 ───
function sequenceTimingSVG() {
  const W = 600, H = 280, padL = 50, padR = 20, padT = 24, padB = 36;
  const xL = padL, xR = W - padR, yT = padT, yB = H - padB;
  const xMin = -300, xMax = 50;
  const yMax = Math.max(seq.arm_dps || 5000, 5500);
  const xS = x => xL + (x - xMin) / (xMax - xMin) * (xR - xL);
  const yS = y => yB - y / yMax * (yB - yT);
  const ptLag = trf.pelvis_to_trunk_lag_ms ?? 0;
  const taLag = trf.trunk_to_humerus_lag_ms ?? trf.trunk_to_arm_lag_ms ?? 0;
  const tArm = -30, tTrunk = tArm - taLag, tPelvis = tTrunk - ptLag;
  const sigma = { pelvis: 70, trunk: 55, arm: 42 };
  const gauss = (t, t0, peak, s) => peak * Math.exp(-Math.pow(t - t0, 2) / (2 * s * s));
  const xs = []; for (let t = -300; t <= 50; t += 4) xs.push(t);
  const drawCurve = (t0, peak, s, color, fill) => {
    const pts = xs.map(t => `${xS(t)},${yS(gauss(t, t0, peak, s))}`).join(' ');
    return `<polyline points="${pts}" fill="${fill}" stroke="${color}" stroke-width="2.2"/>`;
  };
  let svg = `<svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="font:10.5px sans-serif">`;
  // grid
  for (let val = 1000; val <= yMax; val += 1000) {
    svg += `<line x1="${xL}" y1="${yS(val)}" x2="${xR}" y2="${yS(val)}" stroke="#f0f3f6"/>`;
  }
  svg += `<line x1="${xL}" y1="${yB}" x2="${xR}" y2="${yB}" stroke="#656d76"/>`;
  svg += `<line x1="${xL}" y1="${yT}" x2="${xL}" y2="${yB}" stroke="#656d76"/>`;
  [-300, -250, -200, -150, -100, -50, 0, 50].forEach(t => {
    const x = xS(t);
    svg += `<line x1="${x}" y1="${yB}" x2="${x}" y2="${yB+4}" stroke="#656d76"/>`;
    svg += `<text x="${x}" y="${yB+18}" text-anchor="middle" fill="#656d76">${t}</text>`;
  });
  for (let val = 0; val <= yMax; val += 1000) {
    svg += `<text x="${xL-6}" y="${yS(val)+4}" text-anchor="end" fill="#656d76">${val}</text>`;
  }
  svg += `<line x1="${xS(0)}" y1="${yT}" x2="${xS(0)}" y2="${yB}" stroke="#cf222e" stroke-width="1.5" stroke-dasharray="4,3"/>`;
  svg += `<text x="${xS(0)+4}" y="${yT+12}" fill="#cf222e" font-weight="700">BR</text>`;
  svg += drawCurve(tPelvis, seq.pelvis_dps, sigma.pelvis, '#8b949e', 'rgba(139,148,158,0.18)');
  svg += drawCurve(tTrunk,  seq.trunk_dps,  sigma.trunk,  '#1a7f37', 'rgba(26,127,55,0.18)');
  svg += drawCurve(tArm,    seq.arm_dps,    sigma.arm,    '#cf222e', 'rgba(207,34,46,0.18)');
  svg += `<text x="${xL+10}" y="${yT-8}" fill="#8b949e" font-weight="600">━ 골반</text>`;
  svg += `<text x="${xL+90}" y="${yT-8}" fill="#1a7f37" font-weight="600">━ 몸통</text>`;
  svg += `<text x="${xL+170}" y="${yT-8}" fill="#cf222e" font-weight="600">━ 팔</text>`;
  svg += `<text x="14" y="${(yT+yB)/2}" text-anchor="middle" transform="rotate(-90 14 ${(yT+yB)/2})" fill="#656d76">각속도 (°/s)</text>`;
  svg += `<text x="${(xL+xR)/2}" y="${H-3}" text-anchor="middle" fill="#656d76">시간 (ms, BR=0)</text>`;
  svg += '</svg>';
  return svg;
}

// ─── 시퀀스 진단 quality ───
const ptLag = trf.pelvis_to_trunk_lag_ms ?? 50;
const taLag = trf.trunk_to_humerus_lag_ms ?? trf.trunk_to_arm_lag_ms ?? 35;
const ptOK = ptLag >= 0 && ptLag <= 80;
const taOK = taLag >= 40 && taLag <= 130;
const okCount = (ptOK?1:0) + (taOK?1:0);
const seqQ = okCount === 2 ? { c: '#1a7f37', bg: '#dafbe1', label: '✅ 좋은 시퀀스', desc: '두 lag 모두 정상 범위 (markerless 표준 0–80 ms / 40–130 ms)' }
  : okCount === 1 ? { c: '#bc4c00', bg: '#fff8c5', label: '⚠️ 보통 시퀀스', desc: '한 lag만 정상 — 일부 분절 동시 발화 또는 단절' }
  : { c: '#cf222e', bg: '#ffebe9', label: '❌ 시퀀스 이상', desc: '두 lag 모두 비정상 — 구속 손실 위험' };

// ─── ELI 6 zone ───
const eliZones = [
  ['Z1','Sequential timing',lk.zone1_sequence],
  ['Z2','X-factor 분리',lk.zone2_x_factor],
  ['Z3','Lead leg 블록',lk.zone3_lead_block],
  ['Z4','Trunk at FC',lk.zone4_trunk_at_fc],
  ['Z5','어깨 정렬 (ER)',lk.zone5_shoulder_align],
  ['Z6','Pelvis 감속',lk.zone6_pelvis_brake],
];

// ─── HTML ───
const playerName = m.athlete_name || 'TestPlayer';
const ver = '5.38';
const html = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<title>${playerName} 1차 투구 리포트</title>
<style>
:root{
  --bg:#fafbfc; --panel:#ffffff; --panel2:#f6f8fa; --line:#d0d7de; --line-soft:#e1e4e8;
  --text:#1f2328; --text-soft:#424a53; --muted:#656d76;
  --accent:#0969da; --accent-bg:#ddf4ff; --accent2:#8250df;
  --good:#1a7f37; --good-bg:#dafbe1;
  --warn:#bc4c00; --warn-bg:#fff8c5;
  --bad:#cf222e; --bad-bg:#ffebe9;
}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--text);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Apple SD Gothic Neo","맑은 고딕",sans-serif;
  font-size:13px;line-height:1.55}
main{max-width:1180px;margin:0 auto;padding:18px 28px 40px}
header{background:#fff;border-bottom:1px solid var(--line);padding:18px 28px;margin-bottom:18px}
header .top{display:flex;justify-content:space-between;align-items:flex-end;max-width:1180px;margin:0 auto}
header h1{font-size:18px;margin:0;font-weight:700}
header .ver{color:var(--muted);font-size:13px;font-weight:400;margin-left:6px}
header .sub{color:var(--muted);font-size:12.5px;margin-top:4px}
header .meta{font-size:12px;color:var(--muted);text-align:right}
header .meta b{color:var(--text);font-weight:600}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:8px;
  padding:16px 18px;margin-bottom:14px;box-shadow:0 1px 0 rgba(0,0,0,.02)}
.panel h2{margin:0 0 12px;font-size:15px;font-weight:600;color:var(--text)}
.panel h2 .badge{font-size:10.5px;background:var(--panel2);color:var(--muted);
  border:1px solid var(--line-soft);padding:2px 7px;border-radius:3px;margin-left:8px;font-weight:500;vertical-align:middle}
.panel h3{margin:0 0 8px;font-size:13px;font-weight:600;color:var(--text-soft)}
.section-marker{margin:18px 0 8px;padding:8px 12px;border-left:4px solid var(--accent);border-radius:4px;
  background:linear-gradient(90deg,#0969da10,transparent)}
.section-marker .lbl{font-size:14px;font-weight:600;color:var(--accent)}
.section-marker.fitness{border-color:#bc4c00;background:linear-gradient(90deg,#bc4c0010,transparent)}
.section-marker.fitness .lbl{color:#bc4c00}
.section-marker.mech{border-color:var(--good);background:linear-gradient(90deg,#1a7f3710,transparent)}
.section-marker.mech .lbl{color:var(--good)}
.section-marker.result{border-color:var(--accent2);background:linear-gradient(90deg,#8250df10,transparent)}
.section-marker.result .lbl{color:var(--accent2)}
.player-meta{display:flex;gap:16px;color:var(--muted);font-size:12.5px;flex-wrap:wrap;margin-top:8px}
.player-meta b{color:var(--text);font-weight:600}
.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:6px}
.kpi{background:var(--panel2);border:1px solid var(--line-soft);border-radius:6px;
  padding:10px 12px;border-left:3px solid var(--accent)}
.kpi.bk-warn{border-left-color:#bc4c00;background:#fff8f0}
.kpi.bk-good{border-left-color:#1a7f37;background:#f0f9f4}
.kpi.bk-acc2{border-left-color:#8250df;background:#f5f0ff}
.kpi .label{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.4px}
.kpi .value{font-size:22px;font-weight:600;color:var(--text);margin-top:3px}
.kpi .delta{font-size:11.5px;color:var(--muted);margin-top:3px}
.info-bar{display:flex;gap:14px;align-items:center;margin-top:8px;padding:6px 10px;
  background:var(--panel2);border-radius:6px;font-size:12px;flex-wrap:wrap}
.info-bar .sep{color:var(--line)}
.pill{display:inline-block;padding:1px 8px;border-radius:10px;font-size:11px;font-weight:600}
.pill.good{background:var(--good-bg);color:var(--good)}
.pill.warn{background:var(--warn-bg);color:var(--warn)}
.pill.bad{background:var(--bad-bg);color:var(--bad)}
.grid-2{display:grid;grid-template-columns:0.85fr 1.5fr;gap:14px;align-items:stretch}
.grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
.grid-1-1{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.grid-1-13{display:grid;grid-template-columns:1fr 1.3fr;gap:14px;align-items:start}
table.data{width:100%;border-collapse:collapse;font-size:11.5px}
table.data thead th{background:var(--panel2);padding:7px 9px;text-align:left;
  border-bottom:1px solid var(--line);font-weight:600;color:var(--text-soft);font-size:11px}
table.data tbody td{padding:6px 9px;border-bottom:1px solid var(--line-soft);font-variant-numeric:tabular-nums}
table.data tbody tr:hover{background:var(--panel2)}
table.data .num{text-align:right;font-variant-numeric:tabular-nums}
.score-good{color:var(--good);font-weight:600}
.score-warn{color:var(--warn);font-weight:600}
.score-bad{color:var(--bad);font-weight:600}
.diff-pos{color:var(--good);font-weight:600}
.diff-neg{color:var(--bad);font-weight:600}
.muted{color:var(--muted)}
.sec-quality{padding:10px 12px;border-radius:5px;font-size:12px;border-left:3px solid #ccc;margin-bottom:8px}
.sec-quality b{font-size:13px}
.grf-card{padding:10px 12px;border-radius:5px}
.grf-card.fp1{background:#fff8c5;border-left:4px solid #9a6700}
.grf-card.fp2{background:var(--accent-bg);border-left:4px solid var(--accent)}
.grf-card.lhei{background:var(--good-bg);border-left:4px solid var(--good)}
.grf-card .lbl{font-size:11px;color:var(--muted)}
.grf-card .ttl{font-size:13px;font-weight:600;margin:3px 0}
.grf-card .v{font-size:21px;font-weight:700}
.grf-card .sub{font-size:10.5px;color:var(--muted)}
.grf-card .bar{margin-top:8px;height:6px;background:#fff;border-radius:3px;overflow:hidden;border:1px solid #e1e4e8}
.grf-card .bar > div{height:100%;border-radius:3px}
.grf-card.fp1 .bar > div{background:#9a6700}
.grf-card.fp2 .bar > div{background:var(--accent)}
.grf-card.lhei .bar > div{background:var(--good)}
.footnote{font-size:10.5px;color:var(--muted);margin-top:10px;padding:8px 12px;
  background:var(--panel2);border-radius:5px;border-left:3px solid var(--accent);line-height:1.5}
.footnote b{color:var(--text)}
.action-card{padding:8px 11px;border:1px solid var(--line-soft);border-radius:5px;margin:5px 0;
  font-size:12px;background:#fff}
.action-card.warn{background:#fff5f5;border-color:#ffaaa3}
.action-card.ok{background:var(--good-bg);border-color:#74dba1}
.zone-row{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:4px;margin:3px 0;font-size:11.5px}
.zone-row .z{flex:0 0 36px;font-weight:700}
.zone-row .nm{flex:1}
.zone-row .sc{flex:0 0 50px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums}
.zone-row .ev{flex:0 0 70px;text-align:right;font-size:11px}
.zone-row.s-good{background:var(--good-bg)}
.zone-row.s-warn{background:var(--warn-bg)}
.zone-row.s-bad{background:var(--bad-bg)}
.legend{font-size:11px;color:var(--muted);display:flex;gap:14px;flex-wrap:wrap;margin-top:6px}
@media print {
  @page { size: A4 portrait; margin: 12mm; }
  body{background:#fff;font-size:11px}
  main{padding:0;max-width:none}
  header{padding:8px 0;border-bottom:1px solid #999}
  header h1{font-size:14px}
  .panel{box-shadow:none;border:1px solid #bbb;padding:10px 12px;margin-bottom:10px;
    page-break-inside:avoid;break-inside:avoid}
  .panel h2{font-size:12px;margin-bottom:6px}
  .kpi .value{font-size:16px}
  .grid-2{grid-template-columns:0.85fr 1.5fr}
}
</style>
</head>
<body>

<header>
  <div class="top">
    <div>
      <h1>${playerName} 1차 투구 리포트 <span class="ver">v${ver} · standalone</span></h1>
      <div class="sub">바이오모션 ↔ 상동고등학교 야구부 · 단일 선수 1차 측정 (Theia + AMTI Force plate)</div>
    </div>
    <div class="meta">
      <div>측정 프로토콜: <b>Theia markerless 300 Hz + AMTI Force plate 1200 Hz</b></div>
      <div>분석 알고리즘: <b>process_pitching_session.py v${ver}</b> · 9 trial 합성</div>
    </div>
  </div>
</header>

<main>

<!-- 선수 정보 + ① 현재 상태 -->
<div class="panel">
  <div style="font-size:16px;font-weight:700">${playerName}</div>
  <div class="player-meta">
    <span><b>192</b> cm</span>
    <span><b>91</b> kg</span>
    <span>측정일 <b>2026-05-15</b></span>
    <span>총 <b>9</b> trial 합성 (event 잘못된 trial 6, 10 제외)</span>
  </div>

  <div class="section-marker" style="margin-top:14px">
    <div class="lbl">📍 1. 현재 상태</div>
  </div>

  <div class="kpi-row">
    <div class="kpi">
      <div class="label">📍 현재 측정 구속</div>
      <div class="value">${F(v.measured_kmh,1)} <span style="font-size:13px;font-weight:400">km/h</span></div>
      <div class="delta">최고 <b>${F(v.measured_kmh,1)}</b> · 평균 <b>${F(v.measured_avg_kmh,1)}</b> · SD <b>${F(v.measured_sd,2)}</b></div>
    </div>
    <div class="kpi bk-warn">
      <div class="label">💪 체력 향상 기대 구속</div>
      <div class="value">— <span style="font-size:13px;font-weight:400">km/h</span></div>
      <div class="delta">체력 데이터 미입력 (1차 GRF 단독 측정)</div>
    </div>
    <div class="kpi bk-good">
      <div class="label">⚙️ 메카닉 향상 기대 구속</div>
      <div class="value">${F(v.potential_kmh,1)} <span style="font-size:13px;font-weight:400">km/h</span></div>
      <div class="delta">현재 ${F(v.measured_kmh,1)} · 잠재 +${F(v.potential_kmh - v.measured_kmh,1)} km/h</div>
    </div>
    <div class="kpi bk-acc2">
      <div class="label">🎯 체력+메카닉 향상 기대 구속</div>
      <div class="value">${F(v.potential_kmh,1)} <span style="font-size:13px;font-weight:400">km/h</span></div>
      <div class="delta">메카닉 +${F(v.potential_kmh - v.measured_kmh,1)} · 체력 — km/h</div>
    </div>
  </div>

  <div class="info-bar">
    <span><b>부상 위험:</b> <span class="pill ${(f.elbow_flex_fp_deg && f.elbow_flex_fp_deg > 130) ? 'warn' : 'good'}">${(f.elbow_flex_fp_deg && f.elbow_flex_fp_deg > 130) ? '주의' : '낮음'}</span>
      <span class="muted" style="font-size:11px">Elbow flex at FP ${F(f.elbow_flex_fp_deg,0)}°</span></span>
    <span class="sep">|</span>
    <span><b>메카닉 효율 (AE):</b> ${(()=>{
      const ae = (mechScore/Math.max(v.measured_kmh,1))*100;
      const cls = ae >= 60 ? 'good' : ae >= 50 ? 'warn' : 'bad';
      return `<span class="pill ${cls}">${ae>=60?'우수':ae>=50?'보통':'개선'}</span> <span class="muted" style="font-size:11px">${F(ae,1)} score/(km/h)</span>`;
    })()}</span>
    <span class="sep">|</span>
    <span style="font-size:11px;color:var(--muted)">메카닉 종합 <b>${mechScore}</b> · ETE <b>${trans.overall_score ?? '—'}</b> · GRF LHEI <b>${grf.lhei ?? '—'}</b></span>
  </div>
</div>

<!-- ② 체력 (1차 측정에서는 미실시) -->
<div class="section-marker fitness">
  <div class="lbl">💪 2. 체력 <span style="font-size:12px;color:var(--muted);font-weight:400">— 1차 측정 미실시 (Theia+GRF 단독)</span></div>
</div>

<!-- ③ 메카닉 -->
<div class="section-marker mech">
  <div class="lbl">⚙️ 3. 메카닉</div>
</div>

<!-- 3-1 + 3-2 -->
<div class="grid-2">
  <div class="panel">
    <h2>3-1. 메카닉 5 모델 <span class="badge">Driveline 표준</span></h2>
    ${radarSVG()}
    <table class="data" style="margin-top:10px">
      <thead><tr><th>모델</th><th class="num">점수</th><th>주요 변인 (Top 2)</th></tr></thead>
      <tbody>
        ${['arm_action','posture','rotation','block','cog'].map(k=>{
          const md = dvl5[k]; if (!md) return '';
          const lbl = MODEL_LBL[k];
          const sc = md.score, cls = sc >= 100 ? 'score-good' : (sc >= 80 ? 'score-warn' : 'score-bad');
          const vars = Object.values(md.metrics).filter(x=>x.value!=null).slice(0,2).map(x=>x.label).join(', ');
          return `<tr><td><b>${lbl}</b></td><td class="num ${cls}">${F(sc,0)}</td><td class="muted" style="font-size:10.5px">${vars||'—'}</td></tr>`;
        }).join('')}
      </tbody>
    </table>
    <div class="footnote">
      <b>100</b> = Median Elite (90+ mph cohort) · <b>150</b> = Mechanical Ceiling.
      본인 ${F(v.measured_kmh,1)} km/h, 메카닉 종합 <b>${mechScore}</b>/100.
    </div>
  </div>

  <div class="panel">
    <h2>3-2. 시간축 분석 — 키네틱 시퀀스</h2>
    ${sequenceTimingSVG()}
    <div class="sec-quality" style="background:${seqQ.bg};border-left-color:${seqQ.c};margin-top:10px">
      <b style="color:${seqQ.c}">${seqQ.label}</b>
      <span class="muted" style="font-size:11.5px;margin-left:8px">${seqQ.desc}</span>
    </div>
    <div class="grid-1-1">
      <table class="data">
        <thead><tr><th>분절</th><th class="num">Peak ω (°/s)</th><th class="num">Peak time</th></tr></thead>
        <tbody>
          <tr><td>골반 (Pelvis)</td><td class="num">${F(seq.pelvis_dps,0)}</td><td class="num muted">BR ${F(-30 - taLag - ptLag, 0)} ms</td></tr>
          <tr><td>몸통 (Trunk)</td><td class="num">${F(seq.trunk_dps,0)}</td><td class="num muted">BR ${F(-30 - taLag, 0)} ms</td></tr>
          <tr><td>팔 (Humerus)</td><td class="num">${F(seq.arm_dps,0)}</td><td class="num muted">BR -30 ms</td></tr>
        </tbody>
      </table>
      <table class="data">
        <thead><tr><th>Lag (ms)</th><th class="num">이상 범위</th><th class="num">본인</th></tr></thead>
        <tbody>
          <tr><td>골반 → 몸통</td><td class="num muted">0–80</td><td class="num ${ptOK?'score-good':'score-bad'}">${F(ptLag,1)}</td></tr>
          <tr><td>몸통 → 팔</td><td class="num muted">40–130</td><td class="num ${taOK?'score-good':'score-bad'}">${F(taLag,1)}</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</div>

<!-- 3-1 변인 상세 표 -->
<div class="panel">
  <h3>📋 5 모델 변인 상세 + Per 1km/h <span class="muted" style="font-size:11px;font-weight:400">(분석가용)</span></h3>
  <table class="data">
    <thead>
      <tr><th>모델</th><th>변인</th><th class="num">본인</th><th class="num">Median Elite</th><th>중요도</th><th class="num">Per 1km/h</th><th class="num">차이 (km/h)</th></tr>
    </thead>
    <tbody>
      ${(()=>{
        const out = [];
        ['arm_action','posture','rotation','block','cog'].forEach(k=>{
          const md = dvl5[k]; if (!md) return;
          const lbl = MODEL_LBL_SHORT[k];
          Object.entries(md.metrics).forEach(([_,vv],i)=>{
            const diff_mph = vv.value!=null && vv.median_elite!=null && vv.per_1mph ? (vv.value - vv.median_elite)/vv.per_1mph : null;
            const diff_kmh = diff_mph==null?null:diff_mph*1.609;
            const per_kmh = vv.per_1mph ? vv.per_1mph*0.621 : null;
            const impColor = vv.importance==='high'?'var(--bad)':vv.importance==='med'?'var(--warn)':'var(--muted)';
            const impLbl = vv.importance==='high'?'높음':vv.importance==='med'?'보통':'낮음';
            const dCls = diff_kmh==null?'muted':(diff_kmh>=0?'diff-pos':'diff-neg');
            const dStr = diff_kmh==null?'—':((diff_kmh>=0?'+':'')+F(diff_kmh,1));
            out.push(`<tr>
<td class="muted" style="font-size:10px">${i===0?lbl:''}</td>
<td>${vv.label}</td>
<td class="num"><b>${vv.value!=null?F(vv.value,vv.unit==='m/s'?2:0):'—'}</b> <span class="muted" style="font-size:10px">${vv.unit||''}</span></td>
<td class="num muted">${F(vv.median_elite,vv.unit==='m/s'?2:0)}</td>
<td style="color:${impColor};font-weight:600;font-size:10.5px">${impLbl}</td>
<td class="num muted">${F(per_kmh,2)}</td>
<td class="num ${dCls}">${dStr}</td></tr>`);
          });
        });
        return out.join('');
      })()}
    </tbody>
  </table>
  <div class="footnote">
    Driveline Pitching Assessment 표준. <b>Median Elite</b> = 90+ mph (≈ 145 km/h) cohort 50th percentile.
    <b>Per 1km/h</b> = "1 km/h 향상에 필요한 변인 변화량" (학술 ref Per 1mph × 0.621).
    <b>차이</b> = (본인 − Median Elite) / Per 1km/h × 1.609 km/h.<br><br>
    <b>📐 좌표계 정의 (우투 기준)</b><br>
    • <b>Peak Torso Counter Rot</b> — 골반 대비 상대회전 ❌. 수평면(transverse plane)에서 몸통의 <b>절대 반대 회전각</b>.
       부호: <b>+</b> 오른쪽 (3루쪽) / <b>−</b> 왼쪽 (홈쪽). Elite ≈ −38° (홈쪽으로 깊게 비틀림).<br>
    • <b>Torso Forward Tilt at FP</b> — 수직선 기준. <b>+</b> 앞으로 숙임 (forward) / <b>−</b> 뒤로 기울어짐 (lay back).<br>
    • <b>Torso Rotation at FP</b> — 3루 정면 자세 = 0°, 홈플레이트 정면 = 90°.
       <b>+</b> 열림 (홈쪽으로 회전 진행) / <b>−</b> 닫힘 (3루쪽에서 더 닫힘). Elite ≈ 2° (FP 시점에 거의 폐쇄 자세 유지).<br>
    • <b>Torso Rotation at BR</b> — 동일 좌표계. Elite ≈ 111° (BR 때 홈쪽 통과 후 follow-through).<br>
    • <b>Scap Load at FP</b> — markerless Theia 기준 부호 caveat 있음 (절댓값 권장).<br><br>
    <b>⚠ CoG Decel AE 정의 불명확</b> — 단위 m/s, median_elite 0.02 m/s 는 max−min 으로 보기엔 너무 작음.
    Driveline 원 정의 ("Acceleration Equivalent" = 단위 시간당 감속량 일 가능성).
    현재 본인 값은 cog_decel(=max−BR) 와 동일한 ${F(cog.decel,2)} m/s 로 임시 매핑됨 → <b>fact-check 필요</b>.
  </div>
</div>

<!-- 3-3 분절간 ETE -->
<div class="panel">
  <h2>3-3. 분절간 ETE — Proximal-to-Distal 4 Transition <span class="badge">Aguinaldo 2007 / Naito 2008</span></h2>
  <table class="data">
    <thead><tr><th>Transition</th><th class="num">Lag (ms)</th><th class="num">Lag 이상</th><th class="num">Speed Gain</th><th class="num">Gain 이상</th><th class="num">점수</th></tr></thead>
    <tbody>
      ${['pelvis_to_trunk','trunk_to_humerus','humerus_to_forearm','forearm_to_hand'].map(k=>{
        const t = trans[k]; if (!t) return '';
        const sCls = t.score >= 80 ? 'score-good' : (t.score >= 60 ? 'score-warn' : 'score-bad');
        return `<tr><td><b>${t.label_kr}</b></td><td class="num">${F(t.lag_ms,1)}</td><td class="num muted">${t.lag_ideal_ms?.[0]}–${t.lag_ideal_ms?.[1]}</td>
<td class="num">${t.speed_gain!=null?F(t.speed_gain,2)+'×':'—'}</td><td class="num muted">${F(t.speed_gain_ideal?.[0],1)}–${F(t.speed_gain_ideal?.[1],1)}×</td>
<td class="num ${sCls}">${t.score ?? '—'}</td></tr>`;
      }).join('')}
      <tr style="background:var(--panel2)">
        <td colspan="5"><b>종합 점수 (markerless 골반 weight 0.5)</b></td>
        <td class="num"><b class="${trans.overall_score>=80?'score-good':trans.overall_score>=60?'score-warn':'score-bad'}">${trans.overall_score ?? '—'}</b></td>
      </tr>
      ${trans.bottleneck_label?`<tr><td colspan="6" style="background:var(--bad-bg);color:var(--bad);font-size:11.5px">⚠ <b>가장 큰 누수 (Bottleneck)</b>: ${trans.bottleneck_label} — 점수 ${trans.bottleneck_score}점</td></tr>`:''}
    </tbody>
  </table>
  <div class="footnote">
    <b>Lag</b> = 분절 간 피크 시각 차 (proper sequence: 골반→몸통 5–25 ms, 몸통→위팔 50–110 ms, 위팔→아래팔 10–25 ms).<br>
    <b>Speed Gain</b> = 다음 분절 ω / 현재 분절 ω. 위팔→아래팔 1.1–1.4× 가 정상 (너무 크면 elbow valgus stress 증가).
  </div>
</div>

<!-- 3-4 GRF -->
<div class="panel">
  <h2>3-4. 지면반력 (GRF) — 수평 + 임펄스 + 타이밍 <span class="badge">Force Plate 측정</span></h2>
  <div style="font-size:11.5px;color:var(--muted);margin:-6px 0 12px">
    뒷발(FP2 · Drive Leg)과 앞발(FP1 · Lead Leg)의 지면반력 활용 정도. 운동량 변화의 본질은 <b>Impulse(∫F·dt)</b>.
  </div>

  <div class="grid-3">
    <div class="grf-card fp1">
      <div class="lbl">🦵 뒷발 (Drive Leg / FP2)</div>
      <div class="ttl">Z Peak Vertical</div>
      <div class="v">${F(grf.rear_force_pct,1)} <span style="font-size:12px;font-weight:400">%BW</span></div>
      <div class="sub">목표 ≥ 80 %BW</div>
      <div class="bar"><div style="width:${Math.min(100,(grf.rear_force_pct||0)/180*100)}%"></div></div>
    </div>
    <div class="grf-card fp2">
      <div class="lbl">🦶 앞발 (Lead Leg / FP1)</div>
      <div class="ttl">Z Peak Vertical</div>
      <div class="v">${F(grf.lead_force_pct,1)} <span style="font-size:12px;font-weight:400">%BW</span></div>
      <div class="sub">목표 ≥ 110 %BW</div>
      <div class="bar"><div style="width:${Math.min(100,(grf.lead_force_pct||0)/240*100)}%"></div></div>
    </div>
    <div class="grf-card lhei">
      <div class="lbl">📊 GRF 종합</div>
      <div class="ttl">LHEI</div>
      <div class="v" style="color:var(--good)">${grf.lhei ?? '—'} <span style="font-size:12px;font-weight:400">/100</span></div>
      <div class="sub">100 = 양발 최적 활용</div>
      <div class="bar"><div style="width:${Math.min(100,grf.lhei||0)}%"></div></div>
    </div>
  </div>

  <h3 style="margin-top:14px">수평 성분 + 임펄스 (Force Plate 본질)</h3>
  <div class="grid-1-1">
    <table class="data">
      <thead><tr><th colspan="4" style="background:#fff8c5;color:#9a6700">🦵 Drive Leg — Mound 추진 (AP 후방·Y−)</th></tr>
      <tr><th>변인</th><th class="num">본인</th><th class="num">Elite</th><th class="num">평가</th></tr></thead>
      <tbody>
        <tr><td>AP Peak (propulsive)</td><td class="num"><b>${F(grf.drive_propulsive_peak_pct_bw,1)}</b> %BW</td><td class="num muted">55–80</td>
          <td class="num ${grf.drive_propulsive_peak_pct_bw>=55&&grf.drive_propulsive_peak_pct_bw<=80?'score-good':'score-warn'}">${grf.drive_propulsive_peak_pct_bw>=55&&grf.drive_propulsive_peak_pct_bw<=80?'✅ Elite':'⚠ Over'}</td></tr>
        <tr><td>AP Impulse</td><td class="num"><b>${F(grf.drive_propulsive_impulse_pct_bw_s,2)}</b> %BW·s</td><td class="num muted">18–28</td><td class="num muted">—</td></tr>
        <tr><td>Z Peak (vertical)</td><td class="num">${F(grf.rear_force_pct,1)} %BW</td><td class="num muted">135–165</td><td class="num muted">—</td></tr>
      </tbody>
    </table>
    <table class="data">
      <thead><tr><th colspan="4" style="background:var(--accent-bg);color:var(--accent)">🦶 Lead Leg — 블록 (AP 전방·Y+ braking)</th></tr>
      <tr><th>변인</th><th class="num">본인</th><th class="num">Elite</th><th class="num">평가</th></tr></thead>
      <tbody>
        <tr><td>AP Peak (braking)</td><td class="num"><b>${F(grf.lead_braking_peak_pct_bw,1)}</b> %BW</td><td class="num muted">100–145</td>
          <td class="num ${grf.lead_braking_peak_pct_bw>=100?'score-good':'score-bad'}">${grf.lead_braking_peak_pct_bw>=100?'✅ Elite':'❌'}</td></tr>
        <tr><td>AP Impulse</td><td class="num"><b>${F(grf.lead_braking_impulse_pct_bw_s,2)}</b> %BW·s</td><td class="num muted">18–28</td><td class="num muted">—</td></tr>
        <tr><td>Z Peak (vertical)</td><td class="num">${F(grf.lead_force_pct,1)} %BW</td><td class="num muted">195–240</td><td class="num muted">—</td></tr>
      </tbody>
    </table>
  </div>

  <div class="footnote">
    <b>FP1 (앞발 / Lead Leg)</b> 착지 후 블로킹·트렁크 회전 핵심 (Werner 2008). <b>FP2 (뒷발 / Drive Leg)</b> 와인드업~릴리스 push-off.
    <b>수평 성분</b> — 추진(Drive Y−)·블록(Lead Y+) 임펄스가 운동량 변화의 본질. peak는 정점, impulse(∫F·dt)는 면적.
    Kageyama 2014, MacWilliams 1998, Howenstein 2020 기준.
  </div>
</div>

<!-- 3-5 메카닉 결함 (에너지 손실 Top 3) — ELI 섹션은 5 모델/ETE/GRF 와 중복으로 제거 -->
<div class="panel">
  <h2>3-5. 메카닉 결함 — 에너지 손실 Top 3 <span class="badge" style="background:var(--bad-bg);color:var(--bad)">Driveline 분석 기반</span></h2>
  <div style="font-size:11.5px;color:var(--muted);margin-bottom:10px">
    <b>5 모델 변인</b> 중 <b>중요도 높음</b> + <b>큰 음의 차이 (km/h)</b> + <b>분절간 ETE 누수 transition</b> 을 결합해
    구속 손실에 가장 많이 기여하는 영역 Top 3 자동 산출. <b>훈련 처방 1순위</b>.
  </div>
  ${(()=>{
    // 1) 5 모델 high-importance 변인 중 negative diff_kmh 큰 순
    const candidates = [];
    ['arm_action','posture','rotation','block','cog'].forEach(k=>{
      const md = dvl5[k]; if (!md) return;
      Object.entries(md.metrics).forEach(([key,vv])=>{
        if (vv.value==null || vv.median_elite==null || !vv.per_1mph) return;
        const diff_kmh = (vv.value - vv.median_elite)/vv.per_1mph * 1.609;
        if (diff_kmh < 0 && vv.importance==='high') {
          candidates.push({
            type:'driveline', model:k, model_lbl:MODEL_LBL_SHORT[k], var_lbl:vv.label,
            value:vv.value, elite:vv.median_elite, unit:vv.unit||'',
            loss:Math.abs(diff_kmh), importance:vv.importance
          });
        }
      });
    });
    // 2) ETE transitions with score < 100 (lag/gain 누수)
    ['pelvis_to_trunk','trunk_to_humerus','humerus_to_forearm','forearm_to_hand'].forEach(k=>{
      const t = trans[k]; if (!t || t.score==null || t.score>=95) return;
      // score 100 → loss 0, score 50 → loss 약 5 km/h 추정 (heuristic)
      const loss = (100 - t.score) * 0.06;
      const fault = t.lag_fault || t.gain_fault || '';
      candidates.push({
        type:'ete', model:'ete', model_lbl:'🔗 분절간 흐름',
        var_lbl:`${t.label_kr} (Lag ${F(t.lag_ms,1)} ms · Gain ${t.speed_gain?F(t.speed_gain,2)+'×':'—'})`,
        value:t.score, elite:100, unit:'점', loss, ete_fault:fault, ete_score:t.score
      });
    });
    // 큰 손실 순 정렬 + Top 3
    candidates.sort((a,b)=>b.loss-a.loss);
    const top3 = candidates.slice(0,3);

    // 처방 lookup
    const rxMap = {
      'Layback (어깨 최대 외회전)': '어깨 모빌리티 (sleeper stretch) · long-toss · plyo-ball Layback drill',
      'Shoulder Abduction at FP': '어깨 셋업 단계에서 외전 90° 유지 cueing · scap retraction throw',
      'Scap Load at FP': '광배·후면삼각근 강화 · scap retraction throw drill (절댓값 평가)',
      'Shoulder Rotation Velo': 'Layback 후 explosive 외→내회전 plyo throw · ball weight 진행',
      'Peak Hip-Shoulder Sep at FP (X-factor)': '골반-몸통 분리 강조 throw · 골반 회전 단독 drill (medball rotational throw)',
      'Peak Torso Counter Rot': '와인드업 시 몸통 반대 회전 강조 (홈쪽으로 깊게) · stride 시 어깨 잔류 cueing',
      'Torso Forward Tilt at FP': 'FP 시점 trunk forward tilt 만들기 — front leg block + 코어 stability drill',
      'Torso Rotation at FP': 'FP 시점 closed posture 유지 (3루쪽) → release 직전 폭발적 회전 → release 시점에서만 90° 도달',
      'Torso Rotation at BR': 'follow-through 의 trunk 회전 끝까지 (홈쪽 110°+) — 회전 멈추지 않기',
      'Torso Side Bend at MER': 'Glove side trunk lateral tilt drill — release 직전 contralateral side bend',
      'Torso Rotation Velo': 'Trunk 회전 폭발력 — medball rotational throw (heavy → light) · 코어 power',
      'Pelvis Rotation Velo': '골반 가속 drill (markerless 보정 caveat — marker 대비 약 −15% 측정)',
      'Lead Knee Extension': '앞발 착지 후 knee 신전 강조 (RDL · lateral squat · 단발 throw)',
      'Stride Length': 'Stride 거리 점진 증가 (체중 90%+ 권장) · towel drill',
      'CoG Decel AE': 'CoG 감속 강화 — 앞발 block + 골반 braking 통합 drill (정의 caveat 주의)',
      'Peak Lead Knee Ext Velo': 'Knee 신전 속도 — single leg jumping · 앞발 explosive block',
      'CoG Decel': '앞발 block + 골반 braking 통합 drill — Lead leg AP impulse 18-28 %BW·s 목표',
      'Max CoG Velo': '체중 이동 속도 ↑ — explosive stride drill, KB swing'
    };
    const eteRxMap = {
      'pelvis_to_trunk':'골반→몸통 lag 보정 — 골반 단독 회전 후 몸통 따라가기 drill (medball rotation 단계별)',
      'trunk_to_humerus':'몸통→위팔 lag 보정 — Layback 유지 → 폭발적 내회전 (plyo-ball Layback drill)',
      'humerus_to_forearm':'위팔→아래팔 — 너무 이른 elbow 신전 방지, valgus stress ↑ 위험. wrist weight + slow throw',
      'forearm_to_hand':'아래팔→손 — release 시점 손 가속 cueing (towel drill, 짧은 ball)'
    };

    if (top3.length === 0) return `<div style="padding:14px;background:var(--good-bg);border-radius:5px;color:var(--good);font-weight:600">✅ 큰 에너지 손실 영역 없음 — 5 모델 + ETE 모두 elite 수준</div>`;

    return top3.map((c,i)=>{
      const num = i+1;
      const numColor = ['#cf222e','#bc4c00','#8250df'][i];
      const rx = c.type==='ete' ? eteRxMap[c.model] : (rxMap[c.var_lbl] || '해당 변인 강화 drill');
      const valStr = c.type==='ete'
        ? `점수 ${c.value} <span class="muted" style="font-size:11px">(${c.ete_fault || 'gain·lag 누수'})</span>`
        : `${F(c.value, c.unit==='m/s'?2:0)} ${c.unit} <span class="muted" style="font-size:11px">(Elite ${F(c.elite, c.unit==='m/s'?2:0)} ${c.unit})</span>`;
      return `<div class="action-card warn" style="position:relative;padding-left:48px">
        <div style="position:absolute;left:10px;top:10px;width:28px;height:28px;border-radius:50%;background:${numColor};color:#fff;text-align:center;line-height:28px;font-weight:700">${num}</div>
        <div style="font-weight:700;color:${numColor};margin-bottom:4px">${c.model_lbl} — ${c.var_lbl}</div>
        <div style="font-size:11.5px"><b>현재:</b> ${valStr}</div>
        <div style="font-size:11.5px"><b>추정 구속 손실:</b> <span class="diff-neg">−${F(c.loss,1)} km/h</span></div>
        <div style="font-size:11.5px;margin-top:4px;color:var(--good)"><b>💪 처방:</b> ${rx}</div>
      </div>`;
    }).join('');
  })()}
  <div class="footnote" style="margin-top:10px">
    <b>산출 방식</b> — Driveline 5 모델 중 <b>중요도 높음</b> 변인의 (본인 − Median Elite)/Per 1km/h × 1.609 km/h 손실량 + ETE 4 transition 점수 100점 미만 영역.
    음의 차이 큰 순으로 Top 3.
    <span class="muted">※ <b>이전 §3-5 자세 안정성 (ELI 6 zone) 섹션은 Driveline 5 모델 (Z1↔3-2 시퀀싱, Z2↔Posture/X-factor, Z3↔Block, Z4↔Posture/Trunk tilt, Z5↔Arm Action/Layback, Z6↔CoG/감속) 와 중복되어 삭제했습니다.</b></span>
  </div>
</div>

<!-- 3-6 메카닉 발달 권장 -->
<div class="panel" style="border-left:4px solid var(--good)">
  <h2>3-6. 메카닉 발달 권장 — Action Plan <span class="badge" style="background:var(--good-bg);color:var(--good)">자동 산출</span></h2>
  <div style="font-size:11.5px;color:var(--muted);margin-bottom:10px">5 모델 점수 + ETE bottleneck + GRF 임펄스 종합 → 우선순위 훈련 자동 매핑.</div>
  ${(()=>{
    const items = [];
    if (trans.bottleneck) items.push({type:'warn', txt:`🔗 <b>ETE Bottleneck — ${trans.bottleneck_label}</b> (${trans.bottleneck_score}점) · 해당 분절 transition 강조 드릴`});
    if (grf.lead_braking_peak_pct_bw >= 100) items.push({type:'ok', txt:`✅ <b>Lead leg block 우수</b> — ${F(grf.lead_braking_peak_pct_bw,0)} %BW (Elite 100–145 범위 내)`});
    else items.push({type:'warn', txt:`⚠ <b>Lead leg block 미달</b> — ${F(grf.lead_braking_peak_pct_bw,0)} %BW · RDL + lateral squat + 앞발 단독 throw`});
    if (cog.decel != null && cog.decel >= 1.5) items.push({type:'ok', txt:`✅ <b>CoG deceleration 우수</b> — ${F(cog.decel,2)} m/s · 골반 braking 적절`});
    if (f.x_factor_deg >= 30) items.push({type:'ok', txt:`✅ <b>X-factor 분리</b> ${F(f.x_factor_deg,0)}° (markerless 표준)`});
    else items.push({type:'warn', txt:`⚠ <b>X-factor 분리 부족</b> — ${F(f.x_factor_deg,0)}° · 골반-몸통 분리 강조 throw`});
    if (v.measured_kmh >= 135) items.push({type:'ok', txt:`✅ <b>구속 elite 수준</b> — ${F(v.measured_kmh,1)} km/h (한국 고1 elite 기준)`});
    if (f.scap_load_fp_deg < 0) items.push({type:'warn', txt:`⚠ <b>Scap Load 부호 caveat</b> — markerless Theia 좌표계가 Driveline 양수 standard와 반대일 수 있음. 절댓값 |${F(Math.abs(f.scap_load_fp_deg),1)}°| 기준 평가`});
    return items.map(it => `<div class="action-card ${it.type}">${it.txt}</div>`).join('');
  })()}
</div>

<!-- ④ 결과 -->
<div class="section-marker result">
  <div class="lbl">🎯 4. 결과 — 부상위험 · 제구 일관성</div>
</div>

<div class="panel">
  <h2>🩺 부상위험 · 제구 일관성</h2>
  <div class="grid-1-1">
    <div>
      <h3>정렬 · 분리</h3>
      <table class="data">
        <tbody>
          <tr><td>X-factor (분리각)</td><td class="num"><b>${F(f.x_factor_deg,0)}°</b></td></tr>
          <tr><td>Lead knee (FC→BR)</td><td class="num"><b>${F(f.lead_knee_change,0)}°</b></td></tr>
          <tr><td>Trunk forward tilt at FC</td><td class="num"><b>${F(f.trunk_tilt_at_fc_deg,0)}°</b></td></tr>
          <tr><td>Trunk lateral tilt</td><td class="num"><b>${F(f.trunk_lat_tilt_deg,0)}°</b></td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <h3>제구 일관성 (trial SD)</h3>
      <table class="data">
        <tbody>
          <tr><td>측정 구속 SD</td><td class="num"><b>${F(v.measured_sd,2)} km/h</b></td></tr>
          <tr><td>9 trial 합성</td><td class="num muted">trial 6, 10 제외</td></tr>
          <tr><td>Sequence quality</td><td class="num"><span class="pill ${okCount===2?'good':okCount===1?'warn':'bad'}">${seqQ.label.split(' ')[0]} ${okCount}/2</span></td></tr>
        </tbody>
      </table>
    </div>
  </div>
</div>

<div style="font-size:10.5px;color:var(--muted);margin-top:24px;padding:12px;border-top:1px solid var(--line);text-align:center;line-height:1.6">
  분석 알고리즘: <b>process_pitching_session.py v${ver}</b> (event-free GRF detection) · 9 trial 합성 (event 잘못된 trial 6, 10 제외) · markerless Theia 300 Hz + AMTI Force plate 1200 Hz<br>
  학술 reference: Driveline Pitching Assessment 표준 + KR markerless 보정 · Aguinaldo 2007/2019, Naito 2008, Howenstein 2020, MacWilliams 1998, Kageyama 2014, Werner 2008<br>
  국민대 스포츠과학과 야구 바이오메카닉스 · kklee@kookmin.ac.kr
</div>

</main>
</body></html>`;

fs.writeFileSync(outPath, html);
console.log(`✓ ${outPath} (${html.length} bytes)`);
