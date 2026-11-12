;redcode-94x
;name Cut, cut
;author Jakub Kozisek
;strategy one-shot
;assert 1

gate    equ     (start-3)

        org     start

        dat     0,      start

for 6
        dat     0,      0
rof

inc     dat     #8,     #8
start   add.f   inc,    ptr
ptr     sne.i   1,      5
        jmp     @-10,   <gate
        mov.i   bomb,   >ptr
        mov.i   bomb,   >ptr
        mov.i   bomb,   >ptr
        mov.i   bomb,   >ptr
        mov.i   bomb,   >ptr
        spl     -5
bomb    dat     <gate,  <267


