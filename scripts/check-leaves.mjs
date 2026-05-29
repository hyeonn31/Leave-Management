import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(
  'SELECT id, userId, startDate, endDate, totalDays, status, leaveType FROM leave_requests LIMIT 20'
);
console.log('leave_requests rows:');
console.log(JSON.stringify(rows, null, 2));
await conn.end();
