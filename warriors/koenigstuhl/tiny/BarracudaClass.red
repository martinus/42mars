;redcode-tiny
;assert CORESIZE == 800
;name  rdrc: Barracuda Class
;author Dave Hillis
;strategy -   Created using RedRace.c.
;strategy -   An evolving population playing KOTH.
;strategy -   Configured for the Tiny hill.
; oneshot, falls into a replicator (EXcluding the oneshot)
; 5/11/18
mov.i  $  -137, {    -3
mov.i  #     2, $   -24
djn.f  $    57, <   290
mov.i  *    12, {   303
mov.i  #    -4, $   -30
add.f  $     3, $     1
mov.i  }   -95, <    30
jmz.f  $    -2, <    -1
spl.ba #   -48, $    47
mov.i  {   251, <    -2
mov.i  $  -228, >    -4
mov.i  <   159, {    -5
spl.ba #     0, >   350
mov.i  }    -6, }     1
jmp.ba $   270, <    48
jmp.ba $    -2, <    -8
end   6

