#!/usr/bin/env node

/**
 * MCP Server with WebSocket bridge for Foundry VTT
 * Foundry → WebSocket → MCP Server → Claude
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { WebSocketServer } from 'ws';

class FoundryMCPServer {
  constructor() {
    // Actor 데이터 캐시
    this.actors = new Map();

    // MCP 서버
    this.server = new Server(
      {
        name: 'foundry-vtt-live',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupMCPHandlers();
    this.setupWebSocket();
  }

  /**
   * WebSocket 서버 설정
   */
  setupWebSocket() {
    this.wss = new WebSocketServer({ port: 3001 });

    this.wss.on('connection', (ws) => {
      console.error('[WS] Foundry connected');

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleFoundryEvent(message);
        } catch (error) {
          console.error('[WS] Parse error:', error);
        }
      });

      ws.on('close', () => {
        console.error('[WS] Foundry disconnected');
      });
    });

    console.error('[WS] WebSocket server listening on port 3001');
  }

  /**
   * Foundry 이벤트 처리
   */
  handleFoundryEvent(message) {
    const { event, data } = message;

    switch (event) {
      case 'sync_all':
        // 모든 Actor 동기화
        this.actors.clear();
        data.actors.forEach(actor => {
          this.actors.set(actor.id, actor);
        });
        console.error(`[Sync] Loaded ${data.actors.length} actors`);
        break;

      case 'actor_created':
      case 'actor_updated':
        this.actors.set(data.id, data);
        console.error(`[Actor] ${event}: ${data.name}`);
        break;

      case 'actor_deleted':
        this.actors.delete(data.id);
        console.error(`[Actor] Deleted: ${data.name}`);
        break;

      case 'actor_item_added':
        console.error(`[Item] Added to ${data.actorName}: ${data.item.name}`);
        break;

      case 'combat_started':
        console.error(`[Combat] Started with ${data.combatants.length} combatants`);
        break;

      case 'combat_turn':
        console.error(`[Combat] Turn: ${data.currentCombatant.actorName}`);
        break;

      case 'dice_rolled':
        console.error(`[Dice] ${data.actor} rolled ${data.formula}: ${data.total}`);
        break;
    }
  }

  /**
   * MCP 핸들러 설정
   */
  setupMCPHandlers() {
    // 도구 목록
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'list_actors',
          description: 'List all actors currently loaded in Foundry VTT',
          inputSchema: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                description: 'Filter by actor type',
                enum: ['character', 'npc', 'all'],
                default: 'all',
              },
            },
          },
        },
        {
          name: 'get_actor',
          description: 'Get detailed information about a specific actor',
          inputSchema: {
            type: 'object',
            properties: {
              nameOrId: {
                type: 'string',
                description: 'Actor name or ID',
              },
            },
            required: ['nameOrId'],
          },
        },
        {
          name: 'get_actor_stats',
          description: 'Get combat-relevant stats for an actor',
          inputSchema: {
            type: 'object',
            properties: {
              nameOrId: {
                type: 'string',
                description: 'Actor name or ID',
              },
            },
            required: ['nameOrId'],
          },
        },
        {
          name: 'search_items',
          description: 'Search for items across all actors',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Item name to search',
              },
            },
            required: ['query'],
          },
        },
      ],
    }));

    // 도구 실행
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'list_actors':
          return this.listActors(args.type || 'all');

        case 'get_actor':
          return this.getActor(args.nameOrId);

        case 'get_actor_stats':
          return this.getActorStats(args.nameOrId);

        case 'search_items':
          return this.searchItems(args.query);

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  /**
   * Actor 찾기
   */
  findActor(nameOrId) {
    // ID로 검색
    if (this.actors.has(nameOrId)) {
      return this.actors.get(nameOrId);
    }

    // 이름으로 검색 (부분 일치)
    const query = nameOrId.toLowerCase();
    for (const actor of this.actors.values()) {
      if (actor.name.toLowerCase().includes(query)) {
        return actor;
      }
    }

    return null;
  }

  /**
   * Actor 목록
   */
  listActors(type) {
    const actors = Array.from(this.actors.values());
    const filtered = type === 'all'
      ? actors
      : actors.filter(a => a.type === type);

    const summary = filtered.map(a => ({
      name: a.name,
      type: a.type,
      level: a.system.details?.level || a.system.details?.cr || 'N/A',
      hp: `${a.system.attributes?.hp?.value || 0}/${a.system.attributes?.hp?.max || 0}`,
      ac: a.system.attributes?.ac?.value || 'N/A',
    }));

    return {
      content: [
        {
          type: 'text',
          text: `Found ${summary.length} actors:\n\n${JSON.stringify(summary, null, 2)}`,
        },
      ],
    };
  }

  /**
   * Actor 상세 정보
   */
  getActor(nameOrId) {
    const actor = this.findActor(nameOrId);
    if (!actor) {
      return {
        content: [{ type: 'text', text: `Actor not found: ${nameOrId}` }],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(actor, null, 2),
        },
      ],
    };
  }

  /**
   * Actor 전투 스탯
   */
  getActorStats(nameOrId) {
    const actor = this.findActor(nameOrId);
    if (!actor) {
      return {
        content: [{ type: 'text', text: `Actor not found: ${nameOrId}` }],
      };
    }

    const stats = {
      name: actor.name,
      type: actor.type,
      hp: {
        current: actor.system.attributes?.hp?.value,
        max: actor.system.attributes?.hp?.max,
        temp: actor.system.attributes?.hp?.temp,
      },
      ac: actor.system.attributes?.ac?.value,
      abilities: actor.system.abilities,
      proficiency: actor.system.attributes?.prof,
      speed: actor.system.attributes?.movement?.walk,
      weapons: actor.items
        .filter(i => i.type === 'weapon')
        .map(i => ({
          name: i.name,
          damage: i.system.damage,
          properties: i.system.properties,
        })),
      spells: actor.items
        .filter(i => i.type === 'spell')
        .map(i => ({
          name: i.name,
          level: i.system.level,
          school: i.system.school,
        })),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(stats, null, 2),
        },
      ],
    };
  }

  /**
   * 아이템 검색
   */
  searchItems(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();

    for (const actor of this.actors.values()) {
      for (const item of actor.items) {
        if (item.name.toLowerCase().includes(lowerQuery)) {
          results.push({
            itemName: item.name,
            itemType: item.type,
            actorName: actor.name,
            actorType: actor.type,
          });
        }
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: `Found ${results.length} items matching "${query}":\n\n${JSON.stringify(results, null, 2)}`,
        },
      ],
    };
  }

  /**
   * 서버 실행
   */
  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('[MCP] Server running on stdio');
  }
}

// 서버 시작
const server = new FoundryMCPServer();
server.run().catch(console.error);
