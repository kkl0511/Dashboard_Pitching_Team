/* ╔══════════════════════════════════════════════════════════╗
   ║  8c. 리포트 출력 — 선수 개별 + 코치 종합 (v1.9)               ║
   ╚══════════════════════════════════════════════════════════╝ */

function compactPlayerCard(pid, sid){
  const p = PLAYERS.find(x=>x.id===pid); if(!p) return '';
  const m = DATA[pid][sid]; if(!m) return '';
  const e = m.energy || {};
  const eg = e.generation || {}, et = e.transfer || {}, el = e.leakage || {};
  const session = SESSIONS.find(s=>s.id===sid);
  const isReal = REAL_DATA_KEYS.has(`${pid}:${sid}`);
  const dataMark = isReal ? '● 실측' : '○ 샘플';

  // 5축 mini-radar (SVG, Chart.js 의존성 없이 인쇄 안정)
  const axes = [
    {lbl:'출력', v:eg.score ?? 0},
    {lbl:'전달', v:et.score ?? 0},
    {lbl:'누수관리', v:el.eli_score ?? 0},
    {lbl:'GRF', v:m.grf?.lhei ?? 0},
    {lbl:'결함·제구', v: avg([m.faults.fault_score, m.faults.consistency_score]) || 0}
  ];
  const cx=80, cy=70, R=55;
  const angle = i => -Math.PI/2 + (i*2*Math.PI/5);
  const point = (i, v) => {
    const r = R * (v/100);
    return [cx + r*Math.cos(angle(i)), cy + r*Math.sin(angle(i))];
  };
  const polyPts = axes.map((a,i)=>point(i, a.v).join(',')).join(' ');
  const ringPts = (frac) => axes.map((a,i)=>{
    const r = R*frac;
    return [cx + r*Math.cos(angle(i)), cy + r*Math.sin(angle(i))].join(',');
  }).join(' ');
  const labels = axes.map((a,i)=>{
    const [x,y] = point(i, 115);
    return `<text x="${x}" y="${y}" font-size="9" fill="#333" text-anchor="middle">${a.lbl}</text>`;
  }).join('');
  const radar = `<svg class="mini-radar" viewBox="0 0 220 150" xmlns="http://www.w3.org/2000/svg">
    <g>
      ${[0.2,0.4,0.6,0.8,1.0].map(f=>`<polygon points="${ringPts(f)}" fill="none" stroke="#d0d7de" stroke-width="0.5"/>`).join('')}
      ${axes.map((a,i)=>{const [x,y] = point(i, 100); return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#d0d7de" stroke-width="0.5"/>`;}).join('')}
      <polygon points="${polyPts}" fill="#0969da" fill-opacity="0.2" stroke="#0969da" stroke-width="2"/>
      ${labels}
    </g>
  </svg>`;

  // ELI 6 zone 막대
  const zoneList = el.zone1_sequence != null ? [
    {l:'시퀀스',     v:el.zone1_sequence},
    {l:'X-팩터',     v:el.zone2_x_factor},
    {l:'앞발 블록',  v:el.zone3_lead_block},
    {l:'FC 몸통',    v:el.zone4_trunk_at_fc},
    {l:'어깨 정렬',  v:el.zone5_shoulder_align},
    {l:'골반 감속',  v:el.zone6_pelvis_brake}
  ] : [];
  const zoneBars = zoneList.map(z=>{
    const c = z.v>=85?'#1a7f37':z.v>=70?'#56a64b':z.v>=55?'#bf8700':z.v>=40?'#d1452a':'#a40e26';
    return `<div class="zonebar"><span class="zlbl">${z.l}</span>
      <div class="zbar"><div style="width:${z.v}%;background:${c}"></div></div>
      <span class="zval" style="color:${c}">${z.v}</span></div>`;
  }).join('') || '<div style="font-size:10px;color:#666">GRF 데이터 없음</div>';

  // causal chains
  const causal = (el.causal_chains || []).map((c,i)=>{
    const bg = i===0 ? '#cf222e' : i===1 ? '#bf8700' : '#0969da';
    return `<div class="causal">
      <span class="num" style="background:${bg}">${i+1}</span>
      <span style="flex:1"><b>${c.defect}</b> · ${c.zone_label||c.zone}</span>
      <span style="color:#cf222e;font-weight:700">${c.impact_kmh} km/h</span>
    </div>`;
  }).join('') || '<div style="font-size:10px;color:#666">인과 분석 데이터 없음</div>';

  // 부상위험 색상
  const riskColor = m.faults.injury_risk==='high' ? '#cf222e' : m.faults.injury_risk==='mid' ? '#bf8700' : '#1a7f37';
  const riskTxt = riskLabel(m.faults.injury_risk);

  // 체력 보조
  const fit = m.fitness;
  const fitLine = fit ? `CMJ JH <b>${fit.cmj.jump_height_cm} cm</b> · IMTP PF/BM <b>${fit.imtp.peak_force_bm_n_kg} N/kg</b> · EUR <b>${fit.eur}</b> · Pogo RSI <b>${fit.pogo.rsi_ms}</b>` : '체력 측정 데이터 없음';

  return `
  <div class="pcard">
    <div class="ph">
      <div>
        <div class="nm">${p.name} <span style="font-size:11px;color:#666;font-weight:400">(${p.id})</span></div>
        <div style="font-size:11px;color:#444">${p.arm==='R'?'우투':'좌투'} · ${p.height}cm / ${p.weight}kg · BMI ${(p.weight/(p.height/100)**2).toFixed(1)}</div>
      </div>
      <div class="meta">
        <div><b>${session.label} 측정 (${session.protocol})</b> · ${m.date}</div>
        <div style="margin-top:2px">${dataMark} · 상동고등학교 야구부 · 바이오모션 베이스볼 랩</div>
      </div>
    </div>

    <div class="kpi-row">
      <div><div class="lbl">측정 구속</div><div class="val">${m.velocity.measured_kmh} <span style="font-size:11px">km/h</span></div></div>
      <div><div class="lbl">잠재 구속</div><div class="val">${m.velocity.potential_kmh} <span style="font-size:11px">km/h</span></div></div>
      <div><div class="lbl">종합점수</div><div class="val" style="color:${scoreColor(m.velocity.score)}">${m.velocity.score}</div></div>
      <div><div class="lbl">부상 위험</div><div class="val" style="color:${riskColor}">${riskTxt}</div></div>
    </div>

    <div class="row3" style="grid-template-columns:170px 1fr 1fr;align-items:start">
      <div>${radar}</div>
      <div class="mini-card">
        <div class="ttl">키네틱 시퀀스 (피크 °/s)</div>
        <div class="kv"><span>골반</span><b>${m.sequence.pelvis_dps}</b></div>
        <div class="kv"><span>몸통</span><b>${m.sequence.trunk_dps}</b></div>
        <div class="kv"><span>팔</span><b>${m.sequence.arm_dps}</b></div>
        <div class="kv" style="border-top:1px dashed #ccc;margin-top:3px;padding-top:3px"><span>Speed Gain P→T / T→A</span><b>${et.speed_gain_pt}× / ${et.speed_gain_ta}×</b></div>
      </div>
      <div class="mini-card">
        <div class="ttl">🦵 GRF (NewtForce)</div>
        <div class="kv"><span>LHEI</span><b>${fmt0(m.grf?.lhei)}</b></div>
        <div class="kv"><span>유형</span><b>${m.grf?.type || '—'}</b></div>
        <div class="kv"><span>축발 / 디딤발</span><b>${m.grf?.rear_force_pct}% / ${m.grf?.lead_force_pct}%</b></div>
      </div>
    </div>

    <div class="sec-title">⚡ 에너지 분석 — 출력·전달·누수</div>
    <div class="row3">
      <div class="mini-card">
        <div class="ttl" style="color:#0969da">① 생성 (Output) <span style="float:right">${eg.score ?? '—'}</span></div>
        <div class="kv"><span>투구 어깨 / 팔꿈치 (W)</span><b>${eg.shoulder_W ?? '—'} / ${eg.elbow_W ?? '—'}</b></div>
        <div class="kv"><span>힙 R/L (W)</span><b>${eg.hip_R_W ?? '—'} / ${eg.hip_L_W ?? '—'}</b></div>
        <div class="kv"><span>무릎 R/L (W)</span><b>${eg.knee_R_W ?? '—'} / ${eg.knee_L_W ?? '—'}</b></div>
        <div class="kv"><span>합계 (Total W)</span><b>${eg.total_W ?? '—'}</b></div>
        <div class="kv"><span>Mech E (P/T/H, J)</span><b>${eg.mech_energy_pelvis_J}/${eg.mech_energy_trunk_J}/${eg.mech_energy_humerus_J}</b></div>
      </div>
      <div class="mini-card">
        <div class="ttl" style="color:#1a7f37">② 전달 (Transfer) <span style="float:right">${et.score ?? '—'}</span></div>
        <div class="kv"><span>ETE 전달율</span><b>${et.ete_pct}%</b></div>
        <div class="kv"><span>Speed Gain P→T</span><b>${et.speed_gain_pt}×</b></div>
        <div class="kv"><span>Speed Gain T→A</span><b>${et.speed_gain_ta}×</b></div>
        <div class="kv"><span>Proper Sequence</span><b>${et.proper_seq?'정상':'결함'}</b></div>
        <div class="kv"><span>P→T / T→A lag (ms)</span><b>${et.pelvis_to_trunk_lag_ms} / ${et.trunk_to_arm_lag_ms}</b></div>
      </div>
      <div class="mini-card">
        <div class="ttl" style="color:#cf222e">③ 누수 ELI <span style="float:right">${el.eli_score ?? '—'}</span></div>
        ${zoneBars}
      </div>
    </div>

    <div class="sec-title lk">🔗 결함 → 손실 인과 (우선순위 Top 3)</div>
    ${causal}

    <div class="sec-title gr">🩹 부상위험 · 제구 일관성</div>
    <div class="mini-card">
      <div class="kv"><span>X-factor (분리각)</span><b>${m.faults.x_factor_deg}°</b></div>
      <div class="kv"><span>Lead knee (FC→BR)</span><b>${m.faults.lead_knee_change}°</b></div>
      <div class="kv"><span>Release SD / Wrist SD / Trunk tilt SD</span><b>${m.faults.release_height_sd_cm}cm / ${m.faults.wrist_pos_sd_cm}cm / ${m.faults.trunk_tilt_sd_deg}°</b></div>
      <div class="kv"><span>제구 일관성 점수</span><b style="color:${scoreColor(m.faults.consistency_score)}">${m.faults.consistency_score}</b></div>
    </div>

    <div class="footer-line">
      <span>보조 측정 — 체력 (ForceDecks): ${fitLine}</span>
      <span>v1.9 · ${new Date().toISOString().slice(0,10)}</span>
    </div>
  </div>`;
}

// 코치 리포트 (팀 종합)
function coachReport(sid){
  const session = SESSIONS.find(s=>s.id===sid);
  const meas = PLAYERS.map(p=>({p, m: DATA[p.id][sid]}));
  const total = meas.length;

  const team = {
    velo: avg(meas.map(x=>x.m.velocity.measured_kmh)),
    veloMax: Math.max(...meas.map(x=>x.m.velocity.measured_kmh)),
    veloMin: Math.min(...meas.map(x=>x.m.velocity.measured_kmh)),
    score: avg(meas.map(x=>x.m.velocity.score)),
    gen:   avg(meas.map(x=>x.m.energy?.generation?.score).filter(v=>v!=null)),
    trf:   avg(meas.map(x=>x.m.energy?.transfer?.score).filter(v=>v!=null)),
    eli:   avg(meas.map(x=>x.m.energy?.leakage?.eli_score).filter(v=>v!=null)),
    grf:   avg(meas.map(x=>x.m.grf?.lhei).filter(v=>v!=null)),
  };

  // 그룹화
  const groups = [
    {name:'⭐⭐⭐ Elite',   color:'#1a7f37', range:'85+',     test:s=>s>=85},
    {name:'⭐⭐ Solid',     color:'#56a64b', range:'70~84',   test:s=>s>=70 && s<85},
    {name:'⭐ Developing', color:'#bf8700', range:'55~69',   test:s=>s>=55 && s<70},
    {name:'발달 필요',      color:'#d1452a', range:'40~54',   test:s=>s>=40 && s<55},
    {name:'집중 관리',      color:'#a40e26', range:'<40',     test:s=>s<40}
  ];
  const grouped = groups.map(g=>{
    const list = meas.filter(x=>g.test(x.m.velocity.score)).map(x=>x.p);
    return {...g, list};
  });

  // 부상위험 알림
  const high = meas.filter(x=>x.m.faults.injury_risk==='high');
  const mid  = meas.filter(x=>x.m.faults.injury_risk==='mid');

  // 팀 결함 패턴 — ELI zone별 평균 점수, 가장 낮은 3개
  const zoneKeys = [
    {k:'zone1_sequence',       lbl:'시퀀스 어긋남',          drill:'골반→몸통→팔 순차 가속 드릴 (towel drill, walking windup)'},
    {k:'zone2_x_factor',       lbl:'X-팩터 분리 부족',       drill:'골반-상체 분리 강화 (medball rotational throw, hip-shoulder separation)'},
    {k:'zone3_lead_block',     lbl:'앞발 받쳐주기 약함',     drill:'앞발 착지 안정화 (knee extension hold, single-leg landing)'},
    {k:'zone4_trunk_at_fc',    lbl:'FC 몸통 자세 불량',      drill:'트렁크 컨트롤 (FC 시점 plank hold, trunk lateral tilt drill)'},
    {k:'zone5_shoulder_align', lbl:'어깨 정렬·외회전 부족',  drill:'어깨 가동성·정렬 (sleeper stretch, throwers ten)'},
    {k:'zone6_pelvis_brake',   lbl:'골반 감속(브레이크) 부족', drill:'골반 감속 강화 (anti-rotation hold, follow-through 안정화)'},
  ];
  const zoneAvgs = zoneKeys.map(z=>{
    const vals = meas.map(x=>x.m.energy?.leakage?.[z.k]).filter(v=>v!=null);
    return {...z, avg: avg(vals), under70: vals.filter(v=>v<70).length, n: vals.length};
  }).sort((a,b)=>a.avg-b.avg);
  const weakZones = zoneAvgs.slice(0,3);

  // 우선순위 행동
  const byPotentialGap = [...meas].map(x=>({...x, gap: x.m.velocity.potential_kmh - x.m.velocity.measured_kmh}))
    .sort((a,b)=>b.gap-a.gap).slice(0,3);
  const lowELI = [...meas].filter(x=>x.m.energy?.leakage?.eli_score!=null)
    .sort((a,b)=>a.m.energy.leakage.eli_score - b.m.energy.leakage.eli_score).slice(0,3);
  const focusList = [...meas].filter(x=>x.m.faults.injury_risk!=='low' || x.m.velocity.score<50)
    .sort((a,b)=>{
      const ra = {high:3,mid:2,low:1}[a.m.faults.injury_risk] || 1;
      const rb = {high:3,mid:2,low:1}[b.m.faults.injury_risk] || 1;
      if(rb!==ra) return rb-ra;
      return a.m.velocity.score - b.m.velocity.score;
    }).slice(0,5);

  // 부록 표 행
  const tableRows = [...meas].sort((a,b)=>b.m.velocity.score - a.m.velocity.score).map(x=>{
    const m = x.m;
    return `<tr>
      <td><b>${x.p.name}</b></td>
      <td>${x.p.arm}</td>
      <td>${m.velocity.measured_kmh}</td>
      <td>${m.velocity.potential_kmh}</td>
      <td><b style="color:${scoreColor(m.velocity.score)}">${m.velocity.score}</b></td>
      <td>${fmt0(m.energy?.generation?.score)}</td>
      <td>${fmt0(m.energy?.transfer?.score)}</td>
      <td>${fmt0(m.energy?.leakage?.eli_score)}</td>
      <td>${fmt0(m.grf?.lhei)}</td>
      <td style="color:${m.faults.injury_risk==='high'?'#cf222e':m.faults.injury_risk==='mid'?'#bf8700':'#1a7f37'}">${riskLabel(m.faults.injury_risk)}</td>
    </tr>`;
  }).join('');

  return `
  <div class="coach-rep">
    <h1>🏟 상동고등학교 야구부 투수 ${session.label} 측정 종합 리포트</h1>
    <div class="doc-meta">
      바이오모션 베이스볼 랩 (BBL) · ${session.protocol} · ${session.date} · ${session.half}<br>
      대상: 투수 ${total}명 · 발행일: ${new Date().toISOString().slice(0,10)} · 발행: 국민대학교 바이오메카닉스 연구실
    </div>

    <h2>📊 팀 평균 (헤드라인)</h2>
    <div class="grid4">
      <div class="gr-kpi"><div class="lbl">평균 측정 구속</div><div class="val">${fmt(team.velo,1)} <span style="font-size:11px">km/h</span></div><div class="sub">${fmt(team.veloMin,1)}~${fmt(team.veloMax,1)} 범위</div></div>
      <div class="gr-kpi"><div class="lbl">평균 종합점수</div><div class="val" style="color:${scoreColor(team.score)}">${fmt(team.score,1)}</div><div class="sub">출력 ${fmt(team.gen,0)} · 전달 ${fmt(team.trf,0)} · 누수관리 ${fmt(team.eli,0)}</div></div>
      <div class="gr-kpi"><div class="lbl">평균 GRF·LHEI</div><div class="val">${fmt(team.grf,1)}</div><div class="sub">하체 종합 효율</div></div>
      <div class="gr-kpi"><div class="lbl">부상위험 알림</div><div class="val" style="color:${(high.length+mid.length)>5?'#cf222e':(high.length+mid.length)>2?'#bf8700':'#1a7f37'}">${high.length + mid.length}명</div><div class="sub">High ${high.length} · Mid ${mid.length}</div></div>
    </div>

    <h2>🏆 선수 그룹 분포</h2>
    ${grouped.map(g=>`
      <div class="group-row" style="border-left-color:${g.color}">
        <span class="name" style="color:${g.color}">${g.name}</span>
        <span style="color:#666;font-size:11px">${g.range}</span>
        <span class="count">${g.list.length}명</span>
        <span class="members">${g.list.length ? g.list.map(p=>p.name).join(' · ') : '<i style="color:#999">해당 없음</i>'}</span>
      </div>
    `).join('')}

    <h2 class="warn">⚠ 부상 위험 알림</h2>
    ${high.length===0 && mid.length===0 ? '<div class="action ok">현재 high·mid 위험 선수 없음 — 정기 모니터링 유지.</div>' : ''}
    ${high.map(x=>`<div class="action warn"><b style="color:#cf222e">[High] ${x.p.name}</b> · X-factor ${x.m.faults.x_factor_deg}° · Lead knee ${x.m.faults.lead_knee_change}° · 결함 ${x.m.faults.fault_count}개 검출 → 즉시 의료진 상담 + 투구량 조절 권고</div>`).join('')}
    ${mid.map(x=>`<div class="action" style="background:#fff8c5;border-color:#d4a72c"><b style="color:#9a6700">[Mid] ${x.p.name}</b> · X-factor ${x.m.faults.x_factor_deg}° · 결함 ${x.m.faults.fault_count}개 → 메카닉 교정 우선</div>`).join('')}

    <h2>🔍 팀 결함 패턴 — 취약 ELI zone Top 3 + 그룹 훈련 추천</h2>
    ${weakZones.map((z,i)=>`
      <div class="pattern">
        <b>${i+1}. ${z.lbl}</b> · 팀 평균 점수 ${fmt(z.avg,1)} (낮을수록 누수 큼) · ${z.under70}/${z.n}명에서 70 미만<br>
        <span style="color:#666;font-size:11px">→ <b>그룹 훈련 추천:</b> ${z.drill}</span>
      </div>
    `).join('')}

    <h2 class="ok">✅ 우선순위 행동 — 코치 액션 아이템</h2>
    <div class="action ok"><b>잠재력 큼 (구속 향상 여지 가장 큰 3명)</b><br>
      ${byPotentialGap.map(x=>`${x.p.name}: 측정 ${x.m.velocity.measured_kmh} → 잠재 ${x.m.velocity.potential_kmh} (gap +${x.gap.toFixed(1)} km/h)`).join(' · ')}
      <br><span style="color:#666;font-size:11px">→ 메카닉 교정 + 체력 발달로 잠재 구속 도달 가능. 위 결함 패턴 우선 적용.</span>
    </div>
    <div class="action"><b>누수 가장 심한 3명 (ELI 낮은 순)</b><br>
      ${lowELI.map(x=>`${x.p.name} (ELI ${x.m.energy.leakage.eli_score})`).join(' · ')}
      <br><span style="color:#666;font-size:11px">→ 개별 인과 분석 카드 참고. 결함 1순위부터 단계 교정.</span>
    </div>
    ${focusList.length ? `<div class="action warn"><b>즉시 관리 필요 (${focusList.length}명)</b><br>
      ${focusList.map(x=>`${x.p.name}: 종합 ${x.m.velocity.score} · 부상위험 ${riskLabel(x.m.faults.injury_risk)}`).join(' · ')}
      <br><span style="color:#666;font-size:11px">→ 다음 ${SESSIONS.find(s=>s.id>sid)?.label || '회차'} 측정 전 1:1 면담 + 훈련 처방 권고.</span>
    </div>` : ''}

    <h2>📋 부록 — 선수별 핵심 지표 (종합점수 내림차순)</h2>
    <table>
      <thead><tr>
        <th>선수</th><th>투구</th><th>구속</th><th>잠재</th><th>종합</th>
        <th>출력</th><th>전달</th><th>누수↑</th><th>GRF</th><th>부상</th>
      </tr></thead>
      <tbody>${tableRows.replace(/누수\s*\(역ELI\)/g,'누수↑')}</tbody>
    </table>

    <div style="margin-top:14px;padding-top:8px;border-top:1px dashed #999;font-size:10px;color:#666">
      ※ 종합점수: Theia+GRF 분석 기반. 출력·전달·누수관리: ELI 6 zone 기반 0~100 정규화.
      누수↑ 컬럼은 100 - eli_score (값 클수록 누수 심각).<br>
      ※ 본 리포트는 ${session.protocol} 측정값 기반. 다음 회차(${SESSIONS.find(s=>s.id>sid)?.label||'TBD'})에서 향상도 자동 계산.
    </div>
  </div>`;
}

// 회차 셀렉트 옵션 채우기
function fillReportSessionSelects(){
  const opts = SESSIONS.map(s=>`<option value="${s.id}">${s.label} (${s.protocol} · ${s.half})</option>`).join('');
  ['rep-session-pl','rep-session-co'].forEach(id=>{
    const el = document.getElementById(id); if(el) el.innerHTML = opts;
  });
}

// 선수 체크박스 렌더
function renderPlayerChecks(){
  const wrap = document.getElementById('rep-player-checks');
  if(!wrap) return;
  wrap.innerHTML = PLAYERS.map(p=>{
    const isReal = REAL_DATA_KEYS.has(`${p.id}:1`);
    const dot = isReal ? '<span style="color:var(--accent)">●</span>' : '<span style="color:var(--muted)">○</span>';
    return `<label style="display:inline-flex;align-items:center;gap:6px;
                          padding:5px 10px;margin:3px;background:#fff;
                          border:1px solid var(--line-soft);border-radius:5px;
                          cursor:pointer;font-size:12px">
      <input type="checkbox" class="rep-pl-cb" data-pid="${p.id}" checked>
      ${dot} <b>${p.name}</b> <span style="color:var(--muted);font-size:10.5px">(${p.arm})</span>
    </label>`;
  }).join('');
  wrap.querySelectorAll('.rep-pl-cb').forEach(cb=>cb.addEventListener('change', updateRepPlCount));
  updateRepPlCount();
}
function updateRepPlCount(){
  const n = document.querySelectorAll('.rep-pl-cb:checked').length;
  const el = document.getElementById('rep-pl-count');
  if(el) el.textContent = n;
}

function renderCoachPreview(){
  const sid = parseInt(document.getElementById('rep-session-co')?.value || '1', 10);
  const wrap = document.getElementById('coach-report-preview');
  if(wrap) wrap.innerHTML = coachReport(sid);
}

// 일괄 인쇄 — 선택 선수
function printSelectedPlayers(){
  const sid = parseInt(document.getElementById('rep-session-pl').value, 10);
  const pids = [...document.querySelectorAll('.rep-pl-cb:checked')].map(cb=>cb.dataset.pid);
  if(!pids.length){ alert('선수를 1명 이상 선택하세요.'); return; }
  const area = document.getElementById('batch-print-area');
  area.innerHTML = pids.map(pid => compactPlayerCard(pid, sid)).join('');
  document.body.classList.add('printing-batch');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setTimeout(() => { window.print(); }, 500);
    });
  });
}
// 인쇄 종료 후 클래스 제거
window.addEventListener('afterprint', ()=>{
  document.body.classList.remove('printing-batch','printing-coach');
});

// 코치 리포트 인쇄 — DOM 갱신 + 차트 렌더 시간 확보 후 print
function printCoachReport(){
  const sid = parseInt(document.getElementById('rep-session-co').value, 10);
  const html = coachReport(sid);
  if(!html || html.trim().length < 50){
    alert('코치 리포트 생성 실패 — 데이터를 확인하세요.');
    return;
  }
  const area = document.getElementById('coach-print-area');
  area.innerHTML = html;
  document.body.classList.add('printing-coach');
  // 2 RAF + 500ms = 약 530ms 기다린 후 print (DOM reflow + 차트 렌더 보장)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setTimeout(() => { window.print(); }, 500);
    });
  });
}

/* ╔══════════════════════════════════════════════════════════╗
   ║  9. 초기 렌더                                                ║
   ╚══════════════════════════════════════════════════════════╝ */

// 헤더의 동적 정보(선수 수 · 1차 측정일) — SESSIONS/PLAYERS 변경 시 자동 반영
function renderHeaderDynamic(){
  document.getElementById('hdr-pcount').textContent = PLAYERS.length;
  const s1 = SESSIONS.find(s=>s.id===1);
  document.getElementById('hdr-d1').textContent = s1 ? s1.date : '—';
}

// localStorage에 저장된 게 있으면 먼저 복원 (없으면 그대로 샘플 데이터 사용)
const __loaded = loadFromStorage();
updateStorageBadge(__loaded ? 'loaded' : 'none');

renderHeaderDynamic();
renderM1KPI();
renderProgressGrid();
buildM1Table();
renderM1Heatmap();
renderM1Charts();
renderPlayerSelect();
renderPlayerView(PLAYERS[0].id);
renderScheduleHalves();   // 장기 추적 탭 들어가기 전에도 카드는 미리 렌더해두기 (가벼움)
// 복원된 실측 데이터가 있으면 헤더 데이터 상태도 갱신
if(__loaded && REAL_DATA_KEYS.size > 0){
  const realCount = REAL_DATA_KEYS.size;
  const total = PLAYERS.length * SESSIONS.length;
  const el = document.getElementById('data-status');
  el.innerHTML = `실측 ${realCount}/${total} 셀 + 샘플 ${total-realCount}`;
  el.style.color = 'var(--good)';
}

// JSON 인입 와이어업
setupJsonZone();
// CSV 인입 와이어업 (v1.16)
setupCSVZone('vald');
setupCSVZone('rapsodo');

// Rapsodo 코호트 토글 (KBO/HS) — v1.23
(function(){
  const sel = document.getElementById('rap-cohort-select');
  if(!sel) return;
  sel.value = RAP_COHORT;
  sel.addEventListener('change', e => {
    RAP_COHORT = e.target.value;
    try { localStorage.setItem('rap_cohort', RAP_COHORT); } catch(_){}
    // 선수 리포트 즉시 갱신
    const pid = document.getElementById('player-select')?.value;
    if(pid) renderPlayerView(pid);
  });
})();
document.getElementById('dl-theia-template-single')?.addEventListener('click', ()=>downloadTemplate('single'));
document.getElementById('dl-theia-template-batch')?.addEventListener('click', ()=>downloadTemplate('batch'));
document.getElementById('reset-data')?.addEventListener('click', resetToSampleData);

// 상·하반기 비교 — 지표 드롭다운
document.getElementById('hc-metric')?.addEventListener('change', renderHalfComparison);

// 리포트 출력 — 와이어업
fillReportSessionSelects();
document.getElementById('rep-pl-all')?.addEventListener('click', ()=>{
  document.querySelectorAll('.rep-pl-cb').forEach(cb=>cb.checked=true); updateRepPlCount();
});
document.getElementById('rep-pl-none')?.addEventListener('click', ()=>{
  document.querySelectorAll('.rep-pl-cb').forEach(cb=>cb.checked=false); updateRepPlCount();
});
document.getElementById('rep-pl-print')?.addEventListener('click', printSelectedPlayers);
document.getElementById('rep-co-print')?.addEventListener('click', printCoachReport);
document.getElementById('rep-session-co')?.addEventListener('change', renderCoachPreview);