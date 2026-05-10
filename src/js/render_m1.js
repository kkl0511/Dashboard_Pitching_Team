/* ╔══════════════════════════════════════════════════════════╗
   ║  3. TAB 1: 1차 측정 결과                                    ║
   ╚══════════════════════════════════════════════════════════╝ */

function renderM1KPI(){
  const m1 = PLAYERS.map(p=>DATA[p.id][1]);
  // 진행: 메카닉(velocity 있음), 체력(fitness 있음), 구속(measured 있음) 셋 — 더미는 모두 채움
  const total = PLAYERS.length * 3;
  let done = 0;
  m1.forEach(m=>{
    if(m.velocity) done++;        // 메카닉
    if(m.fitness) done++;          // 체력
    if(m.velocity?.measured_kmh!=null) done++;  // 구속
  });
  document.getElementById('kpi-progress').textContent = `${done} / ${total}`;
  document.getElementById('kpi-progress-sub').textContent =
    `${PLAYERS.length}명 × {Theia+GRF, ForceDecks, Rapsodo}`;

  const velos = m1.map(m=>m.velocity.measured_kmh);
  const va = avg(velos);
  document.getElementById('kpi-velo').textContent = `${fmt(va,1)} km/h`;
  document.getElementById('kpi-velo-delta').textContent =
    `최고 ${fmt(Math.max(...velos),1)} / 최저 ${fmt(Math.min(...velos),1)}`;

  const sc = avg(m1.map(m=>m.velocity.score));
  document.getElementById('kpi-score').textContent = fmt(sc,1);
  // v5.40: 출력/전달/누수관리 → 메카닉/ETE/GRF (Driveline 5 모델 framework)
  const trfScores = m1.map(m=>m.energy?.transfer?.score).filter(x=>x!=null);
  const trf = avg(trfScores);
  const grf = avg(m1.map(m=>m.grf?.lhei).filter(x=>x!=null));
  document.getElementById('kpi-score-delta').textContent =
    `메카닉 종합 ${fmt(sc,1)} · ETE ${fmt(trf,1)} · GRF/LHEI ${fmt(grf,1)}`;

  const focus = m1.filter(m=>m.faults.injury_risk==='high'||m.faults.injury_risk==='mid'||m.velocity.score<50).length;
  const elr = document.getElementById('kpi-risk');
  elr.textContent = `${focus}명`;
  elr.style.color = focus>5?'var(--bad)':focus>2?'var(--warn)':'var(--good)';
}

function renderProgressGrid(){
  const g = document.getElementById('progress-grid');
  g.style.setProperty('--pc', PLAYERS.length);   // CSS grid 컬럼 수 동적
  let html = '<div class="row-h">데이터 종류</div>';
  PLAYERS.forEach(p=>{ html += `<div class="col-h" title="${p.name}">${p.name.replace('선수','P')}</div>`; });

  const kinds = [
    {label:'메카닉 (Theia+GRF)', test:m=>m && m.velocity},
    {label:'체력 (ForceDecks)',  test:m=>m && m.fitness},
    {label:'구속 (Rapsodo)',     test:m=>m && m.velocity?.measured_kmh!=null},
  ];
  kinds.forEach(k=>{
    html += `<div class="row-h">${k.label}</div>`;
    PLAYERS.forEach(p=>{
      const m = DATA[p.id][1];
      const ok = k.test(m);
      const isReal = REAL_DATA_KEYS.has(`${p.id}:1`);
      const cls = (ok ? 'cell done' : 'cell empty') + (isReal ? ' real-marker' : '');
      const sym = ok ? '✓' : '·';
      const tip = `${p.name} · ${k.label} · ${ok?'완료':'미입력'}${isReal?' (실측)':' (샘플)'}`;
      html += `<div class="${cls}" title="${tip}" data-pid="${p.id}">${sym}</div>`;
    });
  });
  g.innerHTML = html;
  g.querySelectorAll('.cell').forEach(c=>{
    c.addEventListener('click', ()=>switchTab('data'));
  });
}

