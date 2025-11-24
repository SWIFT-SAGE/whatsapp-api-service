/**
 * Reset Message Count Script
 * 
 * This script helps reset the message count for users.
 * It can be used to:
 * 1. Reset the message count to 0
 * 2. Sync the count with actual outbound messages
 * 3. Fix discrepancies between database count and actual sent messages
 * 
 * Usage:
 * node reset-message-count.js <user-email> [--sync]
 * 
 * Examples:
 * node reset-message-count.js user@example.com --reset  (Reset to 0)
 * node reset-message-count.js user@example.com --sync   (Sync with actual count)
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Import models
const User = require('./dist/models/User').default;
const MessageLog = require('./dist/models/MessageLog').default;

async function resetMessageCount(userEmail, mode = 'reset') {
    try {
        // Connect to database
        console.log('Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-api');
        console.log('✅ Connected to database');

        // Find user
        const user = await User.findOne({ email: userEmail });
        if (!user) {
            console.error(`❌ User not found: ${userEmail}`);
            process.exit(1);
        }

        console.log(`\nUser found: ${user.name} (${user.email})`);
        console.log(`Current plan: ${user.subscription.plan}`);
        console.log(`Current message count: ${user.subscription.messageCount}`);
        console.log(`Message limit: ${user.subscription.messageLimit}`);

        if (mode === 'sync') {
            // Count actual outbound messages from current month
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const actualCount = await MessageLog.countDocuments({
                userId: user._id,
                direction: 'outbound', // Only count messages sent by user
                createdAt: { $gte: startOfMonth }
            });

            console.log(`\nActual outbound messages this month: ${actualCount}`);

            // Update user's message count
            user.subscription.messageCount = actualCount;
            await user.save();

            console.log(`✅ Message count synced to ${actualCount}`);
        } else {
            // Reset to 0
            user.subscription.messageCount = 0;
            await user.save();

            console.log(`✅ Message count reset to 0`);
        }

        // Show summary
        console.log(`\n--- Summary ---`);
        console.log(`User: ${user.email}`);
        console.log(`Plan: ${user.subscription.plan}`);
        console.log(`New message count: ${user.subscription.messageCount}`);
        console.log(`Message limit: ${user.subscription.messageLimit}`);
        console.log(`Remaining: ${user.subscription.messageLimit === -1 ? 'Unlimited' : user.subscription.messageLimit - user.subscription.messageCount}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from database');
        process.exit(0);
    }
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
    console.log(`
Usage: node reset-message-count.js <user-email> [--sync|--reset]

Options:
  --reset  Reset message count to 0 (default)
  --sync   Sync with actual outbound messages from current month

Examples:
  node reset-message-count.js user@example.com --reset
  node reset-message-count.js user@example.com --sync
  `);
    process.exit(0);
}

const userEmail = args[0];
const mode = args[1] === '--sync' ? 'sync' : 'reset';

resetMessageCount(userEmail, mode);
