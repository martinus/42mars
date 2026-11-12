;redcode-94nop
;name King Cobra
;author inversed
;strategy Oneshot with bomb detection and imp failsafe
;date 2021.08.21
;assert (CORESIZE==8000) && (MAXPROCESSES==8000)

; ..... [ Constants ] ................................................ ;
; Scanner, clear
step    equ     19
hop     equ     10
zofs    equ     2372
dsafe   equ     9
ssafe   equ     shift+1060
shift   equ     (step-2)
djs     equ     124

; Quickscan
qbstep  equ        5
qbhop   equ      -78
qbcnt   equ       20

qa0     equ     5340
qb0     equ     4327
qa1     equ     2215
qa2     equ     4665
qb1     equ     2487
qb2     equ     2698

; Definitions for avoiding integer overflow
qa0a2   equ     (   (qa0    *  qa2    ) % CORESIZE )
qb0b2   equ     (   (qb0    *  qb2    ) % CORESIZE )
qa0a1   equ     (   (qa0    *  qa1    ) % CORESIZE )
qb0b1   equ     (   (qb0    *  qb1    ) % CORESIZE )
qa01a1  equ     ( ( (qa0-1) *  qa1    ) % CORESIZE )
qb01b1  equ     ( ( (qb0-1) *  qb1    ) % CORESIZE )
qa0a0   equ     (   (qa0    *  qa0    ) % CORESIZE )
qb0b0   equ     (   (qb0    *  qb0    ) % CORESIZE )
qa01a01 equ     ( ( (qa0-1) * (qa0-1) ) % CORESIZE )
qb01b01 equ     ( ( (qb0-1) * (qb0-1) ) % CORESIZE )
qa01a2  equ     ( ( (qa0-1) *  qa2    ) % CORESIZE )
qb01b2  equ     ( ( (qb0-1) *  qb2    ) % CORESIZE )
qa02a2  equ     ( ( (qa0-2) *  qa2    ) % CORESIZE )
qb02b2  equ     ( ( (qb0-2) *  qb2    ) % CORESIZE )
qa0a11  equ     (   (qa0    * (qa1-1) ) % CORESIZE )
qb0b11  equ     (   (qb0    * (qb1-1) ) % CORESIZE )
qa01a11 equ     ( ( (qa0-1) * (qa1-1) ) % CORESIZE )
qb01b11 equ     ( ( (qb0-1) * (qb1-1) ) % CORESIZE )
qa0a21  equ     (   (qa0    * (qa2-1) ) % CORESIZE )
qb0b21  equ     (   (qb0    * (qb2-1) ) % CORESIZE )
qa01a21 equ     ( ( (qa0-1) * (qa2-1) ) % CORESIZE )
qb01b21 equ     ( ( (qb0-1) * (qb2-1) ) % CORESIZE )
nil     equ     (-CURLINE-1)

; Layout
g02     equ     21
g04     equ     20

; Boot
bdist   equ     6055
x0      equ     (-CURLINE)
org     qscan

; ..... [ Code ] ..................................................... ;

        ; Clear
cptr    dat       zofs+hop+1,     zofs
bptr    dat       1         ,     dsafe
cs0     spl     # djs       ,     ssafe
clear   mov     * bptr      ,   > cptr
        mov     * bptr      ,   > cptr
        djn.f     clear     ,   } cs0

        ; Quickscan
qscan   sne       q0+qa0            ,     q0+qb0
        seq       q0+qa0*qb2        ,     q0+qb0*qa2
        jmp       decide            ,     0                 ; D0

        sne       q0+qa0a2          ,     q0+qb0b2
        seq       q0+qa0a2*qb2      ,     q0+qb0b2*qa2
        jmp       decode            ,     0                 ; D1

        sne       q0+qa01a2         ,     q0+qb01b2
        seq       q0+qa01a2*qb2     ,     q0+qb01b2*qa2
        djn.f     decode            ,     q0                ; D2
        
        sne       q0+qa0a21         ,     q0+qb0b21
        seq       q0+qa0a21*(qb2-1) ,     q0+qb0b21*(qa2-1)
        djn.f     decode            ,     q2                ; D3
        
        sne       q0+qa0a1          ,     q0+qb0b1
        seq       q0+qa0a1*qb2      ,     q0+qb0b1*qa2
        jmp       decode            ,   < qbomb             ; D4
        
        sne       q0+qa0a11         ,     q0+qb0b11
        seq       q0+qa0a11*qb2     ,     q0+qb0b11*qa2
        djn.f     decode            ,   < qbomb             ; D5
        
        sne       q0+qa0a0          ,     q0+qb0b0
        seq       q0+qa0a0*qb2      ,     q0+qb0b0*qa2
        jmp       decode            ,   } decode            ; D6
        
        seq       q0+(qa0-1)*qb2    ,     q0+(qb0-1)*qa2
        djn.f     fast              ,     q0                ; S2
        
        seq       q0+qa0*(qb2-1)    ,     q0+qb0*(qa2-1)
        djn.f     fast              ,     q2                ; S3

        seq       q0+qa0*(qb1-1)    ,     q0+qb0*(qa1-1)
        djn.f     fast              ,   { fast              ; S5

        jmp       boot              ,     0
        
    for g02
        dat       0             ,   0
    rof

        ; Scan loop
loop    sub       inc           , @ 3
        seq     { loop-shift    , < loop-shift
        sne     { loop-shift    , < loop-shift
        djn.f     loop          , < loop-shift
inc     spl     * loop-shift+1  , < loop-shift
        mov.i   # 4000          ,   1
        
        ; Boot
boot    mov     { from          ,   { btptr
        mov     < from          ,   < btptr
        djn       boot          ,   # 6
btptr   spl       x0+bdist+6    ,     x0+bdist-shift+6
        mov.f   # 0             ,   { 0
from    dat       loop+6        ,     cptr+6

    for g04
        dat       0         ,     0
    rof

        ; Quickscan attack
        dat       qa1       ,     qb1
q2      dat       qa2       ,     qb2
qbomb   dat     > qbhop     ,   { q2
decode  mul     @ qbomb     ,     q0

        ;decide - 1 + 0.5 + 1 + 0.5 = 3 cycles (average)
decide  sne     * q0        ,   @ q0
fast    mul.x     q2        ,     q0
        seq       nil       ,   * q0
        mov.x     q0        ,     q0

qbloop  mov       qbomb     ,   @ q0
q0      mov       qa0       ,   } qb0
        add     # qbstep    ,     q0
        djn       qbloop    ,   # qbcnt
        jmp       boot      ,     0
