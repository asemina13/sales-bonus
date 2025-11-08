/**
 * Вспомогательная функция для округления до 2 знаков после запятой
 * @param {number} num
 * @returns {number}
 */
const roundToTwo = (num) => +(Math.round(num * 100) / 100).toFixed(2);

/**
 * Расчёт выручки от одной позиции (с учётом скидки)
 * @param {Object} purchase — элемент из record.items
 * @param {Object} _product — товар (не используется, но передаётся)
 * @returns {number} — выручка без округления
 */
function calculateSimpleRevenue(purchase, _product) {
  const { sale_price, quantity, discount = 0 } = purchase;
  const discountFactor = 1 - discount / 100;
  return sale_price * quantity * discountFactor;
}

/**
 * Расчёт бонуса по позиции в рейтинге
 * @param {number} index — позиция в отсортированном массиве (0 = лучший)
 * @param {number} total — общее количество продавцов
 * @param {Object} seller — объект с полем profit
 * @returns {number} — сумма бонуса (не процент!)
 */
function calculateBonusByProfit(index, total, seller) {
  const { profit } = seller;
  let multiplier;

  if (index === 0) {
    multiplier = 0.15;
  } else if (index === 1 || index === 2) {
    multiplier = 0.1;
  } else if (index === total - 1) {
    multiplier = 0.0;
  } else {
    multiplier = 0.05;
  }

  return profit * multiplier;
}

/**
 * Главная функция анализа продаж
 * @param {Object} data — входные данные
 * @param {Object} options — { calculateRevenue, calculateBonus }
 * @returns {Array} — отчёт по продавцам
 */
function analyzeSalesData(data, options) {
  // === 1. Проверка входных данных ===
  if (
    !data ||
    !Array.isArray(data.sellers) ||
    data.sellers.length === 0 ||
    !Array.isArray(data.products) ||
    data.products.length === 0 ||
    !Array.isArray(data.purchase_records) ||
    data.purchase_records.length === 0
  ) {
    throw new Error("Некорректные или неполные входные данные.");
  }

  // === 2. Проверка опций ===
  const { calculateRevenue, calculateBonus } = options || {};
  if (!calculateRevenue || !calculateBonus) {
    throw new Error("Не переданы функции для расчета выручки или бонусов.");
  }

  // === 3. Индексация товаров и продавцов ===
  const productsIndex = Object.fromEntries(
    data.products.map((p) => [p.sku, p])
  );

  const sellerIndex = Object.fromEntries(
    data.sellers.map((s) => {
      const name =
        s.name || `${s.first_name || ""} ${s.last_name || ""}`.trim();
      return [
        s.id,
        {
          seller_id: s.id,
          name,
          revenue: 0,
          cost: 0,
          sales_count: 0,
          products_sold: {},
        },
      ];
    })
  );

  // === 4. Обработка чеков и позиций ===
  data.purchase_records.forEach((record) => {
    const stats = sellerIndex[record.seller_id];
    if (!stats) return;

    stats.sales_count += 1;

    record.items.forEach((purchase) => {
      const product = productsIndex[purchase.sku] || { purchase_price: 0 };

      // Себестоимость позиции
      const itemCost = roundToTwo(product.purchase_price * purchase.quantity);

      // Выручка позиции
      const revenue = roundToTwo(calculateRevenue(purchase, product));

      // Накопление
      stats.revenue += revenue;
      stats.cost += itemCost;

      // Учёт проданных товаров
      const sku = purchase.sku;
      stats.products_sold[sku] =
        (stats.products_sold[sku] || 0) + purchase.quantity;
    });
  });

  // === 5. Формирование массива с прибылью ===
  let rankedSellers = Object.values(sellerIndex).map((s) => ({
    ...s,
    profit: roundToTwo(s.revenue - s.cost),
  }));

  // === 6. Сортировка по прибыли (по убыванию) ===
  rankedSellers.sort((a, b) => b.profit - a.profit);

  // === 7. Финальный отчёт ===
  return rankedSellers.map((seller, index) => {
    const bonus = roundToTwo(
      calculateBonus(index, rankedSellers.length, seller)
    );

    const topProducts = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    return {
      seller_id: seller.seller_id,
      name: seller.name,
      revenue: roundToTwo(seller.revenue),
      profit: seller.profit,
      sales_count: seller.sales_count,
      top_products: topProducts,
      bonus: bonus,
    };
  });
}
