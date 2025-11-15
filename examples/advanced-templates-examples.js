/**
 * Advanced WhatsApp Templates - Real-World Examples
 * Using Product, Order, Poll, and PollVote classes
 * 
 * Run with: node examples/advanced-templates-examples.js
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

client.on('qr', (qr) => {
  qrcode.generate(qr, { small: true });
  console.log('📱 Scan QR code to connect WhatsApp');
});

client.on('ready', () => {
  console.log('✅ Client is ready!');
  console.log('\n📚 Available commands:');
  console.log('  /product - Send product showcase');
  console.log('  /order - Send order confirmation');
  console.log('  /poll - Send customer poll');
  console.log('  /catalog - Send product catalog');
  console.log('  /help - Show all commands\n');
});

// ============================================
// PRODUCT EXAMPLES
// ============================================

const ProductExamples = {
  // Electronics Product
  laptop: {
    productImage: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853',
    businessOwnerJid: '919876543210@c.us',
    productId: 'PROD-2024-LAP-15',
    title: 'Dell XPS 15 Laptop',
    description: '15.6" 4K OLED Display, Intel i7 12th Gen, 16GB RAM, 512GB SSD, NVIDIA RTX 3050. Perfect for professionals and creators.',
    currencyCode: 'INR',
    priceAmount1000: 125000000, // ₹125,000
    url: 'https://yourstore.com/laptops/dell-xps-15',
    retailerId: 'SKU-LAP-XPS15'
  },

  // Fashion Product
  tshirt: {
    productImage: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b',
    businessOwnerJid: '919876543210@c.us',
    productId: 'PROD-2024-TSH-BLK',
    title: 'Premium Cotton T-Shirt - Black',
    description: '100% organic cotton, breathable fabric, perfect fit. Available in sizes S to XXL. Machine washable.',
    currencyCode: 'INR',
    priceAmount1000: 899000, // ₹899
    url: 'https://yourstore.com/clothing/cotton-tshirt-black',
    retailerId: 'SKU-TSH-BLK-M'
  },

  // Service Product
  webDevelopment: {
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
};

// ============================================
// ORDER EXAMPLES
// ============================================

const OrderExamples = {
  // E-commerce Order
  ecommerce: {
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
  },

  // Food Delivery Order
  foodDelivery: {
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
        priceAmount1000: 1198000
      },
      {
        productId: 'FOOD-GAR-001',
        name: 'Garlic Bread with Cheese',
        imageUrl: 'https://images.unsplash.com/photo-1573140401552-388e5ae4e28f',
        quantity: 1,
        currency: 'INR',
        priceAmount1000: 249000
      },
      {
        productId: 'FOOD-BEV-001',
        name: 'Coca Cola - 1.5L',
        imageUrl: 'https://images.unsplash.com/photo-1554866585-cd94860890b7',
        quantity: 1,
        currency: 'INR',
        priceAmount1000: 99000
      },
      {
        productId: 'FOOD-DES-001',
        name: 'Chocolate Brownie',
        imageUrl: 'https://images.unsplash.com/photo-1564355808853-7f99b5d1b1e1',
        quantity: 2,
        currency: 'INR',
        priceAmount1000: 350000
      }
    ]
  }
};

// ============================================
// POLL EXAMPLES
// ============================================

const PollExamples = {
  // Customer Satisfaction
  satisfaction: {
    name: 'How satisfied are you with our service?',
    options: [
      'Very Satisfied 😊',
      'Satisfied 🙂',
      'Neutral 😐',
      'Dissatisfied 😕',
      'Very Dissatisfied 😞'
    ],
    selectableOptionsCount: 1
  },

  // Feature Vote
  featureVote: {
    name: 'Which features should we build next for our WhatsApp API service?',
    options: [
      '📊 Advanced Analytics Dashboard',
      '🤖 AI-Powered Chatbot Builder',
      '📸 Media Management System',
      '📅 Appointment Scheduling',
      '💳 Payment Integration',
      '🌐 Multi-language Support'
    ],
    selectableOptionsCount: 2
  },

  // Event Planning
  eventPlanning: {
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
};

// ============================================
// MESSAGE HANDLERS
// ============================================

client.on('message', async (msg) => {
  const command = msg.body.toLowerCase().trim();
  const chatId = msg.from;

  try {
    switch (command) {
      case '/product':
        console.log('📦 Sending product showcase...');
        await client.sendMessage(chatId, ProductExamples.laptop);
        await msg.reply('✅ Product sent! Check the message above.');
        break;

      case '/order':
        console.log('📋 Sending order confirmation...');
        await client.sendMessage(chatId, OrderExamples.ecommerce);
        await msg.reply('✅ Order confirmation sent!');
        break;

      case '/poll':
        console.log('📊 Sending poll...');
        await client.sendMessage(chatId, PollExamples.satisfaction);
        await msg.reply('✅ Poll sent! Please vote.');
        break;

      case '/catalog':
        console.log('🛍️ Sending product catalog...');
        await msg.reply('📦 Sending 3 products from our catalog...');
        
        await client.sendMessage(chatId, ProductExamples.laptop);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await client.sendMessage(chatId, ProductExamples.tshirt);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await client.sendMessage(chatId, ProductExamples.webDevelopment);
        await msg.reply('✅ Catalog sent! Browse our products above.');
        break;

      case '/help':
        const helpMessage = `
*📚 Available Commands*

*Product Commands:*
/product - Send laptop product
/catalog - Send product catalog (3 items)

*Order Commands:*
/order - Send e-commerce order
/foodorder - Send food delivery order

*Poll Commands:*
/poll - Customer satisfaction poll
/featurepoll - Feature vote poll
/eventpoll - Event planning poll

*Other Commands:*
/help - Show this message
        `.trim();
        
        await msg.reply(helpMessage);
        break;

      case '/foodorder':
        console.log('🍕 Sending food order...');
        await client.sendMessage(chatId, OrderExamples.foodDelivery);
        await msg.reply('✅ Food order sent!');
        break;

      case '/featurepoll':
        console.log('🗳️ Sending feature poll...');
        await client.sendMessage(chatId, PollExamples.featureVote);
        await msg.reply('✅ Feature poll sent! Vote for your top 2 features.');
        break;

      case '/eventpoll':
        console.log('📅 Sending event poll...');
        await client.sendMessage(chatId, PollExamples.eventPlanning);
        await msg.reply('✅ Event poll sent! Choose your preferred time.');
        break;

      default:
        // Ignore other messages
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    await msg.reply(`❌ Error: ${error.message}`);
  }
});

// ============================================
// POLL VOTE HANDLER
// ============================================

client.on('vote_update', async (vote) => {
  console.log('\n🗳️ Vote received!');
  console.log('Voter:', vote.voter);
  console.log('Selected options:', vote.selectedOptions);
  console.log('Timestamp:', vote.timestamp);

  // Send thank you message
  try {
    await client.sendMessage(vote.voter, 
      '🙏 Thank you for your vote! Your feedback helps us improve.'
    );
  } catch (error) {
    console.error('Error sending thank you:', error.message);
  }
});

// ============================================
// POLL RESULTS HANDLER
// ============================================

async function getPollResults(pollMessageId) {
  try {
    const pollMessage = await client.getMessageById(pollMessageId);
    const results = await pollMessage.getPollData();

    console.log('\n📊 Poll Results:');
    console.log('Question:', results.name);
    console.log('Total Votes:', results.totalVotes);
    console.log('\nResults:');

    results.options.forEach((option, index) => {
      const percentage = results.totalVotes > 0 
        ? ((option.votes / results.totalVotes) * 100).toFixed(1) 
        : 0;
      
      console.log(`${index + 1}. ${option.name}`);
      console.log(`   Votes: ${option.votes} (${percentage}%)`);
      console.log(`   Voters: ${option.voters.join(', ')}`);
    });

    return results;
  } catch (error) {
    console.error('Error getting poll results:', error.message);
  }
}

// ============================================
// BUSINESS AUTOMATION EXAMPLES
// ============================================

/**
 * Example 1: Send Product Catalog to New Customer
 */
