// build_manual.js — 측정_프로토콜_매뉴얼_v1.1.docx 빌드
// 사용: node scripts/build_manual.js
// v1.1 변경: 이기광 교수 코멘트 5건 반영
//   ① Theia 시스템 정확화 (Qualisys 8대 + AMTI FP 2장 내장 마운드 + Visual3D 키네매틱스+키네틱스)
//   ② 카메라 8대
//   ③ FP1=축발, FP2=착지발 (앞으로 적용)
//   ④ Rapsodo 위치: 홈→투수 5~6m, 투구 방향 정렬
//   ⑤ roster.csv 컬럼 최적화 (필수 5개 + 선택 5개)

const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel,
  BorderStyle, WidthType, ShadingType, PageBreak, PageNumber,
  TabStopType, TabStopPosition, VerticalAlign,
} = require('/tmp/node_modules/docx');

const FONT = 'Malgun Gothic';
const SZ_BODY = 18, SZ_SMALL = 16, SZ_TBL = 16;
const SZ_H3 = 22, SZ_H2 = 26, SZ_H1 = 30, SZ_TITLE = 40, SZ_CAP = 14;

const C_BLUE='0969DA', C_TEXT='1F2328', C_MUTED='656D76', C_GREEN='1A7F37', C_RED='CF222E';
const C_BG_BLUE='DDF4FF', C_BG_YEL='FFF8C5', C_BG_GRN='DAFBE1', C_BG_RED='FFEBE9';

function P(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT, size: opts.size || SZ_BODY,
      bold: opts.bold, color: opts.color, italics: opts.italics })],
    spacing: { before: opts.before || 40, after: opts.after || 40, line: 260 },
    alignment: opts.align,
    indent: opts.indent ? { left: opts.indent } : undefined,
  });
}
function H1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, font: FONT, size: SZ_H1, bold: true, color: C_BLUE })],
    spacing: { before: 280, after: 120 },
  });
}
function H2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, font: FONT, size: SZ_H2, bold: true, color: C_TEXT })],
    spacing: { before: 200, after: 80 },
  });
}
function H3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text, font: FONT, size: SZ_H3, bold: true, color: C_TEXT })],
    spacing: { before: 140, after: 60 },
  });
}
function Mixed(parts, opts = {}) {
  return new Paragraph({
    children: parts.map(p => new TextRun({
      text: p.text, font: p.code ? 'Consolas' : FONT,
      size: opts.size || SZ_BODY, bold: p.bold, italics: p.italics,
      color: p.color || (p.code ? C_BLUE : undefined),
    })),
    spacing: { before: opts.before || 40, after: opts.after || 40, line: 260 },
    indent: opts.indent ? { left: opts.indent } : undefined,
  });
}
function Bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: 'bullets', level },
    children: [new TextRun({ text, font: FONT, size: SZ_BODY })],
    spacing: { before: 30, after: 30, line: 260 },
  });
}
function BulletMixed(parts, level = 0) {
  return new Paragraph({
    numbering: { reference: 'bullets', level },
    children: parts.map(p => new TextRun({
      text: p.text, font: p.code ? 'Consolas' : FONT,
      size: SZ_BODY, bold: p.bold, italics: p.italics,
      color: p.color || (p.code ? C_BLUE : undefined),
    })),
    spacing: { before: 30, after: 30, line: 260 },
  });
}
function Num(text) {
  return new Paragraph({
    numbering: { reference: 'numbers', level: 0 },
    children: [new TextRun({ text, font: FONT, size: SZ_BODY })],
    spacing: { before: 30, after: 30, line: 260 },
  });
}
function NumMixed(parts) {
  return new Paragraph({
    numbering: { reference: 'numbers', level: 0 },
    children: parts.map(p => new TextRun({
      text: p.text, font: p.code ? 'Consolas' : FONT,
      size: SZ_BODY, bold: p.bold, italics: p.italics,
      color: p.color || (p.code ? C_BLUE : undefined),
    })),
    spacing: { before: 30, after: 30, line: 260 },
  });
}
function Code(text) {
  return new Paragraph({
    children: text.split('\n').flatMap((line, i) => {
      const runs = [new TextRun({ text: line, font: 'Consolas', size: SZ_SMALL })];
      if (i < text.split('\n').length - 1) runs.push(new TextRun({ break: 1 }));
      return runs;
    }),
    spacing: { before: 80, after: 80, line: 240 },
    shading: { fill: 'F6F8FA', type: ShadingType.CLEAR },
    indent: { left: 100, right: 100 },
  });
}
function Note(text, color = C_BLUE, bg = C_BG_BLUE) {
  return new Paragraph({
    children: [
      new TextRun({ text: '▎ ', font: FONT, size: SZ_SMALL, color, bold: true }),
      new TextRun({ text, font: FONT, size: SZ_SMALL, color: C_TEXT }),
    ],
    spacing: { before: 80, after: 80, line: 260 },
    shading: { fill: bg, type: ShadingType.CLEAR },
    indent: { left: 200, right: 100 },
  });
}
function makeTable(rows, widths) {
  const totalWidth = widths.reduce((a, b) => a + b, 0);
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'D0D7DE' };
  const borders = { top: border, left: border, bottom: border, right: border,
                    insideHorizontal: border, insideVertical: border };
  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: widths,
    rows: rows.map((r, i) => new TableRow({
      tableHeader: i === 0,
      children: r.map((cell, ci) => new TableCell({
        width: { size: widths[ci], type: WidthType.DXA },
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        shading: { fill: i === 0 ? '1F2328' : (typeof cell === 'object' && cell.bg ? cell.bg : 'FFFFFF'), type: ShadingType.CLEAR },
        verticalAlign: VerticalAlign.CENTER,
        borders,
        children: [new Paragraph({
          children: [new TextRun({
            text: typeof cell === 'string' ? cell : cell.text, font: FONT, size: SZ_TBL,
            bold: i === 0 || (typeof cell === 'object' && cell.bold),
            color: i === 0 ? 'FFFFFF' : (typeof cell === 'object' && cell.color ? cell.color : C_TEXT),
          })],
          spacing: { before: 30, after: 30 },
        })],
      })),
    })),
  });
}

