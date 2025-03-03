import { tinkoffApi } from '../intsance.js';

export const getShareByUid = async (token, uid) => {
    const { data } = await tinkoffApi.post(
        '/tinkoff.public.invest.api.contract.v1.InstrumentsService/ShareBy',
        {
            idType: '4',
            id: uid,
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
