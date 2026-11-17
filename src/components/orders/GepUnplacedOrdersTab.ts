import { Locator } from '@playwright/test';
import { BaseComponent } from '../../core/BaseComponent';

/** Values captured from the first row of the Unplaced Orders tab (Tosca buffers UnplacedOrder*). */
export type UnplacedOrderDetails = {
  createdDate: string;
  shippingAccountNumber: string;
  subtotal: string;
  itemsCount: string;
  lastModifiedDate: string;
};

/** My Orders > Unplaced Orders tab. */
export class GepUnplacedOrdersTab extends BaseComponent {
  protected get root(): Locator {
    return this.page.locator('#unplaced-orders-tab-panel');
  }

  // First data row of the unplaced orders table (Tosca uses the first row, as the site lists it)
  private get unplacedOrderFirstRow(): Locator {
    return this.root.locator('tbody tr[data-test-id="unplaced_orders_component_tr_1"]').first();
  }

  // Tosca: Unplaced Orders Tab > TBODY > Created Date   | "Date Created" column, e.g. "09/27/2026"
  private get unplacedOrderCreatedDateCell(): Locator {
    return this.unplacedOrderFirstRow.locator('[data-test-id="unplaced_orders_component_span_30"]');
  }

  // Tosca: Unplaced Orders Tab > TBODY > Created By User   | "Created By" column
  private get unplacedOrderCreatedByUserCell(): Locator {
    return this.unplacedOrderFirstRow.locator('[data-test-id="unplaced_orders_component_p_27"]');
  }

  // Tosca: Unplaced Orders Tab > TBODY > Shipping Account Number   | "Shipping Account #" column, e.g. "#3713020"
  private get unplacedOrderShippingAccountNumberCell(): Locator {
    return this.unplacedOrderFirstRow.locator('[data-test-id="unplaced_orders_component_span_25"]');
  }

  // Tosca: Unplaced Orders Tab > TBODY > Subtotal Value   | inside the "Order Summary" cell, e.g. "$ 99.99"
  private get unplacedOrderSubtotalCell(): Locator {
    return this.unplacedOrderFirstRow.locator('[data-test-id="unplaced_orders_component_a_21"]');
  }

  // Tosca: Unplaced Orders Tab > TBODY > Items Count   | value after the "Items #" label in the "Order Summary" cell
  private get unplacedOrderItemsCountCell(): Locator {
    return this.unplacedOrderFirstRow.locator('[data-test-id="unplacedOrders.ItemsHashText16"] + p');
  }

  // Tosca: Unplaced Orders Tab > TBODY > Location Address   | "Shipping Address" column
  private get unplacedOrderLocationAddressCell(): Locator {
    return this.unplacedOrderFirstRow.locator('[data-test-id="unplaced_orders_component_a_17"] address');
  }

  // Tosca: Unplaced Orders Tab > TBODY > Last Modified date   | "Last Modified" column
  private get unplacedOrderLastModifiedDateCell(): Locator {
    return this.unplacedOrderFirstRow.locator('[data-test-id="unplaced_orders_component_td_14"] .submission_date_value');
  }

  // Tosca: Unplaced Orders Tab > TBODY > View & Modify   | some rows (e.g. created by an approver) only show "View"
  private get unplacedOrderViewAndModifyLink(): Locator {
    return this.unplacedOrderFirstRow.locator('[data-test-id="unplacedOrders.ViewAndModifyText23"]');
  }

  /** Tosca: Validation of UnplacedOrdersTab. Verifies every column of the first row and returns the captured values. */
  async verifyFirstOrderDetails(): Promise<UnplacedOrderDetails> {
    const columns = [
      this.unplacedOrderCreatedDateCell,
      this.unplacedOrderCreatedByUserCell,
      this.unplacedOrderShippingAccountNumberCell,
      this.unplacedOrderSubtotalCell,
      this.unplacedOrderItemsCountCell,
      this.unplacedOrderLocationAddressCell,
      this.unplacedOrderLastModifiedDateCell,
      this.unplacedOrderViewAndModifyLink,
    ];
    for (const column of columns) {
      await this.expectVisible(column);
    }

    return {
      createdDate: await this.readText(this.unplacedOrderCreatedDateCell),
      // Tosca reads OuterText here; innerText is the Playwright equivalent
      shippingAccountNumber: await this.readText(this.unplacedOrderShippingAccountNumberCell),
      subtotal: await this.readText(this.unplacedOrderSubtotalCell),
      itemsCount: await this.readText(this.unplacedOrderItemsCountCell),
      lastModifiedDate: await this.readText(this.unplacedOrderLastModifiedDateCell),
    };
  }

  /** Tosca: CLick on View & Modify in UnplacedOrdersTab. Loads the unplaced order back into the cart. */
  async viewAndModifyFirstOrder(): Promise<void> {
    await this.click(this.unplacedOrderViewAndModifyLink);
  }
}
