const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: false }); // watch visually if needed, but we'll use headless true
    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.error('PAGE ERROR:', error.message));
    page.on('requestfailed', request => console.log('REQ FAIL:', request.url(), request.failure().errorText));

    console.log('Navigating...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

    console.log('Typing query...');
    await page.fill('input[type="text"]', 'ellie');
    await page.click('button[type="submit"]');

    console.log('Waiting for results...');
    await page.waitForTimeout(2000);

    console.log('Clicking the first result...');
    // It's the first element with cursor-pointer
    const firstSong = await page.$('div.cursor-pointer');
    if (firstSong) {
        await firstSong.click();
        console.log('Clicked first song.');
    } else {
        console.log('No song found.');
    }

    console.log('Waiting for playback to start...');
    await page.waitForTimeout(5000); // 5 sec to let iframe load and start buffering

    const iframes = await page.$$('iframe');
    console.log('Number of iframes:', iframes.length);
    const videos = await page.$$('video');
    console.log('Number of videos:', videos.length);

    await browser.close();
})();
