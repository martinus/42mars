;redcode-94nop
;name c/imple v3
;If you are wondering where are the first two versions, they are both named
;c/i Test (the one on Koenigstuhl is the first version).
;The first version is moderate, being similar to Dust 0.7 and is limited by
;my lack of experience at that time, it made the hill, but only due to
;unusual circumstances and is pushed off immediately;
;The second version is much better and more original, using a vortex launcher
;and two SPL's in the clear to keep up, a modern boot, and a few small tricks,
;survived 15 challenges on the hill, but might not score better on Koenigstuhl;
;This version changes to 3-point imps and is overall simpler, see below for
;other changes
;author NDusN
;which is how CoreWin display теsт
;strategy d-clear + imp + the obvious thing; a bit different from the others

;The difference: look at the other clear/imp's, they all use a JMP/ADD launcher
;that gives processes to the clear, launching 7-point imps.
;The likely reason for this is that the earliest Dust 0.7 used this, and people
;just follow it. However, we can't prove that it's really the best setting. the
;vortex launcher can be trivially modified to give processes to the clear, which
;is exactly what is used in this program. Also, 3-point imps seem to work better
;in this situation.
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

step    equ 2667
step2   equ 3300
step3   equ 3168

clear   spl #0, >data2-16
        mov data2, >data2-16
        djn.f -1, >data2-16
        dat <2667, {30
data2   dat <2667, {30
        spl #0
        add.a #step, 1
        spl imp-step*8, {1111
        djn.f boot2+clear-step3+step2-1, <-1111 ;there must be a better expression
imp     mov.i #0, step
boot    sub #4, boot1+step2-17
        mov <boot1, {boot1
        mov <boot2, {boot2
        spl 1, {4444
        spl 1, {3333
        mov <boot2, {boot2
boot2   spl step3, imp+1
        mov <boot1, {boot1
boot1   jmp step2, clear+5
        for 30
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
