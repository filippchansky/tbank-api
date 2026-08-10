import { getBondCoupons } from '../api/tinkoff/getBondCoupons/getBondCoupons.js';
import { formatPrice } from '../utils/formatPrice.js';

// Календарь будущих купонов по облигациям портфеля. Принимает батч бумаг
// (instrumentId + количество), тянет график купонов по каждой и отдаёт
// плоский список выплат с посчитанной суммой (payOneBond × quantity).
//
// Тикер/имя НЕ резолвим здесь: фронт уже знает их из позиций портфеля и
// приклеит по instrumentId — так избегаем повторного N+1 за паспортами.
export const getCouponsController = async (req, res) => {
    try {
        const token = req.headers.authorization;
        if (!token) {
            return res.status(400).json({ error: 'Authorization header is missing' });
        }

        const { bonds, from, to } = req.body;

        if (!Array.isArray(bonds)) {
            return res.status(400).json({ error: 'Field "bonds" must be an array' });
        }
        if (!from || !to) {
            return res.status(400).json({ error: 'Fields "from" and "to" are required (RFC3339)' });
        }

        // allSettled: одна битая бумага (делистинг, лимит, таймаут) не должна
        // ронять весь календарь — просто останется без событий.
        const settled = await Promise.allSettled(
            bonds.map(async ({ instrumentId, quantity }) => {
                const events = await getBondCoupons(token, instrumentId, from, to);
                const qty = Number(quantity) || 0;
                return events.map((event) => {
                    // Гард: у некоторых событий payOneBond может отсутствовать —
                    // formatPrice читает .units/.nano и упал бы на undefined.
                    const amountPerBond = formatPrice(event.payOneBond ?? { units: 0, nano: 0 });
                    return {
                        instrumentId,
                        quantity: qty,
                        couponDate: event.couponDate,
                        fixDate: event.fixDate,
                        couponNumber: event.couponNumber,
                        couponType: event.couponType,
                        // Валюта купона — чтобы фронт мог пометить нерублёвые
                        // (моновалютная агрегация пока только для RUB).
                        currency: event.payOneBond?.currency ?? null,
                        amountPerBond,
                        // Сумма выплаты по позиции = купон на 1 облигацию × кол-во.
                        // ДО налога (налог удержится при фактической выплате).
                        amount: Number((amountPerBond * qty).toFixed(2)),
                    };
                });
            })
        );

        const events = settled
            .filter((result) => result.status === 'fulfilled')
            .flatMap((result) => result.value)
            .sort((a, b) => new Date(a.couponDate) - new Date(b.couponDate));

        res.status(200).json({ events });
    } catch (error) {
        const upstreamStatus = error?.response?.status ?? null;
        console.error('POST /coupons failed:', upstreamStatus, error?.message);
        res.status(500).json({
            error: 'Internal Server Error',
            detail: error?.message ?? String(error),
            upstreamStatus,
        });
    }
};
