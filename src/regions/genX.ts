import type { RegionBehaviour } from './RegionBehaviour';
import { randomDigits } from '../utils/dataHelpers';

/** Gen X sites (UK, US). */
export const GEN_X: RegionBehaviour = {
  name: 'genx',
  // Tosca: Verify if Country is genx then update values in genxcustomerData
  reviewCreatesUnplacedOrder: true,

  siteUrl: (market) => market.baseUrl,

  async clearLaunchPopups({ home, header, popups, market, signedInSession }) {
    // Tosca: GenX and GenY
    if (!signedInSession) await header.signOutIfLoggedIn();
    await popups.cookieBanner.acceptIfShown();
    // Tosca: Domain Check for Genx-UK
    await home.selectDomainIfRequired(market.country, market.domain);
    if (!signedInSession) await header.signOutIfLoggedIn();
    // The popup comes with the page, so once the header has rendered a short wait is enough (it saved 5 s per test).
    else await header.isLoggedIn();
    await popups.launchPopup.confirmIfShown(2000);
  },

  // Tosca: Run Only for Gen X Countries > Bill on Account
  selectPaymentMethod: (shippingBilling) => shippingBilling.selectBillOnAccount(),

  // Tosca: GenX replaces the pre-filled "PO# Automatic" value with a random 7-digit number ({RND[7]})
  poNumberFor: () => randomDigits(7),

  // Tosca: Run Only for Gen X Countries > PDP | Unite
  selectUom: (productDetail) => productDetail.selectUnitUom(),

  // Tosca: Gen X > HenrySchein| My Orders | View&Track > Product In Order Page - Primary UOM
  expectUomOnOrder: (orderDetails, productId) => orderDetails.expectPrimaryUomDisplayed(productId),

  async afterOrderSubmitted(popups) {
    await popups.feedbackSurvey.closeIfShown();
  },

  // Tosca: only Gen Z signs out; Gen X just closes the browser
  async signOutAtEnd() {},
};
