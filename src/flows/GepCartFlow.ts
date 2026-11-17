import type { Market } from '../config/markets';
import type { RegionBehaviour } from '../regions';
import type { GepHeader } from '../components/GepHeader';
import type { GepSearchResultsPage } from '../pages/GepSearchResultsPage';
import type { GepProductDetailPage } from '../pages/GepProductDetailPage';
import type { GepShoppingCartPage } from '../pages/GepShoppingCartPage';
import { COMMON } from '../../data/common';

type Deps = {
  market: Market;
  region: RegionBehaviour;
  header: GepHeader;
  searchResultsPage: GepSearchResultsPage;
  productDetailPage: GepProductDetailPage;
  shoppingCartPage: GepShoppingCartPage;
};

export type AddToCartOptions = {
  /** Tosca: PDP|QuantityInput */
  quantity?: number;
  /** Tosca: Select the COM value, FR fixer type and Backorder modal (only acted on when shown / applicable) */
  handlePdpOptions?: boolean;
  /** Tosca: UOM selection for the region before adding to cart (GEP2-22324) */
  selectUom?: boolean;
};

/** Tosca reusable blocks: Clear Cart, Search and add product to cart from PDP, Click on Cart Icon. */
export class GepCartFlow {
  constructor(private readonly deps: Deps) {}

  /** Tosca: Clear Cart > If CartItemCount != 0. */
  async emptyCart(): Promise<void> {
    const { header, shoppingCartPage } = this.deps;
    if ((await header.getCartItemCount()) === 0) return;
    await header.openCartFromHeader();
    await shoppingCartPage.openCartFromMiniCartPopup();
    await shoppingCartPage.clearCart();
  }

  /** Global Search with free text (not a product ID) and wait until the results page shows the term. */
  async searchText(term: string): Promise<void> {
    await this.deps.header.searchProduct(term);
    await this.deps.searchResultsPage.expectResultsFor(term);
  }

  /** Tosca: Global Search + SelectProductinGrid SRP | Navigate to PDP. */
  async searchAndOpenProduct(productId: string): Promise<void> {
    await this.deps.header.searchProduct(productId);
    await this.deps.searchResultsPage.openProductFromResults(productId);
  }

  /** Tosca: Add to cart (on the open PDP), then wait until the header cart count shows the item. */
  async addToCart(options: AddToCartOptions = {}): Promise<void> {
    const { market, region, header, productDetailPage } = this.deps;
    if (options.selectUom) await region.selectUom(productDetailPage);
    if (options.handlePdpOptions) {
      await productDetailPage.selectComValueIfShown();
      // Tosca: If Country is FR (ValidCountries = FR) > If fixertype exist
      await productDetailPage.selectFixerTypeIfRequired(market.country);
    }
    // Add To Cart stays disabled until the product's required text field (when it has one) is filled.
    await productDetailPage.fillRequiredTextIfShown(COMMON.requiredProductText);
    if (options.quantity !== undefined) await productDetailPage.enterQuantity(options.quantity);
    await productDetailPage.clickAddToCart();
    if (options.handlePdpOptions) await productDetailPage.confirmBackorderIfShown();
    await header.expectCartNotEmpty();
  }

  /** Tosca: Click on Cart Icon > View Cart, then wait until the cart shows its items. */
  async openCart(): Promise<void> {
    const { header, shoppingCartPage } = this.deps;
    await header.openCartFromHeader();
    await shoppingCartPage.openCartFromMiniCartPopup();
    await shoppingCartPage.expectItemInCart();
  }
}
