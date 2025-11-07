function calculateSimpleRevenue(purchase, product) {
  if (!purchase || !product) return 0;

  const baseRevenue = purchase.quantity * product.price;
  const discount = purchase.discount
    ? (baseRevenue * purchase.discount) / 100
    : 0;

  return +(baseRevenue - discount).toFixed(2);
}

function calculateBonusByProfit(index, total, seller) {
  if (total <= 0) return 0;

  const rate = (total - index) / total;
  const bonus = seller.profit * rate * 0.1;

  return +bonus.toFixed(2);
}

function analyzeSalesData(data, options) {
  if (!options || typeof options !== "object")
    throw new Error("Invalid options");
  if (!data) throw new Error("No data");
  const { sellers, products, purchase_records } = data;
  if (!Array.isArray(sellers) || sellers.length === 0)
    throw new Error("Invalid sellers");
  if (!Array.isArray(products) || products.length === 0)
    throw new Error("Invalid products");
  if (!Array.isArray(purchase_records) || purchase_records.length === 0)
    throw new Error("Invalid purchase_records");

  const productsIndex = {};
  products.forEach((p) => (productsIndex[p.sku] = p));

  const sellersMap = {};
  sellers.forEach((s) => {
    sellersMap[s.seller_id] = {
      ...s,
      revenue: 0,
      cost: 0,
      sales_count: 0,
      products: {},
    };
  });

  // === расчёт выручки и прибыли без промежуточного округления ===
  purchase_records.forEach((record) => {
    const seller = sellersMap[record.seller_id];
    if (!seller) return;

    seller.sales_count += 1;

    record.items.forEach((item) => {
      const product = productsIndex[item.sku];
      if (!product) return;

      const revenue =
        item.quantity * product.price * (1 - (item.discount || 0) / 100);
      const cost = item.quantity * product.purchase_price;

      seller.revenue += revenue;
      seller.cost += cost;

      seller.products[item.sku] =
        (seller.products[item.sku] || 0) + item.quantity;
    });
  });

  // === вычисляем прибыль, ранжируем ===
  const sellersList = Object.values(sellersMap).map((s) => ({
    ...s,
    profit: s.revenue - s.cost,
  }));

  sellersList.sort((a, b) => b.profit - a.profit);

  // === считаем бонусы ===
  const total = sellersList.length;
  const result = sellersList.map((s, i) => {
    const bonus = calculateBonusByProfit(i, total, s);

    const topProducts = Object.entries(s.products)
      .sort((a, b) => b[1] - a[1])
      .slice(0, options.top_count || 3)
      .map(([sku, quantity]) => ({ sku, quantity }));

    return {
      seller_id: s.seller_id,
      name: s.name,
      revenue: +s.revenue.toFixed(2),
      profit: +s.profit.toFixed(2),
      sales_count: s.sales_count,
      top_products: topProducts,
      bonus: +bonus.toFixed(2),
    };
  });

  return result;
}

// === правильный экспорт для тестов ===
function mainFunc() {
  return {
    calculateSimpleRevenue,
    calculateBonusByProfit,
    analyzeSalesData,
  };
}

module.exports = mainFunc;
