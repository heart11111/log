# Actor 초상화 가져오기 가이드

## 📌 개요

Foundry VTT의 Actor 초상화 이미지를 MCP를 통해 Claude에 전달하는 3가지 방법을 소개합니다.

---

## 🖼️ 방법 1: 이미지 경로만 전달 (가장 간단)

### 장점
- ✅ 빠름 (인코딩 불필요)
- ✅ 대역폭 절약
- ✅ 구현 간단

### 단점
- ❌ Claude가 직접 이미지 파일 접근 불가
- ❌ Foundry 서버가 외부 접근 가능해야 함

### 구현

```javascript
// foundry-mcp-bridge/scripts/mcp-bridge.js

static serializeActor(actor) {
  return {
    id: actor.id,
    name: actor.name,
    img: actor.img,  // "worlds/my-world/actors/aragorn.png"
    token: {
      img: actor.prototypeToken?.texture?.src,
    }
  };
}
```

### Claude 응답 예시

```
Aragorn (Lv5 Ranger)
- HP: 45/45
- Image: worlds/my-world/actors/aragorn.png

[Claude는 경로만 알 수 있음, 이미지 표시 불가]
```

---

## 🖼️ 방법 2: Base64 인코딩 (추천)

### 장점
- ✅ Claude가 이미지 직접 표시 가능
- ✅ 외부 접근 불필요
- ✅ MCP 프로토콜과 호환

### 단점
- ❌ 대역폭 증가 (Base64는 원본보다 33% 큼)
- ❌ 초기 동기화 시간 증가

### 구현

**참고 코드: ChatGPT Item Gen의 이미지 처리**

```javascript
// 출처: f3rr311/ChatGPT-Item-Gen-for-Foundry-VTT/script.js

async saveImageLocally(base64Data, itemName) {
  // Base64 → Blob 변환
  const byteString = atob(base64Data.split(',')[1] || base64Data);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);

  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  const blob = new Blob([ab], { type: 'image/png' });

  // FilePicker로 저장
  const file = new File([blob], fileName, { type: 'image/png' });
  await FilePicker.upload("data", folderPath, file);
}
```

**참고 코드: Runware ImageGen의 Base64 처리**

```javascript
// 출처: Q-efx/fvtt-runware-imagegen/scripts/file-handler.js

_base64ToBlob(base64) {
  const byteString = atob(base64.split(',')[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);

  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  return new Blob([ab], { type: 'image/png' });
}
```

**Foundry → Base64 변환:**

```javascript
// foundry-mcp-bridge/scripts/mcp-bridge-with-images.js

static async imageToBase64(imagePath) {
  try {
    // Foundry의 fetch로 이미지 가져오기
    const response = await fetch(imagePath);
    if (!response.ok) return null;

    // Blob으로 변환
    const blob = await response.blob();

    // Base64로 인코딩
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Image encoding failed:', error);
    return null;
  }
}

static async serializeActor(actor) {
  return {
    id: actor.id,
    name: actor.name,
    img: actor.img,
    // Base64 인코딩된 이미지
    imgBase64: await this.imageToBase64(actor.img),
  };
}
```

### Claude 응답 예시

```
Aragorn (Lv5 Ranger)
- HP: 45/45

[Claude가 실제 초상화 이미지 표시]
```

---

## 🖼️ 방법 3: MCP 리소스 (가장 강력)

### 장점
- ✅ MCP 프로토콜 표준 준수
- ✅ Claude가 이미지 직접 접근
- ✅ 필요할 때만 로드 (lazy loading)

### 단점
- ❌ 구현 복잡도 높음
- ❌ MCP SDK 리소스 기능 필요

### 구현

**MCP 서버:**

```javascript
// foundry-mcp-server-ws/index-with-images.js

constructor() {
  this.server = new Server(
    { name: 'foundry-vtt-live', version: '1.0.0' },
    {
      capabilities: {
        tools: {},
        resources: {}, // 리소스 기능 활성화
      },
    }
  );
}

// 리소스 목록
this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources = [];

  for (const [actorId, actor] of this.actors) {
    if (this.actorImages.has(actorId)) {
      resources.push({
        uri: `foundry://actor/${actorId}/portrait`,
        name: `${actor.name} Portrait`,
        mimeType: 'image/png',
        description: `Portrait for ${actor.name}`,
      });
    }
  }

  return { resources };
});

