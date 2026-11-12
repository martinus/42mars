;redcode-tiny
;author inversed
;name Dimachaerus
;strategy Bishot with spl/div clear
;assert CORESIZE == 800

; The last two instructions are eventually overwritten with divs,
; ensuring a proper div clear phase

step    equ     404
aofs    equ     434
hop     equ     546
djs     equ     373

org     ptr

scan    add       s0    ,     ptr 
ptr     sne       aofs  ,   } aofs + hop
        djn.f     scan  ,   < djs    
        div.x   # 39    ,   # 6     ; mod.x #6, #36 also works
s0      spl     # step  ,     step
loop    mov       s0    ,   } ptr
        mov       s0    ,   > ptr
cend    djn.a     loop  ,   < s0

