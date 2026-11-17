import type { MarketId, TestEnv } from '../src/config/markets';
import { ORDER_STATUS } from './orderStatus';

/** Test data that depends on the market (Tosca TDM rows per {CP[Country]}). No credentials here: those live in the test data database. */
export type MarketData = {
  products: {
    /** Tosca: TDM Condition == 'Generic' (product to order) */
    generic: string;
    /** Product that can be ordered with quantity 50 (GEP2-36899) */
    bulkOrder: string;
    /** Tosca: TDM Condition == 'Productwith2UOM' (primary and secondary UOM, GEP2-22324) */
    twoUom: string;
  };
  /** Tosca: TDM Condition == 'OCOrderStatus' (status of a newly submitted order on Order Details) */
  expectedOrderStatus: string;
  /** Tosca: TDM Condition == 'recurringFrequency' (option text in the recurring frequency dropdown) */
  recurringFrequency: string;
};

/** Per environment, then per market. Add a UAT or prod block when those sites get their own products. */
const MARKET_DATA: Record<TestEnv, Partial<Record<MarketId, MarketData>>> = {
  qa: {
    us: {
      products: { generic: '1127079', bulkOrder: '1127081', twoUom: '5704279' },
      expectedOrderStatus: ORDER_STATUS.PROCESSING,
      recurringFrequency: 'Bi-Weekly',
    },
    'uk-dental': {
      products: { generic: '143513', bulkOrder: '9884830', twoUom: '' },
      expectedOrderStatus: ORDER_STATUS.PROCESSING,
      recurringFrequency: 'Bi-Weekly',
    },
    'uk-medical': {
      products: { generic: '', bulkOrder: '', twoUom: 'DIS40302' },
      expectedOrderStatus: ORDER_STATUS.PENDING_LOCATION_VERIFICATION,
      recurringFrequency: 'Bi-Weekly',
    },
  },
  uat: {},
  prod: {},
};

/** Market data where an empty value fails with a clear message when a test reads it. */
export function getMarketData(env: TestEnv, marketId: MarketId): MarketData {
  const data = MARKET_DATA[env][marketId];
  if (!data) throw new Error(`No test data for ${env}/${marketId}. Add it in data/marketData.ts.`);
  const required = (key: keyof MarketData['products']) => {
    const value = data.products[key];
    if (!value) throw new Error(`products.${key} is not set for ${env}/${marketId}. Add it in data/marketData.ts.`);
    return value;
  };
  return {
    ...data,
    products: {
      get generic() {
        return required('generic');
      },
      get bulkOrder() {
        return required('bulkOrder');
      },
      get twoUom() {
        return required('twoUom');
      },
    },
  };
}
