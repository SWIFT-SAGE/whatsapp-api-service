/**
 * Advanced WhatsApp Templates using whatsapp-web.js structured classes
 * Product, Order, Poll, and PollVote implementations
 */

import { logger } from '../utils/logger';

// Note: These interfaces match whatsapp-web.js class structures
// Import from whatsapp-web.js when available: import { Product, Order, Poll, PollVote } from 'whatsapp-web.js';

/**
 * PRODUCT TEMPLATES
 * Use for e-commerce, catalogs, product showcases
 */

export const ProductTemplates = {
  /**
   * Single Product Showcase
   * Use case: Product launch, featured item, promotional product
   */
  singleProduct: {
    name: 'Product Showcase',
    description: 'Display a single product with details',
    code: `
// Product class structure for whatsapp-web.js
const product = {
  productImage: 'https://example.com/images/product.jpg', // Product image URL
  businessOwnerJid: '919876543210@c.us', // Business WhatsApp ID
  productId: 'PROD-2024-001', // Unique product identifier
  title: 'Premium Wireless Headphones',
  description: 'High-quality noise-canceling headphones with 30-hour battery life. Perfect for music lovers and professionals.',
  currencyCode: 'INR',
  priceAmount1000: 4999000, // Price in smallest currency unit × 1000 (₹4,999 = 4999000)
  url: 'https://yourstore.com/products/wireless-headphones',
  retailerId: 'SKU-WH-001',
  firstImageId: 'img_001'
};

// Send product message
await client.sendMessage(chatId, product);
`,
    sampleData: {
      productImage: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
      businessOwnerJid: '919876543210@c.us',
      productId: 'PROD-2024-001',
      title: 'Premium Wireless Headphones',
      description: 'High-quality noise-canceling headphones with 30-hour battery life. Perfect for music lovers and professionals.',
      currencyCode: 'INR',
      priceAmount1000: 4999000,
      url: 'https://yourstore.com/products/wireless-headphones',
      retailerId: 'SKU-WH-001'
    }
  },

  /**
   * Electronics Product
   */
  electronicsProduct: {
    name: 'Electronics Product',
    description: 'Laptop product showcase',
    sampleData: {
      productImage: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853',
      businessOwnerJid: '919876543210@c.us',
      productId: 'PROD-2024-LAP-15',
      title: 'Dell XPS 15 Laptop',
      description: '15.6" 4K OLED Display, Intel i7 12th Gen, 16GB RAM, 512GB SSD, NVIDIA RTX 3050. Perfect for professionals and creators.',
      currencyCode: 'INR',
      priceAmount1000: 125000000, // ₹125,000
      url: 'https://yourstore.com/laptops/dell-xps-15',
      retailerId: 'SKU-LAP-XPS15'
    }
  },

  /**
   * Fashion Product
   */
  fashionProduct: {
    name: 'Fashion Product',
    description: 'Clothing item showcase',
    sampleData: {
      productImage: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b',
      businessOwnerJid: '919876543210@c.us',
      productId: 'PROD-2024-TSH-BLK',
      title: 'Premium Cotton T-Shirt - Black',
      description: '100% organic cotton, breathable fabric, perfect fit. Available in sizes S to XXL. Machine washable.',
      currencyCode: 'INR',
      priceAmount1000: 899000, // ₹899
      url: 'https://yourstore.com/clothing/cotton-tshirt-black',
      retailerId: 'SKU-TSH-BLK-M'
    }
  },

  /**
   * Food Product
   */
  foodProduct: {
    name: 'Food Product',
    description: 'Restaurant menu item',
    sampleData: {
      productImage: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38',
      businessOwnerJid: '919876543210@c.us',
      productId: 'FOOD-2024-PIZ-001',
      title: 'Margherita Pizza - Large',
      description: 'Fresh mozzarella, tomato sauce, basil, extra virgin olive oil. Hand-tossed dough, wood-fired oven. Serves 3-4 people.',
      currencyCode: 'INR',
      priceAmount1000: 599000, // ₹599
      url: 'https://yourrestaurant.com/menu/margherita-pizza',
      retailerId: 'MENU-PIZ-MAR-L'
    }
  },

  /**
   * Service Product
   */
  serviceProduct: {
    name: 'Service Product',
    description: 'Digital service offering',
    sampleData: {
      productImage: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f',
      businessOwnerJid: '919876543210@c.us',
      productId: 'SRV-2024-WEB-001',
      title: 'Professional Website Development',
      description: 'Custom website design & development. Responsive, SEO-optimized, with CMS integration. Includes 3 months support and hosting.',
      currencyCode: 'INR',
      priceAmount1000: 45000000, // ₹45,000
      url: 'https://swiftsage.com/services/web-development',
      retailerId: 'SRV-WEB-PRO'
    }
  },

  /**
   * Subscription Product
   */
  subscriptionProduct: {
    name: 'Subscription Product',
    description: 'Monthly subscription service',
    sampleData: {
      productImage: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113',
      businessOwnerJid: '919876543210@c.us',
      productId: 'SUB-2024-PRO-001',
      title: 'WhatsApp API Pro Plan - Monthly',
      description: 'Unlimited messages, advanced analytics, priority support, webhook integration, custom templates. Cancel anytime.',
      currencyCode: 'INR',
      priceAmount1000: 5999000, // ₹5,999/month
      url: 'https://swiftsage.com/pricing/pro-plan',
      retailerId: 'SUB-PRO-MONTHLY'
    }
  }
};

