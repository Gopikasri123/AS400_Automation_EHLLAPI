/**
 * Order statuses shown on Order Details (Tosca: TDM Condition == 'OCOrderStatus').
 * The check is case-insensitive, see GepOrderDetailsPage.expectOrderStatus.
 */
export const ORDER_STATUS = {
  // Status of a newly submitted UK Medical order
  PENDING_LOCATION_VERIFICATION: 'Pending location verification',
  // Status of a newly submitted UK Dental order
  PROCESSING: 'Processing',
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];
