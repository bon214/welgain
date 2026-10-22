import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function dragTo(
  page: Page,
  axis: 'vertical' | 'horizontal',
  ratio: number,
  pointerType = 'mouse',
) {
  const handle = page.locator(`[role="separator"][aria-orientation="${axis}"]`);
  const frame =
    axis === 'vertical'
      ? page.getByTestId('frames')
      : page.locator('.right-frames');
  const rect = await frame.boundingBox();
  const box = await handle.boundingBox();
  if (!rect || !box) throw new Error('The resize handle must be visible');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const target =
    axis === 'vertical'
      ? { x: rect.x + 11 + (rect.width - 22) * ratio, y }
      : { x, y: rect.y + 11 + (rect.height - 22) * ratio };
  if (pointerType === 'touch') {
    const client = await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y }],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: target.x, y: target.y }],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await client.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 12 });
    await page.mouse.up();
  }
  return handle;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('vertical dragging changes both frame widths and persists after reload', async ({
  page,
}) => {
  const before = await page.getByTestId('model-frame').boundingBox();
  const handle = await dragTo(page, 'vertical', 0.62);
  await expect(handle).toHaveAttribute('aria-valuenow', '62');
  const after = await page.getByTestId('model-frame').boundingBox();
  expect(after!.width).toBeGreaterThan(before!.width + 100);
  await page.reload();
  await expect(
    page.locator('[role="separator"][aria-orientation="vertical"]'),
  ).toHaveAttribute('aria-valuenow', '62');
});

test('horizontal dragging changes graph and icon heights independently', async ({
  page,
}) => {
  const before = await page.getByTestId('icons-frame').boundingBox();
  const handle = await dragTo(page, 'horizontal', 0.4);
  await expect(handle).toHaveAttribute('aria-valuenow', '40');
  const after = await page.getByTestId('icons-frame').boundingBox();
  expect(after!.height).toBeGreaterThan(before!.height + 100);
  await expect(page.locator('[aria-orientation="vertical"]')).toHaveAttribute(
    'aria-valuenow',
    '50',
  );
});

test('nearby sizes snap, and the switch disables snapping', async ({
  page,
}) => {
  let handle = await dragTo(page, 'vertical', 0.335);
  await expect(handle).toHaveAttribute('aria-valuenow', '32');
  await page.getByRole('switch', { name: 'サイズをスナップ' }).click();
  handle = await dragTo(page, 'vertical', 0.335);
  await expect(handle).toHaveAttribute('aria-valuenow', '34');
  await page.reload();
  await expect(page.getByRole('switch')).toHaveAttribute(
    'aria-checked',
    'false',
  );
});

test('presets, keyboard limits, double-click and reset work', async ({
  page,
}) => {
  const vertical = page.locator('[aria-orientation="vertical"]');
  const horizontal = page.locator('[aria-orientation="horizontal"]');
  await page.getByRole('button', { name: 'グラフ重視', exact: true }).click();
  await expect(vertical).toHaveAttribute('aria-valuenow', '32');
  await expect(horizontal).toHaveAttribute('aria-valuenow', '76');
  await vertical.focus();
  await page.keyboard.press('ArrowRight');
  await expect(vertical).toHaveAttribute('aria-valuenow', '34');
  await page.keyboard.press('End');
  await expect(vertical).toHaveAttribute('aria-valuenow', '72');
  await page.keyboard.press('ArrowRight');
  await expect(vertical).toHaveAttribute('aria-valuenow', '72');
  await page.keyboard.press('Home');
  await expect(vertical).toHaveAttribute('aria-valuenow', '26');
  await vertical.dblclick();
  await expect(vertical).toHaveAttribute('aria-valuenow', '50');
  await horizontal.focus();
  await page.keyboard.press('ArrowUp');
  await expect(horizontal).toHaveAttribute('aria-valuenow', '74');
  await page.getByRole('button', { name: '標準レイアウトに戻す' }).click();
  await expect(horizontal).toHaveAttribute('aria-valuenow', '64');
  await expect(page.getByTestId('preset-standard')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('pointer capture keeps resizing outside the frame and clamps to safe bounds', async ({
  page,
}) => {
  const handle = await dragTo(page, 'vertical', 1.5);
  await expect(handle).toHaveAttribute('aria-valuenow', '72');
  await expect(page.locator('.resizing-body')).toHaveCount(0);
  const graph = await page.getByTestId('graph-frame').boundingBox();
  expect(graph!.width).toBeGreaterThan(100);
});

test('touch dragging works on narrow screens without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const handle = await dragTo(page, 'vertical', 0.6, 'touch');
  await expect(handle).toHaveAttribute('aria-valuenow', '60');
  const horizontal = await dragTo(page, 'horizontal', 0.42, 'touch');
  await expect(horizontal).toHaveAttribute('aria-valuenow', '42');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  for (const preset of ['standard', 'graph', 'model']) {
    await page.getByTestId(`preset-${preset}`).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

test('malformed saved settings fall back safely and help is accessible', async ({
  page,
}) => {
  await page.evaluate(() =>
    localStorage.setItem('welgain.frame-layout.v1', '{"body":0,"chart":999}'),
  );
  await page.reload();
  await expect(page.locator('[aria-orientation="vertical"]')).toHaveAttribute(
    'aria-valuenow',
    '50',
  );
  await page.getByRole('button', { name: '操作方法' }).click();
  await expect(page.getByRole('region', { name: '操作方法' })).toBeVisible();
  await page.getByRole('button', { name: '操作方法' }).click();
  await expect(page.getByRole('region', { name: '操作方法' })).toHaveCount(0);
});

test('works without localStorage and does not send external requests', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('Storage disabled');
      },
    });
  });
  const externalRequests: string[] = [];
  page.on('request', (request) => {
    if (!new URL(request.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/))
      externalRequests.push(request.url());
  });
  await page.reload();
  await page.getByTestId('preset-model').click();
  await expect(page.locator('[aria-orientation="vertical"]')).toHaveAttribute(
    'aria-valuenow',
    '68',
  );
  await expect(page.getByText('レイアウトは保存されません')).toBeVisible();
  expect(externalRequests).toEqual([]);
});
