const db = require('./db');

console.log(`SQLite database is ready: ${db.databasePath}`);
db.close();
