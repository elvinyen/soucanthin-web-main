import type { Order } from '../types/order';
import { getSupabaseConfig, roundMoney, supabaseRequest } from './_order-utils';

export type DeliveryQuoteCode = 'GEOCODE_FAILED' | 'OUT_OF_RANGE' | 'ROUTE_FAILED';

export type DeliveryQuote = {
  branchId: string;
  branchName: string;
  addressLatitude: number;
  addressLongitude: number;
  distanceKm: number;
  durationMin: number;
  deliveryFee: number;
  provider: string;
};

type StoreBranchRecord = {
  id: string;
  name: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  active: boolean;
};

type LatLng = {
  latitude: number;
  longitude: number;
};

type RouteMatrixElement = {
  originIndex?: number;
  destinationIndex?: number;
  distanceMeters?: number;
  duration?: string;
  status?: { code?: number; message?: string };
  condition?: string;
};

export class DeliveryQuoteError extends Error {
  code: DeliveryQuoteCode;
  statusCode: number;

  constructor(code: DeliveryQuoteCode, message: string, statusCode = 400) {
    super(message);
    this.name = 'DeliveryQuoteError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export async function applyDeliveryQuoteToOrder(order: Order) {
  if (order.orderType !== 'takeaway') {
    order.deliveryFee = 0;
    order.deliveryQuote = undefined;
    return undefined;
  }

  const address = order.takeaway?.address?.trim();
  if (!address) {
    throw new DeliveryQuoteError('GEOCODE_FAILED', '请填写外卖地址');
  }

  const quote = await getDeliveryQuoteForAddress(address);
  order.deliveryFee = quote.deliveryFee;
  order.deliveryQuote = quote;
  return quote;
}

export async function getDeliveryQuoteForAddress(address: string): Promise<DeliveryQuote> {
  const normalizedAddress = address.trim();
  if (!normalizedAddress) {
    throw new DeliveryQuoteError('GEOCODE_FAILED', '请填写外卖地址');
  }

  const apiKey = getGoogleMapsApiKey();
  const destination = await geocodeAddress(normalizedAddress, apiKey);
  const branches = await getActiveBranches(apiKey);
  if (branches.length === 0) {
    throw new DeliveryQuoteError('ROUTE_FAILED', '暂时无法读取门店配送资料', 500);
  }

  const routes = await getBestRoute(branches, destination, apiKey);
  const bestRoute = routes
    .filter(route => route.distanceMeters > 0 && route.durationSeconds > 0)
    .sort((a, b) => a.durationSeconds - b.durationSeconds || a.distanceMeters - b.distanceMeters)[0];

  if (!bestRoute) {
    throw new DeliveryQuoteError('ROUTE_FAILED', '暂时无法计算配送路线');
  }

  const branch = branches[bestRoute.branchIndex];
  const distanceKm = roundMoney(bestRoute.distanceMeters / 1000);
  const durationMin = Math.max(1, Math.ceil(bestRoute.durationSeconds / 60));
  const maxDistanceKm = getMaxDeliveryDistanceKm();

  if (distanceKm > maxDistanceKm) {
    throw new DeliveryQuoteError('OUT_OF_RANGE', `该地址超过 ${maxDistanceKm}km 配送范围`);
  }

  return {
    branchId: branch.id,
    branchName: branch.name,
    addressLatitude: destination.latitude,
    addressLongitude: destination.longitude,
    distanceKm,
    durationMin,
    deliveryFee: calculateDeliveryFee(distanceKm),
    provider: bestRoute.provider,
  };
}

export function calculateDeliveryFee(distanceKm: number) {
  if (distanceKm <= 3) return 5;
  if (distanceKm <= 5) return 8;
  if (distanceKm <= 8) return 12;
  if (distanceKm <= 10) return 15;
  if (distanceKm <= getMaxDeliveryDistanceKm()) return 18;
  throw new DeliveryQuoteError('OUT_OF_RANGE', `该地址超过 ${getMaxDeliveryDistanceKm()}km 配送范围`);
}

function getGoogleMapsApiKey() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new DeliveryQuoteError('ROUTE_FAILED', 'Google Maps API is not configured', 500);
  }
  return apiKey;
}

function getMaxDeliveryDistanceKm() {
  const value = Number(process.env.DELIVERY_MAX_DISTANCE_KM || 12);
  return Number.isFinite(value) && value > 0 ? value : 12;
}

