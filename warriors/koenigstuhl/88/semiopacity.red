;redcode
;author inversed
;name Semiopacity
;date 2025.11.15
;strategy Tournament Weekend 2025 entry
;strategy Conventional B-scanner
;assert CORESIZE == 8000

; Scanner
step    equ     1666
time    equ     3999

; Boot
bdist   equ     2*2310+1
x0      equ     (-CURLINE)
sfrom   equ     last+1

; Quickscan
qs      equ     291
qd      equ     4154
qbhop   equ     (-37)
qbstep  equ     11
qbcnt   equ     11
qpair1  equ     1
qpair2  equ     0
qpair3  equ     0
qpair4  equ     1

        ; Boot
boot    mov <      sfrom , < sto
        mov <      sfrom , < sto
        mov <      sfrom , < sto
        mov <      sfrom , < sto
        mov <      sfrom , < sto
        mov <      sfrom , < sto
        mov <      sfrom , < sto
        mov <      sfrom , < sto
sto     spl   x0+bdist+1 ,   x0+bdist+9
        mov <      sfrom , < sto
        dat #          0 , # 0

        ; Scanner
scan    add # step  , @ 2
        jmz  -1     , @ 2
        mov   5     , @ 1
        mov   2     , <-2-step*time
        jmn  -4     , @-4
        spl   0     , < 0
        mov   2     , <-9
        jmp  -1     ,   0
last    dat <-2     , <-92
        
        ; Decoy
    i for 47
        spl  -((i-1)%7) ,   i % 2 == 0
    rof

        ; Trimmed down quickscan
q0      cmp   2*qs+qd   ,   2*qs
qt1     jmp   qa0       , < 3*qs
        cmp   q0+5*qs+qd,   q0+5*qs
qt2     jmp   qa1       , < 4*qs
        cmp   q0+4*qs+qd,   q0+4*qs
qs1     djn   qa1       , # qt1
        cmp   q0+10*qs-2,   q0+10*qs+qd-2
qs2     djn   qa2       , # qt2
        cmp   q0+9*qs+qd,   q0+9*qs
qt3     jmp   qa2       , < 6*qs
        cmp   q0+6*qs+qd,   q0+6*qs
        jmp   qa2       , < qa1
        cmp   q0+8*qs+qd,   q0+8*qs
        jmp   qa2       , < qs1
        cmp   q0+11*qs  ,   q0+11*qs+qd
        jmp   qa3       , < qa2
        cmp   q0+18*qs-8,   q0+18*qs+qd-8
qs3     djn   qa3       , # qt3
        cmp   q0+14*qs  ,   q0+14*qs+qd
        jmp   qa3       , < qs1
        jmz   boot      ,   q0+15*qs
        
        ; Quickscan attack
qa3     add @ qs3       ,   qp
qa2     add @ qs2       , @ qa3
qa1     add @ qs1       , @ qa3
qa0     cmp @ qp        ,  -CURLINE-1
        cmp @ 0         ,   0
        add # qd        ,   qp
ql      mov   qb        , @ qp
qp      mov   qb        , < q0+2*qs
        add # qbstep    , @ ql
        djn   ql        , # qbcnt
        jmp   boot      ,   0
qb      dat <-qbhop     , < qbhop

end q0
