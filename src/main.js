/**
 * Точное округление до 2 знаков после запятой
 */
const roundToTwo = (num) => Math.round(num * 100) / 100;

/**
 * Расчет выручки — возвращает НЕОКРУГЛЁННОЕ значение
 */
function calculateSimpleRevenue(purchase, _product) {
  const { sale_price, quantity } = purchase;
  const discountFactor = 1 - purchase.discount / 100;
  return sale_price * quantity * discountFactor;
}

/**
 * Расчет бонуса — возвращает НЕОКРУГЛЁННЫЙ бонус
 */
function calculateBonusByProfit(index, total, seller) {
  const { profit } = seller;
  let multiplier = 0.05;

  if (index === 0) multiplier = 0.15;
  else if (index === 1 || index === 2) multiplier = 0.1;
  else if (index === total - 1) multiplier = 0.0;

  return profit * multiplier;
}

/**
 * Анализ данных продаж
 */
function analyzeSalesData(data, options) {
  // Валидация
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

  // Индексы
  const productsIndex = Object.fromEntries(
    data.products.map((p) => [p.sku, p])
  );

  // Статистика по продавцам
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

  // Обработка покупок
  for (const record of data.purchase_records) {
    const stats = sellerStats[record.seller_id];
    if (!stats) continue;

    stats.sales_count += 1;

    for (const purchase of record.items) {
      const product = productsIndex[purchase.sku] || { purchase_price: 0 };

      // Округляем себестоимость позиции
      const itemCost = roundToTwo(product.purchase_price * purchase.quantity);

      // Считаем и округляем выручку позиции
      const rawRevenue = calculateRevenue(purchase, product);
      const revenue = roundToTwo(rawRevenue);

      // Накопление
      stats.revenue += revenue;
      stats.cost += itemCost;

      // Товары
      const sku = purchase.sku;
      stats.products_sold[sku] =
        (stats.products_sold[sku] || 0) + purchase.quantity;
    }
  }

  // Формируем массив продавцов с profit
  let rankedSellers = Object.values(sellerStats).map((s) => ({
    ...s,
    profit: roundToTwo(s.revenue - s.cost), // profit из округлённых revenue/cost
  }));

  // Сортировка по прибыли
  rankedSellers.sort((a, b) => b.profit - a.profit);

  // Финальный отчёт
  return rankedSellers.map((seller, idx) => {
    const rawBonus = calculateBonus(idx, rankedSellers.length, seller);
    const bonus = roundToTwo(rawBonus);

    const topProducts = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    return {
      seller_id: seller.seller_id,
      name: seller.name,
      revenue: roundToTwo(seller.revenue),
      profit: seller.profit, // уже округлён выше
      sales_count: seller.sales_count,
      top_products: topProducts,
      bonus: bonus,
    };
  });
}