async function getActiveBranches(apiKey: string) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  const rows = await supabaseRequest(
    supabaseUrl,
    serviceRoleKey,
    '/store_branches?active=eq.true&select=id,name,address,latitude,longitude,active&order=sort_order.asc,id.asc',
    { method: 'GET' },
  );

  const branches = Array.isArray(rows) ? rows as StoreBranchRecord[] : [];
  const resolvedBranches = await Promise.all(branches.map(branch => ensureBranchCoordinates(branch, apiKey)));
  return resolvedBranches.filter(branch => Number.isFinite(branch.latitude) && Number.isFinite(branch.longitude));
}

async function ensureBranchCoordinates(branch: StoreBranchRecord, apiKey: string) {
  if (Number.isFinite(Number(branch.latitude)) && Number.isFinite(Number(branch.longitude))) {
    return {
      ...branch,
      latitude: Number(branch.latitude),
      longitude: Number(branch.longitude),
    };
  }

  const coordinates = await geocodeAddress(branch.address, apiKey);
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
  await supabaseRequest(supabaseUrl, serviceRoleKey, `/store_branches?id=eq.${encodeURIComponent(branch.id)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      updated_at: new Date().toISOString(),
    }),
  });

  return {
    ...branch,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
  };
}

async function geocodeAddress(address: string, apiKey: string): Promise<LatLng> {
  const params = new URLSearchParams({
    address,
    region: 'my',
    components: 'country:MY',
    key: apiKey,
  });
  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`);
  const payload = await response.json();

  if (!response.ok || payload.status !== 'OK') {
    throw new DeliveryQuoteError('GEOCODE_FAILED', payload.error_message || '无法解析该配送地址');
  }

  const location = payload.results?.[0]?.geometry?.location;
  const latitude = Number(location?.lat);
  const longitude = Number(location?.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new DeliveryQuoteError('GEOCODE_FAILED', '无法解析该配送地址');
  }

  return { latitude, longitude };
}

async function getBestRoute(branches: StoreBranchRecord[], destination: LatLng, apiKey: string) {
  try {
    return await computeRouteMatrix(branches, destination, apiKey, 'TWO_WHEELER');
  } catch (error) {
    console.error('Two-wheeler route matrix failed:', error);
    return computeRouteMatrix(branches, destination, apiKey, 'DRIVE');
  }
}

async function computeRouteMatrix(
  branches: StoreBranchRecord[],
  destination: LatLng,
  apiKey: string,
  travelMode: 'TWO_WHEELER' | 'DRIVE',
) {
  const body = {
    origins: branches.map(branch => ({
      waypoint: {
        location: {
          latLng: {
            latitude: Number(branch.latitude),
            longitude: Number(branch.longitude),
          },
        },
      },
    })),
    destinations: [{
      waypoint: {
        location: {
          latLng: destination,
        },
      },
    }],
    travelMode,
    routingPreference: 'TRAFFIC_AWARE',
  };

  const response = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,status,condition',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json() as RouteMatrixElement[];
  if (!response.ok || !Array.isArray(payload)) {
    throw new DeliveryQuoteError('ROUTE_FAILED', '暂时无法计算配送路线');
  }

  const routes = payload
    .map(element => ({
      branchIndex: Number(element.originIndex ?? 0),
      destinationIndex: Number(element.destinationIndex ?? 0),
      distanceMeters: Number(element.distanceMeters || 0),
      durationSeconds: parseDurationSeconds(element.duration),
      statusCode: element.status?.code,
      condition: element.condition,
      provider: `google-routes-${travelMode.toLowerCase()}`,
    }))
    .filter(route => (
      route.destinationIndex === 0
      && route.condition !== 'ROUTE_NOT_FOUND'
      && !route.statusCode
      && Number.isInteger(route.branchIndex)
      && branches[route.branchIndex]
      && route.distanceMeters > 0
      && route.durationSeconds > 0
    ));

  if (routes.length === 0) {
    console.error('Google route matrix returned no usable routes:', payload);
    throw new DeliveryQuoteError('ROUTE_FAILED', '暂时无法计算配送路线');
  }

  return routes;
}

function parseDurationSeconds(value?: string) {
  const match = String(value || '').match(/^(\d+(?:\.\d+)?)s$/);
  return match ? Number(match[1]) : 0;
}
