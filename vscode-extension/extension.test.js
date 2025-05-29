const assert = require('assert');
const vscode = require('vscode');

describe('Collaborative Debugger', () => {
  it('runs startSession command', async () => {
    await vscode.commands.executeCommand('extension.startSession');
    assert.ok(true);
  });
});