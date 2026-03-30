# Lightsee Cloud Share & CLI Design Spec

## Overview

Lightsee 데스크톱 앱에 클라우드 공유(Vercel + Supabase)와 CLI 기능을 추가한다.

- **Cloud Share**: 로컬 md 파일/폴더를 Supabase에 수동 push하여 Vercel URL로 공개
- **CLI**: Tauri CLI plugin으로 데스크톱 앱에 포함. AI 에이전트(Claude 등)가 프로그래매틱하게 expose/URL 수신 가능

## Architecture: Supabase 중심

Supabase가 스토리지 + DB + 인증을 담당. Vercel은 순수 읽기 전용 뷰어.

```
┌─────────────────────┐         ┌──────────────────────────┐
│  Desktop App (Tauri) │         │  Vercel (Next.js)        │
│                      │         │                          │
│  React UI            │         │  /s/{slug}  → SSR 뷰어   │
│  SharePanel (Cloud)  │────────▶│  /s/{slug}/{path}        │
│  CLI (tauri-plugin)  │  push   │                          │
│                      │         │  Marked + DOMPurify      │
│  Tauri Store         │         │  테마 CSS                 │
│  (api_key, shares)   │         │  HTML 내보내기             │
└──────┬───────────────┘         └────────┬─────────────────┘
       │                                  │
       │  Supabase REST API               │ fetch
       │                                  │
       ▼                                  ▼
┌─────────────────────────────────────────────┐
│  Supabase                                    │
│                                              │
│  Edge Function: issue-api-key                │
│                                              │
│  DB:                                         │
│    api_keys  ─┐                              │
│    shares    ─┤  RLS: api_key 기반 write     │
│    share_files┘  public read                 │
│                                              │
│  Storage: lightsee-files (public read)       │
└──────────────────────────────────────────────┘
```

## Data Model (Supabase)

### Storage

```
lightsee-files/
  └── {api_key_id}/
      └── {share_id}/
          ├── README.md
          ├── guide/
          │   ├── setup.md
          │   └── advanced.md
          └── notes.md
```

- Bucket: `lightsee-files` (public read)
- 경로에 api_key_id 포함으로 키별 격리
- 원본 폴더 구조 그대로 유지

### DB Tables

**`api_keys`**

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | |
| key_hash | text (unique) | API key의 SHA-256 해시 |
| created_at | timestamptz | 생성일 |

원본 키는 저장하지 않음. 해시만 보관. 키는 최초 발급 시 클라이언트에만 저장.

**`shares`**

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | |
| api_key_id | uuid (FK → api_keys.id) | 소유자 |
| slug | text (unique) | URL 경로 (예: `abc123`) |
| title | text | 공유 제목 |
| type | text | `file` 또는 `folder` |
| theme | text | expose 시점의 테마명 |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**`share_files`**

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | |
| share_id | uuid (FK → shares.id) | |
| path | text | 상대 경로 (예: `guide/setup.md`) |
| storage_path | text | Storage 내 전체 경로 |
| size_bytes | int | 파일 크기 |
| created_at | timestamptz | |

## API Key Lifecycle

```
앱 첫 실행 / CLI 첫 사용
  → Tauri store에서 api_key 확인
  → 없으면 → Supabase Edge Function `issue-api-key` 호출
  → 발급받은 키를 Tauri store에 영구 저장
  → 이후 모든 요청에 이 키 사용
```

Edge Function `issue-api-key`:
- POST 요청 시 새 API key(uuid v4) 생성
- SHA-256 해시를 `api_keys` 테이블에 저장
- 원본 키를 응답으로 반환

## Upload Flow

### Single File

```
사용자가 파일 선택 → "Cloud Share" (또는 CLI: lightsee expose ./README.md)
  1. shares 테이블에 레코드 생성 (type: "file", theme: 현재 테마)
  2. md 파일을 Storage에 업로드
  3. share_files에 레코드 추가
  4. 반환: https://lightsee.vercel.app/s/{slug}
```

### Folder

```
사용자가 폴더 선택 (또는 CLI: lightsee expose ./docs)
  1. 로컬에서 md 파일 재귀 탐색
  2. shares 테이블에 레코드 생성 (type: "folder", title: 폴더명)
  3. 모든 md 파일을 Storage에 병렬 업로드
  4. share_files에 각 파일 레코드 벌크 insert
  5. 반환: https://lightsee.vercel.app/s/{slug}
```

### Re-push (Update)

같은 로컬 경로를 다시 expose하면:
- 기존 share의 slug 유지 (URL 불변)
- Storage의 파일을 덮어쓰기
- share_files 테이블 동기화 (추가/삭제/갱신)
- `updated_at` 갱신

판단 기준: 같은 api_key + 같은 로컬 경로 → 기존 share 업데이트.

## CLI Interface

Tauri CLI plugin (`tauri-plugin-cli`)으로 데스크톱 앱 바이너리에 포함.

