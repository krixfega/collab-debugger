import * as vscode from 'vscode';
import { exec } from 'child_process';

export function activate(context: vscode.ExtensionContext) {
  const startCmd = vscode.commands.registerCommand('extension.startSession', () => {
    const workspace = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    vscode.window.showInputBox({ prompt: 'Session ID' }).then(sessionId => {
      if (!sessionId || !workspace) return;
      const cmd = `node path/to/recorder-cli start --session ${sessionId}`;
      exec(cmd, { cwd: workspace });
      vscode.window.showInformationMessage(`Started session ${sessionId}`);
    });
  });

  const replayCmd = vscode.commands.registerCommand('extension.replaySession', () => {
    vscode.window.showInputBox({ prompt: 'Session ID to replay' }).then(sessionId => {
      if (!sessionId) return;
      vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(`http://localhost:5173/sessions/${sessionId}`));
    });
  });

  context.subscriptions.push(startCmd, replayCmd);
}