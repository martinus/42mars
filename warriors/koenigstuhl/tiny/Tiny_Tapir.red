;redcode-94nop quiet
;name Tiny Tapir
;author Roy van Rijn
;strategy .66c bombing vampire
;assert 1
 
        vPit1  equ  177
        vPit2  equ  678
        vStep1  equ   2149
        vStep2  equ   5177
        vTimes   equ   25
 
f2      jmp     -vStep2         , vStep1
dd      dat     >0              , btm+5
cc      spl     #1              , btm+5
pPtr    jmp     -1              , 1
 
        dat     0               , 0
 
scan    sub.f   f1               , fang1
        mov.i   f1               , *fang1
        mov.i   f2               , @fang1
fang1   mov.i   clr+vPit1+vStep1 , @clr+vPit2+vStep2
        djn.b   -4               , #vTimes
 
clr     spl     #3              , 0
        mov.i   @1              , >f2
btm     djn.b   -1              , {cc
 
        dat     0               , 0
        dat     0               , 0
 
wBoot   mov     <pPtr           , <clr+vPit1+3
        mov     @pPtr           , <clr+vPit2+3
        djn.b   -2              , #2
bPtr    jmp     scan+1          , cc+1
f1      jmp     -vStep1         , -vStep2
 
end wBoot
