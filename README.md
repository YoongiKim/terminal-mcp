# terminal-mcp

AI 코드 에디터(RooCode, Claude Desktop 등)에서 터미널 프로세스를 제어하는 MCP 서버입니다.

`flutter run` 같은 장기실행 프로세스를 시작하고, `r` 키로 hot-reload를 트리거하고, 오류 메시지를 증분으로 읽을 수 있습니다.

## 기능

| Tool | 설명 |
|------|------|
| `start_process` | 새 터미널 프로세스 시작 (PTY) |
| `send_input` | 텍스트/키 입력 전송 (`r`, `R`, `q`, `\u0003` 등) |
| `read_output` | 새 출력 읽기 (증분 읽기 지원) |
| `list_sessions` | 전체 세션 목록 |
| `get_session_info` | 특정 세션 상세 정보 |
| `stop_process` | 프로세스 종료 |

## 설치

```bash
git clone https://github.com/yourname/terminal-mcp
cd terminal-mcp
npm install
npm run build
```

## RooCode 설정

`.roo/mcp.json` (또는 RooCode 설정의 MCP 섹션)에 추가:

```json
{
  "mcpServers": {
    "terminal": {
      "command": "node",
      "args": ["/Users/yoongi/Projects/terminal-mcp/dist/index.js"],
      "alwaysAllow": [
        "start_process",
        "send_input",
        "read_output",
        "list_sessions",
        "get_session_info",
        "stop_process"
      ]
    }
  }
}
```

## Claude Desktop 설정

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "terminal": {
      "command": "node",
      "args": ["/Users/yoongi/Projects/terminal-mcp/dist/index.js"]
    }
  }
}
```

## Flutter 사용 예시

```
# 1. flutter run 시작
start_process(command="flutter", args=["run", "-d", "chrome"], cwd="/path/to/my-app")
→ { "session_id": "abc-123" }

# 2. 빌드 로그 읽기
read_output(session_id="abc-123")
→ { "output": "...", "last_timestamp": 1710000000000 }

# 3. Hot-reload 트리거
send_input(session_id="abc-123", text="r")

# 4. 새 출력만 읽기 (증분)
read_output(session_id="abc-123", since_timestamp=1710000000000)
→ { "output": "Reloaded 3 of 3 libraries in 120ms.", ... }

# 5. 종료
send_input(session_id="abc-123", text="q")
```

## 특수 키 입력

| 키 | 전송 값 |
|----|---------|
| Enter | `\r` |
| Ctrl+C | `\u0003` |
| Ctrl+D | `\u0004` |
| Flutter hot-reload | `r` |
| Flutter hot-restart | `R` |
| Flutter quit | `q` |
