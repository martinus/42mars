;redcode
;name Wimpy Clear
;author Jakub Kozisek
;assert 1

wimp    jmp     0,      0

for 10
        dat     #0,     #0
rof

start   spl     wimp
        spl     1
        spl     1
        spl     2
        jmp     @0,     loop
        add     #1,     -1

for 20
        dat     #0,     #0
rof

loop    mov     bomb,   @ptr
ptr     mov     bomb,   @-50
        add     #-2,    ptr
        jmp     loop
bomb    dat     #1,     #-1

        end     start
