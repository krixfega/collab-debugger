require('dotenv').config();
const { use, startSession, endSession } = require('./recorder');
const { memoryPlugin, errorCountPlugin } = require('./plugin-samples');
const dbTracerPlugin = require('./plugin-db-tracer');
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  use(memoryPlugin(1000));
  use(errorCountPlugin());
  use(dbTracerPlugin(pool));

  startSession({ userId: 'chris', branch: 'integration-test' });

  console.log('Integration test started');

  const res = await pool.query('SELECT NOW() as now');
  console.log('DB time:', res.rows[0].now);

  console.error('This is a test error');

  await new Promise(r => setTimeout(r, 2500));

  console.log('🏁 Ending integration test session');

  await endSession();


  await pool.end();
})();