import { Locator } from '@playwright/test';
import { BasePage } from '../core/BasePage';
import { GepPopups } from '../components/GepPopups';

/** Shopping cart page, plus the mini cart popup used on sites that have one. */
export class GepShoppingCartPage extends BasePage {
  private readonly popups = new GepPopups(this.page);

  // Tosca: Waiton for ItemCode to display > Item code goes here
  private get cartFirstItemCodeText(): Locator {
    return this.page.locator('[data-test-id="cart_textbox_itemcode"]').first();
  }

  // Tosca: Shopping Cart|GuestCartIcon > View Cart
  private get miniCartGuestViewCartButton(): Locator {
    return this.todo('GepShoppingCartPage.miniCartGuestViewCartButton', 'Shopping Cart|GuestCartIcon > View Cart');
  }

  // Tosca: Shopping Cart|LoggedInCartIcon > DIV   | UK: the header cart DIV (role=button); there is no mini cart
  private get miniCartLoggedInViewCartButton(): Locator {
    return this.page.getByRole('button', { name: /^cart-icon/ });
  }

  // Tosca: Shopping Cart | Clear Cart > Clear Cart
  private get cartClearBasketLink(): Locator {
    return this.page.locator('[data-test-id="shoppingCart.RemoveCartText46"]');
  }

  // Tosca: Checkout | Proceed to Shipping and billing page > Shipping and billing button
  private get cartProceedToShippingBillingButton(): Locator {
    return this.page.locator('[data-test-id="cart_button_shippingbilling"]');
  }

  // Tosca: (not in export) Shopping Cart > Text Form Required*   | required "test*" text field on a cart line; blocks Proceed To Shipping & Billing until filled
  private get cartRequiredTextInputs(): Locator {
    return this.page.getByRole('textbox', { name: /^Text Form Required/ });
  }

  // Tosca: Fetch the cart subtotal after new product is added > SubTotal   | order summary "Subtotal", e.g. "$ 99.99"
  private get cartSubtotalText(): Locator {
    return this.page.locator('.subTotalPriceValue .subFinalPrice').first();
  }

  /** Tosca: Fetch the cart subtotal after new product is added (InnerText -> cartAddSubTotal). */
  async getCartSubtotal(): Promise<string> {
    await this.expectVisible(this.cartSubtotalText);
    return this.readText(this.cartSubtotalText);
  }

  /** Tosca: Waiton for ItemCode to display (the cart page quick-order box). */
  async expectItemInCart(): Promise<void> {
    // Items (e.g. reordered ones) can take a while to show in the cart; reload until they do.
    await this.retryUntilPasses(async () => {
      if (!(await this.isVisibleWithin(this.cartFirstItemCodeText, 10000))) {
        await this.reloadPage();
        await this.expectVisible(this.cartFirstItemCodeText, 10000);
      }
    }, 90000);
  }

  /** Tosca: Click on Cart Icon > View Cart. Uses the logged-in variant when present, else the guest one. */
  async openCartFromMiniCartPopup(): Promise<void> {
    // UK/US: the cart icon opens the cart page directly, there is no mini cart.
    if (this.currentUrl().includes('/shoppingcart')) return;
    if (await this.clickIfVisible(this.miniCartLoggedInViewCartButton, 3000)) return;
    await this.click(this.miniCartGuestViewCartButton);
  }

  /** Tosca: Shopping Cart | Clear Cart. */
  async clearCart(): Promise<void> {
    await this.expectVisible(this.cartClearBasketLink);
    await this.click(this.cartClearBasketLink);
    await this.expectHidden(this.cartClearBasketLink);
  }

  /** Fills the required text field of every cart line that has one (not in Tosca), e.g. items added by Reorder. */
  async fillRequiredTextFieldsIfShown(value: string): Promise<number> {
    if (!(await this.isVisibleWithin(this.cartRequiredTextInputs, 3000))) return 0;
    const count = await this.countOf(this.cartRequiredTextInputs);
    let filled = 0;
    for (let index = 0; index < count; index++) {
      const input = this.cartRequiredTextInputs.nth(index);
      // Skip hidden copies of the field: typing into one waits for the full action timeout on every key.
      if (!(await this.isVisibleWithin(input, 0))) continue;
      await this.typeLikeUser(input, value);
      filled++;
    }
    return filled;
  }

  /** Tosca: Navigate to shipping and billing page, including the cart popups. */
  async proceedToShippingAndBilling(): Promise<void> {
    await this.expectVisible(this.cartProceedToShippingBillingButton);
    await this.click(this.cartProceedToShippingBillingButton);
    await this.dismissCheckoutPopups(15000);

    // The first click can be swallowed while the cart is still loading; retry until the page changes.
    await this.retryUntilPasses(async () => {
      if (!this.onShippingAndBilling()) {
        await this.click(this.cartProceedToShippingBillingButton);
        await this.dismissCheckoutPopups(10000);
      }
      await this.expectUrl(/shippingandbilling/, 10000);
    }, 60000);
  }

  private onShippingAndBilling(): boolean {
    return this.currentUrl().includes('shippingandbilling');
  }

  /**
   * Handles the popups that can follow "Proceed To Shipping & Billing" (inventory notice, free item, licence,
   * controlled substances) until Shipping & Billing opens or the timeout ends. It stops as soon as the page
   * has changed, so popups that are not shown cost no waiting time.
   */
  private async dismissCheckoutPopups(timeout: number): Promise<void> {
    const deadline = Date.now() + timeout;
    while (!this.onShippingAndBilling() && Date.now() < deadline) {
      if (await this.popups.inventoryNotice.continueIfShown(0)) continue;
      if (await this.popups.freeItem.continueWithoutFreeItemIfShown(0)) continue;
      // Tosca clicks "Shipping and billing" again after the License / Controlled Substances popups are dismissed.
      if ((await this.popups.license.skipIfShown(0)) || (await this.popups.controlledSubstances.skipIfShown(0))) {
        await this.click(this.cartProceedToShippingBillingButton);
        continue;
      }
      await this.page.waitForTimeout(250);
    }
  }
}
