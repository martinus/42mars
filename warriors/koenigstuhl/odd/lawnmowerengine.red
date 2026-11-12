;redcode-94
;name Lawn Mower Engine
;author Ilmari Karonen
;assert 1

dstart  equ (foo+9)             ; should optimize this...
mstart  equ (bar-9)             ; should optimize this...

bar     dat      1      ,  dstart
        dat      1      ,  1

        mov.i   <foo    , <foo
clr     mov.i   <foo    , <foo
        djn.f    clr    , >bar
        jmp      clr    , >bar

foo     dat      1      ,  mstart
        dat      1      ,  bar-8-foo

        end clr

