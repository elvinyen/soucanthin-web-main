import { AdminError, jsonError, parseAdminBody, requireAdminRole } from './_admin-utils';
import type { ApiRequest, ApiResponse } from './_order-utils';
import { getSupabaseConfig, supabaseAuthHeaders } from './_order-utils';

type UploadBody = {
  itemCode?: string;
  dataBase64?: string;
  contentType?: string;
  extension?: string;
};

const MAX_IMAGE_BYTES = 500 * 1024;
const ALLOWED_IMAGE_TYPES = new Map([
  ['image/webp', 'webp'],
  ['image/jpeg', 'jpg'],
]);

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    await requireAdminRole(req, ['admin', 'customer_service']);

    if (req.method && req.method !== 'POST') {
      res.setHeader?.('Allow', 'POST');
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const input = parseAdminBody<UploadBody>(req.body);
    const itemCode = normalizeItemCode(input.itemCode || '');
    const contentType = normalizeContentType(input.contentType || '');
    const extension = normalizeExtension(input.extension || '', contentType);
    const dataBase64 = String(input.dataBase64 || '').trim();
    if (!dataBase64) throw new AdminError('图片数据为空');

    const bytes = Buffer.from(dataBase64, 'base64');
    if (bytes.length === 0) throw new AdminError('图片数据为空');
    if (bytes.length > MAX_IMAGE_BYTES) throw new AdminError('菜单图片不能超过 500KB');

    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
    const objectPath = `${itemCode}.${extension}`;
    const response = await fetch(`${supabaseUrl}/storage/v1/object/menu-items/${objectPath}`, {
      method: 'POST',
      headers: {
        ...supabaseAuthHeaders(serviceRoleKey),
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      body: bytes,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new AdminError(errorText || `图片上传失败：${response.status}`, response.status);
    }

    return res.status(200).json({
      success: true,
      imageUrl: `${supabaseUrl}/storage/v1/object/public/menu-items/${objectPath}`,
      path: objectPath,
      size: bytes.length,
      contentType,
    });
  } catch (error) {
    const { statusCode, body } = jsonError(error);
    return res.status(statusCode).json(body);
  }
}

function normalizeContentType(value: string) {
  const contentType = value.trim().toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new AdminError('菜单图片只支持 WebP 或 JPG');
  }
  return contentType;
}

function normalizeExtension(value: string, contentType: string) {
  const expected = ALLOWED_IMAGE_TYPES.get(contentType);
  const extension = value.trim().toLowerCase().replace(/^\./, '');
  if (extension !== expected) {
    throw new AdminError(`图片扩展名必须是 ${expected}`);
  }
  return extension;
}

function normalizeItemCode(value: string) {
  const itemCode = value.trim();
  if (!/^[a-zA-Z0-9._-]{1,60}$/.test(itemCode)) {
    throw new AdminError('请先填写有效编码，编码只能包含字母、数字、点、下划线或横线');
  }
  return itemCode;
}
