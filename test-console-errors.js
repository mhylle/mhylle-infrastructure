const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Collect console messages
  const consoleMessages = [];
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    consoleMessages.push({ type, text });
    console.log(`[${type}] ${text}`);
  });
  
  // Navigate to app1 frontend
  console.log('🔍 Testing app1 frontend at http://localhost:8090/app1/');
  await page.goto('http://localhost:8090/app1/', { waitUntil: 'networkidle' });
  
  // Wait for Angular to load
  await page.waitForTimeout(3000);
  
  // Check for errors
  const errors = consoleMessages.filter(msg => msg.type === 'error');
  const warnings = consoleMessages.filter(msg => msg.type === 'warning');
  
  console.log('\n📊 Console Message Summary:');
  console.log(`Total messages: ${consoleMessages.length}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);
  
  if (errors.length > 0) {
    console.log('\n❌ ERRORS FOUND:');
    errors.forEach((err, i) => {
      console.log(`${i + 1}. ${err.text}`);
    });
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS FOUND:');
    warnings.forEach((warn, i) => {
      console.log(`${i + 1}. ${warn.text}`);
    });
  }
  
  // Test authentication endpoints (expected to fail with 401 but no console errors)
  console.log('\n🔐 Testing authentication endpoints...');
  try {
    const response = await page.goto('http://localhost:8090/api/auth/health');
    console.log(`Auth health endpoint: ${response.status()}`);
  } catch (e) {
    console.log(`Auth endpoint error: ${e.message}`);
  }
  
  await browser.close();
  
  // Final verdict
  console.log('\n🏁 FINAL RESULT:');
  if (errors.length === 0) {
    console.log('✅ SUCCESS: ZERO console errors found!');
    process.exit(0);
  } else {
    console.log('❌ FAILURE: Console errors detected!');
    process.exit(1);
  }
})();