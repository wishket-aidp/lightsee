# Lightsee Sidebars Design Spec

## Overview

Lightsee에 좌측/우측 사이드바를 추가하여 파일 탐색과 문서 네비게이션을 개선한다.

- **좌측 사이드바**: 최근 파일 목록 + 즐겨찾기 폴더의 마크다운 파일 트리 탐색
- **우측 사이드바**: 현재 문서의 헤딩 기반 TOC (Table of Contents) + 스크롤 연동

## 레이아웃

```
┌─────────────────────────────────────┐
│              Toolbar                │
├─────────────────────────────────────┤
│              Tab Bar                │
├────────┬──────────────────┬─────────┤
│ Left   │                  │ Right   │
│ Sidebar│     Content      │ Sidebar │
│ 240px  │     flex: 1      │ 220px   │
├────────┴──────────────────┴─────────┤
```

- Toolbar와 Tab Bar는 전체 너비 유지
- 그 아래 3-column flex 레이아웃: left-sidebar | content | right-sidebar
- 각 사이드바는 기본 열려있고, toolbar의 토글 버튼으로 숨길 수 있음
- 사이드바 경계에 드래그 리사이저 (4px 핸들, 호버 시 col-resize 커서)

### 사이드바 크기

| 사이드바 | 기본 폭 | 최소 | 최대 |
|---------|--------|------|------|
| 좌측 | 240px | 160px | 400px |
| 우측 | 220px | 140px | 360px |

사용자가 조정한 폭은 settings.json에 영속화.

## 좌측 사이드바 (LeftSidebar)

### Recent Files (상단 섹션)

- 기존 empty state에 있던 최근 파일 목록을 사이드바로 이동
- 최대 10개 표시
- 파일명 표시 + 호버 시 전체 경로 tooltip
- 클릭 → 해당 파일을 탭으로 열기
- 항목에 x 버튼으로 목록에서 제거 가능
- settings.json에 영속화 (기존 동작 유지)

### Favorite Folders (하단 섹션)

- "폴더 추가" 버튼 → OS 폴더 선택 다이얼로그 (tauri-plugin-dialog)
- 등록된 폴더별로 접을 수 있는 트리 표시
- 재귀 탐색: 하위 폴더는 들여쓰기 + 펼침/접기 (▶/▼)
- 마크다운 파일만 표시 (.md, .markdown, .mdown, .mkd, .mdwn)
- 파일 클릭 → 탭으로 열기
- 폴더 항목에 x 버튼으로 즐겨찾기 해제
- 즐겨찾기 폴더 경로 목록은 settings.json에 영속화

### Rust 백엔드: list_markdown_files

```rust
#[tauri::command]
fn list_markdown_files(path: String) -> Result<Vec<FileEntry>, String>
```

- `FileEntry`: `{ name: String, path: String, is_dir: bool, children: Vec<FileEntry> }`
- 지정된 폴더를 재귀 탐색하여 마크다운 파일과 마크다운 파일을 포함하는 디렉토리만 트리 구조로 반환
- 빈 디렉토리(마크다운 파일이 없는)는 결과에서 제외
- 파일/폴더명 기준 알파벳 정렬, 폴더 우선

## 우측 사이드바 (RightSidebar — TOC)

### 헤딩 추출

- `loadContent`에서 HTML 생성 시 각 헤딩(`<h1>`~`<h6>`)에 id 속성 부여
- Slug 생성 규칙: 텍스트를 lowercase → 공백을 하이픈으로 → 특수문자 제거
- 동일 slug가 있으면 `-1`, `-2` 등 suffix 추가
- 파싱된 헤딩 배열 `{ id: string, text: string, level: number }[]`를 Tab 인터페이스에 추가

### TOC UI

- 헤딩 텍스트 목록, 레벨에 따라 padding-left로 계층 표현
- 문서에 존재하는 최소 헤딩 레벨을 기준으로 상대적 들여쓰기 (예: h2가 최소면 h2=0단계, h3=1단계)
- 클릭 → 해당 헤딩으로 content 영역 smooth scroll (`element.scrollIntoView({ behavior: 'smooth' })`)

### 현재 위치 하이라이트

- Content 영역의 스크롤을 `IntersectionObserver`로 감시
- 현재 뷰포트에 보이는 섹션의 헤딩을 TOC에서 활성 표시 (테마의 link 색상 사용)

### 탭 전환 시 동작

- 활성 탭이 바뀌면 TOC가 해당 문서의 헤딩으로 갱신
- 문서가 없으면 (empty state) TOC 비어있음

## 파일 구조

```
src/
  App.tsx              ← 레이아웃 오케스트레이션, 상태 관리
  App.css              ← 기존 스타일 + 사이드바/리사이저 스타일
  LeftSidebar.tsx      ← 최근 파일 + 즐겨찾기 폴더 트리
  RightSidebar.tsx     ← TOC (헤딩 목록 + 스크롤 연동)
src-tauri/
  src/lib.rs           ← list_markdown_files 커맨드 추가
```

## 상태 관리

모든 상태는 App.tsx에서 관리하고 props로 자식 컴포넌트에 전달.

| 상태 | 타입 | 영속화 | 설명 |
|------|------|--------|------|
| `leftSidebarOpen` | boolean | O | 좌측 사이드바 열림/닫힘 |
| `rightSidebarOpen` | boolean | O | 우측 사이드바 열림/닫힘 |
| `leftSidebarWidth` | number | O | 좌측 사이드바 폭 (px) |
| `rightSidebarWidth` | number | O | 우측 사이드바 폭 (px) |
| `favoriteFolders` | string[] | O | 즐겨찾기 폴더 경로 목록 |
| `recentFiles` | string[] | O | 최근 파일 경로 목록 (기존) |

## 데이터 흐름

```
App (상태 보유)
 ├─ LeftSidebar
 │   ├─ props: recentFiles, favoriteFolders, theme, onOpenFile, onAddFolder, onRemoveFolder, onRemoveRecent
 │   └─ 내부: invoke("list_markdown_files")로 트리 데이터 fetch → 로컬 state로 관리
 │
 ├─ Content (기존 markdown-body)
 │   └─ ref 전달 → RightSidebar가 스크롤 감시에 사용
 │
 └─ RightSidebar
     ├─ props: headings (activeTab.headings), theme, contentRef
     └─ 내부: IntersectionObserver로 활성 헤딩 추적
```

## 영속화 (settings.json)

기존 저장 항목에 추가:

```json
{
  "theme": "dark",
  "fontSize": 16,
  "windowSize": { "width": 900, "height": 700 },
  "recentFiles": [],
  "leftSidebarOpen": true,
  "rightSidebarOpen": true,
  "leftSidebarWidth": 240,
  "rightSidebarWidth": 220,
  "favoriteFolders": []
}
```

## Tauri Capability 변경

`src-tauri/capabilities/default.json`에 디렉토리 읽기 권한이 필요할 수 있음. 현재 `fs:read-all`이 설정되어 있으므로 추가 변경 불필요.

## 스타일링 원칙

- 모든 색상은 기존 테마 시스템의 CSS 변수 및 theme 객체 활용
- 사이드바 배경: `currentTheme.codeBg` (content와 구분)
- 사이드바 텍스트: `currentTheme.text`
- 활성 항목 / 링크: `currentTheme.link`
- 경계선: `currentTheme.border`
- 사이드바 열림/닫힘 애니메이션: CSS transition (width 0.2s)
