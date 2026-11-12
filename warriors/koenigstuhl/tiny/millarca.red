;redcode-tiny
;name Millarca
;author inversed
;strategy Scanning vampire
;strategy Close relative of Carmilla
;assert CORESIZE==800

step    equ     119
time    equ     45
phaze   equ     step*time
atrace  equ     1*step

safe    equ     8
djs     equ     -6
zclear  equ     (pit-cptr-0)
cptr    equ     (bptr-1)

gap1    equ     2
gap2    equ     2
org     head

bptr    dat       0      ,     safe
cs0     spl     # djs    ,     zclear
clear   mov     @ ref    ,   > cptr
        mov     @ ref    ,   > cptr
ref     djn       clear  ,   { cs0

    for gap1
        dat       0      ,     0
    rof

head    mov.x   #-atrace ,     pit+atrace
loop    add.x     inc    ,   @ x1
        mov       ptr    ,   @ ptr
x1      jmz.f     loop   ,   * ptr
        mov       bomb   ,   * ptr
        jmz.f     loop   ,     pit
        spl       cs0    ,   < cptr
inc     djn.f   # step   ,   <-step
bomb    jmp     # 1      ,   > 1

    for gap2
        dat       0      ,     0
    rof

ptr     jmp     @ 0+phaze,     pit+atrace-phaze
pit     djn     # 0      ,   # 0

