import type { ApiRequest, ApiResponse } from './_order-utils';

type PlaceDetailsBody = {
  placeId?: string;
  sessionToken?: string;
  language?: string;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const input = parseBody(req.body);
    const placeId = String(input.placeId || '').trim();
    const sessionToken = String(input.sessionToken || '').trim();

    if (!placeId) return res.status(400).json({ success: false, code: 'PLACE_ID_REQUIRED', error: 'Place ID is required' });
    if (!sessionToken) return res.status(400).json({ success: false, code: 'SESSION_TOKEN_REQUIRED', error: 'Session token is required' });

    const apiKey = getGoogleMapsApiKey();
    const params = new URLSearchParams({
      sessionToken,
      languageCode: normalizeLanguageCode(input.language),
      regionCode: 'my',
    });
    const safePlaceId = placeId.replace(/^places\//, '');
    const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(safePlaceId)}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,location',
      },
    });
    const payload = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        code: 'PLACE_DETAILS_FAILED',
        error: payload?.error?.message || 'Place details failed',
      });
    }

    const latitude = Number(payload.location?.latitude);
    const longitude = Number(payload.location?.longitude);
    const address = String(payload.formattedAddress || '').trim();
    if (!address || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({
        success: false,
        code: 'PLACE_DETAILS_FAILED',
        error: 'Selected address is incomplete',
      });
    }

    return res.status(200).json({
      success: true,
      placeId: payload.id || safePlaceId,
      address,
      latitude,
      longitude,
      displayName: payload.displayName?.text || '',
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return res.status(400).json({ success: false, code: 'INVALID_JSON', error: 'Invalid JSON body' });
    }
    console.error('Address place details API error:', error);
    return res.status(500).json({
      success: false,
      code: 'PLACE_DETAILS_FAILED',
      error: error instanceof Error ? error.message : 'Place details failed',
    });
  }
}

function parseBody(body: unknown): PlaceDetailsBody {
  if (!body) return {};
  if (Buffer.isBuffer(body)) return JSON.parse(body.toString('utf8')) as PlaceDetailsBody;
  if (typeof body === 'string') return JSON.parse(body) as PlaceDetailsBody;
  return body as PlaceDetailsBody;
}

function getGoogleMapsApiKey() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error('Google Maps API is not configured');
  return apiKey;
}

function normalizeLanguageCode(language?: string) {
  const code = String(language || 'en').split('-')[0].toLowerCase();
  return ['zh', 'en', 'th', 'vi'].includes(code) ? code : 'en';
}
