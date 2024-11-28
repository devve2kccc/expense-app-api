
export function convertAmountFromMiliunits(amount: number) {
    return amount / 1000;
}

export function convertAmountToMiliunits(amount: number) {
    return Math.round(amount * 1000);
}

export function formatCurrency(value: number) {
    return Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
    }).format(value);
}