;redcode-tiny
;name Synergy 2
;author inversed
;strategy T.N.T.-style bomber with SPL stripe
;date 2022.05.05
;assert CORESIZE == 800

hop     equ     199
step    equ     (2*hop-1)
timer   equ     56
bmb0    equ     181
stripe  equ     212
safe    equ     4+dc-cptr
any     equ     669
x0      equ     bomb

qlen    equ     9
qa      equ     485
qb      equ     11
qc      equ     199
qd      equ     410
a0      equ     x0+qa
c0      equ     x0+qc

org     go-qlen

bomb    mov       hop    ,     1
loop    add     # step   ,     ptr
atk     mov       bomb   ,   @ ptr
ptr     mov       bomb   ,   { bmb0
cptr    mov       cs0    ,   < x0+stripe
        djn       loop   ,   # timer

cs0     spl     # 0      ,     0
dc      mov       kill   ,   > cptr
        djn.f     dc     ,   > cptr
kill    dat       any    ,     safe

i   for qlen
        mov     { a0+i*qb,     c0+i*qd
    rof
go      djn.f     atk    ,   { a0+(qlen+1)*qb

