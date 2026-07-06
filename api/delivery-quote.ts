import type { ApiRequest, ApiResponse } from './_order-utils';
import { DeliveryQuoteError, getDeliveryQuoteForAddress } from './_delivery-utils';

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
    const quote = await getDeliveryQuoteForAddress(address, branchId || undefined);
    return res.status(200).json({
      success: true,
      deliverable: true,
      branchId: quote.branchId,
      branchName: quote.branchName,
      deliveryFee: quote.deliveryFee,
      distanceKm: quote.distanceKm,
      durationMin: quote.durationMin,
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
