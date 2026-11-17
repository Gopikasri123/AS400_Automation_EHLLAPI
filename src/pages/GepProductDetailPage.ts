import { Locator } from '@playwright/test';
import { BasePage } from '../core/BasePage';

export class GepProductDetailPage extends BasePage {
  // Tosca: PDP|QuantityInput > quantity-box   | hint: may be id "quantity-box" (unverified)
  private get pdpQuantityInput(): Locator {
    return this.page.locator('[data-test-id="pdp_input_quantityinput"]');
  }

  // Tosca: Add to cart > PDP add to cart (also PDP | Add To Cart > Add To Cart in GEP2-18257)
  private get pdpAddToCartButton(): Locator {
    return this.page.locator('[data-test-id="pdp_button_additemtocart"] [data-test-id="pdp_button_addcart"]').first();
  }

  // Tosca: PDP|COMDropdown > Dropdown Required*   | only shown for some products
  private get pdpComDropdown(): Locator {
    return this.page.getByRole('combobox', { name: /Required/i });
  }

  // Tosca: (not in export) PDP > Text Form Required*   | required "test*" text field on some QA products; Add To Cart stays disabled until filled
  private get pdpRequiredTextInput(): Locator {
    return this.page.getByRole('textbox', { name: /^Text Form Required/ });
  }

  // Tosca: Select the dropdown value > users   | first/only COM option (unverified)
  private get pdpComUsersOption(): Locator {
    return this.todo('GepProductDetailPage.pdpComUsersOption', 'Select the dropdown value > users');
  }

  // Tosca: Click FixerType > Rapide Fixer   | FR only
  private get pdpRapideFixerOption(): Locator {
    return this.todo('GepProductDetailPage.pdpRapideFixerOption', 'Click FixerType > Rapide Fixer');
  }

  // Tosca: Verify the Backorder Modal is displayed > Modal
  private get pdpBackorderDialog(): Locator {
    return this.page.getByRole('dialog').filter({ hasText: /back ?order/i });
  }

  // Tosca: Click Add to cart in Backorder Modal > Add To Cart
  private get pdpBackorderAddToCartButton(): Locator {
    return this.pdpBackorderDialog.getByRole('button', { name: /Add To (Basket|Cart)/i });
  }

  // Tosca: PDP | Unite   | GenX/GenZ; module has no controls in the export. UK: the first "Unit of measure" button (e.g. Each)
  private get pdpUomUnitOption(): Locator {
    return this.page.locator('[data-test-id="pdp_li_uom_value"]').first();
  }

  // Tosca: Verify Price Changes when UOM is changed_Reference > UOM selector   | GenY; reusable block not in export
  private get pdpUomDropdown(): Locator {
    return this.todo('GepProductDetailPage.pdpUomDropdown', 'Verify Price Changes when UOM is changed_Reference > UOM selector');
  }

  // Tosca: Verify Price Changes when UOM is changed_Reference > secondary UOM option   | GenY; reusable block not in export
  private get pdpSecondaryUomOption(): Locator {
    return this.todo(
      'GepProductDetailPage.pdpSecondaryUomOption',
      'Verify Price Changes when UOM is changed_Reference > secondary UOM option'
    );
  }

  // Tosca: Verify Price Changes when UOM is changed_Reference > product price   | GenY; reusable block not in export
  private get pdpPriceText(): Locator {
    return this.todo('GepProductDetailPage.pdpPriceText', 'Verify Price Changes when UOM is changed_Reference > product price');
  }

  /** Tosca: PDP|QuantityInput ({BACKSPACE}{SENDKEYS[50]}). */
  async enterQuantity(quantity: number): Promise<void> {
    await this.expectVisible(this.pdpQuantityInput);
    await this.fill(this.pdpQuantityInput, String(quantity));
  }

  /** Tosca: Select the COM value in PDP. Only runs when the COM dropdown exists. */
  async selectComValueIfShown(): Promise<boolean> {
    if (!(await this.isVisibleWithin(this.pdpComDropdown, 3000))) return false;
    await this.click(this.pdpComDropdown);
    await this.click(this.pdpComUsersOption);
    return true;
  }

  /** Fills the product's required text field (not in Tosca). Only runs when the field exists. */
  async fillRequiredTextIfShown(value: string): Promise<boolean> {
    if (!(await this.isVisibleWithin(this.pdpRequiredTextInput, 3000))) return false;
    await this.typeLikeUser(this.pdpRequiredTextInput.first(), value);
    return true;
  }

  /** Tosca: If Country is FR > If fixertype exist, click "Rapide Fixer". */
  async selectFixerTypeIfRequired(country: string): Promise<boolean> {
    // Tosca: ValidCountries = FR
    if (country !== 'FR') return false;
    return this.clickIfVisible(this.pdpRapideFixerOption, 3000);
  }

  /** Tosca: Add to cart. */
  async clickAddToCart(): Promise<void> {
    await this.click(this.pdpAddToCartButton);
  }

  /** Tosca: If "Verify the Backorder Modal is displayed", click Add To Cart in the modal. */
  async confirmBackorderIfShown(): Promise<boolean> {
    if (!(await this.isVisibleWithin(this.pdpBackorderDialog, 3000))) return false;
    await this.click(this.pdpBackorderAddToCartButton);
    return true;
  }

  /** Tosca: PDP | Unite (GenX/GenZ). Selects the unit UOM before adding to cart. */
  async selectUnitUom(): Promise<void> {
    await this.expectVisible(this.pdpUomUnitOption);
    await this.click(this.pdpUomUnitOption);
  }

  /** Tosca: Verify Price Changes when UOM is changed_Reference (GenY). The price must differ after switching UOM. */
  async verifyPriceChangesWhenUomChanged(): Promise<void> {
    await this.expectVisible(this.pdpPriceText);
    const primaryUomPrice = await this.readText(this.pdpPriceText);

    await this.click(this.pdpUomDropdown);
    await this.click(this.pdpSecondaryUomOption);

    await this.expectNotText(this.pdpPriceText, primaryUomPrice);
  }
}
