#!/usr/bin/env node
/**
 * KR cohort 분석 리포트 docx 생성 (v5.34 알고리즘 기반)
 * 입력: stats.json (사전 계산)
 * 출력: KR_cohort_report_v5.34.docx
 */
const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        AlignmentType, PageOrientation, LevelFormat, HeadingLevel,
        BorderStyle, WidthType, ShadingType, PageBreak } = require('docx');

const stats = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const outPath = process.argv[3] || 'KR_cohort_report_v5.34.docx';

// ─────────── helpers ───────────
const F = (n, d=1) => n == null ? '—' : Number(n).toFixed(d);

const border = { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargin = { top: 80, bottom: 80, left: 120, right: 120 };

function cell(text, opts={}) {
  return new TableCell({
    borders,
    width: { size: opts.width || 1500, type: WidthType.DXA },
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
    margins: cellMargin,
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      children: [new TextRun({ text, bold: opts.bold, color: opts.color, size: 18 })]
    })]
  });
}
function P(text, opts={}) {
  return new Paragraph({
    alignment: opts.align || AlignmentType.LEFT,
    spacing: { before: opts.before || 0, after: opts.after || 100 },
    heading: opts.heading,
    children: [new TextRun({ text, bold: opts.bold, color: opts.color,
                              size: opts.size, italics: opts.italic })]
  });
}
function H1(text) { return P(text, { heading: HeadingLevel.HEADING_1, before: 240, after: 120 }); }
function H2(text) { return P(text, { heading: HeadingLevel.HEADING_2, before: 180, after: 100 }); }
function H3(text) { return P(text, { heading: HeadingLevel.HEADING_3, before: 120, after: 60 }); }

// distribution table (변인 × p10·p25·p50·p75·p90)
function distTable(rows, opts={}) {
  const headerFill = "2E75B6";
  const headerCell = (t) => new TableCell({
    borders, width: { size: 1500, type: WidthType.DXA },
    shading: { fill: headerFill, type: ShadingType.CLEAR },
    margins: cellMargin,
    children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: t, bold: true, color: "FFFFFF", size: 18 })] })]
  });
  const widths = opts.widths || [3000, 1100, 1100, 1100, 1100, 1100];
  const headers = opts.headers || ['변인', 'n', 'p10', 'p50', 'p90', 'mean ± SD'];
  return new Table({
    width: { size: widths.reduce((a,b)=>a+b,0), type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map(h => {
        const c = headerCell(h);
        c.options.width.size = widths[headers.indexOf(h)];
        return c;
      })}),
      ...rows.map(r => new TableRow({
        children: r.map((v, i) => {
          const c = cell(v, {
            width: widths[i],
            align: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
            bold: i === 0,
            fill: opts.rowFills?.[rows.indexOf(r)],
          });
          return c;
        })
      }))
    ]
  });
}

function distRow(label, s) {
  if (!s) return [label, '—', '—', '—', '—', '—'];
  return [label, String(s.n), F(s.p10, 1), F(s.p50, 1), F(s.p90, 1),
          `${F(s.mean, 1)} ± ${F(s.sd, 1)}`];
}

// KR vs OBP 비교 row
function compareRow(label, kr, obp, unit='') {
  if (!kr || !obp) return [label, '—', '—', '—', '—'];
  const diff = kr.p50 - obp.p50;
  const pct = obp.p50 ? diff/Math.abs(obp.p50)*100 : 0;
  const flag = Math.abs(pct) <= 10 ? '✓' : (Math.abs(pct) <= 25 ? '⚠' : '✗');
  return [label, F(kr.p50,1)+unit, F(obp.p50,1)+unit, `${diff>=0?'+':''}${F(diff,1)}`, `${pct>=0?'+':''}${F(pct,1)}% ${flag}`];
}

