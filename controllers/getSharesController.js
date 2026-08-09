import { getInstrumentByUid } from "../api/tinkoff/getSharesByUid/getShareByUid.js";

export const getSharesController = async (req, res) => {
    try {
        const token = req.headers.authorization;
        if (!token) {
            return res.status(400).json({ error: 'Authorization header is missing' });
        }

        const { ids, idType } = req.body;

        if (!Array.isArray(ids)) {
            return res.status(400).json({ error: 'Field "ids" must be an array' });
        }

        // idType опционален (по умолчанию 4=POSITION_UID); позволяет фронту
        // искать по FIGI/UID/тикеру, не ломаясь на захардкоженном значении.
        // allSettled: один битый инструмент не должен ронять весь ответ.
        const settled = await Promise.allSettled(
            ids.map((item) => getInstrumentByUid(token, item, idType))
        );

        const data = settled
            .filter((result) => result.status === 'fulfilled')
            .map((result) => result.value);

        res.status(200).json(data);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
