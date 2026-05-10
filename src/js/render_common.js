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

