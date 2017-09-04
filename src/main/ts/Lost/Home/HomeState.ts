///<reference path="../State.ts"/>
class HomeState extends State<HTMLElement> {

    constructor(private gameService: GameService) {
        super('h');
    }

    init(stateListener: StateListener): void {
        super.init(stateListener, {});

        let universe = this.gameService.getUniverse();

        let element = this.element;
        let dimension = element.clientHeight;
        let rng = trigRandomNumberGeneratorFactory();
        let colors = createRandomWallColors(rng);
        let backgroundImage = createRepeatingBrickPattern(
            rng,
            dimension,
            dimension,
            5,
            8,
            .5,
            0,
            colors.wallUpper,
            colors.wallLower,
            4,
            .5,
            colors.grout,
            'LOST DUNGEON '.split('')
        );
        let dataURL = backgroundImage.toDataURL();
        element.setAttribute('style', 'background-image:url(' + dataURL + ')');

        // add listeners
        let newGameElement = document.getElementById('n');
        newGameElement.onclick = () => {
            let game = this.gameService.createGame();
            let playerEntity: Entity = {
                orientation: ORIENTATION_NORTH,
                side: 1,
                id: game.nextEntityId++,
                behaviorType: BEHAVIOR_TYPE_PLAYER,
                dice: [],
                healthSlots: 2,
                diceSlots: 8
            };
            let data: PlayStateData = {
                game: game,
                playerTransition: {
                    entity: playerEntity,
                    location: {
                        levelId: game.nextLevelId,
                        tileName: '11'
                    }
                }
            };
            stateListener(STATE_TYPE_PLAY, data);
        };
        newGameElement.setAttribute('href', '#_' + universe.nextGameId);

        // TODO might need to reduce down to a single game

        // add in existing games
        var existingGamesElement = document.getElementById('e');
        existingGamesElement.innerHTML = '';
        let games = this.gameService.getGames(universe.gameIds);
        for (let game of games) {
            let a = document.createElement('a');
            a.innerHTML = '<h2>Game ' + game.gameId;
            a.setAttribute('href', '#' + game.gameId);
            a.onclick = ((game: Game) => {
                return () => {
                    let data: PlayStateData = {
                        game: game
                    };
                    stateListener(STATE_TYPE_PLAY, data);
                }
            })(game);
            existingGamesElement.appendChild(a);
        }
    }

}
