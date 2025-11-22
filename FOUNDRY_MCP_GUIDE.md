# Foundry VTT MCP 연동 가이드

## 📋 개요

Foundry VTT의 Actor 데이터를 실시간으로 MCP를 통해 Claude에 노출하는 시스템입니다.

```
Foundry VTT (Hook)
    ↓ WebSocket (ws://localhost:3001)
MCP Server (데이터 캐싱)
    ↓ stdio
Claude Desktop
```

---

## 🚀 설치 및 실행

### 1. Foundry 모듈 설치

```bash
# Foundry Data 폴더로 이동
cd ~/FoundryVTT/Data/modules/

# 모듈 복사
cp -r /home/user/log/foundry-mcp-bridge ./

# Foundry 재시작 후 모듈 활성화
```

### 2. MCP 서버 설치

```bash
cd /home/user/log/foundry-mcp-server-ws

# 의존성 설치
npm install

# 테스트 실행
npm start
```

### 3. Claude Desktop 설정

**파일: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)**
```json
{
  "mcpServers": {
    "foundry-vtt": {
      "command": "node",
      "args": ["/home/user/log/foundry-mcp-server-ws/index.js"]
    }
  }
}
```

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

### 4. 실행 순서

```bash
# 1. MCP 서버 실행 (별도 터미널)
cd foundry-mcp-server-ws
npm start

# 2. Foundry VTT 실행
# 3. mcp-bridge 모듈 활성화
# 4. Claude Desktop 실행
```

---

## 🎯 사용 가능한 Hook

### Actor 관련

```javascript
// Actor 생성
Hooks.on('createActor', (actor, options, userId) => {
  // MCP 서버로 전송: actor_created
});

// Actor 업데이트 (HP, 스탯 변경 등)
Hooks.on('updateActor', (actor, changes, options, userId) => {
  // MCP 서버로 전송: actor_updated
});

// Actor 삭제
Hooks.on('deleteActor', (actor, options, userId) => {
  // MCP 서버로 전송: actor_deleted
});
```

### Item 관련

```javascript
// Actor에 아이템 추가
Hooks.on('createItem', (item, options, userId) => {
  if (item.parent?.documentName === 'Actor') {
    // MCP 서버로 전송: actor_item_added
  }
});

// Actor에서 아이템 제거
Hooks.on('deleteItem', (item, options, userId) => {
  // MCP 서버로 전송: actor_item_removed
});
```

### Combat 관련

```javascript
// 전투 시작
Hooks.on('combatStart', (combat, updateData) => {
  // MCP 서버로 전송: combat_started
});

// 턴 변경
Hooks.on('combatTurn', (combat, updateData, updateOptions) => {
  // MCP 서버로 전송: combat_turn
});
```

### Chat 관련

```javascript
// 주사위 굴리기
Hooks.on('createChatMessage', (message, options, userId) => {
  if (message.rolls?.length > 0) {
    // MCP 서버로 전송: dice_rolled
  }
});
```

---

## 💬 Claude에서 사용 예시

### 예시 1: Actor 목록 조회

```
사용자: Foundry에 어떤 캐릭터들이 있어?

Claude: [list_actors 도구 사용]

Found 5 actors:
- Aragorn (character, Lv5, HP: 45/45, AC: 16)
- Gandalf (character, Lv10, HP: 68/68, AC: 14)
- Orc Warrior (npc, CR: 2, HP: 30/30, AC: 13)
...
```

### 예시 2: 특정 Actor 정보

```
사용자: Aragorn의 스탯 알려줘

Claude: [get_actor_stats 도구 사용]

Aragorn (Lv5 Ranger):
- HP: 45/45
- AC: 16
- Abilities:
  - STR: 18 (+4)
  - DEX: 14 (+2)
  - CON: 16 (+3)
- Weapons:
  - Longsword (1d8+4 slashing)
  - Longbow (1d8+2 piercing)
```

### 예시 3: 아이템 검색

```
사용자: 누가 포션 가지고 있어?

Claude: [search_items 도구 사용]

Found 3 items matching "potion":
- Potion of Healing (Aragorn)
- Greater Potion of Healing (Gandalf)
- Potion of Invisibility (Rogue)
```

---

## 🔧 커스터마이징

### 더 많은 Hook 추가

```javascript
// foundry-mcp-bridge/scripts/mcp-bridge.js

// Scene 변경 감지
Hooks.on('updateScene', (scene, changes, options, userId) => {
  MCPBridge.sendToMCP('scene_changed', {
    sceneId: scene.id,
    sceneName: scene.name,
    changes
  });
});

// Journal Entry 생성
Hooks.on('createJournalEntry', (journal, options, userId) => {
  MCPBridge.sendToMCP('journal_created', {
    id: journal.id,
    name: journal.name,
    content: journal.pages.map(p => p.text.content).join('\n')
  });
});

// 날씨 변경
Hooks.on('updateWeather', (weather) => {
  MCPBridge.sendToMCP('weather_changed', weather);
});
```

### MCP 도구 추가

