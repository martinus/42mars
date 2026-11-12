;redcode-tiny
;assert CORESIZE == 800
;name rdrc: Automata Prosthesis
;author Dave Hillis
;strategy -  Created using RedRace.c.
;strategy -  An evolving population playing KOTH.
;strategy -  Configured for the Tiny hill.
;evolved oneshot w/ incendiary. 5/11/18
sub.f  #  297, $    1
sne.i  $    2, *    37
djn.f  $    -2, {  100
spl.ba #    1, {    18
mov.i  @    2, }    -3
mov.i  <  -361, >    -2
mov.i  }    -1, >    -3
djn.f  $    -2, {  -317
spl.ba #    1, {    11
spl.ba $  -106, @    75
end  0

