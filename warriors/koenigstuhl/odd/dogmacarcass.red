;redcode verbose
;assert 1
; CORESIZE == 55440
;name Dogma Carcass
;author Dave Hillis
;strategy -   Created using RedRace.c.
;strategy -   An evolving population playing KOTH.
;strategy -   Configured for the big hill.
djn.f  *     0, <     0
div.i  <     0, #     0
dat.i  $     0, #     0
mul.ba >     0, @     0
spl.a  #     0, >     1
spl.i  #    -1, >     1
mov.i  @     1, }     1
div.i  #     1, }    -1
add.x  {     1, #    -1
djn.i  #     0, #    -1
mov.f  #     0, #     1
mov.i  #     1, @    -1
mov.i  #    -1, #     0
spl.i  @    -1, >     1
spl.i  *     1, #     1
end   4

