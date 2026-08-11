import { getOperations } from '../api/tinkoff/getOperations/getOperations.js';
import { formatPrice } from '../utils/formatPrice.js';

// Реализованный результат по продажам. Ключевое: Т-Банк сам считает P/L по
// сделке и кладёт его в поле `yield` операции SELL — свой FIFO cost basis
// строить НЕ нужно. Нюанс: у ВАЛЮТНЫХ продаж (доллар и т.п.) `yield` не
// приходит (конвертация — не «доходность»), там отдаём yield=null, а фронт их
// не суммирует.
const REALIZED_TYPES = ['OPERATION_TYPE_SELL'];

// Quotation {units,nano} → число (проценты относительной доходности).
const formatQuotation = (q) => {
    if (!q) return null;
    const units = parseInt(q.units ?? 0, 10);
    const nano = parseInt(q.nano ?? 0, 10);
    return Number((units + nano / 1e9).toFixed(4));
};

export const getRealizedController = async (req, res) => {
    try {
        const token = req.headers.authorization;
        if (!token) {
            return res.status(400).json({ error: 'Authorization header is missing' });
        }

        const { accountId, from, to } = req.body;
        if (!accountId) {
            return res.status(400).json({ error: 'Field "accountId" is required' });
        }
        if (!from || !to) {
            return res.status(400).json({ error: 'Fields "from" and "to" are required (RFC3339)' });
        }

        const operations = await getOperations(token, {
            accountId,
            from,
            to,
            operationTypes: REALIZED_TYPES,
        });

        const items = operations
            .map((op) => {
                // yield приходит как MoneyValue только по ценным бумагам; по
                // валютным конвертациям его нет → hasYield=false, yield=null.
                const hasYield = op.yield !== undefined && op.yield !== null;
                return {
                    id: op.id,
                    date: op.date,
                    name: op.name ?? null,
                    ticker: op.ticker ?? null,
                    figi: op.figi ?? null,
                    instrumentUid: op.instrumentUid ?? null,
                    instrumentType: op.instrumentType ?? null,
                    // Реализованный P/L по сделке (₽), готовый из Т-Банка.
                    realized: hasYield ? formatPrice(op.yield) : null,
                    realizedRelative: formatQuotation(op.yieldRelative),
                    quantity: op.quantity ?? null,
                    // Валюту берём из yield (если есть), иначе из payment.
                    currency: op.yield?.currency ?? op.payment?.currency ?? null,
                };
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        res.status(200).json({ items });
    } catch (error) {
        const upstreamStatus = error?.response?.status ?? null;
        console.error('POST /realized failed:', upstreamStatus, error?.message);
        res.status(500).json({
            error: 'Internal Server Error',
            detail: error?.message ?? String(error),
            upstreamStatus,
        });
    }
};
