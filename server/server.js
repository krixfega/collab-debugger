require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '20mb' }));

const s3 = new S3Client({ region: process.env.AWS_REGION });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Upload to S3 with retries and exponential backoff
 */
async function uploadToS3WithRetry(params, maxRetries = 3) {
  let attempt = 0;
  let delay = 500;
  while (true) {
    try {
      return await s3.send(new PutObjectCommand(params));
    } catch (err) {
      attempt++;
      if (attempt > maxRetries) {
        throw err;
      }
      console.warn(`S3 upload failed (attempt ${attempt}), retrying in ${delay}ms`, err);
      await new Promise((res) => setTimeout(res, delay));
      delay *= 2;
    }
  }
}

/**
 * POST /sessions
 * Accepts sessionId, metadata, and events; stores events in S3 and metadata in Postgres
 */
app.post('/sessions', async (req, res) => {
  const { sessionId, metadata, events } = req.body;
  if (!sessionId || !events) {
    return res.status(400).json({ error: 'Missing sessionId or events' });
  }

  const key = `sessions/${sessionId}.json`;
  try {
    await uploadToS3WithRetry({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: JSON.stringify(events),
      ContentType: 'application/json'
    });

    await pool.query(
      'INSERT INTO sessions(id, key, user_id, branch) VALUES($1,$2,$3,$4)',
      [sessionId, key, metadata.userId, metadata.branch]
    );

    res.status(201).json({ sessionId });
  } catch (err) {
    console.error('Error storing session:', err);
    res.status(500).json({ error: 'Failed to store session' });
  }
});

/**
 * GET /sessions
 * Returns list of stored session metadata
 */
app.get('/sessions', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, user_id, branch, created_at FROM sessions ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching sessions list:', err);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

/**
 * GET /sessions/:id/blob
 * Streams the raw JSON events from S3
 */
app.get('/sessions/:id/blob', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query('SELECT key FROM sessions WHERE id = $1', [id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const key = rows[0].key;
    const data = await s3.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
    res.set('Content-Type', 'application/json');
    data.Body.pipe(res).on('error', (err) => {
      console.error('Error streaming S3 object:', err);
      res.status(500).end();
    });
  } catch (err) {
    console.error('Error retrieving session blob:', err);
    res.status(500).json({ error: 'Failed to retrieve session blob' });
  }
});

// Start the server
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Debugger server listening on port ${port}`));