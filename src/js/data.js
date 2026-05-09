/* ╔══════════════════════════════════════════════════════════╗
   ║  1. 데이터 스키마 + 샘플 데이터                              ║
   ╚══════════════════════════════════════════════════════════╝ */

/* 측정 일정 — 상반기/하반기 각 2회씩, Theia+GRF → Uplift 순.
   날짜는 임시값. 실제 일정 확정 시 date 필드만 수정하면 헤더·KPI·일정 카드 모두 자동 반영. */
const SESSIONS = [
  {id:1, label:'1차', date:'2026-05-15', protocol:'Theia+GRF', hasFitness:true,  half:'상반기'},
  {id:2, label:'2차', date:'2026-07-10', protocol:'Uplift',     hasFitness:false, half:'상반기'},
  {id:3, label:'3차', date:'2026-09-25', protocol:'Theia+GRF', hasFitness:true,  half:'하반기'},
  {id:4, label:'4차', date:'2026-11-20', protocol:'Uplift',     hasFitness:false, half:'하반기'},
];

/* 선수 명단 — 행을 자유롭게 추가/삭제. 대시보드 모든 화면이 자동으로 인원수에 맞게 재배치됨.
   필수 필드: id, name, arm('R'|'L'), grade(1|2|3 — 고교 학년), height(cm), weight(kg), dob(YYYY-MM-DD).
   샘플 20명: 고1(P01~P07) 7명 · 고2(P08~P14) 7명 · 고3(P15~P20) 6명. 실제 명단으로 갱신. */
const PLAYERS = [
  {id:'P01', name:'선수01', arm:'R', grade:1, height:172, weight:68, dob:'2010-03-15'},
  {id:'P02', name:'선수02', arm:'R', grade:1, height:175, weight:71, dob:'2010-06-22'},
  {id:'P03', name:'선수03', arm:'L', grade:1, height:170, weight:65, dob:'2010-01-10'},
  {id:'P04', name:'선수04', arm:'R', grade:1, height:174, weight:69, dob:'2010-09-04'},
  {id:'P05', name:'선수05', arm:'R', grade:1, height:168, weight:62, dob:'2010-04-18'},
  {id:'P06', name:'선수06', arm:'L', grade:1, height:178, weight:73, dob:'2010-11-30'},
  {id:'P07', name:'선수07', arm:'R', grade:1, height:173, weight:67, dob:'2010-02-25'},
  {id:'P08', name:'선수08', arm:'R', grade:2, height:177, weight:73, dob:'2009-07-12'},
  {id:'P09', name:'선수09', arm:'R', grade:2, height:181, weight:79, dob:'2009-12-08'},
  {id:'P10', name:'선수10', arm:'L', grade:2, height:175, weight:71, dob:'2009-05-19'},
  {id:'P11', name:'선수11', arm:'R', grade:2, height:183, weight:81, dob:'2009-10-03'},
  {id:'P12', name:'선수12', arm:'R', grade:2, height:178, weight:74, dob:'2009-03-27'},
  {id:'P13', name:'선수13', arm:'R', grade:2, height:172, weight:68, dob:'2009-08-15'},
  {id:'P14', name:'선수14', arm:'R', grade:2, height:180, weight:77, dob:'2009-04-09'},
  {id:'P15', name:'선수15', arm:'L', grade:3, height:185, weight:84, dob:'2008-08-21'},
  {id:'P16', name:'선수16', arm:'R', grade:3, height:178, weight:75, dob:'2008-06-14'},
  {id:'P17', name:'선수17', arm:'R', grade:3, height:181, weight:78, dob:'2008-05-30'},
  {id:'P18', name:'선수18', arm:'R', grade:3, height:183, weight:80, dob:'2008-09-11'},
  {id:'P19', name:'선수19', arm:'R', grade:3, height:179, weight:76, dob:'2008-07-25'},
  {id:'P20', name:'선수20', arm:'L', grade:3, height:184, weight:82, dob:'2008-01-19'},
];

function seedRand(seed){let s=seed;return ()=>{s=(s*9301+49297)%233280;return s/233280}}
function r1(x){return Math.round(x*10)/10}
function r2(x){return Math.round(x*100)/100}

