;redcode-tiny
;name Double Shock
;author inversed
;strategy Quickscan -> double clear
;date 2022.04.06
;assert CORESIZE==800

bd1     equ     676
bd2     equ     bd1+400

qx      equ     512
qy      equ     376
qa1     equ     ((qx-1)*qy+1)*(((qx-1)*qy)%800)
qa2     equ     (qx*qy+1)*((qx*qy)%800)
qa3     equ     ((qx+1)*qy+1)*(((qx+1)*qy)%800)
qany    equ     347

len     equ     4
x0      equ     qscan
org     qscan

qscan   sne.f     qf+qa1,     qf+(qx-1)*qy
        seq.f     qf+qa2,   } qf
        jmp     @ qlo+1 ,   { qf
        sne.f     qf+qa3,     qf+(qx+1)*qy
        jmz.f     copy  ,   < qf

qf      mul.x   # qx    ,   # qy    ; decode
        jmz.f   @ qlo+1 ,   > qf
                              
qlo     mov     } qany  ,   > qf    ; attack
        mov     } qlo   ,   { qf
        seq     { qf    ,   > qf
        djn.f     qlo   ,   > qf

copy    mov     { 1     ,   { bp1
        mov       s0+len,   { bp2
        djn       copy  ,   # len
bp1     spl       x0+bd1,   {-qany
bp2     jmp       x0+bd2,   {-qany

s0      spl     # 752   ,   { 587
        mov     >  91   ,   {  -1
        mov     {  -1   ,   <  -2
        djn.f      -2   ,      -3

