// build-prep.js — 빌드 직전 dashboard.html + scripts + assets 복사
//   사용: cd electron && node build-prep.js && npm run dist:win
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEST = __dirname;

function copy(src, dst){
  if(!fs.existsSync(src)){ console.warn('  ⚠ skip (not found):', src); return; }
  if(fs.statSync(src).isDirectory()){
    fs.mkdirSync(dst, {recursive: true});
    fs.readdirSync(src).forEach(f => copy(path.join(src, f), path.join(dst, f)));
  } else {
    fs.mkdirSync(path.dirname(dst), {recursive: true});
    fs.copyFileSync(src, dst);
  }
}

console.log('▶ Electron 빌드 준비 — 파일 복사');
copy(path.join(ROOT, 'dashboard.html'),  path.join(DEST, 'dashboard.html'));
copy(path.join(ROOT, 'scripts'),         path.join(DEST, 'scripts'));
copy(path.join(ROOT, 'assets'),          path.join(DEST, 'assets'));

// icon.png — 없으면 placeholder 생성 (256x256 단색 PNG)
const iconPath = path.join(DEST, 'icon.png');
if(!fs.existsSync(iconPath)){
  // Minimal 256×256 blue PNG (placeholder until BBL 로고 제공)
  const png = Buffer.from(
    '89504e470d0a1a0a0000000d4948445200000100000001000806000000' +
    '5c72a8660000001f4944415478daed' +
    'c1010d000000c2a0f74f6dee0c' +
    '70000000d80a000000000000000000ff04860000000000a0000000004' +
    '9454e44ae426082', 'hex'
  );
  // Note: 위 PNG 는 gzip 헤더용. 실제 256x256 은 별도 추가 필요.
  console.warn('  ⚠ icon.png 미감지 — BBL 로고 256×256 PNG 추가 필요 (electron/icon.png)');
}

console.log('✓ 빌드 준비 완료');
console.log('  → npm run dist:win 실행하면 dist/Setup.exe 생성');
