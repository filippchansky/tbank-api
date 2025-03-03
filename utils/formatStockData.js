export function formatStockData(position) {
    const averagePositionPriceUnits = Number(position.averagePositionPrice);
    const averagePositionPriceNano = Number(position.averagePositionPrice);
    const currentPriceUnits = Number(position.currentPrice);
    const currentPriceNano = Number(position.currentPrice);
    const dailyYieldUnits = Number(position.dailyYield.units);
    const dailyYieldNano = Number(position.dailyYield.nano);
    const expectedYieldUnits = Number(position.expectedYield.units);
    const expectedYieldNano = Number(position.expectedYield.nano);
    // return {
    //     ...position,
    //     ticker: position.ticker,
    //     name: position.name,
    //     sector: position.sector,
    //     quantity: Number(position.quantity.units),
    //     averagePurchasePrice: Number(
    //         (averagePositionPriceUnits + averagePositionPriceNano / 1e9).toFixed(2)
    //     ),
    //     currentPrice: Number((currentPriceUnits + currentPriceNano / 1e9).toFixed(2)),
    //     expectedYield: Number((expectedYieldUnits + expectedYieldNano / 1e9).toFixed(2)),
    //     expectedYieldPercent: Number(expectedYieldPercent.toFixed(2)),
    //     priceInPorfolio: Number(priceInPorfolio.toFixed(2)),
    //     dailyChange: Number((dailyYieldUnits + dailyYieldNano / 1e9).toFixed(2)),
    // };

    const xyu = 'xyu';
    const priceInPorfolio =
        (currentPriceUnits + currentPriceNano / 1e9).toFixed(2) * position.quantity;
    const expectedYieldPercent = Number((
        ((currentPriceUnits +
            currentPriceNano / 1e9 -
            (averagePositionPriceUnits + averagePositionPriceNano / 1e9)) /
            (averagePositionPriceUnits + averagePositionPriceNano / 1e9)) *
        100
    ).toFixed(2));

    return {
        ...position,
        priceInPorfolio,
        expectedYieldPercent,
    };
}
