import { db } from '@vercel/postgres';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const authHeader = req.headers['x-user-auth'];
  const user = authHeader ? JSON.parse(authHeader) : null;

  if (!user || !user.id) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }

  try {
    const client = await db.connect();

    if (req.method === 'POST') {
      await client.sql`
        CREATE TABLE IF NOT EXISTS giveaway_entries (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL UNIQUE,
          username TEXT NOT NULL,
          email TEXT,
          joined_at TIMESTAMP DEFAULT NOW()
        );
      `;

      const existing = await client.sql`
        SELECT user_id FROM giveaway_entries WHERE user_id = ${user.id};
      `;

      if (existing.rows.length > 0) {
        return res.status(200).json({ success: true, message: 'Already joined' });
      }

      await client.sql`
        INSERT INTO giveaway_entries (user_id, username, email)
        VALUES (${user.id}, ${user.username || 'Anonymous'}, ${user.email || ''});
      `;

      return res.status(200).json({ success: true, message: 'Joined successfully' });
    }

    if (req.method === 'GET') {
      const countResult = await client.sql`
        SELECT COUNT(*) as total FROM giveaway_entries;
      `;

      const allResult = await client.sql`
        SELECT user_id, username, joined_at FROM giveaway_entries ORDER BY joined_at DESC;
      `;

      return res.status(200).json({
        success: true,
        total: parseInt(countResult.rows[0].total),
        participants: allResult.rows
      });
    }

    client.release();
    
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Database error' });
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
