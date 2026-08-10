import { getDividends } from '../api/tinkoff/getDividends/getDividends.js';
import { formatPrice } from '../utils/formatPrice.js';

// Календарь будущих дивидендов по акциям портфеля. Зеркалит /coupons: принимает
// батч бумаг (instrumentId + количество), тянет объявленные дивиденды по каждой
// и отдаёт плоский список выплат с суммой (dividendNet на 1 акцию × quantity).
//
// Тикер/имя НЕ резолвим здесь: фронт приклеит их по instrumentId из позиций
// портфеля (как в /coupons) — так избегаем N+1 за паспортами.
export const getDividendsController = async (req, res) => {
    try {
        const token = req.headers.authorization;
        if (!token) {
            return res.status(400).json({ error: 'Authorization header is missing' });
        }

        const { shares, from, to } = req.body;

        if (!Array.isArray(shares)) {
            return res.status(400).json({ error: 'Field "shares" must be an array' });
        }
        if (!from || !to) {
            return res.status(400).json({ error: 'Fields "from" and "to" are required (RFC3339)' });
        }

        // allSettled: одна битая бумага (делистинг, лимит, таймаут) не должна
        // ронять весь календарь — просто останется без событий.
        const settled = await Promise.allSettled(
            shares.map(async ({ instrumentId, quantity }) => {
                const dividends = await getDividends(token, instrumentId, from, to);
                const qty = Number(quantity) || 0;
                return dividends.map((div) => {
                    // Гард: dividendNet может отсутствовать — formatPrice читает
                    // .units/.nano и упал бы на undefined.
                    const amountPerShare = formatPrice(div.dividendNet ?? { units: 0, nano: 0 });
                    return {
                        instrumentId,
                        quantity: qty,
                        // Дата фактической выплаты на счёт/карту (аналог couponDate).
                        paymentDate: div.paymentDate ?? null,
                        // Отсечка реестра (аналог fixDate у купона): держатель на
                        // эту дату получает дивиденд.
                        recordDate: div.recordDate ?? null,
                        // Последний день купить бумагу, чтобы попасть в реестр.
                        lastBuyDate: div.lastBuyDate ?? null,
                        dividendType: div.dividendType ?? null,
                        // Валюта выплаты — нерублёвые фронт пометит отдельно.
                        currency: div.dividendNet?.currency ?? null,
                        amountPerShare,
                        // Сумма по позиции = дивиденд на 1 акцию × кол-во.
                        amount: Number((amountPerShare * qty).toFixed(2)),
                    };
                });
            })
        );

        const events = settled
            .filter((result) => result.status === 'fulfilled')
            .flatMap((result) => result.value)
            // Оставляем и прошлые, и будущие выплаты (лишь бы была дата): фронт
            // по прошлым строит прогноз «как в прошлом году», а будущие берёт
            // как объявленные. Отсекаем только события без paymentDate.
            .filter((event) => event.paymentDate)
            .sort((a, b) => new Date(a.paymentDate) - new Date(b.paymentDate));

        res.status(200).json({ events });
    } catch (error) {
        const upstreamStatus = error?.response?.status ?? null;
        console.error('POST /dividends failed:', upstreamStatus, error?.message);
        res.status(500).json({
            error: 'Internal Server Error',
            detail: error?.message ?? String(error),
            upstreamStatus,
        });
    }
};
