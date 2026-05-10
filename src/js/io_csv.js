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
      // v5.0 — Plyo Push Up (Driveline HP 6축 호환) · 32컬럼 wide CSV 신규
      // 29컬럼 legacy CSV 시 모두 null (graceful degradation)
      pp: {
        peak_takeoff_force_bm_n_kg:    num(r.pp_peak_takeoff_force_bm_n_kg),
        peak_eccentric_force_bm_n_kg:  num(r.pp_peak_eccentric_force_bm_n_kg),
        asymmetry_pct:                 num(r.pp_asymmetry_pct),
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

