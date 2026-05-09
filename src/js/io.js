/* ╔══════════════════════════════════════════════════════════╗
   ║  8. Theia+GRF 결과 JSON 인입 (v1.2)                          ║
   ╚══════════════════════════════════════════════════════════╝ */

// 어떤 (선수, 세션) 셀이 실측 데이터인지 추적 — 헤더 상태 + 향후 시각 구분에 사용
const REAL_DATA_KEYS = new Set();   // "P01:1" 형식

function parseTheiaJson(obj){
  // 단일 형식 또는 배치 형식 모두 → 표준 [{pid, sid, body}, ...]로 정규화
  const out = [];
  if(Array.isArray(obj)){
    obj.forEach(o => out.push(...parseTheiaJson(o)));
    return out;
  }
  if(obj.results && Array.isArray(obj.results)){           // 배치 형식
    const sid = obj.session?.id;
    const date = obj.session?.date;
    const proto = obj.session?.protocol;
    obj.results.forEach(r => {
      out.push({
        pid: r.athlete_external_id,
        sid: r.session_id ?? sid,
        body: {...r, test_date: r.test_date ?? date, protocol: r.protocol ?? proto}
      });
    });
    return out;
  }
  if(obj.athlete_external_id && obj.session_id){           // 단일 형식
    out.push({pid: obj.athlete_external_id, sid: obj.session_id, body: obj});
  }
  return out;
}

function validateRecord(rec){
  const errs = [];
  if(!rec.pid) errs.push('athlete_external_id 누락');
  if(rec.sid==null) errs.push('session_id 누락');
  if(rec.pid && !PLAYERS.find(p=>p.id===rec.pid)) errs.push(`PLAYERS에 ${rec.pid} 없음 (선수 명단 먼저 추가 필요)`);
  if(rec.sid && !SESSIONS.find(s=>s.id===rec.sid)) errs.push(`SESSIONS에 id ${rec.sid} 없음 (1·2·3·4만 가능)`);
  return errs;
}

function applyTheiaRecord(rec){
  const b = rec.body;
  const session = SESSIONS.find(s=>s.id===rec.sid);
  // 기존 DATA[pid][sid]를 덮어쓰되, 누락된 섹션은 기존값 유지
  const cur = DATA[rec.pid][rec.sid] || {};
  const merged = {
    ...cur,
    protocol: b.protocol ?? session.protocol,
    date: b.test_date ?? session.date,
    velocity: b.velocity ? {...cur.velocity, ...b.velocity} : cur.velocity,
    sequence: b.sequence ? {...cur.sequence, ...b.sequence} : cur.sequence,
    energy:   b.energy   ? mergeEnergy(cur.energy, b.energy) : cur.energy,
    grf:      b.grf      ? {...(cur.grf||{}), ...b.grf}      : cur.grf,
    faults:   b.faults   ? {...cur.faults, ...b.faults}   : cur.faults,
    fitness:  b.fitness  ? mergeFitness(cur.fitness, b.fitness) : cur.fitness,
  };
  // analytics.js — 실측 데이터를 통계 모듈로 재계산
  enrichWithAnalytics(merged);
  DATA[rec.pid][rec.sid] = merged;
  REAL_DATA_KEYS.add(`${rec.pid}:${rec.sid}`);
}

/**
 * 실측 데이터에 analytics.js 적용 — 잠재구속 + ELI 자동 재계산
 * (potential_kmh / ELI score가 명시된 경우에만 덮어쓰지 않음)
 */
