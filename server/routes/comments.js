const express = require('express');
const router = express.Router({ mergeParams: true });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// GET /sessions/:id/comments
router.get('/', async (req, res) => {
  const sessionId = req.params.id;
  try {
    const result = await pool.query(
      'SELECT id, session_id, event_index, user_id, text, created_at FROM comments WHERE session_id = $1 ORDER BY created_at',
      [sessionId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching comments', err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// POST /sessions/:id/comments
router.post('/', async (req, res) => {
  const sessionId = req.params.id;
  const { event_index, user_id, text } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO comments(session_id, event_index, user_id, text)
       VALUES($1, $2, $3, $4)
       RETURNING id, session_id, event_index, user_id, text, created_at`,
      [sessionId, event_index, user_id, text]
    );
    const comment = result.rows[0];
    const io = req.app.get('io');
    if (io) io.to(sessionId).emit('new-comment', comment);
    res.json(comment);
  } catch (err) {
    console.error('Error creating comment', err);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

module.exports = router;
