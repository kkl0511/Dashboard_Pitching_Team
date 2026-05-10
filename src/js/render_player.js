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

    // 시퀀스 품질 평가
    // v5.36: markered standard (30-60 / 25-45) → markerless KR cohort 분포 기준
    //   Pelvis→Trunk: KR markerless에서 -10~80ms (p10-p90), markerless 골반 인식 한계 반영
    //   Trunk→Humerus: KR cohort 60-150ms (xlsx p10-p90 = 60-150)
    const inRange = (v, lo, hi) => v >= lo && v <= hi;
    const ptOK = inRange(ptLag, 0, 80);     // markerless ideal acceptable
    const taOK = inRange(taLag, 40, 130);   // markerless ideal acceptable
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

