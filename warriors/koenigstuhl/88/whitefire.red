;redcode
;name White Fire
;author inversed
;strategy QScan, Torch-style bomber
;assert (CORESIZE==8000) && (MAXPROCESSES==8000)

;.............. Boot ......................................;
bds     equ     5300
kofs    equ     15
bmofs   equ     kofs+1
x0      equ     boot

boot    mov       kill      ,     x0+bds+kofs
        mov       bm        ,     x0+bds+bmofs
        mov     < bpf       ,   < bpt
copy    mov     < bpf       ,   < bpt
        mov     < bpf       ,   < bpt
        mov     < bpf       ,   < bpt
        djn       copy      ,   # 2
bpt     jmp     @ 0         ,     x0+bds+7

;.............. Bomber ....................................;
hop     equ     34
step    equ     2*hop
time    equ     821
ofs     equ     141         ; = hit-step*time-hop
wlen    equ     7
stream  equ     4000

bs      spl       0         ,   < wlen+1-hop
ptr     mov       bs        ,   < ofs
        mov       bs+bmofs  ,   @ ptr
cptr    add     # step      ,     ptr
hit     jmp       ptr       ,     0
clear   mov       bs+kofs   ,   < cptr
        djn       clear     ,   < bs+stream
bpf     dat     # 0         ,   # 0
kill    dat     < wlen-hop  ,   < 2667
bm      mov       hop       ,   < hop+1

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

