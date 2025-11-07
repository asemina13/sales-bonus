/**
 * Вспомогательная функция для точного округления чисел до двух знаков после запятой.
 * Это необходимо для предотвращения ошибок плавающей точки при накоплении финансовых сумм.
 * @param {number} num
 * @returns {number}
 */
const roundToTwo = (num) => Math.round(num * 100) / 100;

/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
  const { sale_price, quantity, discount } = purchase;
  const discountFactor = 1 - (discount || 0) / 100;
  return sale_price * quantity * discountFactor;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца, содержит profit
 * @returns {number} - рассчитанная сумма бонуса
 */
function calculateBonusByProfit(index, total, seller) {
  const { profit } = seller;

  if (index === 0) return +(profit * 0.15).toFixed(2);
  else if (index === 1 || index === 2) return +(profit * 0.1).toFixed(2);
  else if (index === total - 1) return 0;
  else return +(profit * 0.05).toFixed(2);
}

/**
 * Функция для анализа данных продаж
 * @param data Исходные данные
 * @param options Объект с функциями расчетов (calculateRevenue, calculateBonus)
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
  // Проверка входных данных
  if (
    !data ||
    !Array.isArray(data.sellers) ||
    !Array.isArray(data.products) ||
    !Array.isArray(data.purchase_records) ||
    data.sellers.length === 0 ||
    data.products.length === 0 ||
    data.purchase_records.length === 0
  ) {
    throw new Error("Некорректные или неполные входные данные.");
  }

  const { calculateRevenue, calculateBonus } = options || {};
  if (
    typeof calculateRevenue !== "function" ||
    typeof calculateBonus !== "function"
  ) {
    throw new Error("Не переданы функции для расчета выручки или бонусов.");
  }

  // Индексация товаров
  const productIndex = data.products.reduce((acc, product) => {
    acc[product.sku] = product;
    return acc;
  }, {});

  // Индексация продавцов
  const sellerStats = data.sellers.reduce((acc, seller) => {
    const name = seller.name || `${seller.first_name} ${seller.last_name}`;
    acc[seller.id] = {
      seller_id: seller.id,
      name,
      revenue: 0,
      cost: 0,
      profit: 0,
      sales_count: 0,
      products_sold: {},
    };
    return acc;
  }, {});

  // Расчёт по каждому чеку
  data.purchase_records.forEach((record) => {
    const stats = sellerStats[record.seller_id];
    if (!stats) return;

    stats.sales_count += 1;

    // Добавляем выручку чека
    stats.revenue += record.total_amount;

    // Для каждого товара считаем себестоимость и прибыль
    record.items.forEach((item) => {
      const product = productIndex[item.sku];
      const cost = (product?.purchase_price || 0) * item.quantity;
      const revenue = calculateRevenue(item, product);
      const profit = revenue - cost;

      stats.profit += profit;

      if (!stats.products_sold[item.sku]) {
        stats.products_sold[item.sku] = 0;
      }
      stats.products_sold[item.sku] += item.quantity;
    });
  });

  // Сортировка продавцов по прибыли (убывание)
  const rankedSellers = Object.values(sellerStats).sort(
    (a, b) => b.profit - a.profit
  );
  const totalSellers = rankedSellers.length;

  // Расчет бонусов и топ-10 продуктов
  const finalReport = rankedSellers.map((seller, index) => {
    const bonusAmount = calculateBonus(index, totalSellers, seller);

    const topProducts = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    return {
      seller_id: seller.seller_id,
      name: seller.name,
      revenue: +seller.revenue.toFixed(2),
      profit: +seller.profit.toFixed(2),
      sales_count: seller.sales_count,
      top_products: topProducts,
      bonus: +bonusAmount.toFixed(2),
    };
  });

  return finalReport;
}

// Экспорт функций для автотестов
module.exports = {
  calculateSimpleRevenue,
  calculateBonusByProfit,
  analyzeSalesData,
};
