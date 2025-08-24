const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Collect all network requests and responses
  const failedRequests = [];
  page.on('response', response => {
    if (!response.ok()) {
      failedRequests.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText()
      });
    }
  });
  
  // Collect console messages with more detail
  const consoleMessages = [];
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    const location = msg.location();
    consoleMessages.push({ type, text, location });
    console.log(`[${type}] ${text}`);
    if (location.url) {
      console.log(`  at ${location.url}:${location.lineNumber}:${location.columnNumber}`);
    }
  });
  
  // Navigate to app1 frontend
  console.log('🔍 Testing app1 frontend at http://localhost:8090/app1/');
  await page.goto('http://localhost:8090/app1/', { waitUntil: 'networkidle' });
  
  // Wait for Angular to load
  await page.waitForTimeout(3000);
  
  // Check page title and basic content
  const title = await page.title();
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log(`\nPage title: "${title}"`);
  console.log(`Body text length: ${bodyText.length} characters`);
  console.log(`First 200 chars: "${bodyText.substring(0, 200)}"`);
  
  // Report failed network requests
  console.log('\n🌐 Failed Network Requests:');
  if (failedRequests.length > 0) {
    failedRequests.forEach((req, i) => {
      console.log(`${i + 1}. ${req.status} ${req.statusText} - ${req.url}`);
    });
  } else {
    console.log('✅ No failed network requests');
  }
  
  // Check for errors
  const errors = consoleMessages.filter(msg => msg.type === 'error');
  const warnings = consoleMessages.filter(msg => msg.type === 'warning');
  
  console.log('\n📊 Console Message Summary:');
  console.log(`Total messages: ${consoleMessages.length}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);
  
  if (errors.length > 0) {
    console.log('\n❌ DETAILED ERRORS:');
    errors.forEach((err, i) => {
      console.log(`${i + 1}. ${err.text}`);
      if (err.location.url) {
        console.log(`   Location: ${err.location.url}:${err.location.lineNumber}:${err.location.columnNumber}`);
      }
    });
  }
  
  await browser.close();
  
  // Final verdict
  console.log('\n🏁 FINAL RESULT:');
  if (errors.length === 0 && failedRequests.length === 0) {
    console.log('✅ SUCCESS: ZERO console errors and all resources loaded!');
    process.exit(0);
  } else {
    console.log(`❌ FAILURE: ${errors.length} console errors and ${failedRequests.length} failed requests detected!`);
    process.exit(1);
  }
})();