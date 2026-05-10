// main.js — Electron 메인 프로세스 (상동고 투구 리포트 v5.40)
//   dashboard.html 을 BrowserWindow 에 로드 + 폴더 import + PDF 일괄 인쇄 + 자동 백업
const { app, BrowserWindow, Menu, dialog, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

let mainWindow;
const APP_DATA = path.join(app.getPath('userData'), 'data');
const REPORTS_DIR = path.join(app.getPath('documents'), 'BBL_Reports');
fs.mkdirSync(APP_DATA, { recursive: true });
fs.mkdirSync(REPORTS_DIR, { recursive: true });

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 920, minWidth: 1100, minHeight: 720,
    title: '상동고 투구 리포트 — Dashboard v5.40',
    backgroundColor: '#fafbfc',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'icon.png'),
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'dashboard.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // 외부 링크는 시스템 브라우저로
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });

  // ──── 메뉴 — 윈도우/Linux 한글, macOS 시스템 메뉴 유지 ────
  const menuTemplate = [
    {
      label: '파일(&F)',
      submenu: [
        { label: '📂 측정 폴더 가져오기...', accelerator: 'CmdOrCtrl+O', click: () => importFolder() },
        { label: '🗃 c3d.txt 파일 가져오기...', accelerator: 'CmdOrCtrl+Shift+O', click: () => importFiles() },
        { type: 'separator' },
        { label: '🖨 선수별 PDF 일괄 출력', accelerator: 'CmdOrCtrl+P', click: () => batchPrintPDF('player') },
        { label: '📊 코치 종합 PDF 출력', accelerator: 'CmdOrCtrl+Shift+P', click: () => batchPrintPDF('coach') },
        { type: 'separator' },
        { label: '💾 백업 (현재 데이터)', click: () => backupData() },
        { label: '🔄 백업 복원...', click: () => restoreBackup() },
        { type: 'separator' },
        { role: 'quit', label: '종료' }
      ]
    },
    {
      label: '보기(&V)',
      submenu: [
        { role: 'reload', label: '새로 고침' },
        { role: 'forceReload', label: '강제 새로 고침' },
        { type: 'separator' },
        { role: 'zoomIn', label: '확대' },
        { role: 'zoomOut', label: '축소' },
        { role: 'resetZoom', label: '기본 크기' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '전체 화면' },
        { role: 'toggleDevTools', label: '개발자 도구' }
      ]
    },
    {
      label: '도움말(&H)',
      submenu: [
        { label: '🌐 GitHub 저장소 (최신 버전)', click: () => shell.openExternal('https://github.com/kkl0511/Dashboard_Pitching_Team') },
        { label: '📁 데이터 폴더 열기', click: () => shell.openPath(APP_DATA) },
        { label: '📄 리포트 폴더 열기', click: () => shell.openPath(REPORTS_DIR) },
        { type: 'separator' },
        { label: '버전 정보', click: () => dialog.showMessageBox({
          type: 'info',
          title: '상동고 투구 리포트',
          message: '상동고 투구 리포트 Dashboard',
          detail: `v5.40 · Driveline 5 모델 + ETE + GRF\n\n바이오모션 베이스볼 랩 (BBL)\n국민대학교 스포츠과학과\nkklee@kookmin.ac.kr`,
          buttons: ['확인']
        })}
      ]
    }
  ];
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
  }
}

// ──── IPC 핸들러: dashboard.html 의 JS 가 호출 ────
ipcMain.handle('app:get-data-dir', () => APP_DATA);
ipcMain.handle('app:get-reports-dir', () => REPORTS_DIR);
ipcMain.handle('app:save-data', async (_, name, jsonStr) => {
  const filePath = path.join(APP_DATA, name);
  fs.writeFileSync(filePath, jsonStr, 'utf8');
  return filePath;
});
ipcMain.handle('app:load-data', async (_, name) => {
  const filePath = path.join(APP_DATA, name);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
});
ipcMain.handle('app:list-data', async () => {
  return fs.readdirSync(APP_DATA).filter(f => f.endsWith('.json'));
});

