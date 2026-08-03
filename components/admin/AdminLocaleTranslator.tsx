import { useEffect, useRef } from 'react';
import { additionalAdminEnglishText } from './adminEnglishText';

export type AdminLanguage = 'zh' | 'en';

// These are interface labels only. Records entered by staff (names, notes, menu
// content, and so on) are deliberately never translated or modified.
const englishText: Record<string, string> = {
  '全部订单': 'All orders', '待确认': 'Pending confirmation', '待制作': 'Waiting to prepare', '厨房制作中': 'Cooking', '厨房完成': 'Kitchen complete', '缺货异常': 'Out of stock', '制作中': 'Preparing', '配送中': 'Out for delivery', '已送达': 'Delivered', '已完成': 'Completed', '已取消': 'Cancelled',
  '无标签': 'No label', '推荐': 'Recommended', '热卖': 'Best seller', '新品': 'New', '招牌': 'Signature',
  '门店后台管理系统': 'Store Management System', '创建首个管理员': 'Create first administrator', '管理员登录': 'Administrator sign in', '账号': 'Account', '显示名称': 'Display name', '密码': 'Password', '创建并进入后台': 'Create and enter admin', '登录后台': 'Sign in to admin',
  '共': 'Total', '个菜品': 'menu items', '可售': 'Available', '售罄': 'Sold out', '下架': 'Inactive', '搜索菜名、编码、英文名': 'Search menu name, code, or English name', '全部分类': 'All categories', '全部状态': 'All statuses', '新增菜品': 'Add menu item',
  '编码': 'Code', '菜品': 'Menu item', '分类': 'Category', '价格': 'Price', '状态': 'Status', '展示标签': 'Display label', '操作': 'Actions', '刷新': 'Refresh',
  '充值审核': 'Top-up Review', '修改订单': 'Edit order', '关闭': 'Close', '订单状态': 'Order status', '顾客': 'Customer', '电话': 'Phone', '堂食桌号': 'Dine-in table', '配送地址': 'Delivery address', '门店': 'Store', '配送': 'Delivery', '小计': 'Subtotal', '配送费': 'Delivery fee', '优惠': 'Discount', '应付总额': 'Amount due', '支付方式': 'Payment method', '支付状态': 'Payment status', '下单时间': 'Order time', '最近操作': 'Latest action', '订单编号': 'Order number', '用户 ID': 'User ID', '顾客信息': 'Customer information', '姓名': 'Name', '桌号': 'Table number',
  '菜品管理': 'Menu Items', '分类管理': 'Categories', '订单管理': 'Orders', '用户管理': 'Users', '用户下单': 'Create Order', '厨房出餐': 'Kitchen', '配送工作台': 'Delivery', '财务中心': 'Finance', '营销中心': 'Marketing', '代理中心': 'Agents', '门店管理': 'Stores', '账号管理': 'Accounts', '系统设置': 'System Settings',
  '新增分类': 'Add category', '编辑分类': 'Edit category', '保存': 'Save', '取消': 'Cancel', '删除': 'Delete', '编辑': 'Edit', '启用': 'Enable', '停用': 'Disable', '已启用': 'Enabled', '已停用': 'Disabled', '排序': 'Sort order',
  '用户列表': 'Users', '搜索用户': 'Search users', '未命名用户': 'Unnamed user', '暂无数据': 'No data yet', '加载中': 'Loading', '保存中': 'Saving', '正在创建': 'Creating', '确认': 'Confirm', '返回': 'Back', '下一步': 'Next', '上一步': 'Previous',
  '订单菜品': 'Order items', '备注': 'Note', '堂食': 'Dine-in', '外卖': 'Delivery', '现金': 'Cash', '钱包': 'Wallet', '查询': 'Search', '请选择': 'Please select', '请选择门店': 'Please select a store', '新建优惠券': 'Create coupon', '优惠券活动': 'Coupon campaigns', '发放优惠券': 'Issue coupons', '领取与核销': 'Claims & redemptions', '效果分析': 'Analytics', '进行中': 'Active', '已发放': 'Issued', '已核销': 'Redeemed', '核销率': 'Redemption rate', '草稿': 'Draft', '已暂停': 'Paused', '已结束': 'Ended', '发券': 'Issue', '暂停': 'Pause', '上线': 'Publish',
  '基本信息': 'Basic information', '优惠券名称': 'Coupon name', '券码': 'Coupon code', '用户端说明': 'Customer-facing description', '优惠规则': 'Discount rules', '优惠类型': 'Discount type', '固定金额': 'Fixed amount', '百分比折扣': 'Percentage discount', '最低消费 RM': 'Minimum order RM', '最高抵扣 RM': 'Maximum discount RM', '配送费不参与优惠': 'Delivery fee is excluded from the discount', '有效期与发行限制': 'Validity & issue limits', '领取后有效天数': 'Valid days after claim', '活动截止时间': 'Campaign end time', '总发行量（留空不限）': 'Total issue limit (leave blank for unlimited)', '每人限领': 'Per-user limit', '适用范围': 'Eligibility', '订单类型': 'Order type', '指定门店（不选表示全部）': 'Selected stores (all when empty)', '发布': 'Publish', '保存草稿': 'Save draft', '立即上线': 'Publish now', '创建并上线': 'Create & publish',
  '收入': 'Income', '支出': 'Expense', '收款方式': 'Collection method', '付款方式': 'Payment method', '金额（RM）': 'Amount (RM)', '发生时间': 'Transaction time', '备注（选填）': 'Note (optional)', '拍照或上传收据': 'Take a photo or upload a receipt', '确认记录': 'Confirm record', '暂无足够数据': 'Not enough data yet',
  ...additionalAdminEnglishText,
};

