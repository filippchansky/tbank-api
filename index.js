import express from 'express';
import dotenv from 'dotenv';
import { getAccounts } from './api/tinkoff/getAccounts/getAccounts.js';
import { getTinkoffAccountsController } from './controllers/getTinkoffAccountsController.js';
import cors from 'cors';
import { getSharesController } from './controllers/getSharesController.js';
import { getCouponsController } from './controllers/getCouponsController.js';
import { getDividendsController } from './controllers/getDividendsController.js';
import { getPaymentsController } from './controllers/getPaymentsController.js';
import { getRealizedController } from './controllers/getRealizedController.js';
import { getCashflowsController } from './controllers/getCashflowsController.js';
import { getPortfolio } from './api/tinkoff/getPortfolio/getPortfolio.js';
import { formatStockData } from './utils/formatStockData.js';
import { formatPrice } from './utils/formatPrice.js';
import { formatPortfolio } from './utils/formatPortfolio.js';

dotenv.config({ path: '.env.local' });

const PORT = process.env.PORT || 5050;

const app = express();

app.use(express.json());
app.use(cors());

// Health-check + быстрая удалённая диагностика окружения. Значение TINKOFF_URL
// НЕ раскрываем — только факт, задана ли переменная (на Vercel её легко забыть,
// т.к. локально она живёт в gitignore-нутом .env.local).
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        service: 'tbank-api',
        hasTinkoffUrl: Boolean(process.env.TINKOFF_URL),
    });
});

app.get('/accounts', getTinkoffAccountsController);

app.post('/shares', getSharesController);

app.post('/coupons', getCouponsController);

app.post('/dividends', getDividendsController);

app.post('/payments', getPaymentsController);

app.post('/realized', getRealizedController);

app.post('/cashflows', getCashflowsController);

app.post('/portfolio', async (req, res) => {
    try {
        const token = req.headers.authorization;
        if (!token) {
            return res.status(400).json({ error: 'Authorization header is missing' });
        }
        const { accountId, currency } = req.body;
        const data = await getPortfolio(token, accountId, currency);
        const resp = await formatPortfolio(token, data)
        res.status(200).json(resp);
    } catch (error) {
        // Логируем компактно (в Vercel Functions logs) + отдаём причину клиенту,
        // чтобы 500 был диагностируемым. Сообщение axios не содержит токена
        // (он в заголовках, не в message).
        const upstreamStatus = error?.response?.status ?? null;
        console.error('POST /portfolio failed:', upstreamStatus, error?.message);
        res.status(500).json({
            error: 'Internal Server Error',
            detail: error?.message ?? String(error),
            upstreamStatus,
        });
    }
});

const startApp = async () => {
    try {
        app.listen(PORT);
    } catch (error) {
        console.log(error);
    }
};

startApp();