const today = new Date().toISOString().slice(0, 10);
const children = [];

// ── 표지 ──
children.push(new Paragraph({
  children: [new TextRun({ text: '상동고등학교 야구부 투수 1차 측정', font: FONT, size: SZ_TITLE, bold: true, color: C_BLUE })],
  alignment: AlignmentType.CENTER, spacing: { before: 600, after: 200 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: '데이터 수집 + 처리 매뉴얼', font: FONT, size: 32, bold: true, color: C_TEXT })],
  alignment: AlignmentType.CENTER, spacing: { before: 0, after: 300 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: 'Theia 마커리스 (Qualisys 카메라 8대) + AMTI 포스플레이트 (마운드 내장) + ForceDecks + Rapsodo 2.0', font: FONT, size: SZ_SMALL, color: C_MUTED })],
  alignment: AlignmentType.CENTER, spacing: { before: 0, after: 600 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: 'v1.1  ·  ' + today, font: FONT, size: SZ_BODY, color: C_MUTED })],
  alignment: AlignmentType.CENTER, spacing: { before: 0, after: 60 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: '바이오모션 베이스볼 랩 (BBL)  ·  국민대학교 바이오메카닉스 연구실', font: FONT, size: SZ_SMALL, color: C_MUTED })],
  alignment: AlignmentType.CENTER, spacing: { before: 0, after: 60 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: '문의: kklee@kookmin.ac.kr', font: FONT, size: SZ_SMALL, color: C_MUTED })],
  alignment: AlignmentType.CENTER, spacing: { before: 0, after: 600 },
}));

children.push(new Paragraph({
  children: [new TextRun({ text: '한 줄 요약', font: FONT, size: SZ_H3, bold: true, color: C_BLUE })],
  alignment: AlignmentType.CENTER, spacing: { before: 200, after: 80 },
}));
children.push(new Paragraph({
  children: [new TextRun({
    text: '20초 간격으로 측정 → P{번호}_{이름} 폴더에 c3d 그대로 → v3d ASCII export → 자동 처리 스크립트 1번 → 대시보드 인입.',
    font: FONT, size: SZ_BODY, color: C_TEXT,
  })],
  alignment: AlignmentType.CENTER,
  spacing: { before: 0, after: 60, line: 320 },
  indent: { left: 600, right: 600 },
}));
children.push(new Paragraph({
  children: [new TextRun({
    text: '운영자 추가 작업: 선수당 5초 + 검토 30초 (20명 약 2분).',
    font: FONT, size: SZ_SMALL, color: C_MUTED, italics: true,
  })],
  alignment: AlignmentType.CENTER, spacing: { before: 60, after: 200 },
}));

children.push(new Paragraph({
  children: [new TextRun({
    text: 'v1.1 갱신: Theia 시스템 정확화 · 카메라 8대 · FP1=축발/FP2=착지발 · Rapsodo 설치 위치 · roster 컬럼 최적화 (이기광 교수 검토 코멘트 5건 반영)',
    font: FONT, size: SZ_CAP, color: C_GREEN,
  })],
  alignment: AlignmentType.CENTER, spacing: { before: 80, after: 0 },
}));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ── 목차 ──
children.push(H1('목차'));
[
  '1. 측정 개요 + 데이터 흐름',
  '2. 측정 장비 + 환경 셋업',
  '3. 선수 등록 (roster.csv)',
  '4. 측정 프로토콜 — 20초 간격',
  '5. Theia c3d → Visual3D ASCII export',
  '6. 폴더 구조 + 파일 명명 규칙',
  '7. Rapsodo 2.0 측정 + 데이터 처리',
  '8. VALD ForceDecks API (CMJ·SJ·Pogo·IMTP)',
  '9. 자동 처리 스크립트 사용법',
  '10. 검증 + 트러블슈팅 + FAQ',
].forEach(t => children.push(P(t, { size: SZ_BODY, before: 30, after: 30 })));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ── 1. 개요 ──
children.push(H1('1. 측정 개요 + 데이터 흐름'));
children.push(P('상동고등학교 야구부 투수 약 20명을 대상으로 1차 측정을 진행합니다. 1차 측정은 ① Qualisys 비디오 카메라 8대로 수집한 영상을 Theia 마커리스 프로그램으로 분석한 후, AMTI 포스플레이트 2장이 내장된 투수 마운드의 GRF 데이터와 통합해 Visual3D로 키네매틱스 + 키네틱스를 산출 (Theia + GRF 시스템) ② ForceDecks 체력 측정 ③ Rapsodo 2.0 구속·회전 — 3개 시스템을 통합한 기록입니다. 측정 결과는 자동으로 통합 대시보드에 반영되어 선수별·팀별 리포트가 생성됩니다.'));

