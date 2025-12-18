import { config } from "dotenv";
import pg from "pg";

config();

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function deleteUser(username) {
  await client.connect();
  
  console.log(`Looking for user: ${username}`);
  
  // Find user
  const userResult = await client.query(
    'SELECT id, username, "telegramId" FROM "User" WHERE username = $1',
    [username]
  );
  
  if (userResult.rows.length === 0) {
    console.log("❌ User not found");
    await client.end();
    return;
  }
  
  const user = userResult.rows[0];
  console.log("Found user:", user);
  
  const userId = user.id;
  
  // Get session IDs
  const sessions = await client.query(
    'SELECT id FROM "QuizSession" WHERE "userId" = $1',
    [userId]
  );
  const sessionIds = sessions.rows.map(s => s.id);
  
  // Delete in order
  if (sessionIds.length > 0) {
    const del1 = await client.query(
      'DELETE FROM "Answer" WHERE "sessionId" = ANY($1)',
      [sessionIds]
    );
    console.log(`✓ Deleted ${del1.rowCount} answers`);
  }
  
  const del2 = await client.query('DELETE FROM "QuizSession" WHERE "userId" = $1', [userId]);
  console.log(`✓ Deleted ${del2.rowCount} sessions`);
  
  const del3 = await client.query('DELETE FROM "UserAchievement" WHERE "userId" = $1', [userId]);
  console.log(`✓ Deleted ${del3.rowCount} achievements`);
  
  const del4 = await client.query('DELETE FROM "ChatMessage" WHERE "userId" = $1', [userId]);
  console.log(`✓ Deleted ${del4.rowCount} chat messages`);
  
  const del5 = await client.query('DELETE FROM "WeeklyScore" WHERE "userId" = $1', [userId]);
  console.log(`✓ Deleted ${del5.rowCount} weekly scores`);
  
  const del6 = await client.query('DELETE FROM "WeeklyWinner" WHERE "userId" = $1', [userId]);
  console.log(`✓ Deleted ${del6.rowCount} weekly winners`);
  
  const del7 = await client.query('DELETE FROM "LeaderboardEntry" WHERE "userId" = $1', [userId]);
  console.log(`✓ Deleted ${del7.rowCount} leaderboard entries`);
  
  const del8 = await client.query(
    'DELETE FROM "Friendship" WHERE "userId" = $1 OR "friendId" = $1',
    [userId]
  );
  console.log(`✓ Deleted ${del8.rowCount} friendships`);
  
  // Clear referrals
  const upd1 = await client.query(
    'UPDATE "User" SET "referredById" = NULL WHERE "referredById" = $1',
    [userId]
  );
  console.log(`✓ Cleared ${upd1.rowCount} referral links`);
  
  // Delete user
  await client.query('DELETE FROM "User" WHERE id = $1', [userId]);
  console.log(`\n🗑️ User "${username}" (ID: ${userId}) deleted!`);
  
  await client.end();
}

const username = process.argv[2] || "ytiputishka1";
deleteUser(username).catch(console.error);