function enrichWithAnalytics(m){
  if(typeof ANALYTICS === 'undefined') return;
  // 1) 잠재구속 — 측정 구속 + 가용한 biomechanics 변수 (학년별 임계치 적용 v3.0)
  const v = m.velocity;
  // 선수 학년 찾기 (PLAYERS lookup) — pid 추적
  const pid = Object.keys(DATA).find(k => DATA[k][m.sid] === m || Object.values(DATA[k]).includes(m));
  const grade = pid ? PLAYERS.find(p => p.id === pid)?.grade : null;
  if(v && v.measured_kmh != null){
    const bio = {
      trunk_peak_dps:     m.sequence?.trunk_dps,
      pelvis_peak_dps:    m.sequence?.pelvis_dps,
      shoulder_er_deg:    m.faults?.shoulder_er_max_deg,
      stride_pct_height:  m.faults?.stride_pct_height,
      front_grf_bm:       m.grf?.lead_force_bm
    };
    const fit = {
      cmj_pp_bm:  m.fitness?.cmj?.peak_power_bm_w_kg,
      imtp_pf_bm: m.fitness?.imtp?.peak_force_bm_n_kg
    };
    const lat = ANALYTICS.latentVelocity(v.measured_kmh, bio, fit, grade);
    if(lat.potential_kmh != null){
      v.potential_kmh = lat.potential_kmh;
      v.gap_kmh       = lat.gap_kmh;
      v.contributions = lat.contributions;
      v.model         = lat.model;
    }
  }
  // v3.0-B 제구 통합 (Theia + Rapsodo)
  if(m.faults){
    const cc = ANALYTICS.commandComposite({
      release_height_sd_cm: m.faults.release_height_sd_cm,
      wrist_pos_sd_cm:      m.faults.wrist_pos_sd_cm,
      trunk_tilt_sd_deg:    m.faults.trunk_tilt_sd_deg
    }, m.rapsodo?.fastball || {});
    if(cc.composite != null){
      m.faults.command_composite = cc.composite;
      m.faults.command_theia     = cc.theia_score;
      m.faults.command_rapsodo   = cc.rapsodo_score;
      m.faults.command_agreement = cc.agreement;
      m.faults.command_warnings  = cc.warnings;
    }
  }
  // v3.2 fitness — 학년 percentile + VALD College Baseball percentile + composite
  if(m.fitness && grade){
    const cmjPctl  = ANALYTICS.gradePercentile(m.fitness.cmj?.peak_power_bm_w_kg, grade, 'cmj_pp_bm');
    const imtpPctl = ANALYTICS.gradePercentile(m.fitness.imtp?.peak_force_bm_n_kg, grade, 'imtp_pf_bm');
    const cmjVald  = ANALYTICS.valdMultiTier(m.fitness.cmj?.peak_power_bm_w_kg, 'cmj', 'conc_pp_bm');
    const cmjJhVald = ANALYTICS.valdMultiTier(m.fitness.cmj?.jump_height_cm, 'cmj', 'jump_height_cm');
    const cmjRsiVald = ANALYTICS.valdMultiTier(m.fitness.cmj?.rsi_modified_ms, 'cmj', 'rsi_modified');
    const asym = m.fitness.imtp?.asymmetry_pct;
    const asymScore = asym != null ? Math.max(0, Math.min(100, 100 - Math.max(0, asym - 5) * 8)) : null;
    // v3.5-2: 추가 fitness 변수 percentile (RSI-Mod, Pogo, IMTP RFD)
    const rsiModP = ANALYTICS.valdPercentile(m.fitness.cmj?.rsi_modified_ms, 'cmj', 'rsi_modified', 'mlb');
    const pogoRsiP = m.fitness.pogo?.rsi_ms != null ? ANALYTICS.valdPercentile(m.fitness.pogo.rsi_ms, 'hop', 'best_rsi', 'mlb') : null;
    const imtpRfdP = m.fitness.imtp?.rfd_0_100ms_n_s != null ? ANALYTICS.valdPercentile(m.fitness.imtp.rfd_0_100ms_n_s, 'squat_jump', 'conc_rfd', 'college') : null;
    const cs = ANALYTICS.compositeScore(ANALYTICS.COMPOSITE_WEIGHTS.fitness, {
      cmj_pp:        cmjPctl?.percentile,
      imtp_pf:       imtpPctl?.percentile,
      rsi_modified:  rsiModP?.percentile,
      pogo_rsi:      pogoRsiP?.percentile,
      imtp_rfd:      imtpRfdP?.percentile,
      asymmetry:     asymScore
    });
    if(cs.score != null){
      m.fitness.score = cs.score;
      m.fitness.score_breakdown = cs.breakdown;
      m.fitness.cmj_pctl_in_grade  = cmjPctl?.percentile ?? null;
      m.fitness.imtp_pctl_in_grade = imtpPctl?.percentile ?? null;
      m.fitness.vald_cmj_pp        = cmjVald;
      m.fitness.vald_cmj_jh        = cmjJhVald;
      m.fitness.vald_cmj_rsi       = cmjRsiVald;
    }
  }
  // v3.2 부상위험도 — 정식 산출
  if(m.faults && (m.faults.x_factor_deg != null || m.faults.lead_knee_change != null)){
    const ir = ANALYTICS.injuryRisk({
      x_factor_max_deg:        m.faults.x_factor_deg,
      lead_knee_change_deg:    m.faults.lead_knee_change,
      trunk_lat_tilt_deg:      m.faults.trunk_lat_tilt_deg,
      pelvis_to_trunk_lag_ms:  m.energy?.transfer?.pelvis_to_trunk_lag_ms,
      shoulder_er_max_deg:     m.faults.shoulder_er_max_deg,
      imtp_asymmetry_pct:      m.fitness?.imtp?.asymmetry_pct
    });
    m.faults.injury_risk = ir.risk_level;
    m.faults.injury_score = ir.risk_score;
    m.faults.injury_contributors = ir.contributors;
    m.faults.injury_recommendations = ir.recommendations;
  }
  // 2) ELI — Theia+GRF 회차에만 (필요 변수가 있을 때)
  if(m.protocol === 'Theia+GRF' && m.energy && m.faults){
    const elInput = {
      pelvis_to_trunk_lag_ms: m.energy.transfer?.pelvis_to_trunk_lag_ms,
      trunk_to_arm_lag_ms:    m.energy.transfer?.trunk_to_arm_lag_ms,
      x_factor_max_deg:       m.faults.x_factor_deg,
      lead_knee_change_deg:   m.faults.lead_knee_change,
      trunk_tilt_at_fc_deg:   m.faults.trunk_tilt_at_fc_deg,
      trunk_lat_tilt_deg:     m.faults.trunk_lat_tilt_deg,
      shoulder_er_max_deg:    m.faults.shoulder_er_max_deg,
      pelvis_brake_ratio:     m.faults.pelvis_brake_ratio
    };
    // 핵심 입력이 1개 이상 있을 때만 재계산 (전부 null 이면 기존 leakage 유지)
    const hasInput = Object.values(elInput).some(x => x != null);
    if(hasInput){
      const eli = ANALYTICS.eliScoresFromTheia(elInput);
      // 기존 leakage 가 있으면 부분 갱신 (수동 입력 보존)
      m.energy.leakage = { ...(m.energy.leakage || {}), ...eli };
    }
  }
}
function mergeFitness(cur, n){
  if(!cur) return n;
  return {
    cmj:  n.cmj  ? {...cur.cmj,  ...n.cmj}  : cur.cmj,
    sj:   n.sj   ? {...cur.sj,   ...n.sj}   : cur.sj,
    eur:  n.eur  ?? cur.eur,
    pogo: n.pogo ? {...cur.pogo, ...n.pogo} : cur.pogo,
    imtp: n.imtp ? {...cur.imtp, ...n.imtp} : cur.imtp,
    score: n.score ?? cur.score
  };
}
function mergeEnergy(cur, n){
  if(!cur) return n;
  return {
    generation: n.generation ? {...cur.generation, ...n.generation} : cur.generation,
    transfer:   n.transfer   ? {...cur.transfer,   ...n.transfer}   : cur.transfer,
    leakage:    n.leakage    ? {...(cur.leakage||{}), ...n.leakage} : cur.leakage,
  };
}

