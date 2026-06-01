import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  ClipboardList,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Fingerprint,
  KeyRound,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Soup,
  Trash2,
  Upload,
  Users,
  WalletCards,
  X,
} from 'lucide-react';

type AdminSection = 'menu' | 'orders' | 'wallet' | 'users';
type OrderStatus = 'pending_confirm' | 'preparing' | 'delivering' | 'delivered' | 'completed' | 'cancelled';

type AdminMe = {
  success: true;
  authenticated: boolean;
  setupRequired: boolean;
  admin?: {
    username: string;
    displayName: string;
    role: string;
  } | null;
};

type MenuItemRow = {
  id: number;
  item_code?: string | null;
  name: string;
  description: string;
  detail: string;
  price: number;
  category_id?: number | null;
  category: string;
  image_url: string;
  tags?: string[] | null;
  recommended?: boolean;
  sold_out?: boolean;
  active?: boolean;
  sort_order?: number;
  option_groups?: MenuOptionGroup[] | null;
  translations?: Partial<Record<TranslationLang, MenuTranslationApi>>;
};

type TranslationLang = 'en' | 'th' | 'vi';

type MenuOptionGroup = {
  id: string;
  name: string;
  type: 'single' | 'multiple';
  required?: boolean;
  options: MenuOption[];
};

type MenuOption = {
  id: string;
  name: string;
  priceDelta: number;
};

type MenuTranslationForm = {
  name: string;
  description: string;
  detail: string;
  category_label: string;
  tags: string[];
  option_groups: MenuOptionGroupTranslation[];
};

type MenuTranslationApi = Omit<MenuTranslationForm, 'tags' | 'option_groups'> & {
  tags?: string[] | string | null;
  option_groups?: MenuOptionGroupTranslation[] | null;
};

type MenuOptionGroupTranslation = {
  id: string;
  name: string;
  options: MenuOptionTranslation[];
};

type MenuOptionTranslation = {
  id: string;
  name: string;
};

type OrderRow = {
  id: string;
  order_no: string;
  order_type: 'dinein' | 'takeaway';
  payment_method: string;
  customer_name: string;
  customer_phone: string;
  table_no?: string | null;
  delivery_address?: string | null;
  note?: string | null;
  total: number;
  payable_total?: number | null;
  status: OrderStatus;
  payment_status: string;
  payment_review_status: string;
  receipt_url?: string | null;
  created_at: string;
};

type OrderItemRow = {
  id?: string;
  item_code?: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  item_note?: string | null;
};

type MenuCategoryRow = {
  id: number;
  label: string;
  sort_order: number;
  active: boolean;
  item_count: number;
};

type MenuFormState = {
  item_code: string;
  name: string;
  description: string;
  detail: string;
  price: string;
  category_id: string;
  image_url: string;
  tags: string[];
  recommended: boolean;
  sold_out: boolean;
  active: boolean;
  option_groups: MenuOptionGroup[];
  translations: Record<TranslationLang, MenuTranslationForm>;
};

const emptyMenuForm: MenuFormState = {
  item_code: '',
  name: '',
  description: '',
  detail: '',
  price: '',
  category_id: '',
  image_url: '',
  tags: [],
  recommended: false,
  sold_out: false,
  active: true,
  option_groups: [],
  translations: createEmptyTranslations(),
};

const translationLanguages: { lang: TranslationLang; label: string; shortLabel: string }[] = [
  { lang: 'en', label: '英文', shortLabel: 'EN' },
  { lang: 'th', label: '泰文', shortLabel: 'TH' },
  { lang: 'vi', label: '越南语', shortLabel: 'VI' },
];

type CategoryFormState = {
  id: string;
  label: string;
  sort_order: string;
  active: boolean;
};

const emptyCategoryForm: CategoryFormState = {
  id: '',
  label: '',
  sort_order: '0',
  active: true,
};

const orderStatusOptions: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部订单' },
  { value: 'pending_confirm', label: '待确认' },
  { value: 'preparing', label: '制作中' },
  { value: 'delivering', label: '配送中' },
  { value: 'delivered', label: '已送达' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
];

const sections = [
  { id: 'menu' as const, label: '菜单管理', icon: Soup },
  { id: 'orders' as const, label: '订单管理', icon: ClipboardList },
  { id: 'wallet' as const, label: '充值审核', icon: WalletCards },
  { id: 'users' as const, label: '会员管理', icon: Users },
];

type PendingMenuImage = {
  blob: Blob;
  previewUrl: string;
  contentType: 'image/webp' | 'image/jpeg';
  extension: 'webp' | 'jpg';
  size: number;
};

type DuplicateCheckState = {
  item_code: 'idle' | 'checking' | 'available' | 'duplicate';
  name: 'idle' | 'checking' | 'available' | 'duplicate';
};

const emptyDuplicateCheck: DuplicateCheckState = {
  item_code: 'idle',
  name: 'idle',
};
const DUPLICATE_CHECK_MIN_LENGTH = 2;
const DUPLICATE_CHECK_DELAY_MS = 800;

