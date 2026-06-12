import type { ApiRequest, ApiResponse } from './_order-utils';

type AddressAutocompleteBody = {
  input?: string;
  sessionToken?: string;
  language?: string;
};

type GoogleAutocompleteSuggestion = {
  placePrediction?: {
    placeId?: string;
    text?: { text?: string };
    structuredFormat?: {
      mainText?: { text?: string };
      secondaryText?: { text?: string };
    };
  };
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const input = parseBody(req.body);
    const searchText = String(input.input || '').trim();
    const sessionToken = String(input.sessionToken || '').trim();

    if (searchText.length < 2) {
      return res.status(200).json({ success: true, suggestions: [] });
    }
    if (!sessionToken) {
      return res.status(400).json({ success: false, code: 'SESSION_TOKEN_REQUIRED', error: 'Session token is required' });
    }

    const apiKey = getGoogleMapsApiKey();
    const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
      },
      body: JSON.stringify({
        input: searchText,
        sessionToken,
        languageCode: normalizeLanguageCode(input.language),
        regionCode: 'my',
        includedRegionCodes: ['my'],
        locationBias: {
          circle: {
            center: { latitude: 3.139, longitude: 101.6869 },
            radius: 30000,
          },
        },
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        code: 'ADDRESS_SEARCH_FAILED',
        error: payload?.error?.message || 'Address search failed',
      });
    }

    const suggestions = (Array.isArray(payload.suggestions) ? payload.suggestions : [])
      .map((item: GoogleAutocompleteSuggestion) => {
        const prediction = item.placePrediction;
        if (!prediction?.placeId) return null;
        const mainText = prediction.structuredFormat?.mainText?.text || prediction.text?.text || '';
        const secondaryText = prediction.structuredFormat?.secondaryText?.text || '';
        return {
          placeId: prediction.placeId,
          mainText,
          secondaryText,
          fullText: prediction.text?.text || [mainText, secondaryText].filter(Boolean).join(', '),
        };
      })
      .filter(Boolean);

    return res.status(200).json({ success: true, suggestions });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return res.status(400).json({ success: false, code: 'INVALID_JSON', error: 'Invalid JSON body' });
    }
    console.error('Address autocomplete API error:', error);
    return res.status(500).json({
      success: false,
      code: 'ADDRESS_SEARCH_FAILED',
      error: error instanceof Error ? error.message : 'Address search failed',
    });
  }
}

function parseBody(body: unknown): AddressAutocompleteBody {
  if (!body) return {};
  if (Buffer.isBuffer(body)) return JSON.parse(body.toString('utf8')) as AddressAutocompleteBody;
  if (typeof body === 'string') return JSON.parse(body) as AddressAutocompleteBody;
  return body as AddressAutocompleteBody;
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
