export interface Product {
    id: number;
    name: string;
    price: number;
    stock_quantity: number;
    image_base64?: string;
}

export interface CartItem extends Product {
    quantity: number;
}

export interface Receipt {
    id: number;
    date: string;
    items: CartItem[];
    total: number;
    balance: number;
    card_id: string;
    installation_name: string;
}

export interface Settings {
    installationName?: string;
}

export type PrinterConfig =
    | { type: 'usb'; deviceId: string; deviceName: string }
    | { type: 'network'; host: string; port: number }
    | { type: 'none' };
