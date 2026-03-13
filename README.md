# Terminal MCP

AI 코딩 도구를 위한 영구 터미널 세션 관리 MCP 서버.

## Why?

기존 AI 코딩 도구(Cursor, Windsurf, RooCode 등)는 간단한 명령어는 실행할 수 있지만, 장시간 실행되는 프로세스를 다루지 못합니다.

예를 들어 `flutter run -d macos`를 실행하면:
- 프로세스가 백그라운드에서 계속 돌아가는데, AI는 이 출력을 읽을 수 없습니다.
- 런타임 오류가 발생해도 AI가 알 수 없어서, 사용자가 에러 로그를 직접 복사해서 붙여넣어줘야 합니다.
- `r` 키를 눌러 Hot Reload를 하거나, `Ctrl+C`로 종료하는 등의 상호작용이 불가능합니다.

**Terminal MCP**를 사용하면 AI가 직접:
1. 프로세스를 시작하고 (`start_process`)
2. 실행 중인 출력을 읽어오고 (`read_output`)
3. 키 입력을 보내고 (`send_input`)
4. 오류를 확인하고 바로 코드를 수정하는 작업을 이어갈 수 있습니다.

**사용자가 에러 메시지를 일일이 복사-붙여넣기 할 필요가 없어집니다.**

## Usage

### 1. 설치 및 빌드

```bash
git clone https://github.com/YoongiKim/terminal-mcp.git
cd terminal-mcp
npm install
npm run build
```

### 2. 서버 실행

서버는 사용자가 직접 실행합니다. 서버가 터미널 세션들을 관리하며, 여러 MCP 클라이언트가 동시에 접속할 수 있습니다.

```bash
npm run server
```

서버가 실행되면 `http://localhost:30722`에서 웹 터미널 UI에 접속할 수 있습니다.

### 3. MCP 설정

AI 코딩 도구에서 MCP 클라이언트를 등록합니다. 클라이언트가 서버에 접속하여 프로세스를 생성하고 제어합니다.

```json
{
  "mcpServers": {
    "terminal-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/terminal-mcp/dist/client.js"],
      "env": {
        "PORT": "30722"
      }
    }
  }
}
```

## Architecture

```
┌──────────┐    ┌──────────┐
│  IDE 1   │    │  IDE 2   │
│ (Client) │    │ (Client) │
└────┬─────┘    └────┬─────┘
     │               │
     └───────┬───────┘
             │ SSE/HTTP
     ┌───────┴───────┐
     │    Server     │ ← npm run server
     │ (Port 30722)  │
     └───┬───────┬───┘
         │       │
    ┌────┴──┐ ┌──┴────┐
    │ bash  │ │ flutter│
    │session│ │session │
    └───────┘ └───────┘
```

서버가 모든 터미널 세션을 관리하고, 각 IDE의 MCP 클라이언트가 서버에 접속하는 구조입니다.

## Tools

| Tool | Description |
|------|-------------|
| `start_process` | 새 프로세스 시작. 세션 이름(alias)을 지정할 수 있음. |
| `send_input` | 실행 중인 프로세스에 텍스트 또는 키 입력 전송. |
| `read_output` | 프로세스 출력 읽기. 마지막 읽은 위치를 기억하여 새 출력만 반환. |
| `list_sessions` | 전체 세션 목록 조회. |
| `get_session_info` | 특정 세션의 상세 정보 조회. |
| `stop_process` | 프로세스 종료. |
| `wait_until_complete` | 프로세스 종료까지 대기 후 결과 반환. |
| `wait_for_seconds` | 지정된 시간 동안 대기하며 출력 수집. |

## License

MIT
