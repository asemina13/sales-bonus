/**
 * Вспомогательная функция для точного округления до двух знаков после запятой.
 * @param {number} num
 * @returns {number}
 */
const roundToTwo = (num) => Number((Math.round(num * 100) / 100).toFixed(2));

/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number} — НЕ ОКРУГЛЁННОЕ значение
 */
function calculateSimpleRevenue(purchase, _product) {
  const { sale_price, quantity } = purchase;
  const discountFactor = 1 - purchase.discount / 100;
  return sale_price * quantity * discountFactor; // без округления
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number} — НЕ ОКРУГЛЁННЫЙ бонус
 */
function calculateBonusByProfit(index, total, seller) {
  const { profit } = seller;
  let multiplier;

  if (index === 0) multiplier = 0.15;
  else if (index === 1 || index === 2) multiplier = 0.1;
  else if (index === total - 1) multiplier = 0.0;
  else multiplier = 0.05;

  return profit * multiplier;
}

/**
 * Функция для анализа данных продаж
 */
function analyzeSalesData(data, options) {
  // ────── Валидация ──────
  if (
    !data ||
    !data.sellers?.length ||
    !data.products?.length ||
    !data.purchase_records?.length
  ) {
    throw new Error("Некорректные или неполные входные данные.");
  }

  const { calculateRevenue, calculateBonus } = options || {};
  if (!calculateRevenue || !calculateBonus) {
    throw new Error("Не переданы функции для расчета выручки или бонусов.");
  }

  // ────── Индексы ──────
  const productsIndex = Object.fromEntries(
    data.products.map((p) => [p.sku, p])
  );

  // ────── Статистика по продавцам ──────
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

  // ────── Обработка покупок ──────
  for (const record of data.purchase_records) {
    const stats = sellerStats[record.seller_id];
    if (!stats) continue;

    stats.sales_count += 1;

    for (const purchase of record.items) {
      const product = productsIndex[purchase.sku] || { purchase_price: 0 };

      // Себестоимость — округляем сразу
      const itemCost = roundToTwo(product.purchase_price * purchase.quantity);

      // Выручка — считаем, затем округляем
      const rawRevenue = calculateRevenue(purchase, product);
      const revenue = roundToTwo(rawRevenue);

      // Накопление
      stats.revenue += revenue;
      stats.cost += itemCost;

      // Товары
      stats.products_sold[purchase.sku] =
        (stats.products_sold[purchase.sku] || 0) + purchase.quantity;
    }
  }

  // ────── Формируем массив и считаем profit ──────
  let rankedSellers = Object.values(sellerStats).map((s) => ({
    ...s,
    profit: s.revenue - s.cost, // точная разница
  }));

  rankedSellers.sort((a, b) => b.profit - a.profit);

  // ────── Финальный отчёт ──────
  return rankedSellers.map((seller, idx) => {
    const bonusAmount = roundToTwo(
      calculateBonus(idx, rankedSellers.length, seller)
    );

    const topProducts = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    return {
      seller_id: seller.seller_id,
      name: seller.name,
      revenue: roundToTwo(seller.revenue),
      profit: roundToTwo(seller.profit),
      sales_count: seller.sales_count,
      top_products: topProducts,
      bonus: bonusAmount,
    };
  });
}
