#Rx Spacewar

**Rx Spacewar** is a two player network arcade game in the category of low friction games like the original Spacewar! Asteroids, and Maelstrom.

Its implementation is an experiment in applying the principles of reactive programming to make a fault tolerant distributed system that is eventually consistent.

##Rx
Rx is…

##Implementation notes

<!--The process of developing this little game made me realize how alien the reactive paradigm feels at first. When I started, I collected all the input in a reactive stream, dumped that in a global variable and then wrote a conventional imperative arcade game that took that input. But it's great that you can do that and then slowly figure out how best to adapt to the Reactive paradigm.

One thing I noticed was the way this upended my intutions about modularity. For example, when I originally wrote this, I had the files divided into the semantic things in the game, like ships, and shots and players. Over time, I refactored this along functional lines: ticking the simulation, or drawing.

But what Ben XXX said when he came here was that it takes about 6 weeks to become comfortable and looking at my git log, that's exactly where I am. Over time, I was able to adapt my imperative code better to the reactive paradigm.
-->

Conceptually, the game has three threads. The *Input* thread combines 


###Scheduling
processing input on the wrong thread

One of the last steps of this was untangling the dependency between the stream of input from the users vs the stream of update requests from 

###Observable of observables
e.g. sockets, server logging,  gameInfo?
###Immutability and share()
###Observable transport
