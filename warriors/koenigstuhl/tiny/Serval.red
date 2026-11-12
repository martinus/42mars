;redcode-tiny
;name Serval
;author inversed
;strategy 0.75c scan -> spl wipe -> clear
;assert CORESIZE == 800

wlen    equ     17
step    equ     776
bofs    equ     756
aofs    equ     bofs + step
da      equ     713
sa      equ     524
gate    equ     wipe

org     ptr

loop    add       s0    ,   @ jr
ptr     sne.b     aofs  ,     bofs
        add.x     s0    ,     ptr
jr      jmz.f     loop  ,   @ ptr

wipe    mov       s0    ,   > ptr
        djn       wipe  ,   # wlen

s0      spl     # 2*step,     step
clear   mov     @ cr    ,   > gate 
        mov     @ cr    ,   > gate 
cr      djn.f     clear ,   { sbm
        dat       da    ,     2-gate 
sbm     spl     # sa    ,     2-gate

