import { Locator } from '@playwright/test';
import { BasePage } from '../../core/BasePage';

/** US cart: "Important:" warehouse / additional charges notice shown after "Proceed To Shipping & Billing". */
export class GepInventoryNoticePopup extends BasePage {
  // US cart: "Important:" warehouse/charges notice shown after Proceed To Shipping & Billing
  private get inventoryNoticeContinueButton(): Locator {
    return this.page.locator('[data-test-id="inventoryWHPopup.ContinueWithoutBtnText"]');
  }

  /** Continue goes on to Shipping & Billing. */
  async continueIfShown(timeout?: number): Promise<boolean> {
    return this.clickIfVisible(this.inventoryNoticeContinueButton, timeout);
  }
}
