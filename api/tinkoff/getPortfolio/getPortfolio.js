import { tinkoffApi } from '../intsance.js';

export const getPortfolio = async (token, accountId, currency) => {
    const { data } = await tinkoffApi.post(
        '/tinkoff.public.invest.api.contract.v1.OperationsService/GetPortfolio',
        {
            accountId: accountId,
            currency: currency,
        },
        {
            headers: {
                Authorization: token,
                'Content-Type': 'application/json',
            },
        }
    );

    return data;
};
