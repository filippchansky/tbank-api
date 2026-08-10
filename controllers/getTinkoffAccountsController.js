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
        // Пробрасываем статус от Tinkoff: 401 = невалидный токен, чтобы фронт
        // отличал «неверный токен» от сетевой/серверной ошибки. Токен живёт в
        // заголовке, не в message, — логировать/отдавать message безопасно.
        const upstreamStatus = error?.response?.status ?? null;
        console.error(`[GET /accounts] Error:`, upstreamStatus, error?.message);
        const status = upstreamStatus === 401 ? 401 : 500;
        res.status(status).json({
            error: status === 401 ? 'Invalid token' : 'Internal Server Error',
            upstreamStatus,
        });
    }
}