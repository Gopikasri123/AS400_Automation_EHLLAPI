import { Locator } from '@playwright/test';
import { BaseComponent } from '../../core/BaseComponent';

/** My Orders > Submitted Orders tab, including the UK "Pending Location Orders" section. */
export class GepSubmittedOrdersTab extends BaseComponent {
  protected get root(): Locator {
    return this.page.locator('#submitted-orders-tab-panel');
  }

  // Tosca: Orders | Submitted order > Submitted order Search   | the panel renders twice; use the visible one
  private get submittedOrdersSearchInput(): Locator {
    return this.root.locator('[data-test-id="submittedorder_textbox_search"]').filter({ visible: true }).first();
  }

  // Tosca: Orders | Submitted order > Submitted order search-button
  private get submittedOrdersSearchButton(): Locator {
    return this.root.locator('button[aria-label="search-button"]').filter({ visible: true }).first();
  }

  // Tosca: Orders | View&Track > View & Track   | one per order row; the first row is used
  private get submittedOrdersViewAndTrackLinks(): Locator {
    return this.page.locator('a[data-test-id="submitted_orders_component_a_13"]:visible');
  }

  // Not in the Tosca export: UK lists new orders under "Pending Location Orders" until the location is verified
  private get pendingLocationOrdersSection(): Locator {
    return this.page.locator('app-submitted-orders').filter({ has: this.page.getByRole('heading', { name: 'Pending Location Orders' }) });
  }

  // Tosca: My Account | My Orders | Search Orders > Search INput box   | UK "Pending Location Orders" section
  private get pendingLocationSearchInput(): Locator {
    return this.pendingLocationOrdersSection.getByRole('searchbox', { name: 'Search', exact: true });
  }

  // Tosca: My Account | My Orders | Search Orders > search_btn   | UK "Pending Location Orders" section
  private get pendingLocationSearchButton(): Locator {
    return this.pendingLocationOrdersSection.getByRole('button', { name: 'search-button' });
  }

  // Tosca: Orders > OrderNumberPass in Buffer   | order number link, e.g. "WEB02731065"
  private submittedOrderLink(orderNumber: string): Locator {
    return this.page.getByRole('link', { name: orderNumber }).first();
  }

  /**
   * Tosca: Search the Order -My Orders Page. A just-submitted order can take a while to be searchable,
   * so the search is repeated (with a reload) until the order shows. On UK the order may first appear
   * under "Pending Location Orders", which is searched first when present.
   */
  async searchUntilListed(orderNumber: string): Promise<void> {
    let attempt = 0;
    await this.retryUntilPasses(async () => {
      if (attempt++ > 0) await this.reloadPage();
      if (await this.isVisibleWithin(this.pendingLocationSearchInput, 3000)) {
        await this.search(this.pendingLocationSearchInput, this.pendingLocationSearchButton, orderNumber);
        if (await this.isVisibleWithin(this.submittedOrderLink(orderNumber), 10000)) return;
      }
      await this.search(this.submittedOrdersSearchInput, this.submittedOrdersSearchButton, orderNumber);
      await this.expectVisible(this.submittedOrderLink(orderNumber), 15000);
    }, 180000);
  }

  /** Tosca: Submitted order TABLE > $1 > $1 (VisibleInnerText == Ordernumber). */
  async expectSubmittedOrderListed(orderNumber: string): Promise<void> {
    await this.expectVisible(this.submittedOrderLink(orderNumber));
  }

  /** Tosca: Navigate to viewandtrackmyorders for orderId Buffer. Opens the order's View & Track page. */
  async openOrder(orderNumber: string): Promise<void> {
    await this.expectVisible(this.submittedOrderLink(orderNumber));
    await this.click(this.submittedOrderLink(orderNumber));
  }

  /** Tosca: Click View and Track button in My Account orders section (first order in the list). */
  async openFirstOrder(): Promise<void> {
    const firstViewAndTrack = this.submittedOrdersViewAndTrackLinks.first();
    await this.expectVisible(firstViewAndTrack);
    await this.click(firstViewAndTrack);
  }

  private async search(input: Locator, button: Locator, orderNumber: string): Promise<void> {
    await this.expectVisible(input);
    await this.fill(input, orderNumber);
    await this.click(button);
  }
}
