;redcode-94nop
;name V.shot
;originally named Veryshot for its specialness
;The dot must be read aloud for no good reason ;)
;author NDusN
;which is how CoreWin display теsт
;strategy q and bishot utilizing Lore-style clear
;To my knowledge, the only other published warrior at this time that uses
;this sort of clear is Forgotten Lore II itself. Why haven't anyone else thought
;of using it despite it being handy in several situations
;assert CORESIZE == 8000

org     qscan;from Core Warrior #92

qm      equ 3722
qm2     equ 2681

qa1     equ ((qtab1-1-found)*qm2+1)
qa2     equ ((qtab1-found)*qm2+1)
qb1     equ ((qtab2-1-found)*qm2+1)
qb2     equ ((qtab2-found)*qm2+1)
qb3     equ ((qtab2+1-found)*qm2+1)
qc      equ ((qtab3-found)*qm2+1)

        dat 7, qb1
qtab2   dat 7, qb2
        dat 7, qb3
        for 13
        dat 0, 0
        rof

step    equ 15
step2   equ 4500
off     equ 10

boot    
i       for 6 ;boot clear
        mov 12, step2-off
        rof
        for 5 ;boot scan
        mov 12, step2
        rof
        djn.f boot+step2+6, {3333

        ;lore-style clear written from scratch because it's actually easy to understand
gate    dat step, step
        dat <2667, 8
data    spl #16, {-2077
        mov data, >gate
        mov *-1, }gate
        jmp -2, <-3
        ;scanning part
init    add gate-off, scan
scan    sne 30, 4030
        djn.f init, @scan
        mov.f scan, gate-off
        jmp data-off, {3333
        for 13
        dat 0, 0
        rof

qtab3   dat >-90, >qc
        for 5
        dat 0, 0
        rof
        dat 0, qa1
qtab1   dat -1, qa2
        for 5
        dat 0, 0
        rof
qscan   sne found+qm*qc, found+qm*qc+qb2
        seq <qtab3, found+qm*(qc-1)+qb2
        jmp q0, }q0
        sne found+qm*qa1, found+qm*qa1+qb2
        seq <(qtab1-1), found+qm*(qa1-1)+qb2
        djn.a q0, {q0
        sne found+qm*qa2, found+qm*qa2+qb2
        seq <qtab1, found+qm*(qa2-1)+qb2
        jmp q0, {q0
        sne found+qm*qb1, found+qm*qb1+qb1
        seq <(qtab2-1), found+qm*(qb1-1)+(qb1-1)
        jmp q0, {q2
        sne found+qm*qb3, found+qm*qb3+qb3
        seq <(qtab2+1), found+qm*(qb3-1)+(qb3-1)
        jmp q0, }q2
        sne found+qm*qb2, found+qm*qb2+qb2
        seq <qtab2, found+qm*(qb2-1)+(qb2-1)
        djn.f q0, <found+qm*(qb2-1)+(qb2-1)
        seq >found, found+qm+(qb2-1)
        jmp q1, <found
        seq found+(qm+1)*(qc-1), found+(qm+1)*(qc-1)+(qb2-1)
        jmp q0, }q0
        seq found+(qm+1)*(qa2-1), found+(qm+1)*(qa2-1)+(qb2-1)
        jmp q0, {q0
        seq found+(qm+1)*(qa1-1), found+(qm+1)*(qa1-1)+(qb2-1)
        djn.a q0, {q0
        jmz.f boot, found+(qm+1)*(qb2-1)+(qb2-1)
q0      mul.b *q2, found
q1      sne {qtab1, @found
q2      add.b qtab2, found
        mov qtab3, @found
found   mov qtab3, }qm
        add #5, found
        djn -3, #20
        djn.f boot, @found

end
