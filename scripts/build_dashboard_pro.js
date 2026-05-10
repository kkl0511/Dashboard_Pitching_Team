#!/usr/bin/env node
/**
 * build_dashboard_pro.js — KBO Pro Edition (v6.0)
 *
 * 입력 (src/):
 *   index_pro.html   Pro HTML 골격 (placeholder: <!-- MAIN_SCRIPTS -->, <link href="style_pro.css">)
 *   style_pro.css    Driveline+ 풍 스타일 (네이비 + 빨강 accent)
 *   js/*.js          분석/데이터 모듈 (기존 코드 재사용)
 *
 * 출력:
 *   dashboard_pro.html  KBO 프로팁 서비스용 (Tab 2 = 선수별 리포트 우선)
 *
 * 사용: node scripts/build_dashboard_pro.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const SRC = path.join(ROOT, 'src');

// 모듈 합성 순서 — 기존 dashboard.html 과 동일 (분석 로직 100% 재사용)
const JS_MODULES = [
  'js/driveline.js',
  'js/analytics_velocity.js',
  'js/analytics_fitness.js',
  'js/analytics_mechanic.js',
  'js/data.js',
  // render_*는 KBO Pro 전용 신규 모듈로 교체 (단계 4 이상에서 추가)
  // 'js/render_player_pro.js',  // ★ v6.0 단계 4부터 추가 예정
  'js/io_apply.js',
  'js/io_c3d.js',
  'js/io_csv.js',
  'js/io_storage.js',
];

function read(rel) {
  return fs.readFileSync(path.join(SRC, rel), 'utf8');
}
function exists(rel) {
  return fs.existsSync(path.join(SRC, rel));
}

function readAllJS() {
  const banner = (m) => `\n/* ===== ${m} ===== */\n`;
  return JS_MODULES.filter(exists).map(m => banner(m) + read(m)).join('\n');
}

function buildHTML() {
  const css = read('style_pro.css');
  const js = readAllJS();
  let html = read('index_pro.html');

  html = html.replace('<link rel="stylesheet" href="style_pro.css">',
    `<style>\n${css}\n</style>`);

  const chartScript =
    '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>';

  html = html.replace('<!-- MAIN_SCRIPTS -->',
    `${chartScript}\n<script>\n${js}\n</script>`);

  return html;
}

// 빌드
fs.writeFileSync(path.join(ROOT, 'dashboard_pro.html'), buildHTML());
const size = fs.statSync(path.join(ROOT, 'dashboard_pro.html')).size;
console.log(`✓ dashboard_pro.html   ${size.toLocaleString()} bytes`);
console.log('\n빌드 완료. src/ 편집 후 node scripts/build_dashboard_pro.js 다시 실행.');