const translatableAttributes = ['placeholder', 'title', 'aria-label'] as const;

export function translateAdminText(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return value;
  const prefix = value.slice(0, value.indexOf(trimmed));
  const suffix = value.slice(value.indexOf(trimmed) + trimmed.length);
  if (englishText[trimmed]) return `${prefix}${englishText[trimmed]}${suffix}`;

  // A few status labels include IDs, amounts, or names supplied at runtime.
  // Replace only known interface fragments so those values remain untouched.
  const fragments: [string, string][] = [
    ['个规格组的第', ' option group, option #'], ['个规格组选项翻译必须是数组', ' option group translations must be an array'], ['个规格组翻译格式不正确', ' option group translation has an invalid format'], ['个规格组类型只能是 single 或 multiple', ' option group type must be single or multiple'], ['个规格组至少需要一个选项', ' option group requires at least one option'], ['个规格组 required 必须是布尔值', ' option group required must be a boolean'], ['个规格组的选项 ID「', ' option group option ID “'], ['个规格组名称', ' option group name'], ['个规格组 ID', ' option group ID'], ['个选项翻译格式不正确', ' option translation has an invalid format'], ['个选项价格必须是数字', ' option price must be a number'], ['个选项名称', ' option name'], ['个选项 ID', ' option ID'],
    ['仅无订单归因、佣金流水和提现记录的代理可以删除。此操作会清除其推广绑定、代理申请和激活码，但保留普通用户账号。', 'Only agents with no attributed orders, commission transactions, or withdrawals can be deleted. This removes referral links, agent applications, and activation codes while keeping the regular user account.'],
    ['您好，您的代理申请已审核通过。', 'Hello, your agent application has been approved.'],
    ['请返回网站「个人中心 → 代理合作」，输入代理码完成激活。', 'Return to Profile → Agent Partnership on the website and enter the agent code to activate your account.'],
    ['”？删除后该账号将立即无法登录。', '”? This account will be unable to sign in immediately after deletion.'],
    ['确定删除代理「', 'Delete agent “'], ['确认删除分类「', 'Delete category “'], ['确认删除账号“', 'Delete account “'], ['确认下架「', 'Deactivate “'], ['」吗？', '”?'],
    ['代理 API 返回了非 JSON 响应（HTTP', 'Agent API returned a non-JSON response (HTTP'], ['代理 API 返回了无效 JSON（HTTP', 'Agent API returned invalid JSON (HTTP'], ['请求失败：', 'Request failed: '],
    ['一次性代理码：', 'One-time agent code: '], ['确认创建 · RM', 'Confirm creation · RM'], ['充值成功，余额 RM', 'Top-up successful. Balance RM'], ['图片已处理：', 'Image processed: '], ['菜品已设为', 'Menu item set to '],
    ['，图片已上传：', ', image uploaded: '], ['KB，保存后上传', 'KB, upload on save'], ['KB，超过 500KB，请换一张更小或更简单的图片', 'KB, over 500 KB. Choose a smaller or simpler image.'], ['处理后图片仍有', 'Processed image is still '],
    ['，跳过', ', skipped '], ['位已达上限用户', ' recipient(s) who reached the limit'], ['已发放', 'Issued '], ['张', ' coupons'],
    ['领取后', 'Valid for '], ['天', ' days'], ['到期', 'Expires '], ['有效期至：', 'Valid until: '], ['，最高减 RM', ', maximum discount RM'], ['% 折扣', '% off'], ['减 RM', 'Save RM'], ['满 RM', 'Minimum RM'],
    ['分钟 · 配送费 RM', ' minutes · delivery fee RM'], ['配送地址（', 'Delivery address ('], ['km · 约', 'km · about '], ['分钟', ' minutes'],
    ['订单已创建：', 'Order created: '], ['参考号：', 'Reference: '], ['操作人：', 'Operator: '], ['最后同步', 'Last synced'], ['更多操作', 'More actions'], ['删除标签', 'Remove tag'],
    ['堂食 · 桌号', 'Dine-in · Table '], ['桌号', 'Table '], ['下单', 'Place order'], ['详情', 'Details'], ['名称', 'Name'], ['简介', 'Description'], ['分类名称', 'Category name'], ['菜品属性标签', 'Menu item attribute tags'], ['编辑', 'Edit '], ['添加', 'Add '], ['为', 'for'],
    ["的 Touch 'n Go eWallet 付款已通过", " Touch 'n Go eWallet payment approved"], ["的 Touch 'n Go eWallet 付款已拒绝", " Touch 'n Go eWallet payment rejected"], ['提现', 'Withdrawal '], ['图片上传失败：', 'Image upload failed: '], ['收据上传失败：', 'Receipt upload failed: '], ['图片扩展名必须是', 'Image extension must be '], ['只能包含字母、数字、下划线或横线，最多 64 位', 'may contain letters, numbers, underscores, or hyphens only, up to 64 characters'],
    ['英文', 'English '], ['泰文', 'Thai '], ['越南语', 'Vietnamese '], ['规格/加料翻译必须是数组', 'option/add-on translations must be an array'], ['个规格组选项翻译必须是数组', ' option group translations must be an array'], ['个规格组翻译格式不正确', ' option group translation has an invalid format'], ['个选项翻译格式不正确', ' option translation has an invalid format'], ['个规格组类型只能是 single 或 multiple', ' option group type must be single or multiple'], ['个规格组至少需要一个选项', ' option group requires at least one option'], ['个规格组 required 必须是布尔值', ' option group required must be a boolean'], ['个选项价格必须是数字', ' option price must be a number'], ['个规格组的选项 ID「', ' option group option ID “'], ['规格组 ID「', 'Option group ID “'], ['个规格组名称', ' option group name'], ['个选项名称', ' option name'], ['个选项 ID', ' option ID'], ['个规格组 ID', ' option group ID'],
    ['必须是有效数字', ' must be a valid number'], ['必须是文本', ' must be text'], ['必须是数组', ' must be an array'], ['必填', ' is required'], ['不正确', ' is invalid'], ['」重复', '” is duplicated'], ['个规格组的第', ' option group, option #'], ['个规格组', ' option group'], ['个选项', ' option'], ['第', '#'],
    ['订单状态已更新', 'Order status updated'], ['账号状态更新失败', 'Failed to update account status'], ['分类状态更新失败', 'Failed to update category status'], ['订单详情加载失败', 'Failed to load order details'], ['菜单加载失败', 'Failed to load menu'], ['订单加载失败', 'Failed to load orders'], ['账号加载失败', 'Failed to load accounts'], ['门店加载失败', 'Failed to load stores'], ['顾客加载失败', 'Failed to load customers'], ['保存失败', 'Save failed'], ['删除失败', 'Delete failed'], ['更新失败', 'Update failed'], ['创建失败', 'Create failed'], ['加载失败', 'Load failed'], ['已更新', 'updated'], ['已创建', 'created'], ['已新增', 'added'], ['已删除', 'deleted'], ['确认删除', 'Confirm deletion'], ['确认下架', 'Confirm deactivate'], ['订单状态', 'Order status'], ['支付状态', 'Payment status'], ['支付方式', 'Payment method'], ['配送费', 'Delivery fee'], ['菜品编码', 'Menu item code'], ['菜品名称', 'Menu item name'], ['菜品', 'menu item'], ['分类', 'category'], ['门店', 'store'], ['顾客', 'customer'], ['用户', 'user'], ['账号', 'account'], ['订单', 'order'], ['菜单', 'menu'], ['保存后上传', 'upload after saving'], ['正在处理', 'Processing'], ['处理中', 'Processing'], ['已上传', 'uploaded'], ['已下架', 'deactivated'], ['下架失败', 'Failed to deactivate'], ['全部', 'All'], ['请输入', 'Please enter '], ['请选择', 'Please select '], ['未分配门店', 'No store assigned'], ['桌号', 'Table'], ['分钟', 'minutes'], ['约', 'about '],
  ];
  let translated = trimmed;
  fragments.forEach(([source, target]) => { translated = translated.replaceAll(source, target); });
  translated = translated.replace(/[ \t]{2,}/g, ' ');
  if (/^order\b/.test(translated)) translated = `Order${translated.slice(5)}`;
  return translated === trimmed ? value : `${prefix}${translated}${suffix}`;
}

