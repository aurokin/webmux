import { test, expect, type Page } from '@playwright/test'
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
    await takeControl(page)

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
    await takeControl(page)

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
    await takeControl(page)

    await stack.restartBridge()
    await page.waitForTimeout(2500)
    await takeControl(page)

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

  test('transfers control and release between two browser clients', async ({ browser }) => {
    const ownerPage = await browser.newPage()
    const observerPage = await browser.newPage()

    await ownerPage.goto(stack.appUrl(), { waitUntil: 'networkidle' })
    await observerPage.goto(stack.appUrl(), { waitUntil: 'networkidle' })
    await ownerPage.waitForSelector('.xterm')
    await observerPage.waitForSelector('.xterm')

    await selectSession(ownerPage, stack.sessionName)
    await selectSession(observerPage, stack.sessionName)
    await takeControl(ownerPage)

    await ownerPage.locator('.xterm').first().click()
    await ownerPage.keyboard.type('owner-a')
    await ownerPage.keyboard.press('Enter')
    await ownerPage.waitForTimeout(800)

    await expect(ownerPage.getByTestId('ownership-mode')).toContainText('active')
    await expect(observerPage.getByTestId('ownership-mode')).toContainText('passive')
    expect(stack.capturePane(stack.sessionName)).toContain('owner-a')
    expect(stack.activeWindowName(stack.sessionName)).toBe('cat')

    await observerPage.getByText('logs').click()
    await observerPage.waitForTimeout(500)

    expect(stack.activeWindowName(stack.sessionName)).toBe('cat')

    await observerPage.locator('.xterm').first().click()
    await observerPage.keyboard.type('blocked-b')
    await observerPage.keyboard.press('Enter')
    await observerPage.waitForTimeout(800)

    expect(stack.capturePane(stack.sessionName)).not.toContain('blocked-b')

    await observerPage.getByTestId('take-control-button').click()
    await expect(observerPage.getByTestId('ownership-mode')).toContainText('active')
    await expect(ownerPage.getByTestId('ownership-mode')).toContainText('passive')

    await observerPage.locator('.xterm').first().click()
    await observerPage.keyboard.type('owner-b')
    await observerPage.keyboard.press('Enter')
    await observerPage.waitForTimeout(800)

    expect(stack.capturePane(stack.sessionName)).toContain('owner-b')

    await observerPage.getByTestId('release-control-button').click()
    await expect(observerPage.getByTestId('ownership-mode')).toContainText('unclaimed')
    await expect(ownerPage.getByTestId('ownership-mode')).toContainText('unclaimed')

    await takeControl(ownerPage)
    await ownerPage.locator('.xterm').first().click()
    await ownerPage.keyboard.type('after-release')
    await ownerPage.keyboard.press('Enter')
    await ownerPage.waitForTimeout(800)

    await expect(ownerPage.getByTestId('ownership-mode')).toContainText('active')
    expect(stack.capturePane(stack.sessionName)).toContain('after-release')

    await ownerPage.close()
    await observerPage.close()
  })
})

function captureEither(stack: WebmuxE2EStack, text: string): boolean {
  return [stack.sessionName, stack.secondarySessionName].some((sessionName) =>
    stack.capturePane(sessionName).includes(text),
  )
}

async function selectSession(page: Page, sessionName: string): Promise<void> {
  await page.getByTestId('session-switcher-button').click()
  await page.getByPlaceholder('Filter sessions...').fill(sessionName)
  await page.getByTestId(`session-option-${sessionName}`).click()
  await expect(page.locator('body')).toContainText(sessionName)
}

async function takeControl(page: Page): Promise<void> {
  const claimButton = page.getByTestId('claim-control-button')
  if (await claimButton.isVisible().catch(() => false)) {
    await claimButton.click()
    await expect(page.getByTestId('ownership-mode')).toContainText('active')
  }
}
