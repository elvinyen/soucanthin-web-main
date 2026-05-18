import authLogoutHandler from '../server/api/auth-logout.ts';
import authMeHandler from '../server/api/auth-me.ts';
import authRequestOtpHandler from '../server/api/auth-request-otp.ts';
import authVerifyOtpHandler from '../server/api/auth-verify-otp.ts';
import { dispatchRoute } from './_utils.ts';

export default function handler(req: Parameters<typeof dispatchRoute>[0], res: Parameters<typeof dispatchRoute>[1]) {
  return dispatchRoute(req, res, {
    'request-otp': authRequestOtpHandler,
    'verify-otp': authVerifyOtpHandler,
    me: authMeHandler,
    logout: authLogoutHandler,
  });
}