async function sendWelcomeCatalog(customerNumber) {
  const welcomeMessage = `
*Welcome to Swift Sage Store! 🎉*

Here are some of our featured products:
  `.trim();

  await client.sendMessage(customerNumber, welcomeMessage);
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Send products
  const products = [
    ProductExamples.laptop,
    ProductExamples.tshirt,
    ProductExamples.webDevelopment
  ];

  for (const product of products) {
    await client.sendMessage(customerNumber, product);
    await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5s delay
  }

  await client.sendMessage(customerNumber, 
    'Browse our products above and let us know if you have any questions! 💬'
  );
}

/**
 * Example 2: Process Order and Send Confirmation
 */
async function processCustomerOrder(customerNumber, orderItems) {
  // Calculate total
  const totalAmount = orderItems.reduce((sum, item) => 
    sum + (item.priceAmount1000 * item.quantity), 0
  );

  // Generate order ID
  const orderId = `ORD-${new Date().toISOString().split('T')[0]}-${Date.now()}`;

  // Create order
  const order = {
    orderId,
    thumbnail: orderItems[0].imageUrl,
    itemCount: orderItems.length,
    status: 'pending',
    surface: 'catalog',
    message: `Thank you for your order! Order ID: ${orderId}. We'll send tracking details soon.`,
    orderTitle: 'Your Order Confirmation',
    sellerJid: '919876543210@c.us',
    token: `order_token_${orderId}`,
    totalAmount1000: totalAmount,
    totalCurrencyCode: 'INR',
    items: orderItems
  };

  // Send order confirmation
  await client.sendMessage(customerNumber, order);

  console.log(`✅ Order ${orderId} confirmed for ${customerNumber}`);
  return orderId;
}

/**
 * Example 3: Send Feedback Poll After Delivery
 */
async function sendDeliveryFeedback(customerNumber, orderId) {
  const feedbackPoll = {
    name: `How was your experience with order ${orderId}?`,
    options: [
      'Excellent 🌟',
      'Good 👍',
      'Average 😐',
      'Poor 👎',
      'Very Poor 😞'
    ],
    selectableOptionsCount: 1
  };

  await client.sendMessage(customerNumber, feedbackPoll);
  console.log(`📊 Feedback poll sent for order ${orderId}`);
}

// ============================================
// INITIALIZE CLIENT
// ============================================

console.log('🚀 Starting WhatsApp Advanced Templates Demo...\n');
client.initialize();

// Export for use in other files
module.exports = {
  ProductExamples,
  OrderExamples,
  PollExamples,
  sendWelcomeCatalog,
  processCustomerOrder,
  sendDeliveryFeedback,
  getPollResults
};

