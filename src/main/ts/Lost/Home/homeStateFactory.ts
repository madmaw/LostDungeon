///<reference path="../State.ts"/>
///<reference path="../Util/createElement.ts"/>

function homeStateFactory(gameService: GameService): StateFactory {
    return function() {
        var result: State = {
            elementId: 'h',
            init: function (stateListener: StateListener) {
                stateDefaultInit(result, stateListener, {})

                let universe = gameService.getUniverse();

                let element = result.element;

                // add listeners
                let newGameElement = getElementById('n');
                newGameElement.onclick = function() {
                    let game = gameService.createGame();
                    let playerEntity: Entity = {
                        entityOrientation: ORIENTATION_NORTH,
                        side: 1,
                        id: game.nextEntityId++,
                        behaviorType: BEHAVIOR_TYPE_PLAYER,
                        resourceCounts: {},
                        dice: [],
                        healthSlots: 1,
                        diceSlots: 4
                    };
                    let data: PlayStateData = {
                        game: game,
                        playerTransition: {
                            entity: playerEntity,
                            entryLocation: {
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
                var existingGamesElement = getElementById('e');
                existingGamesElement.innerHTML = '';
                let games = gameService.getGames(universe.gameIds);
                arrayForEachReverse(games, function (game: Game) {
                    let elementName;
                    let status;
                    if (game.inactive) {
                        elementName = 'span';
                        status = 'Died ';
                    } else {
                        elementName = 'a';
                        status = 'Last Played ';
                    }
                    let a = createElement(elementName, { 'href': '#' + game.gameId});
                    a.innerHTML = '<h2>Expedition ' + game.gameId + '</h2>Depth ' + game.playerLevelId + '<br>'+status + game.updated;
                    if (!game.inactive) {
                        a.onclick = function () {
                            let data: PlayStateData = {
                                game: game
                            };
                            stateListener(STATE_TYPE_PLAY, data);
                        }
                    }
                    existingGamesElement.appendChild(a);
                });

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
                    colors.wallLower,
                    'LOST DUNGEON '.split('')
                );
                let dataURL = backgroundImage.toDataURL();
                element.setAttribute('style', 'background-image:url(' + dataURL + ')');

            },
            start: function () {
            },
            stop: function () {
            },
            destroy: stateDefaultDestroy
        };
        return result;
    
    }
}
