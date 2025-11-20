import mongoose, { Schema, Document, Model } from 'mongoose';

// Chatbot Rule interface
export interface IChatbotRule extends Document {
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    trigger: string;
    response: string;
    active: boolean;
    matchType: 'exact' | 'contains' | 'regex' | 'startsWith';
    caseSensitive: boolean;
    priority: number;
    createdAt: Date;
    updatedAt: Date;
}

// Chatbot Rule schema
const chatbotRuleSchema = new Schema<IChatbotRule>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
        index: true
    },
    trigger: {
        type: String,
        required: [true, 'Trigger is required'],
        trim: true,
        maxlength: [500, 'Trigger cannot exceed 500 characters']
    },
    response: {
        type: String,
        required: [true, 'Response is required'],
        trim: true,
        maxlength: [2000, 'Response cannot exceed 2000 characters']
    },
    active: {
        type: Boolean,
        default: true,
        index: true
    },
    matchType: {
        type: String,
        enum: ['exact', 'contains', 'regex', 'startsWith'],
        default: 'contains',
        required: true
    },
    caseSensitive: {
        type: Boolean,
        default: false
    },
    priority: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    }
}, {
    timestamps: true
});

// Indexes for efficient querying
chatbotRuleSchema.index({ userId: 1, active: 1 });
chatbotRuleSchema.index({ userId: 1, priority: -1 });

// Instance methods
chatbotRuleSchema.methods.matches = function (message: string): boolean {
    const trigger = this.caseSensitive ? this.trigger : this.trigger.toLowerCase();
    const msg = this.caseSensitive ? message : message.toLowerCase();

    switch (this.matchType) {
        case 'exact':
            return msg === trigger;
        case 'contains':
            return msg.includes(trigger);
        case 'startsWith':
            return msg.startsWith(trigger);
        case 'regex':
            try {
                const regex = new RegExp(trigger, this.caseSensitive ? '' : 'i');
                return regex.test(message);
            } catch (error) {
                return false;
            }
        default:
            return false;
    }
};

const ChatbotRule: Model<IChatbotRule> = mongoose.model<IChatbotRule>('ChatbotRule', chatbotRuleSchema);

export default ChatbotRule;
