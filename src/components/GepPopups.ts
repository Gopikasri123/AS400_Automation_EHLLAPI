import { Page } from '@playwright/test';
import { GepCookieBanner } from './popups/GepCookieBanner';
import { GepLaunchPopup } from './popups/GepLaunchPopup';
import { GepAdPopup } from './popups/GepAdPopup';
import { GepFreeItemPopup } from './popups/GepFreeItemPopup';
import { GepInventoryNoticePopup } from './popups/GepInventoryNoticePopup';
import { GepLicensePopup } from './popups/GepLicensePopup';
import { GepControlledSubstancesPopup } from './popups/GepControlledSubstancesPopup';
import { GepFeedbackSurveyPopup } from './popups/GepFeedbackSurveyPopup';
import { GepOrdersAndReturnsPopup } from './popups/GepOrdersAndReturnsPopup';

/**
 * Every optional popup and overlay, one named class each (in ./popups), reached through one object,
 * e.g. popups.cookieBanner.acceptIfShown(). Every action is safe to call when the popup is absent.
 */
export class GepPopups {
  // When the site opens
  readonly cookieBanner: GepCookieBanner;
  readonly launchPopup: GepLaunchPopup;
  readonly adPopup: GepAdPopup;
  // Shopping cart, after "Proceed To Shipping & Billing"
  readonly freeItem: GepFreeItemPopup;
  readonly inventoryNotice: GepInventoryNoticePopup;
  readonly license: GepLicensePopup;
  readonly controlledSubstances: GepControlledSubstancesPopup;
  // Order confirmation and My Orders
  readonly feedbackSurvey: GepFeedbackSurveyPopup;
  readonly ordersAndReturns: GepOrdersAndReturnsPopup;

  constructor(page: Page) {
    this.cookieBanner = new GepCookieBanner(page);
    this.launchPopup = new GepLaunchPopup(page);
    this.adPopup = new GepAdPopup(page);
    this.freeItem = new GepFreeItemPopup(page);
    this.inventoryNotice = new GepInventoryNoticePopup(page);
    this.license = new GepLicensePopup(page);
    this.controlledSubstances = new GepControlledSubstancesPopup(page);
    this.feedbackSurvey = new GepFeedbackSurveyPopup(page);
    this.ordersAndReturns = new GepOrdersAndReturnsPopup(page);
  }
}