// 리소스 읽기
this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  const match = uri.match(/^foundry:\/\/actor\/(.+)\/portrait$/);

  if (!match) throw new Error(`Invalid URI: ${uri}`);

  const actorId = match[1];
  const imageBase64 = this.actorImages.get(actorId);

  return {
    contents: [{
      uri,
      mimeType: 'image/png',
      blob: imageBase64, // Base64 이미지
    }],
  };
});
```

### Claude 사용 예시

```
사용자: Aragorn의 초상화 보여줘

Claude: [foundry://actor/abc123/portrait 리소스 접근]

[Aragorn 초상화 이미지 표시]
```

---

## 📊 성능 비교

| 방법 | 초기 로딩 | 대역폭 | Claude 표시 | 구현 난이도 |
|------|----------|--------|-------------|------------|
| **경로만** | ⚡ 즉시 | ✅ 최소 | ❌ 불가 | ⭐ 쉬움 |
| **Base64** | 🐢 느림 | ⚠️ 많음 | ✅ 가능 | ⭐⭐ 중간 |
| **MCP 리소스** | ⚡ 빠름 | ✅ 적음 | ✅ 가능 | ⭐⭐⭐ 어려움 |

---

## 🚀 실제 사용 예시

### 예시 1: Actor 목록 + 썸네일

```javascript
// Foundry에서 Actor 생성
const aragorn = await Actor.create({
  name: "Aragorn",
  type: "character",
  img: "worlds/lotr/aragorn.png"
});

// MCP 브릿지가 자동 감지
// → Base64 인코딩
// → WebSocket으로 전송

// Claude에서 조회
사용자: 캐릭터 목록 보여줘

Claude: [list_actors 사용]

Found 3 characters:
1. Aragorn (Lv5 Ranger)
   [초상화 이미지]
   HP: 45/45, AC: 16

2. Gandalf (Lv10 Wizard)
   [초상화 이미지]
   HP: 68/68, AC: 14

3. Frodo (Lv3 Rogue)
   [초상화 이미지]
   HP: 24/24, AC: 12
```

### 예시 2: 전투 중 턴 알림

```javascript
// Combat 턴 변경 Hook
Hooks.on('combatTurn', (combat, updateData) => {
  const current = combat.combatant;

  MCPBridge.sendToMCP('combat_turn', {
    actorId: current.actor.id,
    actorName: current.actor.name,
    actorImg: current.actor.img,  // 경로
    actorImgBase64: await MCPBridge.imageToBase64(current.actor.img),
  });
});

// Claude가 알림
"Aragorn's turn!
[Aragorn 초상화]
HP: 35/45 (77%)
Action options: Attack, Cast Spell, Use Item"
```

### 예시 3: 이미지 변경 감지

```javascript
// Actor 이미지 업데이트
await aragorn.update({
  img: "worlds/lotr/aragorn-wounded.png"
});

// Hook이 감지
Hooks.on('updateActor', async (actor, changes) => {
  if (changes.img) {
    // 새 이미지 인코딩
    const newImageBase64 = await MCPBridge.imageToBase64(changes.img);

    MCPBridge.sendToMCP('actor_updated', {
      id: actor.id,
      name: actor.name,
      imgBase64: newImageBase64,
    });

    console.log(`[MCP] Updated image for ${actor.name}`);
  }
});

// Claude가 인식
"Aragorn의 초상화가 변경되었습니다.
[새 초상화 표시 - 부상당한 모습]"
```

---

## 🔧 최적화 팁

### 1. 배치 처리

```javascript
// 한 번에 너무 많은 이미지 로드 방지
static async syncAllActors() {
  const batchSize = 5;
  const allActors = Array.from(game.actors);

  for (let i = 0; i < allActors.length; i += batchSize) {
    const batch = allActors.slice(i, i + batchSize);
    const serialized = await Promise.all(
      batch.map(actor => this.serializeActor(actor, true))
    );

    // 배치 단위로 전송
    this.sendToMCP('sync_batch', { actors: serialized });

    // 진행률 표시
    console.log(`Progress: ${Math.round((i / allActors.length) * 100)}%`);
  }
}
```

### 2. 이미지 캐싱

```javascript
// 이미지 캐시 (중복 인코딩 방지)
static imageCache = new Map();

static async imageToBase64(imagePath) {
  // 캐시 확인
  if (this.imageCache.has(imagePath)) {
    return this.imageCache.get(imagePath);
  }

  // 인코딩
  const base64 = await this.encodeImage(imagePath);

  // 캐시 저장
  this.imageCache.set(imagePath, base64);

  return base64;
}
```

### 3. 조건부 이미지 전송

```javascript
// 설정으로 이미지 전송 제어
static async serializeActor(actor) {
  const includeImages = game.settings.get('mcp-bridge', 'includeImages');

  const data = { /* 기본 데이터 */ };

  // 이미지는 선택적으로만
  if (includeImages) {
    data.imgBase64 = await this.imageToBase64(actor.img);
  }

  return data;
}
```

### 4. 썸네일 생성 (용량 절감)

```javascript
// Canvas API로 썸네일 생성
static async createThumbnail(imagePath, maxSize = 128) {
  const img = new Image();
  img.src = imagePath;

  await new Promise(resolve => img.onload = resolve);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // 비율 유지하며 리사이즈
  const scale = Math.min(maxSize / img.width, maxSize / img.height);
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Base64로 변환 (JPEG로 압축)
  return canvas.toDataURL('image/jpeg', 0.7);
}
```

---

## 📚 참고한 모듈 코드

### 1. ChatGPT Item Gen
- **파일:** `f3rr311/ChatGPT-Item-Gen-for-Foundry-VTT/script.js`
- **관련 코드:**
  - Base64 → Blob 변환
  - FilePicker로 이미지 저장
  - 이미지 생성 후 로컬 저장

```javascript
// Base64 디코딩 로직
const byteString = atob(base64Data.split(',')[1]);
const ab = new ArrayBuffer(byteString.length);
const ia = new Uint8Array(ab);

for (let i = 0; i < byteString.length; i++) {
  ia[i] = byteString.charCodeAt(i);
}

const blob = new Blob([ab], { type: 'image/png' });
```

### 2. Runware ImageGen
- **파일:** `Q-efx/fvtt-runware-imagegen/scripts/file-handler.js`
- **관련 코드:**
  - `_base64ToBlob()` 메서드
  - 이미지 파일 저장 시스템
  - 배경 제거 후 저장

```javascript
_base64ToBlob(base64) {
  const byteString = atob(base64.split(',')[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);

  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  return new Blob([ab], { type: 'image/png' });
}
```

### 3. Quickbrush
- **파일:** `wizzlethorpe/quickbrush/foundry-module/scripts/quickbrush.js`
- **관련 코드:**
  - 참조 이미지 Base64 변환
  - 이미지 배열 처리

```javascript
async base64ToBlob(base64) {
  const response = await fetch(`data:image/png;base64,${base64}`);
  return await response.blob();
}
```

---

## 🎯 추천 구현

**단계별 진화:**

1. **1단계 (MVP):** 경로만 전송
   - 빠르게 프로토타입
   - 기본 기능 검증

2. **2단계 (실용):** Base64 인코딩
   - Claude가 이미지 표시
   - 실제 사용 가능

3. **3단계 (최적화):** MCP 리소스 + 캐싱
   - 성능 최적화
   - 프로덕션 레벨

---

## 🐛 디버깅

### Foundry Console에서

```javascript
// 이미지 인코딩 테스트
const aragorn = game.actors.getName("Aragorn");
const base64 = await MCPBridge.imageToBase64(aragorn.img);
console.log(base64.substring(0, 100)); // "data:image/png;base64,iVBORw0..."

// 이미지 크기 확인
console.log(`Image size: ${base64.length} bytes`);
console.log(`Estimated: ${Math.round(base64.length / 1024)} KB`);

// 캐시 확인
MCPBridge.imageCache.size; // 캐시된 이미지 개수
```

### MCP 서버 로그

```bash
[Sync] Loaded 5 actors
[Actor] actor_updated: Aragorn (image: 45KB)
[Image] Cached: foundry://actor/abc123/portrait
```

---

이 가이드를 참고하여 Actor 초상화를 Claude에 전달하세요! 🎨
