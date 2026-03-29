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

    await expect(page.locator('body')).toContainText(stack.sessionName)

    await page.locator('.xterm').first().click()
    await page.keyboard.type('webmux-e2e')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(800)

    expect(stack.capturePane()).toContain('webmux-e2e')
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

    expect(stack.capturePane()).toContain('bridge-restarted')
  })
})
