;redcode
;name Hexamorph
;author inversed
;strategy QScan, Spl/Jmp bomber -> Spiral clear
;assert (CORESIZE==8000) && (MAXPROCESSES==8000)

;.............. Bomber ....................................;
step    equ     2*hop
hop     equ     133
time    equ     600
ofs     equ     268         ; = hit-step*time-hop

loop    add     # step+1    ,   @ x1
        mov       bj+delta  ,   @ ptr
x1      mov       bs+delta  ,   < ptr
ptr     mov       bj2       ,   @ ofs
hit     jmn       loop      ,   @ x1
bj2     jmp       hop       ,     0

;.............. Spiral Clear ..............................;
; Stun bomb instructions are part of the clear

istep   equ     381
zsp     equ     8
icheck  equ     bs-1
kill    equ     bj+1

bs      spl       0         ,     hop
iptr    mov       bs        ,     bs+zsp
cptr    add     # istep     ,     iptr
        jmz       iptr      ,     icheck
datclr  mov       kill      ,   < cptr
bj      jmp       datclr    ,     0

;.............. Boot ......................................;
bd      equ     6738
delta   equ     hop-2
len     equ     6
x0      equ     loop

copy    sub     # delta     ,     bpt
boot    mov     < bpf       ,   < bpt
for     len-1
        mov     < bpf       ,   < bpt
rof
        djn       copy      ,   # 2
bpt     spl     @ 0         ,     x0+bd+len
        mov     # 1         ,     bpt
bpf     dat     # 0         ,   # bj+1

;.............. QScan .....................................;
qs      equ     3841
qd      equ     4000
qbinc   equ     (-9)
qbhop   equ     43
qbtime  equ     6
nil     equ     boot+100

qscan   cmp     2*qs+qd         ,         2*qs
qt1     jmp     qa0             ,       < 3*qs
        cmp     qscan+ 5*qs+qd  ,         qscan+ 5*qs
qt2     jmp     qa1             ,       < 4*qs
        cmp     qscan+ 4*qs+qd  ,         qscan+ 4*qs
qs1     djn     qa1             ,       # qt1
        cmp     qscan+10*qs-2   ,         qscan+10*qs+qd-2
qs2     djn     qa2             ,       # qt2
        cmp     qscan+ 9*qs+qd  ,         qscan+ 9*qs
qt3     jmp     qa2             ,       < 6*qs
        cmp     qscan+ 6*qs+qd  ,         qscan+ 6*qs
        jmp     qa2             ,       < qa1
        cmp     qscan+ 8*qs+qd  ,         qscan+ 8*qs
        jmp     qa2             ,       < qs1
        cmp     qscan+11*qs     ,         qscan+11*qs+qd
        jmp     qa3             ,       < qa2
        cmp     qscan+18*qs-8   ,         qscan+18*qs+qd-8
qs3     djn     qa3             ,       # qt3
        cmp     qscan+16*qs-2   ,         qscan+16*qs+qd-2
        jmp     qa3             ,       < qs2
        cmp     qscan+12*qs     ,         qscan+12*qs+qd
        jmp     qa3             ,       < qa1
        cmp     qscan+14*qs     ,         qscan+14*qs+qd
        jmp     qa3             ,       < qs1
        jmz     boot            ,         qscan+15*qs

qa3     add     @ qs3           ,         qp
qa2     add     @ qs2           ,       @ qa3
qa1     add     @ qs1           ,       @ qa3
qa0     cmp     @ qp            ,         nil
        cmp     @ 0             ,         0
        add     # qd            ,         qp
ql      mov       qbomb         ,       @ qp
qp      mov       nil           ,       < qscan+2*qs
        add     # qbinc         ,       @ ql
        djn       ql            ,       # qbtime
        jmp       boot          ,         0
qbomb   dat     # 0             ,       # qbhop

end     qscan

