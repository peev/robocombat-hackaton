import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-webgl'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push('console:' + m.text()); });

await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/rc-before.png', fullPage: true }).catch(async () => {
  await page.screenshot({ path: '/tmp/rc-before.png', fullPage: true });
});

const compare = page.getByRole('button', { name: 'Compare' });
console.log('Compare visible', await compare.isVisible());
const reqs = [];
page.on('request', r => { if (r.url().includes('/api/')) reqs.push(r.method() + ' ' + r.url()); });
await compare.click();
await page.waitForTimeout(6000);
try {
  await page.screenshot({ path: '/opt/cursor/artifacts/screenshots/rc-after-compare.png', fullPage: true });
} catch {
  await page.screenshot({ path: '/tmp/rc-after-compare.png', fullPage: true });
}

const bodyText = await page.locator('body').innerText();
const hasCompleted = bodyText.includes('COMPLETED') || bodyText.includes('NAVIGATING') || /Score\s+\d+/.test(bodyText);
console.log(JSON.stringify({ errors: errors.slice(0, 20), reqs, hasCompleted, snippet: bodyText.slice(0, 500) }, null, 2));
await browser.close();
