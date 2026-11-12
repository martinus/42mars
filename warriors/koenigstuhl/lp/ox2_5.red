;redcode-lp
;name Hypnos
;author inversed
;strategy 0.66c scanner
;assert (CORESIZE==8000) && (MAXPROCESSES==8)

hop     equ     17
step    equ     2*17
sofs    equ     6*step
len     equ     last-ptr+hop+2

cptr    equ     inc
safe    equ     8
gap     equ     3

org     ptr

bomb    djn     # 0     ,   # 0
loop    add       inc   ,     ptr
ptr     seq       sofs  ,     sofs+hop
        slt.ab  # len   ,     ptr
        jmn.a     loop  ,   @ loop
        mov       bomb  ,   * ptr
        mov       bomb  ,   @ ptr
        jmn.a     loop  ,   @ loop
inc     spl     # step  ,     step
clear   mov       kill  ,   > cptr
        djn.f     clear ,   { cptr-1
last    jmp     { 0     ,   } 0

        for       gap
        dat       0     ,     0
        rof

kill    dat       1     ,     safe