/**
 * ORDER TEMPLATES
 * Use for order confirmations, tracking, receipts
 */

export const OrderTemplates = {
  /**
   * E-commerce Order Confirmation
   */
  ecommerceOrder: {
    name: 'E-commerce Order',
    description: 'Complete order with multiple items',
    code: `
// Order class structure for whatsapp-web.js
const order = {
  orderId: 'ORD-2024-11-15-001',
  thumbnail: 'https://example.com/order-thumbnail.jpg',
  itemCount: 3,
  status: 'pending', // pending, processing, shipped, delivered, cancelled
  surface: 'catalog', // catalog, cart
  message: 'Thank you for your order! We will process it shortly.',
  orderTitle: 'Your Swift Sage Order',
  sellerJid: '919876543210@c.us',
  token: 'order_token_xyz123',
  totalAmount1000: 15497000, // ₹15,497 (sum of all items)
  totalCurrencyCode: 'INR',
  items: [
    {
      productId: 'PROD-2024-001',
      name: 'Premium Wireless Headphones',
      imageUrl: 'https://example.com/headphones.jpg',
      quantity: 1,
      currency: 'INR',
      priceAmount1000: 4999000 // ₹4,999
    },
    {
      productId: 'PROD-2024-LAP-15',
      name: 'Dell XPS 15 Laptop',
      imageUrl: 'https://example.com/laptop.jpg',
      quantity: 1,
      currency: 'INR',
      priceAmount1000: 125000000 // ₹125,000
    },
    {
      productId: 'PROD-2024-TSH-BLK',
      name: 'Premium Cotton T-Shirt - Black',
      imageUrl: 'https://example.com/tshirt.jpg',
      quantity: 2,
      currency: 'INR',
      priceAmount1000: 1798000 // ₹899 × 2
    }
  ]
};

// Send order message
await client.sendMessage(chatId, order);
`,
    sampleData: {
      orderId: 'ORD-2024-11-15-001',
      thumbnail: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da',
      itemCount: 3,
      status: 'pending',
      surface: 'catalog',
      message: 'Thank you for your order! We will process it shortly and send tracking details.',
      orderTitle: 'Your Swift Sage Order',
      sellerJid: '919876543210@c.us',
      token: 'order_token_xyz123',
      totalAmount1000: 131797000, // ₹131,797
      totalCurrencyCode: 'INR',
      items: [
        {
          productId: 'PROD-2024-001',
          name: 'Premium Wireless Headphones',
          imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
          quantity: 1,
          currency: 'INR',
          priceAmount1000: 4999000
        },
        {
          productId: 'PROD-2024-LAP-15',
          name: 'Dell XPS 15 Laptop',
          imageUrl: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853',
          quantity: 1,
          currency: 'INR',
          priceAmount1000: 125000000
        },
        {
          productId: 'PROD-2024-TSH-BLK',
          name: 'Premium Cotton T-Shirt - Black',
          imageUrl: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b',
          quantity: 2,
          currency: 'INR',
          priceAmount1000: 1798000
        }
      ]
    }
  },

  /**
   * Food Delivery Order
   */
  foodDeliveryOrder: {
    name: 'Food Delivery Order',
    description: 'Restaurant order confirmation',
    sampleData: {
      orderId: 'FOOD-ORD-2024-1115-789',
      thumbnail: 'https://images.unsplash.com/photo-1513104890138-7c749659a591',
      itemCount: 4,
      status: 'processing',
      surface: 'catalog',
      message: 'Your order is being prepared! Estimated delivery time: 30-40 minutes.',
      orderTitle: 'Pizza Palace Order',
      sellerJid: '919876543210@c.us',
      token: 'food_order_abc456',
      totalAmount1000: 1896000, // ₹1,896
      totalCurrencyCode: 'INR',
      items: [
        {
          productId: 'FOOD-PIZ-001',
          name: 'Margherita Pizza - Large',
          imageUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38',
          quantity: 2,
          currency: 'INR',
          priceAmount1000: 1198000 // ₹599 × 2
        },
        {
          productId: 'FOOD-GAR-001',
          name: 'Garlic Bread with Cheese',
          imageUrl: 'https://images.unsplash.com/photo-1573140401552-388e5ae4e28f',
          quantity: 1,
          currency: 'INR',
          priceAmount1000: 249000 // ₹249
        },
        {
          productId: 'FOOD-BEV-001',
          name: 'Coca Cola - 1.5L',
          imageUrl: 'https://images.unsplash.com/photo-1554866585-cd94860890b7',
          quantity: 1,
          currency: 'INR',
          priceAmount1000: 99000 // ₹99
        },
        {
          productId: 'FOOD-DES-001',
          name: 'Chocolate Brownie',
          imageUrl: 'https://images.unsplash.com/photo-1564355808853-7f99b5d1b1e1',
          quantity: 2,
          currency: 'INR',
          priceAmount1000: 350000 // ₹175 × 2
        }
      ]
    }
  },

  /**
   * Service Order
   */
  serviceOrder: {
    name: 'Service Order',
    description: 'Professional service booking',
    sampleData: {
      orderId: 'SRV-ORD-2024-1115-456',
      thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f',
      itemCount: 1,
      status: 'pending',
      surface: 'catalog',
      message: 'Service booking confirmed! Our team will contact you within 24 hours to schedule.',
      orderTitle: 'Swift Sage Service Order',
      sellerJid: '919876543210@c.us',
      token: 'service_order_def789',
      totalAmount1000: 45000000, // ₹45,000
      totalCurrencyCode: 'INR',
      items: [
        {
          productId: 'SRV-WEB-001',
          name: 'Professional Website Development',
          imageUrl: 'https://images.unsplash.com/photo-1467232004584-a241de8bcf5d',
          quantity: 1,
          currency: 'INR',
          priceAmount1000: 45000000
        }
      ]
    }
  },

  /**
   * Shipped Order Status Update
   */
  shippedOrder: {
    name: 'Shipped Order',
    description: 'Order tracking update',
    sampleData: {
      orderId: 'ORD-2024-11-10-123',
      thumbnail: 'https://images.unsplash.com/photo-1566576721346-d4a3b4eaeb55',
      itemCount: 2,
      status: 'shipped',
      surface: 'catalog',
      message: 'Your order has been shipped! Track your package: TRK123456789. Expected delivery: Nov 18, 2024.',
      orderTitle: 'Order Shipped',
      sellerJid: '919876543210@c.us',
      token: 'shipped_order_ghi012',
      totalAmount1000: 6798000, // ₹6,798
      totalCurrencyCode: 'INR',
      items: [
        {
          productId: 'PROD-2024-001',
          name: 'Premium Wireless Headphones',
          imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
          quantity: 1,
          currency: 'INR',
          priceAmount1000: 4999000
        },
        {
          productId: 'PROD-2024-TSH-BLK',
          name: 'Premium Cotton T-Shirt - Black',
          imageUrl: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b',
          quantity: 2,
          currency: 'INR',
          priceAmount1000: 1798000
        }
      ]
    }
  }
};

