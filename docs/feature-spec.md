# Lightsee 기능 명세서

버전: 0.8.0

---

## 1. 데스크톱 앱 — UI

### 1.1 툴바

| 기능 | 설명 |
|------|------|
| Open File | 파일 선택 대화상자 열기 (.md, .markdown, .txt) |
| 좌측 사이드바 토글 | 좌측 패널 표시/숨김 |
| 우측 사이드바 토글 | 우측 패널 표시/숨김 |
| 폰트 크기 조절 | A- / A+ 버튼, 현재 크기 표시 (범위 10~32px) |
| Cloud | Cloud Shares 관리 패널 토글 |
| Theme | 테마 선택 패널 토글 |
| Update 알림 | 새 버전 감지 시 업데이트 버튼 표시, 클릭 시 다운로드+재시작 |

### 1.2 탭

| 기능 | 설명 |
|------|------|
| 다중 탭 | 여러 파일을 탭으로 동시 열기 |
| 탭 전환 | 탭 클릭으로 전환 |
| 탭 닫기 | x 버튼으로 닫기 |
| 활성 탭 표시 | 하단 보더 색상으로 활성 탭 구분 |
| 스마트 닫기 | 활성 탭 닫을 시 인접 탭으로 자동 전환 |

### 1.3 테마 (17개)

Light, Dark, Sepia, Nord, Solarized, Dracula, GitHub, Monokai, Catppuccin Mocha/Macchiato/Frappe/Latte, Deep Ocean, Nature Green, Dark Fuchsia, Midnight Blue, Monocai

각 테마는 8가지 색상 변수 정의: bg, text, heading, link, codeBg, border, blockquoteBorder, blockquoteText

### 1.4 키보드 단축키

| 단축키 | 기능 |
|--------|------|
| Cmd/Ctrl+T | 파일 열기 |
| Cmd/Ctrl+W | 현재 탭 닫기 |
| Cmd/Ctrl+= / + | 폰트 크기 증가 (+2px) |
| Cmd/Ctrl+- | 폰트 크기 감소 (-2px) |
| Cmd/Ctrl+0 | 폰트 크기 초기화 (16px) |

### 1.5 파일 열기 방법

- 파일 선택 대화상자 (Open File 버튼)
- 드래그 앤 드롭
- 파일 연결 (더블클릭: .md, .markdown, .mdown, .mkd, .mdwn)
- CLI 인자: `lightsee <파일경로>`
- macOS Finder 컨텍스트 메뉴

### 1.6 마크다운 렌더링

| 요소 | 처리 |
|------|------|
| 헤딩 (h1-h6) | 자동 ID 생성, 테마 색상 적용, h1/h2 하단 보더 |
| 코드 | 인라인: 배경 하이라이트 / 블록: 스크롤 가능, D2Coding 폰트 |
| 테이블 | 가로 스크롤 래퍼, 줄무늬 없음, 보더 스타일링 |
| 링크 | 테마 링크 색상, 호버 시 밑줄 |
| 인용문 | 좌측 4px 보더, 테마 인용 색상 |
| 이미지 | max-width 100%, 8px 보더 라디우스 |
| 수평선 | 1px 보더, 상하 2em 마진 |
| 리스트 | 2em 좌측 패딩, 0.3em 하단 마진 |
| XSS 방지 | DOMPurify로 렌더링 전 새니타이징 |

---

## 2. 좌측 사이드바

### 2.1 최근 파일

- 최대 10개 파일 기록
- 클릭으로 파일 재열기
- 호버 시 삭제(x) 버튼 표시
- 파일명만 표시 (전체 경로는 title로 표시)

### 2.2 즐겨찾기 폴더

| 기능 | 설명 |
|------|------|
| 폴더 추가 | "+ Add Folder" 버튼, 디렉토리 선택 대화상자 |
| 파일 트리 | 재귀적 마크다운 파일 탐색, 숨김 파일 제외 |
| 폴더 접기/펼치기 | 화살표 클릭으로 토글 |
| 새로고침 (↻) | 파일 목록 다시 불러오기 |
| 폴더 삭제 (x) | 즐겨찾기에서 제거 |
| 정렬 | 폴더 먼저 (가나다순), 파일 (가나다순, 대소문자 무시) |

### 2.3 사이드바 크기 조절

- 좌측: 160~400px
- 우측: 140~360px
- 드래그로 실시간 조절

---

## 3. 우측 사이드바 — 목차 (TOC)

| 기능 | 설명 |
|------|------|
| 자동 생성 | 문서 내 헤딩에서 목차 자동 추출 |
| 클릭 이동 | 헤딩 클릭 시 해당 위치로 스크롤 |
| 활성 추적 | IntersectionObserver로 현재 보이는 헤딩 하이라이트 |
| 계층 표시 | 헤딩 레벨에 따른 들여쓰기 (14px/레벨) |
| 빈 상태 | 헤딩 없을 시 "No headings" 표시 |

---

## 4. Cloud Shares 관리 패널

### 4.1 공유 목록

| 기능 | 설명 |
|------|------|
| 목록 조회 | 앱에서 생성한 모든 클라우드 공유 표시 |
| 표시 정보 | 제목, 유형(file/folder), 로컬 경로, URL, 갱신일, 액션 |
| URL 복사 | 클릭 시 클립보드 복사, "Copied!" 피드백 (2초) |
| 삭제 | Storage 파일 + DB 레코드 + 로컬 레코드 일괄 삭제 |
| 새로고침 | Supabase에서 최신 목록 다시 가져오기 |
| 자동 갱신 | expose/delete 후 목록 자동 새로고침 |

