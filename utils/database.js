const mongoose = require('mongoose');

mongoose.connect(process.env.DATABASE_URL);
mongoose.connection.on('open', () => console.log(`Connect with database!`))
    .on('error', (error) => console.log(`Database Error: ${error}`));