;redcode-94
;name Invasion from pMars
;author Simon Wainwright
;strategy stone, clear
;assert 1
step equ 2365
inc     mov      {-step,      <step
ptr     mov   {1-step*2,   3+step*2
        sub.x       inc,        ptr
        jmz.f       ptr, 1+ptr+step
loop    mov       clear,     <inc-3
        jmp        loop,     <inc-2
clear   dat           1,          1
        end         inc
