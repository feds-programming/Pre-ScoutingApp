export function meanOrNumber(value: any, fallback = 0): number {
    if (value == null) return fallback;
    if (typeof value === 'number') return value;
    if (typeof value === 'object' && value.mean != null) return value.mean;
    return fallback;
}

export function seasonWins(value: any): number {
    // Statbotics sometimes returns record.season.wins or record.wins
    return value?.record?.season?.wins ?? value?.record?.wins ?? 0;
}

export function seasonTies(value: any): number {
    return value?.record?.season?.ties ?? value?.record?.ties ?? 0;
}

export function seasonLosses(value: any): number {
    return value?.record?.season?.losses ?? value?.record?.losses ?? 0;
}

export function seasonWinrate(value: any): number {
    return value?.record?.season?.winrate ?? value?.record?.winrate ?? 0;
}
