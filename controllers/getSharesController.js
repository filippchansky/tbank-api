import { getShareByUid } from "../api/tinkoff/getSharesByUid/getShareByUid.js";

export const getSharesController = async (req, res) => {
    try {
        const token = req.headers.authorization;
        if (!token) {
            return res.status(400).json({ error: 'Authorization header is missing' });
        }

        const { ids } = req.body;
        const data = await Promise.all(
            ids.map(async (item) => {
                const res = await getShareByUid(token, item);
                return res;
            })
        );
        console.log(data);
        res.status(200).json(data);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
