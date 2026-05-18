import adminOrderPaymentReviewHandler from '../server/api/admin-order-payment-review';
import adminWalletRechargeReviewHandler from '../server/api/admin-wallet-recharge-review';
import { dispatchRoute } from './_utils';

export default function handler(req: Parameters<typeof dispatchRoute>[0], res: Parameters<typeof dispatchRoute>[1]) {
  return dispatchRoute(req, res, {
    'order-payment-review': adminOrderPaymentReviewHandler,
    'wallet-recharge-review': adminWalletRechargeReviewHandler,
  });
}
