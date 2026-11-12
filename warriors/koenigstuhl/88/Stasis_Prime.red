;redcode
;name Stasis Prime
;author inversed
;strategy B-scanner, remake of David Moore's Stasis
;date 2025.01.12
;assert CORESIZE == 8000

; Scanner
step    equ     5308
stream  equ     2637
gate    equ     -10

; Boot
bdist   equ     2*2176+2
x0      equ     (-CURLINE)
sfrom   equ     jb

; Quickscan
qs      equ     134
qd      equ     4041
qbhop   equ     (-37)
qbstep  equ     11
qbcnt   equ     11

        ; Boot
boot    mov <      sfrom , < sto
        mov <      sfrom , < sto
        mov <      sfrom , < sto
        mov <      sfrom , < sto
        mov <      sfrom , < sto
        mov <      sfrom , < sto
        mov <      sfrom , < sto
        mov <      sfrom , < sto
sto     spl   x0+bdist+4 ,   x0+bdist+10
        mov <      sfrom , < sto
        mov <      sfrom , < sto

        ; Scanner
cc      dat < 2667      , < gate
jb      jmn  -1         , # clear+2
scan    mov   stun      , < targ+step+1
main    add # step+1    , @ safe
start   jmz   main      , < scan
safe    mov   jb        , @ scan
targ    jmz   scan      , @ scan
stun    spl   0         , < gate+1
clear   mov   cc        , < targ
        djn   clear     , < stream
        
        ; Decoy
    i for 46
        spl  -((i-1)%7) , CURLINE%4 != 0
    rof

        ; Trimmed quickscan, 10 pairs + jmz
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
        cmp   q0+12*qs  ,   q0+12*qs+qd
        jmp   qa3       , < qa1
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

