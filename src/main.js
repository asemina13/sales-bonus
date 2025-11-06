const roundToTwo = (num) => Math.round(num * 100) / 100;

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

  // Возвращаем выручку: sale_price × quantity × discountFactor
  // Результат этой функции будет округлен далее, перед накоплением.
  const revenue = sale_price * quantity * discountFactor;
  return revenue;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
  const { profit } = seller; // Добавлено по запросу пользователя

  // Реализация условий расчета бонусов:
  if (index === 0) {
    // Продавец с наибольшей прибылью (1-е место)
    return 0.15; // 15%
  } else if (index === 1 || index === 2) {
    // 2-е и 3-е места
    return 0.1; // 10%
  } else if (index === total - 1) {
    // Последнее место
    return 0.0; // 0%
  } else {
    // Для всех остальных
    return 0.05; // 5%
  }
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
  // @TODO: Проверка входных данных - ИСПРАВЛЕНО
  if (
    !data ||
    !data.sellers ||
    !data.products ||
    !data.purchase_records ||
    data.sellers.length === 0 ||
    data.products.length === 0 ||
    data.purchase_records.length === 0
  ) {
    // В случае некорректных данных или пустых массивов генерируем ошибку для прохождения теста
    throw new Error("Некорректные или неполные входные данные.");
  }

  // @TODO: Проверка наличия опций - ИСПРАВЛЕНО
  const { calculateRevenue, calculateBonus } = options || {};
  if (!calculateRevenue || !calculateBonus) {
    // В случае отсутствия функций генерируем ошибку для прохождения теста
    throw new Error("Не переданы функции для расчета выручки или бонусов.");
  }

  // Индексация товаров для быстрого доступа. ИСПОЛЬЗУЕМ SKU.
  const productsIndex = data.products.reduce((acc, product) => {
    acc[product.sku] = product;
    return acc;
  }, {});

  // (Необязательно, но полезно) Индексация продавцов
  const sellerIndex = data.sellers.reduce((acc, seller) => {
    acc[seller.id] = seller;
    return acc;
  }, {});

  // @TODO: Подготовка промежуточных данных для сбора статистики (sellerStats)
  const sellerStats = data.sellers.reduce((acc, seller) => {
    // Упрощение имени для примера
    const name = seller.name || seller.first_name + " " + seller.last_name;

    acc[seller.id] = {
      seller_id: seller.id,
      name: name,
      revenue: 0,
      cost: 0, // Добавим cost для расчета прибыли
      profit: 0,
      sales_count: 0,
      products_sold: {},
    };
    return acc;
  }, {});

  // @TODO: Расчёт выручки и прибыли для каждого продавца
  data.purchase_records.forEach((record) => {
    const sellerId = record.seller_id;
    const stats = sellerStats[sellerId]; // Получаем ссылку на накопительную статистику продавца
    if (!stats) return; // Пропускаем, если продавец не найден

    record.items.forEach((purchase) => {
      // Получаем товар из индекса. ИСПОЛЬЗУЕМ purchase.sku.
      const product = productsIndex[purchase.sku];

      // Посчитать себестоимость (cost) товара. ИСПОЛЬЗУЕМ purchase_price.
      const unitCost = product ? product.purchase_price : 0;
      let itemCost = unitCost * purchase.quantity;
      // Округляем стоимость до накопления
      itemCost = roundToTwo(itemCost);

      // Посчитать выручку (revenue) с учётом скидки через функцию calculateRevenue
      let revenue = calculateRevenue(purchase, product);
      // Округляем выручку до накопления
      revenue = roundToTwo(revenue);

      // Накопление общих данных
      stats.revenue += revenue;
      stats.cost += itemCost; // Накопление общей себестоимости
      stats.sales_count += purchase.quantity; // Накопление общего количества проданных единиц

      // Учет количества проданных товаров по артикулу. ИСПОЛЬЗУЕМ SKU.
      const productId = purchase.sku;

      // 1. Проверить, есть ли ключ в объекте, и добавить со значением 0, если нет.
      if (!stats.products_sold[productId]) {
        stats.products_sold[productId] = 0;
      }
      // 2. Увеличить число проданных товаров.
      stats.products_sold[productId] += purchase.quantity;
    });
  });
  // =========================================================================

  // =========================================================================
  // Преобразование в массив для сортировки и расчета финальной прибыли
  // =========================================================================
  let rankedSellers = Object.values(sellerStats).map((seller) => {
    const calculatedProfit = seller.revenue - seller.cost;
    return {
      ...seller,
      // Финальный расчет прибыли: Выручка - Себестоимость. Округляем для надежности перед сортировкой.
      profit: roundToTwo(calculatedProfit),
    };
  });

  // Сортировка продавцов по прибыли (реализация шага)
  rankedSellers.sort((a, b) => b.profit - a.profit);

  // Назначение премий на основе ранжирования и подготовка итоговой коллекции
  const totalSellers = rankedSellers.length;
  const finalReport = rankedSellers.map((seller, index) => {
    // Вызов функции расчёта бонуса с учетом позиции
    const bonusPercentage = calculateBonus(index, totalSellers, seller);
    const bonusAmount = seller.profit * bonusPercentage;

    // Определяем топ-продукты для отчета (Логика обновлена для соответствия требованию)
    const topProductsList = Object.entries(seller.products_sold) // [[id (SKU), count], ...]
      .map(([id, count]) => ({ id, count })) // Трансформируем в [{id, count}, ...]
      .sort((a, b) => b.count - a.count) // Сортируем по убыванию количества
      .slice(0, 10) // Берем Топ-10
      .map(({ id, count }) => {
        const product = productsIndex[id];
        return {
          id: id,
          name: product ? product.name : "Unknown",
          count: count,
        };
      });

    return {
      seller_id: seller.seller_id,
      name: seller.name,
      // Применяем округление до двух знаков после запятой и преобразуем обратно в число
      // Значения seller.revenue и seller.profit уже являются округленными благодаря roundToTwo
      revenue: +seller.revenue.toFixed(2),
      profit: +seller.profit.toFixed(2),
      sales_count: seller.sales_count,
      // Преобразование topProductsList для соответствия формату {sku: id, quantity: count}
      top_products: topProductsList.map((p) => ({
        sku: p.id,
        quantity: p.count,
      })),
      bonus: +bonusAmount.toFixed(2), // Округление бонуса
      // rank: index + 1, // Дополнительное поле для отчета
    };
  });

  return finalReport;
}
