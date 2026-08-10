import { tinkoffApi } from '../intsance.js';

// Кэш расписаний купонов. Как и справочные паспорта инструментов, расписание
// купонов НЕ зависит от токена (публичные данные эмитента) и меняется редко,
// поэтому кэшируем по ключу `instrumentId:from:to`. Живёт в памяти инстанса —
// на тёплой Lambda снижает число обращений к InstrumentsService и риск
// rate-limit при N облигациях в портфеле.
const couponsCache = new Map();

// GetBondCoupons возвращает график купонов облигации в заданном окне дат.
// instrumentId — instrumentUid позиции (idType не нужен, метод принимает
// instrument_id напрямую). from/to — строки RFC3339.
// Возвращает массив events[] (может быть пустым).
export const getBondCoupons = async (token, instrumentId, from, to) => {
    const cacheKey = `${instrumentId}:${from}:${to}`;
    if (couponsCache.has(cacheKey)) {
        return couponsCache.get(cacheKey);
    }

    const { data } = await tinkoffApi.post(
        '/tinkoff.public.invest.api.contract.v1.InstrumentsService/GetBondCoupons',
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

    const events = data?.events ?? [];
    couponsCache.set(cacheKey, events);
    return events;
};
