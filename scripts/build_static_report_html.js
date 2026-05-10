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
  cog_decel: cog.decel, cog_decel_ae: cog.decel_ae ?? null, max_cog_velo: cog.max_velo
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

// ─── 마네킹 SVG (renderKineticChainSvg) — Uplift_Pitching_Team app.js 포팅 v5.40 ───
//     v5.40 update: 4 transition score 기반 (ETE 표와 일관) + 뒷발 에너지 경로 + 라벨 좌우 칼럼 정렬
function renderMannequinSvg() {
  // 4 transition score (ETE 표와 동일 source)
  const tPT = trans.pelvis_to_trunk    || {};   // 골반 → 몸통
  const tTH = trans.trunk_to_humerus   || {};   // 몸통 → 위팔
  const tHF = trans.humerus_to_forearm || {};   // 위팔 → 아래팔
  const tFH = trans.forearm_to_hand    || {};   // 아래팔 → 손

  // score → 색깔 (≥80 green, 60-80 orange, <60 red)
  const scoreColor = s => s == null ? '#94a3b8' : s >= 80 ? '#1a7f37' : s >= 60 ? '#bc4c00' : '#cf222e';
  const scoreFlag  = s => s == null ? '—' : s >= 80 ? '✓' : s >= 60 ? '△' : '⚠';
  const segColor   = s => s == null ? '#3b82f6' : s >= 80 ? '#3b82f6' : s >= 60 ? '#f59e0b' : '#ef4444';
  const xFactor = f.x_factor_deg;
  const kneeChange = f.lead_knee_change;
  const driveAP = grf.drive_propulsive_peak_pct_bw;  // %BW
  const flyingOpen = xFactor != null && xFactor < 5;
  const kneeCollapse = kneeChange != null && kneeChange < -10;
  const kneeCollapseSevere = kneeChange != null && kneeChange < -22.2;
  // Drive leg status: AP peak %BW 가 55-80 elite
  const driveStatus = driveAP == null ? 'na' :
    (driveAP >= 55 && driveAP <= 80) ? 'normal' :
    driveAP > 80 ? 'over' :   // over-push (추진 과잉)
    driveAP >= 35 ? 'weak' : 'leak';
  const driveColor = {normal:'#3b82f6',over:'#f59e0b',weak:'#fde68a',leak:'#ef4444',na:'#94a3b8'}[driveStatus];
  const driveLabel = {normal:'✓ Elite',over:'△ Over-push',weak:'△ Weak',leak:'⚠ 부족',na:'—'}[driveStatus];
  const uid = 'm' + Math.random().toString(36).slice(2, 8);

  // 마네킹 keypoints (Uplift app.js v33.0 기준, 우투 좌향)
  // v5.40 final: 목관절 → 몸통 중앙 / 전완 horizontal / 뒷다리 ground 도달
  const K = {
    head:[470,100], neck:[479,160],                            // 목관절 → 어깨 라인 중앙 (몸통 top center)
    rShoulder:[520,162], lShoulder:[438,158],
    rElbow:[572,108], rWrist:[630,108], ball:[650,108],        // 전완 horizontal (지면 평행)
    lElbow:[376,176], lWrist:[424,220],
    pelvisR:[506,280], pelvisL:[446,280], pelvisC:[476,280],
    rKnee:[556,400], rAnkle:[620,478], rToe:[658,484],         // 뒷다리 연장 (toe near ground 485)
    lKnee:[370,384], lAnkle:[332,472], lToe:[290,474]
  };
  // ─── 메인 에너지 경로 (앞발 → 골반 → 몸통 → 어깨 → 팔꿈치 → 손목 → 공) ───
  const energyPath = `M ${K.lAnkle[0]} ${K.lAnkle[1]} L ${K.lKnee[0]} ${K.lKnee[1]} L ${K.pelvisL[0]} ${K.pelvisL[1]} L ${K.pelvisC[0]} ${K.pelvisC[1]} L ${K.rShoulder[0]} ${K.rShoulder[1]} L ${K.rElbow[0]} ${K.rElbow[1]} L ${K.rWrist[0]} ${K.rWrist[1]} L ${K.ball[0]} ${K.ball[1]}`;
  // ─── 뒷발 에너지 경로 (지면 → 뒷발 → 무릎 → 뒷발 고관절 → 골반 중심) v5.40 NEW ───
  const driveLegPath = `M ${K.rToe[0]-15} ${K.rToe[1]+8} L ${K.rAnkle[0]} ${K.rAnkle[1]} L ${K.rKnee[0]} ${K.rKnee[1]} L ${K.pelvisR[0]} ${K.pelvisR[1]} L ${K.pelvisC[0]} ${K.pelvisC[1]}`;

  // 누수 burst 애니메이션 — score < 60 인 transition 위치에 빨간 burst
  const burstHF = (tHF.score != null && tHF.score < 80) ? `<circle cx="${(K.rElbow[0]+K.rWrist[0])/2}" cy="${(K.rElbow[1]+K.rWrist[1])/2}" r="32" fill="url(#leak-${uid})" opacity="${tHF.score<60?0.85:0.55}">
    <animate attributeName="r" values="22;36;22" dur="1.4s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="${tHF.score<60?'0.9;0.45;0.9':'0.6;0.3;0.6'}" dur="1.4s" repeatCount="indefinite"/>
  </circle>` : '';
  const burstFH = (tFH.score != null && tFH.score < 80) ? `<circle cx="${(K.rWrist[0]+K.ball[0])/2}" cy="${(K.rWrist[1]+K.ball[1])/2}" r="24" fill="url(#leak-${uid})" opacity="${tFH.score<60?0.85:0.55}">
    <animate attributeName="r" values="14;28;14" dur="1.2s" repeatCount="indefinite"/>
  </circle>` : '';
  const burstPT = (tPT.score != null && tPT.score < 60) ? `<circle cx="${K.pelvisC[0]}" cy="${K.pelvisC[1]}" r="28" fill="url(#leak-${uid})" opacity="0.75">
    <animate attributeName="r" values="20;32;20" dur="1.2s" repeatCount="indefinite"/>
  </circle>` : '';
  const burstTH = (tTH.score != null && tTH.score < 60) ? `<circle cx="${(K.pelvisC[0]+K.rShoulder[0])/2}" cy="${(K.pelvisC[1]+K.rShoulder[1])/2}" r="34" fill="url(#leak-${uid})" opacity="0.75">
    <animate attributeName="r" values="24;38;24" dur="1.3s" repeatCount="indefinite"/>
  </circle>` : '';
  const kneeBurst = kneeCollapseSevere ? `<circle cx="${K.lKnee[0]}" cy="${K.lKnee[1]}" r="22" fill="url(#leak-${uid})" opacity="0.8">
    <animate attributeName="r" values="14;26;14" dur="1.3s" repeatCount="indefinite"/>
  </circle>` : '';

  return `<svg viewBox="0 0 800 560" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-height:500px">
  <defs>
    <linearGradient id="bg-${uid}" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#f5f7fa" stop-opacity="0"/>
      <stop offset="1" stop-color="#f5f7fa" stop-opacity="0.35"/>
    </linearGradient>
    <!-- v5.40: 4 transition score 기반 그라디언트 (ETE 표와 일관) -->
    <linearGradient id="energy-${uid}" gradientUnits="userSpaceOnUse" x1="${K.lAnkle[0]}" y1="${K.lAnkle[1]}" x2="${K.ball[0]}" y2="${K.ball[1]}">
      <stop offset="0%"   stop-color="${kneeCollapse?'#fde68a':'#22d3ee'}"/>
      <stop offset="20%"  stop-color="${kneeCollapse?'#f59e0b':'#60a5fa'}"/>
      <stop offset="40%"  stop-color="${segColor(tPT.score)}"/>
      <stop offset="58%"  stop-color="${segColor(tTH.score)}"/>
      <stop offset="78%"  stop-color="${segColor(tHF.score)}"/>
      <stop offset="100%" stop-color="${segColor(tFH.score)}"/>
    </linearGradient>
    <!-- 뒷발 에너지 path 그라디언트 (v5.40) -->
    <linearGradient id="drive-${uid}" gradientUnits="userSpaceOnUse" x1="${K.rToe[0]}" y1="${K.rToe[1]+10}" x2="${K.pelvisC[0]}" y2="${K.pelvisC[1]}">
      <stop offset="0%"   stop-color="#22d3ee"/>
      <stop offset="35%"  stop-color="${driveColor}"/>
      <stop offset="70%"  stop-color="${driveColor}"/>
      <stop offset="100%" stop-color="#3b82f6"/>
    </linearGradient>
    <radialGradient id="leak-${uid}">
      <stop offset="0%" stop-color="#fee2e2" stop-opacity="0.95"/>
      <stop offset="40%" stop-color="#ef4444" stop-opacity="0.75"/>
      <stop offset="100%" stop-color="#7f1d1d" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="mSphere-${uid}" cx="35%" cy="30%" r="75%">
      <stop offset="0%" stop-color="#f1f5f9"/><stop offset="45%" stop-color="#cbd5e1"/>
      <stop offset="85%" stop-color="#64748b"/><stop offset="100%" stop-color="#334155"/>
    </radialGradient>
    <linearGradient id="mLimb-${uid}" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#e2e8f0"/><stop offset="50%" stop-color="#94a3b8"/><stop offset="100%" stop-color="#475569"/>
    </linearGradient>
    <linearGradient id="mLimbD-${uid}" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#94a3b8"/><stop offset="55%" stop-color="#64748b"/><stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="mTorso-${uid}" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#e2e8f0"/><stop offset="40%" stop-color="#94a3b8"/><stop offset="100%" stop-color="#334155"/>
    </linearGradient>
    <radialGradient id="mJoint-${uid}" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#f8fafc"/><stop offset="60%" stop-color="#94a3b8"/><stop offset="100%" stop-color="#334155"/>
    </radialGradient>
    <radialGradient id="aoShadow-${uid}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#000" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow-${uid}" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <line x1="40" y1="490" x2="760" y2="490" stroke="#2a3a5a" stroke-width="1.5" stroke-dasharray="3 6"/>
  <rect x="0" y="0" width="800" height="560" fill="url(#bg-${uid})"/>
  <ellipse cx="${(K.lAnkle[0]+K.rAnkle[0])/2}" cy="492" rx="190" ry="13" fill="url(#aoShadow-${uid})"/>

  <!-- Glove arm (back) -->
  <line x1="${K.lShoulder[0]}" y1="${K.lShoulder[1]}" x2="${K.lElbow[0]}" y2="${K.lElbow[1]}" stroke="url(#mLimbD-${uid})" stroke-width="22" stroke-linecap="round"/>
  <circle cx="${K.lElbow[0]}" cy="${K.lElbow[1]}" r="12" fill="url(#mJoint-${uid})"/>
  <line x1="${K.lElbow[0]}" y1="${K.lElbow[1]}" x2="${K.lWrist[0]}" y2="${K.lWrist[1]}" stroke="url(#mLimbD-${uid})" stroke-width="19" stroke-linecap="round"/>
  <circle cx="${K.lWrist[0]}" cy="${K.lWrist[1]}" r="13" fill="url(#mSphere-${uid})"/>

  <!-- Drive leg (back) -->
  <line x1="${K.pelvisR[0]}" y1="${K.pelvisR[1]}" x2="${K.rKnee[0]}" y2="${K.rKnee[1]}" stroke="url(#mLimbD-${uid})" stroke-width="28" stroke-linecap="round"/>
  <circle cx="${K.rKnee[0]}" cy="${K.rKnee[1]}" r="14" fill="url(#mJoint-${uid})"/>
  <line x1="${K.rKnee[0]}" y1="${K.rKnee[1]}" x2="${K.rAnkle[0]}" y2="${K.rAnkle[1]}" stroke="url(#mLimbD-${uid})" stroke-width="24" stroke-linecap="round"/>
  <circle cx="${K.rAnkle[0]}" cy="${K.rAnkle[1]}" r="11" fill="url(#mSphere-${uid})"/>
  <line x1="${K.rAnkle[0]}" y1="${K.rAnkle[1]}" x2="${K.rToe[0]}" y2="${K.rToe[1]}" stroke="#475569" stroke-width="18" stroke-linecap="round"/>

  <!-- Torso (mTorso 그라디언트) -->
  <path d="M ${K.lShoulder[0]-6} ${K.lShoulder[1]} L ${K.rShoulder[0]+6} ${K.rShoulder[1]} L ${K.pelvisR[0]+4} ${K.pelvisR[1]} L ${K.pelvisL[0]-4} ${K.pelvisL[1]} Z" fill="url(#mTorso-${uid})" stroke="#475569" stroke-width="1.2"/>

  <!-- Lead leg (front) -->
  <line x1="${K.pelvisL[0]}" y1="${K.pelvisL[1]}" x2="${K.lKnee[0]}" y2="${K.lKnee[1]}" stroke="url(#mLimb-${uid})" stroke-width="28" stroke-linecap="round"/>
  <circle cx="${K.lKnee[0]}" cy="${K.lKnee[1]}" r="14" fill="${kneeCollapseSevere?'#ef4444':'url(#mJoint-'+uid+')'}" stroke="${kneeCollapseSevere?'#7f1d1d':'#475569'}" stroke-width="${kneeCollapseSevere?2:1}"/>
  <line x1="${K.lKnee[0]}" y1="${K.lKnee[1]}" x2="${K.lAnkle[0]}" y2="${K.lAnkle[1]}" stroke="url(#mLimb-${uid})" stroke-width="24" stroke-linecap="round"/>
  <circle cx="${K.lAnkle[0]}" cy="${K.lAnkle[1]}" r="11" fill="url(#mSphere-${uid})"/>
  <line x1="${K.lAnkle[0]}" y1="${K.lAnkle[1]}" x2="${K.lToe[0]}" y2="${K.lToe[1]}" stroke="#94a3b8" stroke-width="18" stroke-linecap="round"/>

  <!-- Pitching arm (front) -->
  <line x1="${K.rShoulder[0]}" y1="${K.rShoulder[1]}" x2="${K.rElbow[0]}" y2="${K.rElbow[1]}" stroke="url(#mLimb-${uid})" stroke-width="22" stroke-linecap="round"/>
  <circle cx="${K.rElbow[0]}" cy="${K.rElbow[1]}" r="12" fill="url(#mJoint-${uid})"/>
  <line x1="${K.rElbow[0]}" y1="${K.rElbow[1]}" x2="${K.rWrist[0]}" y2="${K.rWrist[1]}" stroke="url(#mLimb-${uid})" stroke-width="19" stroke-linecap="round"/>
  <circle cx="${K.rWrist[0]}" cy="${K.rWrist[1]}" r="11" fill="url(#mSphere-${uid})"/>
  <circle cx="${K.ball[0]}" cy="${K.ball[1]}" r="10" fill="#fff" stroke="#1f2937" stroke-width="1.5"/>
  <circle cx="${K.ball[0]-3}" cy="${K.ball[1]-2}" r="3" fill="#dc2626"/>

  <!-- Head -->
  <circle cx="${K.head[0]}" cy="${K.head[1]}" r="22" fill="url(#mSphere-${uid})" stroke="#475569" stroke-width="1.2"/>
  <line x1="${K.head[0]}" y1="${K.head[1]+22}" x2="${K.neck[0]}" y2="${K.neck[1]}" stroke="#94a3b8" stroke-width="14" stroke-linecap="round"/>

  <!-- 누수 burst 애니메이션 (v5.40: 4 transition score < 80 위치) -->
  ${burstPT}${burstTH}${burstHF}${burstFH}${kneeBurst}

  <!-- 뒷발 에너지 흐름 path (지면 → 발 → 무릎 → 뒷고관절 → 골반) v5.40 -->
  <path d="${driveLegPath}" fill="none" stroke="url(#drive-${uid})" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow-${uid})" opacity="0.85"/>
  <path d="${driveLegPath}" fill="none" stroke="url(#drive-${uid})" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>

  <!-- 메인 에너지 흐름 path (앞발 → 골반 → 몸통 → 팔 → 공) -->
  <path d="${energyPath}" fill="none" stroke="url(#energy-${uid})" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow-${uid})" opacity="0.95"/>
  <path d="${energyPath}" fill="none" stroke="url(#energy-${uid})" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>

  <!-- ─── 라벨: 변인이 관련된 신체 위치 근처에 anchor + connector line v5.40 ─── -->
  <!-- 라벨 helper macro: rect(x,y,w,h) + connector dotted line to body anchor -->

  <!-- ④ 아래팔 → 손  →  손목/공 위치 (rWrist[612,72] / ball[634,60]) → 라벨을 좌측 상단에 -->
  <line x1="446" y1="40" x2="${K.rWrist[0]-6}" y2="${K.rWrist[1]+2}" stroke="${scoreColor(tFH.score)}" stroke-width="1" stroke-dasharray="3,2" opacity="0.6"/>
  <g transform="translate(290, 12)">
    <rect x="0" y="0" width="156" height="44" rx="6" fill="#fff" stroke="${scoreColor(tFH.score)}" stroke-width="1.5"/>
    <text x="8" y="17" fill="#1f2937" font-size="11" font-weight="700">④ 아래팔 → 손</text>
    <text x="8" y="35" fill="${scoreColor(tFH.score)}" font-size="13" font-weight="700">${tFH.score!=null?tFH.score+'점':'—'} ${scoreFlag(tFH.score)} <tspan font-size="10" fill="#64748b">${F(tFH.lag_ms,1)} ms</tspan></text>
  </g>

  <!-- ③ 위팔 → 아래팔 →  팔꿈치 위치 (rElbow[572,108]) → 우측 상단 (v5.40: 마네킹 ball 과 안 겹치게 우측으로 이동) -->
  <line x1="672" y1="100" x2="${K.ball[0]+8}" y2="${K.ball[1]}" stroke="${scoreColor(tHF.score)}" stroke-width="1" stroke-dasharray="3,2" opacity="0.6"/>
  <g transform="translate(672, 78)">
    <rect x="0" y="0" width="124" height="44" rx="6" fill="#fff" stroke="${scoreColor(tHF.score)}" stroke-width="1.5"/>
    <text x="8" y="17" fill="#1f2937" font-size="11" font-weight="700">③ 위팔 → 아래팔</text>
    <text x="8" y="35" fill="${scoreColor(tHF.score)}" font-size="13" font-weight="700">${tHF.score!=null?tHF.score+'점':'—'} ${scoreFlag(tHF.score)} <tspan font-size="10" fill="#64748b">${F(tHF.lag_ms,1)} ms</tspan></text>
  </g>

  <!-- ② 몸통 → 위팔 →  어깨 위치 (rShoulder[520,162]) → 우측 중상단 -->
  <line x1="640" y1="170" x2="${K.rShoulder[0]+12}" y2="${K.rShoulder[1]+2}" stroke="${scoreColor(tTH.score)}" stroke-width="1" stroke-dasharray="3,2" opacity="0.6"/>
  <g transform="translate(640, 150)">
    <rect x="0" y="0" width="156" height="44" rx="6" fill="#fff" stroke="${scoreColor(tTH.score)}" stroke-width="1.5"/>
    <text x="8" y="17" fill="#1f2937" font-size="11" font-weight="700">② 몸통 → 위팔</text>
    <text x="8" y="35" fill="${scoreColor(tTH.score)}" font-size="13" font-weight="700">${tTH.score!=null?tTH.score+'점':'—'} ${scoreFlag(tTH.score)} <tspan font-size="10" fill="#64748b">${F(tTH.lag_ms,0)} ms</tspan></text>
  </g>

  <!-- ① 골반 → 몸통 → 골반-몸통 junction (pelvisC[476,280] → 토르소 중간) → 좌측 골반 옆 -->
  <line x1="170" y1="245" x2="${K.pelvisL[0]-8}" y2="${K.pelvisL[1]+2}" stroke="${scoreColor(tPT.score)}" stroke-width="1" stroke-dasharray="3,2" opacity="0.6"/>
  <g transform="translate(10, 224)">
    <rect x="0" y="0" width="156" height="44" rx="6" fill="#fff" stroke="${scoreColor(tPT.score)}" stroke-width="1.5"/>
    <text x="8" y="17" fill="#1f2937" font-size="11" font-weight="700">① 골반 → 몸통</text>
    <text x="8" y="35" fill="${scoreColor(tPT.score)}" font-size="13" font-weight="700">${tPT.score!=null?tPT.score+'점':'—'} ${scoreFlag(tPT.score)} <tspan font-size="10" fill="#64748b">${F(tPT.lag_ms,0)} ms</tspan></text>
  </g>

  <!-- 🛡 X-factor (골반 vs 몸통 분리각) → pelvisC[476,280] 우측 → 우측 토르소 옆 -->
  <line x1="640" y1="248" x2="${K.pelvisR[0]+10}" y2="${K.pelvisR[1]+2}" stroke="${flyingOpen?'#cf222e':'#94a3b8'}" stroke-width="1" stroke-dasharray="3,2" opacity="0.6"/>
  <g transform="translate(640, 226)">
    <rect x="0" y="0" width="156" height="44" rx="6" fill="#fff" stroke="${flyingOpen?'#cf222e':'#94a3b8'}" stroke-width="1.5"/>
    <text x="8" y="17" fill="#1f2937" font-size="11" font-weight="700">🛡 X-factor (분리각)</text>
    <text x="8" y="35" fill="${flyingOpen?'#cf222e':'#1a7f37'}" font-size="13" font-weight="700">${xFactor!=null?F(xFactor,1):'—'}° ${flyingOpen?'⚠ Flying Open':'✓'}</text>
  </g>

  <!-- 🦶 앞무릎 신전 → lKnee[370,384] 좌측 → 좌측 무릎 옆 -->
  <line x1="170" y1="376" x2="${K.lKnee[0]-12}" y2="${K.lKnee[1]+2}" stroke="${kneeCollapseSevere?'#cf222e':kneeCollapse?'#bc4c00':'#94a3b8'}" stroke-width="1" stroke-dasharray="3,2" opacity="0.6"/>
  <g transform="translate(10, 354)">
    <rect x="0" y="0" width="156" height="44" rx="6" fill="#fff" stroke="${kneeCollapseSevere?'#cf222e':kneeCollapse?'#bc4c00':'#94a3b8'}" stroke-width="1.5"/>
    <text x="8" y="17" fill="#1f2937" font-size="11" font-weight="700">🦶 앞무릎 신전 (FC→BR)</text>
    <text x="8" y="35" fill="${kneeCollapseSevere?'#cf222e':kneeCollapse?'#bc4c00':'#1a7f37'}" font-size="13" font-weight="700">${kneeChange!=null?(kneeChange>=0?'+':'')+F(kneeChange,1):'—'}° ${!kneeCollapse?'✓ Block 우수':(kneeCollapseSevere?'⚠ 무너짐':'△ 약함')}</text>
  </g>

  <!-- 🦵 뒷발 추진 (Drive AP) → rAnkle[620,478] 우측 → 우측 뒷발 옆 (v5.40: 마네킹 발과 겹치지 않게 우측으로 이동) -->
  <line x1="672" y1="478" x2="${K.rToe[0]+5}" y2="${K.rToe[1]}" stroke="${driveColor}" stroke-width="1" stroke-dasharray="3,2" opacity="0.6"/>
  <g transform="translate(672, 456)">
    <rect x="0" y="0" width="124" height="44" rx="6" fill="#fff" stroke="${driveColor}" stroke-width="1.5"/>
    <text x="8" y="17" fill="#1f2937" font-size="11" font-weight="700">🦵 뒷발 추진 (Drive)</text>
    <text x="8" y="35" fill="${driveColor}" font-size="13" font-weight="700">${driveAP!=null?F(driveAP,1)+' %BW':''}<tspan font-size="11"> ${driveLabel}</tspan></text>
  </g>

  <!-- 범례 (하단, 새 ground line y=490 + 캔버스 560 에 맞춤) -->
  <g transform="translate(280, 528)">
    <text x="0" y="0" fill="#1f2937" font-size="10.5" font-weight="600">에너지 흐름: 뒷발 추진 (보조) + 앞발 → 골반 → 몸통 → 팔 → 공 (메인)</text>
    <circle cx="0" cy="14" r="5" fill="#3b82f6"/><text x="9" y="18" fill="#475569" font-size="10">정상 (≥80점)</text>
    <circle cx="100" cy="14" r="5" fill="#f59e0b"/><text x="109" y="18" fill="#475569" font-size="10">누수 mild (60~80)</text>
    <circle cx="225" cy="14" r="5" fill="#ef4444"/><text x="234" y="18" fill="#475569" font-size="10">누수 severe (&lt;60)</text>
  </g>
</svg>`;
}

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

