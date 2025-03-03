import { getAccounts } from '../api/tinkoff/getAccounts/getAccounts.js';
import { getShareByUid } from '../api/tinkoff/getSharesByUid/getShareByUid.js';
import { formatPrice } from './formatPrice.js';
import { formatStockData } from './formatStockData.js';

export const formatPortfolio = async (token, data) => {
    const itemUids = data.positions
        .filter((item) => item.instrumentType === 'share')
        .map((item) => item.positionUid);

    const info = await Promise.all(
        itemUids.map(async (item) => {
            const res = await getShareByUid(token, item);
            const { instrument } = res;
            return {
                uid: instrument.uid,
                isin: instrument.isin,
                ticker: instrument.ticker,
                name: instrument.name,
                sector: instrument.sector,
            };
        })
    );

    // получили uid акций

    const updateData = {
        ...data,
        positions: data.positions.map((position) => {
            const match = info.find((item) => item.uid === position.instrumentUid);
            return {
                ...position,
                ticker: match?.ticker ?? null,
                name: match?.name ?? null,
                sector: match?.sector ?? null,
                isin: match?.isin ?? null,
            };
        }),
    };

    // обновили данные добавив в positions нужные поля (тикер, название, сектор)

    // const formatedData = {
    //     ...updateData,
    //     positions: updateData.positions.map((item) => ({
    //         ...formatStockData(item),
    //     })),
    // };

    const formatedData = {
        ...updateData,
        positions: updateData.positions.map((item) => {
            const formattedData = {};

            for (const key in item) {
                if (typeof item[key] === 'object' && item[key] !== null) {
                    formattedData[key] = formatPrice(item[key])
                }else {
                    formattedData[key] = item[key];
                }
            }

            return formattedData;
        }),
    };

    // привели данные из positions в человеческий вид

    function formatPortfolioData(portfolio) {
        const formattedData = {};

        // Обрабатываем каждое поле, содержащее валюту
        for (const key in portfolio) {
            if (portfolio[key].units !== undefined) {
                formattedData[key] = formatPrice(portfolio[key]);
            } else {
                formattedData[key] = portfolio[key]; // Если это не валюта, оставляем как есть
            }
        }

        return formattedData;
    }

    // привели остальные поля в человеческий вид

    const resp = formatPortfolioData(formatedData);

    const accounts = await getAccounts(token);

    const accountsName = accounts.accounts.find((item) => item.id === resp.accountId).name;

    const formatedResp = {
        ...resp,
        name: accountsName,
        expectedYieldInt: Number(
            ((resp.totalAmountPortfolio * resp.expectedYield) / 100).toFixed(2)
        ),
    };

    const updatedResp = {
        ...formatedResp, // Копируем весь объект
        positions: formatedResp.positions.map(item => formatStockData(item)) // Обновляем только positions
    };

    // прибыль от процента и название портфеля

    return updatedResp;
};
