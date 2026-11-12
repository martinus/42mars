;redcode-94x
;name Evolve X
;author John Wilkinson
;assert CORESIZE==55440

d       equ 34117

org start

start   spl     1
        spl     1
        mov     -1,     0
        spl     1
        spl     num2
        spl     20000,  0
        mov     >-1,    }-1
        spl     #d,     #19990
        add.f   -1,     1
        jmp     1-d*14, >2
        mov.i   #d,     *0

for 183
dat 0, 0
rof

num2    spl     20000,  0
        mov     >-1,    }-1
        spl     #d,     #19990
        add.f   -1,     1
        jmp     1-d*14, >2
        mov.i   #d,     *0

