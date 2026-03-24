# Git으로 배포하기 — 실행 순서

> 이 PC에서는 **Git이 설치되어 있지 않거나 PATH에 없을 수 있습니다.**  
> 아래 **1단계**부터 진행하세요.

---

## 1. Git 설치 (Windows)

1. https://git-scm.com/download/win 에서 **Git for Windows** 다운로드 후 설치
2. 설치 중 **“Git from the command line and also from 3rd-party software”** 선택 권장
3. 설치 후 **PowerShell 또는 터미널을 새로 연 다음** 확인:

```powershell
git --version
```

버전이 나오면 OK.

---

## 2. Git 사용자 설정 (최초 1회)

```powershell
cd d:\2026\duc-ua-app

git config --global user.name "본인이름"
git config --global user.email "회사이메일@example.com"
```

---

## 3. 저장소 만들기 & 첫 커밋

```powershell
cd d:\2026\duc-ua-app

git init
git add .
git commit -m "Initial commit: DUC UA 가설 관리 앱"
```

- `.env` 는 `.gitignore`에 포함되어 **커밋되지 않습니다.**
- 팀원은 `.env.example` 을 보고 로컬에 `.env` 를 직접 만듭니다.

---

## 4. GitHub에 올리기

### 방법 A — 웹에서 저장소 만든 뒤 연결

1. https://github.com/new 에서 **New repository** (비어 있는 저장소, README 추가 안 함)
2. 저장소 URL을 복사한 뒤 터미널에서:

```powershell
cd d:\2026\duc-ua-app

git branch -M main
git remote add origin https://github.com/본인계정/저장소이름.git
git push -u origin main
```

(처음 push 시 GitHub 로그인·토큰 입력이 필요할 수 있습니다.)

### 방법 B — GitHub Desktop

1. https://desktop.github.com/ 설치
2. **File → Add local repository** → `d:\2026\duc-ua-app` 선택
3. **Publish repository** 로 GitHub에 올리기

---

## 5. Netlify에 Git 연동 (URL 고정 배포)

1. https://app.netlify.com 로그인
2. **Add new site → Import an existing project**
3. **GitHub** 연결 후 방금 만든 저장소 선택
4. 빌드 설정 (저장소에 `netlify.toml` 이 있으면 자동 인식될 수 있음):
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. **Site settings → Environment variables** 에 Netlify에만 다음 추가 (값은 본인 `.env` 와 동일):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_GEMINI_API_KEY` (사용하는 경우)
6. **Deploy site** → 이후 **`git push` 할 때마다 같은 Netlify URL**로 자동 배포됩니다.

---

## 6. 이후 업데이트 방법

```powershell
cd d:\2026\duc-ua-app
git add .
git commit -m "기능 수정 설명"
git push
```

Netlify가 연결되어 있으면 push 후 1~2분 안에 사이트가 갱신됩니다.

---

## 문제 해결

| 증상 | 조치 |
|------|------|
| `git` 을 찾을 수 없음 | Git 설치 후 터미널 **완전히 종료 후 다시 실행** |
| push 거부 (인증) | GitHub **Personal Access Token** 사용 또는 GitHub Desktop 사용 |
| 배포 후 흰 화면 | Netlify에 **환경 변수** 넣었는지, **Rebuild** 했는지 확인 |
| Supabase 오류 | RLS·anon 키·URL 이 배포 환경에도 동일하게 설정되었는지 확인 |

---

**요약:** Git 설치 → `git init` → `commit` → GitHub에 `push` → Netlify에서 **같은 저장소** Import → 환경 변수 설정. 이후에는 **`git push`만 하면 같은 링크로 업데이트**됩니다.
