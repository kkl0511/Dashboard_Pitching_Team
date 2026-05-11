// ════════════════════════════════════════════════════════
//  posture-mannequin.js — 투구 자세 마네킹 (Foot Strike pose)
//
//  Lead foot → 골반 → 몸통 → 어깨 → 팔꿈치 → 손목 → 공
//  키네틱 체인 그라디언트 + ETE leak burst + worst-segment callout.
//  LHP 자동 좌우 반전.
//
//  의존: helpers.js (WIN.segmentTransitionETE)
// ════════════════════════════════════════════════════════

function renderMannequin(p, m, dvl5){
  const segETE = WIN?.segmentTransitionETE;
  if(!segETE){
    return '<div class="empty-state"><div style="color:var(--muted);font-size:13px">자세 시각화 — 데이터 로딩 대기</div></div>';
  }
  const trans = segETE({
    peak_pelvis_v:  m.sequence?.pelvis_dps,
    peak_trunk_v:   m.sequence?.trunk_dps,
    peak_humerus_v: m.sequence?.arm_dps,
    peak_forearm_v: m.energy?.transfer?.peak_forearm_v,
    peak_hand_v:    m.sequence?.peak_hand_v ?? m.energy?.transfer?.peak_forearm_v,
    pelvis_to_trunk_lag_ms:    m.energy?.transfer?.pelvis_to_trunk_lag_ms,
    trunk_to_humerus_lag_ms:   m.energy?.transfer?.trunk_to_humerus_lag_ms ?? m.energy?.transfer?.trunk_to_arm_lag_ms,
    humerus_to_forearm_lag_ms: m.energy?.transfer?.humerus_to_forearm_lag_ms,
    forearm_to_hand_lag_ms:    m.energy?.transfer?.forearm_to_hand_lag_ms
  });
  if(!trans) return '<div class="empty-state">자세 시각화 — 데이터 부족</div>';
  const tPT = trans.pelvis_to_trunk    || {};
  const tTH = trans.trunk_to_humerus   || {};
  const tHF = trans.humerus_to_forearm || {};
  const tFH = trans.forearm_to_hand    || {};
  const segColor = s => s == null ? '#00854a' : s >= 80 ? '#00854a' : s >= 60 ? '#ca8a04' : '#e63946';
  const uid = 'm' + Math.random().toString(36).slice(2, 8);
  const isLHP = p.arm === 'L';
  // 키 포인트 (RHP 기준, viewBox 600x420)
  const K = {
    head:[295,78], rShoulder:[328,132], lShoulder:[268,132],
    rElbow:[400,132], rWrist:[400,60], ball:[398,45],
    lElbow:[200,132], lWrist:[212,215], glove:[218,228],
    pelvisR:[315,225], pelvisL:[282,225], pelvisC:[298,225], midTorso:[298,200],
    rKnee:[390,295], rAnkle:[460,362], rToe:[495,370],
    lKnee:[175,285], lAnkle:[155,360], lToe:[115,367]
  };
  const energyPath = `M ${K.lAnkle[0]} ${K.lAnkle[1]} L ${K.lKnee[0]} ${K.lKnee[1]} L ${K.pelvisL[0]} ${K.pelvisL[1]} L ${K.midTorso[0]} ${K.midTorso[1]} L ${K.rShoulder[0]} ${K.rShoulder[1]} L ${K.rElbow[0]} ${K.rElbow[1]} L ${K.rWrist[0]} ${K.rWrist[1]} L ${K.ball[0]} ${K.ball[1]}`;
  const driveLegPath = `M ${K.rAnkle[0]} ${K.rAnkle[1]} L ${K.rKnee[0]} ${K.rKnee[1]} L ${K.pelvisR[0]} ${K.pelvisR[1]} L ${K.pelvisC[0]} ${K.pelvisC[1]}`;
  // Burst circles (leak 발생 분절)
  const burstPT = (tPT.score != null && tPT.score < 60) ? `<circle cx="${K.pelvisC[0]}" cy="${K.pelvisC[1]}" r="22" fill="url(#leak-${uid})" opacity="0.75"><animate attributeName="r" values="16;28;16" dur="1.2s" repeatCount="indefinite"/></circle>` : '';
  const burstTH = (tTH.score != null && tTH.score < 60) ? `<circle cx="${(K.pelvisC[0]+K.rShoulder[0])/2}" cy="${(K.pelvisC[1]+K.rShoulder[1])/2}" r="26" fill="url(#leak-${uid})" opacity="0.75"><animate attributeName="r" values="20;32;20" dur="1.3s" repeatCount="indefinite"/></circle>` : '';
  const burstHF = (tHF.score != null && tHF.score < 80) ? `<circle cx="${K.rElbow[0]}" cy="${K.rElbow[1]}" r="24" fill="url(#leak-${uid})" opacity="${tHF.score<60?0.85:0.55}"><animate attributeName="r" values="18;28;18" dur="1.4s" repeatCount="indefinite"/></circle>` : '';
  const burstFH = (tFH.score != null && tFH.score < 80) ? `<circle cx="${(K.rWrist[0]+K.ball[0])/2}" cy="${(K.rWrist[1]+K.ball[1])/2}" r="20" fill="url(#leak-${uid})" opacity="${tFH.score<60?0.85:0.55}"><animate attributeName="r" values="14;24;14" dur="1.2s" repeatCount="indefinite"/></circle>` : '';
  // ▶ DYNAMIC: 에너지 firing 애니메이션 — 빛나는 공이 lead foot 부터 ball 까지 traveling
  // SVG path 위 stroke-dasharray + dashoffset 으로 chain 이 점차 채워지는 효과
  const fireAnim = `<path d="${energyPath}" fill="none" stroke="#fef08a" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" opacity="0.85" stroke-dasharray="40 1200" stroke-dashoffset="1200">
<animate attributeName="stroke-dashoffset" from="1200" to="0" dur="1.6s" repeatCount="indefinite"/>
<animate attributeName="opacity" values="0.4;0.95;0.4" dur="1.6s" repeatCount="indefinite"/>
</path>`;
  // ▶ Score 라벨 — 각 transition 점수를 분절 옆에 표시
  const scoreLabel = (cx, cy, label, score) => {
    if(score == null) return '';
    const c = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
    return `<g>
<rect x="${cx-26}" y="${cy-9}" width="52" height="18" rx="3" fill="rgba(20,33,61,0.95)" stroke="${c}" stroke-width="1.5"/>
<text x="${cx}" y="${cy+4}" font-size="10" font-weight="700" fill="${c}" text-anchor="middle">${label} ${Math.round(score)}</text>
</g>`;
  };
  const labels = [
    scoreLabel(K.pelvisC[0]+55, K.pelvisC[1]+24, '엉→몸', tPT.score),
    scoreLabel((K.pelvisC[0]+K.rShoulder[0])/2 + 75, (K.pelvisC[1]+K.rShoulder[1])/2 - 30, '몸→팔', tTH.score),
    scoreLabel(K.rElbow[0]+50, K.rElbow[1]+10, '팔→손목', tHF.score),
    scoreLabel((K.rWrist[0]+K.ball[0])/2 + 55, (K.rWrist[1]+K.ball[1])/2 - 5, '손→공', tFH.score),
  ].join('');
  // ▶ Worst-segment callout — 가장 큰 누출 지점 (코치 친근 언어)
  const segNames = {
    pelvis_to_trunk:    {kr:'엉덩이→몸통 힘 새는 중',  pos:[K.pelvisC[0], K.pelvisC[1]+12]},
    trunk_to_humerus:   {kr:'몸통→위팔 힘 새는 중',    pos:[(K.pelvisC[0]+K.rShoulder[0])/2, (K.pelvisC[1]+K.rShoulder[1])/2]},
    humerus_to_forearm: {kr:'팔꿈치 너무 일찍 펴짐',   pos:[K.rElbow[0], K.rElbow[1]]},
    forearm_to_hand:    {kr:'손목 채주기 부족',        pos:[(K.rWrist[0]+K.ball[0])/2, (K.rWrist[1]+K.ball[1])/2]},
  };
  const all = [
    {k:'pelvis_to_trunk', s:tPT.score},
    {k:'trunk_to_humerus', s:tTH.score},
    {k:'humerus_to_forearm', s:tHF.score},
    {k:'forearm_to_hand', s:tFH.score},
  ].filter(x => x.s != null && x.s < 80).sort((a,b)=> a.s-b.s);
  let calloutSvg = '', calloutTxt = '';
  if(all.length > 0){
    const worst = all[0];
    const info = segNames[worst.k];
    const [bx, by] = info.pos;
    // 화살표는 좌측 아래에서 leak 점으로 향하게
    const ax = 60, ay = 80;
    calloutSvg = `<g>
<line x1="${ax+5}" y1="${ay+10}" x2="${bx-15}" y2="${by-5}" stroke="#ef4444" stroke-width="2.5" stroke-dasharray="4,3" opacity="0.85"/>
<polygon points="${bx-15},${by-5} ${bx-22},${by-12} ${bx-22},${by+2}" fill="#ef4444"/>
<rect x="${ax-5}" y="${ay-2}" width="170" height="22" rx="4" fill="#ef4444"/>
<text x="${ax+80}" y="${ay+13}" font-size="12" font-weight="800" fill="#fff" text-anchor="middle">⚠ ${info.kr} (${Math.round(worst.s)}점)</text>
</g>`;
    calloutTxt = `<div style="margin-top:8px;padding:8px 12px;background:rgba(239,68,68,0.10);border-left:3px solid #ef4444;border-radius:6px;font-size:12px;color:#7f1d1d;line-height:1.5">
      <b>가장 큰 누출 지점:</b> ${info.kr} — 점수 <b>${Math.round(worst.s)}/100</b>. 선수에게 이 부분을 가리키며 "여기서 힘이 새고 있어" 로 설명 시작.
    </div>`;
  } else {
    calloutTxt = `<div style="margin-top:8px;padding:8px 12px;background:rgba(16,185,129,0.10);border-left:3px solid #10b981;border-radius:6px;font-size:12px;color:#065f46">
      ✓ 몸 전체 힘 흐름 모두 정상 (≥80점). 새는 곳 없이 잘 전달되고 있음.
    </div>`;
  }
  const svg = `<svg viewBox="0 0 600 420" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-height:380px${isLHP?';transform:scaleX(-1)':''}">
<defs>
<linearGradient id="bodyG-${uid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#1a2a47"/><stop offset="100%" stop-color="#14213d"/></linearGradient>
<linearGradient id="energy-${uid}" gradientUnits="userSpaceOnUse" x1="${K.lAnkle[0]}" y1="${K.lAnkle[1]}" x2="${K.ball[0]}" y2="${K.ball[1]}">
<stop offset="0%"  stop-color="#00854a"/>
<stop offset="35%" stop-color="${segColor(tPT.score)}"/>
<stop offset="55%" stop-color="${segColor(tTH.score)}"/>
<stop offset="80%" stop-color="${segColor(tHF.score)}"/>
<stop offset="100%" stop-color="${segColor(tFH.score)}"/>
</linearGradient>
<linearGradient id="drive-${uid}" gradientUnits="userSpaceOnUse" x1="${K.rAnkle[0]}" y1="${K.rAnkle[1]}" x2="${K.pelvisC[0]}" y2="${K.pelvisC[1]}"><stop offset="0%" stop-color="#00854a"/><stop offset="100%" stop-color="#ff6b6b"/></linearGradient>
<radialGradient id="leak-${uid}"><stop offset="0%" stop-color="#fee2e2" stop-opacity="0.95"/><stop offset="40%" stop-color="#ef4444" stop-opacity="0.75"/><stop offset="100%" stop-color="#7f1d1d" stop-opacity="0"/></radialGradient>
<radialGradient id="moundShadow-${uid}" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#000" stop-opacity="0.18"/><stop offset="100%" stop-color="#000" stop-opacity="0"/></radialGradient>
</defs>
<path d="M 580 362 Q 480 360 400 365 Q 250 372 20 370" fill="none" stroke="#d4d4d4" stroke-width="1.5" stroke-dasharray="4,4"/>
<rect x="440" y="358" width="60" height="6" rx="1" fill="#a3a3a3" opacity="0.5"/>
<ellipse cx="300" cy="378" rx="240" ry="9" fill="url(#moundShadow-${uid})"/>
<circle cx="${K.head[0]}" cy="${K.head[1]}" r="22" fill="url(#bodyG-${uid})" stroke="#1a2a47" stroke-width="1.2"/>
<line x1="292" y1="100" x2="298" y2="128" stroke="#14213d" stroke-width="13" stroke-linecap="round"/>
<path d="M ${K.lShoulder[0]} ${K.lShoulder[1]} L ${K.rShoulder[0]} ${K.rShoulder[1]} L ${K.pelvisR[0]} ${K.pelvisR[1]} L ${K.pelvisL[0]} ${K.pelvisL[1]} Z" fill="url(#bodyG-${uid})" stroke="#1a2a47" stroke-width="1.2"/>
<line x1="${K.rShoulder[0]}" y1="${K.rShoulder[1]}" x2="${K.rElbow[0]}" y2="${K.rElbow[1]}" stroke="#14213d" stroke-width="18" stroke-linecap="round"/>
<circle cx="${K.rElbow[0]}" cy="${K.rElbow[1]}" r="11" fill="#1a2a47"/>
<line x1="${K.rElbow[0]}" y1="${K.rElbow[1]}" x2="${K.rWrist[0]}" y2="${K.rWrist[1]}" stroke="#14213d" stroke-width="16" stroke-linecap="round"/>
<circle cx="${K.rWrist[0]}" cy="${K.rWrist[1]}" r="9" fill="#1a2a47"/>
<circle cx="${K.ball[0]}" cy="${K.ball[1]}" r="9" fill="#fff" stroke="#14213d" stroke-width="1.5"/>
<circle cx="${K.ball[0]+3}" cy="${K.ball[1]-3}" r="2.8" fill="#e63946"/>
<line x1="${K.lShoulder[0]}" y1="${K.lShoulder[1]}" x2="${K.lElbow[0]}" y2="${K.lElbow[1]}" stroke="#14213d" stroke-width="17" stroke-linecap="round"/>
<circle cx="${K.lElbow[0]}" cy="${K.lElbow[1]}" r="10" fill="#1a2a47"/>
<line x1="${K.lElbow[0]}" y1="${K.lElbow[1]}" x2="${K.lWrist[0]}" y2="${K.lWrist[1]}" stroke="#14213d" stroke-width="15" stroke-linecap="round"/>
<ellipse cx="${K.glove[0]}" cy="${K.glove[1]}" rx="14" ry="11" fill="#1a2a47" stroke="#0a1424" stroke-width="1.2"/>
<line x1="${K.pelvisR[0]}" y1="${K.pelvisR[1]}" x2="${K.rKnee[0]}" y2="${K.rKnee[1]}" stroke="#14213d" stroke-width="22" stroke-linecap="round"/>
<circle cx="${K.rKnee[0]}" cy="${K.rKnee[1]}" r="12" fill="#1a2a47"/>
<line x1="${K.rKnee[0]}" y1="${K.rKnee[1]}" x2="${K.rAnkle[0]}" y2="${K.rAnkle[1]}" stroke="#14213d" stroke-width="20" stroke-linecap="round"/>
<circle cx="${K.rAnkle[0]}" cy="${K.rAnkle[1]}" r="10" fill="#1a2a47"/>
<line x1="${K.rAnkle[0]}" y1="${K.rAnkle[1]}" x2="${K.rToe[0]}" y2="${K.rToe[1]}" stroke="#14213d" stroke-width="14" stroke-linecap="round"/>
<path d="M 495 372 Q 510 374 525 374" stroke="#a3a3a3" stroke-width="2.5" stroke-dasharray="2,3" fill="none" opacity="0.6"/>
<line x1="${K.pelvisL[0]}" y1="${K.pelvisL[1]}" x2="${K.lKnee[0]}" y2="${K.lKnee[1]}" stroke="#14213d" stroke-width="22" stroke-linecap="round"/>
<circle cx="${K.lKnee[0]}" cy="${K.lKnee[1]}" r="12" fill="#1a2a47"/>
<line x1="${K.lKnee[0]}" y1="${K.lKnee[1]}" x2="${K.lAnkle[0]}" y2="${K.lAnkle[1]}" stroke="#14213d" stroke-width="20" stroke-linecap="round"/>
<circle cx="${K.lAnkle[0]}" cy="${K.lAnkle[1]}" r="10" fill="#1a2a47"/>
<line x1="${K.lAnkle[0]}" y1="${K.lAnkle[1]}" x2="${K.lToe[0]}" y2="${K.lToe[1]}" stroke="#14213d" stroke-width="14" stroke-linecap="round"/>
${burstPT}${burstTH}${burstHF}${burstFH}
<path d="${energyPath}" fill="none" stroke="url(#energy-${uid})" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity="0.95"/>
<path d="${driveLegPath}" fill="none" stroke="url(#drive-${uid})" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
${fireAnim}
${labels}
${calloutSvg}
</svg>
<div style="font-size:10.5px;color:#64748b;margin-top:6px;line-height:1.5;text-align:center">
  앞발 착지 순간 (옆에서 본 모습, ${isLHP?'좌투':'우투'}) · <span style="color:#10b981">●</span> ≥80 정상 <span style="color:#f59e0b">●</span> 60-80 주의 <span style="color:#ef4444">●</span> &lt;60 힘 새는 중<br>
  <span style="color:#94a3b8">노란 빛: 힘이 발 → 골반 → 몸통 → 어깨 → 팔꿈치 → 손목 → 공으로 흐르는 모습</span>
</div>`;
  // 다크 배경에서는 흰색 카드로 감싸 X-ray 처럼 표시
  return `<div style="background:#fff;border-radius:8px;padding:14px 12px 10px;width:100%">${svg}${calloutTxt}</div>`;
}

