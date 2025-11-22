# Foundry VTT AI 모듈 종합 가이드

**작성일:** 2025-11-22
**작성자:** Claude (Anthropic)
**목적:** Foundry VTT AI 통합 모듈 분석 및 MCP 연동 가이드

---

## 📚 목차

1. [개요](#1-개요)
2. [분석한 모듈 요약](#2-분석한-모듈-요약)
3. [모듈별 상세 분석](#3-모듈별-상세-분석)
4. [기능별 비교표](#4-기능별-비교표)
5. [MCP 연동 구현](#5-mcp-연동-구현)
6. [Actor 초상화 처리](#6-actor-초상화-처리)
7. [실전 활용 시나리오](#7-실전-활용-시나리오)
8. [참고 코드 색인](#8-참고-코드-색인)

---

## 1. 개요

### 1.1 분석 대상

본 문서는 다음 5개의 Foundry VTT AI 통합 모듈을 분석합니다:

| 모듈 | 저장소 | 핵심 기능 |
|------|--------|----------|
| **Integrate AI** | [SirNiloc/integrate-ai](https://github.com/SirNiloc/integrate-ai) | 텍스트 생성 (NPC 대화, 콘텐츠) |
| **Runware ImageGen** | [Q-efx/fvtt-runware-imagegen](https://github.com/Q-efx/fvtt-runware-imagegen) | 캐릭터 초상화 생성 |
| **Archivist Sync** | [camrun91/archivist-sync](https://github.com/camrun91/archivist-sync) | 캠페인 데이터 동기화 |
| **Quickbrush** | [wizzlethorpe/quickbrush](https://github.com/wizzlethorpe/quickbrush) | 멀티 플랫폼 이미지 생성 |
| **ChatGPT Item Gen** | [f3rr311/ChatGPT-Item-Gen-for-Foundry-VTT](https://github.com/f3rr311/ChatGPT-Item-Gen-for-Foundry-VTT) | D&D 5e 아이템 자동 생성 |

### 1.2 문서 목표

- ✅ 각 모듈의 기술적 구현 방식 이해
- ✅ 모듈 간 차이점 및 적용 사례 파악
- ✅ MCP(Model Context Protocol)를 통한 Foundry VTT 데이터 접근 구현
- ✅ 실전 활용을 위한 코드 레퍼런스 제공

---

## 2. 분석한 모듈 요약

### 2.1 한눈에 보는 비교표

| 항목 | Integrate AI | Runware | Archivist Sync | Quickbrush | ChatGPT Item Gen |
|------|--------------|---------|----------------|------------|------------------|
| **코드 크기** | ~150줄 | ~800줄 | ~3000+줄 | ~1000줄 | ~1500줄 |
| **복잡도** | ⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **학습 가치** | 초보 | 중급 | 고급 | 중급 | 중급 |
| **비용** | 무료 가능 | 크레딧 | 구독 | BYOK | BYOK |
| **플랫폼** | Foundry만 | Foundry만 | Foundry만 | 멀티 | Foundry만 |
| **시스템** | 범용 | 범용 | 범용 | 범용 | D&D 5e만 |

### 2.2 기능별 분류

**텍스트 생성:**
- Integrate AI (로컬 AI 지원)

**이미지 생성:**
- Runware ImageGen (배경 제거 특화)
- Quickbrush (멀티 플랫폼, 참조 이미지)
- ChatGPT Item Gen (아이템 포함)

**데이터 관리:**
- Archivist Sync (동기화, RAG 검색)

**게임 콘텐츠 생성:**
- ChatGPT Item Gen (D&D 5e 아이템, 롤 테이블)

---

## 3. 모듈별 상세 분석

### 3.1 Integrate AI

#### 기본 정보
- **버전:** 1.2.0
- **크기:** ~150줄
- **라이선스:** MIT
- **개발사:** Wizzlethorpe Labs

#### 핵심 아키텍처

```javascript
class IntegrateAI {
  static async processWithAI(prompt) {
    // 간단한 텍스트 생성
    return this.chatWithAI([{ role: "user", content: prompt }]);
  }

  static async chatWithAI(messagesArray) {
    const url = await this.getChatEndpoint();
    const response = await fetch(url, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({
        model: await this.getModel(),
        messages: messagesArray,
        stream: false
      })
    });

    const data = await response.json();
    return this.getProviderResponse(data);
  }
}
```

#### 지원 프로바이더
1. **Ollama Local** (무료)
2. **OpenAI** (유료)
3. **Custom** (사용자 정의 엔드포인트)

#### 장점
- ✅ 초경량 (~150줄)
- ✅ 로컬 AI 무료 사용 (Ollama)
- ✅ 단순한 API
- ✅ 빠른 응답

#### 단점
- ❌ 재시도 로직 없음
- ❌ 타임아웃 설정 없음
- ❌ Provider 선택 버그 (문자열 vs 인덱스)

#### 활용 사례

**1. NPC 대화 생성**
```javascript
const dialogue = await IntegrateAI.processWithAI(`
  NPC: 노쇠한 대장장이 Marcus (70세)
  상황: 플레이어가 전설의 검 수리 요청
  성격: 무뚝뚝하지만 마음은 따뜻함

  자연스러운 대화문 3문장 생성
`);
```

**2. 퀘스트 자동 생성**
```javascript
const quest = await IntegrateAI.processWithAI(`
  레벨 5 파티용 던전 퀘스트 생성:
  - 배경: 폐허가 된 엘프 신전
  - 적: 언데드 마법사 (CR 7)
  - 보상: Rare 아이템 + 500 Gold
  - 특징: 수수께끼 퍼즐 포함
`);
```

**3. 세션 요약**
```javascript
const summary = await IntegrateAI.processWithAI(`
  다음 게임 세션을 3문장으로 요약해줘:
  ${sessionLog}
`);
```

#### 코드 레퍼런스
- **파일:** `scripts/IntegrateAI.js`
- **핵심 메서드:**
  - `processWithAI()` - 단순 프롬프트 처리
  - `chatWithAI()` - 대화형 인터페이스
  - `getProviderResponse()` - 프로바이더별 응답 파싱

---

### 3.2 Runware ImageGen

#### 기본 정보
- **버전:** 1.1.0
- **크기:** ~800줄
- **라이선스:** MIT
- **API:** Runware AI

#### 핵심 아키텍처

```javascript
class RunwareImageDialog extends FormApplication {
  async _generateImage() {
    // 1. 프롬프트 정제
    const refinedPrompt = this._normalizePrompt(this.description);

    // 2. Runware API 호출
    const response = await fetch('https://api.runware.ai/v1/images/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: refinedPrompt,
        model: this.selectedModel,
        lora: this.loraSettings,
        steps: this.inferenceSteps,
        cfg_scale: this.cfgScale
      })
    });

    // 3. Base64 이미지 수신
    const { images } = await response.json();

    // 4. 배경 제거 (토큰용)
    const tokenImage = await this._removeBackground(images[0]);

    // 5. 파일 저장
    await this._saveImages(images[0], tokenImage);
  }

  async _removeBackground(imageBase64) {
    const response = await fetch('https://api.runware.ai/v1/rmbg/remove', {
      method: 'POST',
      body: JSON.stringify({ image: imageBase64, version: 'v2.0' })
    });

    return await response.json();
  }
}
```

#### 주요 기능

**1. 배경 제거 자동화**
- RMBG v2.0 사용
- 초상화 → 투명 배경 토큰 자동 생성

**2. GM 프리셋 시스템**
```javascript
// GM이 설정 → 모든 플레이어 사용 가능
const preset = {
  name: "Dark Fantasy Style",
  model: "civitai:4384@128713",
  lora: "dark-fantasy:0.9",
  vae: "dark-vae",
  negativePrompt: "bright, colorful, cartoon"
};
```

**3. 배치 생성**
- 1-4개 이미지 동시 생성
- 갤러리에서 선택

**4. CivitAI 모델 지원**
```javascript
// 커뮤니티 모델 사용 가능
model: "civitai:4384@128713" // DreamShaper v8
```

#### 장점
- ✅ 배경 제거 자동화
- ✅ GM 프리셋 공유
- ✅ 고품질 이미지
- ✅ Actor/Item 시트 통합

#### 단점
- ❌ Runware 크레딧 필요
- ❌ 오프라인 사용 불가
- ❌ 텍스트 생성 불가

#### 활용 사례

**1. NPC 초상화 대량 생성**
```javascript
// Actor Sheet → 팔레트 아이콘 클릭
// 자동으로 Actor 정보 추출:
// - 이름: "Merchant Theron"
// - 종족: Human
// - 직업: Merchant

// 프롬프트 추가: "wearing expensive clothes, smiling"
// → 생성 → Auto-update actor image 체크
// → 30초 후 초상화 + 토큰 자동 적용
```

**2. 스타일 일관성 유지**
```javascript
// GM 프리셋: "Campaign Dark Theme"
preset = {
  model: "dreamshaper-8",
  lora: "dark-fantasy:0.9",
  negativePrompt: "bright, colorful"
};

// 모든 NPC에 동일 프리셋 적용
// → 시각적 통일성
```

#### 코드 레퍼런스
- **파일:** `scripts/dialog.js`, `scripts/file-handler.js`
- **핵심 클래스:**
  - `RunwareImageDialog` - UI 및 API 통신
  - `ImageFileHandler` - 파일 저장 관리
- **핵심 메서드:**
  - `_generateImage()` - 이미지 생성
  - `_removeBackground()` - 배경 제거
  - `_base64ToBlob()` - Base64 → Blob 변환

---

### 3.3 Archivist Sync

#### 기본 정보
- **버전:** 1.3.6
- **크기:** ~3000+줄
- **라이선스:** MIT
- **API:** Archivist.ai

#### 핵심 아키텍처

```javascript
class ArchivistApiService {
  async _retryableFetch(url, options, attempt = 1) {
    try {
      const response = await fetch(url, options);

      // 429 Rate Limit 처리
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') * 1000;
        await this._sleep(retryAfter);
        return this._retryableFetch(url, options, attempt + 1);
      }

      return response;
    } catch (error) {
      if (attempt < 10) {
        // 지수 백오프: 1s → 2s → 4s → ... → 30s
        const backoff = Math.min(30000, 1000 * Math.pow(2, attempt));
        const jitter = Math.random() * 500;
        await this._sleep(backoff + jitter);
        return this._retryableFetch(url, options, attempt + 1);
      }
      throw error;
    }
  }

  async _throttleWrite() {
    // 250ms 간격 강제
    const now = Date.now();
    if (this.lastRequestTime + 250 > now) {
      await this._sleep(250);
    }

    // 3 req/s 초과 시 500ms로 증가
    if (this.requestCount > 3 && now - this.batchStart < 1000) {
      await this._sleep(500);
    }
  }
}
```

#### 주요 기능

**1. 양방향 실시간 동기화**
```javascript
// Foundry → Archivist
Hooks.on('createJournalEntry', async (doc) => {
  if (doc.type === 'archivist-character') {
    await archivistApi.createCharacter({
      name: doc.name,
      description: doc.content
    });
  }
});

// Archivist → Foundry
// Sync 버튼 클릭 → Diff 감지 → 변경사항만 적용
```

**2. Ask Archivist Chat (RAG 기반)**
```javascript
// 캠페인 전체 문서 검색
const response = await archivistApi.ask(campaignId, [
  { role: "user", content: "Session 3에서 Blackwood 영주가 뭐라고 했지?" }
]);

// AI가 관련 문서 검색 후 답변
// "Blackwood 영주는 Red Dragon Cult와의 거래를 부인했습니다."
// [출처: Session 3 Recap, Blackwood Manor]
```

**3. Diff 기반 동기화**
```javascript
_normalizeTextForComparison(text) {
  return text
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')  // 연속 개행 → 단락
    .trim();
}

// 변경사항만 감지
const diffs = [
  { type: 'name_changed', old: 'Marcus', new: 'Marcus the Butler' },
  { type: 'description_added', chars: 400 },
  { type: 'link_added', target: 'Blackwood Manor' }
];
```

**4. 데이터 투영 (Projection)**
```javascript
// Archivist 텍스트 → D&D 5e 스탯
const description = "HP: 45, AC: 16, STR: 18";

// 자동 파싱
actor.system.attributes.hp.value = 45;
actor.system.attributes.ac.value = 16;
actor.system.abilities.str.value = 18;
```

#### 장점
- ✅ 프로덕션급 에러 처리
- ✅ 재시도 + 쓰로틀링
- ✅ RAG 기반 검색
- ✅ 협업 GM 지원
- ✅ 백업 자동화

#### 단점
- ❌ Archivist 구독 필요
- ❌ 학습 곡선 높음
- ❌ 오프라인 불가
- ❌ 동시 편집 충돌 미해결

#### 활용 사례

**1. 멀티 GM 협업**
```
GM 1 (집):
- Archivist 웹에서 Chapter 2 NPC 20명 작성

GM 2 (카페):
- Foundry 열고 Sync 버튼 클릭
- 20명 NPC 자동 import (30초)
```

**2. 세션 준비 자동화**
```
Before:
- Google Docs 복사 → Foundry 붙여넣기 (2시간)

After:
- Archivist Setup Wizard (5분)
- 모든 콘텐츠 자동 생성
```

**3. 캠페인 백업**
```
Foundry 월드 손상 → Archivist에 데이터 보존
→ 새 월드 생성 → Setup Wizard → 복구
```

#### 코드 레퍼런스
- **파일:** `scripts/services/archivist-api.js`, `scripts/dialogs/sync-dialog.js`
- **핵심 클래스:**
  - `ArchivistApiService` - API 통신
  - `SyncDialog` - Diff 기반 동기화
- **핵심 메서드:**
  - `_retryableFetch()` - 재시도 로직
  - `_throttleWrite()` - 쓰로틀링
  - `_normalizeTextForComparison()` - 텍스트 정규화

---

### 3.4 Quickbrush

#### 기본 정보
- **버전:** 2.3.0
- **크기:** ~1000줄
- **라이선스:** MIT
- **API:** OpenAI (DALL-E 3)

#### 핵심 아키텍처

```javascript
// 1. Factory Pattern
function createGenerator(type, apiKey) {
  switch (type) {
    case 'character':
      return new CharacterImageGenerator(apiKey);
    case 'scene':
      return new SceneImageGenerator(apiKey);
    case 'creature':
      return new CreatureImageGenerator(apiKey);
    case 'item':
      return new ItemImageGenerator(apiKey);
  }
}

// 2. Abstract Base Class
class ImageGenerator {
  async generate(description, customPrompt, refImages) {
    // [1단계] GPT-4o로 프롬프트 정제
    const refinedPrompt = await this.refineDescription(description);

    // [2단계] DALL-E 3로 이미지 생성
    const imageBase64 = await this.client.generateImage(
      refinedPrompt,
      refImages
    );

    return imageBase64;
  }
}

// 3. Monorepo 구조
quickbrush-core/src/index.js  // 단일 진실 공급원
  ├── foundry-module/scripts/quickbrush-core.js  (복사본)
  ├── obsidian-plugin/ (번들)
  └── docs/js/quickbrush-core.js  (복사본)
```

#### 주요 기능

**1. 4가지 생성 타입**

```javascript
// Character Generator
systemPrompt = `
  fantasy-steampunk illustration style
  inspired by graphic novel and RPG character art
  dramatic lighting, expressive details
`;

// Scene Generator
systemPrompt = `
  first-person perspective environmental composition
  cinematic framing, atmospheric lighting
`;

// Creature Generator
systemPrompt = `
  non-humanoid entity visualization
  detailed anatomy, characteristic poses
`;

// Item Generator
systemPrompt = `
  isolated object rendering
  centered on white background
  product photography aesthetic
`;
```

**2. 참조 이미지 (최대 4개)**
```javascript
await generator.generate(
  description: "엘프 전사",
  customPrompt: "wearing silver armor",
  referenceImages: [
    armor_style.jpg,
    pose_reference.jpg,
    color_palette.jpg,
    lighting_example.jpg
  ]
);
```

**3. 2단계 프로세스**
```
긴 저널 엔트리 (10,000자)
  ↓
[1단계] GPT-4o 정제
"엘프 전사, 긴 금발, 가죽 갑옷, 활..."
  ↓
[2단계] DALL-E 3 생성
  ↓
Base64 이미지
```

**4. 멀티 플랫폼**
```bash
# 코어 수정 후 동기화
npm run sync-core

# 자동으로 업데이트:
# - Foundry 모듈
# - Obsidian 플러그인
# - 웹 버전
```

#### 장점
- ✅ 멀티 플랫폼
- ✅ 참조 이미지 지원
- ✅ GPT-4o 프롬프트 정제
- ✅ 깔끔한 OOP 구조

#### 단점
- ❌ OpenAI 비용
- ❌ 생성 시간 (2단계 = 30~60초)
- ❌ 스타일 고정
- ❌ 로컬 모델 불가

#### 활용 사례

**1. Journal에서 장면 생성**
```
저널 내용:
"고대 사원의 입구가 눈앞에 펼쳐진다.
덩굴로 뒤덮인 돌기둥이 어두운 출입구를 감싸고..."

우클릭 → "Generate Scene Art"
→ Type: Scene (자동)
→ Aspect Ratio: Landscape (자동)
→ 시네마틱 장면 생성
```

**2. 참조 이미지로 일관성**
```
캠페인 테마: Dark Fantasy

참조 세트:
- dark_palette.jpg
- gothic_style.jpg
- gritty_texture.jpg

모든 생성에 동일 참조 적용
→ 시각적 통일성
```

#### 코드 레퍼런스
- **파일:** `packages/quickbrush-core/src/index.js`
- **핵심 클래스:**
  - `ImageGenerator` (Abstract)
  - `CharacterImageGenerator`
  - `SceneImageGenerator`
  - `CreatureImageGenerator`
  - `ItemImageGenerator`
- **핵심 메서드:**
  - `generate()` - 이미지 생성
  - `refineDescription()` - GPT-4o 정제
  - `base64ToBlob()` - 변환

---

### 3.5 ChatGPT Item Gen

#### 기본 정보
- **버전:** 1.0.8
- **크기:** ~1500줄 (48.5KB)
- **라이선스:** MIT
- **시스템:** D&D 5e 전용

#### 핵심 아키텍처

```javascript
class ChatGPTItemGenerator {
  async generateItem(itemType, prompt, explicitName) {
    // [1단계 - 20%] 이름 생성
    const itemName = explicitName || await this.generateItemName(prompt);

    // [2단계 - 40%] 구조화된 JSON 생성
    const jsonData = await this.generateItemJSON(itemType, prompt, itemName);

    // [3단계 - 60%] 이미지 생성
    const imageData = await this.generateItemImageSilent(itemName, jsonData.description);

    // [4단계 - 80%] JSON 파싱 및 복구
    let itemData = await this.parseAndFixJSON(jsonData);

    // [5단계 - 90%] 이름 정제
    const refinedName = await this.refineItemName(itemData);

    // [6단계 - 100%] Foundry 아이템 생성
    return await this.createFoundryItem(itemData, refinedName, imageData);
  }

  // 3단계 JSON 복구
  async parseAndFixJSON(jsonData) {
    // [시도 1] 직접 파싱
    try {
      return JSON.parse(jsonData);
    } catch { /* 다음 시도 */ }

    // [시도 2] GPT-4로 수리
    try {
      const fixed = await this.gptFixJSON(jsonData);
      return JSON.parse(fixed);
    } catch { /* 다음 시도 */ }

    // [시도 3] Regex 추출
    try {
      const cleaned = this.regexExtractJSON(jsonData);
      return JSON.parse(cleaned);
    } catch {
      throw new Error('JSON recovery failed');
    }
  }
}
```

#### 주요 기능

**1. 구조화된 JSON 생성**
```javascript
// GPT-4 프롬프트
const systemPrompt = `
You are a D&D 5e item creator.
Generate ONLY valid JSON:

{
  "name": "Item name",
  "type": "weapon|armor|consumable|loot",
  "rarity": "common|uncommon|rare|very rare|legendary",
  "description": "...",
  "attunement": true|false,
  "weight": number,
  "price": number,
  "damage": "1d8 slashing",  // weapons only
  "armorClass": number,  // armor only
  "properties": ["versatile", "finesse"],
  "effects": "Mechanical effects"
}

RULES:
- DO NOT include "dragon" unless requested
- Use official D&D 5e terminology
- Balance by rarity
`;

// 출력 예시
{
  "name": "Flaming Greatsword of Justice",
  "type": "weapon",
  "rarity": "rare",
  "damage": "2d6 slashing + 1d6 fire",
  "properties": ["two-handed", "heavy", "magical"],
  "effects": "+1d6 fire on hit, Advantage vs undead"
}
```

**2. D&D 5e 시스템 통합**
```javascript
transformWeaponData(itemData) {
  // "1d8 slashing" → Foundry 데이터 구조
  itemData.system = {
    damage: {
      parts: [["1d8", "slashing"]]
    },
    properties: {
      fin: itemData.properties.includes('finesse'),
      ver: itemData.properties.includes('versatile'),
      hvy: itemData.properties.includes('heavy')
    },
    type: {
      value: this.detectWeaponType(itemData.name),
      baseItem: this.mapToBaseWeapon(itemData.name)
    }
  };
}
```

**3. 롤 테이블 생성**
```javascript
async generateRollTable(prompt, linkItems = true) {
  // GPT-4로 20개 엔트리 생성
  const entries = await this.callChatGPT(`
    Create 20 D&D 5e themed entries for:
    ${prompt}
  `);

  // 롤 테이블 생성
  const table = await RollTable.create({
    name: `AI Table: ${prompt}`,
    formula: "1d20",
    results: entries.map((text, i) => ({
      type: CONST.TABLE_RESULT_TYPES.TEXT,
      text: text,
      range: [i + 1, i + 1]
    }))
  });

  // 아이템 링크 모드
  if (linkItems) {
    for (let entry of entries) {
      const item = await this.generateItem('loot', entry);
      // 테이블 엔트리를 아이템으로 교체
      await table.updateEmbeddedDocuments(...);
    }
  }
}
```

**4. 이미지 폴백 체인**
```javascript
async generateItemImageSilent(itemName, description) {
  // [1순위] Stable Diffusion
  if (useStableDiffusion) {
    try { return await this.generateSD(...); }
    catch { /* 다음 */ }
  }

  // [2순위] DALL-E 3
  try { return await this.generateDallE3(...); }
  catch { /* 다음 */ }

  // [3순위] DALL-E 2
  try { return await this.generateDallE2(...); }
  catch { return null; }
}
```

#### 장점
- ✅ D&D 5e 규칙 완벽 준수
- ✅ 3단계 JSON 복구 (99% 성공률)
- ✅ 롤 테이블 생성
- ✅ Stable Diffusion 지원 (무료)

#### 단점
- ❌ D&D 5e 전용
- ❌ Monolithic 구조 (단일 파일 48KB)
- ❌ 생성 시간 (30초/아이템)
- ❌ 비용 ($0.07/아이템)

#### 활용 사례

**1. 퀘스트 보상 생성**
```javascript
Items Directory → "Generate AI Item"

다이얼로그:
- Type: Weapon
- Prompt: "sword forged by dwarven masters, fire magic"
- Quality: High

결과 (30초):
→ "Emberforge Blade" (Rare Longsword)
→ 1d8 slashing + 1d6 fire
→ +1 to attack/damage
→ 이미지 첨부
→ 바로 지급 가능
```

**2. 상점 재고 롤 테이블**
```javascript
Object Type: Roll Table
Link to Items: ✅
Prompt: "mysterious alchemist's shop"

생성 (10분):
→ 20개 포션 자동 생성
→ 롤 테이블에 링크

사용:
/roll 1d20
→ 15: "Potion of Levitation" 획득
```

#### 코드 레퍼런스
- **파일:** `script.js` (전체 로직)
- **핵심 클래스:**
  - `ChatGPTItemGenerator`
- **핵심 메서드:**
  - `generateItem()` - 6단계 파이프라인
  - `parseAndFixJSON()` - 3단계 복구
  - `transformWeaponData()` - D&D 5e 변환
  - `generateRollTable()` - 롤 테이블

---

## 4. 기능별 비교표

### 4.1 텍스트 생성

| 기능 | Integrate AI | Archivist Sync |
|------|--------------|----------------|
| **로컬 AI** | ✅ Ollama | ❌ |
| **대화 히스토리** | ✅ | ✅ (RAG) |
| **재시도** | ❌ | ✅ (10회) |
| **쓰로틀링** | ❌ | ✅ |
| **비용** | 무료 가능 | 구독 |

### 4.2 이미지 생성

| 기능 | Runware | Quickbrush | ChatGPT Item Gen |
|------|---------|------------|------------------|
| **참조 이미지** | ❌ | ✅ (4개) | ❌ |
| **배경 제거** | ✅ 자동 | ❌ | ❌ |
| **프롬프트 정제** | ❌ | ✅ GPT-4o | ✅ GPT-4 |
| **로컬 생성** | ❌ | ❌ | ✅ SD |
| **멀티 플랫폼** | ❌ | ✅ | ❌ |

### 4.3 데이터 관리

| 기능 | Archivist Sync |
|------|----------------|
| **양방향 동기화** | ✅ |
| **Diff 기반** | ✅ |
| **RAG 검색** | ✅ |
| **백업** | ✅ |
| **협업** | ✅ |

### 4.4 게임 콘텐츠

| 기능 | ChatGPT Item Gen |
|------|------------------|
| **아이템 생성** | ✅ |
| **롤 테이블** | ✅ |
| **D&D 5e 통합** | ✅ |
| **JSON 복구** | ✅ (99%) |

---

## 5. MCP 연동 구현

### 5.1 개요

MCP(Model Context Protocol)를 통해 Foundry VTT의 실시간 데이터를 Claude에 노출합니다.

```
Foundry VTT (Hook)
    ↓ WebSocket (ws://localhost:3001)
MCP Server (데이터 캐싱)
    ↓ stdio
Claude Desktop
```

### 5.2 아키텍처

#### Foundry 모듈 (mcp-bridge)

```javascript
class MCPBridge {
  static WS_URL = 'ws://localhost:3001';

  // Actor 데이터 직렬화
  static async serializeActor(actor) {
    return {
      id: actor.id,
      name: actor.name,
      type: actor.type,
      img: actor.img,
      system: {
        abilities: actor.system.abilities,
        attributes: actor.system.attributes,
        details: actor.system.details
      },
      items: actor.items.map(item => ({ ... })),
      effects: actor.effects.map(effect => ({ ... }))
    };
  }

  // Hook 등록
  static registerHooks() {
    Hooks.on('createActor', async (actor, options, userId) => {
      const data = await this.serializeActor(actor);
      this.sendToMCP('actor_created', data);
    });

    Hooks.on('updateActor', async (actor, changes, options, userId) => {
      const data = await this.serializeActor(actor);
      this.sendToMCP('actor_updated', { id: actor.id, changes, fullData: data });
    });

    // ... 더 많은 Hook
  }
}
```

#### MCP 서버 (WebSocket 브릿지)

```javascript
class FoundryMCPServer {
  constructor() {
    this.actors = new Map(); // 데이터 캐시

    // WebSocket 서버
    this.wss = new WebSocketServer({ port: 3001 });

    // MCP 서버
    this.server = new Server(
      { name: 'foundry-vtt-live', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );
  }

  handleFoundryEvent(message) {
    const { event, data } = message;

    switch (event) {
      case 'sync_all':
        data.actors.forEach(actor => {
          this.actors.set(actor.id, actor);
        });
        break;

      case 'actor_updated':
        this.actors.set(data.id, data.fullData);
        break;

      // ... 더 많은 이벤트
    }
  }

  setupMCPHandlers() {
    // 도구 목록
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'list_actors',
          description: 'List all actors in Foundry VTT',
          inputSchema: { ... }
        },
        {
          name: 'get_actor',
          description: 'Get detailed actor information',
          inputSchema: { ... }
        }
      ]
    }));

    // 도구 실행
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'list_actors':
          return this.listActors(args.type);
        case 'get_actor':
          return this.getActor(args.nameOrId);
      }
    });
  }
}
```

### 5.3 사용 가능한 Hook

#### Actor 관련
```javascript
Hooks.on('createActor', (actor, options, userId) => {});
Hooks.on('updateActor', (actor, changes, options, userId) => {});
Hooks.on('deleteActor', (actor, options, userId) => {});
```

#### Item 관련
```javascript
Hooks.on('createItem', (item, options, userId) => {});
Hooks.on('updateItem', (item, changes, options, userId) => {});
Hooks.on('deleteItem', (item, options, userId) => {});
```

#### Combat 관련
```javascript
Hooks.on('combatStart', (combat, updateData) => {});
Hooks.on('combatTurn', (combat, updateData, updateOptions) => {});
Hooks.on('combatRound', (combat, updateData, updateOptions) => {});
```

#### Chat 관련
```javascript
Hooks.on('createChatMessage', (message, options, userId) => {});
```

### 5.4 Claude 사용 예시

```
사용자: Foundry에 어떤 캐릭터들이 있어?

Claude: [list_actors 도구 사용]

Found 5 actors:
- Aragorn (Lv5 Ranger, HP: 45/45, AC: 16)
- Gandalf (Lv10 Wizard, HP: 68/68, AC: 14)
- Orc Warrior (CR 2, HP: 30/30, AC: 13)

---

사용자: Aragorn의 스탯 알려줘

Claude: [get_actor 도구 사용]

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

---

## 6. Actor 초상화 처리

### 6.1 3가지 방법 비교

| 방법 | 초기 로딩 | 대역폭 | Claude 표시 | 구현 난이도 |
|------|----------|--------|-------------|------------|
| **경로만** | ⚡ 즉시 | ✅ 최소 | ❌ 불가 | ⭐ 쉬움 |
| **Base64** | 🐢 느림 | ⚠️ 많음 | ✅ 가능 | ⭐⭐ 중간 |
| **MCP 리소스** | ⚡ 빠름 | ✅ 적음 | ✅ 가능 | ⭐⭐⭐ 어려움 |

### 6.2 Base64 인코딩 (추천)

#### Foundry 모듈

```javascript
// 이미지 → Base64 변환
static async imageToBase64(imagePath) {
  const response = await fetch(imagePath);
  if (!response.ok) return null;

  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Actor 직렬화 시 이미지 포함
static async serializeActor(actor, includeImage = true) {
  const data = { /* 기본 데이터 */ };

  if (includeImage && actor.img) {
    data.imgBase64 = await this.imageToBase64(actor.img);
  }

  return data;
}
```

#### MCP 서버

```javascript
// 이미지 캐싱
this.actorImages = new Map(); // actorId → base64

handleFoundryEvent(message) {
  switch (message.event) {
    case 'actor_updated':
      if (message.data.imgBase64) {
        this.actorImages.set(message.data.id, message.data.imgBase64);
      }
      break;
  }
}

// 도구: 이미지 포함 조회
getActorWithImage(nameOrId) {
  const actor = this.findActor(nameOrId);
  const content = [
    { type: 'text', text: JSON.stringify(actor, null, 2) }
  ];

  if (this.actorImages.has(actor.id)) {
    content.push({
      type: 'image',
      data: this.actorImages.get(actor.id),
      mimeType: 'image/png'
    });
  }

  return { content };
}
```

### 6.3 참고 코드

#### ChatGPT Item Gen의 Base64 변환

```javascript
// f3rr311/ChatGPT-Item-Gen-for-Foundry-VTT/script.js

async saveImageLocally(base64Data, itemName) {
  // Base64 → Blob
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

#### Runware ImageGen의 Blob 변환

```javascript
// Q-efx/fvtt-runware-imagegen/scripts/file-handler.js

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

---

## 7. 실전 활용 시나리오

### 7.1 AI 던전 마스터

#### 구현
```javascript
// Integrate AI + MCP 조합
async function aiDungeonMaster(playerAction) {
  // 1. 현재 전투 상황 파악 (MCP)
  const actors = await mcp.call('list_actors', { type: 'all' });
  const combatants = actors.filter(a => a.hp.current < a.hp.max);

  // 2. AI로 결과 생성 (Integrate AI)
  const context = `
    플레이어 행동: ${playerAction}
    현재 전투원: ${combatants.map(c => c.name).join(', ')}
  `;

  const result = await IntegrateAI.processWithAI(
    `${context}\n\n결과를 D&D 5e 규칙에 맞게 생성해줘`
  );

  // 3. Foundry에 자동 반영
  if (result.includes('전투')) {
    await createCombat(combatants);
  }

  return result;
}
```

#### 사용 예시
```
플레이어: 오크에게 공격합니다!

AI DM:
1. [MCP로 Orc 스탯 조회]
   - Orc Warrior (AC: 13, HP: 30/30)
2. [Integrate AI로 결과 생성]
   - "공격 굴림을 하세요. AC 13 이상이면 명중."
3. [주사위 굴림 Hook 감지]
   - 결과: 18 (명중!)
4. [데미지 자동 계산]
   - 1d8+4 = 9 데미지
5. [Orc HP 자동 업데이트]
   - 30 → 21 HP
6. [Claude가 내레이션]
   - "당신의 검이 오크의 어깨를 베었습니다!
      오크가 고통스러워하며 뒤로 물러납니다."
```

### 7.2 자동 콘텐츠 생성 파이프라인

#### 구현
```javascript
async function generateCompleteCampaign(concept) {
  // 1. AI로 캠페인 개요 생성 (Integrate AI)
  const outline = await IntegrateAI.processWithAI(`
    캠페인 컨셉: ${concept}

    다음을 생성해줘:
    - 주요 NPC 5명 (이름, 역할, 동기)
    - 주요 장소 3곳 (이름, 설명)
    - 메인 퀘스트 라인
  `);

  // 2. NPC 초상화 생성 (Quickbrush)
  const npcs = extractNPCs(outline);
  for (const npc of npcs) {
    const image = await createGenerator('character', apiKey)
      .generate(npc.description);

    npc.image = image;
  }

  // 3. Archivist에 저장
  for (const npc of npcs) {
    await archivistApi.createCharacter({
      name: npc.name,
      description: npc.description,
      image: npc.image
    });
  }

  // 4. Foundry 동기화
  await archivistSync.sync();

  // 5. 보상 아이템 생성 (ChatGPT Item Gen)
  const rewards = await generateItem('weapon', '캠페인 최종 보상');

  return { npcs, locations, quests, rewards };
}
```

### 7.3 플레이어 캐릭터 분석

#### 구현
```javascript
async function analyzePartyBalance() {
  // 1. MCP로 파티 정보 수집
  const party = await mcp.call('list_actors', { type: 'character' });

  // 2. AI로 분석 (Integrate AI)
  const analysis = await IntegrateAI.processWithAI(`
    파티 구성:
    ${party.map(p => `- ${p.name} (${p.class} Lv${p.level})`).join('\n')}

    다음을 분석해줘:
    1. 역할 밸런스 (탱커/딜러/힐러/서포터)
    2. 약점
    3. 추천 파티 전략
  `);

  return analysis;
}
```

#### 사용 예시
```
사용자: 우리 파티 밸런스 분석해줘

Claude:
[MCP로 파티 조회]
- Aragorn (Fighter Lv5)
- Gandalf (Wizard Lv10)
- Legolas (Ranger Lv5)
- Gimli (Fighter Lv5)

[AI 분석]
파티 밸런스 분석:

1. 역할 분포:
   - 탱커: 2명 (Aragorn, Gimli) ✅
   - 원거리 딜러: 2명 (Gandalf, Legolas) ✅
   - 힐러: 0명 ❌
   - 서포터: 1명 (Gandalf) ✅

2. 약점:
   - 힐러 부재로 지속력 부족
   - 전투 중 회복 수단 제한적
   - 장기전 불리

3. 추천 전략:
   - 힐링 포션 다량 구비
   - Gandalf의 Cure Wounds 준비
   - 단기 결전 전략 선호
```

---

## 8. 참고 코드 색인

### 8.1 Base64 변환

**ChatGPT Item Gen**
- 파일: `f3rr311/ChatGPT-Item-Gen-for-Foundry-VTT/script.js`
- 메서드: `saveImageLocally()`
- 용도: Base64 → Blob → FilePicker 저장

**Runware ImageGen**
- 파일: `Q-efx/fvtt-runware-imagegen/scripts/file-handler.js`
- 메서드: `_base64ToBlob()`
- 용도: Base64 → Blob 변환

**Quickbrush**
- 파일: `wizzlethorpe/quickbrush/.../quickbrush.js`
- 메서드: `base64ToBlob()`
- 용도: Fetch → Base64

### 8.2 API 통신

**Integrate AI**
- 파일: `scripts/IntegrateAI.js`
- 메서드: `chatWithAI()`
- 특징: 기본 fetch, 재시도 없음

**Archivist Sync**
- 파일: `scripts/services/archivist-api.js`
- 메서드: `_retryableFetch()`, `_throttleWrite()`
- 특징: 재시도 + 지수 백오프 + 쓰로틀링

**ChatGPT Item Gen**
- 파일: `script.js`
- 메서드: `callChatGPT()`, `parseAndFixJSON()`
- 특징: 3단계 JSON 복구

### 8.3 FormApplication

**Runware ImageGen**
- 파일: `scripts/dialog.js`
- 클래스: `RunwareImageDialog extends FormApplication`
- 특징: Handlebars 템플릿, 이벤트 리스너

**Quickbrush**
- 파일: `foundry-module/scripts/quickbrush.js`
- 클래스: `QuickbrushDialog extends FormApplication`
- 특징: 참조 이미지 배열, 자동 메타데이터 추출

### 8.4 FilePicker

**Runware ImageGen**
- 파일: `scripts/file-handler.js`
- 메서드: `saveImage()`, `_ensureDirectory()`
- 특징: 디렉토리 재귀 생성, 넘버링

**ChatGPT Item Gen**
- 파일: `script.js`
- 메서드: `saveImageLocally()`
- 특징: Base64 → File → FilePicker.upload

### 8.5 Hook 활용

**Archivist Sync**
- 파일: `scripts/archivist-sync.js`
- Hook: `createJournalEntry`, `updateActor`, `combatStart`
- 특징: 실시간 동기화, 억제 카운터

**MCP Bridge**
- 파일: `foundry-mcp-bridge/scripts/mcp-bridge.js`
- Hook: 모든 Actor/Item/Combat Hook
- 특징: WebSocket 전송, 직렬화

### 8.6 데이터 변환

**ChatGPT Item Gen**
- 파일: `script.js`
- 메서드: `transformWeaponData()`, `detectWeaponType()`
- 특징: JSON → D&D 5e 시스템 데이터

**Archivist Sync**
- 파일: `scripts/modules/projection/`
- 메서드: `projectToActor()`
- 특징: 텍스트 → 게임 스탯 파싱

---

## 9. 결론

### 9.1 모듈 선택 가이드

**초보자 - 간단한 AI 통합:**
→ **Integrate AI** (로컬 무료, 150줄)

**이미지 생성 필요:**
→ **Quickbrush** (멀티 플랫폼, 참조 이미지)
→ **Runware ImageGen** (배경 제거 자동화)

**D&D 5e 아이템 생성:**
→ **ChatGPT Item Gen** (롤 테이블, 구조화된 JSON)

**엔터프라이즈 캠페인 관리:**
→ **Archivist Sync** (동기화, RAG 검색, 협업)

### 9.2 조합 추천

**최소 구성:**
- Integrate AI (텍스트)

**표준 구성:**
- Integrate AI (텍스트)
- Quickbrush (이미지)

**완전 구성:**
- Integrate AI (텍스트)
- Quickbrush (이미지)
- ChatGPT Item Gen (D&D 아이템)
- Archivist Sync (데이터 관리)

**MCP 통합:**
- 위 모듈들 + MCP Bridge
- Claude가 Foundry 데이터 실시간 접근

### 9.3 학습 로드맵

**1주차: 기초**
- Integrate AI 분석 및 설치
- 간단한 NPC 대화 생성

**2주차: 중급**
- Quickbrush 또는 Runware 설치
- 이미지 생성 워크플로우 구축

**3주차: 고급**
- ChatGPT Item Gen (D&D 5e)
- 롤 테이블 자동화

**4주차: 전문가**
- Archivist Sync
- MCP 연동 구현
- 완전 자동화 파이프라인

---

## 10. 참고 자료

### 10.1 공식 문서

- **Foundry VTT API:** https://foundryvtt.com/api/
- **Foundry Hook Events:** https://foundryvtt.com/api/modules/hookEvents.html
- **MCP Protocol:** https://modelcontextprotocol.io/

### 10.2 저장소

- **Integrate AI:** https://github.com/SirNiloc/integrate-ai
- **Runware ImageGen:** https://github.com/Q-efx/fvtt-runware-imagegen
- **Archivist Sync:** https://github.com/camrun91/archivist-sync
- **Quickbrush:** https://github.com/wizzlethorpe/quickbrush
- **ChatGPT Item Gen:** https://github.com/f3rr311/ChatGPT-Item-Gen-for-Foundry-VTT

### 10.3 추가 리소스

- **MCP 브릿지 구현:** `/home/user/log/FOUNDRY_MCP_GUIDE.md`
- **Actor 초상화 처리:** `/home/user/log/ACTOR_IMAGE_GUIDE.md`
- **코드 저장소:** `/home/user/log/foundry-mcp-bridge/`, `/home/user/log/foundry-mcp-server-ws/`

---

**문서 끝**
