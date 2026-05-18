import userAddressesHandler from '../server/api/user-addresses';
import userProfileHandler from '../server/api/user-profile';
import { dispatchRoute } from './_utils';

export default function handler(req: Parameters<typeof dispatchRoute>[0], res: Parameters<typeof dispatchRoute>[1]) {
  return dispatchRoute(req, res, {
    profile: userProfileHandler,
    addresses: userAddressesHandler,
  });
}
