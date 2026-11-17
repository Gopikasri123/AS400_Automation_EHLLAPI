import { Locator } from '@playwright/test';
import { BasePage } from '../../core/BasePage';

/** "Orders & Returns" overlay that can open on top of the My Orders page. */
export class GepOrdersAndReturnsPopup extends BasePage {
  // Tosca: Orders & Returns > close   | optional overlay on the My Orders page
  private get ordersAndReturnsDialogCloseButton(): Locator {
    return this.page
      .getByRole('dialog', { name: 'Orders & Returns' })
      .getByRole('button', { name: /close/i })
      .or(this.page.locator('ngb-modal-window').getByRole('button', { name: /close/i }));
  }

  /** Tosca: Search the Order -My Orders Page > If "Orders & Returns" close is visible, click it. */
  async closeIfShown(): Promise<boolean> {
    return this.clickIfVisible(this.ordersAndReturnsDialogCloseButton, 3000);
  }
}
