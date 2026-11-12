;redcode-tiny
;name rdrc:Coolheaded Sandblast
;author Dave Hillis
;strategy - Created using RedRace.c.
;strategy - Bombs with imps, then splits
;strategy - into the imp-carpets. 
;assert CORESIZE == 800
 spl.ba # -215, < 215 ; steps
 mov.i # -170, { 2 ; imp/bomb
 sub.f $ -2, $ -1 ; apply step
 djn.f $ -3, { 219 ; loop back
 ;
 ; These trailing lines are necessary
 ; to keep the warrior functioning while
 ; it is overwriting itself with imps.
 ;
 nop.ab $ -256, > 201
 spl.ba $ -392, $ 69
 spl.ba # 1, $ 1
 mov.i } -84, } -263
 mov.i { 367, * -1
 end 1
