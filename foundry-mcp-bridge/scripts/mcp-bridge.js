/**
 * Foundry VTT → MCP Bridge
 * Hook 기반으로 Actor 데이터를 MCP 서버로 전송
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
   * Actor 데이터 직렬화
   */
  static serializeActor(actor) {
    return {
      id: actor.id,
      name: actor.name,
      type: actor.type,
      img: actor.img,

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
  }

  /**
   * 모든 Actor 동기화
   */
  static syncAllActors() {
    const actors = game.actors.map(a => this.serializeActor(a));
    this.sendToMCP('sync_all', { actors });
    console.log(`[MCP Bridge] Synced ${actors.length} actors`);
  }

  /**
   * Hook 등록
   */
  static registerHooks() {
    // Actor 생성
    Hooks.on('createActor', (actor, options, userId) => {
      const data = this.serializeActor(actor);
      this.actorCache.set(actor.id, data);
      this.sendToMCP('actor_created', data);
      console.log(`[MCP Bridge] Actor created: ${actor.name}`);
    });

    // Actor 업데이트
    Hooks.on('updateActor', (actor, changes, options, userId) => {
      const data = this.serializeActor(actor);
      this.actorCache.set(actor.id, data);
      this.sendToMCP('actor_updated', {
        id: actor.id,
        changes,
        fullData: data
      });
      console.log(`[MCP Bridge] Actor updated: ${actor.name}`);
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
        const data = this.serializeActor(actor);
        this.actorCache.set(actor.id, data);
        this.sendToMCP('actor_item_added', {
          actorId: actor.id,
          actorName: actor.name,
          item: {
            id: item.id,
            name: item.name,
            type: item.type,
          }
        });
      }
    });

    // Item 삭제
    Hooks.on('deleteItem', (item, options, userId) => {
      if (item.parent?.documentName === 'Actor') {
        const actor = item.parent;
        const data = this.serializeActor(actor);
        this.actorCache.set(actor.id, data);
        this.sendToMCP('actor_item_removed', {
          actorId: actor.id,
          actorName: actor.name,
          itemId: item.id,
          itemName: item.name,
        });
      }
    });

    // Combat 시작
    Hooks.on('combatStart', (combat, updateData) => {
      const combatants = combat.combatants.map(c => ({
        actorId: c.actor.id,
        actorName: c.actor.name,
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
          formula: roll.formula,
          total: roll.total,
          result: roll.result,
        });
      }
    });

    console.log('[MCP Bridge] Hooks registered');
  }

  /**
   * 초기화
   */
  static init() {
    console.log('[MCP Bridge] Initializing...');
    this.connectWebSocket();
    this.registerHooks();
  }
}

// Foundry 준비 완료 시 실행
Hooks.once('ready', () => {
  MCPBridge.init();
});

// 전역 접근 (디버깅용)
window.MCPBridge = MCPBridge;
