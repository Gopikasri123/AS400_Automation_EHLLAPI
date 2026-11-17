import type { Market } from '../config/markets';
import type { GepHeader } from '../components/GepHeader';
import type { GepPopups } from '../components/GepPopups';
import type { GepHomePage } from '../pages/GepHomePage';
import type { GepProductDetailPage } from '../pages/GepProductDetailPage';
import type { GepShippingBillingPage } from '../pages/GepShippingBillingPage';
import type { GepOrderDetailsPage } from '../pages/GepOrderDetailsPage';

/** Tosca "Gen" condition from TDM: which UI variant a site uses. */
export type RegionName = 'genx' | 'geny' | 'genz';

export type LaunchContext = {
  home: GepHomePage;
  header: GepHeader;
  popups: GepPopups;
  market: Market;
  /** SIGN_IN_ONCE: the test starts from the saved signed-in session, so the stale-session sign-out is skipped. */
  signedInSession: boolean;
};

/**
 * Everything that differs between the Gen X / Gen Y / Gen Z sites. Flows and tests call these
 * instead of branching on the region themselves, so each difference lives in exactly one place.
 */
export interface RegionBehaviour {
  readonly name: RegionName;

  /** GEP2-18559: going through checkout up to Review Order is what saves the cart as an unplaced order. */
  readonly reviewCreatesUnplacedOrder: boolean;

  /** URL to open for the market. */
  siteUrl(market: Market): string;

  /** Tosca: Precondition-Launch the HS Website (popups, domain picker, stale sessions). */
  clearLaunchPopups(context: LaunchContext): Promise<void>;

  /** Tosca: Choose payment method. */
  selectPaymentMethod(shippingBilling: GepShippingBillingPage, market: Market): Promise<void>;

  /** Tosca: Enter the PO Number. Returns the PO number to type for the test case's PO. */
  poNumberFor(testCasePoNumber: string): string;

  /** Tosca: UOM selection on the PDP before adding to cart (GEP2-22324). */
  selectUom(productDetail: GepProductDetailPage): Promise<void>;

  /** Tosca: UOM check on the order's View & Track page (GEP2-22324). */
  expectUomOnOrder(orderDetails: GepOrderDetailsPage, productId: string): Promise<void>;

  /** Tosca: If GenX wait > Close Customer FeedBack survey popup. */
  afterOrderSubmitted(popups: GepPopups): Promise<void>;

  /** Tosca: Post condition CloseBrowser. */
  signOutAtEnd(header: GepHeader): Promise<void>;
}
