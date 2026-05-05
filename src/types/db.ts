export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  plain_password: string | null;
  account_number: string | null;
  total_balance: number;
  status: string;
  kyc_status: string;
  default_verification_code: string | null;
  cot_enabled: boolean;
  imf_enabled: boolean;
  tax_enabled: boolean;
  itc_enabled: boolean;
  created_at: string;
};

export type Transaction = {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  recipient: string | null;
  cot_code_verified: boolean;
  flagged: boolean;
  created_at: string;
};

export type Deposit = {
  id: string;
  user_id: string;
  amount: number;
  method: string | null;
  status: string;
  created_at: string;
};

export type Loan = {
  id: string;
  user_id: string;
  amount: number;
  term_months: number | null;
  purpose: string | null;
  status: string;
  created_at: string;
};

export type Transfer = {
  id: string;
  user_id: string;
  recipient_name: string | null;
  recipient_account: string | null;
  bank_name: string | null;
  amount: number;
  status: string;
  created_at: string;
};

export type Card = {
  id: string;
  user_id: string;
  card_number: string | null;
  card_holder: string | null;
  expiry: string | null;
  cvv: string | null;
  card_type: string | null;
  status: string | null;
  created_at: string;
};

export type WithdrawalCode = {
  id: string;
  user_id: string;
  code_type: "COT" | "IMF" | "TAX" | "ITC";
  code: string;
  enabled: boolean;
  verified: boolean;
  created_at: string;
};
