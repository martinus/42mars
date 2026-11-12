;redcode
;name Dwarfed
;author Winston Featherly-Bean
;strategy Not a very serious effort.  I've been outta things for awhile,
;strategy but it was fun to fiddle around.  BTW, thanks John for actually
;strategy replying to the questions in the strat lines of my last entry.
;strategy Unexpected and appreciated.  Additionally, thanks for hosting
;strategy an excellent tournament.
;assert 1

step equ 260
bstep equ 26
start   mov.i bmb, *bmb
        add.ab bmb, start
        djn.f -2, <-step+2
bmb     mov.i bstep, 1
end start
