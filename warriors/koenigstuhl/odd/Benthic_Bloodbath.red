;redcode-tiny
;assert 1 || CORESIZE == 800
;name rdrc:Benthic Bloodbath
;author Dave Hillis
;strategy - Created using RedRace.c.
;strategy - Bombs then clears.
 jmp.ba } 12, > -259
 spl.ba # -215, } 215
 mov.i > 1, { 4
 sub.f $ -2, $ -2
 djn.f $ -2, < -4
 spl.ba # -215, < -107
 mov.i { 246, { -389
 mov.i $ 173, { -266
 end 1
