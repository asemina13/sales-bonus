/**
 * Округление до 2 знаков
 */
const roundToTwo = (num) => Number((Math.round(num * 100) / 100).toFixed(2));

/**
 * Выручка от одной позиции
 */
function calculateSimpleRevenue(purchase, _product) {
  const { sale_price, quantity, discount = 0 } = purchase;
  const discountFactor = 1 - discount / 100;
  return sale_price * quantity * discountFactor; // без округления
}

/**
 * Бонус по позиции
 */
function calculateBonusByProfit(index, total, seller) {
  const { profit } = seller;
  let multiplier;

  if (index === 0) multiplier = 0.15;
  else if (index === 1 || index === 2) multiplier = 0.1;
  else if (index === total - 1) multiplier = 0.0;
  else multiplier = 0.05;

  return profit * multiplier; // без округления
}

/**
 * Анализ продаж
 */
function analyzeSalesData(data, options) {
  // === Валидация ===
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

  const { calculateRevenue, calculateBonus } = options || {};
  if (!calculateRevenue || !calculateBonus) {
    throw new Error("Не переданы функции для расчета выручки или бонусов.");
  }

  // === Индексы ===
  const productsIndex = Object.fromEntries(
    data.products.map((p) => [p.sku, p])
  );

  const sellerStats = Object.fromEntries(
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

  // === Обработка чеков ===
  data.purchase_records.forEach((record) => {
    const stats = sellerStats[record.seller_id];
    if (!stats) return;

    stats.sales_count += 1;

    record.items.forEach((purchase) => {
      const product = productsIndex[purchase.sku] || { purchase_price: 0 };

      // Округляем на уровне позиции
      const itemCost = roundToTwo(product.purchase_price * purchase.quantity);
      const revenue = roundToTwo(calculateRevenue(purchase, product));

      stats.revenue += revenue;
      stats.cost += itemCost;

      const sku = purchase.sku;
      stats.products_sold[sku] =
        (stats.products_sold[sku] || 0) + purchase.quantity;
    });
  });

  // === Массив продавцов с точной прибылью ===
  let rankedSellers = Object.values(sellerStats).map((s) => ({
    ...s,
    profit: s.revenue - s.cost, // НЕ ОКРУГЛЯЕМ
  }));

  // === Сортировка ===
  rankedSellers.sort((a, b) => b.profit - a.profit);

  // === Финальный отчёт с округлением ===
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
      profit: roundToTwo(seller.profit), // ОКРУГЛЯЕМ ЗДЕСЬ
      sales_count: seller.sales_count,
      top_products: topProducts,
      bonus: bonus, // ОКРУГЛЯЕМ ЗДЕСЬ
    };
  });
}
