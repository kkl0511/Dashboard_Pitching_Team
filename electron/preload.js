// preload.js — Renderer (dashboard.html) 에 안전한 IPC API 노출
//   contextIsolation:true 환경에서 window.bblApp.* 로 접근
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bblApp', {
  // 데이터 영구 저장 (AppData/data/*.json — localStorage 5MB 제한 우회)
  saveData:    (name, jsonStr) => ipcRenderer.invoke('app:save-data', name, jsonStr),
  loadData:    (name)          => ipcRenderer.invoke('app:load-data', name),
  listData:    ()              => ipcRenderer.invoke('app:list-data'),
  getDataDir:  ()              => ipcRenderer.invoke('app:get-data-dir'),
  getReportsDir: ()            => ipcRenderer.invoke('app:get-reports-dir'),

  // PDF 출력 (메뉴 → File > PDF)
  printToPDF:  (opts)          => ipcRenderer.invoke('print:to-pdf', opts),

  // 메뉴에서 폴더/파일 선택 시 dashboard 에 알림
  onFolderImported:   cb => ipcRenderer.on('folder:imported',  (_, data) => cb(data)),
  onFolderProcessed:  cb => ipcRenderer.on('folder:processed', (_, data) => cb(data)),
  onFilesSelected:    cb => ipcRenderer.on('files:selected',   (_, data) => cb(data)),
  onPlayerBatchPrint: cb => ipcRenderer.on('print:player-batch', (_, data) => cb(data)),
  onCoachPrint:       cb => ipcRenderer.on('print:coach',        (_, data) => cb(data))
});
