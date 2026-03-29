import { test, expect } from '@playwright/test'
import { WebmuxE2EStack } from './support/stack'

test.describe.serial('webmux browser validation', () => {
  const stack = new WebmuxE2EStack(process.cwd())

  test.beforeAll(async () => {
    await stack.start()
  })

  test.afterAll(async () => {
    await stack.stop()
  })

  test('renders a live tmux pane and forwards browser input to tmux', async ({ page }) => {
    await page.goto(stack.appUrl(), { waitUntil: 'networkidle' })
    await page.waitForSelector('.xterm')

    await page.locator('.xterm').first().click()
    await page.keyboard.type('webmux-e2e')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(800)

    expect(captureEither(stack, 'webmux-e2e')).toBe(true)
  })

  test('switches between live tmux sessions from the session picker', async ({ page }) => {
    await page.goto(stack.appUrl(), { waitUntil: 'networkidle' })
    await page.waitForSelector('.xterm')

    await page.getByTestId('session-switcher-button').click()
    await page.getByPlaceholder('Filter sessions...').fill(stack.secondarySessionName)
    await page.getByTestId(`session-option-${stack.secondarySessionName}`).click()

    await expect(page.locator('body')).toContainText(stack.secondarySessionName)

    await page.locator('.xterm').first().click()
    await page.keyboard.type('second-session')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(800)

    expect(stack.capturePane(stack.secondarySessionName)).toContain('second-session')
  })

  test('reconnects control and pane channels after the bridge restarts', async ({ page }) => {
    await page.goto(stack.appUrl(), { waitUntil: 'networkidle' })
    await page.waitForSelector('.xterm')

    await stack.restartBridge()
    await page.waitForTimeout(2500)

    await page.locator('.xterm').first().click()
    await page.keyboard.type('bridge-restarted')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1000)

    expect(captureEither(stack, 'bridge-restarted')).toBe(true)
  })

  test('shows an explicit authentication failure state for invalid tokens', async ({ page }) => {
    await page.goto(stack.appUrl('badtoken'), { waitUntil: 'networkidle' })

    await expect(page.locator('body')).toContainText('Authentication failed')
    await expect(page.locator('body')).toContainText('valid token')
  })
})

function captureEither(stack: WebmuxE2EStack, text: string): boolean {
  return [stack.sessionName, stack.secondarySessionName].some((sessionName) =>
    stack.capturePane(sessionName).includes(text),
  )
}
