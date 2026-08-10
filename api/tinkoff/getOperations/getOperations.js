import { tinkoffApi } from '../intsance.js';

// Защита от бесконечного цикла пагинации (курсор): максимум страниц за запрос.
const MAX_PAGES = 20;

// Тянет операции по счёту через GetOperationsByCursor, разворачивая пагинацию
// по курсору в единый массив items. Фильтр по типам операций (operationTypes)
// применяется на стороне Tinkoff — экономит трафик. state по умолчанию —
// только исполненные (реально прошедшие движения денег).
export const getOperations = async (token, { accountId, from, to, operationTypes }) => {
    const items = [];
    let cursor = undefined;
    let pages = 0;

    do {
        const { data } = await tinkoffApi.post(
            '/tinkoff.public.invest.api.contract.v1.OperationsService/GetOperationsByCursor',
            {
                accountId,
                from,
                to,
                cursor,
                limit: 1000,
                operationTypes,
                state: 'OPERATION_STATE_EXECUTED',
            },
            {
                headers: {
                    Authorization: token,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (Array.isArray(data?.items)) {
            items.push(...data.items);
        }

        cursor = data?.hasNext ? data?.nextCursor : undefined;
        pages += 1;
    } while (cursor && pages < MAX_PAGES);

    return items;
};
