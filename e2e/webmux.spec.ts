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

  test('buffers pane input locally until Enter sends the composed line', async ({ page }) => {
    const sessionName = `webmux-buffered-${crypto.randomUUID().slice(0, 8)}`
    const marker = `buffered-e2e-${crypto.randomUUID().slice(0, 8)}`
    const afterBlankMarker = `after-blank-${crypto.randomUUID().slice(0, 8)}`
    const directAfterExitMarker = `direct-after-exit-${crypto.randomUUID().slice(0, 8)}`
    const sentPaneFrames: string[] = []
    page.on('websocket', (socket) => {
      if (!socket.url().includes('/pane/')) {
        return
      }

      socket.on('framesent', (event) => {
        sentPaneFrames.push(
          typeof event.payload === 'string' ? event.payload : event.payload.toString('utf8'),
        )
      })
    })
    stack.createSession(sessionName)

    try {
      await page.goto(stack.appUrl(), { waitUntil: 'networkidle' })
      await selectSession(page, sessionName)
      await page.waitForSelector('.xterm')
      await takeControl(page)

      await page.locator('.xterm').first().click()
      await expect(page.getByTestId('focused-input-mode-toggle')).toBeEnabled()
      await page.getByTestId('focused-input-mode-toggle').click()
      const input = page.locator('input[data-testid^="buffered-input-"]').first()
      await expect(input).toBeVisible()
      await expect(page.locator('[data-testid^="buffered-input-bar-"]').first()).toBeVisible()
      await expect(input).toBeFocused()

      await page.locator('.xterm').first().click()
      await expect(input).toBeFocused()

      await input.fill(marker)
      await page.waitForTimeout(500)
      expect(stack.capturePane(sessionName)).not.toContain(marker)

      const composingFrameCount = sentPaneFrames.length
      await input.dispatchEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        bubbles: true,
        cancelable: true,
        isComposing: true,
      })
      await page.waitForTimeout(200)
      expect(sentPaneFrames).toHaveLength(composingFrameCount)
      await expect(input).toHaveValue(marker)

      await page.keyboard.press('Enter')
      await page.waitForTimeout(800)
      await expect.poll(() => sentPaneFrames.includes(`${marker}\n`)).toBe(true)
      expect(stack.capturePane(sessionName)).toContain(marker)

      await expect(input).toBeFocused()
      await expect(input).toHaveValue('')
      const sentFrameCount = sentPaneFrames.length
      await input.press('Enter')
      await expect.poll(() => sentPaneFrames.slice(sentFrameCount).includes('\n')).toBe(true)
      await input.fill(afterBlankMarker)
      await page.keyboard.press('Enter')
      await page.waitForTimeout(800)

      expect(stack.capturePane(sessionName)).toContain(afterBlankMarker)

      await page.getByTestId('focused-input-mode-toggle').click()
      await expect(page.locator('[data-testid^="buffered-input-bar-"]').first()).toHaveCount(0)
      await page.keyboard.type(directAfterExitMarker)
      await page.keyboard.press('Enter')
      await page.waitForTimeout(800)

      expect(stack.capturePane(sessionName)).toContain(directAfterExitMarker)
    } finally {
      await restoreDefaultSession(page, stack)
      await page.close().catch(() => {})
      stack.killSession(sessionName, true)
    }
  })

  test('focuses the pane when clicking its buffered input bar', async ({ page }) => {
    const sessionName = `webmux-buffer-focus-${crypto.randomUUID().slice(0, 8)}`
    stack.createSession(sessionName)

    try {
      await page.goto(stack.appUrl(), { waitUntil: 'networkidle' })
      await selectSession(page, sessionName)
      await page.waitForSelector('.xterm')
      await takeControl(page)

      await page.locator('.xterm').first().click()
      await page.locator('[data-testid^="split-horizontal-"]').first().click({ force: true })
      await expect.poll(() => stack.paneCount(sessionName)).toBe(2)

      const panes = stack.paneSizes(sessionName)
      expect(panes).toHaveLength(2)
      const firstPaneId = panes[0]!.id
      const secondPaneId = panes[1]!.id
      await page.getByTestId(`input-mode-toggle-${firstPaneId}`).click({ force: true })
      await expect(page.getByTestId(`buffered-input-bar-${firstPaneId}`)).toBeVisible()
      await page.getByTestId(`input-mode-toggle-${secondPaneId}`).click({ force: true })
      await expect(page.getByTestId(`buffered-input-bar-${secondPaneId}`)).toBeVisible()

      await page.getByTestId(`input-mode-toggle-${firstPaneId}`).click({ force: true })
      await expect(page.getByTestId(`buffered-input-bar-${firstPaneId}`)).toHaveCount(0)
      await page.getByTestId(`input-mode-toggle-${firstPaneId}`).click({ force: true })
      await expect(page.getByTestId(`buffered-input-bar-${firstPaneId}`)).toBeVisible()

      await page.getByTestId(`buffered-input-${secondPaneId}`).click()
      await expect(page.getByTestId(`buffered-input-${secondPaneId}`)).toBeFocused()
      await page.getByTestId('focused-input-mode-toggle').click()

      await expect(page.getByTestId(`buffered-input-bar-${firstPaneId}`)).toBeVisible()
      await expect(page.getByTestId(`buffered-input-bar-${secondPaneId}`)).toHaveCount(0)
    } finally {
      await restoreDefaultSession(page, stack)
      await page.close().catch(() => {})
      stack.killSession(sessionName, true)
    }
  })

  test('forwards companion extension shortcut messages to the focused pane', async ({ page }) => {
    const sessionName = `webmux-extension-${crypto.randomUUID().slice(0, 8)}`
    const directInputMarker = `direct-${crypto.randomUUID().slice(0, 8)}`
    const sentPaneFrames: string[] = []
    page.on('websocket', (socket) => {
      if (!socket.url().includes('/pane/')) {
        return
      }

      socket.on('framesent', (event) => {
        sentPaneFrames.push(
          typeof event.payload === 'string' ? event.payload : event.payload.toString('utf8'),
        )
      })
    })
    stack.createSession(sessionName)

    try {
      await page.goto(stack.appUrl(), { waitUntil: 'networkidle' })
      await selectSession(page, sessionName)
      await page.waitForSelector('.xterm')

      await page.locator('.xterm').first().click()
      const unclaimedFrameCount = sentPaneFrames.length
      const unclaimedHandled = await dispatchExtensionShortcut(page, {
        source: 'webmux-extension',
      })
      expect(unclaimedHandled).toBe(false)
      await page.waitForTimeout(300)
      expect(sentPaneFrames).toHaveLength(unclaimedFrameCount)

      await takeControl(page)

      await page.locator('.xterm').first().click()
      await page.keyboard.type(directInputMarker)
      await expect.poll(() => stack.capturePane(sessionName)).toContain(directInputMarker)

      const frameCount = sentPaneFrames.length
      const invalidHandled = await dispatchExtensionShortcut(page, {
        source: 'other-extension',
      })
      expect(invalidHandled).toBe(false)
      await page.waitForTimeout(300)
      expect(sentPaneFrames).toHaveLength(frameCount)

      await page.getByTestId('session-switcher-button').focus()
      const chromeFocusFrameCount = sentPaneFrames.length
      const chromeFocusHandled = await dispatchExtensionShortcut(page, {
        source: 'webmux-extension',
      })
      expect(chromeFocusHandled).toBe(false)
      await page.waitForTimeout(300)
      expect(sentPaneFrames).toHaveLength(chromeFocusFrameCount)

      await page.locator('.xterm').first().click()
      await page.locator('[data-testid^="input-mode-toggle-"]').first().focus()
      const paneChromeFrameCount = sentPaneFrames.length
      const paneChromeHandled = await dispatchExtensionShortcut(page, {
        source: 'webmux-extension',
      })
      expect(paneChromeHandled).toBe(false)
      await page.waitForTimeout(300)
      expect(sentPaneFrames).toHaveLength(paneChromeFrameCount)

      await page.locator('.xterm').first().click()
      await page.getByTestId('focused-input-mode-toggle').click()
      await expect(page.locator('[data-testid^="buffered-input-bar-"]').first()).toBeVisible()
      const bufferedFrameCount = sentPaneFrames.length
      const bufferedHandled = await dispatchExtensionShortcut(page, {
        source: 'webmux-extension',
      })
      expect(bufferedHandled).toBe(false)
      await page.waitForTimeout(300)
      expect(sentPaneFrames).toHaveLength(bufferedFrameCount)
      await page.getByTestId('focused-input-mode-toggle').click()
      await expect(page.locator('[data-testid^="buffered-input-bar-"]').first()).toHaveCount(0)

      await page.locator('.xterm').first().click()
      const directHandled = await dispatchExtensionShortcut(page, {
        source: 'webmux-extension',
      })
      expect(directHandled).toBe(true)

      await expect.poll(() => sentPaneFrames.includes('\x17')).toBe(true)
    } finally {
      await restoreDefaultSession(page, stack)
      await page.close().catch(() => {})
      stack.killSession(sessionName, true)
    }
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

  test('upgrades a tmux pane to a local rich pane and clears it when closed', async ({ page }) => {
    const sessionName = `webmux-rich-${crypto.randomUUID().slice(0, 8)}`
    const windowName = `rich-local-${crypto.randomUUID().slice(0, 8)}`
    const fixturePath = `/aur-138-${crypto.randomUUID().slice(0, 8)}`
    const fixtureUrl = stack.richFixtureUrl(fixturePath)
    stack.createSession(sessionName)
    const { paneId, gatePath, readyMarker } = stack.createGatedCommandWindow(
      sessionName,
      windowName,
      `env WEBMUX_RICH_CLIENT=1 bun packages/cli/src/index.ts open preview:127.0.0.1:${stack.richFixturePort}${fixturePath}`,
    )

    try {
      await page.goto(stack.appUrl(), { waitUntil: 'networkidle' })
      await page.waitForSelector('.xterm')
      await selectSession(page, sessionName)
      await takeControl(page)

      stack.selectWindowByName(sessionName, windowName)
      await expect(page.locator(`[data-testid="split-horizontal-${paneId}"]`)).toBeAttached()
      await expect(page.locator('.xterm')).toContainText(readyMarker, { timeout: 15_000 })
      stack.releaseGatedCommand(gatePath)

      const richFrame = page.locator(`[data-testid="rich-pane-frame-${paneId}"]`)
      await expect(richFrame).toHaveAttribute('src', fixtureUrl)
      await expect(
        page.frameLocator(`[data-testid="rich-pane-frame-${paneId}"]`).locator('body'),
      ).toContainText(`webmux rich fixture ${fixturePath}`)
      await expect(page.locator('.xterm')).not.toContainText('webmux;type=webview')

      await page.getByTitle('Close pane').click({ force: true })

      await expect.poll(() => stack.windowExists(sessionName, windowName)).toBe(false)
      await expect(richFrame).toHaveCount(0)
      await expect(page.locator('.xterm').first()).toBeVisible()
    } finally {
      await page.close().catch(() => {})
      stack.killSession(sessionName, true)
      await stack.restartBridge()
    }
  })

  test('renders external HTTPS rich panes as open-in-browser fallbacks', async ({ page }) => {
    const sessionName = `webmux-rich-${crypto.randomUUID().slice(0, 8)}`
    const windowName = `rich-external-${crypto.randomUUID().slice(0, 8)}`
    const resource = 'gh:openai/codex/pull/1'
    const resolvedUrl = 'https://github.com/openai/codex/pull/1'
    stack.createSession(sessionName)
    const { paneId, gatePath, readyMarker } = stack.createGatedCommandWindow(
      sessionName,
      windowName,
      `env WEBMUX_RICH_CLIENT=1 bun packages/cli/src/index.ts open ${resource}`,
    )

    try {
      await page.goto(stack.appUrl(), { waitUntil: 'networkidle' })
      await page.waitForSelector('.xterm')
      await selectSession(page, sessionName)
      await takeControl(page)

      stack.selectWindowByName(sessionName, windowName)
      await expect(page.locator(`[data-testid="split-horizontal-${paneId}"]`)).toBeAttached()
      await expect(page.locator('.xterm')).toContainText(readyMarker, { timeout: 15_000 })
      stack.releaseGatedCommand(gatePath)

      await expect(page.locator(`[data-testid="rich-pane-external-${paneId}"]`)).toBeVisible()
      await expect(page.locator(`[data-testid="rich-pane-open-${paneId}"]`)).toHaveAttribute(
        'href',
        resolvedUrl,
      )
      await expect(page.locator(`[data-testid="rich-pane-frame-${paneId}"]`)).toHaveCount(0)
      await expect(page.locator('.xterm')).not.toContainText('webmux;type=webview')
    } finally {
      await page.close().catch(() => {})
      stack.killSession(sessionName, true)
      await stack.restartBridge()
    }
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

  test('resizes split panes through browser drag handles', async ({ page }) => {
    const sessionName = `webmux-resize-${crypto.randomUUID().slice(0, 8)}`
    stack.createSession(sessionName)

    try {
      await page.goto(stack.appUrl(), { waitUntil: 'networkidle' })
      await page.waitForSelector('.xterm')
      await selectSession(page, sessionName)
      await takeControl(page)

      await page.locator('[data-testid^="split-horizontal-"]').first().click({ force: true })
      await expect.poll(() => stack.paneCount(sessionName)).toBe(2)
      await expect.poll(() => stack.paneSizes(sessionName).length).toBe(2)
      await page.waitForTimeout(500)
      const handle = page.locator('[data-testid^="resize-handle-"]').first()
      await expect(handle).toBeVisible()

      const box = await handle.boundingBox()
      expect(box).not.toBeNull()
      const before = stack.paneSizes(sessionName)
      const beforeById = new Map(before.map((pane) => [pane.id, pane]))

      await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
      await page.mouse.down()
      await page.mouse.move(box!.x + box!.width / 2 + 120, box!.y + box!.height / 2, {
        steps: 8,
      })
      await page.mouse.up()

      await expect
        .poll(() => {
          return stack.paneSizes(sessionName).some((pane) => {
            const previous = beforeById.get(pane.id)
            if (!previous) return false
            return pane.width !== previous.width || pane.height !== previous.height
          })
        })
        .toBe(true)
    } finally {
      await page.close().catch(() => {})
      stack.killSession(sessionName, true)
    }
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

    await ownerPage.locator('[data-testid^="split-horizontal-"]').first().click({ force: true })
    await expect.poll(() => stack.paneCount(stack.sessionName)).toBeGreaterThan(1)
    await expect(observerPage.locator('[data-testid^="resize-handle-"]').first()).toBeVisible()

    await observerPage.locator('[data-testid^="zoom-pane-"]').first().click({ force: true })

    await expect(observerPage.getByTestId('mutation-notice')).toContainText('Take control first')

    await observerPage.getByTestId('new-window-button').click()

    await expect(observerPage.getByTestId('mutation-notice')).toContainText('Take control first')

    await observerPage.locator('[data-testid^="resize-handle-"]').first().click({
      force: true,
    })

    await expect(observerPage.getByTestId('mutation-notice')).toContainText('Take control first')

    await ownerPage.close()
    await observerPage.close()
  })

  test('keeps shell controls usable on narrow viewports', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 720 })
    await page.addInitScript(() => {
      localStorage.setItem(
        'webmux:preferences',
        JSON.stringify({ tabPosition: 'top', sidebarOpen: true }),
      )
    })

    await page.goto(stack.appUrl(), { waitUntil: 'networkidle' })
    await page.waitForSelector('.xterm')
    await selectSession(page, stack.sessionName)
    await takeControl(page)

    await expect(page.getByTestId('sidebar-drawer')).toHaveCount(0)

    const sessionsButton = page.getByTitle('Sessions')
    await sessionsButton.click()
    await expect(page.getByRole('dialog', { name: 'Sessions and panes' })).toBeVisible()
    await expect(page.getByTestId('sidebar-drawer')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('sidebar-drawer')).toHaveCount(0)

    const paletteButton = page.getByTitle('Command Palette')
    await paletteButton.click()
    const palette = page.getByRole('dialog', { name: 'Command palette' })
    await expect(palette).toBeVisible()
    const paletteBox = await palette.boundingBox()
    expect(paletteBox?.width ?? 999).toBeLessThanOrEqual(390)
    await page.keyboard.press('Escape')
    await expect(palette).toHaveCount(0)
    await expect(paletteButton).toBeFocused()

    const switcherButton = page.getByTestId('session-switcher-button')
    await switcherButton.click()
    const switcher = page.getByRole('dialog', { name: 'Session switcher' })
    await expect(switcher).toBeVisible()
    const switcherBox = await switcher.boundingBox()
    expect(switcherBox?.width ?? 999).toBeLessThanOrEqual(390)
    await page.keyboard.press('Escape')
    await expect(switcher).toHaveCount(0)
    await expect(switcherButton).toBeFocused()
  })

  test('opens the sessions drawer from the default bottom status bar on narrow viewports', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 720 })

    await page.goto(stack.appUrl(), { waitUntil: 'networkidle' })
    await page.waitForSelector('.xterm')
    await selectSession(page, stack.sessionName)
    await takeControl(page)

    await expect(page.getByTestId('sidebar-drawer')).toHaveCount(0)

    const sessionsButton = page.getByTitle('Sessions')
    await sessionsButton.click()
    await expect(page.getByRole('dialog', { name: 'Sessions and panes' })).toBeVisible()
    await expect(page.getByTestId('sidebar-drawer')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('sidebar-drawer')).toHaveCount(0)
  })

  test('switches themes without disrupting the live terminal', async ({ page }) => {
    const marker = `theme-e2e-${crypto.randomUUID().slice(0, 8)}`

    await page.goto(stack.appUrl(), { waitUntil: 'networkidle' })
    await page.waitForSelector('.xterm')
    await selectSession(page, stack.sessionName)
    await takeControl(page)

    const initialBackground = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--bg-deep').trim(),
    )

    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    })
    await page.keyboard.down('Control')
    await page.keyboard.press('b')
    await page.keyboard.up('Control')
    await page.keyboard.press(',')

    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
    await page.getByRole('button', { name: /Oxide/ }).click()

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'oxide')
    const oxideBackground = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--bg-deep').trim(),
    )
    expect(oxideBackground).not.toBe(initialBackground)
    expect(oxideBackground).toBe('#080b0b')

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Settings' })).toHaveCount(0)
    await expect(page.locator('.xterm').first()).toBeVisible()

    await page.locator('.xterm').first().click()
    await page.keyboard.type(marker)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(800)

    expect(stack.capturePane(stack.sessionName)).toContain(marker)
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
  await expect(page.getByTestId('session-switcher-button')).toContainText(sessionName)
}

async function dispatchExtensionShortcut(
  page: Page,
  options: { source: string },
): Promise<boolean> {
  return await page.evaluate((source) => {
    return !window.dispatchEvent(
      new CustomEvent('webmux:extensionShortcut', {
        cancelable: true,
        detail: JSON.stringify({
          source,
          type: 'webmux.forwardShortcut',
          version: 1,
          command: 'control-w',
        }),
      }),
    )
  }, options.source)
}

async function restoreDefaultSession(page: Page, stack: WebmuxE2EStack): Promise<void> {
  if (page.isClosed()) {
    return
  }

  await selectSession(page, stack.sessionName)
  await page.waitForSelector('.xterm')
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
