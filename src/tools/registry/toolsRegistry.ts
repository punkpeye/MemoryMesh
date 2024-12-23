// src/tools/registry/toolsRegistry.ts

import {allStaticTools} from './staticTools.js';
import {dynamicToolManager} from './dynamicTools.js';
import {formatToolError} from '../../utils/responseFormatter.js';
import type {Tool, ToolResponse} from '../../types/tools.js';
import type {KnowledgeGraphManager} from '../../core/KnowledgeGraphManager.js';

/**
 * Central registry for all tools (both static and dynamic)
 */
export class ToolsRegistry {
    private static instance: ToolsRegistry;
    private initialized = false;
    private tools: Map<string, Tool> = new Map();
    private knowledgeGraphManager: KnowledgeGraphManager | null = null;

    private constructor() {
    }

    /**
     * Gets the singleton instance of ToolsRegistry
     */
    static getInstance(): ToolsRegistry {
        if (!ToolsRegistry.instance) {
            ToolsRegistry.instance = new ToolsRegistry();
        }
        return ToolsRegistry.instance;
    }

    /**
     * Initializes the registry with both static and dynamic tools
     */
    async initialize(knowledgeGraphManager: KnowledgeGraphManager): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            this.knowledgeGraphManager = knowledgeGraphManager;

            // Register static tools
            allStaticTools.forEach(tool => {
                this.tools.set(tool.name, tool);
            });

            // Initialize and register dynamic tools
            await dynamicToolManager.initialize();
            dynamicToolManager.getTools().forEach(tool => {
                this.tools.set(tool.name, tool);
            });

            this.initialized = true;
            console.error(`[ToolsRegistry] Initialized with ${this.tools.size} tools`);
        } catch (error) {
            console.error('[ToolsRegistry] Initialization error:', error);
            throw error;
        }
    }

    /**
     * Gets a specific tool by name
     */
    getTool(name: string): Tool | undefined {
        this.ensureInitialized();
        return this.tools.get(name);
    }

    /**
     * Gets all registered tools
     */
    getAllTools(): Tool[] {
        this.ensureInitialized();
        return Array.from(this.tools.values());
    }

    /**
     * Handles a tool call by delegating to the appropriate handler
     */
    async handleToolCall(toolName: string, args: Record<string, any>): Promise<ToolResponse> {
        this.ensureInitialized();

        if (!this.knowledgeGraphManager) {
            return formatToolError({
                operation: toolName,
                error: 'KnowledgeGraphManager not initialized',
                suggestions: ['Ensure registry is properly initialized with KnowledgeGraphManager']
            });
        }

        try {
            if (!this.tools.has(toolName)) {
                throw new Error(`Tool not found: ${toolName}`);
            }

            if (dynamicToolManager.isDynamicTool(toolName)) {
                return await dynamicToolManager.handleToolCall(
                    toolName,
                    args,
                    this.knowledgeGraphManager
                );
            }

            // For static tools, the handler will be determined by the ToolHandlerFactory
            // This preserves existing behavior while providing a unified interface
            return {
                toolResult: {
                    isError: false,
                    content: [],
                    data: args,
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            return formatToolError({
                operation: toolName,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
                context: {args},
                suggestions: ['Verify the tool name and arguments are correct']
            });
        }
    }

    /**
     * Checks if a specific tool exists
     */
    hasTool(name: string): boolean {
        this.ensureInitialized();
        return this.tools.has(name);
    }

    /**
     * Ensures the registry is initialized before use
     */
    private ensureInitialized(): void {
        if (!this.initialized) {
            throw new Error('Tools registry not initialized');
        }
    }
}

/**
 * Singleton instance of the ToolsRegistry
 */
export const toolsRegistry = ToolsRegistry.getInstance();

/**
 * Re-export types that might be needed by consumers
 */
export type {
    Tool,
    ToolResponse,
    KnowledgeGraphManager
};