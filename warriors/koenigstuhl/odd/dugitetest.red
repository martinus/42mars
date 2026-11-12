;redcode-94nop
;name Dugite Test C 4
;author Steve Gunnell
;strategy Stepping Stone derivative
;strategy A Dugite is an Australian poisonous snake.
;assert 1

STEP   equ (2+1723)
PIT    equ (gate+100+3211)
GAP1   equ 10
TIME   equ 17
HOP    equ (3+18)
DPTR   equ (inc-11)

gate    dat     PIT,                    0       ; gate/pointer for the clear
fang    jmp     gate+PIT+1,             0

       for  GAP1
        dat.f  $0      ,$0
       rof

loop    mov.i   inc,                    } gate
        add.f   inc,                    fang    ; 
fptr    mov.i   @fptr,                 @ fang	;  basic vamp loop
        jmz.f   loop,                   * fang	; /

ptr     mov.a   @fptr,                 gate    ; guide the clear to the found

        djn.b   loop,                   # TIME ; after a fixed number of stuns
                                                ; switch to endgame

inc     spl     # STEP,                # -STEP; endgame: d-clear
clear   mov     bomb,                   > DPTR
        djn.f   -1,                     > DPTR

bomb    dat }5335, HOP

end loop

