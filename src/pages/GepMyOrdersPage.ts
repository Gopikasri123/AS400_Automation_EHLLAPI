import { Locator } from '@playwright/test';
import { BasePage } from '../core/BasePage';
import { GepSubmittedOrdersTab } from '../components/orders/GepSubmittedOrdersTab';
import { GepUnplacedOrdersTab } from '../components/orders/GepUnplacedOrdersTab';
import { GepFutureRecurringTab } from '../components/orders/GepFutureRecurringTab';

/** My Orders (opened from the header "Orders & Returns"): the order tabs. */
export class GepMyOrdersPage extends BasePage {
  readonly submittedOrders = new GepSubmittedOrdersTab(this.page);
  readonly unplacedOrders = new GepUnplacedOrdersTab(this.page);
  readonly futureRecurringOrders = new GepFutureRecurringTab(this.page);

  // Tosca: Click on Orders > Orders   | "Submitted Orders" tab
  private get submittedOrdersTab(): Locator {
    return this.page.locator('[data-test-id="orders_tab_submittedorder"]');
  }

  // Tosca: Orders Page Tab > Unplaced Orders
  private get unplacedOrdersTab(): Locator {
    return this.page.locator('[data-test-id="orders_tab_unplacedorder"]');
  }

  // Tosca: Recurring Orders > Future & Recurring
  private get futureRecurringTab(): Locator {
    return this.page.locator('[data-test-id="orders_tab_futureandrecurring"]');
  }

  /** Opens the Submitted Orders tab. */
  async openSubmittedOrdersTab(): Promise<void> {
    await this.expectVisible(this.submittedOrdersTab);
    await this.click(this.submittedOrdersTab);
  }

  /** Tosca: Navigate to UnplacedOrders Tab. */
  async openUnplacedOrdersTab(): Promise<void> {
    await this.expectVisible(this.unplacedOrdersTab);
    await this.click(this.unplacedOrdersTab);
  }

  /** Tosca: Navigate to Recurring order Tab (Future & Recurring). */
  async openFutureRecurringTab(): Promise<void> {
    await this.expectVisible(this.futureRecurringTab);
    await this.click(this.futureRecurringTab);
  }
}
