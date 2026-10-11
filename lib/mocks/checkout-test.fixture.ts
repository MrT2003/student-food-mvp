import type { SelectedGroup } from '@/utilities/cart_order.utility';

// IDs match supabase/seeds/checkout-test.sql. Raw arrays are deliberately unsorted.
export const checkoutTestItems: { key: string; label: string; restaurantId: string; menuItemId: string; quantity: number; expectedTotal: number; selectedOptions: SelectedGroup[] }[] = [
  {
    "key": "1A",
    "label": "[TEST] Quán 1 — L + phô mai + trân châu",
    "restaurantId": "91000000-0000-4000-8000-000000000001",
    "menuItemId": "91000000-0000-4000-8000-000000000011",
    "quantity": 1,
    "expectedTotal": 50000,
    "selectedOptions": [
      {
        "group_id": "91000000-0000-4000-8000-000000000101",
        "group_name": "Topping",
        "options": [
          {
            "id": "91000000-0000-4000-8000-000000001003",
            "name": "Phô mai",
            "additional_price": 10000
          },
          {
            "id": "91000000-0000-4000-8000-000000001002",
            "name": "Trân châu",
            "additional_price": 5000
          }
        ]
      },
      {
        "group_id": "91000000-0000-4000-8000-000000000100",
        "group_name": "Kích cỡ",
        "options": [
          {
            "id": "91000000-0000-4000-8000-000000001001",
            "name": "Size L",
            "additional_price": 5000
          }
        ]
      }
    ]
  },
  {
    "key": "1B",
    "label": "[TEST] Quán 1 — M + trân châu",
    "restaurantId": "91000000-0000-4000-8000-000000000001",
    "menuItemId": "91000000-0000-4000-8000-000000000011",
    "quantity": 1,
    "expectedTotal": 35000,
    "selectedOptions": [
      {
        "group_id": "91000000-0000-4000-8000-000000000101",
        "group_name": "Topping",
        "options": [
          {
            "id": "91000000-0000-4000-8000-000000001002",
            "name": "Trân châu",
            "additional_price": 5000
          }
        ]
      },
      {
        "group_id": "91000000-0000-4000-8000-000000000100",
        "group_name": "Kích cỡ",
        "options": [
          {
            "id": "91000000-0000-4000-8000-000000001000",
            "name": "Size M",
            "additional_price": 0
          }
        ]
      }
    ]
  },
  {
    "key": "2A",
    "label": "[TEST] Quán 2 — L + phô mai + trân châu",
    "restaurantId": "91000000-0000-4000-8000-000000000002",
    "menuItemId": "91000000-0000-4000-8000-000000000012",
    "quantity": 1,
    "expectedTotal": 60000,
    "selectedOptions": [
      {
        "group_id": "91000000-0000-4000-8000-000000000111",
        "group_name": "Topping",
        "options": [
          {
            "id": "91000000-0000-4000-8000-000000001013",
            "name": "Phô mai",
            "additional_price": 10000
          },
          {
            "id": "91000000-0000-4000-8000-000000001012",
            "name": "Trân châu",
            "additional_price": 5000
          }
        ]
      },
      {
        "group_id": "91000000-0000-4000-8000-000000000110",
        "group_name": "Kích cỡ",
        "options": [
          {
            "id": "91000000-0000-4000-8000-000000001011",
            "name": "Size L",
            "additional_price": 5000
          }
        ]
      }
    ]
  },
  {
    "key": "2B",
    "label": "[TEST] Quán 2 — M + trân châu",
    "restaurantId": "91000000-0000-4000-8000-000000000002",
    "menuItemId": "91000000-0000-4000-8000-000000000012",
    "quantity": 1,
    "expectedTotal": 45000,
    "selectedOptions": [
      {
        "group_id": "91000000-0000-4000-8000-000000000111",
        "group_name": "Topping",
        "options": [
          {
            "id": "91000000-0000-4000-8000-000000001012",
            "name": "Trân châu",
            "additional_price": 5000
          }
        ]
      },
      {
        "group_id": "91000000-0000-4000-8000-000000000110",
        "group_name": "Kích cỡ",
        "options": [
          {
            "id": "91000000-0000-4000-8000-000000001010",
            "name": "Size M",
            "additional_price": 0
          }
        ]
      }
    ]
  }
];
