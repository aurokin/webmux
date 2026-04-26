/**
 * webmux open <resource>
 *
 * In a webmux web client (WEBMUX_RICH_CLIENT=1): emits escape sequence for webview upgrade.
 * In a regular terminal: prints text fallback.
 *
 * See docs/cli/stub-protocol.md for protocol details.
 */

import { planOpenCommand, renderOpenUsage } from '../open'

export {}

const resource = process.argv[3]

const plan = planOpenCommand(resource, {
  richClient: process.env.WEBMUX_RICH_CLIENT === '1',
})

if (!plan.ok) {
  console.error(plan.error)
  if (!resource) {
    console.error('')
    console.error(renderOpenUsage())
  }
  process.exit(1)
}

process.stdout.write(plan.output)

if (plan.keepAlive) {
  // The web client closing the webview pane will kill this process.
  await new Promise(() => {})
}
