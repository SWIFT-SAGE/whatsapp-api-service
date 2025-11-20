import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import ChatbotRule, { IChatbotRule } from '../models/ChatbotRule';
import { IUser } from '../models/User';
import { logger } from '../utils/logger';

export class ChatbotController {
    /**
     * Get all chatbot rules for the authenticated user
     */
    async getRules(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as IUser;

            const rules = await ChatbotRule.find({ userId: user._id })
                .sort({ priority: -1, createdAt: -1 })
                .lean();

            res.json({
                success: true,
                data: rules,
                count: rules.length
            });
        } catch (error) {
            logger.error('Error fetching chatbot rules:', error);
            res.status(500).json({ error: 'Failed to fetch chatbot rules' });
        }
    }

    /**
     * Get a single chatbot rule by ID
     */
    async getRule(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as IUser;
            const { id } = req.params;

            const rule = await ChatbotRule.findOne({ _id: id, userId: user._id });

            if (!rule) {
                res.status(404).json({ error: 'Chatbot rule not found' });
                return;
            }

            res.json({
                success: true,
                data: rule
            });
        } catch (error) {
            logger.error('Error fetching chatbot rule:', error);
            res.status(500).json({ error: 'Failed to fetch chatbot rule' });
        }
    }

    /**
     * Create a new chatbot rule
     */
    async createRule(req: Request, res: Response): Promise<void> {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({ errors: errors.array() });
                return;
            }

            const user = req.user as IUser;
            const { trigger, response, matchType, caseSensitive, priority, active } = req.body;

            // Check chatbot limit based on subscription plan
            const existingRulesCount = await ChatbotRule.countDocuments({ userId: user._id });
            const chatbotLimit = user.subscription.chatbotLimit || 1;

            if (existingRulesCount >= chatbotLimit * 10) { // Allow 10 rules per chatbot
                res.status(403).json({
                    error: `You have reached the maximum number of chatbot rules for your plan (${chatbotLimit * 10} rules)`,
                    limit: chatbotLimit * 10,
                    current: existingRulesCount
                });
                return;
            }

            const rule = new ChatbotRule({
                userId: user._id,
                trigger,
                response,
                matchType: matchType || 'contains',
                caseSensitive: caseSensitive || false,
                priority: priority || 0,
                active: active !== undefined ? active : true
            });

            await rule.save();

            logger.info(`Chatbot rule created by user ${user._id}: ${rule._id}`);

            res.status(201).json({
                success: true,
                data: rule,
                message: 'Chatbot rule created successfully'
            });
        } catch (error) {
            logger.error('Error creating chatbot rule:', error);
            res.status(500).json({ error: 'Failed to create chatbot rule' });
        }
    }

    /**
     * Update a chatbot rule
     */
    async updateRule(req: Request, res: Response): Promise<void> {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({ errors: errors.array() });
                return;
            }

            const user = req.user as IUser;
            const { id } = req.params;
            const { trigger, response, matchType, caseSensitive, priority, active } = req.body;

            const rule = await ChatbotRule.findOne({ _id: id, userId: user._id });

            if (!rule) {
                res.status(404).json({ error: 'Chatbot rule not found' });
                return;
            }

            // Update fields
            if (trigger !== undefined) rule.trigger = trigger;
            if (response !== undefined) rule.response = response;
            if (matchType !== undefined) rule.matchType = matchType;
            if (caseSensitive !== undefined) rule.caseSensitive = caseSensitive;
            if (priority !== undefined) rule.priority = priority;
            if (active !== undefined) rule.active = active;

            await rule.save();

            logger.info(`Chatbot rule updated by user ${user._id}: ${rule._id}`);

            res.json({
                success: true,
                data: rule,
                message: 'Chatbot rule updated successfully'
            });
        } catch (error) {
            logger.error('Error updating chatbot rule:', error);
            res.status(500).json({ error: 'Failed to update chatbot rule' });
        }
    }

    /**
     * Delete a chatbot rule
     */
    async deleteRule(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as IUser;
            const { id } = req.params;

            const rule = await ChatbotRule.findOneAndDelete({ _id: id, userId: user._id });

            if (!rule) {
                res.status(404).json({ error: 'Chatbot rule not found' });
                return;
            }

            logger.info(`Chatbot rule deleted by user ${user._id}: ${id}`);

            res.json({
                success: true,
                message: 'Chatbot rule deleted successfully'
            });
        } catch (error) {
            logger.error('Error deleting chatbot rule:', error);
            res.status(500).json({ error: 'Failed to delete chatbot rule' });
        }
    }

    /**
     * Toggle a chatbot rule's active status
     */
    async toggleRule(req: Request, res: Response): Promise<void> {
        try {
            const user = req.user as IUser;
            const { id } = req.params;

            const rule = await ChatbotRule.findOne({ _id: id, userId: user._id });

            if (!rule) {
                res.status(404).json({ error: 'Chatbot rule not found' });
                return;
            }

            rule.active = !rule.active;
            await rule.save();

            logger.info(`Chatbot rule toggled by user ${user._id}: ${rule._id} (active: ${rule.active})`);

            res.json({
                success: true,
                data: rule,
                message: `Chatbot rule ${rule.active ? 'activated' : 'deactivated'} successfully`
            });
        } catch (error) {
            logger.error('Error toggling chatbot rule:', error);
            res.status(500).json({ error: 'Failed to toggle chatbot rule' });
        }
    }

    /**
     * Test a message against chatbot rules
     */
    async testMessage(req: Request, res: Response): Promise<void> {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({ errors: errors.array() });
                return;
            }

            const user = req.user as IUser;
            const { message } = req.body;

            // Get all active rules for the user, sorted by priority
            const rules = await ChatbotRule.find({
                userId: user._id,
                active: true
            }).sort({ priority: -1, createdAt: -1 });

            // Find the first matching rule
            let matchedRule: IChatbotRule | null = null;
            for (const rule of rules) {
                // Use type assertion to access the matches method
                if ((rule as any).matches(message)) {
                    matchedRule = rule;
                    break;
                }
            }

            if (matchedRule) {
                res.json({
                    success: true,
                    matched: true,
                    data: {
                        trigger: matchedRule.trigger,
                        response: matchedRule.response,
                        matchType: matchedRule.matchType,
                        ruleId: matchedRule._id
                    }
                });
            } else {
                res.json({
                    success: true,
                    matched: false,
                    message: 'No matching chatbot rule found'
                });
            }
        } catch (error) {
            logger.error('Error testing chatbot message:', error);
            res.status(500).json({ error: 'Failed to test chatbot message' });
        }
    }

    /**
     * Process incoming message and return chatbot response if matched
     */
    async processMessage(userId: string, message: string): Promise<string | null> {
        try {
            // Get all active rules for the user, sorted by priority
            const rules = await ChatbotRule.find({
                userId,
                active: true
            }).sort({ priority: -1, createdAt: -1 });

            // Find the first matching rule
            for (const rule of rules) {
                // Use type assertion to access the matches method
                if ((rule as any).matches(message)) {
                    logger.info(`Chatbot rule matched for user ${userId}: ${rule._id}`);
                    return rule.response;
                }
            }

            return null;
        } catch (error) {
            logger.error('Error processing chatbot message:', error);
            return null;
        }
    }
}

export default new ChatbotController();
