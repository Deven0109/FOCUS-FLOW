const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const models = require('../models/zindex');
const { encrypt } = require('../utils/encryption');

/**
 * Super Admin Creation Script
 * Usage: node scripts/createSuperAdmin.js <email> <password> <name>
 */

async function createSuperAdmin() {
    const email = process.argv[2] || 'superadmin@itfuturz.com';
    const password = process.argv[3] || 'superadmin@123';
    const name = process.argv[4] || 'Super Admin';

    try {
        console.log('Connecting to database...');
        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL is not defined in .env file');
        }
        await mongoose.connect(process.env.DATABASE_URL);
        console.log('Connected successfully!');

        // Check if a Super Admin already exists
        const existingSuperAdmin = await models.User.findOne({ role: 'superAdmin' });
        if (existingSuperAdmin) {
            console.error('\x1b[31m%s\x1b[0m', `Error: A Super Admin already exists (${existingSuperAdmin.email}).`);
            console.log('Only one Super Admin is allowed in the system.');
            console.log('If you want to replace them, delete the existing one first or use initSuperAdmin.js to promote another.');
            process.exit(1);
        }

        // Check if a user with this email already exists
        const existingUser = await models.User.findOne({ email: new RegExp('^' + email + '$', 'i') });
        if (existingUser) {
            console.error('\x1b[31m%s\x1b[0m', `Error: A user with email "${email}" already exists.`);
            console.log('Use node scripts/initSuperAdmin.js <email> to promote an existing user.');
            process.exit(1);
        }

        const newUser = new models.User({
            name: name,
            email: email,
            password: encrypt(password),
            role: 'superAdmin',
            isActive: true,
            jobTitle: 'Super Admin',
            mobile: '0000000000', // Placeholder
            workType: 'onsite'
        });

        await newUser.save();

        console.log('\x1b[32m%s\x1b[0m', '--------------------------------------------------');
        console.log('\x1b[32m%s\x1b[0m', `SUCCESS: Super Admin created successfully!`);
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);
        console.log('--------------------------------------------------');

        process.exit(0);
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', 'An unexpected error occurred:');
        console.error(error.message || error);
        process.exit(1);
    }
}

createSuperAdmin();
