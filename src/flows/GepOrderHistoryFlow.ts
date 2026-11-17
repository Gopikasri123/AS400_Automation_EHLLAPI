import type { GepHeader } from '../components/GepHeader';
import type { GepPopups } from '../components/GepPopups';
import type { GepMyOrdersPage } from '../pages/GepMyOrdersPage';

type Deps = {
  header: GepHeader;
  popups: GepPopups;
  myOrdersPage: GepMyOrdersPage;
};

/** Tosca reusable blocks: Navigate to My Orders Page, Search the Order, View & Track, Recurring order tab. */
export class GepOrderHistoryFlow {
  constructor(private readonly deps: Deps) {}

  /** Tosca: Navigate to My Orders Page (header "Orders & Returns" > Submitted Orders). */
  async openMyOrders(): Promise<void> {
    const { header, popups, myOrdersPage } = this.deps;
    await header.openOrdersAndReturns();
    // Tosca: Search the Order -My Orders Page > Orders & Returns close
    await popups.ordersAndReturns.closeIfShown();
    await myOrdersPage.openSubmittedOrdersTab();
  }

  /** Tosca: Search the Order -My Orders Page. Waits until the (just submitted) order is listed. */
  async findSubmittedOrder(orderNumber: string): Promise<void> {
    const { submittedOrders } = this.deps.myOrdersPage;
    await submittedOrders.searchUntilListed(orderNumber);
    await submittedOrders.expectSubmittedOrderListed(orderNumber);
  }

  /** Tosca: Navigate to viewandtrackmyorders for orderId Buffer. */
  async openSubmittedOrder(orderNumber: string): Promise<void> {
    await this.deps.myOrdersPage.submittedOrders.openOrder(orderNumber);
  }

  /** Tosca: Click View and Track button in My Account orders section (first order in the list). */
  async openFirstSubmittedOrder(): Promise<void> {
    await this.deps.myOrdersPage.submittedOrders.openFirstOrder();
  }

  /** Tosca: Navigate to Recurring order Tab, Search the Order -RecurringOrderTab, Manage Upcoming. */
  async findRecurringOrder(orderNumber: string): Promise<void> {
    const { myOrdersPage } = this.deps;
    await myOrdersPage.openFutureRecurringTab();
    await myOrdersPage.futureRecurringOrders.searchRecurringOrder(orderNumber);
    await myOrdersPage.futureRecurringOrders.expectRecurringOrderListed(orderNumber);
    await myOrdersPage.futureRecurringOrders.expectManageUpcomingVisible();
  }
}
