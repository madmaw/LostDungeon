interface PlayStateData {
    game: Game;
    playerTransition?: {
        entity: Entity;
        location: LevelLocation;
        // TODO probably want a hint as what kind of level to generate if required
    }
}