let m1Sort = {key:'score', dir:'desc'};
function buildM1Table(){
  // v5.40: Driveline 5 모델 + ETE + GRF 점수 산출 헬퍼
  const calcMech = (m) => {
    if(!A.drivelineFiveModelDiagnosis) return null;
    const d = A.drivelineFiveModelDiagnosis({
      shoulder_er_max_deg: m.faults?.shoulder_er_max_deg, peak_shoulder_v: m.sequence?.peak_shoulder_v,
      peak_elbow_v: m.sequence?.peak_elbow_v ?? m.sequence?.elbow_dps, arm_dps: m.sequence?.arm_dps,
      shoulder_abd_fp_deg: m.faults?.shoulder_abd_fp_deg, scap_load_fp_deg: m.faults?.scap_load_fp_deg,
      elbow_flex_fp_deg: m.faults?.elbow_flex_fp_deg, x_factor: m.faults?.x_factor_deg,
      trunk_forward_tilt: m.faults?.trunk_tilt_at_fc_deg, trunk_lateral_tilt: m.faults?.trunk_lat_tilt_deg,
      torso_counter_rot_deg: m.faults?.torso_counter_rot_deg, torso_rot_fp_deg: m.faults?.torso_rot_fp_deg,
      torso_rot_br_deg: m.faults?.torso_rot_br_deg, trunk_dps: m.sequence?.trunk_dps, pelvis_dps: m.sequence?.pelvis_dps,
      lead_knee_change: m.faults?.lead_knee_change, stride_length: m.faults?.stride_length_m,
      lead_knee_ext_velo: m.faults?.lead_knee_ext_velo,
      cog_decel: m.cog?.decel, cog_decel_ae: m.cog?.decel_ae, max_cog_velo: m.cog?.max_velo
    });
    if(!d) return null;
    const scs = ['arm_action','posture','rotation','block','cog'].map(k => d[k]?.score).filter(s => s!=null);
    return scs.length ? Math.min(100, Math.round(scs.reduce((a,b)=>a+b,0)/scs.length * 100/150 * 1.5)) : null;
  };
  const calcETE = (m) => {
    if(!A.segmentTransitionETE) return null;
    const t = A.segmentTransitionETE({
      peak_pelvis_v: m.sequence?.pelvis_dps, peak_trunk_v: m.sequence?.trunk_dps,
      peak_humerus_v: m.sequence?.arm_dps, peak_forearm_v: m.energy?.transfer?.peak_forearm_v,
      peak_hand_v: m.sequence?.peak_hand_v ?? m.energy?.transfer?.peak_forearm_v,
      pelvis_to_trunk_lag_ms: m.energy?.transfer?.pelvis_to_trunk_lag_ms,
      trunk_to_humerus_lag_ms: m.energy?.transfer?.trunk_to_humerus_lag_ms ?? m.energy?.transfer?.trunk_to_arm_lag_ms,
      humerus_to_forearm_lag_ms: m.energy?.transfer?.humerus_to_forearm_lag_ms,
      forearm_to_hand_lag_ms: m.energy?.transfer?.forearm_to_hand_lag_ms
    });
    return t?.overall_score ?? null;
  };
  // 에너지 손실 Top 3 합 산출 (km/h, 큰 음의 차이)
  const calcLoss = (m) => {
    if(!A.drivelineFiveModelDiagnosis) return null;
    const d = A.drivelineFiveModelDiagnosis({
      shoulder_er_max_deg: m.faults?.shoulder_er_max_deg, peak_shoulder_v: m.sequence?.peak_shoulder_v,
      peak_elbow_v: m.sequence?.peak_elbow_v ?? m.sequence?.elbow_dps, arm_dps: m.sequence?.arm_dps,
      shoulder_abd_fp_deg: m.faults?.shoulder_abd_fp_deg, scap_load_fp_deg: m.faults?.scap_load_fp_deg,
      elbow_flex_fp_deg: m.faults?.elbow_flex_fp_deg, x_factor: m.faults?.x_factor_deg,
      trunk_forward_tilt: m.faults?.trunk_tilt_at_fc_deg, trunk_lateral_tilt: m.faults?.trunk_lat_tilt_deg,
      torso_counter_rot_deg: m.faults?.torso_counter_rot_deg, torso_rot_fp_deg: m.faults?.torso_rot_fp_deg,
      torso_rot_br_deg: m.faults?.torso_rot_br_deg, trunk_dps: m.sequence?.trunk_dps, pelvis_dps: m.sequence?.pelvis_dps,
      lead_knee_change: m.faults?.lead_knee_change, stride_length: m.faults?.stride_length_m,
      lead_knee_ext_velo: m.faults?.lead_knee_ext_velo,
      cog_decel: m.cog?.decel, cog_decel_ae: m.cog?.decel_ae, max_cog_velo: m.cog?.max_velo
    });
    if(!d) return null;
    const cands = [];
    ['arm_action','posture','rotation','block','cog'].forEach(k => {
      const md = d[k]; if(!md) return;
      Object.values(md.metrics).forEach(vv => {
        if(vv.value == null || vv.median_elite == null || !vv.per_1mph) return;
        const diff_kmh = (vv.value - vv.median_elite)/vv.per_1mph * 1.609;
        if(diff_kmh < 0 && vv.importance === 'high') cands.push(Math.abs(diff_kmh));
      });
    });
    cands.sort((a,b)=>b-a);
    const top3 = cands.slice(0,3);
    return top3.length ? Math.round(top3.reduce((a,b)=>a+b,0) * 10) / 10 : 0;
  };
  const rows = PLAYERS.map(p=>{
    const m = DATA[p.id][1];
    const fb = m.rapsodo?.fb;
    return {
      // 식별
      pid:p.id, name:p.name, arm:p.arm, grade:p.grade,
      // 구속
      velo:     fb?.velocity?.max ?? m.velocity.measured_kmh,
      velo_avg: fb?.velocity?.avg ?? null,
      // 체력
      fitness:  m.fitness?.score ?? null,
      // 메카닉 v5.40 — 5 모델 / ETE / GRF / Stuff / 손실
      mech:     calcMech(m),
      ete:      calcETE(m),
      grf:      m.grf ? Math.round(m.grf.lhei) : null,
      stuff:    fb?.stuff_score ?? null,
      loss:     calcLoss(m),
      // 제구 (통합 점수: command_composite 우선, 없으면 Rapsodo command_score)
      command:  m.faults.command_composite ?? fb?.command_score ?? null,
      // 부상
      risk:     m.faults.injury_risk,
      // 종합
      score:    m.velocity.score,
    };
  });
  const k=m1Sort.key, dir=m1Sort.dir==='asc'?1:-1;
  const riskOrder={low:1,mid:2,high:3};
  rows.sort((a,b)=>{
    let av=a[k], bv=b[k];
    if(k==='risk'){av=riskOrder[av];bv=riskOrder[bv]}
    if(av==null) return 1; if(bv==null) return -1;
    if(typeof av==='string') return dir*av.localeCompare(bv);
    return dir*(av-bv);
  });
  const tb = document.querySelector('#m1-table tbody');
  tb.innerHTML = rows.map(r=>{
    const isReal = REAL_DATA_KEYS.has(`${r.pid}:1`);
    const realDot = isReal ? ' <span title="실측 데이터" style="color:var(--accent);font-size:10px">●</span>' : '';
    // v5.40: 손실↑ — 클수록 빨강 (보완 여지 큼)
    const lossColor = r.loss==null ? 'var(--muted)' : r.loss > 8 ? 'var(--bad)' : r.loss > 4 ? 'var(--warn)' : 'var(--good)';
    return `
    <tr data-pid="${r.pid}">
      <!-- 식별 -->
      <td><b>${r.name}</b>${realDot}</td>
      <td class="right">${r.grade?`<span style="background:#ddf4ff;color:#0969da;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:600">고${r.grade}</span>`:'—'}</td>
      <td class="right">${r.arm}</td>
      <!-- 구속 -->
      <td class="right" style="background:#f0f6ff"><b>${fmt(r.velo,1)}</b></td>
      <td class="right" style="background:#f0f6ff">${fmt(r.velo_avg,1)}</td>
      <!-- 체력 -->
      <td class="right" style="background:#fff3e7"><b style="color:${scoreColor(r.fitness)}">${fmt0(r.fitness)}</b></td>
      <!-- 메카닉 v5.40: 5 모델 / ETE / GRF/LHEI / Stuff / 손실↑ -->
      <td class="right" style="background:#dafbe130"><b style="color:${scoreColor(r.mech)}">${fmt0(r.mech)}</b></td>
      <td class="right" style="background:#dafbe130"><b style="color:${scoreColor(r.ete)}">${fmt0(r.ete)}</b></td>
      <td class="right" style="background:#dafbe130"><b style="color:${scoreColor(r.grf)}">${fmt0(r.grf)}</b></td>
      <td class="right" style="background:#dafbe130"><b style="color:${scoreColor(r.stuff)}">${fmt0(r.stuff)}</b></td>
      <td class="right" style="background:#dafbe130"><b style="color:${lossColor}">${r.loss==null?'—':'-'+fmt(r.loss,1)}</b></td>
      <!-- 제구 -->
      <td class="right" style="background:#fff8c530"><b style="color:${scoreColor(r.command)}">${fmt0(r.command)}</b></td>
      <!-- 부상 -->
      <td class="right" style="background:#ffebe930">${riskPill(r.risk)}</td>
      <!-- 종합 -->
      <td class="right" style="background:#eaeef2"><b style="color:${scoreColor(r.score)};font-size:14px">${fmt0(r.score)}</b></td>
    </tr>`;
  }).join('');
  document.querySelectorAll('#m1-table thead th').forEach(th=>{
    th.classList.remove('sort-asc','sort-desc');
    if(th.dataset.key===m1Sort.key) th.classList.add(m1Sort.dir==='asc'?'sort-asc':'sort-desc');
  });
  tb.querySelectorAll('tr').forEach(tr=>{
    tr.addEventListener('click',()=>{
      switchTab('player');
      document.getElementById('player-select').value = tr.dataset.pid;
      renderPlayerView(tr.dataset.pid);
    });
  });
}
document.addEventListener('click', e=>{
  const th = e.target.closest('#m1-table thead th');
  if(!th) return;
  const k = th.dataset.key;
  if(m1Sort.key===k){m1Sort.dir = m1Sort.dir==='asc'?'desc':'asc'}
  else{m1Sort.key=k; m1Sort.dir = (k==='name'||k==='arm')?'asc':'desc'}
  buildM1Table();
});

