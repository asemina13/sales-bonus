/**
 * Вспомогательная функция для точного округления чисел до двух знаков после запятой.
 * @param {number} num
 * @returns {number}
 */
const roundToTwo = (num) => Number(num.toFixed(2));

/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
  const { sale_price, quantity } = purchase;
  const discountFactor = 1 - purchase.discount / 100;
  const revenue = sale_price * quantity * discountFactor;
  return revenue; // без округления
}

/**
 * Функция для расчета бонусов
 * Возвращает **сумму** бонуса (например 150 вместо 0.15).
 * @param index   порядковый номер в отсортированном массиве
 * @param total   общее число продавцов
 * @param seller  карточка продавца, содержит profit
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
  const { profit } = seller;
  let multiplier;

  if (index === 0) multiplier = 0.15; // 1-е место
  else if (index === 1 || index === 2) multiplier = 0.1; // 2-е / 3-е
  else if (index === total - 1) multiplier = 0.0; // последнее
  else multiplier = 0.05; // остальные

  return profit * multiplier; // без округления
}

/**
 * Функция для анализа данных продаж
 * @param data    Исходные данные
 * @param options Объект с функциями расчетов
 * @returns {Array}
 */
function analyzeSalesData(data, options) {
  // ────── Валидация входных данных ──────
  if (
    !data ||
    !data.sellers ||
    !data.products ||
    !data.purchase_records ||
    data.sellers.length === 0 ||
    data.products.length === 0 ||
    data.purchase_records.length === 0
  ) {
    throw new Error("Некорректные или неполные входные данные.");
  }

  const { calculateRevenue, calculateBonus } = options || {};
  if (!calculateRevenue || !calculateBonus) {
    throw new Error("Не переданы функции для расчета выручки или бонусов.");
  }

  // ────── Индексы для O(1) доступа ──────
  const productsIndex = data.products.reduce((acc, p) => {
    acc[p.sku] = p;
    return acc;
  }, {});

  // ────── Статистика по каждому продавцу ──────
  const sellerStats = data.sellers.reduce((acc, s) => {
    const name = s.name || `${s.first_name || ""} ${s.last_name || ""}`.trim();
    acc[s.id] = {
      seller_id: s.id,
      name,
      revenue: 0,
      cost: 0,
      sales_count: 0,
      products_sold: {}, // sku → quantity
    };
    return acc;
  }, {});

  // ────── Обходим все записи покупок ──────
  data.purchase_records.forEach((record) => {
    const stats = sellerStats[record.seller_id];
    if (!stats) return;

    stats.sales_count += 1;

    record.items.forEach((purchase) => {
      const product = productsIndex[purchase.sku] || { purchase_price: 0 };

      // себестоимость позиции
      const itemCost = product.purchase_price * purchase.quantity;

      // выручка позиции (через переданную функцию)
      const revenue = calculateRevenue(purchase, product);

      // **накапливаем без округления**
      stats.revenue += revenue;
      stats.cost += itemCost;

      // статистика по товарам
      const sku = purchase.sku;
      stats.products_sold[sku] =
        (stats.products_sold[sku] || 0) + purchase.quantity;
    });
  });

  // ────── Формируем массив продавцов и считаем profit ──────
  let rankedSellers = Object.values(sellerStats).map((s) => ({
    ...s,
    profit: s.revenue - s.cost, // без округления
  }));

  // сортируем по прибыли (по убыванию)
  rankedSellers.sort((a, b) => b.profit - a.profit);

  // ────── Финальный отчёт ──────
  const total = rankedSellers.length;

  return rankedSellers.map((seller, idx) => {
    const bonusAmount = calculateBonus(idx, total, seller);

    // топ-10 товаров
    const topProducts = Object.entries(seller.products_sold)
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(({ id, count }) => {
        const p = productsIndex[id];
        return {
          sku: id,
          quantity: count,
        };
      });

    // **округление только здесь**
    return {
      seller_id: seller.seller_id,
      name: seller.name,
      revenue: roundToTwo(seller.revenue),
      profit: roundToTwo(seller.profit),
      sales_count: seller.sales_count,
      top_products: topProducts,
      bonus: roundToTwo(bonusAmount),
    };
  });
}
