// На вход приходит позиция, у которой денежные поля уже приведены к числам
// в formatPortfolio (каждое { units, nano } прогнано через formatPrice).
// Поэтому считаем производные величины прямо из готовых чисел.
export function formatStockData(position) {
    const currentPrice = Number(position.currentPrice) || 0;
    const averagePrice = Number(position.averagePositionPrice) || 0;
    const quantity = Number(position.quantity) || 0;

    // Стоимость позиции в портфеле = текущая цена × количество
    const priceInPorfolio = Number((currentPrice * quantity).toFixed(2));

    // Доходность в процентах относительно средней цены покупки
    const expectedYieldPercent = averagePrice
        ? Number((((currentPrice - averagePrice) / averagePrice) * 100).toFixed(2))
        : 0;

    return {
        ...position,
        priceInPorfolio,
        expectedYieldPercent,
    };
}
