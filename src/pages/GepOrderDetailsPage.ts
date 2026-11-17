import { Locator } from '@playwright/test';
import { BasePage } from '../core/BasePage';
import { escapeRegExp } from '../utils/dataHelpers';

/** Order details ("View & Track"), opened from My Orders: status, reorder and the ordered products. */
export class GepOrderDetailsPage extends BasePage {
  // Tosca: OrderDetails|Reorder > Reorder
  private get reorderLink(): Locator {
    return this.page.getByText('Reorder', { exact: true });
  }

  // Tosca: OrderDetails|ReorderConfirmModal > close   | reorder confirmation dialog
  private get reorderDialogCloseButton(): Locator {
    return this.page.locator('[data-test-id="view_and_track_my_orders_component_button_1"]');
  }

  // Tosca: Fetch the order status in order details page > Status
  private get orderStatusText(): Locator {
    return this.page.locator('[data-test-id="viewAndTrackMyOrders.OrderStatusText18"] + *');
  }

  // Tosca: HenrySchein| My Orders | View&Track > Product In Order Page - Primary UOM   | located by the ordered product ID
  private orderProductPrimaryUomText(productId: string): Locator {
    return this.page.locator('.product-summary').filter({ hasText: productId }).locator('[data-test-id="viewAndTrackMyOrders.UomText1"]');
  }

  // Tosca: Validate Presence of Primary&Secondary UOM_Reference > Secondary UOM   | GenY; reusable block not in export
  private orderProductSecondaryUomText(productId: string): Locator {
    return this.todo(
      'GepOrderDetailsPage.orderProductSecondaryUomText',
      `Validate Presence of Primary&Secondary UOM_Reference > Secondary UOM (${productId})`
    );
  }

  /** Tosca: Click the Reorder link in the order details page, then Close the Reorder Modal. */
  async reorder(): Promise<void> {
    await this.expectVisible(this.reorderLink);
    await this.page.waitForTimeout(3000);
    await this.click(this.reorderLink);
    await this.expectVisible(this.reorderDialogCloseButton); // wait for the modal to be fully loaded before closing it
    await this.click(this.reorderDialogCloseButton);
    await this.expectHidden(this.reorderDialogCloseButton);
  }

  /** Wait for the View & Track page to finish loading before checking its content. */
  async waitForLoaded(): Promise<void> {
    await this.page.waitForLoadState('load');
  }

  /** Tosca: Verify the Status in order details page ({STRINGTOLOWER} on both sides, so case-insensitive). */
  async expectOrderStatus(expectedStatus: string): Promise<void> {
    await this.expectText(this.orderStatusText, new RegExp(`^\\s*${escapeRegExp(expectedStatus.trim())}\\s*$`, 'i'));
  }

  /** Tosca: Validate Presence of Primary&Secondary UOM (GenX/GenZ only verify the primary UOM). */
  async expectPrimaryUomDisplayed(productId: string): Promise<void> {
    await this.expectVisible(this.orderProductPrimaryUomText(productId));
  }

  /** Tosca: Validate Presence of Primary&Secondary UOM_Reference (GenY). */
  async expectPrimaryAndSecondaryUomDisplayed(productId: string): Promise<void> {
    await this.expectVisible(this.orderProductPrimaryUomText(productId));
    await this.expectVisible(this.orderProductSecondaryUomText(productId));
  }
}
