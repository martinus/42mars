;redcode-nano
;name Humans rule over machines!
;author G.Labarga
;assert CORESIZE==80
;strategy scanner
;strategy Using JM's Origin of storms trick

loop:   add.ab #5,ptr
atk:    mov.i bm,>ptr
ptr:    jmz.f loop,7
        jmp atk,<-8
bm:     mov.i #1,-1
end ptr

