import { Locator } from '@playwright/test';
import { BasePage } from '../core/BasePage';

export class GepOrderConfirmationPage extends BasePage {
  // Tosca: Checkout | Order Confirmation > Your order has been submitted !
  private get orderSubmittedText(): Locator {
    return this.page.getByText(/Your order has been submitted/i).first();
  }

  // Tosca: Order Number > Order Number
  private get orderNumberText(): Locator {
    // following:: matches every later caption1-regular div, so take the first one (the value under the label).
    return this.page.locator("//div[@data-test-id='orderconfirmation_span_ordernumber']//following::div[@class='caption1-regular']").first();
  }

  /** Tosca: Checkout | Order Confirmation (Verify "Your order has been submitted !"). */
  async expectOrderSubmitted(): Promise<void> {
    // Placing the order can take well over the default 10 s on the QA sites; the wait ends as soon as the message shows.
    await this.expectVisible(this.orderSubmittedText, 90000);
  }

  /** Tosca: FetchOrderNumber in Order Confirmation Page (InnerText -> Ordernumber). */
  async getOrderNumber(): Promise<string> {
    // The value is filled in shortly after the confirmation message appears.
    await this.expectText(this.orderNumberText, /\S/);
    const orderNumber = await this.readText(this.orderNumberText);
    if (!/\d{5,}/.test(orderNumber)) throw new Error(`Unexpected order number on the confirmation page: "${orderNumber}"`);
    return orderNumber;
  }
}
