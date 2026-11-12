;redcode-lp
;author inversed
;name Disciples of the Void
;strategy Quad scanner
;assert (CORESIZE==8000) && (MAXPROCESSES==8)

; Base scanner uses JMZ.A and has only one  non-transparent instruction.
; JMZ tests  < ptr instead of  @ ptr, which helps against imps.  Fairly
; weak alone, but four of them are a different story. All four scanners
; are mutually  invisible. There are two pairs, each  consisting of two
; slightly  different  scanners.  Step  magnitude  is the same, but one
; scanner uses ADD and another uses SUB,  so they do not hit each other
; until the endgame.  Second  pair is a shifted copy of the first  pair.
; Scanners from  different pairs do not see each other because the step
; is mod-2 and the shift is odd.  Dual boot helps against quickscanners.

step    equ     78
len     equ     6
kill    equ     -len-1
ptr1    equ     loop1-step+1
ptr2    equ     loop2-step-1

bofs    equ     4000-step/2
bd1     equ     2000
bd2     equ     bd1+2*step
bd3     equ     bd1+bofs
bd4     equ     bd2+bofs
x0      equ     j1

org     start

j1      jmp     # 0     ,     0
loop1   add.b   # 0     ,     ptr1
check1  jmz.a     loop1 ,   < ptr1
        mov     @ 0     ,   > ptr1
        jmn.a   @ 0     ,     check1
        spl     # 0     ,     0
        mov     @ 0     ,   < kill

boot1   mov     < bpf1  ,   < bp1t
        mov     @ bpf1  ,   < bp3t
        mov     < bpf1  ,   < bp1t
        mov     @ bpf1  ,   < bp3t
        djn       boot1 ,   # len/2
bp1t    mov       j1    ,   @ x0+bd1+len
bp3t    mov       j1    ,   @ x0+bd3+len
bpf1    spl     @ bp1t  ,     loop1+len
        jmp     @ bp3t  ,     0

        for       83
        dat       0     ,     0
        rof

start   spl       boot1 ,     0
        jmp       boot2 ,     0

        for       83
        dat       0     ,     0
        rof

j2      jmp     # 0     ,     step+2
loop2   sub.b   # 0     ,     ptr2
check2  jmz.a     loop2 ,   < ptr2
        mov     @ 0     ,   > ptr2
        jmn.a   @ 0     ,     check2
        spl     # 0     ,     0
        mov     @ 0     ,   < kill

boot2   mov     < bpf2  ,   < bp2t
        mov     @ bpf2  ,   < bp4t
        mov     < bpf2  ,   < bp2t
        mov     @ bpf2  ,   < bp4t
        djn       boot2 ,   # len/2
bp2t    mov       j2    ,   @ x0+bd2+len
bp4t    mov       j2    ,   @ x0+bd4+len
bpf2    spl     @ bp2t  ,     loop2+len
        jmp     @ bp4t  ,     0

