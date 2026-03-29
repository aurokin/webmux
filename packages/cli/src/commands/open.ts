/**
 * webmux open <resource>
 *
 * In a webmux web client (WEBMUX_RICH_CLIENT=1): emits escape sequence for webview upgrade.
 * In a regular terminal: prints text fallback.
 *
 * See docs/cli/stub-protocol.md for protocol details.
 */

export {}

const resource = process.argv[3]

if (!resource) {
  console.error('Usage: webmux open <resource>')
  console.error('')
  console.error('Examples:')
  console.error('  webmux open https://example.com')
  console.error('  webmux open gh:owner/repo/pull/123')
  console.error('  webmux open linear:ISS-423')
  console.error('  webmux open preview:localhost:3000')
  process.exit(1)
}

/**
 * Resolve a resource shorthand to a full URL.
 */
function resolveResource(resource: string): string {
  // GitHub PR shorthand: gh:owner/repo/pull/123
  const ghMatch = resource.match(/^gh:(.+\/pull\/\d+)$/)
  if (ghMatch) return `https://github.com/${ghMatch[1]}`

  // Linear shorthand: linear:ISS-423
  const linearMatch = resource.match(/^linear:(.+)$/)
  if (linearMatch) return `https://linear.app/issue/${linearMatch[1]}`

  // Preview shorthand: preview:localhost:3000
  const previewMatch = resource.match(/^preview:(.+)$/)
  if (previewMatch) return `http://${previewMatch[1]}`

  // Already a URL
  if (resource.startsWith('http://') || resource.startsWith('https://')) {
    return resource
  }

  // Assume https
  return `https://${resource}`
}

const url = resolveResource(resource)
const isRichClient = process.env.WEBMUX_RICH_CLIENT === '1'

if (isRichClient) {
  // Emit stub protocol escape sequence
  // OSC format: \033]webmux;type=webview;url=...\007
  process.stdout.write(`\x1b]webmux;type=webview;url=${url}\x07`)

  // Keep process alive — the pane stays open as long as the webview is shown.
  // The web client closing the webview pane will kill this process.
  await new Promise(() => {})
} else {
  // Text fallback for regular terminals
  console.log(`webmux: ${url}`)
  console.log('')
  console.log(`Open in browser or use webmux web client for rich preview.`)
  console.log(`Tip: Run 'webmux serve' and open the web client to see this as a webview.`)
}
