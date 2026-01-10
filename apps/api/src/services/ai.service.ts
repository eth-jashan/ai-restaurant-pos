import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaClient, OrderStatus, InvoiceStatus } from '@prisma/client';
import { INTENTS, IntentType, matchQuickPattern } from '../ai/intents';
import {
  INTENT_PARSER_SYSTEM_PROMPT,
  buildIntentParserPrompt,
} from '../ai/prompts';
import { menuService } from './menu.service';
import { AIResponse, ParsedIntent } from '../types';

const prisma = new PrismaClient();

// Initialize Gemini client (will be null if no API key)
const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

// In-memory storage for pending actions (in production, use Redis)
const pendingActions = new Map<string, () => Promise<unknown>>();

class AIService {
  // Parse user message into intent and entities
  async parseIntent(
    message: string,
    context: { restaurantId: string; userId: string }
  ): Promise<ParsedIntent> {
    // Try quick pattern matching first
    const quickMatch = matchQuickPattern(message);
    if (quickMatch) {
      return {
        intent: quickMatch.intent,
        confidence: 1.0,
        entities: quickMatch.entities,
        needsClarification: false,
      };
    }

    // If no Gemini key, return unknown intent
    if (!genAI) {
      return {
        intent: INTENTS.UNKNOWN,
        confidence: 0,
        entities: {},
        needsClarification: true,
        clarificationQuestion: 'AI features require Gemini API key configuration.',
      };
    }

    // Get restaurant context
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: context.restaurantId },
      include: {
        categories: { select: { name: true } },
      },
    });

    if (!restaurant) {
      throw new Error('Restaurant not found');
    }

    const prompt = buildIntentParserPrompt(message, {
      restaurantName: restaurant.name,
      categories: restaurant.categories.map((c) => c.name),
    });

    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 500,
          responseMimeType: 'application/json',
        },
      });

      const fullPrompt = `${INTENT_PARSER_SYSTEM_PROMPT}\n\n${prompt}`;
      const result = await model.generateContent(fullPrompt);
      const response = result.response;
      const content = response.text();

      return JSON.parse(content || '{}');
    } catch (error) {
      console.error('Gemini parsing error:', error);
      return {
        intent: INTENTS.UNKNOWN,
        confidence: 0,
        entities: {},
        needsClarification: true,
        clarificationQuestion: 'I had trouble understanding that. Could you rephrase?',
      };
    }
  }

  // Process message and generate response
  async processMessage(
    message: string,
    userId: string,
    restaurantId: string,
    conversationId?: string
  ): Promise<AIResponse> {
    const startTime = Date.now();

    // Parse intent
    const parsed = await this.parseIntent(message, { restaurantId, userId });

    // Log the message
    let conversation = conversationId
      ? await prisma.aIConversation.findUnique({ where: { id: conversationId } })
      : null;

    if (!conversation) {
      conversation = await prisma.aIConversation.create({
        data: { restaurantId, userId },
      });
    }

    await prisma.aIMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'USER',
        content: message,
        intent: parsed.intent,
        confidence: parsed.confidence,
        entities: parsed.entities,
        processingTime: Date.now() - startTime,
      },
    });

    // Handle different intents
    let response: AIResponse;

    switch (parsed.intent) {
      case INTENTS.MENU_PRICE_UPDATE:
        response = await this.handlePriceUpdate(
          parsed.entities as {
            target: string;
            modifier: string;
            value: number;
            isPercentage?: boolean;
          },
          restaurantId,
          userId
        );
        break;

      case INTENTS.MENU_AVAILABILITY_TOGGLE:
        response = await this.handleAvailabilityToggle(
          parsed.entities as { items: string[]; available: boolean },
          restaurantId,
          userId
        );
        break;

      case INTENTS.SALES_QUERY_TODAY:
        response = await this.handleSalesQueryToday(restaurantId);
        break;

      case INTENTS.TOP_SELLERS:
        response = await this.handleTopSellers(
          restaurantId,
          parsed.entities as { period?: string; limit?: number }
        );
        break;

      case INTENTS.TABLE_LIST:
        response = await this.handleTableList(restaurantId);
        break;

      case INTENTS.MENU_SEARCH:
        response = await this.handleMenuSearch(
          restaurantId,
          parsed.entities as { query: string }
        );
        break;

      case INTENTS.GREETING:
        response = this.handleGreeting();
        break;

      case INTENTS.HELP:
        response = this.handleHelp();
        break;

      default:
        response = {
          message: parsed.needsClarification
            ? parsed.clarificationQuestion || "I'm not sure what you'd like me to do."
            : "I couldn't understand that request. Try asking me to update prices, mark items available/unavailable, or check today's sales.",
          intent: INTENTS.UNKNOWN,
          requiresConfirmation: false,
        };
    }

    // Log the response
    await prisma.aIMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content: response.message,
        intent: response.intent,
        actionTaken: response.requiresConfirmation ? null : response.preview,
        processingTime: Date.now() - startTime,
      },
    });

    return { ...response, conversationId: conversation.id } as AIResponse & {
      conversationId: string;
    };
  }

  // Handle price update intent
  private async handlePriceUpdate(
    entities: {
      target: string;
      modifier: string;
      value: number;
      isPercentage?: boolean;
    },
    restaurantId: string,
    userId: string
  ): Promise<AIResponse> {
    const { preview, items } = await menuService.previewBulkPriceUpdate(
      restaurantId,
      { categoryName: entities.target },
      {
        type: entities.modifier as 'INCREMENT' | 'DECREMENT' | 'SET',
        value: entities.value,
        isPercentage: entities.isPercentage,
      }
    );

    if (items.length === 0) {
      return {
        message: `I couldn't find any items matching "${entities.target}". Could you check the spelling or try a different category/item name?`,
        intent: INTENTS.MENU_PRICE_UPDATE,
        requiresConfirmation: false,
      };
    }

    // Store pending action
    const actionId = `price_${Date.now()}`;
    pendingActions.set(actionId, async () => {
      const count = await menuService.executeBulkPriceUpdate(
        preview.map((p) => ({ itemId: p.itemId, newPrice: p.newPrice }))
      );

      // Log the action
      await prisma.aIAction.create({
        data: {
          restaurantId,
          userId,
          actionType: 'PRICE_UPDATE',
          targetEntity: 'MenuItem',
          previousValue: preview.map((p) => ({ id: p.itemId, price: p.oldPrice })),
          newValue: preview.map((p) => ({ id: p.itemId, price: p.newPrice })),
        },
      });

      return { success: true, updatedCount: count };
    });

    const changeText = entities.isPercentage
      ? `${entities.value}%`
      : `₹${entities.value}`;
    const actionText =
      entities.modifier === 'INCREMENT'
        ? `increase by ${changeText}`
        : entities.modifier === 'DECREMENT'
        ? `decrease by ${changeText}`
        : `set to ₹${entities.value}`;

    return {
      message: `Found **${items.length} item(s)** matching "${entities.target}". Ready to ${actionText}:`,
      intent: INTENTS.MENU_PRICE_UPDATE,
      requiresConfirmation: true,
      preview: {
        type: 'PRICE_UPDATE',
        changes: preview,
        actionId,
      },
    };
  }

  // Handle availability toggle
  private async handleAvailabilityToggle(
    entities: { items: string[]; available: boolean },
    restaurantId: string,
    userId: string
  ): Promise<AIResponse> {
    const updatedItems = await menuService.bulkToggleAvailability(
      restaurantId,
      entities.items,
      entities.available
    );

    if (updatedItems.length === 0) {
      return {
        message: `I couldn't find any items matching "${entities.items.join(', ')}". Could you check the spelling?`,
        intent: INTENTS.MENU_AVAILABILITY_TOGGLE,
        requiresConfirmation: false,
      };
    }

    // Log the action
    await prisma.aIAction.create({
      data: {
        restaurantId,
        userId,
        actionType: 'AVAILABILITY_TOGGLE',
        targetEntity: 'MenuItem',
        previousValue: updatedItems.map((i) => ({
          id: i.id,
          available: !entities.available,
        })),
        newValue: updatedItems.map((i) => ({
          id: i.id,
          available: entities.available,
        })),
      },
    });

    const action = entities.available
      ? 'now **available**'
      : "**86'd** (unavailable)";
    const itemNames = updatedItems.map((i) => i.name).join(', ');

    return {
      message: `Done! ${updatedItems.length} item(s) ${action}: ${itemNames}`,
      intent: INTENTS.MENU_AVAILABILITY_TOGGLE,
      requiresConfirmation: false,
    };
  }

  // Handle today's sales query
  private async handleSalesQueryToday(restaurantId: string): Promise<AIResponse> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [orders, invoices] = await Promise.all([
      prisma.order.findMany({
        where: {
          restaurantId,
          createdAt: { gte: today },
          status: { in: [OrderStatus.COMPLETED, OrderStatus.SERVED] },
        },
        select: {
          totalAmount: true,
          covers: true,
        },
      }),
      prisma.invoice.findMany({
        where: {
          restaurantId,
          createdAt: { gte: today },
          status: InvoiceStatus.PAID,
        },
        select: {
          totalAmount: true,
        },
      }),
    ]);

    const totalRevenue = invoices.reduce((sum, i) => sum + Number(i.totalAmount), 0);
    const totalOrders = orders.length;
    const totalCovers = orders.reduce((sum, o) => sum + (o.covers || 0), 0);
    const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const now = new Date();
    const greeting =
      now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening';

    return {
      message: `Here's your ${greeting} update:

**Revenue:** ₹${totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
**Orders:** ${totalOrders}
**Covers:** ${totalCovers}
**Avg Ticket:** ₹${avgTicket.toFixed(2)}`,
      intent: INTENTS.SALES_QUERY_TODAY,
      requiresConfirmation: false,
    };
  }

  // Handle top sellers query
  private async handleTopSellers(
    restaurantId: string,
    entities: { period?: string; limit?: number }
  ): Promise<AIResponse> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const orders = await prisma.order.findMany({
      where: {
        restaurantId,
        createdAt: { gte: today },
        status: { in: [OrderStatus.COMPLETED, OrderStatus.SERVED] },
      },
      include: {
        items: { select: { name: true, quantity: true, totalPrice: true } },
      },
    });

    // Aggregate items
    const itemStats: Record<string, { quantity: number; revenue: number }> = {};

    for (const order of orders) {
      for (const item of order.items) {
        if (!itemStats[item.name]) {
          itemStats[item.name] = { quantity: 0, revenue: 0 };
        }
        itemStats[item.name].quantity += item.quantity;
        itemStats[item.name].revenue += Number(item.totalPrice);
      }
    }

    const topItems = Object.entries(itemStats)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, entities.limit || 5);

    if (topItems.length === 0) {
      return {
        message: "No sales data available for today yet.",
        intent: INTENTS.TOP_SELLERS,
        requiresConfirmation: false,
      };
    }

    const itemsList = topItems
      .map((item, i) => `${i + 1}. **${item.name}** - ${item.quantity} sold (₹${item.revenue.toLocaleString('en-IN')})`)
      .join('\n');

    return {
      message: `**Top Sellers Today:**\n\n${itemsList}`,
      intent: INTENTS.TOP_SELLERS,
      requiresConfirmation: false,
    };
  }

  // Handle table list
  private async handleTableList(restaurantId: string): Promise<AIResponse> {
    const tables = await prisma.restaurantTable.findMany({
      where: { restaurantId },
      orderBy: [{ section: 'asc' }, { name: 'asc' }],
    });

    const byStatus = tables.reduce(
      (acc, t) => {
        acc[t.status] = (acc[t.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const statusEmoji: Record<string, string> = {
      AVAILABLE: '🟢',
      OCCUPIED: '🔴',
      RESERVED: '🟡',
      BLOCKED: '⚫',
      CLEANING: '🧹',
    };

    const statusList = Object.entries(byStatus)
      .map(([status, count]) => `${statusEmoji[status] || ''} ${status}: ${count}`)
      .join('\n');

    return {
      message: `**Table Status:**\n\n${statusList}\n\nTotal: ${tables.length} tables`,
      intent: INTENTS.TABLE_LIST,
      requiresConfirmation: false,
    };
  }

  // Handle menu search
  private async handleMenuSearch(
    restaurantId: string,
    entities: { query: string }
  ): Promise<AIResponse> {
    const items = await menuService.searchItems(restaurantId, entities.query);

    if (items.length === 0) {
      return {
        message: `No items found matching "${entities.query}".`,
        intent: INTENTS.MENU_SEARCH,
        requiresConfirmation: false,
      };
    }

    const itemsList = items
      .slice(0, 5)
      .map(
        (item) =>
          `• **${item.name}** - ₹${Number(item.basePrice).toFixed(2)} ${item.isAvailable ? '' : '(unavailable)'}`
      )
      .join('\n');

    return {
      message: `Found ${items.length} item(s):\n\n${itemsList}${items.length > 5 ? `\n\n+${items.length - 5} more...` : ''}`,
      intent: INTENTS.MENU_SEARCH,
      requiresConfirmation: false,
    };
  }

  // Handle greeting
  private handleGreeting(): AIResponse {
    const hour = new Date().getHours();
    const greeting =
      hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    return {
      message: `${greeting}! I'm your AI assistant. How can I help you today?`,
      intent: INTENTS.GREETING,
      requiresConfirmation: false,
    };
  }

  // Help response
  private handleHelp(): AIResponse {
    return {
      message: `I can help you with:

**Menu Management:**
• "Increase burger prices by ₹20"
• "Raise starters by 10%"
• "86 the paneer tikka" (mark unavailable)
• "Mark biryani available"
• "Find chicken items"

**Sales & Analytics:**
• "How's today going?"
• "What are the top sellers?"

**Tables:**
• "Show table status"

Just type naturally and I'll help!`,
      intent: INTENTS.HELP,
      requiresConfirmation: false,
    };
  }

  // Confirm a pending action
  async confirmAction(actionId: string): Promise<{ success: boolean; result?: unknown }> {
    const action = pendingActions.get(actionId);

    if (!action) {
      return { success: false };
    }

    try {
      const result = await action();
      pendingActions.delete(actionId);
      return { success: true, result };
    } catch (error) {
      console.error('Action execution error:', error);
      pendingActions.delete(actionId);
      return { success: false };
    }
  }

  // Cancel a pending action
  cancelAction(actionId: string): boolean {
    return pendingActions.delete(actionId);
  }
}

export const aiService = new AIService();
