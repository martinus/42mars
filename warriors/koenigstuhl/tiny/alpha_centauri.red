;redcode-tiny
;author inversed
;name Alpha Centauri
;strategy Quickscan -> dual stone
;assert CORESIZE == 800

stepA   equ     607
stepB   equ     738
time    equ     111
djs     equ     630
ofsA    equ      -(stepA*time)
ofsB    equ     1-(stepB*time)

bd1     equ     674
bd2     equ     bd1+400
len     equ     4

qx      equ     316
qy      equ     601
qany    equ     414

x0      equ     qscan
qa1     equ     ((qx-1)*qy+1)*(((qx-1)*qy)%800)
qb1     equ     (qx-1)*qy
qa2     equ     (qx*qy+1)*((qx*qy)%800)
qa3     equ     ((qx+1)*qy+1)*(((qx+1)*qy)%800)
qb3     equ     (qx+1)*qy
org     qscan

qscan   sne.f     qf+qa1    ,     qf+qb1
        seq.f     qf+qa2    ,   } qf
        jmp     @ qlo+1     ,   { qf
        sne.f     qf+qa3    ,     qf+qb3
        jmz.f     copy      ,   < qf

qf      mul.x   # qx        ,   # qy
        jmz.f   @ qlo+1     ,   > qf

qlo     mov     } qany      ,   > qf
        mov     } qlo       ,   { qf
        seq     { qf        ,   > qf
        djn.f     qlo       ,   > qf

copy    mov     { 1         ,   { bp1
        mov       inc+len   ,   { bp2
        djn       copy      ,   # len
bp1     spl       x0+bd1    ,   {-qany
bp2     jmp       x0+bd2    ,   {-qany

inc     spl     #-stepA     ,   <-stepB
stone   mov     > ofsA      ,     ofsB
        sub       inc       ,     stone
        djn.f     stone     ,   < djs

