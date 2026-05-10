# 다른 컴퓨터에서 작업 이어가기 (v5.41 기준)

작성: 2026-05-11

---

## 0. 핵심 요약

| 단계 | 어디서 | 무엇을 |
|---|---|---|
| **A** | **현재 컴퓨터** | git push + tag (필수) |
| **B** | **다른 컴퓨터** | 사전 도구 설치 |
| **C** | **다른 컴퓨터** | repo clone |
| **D** | **다른 컴퓨터** | Claude 새 대화 시작 |
| **E** | **다른 컴퓨터** (선택) | 메모리 파일 이전 |

---

## A. 현재 컴퓨터에서 먼저 push (필수!)

⚠️ **이 단계 안 하면 다른 컴퓨터에서 v5.41 변경사항 못 봄.**

### A-1. git index.lock 해제 (필요 시)

터미널에서:

```bash
cd "/Users/kikwanglee/Documents/Claude/Projects/상동고 투구 리포트/Dashboard_Pitching_Team"
sudo rm -f .git/index.lock
```

### A-2. 변경사항 확인 + commit (이미 commit 된 경우 skip)

```bash
git status                # 변경된 파일 확인
git add -A                # 모든 변경사항 staging
git commit -m "v5.41: 빈 GRF event trial (#65) 처리 + fallback hierarchy"
```

### A-3. push + tag

```bash
git push origin main      # 코드 push
git tag v5.41             # 버전 태그
git push origin v5.41     # 태그 push → 자동 .exe 빌드 트리거
```

push 후 약 10분 뒤 .exe 자동 빌드 결과 확인:
- https://github.com/kkl0511/Dashboard_Pitching_Team/releases

---

## B. 다른 컴퓨터 사전 도구 설치

### B-1. Git
- Mac: `xcode-select --install` (Xcode CLT 설치 시 자동 포함)
- Windows: https://git-scm.com/download/win

### B-2. Python 3.10+
- 데이터 처리 (`scripts/process_pitching_session.py`) 필요
- Mac: `brew install python@3.11` 또는 https://www.python.org/downloads/
- Windows: https://www.python.org/downloads/ (설치 시 "Add Python to PATH" 체크)
- 표준 라이브러리만 사용 — 별도 패키지 설치 불필요

### B-3. Node.js (빌드 스크립트용)
- Mac: `brew install node` 또는 https://nodejs.org/
- Windows: https://nodejs.org/ (LTS 버전 권장)

### B-4. Claude (대화 환경)
다음 중 하나:
- **Claude 데스크탑 앱** (Cowork mode) — 권장: 작업 폴더 직접 접근
  - https://claude.ai/download
- **Claude.ai 웹**: 파일 업로드 방식만 가능
- **Claude Code**: CLI 환경

### B-5. (선택) GitHub 인증
다른 컴퓨터에서 push 도 하려면:
```bash
git config --global user.name "kkl0511"
git config --global user.email "kklee@kookmin.ac.kr"
```
그리고 GitHub Personal Access Token 또는 SSH key 설정.

---

## C. 다른 컴퓨터에서 repo clone

### C-1. 작업 폴더 생성

원하는 위치에 폴더 생성:

```bash
mkdir -p ~/Documents/Claude/Projects
cd ~/Documents/Claude/Projects
```

### C-2. clone

```bash
git clone https://github.com/kkl0511/Dashboard_Pitching_Team.git "상동고 투구 리포트/Dashboard_Pitching_Team"
cd "상동고 투구 리포트/Dashboard_Pitching_Team"
```

### C-3. 동작 확인

Python 스크립트 테스트:

```bash
python3 scripts/recompute_test_player_v541.py
```

성공 시: `총 10/10 trial 처리 완료` + `theia_TEST_10trial_single.json 갱신 완료` 출력

빌드 스크립트 테스트:

```bash
node scripts/build_dashboard.js
```

성공 시: `dashboard.html` 파일 갱신.

---

## D. Claude 새 대화 시작

### D-1. Cowork mode (권장)

1. Claude 앱 실행
2. 새 대화 생성
3. 폴더 선택: `~/Documents/Claude/Projects/상동고 투구 리포트` (clone 한 위치 한 단계 위)
4. 첫 메시지:

```
상동고 투구 리포트 v5.41 프로젝트를 이어서 작업합니다.

먼저 다음 두 파일을 읽어 현재 상태 파악해주세요:
- Dashboard_Pitching_Team/docs/HANDOFF_v5.40.md (v5.41 변경 기록 포함)
- Dashboard_Pitching_Team/docs/CONTINUE_ON_OTHER_COMPUTER.md
```

### D-2. 사용자 preference 다시 설정

새 컴퓨터의 Claude는 이전 컴퓨터 메모리/preference 모름. 한 번 안내:

