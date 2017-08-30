interface Dice {
    diceId: DiceId;
    owner?: EntityId;
    symbols: DiceSymbol[][];
    type: DiceType;
    level: number;
}
