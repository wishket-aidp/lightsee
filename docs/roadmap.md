# Lightsee 로드맵

v0.8.0 기준, 코드베이스 분석 결과 도출된 향후 개선 항목.

---

## P0 — 보안 및 데이터 정합성

### 1. RLS 정책 강화 (공유 소유권 검증)

**현재**: `shares`, `share_files` 테이블에 INSERT/UPDATE/DELETE가 모든 anonymous 사용자에게 열려있음.
**위험**: 다른 사용자의 공유를 수정/삭제할 수 있음.
**해결**: api_key_id 기반 소유권 검증. Supabase Edge Function을 통한 쓰기 요청 프록시 또는 RLS에서 커스텀 헤더 검증.

- `supabase/migrations/002_rls_write_policies.sql` 수정
- `src-tauri/src/cloud.rs` — 쓰기 요청에 인증 헤더 추가

### 2. 업로드 실패 시 롤백

**현재**: 다중 파일 업로드 중 실패 시 이미 업로드된 파일이 Storage에 남음.
**해결**: 업로드 실패 시 해당 share의 모든 Storage 파일 + DB 레코드 정리.

- `src-tauri/src/cloud.rs` — `cloud_expose_inner` 함수에 에러 시 cleanup 로직 추가

### 3. Storage 삭제 실패 처리

**현재**: `cloud_remove`에서 Storage 파일 삭제 실패가 무시됨 (`let _ =`).
**해결**: 실패한 파일 목록을 로깅하고, 재시도 또는 사용자에게 알림.

### 4. API Key 로컬 저장 보안

**현재**: settings.json에 평문 저장.
**해결**: macOS Keychain / Windows Credential Store 활용, 또는 암호화 저장.

- `tauri-plugin-keychain` 또는 OS keyring 연동 검토

---

## P1 — 주요 기능 개선

### 5. CLI `--theme` 플래그 추가

**현재**: expose 시 항상 "light" 테마 고정.
**해결**: `--theme <name>` 선택 플래그 추가.

- `src-tauri/tauri.conf.json` — expose 서브커맨드에 theme arg 추가
- `src-tauri/src/lib.rs` — CLI 디스패치에서 theme 파싱

### 6. 업로드 진행률 표시

**현재**: "Uploading..." 텍스트만 표시.
**해결**: 파일 단위 진행률 (예: "3/12 files uploaded").

- `src-tauri/src/cloud.rs` — 업로드 진행 이벤트 emit
- `src/CloudSharePanel.tsx` — 진행률 바 또는 카운터 UI

### 7. 문서 내 검색 (Cmd/Ctrl+F)

**현재**: 브라우저 기본 검색만 가능.
**해결**: 앱 내 검색 바 + 하이라이트 기능.

- `src/App.tsx` — 검색 상태 + UI
- `src/App.css` — 하이라이트 스타일

### 8. 인쇄 지원 (Cmd/Ctrl+P)

**현재**: 인쇄 기능 없음.
**해결**: print-friendly CSS + 키보드 단축키.

### 9. 폴더 파일 트리 필터/검색

**현재**: 즐겨찾기 폴더에서 수동으로 트리를 탐색해야 함.
**해결**: 사이드바 상단에 검색 입력란, 실시간 필터링.

### 10. TOC 접기/펼치기

**현재**: 모든 헤딩이 플랫하게 나열됨.
**해결**: 헤딩 레벨별 접기/펼치기 토글.

### 11. 데스크톱 앱 HTML 내보내기

**현재**: 웹 뷰어에서만 HTML 내보내기 가능.
**해결**: 데스크톱 앱 툴바에 Export 버튼 추가.

---

## P2 — UX 및 인프라 개선

### 12. 웹 뷰어 — 코드 블록 복사 버튼

각 코드 블록 우측 상단에 "Copy" 버튼 추가.

### 13. 웹 뷰어 — 테마 전환 토글

공유 시점의 테마가 고정되어 있지만, 뷰어에서 다크/라이트 전환 가능하게.

### 14. Rate Limiting

API key 단위 요청 제한. Supabase Edge Function 또는 미들웨어에서 처리.

- 분당 300 요청 제한 (설계 명세 기준)

### 15. DB 스키마 강화

- `shares.title`, `shares.theme`: NOT NULL 제약 추가
- `shares.type`: CHECK 제약 강화
- `share_files.path`: UNIQUE(share_id, path) 복합 유니크 제약

### 16. 폴더 트리 로딩 스피너

즐겨찾기 폴더 로딩 시 시각적 피드백.

### 17. 데스크톱 React 컴포넌트 테스트

CloudSharePanel, LeftSidebar, RightSidebar에 대한 Vitest 테스트 추가.

### 18. CI/CD — PR 테스트 파이프라인

`.github/workflows`에 main/PR 브랜치 대상 테스트 + 린트 + 타입체크 워크플로우 추가.

### 19. Storage Vacuum 명령

CLI에 `lightsee vacuum` 추가 — 고아 Storage 파일 정리.

---

## P3 — 장기 비전

### 20. 공유 만료 및 접근 제어

- 선택적 만료일 설정
- 비밀번호 보호
- 조회수 추적

### 21. Mermaid / LaTeX 렌더링

마크다운 내 다이어그램(Mermaid, D2) 및 수학 수식(KaTeX/MathJax) 지원.

### 22. PDF 내보내기

데스크톱 앱에서 마크다운 → PDF 변환.

### 23. 버전 히스토리

공유 콘텐츠의 이전 버전 보관 및 되돌리기.

### 24. 코멘트 / 어노테이션

공유 문서의 특정 구간에 코멘트 스레드 추가.

### 25. MCP 서버 통합

Lightsee를 MCP 서버로 노출하여 Claude Desktop에서 직접 expose/list/remove 호출 가능.

- `lightsee mcp-serve` 명령 추가
- stdio JSON-RPC 프로토콜 구현

### 26. 커스텀 도메인

`viewer.ai-delivery.work` 대신 사용자 지정 도메인으로 공유.

---

## Quick Wins (낮은 난이도, 높은 임팩트)

| 항목 | 우선순위 | 난이도 |
|------|----------|--------|
| CLI --theme 플래그 | P1 | 낮음 |
| 코드 블록 복사 버튼 | P2 | 낮음 |
| 웹 뷰어 테마 토글 | P2 | 낮음 |
| DB NOT NULL 제약 | P2 | 낮음 |
| 인쇄 지원 | P1 | 낮음 |
| 폴더 로딩 스피너 | P2 | 낮음 |
| 데스크톱 HTML 내보내기 | P1 | 낮음 |
