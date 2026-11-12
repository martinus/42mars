;redcode-94nop 
;name Twin Storms
;author inversed 
;strategy Double Origin of Storms 
;strategy Variant 5a s9 
;date 2021.08.03 
;assert (CORESIZE==8000) && (MAXPROCESSES==8000) 
 
; ..... [ Constants ] ................................................ ; 
; Scanner 
step    equ     9 
first   equ     2416 
hop     equ     2414 
time    equ     348 
cptr    equ     bomb - 2 
bdist1  equ     6246 
bdist2  equ     bdist1 + 913 
 
; Quickscan 
qbstep  equ        5 
qbhop   equ      -74 
qbcnt   equ       20 
 
qa0     equ     7296 
qb0     equ     1120 
qa1     equ     6403 
qa2     equ     3424 
qb1     equ     7232 
qb2     equ     7749 
 
qa0a2   equ     (   (qa0    *  qa2    ) % CORESIZE ) 
qb0b2   equ     (   (qb0    *  qb2    ) % CORESIZE ) 
qa0a1   equ     (   (qa0    *  qa1    ) % CORESIZE ) 
qb0b1   equ     (   (qb0    *  qb1    ) % CORESIZE ) 
qa0a0   equ     (   (qa0    *  qa0    ) % CORESIZE ) 
qb0b0   equ     (   (qb0    *  qb0    ) % CORESIZE ) 
qa0da2  equ     ( ( (qa0-1) *  qa2    ) % CORESIZE ) 
qb0db2  equ     ( ( (qb0-1) *  qb2    ) % CORESIZE ) 
qa0a1d  equ     (   (qa0    * (qa1-1) ) % CORESIZE ) 
qb0b1d  equ     (   (qb0    * (qb1-1) ) % CORESIZE ) 
qa0a2d  equ     (   (qa0    * (qa2-1) ) % CORESIZE ) 
qb0b2d  equ     (   (qb0    * (qb2-1) ) % CORESIZE ) 
 
nil     equ     (-CURLINE-1) 
 
; Boot and layout 
gap     equ     46 
x0      equ     qscan 
org     qscan 
 
; ..... [ Code ] ..................................................... ; 
        ; Quickscan attack 
        dat       qa1   ,     qb1 
qtab    dat       qa2   ,     qb2 
qbomb   dat     > qbhop ,   { qtab 
decode  mul     @ qbomb ,     q0 
 
        ;decide - 1 + 0.5 + 1 + 0.5 = 3 cycles (average) 
decide  sne     * q0    ,   @ q0 
fast    mul.x     qtab  ,     q0 
        seq       nil   ,   * q0 
        mov.x     q0    ,     q0 
 
qbloop  mov       qbomb ,   @ q0 
q0      mov       qa0   ,   } qb0 
        add     # qbstep,     q0 
        djn       qbloop,   # qbcnt 
        jmp       boot  ,     0 
         
        ; Quickscan 
qscan   seq       q0+(qa0-1)*qb2        ,     q0+(qb0-1)*qa2 
        djn.f     fast                  ,     q0 
         
        seq       q0+qa0*qb1            ,     q0+qb0*qa1 
        jmp       fast                  ,    {fast 
         
        seq       q0+qa0*(qb1-1)        ,     q0+qb0*(qa1-1) 
        djn.f     fast                  ,    {fast 
         
        seq       q0+qa0*(qb2-1)        ,     q0+qb0*(qa2-1) 
        djn.f     fast                  ,     qtab 
         
        sne       q0+qa0                ,     q0+qb0 
        seq       q0+qa0*qb2            ,     q0+qb0*qa2 
        jmp       decide                ,     0 
 
        sne       q0+qa0a2              ,     q0+qb0b2 
        seq       q0+qa0a2*qb2          ,     q0+qb0b2*qa2 
        jmp       decode                ,     0 
 
        sne       q0+qa0da2             ,     q0+qb0db2 
        seq       q0+qa0da2*qb2         ,     q0+qb0db2*qa2 
        djn.f     decode                ,     q0 
         
        sne       q0+qa0a2d             ,     q0+qb0b2d 
        seq       q0+qa0a2d*(qb2-1)     ,     q0+qb0b2d*(qa2-1) 
        djn.f     decode                ,     qtab 
         
        sne       q0+qa0a1              ,     q0+qb0b1 
        seq       q0+qa0a1*qb2          ,     q0+qb0b1*qa2 
        jmp       decode                ,    <qbomb 
         
        sne       q0+qa0a1d             ,     q0+qb0b1d 
        seq       q0+qa0a1d*qb2         ,     q0+qb0b1d*qa2 
        djn.f     decode                ,    <qbomb 
 
        jmp       boot                  ,     0 
 
    for gap 
        dat     0,      0 
    rof 
 
        ; Boot 
boot    mov     { 1         ,   { go1 
        mov       db+1      ,   < go2 
        djn       boot      ,   # 9 
go1     spl       x0+bdist1 ,   > 1 
go2     djn.f   < 0         ,   * x0+bdist2 
 
        ; Scanner 
ptr     sne     first   ,     first+hop 
        add     db      ,     ptr 
p       mov     bomb    ,   > ptr 
        mov     bomb    ,   } ptr 
        djn   @ p       ,   # time 
bomb    spl   # 1       ,     1 
        mov     db      ,   > cptr 
        djn.f  -1       ,   > cptr 
db      dat     step-1  ,     step-1

