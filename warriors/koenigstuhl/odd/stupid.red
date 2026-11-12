;redcode
;name Stupid
;author Lukasz Adamowski
;assert 1

djnclr  djn.f   #0      , <-1

magic   equ     13

start   ldp.a   #0,     result
        ldp.a   #magic, strat
        seq.a   #1,     result
        nop     }strat
        mod.a   #3,     strat
        stp     $strat, #magic
strat   jmp     @0,     djnclr
result  dat     $0,     imp
        dat     $0,     gate

imp     mov.i   #1      , $1
        dat     0       , 0
gate    jmp     $0      , <-20

        end     start
