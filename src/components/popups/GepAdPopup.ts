import { Locator } from '@playwright/test';
import { BasePage } from '../../core/BasePage';

/** Advertising popup shown when the site opens (Gen Y). */
export class GepAdPopup extends BasePage {
  // Tosca: Click on Close for Ad > Close icon
  private get adPopupCloseIcon(): Locator {
    return this.todo('GepAdPopup.adPopupCloseIcon', 'Click on Close for Ad > Close icon');
  }

  /** Tosca: Close the ad popup. */
  async closeIfShown(): Promise<boolean> {
    return this.clickIfVisible(this.adPopupCloseIcon);
  }
}