function refreshAllAfterImport(){
  renderM1KPI(); renderProgressGrid(); buildM1Table();
  renderM1Heatmap(); renderM1Charts();
  renderPlayerView(document.getElementById('player-select').value);
  renderRoster();
  // 장기 추적 탭 비교 분석도 갱신 (탭이 active 아니어도 갱신해 두기)
  if(document.getElementById('hc-metric')) renderHalfComparison();
  // localStorage에 자동 저장
  if(typeof saveToStorage === 'function') saveToStorage();
  // 데이터 상태 헤더 갱신
  const realCount = REAL_DATA_KEYS.size;
  const total = PLAYERS.length * SESSIONS.length;
  const el = document.getElementById('data-status');
  if(realCount === 0){
    el.textContent = '샘플 데이터 (실측 데이터 미입력)';
    el.style.color = 'var(--muted)';
  } else {
    el.innerHTML = `실측 ${realCount}/${total} 셀 + 샘플 ${total-realCount}`;
    el.style.color = 'var(--good)';
  }
}

async function handleJsonFiles(fileList){
  const result = document.getElementById('theia-json-result');
  const all = [];
  const messages = [];
  for(const file of fileList){
    try {
      const text = await file.text();
      const obj = JSON.parse(text);
      const recs = parseTheiaJson(obj);
      if(!recs.length){ messages.push(`⚠ ${file.name}: 인식 가능한 레코드 없음`); continue; }
      let ok = 0;
      recs.forEach(rec => {
        const errs = validateRecord(rec);
        if(errs.length){ messages.push(`✗ ${file.name} [${rec.pid||'?'} · S${rec.sid||'?'}]: ${errs.join(', ')}`); }
        else { applyTheiaRecord(rec); ok++; all.push(rec); }
      });
      if(ok) messages.push(`✓ ${file.name}: ${ok}개 레코드 적용`);
    } catch(e){
      messages.push(`✗ ${file.name}: JSON 파싱 실패 — ${e.message}`);
    }
  }
  if(all.length) refreshAllAfterImport();
  result.innerHTML = messages.map(m=>{
    const cls = m.startsWith('✓') ? 'good' : m.startsWith('⚠') ? 'warn' : 'bad';
    return `<div class="pill ${cls}" style="display:block;padding:6px 10px;margin:3px 0;font-weight:500">${m}</div>`;
  }).join('');
}

// 드래그 & 클릭 둘 다 지원
function setupJsonZone(){
  const zone = document.getElementById('theia-json-zone');
  const input = document.getElementById('theia-json-input');
  zone?.addEventListener('click', ()=>input.click());
  input?.addEventListener('change', e=>{
    if(e.target.files.length) handleJsonFiles([...e.target.files]);
  });
  ['dragenter','dragover'].forEach(ev=>zone?.addEventListener(ev, e=>{
    e.preventDefault(); zone.style.borderColor='var(--accent)'; zone.style.background='var(--accent-bg)';
  }));
  ['dragleave','drop'].forEach(ev=>zone?.addEventListener(ev, e=>{
    e.preventDefault(); zone.style.borderColor=''; zone.style.background='';
  }));
  zone?.addEventListener('drop', e=>{
    if(e.dataTransfer.files.length) handleJsonFiles([...e.dataTransfer.files]);
  });
}

