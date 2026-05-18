import menuHandler from '../server/api/menu.ts';
import { dispatchRoute } from './_utils.ts';

export default function handler(req: Parameters<typeof dispatchRoute>[0], res: Parameters<typeof dispatchRoute>[1]) {
  return dispatchRoute(req, res, {
    menu: menuHandler,
  });
}
