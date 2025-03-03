import axios from "axios";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

export const tinkoffApi = axios.create({
    baseURL: process.env.TINKOFF_URL
})