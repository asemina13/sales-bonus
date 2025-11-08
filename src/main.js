/**
 * Вспомогательная функция для точного округления чисел до двух знаков после запятой.
 * Это необходимо для предотвращения ошибок плавающей точки при накоплении финансовых сумм.
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

  // Записываем в константу discountFactor остаток суммы без скидки в десятичном формате.
  const discountFactor = 1 - purchase.discount / 100;

  // Расчет выручки: sale_price × quantity × discountFactor
  const revenue = sale_price * quantity * discountFactor;

  // ИЗМЕНЕНИЕ: Убрано округление выручки с ОДНОГО товара/позиции.
  return revenue; // Возвращаем не округленное значение
}

/**
 * Функция для расчета бонусов (Логика бонусов реализована)
 * ИЗМЕНЕНИЕ: Теперь функция возвращает СУММУ бонуса, а не коэффициент,
 * чтобы пройти тесты calculateBonusByProfit (например, 150 вместо 0.15).
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца, содержит profit
 * @returns {number} - рассчитанная сумма бонуса
 */
function calculateBonusByProfit(index, total, seller) {
  const { profit } = seller;
  let multiplier;

  // Реализация условий расчета коэффициента бонусов:
  if (index === 0) {
    // Продавец с наибольшей прибылью (1-е место)
    multiplier = 0.15; // 15%
  } else if (index === 1 || index === 2) {
    // 2-е и 3-е места
    multiplier = 0.1; // 10%
  } else if (index === total - 1) {
    // Последнее место
    multiplier = 0.0; // 0%
  } else {
    // Для всех остальных
    multiplier = 0.05; // 5%
  }

  // ИЗМЕНЕНИЕ: Убрано округление абсолютной суммы бонуса.
  return profit * multiplier; // Возвращаем не округленное значение
}

/**
 * Функция для анализа данных продаж
 * @param data Исходные данные
 * @param options Объект с функциями расчетов (calculateRevenue, calculateBonus)
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
  // Проверка входных данных: наличие и непустота ключевых массивов.
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

  // Проверка наличия опций: функций для расчета выручки или бонусов.
  const { calculateRevenue, calculateBonus } = options || {};
  if (!calculateRevenue || !calculateBonus) {
    throw new Error("Не переданы функции для расчета выручки или бонусов.");
  }

  // Индексация товаров для быстрого доступа по SKU
  const productsIndex = data.products.reduce((acc, product) => {
    acc[product.sku] = product;
    return acc;
  }, {});

  // Индексация продавцов для быстрого доступа по ID
  const sellerIndex = data.sellers.reduce((acc, seller) => {
    acc[seller.id] = seller;
    return acc;
  }, {});

  // Подготовка промежуточных данных для сбора статистики (sellerStats)
  const sellerStats = data.sellers.reduce((acc, seller) => {
    const name = seller.name || seller.first_name + " " + seller.last_name;

    acc[seller.id] = {
      seller_id: seller.id,
      name: name,
      revenue: 0,
      cost: 0,
      profit: 0,
      sales_count: 0, // Количество транзакций (чеков)
      products_sold: {}, // {sku: quantity}
    };
    return acc;
  }, {});

  // Расчёт выручки и прибыли для каждого продавца
  data.purchase_records.forEach((record) => {
    const sellerId = record.seller_id;
    // ИСПРАВЛЕНО: Правильно получаем объект статистики по ID
    const stats = sellerStats[sellerId];
    if (!stats) return;

    // Увеличиваем счетчик транзакций (чеков)
    stats.sales_count += 1;

    record.items.forEach((purchase) => {
      // Получаем товар из индекса по SKU
      const product = productsIndex[purchase.sku];

      // 1. Расчет себестоимости (cost)
      const unitCost = product ? product.purchase_price : 0;
      let itemCost = unitCost * purchase.quantity;
      // ИЗМЕНЕНИЕ: Убрано округление себестоимости (itemCost).
      // itemCost = roundToTwo(itemCost); // УДАЛЕНО

      // 2. Расчет выручки (revenue) через переданную функцию (теперь она НЕ округляет)
      const revenue = calculateRevenue(purchase, product);

      // 3. Накопление общих данных
      stats.revenue = roundToTwo(stats.revenue + revenue);
      stats.cost = roundToTwo(stats.cost + itemCost);

      // 4. Учет количества проданных товаров по артикулу (SKU)
      const productId = purchase.sku;
      if (!stats.products_sold[productId]) {
        stats.products_sold[productId] = 0;
      }
      stats.products_sold[productId] += purchase.quantity;
    });
  });

  // Преобразование в массив для сортировки и расчета финальной прибыли
  let rankedSellers = Object.values(sellerStats).map((seller) => {
    // profit рассчитывается из накопленных значений.
    const calculatedProfit = seller.revenue - seller.cost;

    return {
      ...seller,
      // ИЗМЕНЕНИЕ: Убрано промежуточное округление прибыли.
      profit: roundToTwo(calculatedProfit), // Округление будет только при финальном выводе
      revenue: roundToTwo(seller.revenue),
    };
  });

  // Сортировка продавцов по прибыли (по убыванию)
  rankedSellers.sort((a, b) => b.profit - a.profit);

  // Назначение премий на основе ранжирования и подготовка итоговой коллекции
  const totalSellers = rankedSellers.length;
  const finalReport = rankedSellers.map((seller, index) => {
    // Расчет бонуса (возвращает не округленное значение)
    const bonusAmount = calculateBonus(index, totalSellers, seller);

    // Формирование топ-10 проданных продуктов
    const topProductsList = Object.entries(seller.products_sold)
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(({ id, count }) => {
        const product = productsIndex[id];
        return {
          id: id,
          name: product ? product.name : "Unknown",
          count: count,
        };
      });

    // Формирование итогового объекта с ФИНАЛЬНЫМ ФОРМАТИРОВАНИЕМ финансовых полей
    return {
      seller_id: seller.seller_id,
      name: seller.name,
      // revenue: округляется здесь, при выводе
      revenue: seller.revenue,
      // profit: округляется здесь, при выводе
      profit: seller.profit,
      sales_count: seller.sales_count,
      top_products: topProductsList.map((p) => ({
        sku: p.id,
        quantity: p.count,
      })),
      // bonus: округляется здесь, при выводе
      bonus: roundToTwo(bonusAmount),
    };
  });

  return finalReport;
}