function genMeasurements(){
  const out = {};
  PLAYERS.forEach((p, idx) => {
    const rng = seedRand(idx*131+7);
    const baseVelo = 118 + rng()*22;
    const trend  = -2 + rng()*8;
    const baseScore = 50 + rng()*35;
    const scoreTrend = -3 + rng()*15;
    const armVelBase = 1100 + rng()*500;
    const baseFitness = 0.4 + rng()*0.5;  // 0.4~0.9
    out[p.id] = {};
    SESSIONS.forEach((s, si) => {
      const f = si/3;
      const noise = (rng()-0.5)*4;
      const velo = baseVelo + trend*f + noise;
      const score = Math.max(20,Math.min(98, baseScore + scoreTrend*f + (rng()-0.5)*6));
      const seqScore = Math.max(20,Math.min(98, baseScore - 5 + scoreTrend*f*0.8 + (rng()-0.5)*8));
      const consScore = Math.max(20,Math.min(98, baseScore + 5 + scoreTrend*f*0.5 + (rng()-0.5)*10));
      const faultScore = Math.max(20,Math.min(98, 100 - (baseScore*0.3) + scoreTrend*f - (rng()-0.5)*8));

      const isTheia = s.protocol === 'Theia+GRF';
      const sysScale = isTheia ? 1.0 : 1.9;

      // Theia 핵심 변수 미리 산출 (latentVelocity·ELI 둘 다에서 재사용)
      const trunk_dps  = Math.round((780 + rng()*180) * sysScale * 0.8);
      const pelvis_dps = Math.round((480 + rng()*80) * sysScale);
      const arm_dps    = Math.round(armVelBase + rng()*400);
      const x_factor   = r1(20 + rng()*22);
      const lead_knee  = r1(-15 + rng()*25);
      const trunk_fwd  = r1(20 + rng()*20);
      const trunk_lat  = r1(rng()*18);
      const er_max     = r1(150 + rng()*40);
      const stride_pct = r1(78 + rng()*15);
      const front_grf  = r1(1.2 + rng()*0.8);
      const brake_ratio= r2(0.25 + rng()*0.55);
      const pt_lag     = Math.round(40 + rng()*60);
      const ta_lag     = Math.round(30 + rng()*50);

      // 잠재구속 — analytics.js 정식 회귀 (문헌 가중치)
      const latentInput_bio = {
        trunk_peak_dps: trunk_dps, pelvis_peak_dps: pelvis_dps,
        shoulder_er_deg: er_max, stride_pct_height: stride_pct,
        front_grf_bm: front_grf
      };
      // 체력은 hasFitness 회차에만 — 임시값 미리 (아래에서 재사용)
      const tmpFit = s.hasFitness ? {
        cmj_pp_bm: r1(28 + (baseFitness + (rng()-0.5)*0.2)*20),
        imtp_pf_bm: r1(20 + (baseFitness + (rng()-0.5)*0.2)*12)
      } : {};
      // 학년별 임계치 보정 — analytics v3.0
      const latent = (typeof ANALYTICS !== 'undefined')
        ? ANALYTICS.latentVelocity(velo, latentInput_bio, tmpFit, p.grade)
        : { potential_kmh: r1(velo + 6), gap_kmh: 6, contributions: [], model: 'fallback' };

      // v3.9: 한국 cohort 자체 회귀 모델
      const krPred = (typeof ANALYTICS !== 'undefined' && typeof ANALYTICS.predictMaxVelocityKR === 'function')
        ? ANALYTICS.predictMaxVelocityKR({
            pelvis_peak_dps:    pelvis_dps,
            trunk_peak_dps:     trunk_dps,
            x_factor_max_deg:   x_factor,
            height_cm:          p.height,
            weight_kg:          p.weight
          })
        : null;

      // v4.0: Predicted Velo (체력만) + AE (Above Expected) + Combined Diagnosis
      const physicalPred = (typeof ANALYTICS !== 'undefined' && typeof ANALYTICS.predictedVelocity === 'function')
        ? ANALYTICS.predictedVelocity({
            height_cm:  p.height,
            weight_kg:  p.weight,
            cmj_pp_bm:  tmpFit.cmj_pp_bm || 27,
            imtp_pf_bm: tmpFit.imtp_pf_bm || 27,
            hop_rsi:    s.hasFitness ? r2(1.5 + rng()*1.0) : 2.4,
            grip_kg:    50 + rng()*20
          })
        : null;
      const ae = (typeof ANALYTICS !== 'undefined' && physicalPred)
        ? ANALYTICS.aboveExpected(velo, physicalPred.predicted_kmh)
        : null;
      const veloGrp = (typeof ANALYTICS !== 'undefined') ? ANALYTICS.veloGroup(velo) : null;
      const diag = (typeof ANALYTICS !== 'undefined' && physicalPred && ae)
        ? ANALYTICS.combinedDiagnosis(velo, physicalPred, ae)
        : null;

      const m = {
        protocol: s.protocol, date: s.date,
        velocity: {
          measured_kmh: r1(velo),
          potential_kmh: latent.potential_kmh,
          gap_kmh:       latent.gap_kmh,
          contributions: latent.contributions,
          model:         latent.model,
          score:         Math.round(score),
          // v3.9 한국 cohort 자체 회귀 모델
          kr_predicted_kmh: krPred?.predicted_kmh ?? null,
          // v4.0: Predicted Velo (체력만) + AE + Velo Group + Diagnosis
          predicted_kmh:        physicalPred?.predicted_kmh ?? null,
          predicted_group:      physicalPred?.group ?? null,
          predicted_contributors: physicalPred?.contributors ?? null,
          ae_kmh:               ae?.ae_kmh ?? null,
          ae_label:             ae?.label ?? null,
          ae_description:       ae?.description ?? null,
          velo_group:           veloGrp,
          diagnosis:            diag,
        },
        sequence: {
          pelvis_dps: pelvis_dps,
          trunk_dps:  trunk_dps,
          arm_dps:    arm_dps,
          ete_pct:    Math.round(60 + rng()*30 + scoreTrend*f),
          speed_gain: r2(1.4 + rng()*0.4),
          proper_seq: rng() > 0.15,
          score:      Math.round(seqScore)
        },
        // 1차 측정(Theia+GRF)의 헤드라인 — 에너지 생성·전달·누수 (v1.8)
        // Uplift 회차에서는 generation·transfer 일부만, leakage(GRF 의존)는 null
        energy: (function(){
          const gen = {
            // Joint Power Scalar (W) — 8 관절 (Lehman·Aguinaldo 등 표준)
            hip_R_W:      Math.round((220 + rng()*180) * (1+scoreTrend*f*0.01)),
            hip_L_W:      Math.round((220 + rng()*180) * (1+scoreTrend*f*0.01)),
            knee_R_W:     Math.round((280 + rng()*220) * (1+scoreTrend*f*0.01)),
            knee_L_W:     Math.round((280 + rng()*220) * (1+scoreTrend*f*0.01)),
            shoulder_W:   Math.round((320 + rng()*260) * (1+scoreTrend*f*0.01)),  // 투구 측만
            elbow_W:      Math.round((180 + rng()*180) * (1+scoreTrend*f*0.01)),
            // Mechanical Energy 분절 (J)
            mech_energy_pelvis_J:   Math.round(380 + rng()*160),
            mech_energy_trunk_J:    Math.round(620 + rng()*220),
            mech_energy_humerus_J:  Math.round(220 + rng()*140),
            score: Math.round(seqScore + (rng()-0.5)*8)
          };
          gen.total_W = gen.hip_R_W+gen.hip_L_W+gen.knee_R_W+gen.knee_L_W+gen.shoulder_W+gen.elbow_W;
          const trf = {
            ete_pct:                Math.round(60 + rng()*30 + scoreTrend*f),
            speed_gain_pt:          r2(1.40 + rng()*0.35),    // 골반→몸통
            speed_gain_ta:          r2(1.30 + rng()*0.30),    // 몸통→팔
            proper_seq:             rng() > 0.15,
            pelvis_to_trunk_lag_ms: pt_lag,
            trunk_to_arm_lag_ms:    ta_lag,
            score: Math.round(seqScore + (rng()-0.5)*6)
          };
          // 누수 ELI 6 zones — analytics.js 정식 산출 (문헌 근거 변환식)
          // Theia+GRF 회차에만 (Uplift 는 GRF 없어 불가)
          const leak = isTheia
            ? (typeof ANALYTICS !== 'undefined'
                ? ANALYTICS.eliScoresFromTheia({
                    pelvis_to_trunk_lag_ms: pt_lag,
                    trunk_to_arm_lag_ms:    ta_lag,
                    x_factor_max_deg:       x_factor,
                    lead_knee_change_deg:   lead_knee,
                    trunk_tilt_at_fc_deg:   trunk_fwd,
                    trunk_lat_tilt_deg:     trunk_lat,
                    shoulder_er_max_deg:    er_max,
                    pelvis_brake_ratio:     brake_ratio
                  })
                : null)
            : null;
          return { generation: gen, transfer: trf, leakage: leak };
        })(),
        // v3.1: GRF 정식 산출 (Theia+GRF 회차에만)
        grf: isTheia ? (function(){
          // 측정 변수 (가상 — 실측 시 io.js 에서 인입)
          const rear_pct = Math.round(60 + rng()*40);              // 60~100% BW
          const lead_pct = Math.round(75 + rng()*45);              // 75~120% BW
          const lat_asym = r1(2 + rng()*15);                       // 2~17%
          const lead_imp = r1(60 + rng()*40);                      // 60~100 N·s
          const pitch_t  = Math.round(280 + rng()*60);             // 280~340 ms
          const grfInput = {
            rear_force_pct_bw: rear_pct,
            lead_force_pct_bw: lead_pct,
            lateral_force_asymmetry_pct: lat_asym,
            lead_vertical_impulse_n_s: lead_imp,
            body_mass_kg: p.weight,
            pitch_time_ms: pitch_t
          };
          const gs = (typeof ANALYTICS !== 'undefined') ? ANALYTICS.grfScore(grfInput) : null;
          return gs ? {
            lhei: gs.lhei_score,                       // UI 호환 (기존 0~100 점수 자리)
            lhei_value: gs.lhei,                       // 실제 LHEI 값 (N·s/kg)
            rear_force_pct: rear_pct,
            lead_force_pct: lead_pct,
            asymmetry_pct: lat_asym,
            type: gs.type,
            grf_score: gs.grf_score,
            balance_score: gs.balance_score,
            asymmetry_score: gs.asymmetry_score,
            // 측정 원본 (실측 인입 시 검증용)
            lead_force_bm: lead_pct / 100,
            measurements: grfInput
          } : null;
        })() : null,
        faults: {
          x_factor_deg: x_factor,
          lead_knee_change: lead_knee,
          release_height_sd_cm: r1(2 + rng()*4 - scoreTrend*f*0.05),
          wrist_pos_sd_cm: r1(2.5 + rng()*5),
          trunk_tilt_sd_deg: r1(0.8 + rng()*2.5),
          consistency_score: Math.round(consScore),
          fault_score: Math.round(faultScore),
          // v3.2: 부상위험도는 m 객체 만든 후 ANALYTICS.injuryRisk 로 산출 (아래 처리)
          injury_risk: 'low',  // 임시값 — 아래에서 덮어씀
          fault_count: Math.floor(rng()*5)
        }
      };
      // v3.2 부상위험도 정식 산출 (ANALYTICS.injuryRisk)
      if(typeof ANALYTICS !== 'undefined' && isTheia){
        const ir = ANALYTICS.injuryRisk({
          x_factor_max_deg:        x_factor,
          lead_knee_change_deg:    lead_knee,
          trunk_lat_tilt_deg:      trunk_lat,
          pelvis_to_trunk_lag_ms:  pt_lag,
          shoulder_er_max_deg:     er_max,
          imtp_asymmetry_pct:      s.hasFitness ? r1(1 + rng()*7) : null
        });
        m.faults.injury_risk = ir.risk_level;
        m.faults.injury_score = ir.risk_score;
        m.faults.injury_contributors = ir.contributors;
        m.faults.injury_recommendations = ir.recommendations;
      }
      // 체력 (Theia+GRF 회차에만)
      if(s.hasFitness){
        const ff = baseFitness + (rng()-0.5)*0.2;
        m.fitness = {
          cmj: {
            jump_height_cm: r1(28 + ff*22),                 // 28~50
            peak_power_w: Math.round(2400 + ff*1700),       // 2400~4100
            peak_power_bm_w_kg: r1(28 + ff*20),             // 28~48
            rsi_modified_ms: r2(0.30 + ff*0.32),            // 0.30~0.62
            conc_peak_force_bm_n_kg: r1(28 + ff*16),
            ecc_conc_force_ratio: r2(0.85 + rng()*0.35)
          },
          sj: {
            jump_height_cm: r1(26 + ff*20),
            peak_power_bm_w_kg: r1(25 + ff*16),
            conc_peak_force_bm_n_kg: r1(26 + ff*14)
          },
          eur: r2(1.0 + (rng()-0.3)*0.2),                   // 0.94~1.14
          pogo: {
            rsi_ms: r2(1.2 + ff*1.2),                       // 1.2~2.4
            mean_contact_time_ms: Math.round(190 - ff*60),  // 130~190
            mean_jump_height_cm: r1(18 + ff*14)
          },
          imtp: {
            peak_force_n: Math.round(1700 + ff*900),
            peak_force_bm_n_kg: r1(20 + ff*12),
            rfd_0_100ms_n_s: Math.round(5500 + ff*4500),
            force_at_100ms_bm_n_kg: r1(15 + ff*12),
            asymmetry_pct: r1(1 + rng()*7)
          },
          // v5.0: Plyo Push Up — Driveline HP Assessment 6축 호환 (NEW)
          pp: {
            peak_takeoff_force_bm_n_kg:  r1(7.0 + ff*5.5),    // 7.0~12.5
            peak_eccentric_force_bm_n_kg: r1(9.0 + ff*5.0),   // 9.0~14.0
            asymmetry_pct: r1(2 + rng()*8)
          }
        };
        // 체력 종합점수 — v3.2 VALD College Baseball percentile 기반 + 학년 percentile 병행
        if(typeof ANALYTICS !== 'undefined'){
          // 학년별 percentile (한국 고1/2/3 코호트 내 위치)
          const cmjPctlGrade  = ANALYTICS.gradePercentile(m.fitness.cmj.peak_power_bm_w_kg, p.grade, 'cmj_pp_bm');
          const imtpPctlGrade = ANALYTICS.gradePercentile(m.fitness.imtp.peak_force_bm_n_kg, p.grade, 'imtp_pf_bm');
          // VALD 3-tier percentile (한국 elite + College + MLB)
          const cmjVald  = ANALYTICS.valdMultiTier(m.fitness.cmj.peak_power_bm_w_kg, 'cmj', 'conc_pp_bm');
          const cmjJhVald = ANALYTICS.valdMultiTier(m.fitness.cmj.jump_height_cm, 'cmj', 'jump_height_cm');
          const cmjRsiVald = ANALYTICS.valdMultiTier(m.fitness.cmj.rsi_modified_ms, 'cmj', 'rsi_modified');
          // v3.5-2 확장: 5개 ForceDecks 변수를 VALD percentile 기반으로 변환
          // VALD MLB 코호트 (top reference) 사용 — Pogo는 hop 사용
          const rsiMod = m.fitness.cmj.rsi_modified_ms;
          const rsiModP = ANALYTICS.valdPercentile(rsiMod, 'cmj', 'rsi_modified', 'mlb');
          // Pogo RSI: m.fitness.pogo.rsi_ms 가 있으면 hop.best_rsi 사용
          const pogoRsi = m.fitness.pogo?.rsi_ms;
          const pogoRsiP = pogoRsi != null ? ANALYTICS.valdPercentile(pogoRsi, 'hop', 'best_rsi', 'mlb') : null;
          // IMTP RFD 0~100ms: VALD squat_jump.conc_rfd reference 사용 (가장 가까운 reference)
          const imtpRfd = m.fitness.imtp?.rfd_0_100ms_n_s;
          const imtpRfdP = imtpRfd != null ? ANALYTICS.valdPercentile(imtpRfd, 'squat_jump', 'conc_rfd', 'college') : null;
          // 비대칭 — IMTP asymmetry 기준 (lower is better)
          const asymScore = Math.max(0, Math.min(100, 100 - Math.max(0, m.fitness.imtp.asymmetry_pct - 5) * 8));
          const cs = ANALYTICS.compositeScore(ANALYTICS.COMPOSITE_WEIGHTS.fitness, {
            cmj_pp:        cmjPctlGrade ? cmjPctlGrade.percentile : null,
            imtp_pf:       imtpPctlGrade ? imtpPctlGrade.percentile : null,
            rsi_modified:  rsiModP?.percentile,
            pogo_rsi:      pogoRsiP?.percentile,
            imtp_rfd:      imtpRfdP?.percentile,
            asymmetry:     asymScore
          });
          m.fitness.score = cs.score;
          m.fitness.score_breakdown = cs.breakdown;
          m.fitness.score_formula   = cs.formula;
          // 학년·VALD 양쪽 percentile 모두 저장 (UI 에서 두 코호트 비교 가능)
          m.fitness.cmj_pctl_in_grade  = cmjPctlGrade?.percentile ?? null;
          m.fitness.imtp_pctl_in_grade = imtpPctlGrade?.percentile ?? null;
          m.fitness.vald_cmj_pp        = cmjVald;
          m.fitness.vald_cmj_jh        = cmjJhVald;
          m.fitness.vald_cmj_rsi       = cmjRsiVald;
        } else {
          // fallback: 기존 단순 평균
          const cmjN = Math.min(100, (m.fitness.cmj.jump_height_cm-25)/25 * 100);
          const imtpN = Math.min(100, (m.fitness.imtp.peak_force_bm_n_kg-15)/20 * 100);
          m.fitness.score = Math.round((cmjN + imtpN)/2);
        }
      } else {
        m.fitness = null;
      }
      // v3.0-B 제구 통합 점수 (Theia + Rapsodo)
      // 샘플 단계: Theia consistency 만으로 산출. 실측 Rapsodo 인입 시 io.js 에서 재산출.
      if(typeof ANALYTICS !== 'undefined'){
        const cc = ANALYTICS.commandComposite({
          release_height_sd_cm: m.faults.release_height_sd_cm,
          wrist_pos_sd_cm:      m.faults.wrist_pos_sd_cm,
          trunk_tilt_sd_deg:    m.faults.trunk_tilt_sd_deg
        }, m.rapsodo?.fastball || {});
        m.faults.command_composite = cc.composite;
        m.faults.command_theia     = cc.theia_score;
        m.faults.command_rapsodo   = cc.rapsodo_score;
        m.faults.command_agreement = cc.agreement;
        m.faults.command_warnings  = cc.warnings;
      }
      out[p.id][s.id] = m;
    });
  });
  return out;
}

const DATA = genMeasurements();

/* ╔══════════════════════════════════════════════════════════╗
   ║  2. 헬퍼                                                    ║
   ╚══════════════════════════════════════════════════════════╝ */
function avg(arr){const v=arr.filter(x=>x!=null&&!isNaN(x));return v.length?v.reduce((a,b)=>a+b,0)/v.length:null}
function fmt(x,dec=1){return x==null||isNaN(x)?'—':Number(x).toFixed(dec)}
function fmt0(x){return x==null||isNaN(x)?'—':Math.round(x)}
function scoreClass(s){
  if(s==null||isNaN(s)) return '';
  if(s>=85) return 's5'; if(s>=70) return 's4';
  if(s>=55) return 's3'; if(s>=40) return 's2'; return 's1';
}
function scoreColor(s){
  if(s==null) return 'var(--muted)';
  return s>=70?'var(--good)':s>=50?'var(--warn)':'var(--bad)';
}
function riskLabel(r){return {low:'낮음',mid:'중간',high:'높음'}[r]||'—'}
function riskPill(r){return `<span class="pill ${r==='high'?'bad':r==='mid'?'warn':'good'}">${riskLabel(r)}</span>`}

