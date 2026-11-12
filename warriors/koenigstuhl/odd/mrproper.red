;redcode-94x
;name Mr. Proper
;author Jakub Kozisek
;strategy clear
;assert 1

gate    equ     (start-10)

        org     start

        dat     <1      ,start

for 7
        dat     0,      0
rof

start   mov.i   bomb,   >gate
        mov.i   bomb,   >gate
        jmp     @-10,   {gate
bomb    dat     <267,   20-gate