children.push(H2('데이터 흐름'));
children.push(Code(
`측정 현장 (선수 1명, 약 20분)
   ↓
   ├─ Theia (Qualisys 카메라 8대) + AMTI FP 2장 (투수 마운드 내장)
   │   → Visual3D 처리 → c3d 파일 (선수당 10~12 trial)
   ├─ Rapsodo 2.0 (단일 계정 누적)   →  CSV 파일 (전체 선수 throws 1개)
   └─ ForceDecks (CMJ/SJ/Pogo/IMTP)  →  VALD Hub API → 28컬럼 CSV
   ↓
운영자 정리 (선수당 약 1분 + 5초 메모)
   ↓
처리 스크립트 (1번 실행, 약 1~2분)
   ↓
   ├─ theia_batch.json    (대시보드 인입용)
   ├─ rapsodo_master.csv  (정규화·갭 분석 완료)
   └─ validation.txt      (자동 진단 + 수작업 alert)
   ↓
대시보드 (https://kkl0511.github.io/Dashboard_Pitching_Team/)
   ↓
자동 리포트 생성 (선수별 PDF + 코치 종합 PDF)`
));

children.push(H2('1차 측정 핵심 산출물'));
children.push(makeTable([
  ['시스템', '핵심 측정값', '대시보드 영역'],
  ['Theia + AMTI GRF\n(Qualisys 카메라 8대)', '관절 각속도 (피크), Joint Power Scalar 8개, Mechanical Energy 3분절, X-factor, 지면반력 FP1/FP2, 이벤트 (FC, MaxER, Release)', '에너지 분석 (생성·전달·누수) + GRF (LHEI)'],
  ['Rapsodo 2.0', 'Velocity (max/avg), Spin (total/true/efficiency), 회전축, IVB/HB, VAA/HAA, Release height/side/extension, Bauer Units', '랩소도 패스트볼 분석 6 카드 + Movement Profile + Stuff·Command'],
  ['ForceDecks', 'CMJ (5변인), SJ (3변인) + EUR, Pogo (3변인), IMTP (5변인)', '보조 측정 — 체력 (4 카드)'],
], [2400, 4000, 3000]));

// ── 2. 장비 ──
children.push(H1('2. 측정 장비 + 환경 셋업'));
children.push(H2('필요 장비'));
[
  ['Theia 3D markerless', '마커 부착 없는 3D 모션 캡처. Qualisys 비디오 카메라 8대 동기화'],
  ['Qualisys QTM', '비디오 카메라 8대 동기화 + Theia 캡처. .c3d 파일 자동 생성'],
  ['AMTI Force plate × 2', '1200 Hz, 투수 마운드 내장. FP1=축발(뒷발), FP2=착지발(앞발) — 새 lab convention'],
  ['Visual3D (v3d)', 'c3d → ASCII (.c3d.txt) 변환 + 키네매틱스/키네틱스 변수 산출'],
  ['Rapsodo 2.0 Pitching', '구속·회전·movement·release tracker. 멤버십 1명 등록 (단일 계정 누적)'],
  ['VALD ForceDecks', 'CMJ·SJ·Pogo·IMTP 측정. VALD Hub API 연동'],
].forEach(([k, v]) => children.push(BulletMixed([
  { text: k, bold: true }, { text: ' — ' }, { text: v }
])));

children.push(H2('측정 공간 셋업'));
children.push(Bullet('마운드 + 홈플레이트 거리: 18.44 m (60.5 ft) — 표준 거리'));
children.push(Bullet('Qualisys 카메라 8대: 마운드 좌·우·후면 분산 배치 (선수 + 마운드 force plate 모두 framing)'));
children.push(Bullet('Force plate (AMTI ×2): 투수 마운드 내장 — FP1(축발, 뒷발) + FP2(착지발, 앞발)'));
children.push(Bullet('Rapsodo 2.0: 홈플레이트에서 투수 방향으로 5~6m 지점에 설치, 투구 방향과 정렬'));
children.push(Bullet('ForceDecks: 별도 측정 공간 — 측정 시작 전 CMJ/SJ/Pogo/IMTP 4 테스트 (선수당 7분)'));

children.push(Note('측정 시작 전 모든 장비 timestamp 동기화 (가능한 같은 NTP 서버 사용 권장). Rapsodo Date와 c3d 파일 modified time 매칭에 사용됩니다.'));
children.push(Note('FP 정의 변경 (v1.1): 이전 매뉴얼의 "FP1=디딤발 / FP2=축발"에서 "FP1=축발 / FP2=착지발(디딤발)"로 변경. 처리 스크립트와 대시보드의 GRF 라벨도 동일 갱신.', 'BC4C00', 'FFF8C5'));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ── 3. roster ──
children.push(H1('3. 선수 등록 (roster.csv)'));
children.push(P('측정 전 선수 명단을 roster.csv 한 파일로 작성합니다. 이 파일이 모든 데이터 매칭의 master key 역할을 합니다.'));
children.push(P('위치: 2026-05-15_1차측정/00_meta/roster.csv (UTF-8 인코딩)'));

children.push(H2('필수 컬럼 (5개) — 분석에 반드시 필요'));
children.push(makeTable([
  ['컬럼', '예시', '설명'],
  ['athlete_external_id', 'P01', 'PID — 두 자리 숫자, 모든 데이터 조인 키'],
  ['athlete_name', '정예준', '한글 이름 (띄어쓰기 없이)'],
  ['height_cm', '180', '신장 (cm) — BW·BMI 계산 + 정규화'],
  ['weight_kg', '78', '체중 (kg) — Joint Power, IMTP 정규화'],
  ['handedness', 'R', 'R (우투) / L (좌투) — 파일명 LH/RH와 cross-check'],
], [2400, 1800, 5200]));

