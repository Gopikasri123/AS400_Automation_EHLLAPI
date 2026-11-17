/** Values that are the same for every test case (taken from the Tosca scripts). */
export const COMMON = {
  // Tosca: Enter the Answer > Your answer* ({SENDKEYS["Test"]})
  securityAnswer: 'Test',
  // Tosca: IT Payment method > Payment method (GenZ, IT only)
  itPaymentMethod: 'Condizione di Pagamento Abituale',
  // Not in Tosca: required "test*" text field ("Text Form Required*", max 35) added to QA products in Nov 2026
  requiredProductText: 'Automation test',
} as const;
