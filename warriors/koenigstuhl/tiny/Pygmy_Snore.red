;redcode-tiny
;assert CORESIZE == 800
;name rdrc:Pygmy Snore
;author Dave Hillis
;strategy - Created using RedRace.c.
;strategy - Step bomber.
; Bombs for a while then freezes,
; waiting to get killed or run out the clock.
 jmp.ba } -7, { -259
 spl.ba # -215, > 215 ; step
 mov.i < 1, { 4 ; bombing
 sub.f $ -2, $ 0 ; applies step to line above
 djn.f $ -2, < -4 ; loops back
 spl.ba # 246, $ 102
 spl.ab { 318, > 2
 end 1