children.push(H2('선택 컬럼 (있으면 좋음)'));
children.push(makeTable([
  ['컬럼', '예시', '용도'],
  ['initials', 'JYJ', '영문 이니셜 3글자 — 폴더명에 추가 시 사람이 빠르게 식별'],
  ['date_of_birth', '2007-03-15', '연령 계산 + 코호트 비교 (HS / KBO)'],
  ['position', 'SP', 'SP / RP / CP — 그룹별 분석'],
  ['uniform_no', '12', '등번호 — 리포트 표시'],
  ['note', '에이스', '운영 메모'],
], [2400, 1800, 5200]));

children.push(Note('필수 5개만 채워도 모든 분석 + 리포트 작동. 선택 컬럼은 없으면 자동으로 빈 값 처리. school·sex·bmi 등은 자동 산출되거나 불필요.', C_BLUE, C_BG_BLUE));

children.push(H2('CSV 작성 예시 — 필수만 (간소화)'));
children.push(Code(
`athlete_external_id,athlete_name,height_cm,weight_kg,handedness
P01,정예준,180,78,R
P02,김강대,178,75,R
P03,박명균,176,72,L`
));

children.push(H2('CSV 작성 예시 — 선택 컬럼 포함 (full)'));
children.push(Code(
`athlete_external_id,athlete_name,height_cm,weight_kg,handedness,initials,date_of_birth,position,uniform_no,note
P01,정예준,180,78,R,JYJ,2007-03-15,SP,12,에이스
P02,김강대,178,75,R,KGD,2008-01-22,SP,21,
P03,박명균,176,72,L,PMG,2008-05-10,RP,7,좌완`
));

children.push(Note('실수 방지: PID는 항상 두 자리 (P01, P02 ... P20). P1, P2 같은 한 자리는 자동 처리에서 인식 못합니다.', C_RED, C_BG_RED));

// ── 4. 프로토콜 ──
children.push(H1('4. 측정 프로토콜 — 20초 간격'));
children.push(P('Rapsodo 누락 자동 감지를 위한 핵심 규칙: 매 throw 사이 20초 간격 유지.'));

children.push(H2('선수 안내 문구 (측정 직전)'));
children.push(Note('"매 투구 후 정확히 20초씩 쉬어 주세요. 자세 조정 등으로 길어져도 30초 넘기지 마세요. 무효 throw 후 재측정도 같은 20초 유지."', C_BLUE, C_BG_BLUE));

children.push(H2('throw 간격에 따른 자동 처리 분류'));
children.push(makeTable([
  ['갭', '분류', '자동 처리'],
  [{ text: '< 30초', bold: true, color: C_GREEN }, '정상 throw', '그대로 c3d trial과 1:1 매칭'],
  [{ text: '30~50초', bold: true, color: 'BC4C00' }, 'Rapsodo 1개 누락', '자동 마킹 → c3d trial 메카닉만 분석 (구속 N/A)'],
  [{ text: '50~90초', bold: true, color: C_RED }, '수작업 검토', 'validation.txt에 alert → 운영자 1-click 결정'],
  [{ text: '> 90초', bold: true, color: '6E7781' }, '선수 경계 / 큰 휴식', '단일 계정 누적 시 → 자동으로 선수 분할'],
], [1500, 2200, 5700]));

children.push(H2('측정 순서 (선수 1명, 약 20분)'));
children.push(Num('warm-up + 측정 환경 설명 (약 5분)'));
children.push(Num('ForceDecks 4 테스트 (CMJ x3 / SJ x3 / Pogo 1세트 / IMTP x3, 약 7분)'));
children.push(Num('마운드 이동 + 투구 워밍업 (약 3분)'));
children.push(NumMixed([
  { text: 'FB ' }, { text: '10~12 trial', bold: true },
  { text: ' (Theia + Rapsodo 동시 측정, throw 사이 ' }, { text: '20초 간격', bold: true, color: C_BLUE },
  { text: ', 약 4~5분)' }
]));
children.push(Num('(선택) 다른 구질 — Curveball·Slider 등 약 5 throw씩'));
children.push(Num('운영자: c3d 파일 + Rapsodo 마지막 pitch_no 기록 (약 30초)'));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ── 5. v3d ──
children.push(H1('5. Theia c3d → Visual3D ASCII export'));
children.push(P('Qualisys QTM에서 카메라 8대로 자동 수집·동기화한 .c3d 파일을 Visual3D pipeline으로 처리하여 키네매틱스 + 키네틱스 변수를 산출, .c3d.txt (ASCII) 파일로 export합니다. 이 파일이 자동 처리 스크립트의 입력입니다.'));

children.push(H2('Visual3D pipeline 설정 (1회만)'));
children.push(Bullet('Pipeline 이름: BBL_Pitching_v0.41 (또는 최신)'));
children.push(Bullet('Export 컬럼: 87 컬럼 풀 형식 (LANDMARK + Joint Power Scalar + Mechanical Energy + EVENT_LABEL 모두 포함)'));
children.push(Bullet('필수 변수 (자동 추출 대상):'));
[
  'Pelvis_Ang_Vel / Thorax_Ang_Vel / Pitching_Humerus_Ang_Vel / Pitching_Hand_Ang_Vel — 분절 회전속도',
  'Trunk_wrt_Pelvis_Angle — X-factor (분리각)',
  'Pitching_Shoulder_Angle/Ang_Vel + Pitching_Elbow_Angle/Ang_Vel',
  'Lead_Knee_Angle / Back_Knee_Angle / Lead_Hip_Angle / Back_Hip_Angle',
  'COM_displacement (3축) + R_WRIST/R_Elbow/R_Shoulder/L_ANKLE/R_ANKLE — LANDMARK 좌표',
  'STRIDE_LENGTH + STRIDE_LENGTH_MEAN_PERCENT',
  'FP1 (축발) / FP2 (착지발) — Force (X/Y/Z), COFP, FREEMOMENT',
  'EVENT_LABEL: MaxKneeHeight, Footstrike, MaxShoulderVel, Release, Release100msAfter',
  'R/L_Shoulder/Elbow/Hip/Knee_Power_Scalar (8개 Joint Power)',
  'Pelvis_Mechanical_Energy / Trunk_Mechanical_Energy / R_Humerus_ME (3 분절)',
].forEach(t => children.push(Bullet(t, 1)));

