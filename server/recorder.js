require('dotenv').config();
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const REDACT_PATTERNS = [/password/i, /token/i, /authorization/i];

let events = [];
let sessionMetadata = {};
let sessionId;
const plugins = [];

/**
 * Register a plugin. Plugin may implement onStart, onEvent, onEnd hooks.
 * @param {{onStart?: Function, onEvent?: Function, onEnd?: Function}} plugin
 */
function use(plugin) {
  plugins.push(plugin);
}

/**
 * Broadcast an event to internal store and all plugins
 */
function broadcastEvent(event) {
  events.push(event);
  for (const plugin of plugins) {
    try {
      if (typeof plugin.onEvent === 'function') {
        plugin.onEvent(event);
      }
    } catch (err) {
      console.warn('Plugin onEvent error:', err);
    }
  }
}

/**
 * Deep redacts sensitive fields in an object
 */
function redact(obj) {
  try {
    if (obj == null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(redact);
    const clone = {};
    for (const [key, value] of Object.entries(obj)) {
      if (REDACT_PATTERNS.some(pat => pat.test(key))) {
        clone[key] = '***REDACTED***';
      } else if (typeof value === 'object') {
        clone[key] = redact(value);
      } else if (typeof value === 'string') {
        let s = value;
        REDACT_PATTERNS.forEach(pat => {
          const inlineRegex = new RegExp(`${pat.source}\\s*(?:=|:|is)\\s*[^\\s,;]+`, 'gi');
          s = s.replace(inlineRegex, '***REDACTED***');
        });
        REDACT_PATTERNS.forEach(pat => {
          s = s.replace(pat, '***REDACTED***');
        });
        clone[key] = s;
      } else {
        clone[key] = value;
      }
    }
    return clone;
  } catch (_) {
    return '***UNREDACTABLE***';
  }
}

/**
 * Redact sensitive data in a standalone string
 */
function redactString(value) {
  let s = value;
  REDACT_PATTERNS.forEach(pat => {
    const inlineRegex = new RegExp(`${pat.source}\\s*(?:=|:|is)\\s*[^\\s,;]+`, 'gi');
    s = s.replace(inlineRegex, '***REDACTED***');
  });
  REDACT_PATTERNS.forEach(pat => {
    s = s.replace(pat, '***REDACTED***');
  });
  return s;
}

/**
 * Wrap console methods to capture logs
 */
function overrideConsole() {
  ['log', 'warn', 'error'].forEach(level => {
    const orig = console[level].bind(console);
    console[level] = (...args) => {
      try {
        const payload = args.map(arg => {
          if (typeof arg === 'object') return redact(arg);
          if (typeof arg === 'string') return redactString(arg);
          return arg;
        });
        broadcastEvent({ timestamp: Date.now(), type: 'console', level, payload });
      } catch (_) {}
      orig(...args);
    };
  });
}

/**
 * Wrap axios to capture HTTP events
 */
function overrideAxios() {
  axios.interceptors.request.use(req => {
    try {
      broadcastEvent({ timestamp: Date.now(), type: 'http-request', method: req.method, url: redactString(req.url), data: redact(req.data) });
    } catch (_) {}
    return req;
  }, err => Promise.reject(err));

  axios.interceptors.response.use(res => {
    try {
      broadcastEvent({ timestamp: Date.now(), type: 'http-response', status: res.status, data: redact(res.data) });
    } catch (_) {}
    return res;
  }, err => {
    try {
      const { response } = err;
      broadcastEvent({ timestamp: Date.now(), type: 'http-error', status: response?.status, data: redact(response?.data) });
    } catch (_) {}
    return Promise.reject(err);
  });
}

/**
 * Capture arbitrary snapshot of data
 * @param {string} name - identifier for the snapshot
 * @param {object} data - the data to record
 */
function snapshot(name, data) {
  try {
    broadcastEvent({ timestamp: Date.now(), type: 'snapshot', name, data: redact(data) });
  } catch (_) {}
}

/**
 * Start a new session. Call at top of your app.
 */
function startSession({ userId = 'unknown', branch = 'main' } = {}) {
  sessionId = uuidv4();
  sessionMetadata = { userId, branch };
  broadcastEvent({ timestamp: Date.now(), type: 'session-start', sessionId, userId, branch });
  for (const plugin of plugins) {
    try {
      if (typeof plugin.onStart === 'function') plugin.onStart({ sessionId, userId, branch });
    } catch (err) {
      console.warn('Plugin onStart error:', err);
    }
  }
  overrideConsole();
  overrideAxios();
}

/**
 * End session and upload blob
 */
async function endSession() {
  broadcastEvent({ timestamp: Date.now(), type: 'session-end', sessionId });
  for (const plugin of plugins) {
    try {
      if (typeof plugin.onEnd === 'function') plugin.onEnd({ sessionId, events });
    } catch (err) {
      console.warn('Plugin onEnd error:', err);
    }
  }
  const payload = { sessionId, metadata: sessionMetadata, events };
  try {
    await axios.post(`${process.env.DEBUGGER_SERVER_URL}/sessions`, payload);
    console.log(`Session ${sessionId} uploaded`);
  } catch (err) {
    console.error('Failed to upload session:', err.message);
  }
}

module.exports = { use, startSession, endSession, snapshot };