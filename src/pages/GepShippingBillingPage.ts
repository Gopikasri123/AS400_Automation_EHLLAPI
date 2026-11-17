import { Locator } from '@playwright/test';
import { BasePage } from '../core/BasePage';
import { GepDatePicker } from '../utils/GepDatePicker';
import type { DateFormat } from '../config/markets';
import { escapeRegExp } from '../utils/dataHelpers';

export type RecurringOrderDetails = {
  orderName: string;
  frequency: string;
  /** Picked from the "Begin Processing On" calendar. */
  startDate: Date;
  numberOfOrders: number;
};

/** Shipping & Billing: PO number, Shipping & Scheduling (immediate / recurring) and Payment Method. */
export class GepShippingBillingPage extends BasePage {
  // ---------------------------------------------------------------- PO number

  // Tosca: Shipping & Billing | PO number > PO# value (also Enter PO Number > PO# value / PO# Automatic)   | one PO# field on UK and US
  private get poNumberInput(): Locator {
    return this.page.locator('#poname');
  }

  // ---------------------------------------------------------------- Shipping & Scheduling

  // Shipping & Scheduling > "Immediate" radio (the site remembers the last schedule choice per account)   | reordered carts can split into multiple "Shipped From ..." sections, each with its own Immediate radio; the first section is the one that also offers Delayed/Recurring, so it is the one this check needs to reset
  private get immediateScheduleRadio(): Locator {
    return this.page.locator('input[type="radio"][value="IMMEDIATE"]').first();
  }

  // Tosca: Select Recurring Tab > RECURRING   | "Recurring" radio under Shipping & Scheduling
  private get recurringScheduleRadio(): Locator {
    return this.page.locator('input[name="scheduleOption"][value="RECURRING"]');
  }

  // Tosca: Shipping & Billing- Default shipping popup > Confirm   | not seen on UK/US
  private get defaultShippingDialogConfirmButton(): Locator {
    return this.page.getByRole('dialog').getByRole('button', { name: 'Confirm' });
  }

  // Tosca: Enter the Order and order count > Order Name
  private get recurringOrderNameInput(): Locator {
    return this.page.getByPlaceholder('Order Name');
  }

  // Tosca: Click Frequency selector dropdown > Fre   | data-test-id ends with the selected value, so match the prefix
  private get recurringFrequencyDropdown(): Locator {
    return this.page.locator('mat-select[data-test-id^="shipping&billingpage_arrow_"]');
  }

  // Tosca: Select the frequency value > FrequencyValue   | options read e.g. "Bi-Weekly. Get it every 14 days ..."
  private recurringFrequencyOption(frequency: string): Locator {
    return this.page.getByRole('option', { name: new RegExp(`^${escapeRegExp(frequency)}`) });
  }

  // Tosca: Recurring Order|InputDate > Click to pick a date   | "Begin Processing On"
  private get recurringStartDateInput(): Locator {
    return this.page.getByPlaceholder('Pick a Date');
  }

  // Tosca: Enter the Order and order count > NumberOfOrders   | "Total Number Of Orders"
  private get recurringNumberOfOrdersInput(): Locator {
    return this.page.locator('#hsTotalOrderId');
  }

  /** Calendar of the "Begin Processing On" field. */
  private readonly recurringStartDatePicker = new GepDatePicker(this.page, this.recurringStartDateInput);

  // ---------------------------------------------------------------- Payment Method

  // Tosca: GenX|Shipping & Billing | Payment method > downward arrow   | reordered carts can split into multiple "Shipped From ..." sections, each with its own Payment Method dropdown; the first section is the one Bill on Account applies to (partner-fulfilled sections force credit card), so it is the one this check needs
  private get paymentMethodDropdown(): Locator {
    return this.page.locator('mat-select[formcontrolname="paymentformcontrolvalue"]').first();
  }

  // Tosca: GenX|Shipping & Billing | Payment method > Bill on Account   | "Bill On Account" (UK), "Bill on Account" (US)
  private get paymentMethodBillOnAccountOption(): Locator {
    return this.page.getByRole('option', { name: 'Bill On Account' });
  }

  // Tosca: Shipping & Billing chose Payment > downward arrow
  private get paymentMethodDropdownGenY(): Locator {
    return this.todo('GepShippingBillingPage.paymentMethodDropdownGenY', 'Shipping & Billing chose Payment > downward arrow');
  }

  // Tosca: Shipping & Billing chose Payment > Bill on Account_GenY
  private get paymentMethodBillOnAccountOptionGenY(): Locator {
    return this.todo('GepShippingBillingPage.paymentMethodBillOnAccountOptionGenY', 'Shipping & Billing chose Payment > Bill on Account_GenY');
  }

  // Tosca: IT Payment method / Select 1st payment method > Payment method   | GenZ; assumed to be a native <select> (unverified)
  private get paymentMethodDropdownGenZ(): Locator {
    return this.todo('GepShippingBillingPage.paymentMethodDropdownGenZ', 'IT Payment method / Select 1st payment method > Payment method');
  }

