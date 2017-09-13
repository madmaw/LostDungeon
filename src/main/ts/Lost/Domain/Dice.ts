interface Dice {
    diceId: DiceId;
    owner?: EntityId;
    symbols: DiceSymbol[][];
    diceType: DiceType;
    diceLevel: number;
}
