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

  // [3] 출력 (Generation)
  const out = m.energy?.generation;
  if(document.getElementById('p-out-score')){
    const s = out?.score ?? null;
    document.getElementById('p-out-score').innerHTML = `<span style="color:${scoreColor(s)}">${fmt0(s)}</span>`;
    document.getElementById('p-out-detail').textContent =
      `Pelvis ${m.sequence.pelvis_dps}° · Trunk ${m.sequence.trunk_dps}° · Power ${out?.total_W ?? '—'}W`;
  }
  // [4] 전달 (Transfer)
  const trf = m.energy?.transfer;
  if(document.getElementById('p-trf-score')){
    const s = trf?.score ?? null;
    document.getElementById('p-trf-score').innerHTML = `<span style="color:${scoreColor(s)}">${fmt0(s)}</span>`;
    document.getElementById('p-trf-detail').textContent =
      `ETE ${trf?.ete_pct ?? '—'}% · Speed Gain ${trf?.speed_gain_pt ?? '—'}× · Lag ${trf?.pelvis_to_trunk_lag_ms ?? '—'}ms`;
  }
  // [5] 누수 관리 (역 ELI)
  const leak = m.energy?.leakage;
  if(document.getElementById('p-leak-score')){
    const s = leak?.eli_score ?? null;
    document.getElementById('p-leak-score').innerHTML = `<span style="color:${scoreColor(s)}">${fmt0(s)}</span>`;
    document.getElementById('p-leak-detail').textContent =
      leak?.causal_chains?.length ? `Top: ${leak.causal_chains[0].defect}` : '6 zone · 인과 chain';
  }

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

  // 5축 에너지 라디아 — 출력 / 전달 / 누수관리 / GRF·LHEI / 제구·결함
  if(chartsP.r) chartsP.r.destroy();
  const eg = m.energy?.generation, et = m.energy?.transfer, el = m.energy?.leakage;
  chartsP.r = new Chart(document.getElementById('p-radar'),{
    type:'radar',
    data:{
      labels:['출력 (Output)','전달 (Transfer)','누수관리 (역 ELI)','GRF / LHEI','제구·결함'],
      datasets:[{
        label: p.name,
        data:[eg?.score ?? 0, et?.score ?? 0, el?.eli_score ?? 0, m.grf?.lhei ?? 0,
              // v3.0-B: command_composite 우선 사용 (없으면 기존 consistency_score)
              m.faults.command_composite ?? avg([m.faults.fault_score, m.faults.consistency_score])],
        backgroundColor:'rgba(9,105,218,.18)', borderColor:'#0969da', borderWidth:2, pointRadius:4,
        pointBackgroundColor:'#0969da'
      },{
        label:'팀 평균',
        data:[
          avg(PLAYERS.map(x=>DATA[x.id][1].energy?.generation?.score).filter(v=>v!=null)),
          avg(PLAYERS.map(x=>DATA[x.id][1].energy?.transfer?.score).filter(v=>v!=null)),
          avg(PLAYERS.map(x=>DATA[x.id][1].energy?.leakage?.eli_score).filter(v=>v!=null)),
          avg(PLAYERS.map(x=>DATA[x.id][1].grf?.lhei).filter(v=>v!=null)),
          avg(PLAYERS.map(x=>DATA[x.id][1].faults.command_composite ?? avg([DATA[x.id][1].faults.fault_score, DATA[x.id][1].faults.consistency_score])))
        ],
        backgroundColor:'rgba(130,80,223,.10)', borderColor:'#8250df', borderWidth:1.5,
        borderDash:[4,3], pointRadius:3
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
            label: function(ctx){
              return `${ctx.dataset.label}: ${Math.round(ctx.parsed.r)} / 100`;
            }
          }
        }
      },
      scales:{r:{
        suggestedMin:0, suggestedMax:100,
        grid:{color:'#eaeef2'}, angleLines:{color:'#eaeef2'},
        pointLabels:{color:'#1f2328',font:{size:12}},
        ticks:{color:'#656d76',backdropColor:'transparent',font:{size:10},stepSize:20}
      }}
    }
  });

  // 시퀀스
  if(chartsP.s) chartsP.s.destroy();
  chartsP.s = new Chart(document.getElementById('p-sequence'),{
    type:'bar',
    data:{
      labels:['골반','몸통','팔'],
      datasets:[{
        label: p.name + ' (°/s)',
        data:[m.sequence.pelvis_dps, m.sequence.trunk_dps, m.sequence.arm_dps],
        backgroundColor:['#0969da','#1a7f37','#bc4c00']
      },{
        label:'팀 평균',
        data:[
          avg(PLAYERS.map(x=>DATA[x.id][1].sequence.pelvis_dps)),
          avg(PLAYERS.map(x=>DATA[x.id][1].sequence.trunk_dps)),
          avg(PLAYERS.map(x=>DATA[x.id][1].sequence.arm_dps))
        ],
        backgroundColor:'rgba(130,80,223,.4)', borderColor:'#8250df', borderWidth:1
      }]
    },
    options:chartOpts({yTitle:'피크 각속도 (°/s)', unit:'°/s', decimals:0, beginAtZero:true})
  });

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

    // 전달 (Transfer)
    const trf = e.transfer;
    document.getElementById('p-en-trf-score').innerHTML = `<span style="color:${scoreColor(trf.score)}">${fmt0(trf.score)}</span>`;
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

  // GRF + 결함
  document.getElementById('p-lhei').innerHTML =
    `<span style="color:${scoreColor(m.grf.lhei)}">${fmt0(m.grf.lhei)}</span>`;
  document.getElementById('p-grf-type').textContent = m.grf.type;
  document.getElementById('p-rear').textContent = m.grf.rear_force_pct + '%';
  document.getElementById('p-lead').textContent = m.grf.lead_force_pct + '%';

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
  // v3.5-4: 3-tier 코호트 overlay (한국 elite + College + MLB)
  renderTierOverlay(m, p);
  renderFitnessCards(m.fitness);
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

