const mongoose = require('mongoose');
const User = require('./dist/models/User').default;

async function verifyUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-api');
    
    // Find and update user
    const user = await User.findOneAndUpdate(
      { email: 'jasmits53@gmail.com' },
      { isVerified: true },
      { new: true }
    );
    
    if (user) {
        email: user.email,
        isVerified: user.isVerified,
        apiKey: user.apiKey
      });
    } else {
    }
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
}

verifyUser();