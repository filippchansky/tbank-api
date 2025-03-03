import { tinkoffApi } from '../intsance.js';

export const getAccounts = async (token) => {
    const { data } = await tinkoffApi.post(
        '/tinkoff.public.invest.api.contract.v1.UsersService/GetAccounts',
        {},
        {
            headers: {
                Authorization: token,
                'Content-Type': 'application/json',
            },
        }
    );

    return data
};
