///<reference path="HomeState.ts"/>

// maybe want to move this into a single uber-factory for space reasons
function homeStateFactory(gameService: GameService): StateFactory {
    return function(stateTypeId: StateTypeId, data: HomeStateData): State<HTMLElement> {
        return new HomeState(gameService);
    }
}