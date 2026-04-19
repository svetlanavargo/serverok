export type ApiError = {
    code: string;
    message: string;
};

export type ApiSuccessResponse<T = unknown> = {
    ok: true;
    data: T;
};

export type ApiErrorResponse = {
    ok: false;
    error: ApiError;
};

export type SafeUser = {
    id: string;
    email: string;
};

export type GameCard = {
    id: string;
    name: string;
    ac: number;
    currentHits: number;
    maxHits: number;
    initiativeBonus: number;
    isPlayer: boolean;
    note: string;
    color?: string;
};

export type Game = {
    id: string;
    name: string;
    cards: GameCard[];
    turnTimeMode: 'round' | 'time';
};

export type GamePatch = {
    id: string;
    name?: string;
    cards?: GameCard[];
    turnTimeMode?: 'round' | 'time';
};
