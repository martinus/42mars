;redcode-tiny
;assert CORESIZE == 800
;name rdrc: Cheap Absinthe
;author Dave Hillis
;strategy -   Created using RedRace.c.
;strategy -   An evolving population playing KOTH.
;strategy -   Configured for the Tiny hill.
; evolved oneshot. 2018
add.f  $     3, $     1
sne.x  $   370, $   127
djn.ba $    -2, >    43
spl.ba #    21, >    16
mov.i  {  -361, }    -3
mov.i  $    -2, >    -4
mov.i  $     4, >    -4
djn.f  $    -2, {  -226
end   1

