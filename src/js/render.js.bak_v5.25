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
  const gen = avg(m1.map(m=>m.energy?.generation?.score).filter(x=>x!=null));
  const trf = avg(m1.map(m=>m.energy?.transfer?.score).filter(x=>x!=null));
  const eli = avg(m1.map(m=>m.energy?.leakage?.eli_score).filter(x=>x!=null));
  const grf = avg(m1.map(m=>m.grf?.lhei).filter(x=>x!=null));
  document.getElementById('kpi-score-delta').textContent =
    `출력 ${fmt(gen,1)} · 전달 ${fmt(trf,1)} · 누수관리 ${fmt(eli,1)} · GRF ${fmt(grf,1)}`;

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
      // 메카닉
      gen:      m.energy?.generation?.score ?? null,
      trf:      m.energy?.transfer?.score ?? null,
      eli:      m.energy?.leakage?.eli_score ?? null,
      grf:      m.grf ? m.grf.lhei : null,
      stuff:    fb?.stuff_score ?? null,
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
    const leakDisplay = r.eli==null ? '—' : (100 - r.eli);
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
      <!-- 메카닉 -->
      <td class="right" style="background:#dafbe130"><b style="color:${scoreColor(r.gen)}">${fmt0(r.gen)}</b></td>
      <td class="right" style="background:#dafbe130"><b style="color:${scoreColor(r.trf)}">${fmt0(r.trf)}</b></td>
      <td class="right" style="background:#dafbe130"><b style="color:${r.eli==null?'var(--muted)':r.eli<55?'var(--bad)':r.eli<70?'var(--warn)':'var(--good)'}">${leakDisplay}</b></td>
      <td class="right" style="background:#dafbe130">${fmt0(r.grf)}</td>
      <td class="right" style="background:#dafbe130"><b style="color:${scoreColor(r.stuff)}">${fmt0(r.stuff)}</b></td>
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
  // 1차 5축 — 에너지 프레임워크: 구속·출력·전달·누수관리·GRF
  const tb = document.getElementById('m1-heatmap');
  const axes = ['구속','출력 (Output)','전달 (Transfer)','누수관리 (역ELI)','GRF/LHEI'];
  let html = '<thead><tr><th style="text-align:left;padding-left:10px">선수</th>';
  axes.forEach(a=>{ html += `<th>${a}</th>`; });
  html += '<th>평균</th></tr></thead><tbody>';
  PLAYERS.forEach(p=>{
    const m = DATA[p.id][1];
    const isReal = REAL_DATA_KEYS.has(`${p.id}:1`);
    const realCls = isReal ? ' real-marker' : '';
    const sc = [
      m.velocity.score,
      m.energy?.generation?.score ?? null,
      m.energy?.transfer?.score ?? null,
      m.energy?.leakage?.eli_score ?? null,
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
  // 4분면: x = 출력(generation), y = 전달(transfer), 점 크기 = 누수(역 ELI)
  if(chartsM1.q) chartsM1.q.destroy();
  const points = PLAYERS.map(p=>{
    const m = DATA[p.id][1];
    const gen = m.energy?.generation?.score ?? 0;
    const trf = m.energy?.transfer?.score ?? 0;
    const eli = m.energy?.leakage?.eli_score ?? 100;  // 데이터 없으면 누수 0
    return {
      x: gen, y: trf,
      label: p.name, pid: p.id,
      r: 4 + (100 - eli) / 8   // 누수 큰 선수일수록 큰 점 (4~16)
    };
  });
  const colors = points.map(p=>{
    if(p.x>=70 && p.y>=70) return '#1a7f37';        // 균형 elite
    if(p.x>=70 && p.y<70)  return '#bf8700';        // 출력 OK 전달 부족
    if(p.x<70  && p.y>=70) return '#0969da';        // 전달 OK 출력 부족
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
          const m = DATA[p.pid][1];
          const eli = m.energy?.leakage?.eli_score ?? '—';
          return `${p.label} · 출력 ${Math.round(p.x)} · 전달 ${Math.round(p.y)} · ELI ${eli} (누수↑ 클수록 점 큼)`;
        }}}
      },
      scales:{
        x:{min:20,max:100,title:{display:true,text:'에너지 출력 (Generation, 0~100)',color:'#656d76'},
           grid:{color:'#eaeef2'},ticks:{color:'#656d76'}},
        y:{min:20,max:100,title:{display:true,text:'에너지 전달 (Transfer, 0~100)',color:'#656d76'},
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

/* ╔══════════════════════════════════════════════════════════╗
   ║  4. TAB 2: 선수별 1차 리포트                                 ║
   ╚══════════════════════════════════════════════════════════╝ */

let chartsP = {};
function renderPlayerSelect(){
  const sel = document.getElementById('player-select');
  sel.innerHTML = PLAYERS.map(p=>`<option value="${p.id}">${p.name} (${p.arm}, ${p.height}cm)</option>`).join('');
  sel.addEventListener('change', e=>renderPlayerView(e.target.value));
  document.getElementById('btn-prev-player').addEventListener('click',()=>{
    const i = PLAYERS.findIndex(p=>p.id===sel.value);
    const ni = (i-1+PLAYERS.length)%PLAYERS.length;
    sel.value = PLAYERS[ni].id; renderPlayerView(sel.value);
  });
  document.getElementById('btn-next-player').addEventListener('click',()=>{
    const i = PLAYERS.findIndex(p=>p.id===sel.value);
    const ni = (i+1)%PLAYERS.length;
    sel.value = PLAYERS[ni].id; renderPlayerView(sel.value);
  });
  // v3.8: 현재 선수 정보 query string 전달 + 명확한 안내
  document.getElementById('btn-open-theia').addEventListener('click',()=>{
    const sel = document.getElementById('player-select');
    const pid = sel?.value || PLAYERS[0].id;
    const p = PLAYERS.find(x => x.id === pid);
    const m = DATA[pid][1];
    if(!p) { window.open('https://kkl0511.github.io/Theia_GRF_Pitching_Report/','_blank'); return; }
    // query string 전달 (Theia repo가 지원하면 prefill, 안 하면 무해)
    const params = new URLSearchParams({
      name: p.name,
      weight: p.weight,
      height: p.height,
      arm: p.arm,
      grade: p.grade || '',
      level: p.grade ? 'HS' : '',
      velocity: m?.velocity?.measured_kmh || '',
    });
    const url = `https://kkl0511.github.io/Theia_GRF_Pitching_Report/?${params.toString()}`;
    // 클립보드에 선수 정보 복사 (suggest 입력)
    const info = `${p.name} · ${p.height}cm · ${p.weight}kg · ${p.arm==='R'?'우완':'좌완'} · 평균 구속 ${m?.velocity?.measured_kmh || '—'} km/h`;
    if(navigator.clipboard) navigator.clipboard.writeText(info).catch(()=>{});
    if(confirm(`Theia+GRF 원본 리포트를 새 창으로 엽니다.\n\n현재 선수: ${info}\n\n원본 리포트는 매번 c3d.txt 업로드가 필요합니다.\n선수 정보가 클립보드에 복사되어 있어 빠르게 입력 가능.\n\n계속 진행할까요?`)) {
      window.open(url, '_blank');
    }
  });
}

function renderPlayerView(pid){
  const p = PLAYERS.find(x=>x.id===pid);
  const m = DATA[p.id][1]; // 1차

  const isReal = REAL_DATA_KEYS.has(`${p.id}:1`);
  const dataBadge = isReal
    ? `<span class="pill good" title="JSON 인입된 실측 데이터">● 실측</span>`
    : `<span class="pill warn" title="샘플 데이터 — JSON 인입 시 자동 교체">샘플</span>`;
  document.getElementById('player-meta-line').innerHTML =
    `<span><b>${p.name}</b> (${p.id}) ${dataBadge}</span>` +
    (p.grade ? `<span><b style="background:#0969da;color:#fff;padding:2px 7px;border-radius:4px;font-size:11px">고${p.grade}</b></span>` : '') +
    `<span>투구손: <b>${p.arm==='R'?'우투':'좌투'}</b></span>` +
    `<span>신장: <b>${p.height} cm</b></span>` +
    `<span>체중: <b>${p.weight} kg</b></span>` +
    `<span>BMI: <b>${(p.weight/(p.height/100)**2).toFixed(1)}</b></span>` +
    `<span>측정일: <b>${m.date}</b> <span class="protocol-tag theia">${m.protocol}</span></span>`;

  // v4.0: 5 KPI 헤더 (측정·체력·출력·전달·누수)
  // [1] 측정 구속
  document.getElementById('p-velo').textContent = `${m.velocity.measured_kmh} km/h`;
  document.getElementById('p-velo-max').textContent = `${(m.velocity.measured_kmh+1.5).toFixed(1)} km/h`;
  const veloGroupEl = document.getElementById('p-velo-group');
  if(veloGroupEl) veloGroupEl.textContent = m.velocity.velo_group ? `${m.velocity.velo_group} 그룹` : '—';

  // [2] 체력 Ceiling (Predicted Velo)
  const ceilingEl = document.getElementById('p-velo-pot');
  if(ceilingEl){
    ceilingEl.textContent = m.velocity.predicted_kmh != null ? `${m.velocity.predicted_kmh} km/h` : `${m.velocity.potential_kmh} km/h`;
    document.getElementById('p-velo-pot-delta').textContent =
      m.velocity.predicted_kmh != null ? `Predicted ${m.velocity.predicted_group} 그룹` : '잔차 —';
  }

  // [v5.13] 향상 시나리오 3종 KPI — 체력 / 메카닉 / 통합
  const A = (typeof ANALYTICS !== 'undefined') ? ANALYTICS : null;
  const measured = m.velocity?.measured_kmh;
  const mechInput = {
    pelvis_dps: m.sequence?.pelvis_dps, trunk_dps: m.sequence?.trunk_dps,
    arm_dps: m.sequence?.arm_dps, x_factor: m.faults?.x_factor_deg,
    stride_pct: m.faults?.stride_pct ?? 0.80,
    mass_kg: p.weight, height_m: p.height/100
  };
  const fitInput = {
    height_cm: p.height, weight_kg: p.weight,
    cmj_pp_bm: m.fitness?.cmj?.peak_power_bm_w_kg,
    imtp_pf_bm: m.fitness?.imtp?.peak_force_bm_n_kg,
    hop_rsi:    m.fitness?.pogo?.rsi_ms,
    grip_kg:    null    // 한국 cohort grip 데이터 부족 → default 사용
  };
  const colorByGain = g => g > 8 ? '#1a7f37' : g > 4 ? '#bc4c00' : g > 1 ? '#0969da' : '#656d76';

  // [3] 💪 체력 향상 기대 구속
  if(A?.expectedVelocityFromFitness){
    const fit = A.expectedVelocityFromFitness(fitInput, measured);
    const fitVeloEl = document.getElementById('p-fitness-velo');
    if(fitVeloEl && fit && fit.expected_velo != null){
      const c = colorByGain(fit.expected_gain);
      fitVeloEl.innerHTML = `<span style="color:${c}">${fit.expected_velo}</span> <span style="font-size:13px;color:var(--muted)">km/h</span>`;
      document.getElementById('p-fitness-detail').innerHTML =
        `실측 ${fit.measured_velo} → <b style="color:${c}">+${fit.expected_gain}</b> km/h 향상`;
    } else if(fitVeloEl){ fitVeloEl.textContent = '—'; document.getElementById('p-fitness-detail').textContent = '체력 데이터 부족'; }
  }
  // [4] ⚙️ 메카닉 향상 기대 구속 — v5.24: Driveline Mechanical Ceiling 사용
  let mechCeilGain = null;  // [5] 통합 KPI에서 재사용
  let ceilingKmh = null;
  if(A?.drivelineFiveModelDiagnosis && A?.drivelineMechanicalCeiling){
    const dvl5 = A.drivelineFiveModelDiagnosis({
      shoulder_er_max_deg: m.faults?.shoulder_er_max_deg,
      peak_shoulder_v: m.sequence?.peak_shoulder_v,
      peak_elbow_v:    m.sequence?.peak_elbow_v ?? m.sequence?.elbow_dps,
      arm_dps:         m.sequence?.arm_dps,
      x_factor:           m.faults?.x_factor_deg,
      trunk_forward_tilt: m.faults?.trunk_tilt_at_fc_deg,
      trunk_lateral_tilt: m.faults?.trunk_lat_tilt_deg,
      trunk_dps:  m.sequence?.trunk_dps,
      pelvis_dps: m.sequence?.pelvis_dps,
      lead_knee_change: m.faults?.lead_knee_change,
      stride_length:    m.faults?.stride_length_m,
      cog_decel:    m.cog?.decel,
      max_cog_velo: m.cog?.max_velo
    });
    const ceil = A.drivelineMechanicalCeiling(dvl5, measured);
    const mechVeloEl = document.getElementById('p-mech-velo');
    if(mechVeloEl && ceil && ceil.ceiling_kmh != null){
      mechCeilGain = ceil.added_kmh_potential;
      ceilingKmh = ceil.ceiling_kmh;
      const c = colorByGain(ceil.added_kmh_potential);
      mechVeloEl.innerHTML = `<span style="color:${c}">${ceil.ceiling_kmh}</span> <span style="font-size:13px;color:var(--muted)">km/h</span>`;
      document.getElementById('p-mech-detail').innerHTML =
        `현재 ${measured} → <b style="color:${c}">+${ceil.added_kmh_potential}</b> Mechanical Ceiling (Driveline)`;
    } else if(mechVeloEl){ mechVeloEl.textContent = '—'; document.getElementById('p-mech-detail').textContent = '메카닉 데이터 부족'; }
  }
  // [5] 🎯 통합 향상 기대 구속 — v5.25: 체력 + Mechanical Ceiling
  //   - 체력: OBP fitness model 향상 잠재
  //   - 메카닉: Driveline Mechanical Ceiling (5모델 → 150점 도달 잠재)
  if(A?.expectedVelocityFromFitness && measured != null){
    const fit = A.expectedVelocityFromFitness(fitInput, measured);
    const fitGain = fit?.expected_gain ?? 0;
    const meGain  = mechCeilGain ?? 0;
    const totalGain = Math.round((fitGain + meGain) * 10) / 10;
    const totalVelo = Math.round((measured + totalGain) * 10) / 10;
    const totVeloEl = document.getElementById('p-total-velo');
    if(totVeloEl){
      const c = colorByGain(totalGain);
      totVeloEl.innerHTML = `<span style="color:${c}">${totalVelo}</span> <span style="font-size:13px;color:var(--muted)">km/h</span>`;
      document.getElementById('p-total-detail').innerHTML =
        `체력 +<b>${fitGain}</b> · 메카닉 천장 +<b>${meGain}</b> · 합 <b style="color:${c}">+${totalGain}</b>`;
    }
  }
  // 호환성: 기존 hidden span에도 값 채움 (다른 코드가 참조 시 안전)
  const out = m.energy?.generation, trf = m.energy?.transfer, leak = m.energy?.leakage;

  // 보조 정보: 부상위험 + 메카닉 효율 (AE) + 종합 점수 (숨김 ID)
  const elrk = document.getElementById('p-risk');
  elrk.innerHTML = riskPill(m.faults.injury_risk);
  document.getElementById('p-risk-detail').textContent =
    `결함 ${m.faults.fault_count}개 · IMTP 비대칭 ${m.fitness?.imtp.asymmetry_pct ?? '—'}%`;
  // AE 인라인
  const aeLabelEl = document.getElementById('p-ae-label');
  if(aeLabelEl && m.velocity.ae_label){
    aeLabelEl.innerHTML = `<b>${m.velocity.ae_label}</b> (${m.velocity.ae_kmh >= 0 ? '+' : ''}${m.velocity.ae_kmh} km/h)`;
    document.getElementById('p-ae-desc').textContent = m.velocity.ae_description || '';
  }
  // 종합 (인라인)
  document.getElementById('p-score').textContent = m.velocity.score;
  document.getElementById('p-score-delta').textContent =
    `종합 ${m.velocity.score} / 메카닉 ${m.sequence.score} · 체력 ${m.fitness?.score ?? '—'} · GRF ${fmt0(m.grf?.lhei)}`;

  // v5.23: Driveline 5 모델 라디아 — Arm Action / Posture / Rotation / Block / CoG
  if(chartsP.r) chartsP.r.destroy();
  const eg = m.energy?.generation, et = m.energy?.transfer, el = m.energy?.leakage;
  // v5.23: drivelineFiveModelDiagnosis
  const dvl5 = (typeof ANALYTICS !== 'undefined' && ANALYTICS.drivelineFiveModelDiagnosis) ?
    ANALYTICS.drivelineFiveModelDiagnosis({
      // Arm Action
      shoulder_er_max_deg: m.faults?.shoulder_er_max_deg,
      peak_shoulder_v: m.sequence?.peak_shoulder_v,
      peak_elbow_v:    m.sequence?.peak_elbow_v ?? m.sequence?.elbow_dps,
      arm_dps:         m.sequence?.arm_dps,
      // Posture
      x_factor:           m.faults?.x_factor_deg,
      trunk_forward_tilt: m.faults?.trunk_tilt_at_fc_deg,
      trunk_lateral_tilt: m.faults?.trunk_lat_tilt_deg,
      // Rotation
      trunk_dps:  m.sequence?.trunk_dps,
      pelvis_dps: m.sequence?.pelvis_dps,
      // Block
      lead_knee_change: m.faults?.lead_knee_change,
      stride_length:    m.faults?.stride_length_m,
      // CoG (현재 우리 데이터 부족 — null fallback)
      cog_decel:    m.cog?.decel,
      max_cog_velo: m.cog?.max_velo
    }) : null;
  // v5.23: Driveline 5 모델 dataset
  // 본인 score (5 모델별 100=median elite, 150=ceiling)
  const myData5 = dvl5 ? [
    dvl5.arm_action?.score ?? 0,
    dvl5.posture?.score    ?? 0,
    dvl5.rotation?.score   ?? 0,
    dvl5.block?.score      ?? 0,
    dvl5.cog?.score        ?? 0
  ] : [0,0,0,0,0];
  // hover info
  const dvl5Info = dvl5 ? [
    {label:'🚀 Arm Action', sub:dvl5.arm_action?.sub, score:dvl5.arm_action?.score, rank_v:2, rank_ae:1},
    {label:'🛡 Posture',    sub:dvl5.posture?.sub,    score:dvl5.posture?.score,    rank_v:1, rank_ae:2},
    {label:'🔄 Rotation',   sub:dvl5.rotation?.sub,   score:dvl5.rotation?.score,   rank_v:4, rank_ae:3},
    {label:'🦵 Block',      sub:dvl5.block?.sub,      score:dvl5.block?.score,      rank_v:5, rank_ae:4},
    {label:'🎯 CoG',        sub:dvl5.cog?.sub,        score:dvl5.cog?.score,        rank_v:3, rank_ae:5}
  ] : [];
  chartsP.r = new Chart(document.getElementById('p-radar'),{
    type:'radar',
    data:{
      labels:['🚀 Arm Action\n(팔 동작)','🛡 Posture\n(자세)','🔄 Rotation\n(회전)','🦵 Block\n(앞발 블록)','🎯 CoG\n(무게중심)'],
      datasets:[{
        label: `본인 (Total ${dvl5?.total ?? '—'})`,
        data: myData5,
        backgroundColor:'rgba(9,105,218,.20)', borderColor:'#0969da', borderWidth:2.2, pointRadius:4,
        pointBackgroundColor:'#0969da', order: 1
      },{
        label: '🟧 고교 평균 (Median Elite 100)',
        data: [100,100,100,100,100],
        backgroundColor:'rgba(212,138,15,.04)', borderColor:'#bc8a0f', borderWidth:1.5,
        borderDash:[5,4], pointRadius:0, order: 2
      },{
        label: '⬜ MLB Ceiling (150)',
        data: [150,150,150,150,150],
        backgroundColor:'rgba(101,109,118,0)', borderColor:'#656d76', borderWidth:1.2,
        borderDash:[2,3], pointRadius:0, order: 3
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      animation:{duration:700, easing:'easeOutQuart'},
      plugins:{
        legend:{labels:{color:'#1f2328',font:{size:11.5}, usePointStyle:true, padding:12}},
        tooltip:{
          backgroundColor:'rgba(31,35,40,.95)', padding:10, cornerRadius:6,
          callbacks:{
            title: items => {
              const i = items[0].dataIndex;
              const info = dvl5Info[i];
              return info ? info.label + ' — ' + (info.sub || '') : items[0].label;
            },
            label: function(ctx){
              if(ctx.datasetIndex === 0){
                const i = ctx.dataIndex;
                const info = dvl5Info[i];
                return [
                  '본인 점수: ' + Math.round(ctx.parsed.r) + ' / 150',
                  '구속 영향력 ' + (info?.rank_v ?? '?') + '위 · AE 영향력 ' + (info?.rank_ae ?? '?') + '위',
                  '100 = Median Elite (90+ mph)',
                  '150 = Mechanical Ceiling'
                ];
              }
              return ctx.dataset.label + ': ' + Math.round(ctx.parsed.r);
            }
          }
        }
      },
      scales:{r:{
        suggestedMin: 0, suggestedMax: 150,
        grid:{color:'#eaeef2'}, angleLines:{color:'#eaeef2'},
        pointLabels:{color:'#1f2328',font:{size:11}},
        ticks:{color:'#656d76',backdropColor:'transparent',font:{size:10},stepSize:50,
               callback: v => v === 100 ? '100 (평균)' : v === 150 ? '150 (Ceiling)' : v}
      }}
    }
  });

  // 시퀀스 — v5.25: 키네틱 타이밍 시퀀스 (3 분절: 골반→몸통→팔, 손/팀평균 제거)
  // 시퀀스 품질을 lag으로 평가 → 색깔로 표시 (좋음/보통/나쁨)
  if(chartsP.s) chartsP.s.destroy();
  {
    const seq  = m.sequence;
    const trf  = m.energy?.transfer || {};
    const ptLag = trf.pelvis_to_trunk_lag_ms ?? 50;
    const taLag = trf.trunk_to_arm_lag_ms    ?? 35;
    // 피크 시각 (BR=0 기준, ms): 팔이 BR 직전(-30ms), 그 앞으로 trunk·pelvis lag
    const tArm    = -30;
    const tTrunk  = tArm  - taLag;
    const tPelvis = tTrunk - ptLag;
    // 피크 높이 — sequence dps 그대로
    const pkPelvis = seq.pelvis_dps;
    const pkTrunk  = seq.trunk_dps;
    const pkArm    = seq.arm_dps;
    // 분절별 종모양 폭 σ
    const sigmas = {pelvis: 70, trunk: 55, arm: 42};
    const gauss = (t, t0, peak, s) => peak * Math.exp(-Math.pow(t - t0, 2) / (2*s*s));
    const xs = []; for(let t = -300; t <= 50; t += 5) xs.push(t);
    const series = (t0, pk, s) => xs.map(t => gauss(t, t0, pk, s));

    // 시퀀스 품질 평가 (Driveline 표준 lag 30-60ms)
    const inRange = (v, lo, hi) => v >= lo && v <= hi;
    const ptOK = inRange(ptLag, 30, 60);
    const taOK = inRange(taLag, 25, 45);
    const okCount = (ptOK ? 1 : 0) + (taOK ? 1 : 0);
    let quality, qColor, qLabel, qBg;
    if(okCount === 2)      { quality = 'good';   qColor = '#1a7f37'; qLabel = '✅ 좋은 시퀀스';   qBg = '#dafbe1'; }
    else if(okCount === 1) { quality = 'normal'; qColor = '#bc4c00'; qLabel = '⚠️ 보통 시퀀스'; qBg = '#fff8c5'; }
    else                   { quality = 'bad';    qColor = '#cf222e'; qLabel = '❌ 시퀀스 이상'; qBg = '#ffebe9'; }

    // 분절 색상 — 품질에 따라 채도 조절 (좋음=선명, 나쁨=회색조)
    const segColors = quality === 'good'
      ? { pelvis: '#0969da', trunk: '#1a7f37', arm: '#bc4c00' }
      : quality === 'normal'
        ? { pelvis: '#0969da', trunk: '#1a7f37', arm: '#bc4c00' }
        : { pelvis: '#8b949e', trunk: '#8b949e', arm: '#cf222e' };
    const fillAlpha = quality === 'good' ? 0.20 : quality === 'normal' ? 0.15 : 0.10;
    const hex2rgba = (h, a) => {
      const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16);
      return `rgba(${r},${g},${b},${a})`;
    };

    // 품질 배지 + BR 점선 플러그인
    const overlayPlugin = {
      id: 'kineticOverlay_' + Date.now(),
      afterDatasetsDraw(chart){
        const {ctx, scales:{x, y}, chartArea} = chart;
        // BR 수직 점선
        const xPos = x.getPixelForValue(0);
        if(xPos != null && !isNaN(xPos)){
          ctx.save();
          ctx.beginPath(); ctx.setLineDash([4,4]); ctx.strokeStyle = '#cf222e'; ctx.lineWidth = 1.4;
          ctx.moveTo(xPos, y.top); ctx.lineTo(xPos, y.bottom); ctx.stroke();
          ctx.fillStyle = '#cf222e'; ctx.font = '600 11px Apple SD Gothic Neo, sans-serif';
          ctx.fillText('BR', xPos + 4, y.top + 12);
          ctx.restore();
        }
        // 품질 배지 (좌상단)
        ctx.save();
        const padX = 10, padY = 6, badgeY = chartArea.top + 6, badgeX = chartArea.left + 6;
        ctx.font = '600 11.5px Apple SD Gothic Neo, sans-serif';
        const txt = qLabel;
        const wTxt = ctx.measureText(txt).width;
        ctx.fillStyle = qBg;
        ctx.beginPath();
        if(ctx.roundRect) ctx.roundRect(badgeX, badgeY, wTxt + padX*2, 22, 5);
        else ctx.rect(badgeX, badgeY, wTxt + padX*2, 22);
        ctx.fill();
        ctx.fillStyle = qColor;
        ctx.fillText(txt, badgeX + padX, badgeY + 15);
        ctx.restore();
      }
    };

    chartsP.s = new Chart(document.getElementById('p-sequence'),{
      type:'line',
      data:{
        labels: xs,
        datasets: [
          { label:'골반', data: series(tPelvis, pkPelvis, sigmas.pelvis),
            borderColor: segColors.pelvis, backgroundColor: hex2rgba(segColors.pelvis, fillAlpha),
            fill:true, tension:0.4, pointRadius:0, borderWidth:2.4 },
          { label:'몸통', data: series(tTrunk, pkTrunk, sigmas.trunk),
            borderColor: segColors.trunk, backgroundColor: hex2rgba(segColors.trunk, fillAlpha),
            fill:true, tension:0.4, pointRadius:0, borderWidth:2.4 },
          { label:'팔',   data: series(tArm, pkArm, sigmas.arm),
            borderColor: segColors.arm, backgroundColor: hex2rgba(segColors.arm, fillAlpha),
            fill:true, tension:0.4, pointRadius:0, borderWidth:2.4 }
        ]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        animation: { duration: 900, easing: 'easeOutQuart' },
        interaction: { intersect:false, mode:'index' },
        plugins:{
          legend:{ labels:{ color:'#1f2328', font:{size:11.5}, usePointStyle:true, padding:10 } },
          tooltip:{
            intersect:false, mode:'index',
            backgroundColor:'rgba(31,35,40,.95)', titleColor:'#fff', bodyColor:'#fff',
            padding:10, cornerRadius:6,
            callbacks:{
              title: (items) => `t = ${items[0].label} ms`,
              label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(0)} °/s`
            }
          }
        },
        scales:{
          x:{ type:'linear',
              ticks:{color:'#656d76', font:{size:11}, callback: v => v + ' ms'},
              grid:{color:'#eaeef2'},
              title:{display:true, text:'시간 (ms · 릴리스=0)', color:'#656d76', font:{size:11}} },
          y:{ ticks:{color:'#656d76', font:{size:11}},
              grid:{color:'#eaeef2'}, beginAtZero:true,
              title:{display:true, text:'각속도 (°/s)', color:'#656d76', font:{size:11}} }
        }
      },
      plugins: [overlayPlugin]
    });
  }

  // ⚡ 에너지 분석 — 생성·전달·누수 (v1.8 헤드라인)
  const e = m.energy;
  if(e){
    // 생성 (Output)
    const gen = e.generation;
    document.getElementById('p-en-gen-score').innerHTML = `<span style="color:${scoreColor(gen.score)}">${fmt0(gen.score)}</span>`;
    document.getElementById('p-en-omega').textContent = `${m.sequence.pelvis_dps} / ${m.sequence.trunk_dps} / ${m.sequence.arm_dps}`;
    document.getElementById('p-en-arm-power').textContent = `${gen.shoulder_W} / ${gen.elbow_W} W`;
    document.getElementById('p-en-hip').textContent = `${gen.hip_R_W} / ${gen.hip_L_W} W`;
    document.getElementById('p-en-knee').textContent = `${gen.knee_R_W} / ${gen.knee_L_W} W`;
    document.getElementById('p-en-total-w').innerHTML = `<b>${gen.total_W} W</b>`;
    document.getElementById('p-en-mech').textContent = `${gen.mech_energy_pelvis_J} / ${gen.mech_energy_trunk_J} / ${gen.mech_energy_humerus_J} J`;

    // 전달 (Transfer) — v5.5: kinematic + kinetic ETE 결합 점수 분해 표시
    const trf = e.transfer;
    document.getElementById('p-en-trf-score').innerHTML = `<span style="color:${scoreColor(trf.score)}">${fmt0(trf.score)}</span>`;
    // v5.5: 두 측면 분해 표시 (있을 때만)
    const elKine = document.getElementById('p-en-trf-kine');
    const elKinetic = document.getElementById('p-en-trf-kinetic');
    const elRatio = document.getElementById('p-en-trf-ratio');
    if(elKine && trf.score_kinematic != null){
      elKine.innerHTML = `<span style="color:${scoreColor(trf.score_kinematic)}">${fmt0(trf.score_kinematic)}</span>`;
    } else if(elKine){ elKine.textContent = '—'; }
    if(elKinetic && trf.score_kinetic_ete != null){
      elKinetic.innerHTML = `<span style="color:${scoreColor(trf.score_kinetic_ete)}">${fmt0(trf.score_kinetic_ete)}</span>`;
    } else if(elKinetic){
      elKinetic.innerHTML = `<span style="color:var(--muted);font-size:11px">데이터 없음</span>`;
    }
    if(elRatio && trf.ratio_humerus_to_pelvis_pct != null){
      const ratio = trf.ratio_humerus_to_pelvis_pct;
      const ratioColor = ratio >= 65 ? '#1a7f37' : ratio >= 55 ? '#bc4c00' : '#cf222e';
      elRatio.innerHTML = `<b style="color:${ratioColor}">${ratio.toFixed(1)}%</b>`;
    } else if(elRatio){
      elRatio.innerHTML = `<span style="color:var(--muted);font-size:11px">—</span>`;
    }
    document.getElementById('p-en-ete').innerHTML = `<b>${trf.ete_pct}%</b>`;
    document.getElementById('p-en-sg-pt').textContent = `${trf.speed_gain_pt}×`;
    document.getElementById('p-en-sg-ta').textContent = `${trf.speed_gain_ta}×`;
    document.getElementById('p-en-proper').innerHTML = trf.proper_seq
      ? '<span class="pill good">정상</span>' : '<span class="pill bad">결함</span>';
    document.getElementById('p-en-lag-pt').textContent = `${trf.pelvis_to_trunk_lag_ms} ms`;
    document.getElementById('p-en-lag-ta').textContent = `${trf.trunk_to_arm_lag_ms} ms`;

    // 누수 (Leakage / ELI)
    const leak = e.leakage;
    if(leak){
      document.getElementById('p-en-eli-score').innerHTML = `<span style="color:${scoreColor(leak.eli_score)}">${fmt0(leak.eli_score)}</span>`;
      const zones = [
        {key:'zone1', label:'시퀀스',         val: leak.zone1_sequence},
        {key:'zone2', label:'X-팩터 분리',    val: leak.zone2_x_factor},
        {key:'zone3', label:'앞발 블로킹',    val: leak.zone3_lead_block},
        {key:'zone4', label:'FC 몸통자세',    val: leak.zone4_trunk_at_fc},
        {key:'zone5', label:'어깨 정렬',      val: leak.zone5_shoulder_align},
        {key:'zone6', label:'골반 감속',      val: leak.zone6_pelvis_brake},
      ];
      document.getElementById('p-eli-zones').innerHTML = zones.map(z=>{
        const c = z.val>=85?'#1a7f37':z.val>=70?'#56a64b':z.val>=55?'#bf8700':z.val>=40?'#d1452a':'#a40e26';
        return `<div style="display:flex;align-items:center;gap:8px;margin:5px 0;font-size:11.5px">
          <span style="flex:0 0 95px;color:var(--text-soft)">${z.label}</span>
          <div style="flex:1;height:8px;background:var(--line-soft);border-radius:4px;overflow:hidden;position:relative">
            <div style="height:100%;width:${z.val}%;background:${c}"></div>
          </div>
          <span style="flex:0 0 32px;text-align:right;font-weight:600;color:${c}">${z.val}</span>
        </div>`;
      }).join('');

      // 인과 분석 — top 3 (v3.8-3 fault_images + v4.0 Per 1 km/h)
      const cw = document.getElementById('p-causal-chains');
      if(leak.causal_chains && leak.causal_chains.length){
        // v4.0: zone → 변수 매핑 + Per 1 km/h 자동 산출
        const zoneToVar = {
          zone1:{key:'pelvis_to_trunk', cur:m.energy?.transfer?.pelvis_to_trunk_lag_ms, target:40, unit:'ms', per:'15ms'},
          zone2:{key:'x_factor', cur:m.faults.x_factor_deg, target:38, unit:'°', per:'5°'},
          zone3:{key:'lead_knee', cur:m.faults.lead_knee_change, target:5, unit:'°', per:'5°'},
          zone4:{key:'trunk_lat', cur:m.faults.trunk_tilt_sd_deg, target:15, unit:'°', per:'7°'},
          zone5:{key:'shoulder_er', cur:175, target:175, unit:'°', per:'10°'},
          zone6:{key:'pelvis_brake', cur:'—', target:'—', unit:'', per:'—'}
        };
        cw.innerHTML = leak.causal_chains.map((c,i)=>{
          const z = zoneToVar[c.zone];
          const per1 = z ? `<span style="font-size:10px;color:var(--muted)" title="이 변수 ${z.per} 변화 = +1 km/h">| Per 1 km/h: ${z.per} 변화</span>` : '';
          return `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;
                      background:#fff;border:1px solid var(--line-soft);border-radius:5px;margin-bottom:6px">
            <span style="flex:0 0 22px;height:22px;background:${i===0?'#cf222e':i===1?'#bf8700':'#0969da'};
                         color:#fff;border-radius:50%;text-align:center;font-weight:700;
                         line-height:22px;font-size:11px">${i+1}</span>
            ${c.image ? `<img src="assets/fault_images/${c.image}" alt="${c.defect}"
                 style="flex:0 0 50px;height:50px;object-fit:contain;border-radius:4px;
                        border:1px solid var(--line-soft);background:#fafbfc"
                 title="결함 시각 — ${c.defect}">` : ''}
            <span style="flex:1;font-size:12.5px"><b>${c.defect}</b>
              <span style="color:var(--muted);font-size:11px"> → ${c.zone_label || c.zone}</span>
              ${per1 ? '<br>'+per1 : ''}
            </span>
            <span class="pill bad" style="flex:0 0 auto">손실 ${c.impact_kmh} km/h</span>
          </div>`;
        }).join('');
      } else {
        cw.innerHTML = '<div style="color:var(--muted);font-size:12px">인과 분석 데이터 없음</div>';
      }
    } else {
      document.getElementById('p-en-eli-score').textContent = '—';
      document.getElementById('p-eli-zones').innerHTML =
        '<div style="color:var(--muted);font-size:12px;padding:8px 0">GRF 데이터 없음 (Uplift 회차)</div>';
      document.getElementById('p-causal-chains').innerHTML =
        '<div style="color:var(--muted);font-size:12px">GRF 기반 인과 분석 미가용</div>';
    }
  }

  // (호환) 기존 ID도 채워둠 — 다른 곳에서 참조 시 안전
  document.getElementById('p-pelvis').textContent = m.sequence.pelvis_dps;
  document.getElementById('p-trunk').textContent = m.sequence.trunk_dps;
  document.getElementById('p-arm').textContent = m.sequence.arm_dps;
  document.getElementById('p-ete').textContent = m.sequence.ete_pct + '%';
  document.getElementById('p-sg').textContent = m.sequence.speed_gain + '×';
  document.getElementById('p-seq-binary').textContent = m.sequence.proper_seq ? '정상' : '결함';

  // v4.1: GRF — Rear는 출력 카드, Lead·LHEI·CoG_Decel은 전달 카드 (UI 재배치)
  if(m.grf){
    const lheiEl = document.getElementById('p-lhei');
    if(lheiEl) lheiEl.innerHTML = `<span style="color:${scoreColor(m.grf.lhei)}">${fmt0(m.grf.lhei)}</span>`;
    const typeEl = document.getElementById('p-grf-type');
    if(typeEl) typeEl.textContent = m.grf.type;
    const rearEl = document.getElementById('p-rear');
    if(rearEl) rearEl.textContent = m.grf.rear_force_pct + '%';
    const leadEl = document.getElementById('p-lead');
    if(leadEl) leadEl.textContent = m.grf.lead_force_pct + '%';
    // v4.1 신규: CoG_Decel (BBL v33.22 핵심 변수, 18명 데이터 reference)
    const cogEl = document.getElementById('p-cog-decel');
    if(cogEl){
      // 샘플 데이터에는 cog_decel 없으니 추정 (향후 실측 시 m.grf.cog_decel 사용)
      const cog = m.grf.cog_decel ?? (1.1 + (m.grf.lhei || 50) / 100 * 0.5);
      cogEl.textContent = cog.toFixed(2) + ' m/s';
    }
  }

  document.getElementById('p-xf').textContent = m.faults.x_factor_deg + '°';
  document.getElementById('p-lk').textContent = m.faults.lead_knee_change + '°';
  document.getElementById('p-rh-sd').textContent = m.faults.release_height_sd_cm + ' cm';
  document.getElementById('p-wp-sd').textContent = m.faults.wrist_pos_sd_cm + ' cm';
  document.getElementById('p-tt-sd').textContent = m.faults.trunk_tilt_sd_deg + '°';
  // v3.0-B: 제구 통합 점수
  const cc = m.faults.command_composite;
  const ccEl = document.getElementById('p-cmd-cmp');
  if(ccEl){
    if(cc != null){
      ccEl.innerHTML = `<span style="color:${scoreColor(cc)};font-weight:700;font-size:16px">${cc}</span> / 100`;
      const tScore = m.faults.command_theia, rScore = m.faults.command_rapsodo;
      document.getElementById('p-cmd-detail').textContent =
        `Theia ${tScore != null ? tScore : '—'} · Rapsodo ${rScore != null ? rScore : '—'}`;
      const warns = m.faults.command_warnings || [];
      document.getElementById('p-cmd-warnings').innerHTML = warns.length
        ? warns.map(w => `⚠️ ${w}`).join('<br>') : '';
    } else {
      ccEl.textContent = '—';
      document.getElementById('p-cmd-detail').textContent = '—';
      document.getElementById('p-cmd-warnings').innerHTML = '';
    }
  }

  // 🎯 Rapsodo 패스트볼 분석
  renderRapsodoFB(m.rapsodo, p);

  // 체력 4 카드 (보조)
  // v4.0 [5]: 자동 진단 카드 (체력 한계 vs 메카닉 비효율)
  renderOutcomeDiagnosis(m, p);
  // v4.2: HP Assessment 체력 카드 (Velo Group 분포)
  renderHPAssessment(m, p);
  // v3.5-4: 3-tier 코호트 overlay (한국 elite + College + MLB)
  renderTierOverlay(m, p);
  renderFitnessCards(m.fitness);

  // v5.14: 새 흐름 — 체력 카드 DOM 이동 + 메카닉 보강 표/카드
  v514_moveFitnessCards();
  v514_renderMechanicTables(m, p);
  v514_renderActionPlan(m, p);
  v514_renderSummaryAction(m, p);
  // v5.16: 체력 6각 라디아 + raw 표
  v516_renderFitnessHexRadar(m, p);
}

/* ╔══════════════════════════════════════════════════════════╗
   ║  v5.14: 새 5섹션 흐름 — 체력 이동 + 메카닉 보강           ║
   ╚══════════════════════════════════════════════════════════╝ */
function v514_moveFitnessCards(){
  // 체력 카드들을 § 2 체력 자리(section-fitness-cards)로 이동
  // v5.16: card-hp-ridge도 함께 (분석가용 details)
  const target = document.getElementById('section-fitness-cards');
  const cards = ['card-hp-assessment','card-fitness-raw','card-hp-ridge'];
  if(!target) return;
  for(const id of cards){
    const c = document.getElementById(id);
    if(c && c.parentElement?.id === 'hidden-fitness-source'){
      target.appendChild(c);   // hidden source → 체력 섹션 자리
    }
  }
}

/* v5.17: 체력 6축 라디아 (구속 핵심 4 + 제구 1 + 부상 1) + hover 효과 + 17 변인 details */
let chartFitnessRadar = null;
function v516_renderFitnessHexRadar(m, p){
  // v5.25: Driveline HP Assessment 6축 framework로 전환
  // 6축: Strength / Relative Strength / Power / Relative Power / Reactive Strength / Upper Body Power
  // 각 축 100 = HS group 평균, 본인 score는 변인별 raw value / hs_avg × 100
  if(typeof ANALYTICS === 'undefined' || !ANALYTICS.drivelineHPDiagnosis) return;
  const fit = m.fitness;
  if(!fit){
    const wrap = document.getElementById('p-fitness-summary');
    if(wrap) wrap.innerHTML = '<span style="color:var(--muted)">체력 데이터 미입력</span>';
    return;
  }
  // Driveline HP 6 변인 추출 (DRIVELINE_HP_6_MODELS의 metric_key와 매칭)
  const hpInput = {
    imtp_npf:        fit.imtp?.peak_force_n,
    imtp_pf_bm:      fit.imtp?.peak_force_bm_n_kg,
    sj_pp_bm:        fit.sj?.peak_power_bm_w_kg,
    cmj_pp_bm:       fit.cmj?.peak_power_bm_w_kg,
    pogo_rsi:        fit.pogo?.rsi_ms,
    plyo_push_up_pf: fit.pp?.peak_takeoff_force_n   // 미측정 — undefined 허용
  };
  const dx = ANALYTICS.drivelineHPDiagnosis(hpInput);
  if(!dx) return;

  // 6 축 순서 (Driveline HP 표준)
  const axisOrder = ['strength','rel_strength','power','rel_power','reactive','upper_power'];
  const labels = axisOrder.map(k => `${dx[k].label_kr}\n(${dx[k].label})`);
  // 미측정 축은 0 대신 null로 표시 (radar에 빈 칸)
  const myData = axisOrder.map(k => dx[k].not_measured ? 0 : (dx[k].score ?? 0));
  // hover에 표시할 raw 데이터
  const hoverInfo = axisOrder.map(k => ({
    score: dx[k].score, value: dx[k].value, unit: dx[k].unit,
    sub: dx[k].sub, hs_avg: dx[k].hs_avg,
    velo_group: dx[k].velo_group, refs: dx[k].velo_group_refs,
    not_measured: dx[k].not_measured
  }));
  // Reference rings: HS 평균(100) + 90+ mph cohort 목표
  const hsAvgRef = axisOrder.map(_ => 100);
  const elitemphRef = axisOrder.map(k => {
    const refs = dx[k].velo_group_refs;
    const hsAvg = dx[k].hs_avg;
    if(!refs || !hsAvg) return 130;
    return Math.round((refs['90+'] / hsAvg) * 100);
  });

  const canvas = document.getElementById('p-fitness-radar');
  if(!canvas) return;
  if(chartFitnessRadar) chartFitnessRadar.destroy();
  chartFitnessRadar = new Chart(canvas, {
    type: 'radar',
    data: {
      labels: labels,
      datasets: [
        { label: `${p.name} (HP Composite ${dx.overall_score ?? '—'})`,
          data: myData,
          backgroundColor: 'rgba(188,76,0,.20)', borderColor: '#bc4c00', borderWidth: 2.4,
          pointBackgroundColor: '#bc4c00', pointRadius: 4, order: 1 },
        { label: '⬜ HS 평균 (100)', data: hsAvgRef,
          backgroundColor: 'rgba(101,109,118,.04)', borderColor: '#656d76', borderWidth: 1.4,
          borderDash: [4,3], pointRadius: 0, order: 2 },
        { label: '🟦 90+ mph cohort 목표', data: elitemphRef,
          backgroundColor: 'rgba(9,105,218,.04)', borderColor: '#0969da', borderWidth: 1.5,
          borderDash: [6,4], pointRadius: 0, order: 3 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 700 },
      plugins: {
        legend: { position: 'top', labels: { font: { size: 11 }, usePointStyle: true, padding: 10 } },
        tooltip: {
          callbacks: {
            title: items => labels[items[0].dataIndex].replace('\n', ' '),
            label: ctx => {
              if(ctx.datasetIndex !== 0) return ctx.dataset.label + ': ' + Math.round(ctx.parsed.r);
              const info = hoverInfo[ctx.dataIndex];
              if(info.not_measured) return ['미측정 (Plyo Push-up 측정 추가 시 자동 채워짐)'];
              const fmtV = v => v == null ? '—' : (typeof v === 'number' ? (v >= 1000 ? Math.round(v) : v.toFixed(2)) : v);
              return [
                '본인: ' + fmtV(info.value) + ' ' + info.unit + '  (HP 점수 ' + (info.score ?? '—') + ')',
                'HS 평균: ' + fmtV(info.hs_avg) + ' ' + info.unit + ' = 100점',
                '본인 위치: ' + (info.velo_group ?? '—') + ' mph cohort',
                'cohort 평균: <80=' + fmtV(info.refs['<80']) + ', 80-85=' + fmtV(info.refs['80-85']) + ', 85-90=' + fmtV(info.refs['85-90']) + ', 90+=' + fmtV(info.refs['90+'])
              ];
            }
          }
        }
      },
      scales: { r: { min: 0, max: 200, ticks: { stepSize: 50, color: '#656d76', font: { size: 10 }, backdropColor: 'transparent',
                       callback: v => v === 100 ? '100 (평균)' : v === 200 ? '200' : v },
                     grid: { color: '#eaeef2' }, angleLines: { color: '#eaeef2' },
                     pointLabels: { color: '#1f2328', font: { size: 10 } } } }
    }
  });

  // HP Composite 요약 + Velo Group + 강약점
  const summaryEl = document.getElementById('p-fitness-summary');
  if(summaryEl){
    // 강점/약점 (미측정 제외)
    const measuredAxes = axisOrder.filter(k => !dx[k].not_measured && dx[k].score != null);
    const sortedAxes = measuredAxes.slice().sort((a,b) => dx[b].score - dx[a].score);
    const top = sortedAxes[0], bottom = sortedAxes[sortedAxes.length-1];
    // 본인이 가장 자주 속한 velo group (mode)
    const vgs = measuredAxes.map(k => dx[k].velo_group).filter(Boolean);
    const vgCount = {}; vgs.forEach(v => vgCount[v] = (vgCount[v]||0) + 1);
    const dominantVG = Object.entries(vgCount).sort((a,b) => b[1] - a[1])[0]?.[0];

    let html = `<div style="background:#f6f8fa;padding:10px 12px;border-radius:6px;margin-bottom:10px">`;
    html += `<div style="font-size:12px;color:var(--muted);margin-bottom:4px">HP Composite Score</div>`;
    html += `<div style="font-size:24px;font-weight:600;color:#bc4c00">${dx.overall_score ?? '—'}<span style="font-size:13px;color:var(--muted)"> / 100 (HS 평균)</span></div>`;
    if(dominantVG) html += `<div style="font-size:11px;color:var(--muted);margin-top:4px">체력 수준 ≈ <b style="color:#0969da">${dominantVG} mph cohort</b></div>`;
    html += `</div>`;
    if(top) html += `<div style="background:#f0fff4;border-left:3px solid #1a7f37;padding:8px 10px;border-radius:4px;margin-bottom:6px">
      <div style="font-size:11px;color:var(--muted)">▲ 강점</div>
      <div style="font-size:13px;font-weight:600;color:#1a7f37">${dx[top].label_kr} (${dx[top].score}점)</div></div>`;
    if(bottom && bottom !== top) html += `<div style="background:#fff5f5;border-left:3px solid #cf222e;padding:8px 10px;border-radius:4px">
      <div style="font-size:11px;color:var(--muted)">▼ 약점</div>
      <div style="font-size:13px;font-weight:600;color:#cf222e">${dx[bottom].label_kr} (${dx[bottom].score}점)</div></div>`;
    summaryEl.innerHTML = html;
  }

  // v5.25: Velo Group cohort 비교표 (Driveline HP, 분석가용)
  const cohortBody = document.getElementById('p-hp-cohort-body');
  if(cohortBody){
    const fmtV = (v, unit) => {
      if(v == null) return '<span style="color:var(--muted)">—</span>';
      if(typeof v !== 'number') return v;
      if(unit === 'm/s' || unit === 'W/kg' || unit === 'N/kg') return v.toFixed(2);
      return Math.round(v).toString();
    };
    const colorScore = s => s == null ? '#656d76' : s >= 130 ? '#1a7f37' : s >= 100 ? '#0969da' : s >= 75 ? '#bc4c00' : '#cf222e';
    cohortBody.innerHTML = axisOrder.map(k => {
      const a = dx[k];
      const myCellColor = a.not_measured ? 'var(--muted)' : '#1f2328';
      return `<tr style="border-bottom:1px solid #f0f3f6">
        <td style="padding:6px;font-weight:500">${a.label_kr}<br><span style="font-size:10px;color:var(--muted)">${a.label}</span></td>
        <td style="text-align:right;padding:6px;font-weight:600;color:${myCellColor}">${a.not_measured ? '미측정' : fmtV(a.value, a.unit)} <span style="color:var(--muted);font-size:10px">${a.unit}</span></td>
        <td style="text-align:right;padding:6px;background:#f0f3f6">${fmtV(a.hs_avg, a.unit)}</td>
        <td style="text-align:right;padding:6px;color:var(--muted)">${fmtV(a.velo_group_refs['<80'], a.unit)}</td>
        <td style="text-align:right;padding:6px;color:var(--muted)">${fmtV(a.velo_group_refs['80-85'], a.unit)}</td>
        <td style="text-align:right;padding:6px;color:var(--muted)">${fmtV(a.velo_group_refs['85-90'], a.unit)}</td>
        <td style="text-align:right;padding:6px;background:#ddf4ff;font-weight:500">${fmtV(a.velo_group_refs['90+'], a.unit)}</td>
        <td style="text-align:right;padding:6px;color:${colorScore(a.score)};font-weight:600">${a.not_measured ? '—' : (a.score ?? '—')}</td>
      </tr>`;
    }).join('');
  }

  // v5.25: Asymmetry 별도 카드 (Driveline 패턴 — 좌우 균형 ±15% 임계)
  const asymBars = document.getElementById('p-asym-bars');
  const asymBadge = document.getElementById('p-asym-badge');
  if(asymBars){
    const asyms = [
      { label: 'IMTP (다리 좌우 힘 차이)', val: fit.imtp?.asymmetry_pct },
      { label: 'CMJ Concentric Impulse', val: fit.cmj?.asymmetry_pct },
      { label: 'Plyo Push Up (상체 좌우)', val: fit.pp?.asymmetry_pct }
    ];
    const measured = asyms.filter(a => a.val != null);
    const maxAbs = measured.length > 0 ? Math.max(...measured.map(a => Math.abs(a.val))) : null;
    if(asymBadge){
      if(maxAbs == null) asymBadge.innerHTML = '<span style="color:var(--muted)">측정 데이터 없음</span>';
      else if(maxAbs >= 15) asymBadge.innerHTML = `<span style="color:#cf222e">⚠ 임계 초과 (max ${maxAbs.toFixed(1)}%)</span>`;
      else if(maxAbs >= 10) asymBadge.innerHTML = `<span style="color:#bc4c00">주의 (max ${maxAbs.toFixed(1)}%)</span>`;
      else asymBadge.innerHTML = `<span style="color:#1a7f37">✅ 균형 양호 (max ${maxAbs.toFixed(1)}%)</span>`;
    }
    asymBars.innerHTML = asyms.map(a => {
      if(a.val == null) return `<div style="display:flex;align-items:center;gap:8px;color:var(--muted);font-size:10.5px"><span style="width:140px">${a.label}</span><span>측정 없음</span></div>`;
      const v = a.val;
      const absV = Math.abs(v);
      const c = absV >= 15 ? '#cf222e' : absV >= 10 ? '#bc4c00' : '#1a7f37';
      // 가로 막대: -20 to +20 % 범위, 중앙 0 (균형). 점선 ±15% 임계
      const pct = Math.max(-20, Math.min(20, v));
      const offset = 50 + (pct / 20 * 50); // 중앙 50%, 좌우 0~100%
      return `<div style="display:flex;align-items:center;gap:8px;font-size:11px">
        <span style="width:140px">${a.label}</span>
        <div style="flex:1;position:relative;height:18px;background:#f6f8fa;border-radius:3px;overflow:visible">
          <div style="position:absolute;top:0;bottom:0;left:50%;width:1px;background:#ccc"></div>
          <div style="position:absolute;top:0;bottom:0;left:12.5%;width:1px;border-left:1px dashed #cf222e;opacity:.5"></div>
          <div style="position:absolute;top:0;bottom:0;left:87.5%;width:1px;border-left:1px dashed #cf222e;opacity:.5"></div>
          <div style="position:absolute;top:50%;width:8px;height:8px;border-radius:50%;background:${c};transform:translate(-50%,-50%);left:${offset}%"></div>
        </div>
        <span style="width:60px;text-align:right;color:${c};font-weight:600">${v >= 0 ? '+' : ''}${v.toFixed(1)}%</span>
        <span style="width:30px;color:var(--muted);font-size:10px">${v < 0 ? 'L↑' : v > 0 ? 'R↑' : ''}</span>
      </div>`;
    }).join('');
  }

  // v5.17: 17 변인 전체 표 (분석가용 details) — Driveline HP 6축 외 추가 변인
  const detailBody = document.getElementById('p-fitness-detail-body');
  if(detailBody && ANALYTICS.FITNESS_VARIABLE_MAP){
    const vmap = ANALYTICS.FITNESS_VARIABLE_MAP;
    // 17 변인 표용 vars (drivelineHPDiagnosis용 hpInput과 별개)
    const vars = {
      cmj_jh:       fit.cmj?.jump_height_cm,
      cmj_pp_bm:    fit.cmj?.peak_power_bm_w_kg,
      cmj_rsi_mod:  fit.cmj?.rsi_modified_ms,
      cmj_conc_pf:  fit.cmj?.conc_peak_force_bm_n_kg,
      cmj_ec_ratio: fit.cmj?.ecc_conc_force_ratio,
      sj_jh:        fit.sj?.jump_height_cm,
      sj_pp_bm:     fit.sj?.peak_power_bm_w_kg,
      sj_conc_pf:   fit.sj?.conc_peak_force_bm_n_kg,
      eur:          fit.eur,
      pogo_rsi:     fit.pogo?.rsi_ms,
      pogo_ct:      fit.pogo?.mean_contact_time_ms,
      pogo_jh:      fit.pogo?.mean_jump_height_cm,
      imtp_pf:      fit.imtp?.peak_force_n,
      imtp_pf_bm:   fit.imtp?.peak_force_bm_n_kg,
      imtp_rfd:     fit.imtp?.rfd_0_100ms_n_s,
      imtp_f100:    fit.imtp?.force_at_100ms_bm_n_kg,
      imtp_asym:    fit.imtp?.asymmetry_pct
    };
    const order = ['cmj_jh','cmj_pp_bm','cmj_rsi_mod','cmj_conc_pf','cmj_ec_ratio',
                   'sj_jh','sj_pp_bm','sj_conc_pf','eur',
                   'pogo_rsi','pogo_ct','pogo_jh',
                   'imtp_pf','imtp_pf_bm','imtp_rfd','imtp_f100','imtp_asym'];
    const fmtVal = (v, unit) => {
      if(v == null) return '<span style="color:var(--muted)">—</span>';
      if(typeof v !== 'number') return v;
      if(unit === '' || unit === 'm/s') return v.toFixed(2);
      if(unit === 'cm' || unit === 'kg' || unit === '%' || unit === 'ms' || unit === 'N' || unit === 'N/s') return Math.round(v).toString();
      return v.toFixed(1);
    };
    // 효과별 배경 색
    const eBg = e => e === 'velo' ? '#dafbe1' : e === 'cmd' ? '#fce7e8' : e === 'cmd_inj' ? '#fff8c5' : '#f6f8fa';
    const eC  = e => e === 'velo' ? '#1a7f37' : e === 'cmd' ? '#cf222e' : e === 'cmd_inj' ? '#9a6700' : '#656d76';
    const eLabel = e => e === 'velo' ? '⚾ 구속' : e === 'cmd' ? '🎯 제구' : e === 'cmd_inj' ? '🎯⚠ 제구·부상' : '—';
    detailBody.innerHTML = order.map(k => {
      const def = vmap[k]; if(!def) return '';
      const v = vars[k];
      const rowBg = def.priority === 1 ? '#fafffe' : '';
      return `<tr style="border-bottom:1px solid #f0f3f6;background:${rowBg}">
        <td style="padding:6px;color:var(--muted);font-size:11px">${def.test}</td>
        <td style="padding:6px;font-weight:500">${def.short}${def.priority === 1 ? ' <span style="color:#bc4c00">⭐</span>' : ''}</td>
        <td style="text-align:right;padding:6px;font-weight:600">${fmtVal(v, def.unit)} <span style="color:var(--muted);font-size:10px">${def.unit}</span></td>
        <td style="text-align:right;padding:6px;color:var(--muted)">${fmtVal(def.goodKR, def.unit)}</td>
        <td style="text-align:right;padding:6px;color:var(--muted)">${fmtVal(def.mlb, def.unit)}</td>
        <td style="padding:6px"><span style="background:${eBg(def.effect)};color:${eC(def.effect)};padding:2px 6px;border-radius:3px;font-size:10px">${eLabel(def.effect)}</span></td>
        <td style="padding:6px;color:var(--muted);font-size:11px">${def.purpose}</td>
      </tr>`;
    }).join('');
  }
}

function v514_renderMechanicTables(m, p){
  if(typeof ANALYTICS === 'undefined') return;
  const A = ANALYTICS;
  const fmtPctile = pct => {
    if(pct == null) return '<span style="color:var(--muted)">—</span>';
    const c = pct >= 75 ? '#1a7f37' : pct >= 50 ? '#0969da' : pct >= 25 ? '#bc4c00' : '#cf222e';
    return `<span style="color:${c};font-weight:600">${pct}</span>`;
  };

  // [3-1] v5.24: Driveline 5 모델 변인 상세 표 (Per 1mph)
  const dvBody = document.getElementById('p-driveline-vars-body');
  if(dvBody && A.DRIVELINE_5_MODELS && A.drivelineFiveModelDiagnosis){
    const dvl5 = A.drivelineFiveModelDiagnosis({
      shoulder_er_max_deg: m.faults?.shoulder_er_max_deg,
      peak_shoulder_v: m.sequence?.peak_shoulder_v,
      peak_elbow_v:    m.sequence?.peak_elbow_v ?? m.sequence?.elbow_dps,
      arm_dps:         m.sequence?.arm_dps,
      x_factor:           m.faults?.x_factor_deg,
      trunk_forward_tilt: m.faults?.trunk_tilt_at_fc_deg,
      trunk_lateral_tilt: m.faults?.trunk_lat_tilt_deg,
      trunk_dps:  m.sequence?.trunk_dps,
      pelvis_dps: m.sequence?.pelvis_dps,
      lead_knee_change: m.faults?.lead_knee_change,
      stride_length:    m.faults?.stride_length_m,
      cog_decel:    m.cog?.decel,
      max_cog_velo: m.cog?.max_velo
    });
    if(dvl5){
      const modelOrder = ['arm_action','posture','rotation','block','cog'];
      const modelLabel = {arm_action:'🚀 Arm Action', posture:'🛡 Posture', rotation:'🔄 Rotation', block:'🦵 Block', cog:'🎯 CoG'};
      const impColor = imp => imp === 'high' ? '#cf222e' : imp === 'med' ? '#bc4c00' : '#656d76';
      const impLabel = imp => imp === 'high' ? '높음' : imp === 'med' ? '보통' : '낮음';
      const fmtV = (v, unit) => v == null ? '<span style="color:var(--muted)">—</span>' :
        (unit === 'deg' || unit === 'in' ? Math.round(v) :
         unit === 'm/s' ? v.toFixed(2) :
         unit === 'deg/s' ? Math.round(v) : v.toFixed(1));
      let html = '';
      modelOrder.forEach(mk => {
        const md = dvl5[mk];
        if(!md || !md.metrics) return;
        Object.entries(md.metrics).forEach(([k, mt], i) => {
          const diff = (mt.value != null && mt.median_elite != null && mt.per_1mph) ?
            ((mt.value - mt.median_elite) / mt.per_1mph) : null;
          const diffColor = diff == null ? '#656d76' : diff > 0 ? '#1a7f37' : '#cf222e';
          const diffStr = diff == null ? '—' : (diff >= 0 ? '+' : '') + diff.toFixed(1) + ' mph';
          html += `<tr style="border-bottom:1px solid #f0f3f6">
            <td style="padding:5px 6px;color:var(--muted);font-size:10.5px">${i === 0 ? modelLabel[mk] : ''}</td>
            <td style="padding:5px 6px">${mt.label}</td>
            <td style="text-align:right;padding:5px 6px;font-weight:600">${fmtV(mt.value, mt.unit)} <span style="color:var(--muted);font-size:10px">${mt.unit}</span></td>
            <td style="text-align:right;padding:5px 6px;color:var(--muted)">${fmtV(mt.median_elite, mt.unit)}</td>
            <td style="text-align:center;padding:5px 6px;color:${impColor(mt.importance)};font-size:10px;font-weight:600">${impLabel(mt.importance)}</td>
            <td style="text-align:right;padding:5px 6px;color:var(--muted)">${fmtV(mt.per_1mph, mt.unit)}</td>
            <td style="text-align:right;padding:5px 6px;color:${diffColor};font-weight:600">${diffStr}</td>
          </tr>`;
        });
      });
      dvBody.innerHTML = html;
    }
  }

  // [3-1] v5.18: 메카닉 7 변인 → 본인/한국우수/MLB + 효과 매핑 표 (체력과 동일 패턴)
  const tbody = document.getElementById('p-mech-percentile-body');
  if(tbody && A.MECHANIC_VARIABLE_MAP){
    const mvars = {
      pelvis_dps: m.sequence?.pelvis_dps,
      trunk_dps:  m.sequence?.trunk_dps,
      arm_dps:    m.sequence?.arm_dps,
      x_factor:   m.faults?.x_factor_deg,
      stride_pct: (m.faults?.stride_pct ?? 0.80) * 100,    // 0.80 → 80
      hp_ratio_pct: m.energy?.transfer?.ratio_humerus_to_pelvis_pct,
      ete_pct:    m.energy?.transfer?.ete_pct
    };
    const order = ['pelvis_dps','trunk_dps','arm_dps','x_factor','stride_pct','hp_ratio_pct','ete_pct'];
    const eBg = e => e === 'velo' ? '#dafbe1' : e === 'cmd' ? '#fce7e8' : e === 'cmd_velo' ? '#ddf4ff' : '#f6f8fa';
    const eC  = e => e === 'velo' ? '#1a7f37' : e === 'cmd' ? '#cf222e' : e === 'cmd_velo' ? '#0969da' : '#656d76';
    const eLabel = e => e === 'velo' ? '⚾ 구속' : e === 'cmd' ? '🎯 제구' : e === 'cmd_velo' ? '🎯⚾ 제구·구속' : '—';
    const fmtVal = (v, unit) => {
      if(v == null) return '<span style="color:var(--muted)">—</span>';
      if(typeof v !== 'number') return v;
      if(unit === '°/s' || unit === 'N/s' || unit === '%') return Math.round(v).toString();
      return v.toFixed(1);
    };
    tbody.innerHTML = order.map(k => {
      const def = A.MECHANIC_VARIABLE_MAP[k]; if(!def) return '';
      const v = mvars[k];
      const rowBg = def.priority === 1 ? '#fafffe' : '';
      return `<tr style="border-bottom:1px solid #f0f3f6;background:${rowBg}">
        <td style="padding:5px 6px;font-weight:500">${def.short}${def.priority === 1 ? ' <span style="color:#bc4c00">⭐</span>' : ''}</td>
        <td style="text-align:right;padding:5px 6px;font-weight:600">${fmtVal(v, def.unit)} <span style="color:var(--muted);font-size:10px">${def.unit}</span></td>
        <td style="text-align:right;padding:5px 6px;color:var(--muted)">${fmtVal(def.goodKR, def.unit)}</td>
        <td style="text-align:right;padding:5px 6px;color:var(--muted)">${fmtVal(def.mlb, def.unit)}</td>
      </tr>`;
    }).join('');
  }

  // [3-2] 분절별 metric 표 — peak ω + KE_rot + speed gain + lag
  const segBody = document.getElementById('p-segment-body');
  if(segBody){
    const seq = m.sequence; const trf = m.energy?.transfer;
    const massKg = p.weight, heightM = p.height/100;
    const ke = (seg, omega) => (A.selfCalcSegmentKE && omega) ? A.selfCalcSegmentKE(seg, massKg, heightM, omega) : null;
    const fmt0 = v => v == null ? '—' : Math.round(v);
    const fmt1 = v => v == null ? '—' : v.toFixed(1);
    const segs = [
      {lbl:'골반', omega: seq?.pelvis_dps, ke: ke('pelvis', seq?.pelvis_dps), gain: '—', lag: '—'},
      {lbl:'몸통', omega: seq?.trunk_dps,  ke: ke('trunk',  seq?.trunk_dps),
       gain: trf?.speed_gain_pt != null ? trf.speed_gain_pt.toFixed(2) + '×' : '—',
       lag: trf?.pelvis_to_trunk_lag_ms != null ? trf.pelvis_to_trunk_lag_ms + ' ms' : '—'},
      {lbl:'팔 (Humerus IR)', omega: seq?.arm_dps, ke: ke('humerus', seq?.arm_dps),
       gain: trf?.speed_gain_ta != null ? trf.speed_gain_ta.toFixed(2) + '×' : '—',
       lag: trf?.trunk_to_arm_lag_ms != null ? trf.trunk_to_arm_lag_ms + ' ms' : '—'},
      {lbl:'손 (추정)', omega: seq?.arm_dps != null ? Math.round(seq.arm_dps * 1.8) : null,
       ke: '—', gain: '~1.8×', lag: '~20 ms'}
    ];
    segBody.innerHTML = segs.map(s => `<tr style="border-bottom:1px solid #f0f3f6">
      <td style="padding:5px 6px">${s.lbl}</td>
      <td style="text-align:right;padding:5px 6px">${fmt0(s.omega)} <span style="color:var(--muted);font-size:10px">°/s</span></td>
      <td style="text-align:right;padding:5px 6px">${typeof s.ke === 'number' ? fmt1(s.ke) : '—'} <span style="color:var(--muted);font-size:10px">J</span></td>
      <td style="text-align:right;padding:5px 6px">${s.gain}</td>
      <td style="text-align:right;padding:5px 6px">${s.lag}</td>
    </tr>`).join('');
  }

  // [3-3] ELI 6 zone 상세 표
  const eliBody = document.getElementById('p-eli-detail-body');
  const leak = m.energy?.leakage;
  if(eliBody && leak){
    const zones = [
      ['Z1','Sequential timing — 분절 가속 순차성', leak.zone1_sequence],
      ['Z2','X-factor 분리 — 골반-상체 분리각', leak.zone2_x_factor],
      ['Z3','Lead leg block — 앞발 받쳐주기', leak.zone3_lead_block],
      ['Z4','Trunk at FC — FC 시점 트렁크 자세', leak.zone4_trunk_at_fc],
      ['Z5','Shoulder ER — 어깨 외회전 가동성', leak.zone5_shoulder_align],
      ['Z6','Pelvis braking — 골반 감속', leak.zone6_pelvis_brake]
    ];
    const colorScore = s => s == null ? '#656d76' : s >= 80 ? '#1a7f37' : s >= 60 ? '#bc4c00' : s >= 40 ? '#d4a017' : '#cf222e';
    eliBody.innerHTML = zones.map(([z, desc, score]) => `<tr style="border-bottom:1px solid #f0f3f6">
      <td style="padding:5px 6px;font-weight:600;color:#0969da">${z}</td>
      <td style="padding:5px 6px;color:var(--muted)">${desc}</td>
      <td style="text-align:right;padding:5px 6px;font-weight:600;color:${colorScore(score)}">${score ?? '—'}</td>
    </tr>`).join('');
  }

  // [3-3 NEW v5.25] 에너지·파워 — Mechanical Energy 분절별 + 관절 Power Scalar
  const enBody = document.getElementById('p-energy-segment-body');
  const gen = m.energy?.generation;
  const trf = m.energy?.transfer;
  if(enBody && gen){
    // 학술 평균 (한국 우수+OBP cohort): pelvis 400J, trunk 600J, humerus 590J
    const refKE = { pelvis: 400, trunk: 600, humerus: 590 };
    const segments = [
      { lbl: '골반 (Pelvis)',  v: gen.mech_energy_pelvis_J,  ref: refKE.pelvis },
      { lbl: '몸통 (Trunk)',   v: gen.mech_energy_trunk_J,   ref: refKE.trunk },
      { lbl: '팔  (Humerus)',  v: gen.mech_energy_humerus_J, ref: refKE.humerus }
    ];
    const colorByRatio = r => r == null ? '#656d76' : r >= 1.1 ? '#1a7f37' : r >= 0.85 ? '#0969da' : r >= 0.65 ? '#bc4c00' : '#cf222e';
    enBody.innerHTML = segments.map((s, i) => {
      const ratio = s.v != null ? s.v / s.ref : null;
      const c = colorByRatio(ratio);
      // 전달율 = 다음 분절 KE / 현재 분절 KE
      let trans = null;
      if(i < segments.length - 1 && s.v != null && segments[i+1].v != null){
        trans = (segments[i+1].v / s.v * 100).toFixed(0);
      }
      const tColor = trans == null ? '#656d76' : (+trans) >= 100 ? '#1a7f37' : (+trans) >= 70 ? '#0969da' : '#cf222e';
      return `<tr style="border-bottom:1px solid #f0f3f6">
        <td style="padding:5px 6px;font-weight:500">${s.lbl}</td>
        <td style="text-align:right;padding:5px 6px;color:${c};font-weight:600">${s.v != null ? Math.round(s.v) : '—'} J</td>
        <td style="text-align:right;padding:5px 6px;color:var(--muted)">${s.ref} J</td>
        <td style="text-align:right;padding:5px 6px;color:${tColor};font-weight:600">${trans != null ? trans + '%' : '—'}</td>
      </tr>`;
    }).join('');
  }
  // ETE 요약
  const eteEl = document.getElementById('p-ete-summary');
  if(eteEl && trf){
    const ete = trf.ete_pct;
    const speedGainPT = trf.speed_gain_pt;
    const speedGainTA = trf.speed_gain_ta;
    const ratio = trf.ratio_humerus_to_pelvis_pct;
    const c = ete == null ? '#656d76' : ete >= 80 ? '#1a7f37' : ete >= 70 ? '#0969da' : ete >= 60 ? '#bc4c00' : '#cf222e';
    eteEl.innerHTML = `
      <div style="font-weight:600;margin-bottom:4px">⚡ 에너지 전달 효율 (ETE)</div>
      <div>전체 전달율: <b style="color:${c};font-size:14px">${ete != null ? ete + '%' : '—'}</b>
        <span style="color:var(--muted);font-size:10.5px"> (기준 80%+ Elite, 70%+ 정상)</span></div>
      <div style="font-size:10.5px;color:var(--muted);margin-top:4px">
        Speed Gain: 골반→몸통 <b>${speedGainPT?.toFixed(2) ?? '—'}×</b> · 몸통→팔 <b>${speedGainTA?.toFixed(2) ?? '—'}×</b><br>
        H/P KE_rot 비율: <b>${ratio ?? '—'}%</b> (작을수록 분절 균형 — Elite ~1190%)
      </div>`;
  }

  // 관절 파워 표 (Hip/Knee/Shoulder/Elbow)
  const pwBody = document.getElementById('p-power-joint-body');
  if(pwBody && gen){
    const joints = [
      { lbl: 'Hip 파워',     l: gen.hip_L_W,    r: gen.hip_R_W },
      { lbl: 'Knee 파워',    l: gen.knee_L_W,   r: gen.knee_R_W },
      { lbl: 'Shoulder 파워',l: null,           r: gen.shoulder_W },
      { lbl: 'Elbow 파워',   l: null,           r: gen.elbow_W }
    ];
    pwBody.innerHTML = joints.map(j => {
      const sum = (j.l ?? 0) + (j.r ?? 0);
      return `<tr style="border-bottom:1px solid #f0f3f6">
        <td style="padding:5px 6px;font-weight:500">${j.lbl}</td>
        <td style="text-align:right;padding:5px 6px;color:var(--muted)">${j.l != null ? Math.round(j.l) : '—'}</td>
        <td style="text-align:right;padding:5px 6px;font-weight:600">${j.r != null ? Math.round(j.r) : '—'}</td>
        <td style="text-align:right;padding:5px 6px;color:#bc4c00;font-weight:600">${sum > 0 ? Math.round(sum) : '—'}</td>
      </tr>`;
    }).join('');
  }
  // 파워 요약
  const pwEl = document.getElementById('p-power-summary');
  if(pwEl && gen){
    const totalW = gen.total_W;
    const driveLeg = (gen.hip_R_W ?? 0) + (gen.knee_R_W ?? 0); // 우완 기준 Drive Leg = R hip+knee
    const leadLeg  = (gen.hip_L_W ?? 0) + (gen.knee_L_W ?? 0);
    const lead_drive_ratio = driveLeg > 0 ? (leadLeg / driveLeg * 100).toFixed(0) : null;
    pwEl.innerHTML = `
      <div style="font-weight:600;margin-bottom:4px">🔋 총 파워 출력</div>
      <div>총합: <b style="color:#bc4c00;font-size:14px">${totalW != null ? Math.round(totalW) + ' W' : '—'}</b></div>
      <div style="font-size:10.5px;color:var(--muted);margin-top:4px">
        Drive Leg (R hip+knee): <b>${Math.round(driveLeg)} W</b><br>
        Lead Leg (L hip+knee): <b>${Math.round(leadLeg)} W</b>
        ${lead_drive_ratio != null ? '<span style="color:var(--muted)"> · Lead/Drive 비율: ' + lead_drive_ratio + '%</span>' : ''}
      </div>`;
  }

  // [3-4 NEW v5.25] 지면반력 — FP1/FP2 + LHEI
  const grf = m.grf;
  if(grf){
    // FP1 (뒷발) %BW
    const rearPct = grf.rear_force_pct;
    const rearEl = document.getElementById('p-grf-rear-pct');
    const rearFill = document.getElementById('p-grf-rear-fill');
    if(rearEl && rearPct != null){
      const c = rearPct >= 80 ? '#1a7f37' : rearPct >= 60 ? '#bc4c00' : '#cf222e';
      rearEl.innerHTML = `<span style="color:${c}">${rearPct.toFixed(1)}%</span>`;
      if(rearFill) rearFill.style.width = Math.min(100, rearPct / 150 * 100) + '%';
    } else if(rearEl){ rearEl.textContent = '—'; }

    // FP2 (앞발) %BW
    const leadPct = grf.lead_force_pct;
    const leadEl = document.getElementById('p-grf-lead-pct');
    const leadFill = document.getElementById('p-grf-lead-fill');
    if(leadEl && leadPct != null){
      const c = leadPct >= 110 ? '#1a7f37' : leadPct >= 90 ? '#0969da' : leadPct >= 70 ? '#bc4c00' : '#cf222e';
      leadEl.innerHTML = `<span style="color:${c}">${leadPct.toFixed(1)}%</span>`;
      if(leadFill) leadFill.style.width = Math.min(100, leadPct / 150 * 100) + '%';
    } else if(leadEl){ leadEl.textContent = '—'; }

    // LHEI 종합 점수
    const lheiEl = document.getElementById('p-grf-lhei-score');
    if(lheiEl && grf.lhei != null){
      const c = grf.lhei >= 80 ? '#1a7f37' : grf.lhei >= 60 ? '#0969da' : grf.lhei >= 40 ? '#bc4c00' : '#cf222e';
      lheiEl.innerHTML = `<span style="color:${c}">${grf.lhei}</span> <span style="font-size:13px;color:var(--muted)">/100</span>`;
    }

    // 유형 판정
    const typeEl = document.getElementById('p-grf-type-label');
    if(typeEl){
      let typeLabel = grf.type || '—';
      if(rearPct != null && leadPct != null){
        const ratio = leadPct / rearPct;
        if(ratio > 1.4)      typeLabel = '🦵 Lead 우세 (블로킹 강함)';
        else if(ratio < 0.7) typeLabel = '🦵 Drive 우세 (push 강함)';
        else                 typeLabel = '⚖ 균형형';
      }
      typeEl.innerHTML = `<b>유형: ${typeLabel}</b>`;
    }
  }
}

function v514_renderActionPlan(m, p){
  // [3-4] 메카닉 발달 권장 — 4축 약점 + ELI 약점 → 우선순위 훈련
  const wrap = document.getElementById('p-mech-action-plan');
  if(!wrap || typeof ANALYTICS === 'undefined') return;
  const A = ANALYTICS;
  const fa = A.fourAxisDiagnosis ? A.fourAxisDiagnosis({
    pelvis_dps: m.sequence?.pelvis_dps, trunk_dps: m.sequence?.trunk_dps,
    arm_dps: m.sequence?.arm_dps, x_factor: m.faults?.x_factor_deg,
    stride_pct: m.faults?.stride_pct ?? 0.80,
    speed_gain_pt: m.energy?.transfer?.speed_gain_pt,
    speed_gain_ta: m.energy?.transfer?.speed_gain_ta,
    eli_score: m.energy?.leakage?.eli_score
  }) : null;
  if(!fa) { wrap.innerHTML = '<span style="color:var(--muted)">데이터 부족</span>'; return; }

  // 4축 점수 → 약점 우선순위
  const axes = [
    {key:'power', label:'⚡ 힘 (Power)', score: fa.power.score,
     drills: ['분절 회전 power (medicine ball rotational throw)', 'Plyometric trunk drill', 'Hip rotation banded resistance']},
    {key:'timing', label:'⏱ 타이밍 (Timing)', score: fa.timing.score,
     drills: ['Kinematic sequence drill (towel drill)', 'Walking windup', 'Tempo/rhythm 변화 throw']},
    {key:'separation', label:'✂️ 분리 (Separation)', score: fa.separation.score,
     drills: ['Hip-shoulder separation (X-factor) stretch', 'Anti-rotation core (Pallof press)', 'Stride length 발달 drill']},
    {key:'stability', label:'🛡 안정성 (Stability)', score: fa.stability.score,
     drills: ['Lead leg block 강화 (single leg box jump)', 'Trunk control (Pallof press)', 'Pelvis braking drill (RFE split squat)']}
  ];
  axes.sort((a,b) => (a.score ?? 100) - (b.score ?? 100));   // 가장 낮은 점수 순

  // ELI 가장 낮은 zone 1개 추가
  const leak = m.energy?.leakage;
  let eliWeakest = null;
  if(leak){
    const zones = [
      ['Z1', '분절 시퀀싱 timing', leak.zone1_sequence, 'Towel drill, walking windup'],
      ['Z2', 'X-factor 분리', leak.zone2_x_factor, 'Hip-shoulder separation stretch'],
      ['Z3', 'Lead leg block', leak.zone3_lead_block, '단일하지 박스점프, 깊은 스쿼트'],
      ['Z4', 'Trunk at FC', leak.zone4_trunk_at_fc, 'Anti-rotation core (Pallof)'],
      ['Z5', 'Shoulder ER', leak.zone5_shoulder_align, 'Sleeper stretch + cuff 강화'],
      ['Z6', 'Pelvis braking', leak.zone6_pelvis_brake, 'RFE 스플릿 스쿼트, 디셀러레이션']
    ].filter(z => z[2] != null).sort((a,b) => a[2] - b[2]);
    eliWeakest = zones[0];
  }

  let html = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">`;
  // 4축 약점 Top 2
  html += `<div>`;
  html += `<div style="font-size:13px;font-weight:600;margin-bottom:6px;color:#cf222e">▼ 4축 약점 우선순위</div>`;
  axes.slice(0, 2).forEach((a, i) => {
    html += `<div style="background:#fff5f5;border-left:3px solid #cf222e;padding:8px 10px;margin-bottom:6px;border-radius:4px">
      <div style="font-weight:600;font-size:12px">${i+1}. ${a.label} <span style="color:#cf222e;font-size:11px">(${a.score ?? '—'}점)</span></div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">권장 drill:</div>
      <ul style="margin:4px 0 0;padding-left:16px;font-size:11px;line-height:1.5">${a.drills.map(d => `<li>${d}</li>`).join('')}</ul>
    </div>`;
  });
  html += `</div>`;
  // ELI 가장 낮은 zone + 강점 1개
  html += `<div>`;
  if(eliWeakest){
    html += `<div style="font-size:13px;font-weight:600;margin-bottom:6px;color:#bc4c00">⚠ 가장 낮은 ELI Zone</div>`;
    html += `<div style="background:#fff8f0;border-left:3px solid #bc4c00;padding:8px 10px;margin-bottom:8px;border-radius:4px">
      <div style="font-weight:600;font-size:12px">${eliWeakest[0]} ${eliWeakest[1]} <span style="color:#bc4c00;font-size:11px">(${eliWeakest[2]}점)</span></div>
      <div style="font-size:11px;margin-top:4px">→ ${eliWeakest[3]}</div>
    </div>`;
  }
  html += `<div style="font-size:13px;font-weight:600;margin-bottom:6px;color:#1a7f37">▲ 강점 (유지)</div>`;
  html += `<div style="background:#f0fff4;border-left:3px solid #1a7f37;padding:8px 10px;border-radius:4px">
    <div style="font-weight:600;font-size:12px">${axes[axes.length-1].label} <span style="color:#1a7f37;font-size:11px">(${axes[axes.length-1].score ?? '—'}점)</span></div>
    <div style="font-size:11px;color:var(--muted);margin-top:4px">현재 수준 유지하면서 약점 발달 우선</div>
  </div>`;
  html += `</div></div>`;
  wrap.innerHTML = html;
}

function v514_renderSummaryAction(m, p){
  // [§ 5] 종합 권장 — bigger lever 진단 (v5.25: Mechanical Ceiling 기반)
  const wrap = document.getElementById('p-summary-action');
  if(!wrap || typeof ANALYTICS === 'undefined') return;
  const A = ANALYTICS;
  const measured = m.velocity?.measured_kmh;
  if(!A.expectedVelocityFromFitness || measured == null){
    wrap.innerHTML = '<span style="color:var(--muted)">실측 구속 또는 모델 데이터 부족</span>';
    return;
  }
  const fitIn = {
    height_cm: p.height, weight_kg: p.weight,
    cmj_pp_bm: m.fitness?.cmj?.peak_power_bm_w_kg,
    imtp_pf_bm: m.fitness?.imtp?.peak_force_bm_n_kg,
    hop_rsi: m.fitness?.pogo?.rsi_ms, grip_kg: null
  };
  const fit = A.expectedVelocityFromFitness(fitIn, measured);
  const fitGain = fit?.expected_gain ?? 0;

  // v5.25: 메카닉 향상 = Driveline Mechanical Ceiling 잠재
  let meGain = 0;
  if(A.drivelineFiveModelDiagnosis && A.drivelineMechanicalCeiling){
    const dvl5 = A.drivelineFiveModelDiagnosis({
      shoulder_er_max_deg: m.faults?.shoulder_er_max_deg,
      peak_shoulder_v: m.sequence?.peak_shoulder_v,
      peak_elbow_v:    m.sequence?.peak_elbow_v ?? m.sequence?.elbow_dps,
      arm_dps:         m.sequence?.arm_dps,
      x_factor:           m.faults?.x_factor_deg,
      trunk_forward_tilt: m.faults?.trunk_tilt_at_fc_deg,
      trunk_lateral_tilt: m.faults?.trunk_lat_tilt_deg,
      trunk_dps:  m.sequence?.trunk_dps,
      pelvis_dps: m.sequence?.pelvis_dps,
      lead_knee_change: m.faults?.lead_knee_change,
      stride_length:    m.faults?.stride_length_m,
      cog_decel:    m.cog?.decel,
      max_cog_velo: m.cog?.max_velo
    });
    const ceil = A.drivelineMechanicalCeiling(dvl5, measured);
    if(ceil && ceil.added_kmh_potential != null) meGain = ceil.added_kmh_potential;
  }
  const totalGain = Math.round((fitGain + meGain) * 10) / 10;
  const lever = meGain > fitGain ? '메카닉' : '체력';
  const leverColor = lever === '체력' ? '#bc4c00' : '#1a7f37';
  const leverMsg = totalGain < 1 ? '이미 종합 잠재 도달 — release/spin 등 기타 요인 발달' :
                   totalGain < 5 ? '통합 향상으로 +' + totalGain + ' km/h 기대' :
                   totalGain < 10 ? '통합 향상 잠재 +' + totalGain + ' km/h — 메카닉/체력 모두 발달 권장' :
                                    '통합 향상 잠재 +' + totalGain + ' km/h — 큰 발달 여지';

  let html = `<div style="background:#f6f8fa;border-radius:6px;padding:12px;margin-bottom:10px">
    <div style="font-size:13px;font-weight:600;margin-bottom:6px">🎯 향상 시나리오 비교</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:6px">
      <div style="background:#fff8f0;padding:8px 10px;border-radius:4px;border-left:3px solid #bc4c00">
        <div style="font-size:11px;color:var(--muted)">💪 체력만 향상</div>
        <div style="font-size:18px;font-weight:600;color:#bc4c00">+${fitGain} km/h</div>
      </div>
      <div style="background:#f0f9f4;padding:8px 10px;border-radius:4px;border-left:3px solid #1a7f37">
        <div style="font-size:11px;color:var(--muted)">⚙️ 메카닉 천장</div>
        <div style="font-size:18px;font-weight:600;color:#1a7f37">+${meGain} km/h</div>
      </div>
      <div style="background:#f5f0ff;padding:8px 10px;border-radius:4px;border-left:3px solid #8250df">
        <div style="font-size:11px;color:var(--muted)">🎯 통합 향상</div>
        <div style="font-size:18px;font-weight:600;color:#8250df">+${totalGain} km/h</div>
      </div>
    </div>
  </div>`;
  html += `<div style="padding:10px;background:${leverColor}10;border-left:4px solid ${leverColor};border-radius:4px;margin-bottom:8px">
    <div style="font-size:13px;font-weight:600;color:${leverColor}">💡 더 큰 leverage: <b>${lever}</b></div>
    <div style="font-size:11.5px;color:var(--text);margin-top:4px">${leverMsg}</div>
  </div>`;
  html += `<div style="font-size:11.5px;color:var(--muted);margin-top:8px">
    <b>📋 다음 3개월 권장 흐름:</b><br>
    1. <b>§ 3-4 메카닉 발달 권장</b>의 4축 약점 Top 2 drill 4-6주 적용<br>
    2. <b>§ 2 체력</b> ForceDecks 측정값 weak link 변수에 S&C 보강<br>
    3. <b>다음 측정 (3개월 후)</b> 같은 방식 측정 후 percentile 변화 확인 → 효과 검증
  </div>`;
  wrap.innerHTML = html;
}

/* 코호트 모드 — KBO/HS 토글로 비교 평가 변경 */
let RAP_COHORT = (typeof localStorage !== 'undefined' && localStorage.getItem('rap_cohort')) || 'KBO';

function renderRapsodoFB(rap, player){
  const area = document.getElementById('p-rapsodo-area');
  if(!area) return;
  if(!rap || !rap.fb){
    area.innerHTML = `<div style="text-align:center;color:var(--muted);padding:20px;background:var(--panel2);border-radius:6px">
      Rapsodo CSV 인입 후 자동 표시 — <a href="#" onclick="switchTab('data');return false;" style="color:var(--accent)">데이터 관리 탭으로 이동</a>
    </div>`;
    return;
  }
  const fb = rap.fb;
  const COH = RAPSODO_BENCHMARKS[RAP_COHORT];
  const armSign = player.arm === 'R' ? 1 : -1;
  document.getElementById('rap-cohort-badge').textContent = `코호트: ${RAP_COHORT} 기준`;

  // 코호트 대비 평가
  function vs(val, ref, fmt=0, unit='', lowerBetter=false){
    if(val == null) return '<span style="color:var(--muted)">—</span>';
    const diff = val - ref;
    const good = lowerBetter ? diff < 0 : diff > 0;
    const c = Math.abs(diff) < (Math.abs(ref) * 0.03) ? 'var(--muted)' : (good ? 'var(--good)' : 'var(--bad)');
    const sign = diff >= 0 ? '+' : '';
    return `<span style="color:${c};font-weight:600">${sign}${diff.toFixed(fmt)}${unit}</span>`;
  }

  // 6 카드
  area.innerHTML = `
    <div class="grid grid-3">
      <!-- ① Velocity -->
      <div class="scard" style="border-top:3px solid #cf222e">
        <h3>① Velocity (구속)</h3>
        <div class="row"><span>최고 (max)</span><span class="v" style="font-size:18px;font-weight:700">${fb.velocity.max} <span style="font-size:11px;color:var(--muted)">km/h</span></span></div>
        <div class="row"><span>평균 (avg)</span><span class="v">${fb.velocity.avg} km/h</span></div>
        <div class="row"><span>변동 (SD)</span><span class="v">${fb.velocity.sd} km/h</span></div>
        <div class="row"><span>플레이트 평균</span><span class="v">${fb.plate_velocity.avg} km/h</span></div>
        <div class="row"><span>감속률</span><span class="v">${fb.velo_loss_pct}%</span></div>
        <div class="row" style="border-top:1px dashed var(--line-soft);margin-top:5px;padding-top:5px">
          <span>${RAP_COHORT} 평균 ${COH.velo} 대비</span>${vs(fb.velocity.avg, COH.velo, 1, ' km/h')}
        </div>
      </div>

      <!-- ② Spin & Stuff -->
      <div class="scard" style="border-top:3px solid #0969da">
        <h3>② Spin & Stuff (회전·구위)</h3>
        <div class="row"><span>회전수 (Spin)</span><span class="v" style="font-size:16px;font-weight:700">${fb.spin.avg} rpm</span></div>
        <div class="row"><span>True Spin</span><span class="v">${fb.true_spin_avg} rpm</span></div>
        <div class="row"><span>회전효율 (Efficiency)</span><span class="v" style="color:${fb.spin_eff.avg>=90?'var(--good)':fb.spin_eff.avg>=80?'var(--warn)':'var(--bad)'}">${fb.spin_eff.avg}%</span></div>
        <div class="row"><span>회전축 (deg)</span><span class="v">${fb.spin_axis_deg}°</span></div>
        <div class="row"><span>Gyro 각도</span><span class="v">${fb.gyro_avg}°</span></div>
        <div class="row"><span>Bauer Units</span><span class="v" style="font-weight:700">${fb.bauer_units}</span></div>
        <div class="row" style="border-top:1px dashed var(--line-soft);margin-top:5px;padding-top:5px">
          <span>Stuff Score</span><span class="v" style="font-size:16px;color:${scoreColor(fb.stuff_score)}">${fb.stuff_score}/100</span>
        </div>
      </div>

      <!-- ③ Movement -->
      <div class="scard" style="border-top:3px solid #1a7f37">
        <h3>③ Movement (무브먼트)</h3>
        <div class="row"><span>IVB (수직 라이즈)</span><span class="v" style="font-size:16px;font-weight:700">${fb.ivb.avg} cm</span></div>
        <div class="row"><span>IVB SD</span><span class="v">${fb.ivb.sd} cm</span></div>
        <div class="row"><span>HB (수평 무브)</span><span class="v">${fb.hb.avg>0?'+':''}${fb.hb.avg} cm</span></div>
        <div class="row"><span>VB Total (중력 포함)</span><span class="v">${fb.vb_total_avg} cm</span></div>
        <div class="row"><span>VAA (진입각)</span><span class="v" style="color:${fb.vaa_avg>=-5.0?'var(--good)':fb.vaa_avg>=-6.0?'var(--warn)':'var(--bad)'}">${fb.vaa_avg}°</span></div>
        <div class="row"><span>HAA</span><span class="v">${fb.haa_avg}°</span></div>
        <div class="row" style="border-top:1px dashed var(--line-soft);margin-top:5px;padding-top:5px">
          <span>${RAP_COHORT} IVB ${COH.ivb} 대비</span>${vs(fb.ivb.avg, COH.ivb, 1, ' cm')}
        </div>
      </div>
    </div>

    <div class="grid grid-3" style="margin-top:12px">
      <!-- ④ Release Consistency -->
      <div class="scard" style="border-top:3px solid #bc4c00">
        <h3>④ Release Consistency (릴리스 일관성)</h3>
        <div class="row"><span>Height (높이)</span><span class="v">${fb.release.height_avg} m</span></div>
        <div class="row"><span>Height SD</span><span class="v" style="color:${fb.release.height_sd_cm<3?'var(--good)':fb.release.height_sd_cm<5?'var(--warn)':'var(--bad)'}">${fb.release.height_sd_cm} cm</span></div>
        <div class="row"><span>Side (좌우)</span><span class="v">${fb.release.side_avg} m</span></div>
        <div class="row"><span>Side SD</span><span class="v" style="color:${fb.release.side_sd_cm<3?'var(--good)':fb.release.side_sd_cm<5?'var(--warn)':'var(--bad)'}">${fb.release.side_sd_cm} cm</span></div>
        <div class="row"><span>Extension (앞으로)</span><span class="v">${fb.release.extension_avg} m</span></div>
        <div class="row" style="border-top:1px dashed var(--line-soft);margin-top:5px;padding-top:5px">
          <span>Release Angle</span><span class="v">${fb.release.angle_avg}°</span>
        </div>
      </div>

      <!-- ⑤ Command -->
      <div class="scard" style="border-top:3px solid #8250df">
        <h3>⑤ Command (제구)</h3>
        <div class="row"><span>In-Zone %</span><span class="v" style="font-size:16px;font-weight:700;color:${fb.in_zone_pct>=60?'var(--good)':fb.in_zone_pct>=45?'var(--warn)':'var(--bad)'}">${fb.in_zone_pct}%</span></div>
        <div class="row"><span>플레이트 평균 높이</span><span class="v">${fb.plate.height_avg} cm</span></div>
        <div class="row"><span>플레이트 평균 좌우</span><span class="v">${fb.plate.side_avg} cm</span></div>
        <div class="row" style="border-top:1px dashed var(--line-soft);margin-top:5px;padding-top:5px">
          <span>Command Score</span><span class="v" style="font-size:16px;color:${scoreColor(fb.command_score)}">${fb.command_score}/100</span>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-top:6px;line-height:1.5">
          Stuff vs Command 4분면 → 우상=Elite · 우하=Stuff Only · 좌상=Strike Thrower · 좌하=Develop
        </div>
      </div>

      <!-- ⑥ ${RAP_COHORT} 코호트 비교 -->
      <div class="scard" style="border-top:3px solid #6e7781">
        <h3>⑥ ${RAP_COHORT} 코호트 평가</h3>
        <div class="row"><span>구속</span>${vs(fb.velocity.avg, COH.velo, 1, ' km/h')}</div>
        <div class="row"><span>회전수</span>${vs(fb.spin.avg, COH.spin, 0, ' rpm')}</div>
        <div class="row"><span>회전효율</span>${vs(fb.spin_eff.avg, COH.eff, 1, '%')}</div>
        <div class="row"><span>IVB</span>${vs(fb.ivb.avg, COH.ivb, 1, ' cm')}</div>
        <div class="row"><span>Bauer Units</span>${vs(fb.bauer_units, COH.bauer, 1, '')}</div>
        <div class="row"><span>VAA (낮을수록 좋음)</span>${vs(fb.vaa_avg, COH.vaa, 2, '°', true)}</div>
        <div class="row" style="border-top:1px dashed var(--line-soft);margin-top:5px;padding-top:5px">
          <span><b>Extension</b></span>${vs(fb.release.extension_avg, COH.ext, 2, ' m')}
        </div>
      </div>
    </div>

    <!-- Movement Profile (IVB vs HB scatter) — Chart.js → SVG로 그림 -->
    <div class="grid grid-2" style="margin-top:14px">
      <div class="panel" style="margin:0">
        <h3 style="margin:0 0 8px;font-size:12.5px">Movement Profile · IVB vs HB
          <span style="float:right;font-size:11px;color:var(--muted)">개별 throw + 평균(◆) + 코호트(✚)</span></h3>
        <div class="chart-wrap" style="height:280px"><canvas id="rap-mov-chart"></canvas></div>
      </div>
      <div class="panel" style="margin:0">
        <h3 style="margin:0 0 8px;font-size:12.5px">Stuff vs Command 4분면
          <span style="float:right;font-size:11px;color:var(--muted)">우상=Elite</span></h3>
        <div class="chart-wrap" style="height:280px"><canvas id="rap-sc-chart"></canvas></div>
      </div>
    </div>

    <div class="footnote" style="margin-top:12px">
      <b>지표 해설</b>:
      <code>IVB</code>=Induced Vertical Break (중력 제외 수직 무브먼트, 클수록 "라이즈") ·
      <code>Spin Efficiency</code>=True Spin/Total Spin (높을수록 회전이 무브먼트로 변환) ·
      <code>VAA</code>=Vertical Approach Angle (덜 가파를수록=0에 가까울수록 "플랫" 패스트볼, 헛스윙 유도) ·
      <code>Bauer Units</code>=Spin/Velocity(mph) (회전 효율 proxy, 25+ 양호) ·
      <code>Extension</code>=릴리스 시 마운드에서 앞으로 나간 거리 (길수록 "체감 구속" ↑)
    </div>
  `;

  // 차트 — Movement Profile (산점도)
  if(chartsP.rapMov) chartsP.rapMov.destroy();
  const throwsPts = (fb.throws||[]).map(t => ({x: t.hb, y: t.ivb}));
  const avgPt = {x: fb.hb.avg, y: fb.ivb.avg};
  const cohPt = {x: armSign * 8, y: COH.ivb};
  chartsP.rapMov = new Chart(document.getElementById('rap-mov-chart'), {
    type: 'scatter',
    data: {datasets: [
      {label:'개별 throw', data: throwsPts, backgroundColor:'rgba(13,109,253,0.5)', borderColor:'#0969da', pointRadius:4},
      {label:'평균 ◆', data: [avgPt], backgroundColor:'#0969da', borderColor:'#0969da', pointRadius:9, pointStyle:'rectRot'},
      {label:`${RAP_COHORT} 코호트 ✚`, data: [cohPt], backgroundColor:'#cf222e', borderColor:'#cf222e', pointRadius:9, pointStyle:'crossRot', borderWidth:3}
    ]},
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{labels:{color:'#1f2328',font:{size:11}}}},
      scales:{
        x:{title:{display:true,text:'HB · 수평 무브 (cm, +=arm side)',color:'#656d76'},
           min:-30, max:30, grid:{color:'#eaeef2'}, ticks:{color:'#656d76'}},
        y:{title:{display:true,text:'IVB · 수직 라이즈 (cm)',color:'#656d76'},
           min:0, max:65, grid:{color:'#eaeef2'}, ticks:{color:'#656d76'}}
      }
    }
  });

  // Stuff vs Command — 본인 1점 + 팀 다른 선수들 비교
  if(chartsP.rapSC) chartsP.rapSC.destroy();
  const teamSC = PLAYERS.map(pl => {
    const r = DATA[pl.id]?.[1]?.rapsodo?.fb;
    return r ? {x: r.stuff_score, y: r.command_score, label: pl.name, isMe: pl.id === player.id} : null;
  }).filter(Boolean);
  chartsP.rapSC = new Chart(document.getElementById('rap-sc-chart'), {
    type: 'scatter',
    data: {datasets: [
      {label:'팀 동료', data: teamSC.filter(p=>!p.isMe), backgroundColor:'rgba(101,109,118,0.4)', borderColor:'#656d76', pointRadius:4},
      {label:'본인', data: teamSC.filter(p=>p.isMe), backgroundColor:'#0969da', borderColor:'#0969da', pointRadius:10, pointStyle:'rectRot'}
    ]},
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{labels:{color:'#1f2328',font:{size:11}}},
        tooltip:{callbacks:{label:c=>{const d=teamSC[c.datasetIndex===0?c.dataIndex:teamSC.findIndex(p=>p.isMe)];return `${d?.label} · S${d?.x} / C${d?.y}`;}}}
      },
      scales:{
        x:{title:{display:true,text:'Stuff Score (구위 →)',color:'#656d76'}, min:0, max:100, grid:{color:'#eaeef2'},ticks:{color:'#656d76'}},
        y:{title:{display:true,text:'Command Score (제구 →)',color:'#656d76'}, min:0, max:100, grid:{color:'#eaeef2'},ticks:{color:'#656d76'}}
      }
    }
  });
}

/* v4.0 [5]: Outcome Diagnosis — 체력 한계 vs 메카닉 비효율 자동 진단 */
function renderOutcomeDiagnosis(m, p){
  const wrap = document.getElementById('p-outcome-diagnosis');
  if(!wrap) return;
  const d = m.velocity.diagnosis;
  if(!d){ wrap.innerHTML = ''; return; }

  const aeColor = d.ae_kmh >= 3 ? '#1a7f37' : d.ae_kmh >= -3 ? '#0969da' : '#cf222e';
  const aeBg    = d.ae_kmh >= 3 ? '#dafbe1' : d.ae_kmh >= -3 ? '#ddf4ff' : '#ffebe9';
  const groupColor = (g) => ({미달:'#7e57c2',평균:'#e91e63',우수:'#ff9800',Elite:'#ff6f00'})[g] || '#656d76';

  wrap.innerHTML = `
    <div style="background:linear-gradient(135deg,#fafbfc,#fff);border:2px solid ${aeColor};
                border-radius:8px;padding:14px 16px">
      <h3 style="margin:0 0 10px;font-size:13px;color:${aeColor}">
        📊 [5] 자동 진단 — 체력 ceiling vs 메카닉 효율
      </h3>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px">
        <div style="background:#fff;border:1px solid var(--line-soft);border-radius:6px;padding:8px 10px">
          <div style="font-size:10px;color:var(--muted)">실측 구속</div>
          <div style="font-size:18px;font-weight:700">${d.measured_kmh}<span style="font-size:11px;color:var(--muted);font-weight:400"> km/h</span></div>
          <div style="font-size:10px"><span style="background:${groupColor(d.measured_group)};color:#fff;padding:1px 6px;border-radius:3px">${d.measured_group}</span></div>
        </div>
        <div style="background:#fff;border:1px solid var(--line-soft);border-radius:6px;padding:8px 10px">
          <div style="font-size:10px;color:var(--muted)">체력 Predicted</div>
          <div style="font-size:18px;font-weight:700">${d.predicted_kmh}<span style="font-size:11px;color:var(--muted);font-weight:400"> km/h</span></div>
          <div style="font-size:10px"><span style="background:${groupColor(d.predicted_group)};color:#fff;padding:1px 6px;border-radius:3px">${d.predicted_group}</span></div>
        </div>
        <div style="background:${aeBg};border:1px solid ${aeColor};border-radius:6px;padding:8px 10px">
          <div style="font-size:10px;color:${aeColor}">메카닉 효율 (AE)</div>
          <div style="font-size:18px;font-weight:700;color:${aeColor}">${d.ae_kmh >= 0 ? '+' : ''}${d.ae_kmh}<span style="font-size:11px;font-weight:400"> km/h</span></div>
          <div style="font-size:10px;color:${aeColor};font-weight:600">${d.ae_label}</div>
        </div>
      </div>
      <div style="background:#fff;border-left:4px solid ${aeColor};padding:10px 12px;border-radius:4px;margin-bottom:8px">
        <div style="font-size:11px;color:var(--muted);margin-bottom:3px">핵심 진단</div>
        <div style="font-size:13px;font-weight:600;color:${aeColor}">${d.primary_finding}</div>
      </div>
      <div style="background:#f6f8fa;padding:10px 12px;border-radius:4px;font-size:12px;color:var(--text)">
        <b>권장:</b> ${d.recommendation}
      </div>
      <div style="font-size:10px;color:var(--muted);margin-top:8px;text-align:right">
        Predicted Velo = 체력+신체 회귀 baseline / AE = 실측 − Predicted (Driveline HP Assessment 모방)
      </div>
    </div>`;
}

/* v5.0: HP Assessment — 5 체력 변수 × 4 Velo Group 분포 (Driveline HP 5 테스트 + BW 자동 = 6축 호환)
   매뉴얼 v2.0 호환 — Grip 제거 (Driveline HP에 없음), Plyo Push Up 추가 (NEW) */
function renderHPAssessment(m, p){
  const wrap = document.getElementById('p-hp-assessment');
  if(!wrap || typeof ANALYTICS === 'undefined') return;
  if(!m.fitness){ wrap.innerHTML = '<div style="color:var(--muted);padding:14px;text-align:center">체력 데이터 미입력 (Theia+GRF 회차에만)</div>'; return; }

  // 5 체력 변수 (5 테스트 대표 1개씩) + 본인 측정값 + Velo Group 4그룹별 평균
  const vars = [
    { key: 'cmj_jh_cm',         label: 'CMJ Jump Height',      unit: 'cm',   value: m.fitness.cmj?.jump_height_cm },
    { key: 'cmj_pp_bm',         label: 'CMJ Peak Power / BM',  unit: 'W/kg', value: m.fitness.cmj?.peak_power_bm_w_kg },
    { key: 'imtp_pf_bm',        label: 'IMTP Peak Force / BM', unit: 'N/kg', value: m.fitness.imtp?.peak_force_bm_n_kg },
    { key: 'hop_rsi',           label: 'Hop Test RSI',         unit: '',     value: m.fitness.pogo?.rsi_ms },
    { key: 'pp_peak_takeoff_bm',label: 'Plyo Push Up Takeoff', unit: 'N/kg', value: m.fitness.pp?.peak_takeoff_force_bm_n_kg },
  ];

  const groups = ['미달', '평균', '우수', 'Elite'];
  const groupColors = { '미달':'#7e57c2', '평균':'#e91e63', '우수':'#ff9800', 'Elite':'#ff6f00' };

  // 본인의 Velo Group
  const myGroup = m.velocity.velo_group || ANALYTICS.veloGroup(m.velocity.measured_kmh);

  let html = `<div style="background:#fff;border:1px solid var(--line);border-radius:6px;padding:14px">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;font-size:11px">
      <span><b>본인 Velo Group:</b>
        <span style="background:${groupColors[myGroup]||'#666'};color:#fff;padding:2px 8px;border-radius:3px;font-weight:600">${myGroup||'—'}</span>
      </span>
      <span style="color:var(--muted)">|  미달 (&lt;128) · 평균 (128-133) · 우수 (133-138) · Elite (138+) km/h</span>
    </div>`;

  // 변수별 분포 막대
  vars.forEach(v => {
    if(v.value == null) return;
    const groupNorms = groups.map(g => ANALYTICS.VELO_GROUP_NORMS[g]?.[v.key] || 0).filter(x => x > 0);
    if(!groupNorms.length) return;
    const maxV = Math.max(...groupNorms, v.value) * 1.15;
    const minV = Math.min(...groupNorms, v.value) * 0.85;
    const range = maxV - minV;

    const myPct = ((v.value - minV) / range) * 100;

    html += `<div style="display:grid;grid-template-columns:160px 1fr 80px;gap:10px;align-items:center;
                          padding:6px 0;border-top:1px dashed #eaeef2;font-size:11.5px">
      <div>
        <div style="font-weight:600">${v.label}</div>
        <div style="font-size:10px;color:var(--muted)">${v.unit}</div>
      </div>
      <div style="position:relative;height:48px;background:linear-gradient(90deg,
                  ${groupColors['미달']}22 0%, ${groupColors['미달']}22 25%,
                  ${groupColors['평균']}22 25%, ${groupColors['평균']}22 50%,
                  ${groupColors['우수']}22 50%, ${groupColors['우수']}22 75%,
                  ${groupColors['Elite']}22 75%, ${groupColors['Elite']}22 100%);
                  border-radius:4px">`;

    // 4 그룹 평균 dot
    groups.forEach((g, gi) => {
      const norm = ANALYTICS.VELO_GROUP_NORMS[g]?.[v.key];
      if(!norm) return;
      const xPct = ((norm - minV) / range) * 100;
      html += `<div style="position:absolute;left:${xPct}%;top:50%;transform:translate(-50%,-50%);
                width:8px;height:8px;background:${groupColors[g]};border-radius:50%;
                border:2px solid #fff;box-shadow:0 1px 2px rgba(0,0,0,.2)" title="${g} 평균: ${norm}"></div>
              <div style="position:absolute;left:${xPct}%;bottom:0;transform:translate(-50%,0);
                font-size:8px;color:${groupColors[g]};font-weight:600">${g}</div>`;
    });

    // 본인 vertical line
    html += `<div style="position:absolute;left:${Math.max(0,Math.min(100,myPct))}%;top:0;bottom:0;
              width:3px;background:#0969da;transform:translateX(-50%);box-shadow:0 0 4px rgba(9,105,218,.5)" title="본인 ${v.value}">
            </div>
            <div style="position:absolute;left:${Math.max(0,Math.min(100,myPct))}%;top:-8px;transform:translate(-50%,-100%);
              background:#0969da;color:#fff;font-size:9px;padding:1px 5px;border-radius:3px;font-weight:600">▼ ${typeof v.value === 'number' ? v.value.toFixed(1) : v.value}</div>`;

    html += `</div>
      <div style="text-align:right;font-weight:700;color:#0969da">
        ${typeof v.value === 'number' ? v.value.toFixed(1) : v.value}<br>
        <span style="font-size:9px;color:var(--muted);font-weight:400">${v.unit}</span>
      </div>
    </div>`;
  });

  html += `<div style="font-size:10px;color:var(--muted);margin-top:10px;padding-top:8px;border-top:1px solid #eaeef2">
    Driveline HP Assessment 모방. 4 그룹 평균값을 점으로, 본인 위치를 ▼ 라인으로 표시.
    각 그룹 평균은 VELO_GROUP_NORMS (analytics.js v4.0) 기반.
  </div></div>`;

  wrap.innerHTML = html;
}

/* v3.5-4: 3-tier 코호트 overlay — 한국 elite vs College vs MLB percentile */
function renderTierOverlay(m, p){
  const wrap = document.getElementById('p-tier-overlay');
  if(!wrap) return;
  if(!m.fitness){ wrap.innerHTML = ''; return; }
  // 비교할 metrics 4개
  const items = [];
  // 1. 구속
  if(m.velocity?.measured_kmh != null && typeof ANALYTICS !== 'undefined'){
    const tier = ANALYTICS.valdMultiTier(m.velocity.measured_kmh, 'pitching', 'velocity_mean_kmh');
    items.push({ label: '평균 구속', value: m.velocity.measured_kmh, unit: 'km/h', tier });
  }
  // 2. CMJ JH
  if(m.fitness.cmj?.jump_height_cm != null && m.fitness.vald_cmj_jh){
    items.push({ label: 'CMJ Jump Height', value: m.fitness.cmj.jump_height_cm, unit: 'cm', tier: m.fitness.vald_cmj_jh });
  }
  // 3. CMJ Conc PP
  if(m.fitness.cmj?.peak_power_bm_w_kg != null && m.fitness.vald_cmj_pp){
    items.push({ label: 'CMJ Peak Power/BM', value: m.fitness.cmj.peak_power_bm_w_kg, unit: 'W/kg', tier: m.fitness.vald_cmj_pp });
  }
  // 4. CMJ RSI-Modified
  if(m.fitness.cmj?.rsi_modified_ms != null && m.fitness.vald_cmj_rsi){
    items.push({ label: 'CMJ RSI-Modified', value: m.fitness.cmj.rsi_modified_ms, unit: 'm/s', tier: m.fitness.vald_cmj_rsi });
  }
  if(items.length === 0){ wrap.innerHTML = ''; return; }

  const tierColors = { kr_hs_elite: '#0969da', college: '#bc4c00', mlb: '#a40e26' };
  const tierLabels = { kr_hs_elite: '🇰🇷 KR Elite', college: '🇺🇸 College', mlb: '🇺🇸 MLB' };

  let html = `<div class="panel" style="background:#fafbfc;padding:14px 16px;margin:0">
    <h3 style="margin:0 0 10px;font-size:13px">3-Tier 코호트 percentile 비교
      <span style="font-size:11px;color:var(--muted);font-weight:400">한국 elite (N=41) · College Baseball · MLB Pro</span>
    </h3>
    <div style="display:grid;grid-template-columns:repeat(${Math.min(items.length, 4)}, 1fr);gap:10px">`;

  items.forEach(it => {
    html += `<div style="background:#fff;border:1px solid var(--line);border-radius:6px;padding:8px 10px">
      <div style="font-size:11px;color:var(--muted);margin-bottom:2px">${it.label}</div>
      <div style="font-size:16px;font-weight:700;margin-bottom:6px">${it.value} <span style="font-size:10px;color:var(--muted);font-weight:400">${it.unit}</span></div>`;
    ['kr_hs_elite', 'college', 'mlb'].forEach(c => {
      const t = it.tier[c];
      if(!t) return;
      const pct = t.percentile;
      const color = pct >= 75 ? '#1a7f37' : pct >= 50 ? '#0969da' : pct >= 25 ? '#bf8700' : '#cf222e';
      html += `<div style="display:flex;align-items:center;gap:6px;font-size:10.5px;margin:2px 0">
        <span style="flex:0 0 75px;color:${tierColors[c]}">${tierLabels[c]}</span>
        <div style="flex:1;height:8px;background:#eaeef2;border-radius:4px;position:relative">
          <div style="position:absolute;left:0;top:0;height:100%;width:${Math.min(100,pct)}%;background:${color};border-radius:4px"></div>
        </div>
        <span style="flex:0 0 38px;text-align:right;color:${color};font-weight:600">${pct}p</span>
      </div>`;
    });
    html += '</div>';
  });

  html += '</div></div>';
  wrap.innerHTML = html;
}

function renderFitnessCards(fit){
  const wrap = document.getElementById('fitness-cards');
  if(!fit){ wrap.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--muted);padding:30px">체력 측정 데이터 없음</div>'; return; }
  const teamCMJ_JH = avg(PLAYERS.map(p=>DATA[p.id][1].fitness?.cmj.jump_height_cm).filter(v=>v!=null));
  const teamIMTP_PF = avg(PLAYERS.map(p=>DATA[p.id][1].fitness?.imtp.peak_force_bm_n_kg).filter(v=>v!=null));
  function bar(val, max){return Math.min(100, (val/max)*100)}
  const eurClass = fit.eur >= 1.10 ? 'good' : fit.eur >= 1.00 ? 'warn' : 'bad';
  const eurLabel = fit.eur >= 1.10 ? '우수 SSC' : fit.eur >= 1.00 ? '정상' : 'SSC 미활용';
  wrap.innerHTML = `
    <div class="fit-card">
      <div class="test-name">CMJ <span style="font-size:11px;color:var(--muted)">Slow SSC</span></div>
      <div class="test-sub">Counter-Movement Jump · 카운터무브 후 폭발</div>
      <div class="var-row"><span class="lbl">Jump Height<span class="star">★★★</span></span><span class="val">${fit.cmj.jump_height_cm} cm</span></div>
        <div class="pct-bar"><div style="width:${bar(fit.cmj.jump_height_cm,55)}%"></div></div>
      <div class="var-row"><span class="lbl">Peak Power / BM<span class="star">★★★</span></span><span class="val">${fit.cmj.peak_power_bm_w_kg} W/kg</span></div>
      <div class="var-row"><span class="lbl">RSI-mod<span class="star">★★</span></span><span class="val">${fit.cmj.rsi_modified_ms} m/s</span></div>
      <div class="var-row"><span class="lbl">Conc PF / BM<span class="star">★★</span></span><span class="val">${fit.cmj.conc_peak_force_bm_n_kg} N/kg</span></div>
      <div class="var-row"><span class="lbl">Ecc:Conc Ratio<span class="star">★</span></span><span class="val">${fit.cmj.ecc_conc_force_ratio}</span></div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--line-soft);font-size:11px;color:var(--muted)">
        팀 평균 JH: ${fmt(teamCMJ_JH,1)} cm
      </div>
    </div>

    <div class="fit-card">
      <div class="test-name">SJ <span style="font-size:11px;color:var(--muted)">Pure Concentric</span></div>
      <div class="test-sub">Squat Jump · 90° hold 후 폭발 (SSC 없음)</div>
      <div class="var-row"><span class="lbl">Jump Height<span class="star">★★</span></span><span class="val">${fit.sj.jump_height_cm} cm</span></div>
        <div class="pct-bar"><div style="width:${bar(fit.sj.jump_height_cm,50)}%;background:#1a7f37"></div></div>
      <div class="var-row"><span class="lbl">Peak Power / BM<span class="star">★★</span></span><span class="val">${fit.sj.peak_power_bm_w_kg} W/kg</span></div>
      <div class="var-row"><span class="lbl">Conc PF / BM<span class="star">★★</span></span><span class="val">${fit.sj.conc_peak_force_bm_n_kg} N/kg</span></div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--line-soft)">
        <div class="var-row"><span class="lbl"><b>EUR (CMJ JH / SJ JH)<span class="star">★★</span></b></span>
          <span class="val">${fit.eur} <span class="pill ${eurClass}">${eurLabel}</span></span></div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px">McGuigan 2018 · &gt;1.10 우수 / 1.00~1.10 정상 / &lt;1.00 미활용</div>
      </div>
    </div>

    <div class="fit-card">
      <div class="test-name">Pogo <span style="font-size:11px;color:var(--muted)">Fast SSC</span></div>
      <div class="test-sub">Repeated Hops · 발목·아킬레스 stiffness</div>
      <div class="var-row"><span class="lbl">RSI<span class="star">★★★</span></span><span class="val">${fit.pogo.rsi_ms} m/s</span></div>
        <div class="pct-bar"><div style="width:${bar(fit.pogo.rsi_ms,3.0)}%;background:#bc4c00"></div></div>
      <div class="var-row"><span class="lbl">Mean Contact Time<span class="star">★★</span></span><span class="val">${fit.pogo.mean_contact_time_ms} ms</span></div>
      <div class="var-row"><span class="lbl">Mean JH<span class="star">★★</span></span><span class="val">${fit.pogo.mean_jump_height_cm} cm</span></div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--line-soft);font-size:11px;color:var(--muted)">
        Flanagan & Comyns 2008 · fast SSC 표준 — 투수 FC reactive와 매칭
      </div>
    </div>

    <div class="fit-card">
      <div class="test-name">IMTP <span style="font-size:11px;color:var(--muted)">Isometric</span></div>
      <div class="test-sub">Isometric Mid-Thigh Pull · 최대 정적 힘 + RFD</div>
      <div class="var-row"><span class="lbl">Peak Force<span class="star">★★★</span></span><span class="val">${fit.imtp.peak_force_n} N</span></div>
      <div class="var-row"><span class="lbl">Peak Force / BM<span class="star">★★★</span></span><span class="val">${fit.imtp.peak_force_bm_n_kg} N/kg</span></div>
        <div class="pct-bar"><div style="width:${bar(fit.imtp.peak_force_bm_n_kg,32)}%;background:#cf222e"></div></div>
      <div class="var-row"><span class="lbl">RFD 0-100ms<span class="star">★★</span></span><span class="val">${fit.imtp.rfd_0_100ms_n_s} N/s</span></div>
      <div class="var-row"><span class="lbl">Force at 100ms / BM<span class="star">★★</span></span><span class="val">${fit.imtp.force_at_100ms_bm_n_kg} N/kg</span></div>
      <div class="var-row"><span class="lbl">Asymmetry<span class="star">★★</span></span>
        <span class="val ${fit.imtp.asymmetry_pct>5?'':'good'}">${fit.imtp.asymmetry_pct}%
        <span class="pill ${fit.imtp.asymmetry_pct<5?'good':fit.imtp.asymmetry_pct<10?'warn':'bad'}">${fit.imtp.asymmetry_pct<5?'정상':fit.imtp.asymmetry_pct<10?'경계':'위험'}</span></span></div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--line-soft);font-size:11px;color:var(--muted)">
        팀 평균 PF/BM: ${fmt(teamIMTP_PF,1)} N/kg · Lehman 2013 · pitching velocity와 r≈0.30~0.40
      </div>
    </div>
  `;
}

/* ╔══════════════════════════════════════════════════════════╗
   ║  5. TAB 3: 데이터 관리                                       ║
   ╚══════════════════════════════════════════════════════════╝ */

function renderRoster(){
  const tb = document.querySelector('#roster-table tbody');
  const search = document.getElementById('roster-search').value.trim();
  const rows = PLAYERS.filter(p=>!search||p.name.includes(search)||p.id.includes(search));
  tb.innerHTML = rows.map(p=>{
    const m = DATA[p.id][1];
    const mech = m.velocity ? '<span class="pill good">완료</span>' : '<span class="pill bad">미입력</span>';
    const fit = m.fitness ? '<span class="pill good">완료</span>' : '<span class="pill bad">미입력</span>';
    const velo = m.velocity?.measured_kmh!=null ? '<span class="pill good">완료</span>' : '<span class="pill bad">미입력</span>';
    return `<tr><td><code>${p.id}</code></td><td><b>${p.name}</b></td><td>${p.arm}</td>
      <td class="right">${p.height}</td><td class="right">${p.weight}</td>
      <td>${mech}</td><td>${fit}</td><td>${velo}</td>
      <td><button class="btn ghost" onclick="switchTab('player');document.getElementById('player-select').value='${p.id}';renderPlayerView('${p.id}')">리포트 →</button></td></tr>`;
  }).join('');
  document.getElementById('roster-count').textContent = rows.length;
}

/* ╔══════════════════════════════════════════════════════════╗
   ║  6. TAB 4: 장기 추적                                         ║
   ╚══════════════════════════════════════════════════════════╝ */

function renderScheduleHalves(){
  const wrap = document.getElementById('schedule-halves');
  const halves = [...new Set(SESSIONS.map(s=>s.half))];   // ['상반기','하반기']
  wrap.innerHTML = halves.map(h=>{
    const ss = SESSIONS.filter(s=>s.half===h);
    return `
      <div style="margin-bottom:14px">
        <div style="font-size:12px;font-weight:600;color:var(--muted);
                    text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px;
                    padding-bottom:6px;border-bottom:1px solid var(--line-soft)">
          ${h} <span style="color:var(--text);margin-left:6px">${ss.length}회 측정</span>
        </div>
        <div class="grid" style="grid-template-columns:repeat(${ss.length},1fr);gap:12px">
          ${ss.map(s=>{
            const isTheia = s.protocol==='Theia+GRF';
            const color = isTheia?'var(--theia)':'var(--uplift)';
            const tag = isTheia?'theia':'uplift';
            const desc = isTheia
              ? '메카닉 + GRF + 체력(ForceDecks) + 구속'
              : '메카닉(스마트폰 markerless) + 구속';
            return `
              <div class="kpi" style="border-left:4px solid ${color}">
                <div class="label">${s.label} <span class="protocol-tag ${tag}">${s.protocol}</span></div>
                <div style="font-size:14px;font-weight:600;margin:6px 0">${s.date}</div>
                <div class="delta">${desc}</div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');
}

/* 상·하반기 비교 분석 — 지표 추출, 등급, 정렬 */
const METRIC_DEFS = {
  score:       {label:'종합점수',     unit:'pt', fmtDec:1, isScore:true,  pick:m=>m.velocity.score},
  velo:        {label:'측정 구속',    unit:'km/h', fmtDec:1, isScore:false, pick:m=>m.velocity.measured_kmh},
  velo_pot:    {label:'잠재 구속',    unit:'km/h', fmtDec:1, isScore:false, pick:m=>m.velocity.potential_kmh},
  sequence:    {label:'시퀀스 점수',  unit:'pt', fmtDec:1, isScore:true,  pick:m=>m.sequence.score},
  consistency: {label:'제구 일관성',  unit:'pt', fmtDec:1, isScore:true,  pick:m=>m.faults.consistency_score},
  fault:       {label:'결함 관리',    unit:'pt', fmtDec:1, isScore:true,  pick:m=>m.faults.fault_score},
};

function halfAvg(pid, half, def){
  const ss = SESSIONS.filter(s=>s.half===half);
  const vals = ss.map(s=>def.pick(DATA[pid][s.id])).filter(v=>v!=null && !isNaN(v));
  return vals.length === ss.length ? avg(vals) : null;   // 한 회차라도 누락 → null
}
function gradeOf(delta, isScore){
  if(delta==null||isNaN(delta)) return {pill:'', label:'—'};
  if(isScore){
    if(delta >=  5) return {pill:'good', label:'★★★ 매우 향상'};
    if(delta >=  2) return {pill:'good', label:'★★ 향상'};
    if(delta >= -2) return {pill:'warn', label:'★ 유지'};
    return                  {pill:'bad',  label:'↓ 정체·하락'};
  } else {
    if(delta >=  3) return {pill:'good', label:'★★★ 매우 향상'};
    if(delta >=  1) return {pill:'good', label:'★★ 향상'};
    if(delta >= -1) return {pill:'warn', label:'★ 유지'};
    return                  {pill:'bad',  label:'↓ 정체·하락'};
  }
}

let chartHC = null;
let hcSort = {key:'delta', dir:'desc'};
function renderHalfComparison(){
  const key = document.getElementById('hc-metric').value;
  const def = METRIC_DEFS[key];

  // 선수별 행
  const rows = PLAYERS.map(p=>{
    const h1 = halfAvg(p.id, '상반기', def);
    const h2 = halfAvg(p.id, '하반기', def);
    const delta = (h1!=null && h2!=null) ? (h2 - h1) : null;
    return {pid:p.id, name:p.name, arm:p.arm, h1, h2, delta, grade: gradeOf(delta, def.isScore)};
  });

  // 팀 KPI: 상반기 평균 / 하반기 평균 / Δ / 향상자 비율
  const teamH1 = avg(rows.map(r=>r.h1));
  const teamH2 = avg(rows.map(r=>r.h2));
  const teamD  = (teamH1!=null && teamH2!=null) ? teamH2 - teamH1 : null;
  const improved = rows.filter(r=>r.delta!=null && r.delta>0).length;
  const declined = rows.filter(r=>r.delta!=null && r.delta<0).length;
  const validN = rows.filter(r=>r.delta!=null).length;
  const dColor = teamD==null ? 'var(--muted)' : teamD>=0 ? 'var(--good)' : 'var(--bad)';

  document.getElementById('hc-team-kpi').innerHTML = `
    <div class="kpi">
      <div class="label">팀 평균 — 상반기</div>
      <div class="value">${fmt(teamH1, def.fmtDec)} <span style="font-size:13px;color:var(--muted)">${def.unit}</span></div>
      <div class="delta">1차·2차 평균</div>
    </div>
    <div class="kpi">
      <div class="label">팀 평균 — 하반기</div>
      <div class="value">${fmt(teamH2, def.fmtDec)} <span style="font-size:13px;color:var(--muted)">${def.unit}</span></div>
      <div class="delta">3차·4차 평균</div>
    </div>
    <div class="kpi">
      <div class="label">팀 Δ (하반기 − 상반기)</div>
      <div class="value" style="color:${dColor}">
        ${teamD==null ? '—' : (teamD>=0?'+':'') + fmt(teamD, def.fmtDec)}
        <span style="font-size:13px;color:var(--muted)">${def.unit}</span>
      </div>
      <div class="delta">${def.label} 기준</div>
    </div>
    <div class="kpi">
      <div class="label">향상 / 유지 / 정체</div>
      <div class="value">
        <span style="color:var(--good)">${improved}</span> /
        <span style="color:var(--warn)">${validN - improved - declined}</span> /
        <span style="color:var(--bad)">${declined}</span>
      </div>
      <div class="delta">유효 ${validN}명 기준 (Δ &gt; 0 / -2~+2 / &lt; 0)</div>
    </div>
  `;

  document.getElementById('hc-bar-title').textContent =
    `선수별 향상도 (Δ ${def.label}, ${def.unit}) — 큰 순 정렬`;

  // 막대 차트 (Δ 큰 순)
  const sortedForBar = [...rows].filter(r=>r.delta!=null).sort((a,b)=>b.delta-a.delta);
  const barColors = sortedForBar.map(r=>{
    const d = r.delta, isS = def.isScore;
    if(isS ? d>=2 : d>=1) return '#1a7f37';        // 향상
    if(isS ? d>=-2 : d>=-1) return '#bf8700';      // 유지
    return '#cf222e';                              // 정체
  });
  if(chartHC) chartHC.destroy();
  chartHC = new Chart(document.getElementById('hc-bar'),{
    type:'bar',
    data:{
      labels: sortedForBar.map(r=>r.name),
      datasets:[{label:`Δ ${def.label}`, data: sortedForBar.map(r=>r.delta),
                 backgroundColor: barColors}]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{label:c=>{
          const r = sortedForBar[c.dataIndex];
          return `${r.name} · 상반기 ${fmt(r.h1,def.fmtDec)} → 하반기 ${fmt(r.h2,def.fmtDec)} (Δ ${r.delta>=0?'+':''}${r.delta.toFixed(def.fmtDec)})`;
        }}}
      },
      scales:{
        x:{ticks:{color:'#656d76',font:{size:10}},grid:{display:false}},
        y:{title:{display:true,text:`Δ ${def.unit}`,color:'#656d76'},
           grid:{color:'#eaeef2'},ticks:{color:'#656d76'},
           // 0 기준선 강조
           grace:'5%'}
      },
      onClick:(evt, elems)=>{
        if(elems.length){
          const pid = sortedForBar[elems[0].index].pid;
          switchTab('player'); document.getElementById('player-select').value = pid; renderPlayerView(pid);
        }
      }
    }
  });

  // 정렬 테이블
  const k = hcSort.key, dir = hcSort.dir==='asc'?1:-1;
  const sortedTable = [...rows].sort((a,b)=>{
    let av = k==='grade' ? (a.delta ?? -999) : a[k];
    let bv = k==='grade' ? (b.delta ?? -999) : b[k];
    if(av==null) return 1; if(bv==null) return -1;
    if(typeof av === 'string') return dir*av.localeCompare(bv);
    return dir*(av-bv);
  });
  const tb = document.querySelector('#hc-table tbody');
  tb.innerHTML = sortedTable.map(r=>{
    const dColor = r.delta==null?'var(--muted)':r.delta>=0?'var(--good)':'var(--bad)';
    const sign = r.delta>=0?'+':'';
    return `<tr data-pid="${r.pid}">
      <td><b>${r.name}</b></td>
      <td class="right">${r.arm}</td>
      <td class="right">${fmt(r.h1, def.fmtDec)}</td>
      <td class="right">${fmt(r.h2, def.fmtDec)}</td>
      <td class="right" style="color:${dColor};font-weight:600">${r.delta==null?'—':sign+r.delta.toFixed(def.fmtDec)}</td>
      <td class="right">${r.grade.pill ? `<span class="pill ${r.grade.pill}">${r.grade.label}</span>` : '—'}</td>
    </tr>`;
  }).join('');
  // 정렬 표시
  document.querySelectorAll('#hc-table thead th').forEach(th=>{
    th.classList.remove('sort-asc','sort-desc');
    if(th.dataset.key===hcSort.key) th.classList.add(hcSort.dir==='asc'?'sort-asc':'sort-desc');
  });
  // 행 클릭 → 선수 리포트
  tb.querySelectorAll('tr').forEach(tr=>{
    tr.addEventListener('click', ()=>{
      switchTab('player'); document.getElementById('player-select').value = tr.dataset.pid; renderPlayerView(tr.dataset.pid);
    });
  });
}

// 헤더 정렬 클릭
document.addEventListener('click', e=>{
  const th = e.target.closest('#hc-table thead th');
  if(!th) return;
  const k = th.dataset.key;
  if(hcSort.key===k){hcSort.dir = hcSort.dir==='asc'?'desc':'asc'}
  else{hcSort.key=k; hcSort.dir = (k==='name'||k==='arm')?'asc':'desc'}
  renderHalfComparison();
});

let chartLong = null;
function renderLongTab(){
  renderScheduleHalves();
  renderHalfComparison();
  if(chartLong) chartLong.destroy();
  chartLong = new Chart(document.getElementById('long-trend'),{
    type:'line',
    data:{
      labels: SESSIONS.map(s=>`${s.label}\n(${s.protocol==='Theia+GRF'?'T+GRF':'Uplift'})`),
      datasets:[
        {label:'평균 구속 (km/h)', data:SESSIONS.map(s=>avg(PLAYERS.map(p=>DATA[p.id][s.id].velocity.measured_kmh))),
         borderColor:'#0969da', backgroundColor:'rgba(9,105,218,.1)', tension:.3, yAxisID:'y', pointRadius:5},
        {label:'평균 종합점수', data:SESSIONS.map(s=>avg(PLAYERS.map(p=>DATA[p.id][s.id].velocity.score))),
         borderColor:'#8250df', tension:.3, yAxisID:'y2', pointRadius:5},
        {label:'평균 시퀀스', data:SESSIONS.map(s=>avg(PLAYERS.map(p=>DATA[p.id][s.id].sequence.score))),
         borderColor:'#1a7f37', tension:.3, yAxisID:'y2', pointRadius:4},
        {label:'평균 일관성', data:SESSIONS.map(s=>avg(PLAYERS.map(p=>DATA[p.id][s.id].faults.consistency_score))),
         borderColor:'#bf8700', tension:.3, yAxisID:'y2', pointRadius:4}
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{labels:{color:'#1f2328'}}},
      scales:{
        x:{ticks:{color:'#656d76'},grid:{color:'#eaeef2'}},
        y:{position:'left',title:{display:true,text:'구속 (km/h)',color:'#0969da'},
           ticks:{color:'#0969da'},grid:{color:'#eaeef2'}},
        y2:{position:'right',title:{display:true,text:'점수 (0~100)',color:'#8250df'},
            ticks:{color:'#8250df'},grid:{drawOnChartArea:false},min:0,max:100}
      }
    }
  });
}

/* ╔══════════════════════════════════════════════════════════╗
   ║  7. 공통 차트 옵션 + 탭 전환                                  ║
   ╚══════════════════════════════════════════════════════════╝ */

/* ── Phase 3 (v2.2): 통일 색상 팔레트 + 향상된 툴팁/애니메이션 ──
   colorblind-safe 팔레트 (Wong 2011 + GitHub 디자인) */
const CHART_PALETTE = {
  primary:    '#0969da',   // 본인/주력 — 청
  secondary:  '#8250df',   // 보조 — 보라
  accent:     '#1a7f37',   // 양호/긍정 — 녹
  warning:    '#bf8700',   // 주의 — 황
  danger:     '#cf222e',   // 경고/부족 — 적
  neutral:    '#656d76',   // 비교/배경 — 회
  // 점수 기반 (ELI/score 0~100)
  scoreColor: function(s){
    if(s == null || isNaN(s)) return this.neutral;
    if(s >= 80) return this.accent;
    if(s >= 60) return this.warning;
    return this.danger;
  },
  // 5색 시리즈 (라인/그룹 비교)
  series: ['#0969da', '#8250df', '#1a7f37', '#bf8700', '#cf222e']
};

function chartOpts(opts={}){
  // opts: { yTitle, xTitle, unit, decimals, animate, customTooltip }
  const unit = opts.unit || '';
  const dec  = opts.decimals != null ? opts.decimals : 1;
  return {
    responsive:true, maintainAspectRatio:false,
    animation: opts.animate === false ? false : { duration: 600, easing: 'easeOutQuart' },
    interaction: { intersect: false, mode: 'index' },
    plugins:{
      legend:{labels:{color:'#1f2328',font:{size:11.5,family:'inherit'}, usePointStyle: true, padding: 10}},
      tooltip:{
        intersect:false, mode:'index',
        backgroundColor: 'rgba(31,35,40,.95)', titleColor:'#fff', bodyColor:'#fff',
        padding: 10, cornerRadius: 6, boxPadding: 4,
        titleFont: {size: 12, weight: '600'}, bodyFont: {size: 11.5},
        callbacks: opts.customTooltip || {
          label: function(ctx){
            const v = ctx.parsed.y != null ? ctx.parsed.y : ctx.parsed;
            const num = (typeof v === 'number') ? v.toFixed(dec) : v;
            return `${ctx.dataset.label || ''}: ${num}${unit ? ' '+unit : ''}`;
          }
        }
      }
    },
    scales:{
      x:{ticks:{color:'#656d76',font:{size:11}},
         grid:{color:'#eaeef2', drawBorder: false},
         title: opts.xTitle ? {display:true, text:opts.xTitle, color:'#656d76', font:{size:11}} : undefined},
      y:{ticks:{color:'#656d76',font:{size:11}},
         grid:{color:'#eaeef2', drawBorder: false},
         title: opts.yTitle ? {display:true, text:opts.yTitle, color:'#656d76', font:{size:11}} : undefined,
         beginAtZero: opts.beginAtZero}
    }
  };
}

function switchTab(name){
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active', b.dataset.tab===name));
  ['m1','player','data','long','report'].forEach(t=>{
    document.getElementById('tab-'+t).classList.toggle('hidden', t!==name);
  });
  if(name==='long') renderLongTab();
  if(name==='data') renderRoster();
  if(name==='report'){ renderPlayerChecks(); renderCoachPreview(); }
}
document.querySelectorAll('.tab-btn').forEach(b=>{
  b.addEventListener('click',()=>switchTab(b.dataset.tab));
});
document.getElementById('roster-search')?.addEventListener('input', renderRoster);

// + 선수 추가 — 임시 추가 (페이지 reload 시 사라짐. 영구 저장은 PLAYERS 배열 직접 수정)
document.getElementById('roster-add')?.addEventListener('click', ()=>{
  const name = prompt('선수 이름?'); if(!name) return;
  const arm = (prompt('투구손 (R 또는 L)?', 'R')||'R').toUpperCase();
  const height = parseInt(prompt('신장 (cm)?', '178'),10) || 178;
  const weight = parseInt(prompt('체중 (kg)?', '75'),10)  || 75;
  const dob = prompt('생년월일 (YYYY-MM-DD)?', '2008-01-01') || '2008-01-01';
  const newId = 'P' + String(PLAYERS.length+1).padStart(2,'0');
  const np = {id:newId, name, arm, height, weight, dob};
  PLAYERS.push(np);
  // 새 선수 측정값(샘플) 생성 — 실측 들어오면 DATA 직접 갱신
  Object.assign(DATA, genMeasurementsFor([np]));
  renderHeaderDynamic(); renderM1KPI(); renderProgressGrid();
  buildM1Table(); renderM1Heatmap(); renderM1Charts();
  renderPlayerSelect(); renderRoster();
  if(typeof saveToStorage === 'function') saveToStorage();
});

// CSV 다운로드 — 현재 명단을 9컬럼 CSV로 내보내기
document.getElementById('roster-export')?.addEventListener('click', ()=>{
  const head = 'athlete_external_id,athlete_name,handedness,height_cm,weight_kg,date_of_birth';
  const rows = PLAYERS.map(p=>[p.id,p.name,p.arm,p.height,p.weight,p.dob].join(','));
  const blob = new Blob(['﻿'+head+'\n'+rows.join('\n')], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'roster.csv'; a.click();
});

// 새 선수 1명만 측정값 생성 (genMeasurements와 동일 로직, 한 명용)
function genMeasurementsFor(arr){
  const out = {};
  arr.forEach((p, idx)=>{
    const baseIdx = PLAYERS.findIndex(x=>x.id===p.id);  // 시드 안정화
    const rng = seedRand(baseIdx*131+7);
    const baseVelo = 118+rng()*22, trend = -2+rng()*8;
    const baseScore = 50+rng()*35, scoreTrend = -3+rng()*15;
    const armVelBase = 1100+rng()*500, baseFitness = 0.4+rng()*0.5;
    out[p.id] = {};
    SESSIONS.forEach((s, si)=>{
      const f = si/3, noise = (rng()-0.5)*4;
      const velo = baseVelo+trend*f+noise;
      const score = Math.max(20,Math.min(98, baseScore+scoreTrend*f+(rng()-0.5)*6));
      const seqScore = Math.max(20,Math.min(98, baseScore-5+scoreTrend*f*0.8+(rng()-0.5)*8));
      const consScore = Math.max(20,Math.min(98, baseScore+5+scoreTrend*f*0.5+(rng()-0.5)*10));
      const faultScore = Math.max(20,Math.min(98, 100-(baseScore*0.3)+scoreTrend*f-(rng()-0.5)*8));
      const isTheia = s.protocol==='Theia+GRF', sysScale = isTheia?1.0:1.9;
      const m = {
        protocol:s.protocol, date:s.date,
        velocity:{measured_kmh:r1(velo), potential_kmh:r1(velo+6+(score-60)/10), score:Math.round(score)},
        sequence:{
          pelvis_dps:Math.round((480+rng()*80)*sysScale),
          trunk_dps:Math.round((780+rng()*180)*sysScale*0.8),
          arm_dps:Math.round(armVelBase+rng()*400),
          ete_pct:Math.round(60+rng()*30+scoreTrend*f),
          speed_gain:r2(1.4+rng()*0.4), proper_seq:rng()>0.15, score:Math.round(seqScore)
        },
        // 에너지 블록 (간이 — 신규 추가 선수용. 풀 스키마는 genMeasurements 참조)
        energy: {
          generation: {
            shoulder_W: Math.round(320+rng()*260), elbow_W: Math.round(180+rng()*180),
            hip_R_W: Math.round(220+rng()*180), hip_L_W: Math.round(220+rng()*180),
            knee_R_W: Math.round(280+rng()*220), knee_L_W: Math.round(280+rng()*220),
            mech_energy_pelvis_J: Math.round(380+rng()*160),
            mech_energy_trunk_J:  Math.round(620+rng()*220),
            mech_energy_humerus_J:Math.round(220+rng()*140),
            score: Math.round(seqScore), total_W: 0
          },
          transfer: {
            ete_pct: Math.round(60+rng()*30), speed_gain_pt: r2(1.40+rng()*0.35),
            speed_gain_ta: r2(1.30+rng()*0.30), proper_seq: rng()>0.15,
            pelvis_to_trunk_lag_ms: Math.round(40+rng()*60),
            trunk_to_arm_lag_ms: Math.round(30+rng()*50),
            score: Math.round(seqScore)
          },
          leakage: isTheia ? {
            zone1_sequence: 70, zone2_x_factor: 70, zone3_lead_block: 70,
            zone4_trunk_at_fc: 70, zone5_shoulder_align: 70, zone6_pelvis_brake: 70,
            eli_score: 70, causal_chains: []
          } : null
        },
        grf: isTheia ? {
          lhei:Math.max(20,Math.min(98, 50+rng()*40+scoreTrend*f)),
          rear_force_pct:Math.round(70+rng()*25), lead_force_pct:Math.round(75+rng()*22),
          type:['균형형','뒤에 처지는','앞으로 쏟아지는','잠깐만 미는','좌우로 새는'][Math.floor(rng()*5)]
        } : null,
        faults:{
          x_factor_deg:r1(20+rng()*22), lead_knee_change:r1(-15+rng()*25),
          release_height_sd_cm:r1(2+rng()*4-scoreTrend*f*0.05),
          wrist_pos_sd_cm:r1(2.5+rng()*5), trunk_tilt_sd_deg:r1(0.8+rng()*2.5),
          consistency_score:Math.round(consScore), fault_score:Math.round(faultScore),
          injury_risk:['low','low','mid','low','high'][Math.floor(rng()*5)],
          fault_count:Math.floor(rng()*5)
        }
      };
      m.energy.generation.total_W = m.energy.generation.hip_R_W+m.energy.generation.hip_L_W
        +m.energy.generation.knee_R_W+m.energy.generation.knee_L_W
        +m.energy.generation.shoulder_W+m.energy.generation.elbow_W;
      if(s.hasFitness){
        const ff = baseFitness+(rng()-0.5)*0.2;
        m.fitness = {
          cmj:{jump_height_cm:r1(28+ff*22), peak_power_w:Math.round(2400+ff*1700),
               peak_power_bm_w_kg:r1(28+ff*20), rsi_modified_ms:r2(0.30+ff*0.32),
               conc_peak_force_bm_n_kg:r1(28+ff*16), ecc_conc_force_ratio:r2(0.85+rng()*0.35)},
          sj:{jump_height_cm:r1(26+ff*20), peak_power_bm_w_kg:r1(25+ff*16), conc_peak_force_bm_n_kg:r1(26+ff*14)},
          eur:r2(1.0+(rng()-0.3)*0.2),
          pogo:{rsi_ms:r2(1.2+ff*1.2), mean_contact_time_ms:Math.round(190-ff*60), mean_jump_height_cm:r1(18+ff*14)},
          imtp:{peak_force_n:Math.round(1700+ff*900), peak_force_bm_n_kg:r1(20+ff*12),
                rfd_0_100ms_n_s:Math.round(5500+ff*4500), force_at_100ms_bm_n_kg:r1(15+ff*12),
                asymmetry_pct:r1(1+rng()*7)}
        };
        const cmjN = Math.min(100, (m.fitness.cmj.jump_height_cm-25)/25*100);
        const imtpN = Math.min(100, (m.fitness.imtp.peak_force_bm_n_kg-15)/20*100);
        m.fitness.score = Math.round((cmjN+imtpN)/2);
      } else m.fitness = null;
      out[p.id][s.id] = m;
    });
  });
  return out;
}

