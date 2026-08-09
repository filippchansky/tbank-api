import axios from "axios";
import https from "https";
import tls from "tls";
import dotenv from "dotenv";
import { RUSSIAN_TRUSTED_CA } from "./russianTrustedCa.js";

dotenv.config({ path: ".env.local" });

// Tinkoff Invest API отдаёт TLS-цепочку, подписанную Russian Trusted Root CA
// (Минцифры), которого нет в дефолтном trust store Node → без него запрос
// падает с SELF_SIGNED_CERT_IN_CHAIN (на Vercel и любой не-РФ инфраструктуре).
// Добавляем этот CA К системным корням (tls.rootCertificates), НЕ отключая
// проверку сертификата — в отличие от NODE_TLS_REJECT_UNAUTHORIZED=0, который
// открыл бы дорогу MITM.
const httpsAgent = new https.Agent({
    ca: [...tls.rootCertificates, RUSSIAN_TRUSTED_CA],
});

export const tinkoffApi = axios.create({
    baseURL: process.env.TINKOFF_URL,
    httpsAgent,
});