/**
 * POLL TEMPLATES
 * Use for surveys, feedback, voting, decision making
 */

export const PollTemplates = {
  /**
   * Customer Satisfaction Survey
   */
  customerSatisfaction: {
    name: 'Customer Satisfaction Poll',
    description: 'Rate your experience',
    code: `
// Poll class structure for whatsapp-web.js
const poll = {
  name: 'How satisfied are you with our service?',
  options: [
    'Very Satisfied 😊',
    'Satisfied 🙂',
    'Neutral 😐',
    'Dissatisfied 😕',
    'Very Dissatisfied 😞'
  ],
  selectableOptionsCount: 1, // Single choice poll (1) or multiple choice (0 for unlimited, or specific number)
  messageSecret: Buffer.from('poll_secret_123') // Optional: for encrypted polls
};

// Send poll
await client.sendMessage(chatId, poll);
`,
    sampleData: {
      name: 'How satisfied are you with our service?',
      options: [
        'Very Satisfied 😊',
        'Satisfied 🙂',
        'Neutral 😐',
        'Dissatisfied 😕',
        'Very Dissatisfied 😞'
      ],
      selectableOptionsCount: 1
    }
  },

  /**
   * Product Feature Vote
   */
  featureVote: {
    name: 'Feature Vote Poll',
    description: 'Vote for next feature',
    sampleData: {
      name: 'Which feature should we build next for our WhatsApp API service?',
      options: [
        '📊 Advanced Analytics Dashboard',
        '🤖 AI-Powered Chatbot Builder',
        '📸 Media Management System',
        '📅 Appointment Scheduling',
        '💳 Payment Integration',
        '🌐 Multi-language Support'
      ],
      selectableOptionsCount: 2 // Allow voting for top 2 features
    }
  },

  /**
   * Event Planning Poll
   */
  eventPlanning: {
    name: 'Event Planning Poll',
    description: 'Choose event date',
    sampleData: {
      name: 'When should we schedule our team meeting?',
      options: [
        'Monday, Nov 18 - 10:00 AM',
        'Monday, Nov 18 - 2:00 PM',
        'Tuesday, Nov 19 - 10:00 AM',
        'Tuesday, Nov 19 - 2:00 PM',
        'Wednesday, Nov 20 - 10:00 AM'
      ],
      selectableOptionsCount: 1
    }
  },

  /**
   * Menu Selection Poll
   */
  menuSelection: {
    name: 'Menu Selection Poll',
    description: 'Choose lunch options',
    sampleData: {
      name: 'What would you like for team lunch? (Choose up to 2)',
      options: [
        '🍕 Pizza',
        '🍔 Burgers',
        '🍜 Chinese',
        '🍛 Indian Curry',
        '🌮 Mexican',
        '🍣 Sushi',
        '🥗 Salad Bar'
      ],
      selectableOptionsCount: 2
    }
  },

  /**
   * Product Preference Poll
   */
  productPreference: {
    name: 'Product Preference Poll',
    description: 'Color preference survey',
    sampleData: {
      name: 'Which color variant would you prefer for our new headphones?',
      options: [
        '⚫ Midnight Black',
        '⚪ Pearl White',
        '🔵 Ocean Blue',
        '🔴 Ruby Red',
        '⭐ Rose Gold'
      ],
      selectableOptionsCount: 1
    }
  },

  /**
   * Feedback Collection Poll
   */
  feedbackCollection: {
    name: 'Feedback Collection Poll',
    description: 'Service improvement areas',
    sampleData: {
      name: 'What areas should we improve? (Select all that apply)',
      options: [
        'Response Time',
        'Product Quality',
        'Customer Support',
        'Delivery Speed',
        'Pricing',
        'Website Experience',
        'Mobile App'
      ],
      selectableOptionsCount: 0 // 0 = unlimited selections
    }
  },

  /**
   * Training Topic Poll
   */
  trainingTopic: {
    name: 'Training Topic Poll',
    description: 'Choose training session',
    sampleData: {
      name: 'Which training topic interests you most?',
      options: [
        '💻 Advanced JavaScript',
        '🎨 UI/UX Design',
        '📱 Mobile App Development',
        '☁️ Cloud Architecture',
        '🔒 Cybersecurity',
        '📊 Data Analytics'
      ],
      selectableOptionsCount: 1
    }
  }
};