// 템플릿 다운로드 (단일·배치 두 가지)
function downloadTemplate(kind){
  const single = {
    athlete_external_id: PLAYERS[0]?.id || 'P01',
    session_id: 1,
    test_date: SESSIONS[0]?.date || '2026-05-15',
    protocol: 'Theia+GRF',
    velocity: { measured_kmh: 132.5, potential_kmh: 138.0, score: 75 },
    sequence: { pelvis_dps: 510, trunk_dps: 850, arm_dps: 1380, ete_pct: 78, speed_gain: 1.65, proper_seq: true, score: 80 },
    // ⚡ 에너지 프레임워크 (1차 측정 헤드라인) — Theia+GRF 리포트의 핵심
    energy: {
      generation: {
        hip_R_W: 280, hip_L_W: 260, knee_R_W: 360, knee_L_W: 340,
        shoulder_W: 420, elbow_W: 240, total_W: 1900,
        mech_energy_pelvis_J: 460, mech_energy_trunk_J: 720, mech_energy_humerus_J: 290,
        score: 78
      },
      transfer: {
        ete_pct: 78, speed_gain_pt: 1.65, speed_gain_ta: 1.45, proper_seq: true,
        pelvis_to_trunk_lag_ms: 65, trunk_to_arm_lag_ms: 50, score: 80
      },
      leakage: {
        zone1_sequence: 85, zone2_x_factor: 70, zone3_lead_block: 65,
        zone4_trunk_at_fc: 78, zone5_shoulder_align: 82, zone6_pelvis_brake: 68,
        eli_score: 75,
        causal_chains: [
          { zone:'zone3', zone_label:'앞발 받쳐주기 (블로킹) 약함', defect:'Lead knee collapse',  impact_kmh: -2.9 },
          { zone:'zone6', zone_label:'골반 감속 (브레이크) 부족',   defect:'Pelvis braking 부족', impact_kmh: -2.7 },
          { zone:'zone2', zone_label:'골반-상체 분리 (X-팩터) 부족', defect:'X-factor 미달',     impact_kmh: -2.5 }
        ]
      }
    },
    grf: { lhei: 72, rear_force_pct: 88, lead_force_pct: 92, type: '균형형' },
    faults: { x_factor_deg: 38, lead_knee_change: -8, release_height_sd_cm: 4.2,
              wrist_pos_sd_cm: 5.1, trunk_tilt_sd_deg: 1.8,
              consistency_score: 82, fault_score: 75, injury_risk: 'low', fault_count: 2 },
    fitness: {
      cmj:  { jump_height_cm: 41.0, peak_power_w: 3460, peak_power_bm_w_kg: 42.0,
              rsi_modified_ms: 0.50, conc_peak_force_bm_n_kg: 40.5, ecc_conc_force_ratio: 1.05 },
      sj:   { jump_height_cm: 39.3, peak_power_bm_w_kg: 32.7, conc_peak_force_bm_n_kg: 35.2 },
      eur: 1.04,
      pogo: { rsi_ms: 1.85, mean_contact_time_ms: 148, mean_jump_height_cm: 26.5 },
      imtp: { peak_force_n: 2117, peak_force_bm_n_kg: 25.71,
              rfd_0_100ms_n_s: 8240, force_at_100ms_bm_n_kg: 21.8, asymmetry_pct: 3.2 }
    }
  };
  const batch = {
    session: { id: 1, date: SESSIONS[0]?.date || '2026-05-15', protocol: 'Theia+GRF' },
    results: PLAYERS.slice(0,3).map((p,i)=>({
      athlete_external_id: p.id,
      velocity: { measured_kmh: 130 + i*2, potential_kmh: 138 + i*2, score: 70 + i*3 },
      sequence: { pelvis_dps: 500 + i*10, trunk_dps: 830 + i*10, arm_dps: 1350 + i*15,
                  ete_pct: 75 + i, speed_gain: 1.6 + i*0.05, proper_seq: true, score: 75 + i*2 },
      grf: { lhei: 70 + i*3, rear_force_pct: 85, lead_force_pct: 90, type: '균형형' },
      faults: { x_factor_deg: 36 + i, lead_knee_change: -5,
                release_height_sd_cm: 4.0, wrist_pos_sd_cm: 5.0, trunk_tilt_sd_deg: 1.5,
                consistency_score: 80, fault_score: 75, injury_risk: 'low', fault_count: 1 }
    }))
  };
  const data = kind === 'single' ? single : batch;
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = kind === 'single' ? 'theia_grf_template_single.json' : 'theia_grf_template_batch.json';
  a.click();
}

/* ╔══════════════════════════════════════════════════════════╗
   ║  8b. CSV 파서 — ForceDecks + Rapsodo 자동 인입 (v1.16)        ║
   ╚══════════════════════════════════════════════════════════╝ */

// 가벼운 RFC4180 CSV 파서 (인용부호 안 콤마/줄바꿈 처리)
function parseCSV(text){
  const rows = []; let row = []; let cur = ''; let inQ = false;
  text = text.replace(/﻿/, '');  // BOM 제거
  for(let i=0; i<text.length; i++){
    const c = text[i], n = text[i+1];
    if(inQ){
      if(c === '"' && n === '"'){ cur += '"'; i++; }
      else if(c === '"'){ inQ = false; }
      else { cur += c; }
    } else {
      if(c === '"'){ inQ = true; }
      else if(c === ','){ row.push(cur); cur = ''; }
      else if(c === '\n' || c === '\r'){
        if(cur !== '' || row.length){ row.push(cur); rows.push(row); row = []; cur = ''; }
        if(c === '\r' && n === '\n') i++;
      } else { cur += c; }
    }
  }
  if(cur !== '' || row.length){ row.push(cur); rows.push(row); }
  if(!rows.length) return {header:[], rows:[]};
  const header = rows[0].map(h => h.trim());
  const data = rows.slice(1).filter(r => r.length === header.length || r.length>1)
    .map(r => Object.fromEntries(header.map((h,i) => [h, (r[i]||'').trim()])));
  return {header, rows: data};
}
function num(v){ if(v==null||v==='') return null; const n = parseFloat(v); return isNaN(n)?null:n; }

