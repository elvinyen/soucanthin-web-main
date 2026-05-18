import adminOrderPaymentReviewHandler from '../server/api/admin-order-payment-review.ts';
import adminWalletRechargeReviewHandler from '../server/api/admin-wallet-recharge-review.ts';
import { dispatchRoute } from './_utils.ts';

export default function handler(req: Parameters<typeof dispatchRoute>[0], res: Parameters<typeof dispatchRoute>[1]) {
  return dispatchRoute(req, res, {
    'order-payment-review': adminOrderPaymentReviewHandler,
    'wallet-recharge-review': adminWalletRechargeReviewHandler,
  });
}