const AdminDashboard: React.FC = () => {
  const [auth, setAuth] = useState<AdminMe | null>(null);
  const [section, setSection] = useState<AdminSection>('menu');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [setupToken, setSetupToken] = useState('');

  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([]);
  const [menuMode, setMenuMode] = useState<'items' | 'categories'>('items');
  const [menuSearch, setMenuSearch] = useState('');
  const [editingItem, setEditingItem] = useState<MenuItemRow | null>(null);
  const [form, setForm] = useState<MenuFormState>(emptyMenuForm);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pendingImage, setPendingImage] = useState<PendingMenuImage | null>(null);
  const [editorError, setEditorError] = useState('');
  const [duplicateCheck, setDuplicateCheck] = useState<DuplicateCheckState>(emptyDuplicateCheck);
  const duplicateCheckCache = useRef(new Map<string, DuplicateCheckState[keyof DuplicateCheckState]>());
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [menuCategories, setMenuCategories] = useState<MenuCategoryRow[]>([]);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(emptyCategoryForm);
  const [editingCategory, setEditingCategory] = useState<MenuCategoryRow | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [orderStatus, setOrderStatus] = useState<OrderStatus | 'all'>('all');
  const [selectedOrder, setSelectedOrder] = useState<{ order: OrderRow; items: OrderItemRow[] } | null>(null);

  const authenticated = Boolean(auth?.authenticated);
  const setupRequired = Boolean(auth?.setupRequired);

  useEffect(() => {
    void refreshAuth();
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    if (section === 'menu') {
      void loadMenuItems();
      void loadCategories();
    }
    if (section === 'orders') void loadOrders();
  }, [authenticated, section, orderStatus]);

  useEffect(() => {
    if (!isEditorOpen) return;
    const excludeId = editingItem?.id;
    const checks: Array<{ field: keyof DuplicateCheckState; value: string; original?: string | null }> = [
      { field: 'item_code', value: form.item_code.trim(), original: editingItem?.item_code || '' },
      { field: 'name', value: form.name.trim(), original: editingItem?.name || '' },
    ];
    const activeChecks = checks.filter(check => (
      check.value.length >= DUPLICATE_CHECK_MIN_LENGTH
      && check.value !== String(check.original || '').trim()
    ));

    setDuplicateCheck(prev => {
      const next = { ...prev };
      checks.forEach(check => {
        const cacheKey = duplicateCheckCacheKey(check.field, check.value, excludeId);
        const cached = duplicateCheckCache.current.get(cacheKey);
        if (!check.value || check.value.length < DUPLICATE_CHECK_MIN_LENGTH || check.value === String(check.original || '').trim()) {
          next[check.field] = 'idle';
        } else if (cached) {
          next[check.field] = cached;
        }
      });
      activeChecks.forEach(check => {
        const cacheKey = duplicateCheckCacheKey(check.field, check.value, excludeId);
        if (!duplicateCheckCache.current.has(cacheKey)) next[check.field] = 'checking';
      });
      return next;
    });

    const uncachedChecks = activeChecks.filter(check => !duplicateCheckCache.current.has(duplicateCheckCacheKey(check.field, check.value, excludeId)));
    if (!uncachedChecks.length) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      uncachedChecks.forEach(check => {
        const params = new URLSearchParams({
          checkField: check.field,
          value: check.value,
        });
        if (excludeId) params.set('excludeId', String(excludeId));
        fetch(`/api/admin/menu-items?${params.toString()}`, {
          credentials: 'same-origin',
          signal: controller.signal,
        })
          .then(response => response.json())
          .then(payload => {
            if (payload?.success === false) throw new Error(payload.error || '查重失败');
            const status = payload.exists ? 'duplicate' : 'available';
            duplicateCheckCache.current.set(duplicateCheckCacheKey(check.field, check.value, excludeId), status);
            setDuplicateCheck(prev => ({
              ...prev,
              [check.field]: status,
            }));
          })
          .catch(error => {
            if (error instanceof DOMException && error.name === 'AbortError') return;
            setDuplicateCheck(prev => ({ ...prev, [check.field]: 'idle' }));
          });
      });
    }, DUPLICATE_CHECK_DELAY_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [isEditorOpen, editingItem?.id, editingItem?.item_code, editingItem?.name, form.item_code, form.name]);

  const api = async <T,>(path: string, init: RequestInit = {}) => {
    const response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      throw new Error(payload.error || `请求失败：${response.status}`);
    }
    return payload as T;
  };

  const refreshAuth = async () => {
    try {
      const payload = await api<AdminMe>('/api/admin/auth');
      setAuth(payload);
    } catch {
      setAuth({ success: true, authenticated: false, setupRequired: false });
    }
  };

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2400);
  };

  const clearPendingImage = () => {
    setPendingImage(prev => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  };

  const closeMenuEditor = () => {
    clearPendingImage();
    setEditorError('');
    setDuplicateCheck(emptyDuplicateCheck);
    setIsEditorOpen(false);
    setEditingItem(null);
    setForm(emptyMenuForm);
  };

  const submitAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const payload = await api<AdminMe & { admin: NonNullable<AdminMe['admin']> }>('/api/admin/auth', {
        method: setupRequired ? 'PUT' : 'POST',
        body: JSON.stringify(setupRequired
          ? { username, password, displayName, setupToken }
          : { username, password }),
      });
      setAuth({ success: true, authenticated: true, setupRequired: false, admin: payload.admin });
      setPassword('');
      setSetupToken('');
      showNotice(setupRequired ? '管理员账号已创建' : '登录成功');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api('/api/admin/auth', { method: 'DELETE' });
    } finally {
      setAuth({ success: true, authenticated: false, setupRequired: false });
      setSelectedOrder(null);
      setMenuItems([]);
      setOrders([]);
    }
  };

  const loadMenuItems = async () => {
    setIsLoading(true);
    setError('');
    try {
      const query = menuSearch.trim() ? `?search=${encodeURIComponent(menuSearch.trim())}` : '';
      const payload = await api<{ success: true; items: MenuItemRow[] }>(`/api/admin/menu-items${query}`);
      setMenuItems(payload.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : '菜单加载失败');
      if ((err as Error).message.includes('登录')) setAuth({ success: true, authenticated: false, setupRequired: false });
    } finally {
      setIsLoading(false);
    }
  };

  const loadCategories = async () => {
    setError('');
    try {
      const payload = await api<{ success: true; categories: MenuCategoryRow[] }>('/api/admin/menu-categories');
      setMenuCategories(payload.categories);
    } catch (err) {
      setError(err instanceof Error ? err.message : '分类加载失败');
    }
  };

  const loadOrders = async () => {
    setIsLoading(true);
    setError('');
    try {
      const payload = await api<{ success: true; orders: OrderRow[] }>(`/api/admin/orders?status=${orderStatus}`);
      setOrders(payload.orders);
    } catch (err) {
      setError(err instanceof Error ? err.message : '订单加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  const loadOrderDetail = async (id: string) => {
    setError('');
    try {
      const payload = await api<{ success: true; order: OrderRow; items: OrderItemRow[] }>(`/api/admin/orders?id=${encodeURIComponent(id)}`);
      setSelectedOrder({ order: payload.order, items: payload.items });
    } catch (err) {
      setError(err instanceof Error ? err.message : '订单详情加载失败');
    }
  };

		  const startCreate = () => {
		    clearPendingImage();
		    setEditorError('');
		    setDuplicateCheck(emptyDuplicateCheck);
		    setEditingItem(null);
		    setForm({
		      ...emptyMenuForm,
	      category_id: String(menuCategories.find(category => category.active)?.id || ''),
	      translations: createEmptyTranslations(),
	    });
	    setIsEditorOpen(true);
	  };

	  const startEdit = (item: MenuItemRow) => {
		    clearPendingImage();
		    setEditorError('');
		    setDuplicateCheck(emptyDuplicateCheck);
		    setEditingItem(item);
    setForm({
      item_code: item.item_code || '',
      name: item.name || '',
      description: item.description || '',
      detail: item.detail || '',
	      price: String(item.price ?? ''),
	      category_id: String(item.category_id || ''),
	      image_url: item.image_url || '',
	      tags: Array.isArray(item.tags) ? item.tags : [],
	      recommended: Boolean(item.recommended),
	      sold_out: Boolean(item.sold_out),
	      active: item.active !== false,
	      option_groups: Array.isArray(item.option_groups) ? item.option_groups : [],
	      translations: createTranslationsFromItem(item),
	    });
	    setIsEditorOpen(true);
	  };

	  const saveMenuItem = async (event: React.FormEvent) => {
	    event.preventDefault();
	    setError('');
	    setEditorError('');
	    if (duplicateCheck.item_code === 'duplicate') {
	      setEditorError('菜品编码已存在，请更换编码');
	      return;
	    }
	    if (duplicateCheck.name === 'duplicate') {
	      setEditorError('菜品名称已存在，请更换名称');
	      return;
	    }
	    setUploadingImage(true);

	    try {
	      let imageUrl = form.image_url;
	      if (pendingImage) {
	        const itemCode = form.item_code.trim();
	        if (!itemCode) throw new Error('请先填写菜品编码，图片会按 {item_code}.{webp|jpg} 命名');
	        const imageBase64 = await blobToBase64(pendingImage.blob);
	        const imagePayload = await api<{ success: true; imageUrl: string; size: number; contentType: string }>('/api/admin/menu-image', {
	          method: 'POST',
	          body: JSON.stringify({
	            itemCode,
	            dataBase64: imageBase64,
	            contentType: pendingImage.contentType,
	            extension: pendingImage.extension,
	          }),
	        });
	        imageUrl = imagePayload.imageUrl;
	      }

	      const payload = {
	        id: editingItem?.id,
	        item_code: form.item_code || null,
	        name: form.name,
	        description: form.description,
	        detail: form.detail,
	        price: Number(form.price),
	        category_id: Number(form.category_id),
	        image_url: imageUrl,
	        tags: form.tags,
	        recommended: form.recommended,
	        sold_out: form.sold_out,
	        active: form.active,
	        option_groups: form.option_groups,
	        translations: normalizeTranslationsForPayload(form.translations, form.option_groups),
	      };

	      await api('/api/admin/menu-items', {
	        method: editingItem ? 'PATCH' : 'POST',
	        body: JSON.stringify(payload),
	      });
	      showNotice(pendingImage ? `${editingItem ? '菜品已更新' : '菜品已新增'}，图片已上传：${Math.round(pendingImage.size / 1024)}KB` : editingItem ? '菜品已更新' : '菜品已新增');
	      closeMenuEditor();
	      await loadMenuItems();
	      await loadCategories();
	    } catch (err) {
	      setEditorError(err instanceof Error ? err.message : '保存失败');
	    } finally {
	      setUploadingImage(false);
	    }
	  };

  const startEditCategory = (category: MenuCategoryRow) => {
    setEditingCategory(category);
    setCategoryForm({
      id: String(category.id),
      label: category.label,
      sort_order: String(category.sort_order ?? 0),
      active: category.active,
    });
  };

  const resetCategoryForm = () => {
    setEditingCategory(null);
    setCategoryForm(emptyCategoryForm);
  };

  const saveCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const payload = {
      id: editingCategory?.id,
      label: categoryForm.label,
      sort_order: Number(categoryForm.sort_order || 0),
      active: categoryForm.active,
    };

    try {
      await api('/api/admin/menu-categories', {
        method: editingCategory ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      showNotice(editingCategory ? '分类已更新' : '分类已新增');
      resetCategoryForm();
      await loadCategories();
      await loadMenuItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : '分类保存失败');
    }
  };

  const deleteCategory = async (category: MenuCategoryRow) => {
    if (!window.confirm(`确认删除分类「${category.label}」？`)) return;
    setError('');
    try {
      await api(`/api/admin/menu-categories?id=${category.id}`, { method: 'DELETE' });
      showNotice('分类已删除');
      if (editingCategory?.id === category.id) resetCategoryForm();
      await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : '分类删除失败');
    }
  };

	  const uploadMenuImage = async (file: File) => {
	    setEditorError('');
	    const itemCode = form.item_code.trim();
	    if (!itemCode) {
	      setEditorError('请先填写菜品编码，图片会按 {item_code}.{webp|jpg} 命名');
	      return;
	    }
	    if (!file.type.startsWith('image/')) {
	      setEditorError('请选择图片文件');
	      return;
	    }
	    if (file.size > 5 * 1024 * 1024) {
	      setEditorError('原图不能超过 5MB');
	      return;
	    }

	    setUploadingImage(true);
	    try {
	      const processed = await processMenuImage(file);
	      setPendingImage(prev => {
	        if (prev) URL.revokeObjectURL(prev.previewUrl);
	        return processed;
	      });
	      setForm(prev => ({ ...prev, image_url: processed.previewUrl }));
	      showNotice(`图片已处理：${processed.extension.toUpperCase()} · ${Math.round(processed.size / 1024)}KB，保存后上传`);
	    } catch (err) {
	      setEditorError(err instanceof Error ? err.message : '图片处理失败');
	    } finally {
	      setUploadingImage(false);
	    }
  };

  const deleteMenuItem = async (item: MenuItemRow) => {
    if (!window.confirm(`确认下架「${item.name}」？`)) return;
    setError('');
    try {
      await api(`/api/admin/menu-items?id=${item.id}`, { method: 'DELETE' });
      showNotice('菜品已下架');
      await loadMenuItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : '下架失败');
    }
  };

  const moveMenuItem = async (item: MenuItemRow, action: 'move-up' | 'move-down') => {
    setError('');
    try {
      const payload = await api<{ success: true; moved?: boolean }>('/api/admin/menu-items', {
        method: 'PATCH',
        body: JSON.stringify({ id: item.id, action }),
      });
      showNotice(payload.moved === false ? '已经在当前分类边界' : '排序已更新');
      await loadMenuItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : '排序更新失败');
    }
  };

  const canMoveMenuItem = (item: MenuItemRow, action: 'move-up' | 'move-down') => {
    const categoryId = Number(item.category_id);
    const siblings = menuItems.filter(row => Number(row.category_id) === categoryId);
    const index = siblings.findIndex(row => row.id === item.id);
    if (index < 0) return false;
    return action === 'move-up' ? index > 0 : index < siblings.length - 1;
  };

  const updateOrderStatus = async (id: string, status: OrderStatus) => {
    setError('');
    try {
      await api('/api/admin/orders', {
        method: 'PATCH',
        body: JSON.stringify({ id, status }),
      });
      showNotice('订单状态已更新');
      await loadOrders();
      if (selectedOrder?.order.id === id) await loadOrderDetail(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '订单状态更新失败');
    }
  };

  if (!auth) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-950">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#f3f6fb] text-slate-950">
        <main className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-10 lg:grid-cols-[1fr_420px]">
          <section className="hidden flex-col justify-between self-stretch rounded-[28px] border border-slate-200 bg-white p-10 shadow-[0_24px_80px_rgba(15,23,42,0.08)] lg:flex">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <ShieldCheck size={24} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">SCT Admin</p>
                <h1 className="text-xl font-bold text-slate-950">后台管理系统</h1>
              </div>
            </div>
            <div className="max-w-xl pb-4">
              <p className="text-sm uppercase tracking-[0.24em] text-blue-600">Secure Console</p>
              <h2 className="mt-5 text-5xl font-bold leading-[1.06] tracking-normal text-slate-950">门店后台<br />运营管理台</h2>
              <p className="mt-6 max-w-lg text-sm leading-7 text-slate-500">使用独立管理员账号、服务端 session 与 Supabase service role API 管理菜单和订单。</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Auth</p>
                <p className="mt-1 text-sm font-bold">Session Cookie</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Data</p>
                <p className="mt-1 text-sm font-bold">Supabase</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Scope</p>
                <p className="mt-1 text-sm font-bold">Admin API</p>
              </div>
            </div>
          </section>
          <section className="flex items-center justify-center">
            <form onSubmit={submitAuth} className="w-full max-w-md rounded-[22px] border border-slate-200 bg-white p-7 shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white">
                {setupRequired ? <Fingerprint size={23} /> : <KeyRound size={23} />}
              </div>
              <h1 className="mt-6 text-3xl font-bold tracking-normal text-slate-950">{setupRequired ? '创建首个管理员' : '管理员登录'}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">{setupRequired ? '数据库还没有管理员账号。输入 setup token 后创建老板账号。' : '请输入管理员账号和密码进入控制台。'}</p>
              {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
              <div className="mt-6 grid gap-4">
                <AuthInput label="账号" value={username} onChange={setUsername} placeholder="admin" autoComplete="username" />
                {setupRequired && <AuthInput label="显示名称" value={displayName} onChange={setDisplayName} placeholder="老板 / Manager" />}
                <AuthInput label="密码" value={password} onChange={setPassword} type="password" placeholder="至少 8 位" autoComplete={setupRequired ? 'new-password' : 'current-password'} />
                {setupRequired && <AuthInput label="Setup Token" value={setupToken} onChange={setSetupToken} type="password" placeholder="ADMIN_REVIEW_TOKEN" />}
              </div>
              <button type="submit" disabled={isLoading} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-wait disabled:opacity-70">
                <Check size={17} />
                {setupRequired ? '创建并进入后台' : '登录后台'}
              </button>
            </form>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <aside className={`fixed inset-y-0 left-0 z-30 hidden border-r border-slate-200 bg-white px-4 py-5 shadow-[12px_0_40px_rgba(15,23,42,0.04)] transition-[width] duration-200 lg:block ${sidebarCollapsed ? 'w-24' : 'w-64'}`}>
        <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between gap-3 px-2'}`}>
          <div className={`flex items-center gap-3 ${sidebarCollapsed ? '' : 'min-w-0'}`}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
              <ShieldCheck size={21} />
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">SCT Admin</p>
                <h1 className="truncate text-lg font-bold text-slate-950">深夜食汤</h1>
              </div>
            )}
          </div>
          {!sidebarCollapsed && (
            <IconButton title="折叠侧栏" onClick={() => setSidebarCollapsed(true)}><PanelLeftClose size={16} /></IconButton>
          )}
        </div>
        {sidebarCollapsed && (
          <button type="button" onClick={() => setSidebarCollapsed(false)} className="mt-5 flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-950" title="展开侧栏" aria-label="展开侧栏">
            <PanelLeftOpen size={17} />
          </button>
        )}
        <nav className="mt-8 space-y-1">
          {sections.map(item => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`flex w-full items-center rounded-xl px-3 py-3 text-sm font-bold transition ${sidebarCollapsed ? 'justify-center' : 'gap-3'} ${active ? 'bg-slate-950 text-white shadow-[0_12px_24px_rgba(15,23,42,0.16)]' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950'}`}
              >
                <Icon size={18} />
                {!sidebarCollapsed && item.label}
              </button>
            );
          })}
        </nav>
        <div className="absolute bottom-5 left-4 right-4">
          {!sidebarCollapsed && <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-xs text-slate-500">当前管理员</p>
            <p className="mt-1 truncate text-sm font-bold text-slate-950">{auth.admin?.displayName || auth.admin?.username}</p>
          </div>}
          <button type="button" onClick={logout} title={sidebarCollapsed ? '退出后台' : undefined} className={`flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 ${sidebarCollapsed ? '' : 'gap-2'}`}>
            <LogOut size={17} />
            {!sidebarCollapsed && '退出后台'}
          </button>
        </div>
      </aside>

      <main className={sidebarCollapsed ? 'lg:pl-24' : 'lg:pl-64'}>
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-[#f5f7fb]/90 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Operations</p>
              <h2 className="text-2xl font-bold text-slate-950">{sections.find(item => item.id === section)?.label}</h2>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {sections.map(item => (
                <button key={item.id} type="button" onClick={() => setSection(item.id)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${section === item.id ? 'bg-slate-950 text-white' : 'bg-white text-slate-500'}`}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="px-4 py-6 sm:px-6 lg:px-8">
          {notice && <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">{notice}</div>}
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              <AlertCircle className="mt-0.5 shrink-0" size={16} />
              {error}
            </div>
          )}

          {section === 'menu' && (
            <section className="min-w-0">
              <div className="mb-4 inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                {[
                  { id: 'items' as const, label: '菜品管理' },
                  { id: 'categories' as const, label: '分类管理' },
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMenuMode(item.id)}
                    className={`rounded-xl px-4 py-2 text-sm font-bold transition ${menuMode === item.id ? 'bg-slate-950 text-white shadow-[0_10px_22px_rgba(15,23,42,0.16)]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-950'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {menuMode === 'items' && (
                <Panel className="overflow-hidden">
                  <div className="flex flex-col gap-3 border-b border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative min-w-0 flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                      <input value={menuSearch} onChange={event => setMenuSearch(event.target.value)} onKeyDown={event => event.key === 'Enter' && loadMenuItems()} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-950 outline-none focus:border-blue-500 focus:bg-white" placeholder="搜索菜名、编码、英文名" />
                    </div>
                    <div className="flex gap-2">
                      <IconButton title="刷新" onClick={() => { void loadMenuItems(); void loadCategories(); }}><RefreshCw size={17} /></IconButton>
                      <button type="button" onClick={startCreate} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500">
                        <Plus size={17} />
                        新增
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <div className="max-h-[72vh] min-w-[1080px] overflow-y-auto">
                      <table className="w-full table-fixed border-collapse text-sm">
                        <colgroup>
                          <col className="w-[10%]" />
                          <col className="w-[36%]" />
                          <col className="w-[12%]" />
                          <col className="w-[11%]" />
                          <col className="w-[14%]" />
                          <col className="w-[17%]" />
                        </colgroup>
                        <thead className="sticky top-0 z-[8] bg-slate-50 text-xs uppercase tracking-[0.08em] text-slate-500 shadow-[inset_0_-1px_0_#e2e8f0]">
                          <tr>
                            <th className="px-4 py-3 text-center font-bold">编码</th>
                            <th className="px-5 py-3 text-left font-bold">菜品</th>
                            <th className="px-4 py-3 text-center font-bold">分类</th>
                            <th className="px-4 py-3 text-center font-bold">价格</th>
                            <th className="px-4 py-3 text-center font-bold">状态</th>
                            <th className="px-4 py-3 text-center font-bold">操作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {menuItems.map(item => (
                            <tr key={item.id} className="transition hover:bg-slate-50/80">
                              <td className="px-4 py-3 text-center align-middle">
                                <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700">{item.item_code || '-'}</span>
                              </td>
                              <td className="px-5 py-3 align-middle">
                                <div className="flex min-w-0 items-center gap-3">
                                  <img src={item.image_url} alt={item.name} className="h-16 w-16 shrink-0 rounded-2xl bg-slate-100 object-contain shadow-[0_8px_20px_rgba(15,23,42,0.10)]" />
                                  <div className="min-w-0 text-left">
                                    <p className="truncate text-sm font-bold text-slate-950">{item.name}</p>
                                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.description}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center align-middle">
                                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{item.category}</span>
                              </td>
                              <td className="px-4 py-3 text-center align-middle text-sm font-bold text-slate-950">RM {Number(item.price).toFixed(2)}</td>
                              <td className="px-4 py-3 text-center align-middle">
                                <div className="flex flex-wrap justify-center gap-1.5">
                                  <Badge tone={item.active === false ? 'muted' : 'green'}>{item.active === false ? '已下架' : '上架'}</Badge>
                                  {item.sold_out && <Badge tone="red">售罄</Badge>}
                                  {item.recommended && <Badge tone="blue">推荐</Badge>}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center align-middle">
                                <div className="flex justify-center gap-1.5">
                                  <IconButton title="上移" disabled={!canMoveMenuItem(item, 'move-up')} onClick={() => moveMenuItem(item, 'move-up')}><ArrowUp size={16} /></IconButton>
                                  <IconButton title="下移" disabled={!canMoveMenuItem(item, 'move-down')} onClick={() => moveMenuItem(item, 'move-down')}><ArrowDown size={16} /></IconButton>
                                  <IconButton title="编辑" onClick={() => startEdit(item)}><Pencil size={16} /></IconButton>
                                  <IconButton title="下架" onClick={() => deleteMenuItem(item)}><Trash2 size={16} /></IconButton>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Panel>
              )}
              {menuMode === 'categories' && (
                <CategoryManager
                  categories={menuCategories}
                  form={categoryForm}
                  setForm={setCategoryForm}
                  editingCategory={editingCategory}
                  onSubmit={saveCategory}
                  onEdit={startEditCategory}
                  onDelete={deleteCategory}
                  onCancel={resetCategoryForm}
                  onRefresh={loadCategories}
                />
              )}
              </section>
          )}

          {section === 'orders' && (
            <Panel>
              <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap gap-2">
                  {orderStatusOptions.map(item => (
                    <button key={item.value} type="button" onClick={() => setOrderStatus(item.value)} className={`rounded-full px-3 py-2 text-xs font-bold ${orderStatus === item.value ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-950'}`}>
                      {item.label}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={loadOrders} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 hover:border-slate-300">
                  <RefreshCw size={17} />
                  刷新
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {orders.map(order => (
                  <div key={order.id} className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center">
                    <button type="button" onClick={() => loadOrderDetail(order.id)} className="min-w-0 text-left">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-950">{order.order_no}</span>
                        <Badge tone={toneForOrder(order.status)}>{labelOrderStatus(order.status)}</Badge>
                        <Badge tone="muted">{labelPayment(order.payment_method)}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{order.customer_name} · {order.customer_phone} · {order.order_type === 'dinein' ? `桌号 ${order.table_no || '-'}` : order.delivery_address}</p>
                    </button>
                    <div className="flex items-center justify-between gap-3 md:justify-end">
                      <div className="text-right">
                        <p className="font-bold">RM {Number(order.payable_total ?? order.total).toFixed(2)}</p>
                        <p className="text-xs text-slate-500">{formatDate(order.created_at)}</p>
                      </div>
                      <ChevronRight size={18} className="text-slate-300" />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {(section === 'wallet' || section === 'users') && (
            <Panel className="p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white">
                {section === 'wallet' ? <WalletCards size={24} /> : <Users size={24} />}
              </div>
              <h3 className="mt-5 text-2xl font-bold">{section === 'wallet' ? '充值审核' : '会员管理'}</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">菜单 CRUD、订单状态和管理员账号登录已完成，这个模块的列表与操作入口已预留。</p>
            </Panel>
          )}
        </div>
      </main>

      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-sm">
          <aside className="ml-auto h-full w-full max-w-[460px] overflow-hidden border-l border-slate-200 bg-white shadow-2xl">
            <MenuEditor
              form={form}
              setForm={setForm}
              categories={menuCategories.filter(category => category.active)}
	              editingItem={editingItem}
	              onSubmit={saveMenuItem}
	              onImageUpload={uploadMenuImage}
	              uploadingImage={uploadingImage}
	              pendingImage={pendingImage}
	              error={editorError}
	              duplicateCheck={duplicateCheck}
	              onClose={closeMenuEditor}
	            />
          </aside>
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-sm">
          <aside className="ml-auto h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/90 p-5 backdrop-blur-xl">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Order Detail</p>
                <h3 className="text-2xl font-bold text-slate-950">{selectedOrder.order.order_no}</h3>
              </div>
              <IconButton title="关闭" onClick={() => setSelectedOrder(null)}><X size={18} /></IconButton>
            </div>
            <div className="space-y-5 p-5">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-bold text-slate-950">{selectedOrder.order.customer_name}</p>
                <p className="mt-1 text-sm text-slate-400">{selectedOrder.order.customer_phone}</p>
                <p className="mt-1 text-sm text-slate-400">{selectedOrder.order.order_type === 'dinein' ? `桌号 ${selectedOrder.order.table_no || '-'}` : selectedOrder.order.delivery_address}</p>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">订单状态</label>
                <select value={selectedOrder.order.status} onChange={event => updateOrderStatus(selectedOrder.order.id, event.target.value as OrderStatus)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-950 outline-none focus:border-blue-500">
                  {orderStatusOptions.filter(item => item.value !== 'all').map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              <div className="rounded-2xl border border-slate-200">
                {selectedOrder.items.map(item => (
                  <div key={item.id || item.name} className="flex justify-between gap-4 border-b border-slate-100 p-4 last:border-b-0">
                    <div>
                      <p className="font-bold text-slate-950">{item.item_code ? `${item.item_code} · ` : ''}{item.name}</p>
                      <p className="mt-1 text-xs text-slate-500">x{item.quantity} · RM {Number(item.unit_price).toFixed(2)}</p>
                      {item.item_note && <p className="mt-1 text-xs text-slate-500">{item.item_note}</p>}
                    </div>
                    <p className="font-bold text-slate-950">RM {Number(item.line_total).toFixed(2)}</p>
                  </div>
                ))}
              </div>
              {selectedOrder.order.receipt_url && (
                <a href={selectedOrder.order.receipt_url} target="_blank" rel="noreferrer" className="block rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-bold text-slate-700 hover:border-slate-400">
                  查看付款截图
                </a>
              )}
            </div>
          </aside>
        </div>
      )}

      {isLoading && <div className="fixed bottom-5 right-5 rounded-full bg-slate-950 px-4 py-2 text-xs font-bold text-white shadow-xl">加载中</div>}
    </div>
  );
};

function AuthInput({ label, value, onChange, type = 'text', placeholder, autoComplete }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <input value={value} onChange={event => onChange(event.target.value)} type={type} placeholder={placeholder} autoComplete={autoComplete} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white" />
    </label>
  );
}

function createEmptyTranslations(): Record<TranslationLang, MenuTranslationForm> {
  return {
    en: createEmptyTranslationForm(),
    th: createEmptyTranslationForm(),
    vi: createEmptyTranslationForm(),
  };
}

function createEmptyTranslationForm(): MenuTranslationForm {
  return {
    name: '',
    description: '',
    detail: '',
    category_label: '',
    tags: [],
    option_groups: [],
  };
}

function createTranslationsFromItem(item: MenuItemRow): Record<TranslationLang, MenuTranslationForm> {
  const translations = createEmptyTranslations();
  translationLanguages.forEach(({ lang }) => {
    const translation = item.translations?.[lang];
    translations[lang] = {
      name: translation?.name || '',
      description: translation?.description || '',
      detail: translation?.detail || '',
      category_label: translation?.category_label || '',
      tags: Array.isArray(translation?.tags) ? translation.tags : typeof translation?.tags === 'string' ? [translation.tags].filter(Boolean) : [],
      option_groups: Array.isArray(translation?.option_groups) ? translation.option_groups : [],
    };
  });
  return translations;
}

function normalizeTranslationsForPayload(translations: Record<TranslationLang, MenuTranslationForm>, sourceGroups: MenuOptionGroup[]) {
  return Object.fromEntries(translationLanguages.map(({ lang }) => [
    lang,
    {
      ...translations[lang],
      tags: translations[lang].tags,
      option_groups: syncTranslatedOptionGroups(sourceGroups, translations[lang].option_groups),
    },
  ]));
}

function syncTranslatedOptionGroups(sourceGroups: MenuOptionGroup[], translatedGroups: MenuOptionGroupTranslation[]) {
  return sourceGroups.map(group => {
    const translatedGroup = translatedGroups.find(item => item.id === group.id);
    return {
      id: group.id,
      name: translatedGroup?.name || '',
      options: group.options.map(option => ({
        id: option.id,
        name: translatedGroup?.options.find(item => item.id === option.id)?.name || '',
      })),
    };
  });
}

function labelTranslationLanguage(lang: TranslationLang) {
  return translationLanguages.find(language => language.lang === lang)?.label || lang;
}

function duplicateCheckCacheKey(field: keyof DuplicateCheckState, value: string, excludeId?: number) {
  return `${field}:${excludeId || 'new'}:${value.trim().toLowerCase()}`;
}

function MenuEditor({ form, setForm, categories, editingItem, onSubmit, onImageUpload, uploadingImage, pendingImage, error, duplicateCheck, onClose }: {
  form: MenuFormState;
  setForm: React.Dispatch<React.SetStateAction<MenuFormState>>;
  categories: MenuCategoryRow[];
  editingItem: MenuItemRow | null;
  onSubmit: (event: React.FormEvent) => void;
  onImageUpload: (file: File) => void;
  uploadingImage: boolean;
  pendingImage: PendingMenuImage | null;
  error: string;
  duplicateCheck: DuplicateCheckState;
  onClose: () => void;
}) {
  const [activeTranslation, setActiveTranslation] = useState<TranslationLang>('en');
  const hasDuplicate = duplicateCheck.item_code === 'duplicate' || duplicateCheck.name === 'duplicate';
  const isCheckingDuplicate = duplicateCheck.item_code === 'checking' || duplicateCheck.name === 'checking';
  const update = (key: keyof MenuFormState, value: string | boolean) => setForm(prev => ({ ...prev, [key]: value }));
  const setOptionGroups = (option_groups: MenuOptionGroup[]) => setForm(prev => ({ ...prev, option_groups }));
  const updateTranslation = (lang: TranslationLang, patch: Partial<MenuTranslationForm>) => {
    setForm(prev => ({
      ...prev,
      translations: {
        ...prev.translations,
        [lang]: { ...prev.translations[lang], ...patch },
      },
    }));
  };
  const updateTranslatedGroupName = (lang: TranslationLang, groupId: string, name: string) => {
    setForm(prev => {
      const groups = syncTranslatedOptionGroups(prev.option_groups, prev.translations[lang].option_groups);
      return {
        ...prev,
        translations: {
          ...prev.translations,
          [lang]: {
            ...prev.translations[lang],
            option_groups: groups.map(group => group.id === groupId ? { ...group, name } : group),
          },
        },
      };
    });
  };
  const updateTranslatedOptionName = (lang: TranslationLang, groupId: string, optionId: string, name: string) => {
    setForm(prev => {
      const groups = syncTranslatedOptionGroups(prev.option_groups, prev.translations[lang].option_groups);
      return {
        ...prev,
        translations: {
          ...prev.translations,
          [lang]: {
            ...prev.translations[lang],
            option_groups: groups.map(group => group.id === groupId
              ? {
                ...group,
                options: group.options.map(option => option.id === optionId ? { ...option, name } : option),
              }
              : group),
          },
        },
      };
    });
  };
  const addOptionGroup = () => {
    const nextIndex = form.option_groups.length + 1;
    setOptionGroups([
      ...form.option_groups,
      {
        id: `group_${nextIndex}`,
        name: '',
        type: 'single',
        required: false,
        options: [{ id: 'option_1', name: '', priceDelta: 0 }],
      },
    ]);
  };
  const updateOptionGroup = (groupIndex: number, patch: Partial<MenuOptionGroup>) => {
    setOptionGroups(form.option_groups.map((group, index) => index === groupIndex ? { ...group, ...patch } : group));
  };
  const removeOptionGroup = (groupIndex: number) => {
    setOptionGroups(form.option_groups.filter((_, index) => index !== groupIndex));
  };
  const addOption = (groupIndex: number) => {
    setOptionGroups(form.option_groups.map((group, index) => {
      if (index !== groupIndex) return group;
      const nextIndex = group.options.length + 1;
      return {
        ...group,
        options: [...group.options, { id: `option_${nextIndex}`, name: '', priceDelta: 0 }],
      };
    }));
  };
  const updateOption = (groupIndex: number, optionIndex: number, patch: Partial<MenuOption>) => {
    setOptionGroups(form.option_groups.map((group, index) => {
      if (index !== groupIndex) return group;
      return {
        ...group,
        options: group.options.map((option, innerIndex) => innerIndex === optionIndex ? { ...option, ...patch } : option),
      };
    }));
  };
  const removeOption = (groupIndex: number, optionIndex: number) => {
    setOptionGroups(form.option_groups.map((group, index) => {
      if (index !== groupIndex) return group;
      return { ...group, options: group.options.filter((_, innerIndex) => innerIndex !== optionIndex) };
    }));
  };

  return (
    <form onSubmit={onSubmit} className="flex h-full flex-col overflow-hidden bg-white">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 p-5 backdrop-blur-xl">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Editor</p>
          <h3 className="text-xl font-bold text-slate-950">{editingItem ? '编辑菜品' : '新增菜品'}</h3>
        </div>
        <div className="flex items-center gap-2">
          <IconButton title="关闭" onClick={onClose}><X size={17} /></IconButton>
	          <button type="submit" disabled={uploadingImage || hasDuplicate || isCheckingDuplicate} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60">
	            <Save size={16} />
	            {uploadingImage ? '处理中' : '保存'}
	          </button>
	        </div>
	      </div>
	      {error && (
	        <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm font-bold text-red-700">
	          <div className="flex items-start gap-2">
	            <AlertCircle className="mt-0.5 shrink-0" size={16} />
	            <span>{error}</span>
	          </div>
	        </div>
	      )}
	      <div className="grid flex-1 gap-3 overflow-y-auto p-5">
        <Input label="编码" value={form.item_code} onChange={value => update('item_code', value)} placeholder="例如 S19" />
        <DuplicateHint field="item_code" status={duplicateCheck.item_code} />
        <Input label="中文名称" value={form.name} onChange={value => update('name', value)} required />
        <DuplicateHint field="name" status={duplicateCheck.name} />
        <SelectInput label="分类" value={form.category_id} onChange={value => update('category_id', value)} required>
          <option value="">请选择分类</option>
          {categories.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}
        </SelectInput>
        <Input label="价格" value={form.price} onChange={value => update('price', value)} type="number" required />
        <div>
          <span className="text-xs font-bold text-slate-500">菜品图片</span>
          <div className="mt-1.5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            {form.image_url ? (
              <img src={form.image_url} alt={form.name || '菜品图片'} className="h-40 w-full bg-slate-100 object-contain" />
            ) : (
              <div className="grid h-40 place-items-center text-sm font-bold text-slate-400">等待上传图片</div>
            )}
            <div className="border-t border-slate-200 bg-white p-3">
	              <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 ${uploadingImage ? 'pointer-events-none opacity-60' : ''}`}>
	                <Upload size={16} />
	                {uploadingImage ? '处理中' : '选择并处理图片'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (file) onImageUpload(file);
                    event.currentTarget.value = '';
                  }}
                />
	              </label>
	              {pendingImage && (
	                <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
	                  已选择新图片，保存后上传生效：{pendingImage.extension.toUpperCase()} · {Math.round(pendingImage.size / 1024)}KB
	                </p>
	              )}
	              <p className="mt-2 text-xs leading-5 text-slate-500">原图最大 5MB，保存时上传；优先 WebP，必要时使用 JPG，输出不超过 500KB，并命名为 {form.item_code || '{item_code}'}.webp / .jpg。</p>
	            </div>
          </div>
        </div>
        <TextArea label="简介" value={form.description} onChange={value => update('description', value)} required />
        <TextArea label="详情" value={form.detail} onChange={value => update('detail', value)} required />
        <TagEditor label="标签" tags={form.tags} onChange={tags => setForm(prev => ({ ...prev, tags }))} placeholder="输入标签后回车" />
        <OptionGroupsEditor
          groups={form.option_groups}
          onAddGroup={addOptionGroup}
          onUpdateGroup={updateOptionGroup}
          onRemoveGroup={removeOptionGroup}
          onAddOption={addOption}
          onUpdateOption={updateOption}
          onRemoveOption={removeOption}
        />
        <TranslationsEditor
          activeLang={activeTranslation}
          onActiveLangChange={setActiveTranslation}
          translations={form.translations}
          sourceGroups={form.option_groups}
          onUpdateTranslation={updateTranslation}
          onUpdateGroupName={updateTranslatedGroupName}
          onUpdateOptionName={updateTranslatedOptionName}
        />
        <div className="grid grid-cols-3 gap-2 pt-1">
          <Toggle label="推荐" checked={form.recommended} onChange={value => update('recommended', value)} />
          <Toggle label="售罄" checked={form.sold_out} onChange={value => update('sold_out', value)} />
          <Toggle label="上架" checked={form.active} onChange={value => update('active', value)} />
        </div>
      </div>
    </form>
  );
}

function OptionGroupsEditor({ groups, onAddGroup, onUpdateGroup, onRemoveGroup, onAddOption, onUpdateOption, onRemoveOption }: {
  groups: MenuOptionGroup[];
  onAddGroup: () => void;
  onUpdateGroup: (groupIndex: number, patch: Partial<MenuOptionGroup>) => void;
  onRemoveGroup: (groupIndex: number) => void;
  onAddOption: (groupIndex: number) => void;
  onUpdateOption: (groupIndex: number, optionIndex: number, patch: Partial<MenuOption>) => void;
  onRemoveOption: (groupIndex: number, optionIndex: number) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-500">规格 / 加料</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">用于前台选择规格、加料和自动计算加价。</p>
        </div>
        <button type="button" onClick={onAddGroup} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800">
          <Plus size={14} />
          添加组
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-xs font-bold text-slate-400">
          当前菜品没有规格或加料
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group, groupIndex) => (
            <div key={`${group.id}-${groupIndex}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-950">规格组 {groupIndex + 1}</p>
                  <p className="mt-1 text-[11px] text-slate-400">ID 只能使用英文字母、数字、下划线或短横线。</p>
                </div>
                <IconButton title="删除规格组" onClick={() => onRemoveGroup(groupIndex)}><Trash2 size={15} /></IconButton>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="组 ID" value={group.id} onChange={value => onUpdateGroup(groupIndex, { id: value })} placeholder="例如 portion" required />
                <Input label="组名称" value={group.name} onChange={value => onUpdateGroup(groupIndex, { name: value })} placeholder="例如 份量 / 加料" required />
                <SelectInput label="选择方式" value={group.type} onChange={value => onUpdateGroup(groupIndex, { type: value as MenuOptionGroup['type'] })}>
                  <option value="single">单选</option>
                  <option value="multiple">多选</option>
                </SelectInput>
                <div className="flex items-end">
                  <Toggle label={group.required ? '必选' : '可选'} checked={Boolean(group.required)} onChange={value => onUpdateGroup(groupIndex, { required: value })} />
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-500">选项</p>
                  <button type="button" onClick={() => onAddOption(groupIndex)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:border-blue-300 hover:text-blue-700">
                    <Plus size={13} />
                    添加选项
                  </button>
                </div>

                <div className="space-y-2">
                  {group.options.map((option, optionIndex) => (
                    <div key={`${option.id}-${optionIndex}`} className="grid gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_120px_40px]">
                      <Input label="选项 ID" value={option.id} onChange={value => onUpdateOption(groupIndex, optionIndex, { id: value })} placeholder="例如 large" required />
                      <Input label="选项名称" value={option.name} onChange={value => onUpdateOption(groupIndex, optionIndex, { name: value })} placeholder="例如 加大" required />
                      <Input
                        label="加价"
                        value={String(option.priceDelta)}
                        onChange={value => onUpdateOption(groupIndex, optionIndex, { priceDelta: Number(value || 0) })}
                        type="number"
                        required
                      />
                      <div className="flex items-end">
                        <IconButton title="删除选项" onClick={() => onRemoveOption(groupIndex, optionIndex)} disabled={group.options.length <= 1}><Trash2 size={15} /></IconButton>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TranslationsEditor({ activeLang, onActiveLangChange, translations, sourceGroups, onUpdateTranslation, onUpdateGroupName, onUpdateOptionName }: {
  activeLang: TranslationLang;
  onActiveLangChange: (lang: TranslationLang) => void;
  translations: Record<TranslationLang, MenuTranslationForm>;
  sourceGroups: MenuOptionGroup[];
  onUpdateTranslation: (lang: TranslationLang, patch: Partial<MenuTranslationForm>) => void;
  onUpdateGroupName: (lang: TranslationLang, groupId: string, name: string) => void;
  onUpdateOptionName: (lang: TranslationLang, groupId: string, optionId: string, name: string) => void;
}) {
  const current = translations[activeLang];
  const translatedGroups = syncTranslatedOptionGroups(sourceGroups, current.option_groups);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-500">多语言翻译</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">人工填写其他语言；留空则前台显示中文内容。</p>
        </div>
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
          {translationLanguages.map(language => (
            <button
              key={language.lang}
              type="button"
              onClick={() => onActiveLangChange(language.lang)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${activeLang === language.lang ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:text-slate-950'}`}
            >
              {language.shortLabel}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        <Input label={`${labelTranslationLanguage(activeLang)}名称`} value={current.name} onChange={value => onUpdateTranslation(activeLang, { name: value })} placeholder="留空则使用中文名称" />
        <Input label={`${labelTranslationLanguage(activeLang)}分类名称`} value={current.category_label} onChange={value => onUpdateTranslation(activeLang, { category_label: value })} placeholder="例如 Soup / Drinks" />
        <TextArea label={`${labelTranslationLanguage(activeLang)}简介`} value={current.description} onChange={value => onUpdateTranslation(activeLang, { description: value })} />
        <TextArea label={`${labelTranslationLanguage(activeLang)}详情`} value={current.detail} onChange={value => onUpdateTranslation(activeLang, { detail: value })} />
        <TagEditor label={`${labelTranslationLanguage(activeLang)}标签`} tags={current.tags} onChange={tags => onUpdateTranslation(activeLang, { tags })} placeholder="输入译文标签后回车" />

        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-bold text-slate-500">规格 / 加料翻译</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">这里只翻译显示名称，ID、价格、单选/多选继续使用中文主数据。</p>

          {sourceGroups.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-4 text-center text-xs font-bold text-slate-400">
              当前菜品没有规格或加料
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {sourceGroups.map(sourceGroup => {
                const translatedGroup = translatedGroups.find(group => group.id === sourceGroup.id);
                return (
                  <div key={sourceGroup.id} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
                      <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">{sourceGroup.name}</div>
                      <Input
                        label="规格组译名"
                        value={translatedGroup?.name || ''}
                        onChange={value => onUpdateGroupName(activeLang, sourceGroup.id, value)}
                        placeholder={sourceGroup.name}
                      />
                    </div>
                    <div className="mt-3 grid gap-2">
                      {sourceGroup.options.map(sourceOption => {
                        const translatedOption = translatedGroup?.options.find(option => option.id === sourceOption.id);
                        return (
                          <div key={sourceOption.id} className="grid gap-2 sm:grid-cols-[140px_1fr]">
                            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">{sourceOption.name}</div>
                            <Input
                              label="选项译名"
                              value={translatedOption?.name || ''}
                              onChange={value => onUpdateOptionName(activeLang, sourceGroup.id, sourceOption.id, value)}
                              placeholder={sourceOption.name}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function CategoryManager({ categories, form, setForm, editingCategory, onSubmit, onEdit, onDelete, onCancel, onRefresh }: {
  categories: MenuCategoryRow[];
  form: CategoryFormState;
  setForm: React.Dispatch<React.SetStateAction<CategoryFormState>>;
  editingCategory: MenuCategoryRow | null;
  onSubmit: (event: React.FormEvent) => void;
  onEdit: (category: MenuCategoryRow) => void;
  onDelete: (category: MenuCategoryRow) => void;
  onCancel: () => void;
  onRefresh: () => void;
}) {
  const update = (key: keyof CategoryFormState, value: string | boolean) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <Panel className="p-5">
        <div className="mb-5">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Category</p>
          <h3 className="mt-1 text-xl font-bold text-slate-950">{editingCategory ? '编辑分类' : '新增分类'}</h3>
        </div>
        <form onSubmit={onSubmit} className="grid gap-3">
          <Input label="分类名称" value={form.label} onChange={value => update('label', value)} placeholder="例如 炖汤" required />
          <Input label="排序" value={form.sort_order} onChange={value => update('sort_order', value)} type="number" />
          <Toggle label={form.active ? '启用' : '停用'} checked={form.active} onChange={value => update('active', value)} />
          <div className="flex gap-2 pt-2">
            <button type="submit" className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500">
              <Save size={16} />
              {editingCategory ? '保存分类' : '新增分类'}
            </button>
            {editingCategory && <IconButton title="取消编辑" onClick={onCancel}><X size={17} /></IconButton>}
          </div>
        </form>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white p-4">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Category List</p>
            <h3 className="text-lg font-bold text-slate-950">分类列表</h3>
          </div>
          <IconButton title="刷新分类" onClick={onRefresh}><RefreshCw size={17} /></IconButton>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[34%]" />
              <col className="w-[16%]" />
              <col className="w-[18%]" />
              <col className="w-[16%]" />
              <col className="w-[16%]" />
            </colgroup>
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.08em] text-slate-500">
              <tr>
                <th className="px-4 py-3 text-center font-bold">分类</th>
                <th className="px-4 py-3 text-center font-bold">排序</th>
                <th className="px-4 py-3 text-center font-bold">关联菜品</th>
                <th className="px-4 py-3 text-center font-bold">状态</th>
                <th className="px-4 py-3 text-center font-bold">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categories.map(category => (
                <tr key={category.id} className="transition hover:bg-slate-50/80">
                  <td className="px-4 py-4 text-center align-middle font-bold text-slate-950">{category.label}</td>
                  <td className="px-4 py-4 text-center align-middle text-slate-600">{category.sort_order}</td>
                  <td className="px-4 py-4 text-center align-middle text-slate-600">{category.item_count}</td>
                  <td className="px-4 py-4 text-center align-middle">
                    <Badge tone={category.active ? 'green' : 'muted'}>{category.active ? '启用' : '停用'}</Badge>
                  </td>
                  <td className="px-4 py-4 text-center align-middle">
                    <div className="flex justify-center gap-2">
                      <IconButton title="编辑分类" onClick={() => onEdit(category)}><Pencil size={16} /></IconButton>
                      <IconButton title="删除分类" onClick={() => onDelete(category)}><Trash2 size={16} /></IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

async function processMenuImage(file: File): Promise<PendingMenuImage> {
  const bitmap = await createImageBitmap(file);
  const maxBytes = 500 * 1024;
  const attempts = [
    { maxSide: 1200, quality: 0.82 },
    { maxSide: 1200, quality: 0.76 },
    { maxSide: 1100, quality: 0.72 },
    { maxSide: 1000, quality: 0.68 },
    { maxSide: 900, quality: 0.64 },
    { maxSide: 800, quality: 0.6 },
  ];
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close?.();
    throw new Error('浏览器不支持图片转换');
  }

  try {
    type Candidate = {
      blob: Blob;
      contentType: 'image/webp' | 'image/jpeg';
      extension: 'webp' | 'jpg';
      size: number;
    };
    const candidates: Candidate[] = [];
    let smallestCandidate: Candidate | null = null;

    for (const attempt of attempts) {
      const scale = Math.min(1, attempt.maxSide / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.width = width;
      canvas.height = height;
      context.clearRect(0, 0, width, height);
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);

      const blobs = await Promise.all([
        canvasToBlob(canvas, 'image/webp', attempt.quality),
        canvasToBlob(canvas, 'image/jpeg', attempt.quality),
      ]);
      blobs.forEach((blob, index) => {
        if (!blob) return;
        const candidate: Candidate = {
          blob,
          contentType: index === 0 ? 'image/webp' : 'image/jpeg',
          extension: index === 0 ? 'webp' : 'jpg',
          size: blob.size,
        };
        candidates.push(candidate);
        if (!smallestCandidate || candidate.size < smallestCandidate.size) smallestCandidate = candidate;
      });
    }

    const validCandidates = candidates
      .filter(candidate => candidate.size <= maxBytes)
      .sort((a, b) => a.size - b.size);
    const selected = validCandidates[0];
    if (!selected) {
      if (!smallestCandidate) throw new Error('图片处理失败');
      throw new Error(`处理后图片仍有 ${Math.round(smallestCandidate.size / 1024)}KB，超过 500KB，请换一张更小或更简单的图片`);
    }

    return {
      ...selected,
      previewUrl: URL.createObjectURL(selected.blob),
    };
  } finally {
    bitmap.close?.();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, contentType: 'image/webp' | 'image/jpeg', quality: number) {
  return new Promise<Blob | null>(resolve => canvas.toBlob(resolve, contentType, quality));
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.slice(result.indexOf(',') + 1) : result);
    };
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(blob);
  });
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white shadow-[0_16px_45px_rgba(15,23,42,0.06)] ${className}`}>{children}</section>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Panel className="p-5">
      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
    </Panel>
  );
}

function Input({ label, value, onChange, type = 'text', required, disabled, placeholder }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <input value={value} onChange={event => onChange(event.target.value)} type={type} required={required} disabled={disabled} placeholder={placeholder} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white disabled:cursor-not-allowed disabled:text-slate-400" />
    </label>
  );
}

function SelectInput({ label, value, onChange, required, children }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <select value={value} onChange={event => onChange(event.target.value)} required={required} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:bg-white">
        {children}
      </select>
    </label>
  );
}

function TextArea({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <textarea value={value} onChange={event => onChange(event.target.value)} required={required} rows={3} className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm leading-6 text-slate-950 outline-none transition focus:border-blue-500 focus:bg-white" />
    </label>
  );
}

function DuplicateHint({ field, status }: { field: keyof DuplicateCheckState; status: DuplicateCheckState[keyof DuplicateCheckState] }) {
  if (status === 'idle') return null;
  const label = field === 'item_code' ? '编码' : '名称';
  if (status === 'checking') return <p className="-mt-2 text-xs font-bold text-slate-400">正在检查{label}是否重复...</p>;
  if (status === 'duplicate') return <p className="-mt-2 text-xs font-bold text-red-600">这个{label}已存在，不能重复使用。</p>;
  return <p className="-mt-2 text-xs font-bold text-emerald-600">这个{label}可以使用。</p>;
}

function TagEditor({ label, tags, onChange, placeholder }: {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  const addTag = () => {
    const tag = draft.trim();
    if (!tag || tags.includes(tag)) {
      setDraft('');
      return;
    }
    onChange([...tags, tag]);
    setDraft('');
  };
  const removeTag = (tag: string) => onChange(tags.filter(item => item !== tag));

  return (
    <div>
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <div className="mt-1.5 rounded-xl border border-slate-200 bg-slate-50 p-2 transition focus-within:border-blue-500 focus-within:bg-white">
        <div className="flex flex-wrap gap-2">
          {tags.map(tag => (
            <span key={tag} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm">
              {tag}
              <button type="button" onClick={() => removeTag(tag)} className="text-slate-400 hover:text-red-600" aria-label={`删除标签 ${tag}`}>
                <X size={12} />
              </button>
            </span>
          ))}
          <input
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addTag();
              }
              if (event.key === 'Backspace' && !draft && tags.length) {
                onChange(tags.slice(0, -1));
              }
            }}
            placeholder={tags.length ? '' : placeholder}
            className="min-w-32 flex-1 bg-transparent px-2 py-1.5 text-sm text-slate-950 outline-none placeholder:text-slate-400"
          />
          <button type="button" onClick={addTag} className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800">
            添加
          </button>
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className={`flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2.5 text-xs font-bold ${checked ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
      <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} className="sr-only" />
      {label}
    </label>
  );
}

function IconButton({ title, onClick, children, disabled = false }: { title: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-500">
      {children}
    </button>
  );
}

function Badge({ tone, children }: { tone: 'green' | 'red' | 'blue' | 'muted'; children: React.ReactNode }) {
  const className = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    muted: 'bg-slate-100 text-slate-500 border-slate-200',
  }[tone];
  return <span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${className}`}>{children}</span>;
}

function labelOrderStatus(status: OrderStatus) {
  return {
    pending_confirm: '待确认',
    preparing: '制作中',
    delivering: '配送中',
    delivered: '已送达',
    completed: '已完成',
    cancelled: '已取消',
  }[status];
}

function toneForOrder(status: OrderStatus): 'green' | 'red' | 'blue' | 'muted' {
  if (status === 'completed' || status === 'delivered') return 'green';
  if (status === 'cancelled') return 'red';
  if (status === 'pending_confirm') return 'blue';
  return 'muted';
}

function labelPayment(method: string) {
  return {
    cash: '现金',
    tng: 'TNG',
    stripe: 'Stripe',
    wallet: '钱包',
  }[method] || method;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default AdminDashboard;