/**
 * POLL VOTE TEMPLATES
 * Use for handling poll responses and displaying results
 */

export const PollVoteTemplates = {
  /**
   * Poll Vote Handler
   */
  voteHandler: {
    name: 'Poll Vote Handler',
    description: 'Handle incoming poll votes',
    code: `
// Listen for poll votes
client.on('message', async (msg) => {
  if (msg.type === 'poll_creation') {
    console.log('Poll created:', msg.body);
  }
});

// PollVote structure when user votes
client.on('vote_update', async (vote) => {
  const pollVote = {
    pollId: vote.pollId, // ID of the poll
    selectedOptions: vote.selectedOptions, // Array of selected option indices [0, 2, 3]
    voter: vote.voter, // Voter's WhatsApp ID
    timestamp: vote.timestamp // When the vote was cast
  };
  
  console.log('Vote received:', pollVote);
  
  // Send confirmation to voter
  await client.sendMessage(vote.voter, 
    \`Thank you for voting! Your response has been recorded.\`
  );
});

// Get poll results
async function getPollResults(pollMessage) {
  const results = await pollMessage.getPollData();
  
  console.log('Poll Results:');
  console.log('Poll Name:', results.name);
  console.log('Total Votes:', results.totalVotes);
  
  results.options.forEach((option, index) => {
    console.log(\`Option \${index + 1}: \${option.name}\`);
    console.log(\`  Votes: \${option.votes}\`);
    console.log(\`  Voters: \${option.voters.join(', ')}\`);
  });
  
  return results;
}
`,
    sampleData: {
      pollId: 'POLL-2024-1115-001',
      selectedOptions: [0, 2], // User selected options at index 0 and 2
      voter: '919876543210@c.us',
      timestamp: new Date().toISOString()
    }
  },

  /**
   * Poll Results Summary
   */
  resultsSummary: {
    name: 'Poll Results Summary',
    description: 'Format and send poll results',
    code: `
// Format poll results as a message
async function sendPollResults(chatId, pollData) {
  const totalVotes = pollData.totalVotes;
  
  let resultsMessage = \`📊 *Poll Results: \${pollData.name}*\\n\\n\`;
  resultsMessage += \`Total Votes: \${totalVotes}\\n\\n\`;
  
  // Sort options by vote count
  const sortedOptions = pollData.options
    .map((opt, index) => ({ ...opt, index }))
    .sort((a, b) => b.votes - a.votes);
  
  sortedOptions.forEach((option, rank) => {
    const percentage = totalVotes > 0 
      ? ((option.votes / totalVotes) * 100).toFixed(1) 
      : 0;
    
    const barLength = Math.round(percentage / 5); // Bar chart (20 chars max)
    const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
    
    resultsMessage += \`\${rank + 1}. \${option.name}\\n\`;
    resultsMessage += \`   \${bar} \${percentage}%\\n\`;
    resultsMessage += \`   \${option.votes} vote(s)\\n\\n\`;
  });
  
  resultsMessage += \`_Poll closed on \${new Date().toLocaleDateString()}_\`;
  
  await client.sendMessage(chatId, resultsMessage);
}
`,
    sampleData: {
      pollName: 'How satisfied are you with our service?',
      totalVotes: 47,
      results: [
        { option: 'Very Satisfied 😊', votes: 23, percentage: 48.9 },
        { option: 'Satisfied 🙂', votes: 15, percentage: 31.9 },
        { option: 'Neutral 😐', votes: 6, percentage: 12.8 },
        { option: 'Dissatisfied 😕', votes: 2, percentage: 4.3 },
        { option: 'Very Dissatisfied 😞', votes: 1, percentage: 2.1 }
      ]
    }
  }
};