```
저는 스포츠과학과 교수, 야구 바이오메카닉스 전공입니다.
코딩은 초보 수준이므로 친절히 설명해주세요.
한국어로 응답해주세요.
```

### D-3. 핵심 작업 명령어 cheatsheet

| 작업 | 명령 |
|---|---|
| 대시보드 빌드 | `node scripts/build_dashboard.js` |
| 코치 PPTX | `node scripts/build_coach_deck.js --session 1` |
| TestPlayer 재처리 | `python3 scripts/recompute_test_player_v541.py` |
| c3d.txt 일괄 처리 | `python3 scripts/process_pitching_session.py <session_dir>` |
| Electron 빌드 | `cd electron && npm install && npm run dist:win` |

---

## E. (선택) 메모리 파일 이전

⚠️ **메모리는 컴퓨터별로 따로 저장됨 — 자동 sync 안됨.**

이전 컴퓨터의 Claude 메모리를 새 컴퓨터로 옮기려면 (선택):

### E-1. 이전 컴퓨터에서 메모리 폴더 복사

Mac 메모리 위치:
```
~/Library/Application Support/Claude/local-agent-mode-sessions/
```

이 폴더 안의 `spaces/<UUID>/memory/*.md` 파일들을 USB 또는 클라우드로 복사.

핵심 메모리 파일 (8개):
- `MEMORY.md` (인덱스)
- `user_role.md`
- `project_sangdong_dashboard.md`
- `feedback_dashboard_workflow.md`
- `project_manual_v2_and_dashboard_v5.md`
- `project_dashboard_v540.md` (v5.41 내용)
- `reference_driveline_pitching_report.md`
- `reference_driveline_hp_assessment.md`
- `reference_sangdong_sampling_rates.md`

### E-2. 새 컴퓨터에서 메모리 폴더에 복사

새 컴퓨터에서 Claude 한 번 실행 후 동일 위치 폴더 생성됨. 거기에 `*.md` 파일 복사.

### E-3. 또는 처음부터 build-up (더 간단)

메모리 이전 안 하고도 작동:
- HANDOFF_v5.40.md 가 핵심 정보 모두 담고 있음
- 새 대화에서 자연스럽게 상호작용하며 메모리 다시 쌓임

권장: **E-3 (build-up) 방식이 더 간단**. 메모리 이전은 까다롭고 손실 위험.

---

## F. 자주 마주칠 문제

### F-1. `git push` 실패 (401 Unauthorized)
GitHub Personal Access Token 만료 또는 미설정.
- GitHub → Settings → Developer Settings → Personal Access Tokens → Generate new
- 또는 SSH key 설정: https://docs.github.com/en/authentication/connecting-to-github-with-ssh

### F-2. `python3` 명령 안 먹힘 (Windows)
`python` 으로 시도. 또는 PowerShell 에서:
```powershell
py -3 scripts/recompute_test_player_v541.py
```

### F-3. 한글 폴더명 인코딩 오류
일부 환경에서 "상동고 투구 리포트" 한글 경로 문제. 영문 경로 사용 권장:
```bash
git clone https://github.com/kkl0511/Dashboard_Pitching_Team.git Dashboard_Pitching_Team
```

### F-4. node_modules 없음 (Electron 빌드)
```bash
cd electron
npm install   # ~5분 (~150 MB)
```

### F-5. .git/index.lock 권한 문제
```bash
sudo rm -f .git/index.lock
```

---

## G. 핸드오프 문서 우선순위

새 환경에서 읽을 순서:

1. **`docs/HANDOFF_v5.40.md`** — 현재 상태, v5.41 변경 기록, 미완료 작업 (가장 중요)
2. **`docs/CONTINUE_ON_OTHER_COMPUTER.md`** — 이 문서 (환경 setup)
3. (필요 시) `docs/HANDOFF_v5.34.md` — 이전 단계 참조
4. (선택) `Dashboard_Pitching_Team/skills/sangdong-dashboard/SKILL.md` — 작업 표준 패턴

---

## H. 최소 동작 검증 체크리스트

다른 컴퓨터 setup 완료 후 동작 검증:

- [ ] `git status` → working tree clean
- [ ] `python3 scripts/recompute_test_player_v541.py` → 10/10 trial 처리 완료
- [ ] `node scripts/build_dashboard.js` → dashboard.html 갱신
- [ ] 브라우저에서 dashboard.html 열기 → Tab 1·2·4·5 정상 표시
- [ ] Claude 새 대화에서 HANDOFF 읽기 + 첫 인사 정상

---

**문의**: kklee@kookmin.ac.kr
**저장소**: https://github.com/kkl0511/Dashboard_Pitching_Team
**버전**: v5.41 · 2026-05-11
