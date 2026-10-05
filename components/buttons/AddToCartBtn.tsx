'use client'

import { createClient } from '@/lib/supabase/client'
import { CartServices, AddToCartInput } from '@/services/cart.service'
import { useState } from 'react';


export default function CartTestButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleAddToCart = async () => {
    setIsLoading(true);

    try {
      const inputData: AddToCartInput = {
        // ⚠️ Lưu ý: DB dùng kiểu UUID nên phải truyền đúng định dạng UUID để tránh lỗi Postgres 22P02
        restaurantId: "3e930860-3753-458a-a8d8-94aa4151b87a", 
        menuItemId: "2fd1f3f0-8566-45f5-80b2-b38945b6eb48",
        quantity: 2,
        optionHash: "opt_size_m|opt_sugar_100|opt_thach_phomai|opt_tran_chau_den",
        selectedOptions: [
          {
            group_id: "topping_them_option_Group_id",
            group_name: "Topping theem ",
            options: [
              { id: "100%_duong_id", name: "Size M", additional_price: 0 }
            ]
          },
          {
            group_id: "sugar_group",
            group_name: "Mức đường",
            options: [
              { id: "opt_sugar_100", name: "100% Đường", additional_price: 0 }
            ]
          },
          {
            group_id: "topping_group",
            group_name: "Topping Thêm",
            options: [
              { id: "opt_thach_phomai", name: "Thạch phô mai", additional_price: 8000 },
              { id: "opt_tran_chau_den", name: "Trân châu đen", additional_price: 5000 }
            ]
          }
        ]
      };

      // 1. Thực thi gọi hàm RPC xuống Supabase
      const result = await CartServices.addToCart(inputData);
      console.log("Thêm giỏ hàng thành công:", result);
      alert("Đã thêm vào giỏ hàng thành công! Kiểm tra Console & DB.");

    } catch (error: any) {
      console.error("Lỗi add to cart:", error);
      alert(`Lỗi: ${error.message || "Thêm vào giỏ hàng thất bại"}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ ĐÚNG: Lệnh return JSX phải nằm ở cấp ngoài cùng của React Component
  return (
    <div className="p-4 flex flex-col gap-2 items-start">
      <span className="text-xs text-gray-500 font-mono">
        Debug Tool: Click to trigger Add To Cart RPC
      </span>

      <button
        onClick={handleAddToCart}
        disabled={isLoading}
        className={`px-4 py-2 border rounded-lg shadow-sm font-medium transition-colors ${
          isLoading
            ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
            : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50 active:bg-gray-100"
        }`}
      >
        {isLoading ? "Đang xử lý..." : "Thêm vào giỏ hàng (Test Data)"}
      </button>
    </div>
  );
}

