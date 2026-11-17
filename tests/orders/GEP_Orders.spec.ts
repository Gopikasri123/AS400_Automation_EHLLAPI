import { test } from '../../fixtures/gepFixtures';
import { daysFromToday } from '../../src/utils/dataHelpers';
import { GEP2_18230, GEP2_18257, GEP2_18559, GEP2_22324, GEP2_36899 } from '../../data/testCases';

/**
 * Order placement and order history: every test places an order (normal, recurring, reorder,
 * from an unplaced order) and verifies it in My Orders / Order History.
 */
test.describe('GEP Orders', () => {
  // Full E2E (login, order, verify in order history) on the QA sites is slow.
  test.describe.configure({ timeout: 10 * 60 * 1000 });

  test('GEP2-36899 | Verify submitted order in My order page @GEP2-36899 @GEP @orders @placesOrder @regression', async ({
    session,
    cart,
    checkout,
    orderHistory,
    marketData,
  }) => {
    // Open the site for the selected market and close the cookie / domain / launch popups.
    await test.step('Step 1: Launch the website and clear the launch popups', () => session.openSite());

    // Sign in with the user from .env (GEP2_36899 override if set) and wait until the account menu shows.
    await test.step('Step 2: Sign in', () => session.login());

    // Start from an empty cart so only this test's product is ordered.
    await test.step('Step 3: Clear the cart if it is not empty', () => cart.emptyCart());

    // Search the product by its ID and open its product page (PDP).
    await test.step('Step 4: Search for the product and open its product page', () =>
      cart.searchAndOpenProduct(marketData.products.bulkOrder));

    // Set quantity 50 (Tosca value) and add the product to the cart.
    await test.step(`Step 5: Set the quantity to ${GEP2_36899.quantity} and add the product to the cart`, () =>
      cart.addToCart({ quantity: GEP2_36899.quantity }));

    // Open the cart page and wait until the product is listed.
    await test.step('Step 6: Open the shopping cart', () => cart.openCart());

    // Click "Proceed To Shipping & Billing", handle the cart popups and wait for the page to load.
    await test.step('Step 7: Proceed to Shipping & Billing', () => checkout.proceedToShippingAndBilling());

    // Immediate order: choose "Bill On Account" (Gen X) and type the PO number.
    await test.step('Step 8: Choose the payment method and enter the PO number', () =>
      checkout.fillShippingAndBilling({ poNumber: GEP2_36899.poNumber }));

    // Click "Review Order" and wait for the Review Order page.
    await test.step('Step 9: Review the order', () => checkout.goToReviewOrder());

    // Click "Submit Your Order", check "Your order has been submitted" and read the order number.
    const orderNumber = await test.step('Step 10: Submit the order and capture the order number', () => checkout.submitOrder());

    // Open My Orders from the header "Orders & Returns" button (Submitted Orders tab).
    await test.step('Step 11: Open My Orders', () => orderHistory.openMyOrders());

    // Search the new order number until it is listed (a new order can take a moment to appear).
    await test.step(`Step 12: Verify order ${orderNumber} is listed in Submitted Orders`, () =>
      orderHistory.findSubmittedOrder(orderNumber));

    // Tosca post condition: Gen Z sites sign out, Gen X/Y just close the browser.
    await test.step('Step 13: Post-condition: sign out', () => session.signOutAtEnd());
  });

  test('GEP2-18230 | E2E of the Reorder option from an order on the Order History page @GEP2-18230 @GEP @orders @reorder @placesOrder @regression', async ({
    session,
    cart,
    checkout,
    orderHistory,
    orderDetailsPage,
    marketData,
  }) => {
    // Open the site for the selected market and close the cookie / domain / launch popups.
    await test.step('Step 1: Launch the website and clear the launch popups', () => session.openSite());

    // Sign in with the user from .env and wait until the account menu shows.
    await test.step('Step 2: Sign in', () => session.login());

    // Start from an empty cart so only the reordered items are ordered.
    await test.step('Step 3: Clear the cart if it is not empty', () => cart.emptyCart());

    // Open My Orders from the header "Orders & Returns" button (Submitted Orders tab).
    await test.step('Step 4: Open My Orders', () => orderHistory.openMyOrders());

    // Open the most recent submitted order with its "View & Track" link.
    await test.step('Step 5: Open the first order with View & Track', () => orderHistory.openFirstSubmittedOrder());

    // Click "Reorder" on Order Details (copies the order's items to the cart) and close the confirmation.
    await test.step('Step 6: Reorder the order and close the reorder confirmation', () => orderDetailsPage.reorder());

    // Open the cart page and wait until the reordered items are listed.
    await test.step('Step 7: Open the shopping cart and check the reordered items are in it', () => cart.openCart());

    // Click "Proceed To Shipping & Billing", handle the cart popups and wait for the page to load.
    await test.step('Step 8: Proceed to Shipping & Billing', () => checkout.proceedToShippingAndBilling());

    // Choose the region's payment method and type the PO (Tosca rule: Gen X uses a random 7-digit PO).
    await test.step('Step 9: Choose the payment method and enter the PO number', () =>
      checkout.fillShippingAndBilling({ poNumber: GEP2_18230.poNumber, poRule: 'region' }));

    // Click "Review Order" and wait for the Review Order page.
    await test.step('Step 10: Review the order', () => checkout.goToReviewOrder());

    // Click "Submit Your Order", check "Your order has been submitted" and read the order number.
    const orderNumber = await test.step('Step 11: Submit the order and capture the order number', () => checkout.submitOrder());

    // Go back to My Orders to find the new order.
    await test.step('Step 12: Open My Orders', () => orderHistory.openMyOrders());

    // Search the new order number until it is listed (a new order can take a moment to appear).
    await test.step(`Step 13: Search order ${orderNumber} in Submitted Orders`, () => orderHistory.findSubmittedOrder(orderNumber));

    // Open the found order with its "View & Track" link.
    await test.step('Step 14: Open the order with View & Track', () => orderHistory.openFirstSubmittedOrder());

    // Compare the status on Order Details with the market's expected status (case-insensitive).
    await test.step(`Step 15: Verify the order status is "${marketData.expectedOrderStatus}"`, () =>
      orderDetailsPage.expectOrderStatus(marketData.expectedOrderStatus));

    // Tosca post condition: Gen Z sites sign out, Gen X/Y just close the browser.
    await test.step('Step 16: Post-condition: sign out', () => session.signOutAtEnd());
  });

  test('GEP2-18257 | Verify user able to see the orders on Future & Recurring Tab @GEP2-18257 @GEP @orders @recurring @placesOrder @regression', async ({
    session,
    cart,
    checkout,
    orderHistory,
    marketData,
  }) => {
    // Open the site for the selected market and close the cookie / domain / launch popups.
    await test.step('Step 1: Launch the website and clear the launch popups', () => session.openSite());

    // Sign in with the user from .env and wait until the account menu shows.
    await test.step('Step 2: Sign in', () => session.login());

    // Start from an empty cart so only this test's product is ordered.
    await test.step('Step 3: Clear the cart if it is not empty', () => cart.emptyCart());

    // Search the product by its ID and open its product page (PDP).
    await test.step('Step 4: Search for the product and open its product page', () =>
      cart.searchAndOpenProduct(marketData.products.generic));

    // Handle the optional PDP options (COM dropdown, FR fixer type, backorder popup) and add to cart.
    await test.step('Step 5: Select the product options and add the product to the cart', () =>
      cart.addToCart({ handlePdpOptions: true }));

    // Open the cart page and wait until the product is listed.
    await test.step('Step 6: Open the shopping cart', () => cart.openCart());

    // Click "Proceed To Shipping & Billing", handle the cart popups and wait for the page to load.
    await test.step('Step 7: Proceed to Shipping & Billing', () => checkout.proceedToShippingAndBilling());

    // Choose "Recurring", type the PO, then order name, frequency, start date (calendar) and number of orders.
    // Payment selection is switched off for this test case, so the account's default payment is used.
    await test.step('Step 8: Set up the recurring order (PO, name, frequency, start date, number of orders)', () =>
      checkout.fillRecurringOrder({
        poNumber: GEP2_18257.poNumber,
        selectPayment: false,
        recurring: {
          orderName: GEP2_18257.recurringOrderName,
          frequency: marketData.recurringFrequency,
          startDate: daysFromToday(GEP2_18257.recurringStartInDays),
          numberOfOrders: GEP2_18257.recurringOrderCount,
        },
      }));

    // Click "Review Order" and wait for the Review Order page.
    await test.step('Step 9: Review the order', () => checkout.goToReviewOrder());

    // Click "Submit Your Order", check "Your order has been submitted" and read the order number.
    const orderNumber = await test.step('Step 10: Submit the order and capture the order number', () => checkout.submitOrder());

    // Open My Orders from the header "Orders & Returns" button.
    await test.step('Step 11: Open My Orders', () => orderHistory.openMyOrders());

    // Open the Future & Recurring tab, search the order and check it has the "Manage Upcoming" link.
    await test.step(`Step 12: Verify order ${orderNumber} is listed in Future & Recurring with Manage Upcoming`, () =>
      orderHistory.findRecurringOrder(orderNumber));

    // Tosca post condition: Gen Z sites sign out, Gen X/Y just close the browser.
    await test.step('Step 13: Post-condition: sign out', () => session.signOutAtEnd());
  });

  test('GEP2-22324 | End-to-End flow for UOM display on Order History page @GEP2-22324 @GEP @orders @uom @placesOrder @regression', async ({
    session,
    cart,
    checkout,
    orderHistory,
    orderDetailsPage,
    region,
    marketData,
  }) => {
    // Tosca: TDM Condition == 'Productwith2UOM', stored as UOMProductID (data/marketData.ts).
    const uomProductId = marketData.products.twoUom;

    // Open the site for the selected market and close the cookie / domain / launch popups.
    await test.step('Step 1: Launch the website and clear the launch popups', () => session.openSite());

    // Sign in with the user from .env and wait until the account menu shows.
    await test.step('Step 2: Sign in', () => session.login());

    // Start from an empty cart so only this test's product is ordered.
    await test.step('Step 3: Clear the cart if it is not empty', () => cart.emptyCart());

    // Search the two-UOM product by its ID and open its product page (PDP).
    await test.step(`Step 4: Search for the two-UOM product ${uomProductId} and open its product page`, () =>
      cart.searchAndOpenProduct(uomProductId));

    // Gen X / Gen Z pick the unit UOM; Gen Y checks the price changes when switching UOM. Then add to cart.
    await test.step('Step 5: Select the UOM and add the product to the cart', () => cart.addToCart({ selectUom: true }));

    // Open the cart page and wait until the product is listed.
    await test.step('Step 6: Open the shopping cart', () => cart.openCart());

    // Click "Proceed To Shipping & Billing", handle the cart popups and wait for the page to load.
    await test.step('Step 7: Proceed to Shipping & Billing', () => checkout.proceedToShippingAndBilling());

    // Choose the region's payment method and type the PO (Tosca rule: Gen X uses a random 7-digit PO).
    await test.step('Step 8: Choose the payment method and enter the PO number', () =>
      checkout.fillShippingAndBilling({ poNumber: GEP2_22324.poNumber, poRule: 'region' }));

    // Click "Review Order" and wait for the Review Order page.
    await test.step('Step 9: Review the order', () => checkout.goToReviewOrder());

    // Click "Submit Your Order", check "Your order has been submitted" and read the order number.
    const orderNumber = await test.step('Step 10: Submit the order and capture the order number', () => checkout.submitOrder());

    // Open My Orders from the header "Orders & Returns" button.
    await test.step('Step 11: Open My Orders', () => orderHistory.openMyOrders());

    // Search the new order number until it is listed (a new order can take a moment to appear).
    await test.step(`Step 12: Search order ${orderNumber} in Submitted Orders`, () => orderHistory.findSubmittedOrder(orderNumber));

    // Open the order's View & Track page by clicking its order number.
    await test.step('Step 13: Open the order with View & Track', () => orderHistory.openSubmittedOrder(orderNumber));

    // Gen X / Gen Z check the primary UOM; Gen Y checks the primary and secondary UOM.
    await test.step('Step 14: Verify the UOM is displayed for the ordered product', async () => {
      await orderDetailsPage.waitForLoaded();
      await region.expectUomOnOrder(orderDetailsPage, uomProductId);
    });

    // Tosca post condition: Gen Z sites sign out, Gen X/Y just close the browser.
    await test.step('Step 15: Post-condition: sign out', () => session.signOutAtEnd());
  });
 test('GEP2-18559 | Place Order from Unplaced Order section @GEP2-18559 @GEP @orders @unplacedOrders @placesOrder @regression', async ({
    session,
    cart,
    checkout,
    orderHistory,
    myOrdersPage,
    shoppingCartPage,
    header,
    region,
    marketData,
  }) => {
    // Open the site for the selected market and close the cookie / domain / launch popups.
    await test.step('Step 1: Launch the website and clear the launch popups', () => session.openSite());

    // Sign in with the user from .env and wait until the account menu shows.
    await test.step('Step 2: Sign in', () => session.login());

    // Start from an empty cart so the unplaced order only holds this test's product.
    await test.step('Step 3: Clear the cart if it is not empty', () => cart.emptyCart());

    // Search the product by its ID and open its product page (PDP).
    await test.step('Step 4: Search for the product and open its product page', () =>
      cart.searchAndOpenProduct(marketData.products.generic));

    // Handle the optional PDP options (COM dropdown, FR fixer type, backorder popup) and add to cart.
    await test.step('Step 5: Select the product options and add the product to the cart', () =>
      cart.addToCart({ handlePdpOptions: true }));

    // Tosca: on Gen X sites the cart only becomes an "unplaced order" after going through checkout
    // up to Review Order (without submitting).
    await test.step('Step 6: Go through checkout up to Review Order to create the unplaced order (Gen X only)', async () => {
      if (!region.reviewCreatesUnplacedOrder) return;
      await cart.openCart();
      await checkout.proceedToShippingAndBilling();
      await checkout.fillShippingAndBilling({ poNumber: GEP2_18559.poNumber, poRule: 'region' });
      await checkout.goToReviewOrder();
    });

    // Open My Orders from the header "Orders & Returns" button.
    await test.step('Step 7: Open My Orders', () => orderHistory.openMyOrders());

    // Open the Unplaced Orders tab.
    await test.step('Step 8: Open the Unplaced Orders tab', () => myOrdersPage.openUnplacedOrdersTab());

    // Check every column of the first unplaced order and keep its values (subtotal, item count, ...).
    const unplacedOrder = await test.step('Step 9: Verify the details of the first unplaced order', () =>
      myOrdersPage.unplacedOrders.verifyFirstOrderDetails());

    // "View & Modify" loads the unplaced order back into the cart.
    await test.step('Step 10: Open the unplaced order with View & Modify', () => myOrdersPage.unplacedOrders.viewAndModifyFirstOrder());

    // Open the cart page and wait until the order's items are listed.
    await test.step('Step 11: Open the shopping cart', () => cart.openCart());

    // Tosca stores these values but never compares them with the unplaced order, so they are only
    // recorded in the report (annotation) until QA confirms whether they should be asserted.
    await test.step('Step 12: Record the cart subtotal and item count in the report', async () => {
      const cartSubtotal = await shoppingCartPage.getCartSubtotal();
      const cartItemCount = await header.getCartItemCount();
      test.info().annotations.push({
        type: 'unplaced-order-vs-cart',
        description:
          `unplaced order: subtotal=${unplacedOrder.subtotal}, items=${unplacedOrder.itemsCount}; ` +
          `cart: subtotal=${cartSubtotal}, items=${cartItemCount}`,
      });
    });

    // Click "Proceed To Shipping & Billing", handle the cart popups and wait for the page to load.
    await test.step('Step 13: Proceed to Shipping & Billing', () => checkout.proceedToShippingAndBilling());

    // Choose the region's payment method and type the PO (Tosca rule: Gen X uses a random 7-digit PO).
    await test.step('Step 14: Choose the payment method and enter the PO number', () =>
      checkout.fillShippingAndBilling({ poNumber: GEP2_18559.poNumber, poRule: 'region' }));

    // Click "Review Order" and wait for the Review Order page.
    await test.step('Step 15: Review the order', () => checkout.goToReviewOrder());

    // Click "Submit Your Order" and check "Your order has been submitted".
    await test.step('Step 16: Submit the order and verify the order confirmation', () => checkout.submitOrder());

    // Tosca post condition: Gen Z sites sign out, Gen X/Y just close the browser.
    await test.step('Step 17: Post-condition: sign out', () => session.signOutAtEnd());
  });
  
});
