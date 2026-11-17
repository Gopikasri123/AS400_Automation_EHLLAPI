import { Locator } from '@playwright/test';
import { BasePage } from '../core/BasePage';

/** Site header, shown on every page: sign in / sign out, global search, cart and Orders & Returns. */
export class GepHeader extends BasePage {
  // Tosca: Sign In > Sign In Button
  private get headerSignInButton(): Locator {
    return this.page.locator('[data-test-id="user-login-click"]');
  }

  // Tosca: Header | sign out > IMG   | "Hi, <name>" user menu shown when logged in; hover shows Sign Out
  private get headerAccountMenu(): Locator {
    return this.page.locator('div.user-info');
  }

  // "Expand account menu" arrow next to "Hi, <name>" (also only present when logged in)
  private get headerAccountMenuExpandButton(): Locator {
    return this.page.getByRole('button', { name: 'Expand account menu' });
  }

  // Tosca: Header | sign out > Sign Out   | appears when hovering the user menu
  private get headerSignOutLink(): Locator {
    return this.page.locator('button.signOut__link');
  }

  // Tosca: HomePage | Sign out > Logout   | GenZ only
  private get headerLogoutButton(): Locator {
    return this.todo('GepHeader.headerLogoutButton', 'HomePage | Sign out > Logout');
  }

  // Tosca: Header |Cart > cart-icon   | opens the cart page directly on UK/US
  private get headerCartIcon(): Locator {
    return this.page.locator('[data-test-id="cart_image_icon"]');
  }

  // Tosca: Header | CartItemCount > CartItemCount   | not rendered when the cart is empty
  private get headerCartCountText(): Locator {
    return this.page.locator('[data-test-id="cart_image_qty"]');
  }

  // Tosca: GlobalSepdp_image_notfaviconarch > Search input box
  private get headerSearchInput(): Locator {
    return this.page.locator('[data-test-id="RecipientUsername"]');
  }

  // Tosca: GlobalSepdp_image_notfaviconarch > Search Icon (also "basic-addon2")
  private get headerSearchButton(): Locator {
    return this.page.locator('[data-test-id="basic-addon2"]');
  }

  // Tosca: Navigate to My Orders Page   | "Orders & Returns" (UK), "Order And Returns" (US)
  private get headerOrdersAndReturnsButton(): Locator {
    return this.page.getByRole('button', { name: /Orders? (&|And) Returns/ });
  }

  /** Tosca: Click on the sign in link on header. */
  async clickSignIn(): Promise<void> {
    await this.expectVisible(this.headerSignInButton);
    await this.click(this.headerSignInButton);
  }

  /** Waits until login has finished (the account menu replaces the Sign In button). */
  async expectLoggedIn(): Promise<void> {
    await this.expectVisible(this.headerAccountMenu.or(this.headerAccountMenuExpandButton).first(), 60000);
  }

  /** True when the header shows the account menu. Waits only until the header shows either Sign In or the menu. */
  // Returns as soon as the header renders; the long cap only matters because pages open without waiting for "load".
  async isLoggedIn(timeout = 15000): Promise<boolean> {
    await this.isVisibleWithin(this.headerAccountMenu.or(this.headerSignInButton), timeout);
    return this.isVisibleWithin(this.headerAccountMenu, 0);
  }

  /** Tosca: If "Header | sign out > IMG" exists, sign out first so the test starts logged out. */
  async signOutIfLoggedIn(): Promise<void> {
    if (!(await this.isLoggedIn())) return;
    // Clicking the menu opens the dashboard; the Sign Out link only shows on hover.
    await this.hover(this.headerAccountMenu);
    await this.expectVisible(this.headerSignOutLink);
    await this.click(this.headerSignOutLink);
  }

  /** Tosca: Fetch the product count of the shopping cart (CartItemCount). */
  async getCartItemCount(): Promise<number> {
    if (!(await this.isVisibleWithin(this.headerCartCountText))) return 0;
    return Number.parseInt(await this.readText(this.headerCartCountText), 10) || 0;
  }

  /** Waits until the header cart count shows at least one item. */
  async expectCartNotEmpty(): Promise<void> {
    await this.expectVisible(this.headerCartCountText,90000);
  }

  /** Tosca: Header |Cart > cart-icon. */
  async openCartFromHeader(): Promise<void> {
    await this.expectVisible(this.headerCartIcon);
    await this.click(this.headerCartIcon);
  }

  /** Tosca: Global Search. */
  async searchProduct(searchTerm: string): Promise<void> {
    await this.expectEnabled(this.headerSearchInput);
    await this.fill(this.headerSearchInput, searchTerm.trim());
    await this.click(this.headerSearchButton);
  }

  /** Opens My Orders with the header "Orders & Returns" button. */
  async openOrdersAndReturns(): Promise<void> {
    await this.expectVisible(this.headerOrdersAndReturnsButton);
    await this.click(this.headerOrdersAndReturnsButton);
  }

  /** Tosca: Post condition > Click on the SignOut (GenZ). */
  async logout(): Promise<void> {
    await this.expectVisible(this.headerLogoutButton);
    await this.click(this.headerLogoutButton);
    // Tosca: Verify logout Success and Signin Visible
    await this.expectVisible(this.headerSignInButton);
  }
}
