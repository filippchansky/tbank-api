import { getOperations } from '../api/tinkoff/getOperations/getOperations.js';
import { formatPrice } from '../utils/formatPrice.js';

// XIRR (Этап 3) считается по ВНЕШНИМ движениям денег между инвестором и счётом
// + терминальной стоимостью портфеля. Внутренние движения (BUY/SELL, купоны и
// дивиденды НА СЧЁТ, комиссии, налоги) НЕ считаются потоками — они уже сидят в
// текущей стоимости портфеля.
//
// Знак с точки зрения инвестора:
//   вклад (деньги «из кармана» в инвестиции) → отрицательный CF
//   выплата инвестору (деньги «в карман»)     → положительный CF
const CONTRIBUTION_TYPES = new Set([
    'OPERATION_TYPE_INPUT',       // пополнение брокерского счёта
    'OPERATION_TYPE_INP_MULTI',   // мультивалютное пополнение
    // ВАЖНО: BUY_CARD НЕ включаем. Проверено по денежному тождеству
    // (Σ payment = текущий кэш): BUY_CARD списывает КЭШ СО СЧЁТА как обычный BUY,
    // а не заводит внешние деньги. Кэш под него уже пришёл через INPUT/INP_MULTI,
    // поэтому счёт BUY_CARD вкладом ДВОИЛ вложения и занижал XIRR в минус.
]);
const DISTRIBUTION_TYPES = new Set([
    'OPERATION_TYPE_OUTPUT',      // вывод средств
    'OPERATION_TYPE_OUT_MULTI',   // мультивалютный вывод
    'OPERATION_TYPE_DIV_EXT',     // дивиденды, выплаченные на карту (ушли со счёта)
]);

const RUB = new Set(['rub', 'sur', 'RUB', 'SUR']);
const isRub = (c) => c == null || RUB.has(c);

// Свёртка внешних потоков по дню (YYYY-MM-DD) со знаком инвестора. Много мелких
// пополнений в один день суммируются — для XIRR это эквивалентно, а payload
// сильно меньше (на счетах-«копилках» тысячи INPUT).
export const getCashflowsController = async (req, res) => {
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

        // Без фильтра типов: набор внешних типов шире обычного (мульти/карта),
        // надёжнее отобрать на нашей стороне, чем полагаться на enum-фильтр ISS.
        const operations = await getOperations(token, { accountId, from, to });

        const byDay = new Map(); // 'YYYY-MM-DD' → сумма CF за день
        let hasNonRub = false;
        let contributions = 0; // модуль вкладов (для сверки)
        let distributions = 0; // модуль выплат инвестору (для сверки)

        operations.forEach((op) => {
            const isContrib = CONTRIBUTION_TYPES.has(op.type);
            const isDistrib = DISTRIBUTION_TYPES.has(op.type);
            if (!isContrib && !isDistrib) return;

            const currency = op.payment?.currency ?? null;
            if (!isRub(currency)) {
                hasNonRub = true;
                return;
            }

            const amount = Math.abs(formatPrice(op.payment ?? { units: 0, nano: 0 }));
            const cf = isContrib ? -amount : amount;
            if (isContrib) contributions += amount;
            else distributions += amount;

            const day = (op.date ?? '').slice(0, 10);
            if (!day) return;
            byDay.set(day, Number(((byDay.get(day) ?? 0) + cf).toFixed(2)));
        });

        const items = Array.from(byDay.entries())
            .map(([date, amount]) => ({ date, amount }))
            .sort((a, b) => a.date.localeCompare(b.date));

        res.status(200).json({
            items,
            hasNonRub,
            // Для сверки на фронте/глазами: сколько всего внесено и выведено.
            contributions: Number(contributions.toFixed(2)),
            distributions: Number(distributions.toFixed(2)),
        });
    } catch (error) {
        const upstreamStatus = error?.response?.status ?? null;
        console.error('POST /cashflows failed:', upstreamStatus, error?.message);
        res.status(500).json({
            error: 'Internal Server Error',
            detail: error?.message ?? String(error),
            upstreamStatus,
        });
    }
};
