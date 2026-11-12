;redcode
;name Mountain Viper
;author inversed
;strategy Oneshot, a rework of Michal Janeczek's vm5
;date 2025.01.06
;assert CORESIZE == 8000

; Scan and clear
step    equ   23
hop     equ   12
stream  equ   1471
scan0   equ   7479
gate    equ   8
cofs    equ   gate-4

; Quickscan
qs      equ   235
qd      equ   624
qbstep  equ   9
qbhop   equ   (-40)
qbcount equ   12
gap     equ   42

; Boot
bds     equ   5828
bdc     equ   bds+2+step
x0      equ   (-CURLINE)

        ; Boot
sboot   mov   slast        ,   x0+bds+4
    i for 4
        mov   slast-i      , < sboot
    rof
cboot   mov   clast        ,   x0+bdc+4
    i for 5
        mov   clast-i      , < cboot
    rof
        spl   x0+bds+1
        mov   kill         ,   x0+bdc-gate-1

        ; Clear
kill    dat <-gate-1       , # 0
cref    dat # 0            , # 2
        mov  -step-1       , @ 2
        spl   0            , <-gate
        mov @ cref         , < clast+cofs
        mov @ cref         , < clast+cofs
clast   djn  -2            , < stream

        ; Scan
scan    sub   inc          ,   look
look    cmp   scan0+hop    ,   scan0
inc     jmp   step         ,   step
        djn   scan         , @ look
slast   jmp   scan         ,   0    ; I'd rather lose a single point on average
                                    ; than risk a fatal DJN fallthrough caused
    i for gap                       ; by CDS attack or a decoy
        spl  -((i - 1) % 7),   1
    rof

        ; Trimmed down quickscan, 10 pairs + jmz
qscan   cmp   2*qs+qd      ,   2*qs
qt1     jmp   qa0          , < 3*qs
        cmp   qscan+5*qs+qd,   qscan+5*qs
qt2     jmp   qa1          , < 4*qs
        cmp   qscan+4*qs+qd,   qscan+4*qs
qs1     djn   qa1          , # qt1
        cmp   qscan+10*qs-2,   qscan+10*qs+qd-2
qs2     djn   qa2          , # qt2
        cmp   qscan+9*qs+qd,   qscan+9*qs
qt3     jmp   qa2          , < 6*qs
        cmp   qscan+6*qs+qd,   qscan+6*qs
        jmp   qa2          , < qa1
        cmp   qscan+8*qs+qd,   qscan+8*qs
        jmp   qa2          , < qs1
        cmp   qscan+18*qs-8,   qscan+18*qs+qd-8
qs3     djn   qa3          , # qt3
        cmp   qscan+12*qs  ,   qscan+12*qs+qd
        jmp   qa3          , < qa1
        cmp   qscan+14*qs  ,   qscan+14*qs+qd
        jmp   qa3          , < qs1
        jmz   sboot        ,   qscan+15*qs

qa3     add @ qs3          ,   qp
qa2     add @ qs2          , @ qa3
qa1     add @ qs1          , @ qa3
qa0     cmp @ qp           ,  -CURLINE-1
        cmp @ 0            ,   0
        add # qd           ,   qp
ql      mov   qb           , @ qp
qp      mov   4000         , < qscan+2*qs
        add # qbstep       , @ ql
        djn   ql           , # qbcount
        jmp   sboot        ,   0
qb      dat <-qbhop        , < qbhop+1

end qscan

