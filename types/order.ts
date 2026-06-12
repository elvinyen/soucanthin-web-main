
export type OrderType = "dinein" | "takeaway";
export type PaymentMethod = "cash" | "tng" | "stripe" | "wallet";
export type OrderStatus = "pending_confirm" | "preparing" | "delivering" | "delivered" | "completed" | "cancelled";

export interface ReceiptImage {
  fileName: string;
  mimeType: string;
  dataBase64: string;
}

export interface Order {
  orderType: OrderType;
  paymentMethod: PaymentMethod;
  customer: {
    name: string;
    phone: string;
  };
  userId?: string;
  dineIn?: {
    tableNo: string;
  };
  takeaway?: {
    address: string;
    note?: string;
  };
  items: {
    id: string;
    code?: string;
    name: string;
    basePrice?: number;
    optionsTotal?: number;
    price: number;
    qty: number;
    options?: {
      groupId: string;
      groupName: string;
      optionId: string;
      name: string;
      priceDelta: number;
    }[];
    note?: string;
  }[];
  subtotal: number;
  deliveryFee?: number;
  deliveryQuote?: {
    branchId: string;
    branchName: string;
    addressLatitude: number;
    addressLongitude: number;
    distanceKm: number;
    durationMin: number;
    deliveryFee: number;
    provider: string;
  };
  serviceCharge: number;
  total: number;
  couponId?: string;
  discountAmount?: number;
  payableTotal?: number;
  receiptImage?: ReceiptImage;
  note?: string;
  createdAt: string;
}
