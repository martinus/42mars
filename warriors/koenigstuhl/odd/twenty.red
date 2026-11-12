;redcode-odd
;name Twenty One of Everything is a Good Thing
;author Will 'Varfar'
;strategy 21 arms, 21 instructions, 21 processes,
;strategy taking 210 cycles to boot.
;strategy redcoders frenzy r-12
;assert 1

        arms    equ     21
        step    equ     381
        
spiral  spl     step+1
        for     arms-2
        mov     -1,     }spiral
        rof
imp     mov.i   #0,     step

; the next instruction only executes if the imp
; launch fails; I ought to be able to do something
; special with it, but can't think what..

        end
