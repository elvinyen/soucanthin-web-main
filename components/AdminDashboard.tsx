import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Bike,
  Check,
  CircleDollarSign,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CookingPot,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  KeyRound,
  LogOut,
  MoreHorizontal,
  Megaphone,
  Menu as MenuIcon,
  Handshake,
  Minus,
  Plus,
  RefreshCw,
  Save,
  Search,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Soup,
  Store,
  Trash2,
  Upload,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import KitchenBoard from './admin/KitchenBoard';
import { DeliveryBoard } from './admin/DeliveryBoard';
import { FinanceCenter } from './admin/FinanceCenter';
import { CouponCenter } from './admin/CouponCenter';
import { AgentCenter, type AgentAdminPage } from './admin/AgentCenter';
import { UserManagement } from './admin/UserManagement';
import { AdminLocaleTranslator } from './admin/AdminLocaleTranslator';
import { DeliverySettingsPanel } from './admin/DeliverySettingsPanel';
import { AuditLogCenter } from './admin/AuditLogCenter';
import { ChangePasswordDialog } from './admin/ChangePasswordDialog';

type AdminSection = 'menuItems' | 'menuCategories' | 'orders' | 'users' | 'customerOrder' | 'kitchen' | 'delivery' | 'finance' | 'coupons' | 'agents' | 'wallet' | 'accounts' | 'storeBranches' | 'systemSettings' | 'auditLogs';
type AdminRole = 'admin' | 'customer_service' | 'kitchen';
type AdminLanguage = 'zh' | 'en';
type OrderStatus = 'pending_confirm' | 'waiting_kitchen' | 'cooking' | 'kitchen_done' | 'stock_issue' | 'preparing' | 'delivering' | 'delivered' | 'completed' | 'cancelled';
type MenuSalesStatus = 'active' | 'sold_out' | 'inactive';

