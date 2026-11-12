;redcode
;author Christian Schmidt
;name Copper Sputterer
;assert 1
;strategy qscan, paper with anti-imp clear and a stone

aaa    equ 142
bbb    equ 5398
ccc    equ 3538
ddd    equ 7831

length equ 9

;------boot-----------------------------

boot    spl     2               ,         0
pboo1   spl     2               ,         paper+length+aaa
pboo2   spl     1               ,         paper+length
        mov     -1              ,         0
        spl     stone           ,         0


;------paper----------------------------

        mov     <pboo2          ,         <pboo1

paper   spl     aaa             ,         length+(aaa*2)
        mov     <paper+length+aaa,        <paper

        mov     <length         ,         <1
        spl     @0              ,         bbb

inner   mov     <length         ,         <1
        spl     @0              ,         ccc
        spl     0               ,         <2
        mov     0               ,         <1
        djn     -1              ,         #ddd

        dat     #0              ,        #6000

        dat     #0              ,        #0
        dat     #0              ,        #0
        dat     #0              ,        #0
        dat     #0              ,        #0

stone   spl     0               ,        <1761
        mov     sbomb           ,        <-3023
        mov     sbomb           ,        @-1
        add     #-107           ,        -2
        djn     -3              ,        <1350

        dat     #0              ,        #0
        dat     #0              ,        #0

sbomb   dat     <1              ,        #17


   for 35
        dat     #0              ,        #0
   rof

;----- [ Quickscan ] --------------------------------------;

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

