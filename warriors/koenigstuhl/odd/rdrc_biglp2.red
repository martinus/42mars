;redcode-x verbose
;assert 1
; CORESIZE == 55440
;name rdrc_biglp2
;author Dave Hillis
;strat June 2002 contest
;strat only works for low processes
;strat -   Created using RedRace.c.
;strat -   An evolving population playing KOTH.
;strat -   Created using RedRace.c.
;strat -   An evolving population playing KOTH.
;strat -   Somewhat fudged by adding a mutation
;strat -   operator that looks for nice bombing
;strat -   patterns. Evolved against warriors
;strat -   from Koenigstuhl and other evolved.
sne.i  @  2409, >-25218
div.b  @-23194, *     5
spl.i  $  9957, <   394
mov.i  >  9658, $ 13784
spl.x  #     4, <  5394
mov.i  #   -99, {     5
djn.f  $    -1, <    -7
djn.i  $    -1, $  6388
mov.ba > -1468, } 13572
spl.i  $ 19609, }  5934
sne.i  }-22693, $    -3
cmp.i  > 20712, # 25091
jmz.i  @ 13045, < 10173
jmp.ab @-24456, >   -10
add.ba $ 23772, @  7809
end   3

