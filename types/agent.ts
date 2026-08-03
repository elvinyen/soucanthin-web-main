export type AgentApplicationStatus = 'pending' | 'changes_requested' | 'approved' | 'rejected' | 'activated';
export type AgentStatus = 'active' | 'suspended' | 'terminated';
export type AgentLedgerStatus = 'pending' | 'available' | 'paid' | 'voided';

export type AgentPortalData = {
  application: null | {
    applicationNo: string;
    fullName: string;
    region: string;
    promotionChannel: string;
    whatsappPhone: string;
    message: string;
    status: AgentApplicationStatus;
    reviewNote: string;
    createdAt: string;
  };
  agent: null | {
    agentNo: string;
    referralCode: string;
    referralUrl: string;
    fullName: string;
    region: string;
    promotionChannel: string;
    whatsappPhone: string;
    status: AgentStatus;
    commissionRate: number | null;
    activatedAt: string;
  };
  summary: {
    pending: number;
    available: number;
    paid: number;
    referrals: number;
    orders: number;
    todayEarnings: number;
    sevenDayEarnings: number;
    thirtyDayEarnings: number;
    totalEarnings: number;
    todayOrders: number;
    sevenDayOrders: number;
    thirtyDayOrders: number;
  };
  commissions: {
    id: string;
    orderId?: string | null;
    type: string;
    amount: number;
    status: AgentLedgerStatus;
    note?: string | null;
    createdAt: string;
  }[];
  orders: {
    id: string;
    orderId: string;
    orderNo: string;
    eligibleAmount: number;
    commissionRate: number;
    commissionAmount: number;
    status: 'pending' | 'available' | 'voided' | 'paid';
    createdAt: string;
  }[];
  payouts: {
    id: string;
    payoutNo: string;
    amount: number;
    status: 'pending' | 'approved' | 'paid' | 'rejected';
    bankName: string;
    maskedAccountNumber: string;
    reviewNote: string;
    requestedAt: string;
    paidAt?: string | null;
  }[];
  profileChangeRequest: null | {
    id: string;
    requestNo: string;
    requestedData: { fullName?: string; region?: string; promotionChannel?: string; whatsappPhone?: string };
    reason: string;
    status: 'pending' | 'changes_requested' | 'approved' | 'rejected' | 'cancelled';
    reviewNote: string;
    createdAt: string;
    reviewedAt?: string | null;
  };
  whatsappUrl: string;
};
