;redcode-94odd
;name Evil IRCT Rules!
;author John Metcalf
;strategy IRCT 16 Tiny Smart Switcher
;strategy probably doesn't work!
;       CORESIZE==800
;assert 1

        key equ 19

djnclr  djn.f   #0      , <-1
        dat     0       , 0

think   ldp.a   #0      , vect
        ldp     #key    , #0
        jmn     skip    , <0
        add.a   #1      , vect
skip    mod.a   #5      , vect
        stp.ab  vect    , #key
vect    jmp     @0      , djnclr
        dat     0       , gate
        dat     0       , imp
        dat     0       , gate
        dat     0       , imp

imp     mov.i   #1      , $1
        dat     0       , 0
gate    jmp     $0      , <-20

END think
