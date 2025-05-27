const { snapshot } = require('./recorder');

/**
 * Memory Usage Plugin
 * Takes a snapshot of process.memoryUsage() every intervalMs milliseconds
 */
function memoryPlugin(intervalMs = 5000) {
  let timerId;
  return {
    onStart: () => {
      timerId = setInterval(() => snapshot('memory-usage', process.memoryUsage()), intervalMs);
    },
    onEnd: () => {
      clearInterval(timerId);
    }
  };
}

/**
 * Error Count Plugin
 * Counts console.error events and logs the total at session end
 */
function errorCountPlugin() {
  let errorCount = 0;
  return {
    onEvent: (event) => {
      if (event.type === 'console' && event.level === 'error') {
        errorCount++;
      }
    },
    onEnd: () => {
      console.log(`Total console.error calls during session: ${errorCount}`);
    }
  };
}

module.exports = { memoryPlugin, errorCountPlugin };