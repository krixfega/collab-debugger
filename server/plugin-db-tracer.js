const { use, snapshot } = require('./recorder');

/**
 * Creates a plugin that intercepts pg.Pool queries and records them
 * @param {import('pg').Pool} pool - The PostgreSQL pool instance
 * @returns {object} Plugin with onStart and onEnd hooks
 */
function dbTracerPlugin(pool) {
  let originalQuery;
  return {
    onStart: () => {
      originalQuery = pool.query.bind(pool);
      pool.query = (...args) => {
        try {
          const [text, params] = args;
          snapshot('db-query', { sql: text, params });
        } catch (err) {
          console.warn('DB tracer snapshot error:', err);
        }
        return originalQuery(...args);
      };
    },
    onEnd: () => {
      if (originalQuery) {
        pool.query = originalQuery;
      }
    }
  };
}

// Example usage:
// const { Pool } = require('pg');
// const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// use(dbTracerPlugin(pool));
// startSession({ userId: 'chris', branch: 'feature/db-tracing' });
// // Perform your database operations as usual:
// await pool.query('SELECT * FROM users WHERE id = $1', [1]);
// endSession();

module.exports = dbTracerPlugin;