type AdminMe = {
  success: true;
  authenticated: boolean;
  setupRequired: boolean;
  admin?: {
    username: string;
    displayName: string;
    role: AdminRole;
    branchScope?: 'all' | 'assigned' | null;
    assignedBranchId?: string | null;
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
  order_source?: 'web' | 'admin_created' | string | null;
  created_by_admin_id?: string | null;
  user_id?: string | null;
  order_type: 'dinein' | 'takeaway';
  payment_method: string;
  customer_name: string;
  customer_phone: string;
  table_no?: string | null;
  delivery_address?: string | null;
  assigned_branch_id?: string | null;
  assigned_branch_name?: string | null;
  delivery_distance_km?: number | null;
  delivery_duration_min?: number | null;
  delivery_quote_provider?: string | null;
  note?: string | null;
  subtotal?: number | null;
  delivery_fee?: number | null;
  service_charge?: number | null;
  total: number;
  discount_amount?: number | null;
  payable_total?: number | null;
  status: OrderStatus;
  payment_status: string;
  payment_review_status: string;
  receipt_url?: string | null;
  notification_status?: string | null;
  last_operator_name?: string | null;
  last_status_changed_at?: string | null;
  created_at: string;
};

type OrderItemRow = {
  id?: string;
  item_code?: string | null;
  name: string;
  quantity: number;
  unit_base_price?: number | null;
  unit_options_total?: number | null;
  unit_price: number;
  line_total: number;
  selected_options?: {
    groupId?: string;
    groupName?: string;
    optionId?: string;
    name?: string;
    priceDelta?: number;
  }[] | null;
  item_note?: string | null;
};

type OrderChangeRecord = {
  id: string;
  order_id: string;
  order_no: string;
  change_type: 'payment_method';
  action: 'submitted' | 'approved' | 'rejected';
  before_data: Record<string, unknown>;
  after_data: Record<string, unknown>;
  reason?: string | null;
  related_event_id?: string | null;
  created_by_admin_id?: string | null;
  operator_name: string;
  created_at: string;
};

type MenuCategoryRow = {
  id: number;
  label: string;
  sort_order: number;
  active: boolean;
  item_count: number;
};

type AdminAccountRow = {
  id: string;
  username: string;
  displayName: string;
  role: AdminRole;
  branchScope: 'all' | 'assigned';
  assignedBranchId?: string | null;
  active: boolean;
  lastLoginAt?: string | null;
  createdAt?: string | null;
};

type StoreBranchRow = {
  id: string;
  name: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  active: boolean;
  sort_order: number;
  created_at?: string | null;
  updated_at?: string | null;
};

type CustomerRow = {
  id: string;
  phone: string;
  displayPhone: string;
  name: string;
  source: 'otp' | 'admin_created';
  createdAt: string;
  lastLoginAt?: string | null;
};

type OrderMenuItem = {
  id: number;
  code?: string;
  name: string;
  price: number;
  category: string;
  image?: string;
  soldOut?: boolean;
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

type AccountFormState = {
  id: string;
  username: string;
  displayName: string;
  role: AdminRole;
  branchScope: 'all' | 'assigned';
  password: string;
  active: boolean;
  assignedBranchId: string;
};

type StoreBranchFormState = {
  id: string;
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  active: boolean;
  sort_order: string;
};

type CustomerFormState = {
  phone: string;
  name: string;
};

type CustomerOrderLine = {
  lineId: string;
  menuItemId: string;
  quantity: number;
  note: string;
};

type CustomerOrderFormState = {
  orderType: 'dinein' | 'takeaway';
  branchId: string;
  tableNo: string;
  address: string;
  note: string;
  draftMenuItemId: string;
  items: CustomerOrderLine[];
};

const emptyCategoryForm: CategoryFormState = {
  id: '',
  label: '',
  sort_order: '0',
  active: true,
};

const emptyAccountForm: AccountFormState = {
  id: '',
  username: '',
  displayName: '',
  role: 'kitchen',
  branchScope: 'assigned',
  password: '',
  active: true,
  assignedBranchId: '',
};

const emptyStoreBranchForm: StoreBranchFormState = {
  id: '',
  name: '',
  address: '',
  latitude: '',
  longitude: '',
  active: true,
  sort_order: '0',
};

const emptyCustomerForm: CustomerFormState = {
  phone: '',
  name: '',
};

const emptyCustomerOrderForm: CustomerOrderFormState = {
  orderType: 'dinein',
  branchId: '',
  tableNo: '',
  address: '',
  note: '',
  draftMenuItemId: '',
  items: [],
};

const orderStatusOptions: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部订单' },
  { value: 'pending_confirm', label: '待确认' },
  { value: 'waiting_kitchen', label: '待制作' },
  { value: 'cooking', label: '厨房制作中' },
  { value: 'kitchen_done', label: '厨房完成' },
  { value: 'stock_issue', label: '缺货异常' },
  { value: 'preparing', label: '制作中' },
  { value: 'delivering', label: '配送中' },
  { value: 'delivered', label: '已送达' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
];

const sections = [
  { id: 'menuItems' as const, label: '菜品管理', icon: Soup },
  { id: 'menuCategories' as const, label: '分类管理', icon: Soup },
  { id: 'orders' as const, label: '订单管理', icon: ClipboardList },
  { id: 'users' as const, label: '用户管理', icon: Users },
  { id: 'customerOrder' as const, label: '用户下单', icon: ShoppingCart },
  { id: 'kitchen' as const, label: '厨房出餐', icon: CookingPot },
  { id: 'delivery' as const, label: '配送工作台', icon: Bike },
  { id: 'finance' as const, label: '财务中心', icon: CircleDollarSign },
  { id: 'coupons' as const, label: '营销中心', icon: Megaphone },
  { id: 'agents' as const, label: '代理管理', icon: Handshake },
  { id: 'storeBranches' as const, label: '门店管理', icon: Store },
  { id: 'wallet' as const, label: '充值审核', icon: WalletCards },
  { id: 'accounts' as const, label: '账号管理', icon: ShieldCheck },
  { id: 'systemSettings' as const, label: '系统设置', icon: Settings },
  { id: 'auditLogs' as const, label: '操作日志', icon: ScrollText },
];

const ADMIN_LANGUAGE_STORAGE_KEY = 'soucanthin.admin.language';

const agentAdminNavItems: { id: AgentAdminPage; label: string }[] = [
  { id: 'overview', label: '代理总览' },
  { id: 'applications', label: '代理申请审核' },
  { id: 'profile-changes', label: '代理资料审核' },
  { id: 'agents', label: '代理列表' },
  { id: 'orders', label: '推广订单' },
  { id: 'commissions', label: '佣金管理' },
  { id: 'payouts', label: '提现审核' },
  { id: 'audit-logs', label: '代理操作日志' },
];

const agentAdminEnglishLabels: Record<AgentAdminPage, string> = {
  overview: 'Overview',
  applications: 'Application Review',
  'profile-changes': 'Profile Review',
  agents: 'Agent List',
  orders: 'Referral Orders',
  commissions: 'Commission Management',
  payouts: 'Payout Review',
  'audit-logs': 'Agent Audit Logs',
};

function agentPageLabel(page: AgentAdminPage, language: AdminLanguage) {
  if (language === 'en') return agentAdminEnglishLabels[page];
  return agentAdminNavItems.find(item => item.id === page)?.label || '代理总览';
}

const adminCopy = {
  zh: {
    systemSettings: '系统设置', general: '通用', language: '语言', languageDescription: '选择后台系统的显示语言。设置会保存在当前设备。',
    chinese: '简体中文', english: 'English', saved: '语言已切换', settingsHint: '后台所有固定界面文案会使用所选语言。业务数据与已填写内容不会被修改。',
    menuManagement: '菜单管理', itemManagement: '菜品管理', categoryManagement: '分类管理', collapseSidebar: '折叠侧栏', expandSidebar: '展开侧栏', logout: '退出', logoutAdmin: '退出后台', updatedAt: '更新于', autoSync: '进入页面后自动同步',
  },
  en: {
    systemSettings: 'System Settings', general: 'General', language: 'Language', languageDescription: 'Choose the display language for the admin system. Your preference is saved on this device.',
    chinese: 'Simplified Chinese', english: 'English', saved: 'Language updated', settingsHint: 'All fixed admin interface text uses the selected language. Business data and existing content are not changed.',
    menuManagement: 'Menu Management', itemManagement: 'Menu Items', categoryManagement: 'Categories', collapseSidebar: 'Collapse sidebar', expandSidebar: 'Expand sidebar', logout: 'Log out', logoutAdmin: 'Log out of admin', updatedAt: 'Updated', autoSync: 'Automatically synced when this page opens',
  },
} as const;

function sectionLabel(section: AdminSection, language: AdminLanguage) {
  if (section === 'systemSettings') return adminCopy[language].systemSettings;
  const englishLabels: Partial<Record<AdminSection, string>> = {
    menuItems: 'Menu Items', menuCategories: 'Categories', orders: 'Orders', users: 'Users', customerOrder: 'Create Order', kitchen: 'Kitchen', delivery: 'Delivery', finance: 'Finance', coupons: 'Marketing', agents: 'Agents', wallet: 'Top-up Review', accounts: 'Accounts', storeBranches: 'Stores', auditLogs: 'Audit Logs',
  };
  return language === 'en' ? englishLabels[section] || section : sections.find(item => item.id === section)?.label || section;
}

function initialAdminSection(): AdminSection {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  if (pathname === '/admin/menu-categories') return 'menuCategories';
  if (pathname === '/admin/kitchen') return 'kitchen';
  if (pathname === '/admin/delivery') return 'delivery';
  if (pathname === '/admin/finance') return 'finance';
  if (pathname === '/admin/coupons') return 'coupons';
  if (pathname === '/admin/agents' || pathname.startsWith('/admin/agents/')) return 'agents';
  if (pathname === '/admin/store-branches') return 'storeBranches';
  if (pathname === '/admin/orders') return 'orders';
  if (pathname === '/admin/users') return 'users';
  if (pathname === '/admin/customer-order') return 'customerOrder';
  if (pathname === '/admin/accounts') return 'accounts';
  if (pathname === '/admin/system-settings') return 'systemSettings';
  if (pathname === '/admin/audit-logs') return 'auditLogs';
  return 'menuItems';
}

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
type MenuDisplayLabel = 'none' | 'recommended' | 'hot' | 'new' | 'signature';
const menuDisplayLabelOptions: { value: MenuDisplayLabel; label: string; tag?: string }[] = [
  { value: 'none', label: '无标签' },
  { value: 'recommended', label: '推荐' },
  { value: 'hot', label: '热卖', tag: '热卖' },
  { value: 'new', label: '新品', tag: '新品' },
  { value: 'signature', label: '招牌', tag: '招牌' },
];
const menuDisplayTags = menuDisplayLabelOptions.map(item => item.tag).filter(Boolean) as string[];

const AdminDashboard: React.FC = () => {
  const [auth, setAuth] = useState<AdminMe | null>(null);
  const [section, setSection] = useState<AdminSection>(initialAdminSection);
  const [adminLanguage, setAdminLanguage] = useState<AdminLanguage>(() => {
    const saved = window.localStorage.getItem(ADMIN_LANGUAGE_STORAGE_KEY);
    return saved === 'en' ? 'en' : 'zh';
  });
  const [notice, setNotice] = useState('');
  const noticeTimerRef = useRef<number | null>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [setupToken, setSetupToken] = useState('');

  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([]);
  const [menuSearch, setMenuSearch] = useState('');
  const [menuCategoryFilter, setMenuCategoryFilter] = useState('all');
  const [menuStatusFilter, setMenuStatusFilter] = useState('all');
  const [openMenuItemActions, setOpenMenuItemActions] = useState<number | null>(null);
  const [statusUpdatingItemId, setStatusUpdatingItemId] = useState<number | null>(null);
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
  const [isCategoryEditorOpen, setIsCategoryEditorOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [menuNavOpen, setMenuNavOpen] = useState(false);
  const [agentNavOpen, setAgentNavOpen] = useState(() => window.location.pathname.startsWith('/admin/agents'));
  const [agentPage, setAgentPage] = useState<AgentAdminPage>(() => agentPageForPath(window.location.pathname));

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [orderStatus, setOrderStatus] = useState<OrderStatus | 'all'>('all');
  const [selectedOrder, setSelectedOrder] = useState<{ order: OrderRow; items: OrderItemRow[]; changes: OrderChangeRecord[] } | null>(null);
  const [isOrderChangeOpen, setIsOrderChangeOpen] = useState(false);
  const [paymentChangeReason, setPaymentChangeReason] = useState('');
  const [paymentReceiptFile, setPaymentReceiptFile] = useState<File | null>(null);
  const [paymentChangeSubmitting, setPaymentChangeSubmitting] = useState(false);
  const [paymentReviewReason, setPaymentReviewReason] = useState('');
  const [paymentReviewSubmitting, setPaymentReviewSubmitting] = useState(false);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);
  const [customerForm, setCustomerForm] = useState<CustomerFormState>(emptyCustomerForm);
  const [customerOrderForm, setCustomerOrderForm] = useState<CustomerOrderFormState>(emptyCustomerOrderForm);
  const [customerOrderMenuItems, setCustomerOrderMenuItems] = useState<OrderMenuItem[]>([]);
  const [customerOrderError, setCustomerOrderError] = useState('');
  const [customerOrderSubmitting, setCustomerOrderSubmitting] = useState(false);
  const [deliveryPreview, setDeliveryPreview] = useState<{ deliveryFee: number; distanceKm: number; durationMin: number } | null>(null);
  const [deliveryPreviewLoading, setDeliveryPreviewLoading] = useState(false);
  const [accounts, setAccounts] = useState<AdminAccountRow[]>([]);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [accountForm, setAccountForm] = useState<AccountFormState>(emptyAccountForm);
  const [accountError, setAccountError] = useState('');
  const [isAccountEditorOpen, setIsAccountEditorOpen] = useState(false);
  const [storeBranches, setStoreBranches] = useState<StoreBranchRow[]>([]);
  const [storeBranchForm, setStoreBranchForm] = useState<StoreBranchFormState>(emptyStoreBranchForm);
  const [storeBranchError, setStoreBranchError] = useState('');
  const [isStoreBranchEditorOpen, setIsStoreBranchEditorOpen] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Partial<Record<AdminSection, Date>>>({});
  const lastPassiveRefreshAt = useRef(0);

  const authenticated = Boolean(auth?.authenticated);
  const setupRequired = Boolean(auth?.setupRequired);
  const copy = adminCopy[adminLanguage];
  const availableSections = sections.filter(item => {
    const role = auth?.admin?.role;
    if (!role || role === 'admin') return true;
    if (role === 'customer_service') return ['menuItems', 'menuCategories', 'orders', 'users', 'customerOrder', 'kitchen', 'delivery', 'coupons', 'agents', 'storeBranches', 'systemSettings'].includes(item.id);
    return item.id === 'kitchen';
  });
  const filteredMenuItems = menuItems.filter(item => {
    const categoryMatches = menuCategoryFilter === 'all' || String(item.category_id) === menuCategoryFilter;
    const salesStatus = getMenuSalesStatus(item);
    const statusMatches = menuStatusFilter === 'all'
      || menuStatusFilter === salesStatus;
    return categoryMatches && statusMatches;
  });
  const menuStats = {
    total: menuItems.length,
    active: menuItems.filter(item => getMenuSalesStatus(item) === 'active').length,
    soldOut: menuItems.filter(item => getMenuSalesStatus(item) === 'sold_out').length,
    inactive: menuItems.filter(item => getMenuSalesStatus(item) === 'inactive').length,
  };
  const isMenuSection = section === 'menuItems' || section === 'menuCategories';
  const usesViewportLayout = isMenuSection || section === 'orders' || section === 'delivery' || section === 'users' || section === 'customerOrder' || section === 'storeBranches' || section === 'accounts' || section === 'coupons' || section === 'systemSettings' || section === 'auditLogs';
  const markSectionUpdated = (target: AdminSection) => {
    setLastUpdatedAt(current => ({ ...current, [target]: new Date() }));
  };

  useEffect(() => {
    void refreshAuth();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(ADMIN_LANGUAGE_STORAGE_KEY, adminLanguage);
    document.documentElement.lang = adminLanguage === 'en' ? 'en' : 'zh-CN';
  }, [adminLanguage]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    if (!authenticated) return;
    document.documentElement.classList.add('admin-scroll-lock');
    document.body.classList.add('admin-scroll-lock');
    return () => {
      document.documentElement.classList.remove('admin-scroll-lock');
      document.body.classList.remove('admin-scroll-lock');
    };
  }, [authenticated]);

  useLayoutEffect(() => {
    contentScrollRef.current?.scrollTo({ top: 0, left: 0 });
  }, [section, agentPage]);

  useEffect(() => {
    if (!authenticated) return;
    if (section === 'menuItems' || section === 'menuCategories') {
      void loadMenuItems();
      void loadCategories();
    }
    if (section === 'orders') void loadOrders();
    if (section === 'customerOrder') {
      void loadCustomers();
      void loadCustomerOrderMenu();
      void loadStoreBranches();
    }
    if (section === 'accounts') void loadAccounts();
    if (section === 'accounts') void loadStoreBranches();
    if (section === 'storeBranches') void loadStoreBranches();
  }, [authenticated, section, orderStatus]);

  useEffect(() => {
    if (!authenticated) return;
    const refreshActiveSection = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastPassiveRefreshAt.current < 1200) return;
      lastPassiveRefreshAt.current = now;
      if (section === 'menuItems') {
        void loadMenuItems();
        void loadCategories();
      } else if (section === 'menuCategories') {
        void loadCategories();
        void loadMenuItems();
      } else if (section === 'orders') {
        void loadOrders(true);
      } else if (section === 'customerOrder') {
        void loadCustomers();
        void loadCustomerOrderMenu();
        void loadStoreBranches();
      } else if (section === 'accounts') {
        void loadAccounts();
      } else if (section === 'storeBranches') {
        void loadStoreBranches();
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshActiveSection();
    };
    window.addEventListener('focus', refreshActiveSection);
    window.addEventListener('online', refreshActiveSection);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', refreshActiveSection);
      window.removeEventListener('online', refreshActiveSection);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authenticated, section, orderStatus]);

  useEffect(() => {
    if (!authenticated || section !== 'orders') return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadOrders(true);
    }, 15000);
    return () => window.clearInterval(interval);
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

  useEffect(() => {
    setDeliveryPreview(null);
  }, [customerOrderForm.orderType, customerOrderForm.address, customerOrderForm.branchId]);

  const api = async <T,>(path: string, init: RequestInit = {}) => {
    const response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      cache: 'no-store',
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

  useEffect(() => {
    if (!authenticated || !auth?.admin) return;
    const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
    if (auth.admin.role === 'kitchen') {
      if (pathname !== '/admin/kitchen') {
        window.history.replaceState({}, '', '/admin/kitchen');
      }
      if (section !== 'kitchen') setSection('kitchen');
      return;
    }
    if (auth.admin.role === 'customer_service') {
      const requestedSection = sectionForPath(pathname);
      const nextSection: AdminSection = requestedSection && availableSections.some(item => item.id === requestedSection)
        ? requestedSection
        : 'orders';
      if (section !== nextSection) setSection(nextSection);
      const nextPath = pathForSection(nextSection);
      if (nextSection === 'agents') setAgentPage(agentPageForPath(pathname));
      if (pathname !== nextPath && !(nextSection === 'agents' && pathname.startsWith('/admin/agents'))) window.history.replaceState({}, '', nextPath);
      return;
    }
    const pathSection = sectionForPath(pathname);
    if (pathSection && pathSection !== section) {
      setSection(pathSection);
    }
    if (pathSection === 'agents') setAgentPage(agentPageForPath(pathname));
  }, [authenticated, auth?.admin, section]);

  const refreshAuth = async () => {
    try {
      const payload = await api<AdminMe>('/api/admin/auth');
      setAuth(payload);
    } catch {
      setAuth({ success: true, authenticated: false, setupRequired: false });
    }
  };

  const showNotice = (message: string) => {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    setNotice(message);
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice('');
      noticeTimerRef.current = null;
    }, 2400);
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
      setAccounts([]);
      setStoreBranches([]);
      if ((window.location.pathname.replace(/\/+$/, '') || '/').startsWith('/admin/')) {
        window.history.replaceState({}, '', '/admin');
      }
    }
  };

  const selectSection = (nextSection: AdminSection) => {
    if (!availableSections.some(item => item.id === nextSection)) return;
    setSection(nextSection);
    setMobileNavOpen(false);
    const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
    const nextPath = pathForSection(nextSection);
    if (pathname !== nextPath) window.history.replaceState({}, '', nextPath);
  };

  const selectAgentPage = (nextPage: AgentAdminPage) => {
    if (!availableSections.some(item => item.id === 'agents')) return;
    setSection('agents');
    setAgentPage(nextPage);
    setAgentNavOpen(true);
    setMobileNavOpen(false);
    const nextPath = pathForAgentPage(nextPage);
    if (window.location.pathname !== nextPath) window.history.replaceState({}, '', nextPath);
  };

  const changeAdminLanguage = (nextLanguage: AdminLanguage) => {
    setAdminLanguage(nextLanguage);
    showNotice(adminCopy[nextLanguage].saved);
  };

  const loadMenuItems = async () => {
    setIsLoading(true);
    setError('');
    try {
      const query = menuSearch.trim() ? `?search=${encodeURIComponent(menuSearch.trim())}` : '';
      const payload = await api<{ success: true; items: MenuItemRow[] }>(`/api/admin/menu-items${query}`);
      setMenuItems(payload.items);
      markSectionUpdated('menuItems');
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
      markSectionUpdated('menuCategories');
    } catch (err) {
      setError(err instanceof Error ? err.message : '分类加载失败');
    }
  };

  const loadOrders = async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError('');
    try {
      const payload = await api<{ success: true; orders: OrderRow[] }>(`/api/admin/orders?status=${orderStatus}`);
      setOrders(payload.orders);
      markSectionUpdated('orders');
    } catch (err) {
      setError(err instanceof Error ? err.message : '订单加载失败');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const loadCustomers = async () => {
    setIsLoading(true);
    setCustomerOrderError('');
    try {
      const query = customerSearch.trim() ? `?search=${encodeURIComponent(customerSearch.trim())}` : '';
      const payload = await api<{ success: true; customers: CustomerRow[] }>(`/api/admin/customers${query}`);
      setCustomers(payload.customers);
      markSectionUpdated('customerOrder');
    } catch (err) {
      setCustomerOrderError(err instanceof Error ? err.message : '顾客加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCustomerOrderMenu = async () => {
    setCustomerOrderError('');
    try {
      const payload = await api<{ success: true; items: OrderMenuItem[] }>('/api/menu?lang=zh');
      const items = payload.items.filter(item => !item.soldOut);
      setCustomerOrderMenuItems(items);
      markSectionUpdated('customerOrder');
      setCustomerOrderForm(prev => ({
        ...prev,
        draftMenuItemId: prev.draftMenuItemId || String(items[0]?.id || ''),
      }));
    } catch (err) {
      setCustomerOrderError(err instanceof Error ? err.message : '菜单加载失败');
    }
  };

  const createCustomer = async (event: React.FormEvent) => {
    event.preventDefault();
    setCustomerOrderError('');
    try {
      const payload = await api<{ success: true; customer: CustomerRow }>('/api/admin/customers', {
        method: 'POST',
        body: JSON.stringify(customerForm),
      });
      setSelectedCustomer(payload.customer);
      setCustomers(prev => [payload.customer, ...prev.filter(customer => customer.id !== payload.customer.id)]);
      setCustomerForm(emptyCustomerForm);
      showNotice('顾客已创建');
    } catch (err) {
      const message = err instanceof Error ? err.message : '顾客创建失败';
      setCustomerOrderError(message);
      if (message.includes('已存在')) void loadCustomers();
    }
  };

  const addCustomerOrderLine = (requestedMenuItemId?: string) => {
    const menuItemId = requestedMenuItemId || customerOrderForm.draftMenuItemId || String(customerOrderMenuItems[0]?.id || '');
    if (!menuItemId) return;
    setCustomerOrderForm(prev => {
      const existing = prev.items.find(item => item.menuItemId === menuItemId && !item.note);
      if (existing) {
        return {
          ...prev,
          items: prev.items.map(item => item.lineId === existing.lineId ? { ...item, quantity: item.quantity + 1 } : item),
        };
      }
      return {
        ...prev,
        draftMenuItemId: menuItemId,
        items: [
          ...prev.items,
          {
            lineId: `${menuItemId}-${Date.now()}`,
            menuItemId,
            quantity: 1,
            note: '',
          },
        ],
      };
    });
  };

  const updateCustomerOrderLine = (lineId: string, patch: Partial<CustomerOrderLine>) => {
    setCustomerOrderForm(prev => ({
      ...prev,
      items: prev.items.map(item => item.lineId === lineId ? { ...item, ...patch } : item),
    }));
  };

  const removeCustomerOrderLine = (lineId: string) => {
    setCustomerOrderForm(prev => ({
      ...prev,
      items: prev.items.filter(item => item.lineId !== lineId),
    }));
  };

  const loadDeliveryPreview = async () => {
    if (customerOrderForm.orderType !== 'takeaway') return;
    setDeliveryPreviewLoading(true);
    setCustomerOrderError('');
    try {
      const payload = await api<{ success: true; deliveryFee: number; distanceKm: number; durationMin: number }>('/api/delivery-quote', {
        method: 'POST',
        body: JSON.stringify({ address: customerOrderForm.address, branchId: customerOrderForm.branchId }),
      });
      setDeliveryPreview({
        deliveryFee: Number(payload.deliveryFee || 0),
        distanceKm: Number(payload.distanceKm || 0),
        durationMin: Number(payload.durationMin || 0),
      });
    } catch (err) {
      setDeliveryPreview(null);
      setCustomerOrderError(err instanceof Error ? err.message : '配送费计算失败');
    } finally {
      setDeliveryPreviewLoading(false);
    }
  };

  const submitCustomerOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    setCustomerOrderError('');
    if (!selectedCustomer) {
      setCustomerOrderError('请选择顾客');
      return;
    }
    if (!customerOrderForm.items.length) {
      setCustomerOrderError('请添加菜品');
      return;
    }
    if (!customerOrderForm.branchId) {
      setCustomerOrderError('请选择门店');
      return;
    }

    setCustomerOrderSubmitting(true);
    try {
      const order = buildCustomerOrderPayload(selectedCustomer, customerOrderForm, customerOrderMenuItems, deliveryPreview, storeBranches);
      const payload = await api<{ success: true; orderId: string }>('/api/admin/orders', {
        method: 'POST',
        body: JSON.stringify({ customerId: selectedCustomer.id, order }),
      });
      showNotice(`订单已创建：${payload.orderId}`);
      setCustomerOrderForm({
        ...emptyCustomerOrderForm,
        branchId: storeBranches.find(branch => branch.active)?.id || '',
        draftMenuItemId: String(customerOrderMenuItems[0]?.id || ''),
      });
      setDeliveryPreview(null);
      await loadOrders();
    } catch (err) {
      setCustomerOrderError(err instanceof Error ? err.message : '代客下单失败');
    } finally {
      setCustomerOrderSubmitting(false);
    }
  };

  const loadAccounts = async () => {
    setIsLoading(true);
    setError('');
    try {
      const payload = await api<{ success: true; accounts: AdminAccountRow[] }>('/api/admin/accounts');
      setAccounts(payload.accounts);
      markSectionUpdated('accounts');
    } catch (err) {
      setError(err instanceof Error ? err.message : '账号加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  const startEditAccount = (account: AdminAccountRow) => {
    setAccountError('');
    setAccountForm({
      id: account.id,
      username: account.username,
      displayName: account.displayName,
      role: account.role,
      branchScope: account.branchScope || (account.role === 'admin' ? 'all' : 'assigned'),
      password: '',
      active: account.active,
      assignedBranchId: account.assignedBranchId || '',
    });
    setIsAccountEditorOpen(true);
  };

  const startCreateAccount = () => {
    setAccountError('');
    setAccountForm(emptyAccountForm);
    setIsAccountEditorOpen(true);
  };

  const resetAccountForm = () => {
    setAccountError('');
    setAccountForm(emptyAccountForm);
    setIsAccountEditorOpen(false);
  };

  const saveAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setAccountError('');
    setError('');
    try {
      const payload = accountForm.id
        ? {
            id: accountForm.id,
            username: accountForm.username,
            displayName: accountForm.displayName,
            role: accountForm.role,
            branchScope: accountForm.branchScope,
            active: accountForm.active,
            assignedBranchId: accountForm.assignedBranchId || null,
            ...(accountForm.password.trim() ? { password: accountForm.password } : {}),
          }
        : {
            username: accountForm.username,
            displayName: accountForm.displayName,
            role: accountForm.role,
            branchScope: accountForm.branchScope,
            password: accountForm.password,
            active: accountForm.active,
            assignedBranchId: accountForm.assignedBranchId || null,
          };
      await api('/api/admin/accounts', {
        method: accountForm.id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      showNotice(accountForm.id ? '账号已更新' : '账号已创建');
      resetAccountForm();
      await loadAccounts();
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : '账号保存失败');
    }
  };

  const toggleAccountActive = async (account: AdminAccountRow) => {
    setError('');
    try {
      await api('/api/admin/accounts', {
        method: 'PATCH',
        body: JSON.stringify({ id: account.id, active: !account.active }),
      });
      showNotice(account.active ? '账号已停用' : '账号已启用');
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : '账号状态更新失败');
    }
  };

  const deleteAccount = async (account: AdminAccountRow) => {
    if (!window.confirm(`确认删除账号“${account.username}”？删除后该账号将立即无法登录。`)) return;
    setError('');
    try {
      await api('/api/admin/accounts', {
        method: 'DELETE',
        body: JSON.stringify({ id: account.id }),
      });
      if (accountForm.id === account.id) resetAccountForm();
      showNotice('账号已删除');
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : '账号删除失败');
    }
  };

  const loadStoreBranches = async () => {
    setIsLoading(true);
    setStoreBranchError('');
    setError('');
    try {
      const payload = await api<{ success: true; branches: StoreBranchRow[] }>('/api/admin/store-branches');
      setStoreBranches(payload.branches);
      markSectionUpdated('storeBranches');
      markSectionUpdated('customerOrder');
      const activeBranches = payload.branches.filter(branch => branch.active);
      setCustomerOrderForm(prev => {
        if (prev.branchId && activeBranches.some(branch => branch.id === prev.branchId)) return prev;
        return {
          ...prev,
          branchId: activeBranches[0]?.id || '',
        };
      });
    } catch (err) {
      setStoreBranchError(err instanceof Error ? err.message : '门店加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  const startEditStoreBranch = (branch: StoreBranchRow) => {
    setStoreBranchError('');
    setStoreBranchForm({
      id: branch.id,
      name: branch.name,
      address: branch.address,
      latitude: branch.latitude === null || branch.latitude === undefined ? '' : String(branch.latitude),
      longitude: branch.longitude === null || branch.longitude === undefined ? '' : String(branch.longitude),
      active: branch.active,
      sort_order: String(branch.sort_order ?? 0),
    });
    setIsStoreBranchEditorOpen(true);
  };

  const startCreateStoreBranch = () => {
    setStoreBranchError('');
    setStoreBranchForm({
      ...emptyStoreBranchForm,
      sort_order: String((storeBranches.at(-1)?.sort_order ?? -10) + 10),
    });
    setIsStoreBranchEditorOpen(true);
  };

  const resetStoreBranchForm = () => {
    setStoreBranchError('');
    setStoreBranchForm(emptyStoreBranchForm);
    setIsStoreBranchEditorOpen(false);
  };

  const saveStoreBranch = async (event: React.FormEvent) => {
    event.preventDefault();
    setStoreBranchError('');
    setError('');
    if (!storeBranchForm.id.trim()) {
      setStoreBranchError('请填写门店 ID');
      return;
    }

    try {
      const existing = storeBranches.find(branch => branch.id === storeBranchForm.id);
      const payload: Record<string, unknown> = {
        id: storeBranchForm.id,
        name: storeBranchForm.name,
        address: storeBranchForm.address,
        ...(auth.admin?.role === 'admin' ? {
          active: storeBranchForm.active,
          sort_order: Number(storeBranchForm.sort_order || 0),
        } : {}),
      };
      const existingLatitude = existing?.latitude === null || existing?.latitude === undefined ? '' : String(existing.latitude);
      const existingLongitude = existing?.longitude === null || existing?.longitude === undefined ? '' : String(existing.longitude);
      const addressChanged = Boolean(existing && storeBranchForm.address.trim() !== existing.address);
      const coordinatesChanged = storeBranchForm.latitude.trim() !== existingLatitude || storeBranchForm.longitude.trim() !== existingLongitude;
      if (!addressChanged || coordinatesChanged) {
        payload.latitude = storeBranchForm.latitude.trim() ? Number(storeBranchForm.latitude) : null;
        payload.longitude = storeBranchForm.longitude.trim() ? Number(storeBranchForm.longitude) : null;
      }

      await api('/api/admin/store-branches', {
        method: existing ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      showNotice(existing ? '门店已更新' : '门店已新增');
      resetStoreBranchForm();
      await loadStoreBranches();
    } catch (err) {
      setStoreBranchError(err instanceof Error ? err.message : '门店保存失败');
    }
  };

  const toggleStoreBranchActive = async (branch: StoreBranchRow) => {
    setStoreBranchError('');
    setError('');
    try {
      await api('/api/admin/store-branches', {
        method: 'PATCH',
        body: JSON.stringify({ id: branch.id, active: !branch.active }),
      });
      showNotice(branch.active ? '门店已停用' : '门店已启用');
      if (storeBranchForm.id === branch.id) {
        setStoreBranchForm(prev => ({ ...prev, active: !branch.active }));
      }
      await loadStoreBranches();
    } catch (err) {
      setStoreBranchError(err instanceof Error ? err.message : '门店状态更新失败');
    }
  };

  const loadOrderDetail = async (id: string) => {
    setError('');
    try {
      const payload = await api<{ success: true; order: OrderRow; items: OrderItemRow[]; changes?: OrderChangeRecord[] }>(`/api/admin/orders?id=${encodeURIComponent(id)}`);
      setSelectedOrder({ order: payload.order, items: payload.items, changes: payload.changes || [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : '订单详情加载失败');
    }
  };

		  const startCreate = () => {
		    clearPendingImage();
		    setEditorError('');
		    setDuplicateCheck(emptyDuplicateCheck);
        setOpenMenuItemActions(null);
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
        setOpenMenuItemActions(null);
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

        const displayPatch = applyMenuDisplayLabel(form.tags, getMenuDisplayLabel(form));
	      const payload = {
	        id: editingItem?.id,
	        item_code: form.item_code || null,
	        name: form.name,
	        description: form.description,
	        detail: form.detail,
	        price: Number(form.price),
	        category_id: Number(form.category_id),
	        image_url: imageUrl,
	        tags: displayPatch.tags,
	        recommended: displayPatch.recommended,
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
    setIsCategoryEditorOpen(true);
  };

  const resetCategoryForm = () => {
    setEditingCategory(null);
    setCategoryForm(emptyCategoryForm);
    setIsCategoryEditorOpen(false);
  };

  const startCreateCategory = () => {
    setEditingCategory(null);
    setCategoryForm({
      ...emptyCategoryForm,
      sort_order: String((menuCategories.at(-1)?.sort_order ?? -10) + 10),
    });
    setIsCategoryEditorOpen(true);
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

  const toggleCategoryActive = async (category: MenuCategoryRow) => {
    setError('');
    try {
      await api('/api/admin/menu-categories', {
        method: 'PATCH',
        body: JSON.stringify({ id: category.id, active: !category.active }),
      });
      showNotice(category.active ? '分类已停用' : '分类已启用');
      await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : '分类状态更新失败');
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

  const updateMenuItemSalesStatus = async (item: MenuItemRow, status: MenuSalesStatus) => {
    setError('');
    setOpenMenuItemActions(null);
    setStatusUpdatingItemId(item.id);
    const patch = menuSalesStatusPayload(status);
    try {
      const payload = await api<{ success: true; item?: Partial<MenuItemRow> }>('/api/admin/menu-items', {
        method: 'PATCH',
        body: JSON.stringify({ id: item.id, ...patch }),
      });
      const savedPatch = {
        active: payload.item?.active ?? patch.active,
        sold_out: payload.item?.sold_out ?? patch.sold_out,
      };
      setMenuItems(prev => prev.map(row => row.id === item.id ? { ...row, ...savedPatch } : row));
      showNotice(`菜品已设为${labelMenuSalesStatus(status)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '状态更新失败');
    } finally {
      setStatusUpdatingItemId(current => current === item.id ? null : current);
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

  const submitPaymentMethodChange = async () => {
    if (!selectedOrder) return;
    setError('');
    if (!paymentReceiptFile) {
      setError('请上传顾客付款截图');
      return;
    }
    if (paymentChangeReason.trim().length < 2) {
      setError('请填写修改原因');
      return;
    }

    setPaymentChangeSubmitting(true);
    try {
      const receiptImage = await buildReceiptImage(paymentReceiptFile);
      await api('/api/admin/orders', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'change_payment_method',
          id: selectedOrder.order.id,
          paymentMethod: 'tng',
          reason: paymentChangeReason.trim(),
          receiptImage,
        }),
      });
      showNotice('支付方式已更正，等待管理员审核');
      setIsOrderChangeOpen(false);
      setPaymentChangeReason('');
      setPaymentReceiptFile(null);
      await loadOrders();
      await loadOrderDetail(selectedOrder.order.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '支付方式修改失败');
    } finally {
      setPaymentChangeSubmitting(false);
    }
  };

  const reviewPaymentMethodChange = async (changeId: string, decision: 'approve' | 'reject') => {
    if (!selectedOrder) return;
    setError('');
    if (decision === 'reject' && paymentReviewReason.trim().length < 2) {
      setError('请填写拒绝原因');
      return;
    }

    setPaymentReviewSubmitting(true);
    try {
      await api('/api/admin/orders', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'review_payment_change',
          id: selectedOrder.order.id,
          changeId,
          decision,
          reason: paymentReviewReason.trim(),
        }),
      });
      showNotice(decision === 'approve' ? '付款截图已审核通过' : '付款截图已拒绝，订单恢复现金待支付');
      setPaymentReviewReason('');
      await loadOrders();
      await loadOrderDetail(selectedOrder.order.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '付款审核失败');
    } finally {
      setPaymentReviewSubmitting(false);
    }
  };

  if (!auth) {
    return (
      <div data-admin-shell className="grid min-h-screen place-items-center bg-slate-50 text-slate-950">
        <AdminLocaleTranslator language={adminLanguage} />
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div data-admin-shell className="relative min-h-screen overflow-hidden bg-[#F6F7F9] text-[#111827]">
        <AdminLocaleTranslator language={adminLanguage} />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#FAFAF8_0%,#F6F7F9_100%)]" />
        <div className="absolute inset-0 hidden opacity-[0.28] sm:block [background-image:linear-gradient(rgba(17,24,39,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(17,24,39,0.035)_1px,transparent_1px)] [background-size:56px_56px]" />
        <div className="absolute left-[-140px] top-[-180px] hidden h-[420px] w-[420px] rounded-full bg-[#E9D8B9]/[0.28] blur-3xl sm:block" />
        <div className="absolute left-1/2 top-[-170px] h-[360px] w-[520px] -translate-x-1/2 rounded-full bg-white/70 blur-3xl" />
        <div className="absolute bottom-[-240px] right-[-180px] hidden h-[520px] w-[520px] rounded-full bg-[#CBD5E1]/[0.32] blur-3xl sm:block" />
        <div className="absolute bottom-[12%] left-[8%] hidden h-[280px] w-[280px] rounded-full bg-[#C7A46A]/[0.08] blur-3xl lg:block" />

        <main className="relative mx-auto flex min-h-screen w-full items-center justify-center px-4 py-8 sm:px-6">
          <section className="relative w-full max-w-[420px]">
            <div className="absolute inset-x-[-44px] top-1/2 h-56 -translate-y-1/2 rounded-full bg-[#C7A46A]/[0.12] blur-3xl sm:inset-x-[-80px] sm:h-72" />
            <form onSubmit={submitAuth} className="relative w-full rounded-[24px] border border-[#E5E7EB]/90 bg-white p-6 shadow-[0_22px_54px_rgba(15,23,42,0.075),0_4px_18px_rgba(15,23,42,0.035)] sm:rounded-[28px] sm:p-9 lg:p-10">
              <div className="flex items-center gap-3">
                <img src="/logo/sct_logo.png" alt="Soup Can Thin" className="h-10 w-10 rounded-2xl object-contain sm:h-11 sm:w-11" />
                <div>
                  <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#111827]">SCT Admin</p>
                  <p className="mt-0.5 text-[13px] font-medium text-[#6B7280]">门店后台管理系统</p>
                </div>
              </div>

              <div className="mt-8 sm:mt-9">
                <h1 className="text-2xl font-bold tracking-normal text-[#111827] sm:text-[28px]">{setupRequired ? '创建首个管理员' : '管理员登录'}</h1>
                <p className="mt-2 text-sm leading-[22px] text-[#6B7280]">
                  {setupRequired ? '输入 setup token，创建第一个拥有后台权限的管理员账号。' : '请输入管理员账号和密码，进入门店运营控制台。'}
                </p>
              </div>

              {error && (
                <div className="mt-6 flex gap-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-3 text-[13px] font-semibold text-[#B91C1C]">
                  <AlertCircle className="mt-0.5 shrink-0" size={17} />
                  <span>{error}</span>
                </div>
              )}

              <div className="mt-7 grid gap-4">
                <AuthInput label="账号" value={username} onChange={setUsername} placeholder="请输入管理员账号" autoComplete="username" />
                {setupRequired && <AuthInput label="显示名称" value={displayName} onChange={setDisplayName} placeholder="老板 / Manager" />}
                <AuthInput label="密码" value={password} onChange={setPassword} type="password" placeholder="请输入密码" autoComplete={setupRequired ? 'new-password' : 'current-password'} />
                {setupRequired && <AuthInput label="Setup Token" value={setupToken} onChange={setSetupToken} type="password" placeholder="ADMIN_REVIEW_TOKEN" />}
              </div>

              <button type="submit" disabled={isLoading} className="mt-7 flex h-[50px] w-full items-center justify-center gap-2 rounded-[14px] border-0 bg-[#111827] px-4 text-[15px] font-semibold text-white transition duration-200 hover:-translate-y-px hover:bg-[#1F2937] hover:shadow-[0_12px_24px_rgba(17,24,39,0.16)] active:translate-y-0 active:shadow-[0_6px_14px_rgba(17,24,39,0.12)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-75 disabled:shadow-none">
                <Check size={17} />
                {setupRequired ? '创建并进入后台' : '登录后台'}
              </button>

              <p className="mt-6 text-center text-xs leading-5 text-[#9CA3AF]">仅限授权管理员访问，所有操作将记录在系统日志中。</p>
            </form>
          </section>
        </main>
      </div>
    );
  }

  if (auth.admin?.role === 'kitchen') {
    return (
      <div data-admin-shell className="h-dvh overflow-y-auto overscroll-none bg-[#F7F8FA]">
        <AdminLocaleTranslator language={adminLanguage} />
        <KitchenBoard
          api={api}
          onLogout={logout}
          onChangePassword={() => setPasswordDialogOpen(true)}
          userName={auth.admin.displayName || auth.admin.username}
          standalone
        />
        <ChangePasswordDialog open={passwordDialogOpen} api={api} onClose={() => setPasswordDialogOpen(false)} onChanged={() => showNotice('密码已修改，其他设备已退出登录')} />
      </div>
    );
  }

  return (
    <div data-admin-shell className="min-h-screen bg-[#F6F8FB] text-slate-950">
      <AdminLocaleTranslator language={adminLanguage} />
      <aside className={`fixed inset-y-0 left-0 z-30 hidden flex-col overflow-hidden border-r border-[#E5E7EB] bg-white px-4 py-4 shadow-[10px_0_30px_rgba(15,23,42,0.035)] transition-[width] duration-200 lg:flex ${sidebarCollapsed ? 'w-24' : 'w-64'}`}>
        <div className={`flex h-12 shrink-0 items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between gap-3 px-1'}`}>
          <div className={`flex items-center gap-2.5 ${sidebarCollapsed ? '' : 'min-w-0'}`}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
              <ShieldCheck size={21} />
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">SCT ADMIN</p>
                <h1 className="truncate text-[17px] font-bold text-slate-950">深夜食汤</h1>
              </div>
            )}
          </div>
          {!sidebarCollapsed && (
            <IconButton title={copy.collapseSidebar} onClick={() => setSidebarCollapsed(true)}><PanelLeftClose size={16} /></IconButton>
          )}
        </div>
        {sidebarCollapsed && (
          <button type="button" onClick={() => setSidebarCollapsed(false)} className="mt-5 flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-950" title={copy.expandSidebar} aria-label={copy.expandSidebar}>
            <PanelLeftOpen size={17} />
          </button>
        )}
        <nav className="mt-7 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
          {availableSections.some(item => item.id === 'menuItems') && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => sidebarCollapsed ? selectSection('menuItems') : setMenuNavOpen(open => !open)}
                title={sidebarCollapsed ? copy.menuManagement : undefined}
                className={`relative flex h-12 w-full items-center rounded-[14px] px-3 text-sm font-bold transition ${sidebarCollapsed ? 'justify-center' : 'gap-3'} ${section === 'menuItems' || section === 'menuCategories' ? 'bg-[#F1F5F9] text-[#111827]' : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-slate-950'}`}
              >
                {(section === 'menuItems' || section === 'menuCategories') && !sidebarCollapsed && <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-[#C7A46A]" />}
                <Soup size={18} />
                {!sidebarCollapsed && <><span className="flex-1 text-left">{copy.menuManagement}</span><ChevronDown size={15} className={`text-slate-400 transition-transform ${menuNavOpen ? 'rotate-180' : ''}`} /></>}
              </button>
              {!sidebarCollapsed && menuNavOpen && (
                <div className="ml-4 grid gap-1 border-l border-slate-200 pl-3">
                  {[
                    { id: 'menuItems' as const, label: copy.itemManagement },
                    { id: 'menuCategories' as const, label: copy.categoryManagement },
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectSection(item.id)}
                      className={`relative flex h-10 items-center rounded-xl px-3 text-[13px] font-bold transition ${section === item.id ? 'bg-[#F1F5F9] text-[#111827]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-950'}`}
                    >
                      {section === item.id && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[#C7A46A]" />}
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {availableSections.some(item => item.id === 'agents') && (
            <div className="space-y-1">
              <button type="button" onClick={() => sidebarCollapsed ? selectAgentPage('overview') : setAgentNavOpen(open => !open)} title={sidebarCollapsed ? '代理管理' : undefined} className={`relative flex h-12 w-full items-center rounded-[14px] px-3 text-sm font-bold transition ${sidebarCollapsed ? 'justify-center' : 'gap-3'} ${section === 'agents' ? 'bg-[#F1F5F9] text-[#111827]' : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-slate-950'}`}>
                {section === 'agents' && !sidebarCollapsed && <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-[#C7A46A]" />}
                <Handshake size={18} />
                {!sidebarCollapsed && <><span className="flex-1 text-left">代理管理</span><ChevronDown size={15} className={`text-slate-400 transition-transform ${agentNavOpen ? 'rotate-180' : ''}`} /></>}
              </button>
              {!sidebarCollapsed && agentNavOpen && <div className="ml-4 grid gap-1 border-l border-slate-200 pl-3">{agentAdminNavItems.map(item => <button key={item.id} type="button" onClick={() => selectAgentPage(item.id)} className={`relative flex min-h-9 items-center rounded-xl px-3 py-2 text-left text-[12px] font-bold transition ${section === 'agents' && agentPage === item.id ? 'bg-[#F1F5F9] text-[#111827]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-950'}`}>{section === 'agents' && agentPage === item.id && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[#C7A46A]" />}{item.label}</button>)}</div>}
            </div>
          )}
          {availableSections.filter(item => item.id !== 'menuItems' && item.id !== 'menuCategories' && item.id !== 'agents').map(item => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectSection(item.id)}
                title={sidebarCollapsed ? sectionLabel(item.id, adminLanguage) : undefined}
                className={`relative flex h-12 w-full items-center rounded-[14px] px-3 text-sm font-bold transition ${sidebarCollapsed ? 'justify-center' : 'gap-3'} ${active ? 'bg-[#F1F5F9] text-[#111827]' : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-slate-950'}`}
              >
                {active && !sidebarCollapsed && <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-[#C7A46A]" />}
                <Icon size={18} className={active ? 'text-[#111827]' : ''} />
                {!sidebarCollapsed && sectionLabel(item.id, adminLanguage)}
              </button>
            );
          })}
        </nav>
        <div className="mt-4 shrink-0">
          {!sidebarCollapsed && <div className="mb-2 rounded-[14px] border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2.5">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-950">{auth.admin?.displayName || auth.admin?.username}</p>
                <p className="mt-0.5 text-xs text-[#64748B]">{labelAdminRole(auth.admin?.role || 'admin')}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" onClick={() => setPasswordDialogOpen(true)} title="修改密码" className="grid h-8 w-8 place-items-center rounded-lg text-[#64748B] hover:bg-white hover:text-slate-950"><KeyRound size={15} /></button>
                <button type="button" onClick={logout} className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#64748B] hover:bg-white hover:text-slate-950">{copy.logout}</button>
              </div>
            </div>
          </div>}
          {sidebarCollapsed && <div className="grid gap-2"><button type="button" onClick={() => setPasswordDialogOpen(true)} title="修改密码" className="flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"><KeyRound size={17} /></button><button type="button" onClick={logout} title={copy.logoutAdmin} className="flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"><LogOut size={17} /></button></div>}
        </div>
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={adminLanguage === 'en' ? 'Admin navigation' : '后台导航'}>
          <button type="button" className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={() => setMobileNavOpen(false)} aria-label="关闭导航" />
          <aside className="absolute inset-y-0 left-0 flex w-[min(88vw,360px)] flex-col overflow-hidden bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-950 text-white"><ShieldCheck size={20} /></span>
                <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">SCT ADMIN</p><p className="truncate text-base font-black text-slate-950">{auth.admin?.displayName || auth.admin?.username}</p></div>
              </div>
              <button type="button" onClick={() => setMobileNavOpen(false)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600" aria-label="关闭导航"><X size={18} /></button>
            </div>
            <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
              <div className="grid gap-1.5">
                {availableSections.map(item => {
                  const Icon = item.icon;
                  const active = section === item.id;
                  if (item.id === 'menuItems') return (
                    <div key={item.id}>
                      <button type="button" onClick={() => setMenuNavOpen(open => !open)} aria-expanded={menuNavOpen} className={`flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 text-left text-sm font-bold transition ${section === 'menuItems' || section === 'menuCategories' ? 'bg-slate-100 text-slate-950' : 'text-slate-600 hover:bg-slate-50'}`}><Soup size={18} /><span className="min-w-0 flex-1 truncate">{copy.menuManagement}</span><ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${menuNavOpen ? 'rotate-180' : ''}`} /></button>
                      {menuNavOpen && <div className="ml-6 mt-1 grid gap-1 border-l border-slate-200 pl-3">
                        <button type="button" onClick={() => selectSection('menuItems')} className={`flex min-h-10 items-center rounded-xl px-3 text-left text-sm font-bold ${section === 'menuItems' ? 'bg-slate-950 text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-950'}`}>{copy.itemManagement}</button>
                        <button type="button" onClick={() => selectSection('menuCategories')} className={`flex min-h-10 items-center rounded-xl px-3 text-left text-sm font-bold ${section === 'menuCategories' ? 'bg-slate-950 text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-950'}`}>{copy.categoryManagement}</button>
                      </div>}
                    </div>
                  );
                  if (item.id === 'menuCategories') return null;
                  if (item.id === 'agents') return (
                    <div key={item.id}>
                      <button type="button" onClick={() => setAgentNavOpen(open => !open)} aria-expanded={agentNavOpen} className={`flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 text-left text-sm font-bold transition ${section === 'agents' ? 'bg-slate-100 text-slate-950' : 'text-slate-600 hover:bg-slate-50'}`}><Handshake size={18} /><span className="min-w-0 flex-1 truncate">{adminLanguage === 'en' ? 'Agent Management' : '代理管理'}</span><ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${agentNavOpen ? 'rotate-180' : ''}`} /></button>
                      {agentNavOpen && <div className="ml-6 mt-1 grid gap-1 border-l border-slate-200 pl-3">
                        {agentAdminNavItems.map(agentItem => <button key={agentItem.id} type="button" onClick={() => selectAgentPage(agentItem.id)} className={`flex min-h-10 items-center rounded-xl px-3 text-left text-sm font-bold ${section === 'agents' && agentPage === agentItem.id ? 'bg-slate-950 text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-950'}`}>{agentPageLabel(agentItem.id, adminLanguage)}</button>)}
                      </div>}
                    </div>
                  );
                  return <button key={item.id} type="button" onClick={() => selectSection(item.id)} className={`flex min-h-12 items-center gap-3 rounded-2xl px-4 text-left text-sm font-bold ${active ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><Icon size={18} /><span className="min-w-0 flex-1 truncate">{sectionLabel(item.id, adminLanguage)}</span>{active && <Check size={16} />}</button>;
                })}
              </div>
            </nav>
            <div className="grid grid-cols-2 gap-2 border-t border-slate-200 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
              <button type="button" onClick={() => { setMobileNavOpen(false); setPasswordDialogOpen(true); }} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-100 text-sm font-bold text-slate-700"><KeyRound size={17} />修改密码</button>
              <button type="button" onClick={logout} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-red-50 text-sm font-bold text-red-600"><LogOut size={17} />{copy.logout}</button>
            </div>
          </aside>
        </div>
      )}

      <main className={`flex h-dvh min-h-0 min-w-0 flex-col overflow-hidden ${sidebarCollapsed ? 'lg:pl-24' : 'lg:pl-64'}`}>
        <header data-admin-page-header className="relative z-20 shrink-0 border-b border-[#E5E7EB] bg-[#F6F8FB]/92 px-3 py-2.5 backdrop-blur-xl sm:px-6 sm:py-3 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" onClick={() => { if (section === 'menuItems' || section === 'menuCategories') setMenuNavOpen(true); if (section === 'agents') setAgentNavOpen(true); setMobileNavOpen(true); }} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden" aria-label={adminLanguage === 'en' ? 'Open navigation' : '打开后台导航'}><MenuIcon size={20} /></button>
              <div className="min-w-0 flex-1">
              <h2 className="flex min-w-0 items-center gap-2 text-lg font-bold leading-7 text-slate-950 sm:text-[22px] sm:leading-8">
                <span className="truncate">{section === 'agents' ? (adminLanguage === 'en' ? 'Agent Management' : '代理管理') : isMenuSection ? copy.menuManagement : sectionLabel(section, adminLanguage)}</span>
                {section === 'agents' && <><span className="shrink-0 text-slate-300">/</span><span className="truncate text-[#9B7B50]">{agentPageLabel(agentPage, adminLanguage)}</span></>}
                {isMenuSection && <><span className="shrink-0 text-slate-300">/</span><span className="truncate text-[#9B7B50]">{sectionLabel(section, adminLanguage)}</span></>}
              </h2>
              {section !== 'kitchen' && section !== 'delivery' && section !== 'wallet' && (
                <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                  {lastUpdatedAt[section] ? `${copy.updatedAt} ${lastUpdatedAt[section]?.toLocaleTimeString(adminLanguage === 'en' ? 'en-US' : 'zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : copy.autoSync}
                </p>
              )}
              </div>
            </div>
            {(section === 'menuItems' || section === 'menuCategories') && (
              <div className="hidden items-center gap-2 lg:flex">
                <span className="rounded-full border border-[#DDE2E8] bg-white px-3 py-1.5 text-xs font-bold text-[#334155]">共 {menuStats.total} 个菜品</span>
                <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">可售 {menuStats.active}</span>
                <span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">售罄 {menuStats.soldOut}</span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-[#64748B]">下架 {menuStats.inactive}</span>
              </div>
            )}
          </div>
        </header>

        <div ref={contentScrollRef} className={usesViewportLayout
          ? 'flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 sm:p-5 lg:p-6'
          : 'flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-none p-3 sm:p-5 lg:p-6'}>
          {notice && <div role="status" className="fixed left-1/2 top-4 z-[200] flex h-auto w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700 shadow-[0_16px_45px_rgba(15,23,42,0.16)]"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-50"><Check size={16} /></span><span className="min-w-0 flex-1 leading-5">{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="关闭通知" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={15} /></button></div>}
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              <AlertCircle className="mt-0.5 shrink-0" size={16} />
              {error}
            </div>
          )}

          {section === 'menuItems' && (
            <section className="flex min-h-0 min-w-0 flex-1">
                <div className="flex min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-[20px] border border-[#E5E7EB] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
                  <div className="grid shrink-0 gap-3 border-b border-[#E5E7EB] bg-white p-4 lg:grid-cols-[minmax(320px,1fr)_170px_150px] lg:items-center xl:grid-cols-[minmax(360px,1fr)_180px_160px_auto]">
                    <div className="relative min-w-0">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                      <input value={menuSearch} onChange={event => setMenuSearch(event.target.value)} onKeyDown={event => event.key === 'Enter' && loadMenuItems()} className="h-11 w-full rounded-xl border border-[#DDE2E8] bg-[#F8FAFC] pl-10 pr-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#C7A46A] focus:bg-white focus:shadow-[0_0_0_3px_rgba(199,164,106,0.14)]" placeholder="搜索菜名、编码、英文名" />
                    </div>
                    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-2 lg:contents">
                      <select aria-label="菜品分类" value={menuCategoryFilter} onChange={event => setMenuCategoryFilter(event.target.value)} className="h-11 min-w-0 rounded-xl border border-[#DDE2E8] bg-[#F8FAFC] px-2 text-sm font-bold text-[#334155] outline-none transition focus:border-[#C7A46A] focus:bg-white focus:shadow-[0_0_0_3px_rgba(199,164,106,0.14)] sm:px-3">
                        <option value="all">全部分类</option>
                        {menuCategories.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}
                      </select>
                      <select aria-label="销售状态" value={menuStatusFilter} onChange={event => setMenuStatusFilter(event.target.value)} className="h-11 min-w-0 rounded-xl border border-[#DDE2E8] bg-[#F8FAFC] px-2 text-sm font-bold text-[#334155] outline-none transition focus:border-[#C7A46A] focus:bg-white focus:shadow-[0_0_0_3px_rgba(199,164,106,0.14)] sm:px-3">
                        <option value="all">全部状态</option>
                        <option value="active">可售</option>
                        <option value="sold_out">售罄</option>
                        <option value="inactive">下架</option>
                      </select>
                      <div className="flex min-w-0 justify-end lg:col-span-3 xl:col-span-1">
                        <button type="button" onClick={startCreate} title="新增菜品" aria-label="新增菜品" className="flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-bold text-white transition lg:w-auto lg:min-w-[128px] lg:px-5">
                          <Plus size={17} />
                          <span className="hidden lg:inline">新增菜品</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="hidden min-h-0 flex-1 overflow-x-auto md:block">
                    <div data-scroll-stable className="h-full min-w-[1160px] overflow-y-auto">
                      <table className="w-full table-fixed border-collapse text-sm">
                        <colgroup>
                          <col className="w-[9%]" />
                          <col className="w-[36%]" />
                          <col className="w-[12%]" />
                          <col className="w-[11%]" />
                          <col className="w-[10%]" />
                          <col className="w-[8%]" />
                          <col className="w-[14%]" />
                        </colgroup>
                        <thead className="sticky top-0 z-[8] bg-[#F8FAFC] text-[13px] text-[#64748B] shadow-[inset_0_-1px_0_#E5E7EB]">
                          <tr>
                            <th className="px-4 py-3 text-center font-semibold">编码</th>
                            <th className="px-5 py-3 text-left font-semibold">菜品</th>
                            <th className="px-4 py-3 text-center font-semibold">分类</th>
                            <th className="px-4 py-3 text-center font-semibold">价格</th>
                            <th className="px-4 py-3 text-center font-semibold">状态</th>
                            <th className="px-4 py-3 text-center font-semibold">展示标签</th>
                            <th className="px-4 py-3 text-center font-semibold">操作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EEF2F7]">
                          {filteredMenuItems.map(item => (
                            <tr key={item.id} className="h-20 transition hover:bg-[#F9FAFB]">
                              <td className="px-4 py-3 text-center align-middle">
                                <span className="inline-flex rounded-full border border-[#DDE2E8] bg-white px-3 py-1 text-xs font-bold text-[#334155]">{item.item_code || '-'}</span>
                              </td>
                              <td className="px-5 py-3 align-middle">
                                <div className="flex min-w-0 items-center gap-3">
                                  <img src={item.image_url} alt={item.name} className="h-14 w-14 shrink-0 rounded-[14px] bg-slate-100 object-cover" />
                                  <div className="min-w-0 text-left">
                                    <p className="truncate text-[15px] font-semibold leading-5 text-[#111827]">{item.name}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center align-middle">
                                <span className="inline-flex rounded-full bg-[#F1F5F9] px-3 py-1 text-xs font-bold text-[#475569]">{item.category}</span>
                              </td>
                              <td className="px-4 py-3 text-center align-middle text-sm font-bold text-[#111827]">RM {Number(item.price).toFixed(2)}</td>
                              <td className="px-4 py-3 text-center align-middle">
                                <MenuItemStatusBadge item={item} />
                              </td>
                              <td className="px-4 py-3 text-center align-middle">
                                <MenuItemDisplayBadge item={item} />
                              </td>
                              <td className="px-4 py-3 text-center align-middle">
                                <MenuItemActions
                                  item={item}
                                  open={openMenuItemActions === item.id}
                                  onToggle={() => setOpenMenuItemActions(current => current === item.id ? null : item.id)}
                                  onQuickStatus={(status) => updateMenuItemSalesStatus(item, status)}
                                  onEdit={() => startEdit(item)}
                                  onMoveUp={() => moveMenuItem(item, 'move-up')}
                                  onMoveDown={() => moveMenuItem(item, 'move-down')}
                                  onDelete={() => deleteMenuItem(item)}
                                  canMoveUp={canMoveMenuItem(item, 'move-up')}
                                  canMoveDown={canMoveMenuItem(item, 'move-down')}
                                  statusUpdating={statusUpdatingItemId === item.id}
                                  onClose={() => setOpenMenuItemActions(null)}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div data-scroll-stable className="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto bg-[#F8FAFC] p-2 md:hidden">
                    {filteredMenuItems.map(item => (
                      <React.Fragment key={item.id}>
                        <MenuItemMobileCard
                          item={item}
                          open={openMenuItemActions === item.id}
                          onToggle={() => setOpenMenuItemActions(current => current === item.id ? null : item.id)}
                          onQuickStatus={(status) => updateMenuItemSalesStatus(item, status)}
                          onEdit={() => startEdit(item)}
                          onMoveUp={() => moveMenuItem(item, 'move-up')}
                          onMoveDown={() => moveMenuItem(item, 'move-down')}
                          onDelete={() => deleteMenuItem(item)}
                          canMoveUp={canMoveMenuItem(item, 'move-up')}
                          canMoveDown={canMoveMenuItem(item, 'move-down')}
                          statusUpdating={statusUpdatingItemId === item.id}
                          onClose={() => setOpenMenuItemActions(null)}
                        />
                      </React.Fragment>
                    ))}
                  </div>
                </div>
            </section>
          )}
          {section === 'menuCategories' && (
            <section className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
                <CategoryManager
                  categories={menuCategories}
                  form={categoryForm}
                  setForm={setCategoryForm}
                  editingCategory={editingCategory}
                  editorOpen={isCategoryEditorOpen}
                  onSubmit={saveCategory}
                  onCreate={startCreateCategory}
                  onEdit={startEditCategory}
                  onToggleActive={toggleCategoryActive}
                  onDelete={deleteCategory}
                  onCancel={resetCategoryForm}
                />
            </section>
          )}

          {section === 'orders' && (
            <Panel className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex shrink-0 flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap gap-2">
                  {orderStatusOptions.map(item => (
                    <button key={item.value} type="button" onClick={() => setOrderStatus(item.value)} className={`rounded-full px-3 py-2 text-xs font-bold ${orderStatus === item.value ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-950'}`}>
                      {item.label}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => void loadOrders()} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 hover:border-slate-300">
                  <RefreshCw size={17} />
                  刷新
                </button>
              </div>
              <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto overscroll-none">
                {orders.map(order => (
                  <div key={order.id} className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center">
                    <button type="button" onClick={() => loadOrderDetail(order.id)} className="min-w-0 text-left">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-950">{order.order_no}</span>
                        <Badge tone={toneForOrder(order.status)}>{labelOrderStatus(order.status)}</Badge>
                        <Badge tone="muted">{labelPayment(order.payment_method)}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{order.customer_name} · {order.customer_phone} · {order.order_type === 'dinein' ? `桌号 ${order.table_no || '-'}` : order.delivery_address}</p>
                      {order.order_type === 'takeaway' && (
                        <p className="mt-1 text-xs font-bold text-blue-600">
                          {order.assigned_branch_name || '未分配门店'}
                          {formatDeliveryMeta(order)}
                        </p>
                      )}
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

          {section === 'customerOrder' && (
            <CustomerOrderManager
              customers={customers}
              customerSearch={customerSearch}
              setCustomerSearch={setCustomerSearch}
              selectedCustomer={selectedCustomer}
              setSelectedCustomer={setSelectedCustomer}
              customerForm={customerForm}
              setCustomerForm={setCustomerForm}
              orderForm={customerOrderForm}
              setOrderForm={setCustomerOrderForm}
              menuItems={customerOrderMenuItems}
              branches={storeBranches.filter(branch => branch.active)}
              error={customerOrderError}
              submitting={customerOrderSubmitting}
              deliveryPreview={deliveryPreview}
              deliveryPreviewLoading={deliveryPreviewLoading}
              onSearch={loadCustomers}
              onCreateCustomer={createCustomer}
              onRefreshMenu={loadCustomerOrderMenu}
              onAddLine={addCustomerOrderLine}
              onUpdateLine={updateCustomerOrderLine}
              onRemoveLine={removeCustomerOrderLine}
              onLoadDeliveryPreview={loadDeliveryPreview}
              onSubmit={submitCustomerOrder}
            />
          )}

          {section === 'users' && auth.admin && (
            <UserManagement api={api} adminRole={auth.admin.role} onNotice={showNotice} />
          )}

          {section === 'kitchen' && (
            <KitchenBoard
              api={api}
              onLogout={logout}
              onChangePassword={() => setPasswordDialogOpen(true)}
              userName={auth.admin?.displayName || auth.admin?.username || '管理员'}
            />
          )}

          {section === 'delivery' && <DeliveryBoard api={api} />}

          {section === 'finance' && auth.admin && (
            <FinanceCenter api={api} admin={auth.admin} onNotice={showNotice} />
          )}

          {section === 'coupons' && auth.admin && (
            <CouponCenter api={api} admin={auth.admin} onNotice={showNotice} />
          )}

          {section === 'agents' && auth.admin && (
            <AgentCenter adminRole={auth.admin.role} onNotice={showNotice} page={agentPage} />
          )}

          {section === 'storeBranches' && (
            <StoreBranchManager
              canAdminister={auth.admin?.role === 'admin'}
              branches={storeBranches}
              form={storeBranchForm}
              setForm={setStoreBranchForm}
              error={storeBranchError}
              editorOpen={isStoreBranchEditorOpen}
              onSubmit={saveStoreBranch}
              onCreate={startCreateStoreBranch}
              onEdit={startEditStoreBranch}
              onToggleActive={toggleStoreBranchActive}
              onCancel={resetStoreBranchForm}
            />
          )}

          {section === 'accounts' && (
            <AccountManager
              accounts={accounts}
              branches={storeBranches}
              form={accountForm}
              setForm={setAccountForm}
              error={accountError}
              editorOpen={isAccountEditorOpen}
              onSubmit={saveAccount}
              onCreate={startCreateAccount}
              onEdit={startEditAccount}
              onToggleActive={toggleAccountActive}
              onDelete={deleteAccount}
              onCancel={resetAccountForm}
            />
          )}

          {section === 'auditLogs' && auth.admin?.role === 'admin' && <AuditLogCenter api={api} />}

          {section === 'systemSettings' && (
            <SystemSettings
              adminRole={auth.admin?.role || 'admin'}
              language={adminLanguage}
              copy={copy}
              onLanguageChange={changeAdminLanguage}
              api={api}
            />
          )}

          {section === 'wallet' && (
            <Panel className="p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <WalletCards size={24} />
              </div>
              <h3 className="mt-5 text-2xl font-bold">充值审核</h3>
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
              <div className="flex items-center gap-2">
                {selectedOrder.order.order_source === 'admin_created' && (
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentChangeReason('');
                      setPaymentReceiptFile(null);
                      setIsOrderChangeOpen(true);
                    }}
                    className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
                  >
                    <Pencil size={16} />
                    修改订单
                  </button>
                )}
                <IconButton title="关闭" onClick={() => { setSelectedOrder(null); setIsOrderChangeOpen(false); }}><X size={18} /></IconButton>
              </div>
            </div>
            <div className="space-y-5 p-5">
              <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_16px_42px_rgba(15,23,42,0.08)]">
                <div className="border-b border-slate-100 bg-slate-950 px-5 py-4 text-white">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">Soup Can Thin</p>
                      <h4 className="mt-1 text-2xl font-black tracking-normal">{selectedOrder.order.order_no}</h4>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-300">订单状态</p>
                      <p className="mt-1 text-base font-black">{labelOrderStatus(selectedOrder.order.status)}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs font-semibold text-slate-300">{formatDateTime(selectedOrder.order.created_at)}</p>
                </div>

                <div className="grid gap-4 p-5">
                  <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm">
                    <ReceiptRow label="顾客" value={selectedOrder.order.customer_name} />
                    <ReceiptRow label="电话" value={selectedOrder.order.customer_phone} />
                    <ReceiptRow
                      label={selectedOrder.order.order_type === 'dinein' ? '堂食桌号' : '配送地址'}
                      value={selectedOrder.order.order_type === 'dinein' ? selectedOrder.order.table_no || '-' : selectedOrder.order.delivery_address || '-'}
                    />
                    <ReceiptRow label="门店" value={selectedOrder.order.assigned_branch_name || '-'} />
                    {selectedOrder.order.order_type === 'takeaway' && (
                      <ReceiptRow label="配送" value={`${formatNumber(selectedOrder.order.delivery_distance_km, 2)} km · 约 ${formatNumber(selectedOrder.order.delivery_duration_min, 0)} 分钟`} />
                    )}
                  </div>

                  <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100">
                    {selectedOrder.items.map(item => (
                      <div key={`receipt-${item.id || item.name}`} className="flex justify-between gap-4 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-950">{item.name}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">x{item.quantity} · RM {Number(item.unit_price).toFixed(2)}</p>
                          {Array.isArray(item.selected_options) && item.selected_options.length > 0 && (
                            <p className="mt-1 text-xs font-semibold text-slate-500">{formatOrderItemOptions(item.selected_options)}</p>
                          )}
                          {item.item_note && <p className="mt-1 text-xs font-semibold text-amber-700">{item.item_note}</p>}
                        </div>
                        <p className="shrink-0 text-sm font-black text-slate-950">RM {Number(item.line_total).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-2 rounded-2xl bg-slate-50 p-4 text-sm">
                    <ReceiptRow label="小计" value={`RM ${Number(selectedOrder.order.subtotal ?? selectedOrder.order.total ?? 0).toFixed(2)}`} />
                    {Number(selectedOrder.order.delivery_fee || 0) > 0 && <ReceiptRow label="配送费" value={`RM ${Number(selectedOrder.order.delivery_fee || 0).toFixed(2)}`} />}
                    {Number(selectedOrder.order.discount_amount || 0) > 0 && <ReceiptRow label="优惠" value={`-RM ${Number(selectedOrder.order.discount_amount || 0).toFixed(2)}`} />}
                    <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-3">
                      <span className="text-base font-black text-slate-950">应付总额</span>
                      <span className="text-2xl font-black text-slate-950">RM {Number(selectedOrder.order.payable_total ?? selectedOrder.order.total).toFixed(2)}</span>
                    </div>
                    <ReceiptRow label="支付方式" value={labelPayment(selectedOrder.order.payment_method)} />
                    <ReceiptRow label="支付状态" value={labelPaymentStatus(selectedOrder.order.payment_status)} />
                  </div>

                  {selectedOrder.order.note && (
                    <p className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-800">{selectedOrder.order.note}</p>
                  )}
                </div>
              </section>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={toneForOrder(selectedOrder.order.status)}>{labelOrderStatus(selectedOrder.order.status)}</Badge>
                  <Badge tone="muted">{labelOrderType(selectedOrder.order.order_type)}</Badge>
                  <Badge tone={selectedOrder.order.order_source === 'admin_created' ? 'blue' : 'muted'}>{labelOrderSource(selectedOrder.order.order_source)}</Badge>
                </div>
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <DetailItem label="下单时间" value={formatDateTime(selectedOrder.order.created_at)} />
                  <DetailItem label="最近操作" value={selectedOrder.order.last_status_changed_at ? `${selectedOrder.order.last_operator_name || '后台'} · ${formatDateTime(selectedOrder.order.last_status_changed_at)}` : '-'} />
                  <DetailItem label="订单编号" value={selectedOrder.order.order_no} />
                  <DetailItem label="用户 ID" value={selectedOrder.order.user_id || '-'} />
                </div>
              </div>

              <DetailSection title="顾客信息">
                <DetailGrid>
                  <DetailItem label="姓名" value={selectedOrder.order.customer_name} />
                  <DetailItem label="电话" value={selectedOrder.order.customer_phone} />
                  <DetailItem label={selectedOrder.order.order_type === 'dinein' ? '桌号' : '配送地址'} value={selectedOrder.order.order_type === 'dinein' ? selectedOrder.order.table_no || '-' : selectedOrder.order.delivery_address || '-'} wide={selectedOrder.order.order_type === 'takeaway'} />
                  <DetailItem label="分配门店" value={selectedOrder.order.assigned_branch_name || '-'} />
                </DetailGrid>
              </DetailSection>

              {selectedOrder.order.order_type === 'takeaway' && (
                <DetailSection title="配送信息">
                  <DetailGrid>
                    <DetailItem label="距离" value={`${formatNumber(selectedOrder.order.delivery_distance_km, 2)} km`} />
                    <DetailItem label="预计时间" value={`${formatNumber(selectedOrder.order.delivery_duration_min, 0)} 分钟`} />
                    <DetailItem label="报价来源" value={selectedOrder.order.delivery_quote_provider || '-'} />
                    <DetailItem label="配送费" value={`RM ${Number(selectedOrder.order.delivery_fee || 0).toFixed(2)}`} />
                  </DetailGrid>
                </DetailSection>
              )}

              <DetailSection title="支付与金额">
                <DetailGrid>
                  <DetailItem label="支付方式" value={labelPayment(selectedOrder.order.payment_method)} />
                  <DetailItem label="支付状态" value={labelPaymentStatus(selectedOrder.order.payment_status)} />
                  <DetailItem label="审核状态" value={labelPaymentReviewStatus(selectedOrder.order.payment_review_status)} />
                  <DetailItem label="通知状态" value={selectedOrder.order.notification_status || '-'} />
                  <DetailItem label="小计" value={`RM ${Number(selectedOrder.order.subtotal ?? selectedOrder.order.total ?? 0).toFixed(2)}`} />
                  <DetailItem label="服务费" value={`RM ${Number(selectedOrder.order.service_charge || 0).toFixed(2)}`} />
                  <DetailItem label="优惠" value={`RM ${Number(selectedOrder.order.discount_amount || 0).toFixed(2)}`} />
                  <DetailItem label="应付总额" value={`RM ${Number(selectedOrder.order.payable_total ?? selectedOrder.order.total).toFixed(2)}`} />
                </DetailGrid>
              </DetailSection>

              <div>
                <label className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">订单状态</label>
                <select value={selectedOrder.order.status} onChange={event => updateOrderStatus(selectedOrder.order.id, event.target.value as OrderStatus)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-950 outline-none focus:border-blue-500">
                  {orderStatusOptions.filter(item => item.value !== 'all' && canSelectOrderStatus(auth.admin?.role || 'admin', selectedOrder.order.status, item.value, selectedOrder.order.order_type)).map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>

              <DetailSection title="菜品明细">
                <div className="rounded-2xl border border-slate-200">
                {selectedOrder.items.map(item => (
                  <div key={item.id || item.name} className="flex justify-between gap-4 border-b border-slate-100 p-4 last:border-b-0">
                    <div>
                      <p className="font-bold text-slate-950">{item.item_code ? `${item.item_code} · ` : ''}{item.name}</p>
                      <p className="mt-1 text-xs text-slate-500">x{item.quantity} · RM {Number(item.unit_price).toFixed(2)}</p>
                      {Array.isArray(item.selected_options) && item.selected_options.length > 0 && (
                        <p className="mt-1 text-xs text-slate-500">{formatOrderItemOptions(item.selected_options)}</p>
                      )}
                      {item.item_note && <p className="mt-1 text-xs text-slate-500">{item.item_note}</p>}
                    </div>
                    <p className="font-bold text-slate-950">RM {Number(item.line_total).toFixed(2)}</p>
                  </div>
                ))}
                </div>
              </DetailSection>

              {selectedOrder.order.note && (
                <DetailSection title="订单备注">
                  <p className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">{selectedOrder.order.note}</p>
                </DetailSection>
              )}

              {selectedOrder.order.receipt_url && (
                <a href={selectedOrder.order.receipt_url} target="_blank" rel="noreferrer" className="block rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-bold text-slate-700 hover:border-slate-400">
                  查看付款截图
                </a>
              )}

              <DetailSection title="修改记录">
                {selectedOrder.changes.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm font-semibold text-slate-400">暂无修改记录</p>
                ) : (
                  <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
                    {selectedOrder.changes.map(change => {
                      const hasReview = selectedOrder.changes.some(item => item.related_event_id === change.id);
                      const receiptUrl = stringFromChangeData(change.after_data, 'receipt_url');
                      const isPendingSubmission = change.action === 'submitted'
                        && !hasReview
                        && selectedOrder.order.payment_review_status === 'pending';
                      return (
                        <div key={change.id} className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-black text-slate-950">{labelOrderChangeAction(change.action)}</p>
                              <p className="mt-1 text-xs font-semibold text-slate-500">{change.operator_name} · {formatDateTime(change.created_at)}</p>
                            </div>
                            <Badge tone={change.action === 'approved' ? 'green' : change.action === 'rejected' ? 'red' : 'orange'}>
                              {change.action === 'submitted' ? '待审核' : change.action === 'approved' ? '已通过' : '已拒绝'}
                            </Badge>
                          </div>
                          <p className="mt-3 text-sm font-semibold text-slate-700">
                            {labelPayment(stringFromChangeData(change.before_data, 'payment_method'))}
                            {' → '}
                            {labelPayment(stringFromChangeData(change.after_data, 'payment_method'))}
                          </p>
                          {change.reason && <p className="mt-2 text-sm leading-6 text-slate-600">原因：{change.reason}</p>}
                          {receiptUrl && (
                            <a href={receiptUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-bold text-blue-600 hover:text-blue-500">查看本次付款截图</a>
                          )}
                          {isPendingSubmission && (auth.admin?.role === 'admin' || auth.admin?.role === 'customer_service') && (
                            <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-3">
                              <textarea
                                value={paymentReviewReason}
                                onChange={event => setPaymentReviewReason(event.target.value)}
                                rows={2}
                                placeholder="拒绝时填写原因"
                                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <button type="button" disabled={paymentReviewSubmitting} onClick={() => reviewPaymentMethodChange(change.id, 'reject')} className="h-10 rounded-xl border border-red-200 bg-white text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50">拒绝</button>
                                <button type="button" disabled={paymentReviewSubmitting} onClick={() => reviewPaymentMethodChange(change.id, 'approve')} className="h-10 rounded-xl bg-emerald-600 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50">通过</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </DetailSection>
            </div>
          </aside>
        </div>
      )}

      {selectedOrder && isOrderChangeOpen && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <section className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase text-slate-400">{selectedOrder.order.order_no}</p>
                <h3 className="mt-1 text-xl font-black text-slate-950">修改订单</h3>
              </div>
              <IconButton title="关闭" onClick={() => setIsOrderChangeOpen(false)}><X size={18} /></IconButton>
            </div>
            <div className="grid gap-4 p-5">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-black text-slate-950">支付方式</p>
                <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm font-bold">
                  <span className="rounded-lg bg-slate-100 px-3 py-2 text-center text-slate-700">{labelPayment(selectedOrder.order.payment_method)}</span>
                  <ChevronRight size={16} className="text-slate-400" />
                  <span className="rounded-lg bg-blue-50 px-3 py-2 text-center text-blue-700">Touch 'n Go</span>
                </div>
              </div>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">修改原因</span>
                <textarea value={paymentChangeReason} onChange={event => setPaymentChangeReason(event.target.value)} rows={3} placeholder="例如：顾客实际使用转账付款" className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-500" />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-700">付款截图</span>
                <span className="mt-2 flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 text-sm font-bold text-slate-600 transition hover:border-blue-400 hover:text-blue-600">
                  <Upload size={16} />
                  <span className="min-w-0 truncate">{paymentReceiptFile?.name || '选择 JPG 或 PNG 图片'}</span>
                  <input type="file" accept="image/jpeg,image/png" className="sr-only" onChange={event => setPaymentReceiptFile(event.target.files?.[0] || null)} />
                </span>
              </label>

              {!canSubmitPaymentChange(selectedOrder.order) && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">当前付款状态不可修改</p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setIsOrderChangeOpen(false)} className="h-11 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50">取消</button>
                <button type="button" disabled={!canSubmitPaymentChange(selectedOrder.order) || paymentChangeSubmitting} onClick={submitPaymentMethodChange} className="h-11 rounded-xl bg-blue-600 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
                  {paymentChangeSubmitting ? '提交中' : '提交修改'}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {isLoading && <div className="fixed bottom-5 right-5 rounded-full bg-slate-950 px-4 py-2 text-xs font-bold text-white shadow-xl">加载中</div>}
      <ChangePasswordDialog open={passwordDialogOpen} api={api} onClose={() => setPasswordDialogOpen(false)} onChanged={() => showNotice('密码已修改，其他设备已退出登录')} />
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
      <span className="block text-[13px] font-medium text-[#374151]">{label}</span>
      <input value={value} onChange={event => onChange(event.target.value)} type={type} placeholder={placeholder} autoComplete={autoComplete} className="mt-2 h-12 w-full rounded-[14px] border border-[#DDE2E8] bg-[#F9FAFB] px-4 text-[15px] font-medium text-[#111827] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#C7A46A] focus:bg-white focus:shadow-[0_0_0_4px_rgba(199,164,106,0.15)]" />
    </label>
  );
}

function formatDeliveryMeta(order: OrderRow) {
  const distance = Number(order.delivery_distance_km || 0);
  const duration = Number(order.delivery_duration_min || 0);
  const parts = [
    Number.isFinite(distance) && distance > 0 ? `${distance.toFixed(2)} km` : '',
    Number.isFinite(duration) && duration > 0 ? `${duration.toFixed(0)} 分钟` : '',
  ].filter(Boolean);
  return parts.length ? ` · ${parts.join(' · ')}` : '';
}

function formatNumber(value: number | null | undefined, digits: number) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue.toFixed(digits) : '-';
}

function formatCoordinates(branch: Pick<StoreBranchRow, 'latitude' | 'longitude'>) {
  const latitude = Number(branch.latitude);
  const longitude = Number(branch.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return '待自动解析';
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
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

function getMenuSalesStatus(item: Pick<MenuItemRow, 'active' | 'sold_out'>): MenuSalesStatus {
  if (item.active === false) return 'inactive';
  return item.sold_out ? 'sold_out' : 'active';
}

function menuSalesStatusPayload(status: MenuSalesStatus): Pick<MenuFormState, 'active' | 'sold_out'> {
  return {
    active: status !== 'inactive',
    sold_out: status === 'sold_out',
  };
}

function labelMenuSalesStatus(status: MenuSalesStatus) {
  return {
    active: '可售',
    sold_out: '售罄',
    inactive: '下架',
  }[status];
}

function getMenuDisplayLabel(item: Pick<MenuItemRow, 'recommended' | 'tags'> | Pick<MenuFormState, 'recommended' | 'tags'>): MenuDisplayLabel {
  if (item.recommended) return 'recommended';
  const match = menuDisplayLabelOptions.find(option => option.tag && item.tags?.includes(option.tag));
  return match?.value || 'none';
}

function labelMenuDisplayLabel(value: MenuDisplayLabel) {
  return menuDisplayLabelOptions.find(option => option.value === value)?.label || '';
}

function applyMenuDisplayLabel(tags: string[], value: MenuDisplayLabel) {
  const option = menuDisplayLabelOptions.find(item => item.value === value);
  const propertyTags = tags.filter(tag => !menuDisplayTags.includes(tag));
  return {
    recommended: value === 'recommended',
    tags: option?.tag ? [...propertyTags, option.tag] : propertyTags,
  };
}

function propertyMenuTags(tags: string[]) {
  return tags.filter(tag => !menuDisplayTags.includes(tag));
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
        <div>
          <span className="text-xs font-bold text-slate-500">展示标签</span>
          <div className="mt-1.5 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {menuDisplayLabelOptions.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  const patch = applyMenuDisplayLabel(form.tags, option.value);
                  setForm(prev => ({ ...prev, ...patch }));
                }}
                className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition ${getMenuDisplayLabel(form) === option.value ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-white hover:text-slate-950'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <TagEditor
          label="菜品属性标签"
          tags={propertyMenuTags(form.tags)}
          onChange={tags => setForm(prev => ({ ...prev, tags: [...propertyMenuTags(tags), ...prev.tags.filter(tag => menuDisplayTags.includes(tag))] }))}
          placeholder="输入菜品属性后回车"
        />
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
        <div className="grid gap-3 pt-1">
          <div>
            <span className="text-xs font-bold text-slate-500">销售状态</span>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {(['active', 'sold_out', 'inactive'] as MenuSalesStatus[]).map(status => (
                <button
                  key={status}
                  type="button"
                  onClick={() => {
                    const patch = menuSalesStatusPayload(status);
                    setForm(prev => ({ ...prev, ...patch }));
                  }}
                  className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition ${getMenuSalesStatus(form) === status ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-white hover:text-slate-950'}`}
                >
                  {labelMenuSalesStatus(status)}
                </button>
              ))}
            </div>
          </div>
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
        <TagEditor label={`${labelTranslationLanguage(activeLang)}菜品属性标签`} tags={current.tags} onChange={tags => onUpdateTranslation(activeLang, { tags })} placeholder="输入译文属性后回车" />

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

function MenuItemStatusBadge({ item }: { item: Pick<MenuItemRow, 'active' | 'sold_out'> }) {
  const status = getMenuSalesStatus(item);
  const tone: 'green' | 'orange' | 'muted' = status === 'active' ? 'green' : status === 'sold_out' ? 'orange' : 'muted';
  return <Badge tone={tone}>{labelMenuSalesStatus(status)}</Badge>;
}

function MenuItemDisplayBadge({ item }: { item: Pick<MenuItemRow, 'recommended' | 'tags'> }) {
  const displayLabel = getMenuDisplayLabel(item);
  if (displayLabel === 'none') return null;
  return <Badge tone={displayLabel === 'recommended' ? 'blue' : 'orange'}>{labelMenuDisplayLabel(displayLabel)}</Badge>;
}

function MenuItemActions({ item, open, onToggle, onQuickStatus, onEdit, onMoveUp, onMoveDown, onDelete, canMoveUp, canMoveDown, statusUpdating, onClose }: {
  item: MenuItemRow;
  open: boolean;
  onToggle: () => void;
  onQuickStatus: (status: MenuSalesStatus) => void;
  onEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  statusUpdating: boolean;
  onClose: () => void;
}) {
  const actionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (actionRef.current?.contains(event.target as Node)) return;
      onClose();
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [open, onClose]);

  const run = (action: () => void) => {
    onClose();
    action();
  };
  const currentStatus = getMenuSalesStatus(item);

  return (
    <div ref={actionRef} className="relative flex justify-center gap-1.5">
      <IconButton title={`编辑 ${item.name}`} onClick={() => run(onEdit)}><Pencil size={16} /></IconButton>
      <IconButton title={`更多操作 ${item.name}`} onClick={open ? onClose : onToggle}><MoreHorizontal size={17} /></IconButton>
      {open && (
        <div className="absolute right-0 top-11 z-20 w-36 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white py-1 text-left shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
          {(['active', 'sold_out', 'inactive'] as MenuSalesStatus[]).map(status => (
            <React.Fragment key={status}>
              <ActionMenuButton
                disabled={statusUpdating || currentStatus === status}
                onClick={() => run(() => onQuickStatus(status))}
              >
                <Check size={15} className={currentStatus === status ? 'opacity-100' : 'opacity-0'} />
                {statusUpdating ? '更新中' : labelMenuSalesStatus(status)}
              </ActionMenuButton>
            </React.Fragment>
          ))}
          <div className="my-1 h-px bg-slate-100" />
          <ActionMenuButton disabled={!canMoveUp} onClick={() => run(onMoveUp)}>
            <ArrowUp size={15} />
            上移
          </ActionMenuButton>
          <ActionMenuButton disabled={!canMoveDown} onClick={() => run(onMoveDown)}>
            <ArrowDown size={15} />
            下移
          </ActionMenuButton>
          <ActionMenuButton danger onClick={() => run(onDelete)}>
            <Trash2 size={15} />
            删除
          </ActionMenuButton>
        </div>
      )}
    </div>
  );
}

function ActionMenuButton({ children, onClick, disabled = false, danger = false }: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onPointerDown={event => {
        event.preventDefault();
        event.stopPropagation();
        if (!disabled) onClick();
      }}
      disabled={disabled}
      className={`flex w-full items-center gap-2 px-3 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-35 ${danger ? 'text-red-600 hover:bg-red-50' : 'text-[#475569] hover:bg-[#F8FAFC] hover:text-[#111827]'}`}
    >
      {children}
    </button>
  );
}

function MenuItemMobileCard({ item, open, onToggle, onQuickStatus, onEdit, onMoveUp, onMoveDown, onDelete, canMoveUp, canMoveDown, statusUpdating, onClose }: {
  item: MenuItemRow;
  open: boolean;
  onToggle: () => void;
  onQuickStatus: (status: MenuSalesStatus) => void;
  onEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  statusUpdating: boolean;
  onClose: () => void;
}) {
  return (
    <article className="w-full min-w-0 rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-sm">
      <div className="flex gap-3">
        <img src={item.image_url} alt={item.name} className="h-16 w-16 shrink-0 rounded-[14px] bg-slate-100 object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-semibold leading-5 text-[#111827]">{item.name}</h3>
            </div>
            <p className="shrink-0 text-sm font-bold text-[#111827]">RM {Number(item.price).toFixed(2)}</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex rounded-full border border-[#DDE2E8] bg-white px-2.5 py-1 text-xs font-bold text-[#334155]">{item.item_code || '-'}</span>
            <span className="inline-flex rounded-full bg-[#F1F5F9] px-2.5 py-1 text-xs font-bold text-[#475569]">{item.category}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <MenuItemStatusBadge item={item} />
          <MenuItemDisplayBadge item={item} />
        </div>
        <MenuItemActions
          item={item}
          open={open}
          onToggle={onToggle}
          onQuickStatus={onQuickStatus}
          onEdit={onEdit}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onDelete={onDelete}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          statusUpdating={statusUpdating}
          onClose={onClose}
        />
      </div>
    </article>
  );
}

function CustomerOrderManager({ customers, customerSearch, setCustomerSearch, selectedCustomer, setSelectedCustomer, customerForm, setCustomerForm, orderForm, setOrderForm, menuItems, branches, error, submitting, deliveryPreview, deliveryPreviewLoading, onSearch, onCreateCustomer, onRefreshMenu, onAddLine, onUpdateLine, onRemoveLine, onLoadDeliveryPreview, onSubmit }: {
  customers: CustomerRow[];
  customerSearch: string;
  setCustomerSearch: (value: string) => void;
  selectedCustomer: CustomerRow | null;
  setSelectedCustomer: (customer: CustomerRow | null) => void;
  customerForm: CustomerFormState;
  setCustomerForm: React.Dispatch<React.SetStateAction<CustomerFormState>>;
  orderForm: CustomerOrderFormState;
  setOrderForm: React.Dispatch<React.SetStateAction<CustomerOrderFormState>>;
  menuItems: OrderMenuItem[];
  branches: StoreBranchRow[];
  error: string;
  submitting: boolean;
  deliveryPreview: { deliveryFee: number; distanceKm: number; durationMin: number } | null;
  deliveryPreviewLoading: boolean;
  onSearch: () => void;
  onCreateCustomer: (event: React.FormEvent) => void;
  onRefreshMenu: () => void;
  onAddLine: (menuItemId?: string) => void;
  onUpdateLine: (lineId: string, patch: Partial<CustomerOrderLine>) => void;
  onRemoveLine: (lineId: string) => void;
  onLoadDeliveryPreview: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const [activeStep, setActiveStep] = useState(selectedCustomer ? 1 : 0);
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false);
  const [menuQuery, setMenuQuery] = useState('');
  const [menuCategory, setMenuCategory] = useState('all');
  const updateCustomer = (key: keyof CustomerFormState, value: string) => setCustomerForm(prev => ({ ...prev, [key]: value }));
  const updateOrder = (key: keyof CustomerOrderFormState, value: string | CustomerOrderFormState['items']) => setOrderForm(prev => ({ ...prev, [key]: value }));
  const totals = calculateCustomerOrderTotals(orderForm, menuItems, deliveryPreview);
  const categories = Array.from(new Set(menuItems.map(item => item.category).filter(Boolean)));
  const visibleMenuItems = menuItems.filter(item => {
    const query = menuQuery.trim().toLowerCase();
    return (menuCategory === 'all' || item.category === menuCategory)
      && (!query || item.name.toLowerCase().includes(query) || String(item.code || '').toLowerCase().includes(query));
  });
  const selectedLines = orderForm.items.map(line => ({ line, menuItem: menuItems.find(item => String(item.id) === line.menuItemId) })).filter(item => item.menuItem);
  const diningInfoReady = Boolean(
    orderForm.branchId
    && (orderForm.orderType === 'dinein' ? orderForm.tableNo.trim() : orderForm.address.trim()),
  );
  const stepLabels = ['选择顾客', '用餐信息', '选择菜品', '确认订单'];
  const maxUnlockedStep = !selectedCustomer ? 0 : !diningInfoReady ? 1 : selectedLines.length === 0 ? 2 : 3;
  useEffect(() => {
    if (selectedCustomer && activeStep === 0) setActiveStep(1);
  }, [selectedCustomer?.id]);
  useEffect(() => {
    if (activeStep > maxUnlockedStep) setActiveStep(maxUnlockedStep);
  }, [activeStep, maxUnlockedStep]);
  const chooseCustomer = (customer: CustomerRow) => {
    setSelectedCustomer(customer);
    setCreateCustomerOpen(false);
    setActiveStep(1);
  };
  const goToStep = (step: number) => {
    if (step <= maxUnlockedStep) setActiveStep(step);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <Panel className="z-[15] shrink-0 px-3 py-2 shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
        <div className="relative grid grid-cols-4">
          <span className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-[14px] h-px bg-slate-200" />
          <span className="pointer-events-none absolute left-[12.5%] top-[14px] h-px bg-emerald-400 transition-all duration-300" style={{ width: `${activeStep * 25}%` }} />
        {stepLabels.map((label, index) => {
          const active = index === activeStep;
          const completed = index < activeStep;
          const unlocked = index <= maxUnlockedStep;
          return <button key={label} type="button" disabled={!unlocked} onClick={() => goToStep(index)} className={`group relative z-[1] flex min-w-0 flex-col items-center gap-1 px-1 text-[11px] font-bold transition disabled:cursor-not-allowed ${active ? 'text-blue-700' : completed ? 'text-emerald-700' : 'text-slate-400'}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition ${active ? 'border-blue-600 bg-blue-600 text-white shadow-[0_0_0_3px_rgba(37,99,235,0.12)]' : completed ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-200 bg-white text-slate-400'}`}>{completed ? <Check size={13} strokeWidth={3} /> : index + 1}</span><span className="hidden truncate sm:block">{label}</span></button>;
        })}
        </div>
      </Panel>

      {error && <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700"><AlertCircle size={16} />{error}</div>}

      <div className={`grid min-h-0 min-w-0 flex-1 gap-3 overflow-hidden ${activeStep >= 2 ? 'xl:grid-cols-[minmax(0,1fr)_380px]' : 'grid-cols-1'}`}>
        <Panel className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <div className="flex min-h-[50px] shrink-0 items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50 px-4 py-2">
            <div className="flex min-w-0 items-center gap-3">
              <span className="h-6 w-1 shrink-0 rounded-full bg-blue-600" />
              <div className="flex min-w-0 items-center gap-2.5">
                <h2 className="shrink-0 text-[15px] font-black text-slate-950">{stepLabels[activeStep]}</h2>
                <span className="hidden h-3 w-px bg-slate-300 sm:block" />
                <p className="hidden truncate text-xs text-slate-500 sm:block">{activeStep === 0 ? '搜索并选择本次下单的顾客' : activeStep === 1 ? '设置订单类型、门店和就餐信息' : activeStep === 2 ? '选择菜品并调整订单数量' : '核对全部信息后创建订单'}</p>
              </div>
            </div>
            <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-500">{activeStep + 1} / 4</span>
          </div>

          {activeStep === 0 && <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
              <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input value={customerSearch} onChange={event => setCustomerSearch(event.target.value)} onKeyDown={event => event.key === 'Enter' && onSearch()} placeholder="输入手机号或顾客姓名" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:bg-white" /></div>
              <button type="button" onClick={onSearch} className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50">搜索</button>
              <button type="button" onClick={() => setCreateCustomerOpen(open => !open)} className="h-11 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white"><Plus size={16} className="mr-1 inline" />新建顾客</button>
            </div>
            {createCustomerOpen && <form onSubmit={onCreateCustomer} className="grid gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><Input label="手机号" value={customerForm.phone} onChange={value => updateCustomer('phone', value)} placeholder="0123456789" required /><Input label="顾客姓名" value={customerForm.name} onChange={value => updateCustomer('name', value)} placeholder="顾客姓名" required /><button type="submit" className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white">创建并选择</button></form>}
            <div className="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {customers.map(customer => <button key={customer.id} type="button" onClick={() => chooseCustomer(customer)} className={`flex min-h-16 items-center justify-between rounded-2xl border p-3 text-left transition ${selectedCustomer?.id === customer.id ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-200 hover:bg-slate-50'}`}><span className="flex min-w-0 items-center gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-black ${selectedCustomer?.id === customer.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{(customer.name || '顾').slice(0, 1).toUpperCase()}</span><span className="min-w-0"><span className="block truncate text-sm font-bold text-slate-950">{customer.name || '未命名顾客'}</span><span className="mt-1 block text-xs font-semibold text-slate-500">{customer.displayPhone}</span></span></span>{selectedCustomer?.id === customer.id ? <Check size={17} className="text-blue-600" /> : <ChevronRight size={16} className="text-slate-400" />}</button>)}
              {customers.length === 0 && <div className="col-span-full rounded-2xl border border-dashed border-slate-200 py-14 text-center text-sm font-bold text-slate-400">没有找到顾客，可点击“新建顾客”快速创建</div>}
            </div>
          </div>}

          {activeStep === 1 && <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            {selectedCustomer && <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-blue-100 text-sm font-black text-blue-700">{(selectedCustomer.name || '顾').slice(0, 1).toUpperCase()}</span><div><p className="text-sm font-bold text-slate-950">{selectedCustomer.name || '未命名顾客'}</p><p className="mt-0.5 text-xs text-slate-500">{selectedCustomer.displayPhone}</p></div></div><button type="button" onClick={() => setActiveStep(0)} className="text-xs font-bold text-blue-600">更换顾客</button></div>}
            <div className="grid gap-4 md:grid-cols-2"><SelectInput label="订单类型" value={orderForm.orderType} onChange={value => updateOrder('orderType', value)}><option value="dinein">堂食</option><option value="takeaway">外卖配送</option></SelectInput><SelectInput label="门店" value={orderForm.branchId} onChange={value => updateOrder('branchId', value)} required><option value="">请选择门店</option>{branches.filter(branch => branch.active).map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</SelectInput></div>
            {orderForm.orderType === 'dinein' ? <Input label="桌号" value={orderForm.tableNo} onChange={value => updateOrder('tableNo', value)} placeholder="例如 A1" required /> : <div className="grid gap-3"><Input label="配送地址" value={orderForm.address} onChange={value => updateOrder('address', value)} placeholder="输入完整配送地址" required /><div className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-3 text-xs font-bold text-blue-700 sm:flex-row sm:items-center sm:justify-between"><span>{deliveryPreview ? `${deliveryPreview.distanceKm.toFixed(2)} km · 约 ${deliveryPreview.durationMin} 分钟 · 配送费 RM ${deliveryPreview.deliveryFee.toFixed(2)}` : '地址填写完成后，请计算配送距离和费用'}</span><button type="button" onClick={onLoadDeliveryPreview} disabled={deliveryPreviewLoading || !orderForm.address.trim() || !orderForm.branchId} className="h-9 shrink-0 rounded-xl border border-blue-200 bg-white px-3 disabled:opacity-50">{deliveryPreviewLoading ? '计算中...' : '计算配送费'}</button></div></div>}
            <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4"><button type="button" onClick={() => setActiveStep(0)} className="h-10 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-600">上一步</button><button type="button" disabled={!diningInfoReady} onClick={() => setActiveStep(2)} className="h-10 rounded-xl bg-blue-600 px-6 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">下一步：选择菜品</button></div>
          </div>}

          {activeStep === 2 && <div className="grid min-h-0 flex-1 grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-3 overflow-hidden p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input value={menuQuery} onChange={event => setMenuQuery(event.target.value)} placeholder="搜索菜品名称或编码" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:bg-white" /></div><IconButton title="刷新菜单" onClick={onRefreshMenu}><RefreshCw size={17} /></IconButton></div>
            <div className="flex gap-2 overflow-x-auto pb-1">{['all', ...categories].map(category => <button key={category} type="button" onClick={() => setMenuCategory(category)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold ${menuCategory === category ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{category === 'all' ? '全部' : category}</button>)}</div>
            <div className="grid content-start gap-3 overflow-y-auto pr-1 md:grid-cols-2 2xl:grid-cols-3">{visibleMenuItems.map(item => <article key={item.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 transition hover:border-blue-200 hover:shadow-sm">{item.image ? <img src={item.image} alt={item.name} className="h-16 w-16 shrink-0 rounded-xl object-cover" /> : <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><Soup size={22} /></div>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-950">{item.code ? `${item.code} · ` : ''}{item.name}</p><p className="mt-1 text-sm font-black text-blue-600">RM {Number(item.price).toFixed(2)}</p><p className="mt-1 text-[11px] font-bold text-emerald-600">可售</p></div><button type="button" aria-label={`添加${item.name}`} onClick={() => onAddLine(String(item.id))} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-600 text-white hover:bg-blue-500"><Plus size={18} /></button></article>)}{visibleMenuItems.length === 0 && <div className="col-span-full rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm font-bold text-slate-400">没有符合条件的菜品</div>}</div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-3"><button type="button" onClick={() => setActiveStep(1)} className="h-10 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-600">上一步</button><button type="button" disabled={selectedLines.length === 0} onClick={() => setActiveStep(3)} className="h-10 rounded-xl bg-blue-600 px-6 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">下一步：确认订单</button></div>
          </div>}

          {activeStep === 3 && <form onSubmit={onSubmit} className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto p-4">
            <div className="grid gap-3 md:grid-cols-2"><button type="button" onClick={() => setActiveStep(0)} className="rounded-2xl border border-slate-200 p-4 text-left hover:border-blue-200"><p className="text-xs font-bold text-slate-400">顾客</p><p className="mt-2 text-sm font-bold text-slate-950">{selectedCustomer?.name || '未选择'}</p><p className="mt-1 text-xs text-slate-500">{selectedCustomer?.displayPhone}</p></button><button type="button" onClick={() => setActiveStep(1)} className="rounded-2xl border border-slate-200 p-4 text-left hover:border-blue-200"><p className="text-xs font-bold text-slate-400">用餐信息</p><p className="mt-2 text-sm font-bold text-slate-950">{orderForm.orderType === 'dinein' ? `堂食 · 桌号 ${orderForm.tableNo}` : '外卖配送'}</p><p className="mt-1 truncate text-xs text-slate-500">{branches.find(branch => branch.id === orderForm.branchId)?.name}{orderForm.orderType === 'takeaway' ? ` · ${orderForm.address}` : ''}</p></button></div>
            <div className="overflow-hidden rounded-2xl border border-slate-200"><div className="flex items-center justify-between bg-slate-50 px-4 py-3"><p className="text-sm font-bold text-slate-950">订单菜品</p><button type="button" onClick={() => setActiveStep(2)} className="text-xs font-bold text-blue-600">修改菜品</button></div><div className="divide-y divide-slate-100">{selectedLines.map(({ line, menuItem }) => <div key={line.lineId} className="flex items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-950">{menuItem?.name} × {line.quantity}</p>{line.note && <p className="mt-1 truncate text-xs text-slate-500">备注：{line.note}</p>}</div><p className="shrink-0 text-sm font-black">RM {(Number(menuItem?.price || 0) * line.quantity).toFixed(2)}</p></div>)}</div></div>
            <TextArea label="订单备注" value={orderForm.note} onChange={value => updateOrder('note', value)} />
            <div className="flex items-center justify-between border-t border-slate-100 pt-4"><button type="button" onClick={() => setActiveStep(2)} className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-bold text-slate-600">上一步</button><button type="submit" disabled={submitting} className="flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-bold text-white shadow-[0_8px_18px_rgba(37,99,235,0.18)] disabled:opacity-50"><ShoppingCart size={17} />{submitting ? '正在创建...' : `确认创建 · RM ${totals.total.toFixed(2)}`}</button></div>
          </form>}
        </Panel>

        {activeStep >= 2 && <Panel className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><div><h3 className="text-lg font-bold text-slate-950">订单摘要</h3><p className="mt-1 text-xs text-slate-500">{selectedLines.reduce((sum, item) => sum + item.line.quantity, 0)} 件商品</p></div><ShoppingCart size={20} className="text-slate-400" /></div>
          <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
            {selectedLines.map(({ line, menuItem }) => <div key={line.lineId} className="grid gap-2 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-950">{menuItem?.name}</p><p className="mt-1 text-xs font-bold text-slate-500">RM {Number(menuItem?.price || 0).toFixed(2)}</p></div><button type="button" onClick={() => onRemoveLine(line.lineId)} className="text-slate-400 hover:text-red-600"><Trash2 size={16} /></button></div><div className="flex items-center justify-between gap-3"><div className="inline-flex items-center rounded-xl border border-slate-200"><button type="button" onClick={() => line.quantity <= 1 ? onRemoveLine(line.lineId) : onUpdateLine(line.lineId, { quantity: line.quantity - 1 })} className="grid h-9 w-9 place-items-center text-slate-500"><Minus size={15} /></button><span className="w-8 text-center text-sm font-bold">{line.quantity}</span><button type="button" onClick={() => onUpdateLine(line.lineId, { quantity: line.quantity + 1 })} className="grid h-9 w-9 place-items-center text-slate-500"><Plus size={15} /></button></div><p className="text-sm font-black">RM {(Number(menuItem?.price || 0) * line.quantity).toFixed(2)}</p></div><input value={line.note} onChange={event => onUpdateLine(line.lineId, { note: event.target.value })} placeholder="添加菜品备注" className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-blue-500 focus:bg-white" /></div>)}
            {selectedLines.length === 0 && <div className="grid min-h-52 place-items-center px-6 text-center"><div><ShoppingCart size={28} className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-400">完成前两步后选择菜品</p></div></div>}
          </div>
          <div className="grid shrink-0 gap-3 border-t border-slate-200 bg-white p-4"><div className="grid gap-2 text-sm"><SummaryRow label="小计" value={`RM ${totals.subtotal.toFixed(2)}`} /><SummaryRow label="配送费" value={`RM ${totals.deliveryFee.toFixed(2)}`} /><SummaryRow label="应付" value={`RM ${totals.total.toFixed(2)}`} strong /></div></div>
        </Panel>}
      </div>
    </div>
  );
}

function CustomerOrderManagerLegacy({ customers, customerSearch, setCustomerSearch, selectedCustomer, setSelectedCustomer, customerForm, setCustomerForm, orderForm, setOrderForm, menuItems, branches, error, submitting, deliveryPreview, deliveryPreviewLoading, onSearch, onCreateCustomer, onRefreshMenu, onAddLine, onUpdateLine, onRemoveLine, onLoadDeliveryPreview, onSubmit }: {
  customers: CustomerRow[];
  customerSearch: string;
  setCustomerSearch: (value: string) => void;
  selectedCustomer: CustomerRow | null;
  setSelectedCustomer: (customer: CustomerRow | null) => void;
  customerForm: CustomerFormState;
  setCustomerForm: React.Dispatch<React.SetStateAction<CustomerFormState>>;
  orderForm: CustomerOrderFormState;
  setOrderForm: React.Dispatch<React.SetStateAction<CustomerOrderFormState>>;
  menuItems: OrderMenuItem[];
  branches: StoreBranchRow[];
  error: string;
  submitting: boolean;
  deliveryPreview: { deliveryFee: number; distanceKm: number; durationMin: number } | null;
  deliveryPreviewLoading: boolean;
  onSearch: () => void;
  onCreateCustomer: (event: React.FormEvent) => void;
  onRefreshMenu: () => void;
  onAddLine: () => void;
  onUpdateLine: (lineId: string, patch: Partial<CustomerOrderLine>) => void;
  onRemoveLine: (lineId: string) => void;
  onLoadDeliveryPreview: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const updateCustomer = (key: keyof CustomerFormState, value: string) => setCustomerForm(prev => ({ ...prev, [key]: value }));
  const updateOrder = (key: keyof CustomerOrderFormState, value: string | CustomerOrderFormState['items']) => setOrderForm(prev => ({ ...prev, [key]: value }));
  const totals = calculateCustomerOrderTotals(orderForm, menuItems, deliveryPreview);
  const selectedLines = orderForm.items.map(line => ({
    line,
    menuItem: menuItems.find(item => String(item.id) === line.menuItemId),
  })).filter(item => item.menuItem);

  return (
    <div className="grid gap-3 xl:grid-cols-[380px_1fr]">
      <div className="grid gap-3">
        <Panel className="p-4">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Customers</p>
            <h3 className="mt-1 text-xl font-bold text-slate-950">选择顾客</h3>
          </div>
          {error && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
              <AlertCircle className="mt-0.5 shrink-0" size={16} />
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={customerSearch}
                onChange={event => setCustomerSearch(event.target.value)}
                onKeyDown={event => event.key === 'Enter' && onSearch()}
                placeholder="手机号或姓名"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white"
              />
            </div>
            <IconButton title="搜索顾客" onClick={onSearch}><Search size={17} /></IconButton>
          </div>
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
            {customers.map(customer => (
              <button
                key={customer.id}
                type="button"
                onClick={() => setSelectedCustomer(customer)}
                className={`w-full rounded-xl border px-3 py-3 text-left transition ${selectedCustomer?.id === customer.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-bold text-slate-950">{customer.name || '未命名顾客'}</p>
                  <Badge tone={customer.source === 'admin_created' ? 'blue' : 'muted'}>{customer.source === 'admin_created' ? '后台创建' : '自助注册'}</Badge>
                </div>
                <p className="mt-1 text-xs font-semibold text-slate-500">{customer.displayPhone}</p>
              </button>
            ))}
            {customers.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 px-3 py-8 text-center text-sm font-bold text-slate-400">暂无顾客</p>}
          </div>
        </Panel>

        <Panel className="p-4">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Create</p>
            <h3 className="mt-1 text-xl font-bold text-slate-950">新建顾客</h3>
          </div>
          <form onSubmit={onCreateCustomer} className="grid gap-3">
            <Input label="手机号" value={customerForm.phone} onChange={value => updateCustomer('phone', value)} placeholder="0123456789" required />
            <Input label="顾客姓名" value={customerForm.name} onChange={value => updateCustomer('name', value)} placeholder="顾客姓名" required />
            <button type="submit" className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500">
              <Plus size={16} />
              创建并选择
            </button>
          </form>
        </Panel>
      </div>

      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Order</p>
            <h3 className="text-xl font-bold text-slate-950">{selectedCustomer ? `为 ${selectedCustomer.name || selectedCustomer.displayPhone} 下单` : '代客下单'}</h3>
          </div>
          <IconButton title="刷新菜单" onClick={onRefreshMenu}><RefreshCw size={17} /></IconButton>
        </div>
        <form onSubmit={onSubmit} className="grid gap-4 p-4">
          <div className="grid gap-3 lg:grid-cols-3">
            <SelectInput label="订单类型" value={orderForm.orderType} onChange={value => updateOrder('orderType', value)}>
              <option value="dinein">堂食</option>
              <option value="takeaway">外卖</option>
            </SelectInput>
            <SelectInput label="门店" value={orderForm.branchId} onChange={value => updateOrder('branchId', value)} required>
              <option value="">请选择门店</option>
              {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </SelectInput>
            {orderForm.orderType === 'dinein' ? (
              <Input label="桌号" value={orderForm.tableNo} onChange={value => updateOrder('tableNo', value)} placeholder="A1" required />
            ) : (
              <div className="grid gap-2">
                <Input label="配送地址" value={orderForm.address} onChange={value => updateOrder('address', value)} placeholder="详细地址" required />
                <button type="button" onClick={onLoadDeliveryPreview} disabled={deliveryPreviewLoading || !orderForm.address.trim() || !orderForm.branchId} className="flex h-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-4 text-xs font-bold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50">
                  {deliveryPreviewLoading ? '计算中...' : '计算配送费'}
                </button>
              </div>
            )}
          </div>

          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <SelectInput label="添加菜品" value={orderForm.draftMenuItemId} onChange={value => updateOrder('draftMenuItemId', value)}>
              {menuItems.map(item => <option key={item.id} value={item.id}>{item.code ? `${item.code} · ` : ''}{item.name} · RM {Number(item.price).toFixed(2)}</option>)}
            </SelectInput>
            <button type="button" onClick={onAddLine} disabled={!menuItems.length} className="self-end flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
              <Plus size={16} />
              加入
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
              <colgroup>
                <col className="w-[34%]" />
                <col className="w-[15%]" />
                <col className="w-[15%]" />
                <col className="w-[24%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.08em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">菜品</th>
                  <th className="px-4 py-3 text-center font-bold">单价</th>
                  <th className="px-4 py-3 text-center font-bold">数量</th>
                  <th className="px-4 py-3 text-center font-bold">备注</th>
                  <th className="px-4 py-3 text-center font-bold">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {selectedLines.map(({ line, menuItem }) => (
                  <tr key={line.lineId}>
                    <td className="px-4 py-3 align-middle font-bold text-slate-950">{menuItem?.code ? `${menuItem.code} · ` : ''}{menuItem?.name}</td>
                    <td className="px-4 py-3 text-center align-middle text-slate-600">RM {Number(menuItem?.price || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-center align-middle">
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={event => onUpdateLine(line.lineId, { quantity: Math.max(1, Number(event.target.value || 1)) })}
                        className="h-10 w-20 rounded-xl border border-slate-200 bg-slate-50 px-3 text-center text-sm font-bold text-slate-950 outline-none focus:border-blue-500 focus:bg-white"
                      />
                    </td>
                    <td className="px-4 py-3 text-center align-middle">
                      <input
                        value={line.note}
                        onChange={event => onUpdateLine(line.lineId, { note: event.target.value })}
                        placeholder="少辣 / 不要葱"
                        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:bg-white"
                      />
                    </td>
                    <td className="px-4 py-3 text-center align-middle">
                      <IconButton title="移除菜品" onClick={() => onRemoveLine(line.lineId)} variant="danger"><Trash2 size={16} /></IconButton>
                    </td>
                  </tr>
                ))}
                {selectedLines.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm font-bold text-slate-400">请先添加菜品</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <TextArea label="订单备注" value={orderForm.note} onChange={value => updateOrder('note', value)} />

          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_auto] md:items-end">
            <div className="grid gap-2 text-sm">
              <SummaryRow label="小计" value={`RM ${totals.subtotal.toFixed(2)}`} />
              <SummaryRow
                label="配送费"
                value={orderForm.orderType === 'takeaway' ? deliveryPreview ? `RM ${totals.deliveryFee.toFixed(2)} · ${deliveryPreview.distanceKm.toFixed(2)}km · ${deliveryPreview.durationMin}分钟` : '待计算' : 'RM 0.00'}
              />
              <SummaryRow label="应付" value={`RM ${totals.total.toFixed(2)}`} strong />
            </div>
            <button type="submit" disabled={submitting || !selectedCustomer || selectedLines.length === 0} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-bold text-white shadow-[0_8px_18px_rgba(37,99,235,0.18)] transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
              <ShoppingCart size={17} />
              {submitting ? '提交中...' : '创建订单'}
            </button>
          </div>
        </form>
      </Panel>
    </div>
  );
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${strong ? 'text-base font-bold text-slate-950' : 'font-semibold text-slate-600'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{title}</h4>
      {children}
    </section>
  );
}

function DetailGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">{children}</div>;
}

function DetailItem({ label, value, wide = false }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <p className="text-xs font-bold text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-bold leading-6 text-slate-950">{value || '-'}</p>
    </div>
  );
}

function ReceiptRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-xs font-bold text-slate-500">{label}</span>
      <span className="text-right text-sm font-black leading-5 text-slate-950">{value || '-'}</span>
    </div>
  );
}

function StoreBranchManager({ branches, form, setForm, error, editorOpen, canAdminister, onSubmit, onCreate, onEdit, onToggleActive, onCancel }: {
  branches: StoreBranchRow[];
  form: StoreBranchFormState;
  setForm: React.Dispatch<React.SetStateAction<StoreBranchFormState>>;
  error: string;
  editorOpen: boolean;
  canAdminister: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onCreate: () => void;
  onEdit: (branch: StoreBranchRow) => void;
  onToggleActive: (branch: StoreBranchRow) => void;
  onCancel: () => void;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const editing = branches.some(branch => branch.id === form.id);
  const update = (key: keyof StoreBranchFormState, value: string | boolean) => setForm(prev => ({ ...prev, [key]: value }));
  const filteredBranches = branches.filter(branch => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || branch.name.toLowerCase().includes(query) || branch.address.toLowerCase().includes(query);
    const matchesStatus = status === 'all' || (status === 'active' ? branch.active : !branch.active);
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <Panel className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-black text-slate-950">门店列表</h2><p className="mt-1 text-xs text-slate-500">管理门店资料、营业状态和配送位置</p></div>{canAdminister && <button type="button" onClick={onCreate} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white"><Plus size={17} />新增门店</button>}</div>
        <div className="grid shrink-0 gap-3 border-b border-slate-100 bg-white p-4 md:grid-cols-[minmax(280px,1fr)_180px] md:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索门店名称或地址" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-[#C7A46A] focus:bg-white" />
          </div>
          <select value={status} onChange={event => setStatus(event.target.value as typeof status)} className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none focus:border-[#C7A46A] focus:bg-white">
            <option value="all">全部状态</option>
            <option value="active">营业中</option>
            <option value="inactive">已停用</option>
          </select>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 md:hidden">
          <div className="grid gap-3">
            {filteredBranches.map(branch => (
              <article key={branch.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-black text-slate-950">{branch.name}</h3><p className="mt-1 text-xs text-slate-400">{branch.id} · 排序 {branch.sort_order}</p></div><button type="button" disabled={!canAdminister} onClick={() => canAdminister && onToggleActive(branch)} className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold disabled:cursor-default ${branch.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>{branch.active ? '营业中' : '已停用'}</button></div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{branch.address}</p>
                <p className="mt-2 text-xs text-slate-400">坐标：{formatCoordinates(branch)}</p>
                <button type="button" onClick={() => onEdit(branch)} className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-bold text-white"><Pencil size={15} />查看与编辑</button>
              </article>
            ))}
            {filteredBranches.length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-14 text-center text-sm font-bold text-slate-400">没有符合条件的门店</div>}
          </div>
        </div>
        <div className="hidden min-h-0 flex-1 overflow-auto md:block">
          <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[20%]" />
              <col className="w-[38%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs text-slate-500 shadow-[inset_0_-1px_0_#E5E7EB]">
              <tr>
                <th className="px-5 py-3 text-left font-bold">门店名称</th>
                <th className="px-4 py-3 text-left font-bold">地址</th>
                <th className="px-4 py-3 text-center font-bold">状态</th>
                <th className="px-4 py-3 text-center font-bold">排序</th>
                <th className="px-4 py-3 text-center font-bold">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBranches.map(branch => (
                <tr key={branch.id} className="h-[72px] cursor-pointer transition hover:bg-slate-50/80" onClick={() => onEdit(branch)}>
                  <td className="px-5 py-3 align-middle">
                    <p className="font-bold text-slate-950">{branch.name}</p>
                    <p className="mt-1 text-xs text-slate-400">{branch.id} · {branch.updated_at ? formatDate(branch.updated_at) : '-'}</p>
                  </td>
                  <td className="px-4 py-3 text-left align-middle text-slate-600"><p className="line-clamp-2 leading-5">{branch.address}</p></td>
                  <td className="px-4 py-4 text-center align-middle">
                    <button type="button" disabled={!canAdminister} onClick={event => { event.stopPropagation(); if (canAdminister) onToggleActive(branch); }} className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-bold disabled:cursor-default ${branch.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}><span className={`h-2 w-2 rounded-full ${branch.active ? 'bg-emerald-500' : 'bg-slate-400'}`} />{branch.active ? '营业中' : '已停用'}</button>
                  </td>
                  <td className="px-4 py-4 text-center align-middle text-slate-600">{branch.sort_order}</td>
                  <td className="px-4 py-4 text-center align-middle">
                    <IconButton title="编辑门店" onClick={() => onEdit(branch)}><Pencil size={16} /></IconButton>
                  </td>
                </tr>
              ))}
              {filteredBranches.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-14 text-center text-sm font-bold text-slate-400">没有符合条件的门店</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {editorOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={event => event.target === event.currentTarget && onCancel()}>
          <aside className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div><h3 className="text-xl font-bold text-slate-950">{editing ? '编辑门店' : '新增门店'}</h3><p className="mt-1 text-xs text-slate-500">管理门店资料、营业状态与配送位置</p></div>
              <IconButton title="关闭" onClick={onCancel}><X size={17} /></IconButton>
            </div>
            {error && <div className="mx-5 mt-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700"><AlertCircle size={16} />{error}</div>}
            <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="grid gap-4 overflow-y-auto p-5">
                <Input label="门店 ID" value={form.id} onChange={value => update('id', value.toLowerCase())} placeholder="例如 bukit-bintang" required disabled={editing} />
                <Input label="门店名称" value={form.name} onChange={value => update('name', value)} placeholder="PUDU 区" required />
                <TextArea label="门店地址" value={form.address} onChange={value => update('address', value)} required />
                <div className="grid gap-3 sm:grid-cols-2"><Input label="纬度" value={form.latitude} onChange={value => update('latitude', value)} type="number" placeholder="可留空自动解析" /><Input label="经度" value={form.longitude} onChange={value => update('longitude', value)} type="number" placeholder="可留空自动解析" /></div>
                {canAdminister && <><Input label="排序" value={form.sort_order} onChange={value => update('sort_order', value)} type="number" /><Toggle label={form.active ? '门店营业中' : '门店已停用'} checked={form.active} onChange={value => update('active', value)} /></>}
              </div>
              <div className="mt-auto grid grid-cols-2 gap-3 border-t border-slate-200 p-5"><button type="button" onClick={onCancel} className="h-11 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">取消</button><button type="submit" className="flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-bold text-white"><Save size={16} />{editing ? '保存更改' : '创建门店'}</button></div>
            </form>
          </aside>
        </div>
      )}
    </div>
  );
}

function AccountManager({ accounts, branches, form, setForm, error, editorOpen, onSubmit, onCreate, onEdit, onToggleActive, onDelete, onCancel }: {
  accounts: AdminAccountRow[];
  branches: StoreBranchRow[];
  form: AccountFormState;
  setForm: React.Dispatch<React.SetStateAction<AccountFormState>>;
  error: string;
  editorOpen: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onCreate: () => void;
  onEdit: (account: AdminAccountRow) => void;
  onToggleActive: (account: AdminAccountRow) => void;
  onDelete: (account: AdminAccountRow) => void;
  onCancel: () => void;
}) {
  const editing = Boolean(form.id);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | AdminRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const update = (key: keyof AccountFormState, value: string | boolean) => setForm(prev => ({ ...prev, [key]: value }));
  const updateRole = (role: AdminRole) => setForm(prev => ({
    ...prev,
    role,
    branchScope: role === 'admin' ? 'all' : role === 'kitchen' ? 'assigned' : prev.role === 'customer_service' ? prev.branchScope : 'assigned',
    assignedBranchId: role === 'admin' ? '' : prev.assignedBranchId,
  }));
  const normalizedSearch = search.trim().toLowerCase();
  const filteredAccounts = accounts.filter(account => {
    const matchesSearch = !normalizedSearch
      || account.username.toLowerCase().includes(normalizedSearch)
      || account.displayName.toLowerCase().includes(normalizedSearch);
    const matchesRole = roleFilter === 'all' || account.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? account.active : !account.active);
    return matchesSearch && matchesRole && matchesStatus;
  });
  const activeCount = accounts.filter(account => account.active).length;
  const privilegedCount = accounts.filter(account => account.role === 'admin').length;

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      <Panel className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-black text-slate-950">后台账号</h2><p className="mt-1 text-xs text-slate-500">管理登录身份、角色权限和所属门店</p></div><button type="button" onClick={onCreate} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white"><Plus size={17} />新增账号</button></div>
        <div className="grid shrink-0 gap-3 border-b border-slate-100 bg-white p-4 md:grid-cols-[minmax(260px,1fr)_170px_150px] md:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索账号或显示名称" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none transition focus:border-[#C7A46A] focus:bg-white" />
          </div>
          <select value={roleFilter} onChange={event => setRoleFilter(event.target.value as typeof roleFilter)} className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none focus:border-[#C7A46A] focus:bg-white">
            <option value="all">全部角色</option><option value="admin">管理员</option><option value="customer_service">运营助理</option><option value="kitchen">厨房工人</option>
          </select>
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none focus:border-[#C7A46A] focus:bg-white">
            <option value="all">全部状态</option><option value="active">启用</option><option value="inactive">停用</option>
          </select>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 md:hidden">
          <div className="grid gap-3">
            {filteredAccounts.map(account => (
              <article key={account.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-black text-slate-950">{account.username}</h3><p className="mt-1 truncate text-xs text-slate-500">{account.displayName || '未设置显示名称'}</p></div><button type="button" onClick={() => onToggleActive(account)} className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${account.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>{account.active ? '启用' : '停用'}</button></div>
                <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-slate-200"><div className="bg-slate-50 p-3"><p className="text-[10px] text-slate-400">角色</p><div className="mt-1"><Badge tone={toneForAdminRole(account.role)}>{labelAdminRole(account.role)}</Badge></div></div><div className="bg-slate-50 p-3"><p className="text-[10px] text-slate-400">所属门店</p><p className="mt-1 truncate text-xs font-bold text-slate-700">{account.branchScope === 'all' ? '所有门店' : account.assignedBranchId ? branches.find(branch => branch.id === account.assignedBranchId)?.name || account.assignedBranchId : '未分配'}</p></div></div>
                <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => onEdit(account)} className="flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-100 text-sm font-bold text-slate-700"><Pencil size={15} />编辑</button><button type="button" onClick={() => onDelete(account)} className="flex h-10 items-center justify-center gap-2 rounded-xl bg-red-50 text-sm font-bold text-red-600"><Trash2 size={15} />删除</button></div>
              </article>
            ))}
            {filteredAccounts.length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-14 text-center text-sm font-bold text-slate-400">没有符合条件的后台账号</div>}
          </div>
        </div>
        <div className="hidden min-h-0 flex-1 overflow-auto md:block">
          <table className="w-full min-w-[920px] table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[25%]" /><col className="w-[15%]" /><col className="w-[18%]" /><col className="w-[12%]" /><col className="w-[16%]" /><col className="w-[14%]" />
            </colgroup>
            <thead className="sticky top-0 z-[8] bg-slate-50 text-xs text-slate-500 shadow-[inset_0_-1px_0_#E5E7EB]">
              <tr>
                <th className="px-5 py-3 text-left font-bold">账号信息</th>
                <th className="px-4 py-3 text-center font-bold">角色</th>
                <th className="px-4 py-3 text-center font-bold">所属门店</th>
                <th className="px-4 py-3 text-center font-bold">状态</th>
                <th className="px-4 py-3 text-center font-bold">最后登录</th>
                <th className="px-4 py-3 text-center font-bold">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAccounts.map(account => (
                <tr key={account.id} className="h-[68px] transition hover:bg-slate-50/80">
                  <td className="px-5 py-3 align-middle"><p className="font-bold text-slate-950">{account.username}</p><p className="mt-1 truncate text-xs text-slate-500">{account.displayName || '未设置显示名称'}</p></td>
                  <td className="px-4 py-4 text-center align-middle">
                    <Badge tone={toneForAdminRole(account.role)}>{labelAdminRole(account.role)}</Badge>
                  </td>
                  <td className="px-4 py-4 text-center align-middle text-slate-600">{account.branchScope === 'all' ? <span className="font-bold text-blue-600">所有门店</span> : account.assignedBranchId ? branches.find(branch => branch.id === account.assignedBranchId)?.name || account.assignedBranchId : <span className="text-red-500">未分配</span>}</td>
                  <td className="px-4 py-4 text-center align-middle">
                    <button type="button" onClick={() => onToggleActive(account)} className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-bold transition ${account.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}><span className={`h-2 w-2 rounded-full ${account.active ? 'bg-emerald-500' : 'bg-slate-400'}`} />{account.active ? '启用' : '停用'}</button>
                  </td>
                  <td className="px-4 py-4 text-center align-middle text-slate-500">{account.lastLoginAt ? formatDate(account.lastLoginAt) : '-'}</td>
                  <td className="px-4 py-4 text-center align-middle">
                    <div className="flex justify-center gap-2">
                      <IconButton title="编辑账号" onClick={() => onEdit(account)}><Pencil size={16} /></IconButton>
                      <IconButton title="删除账号" onClick={() => onDelete(account)} variant="danger"><Trash2 size={16} /></IconButton>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredAccounts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center text-sm font-bold text-slate-400">没有符合条件的后台账号</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 text-xs font-bold text-slate-500"><span>当前显示 {filteredAccounts.length} / {accounts.length} 个账号</span><span className="flex gap-4"><span>启用 {activeCount}</span><span>高权限 {privilegedCount}</span></span></div>
      </Panel>

      {editorOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={event => event.target === event.currentTarget && onCancel()}>
        <aside className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h3 className="text-xl font-bold text-slate-950">{editing ? '编辑后台账号' : '新增后台账号'}</h3><p className="mt-1 text-xs text-slate-500">配置登录身份、角色权限和所属门店</p></div><IconButton title="关闭" onClick={onCancel}><X size={17} /></IconButton></div>
          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="grid gap-4 overflow-y-auto p-5">
              {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700"><AlertCircle className="mt-0.5 shrink-0" size={16} />{error}</div>}
              <Input label="登录账号" value={form.username} onChange={value => update('username', value)} placeholder="例如 service01" required />
              <Input label="显示名称" value={form.displayName} onChange={value => update('displayName', value)} placeholder="例如 厨房早班" />
              <SelectInput label="账号角色" value={form.role} onChange={value => updateRole(value as AccountFormState['role'])}><option value="admin">管理员</option><option value="customer_service">运营助理</option><option value="kitchen">厨房工人</option></SelectInput>
              {form.role === 'customer_service' && <SelectInput label="门店权限" value={form.branchScope} onChange={value => setForm(prev => ({ ...prev, branchScope: value as AccountFormState['branchScope'], assignedBranchId: value === 'all' ? '' : prev.assignedBranchId }))}><option value="all">所有门店</option><option value="assigned">指定门店</option></SelectInput>}
              {form.role !== 'admin' && form.branchScope === 'assigned' && <SelectInput label="所属门店" value={form.assignedBranchId} onChange={value => update('assignedBranchId', value)}><option value="">请选择门店</option>{branches.filter(branch => branch.active).map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</SelectInput>}
              {form.role === 'kitchen' && <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800">厨房工人使用独立厨房页面，只能查看和处理所属门店的厨房订单。</div>}
              <Input label={editing ? '新密码（留空则不修改）' : '初始密码'} value={form.password} onChange={value => update('password', value)} type="password" placeholder="至少 8 位" required={!editing} />
              <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs leading-5 text-blue-700">密码只会以安全哈希形式保存，创建后无法查看原密码。</div>
              <Toggle label={form.active ? '账号已启用' : '账号已停用'} checked={form.active} onChange={value => update('active', value)} />
            </div>
            <div className="mt-auto grid grid-cols-2 gap-3 border-t border-slate-200 p-5"><button type="button" onClick={onCancel} className="h-11 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:bg-slate-50">取消</button><button type="submit" className="flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-bold text-white"><Save size={16} />{editing ? '保存更改' : '创建账号'}</button></div>
          </form>
        </aside>
      </div>}
    </div>
  );
}

function CategoryManager({ categories, form, setForm, editingCategory, editorOpen, onSubmit, onCreate, onEdit, onToggleActive, onDelete, onCancel }: {
  categories: MenuCategoryRow[];
  form: CategoryFormState;
  setForm: React.Dispatch<React.SetStateAction<CategoryFormState>>;
  editingCategory: MenuCategoryRow | null;
  editorOpen: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onCreate: () => void;
  onEdit: (category: MenuCategoryRow) => void;
  onToggleActive: (category: MenuCategoryRow) => void;
  onDelete: (category: MenuCategoryRow) => void;
  onCancel: () => void;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const update = (key: keyof CategoryFormState, value: string | boolean) => setForm(prev => ({ ...prev, [key]: value }));
  const filteredCategories = categories.filter(category => {
    const matchesSearch = category.label.toLowerCase().includes(search.trim().toLowerCase());
    const matchesStatus = status === 'all' || (status === 'active' ? category.active : !category.active);
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <Panel className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-black text-slate-950">菜单分类</h2><p className="mt-1 text-xs text-slate-500">管理分类名称、展示顺序和启用状态</p></div><button type="button" onClick={onCreate} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white"><Plus size={17} />新增分类</button></div>
        <div className="grid gap-3 border-b border-slate-100 bg-white p-4 md:grid-cols-[minmax(260px,1fr)_180px] md:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索分类名称" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none transition focus:border-[#C7A46A] focus:bg-white" />
          </div>
          <select value={status} onChange={event => setStatus(event.target.value as typeof status)} className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none focus:border-[#C7A46A] focus:bg-white">
            <option value="all">全部状态</option>
            <option value="active">启用</option>
            <option value="inactive">停用</option>
          </select>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 md:hidden">
          <div className="grid gap-3">
          {filteredCategories.map(category => (
            <article key={category.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-black text-slate-950">{category.label}</h3><p className="mt-1 text-xs text-slate-500">{category.item_count} 个菜品 · 排序 {category.sort_order}</p></div><button type="button" onClick={() => onToggleActive(category)} className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${category.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>{category.active ? '启用' : '停用'}</button></div>
              <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => onEdit(category)} className="flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-100 text-sm font-bold text-slate-700"><Pencil size={15} />编辑</button><button type="button" onClick={() => onDelete(category)} className="flex h-10 items-center justify-center gap-2 rounded-xl bg-red-50 text-sm font-bold text-red-600"><Trash2 size={15} />删除</button></div>
            </article>
          ))}
          {filteredCategories.length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-14 text-center text-sm font-bold text-slate-400">没有符合条件的分类</div>}
          </div>
        </div>
        <div className="hidden min-h-0 flex-1 overflow-auto md:block">
          <table className="w-full min-w-[820px] table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[30%]" />
              <col className="w-[18%]" />
              <col className="w-[16%]" />
              <col className="w-[18%]" />
              <col className="w-[18%]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs text-slate-500 shadow-[inset_0_-1px_0_#E5E7EB]">
              <tr>
                <th className="px-5 py-3 text-left font-bold">分类名称</th>
                <th className="px-4 py-3 text-center font-bold">关联菜品</th>
                <th className="px-4 py-3 text-center font-bold">排序</th>
                <th className="px-4 py-3 text-center font-bold">状态</th>
                <th className="px-4 py-3 text-center font-bold">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCategories.map(category => (
                <tr key={category.id} className="h-16 transition hover:bg-slate-50/80">
                  <td className="px-5 py-3 align-middle font-bold text-slate-950">{category.label}</td>
                  <td className="px-4 py-4 text-center align-middle text-slate-600">{category.item_count}</td>
                  <td className="px-4 py-4 text-center align-middle text-slate-600">{category.sort_order}</td>
                  <td className="px-4 py-4 text-center align-middle">
                    <button type="button" onClick={() => onToggleActive(category)} className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-bold transition ${category.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
                      <span className={`h-2 w-2 rounded-full ${category.active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {category.active ? '启用' : '停用'}
                    </button>
                  </td>
                  <td className="px-4 py-4 text-center align-middle">
                    <div className="flex justify-center gap-2">
                      <IconButton title="编辑分类" onClick={() => onEdit(category)}><Pencil size={16} /></IconButton>
                      <IconButton title="删除分类" onClick={() => onDelete(category)} variant="danger"><Trash2 size={16} /></IconButton>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCategories.length === 0 && <tr><td colSpan={5} className="px-4 py-14 text-center text-sm font-bold text-slate-400">没有符合条件的分类</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs font-bold text-slate-500">
          <span>共 {filteredCategories.length} 个分类</span>
          <span>分类顺序由排序数字决定</span>
        </div>
      </Panel>

      {editorOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={event => event.target === event.currentTarget && onCancel()}>
          <aside className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-xl font-bold text-slate-950">{editingCategory ? '编辑分类' : '新增分类'}</h3>
                <p className="mt-1 text-xs text-slate-500">设置分类名称、顺序和可用状态</p>
              </div>
              <IconButton title="关闭" onClick={onCancel}><X size={17} /></IconButton>
            </div>
            <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="grid gap-4 overflow-y-auto p-5">
                <Input label="分类名称" value={form.label} onChange={value => update('label', value)} placeholder="例如 炖汤" required />
                <Input label="排序" value={form.sort_order} onChange={value => update('sort_order', value)} type="number" />
                <Toggle label={form.active ? '启用分类' : '停用分类'} checked={form.active} onChange={value => update('active', value)} />
              </div>
              <div className="mt-auto grid grid-cols-2 gap-3 border-t border-slate-200 p-5">
                <button type="button" onClick={onCancel} className="h-11 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:bg-slate-50">取消</button>
                <button type="submit" className="flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white">
                  <Save size={16} />{editingCategory ? '保存更改' : '创建分类'}
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}
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
  return <section className={`rounded-[20px] border border-[#E5E7EB] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)] ${className}`}>{children}</section>;
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
      <input value={value} onChange={event => onChange(event.target.value)} type={type} required={required} disabled={disabled} placeholder={placeholder} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#C7A46A] focus:bg-white disabled:cursor-not-allowed disabled:text-slate-400" />
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
      <select value={value} onChange={event => onChange(event.target.value)} required={required} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-[#C7A46A] focus:bg-white">
        {children}
      </select>
    </label>
  );
}

function TextArea({ label, value, onChange, required, disabled }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <textarea value={value} onChange={event => onChange(event.target.value)} required={required} disabled={disabled} rows={3} className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm leading-6 text-slate-950 outline-none transition focus:border-[#C7A46A] focus:bg-white disabled:cursor-not-allowed disabled:text-slate-400" />
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

function Toggle({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`flex items-center justify-center rounded-xl border px-3 py-2.5 text-xs font-bold ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${checked ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
      <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} disabled={disabled} className="sr-only" />
      {label}
    </label>
  );
}

function IconButton({ title, onClick, children, disabled = false, variant = 'default' }: { title: string; onClick: () => void; children: React.ReactNode; disabled?: boolean; variant?: 'default' | 'danger' }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled} className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#E2E8F0] bg-white transition disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-[#E2E8F0] disabled:hover:bg-white disabled:hover:text-slate-500 ${variant === 'danger' ? 'text-red-500 hover:border-red-100 hover:bg-red-50 hover:text-red-600' : 'text-[#64748B] hover:border-slate-300 hover:bg-[#F8FAFC] hover:text-slate-950'}`}>
      {children}
    </button>
  );
}

function Badge({ tone, children }: { tone: 'green' | 'red' | 'blue' | 'orange' | 'muted'; children: React.ReactNode }) {
  const className = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    orange: 'bg-amber-50 text-amber-700 border-amber-200',
    muted: 'bg-slate-100 text-slate-500 border-slate-200',
  }[tone];
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold leading-none ${className}`}>{children}</span>;
}

function labelOrderStatus(status: OrderStatus) {
  return {
    pending_confirm: '待确认',
    waiting_kitchen: '待制作',
    cooking: '厨房制作中',
    kitchen_done: '厨房完成',
    stock_issue: '缺货异常',
    preparing: '制作中',
    delivering: '配送中',
    delivered: '已送达',
    completed: '已完成',
    cancelled: '已取消',
  }[status];
}

function calculateCustomerOrderTotals(
  form: CustomerOrderFormState,
  menuItems: OrderMenuItem[],
  deliveryPreview: { deliveryFee: number } | null,
) {
  const subtotal = form.items.reduce((sum, line) => {
    const menuItem = menuItems.find(item => String(item.id) === line.menuItemId);
    return sum + Number(menuItem?.price || 0) * line.quantity;
  }, 0);
  const deliveryFee = form.orderType === 'takeaway' ? Number(deliveryPreview?.deliveryFee || 0) : 0;
  return {
    subtotal: roundCurrency(subtotal),
    deliveryFee: roundCurrency(deliveryFee),
    total: roundCurrency(subtotal + deliveryFee),
  };
}

function buildCustomerOrderPayload(
  customer: CustomerRow,
  form: CustomerOrderFormState,
  menuItems: OrderMenuItem[],
  deliveryPreview: { deliveryFee: number } | null,
  branches: StoreBranchRow[],
) {
  const totals = calculateCustomerOrderTotals(form, menuItems, deliveryPreview);
  const branch = branches.find(item => item.id === form.branchId);
  if (!branch) throw new Error('请选择有效门店');
  return {
    orderType: form.orderType,
    paymentMethod: 'cash',
    customer: {
      name: customer.name || customer.displayPhone,
      phone: customer.displayPhone,
    },
    assignedBranch: {
      id: branch.id,
      name: branch.name,
    },
    dineIn: form.orderType === 'dinein' ? { tableNo: form.tableNo.trim() } : undefined,
    takeaway: form.orderType === 'takeaway' ? { address: form.address.trim() } : undefined,
    items: form.items.map(line => {
      const menuItem = menuItems.find(item => String(item.id) === line.menuItemId);
      if (!menuItem) throw new Error('菜品不存在，请刷新菜单后重试');
      return {
        id: String(menuItem.id),
        code: menuItem.code,
        name: menuItem.name,
        price: Number(menuItem.price || 0),
        qty: line.quantity,
        options: [],
        note: line.note.trim() || undefined,
      };
    }),
    subtotal: totals.subtotal,
    deliveryFee: totals.deliveryFee,
    serviceCharge: 0,
    total: totals.total,
    note: form.note.trim() || undefined,
    createdAt: new Date().toISOString(),
  };
}

function roundCurrency(value: number) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

async function buildReceiptImage(file: File) {
  if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error('付款截图必须是 JPG 或 PNG 图片');
  if (file.size > 5 * 1024 * 1024) throw new Error('付款截图不能超过 5MB');
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('付款截图读取失败'));
    reader.readAsDataURL(file);
  });
  const dataBase64 = dataUrl.split(',')[1] || '';
  if (!dataBase64) throw new Error('付款截图读取失败');
  return {
    fileName: file.name,
    mimeType: file.type,
    dataBase64,
  };
}

function canSubmitPaymentChange(order: OrderRow) {
  return order.order_source === 'admin_created'
    && order.status !== 'completed'
    && order.status !== 'cancelled'
    && order.payment_method === 'cash'
    && order.payment_status === 'pay_at_counter';
}

function stringFromChangeData(data: Record<string, unknown>, key: string) {
  const value = data?.[key];
  return typeof value === 'string' ? value : '';
}

function labelOrderChangeAction(action: OrderChangeRecord['action']) {
  if (action === 'submitted') return '支付方式修改';
  if (action === 'approved') return '付款审核通过';
  return '付款审核拒绝';
}

function SystemSettings({ language, copy, onLanguageChange, api, adminRole }: {
  adminRole: AdminRole;
  language: AdminLanguage;
  copy: typeof adminCopy.zh | typeof adminCopy.en;
  onLanguageChange: (language: AdminLanguage) => void;
  api: <T,>(path: string, init?: RequestInit) => Promise<T>;
}) {
  const currentLanguage = language === 'zh' ? copy.chinese : copy.english;
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  return (
    <div className="mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-y-auto overscroll-contain pb-6 pr-1">
      <div className="mb-5 px-1">
        <h3 className="text-xl font-bold text-slate-950">{copy.systemSettings}</h3>
        <p className="mt-1.5 text-sm leading-6 text-slate-500">{copy.settingsHint}</p>
      </div>
      <Panel className="overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-400 sm:px-6">{copy.general}</div>
        <div className="divide-y divide-slate-100">
          <div>
            <button type="button" onClick={() => setLanguagePickerOpen(open => !open)} aria-expanded={languagePickerOpen} className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-slate-50 sm:px-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Settings size={19} /></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-950">{copy.language}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{copy.languageDescription}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-slate-500"><span>{currentLanguage}</span><ChevronDown size={16} className={`transition-transform duration-200 ${languagePickerOpen ? 'rotate-180' : ''}`} /></div>
            </button>
            {languagePickerOpen ? <div className="grid">
              <div className="overflow-hidden">
                <div className="border-t border-slate-100 bg-slate-50/80 px-5 py-2 sm:px-6">
                  {([
                    { value: 'zh' as const, title: copy.chinese, subtitle: 'zh-CN' },
                    { value: 'en' as const, title: copy.english, subtitle: 'en' },
                  ]).map(option => {
                    const active = language === option.value;
                    return (
                      <button key={option.value} type="button" onClick={() => { onLanguageChange(option.value); setLanguagePickerOpen(false); }} aria-pressed={active} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${active ? 'bg-white shadow-sm' : 'hover:bg-white/80'}`}>
                        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${active ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'}`}>{active && <Check size={13} strokeWidth={3} />}</span>
                        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900">{option.title}</span><span className="mt-0.5 block text-xs text-slate-500">{option.subtitle}</span></span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div> : null}
          </div>
        </div>
      </Panel>
      <DeliverySettingsPanel api={api} canToggleLalamove={adminRole === 'admin'} />
    </div>
  );
}

function pathForSection(section: AdminSection) {
  if (section === 'menuItems') return '/admin';
  if (section === 'menuCategories') return '/admin/menu-categories';
  if (section === 'customerOrder') return '/admin/customer-order';
  if (section === 'users') return '/admin/users';
  if (section === 'storeBranches') return '/admin/store-branches';
  if (section === 'systemSettings') return '/admin/system-settings';
  if (section === 'auditLogs') return '/admin/audit-logs';
  return `/admin/${section}`;
}

function sectionForPath(pathname: string): AdminSection | null {
  if (pathname === '/admin' || pathname === '/') return 'menuItems';
  if (pathname === '/admin/menu-categories') return 'menuCategories';
  if (pathname === '/admin/customer-order') return 'customerOrder';
  if (pathname === '/admin/users') return 'users';
  if (pathname === '/admin/store-branches') return 'storeBranches';
  if (pathname === '/admin/system-settings') return 'systemSettings';
  if (pathname === '/admin/agents' || pathname.startsWith('/admin/agents/')) return 'agents';
  const section = pathname.slice('/admin/'.length) as AdminSection;
  return sections.some(item => item.id === section) ? section : null;
}

function pathForAgentPage(page: AgentAdminPage) {
  return page === 'overview' ? '/admin/agents' : `/admin/agents/${page}`;
}

function agentPageForPath(pathname: string): AgentAdminPage {
  const segment = pathname.replace(/\/+$/, '').slice('/admin/agents/'.length);
  return agentAdminNavItems.some(item => item.id === segment) ? segment as AgentAdminPage : 'overview';
}

function labelAdminRole(role: AdminRole) {
  return {
    admin: '管理员',
    customer_service: '运营助理',
    kitchen: '厨房工人',
  }[role];
}

function toneForAdminRole(role: AdminRole): 'green' | 'red' | 'blue' | 'orange' | 'muted' {
  if (role === 'admin') return 'blue';
  if (role === 'customer_service') return 'green';
  if (role === 'kitchen') return 'orange';
  return 'muted';
}

function toneForOrder(status: OrderStatus): 'green' | 'red' | 'blue' | 'orange' | 'muted' {
  if (status === 'completed' || status === 'delivered' || status === 'kitchen_done') return 'green';
  if (status === 'cancelled' || status === 'stock_issue') return 'red';
  if (status === 'pending_confirm' || status === 'cooking') return 'blue';
  if (status === 'waiting_kitchen') return 'orange';
  return 'muted';
}

function canSelectOrderStatus(role: AdminRole, current: OrderStatus, next: OrderStatus, orderType: 'dinein' | 'takeaway') {
  if (role === 'admin' || current === next) return true;
  const allowed = new Set([
    'pending_confirm:waiting_kitchen', 'pending_confirm:cancelled', 'waiting_kitchen:cancelled',
    'stock_issue:waiting_kitchen', 'stock_issue:cancelled', 'delivered:completed',
    ...(orderType === 'dinein' ? ['kitchen_done:completed'] : []),
  ]);
  return allowed.has(`${current}:${next}`);
}

function labelPayment(method: string) {
  return {
    cash: '现金',
    tng: "Touch 'n Go eWallet",
    stripe: 'Stripe',
    wallet: '钱包',
  }[method] || method;
}

function labelOrderType(type: OrderRow['order_type']) {
  return type === 'dinein' ? '堂食' : '外卖';
}

function labelOrderSource(source?: string | null) {
  if (source === 'admin_created') return '后台代下单';
  return '网站下单';
}

function labelPaymentStatus(status: string) {
  return {
    pay_at_counter: '到店/现金支付',
    pending_review: '待审核',
    awaiting_payment: '待付款',
    paid: '已支付',
  }[status] || status || '-';
}

function labelPaymentReviewStatus(status: string) {
  return {
    not_required: '无需审核',
    pending: '待审核',
    approved: '已通过',
    rejected: '已拒绝',
  }[status] || status || '-';
}

function formatOrderItemOptions(options: NonNullable<OrderItemRow['selected_options']>) {
  return options
    .map(option => `${option.groupName ? `${option.groupName}: ` : ''}${option.name || ''}${Number(option.priceDelta || 0) ? ` +RM ${Number(option.priceDelta).toFixed(2)}` : ''}`)
    .filter(Boolean)
    .join(' · ');
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default AdminDashboard;