// ForceDecks CSV → DATA[pid][1].fitness 자동 매핑
function importValdCSV(text){
  const {header, rows} = parseCSV(text);
  const required = ['athlete_external_id','test_date'];
  const missing = required.filter(c => !header.includes(c));
  if(missing.length) return {ok:0, errors:[`필수 컬럼 누락: ${missing.join(', ')}`], applied:[]};

  const errors = [], applied = [];
  rows.forEach((r,i) => {
    const pid = r.athlete_external_id;
    if(!pid){ errors.push(`행 ${i+2}: athlete_external_id 비어있음`); return; }
    const player = PLAYERS.find(p => p.id === pid);
    if(!player){ errors.push(`행 ${i+2}: PLAYERS에 ${pid} 없음 (스킵)`); return; }

    // 회차 결정 — test_date가 SESSIONS 중 어느 것과 매칭되는지
    let sid = 1;
    const matchSes = SESSIONS.find(s => s.date === r.test_date);
    if(matchSes) sid = matchSes.id;

    if(!DATA[pid][sid]) DATA[pid][sid] = {protocol: SESSIONS.find(s=>s.id===sid).protocol, date: r.test_date};

    const fitness = {
      cmj: {
        jump_height_cm:           num(r.cmj_jump_height_cm),
        peak_power_w:             num(r.cmj_peak_power_w),
        peak_power_bm_w_kg:       num(r.cmj_peak_power_bm_w_kg),
        rsi_modified_ms:          num(r.cmj_rsi_modified_ms),
        conc_peak_force_bm_n_kg:  num(r.cmj_concentric_peak_force_bm_n_kg),
        ecc_conc_force_ratio:     num(r.cmj_eccentric_concentric_force_ratio),
      },
      sj: {
        jump_height_cm:           num(r.sj_jump_height_cm),
        peak_power_bm_w_kg:       num(r.sj_peak_power_bm_w_kg),
        conc_peak_force_bm_n_kg:  num(r.sj_concentric_peak_force_bm_n_kg),
      },
      eur: num(r.eur),
      pogo: {
        rsi_ms:                   num(r.pogo_rsi_ms),
        mean_contact_time_ms:     num(r.pogo_mean_contact_time_ms),
        mean_jump_height_cm:      num(r.pogo_mean_jump_height_cm),
      },
      imtp: {
        peak_force_n:             num(r.imtp_peak_vertical_force_n),
        peak_force_bm_n_kg:       num(r.imtp_peak_vertical_force_bm_n_kg),
        rfd_0_100ms_n_s:          num(r.imtp_rfd_0_100ms_n_s),
        force_at_100ms_bm_n_kg:   num(r.imtp_force_at_100ms_bm_n_kg),
        asymmetry_pct:            num(r.imtp_asymmetry_pct),
      },
    };
    // 체력 종합 점수 — CMJ JH(25cm 기준 0, 50cm 만점) + IMTP PF/BM(15 기준 0, 35 만점)
    const cmjN  = fitness.cmj.jump_height_cm  != null ? Math.max(0,Math.min(100,(fitness.cmj.jump_height_cm-25)/25*100)) : null;
    const imtpN = fitness.imtp.peak_force_bm_n_kg != null ? Math.max(0,Math.min(100,(fitness.imtp.peak_force_bm_n_kg-15)/20*100)) : null;
    const parts = [cmjN, imtpN].filter(v => v != null);
    fitness.score = parts.length ? Math.round(parts.reduce((a,b)=>a+b,0)/parts.length) : null;

    DATA[pid][sid].fitness = fitness;
    REAL_DATA_KEYS.add(`${pid}:${sid}`);
    applied.push({pid, sid});
  });
  return {ok: applied.length, errors, applied};
}

