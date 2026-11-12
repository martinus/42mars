;redcode-tiny
;author inversed
;name Dimachaerus 2
;strategy Bishot with spl/div clear
;strategy Now with scan/stone loop
;assert CORESIZE == 800

step    equ     538
time    equ     396
aofs    equ     0 - (step * time)
hop     equ     558

org     ptr

scan    add       s0    ,     ptr 
ptr     mov     > aofs  ,     aofs+hop
        jmz.b     scan  ,   { ptr  
        div.x   # 39    ,   # 6
s0      spl     # step+1,     step
loop    mov       s0    ,   } ptr
        mov       s0    ,   > ptr
        djn.a     loop  ,   < s0

