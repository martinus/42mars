;redcode
;name JAI
;author Jakub Kozisek
;strategy Just A Imp
;assert 1

STEP    equ     2731


imp     mov     0, STEP
        dat     #0, #0
start   spl     1
        spl     1
        spl     1
        spl     2
jump    jmp     @0, imp
        add     #STEP, jump

        end     start