// 원본 Rapsodo 2.0 CSV (45컬럼 메타 헤더 형식) 자동 감지 및 정규화
function detectAndNormalizeRapsodoV2(text){
  // 첫 5줄에 'Player ID:', 'Player Name:', '"No"' 패턴이 있으면 원본 v2.0
  const lines = text.split(/\r?\n/);
  const headerIdx = lines.findIndex(l => l.startsWith('"No"') || l.startsWith('No,'));
  if(headerIdx < 0 || headerIdx > 6) return null;  // 표준 형식
  // 메타 추출
  let playerName = '';
  for(let i = 0; i < headerIdx; i++){
    if(lines[i].startsWith('"Player Name:"')){
      playerName = (lines[i].split(',')[1] || '').replace(/"/g,'').trim();
    }
  }
  // PID 추출 (P 01 → P01, P01 → P01)
  const pidMatch = playerName.match(/P\s*(\d+)/i);
  const pid = pidMatch ? `P${pidMatch[1].padStart(2,'0')}` : 'P01';
  // 헤더부터 끝까지 파싱
  const csvBody = lines.slice(headerIdx).join('\n');
  const {header, rows} = parseCSV(csvBody);
  // 표준 컬럼으로 매핑
  const out = ['athlete_external_id,athlete_name,test_date,session_id,pitch_type,pitch_no,'+
               'velocity_kmh,plate_velocity_kmh,velocity_loss_pct,'+
               'spin_rpm,true_spin_rpm,spin_efficiency_pct,spin_axis_clock,spin_axis_deg,gyro_degree,'+
               'ivb_cm,hb_cm,vb_total_cm,'+
               'release_height_m,release_side_m,release_extension_m,release_angle_deg,'+
               'vaa_deg,haa_deg,plate_height_cm,plate_side_cm,in_zone,bauer_units'];
  function clkToDeg(s){
    const m = (s||'').match(/(\d+):(\d+)/); if(!m) return '';
    return Math.round(((+m[1]) % 12) * 30 + (+m[2]) / 2 * 10) / 10;
  }
  function n(v){ const x = parseFloat(v); return (isNaN(x) || v==='-' || v==='') ? '' : x; }
  rows.forEach((r, i) => {
    const vel = n(r['Velocity']);
    const spin = n(r['Total Spin']);
    const ext_ft = n(r['Release Extension (ft)']);
    const ext_m = (ext_ft !== '') ? Math.round(ext_ft * 0.3048 * 100) / 100 : '';
    const plate_vel = (vel !== '') ? Math.round(vel * 0.93 * 10) / 10 : '';
    const velo_loss = (vel !== '' && plate_vel !== '') ? Math.round((vel - plate_vel) / vel * 100 * 10) / 10 : '';
    const bauer = (vel !== '' && spin !== '') ? Math.round(spin / (vel * 0.621371) * 10) / 10 : '';
    const inZone = r['Is Strike'] === 'Y' ? 1 : 0;
    const pType = (r['Pitch Type'] || '').includes('Fastball') ? 'FB' : (r['Pitch Type'] || '');
    out.push([pid, playerName, r['Date'] || '2026-05-15', `SES_${pid}`,
              pType, i + 1,
              vel, plate_vel, velo_loss,
              spin, n(r['True Spin (release)']), n(r['Spin Efficiency (release)']),
              r['Spin Direction'] || '', clkToDeg(r['Spin Direction']), n(r['Gyro Degree (deg)']),
              n(r['VB (trajectory)']), n(r['HB (trajectory)']),
              (n(r['VB (trajectory)']) !== '') ? Math.round((n(r['VB (trajectory)']) - 30)*10)/10 : '',
              n(r['Release Height']), n(r['Release Side']), ext_m, n(r['Release Angle']),
              n(r['Vertical Approach Angle']), n(r['Horizontal Approach Angle']),
              n(r['Strike Zone Height']), n(r['Strike Zone Side']),
              inZone, bauer].join(','));
  });
  return out.join('\n');
}

// Rapsodo 2.0 통계 헬퍼
function _stat(arr){
  const v = arr.filter(x => x != null && !isNaN(x));
  if(!v.length) return {n:0, avg:null, sd:null, min:null, max:null};
  const avg = v.reduce((a,b)=>a+b,0) / v.length;
  const sd = v.length > 1 ? Math.sqrt(v.reduce((s,x) => s + (x-avg)**2, 0) / (v.length-1)) : 0;
  return {n: v.length, avg, sd, min: Math.min(...v), max: Math.max(...v)};
}
function _rd(x, dec=1){ return x==null||isNaN(x) ? null : Math.round(x * 10**dec) / 10**dec; }

// KBO/HS 코호트 평균 — 비교 평가용
const RAPSODO_BENCHMARKS = {
  KBO: {velo:142.0, spin:2200, eff:88, ivb:42, bauer:25.5, vaa:-5.0, ext:1.95},
  HS:  {velo:128.0, spin:2050, eff:82, ivb:35, bauer:25.0, vaa:-5.5, ext:1.85},
};

// Rapsodo CSV → 선수별 FB 풀 분석 + velocity·release SD 매핑
function importRapsodoCSV(text){
  // 원본 Rapsodo 2.0 형식이면 자동 정규화
  const normalized = detectAndNormalizeRapsodoV2(text);
  if(normalized) text = normalized;

  const {header, rows} = parseCSV(text);
  const required = ['athlete_external_id','pitch_type','velocity_kmh'];
  const missing = required.filter(c => !header.includes(c));
  if(missing.length) return {ok:0, errors:[`필수 컬럼 누락: ${missing.join(', ')}`], applied:[]};

  // 선수별 그룹화
  const byPid = {};
  rows.forEach(r => {
    const pid = r.athlete_external_id; if(!pid) return;
    if(!byPid[pid]) byPid[pid] = [];
    byPid[pid].push(r);
  });

  const errors = [], applied = [];
  Object.entries(byPid).forEach(([pid, throws]) => {
    const player = PLAYERS.find(p => p.id === pid);
    if(!player){ errors.push(`${pid}: PLAYERS에 없음 (스킵)`); return; }
    const fb = throws.filter(t => t.pitch_type === 'FB' || t.pitch_type === 'Fastball');
    if(!fb.length){ errors.push(`${pid}: FB throw 없음 — 첫 throw 사용`); fb.push(throws[0]); }

    // ── 변수별 통계 ──
    const stats = {
      velocity:        _stat(fb.map(t => num(t.velocity_kmh))),
      plate_velocity:  _stat(fb.map(t => num(t.plate_velocity_kmh))),
      velo_loss:       _stat(fb.map(t => num(t.velocity_loss_pct))),
      spin:            _stat(fb.map(t => num(t.spin_rpm))),
      true_spin:       _stat(fb.map(t => num(t.true_spin_rpm))),
      spin_eff:        _stat(fb.map(t => num(t.spin_efficiency_pct))),
      spin_axis_deg:   _stat(fb.map(t => num(t.spin_axis_deg))),
      gyro:            _stat(fb.map(t => num(t.gyro_degree))),
      ivb:             _stat(fb.map(t => num(t.ivb_cm))),
      hb:              _stat(fb.map(t => num(t.hb_cm))),
      vb_total:        _stat(fb.map(t => num(t.vb_total_cm))),
      release_height:  _stat(fb.map(t => num(t.release_height_m))),
      release_side:    _stat(fb.map(t => num(t.release_side_m))),
      release_ext:     _stat(fb.map(t => num(t.release_extension_m))),
      release_angle:   _stat(fb.map(t => num(t.release_angle_deg))),
      vaa:             _stat(fb.map(t => num(t.vaa_deg))),
      haa:             _stat(fb.map(t => num(t.haa_deg))),
      plate_height:    _stat(fb.map(t => num(t.plate_height_cm))),
      plate_side:      _stat(fb.map(t => num(t.plate_side_cm))),
      bauer:           _stat(fb.map(t => num(t.bauer_units))),
    };
    if(!stats.velocity.n){ errors.push(`${pid}: velocity_kmh 모두 빈 값`); return; }
    const inZone = fb.filter(t => num(t.in_zone) === 1).length;

    // ── 합성지표 — v3.1: ANALYTICS.stuffScore 사용 (학년 코호트 자동) ──
    const COH = RAPSODO_BENCHMARKS.KBO;
    let stuff_score, stuff_components, stuff_cohort;
    if(typeof ANALYTICS !== 'undefined'){
      // 학년별 코호트 자동 선택
      const playerCohort = player.grade ? `HS-${player.grade}` : 'HS';
      const ss = ANALYTICS.stuffScore({
        velocity_kmh:        stats.velocity.avg,
        spin_rpm:            stats.spin.avg,
        ivb_cm:              stats.ivb.avg,
        hb_cm:               stats.hb.avg,
        spin_efficiency_pct: stats.spin_eff.avg
      }, playerCohort);
      stuff_score      = ss.stuff_score;
      stuff_components = ss.components;
      stuff_cohort     = ss.cohort;
    } else {
      // fallback: 기존 단순 식
      const sv = Math.max(0, Math.min(100, 50 + (stats.velocity.avg - COH.velo) * 4));
      const ss = Math.max(0, Math.min(100, 50 + (stats.spin.avg - COH.spin) / 10));
      stuff_score = Math.round(sv*0.5 + ss*0.5);
    }
    // Command (제구) = release SD (height·side·ext), in_zone% 가중
    const rh_sd_cm = (stats.release_height.sd || 0) * 100;
    const rs_sd_cm = (stats.release_side.sd || 0) * 100;
    const cmd_rh = Math.max(0, Math.min(100, 100 - rh_sd_cm * 12));
    const cmd_rs = Math.max(0, Math.min(100, 100 - rs_sd_cm * 12));
    const cmd_zone = stats.velocity.n ? (inZone / stats.velocity.n) * 100 : 0;
    const command_score = Math.round(cmd_rh*0.35 + cmd_rs*0.35 + cmd_zone*0.30);

    // 회차 — test_date 매칭 (없으면 1차)
    const td = fb[0].test_date;
    const matchSes = SESSIONS.find(s => s.date === td);
    const sid = matchSes ? matchSes.id : 1;
    if(!DATA[pid][sid]) DATA[pid][sid] = {protocol: SESSIONS.find(s=>s.id===sid).protocol, date: td};
    const cur = DATA[pid][sid];

    // velocity 핵심 — 기존 필드 유지하면서 채움
    cur.velocity = {
      ...(cur.velocity || {}),
      measured_kmh:     _rd(stats.velocity.max, 1),
      measured_avg_kmh: _rd(stats.velocity.avg, 1),
      measured_sd:      _rd(stats.velocity.sd, 2),
      n_throws:         stats.velocity.n,
    };
    cur.faults = {
      ...(cur.faults || {}),
      release_height_sd_cm: _rd(rh_sd_cm, 1),
      wrist_pos_sd_cm:      _rd(rs_sd_cm, 1),
    };

    // ── Rapsodo 풀 블록 (구질별 — 현재는 FB 만, 추후 SL/CB/CH 확장) ──
    cur.rapsodo = {
      ...(cur.rapsodo || {}),
      fb: {
        n_throws: stats.velocity.n,
        velocity:  {max:_rd(stats.velocity.max,1), avg:_rd(stats.velocity.avg,1),
                    min:_rd(stats.velocity.min,1), sd:_rd(stats.velocity.sd,2)},
        plate_velocity: {avg:_rd(stats.plate_velocity.avg,1), sd:_rd(stats.plate_velocity.sd,2)},
        velo_loss_pct:  _rd(stats.velo_loss.avg,1),
        spin:           {avg:Math.round(stats.spin.avg||0), sd:_rd(stats.spin.sd,0)},
        true_spin_avg:  Math.round(stats.true_spin.avg||0),
        spin_eff:       {avg:_rd(stats.spin_eff.avg,1), sd:_rd(stats.spin_eff.sd,1)},
        spin_axis_deg:  _rd(stats.spin_axis_deg.avg,0),
        gyro_avg:       _rd(stats.gyro.avg,1),
        bauer_units:    _rd(stats.bauer.avg,1),
        ivb:            {avg:_rd(stats.ivb.avg,1), sd:_rd(stats.ivb.sd,1)},
        hb:             {avg:_rd(stats.hb.avg,1), sd:_rd(stats.hb.sd,1)},
        vb_total_avg:   _rd(stats.vb_total.avg,1),
        release: {
          height_avg: _rd(stats.release_height.avg,2),
          height_sd_cm: _rd(rh_sd_cm,1),
          side_avg:   _rd(stats.release_side.avg,2),
          side_sd_cm: _rd(rs_sd_cm,1),
          extension_avg: _rd(stats.release_ext.avg,2),
          extension_sd: _rd((stats.release_ext.sd||0)*100,1),
          angle_avg:  _rd(stats.release_angle.avg,1),
        },
        vaa_avg: _rd(stats.vaa.avg,2),
        haa_avg: _rd(stats.haa.avg,2),
        plate: {
          height_avg: _rd(stats.plate_height.avg,1),
          side_avg:   _rd(stats.plate_side.avg,1),
        },
        in_zone_pct: Math.round(cmd_zone),
        // 합성 (v3.1: 학년 코호트 기반)
        stuff_score,
        stuff_components: stuff_components || null,
        stuff_cohort:     stuff_cohort || 'KBO',
        command_score,
        // 원본 throws (선수별 산점도용 — 첫 5개만 보존)
        throws: fb.slice(0, 30).map(t => ({
          pitch_no: num(t.pitch_no), velocity: num(t.velocity_kmh),
          spin: num(t.spin_rpm), spin_eff: num(t.spin_efficiency_pct),
          ivb: num(t.ivb_cm), hb: num(t.hb_cm),
          rh: num(t.release_height_m), rs: num(t.release_side_m),
          ext: num(t.release_extension_m), vaa: num(t.vaa_deg),
          plate_h: num(t.plate_height_cm), plate_s: num(t.plate_side_cm),
          in_zone: num(t.in_zone)===1
        }))
      }
    };
    REAL_DATA_KEYS.add(`${pid}:${sid}`);
    applied.push({pid, sid, ...stats.velocity, stuff_score, command_score});
  });
  return {ok: applied.length, errors, applied};
}

async function handleCSVFiles(fileList, kind){
  const wrapId = kind === 'vald' ? 'vald-csv-result' : 'rapsodo-csv-result';
  const wrap = document.getElementById(wrapId);
  const messages = [];
  for(const file of fileList){
    try {
      const text = await file.text();
      const result = (kind === 'vald' ? importValdCSV : importRapsodoCSV)(text);
      if(result.ok) messages.push(`✓ ${file.name}: ${result.ok}명 인입 완료`);
      else messages.push(`⚠ ${file.name}: 인입 0건`);
      result.errors.slice(0, 5).forEach(e => messages.push(`  · ${e}`));
      if(result.errors.length > 5) messages.push(`  · ... 외 ${result.errors.length - 5}건`);
    } catch(e){
      messages.push(`✗ ${file.name}: 파싱 실패 — ${e.message}`);
    }
  }
  wrap.innerHTML = messages.map(m => {
    const cls = m.startsWith('✓') ? 'good' : m.startsWith('⚠') ? 'warn' : m.startsWith('  ') ? '' : 'bad';
    return cls
      ? `<div class="pill ${cls}" style="display:block;padding:6px 10px;margin:3px 0;font-weight:500">${m}</div>`
      : `<div style="padding:2px 18px;color:var(--muted);font-size:11px">${m}</div>`;
  }).join('');
  refreshAllAfterImport();
}

function setupCSVZone(kind){
  const ids = kind === 'vald'
    ? {zone: 'vald-csv-zone', input: 'vald-csv-input'}
    : {zone: 'rapsodo-csv-zone', input: 'rapsodo-csv-input'};
  const zone = document.getElementById(ids.zone);
  const input = document.getElementById(ids.input);
  if(!zone || !input) return;
  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', e => {
    if(e.target.files.length) handleCSVFiles([...e.target.files], kind);
  });
  ['dragenter','dragover'].forEach(ev => zone.addEventListener(ev, e => {
    e.preventDefault(); zone.style.borderColor = 'var(--accent)'; zone.style.background = 'var(--accent-bg)';
  }));
  ['dragleave','drop'].forEach(ev => zone.addEventListener(ev, e => {
    e.preventDefault(); zone.style.borderColor = ''; zone.style.background = '';
  }));
  zone.addEventListener('drop', e => {
    if(e.dataTransfer.files.length) handleCSVFiles([...e.dataTransfer.files], kind);
  });
}

