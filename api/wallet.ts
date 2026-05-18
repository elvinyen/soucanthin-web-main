import walletRechargeStripeCancelHandler from '../server/api/wallet-recharge-stripe-cancel.ts';
import walletRechargeStripeHandler from '../server/api/wallet-recharge-stripe.ts';
import walletRechargeTngHandler from '../server/api/wallet-recharge-tng.ts';
import walletTransactionsHandler from '../server/api/wallet-transactions.ts';
import { dispatchRoute } from './_utils.ts';

export default function handler(req: Parameters<typeof dispatchRoute>[0], res: Parameters<typeof dispatchRoute>[1]) {
  return dispatchRoute(req, res, {
    'recharge/stripe': walletRechargeStripeHandler,
    'recharge/stripe-cancel': walletRechargeStripeCancelHandler,
    'recharge/tng': walletRechargeTngHandler,
    transactions: walletTransactionsHandler,
  });
}
