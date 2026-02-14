const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const models = require('../models/zindex');

/**
 * Super Admin Initialization Script
 * Usage: node scripts/initSuperAdmin.js <email>
 */

async function initSuperAdmin() {
    const email = process.argv[2];

    if (!email) {
        console.error('\x1b[31m%s\x1b[0m', 'Error: Please provide the email address of the user to promote.');
        console.log('Usage: node scripts/initSuperAdmin.js your-email@example.com');
        process.exit(1);
    }

    try {
        console.log('Connecting to database...');
        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL is not defined in .env file');
        }
        await mongoose.connect(process.env.DATABASE_URL);
        console.log('Connected successfully!');

        const user = await models.User.findOne({ email: new RegExp('^' + email + '$', 'i') });

        if (!user) {
            console.error('\x1b[31m%s\x1b[0m', `Error: User with email "${email}" not found.`);
            console.log('Please ensure the user is already registered in the system.');
            process.exit(1);
        }

        if (user.role === 'superAdmin') {
            console.log('\x1b[33m%s\x1b[0m', `User "${user.email}" is already a Super Admin.`);
            process.exit(0);
        }

        // Check if another Super Admin already exists
        const existingSuperAdmin = await models.User.findOne({ role: 'superAdmin' });
        if (existingSuperAdmin) {
            console.error('\x1b[31m%s\x1b[0m', `Error: A Super Admin already exists (${existingSuperAdmin.email}).`);
            console.log('Only one Super Admin is allowed in the system.');
            process.exit(1);
        }

        user.role = 'superAdmin';
        await user.save();

        console.log('\x1b[32m%s\x1b[0m', '--------------------------------------------------');
        console.log('\x1b[32m%s\x1b[0m', `SUCCESS: User "${user.email}" has been promoted to Super Admin.`);
        console.log('You can now log in with this account to manage all roles.');
        console.log('\x1b[32m%s\x1b[0m', '--------------------------------------------------');

        process.exit(0);
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', 'An unexpected error occurred:');
        console.error(error.message || error);
        process.exit(1);
    }
}

initSuperAdmin();
