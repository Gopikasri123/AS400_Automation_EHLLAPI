import type { RegionBehaviour } from './RegionBehaviour';
import { withCacheBuster } from '../utils/dataHelpers';

/** Gen Y sites. Not verified against a live Gen Y site yet (several locators are still TODO). */
export const GEN_Y: RegionBehaviour = {
  name: 'geny',
  reviewCreatesUnplacedOrder: false,

  // Tosca: GenY "To remove any buffers" adds ?<random>=<random> so Akamai doesn't serve a cached page
  siteUrl: (market) => withCacheBuster(market.baseUrl),

  async clearLaunchPopups({ header, popups, signedInSession }) {
    // Tosca: GenX and GenY
    if (!signedInSession) await header.signOutIfLoggedIn();
    await popups.cookieBanner.acceptIfShown();
    // Tosca: "Close the ad popup" is in the Else branch, which only GenY reaches
    await popups.adPopup.closeIfShown();
    if (!signedInSession) await header.signOutIfLoggedIn();
    await popups.launchPopup.confirmIfShown();
  },

  // Tosca: Else geny > Bill on Account_GenY
  selectPaymentMethod: (shippingBilling) => shippingBilling.selectBillOnAccountGenY(),

  poNumberFor: (testCasePoNumber) => testCasePoNumber,

  // Tosca: Else > Verify Price Changes when UOM is changed_Reference
  selectUom: (productDetail) => productDetail.verifyPriceChangesWhenUomChanged(),

  // Tosca: Else > Validate Presence of Primary&Secondary UOM_Reference
  expectUomOnOrder: (orderDetails, productId) => orderDetails.expectPrimaryAndSecondaryUomDisplayed(productId),

  async afterOrderSubmitted() {},

  async signOutAtEnd() {},
};
