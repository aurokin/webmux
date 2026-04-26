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
    await expect(observerPage.locator('.xterm').first()).toContainText('owner-a')

    await observerPage.locator('.xterm').first().click()
    await observerPage.keyboard.type('owner-b')
    await observerPage.keyboard.press('Enter')
    await observerPage.waitForTimeout(800)

    expect(stack.capturePane(stack.sessionName)).toContain('owner-b')

    await observerPage.getByTestId('release-control-button').click()
    await expect(observerPage.getByTestId('ownership-mode')).toContainText('unclaimed')
    await expect(ownerPage.getByTestId('ownership-mode')).toContainText('unclaimed')
    await expect(observerPage.locator('.xterm').first()).toContainText('owner-b')

    await takeControl(ownerPage)
    await expect(ownerPage.locator('.xterm').first()).toContainText('owner-b')
    await ownerPage.locator('.xterm').first().click()
    await ownerPage.keyboard.type('after-release')
    await ownerPage.keyboard.press('Enter')
    await ownerPage.waitForTimeout(800)

    await expect(ownerPage.getByTestId('ownership-mode')).toContainText('active')
    expect(stack.capturePane(stack.sessionName)).toContain('after-release')

    await ownerPage.close()
    await observerPage.close()
  })

  test('wires pane zoom from the browser to tmux state', async ({ page }) => {
    await page.goto(stack.appUrl(), { waitUntil: 'networkidle' })
    await page.waitForSelector('.xterm')
    await selectSession(page, stack.sessionName)
    await takeControl(page)

    expect(stack.windowZoomedFlag(stack.sessionName)).toBe('0')

    await page.locator('[data-testid^="split-horizontal-"]').first().click({ force: true })
    await expect.poll(() => stack.paneCount(stack.sessionName)).toBeGreaterThan(1)
    await expect(page.locator('[data-testid^="zoom-pane-"]')).toHaveCount(2)

    await page.locator('[data-testid^="zoom-pane-"]').first().click({ force: true })

    await expect.poll(() => stack.windowZoomedFlag(stack.sessionName)).toBe('1')
  })

  test('creates a named session from the session switcher and selects it', async ({ page }) => {
    const sessionName = `webmux-ui-create-${crypto.randomUUID().slice(0, 8)}`

    await page.goto(stack.appUrl(), { waitUntil: 'networkidle' })
    await page.waitForSelector('.xterm')
    await selectSession(page, stack.sessionName)
    await takeControl(page)

    await createNamedSessionFromSwitcher(page, sessionName)

    await expect(page.locator('body')).toContainText(sessionName)
    await expect(page.getByTestId('ownership-mode')).toContainText('active')
    expect(stack.sessionExists(sessionName)).toBe(true)
  })

  test('kills the selected session from the sidebar and refreshes visible state', async ({
    page,
  }) => {
    const sessionName = `webmux-ui-kill-${crypto.randomUUID().slice(0, 8)}`

    await page.goto(stack.appUrl(), { waitUntil: 'networkidle' })
    await page.waitForSelector('.xterm')
    await selectSession(page, stack.sessionName)
    await takeControl(page)
    await createNamedSessionFromSwitcher(page, sessionName)

    await page.getByTestId('kill-session-button').click()
    await expect(page.getByTestId('kill-session-button')).toContainText('Confirm')
    await page.getByTestId('kill-session-button').click()

    await expect.poll(() => stack.sessionExists(sessionName)).toBe(false)
    await expect(page.locator('body')).not.toContainText(sessionName)
  })

  test('shows visible mutation feedback when a passive client tries to mutate', async ({
    browser,
  }) => {
    const ownerPage = await browser.newPage()
    const observerPage = await browser.newPage()

    await ownerPage.addInitScript(() => {
      localStorage.setItem('webmux:preferences', JSON.stringify({ tabPosition: 'top' }))
    })
    await observerPage.addInitScript(() => {
      localStorage.setItem('webmux:preferences', JSON.stringify({ tabPosition: 'top' }))
    })

    await ownerPage.goto(stack.appUrl(), { waitUntil: 'networkidle' })
    await observerPage.goto(stack.appUrl(), { waitUntil: 'networkidle' })
    await ownerPage.waitForSelector('.xterm')
    await observerPage.waitForSelector('.xterm')

    await selectSession(ownerPage, stack.sessionName)
    await selectSession(observerPage, stack.sessionName)
    await takeControl(ownerPage)

    await observerPage.locator('[data-testid^="zoom-pane-"]').first().click({ force: true })

    await expect(observerPage.getByTestId('mutation-notice')).toContainText('Take control first')

    await observerPage.getByTestId('new-window-button').click()

    await expect(observerPage.getByTestId('mutation-notice')).toContainText('Take control first')

    await ownerPage.close()
    await observerPage.close()
  })

  test('shows a destroyed-session state and recovers by selecting another session', async ({
    page,
  }) => {
    await page.goto(stack.appUrl(), { waitUntil: 'networkidle' })
    await page.waitForSelector('.xterm')
    await selectSession(page, stack.sessionName)

    stack.killSession(stack.sessionName)

    await expect(page.locator('body')).toContainText(`Session ended: ${stack.sessionName}`)
    await expect(page.locator('body')).toContainText('Select another live tmux session')

    await selectSession(page, stack.secondarySessionName)
    await expect(page.locator('body')).not.toContainText(`Session ended: ${stack.sessionName}`)
    await page.waitForSelector('.xterm')
    await takeControl(page)

    await page.locator('.xterm').first().click()
    await page.keyboard.type('after-destroyed-session')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(800)

    expect(stack.capturePane(stack.secondarySessionName)).toContain('after-destroyed-session')
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

async function createNamedSessionFromSwitcher(page: Page, sessionName: string): Promise<void> {
  await page.getByTestId('session-switcher-button').click()
  await page.getByPlaceholder('Filter sessions...').fill(sessionName)
  await page.getByTestId('create-session-from-switcher').click()
  await expect(page.locator('body')).toContainText(sessionName)
}

async function takeControl(page: Page): Promise<void> {
  const claimButton = page.getByTestId('claim-control-button')
  if (await claimButton.isVisible().catch(() => false)) {
    await claimButton.click()
    await expect(page.getByTestId('ownership-mode')).toContainText('active')
  }
}
