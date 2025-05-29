import * as path from 'path';
import { runTests, downloadAndUnzipVSCode } from 'vscode-test';

describe('Extension Tests', function() {
  this.timeout(600000);

  it('can activate extension', async () => {
    const extensionDevelopmentPath = path.resolve(__dirname, '../');
    const extensionTestsPath = path.resolve(__dirname, './extension.test.js');

    // Download VS Code, run the integration test suite
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      version: 'stable'
    });
  });
});