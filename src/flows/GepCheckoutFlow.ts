import { test } from '@playwright/test';
import type { Market } from '../config/markets';
import type { RegionBehaviour } from '../regions';
import type { GepPopups } from '../components/GepPopups';
import type { GepShoppingCartPage } from '../pages/GepShoppingCartPage';
import type { GepShippingBillingPage, RecurringOrderDetails } from '../pages/GepShippingBillingPage';
import type { GepReviewOrderPage } from '../pages/GepReviewOrderPage';
import type { GepOrderConfirmationPage } from '../pages/GepOrderConfirmationPage';
import { COMMON } from '../../data/common';

type Deps = {
  market: Market;
  region: RegionBehaviour;
  popups: GepPopups;
  shoppingCartPage: GepShoppingCartPage;
  shippingBillingPage: GepShippingBillingPage;
  reviewOrderPage: GepReviewOrderPage;
  orderConfirmationPage: GepOrderConfirmationPage;
};

export type ShippingBillingOptions = {
  poNumber: string;
  /**
   * 'fixed' (default) types poNumber as given.
   * 'region' applies the Tosca region rule instead (Gen X: a random 7-digit PO, others: poNumber).
   */
  poRule?: 'fixed' | 'region';
  /** Choose the payment method for the region (default true). */
  selectPayment?: boolean;
};

/** Tosca reusable blocks: Navigate to shipping and billing page, Enter PO / payment, Review, Submit, Order Confirmation. */
export class GepCheckoutFlow {
  constructor(private readonly deps: Deps) {}

  /** Tosca: Navigate to shipping and billing page (including the cart popups). */
  async proceedToShippingAndBilling(): Promise<void> {
    // Cart lines with the required text field (e.g. reordered items) block checkout until it is filled.
    await this.deps.shoppingCartPage.fillRequiredTextFieldsIfShown(COMMON.requiredProductText);
    await this.deps.shoppingCartPage.proceedToShippingAndBilling();
    await this.deps.shippingBillingPage.expectPageLoaded();
  }

  /** Immediate order: selects "Immediate" if another schedule is set, the region's payment method and the PO number. */
  async fillShippingAndBilling(options: ShippingBillingOptions): Promise<void> {
    const { market, region, shippingBillingPage } = this.deps;
    await shippingBillingPage.selectImmediateScheduleIfShown();
    if (options.selectPayment ?? true) await region.selectPaymentMethod(shippingBillingPage, market);
    await shippingBillingPage.enterPoNumber(this.poNumberFor(options));
  }

  /** Tosca: Navigate to Recurring cart in Checkout + EnterRecurringCartDetails. */
  async fillRecurringOrder(options: ShippingBillingOptions & { recurring: RecurringOrderDetails }): Promise<void> {
    const { market, region, shippingBillingPage } = this.deps;
    await shippingBillingPage.clearPoNumber();
    await shippingBillingPage.selectRecurringSchedule();
    await shippingBillingPage.enterPoNumber(this.poNumberFor(options));
    await shippingBillingPage.enterRecurringOrderDetails(options.recurring, market.dateFormat);
    if (options.selectPayment ?? true) await region.selectPaymentMethod(shippingBillingPage, market);
  }

  /** Tosca: Click the Review order CTA in shipping and Billing page (and the budget popup if shown). */
  async goToReviewOrder(): Promise<void> {
    await this.deps.shippingBillingPage.goToReviewOrder();
  }

  /** Tosca: Submit the order, Checkout | Order Confirmation, FetchOrderNumber. Returns the order number. */
  async submitOrder(): Promise<string> {
    const { region, popups, reviewOrderPage, orderConfirmationPage } = this.deps;
    await reviewOrderPage.submitOrder();
    await region.afterOrderSubmitted(popups);
    await orderConfirmationPage.expectOrderSubmitted();
    const orderNumber = await orderConfirmationPage.getOrderNumber();
    // Shown in the HTML report next to the test, so the order can be looked up on the site.
    test.info().annotations.push({ type: 'order-number', description: orderNumber });
    return orderNumber;
  }

  private poNumberFor(options: ShippingBillingOptions): string {
    return options.poRule === 'region' ? this.deps.region.poNumberFor(options.poNumber) : options.poNumber;
  }
}
