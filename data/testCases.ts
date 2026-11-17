/**
 * Fixed data per test case, taken from the Tosca scripts. Market-dependent data is in marketData.ts,
 * shared values in common.ts, and credentials in .env.
 */

export const GEP2_36899 = {
  tcId: 'GEP2-36899',
  title: 'Verify submitted order in My order page',
  // Tosca: PDP|QuantityInput > quantity-box ({SENDKEYS[50]})
  quantity: 50,
  // Tosca: Shipping & Billing | PO number > PO# value (used on every market, per the provided test data)
  poNumber: '3787329720',
} as const;

/** Cross-platform: GEP2-36899 order, checked in the AS400 (PUB400) ORDERS table, then a Main Menu option searched on the site. */
export const GEP2_36899_AS400 = {
  tcId: 'GEP2-36899',
  title: 'Website order verified in AS400 ORDERS table and IBM i Main Menu option searched on the website',
  // IBM i Main Menu option whose text is scraped from the green screen (1 = "User tasks")
  menuOption: 1,
} as const;

export const GEP2_18257 = {
  tcId: 'GEP2-18257',
  title: 'Verify user able to see the orders on Future & Recurring Tab',
  // Tosca: Shipping & Billing | PO number > PO# value (used on every market, per the provided test data)
  poNumber: '3787329720',
  // Tosca: Generate Buffer > recurringOrderName (Tosca used {RANDOMTEXT[7]}; fixed value from the provided test data)
  recurringOrderName: 'NewOrder',
  // Tosca: Generate Buffer > recurringOrderCount (Tosca used {RND[1][52]}; fixed value from the provided test data)
  recurringOrderCount: 1,
  // "Begin Processing On" = today + this many days (the site's earliest allowed date is tomorrow)
  recurringStartInDays: 1,
} as const;

export const GEP2_18230 = {
  tcId: 'GEP2-18230',
  title: 'E2E of The Reorder option from an order on the Order History page',
  // Tosca: Shipping & Billing | PO number > PO# value (non-GenX regions; GenX uses a random 7-digit PO)
  poNumber: '3787329720',
} as const;

export const GEP2_18559 = {
  tcId: 'GEP2-18559',
  title: 'Place Order from Unplaced Order section',
  // Tosca: Shipping & Billing | PO number > PO# value (non-GenX regions; GenX uses a random 7-digit PO)
  poNumber: '3787329720',
} as const;

export const GEP2_22324 = {
  tcId: 'GEP2-22324',
  title: 'End-to-End flow for UOM display on Order History page',
  // Tosca: Shipping & Billing | PO number > PO# value (non-GenX regions; GenX uses a random 7-digit PO)
  poNumber: '3787329720',
} as const;
