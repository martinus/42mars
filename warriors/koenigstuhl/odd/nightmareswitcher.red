;redcode-94odd
;name Nightmare Switcher!
;author John Metcalf
;strategy IRCT 16 Tiny Smart Switcher
;strategy not sure if it works!
;       CORESIZE==800
;assert 1

        key equ 19

djnclr  djn.f   #0      , <-1
        dat     0       , 0

think   ldp     #0      , #0
        ldp     #key    , #0
        add     {0      , think
        add.ba  think   , vect
        mod.a   #3      , vect
        stp.ab  vect    , #key
vect    jmp     @-1     , djnclr
        dat     0       , imp
        dat     0       , gate


imp     mov.i   #1      , $1
        dat     0       , 0
gate    jmp     $0      , <-20

END think
