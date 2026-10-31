// Plain constants (not a "use server" module) so both server actions and client forms can import them.

export const PAYMENT_METHODS = ["BANK_TRANSFER", "UPI", "CARD", "CASH", "CHEQUE", "OTHER"] as const;

export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodValue, string> = {
  BANK_TRANSFER: "Bank transfer",
  UPI: "UPI",
  CARD: "Card",
  CASH: "Cash",
  CHEQUE: "Cheque",
  OTHER: "Other",
};
