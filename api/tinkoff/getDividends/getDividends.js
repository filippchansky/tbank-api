import { tinkoffApi } from '../intsance.js';

// Кэш расписаний дивидендов по инструменту. Как и купоны/паспорта, объявленные
// дивиденды НЕ зависят от токена (публичные данные эмитента) и меняются редко,
// поэтому кэшируем по ключу `instrumentId:from:to`. Живёт в памяти инстанса —
// на тёплой Lambda снижает число обращений к InstrumentsService и риск
// rate-limit при N акциях в портфеле.
const dividendsCache = new Map();

// GetDividends возвращает график объявленных дивидендов по акции в окне дат.
// instrumentId — instrumentUid позиции. from/to — строки RFC3339 (фильтр по
// recordDate на стороне Tinkoff). Возвращает массив dividends[] (может быть
// пустым: если эмитент ещё не объявил выплату — её тут не будет).
export const getDividends = async (token, instrumentId, from, to) => {
    const cacheKey = `${instrumentId}:${from}:${to}`;
    if (dividendsCache.has(cacheKey)) {
        return dividendsCache.get(cacheKey);
    }

    const { data } = await tinkoffApi.post(
        '/tinkoff.public.invest.api.contract.v1.InstrumentsService/GetDividends',
        {
            instrumentId,
            from,
            to,
        },
        {
            headers: {
                Authorization: token,
                'Content-Type': 'application/json',
            },
        }
    );

    const dividends = data?.dividends ?? [];
    dividendsCache.set(cacheKey, dividends);
    return dividends;
};
