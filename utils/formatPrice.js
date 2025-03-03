export const formatPrice = (data) => {
    const units = parseInt(data.units); // Целая часть
    const nano = parseInt(data.nano);   // Дробная часть (в нано-единицах)
    const amount = units + nano / 1e9;  // Суммируем и переводим нано в дробную часть
    return Number(amount.toFixed(2))
}