export function AdminLocaleTranslator({ language }: { language: AdminLanguage }) {
  const originalText = useRef(new WeakMap<Text, string>());
  const renderedText = useRef(new WeakMap<Text, string>());
  const originalAttributes = useRef(new WeakMap<Element, Map<string, string>>());
  const renderedAttributes = useRef(new WeakMap<Element, Map<string, string>>());

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-admin-shell]');
    if (!root) return;
    const nativeConfirm = window.confirm.bind(window);
    const nativePrompt = window.prompt.bind(window);
    const nativeAlert = window.alert.bind(window);
    window.confirm = ((message?: string) => nativeConfirm(language === 'en' ? translateAdminText(String(message || '')) : String(message || ''))) as typeof window.confirm;
    window.prompt = ((message?: string, defaultValue?: string) => nativePrompt(language === 'en' ? translateAdminText(String(message || '')) : String(message || ''), defaultValue)) as typeof window.prompt;
    window.alert = ((message?: unknown) => nativeAlert(language === 'en' ? translateAdminText(String(message || '')) : message)) as typeof window.alert;

    const updateElement = (element: Element) => {
      if (element.closest('[data-admin-user-content]')) return;
      translatableAttributes.forEach(attribute => {
        const value = element.getAttribute(attribute);
        if (value === null) return;
        let saved = originalAttributes.current.get(element);
        if (!saved) {
          saved = new Map();
          originalAttributes.current.set(element, saved);
        }
        let rendered = renderedAttributes.current.get(element);
        if (!rendered) {
          rendered = new Map();
          renderedAttributes.current.set(element, rendered);
        }
        if (!saved.has(attribute) || (rendered.has(attribute) && rendered.get(attribute) !== value)) saved.set(attribute, value);
        const nextValue = language === 'en' ? translateAdminText(saved.get(attribute) || value) : saved.get(attribute) || value;
        rendered.set(attribute, nextValue);
        if (value !== nextValue) element.setAttribute(attribute, nextValue);
      });
    };

    const updateNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node as Text;
        if (text.parentElement?.closest('[data-admin-user-content]')) return;
        const lastRendered = renderedText.current.get(text);
        if (!originalText.current.has(text) || (lastRendered !== undefined && lastRendered !== text.data)) originalText.current.set(text, text.data);
        const nextValue = language === 'en' ? translateAdminText(originalText.current.get(text) || text.data) : originalText.current.get(text) || text.data;
        renderedText.current.set(text, nextValue);
        if (text.data !== nextValue) text.data = nextValue;
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const element = node as Element;
      updateElement(element);
      element.querySelectorAll('*').forEach(updateElement);
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let child = walker.nextNode();
      while (child) {
        updateNode(child);
        child = walker.nextNode();
      }
    };

    updateNode(root);
    const observer = new MutationObserver(records => {
      records.forEach(record => {
        if (record.type === 'characterData') updateNode(record.target);
        else if (record.type === 'attributes') updateElement(record.target as Element);
        else record.addedNodes.forEach(updateNode);
      });
    });
    observer.observe(root, { attributes: true, attributeFilter: [...translatableAttributes], characterData: true, childList: true, subtree: true });
    return () => {
      observer.disconnect();
      window.confirm = nativeConfirm;
      window.prompt = nativePrompt;
      window.alert = nativeAlert;
    };
  }, [language]);

  return null;
}