<!-- 3-1 + 3-2 (v5.40: 동일 비율 1fr:1fr) -->
<div class="grid-1-1" style="align-items:stretch">
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
    <!-- v5.40: 좌측 GIF 제거, 폭을 §3-1과 동일하게 (시계열 SVG full-width) -->
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
            // v5.40: 차이가 음수면 변인명도 빨갛게 (보완 대상 가시화)
            const labelColor = (diff_kmh != null && diff_kmh < 0) ? 'color:var(--bad);font-weight:600' : '';
            out.push(`<tr>
<td class="muted" style="font-size:10px">${i===0?lbl:''}</td>
<td style="${labelColor}">${vv.label}</td>
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
    <b>📊 표 컬럼 정의</b>
    <table style="width:100%;font-size:10.5px;margin:6px 0 12px;border-collapse:collapse">
      <tr style="border-bottom:1px solid var(--line-soft)">
        <td style="padding:3px 6px;width:130px;color:var(--text);font-weight:600">Median Elite</td>
        <td style="padding:3px 6px">90+ mph (≈ 145 km/h) cohort 50th percentile</td>
      </tr>
      <tr style="border-bottom:1px solid var(--line-soft)">
        <td style="padding:3px 6px;color:var(--text);font-weight:600">Per 1 km/h</td>
        <td style="padding:3px 6px">1 km/h 향상에 필요한 변인 변화량 (학술 Per 1 mph × 0.621)</td>
      </tr>
      <tr>
        <td style="padding:3px 6px;color:var(--text);font-weight:600">차이 (km/h)</td>
        <td style="padding:3px 6px">(본인 − Median Elite) / Per 1 km/h × 1.609 → 양수 = elite 대비 우수</td>
      </tr>
    </table>

    <b>📐 좌표계 정의 (우투 기준)</b>
    <table style="width:100%;font-size:10.5px;margin:6px 0 12px;border-collapse:collapse">
      <thead>
        <tr style="background:var(--panel2);border-bottom:1px solid var(--line)">
          <th style="text-align:left;padding:5px 6px;width:170px;color:var(--text)">변인</th>
          <th style="text-align:left;padding:5px 6px;width:80px;color:var(--text)">기준점</th>
          <th style="text-align:left;padding:5px 6px;width:140px;color:var(--text)">부호 (+/−)</th>
          <th style="text-align:left;padding:5px 6px;color:var(--text)">Elite</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom:1px solid var(--line-soft)">
          <td style="padding:4px 6px"><b>Peak Torso Counter Rot</b><br><span style="color:var(--muted)">수평면 절대 회전 (골반 상대 ❌)</span></td>
          <td style="padding:4px 6px">홈 = 0°</td>
          <td style="padding:4px 6px">+ 오른쪽 (3루) / − 왼쪽 (홈)</td>
          <td style="padding:4px 6px">≈ −38° (windup load)</td>
        </tr>
        <tr style="border-bottom:1px solid var(--line-soft)">
          <td style="padding:4px 6px"><b>Torso Forward Tilt at FP</b><br><span style="color:var(--muted)">시상면 (sagittal) 기울기</span></td>
          <td style="padding:4px 6px">수직선 = 0°</td>
          <td style="padding:4px 6px">+ 앞 (forward) / − 뒤 (back)</td>
          <td style="padding:4px 6px">≈ +4°</td>
        </tr>
        <tr style="border-bottom:1px solid var(--line-soft)">
          <td style="padding:4px 6px"><b>Torso Rotation at FP / BR</b><br><span style="color:var(--muted)">수평면 절대 회전 (lab frame)</span></td>
          <td style="padding:4px 6px">3루 = 0°<br>홈 = 90°</td>
          <td style="padding:4px 6px">+ 열림 (홈쪽 회전) / − 닫힘</td>
          <td style="padding:4px 6px">FP ≈ +2° (closed) <br>BR ≈ +111° (follow-thru)</td>
        </tr>
        <tr>
          <td style="padding:4px 6px"><b>Scap Load at FP</b><br><span style="color:var(--muted)">throwing 어깨 horizontal abd/add</span></td>
          <td style="padding:4px 6px">중립 = 0°</td>
          <td style="padding:4px 6px">+ scap retraction (cocked back) / − protraction</td>
          <td style="padding:4px 6px">≈ +51° (v5.40 부호 flip)</td>
        </tr>
      </tbody>
    </table>

    <b>📐 CoG Decel AE 정의 (Above Expected)</b>
    <div style="margin:6px 0 4px;padding:8px 10px;background:#fff;border:1px solid var(--line-soft);border-radius:5px;line-height:1.6">
      <div style="margin-bottom:4px"><b>의미</b> — 실제 CoG 감속량이 <b>구속 기반 예측치를 얼마나 초과했는지</b> 보여주는 회귀 잔차.
        구속이 빠른 투수일수록 예측 감속량도 크기 때문에, AE 는 "<b>구속과 무관하게 평가한 block + braking 효율</b>" 을 분리해서 본다.</div>
      <div style="margin-bottom:4px"><b>산출식</b> — <code>CoG Decel AE = 실제 CoG_Decel − 예측 CoG_Decel(ball_speed)</code></div>
      <div style="margin-bottom:4px"><b>예측 회귀선 (KR cohort, n = 103, <code>KR_pitching_processing.xlsx</code> 가공값)</b><br>
        <code>예측 = 0.0073 × ball_speed_kmh + 0.269</code> (m/s) · cohort 평균 ball_speed 135.5 km/h, 평균 CoG_Decel 1.26 m/s</div>
      <div style="margin-bottom:4px"><b>Cohort 잔차 분포</b> — median ≈ <b>+0.012 m/s</b>, sd = 0.133 m/s · Driveline Elite reference <b>0.02 m/s</b> (영문 sample), 0.26 m/s (sample player)</div>
      <div><b>본인</b> — 실제 ${F(cog.decel,2)} m/s − 예측 ${F(cog.decel_ae_predicted,2)} m/s = <b style="color:var(--good)">${cog.decel_ae == null ? '—' : ((cog.decel_ae >= 0 ? '+' : '') + F(cog.decel_ae, 2) + ' m/s')}</b>
        → 구속 대비 추가 감속량이 cohort sd 의 ${cog.decel_ae != null ? F(cog.decel_ae/0.133, 1) : '—'}배 (효율적 block + braking 시사)</div>
    </div>

    <details style="margin-top:14px;background:#fff;border:1px solid var(--accent);border-radius:5px;padding:8px 12px">
      <summary style="cursor:pointer;font-weight:700;color:var(--accent);font-size:12px;padding:2px 0">📖 이 표 읽는 법 — 데이터 해석 가이드 (펼치기)</summary>
      <div style="margin-top:10px;line-height:1.6;font-size:11px;color:var(--text)">

        <div style="margin-bottom:12px">
          <b style="color:var(--text);font-size:12px">① 한 행은 무엇을 의미하나?</b><br>
          하나의 메카닉 변인이 (1) 본인은 어떤 값을 보이고, (2) Driveline 90+ mph cohort 의 중간값은 얼마이며,
          (3) 그 변인이 구속에 얼마나 큰 영향을 주고, (4) 본인 위치를 km/h 단위로 환산하면 elite 대비 어디쯤인지 보여줌.
        </div>

        <div style="margin-bottom:12px">
          <b style="color:var(--text);font-size:12px">② 색상 규칙</b><br>
          <span style="display:inline-block;width:11px;height:11px;background:var(--bad);border-radius:2px;vertical-align:middle"></span>
          <b style="color:var(--bad)">붉은 변인명 + 음의 차이</b> = elite 대비 부족, <b>보완 대상</b><br>
          <span style="display:inline-block;width:11px;height:11px;background:var(--good);border-radius:2px;vertical-align:middle"></span>
          <b style="color:var(--good)">+ 양의 차이</b> = elite 대비 우수, <b>강점 영역 (유지)</b><br>
          <b style="color:var(--bad)">중요도 "높음"</b> = 구속 영향 큰 핵심 변인 (우선순위 1) ·
          <b style="color:var(--warn)">"보통"</b> · <span style="color:var(--muted)">"낮음"</span>
        </div>

        <div style="margin-bottom:12px">
          <b style="color:var(--text);font-size:12px">③ "차이 (km/h)" 의 정확한 의미</b><br>
          <code>차이 = (본인 − Median Elite) / Per 1mph × 1.609</code><br>
          <b>"이 변인 단독으로 봤을 때 elite 대비 km/h 환산 위치"</b>.
          예: CoG Decel +7.2 km/h = 본인 CoG 감속량이 elite median 보다 0.45 m/s 큼 → 학술 회귀 기울기로 환산하면 +7.2 km/h 잠재.
        </div>

        <div style="margin-bottom:12px;padding:8px 10px;background:#fff5f5;border-left:3px solid var(--bad);border-radius:3px">
          <b style="color:var(--bad);font-size:12px">⚠ ④ 흔한 오해 4가지 (반드시 주의)</b><br>
          <b>(1) 모든 행의 차이를 더하면 잠재 구속 ❌</b><br>
          같은 모델 안의 변인끼리 서로 상관 (Trunk ω 빠르면 Pelvis ω 도 빠름). 합산 = 중복 카운트.<br>
          <b>(2) 차이 (km/h) 는 인과 효과 ❌</b><br>
          상관 통계지 인과 아님. 빠른 공 → 큰 운동량 → 큰 CoG Decel 이 가능. 역인과 가능.<br>
          <b>(3) 음의 차이 = 모두 동등 보완 ❌</b><br>
          중요도 <b>높음</b> 변인부터 우선. 낮음 변인은 부수적.<br>
          <b>(4) 양의 차이 = 무시해도 됨 ❌</b><br>
          모델 점수 산정엔 +값도 반영. 강점은 유지하면서 약점만 보완해야.
        </div>

        <div style="margin-bottom:12px;padding:8px 10px;background:#dafbe1;border-left:3px solid var(--good);border-radius:3px">
          <b style="color:var(--good);font-size:12px">✅ ⑤ 올바른 사용법</b><br>
          <b>강약점 진단표</b>로 사용 — "내 메카닉 중 어느 변인이 elite 와 차이가 크고 작은가?"<br>
          <b>훈련 우선순위</b>로 사용 — 큰 음의 차이 + 중요도 높음 변인 (예: Layback −4.7 km/h) 부터 drill 처방.<br>
          <b>모델별 종합</b>은 위쪽 "5 모델 라디아 + 표" 의 점수 (0-150) 사용 — 각 모델의 모든 변인이 가중 평균돼 산출됨.<br>
          <b>잠재 구속</b>은 §1 KPI 의 "메카닉 향상 기대 구속" 사용 — 5 모델 점수 모두 150 도달 시 천장.
        </div>

        <div style="padding:8px 10px;background:var(--panel2);border-radius:3px;border-left:3px solid var(--accent)">
          <b style="color:var(--text);font-size:12px">💡 ⑥ 코칭 워크플로우 (3 단계)</b><br>
          <b>Step 1.</b> "차이 (km/h)" 컬럼 음수 + "중요도" 높음 변인을 추려냄 (보통 3–5개)<br>
          <b>Step 2.</b> 각 변인의 처방 (§3-5 메카닉 결함 Top 3 카드 참고) 을 다음 세션 menu 에 배치<br>
          <b>Step 3.</b> 3-4 주 후 재측정 → 같은 변인의 차이가 0 에 수렴 (혹은 +로) 변하면 진보. 모델 점수 (라디아) 와 잠재 구속 변동도 함께 모니터.
        </div>

      </div>
    </details>
  </div>
</div>

<!-- 3-3 분절간 ETE -->
<div class="panel">
  <h2>3-3. 분절간 ETE — Proximal-to-Distal 4 Transition <span class="badge">Aguinaldo 2007 / Naito 2008</span></h2>

  <!-- 본인 데이터로 동적 생성한 마네킹 SVG (energy flow gradient + 4 라벨) -->
  <div style="background:#fff;border:1px solid var(--line-soft);border-radius:6px;padding:8px;margin-bottom:12px">
    <div style="font-size:11px;color:var(--muted);text-align:center;margin-bottom:4px">
      <b>본인 데이터 기반 키네틱 체인 마네킹</b> — 에너지 흐름이 빨강일수록 누수 영역. 라벨은 PT lag · TA lag · 앞무릎 신전 · X-factor 실측값.
    </div>
    ${renderMannequinSvg()}
  </div>

  <!-- ETE 표 (full-width, 일반 GIF 는 §3-2 로 이동) -->
  <div style="margin-bottom:10px">
    <div>
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
    </div>
  </div>
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
    if (f.scap_load_fp_deg != null && f.scap_load_fp_deg < 30) items.push({type:'warn', txt:`⚠ <b>Scap Load 부족</b> — ${F(f.scap_load_fp_deg,0)}° (Elite +51°). 광배·후면삼각근 강화 + scap retraction throw drill`});
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
