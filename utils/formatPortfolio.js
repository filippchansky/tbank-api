import { getInstrumentByUid } from '../api/tinkoff/getSharesByUid/getShareByUid.js';
import { formatPrice } from './formatPrice.js';
import { formatStockData } from './formatStockData.js';

export const formatPortfolio = async (token, data) => {
    // Обогащаем позиции-бумаги (акции/облигации/ETF): GetInstrumentBy отдаёт
    // паспорт для любого типа. Валюту исключаем — денежный остаток не бумага
    // (нет смысла в цене/доходности), а фронт показывает только позиции с
    // ticker, поэтому без обогащения валютные строки в таблицу не попадут.
    const itemUids = data.positions
        .filter((item) => item.positionUid && item.instrumentType !== 'currency')
        .map((item) => item.positionUid);

    // Тянем справочный паспорт (тикер/имя/сектор/ISIN) по каждому инструменту.
    // allSettled: одна битая бумага (делистинг, лимит, таймаут) не должна
    // ронять весь ответ в 500 — просто останется без обогащения.
    const settled = await Promise.allSettled(
        itemUids.map((item) => getInstrumentByUid(token, item))
    );

    const info = settled
        .filter((result) => result.status === 'fulfilled' && result.value?.instrument)
        .map((result) => {
            const { instrument } = result.value;
            return {
                uid: instrument.uid,
                isin: instrument.isin,
                ticker: instrument.ticker,
                name: instrument.name,
                // sector есть только в типовых ShareBy/BondBy; в базовом
                // паспорте GetInstrumentBy его нет → будет null (фронт его
                // для позиций портфеля не использует).
                sector: instrument.sector ?? null,
            };
        });

    // получили метаданные инструментов

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

    const formatedData = {
        ...updateData,
        positions: updateData.positions.map((item) => {
            const formattedData = {};

            for (const key in item) {
                if (typeof item[key] === 'object' && item[key] !== null) {
                    formattedData[key] = formatPrice(item[key]);
                } else {
                    formattedData[key] = item[key];
                }
            }

            return formattedData;
        }),
    };

    // привели данные из positions в человеческий вид

    function formatPortfolioData(portfolio) {
        const formattedData = {};

        // Обрабатываем каждое поле, содержащее валюту { units, nano }.
        // Проверяем, что это непустой объект, иначе portfolio[key].units
        // кидает TypeError на null (например, при пустом портфеле).
        for (const key in portfolio) {
            const value = portfolio[key];
            if (typeof value === 'object' && value !== null && value.units !== undefined) {
                formattedData[key] = formatPrice(value);
            } else {
                formattedData[key] = value; // Если это не валюта, оставляем как есть
            }
        }

        return formattedData;
    }

    // привели остальные поля в человеческий вид

    const resp = formatPortfolioData(formatedData);

    // Имя счёта резолвит фронт (оно уже есть в useTbank/Firestore), поэтому
    // повторный GetAccounts на каждый запрос портфеля здесь не нужен.
    const formatedResp = {
        ...resp,
        expectedYieldInt: Number(
            ((resp.totalAmountPortfolio * resp.expectedYield) / 100).toFixed(2)
        ),
    };

    const updatedResp = {
        ...formatedResp, // Копируем весь объект
        positions: formatedResp.positions.map((item) => formatStockData(item)), // Обновляем только positions
    };

    // прибыль от процента

    return updatedResp;
};
