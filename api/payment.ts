import paymentConfigHandler from '../server/api/payment-config.ts';
import stripeCheckoutHandler from '../server/api/stripe-checkout.ts';
import stripeWebhookHandler from '../server/api/stripe-webhook.ts';
import { dispatchRoute } from './_utils.ts';

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
