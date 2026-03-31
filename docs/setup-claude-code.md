# Claude Code에서 Lightsee 사용하기

Claude Code(터미널 CLI)에서 "이 마크다운 보여줘", "이 폴더 클라우드에 공유해줘" 같은 명령을 쓸 수 있도록 설정하는 방법입니다.

---

## Skill이란?

Skill은 Claude Code가 특정 도구를 사용하는 방법을 알려주는 설정 파일입니다.
한번 등록하면 대화 중에 자연스럽게 활용됩니다.

---

## 설정 방법

### 1단계: 터미널을 열고 아래 두 줄을 복사해서 붙여넣기합니다

```bash
mkdir -p ~/.claude/skills/lightsee
```

### 2단계: 아래 전체를 한번에 복사해서 붙여넣기합니다

```bash
cat > ~/.claude/skills/lightsee/SKILL.md << 'SKILLEOF'
---
name: lightsee
description: Use when the user wants to preview, view, or open a markdown file (.md) in the Lightsee desktop app. Triggers on "preview this", "open in lightsee", "show me this markdown", or viewing .md files visually.
---

# Lightsee - Markdown Viewer

Open markdown files in the Lightsee desktop app or share them to the cloud.

## 마크다운 파일 열기

```bash
open -a Lightsee <파일경로>
```

## 클라우드 공유 (Cloud Share)

```bash
# 파일 공유
/Applications/Lightsee.app/Contents/MacOS/lightsee expose <파일경로>

# 폴더 공유
/Applications/Lightsee.app/Contents/MacOS/lightsee expose <폴더경로>

# 공유 목록 확인
/Applications/Lightsee.app/Contents/MacOS/lightsee list

# 공유 삭제
/Applications/Lightsee.app/Contents/MacOS/lightsee remove <공유ID>
```

## When to Use

- User asks to preview/view a markdown file visually
- User says "open in lightsee" or "show me this markdown"
- User wants to share markdown files to the cloud
- User says "이거 공유해줘", "클라우드에 올려줘", "expose this folder"

## Notes

- Lightsee must be installed in /Applications
- Supports .md, .markdown, .mdown, .mkd, .mdwn extensions
- Cloud share URLs are public and permanent until deleted
SKILLEOF
```

### 3단계: Claude Code 새 대화 시작

Claude Code를 새로 시작하거나, 이미 열려 있다면 새 대화를 시작합니다.

---

## 사용 예시

Claude Code에서 아래처럼 말해보세요:

- "README.md를 lightsee로 보여줘"
- "docs 폴더를 클라우드에 공유해줘"
- "현재 프로젝트의 마크다운 파일들 공유해줘"

---

## 선택: 터미널 단축 명령어 설정

매번 긴 경로를 입력하지 않도록 단축 명령어를 설정할 수 있습니다.

```bash
sudo ln -s /Applications/Lightsee.app/Contents/MacOS/lightsee /usr/local/bin/lightsee
```

비밀번호를 입력하면 완료됩니다.

---

## 문제 해결

**Skill이 작동하지 않아요**
- Claude Code를 완전히 종료하고 다시 시작하세요.
- `cat ~/.claude/skills/lightsee/SKILL.md` 로 파일이 잘 만들어졌는지 확인하세요.

**~/.claude 폴더가 보이지 않아요**
- 숨겨진 폴더입니다. Finder에서 `Cmd + Shift + .` 을 누르면 보입니다.

**Skill을 삭제하고 싶어요**
```bash
rm -rf ~/.claude/skills/lightsee
```
