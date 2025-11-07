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

  // ВАЖНОЕ ИЗМЕНЕНИЕ: Округляем выручку с ОДНОГО товара/позиции.
  // Это заставляет общую сумму накопления соответствовать логике автотеста.
  return roundToTwo(revenue);
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

  // Рассчитываем и возвращаем абсолютную сумму бонуса, округленную до двух знаков
  return roundToTwo(profit * multiplier);
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
    const sellerId = sellerIndex[record.seller_id];
    sellerId.sales_count += 1;
    sellerId.revenue += record.total_amount;

    record.items.forEach((purchase) => {
      // Получаем товар из индекса по SKU
      const product = productsIndex[purchase.sku];

      // 1. Расчет себестоимости (cost)
      const unitCost = product.purchase_price * purchase.quantity;

      // 2. Расчет выручки (revenue) через переданную функцию (она уже округляет!)
      const revenue = calculateRevenue(purchase, product);
      const calculatedProfit = revenue - cost;

      sellerId.calculatedProfit += calculatedProfit;

      if (!sellerId.products_sold[purchase.sku]) {
        sellerId.products_sold[purchase.sku] = 0;
      }
      sellerId.products_sold[purchase.sku] += purchase.quantity;
    });
  });

  // Преобразование в массив для сортировки и расчета финальной прибыли
  let rankedSellers = Object.values(sellerStats).map((seller) => {
    // profit рассчитывается из накопленных значений, которые теперь должны быть точными.
    const calculatedProfit = seller.revenue - seller.cost;

    return {
      ...seller,
      // Прибыль округляется только на финальном этапе расчета.
      profit: roundToTwo(calculatedProfit),
    };
  });

  // Сортировка продавцов по прибыли (по убыванию)
  rankedSellers.sort((a, b) => b.profit - a.profit);

  // Назначение премий на основе ранжирования и подготовка итоговой коллекции
  const totalSellers = rankedSellers.length;
  const finalReport = rankedSellers.map((seller, index) => {
    // Расчет бонуса
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

    // Формирование итогового объекта с форматированием финансовых полей
    return {
      seller_id: seller.seller_id,
      name: seller.name,
      // revenue: округляется только здесь, при выводе
      // Поскольку revenue и cost уже накапливались из округленных чисел,
      // дополнительное округление здесь требуется только для форматирования.
      revenue: +seller.revenue.toFixed(2),
      profit: +seller.profit.toFixed(2),
      sales_count: seller.sales_count,
      top_products: topProductsList.map((p) => ({
        sku: p.id,
        quantity: p.count,
      })),
      bonus: +bonusAmount.toFixed(2),
    };
  });

  return finalReport;
}
