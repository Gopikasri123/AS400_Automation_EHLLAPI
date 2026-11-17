import { expect } from '@playwright/test';
import { test } from '../../fixtures/gepFixtures';
import { GEP2_36899, GEP2_36899_AS400 } from '../../data/testCases';
import { describeAs400Steps, runAs400OrderCheck, type As400OrderCheckResult } from '../../src/as400/as400Scenario';

/**
 * Cross-platform: place the GEP2-36899 order on the website, verify it in the AS400 (PUB400) ORDERS table on the
 * green screen, scrape an IBM i Main Menu option and search that text in the website search bar.
 * Needs PUB400_PASSWORD in the environment and the ACS 5250 session (see as400/config/config.ini).
 */
test.describe('GEP x AS400 cross-platform', () => {
  // Website order + green screen sign-on / STRSQL / sign-off.
  test.describe.configure({ timeout: 20 * 60 * 1000 });

  // @manual manual-test-cases/GEP2-36899_AS400_Cross_Platform.md
  test('GEP2-36899 | Website order verified in AS400 ORDERS table and IBM i menu option searched on the website @AS400_GEP2_36899 @GEP @AS400 @crossPlatform @placesOrder', async ({
    session,
    cart,
    checkout,
    orderHistory,
    marketData,
  }, testInfo) => {
    // Fail before placing an order when the AS400 half cannot sign on.
    expect(process.env.PUB400_PASSWORD, 'Set PUB400_PASSWORD before running: the AS400 steps need it').toBeTruthy();

    await test.step('Step 1: Launch the website and clear the launch popups', () => session.openSite());

    await test.step('Step 2: Sign in', () => session.login());

    await test.step('Step 3: Clear the cart if it is not empty', () => cart.emptyCart());

    const productId = marketData.products.bulkOrder;
    await test.step('Step 4: Search for the product and open its product page', () => cart.searchAndOpenProduct(productId));

    await test.step(`Step 5: Set the quantity to ${GEP2_36899.quantity} and add the product to the cart`, () =>
      cart.addToCart({ quantity: GEP2_36899.quantity }));

    await test.step('Step 6: Open the shopping cart', () => cart.openCart());

    await test.step('Step 7: Proceed to Shipping & Billing', () => checkout.proceedToShippingAndBilling());

    await test.step('Step 8: Choose the payment method and enter the PO number', () =>
      checkout.fillShippingAndBilling({ poNumber: GEP2_36899.poNumber }));

    await test.step('Step 9: Review the order', () => checkout.goToReviewOrder());

    const orderNumber = await test.step('Step 10: Submit the order and capture the order number', () => checkout.submitOrder());

    await test.step('Step 11: Open My Orders', () => orderHistory.openMyOrders());

    await test.step(`Step 12: Verify order ${orderNumber} is listed in Submitted Orders`, () =>
      orderHistory.findSubmittedOrder(orderNumber));

    // ORDERS row for this order: status a new order shows for this market (VARCHAR(20)) and today's local date.
    const orderStatus = marketData.expectedOrderStatus.slice(0, 20);
    const now = new Date();
    const orderDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // One green-screen session covers steps 13-16 (sign on, STRSQL insert + select, menu scrape, sign off);
    // the steps below check its recorded results one by one.
    // @flow-deviation 13-16: one Python EHLLAPI run does all AS400 steps in a single sign-on; each step is asserted separately
    const as400: As400OrderCheckResult = await test.step('Steps 13-16: AS400: run the green-screen scenario on PUB400', async () => {
      const result = await runAs400OrderCheck(
        { orderNumber, productId, orderStatus, orderDate, menuOption: GEP2_36899_AS400.menuOption },
        testInfo.outputPath('as400-result.json'),
      );
      await testInfo.attach('AS400 result (JSON)', { path: testInfo.outputPath('as400-result.json'), contentType: 'application/json' });
      await testInfo.attach('AS400 report (HTML)', { path: result.reports.html, contentType: 'text/html' });
      if (result.menu.screen) {
        await testInfo.attach('IBM i Main Menu screen', { body: result.menu.screen.join('\n'), contentType: 'text/plain' });
      }
      return result;
    });

    const stepOf = (prefix: string) => as400.steps.filter((s) => s.step.startsWith(prefix));
    const expectPassed = (prefix: string) =>
      expect(stepOf(prefix).length > 0 && stepOf(prefix).every((s) => s.status === 'PASS'),
        `AS400 step ${prefix} failed:\n${describeAs400Steps(as400)}`).toBe(true);

    await test.step('Step 13: AS400: sign on to PUB400 and reach the IBM i Main Menu', () => expectPassed('A1'));

    await test.step(`Step 14: AS400: insert order ${orderNumber} into ${as400.table} with STRSQL`, async () => {
      expectPassed('A2');
      expectPassed('A3');
      expectPassed('A4');
      expectPassed('A5');
    });

    await test.step(`Step 15: AS400: verify order ${orderNumber} is in ${as400.table} on the green screen`, async () => {
      expectPassed('A6');
      expect(as400.order, 'row read from the Display Data screen').not.toBeNull();
      expect(as400.order?.ORDER_ID, 'ORDER_ID').toBe(orderNumber);
      expect(as400.order?.PRODUCT_ID, 'PRODUCT_ID').toBe(productId);
      expect(as400.order?.ORDER_STATUS, 'ORDER_STATUS').toBe(orderStatus);
      expect(as400.order?.ORDER_DATE, 'ORDER_DATE').toBe(orderDate);
    });

    const menuText = as400.menu.text ?? '';
    await test.step(`Step 16: AS400: read Main Menu option ${GEP2_36899_AS400.menuOption} and sign off`, async () => {
      expectPassed('A7');
      expectPassed('A8');
      expect(menuText, `text of Main Menu option ${GEP2_36899_AS400.menuOption}`).not.toBe('');
      expectPassed('A9');
    });

    await test.step(`Step 17: Search "${menuText}" in the website search bar`, () => cart.searchText(menuText));

    await test.step('Step 18: Post-condition: sign out', () => session.signOutAtEnd());
  });
});
