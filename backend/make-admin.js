require('dotenv').config();
const mongoose = require('mongoose');

// Import User model
const User = require('./models/User');

// Connect to MongoDB
async function makeAdmin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');

        // Get user email from command line arguments
        const userEmail = process.argv[2];

        if (!userEmail) {
            console.log('❌ Usage: node make-admin.js <user-email>');
            console.log('Example: node make-admin.js user@example.com');
            process.exit(1);
        }

        // Find user by email
        const user = await User.findOne({ email: userEmail.toLowerCase() });

        if (!user) {
            console.log(`❌ User with email "${userEmail}" not found`);
            process.exit(1);
        }

        // Update user role to admin
        user.role = 'admin';
        await user.save();

        console.log(`✅ Successfully promoted user ${user.email} to admin`);
        console.log(`   Name: ${user.firstName} ${user.lastName}`);
        console.log(`   Role: ${user.role}`);

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

makeAdmin();

