'use client'

import { AddToCartInput, CartServices } from '@/services/cart.service';
import { CartUtilities, SelectedGroup } from '@/utilities/cart_order.utility';
import { useState } from 'react';

export default function CartTestPanel() {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // State lưu ID của 2 món ăn trong giỏ để test
  const [itemAId, setItemAId] = useState<string>(''); // Món A: 100% Đường
  const [itemBId, setItemBId] = useState<string>(''); // Món B: 50% Đường

  const RESTAURANT_ID = "3e930860-3753-458a-a8d8-94aa4151b87a";
  const MENU_ITEM_ID = "2fd1f3f0-8566-45f5-80b2-b38945b6eb48";

  // Cấu hình Món A (100% Đường)
  // const OPTION_A_HASH = "opt_size_m|opt_sugar_100";
  const OPTION_A_GROUPS: SelectedGroup[] = [
    {
      group_id: "2",
      // Not insert into cart_items table but insert into the order_items 
      // History : snapshot 
      // Order history : Snapshot - Call query to supabse just to get order information : 
      // Fetch JSONB and display but not required to request to supabase 
      group_name: "Kích cỡ",
      options: [{ id: "2_M", name: "Size M", additional_price: 0 }]
    },
    {
      group_id: "sugar_group",
      group_name: "Mức đường",
      options: [{ id: "opt_sugar_100", name: "100% Đường", additional_price: 20000 }]
    }
  ];
  const OPTION_A_HASH = CartUtilities.generateHash(OPTION_A_GROUPS)
  console.log("OPTION_A_HASH: ", OPTION_A_HASH)


  // Cấu hình Món B (50% Đường)
  // const OPTION_B_HASH = "opt_size_m|opt_sugar_50";
  const OPTION_B_GROUPS: SelectedGroup[] = [
    {
      group_id: "size_group",
      group_name: "Kích cỡ",
      options: [{ id: "opt_size_m", name: "Size M", additional_price: 0 }]
    },
    {
      group_id: "sugar_group",
      group_name: "Mức đường",
      options: [{ id: "opt_sugar_50", name: "50% Đường", additional_price: 0 }]
    }
  ];
  const OPTION_B_HASH = CartUtilities.generateHash(OPTION_B_GROUPS);
  console.log("OPTION_B_HASH: ", OPTION_B_HASH)


  // Cấu hình Option C Hoàn toàn mới (30% Đường + Thêm Trân Châu) - KHÔNG TRÙNG MÓN A
  const OPTION_C_HASH = "opt_size_m|opt_sugar_30|opt_tran_chau";
  const OPTION_C_GROUPS: SelectedGroup[] = [
    {
      group_id: "size_group",
      group_name: "Kích cỡ",
      options: [{ id: "opt_size_m", name: "Size M", additional_price: 0 }]
    },
    {
      group_id: "sugar_group",
      group_name: "Mức đường",
      options: [{ id: "opt_sugar_30", name: "30% Đường", additional_price: 0 }]
    },
    {
      group_id: "topping_group",
      group_name: "Topping Thêm",
      options: [{ id: "opt_tran_chau", name: "Trân châu đen", additional_price: 5000 }]
    }
  ];

  // 1. TẠO MÓN A (Qty: 2, 100% Đường)
  const handleAddOptionA = async () => {
    setLoadingAction('add_a');
    try {
      const res = await CartServices.addToCart({
        restaurantId: RESTAURANT_ID,
        menuItemId: MENU_ITEM_ID,
        quantity: 2,
        optionHash: OPTION_A_HASH,
        selectedOptions: OPTION_A_GROUPS
      });
      setItemAId(res.id);
      alert(`✅ Đã tạo Món A (100% Đường)\nID: ${res.id}\nSố lượng: ${res.quantity}`);
    } catch (e: any) {
      alert(`Lỗi: ${e.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  // 2. TẠO MÓN B (Qty: 1, 50% Đường)
  const handleAddOptionB = async () => {
    setLoadingAction('add_b');
    try {
      const res = await CartServices.addToCart({
        restaurantId: RESTAURANT_ID,
        menuItemId: MENU_ITEM_ID,
        quantity: 1,
        optionHash: OPTION_B_HASH,
        selectedOptions: OPTION_B_GROUPS
      });
      setItemBId(res.id);
      alert(`✅ Đã tạo Món B (50% Đường)\nID: ${res.id}\nSố lượng: ${res.quantity}`);
    } catch (e: any) {
      alert(`Lỗi: ${e.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  // 3. ✨ CASE 1: SỬA MÓN B KHÔNG TRÙNG MÓN A (Chuyển sang 30% đường + Topping, đổi Qty thành 4)
  // Kỳ vọng: Status 'UPDATED', Giữ nguyên ID Món B, Cập nhật Option & Quantity mới trực tiếp
  const handleUpdateNoCollision = async () => {
    if (!itemBId) {
      alert("Vui lòng tạo Món B trước!");
      return;
    }

    setLoadingAction('update_no_collision');
    try {
      const newQty = 4; // Cập nhật lại số lượng mới
      const result = await CartServices.updateOptions(
        itemBId,
        OPTION_C_HASH,   // Hash mới (30% đường + Trân châu)
        OPTION_C_GROUPS, // Option mới
        newQty           // Số lượng mới
      );

      console.log("✅ [Update No Collision Result]:", result);

      if (result.status === 'UPDATED') {
        alert(
          `✨ CẬP NHẬT MÓN B THÀNH CÔNG (KHÔNG TRÙNG)!\n\n` +
          `- Status: UPDATED\n` +
          `- ID Món B vẫn giữ nguyên: ${result.item.id}\n` +
          `- Số lượng mới: ${result.item.quantity}\n` +
          `- Option Hash mới: ${result.item.option_hash}`
        );
      }
    } catch (e: any) {
      alert(`Lỗi Update: ${e.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  // 4. 🔥 CASE 2: SỬA MÓN B TRÙNG VỚI MÓN A (Chuyển sang 100% đường)
  // Kỳ vọng: Status 'MERGED', Món B bị XÓA khỏi DB, Món A được cộng dồn số lượng
  const handleTestMergeBToA = async () => {
    if (!itemBId || !itemAId) {
      alert("Cần tạo cả Món A và Món B trước để test Merge!");
      return;
    }

    setLoadingAction('merge');
    try {
      const result = await CartServices.updateOptions(
        itemBId,
        OPTION_A_HASH,   // Hash trùng Món A
        OPTION_A_GROUPS, // Option trùng Món A
        2                // Số lượng Món B muốn cộng dồn thêm
      );

      console.log("✅ [Test MERGE Result]:", result);

      if (result.status === 'MERGED') {
        alert(
          `🎉 MERGE THÀNH CÔNG!\n\n` +
          `- Status: MERGED\n` +
          `- Món B (ID: ${result.deletedCartItemId}) ĐÃ BỊ XÓA KHỎI DB.\n` +
          `- Món A ĐÃ CỘNG DỒN TỔNG SỐ LƯỢNG MỚI = ${result.mergedItem.quantity}`
        );
        setItemBId(''); // Xóa ID Món B trên UI vì trong DB đã bị xóa
      }
    } catch (e: any) {
      alert(`Lỗi Merge: ${e.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  // 5. TEST UPDATE QUANTITY THỦ CÔNG
  const handleUpdateQuantity = async (targetId: string, newQty: number) => {
    if (!targetId) return alert("Chưa có ID để update số lượng!");

    setLoadingAction(`qty_${targetId}_${newQty}`);
    try {
      const res = await CartServices.updateQuantity(targetId, newQty);
      alert(`Đã cập nhật số lượng thành ${newQty}! Status: ${res.status}`);
    } catch (e: any) {
      alert(`Lỗi: ${e.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  // 6. TEST DELETE CART ITEM
  const handleDeleteItem = async (isItemA: boolean) => {
    const targetId = isItemA ? itemAId : itemBId;
    if (!targetId) return alert("Chưa có ID để xóa!");

    setLoadingAction('delete');
    try {
      const res = await CartServices.deleteCartItem(targetId);
      alert(`Xóa thành công món ID: ${res.deletedCartItemId}`);
      if (isItemA) setItemAId('');
      else setItemBId('');
    } catch (e: any) {
      alert(`Lỗi: ${e.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto my-8 border rounded-xl shadow-sm bg-white flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-bold text-gray-800">🛠️ Cart RPC Testing Suite</h2>
        <p className="text-xs text-gray-500 font-mono mt-1">
          Kiểm thử cả 2 kịch bản: Update Option độc lập & Update Option trùng khớp (Merge)
        </p>
      </div>

      {/* Monitor hiển thị ID 2 món đang test trong DB */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-gray-50 border rounded-lg text-xs font-mono">
        <div className="flex flex-col gap-1">
          <span className="font-bold text-blue-700">Món A (100% Đường - Qty 2):</span>
          <span className="truncate text-gray-700 bg-white p-1.5 border rounded">
            {itemAId || 'Chưa tạo'}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-bold text-purple-700">Món B (50% Đường - Qty 1):</span>
          <span className="truncate text-gray-700 bg-white p-1.5 border rounded">
            {itemBId || 'Chưa tạo'}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {/* BƯỚC 1: KHỞI TẠO DỮ LIỆU */}
        <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
          Bước 1: Chuẩn bị dữ liệu mẫu
        </span>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleAddOptionA}
            disabled={loadingAction !== null}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors disabled:opacity-50"
          >
            {loadingAction === 'add_a' ? "Đang tạo..." : "1. Add Món A (100% Đường)"}
          </button>
          <button
            onClick={handleAddOptionB}
            disabled={loadingAction !== null}
            className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded transition-colors disabled:opacity-50"
          >
            {loadingAction === 'add_b' ? "Đang tạo..." : "2. Add Món B (50% Đường)"}
          </button>
        </div>

        {/* BƯỚC 2: KIỂM THỬ CÁC CASE UPDATE OPTION */}
        <span className="text-xs font-bold text-gray-600 uppercase tracking-wider mt-2">
          Bước 2: Test Logic Update Options
        </span>
        
        {/* CASE 1: Đổi Option KHÔNG trùng Món A */}
        <button
          onClick={handleUpdateNoCollision}
          disabled={loadingAction !== null || !itemBId}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {loadingAction === 'update_no_collision'
            ? "Đang xử lý..."
            : "✨ Test Case 1: Sửa Món B sang Option Mới (Không trùng A, Qty -> 4)"}
        </button>

        {/* CASE 2: Đổi Option TRÙNG Món A */}
        <button
          onClick={handleTestMergeBToA}
          disabled={loadingAction !== null || !itemAId || !itemBId}
          className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {loadingAction === 'merge'
            ? "Đang xử lý Merge..."
            : "🔥 Test Case 2: Sửa Món B trùng Option Món A (Merge & Delete B)"}
        </button>

        {/* CÁC THAO TÁC PHỤ */}
        <span className="text-xs font-bold text-gray-600 uppercase tracking-wider mt-2">
          Thao tác Quản lý Món
        </span>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleUpdateQuantity(itemAId || itemBId, 5)}
            disabled={loadingAction !== null || (!itemAId && !itemBId)}
            className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white text-xs font-medium rounded disabled:opacity-50"
          >
            Set Qty = 5
          </button>
          <button
            onClick={() => handleDeleteItem(true)}
            disabled={loadingAction !== null || !itemAId}
            className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded disabled:opacity-50"
          >
            Xóa Món A
          </button>
        </div>
      </div>
    </div>
  );
}
