#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

// Foundry VTT 데이터 경로 설정
const FOUNDRY_DATA_PATH = process.env.FOUNDRY_DATA_PATH ||
  path.join(process.env.HOME, 'FoundryVTT/Data');

class FoundryMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'foundry-vtt-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupHandlers();
    this.setupErrorHandling();
  }

  setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupHandlers() {
    // 사용 가능한 도구 목록
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'list_worlds',
          description: 'List all available Foundry VTT worlds',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'list_actors',
          description: 'List all actors in a specific world',
          inputSchema: {
            type: 'object',
            properties: {
              world: {
                type: 'string',
                description: 'World name',
              },
              type: {
                type: 'string',
                description: 'Actor type (e.g., "character", "npc")',
                enum: ['character', 'npc', 'all'],
                default: 'all',
              },
            },
            required: ['world'],
          },
        },
        {
          name: 'get_actor',
          description: 'Get detailed information about a specific actor',
          inputSchema: {
            type: 'object',
            properties: {
              world: {
                type: 'string',
                description: 'World name',
              },
              actorId: {
                type: 'string',
                description: 'Actor ID or name',
              },
            },
            required: ['world', 'actorId'],
          },
        },
        {
          name: 'search_actors',
          description: 'Search actors by name or description',
          inputSchema: {
            type: 'object',
            properties: {
              world: {
                type: 'string',
                description: 'World name',
              },
              query: {
                type: 'string',
                description: 'Search query',
              },
            },
            required: ['world', 'query'],
          },
        },
      ],
    }));

    // 도구 실행
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'list_worlds':
            return await this.listWorlds();
          case 'list_actors':
            return await this.listActors(args.world, args.type);
          case 'get_actor':
            return await this.getActor(args.world, args.actorId);
          case 'search_actors':
            return await this.searchActors(args.world, args.query);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
        };
      }
    });

    // 리소스 목록
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const worlds = await this.getWorlds();
      const resources = [];

      for (const world of worlds) {
        resources.push({
          uri: `foundry://worlds/${world}`,
          name: `World: ${world}`,
          mimeType: 'application/json',
          description: `Foundry VTT world: ${world}`,
        });
      }

      return { resources };
    });

    // 리소스 읽기
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;
      const match = uri.match(/^foundry:\/\/worlds\/(.+)$/);

      if (!match) {
        throw new Error(`Invalid URI: ${uri}`);
      }

      const world = match[1];
      const actors = await this.getActorsData(world);

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(actors, null, 2),
          },
        ],
      };
    });
  }

  // 월드 목록 조회
  async getWorlds() {
    const worldsPath = path.join(FOUNDRY_DATA_PATH, 'worlds');
    try {
      const dirs = await fs.readdir(worldsPath, { withFileTypes: true });
      return dirs
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    } catch (error) {
      throw new Error(`Failed to read worlds directory: ${error.message}`);
    }
  }

  async listWorlds() {
    const worlds = await this.getWorlds();
    return {
      content: [
        {
          type: 'text',
          text: `Available worlds:\n${worlds.map((w) => `- ${w}`).join('\n')}`,
        },
      ],
    };
  }

  // Actor 데이터 읽기
  async getActorsData(world, typeFilter = 'all') {
    const actorsPath = path.join(FOUNDRY_DATA_PATH, 'worlds', world, 'data', 'actors');

    try {
      const actorFiles = await glob('*.json', { cwd: actorsPath });
      const actors = [];

      for (const file of actorFiles) {
        const filePath = path.join(actorsPath, file);
        const data = await fs.readFile(filePath, 'utf-8');
        const actor = JSON.parse(data);

        if (typeFilter === 'all' || actor.type === typeFilter) {
          actors.push(actor);
        }
      }

      return actors;
    } catch (error) {
      throw new Error(`Failed to read actors: ${error.message}`);
    }
  }

  async listActors(world, type = 'all') {
    const actors = await this.getActorsData(world, type);

    const summary = actors.map((a) => ({
      id: a._id,
      name: a.name,
      type: a.type,
      level: a.system?.details?.level || a.system?.details?.cr || 'N/A',
      hp: a.system?.attributes?.hp?.value || 'N/A',
    }));

    return {
      content: [
        {
          type: 'text',
          text: `Found ${actors.length} actors in world "${world}":\n\n${JSON.stringify(summary, null, 2)}`,
        },
      ],
    };
  }

  async getActor(world, actorIdOrName) {
    const actors = await this.getActorsData(world);
    const actor = actors.find(
      (a) => a._id === actorIdOrName || a.name.toLowerCase().includes(actorIdOrName.toLowerCase())
    );

    if (!actor) {
      throw new Error(`Actor not found: ${actorIdOrName}`);
    }

    // 중요 정보만 추출
    const summary = {
      id: actor._id,
      name: actor.name,
      type: actor.type,
      img: actor.img,
      system: actor.system,
      items: actor.items?.map((i) => ({
        name: i.name,
        type: i.type,
        description: i.system?.description?.value,
      })),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  }

  async searchActors(world, query) {
    const actors = await this.getActorsData(world);
    const results = actors.filter(
      (a) =>
        a.name.toLowerCase().includes(query.toLowerCase()) ||
        a.system?.details?.biography?.value?.toLowerCase().includes(query.toLowerCase())
    );

    return {
      content: [
        {
          type: 'text',
          text: `Found ${results.length} actors matching "${query}":\n\n${results
            .map((a) => `- ${a.name} (${a.type})`)
            .join('\n')}`,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Foundry VTT MCP server running on stdio');
  }
}

// 서버 실행
const server = new FoundryMCPServer();
server.run().catch(console.error);
