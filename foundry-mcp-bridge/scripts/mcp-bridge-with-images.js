/**
 * Foundry VTT → MCP Bridge (이미지 지원 포함)
 * Hook 기반으로 Actor 데이터 + 초상화를 MCP 서버로 전송
 */

class MCPBridge {
  static WS_URL = 'ws://localhost:3001';
  static ws = null;
  static actorCache = new Map();

  /**
   * WebSocket 연결
   */
  static connectWebSocket() {
    try {
      this.ws = new WebSocket(this.WS_URL);

      this.ws.onopen = () => {
        console.log('[MCP Bridge] Connected to MCP server');
        this.syncAllActors(); // 초기 동기화
      };

      this.ws.onclose = () => {
        console.log('[MCP Bridge] Disconnected, retrying in 5s...');
        setTimeout(() => this.connectWebSocket(), 5000);
      };

      this.ws.onerror = (error) => {
        console.error('[MCP Bridge] WebSocket error:', error);
      };
    } catch (error) {
      console.error('[MCP Bridge] Connection failed:', error);
    }
  }

  /**
   * MCP 서버로 데이터 전송
   */
  static sendToMCP(event, data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, data }));
    }
  }

  /**
   * 이미지를 Base64로 인코딩
   * 참고: ChatGPT Item Gen, Runware ImageGen 방식
   */
  static async imageToBase64(imagePath) {
    try {
      // Foundry의 fetch로 이미지 가져오기
      const response = await fetch(imagePath);
      if (!response.ok) {
        console.warn(`[MCP Bridge] Image fetch failed: ${imagePath}`);
        return null;
      }

      // Blob으로 변환
      const blob = await response.blob();

      // Base64로 인코딩
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = (error) => {
          console.error('[MCP Bridge] FileReader error:', error);
          reject(error);
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('[MCP Bridge] Image encoding failed:', error);
      return null;
    }
  }

  /**
   * Actor 데이터 직렬화 (이미지 포함)
   */
  static async serializeActor(actor, includeImage = true) {
    const data = {
      id: actor.id,
      name: actor.name,
      type: actor.type,

      // 이미지 경로
      img: actor.img,

      // Token 이미지 (Actor 이미지와 다를 수 있음)
      token: {
        img: actor.prototypeToken?.texture?.src || actor.img,
        name: actor.prototypeToken?.name,
        scale: actor.prototypeToken?.texture?.scaleX,
      },

      // D&D 5e 전용 데이터
      system: {
        abilities: actor.system.abilities,
        attributes: actor.system.attributes,
        details: actor.system.details,
        traits: actor.system.traits,
        currency: actor.system.currency,
      },

      // 아이템
      items: actor.items.map(item => ({
        id: item.id,
        name: item.name,
        type: item.type,
        img: item.img,
        system: {
          description: item.system.description?.value,
          quantity: item.system.quantity,
          weight: item.system.weight,
          price: item.system.price,
          rarity: item.system.rarity,
          // 무기
          damage: item.system.damage,
          properties: item.system.properties,
          // 주문
          level: item.system.level,
          school: item.system.school,
        }
      })),

      // 효과
      effects: actor.effects.map(effect => ({
        id: effect.id,
        name: effect.name,
        icon: effect.icon,
        disabled: effect.disabled,
        duration: effect.duration,
      })),
    };

    // 이미지를 Base64로 인코딩 (선택적)
    if (includeImage && actor.img) {
      data.imgBase64 = await this.imageToBase64(actor.img);

      // Token 이미지도 인코딩 (다를 경우)
      const tokenImg = actor.prototypeToken?.texture?.src;
      if (tokenImg && tokenImg !== actor.img) {
        data.token.imgBase64 = await this.imageToBase64(tokenImg);
      }
    }

    return data;
  }

  /**
   * 모든 Actor 동기화
   */
  static async syncAllActors() {
    console.log('[MCP Bridge] Syncing all actors...');
    const actors = [];

    // 배치로 처리 (한 번에 너무 많은 이미지 로드 방지)
    const batchSize = 5;
    const allActors = Array.from(game.actors);

    for (let i = 0; i < allActors.length; i += batchSize) {
      const batch = allActors.slice(i, i + batchSize);
      const serialized = await Promise.all(
        batch.map(actor => this.serializeActor(actor, true))
      );
      actors.push(...serialized);

      // 진행률 표시
      const progress = Math.min(100, Math.round(((i + batch.length) / allActors.length) * 100));
      console.log(`[MCP Bridge] Progress: ${progress}% (${i + batch.length}/${allActors.length})`);
    }

    this.sendToMCP('sync_all', { actors });
    console.log(`[MCP Bridge] Synced ${actors.length} actors with images`);
  }

  /**
   * Hook 등록
   */
  static registerHooks() {
    // Actor 생성
    Hooks.on('createActor', async (actor, options, userId) => {
      const data = await this.serializeActor(actor, true);
      this.actorCache.set(actor.id, data);
      this.sendToMCP('actor_created', data);
      console.log(`[MCP Bridge] Actor created: ${actor.name}`);
    });

    // Actor 업데이트
    Hooks.on('updateActor', async (actor, changes, options, userId) => {
      // 이미지가 변경되었는지 확인
      const imageChanged = changes.img || changes.prototypeToken?.texture?.src;

      const data = await this.serializeActor(actor, imageChanged);
      this.actorCache.set(actor.id, data);
      this.sendToMCP('actor_updated', {
        id: actor.id,
        changes,
        fullData: data
      });

      if (imageChanged) {
        console.log(`[MCP Bridge] Actor updated with new image: ${actor.name}`);
      } else {
        console.log(`[MCP Bridge] Actor updated: ${actor.name}`);
      }
    });

    // Actor 삭제
    Hooks.on('deleteActor', (actor, options, userId) => {
      this.actorCache.delete(actor.id);
      this.sendToMCP('actor_deleted', { id: actor.id, name: actor.name });
      console.log(`[MCP Bridge] Actor deleted: ${actor.name}`);
    });

    // Item 생성 (Actor에 아이템 추가)
    Hooks.on('createItem', (item, options, userId) => {
      if (item.parent?.documentName === 'Actor') {
        const actor = item.parent;
        // 아이템 추가는 이미지 재전송 불필요
        this.serializeActor(actor, false).then(data => {
          this.actorCache.set(actor.id, data);
          this.sendToMCP('actor_item_added', {
            actorId: actor.id,
            actorName: actor.name,
            item: {
              id: item.id,
              name: item.name,
              type: item.type,
              img: item.img,
            }
          });
        });
      }
    });

    // Item 삭제
    Hooks.on('deleteItem', (item, options, userId) => {
      if (item.parent?.documentName === 'Actor') {
        const actor = item.parent;
        this.serializeActor(actor, false).then(data => {
          this.actorCache.set(actor.id, data);
          this.sendToMCP('actor_item_removed', {
            actorId: actor.id,
            actorName: actor.name,
            itemId: item.id,
            itemName: item.name,
          });
        });
      }
    });

    // Combat 시작
    Hooks.on('combatStart', (combat, updateData) => {
      const combatants = combat.combatants.map(c => ({
        actorId: c.actor.id,
        actorName: c.actor.name,
        actorImg: c.actor.img,
        initiative: c.initiative,
      }));

      this.sendToMCP('combat_started', {
        combatId: combat.id,
        combatants,
      });
    });

    // Combat 턴 변경
    Hooks.on('combatTurn', (combat, updateData, updateOptions) => {
      const current = combat.combatant;
      this.sendToMCP('combat_turn', {
        combatId: combat.id,
        currentTurn: combat.turn,
        currentCombatant: {
          actorId: current.actor.id,
          actorName: current.actor.name,
          actorImg: current.actor.img,
          initiative: current.initiative,
        }
      });
    });

    // Chat Message (주사위 굴리기 등)
    Hooks.on('createChatMessage', (message, options, userId) => {
      if (message.rolls?.length > 0) {
        const roll = message.rolls[0];
        this.sendToMCP('dice_rolled', {
          actor: message.speaker.alias,
          actorId: message.speaker.actor,
          formula: roll.formula,
          total: roll.total,
          result: roll.result,
        });
      }
    });

    console.log('[MCP Bridge] Hooks registered');
  }

  /**
   * 설정 등록
   */
  static registerSettings() {
    game.settings.register('mcp-bridge', 'includeImages', {
      name: 'Include Actor Images',
      hint: 'Send actor portrait images to MCP server (increases bandwidth)',
      scope: 'world',
      config: true,
      type: Boolean,
      default: true,
    });

    game.settings.register('mcp-bridge', 'wsUrl', {
      name: 'WebSocket URL',
      hint: 'MCP server WebSocket URL',
      scope: 'world',
      config: true,
      type: String,
      default: 'ws://localhost:3001',
    });
  }

  /**
   * 초기화
   */
  static init() {
    console.log('[MCP Bridge] Initializing...');
    this.registerSettings();

    // 설정에서 URL 가져오기
    this.WS_URL = game.settings.get('mcp-bridge', 'wsUrl');

    this.connectWebSocket();
    this.registerHooks();
  }
}

// Foundry 초기화 시 설정 등록
Hooks.once('init', () => {
  MCPBridge.registerSettings();
});

// Foundry 준비 완료 시 실행
Hooks.once('ready', () => {
  MCPBridge.init();
});

// 전역 접근 (디버깅용)
window.MCPBridge = MCPBridge;
