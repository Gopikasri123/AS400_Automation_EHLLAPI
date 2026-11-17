import { Locator } from '@playwright/test';
import { BasePage } from '../core/BasePage';

export class GepReviewOrderPage extends BasePage {
  // Tosca: Review Order | SubmitOrder > Submit Your Order
  private get submitYourOrderButton(): Locator {
    return this.page.locator('[data-test-id="reviewOrder.SubmitOrderText27"]');
  }

  /** The request "Submit Your Order" sends to the order service, e.g. POST .../geny-web-orders/v1/hs-us/users/orders?lang=en */
  private static readonly SUBMIT_ORDER_REQUEST = /\/geny-web-orders\/v1\/[^/]+\/users\/orders(\?|$)/;

  /**
   * Tosca: Submit the order from the Order confirmation page.
   * Clicks once (a second click could place a second order) and fails straight away with the server's answer
   * when the order service rejects the order, e.g. a 502 while the QA order service is down.
   */
  async submitOrder(): Promise<void> {
    await this.expectUrl(/revieworder/, 60000);
    await this.expectVisible(this.submitYourOrderButton);
    const response = await this.clickAndWaitForResponse(
      this.submitYourOrderButton,
      (r) => r.request().method() === 'POST' && GepReviewOrderPage.SUBMIT_ORDER_REQUEST.test(r.url()),
      90000,
    );
    // No answer seen (e.g. another site calls a different service): the confirmation check that follows decides.
    if (!response || response.ok()) return;
    const body = (await response.text().catch(() => '')).trim().slice(0, 300);
    throw new Error(
      `Submitting the order failed: the order service returned ${response.status()} ${response.statusText()}.\n` +
        `POST ${response.url()}` +
        (body ? `\nResponse: ${body}` : ''),
    );
  }
}