/**
 * Helper function to format price from priceAmount1000
 */
export function formatPrice(priceAmount1000: number, currencyCode: string): string {
  const amount = priceAmount1000 / 1000;
  const currencySymbols: { [key: string]: string } = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£'
  };
  
  const symbol = currencySymbols[currencyCode] || currencyCode;
  return `${symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/**
 * Complete usage examples
 */
export const UsageExamples = {
  sendProduct: `
// Example 1: Send a single product
import { ProductTemplates } from './AdvancedTemplates';

const product = ProductTemplates.electronicsProduct.sampleData;
await client.sendMessage('919876543210@c.us', product);
`,

  sendOrder: `
// Example 2: Send order confirmation
import { OrderTemplates } from './AdvancedTemplates';

const order = OrderTemplates.ecommerceOrder.sampleData;
await client.sendMessage('919876543210@c.us', order);
`,

  sendPoll: `
// Example 3: Send a poll
import { PollTemplates } from './AdvancedTemplates';

const poll = PollTemplates.customerSatisfaction.sampleData;
await client.sendMessage('919876543210@c.us', poll);
`,

  handlePollVotes: `
// Example 4: Handle poll votes
client.on('vote_update', async (vote) => {
  console.log('Vote received from:', vote.voter);
  console.log('Selected options:', vote.selectedOptions);
  
  // Send thank you message
  await client.sendMessage(vote.voter, 
    'Thank you for your vote! Your feedback helps us improve.'
  );
});
`,

  getPollResults: `
// Example 5: Get and display poll results
const pollMessage = await client.getMessageById('poll_message_id');
const results = await pollMessage.getPollData();

console.log('Poll:', results.name);
console.log('Total votes:', results.totalVotes);

results.options.forEach((option, index) => {
  const percentage = (option.votes / results.totalVotes * 100).toFixed(1);
  console.log(\`\${index + 1}. \${option.name}: \${option.votes} votes (\${percentage}%)\`);
});
`
};

export default {
  ProductTemplates,
  OrderTemplates,
  PollTemplates,
  PollVoteTemplates,
  UsageExamples,
  formatPrice
};

