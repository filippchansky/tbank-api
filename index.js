import express from 'express';
import dotenv from 'dotenv';
import { getAccounts } from './api/tinkoff/getAccounts/getAccounts.js';
import { getTinkoffAccountsController } from './controllers/getTinkoffAccountsController.js';
import cors from 'cors';
import { getShareByUid } from './api/tinkoff/getSharesByUid/getShareByUid.js';
import { getSharesController } from './controllers/getSharesController.js';
import { getPortfolio } from './api/tinkoff/getPortfolio/getPortfolio.js';
import { formatStockData } from './utils/formatStockData.js';
import { formatPrice } from './utils/formatPrice.js';
import { formatPortfolio } from './utils/formatPortfolio.js';

dotenv.config({ path: '.env.local' });

const PORT = 5050;

const app = express();

app.use(express.json());
app.use(cors());

app.get('/accounts', getTinkoffAccountsController);

app.post('/shares', getSharesController);

app.post('/portfolio', async (req, res) => {
    try {
        const token = req.headers.authorization;
        if (!token) {
            return res.status(400).json({ error: 'Authorization header is missing' });
        }
        const { accountId, currency } = req.body;
        console.log(accountId, currency);
        const data = await getPortfolio(token, accountId, currency);
        const resp = await formatPortfolio(token, data)
        res.status(200).json(resp);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal Server Error' });
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