```bash
# 폴더 expose
lightsee expose ./docs
# → Uploaded 12 files. Share URL: https://lightsee.vercel.app/s/abc123

# 단일 파일 expose
lightsee expose ./README.md
# → Share URL: https://lightsee.vercel.app/s/def456

# 공유 목록
lightsee list
# → abc123  folder  ./docs        2026-03-30
# → def456  file    ./README.md   2026-03-30

# 공유 삭제
lightsee remove abc123

# 공유 업데이트 (재 push — 같은 경로면 자동 감지)
lightsee expose ./docs
# → Updated existing share. URL: https://lightsee.vercel.app/s/abc123
```

## Web Viewer (Vercel / Next.js)

### URL Structure

```
lightsee.vercel.app/s/{slug}              → 단일 파일 뷰 또는 폴더 인덱스
lightsee.vercel.app/s/{slug}/{file_path}  → 폴더 내 특정 파일 뷰
```

### Folder View Layout

```
┌─────────────────────────────────────────┐
│  📁 docs                    [HTML 내보내기] │
├──────────┬──────────────────────────────┤
│ 디렉토리  │                              │
│ 트리      │   마크다운 렌더링 영역         │
│           │                              │
│ ▼ docs    │   # Setup Guide              │
│   README  │                              │
│   ▼ guide │   Getting started with...    │
│     setup │                              │
│     adv.  │                  ┌─────────┐ │
│           │                  │  TOC     │ │
│           │                  │ - Intro  │ │
│           │                  │ - Step 1 │ │
│           │                  └─────────┘ │
└──────────┴──────────────────────────────┘
```

- 왼쪽: 디렉토리 트리 (폴더 공유 시에만)
- 가운데: 마크다운 렌더링 (expose 시점 테마 적용)
- 오른쪽: TOC (floating, 데스크톱에서만 표시)
- 단일 파일: 트리 없이 콘텐츠 + TOC만

### Single File View Layout

```
┌─────────────────────────────────────────┐
│  📄 README.md               [HTML 내보내기] │
├─────────────────────────────────────────┤
│                                         │
│   마크다운 렌더링 영역        ┌─────────┐ │
│                              │  TOC     │ │
│   # Project Title            │ - Intro  │ │
│                              │ - Usage  │ │
│   This project is...         └─────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

### Tech Stack

- **Next.js** (App Router) — SSR로 SEO/OG 메타 지원
- **Marked + DOMPurify** — 데스크톱 앱과 동일한 렌더링 라이브러리
- **테마 CSS** — 데스크톱 앱의 App.css에서 테마 스타일 추출하여 공유

### HTML Export

- "HTML 내보내기" 버튼 → self-contained HTML 다운로드
- 테마 CSS + 렌더링된 HTML + 폰트를 인라인 번들
- 폴더 공유: 현재 선택된 파일 1개를 HTML로 내보내기

## Desktop App UI Integration

### Cloud Share Entry Points

기존 LAN 공유 옆에 Cloud 공유 추가:

```
Share ▸ LAN Share (기존)
       ▸ Cloud Share → 클라우드 업로드 후 URL 표시
```

### Cloud Share Panel

```
┌──────────────────────────┐
│ ☁ Cloud Share             │
│                          │
│ URL: lightsee.vercel.app │
│      /s/abc123     [복사] │
│                          │
│ Status: Uploaded ✓       │
│ Files: 12                │
│ Last updated: 방금 전     │
│                          │
│ [Update]    [Remove]     │
└──────────────────────────┘
```

### Left Sidebar — Favorites Integration

즐겨찾기 폴더에 cloud expose 상태 표시:

```
★ Favorites
  📁 docs  ☁ ← 클라우드 공유 중
  📁 notes
```

폴더 우클릭 시 "Expose to Cloud" 옵션 추가.

### Settings (Tauri Store Extension)

기존 settings에 추가:

```json
{
  "api_key": "string",
  "cloud_shares": [
    { "local_path": "string", "share_id": "uuid", "slug": "string", "type": "file|folder" }
  ]
}
```

## Security

- **Storage**: public read, write는 API key 검증 후만 허용
- **DB RLS**: 읽기 전체 공개, 쓰기/삭제는 본인 api_key_id만
- **API Key**: 해시만 DB 저장. 원본은 클라이언트에만 존재
- **콘텐츠 새니타이징**: 웹 뷰어에서 DOMPurify로 렌더링 시 새니타이징
- **업로드 검증**: md 파일만 허용 (확장자 + MIME 체크)

## Rate Limits & Quotas

| Item | Limit |
|------|-------|
| 파일당 크기 | 5MB |
| 폴더당 파일 수 | 200개 |
| 키당 총 공유 수 | 5,000개 |
| Rate limit | 분당 300 요청 |

악용 감지 시 Supabase RLS + Edge Function에서 차단.

## Error Handling

- **네트워크 실패**: 업로드 중 실패 시 부분 업로드 정리 (share 레코드 삭제)
- **용량 초과**: 사전 체크 후 명확한 에러 메시지
- **키 분실**: 새 키 발급 가능 (기존 공유는 접근 불가 — 이전 공유와 분리됨)
