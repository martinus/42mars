;redcode
;name Double Shock
;author inversed
;strategy Double clear
;strategy Corewar Global Masters 2022 round 4 entry
;       (CORESIZE==800)
;assert 1

bd1     equ     659
bd2     equ     bd1+400

qxy     equ     160956
qx      equ     (qxy % 800)
qy      equ     (qxy / 800)
qany    equ     281

len     equ     4
x0      equ     qscan
org     qscan

qscan   sne.f qf+((qx-1)*qy+1)*(((qx-1)*qy)%800), qf+(qx-1)*qy
        seq.f qf+(qx*qy+1)*((qx*qy)%800),         }qf
        jmp   @qlo+1,                             {qf
        sne.f qf+((qx+1)*qy+1)*(((qx+1)*qy)%800), qf+(qx+1)*qy
        jmz.f copy,                               <qf

qf      mul.x   # qx    ,   # qy
        jmz.f   @ qlo+1 ,   > qf

qlo     mov     } qany  ,   > qf
        mov     } qlo   ,   { qf
        seq     { qf    ,   > qf
        djn.f     qlo   ,   > qf

copy    mov     { 1     ,   { bp1
        mov       s0+len,   { bp2
        djn       copy  ,   # len
bp1     spl       x0+bd1,   { -qany
bp2     jmp       x0+bd2,   { -qany

s0      spl.b   # 394   ,   } 657
        mov.i   < 126   ,   <-1
        mov.i   {-1     ,   {-2
        djn.f   $-2     ,   $-3
