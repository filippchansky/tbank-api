import { getOperations } from '../api/tinkoff/getOperations/getOperations.js';
import { formatPrice } from '../utils/formatPrice.js';

// Типы операций-выплат, которые тянем для истории: приход (купоны, дивиденды,
// амортизация, погашение) + удержанные по ним налоги (отрицательные суммы,
// чтобы net был честным). Фильтр уходит в GetOperationsByCursor.
const PAYMENT_TYPES = [
    'OPERATION_TYPE_COUPON',
    'OPERATION_TYPE_DIVIDEND',
    // Дивиденды, выплаченные напрямую на банковскую карту (не на брокерский
    // счёт), приходят отдельным типом DIV_EXT. Без него терялись все выплаты
    // «на карту» — при этом удержанный по ним налог (DIVIDEND_TAX) проходил,
    // из-за чего в истории были «голые» налоги без самой выплаты.
    'OPERATION_TYPE_DIV_EXT',
    'OPERATION_TYPE_AMORTIZATION',
    'OPERATION_TYPE_BOND_REPAYMENT',
    'OPERATION_TYPE_BOND_REPAYMENT_FULL',
    'OPERATION_TYPE_DIVIDEND_TAX',
    'OPERATION_TYPE_BOND_TAX',
    'OPERATION_TYPE_TAX',
    // Комиссии (payment < 0). Без них «Доходность» была завышена: Т-Банк даёт
    // реализованный `yield` БЕЗ вычета комиссий, поэтому их учитываем отдельной
    // строкой. Берём всё «семейство» комиссий: брокерская, депозитарная
    // (обслуживание), маржинальная, за автоследование и вывод.
    'OPERATION_TYPE_BROKER_FEE',
    'OPERATION_TYPE_SERVICE_FEE',
    'OPERATION_TYPE_MARGIN_FEE',
    'OPERATION_TYPE_SUCCESS_FEE',
    'OPERATION_TYPE_TRACK_MFEE',
    'OPERATION_TYPE_TRACK_PFEE',
    'OPERATION_TYPE_CASH_FEE',
    'OPERATION_TYPE_OUT_FEE',
    'OPERATION_TYPE_ADVICE_FEE',
];

// Приводим сырой тип операции к нашей категории (для группировки/цвета на фронте).
const categoryOf = (operationType) => {
    switch (operationType) {
        case 'OPERATION_TYPE_COUPON':
            return 'coupon';
        case 'OPERATION_TYPE_DIVIDEND':
        case 'OPERATION_TYPE_DIV_EXT':
            return 'dividend';
        case 'OPERATION_TYPE_AMORTIZATION':
        case 'OPERATION_TYPE_BOND_REPAYMENT':
        case 'OPERATION_TYPE_BOND_REPAYMENT_FULL':
            return 'repayment';
        case 'OPERATION_TYPE_DIVIDEND_TAX':
        case 'OPERATION_TYPE_BOND_TAX':
        case 'OPERATION_TYPE_TAX':
            return 'tax';
        case 'OPERATION_TYPE_BROKER_FEE':
        case 'OPERATION_TYPE_SERVICE_FEE':
        case 'OPERATION_TYPE_MARGIN_FEE':
        case 'OPERATION_TYPE_SUCCESS_FEE':
        case 'OPERATION_TYPE_TRACK_MFEE':
        case 'OPERATION_TYPE_TRACK_PFEE':
        case 'OPERATION_TYPE_CASH_FEE':
        case 'OPERATION_TYPE_OUT_FEE':
        case 'OPERATION_TYPE_ADVICE_FEE':
            return 'fee';
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
                ticker: op.ticker ?? null,
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
