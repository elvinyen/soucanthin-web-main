import type { ApiRequest, ApiResponse } from './_order-utils';
import { getAuthenticatedUser } from './_auth-utils';
import { createDeliveryQuote } from './_delivery-policy';
import { DeliveryQuoteError } from './_delivery-utils';

type DeliveryQuoteBody = {
  address?: string;
  branchId?: string;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const input = parseBody(req.body);
    const address = String(input.address || '').trim();
    const branchId = String(input.branchId || '').trim();
    const user = await getAuthenticatedUser(req);
    const result = await createDeliveryQuote({ req, address, preferredBranchId: branchId || undefined, user });
    if (result.deliverability === 'manual_confirmation_required') {
      return res.status(200).json({
        success: true,
        deliverability: result.deliverability,
        deliverable: false,
        maxDistanceKm: result.maxDistanceKm,
        branchId: result.route.branchId,
        branchName: result.route.branchName,
        distanceKm: result.route.distanceKm,
        durationMin: result.route.durationMin,
      });
    }
    return res.status(200).json({
      success: true,
      deliverability: result.deliverability,
      deliverable: true,
      quoteToken: result.token,
      quoteExpiresAt: result.expiresAt,
      quoteSource: result.source,
      branchId: result.route.branchId,
      branchName: result.route.branchName,
      deliveryFee: result.route.deliveryFee,
      distanceKm: result.route.distanceKm,
      durationMin: result.route.durationMin,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return res.status(400).json({
        success: false,
        deliverable: false,
        code: 'GEOCODE_FAILED',
        error: 'Invalid JSON body',
      });
    }

    if (error instanceof DeliveryQuoteError) {
      return res.status(error.statusCode).json({
        success: false,
        deliverable: false,
        code: error.code,
        error: error.message,
      });
    }

    console.error('Delivery quote API error:', error);
    return res.status(500).json({
      success: false,
      deliverable: false,
      code: 'ROUTE_FAILED',
      error: error instanceof Error ? error.message : 'Delivery quote failed',
    });
  }
}

function parseBody(body: unknown): DeliveryQuoteBody {
  if (!body) return {};
  if (Buffer.isBuffer(body)) return JSON.parse(body.toString('utf8')) as DeliveryQuoteBody;
  if (typeof body === 'string') return JSON.parse(body) as DeliveryQuoteBody;
  return body as DeliveryQuoteBody;
}
