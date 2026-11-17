import { Locator } from '@playwright/test';
import { BasePage } from '../../core/BasePage';

/** Cookie consent banner shown when the site opens. */
export class GepCookieBanner extends BasePage {
  // Tosca: Cookie | AcceptAll > Accept All
  private get cookieDialogAcceptAllButton(): Locator {
    return this.page.getByRole('dialog', { name: 'Cookie Settings' }).getByRole('button', { name: 'Accept all' });
  }

  // Tosca: Accept Cookies > Accept All   | may be the same element as cookieDialogAcceptAllButton (unverified)
  private get cookieAcceptAllFallbackButton(): Locator {
    return this.page.getByRole('button', { name: 'Accept all' });
  }

  /** Tosca: Accept the Cookie. The banner can match either cookie module, so both are tried. */
  async acceptIfShown(): Promise<boolean> {
    // Consent already saved in this browser (the banner's Usercentrics record, e.g. from a SIGN_IN_ONCE session
    // or the Chrome profile): the banner will not show, so don't wait 10 s for it.
    if ((await this.readLocalStorage('uc_user_interaction')) === 'true') return false;
    if (await this.clickIfVisible(this.cookieDialogAcceptAllButton, 10000)) return true;
    return this.clickIfVisible(this.cookieAcceptAllFallbackButton);
  }
}
