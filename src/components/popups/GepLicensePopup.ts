import { Locator } from '@playwright/test';
import { BasePage } from '../../core/BasePage';

/** Cart popup asking for licence details before checkout. */
export class GepLicensePopup extends BasePage {
  // Tosca: Shopping Cart | License Skip > DIV > Skip And Complete Later
  private get licenseSkipAndCompleteLaterButton(): Locator {
    return this.page.getByRole('button', { name: /Skip And Complete Later/i });
  }

  /** Tosca: If- License Popup Displayed. */
  async skipIfShown(timeout?: number): Promise<boolean> {
    return this.clickIfVisible(this.licenseSkipAndCompleteLaterButton, timeout);
  }
}
