///<reference path="../State.ts"/>
///<reference path="../Util/createElement.ts"/>

function homeStateFactory(gameService: GameService): StateFactory {
    return function (stateId: StateTypeId, stateData: HomeStateData) {
        var result: State = {
            stateElementId: 'h',
            initState: function (stateListener: StateListener) {
                stateDefaultInit(result, stateListener, {})

                let universe = gameService.getUniverse();

                let element = result.stateElement;

                let successElement = getElemById('w');
                if (stateData && stateData.justExited) {
                    successElement.removeAttribute('class');
                } else {
                    successElement.setAttribute('class', 'h');
                }

                // add listeners
                let newGameElement = getElemById('n');
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
                        diceSlots: 3,
                        entityType: ENTITY_TYPE_PLAYER
                    };
                    let data: PlayStateData = {
                        game: game,
                        playerTransition: {
                            entity: playerEntity,
                            entryLocation: {
                                levelId: game.nextLevelId,
                                tileName: '10'
                            }
                        }
                    };
                    stateListener(STATE_TYPE_PLAY, data);
                };
                setAttrib(newGameElement, 'href', '#_' + universe.nextGameId);

                // add in existing games
                var existingGamesElement = getElemById('e');
                existingGamesElement.innerHTML = '';

                let dimension = element.clientHeight;
                let rng = mathRandomNumberGenerator;
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
                setAttrib(element, 'style', 'background-image:url(' + dataURL + ')');



                let games = gameService.getGames(universe.gameIds);
                arrayForEachReverse(games, function (game: Game) {
                    let elementName = 'a';
                    let elementAttributes: { [_: string]: string };
                    let status;
                    if (!game.gameState) {
                        status = 'Last Played ';
                        elementAttributes = { 'href': '#' + game.gameId };
                    } else {
                        if (game.gameState == GAME_STATE_WON) {
                            status = 'Escaped '
                        } else {
                            status = 'Died ';
                        }
                    }
                    let a = createElement(elementName, elementAttributes);
                    a.innerHTML = '<h2>Expedition ' + game.gameId + '</h2>Depth ' + game.playerLevelId + '<br>' + status + game.updated;
                    if (!game.gameState) {
                        a.onclick = function () {
                            let data: PlayStateData = {
                                game: game
                            };
                            stateListener(STATE_TYPE_PLAY, data);
                        }
                    }
                    existingGamesElement.appendChild(a);
                });
                                                                    

            },
            destroyState: stateDefaultDestroy
        };
        return result;
    
    }
}
