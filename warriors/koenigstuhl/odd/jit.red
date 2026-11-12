;redcode-94x
;name JIT
;author Jakub Kozisek
;strategy IRCT10
;assert 1


loop    add.f   inc,    ptr
ptr     mov.x   -2,     3
        jmp     loop,   <-10
inc     dat     -5,     5

for 10
        dat     0,      0
rof

for 6
        dat     1,      1
rof
