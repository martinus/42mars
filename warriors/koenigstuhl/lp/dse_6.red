;redcode-lp
;name Distortion Energy
;author inversed
;strategy Paper + self-modifying stone
;assert (CORESIZE==8000) && (MAXPROCESSES==8)

; ..... Paper .............................................
len     equ     38
len0    equ     5
pofs    equ     5919
dec     equ     2746

from    mov     # len   ,   # len0
ploop   mov     < from  ,   { to
        jmn       ploop ,     from
        spl       from  ,   { dec
to      jmz       pofs  ,   * 0

        for       93
        dat       0     ,     0
        rof

; ..... Stone .............................................
; If not overwritten by the paper, the stone undergoes 
; 3 step mutations, bombing large part of the core and 
; transforming into a clear.  Helps a lot if the paper
; is stunned.

astep   equ     35
bstep   equ     44
aofs    equ     -2
bofs    equ     -1
gate    equ     inc-3

inc     dat       bstep ,     astep
loop    add.x     inc   ,     ptr
ptr     mov     { aofs  ,     bofs
        jmp       loop  ,   < gate

        for       92
        dat       0     ,     0
        rof

; ..... Boot ..............................................
; 4 processes in the stone, rest in the paper. 

bds     equ     4895
bxs     equ     x0+bds
x0      equ     from

boot    spl       1     ,     inc+4
        spl       1     ,     bxs+4
        mov     < boot  ,   < boot+1
        djn     > 1     ,   # 4
        spl       bxs+2 ,     bxs+1
        jmp       ploop ,     0

end     boot

