import { Locator } from '@playwright/test';
import { BasePage } from '../../core/BasePage';

/** Popup with a "Confirmar" button that some sites show when they open (Tosca: FR popup). */
export class GepLaunchPopup extends BasePage {
  // Tosca: Launch popup - confirm button > Confirmar
  private get launchPopupConfirmButton(): Locator {
    return this.page.getByRole('button', { name: 'Confirmar' });
  }

  /** Tosca: FR popup / "Launch popup - confirm button" (Confirmar). */
  async confirmIfShown(timeout = 5000): Promise<boolean> {
    return this.clickIfVisible(this.launchPopupConfirmButton, timeout);
  }
}
