import authLogoutHandler from '../server/api/auth-logout';
import authMeHandler from '../server/api/auth-me';
import authRequestOtpHandler from '../server/api/auth-request-otp';
import authVerifyOtpHandler from '../server/api/auth-verify-otp';
import { dispatchRoute } from './_utils';

export default function handler(req: Parameters<typeof dispatchRoute>[0], res: Parameters<typeof dispatchRoute>[1]) {
  return dispatchRoute(req, res, {
    'request-otp': authRequestOtpHandler,
    'verify-otp': authVerifyOtpHandler,
    me: authMeHandler,
    logout: authLogoutHandler,
  });
}
