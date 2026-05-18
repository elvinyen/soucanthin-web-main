import paymentConfigHandler from '../server/api/payment-config';
import stripeCheckoutHandler from '../server/api/stripe-checkout';
import stripeWebhookHandler from '../server/api/stripe-webhook';
import { dispatchRoute } from './_utils';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req: Parameters<typeof dispatchRoute>[0], res: Parameters<typeof dispatchRoute>[1]) {
  return dispatchRoute(req, res, {
    'payment-config': paymentConfigHandler,
    'stripe-checkout': stripeCheckoutHandler,
    'stripe-webhook': stripeWebhookHandler,
  });
}
