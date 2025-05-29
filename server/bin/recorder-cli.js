#!/usr/bin/env node
require('dotenv').config();
const { Command } = require('commander');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const program = new Command();
const API_BASE = process.env.API_BASE_URL || 'http://localhost:4000';

program
  .name('recorder-cli')
  .description('CLI to control session recording')
  .version('1.0.0');

program
  .command('start')
  .requiredOption('-s, --session <id>', 'Session ID')
  .action(async ({ session }) => {
    // Start recording: spawn your recorder or hit endpoint
    console.log(`Starting session ${session}`);
    // Example: call a local recorder process
    // Or send a POST to /start if you support it
  });

program
  .command('stop')
  .requiredOption('-s, --session <id>', 'Session ID')
  .action(async ({ session }) => {
    console.log(`Stopping session ${session}`);
    // Example: read local file and upload
    const file = path.join(process.cwd(), 'sessions', `${session}.json`);
    if (!fs.existsSync(file)) return console.error('Session file not found');
    const data = JSON.parse(fs.readFileSync(file));

    try {
      await axios.post(
        `${API_BASE}/sessions`,
        { sessionId: session, metadata: { userId: process.env.USER_ID, branch: process.env.GITHUB_REF }, events: data },
        { headers: { Authorization: `Bearer ${process.env.API_TOKEN}` } }
      );
      console.log('Uploaded session');
    } catch (err) {
      console.error('Upload failed', err.message);
      process.exit(1);
    }
  });

program.parse(process.argv);