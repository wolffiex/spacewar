#Rx Spacewar

**Rx Spacewar** is a two player network arcade game in the category of low friction games like the original [Spacewar!](http://en.wikipedia.org/wiki/Spacewar_(video_game)), [Asteroids](http://en.wikipedia.org/wiki/Asteroids_(video_game)), and [Maelstrom](http://en.wikipedia.org/wiki/Maelstrom_(1992_video_game)).

Its implementation is an experiment in applying the principles of reactive programming to make a practical example of a fault tolerant distributed system that is eventually consistent.

##Use
1. Start the game by running <code>$ node app.js</code>
2. Connect a web browser to port 3000
3. Game will wait for two connections before starting, or change code in <code>/Game.js</code> to enable loopback behavior.

## Implementation notes
Rx Spacewar uses a "replay" strategy to achieve consistency across clients. When out-of-order input is received, that input is sorted into its proper place in the time-ordered list of input, and state is reset to the state before the disordered input. The subsequent input is then replayed, resulting in a recomputed game state. [This article] (http://gafferongames.com/networking-for-game-programmers/what-every-programmer-needs-to-know-about-game-networking/) is a good primer on how time is usually handled in game programs. The strategy used here replaces server control in favor of enventual consistency. 

![alt text](./README.png "Rx pipeline for Spacewar")

The server progresses clients through two phases: first, the server determines the latency of the round trip to a connected client using  [Cristian's algorithm](http://en.wikipedia.org/wiki/Cristian's_algorithm) with the server acting as the master. Once this is determined, two connections are brought together with <code>bufferWithCount(2,1)</code>. Each connection is told to start, and then messages from one client are sent to the other, and vice-versa. The server also contains a little bit of smarts to make it possible to loopback input and play a game with single socket.

The client initializes the game when the document is ready, and this step sets opens the socket. When the client receives the START message from the server, the reactive pipeline for the game is setup and the countdown begins. From then, input is reported to the other client in time relative to the game start. The game currently doesn't handle cases of clock skew.

Conceptually, the game has three threads. The *Input* thread combines local input from the keyboard, the random generator of rocks, and the input from the other player via the socket into a list that polled from the *Game* thread.

The *Game* thread runs on the timeout hook, but its execution is controlled by the *Render* thread. The *Game* thread merges input if necessary and then computes game state for a given game time. The *Render* thread runs inside <code>requestAnimationFrame</code> and schedules execution of the Game thread.