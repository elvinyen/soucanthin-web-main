import type { ApiRequest, ApiResponse } from './_order-utils';
import { getSupabaseConfig, supabaseRequest } from './_order-utils';
import { getAuthenticatedUser, getUserAddresses, parseJsonBody } from './_auth-utils';

type AddressBody = {
  id?: string;
  label?: string;
  recipientName?: string;
  phone?: string;
  address?: string;
  isDefault?: boolean;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const method = req.method || 'GET';
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(method)) {
    res.setHeader?.('Allow', 'GET, POST, PATCH, DELETE');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) return res.status(401).json({ success: false, error: '请先登录' });

  try {
    if (method === 'GET') {
      return res.status(200).json({ success: true, addresses: await getUserAddresses(user.id) });
    }

    const body = parseJsonBody<AddressBody>(req.body);
    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();

    if (method === 'DELETE') {
      if (!body.id) throw new Error('缺少地址编号');
      await supabaseRequest(
        supabaseUrl,
        serviceRoleKey,
        `/user_addresses?id=eq.${encodeURIComponent(body.id)}&user_id=eq.${encodeURIComponent(user.id)}`,
        { method: 'DELETE' },
      );
      return res.status(200).json({ success: true, addresses: await getUserAddresses(user.id) });
    }

    const payload = buildAddressPayload(body);
    if (payload.is_default) {
      await supabaseRequest(
        supabaseUrl,
        serviceRoleKey,
        `/user_addresses?user_id=eq.${encodeURIComponent(user.id)}`,
        { method: 'PATCH', body: JSON.stringify({ is_default: false }) },
      );
    }

    if (method === 'POST') {
      await supabaseRequest(supabaseUrl, serviceRoleKey, '/user_addresses', {
        method: 'POST',
        body: JSON.stringify({ ...payload, user_id: user.id }),
      });
    } else {
      if (!body.id) throw new Error('缺少地址编号');
      await supabaseRequest(
        supabaseUrl,
        serviceRoleKey,
        `/user_addresses?id=eq.${encodeURIComponent(body.id)}&user_id=eq.${encodeURIComponent(user.id)}`,
        { method: 'PATCH', body: JSON.stringify(payload) },
      );
    }

    return res.status(200).json({ success: true, addresses: await getUserAddresses(user.id) });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : '无法保存地址',
    });
  }
}

function buildAddressPayload(body: AddressBody) {
  const label = String(body.label || '默认地址').trim();
  const recipientName = String(body.recipientName || '').trim();
  const phone = String(body.phone || '').trim();
  const address = String(body.address || '').trim();

  if (!recipientName) throw new Error('请填写收件人');
  if (!phone) throw new Error('请填写联系电话');
  if (!/^[0-9+\-\s()]{8,20}$/.test(phone)) throw new Error('联系电话格式不正确');
  if (!address) throw new Error('请填写详细地址');

  return {
    label: label || '默认地址',
    recipient_name: recipientName,
    phone,
    address,
    is_default: Boolean(body.isDefault),
  };
}
