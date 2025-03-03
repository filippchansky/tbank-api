import { getAccounts } from "../api/tinkoff/getAccounts/getAccounts.js";

export const getTinkoffAccountsController = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(400).json({ error: 'Authorization header is missing' });
        }

        const data = await getAccounts(authHeader);

        if (!data || !data.accounts) {
            return res.status(500).json({ error: 'Invalid response from getAccounts' });
        }

        const formatData = data.accounts.map(({ id, name }) => ({ id, name }));

        console.log(`[GET /accounts] Success: ${formatData.length} accounts fetched`);

        res.status(200).json(formatData);
    } catch (error) {
        console.error(`[GET /accounts] Error:`, error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}