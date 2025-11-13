import express from 'express';
import path from 'path';
import { authenticateToken } from '../middleware/auth';
import User, { IUser } from '../models/User';

const router = express.Router();

// Apply authentication to all dashboard routes
router.use(authenticateToken);

// Serve dashboard section pages
router.get('/section/:section', async (req, res) => {
    try {
        const { section } = req.params;
        
        // Validate section name
        const validSections = ['overview', 'sessions', 'messages', 'chatbot', 'webhooks', 'analytics', 'billing', 'profile', 'api-docs'];
        if (!validSections.includes(section)) {
            return res.status(400).json({ error: 'Invalid section name' });
        }

        // Fetch fresh user data to ensure API key is up to date
        const freshUser = await User.findById((req.user as IUser)._id);
        
        // Render the section page
        res.render(`pages/${section}`, {
            user: freshUser || req.user,
            stats: {
                totalMessages: 0,
                activeSessions: 0,
                deliveryRate: 0,
                totalSessions: 0
            },
            sessions: []
        });
    } catch (error) {
        console.error('Error rendering dashboard section:', error);
        res.status(500).json({ error: 'Failed to load section page' });
    }
});

export default router;
