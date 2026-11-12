;redcode-94nop
;name Fort Destruction
;I originally reserved this name for a powerful stone/imp, but...
;author NDusN
;which is how CoreWin display теsт
;strategy Adding some diversity to the KotH hill: airbag and incen. bombs instead of imps
;It was independently developed, but ended up very similar to Behemot...
;assert CORESIZE == 8000

;Placed #4 when entered the nop hill, but did not enter the draft hill :(
;Thanks to Steve Gunnell for providing me with a hill approximation benchmark which this warrior is optimized against

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

step    equ 447
step2   equ 1959
step3   equ step2-65
off     equ -109
bmoff   equ 1

        mov.i {0, #0
init    mov jump+off, *2
        mov split+off, <1
        mov step*2-bmoff, @step-bmoff+1
        add *esc, -1
        mov }move+off, @-2
        jmz.a init, {move+off
esc     djn.f clr+step3-step2, {5555

boot    mov esc, esc+step2
bdata   spl 1, esc+step2
        spl 1, clr+step3+4
        mov <clr+4, <-1
        mov <split+3, <1
        mov.i -3, #split+3+step2+off
        mov {boot, <bdata
        djn.f >bdata, {6666

        dat 0, 0
split   spl #2, step*2
move    mov @0, }-1
jump    jmp -step, {1
        dat 0, 0

clr     spl #step*3, >step*3+1
        mov data, >data-16
        djn.f -1, >data-16
data    dat <2667, #21
        for 24
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
