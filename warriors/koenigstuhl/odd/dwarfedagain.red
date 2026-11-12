;redcode
;name Dwarfed Again
;author Winston Featherly-Bean
;strategy Just some ol' fashioned fiddlin'.
;assert 1

step equ 242
bstep equ 26
start   mov.i bmb, *bmb
        add.ab bmb, start
        jmz.f -2, bmb-8
        mov.i >step, <-step
        djn.f -1, <-step-1
bmb     jmp #bstep, 1
end start
