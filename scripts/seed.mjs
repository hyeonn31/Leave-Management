/**
 * Test data seed script
 * Usage: node scripts/seed.mjs
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

const db = drizzle(process.env.DATABASE_URL);

// Import tables via dynamic import to handle ESM
const { users, employees, leaveBalances, leaveRequests } = await import("../drizzle/schema.js").catch(async () => {
  // Fallback: use raw SQL
  return {};
});

const connection = await mysql.createConnection(process.env.DATABASE_URL);

try {
  console.log("🌱 Seeding test data...");

  // Check if we already have test users
  const [existing] = await connection.execute("SELECT COUNT(*) as count FROM users");
  if (existing[0].count > 0) {
    console.log("⚠️  Data already exists. Skipping seed.");
    process.exit(0);
  }

  // Insert test users
  await connection.execute(`
    INSERT INTO users (openId, name, email, loginMethod, role, createdAt, updatedAt, lastSignedIn) VALUES
    ('test-user-001', '김민준', 'minjun.kim@company.com', 'test', 'user', NOW(), NOW(), NOW()),
    ('test-user-002', '이서연', 'seoyeon.lee@company.com', 'test', 'user', NOW(), NOW(), NOW()),
    ('test-user-003', '박지호', 'jiho.park@company.com', 'test', 'user', NOW(), NOW(), NOW()),
    ('test-user-004', '최수아', 'sua.choi@company.com', 'test', 'user', NOW(), NOW(), NOW()),
    ('test-admin-001', '정HR관리자', 'hr.admin@company.com', 'test', 'admin', NOW(), NOW(), NOW())
  `);

  // Get inserted user IDs
  const [userRows] = await connection.execute("SELECT id, openId FROM users WHERE openId LIKE 'test-%'");
  const userMap = {};
  for (const row of userRows) {
    userMap[row.openId] = row.id;
  }

  // Insert employee profiles
  const today = new Date();
  const entries = [
    { openId: 'test-user-001', num: 'EMP-001', dept: '개발팀', pos: '선임 개발자', entry: '2020-03-15' },
    { openId: 'test-user-002', num: 'EMP-002', dept: '디자인팀', pos: '시니어 디자이너', entry: '2021-07-01' },
    { openId: 'test-user-003', num: 'EMP-003', dept: '개발팀', pos: '주니어 개발자', entry: '2024-01-10' },
    { openId: 'test-user-004', num: 'EMP-004', dept: '마케팅팀', pos: '마케팅 매니저', entry: '2019-05-20' },
    { openId: 'test-admin-001', num: 'EMP-005', dept: 'HR팀', pos: 'HR 매니저', entry: '2018-02-01' },
  ];

  for (const e of entries) {
    const userId = userMap[e.openId];
    if (!userId) continue;
    await connection.execute(
      `INSERT INTO employees (userId, employeeNumber, department, position, entryDate, status) VALUES (?, ?, ?, ?, ?, 'active')`,
      [userId, e.num, e.dept, e.pos, e.entry]
    );
  }

  // Calculate and insert leave balances for 2025 and 2026
  const currentYear = today.getFullYear();
  for (const year of [currentYear - 1, currentYear]) {
    for (const e of entries) {
      const userId = userMap[e.openId];
      if (!userId) continue;

      const entryDate = new Date(e.entry);
      const refDate = new Date(year, 0, 1);
      const totalMonths = (refDate.getFullYear() - entryDate.getFullYear()) * 12 +
        (refDate.getMonth() - entryDate.getMonth());
      const yearsOfService = Math.floor(totalMonths / 12);

      let totalDays;
      if (yearsOfService < 1) {
        totalDays = Math.min(totalMonths, 11);
      } else {
        const bonus = Math.floor((yearsOfService - 1) / 2);
        totalDays = Math.min(15 + bonus, 25);
      }

      const used = year === currentYear ? Math.floor(Math.random() * (totalDays / 2)) : Math.floor(totalDays * 0.6);
      const remaining = totalDays - used;

      await connection.execute(
        `INSERT INTO leave_balances (userId, fiscalYear, totalGranted, used, remaining) VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE totalGranted=VALUES(totalGranted), used=VALUES(used), remaining=VALUES(remaining)`,
        [userId, year, totalDays, used, remaining]
      );
    }
  }

  // Insert sample leave requests for current year
  const user1 = userMap['test-user-001'];
  const user2 = userMap['test-user-002'];
  const user3 = userMap['test-user-003'];
  const adminId = userMap['test-admin-001'];

  if (user1 && user2 && user3 && adminId) {
    await connection.execute(`
      INSERT INTO leave_requests (userId, leaveType, startDate, endDate, totalDays, reason, status, approverId, approvedAt) VALUES
      (?, 'annual', '${currentYear}-04-10', '${currentYear}-04-12', 3, '가족 여행', 'approved', ?, NOW()),
      (?, 'half_am', '${currentYear}-05-15', '${currentYear}-05-15', 0.5, '병원 방문', 'approved', ?, NOW()),
      (?, 'annual', '${currentYear}-06-20', '${currentYear}-06-21', 2, '개인 사유', 'pending', NULL, NULL),
      (?, 'sick', '${currentYear}-03-05', '${currentYear}-03-06', 2, '독감', 'approved', ?, NOW())
    `, [user1, adminId, user2, adminId, user3, user1, adminId]);
  }

  // Insert sample notifications
  if (user1 && adminId) {
    await connection.execute(`
      INSERT INTO notifications (userId, type, title, message, isRead) VALUES
      (?, 'leave_approved', '연차 신청 승인', '4월 10일~12일 연차가 승인되었습니다.', true),
      (?, 'leave_request_submitted', '새 연차 신청', '박지호님이 연차를 신청했습니다.', false)
    `, [user1, adminId]);
  }

  console.log("✅ Seed completed successfully!");
  console.log("   - 5 test users (4 employees + 1 admin)");
  console.log("   - Employee profiles with entry dates");
  console.log("   - Leave balances for", currentYear - 1, "and", currentYear);
  console.log("   - Sample leave requests and notifications");

} catch (err) {
  console.error("❌ Seed failed:", err);
  process.exit(1);
} finally {
  await connection.end();
}
