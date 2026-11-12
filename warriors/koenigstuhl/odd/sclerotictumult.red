;redcode-94nop
;assert CORESIZE == 8000
;name rdrc: Sclerotic Tumult
;author Dave Hillis
;strategy -   Created using RedRace.c.
;strategy -   Configured for the 2016 Easter Contest.
;strategy -   multiwarrior, processes 64.
; Makes a copy and splits to it, then wipes. 
; The first copy does the same.
; The second copy goes straight to the wipe.
; The DIV # 1, # 1 bombs interact with the DJN to alter program flow.
mov.i  }     4, >   -15
mov.i  $   156, $    -1
mov.i  $    -1, $    -1
sne.x  *    -8, >  -263
spl.ba $     2, @  1401
div.i  #     9, #  1743
spl.ba #     0, <  -458 ; self-split
mov.i  }    -8, }     2 ; copy
mov.i  $     1, >  -495 ; throw spl bomb
spl.ba $  3510, > -1000 ; split to copy
mov.i  $   -11, <    -7 ; throw dat bomb
mov.i  $    -6, }   118 ; throw div # 1, # 1 stun-bomb
djn.f  $    -1, <    -3 ; djn
jmp.ba $    -3, >  2666 ; morph when djn falls through
jmp.ba $     0, $     0
end   4