children.push(H2('export 절차 (선수당 약 30초)'));
children.push(Num('Visual3D에서 BBL_Pitching pipeline 로드'));
children.push(Num('선수 폴더 내 모든 .c3d 파일 일괄 추가 (drag·drop)'));
children.push(Num('Pipeline 실행 (약 30초~1분)'));
children.push(Num('Export Data to ASCII File 실행 — 같은 폴더에 .c3d.txt 자동 생성'));
children.push(Num('파일 개수 확인: c3d 12개 ↔ c3d.txt 12개 일치 여부'));

children.push(Note('파일명은 절대 변경하지 마세요. "Fastball RH Markerless 1.c3d" 형식 그대로 유지. 자동 처리 스크립트가 파일명에서 구질·투구손·trial 번호를 자동 추출합니다.', C_RED, C_BG_RED));

// ── 6. 폴더 구조 ──
children.push(H1('6. 폴더 구조 + 파일 명명 규칙'));
children.push(H2('전체 디렉토리 구조'));
children.push(Code(
`2026-05-15_1차측정/                          ← 측정일별 최상위 폴더
├── 00_meta/
│   ├── roster.csv                            ← 선수 명단 (필수)
│   └── measurement_log.csv                   ← 선수 경계 기록 (Rapsodo 누적용)
│
├── 01_theia/
│   ├── P01_정예준/
│   │   ├── Fastball RH Markerless 1.c3d      ← 원본 (보존)
│   │   ├── Fastball RH Markerless 1.c3d.txt  ← v3d export (분석용)
│   │   ├── ...
│   │   └── Fastball RH Markerless 12.c3d.txt
│   ├── P02_김강대/
│   └── P03_박명균/
│
├── 02_forcedecks/
│   ├── all_forcedecks.csv                    ← VALD Hub API 통합 export
│   └── individual/                           ← 개별 시도 백업 (선택)
│
├── 03_rapsodo/
│   └── all_rapsodo.csv                       ← Rapsodo 단일 export
│
└── 04_dashboard_import/                      ← 자동 처리 스크립트 출력
    ├── theia_batch.json
    ├── rapsodo_master.csv
    └── validation.txt`
));

children.push(H2('명명 규칙'));
children.push(makeTable([
  ['항목', '형식', '예시', '주의사항'],
  ['측정일 폴더', 'YYYY-MM-DD_N차측정', '2026-05-15_1차측정', 'YYYY-MM-DD ISO 형식'],
  ['선수 폴더', 'P{NN}_{한글이름}', 'P01_정예준', 'PID 두 자리 + 언더스코어 + 한글 이름 (띄어쓰기 없이)'],
  ['Theia c3d', 'Theia 자동 export 그대로', 'Fastball RH Markerless 1.c3d', '절대 이름 변경 금지'],
  ['ForceDecks', 'all_forcedecks.csv', '단일 통합 파일', '28컬럼 wide format'],
  ['Rapsodo', 'all_rapsodo.csv', '단일 누적 파일', '메타 헤더 5줄 + 45컬럼 데이터'],
], [1800, 2300, 2700, 2600]));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ── 7. Rapsodo ──
children.push(H1('7. Rapsodo 2.0 측정 + 데이터 처리'));

children.push(H2('Rapsodo 2.0 설치'));
children.push(Bullet('위치: 홈플레이트에서 투수 방향으로 5~6m 지점'));
children.push(Bullet('정렬: 투구 방향과 정렬 (홈플레이트와 마운드 일직선)'));
children.push(Bullet('카메라 높이: 메이커 권장값 — 투수의 릴리스 높이 + 트랙킹 영역 모두 커버'));

children.push(H2('Rapsodo 2.0 export CSV 구조'));
children.push(P('Rapsodo 2.0이 자동 export하는 CSV는 메타 헤더 5줄 + 45컬럼 데이터로 구성됩니다. 자동 처리 스크립트와 대시보드 importRapsodoCSV가 이 형식을 자동 인식·정규화합니다.'));
children.push(Code(
`[1줄] (빈 줄)
[2줄] "Player ID:",1454724
[3줄] "Player Name:",P 01                    ← 가능하면 PID로 설정
[4줄] (빈 줄)
[5줄] "No","Date","Pitch ID","Pitch Type",...   ← 헤더 (45컬럼)
[6줄~] 1,"Thu Dec 04 2025 5:21:58 AM",1764825718,"Fastball","N",-18.63,...`
));

