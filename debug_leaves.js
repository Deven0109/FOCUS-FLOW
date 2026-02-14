const mongoose = require('mongoose');
const Leave = require('./models/leave');
const User = require('./models/users');
require('dotenv').config();

mongoose.connect(process.env.DATABASE_URL)
    .then(async () => {
        console.log('Connected to DB');

        console.log('--- Checking Leaves ---');
        const count = await Leave.countDocuments();
        console.log(`Total leaves in DB: ${count}`);

        const allLeaves = await Leave.find({});
        console.log('All Leaves:', JSON.stringify(allLeaves, null, 2));

        console.log('--- Checking Users ---');
        const userCount = await User.countDocuments();
        console.log(`Total users: ${userCount}`);

        console.log('--- Checking Approved Leaves with Populated User ---');
        const validLeaves = await Leave.find({ status: 'approved' }).populate('user');
        console.log(`Valid leaves found: ${validLeaves.length}`);

        validLeaves.forEach(l => {
            console.log(`Leaf ID: ${l._id}, User: ${l.user ? l.user.name : 'MISSING'}, From: ${l.fromDate}, To: ${l.toDate}`);
        });

        mongoose.connection.close();
    })
    .catch(err => console.error(err));
