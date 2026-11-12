;redcode-tiny
;name Hardliner
;author inversed
;strategy Bombing oneshot. A rework of Christian Schmidt's Smartliner.
;date 2022.04.06
;assert CORESIZE==800

astep   equ     9
bstep   equ     23
aofs    equ     101
bofs    equ     -bstep*438
sdjn    equ     724
ddjn    equ     782
safe    equ     8
org     atk

loop    add      inc     ,   atk
atk     mov    > aofs    ,   bofs
        jmz.b    loop    , { atk
inc     spl    # astep+1 , < bstep
        mov    @ bptr    , } atk
cloop   mov    @ bptr    , } atk
bptr    djn.f    cloop   , < clr
        dat    # safe    ,   ddjn
clr     spl    # safe    ,   sdjn