  // Tosca: Shipping and billing | Credit Card pop up IT > Close
  private get creditCardDialogCloseButtonIT(): Locator {
    return this.todo('GepShippingBillingPage.creditCardDialogCloseButtonIT', 'Shipping and billing | Credit Card pop up IT > Close');
  }

  // ---------------------------------------------------------------- Review Order

  // Tosca: Click on Review Order > Review Order
  private get reviewOrderButton(): Locator {
    return this.page.locator('[data-test-id="shipping_button_revieworder"]');
  }

  // Tosca: Shipping & Billing | SubmitOrder > Submit Order   | budget notification overlay (not seen on UK/US)
  private get budgetDialogSubmitOrderButton(): Locator {
    return this.page.locator('ngb-modal-window').getByRole('button', { name: /submit order/i });
  }

  /** The page renders before its cart data arrives; Review Order is enabled once it has loaded. */
  async expectPageLoaded(): Promise<void> {
    await this.expectEnabled(this.reviewOrderButton, 90000);
  }

  /** Tosca: Shipping & Billing | PO number (Ctrl+A, Delete). */
  async clearPoNumber(): Promise<void> {
    await this.clear(this.poNumberInput);
  }

  /** Types the PO number into "PO#". */
  async enterPoNumber(poNumber: string): Promise<void> {
    await this.typeLikeUser(this.poNumberInput, poNumber);
  }

  /** Makes sure a normal (Immediate) order is placed, in case the account still has Delayed/Recurring selected. */
  async selectImmediateScheduleIfShown(): Promise<void> {
    if (await this.isVisibleWithin(this.immediateScheduleRadio, 3000)) {
      await this.check(this.immediateScheduleRadio);
    }
  }

  /** Tosca: Navigate to Recurring cart in Checkout. Also confirms the default shipping popup if it appears. */
  async selectRecurringSchedule(): Promise<void> {
    await this.check(this.recurringScheduleRadio);
    await this.clickIfVisible(this.defaultShippingDialogConfirmButton, 3000);
  }

  /** Tosca: EnterRecurringCartDetails (order name, frequency, start date, number of orders). */
  async enterRecurringOrderDetails(details: RecurringOrderDetails, dateFormat: DateFormat): Promise<void> {
    await this.expectVisible(this.recurringOrderNameInput);
    await this.typeLikeUser(this.recurringOrderNameInput, details.orderName);

    await this.click(this.recurringFrequencyDropdown);
    await this.click(this.recurringFrequencyOption(details.frequency));

    await this.recurringStartDatePicker.pickDate(details.startDate, dateFormat);
    await this.typeLikeUser(this.recurringNumberOfOrdersInput, String(details.numberOfOrders));
  }

  /** Tosca: Run Only for Gen X Countries > Bill on Account. UK pre-selects it, so it is only chosen when needed. */
  async selectBillOnAccount(): Promise<void> {
    await this.expectVisible(this.paymentMethodDropdown);
    if (/bill on account/i.test(await this.readText(this.paymentMethodDropdown))) return;
    await this.click(this.paymentMethodDropdown);
    await this.click(this.paymentMethodBillOnAccountOption);
  }

  /** Tosca: Else geny > Shipping & Billing chose Payment (Bill on Account_GenY). */
  async selectBillOnAccountGenY(): Promise<void> {
    await this.click(this.paymentMethodDropdownGenY);
    await this.click(this.paymentMethodBillOnAccountOptionGenY);
  }

  /** Tosca: GenZ IT Payment method (by label) or Select 1st payment method (#1). */
  async selectPaymentMethodGenZ(option: { label: string } | { index: number }): Promise<void> {
    await this.selectOption(this.paymentMethodDropdownGenZ, option);
  }

  /** Tosca: If Credit card popup exist (GenZ, IT) > Close. */
  async closeCreditCardDialogIfShownIT(): Promise<void> {
    await this.clickIfVisible(this.creditCardDialogCloseButtonIT);
  }

  /**
   * Tosca: Click on Review Order, then Shipping | BudgetNotification | Submit Overlay if it appears.
   * The first click can be ignored while the page is still settling, so it is retried until Review Order opens.
   */
  async goToReviewOrder(): Promise<void> {
    await this.expectEnabled(this.reviewOrderButton, 50000);
    await this.retryUntilPasses(async () => {
      if (!/revieworder/i.test(this.currentUrl())) {
        await this.click(this.reviewOrderButton);
        // Stops waiting for the budget overlay as soon as Review Order has opened.
        await this.clickIfVisibleUntil(this.budgetDialogSubmitOrderButton, () => /revieworder/i.test(this.currentUrl()), 30000);
      }
      await this.expectUrl(/revieworder/i, 15000);
    }, 90000);
  }
}