children.push(H2('45컬럼 핵심 변수 매핑'));
children.push(makeTable([
  ['Rapsodo 컬럼', '의미', '단위 변환'],
  ['Velocity', '릴리스 구속', 'km/h (그대로)'],
  ['Total Spin / True Spin / Spin Efficiency', '총회전·유효회전·효율', 'rpm / rpm / %'],
  ['Spin Direction / Gyro Degree', '회전축 시계방향 / Gyro 각도', 'clock → deg, °'],
  ['VB (trajectory) / HB (trajectory)', 'IVB (수직 라이즈) / HB (수평 무브)', 'cm (그대로)'],
  ['Release Height / Side / Extension (ft)', '릴리스 위치', 'm / m / ft → m (× 0.3048)'],
  ['Vertical/Horizontal Approach Angle', 'VAA / HAA', '°'],
  ['Strike Zone Height / Side', '플레이트 위치', 'cm'],
  ['Is Strike', '존 적중', 'Y/N → 1/0'],
  ['(자동 계산)', 'Bauer Units = spin / (velocity × 0.621)', 'spin·mph 비율'],
], [3300, 3800, 2300]));

children.push(H2('단일 계정 누적 운영 (멤버십 제한)'));
children.push(P('Rapsodo 2.0 멤버십이 선수 1명만 등록 가능한 경우, 모든 선수의 throws가 단일 계정에 누적됩니다. 자동 처리 스크립트가 timestamp 갭 분석으로 선수 경계를 자동 분할합니다.'));

children.push(H3('운영 권장 사항'));
children.push(Bullet('가능하면 매 선수 측정 전 Rapsodo 앱에서 Player Name을 P01, P02, P03 형식으로 변경'));
children.push(Bullet('Player Name 변경 불가하면 — 선수 교체 시 2분 이상 휴식 시간 확보 (timestamp 갭으로 자동 분할 가능)'));
children.push(Bullet('measurement_log.csv에 선수당 한 줄씩 first/last throw_no 기록 (5초/선수)'));

children.push(H3('measurement_log.csv 형식'));
children.push(Code(
`athlete_external_id,athlete_name,first_throw_no,last_throw_no,note
P01,정예준,1,12,
P02,김강대,13,22,
P03,박명균,23,33,trial 4 자세불량 (제외)`
));

// ── 8. VALD ──
children.push(H1('8. VALD ForceDecks API (CMJ·SJ·Pogo·IMTP)'));
children.push(P('VALD Hub의 OAuth 2.0 + REST API를 통해 ForceDecks 측정 데이터를 자동 다운로드합니다. 측정 직후 또는 일괄로 받아 BBL 통합 28컬럼 CSV 형식으로 정리합니다.'));

children.push(H2('인증 (OAuth 2.0 Client Credentials)'));
children.push(Code(
`POST https://security.valdperformance.com/connect/token
Body (form-urlencoded):
  grant_type=client_credentials
  client_id=<BBL_CLIENT_ID>
  client_secret=<BBL_CLIENT_SECRET>

Response:
  access_token (JWT)  ← 1시간 유효
  expires_in: 3600
  token_type: Bearer`
));

children.push(H2('주요 엔드포인트'));
children.push(makeTable([
  ['엔드포인트', '용도'],
  ['GET /v2/forcedecks/tests/modified-since/{datetime}', '특정 시각 이후 수정된 모든 테스트 목록 (증분 동기화)'],
  ['GET /v2/forcedecks/tests/{testId}/results', '특정 테스트의 raw 결과 (모든 변수)'],
  ['GET /v2/forcedecks/tests/{testId}/trials', '시도별 결과 (CMJ 3회 등)'],
  ['GET /v2/profiles/{profileId}', '선수 프로필 (이름·생년·신장 등)'],
], [4500, 4900]));

children.push(H2('필요 권한 (scope)'));
children.push(Bullet('forcedecks.read — ForceDecks 데이터 조회'));
children.push(Bullet('profiles.read — 선수 프로필 조회'));
children.push(Note('BBL client credentials는 VALD support에 별도 신청. 신청 후 발급까지 약 1~2주 소요. Phase 1에서는 수동 CSV export 사용 → Phase 2에서 API 자동 동기화로 전환.', C_BLUE, C_BG_BLUE));

children.push(H2('통합 CSV 28컬럼 형식'));
children.push(P('1행 = 1선수의 4 테스트 통합. API 응답을 long → wide 변환하여 BBL 표준 28컬럼으로 정리합니다.'));
children.push(Code(
`식별 (8): athlete_external_id, athlete_name, date_of_birth, sex,
         height_cm, weight_kg, bmi, handedness
세션 (2): test_date, session_id
CMJ (6): cmj_jump_height_cm, cmj_peak_power_w, cmj_peak_power_bm_w_kg,
         cmj_rsi_modified_ms, cmj_concentric_peak_force_bm_n_kg,
         cmj_eccentric_concentric_force_ratio
SJ + EUR (4): sj_jump_height_cm, sj_peak_power_bm_w_kg,
              sj_concentric_peak_force_bm_n_kg, eur
Pogo (3): pogo_rsi_ms, pogo_mean_contact_time_ms, pogo_mean_jump_height_cm
IMTP (5): imtp_peak_vertical_force_n, imtp_peak_vertical_force_bm_n_kg,
          imtp_rfd_0_100ms_n_s, imtp_force_at_100ms_bm_n_kg, imtp_asymmetry_pct`
));

children.push(H2('API 자동 동기화 흐름 (Phase 2)'));
children.push(Code(
`1. POST /connect/token  →  access_token 획득
2. GET /v2/forcedecks/tests/modified-since/{last_sync}
3. 각 testId에 대해 GET /v2/forcedecks/tests/{testId}/trials
4. 변환 로직 (long → wide format) → 28컬럼
5. python scripts/import_metrics.py 자동 호출
6. last_sync timestamp 갱신 (cron 또는 webhook)`
));

