import walletRechargeStripeCancelHandler from '../server/api/wallet-recharge-stripe-cancel';
import walletRechargeStripeHandler from '../server/api/wallet-recharge-stripe';
import walletRechargeTngHandler from '../server/api/wallet-recharge-tng';
import walletTransactionsHandler from '../server/api/wallet-transactions';
import { dispatchRoute } from './_utils';

export default function handler(req: Parameters<typeof dispatchRoute>[0], res: Parameters<typeof dispatchRoute>[1]) {
  return dispatchRoute(req, res, {
    'recharge/stripe': walletRechargeStripeHandler,
    'recharge/stripe-cancel': walletRechargeStripeCancelHandler,
    'recharge/tng': walletRechargeTngHandler,
    transactions: walletTransactionsHandler,
  });
}
