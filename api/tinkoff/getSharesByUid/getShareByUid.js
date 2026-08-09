import { tinkoffApi } from '../intsance.js';

// Кэш справочных паспортов инструментов. ticker/name/isin/sector почти
// неизменны и НЕ зависят от токена (это публичные справочные данные),
// поэтому кэшируем по ключу `idType:id`. Живёт в памяти инстанса — на
// тёплой Lambda снижает число обращений к InstrumentsService и риск
// rate-limit при N позициях в портфеле.
const instrumentCache = new Map();

// GetInstrumentBy возвращает базовый паспорт для ЛЮБОГО типа инструмента
// (акция/облигация/ETF/валюта) одним методом, в отличие от ShareBy (только
// акции). idType по умолчанию 4 = POSITION_UID (используется обогащением
// портфеля); может быть переопределён (1=FIGI, 2=TICKER, 3=UID).
export const getInstrumentByUid = async (token, id, idType = '4') => {
    const cacheKey = `${idType}:${id}`;
    if (instrumentCache.has(cacheKey)) {
        return instrumentCache.get(cacheKey);
    }

    const { data } = await tinkoffApi.post(
        '/tinkoff.public.invest.api.contract.v1.InstrumentsService/GetInstrumentBy',
        {
            idType,
            id,
        },
        {
            headers: {
                Authorization: token,
                'Content-Type': 'application/json',
            },
        }
    );

    instrumentCache.set(cacheKey, data);
    return data;
};
