;redcode-lp
;name The LP Destroyer
;author Christian Schmidt
;strategy paper and stone
;assert 1

;----Replinator------- 7

l       equ     21;25
zofs    equ     6667;1971

bo1     equ     548;2638
bo2     equ     109;2649
color   equ     7293;4001

from    mov     #l,     #0
ploop   mov     {bo1,   {bo2
        add     {0,     }0
        mov     <from,  {to
        jmn     ploop,  from
        spl     >from,  }color
to      jmz     zofs,   *0

for 29
 dat 0,0
rof

;----p-brain----------- 13

switch ldp.ba what, what
       mod.a #3, what
       ldp.ab #0, switch
       add.a @switch, what
       stp.ab *what, what
what   jmp @0, from
       dat 1, from
       dat 0, from
       dat 1, from
       dat 1, from
       dat 2, sloop
       dat 0, from
       dat 1, from

for 120
 dat 0,0
rof


;----- stone------------------31

step    equ (4*17)
count   equ (998)

steps   dat #2*step,#2*step
cbomb   dat >2667,#last-steps+2
        dat 0,0
sloop    add.f steps,ptr
        mov.i bomb,*ptr
ptr     mov.i x,x+step
x       djn.b sloop,#count
clear   mov.i cbomb,>steps
        djn.f clear,>steps
last    jmp -1,>steps+2667

        for 20
        dat 0,0
        rof

bomb    jmp #1,#1

end switch