### 4.2 현재 파일 공유

| 기능 | 설명 |
|------|------|
| Share Current File | 현재 열린 파일을 클라우드에 업로드 |
| 업로드 상태 | "Uploading..." 표시 |
| 비활성 조건 | 열린 파일 없을 시 버튼 비활성화 |

### 4.3 Cloud Expose 동작

| 항목 | 설명 |
|------|------|
| URL 생성 | nanoid 10자리 slug → `https://lightsee.vercel.app/s/{slug}` |
| 재업로드 | 같은 경로 재 expose 시 기존 URL 유지, 콘텐츠만 갱신 |
| 파일 제한 | 폴더당 최대 200개 파일 |
| 크기 제한 | 파일당 최대 5MB |
| 테마 적용 | expose 시점의 현재 테마를 웹 뷰어에 적용 |

### 4.4 인증

| 항목 | 설명 |
|------|------|
| API Key | 최초 사용 시 자동 생성 (Supabase Edge Function) |
| 저장 | settings.json에 영구 보관 |
| 보안 | DB에는 SHA-256 해시만 저장, 원본은 클라이언트만 보유 |

---

## 5. CLI

### 5.1 명령어

```
lightsee expose <경로>    # 파일/폴더를 클라우드에 공유
lightsee list             # 공유 목록 조회
lightsee remove <slug>    # 공유 삭제
```

### 5.2 동작

| 명령 | 출력 | 종료 코드 |
|------|------|-----------|
| expose | `Uploaded N file(s). Share URL: {url}` | 0 (성공) / 1 (실패) |
| list | 탭 구분 목록 (slug, type, path, updated_at) 또는 "No cloud shares." | 0 / 1 |
| remove | "Share removed." | 0 / 1 |

- CLI 실행 시 GUI 창 없이 동작 (block_on 후 process::exit)
- expose 기본 테마: "light"

---

## 6. 웹 뷰어 (lightsee.vercel.app)

### 6.1 URL 구조

```
/s/{slug}               → 단일 파일 또는 폴더 첫 파일
/s/{slug}/{file_path}   → 폴더 내 특정 파일
```

### 6.2 레이아웃

| 영역 | 설명 |
|------|------|
| 헤더 | 공유 제목 + 아이콘 + HTML Export 버튼 |
| 디렉토리 트리 | 폴더 공유 시 좌측 220px 사이드바, 파일 탐색 |
| 콘텐츠 | 마크다운 렌더링 (max-width 900px, 중앙 정렬) |
| 목차 | 우측 220px, 스티키 포지션, 헤딩 링크 |

### 6.3 기능

| 기능 | 설명 |
|------|------|
| SSR | Next.js 서버 사이드 렌더링 (SEO 가능) |
| 테마 | expose 시점의 테마 자동 적용 |
| 디렉토리 탐색 | 클릭으로 파일 간 이동, 현재 파일 하이라이트 |
| HTML 내보내기 | 현재 파일을 self-contained HTML로 다운로드 |
| 404 처리 | 존재하지 않는 slug 또는 path 시 Next.js notFound() |

---

## 7. 설정 영속화

### 7.1 저장 항목 (settings.json)

| 키 | 타입 | 기본값 |
|----|------|--------|
| theme | ThemeKey | "light" |
| fontSize | number | 16 |
| recentFiles | string[] | [] |
| leftSidebarOpen | boolean | true |
| rightSidebarOpen | boolean | true |
| leftSidebarWidth | number | 240 |
| rightSidebarWidth | number | 220 |
| favoriteFolders | string[] | [] |
| windowSize | {width, height} | {900, 700} |
| cloud_credentials | {api_key, api_key_id} | 자동 생성 |
| cloud_shares | CloudShareRecord[] | [] |

### 7.2 저장 타이밍

- 설정 변경 시 300ms 디바운스 후 저장
- 창 크기 변경 시 500ms 디바운스 후 저장
- 초기 로드 완료 전까지 저장 비활성화

---

## 8. 자동 업데이트

| 항목 | 설명 |
|------|------|
| 체크 시점 | 앱 시작 시 자동 확인 |
| 엔드포인트 | GitHub Releases (latest.json) |
| 설치 | 다운로드 + 설치 + 자동 재시작 |
| 서명 | macOS Developer ID 서명 |

---

## 9. Supabase 인프라

### 9.1 DB 테이블

| 테이블 | 용도 |
|--------|------|
| api_keys | API 키 해시 저장 (자동 발급) |
| shares | 공유 메타데이터 (slug, title, type, theme) |
| share_files | 공유 파일 목록 (path, storage_path, size) |

### 9.2 RLS 정책

- SELECT: 전체 공개 (shares, share_files)
- INSERT/UPDATE/DELETE: anon role 허용 (publishable key)
- Storage: lightsee-files 버킷, public read + anon write

### 9.3 Edge Function

- `issue-api-key`: POST → UUID 키 생성, SHA-256 해시 저장, 원본 반환
- JWT 검증 비활성화 (`--no-verify-jwt`)

---

## 10. 파일 처리

### 10.1 지원 확장자

| 확장자 | 파일 선택 | 폴더 스캔 | 파일 연결 |
|--------|-----------|-----------|-----------|
| .md | O | O | O |
| .markdown | O | O | O |
| .mdown | - | O | O |
| .mkd | - | O | O |
| .mdwn | - | O | O |
| .txt | O | - | - |

### 10.2 경로 정규화

- macOS: canonicalize 후 반환
- Windows: `\\?\` 접두사 제거
