import { getOperations } from '../api/tinkoff/getOperations/getOperations.js';
import { formatPrice } from '../utils/formatPrice.js';

// Типы операций-выплат, которые тянем для истории: приход (купоны, дивиденды,
// амортизация, погашение) + удержанные по ним налоги (отрицательные суммы,
// чтобы net был честным). Фильтр уходит в GetOperationsByCursor.
const PAYMENT_TYPES = [
    'OPERATION_TYPE_COUPON',
    'OPERATION_TYPE_DIVIDEND',
    'OPERATION_TYPE_AMORTIZATION',
    'OPERATION_TYPE_BOND_REPAYMENT',
    'OPERATION_TYPE_BOND_REPAYMENT_FULL',
    'OPERATION_TYPE_DIVIDEND_TAX',
    'OPERATION_TYPE_BOND_TAX',
    'OPERATION_TYPE_TAX',
];

// Приводим сырой тип операции к нашей категории (для группировки/цвета на фронте).
const categoryOf = (operationType) => {
    switch (operationType) {
        case 'OPERATION_TYPE_COUPON':
            return 'coupon';
        case 'OPERATION_TYPE_DIVIDEND':
            return 'dividend';
        case 'OPERATION_TYPE_AMORTIZATION':
        case 'OPERATION_TYPE_BOND_REPAYMENT':
        case 'OPERATION_TYPE_BOND_REPAYMENT_FULL':
            return 'repayment';
        case 'OPERATION_TYPE_DIVIDEND_TAX':
        case 'OPERATION_TYPE_BOND_TAX':
        case 'OPERATION_TYPE_TAX':
            return 'tax';
        default:
            return 'other';
    }
};

// История полученных выплат по счёту (факт: купоны/дивиденды/погашения + налоги).
// В отличие от прогноза (/coupons), это реально прошедшие движения денег из
// GetOperationsByCursor — суммы уже с учётом фактического количества и налога.
export const getPaymentsController = async (req, res) => {
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
            operationTypes: PAYMENT_TYPES,
        });

        const items = operations
            .map((op) => ({
                id: op.id,
                date: op.date,
                operationType: op.type,
                category: categoryOf(op.type),
                name: op.name ?? null,
                figi: op.figi ?? null,
                instrumentUid: op.instrumentUid ?? null,
                instrumentType: op.instrumentType ?? null,
                // payment — знаковый MoneyValue: приход «+», удержанный налог «−».
                payment: formatPrice(op.payment ?? { units: 0, nano: 0 }),
                currency: op.payment?.currency ?? null,
            }))
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        res.status(200).json({ items });
    } catch (error) {
        const upstreamStatus = error?.response?.status ?? null;
        console.error('POST /payments failed:', upstreamStatus, error?.message);
        res.status(500).json({
            error: 'Internal Server Error',
            detail: error?.message ?? String(error),
            upstreamStatus,
        });
    }
};
