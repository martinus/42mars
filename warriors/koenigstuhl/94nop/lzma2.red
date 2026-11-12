;redcode-94nop
;name lzma2
;or rather, Epsilon. This is actually totally unrelated to lzma, but it shares
;the same core feature: deadly against imps.
;author NDusN
;which is how CoreWin display теsт
;strategy q, Very anti-imp paper and ordinary stone
;This warrior is somewhat ordinary, and not nearly as original as lzma
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
        for 11
        dat 0, 0
        rof

cnt     equ 3358
step    equ 3039
step1   equ 7848
step2   equ 2566
step3   equ 3201
step4   equ 2167
step5   equ 4081

boot    spl 2, {1111
        spl 2, {2222
        spl 1, }0
        spl 1, {3333
        mov <1, {1
        spl step5, data+2
        spl *-1, {4444
        mov <1, {1
        jmp step4, data2+1

        spl @0, >step1
        mov }-1, >-1
        spl @0, >step3
        mov }-1, >-1
        mov data2, >4063
        mov data2, >1102
        mov {-4, <1
        djn @0, <step2
data2   dat <2667, <5334

        spl #0
        mov data, @atk
hit     add #step*2, atk
atk     mov data, }hit-step*cnt
        djn.f -3, >hit-step*cnt
        dat 0, 0
        dat 0, 0
data    dat >step, >1
        for 12
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
