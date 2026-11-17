import type { RegionBehaviour } from './RegionBehaviour';
import { COMMON } from '../../data/common';

/** Gen Z sites (e.g. FR, IT, NL). Not verified against a live Gen Z site yet (several locators are still TODO). */
export const GEN_Z: RegionBehaviour = {
  name: 'genz',
  reviewCreatesUnplacedOrder: false,

  siteUrl: (market) => market.baseUrl,

  async clearLaunchPopups({ popups }) {
    // Tosca: GenZ > FR popup, then Accept the Cookie
    await popups.launchPopup.confirmIfShown();
    await popups.cookieBanner.acceptIfShown();
  },

  async selectPaymentMethod(shippingBilling, market) {
    if (market.country === 'IT') {
      // Tosca: If IT select Condizione di Pagamento Abituale (ValidCountries = IT)
      await shippingBilling.closeCreditCardDialogIfShownIT();
      await shippingBilling.selectPaymentMethodGenZ({ label: COMMON.itPaymentMethod });
    } else {
      // Tosca: Select 1st payment method (#1)
      await shippingBilling.selectPaymentMethodGenZ({ index: 0 });
    }
  },

  poNumberFor: (testCasePoNumber) => testCasePoNumber,

  // Tosca: If Country = GenZ > PDP | Unite
  selectUom: (productDetail) => productDetail.selectUnitUom(),

  // Tosca: GenZ > HenrySchein| My Orders | View&Track > Product In Order Page - Primary UOM
  expectUomOnOrder: (orderDetails, productId) => orderDetails.expectPrimaryUomDisplayed(productId),

  async afterOrderSubmitted() {},

  // Tosca: Post condition CloseBrowser signs out only for Gen Z countries
  signOutAtEnd: (header) => header.logout(),
};
