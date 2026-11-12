;redcode-94nop
;name c/i Test
;first version, not the second
;author NDusN
;which is how CoreWin display теsт
;strategy clear/imp + the obvious thing
;assert CORESIZE == 8000
;This is my first program ever to get onto the 94nop hill on KotH, although with a somewhat cheaty strategy (c/i)
;and in a somewhat cheaty way (several updates to existing programs caused the 20th program's score to drop to as
;low as 118, this program was still a few points away from the 19th).

;Publishing it to make Koenigstuhl a little more lively
;The qscan is from Core Warrior #92

org     qscan

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

step    equ 1143
step2   equ 1500

boot    mov 6, step2-10
        mov 6, step2-10
        for 3
        mov 6, step2
        rof
        jmp boot+step2+2
data    dat #1200
data2   dat #20
clear   spl #0, >data-10
        mov data2-10, >data-10
        djn.f -1, >data-10
        for 27
        dat 0, 0
        rof
lnch    spl boot
        for 5
        spl 1
        rof
        spl 2
        djn.f imp, >data
        add.a #step, -1
        djn.f boot+step2+2, >data
imp     mov.i #-1, step

qtab3   dat >-42, >qc
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
        jmz.f lnch, found+(qm+1)*(qb2-1)+(qb2-1)
q0      mul.b *q2, found
q1      sne {qtab1, @found
q2      add.b qtab2, found
        mov qtab3, @found
found   mov qtab3, }qm
        add #5, found
        djn -3, #20
        djn.f lnch, @found

end
