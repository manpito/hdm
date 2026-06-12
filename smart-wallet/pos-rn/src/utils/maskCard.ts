export const maskCardId = (id: string): string => {
    if (!id || id.length < 8) return '****';
    return `${id.substring(0, 4)}****${id.substring(id.length - 4)}`;
};
