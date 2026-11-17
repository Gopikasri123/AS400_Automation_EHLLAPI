import { Locator } from '@playwright/test';
import { BasePage } from '../../core/BasePage';

/** Cart form for controlled substances, shown before checkout. */
export class GepControlledSubstancesPopup extends BasePage {
  // Tosca: Controlled Substances Form on Shopping Cart > Confirm Skip
  private get controlledSubstancesConfirmSkipButton(): Locator {
    return this.page.getByRole('button', { name: /Confirm Skip/i });
  }

  /** Tosca: Close Controlled Substances Form. */
  async skipIfShown(timeout?: number): Promise<boolean> {
    return this.clickIfVisible(this.controlledSubstancesConfirmSkipButton, timeout);
  }
}
