import orderHandler from '../server/api/order';
import { dispatchRoute } from './_utils';

export default function handler(req: Parameters<typeof dispatchRoute>[0], res: Parameters<typeof dispatchRoute>[1]) {
  return dispatchRoute(req, res, {
    order: orderHandler,
  });
}
