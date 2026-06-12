import { Receipt } from '../types';
import { maskCardId } from './maskCard';

const sanitize = (str: string): string => {
    const map: { [key: string]: string } = {
        'ã': 'a', 'ç': 'c', 'é': 'e', 'ê': 'e', 'á': 'a', 'à': 'a', 'í': 'i', 'ó': 'o', 'õ': 'o', 'ú': 'u',
        'Ã': 'A', 'Ç': 'C', 'É': 'E', 'Ê': 'E', 'Á': 'A', 'À': 'A', 'Í': 'I', 'Ó': 'O', 'Õ': 'O', 'Ú': 'U'
    };
    return str.replace(/[ãçéêáàíóõúÃÇÉÊÁÀÍÓÕÚ]/g, m => map[m] || m);
};

export const buildReceiptLines = (receipt: Receipt): string[] => {
    const lines: string[] = [];
    const separator = '--------------------------------';

    lines.push(sanitize(receipt.installation_name || 'SmartWallet').toUpperCase());
    lines.push(separator);
    lines.push('COMPROVATIVO DE COMPRA');
    lines.push(separator);
    lines.push(`Data: ${receipt.date}`);
    lines.push(`Transacao: #${receipt.id}`);
    lines.push(separator);

    receipt.items.forEach(item => {
        lines.push(sanitize(item.name));
        const qtyLine = `${item.quantity}x @ ${(item.price ?? 0).toFixed(2)}`;
        const totalLine = ((item.quantity * (item.price ?? 0))).toFixed(2);
        // Padding for 32 chars
        const spaces = 32 - qtyLine.length - totalLine.length;
        lines.push(qtyLine + ' '.repeat(Math.max(1, spaces)) + totalLine);
    });

    lines.push(separator);

    const totalLabel = 'Total:';
    const totalVal = `${(receipt.total ?? 0).toFixed(2)} un.`;
    lines.push(totalLabel + ' '.repeat(Math.max(1, 32 - totalLabel.length - totalVal.length)) + totalVal);

    const balanceLabel = 'Saldo:';
    const balanceVal = `${(receipt.balance ?? 0).toFixed(2)} un.`;
    lines.push(balanceLabel + ' '.repeat(Math.max(1, 32 - balanceLabel.length - balanceVal.length)) + balanceVal);

    lines.push(separator);
    lines.push(`Cartao: ${maskCardId(receipt.card_id)}`);
    lines.push(separator);
    lines.push('Obrigado');

    return lines;
};