```javascript
// foundry-mcp-server-ws/index.js

// 새 도구 추가
{
  name: 'roll_dice',
  description: 'Roll dice in Foundry (requires Foundry to listen)',
  inputSchema: {
    type: 'object',
    properties: {
      formula: { type: 'string', description: 'Dice formula (e.g., 1d20+5)' }
    },
    required: ['formula']
  }
}

// 도구 구현
async rollDice(formula) {
  // Foundry로 명령 전송 (양방향 통신 필요)
  this.wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        event: 'roll_dice',
        data: { formula }
      }));
    }
  });
}
```

---

## 🐛 디버깅

### Foundry Console에서

```javascript
// 연결 상태 확인
MCPBridge.ws.readyState
// 0: CONNECTING, 1: OPEN, 2: CLOSING, 3: CLOSED

// 수동으로 데이터 전송
MCPBridge.sendToMCP('test', { message: 'Hello MCP!' });

// 캐시 확인
MCPBridge.actorCache

// 재연결
MCPBridge.connectWebSocket();
```

### MCP 서버 로그

```bash
# MCP 서버 실행 시 stderr로 로그 출력
[WS] Foundry connected
[Sync] Loaded 5 actors
[Actor] actor_updated: Aragorn
[Combat] Started with 3 combatants
```

---

## 📊 데이터 흐름 상세

```
1. Foundry에서 Actor HP 변경
   ↓
2. updateActor Hook 발동
   ↓
3. MCPBridge.serializeActor() 호출
   ↓
4. WebSocket으로 전송
   {
     event: 'actor_updated',
     data: { id: '...', name: 'Aragorn', system: {...} }
   }
   ↓
5. MCP 서버가 수신 및 캐싱
   this.actors.set(actorId, actorData)
   ↓
6. Claude가 get_actor_stats 호출
   ↓
7. MCP 서버가 캐시된 데이터 반환
   ↓
8. Claude가 사용자에게 답변
```

---

## 🎯 활용 아이디어

### 1. AI 던전 마스터
```
사용자: 전투를 시작해줘

Claude:
1. [list_actors로 NPC 확인]
2. [combat_started 이벤트 감지]
3. "Orc Warrior 3마리가 등장했습니다!
   이니셔티브를 굴리세요."
```

### 2. 캐릭터 분석
```
사용자: 우리 파티 밸런스 어때?

Claude:
1. [list_actors로 전체 파티 조회]
2. [각 캐릭터의 get_actor_stats]
3. "탱커 1명, 딜러 2명, 힐러 1명으로
   균형잡혔습니다. 다만 원거리 공격이 부족..."
```

### 3. 자동 전투 로그
```
Claude가 combat_turn 이벤트 감지:
"Aragorn의 턴입니다.
현재 HP: 35/45 (77%)
사용 가능한 무기: Longsword, Longbow
추천 행동: Orc #2에게 Longsword 공격 (AC 13)"
```

---

## 🔒 보안 고려사항

### 1. WebSocket 인증 추가

```javascript
// foundry-mcp-bridge/scripts/mcp-bridge.js
static connectWebSocket() {
  const token = game.settings.get('mcp-bridge', 'authToken');
  this.ws = new WebSocket(`${this.WS_URL}?token=${token}`);
}

// foundry-mcp-server-ws/index.js
this.wss.on('connection', (ws, req) => {
  const token = new URL(req.url, 'http://localhost').searchParams.get('token');
  if (token !== process.env.AUTH_TOKEN) {
    ws.close(1008, 'Unauthorized');
    return;
  }
});
```

### 2. SSL/TLS 사용

```javascript
import https from 'https';
import fs from 'fs';

const server = https.createServer({
  cert: fs.readFileSync('cert.pem'),
  key: fs.readFileSync('key.pem')
});

this.wss = new WebSocketServer({ server });
server.listen(3001);
```

---

## 📝 주요 Hook 레퍼런스

| Hook | 발동 시점 | 전달 인자 |
|------|----------|----------|
| `createActor` | Actor 생성 | (actor, options, userId) |
| `updateActor` | Actor 업데이트 | (actor, changes, options, userId) |
| `deleteActor` | Actor 삭제 | (actor, options, userId) |
| `createItem` | Item 생성 | (item, options, userId) |
| `updateItem` | Item 업데이트 | (item, changes, options, userId) |
| `deleteItem` | Item 삭제 | (item, options, userId) |
| `combatStart` | 전투 시작 | (combat, updateData) |
| `combatTurn` | 턴 변경 | (combat, updateData, updateOptions) |
| `combatRound` | 라운드 변경 | (combat, updateData, updateOptions) |
| `createChatMessage` | 채팅 메시지 | (message, options, userId) |
| `updateScene` | Scene 변경 | (scene, changes, options, userId) |

전체 목록: https://foundryvtt.com/api/modules/hookEvents.html

---

이 시스템을 통해 Claude가 Foundry VTT의 실시간 데이터를 참조하여 더 정확한 게임 마스터 역할을 수행할 수 있습니다!
