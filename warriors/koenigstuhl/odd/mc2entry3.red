;redcode
;name Tie
;author Jakub Kozisek
;strategy ties :) Look down for code. Look not so down for info. :)

;assert 1

; OK. This is static warrior. It waits till it get bombed and then stay
; on that instruction that will not get bombed for sure. The dwarf's
; speed is 0.33c and he bombs every 2nd location, then it bombs itself,
; so only SPL remains alive.
;
; My 1st version was:
;
; 1) jmz.f #0, 3
; 2) jmz.f #0, 3
; 3) jmz.b -2, #0
; 4) jmz.f #1, #1
; 5) jmz.f #1, #1
;
; 4 and 5 are just "pointers" and they never get executed, main loop is
; 3 instructions long.
;
; 2 cases:
; a) line 5 get bombed with dat 0, 0
; if on 1 -> go to 2 and process will stay there forever
; if on 2 -> stay there
; if on 3 -> jump to 1, then to 2 and stay there
; (keep in mind that dwarf is 0.33c, so we have enough time)
; b) line 4 get bombed
; if on 1 -> stay there forever
; if on 2 -> go to 3, then jump to 1 and stay there
; if on 3 -> jump to 1 and stay there
;
; OK. It's working. But it has 5 lines and we want to be smaller.
; We don't need jmz to test if that location is bombed, we can simply
; decrement that locations! YES, our length is 4. :)

; Neogryzor: change your dwarf to:
; spl 0, <-1
; mov -2, <-2
; And this will be enough:
; jmz.b #0, 2
; jmz.b #0, 2 ( or just jmz.b #0, #0)
; :)

; ##############

jmz.f <4, <5 ; make our "table"
jmz.f #0, 3 ; check
jmz.f #0, 3 ; check
jmz.b -2, #0 ; loop

