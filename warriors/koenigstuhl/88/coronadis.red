;redcode
;author Christian Schmidt
;name Corona Discharger
;assert 1
;strategy scan quick - bomb small - imp spiral fast

imp     equ impcopy+1836
hide    equ 4103
sstep    equ 7154
sstart  equ 29

;----- [ Stone ] --------------------------------------;

stone   spl     0               ,       <7114
        mov     <-sstart        ,       1-sstep
        add     1               ,       -1
        jmp     -2              ,       <-sstep

;----- [ Boot ] --------------------------------------;

start   mov     stone+3         ,       hide
        mov     stone+2         ,       <start
        mov     stone+1         ,       <start
        mov     stone           ,       <start
        spl     start+hide-3    ,       <3482
        spl     start+hide-3    ,       <3852
        spl     start+hide-3    ,       <3997

;----- [ Imp ring ] --------------------------------------;

ring    spl     9               ,       <4314
        spl     5               ,       <5187
        spl     3               ,       <4590
        mov     impcopy         ,       imp
        jmp     start+hide-3    ,       <4052
        jmp     imp             ,       <5219
        spl     2               ,       <592
        jmp     2667+imp        ,       <4310
        jmp     5334+imp        ,       <724
        spl     4               ,       <5049
        spl     2               ,       <3247
        jmp     1+imp           ,       <3483
        jmp     2668+imp        ,       <7088
        spl     2               ,       <1901
        jmp     5335+imp        ,       <3178
        jmp     2+imp           ,       <940
impcopy mov     0               ,       2667


;----- [ Quickscan ] --------------------------------------;

qs      equ     3841
qd      equ     4000
qbinc   equ     (-9)
qbhop   equ     43
qbtime  equ     6
nil     equ     start+100

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
        jmz     start           ,         qscan+15*qs

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
        jmp       start         ,         0
qbomb   dat     # 0             ,       # qbhop

end     qscan

