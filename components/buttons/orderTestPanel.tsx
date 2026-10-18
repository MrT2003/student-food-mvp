'use client';

import { useRef, useState } from 'react';
import { CartServices } from '@/services/cart.service';
import type { CartItemResponse } from '@/services/cart.service';
import { OrderServices } from '@/services/order.service';
import { CartUtilities } from '@/utilities/cart_order.utility';
import { checkoutTestItems } from '@/lib/mocks/checkout-test.fixture';
import { createClient } from '@/lib/supabase/client';
import type { CreateOrderResponse } from '@/types/order.types';

const messageOf = (error: unknown) => error instanceof Error ? error.message
  : typeof error === 'object' && error !== null && 'message' in error ? String(error.message)
  : 'Không thể hoàn tất thao tác.';
const buttonClass = 'rounded-lg bg-blue-700 px-4 py-3 text-white disabled:cursor-not-allowed disabled:opacity-50';

export default function OrderTestPanel() {
  const busy = useRef(false);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [priceOffset, setPriceOffset] = useState(0);
  const [action, setAction] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, CartItemResponse>>({});
  const [sessionId, setSessionId] = useState('');
  const [result, setResult] = useState<CreateOrderResponse | null>(null);
  const [verification, setVerification] = useState<unknown>(null);
  const [error, setError] = useState('');
  const [address, setAddress] = useState('Phòng 402, KTX B');
  const [checkoutAttempted, setCheckoutAttempted] = useState(false);
  const ready = checkoutTestItems.every(item => rows[item.key]);

  const pricesReady = checkoutTestItems.every(item => prices[item.key] !== undefined);
  const expectedTotal = checkoutTestItems.reduce((sum, item) => sum + (prices[item.key] ?? 0) * item.quantity, 0);

  async function loadPrices() {
    const client = createClient();
    const [menus, options] = await Promise.all([
      client.from('menu_items').select('id, price, is_active, is_available').in('id', checkoutTestItems.map(item => item.menuItemId)),
      client.from('menu_item_options').select('id, additional_price, is_active').in('id', checkoutTestItems.flatMap(item => item.selectedOptions.flatMap(group => group.options.map(option => option.id)))),
    ]);
    if (menus.error) throw menus.error;
    if (options.error) throw options.error;
    const next: Record<string, number> = {};
    for (const item of checkoutTestItems) {
      const menu = menus.data.find(row => row.id === item.menuItemId);
      if (!menu?.is_active || !menu.is_available) throw new Error('Món test không còn phục vụ.');
      let unit = Number(menu.price);
      for (const selected of item.selectedOptions.flatMap(group => group.options)) {
        const option = options.data.find(row => row.id === selected.id);
        if (!option?.is_active) throw new Error('Option test không còn phục vụ.');
        unit += Number(option.additional_price);
      }
      next[item.key] = unit;
    }
    setPrices(next);
  }

  async function refreshPrices() {
    if (busy.current || checkoutAttempted) return;
    busy.current = true; setAction('prices'); setError('');
    try { await loadPrices(); }
    catch (error: unknown) { setError(messageOf(error)); }
    finally { busy.current = false; setAction(null); }
  }

  async function prepareCart() {
    if (busy.current || checkoutAttempted) return;
    busy.current = true;
    setAction('prepare'); setError('');
    try {
      const client = createClient();
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || !auth.user) throw new Error('Vui lòng đăng nhập bằng tài khoản student trước.');
      const { data: cart, error: cartError } = await client.from('carts').select('id')
        .eq('student_id', auth.user.id).maybeSingle();
      if (cartError) throw cartError;
      const existing: CartItemResponse[] = [];
      if (cart) {
        const response = await client.from('cart_items').select('*').eq('cart_id', cart.id)
          .in('menu_item_id', checkoutTestItems.map(item => item.menuItemId));
        if (response.error) throw response.error;
        existing.push(...(response.data as unknown as CartItemResponse[]));
      }
      for (const item of checkoutTestItems) {
        const hash = CartUtilities.generateHash(item.selectedOptions);
        const matches = existing.filter(row => row.menu_item_id === item.menuItemId
          && row.restaurant_id === item.restaurantId && row.option_hash === hash);
        if (matches.length > 1) throw new Error(`Có nhiều dòng giỏ trùng hash cho ${item.key}. Kiểm tra database trước.`);
        // Reuse seeded items already in cart after a reload/partial failure, without incrementing again.
        const row = matches[0] ?? await CartServices.addToCart({
          restaurantId: item.restaurantId, menuItemId: item.menuItemId, quantity: item.quantity,
          optionHash: hash,
          selectedOptions: CartUtilities.formatSortSelectedOptions(item.selectedOptions),
        });
        if (!row?.id) throw new Error('add_to_cart phải trả về một cart item có id.');
        setRows(current => ({ ...current, [item.key]: row }));
      }
      await loadPrices();
    } catch (error: unknown) { setError(messageOf(error)); }
    finally { busy.current = false; setAction(null); }
  }

  async function checkout() {
    if (busy.current || !ready || !pricesReady || checkoutAttempted || !address.trim()) return;
    busy.current = true; setAction('checkout'); setError('');
    setCheckoutAttempted(true);
    try {
      const response = await OrderServices.createOrder({
        items: checkoutTestItems.map(item => ({cartItemId: rows[item.key].id, quantity: item.quantity, expectedUnitPrice: prices[item.key]})),
        deliveryAddress: address.trim(), customerNotes: 'TEST: 2 quán, mỗi quán 2 cấu hình món',
        paymentMethod: 'cash', expectedTotal: expectedTotal + priceOffset,
      });
      setResult(response);
      setSessionId(response.sessionCheckoutId);
      if (!response.sessionCheckoutId || response.orders.length !== 2
        || new Set(response.orders.map(order => order.restaurantId)).size !== 2
        || checkoutTestItems.some(item => !response.orders.some(order => order.restaurantId === item.restaurantId))) {
        throw new Error('RPC đã trả kết quả nhưng không khớp 2 quán / session mong đợi. Hãy kiểm tra DB.');
      }
    } catch (error: unknown) {
      const message = messageOf(error);
      setError(message);
      if (message.includes('PRICE_MISMATCH')) setCheckoutAttempted(false);
    }
    finally { busy.current = false; setAction(null); }
  }

  async function verifyDatabase() {
    if (busy.current || !sessionId) return;
    busy.current = true; setAction('verify'); setError('');
    try {
      const client = createClient();
      const { data: orders, error: orderError } = await client.from('orders')
        .select('id, restaurant_id, session_checkout_id, subtotal, total, order_items(*)')
        .eq('session_checkout_id', sessionId);
      if (orderError) throw orderError;
      const { data: remaining, error: cartError } = await client.from('cart_items').select('*')
        .in('id', Object.values(rows).map(row => row.id));
      if (cartError) throw cartError;
      const checks = {
        twoOrders: orders.length === 2,
        sharedSession: orders.length === 2 && orders.every(order => order.session_checkout_id === sessionId),
        twoItemsPerRestaurant: [...new Set(checkoutTestItems.map(item => item.restaurantId))].every(restaurantId => {
          const matches = orders.filter(order => order.restaurant_id === restaurantId);
          return matches.length === 1 && matches[0].order_items.length === 2
            && matches[0].order_items.every(item => item.quantity === 1)
            && Number(matches[0].total) === checkoutTestItems.filter(item => item.restaurantId === restaurantId)
              .reduce((sum, item) => sum + prices[item.key] * item.quantity, 0);
        }),
        matchesDisplayedTotal: orders.reduce((sum, order) => sum + Number(order.total), 0) === expectedTotal,
        cartQuantitiesReduced: checkoutTestItems.every(item => {
          const before = rows[item.key];
          const after = remaining.find(row => row.id === before.id);
          return before.quantity === 1 ? !after : after?.quantity === before.quantity - 1;
        }),
      };
      setVerification({ checks, orders, remainingCartItems: remaining });
    } catch (error: unknown) { setError(messageOf(error)); }
    finally { busy.current = false; setAction(null); }
  }

  return (
    <section className="mx-auto my-8 max-w-5xl space-y-5 rounded-xl border bg-white p-6">
      <h2 className="text-xl font-bold">Test checkout: 4 dòng món • 2 cửa hàng • 1 session</h2>
      <p>Chạy supabase/seeds/checkout-test.sql trước. Mỗi quán dùng cùng một món với hai bộ options khác nhau, mỗi dòng mua 1 phần.</p>
      <p className="text-sm">Quán 1: 85.000đ • Quán 2: 105.000đ • Tổng: 190.000đ. Không tạo sẵn đơn bằng SQL.</p>
      <button type="button" className={buttonClass} disabled={!!action || checkoutAttempted} onClick={() => void prepareCart()}>
        {action === 'prepare' ? 'Đang thêm...' : '1. Thêm / tải lại đủ 4 dòng giỏ hàng'}
      </button>
      <div className="grid gap-4 md:grid-cols-2">
        {checkoutTestItems.map(item => (
          <article key={item.key} className="min-w-0 space-y-2 rounded-lg border p-3">
            <h3 className="font-semibold">{item.key}: {item.label}</h3>
            <p>Mua: 1 • Giá dự kiến: {prices[item.key]?.toLocaleString('vi-VN') ?? 'Chưa tải'}đ</p>
            <p className="break-all text-sm">Cart ID: {rows[item.key]?.id ?? 'Chưa thêm'}</p>
            {rows[item.key] && <p>Số lượng trong giỏ: {rows[item.key].quantity} (checkout chỉ lấy 1)</p>}
            <details><summary>JSON trước / sau sort và kết quả add_to_cart</summary>
              <pre className="overflow-auto text-xs">{JSON.stringify({
                raw: item.selectedOptions,
                formatted: CartUtilities.formatSortSelectedOptions(item.selectedOptions),
                hash: CartUtilities.generateHash(item.selectedOptions),
                returnedCartItem: rows[item.key] ?? null,
              }, null, 2)}</pre>
            </details>
          </article>
        ))}
      </div>
      <p className="text-sm">Kiểm tra thứ tự phần tử trong mảng groups/options; JSONB không bảo toàn thứ tự key của object.</p>
      <button type="button" className={buttonClass} disabled={!!action || checkoutAttempted} onClick={() => void refreshPrices()}>Tải lại giá hiện tại</button>
      <p>Tổng đang hiển thị: {pricesReady ? expectedTotal.toLocaleString('vi-VN') + 'đ' : 'Chưa tải'}</p>
      <label className="block"><input type="checkbox" checked={priceOffset !== 0} disabled={!!action || checkoutAttempted}
        onChange={event => setPriceOffset(event.target.checked ? 1000 : 0)} /> Test tổng sai: gửi thêm 1.000đ để nhận PRICE_MISMATCH</label>
      <label className="block">Địa chỉ giao hàng
        <input className="mt-1 block w-full rounded border p-2" value={address} disabled={checkoutAttempted}
          onChange={event => setAddress(event.target.value)} />
      </label>
      <button type="button" className={buttonClass} disabled={!!action || !ready || checkoutAttempted || !address.trim()}
        onClick={() => void checkout()}>{action === 'checkout' ? 'Đang đặt...' : '2. Đặt 4 món trong cùng một session'}</button>
      {sessionId && <p className="break-all font-mono">session_checkout_id: {sessionId}</p>}
      {checkoutAttempted && <p className="text-sm">Đã gửi checkout. Session do RPC tạo. Nếu mất phản hồi, kiểm tra đơn theo user/thời gian trong DB trước khi thử lại; RPC chưa hỗ trợ retry idempotent. Reload panel để bắt đầu lượt test mới.</p>}
      <button type="button" className={buttonClass} disabled={!!action || !sessionId} onClick={() => void verifyDatabase()}>
        {action === 'verify' ? 'Đang đọc DB...' : '3. Đọc DB kiểm tra 2 orders / 4 order_items'}
      </button>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
      {result && <details open><summary>Kết quả RPC</summary><pre className="overflow-auto text-xs">{JSON.stringify(result, null, 2)}</pre></details>}
      {verification !== null && <details open><summary>Kiểm tra database (cần policy SELECT của user)</summary><pre className="overflow-auto text-xs">{JSON.stringify(verification, null, 2)}</pre></details>}
    </section>
  );
}
