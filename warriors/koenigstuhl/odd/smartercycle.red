;redcode-94
;name smarter cycle
;author David Houston
;assert 1

org     pbrain

djnclr  djn.f   #0      , <-1
        dat     0,      0

pbrain:
        ldp.a   #5,     gptr
        ldp.ab  #6,     #0
        jmz.b   change, -1
go:
        sub.ab  #1,     -2
        stp.b   -3,     #6
gptr:   jmp     @0,     djnclr
        dat     0,      imp
        dat     0,      gate
change:
        stp.ab  #2,     #6
        add.a   #1,     gptr
        mod.a   #3,     gptr
        stp.ab  gptr,   #5
        jmp     gptr


imp     mov.i   #1      , $1
        dat     0       , 0
gate    jmp     $0      , <-20

END