function resetToSampleData(){
  if(!confirm('실측 데이터 인입분을 모두 버리고 샘플로 되돌립니다.\n저장된 localStorage도 함께 삭제됩니다. 진행할까요?')) return;
  // 새 샘플 데이터 생성
  Object.keys(DATA).forEach(k => delete DATA[k]);
  Object.assign(DATA, genMeasurements());
  REAL_DATA_KEYS.clear();
  clearStorage();
  refreshAllAfterImport();
}

/* ╔══════════════════════════════════════════════════════════╗
   ║  8b. localStorage 자동 저장/복원 (v1.6)                       ║
   ╚══════════════════════════════════════════════════════════╝ */

const STORAGE_KEY = 'sangdong_dashboard_v1';
let __saveTimer = null;

function saveToStorage(){
  // 디바운스 — 짧은 시간 내 여러 변경은 한 번만 저장
  clearTimeout(__saveTimer);
  __saveTimer = setTimeout(()=>{
    try {
      // REAL_DATA_KEYS만 있는 셀(실측)만 저장. 샘플은 페이지 reload 시 재생성.
      const realData = {};
      REAL_DATA_KEYS.forEach(key=>{
        const [pid, sid] = key.split(':');
        if(!realData[pid]) realData[pid] = {};
        realData[pid][sid] = DATA[pid][sid];
      });
      const payload = {
        version: 1,
        savedAt: new Date().toISOString(),
        players: PLAYERS,
        realData,
        realKeys: [...REAL_DATA_KEYS]
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      updateStorageBadge('saved');
    } catch(e){
      console.warn('localStorage 저장 실패:', e);
      updateStorageBadge('error');
    }
  }, 400);
}

function loadFromStorage(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return false;
    const payload = JSON.parse(raw);
    // 선수 명단 복원 (저장된 게 더 최신이라 가정)
    if(Array.isArray(payload.players) && payload.players.length){
      PLAYERS.length = 0;
      payload.players.forEach(p=>PLAYERS.push(p));
    }
    // 샘플 데이터 먼저 생성
    Object.keys(DATA).forEach(k=>delete DATA[k]);
    Object.assign(DATA, genMeasurements());
    // 실측 셀만 덮어쓰기
    if(payload.realData){
      Object.entries(payload.realData).forEach(([pid, sessions])=>{
        if(!DATA[pid]) return;
        Object.entries(sessions).forEach(([sid, body])=>{
          DATA[pid][sid] = body;
        });
      });
    }
    if(Array.isArray(payload.realKeys)){
      payload.realKeys.forEach(k=>REAL_DATA_KEYS.add(k));
    }
    return true;
  } catch(e){
    console.warn('localStorage 복원 실패:', e);
    return false;
  }
}

function clearStorage(){
  try { localStorage.removeItem(STORAGE_KEY); updateStorageBadge('cleared'); }
  catch(e){ console.warn(e); }
}

function updateStorageBadge(state){
  const el = document.getElementById('storage-badge');
  if(!el) return;
  const map = {
    saved:   {txt:'💾 자동 저장됨', cls:'good'},
    cleared: {txt:'저장소 비움', cls:'warn'},
    error:   {txt:'⚠ 저장 실패', cls:'bad'},
    loaded:  {txt:'💾 저장된 데이터 복원됨', cls:'good'},
    none:    {txt:'저장된 데이터 없음', cls:'warn'}
  };
  const m = map[state] || map.none;
  el.textContent = m.txt;
  el.className = 'pill ' + m.cls;
}

/* refreshAllAfterImport()의 마지막 줄에서 saveToStorage()가 호출됨 (아래 함수 정의 참고) */

