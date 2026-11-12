;redcode-94nop
;name lzma
;The name is partially in reference to the size of papers: LZMA is an archive format like ZIP or TAR
;author NDusN
;which is how CoreWin display теsт
;strategy q + small coreclear paper + small paper/imp
;This is likely a new discovery: Despite the papers being small, it achieves higher-than-usual anti-imp ability
;by using 381 as a paper step which is a factor of both 2667 and 1143 and guarentees that the many points of the
;spiral are wiped at almost the same time, and thus easily killed. The papers are also more resistant against
;scanners for their size, which most likely is due to paper copies frequently overriding each other, again due to
;the step 381. I haven't yet found anything similar.
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
        
        for 14
        dat 0, 0
        rof

        ;paper/imp for added scanner and paper resistance
        spl @0, <step3
        mov }-1, >-1
        spl @0, <2668
        mov }-1, >-1
        mov.i #-step3*3, >step6 ;this was supposed to be a silk-imp but it turns out to be better as a bombing
        ;instruction. Interestingly, having silk-imp values in the a-field still seem to boost the performance
imp     mov.i #-step3*2, 2667

step1   equ 241
step3   equ 381 ;!!!important!!! do not touch this unless you're absolutely sure what you're doing!
step2   equ 3521
step5   equ 756
step6   equ 3736

boot    spl 2, {1111
        spl 1, {2222
        spl 1, {3333
        mov <1, {1
        spl step2, last+1
        mov <1, {1
        jmp step5, imp+1

        ;coreclear paper, scores ~200 against Son of Vain when used alone, but terrible against a-field imps
        spl @0, <step1
        mov }-1, >-1
        spl @0, <step3
        mov }-1, >-1
        mov.i #1, <1
last    djn -2, #5111

        for 16
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