// ─────────── 본문 작성 ───────────
const c = stats.cohort;
const children = [
  // ───── Title ─────
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "한국 고교 투수 cohort 바이오메카닉스 분석 리포트", size: 36, bold: true })],
    spacing: { after: 60 }}),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "v5.34 algorithm · markerless Theia 300 Hz + AMTI Force plate 1200 Hz", size: 22, color: "666666" })],
    spacing: { after: 60 }}),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: `${c.total_players}명 × ${c.total_trials} trials · 135+ km/h subset ${c.high_135_players}명 × ${c.high_135_trials} trials`, size: 22, italics: true })],
    spacing: { after: 360 }}),

  // ───── 1. Executive Summary ─────
  H1("1. Executive Summary"),
  P("본 리포트는 v5.34 algorithm을 적용해 한국 고교/유스 투수 59명 (Accurate_Data 18명 + raw data 41명) × 518 trials 데이터를 분석한 결과입니다. 주요 발견:"),
  P("• 처리 성공률: 518/518 (100%) — Visual3D Footstrike event 무시한 force plate 활성 구간 자동 검출 (event-free detection)"),
  P("• Lead AP GRF 가용성: v5.32 1% → v5.34 100% (xlsx 가공값과 peak 4개 ±0.5% 정합)"),
  P(`• 135 km/h 이상 subset: ${c.high_135_players}명, ${c.high_135_trials} trials (cohort 구속 분포: p10=${F(c.velo_p10,1)} / p50=${F(c.velo_p50,1)} / max=${F(c.velo_max,1)} km/h)`),
  P("• OBP 90+ mph (54 trial) 비교 — 분절 ω peak는 markerless 시스템 차이로 KR이 -10~15% 작게 측정 (Calibration factor 1.10–1.16). X-factor는 더 큰 차이 (-30~40%, factor 1.65)"),
  P("• Markerless 골반 인식 한계로 인해 pelvis_to_trunk transition 평가에 weight 0.5 적용 (driveline.js v5.33)"),

  // ───── 2. Cohort 개요 ─────
  H1("2. Cohort 개요"),
  P(`• 통합 cohort: ${c.total_players}명 (Accurate ${c.accurate_trials} trials + Raw ${c.raw_trials} trials = ${c.total_trials})`),
  P(`• ball_speed metadata 매핑: ${c.mapped_trials}/${c.total_trials} (${(c.mapped_trials/c.total_trials*100).toFixed(0)}%)`),
  P(`• 135+ km/h subset (이번 분석 핵심): ${c.high_135_players}명, ${c.high_135_trials} trials`),
  P(`• 구속 분포: p10 ${F(c.velo_p10,1)}, p50 ${F(c.velo_p50,1)}, max ${F(c.velo_max,1)} km/h`),
  P("• 측정 시스템: Theia markerless motion capture 300 Hz + AMTI Force plate 1200 Hz (c3d.txt export 시 motion 300 Hz로 동기화)"),

  // ───── 3. 분절 ω peak ─────
  H1("3. 분절 ω peak 분포"),
  P("회전 운동의 핵심 변인 — Pelvis, Trunk, Humerus의 peak angular velocity (deg/s).", { italic: true }),
  H2("3.1 전체 cohort (n=518)"),
  distTable([
    distRow("Pelvis peak ω (deg/s)", stats.segment_omega_all.pelvis),
    distRow("Trunk peak ω (deg/s)",  stats.segment_omega_all.trunk),
    distRow("Humerus peak ω (deg/s)", stats.segment_omega_all.humerus),
  ]),
  H2("3.2 135+ km/h subset (n=126)"),
  distTable([
    distRow("Pelvis peak ω (deg/s)", stats.segment_omega_135.pelvis),
    distRow("Trunk peak ω (deg/s)",  stats.segment_omega_135.trunk),
    distRow("Humerus peak ω (deg/s)", stats.segment_omega_135.humerus),
  ]),

  // ───── 4. 분절간 lag ─────
  H1("4. 분절간 lag (proximal-to-distal sequence)"),
  P("Pelvis→Trunk lag: 우리 코드 결과는 markerless 골반 인식 한계로 가공값(xlsx)과 차이 — driveline.js에서 weight 0.5 적용. Trunk→Humerus lag는 정합 양호.", { italic: true }),
  distTable([
    distRow("Pelvis→Trunk lag (ms) [전체]",  stats.lag_all.pelvis_to_trunk),
    distRow("Trunk→Humerus lag (ms) [전체]", stats.lag_all.trunk_to_humerus),
    distRow("Pelvis→Trunk lag (ms) [135+]",  stats.lag_135.pelvis_to_trunk),
    distRow("Trunk→Humerus lag (ms) [135+]", stats.lag_135.trunk_to_humerus),
  ]),

  // ───── 5. GRF (135+ subset) ─────
  H1("5. 지면반력 (GRF) — 135+ km/h subset"),
  P("v5.34 event-free detection 알고리즘으로 처리. FP1=lead(앞발), FP2=drive(뒷발) 강제 매핑. xlsx 가공값과 peak 4개 ±0.5% 정합 검증 완료.", { italic: true }),
  H2("5.1 수직 GRF + 수평 GRF + 타이밍"),
  distTable([
    distRow("Drive Z peak (%BW)",         stats.grf_135.drive_z_pct_bw),
    distRow("Drive AP peak (%BW)",         stats.grf_135.drive_y_pct_bw),
    distRow("Lead Z peak (%BW)",           stats.grf_135.lead_z_pct_bw),
    distRow("Lead AP peak (%BW)",          stats.grf_135.lead_y_pct_bw),
    distRow("Lead block duration (ms)",    stats.grf_135.lead_block_duration_ms),
    distRow("NewtForce Time of Transfer (ms)", stats.grf_135.time_of_transfer_ms),
  ]),
  P("※ Time of Transfer는 v5.34에서도 xlsx와 차이 있음 (drive Z peak 위치 알고리즘 추가 디버깅 후보). drive impulse 윈도우도 'stride' 정의 매칭 필요.", { italic: true, color: "888888", size: 18 }),

  // ───── 6. X-factor + CoG + Arm Action ─────
  H1("6. 메카닉 변인 — 135+ km/h subset"),
  H2("6.1 X-factor (분리)"),
  distTable([
    distRow("Peak X-factor (deg)", stats.xfactor_135.max),
    distRow("FP X-factor (deg)",   stats.xfactor_135.fp),
  ]),
  H2("6.2 CoG (Center of Gravity)"),
  distTable([
    distRow("Max CoG velo (m/s)", stats.cog_135.max_velo),
    distRow("CoG decel (m/s)",     stats.cog_135.decel),
  ]),
  H2("6.3 Arm Action / Block"),
  distTable([
    distRow("Layback - max ER (deg)",       stats.arm_action_135.layback),
    distRow("Lead knee at FP (deg)",         stats.arm_action_135.lead_knee_at_fp),
    distRow("Lead knee at BR (deg)",         stats.arm_action_135.lead_knee_at_br),
  ]),

  // ───── 7. KR vs OBP 90+ 비교 ─────
  H1("7. KR 135+ km/h vs OBP 90+ mph (marker-based) 비교"),
  P("OBP (OpenBiomechanics) 90+ mph subset (n=54) — marker-based 미국 college/MiLB. KR cohort와 비교를 통해 (1) markerless vs marker 시스템 차이 + (2) cohort selection effect 정량화.", { italic: true }),
  distTable([
    compareRow("Pelvis peak ω (deg/s)",      stats.obp_compare.pelvis_omega.kr,    stats.obp_compare.pelvis_omega.obp),
    compareRow("Trunk peak ω (deg/s)",       stats.obp_compare.trunk_omega.kr,     stats.obp_compare.trunk_omega.obp),
    compareRow("Humerus peak ω (deg/s)",     stats.obp_compare.humerus_omega.kr,   stats.obp_compare.humerus_omega.obp),
    compareRow("Max X-factor (deg)",          stats.obp_compare.x_factor_max.kr,    stats.obp_compare.x_factor_max.obp),
    compareRow("Max CoG velo (m/s)",          stats.obp_compare.cog_velo.kr,         stats.obp_compare.cog_velo.obp),
    compareRow("Layback (deg)",                stats.obp_compare.layback.kr,           stats.obp_compare.layback.obp),
    compareRow("Rear Z peak (%BW)",           stats.obp_compare.rear_z_pct_bw.kr,   stats.obp_compare.rear_z_pct_bw.obp),
    compareRow("Rear AP peak (%BW)",          stats.obp_compare.rear_y_pct_bw.kr,   stats.obp_compare.rear_y_pct_bw.obp),
    compareRow("Lead Z peak (%BW)",            stats.obp_compare.lead_z_pct_bw.kr,    stats.obp_compare.lead_z_pct_bw.obp),
    compareRow("Lead AP peak (%BW)",           stats.obp_compare.lead_y_pct_bw.kr,    stats.obp_compare.lead_y_pct_bw.obp),
  ], { headers: ['변인', 'KR p50', 'OBP p50', 'Δ p50', 'Δ % (정합)'], widths: [2800, 1200, 1200, 1100, 2100] }),
  P("정합 (✓ Δ ≤ 10%): markerless 시스템 차이 작음, reference 그대로 사용 가능.", { color: "1A7F37" }),
  P("차이 (⚠ 10–25%): markerless 시스템 차이 + cohort selection 혼합. driveline.js MARKERLESS_CALIBRATION_FACTORS로 환산 가능.", { color: "BC4C00" }),
  P("큰 차이 (✗ > 25%): X-factor 등 markerless 골반·trunk 인식 한계가 누적되는 변인. 이 cohort 평가 시 우선순위 낮춤.", { color: "CF222E" }),

  // ───── 8. Markerless ↔ Marker 환산 ─────
  H1("8. Markerless ↔ Marker 환산 계수 (driveline.js MARKERLESS_CALIBRATION_FACTORS)"),
  P("학술 논문 작성 시 우리 markerless Theia 측정값을 marker 등가로 환산하기 위한 calibration factors. KR markerless × factor ≈ OBP marker.", { italic: true }),
  distTable([
    ['Pelvis ω peak',    '× 1.15', `KR ${F(stats.segment_omega_135.pelvis?.p50,0)} × 1.15 ≈ ${F(stats.segment_omega_135.pelvis?.p50*1.15,0)}`],
    ['Trunk ω peak',     '× 1.16', `KR ${F(stats.segment_omega_135.trunk?.p50,0)} × 1.16 ≈ ${F(stats.segment_omega_135.trunk?.p50*1.16,0)}`],
    ['Humerus ω peak',   '× 1.10', `KR ${F(stats.segment_omega_135.humerus?.p50,0)} × 1.10 ≈ ${F(stats.segment_omega_135.humerus?.p50*1.10,0)}`],
    ['X-factor peak',    '× 1.65', `KR ${F(stats.xfactor_135.max?.p50,1)} × 1.65 ≈ ${F(stats.xfactor_135.max?.p50*1.65,1)}`],
    ['CoG velo',         '× 1.22', `KR ${F(stats.cog_135.max_velo?.p50,2)} × 1.22 ≈ ${F(stats.cog_135.max_velo?.p50*1.22,2)} m/s`],
    ['Vertical GRF',     '× 1.00', `시스템 정합 — 환산 불필요`],
    ['Layback / Counter rot / Side bend', '× 1.00', `자세 변인 정합`],
  ], { headers: ['변인', 'Factor', '환산 예 (KR p50 → marker 등가)'], widths: [2400, 1200, 5800] }),

  // ───── 9. 권고사항 ─────
  H1("9. 한국 고교 투수 평가 권고사항"),
  H2("9.1 즉시 활용 (driveline.js v5.34 reference 적용)"),
  P("• Drive propulsive peak elite range: 55–80 %BW (KR p25-p75)"),
  P("• Lead braking peak elite range: 100–145 %BW"),
  P("• Back leg peak Z elite range: 135–165 %BW"),
  P("• Lead leg peak Z elite range: 195–240 %BW"),
  P("• Pelvis→Trunk lag ideal: −5 to 25 ms (markerless 표준)"),
  P("• Trunk→Humerus lag ideal: 50–110 ms (KR cohort 검증)"),

  H2("9.2 추가 개선 후보"),
  P("• Drive impulse 윈도우 확장 — 현재 lead start 직전 700ms, xlsx 'stride' 정의 (leg lift~FC) 매칭 필요"),
  P("• Time of Transfer 알고리즘 보정 — drive Z peak 위치를 lead block 시작 직후까지 확장"),
  P("• Lead Negative Y (claw back) 윈도우 확장 — 현재 lead_end 후 500ms, 가용성 15%"),
  P("• R_Forearm_Ang_Vel 컬럼 추가 — 사용자 측정 시 Visual3D export 보강 필요 (현재 0/518 = 분절간 ETE 4 transition 중 2개만 가용)"),

  H2("9.3 markerless 한계 — 가중치 적용 변인"),
  P("• Pelvis 인식 정확도 한계로 골반 관련 변인 (Pelvis ω, Pelvis→Trunk lag, X-factor)은 driveline.js에서 weight 0.5 적용"),
  P("• 학술 비교/논문 작성 시 marker 등가 환산값 사용 권장"),

  // ───── 10. 메서드 ─────
  H1("10. 메서드 요약"),
  P("• 데이터: c3d.txt (Visual3D ASCII export). 59명 × 518 trials. Theia markerless 300 Hz + Force plate 1200 Hz (export 시 motion 300 Hz로 동기화)"),
  P("• 처리 알고리즘: process_pitching_session.py v5.34 (event-free force plate detection)"),
  P("• 좌표 매핑: FP1=앞발(lead), FP2=뒷발(drive) 강제 매핑 (사용자 confirmed)"),
  P("• 임펄스 적분 dt = 1/300 s"),
  P("• OBP 비교 cohort: 90+ mph fastball, n=54 (drivelineresearch/openbiomechanics)"),

  // ───── 11. 부록: 135+ subset 22명 ─────
  H1("11. 부록 — 135+ km/h subset 22명"),
  P(stats.players_in_135.join(', ')),

  // ───── 12. References ─────
  H1("12. 학술 reference"),
  P("• Aguinaldo & Escamilla (2007, 2019) Sports Biomech — Pelvis-trunk separation timing"),
  P("• Naito & Maruyama (2008) Sports Biomech — 분절간 energy transfer"),
  P("• Howenstein, Kipp, Sabick (2020) J Biomech — Lead leg block timing"),
  P("• Werner et al. (2008) Am J Sports Med — Pitching kinematics"),
  P("• MacWilliams et al. (1998) Am J Sports Med — Lead leg braking peak"),
  P("• Kageyama et al. (2014) J Sports Sci Med — Drive leg propulsive force"),
  P("• Florida Baseball Armory (2019) Force Plate Metrics Chart Guide — NewtForce 8 변인"),
  P("• drivelineresearch/openbiomechanics — OBP cohort 100명 (POI CSV)"),
];

// ─────────── Document 생성 ───────────
const doc = new Document({
  creator: "Sangdong Pitching Lab",
  title: "한국 고교 투수 cohort 분석 리포트",
  styles: {
    default: { document: { run: { font: "맑은 고딕", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "맑은 고딕", color: "2E75B6" },
        paragraph: { spacing: { before: 360, after: 180 }, outlineLevel: 0 }},
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "맑은 고딕", color: "1F3864" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 }},
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 23, bold: true, font: "맑은 고딕", color: "2E75B6" },
        paragraph: { spacing: { before: 120, after: 60 }, outlineLevel: 2 }},
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },   // A4
        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 }
      }
    },
    children
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(outPath, buf);
  console.log(`✓ ${outPath} (${buf.length} bytes)`);
}).catch(e => { console.error(e); process.exit(1); });
