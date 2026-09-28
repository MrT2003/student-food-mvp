export type Topping = {
  id: string;
  name: string;
  price: number;
};

export type Choice = {
  id: string;
  label: string;
  description: string;
};

export type DishOptions = {
  toppings: Topping[];
  sugars: Choice[];
  iceLevels: Choice[];
  defaultToppingIds: string[];
  defaultSugarId: string;
  defaultIceId: string;
};

const milkTeaOptions: DishOptions = {
  toppings: [
    { id: "pearls", name: "Trân châu đen", price: 5000 },
    { id: "fruit-jelly", name: "Thạch trái cây", price: 4000 },
    { id: "pudding", name: "Pudding", price: 6000 },
  ],
  sugars: [
    { id: "100", label: "100%", description: "Rất ngọt" },
    { id: "70", label: "70%", description: "Ngọt vừa" },
    { id: "50", label: "50%", description: "Ít ngọt" },
    { id: "30", label: "30%", description: "Hơi ngọt" },
    { id: "0", label: "0%", description: "Không đường" },
  ],
  iceLevels: [
    { id: "normal", label: "Bình thường", description: "" },
    { id: "less", label: "Ít đá", description: "" },
    { id: "none", label: "Không đá", description: "" },
  ],

  // Chọn sẵn để khớp trạng thái trong ảnh.
  defaultToppingIds: ["pearls", "fruit-jelly"],
  defaultSugarId: "50",
  defaultIceId: "less",
};

const emptyOptions: DishOptions = {
  toppings: [],
  sugars: [],
  iceLevels: [],
  defaultToppingIds: [],
  defaultSugarId: "",
  defaultIceId: "",
};

export function getDishOptions(
  restaurantSlug: string,
  itemId: string,
): DishOptions {
  if (
    restaurantSlug === "tra-sua-nha-lam" &&
    itemId === "tra-sua-truyen-thong"
  ) {
    return milkTeaOptions;
  }

  // Không áp dụng tùy chọn trà sữa cho các món khác.
  return emptyOptions;
}