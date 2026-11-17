import { Locator } from '@playwright/test';
import { BasePage } from '../../core/BasePage';

/** Cart popup offering a free item, shown after "Proceed To Shipping & Billing". */
export class GepFreeItemPopup extends BasePage {
  // Tosca: Shopping Cart | Free Item Popup > Continue Without Free Item
  private get freeItemContinueWithoutButton(): Locator {
    return this.page.locator('[data-test-id="expressCheckoutPopup.ContinueWithoutBtnText4"]');
  }

  /** Tosca: Verify Free Item Visible then select. */
  async continueWithoutFreeItemIfShown(timeout?: number): Promise<boolean> {
    return this.clickIfVisible(this.freeItemContinueWithoutButton, timeout);
  }
}