function renderM1Heatmap(){
  // v5.40: Driveline 5 모델 framework — 구속·메카닉·ETE·GRF
  //   메카닉 종합 = 5 모델 (팔동작/자세/회전/앞다리/체중이동) 평균 점수 → 0-100 scale 변환 (×100/150 → cap 100)
  //   ETE 종합 = 분절간 4 transition (proximal-to-distal) overall_score
  const tb = document.getElementById('m1-heatmap');
  const axes = ['구속','메카닉 (5 모델)','분절간 ETE','GRF/LHEI'];
  let html = '<thead><tr><th style="text-align:left;padding-left:10px">선수</th>';
  axes.forEach(a=>{ html += `<th>${a}</th>`; });
  html += '<th>평균</th></tr></thead><tbody>';
  // v5.40 helper — 5 모델 평균 점수 산출
  function mechScore(m){
    if(!A.drivelineFiveModelDiagnosis) return null;
    const dvl5 = A.drivelineFiveModelDiagnosis({
      shoulder_er_max_deg: m.faults?.shoulder_er_max_deg,
      peak_shoulder_v: m.sequence?.peak_shoulder_v,
      peak_elbow_v:    m.sequence?.peak_elbow_v ?? m.sequence?.elbow_dps,
      arm_dps:         m.sequence?.arm_dps,
      shoulder_abd_fp_deg: m.faults?.shoulder_abd_fp_deg,
      scap_load_fp_deg:    m.faults?.scap_load_fp_deg,
      elbow_flex_fp_deg:   m.faults?.elbow_flex_fp_deg,
      x_factor:            m.faults?.x_factor_deg,
      trunk_forward_tilt:  m.faults?.trunk_tilt_at_fc_deg,
      trunk_lateral_tilt:  m.faults?.trunk_lat_tilt_deg,
      torso_counter_rot_deg: m.faults?.torso_counter_rot_deg,
      torso_rot_fp_deg:    m.faults?.torso_rot_fp_deg,
      torso_rot_br_deg:    m.faults?.torso_rot_br_deg,
      trunk_dps: m.sequence?.trunk_dps, pelvis_dps: m.sequence?.pelvis_dps,
      lead_knee_change: m.faults?.lead_knee_change,
      stride_length:    m.faults?.stride_length_m,
      lead_knee_ext_velo: m.faults?.lead_knee_ext_velo,
      cog_decel:    m.cog?.decel,
      cog_decel_ae: m.cog?.decel_ae,
      max_cog_velo: m.cog?.max_velo
    });
    if(!dvl5) return null;
    const scs = ['arm_action','posture','rotation','block','cog'].map(k => dvl5[k]?.score).filter(s => s!=null);
    if(scs.length === 0) return null;
    const avg5 = scs.reduce((a,b)=>a+b,0)/scs.length;
    // 100 scale (Driveline 100 = elite, 150 = ceiling) → 100 으로 변환
    return Math.min(100, Math.round(avg5 * 100 / 150 * 1.5));
  }
  function eteScore(m){
    if(!A.segmentTransitionETE) return null;
    const trans = A.segmentTransitionETE({
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
    return trans?.overall_score ?? null;
  }
  PLAYERS.forEach(p=>{
    const m = DATA[p.id][1];
    const isReal = REAL_DATA_KEYS.has(`${p.id}:1`);
    const realCls = isReal ? ' real-marker' : '';
    const sc = [
      m.velocity.score,
      mechScore(m),
      eteScore(m),
      m.grf ? Math.round(m.grf.lhei) : null
    ];
    const nameSuffix = isReal ? ' <span style="font-size:9px;color:var(--accent)">●</span>' : '';
    html += `<tr><td class="name" data-pid="${p.id}">${p.name} <span style="color:var(--muted);font-size:10.5px">(${p.arm})</span>${nameSuffix}</td>`;
    sc.forEach(s=>{
      if(s==null){ html += '<td class="empty">—</td>'; }
      else { html += `<td class="cell-score ${scoreClass(s)}${realCls}">${s}</td>`; }
    });
    const av = avg(sc);
    html += `<td class="cell-score ${scoreClass(av)}${realCls}">${fmt0(av)}</td></tr>`;
  });
  tb.innerHTML = html + '</tbody>';
  tb.querySelectorAll('td.name').forEach(td=>{
    td.addEventListener('click', ()=>{
      switchTab('player');
      document.getElementById('player-select').value = td.dataset.pid;
      renderPlayerView(td.dataset.pid);
    });
  });
}

let chartsM1 = {};
function renderM1Charts(){
  // v5.40: 4분면 — x = 메카닉 (5 모델 평균), y = 분절간 ETE, 점 크기 = GRF/LHEI 부족 (낮을수록 큰 점)
  if(chartsM1.q) chartsM1.q.destroy();
  // 5 모델 평균 산출 헬퍼 (renderM1Heatmap 의 mechScore 재사용 가능하도록 closure)
  const calcMech = (m) => {
    if(!A.drivelineFiveModelDiagnosis) return 0;
    const dvl5 = A.drivelineFiveModelDiagnosis({
      shoulder_er_max_deg: m.faults?.shoulder_er_max_deg, peak_shoulder_v: m.sequence?.peak_shoulder_v,
      peak_elbow_v: m.sequence?.peak_elbow_v ?? m.sequence?.elbow_dps, arm_dps: m.sequence?.arm_dps,
      shoulder_abd_fp_deg: m.faults?.shoulder_abd_fp_deg, scap_load_fp_deg: m.faults?.scap_load_fp_deg,
      elbow_flex_fp_deg: m.faults?.elbow_flex_fp_deg, x_factor: m.faults?.x_factor_deg,
      trunk_forward_tilt: m.faults?.trunk_tilt_at_fc_deg, trunk_lateral_tilt: m.faults?.trunk_lat_tilt_deg,
      torso_counter_rot_deg: m.faults?.torso_counter_rot_deg, torso_rot_fp_deg: m.faults?.torso_rot_fp_deg,
      torso_rot_br_deg: m.faults?.torso_rot_br_deg, trunk_dps: m.sequence?.trunk_dps, pelvis_dps: m.sequence?.pelvis_dps,
      lead_knee_change: m.faults?.lead_knee_change, stride_length: m.faults?.stride_length_m,
      lead_knee_ext_velo: m.faults?.lead_knee_ext_velo,
      cog_decel: m.cog?.decel, cog_decel_ae: m.cog?.decel_ae, max_cog_velo: m.cog?.max_velo
    });
    if(!dvl5) return 0;
    const scs = ['arm_action','posture','rotation','block','cog'].map(k => dvl5[k]?.score).filter(s => s!=null);
    return scs.length ? Math.min(100, Math.round(scs.reduce((a,b)=>a+b,0)/scs.length * 100/150 * 1.5)) : 0;
  };
  const calcETE = (m) => {
    if(!A.segmentTransitionETE) return 0;
    const t = A.segmentTransitionETE({
      peak_pelvis_v: m.sequence?.pelvis_dps, peak_trunk_v: m.sequence?.trunk_dps,
      peak_humerus_v: m.sequence?.arm_dps, peak_forearm_v: m.energy?.transfer?.peak_forearm_v,
      peak_hand_v: m.sequence?.peak_hand_v ?? m.energy?.transfer?.peak_forearm_v,
      pelvis_to_trunk_lag_ms: m.energy?.transfer?.pelvis_to_trunk_lag_ms,
      trunk_to_humerus_lag_ms: m.energy?.transfer?.trunk_to_humerus_lag_ms ?? m.energy?.transfer?.trunk_to_arm_lag_ms,
      humerus_to_forearm_lag_ms: m.energy?.transfer?.humerus_to_forearm_lag_ms,
      forearm_to_hand_lag_ms: m.energy?.transfer?.forearm_to_hand_lag_ms
    });
    return t?.overall_score ?? 0;
  };
  const points = PLAYERS.map(p=>{
    const m = DATA[p.id][1];
    const mech = calcMech(m);
    const ete  = calcETE(m);
    const lhei = m.grf ? Math.round(m.grf.lhei) : 100;
    return {
      x: mech, y: ete,
      label: p.name, pid: p.id, lhei,
      r: 4 + (100 - lhei) / 8   // GRF/LHEI 부족 클수록 큰 점 (4~16)
    };
  });
  const colors = points.map(p=>{
    if(p.x>=70 && p.y>=70) return '#1a7f37';        // 메카닉+ETE 모두 elite
    if(p.x>=70 && p.y<70)  return '#bf8700';        // 메카닉 OK / ETE 누수
    if(p.x<70  && p.y>=70) return '#0969da';        // ETE 좋지만 메카닉 약함
    return '#cf222e';                               // 둘 다 부족
  });
  chartsM1.q = new Chart(document.getElementById('chart-quadrant'), {
    type:'scatter',
    data:{datasets:[{
      label:'선수', data:points,
      backgroundColor: colors.map(c=>c+'cc'),
      borderColor: colors, pointRadius: points.map(p=>p.r),
      pointHoverRadius: 14
    }]},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{label:c=>{
          const p = points[c.dataIndex];
          return `${p.label} · 메카닉 ${Math.round(p.x)} · ETE ${Math.round(p.y)} · GRF/LHEI ${p.lhei}`;
        }}}
      },
      scales:{
        x:{min:20,max:100,title:{display:true,text:'메카닉 (5 모델 평균, 0~100)',color:'#656d76'},
           grid:{color:'#eaeef2'},ticks:{color:'#656d76'}},
        y:{min:20,max:100,title:{display:true,text:'분절간 ETE 종합 (0~100)',color:'#656d76'},
           grid:{color:'#eaeef2'},ticks:{color:'#656d76'}}
      },
      onClick:(evt, elems)=>{
        if(elems.length){
          const pid = points[elems[0].index].pid;
          switchTab('player');
          document.getElementById('player-select').value = pid;
          renderPlayerView(pid);
        }
      }
    }
  });

  // 구속 vs 잠재
  if(chartsM1.vp) chartsM1.vp.destroy();
  const vp = PLAYERS.map(p=>({
    x: DATA[p.id][1].velocity.measured_kmh,
    y: DATA[p.id][1].velocity.potential_kmh,
    label: p.name, pid: p.id
  }));
  const minV = Math.floor(Math.min(...vp.map(p=>Math.min(p.x,p.y)))/5)*5;
  const maxV = Math.ceil(Math.max(...vp.map(p=>Math.max(p.x,p.y)))/5)*5;
  chartsM1.vp = new Chart(document.getElementById('chart-velo-potential'), {
    type:'scatter',
    data:{datasets:[
      {label:'선수', data:vp, backgroundColor:'rgba(9,105,218,.7)', borderColor:'#0969da', pointRadius:6},
      {label:'대각선 (측정=잠재)', type:'line', data:[{x:minV,y:minV},{x:maxV,y:maxV}],
       borderColor:'#cf222e', borderDash:[5,4], pointRadius:0, showLine:true, fill:false}
    ]},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{labels:{color:'#1f2328'}},
        tooltip:{callbacks:{label:c=>{
          if(c.datasetIndex===1) return '대각선';
          const p = vp[c.dataIndex];
          return `${p.label} · 측정 ${p.x} → 잠재 ${p.y} (잔차 ${(p.y-p.x).toFixed(1)})`;
        }}}
      },
      scales:{
        x:{min:minV,max:maxV,title:{display:true,text:'측정 구속 (km/h)',color:'#656d76'},grid:{color:'#eaeef2'},ticks:{color:'#656d76'}},
        y:{min:minV,max:maxV,title:{display:true,text:'잠재 구속 (km/h)',color:'#656d76'},grid:{color:'#eaeef2'},ticks:{color:'#656d76'}}
      },
      onClick:(evt, elems)=>{
        if(elems.length && elems[0].datasetIndex===0){
          const pid = vp[elems[0].index].pid;
          switchTab('player'); document.getElementById('player-select').value = pid; renderPlayerView(pid);
        }
      }
    }
  });
}

