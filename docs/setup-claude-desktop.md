# Claude Desktop에서 Lightsee 사용하기

Claude Desktop(데스크톱 앱)에서 마크다운 파일을 열거나 클라우드에 공유할 수 있도록 설정하는 방법입니다.

Claude Desktop은 MCP(Model Context Protocol) 서버를 통해 외부 도구와 연동됩니다.

---

## MCP 서버란?

MCP 서버는 Claude Desktop이 외부 프로그램의 기능을 사용할 수 있게 해주는 연결 방식입니다.
한번 설정하면 대화 중에 "이 파일 공유해줘" 같은 요청을 처리할 수 있습니다.

---

## 설정 방법

### 1단계: 설정 파일 열기

Claude Desktop 앱에서:

1. 상단 메뉴 **Claude** > **Settings** 클릭
2. **Developer** 탭 클릭
3. **Edit Config** 버튼 클릭

텍스트 편집기가 열립니다.

### 2단계: 설정 내용 입력

열린 파일의 내용을 아래로 교체합니다.

이미 다른 MCP 서버가 등록되어 있다면, `"mcpServers"` 안에 `"lightsee"` 부분만 추가하세요.

```json
{
  "mcpServers": {
    "lightsee": {
      "command": "/Applications/Lightsee.app/Contents/MacOS/lightsee",
      "args": ["mcp-serve"]
    }
  }
}
```

> **참고**: 현재 Lightsee MCP 서버는 아직 개발 중입니다. 위 설정은 향후 업데이트에서 사용할 수 있습니다. 지금은 아래의 **대안 방법**을 사용하세요.

### 대안: Claude Code를 MCP 서버로 사용

Claude Code가 설치되어 있다면, Claude Code 자체를 MCP 서버로 등록하여 Lightsee CLI를 사용할 수 있습니다.

```json
{
  "mcpServers": {
    "claude-code": {
      "command": "claude",
      "args": ["mcp", "serve"]
    }
  }
}
```

이 방식으로 등록하면 Claude Desktop에서 Claude Code의 모든 도구(파일 읽기, 터미널 명령 실행 등)를 사용할 수 있으며, Lightsee CLI도 터미널 명령으로 실행할 수 있습니다.

### 3단계: Claude Desktop 재시작

1. 파일을 저장합니다.
2. Claude Desktop을 **완전히 종료**합니다. (Dock 아이콘 우클릭 > 종료)
3. 다시 실행합니다.

### 4단계: 확인

새 대화를 시작하고, 입력창 아래의 **망치 아이콘**을 클릭합니다.
등록된 도구 목록이 표시되면 설정이 완료된 것입니다.

---

## 사용 예시

Claude Desktop에서 아래처럼 말해보세요:

- "README.md 파일을 lightsee로 열어줘"
- "docs 폴더를 클라우드에 공유해줘"
- "lightsee list 실행해서 공유 목록 보여줘"

---

## 사전 준비

- **Lightsee 앱**이 `/Applications` 에 설치되어 있어야 합니다.
- **대안 방법** 사용 시: Claude Code(터미널 CLI)가 설치되어 있어야 합니다.

---

## 문제 해결

**망치 아이콘이 보이지 않아요**
- Claude Desktop을 완전히 종료하고 다시 시작하세요.
- 설정 파일의 JSON 형식이 올바른지 확인하세요. (쉼표, 중괄호 등)

**도구가 작동하지 않아요**
- `/Applications/Lightsee.app` 이 설치되어 있는지 확인하세요.
- 터미널에서 아래 명령어가 작동하는지 확인하세요:
  ```bash
  /Applications/Lightsee.app/Contents/MacOS/lightsee list
  ```

**설정 파일 위치를 모르겠어요**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- 또는 Claude Desktop > Settings > Developer > Edit Config
