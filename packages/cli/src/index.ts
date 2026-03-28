#!/usr/bin/env bun

export {};

const command = process.argv[2];

switch (command) {
  case 'serve':
    await import('./commands/serve');
    break;

  case 'open':
    await import('./commands/open');
    break;

  case 'status':
    await import('./commands/status');
    break;

  case '--help':
  case '-h':
  case undefined:
    printUsage();
    break;

  default:
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
}

function printUsage(): void {
  console.log(`
webmux — modern web client for tmux

Usage:
  webmux serve [options]     Start the bridge daemon
  webmux open <resource>     Open rich content in a pane
  webmux status              Show session and bridge status

Options for 'serve':
  --port, -p <port>       WebSocket port (default: 7400)
  --host, -h <host>       Bind address (default: 127.0.0.1)
  --poll-interval <ms>    tmux polling interval (default: 500)

Examples:
  webmux serve
  webmux open https://example.com
  webmux open gh:owner/repo/pull/123
  webmux status
`.trim());
}
