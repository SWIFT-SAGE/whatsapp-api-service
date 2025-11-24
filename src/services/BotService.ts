import mongoose, { Types } from 'mongoose';
import Bot, { IBot, IBotFlow } from '../models/Bot';
import WhatsappSession from '../models/WhatsappSession';
import WhatsAppService from './whatsappService';
import { logger } from '../utils/logger';
import axios from 'axios';

interface BotContext {
  userId: string;
  sessionId: string;
  chatId: string;
  messageBody: string;
  isGroup: boolean;
  contactName?: string;
}

interface AIConfig {
  enabled: boolean;
  provider: 'openai' | 'gemini' | 'custom';
  apiKey?: string;
  model?: string;
  endpoint?: string;
  prompt?: string;
}

class BotService {
  private conversationContext: Map<string, any> = new Map();

  /**
   * Process incoming message through bot
   */
  async processMessage(context: BotContext): Promise<boolean> {
    try {
      logger.info('Processing message:', {
        userId: context.userId,
        sessionId: context.sessionId,
        messageBody: context.messageBody,
        chatId: context.chatId
      });

      // Find active bot for this session
      // The sessionId in context can be either _id or sessionId field
      let bot = await Bot.findOne({
        userId: context.userId,
        sessionId: context.sessionId,
        isActive: true
      });

      logger.debug('Bot found by direct sessionId lookup:', !!bot);

      // If not found by sessionId (_id), try finding by legacy sessionId string
      if (!bot) {
        // Try to find session by sessionId field first
        const session = await WhatsappSession.findOne({
          userId: context.userId,
          sessionId: context.sessionId
        });

        logger.debug('Session found by sessionId field:', !!session);

        if (session) {
          bot = await Bot.findOne({
            userId: context.userId,
            sessionId: session._id,
            isActive: true
          });
          logger.debug('Bot found by session._id lookup:', !!bot);
        }
      }

      if (!bot) {
        logger.debug('No active bot found for session');
        return false;
      }

      logger.info('Bot found and active:', {
        botId: bot._id,
        botName: bot.name,
        flows: bot.flows?.length || 0,
        aiEnabled: bot.aiConfig?.enabled || false
      });

      // Check if bot should respond in groups
      if (context.isGroup && !bot.settings.enableInGroups) {
        logger.debug('Bot disabled for groups, skipping');
        return false;
      }

      // Check working hours
      if (!this.isWithinWorkingHours(bot)) {
        logger.debug('Outside working hours, skipping');
        return false;
      }

      // Determine bot mode
      const aiMode = bot.aiConfig?.mode || 'flows_only';
      logger.debug('Bot mode:', aiMode);

      // AI-ONLY MODE: Skip flows, use AI directly
      if (aiMode === 'ai_only' && bot.aiConfig?.enabled) {
        logger.info('Using AI-only mode');
        const aiResponse = await this.getAIResponseForBot(bot, context.messageBody, context);
        if (aiResponse) {
          await WhatsAppService.sendMessage(context.sessionId, context.chatId, aiResponse);
          await this.updateBotAnalytics(bot._id);
          return true;
        }

        // If AI fails, use fallback
        if (bot.settings.fallbackMessage) {
          const message = this.replaceVariables(bot.settings.fallbackMessage, context);
          await WhatsAppService.sendMessage(context.sessionId, context.chatId, message);
          return true;
        }

        return false;
      }

      // FLOWS MODE or HYBRID MODE: Try flows first
      logger.debug('Attempting to match flows');
      const matchedFlow = this.findMatchingFlow(bot, context.messageBody);

      if (matchedFlow) {
        logger.info('Flow matched:', { flowId: matchedFlow.id, flowName: matchedFlow.name });
        await this.executeFlow(bot, matchedFlow, context);
        await this.updateBotAnalytics(bot._id);
        return true;
      }

      logger.debug('No flow matched');

      // HYBRID MODE: If no flow matched, try AI
      if (aiMode === 'hybrid' && bot.aiConfig?.enabled) {
        logger.info('Using AI fallback in hybrid mode');
        const aiResponse = await this.getAIResponseForBot(bot, context.messageBody, context);
        if (aiResponse) {
          await WhatsAppService.sendMessage(context.sessionId, context.chatId, aiResponse);
          await this.updateBotAnalytics(bot._id);
          return true;
        }
      }

      // Try fallback message if no flow matched and AI didn't respond
      if (bot.settings.fallbackMessage) {
        logger.debug('Using fallback message');
        await this.handleFallback(bot, context);
        return true;
      }

      logger.debug('No response sent');
      return false;

    } catch (error) {
      logger.error('Error processing bot message:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        chatId: context.chatId,
        userId: context.userId,
        sessionId: context.sessionId,
        stack: error instanceof Error ? error.stack : undefined
      });
      return false;
    }
  }

  /**
   * Find matching flow based on message
   */
  private findMatchingFlow(bot: IBot, messageBody: string): IBotFlow | null {
    for (const flow of bot.flows) {
      if (!flow.isActive) continue;

      const { trigger } = flow;
      let message = messageBody;
      let triggerValue = trigger.value;

      if (!trigger.caseSensitive) {
        message = message.toLowerCase();
        triggerValue = triggerValue.toLowerCase();
      }

      switch (trigger.type) {
        case 'keyword':
          if (message === triggerValue || message.includes(triggerValue)) {
            return flow;
          }
          break;
        case 'menu':
          if (message === triggerValue) {
            return flow;
          }
          break;
      }
    }

    // Check default flow
    if (bot.defaultFlow && bot.defaultFlow.isActive) {
      return bot.defaultFlow;
    }

    return null;
  }

  /**
   * Execute bot flow
   */
  private async executeFlow(bot: IBot, flow: IBotFlow, context: BotContext): Promise<void> {
    try {
      for (const response of flow.responses) {
        // Apply delay if specified
        if (response.delay && response.delay > 0) {
          await this.delay(response.delay);
        }

        // Replace variables in content
        let content = response.content || '';
        content = this.replaceVariables(content, context);

        switch (response.type) {
          case 'text':
            await WhatsAppService.sendMessage(context.sessionId, context.chatId, content);
            break;

          case 'image':
          case 'video':
          case 'audio':
          case 'document':
            if (response.mediaUrl) {
              await WhatsAppService.sendMediaFromUrl(
                context.sessionId,
                context.chatId,
                response.mediaUrl,
                content
              );
            }
            break;

          case 'menu':
            if (response.menuOptions && response.menuOptions.length > 0) {
              const menuText = this.formatMenuOptions(content, response.menuOptions);
              await WhatsAppService.sendMessage(context.sessionId, context.chatId, menuText);
            }
            break;
        }
      }

      // Check for next flow
      if (flow.nextFlowId) {
        const nextFlow = bot.flows.find(f => f.id === flow.nextFlowId);
        if (nextFlow && nextFlow.isActive) {
          await this.delay(1000); // Small delay before next flow
          await this.executeFlow(bot, nextFlow, context);
        }
      }
    } catch (error) {
      logger.error('Error executing bot flow:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        flowId: flow.id
      });
      throw error;
    }
  }

  /**
   * Handle fallback with AI or default message
   */
  private async handleFallback(bot: IBot, context: BotContext): Promise<void> {
    try {
      // Try AI response first
      if (process.env.AI_ENABLED === 'true') {
        const aiResponse = await this.getAIResponse(context.messageBody, context);
        if (aiResponse) {
          await WhatsAppService.sendMessage(context.sessionId, context.chatId, aiResponse);
          return;
        }
      }

      // Use fallback message
      if (bot.settings.fallbackMessage) {
        const message = this.replaceVariables(bot.settings.fallbackMessage, context);
        await WhatsAppService.sendMessage(context.sessionId, context.chatId, message);
      }
    } catch (error) {
      logger.error('Error handling fallback:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        botId: bot._id
      });
    }
  }

  /**
   * Get AI-generated response
   */
  private async getAIResponse(query: string, context: BotContext): Promise<string | null> {
    try {
      const provider = process.env.AI_PROVIDER || 'gemini';
      const apiKey = process.env.AI_API_KEY;

      if (!apiKey) {
        logger.warn('AI API key not configured');
        return null;
      }

      switch (provider) {
        case 'gemini':
          return await this.getGeminiResponse(query, apiKey, context);
        case 'openai':
          return await this.getOpenAIResponse(query, apiKey, context);
        default:
          logger.warn(`Unsupported AI provider: ${provider}`);
          return null;
      }
    } catch (error) {
      logger.error('Error getting AI response:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        provider: process.env.AI_PROVIDER || 'gemini'
      });
      return null;
    }
  }

  /**
   * Get AI-generated response using bot's custom configuration
   */
  private async getAIResponseForBot(bot: IBot, query: string, context: BotContext): Promise<string | null> {
    try {
      if (!bot.aiConfig?.enabled) {
        return null;
      }

      const provider = bot.aiConfig.provider || 'gemini';
      const apiKey = bot.aiConfig.apiKey || process.env.AI_API_KEY;

      if (!apiKey) {
        logger.warn('AI API key not configured for bot:', { botId: bot._id.toString() });
        return null;
      }

      const model = bot.aiConfig.model || (provider === 'gemini' ? 'gemini-1.5-flash' : 'gpt-3.5-turbo');
      const temperature = bot.aiConfig.temperature !== undefined ? bot.aiConfig.temperature : 0.7;
      const maxTokens = bot.aiConfig.maxTokens || 500;

      // Build system prompt from bot's purpose and custom prompt
      let systemPrompt = '';
      if (bot.purpose) {
        systemPrompt = `You are a WhatsApp bot for ${bot.purpose}. `;
      }
      if (bot.aiConfig.systemPrompt) {
        systemPrompt += bot.aiConfig.systemPrompt;
      }
      if (!systemPrompt) {
        systemPrompt = 'You are a helpful WhatsApp assistant. Provide concise, friendly responses.';
      }

      logger.debug('Getting AI response for bot:', {
        botId: bot._id.toString(),
        provider,
        model,
        purpose: bot.purpose
      });

      // Use provider-specific method with custom config
      if (provider === 'gemini') {
        return await this.getGeminiResponseWithConfig(query, apiKey, model, systemPrompt, temperature, maxTokens, context);
      } else if (provider === 'openai') {
        return await this.getOpenAIResponseWithConfig(query, apiKey, model, systemPrompt, temperature, maxTokens, context);
      }

      return null;
    } catch (error) {
      logger.error('Error getting AI response for bot:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        botId: bot._id.toString()
      });
      return null;
    }
  }

  /**
   * Get response from Google Gemini AI
   */
  private async getGeminiResponse(query: string, apiKey: string, context: BotContext): Promise<string | null> {
    try {
      // Validate API key
      if (!apiKey || apiKey.trim() === '') {
        logger.warn('Gemini API key is missing or empty');
        return null;
      }

      const model = process.env.AI_MODEL || 'gemini-1.5-flash';
      const endpoint = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;

      // Get conversation context
      const conversationHistory = this.getConversationContext(context.chatId);

      // Build prompt with context
      const systemPrompt = process.env.AI_SYSTEM_PROMPT ||
        'You are a helpful WhatsApp assistant. Provide concise, friendly responses. Keep answers under 500 characters.';

      const fullPrompt = `${systemPrompt}\n\nUser: ${query}`;

      logger.debug('Calling Gemini API', { model, chatId: context.chatId });

      const response = await axios.post(endpoint, {
        contents: [{
          parts: [{
            text: fullPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
          topP: 0.8,
          topK: 40
        }
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        const aiResponse = response.data.candidates[0].content.parts[0].text;

        // Store in conversation context
        this.updateConversationContext(context.chatId, query, aiResponse);

        return aiResponse;
      }

      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const statusCode = (error as any)?.response?.status;
      const statusText = (error as any)?.response?.statusText;
      const responseData = (error as any)?.response?.data;

      logger.error('Error getting Gemini response:', {
        message: errorMessage,
        status: statusCode,
        statusText: statusText,
        responseData: responseData ? JSON.stringify(responseData).substring(0, 200) : undefined,
        isAxiosError: (error as any)?.isAxiosError || false,
        hint: statusCode === 404 ? 'Check AI_MODEL in .env (use gemini-1.5-flash or gemini-1.5-pro)' :
          statusCode === 400 ? 'Check GEMINI_API_KEY in .env' :
            statusCode === 429 ? 'Rate limit exceeded' : undefined
      });
      return null;
    }
  }

  /**
   * Get response from OpenAI
   */
  private async getOpenAIResponse(query: string, apiKey: string, context: BotContext): Promise<string | null> {
    try {
      const model = process.env.AI_MODEL || 'gpt-3.5-turbo';
      const endpoint = 'https://api.openai.com/v1/chat/completions';

      const systemPrompt = process.env.AI_SYSTEM_PROMPT ||
        'You are a helpful WhatsApp assistant. Provide concise, friendly responses. Keep answers under 500 characters.';

      const response = await axios.post(endpoint, {
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        max_tokens: 500,
        temperature: 0.7
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 10000
      });

      if (response.data?.choices?.[0]?.message?.content) {
        const aiResponse = response.data.choices[0].message.content;
        this.updateConversationContext(context.chatId, query, aiResponse);
        return aiResponse;
      }

      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const statusCode = (error as any)?.response?.status;

      logger.error('Error getting OpenAI response:', {
        message: errorMessage,
        status: statusCode,
        isAxiosError: (error as any)?.isAxiosError || false
      });
      return null;
    }
  }

  /**
   * Get response from Gemini with custom configuration
   */
  private async getGeminiResponseWithConfig(
    query: string,
    apiKey: string,
    model: string,
    systemPrompt: string,
    temperature: number,
    maxTokens: number,
    context: BotContext
  ): Promise<string | null> {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
      const fullPrompt = `${systemPrompt}\n\nUser: ${query}`;

      const response = await axios.post(endpoint, {
        contents: [{
          parts: [{
            text: fullPrompt
          }]
        }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          topP: 0.8,
          topK: 40
        }
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        const aiResponse = response.data.candidates[0].content.parts[0].text;
        this.updateConversationContext(context.chatId, query, aiResponse);
        return aiResponse;
      }

      return null;
    } catch (error) {
      logger.error('Error getting Gemini response with config:', error);
      return null;
    }
  }

  /**
   * Get response from OpenAI with custom configuration
   */
  private async getOpenAIResponseWithConfig(
    query: string,
    apiKey: string,
    model: string,
    systemPrompt: string,
    temperature: number,
    maxTokens: number,
    context: BotContext
  ): Promise<string | null> {
    try {
      const endpoint = 'https://api.openai.com/v1/chat/completions';

      const response = await axios.post(endpoint, {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        max_tokens: maxTokens,
        temperature
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 10000
      });

      if (response.data?.choices?.[0]?.message?.content) {
        const aiResponse = response.data.choices[0].message.content;
        this.updateConversationContext(context.chatId, query, aiResponse);
        return aiResponse;
      }

      return null;
    } catch (error) {
      logger.error('Error getting OpenAI response with config:', error);
      return null;
    }
  }

  /**
   * Replace variables in message
   */
  private replaceVariables(content: string, context: BotContext): string {
    return content
      .replace(/\{name\}/g, context.contactName || 'there')
      .replace(/\{time\}/g, new Date().toLocaleTimeString())
      .replace(/\{date\}/g, new Date().toLocaleDateString())
      .replace(/\{day\}/g, new Date().toLocaleDateString('en-US', { weekday: 'long' }));
  }

  /**
   * Format menu options
   */
  private formatMenuOptions(header: string, options: Array<{ id: string; title: string; description?: string }>): string {
    let menu = `${header}\n\n`;
    options.forEach((option, index) => {
      menu += `${index + 1}. ${option.title}`;
      if (option.description) {
        menu += `\n   ${option.description}`;
      }
      menu += '\n\n';
    });
    return menu.trim();
  }

  /**
   * Check if current time is within working hours
   */
  private isWithinWorkingHours(bot: IBot): boolean {
    if (!bot.settings.workingHours?.enabled) {
      return true;
    }

    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM

    const { days, start, end } = bot.settings.workingHours;

    if (!days || !days.includes(currentDay)) {
      return false;
    }

    if (start && end) {
      return currentTime >= start && currentTime <= end;
    }

    return true;
  }

  /**
   * Get conversation context
   */
  private getConversationContext(chatId: string): any[] {
    return this.conversationContext.get(chatId) || [];
  }

  /**
   * Update conversation context
   */
  private updateConversationContext(chatId: string, query: string, response: string): void {
    const context = this.getConversationContext(chatId);
    context.push({ query, response, timestamp: new Date() });

    // Keep only last 5 exchanges
    if (context.length > 5) {
      context.shift();
    }

    this.conversationContext.set(chatId, context);
  }

  /**
   * Update bot analytics
   */
  private async updateBotAnalytics(botId: Types.ObjectId): Promise<void> {
    try {
      await Bot.findByIdAndUpdate(botId, {
        $inc: {
          'analytics.totalMessages': 1
        },
        $set: {
          'analytics.lastUsed': new Date()
        }
      });
    } catch (error) {
      logger.error('Error updating bot analytics:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        botId: botId.toString()
      });
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
  * Create or update bot
  */
  async saveBot(userId: string, sessionId: string, botData: Partial<IBot>): Promise<IBot> {
    try {
      // The sessionId parameter can be either:
      // 1. A session's _id (ObjectId as string) - from frontend
      // 2. A session's sessionId field (string) - legacy

      // Try to find session by _id first
      let session = await WhatsappSession.findById(sessionId);

      // If not found by _id, try finding by sessionId field
      if (!session) {
        session = await WhatsappSession.findOne({ userId, sessionId });
      }

      if (!session) {
        throw new Error('WhatsApp session not found');
      }

      // Always use the session's _id for bot storage
      const existingBot = await Bot.findOne({ userId, sessionId: session._id });

      if (existingBot) {
        Object.assign(existingBot, botData);
        existingBot.sessionId = session._id;
        await existingBot.save();
        return existingBot;
      }

      const newBot = new Bot({
        userId,
        sessionId: session._id,
        ...botData
      });

      await newBot.save();
      return newBot;
    } catch (error) {
      logger.error('Error saving bot:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        userId: userId,
        sessionId: sessionId
      });
      throw error;
    }
  }


  /**
  * Get bot by session
  */
  async getBotBySession(userId: string, sessionId: string): Promise<IBot | null> {
    try {
      // Try to find session by _id first
      let session = await WhatsappSession.findById(sessionId);

      // If not found by _id, try finding by sessionId field
      if (!session) {
        session = await WhatsappSession.findOne({ userId, sessionId });
      }

      if (!session) {
        return null;
      }

      return await Bot.findOne({ userId, sessionId: session._id });
    } catch (error) {
      logger.error('Error getting bot:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        sessionId: sessionId
      });
      return null;
    }
  }


  /**
   * Get all bots for user
   */
  async getUserBots(userId: string): Promise<IBot[]> {
    try {
      // First, perform a self-healing check for bots with broken references
      const rawBots = await Bot.find({ userId });

      for (const bot of rawBots) {
        // Check if the referenced session exists
        const sessionExists = await WhatsappSession.exists({ _id: bot.sessionId });

        if (!sessionExists) {
          // If not found by _id, try to find by sessionId string (legacy/bugged reference)
          const rawId = bot.sessionId.toString();
          const session = await WhatsappSession.findOne({ sessionId: rawId });

          if (session) {
            logger.info('Repairing bot with wrong sessionId reference', {
              botId: bot._id.toString(),
              oldId: rawId,
              newId: session._id.toString()
            });

            bot.sessionId = session._id;
            await bot.save();
          }
        }
      }

      // Now fetch properly populated bots
      const bots = await Bot.find({ userId }).populate('sessionId', 'sessionId phoneNumber');

      // Filter out bots with null/deleted sessions and log them
      const validBots = bots.filter(bot => {
        if (!bot.sessionId) {
          logger.warn('Bot has null sessionId (orphaned bot):', {
            botId: bot._id.toString(),
            botName: bot.name,
            userId: userId.toString()
          });
          return false;
        }
        return true;
      });

      return validBots;
    } catch (error) {
      logger.error('Error getting user bots:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        userId: userId.toString()
      });
      return [];
    }
  }

  /**
   * Clean up orphaned bots (bots with deleted/null sessions)
   */
  async cleanupOrphanedBots(userId: string): Promise<number> {
    try {
      const bots = await Bot.find({ userId });
      let deletedCount = 0;

      for (const bot of bots) {
        // Check if sessionId exists in WhatsappSession collection
        const session = await WhatsappSession.findById(bot.sessionId);

        if (!session) {
          await Bot.findByIdAndDelete(bot._id);
          deletedCount++;
          logger.info('Deleted orphaned bot:', {
            botId: bot._id.toString(),
            botName: bot.name,
            userId: userId.toString()
          });
        }
      }

      return deletedCount;
    } catch (error) {
      logger.error('Error cleaning up orphaned bots:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        userId: userId.toString()
      });
      throw error;
    }
  }

  /**
   * Delete bot
   */
  async deleteBot(userId: string, botId: string): Promise<boolean> {
    try {
      const result = await Bot.findOneAndDelete({ _id: botId, userId });
      return !!result;
    } catch (error) {
      logger.error('Error deleting bot:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        botId: botId.toString()
      });
      return false;
    }
  }

  /**
   * Toggle bot status
   */
  async toggleBotStatus(userId: string, botId: string, isActive: boolean): Promise<boolean> {
    try {
      const result = await Bot.findOneAndUpdate(
        { _id: botId, userId },
        { isActive },
        { new: true }
      );
      return !!result;
    } catch (error) {
      logger.error('Error toggling bot status:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        botId: botId.toString()
      });
      return false;
    }
  }
}

export default new BotService();