// ──── 측정 폴더 import (운영자 작업 0초) ────
async function importFolder() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '측정 세션 폴더 선택 (예: 2026-05-15_1차측정/)',
    properties: ['openDirectory']
  });
  if (result.canceled || !result.filePaths.length) return;
  const sessionDir = result.filePaths[0];
  const theiaDir = path.join(sessionDir, '01_theia');
  const rapsodoDir = path.join(sessionDir, '03_rapsodo');

  if (!fs.existsSync(theiaDir)) {
    dialog.showMessageBox(mainWindow, {
      type: 'error', title: '폴더 구조 오류',
      message: `01_theia/ 하위 폴더를 찾을 수 없습니다.\n\n선택된 경로: ${sessionDir}\n\n표준 구조는 매뉴얼 §10.3 참조.`
    });
    return;
  }

  // process_pitching_session.py 호출 (Python embedded 또는 시스템 Python)
  const scriptPath = path.join(__dirname, 'scripts', 'process_pitching_session.py');
  const outFile = path.join(APP_DATA, `theia_batch_${Date.now()}.json`);

  if (!fs.existsSync(scriptPath)) {
    // Python 미통합 시 — c3d.txt 만 복사 + 사용자에게 dashboard import 안내
    dialog.showMessageBox(mainWindow, {
      type: 'info', title: '폴더 가져오기',
      message: `폴더 import 완료 (파일 분석은 dashboard 의 'Theia c3d Import' 버튼 사용).\n\n${sessionDir}`,
      buttons: ['확인']
    });
    mainWindow.webContents.send('folder:imported', { sessionDir, theiaDir, rapsodoDir });
    return;
  }

  const proc = spawn('python', [scriptPath, sessionDir, '--output', outFile], { shell: true });
  let stderr = '';
  proc.stderr.on('data', d => stderr += d.toString());
  proc.on('close', code => {
    if (code === 0 && fs.existsSync(outFile)) {
      mainWindow.webContents.send('folder:processed', { jsonPath: outFile, sessionDir });
      dialog.showMessageBox(mainWindow, {
        type: 'info', title: '✅ 자동 처리 완료',
        message: `c3d.txt + Rapsodo 매칭 완료.\n\n결과 파일: ${outFile}\n\ndashboard 에 자동 로드됩니다.`
      });
    } else {
      dialog.showMessageBox(mainWindow, {
        type: 'error', title: 'Python 처리 실패',
        message: `process_pitching_session.py 실행 오류 (code ${code}).\n\n${stderr.slice(0, 500)}`
      });
    }
  });
}

async function importFiles() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'c3d.txt 또는 JSON 파일 선택',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Theia c3d Text', extensions: ['txt'] },
      { name: 'Dashboard JSON', extensions: ['json'] }
    ]
  });
  if (result.canceled) return;
  mainWindow.webContents.send('files:selected', { paths: result.filePaths });
}

// ──── PDF 일괄 출력 ────
async function batchPrintPDF(mode) {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'PDF 저장 폴더 선택',
    defaultPath: REPORTS_DIR,
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled) return;
  const outDir = result.filePaths[0];

  // dashboard 의 JS 가 인쇄 모드 활성화 → printToPDF
  if (mode === 'player') {
    mainWindow.webContents.send('print:player-batch', { outDir });
  } else {
    mainWindow.webContents.send('print:coach', { outDir });
  }
}

// PDF 출력 IPC (renderer 가 호출)
ipcMain.handle('print:to-pdf', async (_, { filename, options }) => {
  const buffer = await mainWindow.webContents.printToPDF({
    pageSize: 'A4',
    landscape: false,
    printBackground: true,
    marginsType: 1,
    ...options
  });
  const outPath = path.join(REPORTS_DIR, filename);
  fs.writeFileSync(outPath, buffer);
  return outPath;
});

// ──── 백업 + 복원 ────
async function backupData() {
  const dateStr = new Date().toISOString().slice(0, 10);
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '백업 파일 저장',
    defaultPath: path.join(REPORTS_DIR, `BBL_Backup_${dateStr}.zip`),
    filters: [{ name: 'ZIP archive', extensions: ['zip'] }]
  });
  if (result.canceled) return;
  // 간단 백업 — APP_DATA 의 JSON 파일을 단순 복사 (zip 라이브러리 추가 시 archiver 사용)
  const targetDir = result.filePath.replace('.zip', '');
  fs.mkdirSync(targetDir, { recursive: true });
  fs.readdirSync(APP_DATA).forEach(f => {
    fs.copyFileSync(path.join(APP_DATA, f), path.join(targetDir, f));
  });
  dialog.showMessageBox(mainWindow, {
    type: 'info', title: '✅ 백업 완료',
    message: `${fs.readdirSync(APP_DATA).length} 파일 백업\n\n위치: ${targetDir}`
  });
}

async function restoreBackup() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '백업 폴더 선택',
    properties: ['openDirectory']
  });
  if (result.canceled) return;
  const srcDir = result.filePaths[0];
  let count = 0;
  fs.readdirSync(srcDir).forEach(f => {
    if (f.endsWith('.json')) {
      fs.copyFileSync(path.join(srcDir, f), path.join(APP_DATA, f));
      count++;
    }
  });
  dialog.showMessageBox(mainWindow, {
    type: 'info', title: '✅ 복원 완료',
    message: `${count} 파일 복원\n\n앱 재시작 권장.`
  });
}

// ──── 앱 라이프사이클 ────
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
