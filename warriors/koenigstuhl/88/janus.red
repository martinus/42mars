;redcode
;author inversed
;name Janus
;date 2025.11.15
;strategy Tournament Weekend 2025 entry
;strategy Double B-scanner
;assert CORESIZE == 8000

; Scanner
step    equ     4702
time    equ     1966
ofs     equ     step*2000
bdist   equ     2472
free    equ     27

; Quickscan
qs      equ     7681
qd      equ     7836
qstep   equ     9
qhop    equ     -30
qja     equ     -56
qcount  equ     10

x0      equ     (-CURLINE)

        ; Quickscan attack
qb      jmp   qja   , < qhop
qa3     add @ qs3   ,   qp
qa2     add @ qs2   , @ qa3
qa1     add @ qs1   , @ qa3
qa0     cmp @ qp    , < 1234
        cmp @ 0     ,   0
        add # qd    ,   qp
ql      mov   qb    , @ qp
qp      mov < 2345  , < q0+2*qs
        add # qstep , @ ql
        djn   ql    , # qcount

        ; Second boot
        spl   boot1
boot2   mov   scan2+8, < to2
        mov   scan2+7, < to2
        mov   scan2+6, < to2
        mov   scan2+5, < to2
        mov   scan2+4, < to2
        mov   scan2+3, < to2
        mov   scan2+2, < to2
        mov   scan2+1, < to2
        mov   scan2+0, < to2
to2     jmp @ 0      ,   x0+bdist+ofs+9

        ; Second scanner body
scan2   add # step  , @ 2
        jmz  -1     , @ 2
        mov   5     , @ 1
        mov   2     , <-2-step*time
        jmn  -4     , @-4
        spl   0     , < 0
        mov   2     , <-9
        jmp  -1     ,   0
        dat <-2     , <-92

        ; Decoy
    i for free
        spl  -((i-1)%9) ,   i % 2 == 0
    rof

        ; Quickscan
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
        cmp   q0+18*qs-8,   q0+18*qs+qd-8
qs3     djn   qa3       , # qt3
        cmp   q0+11*qs  ,   q0+11*qs+qd
        jmp   qa3       , < qa2
        cmp   q0+16*qs-2,   q0+16*qs+qd-2
        jmp   qa3       , < qs2
        cmp   q0+12*qs  ,   q0+12*qs+qd
        jmp   qa3       , < qa1

        ; First boot
        spl   boot2
boot1   mov   scan1+8, < to1
        mov   scan1+7, < to1
        mov   scan1+6, < to1
        mov   scan1+5, < to1
        mov   scan1+4, < to1
        mov   scan1+3, < to1
        mov   scan1+2, < to1
        mov   scan1+1, < to1
        mov   scan1+0, < to1
to1     jmp @ 0      ,   x0+bdist+9

        ; First scanner body
scan1   add # step  , @ 2
        jmz  -1     , @ 2
        mov   5     , @ 1
        mov   2     , <-2-step*time
        jmn  -4     , @-4
        spl   0     , < 0
        mov   2     , <-9
        jmp  -1     ,   0
        dat <-2     , <-92

end q0