children.push(H2('QC 임계값 (재측정 기준)'));
children.push(makeTable([
  ['검사', '임계값', '대응'],
  ['CMJ Jump Height 3회 CV', '> 10%', '1회 추가 측정'],
  ['SJ Jump Height 3회 CV', '> 10%', '1회 추가 측정'],
  ['IMTP Peak Force 3회 CV', '> 5%', '1회 추가 측정'],
  ['arm swing / 카운터무브 위반', '즉시 감지', '시도 무효 → 재측정'],
], [4000, 1800, 3600]));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ── 9. 자동 처리 ──
children.push(H1('9. 자동 처리 스크립트 사용법'));
children.push(P('Dashboard_Pitching_Team/scripts/process_pitching_session.py 한 파일이 모든 자동 처리를 담당합니다.'));

children.push(H2('실행 명령'));
children.push(Code(
`cd Dashboard_Pitching_Team/
python3 scripts/process_pitching_session.py 2026-05-15_1차측정/

# 출력 (04_dashboard_import/)
#   theia_batch.json     선수별 Theia 통합 (대시보드 인입용)
#   rapsodo_master.csv   정규화된 Rapsodo (단위 변환·갭 분석 포함)
#   validation.txt       자동 진단 + 수작업 alert`
));

children.push(H2('자동 처리 항목'));
children.push(Bullet('Theia c3d.txt 87컬럼 자동 파싱 (선수당 10~12 trial)'));
children.push(Bullet('Median + outlier-clip robust 처리 (Visual3D 일부 trial spike 제거)'));
children.push(Bullet('roster.csv handedness ↔ 파일명 LH/RH cross-check'));
children.push(Bullet('Rapsodo 2.0 메타 헤더 5줄 자동 스킵 + 45컬럼 정규화'));
children.push(Bullet('throw 간 timestamp 갭 분석 → 정상 / 누락 / 검토 / 선수 경계 자동 분류'));
children.push(Bullet('단일 계정 누적 시 timestamp 갭(>90초)으로 선수 자동 분할'));
children.push(Bullet('단위 변환: clock → deg, ft → m, Y/N → 0/1, "-" → null'));
children.push(Bullet('Bauer Units 자동 계산 (spin / velocity_mph)'));
children.push(Bullet('합성지표: 출력·전달·누수관리·LHEI·종합점수 자동 산출'));
children.push(Bullet('인과 분석 Top 3 (점수 낮은 ELI zone 우선순위)'));

children.push(H2('대시보드 인입'));
children.push(P('처리 스크립트 출력 후, 대시보드의 데이터 관리 탭에 다음 두 파일을 끌어놓으면 자동 인입됩니다:'));
children.push(Bullet('① theia_batch.json — Theia 메카닉·GRF·인과 분석 (전 선수 1번에)'));
children.push(Bullet('② rapsodo_master.csv — 정규화된 Rapsodo 패스트볼 분석'));
children.push(Bullet('③ all_forcedecks.csv — 체력 (선택, ForceDecks 폴더에서 직접 끌어놓기 가능)'));

children.push(Note('원본 Rapsodo CSV (45컬럼 메타 헤더 형식)도 직접 끌어놓을 수 있습니다 — 대시보드의 detectAndNormalizeRapsodoV2가 자동 감지·정규화합니다.', C_BLUE, C_BG_BLUE));

// ── 10. FAQ ──
children.push(H1('10. 검증 + 트러블슈팅 + FAQ'));
children.push(H2('validation.txt 읽는 법'));
children.push(Code(
`✅ P01 정예준 — 12 trial 정상 (c3d=12, rap=12)
   → 모든 데이터 OK, 추가 작업 없음

⚠️ P03 박명균 — c3d 누락
   c3d:  1,2,3, _ ,5,6,7,8,9,10,11,12  (n=11)
   rap:  1,2,3,4,5,6,7,8,9,10,11,12   (n=12)
   → trial 4 자세불량 추정. Rapsodo throw 4 자동 제외.

⚠️ P04 이영하 — Rapsodo 누락
   c3d:  1,2,3,4,5,6,7,8,9,10,11,12  (n=12)
   rap:  1,2,3, _ ,5,6,7,8,9,10,11,12  (n=11)
   → trial 4 메카닉만 분석 (구속·회전 데이터 없음)

❌ P05 김민수 — 폴더명 ↔ 파일명 불일치
   폴더: P05_김민수 (roster: R)
   파일명: Fastball *LH* Markerless ...
   → 다른 선수 파일이 섞였는지 확인 필요`
));
children.push(P('빨간 ❌ 0개가 되어야 다음 단계 (대시보드 인입) 진행 가능. ⚠ 노란 alert는 자동 처리되었으므로 추가 작업 불필요.'));

