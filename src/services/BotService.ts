import { Types } from 'mongoose';
import Bot, { IBot, IBotFlow } from '../models/Bot';
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
      // Find active bot for this session
      const bot = await Bot.findOne({
        userId: context.userId,
        sessionId: context.sessionId,
        isActive: true
      });

      if (!bot) {
        logger.debug('No active bot found for session');
        return false;
      }

      // Check if bot should respond in groups
      if (context.isGroup && !bot.settings.enableInGroups) {
        return false;
      }

      // Check working hours
      if (!this.isWithinWorkingHours(bot)) {
        return false;
      }

      // Find matching flow
      const matchedFlow = this.findMatchingFlow(bot, context.messageBody);

      if (matchedFlow) {
        await this.executeFlow(bot, matchedFlow, context);
        await this.updateBotAnalytics(bot._id);
        return true;
      }

      // Try AI fallback if no flow matched
      if (bot.settings.fallbackMessage || process.env.AI_ENABLED === 'true') {
        await this.handleFallback(bot, context);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error processing bot message:', error);
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
      logger.error('Error executing bot flow:', error);
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
      logger.error('Error handling fallback:', error);
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
      logger.error('Error getting AI response:', error);
      return null;
    }
  }

  /**
   * Get response from Google Gemini AI
   */
  private async getGeminiResponse(query: string, apiKey: string, context: BotContext): Promise<string | null> {
    try {
      const model = process.env.AI_MODEL || 'gemini-pro';
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      // Get conversation context
      const conversationHistory = this.getConversationContext(context.chatId);
      
      // Build prompt with context
      const systemPrompt = process.env.AI_SYSTEM_PROMPT || 
        'You are a helpful WhatsApp assistant. Provide concise, friendly responses. Keep answers under 500 characters.';
      
      const fullPrompt = `${systemPrompt}\n\nUser: ${query}`;

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
        timeout: 10000
      });

      if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        const aiResponse = response.data.candidates[0].content.parts[0].text;
        
        // Store in conversation context
        this.updateConversationContext(context.chatId, query, aiResponse);
        
        return aiResponse;
      }

      return null;
    } catch (error) {
      logger.error('Error getting Gemini response:', error);
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
      logger.error('Error getting OpenAI response:', error);
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
      logger.error('Error updating bot analytics:', error);
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
      const existingBot = await Bot.findOne({ userId, sessionId });

      if (existingBot) {
        Object.assign(existingBot, botData);
        await existingBot.save();
        return existingBot;
      }

      const newBot = new Bot({
        userId,
        sessionId,
        ...botData
      });

      await newBot.save();
      return newBot;
    } catch (error) {
      logger.error('Error saving bot:', error);
      throw error;
    }
  }

  /**
   * Get bot by session
   */
  async getBotBySession(userId: string, sessionId: string): Promise<IBot | null> {
    try {
      return await Bot.findOne({ userId, sessionId });
    } catch (error) {
      logger.error('Error getting bot:', error);
      return null;
    }
  }

  /**
   * Get all bots for user
   */
  async getUserBots(userId: string): Promise<IBot[]> {
    try {
      return await Bot.find({ userId }).populate('sessionId', 'sessionId phoneNumber');
    } catch (error) {
      logger.error('Error getting user bots:', error);
      return [];
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
      logger.error('Error deleting bot:', error);
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
      logger.error('Error toggling bot status:', error);
      return false;
    }
  }
}

export default new BotService();

