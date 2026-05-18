export interface AuthUser {
  id: string;
  phone: string;
  displayPhone: string;
  name?: string | null;
  email?: string | null;
  birthday?: string | null;
  createdAt: string;
  lastLoginAt?: string | null;
}

export interface WalletSummary {
  balance: number;
  currency: 'MYR';
}

export interface WalletTransaction {
  id: string;
  type: 'recharge' | 'payment' | 'refund' | 'adjustment';
  method: 'stripe' | 'tng' | 'manual' | 'wallet';
  amount: number;
  status: 'pending' | 'succeeded' | 'rejected' | 'failed';
  note?: string | null;
  receiptUrl?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface UserOrderSummary {
  id: string;
  orderNo: string;
  total: number;
  subtotal?: number;
  serviceCharge?: number;
  discountAmount?: number;
  payableTotal?: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  orderType?: string;
  tableNo?: string | null;
  deliveryAddress?: string | null;
  note?: string | null;
  items?: {
    id?: string;
    name: string;
    price: number;
    quantity: number;
    lineTotal: number;
    options?: {
      groupId: string;
      groupName: string;
      optionId: string;
      name: string;
      priceDelta: number;
    }[];
    note?: string | null;
  }[];
  createdAt: string;
}

export interface UserAddress {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  address: string;
  isDefault: boolean;
}

export interface UserCoupon {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  discountAmount: number;
  status: string;
  expiresAt?: string | null;
  usedAt?: string | null;
}

export interface AuthMeResponse {
  success: boolean;
  authenticated: boolean;
  user?: AuthUser;
  wallet?: WalletSummary;
  orders?: UserOrderSummary[];
  addresses?: UserAddress[];
  coupons?: UserCoupon[];
}