children.push(H2('자주 묻는 질문 (FAQ)'));
const faq = [
  ['Q. trial 4번이 무효라 다시 측정했어요. 번호를 다시 매길까요?',
   '아니요. v3d export 그대로 두세요 (1, 2, 3, 5, 6, ...). 자동 처리가 trial 누락을 자동 감지합니다.'],
  ['Q. Rapsodo가 4번째 throw를 못 잡았어요.',
   '아무것도 안 해도 됩니다. Rapsodo CSV 그대로 두세요. throw 간격이 30~50초로 표시되어 자동으로 누락 인식됩니다.'],
  ['Q. 좌투수도 같은 형식인가요?',
   '네. 파일명만 "Fastball LH Markerless N.c3d" 형식으로 자동 됩니다. 자동 처리 스크립트가 LH/RH ↔ roster handedness를 cross-check 합니다.'],
  ['Q. Curveball·Slider도 측정하면?',
   '같은 폴더에 함께 넣으세요. 파일명 토큰 "Curveball/Slider"로 자동 분리됩니다. 단, 1차 측정 헤드라인은 Fastball 분석입니다.'],
  ['Q. Rapsodo Player Name이 모두 P 01로 되어 있어요. 분할 안 되나요?',
   '됩니다. 자동 처리 스크립트가 timestamp 갭 (>90초)으로 선수 경계를 자동 감지합니다. 단, 매 선수 교체 시 2분 이상 휴식이 권장됩니다.'],
  ['Q. ForceDecks API client credentials가 아직 없어요.',
   'Phase 1: VALD Hub 웹에서 수동 CSV export → 28컬럼 형식으로 정리 → 02_forcedecks/all_forcedecks.csv로 저장. Phase 2 (API 자동 동기화)는 credentials 발급 후 전환.'],
  ['Q. measurement_log.csv를 안 쓰면 어떻게 되나요?',
   'timestamp 갭 (>90초)이 명확하면 자동 분할됩니다. 갭이 모호한 경우만 measurement_log.csv가 필요합니다 (전체 선수 중 평균 1~2명).'],
  ['Q. 폴더명에 한글 사용 가능한가요?',
   '네. P01_정예준 형식 권장. PID로 자동 매칭, 한글 이름은 사람이 보기 쉬운 라벨 역할. macOS↔Windows 간 GitHub sync 시 NFC/NFD 정규화 차이 주의 (c3d 원본은 .gitignore에 추가하여 GitHub 업로드 회피).'],
  ['Q. 대시보드 어디서 확인하나요?',
   'https://kkl0511.github.io/Dashboard_Pitching_Team/ — PC·모바일 모두 접속 가능. 데이터 관리 탭에서 처리 결과 인입.'],
  ['Q. FP1과 FP2 정의가 바뀌었다고요?',
   '네. v1.1부터 FP1=축발(뒷발), FP2=착지발(앞발) 새 lab convention 적용. v3d pipeline에 force plate 라벨 매핑 확인 후 export. 처리 스크립트와 대시보드 GRF 라벨도 동일 갱신됨.'],
];
faq.forEach(([q, a]) => {
  children.push(Mixed([{ text: q, bold: true }], { before: 100, after: 30 }));
  children.push(P(a, { before: 0, after: 60, indent: 200 }));
});

children.push(H2('문의'));
children.push(BulletMixed([
  { text: '데이터 입력·처리 관련: ' }, { text: 'kklee@kookmin.ac.kr', bold: true }
]));
children.push(BulletMixed([
  { text: '대시보드·자동화: ' }, { text: 'github.com/kkl0511/Dashboard_Pitching_Team', code: true }
]));
children.push(BulletMixed([
  { text: '관련 리포트 repo: Theia+GRF, Uplift (각각 Pitching_Report)' }
]));

children.push(new Paragraph({
  children: [new TextRun({
    text: '문서 버전 v1.1 (' + today + ') · 이기광 교수 검토 코멘트 5건 반영 · 바이오모션 베이스볼 랩 · 국민대학교 바이오메카닉스 연구실',
    font: FONT, size: SZ_CAP, color: C_MUTED, italics: true,
  })],
  alignment: AlignmentType.CENTER, spacing: { before: 600, after: 60 },
}));

// ── 빌드 ──
const doc = new Document({
  creator: 'BBL', title: '상동고 1차 측정 매뉴얼 v1.1',
  styles: {
    default: { document: { run: { font: FONT, size: SZ_BODY, color: C_TEXT } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: SZ_H1, bold: true, font: FONT, color: C_BLUE },
        paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: SZ_H2, bold: true, font: FONT, color: C_TEXT },
        paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: SZ_H3, bold: true, font: FONT, color: C_TEXT },
        paragraph: { spacing: { before: 140, after: 60 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [
        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 480, hanging: 240 } } } },
        { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 840, hanging: 240 } } } },
      ]},
      { reference: 'numbers', levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 480, hanging: 240 } } } },
      ]},
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
      },
    },
    headers: {
      default: new Header({ children: [new Paragraph({
        children: [
          new TextRun({ text: '상동고 1차 측정 매뉴얼 v1.1', font: FONT, size: SZ_CAP, color: C_MUTED }),
          new TextRun({ text: '\t' }),
          new TextRun({ text: 'BBL · 2026', font: FONT, size: SZ_CAP, color: C_MUTED }),
        ],
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      })] }),
    },
    footers: {
      default: new Footer({ children: [new Paragraph({
        children: [
          new TextRun({ text: 'kklee@kookmin.ac.kr', font: FONT, size: SZ_CAP, color: C_MUTED }),
          new TextRun({ text: '\t' }),
          new TextRun({ text: '페이지 ', font: FONT, size: SZ_CAP, color: C_MUTED }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: SZ_CAP, color: C_MUTED }),
          new TextRun({ text: ' / ', font: FONT, size: SZ_CAP, color: C_MUTED }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: SZ_CAP, color: C_MUTED }),
        ],
        alignment: AlignmentType.RIGHT,
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      })] }),
    },
    children,
  }],
});

const outDir = path.dirname(__filename) + '/../docs';
const outPath = outDir + '/측정_프로토콜_매뉴얼_v1.1.docx';
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(outPath, buf);
  console.log('생성:', outPath, fs.statSync(outPath).size, 'bytes');
});
